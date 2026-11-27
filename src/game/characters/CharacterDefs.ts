import { characterUrl } from '../assets/urls'
import type { ActorId } from '../narrative/types'

// Characters are dressed from one CC0 kit (public/assets/models/character_kit.glb,
// built by scripts/blender/build_character_kit.py): a skinned body split into
// segments, garment shells, hair, beard and accessories. Each definition
// picks meshes, tints and build; animation clips are retargeted by bone name.
//
// This file is data only (no engine imports), so the loader can work out which
// files a scene's cast needs before the 3D engine is even downloaded.

export const KIT_URL = `${import.meta.env.BASE_URL}assets/models/character_kit.glb`
export const ANIM_URL = `${import.meta.env.BASE_URL}assets/models/animations.glb`

export type Garment = 'tank' | 'tee' | 'hoodie' | 'jacket' | 'coat' | 'pants' | 'shorts' | 'shoes' | 'wraps' | 'belt'
export type Hair = 'simpleparted' | 'buzzed' | 'long' | 'beard'
export type Fabric = 'knit' | 'wool' | 'denim' | 'leather'

export interface CharacterDef {
  name: string
  /** Overall height scale. */
  scale: number
  /** Extra width through the torso (1 = base build). */
  build: number
  skin: string
  hair: Hair[]
  hairColor: string
  garments: Partial<Record<Garment, string>>
  /** Fabric per garment where it differs from the default (e.g. denim jeans). */
  fabrics?: Partial<Record<Garment, Fabric>>
  /** Trim colours by kit material (shirt, lapels, soles, waistband…). */
  trims?: Record<string, string>
  sunglasses?: boolean
  /** Clear prescription glasses. */
  glasses?: boolean
  pocketSquare?: boolean
  /** Glossy shoes for suits. */
  polished?: boolean
  /**
   * A complete rigged character of its own (GLB with its clips baked onto its
   * skeleton, bones named like the kit's) instead of being dressed from the
   * kit. Its outfit is fixed: `garments` only tints matching meshes
   * (`rk_hoodie` takes the hoodie colour) and outfit changes are ignored.
   */
  model?: string
}

export const CHARACTERS: Record<ActorId, CharacterDef> = {
  // The black three-piece suit, rigged on Mixamo with Mixamo clips
  // (art-source/rookie/ → scripts/blender/build_character.py). He wears it all
  // game: the training and Scene 02 outfit changes don't show, and the garment
  // colours below tint nothing (one mesh, one texture). His gestures differ
  // from the kit's where his clips do (ACTOR_GESTURES in CharacterExpressions.ts).
  rookie: {
    name: 'Rookie',
    model: `${import.meta.env.BASE_URL}assets/models/rookie.glb`,
    scale: 1,
    build: 1,
    skin: '#f2dccb',
    hair: [],
    hairColor: '#1a120c',
    garments: { hoodie: '#1d1e23', pants: '#26272c' },
  },
  ravi: {
    name: 'Ravi',
    scale: 0.97,
    build: 0.96,
    skin: '#b98a6b',
    hair: ['buzzed', 'beard'],
    hairColor: '#0d0a08',
    garments: { hoodie: '#121215', pants: '#2b3854', belt: '#3a2516', shoes: '#e8e6e0' },
    fabrics: { pants: 'denim' },
    trims: { M_Sole: '#ffffff', M_String: '#e8e8e4' },
  },
  // A heavy-set generated character in a white three-piece suit, on a kit
  // skeleton with hand-fitted weights, with Mixamo clips and a hand-made
  // arms-crossed (art-source/don/kingpin/ → scripts/blender/build_character.py).
  // His gestures and walking speed are his own (ACTOR_GESTURES, ACTOR_PACE).
  don: {
    name: 'The Don',
    model: `${import.meta.env.BASE_URL}assets/models/don.glb`,
    scale: 1.0,
    build: 1,
    skin: '#ead3c2',
    hair: [],
    hairColor: '#b9b5ae',
    garments: {},
  },
  // Victor Sable, the boss: a heavy-set bald man with a grey beard in a
  // purple three-piece suit, auto-rigged on Mixamo with his own Mixamo clips
  // (art-source/victor/ → scripts/blender/build_character.py). His gestures
  // and swagger walk are his own (ACTOR_GESTURES, ACTOR_PACE).
  victor: {
    name: 'Victor Sable',
    model: `${import.meta.env.BASE_URL}assets/models/victor.glb`,
    scale: 1.0,
    build: 1,
    skin: '#7a5440',
    hair: [],
    hairColor: '#9a9894',
    garments: {},
  },
  // Both bodyguards are Mixamo "Ch18" (art-source/alex/alex.fbx): black tactical
  // gear, cap and sunglasses, all part of the model.
  guard1: {
    name: 'Bodyguard',
    model: `${import.meta.env.BASE_URL}assets/models/alex.glb`,
    scale: 1.0,
    build: 1,
    skin: '#e6cdb9',
    hair: [],
    hairColor: '#1b1714',
    garments: {},
  },
  guard2: {
    name: 'Bodyguard',
    model: `${import.meta.env.BASE_URL}assets/models/alex.glb`,
    scale: 1.01,
    build: 1,
    skin: '#8e6650',
    hair: [],
    hairColor: '#0b0908',
    garments: {},
  },
  // Lucas, Rookie's friend, in place of Ravi in Scene 01 (later scenes still
  // have Ravi): a generated character auto-rigged on Mixamo with his own idle,
  // talk, walk and clapping, plus leaning on the ring rail retargeted from the
  // clip library (art-source/lucas/ → scripts/blender/build_character.py).
  // His gestures are his own (ACTOR_GESTURES); he doesn't fold his arms.
  lucas: {
    name: 'Lucas',
    model: `${import.meta.env.BASE_URL}assets/models/lucas.glb`,
    scale: 1.0,
    build: 1,
    skin: '#d9b59a',
    hair: [],
    hairColor: '#1a120c',
    garments: {},
  },
  marco: {
    name: 'Marco',
    // bigger and heavier than Rookie
    scale: 1.04,
    build: 1.12,
    skin: '#dcbfa6',
    hair: ['long'],
    hairColor: '#2a1c12',
    garments: { tank: '#6e1519', shorts: '#141417', shoes: '#1d1d20', wraps: '#b9b6ae' },
    trims: { M_Band: '#6e1519', M_Sole: '#d8d8d4' },
  },
  fighter1: {
    name: 'Fighter',
    scale: 1.02,
    build: 1.04,
    skin: '#9c7258',
    hair: ['buzzed'],
    hairColor: '#0d0b09',
    garments: { tee: '#3a3d45', shorts: '#202430', shoes: '#25252a', wraps: '#7a1a1f' },
    trims: { M_Band: '#7a1a1f', M_Sole: '#d8d8d4' },
  },
  fighter2: {
    name: 'Fighter',
    scale: 0.98,
    build: 1,
    skin: '#e3c6ad',
    hair: ['long', 'beard'],
    hairColor: '#3a2717',
    garments: { tee: '#5a4632', pants: '#26272c', shoes: '#1a1a1d' },
    fabrics: { pants: 'knit' },
    trims: { M_Sole: '#d8d8d4' },
  },
  // Background trainees on the Don's training floor.
  trainee1: {
    name: 'Trainee',
    scale: 1.0,
    build: 0.98,
    skin: '#b88a6a',
    hair: ['simpleparted'],
    hairColor: '#1a120c',
    garments: { tank: '#1c1d22', shorts: '#3a1418', shoes: '#202024', wraps: '#d0ccc2' },
    trims: { M_Band: '#3a1418', M_Sole: '#d8d8d4' },
  },
  trainee2: {
    name: 'Trainee',
    scale: 1.01,
    build: 1.06,
    skin: '#6f4c3a',
    hair: ['buzzed', 'beard'],
    hairColor: '#0b0908',
    garments: { tee: '#4a4f58', pants: '#17181c', shoes: '#141416', wraps: '#1d1d22' },
    fabrics: { pants: 'knit' },
    trims: { M_Sole: '#d8d8d4' },
  },
  driver: {
    name: 'Driver',
    scale: 1.0,
    build: 1.04,
    skin: '#c99d7e',
    hair: ['buzzed'],
    hairColor: '#151210',
    garments: { jacket: '#0b0b0e', pants: '#0b0b0e', belt: '#08080a', shoes: '#070708' },
    trims: { M_Shirt: '#d6d6d2', M_Lapel: '#060607', M_Sole: '#070708' },
    polished: true,
  },
  // Project Chronos's lead scientist: greying, glasses, white coat over a dark shirt.
  scientist: {
    name: 'The Scientist',
    scale: 0.98,
    build: 0.94,
    skin: '#e3c8b2',
    hair: ['simpleparted'],
    hairColor: '#8f8b85',
    garments: { coat: '#e6e7e4', pants: '#2b2e35', belt: '#16110d', shoes: '#1b1a19' },
    trims: { M_Shirt: '#1d2027', M_Button: '#d9d9d5', M_Sole: '#1b1a19' },
    glasses: true,
  },
  // Sal, who keeps the warehouse on Pier Nine: older, heavy-set, grey beard,
  // a dark work jacket over a knit top, jeans and work boots.
  sal: {
    name: 'Sal',
    scale: 1.0,
    build: 1.05,
    skin: '#b08a74',
    hair: ['buzzed', 'beard'],
    hairColor: '#8a847c',
    garments: { jacket: '#2a2620', pants: '#2c3646', belt: '#1c140e', shoes: '#2a2018' },
    fabrics: { pants: 'denim', jacket: 'wool' },
    trims: { M_Shirt: '#3b3f44', M_Lapel: '#211e19', M_Sole: '#141210' },
  },
  // Scene 03's contact, Nico, who holds the package at the old rail yard:
  // younger, thin, unshaven, a faded olive hoodie, jeans, scuffed white trainers.
  nico: {
    name: 'Nico',
    scale: 0.96,
    build: 0.9,
    skin: '#c9a183',
    hair: ['simpleparted'],
    hairColor: '#24180f',
    garments: { hoodie: '#4f4a36', pants: '#33415a', belt: '#1c140e', shoes: '#d6d2c8' },
    fabrics: { pants: 'denim' },
    trims: { M_Sole: '#e6e3dc', M_String: '#cfc9b8' },
  },
  // The man from the grey sedan in Scene 03: big, a dark brown leather jacket
  // over a black tee, black trousers, cropped hair.
  stranger: {
    name: 'Stranger',
    scale: 1.05,
    build: 1.12,
    skin: '#d3ae95',
    hair: ['buzzed'],
    hairColor: '#17110c',
    garments: { jacket: '#2e2019', pants: '#18191d', belt: '#0b0b0c', shoes: '#0f0f10' },
    fabrics: { jacket: 'leather' },
    trims: { M_Shirt: '#141416', M_Lapel: '#24180f', M_Sole: '#0f0f10' },
  },
  local: {
    name: 'Resident', scale: 0.97, build: 0.94, skin: '#ba927b',
    hair: ['simpleparted', 'beard'], hairColor: '#85817b',
    garments: { hoodie: '#574e45', pants: '#292e36', shoes: '#302a25' },
  },
  caller: {
    name: 'Unknown caller', scale: 1, build: 1, skin: '#c9a183',
    hair: ['buzzed'], hairColor: '#17110c', garments: { jacket: '#18191d', pants: '#18191d' },
  },
  accomplice: {
    name: 'Second man', scale: 1.01, build: 1.02, skin: '#8f6953',
    hair: ['simpleparted'], hairColor: '#16110d',
    garments: { jacket: '#353d46', pants: '#222831', shoes: '#16181b' },
  },
  sentry: {
    name: 'Security',
    scale: 1.04,
    build: 1.1,
    skin: '#7d5743',
    hair: ['buzzed', 'beard'],
    hairColor: '#0c0a09',
    garments: { tee: '#1c222c', pants: '#1a1d24', belt: '#0b0b0c', shoes: '#0d0d0e' },
    trims: { M_Sole: '#0d0d0e', M_Buckle: '#8c8c8c' },
  },
  tech1: {
    name: 'Technician',
    scale: 0.97,
    build: 0.95,
    skin: '#d8b79b',
    hair: ['long'],
    hairColor: '#3a2a1c',
    garments: { coat: '#dfe1df', pants: '#2b3854', shoes: '#2a2a2d' },
    fabrics: { pants: 'denim' },
    trims: { M_Shirt: '#9fb2c4', M_Button: '#d9d9d5', M_Sole: '#d8d8d4' },
  },
  tech2: {
    name: 'Technician',
    scale: 1.01,
    build: 1.0,
    skin: '#a77a5d',
    hair: ['buzzed'],
    hairColor: '#0e0b09',
    garments: { coat: '#e2e3e0', pants: '#33353b', shoes: '#18181b' },
    trims: { M_Shirt: '#e8e8e4', M_Button: '#d9d9d5', M_Sole: '#18181b' },
  },
  tech3: {
    name: 'Technician',
    scale: 0.99,
    build: 0.97,
    skin: '#efd5c2',
    hair: ['simpleparted', 'beard'],
    hairColor: '#5a3d26',
    garments: { coat: '#dddfdc', pants: '#3a3c42', shoes: '#1e1e21' },
    trims: { M_Shirt: '#3b4a5c', M_Button: '#d9d9d5', M_Sole: '#1e1e21' },
  },
  // ── Street work (src/story/contracts) ──────────────────────────────────
  // The people a contract is with. Each contract renames them (scene `names`),
  // so one look plays many small-time contacts across the board.
  // An older fence: grey, heavy, a camel coat over a dark knit.
  fence: {
    name: 'Fence',
    scale: 0.99,
    build: 1.08,
    skin: '#c7a08a',
    hair: ['simpleparted', 'beard'],
    hairColor: '#9a948c',
    garments: { coat: '#7a5f43', pants: '#2a2b30', belt: '#1a140f', shoes: '#22190f' },
    fabrics: { coat: 'wool' },
    trims: { M_Shirt: '#2b2a2e', M_Button: '#3a2c1e', M_Sole: '#141210' },
  },
  // A sharp dresser who sells to whoever pays: navy suit, no tie.
  dealer: {
    name: 'Dealer',
    scale: 1.0,
    build: 0.98,
    skin: '#9a6f55',
    hair: ['buzzed', 'beard'],
    hairColor: '#120d0a',
    garments: { jacket: '#1d2638', pants: '#1d2638', belt: '#0b0b0c', shoes: '#0c0c0d' },
    trims: { M_Shirt: '#c9c6bf', M_Lapel: '#151c2a', M_Sole: '#0c0c0d' },
    polished: true,
  },
  // Young and nervous: a red track top, grey joggers, white trainers.
  kid: {
    name: 'Kid',
    scale: 0.95,
    build: 0.9,
    skin: '#e0bfa5',
    hair: ['long'],
    hairColor: '#3b2617',
    garments: { hoodie: '#6e1f22', pants: '#4a4c52', shoes: '#dad6cc' },
    fabrics: { pants: 'knit' },
    trims: { M_Sole: '#e6e3dc', M_String: '#d6d0c2' },
  },
  // Runs rooms and owes favours: older, a long dark coat, glasses.
  widow: {
    name: 'Landlady',
    scale: 0.96,
    build: 0.95,
    skin: '#d9b59c',
    hair: ['simpleparted'],
    hairColor: '#b9b3ab',
    garments: { coat: '#2c2a33', pants: '#1f1f24', shoes: '#191818' },
    fabrics: { coat: 'wool' },
    trims: { M_Shirt: '#5a3b45', M_Button: '#8c8c8c', M_Sole: '#191818' },
    glasses: true,
  },
  // Muscle for the other side: big, a black bomber, cropped hair.
  heavy: {
    name: 'Heavy',
    scale: 1.06,
    build: 1.14,
    skin: '#b48a6e',
    hair: ['buzzed'],
    hairColor: '#0e0b09',
    garments: { jacket: '#141518', pants: '#25272d', belt: '#0b0b0c', shoes: '#101011' },
    fabrics: { jacket: 'leather' },
    trims: { M_Shirt: '#3c3f46', M_Lapel: '#101113', M_Sole: '#101011' },
  },
  heavy2: {
    name: 'Heavy',
    scale: 1.03,
    build: 1.1,
    skin: '#6e4a38',
    hair: ['buzzed', 'beard'],
    hairColor: '#0a0807',
    garments: { tee: '#2d3a2e', pants: '#1c1d21', belt: '#0b0b0c', shoes: '#0f0f10' },
    trims: { M_Sole: '#0f0f10', M_Buckle: '#8c8c8c' },
  },
}

/** The model files a cast needs (phone-sized variants on phones, see urls.ts): the kit and clip library for kit-dressed characters, plus each complete model. */
export function castUrls(cast: readonly ActorId[]): string[] {
  const defs = cast.map((id) => CHARACTERS[id]).filter(Boolean)
  const urls = new Set<string>()
  if (defs.some((d) => !d.model)) urls.add(characterUrl(KIT_URL)).add(ANIM_URL)
  for (const d of defs) if (d.model) urls.add(characterUrl(d.model))
  return [...urls]
}
