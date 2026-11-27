import { SceneInstrumentation } from '@render/core'
import type { AbstractEngine, Scene } from '@render/core'

// On-screen performance readout for testing on real phones. Open the game
// with `?perf` (works alongside `?test`). Plain DOM, no framework, so it
// costs nothing when off and survives any UI rewrite.
//
// Budgets are the Lite-mode targets for Android 7–8 phones: 150 draw calls
// and a steady 30 fps. Green = within budget, amber = close, red = over.

export const DRAW_CALL_BUDGET = 150

export interface PerfStats {
  set: string
  fps: number
  /** Average and worst frame interval in the last sample window (ms). */
  frameMs: number
  worstMs: number
  /** Main-thread time spent in game logic and in scene.render() (ms, average). */
  logicMs: number
  renderMs: number
  drawCalls: number
  activeMeshes: number
  textures: number
  textureMB: number
  /** Chrome/Android WebView only; -1 elsewhere. */
  heapMB: number
  resolution: string
  scaling: number
  backend: string
  quality: string
  /** The frame rate the governor is holding, and the display's refresh rate. */
  targetFps: number
  refreshHz: number
  /** True when locked with `?fps=`. */
  locked: boolean
  /** Rough hint only: which side is holding the frame rate back. */
  bound: 'cpu' | 'gpu' | 'ok'
}

const WINDOW_MS = 500

export const perfRequested = (): boolean => new URLSearchParams(location.search).has('perf')

export class PerfOverlay {
  stats: PerfStats | null = null
  private el: HTMLDivElement
  private inst: SceneInstrumentation
  private windowStart = performance.now()
  private last = performance.now()
  private frames = 0
  private sumGap = 0
  private worst = 0
  private sumLogic = 0
  private sumRender = 0
  private sumDraws = 0

  constructor(
    private engine: AbstractEngine,
    private scene: Scene,
    private info: () => { set: string; backend: string; quality: string; targetFps: number; refreshHz: number; locked: boolean },
  ) {
    this.inst = new SceneInstrumentation(scene)
    this.el = document.createElement('div')
    this.el.setAttribute('aria-hidden', 'true')
    Object.assign(this.el.style, {
      position: 'fixed',
      top: 'calc(env(safe-area-inset-top, 0px) + 4px)',
      left: '4px',
      zIndex: '9999',
      padding: '4px 6px',
      background: 'rgba(0,0,0,0.72)',
      color: '#ddd',
      font: '11px/1.35 ui-monospace, Menlo, Consolas, monospace',
      whiteSpace: 'pre',
      borderRadius: '4px',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>)
    document.body.appendChild(this.el)
  }

  /** Call once per frame with the time spent in game logic and in rendering. */
  frame(logicMs: number, renderMs: number): void {
    const now = performance.now()
    const gap = now - this.last
    this.last = now
    this.frames++
    this.sumGap += gap
    if (gap > this.worst) this.worst = gap
    this.sumLogic += logicMs
    this.sumRender += renderMs
    this.sumDraws += this.inst.drawCallsCounter.current
    if (now - this.windowStart >= WINDOW_MS) this.flush(now)
  }

  private flush(now: number): void {
    const n = this.frames || 1
    const frameMs = this.sumGap / n
    const cpuMs = (this.sumLogic + this.sumRender) / n
    let textures = 0
    let bytes = 0
    for (const t of this.engine.getLoadedTexturesCache()) {
      textures++
      bytes += (t.width || 0) * (t.height || 0) * 4 * (t.generateMipMaps ? 1.33 : 1)
    }
    const mem = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory
    const { set, backend, quality, targetFps, refreshHz, locked } = this.info()
    const fps = Math.round((1000 * this.frames) / (now - this.windowStart))
    // Only when short of the target is something a bottleneck. If the main
    // thread is busy for most of the frame it's the CPU; if mostly idle, the GPU.
    const short = targetFps ? fps < targetFps * 0.92 : frameMs > 18
    const bound = !short ? 'ok' : cpuMs > frameMs * 0.7 ? 'cpu' : 'gpu'
    this.stats = {
      set,
      fps,
      frameMs: +frameMs.toFixed(1),
      worstMs: +this.worst.toFixed(1),
      logicMs: +(this.sumLogic / n).toFixed(2),
      renderMs: +(this.sumRender / n).toFixed(2),
      drawCalls: Math.round(this.sumDraws / n),
      activeMeshes: this.scene.getActiveMeshes().length,
      textures,
      textureMB: +(bytes / 1048576).toFixed(1),
      heapMB: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(0) : -1,
      resolution: `${this.engine.getRenderWidth()}×${this.engine.getRenderHeight()}`,
      scaling: +(1 / this.engine.getHardwareScalingLevel()).toFixed(2),
      backend,
      quality,
      targetFps,
      refreshHz,
      locked,
      bound,
    }
    this.render(this.stats)
    this.windowStart = now
    this.frames = this.sumGap = this.worst = this.sumLogic = this.sumRender = this.sumDraws = 0
  }

  private render(s: PerfStats): void {
    const c = (good: boolean, ok: boolean) => (good ? '#6c6' : ok ? '#eb4' : '#f66')
    const span = (color: string, text: string | number) => `<span style="color:${color}">${text}</span>`
    // Steady means on target; the frame budget is one target interval plus
    // half a refresh of jitter, so "worst" turns red once a frame was dropped.
    const target = s.targetFps || 60
    const fps = span(c(s.fps >= target * 0.95, s.fps >= target * 0.8), `${s.fps} fps`)
    const budget = 1000 / target + (s.refreshHz ? 500 / s.refreshHz : 8)
    const worst = span(c(s.worstMs <= budget, s.worstMs <= budget * 1.5), s.worstMs)
    const goal = s.targetFps ? `${s.locked ? 'lock' : 'target'} ${s.targetFps}/${s.refreshHz || '?'}Hz` : 'measuring…'
    const draws = span(c(s.drawCalls <= DRAW_CALL_BUDGET, s.drawCalls <= DRAW_CALL_BUDGET * 2), s.drawCalls)
    const bound = s.bound === 'ok' ? '' : `  ${span('#f66', `${s.bound.toUpperCase()}-bound?`)}`
    this.el.innerHTML = [
      `${fps}  ${goal}${bound}`,
      `frame ${s.frameMs} ms (worst ${worst})`,
      `cpu  logic ${s.logicMs} + render ${s.renderMs} ms`,
      `draw ${draws} / ${DRAW_CALL_BUDGET}  meshes ${s.activeMeshes}`,
      `tex  ${s.textures} (~${s.textureMB} MB)  heap ${s.heapMB < 0 ? 'n/a' : `${s.heapMB} MB`}`,
      `${s.resolution} @${s.scaling}x  ${s.backend} ${s.quality}  ${s.set}`,
    ].join('\n')
  }

  dispose(): void {
    this.inst.dispose()
    this.el.remove()
  }
}
