import type { VideoBeat } from '../../game/narrative/types'

/** Pre-rendered cinematic (WebM with MP4 fallback); advances when it ends. */
export function VideoLayer({ beat, onEnd }: { beat: VideoBeat; onEnd: () => void }) {
  const base = beat.src.replace(/\.(mp4|webm)$/, '')
  return (
    <video className="video-layer" poster={beat.poster} autoPlay playsInline onEnded={onEnd} onError={onEnd}>
      <source src={`${base}.webm`} type="video/webm" />
      <source src={`${base}.mp4`} type="video/mp4" />
    </video>
  )
}
