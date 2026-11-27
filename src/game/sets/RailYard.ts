import { Color3, DynamicTexture, Mesh, PBRMaterial, Ray, Vector3 } from '@render/core'
import type { AbstractMesh, Material } from '@render/core'
import { LightingManager, TUNGSTEN } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import * as D from '@render/Dressing'
import { SetBuilder } from '@render/SetBuilder'
import type { EnvContext, EnvironmentFactory, GameEnvironment } from './types'

// The old Calder rail yard at night (Scene 03): a wet concrete yard behind a
// chain-link fence, a disused freight line across it with a rusting boxcar
// on the rails, and at the back the long brick shed of the old works. One
// lamp still burns over the office door in the shed, where Nico waits with
// the package. Off to the left, behind the boxcar where nobody coming in
// through the gate can see it, a grey sedan is parked with its lights off.
//
// The shed front is the plane z = 12, facing the yard (−Z); the office door
// is at x = 3.2. The freight line runs along z = −4. The gate is in the
// near fence (z = −12); Rookie backs his car in beside it.

const FRONT_Z = 12
const WALL_H = 7.6
const SHED = { x0: -16, x1: 12 }
const DOOR = { x: 3.2, w: 1.1, h: 2.25 }
const OFFICE = { x0: 1.6, x1: 6.2, z1: 15.4 }
const TABLE = { x: 4.6, z: 14.1, top: 0.78 }
const TRACK_Z = -4
const FENCE_Z = -12
const GATE = { x0: 2.2, x1: 7.6 }
const SIDE_X = 14.5
/** Rookie's car, nose toward the gate (model front is local −X; yaw −π/2 points it at −Z). */
const CAR = { x: 5.0, z: -8.4, yaw: -Math.PI / 2 }
/** The grey sedan, behind the boxcar, nose toward the office. */
const SEDAN = { x: -9.6, z: 3.6, yaw: Math.PI - 0.12 }
const BOXCAR = { x0: -15.5, x1: -4.2 }
const SODIUM = new Color3(1, 0.64, 0.34)
const HEADLAMP = new Color3(1, 0.93, 0.8)
const carFront = (yaw: number) => new Vector3(-Math.cos(yaw), 0, Math.sin(yaw))

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'yard')
  const lit = new LightingManager(scene, quality)
  const hi = quality === 'high'
  const tex = hi ? 1024 : 512
  T.reseed(73)

  scene.fogMode = 2
  scene.fogDensity = 0.009
  scene.fogColor = new Color3(0.17, 0.13, 0.12)
  scene.clearColor.set(0.09, 0.08, 0.09, 1)

  // All tiers: tune existing PBR uniforms only; retain material sharing,
  // texture sizes, clear-coat features, geometry and render budgets.
  // ── Materials ───────────────────────────────────────────────────────────
  const yardFloor = s.surface('yd_ground', 'concrete', [14, 14], '#7f8284', 0.66)
  yardFloor.clearCoat.isEnabled = true
  yardFloor.clearCoat.intensity = 0.35
  yardFloor.clearCoat.roughness = 0.22
  const brick = s.surface('yd_brick', 'brick', [10, 3], '#8d6a55')
  const brickDark = s.surface('yd_brick_dark', 'brick', [3, 1.2], '#6b5244')
  const concrete = s.surface('yd_concrete', 'concrete', [4, 1], '#77787a')
  const officeWall = s.surface('yd_office_wall', 'concrete', [2, 1], '#a39784')
  const steel = s.pbr('yd_steel', '#1d1f23', { rough: 0.45, metal: 0.8 })
  const rust = s.pbr('yd_rust', '#5a3322', { rough: 0.9, metal: 0.08 })
  const rail = s.pbr('yd_rail', '#5e5650', { rough: 0.3, metal: 0.9 })
  const sleeperWood = s.pbr('yd_sleeper', '#ffffff', { albedo: s.track(T.wood(scene, 256, [70, 56, 44])), rough: 0.9 })
  const crateWood = s.pbr('yd_crate', '#ffffff', { albedo: s.track(T.wood(scene, 256, [140, 104, 66])), rough: 0.85 })
  const boxcarMat = s.pbr('yd_boxcar', '#7a3424', { albedo: s.track(T.steelPanel(scene, tex, 14)), rough: 0.74, metal: 0.12, uv: [3, 1] })
  const charred = s.pbr('yd_charred', '#1b1918', { rough: 0.95, metal: 0.02 })
  const charredRust = s.pbr('yd_charred_rust', '#4a2a1c', { rough: 0.9, metal: 0.06 })
  const puddle = s.pbr('yd_puddle', '#0a0c0f', { rough: 0.12, metal: 0 })
  const windowDark = s.pbr('yd_window', '#14171b', { rough: 0.15, metal: 0.4 })
  const frame = s.pbr('yd_frame', '#2c2a28', { rough: 0.6, metal: 0.5 })
  const doorMat = s.pbr('yd_door', '#3d4a52', { albedo: s.track(T.steelPanel(scene, 256, 3)), rough: 0.65, metal: 0.12 })
  const tableMat = s.pbr('yd_table', '#ffffff', { albedo: s.track(T.wood(scene, 256, [110, 80, 52])), rough: 0.7 })
  const holdallMat = s.pbr('yd_holdall', '#1f2a22', { rough: 0.75 })
  const cashMat = s.pbr('yd_cash', '#6f8a64', { rough: 0.85 })
  const paper = s.pbr('yd_parcel_paper', '#5e4630', { rough: 0.85 })
  const tape = s.pbr('yd_parcel_tape', '#b9a77c', { rough: 0.6 })
  const bulb = s.glow('yd_bulb', new Color3(1, 0.82, 0.55))
  const sodiumLens = s.glow('yd_sodium', new Color3(1, 0.6, 0.28))
  const officeGlow = s.glow('yd_office_glow', new Color3(0.7, 0.46, 0.24))
  const redBeacon = s.glow('yd_beacon', new Color3(0.9, 0.08, 0.06))

  // the chain-link fence: a diamond mesh painted on a transparent texture, one
  // per run of fence so the mesh keeps the same size (four diamonds a metre) whatever its length
  const chainLink = (name: string, len: number) => {
    const t = s.track(new DynamicTexture(`tex_${name}`, { width: 128, height: 128 }, scene, true))
    const c = t.getContext() as unknown as CanvasRenderingContext2D
    c.clearRect(0, 0, 128, 128)
    c.strokeStyle = 'rgba(150,150,145,0.95)'
    c.lineWidth = 5
    for (let i = -128; i <= 256; i += 32) {
      c.beginPath()
      c.moveTo(i, 0)
      c.lineTo(i + 128, 128)
      c.stroke()
      c.beginPath()
      c.moveTo(i, 128)
      c.lineTo(i + 128, 0)
      c.stroke()
    }
    t.hasAlpha = true
    t.update(true)
    // dynamic textures clamp by default; the mesh repeats
    t.wrapU = 1
    t.wrapV = 1
    t.uScale = len
    t.vScale = 2.3
    const m = s.pbr(name, '#9a9a96', { albedo: t, rough: 0.5, metal: 0.7 })
    m.useAlphaFromAlbedoTexture = true
    // cut out, not blended: the holes are holes from every angle and the mesh sorts like a solid
    m.transparencyMode = 1
    m.alphaCutOff = 0.4
    m.backFaceCulling = false
    m.twoSidedLighting = true
    return m
  }

  // A night sky: dark overhead, the city's glow low down.
  const skyTex = s.track(new DynamicTexture('tex_yd_sky', { width: 16, height: 256 }, scene, false))
  {
    const c = skyTex.getContext() as unknown as CanvasRenderingContext2D
    const g = c.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#0b0c14')
    g.addColorStop(0.5, '#1f1c2a')
    g.addColorStop(0.8, '#4e3630')
    g.addColorStop(1, '#84553a')
    c.fillStyle = g
    c.fillRect(0, 0, 16, 256)
    skyTex.update(true)
  }
  const skyMat = s.glow('yd_sky', new Color3(1, 1, 1), skyTex)
  skyMat.fogEnabled = false

  // ── Ground, puddles ─────────────────────────────────────────────────────
  const ground = s.box('yd_ground', [60, 0.2, 60], [0, -0.1, 4], yardFloor)
  ground.metadata = { walkable: true }
  for (const [i, x, z, w, d] of [[0, -1.5, 3.2, 3.2, 1.6], [1, 7.6, -3.0, 2.0, 1.1], [2, -3.4, -7.8, 2.6, 1.4], [3, 1.0, 9.6, 1.8, 0.9]] as const) {
    const p = s.plane(`yd_puddle_${i}`, w, d, [x, 0.006, z], puddle)
    p.rotation.x = Math.PI / 2
  }

  // ── The shed: brick front, high dark windows, the loading dock, the office door ─
  const doorL = DOOR.x - DOOR.w / 2
  const doorR = DOOR.x + DOOR.w / 2
  s.box('yd_front_l', [doorL - SHED.x0, WALL_H, 0.4], [(SHED.x0 + doorL) / 2, WALL_H / 2, FRONT_Z + 0.2], brick)
  s.box('yd_front_r', [SHED.x1 - doorR, WALL_H, 0.4], [(doorR + SHED.x1) / 2, WALL_H / 2, FRONT_Z + 0.2], brick)
  s.box('yd_front_top', [DOOR.w, WALL_H - DOOR.h, 0.4], [DOOR.x, DOOR.h + (WALL_H - DOOR.h) / 2, FRONT_Z + 0.2], brick)
  s.box('yd_plinth', [SHED.x1 - SHED.x0, 0.5, 0.5], [(SHED.x0 + SHED.x1) / 2, 0.25, FRONT_Z - 0.02], brickDark)
  s.box('yd_coping', [SHED.x1 - SHED.x0 + 0.3, 0.3, 0.7], [(SHED.x0 + SHED.x1) / 2, WALL_H + 0.15, FRONT_Z + 0.2], concrete)
  s.roof('yd_roof', SHED.x1 - SHED.x0, 3.2, 14, [(SHED.x0 + SHED.x1) / 2, WALL_H + 0.3, FRONT_Z + 7.2], steel)
  for (const side of [-1, 1]) s.box(`yd_end_${side}`, [0.4, WALL_H, 14], [side < 0 ? SHED.x0 : SHED.x1, WALL_H / 2, FRONT_Z + 7.2], brick)
  // the high windows: rows of small dark panes in steel frames, a few broken out
  for (let x = SHED.x0 + 2.2; x < SHED.x1 - 1.4; x += 3.1) {
    if (Math.abs(x - DOOR.x) < 2) continue
    s.box(`yd_win_${x.toFixed(1)}`, [2.2, 2.2, 0.08], [x, 5.1, FRONT_Z - 0.02], windowDark)
    for (const dx of [-0.73, 0, 0.73]) s.box(`yd_mull_${x.toFixed(1)}_${dx}`, [0.06, 2.2, 0.1], [x + dx, 5.1, FRONT_Z - 0.05], frame)
    for (const dy of [-0.55, 0.55]) s.box(`yd_tran_${x.toFixed(1)}_${dy}`, [2.2, 0.06, 0.1], [x, 5.1 + dy, FRONT_Z - 0.05], frame)
    s.box(`yd_sill_${x.toFixed(1)}`, [2.4, 0.12, 0.3], [x, 3.95, FRONT_Z - 0.1], concrete)
  }
  // the loading dock on the left: a raised slab with bumpers, a shutter, crates left on it
  s.box('yd_dock', [8, 1.1, 2.4], [-6, 0.55, FRONT_Z - 1.2], concrete)
  for (const x of [-9, -3]) s.box(`yd_bumper_${x}`, [0.3, 0.45, 0.2], [x, 0.7, FRONT_Z - 2.45], s.pbr('yd_rubber', '#121212', { rough: 0.9 }))
  s.box('yd_dock_shutter', [4.4, 3.4, 0.1], [-6, 2.8, FRONT_Z - 0.03], s.pbr('yd_dock_shutter_mat', '#6b7076', { albedo: s.track(T.steelPanel(scene, 256, 12)), rough: 0.6, metal: 0.5 }))
  s.box('yd_dock_canopy', [9, 0.18, 3.4], [-6, 4.6, FRONT_Z - 1.6], steel)
  for (const x of [-10.2, -1.8]) s.rod(`yd_canopy_tie_${x}`, [x, 4.6, FRONT_Z - 3.2], [x, 6.6, FRONT_Z], 0.05, steel)
  s.box('yd_dock_crate_a', [1.1, 0.9, 1.0], [-8.4, 1.55, FRONT_Z - 1.3], crateWood)
  s.box('yd_dock_crate_b', [0.9, 0.7, 0.9], [-8.3, 2.35, FRONT_Z - 1.25], crateWood).rotation.y = 0.25
  s.box('yd_dock_pallet', [1.2, 0.14, 1.0], [-4.4, 1.17, FRONT_Z - 1.0], crateWood)
  // a faded name painted along the wall
  const nameTex = s.track(T.sign(scene, 'tex_yd_name', ['CALDER  WORKS'], { w: 1024, h: 128, bg: '#5d4334', fg: '#c9b9a0' }))
  s.plane('yd_name', 9.6, 1.2, [-6.4, 6.3, FRONT_Z - 0.03], s.pbr('yd_name_mat', '#ffffff', { albedo: nameTex, rough: 0.9 }))

  // the office door: steel, hinged on its left, opening out into the yard
  const hinge = s.node('yd_door_hinge', [doorL, 0, FRONT_Z - 0.02])
  s.box('yd_door_leaf', [DOOR.w - 0.04, DOOR.h - 0.04, 0.06], [DOOR.w / 2, DOOR.h / 2, 0], doorMat, hinge)
  s.rod('yd_door_handle', [DOOR.w - 0.16, 1.0, -0.06], [DOOR.w - 0.16, 1.2, -0.06], 0.03, steel, hinge)
  s.box('yd_door_frame_l', [0.08, DOOR.h, 0.46], [doorL - 0.04, DOOR.h / 2, FRONT_Z + 0.2], frame)
  s.box('yd_door_frame_r', [0.08, DOOR.h, 0.46], [doorR + 0.04, DOOR.h / 2, FRONT_Z + 0.2], frame)
  s.box('yd_door_frame_t', [DOOR.w + 0.16, 0.08, 0.46], [DOOR.x, DOOR.h + 0.04, FRONT_Z + 0.2], frame)
  s.box('yd_step', [1.6, 0.12, 0.7], [DOOR.x, 0.06, FRONT_Z - 0.35], concrete)
  // the office window beside the door, lit from inside, barred
  s.box('yd_office_win', [1.6, 1.1, 0.05], [5.5, 1.75, FRONT_Z - 0.03], officeGlow)
  s.box('yd_office_win_frame', [1.75, 1.25, 0.06], [5.5, 1.75, FRONT_Z - 0.0], frame)
  for (const dx of [-0.5, -0.17, 0.17, 0.5]) s.rod(`yd_office_bar_${dx}`, [5.5 + dx, 1.2, FRONT_Z - 0.1], [5.5 + dx, 2.3, FRONT_Z - 0.1], 0.025, steel)
  // the lamp over the door: the one light still working
  s.box('yd_door_lamp', [0.5, 0.2, 0.42], [DOOR.x, 3.3, FRONT_Z - 0.25], steel)
  s.box('yd_door_lens', [0.4, 0.03, 0.3], [DOOR.x, 3.19, FRONT_Z - 0.25], sodiumLens)
  s.rod('yd_lamp_conduit', [DOOR.x + 0.25, 3.3, FRONT_Z - 0.04], [DOOR.x + 0.25, WALL_H, FRONT_Z - 0.04], 0.04, steel)

  // inside the office: what you see past the open door — bare walls, a table, a holdall of cash, the package
  s.box('yd_office_floor', [OFFICE.x1 - OFFICE.x0, 0.04, OFFICE.z1 - FRONT_Z - 0.4], [(OFFICE.x0 + OFFICE.x1) / 2, 0.02, (FRONT_Z + 0.4 + OFFICE.z1) / 2], s.surface('yd_office_floor_mat', 'concrete', [2, 2], '#6c6862'))
  s.box('yd_office_back', [OFFICE.x1 - OFFICE.x0, 3, 0.1], [(OFFICE.x0 + OFFICE.x1) / 2, 1.5, OFFICE.z1], officeWall)
  for (const x of [OFFICE.x0, OFFICE.x1]) s.box(`yd_office_side_${x}`, [0.1, 3, OFFICE.z1 - FRONT_Z - 0.4], [x, 1.5, (FRONT_Z + 0.4 + OFFICE.z1) / 2], officeWall)
  s.box('yd_office_ceiling', [OFFICE.x1 - OFFICE.x0, 0.1, OFFICE.z1 - FRONT_Z - 0.4], [(OFFICE.x0 + OFFICE.x1) / 2, 3, (FRONT_Z + 0.4 + OFFICE.z1) / 2], s.pbr('yd_office_ceiling_mat', '#2a2724', { rough: 0.95 }))
  s.box('yd_table_top', [1.4, 0.05, 0.8], [TABLE.x, TABLE.top - 0.025, TABLE.z], tableMat)
  for (const dx of [-0.64, 0.64]) for (const dz of [-0.34, 0.34]) s.box(`yd_table_leg_${dx}_${dz}`, [0.05, TABLE.top - 0.05, 0.05], [TABLE.x + dx, (TABLE.top - 0.05) / 2, TABLE.z + dz], steel)
  s.box('yd_holdall', [0.62, 0.3, 0.32], [TABLE.x + 0.3, TABLE.top + 0.15, TABLE.z + 0.1], holdallMat)
  for (const [i, dx, dz] of [[0, -0.05, -0.18], [1, -0.2, -0.12], [2, -0.12, -0.28]] as const) s.box(`yd_cash_${i}`, [0.16, 0.05, 0.08], [TABLE.x + dx, TABLE.top + 0.025 + i * 0.05, TABLE.z + dz], cashMat)
  s.box('yd_chair', [0.44, 0.46, 0.44], [TABLE.x - 1.0, 0.23, TABLE.z + 0.2], frame)
  s.sphere('yd_office_bulb', 0.12, [TABLE.x - 0.4, 2.6, TABLE.z - 0.2], bulb)
  s.rod('yd_office_cord', [TABLE.x - 0.4, 2.66, TABLE.z - 0.2], [TABLE.x - 0.4, 3.0, TABLE.z - 0.2], 0.01, steel)
  // the package on the table until Nico brings it out
  const parcel = s.node('yd_parcel', [TABLE.x - 0.35, TABLE.top, TABLE.z + 0.12])
  s.box('yd_parcel_body', [0.32, 0.16, 0.22], [0, 0.08, 0], paper, parcel)
  s.box('yd_parcel_tape', [0.322, 0.164, 0.05], [0, 0.08, 0], tape, parcel)
  parcel.rotation.y = -0.2

  // ── The freight line and the boxcar ─────────────────────────────────────
  for (const dz of [-0.72, 0.72]) s.box(`yd_rail_${dz}`, [60, 0.14, 0.08], [0, 0.07, TRACK_Z + dz], rail)
  for (let x = -29; x <= 29; x += 0.8) s.box(`yd_sleeper_${x.toFixed(1)}`, [0.24, 0.08, 2.4], [x, 0.03, TRACK_Z], sleeperWood)
  const bx = (BOXCAR.x0 + BOXCAR.x1) / 2
  const bl = BOXCAR.x1 - BOXCAR.x0
  s.box('yd_boxcar_body', [bl, 3.1, 2.9], [bx, 2.6, TRACK_Z], boxcarMat)
  s.box('yd_boxcar_roof', [bl + 0.1, 0.12, 3.0], [bx, 4.2, TRACK_Z], rust)
  s.box('yd_boxcar_frame', [bl + 0.4, 0.3, 2.6], [bx, 0.92, TRACK_Z], steel)
  // the sliding door, half open on the yard side, the dark inside showing
  s.box('yd_boxcar_gap', [1.6, 2.6, 0.04], [bx + 0.9, 2.45, TRACK_Z - 1.46], s.pbr('yd_boxcar_inside', '#0c0b0a', { rough: 1 }))
  s.box('yd_boxcar_door', [2.0, 2.7, 0.08], [bx - 0.9, 2.45, TRACK_Z - 1.52], rust)
  s.box('yd_boxcar_rail_t', [5.2, 0.08, 0.1], [bx, 3.85, TRACK_Z - 1.55], steel)
  for (const dx of [-bl / 2 + 1.6, bl / 2 - 1.6]) {
    for (const dz of [-0.72, 0.72]) for (const ddx of [-0.75, 0.75]) {
      const w = s.cyl(`yd_wheel_${dx}_${dz}_${ddx}`, 0.8, 0.12, [bx + dx + ddx, 0.47, TRACK_Z + dz], steel, { tess: 16 })
      w.rotation.x = Math.PI / 2
    }
    s.box(`yd_bogie_${dx}`, [2.4, 0.3, 1.8], [bx + dx, 0.6, TRACK_Z], rust)
  }
  // a buffer stop at the right-hand end of the line
  s.box('yd_buffer', [0.6, 1.1, 2.2], [24, 0.55, TRACK_Z], rust)

  // ── The gantry over the line ────────────────────────────────────────────
  const gantry = s.pbr('yd_gantry', '#3a3430', { rough: 0.7, metal: 0.55 })
  for (const x of [9.5, 20]) for (const dz of [-2.6, 2.6]) s.box(`yd_gantry_leg_${x}_${dz}`, [0.4, 8, 0.4], [x, 4, TRACK_Z + dz], gantry)
  for (const dz of [-2.6, 2.6]) s.box(`yd_gantry_beam_${dz}`, [11, 0.6, 0.4], [14.75, 8.2, TRACK_Z + dz], gantry)
  s.box('yd_gantry_trolley', [1.2, 0.7, 5.6], [12.5, 7.85, TRACK_Z], rust)
  s.rod('yd_gantry_chain', [12.5, 7.5, TRACK_Z], [12.5, 4.4, TRACK_Z], 0.05, steel)
  s.box('yd_gantry_hook', [0.25, 0.4, 0.1], [12.5, 4.25, TRACK_Z], steel)

  // ── Fences and the gate ─────────────────────────────────────────────────
  const fence = (name: string, a: [number, number], b: [number, number]) => {
    const len = Math.hypot(b[0] - a[0], b[1] - a[1])
    const yaw = Math.atan2(b[0] - a[0], b[1] - a[1]) - Math.PI / 2
    const mid: [number, number] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
    s.plane(`${name}_mesh`, len, 2.3, [mid[0], 1.2, mid[1]], chainLink(`${name}_mat`, len), yaw)
    s.rod(`${name}_top`, [a[0], 2.35, a[1]], [b[0], 2.35, b[1]], 0.05, steel)
    const n = Math.max(1, Math.round(len / 3))
    for (let i = 0; i <= n; i++) {
      const t = i / n
      s.cyl(`${name}_post_${i}`, 0.08, 2.5, [a[0] + (b[0] - a[0]) * t, 1.25, a[1] + (b[1] - a[1]) * t], steel, { tess: 8 })
    }
  }
  fence('yd_fence_nl', [-SIDE_X, FENCE_Z], [GATE.x0, FENCE_Z])
  fence('yd_fence_nr', [GATE.x1, FENCE_Z], [SIDE_X, FENCE_Z])
  fence('yd_fence_l', [-SIDE_X, FENCE_Z], [-SIDE_X, FRONT_Z])
  fence('yd_fence_r', [SIDE_X, FENCE_Z], [SIDE_X, FRONT_Z])
  // the gate leaf, swung back against the fence, its chain cut and hanging
  fence('yd_gate', [GATE.x1, FENCE_Z - 0.2], [GATE.x1 + 0.4, FENCE_Z - 4.8])
  s.cyl('yd_gatepost_l', 0.14, 2.6, [GATE.x0, 1.3, FENCE_Z], steel, { tess: 10 })
  s.cyl('yd_gatepost_r', 0.14, 2.6, [GATE.x1, 1.3, FENCE_Z], steel, { tess: 10 })
  const chain = s.pbr('yd_chain', '#8c8a86', { rough: 0.35, metal: 0.9 })
  for (let i = 0; i < 6; i++) {
    const link = s.torus(`yd_chain_${i}`, 0.07, 0.015, [GATE.x0 + 0.08, 1.1 - i * 0.07, FENCE_Z - 0.1], chain)
    link.rotation.x = i % 2 ? Math.PI / 2 : 0
  }
  s.box('yd_padlock', [0.07, 0.09, 0.04], [GATE.x0 + 0.08, 0.66, FENCE_Z - 0.1], s.pbr('yd_brass', '#a8894f', { rough: 0.3, metal: 1 }))
  const warnTex = s.track(T.sign(scene, 'tex_yd_warn', ['DANGER', 'KEEP OUT'], { w: 256, h: 160, bg: '#d8d0bc', fg: '#1a1a1a', accent: '#9a1a14' }))
  s.plane('yd_warn', 0.8, 0.5, [GATE.x0 - 1.6, 1.5, FENCE_Z - 0.04], s.pbr('yd_warn_mat', '#ffffff', { albedo: warnTex, rough: 0.7 }), Math.PI)

  // ── Dressing: the burnt-out van, drums, pallets ─────────────────────────
  const van = s.node('yd_van', [10.2, 0, 3.2])
  van.rotation.y = 0.35
  s.box('yd_van_body', [4.6, 1.9, 2.0], [0, 1.35, 0], charred, van)
  s.box('yd_van_cab', [1.2, 1.2, 1.96], [-2.85, 1.0, 0], charredRust, van)
  s.box('yd_van_win', [0.05, 0.55, 1.6], [-3.46, 1.35, 0], s.pbr('yd_van_glass_gone', '#050505', { rough: 1 }), van)
  for (const dx of [-2.6, 1.4]) for (const dz of [-1.0, 1.0]) {
    const w = s.cyl(`yd_van_rim_${dx}_${dz}`, 0.55, 0.18, [dx, 0.28, dz], charredRust, { tess: 12, parent: van })
    w.rotation.x = Math.PI / 2
  }
  for (const [i, x, z] of [[0, 8.0, 8.6], [1, 8.75, 9.1], [2, 7.9, 9.55], [3, -12.8, 8.8]] as const)
    s.cyl(`yd_drum_${i}`, 0.58, 0.88, [x, 0.44, z], s.pbr(`yd_drum_mat_${i % 2}`, i % 2 ? '#2a4a7a' : '#6e3020', { rough: 0.6, metal: 0.45 }), { tess: 16 })
  s.box('yd_pallets', [1.2, 0.6, 1.0], [-1.0, 0.3, 10.6], crateWood)
  s.box('yd_pallets_b', [1.2, 0.45, 1.0], [-0.9, 0.82, 10.55], crateWood).rotation.y = 0.15

  // a dead lamp post by the gate, and one still lit on the far side of the line
  const lampPost = (name: string, x: number, z: number, armDir: number, on: boolean) => {
    s.cyl(`${name}_pole`, 0.16, 6, [x, 3, z], steel, { tess: 10 })
    s.box(`${name}_arm`, [1.2, 0.1, 0.1], [x + armDir * 0.55, 5.95, z], steel)
    s.box(`${name}_head`, [0.7, 0.16, 0.36], [x + armDir * 1.1, 5.88, z], steel)
    s.box(`${name}_lens`, [0.6, 0.03, 0.3], [x + armDir * 1.1, 5.79, z], on ? sodiumLens : windowDark)
    return new Vector3(x + armDir * 1.1, 5.6, z)
  }
  lampPost('yd_lamp_dead', 0.6, -10.8, 1, false)
  const lampLit = lampPost('yd_lamp_lit', 12.6, -7.4, -1, true)

  // Rookie's car, backed in by the gate
  const car = await s.model('sedan', 'yd_car', [CAR.x, 0.02, CAR.z], CAR.yaw)
  // the grey sedan, behind the boxcar
  const sedan = await s.model('sedan_sports', 'yd_sedan', [SEDAN.x, 0.02, SEDAN.z], SEDAN.yaw)
  const sedanLamps: PBRMaterial[] = []
  const sedanTails: PBRMaterial[] = []
  for (const m of sedan.getChildMeshes()) {
    const mat = m.material
    if (!(mat instanceof PBRMaterial)) continue
    if (mat.name.includes('lacquer')) {
      mat.albedoColor = Color3.FromHexString('#8a8d90').toLinearSpace()
      mat.metallic = 0.6
    }
    if (mat.name.includes('headlamp') && !sedanLamps.includes(mat)) sedanLamps.push(mat)
    if (mat.name.includes('tail lamp') && !sedanTails.includes(mat)) sedanTails.push(mat)
  }
  for (const m of sedanTails) m.emissiveColor = new Color3(0.32, 0.02, 0.02)
  for (const m of car.getChildMeshes()) {
    const mat = m.material
    if (mat instanceof PBRMaterial && mat.name.includes('tail lamp')) mat.emissiveColor = new Color3(0.4, 0.02, 0.02)
  }
  // the grey sedan's tell-tales, laid on its own glass (found by casting a ray
  // at it, the glass being opaque): a parking permit at the foot of the
  // windscreen on the side facing the yard, and the yard-side tail light taped over
  const front = carFront(SEDAN.yaw)
  const yardSide = new Vector3(front.z, 0, -front.x)
  const centre = new Vector3(SEDAN.x, 0, SEDAN.z)
  for (const m of sedan.getChildMeshes()) m.computeWorldMatrix(true)
  const onGlass = (from: Vector3, dir: Vector3, glass: RegExp) => {
    const hit = scene.pickWithRay(new Ray(from, dir, 6), (m) => m.isDescendantOf(sedan) && Boolean(m.material && glass.test(m.material.name)))
    if (!hit?.hit || !hit.pickedPoint) return null
    const n = hit.getNormal(true) ?? dir.scale(-1)
    if (Vector3.Dot(n, dir) > 0) n.scaleInPlace(-1)
    return { at: hit.pickedPoint.add(n.scale(0.012)), n }
  }
  // a flat card facing out along `n`: a plane's face looks down its −Z, so its +Z goes into the glass
  const lay = (name: string, w: number, h: number, mat: Material, at: Vector3, n: Vector3, roll = 0) => {
    const p = s.plane(name, w, h, [at.x, at.y, at.z], mat)
    p.lookAt(at.subtract(n))
    p.rotation.z += roll
    return p
  }
  const permitTex = s.track(new DynamicTexture('tex_yd_permit', { width: 192, height: 128 }, scene, true))
  {
    const c = permitTex.getContext() as unknown as CanvasRenderingContext2D
    c.fillStyle = '#ece6d8'
    c.fillRect(0, 0, 192, 128)
    c.fillStyle = '#8f1b1d'
    c.fillRect(0, 0, 192, 30)
    T.drawCrest(c as never, 48, 80, 30, '#8f1b1d', '#ece6d8')
    c.fillStyle = '#1a1a1a'
    c.font = 'bold 17px sans-serif'
    c.fillText('RESERVED', 86, 74)
    c.font = '15px sans-serif'
    c.fillText('STAFF', 88, 96)
    c.fillStyle = '#ece6d8'
    c.font = 'bold 18px sans-serif'
    c.fillText('DOWNTOWN GYM', 14, 22)
    permitTex.update(true)
  }
  const permitMat = s.pbr('yd_permit', '#ffffff', { albedo: permitTex, rough: 0.8, emissive: new Color3(0.22, 0.2, 0.18), emissiveTex: permitTex })
  const permitHit = onGlass(centre.add(front.scale(3.2)).add(yardSide.scale(0.38)).add(new Vector3(0, 1.12, 0)), front.scale(-1), /glass/)
  if (permitHit) lay('yd_sedan_permit', 0.24, 0.16, permitMat, permitHit.at, permitHit.n)
  // the close-up on it: square to the glass, three metres out
  const permitAt = permitHit?.at ?? centre.add(front.scale(1.1)).add(new Vector3(0, 1.1, 0))
  const permitN = permitHit?.n ?? front
  const permitCam = permitAt.add(permitN.scale(3.0)).add(new Vector3(0, 0.15, 0))
  const tailHit = onGlass(centre.add(front.scale(-3.2)).add(yardSide.scale(0.62)).add(new Vector3(0, 0.82, 0)), front, /tail lamp/)
  if (tailHit) {
    const tapeMat = s.pbr('yd_tape', '#cfc6b0', { rough: 0.7 })
    lay('yd_sedan_tape', 0.05, 0.2, tapeMat, tailHit.at, tailHit.n, 0.6)
    lay('yd_sedan_tape2', 0.05, 0.18, tapeMat, tailHit.at.add(tailHit.n.scale(0.002)), tailHit.n, -0.7)
  }
  // its headlights: a spot that rides with the car, off until they flash
  const sedanBeam = lit.spot('yd_sedan_beam', new Vector3(-2.6, 0.75, 0), new Vector3(-1, -0.1, 0), 0.75, 0, HEADLAMP, 34)
  sedanBeam.parent = sedan
  // Rookie's headlights, for the getaway
  const carBeam = lit.spot('yd_car_beam', new Vector3(-2.6, 0.75, 0), new Vector3(-1, -0.12, 0), 0.9, 0, HEADLAMP, 30)
  carBeam.parent = car
  const carLamps = car.getChildMeshes().map((m) => m.material).filter((m): m is PBRMaterial => m instanceof PBRMaterial && m.name.includes('headlamp'))

  // ── Beyond: the works chimney, the city's towers, the sky ───────────────
  s.cyl('yd_chimney', 2.4, 26, [-4, 13, 24], brickDark, { top: 1.7, tess: 16 })
  s.sphere('yd_chimney_beacon', 0.5, [-4, 26.2, 24], redBeacon)
  s.cyl('yd_tower_tank', 5, 4, [22, 14, 26], rust, { tess: 16 })
  for (const dx of [-1.8, 1.8]) for (const dz of [-1.8, 1.8]) s.box(`yd_tower_leg_${dx}_${dz}`, [0.3, 12, 0.3], [22 + dx, 6, 26 + dz], gantry)
  const sky = s.plane('sky', 240, 90, [0, 30, 110], skyMat)
  sky.applyFog = false
  for (const side of [-1, 1]) {
    const p = s.plane(`sky_${side}`, 240, 90, [side * 110, 30, 10], skyMat, side * Math.PI / 2)
    p.applyFog = false
  }
  const skyBack = s.plane('sky_back', 240, 90, [0, 30, -100], skyMat, Math.PI)
  skyBack.applyFog = false
  const towers: [number, number, number, number, number][] = [
    [-46, 78, 30, 12, 0], [-20, 84, 42, 11, 0], [8, 80, 34, 14, 0], [34, 76, 26, 12, 0], [56, 82, 38, 10, 0],
    [-60, -40, 26, 12, Math.PI], [-24, -52, 34, 13, Math.PI], [22, -48, 30, 12, Math.PI], [52, -44, 40, 11, Math.PI],
  ]
  for (const [i, [x, z, h, w, yaw]] of towers.entries()) {
    const facade = s.track(T.facade(scene, `tex_yd_tower_${i}`, 256, 512, 6, 14, 90 + i, true, 0.36))
    const b = s.box(`tower_${i}`, [w, h, 7], [x, h / 2 - 1.2, z], s.pbr(`yd_tower_${i}`, '#17181e', { albedo: facade, emissiveTex: facade, rough: 0.6, emissive: new Color3(0.55, 0.45, 0.32) }))
    b.rotation.y = yaw
  }

  // ── Lighting ────────────────────────────────────────────────────────────
  const ambient = lit.hemi(2.25, new Color3(0.78, 0.66, 0.58), new Color3(0.36, 0.26, 0.19))
  ambient.direction.set(0.3, 1, -0.4)
  // the lamp over the office door is the key: it pools in front of the door and throws the shadows
  const key = lit.spot('yd_key', new Vector3(DOOR.x, 3.15, FRONT_Z - 0.5), new Vector3(0, -1, -0.62), 1.55, 210, SODIUM, 20)
  lit.enableShadows(key)
  lit.point('yd_office_light', new Vector3(TABLE.x - 0.4, 2.4, TABLE.z - 0.4), 26, TUNGSTEN, 6)
  lit.point('yd_lamp_light', lampLit, 80, SODIUM, 20)
  // a low warm wash from the city glow, so the far side of the yard isn't lost
  lit.point('yd_fill', new Vector3(-6, 5, -2), 42, new Color3(0.95, 0.66, 0.44), 26)
  lit.point('yd_fill_door', new Vector3(1.5, 4.5, 5.5), 30, new Color3(1, 0.7, 0.46), 14)
  // the working lamp's pool on the yard, the key light's under the door, halos in the damp air
  D.lightPool(s, null, 'yd_lamp_pool', [lampLit.x, 0.01, lampLit.z], 9, 9, SODIUM, 0.3)
  D.halo(s, null, 'yd_lamp_halo', [lampLit.x, lampLit.y + 0.15, lampLit.z], 2.0, new Color3(1, 0.7, 0.4), 0.5)
  D.halo(s, null, 'yd_door_halo', [DOOR.x, 3.25, FRONT_Z - 0.45], 1.1, new Color3(1, 0.75, 0.45), 0.45)
  // rubbish blown up against the fence
  D.litter(s, 'yd_litter', [-SIDE_X + 1, FENCE_Z + 0.4, SIDE_X - 1, FENCE_Z + 1.2], 0.01, 14)
  lit.enableGlow(0.35)
  for (const m of s.meshes) if (/^(sky|tower_)/.test(m.name)) lit.glow?.addExcludedMesh(m as Mesh)
  for (const m of s.meshes) if (/^(yd_car|yd_sedan|yd_van|yd_drum|yd_pallets|yd_boxcar|yd_dock_crate|yd_door_leaf|yd_gatepost)/.test(m.name)) lit.castShadow(m)
  lit.raiseLightLimit(s.materials)
  D.mergeDressing(s)
  lit.bakeProbe(new Vector3(0, 2, 2), s.meshes.filter((m) => !/^(sky|tower_)/.test(m.name)), 0.85)
  s.freezeStatic([parcel, hinge, car, sedan], { merge: true })

  // ── Scripted events ─────────────────────────────────────────────────────
  type Tween = { t: number; dur: number; apply: (k: number) => void }
  const tweens: Tween[] = []
  const tween = (dur: number, apply: (k: number) => void, instant: boolean) => (instant ? apply(1) : tweens.push({ t: 0, dur, apply }))
  const setDoor = (open: boolean, instant: boolean) => {
    const from = hinge.rotation.y
    const to = open ? 1.35 : 0
    tween(1.0, (k) => (hinge.rotation.y = from + (to - from) * (1 - (1 - k) ** 3)), instant)
  }
  const setSedanLights = (on: boolean) => {
    sedanBeam.intensity = on ? 240 : 0
    for (const m of sedanLamps) m.emissiveColor = on ? HEADLAMP : Color3.Black()
  }
  setSedanLights(false)
  let flashing = 0
  const parked = new Vector3(CAR.x, 0.02, CAR.z)
  const carLeave = (instant: boolean) => {
    carBeam.intensity = 160
    for (const m of carLamps) m.emissiveColor = HEADLAMP
    const end = parked.add(carFront(CAR.yaw).scale(30))
    tween(4.4, (k) => car.position.copyFrom(Vector3.Lerp(parked, end, k * k)), instant)
  }

  const env: GameEnvironment = {
    id: 'yard',
    marks: {
      // out of the car on the driver's side (+X of a car facing −Z), looking into the yard
      car_side: [CAR.x + 1.35, CAR.z + 0.3],
      car_door: [CAR.x + 1.3, CAR.z - 0.2],
      gate_in: [5.6, -5.2],
      yard_mid: [3.6, -0.6],
      // Nico pacing in the lamp's pool in front of his door, and where Rookie stops
      nico_wait: [DOOR.x - 0.3, FRONT_Z - 2.6],
      nico_pace: [DOOR.x + 1.4, FRONT_Z - 2.3],
      meet: [DOOR.x + 0.6, FRONT_Z - 4.6],
      office_door: [DOOR.x, FRONT_Z - 0.9],
      office_in: [TABLE.x - 0.6, TABLE.z - 0.75],
      office_phone: [TABLE.x - 1.0, TABLE.z - 0.95],
      table: [TABLE.x - 0.35, TABLE.z + 0.12, TABLE.top + 0.08],
      doorway_look: [DOOR.x, FRONT_Z + 1.6, 1.2],
      doorway_stand: [DOOR.x - 0.1, FRONT_Z - 1.5],
      // the grey sedan and the man who came in it
      sedan: [SEDAN.x, SEDAN.z, 1.0],
      sedan_nose: [SEDAN.x + 2.7, SEDAN.z - 0.3],
      sedan_lean: [SEDAN.x + 1.0, SEDAN.z - 1.45],
      // the dash, just inside the windscreen (the car faces +X)
      sedan_dash: [permitAt.x, permitAt.z, permitAt.y],
      sedan_stand: [SEDAN.x + 0.6, SEDAN.z - 2.35],
      sedan_rear: [SEDAN.x - 2.6, SEDAN.z, 0.8],
      confront: [SEDAN.x + 2.0, SEDAN.z - 2.6],
      stranger_face: [SEDAN.x + 1.9, SEDAN.z - 2.0],
      // between the office and the car: where the man steps out in front of him
      block: [4.7, -0.6],
      rookie_stop: [4.3, 1.0],
      // where they square up, and the near end of the boxcar he steps out from
      fight_rookie: [4.3, 0.85],
      fight_stranger: [4.6, -0.3],
      boxcar_end: [0.6, -2.4],
      stranger_aside: [6.6, -0.4],
      run_past: [6.6, -3.6],
      // hotspots
      gate_chain: [GATE.x0 + 0.08, FENCE_Z - 0.1, 1.0],
      gate_stand: [GATE.x0 + 0.6, FENCE_Z + 1.0],
      boxcar_look: [bx + 0.9, TRACK_Z - 1.46, 1.6],
      boxcar_stand: [bx + 1.3, TRACK_Z - 3.0],
      van_look: [10.2, 3.2, 1.2],
      van_stand: [8.6, 1.0],
    },
    shots: {
      // from inside the gate, past his car: the yard, the boxcar, the lit door at the back
      yard_wide: { pos: [9.6, 2.1, -10.6], target: [1.2, 1.8, 8.0], fov: 0.84, handheld: 0 },
      // off his shoulder by the car as he gets out
      yard_car: { pos: [8.4, 1.6, -11.6], target: [4.4, 1.3, -4.0], fov: 0.72, handheld: 0 },
      // across the lamp's pool: Nico by his door, Rookie coming up
      yard_meet: { pos: [6.8, 1.6, 6.1], target: [3.1, 1.3, 8.8], fov: 0.78, handheld: 0 },
      // the reverse: from by the door, out past the two of them toward the boxcar and the sedan's corner
      yard_reverse: { pos: [5.4, 1.7, 11.0], target: [-4.0, 1.2, 3.6], fov: 0.74, handheld: 0 },
      // the grey sedan from Nico's side of the yard, the boxcar behind it
      sedan_wide: { pos: [-1.6, 1.7, 7.2], target: [SEDAN.x + 0.9, 1.1, SEDAN.z - 1.0], fov: 0.6, handheld: 0 },
      // the sedan's headlights flashing, from beside the two of them
      sedan_flash: { pos: [3.6, 1.5, 6.4], target: [SEDAN.x + 1.0, 1.0, SEDAN.z], fov: 0.5, handheld: 0 },
      // at the sedan: the man leaning on it, Rookie walking up
      sedan_talk: { pos: [SEDAN.x + 5.4, 1.6, SEDAN.z - 4.2], target: [SEDAN.x + 1.6, 1.3, SEDAN.z - 1.6], fov: 0.62, handheld: 0 },
      // the permit on the dash, through the windscreen
      sedan_dash_close: { pos: [permitCam.x, permitCam.y, permitCam.z], target: [permitAt.x, permitAt.y, permitAt.z], fov: 0.5, handheld: 0 },
      // the tail lamp, taped over
      sedan_tail_close: { pos: [SEDAN.x - 3.9, 0.95, SEDAN.z - 1.4], target: [SEDAN.x - 2.4, 0.82, SEDAN.z - 0.55], fov: 0.42, handheld: 0 },
      // through the open office door: the table, the holdall, the package
      office_in: { pos: [DOOR.x - 0.1, 1.62, FRONT_Z - 1.8], target: [TABLE.x - 0.2, 0.95, TABLE.z], fov: 0.62, handheld: 0 },
      // the confrontation on the open ground, side-on
      block_side: { pos: [10.2, 1.6, -0.9], target: [4.6, 1.25, -0.4], fov: 0.66, handheld: 0 },
      // the getaway: the car pulls out through the gate
      gate_out: { pos: [-1.2, 1.9, -15.6], target: [4.4, 1.0, -9.4], fov: 0.72, handheld: 0 },
    },
    bounds: { minX: -SIDE_X + 0.8, maxX: SIDE_X - 0.8, minZ: FENCE_Z + 0.8, maxZ: FRONT_Z - 0.6 },
    obstacles: [
      // the shed front either side of the door
      [SHED.x0, FRONT_Z - 0.3, DOOR.x - DOOR.w / 2, FRONT_Z + 0.6],
      [DOOR.x + DOOR.w / 2, FRONT_Z - 0.3, SHED.x1, FRONT_Z + 0.6],
      [-10.2, FRONT_Z - 2.6, -1.8, FRONT_Z],
      // the boxcar
      [BOXCAR.x0 - 0.3, TRACK_Z - 1.6, BOXCAR.x1 + 0.3, TRACK_Z + 1.6],
      // the cars
      [CAR.x - 1.1, CAR.z - 2.6, CAR.x + 1.1, CAR.z + 2.6],
      [SEDAN.x - 2.6, SEDAN.z - 1.1, SEDAN.x + 2.6, SEDAN.z + 1.1],
      // the van (its cab included), the drums, the pallets
      [6.6, 1.4, 12.8, 5.4],
      [7.4, 8.1, 9.3, 9.9],
      [-1.7, 10.0, -0.2, 11.2],
      // the gate leaf
      [GATE.x1 - 0.2, FENCE_Z - 4.9, GATE.x1 + 0.6, FENCE_Z],
    ],
    followYaw: 0,
    cameraBox: { min: [-SIDE_X + 0.3, 0.3, FENCE_Z - 6], max: [SIDE_X - 0.3, 9, FRONT_Z - 0.3] },
    lighting: lit,
    walkable: [ground],
    event(name, instant = false) {
      switch (name) {
        case 'doorOpen':
          setDoor(true, instant)
          break
        case 'doorClose':
          setDoor(false, instant)
          break
        case 'parcelTaken':
          parcel.setEnabled(false)
          break
        case 'parcelBack':
          parcel.setEnabled(true)
          break
        case 'sedanFlash':
          if (instant) setSedanLights(false)
          else flashing = 1.4
          break
        case 'sedanLights':
          setSedanLights(true)
          break
        case 'sedanDark':
          setSedanLights(false)
          break
        case 'carLeave':
          carLeave(instant)
          break
        case 'carBack':
          car.position.copyFrom(parked)
          carBeam.intensity = 0
          for (const m of carLamps) m.emissiveColor = Color3.Black()
          break
        default:
          console.warn(`[yard] unknown event ${name}`)
      }
    },
    update(dt) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]
        tw.t += dt
        tw.apply(Math.min(1, tw.t / tw.dur))
        if (tw.t >= tw.dur) tweens.splice(i, 1)
      }
      // two quick flashes of the sedan's lights, then dark
      if (flashing > 0) {
        flashing -= dt
        const t = 1.4 - flashing
        setSedanLights(flashing > 0 && ((t > 0.05 && t < 0.4) || (t > 0.7 && t < 1.05)))
      }
    },
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
