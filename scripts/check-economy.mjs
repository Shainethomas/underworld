// Plays the chapter's economy scenes thousands of times with random choices
// and skill results (seeded, so a failure repeats), carrying each scene's
// outcome into the next as the game does, and checks the progression rules:
//   - every route is promoted to each rank at the debrief the story promises
//     (Runner after Scene 02);
//   - the ledger the debrief shows adds up to the actual change in Respect,
//     cash, Heat and Varga hostility (nothing moves without a reason);
//   - cash never goes below zero, and no choice ever has every option locked;
//   - each prep pick changes what the job plays (different beats).
// Prints the lowest and highest Respect and cash per scene.
//
//   node --import ./scripts/lib/ts-resolve.mjs scripts/check-economy.mjs [runs]

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileInk } from './lib/ink-compile.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { StoryRuntime } = await import(pathToFileURL(resolve(ROOT, 'src/game/narrative/StoryRuntime.ts')).href)
const { DEFAULT_VARS } = await import(pathToFileURL(resolve(ROOT, 'src/game/narrative/NarrativeState.ts')).href)
const P = await import(pathToFileURL(resolve(ROOT, 'src/game/progression/Progression.ts')).href)

const RUNS = Number(process.argv[2] ?? 3000)
/** Scenes with the economy, and the rank each must have reached at its debrief. */
const CHAIN = [
  { n: '01', rankAtLeast: 0 },
  { n: '02', rankAtLeast: 1 },
  { n: '03', rankAtLeast: 1, rankAtMost: 1 },
  { n: '04', rankAtLeast: 2, rankAtMost: 2 },
]
const scenes = CHAIN.map(({ n }) => {
  const st = JSON.parse(readFileSync(resolve(ROOT, `src/story/scene${n}.staging.json`), 'utf8'))
  return { ...st.scene, story: JSON.parse(compileInk(resolve(ROOT, `src/story/scene${n}.ink`)).json), staging: st.beats }
})

// a small seeded generator (mulberry32)
let seed = 0x5eed
const rand = () => {
  seed |= 0
  seed = (seed + 0x6d2b79f5) | 0
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
const pickOf = (a) => a[Math.floor(rand() * a.length)]

function play(scene, start) {
  const rt = new StoryRuntime(scene)
  rt.setVars(start)
  const ids = []
  const picks = {}
  for (let b = rt.next(), guard = 0; b && guard < 3000; b = rt.next(), guard++) {
    ids.push(b.id)
    if (b.type === 'choice') {
      const open = b.options.filter((o) => !o.locked)
      if (!open.length) throw new Error(`${scene.id} ${b.id}: every option locked`)
      const o = pickOf(open)
      picks[b.choiceId] = o.id
      rt.choose(o.id)
    } else if (b.type === 'qte') rt.setFlag(b.result, pickOf([0, 0.25, 0.5, 0.75, 1]))
    else if (b.type === 'explore') {
      for (const h of b.hotspots) if (h.ends || rand() < 0.5) for (const [k, v] of Object.entries(h.sets ?? {})) rt.setFlag(k, v)
    }
    if (b.type === 'complete') break
    const v = rt.getVars().vars
    if (v.cash < 0) throw new Error(`${scene.id} ${b.id}: cash went negative (${v.cash})`)
  }
  return { ids, picks, out: rt.getVars() }
}

const stats = CHAIN.map(() => ({ respect: [Infinity, -Infinity], cash: [Infinity, -Infinity], grades: {}, ranks: {}, routes: new Map() }))
let failed = 0
for (let run = 0; run < RUNS; run++) {
  let state = { vars: { ...DEFAULT_VARS }, choices: {}, flags: {} }
  for (let i = 0; i < CHAIN.length; i++) {
    const scene = scenes[i]
    try {
      const before = state.vars
      const { ids, picks, out } = play(scene, state)
      // the ledger accounts for every change in the economy
      const sums = { respect: 0, cash: 0, heat: 0, varga: 0 }
      for (const e of P.parseLedger(out.choices.ledger)) if (e.kind in sums) sums[e.kind] += e.amount
      for (const k of Object.keys(sums)) {
        const d = out.vars[k] - before[k]
        if (d !== sums[k]) throw new Error(`${scene.id}: ${k} moved ${d} but the ledger says ${sums[k]}`)
      }
      if (!out.choices.job_grade) throw new Error(`${scene.id}: no job grade`)
      // the debrief's promotion (the store does the same: ranks never go backwards)
      const rank = Math.max(typeof out.flags.rank === 'number' ? out.flags.rank : 0, Math.min(P.rankFor(out.vars.respect).id, scene.rankCap ?? Infinity))
      if (rank > (CHAIN[i].rankAtMost ?? Infinity)) throw new Error(`${scene.id}: promoted past ${P.rankById(CHAIN[i].rankAtMost).name} before the story allows it`)
      if (rank < CHAIN[i].rankAtLeast) throw new Error(`${scene.id}: only ${P.rankById(rank).name} at the debrief (Respect ${out.vars.respect}) on ${JSON.stringify(picks)}`)
      const s = stats[i]
      s.respect = [Math.min(s.respect[0], out.vars.respect), Math.max(s.respect[1], out.vars.respect)]
      s.cash = [Math.min(s.cash[0], out.vars.cash), Math.max(s.cash[1], out.vars.cash)]
      s.grades[out.choices.job_grade] = (s.grades[out.choices.job_grade] ?? 0) + 1
      s.ranks[P.rankById(rank).name] = (s.ranks[P.rankById(rank).name] ?? 0) + 1
      const prep = picks.s01_prep ?? picks.s02_prep ?? picks.s03_prep ?? picks.s04_prep
      if (prep) s.routes.set(prep, new Set([...(s.routes.get(prep) ?? []), ids.join(' ')]))
      state = { ...out, flags: { ...out.flags, rank } }
    } catch (e) {
      failed++
      if (failed < 10) console.log(`FAIL run ${run}: ${e.message}`)
      break
    }
  }
}

for (let i = 0; i < CHAIN.length; i++) {
  const s = stats[i]
  console.log(`scene${CHAIN[i].n}: Respect ${s.respect[0]}–${s.respect[1]} · cash $${s.cash[0]}–$${s.cash[1]} · grades ${JSON.stringify(s.grades)} · ranks ${JSON.stringify(s.ranks)}`)
  // each prep pick plays differently: its beat sequences never coincide with another pick's
  const preps = [...s.routes.keys()]
  for (const a of preps)
    for (const b of preps) {
      if (a >= b) continue
      const shared = [...s.routes.get(a)].filter((r) => s.routes.get(b).has(r))
      if (shared.length) {
        failed++
        console.log(`FAIL scene${CHAIN[i].n}: prep "${a}" and "${b}" produced the same beats`)
      }
    }
  if (preps.length) console.log(`  prep picks seen: ${preps.join(', ')} (each plays its own beats)`)
}
console.log(failed ? `${failed} failure(s)` : `ok: ${RUNS} routes`)
process.exit(failed ? 1 : 0)
