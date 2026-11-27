import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { audio } from '../engine/audio'

export function ChapterTitle({ kicker, title, duration, onDone }: { kicker: string; title: string; duration: number; onDone: () => void }) {
  const root = useRef<HTMLDivElement>(null)
  useEffect(() => {
    audio.play('sting')
    const q = gsap.utils.selector(root)
    const tl = gsap.timeline({ onComplete: onDone })
    tl.fromTo(q('.ctitle__rule'), { scaleX: 0 }, { scaleX: 1, duration: 1.1, ease: 'power3.out', stagger: 0.1 })
      .fromTo(q('.ctitle__kicker'), { opacity: 0, letterSpacing: '0.2em' }, { opacity: 1, letterSpacing: '0.6em', duration: 1.4, ease: 'power2.out' }, 0.15)
      .fromTo(q('.ctitle__title'), { opacity: 0, y: 14, filter: 'blur(8px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 1.3, ease: 'power3.out' }, 0.45)
      .to(root.current, { opacity: 0, duration: 0.8, ease: 'power2.in' }, duration - 0.8)
    return () => {
      tl.kill()
    }
  }, [duration, onDone])
  return (
    <div className="ctitle" ref={root}>
      <span className="ctitle__rule" />
      <span className="ctitle__kicker">{kicker}</span>
      <h1 className="ctitle__title">{title}</h1>
      <span className="ctitle__rule" />
    </div>
  )
}
