// The gate every AI-written contract passes before it ships (src/story/contracts,
// written to SPEC.md). Builds each contract exactly as the game does (its Ink,
// its meta, its set's staging kit) and plays every route through it: each
// prep pick × each pair of tactics × winning or losing the fight. Checks:
//
//  - the meta and the Ink agree (temperament, pay, Respect in k_start)
//  - every line lands on staging, every choice has its prompt, and the prep and
//    both rounds of talk offer exactly muscle/quiet/homework and press/charm/threaten
//  - the rules decide: a route's outcome is what contract.ink's table says,
//    and it pays exactly what the payout rules say
//  - the balance holds: no way of playing that ignores who the contact is
//    (a fixed prep, an opening tactic, and a reply chosen from how he took
//    it) gets a clean deal on more than one temperament in three
//  - every route ends graded, paid, with a morning message, and in reach of a
//    sensible amount (no route pays more than the card says, or less than nothing)
//  - the writing stays in bounds: speakers, hotspot labels, lengths, no stray markup
//
//   node --import ./scripts/lib/ts-resolve.mjs scripts/check-contracts.mjs

import { readdirSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileInk } from './lib/ink-compile.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DIR = resolve(ROOT, 'src/story/contracts')
const { StoryRuntime } = await import(pathToFileURL(resolve(ROOT, 'src/game/narrative/StoryRuntime.ts')).href)
const { DEFAULT_VARS } = await import(pathToFileURL(resolve(ROOT, 'src/game/narrative/NarrativeState.ts')).href)
const { contractScene } = await import(pathToFileURL(resolve(ROOT, 'src/game/board/contractScene.ts')).href)

const TABLE = { greedy: { press: 2, charm: 0, threaten: -2 }, scared: { press: 0, charm: 2, threaten: -3 }, proud: { press: -2, charm: 0, threaten: 2 } }
const DEAL = 4
const SHORT = 0
const PREPS = ['muscle', 'quiet', 'homework']
const TACTICS = ['press', 'charm', 'threaten']
const CAST = ['fence', 'dealer', 'kid', 'widow', 'heavy', 'heavy2']
const RISKS = ['Low', 'Medium', 'High']
const FX = /^([crht]-?\d+)?$/

/** Plays one route; returns what happened. */
function play(scene, route, start) {
  const rt = new StoryRuntime(scene)
  rt.setVars(start)
  const seen = []
  let talk = 0
  for (let b = rt.next(), guard = 0; b && guard < 400; b = rt.next(), guard++) {
    seen.push(b)
    if (b.type === 'line' && (!b.text || !b.speaker)) throw new Error(`${b.id}: line without words`)
    if (b.type === 'choice') {
      if (!b.context?.text) throw new Error(`${b.id}: choice without its prompt`)
      const ids = b.options.map((o) => o.id).sort().join(',')
      if (b.choiceId === 'k_prep') {
        if (ids !== [...PREPS].sort().join(',')) throw new Error(`prep offers ${ids}`)
        rt.choose(route.prep)
      } else if (b.choiceId === 'k_talk1' || b.choiceId === 'k_talk2') {
        if (ids !== [...TACTICS].sort().join(',')) throw new Error(`${b.choiceId} offers ${ids}`)
        rt.choose(route.talk[talk++])
      } else {
        const open = b.options.filter((o) => !o.locked)
        if (!open.length) throw new Error(`${b.id}: every option is locked`)
        rt.choose(open[0].id)
      }
    } else if (b.type === 'qte') rt.setFlag(b.result, route.qte)
    else if (b.type === 'explore') {
      for (const h of b.hotspots) {
        if (!h.label) throw new Error(`${b.id}: hotspot ${h.id} has no label`)
        if (route.look && !h.ends) for (const [k, v] of Object.entries(h.sets ?? {})) rt.setFlag(k, v)
      }
      const end = b.hotspots.find((h) => h.ends)
      for (const [k, v] of Object.entries(end?.sets ?? {})) rt.setFlag(k, v)
    }
    if (b.type === 'complete') break
  }
  if (seen.at(-1)?.type !== 'complete') throw new Error('never completes')
  if (talk !== 2) throw new Error(`${talk} rounds of talk, not 2`)
  return { seen, vars: rt.getVars() }
}

// The balance gate. A blind player picks a prep, opens with a tactic, sees
// whether the contact took it well, fine or badly (the writing shows it),
// and picks round 2 from that. No such plan may clean-deal two temperaments.
{
  const moods = Object.keys(TABLE)
  const cls = (n) => (n >= 2 ? 'best' : n >= 0 ? 'fine' : 'bad')
  let worst = 0
  for (const prep of PREPS)
    for (const look of [true, false])
      for (const t1 of TACTICS) {
        const lev = (look ? 2 : 0) + (prep === 'quiet' ? 1 : 0)
        const bonus = (t) => (t === 'press' && lev > 0 ? 1 : 0) + (t === 'threaten' && prep === 'muscle' ? 1 : 0)
        const groups = {}
        for (const m of moods) (groups[cls(TABLE[m][t1])] ??= []).push(m)
        let deals = 0
        for (const ms of Object.values(groups))
          deals += Math.max(...TACTICS.map((t2) => ms.filter((m) => TABLE[m][t1] + bonus(t1) + TABLE[m][t2] + bonus(t2) >= DEAL).length))
        worst = Math.max(worst, deals)
      }
  if (worst > 1) {
    console.log(`BALANCE FAIL a plan that ignores the contact clean-deals ${worst} of ${moods.length} temperaments`)
    process.exit(1)
  }
  console.log(`balance ok   the best blind plan clean-deals ${worst} of ${moods.length} temperaments`)
}

let failed = 0
const files = readdirSync(DIR).filter((f) => /^c_.*\.ink$/.test(f)).sort()
const kits = {}
for (const f of files) {
  const id = f.replace(/\.ink$/, '')
  const problems = []
  try {
    const meta = JSON.parse(readFileSync(resolve(DIR, `${id}.json`), 'utf8'))
    const src = readFileSync(resolve(DIR, f), 'utf8')
    if (meta.id !== id) problems.push(`meta id ${meta.id}`)
    if (!RISKS.includes(meta.risk)) problems.push(`risk ${meta.risk}`)
    if (!TABLE[meta.mood]) problems.push(`mood ${meta.mood}`)
    for (const k of ['contact', 'heavy']) if (!CAST.includes(meta.cast?.[k])) problems.push(`cast.${k} ${meta.cast?.[k]}`)
    if (meta.cast?.contact === meta.cast?.heavy) problems.push('contact and heavy are the same actor')
    if (!meta.names?.contact || !meta.names?.heavy) problems.push('names missing')
    if (!meta.hotspots?.contact || !meta.hotspots?.clue_a || !meta.hotspots?.clue_b) problems.push('hotspots missing')
    if ((meta.pitch ?? '').length > 140) problems.push(`pitch is ${meta.pitch.length} chars (max 140)`)
    if ((meta.title ?? '').length > 22) problems.push(`title is ${meta.title.length} chars (max 22)`)
    const ks = /k_start\("(\w+)",\s*(\d+),\s*(\d+)\)/.exec(src)
    if (!ks) problems.push('no k_start')
    else if (ks[1] !== meta.mood || +ks[2] !== meta.pay || +ks[3] !== meta.respect) problems.push(`k_start(${ks.slice(1).join(', ')}) ≠ meta (${meta.mood}, ${meta.pay}, ${meta.respect})`)
    const job = /^>>> job k_job \[(.*?)\] (.*?) ¦ \$([\d,]+) ¦ (\w+) ¦/m.exec(src)
    if (!job) problems.push('no job card line')
    else if (job[1] !== meta.title || job[2] !== meta.client || +job[3].replace(/,/g, '') !== meta.pay || job[4] !== meta.risk) problems.push('job card ≠ meta')
    for (const m of src.matchAll(/^\s*([A-Z0-9_]+):/gm)) if (!['CONTACT', 'HEAVY'].includes(m[1])) problems.push(`speaker ${m[1]} (only CONTACT and HEAVY)`)
    for (const m of src.matchAll(/^\s*(?:CONTACT|HEAVY): (.*?) #/gm)) if (m[1].length > 160) problems.push(`line over 160 chars: "${m[1].slice(0, 40)}…"`)
    for (const m of src.matchAll(/\+ \[(.*?) #(\w+)\]/g)) if (m[1].length > 90) problems.push(`option over 90 chars: "${m[1].slice(0, 40)}…"`)
    // what the player reads: no markup, braces or underscores in lines and options
    const words = [...src.matchAll(/^\s*(?:CONTACT|HEAVY): (.*?) #/gm), ...src.matchAll(/\+ \[(.*?) #\w+\]/g)].map((m) => m[1])
    for (const w of words) if (/[<>*{}|_]/.test(w)) problems.push(`stray markup in "${w.slice(0, 40)}…"`)

    kits[meta.kit] ??= JSON.parse(readFileSync(resolve(DIR, 'kits', `${meta.kit}.staging.json`), 'utf8'))
    const scene = contractScene(meta, kits[meta.kit], JSON.parse(compileInk(resolve(DIR, f)).json))
    const start = { vars: { ...DEFAULT_VARS, cash: 500, respect: 120 }, choices: {}, flags: { gear_knuckles: false } }
    let routes = 0
    const outcomes = { deal: 0, short: 0, fight: 0 }
    for (const prep of PREPS)
      for (const t1 of TACTICS)
        for (const t2 of TACTICS)
          for (const qte of [1, 0])
            for (const look of [true, false]) {
              const route = { prep, talk: [t1, t2], qte, look }
              const { vars } = play(scene, route, start)
              routes++
              const v = vars
              const c = v.choices
              // the rules decide: recompute the outcome from the table
              const lev = (look ? 2 : 0) + (prep === 'quiet' ? 1 : 0)
              const bonus = (t) => (t === 'press' && lev > 0 ? 1 : 0) + (t === 'threaten' && prep === 'muscle' ? 1 : 0)
              const score = TABLE[meta.mood][t1] + bonus(t1) + TABLE[meta.mood][t2] + bonus(t2)
              const want = score >= DEAL ? 'deal' : score >= SHORT ? 'short' : 'fight'
              if (c.k_outcome !== want) throw new Error(`${prep}/${t1}/${t2}: outcome ${c.k_outcome}, the table says ${want}`)
              outcomes[want]++
              if (!c.job_grade) throw new Error(`${prep}/${t1}/${t2}: no grade`)
              if (!c.k_after || c.k_after.split('^').length !== 3) throw new Error(`${prep}/${t1}/${t2}/${qte}: no morning message`)
              const [from, text, fx] = c.k_after.split('^')
              if (!from || !text || !FX.test(fx)) throw new Error(`morning message "${c.k_after}"`)
              const paid = v.vars.cash - start.vars.cash
              if (paid < 0 || paid > meta.pay) throw new Error(`${prep}/${t1}/${t2}: paid ${paid} (card says ${meta.pay})`)
              const share = want === 'deal' ? 10 : want === 'short' ? 6 : qte ? 7 : 3
              const owed = Math.trunc((meta.pay * share) / 10) - (prep === 'homework' ? Math.trunc(meta.pay / 4) : 0)
              if (paid !== owed) throw new Error(`${prep}/${t1}/${t2}/${qte}: ${want} paid ${paid}, the rules say ${owed}`)
            }
    if (!outcomes.deal || !outcomes.fight) problems.push(`some outcome is unreachable: ${JSON.stringify(outcomes)}`)
    if (problems.length) throw new Error(problems.join('; '))
    console.log(`${id.padEnd(12)} ok  ${routes} routes · ${meta.kit} · ${meta.mood} · deal ${outcomes.deal} / short ${outcomes.short} / fight ${outcomes.fight}`)
  } catch (e) {
    failed++
    console.log(`${id.padEnd(12)} FAIL ${e.message}`)
  }
}
console.log(`${files.length - failed}/${files.length} contracts pass`)
process.exit(failed ? 1 : 0)
