import type { Quality } from '../game/persistence'

export interface QualityPreset {
  level: Exclude<Quality, 'auto'>
  dpr: [number, number]
  rainDrops: number
  bloom: boolean
  reflections: boolean
  antialias: boolean
}

export const PRESETS: Record<QualityPreset['level'], QualityPreset> = {
  low: { level: 'low', dpr: [0.75, 1], rainDrops: 1400, bloom: false, reflections: false, antialias: false },
  medium: { level: 'medium', dpr: [1, 1.5], rainDrops: 2600, bloom: true, reflections: false, antialias: false },
  high: { level: 'high', dpr: [1, 2], rainDrops: 4200, bloom: true, reflections: true, antialias: true },
}

export const isTouchDevice = () =>
  typeof window !== 'undefined' && (navigator.maxTouchPoints > 0 || 'ontouchstart' in window)

/** Pick a starting preset from coarse device signals; PerformanceMonitor refines it live. */
export function detectQuality(): QualityPreset['level'] {
  const cores = navigator.hardwareConcurrency ?? 4
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4
  if (isTouchDevice()) return cores >= 8 && mem >= 6 ? 'medium' : 'low'
  return cores >= 4 ? 'high' : 'medium'
}

export function resolveQuality(q: Quality, autoLevel: QualityPreset['level']): QualityPreset {
  return PRESETS[q === 'auto' ? autoLevel : q]
}

export interface GpuCaps {
  webgl2: boolean
  webgpu: boolean
  renderer: string
}

/**
 * Feature detection. The renderer is WebGL 2 today; WebGPU is reported so the
 * upgrade path (three/webgpu + TSL materials) can be enabled per device once
 * the post-processing stack and rain shader are ported.
 */
export async function detectGpu(): Promise<GpuCaps> {
  let webgl2 = false
  let renderer = 'unknown'
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    webgl2 = !!gl
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : 'WebGL 2'
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    /* no webgl */
  }
  let webgpu = false
  try {
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter(): Promise<unknown> } }).gpu
    webgpu = !!(gpu && (await gpu.requestAdapter()))
  } catch {
    /* no webgpu */
  }
  return { webgl2, webgpu, renderer }
}
