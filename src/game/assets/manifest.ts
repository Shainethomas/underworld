import { castUrls } from '../characters/CharacterDefs'
import type { AmbienceId, EnvironmentId, MusicId, SceneData, SfxId } from '../narrative/types'
import { envModelUrl as M, FOLIAGE_URL, surfaceUrls as S } from './urls'

// What each piece of the game loads, known before any of it is built. This is
// what lets a loading screen show real progress, a scene free the last one's
// files, and the next set or scene stream in while the player is busy.
//
// When a set starts using a new texture or model, add it here: in development
// the loader warns about any file that wasn't loaded ahead.

/**
 * Textures and set pieces each set builds with (src/game/sets/*). A function,
 * not a table: texture paths depend on the device tier (see urls.ts).
 */
export function envAssets(id: EnvironmentId): string[] {
  switch (id) {
    case 'estate': return [...S('paving'), ...S('concrete'), ...S('brick'), FOLIAGE_URL, M('sedan'), M('sedan_sports')]
    case 'gym_ext': return [...S('paving'), ...S('concrete'), ...S('brick'), M('sedan'), M('heavy_bag')]
    case 'gym': return [...S('concrete'), ...S('brick'), M('heavy_bag'), M('club_chair')]
    case 'room': return [...S('concrete'), ...S('leather')]
    case 'city': return [...S('paving'), ...S('concrete'), ...S('brick'), M('sedan'), M('suv'), M('taxi'), M('van')]
    case 'facility': return [...S('concrete'), M('sedan')]
    case 'lab': return [...S('concrete')]
    case 'past': return [...S('paving'), ...S('concrete')]
    case 'docks': return [...S('concrete'), M('sedan')]
    case 'mercer': return [...S('leather'), M('club_chair')]
    case 'office': return [M('club_chair')]
    case 'yard': return [...S('concrete'), ...S('brick'), M('sedan'), M('sedan_sports')]
  }
}

export interface SceneAudio {
  music: MusicId[]
  ambience: AmbienceId[]
  sfx: SfxId[]
}

export interface SceneManifest {
  /** Character models and the clip library for the cast. */
  cast: string[]
  /** Files per set, in the order the scene visits them. */
  envs: { id: EnvironmentId; urls: string[] }[]
  audio: SceneAudio
}

/** Every cue the scene's staging can fire, wherever it sits (beat cues, timelines, skill-moment events). */
export function sceneAudio(scene: SceneData): SceneAudio {
  const found = { music: new Set<string>(), ambience: new Set<string>(), sfx: new Set<string>() }
  const walk = (o: unknown): void => {
    if (Array.isArray(o)) return o.forEach(walk)
    if (!o || typeof o !== 'object') return
    for (const [k, v] of Object.entries(o)) {
      if ((k === 'music' || k === 'ambience' || k === 'sfx') && typeof v === 'string') found[k].add(v)
      else walk(v)
    }
  }
  walk(scene.staging)
  return { music: [...found.music] as MusicId[], ambience: [...found.ambience] as AmbienceId[], sfx: [...found.sfx] as SfxId[] }
}

export function sceneManifest(scene: SceneData): SceneManifest {
  return {
    cast: castUrls(scene.cast),
    envs: scene.environments.map((id) => ({ id, urls: envAssets(id) })),
    audio: sceneAudio(scene),
  }
}

/** Every 3D file the scene can touch. */
export function sceneFiles(m: SceneManifest): string[] {
  return [...new Set([...m.cast, ...m.envs.flatMap((e) => e.urls)])]
}
