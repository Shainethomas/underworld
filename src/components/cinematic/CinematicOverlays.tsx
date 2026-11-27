import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { FLASH_EVENT, FX_EVENT } from '../../game/engine/events'
import type { TitleBeat } from '../../game/narrative/types'
import { useGame } from '../../store/gameStore'
import { Icon } from '../common/Icon'
import { LoadingScreen } from '../menus/LoadingScreen'

export function TitleCard({ beat }: { beat: TitleBeat }) {
  return (
    <div className="title-card">
      <div className="title-card__chapter">
        {beat.chapter}
        <span className="title-card__rule" />
      </div>
      {beat.scene && <p className="title-card__scene">{beat.scene}</p>}
      <h1 className="title-card__title">{beat.title}</h1>
      {beat.subtitle && <p className="title-card__sub">{beat.subtitle}</p>}
      <span className="title-card__ornament" />
      <span className="title-card__tap">
        Tap to Continue <Icon name="chevron" size={16} className="rot-90" />
      </span>
    </div>
  )
}

/** A small contextual label on the scene panel, e.g. TRAINING MATCH while the fight plays. */
export function SceneTag({ text }: { text: string }) {
  return (
    <div className="scene-tag" role="status">
      <span className="scene-tag__dot" />
      {text}
    </div>
  )
}

export function CaptionCard({ label, text, card }: { label?: string; text: string; card?: boolean }) {
  return (
    <div className={`caption ${card ? 'caption--card' : ''}`} key={text}>
      {label && (
        <span className="caption__label">
          <Icon name="chevron" size={14} className="rot-90" /> {label}
        </span>
      )}
      <p className="caption__text">{text}</p>
    </div>
  )
}

export function SkipButton({ onSkip }: { onSkip: () => void }) {
  return (
    <button className="skip" onClick={(e) => (e.stopPropagation(), onSkip())}>
      Skip <Icon name="skip" size={14} />
    </button>
  )
}

/** Fade-to-black, impact flashes, temporal distortion, white-outs and the loading veil. */
export function FxLayer() {
  const fade = useGame((s) => s.fade)
  const loading = useGame((s) => s.loading)
  const sceneId = useGame((s) => s.scene?.id)
  const [flash, setFlash] = useState(0)
  const [fx, setFx] = useState<{ kind: string; n: number } | null>(null)

  useEffect(() => {
    const on = () => setFlash((n) => n + 1)
    const onFx = (e: Event) => setFx((f) => ({ kind: String((e as CustomEvent).detail), n: (f?.n ?? 0) + 1 }))
    window.addEventListener(FLASH_EVENT, on)
    window.addEventListener(FX_EVENT, onFx)
    return () => {
      window.removeEventListener(FLASH_EVENT, on)
      window.removeEventListener(FX_EVENT, onFx)
    }
  }, [])
  // a held effect (the closing fade to black) ends with its scene
  useEffect(() => setFx(null), [sceneId])

  return (
    <>
      {flash > 0 && <div className="flash" key={`flash-${flash}`} />}
      {fx && <div className={`fx fx--${fx.kind}`} key={`fx-${fx.n}`} aria-hidden="true" />}
      <div className={`fade ${fade || loading ? 'is-on' : ''}`} />
      {loading && loading.kind !== 'stream' && <LoadingScreen label={loading.label} progress={loading.progress} />}
      {loading?.kind === 'stream' && (
        <div className="loading">
          <span className="loading__crest" />
          <span className="loading__label">{loading.label}</span>
          <span className="loading__bar">
            <span style={{ width: `${Math.round(loading.progress * 100)}%` }} />
          </span>
        </div>
      )}
    </>
  )
}

export function Toasts() {
  const toasts = useGame((s) => s.toasts)
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.tone}`}>
          {t.icon && <Icon name={t.icon} size={16} />}
          {t.text}
        </div>
      ))}
    </div>
  )
}

const clockText = (sec: number) => {
  const m = Math.floor(sec / 60)
  const s = sec - m * 60
  return `00:${String(m).padStart(2, '0')}:${s.toFixed(1).padStart(4, '0')}`
}

/** The lab's measured elapsed time. Counts up once when it first appears, then holds. */
export function ElapsedBadge({ seconds }: { seconds: number }) {
  const value = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const counter = { t: 0 }
    const tween = gsap.to(counter, {
      t: seconds,
      duration: 1.8,
      ease: 'power2.out',
      onUpdate: () => {
        if (value.current) value.current.textContent = clockText(counter.t)
      },
    })
    return () => {
      tween.kill()
    }
  }, [seconds])
  return (
    <div className="elapsed" role="status">
      <span className="elapsed__dot" />
      <span className="elapsed__label">Lab elapsed</span>
      <span className="elapsed__value" ref={value}>
        {clockText(0)}
      </span>
    </div>
  )
}
