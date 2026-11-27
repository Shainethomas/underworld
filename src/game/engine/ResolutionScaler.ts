import type { AbstractEngine } from '@render/core'

// Dynamic render resolution, the way mobile games keep a phone sharp without
// dropping frames: render as many pixels as the GPU can shade at the frame
// rate being held, between a floor (soft but acceptable) and a ceiling (as
// sharp as it's worth on a phone screen).
//
// Phone GPUs are limited by pixels: on a Mali-G68 the frame rate fell almost
// exactly with the pixel count. So resolution is the lever:
// - frames running late with the GPU the bottleneck (not the main thread,
//   which fewer pixels can't help): one step down;
// - steady for a while: try one step up, and step back (waiting twice as long
//   before the next try) if frames start running late.
//
// It judges calm beats (dialogue, shots, calls), which run capped at 30 fps
// and which the FrameGovernor doesn't judge. On action beats the governor
// asks for a step down through `stepDown` before it lowers the frame rate.

/** Render pixels per CSS pixel, in the steps the scaler moves through. */
const STEP = 0.125
const WINDOW_MS = 2000
/** Share of late frames in a window that counts as "not keeping up". */
const MISS_LIMIT = 0.1
const FIRST_TRY_MS = 12000
const PROBE_MS = 4000
/** Gaps longer than this are loading hitches, not shading cost. */
const HITCH_MS = 250

export interface ResolutionRange {
  floor: number
  start: number
  ceiling: number
}

export class ResolutionScaler {
  scale: number
  private last = 0
  private winStart = 0
  private frames = 0
  private misses = 0
  private badWindows = 0
  private steadySince = 0
  private probe: { from: number; until: number } | null = null
  private retryMs = FIRST_TRY_MS
  private setId: string | null = null
  /** Where each set last settled. */
  private perSet = new Map<string, number>()

  constructor(private engine: AbstractEngine, private range: ResolutionRange) {
    this.scale = range.start
    this.apply()
  }

  /**
   * A new set: sets differ far more than beats within one, so each starts
   * where it last settled (or at the tier's start), with a fresh retry clock.
   */
  enterSet(id: string): void {
    if (id === this.setId) return
    if (this.setId) this.perSet.set(this.setId, this.probe?.from ?? this.scale)
    this.setId = id
    this.probe = null
    this.badWindows = 0
    this.retryMs = FIRST_TRY_MS
    this.steadySince = performance.now()
    const scale = this.perSet.get(id) ?? this.range.start
    if (scale !== this.scale) this.set(scale)
  }

  /** One step fewer pixels; false at the floor. */
  stepDown(): boolean {
    if (this.scale <= this.range.floor + 1e-6) return false
    this.set(Math.max(this.range.floor, this.scale - STEP))
    return true
  }

  /**
   * Called after every rendered frame.
   * @param judge true while a calm (capped) beat is settled: not loading, not locked with `?fps=`
   * @param cpuMs main-thread time per frame (game logic plus draw submission)
   */
  frame(now: number, fps: number, refreshHz: number, judge: boolean, cpuMs: number): void {
    const gap = now - this.last
    this.last = now
    if (!judge || !fps || !refreshHz) return this.reset(now)
    if (gap > HITCH_MS) return
    this.frames++
    if (gap > 1000 / fps + 500 / refreshHz) this.misses++
    if (now - this.winStart < WINDOW_MS) return
    const missRate = this.misses / this.frames
    this.reset(now)

    if (this.probe) {
      if (missRate > MISS_LIMIT / 2) {
        this.set(this.probe.from)
        this.probe = null
        this.retryMs = Math.min(this.retryMs * 2, 5 * 60000)
        this.steadySince = now
      } else if (now >= this.probe.until) {
        this.probe = null
        this.steadySince = now
      }
      return
    }
    if (missRate > MISS_LIMIT) {
      this.steadySince = now
      if (++this.badWindows < 2) return
      this.badWindows = 0
      // the main thread is the bottleneck: fewer pixels won't help
      if (cpuMs > 0.7 * (1000 / fps)) return
      this.stepDown()
      return
    }
    this.badWindows = 0
    if (missRate > 0.01) this.steadySince = now
    else if (this.scale < this.range.ceiling - 1e-6 && now - this.steadySince >= this.retryMs) {
      this.probe = { from: this.scale, until: now + PROBE_MS }
      this.set(Math.min(this.range.ceiling, this.scale + STEP))
    }
  }

  private set(scale: number): void {
    this.scale = scale
    // Resize once this frame is submitted: called mid-frame, the resize would
    // destroy render targets the frame's queued GPU commands still use.
    setTimeout(() => this.apply(), 0)
    // the resize itself costs a frame or two: judge from the next window
    this.reset(performance.now())
  }

  private apply(): void {
    this.engine.setHardwareScalingLevel(1 / this.scale)
  }

  private reset(now: number): void {
    this.winStart = now
    this.frames = 0
    this.misses = 0
  }
}
