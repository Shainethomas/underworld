import type { FlagValue, SpeakerId, VarKey, Vars } from './types'

export const DEFAULT_VARS: Vars = {
  don_loyalty: 0,
  independence: 0,
  ravi_trust: 0,
  discipline: 0,
  timeline_knowledge: 0,
  don_ambition_knowledge: 0,
  scientist_trust: 0,
  experiment_commitment: 0,
  heat: 0,
  intel: 0,
  cash: 0,
  respect: 0,
  varga: 0,
}

export const VAR_LABELS: Record<VarKey, string> = {
  don_loyalty: "Victor's Favour",
  independence: 'Independence',
  ravi_trust: "Lucas's Trust",
  discipline: 'Discipline',
  timeline_knowledge: 'Timeline Knowledge',
  don_ambition_knowledge: "Victor's Ambition",
  scientist_trust: 'Scientist Trust',
  experiment_commitment: 'Experiment Commitment',
  // Scene 03: how much attention he drew on the job, and how much he saw
  heat: 'Heat',
  intel: 'Intel',
  cash: 'Cash',
  respect: 'Respect',
  varga: 'Varga Hostility',
}

export const SPEAKER_NAMES: Record<SpeakerId, string> = { rookie: 'Rookie', ravi: 'Ravi', lucas: 'Lucas', don: 'The Don', victor: 'Victor Sable', guard1: 'Bodyguard', driver: 'Driver', scientist: 'The Scientist', sentry: 'Security', sal: 'Sal', nico: 'Nico', stranger: 'Stranger', local: 'Resident', caller: 'Unknown caller', accomplice: 'Second man', marco: 'Marco', fence: 'Fence', dealer: 'Dealer', kid: 'Kid', widow: 'Landlady', heavy: 'Heavy', heavy2: 'Heavy' }

export const VAR_ICONS = {
  don_loyalty: 'crown',
  independence: 'brain',
  ravi_trust: 'hand',
  discipline: 'scales',
  timeline_knowledge: 'hourglass',
  don_ambition_knowledge: 'eye',
  scientist_trust: 'atom',
  experiment_commitment: 'target',
  heat: 'warning',
  intel: 'eye',
  cash: 'cash',
  respect: 'fist',
  varga: 'target',
} as const

/** Everything the narrative needs to evaluate conditions. */
export interface NarrativeContext {
  vars: Vars
  choices: Record<string, string>
  flags: Record<string, FlagValue>
}

/** A speaker's name in a scene: the scene's own name for them (a contract's contact), else the default. */
export function speakerName(speaker: SpeakerId, scene?: { names?: Partial<Record<SpeakerId, string>> } | null): string {
  return scene?.names?.[speaker] ?? SPEAKER_NAMES[speaker]
}
