import { useEffect, useState } from 'react'
import { audio } from '../../game/audio/AudioManager'
import type { ChoiceBeat } from '../../game/narrative/types'
import { useGame } from '../../store/gameStore'
import { Icon } from '../common/Icon'

/**
 * Two to four responses. One is in focus (the first to begin with): it
 * follows the pointer, arrow keys move it and Enter picks it; keys 1–4 pick
 * directly. The picked one flashes before committing. A locked option stays
 * in its place with a lock and the reason ("Needs $300"), and can't be picked.
 */
/**
 * Street work (contracts) names what each pick is, so the debrief's lesson
 * ("charm is what works on a scared man") maps onto what the player chose.
 * The tactic is shown; who the contact is stays the player's read.
 */
const CONTRACT_HINTS: Record<string, Record<string, string>> = {
  k_prep: {
    muscle: 'Muscle · threats land harder · Heat +5',
    quiet: 'Quiet · leverage · threats stay quiet',
    homework: 'Homework · a tip on him · −25% pay',
  },
  k_talk: { press: 'Press', charm: 'Charm', threaten: 'Threaten' },
}
const hintFor = (choiceId: string, optionId: string) => CONTRACT_HINTS[choiceId.replace(/\d+$/, '')]?.[optionId]

export function ChoiceList({ beat, onPick }: { beat: ChoiceBeat; onPick?: (text: string) => void }) {
  const choose = useGame((s) => s.choose)
  // the story offers only what is available now (a hub hides questions already asked)
  const options = beat.options
  const [picked, setPicked] = useState<string | null>(null)
  const [active, setActive] = useState(0)

  // a hub returns to the same beat with one question fewer
  useEffect(() => {
    setPicked(null)
    setActive(0)
  }, [beat.id, options.length])

  const pick = (id: string) => {
    if (picked || options.find((o) => o.id === id)?.locked) return
    setPicked(id)
    onPick?.(options.find((o) => o.id === id)?.text ?? '')
    audio.play('ui_choice')
    window.setTimeout(() => choose(id), 320)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault()
        if (!picked) setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length)
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
    <div className={`choices choices--${beat.style}`}>
      {options.map((o, i) => (
        <button
          key={o.id}
          className={`choice ${o.locked ? 'is-locked' : ''} ${!picked && active === i ? 'is-active' : ''} ${picked === o.id ? 'is-picked' : ''} ${picked && picked !== o.id ? 'is-dim' : ''}`}
          style={{ animationDelay: `${80 + i * 70}ms` }}
          aria-disabled={o.locked ? true : undefined}
          onMouseEnter={() => !picked && setActive(i)}
          onFocus={() => !picked && setActive(i)}
          onClick={() => pick(o.id)}
        >
          <span className="choice__no" aria-hidden="true">
            {o.locked ? <Icon name="lock" size={13} /> : i + 1}
          </span>
          <span className="choice__text">
            {hintFor(beat.choiceId, o.id) && <span className={`choice__tactic choice__tactic--${o.id}`}>{hintFor(beat.choiceId, o.id)}</span>}
            {o.text}
            {/* why it can't be picked yet: the price, or the standing it needs */}
            {o.locked && <span className="choice__need">{o.locked}</span>}
          </span>
        </button>
      ))}
    </div>
  )
}
