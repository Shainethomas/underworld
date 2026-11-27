import type { SpeakerId } from './types'

export interface SpeakerDef {
  name: string
  /** CSS colour for the name tab on the dialogue box (white text sits on it) */
  color: string
  portrait?: string
  style: 'dialogue' | 'narration'
}

export const SPEAKERS: Record<SpeakerId, SpeakerDef> = {
  narrator: { name: '', color: '#9e2235', style: 'narration' },
  rookie: { name: 'Rookie', color: '#2f5d9e', portrait: '/assets/images/portrait_rookie.png', style: 'dialogue' },
  maddog: { name: 'Mad Dog', color: '#9e2235', portrait: '/assets/images/portrait_maddog.png', style: 'dialogue' },
  shopkeeper: { name: 'Old Sal', color: '#5d5872', style: 'dialogue' },
  biker: { name: 'Mad Dog Biker', color: '#7a3b2e', style: 'dialogue' },
}
