import type { ActorDirective, ChapterDef, Ground, SceneDef } from './types'

// CHAPTER 1 — HOMECOMING
// All story content lives here as data. Camera shot names refer to the shot
// tables in src/three/environments/*Shots.ts; actor ids refer to the cast an
// environment spawns.

const PI = Math.PI
const VIDEO = '/assets/video'

// ── Dockyard blocking ─────────────────────────────────────────────────────
const BIKERS = ['biker1', 'biker2', 'biker3', 'biker4', 'biker5'] as const
const APPROACH: Ground = [0.4, -3.2] // where Rookie stops in front of Mad Dog
const PIN_ROOKIE: Ground = [0.4, -9.62]
const PIN_MADDOG: Ground = [0.4, -10.36] // back against the container wall

/** Positions on an arc around `c`, opening toward -z (Mad Dog / the wall). */
function ring(c: Ground, r: number): Ground[] {
  return [-100, -50, 0, 50, 100].map((deg) => {
    const t = (deg * PI) / 180
    return [+(c[0] + r * Math.sin(t)).toFixed(2), +(c[1] + r * Math.cos(t)).toFixed(2)] as Ground
  })
}
function bikersAt(points: Ground[], extra: ActorDirective = {}): Record<string, ActorDirective> {
  return Object.fromEntries(BIKERS.map((id, i) => [id, { pos: points[i], face: 'rookie', ...extra }]))
}
const RING_APPROACH = ring(APPROACH, 3.6)
const RING_WALL = ring(PIN_ROOKIE, 3.3)
const RING_BACKOFF = ring(PIN_ROOKIE, 5.6)

const DOCK_IDLE: Record<string, ActorDirective> = {
  biker1: { pos: [-4.7, -3.7], face: 2.3, pose: 'warmHands' },
  biker2: { pos: [-2.5, -4.1], face: -1.9, pose: 'armsCrossed' },
  biker3: { pos: [-3.5, -6.3], face: 0.3, pose: 'idle' },
  biker4: { pos: [3.4, -6.6], face: -0.7, pose: 'lean' },
  biker5: { pos: [4.5, -4.4], face: -1.5, pose: 'armsCrossed' },
}

// ── Scenes ────────────────────────────────────────────────────────────────

const s01: SceneDef = {
  id: 's01_return',
  index: 1,
  title: 'The Return',
  subtitle: 'Highway into Port Argent · Dusk',
  environment: 'highway',
  preload: [`${VIDEO}/s01_establishing.mp4`],
  stage: {
    shot: 'hw_wide',
    actors: { rookie: { pos: [8.6, 27], face: PI, pose: 'handsPocket', prop: 'bag' } },
  },
  beats: [
    {
      type: 'video', text: "Port Argent. The city you grew up in, the city you swore you'd never come back to.",
      src: `${VIDEO}/s01_establishing.mp4`,
      poster: `${VIDEO}/s01_establishing.jpg`,
      rain: true,
      captions: [{ at: 1.4, dur: 6.4, speaker: 'narrator', text: 'Some places never leave you. Even when you leave them.' }],
    },
    {
      type: 'hold', text: 'Three bikes tear past on the wet highway, headed for the city lights.',
      duration: 3.6,
      stage: { shot: 'hw_wide', cut: true, fx: ['bikesPass', 'rev'], actors: { rookie: { pos: [8.6, 13.5], speed: 1.35 } } },
    },
    { type: 'hold', text: "You walk the last mile home. The rain hasn't changed. Everything else has.", duration: 4.2, stage: { shot: 'hw_track' } },
    { type: 'hold', text: 'Someone has sprayed MAD DOGS across the welcome sign.', duration: 2.4, stage: { shot: 'hw_front' } },
    {
      type: 'line',
      speaker: 'rookie',
      text: 'Everything looks different.',
      stage: { shot: 'hw_close', actors: { rookie: { pose: 'lookUp', expr: 'stern' } } },
    },
    {
      type: 'title', text: 'Chapter 1 begins.',
      kicker: 'CHAPTER 1',
      title: 'HOMECOMING',
      duration: 4.6,
      stage: {
        shot: 'hw_title',
        actors: { rookie: { pos: [8.6, -40], pose: 'handsPocket', expr: 'neutral', speed: 1.35 } },
      },
    },
    { type: 'objective', complete: ['obj_return'], activate: ['obj_street'] },
    { type: 'reward', effects: { xp: 20 }, reason: 'Back in Port Argent' },
  ],
  next: 's02_street',
}

const s02: SceneDef = {
  id: 's02_street',
  index: 2,
  title: 'The City Belongs to Mad Dog',
  subtitle: 'Calloway Street · Night',
  environment: 'street',
  stage: {
    shot: 'st_establish',
    actors: {
      rookie: { pos: [1.4, 25], face: PI, pose: 'handsPocket' },
      sal: { pos: [-6.5, -12], face: PI / 2, pose: 'idle', expr: 'stern' },
      // the shakedown, right side
      biker1: { pos: [6.0, -6.0], face: PI / 2, pose: 'point', expr: 'angry', look: 'shop2' },
      shop2: { pos: [7.15, -6.1], face: -PI / 2, pose: 'cower', expr: 'pained', look: 'biker1' },
      // collecting money, left side
      biker2: { pos: [-5.9, 1.0], face: -PI / 2, pose: 'collect', prop: 'cash', look: 'shop3' },
      shop3: { pos: [-7.05, 1.0], face: PI / 2, pose: 'cower', expr: 'pained' },
      // roadblock lookouts
      biker3: { pos: [-2.2, -19.2], face: 0, pose: 'armsCrossed', expr: 'stern' },
      biker4: { pos: [2.6, -19.6], face: -0.2, pose: 'lean' },
    },
  },
  beats: [
    { type: 'hold', text: 'Calloway Street. Shutters half down, bikes everywhere, and nobody looking anyone in the eye.', duration: 3.0, stage: { shot: 'st_establish', actors: { rookie: { pos: [1.4, 15], speed: 1.4 } } } },
    {
      type: 'line',
      speaker: 'rookie',
      text: 'What the hell happened to this place?',
      stage: { shot: 'st_rookie_front', actors: { rookie: { pose: 'idleTense', expr: 'angry', look: 'biker1' } } },
    },
    {
      type: 'explore',
      prompt: 'Walk the street. Find someone who will talk.',
      stage: { shot: 'st_follow', actors: { rookie: { pose: 'idle', look: null, expr: 'neutral' } } },
      hotspots: [
        {
          id: 'graffiti', action: 'Read the gang tag on the wall',
          label: 'Gang tag',
          icon: 'eye',
          pos: [7.9, 7.0],
          stand: [5.4, 7.2],
          face: PI / 2,
          lines: [{ speaker: 'rookie', text: "Mad Dogs. Their mark's on every wall on the block." }],
        },
        {
          id: 'collection', action: 'Watch the money change hands',
          label: 'Collection',
          icon: 'eye',
          pos: [-6.4, 1.0],
          stand: [-3.6, 2.4],
          face: 'biker2',
          lines: [
            { speaker: 'rookie', text: 'Protection money. Right out in the open.' },
            {
              speaker: 'biker',
              text: 'Keep walking, tourist.',
              stage: { actors: { biker2: { look: 'rookie', expr: 'angry' } } },
            },
          ],
        },
        {
          id: 'shakedown', action: "Check on Benny's hardware store",
          label: 'Shakedown',
          icon: 'eye',
          pos: [6.6, -6.0],
          stand: [3.6, -4.4],
          face: 'biker1',
          lines: [
            {
              speaker: 'rookie',
              text: "Old Benny's hardware. He used to give us free sodas.",
              stage: { actors: { shop2: { look: 'rookie' } } },
            },
          ],
        },
        {
          id: 'sal', action: 'Talk to the old shopkeeper',
          label: 'Old shopkeeper',
          icon: 'talk',
          pos: [-6.5, -12],
          stand: [-4.9, -11.3],
          face: 'sal',
          ends: true,
        },
      ],
    },
    { type: 'objective', complete: ['obj_street'], activate: ['obj_talk'] },
    {
      type: 'line',
      speaker: 'shopkeeper',
      text: "You shouldn't be here, son.",
      stage: {
        shot: 'st_ots_sal',
        actors: {
          sal: { face: 'rookie', look: 'rookie', expr: 'stern', pose: 'idle' },
          rookie: { face: 'sal', look: 'sal', pose: 'idle' },
        },
      },
    },
    { type: 'line', speaker: 'rookie', text: 'Who runs this place now?', stage: { shot: 'st_ots_rookie' } },
    {
      type: 'line',
      speaker: 'shopkeeper',
      text: 'Mad Dog. And his men.',
      stage: { shot: 'st_sal_close', actors: { sal: { look: 'biker1', expr: 'pained' } } },
    },
    {
      type: 'hold', text: 'You look down the street at the bikers. Your jaw tightens.',
      duration: 3.0,
      stage: {
        shot: 'st_rookie_react',
        fx: ['heartbeat'],
        actors: { rookie: { expr: 'angry', look: 'biker1', pose: 'idleTense' } },
      },
    },
    {
      type: 'line',
      speaker: 'shopkeeper',
      text: 'He holds court down at the docks most nights. Stay away from there.',
      stage: { shot: 'st_ots_sal', actors: { sal: { look: 'rookie', expr: 'stern' }, rookie: { look: 'sal' } } },
    },
    { type: 'objective', complete: ['obj_talk'], activate: ['obj_docks'] },
    { type: 'reward', effects: { xp: 30 }, reason: 'Learned who runs the city' },
  ],
  next: 's03_docks',
}

const s03: SceneDef = {
  id: 's03_docks',
  index: 3,
  title: 'Finding Mad Dog',
  subtitle: 'Pier 9 Container Yard · Night',
  environment: 'dockyard',
  stage: {
    shot: 'dk_establish',
    actors: {
      rookie: { pos: [1.0, 17], face: PI, pose: 'handsPocket' },
      maddog: { pos: [-2.6, -8.2], face: 0.5, pose: 'sitBike', expr: 'smirk', prop: 'bat' },
      ...DOCK_IDLE,
    },
  },
  beats: [
    { type: 'hold', text: 'Pier 9. Containers stacked like tombstones, a fire barrel burning between the bikes.', duration: 3.6, stage: { shot: 'dk_establish', fx: ['thunder'] } },
    { type: 'hold', text: 'Every head turns as you walk in out of the rain.', duration: 3.2, stage: { shot: 'dk_enter', actors: { rookie: { pos: [1.0, 9.5], speed: 1.35 } } } },
    {
      type: 'explore',
      prompt: 'Walk up to Mad Dog.',
      stage: { shot: 'dk_follow', actors: { rookie: { pose: 'idle' } } },
      hotspots: [
        {
          id: 'crew', action: 'Size up his crew',
          label: 'The crew',
          icon: 'eye',
          pos: [-3.6, -4.8],
          stand: [-1.0, 1.6],
          face: 'biker1',
          lines: [{ speaker: 'rookie', text: "Half of them I don't know. The other half used to be somebody's kid." }],
        },
        { id: 'maddog', action: 'Walk up to Mad Dog', label: 'Mad Dog', icon: 'walk', pos: [-2.6, -8.0], stand: APPROACH, face: 'maddog', ends: true },
      ],
    },
    {
      type: 'line',
      speaker: 'maddog',
      text: 'Look what we have here. Another hero?',
      stage: {
        shot: 'dk_md_notice',
        actors: {
          maddog: { look: 'rookie', expr: 'smirk' },
          rookie: { face: 'maddog', look: 'maddog', pose: 'idle', expr: 'stern' },
          biker1: { face: 'rookie', look: 'rookie', pose: 'idle' },
          biker2: { look: 'rookie' },
          biker3: { face: 'rookie' },
        },
      },
    },
    { type: 'line', speaker: 'rookie', text: 'You call this your city?', stage: { shot: 'dk_rookie_ots' } },
    {
      type: 'line',
      speaker: 'maddog',
      text: "I don't call it mine. It IS mine.",
      stage: {
        shot: 'dk_md_low',
        actors: { maddog: { pos: [-1.0, -6.3], pose: 'idle', face: 'rookie', speed: 1.0, expr: 'angry', prop: null } },
      },
    },
    {
      type: 'hold', text: 'His men drift off their bikes and close a circle around you.',
      duration: 4.0,
      stage: {
        shot: 'dk_surround',
        actors: { ...bikersAt(RING_APPROACH, { pose: 'idleTense', speed: 1.6, look: 'rookie' }), rookie: { expr: 'stern' } },
      },
    },
    { type: 'objective', complete: ['obj_docks'], activate: ['obj_confront'] },
    { type: 'reward', effects: { xp: 20 }, reason: 'Found Mad Dog' },
  ],
  next: 's04_confrontation',
}

const s04: SceneDef = {
  id: 's04_confrontation',
  index: 4,
  title: 'The Confrontation',
  subtitle: 'Pier 9 · Moments later',
  environment: 'dockyard',
  preload: [`${VIDEO}/s05_recognition.mp4`],
  stage: {
    shot: 'dk_faceoff',
    actors: {
      rookie: { pos: APPROACH, face: PI, pose: 'idleTense', expr: 'stern', look: 'maddog' },
      maddog: { pos: [-1.0, -6.3], face: 'rookie', pose: 'idle', expr: 'angry', look: 'rookie' },
      ...bikersAt(RING_APPROACH, { pose: 'idleTense', look: 'rookie' }),
    },
  },
  beats: [
    { type: 'hold', text: 'Mad Dog steps in close enough for you to smell the whiskey.', duration: 2.0, stage: { shot: 'dk_faceoff', actors: { maddog: { pos: [0.4, -4.25], speed: 1.3 } } } },
    {
      type: 'hold', text: 'He shoves you hard. You stumble back into the rain.',
      duration: 1.5,
      stage: {
        shot: 'dk_push',
        fx: ['shake'],
        fxDelay: 0.22,
        actors: {
          maddog: { action: 'push' },
          rookie: { pos: [0.4, -2.2], move: 'slide', speed: 2.8, action: 'stumble', delay: 0.22, expr: 'angry' },
        },
      },
    },
    {
      type: 'qte', text: 'Mad Dog grins, waiting for you to fold.',
      label: 'RETALIATE',
      hint: 'TAP',
      window: 3.2,
      stage: { shot: 'dk_rookie_close', actors: { rookie: { pose: 'guard', look: 'maddog' } } },
    },
    {
      type: 'hold', text: 'Your fist connects. Mad Dog staggers back, stunned.',
      duration: 1.6,
      stage: {
        shot: 'dk_punch',
        fx: ['impact'],
        fxDelay: 0.2,
        actors: {
          rookie: { action: 'punch', pos: [0.4, -3.1], move: 'slide', speed: 3.5 },
          maddog: { action: 'hitReact', pos: [0.4, -6.6], move: 'slide', speed: 3.4, delay: 0.2, expr: 'pained' },
        },
      },
    },
    {
      type: 'hold', text: 'He wipes the blood from his lip... and laughs.',
      duration: 1.5,
      stage: { shot: 'dk_second', actors: { maddog: { pose: 'guard', expr: 'angry', action: 'laugh' } } },
    },
    {
      type: 'hold', text: 'Then he charges, swinging wild.',
      duration: 0.9,
      stage: { shot: 'dk_charge', actors: { maddog: { pos: [0.4, -4.1], move: 'run', speed: 4.6, action: 'haymaker', delay: 0.15 } } },
    },
    { type: 'qte', text: 'A haymaker, coming in fast.', label: 'COUNTER', hint: 'TAP', window: 2.8, stage: { shot: 'dk_rookie_close2' } },
    {
      type: 'hold', text: 'You slip the punch and drive him back. Steel rings as he hits the container.',
      duration: 1.9,
      stage: {
        shot: 'dk_wall_side',
        fx: ['clang', 'impact'],
        fxDelay: 1.15,
        actors: {
          rookie: { action: 'shove', pos: [0.4, -4.5], move: 'slide', speed: 3 },
          maddog: { pos: PIN_MADDOG, move: 'slide', speed: 6.2, pose: 'slammed', delay: 0.16, expr: 'pained', face: 0 },
        },
      },
    },
    {
      type: 'hold', text: 'You grab his vest and pin him to the wall.',
      duration: 1.7,
      stage: {
        shot: 'dk_grab',
        actors: {
          rookie: { pos: PIN_ROOKIE, move: 'run', speed: 3.4, pose: 'grabHold', face: PI, look: 'maddog' },
          ...bikersAt(RING_WALL, { pose: 'idleTense', speed: 2.2, move: 'run', look: 'maddog' }),
        },
      },
    },
    {
      type: 'line',
      speaker: 'maddog',
      text: "That all you got, rookie? This city's mine now!",
      stage: {
        shot: 'dk_pin_close',
        fx: ['shake'],
        actors: {
          maddog: { pose: 'pinned', action: 'struggle', expr: 'angry', look: 'rookie' },
          rookie: { expr: 'angry' },
        },
      },
    },
    { type: 'objective', complete: ['obj_confront'], activate: ['obj_answer'] },
    { type: 'reward', effects: { xp: 50, reputation: { fear: 5 } }, reason: 'Put Mad Dog against the wall' },
  ],
  next: 's05_recognition',
}

const s05: SceneDef = {
  id: 's05_recognition',
  index: 5,
  title: 'The Recognition',
  subtitle: 'Pier 9 · Against the wall',
  environment: 'dockyard',
  stage: {
    shot: 'dk_pin_close',
    actors: {
      rookie: { pos: PIN_ROOKIE, face: PI, pose: 'grabHold', expr: 'angry', look: 'maddog' },
      maddog: { pos: PIN_MADDOG, face: 0, pose: 'pinned', expr: 'angry', look: 'rookie' },
      ...bikersAt(RING_WALL, { pose: 'idleTense', look: 'maddog' }),
    },
  },
  beats: [
    { type: 'hold', text: 'He strains against your grip. Then, suddenly, he stops.', duration: 1.5, stage: { shot: 'dk_md_extreme', actors: { maddog: { action: 'struggle', expr: 'angry' } } } },
    { type: 'line', speaker: 'maddog', text: 'Wait...', stage: { actors: { maddog: { expr: 'surprised' } } } },
    { type: 'line', speaker: 'rookie', text: 'What?', stage: { shot: 'dk_rookie_pin_close' } },
    { type: 'line', speaker: 'maddog', text: "You're...?", stage: { shot: 'dk_md_extreme2', fx: ['heartbeat'] } },
    { type: 'video', text: "Something changes in Mad Dog's eyes.", src: `${VIDEO}/s05_recognition.mp4`, poster: `${VIDEO}/s05_recognition.jpg` },
    {
      type: 'line',
      speaker: 'maddog',
      text: 'Everybody, back off.',
      stage: { shot: 'dk_from_bikers', cut: true, actors: { maddog: { look: 'biker3', expr: 'stern' } } },
    },
    {
      type: 'line',
      speaker: 'biker',
      text: 'Boss?',
      stage: { shot: 'dk_biker_close', actors: { biker3: { expr: 'surprised', look: 'maddog', action: 'flinch' } } },
    },
    {
      type: 'line',
      speaker: 'maddog',
      text: 'I said BACK OFF!',
      stage: {
        shot: 'dk_from_bikers2',
        fx: ['shake'],
        actors: {
          maddog: { expr: 'angry', look: 'biker3' },
          ...bikersAt(RING_BACKOFF, { pose: 'idle', look: 'maddog', speed: 1.4, action: 'stepBack', expr: 'surprised' }),
        },
      },
    },
    {
      type: 'hold', text: 'His men back away. You let go of his vest.',
      duration: 1.8,
      stage: {
        shot: 'dk_two_shot',
        actors: {
          rookie: { pos: [0.4, -8.9], move: 'slide', speed: 0.8, pose: 'idleTense', action: 'release', look: 'maddog' },
          maddog: { pose: 'idle', look: 'rookie', expr: 'stern' },
        },
      },
    },
    {
      type: 'line',
      speaker: 'maddog',
      text: 'I thought you were never coming back.',
      stage: { shot: 'dk_md_close_soft', actors: { maddog: { expr: 'neutral' } } },
    },
    { type: 'hold', text: 'For a long moment, only the rain speaks.', duration: 2.8, stage: { shot: 'dk_pause', fx: ['heartbeat'], actors: { rookie: { expr: 'stern' } } } },
    {
      type: 'choice',
      id: 'c1_answer',
      prompt: 'How do you answer him?',
      stage: { shot: 'dk_choice' },
      options: [
        {
          id: 'remember',
          text: 'You remember me?',
          tag: 'Respect',
          effects: { reputation: { respect: 10 }, relationships: { maddog: 15 } },
        },
        {
          id: 'getout',
          text: 'Get your men out of my city.',
          tag: 'Fear',
          effects: { reputation: { fear: 15 }, relationships: { maddog: -10 } },
        },
        {
          id: 'takeback',
          text: "I'm taking everything back.",
          tag: 'Ambition',
          effects: { reputation: { ambition: 15 }, relationships: { maddog: -5 } },
        },
      ],
    },
    {
      type: 'branch',
      choice: 'c1_answer',
      cases: {
        remember: [
          { type: 'line', speaker: 'rookie', text: 'You remember me?', stage: { shot: 'dk_rookie_soft' } },
          {
            type: 'line',
            speaker: 'maddog',
            text: 'Remember you? Kid... half this city still says your name like a prayer.',
            stage: { shot: 'dk_md_close_soft', actors: { maddog: { action: 'laugh', expr: 'smirk' } } },
          },
          { type: 'line', speaker: 'maddog', text: 'The other half says it like a curse.', stage: { actors: { maddog: { expr: 'stern' } } } },
          { type: 'line', speaker: 'rookie', text: 'And which half are you?', stage: { shot: 'dk_rookie_soft' } },
          {
            type: 'line',
            speaker: 'maddog',
            text: 'Come find me tomorrow. Alone. There are things you need to hear.',
            stage: { shot: 'dk_two_shot', actors: { maddog: { pos: [1.6, -8.4], face: 'rookie', speed: 0.9 } } },
          },
        ],
        getout: [
          { type: 'line', speaker: 'rookie', text: 'Get your men out of my city.', stage: { shot: 'dk_rookie_soft', actors: { rookie: { expr: 'angry' } } } },
          {
            type: 'line',
            speaker: 'maddog',
            text: 'Your city?',
            stage: { shot: 'dk_md_close_soft', actors: { maddog: { action: 'laugh', expr: 'smirk' } } },
          },
          {
            type: 'line',
            speaker: 'maddog',
            text: "You've been gone a long time, rookie. Everything here has an owner now.",
            stage: { actors: { maddog: { expr: 'stern' } } },
          },
          { type: 'line', speaker: 'rookie', text: 'Then the owners are about to change.', stage: { shot: 'dk_rookie_soft' } },
          {
            type: 'line',
            speaker: 'maddog',
            text: 'Careful. Around here, debts get paid in blood.',
            stage: { shot: 'dk_md_close_soft', actors: { maddog: { expr: 'angry' } } },
          },
        ],
        takeback: [
          { type: 'line', speaker: 'rookie', text: "I'm taking everything back.", stage: { shot: 'dk_rookie_soft', actors: { rookie: { expr: 'stern' } } } },
          {
            type: 'line',
            speaker: 'maddog',
            text: "Everything? You don't even know what 'everything' is anymore.",
            stage: { shot: 'dk_md_close_soft', actors: { maddog: { expr: 'smirk', action: 'laugh' } } },
          },
          { type: 'line', speaker: 'rookie', text: "Then I'll learn fast.", stage: { shot: 'dk_rookie_soft' } },
          { type: 'line', speaker: 'maddog', text: '...You always did.', stage: { shot: 'dk_md_close_soft', actors: { maddog: { expr: 'neutral' } } } },
          {
            type: 'line',
            speaker: 'biker',
            text: "Boss, we're just letting him walk?",
            stage: { shot: 'dk_biker_close', actors: { biker3: { expr: 'angry' } } },
          },
          { type: 'line', speaker: 'maddog', text: "Let him walk. Let's see how far he gets.", stage: { shot: 'dk_two_shot', actors: { maddog: { expr: 'smirk' } } } },
        ],
      },
    },
    { type: 'objective', complete: ['obj_answer'] },
    { type: 'reward', effects: { xp: 80, cash: 500 }, reason: 'Chapter 1 complete' },
    { type: 'end' },
  ],
}

export const CHAPTER_1: ChapterDef = {
  id: 'ch1',
  number: 1,
  title: 'HOMECOMING',
  scenes: [s01, s02, s03, s04, s05],
  objectives: [
    { id: 'obj_return', text: 'Return to Port Argent', scene: 's01_return' },
    { id: 'obj_street', text: 'Walk the old neighbourhood', scene: 's02_street' },
    { id: 'obj_talk', text: 'Talk to the old shopkeeper', scene: 's02_street' },
    { id: 'obj_docks', text: 'Find Mad Dog at the docks', scene: 's03_docks' },
    { id: 'obj_confront', text: 'Confront Mad Dog', scene: 's04_confrontation' },
    { id: 'obj_answer', text: 'Answer Mad Dog', scene: 's05_recognition' },
  ],
}
