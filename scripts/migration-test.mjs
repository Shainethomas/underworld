// Save migration to version 5 (the economy): old saves lose the decorative
// $5,000 and get earnings rebuilt once from what they prove; nothing else in
// the save changes; a second pass changes nothing; a new save starts at $0.
// Runs the migration on its own and through the real store's hydration (with
// an in-memory localStorage).
//
//   node --import ./scripts/lib/ts-resolve.mjs scripts/migration-test.mjs

import assert from 'node:assert/strict'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const mod = (p) => import(pathToFileURL(resolve(ROOT, p)).href)
const { migrateSave, SAVE_VERSION } = await mod('src/store/migrations.ts')
const P = await mod('src/game/progression/Progression.ts')

let passed = 0
const test = (name, fn) => {
  fn()
  passed++
  console.log(`ok  ${name}`)
}

// A v4 player: Scenes 01–02 done (a clean "start low" fight), halfway through Scene 03.
const v4 = () => ({
  profile: { name: 'Rookie', level: 2, xp: 0.15, cash: 5000, gems: 250, health: 100, stamina: 100 },
  progress: {
    sceneId: 's03',
    cursor: 14,
    ink: '{"fake":"ink state"}',
    played: ['s1_title', 's1_morning'],
    completed: ['s01', 's02'],
    unlocked: ['s01', 's02', 's03'],
    starts: {
      s01: { vars: { discipline: 0 }, choices: {}, flags: {} },
      s02: { vars: { discipline: 10 }, choices: { opening: 'low' }, flags: { fight_guard: 1, fight_slip: 1, fight_counter: 1, fight_finish: 0.8 } },
      s03: { vars: { discipline: 20 }, choices: { opening: 'low' }, flags: { fight_guard: 1, fight_slip: 1, fight_counter: 1, fight_finish: 0.8 } },
    },
  },
  vars: { discipline: 25, independence: 10, ravi_trust: 5, don_loyalty: 0, heat: 10, intel: 5 },
  choices: { opening: 'low', challenge: 'over', approach: 'avoid' },
  flags: { fight_guard: 1, fight_slip: 1, fight_counter: 1, fight_finish: 0.8, scene01_completed: true, scene02_completed: true },
  settings: { sound: false, music: 0.3, sfx: 1, textSpeed: 'fast', quality: 'low', renderer: 'webgl2' },
})

test('a v4 save gets its earnings rebuilt from what it proves', () => {
  const out = migrateSave(v4(), 4)
  // clean fight (score 0.95): $500 and 50+20 Respect; Scene 02 base: $800 and 70
  assert.equal(out.vars.cash, 500 + 800)
  assert.equal(out.vars.respect, 70 + 70)
  assert.equal(out.flags.rank, P.rankFor(140).id)
  assert.equal(P.rankById(out.flags.rank).name, 'Runner')
  assert.equal(out.profile.cash, 0, 'the decorative balance is gone')
})

test('nothing else in the save changes', () => {
  const before = v4()
  const out = migrateSave(v4(), 4)
  for (const k of ['discipline', 'independence', 'ravi_trust', 'heat', 'intel']) assert.equal(out.vars[k], before.vars[k], k)
  assert.deepEqual(out.choices, before.choices)
  assert.deepEqual(out.settings, before.settings)
  assert.deepEqual(out.progress.completed, before.progress.completed)
  assert.deepEqual(out.progress.unlocked, before.progress.unlocked)
  assert.equal(out.profile.level, 2)
  assert.equal(out.profile.gems, 250)
  for (const [k, v] of Object.entries(before.flags)) assert.equal(out.flags[k], v, k)
})

test('each scene snapshot holds what the earlier scenes earned', () => {
  const s = migrateSave(v4(), 4).progress.starts
  assert.equal(s.s01.vars.cash, 0)
  assert.equal(s.s01.vars.respect, 0)
  assert.equal(s.s02.vars.cash, 500)
  assert.equal(s.s02.vars.respect, 70)
  assert.equal(s.s03.vars.cash, 1300)
  assert.equal(s.s03.vars.respect, 140)
  assert.equal(s.s03.vars.discipline, 20, 'other snapshot values kept')
})

test('a scene in progress restarts from its snapshot (its Ink position predates the new script)', () => {
  const p = migrateSave(v4(), 4).progress
  assert.equal(p.ink, undefined)
  assert.equal(p.played, undefined)
  assert.equal(p.cursor, 0)
  assert.equal(p.sceneId, 's03')
})

test('it runs once: a second pass changes nothing, even if the version were lost', () => {
  const once = migrateSave(v4(), 4)
  const twice = migrateSave(structuredClone(once), 4)
  assert.deepEqual(twice, once)
  assert.deepEqual(once.progress.migrated, ['economy-v5'])
})

test('an old save from before Ink (v3) passes through every step', () => {
  const out = migrateSave({ progress: { sceneId: 's02', cursor: 9, completed: ['s01'], unlocked: ['s01', 's02'], starts: {} }, choices: { opening: 'all_in' }, flags: { fight_counter: 0.33, fight_finish: 0.2 } }, 3)
  // all in, score 0.265: an ugly win, $150 and 50 Respect
  assert.equal(out.vars.cash, 150)
  assert.equal(out.vars.respect, 50)
  assert.equal(out.flags.rank, 0)
})

test('a save with nothing played is left alone (and starts at $0)', () => {
  assert.deepEqual(migrateSave({ settings: { sound: true } }, 4), { settings: { sound: true } })
})

// ── Through the store, as the game loads it ─────────────────────────────
const mem = new Map()
globalThis.localStorage = { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: (k) => mem.delete(k) }
mem.set('underworld.save.v2', JSON.stringify({ state: v4(), version: 4 }))
const { useGame } = await mod('src/store/gameStore.ts')
await useGame.persist.rehydrate()

test('the store hydrates a v4 save migrated, and writes it back as v5', () => {
  const s = useGame.getState()
  assert.equal(s.vars.cash, 1300)
  assert.equal(s.vars.respect, 140)
  assert.equal(s.vars.varga, 0)
  assert.equal(s.flags.rank, 1)
  assert.equal(s.settings.textSpeed, 'fast')
  s.setSetting('sound', true) // any change persists the state
  const saved = JSON.parse(mem.get('underworld.save.v2'))
  assert.equal(saved.version, SAVE_VERSION)
  assert.equal(saved.state.vars.cash, 1300)
})

await useGame.persist.rehydrate()
test('reloading the migrated save does not pay out again', () => {
  assert.equal(useGame.getState().vars.cash, 1300)
  assert.equal(useGame.getState().vars.respect, 140)
})

test('a new game starts with no money and no Respect', () => {
  useGame.getState().resetProgress()
  assert.equal(useGame.getState().vars.cash, 0)
  assert.equal(useGame.getState().vars.respect, 0)
})

// ── A job's debrief lists only that job ─────────────────────────────────
const { readFileSync } = await import('node:fs')
const { compileInk } = await import(pathToFileURL(resolve(ROOT, 'scripts/lib/ink-compile.mjs')).href)
const sceneData = (n) => {
  const st = JSON.parse(readFileSync(resolve(ROOT, `src/story/scene${n}.staging.json`), 'utf8'))
  return { ...st.scene, story: JSON.parse(compileInk(resolve(ROOT, `src/story/scene${n}.ink`)).json), staging: st.beats }
}

test("the next scene starts without the last job's ledger or grade", () => {
  // as the Scene 02 debrief leaves it
  useGame.setState({ choices: { ledger: 'c800^Victor\'s pay for the delivery;r70^Delivered Victor\'s parcel;', job_grade: 'clean', s02_prep: 'book' }, flags: { ledger: 'c800^x;', job_grade: 'clean', rank: 1 } })
  useGame.getState().startScene(sceneData('03'), true)
  const s = useGame.getState()
  assert.equal(s.choices.ledger, undefined)
  assert.equal(s.choices.job_grade, undefined)
  assert.equal(s.choices.s02_prep, 'book', 'earlier choices still carry forward')
  assert.equal(s.flags.rank, 1, 'rank carries forward')
  const start = s.progress.starts.s03
  assert.equal(start.choices.ledger, undefined, 'nor is it in the snapshot a replay rewinds to')
})

console.log(`${passed} passed`)
