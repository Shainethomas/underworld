import type { FlagValue, Vars } from '../narrative/types'

// Rookie's standing in Victor's organisation: Respect and rank, cash, and how
// the Varga crew see him. The numbers themselves live in the Ink (each job
// pays and charges through `earn()` in src/story/globals.ink); this module
// reads them back for the HUD, the debrief and the standing sheet, and holds
// the rules the Ink can't: rank thresholds, and rebuilding an old save's
// earnings. README.md, "Progression", documents the economy.

export interface Rank {
  id: number
  name: string
  /** Respect needed to be promoted to it (at a job's debrief). */
  at: number
}

/** Ranks in order. Chapter 1 reaches Associate; Soldier is shown as the goal beyond it. */
export const RANKS: Rank[] = [
  { id: 0, name: 'Rookie', at: 0 },
  { id: 1, name: 'Runner', at: 100 },
  { id: 2, name: 'Associate', at: 225 },
  { id: 3, name: 'Soldier', at: 400 },
]

/** The highest rank this much Respect qualifies for. */
export function rankFor(respect: number): Rank {
  return [...RANKS].reverse().find((r) => respect >= r.at) ?? RANKS[0]
}

export function rankById(id: number): Rank {
  return RANKS[Math.max(0, Math.min(RANKS.length - 1, id))]
}

/** The rank after `id`, if there is one. */
export function nextRank(id: number): Rank | null {
  return RANKS[id + 1] ?? null
}

/**
 * Respect gates that open later in the chapter, shown on the standing sheet
 * as what more Respect would buy. Kept in step with the `#need:respect:N`
 * options in the Ink.
 */
export const RESPECT_GATES: { at: number; text: string }[] = [
  { at: 130, text: 'Talk your way past a rival crew' },
  { at: 200, text: "Drop Victor's name and be believed" },
  { at: 210, text: 'Send the Varga crew a message' },
  { at: 300, text: 'Pick who works alongside you' },
]

// ── Ledger ──────────────────────────────────────────────────────────────────
// Every reward and cost a job hands out is written to the Ink variable
// `ledger` as `<kind><amount>^<reason>;` (globals.ink, `earn()`), so the
// debrief can say why each number moved. It is cleared when a scene starts.

export type LedgerKind = 'respect' | 'cash' | 'heat' | 'varga' | 'lucas' | 'victor'

const KINDS: Record<string, LedgerKind> = { r: 'respect', c: 'cash', h: 'heat', v: 'varga', t: 'lucas', f: 'victor' }

export interface LedgerEntry {
  kind: LedgerKind
  amount: number
  why: string
}

export function parseLedger(ledger: FlagValue | undefined): LedgerEntry[] {
  if (typeof ledger !== 'string' || !ledger) return []
  const out: LedgerEntry[] = []
  for (const part of ledger.split(';')) {
    const m = /^([a-z])(-?\d+)\^(.*)$/s.exec(part.trim())
    if (!m || !KINDS[m[1]]) continue
    out.push({ kind: KINDS[m[1]], amount: Number(m[2]), why: m[3] })
  }
  return out
}

export const LEDGER_LABELS: Record<LedgerKind, string> = {
  respect: 'Respect',
  cash: 'Cash',
  heat: 'Heat',
  varga: 'Varga',
  lucas: "Lucas's Trust",
  victor: "Victor's Favour",
}

// ── Job grade ───────────────────────────────────────────────────────────────

export const GRADES: Record<string, { label: string; note: string }> = {
  clean: { label: 'Clean', note: 'No loose ends.' },
  messy: { label: 'Messy', note: 'Done, but people noticed.' },
  scrappy: { label: 'Scrappy', note: 'You won. It cost you.' },
  ugly: { label: 'Ugly', note: 'A win nobody will brag about.' },
  botched: { label: 'Botched', note: 'It got done. Barely.' },
}

// ── Rivals ──────────────────────────────────────────────────────────────────

/** How the Varga crew see Rookie, from the `varga` variable. */
export function vargaStanding(varga: number): { label: string; note: string; level: number } {
  if (varga >= 30) return { label: 'At war', note: 'They will come for what is yours.', level: 3 }
  if (varga >= 15) return { label: 'Hostile', note: 'They know your face and want it gone.', level: 2 }
  if (varga > 0) return { label: 'Watching', note: 'They know your name.', level: 1 }
  return { label: 'Unaware', note: 'Nobody across the river knows you yet.', level: 0 }
}

// ── Money ───────────────────────────────────────────────────────────────────

export const fmtCash = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(Math.round(n)).toLocaleString('en-US')}`

// ── Rebuilding an old save (save version 5) ────────────────────────────────
// Saves from before the economy carry a decorative $5,000 and no Respect.
// Their earnings are rebuilt once from what the save can prove; whatever it
// can't is documented here and in the README:
//   Scene 01 — the fight purse and Respect from the stored fight results.
//              There was no prep pick, so no ×1.5 and no bravado bonus.
//   Scene 02 — the job's base pay and Respect, as if run clean on time with
//              no fee paid: the old script had no fee, route or sedan.
//   Scene 03 — base pay, less the cleanup cut if the stored Heat says so,
//              and base Respect plus the standoff result where it's stored.
//   Scene 04 — base pay and Respect.
// Nothing could be bought before the economy existed, so nothing is spent.

/** The Scene 01 fight's score (0–1) from its skill-moment results, as the Ink computes it. */
export function fightScore(opening: string | undefined, f: Record<string, FlagValue>): number {
  const n = (k: string) => (typeof f[k] === 'number' ? (f[k] as number) : 0)
  if (opening === 'all_in') return (n('fight_counter') + n('fight_finish')) / 2
  return (n('fight_guard') + n('fight_slip') + n('fight_counter') + n('fight_finish')) / 4
}

export function fightGrade(score: number): 'clean' | 'scrappy' | 'ugly' {
  return score >= 0.75 ? 'clean' : score >= 0.4 ? 'scrappy' : 'ugly'
}

/** Base pay and Respect per job (kept in step with each scene's Ink). */
export const JOB_BASE: Record<string, { cash: number; respect: number }> = {
  s01: { cash: 0, respect: 50 },
  s02: { cash: 800, respect: 70 },
  s03: { cash: 2400, respect: 70 },
  s04: { cash: 1000, respect: 80 },
}
export const FIGHT_PURSE = { clean: 500, scrappy: 300, ugly: 150 } as const
export const FIGHT_RESPECT = { clean: 20, scrappy: 10, ugly: 0 } as const

/** Earnings an old save can prove, for the scenes it completed (in story order). */
export function rebuildEarnings(completed: string[], choices: Record<string, string>, flags: Record<string, FlagValue>, vars: Partial<Vars>) {
  let cash = 0
  let respect = 0
  const notes: string[] = []
  const done = (id: string) => completed.includes(id)
  if (done('s01')) {
    const grade = fightGrade(fightScore(choices.opening, flags))
    cash += FIGHT_PURSE[grade]
    respect += JOB_BASE.s01.respect + FIGHT_RESPECT[grade]
    notes.push(`s01: ${grade} fight`)
  }
  if (done('s02')) {
    cash += JOB_BASE.s02.cash
    respect += JOB_BASE.s02.respect
    notes.push('s02: base pay (no route, fee or sedan record)')
  }
  if (done('s03')) {
    const cleanup = (vars.heat ?? 0) >= 30
    cash += cleanup ? Math.round(JOB_BASE.s03.cash * 0.8) : JOB_BASE.s03.cash
    respect += JOB_BASE.s03.respect + (choices.standoff === 'talk' ? 15 : choices.standoff === 'fight' ? 10 : 0)
    notes.push(`s03: base pay${cleanup ? ' less cleanup' : ''}, standoff ${choices.standoff ?? 'unknown'}`)
  }
  if (done('s04')) {
    cash += JOB_BASE.s04.cash
    respect += JOB_BASE.s04.respect
    notes.push('s04: base pay')
  }
  // ranks are earned at debriefs, so an old save holds the rank its Respect reached;
  // Associate is Victor's to give, at the end of Scene 04, and Soldier is beyond Chapter 1 (scene rankCap)
  const rank = Math.min(rankFor(respect).id, done('s04') ? 2 : 1)
  return { cash, respect, rank, notes }
}

// ── What he carries, who he knows, and what doesn't add up ─────────────────

/** What he holds, his gear and his contacts, by the flag the Ink sets when he gets them. */
export const KIT: { flag: string; name: string; use: string }[] = [
  { flag: 'owns_calder', name: 'Calder Yard', use: 'Yours, from Victor. A fifth of everything that comes through. The Varga crew want it.' },
  { flag: 'gear_knuckles', name: 'Knuckle duster', use: 'Counters land easier in a fight.' },
  { flag: 'gear_burner', name: 'Burner phone', use: 'Your real number stops getting around.' },
  { flag: 'gear_plates', name: 'Clean plates', use: 'Less Heat from every getaway.' },
  { flag: 'contact_sal', name: 'Sal · Pier Nine', use: 'Sells word on a job site before you go.' },
]

/**
 * The story threads running behind the jobs. Each shows once its flag is set;
 * none of them is a case to solve yet, just things that don't add up.
 */
export const LOOSE_ENDS: { flag: string; text: string }[] = [
  { flag: 'varga_called', text: 'A rival crew rang your personal number the night of the fight. Someone gave it to them.' },
  { flag: 'sal_time', text: 'Sal was told ten. Lucas told you half ten. Somebody is moving the times.' },
  { flag: 's02_sedan', text: 'A grey sedan was parked at the Hollis Hill drop before you got there.' },
  { flag: 'envelope_cy', text: 'Lucas pocketed an envelope from Hollis Hill marked "C.Y." and wouldn\'t say why.' },
  { flag: 'saw_permit', text: 'The grey sedan at Calder Yard had a Downtown Gym permit on the dash. Our gym.' },
  { flag: 'nico_time', text: 'Nico was told midnight. Lucas told you twenty past eleven.' },
  { flag: 'heard_nico', text: 'Nico, on the phone after the handover: "I did what you said. We\'re square." To whom?' },
  { flag: 'lucas_time_asked', text: 'Lucas asked whether Nico said anything about the time. Nobody had told him there was a problem with it.' },
  { flag: 'n_evidence_found', text: 'Nico\'s note: "Time changed to 23:20. Use the gym staff pass. Same inside line." Somebody with access moved the Calder pickup. It doesn\'t say who.' },
  { flag: 'asked_victor_why', text: 'You asked Victor why he picked you. "Not today."' },
  { flag: 'scene04_completed', text: 'A number you don\'t know has a photo of the note: "Ask Victor what happened at the gym before he found you."' },
]
