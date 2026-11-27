import { useEffect, useRef, useState, type ReactNode } from 'react'
import { audio } from '../../game/audio/AudioManager'
import { engine } from '../../game/engine/GameEngine'
import type { QteBeat } from '../../game/narrative/types'
import { useGame } from '../../store/gameStore'

type Grade = 'perfect' | 'good' | 'miss'

/** Short contextual skill moments: timed taps, rapid taps, press-and-hold. */
export function QteOverlay({ beat }: { beat: QteBeat }) {
  if (beat.mode === 'timing') return <TimingQte beat={beat} key={beat.id} />
  if (beat.mode === 'mash') return <MashQte beat={beat} key={beat.id} />
  return <HoldQte beat={beat} key={beat.id} />
}

function Frame({ beat, children, footer }: { beat: QteBeat; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="qte" onClick={(e) => e.stopPropagation()}>
      <div className="qte__head">
        <span className="qte__label">{beat.label}</span>
        <span className="qte__hint">{beat.hint}</span>
      </div>
      {children}
      {footer}
    </div>
  )
}

/** A ring closes on a target; tap as it lands. */
function TimingQte({ beat }: { beat: QteBeat }) {
  const finish = useGame((s) => s.finishQte)
  const [index, setIndex] = useState(0)
  const [grade, setGrade] = useState<Grade | null>(null)
  const [results, setResults] = useState<Grade[]>([])
  const start = useRef(performance.now())
  const ring = useRef<HTMLSpanElement>(null)
  const resolved = useRef(false)
  const done = index >= beat.count

  const resolve = (g: Grade) => {
    if (resolved.current || done) return
    resolved.current = true
    setGrade(g)
    setResults((r) => [...r, g])
    engine.qte(beat, index, g !== 'miss')
    window.setTimeout(() => {
      setGrade(null)
      resolved.current = false
      start.current = performance.now()
      setIndex((i) => i + 1)
    }, 480)
  }

  useEffect(() => {
    if (done) {
      const hits = results.filter((r) => r !== 'miss').length
      const t = window.setTimeout(() => finish(beat.result, hits / beat.count), 600)
      return () => window.clearTimeout(t)
    }
    engine.qtePrompt(beat, index)
    let raf = 0
    const tick = () => {
      const k = (performance.now() - start.current) / beat.window
      if (ring.current && !resolved.current) ring.current.style.transform = `scale(${Math.max(0.35, 2.4 - k * 1.65)})`
      if (k > 1.12 && !resolved.current) resolve('miss')
      else raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [index, done])

  // The ring meets the target at 85% of the window
  const tap = () => {
    const off = Math.abs((performance.now() - start.current) / beat.window - 0.85)
    resolve(off < 0.09 ? 'perfect' : off < 0.2 ? 'good' : 'miss')
  }

  return (
    <Frame beat={beat} footer={<Pips total={beat.count} results={results} />}>
      <button className="qte__pad" onPointerDown={tap} disabled={done} aria-label={beat.label}>
        <span className="qte__target" />
        {!done && <span className="qte__closing" ref={ring} />}
        {grade && <span className={`qte__grade qte__grade--${grade}`}>{grade}</span>}
      </button>
    </Frame>
  )
}

/** Tap fast before the bar drains. */
function MashQte({ beat }: { beat: QteBeat }) {
  const finish = useGame((s) => s.finishQte)
  const [taps, setTaps] = useState(0)
  const [left, setLeft] = useState(1)
  const tapsRef = useRef(0)
  const over = useRef(false)

  useEffect(() => {
    const start = performance.now()
    let raf = 0
    const tick = () => {
      const k = 1 - (performance.now() - start) / beat.window
      setLeft(Math.max(0, k))
      if (k <= 0 && !over.current) {
        over.current = true
        window.setTimeout(() => finish(beat.result, Math.min(1, tapsRef.current / beat.count)), 300)
      } else if (!over.current) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const tap = () => {
    if (over.current) return
    const n = ++tapsRef.current
    setTaps(n)
    // every other tap throws a punch so each animation reads clearly
    if (n % 2 === 1 || n === beat.count) engine.qte(beat, Math.floor(n / 2), true)
    if (n >= beat.count) {
      over.current = true
      window.setTimeout(() => finish(beat.result, 1), 500)
    }
  }

  return (
    <Frame beat={beat}>
      <button className="qte__mash" onPointerDown={tap} aria-label={beat.label}>
        <span className="qte__mash-fill" style={{ height: `${Math.min(100, (taps / beat.count) * 100)}%` }} />
        <span className="qte__mash-label">TAP</span>
      </button>
      <span className="qte__timer">
        <span style={{ width: `${left * 100}%` }} />
      </span>
    </Frame>
  )
}

/** Press and hold until the ring fills. */
function HoldQte({ beat }: { beat: QteBeat }) {
  const finish = useGame((s) => s.finishQte)
  const [progress, setProgress] = useState(0)
  const holding = useRef<number | null>(null)
  const complete = useRef(false)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      if (holding.current !== null && !complete.current) {
        const k = Math.min(1, (performance.now() - holding.current) / beat.window)
        setProgress(k)
        if (k >= 1) {
          complete.current = true
          engine.qte(beat, 0, true)
          window.setTimeout(() => finish(beat.result, 1), 650)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const down = () => {
    if (complete.current) return
    holding.current = performance.now()
    audio.play('tape')
  }
  const up = () => {
    if (complete.current) return
    holding.current = null
    setProgress(0)
  }

  const C = 2 * Math.PI * 44
  return (
    <Frame beat={beat}>
      <button className={`qte__hold ${progress >= 1 ? 'is-done' : ''}`} onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} aria-label={beat.label}>
        <svg viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" className="qte__hold-track" />
          <circle cx="50" cy="50" r="44" className="qte__hold-bar" strokeDasharray={C} strokeDashoffset={C * (1 - progress)} />
        </svg>
        <span className="qte__hold-label">{progress >= 1 ? 'Done' : 'Hold'}</span>
      </button>
    </Frame>
  )
}

function Pips({ total, results }: { total: number; results: Grade[] }) {
  return (
    <div className="qte__pips">
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={`qte__pip ${results[i] ? `is-${results[i]}` : ''}`} />
      ))}
    </div>
  )
}
