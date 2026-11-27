import { Color3, DynamicTexture, Vector3 } from '@render/core'
import type { Material } from '@render/core'
import { dust } from '@render/Effects'
import * as I from '@render/InteriorTextures'
import { LightingManager, TUNGSTEN, WARM } from '@render/LightingManager'
import { SetBuilder } from '@render/SetBuilder'
import * as T from '@render/ProceduralTextures'
import * as D from '@render/Dressing'
import type { EnvironmentFactory } from './types'

// Mercer House on a sunny morning: an old rooming house, tired but lived in.
// The tiled entrance hall (z < 2) with its street door, mailboxes and the one
// landing light; Room Four behind the partition (x < 4, z > 2), Nico's room,
// left in a hurry; and the service passage (x > 4) with the stairs up.
//
// Ceilings are planes that face down: seen from inside they close the rooms,
// and the overhead search cameras look straight through them from above.

/** Warm morning sun through the glass. */
const SUN = new Color3(1, 0.86, 0.64)
const H = 3.5

const build: EnvironmentFactory = async ({ scene, quality }) => {
  const s = new SetBuilder(scene, 'mercer')
  const lit = new LightingManager(scene, quality)
  T.reseed(44)
  scene.fogMode = 0
  scene.clearColor.set(0.3, 0.25, 0.21, 1)

  // ── Materials ───────────────────────────────────────────────────────────
  const tex = <X extends { dispose(): void }>(x: X) => s.track(x)
  const roomPaper = s.pbr('room_paper', '#ffffff', { albedo: tex(I.wallpaper(scene, 'tex_room_paper', '#dcc6a0', '#c4a67a', '#9c6a4a')), rough: 0.9 })
  const hallPaper = s.pbr('hall_paper', '#ffffff', { albedo: tex(I.wallpaper(scene, 'tex_hall_paper', '#d3bd96', '#b8976c', '#8d5c3e')), rough: 0.9 })
  const roomPanel = s.pbr('room_panel', '#ffffff', { albedo: tex(I.panelling(scene, 'tex_room_panel', [150, 160, 124])), rough: 0.55 })
  const hallPanel = s.pbr('hall_panel', '#ffffff', { albedo: tex(I.panelling(scene, 'tex_hall_panel', [112, 74, 48])), rough: 0.5 })
  const boards = s.pbr('floorboards', '#ffffff', { albedo: tex(I.planks(scene, 'tex_mercer_planks', [168, 118, 74])), rough: 0.48, clearCoat: 0.25 })
  const tiles = s.pbr('hall_tiles', '#ffffff', { albedo: tex(checker(scene)), rough: 0.35, clearCoat: 0.3 })
  const ceilingMat = s.pbr('ceiling', '#d9cdb6', { rough: 0.95 })
  const trim = s.pbr('trim', '#e2d6bf', { rough: 0.5 })
  const wood = s.pbr('furniture_wood', '#ffffff', { albedo: tex(T.wood(scene, 256, [122, 80, 48])), rough: 0.5 })
  const darkWood = s.pbr('dark_wood', '#5a3b26', { rough: 0.45 })
  const drawerFront = s.pbr('drawer_front', '#7a5034', { rough: 0.45 })
  const boardWood = s.pbr('board_wood', '#9a7a55', { rough: 0.95 })
  const iron = s.pbr('iron', '#3b3530', { rough: 0.5, metal: 0.6 })
  const brass = s.pbr('brass', '#c7a05a', { rough: 0.28, metal: 1 })
  const chrome = s.pbr('chrome', '#d9dcdc', { rough: 0.15, metal: 1 })
  const ceramic = s.pbr('ceramic', '#f4f1ea', { rough: 0.2 })
  const sheet = s.pbr('sheet', '#f2ede2', { rough: 0.95 })
  const quilt = s.pbr('quilt', '#b5573f', { rough: 1 })
  const throwMat = s.pbr('throw', '#d9b46a', { rough: 1 })
  const curtain = s.pbr('curtain', '#b8703f', { rough: 1 })
  const shirt = s.pbr('shirt', '#6f8fb0', { rough: 1 })
  const leather = s.surface('bag_leather', 'leather', [1, 1], '#9a6038', 0.55)
  const paper = s.pbr('paper', '#ece2c4', { rough: 0.95 })
  const lampShade = s.glow('lamp_shade', new Color3(1, 0.78, 0.5))
  const rugMat = s.pbr('rug', '#ffffff', { albedo: tex(I.patternRug(scene, 'tex_mercer_rug', '#a8452f', '#2f3f5a', '#d9b06a')), rough: 0.95 })
  const runnerMat = s.pbr('runner', '#ffffff', { albedo: tex(I.patternRug(scene, 'tex_mercer_runner', '#7a2b24', '#3a2a22', '#c9995a')), rough: 0.95 })
  const doorMat = s.pbr('door_panels', '#ffffff', { albedo: tex(I.doorPanels(scene, 'tex_mercer_door', [214, 200, 172])), rough: 0.5 })
  const frontDoorMat = s.pbr('front_door_panels', '#ffffff', { albedo: tex(I.doorPanels(scene, 'tex_mercer_front', [52, 86, 70])), rough: 0.45 })
  const wardrobeDoor = s.pbr('wardrobe_door', '#ffffff', { albedo: tex(I.doorPanels(scene, 'tex_wardrobe', [134, 90, 56])), rough: 0.45 })
  const art = s.pbr('painting', '#ffffff', { albedo: tex(I.painting(scene, 'tex_mercer_painting')), rough: 0.7 })
  const pot = s.pbr('pot', '#b0603e', { rough: 0.8 })
  const leaf = s.pbr('leaf', '#5f8040', { rough: 0.8 })
  const bookCols = ['#7a2e26', '#2f4a63', '#b88a3a', '#3f5e3a', '#5a3a5e', '#c9b48a'].map((c, i) => s.pbr(`book_${i}`, c, { rough: 0.8 }))
  const view = s.glow('window_view', new Color3(1.15, 1.1, 1.05), tex(I.windowView(scene, 'tex_mercer_view')))
  const street = s.glow('street', new Color3(1, 0.93, 0.8))
  const sunGap = s.glow('sun_gap', new Color3(1, 0.88, 0.66))
  const bulb = s.glow('bulb', new Color3(1, 0.84, 0.58))
  const clockFace = s.glow('clock_face', new Color3(0.92, 0.9, 0.84))

  /** Box with world-sized UVs (floors, walls, furniture wood). */
  const tbox = (name: string, size: [number, number, number], pos: [number, number, number], mat: Material, tile = 1) => s.tileUV(s.box(name, size, pos, mat), tile)
  /** A papered wall with a panelled dado, dado rail, skirting, picture rail and coving on both faces. */
  const wall = (name: string, size: [number, number, number], pos: [number, number, number], hall = false) => {
    const thinX = size[0] < size[2]
    tbox(name, size, pos, hall ? hallPaper : roomPaper, 0.8)
    const span = (t: number, h: number): [number, number, number] => (thinX ? [size[0] + t, h, size[2]] : [size[0], h, size[2] + t])
    const low = Math.min(size[1], H)
    tbox(`${name}_dado`, span(0.04, 1.0), [pos[0], 0.5, pos[2]], hall ? hallPanel : roomPanel, 1)
    s.box(`${name}_rail`, span(0.1, 0.06), [pos[0], 1.03, pos[2]], trim)
    s.box(`${name}_skirting`, span(0.08, 0.16), [pos[0], 0.08, pos[2]], trim)
    s.box(`${name}_picture_rail`, span(0.06, 0.04), [pos[0], low - 0.45, pos[2]], trim)
    s.box(`${name}_coving`, span(0.14, 0.12), [pos[0], low - 0.06, pos[2]], trim)
  }
  /** A ceiling that faces down (invisible from above). */
  const ceiling = (name: string, x0: number, x1: number, z0: number, z1: number, y = H) => {
    const p = s.plane(name, x1 - x0, z1 - z0, [(x0 + x1) / 2, y, (z0 + z1) / 2], ceilingMat)
    p.rotation.x = -Math.PI / 2
    return p
  }
  /** A flat rug lying on the floor. */
  const rug = (name: string, w: number, d: number, x: number, z: number, mat: Material) => {
    const r = s.plane(name, w, d, [x, 0.012, z], mat)
    r.rotation.x = Math.PI / 2
    return r
  }

  // ── Shell ───────────────────────────────────────────────────────────────
  const hallFloor = tbox('hall_floor', [14, 0.2, 10], [0, -0.1, -3], tiles, 0.6)
  const floor = tbox('floor', [14, 0.2, 9.2], [0, -0.1, 6.6], boards, 1.1)
  hallFloor.metadata = floor.metadata = { walkable: true }
  wall('back_wall', [14, H, 0.2], [0, H / 2, 11.1])
  wall('side_w_hall', [0.2, H, 10], [-7.1, H / 2, -3], true)
  wall('side_w_room', [0.2, H, 9.2], [-7.1, H / 2, 6.5])
  wall('side_e_hall', [0.2, H, 10], [7.1, H / 2, -3], true)
  wall('side_e_room', [0.2, H, 9.2], [7.1, H / 2, 6.5])
  // the street door, open on a bright morning
  wall('front_l', [6.2, H, 0.2], [-3.9, H / 2, -8.1], true)
  wall('front_r', [6.2, H, 0.2], [3.9, H / 2, -8.1], true)
  tbox('front_top', [1.6, H - 2.5, 0.2], [0, 2.5 + (H - 2.5) / 2, -8.1], hallPaper, 0.8)
  s.plane('street_light', 1.8, 2.7, [0, 1.3, -8.45], street)
  s.box('street_step', [1.6, 0.06, 0.4], [0, 0.03, -8.2], darkWood)
  for (const x of [-0.84, 0.84]) s.box(`front_jamb_${x}`, [0.1, 2.5, 0.3], [x, 1.25, -8.1], trim)
  s.box('front_head', [1.78, 0.12, 0.3], [0, 2.52, -8.1], trim)
  const frontDoor = s.box('front_door', [0.06, 2.4, 1.5], [-0.8, 1.2, -7.3], frontDoorMat)
  frontDoor.rotation.y = 0.15
  // partition: hall | Room Four (door at x = 0) | service passage (opening at x 3.5–5.5)
  wall('partition_l', [5.5, H, 0.2], [-4.25, H / 2, 2])
  wall('partition_r', [2, H, 0.2], [2.5, H / 2, 2])
  wall('partition_end', [1.5, H, 0.2], [6.25, H / 2, 2])
  tbox('lintel', [3, H - 2.5, 0.2], [0, 2.5 + (H - 2.5) / 2, 2], roomPaper, 0.8)
  tbox('service_lintel', [2, H - 2.5, 0.2], [4.5, 2.5 + (H - 2.5) / 2, 2], roomPaper, 0.8)
  for (const x of [-1.5, 1.5, 3.5, 5.5]) s.box(`jamb_${x}`, [0.12, 2.5, 0.32], [x, 1.25, 2], trim)
  s.box('head_room', [3.15, 0.12, 0.32], [0, 2.52, 2], trim)
  s.box('head_service', [2.15, 0.12, 0.32], [4.5, 2.52, 2], trim)
  const door = s.box('ajar_door', [0.06, 2.4, 1.4], [-1.4, 1.2, 2.75], doorMat)
  door.rotation.y = -0.2
  s.sphere('door_knob', 0.08, [-1.3, 1.0, 3.3], brass)
  const serviceDoor = s.box('service_door', [0.06, 2.4, 1.0], [5.42, 1.2, 2.58], doorMat)
  serviceDoor.rotation.y = 0.05
  const plate = tex(T.sign(scene, 'mercer_room4', ['ROOM 4'], { fg: '#3a2a1c', bg: '#e8d6a8', accent: '#9a7a3a' }))
  s.plane('room4_plate', 0.6, 0.2, [0, 2.95, 1.88], s.pbr('room4_plate', '#ffffff', { albedo: plate, rough: 0.4, metal: 0.2 }))
  // Room Four and the passage beside it
  wall('passage_wall', [0.2, 6.5, 5.9], [3.95, 3.25, 8.15])
  ceiling('ceiling_hall', -7, 7, -8, 2)
  ceiling('ceiling_room', -7, 3.95, 2, 11)
  ceiling('ceiling_passage', 3.95, 7, 2, 5.2)
  // the stairwell rises past the ground floor ceiling
  ceiling('ceiling_stairwell', 3.95, 7, 5.2, 11, 6.5)
  tbox('stairwell_bulkhead', [3.05, 3, 0.2], [5.48, H + 1.5, 5.2], roomPaper, 0.8)
  tbox('stairwell_side', [0.2, 3, 6], [7.1, H + 1.5, 8.1], roomPaper, 0.8)
  tbox('stairwell_back', [3.05, 3, 0.2], [5.48, H + 1.5, 11.1], roomPaper, 0.8)

  // ── Windows ─────────────────────────────────────────────────────────────
  /** A sash window in a side wall (x = ±7): frame, sill, the sunny street; boards over some. */
  const window = (name: string, side: -1 | 1, z: number, boarded: 'none' | 'half' | 'full') => {
    const inX = side * 6.93
    s.plane(`${name}_glass`, 1.8, 1.6, [side * 6.98, 1.9, z], boarded === 'full' ? sunGap : view, (side * Math.PI) / 2)
    s.box(`${name}_sill`, [0.3, 0.06, 2.15], [side * 6.87, 1.07, z], trim)
    s.box(`${name}_head`, [0.16, 0.12, 2.05], [inX, 2.74, z], trim)
    for (const dz of [-0.96, 0.96]) s.box(`${name}_jamb_${dz}`, [0.16, 1.72, 0.12], [inX, 1.9, z + dz], trim)
    s.box(`${name}_meeting_rail`, [0.1, 0.07, 1.8], [inX, 1.92, z], trim)
    s.box(`${name}_bar`, [0.06, 1.6, 0.04], [inX, 1.9, z], trim)
    if (boarded === 'none') return
    const ys = boarded === 'full' ? [1.3, 1.62, 1.94, 2.26, 2.58] : [1.35, 1.72]
    for (const y of ys) s.box(`${name}_board_${y}`, [0.05, 0.26, 2.2], [side * 6.84, y, z + (T.rand() - 0.5) * 0.14], boardWood).rotation.x = (T.rand() - 0.5) * 0.06
  }
  /** Curtains with folds, gathered either side of a window, on a brass pole. */
  const curtains = (name: string, side: -1 | 1, z: number) => {
    for (const dz of [-1.25, 1.25])
      for (let f = 0; f < 4; f++) s.cyl(`curtain_${name}_${dz}_${f}`, 0.16, 2.4, [side * (6.86 - (f % 2) * 0.05), 1.6, z + dz + (f - 1.5) * 0.12], curtain, { tess: 8 })
    s.rod(`curtain_pole_${name}`, [side * 6.85, 2.85, z - 1.6], [side * 6.85, 2.85, z + 1.6], 0.04, brass)
  }
  window('hall_window_e', 1, -3.5, 'none')
  window('hall_window_w', -1, -5, 'full')
  window('room_window_a', -1, 4.5, 'full')
  window('room_window_b', -1, 8, 'half')
  curtains('hall_e', 1, -3.5)
  curtains('room_b', -1, 8)

  // ── Hall ────────────────────────────────────────────────────────────────
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) s.box(`mailbox_${r}_${c}`, [0.12, 0.3, 0.38], [6.92, 1.35 + r * 0.34, -6.6 + c * 0.42], brass)
  tbox('bench_seat', [0.5, 0.08, 1.6], [-6.65, 0.46, -2.5], wood, 0.6)
  tbox('bench_back', [0.08, 0.5, 1.6], [-6.92, 0.78, -2.5], wood, 0.6)
  for (const dz of [-0.7, 0.7]) s.box(`bench_leg_${dz}`, [0.42, 0.42, 0.06], [-6.65, 0.21, -2.5 + dz], iron)
  for (let i = 0; i < 9; i++) s.box(`radiator_${i}`, [0.12, 0.7, 0.07], [6.86, 0.5, -4.1 + i * 0.15], s.pbr('radiator', '#e9e2d2', { rough: 0.4 }))
  s.cyl('plant_pot', 0.5, 0.5, [-6.4, 0.25, -7.4], pot, { top: 0.6 })
  for (let i = 0; i < 5; i++) s.sphere(`plant_${i}`, 0.5 + T.rand() * 0.25, [-6.4 + (T.rand() - 0.5) * 0.4, 0.75 + T.rand() * 0.5, -7.4 + (T.rand() - 0.5) * 0.4], leaf)
  rug('hall_runner', 1.3, 7.5, 0, -4.2, runnerMat)
  const sign = tex(T.sign(scene, 'mercer_sign', ['MERCER HOUSE', 'NO UNAUTHORISED ENTRY'], { fg: '#3a2a1c', bg: '#efdfb6', accent: '#8a3b2c' }))
  s.plane('mercer_sign', 2.2, 0.64, [-4, 2.1, 1.88], s.pbr('sign', '#ffffff', { albedo: sign, rough: 0.6 }))
  // the one landing light that still works: a brass sconce by Room Four
  s.box('sconce_plate', [0.18, 0.28, 0.04], [-2.2, 2.4, 1.88], brass)
  s.sphere('sconce_bulb', 0.22, [-2.2, 2.45, 1.76], bulb)
  // a flush light in the hall ceiling (nothing hanging into the follow camera)
  s.cyl('hall_fitting', 0.6, 0.04, [0, H - 0.02, -3.5], brass)
  s.cyl('hall_bulb', 0.48, 0.1, [0, H - 0.08, -3.5], bulb)
  // a framed print and a coat rack
  s.box('hall_frame', [0.06, 0.7, 1.0], [-6.95, 1.85, -2.5], darkWood)
  s.plane('hall_print', 0.85, 0.55, [-6.91, 1.85, -2.5], art, -Math.PI / 2)
  s.box('coat_rack', [0.06, 0.12, 1.2], [6.95, 1.75, 0.6], darkWood)
  for (let i = 0; i < 4; i++) s.sphere(`coat_peg_${i}`, 0.06, [6.86, 1.75, 0.15 + i * 0.3], brass)
  s.box('hung_coat', [0.12, 0.9, 0.42], [6.86, 1.3, 0.45], s.pbr('hung_coat', '#7a5a3a', { rough: 1 }))

  // ── Room Four ───────────────────────────────────────────────────────────
  // Bed against the back wall under the half-boarded window
  tbox('bed_frame', [1.6, 0.32, 2.15], [-5.1, 0.28, 9.9], wood, 0.6)
  for (const x of [-5.85, -4.35]) for (const z of [8.88, 10.92]) s.box(`bed_leg_${x}_${z}`, [0.08, 0.14, 0.08], [x, 0.07, z], darkWood)
  tbox('headboard', [1.7, 1.25, 0.08], [-5.1, 0.75, 10.98], wood, 0.6)
  s.box('headboard_cap', [1.78, 0.06, 0.12], [-5.1, 1.4, 10.98], darkWood)
  tbox('footboard', [1.7, 0.7, 0.08], [-5.1, 0.45, 8.82], wood, 0.6)
  s.box('mattress', [1.5, 0.22, 2.0], [-5.1, 0.55, 9.92], sheet)
  // the quilt thrown back, hanging over one side
  s.box('quilt', [1.56, 0.07, 1.25], [-5.1, 0.69, 9.25], quilt).rotation.y = 0.06
  s.box('quilt_drop', [0.05, 0.42, 1.2], [-4.32, 0.5, 9.25], quilt)
  s.box('quilt_fold', [1.5, 0.12, 0.3], [-5.1, 0.74, 9.85], quilt)
  for (const x of [-5.5, -4.7]) s.box(`pillow_${x}`, [0.62, 0.15, 0.42], [x, 0.74, 10.6], sheet).rotation.z = (x + 5.1) * 0.15
  s.box('throw', [0.6, 0.06, 1.4], [-5.65, 0.73, 9.4], throwMat).rotation.y = 0.3
  // nightstand with a lamp and an alarm clock
  tbox('nightstand', [0.55, 0.6, 0.45], [-3.85, 0.3, 10.7], wood, 0.6)
  s.box('nightstand_drawer', [0.47, 0.18, 0.02], [-3.85, 0.45, 10.47], darkWood)
  s.sphere('nightstand_knob', 0.04, [-3.85, 0.45, 10.45], brass)
  s.cyl('lamp_base', 0.14, 0.32, [-3.95, 0.76, 10.75], brass, { top: 0.06 })
  s.cyl('lamp_shade', 0.38, 0.26, [-3.95, 1.03, 10.75], lampShade, { top: 0.24, cap: false })
  s.box('alarm_clock', [0.14, 0.1, 0.06], [-3.7, 0.65, 10.6], s.pbr('clock_red', '#a83a2a', { rough: 0.4 }))
  // a painting over the bed, knocked crooked
  s.box('painting_frame', [0.95, 0.72, 0.05], [-5.1, 2.05, 10.97], s.pbr('gilt', '#a8863f', { rough: 0.35, metal: 0.8 })).rotation.z = 0.05
  s.plane('painting', 0.8, 0.58, [-5.1, 2.05, 10.94], art).rotation.z = 0.05
  // wardrobe with panelled doors, cornice and handles, a suitcase on top
  tbox('wardrobe', [1.5, 2.2, 0.62], [-1.3, 1.12, 10.68], wood, 0.6)
  for (const dx of [-0.36, 0.36]) {
    s.box(`wardrobe_door_${dx}`, [0.68, 1.85, 0.03], [-1.3 + dx, 1.2, 10.36], wardrobeDoor)
    s.box(`wardrobe_handle_${dx}`, [0.03, 0.18, 0.03], [-1.3 + dx * 0.15, 1.25, 10.33], brass)
  }
  s.box('wardrobe_cornice', [1.62, 0.1, 0.7], [-1.3, 2.26, 10.68], darkWood)
  s.box('wardrobe_plinth', [1.55, 0.1, 0.64], [-1.3, 0.05, 10.68], darkWood)
  s.box('suitcase', [0.7, 0.22, 0.45], [-1.3, 2.43, 10.68], s.pbr('suitcase', '#8a5a34', { rough: 0.6 }))
  // kitchenette: counter, sink, kettle, a shelf of tins and jars
  tbox('counter', [1.7, 0.9, 0.6], [1.1, 0.45, 10.7], s.pbr('counter_paint', '#d8cdb4', { rough: 0.5 }), 0.6)
  tbox('worktop', [1.78, 0.05, 0.66], [1.1, 0.92, 10.7], wood, 0.6)
  s.box('sink', [0.5, 0.06, 0.4], [1.4, 0.95, 10.7], ceramic)
  s.rod('tap', [1.4, 0.95, 10.95], [1.4, 1.2, 10.9], 0.03, chrome)
  s.cyl('kettle', 0.2, 0.22, [0.65, 1.06, 10.7], chrome, { top: 0.15 })
  s.box('splashback', [1.7, 0.5, 0.02], [1.1, 1.2, 10.99], ceramic)
  tbox('shelf', [1.4, 0.04, 0.24], [1.1, 1.75, 10.88], wood, 0.6)
  for (let i = 0; i < 5; i++) s.cyl(`jar_${i}`, 0.1, 0.16 + (i % 2) * 0.06, [0.55 + i * 0.27, 1.85 + (i % 2) * 0.03, 10.88], [ceramic, brass, bookCols[2]][i % 3], { tess: 10 })
  // dresser with drawers (one pulled out, a shirt left in it), a mirror above
  tbox('dresser', [1.7, 0.85, 0.7], [3, 0.425, 9.9], wood, 0.6)
  for (const y of [0.22, 0.48]) {
    s.box(`dresser_drawer_${y}`, [1.56, 0.22, 0.02], [3, y, 9.54], drawerFront)
    for (const dx of [-0.45, 0.45]) s.box(`dresser_handle_${y}_${dx}`, [0.14, 0.03, 0.03], [3 + dx, y, 9.52], brass)
  }
  tbox('open_drawer', [1.5, 0.2, 0.9], [3, 0.7, 9.22], wood, 0.6)
  s.box('open_drawer_front', [1.56, 0.24, 0.03], [3, 0.7, 8.76], drawerFront)
  s.box('forgotten_shirt', [0.75, 0.08, 0.5], [3, 0.82, 9.2], shirt).rotation.y = 0.2
  s.box('shirt_sleeve', [0.6, 0.05, 0.15], [2.55, 0.62, 8.7], shirt).rotation.set(0.6, 0.3, 0.2)
  s.box('mirror_frame', [1.0, 0.85, 0.04], [3, 1.6, 10.98], darkWood)
  s.box('mirror', [0.88, 0.73, 0.02], [3, 1.6, 10.95], s.pbr('mirror', '#d6dcdc', { rough: 0.05, metal: 1 }))
  // a bookshelf against the passage wall
  tbox('bookshelf', [0.32, 1.8, 1.3], [3.7, 0.9, 6.9], wood, 0.6)
  for (let r = 0; r < 4; r++) {
    s.box(`bookshelf_shelf_${r}`, [0.3, 0.03, 1.22], [3.68, 0.15 + r * 0.43, 6.9], darkWood)
    let z = 6.32
    while (z < 7.4) {
      const w = 0.04 + T.rand() * 0.05
      const h = 0.24 + T.rand() * 0.12
      if (T.rand() > 0.12) s.box(`book_${r}_${z.toFixed(2)}`, [0.22, h, w], [3.62, 0.17 + r * 0.43 + h / 2, z + w / 2], bookCols[Math.floor(T.rand() * bookCols.length)])
      z += w + 0.005
    }
  }
  // reading corner: club chair, side table, floor lamp
  await s.model('club_chair', 'room_chair', [-5.7, 0, 3.4], 0.9)
  tbox('side_table', [0.5, 0.04, 0.5], [-6.3, 0.6, 2.5], wood, 0.6)
  s.cyl('side_table_leg', 0.06, 0.6, [-6.3, 0.3, 2.5], darkWood)
  s.box('newspapers', [0.32, 0.05, 0.42], [-6.3, 0.65, 2.5], paper).rotation.y = 0.3
  s.cyl('floor_lamp_base', 0.32, 0.04, [-6.6, 0.02, 4.0], brass)
  s.cyl('floor_lamp_pole', 0.04, 1.5, [-6.6, 0.77, 4.0], brass)
  s.cyl('floor_lamp_shade', 0.46, 0.32, [-6.6, 1.62, 4.0], lampShade, { top: 0.3, cap: false })
  // table with the cash, a mug and a chair; the second chair knocked over
  tbox('table', [1.5, 0.06, 1], [-2.8, 0.78, 5], wood, 0.6)
  tbox('table_apron', [1.36, 0.1, 0.86], [-2.8, 0.7, 5], wood, 0.6)
  for (const x of [-3.45, -2.15]) for (const z of [4.6, 5.4]) s.cyl(`leg_${x}_${z}`, 0.07, 0.75, [x, 0.375, z], darkWood, { top: 0.05, tess: 8 })
  const cashMat = s.pbr('cash', '#8aa274', { rough: 1 })
  s.box('cash', [0.26, 0.04, 0.13], [-2.8, 0.83, 5], cashMat).rotation.y = 0.4
  s.box('cash_2', [0.26, 0.02, 0.13], [-2.7, 0.82, 4.88], cashMat).rotation.y = -0.2
  s.cyl('mug', 0.1, 0.11, [-2.3, 0.865, 4.75], ceramic, { tess: 12 })
  s.box('ashtray', [0.14, 0.03, 0.14], [-3.3, 0.825, 5.25], s.pbr('glass_ashtray', '#c4d2cc', { rough: 0.1 }))
  const chair = (name: string, x: number, z: number, yaw: number, fallen = false) => {
    const n = s.node(name, [x, fallen ? 0.25 : 0, z])
    n.rotation.set(0, yaw, fallen ? 1.35 : 0)
    s.box(`${name}_seat`, [0.46, 0.05, 0.44], [0, 0.46, 0], wood, n)
    s.box(`${name}_back`, [0.46, 0.5, 0.04], [0, 0.73, -0.21], wood, n)
    for (const dx of [-0.2, 0.2]) for (const dz of [-0.19, 0.19]) s.box(`${name}_leg_${dx}_${dz}`, [0.04, 0.46, 0.04], [dx, 0.23, dz], darkWood, n)
  }
  chair('table_chair', -3.95, 5, Math.PI / 2)
  chair('fallen_chair', -0.9, 5.6, 0.6, true)
  rug('room_rug', 3, 2.2, -1.4, 6.8, rugMat)
  // the holdall, half packed and left open, clothes spilling out
  const bag = s.node('holdall', [0.8, 0, 7.8])
  s.box('holdall_body', [0.95, 0.34, 0.46], [0, 0.17, 0], leather, bag)
  for (const x of [-0.475, 0.475]) s.cyl(`holdall_end_${x}`, 0.4, 0.04, [x, 0.17, 0], leather, { parent: bag, tess: 16 }).rotation.z = Math.PI / 2
  // open along the top, the flaps falling back
  s.box('holdall_inside', [0.88, 0.02, 0.36], [0, 0.345, 0], s.pbr('holdall_inside', '#2a2420', { rough: 1 }), bag)
  for (const z of [-0.26, 0.26]) s.box(`holdall_flap_${z}`, [0.9, 0.02, 0.14], [0, 0.33, z], leather, bag).rotation.x = z > 0 ? 0.6 : -0.6
  s.box('holdall_spill', [0.4, 0.06, 0.3], [0.12, 0.37, 0.02], shirt, bag).rotation.y = 0.3
  for (const x of [-0.2, 0.2]) s.rod(`holdall_strap_${x}`, [x, 0.34, -0.2], [x, 0.34, -0.55], 0.03, darkWood, bag)
  s.box('holdall_buckle', [0.06, 0.02, 0.06], [0.2, 0.34, -0.55], brass, bag)
  s.box('floor_sock', [0.25, 0.03, 0.1], [0.65, 0.015, 0.55], s.pbr('sock', '#d6d0c2', { rough: 1 }), bag).rotation.y = 0.8
  // a clock and coat hooks on the partition, inside the room
  s.cyl('wall_clock', 0.4, 0.05, [-3.5, 2.45, 2.13], darkWood).rotation.x = Math.PI / 2
  s.cyl('wall_clock_face', 0.34, 0.01, [-3.5, 2.45, 2.16], clockFace).rotation.x = Math.PI / 2
  s.box('clock_hand', [0.02, 0.13, 0.005], [-3.5, 2.5, 2.17], iron).rotation.z = 0.5
  s.box('hook_board', [0.7, 0.1, 0.03], [2.6, 1.8, 2.12], darkWood)
  for (let i = 0; i < 3; i++) s.sphere(`hook_${i}`, 0.05, [2.38 + i * 0.22, 1.78, 2.16], brass)
  s.box('scarf', [0.12, 0.7, 0.04], [2.6, 1.42, 2.17], s.pbr('scarf', '#a83a2a', { rough: 1 }))
  // pendant over the room with a ceiling rose
  s.cyl('ceiling_rose', 0.5, 0.04, [-1.5, H - 0.02, 6.5], trim)
  s.rod('room_cord', [-1.5, H, 6.5], [-1.5, 2.8, 6.5], 0.02, iron)
  s.cyl('room_shade', 0.6, 0.28, [-1.5, 2.7, 6.5], s.pbr('shade_cloth', '#f0d8a8', { rough: 0.9 }), { top: 0.2, cap: false })
  s.sphere('room_bulb', 0.16, [-1.5, 2.6, 6.5], bulb)

  // ── Service passage and stairs ──────────────────────────────────────────
  const RISE = 0.27
  const RUN = 0.32
  for (let i = 0; i < 12; i++) {
    const h = RISE * (i + 1)
    tbox(`stair_${i}`, [1.7, h, RUN], [5, h / 2, 5.36 + i * RUN], wood, 0.6)
    s.box(`stair_runner_${i}`, [0.9, 0.012, RUN], [5, h + 0.006, 5.36 + i * RUN], runnerMat)
    s.box(`stair_nose_${i}`, [1.72, 0.04, 0.06], [5, h, 5.21 + i * RUN], darkWood)
  }
  tbox('stair_landing', [3.05, RISE * 12, 1.95], [5.48, (RISE * 12) / 2, 10.05], wood, 0.6)
  // banister: newel post at the foot, a handrail up the flight, balusters (one snapped)
  s.box('newel', [0.14, 1.2, 0.14], [5.95, 0.6, 5.2], darkWood)
  s.sphere('newel_cap', 0.16, [5.95, 1.24, 5.2], darkWood)
  s.rod('rail', [5.95, 1.15, 5.2], [5.95, 1.15 + RISE * 11, 5.2 + RUN * 11.5], 0.07, darkWood)
  for (let i = 1; i < 12; i++) {
    if (i === 2) continue
    const z = 5.2 + i * RUN
    s.rod(`baluster_${i}`, [5.95, RISE * (i + 0.5), z], [5.95, 1.15 + RISE * (i - 0.4), z], 0.04, darkWood)
  }
  s.rod('baluster_broken', [5.95, RISE * 2.5, 5.84], [6.25, 0.2, 6.3], 0.04, darkWood)
  rug('passage_runner', 1.1, 2.6, 5, 3.6, runnerMat)
  s.rod('passage_cord', [5.5, H, 3.6], [5.5, 3.0, 3.6], 0.02, iron)
  s.sphere('passage_bulb', 0.18, [5.5, 2.9, 3.6], bulb)
  const coat = s.box('nico_coat', [0.6, 0.85, 0.12], [5.8, 0.9, 5.3], s.pbr('nico_coat', '#4d5a44', { rough: 1 }))
  const note = s.box('note', [0.28, 0.19, 0.02], [5.75, 1.12, 5.22], paper)

  // ── Lighting: a bright morning through the glass, warm bulbs inside ─────
  lit.hemi(0.7, new Color3(1, 0.93, 0.82), new Color3(0.42, 0.32, 0.24))
  const key = lit.spot('landing', new Vector3(-0.5, 3.3, -2), new Vector3(0.05, -1, 0.35), 2.2, 90, WARM, 14)
  lit.enableShadows(key)
  lit.spot('sun_hall', new Vector3(6.6, 2.7, -3.5), new Vector3(-1, -0.75, 0.15), 1.1, 240, SUN, 14)
  lit.spot('sun_room', new Vector3(-6.6, 2.6, 8), new Vector3(1, -0.85, -0.3), 1.0, 220, SUN, 13)
  lit.point('room_pendant', new Vector3(-1.5, 2.5, 6.5), 30, TUNGSTEN, 10)
  lit.point('passage_bulb', new Vector3(5.5, 2.8, 3.8), 30, TUNGSTEN, 9)
  s.track(dust(scene, quality, new Vector3(-6.5, 0.4, 3), new Vector3(3.5, 3.2, 10.6), true))
  // the sun through the hall's open window and over the boards in Room Four, lying on the floor
  D.windowLight(s, null, 'sun_hall_floor', [4.4, 0, -3.55], 2.2, 1.85, SUN, { cols: 2, rows: 2, strength: 0.55 })
  D.windowLight(s, null, 'sun_room_floor', [-4.3, 0, 7.25], 1.1, 1.85, SUN, { cols: 2, rows: 1, strength: 0.5 })
  D.wallWash(s, null, 'sun_hall_wall', [-0.6, 1.4, 1.79], 2.4, 1.8, SUN, 0.14)
  // contact shade: along every wall's foot, and under the furniture (phones draw no set shadows)
  D.roomShade(s, 'hall_shade', [-7, -8, 7, 1.9], 0, 0.75, 0.32)
  D.roomShade(s, 'room_shade', [-7, 2.1, 3.85, 11], 0, 0.75, 0.34)
  D.roomShade(s, 'passage_shade', [4.05, 2.1, 7, 5.2], 0, 0.75, 0.34)
  for (const [name, x, z, w, d] of [
    ['bed', -5.1, 9.9, 2.2, 2.9], ['nightstand', -3.85, 10.7, 0.9, 0.8], ['wardrobe', -1.3, 10.68, 2.0, 1.1],
    ['dresser', 3, 9.9, 2.2, 1.2], ['bookshelf', 3.7, 6.9, 0.7, 1.8], ['table', -2.8, 5, 2.0, 1.5], ['bench', -6.65, -2.5, 0.9, 2.0],
  ] as const) D.floorShade(s, `shade_${name}`, [x, 0, z], w, d, 0.5)
  lit.enableGlow(0.3)
  lit.raiseLightLimit(s.materials)
  D.mergeDressing(s)
  lit.bakeProbe(new Vector3(0, 1.6, 1), s.meshes, 0.7)
  s.freezeStatic([], { merge: true, keep: [coat, note] })
  return {
    id: 'mercer', lighting: lit, walkable: [hallFloor, floor], followYaw: 0,
    bounds: { minX: -6.4, maxX: 6.4, minZ: -7, maxZ: 10.4 },
    cameraBox: { min: [-6.7, 0.3, -7.7], max: [6.7, 3.3, 10.7] },
    cameraBoxAt: (target) => ({ min: [-6.7, 0.3, target.z > 3 ? 2.5 : -7.7], max: [6.7, 3.3, 10.7] }),
    obstacles: [
      // partition, stairs, passage wall, service door
      [-7, 1.8, -1.5, 2.2], [1.5, 1.8, 3.5, 2.2], [5.5, 1.8, 7, 2.2], [4.1, 5.0, 6.3, 11], [3.85, 5.1, 4.05, 11], [5.35, 2, 5.6, 3.1],
      // bed, nightstand, wardrobe, kitchenette, dresser, bookshelf
      [-6, 8.7, -4.2, 11], [-4.2, 10.4, -3.5, 11], [-2.1, 10.3, -0.5, 11], [0.2, 10.3, 2, 11], [2, 9.4, 4, 10.4], [3.45, 6.15, 3.9, 7.65],
      // reading corner, table and chair, fallen chair
      [-7, 2.1, -5, 4.3], [-3.6, 4.4, -2, 5.6], [-4.25, 4.7, -3.65, 5.3], [-1.3, 5.2, -0.5, 6],
      // hall: bench, plant, radiator
      [-7, -3.4, -6.3, -1.6], [-7, -7.9, -5.9, -6.9], [6.7, -4.3, 7, -2.7],
    ],
    marks: { entry: [0, -5], local: [-2.5, -1], interview: [-1.2, -1.5], doorway: [0, 3.5], room_centre: [0, 5], drawer: [3, 8.5], cash: [-2.8, 4], bag: [0.8, 7], stop: [0, -1.8], block: [0, -0.6], partner: [1.5, -0.1], service: [4.5, 3.7], coat: [5.75, 5.25, 1.1], coat_stand: [5, 4.4], exit: [4.7, -5] },
    shots: {
      establish: { pos: [4, 3.2, -7], target: [0, 1.5, 1], fov: 0.9 },
      search_wide: { pos: [0, 9.5, 1.5], target: [0, 0.3, 6.5], fov: 1.5 },
      // eye-level-ish from the front-left corner: table and cash, the bag and the dresser run along the diagonal
      search_corner: { pos: [-5.5, 2.9, 2.5], target: [1.6, 0.7, 8.4], fov: 0.95 },
      service_wide: { pos: [3, 4.5, 2.6], target: [5.2, 0.9, 5.1], fov: 1.1 },
      room_wide: { pos: [4.4, 3.1, 3], target: [-0.8, 0.9, 7.8], fov: 0.95 },
      confrontation: { pos: [-3.6, 2.2, -4], target: [0.6, 1.2, -0.8], fov: 0.85 },
      coat_close: { pos: [4.3, 1.8, 3.8], target: [5.7, 1, 5.3], fov: 0.65 },
    },
    event(name) {
      if (name === 'evidenceTaken') { coat.setEnabled(true); note.setEnabled(false) }
      else console.warn(`[mercer] unknown event ${name}`)
    },
    update() {},
    adopt(meshes, materials) { for (const m of meshes) lit.castActorShadow(m); lit.raiseLightLimit(materials) },
    dispose() { lit.dispose(); s.dispose(); scene.fogMode = 0 },
  }
}

/** Old hall tiles: cream and terracotta squares with dark grout (2 × 2 per repeat). */
function checker(scene: import('@render/core').Scene): DynamicTexture {
  const size = 256
  const t = new DynamicTexture('tex_mercer_tiles', { width: size, height: size }, scene, true)
  const c = t.getContext() as unknown as CanvasRenderingContext2D
  c.fillStyle = '#4a3a2c'
  c.fillRect(0, 0, size, size)
  const step = size / 2
  for (let i = 0; i < 2; i++)
    for (let j = 0; j < 2; j++) {
      c.fillStyle = (i + j) % 2 ? '#80453a' : '#c8b893'
      c.fillRect(i * step + 3, j * step + 3, step - 6, step - 6)
      for (let k = 0; k < 120; k++) {
        c.fillStyle = `rgba(30,15,5,${T.rand() * 0.09})`
        c.fillRect(i * step + 3 + T.rand() * (step - 8), j * step + 3 + T.rand() * (step - 8), 3, 3)
      }
    }
  t.update(true)
  t.wrapU = t.wrapV = 1
  return t
}

export default build
