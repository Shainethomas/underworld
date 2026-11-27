import type { ActorId, Gesture } from '../narrative/types'

// Body-language "expressions": each gesture maps to a clip in the animation
// library (public/assets/models/animations.glb, built from the CC0 Quaternius
// Universal Animation Libraries). The CC0 heads have no facial rig, so
// emotion is carried by posture, gesture and camera framing. Nods and head
// shakes are small procedural head movements layered over whatever the body
// is doing, rather than full-body clips.

export interface GestureDef {
  /** Animation clip; omitted for head-only gestures. */
  clip?: string
  loop: boolean
  speed?: number
  /** For one-shots: what to settle into afterwards. `hold` freezes the last frame. */
  then?: Gesture | 'hold'
  /** Play only this part of the clip (fractions of its length), e.g. to freeze its first pose. */
  range?: [number, number]
  /** A head movement layered over the current pose. */
  head?: 'nod' | 'shake'
}

export const GESTURES: Record<Gesture, GestureDef> = {
  idle: { clip: 'Idle_Loop', loop: true },
  talk: { clip: 'Idle_Talking_Loop', loop: true, speed: 0.9 },
  arms_crossed: { clip: 'Idle_FoldArms_Loop', loop: true },
  nod: { loop: false, head: 'nod' },
  shake_head: { loop: false, head: 'shake' },
  lean_rail: { clip: 'Idle_Rail_Loop', loop: true },
  call_out: { clip: 'Idle_Rail_Call', loop: false, then: 'lean_rail' },
  phone: { clip: 'Idle_TalkingPhone_Loop', loop: true },
  sit: { clip: 'Sitting_Idle_Loop', loop: true },
  sit_talk: { clip: 'Sitting_Talking_Loop', loop: true },
  sit_down: { clip: 'Sitting_Enter', loop: false, then: 'sit' },
  stand_up: { clip: 'Sitting_Exit', loop: false, then: 'idle' },
  drink: { clip: 'Consume', loop: false },
  interact: { clip: 'Interact', loop: false },
  kneel_work: { clip: 'Fixing_Kneeling', loop: true },
  pick_up: { clip: 'PickUp_Table', loop: false },
  // flat on his back: the first pose of the get-up clip, held
  // (looped over its first frames so it blends in fully and stays put)
  sleep: { clip: 'LayToIdle', loop: true, range: [0, 0.004] },
  wake: { clip: 'LayToIdle', loop: false, speed: 0.85, then: 'idle' },
  // open palm held forward at chest height (the palm scanner)
  palm: { clip: 'Spell_Simple_Idle_Loop', loop: true },
  jab: { clip: 'Punch_Jab', loop: false, speed: 1.15 },
  cross: { clip: 'Punch_Cross', loop: false, speed: 1.15 },
  hook: { clip: 'Melee_Hook', loop: false, then: 'hook_recover' },
  hook_recover: { clip: 'Melee_Hook_Rec', loop: false },
  hit_head: { clip: 'Hit_Head', loop: false },
  hit_chest: { clip: 'Hit_Chest', loop: false },
  knockback: { clip: 'Hit_Knockback', loop: false },
  knocked_down: { clip: 'Death01', loop: false, then: 'hold' },
  get_up: { clip: 'LayToIdle', loop: false, then: 'idle' },
  roll: { clip: 'Roll', loop: false },
  // fight stance: hands up at the chin, the jab clip's first frame held
  guard: { clip: 'Punch_Jab', loop: true, range: [0, 0.004] },
  // covering up as a punch lands on the guard: the start of the chest-hit recoil, short and contained
  block: { clip: 'Hit_Chest', loop: false, speed: 0.75, range: [0, 0.55] },
  // slipping under a hook: a quick dip toward the crouch, then back up
  duck: { clip: 'Crouch_Idle_Loop', loop: false, speed: 0.22, range: [0, 0.06] },
  // Victor's own (ACTOR_GESTURES): nobody else has a clip for these, so
  // anyone else keeps their current pose
  stance: { loop: true },
  point: { loop: false },
  dismiss: { loop: false },
}

export const LOCOMOTION = {
  walk: { clip: 'Walk_Loop', speed: 1.3 },
  formal: { clip: 'Walk_Formal_Loop', speed: 1.05 },
  jog: { clip: 'Jog_Fwd_Loop', speed: 2.9 },
} as const

/** Every gesture with a clip except these, mapped to null: an actor who does only these. */
const only = (...keep: Gesture[]): Partial<Record<Gesture, null>> =>
  Object.fromEntries((Object.keys(GESTURES) as Gesture[]).filter((g) => GESTURES[g].clip && !keep.includes(g)).map((g) => [g, null]))

/**
 * Per-actor changes to GESTURES, for a complete model whose clips were made
 * for it (Rookie's and the Don's are Mixamo downloads: scripts/blender/build_character.py).
 * `null` means the gesture isn't in that actor's repertoire: playing it keeps
 * the current pose, and a one-shot goes straight on to its `then`.
 */
const ACTOR_GESTURES: Partial<Record<ActorId, Partial<Record<Gesture, GestureDef | null>>>> = {
  rookie: {
    guard: { clip: 'Guard_Loop', loop: true },
    block: { clip: 'Block', loop: false },
    duck: { clip: 'Duck', loop: false },
    palm: { clip: 'Palm_Loop', loop: true },
    sit_talk: { clip: 'Sitting_Idle_Loop', loop: true },
    // his own clips (Roddy, November 2026): folding his arms, sitting down, picking something up;
    // lying in bed (sleep, wake) is the library's, retargeted onto him
    lean_rail: null,
    call_out: null,
    stand_up: null,
    drink: null,
    kneel_work: null,
    knockback: null,
    knocked_down: null,
    get_up: null,
    roll: null,
  },
  // stands, talks, folds his arms and walks; nods and head shakes are procedural
  don: only('idle', 'talk', 'arms_crossed'),
  // Victor Sable, the boss: his own Mixamo clips (art-source/victor/). He
  // watches with his hands clasped behind his back (`stance`), points, waves
  // someone off (`dismiss`), takes calls, sits; his walk is a swagger
  victor: {
    ...only('idle', 'talk', 'phone', 'sit', 'sit_down'),
    sit_talk: { clip: 'Sitting_Idle_Loop', loop: true },
    stance: { clip: 'Stance_Loop', loop: true },
    point: { clip: 'Point', loop: false },
    dismiss: { clip: 'Dismiss', loop: false },
  },
  // Lucas, Rookie's friend in Scene 01: his own idle, talk and walk, leaning
  // on the ring rail from the clip library (retargeted onto him), and he
  // cheers the fight from the rail by clapping. He doesn't fold his arms
  lucas: {
    ...only('idle', 'talk', 'lean_rail'),
    call_out: { clip: 'Clapping', loop: false, then: 'lean_rail' },
  },
}

/** Per-actor walking speeds (m/s), where a character's own walk is slower than LOCOMOTION's. */
const ACTOR_PACE: Partial<Record<ActorId, Partial<Record<keyof typeof LOCOMOTION, number>>>> = {
  // a heavy man's walk: his clip is retimed to this (build_character.py), and his formal walk is the same
  don: { walk: 1.05, formal: 1.05 },
  // the swagger, retimed the same way
  victor: { walk: 0.95, formal: 0.95 },
}

/** How fast this actor covers ground at this pace. */
export function paceSpeed(id: ActorId, pace: keyof typeof LOCOMOTION): number {
  return ACTOR_PACE[id]?.[pace] ?? LOCOMOTION[pace].speed
}

/** How this actor performs a gesture; null if it isn't in their repertoire. */
export function gestureFor(id: ActorId, g: Gesture): GestureDef | null {
  const own = ACTOR_GESTURES[id]
  return own && g in own ? own[g]! : GESTURES[g]
}

/** Every clip the game needs retargeted onto each actor. */
export const ALL_CLIPS = [
  'Carry_Idle_Loop', 'Carry_Walk_Loop',
  ...new Set([
    ...[GESTURES, ...Object.values(ACTOR_GESTURES)].flatMap((set) => Object.values(set).flatMap((g) => (g?.clip ? [g.clip] : []))),
    ...Object.values(LOCOMOTION).map((l) => l.clip),
  ]),
]

/** The clips this actor's gestures play, plus the walk (other paces fall back to it). */
export function clipsFor(id: ActorId): string[] {
  const gestures = (Object.keys(GESTURES) as Gesture[]).map((g) => gestureFor(id, g)?.clip)
  const paces = ACTOR_GESTURES[id] ? [LOCOMOTION.walk.clip] : Object.values(LOCOMOTION).map((l) => l.clip)
  return [...new Set([...(id === 'rookie' ? ['Carry_Idle_Loop', 'Carry_Walk_Loop'] : []), ...gestures.filter((c): c is string => Boolean(c)), ...paces])]
}

/**
 * How each character carries a line when the script doesn't ask for a
 * gesture: a rotation, so nobody explains with their hands on every line.
 * `idle` means "keep the current pose" (arms stay crossed, the phone stays up).
 */
export const SPEAKING: Partial<Record<ActorId, Gesture[]>> = {
  rookie: ['idle', 'talk', 'idle', 'idle'],
  don: ['idle', 'talk', 'arms_crossed', 'idle'],
  victor: ['idle', 'talk', 'stance', 'idle'],
  scientist: ['talk', 'idle', 'idle', 'talk', 'arms_crossed'],
  ravi: ['talk', 'arms_crossed', 'idle'],
  lucas: ['talk', 'idle'],
  guard1: ['idle'],
  sal: ['idle', 'talk', 'arms_crossed', 'idle'],
  nico: ['talk', 'idle', 'talk'],
  stranger: ['idle', 'idle', 'talk'],
}
export const SPEAKING_DEFAULT: Gesture[] = ['idle', 'talk']
