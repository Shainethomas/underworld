import { useEffect, useRef, useState } from 'react'
import { revealSchedule, visibleCount, type TextSpeed } from '../../game/narrative/DialogueSystem'
import { speakerName } from '../../game/narrative/NarrativeState'
import { useGame } from '../../store/gameStore'
import type { SpeakerId } from '../../game/narrative/types'
import { Icon } from '../common/Icon'

/** Typewriter state for one line; `finish()` reveals the rest instantly. */
export function useReveal(text: string | null, speed: TextSpeed) {
  const [count, setCount] = useState(0)
  const done = text !== null && count >= text.length
  const raf = useRef(0)
  const force = useRef(false)

  useEffect(() => {
    force.current = false
    if (text === null) return
    const schedule = revealSchedule(text, speed)
    const start = performance.now()
    setCount(0)
    const tick = () => {
      const n = force.current ? text.length : visibleCount(schedule, performance.now() - start)
      setCount(n)
      if (n < text.length) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf.current)
  }, [text, speed])

  return {
    visible: text?.slice(0, count) ?? '',
    done,
    finish: () => {
      force.current = true
      if (text) setCount(text.length)
    },
  }
}

interface Props {
  speaker?: SpeakerId
  label?: string
  text: string
  /** Full text, so the box keeps its final height while typing. */
  fullText?: string
  showNext?: boolean
  onTap?: () => void
  /** An unspoken thought: italic, with "thinking" after the name. */
  thought?: boolean
}

export function DialoguePanel({ speaker, label, text, fullText, showNext, onTap, thought }: Props) {
  const scene = useGame((s) => s.scene)
  const name = label ?? (speaker ? speakerName(speaker, scene) : undefined)
  return (
    <div className={`dialogue ${thought ? 'dialogue--thought' : ''}`} onClick={onTap} role="button" tabIndex={-1}>
      {name && (
        <span className="dialogue__tag">
          {name}
          {thought && <span className="dialogue__aside"> · thinking</span>}
        </span>
      )}
      <p className="dialogue__text">
        <span className="dialogue__ghost" aria-hidden="true">
          {fullText ?? text}
        </span>
        <span className="dialogue__live">{text}</span>
      </p>
      <span className={`dialogue__next ${showNext ? 'is-on' : ''}`}>
        <Icon name="chevron" size={18} />
      </span>
    </div>
  )
}
