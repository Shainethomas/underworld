import type { ContractMeta } from './contractScene'
import type { Vars } from '../narrative/types'

// Lucas's board: street work between the story's big jobs. The day-1 hook
// lives here, and it is all plain rules (no engine, no store):
//
//  - Three contracts a night, one per set, new every day at local midnight.
//    The order is fixed from the day the board first opened, so every player's
//    first night is the same three jobs.
//  - Heat cools overnight. A High-risk job can't be taken while Heat is 30 or
//    more ("Too hot. Lie low until tomorrow"), and the story's own Heat
//    checks (Calder's cleanup at 30, the watchers at Mercer House at 25) read
//    the same number, so lying low before a big job is a real choice.
//  - What a contract left behind arrives the next morning as a message, with
//    a small effect (Sal pays the rest, a cousin talks, Victor smiles).
//  - Nights worked in a row: the third and the seventh earn Lucas's word.

export const HEAT_COOLDOWN = 10
export const HOT = 30

export interface Morning {
  from: string
  text: string
  /** "c60" cash, "r5" Respect, "h5" Heat, "t5" Lucas's trust; "" nothing. */
  fx: string
}

export interface BoardState {
  /** The day the board first opened ("YYYY-MM-DD", local). */
  start: string | null
  /** The day the current offer was made. */
  day: string | null
  /** Days skipped forward by the playtest control. */
  offset: number
  offer: string[]
  /** Contracts done today, with their grade. */
  done: Record<string, string>
  /** Messages that arrive tomorrow. */
  pending: Morning[]
  /** Messages that arrived and haven't been read. */
  inbox: Morning[]
  /** Nights worked in a row, and the last night worked. */
  streak: number
  lastWorked: string | null
  /** Contracts finished, ever. */
  total: number
}

export const emptyBoard = (): BoardState => ({ start: null, day: null, offset: 0, offer: [], done: {}, pending: [], inbox: [], streak: 0, lastWorked: null, total: 0 })

const DAY = 86_400_000

/** Today's date, local, as "YYYY-MM-DD", `offset` days ahead. */
export function dayKey(now: number, offset = 0): string {
  const d = new Date(now + offset * DAY)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Whole days from a to b. */
export function daysBetween(a: string, b: string): number {
  const t = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10))
  return Math.round((t(b) - t(a)) / DAY)
}

/** Milliseconds until the next local midnight (when tomorrow's board opens). */
export function msToMidnight(now: number): number {
  const d = new Date(now)
  d.setHours(24, 0, 0, 0)
  return d.getTime() - now
}

/** The night's three contracts: one per set, rotating through each set's list. */
export function offerFor(dayIndex: number, contracts: ContractMeta[]): string[] {
  const byKit = new Map<string, ContractMeta[]>()
  for (const c of [...contracts].sort((a, b) => a.id.localeCompare(b.id))) byKit.set(c.kit, [...(byKit.get(c.kit) ?? []), c])
  const kits = [...byKit.keys()].sort()
  return kits.map((k) => {
    const list = byKit.get(k)!
    return list[((dayIndex % list.length) + list.length) % list.length].id
  })
}

/** Why a contract can't be taken right now, if it can't. */
export function lockReason(c: ContractMeta, vars: Vars, rank: number): string | undefined {
  if (c.risk === 'High' && rank < 1) return 'Needs the rank of Runner'
  if (c.risk === 'High' && vars.heat >= HOT) return 'Too hot. Lie low until tomorrow'
  return undefined
}

export function parseMorning(s: unknown): Morning | null {
  if (typeof s !== 'string' || !s) return null
  const [from = '', text = '', fx = ''] = s.split('^')
  return text ? { from, text, fx } : null
}

/** What a morning message's effect does to the numbers. */
export function applyFx(vars: Vars, fx: string): Vars {
  const m = /^([crht])(-?\d+)$/.exec(fx.trim())
  if (!m) return vars
  const n = Number(m[2])
  const key = ({ c: 'cash', r: 'respect', h: 'heat', t: 'ravi_trust' } as const)[m[1] as 'c' | 'r' | 'h' | 't']
  return { ...vars, [key]: Math.max(0, vars[key] + n) }
}

export function fxLabel(fx: string): string {
  const m = /^([crht])(-?\d+)$/.exec(fx.trim())
  if (!m) return ''
  const n = Number(m[2])
  const sign = n > 0 ? '+' : '−'
  const abs = Math.abs(n)
  if (m[1] === 'c') return `${sign}$${abs}`
  return `${({ r: 'Respect', h: 'Heat', t: "Lucas's Trust" } as const)[m[1] as 'r' | 'h' | 't']} ${sign}${abs}`
}

/**
 * Moves the board to today: a new offer, Heat cooled for each night passed,
 * yesterday's messages delivered (and their effects applied), the streak
 * broken if a night was missed. Returns the same objects when nothing changed.
 */
export function rollDay(board: BoardState, vars: Vars, now: number, contracts: ContractMeta[]): { board: BoardState; vars: Vars } {
  const today = dayKey(now, board.offset)
  if (board.day === today) return { board, vars }
  const start = board.start ?? today
  const nights = board.day ? Math.max(1, daysBetween(board.day, today)) : 0
  let v = vars
  const cooled = nights ? Math.min(vars.heat, HEAT_COOLDOWN * nights) : 0
  if (cooled) v = { ...v, heat: v.heat - cooled }
  for (const m of board.pending) v = applyFx(v, m.fx)
  const inbox = [...board.inbox, ...board.pending]
  if (cooled) inbox.push({ from: 'Lucas', text: `Quiet night. The street's forgetting you. Heat down ${cooled}.`, fx: '' })
  const missed = board.lastWorked ? daysBetween(board.lastWorked, today) > 1 : false
  return {
    vars: v,
    board: {
      ...board,
      start,
      day: today,
      offer: offerFor(daysBetween(start, today), contracts),
      done: {},
      pending: [],
      inbox,
      streak: missed ? 0 : board.streak,
    },
  }
}

/** A contract finished tonight: its grade, tomorrow's message, the streak. */
export function recordJob(board: BoardState, id: string, grade: string, after: unknown, now: number): BoardState {
  const today = dayKey(now, board.offset)
  const first = Object.keys(board.done).length === 0
  const streak = first ? (board.lastWorked && daysBetween(board.lastWorked, today) === 1 ? board.streak + 1 : board.lastWorked === today ? board.streak : 1) : board.streak
  const pending = [...board.pending]
  const morning = parseMorning(after)
  if (morning) pending.push(morning)
  if (first && (streak === 3 || streak === 7)) pending.push({ from: 'Lucas', text: `${streak} nights running. Victor asked who you were. That's a good thing.`, fx: streak === 3 ? 'r10' : 'r20' })
  return { ...board, done: { ...board.done, [id]: grade }, pending, streak, lastWorked: today, total: board.total + 1 }
}
