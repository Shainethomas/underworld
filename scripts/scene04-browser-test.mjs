// Live Scene 04 world, hotspot, reload and completion regression.
// UW_URL=http://localhost:5174 node scripts/scene04-browser-test.mjs
import assert from 'node:assert/strict'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'
const out = 'artifacts/scene04-browser'
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] })
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  const errors = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' || (m.type() === 'warning' && /unknown|cannot resolve|not.*manifest/i.test(m.text()))) errors.push(m.text()) })
  await page.addInitScript(() => {
    if (sessionStorage.getItem('seeded')) return
    sessionStorage.setItem('seeded', 'yes')
    localStorage.setItem('underworld.save.v2', JSON.stringify({ version: 3, state: {
      settings: { sound: false, music: 0, sfx: 0, textSpeed: 'instant', quality: 'low', renderer: 'webgl2' },
      progress: { sceneId: 's04', cursor: -1, completed: ['s01','s02','s03'], unlocked: ['s01','s02','s03','s04'], starts: {} },
      flags: { saw_permit: true, heard_nico: true }, choices: { standoff: 'fight' },
    } }))
  })
  await page.goto(`${process.env.UW_URL ?? 'http://localhost:5173'}/?test`, { waitUntil: 'networkidle' })
  await page.locator('.menu-btn--new, .menu-btn--continue:enabled').last().click()
  const idle = async () => {
    await page.waitForFunction(() => { const s = window.__underworld?.store.getState(); return s?.scene?.id === 's04' && !s.loading && !s.fade }, null, { timeout: 60000 })
    await page.waitForTimeout(500)
  }
  const jump = async id => { await page.evaluate(id => window.__underworld.engine.jumpTo(id), id); await idle() }
  await idle()
  await jump('n_search')
  await page.screenshot({ path: `${out}/search.png` })
  await page.evaluate(() => window.__underworld.engine.walkToHotspot('bag'))
  await page.waitForFunction(() => !!window.__underworld.store.getState().aside, null, { timeout: 30000 })
  await page.evaluate(() => window.__underworld.store.getState().nextAside())
  await page.waitForFunction(() => window.__underworld.store.getState().beat.id === 'n_hurry')
  await jump('n_evidence')
  await page.screenshot({ path: `${out}/evidence.png` })
  await page.evaluate(() => window.__underworld.engine.walkToHotspot('coat'))
  await page.waitForFunction(() => window.__underworld.store.getState().beat.id === 'n_note', null, { timeout: 30000 })
  await idle()
  await jump('n_secret')
  const snapshot = () => page.evaluate(() => {
    const s = window.__underworld.store.getState(), e = window.__underworld.engine
    return { beat: s.beat.id, choices: s.choices, flags: s.flags, vars: s.vars, env: e.envId,
      cast: [...e.actors].filter(([,a]) => a.visible).map(([id,a]) => [id, ...a.position.asArray()]) }
  })
  const before = await snapshot()
  assert.equal(before.flags.n_evidence_found, true)
  assert.equal(before.flags.saw_permit, true)
  await page.reload({ waitUntil: 'networkidle' })
  await page.locator('.menu-btn--continue').click()
  await idle()
  assert.deepEqual(await snapshot(), before, 'reload restores evidence, pending choice and world')
  await page.locator('.choice').nth(1).click()
  await page.waitForTimeout(300)
  await jump('n_office')
  await page.screenshot({ path: `${out}/office.png` })
  await jump('n_complete')
  await page.waitForFunction(() => window.__underworld.store.getState().completeOpen)
  const progress = await page.evaluate(() => window.__underworld.store.getState().progress)
  assert.ok(progress.completed.includes('s04'))
  assert.ok(progress.unlocked.includes('s05'))
  assert.deepEqual(errors, [])
  console.log('Scene 04 browser: room and evidence hotspots, persisted evidence/choices/world, office, and completion passed.')
} finally { await browser.close() }
