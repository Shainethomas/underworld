import type { Beat, ChapterDef, SceneDef, SceneId } from './types'

// Pure helpers for walking a scene's beats. No React, no store — so the same
// logic can later run server-side to validate progress.

export const STOP_BEATS: Beat['type'][] = ['explore', 'choice', 'end']
export const INSTANT_BEATS: Beat['type'][] = ['objective', 'reward', 'branch']

/** Beats that show cinematic presentation (letterbox, skip button, no HUD). */
export const isCinematic = (b: Beat | undefined) =>
  !!b && (b.type === 'line' || b.type === 'hold' || b.type === 'title' || b.type === 'video' || b.type === 'qte')

/**
 * Flatten a scene's beats, resolving `branch` beats with the choices made so
 * far. A branch whose choice hasn't been made stays as a marker that the
 * runner re-expands once the choice exists.
 */
export function expandBeats(beats: Beat[], choices: Record<string, string>): Beat[] {
  const out: Beat[] = []
  for (const b of beats) {
    if (b.type === 'branch') {
      const picked = choices[b.choice]
      if (picked && b.cases[picked]) out.push(...expandBeats(b.cases[picked], choices))
      else out.push(b)
    } else out.push(b)
  }
  return out
}

export function getScene(chapter: ChapterDef, id: SceneId): SceneDef {
  const s = chapter.scenes.find((x) => x.id === id)
  if (!s) throw new Error(`Unknown scene ${id}`)
  return s
}

/** Index of the next stop beat at or after `from`, or -1 if the scene runs out. */
export function findNextStop(beats: Beat[], from: number): number {
  for (let i = from; i < beats.length; i++) if (STOP_BEATS.includes(beats[i].type)) return i
  return -1
}
