import type { AbstractEngine } from '@babylonjs/core/Engines/abstractEngine'
import { Engine } from '@babylonjs/core/Engines/engine'
import { WebGPUEngine } from '@babylonjs/core/Engines/webgpuEngine'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera'
import { ImageProcessingConfiguration } from '@babylonjs/core/Materials/imageProcessingConfiguration'
import { DefaultRenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/defaultRenderingPipeline'
import '@babylonjs/core/PostProcesses/RenderPipeline/postProcessRenderPipelineManagerSceneComponent'
import { DepthOfFieldEffectBlurLevel } from '@babylonjs/core/PostProcesses/depthOfFieldEffect'
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline'
import '@babylonjs/core/Rendering/geometryBufferRendererSceneComponent'
// the geometry buffer draws depth and normals in one pass (multiple render targets)
import '@babylonjs/core/Engines/Extensions/engine.multiRender'
import '@babylonjs/core/Engines/WebGPU/Extensions/engine.multiRender'
import { ColorCurves } from '@babylonjs/core/Materials/colorCurves'
import '@babylonjs/core/Rendering/depthRendererSceneComponent'
import { Scene } from '@babylonjs/core/scene'
import { resolveTier, type QualityPref, type Tier } from '../../platform/deviceTier'
import { LightingManager } from './LightingManager'
import type { EnvironmentId } from '../narrative/types'

/** Authored display grade: exposure, contrast, vignette weight.
 * All tiers use existing shader uniforms; no new passes, curves or LUTs.
 * These arrays are created once at module load, never in the render loop.
 */
const ENVIRONMENT_GRADES: Partial<Record<EnvironmentId, readonly [number, number, number]>> = {
  gym_ext: [1.18, 1.03, 0.9],
  gym: [1.18, 1.03, 1],
  room: [1.18, 1.02, 0.9],
  city: [1.15, 1.03, 0.85],
  docks: [1.15, 1.02, 0.95],
  estate: [1.2, 1.02, 0.95],
  yard: [1.15, 1.02, 0.95],
  mercer: [1.2, 1.02, 0.85],
}

export function applyEnvironmentGrade(scene: Scene, id: EnvironmentId): void {
  const ip = scene.imageProcessingConfiguration
  const grade = ENVIRONMENT_GRADES[id]
  // Unlisted sets restore the original grade rather than inheriting a prior set.
  ip.exposure = grade?.[0] ?? 1.15
  ip.contrast = grade?.[1] ?? 1.04
  ip.vignetteWeight = grade?.[2] ?? 1.25
}

export type Renderer = 'auto' | 'webgl2'
export type { QualityPref, Tier }
/** Asset and set detail: what the sets build (texture sizes, shadow casters, glow). 'low' on both phone tiers. */
export type Quality = 'high' | 'low'

export interface RenderContext {
  engine: AbstractEngine
  scene: Scene
  camera: FreeCamera
  pipeline: DefaultRenderingPipeline
  /** Contact shadows in corners, under furniture and where feet meet the floor ('high' only). */
  ssao: SSAO2RenderingPipeline | null
  quality: Quality
  tier: Tier
  backend: 'webgpu' | 'webgl2'
}

/**
 * Render pixels per CSS pixel for a tier: where it starts, and how far the
 * resolution scaler (engine/ResolutionScaler) may move it, by what the GPU
 * holds at 30 fps. On a ~2.8× phone screen 2× is as sharp as it's worth and
 * 1.25× the softest that still reads well; a mid-range Mali settles around
 * 1.25–1.5×, a faster phone climbs higher.
 */
export function resolutionRange(tier: Tier): { floor: number; start: number; ceiling: number } {
  const dpr = window.devicePixelRatio || 1
  const [floor, start, ceiling] = tier === 'high' ? [1.25, 2, 2] : tier === 'low' ? [1.25, 1.5, 2] : [1, 1.25, 1.25]
  const cap = (v: number) => Math.min(dpr, v)
  return { floor: cap(floor), start: cap(start), ceiling: cap(ceiling) }
}

export function resolveQuality(pref: QualityPref): Quality {
  return resolveTier(pref) === 'high' ? 'high' : 'low'
}

/** WebGL 2 is the baseline; WebGPU is used when the browser offers a working adapter. */
async function createEngine(canvas: HTMLCanvasElement, renderer: Renderer): Promise<[AbstractEngine, 'webgpu' | 'webgl2']> {
  if (renderer === 'auto' && 'gpu' in navigator) {
    try {
      if (await WebGPUEngine.IsSupportedAsync) {
        const gpu = new WebGPUEngine(canvas, { antialias: true, stencil: true, powerPreference: 'high-performance' })
        await gpu.initAsync()
        return [gpu, 'webgpu']
      }
    } catch (err) {
      console.warn('[underworld] WebGPU unavailable, falling back to WebGL 2', err)
    }
  }
  const gl = new Engine(canvas, true, { stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }, false)
  return [gl, 'webgl2']
}

export async function createRenderer(canvas: HTMLCanvasElement, renderer: Renderer, qualityPref: QualityPref): Promise<RenderContext> {
  const [engine, backend] = await createEngine(canvas, renderer)
  const tier = resolveTier(qualityPref)
  const quality = resolveQuality(qualityPref)
  const lite = tier === 'lite'
  LightingManager.shadowMaps = !lite
  LightingManager.phoneProbeSize = lite ? 64 : 128
  engine.setHardwareScalingLevel(1 / resolutionRange(tier).start)

  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.02, 0.02, 0.025, 1)
  scene.ambientColor = new Color3(0, 0, 0)
  scene.skipPointerMovePicking = true
  scene.autoClear = true

  const camera = new FreeCamera('camera', new Vector3(0, 1.6, -5), scene)
  camera.minZ = 0.05
  camera.maxZ = 220
  camera.fov = 0.8
  camera.inputs.clear()

  const ip = scene.imageProcessingConfiguration
  ip.toneMappingEnabled = true
  ip.toneMappingType = ImageProcessingConfiguration.TONEMAPPING_ACES
  // Keep shadow detail in the grade; shape contrast with the set lights.
  ip.exposure = 1.15
  ip.contrast = 1.04
  // A filmic split: warm, slightly richer highlights and midtones, shadows a
  // touch cooler and lifted so dark corners read as colour, not black. Runs in
  // the image-processing pass every tier already pays for.
  const curves = new ColorCurves()
  curves.globalSaturation = 8
  curves.highlightsHue = 35
  curves.highlightsDensity = 18
  curves.highlightsSaturation = 6
  curves.midtonesHue = 30
  curves.midtonesDensity = 10
  curves.shadowsHue = 215
  curves.shadowsDensity = 14
  curves.shadowsExposure = 12
  ip.colorCurves = curves
  ip.colorCurvesEnabled = true

  // Ambient occlusion grounds everything (feet on floors, furniture against
  // walls), but it's a depth/normal buffer and two full-screen passes: high
  // tier only, and the first effect the frame-rate governor drops.
  let ssao: SSAO2RenderingPipeline | null = null
  if (quality === 'high' && SSAO2RenderingPipeline.IsSupported) {
    ssao = new SSAO2RenderingPipeline('ssao', scene, { ssaoRatio: 0.5, blurRatio: 1 }, [camera], true)
    ssao.radius = 0.9
    ssao.totalStrength = 1.1
    ssao.base = 0.12
    ssao.samples = 16
    ssao.maxZ = 60
    ssao.minZAspect = 0.4
    ssao.expensiveBlur = true
  }

  const pipeline = new DefaultRenderingPipeline('post', true, scene, [camera])
  pipeline.samples = quality === 'high' ? 4 : 1
  pipeline.fxaaEnabled = true
  // Phones render well below their screen's resolution and the browser
  // stretches it to fit; FXAA softens it further. A light sharpen brings back
  // eyes, hair and fabric edges for almost nothing (a Mali-G68 lost ~2 fps).
  if (quality !== 'high') {
    pipeline.sharpenEnabled = true
    pipeline.sharpen.edgeAmount = 0.35
    pipeline.sharpen.colorAmount = 1
  }
  // lite: every full-screen pass costs fill rate and a screen-sized buffer
  pipeline.bloomEnabled = !lite
  pipeline.bloomThreshold = 1.1
  pipeline.bloomWeight = quality === 'high' ? 0.12 : 0.09
  pipeline.bloomKernel = quality === 'high' ? 48 : 32
  pipeline.bloomScale = 0.5
  pipeline.imageProcessingEnabled = true
  pipeline.imageProcessing.vignetteEnabled = true
  pipeline.imageProcessing.vignetteWeight = 1.25
  pipeline.imageProcessing.vignetteStretch = 0.4
  pipeline.imageProcessing.vignetteColor = new Color4(0, 0, 0, 0)
  pipeline.grainEnabled = !lite
  pipeline.grain.intensity = quality === 'high' ? 1.2 : 0.6
  pipeline.grain.animated = true
  pipeline.chromaticAberrationEnabled = false
  // Shallow depth of field on capable devices; the cinematic controller moves
  // the focus onto the subject of every shot.
  if (quality === 'high') {
    pipeline.depthOfFieldEnabled = true
    pipeline.depthOfFieldBlurLevel = DepthOfFieldEffectBlurLevel.Medium
    pipeline.depthOfField.focalLength = 55
    pipeline.depthOfField.fStop = 4
    pipeline.depthOfField.focusDistance = 3000
  }

  const resize = () => engine.resize()
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  scene.onDisposeObservable.addOnce(() => ro.disconnect())

  return { engine, scene, camera, pipeline, ssao, quality, tier, backend }
}
