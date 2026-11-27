// One-off migration (ARCHITECTURE.md, phase 2): turns a scene's beat list
// (the old src/game/narrative/scenes/SceneNNData.ts, now in legacy/scene-data/) into
//   src/story/sceneNN.ink           what happens: every visible line, the choices,
//                                   what they change, and the branching
//   src/story/sceneNN.staging.json  how it looks: per beat id, shots, blocking,
//                                   cues, holds, and what non-dialogue beats need
// and writes src/story/globals.ink with every variable the scenes share.
//
//   node --import ./scripts/lib/ts-resolve.mjs scripts/ink-convert.mjs s01 s02 s03
//
// Ink conventions (read by src/game/narrative/StoryRuntime.ts):
//   RAVI: Look who's here. #b2_l1         a line; the tag is its beat id
//   >>> shot b2_enter [Label] Caption      a non-dialogue beat (title, shot, caption,
//                                          card, call, qte, explore, video, complete),
//                                          with an optional [label] and text
//   + [Option text #over]                  a choice option; its tag (inside the brackets) is the option id

import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ids = process.argv.slice(2)
if (!ids.length) throw new Error('usage: node scripts/ink-convert.mjs s01 [s02 …]')

const FILES = { s01: 'Scene01Data.ts', s02: 'Scene02Data.ts', s03: 'Scene03Data.ts' }
const scenes = []
for (const id of ids) scenes.push((await import(pathToFileURL(resolve(ROOT, 'legacy/scene-data', FILES[id])).href)).default)

// ── Variables every scene shares ──────────────────────────────────────────
const STATS = ['don_loyalty', 'independence', 'ravi_trust', 'discipline', 'timeline_knowledge', 'don_ambition_knowledge', 'scientist_trust', 'experiment_commitment']
const choiceVars = new Set()
const flagKinds = new Map() // name -> 'number' | 'string' | 'bool'
const kindOf = (v) => (typeof v === 'number' ? 'number' : typeof v === 'string' ? 'string' : 'bool')
const flag = (name, kind) => {
  const prev = flagKinds.get(name)
  if (!prev || prev === 'bool') flagKinds.set(name, kind)
}
const scanCond = (c) => {
  if (!c) return
  if ('choice' in c) choiceVars.add(c.choice)
  else if ('flag' in c) flag(c.flag, c.gte !== undefined ? 'number' : c.eq !== undefined ? kindOf(c.eq) : 'bool')
  else if ('all' in c) c.all.forEach(scanCond)
  else if ('any' in c) c.any.forEach(scanCond)
  else if ('not' in c) scanCond(c.not)
}
for (const scene of scenes) {
  flag(`${scene.id.replace(/^s/, 'scene')}_completed`, 'bool')
  for (const o of scene.outfits ?? []) scanCond(o.when)
  for (const b of scene.beats) {
    scanCond(b.when)
    if (b.type === 'choice') {
      choiceVars.add(b.choiceId)
      for (const o of b.options) {
        scanCond(o.when)
        for (const [k, v] of Object.entries(o.sets ?? {})) flag(k, kindOf(v))
      }
    }
    if (b.type === 'qte') flag(b.result, 'number')
    if (b.type === 'explore') {
      if (b.firstVisit) flag(b.firstVisit, 'string')
      for (const h of b.hotspots) for (const [k, v] of Object.entries(h.sets ?? {})) flag(k, kindOf(v))
    }
  }
}
for (const v of choiceVars) flagKinds.delete(v)

// ── Text helpers ──────────────────────────────────────────────────────────
/** Escapes characters Ink would read as syntax. */
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/([#{}|\[\]<>~])/g, '\\$1').replace(/\/\//g, '\\/\\/')
const lit = (v) => (typeof v === 'string' ? JSON.stringify(v) : String(v))

/** Parenthesises an expression, but never a bare name: Ink reads `(name)` as a list literal. */
const paren = (x) => (/^[\w.]+$/.test(x) ? x : `(${x})`)

const cond = (c) => {
  if ('choice' in c) {
    const alts = [].concat(c.is).map((v) => `${c.choice} == ${lit(v)}`)
    return alts.length > 1 ? `(${alts.join(' || ')})` : alts[0]
  }
  if ('v' in c) return [c.gte !== undefined && `${c.v} >= ${c.gte}`, c.lte !== undefined && `${c.v} <= ${c.lte}`].filter(Boolean).join(' && ') || 'true'
  if ('flag' in c) {
    if (c.eq !== undefined) return `${c.flag} == ${lit(c.eq)}`
    if (c.gte !== undefined) return `${c.flag} >= ${c.gte}`
    const kind = flagKinds.get(c.flag)
    return kind === 'string' ? `${c.flag} != ""` : kind === 'number' ? `${c.flag} > 0` : c.flag
  }
  if ('all' in c) return paren(c.all.map(cond).join(' && '))
  if ('any' in c) return paren(c.any.map(cond).join(' || '))
  if ('not' in c) return `not ${paren(cond(c.not))}`
  throw new Error(`condition ${JSON.stringify(c)}`)
}

const effects = (fx, pad) => Object.entries(fx ?? {}).map(([k, n]) => `${pad}~ ${k} ${n < 0 ? '-=' : '+='} ${Math.abs(n)}`)

/** A non-dialogue beat as an Ink command line. */
const command = (kind, id, label, text) => `>>> ${kind} ${id}${label ? ` [${esc(label)}]` : ''}${text ? ` ${esc(text)}` : ''}`

// ── Scenes ────────────────────────────────────────────────────────────────
/** Fields that move into the Ink (the visible words and the branching); the rest is staging. */
const NARRATIVE = {
  line: ['speaker', 'text', 'when'],
  caption: ['text', 'label', 'when'],
  shot: ['caption', 'when'],
  title: ['when'],
  choice: ['context', 'when', 'options'],
  call: ['caller', 'detail', 'when'],
  explore: ['prompt', 'when'],
  qte: ['when'],
  video: ['when'],
  complete: ['when'],
}

for (const scene of scenes) {
  const knot = `scene${scene.id.slice(1)}`
  const targets = new Set(scene.beats.filter((b) => b.type === 'goto').map((b) => b.target))
  const out = [
    `// ${scene.title}: chapter ${scene.chapter.number}, scene ${scene.index}.`,
    '// Converted from the beat list by scripts/ink-convert.mjs; this file is the source now.',
    `// Staging (shots, blocking, cues) for each tagged beat is in ${knot}.staging.json.`,
    '',
    'INCLUDE globals.ink',
    '',
    `-> ${knot}`,
    '',
    `=== ${knot} ===`,
  ]
  const staging = {}

  for (const b of scene.beats) {
    if (targets.has(b.id)) out.push(`- (${b.id})`)
    const body = []
    switch (b.type) {
      case 'goto':
        body.push(`-> ${b.target}`)
        break
      case 'line':
        body.push(`${b.speaker.toUpperCase()}: ${esc(b.text)} #${b.id}`)
        break
      case 'caption':
        body.push(command('caption', b.id, b.label, b.text))
        break
      case 'shot':
        body.push(command('shot', b.id, b.caption?.label, b.caption?.text))
        break
      case 'title':
      case 'qte':
      case 'video':
      case 'complete':
        body.push(command(b.type, b.id))
        break
      case 'call':
        body.push(command('call', b.id, b.caller, b.detail))
        break
      case 'explore':
        body.push(command('explore', b.id, undefined, b.prompt))
        break
      case 'choice': {
        // the prompt the options answer: a line (dialogue) or a narration card
        if (b.context.speaker) body.push(`${b.context.speaker.toUpperCase()}: ${esc(b.context.text)} #${b.id}`)
        else body.push(command('card', b.id, b.context.label, b.context.text))
        for (const o of b.options) {
          const gate = o.when ? `{${cond(o.when)}} ` : ''
          // sticky (+): a question hub loops back, and each option's own condition decides what is offered
          // the id tag goes inside the brackets: after them it would tag the text that follows, not the option
          body.push(`+ ${gate}[${esc(o.text)} #${o.id}]`)
          body.push(`    ~ ${b.choiceId} = ${lit(o.id)}`)
          body.push(...effects(o.effects, '    '))
          for (const [k, v] of Object.entries(o.sets ?? {})) body.push(`    ~ ${k} = ${lit(v)}`)
        }
        body.push('-')
        break
      }
      default:
        throw new Error(`beat type ${b.type}`)
    }

    if (b.when) {
      // choices and diverts can't sit inside a conditional block: divert round them instead
      if (b.type === 'choice') out.push(`{not ${paren(cond(b.when))}: -> after_${b.id}}`, ...body, `- (after_${b.id})`)
      else if (b.type === 'goto') out.push(`{${cond(b.when)}: -> ${b.target}}`)
      else out.push(`{ ${cond(b.when)}:`, ...body.map((l) => `    ${l}`), '}')
    } else out.push(...body)

    if (b.type !== 'goto') {
      const st = { ...b }
      for (const k of NARRATIVE[b.type] ?? []) delete st[k]
      if (b.type === 'choice') {
        if (b.context.label && b.context.speaker) st.contextLabel = b.context.label
        st.optionStaging = Object.fromEntries(
          b.options.map((o) => [o.id, Object.fromEntries(Object.entries({ icon: o.icon, gesture: o.gesture, say: o.say }).filter(([, v]) => v !== undefined))]),
        )
      }
      staging[b.id] = st
    }
  }
  out.push('-> END', '')

  const meta = { ...scene }
  delete meta.beats
  const dir = resolve(ROOT, 'src/story')
  mkdirSync(dir, { recursive: true })
  writeFileSync(resolve(dir, `${knot}.ink`), out.join('\n'))
  writeFileSync(resolve(dir, `${knot}.staging.json`), JSON.stringify({ scene: meta, beats: staging }, null, 2) + '\n')
  console.log(`${scene.id}: ${scene.beats.length} beats → src/story/${knot}.ink, ${knot}.staging.json`)
}

// globals.ink: every variable the scenes share (stats, stored choices, flags)
const g = [
  '// Variables shared by every scene. Generated by scripts/ink-convert.mjs; add new ones by hand.',
  '// The game copies them to and from its save (src/game/narrative/StoryRuntime.ts).',
  '',
  '// Character state, shown on the scene summary',
  ...STATS.map((s) => `VAR ${s} = 0`),
  '',
  '// The option picked at each choice, by choice id ("" until picked)',
  ...[...choiceVars].sort().map((c) => `VAR ${c} = ""`),
  '',
  '// Results and flags written by gameplay (skill moments, exploring) and by choices',
  ...[...flagKinds].sort(([a], [b]) => a.localeCompare(b)).map(([k, kind]) => `VAR ${k} = ${kind === 'number' ? '0' : kind === 'string' ? '""' : 'false'}`),
  '',
]
writeFileSync(resolve(ROOT, 'src/story/globals.ink'), g.join('\n'))
console.log(`globals: ${STATS.length} stats, ${choiceVars.size} choices, ${flagKinds.size} flags`)
