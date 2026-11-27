// Data model for scenes. Story content is pure data (see scenes/*Data.ts);
// the NarrativeEngine walks it, the GameEngine stages it in 3D.

export type ActorId =
  | 'rookie' | 'ravi' | 'don' | 'guard1' | 'guard2' | 'marco' | 'fighter1' | 'fighter2' | 'trainee1' | 'trainee2'
  | 'driver' | 'scientist' | 'sentry' | 'tech1' | 'tech2' | 'tech3' | 'victor' | 'lucas' | 'sal' | 'nico' | 'stranger' | 'local' | 'caller' | 'accomplice'
  // street work (src/story/contracts): the people a contract is with, renamed per contract
  | 'fence' | 'dealer' | 'kid' | 'widow' | 'heavy' | 'heavy2'
export type SpeakerId = 'rookie' | 'ravi' | 'lucas' | 'don' | 'victor' | 'guard1' | 'driver' | 'scientist' | 'sentry' | 'sal' | 'nico' | 'stranger' | 'local' | 'caller' | 'accomplice' | 'marco'
  | 'fence' | 'dealer' | 'kid' | 'widow' | 'heavy' | 'heavy2'
export type EnvironmentId = 'estate' | 'gym_ext' | 'gym' | 'room' | 'city' | 'facility' | 'lab' | 'past' | 'docks' | 'yard' | 'mercer' | 'office'

export type VarKey =
  | 'don_loyalty' | 'independence' | 'ravi_trust' | 'discipline' | 'timeline_knowledge' | 'don_ambition_knowledge' | 'scientist_trust'
  | 'experiment_commitment' | 'heat' | 'intel'
  // standing in the organisation (src/game/progression/Progression.ts)
  | 'cash' | 'respect' | 'varga'
export type Vars = Record<VarKey, number>
export type Effects = Partial<Record<VarKey, number>>
export type FlagValue = string | number | boolean

/** A narrative condition, evaluated against choices, variables and flags. */
export type Condition =
  | { choice: string; is: string | string[] }
  | { v: VarKey; gte?: number; lte?: number }
  | { flag: string; eq?: FlagValue; gte?: number }
  | { all: Condition[] }
  | { any: Condition[] }
  | { not: Condition }

// ── Staging ───────────────────────────────────────────────────────────────

/** A floor position [x, z], or a named mark defined by the environment. */
export type Place = string | [number, number]

/** Body-language keys, mapped to animation clips by CharacterExpressions. */
export type Gesture =
  | 'idle' | 'talk' | 'arms_crossed' | 'nod' | 'shake_head' | 'lean_rail' | 'call_out' | 'phone'
  | 'sit' | 'sit_talk' | 'sit_down' | 'stand_up' | 'drink' | 'interact' | 'kneel_work' | 'pick_up'
  | 'sleep' | 'wake' | 'palm'
  | 'jab' | 'cross' | 'hook' | 'hook_recover' | 'hit_head' | 'hit_chest' | 'knockback' | 'knocked_down' | 'get_up' | 'roll'
  | 'guard' | 'block' | 'duck'
  | 'stance' | 'point' | 'dismiss'

export interface ActorDirective {
  show?: boolean
  /** Teleport. */
  at?: Place
  /** Walk to a place (or through several). */
  walk?: Place | Place[]
  pace?: 'walk' | 'formal' | 'jog'
  /** Face an actor, a place, or a yaw in degrees (0 = +Z). */
  face?: ActorId | Place | number
  /** Looping gesture (also the pose held after a walk). */
  pose?: Gesture
  /** One-shot gesture, then back to `pose`. */
  play?: Gesture
  /** Garment toggles, e.g. { wraps: true, hoodie: false }. */
  outfit?: Record<string, boolean>
  /** Height offset (e.g. standing in the raised ring). With `walk`, the height he climbs to over the walk (stairs). */
  y?: number
  /** Background life: walk this loop forever (pausing at each point) until redirected. */
  patrol?: Place[]
  /** Background life: repeat these one-shot gestures (bag work, shadowboxing) until redirected. */
  routine?: Gesture[]
  /**
   * Turn the head toward an actor or a place while the body holds its pose
   * (a glance at the photo, a look at the window); `null` looks ahead again.
   * A mark's third value is the height looked at (default 1.5 m).
   */
  look?: ActorId | Place | null
  /**
   * Something in his hand: his gym bag (carried by the handles), his phone
   * (at his ear, with the `phone` pose), or a parcel, an envelope or a fold of
   * cash held in the right hand. `null` puts it down: the bag drops to the
   * floor beside him and stays there; anything else simply goes away (handed
   * over, pocketed).
   */
  carry?: Prop | null
}

/** Hand props the engine builds and keeps in an actor's hand. */
export type Prop = 'bag' | 'phone' | 'package' | 'envelope' | 'cash'

export type StageDirective = Partial<Record<ActorId, ActorDirective>>

/**
 * Camera shot. `cam` is either a named shot from the environment, or an
 * actor-relative shot:
 *   close:don          close-up on an actor
 *   medium:rookie      waist-up
 *   ots:rookie>don     over Rookie's shoulder onto the Don
 *   two:rookie,ravi    both in frame
 *   follow:rookie      third-person follow (explore beats)
 *   track:don          steadicam behind and beside a walking actor
 *   lead:rookie        camera backing away in front of a walking actor
 *   low:don            low-angle hero shot looking up at an actor
 *
 * Any shot can carry a camera move that plays over `duration` seconds.
 */
export interface Shot {
  cam: string
  /** Seconds to blend from the previous camera; 0 cuts. */
  blend?: number
  /** Slow push-in over the shot. */
  push?: boolean
  /** Which side of the line of action (1 / -1). */
  side?: 1 | -1
  /** Orbit around the subject, in degrees, over the shot. */
  arc?: number
  /** Rise (+) or descend (−), in metres, over the shot. */
  crane?: number
  /** Move toward (+) or away from (−) the subject, in metres, over the shot. */
  dolly?: number
  /** Seconds the move takes (default 7). */
  duration?: number
}

export type SfxId =
  | 'thunder' | 'punch_1' | 'punch_2' | 'punch_3' | 'punch_big' | 'chain' | 'tape' | 'body_fall'
  | 'door_open' | 'door_close' | 'footsteps' | 'light_clack' | 'whoosh' | 'ui_tap' | 'ui_choice'
  | 'stat_up' | 'impact_hit'
  | 'engine' | 'car_pass' | 'scan' | 'access' | 'denied' | 'airlock' | 'barrier' | 'spinup' | 'pulse' | 'spindown'
  | 'phone_buzz' | 'phone_hangup' | 'knock' | 'lamp_click'
  | 'beep' | 'warp' | 'beacon' | 'reappear'
export type MusicId = 'theme' | 'tension' | 'resolve' | 'drive' | 'chronos' | 'past'
export type AmbienceId = 'rain' | 'gym' | 'car' | 'bunker' | 'lab' | 'room' | 'street'

/** One timed event inside a beat. */
export interface TimelineEvent {
  at: number
  sfx?: SfxId
  /** Environment event name (see each environment's `event`). */
  env?: string
  shake?: number
  flash?: boolean
  stage?: StageDirective
  shot?: Shot
  /** Slow motion for this many (real) seconds. */
  slowmo?: number
  /** Full-screen effect: a temporal distortion, a white-out, a slow drain of all sound, or a fade to black that holds until the next scene. */
  fx?: 'distort' | 'whiteout' | 'silence' | 'blackout'
}

export interface Cue {
  /** `null` stops the current track. */
  music?: MusicId | null
  ambience?: AmbienceId | null
  sfx?: SfxId
  /** Environment events fired when the beat starts. */
  env?: string[]
  timeline?: TimelineEvent[]
  /** Seconds the music and ambience changes take (default ~1.5). */
  fade?: number
}

// ── Beats ─────────────────────────────────────────────────────────────────

interface BeatBase {
  id: string
  when?: Condition
  /** Environment this beat plays in; inherited from earlier beats. */
  env?: EnvironmentId
  shot?: Shot
  stage?: StageDirective
  cue?: Cue
  /** Cinematic beats hide the HUD and can be skipped. */
  cinematic?: boolean
  /** Shows the lab's measured elapsed time (seconds) in a small badge. */
  elapsed?: number
  /** A small contextual label on the scene panel (e.g. TRAINING MATCH during the fight). */
  tag?: string
}

export interface TitleBeat extends BeatBase {
  type: 'title'
  chapter: string
  /** A line between the chapter and the title (e.g. "Scene 01"). */
  scene?: string
  title: string
  subtitle?: string
}

export interface LineBeat extends BeatBase {
  type: 'line'
  speaker: SpeakerId
  text: string
  /** Speaker gesture while the line plays (defaults to 'talk'). */
  gesture?: Gesture
  /** Optional voice-over file. */
  voice?: string
  /** An unspoken thought: shown in italics, and the speaker doesn't move his lips or hands. */
  thought?: boolean
}

export interface CaptionBeat extends BeatBase {
  type: 'caption'
  text: string
  label?: string
  /** Auto-advance after this many seconds; otherwise waits for a tap. */
  hold?: number
}

/** A purely visual beat that advances on its own. */
export interface ShotBeat extends BeatBase {
  type: 'shot'
  hold: number
  caption?: { text: string; label?: string }
}

export type IconName =
  | 'crown' | 'bolt' | 'dots' | 'fist' | 'scales' | 'chevron' | 'menu' | 'cash' | 'gem'
  | 'plus' | 'target' | 'skip' | 'close' | 'brain' | 'eye' | 'hand' | 'door' | 'chat' | 'lock'
  | 'warning' | 'atom' | 'hourglass'

export interface ChoiceOption {
  id: string
  text: string
  icon?: IconName
  effects?: Effects
  /** Line Rookie speaks after choosing. Defaults to `text`; `false` for silent choices. */
  say?: string | false
  /** Rookie's gesture while saying it. */
  gesture?: Gesture
  /** Offered only while this holds (e.g. questions not yet asked). */
  when?: Condition
  /** Flags set when picked (e.g. marking a question as asked). */
  sets?: Record<string, FlagValue>
  /**
   * Shown but not pickable, with the reason ("Needs $300"): the Ink tags the
   * option `#need:<variable>:<amount>` and the story runtime checks it.
   */
  locked?: string
}

export interface ChoiceBeat extends BeatBase {
  type: 'choice'
  /** Key the selected option is stored under. */
  choiceId: string
  /** 'dialogue' renders under a dialogue panel; 'card' under a narration card. */
  style: 'dialogue' | 'card'
  context: { speaker?: SpeakerId; label?: string; text: string }
  options: ChoiceOption[]
  /** The shot Rookie says his picked line in (his close-up); the choice's own shot otherwise. */
  echoShot?: Shot
}

export interface Hotspot {
  id: string
  label: string
  icon?: IconName
  /** Where the marker floats. */
  at: Place
  /** Where Rookie stands to interact (defaults near `at`). */
  stand?: Place
  /** What Rookie faces on arrival (defaults to `at`). */
  face?: ActorId | Place
  /** Marker height above the floor. */
  height?: number
  /** Short aside played on arrival. */
  lines?: { speaker: SpeakerId; text: string; gesture?: Gesture }[]
  /** Reaching this hotspot completes the explore beat. */
  ends?: boolean
  /** Flags set on arrival (what the player chose to look at). */
  sets?: Record<string, FlagValue>
}

/** Tap-to-walk exploration around the environment. */
export interface ExploreBeat extends BeatBase {
  type: 'explore'
  prompt: string
  hotspots: Hotspot[]
  /** Actors that trail Rookie while he walks. */
  followers?: ActorId[]
  /** Explore camera heading in degrees (0 looks toward +Z); defaults to the environment's. */
  cameraYaw?: number
  /** Walkable area for this beat, when it isn't the environment's usual one. */
  bounds?: { minX: number; maxX: number; minZ: number; maxZ: number }
  /** Flag that records which hotspot the player visited first. */
  firstVisit?: string
}

/** A short contextual skill moment, not a combat system. */
export interface QteBeat extends BeatBase {
  type: 'qte'
  /** timing: tap when the ring closes; mash: tap fast before time runs out; hold: press and hold. */
  mode: 'timing' | 'mash' | 'hold'
  label: string
  hint: string
  /** timing: number of prompts; mash: taps needed; hold: unused. */
  count: number
  /** timing: ms per prompt; mash/hold: total ms. */
  window: number
  /**
   * timing: events that start with each prompt, so the attack lands as the
   * ring closes (it meets the target at 85% of the window); cycles through the list.
   */
  onPrompt?: TimelineEvent[][]
  /** Event sequence played on each success (timing/mash) or on completion (hold); cycles through the list. */
  onHit: TimelineEvent[][]
  onMiss?: TimelineEvent[][]
  /** Flag receiving the result (0..1). */
  result: string
}

export interface VideoBeat extends BeatBase {
  type: 'video'
  src: string
  poster?: string
}

/** An incoming phone call: the call screen over the scene, with an Answer button. */
export interface CallBeat extends BeatBase {
  type: 'call'
  /** Who is calling, as the screen shows it (e.g. "Ravi"). */
  caller: string
  /** The line under the name (e.g. "Mobile phone • Evening"). */
  detail: string
}

/**
 * Rookie at the wheel, seen from behind the car: hold the screen to drive,
 * let go to coast. The road leads to `destination` and the beat ends when the
 * car pulls up at it.
 */
export interface DriveBeat extends BeatBase {
  type: 'drive'
  /** What to do, under the readout (e.g. "Drive to Pier Nine."). */
  prompt: string
  /** Where the road leads: on the gate at the end and in the readout. */
  destination: string
  /** Metres of road to cover. */
  distance: number
}

/** A text message arriving on his phone: the message card over the scene, then Next. */
export interface MessageBeat extends BeatBase {
  type: 'message'
  /** Who sent it, as the phone shows it (e.g. "Lucas"). */
  sender: string
  text: string
}

/**
 * A job's briefing card over the scene: who it's for, the pay, the risk and
 * what to do. Written `>>> job id [Job name] Client ¦ Pay ¦ Risk ¦ Objective`
 * (Ink keeps `|` for itself).
 */
export interface JobBeat extends BeatBase {
  type: 'job'
  name: string
  client: string
  pay: string
  risk: string
  objective: string
}

export interface GotoBeat extends BeatBase {
  type: 'goto'
  target: string
}

export interface CompleteBeat extends BeatBase {
  type: 'complete'
}

export type Beat =
  | TitleBeat | LineBeat | CaptionBeat | ShotBeat | ChoiceBeat | ExploreBeat | QteBeat
  | VideoBeat | CallBeat | MessageBeat | DriveBeat | JobBeat | GotoBeat | CompleteBeat

/** A scene as the game loads it: its Ink story and the staging for each beat id. */
export interface SceneData extends SceneMeta {
  /** Compiled Ink (src/story/sceneNN.ink): the words, the choices and the branching. */
  story: object
  /** Per beat id, how it is staged (src/story/sceneNN.staging.json). Words live in the Ink. */
  staging: Record<string, Beat>
}

/** What a scene is, apart from its story: where it plays, who is in it, what comes next. */
export interface SceneMeta {
  id: string
  index: number
  chapter: { number: number; title: string }
  title: string
  /** Environments in order of first use; the first is preloaded. */
  environments: EnvironmentId[]
  /** Cast spawned for the scene, keyed to CharacterAssets definitions. */
  cast: ActorId[]
  /** Variables summarised on the completion screen. */
  summary: VarKey[]
  /**
   * The highest rank this scene's debrief can promote to (Progression.RANKS
   * id). Some promotions are the story's: Associate comes from Victor himself
   * at the end of Scene 04, however much Respect Rookie has before that.
   */
  rankCap?: number
  next?: {
    id: string
    title: string
    /** The job the debrief offers next: what it pays and how dangerous it is. */
    job?: { name: string; pay: string; risk: string; pitch: string }
  }
  /** Clothes carried over from earlier scenes (e.g. the jacket he chose in Scene 02). */
  outfits?: { when: Condition; actor: ActorId; outfit: Record<string, boolean> }[]
  /** 'contract' for street work from the job board (src/game/board); story scenes leave it out. */
  kind?: 'story' | 'contract'
  /** Ink speaker tokens this scene adds (CONTACT, HEAVY → the actor playing them). */
  speakers?: Record<string, SpeakerId>
  /** Display names that replace the defaults for this scene (a contract's contact is "Dez", not "Fence"). */
  names?: Partial<Record<SpeakerId, string>>
}
