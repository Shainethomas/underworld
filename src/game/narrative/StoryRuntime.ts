import { Story } from 'inkjs'
import type { Choice } from 'inkjs/engine/Choice'
import { isInteractive } from './NarrativeEngine'
import type { NarrativeContext } from './NarrativeState'
import { DEFAULT_VARS } from './NarrativeState'
import type { Beat, ChoiceBeat, ChoiceOption, FlagValue, QteBeat, SceneData, SpeakerId, VarKey, Vars } from './types'

// The story runs in Ink (src/story/*.ink, compiled at build time): it decides
// what is said, what can be chosen, what each choice changes and where the
// scene goes next. This class turns Ink's output into the Beat objects the UI
// and the stager understand, by joining each line or command with its staging
// (src/story/*.staging.json, keyed by beat id).
//
// Ink output conventions (see ARCHITECTURE.md):
//   RAVI: Look who's here. #b2_l1            a line; the tag is the beat id
//   >>> shot b2_enter [Label] Caption text    any other beat, with optional label and text
// A line or card immediately followed by choices is that choice's prompt.

const SPEAKERS: Record<string, SpeakerId> = { ROOKIE: 'rookie', RAVI: 'ravi', LUCAS: 'lucas', DON: 'don', VICTOR: 'victor', GUARD1: 'guard1', DRIVER: 'driver', SCIENTIST: 'scientist', SENTRY: 'sentry', SAL: 'sal', NICO: 'nico', STRANGER: 'stranger', LOCAL: 'local', CALLER: 'caller', MARCO: 'marco' }
const LINE = /^([A-Z0-9_]+):\s?(.*)$/s
const COMMAND = /^>>>\s+(\w+)\s+(\w+)(?:\s+\[(.*?)\])?(?:\s+(.*))?$/s
const STATS = Object.keys(DEFAULT_VARS) as VarKey[]

/** The story state as the store keeps it: Ink's variables split the way the game reads them. */
export interface StoryVars extends NarrativeContext {}

export class StoryRuntime {
  private story: Story
  /** Every beat delivered in this scene so far, the current one last. */
  readonly played: Beat[] = []
  private current: Beat | null = null
  /** Every variable Ink declares apart from the stats: picked options and flags. */
  private others: string[]

  private scene: SceneData

  constructor(scene: SceneData) {
    this.scene = scene
    this.story = new Story(scene.story as Record<string, unknown>)
    this.story.onError = (message) => console.error(`[ink] ${scene.id}: ${message}`)
    const names = [...(this.story.variablesState as unknown as { _globalVariables: Map<string, unknown> })._globalVariables.keys()]
    const stats = new Set<string>(STATS)
    this.others = names.filter((n) => !stats.has(n))
  }

  get beat(): Beat | null {
    return this.current
  }

  // ── Variables ───────────────────────────────────────────────────────────

  private read(name: string): unknown {
    return (this.story.variablesState as unknown as Record<string, unknown>)[name]
  }

  private write(name: string, value: unknown): void {
    if (!this.story.variablesState.GlobalVariableExistsWithName(name)) return
    ;(this.story.variablesState as unknown as Record<string, unknown>)[name] = value
  }

  /** Loads the game's story state into Ink (at the start of a scene). */
  setVars(v: StoryVars): void {
    for (const k of STATS) this.write(k, v.vars[k] ?? 0)
    for (const [k, val] of Object.entries(v.choices)) this.write(k, val)
    for (const [k, val] of Object.entries(v.flags)) this.write(k, val)
  }

  /**
   * Ink's variables as the game reads them: the stats, the picked options
   * (every string variable that is set), and the flags (every variable that is set).
   */
  getVars(): StoryVars {
    const vars = { ...DEFAULT_VARS } as Vars
    for (const k of STATS) vars[k] = Number(this.read(k) ?? 0)
    const choices: Record<string, string> = {}
    const flags: Record<string, FlagValue> = {}
    for (const k of this.others) {
      const v = this.read(k)
      if (v === false || v === 0 || v === '' || v === null || v === undefined) continue
      if (typeof v === 'string') choices[k] = v
      flags[k] = v as FlagValue
    }
    return { vars, choices, flags }
  }

  /** Gameplay writes back what happened (a skill moment's result, a hotspot visited). */
  setFlag(name: string, value: FlagValue): void {
    this.write(name, value)
  }

  // ── Flow ────────────────────────────────────────────────────────────────

  /** Moves to the next beat (null at the end of the story). */
  next(): Beat | null {
    this.current = this.pull()
    if (this.current) this.played.push(this.current)
    return this.current
  }

  /** Picks an option of the current choice; the effects apply as the story continues. */
  choose(optionId: string): void {
    const beat = this.current
    if (beat?.type !== 'choice') throw new Error(`[ink] ${this.scene.id}: no choice to make`)
    const index = this.story.currentChoices.findIndex((c) => optionOf(c) === optionId)
    if (index < 0) throw new Error(`[ink] ${this.scene.id}: "${optionId}" is not on offer at ${beat.id}`)
    if (this.isLocked(optionId)) throw new Error(`[ink] ${this.scene.id}: "${optionId}" is locked at ${beat.id}`)
    this.story.ChooseChoiceIndex(index)
  }

  /** Runs on to the next beat the player acts on; returns the beats passed over. */
  skip(): Beat[] {
    const skipped: Beat[] = []
    for (let b = this.next(); b && !isInteractive(b); b = this.next()) skipped.push(b)
    // the beat it stopped on is the current one, not a skipped one
    return skipped
  }

  saveState(): string {
    return this.story.state.toJson()
  }

  /** Restores a saved position: Ink's state, and the beats played up to it (rebuilt from their ids). */
  loadState(json: string, played: string[]): void {
    this.story.state.LoadJson(json)
    this.played.length = 0
    for (const id of played.slice(0, -1)) {
      const staged = this.scene.staging[id]
      if (staged) this.played.push(staged as Beat)
    }
    // the current beat is rebuilt from what Ink last output, with its words
    this.current = this.build(this.story.currentText ?? '', this.story.currentTags ?? [])
    if (this.current) this.played.push(this.current)
  }

  // ── Ink output → beats ──────────────────────────────────────────────────

  private pull(): Beat | null {
    while (this.story.canContinue) {
      const text = this.story.Continue() ?? ''
      const beat = this.build(text, this.story.currentTags ?? [])
      if (beat) return beat
    }
    return null
  }

  private staged(id: string): Beat {
    const s = this.scene.staging[id]
    if (!s) throw new Error(`[ink] ${this.scene.id}: no staging for beat "${id}"`)
    // a fresh object per delivery: a question hub delivers the same beat again
    return structuredClone(s) as Beat
  }

  private build(raw: string, tags: string[]): Beat | null {
    const text = raw.trim()
    if (!text) return null
    const cmd = COMMAND.exec(text)
    let beat: Beat
    if (cmd) {
      const [, kind, id, label, words] = cmd
      beat = this.staged(id)
      if (beat.type === 'caption') Object.assign(beat, { label, text: words ?? '' })
      else if (beat.type === 'shot' && words) beat.caption = { label, text: words }
      else if (beat.type === 'call') Object.assign(beat, { caller: label ?? '', detail: words ?? '' })
      else if (beat.type === 'message') Object.assign(beat, { sender: label ?? '', text: words ?? '' })
      else if (beat.type === 'drive') Object.assign(beat, { destination: label ?? beat.destination, prompt: words ?? '' })
      else if (beat.type === 'explore') beat.prompt = words ?? ''
      else if (beat.type === 'choice') beat.context = { label, text: words ?? '' }
      else if (beat.type === 'job') {
        const [client = '', pay = '', risk = '', objective = ''] = (words ?? '').split('¦').map((w) => w.trim())
        Object.assign(beat, { name: label ?? '', client, pay, risk, objective })
      } else if (beat.type === 'qte') tune(beat, words)
      else if (kind !== beat.type) console.warn(`[ink] ${this.scene.id}: "${id}" is staged as ${beat.type}, written as ${kind}`)
    } else {
      const line = LINE.exec(text)
      const id = tags.find((t) => this.scene.staging[t])
      if (!line || !id) throw new Error(`[ink] ${this.scene.id}: can't place "${text}" (tags: ${tags.join(', ') || 'none'})`)
      const speaker = this.scene.speakers?.[line[1]] ?? SPEAKERS[line[1]]
      if (!speaker) throw new Error(`[ink] ${this.scene.id}: unknown speaker ${line[1]}`)
      beat = this.staged(id)
      if (beat.type === 'line') Object.assign(beat, { speaker, text: line[2] })
      else if (beat.type === 'choice') beat.context = { speaker, label: (beat as ChoiceBeat & { contextLabel?: string }).contextLabel, text: line[2] }
    }
    if (beat.type === 'choice') beat.options = this.options(beat)
    return beat
  }

  private options(beat: ChoiceBeat): ChoiceOption[] {
    const extra = (beat as ChoiceBeat & { optionStaging?: Record<string, Partial<ChoiceOption>> }).optionStaging ?? {}
    return this.story.currentChoices.map((c) => {
      const id = optionOf(c)
      const locked = this.lockReason(c)
      return { id, text: c.text, ...extra[id], ...(locked ? { locked } : {}) }
    })
  }

  /**
   * An option tagged `#need:<variable>:<amount>` is shown but can't be picked
   * until the variable reaches the amount (cash for a purchase, Respect for a
   * gate). The reason is what the button says.
   */
  private lockReason(c: Choice): string | undefined {
    for (const tag of c.tags ?? []) {
      const m = NEED.exec(tag.trim())
      if (!m) continue
      const need = Number(m[2])
      if (Number(this.read(m[1]) ?? 0) >= need) continue
      return needText(m[1], need)
    }
    return undefined
  }

  /** Whether an option on offer now can't be picked yet. */
  isLocked(optionId: string): boolean {
    const c = this.story.currentChoices.find((x) => optionOf(x) === optionId)
    return Boolean(c && this.lockReason(c))
  }
}

const NEED = /^need:([a-z_]+):(-?[0-9]+)$/
const NEED_LABELS: Record<string, string> = { respect: 'Respect', intel: 'Intel', discipline: 'Discipline', independence: 'Independence', ravi_trust: "Lucas's Trust", don_loyalty: "Victor's Favour", heat: 'Heat' }

function needText(name: string, n: number): string {
  if (name === 'cash') return `Needs $${n.toLocaleString('en-US')}`
  // a contact is a flag: the option needs the person, not an amount
  if (name.startsWith('contact_')) return `Needs ${name.slice(8).replace(/^./, (c) => c.toUpperCase())} as a contact`
  return `Needs ${NEED_LABELS[name] ?? name} ${n}`
}

/**
 * A skill moment made easier or harder by what the player chose before it
 * (`>>> qte b3_slip easy`): easy widens a timing window by a third and asks
 * for a quarter fewer taps; hard does the reverse. It is written in the Ink,
 * so a resumed save rebuilds the same moment.
 */
function tune(beat: QteBeat, words: string | undefined): void {
  const mod = words?.trim()
  if (mod !== 'easy' && mod !== 'hard') return
  const easy = mod === 'easy'
  if (beat.mode === 'timing') beat.window = Math.round(beat.window * (easy ? 1.35 : 0.8))
  else if (beat.mode === 'mash') beat.count = Math.max(1, Math.round(beat.count * (easy ? 0.75 : 1.25)))
  else beat.window = Math.round(beat.window * (easy ? 0.75 : 1.25))
}

/** An option's id: its first tag, or its text if untagged. */
function optionOf(c: Choice): string {
  return c.tags?.[0]?.trim() || c.text
}
