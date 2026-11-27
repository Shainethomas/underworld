// Procedural audio — rain bed, low drone and one-shot hits synthesised with
// WebAudio, so the prototype has a soundscape with zero audio assets. Swap
// any cue for a decoded sample later without touching callers.

type Cue = 'impact' | 'clang' | 'thunder' | 'rev' | 'heartbeat' | 'tick' | 'confirm' | 'whoosh' | 'sting'

class AudioEngine {
  private ctx: AudioContext | null = null
  private master: GainNode | null = null
  private ambience: GainNode | null = null
  private noise: AudioBuffer | null = null
  private enabled = true

  /** Must be called from a user gesture (browser autoplay policy). */
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (!Ctx) return
      this.ctx = new Ctx()
      this.master = this.ctx.createGain()
      this.master.gain.value = this.enabled ? 0.9 : 0
      this.master.connect(this.ctx.destination)
      this.noise = this.makeNoise(2)
      this.startAmbience()
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume()
  }

  setEnabled(on: boolean) {
    this.enabled = on
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(on ? 0.9 : 0, this.ctx.currentTime, 0.05)
  }

  /** 0..1 — rain/drone level, e.g. lower indoors or during video. */
  setAmbience(level: number) {
    if (this.ambience && this.ctx) this.ambience.gain.setTargetAtTime(level, this.ctx.currentTime, 0.6)
  }

  private makeNoise(seconds: number) {
    const ctx = this.ctx!
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
    const d = buf.getChannelData(0)
    let b0 = 0, b1 = 0, b2 = 0
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1
      // cheap pink-ish noise
      b0 = 0.99765 * b0 + w * 0.099046
      b1 = 0.963 * b1 + w * 0.2965164
      b2 = 0.57 * b2 + w * 1.0526913
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.18
    }
    return buf
  }

  private startAmbience() {
    const ctx = this.ctx!
    this.ambience = ctx.createGain()
    this.ambience.gain.value = 0.55
    this.ambience.connect(this.master!)
    // rain: band-passed looping noise
    const rain = ctx.createBufferSource()
    rain.buffer = this.noise
    rain.loop = true
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.value = 900
    const lp = ctx.createBiquadFilter()
    lp.type = 'lowpass'
    lp.frequency.value = 7000
    const rg = ctx.createGain()
    rg.gain.value = 0.35
    rain.connect(hp).connect(lp).connect(rg).connect(this.ambience)
    rain.start()
    // drone: two detuned low sines through a slow filter sweep
    for (const f of [55, 55.7, 82.4]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      const g = ctx.createGain()
      g.gain.value = 0.018
      const flt = ctx.createBiquadFilter()
      flt.type = 'lowpass'
      flt.frequency.value = 180
      o.connect(flt).connect(g).connect(this.ambience)
      o.start()
    }
  }

  play(cue: Cue) {
    const ctx = this.ctx
    if (!ctx || !this.master || !this.enabled) return
    const t = ctx.currentTime
    const env = (g: GainNode, peak: number, attack: number, decay: number, at = t) => {
      g.gain.setValueAtTime(0.0001, at)
      g.gain.exponentialRampToValueAtTime(peak, at + attack)
      g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay)
    }
    const noiseBurst = (freq: number, q: number, peak: number, decay: number, type: BiquadFilterType = 'lowpass', at = t) => {
      const src = ctx.createBufferSource()
      src.buffer = this.noise
      const f = ctx.createBiquadFilter()
      f.type = type
      f.frequency.value = freq
      f.Q.value = q
      const g = ctx.createGain()
      env(g, peak, 0.004, decay, at)
      src.connect(f).connect(g).connect(this.master!)
      src.start(at, Math.random())
      src.stop(at + decay + 0.1)
    }
    const tone = (type: OscillatorType, f0: number, f1: number, peak: number, decay: number, at = t) => {
      const o = ctx.createOscillator()
      o.type = type
      o.frequency.setValueAtTime(f0, at)
      o.frequency.exponentialRampToValueAtTime(f1, at + decay)
      const g = ctx.createGain()
      env(g, peak, 0.005, decay, at)
      o.connect(g).connect(this.master!)
      o.start(at)
      o.stop(at + decay + 0.1)
    }
    switch (cue) {
      case 'impact':
        tone('sine', 120, 38, 0.9, 0.35)
        noiseBurst(1800, 0.7, 0.6, 0.12)
        break
      case 'clang':
        tone('sine', 95, 40, 0.8, 0.5)
        for (const f of [420, 637, 1180, 1710]) tone('triangle', f, f * 0.97, 0.12, 1.4)
        noiseBurst(3000, 1, 0.4, 0.2, 'bandpass')
        break
      case 'thunder':
        noiseBurst(140, 0.4, 0.9, 3.2)
        noiseBurst(400, 0.5, 0.35, 1.2, 'lowpass', t + 0.15)
        break
      case 'rev': {
        const o = ctx.createOscillator()
        o.type = 'sawtooth'
        o.frequency.setValueAtTime(48, t)
        o.frequency.exponentialRampToValueAtTime(140, t + 0.9)
        o.frequency.exponentialRampToValueAtTime(70, t + 2.6)
        const f = ctx.createBiquadFilter()
        f.type = 'lowpass'
        f.frequency.value = 420
        const g = ctx.createGain()
        g.gain.setValueAtTime(0.0001, t)
        g.gain.exponentialRampToValueAtTime(0.22, t + 0.6)
        g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2)
        o.connect(f).connect(g).connect(this.master)
        o.start(t)
        o.stop(t + 3.3)
        break
      }
      case 'heartbeat':
        tone('sine', 62, 40, 0.7, 0.18)
        tone('sine', 58, 38, 0.5, 0.2, t + 0.28)
        break
      case 'tick':
        tone('triangle', 1800, 1400, 0.05, 0.05)
        break
      case 'confirm':
        tone('triangle', 660, 660, 0.08, 0.25)
        tone('triangle', 990, 990, 0.06, 0.4, t + 0.07)
        break
      case 'whoosh':
        noiseBurst(900, 0.8, 0.25, 0.45, 'bandpass')
        break
      case 'sting':
        for (const f of [73.4, 110, 146.8]) tone('sawtooth', f, f * 0.98, 0.07, 2.4)
        noiseBurst(200, 0.5, 0.4, 1.4)
        break
    }
  }
}

export const audio = new AudioEngine()
export type { Cue }
