// What the game asks of a cheap phone, beat by beat: draw calls, triangles,
// skinned characters and vertices, texture memory, JS heap and frame cost.
// Runs the phone settings the game picks on a touch device ("low" quality,
// WebGL 2, 1.5× resolution cap) at 360×780, with the CPU slowed down.
//
//   npm run dev   (or UW_URL=… for another server)
//   node scripts/measure-lowend.mjs [cpuSlowdown=4]
//   UW_QUALITY=lite …   (a tier instead of what the game picks: auto | high | low | lite)
//
// It can't slow the GPU: GPU-bound costs (shadows, post effects, fill) show
// up as draw calls, triangles and resolution here, and need a real phone with
// `?perf` to time.

import { chromium } from 'playwright-core'

const BASE = process.env.UW_URL ?? 'http://localhost:5173'
const SLOW = Number(process.argv[2] ?? 4)
const STOPS = (process.env.UW_STOPS ? JSON.parse(process.env.UW_STOPS) : null) ?? [
  ['s01', 'b1_title'], ['s01', 'b2_late'], ['s01', 'b3_guard'], ['s01', 'b4_notice'], ['s01', 'b7_l2'],
  ['s02', 's4_arrive'], ['s02', 's4_drive'], ['s02', 's5_arrive'], ['s02', 's7_arrive'],
  ['s03', 's3_l1'], ['s03', 's5_l1'],
]

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] })
const rows = []
for (const scene of [...new Set(STOPS.map(([s]) => s))]) {
  const page = await browser.newPage({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true })
  const n = Number(scene.slice(1))
  const ids = Array.from({ length: n }, (_, i) => `s0${i + 1}`)
  const save = { state: { settings: { sound: false, music: 0.8, sfx: 1, textSpeed: 'normal', quality: process.env.UW_QUALITY ?? 'auto', renderer: 'webgl2' }, ...(n > 1 ? { progress: { sceneId: scene, cursor: 0, completed: ids.slice(0, -1), unlocked: ids, starts: {} } } : {}) }, version: 4 }
  await page.addInitScript((s) => localStorage.setItem('underworld.save.v2', s), JSON.stringify(save))
  await page.goto(`${BASE}/?test&perf`, { waitUntil: 'networkidle' })
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: SLOW })
  // Continue when there's a game to continue, else New Game (DOM order: New, Continue)
  await page.locator('.menu-btn--new, .menu-btn--continue:enabled').last().click()
  const idle = () => page.waitForFunction(() => { const s = window.__underworld?.store.getState(); return s && s.scene && !s.loading && !s.fade }, null, { timeout: 180000 })
  await idle()
  for (const [, beat] of STOPS.filter(([s]) => s === scene)) {
    await page.evaluate((b) => window.__underworld.engine.jumpTo(b), beat)
    await page.waitForTimeout(600)
    await idle()
    await page.waitForTimeout(3500)
    const r = await page.evaluate(() => {
      const e = window.__underworld.engine
      const sc = e.bjs.scene
      const st = e.perf?.stats ?? {}
      let skinnedVerts = 0
      const cast = new Set()
      for (const m of sc.getActiveMeshes().data.slice(0, sc.getActiveMeshes().length)) {
        if (m.skeleton) {
          skinnedVerts += m.getTotalVertices()
          const actor = m.name.split(':')[0]
          cast.add(actor)
        }
      }
      gc?.()
      const mem = performance.memory
      return {
        set: st.set, fps: st.fps, frameMs: st.frameMs, logicMs: st.logicMs, renderMs: st.renderMs,
        draws: st.drawCalls, meshes: sc.getActiveMeshes().length, tris: Math.round(sc.getActiveIndices() / 3),
        cast: cast.size, skinnedK: +(skinnedVerts / 1000).toFixed(1), texMB: st.textureMB, textures: st.textures,
        heapMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : -1, res: st.resolution,
      }
    })
    rows.push({ beat: `${scene} ${beat}`, ...r })
    console.log(JSON.stringify(rows[rows.length - 1]))
  }
  await page.close()
}
console.table(rows)
await browser.close()
