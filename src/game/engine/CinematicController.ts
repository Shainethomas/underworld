import { Vector3 } from '@render/core'
import type { AbstractEngine } from '@render/core'
import type { CameraManager, CameraPose, PoseSource } from '@render/CameraManager'
import { namedShotSource } from '@render/CameraManager'
import type { GameEnvironment } from '../sets/types'
import type { Actor } from '../characters/CharacterPresentation'
import type { ActorId, Shot } from '../narrative/types'

const UP = new Vector3(0, 1, 0)
const flat = (v: Vector3) => {
  const f = new Vector3(v.x, 0, v.z)
  return f.lengthSquared() > 1e-6 ? f.normalize() : new Vector3(0, 0, 1)
}
const rightOf = (dir: Vector3) => new Vector3(dir.z, 0, -dir.x)
const smooth = (x: number) => x * x * (3 - 2 * x)

/** Where the lens focuses and how shallow the depth of field is. */
export type FocusHandler = (distance: number, fStop: number) => void

/** Aperture per shot kind: tight shots get a shallow, filmic depth of field. */
const APERTURE: Record<string, number> = { close: 1.6, ots: 1.8, low: 2.2, medium: 2.4, lead: 2.4, two: 3.2, track: 4, follow: 11 }

/**
 * Turns shot directives into camera pose sources. Actor-relative shots
 * (close-up, over-the-shoulder, two-shot, tracking, low angle, follow) track
 * the actors live with damping, so walking or gesturing characters stay
 * framed. Any shot can add a camera move (arc, crane, dolly), and the focus
 * distance follows the subject for depth of field.
 */
export class CinematicController {
  current: Shot | null = null
  /** Heading override for the follow camera during an explore beat (degrees). */
  followYaw: number | null = null

  constructor(
    private cam: CameraManager,
    private engine: AbstractEngine,
    private actors: Map<ActorId, Actor>,
    private env: () => GameEnvironment | null,
    private focus: FocusHandler = () => undefined,
  ) {}

  set(shot: Shot): void {
    const base = this.source(shot)
    if (!base) return
    this.current = shot
    const named = this.env()?.shots[shot.cam]
    const kind = named ? 'named' : shot.cam.split(':')[0]
    const fStop = APERTURE[kind] ?? 6
    const moved = withMove(base, shot)
    const source: PoseSource = (t) => {
      const pose = moved(t)
      this.focus(Vector3.Distance(pose.pos, pose.target), fStop)
      return pose
    }
    this.cam.setShot(source, { blend: shot.blend ?? 0, push: shot.push, handheld: named?.handheld ?? (kind === 'track' || kind === 'lead' ? 0.006 : 0) })
  }

  shake(amount: number): void {
    this.cam.shake(amount)
  }

  private actor(id: string): Actor | undefined {
    return this.actors.get(id as ActorId)
  }

  private source(shot: Shot): PoseSource | null {
    const env = this.env()
    const named = env?.shots[shot.cam]
    if (named) return namedShotSource(named)
    const [kind, arg = ''] = shot.cam.split(':')
    const side = shot.side ?? 1
    const box: BoxFor = env?.cameraBoxAt ?? env?.cameraBox
    const aspect = () => this.engine.getRenderWidth() / Math.max(1, this.engine.getRenderHeight())

    switch (kind) {
      case 'close':
      case 'medium': {
        const a = this.actor(arg)
        if (!a) break
        const close = kind === 'close'
        return damped(() => {
          const h = a.head()
          const f = a.forward()
          const r = rightOf(f)
          // Leave room for hair, shoulders and gestures in the portrait frame.
          const dist = close ? 1.65 : 2.5
          return {
            pos: h.add(f.scale(dist)).add(r.scale(side * (close ? 0.3 : 0.5))).add(UP.scale(close ? 0.03 : -0.12)),
            target: h.add(UP.scale(close ? -0.13 : -0.35)),
            fov: close ? 0.6 : 0.68,
          }
        }, 6, box)
      }
      case 'low': {
        const a = this.actor(arg)
        if (!a) break
        return damped(() => {
          const h = a.head()
          const f = a.forward()
          const p = a.position
          return {
            pos: p.add(f.scale(2.1)).add(rightOf(f).scale(side * 0.75)).add(UP.scale(0.38)),
            target: h.add(UP.scale(-0.05)),
            fov: 0.78,
          }
        }, 5, box)
      }
      case 'ots': {
        const [fromId, toId] = arg.split('>')
        const a = this.actor(fromId)
        const b = this.actor(toId)
        if (!a || !b) break
        return damped(() => {
          const ha = a.head()
          const hb = b.head()
          const dir = flat(hb.subtract(ha))
          const r = rightOf(dir)
          return {
            pos: ha.subtract(dir.scale(0.78)).add(r.scale(side * 0.42)).add(UP.scale(0.1)),
            target: hb.add(UP.scale(-0.07)),
            fov: 0.56,
          }
        }, 6, box)
      }
      case 'two': {
        const [ida, idb] = arg.split(',')
        const a = this.actor(ida)
        const b = this.actor(idb)
        if (!a || !b) break
        return damped(() => {
          const ha = a.head()
          const hb = b.head()
          const mid = ha.add(hb).scale(0.5)
          const dir = flat(hb.subtract(ha))
          const fov = 0.72
          const halfH = Math.atan(Math.tan(fov / 2) * Math.max(0.3, aspect()))
          const span = Vector3.Distance(new Vector3(ha.x, 0, ha.z), new Vector3(hb.x, 0, hb.z)) / 2 + 0.55
          const dist = Math.max(2.2, span / Math.tan(halfH))
          return {
            pos: mid.add(rightOf(dir).scale(side * dist)).add(UP.scale(-0.05)),
            target: mid.add(UP.scale(-0.22)),
            fov,
          }
        }, 6, box)
      }
      case 'track':
      case 'lead': {
        const a = this.actor(arg)
        if (!a) break
        const lead = kind === 'lead'
        return damped(() => {
          const p = a.position
          const f = a.forward()
          const r = rightOf(f)
          return lead
            ? { pos: p.add(f.scale(2.7)).add(r.scale(side * 0.55)).add(UP.scale(1.55)), target: a.head().add(UP.scale(-0.3)), fov: 0.62 }
            : { pos: p.subtract(f.scale(2.3)).add(r.scale(side * 0.95)).add(UP.scale(1.75)), target: p.add(f.scale(2.6)).add(UP.scale(1.15)), fov: 0.78 }
        }, 2.8, box)
      }
      case 'follow': {
        const a = this.actor(arg)
        if (!a) break
        const yaw = this.followYaw !== null ? (this.followYaw * Math.PI) / 180 : (env?.followYaw ?? 0)
        const back = new Vector3(-Math.sin(yaw), 0, -Math.cos(yaw))
        const fwd = back.scale(-1)
        return damped(() => {
          const p = a.position
          return {
            pos: p.add(back.scale(4.6)).add(UP.scale(3.4)),
            target: p.add(fwd.scale(1.8)).add(UP.scale(0.9)),
            fov: 0.9,
          }
        }, 3.5, box)
      }
    }
    console.warn(`[cinematic] cannot resolve shot "${shot.cam}"`)
    return null
  }
}

/** Layers the shot's camera move (orbit, crane, dolly) on top of its framing. */
function withMove(source: PoseSource, shot: Shot): PoseSource {
  if (!shot.arc && !shot.crane && !shot.dolly) return source
  const duration = shot.duration ?? 7
  return (t) => {
    const pose = source(t)
    const k = smooth(Math.min(1, t / duration))
    let pos = pose.pos.clone()
    const target = pose.target.clone()
    if (shot.arc) {
      const a = ((shot.arc * Math.PI) / 180) * k
      const off = pos.subtract(target)
      const c = Math.cos(a)
      const s = Math.sin(a)
      pos = target.add(new Vector3(off.x * c - off.z * s, off.y, off.x * s + off.z * c))
    }
    if (shot.crane) {
      pos.y += shot.crane * k
      target.y += shot.crane * k * 0.35
    }
    if (shot.dolly) {
      const dir = target.subtract(pos)
      const len = dir.length()
      pos.addInPlace(dir.scale(Math.min(shot.dolly * k, len - 0.4) / Math.max(len, 1e-3)))
    }
    return { pos, target, fov: pose.fov }
  }
}

/**
 * Wraps a live pose function with exponential smoothing (starts exactly on
 * target), keeping the camera inside `box` when the set has walls.
 */
type Box = NonNullable<GameEnvironment['cameraBox']>
type BoxFor = Box | ((target: Vector3) => Box) | undefined

function damped(fn: () => CameraPose, rate = 6, boxFor?: BoxFor): PoseSource {
  let last: CameraPose | null = null
  let lastT = 0
  return (t) => {
    const want = fn()
    const box = typeof boxFor === 'function' ? boxFor(want.target) : boxFor
    if (box) want.pos = Vector3.Clamp(want.pos, Vector3.FromArray(box.min), Vector3.FromArray(box.max))
    if (!last) {
      last = want
      lastT = t
      return want
    }
    const k = 1 - Math.exp(-(t - lastT) * rate)
    lastT = t
    last = {
      pos: Vector3.Lerp(last.pos, want.pos, k),
      target: Vector3.Lerp(last.target, want.target, k),
      fov: last.fov + (want.fov - last.fov) * k,
    }
    return last
  }
}
