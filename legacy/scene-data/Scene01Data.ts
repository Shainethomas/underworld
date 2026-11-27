import type { Beat, SceneData, StageDirective, TimelineEvent } from '../../src/game/narrative/types.ts'

// CHAPTER 1 — THE FIRST EXPERIMENT
// Scene 1: The Unexpected Call.
//
// Evening. Rookie turns up late at the gym, works the heavy bag, and Ravi
// talks him into a match with Marco, who has been asking for a fight. Marco
// is stronger and lands first; Rookie adapts and puts him down. Up on the
// viewing deck the Don has watched all of it with two of his men, and says
// nothing. Rookie goes home to his apartment, sits down, and his phone rings:
// Ravi, with something that can't wait until tomorrow.
//
// The player picks Rookie's answer to Ravi's challenge. The match is a
// choreographed cutscene. Marks and named shots refer to the environment
// files (babylon/environments/GymExterior.ts, TrainingFacility.ts,
// RookieQuarters.ts). The camera holds steady named shots; the only insert
// is the phone's screen.

const TAG = 'Training Match'

type Fighter = 'rookie' | 'marco'

/** A punch that lands: the thrower's gesture, then the impact and the reaction a beat later. */
const land = (at: number, by: Fighter, punch: 'jab' | 'cross' | 'hook', on: Fighter, reaction: 'hit_head' | 'hit_chest' | 'knocked_down', big = false): TimelineEvent[] => {
  const impact = at + (punch === 'hook' ? 0.3 : 0.17)
  return [
    { at, stage: { [by]: { play: punch } } },
    { at: impact, sfx: big ? 'punch_big' : punch === 'cross' ? 'punch_2' : 'punch_1', shake: big ? 0.08 : 0.035, stage: { [on]: { play: reaction } } },
  ]
}

/** Rookie on the heavy bag: jab, cross, jab, each landing on the bag a moment after it is thrown. */
const combo = (at: number): TimelineEvent[] =>
  ([['jab', 0], ['cross', 0.5], ['jab', 1.15]] as const).flatMap(([punch, t]) => [
    { at: at + t, stage: { rookie: { play: punch } } },
    { at: at + t + 0.17, env: 'bagHit1', sfx: punch === 'cross' ? 'punch_2' : 'punch_1' },
  ])

/** The Don keeps his eyes on Rookie (a look holds a point, so it is renewed as Rookie moves). */
const donFollows = (...times: number[]): TimelineEvent[] => times.map((at) => ({ at, stage: { don: { look: 'rookie' } } }))

/** The gym in full swing as Rookie walks in. */
const GYM: StageDirective = {
  ravi: { at: 'ravi', face: 'entry', pose: 'arms_crossed' },
  // up on the deck from the start, though nobody points him out
  don: { at: 'don_rail', face: 'ring_centre', pose: 'arms_crossed' },
  guard1: { at: 'guard_side_l', face: 'ring_centre', pose: 'arms_crossed' },
  guard2: { at: 'guard_side_r', face: 'ring_centre', pose: 'arms_crossed' },
  trainee1: { at: 'bag4_trainee', face: 'bag4', routine: ['jab', 'cross', 'jab', 'hook'] },
  trainee2: { at: 'bag3_trainee', face: 'bag3', routine: ['jab', 'jab', 'cross'] },
  // two of the regulars sparring in the ring
  fighter1: { at: 'f1_fight', face: 'f2_fight', routine: ['jab', 'cross', 'jab'] },
  fighter2: { at: 'f2_fight', face: 'f1_fight', routine: ['jab', 'hook', 'jab'] },
  // Marco shadowboxing on the open floor
  marco: { at: 'marco_warm', face: 'bag1_rookie', routine: ['jab', 'cross', 'jab', 'hook'] },
}

const beats: Beat[] = [
  // ── 1 Arriving late ─────────────────────────────────────────────────────
  {
    id: 'b1_title',
    type: 'title',
    env: 'gym_ext',
    cinematic: true,
    chapter: 'Chapter 1 — The First Experiment',
    scene: 'Scene 01',
    title: 'The Unexpected Call',
    shot: { cam: 'ext_establish' },
    cue: { music: 'theme', ambience: 'street' },
    stage: {
      rookie: { at: 'street', face: 'approach', pose: 'idle', carry: 'bag' },
      sentry: { at: 'guard_door_r', face: 'approach', pose: 'arms_crossed' },
      guard2: { at: 'guard_door_l', face: 'approach', pose: 'arms_crossed' },
      trainee1: { at: 'win_l_fighter', face: 'win_l_bag', routine: ['jab', 'cross', 'jab', 'hook'] },
      fighter1: { at: 'win_l2_fighter', face: 'win_l2_bag', routine: ['jab', 'jab', 'cross'] },
      trainee2: { at: 'win_r_fighter', face: 'win_r_bag', routine: ['cross', 'jab', 'hook'] },
    },
  },
  {
    id: 'b1_enter',
    type: 'shot',
    cinematic: true,
    hold: 6.0,
    shot: { cam: 'ext_door' },
    stage: { rookie: { at: 'street', walk: ['approach', 'doorway', 'lobby'] } },
    cue: {
      timeline: [
        { at: 0.3, sfx: 'footsteps' },
        { at: 1.6, stage: { sentry: { face: 'rookie', play: 'nod' } } },
        { at: 2.2, env: 'doorsOpen', sfx: 'door_open' },
      ],
    },
  },
  {
    id: 'b2_enter',
    type: 'shot',
    env: 'gym',
    cinematic: true,
    hold: 5.4,
    shot: { cam: 'entry_wide' },
    caption: { label: 'Downtown Gym', text: 'Evening. The session started forty minutes ago.' },
    stage: { ...GYM, rookie: { at: 'door_in', face: 'entry', pose: 'idle', carry: 'bag' } },
    cue: {
      ambience: 'gym',
      env: ['bagWork'],
      timeline: [
        { at: 0.1, env: 'doorsOpen', sfx: 'door_open' },
        { at: 0.4, stage: { rookie: { walk: ['entry', 'rookie_ravi'], face: 'ravi' } } },
        // Ravi sees him coming
        { at: 2.4, stage: { ravi: { look: 'rookie' } } },
        { at: 3.4, stage: { ravi: { face: 'rookie', look: null } } },
        { at: 3.6, env: 'doorsClose', sfx: 'door_close' },
      ],
    },
  },
  {
    id: 'b2_l1',
    type: 'line',
    speaker: 'ravi',
    text: "Look who's finally here. Thought you'd skipped training today.",
    stage: { ravi: { face: 'rookie', pose: 'arms_crossed' }, rookie: { at: 'rookie_ravi', face: 'ravi', pose: 'idle' } },
    shot: { cam: 'talk_ravi' },
  },
  { id: 'b2_l2', type: 'line', speaker: 'rookie', text: 'Had a few things to take care of.', shot: { cam: 'talk_ravi' } },
  { id: 'b2_l3', type: 'line', speaker: 'ravi', gesture: 'shake_head', text: "Whatever. Get changed. You're already late.", shot: { cam: 'talk_ravi' } },
  // his bag down by the wall, then on to the heavy bag nearest the door
  {
    id: 'b2_bag',
    type: 'shot',
    cinematic: true,
    hold: 7.4,
    shot: { cam: 'bags_wide' },
    stage: { ravi: { pose: 'arms_crossed', face: 'ring_centre' } },
    cue: {
      timeline: [
        { at: 0.1, stage: { rookie: { walk: 'kit_drop', face: 'bag1' } } },
        { at: 3.9, stage: { rookie: { carry: null } } },
        { at: 4.15, sfx: 'body_fall' },
        { at: 4.4, stage: { rookie: { walk: 'bag1_rookie', face: 'bag1', pose: 'guard' } } },
        ...combo(5.9),
      ],
    },
  },

  // ── 2 The challenge ─────────────────────────────────────────────────────
  {
    id: 'b2_ravi',
    type: 'shot',
    cinematic: true,
    hold: 3.2,
    shot: { cam: 'bag_talk' },
    stage: {
      rookie: { at: 'bag1_rookie', face: 'bag1', pose: 'guard', carry: null },
      ravi: { at: [-3.5, 1.5], walk: 'ravi_bag', face: 'rookie', pose: 'idle' },
    },
    cue: { timeline: combo(0.3) },
  },
  { id: 'b2_l4', type: 'line', speaker: 'ravi', text: "You've got some energy today.", stage: { ravi: { at: 'ravi_bag', face: 'rookie' } }, shot: { cam: 'bag_talk' }, cue: { timeline: combo(0.4) } },
  { id: 'b2_l5', type: 'line', speaker: 'rookie', text: 'Just getting started.', shot: { cam: 'bag_talk' }, cue: { timeline: combo(0.2) } },
  {
    id: 'b2_l6',
    type: 'line',
    speaker: 'ravi',
    text: "Then let's see what you've got. There's a guy here who's been asking for a fight. Pretty tough, apparently.",
    // Rookie stops and turns to him
    stage: { rookie: { face: 'ravi', pose: 'idle' } },
    shot: { cam: 'bag_talk' },
  },
  { id: 'b2_l7', type: 'line', speaker: 'rookie', text: 'And?', shot: { cam: 'bag_talk' } },
  { id: 'b2_l8', type: 'line', speaker: 'ravi', text: 'I told him I knew someone who could handle him.', shot: { cam: 'bag_talk' } },
  // Ravi nods across the floor at Marco, who stops and stares back
  {
    id: 'b2_marco',
    type: 'shot',
    cinematic: true,
    hold: 3.4,
    shot: { cam: 'marco_look' },
    stage: { ravi: { look: 'marco' }, rookie: { look: 'marco' } },
    cue: {
      timeline: [
        { at: 0.2, stage: { ravi: { play: 'nod' } } },
        { at: 0.6, stage: { marco: { pose: 'idle', face: 'rookie' } } },
        { at: 1.6, stage: { marco: { pose: 'arms_crossed' } } },
      ],
    },
  },
  {
    id: 'b2_choice',
    type: 'choice',
    choiceId: 'challenge',
    style: 'dialogue',
    shot: { cam: 'bag_talk' },
    stage: { ravi: { look: null, face: 'rookie' }, rookie: { look: null, face: 'ravi', pose: 'idle' }, marco: { at: 'marco_warm', face: 'rookie', pose: 'arms_crossed' } },
    context: { speaker: 'ravi', text: 'Come on. One match. What do you say?' },
    options: [
      { id: 'over', text: "Let's get this over with.", icon: 'fist', effects: { discipline: 5 } },
      { id: 'who', text: 'Who exactly am I fighting?', icon: 'eye' },
      { id: 'train', text: "I'm here to train, not entertain people.", icon: 'bolt', effects: { independence: 5 } },
    ],
  },
  { id: 'b2_r_over', when: { choice: 'challenge', is: 'over' }, type: 'line', speaker: 'ravi', gesture: 'nod', text: "That's what I like to hear. Ring's yours.", shot: { cam: 'bag_talk' } },
  { id: 'b2_r_who', when: { choice: 'challenge', is: 'who' }, type: 'line', speaker: 'ravi', text: "Marco. Came over from the docks last month. Nobody here has put him down yet.", shot: { cam: 'bag_talk' } },
  { id: 'b2_r_who2', when: { choice: 'challenge', is: 'who' }, type: 'line', speaker: 'rookie', text: 'Yet.', shot: { cam: 'bag_talk' } },
  { id: 'b2_r_train', when: { choice: 'challenge', is: 'train' }, type: 'line', speaker: 'ravi', gesture: 'arms_crossed', text: 'Then train on him. One match. Humour me.', shot: { cam: 'bag_talk' } },
  { id: 'b2_r_train2', when: { choice: 'challenge', is: 'train' }, type: 'line', speaker: 'rookie', text: 'One.', shot: { cam: 'bag_talk' } },

  // ── 3 The fight ─────────────────────────────────────────────────────────
  // A choreographed cutscene: Marco is stronger and lands first, Rookie
  // takes it, reads him, slips the next hook and puts him down. The gym
  // gathers round the ring; the Don watches from the deck.
  {
    id: 'b3_square',
    type: 'shot',
    cinematic: true,
    tag: TAG,
    hold: 3.6,
    shot: { cam: 'ring_wide' },
    stage: {
      rookie: { at: 'ring_rookie', face: 'm_fight', pose: 'guard', look: null },
      marco: { at: 'm_wait', face: 'rookie', pose: 'guard' },
      ravi: { at: 'ravi_watch', face: 'ring_centre', pose: 'lean_rail', look: null },
      trainee1: { at: 'rail_left', face: 'ring_centre', pose: 'lean_rail' },
      trainee2: { at: 'rail_right', face: 'ring_centre', pose: 'arms_crossed' },
      fighter1: { at: 'crowd_l', face: 'ring_centre', pose: 'lean_rail' },
      fighter2: { at: 'crowd_back', face: 'ring_centre', pose: 'arms_crossed' },
      don: { at: 'don_rail', face: 'ring_centre', pose: 'arms_crossed' },
      guard1: { at: 'guard_side_l', face: 'ring_centre', pose: 'arms_crossed' },
      guard2: { at: 'guard_side_r', face: 'ring_centre', pose: 'arms_crossed' },
    },
    cue: { music: 'tension', timeline: [{ at: 0.2, stage: { marco: { walk: 'm_fight', pace: 'formal', face: 'rookie', pose: 'guard' } } }] },
  },
  // Marco presses: the jab is blocked, the cross and the hook get through
  {
    id: 'b3_press',
    type: 'shot',
    cinematic: true,
    tag: TAG,
    hold: 4.8,
    shot: { cam: 'ring_e3' },
    stage: { marco: { at: 'm_fight', face: 'rookie', pose: 'guard' }, rookie: { face: 'marco', pose: 'guard' } },
    cue: {
      timeline: [
        { at: 0.35, stage: { marco: { play: 'jab' } } },
        { at: 0.47, sfx: 'impact_hit', shake: 0.02, stage: { rookie: { play: 'block' } } },
        ...land(1.35, 'marco', 'cross', 'rookie', 'hit_chest'),
        ...land(2.45, 'marco', 'hook', 'rookie', 'hit_head', true),
        { at: 3.9, stage: { rookie: { play: 'shake_head' } } },
      ],
    },
  },
  // he has the measure of him now: under the next hook, and back with a jab and a cross
  {
    id: 'b3_adapt',
    type: 'shot',
    cinematic: true,
    tag: TAG,
    hold: 4.0,
    shot: { cam: 'ring_e3' },
    cue: {
      timeline: [
        { at: 0.45, stage: { marco: { play: 'hook' } } },
        { at: 0.55, stage: { rookie: { play: 'duck' } } },
        { at: 0.75, sfx: 'whoosh' },
        ...land(1.6, 'rookie', 'jab', 'marco', 'hit_head'),
        ...land(2.05, 'rookie', 'cross', 'marco', 'hit_chest'),
      ],
    },
  },
  {
    id: 'b3_finish',
    type: 'shot',
    cinematic: true,
    tag: TAG,
    hold: 3.2,
    shot: { cam: 'ring_e3' },
    cue: {
      timeline: [
        { at: 0.25, stage: { rookie: { play: 'hook' } } },
        { at: 0.55, sfx: 'punch_big', shake: 0.11, flash: true, slowmo: 0.5, stage: { marco: { play: 'knocked_down' } } },
        { at: 1.75, sfx: 'body_fall' },
      ],
    },
  },
  // the gym goes up; Ravi first
  {
    id: 'b3_crowd',
    type: 'shot',
    cinematic: true,
    hold: 3.8,
    shot: { cam: 'crowd_view' },
    cue: {
      music: null,
      fade: 1.2,
      timeline: [
        { at: 0.2, stage: { ravi: { play: 'call_out' } } },
        { at: 0.45, stage: { trainee1: { play: 'call_out' }, fighter1: { play: 'call_out' } } },
        { at: 0.7, stage: { trainee2: { play: 'nod' }, fighter2: { play: 'nod' } } },
        { at: 2.4, stage: { rookie: { pose: 'idle', walk: 'ring_edge', face: 'ravi_rail' } } },
        { at: 1.5, stage: { ravi: { pose: 'idle', walk: 'ravi_rail', face: 'rookie' } } },
      ],
    },
  },
  {
    id: 'b3_l1',
    type: 'line',
    speaker: 'ravi',
    gesture: 'talk',
    text: "That's what I'm talking about!",
    stage: { rookie: { at: 'ring_edge', face: 'ravi', pose: 'idle' }, ravi: { at: 'ravi_rail', face: 'rookie', pose: 'idle' } },
    shot: { cam: 'rail_talk' },
    cue: { timeline: [{ at: 1.0, stage: { marco: { play: 'get_up', pose: 'idle' } } }] },
  },
  { id: 'b3_l2', type: 'line', speaker: 'rookie', text: "You said he was tough. Didn't look that tough.", shot: { cam: 'rail_talk' } },
  // Ravi laughs it off
  { id: 'b3_l3', type: 'line', speaker: 'ravi', gesture: 'shake_head', text: "Don't get carried away.", shot: { cam: 'rail_talk' } },

  // ── 4 Someone is watching ───────────────────────────────────────────────
  // The Don has seen all of it. No applause, no word, no sign of what he wants.
  {
    id: 'b4_deck',
    type: 'shot',
    cinematic: true,
    hold: 3.6,
    shot: { cam: 'deck_trio' },
    stage: { don: { at: 'don_rail', face: 'ring_centre', pose: 'arms_crossed' } },
    cue: { timeline: donFollows(0.3) },
  },
  // past his shoulder: Rookie climbs out of the ring and goes back to his things
  {
    id: 'b4_leave',
    type: 'shot',
    cinematic: true,
    hold: 4.4,
    shot: { cam: 'deck_down' },
    stage: { rookie: { at: 'ring_edge', pose: 'idle', walk: 'ring_exit', y: 0 } },
    cue: {
      timeline: [
        { at: 0.2, stage: { ravi: { face: 'rookie' } } },
        { at: 1.9, stage: { rookie: { walk: 'kit_drop' } } },
        ...donFollows(0.8, 2.0, 3.2),
      ],
    },
  },
  // one of his men notices where the Don is looking; the Don doesn't explain
  {
    id: 'b4_notice',
    type: 'shot',
    cinematic: true,
    hold: 4.2,
    shot: { cam: 'deck_trio' },
    stage: { rookie: { at: 'kit_drop', y: 0, face: 'bag1' } },
    cue: {
      timeline: [
        ...donFollows(0.1),
        { at: 0.7, stage: { guard1: { look: 'don' } } },
        { at: 2.9, stage: { guard1: { look: null } } },
      ],
    },
  },

  // ── 5 Going home ────────────────────────────────────────────────────────
  {
    id: 'b5_out',
    type: 'shot',
    cinematic: true,
    hold: 4.6,
    shot: { cam: 'entry_wide' },
    caption: { label: 'Downtown Gym', text: 'The session winds down.' },
    stage: {
      // he has his bag again; the deck is empty, the ring cleared
      rookie: { at: [-0.9, -5.4], y: 0, face: 'exit_rookie', pose: 'idle', carry: 'bag', look: null },
      ravi: { at: [-1.95, -4.9], face: 'exit_ravi', pose: 'idle' },
      don: { show: false, look: null },
      guard1: { show: false, look: null },
      guard2: { show: false },
      marco: { show: false },
      fighter1: { show: false },
      fighter2: { show: false },
      trainee1: { at: 'bag4_trainee', face: 'bag4', routine: ['jab', 'cross', 'jab', 'hook'] },
      trainee2: { at: 'bag3_trainee', face: 'bag3', routine: ['jab', 'jab', 'cross'] },
    },
    cue: {
      timeline: [
        { at: 0.2, stage: { rookie: { walk: 'exit_rookie', face: 'ravi' } } },
        { at: 0.5, stage: { ravi: { walk: 'exit_ravi', face: 'rookie' } } },
      ],
    },
  },
  {
    id: 'b5_l1',
    type: 'line',
    speaker: 'ravi',
    text: 'Same time tomorrow?',
    stage: { rookie: { at: 'exit_rookie', face: 'ravi', pose: 'idle' }, ravi: { at: 'exit_ravi', face: 'rookie', pose: 'idle' } },
    shot: { cam: 'door_talk' },
  },
  { id: 'b5_l2', type: 'line', speaker: 'rookie', text: "We'll see.", shot: { cam: 'door_talk' } },
  {
    id: 'b5_leave',
    type: 'shot',
    cinematic: true,
    hold: 4.0,
    shot: { cam: 'entry_wide' },
    cue: {
      timeline: [
        { at: 0.2, env: 'doorsOpen', sfx: 'door_open' },
        { at: 0.5, stage: { rookie: { walk: ['door_in', 'door_out'] } } },
        { at: 3.3, env: 'doorsClose', sfx: 'door_close' },
      ],
    },
  },

  // ── 6 Home ──────────────────────────────────────────────────────────────
  {
    id: 'b6_enter',
    type: 'shot',
    env: 'room',
    cinematic: true,
    hold: 4.8,
    shot: { cam: 'room_enter' },
    stage: { rookie: { at: 'door_in', y: 0, face: 0, pose: 'idle', carry: 'bag', look: null } },
    cue: {
      music: 'resolve',
      ambience: 'room',
      env: ['lampOff', 'doorClose'],
      timeline: [
        { at: 0.2, env: 'doorOpen', sfx: 'door_open' },
        { at: 0.5, stage: { rookie: { walk: ['inside', 'bag_stand'], face: 'sofa_sit' } } },
        { at: 0.9, env: 'roomLight', sfx: 'lamp_click' },
        { at: 1.5, env: 'lampOn' },
        { at: 2.4, env: 'doorClose', sfx: 'door_close' },
        // the bag goes down where he stands
        { at: 3.65, stage: { rookie: { carry: null } } },
        { at: 3.9, sfx: 'body_fall' },
      ],
    },
  },
  // onto the sofa, head back; the room is quiet
  {
    id: 'b6_sofa',
    type: 'shot',
    cinematic: true,
    hold: 6.0,
    shot: { cam: 'sofa_wide' },
    stage: { rookie: { at: 'bag_stand', carry: null, walk: ['sofa_way', 'sofa_sit'], face: 90, pose: 'sit' } },
    cue: {
      music: null,
      fade: 3,
      env: ['phoneTable'],
      timeline: [{ at: 2.6, stage: { rookie: { look: 'rest_look' } } }],
    },
  },

  // ── 7 The phone call ────────────────────────────────────────────────────
  {
    id: 'b7_buzz',
    type: 'shot',
    cinematic: true,
    hold: 3.0,
    shot: { cam: 'sofa_wide' },
    stage: { rookie: { at: 'sofa_sit', face: 90, pose: 'sit', look: 'rest_look' } },
    cue: {
      env: ['phoneTable'],
      timeline: [
        { at: 0.3, env: 'tablePhoneRing', sfx: 'phone_buzz' },
        { at: 1.2, stage: { rookie: { look: 'table_phone' } } },
      ],
    },
  },
  // he looks at the screen
  {
    id: 'b7_screen',
    type: 'shot',
    cinematic: true,
    hold: 2.4,
    shot: { cam: 'table_phone_close' },
    cue: { env: ['tablePhoneRing'], timeline: [{ at: 0.5, sfx: 'phone_buzz' }] },
  },
  {
    id: 'b7_call',
    type: 'call',
    caller: 'Ravi',
    detail: 'Mobile phone • Evening',
    shot: { cam: 'sofa_wide' },
    stage: { rookie: { at: 'sofa_sit', face: 90, pose: 'sit', look: 'table_phone' } },
    cue: { env: ['phoneTable', 'tablePhoneRing'] },
  },
  // he answers, on his feet
  {
    id: 'b7_l1',
    type: 'line',
    speaker: 'rookie',
    text: 'What now? We just saw each other.',
    stage: { rookie: { at: 'sofa_stand', face: 90, pose: 'phone', carry: 'phone', look: null } },
    cue: { env: ['tablePhoneAnswer'] },
    shot: { cam: 'sofa_call' },
  },
  { id: 'b7_l2', type: 'line', speaker: 'ravi', text: 'Listen. I need to talk to you about something.', shot: { cam: 'sofa_call' } },
  { id: 'b7_l3', type: 'line', speaker: 'rookie', text: "Can't it wait until tomorrow?", shot: { cam: 'sofa_call' } },
  { id: 'b7_l4', type: 'line', speaker: 'ravi', text: "No. This one's important.", shot: { cam: 'sofa_call' } },
  {
    id: 'b7_fade',
    type: 'shot',
    cinematic: true,
    hold: 3.6,
    shot: { cam: 'sofa_call' },
    cue: { music: 'tension', fade: 2, timeline: [{ at: 1.2, fx: 'blackout' }] },
  },
  { id: 'b7_complete', type: 'complete', cinematic: true },
]

const scene: SceneData = {
  id: 's01',
  index: 1,
  chapter: { number: 1, title: 'The First Experiment' },
  title: 'The Unexpected Call',
  environments: ['gym_ext', 'gym', 'room'],
  cast: ['rookie', 'ravi', 'don', 'guard1', 'guard2', 'sentry', 'marco', 'fighter1', 'fighter2', 'trainee1', 'trainee2'],
  summary: ['discipline', 'independence', 'ravi_trust'],
  next: { id: 's02', title: 'The Other Empire' },
  beats,
}

export default scene
