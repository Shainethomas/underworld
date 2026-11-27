// Time from tapping Play to the first playable beat of a scene, with every
// request made on the way (count and bytes by kind) and the main thread's
// longest stalls. Run against `npm run preview` for what players download,
// or the dev server (unbundled, much heavier) for comparison.
//
//   node scripts/measure-load.mjs [url]        (default http://localhost:4173)
//   UW_RENDERER=webgl2 UW_THROTTLE=fast4g node scripts/measure-load.mjs
//   UW_INSTANT=1 …   taps Play as soon as it appears (no time for the title screen to warm files)

import { chromium } from 'playwright-core'

const URL = process.argv[2] ?? 'http://localhost:4173'
const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-webgpu'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
page.on('pageerror', (e) => console.log('PAGEERROR', e.message))
page.on('console', (m) => m.type() === 'error' && console.log('ERROR', m.text()))
if (process.env.UW_RENDERER)
  await page.addInitScript((r) => localStorage.setItem('underworld.save.v2', JSON.stringify({ state: { settings: { sound: true, music: 0.8, sfx: 1, textSpeed: 'normal', quality: 'auto', renderer: r } }, version: 3 })), process.env.UW_RENDERER)
const cdp = await ctx.newCDPSession(page)
await cdp.send('Network.enable')
await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
if (process.env.UW_THROTTLE === 'fast4g')
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 60, downloadThroughput: (9 * 1024 * 1024) / 8, uploadThroughput: (2 * 1024 * 1024) / 8 })

const reqs = new Map()
let phase = 'menu'
cdp.on('Network.requestWillBeSent', (e) => reqs.set(e.requestId, { url: e.request.url, phase, bytes: 0 }))
cdp.on('Network.loadingFinished', (e) => {
  const r = reqs.get(e.requestId)
  if (r) r.bytes = e.encodedDataLength
})

const t0 = Date.now()
await page.goto(`${URL}/?test`, { waitUntil: process.env.UW_INSTANT ? 'domcontentloaded' : 'networkidle' })
if (process.env.UW_INSTANT) await page.waitForSelector('.menu-btn--new')
const menuMs = Date.now() - t0
await page.evaluate(() => {
  window.__stalls = []
  new PerformanceObserver((l) => l.getEntries().forEach((e) => window.__stalls.push({ t: e.startTime, d: e.duration }))).observe({ type: 'longtask', buffered: false })
})
phase = 'scene'
const t1 = Date.now()
// Continue when there's a game to continue, else New Game (DOM order: New, Continue)
await page.locator('.menu-btn--new, .menu-btn--continue:enabled').last().click()
await page.waitForFunction(() => {
  const s = window.__underworld?.store.getState()
  return s && s.scene && !s.loading && !s.fade && s.beat !== null && !document.querySelector('.loadscreen')
}, null, { timeout: 120000, polling: 50 })
const playMs = Date.now() - t1
const firstBeat = await page.evaluate(() => performance.now())
// what streams in behind the first beat (the player is watching the scene now)
phase = 'after'
await page.waitForTimeout(Number(process.env.UW_TAIL ?? 8000))
const all = await page.evaluate(() => window.__stalls)
const stalls = all.filter((s) => s.t < firstBeat).map((s) => s.d)
const playing = all.filter((s) => s.t >= firstBeat).map((s) => s.d)

const kind = (u) => (/\.(glb)(\?|$)/.test(u) ? 'model' : /\.(webp|png|jpg)(\?|$)/.test(u) ? 'texture' : /\.(webm|mp3)(\?|$)/.test(u) ? 'audio' : /\.(js|ts|tsx|mjs|ink|json)(\?|$)|\/@|node_modules/.test(u) ? 'code' : 'other')
const table = {}
for (const r of reqs.values()) {
  if (r.url.startsWith('data:') || r.url.startsWith('blob:')) continue
  const k = `${r.phase}:${kind(r.url)}`
  table[k] ??= { requests: 0, kB: 0 }
  table[k].requests++
  table[k].kB += Math.round(r.bytes / 1024)
}
const sum = (l) => `${l.length}, longest ${Math.round(Math.max(0, ...l))} ms, total ${Math.round(l.reduce((a, b) => a + b, 0))} ms`
console.log(`menu ready ${menuMs} ms · Play → first beat ${playMs} ms`)
console.log(`main-thread stalls >50 ms: loading ${sum(stalls)} · first ${Number(process.env.UW_TAIL ?? 8000) / 1000} s of play ${sum(playing)}`)
console.table(table)
if (process.env.UW_LIST) for (const r of reqs.values()) if (r.phase !== 'menu' && kind(r.url) !== 'code') console.log(r.phase, Math.round(r.bytes / 1024) + 'k', r.url.replace(URL, ''))
await browser.close()
