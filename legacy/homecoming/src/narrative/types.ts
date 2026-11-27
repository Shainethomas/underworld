// Data model for the narrative system. Scenes are plain data: an ordered list
// of beats. The runner (runner.ts) walks beats, the stage (3D) reacts to
// declarative directives, and the UI renders whichever beat is active.

export type SceneId = 's01_return' | 's02_street' | 's03_docks' | 's04_confrontation' | 's05_recognition'
export type EnvironmentId = 'highway' | 'street' | 'dockyard'
export type SpeakerId = 'narrator' | 'rookie' | 'maddog' | 'shopkeeper' | 'biker'

export type PoseName =
  | 'idle' | 'idleTense' | 'handsPocket' | 'armsCrossed' | 'guard' | 'sitBike' | 'lean'
  | 'point' | 'collect' | 'cower' | 'grabHold' | 'pinned' | 'slammed' | 'lookUp' | 'shrug'
  | 'warmHands' | 'raiseHand' | 'ride'

export type ActionName =
  | 'push' | 'stumble' | 'punch' | 'hitReact' | 'haymaker' | 'duck' | 'shove' | 'struggle'
  | 'flinch' | 'release' | 'nod' | 'stepBack' | 'laugh'

export type Expression = 'neutral' | 'angry' | 'surprised' | 'smirk' | 'pained' | 'stern'

/** Vec2 on the ground plane: [x, z] */
export type Ground = [number, number]

export interface ActorDirective {
  pos?: Ground
  /** world yaw in radians, or the id of an actor to face */
  face?: number | string
  pose?: PoseName
  /** walk = gait animation, run = faster gait, slide = root motion without gait (knockback) */
  move?: 'walk' | 'run' | 'slide'
  speed?: number
  action?: ActionName
  expr?: Expression
  /** actor id to turn the head toward; null clears */
  look?: string | null
  visible?: boolean
  prop?: 'bag' | 'bat' | 'cash' | null
  /** seconds to wait before this directive takes effect (choreography) */
  delay?: number
}

export type FxName = 'impact' | 'shake' | 'flash' | 'thunder' | 'bikesPass' | 'clang' | 'rev' | 'heartbeat'

export interface StageDirective {
  shot?: string
  /** hard cut instead of a camera move */
  cut?: boolean
  actors?: Record<string, ActorDirective>
  fx?: FxName[]
  fxDelay?: number
}

export interface Caption { at: number; dur: number; speaker: SpeakerId; text: string }

export interface Hotspot {
  id: string
  label: string
  /** button text in the story panel */
  action?: string
  pos: Ground
  /** where the protagonist stands to interact; defaults to pos */
  stand?: Ground
  face?: number | string
  lines?: Line[]
  /** finishing this hotspot ends the explore beat */
  ends?: boolean
  icon?: 'eye' | 'talk' | 'walk'
}

export interface Line { speaker: SpeakerId; text: string; stage?: StageDirective }

export interface Effects {
  xp?: number
  cash?: number
  gold?: number
  health?: number
  reputation?: Partial<Record<ReputationKey, number>>
  relationships?: Partial<Record<string, number>>
}
export type ReputationKey = 'respect' | 'fear' | 'ambition'

export interface ChoiceOption {
  id: string
  text: string
  tag: string
  effects?: Effects
}

interface BeatBase {
  stage?: StageDirective
  /** prose narration shown in the story panel while this beat plays */
  text?: string
}

export type Beat =
  | (BeatBase & { type: 'line'; speaker: SpeakerId; text: string })
  | (BeatBase & { type: 'hold'; duration: number })
  | (BeatBase & { type: 'title'; kicker: string; title: string; duration: number })
  | (BeatBase & { type: 'video'; src: string; poster?: string; captions?: Caption[]; rain?: boolean })
  | (BeatBase & { type: 'explore'; prompt: string; hotspots: Hotspot[] })
  | (BeatBase & { type: 'qte'; label: string; hint: string; window: number })
  | (BeatBase & { type: 'choice'; id: string; prompt: string; options: ChoiceOption[] })
  | (BeatBase & { type: 'branch'; choice: string; cases: Record<string, Beat[]> })
  | (BeatBase & { type: 'objective'; complete?: string[]; activate?: string[] })
  | (BeatBase & { type: 'reward'; effects: Effects; reason: string })
  | (BeatBase & { type: 'end' })

export type BeatType = Beat['type']

export interface SceneDef {
  id: SceneId
  index: number
  title: string
  subtitle: string
  environment: EnvironmentId
  /** stage state applied (as a cut) before the first beat */
  stage: StageDirective
  beats: Beat[]
  next?: SceneId
  /** videos to warm up while this scene plays */
  preload?: string[]
}

export interface ObjectiveDef { id: string; text: string; scene: SceneId }

export interface ChapterDef {
  id: string
  number: number
  title: string
  scenes: SceneDef[]
  objectives: ObjectiveDef[]
}
