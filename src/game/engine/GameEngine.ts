import { Color3, PointLight, Ray, Vector3 } from '@render/core'
import type { AbstractMesh, Material } from '@render/core'
import { voiceFor } from '../audio/voices'
import { context, currentBeat, playedBeats, useGame, type GameState, type Spoken } from '../../store/gameStore'
import { audio } from '../audio/AudioManager'
import { clearCache, hold, isLoaded, load, report, sweep } from '@render/AssetLoader'
import { dropBytes, prefetchBytes } from '../assets/ByteCache'
import { envAssets, sceneFiles, sceneManifest, type SceneManifest } from '../assets/manifest'
import { audioUrl } from '../audio/AudioManager'
import { setAssetTier } from '../assets/urls'
import { clearPlaying, markPlaying, reloadAndResume } from '../../platform/recovery'
import { displayRefreshRate } from '../../platform/native'
import { createRenderer, resolutionRange, type RenderContext } from '@render/Renderer'
import { CameraManager } from '@render/CameraManager'
import { BlobShadows } from '@render/BlobShadows'
import { CharacterLibrary } from '../characters/CharacterAssets'
import { gestureFor, SPEAKING, SPEAKING_DEFAULT } from '../characters/CharacterExpressions'
import { Actor } from '../characters/CharacterPresentation'
import { evaluate } from '../narrative/ChoiceSystem'
import type { ActorDirective, ActorId, Beat, Cue, EnvironmentId, Gesture, Place, QteBeat, SceneData, StageDirective, TimelineEvent } from '../narrative/types'
import { CinematicController } from './CinematicController'
import { EnvironmentManager } from './EnvironmentManager'
import { FLASH_EVENT, FX_EVENT } from './events'
import { InteractionController } from './InteractionController'
import { planPath } from './paths'
import { FrameGovernor, fixedFpsFromUrl } from './FrameGovernor'
import { HandProps } from './HandProps'
import { PerfOverlay, perfRequested } from './PerfOverlay'
import { ResolutionScaler } from './ResolutionScaler'
import { isPlayable, loadScene } from './SceneManager'

const sleep = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

/** Beats where the player is in control (walking, timing, driving): never frame-capped. */
const ACTIVE_BEATS = new Set<Beat['type']>(['explore', 'qte', 'drive'])
/** Frame rate on phones for everything else: dialogue, choices, shots, calls. */
const CALM_FPS = 30


/**
 * Stages the narrative in 3D. The store owns story state (cursor, choices,
 * variables); this class reacts to it: switching environments, blocking
 * actors, cutting cameras, running beat timelines and audio cues, and
 * handling taps during exploration.
 */
class GameEngine {
  private bjs: RenderContext | null = null
  private canvas: HTMLCanvasElement | null = null
  private cam: CameraManager | null = null
  private cine: CinematicController | null = null
  private envs: EnvironmentManager | null = null
  private interaction: InteractionController | null = null
  private library: CharacterLibrary | null = null
  /** The gym bag and the phone in the cast's hands. */
  private props: HandProps | null = null
  /** On-screen performance readout, only with `?perf`. */
  perf: PerfOverlay | null = null
  /** Paces frames and holds the frame rate steady. */
  frameRate: FrameGovernor | null = null
  /** Main-thread time per frame (game logic + render submission), smoothed. */
  private cpuMs = 0
  /**
   * A set change is a hard cut, not a fade to black: while the new set is
   * swapped in, nothing renders, so the canvas keeps showing the old shot's
   * last frame; the first frame drawn after is the new shot.
   */
  private holding = false
  /** Dynamic render resolution within the tier's range. */
  private resolution: ResolutionScaler | null = null
  readonly actors = new Map<ActorId, Actor>()
  private envId: EnvironmentId | null = null
  private queue: Promise<void> = Promise.resolve()
  private gen = 0
  /** Bumped per scene load and on detach: background streaming for an older run stops. */
  private run = 0
  private clock = 0
  private timeline: TimelineEvent[] = []
  private holdUntil: number | null = null
  private talker: Actor | null = null
  private paused = false
  private pendingInstant: Beat[] = []
  private unsub: (() => void) | null = null
  private cleanup: (() => void)[] = []
  /** Background life: actors walking a loop or repeating gestures between story beats. */
  private patrols = new Map<ActorId, { points: Vector3[]; pace: ActorDirective['pace']; i: number; wait: number; moving: boolean }>()
  private routines = new Map<ActorId, { gestures: Gesture[]; i: number; wait: number }>()
  /** Real seconds of slow motion left, and the current time scale. */
  private slowmo = 0
  private timeScale = 1
  private fill: PointLight | null = null
  /** Soft shadows under the cast on devices without shadow maps (the 'lite' tier). */
  private blobs: BlobShadows | null = null
  /** The beat whose staging has run, and a skill-moment prompt that arrived before it did. */
  private staged: Beat | null = null
  /** Seconds since the car pulled up at a drive beat's destination (null while driving). */
  private arrivedFor: number | null = null
  private earlyPrompt: { beat: QteBeat; index: number } | null = null

  get backend(): string {
    return this.bjs?.backend ?? 'none'
  }

  get fps(): number {
    return this.bjs?.engine.getFps() ?? 0
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  async attach(canvas: HTMLCanvasElement): Promise<void> {
    if (this.canvas === canvas) return
    this.detach()
    this.canvas = canvas
    const token = this.gen
    if (useGame.getState().scene) useGame.getState().setLoading({ label: 'Starting the engine', progress: 0, kind: 'scene' })
    const settings = useGame.getState().settings
    const bjs = await createRenderer(canvas, settings.renderer, settings.quality)
    if (this.canvas !== canvas || token !== this.gen) {
      bjs.scene.dispose()
      bjs.engine.dispose()
      return
    }
    this.bjs = bjs
    // every manifest from here on names this device's file variants (phone-sized on phones)
    setAssetTier(bjs.tier)
    this.cam = new CameraManager(bjs.camera)
    // Soft fill that travels with the camera and lights only the cast: keeps
    // faces readable in a deliberately dark, contrasty set.
    this.fill = new PointLight('camera_fill', new Vector3(-0.65, 0.65, -0.4), bjs.scene)
    this.fill.parent = bjs.camera
    // All tiers: neutral-warm bounce on faces using the existing cast-only fill.
    this.fill.diffuse = new Color3(1, 0.94, 0.86)
    this.fill.specular = new Color3(0.08, 0.08, 0.08)
    this.fill.intensity = 3.2
    this.fill.radius = 0.8
    this.fill.range = 8
    this.envs = new EnvironmentManager(bjs.scene, bjs.quality, (id) => audio.play(id))
    this.library = new CharacterLibrary(bjs.scene)
    this.props = new HandProps(bjs.scene, (meshes, mats) => this.envs?.active?.adopt(meshes, mats))
    if (bjs.tier === 'lite') this.blobs = new BlobShadows(bjs.scene)
    const dof = bjs.pipeline.depthOfFieldEnabled ? bjs.pipeline.depthOfField : null
    this.cine = new CinematicController(this.cam, bjs.engine, this.actors, () => this.envs?.active ?? null, (distance, fStop) => {
      if (!dof) return
      dof.focusDistance = distance * 1000
      dof.fStop += (fStop - dof.fStop) * 0.08
    })
    this.interaction = new InteractionController({
      actors: this.actors,
      env: () => this.envs?.active ?? null,
      resolve: (p) => this.place(p),
      onArrive: (h) => useGame.getState().openAside(h),
    })

    // holding the scene opens the throttle on a drive
    const onDown = () => this.throttle(true)
    const onUp = () => this.throttle(false)
    const onLeave = () => this.throttle(false)
    // the arrow up key (or W) holds the throttle too
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || !['ArrowUp', 'w', 'W'].includes(e.key)) return
      this.throttle(e.type === 'keydown')
    }
    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onLeave)
    canvas.addEventListener('pointerleave', onLeave)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    this.cleanup.push(() => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onLeave)
      canvas.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
    })

    // Nods and head shakes ride on top of the body animation
    let headDt = 0
    const before = bjs.scene.onBeforeAnimationsObservable.add(() => {
      for (const a of this.actors.values()) a.restoreHead()
    })
    const after = bjs.scene.onAfterAnimationsObservable.add(() => {
      for (const a of this.actors.values()) if (a.visible) a.applyHead(headDt)
      // props follow the hands as the animations (and head turns) left them this frame
      this.props?.update(this.actors, headDt)
      if (this.blobs) for (const [id, a] of this.actors) this.blobs.place(id, a.visible, a.position)
    })
    this.cleanup.push(() => {
      bjs.scene.onBeforeAnimationsObservable.remove(before)
      bjs.scene.onAfterAnimationsObservable.remove(after)
    })

    const frameRate = new FrameGovernor(() => this.relieve(), fixedFpsFromUrl())
    this.frameRate = frameRate
    bjs.engine.customAnimationFrameRequester = frameRate.requester
    // the panel's real refresh rate where the system can say (Android), now and now and then (power saving changes it)
    const askRate = () => void displayRefreshRate().then((hz) => hz && this.frameRate === frameRate && frameRate.useSystemRate(hz))
    askRate()
    const rateTimer = window.setInterval(askRate, 10000)
    this.cleanup.push(() => window.clearInterval(rateTimer))
    const resolution = new ResolutionScaler(bjs.engine, resolutionRange(bjs.tier))
    this.resolution = resolution
    if (perfRequested())
      this.perf = new PerfOverlay(bjs.engine, bjs.scene, () => ({
        set: this.envs?.active?.id ?? '-',
        backend: bjs.backend,
        quality: bjs.quality,
        targetFps: frameRate.pacedFps,
        refreshHz: frameRate.refreshHz,
        locked: frameRate.fixed !== null,
      }))
    bjs.engine.runRenderLoop(() => {
      if (this.holding) return
      const dt = Math.min(0.05, bjs.engine.getDeltaTime() / 1000)
      headDt = this.paused ? 0 : dt
      const t0 = performance.now()
      this.update(dt)
      const t1 = performance.now()
      bjs.scene.render()
      const t2 = performance.now()
      this.cpuMs += (t2 - t0 - this.cpuMs) * 0.05
      resolution.frame(t0, frameRate.pacedFps, frameRate.refreshHz, frameRate.judgingCalm(t0), this.cpuMs)
      this.perf?.frame(t1 - t0, t2 - t1)
    })

    // A lost GPU context (Android backgrounding, memory pressure) or a lost
    // WebGPU device can't be rebuilt reliably with every set's painted
    // textures and probes: reload instead, and come straight back to this
    // beat (the save is current). See src/platform/recovery.ts.
    const lost = bjs.engine.onContextLostObservable.add(() => {
      console.warn('[underworld] the GPU context was lost: reloading at the current beat')
      reloadAndResume(useGame.getState().scene?.id)
    })
    // the heartbeat that tells a crash-reload (iOS kills the WebView's process) which scene to resume
    const beat = window.setInterval(() => {
      const st = useGame.getState()
      if (st.scene && !st.loading) markPlaying(st.scene.id)
    }, 10_000)
    this.cleanup.push(() => {
      bjs.engine.onContextLostObservable.remove(lost)
      window.clearInterval(beat)
      clearPlaying()
    })

    this.unsub = useGame.subscribe((s, prev) => this.onStore(s, prev))
    this.applySettings(useGame.getState())
    if (import.meta.env.DEV || location.search.includes('test')) (window as unknown as Record<string, unknown>).__underworld = { engine: this, store: useGame, assets: report, loadScene }
    if (useGame.getState().scene) this.enqueue(() => this.beginScene())
  }

  detach(): void {
    this.gen++
    this.run++
    this.holding = false
    this.unsub?.()
    this.unsub = null
    for (const c of this.cleanup) c()
    this.cleanup = []
    this.disposeActors()
    this.interaction?.dispose()
    this.props?.dispose()
    this.envs?.dispose()
    this.perf?.dispose()
    this.perf = null
    this.blobs?.dispose()
    this.blobs = null
    this.frameRate = null
    this.resolution = null
    if (this.bjs) {
      this.bjs.engine.stopRenderLoop()
      this.bjs.scene.dispose()
      this.bjs.engine.dispose()
    }
    clearCache()
    this.bjs = this.cam = this.cine = this.envs = this.interaction = this.library = this.fill = this.props = null
    this.canvas = null
    this.envId = null
    audio.stopAll()
  }

  private enqueue(task: () => Promise<void> | void): void {
    this.queue = this.queue.then(task).catch((err) => console.error('[underworld]', err))
  }

  private onStore(s: GameState, prev: GameState): void {
    if (s.scene !== prev.scene) {
      if (s.scene) this.enqueue(() => this.beginScene())
      return
    }
    if (s.beat !== prev.beat) this.enqueue(() => this.stageCurrent())
    else if (s.echo && s.echo !== prev.echo) this.stageEcho(s.echo)
    if (s.aside !== prev.aside) this.stageAside(s)
    if (s.menuOpen !== prev.menuOpen) this.paused = s.menuOpen
    if (s.settings !== prev.settings) this.applySettings(s)
  }

  private applySettings(s: GameState): void {
    audio.setEnabled(s.settings.sound)
    audio.setLevels(s.settings.music, s.settings.sfx, s.settings.voice ?? 1)
  }

  // ── Scene start / resume ────────────────────────────────────────────────

  /**
   * Scene change, behind the loading screen, in the order big games do it:
   * unload the last scene (cast, set, and every file the new scene doesn't
   * use), load only what the first shot needs (the cast, the opening set, the
   * opening music), build it and compile its shaders, start playing, then
   * stream the rest of the scene and the next one in the background.
   */
  private async beginScene(): Promise<void> {
    const s = useGame.getState()
    const scene = s.scene
    if (!scene || !this.bjs || !this.envs || !this.library) return
    const gen = ++this.gen
    const run = ++this.run
    this.holding = false
    const bjs = this.bjs
    const envs = this.envs
    const show = (label: string, progress: number) => gen === this.gen && useGame.getState().setLoading({ label, progress, kind: 'scene' })
    show('Clearing the last scene', 0.02)

    // 1. Unload
    this.disposeActors()
    envs.unload()
    this.envId = null
    const manifest = sceneManifest(scene)
    hold('cast', manifest.cast)
    hold('scene', sceneFiles(manifest))
    sweep()
    const audioFiles = new Set([...manifest.audio.music.map((m) => `music_${m}`), ...manifest.audio.ambience.map((a) => `amb_${a}`), ...manifest.audio.sfx.map((x) => `sfx_${x}`)].map(audioUrl))
    const files = new Set(sceneFiles(manifest))
    dropBytes((u) => files.has(u) || audioFiles.has(u))
    audio.trim(manifest.audio)

    // 2. Where the scene resumes: the set, and the music and ambience in force
    const path = playedBeats()
    const beat = currentBeat(useGame.getState())
    const targetEnv = this.envOf(scene, beat)
    let music: Cue['music']
    let ambience: Cue['ambience']
    for (const b of path) {
      const cue = b.cue
      if (cue && 'music' in cue) music = cue.music
      if (cue && 'ambience' in cue) ambience = cue.ambience
    }
    const opening = beat?.cue

    // 3. Load what the first shot needs
    await Promise.all([
      load([...manifest.cast, ...envAssets(targetEnv)], bjs.scene, { onProgress: (p) => show(p < 0.7 ? 'Loading characters' : 'Loading the set', 0.05 + p * 0.75) }),
      envs.prefetch(targetEnv),
      audio.warm([music, opening && 'music' in opening ? opening.music : undefined], [ambience, opening && 'ambience' in opening ? opening.ambience : undefined]),
    ])
    if (gen !== this.gen) return

    // 4. Cast
    show('Dressing the cast', 0.82)
    await this.library.use(scene.cast)
    if (gen !== this.gen) return
    for (const id of scene.cast) {
      const a = new Actor(id, this.library.create(id))
      a.setVisible(false)
      this.actors.set(id, a)
    }
    // what he was wearing when the last scene ended
    const story = context(useGame.getState())
    for (const o of scene.outfits ?? []) {
      const a = this.actors.get(o.actor)
      if (a && evaluate(o.when, story)) for (const [g, on] of Object.entries(o.outfit)) a.rig.setGarment(g, on)
    }

    // 5. Set, then every shader the opening needs (the set's and the whole cast's under its lights)
    show('Building the set', 0.88)
    await this.switchEnv(targetEnv, false)
    if (gen !== this.gen) return
    show('Preparing the scene', 0.95)
    await this.warmCast()
    if (gen !== this.gen) return

    this.pendingInstant = path
    if (music !== undefined) audio.setMusic(music ?? null)
    if (ambience !== undefined) audio.setAmbience(ambience ?? null)
    // Stage the first beat and draw it a few times under the loading screen:
    // the first real frames compile what nothing else does (shadow maps, post
    // effects, the shot's exact mix of materials), so the reveal doesn't hitch.
    await this.stageCurrent()
    await this.warmAndSettle(4)
    if (run !== this.run) return
    this.frameRate?.hold(1500)
    useGame.getState().setLoading(null)
    markPlaying(scene.id)

    // 6. Stream
    void this.streamAhead(scene, manifest, targetEnv, run)
  }

  /** Resolves after `n` frames have rendered (or a second, if rendering is paused). */
  private frames(n: number): Promise<void> {
    const scene = this.bjs?.scene
    if (!scene) return Promise.resolve()
    return new Promise((resolve) => {
      let left = n
      const timer = window.setTimeout(done, 1000)
      const obs = scene.onAfterRenderObservable.add(() => --left <= 0 && done())
      function done() {
        window.clearTimeout(timer)
        scene!.onAfterRenderObservable.remove(obs)
        resolve()
      }
    })
  }

  /**
   * Under a loading screen or fade: draws the staged beat a few times and
   * waits for the GPU to finish building what those frames need, so the
   * reveal opens on a running scene instead of a frozen one.
   */
  private async warmAndSettle(frames: number): Promise<void> {
    await this.frames(frames)
    await this.gpuIdle()
  }

  /**
   * Resolves once the GPU has finished everything submitted so far. On WebGPU
   * a frame is "rendered" once it's submitted, but the GPU thread builds the
   * frame's new pipelines (shaders) after the page has moved on: on a
   * Mali-G68 the ~30 an opening needs took over 4 s, so a reveal that only
   * waited for frames froze for that long right after it. Capped, so a lost
   * device can't hang a loading screen. WebGL compiles before drawing (the
   * scene waits for that itself), so there's nothing to wait for there.
   */
  private gpuIdle(): Promise<void> {
    const device = (this.bjs?.engine as { _device?: GPUDevice } | undefined)?._device
    if (!device) return Promise.resolve()
    return Promise.race([device.queue.onSubmittedWorkDone(), sleep(10000)]).then(() => undefined, () => undefined)
  }

  /**
   * Compiles every cast member's materials for the live set's lights while the
   * loading screen is up, so nobody's first entrance stalls the frame.
   */
  private async warmCast(): Promise<void> {
    const scene = this.bjs?.scene
    if (!scene) return
    const hidden = [...this.actors.values()].filter((a) => !a.visible)
    for (const a of hidden) a.setVisible(true)
    await scene.whenReadyAsync()
    for (const a of hidden) a.setVisible(false)
  }

  /**
   * Background loading while the scene plays: the scene's other sets in the
   * order it visits them, the rest of its sound, then the next scene's story
   * and files (downloaded only; they are decoded at its loading screen). Waits
   * out skill moments and set changes, one file at a time, so play never
   * stalls on it.
   */
  private async streamAhead(scene: SceneData, manifest: SceneManifest, first: EnvironmentId, run: number): Promise<void> {
    const calm = async () => {
      for (;;) {
        if (run !== this.run || !this.bjs || useGame.getState().scene !== scene) return false
        const st = useGame.getState()
        if (!st.fade && !st.loading && currentBeat(st)?.type !== 'qte') return true
        await sleep(400)
      }
    }
    await sleep(1500)
    for (const env of manifest.envs) {
      if (env.id === first) continue
      if (!(await calm()) || !this.envs || !this.bjs) return
      await this.envs.prefetch(env.id)
      for (const url of env.urls) {
        if (isLoaded([url])) continue
        if (!(await calm()) || !this.bjs) return
        this.frameRate?.hold(800)
        await load([url], this.bjs.scene, { background: true })
      }
    }
    if (!(await calm())) return
    await audio.stream(manifest.audio)
    const next = scene.next?.id
    if (!next || !isPlayable(next) || !(await calm())) return
    const data = await loadScene(next).catch(() => null)
    if (!data || !(await calm())) return
    const m = sceneManifest(data)
    await prefetchBytes(sceneFiles(m).filter((u) => !isLoaded([u])), 1)
    if (await calm()) await audio.stream(m.audio)
  }

  /**
   * The set a beat plays in: its own `env`, or the last one set before it in
   * the beats played so far (the scene's first set if none was).
   */
  private envOf(scene: SceneData, beat: Beat | null): EnvironmentId {
    // a beat already played (one being settled on a jump or resume) is looked up
    // where it was played, not after the rest of the path
    const played = playedBeats()
    const index = beat ? played.lastIndexOf(beat) : -1
    const list = index >= 0 || !beat ? played : [...played, beat]
    const at = index >= 0 ? index : list.length - 1
    for (let i = at; i >= 0; i--) {
      const e = list[i].env
      if (e) return e
    }
    return scene.environments[0]
  }

  private async switchEnv(id: EnvironmentId, fade: boolean): Promise<void> {
    if (this.envId === id || !this.envs) return
    if (fade) this.holding = true
    for (const a of this.actors.values()) {
      a.setVisible(false)
      a.setHeight(0)
    }
    this.interaction?.end()
    this.props?.clearDropped()
    // still streaming (a slow connection): show the progress instead of a long freeze
    const waiting = !isLoaded(envAssets(id))
    const onProgress = waiting && fade ? (p: number) => useGame.getState().setLoading({ label: 'Loading', progress: p, kind: 'stream' }) : undefined
    const env = await this.envs.switchTo(id, onProgress)
    if (onProgress) useGame.getState().setLoading(null)
    // a new set compiles shaders and uploads textures for a moment: not a pacing problem
    this.frameRate?.hold(3000)
    this.resolution?.enterSet(id)
    const meshes: AbstractMesh[] = []
    const mats = new Set<Material>()
    for (const a of this.actors.values())
      for (const m of a.rig.meshes.values()) {
        meshes.push(m)
        if (m.material) mats.add(m.material)
      }
    env.adopt(meshes, [...mats])
    this.props?.adoptAll()
    if (this.fill) this.fill.includedOnlyMeshes = meshes
    this.envId = id
  }

  /**
   * Cuts to the new set: rendering resumes with the beat already staged, so
   * the first frame drawn is the new shot. A newer cut keeps its own hold.
   */
  private revealAfterFade(): void {
    this.frameRate?.hold(1500)
    this.holding = false
    if (useGame.getState().fade) useGame.getState().setFade(false)
  }

  private disposeActors(): void {
    this.props?.clear()
    this.blobs?.clear()
    for (const a of this.actors.values()) a.dispose()
    this.actors.clear()
    this.talker = null
  }

  // ── Beat staging ────────────────────────────────────────────────────────

  private async stageCurrent(): Promise<void> {
    const s = useGame.getState()
    const beat = currentBeat(s)
    if (!beat || !s.scene || !this.bjs) return
    // phones: 30 fps for talk and cutscenes, full rate when the player acts
    this.frameRate?.setCap(this.bjs.tier !== 'high' && !ACTIVE_BEATS.has(beat.type) ? CALM_FPS : null)
    const gen = ++this.gen
    this.resetBeat()
    const env = this.envOf(s.scene, beat)
    const switched = env !== this.envId
    if (switched) {
      await this.switchEnv(env, true)
      if (gen !== this.gen) return this.revealAfterFade()
    }
    const pending = this.pendingInstant
    this.pendingInstant = []
    for (const b of pending) if (this.envOf(s.scene, b) === env) this.applyInstant(b)
    this.stageBeat(beat)
    if (switched) this.revealAfterFade()
  }

  private resetBeat(): void {
    if (this.staged?.type === 'drive') this.envs?.active?.drive?.stop()
    this.arrivedFor = null
    this.staged = null
    this.timeline = []
    this.holdUntil = null
    this.clock = 0
    this.restoreTalker()
    if (useGame.getState().aside === null) this.interaction?.end()
  }

  private restoreTalker(): void {
    if (this.talker && !this.talker.walking) this.talker.play(this.talker.pose)
    this.talker = null
  }

  private stageBeat(beat: Beat): void {
    if (beat.stage) this.applyStage(beat.stage, false)
    if (beat.cue) this.applyCue(beat.cue, false)
    if (beat.shot) this.cine?.set(beat.shot)

    // whoever was speaking stops when the story moves on; a choice asked aloud speaks its question
    if (beat.type === 'choice') audio.playVoice(voiceFor(beat.context?.speaker, beat.context?.text))
    else if (beat.type !== 'line') audio.playVoice(undefined)
    switch (beat.type) {
      case 'line': {
        // a thought plays over a held shot: nobody moves their lips or hands
        if (!beat.thought) this.speak(beat.speaker, beat.gesture)
        if (!beat.shot) this.cine?.set({ cam: `close:${beat.speaker}` })
        audio.playVoice(beat.thought ? undefined : beat.voice ?? voiceFor(beat.speaker, beat.text))
        break
      }
      case 'shot':
        this.holdUntil = beat.hold
        break
      case 'caption':
        if (beat.hold) this.holdUntil = beat.hold
        break
      case 'drive':
        this.envs?.active?.drive?.start(beat.destination, beat.distance)
        if (!beat.shot) this.cine?.set({ cam: 'drive_chase', blend: 0 })
        break
      case 'explore':
        this.interaction?.begin(beat)
        if (this.cine) this.cine.followYaw = beat.cameraYaw ?? null
        if (!beat.shot) this.cine?.set({ cam: 'follow:rookie', blend: 0.9 })
        break
      default:
        break
    }
    this.staged = beat
    // the skill moment's first prompt can start before the beat is staged (staging clears the timeline)
    if (this.earlyPrompt?.beat === beat) this.schedule(beat.type === 'qte' ? beat.onPrompt : undefined, this.earlyPrompt.index)
    this.earlyPrompt = null
  }

  private speakTurn = new Map<ActorId, number>()

  private speak(id: ActorId, gesture?: Gesture): void {
    const a = this.actors.get(id)
    if (!a) return
    let g: Gesture = gesture ?? this.nextSpeaking(id)
    // holding a pose (on the phone, arms crossed, lying down): keep it while talking
    if (!gesture && (g === 'idle' || ['phone', 'sleep', 'lean_rail', 'kneel_work'].includes(a.pose))) return
    // a seated speaker stays in the chair: head gestures still play, anything that
    // would stand him up (talk, stance, a point) is talked through sitting down
    if ((a.pose === 'sit' || a.pose === 'sit_talk') && g !== 'nod' && g !== 'shake_head') g = 'sit_talk'
    if (g === 'talk' && a.pose === 'lean_rail') return
    a.play(g)
    if (gestureFor(id, g)?.loop) this.talker = a
  }

  /** The next pose from this character's speaking rotation. */
  private nextSpeaking(id: ActorId): Gesture {
    const list = SPEAKING[id] ?? SPEAKING_DEFAULT
    const i = this.speakTurn.get(id) ?? 0
    this.speakTurn.set(id, i + 1)
    return list[i % list.length]
  }

  /** Rookie says the line he picked, in the choice's echo shot if it has one (else the shot it was made in). */
  private stageEcho(echo: Spoken): void {
    this.restoreTalker()
    this.speak(echo.speaker, echo.gesture)
    audio.playVoice(voiceFor(echo.speaker, echo.text))
    const beat = currentBeat(useGame.getState())
    if (beat?.type === 'choice' && beat.echoShot) this.cine?.set(beat.echoShot)
  }

  private stageAside(s: GameState): void {
    const a = s.aside
    if (a) {
      this.interaction?.setBusy(true)
      this.restoreTalker()
      const line = a.lines[a.index]
      this.speak(line.speaker, line.gesture)
      audio.playVoice(voiceFor(line.speaker, line.text))
      this.cine?.set({ cam: `medium:${line.speaker}`, blend: 0.6 })
    } else {
      this.interaction?.setBusy(false)
      this.restoreTalker()
      audio.playVoice(undefined)
      const beat = currentBeat(s)
      if (beat?.type === 'explore') this.cine?.set({ cam: 'follow:rookie', blend: 0.8 })
    }
  }

  private applyInstant(beat: Beat): void {
    if (beat.stage) this.applyStage(beat.stage, true)
    if (beat.cue?.env) for (const e of beat.cue.env) this.envs?.active?.event(e, true)
    for (const ev of beat.cue?.timeline ?? []) this.runEvent(ev, true)
  }

  private applyCue(cue: Cue, instant: boolean): void {
    if (!instant) {
      if ('music' in cue) audio.setMusic(cue.music ?? null, cue.fade)
      if ('ambience' in cue) audio.setAmbience(cue.ambience ?? null, cue.fade)
      if (cue.sfx) audio.play(cue.sfx)
    }
    for (const e of cue.env ?? []) this.envs?.active?.event(e, instant)
    if (cue.timeline) this.timeline = [...cue.timeline].sort((a, b) => a.at - b.at)
  }

  private runEvent(ev: TimelineEvent, instant = false): void {
    if (ev.env) this.envs?.active?.event(ev.env, instant)
    if (ev.stage) this.applyStage(ev.stage, instant)
    if (instant) return
    if (ev.sfx) audio.play(ev.sfx)
    if (ev.shake) this.cine?.shake(ev.shake)
    if (ev.flash) window.dispatchEvent(new CustomEvent(FLASH_EVENT))
    if (ev.fx === 'silence') audio.silence(3)
    else if (ev.fx) window.dispatchEvent(new CustomEvent(FX_EVENT, { detail: ev.fx }))
    if (ev.shot) this.cine?.set(ev.shot)
    if (ev.slowmo) this.slowmo = Math.max(this.slowmo, ev.slowmo)
  }

  /** Floor position of a place: [x, z, y]. */
  private place(p: Place): [number, number, number] {
    if (Array.isArray(p)) return [p[0], p[1], 0]
    const m = this.envs?.active?.marks[p]
    if (!m) {
      console.warn(`[underworld] unknown mark "${p}"`)
      return [0, 0, 0]
    }
    return [m[0], m[1], m[2] ?? 0]
  }

  /** A point to look at: an actor's head, or a place at its mark height (1.5 m by default). */
  private lookPoint(target: ActorId | Place): Vector3 {
    const other = typeof target === 'string' ? this.actors.get(target as ActorId) : undefined
    if (other) return other.head()
    const m = typeof target === 'string' ? this.envs?.active?.marks[target] : target
    if (!m) {
      console.warn(`[underworld] unknown look target "${String(target)}"`)
      return new Vector3(0, 1.5, 0)
    }
    return new Vector3(m[0], m[2] ?? 1.5, m[1])
  }

  private faceTarget(a: Actor, target: ActorDirective['face'], instant: boolean): void {
    if (target === undefined) return
    if (typeof target === 'number') return a.faceYaw((target * Math.PI) / 180, instant)
    const other = typeof target === 'string' ? this.actors.get(target as ActorId) : undefined
    if (other && other !== a) return a.facePoint(other.position.x, other.position.z, instant)
    const [x, z] = this.place(target as Place)
    a.facePoint(x, z, instant)
  }

  private applyStage(stage: StageDirective, instant: boolean): void {
    // Everyone moved by this directive lands first, so an actor told to face
    // another turns to where that one now stands, not where they stood before
    // (the order the actors are listed in mustn't matter).
    for (const [id, d] of Object.entries(stage) as [ActorId, ActorDirective][]) {
      const a = this.actors.get(id)
      if (!a || !d.at) continue
      const [x, z] = this.place(d.at)
      a.place(x, z)
    }
    for (const [id, d] of Object.entries(stage) as [ActorId, ActorDirective][]) {
      const a = this.actors.get(id)
      if (!a) continue
      if (d.at || d.walk || d.pose || d.play || d.patrol || d.routine || d.show === false) {
        this.patrols.delete(id)
        this.routines.delete(id)
      }
      if (d.show !== undefined) a.setVisible(d.show)
      else if (d.at || d.walk) a.setVisible(true)
      if (d.outfit) for (const [g, on] of Object.entries(d.outfit)) a.rig.setGarment(g, on)
      // `y` with `walk` is a climb (stairs): start at the mark's height, arrive at `y`
      const climbing = d.walk !== undefined && d.y !== undefined
      if (d.at) {
        const [x, z, y] = this.place(d.at)
        a.setHeight(climbing ? y : (d.y ?? y))
        a.place(x, z)
      } else if (d.y !== undefined && !climbing) a.setHeight(d.y)
      if (climbing && instant) a.setHeight(d.y!)
      // lying down and getting up are never blended: across a cut he's simply
      // asleep, or simply on his feet (a crossfade reads as a morph)
      const snapPose = Boolean(d.at && d.pose && d.pose !== a.pose && (d.pose === 'sleep' || a.pose === 'sleep'))
      if (d.pose) {
        a.pose = d.pose
        if (id === 'rookie' && this.envs?.active?.id === 'room') this.envs.active.event(d.pose === 'sleep' ? 'bedSleep' : 'bedWake', true)
      }
      if (d.carry !== undefined) this.props?.carry(a, d.carry, instant)

      const walk = d.walk === undefined ? [] : Array.isArray(d.walk) && typeof d.walk[0] === 'number' ? [d.walk as Place] : ([] as Place[]).concat(d.walk as Place | Place[])
      if (walk.length) {
        const pts = walk.map((p) => {
          const [x, z] = this.place(p)
          return new Vector3(x, 0, z)
        })
        if (instant) {
          const last = pts[pts.length - 1]
          a.place(last.x, last.z)
        } else {
          const obstacles = this.envs?.active?.obstacles ?? []
          const route: Vector3[] = []
          let from = new Vector3(a.position.x, 0, a.position.z)
          for (const p of pts) {
            route.push(...planPath(from, p, obstacles))
            from = p
          }
          a.walk(
            route,
            d.pace ?? 'walk',
            () => {
              this.faceTarget(a, d.face, false)
              // walking up to a seat: lower into it rather than snapping to the loop
              if (d.pose === 'sit') a.play('sit_down')
            },
            climbing ? d.y : undefined,
          )
        }
      }
      if (d.face !== undefined && (!walk.length || instant)) this.faceTarget(a, d.face, instant || Boolean(d.at))
      if (d.look !== undefined) a.lookAt(d.look === null ? null : this.lookPoint(d.look), instant)
      if (d.pose && (!walk.length || instant)) a.setPose(d.pose, instant || snapPose)
      if (d.patrol?.length) {
        const points = d.patrol.map((p) => {
          const [x, z] = this.place(p)
          return new Vector3(x, 0, z)
        })
        if (!d.at) a.place(points[0].x, points[0].z)
        a.setVisible(true)
        this.patrols.set(id, { points, pace: d.pace, i: 1, wait: instant ? 0 : Math.random() * 1.5, moving: false })
      }
      if (d.routine?.length) this.routines.set(id, { gestures: d.routine, i: 0, wait: Math.random() * 0.8 })
      if (d.play) {
        const def = gestureFor(a.id, d.play)
        if (!instant) a.play(d.play)
        else if (def?.then === 'hold') a.holdPose(d.play)
      }
    }
  }

  // ── Player-facing hooks ─────────────────────────────────────────────────

  /** Skip button: jump to the next interactive beat, settling the world as if it had played. */
  skip(): void {
    const s = useGame.getState()
    if (!s.scene) return
    this.holdUntil = null
    // the story moves on now; the stager settles the skipped beats when it stages the new one
    this.pendingInstant = s.skip()
  }

  /**
   * Test/debug hook: jump to any beat, settling the world as if every beat
   * before it had played with the current choices.
   */
  jumpTo(beatId: string): void {
    const s = useGame.getState()
    if (!s.scene) return
    this.pendingInstant = s.jumpTo(beatId)
  }

  /** Foot on or off the throttle, while a drive beat is on. */
  throttle(on: boolean): void {
    const drive = this.staged?.type === 'drive' ? this.envs?.active?.drive : undefined
    if (!drive || this.paused) return
    const was = drive.state()
    drive.throttle(on)
    if (on && !was.arrived && was.speed < 2) audio.play('engine')
  }

  /** The drive readout: metres to go, speed, arrived. Null outside a drive beat. */
  driveState(): { left: number; speed: number; arrived: boolean } | null {
    if (this.staged?.type !== 'drive') return null
    return this.envs?.active?.drive?.state() ?? null
  }

  /**
   * Test hook (scripts/walk-audit.mjs): plans every walk the current explore
   * beat allows (from where Rookie stands, and from each place to each other)
   * and casts along each leg at knee and waist height against the set's
   * geometry; returns every leg that would pass through something solid.
   */
  walkAudit(): { from: string; to: string; hits: string[] }[] {
    const beat = this.staged
    const scene = this.bjs?.scene
    const env = this.envs?.active
    const rookie = this.actors.get('rookie')
    if (beat?.type !== 'explore' || !scene || !env || !rookie) return []
    const actorRoots = [...this.actors.values()].map((a) => a.rig.root)
    const walkable = new Set(env.walkable)
    const solid = (m: AbstractMesh) =>
      m.isEnabled() && m.isVisible && m.visibility > 0.5 && m.getTotalVertices() > 0 && !walkable.has(m) && !actorRoots.some((r) => m.isDescendantOf(r))
    const stands = beat.hotspots.map((h) => {
      const [ax, az] = this.place(h.at)
      if (h.stand) {
        const [sx, sz] = this.place(h.stand)
        return { id: h.id, at: new Vector3(sx, 0, sz) }
      }
      const dir = new Vector3(rookie.position.x - ax, 0, rookie.position.z - az).normalize().scale(1.1)
      return { id: h.id, at: new Vector3(ax, 0, az).add(dir) }
    })
    const starts = [{ id: 'start', at: new Vector3(rookie.position.x, 0, rookie.position.z) }, ...stands]
    const out: { from: string; to: string; hits: string[] }[] = []
    for (const s of starts)
      for (const t of stands) {
        if (s.id === t.id) continue
        const hits = new Set<string>()
        let prev = s.at
        for (const p of planPath(s.at, t.at, env.obstacles)) {
          const leg = p.subtract(prev)
          const len = leg.length()
          if (len > 0.05)
            for (const y of [0.45, 1.0]) {
              const hit = scene.pickWithRay(new Ray(new Vector3(prev.x, y, prev.z), leg.normalizeToNew(), len), solid)
              if (hit?.hit && hit.pickedMesh) hits.add(`${hit.pickedMesh.name} @${hit.pickedPoint?.x.toFixed(1)},${hit.pickedPoint?.z.toFixed(1)}`)
            }
          prev = p
        }
        if (hits.size) out.push({ from: s.id, to: t.id, hits: [...hits] })
      }
    return out
  }

  /** Explore decision: Rookie walks to the picked place. False if he can't set off now. */
  walkToHotspot(id: string): boolean {
    return this.interaction?.goTo(id) ?? false
  }

  /** A QTE prompt resolved: play the matching beat event now. */
  qte(beat: QteBeat, index: number, hit: boolean): void {
    this.schedule(hit ? beat.onHit : beat.onMiss, index)
  }

  /** A timing prompt began: start what the player is reacting to (the opponent's punch). */
  qtePrompt(beat: QteBeat, index: number): void {
    if (this.staged !== beat) this.earlyPrompt = { beat, index }
    else this.schedule(beat.onPrompt, index)
  }

  private schedule(list: TimelineEvent[][] | undefined, index: number): void {
    if (!list?.length) return
    for (const ev of list[index % list.length]) this.timeline.push({ ...ev, at: this.clock + ev.at })
    this.timeline.sort((a, b) => a.at - b.at)
  }

  // ── Frame ───────────────────────────────────────────────────────────────

  private update(realDt: number): void {
    // Slow motion eases in and out; the camera keeps real time so moves stay fluid.
    this.slowmo = Math.max(0, this.slowmo - realDt)
    this.timeScale += ((this.slowmo > 0 ? 0.25 : 1) - this.timeScale) * Math.min(1, realDt * 9)
    if (this.bjs) this.bjs.scene.animationTimeScale = this.paused ? 0 : this.timeScale
    const dt = realDt * this.timeScale
    if (!this.paused) {
      this.clock += dt
      while (this.timeline.length && this.timeline[0].at <= this.clock) this.runEvent(this.timeline.shift()!)
      if (this.holdUntil !== null && this.clock >= this.holdUntil) {
        this.holdUntil = null
        useGame.getState().advance()
      }
      this.envs?.update(dt)
      // a drive beat ends a moment after the car pulls up at the destination
      if (this.staged?.type === 'drive' && this.envs?.active?.drive?.state().arrived) {
        this.arrivedFor = (this.arrivedFor ?? 0) + dt
        if (this.arrivedFor > 2) {
          // once: staging the next beat resets it (and stops the trip)
          this.arrivedFor = -Infinity
          useGame.getState().advance()
        }
      }
      this.updateBackgroundLife(dt)
      for (const a of this.actors.values()) if (a.visible) a.update(dt)
      this.separateActors()
      this.interaction?.update(dt)
    }
    this.cam?.update(realDt)
  }

  private updateBackgroundLife(dt: number): void {
    for (const [id, p] of this.patrols) {
      const a = this.actors.get(id)
      if (!a?.visible) continue
      if (p.moving) {
        if (a.walking) continue
        p.moving = false
        p.wait = 1.6 + Math.random() * 2.4
      }
      p.wait -= dt
      if (p.wait > 0) continue
      const to = p.points[p.i % p.points.length]
      p.i++
      p.moving = true
      a.walk(planPath(new Vector3(a.position.x, 0, a.position.z), to, this.envs?.active?.obstacles ?? []), p.pace ?? 'walk')
    }
    for (const [id, r] of this.routines) {
      const a = this.actors.get(id)
      if (!a?.visible || a.walking || a.busy) continue
      r.wait -= dt
      if (r.wait > 0) continue
      a.play(r.gestures[r.i++ % r.gestures.length])
      r.wait = 0.15 + Math.random() * (r.i % r.gestures.length === 0 ? 1.4 : 0.45)
    }
  }

  /** Keeps people from walking through each other: overlapping actors are eased apart. */
  private separateActors(): void {
    const list = [...this.actors.values()].filter((a) => a.visible && a.pose !== 'sit' && a.pose !== 'sit_talk')
    const MIN = 0.62
    for (let i = 0; i < list.length; i++)
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (Math.abs(a.position.y - b.position.y) > 0.3) continue
        const dx = b.position.x - a.position.x
        const dz = b.position.z - a.position.z
        const d = Math.hypot(dx, dz)
        if (d >= MIN || d < 1e-4) continue
        const push = (MIN - d) / d
        // the one on the move gives way; two still actors share it
        const wa = a.walking && !b.walking ? 1 : !a.walking && b.walking ? 0 : 0.5
        a.position.x -= dx * push * wa
        a.position.z -= dz * push * wa
        b.position.x += dx * push * (1 - wa)
        b.position.z += dz * push * (1 - wa)
      }
  }

  /**
   * Called by the frame governor when the device can't hold its frame rate
   * and the GPU is the bottleneck. Resolution goes first, a step at a time
   * down to the tier's floor: phone GPUs are limited by pixels, so it helps
   * most, and the ResolutionScaler wins it back once there's room (a shed
   * effect never comes back). Then the post effects (grain, depth of field,
   * bloom: one full-screen pass each). False when none of that can help, so
   * the governor lowers the frame rate instead.
   */
  private relieve(): boolean {
    const bjs = this.bjs
    const target = this.frameRate?.targetFps
    if (!bjs || !target) return false
    if (this.cpuMs > 0.7 * (1000 / target)) return false
    const p = bjs.pipeline
    const shed = (what: string) => {
      if (import.meta.env.DEV) console.info(`[underworld] frame rate: dropping ${what}`)
      return true
    }
    if (bjs.ssao) {
      bjs.ssao.dispose()
      bjs.ssao = null
      return shed('ambient occlusion')
    }
    if (this.resolution?.stepDown()) return shed('resolution')
    if (p.grainEnabled) return (p.grainEnabled = false), shed('grain')
    if (p.depthOfFieldEnabled) return (p.depthOfFieldEnabled = false), shed('depth of field')
    if (p.bloomEnabled) return (p.bloomEnabled = false), shed('bloom')
    return false
  }
}

export const engine = new GameEngine()
