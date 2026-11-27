// End-to-end playthrough of a scene in headless Chrome at phone size.
// Drives the real UI (taps, choices, hotspots, QTEs), screenshots every beat
// and fails on console errors.
//
//   npm run dev            (in another terminal)
//   [UW_SCENE=s02] node scripts/playthrough.mjs [baseUrl] [outDir] [choiceIndex]

import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.argv[2] ?? process.env.UW_URL ?? 'http://localhost:5173'
const OUT = process.argv[3] ?? 'playthrough'
const PICK = Number(process.argv[4] ?? 0)
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu', '--autoplay-policy=no-user-gesture-required'],
})
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false })
const errors = []
let where = 'menu'
page.on('console', (m) => {
  // with the beat on screen when it was logged
  if (m.type() === 'error' || m.type() === 'warning') errors.push(`[${m.type()}] (at ${where}) ${m.text()}`)
})
page.on('pageerror', (e) => errors.push(`[pageerror] ${e.message}`))

const state = () => page.evaluate(() => {
  const s = window.__underworld?.store.getState()
  if (!s) return null
  const b = s.beat
  return { id: b?.id, type: b?.type, echo: !!s.echo, aside: !!s.aside, loading: !!s.loading, complete: s.completeOpen, fade: s.fade, backend: window.__underworld.engine.backend }
})
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` })
const sleep = (ms) => page.waitForTimeout(ms)

// UW_SCENE=s02 starts from a save where the earlier scenes are complete.
// UW_BOARD=1 starts after Scene 01 and plays street work from Lucas's board
// (UW_BOARD=2 takes the second contract, 3 the third), then checks the next morning.
const BOARD = Number(process.env.UW_BOARD ?? (process.env.UW_CONTRACT ? 1 : 0))
const SCENE = BOARD ? 's02' : (process.env.UW_SCENE ?? 's01')
const seedSave = (settings) => {
  const n = Number(SCENE.slice(1))
  const ids = Array.from({ length: n }, (_, i) => `s${String(i + 1).padStart(2, '0')}`)
  const state = { settings: { sound: true, music: 0.8, sfx: 1, textSpeed: 'normal', quality: 'auto', renderer: 'auto', ...settings } }
  if (n > 1) state.progress = { sceneId: SCENE, cursor: -1, completed: ids.slice(0, -1), unlocked: ids, starts: {} }
  if (BOARD) state.vars = { cash: 500, respect: 60, heat: 0, varga: 0 }
  return JSON.stringify({ state, version: 3 })
}
if (SCENE !== 's01') await page.addInitScript((save) => localStorage.setItem('underworld.save.v2', save), seedSave({}))
await page.goto(`${BASE}/?test`, { waitUntil: 'networkidle' })
await sleep(800)
await shot('00_menu')
if (process.env.UW_CONTRACT) {
  // a contract straight from the test hook (kit checks), not through the board
  await page.waitForFunction(() => window.__underworldBoot)
  await page.evaluate(async (id) => {
    const u = window.__underworldBoot
    u.store.getState().startScene(await u.loadScene(id), true)
  }, process.env.UW_CONTRACT)
} else if (BOARD) {
  await page.click('.menu-btn--board')
  await sleep(700)
  await shot('00_board')
  await page.locator('.board__job .btn--gold').nth(BOARD - 1).click()
} else {
  // Continue when there's a game to continue, else New Game (DOM order: New, Continue)
  await page.locator('.menu-btn--new, .menu-btn--continue:enabled').last().click()
}

let n = 1
let last = ''
const seen = new Set()
const t0 = Date.now()
while (Date.now() - t0 < 20 * 60_000) {
  const s = await state()
  if (s?.id) where = s.id
  if (!s || s.loading || s.fade) {
    await sleep(250)
    continue
  }
  const key = `${s.id}:${s.echo}:${s.aside}:${s.complete}`
  if (key !== last) {
    await sleep(s.type === 'shot' ? 900 : 650)
    await shot(`${String(n++).padStart(2, '0')}_${s.id}${s.echo ? '_echo' : ''}${s.aside ? '_aside' : ''}`)
    last = key
    if (!seen.has('backend')) {
      console.log('renderer:', s.backend)
      seen.add('backend')
    }
  }
  if (s.complete) {
    // UW_UNTIL=s02: a whole session — take the next job from each debrief until that scene's is reached
    const scene = await page.evaluate(() => window.__underworld.store.getState().scene?.id)
    const g = await page.evaluate(() => {
      const st = window.__underworld.store.getState()
      return { respect: st.vars.respect, cash: st.vars.cash, rank: st.flags.rank, grade: st.choices.job_grade, heat: st.vars.heat, varga: st.vars.varga }
    })
    console.log(`debrief ${scene} at ${((Date.now() - t0) / 1000).toFixed(0)}s: ${JSON.stringify(g)}`)
    await sleep(1800)
    await shot(`${String(n++).padStart(2, '0')}_${scene}_debrief`)
    await page.evaluate(() => document.querySelector('.debrief')?.scrollTo(0, 9999))
    await sleep(400)
    await shot(`${String(n++).padStart(2, '0')}_${scene}_debrief_end`)
    if (BOARD) {
      // back to the board, then on to the next morning
      await page.click('.debrief__next .btn--gold')
      await sleep(700)
      await shot(`${String(n++).padStart(2, '0')}_board_after`)
      await page.click('.board__skip')
      await sleep(700)
      await shot(`${String(n++).padStart(2, '0')}_board_morning`)
      const b = await page.evaluate(() => window.__underworld.store.getState().board)
      console.log('next morning', JSON.stringify(b))
      break
    }
    if (!process.env.UW_UNTIL || process.env.UW_UNTIL === scene) break
    await page.click('.debrief__next .btn--gold')
    last = ''
    await sleep(1500)
    continue
  }

  if (s.echo || s.aside || s.type === 'line' || s.type === 'title' || s.type === 'caption' || s.type === 'message' || s.type === 'job') {
    // a tap on the speech bubble finishes the typewriter; the Next button moves on
    if (await page.$('.comic-next:disabled')) await page.click('.dialogue', { timeout: 800 }).catch(() => {})
    await sleep(200)
    await page.click('.comic-next', { timeout: 1500 }).catch(() => {})
    await sleep(350)
  } else if (s.type === 'drive') {
    // hold the throttle (on the scene) until the car pulls up and the story moves on
    await page.mouse.move(195, 420)
    await page.mouse.down()
    await sleep(2500)
    await shot(`${String(n++).padStart(2, '0')}_${s.id}_driving`)
    await page.waitForFunction((id) => window.__underworld.store.getState().beat?.id !== id, s.id, { timeout: 90000 }).catch(() => {})
    await page.mouse.up()
  } else if (s.type === 'call') {
    await page.click('.call__answer', { timeout: 1500 }).catch(() => {})
    await sleep(600)
  } else if (s.type === 'choice') {
    // locked options (not enough cash or Respect) stay on screen but can't be taken
    const btns = await page.$$('.choice:not(.is-locked)')
    await btns[Math.min(PICK, btns.length - 1)].click()
    await sleep(900)
  } else if (s.type === 'explore') {
    // exploring is a pick from a list: look at one extra place first, then the one that moves on
    const extra = await page.$('.choices--explore .choice:not(.choice--main):not(:disabled)')
    if (!seen.has(s.id) && extra) {
      seen.add(s.id)
      await extra.click()
      await sleep(5000)
      continue
    }
    seen.add(s.id)
    const main = await page.$('.choices--explore .choice--main:not(:disabled)')
    if (!main) {
      await sleep(600)
      continue
    }
    await main.click()
    await sleep(7000)
  } else if (s.type === 'qte') {
    const kind = await page.evaluate(() => {
      const s = window.__underworld.store.getState()
      return s.beat.mode
    })
    if (kind === 'hold') {
      const box = await page.locator('.qte__hold').boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down()
      // hold for as long as this beat asks, plus a margin
      const holdMs = await page.evaluate(() => {
        const st = window.__underworld.store.getState()
        return st.beat.window
      })
      await sleep(holdMs + 700)
      await shot(`${String(n++).padStart(2, '0')}_${s.id}_holding`)
      await page.mouse.up()
      await sleep(900)
    } else if (kind === 'mash') {
      const box = await page.locator('.qte__mash').boundingBox()
      for (let i = 0; i < 12; i++) {
        await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
        await sleep(130)
        if (i === 5) await shot(`${String(n++).padStart(2, '0')}_${s.id}_mashing`)
      }
      await sleep(1200)
    } else {
      // timing: tap when the closing ring is near the target size
      for (let i = 0; i < 8; i++) {
        const ok = await page.waitForFunction(() => {
          const el = document.querySelector('.qte__closing')
          if (!el) return 'gone'
          const m = /scale\(([\d.]+)\)/.exec(el.style.transform)
          return m && Number(m[1]) <= 1.05 ? 'tap' : false
        }, null, { timeout: 4000, polling: 16 }).then((h) => h.jsonValue()).catch(() => 'gone')
        if (ok === 'gone') break
        await page.click('.qte__pad', { force: true })
        if (i === 1) await shot(`${String(n++).padStart(2, '0')}_${s.id}_hit`)
        await sleep(560)
      }
      await sleep(900)
    }
  } else {
    await sleep(400)
  }
}

await sleep(2500)
await shot(`${String(n++).padStart(2, '0')}_complete`)
const final = await page.evaluate(() => {
  const s = window.__underworld.store.getState()
  return { vars: s.vars, choices: s.choices, flags: s.flags, completed: s.progress.completed, unlocked: s.progress.unlocked }
})
console.log('final', JSON.stringify(final))
console.log(`screens: ${n}, errors/warnings: ${errors.length}`)
for (const e of [...new Set(errors)].slice(0, 40)) console.log(e)
await browser.close()
process.exit(errors.some((e) => e.startsWith('[error]') || e.startsWith('[pageerror]')) ? 1 : 0)
