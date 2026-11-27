// Save/resume check: jump mid-scene, make a choice, reload the page, press
// Continue, and verify the cursor, choices and world state come back.
// UW_SCENE=s02 instead starts Scene 02 from a finished Scene 01 (checking its
// choices carry over), answers the man at the door on Hollis Hill and reloads
// mid-reply: the house, the cast where they stood, the parcel in the guard's
// hand and Rookie's earlier sets left behind.
//
//   [UW_SCENE=s02] node scripts/resume-test.mjs <outDir>

import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const out = process.argv[2] ?? 'resume-test'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const idle = () => page.waitForFunction(() => {
  const s = window.__underworld?.store.getState()
  return s && s.scene && !s.loading && !s.fade
}, null, { timeout: 60000 })
const snapshot = () => page.evaluate(() => {
  const s = window.__underworld.store.getState()
  const e = window.__underworld.engine
  // the boss: Victor Sable in Scene 01, the Don in the later scenes
  const boss = e.actors.get('victor') ?? e.actors.get('don')
  const rookie = e.actors.get('rookie')
  // which clip carries each fighter (Death01 while they are down)
  const clipOf = (id) => {
    const a = e.actors.get(id)
    if (!a?.visible) return null
    const top = [...a.rig.clips.values()].sort((x, y) => y.weight - x.weight)[0]
    return top ? top.name.split(':').pop() : null
  }
  return {
    beat: s.beat.id,
    choices: s.choices,
    flags: s.flags,
    vars: s.vars,
    env: e.envId,
    boss: boss?.visible ? boss.position.asArray().map((v) => +v.toFixed(2)) : null,
    rookie: rookie?.visible ? rookie.position.asArray().map((v) => +v.toFixed(2)) : null,
    fighters: ['fighter1', 'fighter2', 'marco'].map(clipOf),
    // everyone on the set, where they stand
    cast: [...e.actors].filter(([, a]) => a.visible).map(([id, a]) => [id, +a.position.x.toFixed(1), +a.position.z.toFixed(1)]),
  }
})

const SCENE = process.env.UW_SCENE ?? 's01'
await page.goto(`${process.env.UW_URL ?? 'http://localhost:5173'}/?test`, { waitUntil: 'networkidle' })
await page.evaluate((scene) => {
  localStorage.clear()
  if (scene !== 's02') return
  // Scene 01 finished: Rookie told Ravi he was there to train, not entertain people
  const vars = { don_loyalty: 0, independence: 5, ravi_trust: 0, discipline: 0, timeline_knowledge: 0, don_ambition_knowledge: 0, scientist_trust: 0 }
  const progress = { sceneId: 's01', cursor: 45, completed: ['s01'], unlocked: ['s01', 's02'], starts: {} }
  localStorage.setItem('underworld.save.v2', JSON.stringify({ state: { vars, progress, choices: { challenge: 'train' }, flags: { scene01_completed: true } }, version: 3 }))
}, SCENE)
/** Finish the line if it is still typing (tap the bubble), then press Next. */
const next = async () => {
  if (await page.$('.comic-next:disabled')) await page.click('.dialogue')
  await page.click('.comic-next')
}
await page.reload({ waitUntil: 'networkidle' })
// Continue when there's a game to continue, else New Game (DOM order: New, Continue)
await page.locator('.menu-btn--new, .menu-btn--continue:enabled').last().click()
await idle()
let carried = true
if (SCENE === 's02') {
  const start = await page.evaluate(() => ({ id: window.__underworld.store.getState().scene.id, ...window.__underworld.store.getState() }))
  carried = start.id === 's02' && start.choices.challenge === 'train' && start.vars.independence === 5
  console.log('carried from scene 01:', carried, JSON.stringify(start.choices))
  await page.evaluate(() => window.__underworld.engine.jumpTo('s7_l3'))
  await idle()
  await page.waitForTimeout(1500)
  await page.locator('.choice').nth(0).click()
  await page.waitForTimeout(800)
  // the echo, then into the guard's reply
  await next()
  await page.waitForTimeout(1500)
} else {
  // answer Lucas's challenge, then jump to Victor watching from the deck: Rookie's bag on the floor, Marco down
  await page.evaluate(() => window.__underworld.engine.jumpTo('b2_choice'))
  await idle()
  await page.waitForTimeout(1500)
  await page.locator('.choice').nth(0).click()
  await page.waitForTimeout(800)
  await page.evaluate(() => window.__underworld.engine.jumpTo('b4_deck'))
  await idle()
  await page.waitForTimeout(1500)
}
const before = await snapshot()
await page.screenshot({ path: `${out}/before.png` })

await page.reload({ waitUntil: 'networkidle' })
const menuHasContinue = await page.locator('.menu-btn--continue:enabled').count()
await page.screenshot({ path: `${out}/menu.png` })
await page.locator('.menu-btn--continue').click()
await idle()
await page.waitForTimeout(2000)
const after = await snapshot()
await page.screenshot({ path: `${out}/after.png` })

console.log('before', JSON.stringify(before))
console.log('after ', JSON.stringify(after))
console.log('continue button:', menuHasContinue === 1)
const keys = ['beat', 'choices', 'flags', 'vars', 'env', 'boss', 'rookie', 'fighters', 'cast']
const same = keys.every((k) => JSON.stringify(before[k]) === JSON.stringify(after[k])) && carried
console.log(same && menuHasContinue ? 'RESUME OK' : 'RESUME MISMATCH')
if (errors.length) console.log('errors:', errors)
await browser.close()
process.exit(same && menuHasContinue && !errors.length ? 0 : 1)
