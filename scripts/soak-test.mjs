// Long-play check: plays every scene again and again in one page, the way a
// player moves through a long game in one sitting, and fails if anything
// builds up. After each scene starts (and after visiting its other sets) it
// records the GPU textures, meshes, materials, geometries, animation groups,
// skeletons and resident files, plus the JS heap after a forced garbage
// collection, alongside PerfOverlay FPS, frame time and draw calls. The first
// cycle is a warm-up: it fills the caches that live for
// the whole session (the next scene's downloaded bytes, the last few decoded
// music tracks, compiled shaders, shared materials made on first use). The
// second cycle sets the baseline, and every later visit to the same scene must
// come back to it: anything that keeps growing is a leak, and over a long
// session it would run the phone out of memory.
//
//   npm run build && npm run preview
//   node scripts/soak-test.mjs [cycles=6] [url=http://localhost:4173]   (at least 3)
//   UW_TIER=lite node scripts/soak-test.mjs      (phone tiers: lite | low | high)

import { chromium } from 'playwright-core'

const CYCLES = Number(process.argv[2] ?? 6)
const URL = process.argv[3] ?? 'http://localhost:4173'
const TIER = process.env.UW_TIER ?? 'lite'
/** The scenes in story order, each with beats in its other sets (forces set switches). */
const SCENES = [
  ['s01', ['b2_late', 'b3_opening']],
  ['s02', ['s4_l1', 's5_l3', 's7_l1']],
  ['s03', ['s5_l1']],
]
/** Allowed heap growth over the baseline (MB): the heap is noisy even after gc. */
const HEAP_SLACK_MB = 12
/** Cycles that fill session-long caches before the baseline is taken. */
const WARMUP = 1
if (CYCLES < WARMUP + 2) throw new Error(`run at least ${WARMUP + 2} cycles`)

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-precise-memory-info', '--js-flags=--expose-gc'] })
const phone = TIER !== 'high'
const page = await browser.newPage(phone ? { viewport: { width: 360, height: 780 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true } : { viewport: { width: 1280, height: 800 } })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
const settings = { sound: false, music: 0.8, sfx: 1, textSpeed: 'instant', quality: TIER, renderer: 'webgl2' }
await page.addInitScript((s) => localStorage.setItem('underworld.save.v2', s), JSON.stringify({ state: { settings }, version: 4 }))
await page.goto(`${URL}/?test&perf`, { waitUntil: 'networkidle' })
// Continue when there's a game to continue, else New Game (DOM order: New, Continue)
await page.locator('.menu-btn--new, .menu-btn--continue:enabled').last().click()

const idle = () =>
  page.waitForFunction(() => {
    const s = window.__underworld?.store.getState()
    return s && s.scene && !s.loading && !s.fade
  }, null, { timeout: 120000 })

const sample = () =>
  page.evaluate(async () => {
    const u = window.__underworld
    const sc = u.engine.bjs.scene
    // let streaming and disposal settle, then collect garbage twice
    await new Promise((r) => setTimeout(r, 1200))
    gc?.()
    await new Promise((r) => setTimeout(r, 300))
    gc?.()
    const perf = u.engine.perf?.stats
    return {
      fps: perf?.fps ?? null,
      frameMs: perf?.frameMs ?? null,
      renderMs: perf?.renderMs ?? null,
      drawCalls: perf?.drawCalls ?? null,
      textureMB: perf?.textureMB ?? null,
      gpuTex: sc.getEngine().getLoadedTexturesCache().length,
      textures: sc.textures.length,
      meshes: sc.meshes.length,
      materials: sc.materials.length,
      geometries: sc.geometries.length,
      anims: sc.animationGroups.length,
      skeletons: sc.skeletons.length,
      files: u.assets().length,
      heapMB: Math.round(performance.memory.usedJSHeapSize / 1048576),
      // names, to say what grew
      names: {
        gpuTex: sc.getEngine().getLoadedTexturesCache().map((t) => (t.url || t.label || '?').replace(/^data:.*/, 'data:(embedded)').slice(-50)),
        materials: sc.materials.map((m) => m.name),
        meshes: sc.meshes.map((m) => m.name),
      },
    }
  })

/** Items in `now` beyond those in `before` (by name, counting duplicates). */
const diff = (now, before) => {
  const left = [...before]
  return now.filter((n) => {
    const i = left.indexOf(n)
    if (i < 0) return true
    left.splice(i, 1)
    return false
  })
}

await idle()
const firstCycle = new Map()
const baseline = new Map()
const rows = []
const failures = []
const t0 = Date.now()
for (let cycle = 1; cycle <= CYCLES; cycle++) {
  for (const [id, beats] of SCENES) {
    await page.evaluate(async (sceneId) => {
      const u = window.__underworld
      u.store.getState().startScene(await u.loadScene(sceneId), true)
    }, id)
    await page.waitForTimeout(400)
    await idle()
    for (const b of beats) {
      await page.evaluate((beat) => window.__underworld.engine.jumpTo(beat), b)
      await page.waitForTimeout(400)
      await idle()
      const reached = await page.evaluate(() => {
        const s = window.__underworld.store.getState()
        return s.beat?.id
      })
      if (reached !== b) throw new Error(`${id}: requested ${b}, reached ${reached}`)
    }
    const { names, ...r } = await sample()
    rows.push({ cycle, scene: id, ...r })
    const first = firstCycle.get(id)
    if (!first) firstCycle.set(id, { ...r, names })
    else if (cycle === WARMUP + 1) {
      baseline.set(id, { ...r, names })
      // what the warm-up added for good, for the record
      for (const k of Object.keys(names)) {
        const extra = diff(names[k], first.names[k])
        if (extra.length) console.log(`warm-up kept (${id} ${k}): ${extra.join(', ')}`)
      }
    } else {
      const base = baseline.get(id)
      for (const k of ['gpuTex', 'textures', 'meshes', 'materials', 'geometries', 'anims', 'skeletons', 'files'])
        if (r[k] > base[k]) failures.push(`${id} cycle ${cycle}: ${k} ${base[k]} → ${r[k]}${names[k] ? ` (new: ${diff(names[k], base.names[k]).join(', ')})` : ''}`)
      if (r.heapMB > base.heapMB + HEAP_SLACK_MB) failures.push(`${id} cycle ${cycle}: heap ${base.heapMB} → ${r.heapMB} MB`)
    }
    console.log(JSON.stringify(rows[rows.length - 1]))
  }
}
console.table(rows)
console.log(`${CYCLES} cycles, ${rows.length} scene starts in ${Math.round((Date.now() - t0) / 1000)} s (tier ${TIER})`)
if (errors.length) console.log('page errors:\n' + [...new Set(errors)].join('\n'))
await browser.close()
if (failures.length) {
  console.log('FAIL: resources kept growing after the warm-up cycle:\n' + failures.join('\n'))
  process.exit(1)
}
console.log(`PASS: after the warm-up, every scene came back to the same footprint for ${CYCLES - WARMUP - 1} more cycles`)
