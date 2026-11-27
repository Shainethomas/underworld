import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { spokenLine } from '../game/narrative/ChoiceSystem'
import { DEFAULT_VARS, VAR_ICONS, VAR_LABELS, type NarrativeContext } from '../game/narrative/NarrativeState'
import { fmtCash, rankFor } from '../game/progression/Progression'
import { migrateSave, SAVE_VERSION } from './migrations'
import { StoryRuntime } from '../game/narrative/StoryRuntime'
import type { TextSpeed } from '../game/narrative/DialogueSystem'
import type { Beat, FlagValue, Gesture, Hotspot, SceneData, SpeakerId, VarKey, Vars } from '../game/narrative/types'
import { emptyBoard, recordJob, rollDay, type BoardState } from '../game/board/Board'
import { CONTRACTS } from '../game/board/contracts'

export interface Settings {
  sound: boolean
  music: number
  sfx: number
  /** Recorded character voices (0 mutes them). */
  voice?: number
  textSpeed: TextSpeed
  quality: 'auto' | 'high' | 'low' | 'lite'
  renderer: 'auto' | 'webgl2'
}

export interface Toast {
  id: number
  text: string
  tone: 'gold' | 'neutral'
  icon?: string
}

/** A line spoken outside the beat list: Rookie's chosen reply, or a hotspot aside. */
export interface Spoken {
  speaker: SpeakerId
  text: string
  gesture?: Gesture
}

/**
 * Kept in the save from before the economy, no longer shown or used: money
 * and standing are story variables now (`cash`, `respect`, the `rank` flag;
 * src/game/progression/Progression.ts).
 */
interface Profile {
  name: string
  level: number
  xp: number
  cash: number
  gems: number
  health: number
  stamina: number
}

/** Story state as it stood when a scene began; replaying the scene rewinds to it. */
export interface Snapshot {
  vars: Vars
  choices: Record<string, string>
  flags: Record<string, FlagValue>
}

interface Progress {
  sceneId: string
  /** How many beats of the current scene have played (0: not started). */
  cursor: number
  /** Ink's saved state at the current beat, and the beat ids played so far (the current one last). */
  ink?: string
  played?: string[]
  completed: string[]
  unlocked: string[]
  starts: Record<string, Snapshot>
  /** A fingerprint of the script the Ink state was saved from; a changed script restarts the scene. */
  story?: string
  /** One-off save upgrades already applied (src/store/migrations.ts). */
  migrated?: string[]
}

export interface GameState {
  // persisted
  profile: Profile
  progress: Progress
  vars: Vars
  choices: Record<string, string>
  flags: Record<string, FlagValue>
  settings: Settings
  /** Lucas's board of street work (src/game/board/Board.ts). */
  board: BoardState
  // runtime
  screen: 'menu' | 'game'
  scene: SceneData | null
  /** The beat on screen, built by the story runtime. */
  beat: Beat | null
  echo: Spoken | null
  aside: { lines: Spoken[]; index: number; ends: boolean } | null
  visited: string[]
  completeOpen: boolean
  toasts: Toast[]
  /** A scene loading behind the loading screen, or (stream) a set switch still waiting on files behind the fade. */
  loading: { label: string; progress: number; kind?: 'scene' | 'stream' } | null
  fade: boolean
  menuOpen: boolean

  startScene(scene: SceneData, fresh: boolean): void
  /** Test/debug: replays the scene from its start to a beat, picking `prefer`red options. */
  jumpTo(beatId: string): Beat[]
  advance(): void
  choose(optionId: string): void
  skip(): Beat[]
  finishQte(flag: string, value: number): void
  openAside(h: Hotspot): void
  nextAside(): void
  setFlag(key: string, value: FlagValue): void
  toMenu(): void
  setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void
  toast(text: string, tone?: Toast['tone'], icon?: string): void
  setLoading(l: GameState['loading']): void
  setFade(on: boolean): void
  setMenuOpen(on: boolean): void
  resetProgress(): void
  /** Brings the board up to today (new contracts, Heat cooled, messages delivered). */
  openBoard(): void
  /** Playtest control: moves the board's clock on a day. */
  skipDay(): void
  readInbox(): void
}

const SAVE_KEY = 'underworld.save.v2'

/** A cheap fingerprint of a compiled script, to tell whether a saved Ink position still fits it. */
function fingerprint(story: object): string {
  const text = JSON.stringify(story)
  let h = 5381
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0
  return `${text.length}:${(h >>> 0).toString(36)}`
}

export function context(s: Pick<GameState, 'vars' | 'choices' | 'flags'>): NarrativeContext {
  return { vars: s.vars, choices: s.choices, flags: s.flags }
}

export const currentBeat = (s: GameState): Beat | null => s.beat

/** The story runtime for the scene being played (not part of the save; rebuilt from it). */
let story: StoryRuntime | null = null
/** The fingerprint of that scene's script, saved with its Ink position. */
let storyPrint = ''

/** Beats played in this scene before the current one, for rebuilding the world on resume. */
export function playedBeats(): Beat[] {
  return story ? story.played.slice(0, -1) : []
}

const initialProgress = (): Progress => ({ sceneId: 's01', cursor: -1, completed: [], unlocked: ['s01'], starts: {} })

/** Story variables that belong to one job only (its debrief's ledger and grade). */
const JOB_ONLY = ['ledger', 'job_grade']

/** A snapshot with the previous job's ledger and grade taken out. */
function withoutJob(snap: Snapshot): Snapshot {
  const drop = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => !JOB_ONLY.includes(k)))
  return { ...snap, choices: drop(snap.choices), flags: drop(snap.flags) }
}

/** The snapshot a scene's deltas are measured against. */
export const sceneStart = (s: Pick<GameState, 'progress' | 'vars'>, sceneId: string): Snapshot =>
  s.progress.starts[sceneId] ?? { vars: s.vars, choices: {}, flags: {} }

let toastId = 0

export const useGame = create<GameState>()(
  persist(
    (set, get) => {
      /** After the story moves: mirror Ink's variables and save where it stands. */
      const sync = () => {
        if (!story) return
        const s = get()
        const beat = story.beat
        const played = story.played.map((b) => b.id)
        const progress = { ...s.progress, cursor: played.length, ink: story.saveState(), played, story: storyPrint }
        set({ ...story.getVars(), beat, progress, visited: beat?.type === 'explore' && beat !== s.beat ? [] : s.visited })
        if (beat?.type === 'complete') complete()
      }

      /** Reaching `complete` closes the scene: progress, the next scene unlocked, experience. */
      const complete = () => {
        const s = get()
        if (!s.scene) return
        if (s.scene.kind === 'contract') {
          // street work: no story unlocks; the board records it and queues tomorrow's message
          const before = typeof s.flags.rank === 'number' ? s.flags.rank : 0
          const rank = Math.max(before, Math.min(rankFor(s.vars.respect).id, s.scene.rankCap ?? Infinity))
          story?.setFlag('rank', rank)
          const board = recordJob(s.board, s.scene.id, String(s.choices.job_grade ?? ''), s.choices.k_after ?? s.flags.k_after, Date.now())
          set({ board, flags: { ...s.flags, rank }, completeOpen: true })
          return
        }
        const progress = { ...s.progress }
        const nextId = s.scene.next?.id
        progress.completed = [...new Set([...progress.completed, s.scene.id])]
        if (nextId) {
          progress.unlocked = [...new Set([...progress.unlocked, nextId])]
          // the next scene begins from this outcome, even if it was played before
          const { [nextId]: _stale, ...starts } = progress.starts
          progress.starts = starts
        }
        // later scenes can ask for it by name: scene01_completed, scene02_completed…
        const done = `${s.scene.id.replace(/^s/, 'scene')}_completed`
        story?.setFlag(done, true)
        // Promotion happens here, at the debrief, and never goes backwards.
        const before = typeof s.flags.rank === 'number' ? s.flags.rank : 0
        const rank = Math.max(before, Math.min(rankFor(s.vars.respect).id, s.scene.rankCap ?? Infinity))
        story?.setFlag('rank', rank)
        set({ progress, flags: { ...s.flags, [done]: true, rank }, completeOpen: true })
      }

      /** Shows a toast for each stat a choice moved. */
      const announce = (before: Vars, after: Vars) => {
        for (const k of Object.keys(after) as VarKey[]) {
          const d = after[k] - before[k]
          if (!d) continue
          if (k === 'cash') get().toast(`${d > 0 ? '+' : ''}${fmtCash(d)}`, d > 0 ? 'gold' : 'neutral', 'cash')
          // Heat and the Varga crew's hostility are bad news, however they're counted
          else if (k === 'heat' || k === 'varga') get().toast(`${VAR_LABELS[k]} ${d > 0 ? '+' : ''}${d}`, 'neutral', d > 0 ? 'warning' : VAR_ICONS[k])
          else get().toast(`${VAR_LABELS[k]} ${d > 0 ? '+' : ''}${d}`, d > 0 ? 'gold' : 'neutral', k)
        }
      }

      return {
      profile: { name: 'Rookie', level: 1, xp: 0, cash: 0, gems: 0, health: 100, stamina: 100 },
      progress: initialProgress(),
      vars: { ...DEFAULT_VARS },
      choices: {},
      flags: {},
      settings: { sound: true, music: 0.8, sfx: 1, voice: 1, textSpeed: 'normal', quality: 'auto', renderer: 'auto' },
      board: emptyBoard(),
      screen: 'menu',
      scene: null,
      beat: null,
      echo: null,
      aside: null,
      visited: [],
      completeOpen: false,
      toasts: [],
      loading: null,
      fade: false,
      menuOpen: false,

      startScene(scene, fresh) {
        const s = get()
        const p = s.progress
        storyPrint = fingerprint(scene.story)
        const saved = !fresh && p.sceneId === scene.id && Boolean(p.ink) && Boolean(p.played?.length)
        // a position saved from an older version of this scene's script can't be restored into the new one
        const resuming = saved && p.story === storyPrint
        // A scene played for the first time starts from wherever the story is now
        // (earlier scenes' choices carry forward); a replay rewinds to its snapshot.
        // Each job's ledger and grade are its own: the last job's never carry into this one's debrief.
        // Street work always starts from where the story stands now, and a story
        // scene left half-played restarts from the new standing (not its old snapshot,
        // which would undo what the board paid).
        const starts = scene.kind === 'contract' ? Object.fromEntries(Object.entries(p.starts).filter(([id]) => p.completed.includes(id))) : p.starts
        const start: Snapshot = withoutJob(starts[scene.id] ?? { vars: { ...s.vars }, choices: { ...s.choices }, flags: { ...s.flags } })
        story = new StoryRuntime(scene)
        story.setVars(start)
        if (resuming) story.loadState(p.ink!, p.played!)
        else if (saved) get().toast('Scene updated · starting it again', 'neutral', 'replay')
        set({
          scene,
          screen: 'game',
          echo: null,
          aside: null,
          visited: [],
          completeOpen: false,
          menuOpen: false,
          progress: { ...p, sceneId: scene.id, starts: { ...starts, [scene.id]: start } },
        })
        if (!resuming) story.next()
        sync()
      },

      jumpTo(beatId) {
        const s = get()
        if (!s.scene) return []
        // the options and skill results already in the store (a test's presets) are the ones taken
        const prefer = { ...s.choices }
        const results = { ...s.flags }
        const start = s.progress.starts[s.scene.id] ?? { vars: s.vars, choices: {}, flags: {} }
        story = new StoryRuntime(s.scene)
        story.setVars(start)
        let beat = story.next()
        for (let guard = 0; beat && beat.id !== beatId && guard < 4000; guard++) {
          if (beat.type === 'complete') break
          if (beat.type === 'choice') {
            const want = prefer[beat.choiceId]
            const open = beat.options.filter((o) => !o.locked)
            const option = open.find((o) => o.id === want) ?? open[0]
            story.choose(option.id)
          } else if (beat.type === 'qte') story.setFlag(beat.result, typeof results[beat.result] === 'number' ? (results[beat.result] as number) : 1)
          else if (beat.type === 'explore') {
            const end = beat.hotspots.find((h) => h.ends)
            for (const [k, v] of Object.entries(end?.sets ?? {})) story.setFlag(k, v)
            if (beat.firstVisit && end) story.setFlag(beat.firstVisit, end.id)
          }
          beat = story.next()
        }
        set({ echo: null, aside: null, completeOpen: false })
        sync()
        return playedBeats()
      },

      advance() {
        if (!story) return
        if (get().echo) set({ echo: null })
        story.next()
        sync()
      },

      choose(optionId) {
        const s = get()
        const beat = s.beat
        if (!story || !beat || beat.type !== 'choice' || s.echo) return
        const option = beat.options.find((o) => o.id === optionId)
        if (!option || option.locked) return
        const before = s.vars
        story.choose(optionId)
        set(story.getVars())
        announce(before, get().vars)
        const line = spokenLine(beat, option)
        if (line) set({ echo: { speaker: 'rookie', text: line, gesture: option.gesture } })
        else get().advance()
      },

      skip() {
        if (!story) return []
        set({ echo: null })
        const skipped = story.skip()
        sync()
        return skipped
      },

      finishQte(flag, value) {
        story?.setFlag(flag, value)
        set({ flags: { ...get().flags, [flag]: value } })
        get().advance()
      },

      openAside(h) {
        const s = get()
        const beat = s.beat
        const record = beat?.type === 'explore' ? beat.firstVisit : undefined
        // what the player chose to look at, and what they looked at first
        const sets: Record<string, FlagValue> = { ...h.sets, ...(record && s.flags[record] === undefined ? { [record]: h.id } : {}) }
        for (const [k, v] of Object.entries(sets)) story?.setFlag(k, v)
        set({ visited: [...new Set([...s.visited, h.id])], flags: { ...s.flags, ...sets } })
        if (h.lines?.length) set({ aside: { lines: h.lines, index: 0, ends: Boolean(h.ends) } })
        else if (h.ends) get().advance()
      },

      nextAside() {
        const a = get().aside
        if (!a) return
        if (a.index + 1 < a.lines.length) set({ aside: { ...a, index: a.index + 1 } })
        else {
          set({ aside: null })
          if (a.ends) get().advance()
        }
      },

      setFlag(key, value) {
        story?.setFlag(key, value)
        set({ flags: { ...get().flags, [key]: value } })
      },

      toMenu() {
        story = null
        set({ screen: 'menu', scene: null, beat: null, echo: null, aside: null, menuOpen: false, completeOpen: false })
      },

      setSetting(key, value) {
        set({ settings: { ...get().settings, [key]: value } })
      },

      toast(text, tone = 'neutral', icon) {
        const id = ++toastId
        set({ toasts: [...get().toasts, { id, text, tone, icon }] })
        window.setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 2600)
      },

      setLoading(loading) {
        set({ loading })
      },
      setFade(fade) {
        set({ fade })
      },
      setMenuOpen(menuOpen) {
        set({ menuOpen })
      },

      resetProgress() {
        set({ progress: initialProgress(), vars: { ...DEFAULT_VARS }, choices: {}, flags: {}, board: emptyBoard() })
      },

      openBoard() {
        const s = get()
        const next = rollDay(s.board, s.vars, Date.now(), Object.values(CONTRACTS))
        if (next.board !== s.board) set({ board: next.board, vars: next.vars })
      },

      skipDay() {
        set({ board: { ...get().board, offset: get().board.offset + 1 } })
        get().openBoard()
      },

      readInbox() {
        set({ board: { ...get().board, inbox: [] } })
      },
    }
    },
    {
      name: SAVE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ profile: s.profile, progress: s.progress, vars: s.vars, choices: s.choices, flags: s.flags, settings: s.settings, board: s.board }),
      version: SAVE_VERSION,
      migrate: (persisted, version) => migrateSave(persisted, version) as unknown as GameState,
      // Saves from before a variable existed simply start it at zero.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<GameState>
        const fill = (v?: Vars): Vars => ({ ...DEFAULT_VARS, ...v })
        const starts = Object.fromEntries(Object.entries(p.progress?.starts ?? {}).map(([k, v]) => [k, { ...v, vars: fill(v.vars) }]))
        return {
          ...current,
          ...p,
          vars: fill(p.vars),
          // saves from before health and stamina existed start them full
          profile: { ...current.profile, ...p.profile },
          progress: p.progress ? { ...p.progress, starts } : current.progress,
          settings: { ...current.settings, ...p.settings },
          board: { ...emptyBoard(), ...p.board },
        }
      },
    },
  ),
)

export function hasResumableSave(sceneId: string): boolean {
  const p = useGame.getState().progress
  return p.sceneId === sceneId && p.cursor > 0 && Boolean(p.ink) && !p.completed.includes(sceneId)
}

/** The scene a returning player most likely wants: the last unlocked one. */
export function latestScene(playable: (id: string) => boolean): string {
  const p = useGame.getState().progress
  return [...p.unlocked].reverse().find(playable) ?? 's01'
}
