// Character identity sheets. Every scene spawns characters from these specs,
// so Rookie and Mad Dog look identical everywhere. When rigged GLBs exist,
// set `model` and the Actor will use it instead of the procedural build.

export interface CharacterSpec {
  id: string
  model?: string
  height: number
  bulk: number
  skin: string
  hair: 'messy' | 'mohawk' | 'bald' | 'bandana' | 'beanie' | 'greyRing' | 'slick'
  hairColor: string
  beardColor?: string
  accentColor?: string
  beard: 'none' | 'stubble' | 'short' | 'full' | 'mustache'
  top: 'leatherJacket' | 'vestBare' | 'vestShirt' | 'cardigan'
  topColor: string
  shirtColor: string
  pants: string
  boots: string
  tattoos: number
  emblem: boolean
  glasses?: 'sun' | 'reading'
  apron?: boolean
  scars?: boolean
  earring?: boolean
  wristband?: boolean
  chain?: boolean
}

export const ROOKIE: CharacterSpec = {
  id: 'rookie',
  height: 1.0,
  bulk: 1.04,
  skin: '#a9826c',
  hair: 'messy',
  hairColor: '#17110d',
  beard: 'stubble',
  top: 'leatherJacket',
  topColor: '#121214',
  shirtColor: '#2a2b2e',
  pants: '#1d2330',
  boots: '#2a1f18',
  tattoos: 0,
  emblem: false,
  scars: true,
}

export const MAD_DOG: CharacterSpec = {
  id: 'maddog',
  height: 1.08,
  bulk: 1.28,
  skin: '#9a6e57',
  hair: 'mohawk',
  hairColor: '#1d2c40',
  beardColor: '#241c16',
  beard: 'short',
  top: 'vestBare',
  topColor: '#0d0d0e',
  shirtColor: '#0d0d0e',
  pants: '#1c2129',
  boots: '#141210',
  tattoos: 2,
  emblem: true,
  scars: true,
  earring: true,
  wristband: true,
  chain: true,
}

const biker = (n: number, o: Partial<CharacterSpec>): CharacterSpec => ({
  id: `biker${n}`,
  height: 1.0,
  bulk: 1.12,
  skin: '#b48466',
  hair: 'bald',
  hairColor: '#1a1612',
  beard: 'full',
  top: 'vestShirt',
  topColor: '#0f0f10',
  shirtColor: '#26262a',
  pants: '#1e232c',
  boots: '#151311',
  tattoos: 1,
  emblem: true,
  ...o,
})

export const BIKERS: CharacterSpec[] = [
  biker(1, { hair: 'bandana', accentColor: '#7a1b18', beard: 'full', skin: '#c19274', shirtColor: '#3a3430', height: 1.02 }),
  biker(2, { hair: 'beanie', accentColor: '#2b2b2e', beard: 'short', glasses: 'sun', skin: '#8d5f45', bulk: 1.2 }),
  biker(3, { hair: 'slick', hairColor: '#2a2018', beard: 'mustache', skin: '#c79a7c', shirtColor: '#4a1e1c', height: 0.98, bulk: 1.05 }),
  biker(4, { hair: 'bald', beard: 'full', hairColor: '#3a2c20', skin: '#9c6b4f', bulk: 1.3, height: 1.04, tattoos: 2 }),
  biker(5, { hair: 'bandana', accentColor: '#151517', beard: 'stubble', glasses: 'sun', skin: '#b78a6c', shirtColor: '#1b2230' }),
]

export const SHOPKEEPER_SAL: CharacterSpec = {
  id: 'sal',
  height: 0.95,
  bulk: 1.08,
  skin: '#c5997e',
  hair: 'greyRing',
  hairColor: '#a9a49c',
  beard: 'mustache',
  top: 'cardigan',
  topColor: '#4b3b2c',
  shirtColor: '#c9c2b0',
  pants: '#3a3b3e',
  boots: '#1d1a17',
  tattoos: 0,
  emblem: false,
  glasses: 'reading',
  apron: true,
}

export const SHOPKEEPER_2: CharacterSpec = {
  ...SHOPKEEPER_SAL,
  id: 'shop2',
  height: 0.98,
  hair: 'slick',
  hairColor: '#3a332c',
  beard: 'none',
  topColor: '#2c3b44',
  glasses: undefined,
  skin: '#a87a5e',
}

export const SHOPKEEPER_3: CharacterSpec = {
  ...SHOPKEEPER_SAL,
  id: 'shop3',
  height: 0.93,
  hair: 'greyRing',
  hairColor: '#5d574f',
  beard: 'stubble',
  topColor: '#5b2a24',
  apron: false,
  glasses: undefined,
}
