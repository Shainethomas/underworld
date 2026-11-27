import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { audio } from '../engine/audio'
import { currentBeat, currentScene, useGame } from '../game/store'
import { SPEAKERS } from '../narrative/speakers'
import type { Beat, ChoiceOption, Hotspot, SpeakerId } from '../narrative/types'
import { Icon } from './Icon'

const CPS = { normal: 48, fast: 100, instant: 10000 }

interface Entry { speaker?: SpeakerId; text: string }

/**
 * The lower half of the game screen. The scene plays in the window above;
 * this panel carries the words — narration, dialogue — and every decision
 * the player makes: continue, choices, fight reactions, where to walk.
 */
export function StoryPanel({ caption }: { caption: string | null }) {
  const beat = useGame(currentBeat)
  const scene = useGame(currentScene)
  const aside = useGame((s) => s.aside)
  const beatSeq = useGame((s) => s.beatSeq)

  // what the story card says right now; holds the previous text through
  // beats that have nothing new to say (choices, explore)
  let entry: Entry | null = null
  if (aside) entry = aside.lines[aside.index]
  else if (beat?.type === 'line') entry = { speaker: beat.speaker, text: beat.text }
  else if (beat?.type === 'video') entry = caption ? { speaker: 'narrator', text: caption } : beat.text ? { text: beat.text } : null
  else if (beat?.text) entry = { text: beat.text }
  const last = useRef<Entry | null>(null)
  if (entry) last.current = entry
  const shown = entry ?? last.current
  const { visible, done, complete } = useTypewriter(shown?.text ?? '')

  const dialogue = !!aside || beat?.type === 'line'
  const advance = () => {
    if (!done) return complete()
    audio.play('tick')
    if (aside) useGame.getState().advanceAside()
    else useGame.getState().advance()
  }
  const speaker = shown?.speaker && shown.speaker !== 'narrator' ? SPEAKERS[shown.speaker] : null

  return (
    <section className="story">
      <div
        className={`dbox ${speaker ? '' : 'dbox--narration'}`}
        style={speaker ? ({ '--tab': speaker.color } as React.CSSProperties) : undefined}
        aria-label={`Scene ${scene.index}`}
        onClick={() => (dialogue ? advance() : complete())}
      >
        {speaker && <span className="dbox__name">{speaker.name}</span>}
        <p className="dbox__text">
          <span>{visible}</span>
          <span className="dbox__ghost">{shown?.text.slice(visible.length)}</span>
        </p>
        {dialogue && done && <span className="dbox__next" />}
      </div>

      <div className="story__actions" key={aside ? `a${aside.index}` : beatSeq}>
        {dialogue && <ContinueButton ready={done} onPress={advance} />}
        {beat?.type === 'choice' && <Choices beat={beat} />}
        {beat?.type === 'qte' && <Reaction label={beat.label} window={beat.window} />}
        {beat?.type === 'explore' && !aside && <ExploreOptions hotspots={beat.hotspots} prompt={beat.prompt} />}
        {!dialogue && (beat?.type === 'hold' || beat?.type === 'video' || beat?.type === 'title') && <Watching />}
      </div>
    </section>
  )
}

function useTypewriter(text: string) {
  const speed = useGame((s) => s.settings.textSpeed)
  const [n, setN] = useState(0)
  const skip = useRef(false)
  useEffect(() => {
    skip.current = false
    setN(0)
    const start = performance.now()
    let raf = 0
    const tick = () => {
      if (skip.current) return
      const k = Math.min(text.length, Math.floor(((performance.now() - start) / 1000) * CPS[speed]))
      setN(k)
      if (k < text.length) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [text, speed])
  return {
    visible: text.slice(0, n),
    done: n >= text.length,
    complete: () => {
      skip.current = true
      setN(text.length)
    },
  }
}

function Prompt({ text, hot }: { text: string; hot?: boolean }) {
  return <p className={`opts__prompt ${hot ? 'opts__prompt--hot' : ''}`}>{text}</p>
}

function useStagger(dep: unknown) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const els = ref.current?.querySelectorAll('.opt, .opts__prompt')
    if (!els?.length) return
    const tl = gsap.fromTo(els, { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.08 })
    return () => {
      tl.kill()
    }
  }, [dep])
  return ref
}

function ContinueButton({ ready, onPress }: { ready: boolean; onPress: () => void }) {
  const auto = useGame((s) => s.settings.autoAdvance)
  useEffect(() => {
    if (!ready || !auto) return
    const t = setTimeout(onPress, 1400)
    return () => clearTimeout(t)
  }, [ready, auto, onPress])
  return (
    <button className={`opt opt--primary opt--continue ${ready ? '' : 'opt--waiting'}`} onClick={onPress}>
      <span className="opt__text">{ready ? 'Continue' : '…'}</span>
    </button>
  )
}

function Choices({ beat }: { beat: Extract<Beat, { type: 'choice' }> }) {
  const ref = useStagger(beat.id)
  const [picked, setPicked] = useState<string | null>(null)
  const pick = (o: ChoiceOption) => {
    if (picked) return
    setPicked(o.id)
    audio.play('confirm')
    setTimeout(() => useGame.getState().choose(beat.id, o.id), 450)
  }
  return (
    <div ref={ref} className="opts">
      <Prompt text={beat.prompt} />
      {beat.options.map((o, i) => (
        <button
          key={o.id}
          className={`opt ${i === 0 ? 'opt--primary' : ''} ${picked === o.id ? 'opt--picked' : picked ? 'opt--dim' : ''}`}
          onClick={() => pick(o)}
        >
          <span className="opt__text">{o.text}</span>
        </button>
      ))}
    </div>
  )
}

/** Fight reaction: one big button against a draining timer. No fail state — it grades timing. */
function Reaction({ label, window }: { label: string; window: number }) {
  const ref = useStagger(label)
  const start = useRef(performance.now())
  const resolved = useRef(false)
  const [hit, setHit] = useState(false)
  const resolve = (ms: number | null) => {
    if (resolved.current) return
    resolved.current = true
    setHit(true)
    if (ms !== null) audio.play('whoosh')
    setTimeout(() => useGame.getState().qteResult(ms), ms === null ? 0 : 120)
  }
  useEffect(() => {
    start.current = performance.now()
    audio.play('heartbeat')
    const t = setTimeout(() => resolve(null), window * 1000)
    return () => clearTimeout(t)
    // the window is fixed for the life of this prompt
  }, [window])
  return (
    <div ref={ref} className="opts">
      <Prompt text="React — now!" hot />
      <button
        className={`opt opt--strike ${hit ? 'opt--picked' : ''}`}
        style={{ '--window': `${window}s` } as React.CSSProperties}
        onPointerDown={() => resolve(performance.now() - start.current)}
      >
        <span className="opt__icon">
          <Icon name="fist" />
        </span>
        <span className="opt__text">{label}</span>
        <span className="opt__cost opt__cost--fear">TAP</span>
        <span className="opt__timer" />
      </button>
    </div>
  )
}

function ExploreOptions({ hotspots, prompt }: { hotspots: Hotspot[]; prompt: string }) {
  const visited = useGame((s) => s.explore.visited)
  const target = useGame((s) => s.explore.target)
  const ref = useStagger(prompt)
  // the main lead first, as the highlighted option
  const ordered = [...hotspots].sort((a, b) => Number(!!b.ends) - Number(!!a.ends))
  return (
    <div ref={ref} className="opts">
      <Prompt text={prompt} />
      {ordered.map((h) => {
        const seen = visited.includes(h.id)
        return (
          <button
            key={h.id}
            className={`opt ${h.ends ? 'opt--primary' : ''} ${seen ? 'opt--seen' : ''} ${target === h.id ? 'opt--picked' : ''}`}
            onClick={() => {
              audio.play('tick')
              useGame.getState().walkToHotspot(h.id)
            }}
          >
            <span className="opt__icon">
              <Icon name={h.icon === 'talk' ? 'talk' : h.icon === 'walk' ? 'walk' : 'eye'} />
            </span>
            <span className="opt__text">{h.action ?? h.label}</span>
            {seen && <span className="opt__cost opt__cost--done">✓</span>}
          </button>
        )
      })}
      <p className="opts__hint">Or tap the street to walk</p>
    </div>
  )
}

function Watching() {
  return (
    <div className="watching">
      <span />
      <span />
      <span />
    </div>
  )
}
