import type { Condition } from './types'

// Project Chronos, human trial 01 (Scene 03): the facts the story and the sets
// share, and the conditions later scenes use to remember how it went.
//
// Everything the player does is stored in the ordinary narrative state:
//   choices   risk (last question), reason (why he volunteered), ready (his
//             last words before the chamber), year (how he spent it)
//   flags     asked_danger / asked_odds / asked_stranded, volunteered,
//             field_lock (hold result), past_first (first thing he looked at),
//             date_source, past_newspaper / past_display / past_poster /
//             past_tower / past_diner
//   vars      timeline_knowledge, experiment_commitment, scientist_trust …

/** What the lab set, and what it measured. */
export const EXPERIMENT = {
  destination: 'ONE YEAR PRIOR',
  /** Seconds the lab's instruments say he was gone. */
  labElapsed: 60,
  /** What it felt like on the other side. */
  subjectElapsed: 'almost a year',
} as const

/** "Today", one year back: printed on the newspaper and the street display. */
export const PAST_DATE = { day: 'MONDAY', long: '3 NOVEMBER 2025', short: 'MON 03 NOV 2025' } as const

/** The scientist's three risk questions, each asked at most once. */
export const RISK_FLAGS = ['asked_danger', 'asked_odds', 'asked_stranded'] as const
export type RiskFlag = (typeof RISK_FLAGS)[number]
export const notAsked = (flag: RiskFlag): Condition => ({ not: { flag } })
export const askedAllRisks: Condition = { all: RISK_FLAGS.map((flag) => ({ flag })) }

/** He went straight for something with the date on it. */
export const dateFirstTry: Condition = { any: [{ flag: 'past_first', eq: 'newspaper' }, { flag: 'past_first', eq: 'display' }] }

/** He made it through Scene 02's checkpoint with his phone. */
export const keptPhone: Condition = { all: [{ choice: 'phone', is: 'hide' }, { flag: 'nerve', gte: 0.67 }] }
