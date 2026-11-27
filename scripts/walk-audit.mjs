// Walks through nothing: jumps to every explore beat of every scene, plans the
// walk from where Rookie stands to each place on offer (and from each place to
// each other), and casts along each leg at knee and waist height against the
// set's real geometry (GameEngine.walkAudit). Lists every leg that would pass
// through something solid; exits non-zero if there are any.
//
//   npm run build && npx vite preview --port 4174
//   node scripts/walk-audit.mjs [url=http://localhost:4174]

import { readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const URL = process.argv[2] ?? 'http://localhost:4174'
/** The choices that lead to each explore beat (the route the prep picked). */
const ROUTES = {
  s02: { s5_explore: { s02_prep: 'book' }, s5_scout: { s02_prep: 'scout' }, s7_explore: { s02_prep: 'book' } },
  s03: {
    s3_explore: { s03_prep: 'nico' },
    s3_explore_quiet: { s03_prep: 'quiet' },
    s5_look: { s03_prep: 'nico' },
    s5_look_quiet: { s03_prep: 'quiet' },
    s5_look_strong: { s03_prep: 'strong' },
  },
  s04: { n_local: { s04_prep: 'message' }, n_search: { s04_prep: 'quiet' }, n_search_short: { s04_prep: 'message' }, n_evidence: { s04_prep: 'quiet' } },
}

const browser = await chromium.launch({ channel: 'chrome', headless: true, args: ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'] })
let problems = 0
for (const [scene, beats] of Object.entries(ROUTES)) {
  const n = Number(scene.slice(1))
  const ids = Array.from({ length: n }, (_, i) => `s${String(i + 1).padStart(2, '0')}`)
  // enough of everything that no route is locked
  const save = { state: { progress: { sceneId: scene, cursor: -1, completed: ids.slice(0, -1), unlocked: ids, starts: {} }, vars: { cash: 5000, respect: 260, intel: 40, ravi_trust: 20 }, flags: { rank: 1, contact_sal: true } }, version: 5 }
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } })
  page.on('pageerror', (e) => console.log(`[${scene}] pageerror ${e.message}`))
  await page.addInitScript((s) => localStorage.setItem('underworld.save.v2', s), JSON.stringify(save))
  await page.goto(`${URL}/?test`, { waitUntil: 'networkidle' })
  await page.click('.menu-btn--continue')
  const idle = () => page.waitForFunction(() => {
    const s = window.__underworld?.store.getState()
    return s && s.scene && !s.loading && !s.fade
  }, null, { timeout: 90000 })
  await idle()
  const staged = JSON.parse(readFileSync(`src/story/scene${scene.slice(1)}.staging.json`, 'utf8')).beats
  for (const [beat, choices] of Object.entries(beats)) {
    if (!staged[beat]) {
      console.log(`[${scene}] ${beat}: not in the staging`)
      problems++
      continue
    }
    await page.evaluate((c) => window.__underworld.store.setState((s) => ({ choices: { ...s.choices, ...c } })), choices)
    await page.evaluate((b) => window.__underworld.engine.jumpTo(b), beat)
    await page.waitForTimeout(500)
    await idle()
    await page.waitForTimeout(600)
    const at = await page.evaluate(() => window.__underworld.store.getState().beat?.id)
    if (at !== beat) {
      console.log(`[${scene}] ${beat}: the jump stopped at ${at}`)
      problems++
      continue
    }
    const bad = await page.evaluate(() => window.__underworld.engine.walkAudit())
    if (!bad.length) console.log(`[${scene}] ${beat}: ok`)
    for (const b of bad) {
      problems++
      console.log(`[${scene}] ${beat}: ${b.from} → ${b.to} passes through ${b.hits.join(', ')}`)
    }
  }
  await page.close()
}
await browser.close()
console.log(problems ? `${problems} problem(s)` : 'every walk is clear')
process.exit(problems ? 1 : 0)
