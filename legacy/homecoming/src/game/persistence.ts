// Storage boundary for game progress. The prototype saves to localStorage;
// a backend adapter only has to implement the same three methods (and can
// validate choices/rewards server-side using the pure narrative runner).

export interface SaveData {
  version: number
  player: PlayerState
  reputation: Record<'respect' | 'fear' | 'ambition', number>
  relationships: Record<string, number>
  flags: Record<string, boolean | number | string>
  choices: Record<string, string>
  objectives: Record<string, ObjectiveStatus>
  checkpoint: string | null
  completedScenes: string[]
  settings: Settings
}

export interface PlayerState {
  name: string
  level: number
  xp: number
  xpToNext: number
  cash: number
  gold: number
  health: number
  healthMax: number
  power: number
}

export type ObjectiveStatus = 'locked' | 'active' | 'done'
export type Quality = 'auto' | 'low' | 'medium' | 'high'

export interface Settings {
  sound: boolean
  quality: Quality
  textSpeed: 'normal' | 'fast' | 'instant'
  autoAdvance: boolean
}

export interface GameStateService {
  load(): SaveData | null
  save(data: SaveData): void
  clear(): void
}

const KEY = 'underworld.save.v1'
export const SAVE_VERSION = 2

export class LocalGameStateService implements GameStateService {
  load(): SaveData | null {
    try {
      const raw = localStorage.getItem(KEY)
      if (!raw) return null
      const data = JSON.parse(raw) as SaveData
      return data.version === SAVE_VERSION ? data : null
    } catch {
      return null
    }
  }
  save(data: SaveData) {
    try {
      localStorage.setItem(KEY, JSON.stringify(data))
    } catch {
      /* storage unavailable (private mode) — progress lives for this session only */
    }
  }
  clear() {
    try {
      localStorage.removeItem(KEY)
    } catch {
      /* ignore */
    }
  }
}

export const gameStateService: GameStateService = new LocalGameStateService()
