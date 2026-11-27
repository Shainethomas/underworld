import gsap from 'gsap'
import { useEffect, useRef, useState } from 'react'
import { audio } from '../engine/audio'
import { preloadVideo } from '../engine/video'
import { CHAPTER, hasSave, useGame } from '../game/store'

export function TitleScreen() {
  const root = useRef<HTMLDivElement>(null)
  const [canContinue] = useState(hasSave)
  const checkpoint = useGame((s) => s.checkpoint)
  const scene = CHAPTER.scenes.find((s) => s.id === checkpoint)

  useEffect(() => {
    preloadVideo('/assets/video/s01_establishing.mp4')
    // warm the 3D runtime and first environment while the player reads the title
    void import('../three/World')
    void import('../three/environments/Highway')
    const q = gsap.utils.selector(root)
    const tl = gsap.timeline()
    tl.fromTo(q('.title__bg'), { scale: 1.15, opacity: 0 }, { scale: 1.02, opacity: 1, duration: 3.2, ease: 'power2.out' })
      .fromTo(q('.title__md'), { opacity: 0, y: 30 }, { opacity: 0.9, y: 0, duration: 2.4, ease: 'power2.out' }, 0.6)
      .fromTo(q('.title__logo'), { opacity: 0, letterSpacing: '0.05em', filter: 'blur(10px)' }, { opacity: 1, letterSpacing: '0.18em', filter: 'blur(0px)', duration: 1.8, ease: 'power3.out' }, 0.5)
      .fromTo(q('.title__anim'), { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.8, stagger: 0.12, ease: 'power2.out' }, 1.4)
    return () => {
      tl.kill()
    }
  }, [])

  const start = (fn: () => void) => {
    audio.unlock()
    audio.play('confirm')
    fn()
  }

  return (
    <div className="title" ref={root}>
      <div className="title__bg" />
      <img className="title__md" src="/assets/images/maddog.png" alt="" />
      <div className="title__shade" />
      <div className="title__top title__anim">
        <span>A CINEMATIC MAFIA SAGA</span>
      </div>
      <div className="title__center">
        <h1 className="title__logo">UNDERWORLD</h1>
        <span className="title__rule title__anim" />
        <span className="title__chapter title__anim">CHAPTER {CHAPTER.number} · {CHAPTER.title}</span>
      </div>
      <div className="title__menu">
        {canContinue && scene && (
          <button className="btn btn--gold title__anim" onClick={() => start(() => useGame.getState().continueGame())}>
            Continue
            <small>Scene {String(scene.index).padStart(2, '0')} · {scene.title}</small>
          </button>
        )}
        <button className={`btn ${canContinue ? 'btn--ghost' : 'btn--gold'} title__anim`} onClick={() => start(() => useGame.getState().newGame())}>
          {canContinue ? 'New game' : 'Begin'}
        </button>
        <p className="title__hint title__anim">Best with sound · Portrait</p>
      </div>
    </div>
  )
}
