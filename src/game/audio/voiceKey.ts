import type { SpeakerId } from '../narrative/types'

/**
 * The key of one spoken line: who says it and exactly what they say. The voice
 * generator (scripts/build-voices.mjs) names each recording by it, and the game
 * looks the same key up, so a line whose words change simply has no recording
 * until the generator is run again (and only that line is re-voiced).
 */
export function voiceKey(speaker: SpeakerId, text: string): string {
  const s = `${speaker}|${normalise(text)}`
  // FNV-1a, 32 bit, twice with different offsets: 64 bits is plenty for a few thousand lines
  let a = 0x811c9dc5
  let b = 0x01000193 ^ 0x9e3779b9
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i)
    a = Math.imul(a ^ c, 0x01000193)
    b = Math.imul(b ^ c, 0x01000193) ^ (b >>> 13)
  }
  return (a >>> 0).toString(36).padStart(7, '0') + (b >>> 0).toString(36).padStart(7, '0')
}

/** Whitespace and curly quotes don't change what's said. */
export function normalise(text: string): string {
  return text.replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/\s+/g, ' ').trim()
}
