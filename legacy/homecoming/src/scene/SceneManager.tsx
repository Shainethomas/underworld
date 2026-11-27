import { lazy, Suspense, useEffect, useState } from 'react'
import { audio } from '../engine/audio'
import { preloadVideo, releaseVideos } from '../engine/video'
import { CHAPTER, currentBeat, currentScene, useGame } from '../game/store'
import { isCinematic } from '../narrative/runner'
import { ChapterTitle } from '../ui/ChapterTitle'
import { EndScreen } from '../ui/EndScreen'
import { FxLayer } from '../ui/FxLayer'
import { ObjectiveChip, TopBar } from '../ui/GameChrome'
import { Icon } from '../ui/Icon'
import { SceneCard } from '../ui/SceneCard'
import { Settings } from '../ui/Settings'
import { StoryPanel } from '../ui/StoryPanel'
import { Toasts } from '../ui/Toasts'
import { VideoLayer } from '../ui/VideoLayer'

// three.js + R3F load after the title screen, not before it
const World = lazy(() => import('../three/World').then((m) => ({ default: m.World })))

/**
 * Orchestrates one playable scene: starts it once its environment is ready,
 * then mounts the presentation layer for whichever beat is active —
 * real-time 3D (always underneath), pre-rendered video, dialogue, choices,
 * QTE prompts, chapter cards. The beat list itself is data (narrative/).
 */
export function SceneManager() {
  const loading = useGame((s) => s.loading)
  const envReady = useGame((s) => s.envReady)
  const scene = useGame(currentScene)
  const beat = useGame(currentBeat)
  const beatSeq = useGame((s) => s.beatSeq)
  const aside = useGame((s) => s.aside)
  const advance = useGame((s) => s.advance)

  // start the scene once its 3D environment has mounted
  useEffect(() => {
    if (loading && envReady === scene.environment) {
      const t = setTimeout(() => useGame.getState().beginScene(), 250)
      return () => clearTimeout(t)
    }
  }, [loading, envReady, scene.environment])

  // warm up this scene's and the next scene's videos; drop the rest
  useEffect(() => {
    const next = scene.next ? CHAPTER.scenes.find((s) => s.id === scene.next) : undefined
    const keep = [...(scene.preload ?? []), ...(next?.preload ?? [])]
    keep.forEach(preloadVideo)
    releaseVideos(keep)
  }, [scene])

  // timed beats
  useEffect(() => {
    if (beat?.type !== 'hold') return
    const t = setTimeout(advance, beat.duration * 1000)
    return () => clearTimeout(t)
  }, [beat, beatSeq, advance])

  useEffect(() => {
    audio.setAmbience(beat?.type === 'video' ? 0.25 : 0.55)
  }, [beat])

  const [caption, setCaption] = useState<string | null>(null)
  const cinematic = isCinematic(beat) || !!aside
  // the picture gets more room unless the panel needs space for buttons
  const choice = !aside && beat?.type === 'choice'
  const compact = !aside && (beat?.type === 'explore' || beat?.type === 'qte')

  // Layout: top bar · scene window (3D / video) · story panel. The panel's
  // dialogue box rises over the bottom edge of the picture; choices sit below.
  return (
    <div className={`game ${cinematic ? 'game--cinematic' : ''} ${choice ? 'game--choice' : ''} ${compact ? 'game--compact' : ''}`}>
      <TopBar />
      <div className="stagewin">
        <Suspense fallback={null}>
          <World />
        </Suspense>
        <div className="stagewin__vignette" />
        {beat?.type === 'video' && <VideoLayer key={beatSeq} beat={beat} onDone={advance} onCaption={setCaption} />}
        {beat?.type === 'title' && <ChapterTitle key={beatSeq} kicker={beat.kicker} title={beat.title} duration={beat.duration} onDone={advance} />}
        <FxLayer />
        <SceneCard />
        <ObjectiveChip />
        <SkipButton visible={cinematic && !aside && beat?.type !== 'qte'} />
        <Toasts />
      </div>
      <StoryPanel caption={caption} />
      {beat?.type === 'end' && <EndScreen />}
      <Settings />
    </div>
  )
}

function SkipButton({ visible }: { visible: boolean }) {
  return (
    <button
      className={`skip ${visible ? 'skip--on' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        audio.play('whoosh')
        useGame.getState().skip()
      }}
    >
      Skip <Icon name="skip" />
    </button>
  )
}
