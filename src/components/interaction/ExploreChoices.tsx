import { useEffect, useState } from 'react'
import { audio } from '../../game/audio/AudioManager'
import { engine } from '../../game/engine/GameEngine'
import type { ExploreBeat } from '../../game/narrative/types'
import { useGame } from '../../store/gameStore'

/**
 * Exploring is a decision, like any other: the places worth a look are listed
 * as options and Rookie walks to the one picked. Places already looked at drop
 * off the list; the one that moves the story on (`ends`) is always offered,
 * last. While he walks, the pick stays lit and the rest dim.
 */
export function ExploreChoices({ beat }: { beat: ExploreBeat }) {
  const visited = useGame((s) => s.visited)
  const [walking, setWalking] = useState<string | null>(null)
  const [active, setActive] = useState(0)

  const options = [...beat.hotspots.filter((h) => !h.ends && !visited.includes(h.id)), ...beat.hotspots.filter((h) => h.ends)]

  // arrival records the visit (and opens its aside): the list is live again afterwards
  useEffect(() => {
    if (walking && visited.includes(walking)) setWalking(null)
  }, [visited, walking])
  useEffect(() => {
    setWalking(null)
    setActive(0)
  }, [beat.id, options.length])

  const pick = (id: string) => {
    if (walking) return
    audio.play('ui_choice')
    if (engine.walkToHotspot(id)) setWalking(id)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (!walking) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
        return
      }
      if (e.key === 'Enter' && options[active]) return pick(options[active].id)
      const i = Number(e.key) - 1
      if (i >= 0 && i < options.length) pick(options[i].id)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="choices choices--card choices--explore">
      {options.map((h, i) => (
        <button
          key={h.id}
          className={`choice ${h.ends ? 'choice--main' : ''} ${!walking && active === i ? 'is-active' : ''} ${walking === h.id ? 'is-picked' : ''} ${walking && walking !== h.id ? 'is-dim' : ''}`}
          style={{ animationDelay: `${80 + i * 70}ms` }}
          disabled={Boolean(walking)}
          onMouseEnter={() => !walking && setActive(i)}
          onFocus={() => !walking && setActive(i)}
          onClick={() => pick(h.id)}
        >
          <span className="choice__no" aria-hidden="true">
            {i + 1}
          </span>
          <span>{h.label}</span>
        </button>
      ))}
    </div>
  )
}
