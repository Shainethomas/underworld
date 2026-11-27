import type { ActionName, ActorDirective, Expression, FxName, Ground, PoseName, StageDirective } from './types'

// The stage is the declarative, serialisable state of a 3D scene: which shot
// the camera is on and where every actor is / what they are doing. Beats
// merge directives into it. Because it is cumulative state rather than a list
// of imperative animations, skipping ahead simply merges every skipped beat.

export interface ActorState {
  pos: Ground
  face: number | string
  pose: PoseName
  move: 'walk' | 'run' | 'slide'
  speed: number
  expr: Expression
  look: string | null
  visible: boolean
  prop: 'bag' | 'bat' | 'cash' | null
  action: { name: ActionName; id: number } | null
  /** changes when the actor must snap to its target (cuts, skips, scene loads) */
  snap: number
  /** seconds the actor waits before adopting this state */
  delay: number
}

export interface StageState {
  shot: string
  shotId: number
  cut: boolean
  actors: Record<string, ActorState>
  fx: { name: FxName; id: number; delay: number }[]
}

let seq = 1
const nextId = () => ++seq

export const emptyStage = (): StageState => ({ shot: '', shotId: 0, cut: true, actors: {}, fx: [] })

const defaultActor = (): ActorState => ({
  pos: [0, 0],
  face: 0,
  pose: 'idle',
  move: 'walk',
  speed: 1.5,
  expr: 'neutral',
  look: null,
  visible: true,
  prop: null,
  action: null,
  snap: 0,
  delay: 0,
})

function mergeActor(prev: ActorState | undefined, d: ActorDirective, snap: boolean): ActorState {
  const a: ActorState = { ...(prev ?? defaultActor()) }
  if (d.pos) a.pos = d.pos
  if (d.face !== undefined) a.face = d.face
  if (d.pose) a.pose = d.pose
  if (d.move) a.move = d.move
  else if (d.pos) a.move = 'walk'
  if (d.speed !== undefined) a.speed = d.speed
  else if (d.pos) a.speed = a.move === 'run' ? 3.6 : a.move === 'slide' ? 4 : 1.5
  if (d.expr) a.expr = d.expr
  if (d.look !== undefined) a.look = d.look
  if (d.visible !== undefined) a.visible = d.visible
  if (d.prop !== undefined) a.prop = d.prop
  if (d.action && !snap) a.action = { name: d.action, id: nextId() }
  a.delay = snap ? 0 : d.delay ?? 0
  if (snap || !prev) a.snap = nextId()
  return a
}

/** Merge a directive into stage state. `snap` = apply instantly (cut/skip). */
export function applyDirective(stage: StageState, d: StageDirective | undefined, snap = false): StageState {
  if (!d) return stage
  const next: StageState = { ...stage, actors: { ...stage.actors } }
  if (d.shot) {
    next.shot = d.shot
    next.shotId = nextId()
    next.cut = snap || !!d.cut
  }
  if (d.actors) {
    for (const [id, ad] of Object.entries(d.actors)) next.actors[id] = mergeActor(stage.actors[id], ad, snap)
  }
  if (d.fx && !snap) next.fx = [...stage.fx.slice(-6), ...d.fx.map((name) => ({ name, id: nextId(), delay: d.fxDelay ?? 0 }))]
  return next
}
