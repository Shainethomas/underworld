// Scene-to-scene streaming check: plays Scene 1, lets it stream, jumps to its
// end and continues into Scene 2. Reports how long the switch took, what Scene 2
// still had to download (ideally nothing: it was prefetched during Scene 1),
// and the GPU resources resident afterwards next to a fresh Scene 2 load, so a
// scene change that leaks the last scene's files shows up as a difference.
//
//   node scripts/transition-test.mjs [url]      (default http://localhost:4173)

import { chromium } from 'playwright-core'

const URL = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] })
const errors = []

const counts = (page) =>
  page.evaluate(() => {
    const e = window.__underworld.engine
    const s = e.bjs.scene
    window.__names = { textures: s.textures.map((t) => t.name || t.getClassName() + ':' + (t.getSize?.().width ?? '') + ':' + (t._texture?.source ?? '')), geometries: s.geometries.map((g) => g.id), gpu: s.getEngine().getLoadedTexturesCache().map((t) => t.url || t.label || '?') }
    return { gpuTextures: s.getEngine().getLoadedTexturesCache().length, textures: s.textures.length, meshes: s.meshes.length, materials: s.materials.length, geometries: s.geometries.length, animationGroups: s.animationGroups.length, skeletons: s.skeletons.length }
  })
const idle = (page) =>
  page.waitForFunction(() => {
    const s = window.__underworld?.store.getState()
    return s && s.scene && !s.loading && !s.fade && s.beat
  }, null, { timeout: 90000 })

async function open(save) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (e) => errors.push(e.message))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  if (save) await page.addInitScript((s) => localStorage.setItem('underworld.save.v2', s), save)
  await page.goto(`${URL}/?test`, { waitUntil: 'networkidle' })
  // Continue when there's a game to continue, else New Game (DOM order: New, Continue)
  await page.locator('.menu-btn--new, .menu-btn--continue:enabled').last().click()
  await idle(page)
  return page
}

// Scene 1, then on into Scene 2
const page = await open()
const s1 = await counts(page)
await page.waitForTimeout(15000) // the rest of Scene 1 and Scene 2's files stream in
const fetched = []
page.on('request', (r) => fetched.push(r.url().replace(URL, '')))
await page.evaluate(() => window.__underworld.engine.jumpTo('b6_complete'))
await page.waitForSelector('.complete .btn--gold', { timeout: 30000 })
const t = Date.now()
await page.click('.complete .btn--gold')
await page.waitForFunction(() => window.__underworld.store.getState().scene?.id === 's02', null, { timeout: 30000 })
await idle(page).catch(async (err) => {
  const st = await page.evaluate(() => {
    const s = window.__underworld.store.getState()
    const e = window.__underworld.engine
    const sc = e.bjs.scene
    const notReady = sc.meshes.filter((m) => m.isEnabled() && m.isVisible && !m.isReady(true)).map((m) => m.name + ' / ' + (m.material?.name ?? '-')).slice(0, 15)
    const badTex = sc.textures.filter((t) => !t.isReady()).map((t) => t.name).slice(0, 15)
    return { scene: s.scene?.id, loading: s.loading, env: e.envs?.active?.id ?? null, sceneReady: sc.isReady(), waiting: sc.getWaitingItemsCount(), pending: (sc._pendingData || []).map((d) => d?.name ?? d?.url ?? d?.constructor?.name ?? String(d)).slice(0, 10), notReady, badTex, geomNotReady: sc.geometries.filter((g) => !g.isReady()).length, ppNotReady: sc.postProcesses.filter((p) => !p.isReady()).map((p) => p.name), loadingAssets: window.__underworld.assets().filter((a) => a.progress < 1), effects: sc.getEngine().areAllEffectsReady(), particles: sc.particleSystems.filter((p) => !p.isReady()).map((p) => p.name), layers: sc.effectLayers?.filter((l) => !l.isLayerReady?.()).map((l) => l.name), rts: sc.customRenderTargets.filter((t) => !t.isReadyForRendering()).map((t) => t.name), lights: sc.lights.map((l) => l.name).slice(0, 12), meshCount: sc.meshes.length, envMeshes: sc.meshes.filter((m) => !m.name.includes(':')).length, noSub: sc.meshes.filter((m) => m.isEnabled() && !m.subMeshes).length, allNotReady: sc.meshes.filter((m) => m.subMeshes?.length && !m.isReady(true)).map((m) => m.name + '|' + m.isEnabled() + '|' + (m.material?.name ?? 'nomat') + '|' + (m.material?.isFrozen ?? '') + '|' + (m.material ? m.material.getClassName() : '')).slice(0, 12), cam: sc.activeCamera?.isReady(true), camPP: (sc.activeCamera?._postProcesses || []).filter((p) => p && !p.isReady()).map((p) => p.name), meshStage: sc.meshes.filter((m) => m.subMeshes?.length && sc._isReadyForMeshStage.some((st) => !st.action(m, false))).map((m) => m.name).slice(0, 10), rtt: sc.textures.filter((t) => t.renderList && !t.isReadyForRendering()).map((t) => t.name), notReadyAny: sc.meshes.filter((m) => m.isEnabled() && m.subMeshes && !m.isReady(true)).map((m) => m.name + '/' + m.isVisible + '/' + (m.material?.name)).slice(0, 10) }
  })
  console.log('stuck:', JSON.stringify(st), '\nerrors:\n' + errors.join('\n'))
  throw err
})
const switchMs = Date.now() - t
await page.waitForTimeout(1500)
const s2 = await counts(page)

// Scene 2 from a cold start, for comparison
const save = JSON.stringify({ state: { progress: { sceneId: 's02', cursor: -1, completed: ['s01'], unlocked: ['s01', 's02'], starts: {} } }, version: 3 })
const fresh = await open(save)
await fresh.waitForTimeout(1500)
const s2fresh = await counts(fresh)

if (process.env.UW_DIFF) {
  console.log('resident after switch:', JSON.stringify((await page.evaluate(() => window.__underworld.assets())).map((a) => a.url.split('/').pop() + ':' + a.owners.join('+'))))
  const a = await page.evaluate(() => window.__names)
  const b = await fresh.evaluate(() => window.__names)
  for (const k of Object.keys(a)) {
    const left = [...a[k]]
    for (const n of b[k]) { const i = left.indexOf(n); if (i >= 0) left.splice(i, 1) }
    const group = {}
    for (const n of left) { const g = String(n).replace(/[0-9]+/g, '#').slice(0, 60); group[g] = (group[g] ?? 0) + 1 }
    console.log(k, 'extra after scene 1:', JSON.stringify(Object.entries(group).sort((x, y) => y[1] - x[1]).slice(0, 15)))
  }
}
console.log(`Scene 1 → Scene 2: ${switchMs} ms to the first beat`)
const big = fetched.filter((u) => /\.(glb|webp|webm|mp3)$/.test(u))
console.log(`files downloaded after Continue: ${big.length ? big.join(', ') : 'none (all prefetched)'}`)
console.table({ 'scene 1': s1, 'scene 2 after scene 1': s2, 'scene 2 fresh': s2fresh })
if (errors.length) console.log('errors:\n' + errors.join('\n'))
await browser.close()
