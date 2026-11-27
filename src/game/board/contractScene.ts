import type { ActorId, Beat, EnvironmentId, ExploreBeat, SceneData, SpeakerId, TitleBeat } from '../narrative/types'

// A contract on Lucas's board is played as a scene of its own: its Ink
// (src/story/contracts/c_*.ink, the words and branches), its meta
// (c_*.json: the card on the board, who plays the contact and the muscle,
// what the hotspots are), and the staging kit of the set it happens on
// (kits/<kit>.staging.json), where the cast are written `@contact` and
// `@heavy`. This module joins them; it has no Vite or engine imports, so the
// checks in scripts/ can build the same scene the game does.

export type Mood = 'greedy' | 'scared' | 'proud'
export type Risk = 'Low' | 'Medium' | 'High'

export interface ContractMeta {
  id: string
  /** Which set it plays on (a kit in src/story/contracts/kits). */
  kit: string
  title: string
  /** Who the job is for, on the card. */
  client: string
  risk: Risk
  /** Cash and Respect for a clean deal (the Ink's k_start must say the same). */
  pay: number
  respect: number
  /** The contact's temperament (the Ink's k_start must say the same). */
  mood: Mood
  pitch: string
  cast: { contact: ActorId & SpeakerId; heavy: ActorId & SpeakerId }
  names: { contact: string; heavy: string }
  hotspots: {
    contact: string
    clue_a?: { label: string; lines: string[] }
    clue_b?: { label: string; lines: string[] }
  }
}

export interface Kit {
  kit: { env: EnvironmentId; place: string }
  beats: Record<string, Beat>
}

export function fmtPay(n: number): string {
  return `$${n.toLocaleString('en-US')}`
}

/** The scene a contract plays as. `rankCap` is how far its debrief may promote (the story keeps the big promotions). */
export function contractScene(meta: ContractMeta, kit: Kit, story: object, rankCap = 1): SceneData {
  const { contact, heavy } = meta.cast
  const text = JSON.stringify(kit.beats).replaceAll('@contact', contact).replaceAll('@heavy', heavy)
  const beats = JSON.parse(text) as Record<string, Beat>

  const title = beats.k_title as TitleBeat | undefined
  if (title) Object.assign(title, { chapter: 'Street Work', title: meta.title, subtitle: `${meta.client} · ${fmtPay(meta.pay)} · Risk ${meta.risk}` })

  const explore = beats.k_explore as ExploreBeat | undefined
  if (explore) {
    explore.hotspots = explore.hotspots.flatMap((h) => {
      if (h.id === 'contact') return [{ ...h, label: meta.hotspots.contact }]
      const clue = meta.hotspots[h.id as 'clue_a' | 'clue_b']
      if (!clue) return []
      return [{ ...h, label: clue.label, lines: clue.lines.map((t) => ({ speaker: 'rookie' as const, text: t })) }]
    })
  }

  return {
    id: meta.id,
    index: 0,
    chapter: { number: 1, title: 'Street Work' },
    title: meta.title,
    environments: [kit.kit.env],
    cast: ['rookie', contact, heavy],
    summary: ['respect', 'cash', 'heat'],
    rankCap,
    kind: 'contract',
    speakers: { CONTACT: contact, HEAVY: heavy },
    names: { [contact]: meta.names.contact, [heavy]: meta.names.heavy },
    story,
    staging: beats,
  }
}
