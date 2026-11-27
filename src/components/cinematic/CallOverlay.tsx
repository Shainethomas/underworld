import { useEffect } from 'react'
import { audio } from '../../game/audio/AudioManager'
import type { CallBeat } from '../../game/narrative/types'
import { useGame } from '../../store/gameStore'

/**
 * An incoming call over the scene: who is calling, the line under the name,
 * and Answer. The phone keeps buzzing until he answers (Space or Enter
 * answer too).
 */
export function CallOverlay({ beat, onAnswer }: { beat: CallBeat; onAnswer: () => void }) {
  const paused = useGame((s) => s.menuOpen)
  useEffect(() => {
    if (paused) return
    const buzz = window.setInterval(() => audio.play('phone_buzz'), 2200)
    return () => window.clearInterval(buzz)
  }, [paused])

  return (
    <div className="call" role="dialog" aria-label={`Incoming call from ${beat.caller}`}>
      <div className="call__card">
        <span className="call__kicker">
          <span className="call__dot" /> Incoming call
        </span>
        <span className="call__avatar" aria-hidden="true">
          <span className="call__ring" />
          <span className="call__ring call__ring--late" />
          {beat.caller.charAt(0)}
        </span>
        <h2 className="call__name">{beat.caller}</h2>
        <p className="call__detail">{beat.detail}</p>
        <p className="call__status">
          {beat.caller} is calling<span className="call__dots" aria-hidden="true" />
        </p>
        <button className="call__answer" onClick={onAnswer} autoFocus>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path
              fill="currentColor"
              d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1A17 17 0 0 1 3 4c0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1z"
            />
          </svg>
          Answer
        </button>
      </div>
    </div>
  )
}
