import { create } from 'zustand'
import { CHAPTER_1 } from '../narrative/chapter1'
import { expandBeats, findNextStop, getScene, INSTANT_BEATS } from '../narrative/runner'
import { applyDirective, emptyStage, type StageState } from '../narrative/stage'
import type { Beat, Effects, EnvironmentId, Ground, Hotspot, Line, SceneId } from '../narrative/types'
import {
  gameStateService,
  SAVE_VERSION,
  type ObjectiveStatus,
  type PlayerState,
  type SaveData,
  type Settings,
} from './persistence'

export const CHAPTER = CHAPTER_1

export type Screen = 'title' | 'game'
export interface Toast { id: number; text: string; kind: 'xp' | 'rep' | 'objective' | 'cash' | 'combat' }

interface RuntimeState {
  screen: Screen
  sceneId: SceneId
  beatIndex: number
  /** increments on every beat entry; UI keys off it */
  beatSeq: number
  stage: StageState
  fading: boolean
  loading: boolean
  envReady: EnvironmentId | null
  /** a short dialogue played outside the beat list (hotspot observations) */
  aside: { lines: Line[]; index: number; hotspot: Hotspot } | null
  explore: { visited: string[]; target: string | null }
  toasts: Toast[]
  settingsOpen: boolean
  objectivesOpen: boolean
}

interface Actions {
  newGame(): void
  continueGame(): void
  replayScene(id: SceneId): void
  goTitle(): void
  resetProgress(): void
  beginScene(): void
  advance(): void
  skip(): void
  choose(choiceId: string, optionId: string): void
  qteResult(reactionMs: number | null): void
  walkTo(p: Ground): void
  walkToHotspot(id: string): void
  arriveHotspot(id: string): void
  advanceAside(): void
  setEnvReady(env: EnvironmentId | null): void
  updateSettings(s: Partial<Settings>): void
  setSettingsOpen(v: boolean): void
  setObjectivesOpen(v: boolean): void
  dismissToast(id: number): void
}

export type GameStore = SaveData & RuntimeState & Actions

const INITIAL_PLAYER: PlayerState = { name: 'Rookie', level: 1, xp: 0, xpToNext: 300, cash: 5000, gold: 250, health: 100, healthMax: 100, power: 100 }
const DEFAULT_SETTINGS: Settings = { sound: true, quality: 'auto', textSpeed: 'normal', autoAdvance: false }

function initialObjectives(): Record<string, ObjectiveStatus> {
  return Object.fromEntries(CHAPTER.objectives.map((o, i) => [o.id, i === 0 ? 'active' : 'locked']))
}

function freshSave(settings: Settings = DEFAULT_SETTINGS): SaveData {
  return {
    version: SAVE_VERSION,
    player: { ...INITIAL_PLAYER },
    reputation: { respect: 0, fear: 0, ambition: 0 },
    relationships: { maddog: 0 },
    flags: {},
    choices: {},
    objectives: initialObjectives(),
    checkpoint: null,
    completedScenes: [],
    settings,
  }
}

const saved = gameStateService.load()
let toastSeq = 0
const TRANSITION_MS = 750

const beatsOf = (sceneId: SceneId, choices: Record<string, string>) =>
  expandBeats(getScene(CHAPTER, sceneId).beats, choices)

type Draft = Pick<GameStore, 'player' | 'reputation' | 'relationships' | 'flags' | 'objectives' | 'toasts' | 'stage'>

function draftOf(s: GameStore): Draft {
  return {
    player: { ...s.player },
    reputation: { ...s.reputation },
    relationships: { ...s.relationships },
    flags: { ...s.flags },
    objectives: { ...s.objectives },
    toasts: [...s.toasts],
    stage: s.stage,
  }
}

function toast(d: Draft, text: string, kind: Toast['kind']) {
  d.toasts = [...d.toasts.slice(-3), { id: ++toastSeq, text, kind }]
}

function applyEffects(d: Draft, e: Effects, sign = 1, quiet = false) {
  if (e.xp) {
    d.player.xp += e.xp * sign
    while (d.player.xp >= d.player.xpToNext) {
      d.player.xp -= d.player.xpToNext
      d.player.level += 1
      d.player.xpToNext = Math.round(d.player.xpToNext * 1.5)
      if (!quiet) toast(d, `LEVEL ${d.player.level}`, 'xp')
    }
    if (!quiet) toast(d, `+${e.xp} XP`, 'xp')
  }
  if (e.cash) {
    d.player.cash += e.cash * sign
    if (!quiet) toast(d, `+$${e.cash.toLocaleString()}`, 'cash')
  }
  if (e.gold) d.player.gold += e.gold * sign
  if (e.health) {
    d.player.health = Math.max(1, Math.min(d.player.healthMax, d.player.health + e.health * sign))
    if (!quiet) toast(d, `${e.health > 0 ? '+' : ''}${e.health} HEALTH`, e.health > 0 ? 'xp' : 'combat')
  }
  for (const [k, v] of Object.entries(e.reputation ?? {})) {
    const key = k as keyof Draft['reputation']
    d.reputation[key] += (v ?? 0) * sign
    if (!quiet && sign > 0) toast(d, `+${v} ${k.toUpperCase()}`, 'rep')
  }
  for (const [k, v] of Object.entries(e.relationships ?? {})) d.relationships[k] = (d.relationships[k] ?? 0) + (v ?? 0) * sign
}

/** Apply an instant beat (objective/reward) to the draft. Rewards pay once per save. */
function applyInstant(d: Draft, b: Beat, key: string, quiet = false) {
  if (b.type === 'objective') {
    for (const id of b.complete ?? []) {
      if (d.objectives[id] !== 'done' && !quiet) toast(d, 'OBJECTIVE COMPLETE', 'objective')
      d.objectives[id] = 'done'
    }
    for (const id of b.activate ?? []) if (d.objectives[id] !== 'done') d.objectives[id] = 'active'
  } else if (b.type === 'reward') {
    const flag = `reward:${key}`
    if (!d.flags[flag]) {
      d.flags[flag] = true
      applyEffects(d, b.effects, 1, quiet)
    }
  }
}

function persist(s: GameStore) {
  gameStateService.save({
    version: SAVE_VERSION,
    player: s.player,
    reputation: s.reputation,
    relationships: s.relationships,
    flags: s.flags,
    choices: s.choices,
    objectives: s.objectives,
    checkpoint: s.checkpoint,
    completedScenes: s.completedScenes,
    settings: s.settings,
  })
}

export const useGame = create<GameStore>()((set, get) => {
  /** Fade out, swap scene, then wait for the environment to report ready. */
  function transitionTo(id: SceneId, immediate = false) {
    set({ fading: true, aside: null })
    const go = () => {
      const scene = getScene(CHAPTER, id)
      const prevEnv = get().sceneId ? getScene(CHAPTER, get().sceneId).environment : null
      set({
        sceneId: id,
        beatIndex: -1,
        beatSeq: get().beatSeq + 1,
        stage: applyDirective(emptyStage(), scene.stage, true),
        loading: true,
        // a scene in the same environment doesn't remount it
        envReady: get().screen === 'game' && prevEnv === scene.environment ? get().envReady : null,
        checkpoint: id,
        explore: { visited: [], target: null },
        screen: 'game',
      })
      persist(get())
    }
    if (immediate) go()
    else setTimeout(go, TRANSITION_MS)
  }

  function completeScene() {
    const s = get()
    const scene = getScene(CHAPTER, s.sceneId)
    const completedScenes = s.completedScenes.includes(scene.id) ? s.completedScenes : [...s.completedScenes, scene.id]
    set({ completedScenes })
    persist(get())
    if (scene.next) transitionTo(scene.next)
  }

  /** Enter the first non-instant beat at or after index `i`. */
  function enter(i: number) {
    const s = get()
    const beats = beatsOf(s.sceneId, s.choices)
    const d = draftOf(s)
    while (i < beats.length) {
      const b = beats[i]
      if (b.type === 'branch') {
        i++ // unresolved branch (choice never made) — nothing to play
        continue
      }
      if (INSTANT_BEATS.includes(b.type)) {
        d.stage = applyDirective(d.stage, b.stage)
        applyInstant(d, b, `${s.sceneId}:${i}`)
        i++
        continue
      }
      break
    }
    if (i >= beats.length) {
      set({ ...d })
      completeScene()
      return
    }
    d.stage = applyDirective(d.stage, beats[i].stage)
    set({ ...d, beatIndex: i, beatSeq: s.beatSeq + 1 })
    if (beats[i].type === 'end') {
      const completedScenes = s.completedScenes.includes(s.sceneId) ? s.completedScenes : [...s.completedScenes, s.sceneId]
      set({ completedScenes })
    }
    persist(get())
  }

  const base = saved ?? freshSave()

  return {
    ...base,
    screen: 'title',
    sceneId: (base.checkpoint as SceneId) ?? 's01_return',
    beatIndex: -1,
    beatSeq: 0,
    stage: emptyStage(),
    fading: false,
    loading: false,
    envReady: null,
    aside: null,
    explore: { visited: [], target: null },
    toasts: [],
    settingsOpen: false,
    objectivesOpen: false,

    newGame() {
      set({ ...freshSave(get().settings), settingsOpen: false })
      transitionTo('s01_return', get().screen === 'title')
    },

    continueGame() {
      const id = (get().checkpoint as SceneId) ?? 's01_return'
      transitionTo(id, true)
    },

    replayScene(id) {
      // Rebuild chapter state as it stood when `id` began: objectives from
      // earlier scenes, and forget choices made in this scene or later.
      const target = getScene(CHAPTER, id)
      const s = get()
      const d = draftOf(s)
      d.objectives = initialObjectives()
      const choices = { ...s.choices }
      for (const sc of CHAPTER.scenes) {
        if (sc.index >= target.index) {
          for (const b of sc.beats) {
            if (b.type !== 'choice' || !choices[b.id]) continue
            // undo the standing effects of the answer being re-asked
            const prev = b.options.find((o) => o.id === choices[b.id])
            if (prev?.effects) applyEffects(d, { reputation: prev.effects.reputation, relationships: prev.effects.relationships }, -1, true)
            delete choices[b.id]
          }
          continue
        }
        beatsOf(sc.id, choices).forEach((b, i) => {
          if (b.type === 'objective') applyInstant(d, b, `${sc.id}:${i}`, true)
        })
      }
      set({ ...d, toasts: [], choices, settingsOpen: false })
      transitionTo(id, get().screen === 'title')
    },

    goTitle() {
      set({ fading: true, settingsOpen: false })
      setTimeout(() => set({ screen: 'title', fading: false, loading: false, beatIndex: -1, aside: null }), TRANSITION_MS)
    },

    resetProgress() {
      gameStateService.clear()
      set({ ...freshSave(get().settings), screen: 'title', settingsOpen: false, beatIndex: -1 })
    },

    beginScene() {
      set({ loading: false, fading: false })
      enter(0)
    },

    advance() {
      const s = get()
      if (s.loading || s.fading) return
      enter(s.beatIndex + 1)
    },

    skip() {
      const s = get()
      if (s.loading || s.fading) return
      const beats = beatsOf(s.sceneId, s.choices)
      const stop = findNextStop(beats, s.beatIndex + 1)
      const end = stop === -1 ? beats.length : stop
      const d = draftOf(s)
      for (let i = s.beatIndex + 1; i < end; i++) {
        const b = beats[i]
        d.stage = applyDirective(d.stage, b.stage, true)
        if (INSTANT_BEATS.includes(b.type)) applyInstant(d, b, `${s.sceneId}:${i}`)
      }
      if (stop === -1) {
        set({ ...d, aside: null })
        completeScene()
        return
      }
      d.stage = applyDirective(d.stage, beats[stop].stage, true)
      set({ ...d, beatIndex: stop, beatSeq: s.beatSeq + 1, aside: null })
    },

    choose(choiceId, optionId) {
      const s = get()
      const beat = beatsOf(s.sceneId, s.choices)[s.beatIndex]
      if (beat?.type !== 'choice' || beat.id !== choiceId) return
      const d = draftOf(s)
      const prev = beat.options.find((o) => o.id === s.choices[choiceId])
      if (prev?.effects) applyEffects(d, { reputation: prev.effects.reputation, relationships: prev.effects.relationships }, -1, true)
      const opt = beat.options.find((o) => o.id === optionId)
      if (opt?.effects) applyEffects(d, opt.effects)
      set({ ...d, choices: { ...s.choices, [choiceId]: optionId } })
      // re-expand so the branch for this choice is now part of the beat list
      enter(s.beatIndex + 1)
    },

    qteResult(ms) {
      const s = get()
      const d = draftOf(s)
      const grade = ms === null ? 'LATE' : ms < 550 ? 'PERFECT' : ms < 1100 ? 'GREAT' : 'GOOD'
      d.flags[`qte:${s.sceneId}:${s.beatIndex}`] = grade
      toast(d, grade, 'combat')
      // a slow reaction means you eat the hit
      if (ms === null) applyEffects(d, { health: -12 })
      set({ ...d })
      enter(s.beatIndex + 1)
    },

    walkTo(p) {
      const s = get()
      set({ stage: applyDirective(s.stage, { actors: { rookie: { pos: p, move: 'walk', speed: 2.1 } } }), explore: { ...s.explore, target: null } })
    },

    walkToHotspot(id) {
      const s = get()
      const beat = beatsOf(s.sceneId, s.choices)[s.beatIndex]
      if (beat?.type !== 'explore' || s.aside) return
      const h = beat.hotspots.find((x) => x.id === id)
      if (!h) return
      set({
        stage: applyDirective(s.stage, { actors: { rookie: { pos: h.stand ?? h.pos, move: 'walk', speed: 2.3, face: h.face } } }),
        explore: { ...s.explore, target: id },
      })
    },

    arriveHotspot(id) {
      const s = get()
      const beat = beatsOf(s.sceneId, s.choices)[s.beatIndex]
      if (beat?.type !== 'explore' || s.explore.target !== id) return
      const h = beat.hotspots.find((x) => x.id === id)!
      const visited = s.explore.visited.includes(id) ? s.explore.visited : [...s.explore.visited, id]
      set({ explore: { visited, target: null }, flags: { ...s.flags, [`seen:${id}`]: true } })
      if (h.lines?.length) {
        set({ aside: { lines: h.lines, index: 0, hotspot: h }, stage: applyDirective(get().stage, h.lines[0].stage) })
      } else if (h.ends) {
        get().advance()
      }
    },

    advanceAside() {
      const s = get()
      if (!s.aside) return
      const index = s.aside.index + 1
      if (index < s.aside.lines.length) {
        set({ aside: { ...s.aside, index }, stage: applyDirective(s.stage, s.aside.lines[index].stage) })
        return
      }
      const ends = s.aside.hotspot.ends
      set({ aside: null })
      if (ends) get().advance()
    },

    setEnvReady(env) {
      set({ envReady: env })
    },

    updateSettings(patch) {
      set({ settings: { ...get().settings, ...patch } })
      persist(get())
    },
    setSettingsOpen(v) {
      set({ settingsOpen: v })
    },
    setObjectivesOpen(v) {
      set({ objectivesOpen: v })
    },
    dismissToast(id) {
      set({ toasts: get().toasts.filter((t) => t.id !== id) })
    },
  }
})

// ── selectors ────────────────────────────────────────────────────────────
export const currentScene = (s: GameStore) => getScene(CHAPTER, s.sceneId)
export const currentBeat = (s: GameStore): Beat | undefined =>
  s.beatIndex < 0 ? undefined : beatsOf(s.sceneId, s.choices)[s.beatIndex]
export const hasSave = () => !!gameStateService.load()?.checkpoint
