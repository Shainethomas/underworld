import type { Light } from '@babylonjs/core/Lights/light'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight'
import { PointLight } from '@babylonjs/core/Lights/pointLight'
import { SpotLight } from '@babylonjs/core/Lights/spotLight'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight'
import { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent'
import { GlowLayer } from '@babylonjs/core/Layers/glowLayer'
import '@babylonjs/core/Layers/effectLayerSceneComponent'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Material } from '@babylonjs/core/Materials/material'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe'
import type { Scene } from '@babylonjs/core/scene'
import type { Quality } from './Renderer'
import { coneGradient } from './ProceduralTextures'

/** Kelvin-ish colour presets used across sets. */
export const WARM = new Color3(1, 0.78, 0.52)
export const TUNGSTEN = new Color3(1, 0.68, 0.38)
export const MOON = new Color3(0.55, 0.68, 1)

/**
 * Owns the lights of one environment and the shared lighting services:
 * shadow generator, glow layer, baked reflection probe. Everything it
 * creates is disposed with the environment.
 */
export class LightingManager {
  /**
   * False on the 'lite' tier (set by @render/Renderer): no shadow maps at all,
   * since a shadow map draws its casters again every frame and holds a
   * 1024² buffer. The stager puts blob shadows under the cast instead.
   */
  static shadowMaps = true
  /** Probe cube size on phones; the 'lite' tier halves it. */
  static phoneProbeSize = 128

  readonly lights: Light[] = []
  shadows: ShadowGenerator | null = null
  glow: GlowLayer | null = null
  private probe: ReflectionProbe | null = null
  private disposables: { dispose(): void }[] = []

  constructor(private scene: Scene, private quality: Quality) {}

  hemi(intensity: number, sky: Color3, ground: Color3): HemisphericLight {
    const l = new HemisphericLight('hemi', new Vector3(0, 1, 0), this.scene)
    l.intensity = intensity
    l.diffuse = sky
    l.groundColor = ground
    l.specular = Color3.Black()
    this.lights.push(l)
    return l
  }

  spot(name: string, pos: Vector3, dir: Vector3, angle: number, intensity: number, color: Color3, range = 18): SpotLight {
    const l = new SpotLight(name, pos, dir.normalize(), angle, 2, this.scene)
    l.intensity = intensity
    l.diffuse = color
    l.specular = color.scale(0.7)
    l.range = range
    l.radius = 0.35
    this.lights.push(l)
    return l
  }

  point(name: string, pos: Vector3, intensity: number, color: Color3, range = 8): PointLight {
    const l = new PointLight(name, pos, this.scene)
    l.intensity = intensity
    l.diffuse = color
    l.specular = color.scale(0.5)
    l.range = range
    l.radius = 0.18
    this.lights.push(l)
    return l
  }

  directional(name: string, dir: Vector3, intensity: number, color: Color3): DirectionalLight {
    const l = new DirectionalLight(name, dir.normalize(), this.scene)
    l.intensity = intensity
    l.diffuse = color
    l.specular = color.scale(0.45)
    this.lights.push(l)
    return l
  }

  /** One shadow-casting key light per environment keeps mobile affordable. None on the 'lite' tier. */
  enableShadows(light: SpotLight, mapSize?: number): ShadowGenerator | null {
    if (!LightingManager.shadowMaps) return null
    const size = mapSize ?? (this.quality === 'high' ? 2048 : 1024)
    const sg = new ShadowGenerator(size, light)
    sg.usePercentageCloserFiltering = true
    sg.filteringQuality = this.quality === 'high' ? ShadowGenerator.QUALITY_MEDIUM : ShadowGenerator.QUALITY_LOW
    sg.bias = 0.0006
    sg.normalBias = 0.025
    sg.darkness = 0.22
    light.shadowMinZ = 0.5
    light.shadowMaxZ = light.range
    this.shadows = sg
    return sg
  }

  /**
   * A set piece that casts a shadow. On phones ('low') only the cast casts:
   * shadowing the whole set drew most of it a second time every frame.
   */
  castShadow(...meshes: AbstractMesh[]): void {
    if (!this.shadows || this.quality === 'low') return
    for (const m of meshes) this.shadows.addShadowCaster(m, true)
  }

  /** A character (or what they carry): casts on every quality. */
  castActorShadow(...meshes: AbstractMesh[]): void {
    if (!this.shadows) return
    for (const m of meshes) this.shadows.addShadowCaster(m, false)
  }

  /** Emissive glow around lamps and screens; a whole extra pass, so not on phones (bloom still lifts them). */
  enableGlow(intensity = 0.45): GlowLayer | null {
    if (this.quality === 'low') return null
    const g = new GlowLayer('glow', this.scene, { mainTextureRatio: this.quality === 'high' ? 0.5 : 0.25, blurKernelSize: 32 })
    g.intensity = intensity
    this.glow = g
    return g
  }

  /** Fake volumetric shaft under a lamp: an additive cone that fades with distance. */
  lightCone(name: string, top: Vector3, height: number, bottomDiameter: number, color: Color3, alpha = 0.16): Mesh {
    const cone = CreateCylinder(name, { height, diameterTop: 0.25, diameterBottom: bottomDiameter, tessellation: 32, cap: 0 }, this.scene)
    cone.position = top.subtract(new Vector3(0, height / 2, 0))
    const mat = new StandardMaterial(`${name}_mat`, this.scene)
    const grad = coneGradient(this.scene)
    mat.emissiveTexture = grad
    mat.opacityTexture = grad
    mat.emissiveColor = color
    mat.disableLighting = true
    mat.alpha = alpha
    mat.alphaMode = 1 // ALPHA_ADD
    mat.backFaceCulling = false
    mat.disableDepthWrite = true
    mat.transparencyMode = Material.MATERIAL_ALPHABLEND
    cone.material = mat
    cone.isPickable = false
    this.glow?.addExcludedMesh(cone)
    this.disposables.push(grad)
    return cone
  }

  /**
   * Renders the set once into a cube map and uses it as the scene environment,
   * giving PBR materials (skin, leather, wet floors) believable ambient light
   * and reflections without a downloaded HDR.
   */
  bakeProbe(at: Vector3, meshes: AbstractMesh[], intensity = 0.9): void {
    // Capture linear HDR radiance, without baking the display grade into it.
    const probe = new ReflectionProbe('envProbe', this.quality === 'high' ? 256 : LightingManager.phoneProbeSize, this.scene, true, true, true)
    probe.position = at
    for (const m of meshes) probe.renderList?.push(m)
    probe.refreshRate = RenderTargetTexture.REFRESHRATE_RENDER_ONCE
    probe.cubeTexture.renderParticles = false
    // An unbound probe is not discovered through any material's render targets.
    this.scene.customRenderTargets.push(probe.cubeTexture)
    this.scene.environmentIntensity = intensity
    // Only sample the cube once it has been rendered: binding it while the probe
    // draws into it is a read/write hazard (WebGPU rejects the whole frame).
    // onAfterRender fires per cube face; wait for all six faces to be unbound.
    probe.cubeTexture.onBeforeBindObservable.add(() => {
      this.scene.environmentTexture = null
    })
    probe.cubeTexture.onAfterUnbindObservable.add(() => {
      this.scene.environmentTexture = probe.cubeTexture
    })
    this.probe = probe
  }

  /** Re-renders the baked probe once (after a set changes its time of day). */
  refreshProbe(): void {
    this.probe?.cubeTexture.resetRefreshCounter()
  }

  /** PBR materials default to 4 lights; sets here use a few more (plus the camera fill). */
  raiseLightLimit(materials: Material[], n = this.scene.lights.length): void {
    for (const m of materials) {
      // WebGPU allows 8 light uniform blocks per shader stage
      if (m instanceof PBRMaterial || m instanceof StandardMaterial) m.maxSimultaneousLights = Math.min(8, Math.max(4, n))
    }
  }

  dispose(): void {
    this.shadows?.dispose()
    this.glow?.dispose()
    if (this.probe) {
      if (this.scene.environmentTexture === this.probe.cubeTexture) this.scene.environmentTexture = null
      this.probe.dispose()
    }
    for (const l of this.lights) l.dispose()
    for (const d of this.disposables) d.dispose()
  }
}
