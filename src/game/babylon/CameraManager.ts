import type { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

/** A camera pose: where it is, what it looks at, vertical field of view. */
export interface CameraPose {
  pos: Vector3
  target: Vector3
  fov: number
}

/** Something that produces a pose every frame (static, dolly, or tracking an actor). */
export type PoseSource = (t: number) => CameraPose

const smooth = (x: number) => x * x * (3 - 2 * x)

function lerpPose(a: CameraPose, b: CameraPose, k: number): CameraPose {
  return {
    pos: Vector3.Lerp(a.pos, b.pos, k),
    target: Vector3.Lerp(a.target, b.target, k),
    fov: a.fov + (b.fov - a.fov) * k,
  }
}

/**
 * Drives the single scene camera. Shots are pose sources; switching shots
 * either cuts or blends from the pose at the moment of the switch. On top of
 * every shot sit a subtle handheld drift, an optional push-in and impulse shake.
 */
export class CameraManager {
  private source: PoseSource | null = null
  private from: CameraPose | null = null
  private blend = 0
  private blendT = 0
  private t = 0
  private push = 0
  private shakeAmp = 0
  private clock = 0
  private last: CameraPose
  /** Handheld drift amplitude in metres (0 for locked-off shots). */
  handheld = 0.012

  constructor(private camera: FreeCamera) {
    this.last = { pos: camera.position.clone(), target: new Vector3(0, 1.5, 0), fov: camera.fov }
  }

  setShot(source: PoseSource, opts: { blend?: number; push?: boolean; handheld?: number } = {}): void {
    const blend = opts.blend ?? 0
    this.from = blend > 0 ? { ...this.last, pos: this.last.pos.clone(), target: this.last.target.clone() } : null
    this.blend = blend
    this.blendT = 0
    this.t = 0
    this.source = source
    this.push = opts.push ? 1 : 0
    this.handheld = opts.handheld ?? 0.012
  }

  shake(amount: number): void {
    this.shakeAmp = Math.max(this.shakeAmp, amount)
  }

  get pose(): CameraPose {
    return this.last
  }

  update(dt: number): void {
    if (!this.source) return
    this.t += dt
    this.clock += dt
    let pose = this.source(this.t)
    if (this.push) {
      const k = Math.min(1, this.t / 9) * 0.14
      pose = { ...pose, pos: Vector3.Lerp(pose.pos, pose.target, smooth(k)) }
    }
    if (this.from && this.blendT < this.blend) {
      this.blendT += dt
      pose = lerpPose(this.from, pose, smooth(Math.min(1, this.blendT / this.blend)))
    }
    this.last = pose

    const c = this.clock
    const h = this.handheld
    const drift = new Vector3(Math.sin(c * 0.71) * h + Math.sin(c * 1.37) * h * 0.4, Math.sin(c * 0.53 + 1) * h * 0.7, Math.cos(c * 0.62) * h * 0.5)
    this.shakeAmp *= Math.exp(-dt * 7)
    const s = this.shakeAmp
    const shake = s > 0.0005 ? new Vector3((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s) : Vector3.Zero()

    this.camera.position.copyFrom(pose.pos).addInPlace(drift).addInPlace(shake)
    this.camera.setTarget(pose.target.add(drift.scale(0.6)).add(shake.scale(1.5)))
    this.camera.fov = pose.fov
  }
}

/** A static or dollying named shot. */
export interface NamedShot {
  pos: [number, number, number]
  target: [number, number, number]
  fov?: number
  /** Optional dolly end pose, reached over `duration` seconds. */
  to?: { pos: [number, number, number]; target: [number, number, number]; fov?: number }
  duration?: number
  handheld?: number
  /** Offsets added to the pose each frame: a camera riding along with something that moves (the car pulling in). */
  follow?: () => { pos: [number, number, number]; target: [number, number, number] }
}

export function namedShotSource(shot: NamedShot): PoseSource {
  const a: CameraPose = { pos: Vector3.FromArray(shot.pos), target: Vector3.FromArray(shot.target), fov: shot.fov ?? 0.8 }
  const b: CameraPose | null = shot.to ? { pos: Vector3.FromArray(shot.to.pos), target: Vector3.FromArray(shot.to.target), fov: shot.to.fov ?? a.fov } : null
  const d = shot.duration ?? 8
  const base: PoseSource = b ? (t) => lerpPose(a, b, smooth(Math.min(1, t / d))) : () => a
  const follow = shot.follow
  if (!follow) return base
  return (t) => {
    const p = base(t)
    const o = follow()
    return { pos: p.pos.add(Vector3.FromArray(o.pos)), target: p.target.add(Vector3.FromArray(o.target)), fov: p.fov }
  }
}
