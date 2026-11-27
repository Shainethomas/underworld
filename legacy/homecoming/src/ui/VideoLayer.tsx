import { useEffect, useRef, useState } from 'react'
import type { Beat } from '../narrative/types'

type VideoBeat = Extract<Beat, { type: 'video' }>

/**
 * Pre-rendered cinematic playback with timed subtitles. Falls back to the
 * poster (and a short hold) if the browser refuses inline autoplay.
 */
export function VideoLayer({ beat, onDone, onCaption }: { beat: VideoBeat; onDone: () => void; onCaption: (text: string | null) => void }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [time, setTime] = useState(0)
  const [ready, setReady] = useState(false)
  const ended = useRef(false)
  const finish = () => {
    if (ended.current) return
    ended.current = true
    onDone()
  }

  useEffect(() => {
    const v = ref.current!
    v.play().catch(() => {
      // autoplay blocked: show the poster with captions, then continue
      const t0 = performance.now()
      const id = setInterval(() => {
        const t = (performance.now() - t0) / 1000
        setTime(t)
        if (t > 6) {
          clearInterval(id)
          finish()
        }
      }, 100)
    })
  }, [])

  const cap = beat.captions?.find((c) => time >= c.at && time < c.at + c.dur)
  const capText = cap?.text ?? null
  // captions are read in the story panel, not over the picture
  useEffect(() => onCaption(capText), [capText, onCaption])
  useEffect(() => () => onCaption(null), [onCaption])
  return (
    <div className={`video ${ready ? 'video--ready' : ''}`}>
      <video
        ref={ref}
        className="video__el"
        src={beat.src}
        poster={beat.poster}
        muted
        playsInline
        preload="auto"
        onPlaying={() => setReady(true)}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onEnded={finish}
        onError={() => setTimeout(finish, 1500)}
      />
      {beat.rain && <div className="video__rain" />}
      <div className="video__shade" />
    </div>
  )
}
