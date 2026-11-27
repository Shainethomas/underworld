import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import type { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { Scene } from '@babylonjs/core/scene'
import type { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { radialSprite } from './ProceduralTextures'

/** Diameter of the soft shadow under a standing character (metres). */
const SIZE = 0.95
/** How dark the centre is (the gradient fades it out to the edge; the sets' floors are dark already). */
const DARKNESS = 0.85

/**
 * Soft dark discs under the characters, for devices without shadow maps (the
 * 'lite' tier). Mobile story games ground their characters this way: one
 * small transparent quad each instead of drawing every caster a second time.
 */
export class BlobShadows {
  private texture: DynamicTexture
  private material: StandardMaterial
  private blobs = new Map<string, Mesh>()

  constructor(private scene: Scene) {
    this.texture = radialSprite(scene, 'blob_shadow', 64, '0,0,0', 1.8)
    const m = new StandardMaterial('blob_shadow', scene)
    m.disableLighting = true
    m.diffuseColor = Color3.Black()
    m.emissiveColor = Color3.Black()
    m.specularColor = Color3.Black()
    m.opacityTexture = this.texture
    m.alpha = DARKNESS
    m.disableDepthWrite = true
    m.zOffset = -2
    m.fogEnabled = false
    this.material = m
  }

  /** Puts `key`'s blob under `position` (its feet), or hides it. Called every frame; allocates nothing after the first. */
  place(key: string, visible: boolean, position: Vector3): void {
    let blob = this.blobs.get(key)
    if (!blob) {
      blob = CreateGround(`blob:${key}`, { width: SIZE, height: SIZE }, this.scene)
      blob.material = this.material
      blob.isPickable = false
      this.blobs.set(key, blob)
    }
    if (blob.isEnabled() !== visible) blob.setEnabled(visible)
    if (visible) blob.position.set(position.x, position.y + 0.015, position.z)
  }

  /** Removes every blob (a new cast is coming). */
  clear(): void {
    for (const b of this.blobs.values()) b.dispose()
    this.blobs.clear()
  }

  dispose(): void {
    this.clear()
    this.material.dispose()
    this.texture.dispose()
  }
}
