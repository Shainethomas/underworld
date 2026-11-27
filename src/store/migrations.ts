import { DEFAULT_VARS } from '../game/narrative/NarrativeState'
import type { FlagValue, Vars } from '../game/narrative/types'
import { rebuildEarnings } from '../game/progression/Progression'

// Save migrations, kept apart from the store so they can be tested on their
// own (scripts/migration-test.mjs). Each step takes the persisted state as it
// was stored and returns it upgraded; zustand's persist runs them once, when
// it loads a save written by an older version, and stores the result with the
// new version number.

export const SAVE_VERSION = 5
/** The story order the earnings are rebuilt in. */
const ORDER = ['s01', 's02', 's03', 's04']
const ECONOMY = 'economy-v5'

interface Snap {
  vars: Partial<Vars>
  choices: Record<string, string>
  flags: Record<string, FlagValue>
}

interface SavedProgress {
  sceneId: string
  cursor: number
  ink?: string
  played?: string[]
  completed: string[]
  unlocked: string[]
  starts: Record<string, Snap>
  startVars?: Vars
  migrated?: string[]
  story?: string
}

export interface Saved {
  profile?: Record<string, unknown>
  progress?: SavedProgress
  vars?: Partial<Vars>
  choices?: Record<string, string>
  flags?: Record<string, FlagValue>
  settings?: Record<string, unknown>
}

export function migrateSave(persisted: unknown, version: number): Saved {
  const p = { ...((persisted ?? {}) as Saved) }
  if (version < 3 && p.progress) {
    // v2 kept only the current scene's starting variables
    const { startVars, ...progress } = p.progress
    p.progress = { ...progress, starts: startVars ? { [progress.sceneId]: { vars: startVars, choices: {}, flags: {} } } : {} }
  }
  if (version < 4 && p.progress) {
    // a beat index can't be mapped into Ink: an unfinished scene starts again from its snapshot
    p.progress = { ...p.progress, cursor: 0, ink: undefined, played: undefined }
  }
  if (version < 5) economy(p)
  return p
}

/**
 * v5: cash, Respect and rank become real. The old balance was decorative
 * ($5,000 for everyone), so it is dropped and the earnings are rebuilt from
 * what the save proves (Progression.rebuildEarnings, which documents each
 * fallback). Runs once: the `economy-v5` marker stops a second pass even if
 * the version number were lost. Scenes rewritten for the economy can't take
 * an old Ink position, so a scene in progress starts again from its snapshot.
 */
function economy(p: Saved): void {
  const progress = p.progress
  if (progress?.migrated?.includes(ECONOMY)) return
  if (!progress) {
    // nothing played yet: a new save, which starts at $0 anyway
    return
  }
  const completed = progress.completed ?? []
  const earned = rebuildEarnings(completed, p.choices ?? {}, p.flags ?? {}, p.vars ?? {})
  p.vars = { ...DEFAULT_VARS, ...p.vars, cash: earned.cash, respect: earned.respect, varga: p.vars?.varga ?? 0 }
  p.flags = { ...p.flags, rank: earned.rank }

  // each scene's snapshot holds what the earlier scenes had earned when it began
  const starts: Record<string, Snap> = {}
  for (const [id, snap] of Object.entries(progress.starts ?? {})) {
    const before = ORDER.slice(0, Math.max(0, ORDER.indexOf(id))).filter((s) => completed.includes(s))
    const e = rebuildEarnings(before, snap.choices ?? {}, snap.flags ?? {}, snap.vars ?? {})
    starts[id] = { ...snap, vars: { ...DEFAULT_VARS, ...snap.vars, cash: e.cash, respect: e.respect }, flags: { ...snap.flags, rank: e.rank } }
  }

  p.progress = {
    ...progress,
    starts,
    cursor: progress.ink ? 0 : progress.cursor,
    ink: undefined,
    played: undefined,
    migrated: [...(progress.migrated ?? []), ECONOMY],
  }
  // the decorative balance is gone; level, gems, health and stamina stay in the save, unshown
  if (p.profile) p.profile = { ...p.profile, cash: 0 }
}
