import { Color3, Vector3 } from '@render/core'
import type { AbstractMesh, Material, Mesh, TransformNode } from '@render/core'
import { dust } from '@render/Effects'
import { LightingManager, TUNGSTEN, WARM } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import * as D from '@render/Dressing'
import { SetBuilder } from '@render/SetBuilder'
import type { EnvContext, EnvironmentFactory, GameEnvironment } from './types'

// The Don's private training floor. 18 m × 24 m brick hall; the entrance is
// the double door at z = -12, the ring sits centre-right and heavy bags hang
// along the left wall. Over the front-right corner a steel viewing deck looks
// down on the ring: the Don's chair, his lamp and the house crest are up
// there, reached by an open steel stair along the right wall.

const W = 9
const L = 12
const H = 7
const RING = { x: 3.5, z: 3, size: 6.4, h: 0.72 }
const BAG_X = -6.4
const BAG_ZS = [-5, -2, 1, 4]
const RAIL_Y = 4.3
/** The viewing deck: its floor height and footprint. */
const DECK = { x0: 3.0, x1: 9.0, z0: -12, z1: -7.0, y: 2.83 }
/** The stair down from the deck's front edge, along the right wall. */
const STAIR = { x0: 7.7, x1: 8.78, steps: 14, run: 0.28 }
const STAIR_X = (STAIR.x0 + STAIR.x1) / 2
const STAIR_FOOT_Z = DECK.z1 + STAIR.steps * STAIR.run
/** Height of the stair at a given z (for marks on the steps). */
const stairY = (z: number) => DECK.y * (1 - (z - DECK.z1) / (STAIR_FOOT_Z - DECK.z1))
const CHAIR = { x: 5.5, z: -10.1, yaw: Math.atan2(RING.x - 5.5, RING.z + 10.1) }
const H_RING = RING.h

interface Bag {
  pivot: TransformNode
  angle: number
  vel: number
}

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'gym')
  const lit = new LightingManager(scene, quality)
  const tex = quality === 'high' ? 1024 : 512
  T.reseed(7)

  scene.fogMode = 2 // EXP2
  scene.fogDensity = 0.009
  scene.fogColor = new Color3(0.075, 0.068, 0.064)
  scene.clearColor.set(0.025, 0.03, 0.04, 1)

  // All tiers: tune existing PBR uniforms only; retain material sharing,
  // texture sizes, clear-coat features, geometry and render budgets.
  // ── Materials ───────────────────────────────────────────────────────────
  const floorMat = s.surface('gym_floor', 'concrete', [6, 8], '#b8b0a3')
  const matTex = s.track(T.rubberMat(scene, 512))
  const rubber = s.pbr('gym_mat', '#ffffff', { albedo: matTex, rough: 0.92, uv: [6, 8] })
  const wall = s.surface('gym_wall', 'brick', [9, 4.5], '#b9a38f')
  const wallSide = s.surface('gym_wall_side', 'brick', [12, 4.5], '#b9a38f')
  const dado = s.surface('gym_dado', 'concrete', [9, 0.8], '#59615a')
  const ceiling = s.pbr('gym_ceiling', '#141416', { rough: 0.95 })
  const steel = s.pbr('gym_steel', '#2a2c30', { rough: 0.57, metal: 0.2 })
  const blackSteel = s.pbr('gym_black_steel', '#0e0f11', { rough: 0.62, metal: 0.2 })
  const chrome = s.pbr('gym_chrome', '#c9c9c9', { rough: 0.2, metal: 1 })
  const ringCanvasTex = s.track(T.canvasCloth(scene, tex))
  const ringCanvas = s.pbr('ring_canvas', '#e5daca', { albedo: ringCanvasTex, rough: 0.85 })
  const apron = s.pbr('ring_apron', '#101421', { rough: 0.7 })
  const redPad = s.pbr('pad_red', '#7a141b', { rough: 0.6, clearCoat: 0.2 })
  const bluePad = s.pbr('pad_blue', '#122347', { rough: 0.58, clearCoat: 0.2 })
  const whitePad = s.pbr('pad_white', '#bdbab3', { rough: 0.5, clearCoat: 0.2 })
  const ropeRed = s.pbr('rope_red', '#8b1a20', { rough: 0.5 })
  const ropeWhite = s.pbr('rope_white', '#c8c5bd', { rough: 0.5 })
  const woodTex = s.track(T.wood(scene, 512, [64, 40, 24]))
  const wood = s.pbr('wood', '#ffffff', { albedo: woodTex, rough: 0.55, clearCoat: 0.3 })
  const benchPad = s.pbr('bench_pad', '#151517', { rough: 0.5, clearCoat: 0.2 })
  const lockerTex = s.track(T.lockerFront(scene, 256))
  const locker = s.pbr('locker', '#ffffff', { albedo: lockerTex, rough: 0.62, metal: 0.08 })
  const bannerMat = s.pbr('banner', '#ffffff', { albedo: s.track(T.banner(scene)), rough: 0.85 })
  bannerMat.backFaceCulling = false
  const rugMat = s.pbr('rug', '#ffffff', { albedo: s.track(T.rug(scene, 512)), rough: 0.95 })
  const windowMat = s.pbr('window_glass', '#35495b', { rough: 0.22, metal: 0.3, emissive: new Color3(0.035, 0.055, 0.08) })
  const bulbWarm = s.glow('bulb_warm', new Color3(1.35, 1.05, 0.68))
  const redLine = s.glow('red_line', new Color3(0.55, 0.04, 0.05))
  const glass = s.pbr('deck_glass', '#9fb2bf', { rough: 0.06, metal: 0.2 })
  glass.alpha = 0.14
  const doorGlow = s.glow('door_glow', new Color3(0.2, 0.21, 0.27))
  const lampShadeInner = s.glow('shade_inner', new Color3(0.9, 0.62, 0.35))

  // ── Shell ───────────────────────────────────────────────────────────────
  const floor = s.box('floor', [W * 2, 0.2, L * 2], [0, -0.1, 0], floorMat)
  floor.metadata = { walkable: true }
  s.box('mat_bags', [4.4, 0.03, 11.2], [-6.6, 0.015, -0.5], rubber)
  s.box('mat_ring', [8.6, 0.03, 8.6], [RING.x, 0.015, RING.z], rubber)
  s.box('ceiling', [W * 2, 0.2, L * 2], [0, H + 0.1, 0], ceiling)
  s.box('wall_back', [W * 2, H, 0.3], [0, H / 2, L + 0.15], wall)
  s.box('wall_left', [0.3, H, L * 2], [-W - 0.15, H / 2, 0], wallSide)
  s.box('wall_right', [0.3, H, L * 2], [W + 0.15, H / 2, 0], wallSide)
  // front wall with the doorway
  s.box('wall_front_l', [W - 1.4, H, 0.3], [-(W + 1.4) / 2, H / 2, -L - 0.15], wall)
  s.box('wall_front_r', [W - 1.4, H, 0.3], [(W + 1.4) / 2, H / 2, -L - 0.15], wall)
  s.box('wall_front_top', [2.8, H - 3.1, 0.3], [0, 3.1 + (H - 3.1) / 2, -L - 0.15], wall)
  s.box('door_frame_t', [3.1, 0.18, 0.4], [0, 3.1, -L - 0.1], blackSteel)
  s.box('door_frame_l', [0.16, 3.1, 0.4], [-1.48, 1.55, -L - 0.1], blackSteel)
  s.box('door_frame_r', [0.16, 3.1, 0.4], [1.48, 1.55, -L - 0.1], blackSteel)

  // Outside the door: the entrance corridor, brick and concrete under one
  // sconce, the glass street doors at its far end with the night beyond
  const CZ = -L - 2.25
  s.box('corridor_floor', [3.4, 0.1, 4.4], [0, -0.05, CZ], floorMat)
  for (const side of [-1, 1]) s.box(`corridor_wall_${side}`, [0.2, 3.4, 4.4], [side * 1.6, 1.7, CZ], wall)
  s.box('corridor_ceiling', [3.4, 0.2, 4.4], [0, 3.3, CZ], ceiling)
  s.box('corridor_end_l', [1.05, 3.4, 0.2], [-1.03, 1.7, -L - 4.45], wall)
  s.box('corridor_end_r', [1.05, 3.4, 0.2], [1.03, 1.7, -L - 4.45], wall)
  s.box('corridor_end_top', [1.0, 0.9, 0.2], [0, 2.95, -L - 4.45], wall)
  s.box('corridor_skirt_l', [0.06, 1.2, 4.4], [-1.48, 0.6, CZ], dado)
  s.box('corridor_skirt_r', [0.06, 1.2, 4.4], [1.48, 0.6, CZ], dado)
  // the street doors: steel frame, glass glowing with the street outside
  s.plane('corridor_glow', 1.0, 2.5, [0, 1.25, -L - 4.5], doorGlow, Math.PI)
  s.box('street_door_mid', [0.06, 2.5, 0.08], [0, 1.25, -L - 4.38], blackSteel)
  s.box('street_door_bar', [0.9, 0.05, 0.06], [0, 1.05, -L - 4.36], chrome)
  // a brass sconce on the left wall, its light on the wall and the floor
  const sconceGlow = s.glow('corridor_sconce', new Color3(1.3, 0.95, 0.6))
  s.box('corridor_sconce_back', [0.06, 0.34, 0.2], [-1.47, 2.1, CZ], blackSteel)
  s.box('corridor_sconce_lamp', [0.1, 0.26, 0.14], [-1.42, 2.1, CZ], sconceGlow)
  D.wallWash(s, null, 'corridor_sconce_wash', [-1.48, 2.2, CZ], 2.2, 2.6, WARM, 0.32, -Math.PI / 2)
  D.lightPool(s, null, 'corridor_pool', [-0.4, 0, CZ], 2.6, 3.2, WARM, 0.26)
  D.poster(s, 'corridor_notice', 3, [1.48, 1.75, CZ - 0.8], 0.7, 1.0, Math.PI / 2)
  D.poster(s, 'corridor_bill', 0, [1.48, 1.7, CZ + 0.6], 0.62, 0.9, Math.PI / 2)

  // Doors (hinged at the frame edges, swing into the hall)
  const hingeL = s.node('hinge_l', [-1.4, 0, -L + 0.02])
  const hingeR = s.node('hinge_r', [1.4, 0, -L + 0.02])
  s.box('door_l', [1.38, 3.0, 0.08], [0.69, 1.5, 0], blackSteel, hingeL)
  s.box('door_r', [1.38, 3.0, 0.08], [-0.69, 1.5, 0], blackSteel, hingeR)
  s.box('door_l_bar', [0.9, 0.05, 0.06], [0.75, 1.1, 0.07], chrome, hingeL)
  s.box('door_r_bar', [0.9, 0.05, 0.06], [-0.75, 1.1, 0.07], chrome, hingeR)
  s.box('door_l_win', [0.36, 0.5, 0.09], [0.69, 2.2, 0], doorGlow, hingeL)
  s.box('door_r_win', [0.36, 0.5, 0.09], [-0.69, 2.2, 0], doorGlow, hingeR)

  // Steel trusses and ducts
  for (let z = -10; z <= 10; z += 4) s.box(`truss_${z}`, [W * 2, 0.35, 0.18], [0, H - 0.3, z], steel)
  s.box('rail_bags', [0.16, 0.2, 11.5], [BAG_X, RAIL_Y, -0.5], steel)
  for (const z of [-6, 0, 5.2]) s.rod(`rail_hanger_${z}`, [BAG_X, RAIL_Y, z], [BAG_X, H - 0.4, z], 0.05, steel)
  s.cyl('duct', 0.7, L * 2, [W - 1.2, H - 0.9, 0], steel, { tess: 18 }).rotation.x = Math.PI / 2
  s.cyl('pipe', 0.12, L * 2, [-W + 0.5, H - 1.3, 0], blackSteel, { tess: 10 }).rotation.x = Math.PI / 2

  // Steel-framed glazing with actual reveals, sills and mullions.
  const addWindow = (name: string, pos: [number, number, number], width: number, height: number, yaw = 0) => {
    const n = s.node(name, pos)
    n.rotation.y = yaw
    s.box(`${name}_reveal`, [width + 0.22, height + 0.22, 0.16], [0, 0, 0], blackSteel, n)
    s.box(`${name}_glass`, [width, height, 0.04], [0, 0, -0.1], windowMat, n)
    for (let i = 1; i < 5; i++) s.box(`${name}_mullion_${i}`, [0.045, height, 0.09], [-width / 2 + i * width / 5, 0, -0.16], steel, n)
    for (const y of [-height / 6, height / 6]) s.box(`${name}_rail_${y}`, [width, 0.045, 0.09], [0, y, -0.16], steel, n)
    s.box(`${name}_sill`, [width + 0.34, 0.12, 0.4], [0, -height / 2 - 0.08, -0.06], steel, n)
  }
  for (const x of [-5.4, 0, 5.4]) addWindow(`window_back_${x}`, [x, 4.9, L - 0.07], 3.4, 2.6)
  for (const z of [-8, 8]) addWindow(`window_left_${z}`, [-W + 0.07, 5.1, z], 2.6, 2.2, -Math.PI / 2)
  s.box('dado_back', [W * 2, 1.35, 0.06], [0, 0.675, L - 0.04], dado)
  for (const side of [-1, 1]) {
    s.box(`dado_${side}`, [0.06, 1.35, L * 2], [side * (W - 0.04), 0.675, 0], dado)
    s.box(`skirting_${side}`, [0.09, 0.18, L * 2], [side * (W - 0.08), 0.09, 0], blackSteel)
    for (const z of [-10, -4, 2, 8]) {
      s.box(`pilaster_${side}_${z}`, [0.22, H, 0.24], [side * (W - 0.1), H / 2, z], steel)
      s.box(`column_foot_${side}_${z}`, [0.32, 0.14, 0.36], [side * (W - 0.15), 0.07, z], blackSteel)
    }
  }

  // Banners with the family crest
  for (const z of [-7.5, 2.5]) s.plane(`banner_l_${z}`, 1.5, 3, [-W + 0.08, 4.5, z], bannerMat, -Math.PI / 2)
  for (const x of [-2.7, 2.7]) s.plane(`banner_b_${x}`, 1.6, 3.2, [x, 4.3, L - 0.08], bannerMat, 0)

  // ── Ring ────────────────────────────────────────────────────────────────
  const rs = RING.size
  s.box('ring_base', [rs, RING.h, rs], [RING.x, RING.h / 2, RING.z], apron)
  s.box('ring_canvas', [rs + 0.25, 0.04, rs + 0.25], [RING.x, RING.h + 0.02, RING.z], ringCanvas)
  const corners: [number, number, Material][] = [
    [RING.x - rs / 2, RING.z - rs / 2, redPad],
    [RING.x + rs / 2, RING.z + rs / 2, bluePad],
    [RING.x - rs / 2, RING.z + rs / 2, whitePad],
    [RING.x + rs / 2, RING.z - rs / 2, whitePad],
  ]
  for (const [x, z, pad] of corners) {
    s.cyl(`post_${x}_${z}`, 0.12, 1.55, [x, RING.h + 0.78, z], chrome)
    s.cyl(`pad_${x}_${z}`, 0.25, 1.25, [x, RING.h + 0.82, z], pad, { tess: 24 })
  }
  const ropeY = [0.3, 0.6, 0.9, 1.2].map((y) => RING.h + y)
  const ropeMats = [ropeRed, ropeWhite, ropeWhite, ropeRed]
  for (let i = 0; i < 4; i++) {
    const [ax, az] = corners[[0, 3, 1, 2][i]]
    const [bx, bz] = corners[[3, 1, 2, 0][i]]
    ropeY.forEach((y, k) => {
      for (let segment = 0; segment < 6; segment++) {
        const point = (t: number): [number, number, number] => [ax + (bx - ax) * t, y - Math.sin(t * Math.PI) * 0.045, az + (bz - az) * t]
        s.rod(`rope_${i}_${k}_${segment}`, point(segment / 6), point((segment + 1) / 6), 0.045, ropeMats[k])
      }
    })
    for (const t of [0.33, 0.67]) s.box(`rope_spacer_${i}_${t}`, [0.035, 0.94, 0.035], [ax + (bx - ax) * t, RING.h + 0.73, az + (bz - az) * t], ropeWhite)
  }
  s.box('ring_steps', [1.1, 0.35, 0.6], [RING.x - rs / 2 + 0.7, 0.175, RING.z - rs / 2 - 0.55], steel)
  s.box('ring_steps_2', [1.1, 0.35, 0.3], [RING.x - rs / 2 + 0.7, 0.525, RING.z - rs / 2 - 0.4], steel)

  // ── Heavy bags ──────────────────────────────────────────────────────────
  const bags: Bag[] = []
  for (const [i, z] of BAG_ZS.entries()) {
    const pivot = s.node(`bag_pivot_${i}`, [BAG_X, RAIL_Y, z])
    const top = -2.35
    await s.model('heavy_bag', `bag_${i}`, [0, top - 0.575, 0], i * 0.7, [1, 1, 1], pivot)
    s.rod(`bag_line_${i}`, [0, top + 0.365, 0], [0, 0, 0], 0.016, chrome, pivot)
    bags.push({ pivot, angle: 0, vel: (Math.random() - 0.5) * 0.04 })
  }

  // ── Benches, lockers, weights ───────────────────────────────────────────
  const bench = (name: string, x: number, z: number, rot = 0) => {
    const n = s.node(name, [x, 0, z])
    n.rotation.y = rot
    s.box(`${name}_pad`, [1.7, 0.1, 0.4], [0, 0.44, 0], benchPad, n)
    s.box(`${name}_frame`, [1.6, 0.05, 0.3], [0, 0.37, 0], blackSteel, n)
    for (const sx of [-0.7, 0.7]) s.box(`${name}_leg_${sx}`, [0.06, 0.37, 0.32], [sx, 0.185, 0], blackSteel, n)
  }
  bench('bench_a', -3.6, -8.62)
  bench('bench_b', 7.6, 7.5, Math.PI / 2)
  for (let i = 0; i < 9; i++) {
    const z = -1.6 + i * 1.15
    s.box(`locker_${i}`, [0.55, 2.1, 1.1], [W - 0.32, 1.05, z], locker).rotation.y = Math.PI / 2
  }
  // dumbbell rack
  s.box('rack', [2.6, 0.08, 0.6], [-7.2, 0.8, 10.6], blackSteel)
  s.box('rack_lower', [2.6, 0.08, 0.6], [-7.2, 0.4, 10.6], blackSteel)
  for (const x of [-8.35, -6.05]) s.box(`rack_leg_${x}`, [0.06, 0.85, 0.6], [x, 0.425, 10.6], blackSteel)
  for (let i = 0; i < 8; i++) {
    const x = -8.3 + i * 0.32
    for (const y of [0.92, 0.52]) {
      s.rod(`db_grip_${i}_${y}`, [x, y, 10.4], [x, y, 10.8], 0.032, chrome)
      for (const z of [10.42, 10.78]) s.cyl(`db_weight_${i}_${y}_${z}`, 0.17 + i * 0.008, 0.1, [x, y, z], blackSteel, { tess: 12 }).rotation.x = Math.PI / 2
    }
  }
  s.box('plate_tree', [0.1, 1.3, 0.1], [-4.8, 0.65, 10.9], blackSteel)
  for (let i = 0; i < 4; i++) s.cyl(`plate_${i}`, 0.45 - i * 0.05, 0.05, [-4.8, 0.3 + i * 0.25, 10.75], blackSteel, { tess: 24 }).rotation.x = Math.PI / 2

  // ── The viewing deck ────────────────────────────────────────────────────
  const dw = DECK.x1 - DECK.x0
  const dd = DECK.z1 - DECK.z0
  const dcx = (DECK.x0 + DECK.x1) / 2
  const dcz = (DECK.z0 + DECK.z1) / 2
  s.box('deck_slab', [dw, 0.3, dd], [dcx, DECK.y - 0.18, dcz], blackSteel)
  s.box('deck_floor', [dw - 0.04, 0.03, dd - 0.04], [dcx, DECK.y - 0.015, dcz], wood)
  // fascia beams with a thin red line under the edge
  s.box('deck_fascia_f', [dw + 0.1, 0.5, 0.18], [dcx + 0.05, DECK.y - 0.27, DECK.z1 + 0.02], steel)
  s.box('deck_fascia_s', [0.18, 0.5, dd], [DECK.x0 - 0.02, DECK.y - 0.27, dcz], steel)
  s.box('deck_red_f', [dw + 0.1, 0.035, 0.035], [dcx + 0.05, DECK.y - 0.53, DECK.z1 + 0.1], redLine)
  s.box('deck_red_s', [0.035, 0.035, dd], [DECK.x0 - 0.1, DECK.y - 0.53, dcz], redLine)
  for (const [x, z] of [[DECK.x0 + 0.12, DECK.z1 + 0.12], [6.0, DECK.z1 + 0.12]]) s.box(`deck_column_${x}`, [0.22, DECK.y - 0.52, 0.22], [x, (DECK.y - 0.52) / 2, z], steel)
  // downlights under the slab
  for (const x of [4.4, 7.4]) s.cyl(`deck_downlight_${x}`, 0.2, 0.03, [x, DECK.y - 0.34, -9.6], bulbWarm)
  // glass balustrade on the open sides, steel posts and a top rail
  const railTop = DECK.y + 1.05
  const frontW = STAIR.x0 - 0.06 - DECK.x0
  s.box('deck_glass_f', [frontW, 0.95, 0.025], [DECK.x0 + frontW / 2, DECK.y + 0.52, DECK.z1 + 0.06], glass)
  s.box('deck_glass_s', [0.025, 0.95, dd], [DECK.x0 + 0.06, DECK.y + 0.52, dcz], glass)
  s.box('deck_rail_f', [frontW + 0.05, 0.06, 0.08], [DECK.x0 + frontW / 2, railTop, DECK.z1 + 0.06], chrome)
  s.box('deck_rail_s', [0.08, 0.06, dd], [DECK.x0 + 0.06, railTop, dcz], chrome)
  for (let i = 0; i <= 4; i++) s.box(`deck_post_f_${i}`, [0.05, 1.05, 0.05], [DECK.x0 + (frontW * i) / 4 + (i === 0 ? 0.06 : 0), DECK.y + 0.52, DECK.z1 + 0.06], steel)
  for (let i = 1; i <= 4; i++) s.box(`deck_post_s_${i}`, [0.05, 1.05, 0.05], [DECK.x0 + 0.06, DECK.y + 0.52, DECK.z1 - (dd * i) / 4], steel)
  // the house crest on the wall behind the Don's chair
  s.plane('deck_banner', 1.6, 3.0, [5.6, DECK.y + 2.0, DECK.z0 + 0.09], bannerMat, Math.PI)
  for (const x of [3.9, 7.3]) {
    s.box(`deck_sconce_${x}`, [0.18, 0.32, 0.1], [x, DECK.y + 2.1, DECK.z0 + 0.06], blackSteel)
    s.box(`deck_sconce_glow_${x}`, [0.12, 0.24, 0.02], [x, DECK.y + 2.1, DECK.z0 + 0.115], lampShadeInner)
  }

  // the open steel stair down the right wall: floating treads on tube stringers
  for (let i = 0; i < STAIR.steps - 1; i++) {
    const top = DECK.y * (1 - (i + 1) / STAIR.steps)
    s.box(`stair_tread_${i}`, [STAIR.x1 - STAIR.x0, 0.05, STAIR.run + 0.03], [STAIR_X, top - 0.025, DECK.z1 + (i + 0.5) * STAIR.run], blackSteel)
  }
  for (const x of [STAIR.x0 + 0.04, STAIR.x1 - 0.04]) s.rod(`stair_stringer_${x}`, [x, DECK.y - 0.12, DECK.z1], [x, -0.05, STAIR_FOOT_Z], 0.09, steel)
  // handrails: posts on the open side, a wall rail on the other
  const rail = (x: number, name: string) => s.rod(name, [x, DECK.y + 0.95, DECK.z1 + 0.05], [x, 0.95, STAIR_FOOT_Z], 0.045, chrome)
  rail(STAIR.x0 + 0.03, 'stair_rail_open')
  rail(STAIR.x1 + 0.12, 'stair_rail_wall')
  for (let i = 1; i < STAIR.steps; i += 3) {
    const z = DECK.z1 + i * STAIR.run
    s.rod(`stair_post_${i}`, [STAIR.x0 + 0.03, stairY(z), z], [STAIR.x0 + 0.03, stairY(z) + 0.95, z], 0.035, steel)
  }

  // The Don's corner on the deck: rug, leather chair, side table and lamp, all facing the ring
  const corner = s.node('don_corner', [CHAIR.x, DECK.y, CHAIR.z])
  corner.rotation.y = CHAIR.yaw
  s.plane('rug', 3.0, 2.3, [0, 0.006, -0.2], rugMat, 0, corner).rotation.x = Math.PI / 2
  // The model faces +Z like the cast; its seat sits under the measured seated hip (0.35 m behind the root)
  await s.model('club_chair', 'chair', [0, 0, -0.42], 0, [1, 1, 1], corner)
  const table = s.node('side_table', [1.05, 0, -0.35], corner)
  s.cyl('table_top', 0.6, 0.04, [0, 0.62, 0], wood, { parent: table, tess: 24 })
  s.cyl('table_leg', 0.08, 0.6, [0, 0.3, 0], blackSteel, { parent: table })
  s.cyl('lamp_base', 0.12, 0.3, [0.08, 0.79, 0], chrome, { parent: table })
  s.cyl('lamp_shade', 0.34, 0.26, [0.08, 1.05, 0], lampShadeInner, { top: 0.22, parent: table, cap: false })
  s.cyl('glass', 0.07, 0.09, [-0.15, 0.685, 0.08], s.pbr('glass', '#c8a46a', { rough: 0.1 }), { parent: table })

  // under the deck: a row of lockers against the front wall and a bench
  for (let i = 0; i < 5; i++) s.box(`deck_locker_${i}`, [0.62, 2.1, 0.5], [4.0 + i * 0.64, 1.05, DECK.z0 + 0.27], locker)
  bench('bench_c', 5.3, -10.55)

  // ── Wall dressing ───────────────────────────────────────────────────────
  // fight bills on the brick; the club's name in red neon over the door
  const bills: [number, [number, number, number], number, number, number][] = [
    [0, [-4.4, 2.05, -L + 0.03], 0.8, 1.15, Math.PI],
    [1, [-5.5, 1.95, -L + 0.03], 0.72, 1.05, Math.PI],
    [2, [2.3, 1.95, -L + 0.03], 0.72, 1.05, Math.PI],
    [4, [-W + 0.03, 2.1, -9.6], 0.8, 1.15, -Math.PI / 2],
    [0, [-W + 0.03, 2.0, -3.5], 0.72, 1.05, -Math.PI / 2],
    [1, [-W + 0.03, 2.05, 5.8], 0.8, 1.15, -Math.PI / 2],
    [3, [W - 0.03, 2.05, 10.2], 0.8, 1.15, Math.PI / 2],
    [2, [W - 0.03, 2.75, 3.0], 0.7, 1.0, Math.PI / 2],
    [4, [-4.2, 2.2, L - 0.1], 0.8, 1.15, 0],
    [3, [-0.6, 2.15, L - 0.1], 0.72, 1.05, 0],
    [1, [4.4, 2.2, L - 0.1], 0.8, 1.15, 0],
  ]
  bills.forEach(([kind, pos, w, h, rot], i) => D.poster(s, `bill_${i}`, kind, pos, w, h, rot))
  D.neon(s, null, 'hall_neon', ['DOWNTOWN BOXING'], [0, 4.15, -L + 0.06], 3.6, 0.62, new Color3(1, 0.16, 0.2), { rotY: Math.PI })

  // ── Lamps ───────────────────────────────────────────────────────────────
  const ambient = lit.hemi(0.85, new Color3(0.71, 0.7, 0.72), new Color3(0.27, 0.23, 0.2))
  ambient.direction.set(-0.35, 1, 0.4)
  lit.enableGlow(0.22)
  const hanging = (name: string, x: number, z: number) => {
    const y = 5.35
    s.rod(`${name}_cord`, [x, H, z], [x, y + 0.3, z], 0.02, blackSteel)
    s.cyl(`${name}_shade`, 0.9, 0.42, [x, y + 0.1, z], blackSteel, { top: 0.25, cap: false })
    s.sphere(`${name}_bulb`, 0.2, [x, y - 0.02, z], bulbWarm)
    return new Vector3(x, y - 0.1, z)
  }
  const pRing = hanging('lamp_ring', RING.x, RING.z)
  const pBags = hanging('lamp_bags', -5.5, -1.2)
  const pDoor = hanging('lamp_door', 0, -7.4)
  hanging('lamp_bags2', -5.5, 3.8)
  hanging('lamp_lockers', 6.8, 6.5)
  // each lamp's halo, and its light lying on the floor (the two without a spot of their own)
  for (const [x, z] of [[RING.x, RING.z], [-5.5, -1.2], [0, -7.4], [-5.5, 3.8], [6.8, 6.5]] as const)
    D.halo(s, null, `lamp_halo_${x}_${z}`, [x, 5.3, z], 1.3, new Color3(1, 0.8, 0.55), 0.45)
  D.lightPool(s, null, 'pool_bags2', [-5.5, 0.03, 3.8], 4.2, 4.2, WARM, 0.3)
  D.lightPool(s, null, 'pool_lockers', [6.8, 0, 6.5], 4.4, 4.4, WARM, 0.3)
  D.lightPool(s, null, 'pool_door', [0, 0, -7.4], 4.6, 4.6, WARM, 0.18)

  const down = new Vector3(0, -1, 0)
  lit.spot('spot_ring', pRing, down, 1.6, 165, WARM, 14)
  lit.spot('spot_bags', pBags, new Vector3(-0.15, -1, 0), 1.5, 200, WARM, 14)
  lit.spot('spot_door', pDoor, down, 1.6, 150, WARM, 13)
  // Wide overhead key that casts the room's shadows
  const key = lit.spot('spot_key', new Vector3(-3, H - 0.4, -5), new Vector3(0.35, -1, 0.45), 2.5, 115, new Color3(0.86, 0.91, 1), 28)
  lit.enableShadows(key)
  // the deck: the Don's lamp and a warm overhead so he reads from the floor
  lit.point('don_lamp', new Vector3(CHAIR.x + 0.9, DECK.y + 1.15, CHAIR.z - 0.2), 5, TUNGSTEN, 5)
  lit.point('deck_light', new Vector3(5.6, DECK.y + 2.4, -8.6), 16, TUNGSTEN, 7)
  // a warm wash on the stair so the climb reads from the floor
  lit.point('stair_light', new Vector3(STAIR_X - 0.6, 2.2, -4.6), 7, WARM, 5)
  const doorLight = lit.spot('door_light', new Vector3(0, 2.9, -L - 3), new Vector3(0, -0.28, 1), 1.0, 0, new Color3(0.75, 0.82, 1), 16)
  // Big emissive planes read through bloom alone; the glow layer would blow them out
  for (const m of s.meshes) if (/^(window_|corridor_glow|door_[lr]_win|deck_red|corridor_sconce_lamp)/.test(m.name)) lit.glow?.addExcludedMesh(m as Mesh)

  // Dust and distance fog carry the atmosphere without visible cone surfaces.
  s.track(dust(scene, quality, new Vector3(-8, 0.4, -9), new Vector3(8, 5, 8)))

  for (const m of s.meshes) if (/^(bag_|chair|post_|pad_|locker|ring_|bench|door_[lr]$|deck_slab|deck_fascia|deck_column|stair_)/.test(m.name)) lit.castShadow(m)
  lit.raiseLightLimit(s.materials)
  D.mergeDressing(s)
  lit.bakeProbe(new Vector3(0, 2.2, -2), s.meshes.filter((m) => !m.name.startsWith('cone')), 0.55)
  s.freezeStatic([hingeL, hingeR, ...bags.map((b) => b.pivot)], { merge: true })

  // ── Scripted events ─────────────────────────────────────────────────────
  type Tween = { t: number; dur: number; apply: (k: number) => void; done?: () => void }
  const tweens: Tween[] = []
  const tween = (dur: number, apply: (k: number) => void, instant = false, done?: () => void) => {
    if (instant || dur <= 0) {
      apply(1)
      done?.()
    } else tweens.push({ t: 0, dur, apply, done })
  }
  const setDoors = (open: boolean, instant: boolean) => {
    const fromL = hingeL.rotation.y
    const fromR = hingeR.rotation.y
    const toL = open ? 1.75 : 0
    const toR = open ? -1.75 : 0
    const fromI = doorLight.intensity
    const toI = open ? 90 : 0
    tween(open ? 1.4 : 0.9, (k) => {
      const e = open ? 1 - (1 - k) ** 3 : k * k
      hingeL.rotation.y = fromL + (toL - fromL) * e
      hingeR.rotation.y = fromR + (toR - fromR) * e
      doorLight.intensity = fromI + (toI - fromI) * e
    }, instant)
  }

  // a trainee working the far bag keeps it swinging
  let bagWork = false
  let bagClock = 0

  const env: GameEnvironment = {
    id: 'gym',
    marks: {
      // the entrance
      door_out: [0, -13.6],
      door_in: [0, -11.2],
      entry: [0.25, -8.4],
      // Ravi waits between the door and the ring
      ravi: [0.68, -3.64],
      rookie_ravi: [-0.28, -4.36],
      // Rookie's bag, the second from the door, under the lamp; where he puts his gym bag down on the way
      bag1: [BAG_X, -2],
      bag1_rookie: [-5.62, -2],
      kit_drop: [-4.3, -3.55],
      // the next bag along, for the trainee who would otherwise be on Rookie's
      bag3: [BAG_X, 1],
      bag3_trainee: [-5.62, 1],
      // Ravi comes over to him there; Marco warms up on the open floor nearby
      ravi_bag: [-4.85, -1.0],
      marco_warm: [-2.3, 1.8],
      // where Marco stops, a pace in front of Rookie at his bag
      marco_front: [-4.55, -2.15],
      // the far bag and the trainees' spots on the floor
      bag4: [BAG_X, 4],
      bag4_trainee: [-5.62, 4],
      bag2: [BAG_X, -2],
      bag2_trainee: [-5.62, -2],
      // in the ring (canvas height): Rookie, and where each opponent waits and engages
      ring_rookie: [3.0, 2.4, H_RING],
      f1_wait: [5.75, 5.25, H_RING],
      f1_fight: [3.75, 3.05, H_RING],
      f2_wait: [0.95, 5.55, H_RING],
      f2_fight: [2.32, 3.18, H_RING],
      m_wait: [0.95, 0.6, H_RING],
      // a sparring pair in the ring, a metre apart like Rookie and Marco, so their punches land
      spar_a: [3.53, 3.07, H_RING],
      spar_b: [2.54, 3.16, H_RING],
      m_fight: [2.45, 1.55, H_RING],
      ring_edge: [2.15, 0.35, H_RING],
      // ringside: Ravi and the trainees watch from the sides (clear of the fight cameras),
      // then Ravi comes round to the front ropes; the bodyguard's stop
      ravi_watch: [-0.4, 1.0],
      ravi_rail: [1.2, -0.75],
      rail_left: [-0.4, 3.9],
      rail_right: [7.15, 1.6],
      // more of the gym gathered on the near side of the ring, behind the fighters from the fight camera
      crowd_l: [-0.85, 2.55],
      crowd_back: [-1.3, 3.1],
      // the steps down out of the ring
      ring_exit: [0.95, -1.05],
      // after the fight, on the floor at the foot of the ring steps: Ravi waits, Rookie comes down to him
      ravi_floor: [0.5, -2.3],
      rookie_floor: [1.7, -1.95],
      guard_ring: [3.15, -0.8],
      // where Rookie is when the next shot picks him up, out of the ring and heading for the stair
      ring_out: [7.0, -2.0],
      // the stair and the deck (deck height)
      stair_foot: [STAIR_X, STAIR_FOOT_Z + 0.5],
      stair_mid: [STAIR_X, -5.3, stairY(-5.3)],
      deck_landing: [STAIR_X, DECK.z1 - 0.55, DECK.y],
      don_rail: [5.25, DECK.z1 - 0.55, DECK.y],
      don_close: [5.65, DECK.z1 - 0.85, DECK.y],
      rookie_deck: [6.55, DECK.z1 - 1.3, DECK.y],
      guard_deck_l: [3.85, -10.95, DECK.y],
      guard_deck_r: [7.15, -11.0, DECK.y],
      // the Don's two men either side of him at the glass
      guard_side_l: [4.4, -8.0, DECK.y],
      guard_side_r: [6.1, -8.0, DECK.y],
      // inside the doors at the end of the night
      exit_rookie: [0.45, -9.15],
      exit_ravi: [-0.75, -8.45],
      // look targets
      ring_centre: [RING.x, RING.z, 1.6],
      crest: [5.6, DECK.z0, DECK.y + 2.0],
    },
    shots: {
      // the bag line from the open floor: his bag down beside him, the bags running away to the back wall
      bags_wide: { pos: [-1.75, 1.7, -7.2], target: [-5.3, 1.15, -2.3], fov: 0.8, handheld: 0 },
      // square to Rookie at the bag and Ravi beside him, the bag line and the wall behind
      bag_talk: { pos: [-0.9, 1.6, -4.89], target: [-5.24, 1.45, -1.5], fov: 0.66, handheld: 0 },
      // Marco squares up to Rookie at the bag line: side-on to the pair, Lucas between them behind
      marco_talk: { pos: [-5.0, 1.6, -5.7], target: [-5.05, 1.35, -1.7], fov: 0.68, handheld: 0 },
      // Rookie squares up to Marco by his warm-up spot, the ring behind them
      warm_talk: { pos: [-0.4, 1.6, -2.6], target: [-2.8, 1.35, 1.3], fov: 0.64, handheld: 0 },
      // from behind Rookie and Ravi: Marco on the open floor between the bags and the ring
      marco_look: { pos: [-5.6, 1.7, -3.2], target: [-2.3, 1.35, 1.8], fov: 0.62, handheld: 0 },
      // Rookie and Ravi just inside the doors, leaving
      door_talk: { pos: [1.95, 1.6, -5.2], target: [-0.15, 1.45, -8.8], fov: 0.72, handheld: 0 },
      // from the far side of the ring: Rookie in it, the gym gathered at the near ropes behind him
      crowd_view: { pos: [6.6, 3.2, 2.3], target: [-0.6, 1.35, 2.3], fov: 0.6, handheld: 0 },
      // the Don and his two men at the glass, from out over the floor
      deck_trio: { pos: [5.25, 4.15, -1.3], target: [5.25, 3.9, -7.9], fov: 0.78, handheld: 0 },
      // over the boss's shoulder from behind him on the deck: Rookie crossing the floor below
      deck_down: { pos: [7.5, 5.35, -10.6], target: [-0.4, 0.9, -2.7], fov: 0.62, handheld: 0 },
      // from mid-floor toward the doors: he walks in toward the camera; the deck is up on the left
      entry_wide: { pos: [-1.6, 1.7, -1.2], target: [0, 1.5, -9.5], fov: 0.7, handheld: 0 },
      // Ravi and Rookie side by side in profile, the deck (and the Don) up behind them
      talk_ravi: { pos: [-2.3, 1.55, -0.64], target: [0.2, 1.8, -4.0], fov: 0.64, handheld: 0 },
      // from the floor up to the deck: the Don at the glass, watching
      don_watch: { pos: [0.2, 1.5, -2.4], target: [5.25, 3.7, -7.55], fov: 0.62, handheld: 0 },
      // the fight: a high master from the front-left corner; for each exchange a camera
      // square to the two fighters, so both stay in frame; the Don's view past his shoulder
      ring_wide: { pos: [-1.2, 3.0, -3.4], target: [3.2, 1.35, 2.6], fov: 0.82, handheld: 0 },
      ring_e1: { pos: [6.4, 2.3, -0.75], target: [3.38, 1.5, 2.73], fov: 0.8, handheld: 0 },
      ring_e2: { pos: [6.25, 2.3, 5.95], target: [2.66, 1.5, 2.79], fov: 0.8, handheld: 0 },
      ring_e3: { pos: [6.63, 2.3, -0.55], target: [2.72, 1.5, 1.98], fov: 0.8, handheld: 0 },
      deck_pov: { pos: [5.9, 4.6, -8.9], target: [3.3, 1.4, 2.5], fov: 0.56, handheld: 0 },
      // after the fight: Rookie at the ropes, Ravi and the bodyguard either side of him below
      rail_wide: { pos: [2.15, 1.6, -5.4], target: [2.15, 1.55, -0.4], fov: 0.78, handheld: 0 },
      // the same angle for the dialogue there (the scene panel is shorter while a line is up)
      rail_talk: { pos: [2.15, 1.6, -5.4], target: [2.15, 1.6, -0.4], fov: 0.68, handheld: 0 },
      // after the fight, from the floor toward the ring: Rookie climbs down the steps to Ravi, and they talk there
      floor_talk: { pos: [0.9, 1.6, -5.8], target: [1.0, 1.35, -1.2], fov: 0.72, handheld: 0 },
      // up on the deck: the Don and the man he signals
      deck_watch: { pos: [4.55, 4.25, -2.6], target: [4.75, 3.85, -9.0], fov: 0.74, handheld: 0 },
      // the walk to the stair and up its first flight; the climb onto the deck
      to_stairs: { pos: [0.0, 2.0, -0.6], target: [7.3, 2.3, -3.3], fov: 0.78, handheld: 0 },
      // from over the gym floor: the top of the stair on the right, the Don at the glass on the left
      deck_arrive: { pos: [6.8, 4.6, 0.5], target: [6.7, 3.7, -7.6], fov: 0.78, handheld: 0 },
      // the Don and Rookie on the deck, square to the two of them: Rookie left, the Don right, the crest behind
      deck_talk: { pos: [8.15, 4.15, -4.0], target: [5.9, 3.95, -7.93], fov: 0.6, handheld: 0 },
    },
    bounds: { minX: -8.3, maxX: 8.0, minZ: -11.0, maxZ: 11.0 },
    obstacles: [
      [RING.x - rs / 2 - 0.35, RING.z - rs / 2 - 0.35, RING.x + rs / 2 + 0.35, RING.z + rs / 2 + 0.35],
      [BAG_X - 0.45, -5.5, BAG_X + 0.45, 4.5],
      [-4.6, -8.95, -2.6, -8.3],
      [8.2, -2.4, 9, 9.4],
      [-8.7, 10.2, -5.7, 11.2],
      // the stair's footprint, the deck's columns and the lockers under it
      [STAIR.x0 - 0.15, DECK.z1, 9, STAIR_FOOT_Z],
      [DECK.x0 - 0.1, DECK.z1 - 0.1, DECK.x0 + 0.35, DECK.z1 + 0.35],
      [5.85, DECK.z1 - 0.1, 6.15, DECK.z1 + 0.35],
      [3.6, DECK.z0, 7.4, DECK.z0 + 0.6],
    ],
    followYaw: 0,
    cameraBox: { min: [-8.6, 0.35, -11.6], max: [8.6, 6.4, 11.6] },
    lighting: lit,
    walkable: [floor],
    event(name, instant = false) {
      switch (name) {
        case 'doorsOpen':
          setDoors(true, instant)
          break
        case 'doorsClose':
          setDoors(false, instant)
          break
        case 'bagWork':
          bagWork = true
          break
        case 'bagHit0':
        case 'bagHit1':
        case 'bagHit2':
        case 'bagHit3':
          // a punch landing on that bag (Rookie's is bag 1): it swings away from him
          bags[Number(name.slice(-1))].vel -= instant ? 0 : 0.2
          break
        default:
          console.warn(`[gym] unknown event ${name}`)
      }
    },
    update(dt) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]
        tw.t += dt
        tw.apply(Math.min(1, tw.t / tw.dur))
        if (tw.t >= tw.dur) {
          tweens.splice(i, 1)
          tw.done?.()
        }
      }
      // the worked bag takes a punch every second or so
      if (bagWork && (bagClock -= dt) <= 0) {
        bagClock = 0.7 + Math.random() * 0.6
        bags[3].vel -= 0.12 + Math.random() * 0.08
      }
      // Pendulum bags: 2.6 m effective length, light damping
      for (const b of bags) {
        b.vel += (-(9.81 / 2.6) * Math.sin(b.angle) - b.vel * 0.55) * dt
        b.angle += b.vel * dt
        b.pivot.rotation.z = b.angle
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
