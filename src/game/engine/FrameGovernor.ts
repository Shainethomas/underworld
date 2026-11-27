import type { ICustomAnimationFrameRequester } from '@render/core'

// Holds the frame rate steady. Frames are paced off the display's vsync, and
// the target is always an even divisor of the refresh rate (120 Hz → 120, 60,
// 40, 30; 60 Hz → 60, 30), so every frame stays on screen for the same number
// of refreshes: no judder.
//
// It starts at the display's own rate. If the device keeps missing it, the
// target steps down; while it is comfortably holding a lower rate it tries
// the next one up again now and then, backing off each time that fails.
//
// Babylon's own `engine.maxFPS` carries leftover time between frames, which
// with normal timestamp jitter yields a double-length frame every few
// frames, so pacing is done here instead, through the engine's
// `customAnimationFrameRequester` hook. Babylon only runs (and times) the
// frames this lets through, so animation speed is unaffected.

/** Common panel refresh rates, used to snap the measured one. */
const PANEL_RATES = [30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165]
/** Lowest target the governor will step down to. */
const MIN_TARGET = 24
const WINDOW_MS = 2000
/** Share of late frames in a window that counts as "not holding the rate". */
const MISS_LIMIT = 0.1
/** Gaps longer than this are loading hitches or a backgrounded tab, not pacing. */
const HITCH_MS = 250
/** How long a trial at a higher rate lasts, and the first wait before one. */
const PROBE_MS = 4000
const FIRST_RETRY_MS = 20000

/** Even divisors of the refresh rate, highest first. */
export function frameRates(refreshHz: number): number[] {
  const out: number[] = []
  for (let d = 1; d <= 6; d++) {
    const f = refreshHz / d
    if (f < MIN_TARGET) break
    out.push(Math.round(f))
  }
  return out
}

export class FrameGovernor {
  /** Display refresh rate (Hz) measured from vsync; 0 until known. */
  refreshHz = 0
  /** The frame rate being held. */
  targetFps = 0
  /** A fixed cap (`?fps=30`) disables adaptation. */
  readonly fixed: number | null

  readonly requester: ICustomAnimationFrameRequester

  private rafId = 0
  private lastTick = 0
  private lastFrame = 0
  private tickGaps: number[] = []
  private holdUntil = 0
  private winStart = 0
  private frames = 0
  private misses = 0
  private badWindows = 0
  private steadySince = 0
  private probe: { from: number; until: number } | null = null
  private retryMs = FIRST_RETRY_MS
  /** True once the system has reported the refresh rate (no more measuring). */
  private systemRate = false
  /** Upper limit for calm moments (see `setCap`); null when uncapped. */
  private cap: number | null = null

  /**
   * @param relieve called when the rate can't be held at 60 or below; lowers
   *   some other cost (render resolution) and returns false once it can't.
   */
  constructor(private relieve: () => boolean = () => false, fixed: number | null = null) {
    this.fixed = fixed && fixed > 0 ? fixed : null
    this.requester = {
      requestAnimationFrame: (cb: FrameRequestCallback) => {
        const tick = (t: number) => {
          if (this.due(t)) cb(t)
          else this.rafId = requestAnimationFrame(tick)
        }
        this.rafId = requestAnimationFrame(tick)
        return this.rafId
      },
      cancelAnimationFrame: () => cancelAnimationFrame(this.rafId),
    }
  }

  /**
   * Caps the frame rate for a while: narrative mobile games run dialogue and
   * cutscenes at 30 fps and save full rate for action, which roughly halves
   * GPU work (heat, battery) for most of a play session. The cap snaps to an
   * even divisor of the refresh rate, so pacing stays judder-free. Adaptation
   * pauses while capped: the device is judged on the uncapped beats.
   */
  setCap(fps: number | null): void {
    if (fps === this.cap) return
    this.cap = fps
    this.resetWindow(performance.now())
  }

  /** The rate frames are paced at right now. */
  get pacedFps(): number {
    const target = this.fixed ?? this.targetFps
    if (!this.cap || !target || target <= this.cap || !this.refreshHz) return target
    return frameRates(this.refreshHz).find((r) => r <= this.cap!) ?? target
  }

  private get capped(): boolean {
    return this.pacedFps < (this.fixed ?? this.targetFps)
  }

  /**
   * True while a calm beat runs capped and settled (not loading, not locked
   * with `?fps=`): the frames this governor doesn't judge, which the
   * ResolutionScaler does.
   */
  judgingCalm(now: number): boolean {
    return !this.fixed && this.capped && now >= this.holdUntil
  }

  /** Ignore pacing stats for a while (set switches, asset loads). */
  hold(ms: number): void {
    this.holdUntil = performance.now() + ms
  }

  /** Decides on each vsync whether to render, and keeps the books. */
  private due(t: number): boolean {
    if (this.lastTick) this.measureRefresh(t - this.lastTick)
    this.lastTick = t
    const target = this.pacedFps
    if (target && this.refreshHz && this.lastFrame) {
      // Render once a full frame interval has passed, give or take half a
      // refresh of timestamp jitter. No carry-over, so pacing can't drift.
      const interval = 1000 / target
      const slack = 500 / this.refreshHz
      if (t - this.lastFrame < interval - slack) return false
    }
    this.recordFrame(t)
    return true
  }

  private measureRefresh(gap: number): void {
    if (gap <= 0 || gap > 100) return
    this.tickGaps.push(gap)
    if (this.tickGaps.length < 60) return
    // Ticks we skip are cheap, so the shortest gaps show the true vsync
    // interval even when rendered frames are slow.
    const sorted = [...this.tickGaps].sort((a, b) => a - b)
    const hz = 1000 / sorted[Math.floor(sorted.length * 0.1)]
    this.tickGaps.length = 0
    // A GPU running behind holds back every vsync callback (a Mali-G68 under
    // load read as 23 Hz on a 90 Hz panel): no real panel runs that slow, so
    // keep the last good reading rather than pace to a stall.
    if (hz < 40 || this.systemRate) return
    this.setRefresh(hz)
  }

  /**
   * The refresh rate as the system reports it (Android): used instead of
   * measuring, which a busy GPU throws off (a 90 Hz panel read as 45–48 Hz,
   * pacing calm beats at 24 fps instead of 30). Call again when it may have
   * changed (power saving).
   */
  useSystemRate(hz: number): void {
    this.systemRate = true
    this.setRefresh(hz)
  }

  private setRefresh(hz: number): void {
    const snapped = PANEL_RATES.reduce((best, r) => (Math.abs(r - hz) < Math.abs(best - hz) ? r : best))
    const refresh = Math.abs(snapped - hz) / snapped < 0.08 ? snapped : Math.round(hz)
    if (refresh === this.refreshHz) return
    const first = this.refreshHz === 0
    this.refreshHz = refresh
    const rates = frameRates(refresh)
    // Start at the display's own rate. After a change (a phone dropping to
    // 60 Hz in power saving, say), keep the highest rate that still fits.
    this.targetFps = first ? rates[0] : (rates.find((r) => r <= this.targetFps) ?? rates[rates.length - 1])
    this.probe = null
    this.resetWindow(performance.now())
  }

  private recordFrame(t: number): void {
    const gap = t - this.lastFrame
    this.lastFrame = t
    if (!this.targetFps || this.fixed || t < this.holdUntil || this.capped) {
      this.resetWindow(t)
      return
    }
    if (gap > HITCH_MS) return
    this.frames++
    // Late by at least one whole refresh.
    if (gap > 1000 / this.targetFps + 500 / this.refreshHz) this.misses++
    if (t - this.winStart >= WINDOW_MS) this.judge(t)
  }

  private judge(now: number): void {
    const missRate = this.frames ? this.misses / this.frames : 0
    this.resetWindow(now)
    const rates = frameRates(this.refreshHz)
    const i = rates.indexOf(this.targetFps)

    if (this.probe) {
      if (missRate > MISS_LIMIT / 2) {
        // The trial failed: go back and wait twice as long next time.
        this.targetFps = this.probe.from
        this.probe = null
        this.retryMs = Math.min(this.retryMs * 2, 5 * 60000)
        this.steadySince = now
      } else if (now >= this.probe.until) {
        this.probe = null
        this.retryMs = FIRST_RETRY_MS
        this.steadySince = now
      }
      return
    }

    if (missRate > MISS_LIMIT) {
      this.steadySince = now
      if (++this.badWindows < 2) return
      this.badWindows = 0
      // Above 60, a lower rate is the better trade; at 60 and below, try
      // shedding resolution before halving the frame rate.
      if (this.targetFps <= 60 && this.relieve()) return
      if (i >= 0 && i < rates.length - 1) this.targetFps = rates[i + 1]
      return
    }

    this.badWindows = 0
    if (missRate > 0.01) this.steadySince = now
    else if (i > 0 && now - this.steadySince >= this.retryMs) {
      this.probe = { from: this.targetFps, until: now + PROBE_MS }
      this.targetFps = rates[i - 1]
    }
  }

  private resetWindow(now: number): void {
    this.winStart = now
    this.frames = 0
    this.misses = 0
  }
}

/** `?fps=30` locks the frame rate for testing (e.g. the Lite target). */
export function fixedFpsFromUrl(): number | null {
  const v = Number(new URLSearchParams(location.search).get('fps'))
  return Number.isFinite(v) && v > 0 ? v : null
}
