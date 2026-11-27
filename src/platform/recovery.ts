// Coming back from a crash at the beat the player was on.
//
// A phone can take the game's renderer away mid-scene: Android drops the GPU
// context or kills the WebView's render process under memory pressure, and
// iOS kills the WebView's content process (Capacitor then reloads the page).
// The save is written at every beat, so nothing is lost; what's missing is
// getting the player back without a trip through the title screen.
//
// While a scene plays, a heartbeat records which one. A page that starts
// within RECENT_MS of the last heartbeat was cut off mid-play, so the title
// screen continues straight into that scene. A launch any later (the player
// closed the game yesterday) shows the title screen as usual, and so does a
// deliberate reload or close: those fire `pagehide`, which clears the marker,
// while a killed process never gets to.

const KEY = 'underworld.inPlay'
const RECENT_MS = 45_000
/** Set while the game reloads itself to recover: that unload must keep the marker. */
let recovering = false

if (typeof window !== 'undefined') window.addEventListener('pagehide', () => recovering || clearPlaying())

interface Marker {
  sceneId: string
  at: number
}

function read(): Marker | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Marker) : null
  } catch {
    return null
  }
}

/** A scene is playing (call now and then while it does). */
export function markPlaying(sceneId: string): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ sceneId, at: Date.now() } satisfies Marker))
  } catch {
    // storage full or blocked: recovery just won't happen
  }
}

/** The player left the scene on purpose (back to the title screen). */
export function clearPlaying(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}

/** The scene to continue if this page load is a recovery from a crash; consumed on read. */
export function takeRecovery(): string | null {
  const m = read()
  clearPlaying()
  return m && Date.now() - m.at < RECENT_MS ? m.sceneId : null
}

/** The renderer is gone for good: reload and come back to this scene. */
export function reloadAndResume(sceneId: string | undefined): void {
  if (sceneId) markPlaying(sceneId)
  recovering = true
  location.reload()
}
