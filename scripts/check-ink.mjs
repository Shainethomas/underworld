// Plays each scene's Ink (through StoryRuntime, as the game does) with every
// choice policy and checks every line, command and choice lands on staging.
// With --legacy, also replays the pre-Ink beat lists (legacy/scene-data) with
// the same decisions and checks that both deliver the same beats in the same
// order and end with the same variables.
//
//   node --import ./scripts/lib/ts-resolve.mjs scripts/check-ink.mjs [--legacy]

import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { compileInk } from './lib/ink-compile.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const legacy = process.argv.includes('--legacy')
const { StoryRuntime } = await import(pathToFileURL(resolve(ROOT, 'src/game/narrative/StoryRuntime.ts')).href)
const { evaluate } = await import(pathToFileURL(resolve(ROOT, 'src/game/narrative/ChoiceSystem.ts')).href)
const { DEFAULT_VARS } = await import(pathToFileURL(resolve(ROOT, 'src/game/narrative/NarrativeState.ts')).href)

/** Which option to take at the n-th choice, and what a skill moment scores. */
const POLICIES = {
  first: { pick: (opts) => opts[0], qte: 1 },
  second: { pick: (opts) => opts[Math.min(1, opts.length - 1)], qte: 0.4 },
  last: { pick: (opts) => opts[opts.length - 1], qte: 1 },
  third: { pick: (opts) => opts[Math.min(2, opts.length - 1)], qte: 0 },
}

function playInk(scene, policy) {
  const rt = new StoryRuntime(scene)
  rt.setVars({ vars: { ...DEFAULT_VARS }, choices: {}, flags: {} })
  const ids = []
  for (let b = rt.next(), guard = 0; b && guard < 3000; b = rt.next(), guard++) {
    ids.push(b.id)
    if (b.type === 'line' && (!b.text || !b.speaker)) throw new Error(`${b.id}: line without words`)
    if (b.type === 'choice') {
      if (!b.options.length) throw new Error(`${b.id}: no options`)
      if (!b.context?.text) throw new Error(`${b.id}: choice without its prompt`)
      // every option carries its id as a tag inside the brackets, and the staging knows it
      for (const o of b.options) if (b.optionStaging && !(o.id in b.optionStaging)) throw new Error(`${b.id}: option "${o.id}" has no id tag the staging knows (put #id inside the brackets)`)
      // a locked option (not enough cash or Respect) is on screen but can't be taken
      const open = b.options.filter((o) => !o.locked)
      if (!open.length) throw new Error(`${b.id}: every option is locked`)
      rt.choose(policy.pick(open).id)
    } else if (b.type === 'qte') rt.setFlag(b.result, policy.qte)
    else if (b.type === 'explore') {
      const end = b.hotspots.find((h) => h.ends)
      for (const [k, v] of Object.entries(end?.sets ?? {})) rt.setFlag(k, v)
      if (b.firstVisit && end) rt.setFlag(b.firstVisit, end.id)
    }
    if (b.type === 'complete') break
  }
  return { ids, vars: rt.getVars() }
}

function playLegacy(beats, policy) {
  const ctx = { vars: { ...DEFAULT_VARS }, choices: {}, flags: {} }
  const index = (id) => beats.findIndex((b) => b.id === id)
  const ids = []
  let i = 0
  for (let guard = 0; i >= 0 && i < beats.length && guard < 3000; guard++) {
    const b = beats[i]
    if (!evaluate(b.when, ctx)) {
      i++
      continue
    }
    if (b.type === 'goto') {
      i = index(b.target)
      continue
    }
    ids.push(b.id)
    if (b.type === 'choice') {
      const o = policy.pick(b.options.filter((x) => evaluate(x.when, ctx)))
      ctx.choices[b.choiceId] = o.id
      for (const [k, d] of Object.entries(o.effects ?? {})) ctx.vars[k] += d
      Object.assign(ctx.flags, o.sets ?? {})
    } else if (b.type === 'qte') ctx.flags[b.result] = policy.qte
    else if (b.type === 'explore') {
      const end = b.hotspots.find((h) => h.ends)
      Object.assign(ctx.flags, end?.sets ?? {})
      if (b.firstVisit && end) ctx.flags[b.firstVisit] = end.id
    }
    if (b.type === 'complete') break
    i++
  }
  return { ids, vars: ctx.vars, choices: ctx.choices }
}

let failed = false
for (const n of (legacy ? ['01', '02', '03'] : ['01', '02', '03', '04'])) {
  const st = JSON.parse(readFileSync(resolve(ROOT, `src/story/scene${n}.staging.json`), 'utf8'))
  const scene = { ...st.scene, story: JSON.parse(compileInk(resolve(ROOT, `src/story/scene${n}.ink`)).json), staging: st.beats }
  const old = legacy ? (await import(pathToFileURL(resolve(ROOT, `legacy/scene-data/Scene${n}Data.ts`)).href)).default.beats : null
  // every staged beat is one the script names (a leftover would hide a beat the writer thinks is live)
  if (!legacy) {
    const src = readFileSync(resolve(ROOT, `src/story/scene${n}.ink`), 'utf8').replace(/\/\/.*$/gm, '')
    const named = new Set([...src.matchAll(/#([a-z0-9_]+)/g), ...src.matchAll(/^\s*>>>\s+\w+\s+(\w+)/gm)].map((m) => m[1]))
    const orphans = Object.keys(st.beats).filter((id) => !named.has(id))
    if (orphans.length) {
      failed = true
      console.log(`scene${n} staging FAIL beats the script never names: ${orphans.join(', ')}`)
    }
  }
  for (const [name, policy] of Object.entries(POLICIES)) {
    try {
      const ink = playInk(scene, policy)
      let note = `${ink.ids.length} beats`
      if (old) {
        const ref = playLegacy(old, policy)
        const at = ref.ids.findIndex((id, k) => ink.ids[k] !== id)
        if (at >= 0 || ref.ids.length !== ink.ids.length) throw new Error(`differs at #${at}: legacy ${ref.ids[at]} / ink ${ink.ids[at]}`)
        if (JSON.stringify(ref.vars) !== JSON.stringify(ink.vars.vars)) throw new Error(`stats differ: ${JSON.stringify(ref.vars)} / ${JSON.stringify(ink.vars.vars)}`)
        for (const [k, v] of Object.entries(ref.choices)) if (ink.vars.choices[k] !== v) throw new Error(`choice ${k}: ${v} / ${ink.vars.choices[k]}`)
        note += ', same as legacy'
      }
      console.log(`scene${n} ${name.padEnd(6)} ok  ${note}`)
    } catch (e) {
      failed = true
      console.log(`scene${n} ${name.padEnd(6)} FAIL ${e.message}`)
    }
  }
}
process.exit(failed ? 1 : 0)
