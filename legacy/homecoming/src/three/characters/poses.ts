import type { ActionName, Expression, PoseName } from '../../narrative/types'

// Procedural rig conventions: a character faces +Z, its left is +X.
//  arms hang along -Y: x<0 swings forward, left z>0 / right z<0 abducts outward
//  forearm x<0 bends the elbow; thigh x<0 lifts the leg forward; shin x>0 bends the knee
//  spine/chest x>0 leans forward; chest y>0 twists toward the character's left
//  head x>0 looks down

export const JOINTS = [
  'hips', 'spine', 'chest', 'neck', 'head',
  'lUpperArm', 'lForeArm', 'rUpperArm', 'rForeArm',
  'lThigh', 'lShin', 'rThigh', 'rShin',
] as const
export type Joint = (typeof JOINTS)[number]
export type V3 = [number, number, number]
/** h = hips height offset (m), hz = hips forward offset (m) */
export type Pose = Partial<Record<Joint, V3>> & { h?: number; hz?: number }

const sym = (l: V3): [V3, V3] => [l, [l[0], -l[1], -l[2]]]
const arms = (ua: V3, fa: V3): Pose => {
  const [lu, ru] = sym(ua)
  const [lf, rf] = sym(fa)
  return { lUpperArm: lu, rUpperArm: ru, lForeArm: lf, rForeArm: rf }
}
const legs = (th: V3, sh: V3): Pose => {
  const [lt, rt] = sym(th)
  return { lThigh: lt, rThigh: rt, lShin: sh, rShin: sh }
}

export const POSES: Record<PoseName, Pose> = {
  idle: { ...arms([0, 0, 0.1], [-0.15, 0, 0]), spine: [0.02, 0, 0] },
  idleTense: { ...arms([0.04, 0, 0.17], [-0.4, 0, 0]), chest: [0.05, 0, 0], head: [-0.04, 0, 0], ...legs([-0.05, 0, 0.05], [0.08, 0, 0]) },
  handsPocket: { ...arms([0.14, 0, 0.13], [-0.55, 0, 0]), spine: [0.03, 0, 0] },
  armsCrossed: { ...arms([-0.32, -1.0, 0.14], [-1.75, 0, 0]), chest: [-0.03, 0, 0], ...legs([0, 0, 0.06], [0, 0, 0]) },
  guard: {
    lUpperArm: [-0.75, -0.5, 0.3], lForeArm: [-2.0, 0, 0],
    rUpperArm: [-0.55, 0.6, -0.35], rForeArm: [-2.1, 0, 0],
    chest: [0.05, 0.25, 0], spine: [0.08, 0, 0], head: [-0.1, -0.2, 0],
    lThigh: [-0.25, 0, 0.06], rThigh: [0.2, 0, -0.06], lShin: [0.3, 0, 0], rShin: [0.25, 0, 0], h: -0.04,
  },
  sitBike: {
    h: -0.24, hz: -0.05, spine: [0.04, 0, 0], chest: [-0.04, 0.1, 0],
    lUpperArm: [-0.45, 0, 0.12], lForeArm: [-0.9, 0, 0],
    rUpperArm: [-0.95, 0, -0.14], rForeArm: [-0.45, 0, 0],
    lThigh: [-1.45, 0, 0.25], rThigh: [-1.45, 0, -0.25], lShin: [1.3, 0, 0], rShin: [1.3, 0, 0],
  },
  ride: {
    h: -0.24, hz: -0.05, spine: [0.22, 0, 0], chest: [0.08, 0, 0], head: [-0.2, 0, 0],
    ...arms([-1.05, 0, 0.16], [-0.35, 0, 0]),
    lThigh: [-1.45, 0, 0.22], rThigh: [-1.45, 0, -0.22], lShin: [1.2, 0, 0], rShin: [1.2, 0, 0],
  },
  lean: {
    h: -0.02, spine: [-0.05, 0, -0.06], chest: [0, 0.2, 0], head: [0, 0.25, 0],
    lUpperArm: [-0.3, -1.0, 0.15], lForeArm: [-1.6, 0, 0], rUpperArm: [0.1, 0, -0.15], rForeArm: [-0.3, 0, 0],
    lThigh: [0, 0, 0.12], rThigh: [-0.12, 0, -0.02], lShin: [0.05, 0, 0], rShin: [0.18, 0, 0],
  },
  point: {
    rUpperArm: [-1.45, 0.1, -0.1], rForeArm: [-0.15, 0, 0], lUpperArm: [0.1, 0, 0.15], lForeArm: [-0.4, 0, 0],
    spine: [0.18, 0, 0], chest: [0.05, -0.15, 0], head: [-0.12, 0.1, 0], ...legs([-0.1, 0, 0.05], [0.12, 0, 0]),
  },
  collect: {
    rUpperArm: [-0.8, 0.2, -0.1], rForeArm: [-0.9, 0, 0], lUpperArm: [0, 0, 0.12], lForeArm: [-0.2, 0, 0],
    spine: [0.06, 0, 0], head: [0.12, 0, 0],
  },
  cower: {
    spine: [0.28, 0, 0], chest: [0.12, 0, 0], head: [0.15, 0, 0],
    ...arms([-0.5, -0.6, 0.1], [-1.9, 0, 0]), ...legs([-0.2, 0, 0.05], [0.35, 0, 0]), h: -0.05,
  },
  grabHold: {
    ...arms([-1.22, -0.12, 0.06], [-0.8, 0, 0]), spine: [0.14, 0, 0], chest: [0.06, 0, 0], head: [0.06, 0, 0],
    lThigh: [-0.38, 0, 0.05], lShin: [0.32, 0, 0], rThigh: [0.28, 0, -0.04], rShin: [0.22, 0, 0], h: -0.04,
  },
  pinned: {
    spine: [-0.12, 0, 0], chest: [-0.05, 0, 0], head: [-0.1, 0, 0],
    ...arms([-0.95, -0.25, 0.32], [-1.25, 0, 0]), ...legs([-0.18, 0, 0.08], [0.24, 0, 0]), h: -0.05,
  },
  slammed: {
    spine: [-0.22, 0, 0], chest: [-0.06, 0, 0], head: [-0.28, 0.2, 0],
    ...arms([0.1, 0, 0.55], [-0.3, 0, 0]), ...legs([-0.2, 0, 0.1], [0.3, 0, 0]), h: -0.07,
  },
  lookUp: { ...arms([0.14, 0, 0.13], [-0.55, 0, 0]), head: [-0.2, 0, 0], neck: [-0.06, 0, 0], chest: [-0.04, 0, 0] },
  shrug: { ...arms([0, 0.7, 0.28], [-1.3, 0, 0]), head: [0, 0, 0.12], chest: [-0.03, 0, 0] },
  warmHands: { ...arms([-0.9, -0.4, 0.1], [-1.1, 0, 0]), spine: [0.12, 0, 0], head: [0.15, 0, 0] },
  raiseHand: { rUpperArm: [-2.5, 0, -0.2], rForeArm: [-0.4, 0, 0], lUpperArm: [0, 0, 0.1], lForeArm: [-0.2, 0, 0] },
}

/** Arm swing while walking, per pose (hands in pockets barely swing). */
export const ARM_SWING: Partial<Record<PoseName, number>> = { handsPocket: 0.15, armsCrossed: 0, grabHold: 0, guard: 0.2 }

export interface ActionKey { at: number; pose: Pose; k: number }
export interface ActionDef { duration: number; keys: ActionKey[] }

const BASE: Pose = {}

export const ACTIONS: Record<ActionName, ActionDef> = {
  push: {
    duration: 0.85,
    keys: [
      { at: 0, k: 14, pose: { ...arms([-0.6, 0, 0.15], [-1.6, 0, 0]), spine: [-0.06, 0, 0] } },
      { at: 0.16, k: 34, pose: { ...arms([-1.45, 0, 0.05], [-0.1, 0, 0]), spine: [0.22, 0, 0], lThigh: [-0.4, 0, 0.05], lShin: [0.3, 0, 0] } },
      { at: 0.5, k: 7, pose: BASE },
    ],
  },
  stumble: {
    duration: 0.95,
    keys: [
      { at: 0, k: 24, pose: { spine: [-0.35, 0, 0], chest: [-0.1, 0, 0], head: [-0.3, 0, 0], ...arms([-0.6, 0, 0.7], [-0.4, 0, 0]), lThigh: [-0.5, 0, 0.05], rThigh: [0.3, 0, -0.05], lShin: [0.4, 0, 0] } },
      { at: 0.5, k: 6, pose: BASE },
    ],
  },
  punch: {
    duration: 0.8,
    keys: [
      { at: 0, k: 18, pose: { chest: [0, 0.4, 0], rUpperArm: [-0.6, 0.5, -0.35], rForeArm: [-2.2, 0, 0], lUpperArm: [-0.75, -0.5, 0.3], lForeArm: [-2.0, 0, 0] } },
      {
        at: 0.12, k: 42,
        pose: {
          chest: [0.05, -0.6, 0], spine: [0.14, 0, 0], rUpperArm: [-1.55, 0.1, -0.08], rForeArm: [-0.05, 0, 0],
          lUpperArm: [-0.75, -0.5, 0.3], lForeArm: [-2.1, 0, 0], lThigh: [-0.45, 0, 0.05], lShin: [0.35, 0, 0], rThigh: [0.3, 0, 0],
        },
      },
      { at: 0.42, k: 9, pose: BASE },
    ],
  },
  hitReact: {
    duration: 1.0,
    keys: [
      { at: 0, k: 30, pose: { head: [-0.55, 0.55, 0.1], neck: [-0.2, 0.2, 0], spine: [-0.32, 0, 0], chest: [-0.1, 0.4, 0], lUpperArm: [-0.3, 0, 0.8], rUpperArm: [-0.3, 0, -0.6], lThigh: [-0.5, 0, 0], rThigh: [0.2, 0, 0] } },
      { at: 0.5, k: 7, pose: { head: [-0.2, 0.2, 0], spine: [-0.1, 0, 0] } },
    ],
  },
  laugh: {
    duration: 1.3,
    keys: [
      { at: 0, k: 9, pose: { head: [-0.25, 0.25, 0], rUpperArm: [-1.25, 0.9, -0.2], rForeArm: [-2.35, 0, 0] } },
      { at: 0.55, k: 9, pose: { head: [0.12, -0.1, 0], chest: [0.06, 0, 0] } },
      { at: 0.95, k: 8, pose: BASE },
    ],
  },
  haymaker: {
    duration: 1.0,
    keys: [
      { at: 0, k: 18, pose: { rUpperArm: [-0.3, 0, -1.3], rForeArm: [-1.2, 0, 0], chest: [0, 0.6, 0] } },
      { at: 0.35, k: 30, pose: { rUpperArm: [-1.5, -0.6, -0.6], rForeArm: [-0.5, 0, 0], chest: [0.1, -0.55, 0], spine: [0.2, 0, 0] } },
      { at: 0.7, k: 8, pose: BASE },
    ],
  },
  duck: {
    duration: 0.6,
    keys: [
      { at: 0, k: 25, pose: { spine: [0.4, 0, 0], head: [0.2, 0, 0], h: -0.18, lThigh: [-0.6, 0, 0.05], rThigh: [-0.2, 0, -0.05], lShin: [0.9, 0, 0], rShin: [0.7, 0, 0] } },
      { at: 0.4, k: 8, pose: BASE },
    ],
  },
  shove: {
    duration: 0.95,
    keys: [
      { at: 0, k: 28, pose: { spine: [0.4, 0, 0], head: [0.15, 0, 0], h: -0.16, ...arms([-0.5, 0, 0.2], [-1.9, 0, 0]), lThigh: [-0.6, 0, 0.05], lShin: [0.9, 0, 0], rShin: [0.6, 0, 0] } },
      { at: 0.15, k: 42, pose: { ...arms([-1.5, 0, 0.05], [-0.05, 0, 0]), spine: [0.26, 0, 0], lThigh: [-0.6, 0, 0.05], lShin: [0.4, 0, 0], rThigh: [0.35, 0, 0] } },
      { at: 0.6, k: 8, pose: BASE },
    ],
  },
  struggle: {
    duration: 1.1,
    keys: [
      { at: 0, k: 14, pose: { chest: [0, 0.25, 0], head: [-0.1, 0.25, 0], lUpperArm: [-1.1, -0.2, 0.45] } },
      { at: 0.28, k: 14, pose: { chest: [0, -0.25, 0], head: [-0.1, -0.25, 0], rUpperArm: [-1.1, 0.2, -0.45] } },
      { at: 0.56, k: 14, pose: { chest: [0, 0.2, 0], head: [-0.1, 0.2, 0] } },
      { at: 0.8, k: 8, pose: BASE },
    ],
  },
  flinch: {
    duration: 0.6,
    keys: [
      { at: 0, k: 24, pose: { spine: [-0.15, 0, 0], head: [-0.15, 0, 0], ...arms([-0.4, 0, 0.3], [-0.8, 0, 0]) } },
      { at: 0.3, k: 8, pose: BASE },
    ],
  },
  release: {
    duration: 0.9,
    keys: [{ at: 0, k: 7, pose: { ...arms([-0.4, 0, 0.2], [-0.6, 0, 0]), spine: [-0.05, 0, 0] } }],
  },
  nod: {
    duration: 0.55,
    keys: [
      { at: 0, k: 16, pose: { head: [0.28, 0, 0] } },
      { at: 0.25, k: 12, pose: { head: [-0.05, 0, 0] } },
    ],
  },
  stepBack: {
    duration: 0.9,
    keys: [{ at: 0, k: 10, pose: { spine: [-0.12, 0, 0], ...arms([-0.25, 0, 0.3], [-0.7, 0, 0]) } }],
  },
}

export interface Face { browZ: number; browY: number; mouthY: number; mouthX: number; mouthZ: number }
export const EXPRESSIONS: Record<Expression, Face> = {
  neutral: { browZ: 0, browY: 0, mouthY: 1, mouthX: 1, mouthZ: 0 },
  stern: { browZ: 0.16, browY: -0.003, mouthY: 0.8, mouthX: 1, mouthZ: 0 },
  angry: { browZ: 0.38, browY: -0.006, mouthY: 1.2, mouthX: 0.95, mouthZ: 0 },
  surprised: { browZ: -0.18, browY: 0.01, mouthY: 2.1, mouthX: 0.7, mouthZ: 0 },
  smirk: { browZ: 0.1, browY: 0.003, mouthY: 1, mouthX: 1.1, mouthZ: 0.18 },
  pained: { browZ: -0.25, browY: 0.004, mouthY: 1.6, mouthX: 1.1, mouthZ: 0 },
}
