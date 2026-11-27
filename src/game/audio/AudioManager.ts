import { Howl, Howler } from 'howler'
import { fetchBytes, forgetTaken, prefetchBytes, takeReadyBytes } from '../assets/ByteCache'
import type { SceneAudio } from '../assets/manifest'
import type { AmbienceId, MusicId, SfxId } from '../narrative/types'

/** One format per device: Opus in WebM where supported, MP3 otherwise. Only that one is ever downloaded. */
const FORMAT = Howler.codecs('webm') ? 'webm' : 'mp3'
export const AUDIO_FORMAT = FORMAT
export const audioUrl = (name: string) => `${import.meta.env.BASE_URL}assets/audio/${name}.${FORMAT}`
/** How far the music dips while someone speaks. */
const DUCK = 0.45
/** Music and ambience tracks kept decoded after they stop, so a cue that comes back doesn't decode again. */
const KEEP_DECODED = 4

const MUSIC_VOL: Record<MusicId, number> = { theme: 0.55, tension: 0.6, resolve: 0.7, drive: 0.55, chronos: 0.55, past: 0.55 }
const AMB_VOL: Record<AmbienceId, number> = { rain: 0.55, gym: 0.4, car: 0.45, bunker: 0.4, lab: 0.42, room: 0.5, street: 0.5 }
const SFX_VOL: Partial<Record<SfxId, number>> = { ui_tap: 0.5, footsteps: 0.8, thunder: 0.7, whoosh: 0.6, car_pass: 0.55, scan: 0.6, spinup: 0.75, spindown: 0.7, denied: 0.3, phone_buzz: 0.7, phone_hangup: 0.35, knock: 0.8, lamp_click: 0.6, beep: 0.5, beacon: 0.55 }
const PUNCHES: SfxId[] = ['punch_1', 'punch_2', 'punch_3']

interface Track<T> {
  id: T
  howl: Howl
  /** Howler's id for this play of the track (the same track can be fading out while it starts again). */
  sound: number
}

/**
 * Music, ambience and one-shots via Howler (Web Audio, with HTML5 fallback).
 * Voice lines stream through HTML5 audio so long files start immediately.
 */
class AudioManager {
  private sfx = new Map<SfxId, Howl>()
  /** Decoded music and ambience by URL, least recently used first. */
  private tracks = new Map<string, Howl>()
  private music: Track<MusicId> | null = null
  private ambience: Track<AmbienceId> | null = null
  private voice: Howl | null = null
  private musicLevel = 0.8
  private sfxLevel = 1
  private voiceLevel = 1
  private ducked = false
  private enabled = true

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => Howler.mute(document.hidden || !this.enabled))
    }
  }

  setEnabled(on: boolean): void {
    this.enabled = on
    Howler.mute(!on || document.hidden)
  }

  setLevels(music: number, sfx: number, voice = this.voiceLevel): void {
    this.musicLevel = music
    this.sfxLevel = sfx
    this.voiceLevel = voice
    this.voice?.volume(voice)
    if (this.music) this.music.howl.volume(MUSIC_VOL[this.music.id] * music * (this.ducked ? DUCK : 1), this.music.sound)
    if (this.ambience) this.ambience.howl.volume(AMB_VOL[this.ambience.id] * sfx, this.ambience.sound)
  }

  /**
   * A Howl for a file, decoded from bytes already in memory when the file was
   * streamed ahead (no network at cue time), from the network otherwise.
   */
  private make(url: string, opts: Partial<ConstructorParameters<typeof Howl>[0]> = {}): Howl {
    const buf = takeReadyBytes(url)
    if (!buf) return new Howl({ src: [url], preload: true, ...opts })
    const blob = URL.createObjectURL(new Blob([buf], { type: FORMAT === 'webm' ? 'audio/webm' : 'audio/mpeg' }))
    const h = new Howl({ src: [blob], format: [FORMAT], preload: true, ...opts })
    const free = () => URL.revokeObjectURL(blob)
    h.once('load', free)
    h.once('loaderror', free)
    return h
  }

  /** A music or ambience track, reusing a decoded one if it is still cached. */
  private track(url: string, loop: boolean): Howl {
    let h = this.tracks.get(url)
    if (h) this.tracks.delete(url)
    else h = this.make(url, { loop, volume: 0, html5: false })
    this.tracks.set(url, h)
    // forget the oldest tracks that aren't playing
    for (const [u, old] of this.tracks) {
      if (this.tracks.size <= KEEP_DECODED) break
      if (old.playing() || old === this.music?.howl || old === this.ambience?.howl) continue
      old.unload()
      this.tracks.delete(u)
      forgetTaken(u)
    }
    return h
  }

  /**
   * Behind the loading screen: downloads and decodes the tracks the scene opens
   * with, so the first beat starts with its music. Resolves when they are ready
   * (or failed: a missing track never blocks the game).
   */
  async warm(music: (MusicId | null | undefined)[], ambience: (AmbienceId | null | undefined)[]): Promise<void> {
    const urls = [...music.filter(Boolean).map((m) => audioUrl(`music_${m}`)), ...ambience.filter(Boolean).map((a) => audioUrl(`amb_${a}`))]
    await Promise.all(
      urls.map(async (url) => {
        if (this.tracks.has(url)) return
        await fetchBytes(url).catch(() => {})
        const h = this.track(url, !url.includes('music_resolve'))
        if (h.state() !== 'loaded') await new Promise((r) => (h.once('load', r), h.once('loaderror', r)))
      }),
    )
  }

  /** While the scene plays: downloads the rest of its sounds, so every later cue plays from memory. */
  stream(a: SceneAudio): Promise<void> {
    const urls = [...a.music.map((m) => `music_${m}`), ...a.ambience.map((x) => `amb_${x}`), ...a.sfx.flatMap((x) => (x.startsWith('punch_') ? PUNCHES.map((p) => `sfx_${p}`) : [`sfx_${x}`]))].map(audioUrl)
    return prefetchBytes(urls.filter((u) => !this.tracks.has(u)))
  }

  /** At a scene change: frees decoded tracks the next scene doesn't use. */
  trim(keep: SceneAudio): void {
    const want = new Set([...keep.music.map((m) => audioUrl(`music_${m}`)), ...keep.ambience.map((x) => audioUrl(`amb_${x}`))])
    for (const [u, h] of this.tracks) {
      if (want.has(u) || h === this.music?.howl || h === this.ambience?.howl) continue
      h.unload()
      this.tracks.delete(u)
      forgetTaken(u)
    }
    const sfx = new Set(keep.sfx)
    for (const [id, h] of this.sfx) {
      if (sfx.has(id) || (PUNCHES.includes(id) && keep.sfx.some((x) => PUNCHES.includes(x)))) continue
      h.unload()
      this.sfx.delete(id)
      forgetTaken(audioUrl(`sfx_${id}`))
    }
  }

  private get(id: SfxId): Howl {
    let h = this.sfx.get(id)
    if (!h) {
      h = this.make(audioUrl(`sfx_${id}`), { volume: SFX_VOL[id] ?? 0.85 })
      this.sfx.set(id, h)
    }
    return h
  }

  play(id: SfxId, rate = 1): void {
    // Variety: any punch picks a random take and a slight pitch shift
    const pick = PUNCHES.includes(id) ? PUNCHES[Math.floor(Math.random() * PUNCHES.length)] : id
    const h = this.get(pick)
    const n = h.play()
    h.volume((SFX_VOL[pick] ?? 0.85) * this.sfxLevel, n)
    h.rate(PUNCHES.includes(id) ? rate * (0.94 + Math.random() * 0.12) : rate, n)
  }

  setMusic(id: MusicId | null, fade = 1.6): void {
    if (this.music?.id === id) return
    this.fadeOut(this.music, fade)
    this.music = null
    if (!id) return
    this.music = this.start(id, this.track(audioUrl(`music_${id}`), id !== 'resolve'), MUSIC_VOL[id] * this.musicLevel * (this.ducked ? DUCK : 1), fade)
  }

  setAmbience(id: AmbienceId | null, fade = 1.2): void {
    if (this.ambience?.id === id) return
    this.fadeOut(this.ambience, fade)
    this.ambience = null
    if (!id) return
    this.ambience = this.start(id, this.track(audioUrl(`amb_${id}`), true), AMB_VOL[id] * this.sfxLevel, fade)
  }

  private start<T>(id: T, howl: Howl, volume: number, fade: number): Track<T> {
    const sound = howl.play()
    howl.volume(0, sound)
    howl.fade(0, volume, fade * 1000, sound)
    return { id, howl, sound }
  }

  /** Fades one playing sound out and stops it; the decoded track stays cached for a later cue. */
  private fadeOut<T>(t: Track<T> | null, fade: number): void {
    if (!t) return
    t.howl.fade(t.howl.volume(t.sound) as number, 0, fade * 1000, t.sound)
    window.setTimeout(() => t.howl.stop(t.sound), fade * 1000 + 50)
  }

  /**
   * Plays a recorded line, cutting off the one before (the player moved on);
   * no url just stops it. The music dips under the voice and comes back when
   * it ends.
   */
  playVoice(url: string | undefined): void {
    const was = this.voice
    this.voice = null
    if (was) {
      was.off()
      was.stop()
      was.unload()
    }
    if (!url) return this.duck(false)
    const v = new Howl({ src: [url], html5: true, volume: this.voiceLevel })
    const done = () => {
      if (this.voice === v) {
        this.voice = null
        this.duck(false)
      }
    }
    v.once('end', done)
    v.once('loaderror', done)
    v.once('playerror', done)
    this.voice = v
    this.duck(true)
    v.play()
  }

  /** The music under a voice line: down to 45%, back up when nobody's speaking. */
  private duck(on: boolean): void {
    if (this.ducked === on) return
    this.ducked = on
    const t = this.music
    if (!t) return
    const base = MUSIC_VOL[t.id] * this.musicLevel
    const now = (t.howl as unknown as { volume(v?: number, id?: number): number }).volume(undefined, t.sound)
    t.howl.fade(now, base * (on ? DUCK : 1), on ? 250 : 700, t.sound)
  }

  /** Drains music and ambience to silence over `seconds` (the transfer). The next cue brings sound back. */
  silence(seconds: number): void {
    this.setMusic(null, seconds)
    this.setAmbience(null, seconds)
  }

  stopAll(): void {
    this.setMusic(null, 0.6)
    this.setAmbience(null, 0.6)
    this.playVoice(undefined)
  }
}

export const audio = new AudioManager()
