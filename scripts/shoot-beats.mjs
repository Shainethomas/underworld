// Jumps straight to specific beats (via the dev-only engine hook) and saves a
// screenshot plus camera/actor positions for each — fast visual iteration.
//
//   node scripts/shoot-beats.mjs <outDir> <beatId> [beatId...]
//   UW_RENDERER=webgl2 UW_VIEWPORT=1440x900 UW_SCENE=s02 node scripts/shoot-beats.mjs ...

import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const [out, ...ids] = process.argv.slice(2)
mkdirSync(out, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] })
const [vw, vh] = (process.env.UW_VIEWPORT ?? '390x844').split('x').map(Number)
const page = await browser.newPage({ viewport: { width: vw, height: vh }, deviceScaleFactor: vw > 800 ? 1 : 2 })
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('ERROR', m.text()))
// UW_SCENE=s02 starts from a save where the earlier scenes are complete
const SCENE = process.env.UW_SCENE ?? 's01'
const seedSave = (settings) => {
  const n = Number(SCENE.slice(1))
  const ids = Array.from({ length: n }, (_, i) => `s${String(i + 1).padStart(2, '0')}`)
  const state = { settings: { sound: true, music: 0.8, sfx: 1, textSpeed: 'normal', quality: 'auto', renderer: 'auto', ...settings } }
  if (n > 1) state.progress = { sceneId: SCENE, cursor: -1, completed: ids.slice(0, -1), unlocked: ids, starts: {} }
  return JSON.stringify({ state, version: 3 })
}
if (process.env.UW_RENDERER || SCENE !== 's01')
  await page.addInitScript((save) => {
    if (!sessionStorage.getItem('seeded')) {
      localStorage.setItem('underworld.save.v2', save)
      sessionStorage.setItem('seeded', '1')
    }
  }, seedSave(process.env.UW_RENDERER ? { renderer: process.env.UW_RENDERER } : {}))
// UW_URL points at another dev server (default http://localhost:5173)
await page.goto(`${process.env.UW_URL ?? 'http://localhost:5173'}/?test`, { waitUntil: 'networkidle' })
await page.screenshot({ path: `${out}/_menu.png` })
// a seeded save continues at its scene; a fresh one starts a new game
await page.click(SCENE !== 's01' ? '.menu-btn--continue' : '.menu-btn--new')
const idle = () => page.waitForFunction(() => {
  const s = window.__underworld?.store.getState()
  return s && s.scene && !s.loading && !s.fade
}, null, { timeout: 60000 })
await idle()
// UW_CHOICES='{"question":"done"}' presets choices, e.g. to jump past a question hub
if (process.env.UW_CHOICES)
  await page.evaluate((c) => window.__underworld.store.setState((s) => ({ choices: { ...s.choices, ...JSON.parse(c) } })), process.env.UW_CHOICES)
// UW_FLAGS='{"nerve":0}' presets flags, e.g. a failed skill moment
if (process.env.UW_FLAGS)
  await page.evaluate((f) => window.__underworld.store.setState((s) => ({ flags: { ...s.flags, ...JSON.parse(f) } })), process.env.UW_FLAGS)
for (const id of ids) {
  await page.evaluate((b) => window.__underworld.engine.jumpTo(b), id)
  await page.waitForTimeout(400)
  await idle()
  // UW_WAIT: ms into the beat to shoot (default 1800), e.g. to catch a punch landing
  await page.waitForTimeout(Number(process.env.UW_WAIT ?? 1800))
  const info = await page.evaluate(() => {
    const e = window.__underworld.engine
    const cam = e.bjs.scene.activeCamera
    const r = (v) => v.asArray().map((x) => +x.toFixed(2))
    const actors = {}
    for (const [k, a] of e.actors) if (a.visible) actors[k] = { pos: r(a.position), yaw: +a.yaw.toFixed(2), head: r(a.head()), pose: a.pose }
    return { backend: e.backend, cam: r(cam.position), target: r(cam.getTarget()), actors }
  })
  console.log(id, JSON.stringify(info))
  await page.screenshot({ path: `${out}/${id}.png` })
}
await browser.close()
