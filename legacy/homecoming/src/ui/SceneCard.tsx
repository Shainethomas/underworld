import { useEffect, useState } from 'react'
import { currentScene, useGame } from '../game/store'

/** Location card that fades in at the start of each scene. */
export function SceneCard() {
  const scene = useGame(currentScene)
  const loading = useGame((s) => s.loading)
  const [show, setShow] = useState(false)
  useEffect(() => {
    if (loading) return
    setShow(true)
    const t = setTimeout(() => setShow(false), 2800)
    return () => clearTimeout(t)
  }, [scene.id, loading])
  return (
    <div className={`scard ${show && scene.index > 1 ? 'scard--on' : ''}`}>
      <span className="scard__num">SCENE {String(scene.index).padStart(2, '0')}</span>
      <span className="scard__title">{scene.title}</span>
      <span className="scard__sub">{scene.subtitle}</span>
    </div>
  )
}
