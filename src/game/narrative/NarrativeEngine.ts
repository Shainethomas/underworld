import type { Beat, SceneData } from './types'

// Scene flow is Ink's (StoryRuntime.ts). What stays here is the game's own
// view of a beat: whether the player has to act on it, and a load-time check
// that a scene's staging is complete.

/** A beat the player must act on; skipping stops here. */
export function isInteractive(beat: Beat): boolean {
  switch (beat.type) {
    case 'choice':
    case 'call':
    case 'message':
    case 'drive':
    case 'complete':
    case 'explore':
    case 'qte':
    case 'job':
      return true
    case 'line':
      return !beat.cinematic
    default:
      return false
  }
}

/** Catches content bugs when a scene loads rather than when a player reaches them. */
export function validate(scene: SceneData): void {
  const beats = Object.entries(scene.staging)
  if (!beats.length) throw new Error(`Scene ${scene.id}: no staging`)
  for (const [id, b] of beats) {
    if (b.id !== id) throw new Error(`Scene ${scene.id}: staging "${id}" is labelled "${b.id}"`)
    if (b.type === 'choice' && !b.choiceId) throw new Error(`Scene ${scene.id}: choice "${id}" has no choiceId`)
  }
  if (!beats.some(([, b]) => b.type === 'complete')) throw new Error(`Scene ${scene.id}: nothing completes the scene`)
}
