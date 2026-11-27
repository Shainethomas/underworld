import type * as THREE from 'three'

// Live world-space data the camera and other actors need every frame
// (actors move continuously; the store only holds their targets).

export interface ActorRuntime {
  root: THREE.Object3D
  head: THREE.Object3D
  /** world position of the head, refreshed each frame */
  headPos: THREE.Vector3
  /** world position of the chest, refreshed each frame */
  chestPos: THREE.Vector3
  moving: boolean
}

export const actors = new Map<string, ActorRuntime>()

/** Camera shake impulses (added by FX, decayed by the camera director). */
export const shake = { amount: 0 }
