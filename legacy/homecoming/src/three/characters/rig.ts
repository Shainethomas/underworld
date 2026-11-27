import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { emblemTexture, glowTexture, rng, tattooSkinTexture } from '../../engine/textures'
import type { Joint } from './poses'
import type { CharacterSpec } from './specs'

// Procedural placeholder characters. Each body segment is built from simple
// primitives and merged per (bone, material), so a full character costs ~25
// draw calls. A template is built once per spec and cloned per instance
// (geometry and materials are shared).

export interface Rig {
  root: THREE.Group
  body: THREE.Group
  joints: Record<Joint, THREE.Object3D>
  browL: THREE.Object3D
  browR: THREE.Object3D
  mouth: THREE.Object3D
  props: Record<'bag' | 'bat' | 'cash', THREE.Object3D>
  hipsY: number
}

// ── materials ────────────────────────────────────────────────────────────
const mats = new Map<string, THREE.Material>()
function mat(key: string, make: () => THREE.Material) {
  let m = mats.get(key)
  if (!m) {
    m = make()
    mats.set(key, m)
  }
  return m
}
const std = (color: string, roughness: number, metalness = 0, extra: THREE.MeshStandardMaterialParameters = {}) =>
  mat(`std:${color}:${roughness}:${metalness}:${JSON.stringify(extra.side ?? '')}`, () => new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }))
const leather = (color: string) =>
  mat(`leather:${color}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.34, metalness: 0.15, envMapIntensity: 1.4, side: THREE.DoubleSide }))
const skinMat = (c: string) => mat(`skin:${c}`, () => new THREE.MeshStandardMaterial({ color: c, roughness: 0.58, metalness: 0 }))
const tattooMat = (c: string, density: number, seed: number) =>
  mat(`tat:${c}:${density}:${seed}`, () => new THREE.MeshStandardMaterial({ map: tattooSkinTexture(c, density, seed), roughness: 0.55 }))
const stubbleMat = (c: string) =>
  mat(`stubble:${c}`, () => new THREE.MeshStandardMaterial({ color: new THREE.Color(c).lerp(new THREE.Color('#2b2420'), 0.22), roughness: 0.8 }))
const metal = () => std('#b8b4ac', 0.25, 0.9)

// ── geometry helpers ─────────────────────────────────────────────────────
const G = {
  capsule: (r: number, len: number) => new THREE.CapsuleGeometry(r, len, 4, 12),
  cyl: (rt: number, rb: number, h: number, seg = 18, open = false, ts = 0, tl = Math.PI * 2) =>
    new THREE.CylinderGeometry(rt, rb, h, seg, 1, open, ts, tl),
  sph: (r: number, ws = 18, hs = 14, ps = 0, pl = Math.PI * 2, ts = 0, tl = Math.PI) => new THREE.SphereGeometry(r, ws, hs, ps, pl, ts, tl),
  box: (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d),
  cone: (r: number, h: number) => new THREE.ConeGeometry(r, h, 7),
  torus: (r: number, t: number, arc = Math.PI * 2) => new THREE.TorusGeometry(r, t, 8, 20, arc),
}

type Xf = { p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number] }

class PartBuilder {
  private parts = new Map<string, { bone: THREE.Object3D; mat: THREE.Material; geos: THREE.BufferGeometry[] }>()
  add(bone: THREE.Object3D, m: THREE.Material, geo: THREE.BufferGeometry, xf: Xf = {}) {
    const g = geo
    const mtx = new THREE.Matrix4().compose(
      new THREE.Vector3(...(xf.p ?? [0, 0, 0])),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...(xf.r ?? [0, 0, 0]))),
      new THREE.Vector3(...(xf.s ?? [1, 1, 1])),
    )
    g.applyMatrix4(mtx)
    const key = `${bone.uuid}|${m.uuid}`
    let p = this.parts.get(key)
    if (!p) {
      p = { bone, mat: m, geos: [] }
      this.parts.set(key, p)
    }
    p.geos.push(g)
  }
  finalize() {
    for (const { bone, mat: m, geos } of this.parts.values()) {
      const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false)
      geos.forEach((g) => g !== merged && g.dispose())
      const mesh = new THREE.Mesh(merged!, m)
      mesh.frustumCulled = false // skinned-ish hierarchy moves a lot; cheap to skip culling for a handful of actors
      bone.add(mesh)
    }
  }
}

const node = (name: string, parent: THREE.Object3D, p: [number, number, number]) => {
  const o = new THREE.Object3D()
  o.name = name
  o.position.set(...p)
  parent.add(o)
  return o
}

function buildTemplate(spec: CharacterSpec): THREE.Group {
  const b = spec.bulk
  const B = new PartBuilder()
  const root = new THREE.Group()
  root.name = 'root'
  const body = new THREE.Group()
  body.name = 'body'
  body.scale.setScalar(spec.height)
  root.add(body)

  const hipsY = 0.98
  const hips = node('hips', body, [0, hipsY, 0])
  const spine = node('spine', hips, [0, 0.06, 0])
  const chest = node('chest', spine, [0, 0.24, 0])
  const neck = node('neck', chest, [0, 0.27, 0])
  const head = node('head', neck, [0, 0.08, 0])
  const sx = 0.185 * b
  const lUA = node('lUpperArm', chest, [sx, 0.215, 0])
  const rUA = node('rUpperArm', chest, [-sx, 0.215, 0])
  const lFA = node('lForeArm', lUA, [0, -0.29, 0])
  const rFA = node('rForeArm', rUA, [0, -0.29, 0])
  const lHand = node('lHand', lFA, [0, -0.255, 0])
  const rHand = node('rHand', rFA, [0, -0.255, 0])
  const lTh = node('lThigh', hips, [0.095 * b, -0.04, 0])
  const rTh = node('rThigh', hips, [-0.095 * b, -0.04, 0])
  const lSh = node('lShin', lTh, [0, -0.45, 0])
  const rSh = node('rShin', rTh, [0, -0.45, 0])

  const skin = skinMat(spec.skin)
  const bare = spec.top === 'vestBare'
  const torsoMat = bare
    ? tattooMat(spec.skin, spec.tattoos, 7)
    : spec.top === 'cardigan'
      ? std(spec.topColor, 0.92)
      : spec.top === 'leatherJacket'
        ? std(spec.shirtColor, 0.85)
        : std(spec.shirtColor, 0.9)
  const sleeveMat =
    spec.top === 'leatherJacket' ? leather(spec.topColor) : spec.top === 'cardigan' ? std(spec.topColor, 0.92) : bare ? torsoMat : std(spec.shirtColor, 0.9)
  const forearmMat = bare || (spec.top === 'vestShirt' && spec.tattoos > 0) ? tattooMat(spec.skin, Math.max(1, spec.tattoos), 13) : sleeveMat
  const pants = std(spec.pants, 0.88)
  const boot = std(spec.boots, 0.55, 0.05)

  // ── pelvis / legs
  B.add(hips, pants, G.cyl(0.158 * b, 0.15 * b, 0.22), { p: [0, -0.02, 0], s: [1, 1, 0.72] })
  B.add(hips, std('#151312', 0.5), G.cyl(0.162 * b, 0.162 * b, 0.045), { p: [0, 0.075, 0], s: [1, 1, 0.74] })
  B.add(hips, metal(), G.box(0.055, 0.038, 0.012), { p: [0, 0.075, 0.162 * b * 0.74 + 0.004] })
  for (const [th, sh] of [[lTh, lSh], [rTh, rSh]] as const) {
    B.add(th, pants, G.capsule(0.074 * b, 0.3), { p: [0, -0.22, 0] })
    B.add(sh, pants, G.capsule(0.056 * b, 0.3), { p: [0, -0.2, 0] })
    // boot: shaft + foot
    B.add(sh, boot, G.cyl(0.064 * b, 0.068 * b, 0.17), { p: [0, -0.37, 0] })
    B.add(sh, boot, G.box(0.11 * b, 0.085, 0.27), { p: [0, -0.43, 0.045] })
    B.add(sh, std('#0b0a09', 0.8), G.box(0.115 * b, 0.025, 0.28), { p: [0, -0.465, 0.045] })
  }

  // ── torso
  B.add(spine, torsoMat, G.cyl(0.152 * b, 0.148 * b, 0.27), { p: [0, 0.12, 0], s: [1, 1, 0.68] })
  B.add(chest, torsoMat, G.cyl(0.19 * b, 0.152 * b, 0.28), { p: [0, 0.12, 0], s: [1, 1, 0.64] })
  if (bare) {
    // pecs + abs definition
    for (const s of [-1, 1]) B.add(chest, torsoMat, G.sph(0.08 * b), { p: [s * 0.075 * b, 0.15, 0.06 * b], s: [1.1, 0.75, 0.6] })
  }
  for (const [s, ua] of [[1, lUA], [-1, rUA]] as const) {
    B.add(chest, sleeveMat, G.sph(0.074 * b), { p: [s * 0.172 * b, 0.205, 0], s: [1, 0.85, 0.92] })
    B.add(ua, sleeveMat, G.capsule(0.054 * b, 0.21), { p: [0, -0.14, 0] })
  }
  for (const fa of [lFA, rFA]) B.add(fa, forearmMat, G.capsule(0.046 * b, 0.19), { p: [0, -0.125, 0] })
  for (const h of [lHand, rHand]) {
    B.add(h, skin, G.sph(0.045 * b, 12, 10), { p: [0, -0.045, 0.004], s: [0.95, 1.15, 0.7] })
    B.add(h, skin, G.capsule(0.014, 0.03), { p: [0, -0.03, 0.03], r: [0.5, 0, 0] })
  }
  B.add(neck, skin, G.cyl(0.05 * b, 0.058 * b, 0.13), { p: [0, 0.04, 0] })

  // outerwear
  const gapFront = (gap: number) => [gap / 2, Math.PI * 2 - gap] as const
  if (spec.top === 'leatherJacket') {
    const L = leather(spec.topColor)
    const [ts, tl] = gapFront(0.42)
    B.add(chest, L, G.cyl(0.2 * b, 0.162 * b, 0.3, 22, true, ts, tl), { p: [0, 0.12, 0], s: [1, 1, 0.7] })
    B.add(spine, L, G.cyl(0.164 * b, 0.168 * b, 0.32, 22, true, ts, tl), { p: [0, 0.1, 0], s: [1, 1, 0.74] })
    for (const s of [-1, 1]) {
      // lapels / collar
      B.add(chest, L, G.box(0.075, 0.13, 0.016), { p: [s * 0.06, 0.25, 0.115 * b], r: [-0.2, s * -0.35, s * 0.32] })
      B.add(chest, L, G.box(0.09, 0.06, 0.018), { p: [s * 0.075, 0.3, 0.02], r: [0.2, s * 0.9, 0] })
    }
    B.add(chest, metal(), G.box(0.006, 0.28, 0.006), { p: [0.035, 0.1, 0.13 * b] })
    B.add(spine, metal(), G.box(0.006, 0.3, 0.006), { p: [0.035, 0.1, 0.125 * b] })
    for (const fa of [lFA, rFA]) B.add(fa, L, G.cyl(0.054 * b, 0.05 * b, 0.05), { p: [0, -0.2, 0] })
  }
  if (spec.top === 'vestBare' || spec.top === 'vestShirt') {
    const L = leather(spec.topColor)
    const [ts, tl] = gapFront(bare ? 1.1 : 0.7)
    B.add(chest, L, G.cyl(0.198 * b, 0.162 * b, 0.3, 22, true, ts, tl), { p: [0, 0.12, 0], s: [1, 1, 0.69] })
    B.add(spine, L, G.cyl(0.162 * b, 0.165 * b, 0.28, 22, true, ts, tl), { p: [0, 0.12, 0], s: [1, 1, 0.73] })
    // studs along vest edges
    for (let i = 0; i < 6; i++) for (const s of [-1, 1]) B.add(chest, metal(), G.sph(0.007, 6, 4), { p: [s * (0.1 + i * 0.004) * b, 0.02 + i * 0.045, 0.12 * b] })
    if (spec.emblem) {
      // front name patch
      B.add(chest, std('#7a1b18', 0.8), G.box(0.06, 0.03, 0.006), { p: [0.11 * b, 0.17, 0.118 * b], r: [0, 0.5, 0] })
    }
  }
  if (spec.top === 'vestShirt') {
    // hood bunched at the back of the neck
    B.add(chest, std(spec.shirtColor, 0.9), G.torus(0.085 * b, 0.032), { p: [0, 0.27, -0.03], r: [Math.PI / 2 - 0.25, 0, 0] })
  }
  if (spec.top === 'cardigan') {
    for (let i = 0; i < 4; i++) B.add(chest, std('#2a2420', 0.5), G.sph(0.009, 6, 4), { p: [0, 0.02 + i * 0.065, 0.122 * b] })
    B.add(chest, std(spec.shirtColor, 0.8), G.box(0.1, 0.08, 0.02), { p: [0, 0.24, 0.1 * b], r: [-0.4, 0, 0] })
  }
  if (spec.apron) {
    const ap = std('#bdb4a0', 0.95)
    B.add(spine, ap, G.box(0.28 * b, 0.46, 0.012), { p: [0, -0.04, 0.112 * b] })
    B.add(chest, ap, G.box(0.16 * b, 0.16, 0.012), { p: [0, 0.08, 0.118 * b] })
  }
  if (spec.chain) B.add(chest, metal(), G.torus(0.085 * b, 0.006), { p: [0, 0.24, 0.03], r: [Math.PI / 2 + 0.55, 0, 0], s: [1, 1.25, 1] })
  if (spec.wristband) for (const fa of [lFA, rFA]) {
    B.add(fa, std('#0c0c0c', 0.6), G.cyl(0.052 * b, 0.05 * b, 0.07), { p: [0, -0.2, 0] })
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2
      B.add(fa, metal(), G.sph(0.008, 6, 4), { p: [Math.sin(a) * 0.053 * b, -0.2, Math.cos(a) * 0.053 * b] })
    }
  }

  // ── head
  const hy = 0.11
  const stub = spec.beard === 'stubble' || spec.beard === 'short' || spec.beard === 'full'
  // cranium, jaw, then small features — kept subtle so the face reads human, not toy-like
  B.add(head, skin, G.sph(0.1, 24, 18), { p: [0, hy, -0.004], s: [0.86, 1.07, 0.98] })
  B.add(head, stub ? stubbleMat(spec.skin) : skin, G.sph(0.07, 20, 14), { p: [0, hy - 0.056, 0.014], s: [0.92, 0.82, 0.92] })
  B.add(head, skin, G.box(0.11, 0.014, 0.018), { p: [0, hy + 0.026, 0.077] })
  B.add(head, skin, G.box(0.019, 0.046, 0.024), { p: [0, hy - 0.008, 0.09], r: [-0.3, 0, 0] })
  B.add(head, skin, G.sph(0.0125, 10, 8), { p: [0, hy - 0.03, 0.099], s: [1.1, 0.9, 1] })
  for (const s of [-1, 1]) {
    B.add(head, skin, G.sph(0.022, 10, 8), { p: [s * 0.087, hy - 0.004, -0.004], s: [0.42, 1, 0.72] })
    B.add(head, skin, G.sph(0.026, 10, 8), { p: [s * 0.048, hy - 0.018, 0.06], s: [1, 0.55, 0.6] })
    B.add(head, std('#cfc8bb', 0.3), G.sph(0.0115, 10, 8), { p: [s * 0.034, hy + 0.007, 0.076] })
    B.add(head, std('#1e140d', 0.12), G.sph(0.0072, 8, 6), { p: [s * 0.034, hy + 0.007, 0.0855] })
    B.add(head, skin, G.box(0.03, 0.009, 0.014), { p: [s * 0.034, hy + 0.016, 0.082], r: [0.2, 0, s * 0.08] })
  }
  if (spec.scars) {
    const scar = std('#c98f7e', 0.6)
    B.add(head, scar, G.box(0.004, 0.03, 0.004), { p: [0.042, hy + 0.034, 0.093], r: [0, 0, 0.3] })
    B.add(head, scar, G.box(0.022, 0.003, 0.004), { p: [-0.052, hy - 0.04, 0.083], r: [0, -0.5, 0.2] })
  }
  if (spec.earring) B.add(head, metal(), G.torus(0.01, 0.0025), { p: [0.09, hy - 0.03, 0.0], r: [0, Math.PI / 2, 0] })

  const hair = std(spec.hairColor, 0.75)
  const r = rng(spec.id.length * 31 + spec.hair.length)
  switch (spec.hair) {
    case 'messy':
      B.add(head, hair, G.sph(0.106, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), { p: [0, hy + 0.008, -0.008], s: [0.93, 1.08, 1.04], r: [-0.22, 0, 0] })
      for (let i = 0; i < 12; i++) {
        const a = r() * Math.PI * 2
        const up = 0.35 + r() * 0.6
        const rr = 0.095
        B.add(head, hair, G.sph(0.03 + r() * 0.015, 8, 6), {
          p: [Math.sin(a) * Math.cos(up) * rr * 0.9, hy + Math.sin(up) * rr * 1.05, Math.cos(a) * Math.cos(up) * rr * 0.95 + 0.006],
          s: [1, 0.42, 1.3],
          r: [r() - 0.5, a, r() - 0.5],
        })
      }
      // fringe falling forward
      for (let i = 0; i < 3; i++) B.add(head, hair, G.sph(0.022, 8, 6), { p: [-0.03 + i * 0.03, hy + 0.068, 0.074], s: [1.3, 0.45, 0.8], r: [0.5, 0, (r() - 0.5) * 0.6] })
      break
    case 'mohawk': {
      B.add(head, stubbleMat(spec.skin), G.sph(0.1015, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), { p: [0, hy + 0.004, 0], s: [0.885, 1.06, 0.985] })
      const blue = mat('mohawk', () => new THREE.MeshStandardMaterial({ color: spec.hairColor, roughness: 0.5, metalness: 0.1, emissive: '#0a1626' }))
      for (let i = 0; i < 11; i++) {
        const t = -1.15 + i * 0.22
        const h = 0.11 - Math.abs(t + 0.15) * 0.045
        B.add(head, blue, G.cone(0.024, h), {
          p: [0, hy + Math.cos(t) * 0.104 + h * 0.3 * Math.cos(t), Math.sin(t) * 0.1 + h * 0.3 * Math.sin(t)],
          r: [t - 0.35, 0, 0],
        })
      }
      break
    }
    case 'bald':
      B.add(head, stubbleMat(spec.skin), G.sph(0.1015, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.45), { p: [0, hy + 0.004, 0], s: [0.885, 1.06, 0.985] })
      break
    case 'bandana': {
      const cloth = std(spec.accentColor ?? '#7a1b18', 0.85)
      B.add(head, cloth, G.sph(0.106, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.46), { p: [0, hy + 0.01, -0.004], s: [0.92, 1.05, 1.02], r: [-0.12, 0, 0] })
      B.add(head, cloth, G.box(0.04, 0.03, 0.03), { p: [0, hy + 0.01, -0.1] })
      B.add(head, cloth, G.box(0.03, 0.08, 0.01), { p: [0.012, hy - 0.04, -0.104], r: [0.2, 0, 0.2] })
      break
    }
    case 'beanie': {
      const knit = std(spec.accentColor ?? '#2b2b2e', 0.95)
      B.add(head, knit, G.sph(0.11, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), { p: [0, hy + 0.015, -0.006], s: [0.92, 1.18, 1.03] })
      B.add(head, knit, G.cyl(0.103, 0.103, 0.035, 20), { p: [0, hy + 0.025, -0.004], s: [0.92, 1, 1.03] })
      break
    }
    case 'greyRing':
      B.add(head, hair, G.torus(0.09, 0.024), { p: [0, hy + 0.02, -0.01], r: [Math.PI / 2 + 0.25, 0, 0], s: [0.96, 1.08, 1] })
      break
    case 'slick':
      B.add(head, hair, G.sph(0.106, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), { p: [0, hy + 0.01, -0.01], s: [0.92, 1.06, 1.04], r: [-0.25, 0, 0] })
      break
  }

  const beard = std(spec.beardColor ?? spec.hairColor, 0.85)
  if (spec.beard === 'short' || spec.beard === 'full') {
    const big = spec.beard === 'full'
    B.add(head, beard, G.sph(big ? 0.078 : 0.073, 20, 14), { p: [0, hy - (big ? 0.07 : 0.062), big ? 0.022 : 0.018], s: [0.95, big ? 0.95 : 0.8, 0.94] })
    for (const s of [-1, 1]) B.add(head, beard, G.sph(0.03, 10, 8), { p: [s * 0.066, hy - 0.028, 0.03], s: [0.5, 1.3, 0.9] })
  }
  if (spec.beard === 'mustache' || spec.beard === 'short' || spec.beard === 'full') {
    for (const s of [-1, 1]) B.add(head, beard, G.box(0.03, 0.011, 0.016), { p: [s * 0.016, hy - 0.046, 0.088], r: [0.25, 0, s * -0.22] })
  }
  if (spec.glasses === 'sun') {
    const g = std('#050505', 0.1, 0.6)
    B.add(head, g, G.box(0.12, 0.028, 0.012), { p: [0, hy + 0.007, 0.092] })
    for (const s of [-1, 1]) B.add(head, g, G.box(0.004, 0.006, 0.09), { p: [s * 0.083, hy + 0.012, 0.045] })
  }
  if (spec.glasses === 'reading') {
    for (const s of [-1, 1]) B.add(head, metal(), G.torus(0.014, 0.0014), { p: [s * 0.034, hy + 0.006, 0.09] })
  }

  // expression bones
  const browMat = std(spec.hair === 'greyRing' ? spec.hairColor : spec.hair === 'mohawk' ? '#1a1612' : spec.hairColor, 0.8)
  const browL = node('browL', head, [0.036, hy + 0.03, 0.088])
  const browR = node('browR', head, [-0.036, hy + 0.03, 0.088])
  B.add(browL, browMat, G.box(0.04, 0.008, 0.01))
  B.add(browR, browMat, G.box(0.04, 0.008, 0.01))
  const beardy = spec.beard === 'short' || spec.beard === 'full'
  const mouth = node('mouth', head, [0, hy - 0.064, beardy ? 0.1 : 0.083])
  B.add(mouth, std('#170806', 0.8), G.box(0.034, 0.006, 0.008))

  // ── props
  const bag = node('bag', chest, [0, 0, 0])
  B.add(bag, std('#2b2a24', 0.85), G.capsule(0.11, 0.34), { p: [0.05, 0.02, -0.2], r: [0, 0, Math.PI / 2 - 0.4] })
  B.add(bag, std('#151410', 0.7), G.box(0.03, 0.62, 0.012), { p: [0, 0.12, 0.0], r: [0, 0, 0.62], s: [1, 1, 1] })
  const bat = node('bat', rHand, [0, -0.05, 0.02])
  B.add(bat, std('#a07a4c', 0.55), G.cyl(0.034, 0.016, 0.82, 12), { p: [0, -0.32, 0.12], r: [1.25, 0, 0] })
  B.add(bat, std('#1a1a1a', 0.6), G.cyl(0.018, 0.018, 0.14, 8), { p: [0, 0, 0], r: [1.25, 0, 0] })
  const cash = node('cash', rHand, [0, -0.07, 0.03])
  B.add(cash, std('#6f7a58', 0.9), G.box(0.07, 0.015, 0.14))
  B.add(cash, std('#c8c0a0', 0.9), G.box(0.072, 0.004, 0.03), { p: [0, 0.009, 0] })

  B.finalize()

  // emblem patch on the vest back
  if (spec.emblem) {
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24 * b, 0.24 * b),
      mat('emblem', () => new THREE.MeshStandardMaterial({ map: emblemTexture(), transparent: true, roughness: 0.75, alphaTest: 0.05 })),
    )
    patch.position.set(0, 0.13, -0.137 * b)
    patch.rotation.y = Math.PI
    chest.add(patch)
  }

  // contact shadow
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    mat('blob', () => new THREE.MeshBasicMaterial({ color: '#000', alphaMap: glowTexture(), transparent: true, opacity: 0.65, depthWrite: false })),
  )
  shadow.name = 'shadow'
  shadow.rotation.x = -Math.PI / 2
  shadow.position.y = 0.012
  shadow.renderOrder = -1
  root.add(shadow)

  root.userData.hipsY = hipsY
  return root
}

const templates = new Map<string, THREE.Group>()

export function createRig(spec: CharacterSpec): Rig {
  let t = templates.get(spec.id)
  if (!t) {
    t = buildTemplate(spec)
    templates.set(spec.id, t)
  }
  const root = t.clone(true)
  const find = (n: string) => root.getObjectByName(n)!
  const joints = Object.fromEntries(
    ['hips', 'spine', 'chest', 'neck', 'head', 'lUpperArm', 'lForeArm', 'rUpperArm', 'rForeArm', 'lThigh', 'lShin', 'rThigh', 'rShin'].map((n) => [n, find(n)]),
  ) as Record<Joint, THREE.Object3D>
  const props = { bag: find('bag'), bat: find('bat'), cash: find('cash') }
  for (const p of Object.values(props)) p.visible = false
  return {
    root,
    body: find('body') as THREE.Group,
    joints,
    browL: find('browL'),
    browR: find('browR'),
    mouth: find('mouth'),
    props,
    hipsY: root.userData.hipsY,
  }
}
