import type { AbstractMesh, Material, Scene, Vector3 } from '@render/core'
import type { SfxId } from '../narrative/types'
import type { Quality } from '@render/Renderer'
import type { NamedShot } from '@render/CameraManager'
import type { LightingManager } from '@render/LightingManager'

/** Axis-aligned floor rectangle actors walk around: [minX, minZ, maxX, maxZ]. */
export type Obstacle = [number, number, number, number]

export interface EnvContext {
  scene: Scene
  quality: Quality
  /** Lets the set play sounds for its own events (thunder, chains). */
  sfx: (id: SfxId) => void
}

export interface GameEnvironment {
  readonly id: string
  /** Named floor positions; [x, z] or [x, z, y]. */
  marks: Record<string, [number, number] | [number, number, number]>
  shots: Record<string, NamedShot>
  /** Walkable rectangle for exploration. */
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
  obstacles: Obstacle[]
  /** Yaw of the third-person explore camera. */
  followYaw: number
  /** Actor-relative cameras are kept inside this box (rooms have walls). */
  cameraBox?: { min: [number, number, number]; max: [number, number, number] }
  /** A box chosen by what the camera looks at, for sets with distinct areas (deck and pit). */
  cameraBoxAt?: (target: Vector3) => { min: [number, number, number]; max: [number, number, number] }
  lighting: LightingManager
  /** Meshes tap-to-walk may land on. */
  walkable: AbstractMesh[]
  /** A set the player drives through (the city): see DriveBeat. */
  drive?: DriveControl
  /** Fires a scripted event (doors, lights, bag hits). `instant` jumps to the end state. */
  event(name: string, instant?: boolean): void
  update(dt: number, time: number): void
  /** Hook for actors joining the set (shadows, light limits). */
  adopt(meshes: AbstractMesh[], materials: Material[]): void
  dispose(): void
}

/** The car under the player's control: hold to drive to a destination. */
export interface DriveControl {
  /** A new trip: the car waits at a standstill, `distance` metres short of `destination`. */
  start(destination: string, distance: number): void
  /** Foot on (holding the screen) or off. */
  throttle(on: boolean): void
  /** Metres still to go, speed in m/s, and whether the car has pulled up there. */
  state(): { left: number; speed: number; arrived: boolean }
  /** The trip is over (the set goes back to its scripted cruise). */
  stop(): void
}

export type EnvironmentFactory = (ctx: EnvContext) => Promise<GameEnvironment>
