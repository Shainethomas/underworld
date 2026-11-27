import { chromium } from 'playwright-core'
const OUT = process.argv[2]
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 })
await page.addInitScript(() => localStorage.setItem('underworld.save.v2', JSON.stringify({ state: { progress: { sceneId: 's02', cursor: -1, completed: ['s01'], unlocked: ['s01', 's02'], starts: {} } }, version: 3 })))
await page.goto('http://localhost:5173/?test', { waitUntil: 'networkidle' })
await page.click('.btn--gold')
const idle = () => page.waitForFunction(() => { const s = window.__underworld?.store.getState(); return s && s.scene && !s.loading && !s.fade }, null, { timeout: 60000 })
await idle()
await page.evaluate(() => window.__underworld.engine.jumpTo('s2_l2'))
await page.waitForTimeout(500); await idle(); await page.waitForTimeout(1500)
await page.addStyleTag({ content: '.bottom, .hud { display: none !important }' })
const clips = (process.argv[3] ?? '').split(',')
const fracs = (process.argv[4] ?? '0.3,0.6').split(',').map(Number)
for (const name of clips) {
  for (const f of fracs) {
    await page.evaluate(([name, f]) => {
      const e = window.__underworld.engine
      e.paused = true
      for (const [id, a] of e.actors) if (id !== 'rookie') a.setVisible(false)
      const a = e.actors.get('rookie')
      a.place(0, -10)
      a.faceYaw(0, true)
      a.update(0)
      for (const g of a.rig.clips.values()) { g.stop(); g.weight = 0 }
      a.fading.clear()
      const g = a.rig.clips.get(name)
      g.start(false, 1, g.from, g.to)
      g.weight = 1
      a.active = g
      g.goToFrame(g.from + (g.to - g.from) * f)
      g.pause()
      e.cine.set({ cam: name === 'LayToIdle' ? 'two:rookie,rookie' : 'medium:rookie' })
    }, [name, f])
    await page.waitForTimeout(400)
    await page.screenshot({ path: `${OUT}/${name}_${f}.png` })
  }
}
await browser.close()
