import type { SpeakerId } from '../narrative/types'
import manifest from '../../story/voices.json'
import { AUDIO_FORMAT } from './AudioManager'
import { voiceKey } from './voiceKey'

// Recorded voice lines. `npm run voices` lists every line that has a recording
// in src/story/voices.json (key → speaker); a line without one plays silent, so
// the cast can be recorded a few lines at a time. See scripts/build-voices.mjs
// (Kokoro voices, or real recordings dropped in art-source/voices/inbox).

const recorded = manifest as Record<string, string>

/** The recording of `speaker` saying `text`, if there is one. */
export function voiceFor(speaker: SpeakerId | undefined, text: string | null | undefined): string | undefined {
  if (!speaker || !text) return undefined
  const key = voiceKey(speaker, text)
  return recorded[key] ? `${import.meta.env.BASE_URL}assets/audio/voice/${speaker}/${key}.${AUDIO_FORMAT}` : undefined
}
