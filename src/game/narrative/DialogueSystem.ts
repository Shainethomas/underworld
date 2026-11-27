// Text reveal timing for the dialogue panel.

export type TextSpeed = 'slow' | 'normal' | 'fast' | 'instant'

const CHARS_PER_SECOND: Record<TextSpeed, number> = { slow: 28, normal: 48, fast: 90, instant: Infinity }

/** Extra pause after punctuation, in characters' worth of time. */
const PAUSES: Record<string, number> = { '.': 6, '!': 6, '?': 6, ',': 3, '…': 8, '—': 4 }

/**
 * Precomputes, for each character, the time (ms) at which it appears.
 * Lets the panel reveal text with a single rAF loop and no per-tick allocation.
 */
export function revealSchedule(text: string, speed: TextSpeed): number[] {
  const cps = CHARS_PER_SECOND[speed]
  if (!Number.isFinite(cps)) return Array.from(text, () => 0)
  const step = 1000 / cps
  const out: number[] = []
  let t = 0
  for (let i = 0; i < text.length; i++) {
    out.push(t)
    t += step
    const ch = text[i]
    const following = text[i + 1]
    // "..." pauses once, at the end of the run
    if (PAUSES[ch] && following !== ch) t += step * PAUSES[ch]
  }
  return out
}

/** How many characters are visible after `elapsed` ms. */
export function visibleCount(schedule: number[], elapsed: number): number {
  let lo = 0
  let hi = schedule.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (schedule[mid] <= elapsed) lo = mid + 1
    else hi = mid
  }
  return lo
}
