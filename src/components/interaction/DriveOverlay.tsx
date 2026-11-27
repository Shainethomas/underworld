import { useEffect, useRef } from 'react'
import { engine } from '../../game/engine/GameEngine'
import type { DriveBeat } from '../../game/narrative/types'
import { Icon } from '../common/Icon'

/**
 * The drive readout over the chase camera: where he's headed, metres to go
 * with a progress bar, and his speed; the prompt and "hold to drive" at the
 * foot. Values are written straight to the DOM every frame (no re-render).
 * The scene itself takes the input: holding anywhere on it is the throttle.
 */
export function DriveOverlay({ beat }: { beat: DriveBeat }) {
  const left = useRef<HTMLSpanElement>(null)
  const bar = useRef<HTMLSpanElement>(null)
  const kmh = useRef<HTMLSpanElement>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const st = engine.driveState()
      if (st) {
        if (left.current) left.current.textContent = st.arrived ? 'Arrived' : `${Math.ceil(st.left)} m`
        if (bar.current) bar.current.style.transform = `scaleX(${1 - st.left / beat.distance})`
        if (kmh.current) kmh.current.textContent = String(Math.round(st.speed * 3.6))
        root.current?.classList.toggle('is-moving', st.speed > 0.5)
        root.current?.classList.toggle('is-arrived', st.arrived)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [beat.id, beat.distance])

  return (
    <div className="drive" ref={root}>
      <div className="drive__panel">
        <span className="drive__kicker">
          <Icon name="target" size={13} /> {beat.destination}
        </span>
        <span className="drive__left" ref={left}>
          {beat.distance} m
        </span>
        <span className="drive__track">
          <span className="drive__fill" ref={bar} />
        </span>
        <span className="drive__speed">
          <span ref={kmh}>0</span> km/h
        </span>
      </div>
      <div className="explore-prompt drive__prompt">
        <Icon name="hand" size={16} />
        <span>
          {beat.prompt}
          <span className="explore-prompt__hint drive__hint">Hold the screen to drive · let go to coast</span>
        </span>
      </div>
    </div>
  )
}
