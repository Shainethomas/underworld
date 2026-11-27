import { useEffect, useRef, useState } from 'react'
import { useGame } from '../../store/gameStore'

/** Shown one at a time while a scene loads. Every one describes something the game really does. */
const TIPS = [
  'Choices stay with you. People remember how you answered them.',
  'Tap a line while it types to show it all at once.',
  'Space or Enter moves the story on, and Escape opens the menu.',
  'Skip jumps a cutscene to the next moment that needs you.',
  'Missed something? The story log in the menu keeps every line of the scene.',
  'When you are free to explore, tap the floor to walk and tap a marker to look closer.',
  'In a fight, react when the prompt appears. Timing beats speed.',
  'Headphones recommended.',
]

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * The scene's title card while its files load: chapter, scene number and
 * title, a rotating tip, and the stage and progress along the foot. Progress
 * never runs backwards, even when a stage reports from zero.
 */
export function LoadingScreen({ label, progress }: { label: string; progress: number }) {
  const scene = useGame((s) => s.scene)
  const [tip, setTip] = useState(() => Math.floor(Math.random() * TIPS.length))
  const shown = useRef({ id: '', p: 0 })
  if (shown.current.id !== (scene?.id ?? '')) shown.current = { id: scene?.id ?? '', p: 0 }
  shown.current.p = Math.max(shown.current.p, Math.min(1, progress))
  const p = shown.current.p

  useEffect(() => {
    const t = window.setInterval(() => setTip((i) => (i + 1) % TIPS.length), 5200)
    return () => window.clearInterval(t)
  }, [])

  return (
    <div className="loadscreen" role="status" aria-live="polite" aria-label={`Loading: ${label}`}>
      <div className="loadscreen__light" aria-hidden="true" />
      {scene && (
        <div className="loadscreen__card">
          <span className="loadscreen__chapter">
            Chapter {scene.chapter.number} <i /> {scene.chapter.title}
          </span>
          <span className="loadscreen__num">Scene {pad(scene.index)}</span>
          <h1 className="loadscreen__title">{scene.title}</h1>
        </div>
      )}
      <p className="loadscreen__tip" key={tip}>
        {TIPS[tip]}
      </p>
      <div className="loadscreen__foot">
        <span className="loadscreen__label">{label}</span>
        <span className="loadscreen__pct">{Math.round(p * 100)}%</span>
        <span className="loadscreen__bar">
          <span style={{ transform: `scaleX(${p})` }} />
        </span>
      </div>
    </div>
  )
}
