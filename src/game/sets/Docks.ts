import { Color3, DynamicTexture, Vector3 } from '@render/core'
import type { AbstractMesh, Material, Mesh } from '@render/core'
import { LightingManager, TUNGSTEN } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import * as D from '@render/Dressing'
import { SetBuilder } from '@render/SetBuilder'
import type { EnvContext, EnvironmentFactory, GameEnvironment } from './types'

// Pier Nine at night: a wet concrete quay with stacked shipping containers,
// the harbour and the far shore's lights off to the left, and at the end a
// blue-grey warehouse with its roller door up and the light on inside, where
// Sal waits by his workbench with the parcel.
//
// The warehouse front is the plane z = 12, facing the quay (−Z); its door is
// 5.2 m wide at x = 0. The quay edge runs along x = −12, the water beyond it.
// Rookie's car is parked on the quay, nose toward the water.

const FRONT_Z = 12
const DOOR_W = 5.2
const DOOR_H = 3.8
const WALL_H = 7.4
const BACK_Z = 22
const HALF_W = 11
const EDGE_X = -12
const BENCH = { x: 1.7, z: 14.9, top: 0.92 }
/** Rookie's car: model front is local −X, so yaw 0 points it at the water. */
const CAR = { x: 4.4, z: -5.4, yaw: 0 }
const SODIUM = new Color3(1, 0.66, 0.36)

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'docks')
  const lit = new LightingManager(scene, quality)
  const hi = quality === 'high'
  const tex = hi ? 1024 : 512
  T.reseed(31)

  scene.fogMode = 2
  scene.fogDensity = 0.008
  scene.fogColor = new Color3(0.17, 0.13, 0.12)
  scene.clearColor.set(0.09, 0.08, 0.09, 1)

  // All tiers: tune existing PBR uniforms only; retain material sharing,
  // texture sizes, clear-coat features, geometry and render budgets.
  // ── Materials ───────────────────────────────────────────────────────────
  const quay = s.surface('dk_quay', 'concrete', [16, 14], '#8a8d91', 0.48)
  quay.clearCoat.isEnabled = true
  quay.clearCoat.intensity = 0.4
  quay.clearCoat.roughness = 0.28
  const quayWall = s.surface('dk_quay_wall', 'concrete', [10, 1], '#4d5054')
  const floorIn = s.surface('dk_floor_in', 'concrete', [5, 3], '#77736c')
  const wallIn = s.surface('dk_wall_in', 'concrete', [6, 2], '#8b857a')
  const corrugated = (name: string, color: string, panels: number, uv: [number, number]) =>
    s.pbr(name, color, { albedo: s.track(T.steelPanel(scene, tex, panels)), rough: 0.66, metal: 0.12, uv })
  const cladding = corrugated('dk_cladding', '#7088a0', 8, [5, 2])
  const shutter = corrugated('dk_shutter', '#959ba2', 12, [1, 1])
  const steel = s.pbr('dk_steel', '#1d1f23', { rough: 0.45, metal: 0.8 })
  const ironRust = s.pbr('dk_rust', '#4a2c1e', { rough: 0.9, metal: 0.08 })
  const ceilingIn = s.pbr('dk_ceiling', '#17171a', { rough: 0.95 })
  const crateWood = s.pbr('dk_crate', '#ffffff', { albedo: s.track(T.wood(scene, 256, [150, 112, 72])), rough: 0.85 })
  const benchWood = s.pbr('dk_bench', '#ffffff', { albedo: s.track(T.wood(scene, 256, [96, 66, 42])), rough: 0.7 })
  const hazard = s.pbr('dk_hazard', '#ffffff', { albedo: s.track(T.stripes(scene, 'hazard')), rough: 0.7, uv: [1, 4] })
  const water = s.pbr('dk_water', '#070b11', { rough: 0.13, metal: 0 })
  const bulb = s.glow('dk_bulb', new Color3(1, 0.82, 0.55))
  const sodiumLens = s.glow('dk_sodium', new Color3(1, 0.62, 0.3))
  const officeGlow = s.glow('dk_office', new Color3(0.62, 0.42, 0.22))
  const redBeacon = s.glow('dk_beacon', new Color3(0.9, 0.08, 0.06))
  const paper = s.pbr('dk_parcel_paper', '#7a5a3a', { rough: 0.85 })
  const twine = s.pbr('dk_parcel_twine', '#d8cdb4', { rough: 0.9 })

  // A night sky: dark overhead, a warm haze over the far shore's lights.
  const skyTex = s.track(new DynamicTexture('tex_dk_sky', { width: 16, height: 256 }, scene, false))
  {
    const c = skyTex.getContext() as unknown as CanvasRenderingContext2D
    const g = c.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#0c0d16')
    g.addColorStop(0.5, '#221f2e')
    g.addColorStop(0.82, '#5a3c34')
    g.addColorStop(1, '#8e5a3c')
    c.fillStyle = g
    c.fillRect(0, 0, 16, 256)
    skyTex.update(true)
  }
  const skyMat = s.glow('dk_sky', new Color3(1, 1, 1), skyTex)
  skyMat.fogEnabled = false

  // ── Quay and water ──────────────────────────────────────────────────────
  const ground = s.box('dk_ground', [36, 0.2, 44], [EDGE_X + 18, -0.1, 4], quay)
  ground.metadata = { walkable: true }
  s.box('dk_quay_face', [0.4, 1.6, 44], [EDGE_X - 0.2, -0.9, 4], quayWall)
  s.box('dk_quay_cap', [0.5, 0.14, 44], [EDGE_X + 0.15, 0.07, 4], quayWall)
  s.box('dk_water', [120, 0.05, 160], [EDGE_X - 60.4, -1.25, 20], water)
  for (const z of [-10, -2, 6, 14]) {
    s.lathe(`dk_bollard_${z}`, [[0.2, 0], [0.2, 0.42], [0.27, 0.5], [0.27, 0.58], [0, 0.6]], [EDGE_X + 0.55, 0, z], ironRust)
  }
  // a ladder down the quay face
  for (const dz of [-0.25, 0.25]) s.rod(`dk_ladder_${dz}`, [EDGE_X - 0.42, -1.3, 2 + dz], [EDGE_X - 0.42, 0.9, 2 + dz], 0.04, steel)
  for (let y = -1.1; y < 0.8; y += 0.3) s.rod(`dk_rung_${y.toFixed(1)}`, [EDGE_X - 0.42, y, 1.75], [EDGE_X - 0.42, y, 2.25], 0.03, steel)

  // ── The warehouse ───────────────────────────────────────────────────────
  const sideW = HALF_W - DOOR_W / 2
  for (const side of [-1, 1]) {
    s.box(`dk_front_${side}`, [sideW, WALL_H, 0.3], [side * (DOOR_W / 2 + sideW / 2), WALL_H / 2, FRONT_Z], cladding)
    s.box(`dk_side_${side}`, [0.3, WALL_H, BACK_Z - FRONT_Z], [side * HALF_W, WALL_H / 2, (FRONT_Z + BACK_Z) / 2], cladding)
    // door posts, hazard-striped up to shoulder height
    s.box(`dk_post_${side}`, [0.22, DOOR_H, 0.38], [side * (DOOR_W / 2 + 0.05), DOOR_H / 2, FRONT_Z - 0.05], steel)
    s.box(`dk_post_stripe_${side}`, [0.24, 1.6, 0.4], [side * (DOOR_W / 2 + 0.05), 0.8, FRONT_Z - 0.05], hazard)
  }
  s.box('dk_front_top', [DOOR_W, WALL_H - DOOR_H, 0.3], [0, DOOR_H + (WALL_H - DOOR_H) / 2, FRONT_Z], cladding)
  s.box('dk_back', [HALF_W * 2, WALL_H, 0.3], [0, WALL_H / 2, BACK_Z], cladding)
  s.box('dk_roof', [HALF_W * 2 + 0.6, 0.3, BACK_Z - FRONT_Z + 0.6], [0, WALL_H + 0.15, (FRONT_Z + BACK_Z) / 2], steel)
  s.box('dk_gutter', [HALF_W * 2 + 0.6, 0.18, 0.2], [0, WALL_H - 0.05, FRONT_Z - 0.35], steel)
  for (let x = -HALF_W + 0.6; x < HALF_W; x += 1.2)
    if (Math.abs(x) > DOOR_W / 2 + 0.3) s.box(`dk_rib_${x.toFixed(1)}`, [0.07, WALL_H - 0.2, 0.08], [x, WALL_H / 2, FRONT_Z - 0.18], steel)
  // the roller door, run up most of the way: the drum housing and the bottom slats showing
  s.box('dk_drum', [DOOR_W + 0.4, 0.55, 0.6], [0, DOOR_H + 0.3, FRONT_Z - 0.2], steel)
  s.box('dk_shutter', [DOOR_W - 0.05, 0.75, 0.06], [0, DOOR_H - 0.38, FRONT_Z - 0.02], shutter)
  s.box('dk_shutter_bar', [DOOR_W - 0.05, 0.08, 0.1], [0, DOOR_H - 0.76, FRONT_Z - 0.02], steel)
  // the name, painted big over the door
  const signTex = s.track(T.sign(scene, 'tex_dk_sign', ['PIER 9'], { w: 512, h: 160, bg: '#3e4d5c', fg: '#e6e0d2' }))
  s.plane('dk_sign', 4.4, 1.38, [0, 5.75, FRONT_Z - 0.17], s.pbr('dk_sign_mat', '#ffffff', { albedo: signTex, rough: 0.7 }))
  const noticeTex = s.track(T.sign(scene, 'tex_dk_notice', ['AUTHORISED', 'PERSONNEL ONLY'], { w: 256, h: 128, bg: '#c9b98c', fg: '#1a1a1a', accent: '#8a1a14' }))
  s.plane('dk_notice', 0.8, 0.4, [-3.6, 1.7, FRONT_Z - 0.17], s.pbr('dk_notice_mat', '#ffffff', { albedo: noticeTex, rough: 0.7 }))
  // the office window to the right of the door: the light that's on
  s.box('dk_office_frame', [2.3, 1.5, 0.12], [6.2, 2.0, FRONT_Z - 0.18], steel)
  s.box('dk_office_win', [2.1, 1.3, 0.05], [6.2, 2.0, FRONT_Z - 0.24], officeGlow)
  s.box('dk_office_bar', [0.06, 1.3, 0.08], [6.2, 2.0, FRONT_Z - 0.27], steel)
  // a lamp over the door
  s.box('dk_door_lamp', [0.5, 0.18, 0.34], [0, 4.85, FRONT_Z - 0.4], steel)
  s.box('dk_door_lens', [0.42, 0.03, 0.26], [0, 4.75, FRONT_Z - 0.4], bulb)

  // ── Inside ──────────────────────────────────────────────────────────────
  s.box('dk_floor_in', [HALF_W * 2 - 0.3, 0.04, BACK_Z - FRONT_Z - 0.3], [0, 0.02, (FRONT_Z + BACK_Z) / 2], floorIn)
  s.box('dk_wall_back_in', [HALF_W * 2 - 0.3, WALL_H, 0.05], [0, WALL_H / 2, BACK_Z - 0.18], wallIn)
  for (const side of [-1, 1]) s.box(`dk_wall_in_${side}`, [0.05, WALL_H, BACK_Z - FRONT_Z - 0.3], [side * (HALF_W - 0.18), WALL_H / 2, (FRONT_Z + BACK_Z) / 2], wallIn)
  s.box('dk_ceiling_in', [HALF_W * 2 - 0.3, 0.1, BACK_Z - FRONT_Z - 0.3], [0, WALL_H - 0.2, (FRONT_Z + BACK_Z) / 2], ceilingIn)
  // the workbench: a heavy timber top on steel legs, a shelf under it
  s.box('dk_bench_top', [2.0, 0.07, 0.85], [BENCH.x, BENCH.top - 0.035, BENCH.z], benchWood)
  s.box('dk_bench_shelf', [1.9, 0.04, 0.75], [BENCH.x, 0.22, BENCH.z], benchWood)
  for (const dx of [-0.92, 0.92]) for (const dz of [-0.36, 0.36]) s.box(`dk_bench_leg_${dx}_${dz}`, [0.06, BENCH.top - 0.07, 0.06], [BENCH.x + dx, (BENCH.top - 0.07) / 2, BENCH.z + dz], steel)
  // on the bench: the parcel, a mug, a clipboard, a desk lamp
  const parcel = s.node('dk_parcel', [BENCH.x - 0.15, BENCH.top, BENCH.z - 0.05])
  s.box('dk_parcel_body', [0.3, 0.13, 0.2], [0, 0.065, 0], paper, parcel)
  s.box('dk_parcel_twine_a', [0.302, 0.134, 0.008], [0, 0.065, 0], twine, parcel)
  s.box('dk_parcel_twine_b', [0.008, 0.134, 0.202], [0.07, 0.065, 0], twine, parcel)
  parcel.rotation.y = 0.12
  s.cyl('dk_mug', 0.09, 0.1, [BENCH.x - 0.75, BENCH.top + 0.05, BENCH.z + 0.15], s.pbr('dk_mug_mat', '#c8c2b6', { rough: 0.4 }), { tess: 12 })
  s.box('dk_clipboard', [0.24, 0.015, 0.32], [BENCH.x + 0.3, BENCH.top + 0.008, BENCH.z + 0.2], s.pbr('dk_clip_mat', '#d9d4c6', { rough: 0.9 }))
  s.cyl('dk_lamp_base', 0.14, 0.03, [BENCH.x + 0.8, BENCH.top + 0.015, BENCH.z + 0.25], steel, { tess: 12 })
  s.rod('dk_lamp_arm', [BENCH.x + 0.8, BENCH.top, BENCH.z + 0.25], [BENCH.x + 0.65, BENCH.top + 0.42, BENCH.z + 0.1], 0.02, steel)
  s.cyl('dk_lamp_shade', 0.16, 0.12, [BENCH.x + 0.61, BENCH.top + 0.4, BENCH.z + 0.06], steel, { top: 0.06, cap: false })
  // racking along the back wall, loaded with crates
  for (const x of [-7.5, -3.5, 4.5, 8.0]) {
    for (const dx of [-1.4, 1.4]) for (const dz of [-0.45, 0.45]) s.box(`dk_rack_post_${x}_${dx}_${dz}`, [0.08, 3.6, 0.08], [x + dx, 1.8, BACK_Z - 0.8 + dz], s.pbr('dk_rack', '#2f4f7a', { rough: 0.5, metal: 0.6 }))
    for (const y of [0.15, 1.35, 2.55]) {
      s.box(`dk_rack_beam_${x}_${y}`, [2.9, 0.08, 1.0], [x, y, BACK_Z - 0.8], s.pbr('dk_rack_beam', '#b2541a', { rough: 0.5, metal: 0.5 }))
      if (T.rand() > 0.25) s.box(`dk_rack_crate_${x}_${y}`, [1.1, 0.9, 0.85], [x - 0.6 + T.rand() * 0.2, y + 0.49, BACK_Z - 0.8], crateWood)
      if (T.rand() > 0.4) s.box(`dk_rack_crate2_${x}_${y}`, [0.9, 0.7, 0.8], [x + 0.75, y + 0.39, BACK_Z - 0.8], crateWood)
    }
  }
  // a hanging work lamp over the bench
  s.rod('dk_hang_cord', [BENCH.x - 0.6, WALL_H - 0.25, BENCH.z - 0.3], [BENCH.x - 0.6, 3.05, BENCH.z - 0.3], 0.015, steel)
  s.cyl('dk_hang_shade', 0.55, 0.26, [BENCH.x - 0.6, 2.93, BENCH.z - 0.3], steel, { top: 0.16, cap: false })
  s.sphere('dk_hang_bulb', 0.13, [BENCH.x - 0.6, 2.82, BENCH.z - 0.3], bulb)
  // a chair by the bench, and a pallet jack
  s.box('dk_chair_seat', [0.45, 0.05, 0.45], [-1.6, 0.46, 15.6], benchWood)
  s.box('dk_chair_back', [0.45, 0.5, 0.05], [-1.6, 0.73, 15.85], benchWood)
  for (const dx of [-0.2, 0.2]) for (const dz of [-0.2, 0.2]) s.box(`dk_chair_leg_${dx}_${dz}`, [0.04, 0.44, 0.04], [-1.6 + dx, 0.22, 15.6 + dz], steel)
  s.box('dk_jack_forks', [0.55, 0.08, 1.2], [-4.6, 0.08, 15.4], s.pbr('dk_jack', '#b0281e', { rough: 0.5, metal: 0.4 }))
  s.rod('dk_jack_handle', [-4.6, 0.15, 14.75], [-4.6, 1.15, 14.45], 0.04, steel)

  // ── The yard ────────────────────────────────────────────────────────────
  // shipping containers: ribbed steel, the door end toward the quay
  const container = (name: string, x: number, z: number, y: number, color: string) => {
    const mat = corrugated(`dk_box_${color}`, color, 10, [3, 1])
    s.box(`${name}_body`, [2.44, 2.59, 6.06], [x, y + 1.295, z], mat)
    const doorZ = z - 3.04
    s.box(`${name}_door_frame`, [2.5, 2.65, 0.08], [x, y + 1.32, doorZ], s.pbr(`dk_box_frame_${color}`, color, { rough: 0.6, metal: 0.5 }))
    for (const dx of [-0.75, -0.3, 0.3, 0.75]) s.rod(`${name}_bar_${dx}`, [x + dx, y + 0.12, doorZ - 0.07], [x + dx, y + 2.5, doorZ - 0.07], 0.035, steel)
    s.box(`${name}_seam`, [0.03, 2.5, 0.1], [x, y + 1.3, doorZ - 0.05], steel)
  }
  container('dk_c1', -7.4, 3.0, 0, '#a5452e')
  container('dk_c2', -7.4, 3.0, 2.59, '#3d6890')
  container('dk_c3', -7.4, -3.4, 0, '#4a7352')
  container('dk_c4', 8.4, 2.2, 0, '#5b6c7c')
  container('dk_c5', 8.6, 2.6, 2.59, '#b5772e')
  // crates and a pallet by the door
  s.box('dk_crate_a', [1.2, 1.0, 1.1], [-4.4, 0.5, 10.4], crateWood)
  s.box('dk_crate_b', [0.9, 0.8, 0.9], [-4.3, 1.4, 10.45], crateWood).rotation.y = 0.2
  s.box('dk_crate_c', [1.0, 0.9, 1.0], [-5.7, 0.45, 10.6], crateWood).rotation.y = -0.15
  s.box('dk_pallet', [1.2, 0.15, 1.0], [4.5, 0.075, 10.5], crateWood)
  s.box('dk_pallet_load', [1.1, 0.7, 0.9], [4.5, 0.5, 10.5], s.pbr('dk_wrap', '#9aa3a8', { rough: 0.3, metal: 0.1 }))
  // oil drums
  for (const [i, x, z] of [[0, 5.9, 9.8], [1, 6.55, 10.3], [2, 6.0, 10.85]] as const)
    s.cyl(`dk_drum_${i}`, 0.58, 0.88, [x, 0.44, z], s.pbr(`dk_drum_mat_${i % 2}`, i % 2 ? '#2a4a7a' : '#7a2a22', { rough: 0.55, metal: 0.5 }), { tess: 16 })

  // Rookie's car, parked on the quay
  await s.model('sedan', 'dk_car', [CAR.x, 0.02, CAR.z], CAR.yaw)

  // sodium lamp posts
  const lampPost = (name: string, x: number, z: number, armDir: number) => {
    s.cyl(`${name}_pole`, 0.16, 6, [x, 3, z], steel, { tess: 10 })
    s.box(`${name}_arm`, [1.2, 0.1, 0.1], [x + armDir * 0.55, 5.95, z], steel)
    s.box(`${name}_head`, [0.7, 0.16, 0.36], [x + armDir * 1.1, 5.88, z], steel)
    s.box(`${name}_lens`, [0.6, 0.03, 0.3], [x + armDir * 1.1, 5.79, z], sodiumLens)
    return new Vector3(x + armDir * 1.1, 5.6, z)
  }
  const lampA = lampPost('dk_lamp_a', -9.6, -6.5, 1)
  const lampB = lampPost('dk_lamp_b', 10.6, 7.0, -1)
  const lampC = lampPost('dk_lamp_c', EDGE_X + 1.2, 6.5, 1)

  // each lamp's sodium pool on the wet concrete and its halo in the drizzle
  for (const [name, p] of [['a', lampA], ['b', lampB], ['c', lampC]] as const) {
    D.lightPool(s, null, `dk_pool_${name}`, [p.x, 0, p.z], 7, 7, SODIUM, 0.3)
    D.halo(s, null, `dk_halo_${name}`, [p.x, 5.75, p.z], 1.8, new Color3(1, 0.7, 0.4), 0.5)
  }
  // the warehouse's light spilling out of the open door across the quay
  D.windowLight(s, null, 'dk_door_spill', [0, 0, FRONT_Z - 2.4], DOOR_W, 4.2, new Color3(1, 0.8, 0.55), { cols: 1, rows: 1, strength: 0.3 })
  D.halo(s, null, 'dk_door_lamp_halo', [0, 4.72, FRONT_Z - 0.4], 1.2, new Color3(1, 0.85, 0.6), 0.45)
  // the usual rubbish along the containers
  D.litter(s, 'dk_litter', [-6, -6, -5.2, 6], 0, 10)
  // a red neon over the warehouse door, Sal's one concession to advertising
  D.neon(s, null, 'dk_neon', ['OPEN'], [-DOOR_W / 2 - 1.3, 3.2, FRONT_Z - 0.08], 1.5, 0.6, new Color3(1, 0.16, 0.2))

  // ── The far side: a gantry crane, the far shore's towers, the sky ───────
  const craneMat = s.pbr('dk_crane', '#24262b', { rough: 0.6, metal: 0.6 })
  for (const dz of [-3, 3]) for (const dx of [-2.5, 2.5]) s.box(`dk_crane_leg_${dz}_${dx}`, [0.5, 22, 0.5], [-26 + dx, 11, 34 + dz], craneMat)
  s.box('dk_crane_boom', [40, 1.4, 1.4], [-30, 22.5, 34], craneMat)
  s.box('dk_crane_cab', [3, 2.5, 3], [-24, 20.5, 34], craneMat)
  s.sphere('dk_crane_beacon', 0.5, [-49.5, 23.4, 34], redBeacon)
  const sky = s.plane('sky', 220, 80, [-20, 30, 95], skyMat)
  sky.applyFog = false
  const skyL = s.plane('sky_l', 220, 80, [-110, 30, 0], skyMat, -Math.PI / 2)
  skyL.applyFog = false
  const towers: [number, number, number, number, number][] = [
    // x, z, height, width, facing (0 = toward −Z, i.e. us; −π/2 = toward +X across the water)
    [-70, -30, 24, 12, -Math.PI / 2], [-72, -6, 38, 10, -Math.PI / 2], [-68, 16, 30, 14, -Math.PI / 2], [-74, 40, 44, 11, -Math.PI / 2],
    [-40, 70, 34, 12, 0], [-14, 74, 26, 14, 0], [12, 72, 40, 10, 0], [34, 70, 28, 13, 0],
  ]
  for (const [i, [x, z, h, w, yaw]] of towers.entries()) {
    const facade = s.track(T.facade(scene, `tex_dk_tower_${i}`, 256, 512, 6, 14, 60 + i, true, 0.38))
    const b = s.box(`tower_${i}`, [w, h, 7], [x, h / 2 - 1.2, z], s.pbr(`dk_tower_${i}`, '#17181e', { albedo: facade, emissiveTex: facade, rough: 0.6, emissive: new Color3(0.55, 0.45, 0.32) }))
    b.rotation.y = yaw
  }

  // ── Lighting ────────────────────────────────────────────────────────────
  const ambient = lit.hemi(1.7, new Color3(0.78, 0.66, 0.58), new Color3(0.36, 0.26, 0.19))
  ambient.direction.set(-0.3, 1, -0.4)
  // the lamp over the door is the key: it pools on the quay in front of the door and throws the shadows
  const key = lit.spot('dk_key', new Vector3(0, 4.7, FRONT_Z - 0.6), new Vector3(0, -1, -0.55), 1.5, 200, SODIUM, 18)
  lit.enableShadows(key)
  lit.point('dk_inside', new Vector3(BENCH.x - 0.6, 2.7, BENCH.z - 0.6), 40, TUNGSTEN, 11)
  lit.point('dk_lamp_a_light', lampA, 70, SODIUM, 18)
  lit.point('dk_lamp_b_light', lampB, 70, SODIUM, 18)
  lit.point('dk_lamp_c_light', lampC, 70, SODIUM, 18)
  lit.enableGlow(0.35)
  for (const m of s.meshes) if (/^(sky|tower_)/.test(m.name)) lit.glow?.addExcludedMesh(m as Mesh)
  for (const m of s.meshes) if (/^(dk_crate|dk_pallet|dk_drum_|dk_car|dk_c\d|dk_post)/.test(m.name)) lit.castShadow(m)
  lit.raiseLightLimit(s.materials)
  D.mergeDressing(s)
  lit.bakeProbe(new Vector3(0, 2, 4), s.meshes.filter((m) => !/^(sky|tower_)/.test(m.name)), 0.85)
  s.freezeStatic([parcel], { merge: true })

  const env: GameEnvironment = {
    id: 'docks',
    marks: {
      // beside his car, the driver's side toward the warehouse
      car_side: [CAR.x - 0.6, CAR.z + 1.4],
      quay_mid: [0.6, 2.6],
      door_out: [0.3, 9.6],
      // just over the threshold, facing in
      threshold: [0.2, 12.6],
      // Sal, a couple of metres in, between the door and his bench
      sal_wait: [-0.6, 14.5],
      sal_bench: [0.6, 15.2],
      bench: [BENCH.x - 0.15, BENCH.z - 0.05, BENCH.top + 0.05],
      bench_stand: [BENCH.x - 0.2, BENCH.z - 0.82],
      container_look: [-6.15, 4.6, 1.5],
      container_stand: [-5.0, 4.4],
      quay_edge: [EDGE_X + 0.3, -2, 0.3],
      quay_stand: [EDGE_X + 1.3, -1.6],
      // the marker for the door: up in the doorway, where Sal is
      door_marker: [-0.6, 14.5, 2.4],
    },
    shots: {
      // from behind the car: the quay, the containers, the lit door at the end
      dock_wide: { pos: [1.4, 2.3, -15.5], target: [-0.9, 2.0, 9.5], fov: 0.84, handheld: 0 },
      // from the quay, angled into the doorway: Rookie on the threshold, Sal inside
      dock_door: { pos: [3.9, 1.62, 7.6], target: [-0.2, 1.35, 13.6], fov: 0.66, handheld: 0 },
      // from inside, by the racks, back toward the door and the yard
      dock_inside: { pos: [1.5, 1.62, 18.2], target: [-0.2, 1.35, 12.8], fov: 0.74, handheld: 0 },
      // from just outside the door, square on: Sal by the racks, Rookie at the bench
      dock_pair: { pos: [0.6, 1.6, 8.2], target: [0.55, 1.3, 14.2], fov: 0.8, handheld: 0 },
      // across the bench: him taking the parcel
      dock_bench: { pos: [-1.0, 1.65, 17.6], target: [BENCH.x - 0.3, 0.95, BENCH.z - 0.5], fov: 0.72, handheld: 0 },
    },
    bounds: { minX: EDGE_X + 0.8, maxX: 6.6, minZ: -6.2, maxZ: 13.4 },
    obstacles: [
      // the front wall either side of the door
      [-HALF_W - 0.3, FRONT_Z - 0.35, -DOOR_W / 2 + 0.1, FRONT_Z + 0.35],
      [DOOR_W / 2 - 0.1, FRONT_Z - 0.35, HALF_W + 0.3, FRONT_Z + 0.35],
      // containers
      [-8.75, -6.6, -6.05, 6.2],
      [7.05, -1.0, 9.8, 5.4],
      // crates, pallet and drums
      [-6.3, 9.8, -3.7, 11.2],
      [3.8, 9.9, 6.95, 11.2],
      // the car
      [CAR.x - 2.6, CAR.z - 1.1, CAR.x + 2.6, CAR.z + 1.1],
      // bench, chair
      [BENCH.x - 1.1, BENCH.z - 0.5, BENCH.x + 1.1, BENCH.z + 0.5],
      [-1.9, 15.3, -1.3, 16.0],
    ],
    followYaw: 0,
    // inside the warehouse the walls hold the camera in; outside, the quay
    cameraBoxAt: (t) =>
      t.z > FRONT_Z + 0.4
        ? { min: [-HALF_W + 0.4, 0.3, FRONT_Z + 0.3], max: [HALF_W - 0.4, WALL_H - 0.5, BACK_Z - 0.4] }
        : { min: [EDGE_X + 0.2, 0.3, -16], max: [14, 12, FRONT_Z - 0.4] },
    lighting: lit,
    walkable: [ground],
    event(name) {
      switch (name) {
        case 'parcelTaken':
          parcel.setEnabled(false)
          break
        case 'parcelBack':
          parcel.setEnabled(true)
          break
        default:
          console.warn(`[docks] unknown event ${name}`)
      }
    },
    update() {},
    adopt(meshes: AbstractMesh[], materials: Material[]) {
      for (const m of meshes) lit.castActorShadow(m)
      lit.raiseLightLimit(materials)
    },
    dispose() {
      lit.dispose()
      s.dispose()
      scene.fogMode = 0
    },
  }
  return env
}

export default build
