import { useEffect } from 'react'
import { audio } from '../../game/audio/AudioManager'
import type { MessageBeat } from '../../game/narrative/types'

/**
 * A text message arriving on his phone: a notification card over the scene
 * with who sent it and the message. It buzzes once as it lands; Next (in the
 * scene's corner) moves on.
 */
export function MessageOverlay({ beat }: { beat: MessageBeat }) {
  useEffect(() => {
    audio.play('phone_buzz')
  }, [beat.id])

  return (
    <div className="message" role="dialog" aria-label={`Message from ${beat.sender}`}>
      <div className="message__card">
        <span className="message__kicker">
          <span className="message__dot" /> New message
        </span>
        <div className="message__from">
          <span className="message__avatar" aria-hidden="true">
            {beat.sender.charAt(0)}
          </span>
          <h2 className="message__name">{beat.sender}</h2>
          <span className="message__time">now</span>
        </div>
        <p className="message__text">{beat.text}</p>
      </div>
    </div>
  )
}
