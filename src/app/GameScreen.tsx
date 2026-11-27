import { useEffect, useRef, useState } from 'react'
import { ChoiceList } from '../components/choices/ChoiceList'
import { CallOverlay } from '../components/cinematic/CallOverlay'
import { JobCard } from '../components/cinematic/JobCard'
import { MessageOverlay } from '../components/cinematic/MessageOverlay'
import { ElapsedBadge, FxLayer, SceneTag, SkipButton, TitleCard, Toasts } from '../components/cinematic/CinematicOverlays'
import { VideoLayer } from '../components/cinematic/VideoLayer'
import { ComicHeader, LogSheet, NarrationBox, NextButton, PanelCaption, type LogEntry } from '../components/comic/ComicPage'
import { DialoguePanel, useReveal } from '../components/dialogue/DialoguePanel'
import { DriveOverlay } from '../components/interaction/DriveOverlay'
import { ExploreChoices } from '../components/interaction/ExploreChoices'
import { QteOverlay } from '../components/interaction/QteOverlay'
import { SceneComplete } from '../components/menus/SceneComplete'
import { SettingsSheet } from '../components/menus/SettingsSheet'
import { StandingSheet } from '../components/menus/StandingSheet'
import { audio } from '../game/audio/AudioManager'
import { engine } from '../game/engine/GameEngine'
import { loadScene } from '../game/engine/SceneManager'
import { currentBeat, useGame } from '../store/gameStore'

/**
 * The playable scene: the top bar, the 3D canvas full width, then below
 * it the speaker and line (over the scene's darkened foot), narration,
 * choices or a skill moment (scrolling if they don't fit). The scene fills
 * the page for cutscenes, title cards and exploring, and otherwise keeps one
 * height, so the text area is the same size with or without a decision. The
 * story moves on only with Next (or Space/Enter): a full-width button under
 * the line or narration, or in the scene's corner on cutscenes. It lights up
 * once a line has finished typing; tapping the line finishes it early.
 */
export default function GameScreen() {
  const canvas = useRef<HTMLCanvasElement>(null)
  const beat = useGame(currentBeat)
  const scene = useGame((s) => s.scene)
  const echo = useGame((s) => s.echo)
  const aside = useGame((s) => s.aside)
  const completeOpen = useGame((s) => s.completeOpen)
  const menuOpen = useGame((s) => s.menuOpen)
  const loading = useGame((s) => s.loading)
  const fading = useGame((s) => s.fade)
  const textSpeed = useGame((s) => s.settings.textSpeed)
  const { advance, nextAside, setMenuOpen, startScene } = useGame.getState()
  const [log, setLog] = useState<LogEntry[]>([])
  const [logOpen, setLogOpen] = useState(false)
  const [standingOpen, setStandingOpen] = useState(false)

  useEffect(() => {
    if (canvas.current) void engine.attach(canvas.current)
    return () => engine.detach()
  }, [])

  const spoken = aside ? aside.lines[aside.index] : echo ? echo : beat?.type === 'line' ? beat : null
  const reveal = useReveal(spoken?.text ?? null, textSpeed)
  const thought = !aside && !echo && beat?.type === 'line' && Boolean(beat.thought)
  const choice = beat?.type === 'choice' && !echo ? beat : null
  const ready = !loading && !completeOpen
  const calling = beat?.type === 'call' && !echo ? beat : null
  const message = beat?.type === 'message' && !echo ? beat : null
  const job = beat?.type === 'job' && !echo ? beat : null
  // exploring is a pick from a list of places, between asides
  const explore = beat?.type === 'explore' && !aside ? beat : null
  const waiting = ready && !menuOpen && !logOpen && !standingOpen && (beat?.type === 'title' || spoken !== null || calling !== null || message !== null || job !== null || (beat?.type === 'caption' && !beat.hold))
  const nextReady = waiting && (!spoken || reveal.done)
  const cinematic = Boolean(beat?.cinematic) || beat?.type === 'title' || beat?.type === 'shot'

  const sceneCaption = beat?.type === 'caption' ? { label: beat.label, text: beat.text } : beat?.type === 'shot' ? beat.caption : undefined
  // narration between lines sits where the bubble does; in cutscenes it is the panel's caption
  const narration = !spoken && !cinematic && beat?.type === 'caption' ? sceneCaption : undefined
  const panelCaption = spoken || narration ? undefined : choice?.style === 'card' ? { label: choice.context.label, text: choice.context.text } : explore ? { label: explore.tag, text: explore.prompt } : sceneCaption
  // the panel shares the page when there is something to read or pick below it
  const split = Boolean(spoken || narration || choice || explore || beat?.type === 'qte')

  // Story log: every line, caption and pick of this scene, in order.
  useEffect(() => setLog([]), [scene?.id])
  const remember = (entry: LogEntry) => setLog((l) => (l.length && l[l.length - 1].text === entry.text ? l : [...l, entry]))
  useEffect(() => {
    if (spoken) remember({ kind: 'line', speaker: spoken.speaker, text: spoken.text })
  }, [spoken?.text])
  const told = narration ?? panelCaption
  useEffect(() => {
    if (told) remember({ kind: 'caption', label: told.label, text: told.text })
  }, [told?.text])
  useEffect(() => {
    if (calling) remember({ kind: 'caption', label: 'Incoming call', text: calling.caller })
  }, [calling?.id])
  useEffect(() => {
    if (message) remember({ kind: 'caption', label: `Message · ${message.sender}`, text: message.text })
  }, [message?.id])
  useEffect(() => {
    if (job) remember({ kind: 'caption', label: `Job · ${job.name}`, text: `${job.pay} · Risk ${job.risk}. ${job.objective}` })
  }, [job?.id])

  /** Next: finishes a line still typing, otherwise moves the story on. */
  const onNext = () => {
    if (!waiting) return
    if (spoken && !reveal.done) return reveal.finish()
    audio.play('ui_tap')
    if (aside) nextAside()
    else advance()
  }
  const nextRef = useRef(onNext)
  nextRef.current = onNext

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        nextRef.current()
      } else if (e.key === 'Escape') setMenuOpen(!useGame.getState().menuOpen)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setMenuOpen])

  const chrome = ready && beat !== null
  // a call is answered with its own button
  const next = waiting && !calling ? <NextButton ready={nextReady} onNext={onNext} /> : null

  return (
    <div className={`game game--comic ${cinematic ? 'is-cinematic' : ''} ${split ? 'is-split' : 'is-splash'}`}>
      {chrome && <ComicHeader />}

      <section className="stage" aria-label="Scene">
        <canvas ref={canvas} className="game__canvas" />
        <div className={`letterbox ${cinematic && !completeOpen ? 'is-on' : ''}`} aria-hidden="true" />
        {ready && beat && (
          <>
            {panelCaption && <PanelCaption label={panelCaption.label} text={panelCaption.text} />}
            {beat.elapsed !== undefined && <ElapsedBadge seconds={beat.elapsed} />}
            {beat.tag && !panelCaption && <SceneTag text={beat.tag} />}
            {beat.type === 'title' && <TitleCard beat={beat} />}
            {beat.type === 'video' && <VideoLayer beat={beat} onEnd={advance} />}
            {beat.type === 'drive' && <DriveOverlay beat={beat} />}
            {calling && <CallOverlay beat={calling} onAnswer={onNext} />}
            {message && <MessageOverlay beat={message} />}
            {job && <JobCard beat={job} />}
            {cinematic && beat.type !== 'complete' && <SkipButton onSkip={() => engine.skip()} />}
            {next && !split && <div className="panel-next">{next}</div>}
          </>
        )}
      </section>

      {ready && beat && split && (
        <div className={`below ${(spoken || narration) && !choice ? 'below--talk' : ''}`} key={`${beat.id}:${spoken?.text ?? ''}`}>
          {spoken && <DialoguePanel speaker={spoken.speaker} text={reveal.visible} fullText={spoken.text} onTap={reveal.done ? undefined : reveal.finish} thought={thought} />}
          {narration && <NarrationBox label={narration.label} text={narration.text} />}
          {next && (spoken || narration) && <div className="below__next">{next}</div>}
          {choice && (
            <>
              {choice.style !== 'card' && <DialoguePanel speaker={choice.context.speaker} label={choice.context.label} text={choice.context.text} />}
              <h2 className="below__ask">{choice.style === 'card' ? 'What do you do?' : 'What do you say?'}</h2>
              <ChoiceList beat={choice} onPick={(text) => remember({ kind: 'pick', text })} />
            </>
          )}
          {explore && (
            <>
              <h2 className="below__ask">What do you do?</h2>
              <ExploreChoices beat={explore} />
            </>
          )}
          {/* a skill moment starts once any set change is over, so its timing matches the action */}
          {beat.type === 'qte' && !fading && <QteOverlay beat={beat} />}
        </div>
      )}

      {completeOpen && scene && <SceneComplete scene={scene} />}
      <Toasts />
      <FxLayer />
      {logOpen && <LogSheet entries={log} onClose={() => setLogOpen(false)} />}
      {standingOpen && <StandingSheet onClose={() => setStandingOpen(false)} />}
      {menuOpen && (
        <SettingsSheet
          inGame
          onClose={() => setMenuOpen(false)}
          onRestart={async () => scene && startScene(await loadScene(scene.id), true)}
          onLog={() => {
            setMenuOpen(false)
            setLogOpen(true)
          }}
          onStanding={() => {
            setMenuOpen(false)
            setStandingOpen(true)
          }}
          info={`Renderer: ${engine.backend === 'webgpu' ? 'WebGPU' : 'WebGL 2'} · ${Math.round(engine.fps)} fps`}
        />
      )}
    </div>
  )
}
