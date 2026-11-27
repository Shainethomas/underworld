// ── Video preloading ─────────────────────────────────────────────────────
// Keeps one warmed <video> per source so a cinematic can start without a
// network stall. Old entries are released when a scene no longer needs them.

const warmed = new Map<string, HTMLVideoElement>()

export function preloadVideo(src: string) {
  if (warmed.has(src)) return
  const v = document.createElement('video')
  v.preload = 'auto'
  v.muted = true
  v.playsInline = true
  v.src = src
  v.load()
  warmed.set(src, v)
}

export function releaseVideos(keep: string[]) {
  for (const [src, v] of warmed) {
    if (keep.includes(src)) continue
    v.removeAttribute('src')
    v.load()
    warmed.delete(src)
  }
}
