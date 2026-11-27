import { Matrix, Quaternion, Vector3 } from '@render/core'
import type { AnimationGroup, TransformNode } from '@render/core'
import type { ActorId, Gesture, Prop } from '../narrative/types'
import type { CharacterRig } from './CharacterAssets'
import { gestureFor, LOCOMOTION, paceSpeed } from './CharacterExpressions'

const FADE = 0.28
const TURN_SPEED = 7
// A held look turns the head only so far; past that a person would turn their body.
const LOOK_YAW_MAX = 1.0
const LOOK_PITCH_MAX = 0.45
const LOOK_RATE = 3.2

function wrapAngle(a: number): number {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}

export type Pace = keyof typeof LOCOMOTION

/**
 * A character on stage: owns its rig, crossfades animation clips by weight,
 * walks along waypoint paths and turns smoothly. Yaw 0 faces +Z.
 */
export class Actor {
  pose: Gesture = 'idle'
  private carried: Prop | null = null
  yaw = 0
  private targetYaw = 0
  private active: AnimationGroup | null = null
  private fading = new Map<AnimationGroup, number>()
  private path: Vector3[] = []
  private pace: Pace = 'walk'
  private onArrive: (() => void) | null = null
  /** A walk that changes height (stairs): start and end height over the path's length. */
  private climb: { from: number; to: number; length: number; travelled: number } | null = null
  private oneShotEnd: (() => void) | null = null
  private baseY = 0
  /** True while a one-shot gesture (punch, sit down…) is playing. */
  busy = false
  /** A nod or head shake in progress, layered over the body animation. */
  private headMove: { kind: 'nod' | 'shake'; t: number } | null = null
  private headBone: TransformNode | null = null
  private headRest: Quaternion | null = null
  private phonePoint = new Vector3()
  private phoneNormal = new Vector3()
  private phoneUp = new Vector3()
  /** Where the head is held turned toward (world point), and the current turn. */
  private lookTarget: Vector3 | null = null
  private look = { yaw: 0, pitch: 0 }

  constructor(readonly id: ActorId, readonly rig: CharacterRig) {
    this.headBone = rig.bones.get('Head') ?? null
    if (this.headBone) {
      this.headBone.computeWorldMatrix(true)
      const inverse = this.headBone.getWorldMatrix().clone().invert()
      const point = this.headBone.getAbsolutePosition().add(new Vector3(.108, .017, .035))
      Vector3.TransformCoordinatesToRef(point, inverse, this.phonePoint)
      Vector3.TransformNormalToRef(new Vector3(-1, 0, 0), inverse, this.phoneNormal)
      Vector3.TransformNormalToRef(new Vector3(0, 1, -.12), inverse, this.phoneUp)
    }
    this.play('idle')
  }

  get position(): Vector3 {
    return this.rig.root.position
  }

  get walking(): boolean {
    return this.path.length > 0
  }

  get visible(): boolean {
    return this.rig.root.isEnabled()
  }

  setVisible(on: boolean): void {
    this.rig.root.setEnabled(on)
  }

  setHeight(y: number): void {
    this.baseY = y
    this.rig.root.position.y = y
  }

  place(x: number, z: number): void {
    this.path = []
    this.onArrive = null
    this.climb = null
    this.rig.root.position.set(x, this.baseY, z)
  }

  faceYaw(yaw: number, instant = false): void {
    this.targetYaw = yaw
    if (instant) this.yaw = yaw
  }

  facePoint(x: number, z: number, instant = false): void {
    const p = this.position
    if (Math.hypot(x - p.x, z - p.z) < 1e-3) return
    this.faceYaw(Math.atan2(x - p.x, z - p.z), instant)
  }

  /** Cached-output attachment queries: no transient vectors in prop updates. */
  boneToRef(name: string, result: Vector3): boolean {
    const b = this.rig.bones.get(name)
    if (!b) return false
    b.computeWorldMatrix(true)
    result.copyFrom(b.getAbsolutePosition())
    return true
  }

  phoneAttachmentToRef(point: Vector3, normal: Vector3, up: Vector3): boolean {
    if (!this.headBone) return false
    this.headBone.computeWorldMatrix(true)
    const world = this.headBone.getWorldMatrix()
    Vector3.TransformCoordinatesToRef(this.phonePoint, world, point)
    Vector3.TransformNormalToRef(this.phoneNormal, world, normal)
    Vector3.TransformNormalToRef(this.phoneUp, world, up)
    normal.normalize()
    up.normalize()
    return true
  }

  setCarried(kind: Prop | null): void {
    if (this.carried === kind) return
    this.carried = kind
    if (this.walking) {
      const base = LOCOMOTION[this.pace].clip
      const clip = kind === 'bag' && this.rig.clips.has('Carry_Walk_Loop') ? 'Carry_Walk_Loop' : base
      this.crossfade(this.rig.clips.has(clip) ? clip : LOCOMOTION.walk.clip, true, 1)
    } else this.play(this.pose)
  }

  /** World position of the head bone (for framing and look-ats). */
  head(): Vector3 {
    const b = this.rig.bones.get('Head')
    if (!b) return this.position.add(new Vector3(0, 1.65, 0))
    b.computeWorldMatrix(true)
    return b.getAbsolutePosition().clone()
  }

  /** World-space position of any bone, e.g. 'hand_r' for impact effects. */
  bone(name: string): Vector3 | null {
    const b = this.rig.bones.get(name)
    if (!b) return null
    b.computeWorldMatrix(true)
    return b.getAbsolutePosition().clone()
  }

  forward(): Vector3 {
    return new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
  }

  /** With `snap` the pose is on at once (a cut), instead of crossfading in. */
  setPose(g: Gesture, snap = false): void {
    this.pose = g
    if (this.walking) return
    this.play(g)
    if (snap) this.settle()
  }

  /** Ends any crossfade in progress: the active clip at full weight, the rest stopped. */
  private settle(): void {
    if (!this.active) return
    for (const [g] of this.fading) {
      g.weight = 0
      g.stop()
    }
    this.fading.clear()
    this.active.weight = 1
  }

  /** Plays a gesture; one-shots settle back into the current pose (or their `then`). */
  play(g: Gesture, onDone?: () => void): void {
    const def = gestureFor(this.id, g)
    if (def?.head) {
      // the body carries on; only the head moves
      this.headMove = { kind: def.head, t: 0 }
      onDone?.()
      return
    }
    if (!def?.clip || !this.rig.clips.has(def.clip)) {
      // not something this actor does (or a model without the clip): hold the
      // current pose; a one-shot goes straight on to what follows it
      if (def && !def.loop && def.then !== 'hold') {
        const next = def.then ?? this.pose
        if (def.then && gestureFor(this.id, def.then)?.loop) this.pose = def.then
        if (next !== g) this.play(next)
      }
      onDone?.()
      return
    }
    const clip = this.carried === 'bag' && (g === 'idle' || g === 'talk') && this.rig.clips.has('Carry_Idle_Loop') ? 'Carry_Idle_Loop' : def.clip
    this.crossfade(clip, def.loop, def.speed ?? 1, def.range)
    this.oneShotEnd = null
    this.busy = !def.loop
    if (!def.loop) {
      const group = this.rig.clips.get(def.clip)
      const done = () => {
        if (this.active !== group) return
        this.busy = false
        if (def.then === 'hold') {
          if (group) this.freeze(group, def.range?.[1] ?? 1)
        } else {
          const next = def.then ?? this.pose
          if (def.then && gestureFor(this.id, def.then)?.loop) this.pose = def.then
          this.play(next)
        }
        onDone?.()
      }
      this.oneShotEnd = done
      group?.onAnimationGroupEndObservable.addOnce(() => this.oneShotEnd === done && done())
    }
  }

  /** Walks the path; with `toHeight` the height changes evenly over the walk (up or down stairs). */
  /**
   * Jump straight to a held gesture's last pose (knocked down), with no fade:
   * used when the world is rebuilt instantly on resume or skip.
   */
  holdPose(g: Gesture): void {
    const def = gestureFor(this.id, g)
    const group = def?.clip ? this.rig.clips.get(def.clip) : undefined
    if (!group) return
    for (const other of this.rig.clips.values())
      if (other !== group) {
        other.stop()
        other.weight = 0
      }
    this.fading.clear()
    this.oneShotEnd = null
    this.busy = false
    this.freeze(group, def?.range?.[1] ?? 1)
  }

  /**
   * Holds a clip on one frame by looping that single frame at full weight. A
   * paused or ended clip stops contributing to the blend, so anything fading
   * in over it would mix with the bind pose (a T-pose flash).
   */
  private freeze(group: AnimationGroup, at: number): void {
    const frame = group.from + (group.to - group.from) * at
    group.stop()
    group.start(true, 1, Math.max(group.from, frame - 1), frame, false)
    group.weight = 1
    this.fading.delete(group)
    this.active = group
  }

  walk(points: Vector3[], pace: Pace = 'walk', onArrive?: () => void, toHeight?: number): void {
    this.path = points.map((p) => new Vector3(p.x, this.baseY, p.z))
    this.pace = pace
    this.onArrive = onArrive ?? null
    this.climb = null
    if (toHeight !== undefined && Math.abs(toHeight - this.baseY) > 1e-3) {
      let length = 0
      let from = this.position
      for (const p of this.path) {
        length += Math.hypot(p.x - from.x, p.z - from.z)
        from = p
      }
      this.climb = { from: this.baseY, to: toHeight, length: Math.max(length, 1e-3), travelled: 0 }
    }
    if (this.path.length) {
      // a model with only a walk walks at every pace
      const clip = this.carried === 'bag' && this.rig.clips.has('Carry_Walk_Loop') ? 'Carry_Walk_Loop' : LOCOMOTION[pace].clip
      this.crossfade(this.rig.clips.has(clip) ? clip : LOCOMOTION.walk.clip, true, 1)
    }
  }

  stop(): void {
    this.path = []
    this.play(this.pose)
  }

  private crossfade(clip: string, loop: boolean, speed: number, range?: [number, number]): void {
    const next = this.rig.clips.get(clip)
    if (!next) return
    if (this.active === next && next.isPlaying && loop) {
      next.speedRatio = speed
      return
    }
    if (this.active && this.active !== next) this.fading.set(this.active, this.active.weight)
    this.fading.delete(next)
    next.stop()
    // a range plays part of the clip; the group keeps its full extent for later use
    const span = next.to - next.from
    const [a, b] = range ?? [0, 1]
    next.start(loop, speed, next.from + span * a, Math.max(next.from + span * b, next.from + span * a + 1), false)
    next.weight = this.active ? 0 : 1
    this.active = next
  }

  update(dt: number): void {
    // Weighted crossfade
    if (this.active && this.active.weight < 1) this.active.weight = Math.min(1, this.active.weight + dt / FADE)
    for (const [g, w] of this.fading) {
      const nw = w - dt / FADE
      if (nw <= 0) {
        g.weight = 0
        g.stop()
        this.fading.delete(g)
      } else {
        g.weight = nw
        this.fading.set(g, nw)
      }
    }

    // Path following
    if (this.path.length) {
      const target = this.path[0]
      const p = this.rig.root.position
      const dx = target.x - p.x
      const dz = target.z - p.z
      const dist = Math.hypot(dx, dz)
      const speed = paceSpeed(this.id, this.pace)
      if (dist < 0.05) {
        this.path.shift()
        if (!this.path.length) {
          p.x = target.x
          p.z = target.z
          if (this.climb) this.setHeight(this.climb.to)
          this.climb = null
          this.play(this.pose)
          const cb = this.onArrive
          this.onArrive = null
          cb?.()
        }
      } else {
        this.targetYaw = Math.atan2(dx, dz)
        // ease into the stop on the last leg
        const slow = this.path.length === 1 ? Math.min(1, 0.35 + dist / 0.6) : 1
        const step = Math.min(dist, speed * slow * dt)
        p.x += (dx / dist) * step
        p.z += (dz / dist) * step
        if (this.climb) {
          const c = this.climb
          c.travelled += step
          this.setHeight(c.from + (c.to - c.from) * Math.min(1, c.travelled / c.length))
        }
      }
    }

    // Turning
    const d = wrapAngle(this.targetYaw - this.yaw)
    this.yaw = wrapAngle(this.yaw + Math.sign(d) * Math.min(Math.abs(d), TURN_SPEED * dt))
    this.rig.root.rotation.y = this.yaw
  }

  /** Turn the head toward a world point and hold it there; `null` eases back to looking ahead. */
  lookAt(point: Vector3 | null, instant = false): void {
    this.lookTarget = point
    if (instant) {
      const t = this.lookAngles()
      this.look.yaw = t.yaw
      this.look.pitch = t.pitch
    }
  }

  private lookAngles(): { yaw: number; pitch: number } {
    const t = this.lookTarget
    if (!t) return { yaw: 0, pitch: 0 }
    const h = this.head()
    const yaw = wrapAngle(Math.atan2(t.x - h.x, t.z - h.z) - this.yaw)
    const pitch = Math.atan2(t.y - h.y, Math.hypot(t.x - h.x, t.z - h.z))
    const clamp = (v: number, m: number) => Math.max(-m, Math.min(m, v))
    return { yaw: clamp(yaw, LOOK_YAW_MAX), pitch: clamp(pitch, LOOK_PITCH_MAX) }
  }

  /** Undo last frame's head offset before animations run (a paused clip won't overwrite it). */
  restoreHead(): void {
    if (this.headRest && this.headBone?.rotationQuaternion) this.headBone.rotationQuaternion.copyFrom(this.headRest)
    this.headRest = null
  }

  /** Layer the held look, nod or head shake on top of the animated head, after animations run. */
  applyHead(dt: number): void {
    const bone = this.headBone
    if (!bone?.rotationQuaternion) return
    // ease the held look toward its target (or back to centre)
    const want = this.lookAngles()
    const k = Math.min(1, dt * LOOK_RATE)
    this.look.yaw += (want.yaw - this.look.yaw) * k
    this.look.pitch += (want.pitch - this.look.pitch) * k
    const looking = Math.abs(this.look.yaw) > 1e-3 || Math.abs(this.look.pitch) > 1e-3

    let yaw = this.look.yaw
    let pitch = this.look.pitch
    const m = this.headMove
    if (m) {
      m.t += dt
      const dur = m.kind === 'nod' ? 0.9 : 1.1
      if (m.t >= dur) this.headMove = null
      else {
        const env = Math.sin((Math.PI * m.t) / dur)
        // a nod is two dips of the chin; a shake is two small turns either way
        if (m.kind === 'nod') pitch -= 0.22 * env * Math.max(0, Math.sin((m.t / dur) * Math.PI * 4))
        else yaw += 0.2 * env * Math.sin((m.t / dur) * Math.PI * 4)
      }
    }
    if (!looking && !m) return
    this.headRest = bone.rotationQuaternion.clone()
    this.turnHead(bone, yaw, pitch)
  }

  /**
   * Turns the head by a yaw and pitch relative to where the body faces, in
   * world space: bone axes differ between rigs (the kit and the Mixamo
   * models), so the turn is built from directions and carried into the
   * bone's own frame through its parent.
   */
  private turnHead(bone: TransformNode, yaw: number, pitch: number): void {
    const from = new Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw))
    const to = new Vector3(Math.sin(this.yaw + yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(this.yaw + yaw) * Math.cos(pitch))
    const delta = new Quaternion()
    Quaternion.FromUnitVectorsToRef(from, to, delta)
    const local = Matrix.Identity()
    bone.rotationQuaternion!.toRotationMatrix(local)
    const parent = bone.parent as TransformNode | null
    const turn = Matrix.Identity()
    delta.toRotationMatrix(turn)
    let result: Matrix
    if (parent) {
      // The parent's whole linear transform, not getRotationMatrix(): imported
      // rigs carry a handedness mirror, which rotation extraction folds into a
      // flipped axis. Character scale is uniform, so it cancels out below.
      parent.computeWorldMatrix(true)
      const parentM = parent.getWorldMatrix().clone()
      parentM.setTranslationFromFloats(0, 0, 0)
      // world = local · parent; the turned world is world · turn
      result = local.multiply(parentM).multiply(turn).multiply(Matrix.Invert(parentM))
    } else result = local.multiply(turn)
    Quaternion.FromRotationMatrixToRef(result, bone.rotationQuaternion!)
  }

  dispose(): void {
    this.rig.dispose()
  }
}
