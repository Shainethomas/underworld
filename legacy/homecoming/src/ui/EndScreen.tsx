import gsap from 'gsap'
import { useEffect, useRef } from 'react'
import { audio } from '../engine/audio'
import { CHAPTER, useGame } from '../game/store'
import { Icon } from './Icon'

const ANSWERS: Record<string, string> = {
  remember: 'You asked if he remembered you.',
  getout: 'You ordered his men out of your city.',
  takeback: 'You swore to take everything back.',
}

export function EndScreen() {
  const root = useRef<HTMLDivElement>(null)
  const choice = useGame((s) => s.choices.c1_answer)
  const rep = useGame((s) => s.reputation)
  const md = useGame((s) => s.relationships.maddog ?? 0)
  const player = useGame((s) => s.player)

  useEffect(() => {
    audio.play('sting')
    const q = gsap.utils.selector(root)
    const tl = gsap.timeline()
    tl.fromTo(root.current, { opacity: 0 }, { opacity: 1, duration: 1.2 })
      .fromTo(q('.end__anim'), { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 0.7, stagger: 0.12, ease: 'power3.out' }, 0.4)
    return () => {
      tl.kill()
    }
  }, [])

  const stat = (label: string, v: number) => (
    <div className="end__stat end__anim">
      <span className="end__statv">{v > 0 ? `+${v}` : v}</span>
      <span className="end__statl">{label}</span>
    </div>
  )

  return (
    <div className="end" ref={root}>
      <span className="end__kicker end__anim">CHAPTER {CHAPTER.number} COMPLETE</span>
      <h1 className="end__title end__anim">{CHAPTER.title}</h1>
      <p className="end__line end__anim">{choice ? ANSWERS[choice] : ''} Mad Dog let you walk away. Nobody walks away from Mad Dog.</p>
      <div className="end__stats">
        {stat('Respect', rep.respect)}
        {stat('Fear', rep.fear)}
        {stat('Ambition', rep.ambition)}
        {stat('Mad Dog', md)}
      </div>
      <p className="end__xp end__anim">
        LV {player.level} · {player.xp}/{player.xpToNext} XP · ${player.cash.toLocaleString()}
      </p>
      <p className="end__next end__anim">CHAPTER 2 — COMING SOON</p>
      <div className="end__actions end__anim">
        <button className="btn btn--gold" onClick={() => useGame.getState().replayScene('s05_recognition')}>
          <Icon name="replay" /> Choose again
        </button>
        <button className="btn btn--ghost" onClick={() => useGame.getState().replayScene('s01_return')}>
          Replay chapter
        </button>
        <button className="btn btn--ghost" onClick={() => useGame.getState().goTitle()}>
          Main menu
        </button>
      </div>
    </div>
  )
}
