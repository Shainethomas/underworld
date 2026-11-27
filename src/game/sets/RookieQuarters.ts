import { Color3, DynamicTexture, Vector3, VertexData } from '@render/core'
import type { AbstractMesh, Material, Mesh } from '@render/core'
import { LightingManager, MOON, TUNGSTEN } from '@render/LightingManager'
import { wallpaper, windowView } from '@render/InteriorTextures'
import * as D_ from '@render/Dressing'
import * as T from '@render/ProceduralTextures'
import { SetBuilder } from '@render/SetBuilder'
import type { EnvContext, EnvironmentFactory, GameEnvironment } from './types'

// Rookie's apartment, one room: a narrow bed under the window, a nightstand
// with a lamp, his phone and an old photograph, a wardrobe, a small table
// where he drops his training gear, a two-seat sofa against the west wall
// with a low table in front of it, and the door to the corridor. 5 m × 4 m;
// the door is in the south wall (z = -2), the window in the north wall (z = +2).

const W = 2.5
const D = 2
const H = 2.8
const BED = { x: -1.35, z: 0.7, w: 1.0, l: 2.05, top: 0.52 }
const STAND = { x: -0.45, z: 1.55 }
const DOOR = { x: 1.6, w: 0.95 }
const TABLE = { x: 1.3, z: 0.5, w: 0.8, d: 0.5, h: 0.74 }
/** Sitting on the edge of the bed, turned toward the nightstand (face 45°); the hip sits 0.35 m behind this root. */
const BED_SIT = { x: -0.8, z: 0.68 }
/** The sofa against the west wall, facing east (+x): seat front edge, centre along z, length, seat height. */
const SOFA = { front: -1.66, back: -2.5, z: -1.17, len: 1.42, seat: 0.44 }
/** The low table in front of it. */
const LOW = { x: -0.97, z: -1.2, w: 0.42, d: 0.72, h: 0.4 }

/** Warm morning sun through the window. */
const DAYLIGHT = new Color3(1, 0.9, 0.74)

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'room')
  const lit = new LightingManager(scene, quality)
  T.reseed(31)

  scene.fogMode = 0
  scene.clearColor.set(0.02, 0.025, 0.035, 1)

  // All tiers: tune existing PBR uniforms only; retain material sharing,
  // texture sizes, clear-coat features, geometry and render budgets.
  // ── Materials ───────────────────────────────────────────────────────────
  const woodTex = s.track(T.wood(scene, 512, [74, 52, 34]))
  const floorMat = s.pbr('room_floor', '#ffffff', { albedo: woodTex, rough: 0.62, clearCoat: 0.18, uv: [3, 3] })
  // faded striped wallpaper, a cheap rented room's: box-projected so the stripes keep one size on every wall
  const paper = s.track(wallpaper(scene, 'tex_room_paper', '#86765f', '#74644f', '#655642'))
  const plaster = s.pbr('room_wall', '#ffffff', { albedo: paper, rough: 0.88 })
  const ceiling = s.pbr('room_ceiling', '#3a3835', { rough: 0.95 })
  const darkWood = s.pbr('room_dark_wood', '#ffffff', { albedo: s.track(T.wood(scene, 256, [40, 26, 16])), rough: 0.58 })
  const knit = T.fabric(scene, 'knit')
  const wool = T.fabric(scene, 'wool')
  for (const t of [knit.albedo, knit.bump, wool.albedo, wool.bump]) s.track(t)
  const sheet = s.pbr('bed_sheet', '#c9c6bf', { rough: 0.9, albedo: knit.albedo, bump: knit.bump, bumpLevel: 0.3, uv: [4, 4] })
  const blanket = s.pbr('bed_blanket', '#34313a', { rough: 0.95, albedo: wool.albedo, bump: wool.bump, bumpLevel: 0.4, uv: [5, 5] })
  const metal = s.pbr('room_metal', '#2a2c30', { rough: 0.6, metal: 0.25 })
  const brass = s.pbr('room_brass', '#a88a52', { rough: 0.3, metal: 1 })
  const rugMat = s.pbr('room_rug', '#ffffff', { albedo: s.track(T.rug(scene, 512)), rough: 0.95 })
  const glassMat = s.pbr('room_window', '#ffffff', { albedo: s.track(T.windowPanes(scene, 512)), rough: 0.2, emissiveTex: undefined })
  glassMat.emissiveColor = new Color3(0.06, 0.09, 0.14)
  const shade = s.glow('lamp_shade', new Color3(0.95, 0.68, 0.4))
  const hallGlow = s.glow('hall_glow', new Color3(0.42, 0.32, 0.2))

  // ── Shell ───────────────────────────────────────────────────────────────
  const floor = s.box('floor', [W * 2, 0.2, D * 2], [0, -0.1, 0], floorMat)
  floor.metadata = { walkable: true }
  s.box('ceiling', [W * 2, 0.2, D * 2], [0, H + 0.1, 0], ceiling)
  s.box('wall_w', [0.2, H, D * 2], [-W - 0.1, H / 2, 0], plaster)
  s.box('wall_e', [0.2, H, D * 2], [W + 0.1, H / 2, 0], plaster)
  // north wall with the window over the bed
  s.box('wall_n_l', [1.0, H, 0.2], [-W + 0.5, H / 2, D + 0.1], plaster)
  s.box('wall_n_r', [W * 2 - 2.6, H, 0.2], [W - (W * 2 - 2.6) / 2, H / 2, D + 0.1], plaster)
  s.box('wall_n_low', [1.6, 1.0, 0.2], [-W + 1.8, 0.5, D + 0.1], plaster)
  s.box('wall_n_high', [1.6, 0.5, 0.2], [-W + 1.8, H - 0.25, D + 0.1], plaster)
  s.box('window', [1.6, 1.3, 0.04], [-W + 1.8, 1.65, D + 0.06], glassMat).rotation.y = Math.PI
  s.box('window_sill', [1.75, 0.05, 0.25], [-W + 1.8, 1.0, D - 0.05], darkWood)
  // south wall with the door
  const dl = DOOR.x - DOOR.w / 2
  const dr = DOOR.x + DOOR.w / 2
  s.box('wall_s_l', [dl + W, H, 0.2], [(dl - W) / 2, H / 2, -D - 0.1], plaster)
  s.box('wall_s_r', [W - dr, H, 0.2], [(W + dr) / 2, H / 2, -D - 0.1], plaster)
  s.box('wall_s_top', [DOOR.w, H - 2.1, 0.2], [DOOR.x, 2.1 + (H - 2.1) / 2, -D - 0.1], plaster)
  s.plane('hall', DOOR.w, 2.1, [DOOR.x, 1.05, -D - 0.6], hallGlow, Math.PI)
  const hinge = s.node('door_hinge', [dl, 0, -D])
  s.box('door', [DOOR.w, 2.08, 0.05], [DOOR.w / 2, 1.04, 0], darkWood, hinge)
  s.sphere('door_knob', 0.06, [DOOR.w - 0.1, 1.0, 0.05], brass, hinge)
  s.box('skirting', [W * 2, 0.1, 0.02], [0, 0.05, D - 0.01], darkWood)
  for (const m of s.meshes) if (m.material === plaster) s.tileUV(m as Mesh, 0.8)
  // a dark chair rail round the west and south walls, and skirting
  s.box('rail_w', [0.03, 0.05, D * 2], [-W + 0.015, 0.92, 0], darkWood)
  s.box('rail_s_l', [dl + W, 0.05, 0.03], [(dl - W) / 2, 0.92, -D + 0.015], darkWood)
  s.box('skirt_w', [0.02, 0.1, D * 2], [-W + 0.01, 0.05, 0], darkWood)
  s.box('skirt_s', [dl + W, 0.1, 0.02], [(dl - W) / 2, 0.05, -D + 0.01], darkWood)

  // ── Furniture ───────────────────────────────────────────────────────────
  s.box('bed_frame', [BED.w + 0.1, 0.3, BED.l + 0.1], [BED.x, 0.15, BED.z], darkWood)
  s.box('bed_head', [BED.w + 0.1, 0.9, 0.06], [BED.x, 0.45, BED.z + BED.l / 2 + 0.05], darkWood)
  s.box('mattress', [BED.w, 0.2, BED.l], [BED.x, 0.4, BED.z], sheet)
  s.box('pillow', [0.62, 0.09, 0.4], [BED.x, 0.545, BED.z + BED.l / 2 - 0.28], sheet)
  // Cloth grids replace the two boxes at the SAME 12 triangles per mesh,
  // with fewer vertices. The center clears the legs; the edges fall onto the
  // mattress, with a fold over the foot. Both still merge into one draw.
  const cover = s.box('blanket', [1, 1, 1], [0, 0, 0], blanket)
  const coverSide = s.box('blanket_side', [1, 1, 1], [0, 0, 0], blanket)
  const xs = [-.54, -.26, .26, .54]
  const makeCloth = (mesh: Mesh, foot: boolean) => {
    const positions: number[] = [], indices: number[] = [], uvs: number[] = [], normals: number[] = []
    for (let row = 0; row < 3; row++) for (let col = 0; col < 4; col++) {
      const edge = col === 0 || col === 3
      const y = foot ? (row === 0 ? (edge ? .5 : .79) : row === 1 ? .49 : .38) : (edge ? .505 : [.79, .77, .75][row])
      const z = foot ? [-.31, -.33, -.31][row] : [-.31, .35, 1.04][row]
      positions.push(BED.x + xs[col], y, z)
      uvs.push(col / 3, row / 2)
    }
    for (let row = 0; row < 2; row++) for (let col = 0; col < 3; col++) {
      const a = row * 4 + col, b = a + 1, c = a + 4, d = c + 1
      if (foot) indices.push(a, b, c, b, d, c)
      else indices.push(a, c, b, b, c, d)
    }
    for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]
    VertexData.ComputeNormals(positions, indices, normals)
    const data = new VertexData()
    data.positions = positions; data.indices = indices; data.normals = normals; data.uvs = uvs
    data.applyToMesh(mesh)
    mesh.refreshBoundingInfo()
  }
  makeCloth(cover, false)
  makeCloth(coverSide, true)
  // nightstand: lamp, phone, the photograph
  s.box('nightstand', [0.45, 0.55, 0.4], [STAND.x, 0.275, STAND.z], darkWood)
  s.cyl('lamp_base', 0.1, 0.3, [STAND.x - 0.1, 0.7, STAND.z + 0.05], brass)
  s.cyl('lamp_shade', 0.3, 0.22, [STAND.x - 0.1, 0.92, STAND.z + 0.05], shade, { top: 0.2, cap: false })
  const phoneScreen = new DynamicTexture('tex_phone_screen', { width: 128, height: 256 }, scene, true)
  s.track(phoneScreen)
  /** A phone's lock screen: dark, an incoming call from `caller`, or (`message`) a new text from them. */
  const paintScreen = (tex: DynamicTexture, caller: string | null, message = false) => {
    const c = tex.getContext() as unknown as CanvasRenderingContext2D
    c.fillStyle = caller ? '#0d1a26' : '#020203'
    c.fillRect(0, 0, 128, 256)
    if (caller) {
      c.fillStyle = '#e8e2d4'
      c.textAlign = 'center'
      // the name shrinks to fit the screen ("UNKNOWN NUMBER")
      let size = 24
      do c.font = `600 ${size}px Oswald, sans-serif`
      while (c.measureText(caller).width > 112 && --size > 12)
      c.fillText(caller, 64, 90)
      c.font = '500 14px Oswald, sans-serif'
      if (message) {
        c.fillText('1 new message', 64, 116)
        // the message banner
        c.fillStyle = '#1d2a36'
        c.fillRect(12, 150, 104, 46)
        c.fillStyle = '#e1263a'
        c.fillRect(12, 150, 4, 46)
        c.fillStyle = '#b9c2cc'
        for (const [y, w] of [[164, 80], [176, 88], [188, 54]] as const) c.fillRect(24, y, w, 4)
      } else {
        c.fillText('incoming call', 64, 116)
        c.fillStyle = '#3fbf6a'
        c.beginPath()
        c.arc(64, 200, 18, 0, Math.PI * 2)
        c.fill()
      }
    }
    tex.update(true)
  }
  /** The nightstand phone with its screen off. */
  const paintPhone = () => paintScreen(phoneScreen, null)
  paintPhone()
  const phoneMat = s.glow('phone_screen', new Color3(1, 1, 1), phoneScreen)
  const standPhone = s.node('stand_phone', [STAND.x + 0.1, 0.556, STAND.z - 0.04])
  s.box('phone_body', [0.08, 0.012, 0.16], [0, 0, 0], metal, standPhone)
  const phone = s.plane('phone_face', 0.07, 0.15, [0, 0.007, 0], phoneMat, 0, standPhone)
  phone.rotation.x = Math.PI / 2
  const photoTex = s.track(new DynamicTexture('tex_photo', { width: 192, height: 256 }, scene, true))
  {
    // a faded print: a tall man in a dark suit, a boy at his side, a doorway behind
    const c = photoTex.getContext() as unknown as CanvasRenderingContext2D
    const g = c.createLinearGradient(0, 0, 0, 256)
    g.addColorStop(0, '#cdb48a')
    g.addColorStop(1, '#8f7550')
    c.fillStyle = g
    c.fillRect(0, 0, 192, 256)
    c.fillStyle = 'rgba(70,50,30,0.35)'
    c.fillRect(20, 30, 70, 150)
    c.fillStyle = '#3a2a1c'
    c.beginPath()
    c.arc(110, 62, 15, 0, Math.PI * 2)
    c.fill()
    c.fillRect(90, 80, 42, 110)
    c.fillRect(94, 188, 14, 50)
    c.fillRect(114, 188, 14, 50)
    c.fillStyle = '#d9c7a4'
    c.fillRect(108, 82, 6, 26)
    c.fillStyle = '#4a3624'
    c.beginPath()
    c.arc(66, 132, 10, 0, Math.PI * 2)
    c.fill()
    c.fillRect(54, 143, 24, 54)
    c.fillRect(56, 196, 9, 40)
    c.fillRect(67, 196, 9, 40)
    // the man's hand on the boy's shoulder
    c.fillRect(76, 128, 18, 7)
    const v = c.createRadialGradient(96, 128, 60, 96, 128, 160)
    v.addColorStop(0, 'rgba(0,0,0,0)')
    v.addColorStop(1, 'rgba(40,25,10,0.55)')
    c.fillStyle = v
    c.fillRect(0, 0, 192, 256)
    c.strokeStyle = '#efe6d2'
    c.lineWidth = 10
    c.strokeRect(0, 0, 192, 256)
    photoTex.update(true)
  }
  s.box('photo_frame', [0.2, 0.25, 0.02], [STAND.x + 0.05, 0.68, STAND.z + 0.12], brass).rotation.x = -0.2
  s.plane('photo', 0.16, 0.2, [STAND.x + 0.05, 0.68, STAND.z + 0.105], s.pbr('photo', '#ffffff', { albedo: photoTex, rough: 0.6 })).rotation.x = -0.2
  // wardrobe, chair with the training hoodie, a mirror by the door
  s.box('wardrobe', [1.1, 2.1, 0.6], [W - 0.6, 1.05, 1.4], darkWood)
  s.box('wardrobe_split', [0.01, 1.9, 0.01], [W - 0.6, 1.1, 1.095], metal)
  s.box('chair_seat', [0.45, 0.05, 0.45], [1.3, 0.45, -0.2], darkWood)
  s.box('chair_back', [0.45, 0.5, 0.04], [1.3, 0.72, -0.42], darkWood)
  for (const [x, z] of [[1.1, -0.4], [1.5, -0.4], [1.1, 0.0], [1.5, 0.0]]) s.box(`chair_leg_${x}_${z}`, [0.04, 0.45, 0.04], [x, 0.225, z], darkWood)
  // the sofa: a low two-seater in dark leather, seat cushions and a back cushion
  const leather = s.surface('sofa_leather', 'leather', [2, 2], '#4a3a30', 0.75)
  const sofaFrame = s.pbr('sofa_frame', '#1b1714', { rough: 0.6 })
  const sofaD = SOFA.front - SOFA.back
  const sofaX = (SOFA.front + SOFA.back) / 2
  s.box('sofa_base', [sofaD, 0.26, SOFA.len], [sofaX, 0.19, SOFA.z], sofaFrame)
  for (const dz of [-1, 1]) {
    s.box(`sofa_cushion_${dz}`, [sofaD - 0.24, 0.16, SOFA.len / 2 - 0.15], [sofaX + 0.1, SOFA.seat - 0.08, SOFA.z + dz * (SOFA.len / 4 - 0.035)], leather)
    s.box(`sofa_back_${dz}`, [0.2, 0.42, SOFA.len / 2 - 0.15], [SOFA.back + 0.22, SOFA.seat + 0.2, SOFA.z + dz * (SOFA.len / 4 - 0.035)], leather).rotation.z = -0.12
    s.box(`sofa_arm_${dz}`, [sofaD, 0.62, 0.13], [sofaX, 0.31, SOFA.z + dz * (SOFA.len / 2 - 0.065)], leather)
  }
  s.box('sofa_backrest', [0.14, 0.82, SOFA.len], [SOFA.back + 0.07, 0.41, SOFA.z], leather)
  for (const [dx, dz] of [[0.06, -1], [0.06, 1], [sofaD - 0.06, -1], [sofaD - 0.06, 1]]) s.box(`sofa_foot_${dx}_${dz}`, [0.05, 0.06, 0.05], [SOFA.back + dx, 0.03, SOFA.z + dz * (SOFA.len / 2 - 0.06)], metal)
  // the low table in front of it, and his phone on it (face down until it rings)
  s.box('low_top', [LOW.w, 0.04, LOW.d], [LOW.x, LOW.h - 0.02, LOW.z], darkWood)
  s.box('low_shelf', [LOW.w - 0.06, 0.02, LOW.d - 0.06], [LOW.x, 0.12, LOW.z], darkWood)
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.box(`low_leg_${dx}_${dz}`, [0.035, LOW.h - 0.04, 0.035], [LOW.x + dx * (LOW.w / 2 - 0.03), (LOW.h - 0.04) / 2, LOW.z + dz * (LOW.d / 2 - 0.03)], darkWood)
  const tableScreen = s.track(new DynamicTexture('tex_table_phone', { width: 128, height: 256 }, scene, true))
  paintScreen(tableScreen, null)
  const tablePhone = s.node('table_phone', [LOW.x + 0.04, LOW.h + 0.006, LOW.z - 0.12])
  tablePhone.rotation.y = -1.2
  s.box('table_phone_body', [0.075, 0.012, 0.155], [0, 0, 0], metal, tablePhone)
  const tablePhoneFace = s.plane('table_phone_face', 0.066, 0.145, [0, 0.0065, 0], s.glow('table_phone_screen', new Color3(1, 1, 1), tableScreen), 0, tablePhone)
  tablePhoneFace.rotation.x = Math.PI / 2
  tablePhone.setEnabled(false)
  // his gym bag, where he left it by the sofa (Scene 02 and later; Scene 01 drops the carried one there)
  const floorBag = s.node('floor_bag', [-1.07, 0, -0.5])
  floorBag.rotation.y = 1.9
  const nylon = s.pbr('gym_bag', '#141518', { rough: 0.78 })
  s.cyl('floor_bag_body', 0.26, 0.52, [0, 0.13, 0], nylon, { parent: floorBag, tess: 20 }).rotation.x = Math.PI / 2
  for (const z of [-0.26, 0.26]) s.torus(`floor_bag_piping_${z}`, 0.26, 0.012, [0, 0.13, z], s.pbr('gym_bag_trim', '#6e1218', { rough: 0.6 }), floorBag).rotation.x = Math.PI / 2
  floorBag.setEnabled(false)
  // the small table in front of the chair
  s.box('table_top', [TABLE.w, 0.035, TABLE.d], [TABLE.x, TABLE.h - 0.018, TABLE.z], darkWood)
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) s.box(`table_leg_${dx}_${dz}`, [0.04, TABLE.h - 0.035, 0.04], [TABLE.x + dx * (TABLE.w / 2 - 0.05), (TABLE.h - 0.035) / 2, TABLE.z + dz * (TABLE.d / 2 - 0.05)], darkWood)
  // his training gear, put down when he comes in: rolled hand wraps, a towel, a bottle
  const gear = s.node('gear', [TABLE.x, TABLE.h, TABLE.z])
  const wrapMat = s.pbr('gear_wraps', '#7a1a1f', { rough: 0.85 })
  for (const dx of [-0.2, -0.11]) s.cyl(`gear_wrap_${dx}`, 0.075, 0.1, [dx, 0.038, 0.06], wrapMat, { parent: gear, tess: 16 }).rotation.x = Math.PI / 2
  s.box('gear_towel', [0.34, 0.035, 0.2], [0.08, 0.018, -0.06], s.pbr('gear_towel', '#c9c6bf', { rough: 0.95, albedo: knit.albedo, uv: [2, 2] }), gear).rotation.y = 0.25
  s.cyl('gear_bottle', 0.07, 0.22, [0.28, 0.11, 0.1], s.pbr('gear_bottle', '#1d2027', { rough: 0.35, metal: 0.4 }), { parent: gear, tess: 16 })
  s.cyl('gear_cap', 0.05, 0.03, [0.28, 0.235, 0.1], metal, { parent: gear, tess: 12 })
  gear.setEnabled(false)
  s.box('mirror', [0.5, 1.2, 0.02], [W - 0.02, 1.35, -0.8], s.pbr('mirror', '#b9c2c8', { rough: 0.05, metal: 1 })).rotation.y = Math.PI / 2
  s.plane('rug', 1.6, 1.0, [0.2, 0.01, -0.4], rugMat).rotation.x = Math.PI / 2

  // contact shade along the walls and under the furniture (phones draw no set shadows)
  D_.roomShade(s, 'room_shade', [-W, -D, W, D], 0, 0.6, 0.34)
  D_.floorShade(s, 'shade_bed', [BED.x, 0, BED.z], 1.6, 2.6, 0.55)
  D_.floorShade(s, 'shade_sofa', [(SOFA.front + SOFA.back) / 2, 0, SOFA.z], 1.3, 1.9, 0.5)
  D_.floorShade(s, 'shade_wardrobe', [W - 0.6, 0, 1.4], 1.5, 1.0, 0.5)
  D_.floorShade(s, 'shade_stand', [STAND.x, 0, STAND.z], 0.7, 0.6, 0.45)
  D_.floorShade(s, 'shade_table', [TABLE.x, 0, TABLE.z], 1.1, 0.8, 0.35)
  D_.floorShade(s, 'shade_low', [LOW.x, 0, LOW.z], 0.7, 1.0, 0.35)

  // ── On the walls ────────────────────────────────────────────────────────
  // a fight bill over the sofa, a gym flyer by the door
  const frameMat = s.pbr('frame', '#1a1512', { rough: 0.5 })
  s.box('bill_frame', [0.03, 0.95, 0.7], [-W + 0.015, 1.6, SOFA.z], frameMat)
  D_.poster(s, 'room_bill', 1, [-W + 0.035, 1.6, SOFA.z], 0.62, 0.87, -Math.PI / 2)
  D_.poster(s, 'room_flyer', 3, [-0.35, 1.55, -D + 0.012], 0.42, 0.6, Math.PI)
  // a shelf over the bed's foot: a few paperbacks and a boxing trophy
  s.box('shelf', [0.24, 0.03, 0.9], [-W + 0.12, 1.62, -0.05], darkWood)
  const spines = ['#6b1d1d', '#1f2f45', '#3c3a30', '#8a6d3b', '#2c2c2c', '#4d2a2a', '#3a4a3a']
  let bz = -0.45
  spines.forEach((c, i) => {
    const h = 0.17 + ((i * 37) % 7) / 100
    const th = 0.025 + ((i * 13) % 4) / 100
    s.box(`book_${i}`, [0.15, h, th], [-W + 0.11, 1.635 + h / 2, bz + th / 2], s.pbr(`book_${c}`, c, { rough: 0.8 })).rotation.x = i === 6 ? 0.25 : 0
    bz += th + 0.004
  })
  s.cyl('trophy_base', 0.08, 0.05, [-W + 0.12, 1.66, 0.25], darkWood, { tess: 12 })
  s.lathe('trophy_cup', [[0, 0], [0.012, 0], [0.012, 0.09], [0.05, 0.14], [0.055, 0.2], [0, 0.2]], [-W + 0.12, 1.685, 0.25], brass)
  // a wall clock over the mirror
  const clockTex = s.track(new DynamicTexture('tex_clock', { width: 128, height: 128 }, scene, true))
  {
    const c = clockTex.getContext() as unknown as CanvasRenderingContext2D
    c.fillStyle = '#e6dcc8'
    c.fillRect(0, 0, 128, 128)
    c.fillStyle = '#1a1512'
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      c.fillRect(64 + Math.sin(a) * 50 - 2, 64 - Math.cos(a) * 50 - 5, 4, 10)
    }
    c.strokeStyle = '#1a1512'
    c.lineCap = 'round'
    c.lineWidth = 6
    c.beginPath(); c.moveTo(64, 64); c.lineTo(64 + 22, 64 + 14); c.stroke()
    c.lineWidth = 4
    c.beginPath(); c.moveTo(64, 64); c.lineTo(64 - 8, 64 - 40); c.stroke()
    clockTex.update(true)
  }
  const clockFace = s.cyl('clock_face', 0.3, 0.02, [W - 0.02, 2.28, -0.8], s.pbr('clock_face', '#ffffff', { albedo: clockTex, rough: 0.4 }), { tess: 28 })
  clockFace.rotation.z = Math.PI / 2
  clockFace.rotation.x = -Math.PI / 2
  s.torus('clock_rim', 0.31, 0.025, [W - 0.025, 2.28, -0.8], brass).rotation.z = Math.PI / 2

  // ── Lighting ────────────────────────────────────────────────────────────
  let dayView: DynamicTexture | null = null
  const ambient = lit.hemi(0.62, new Color3(0.5, 0.52, 0.66), new Color3(0.2, 0.15, 0.12))
  const moon = lit.spot('moonlight', new Vector3(-W + 1.8, 2.4, D + 1.2), new Vector3(0.1, -0.7, -1), 1.3, 70, MOON, 10)
  lit.enableShadows(moon, 1024)
  const lamp = lit.point('bedside_lamp', new Vector3(STAND.x - 0.1, 1.0, STAND.z - 0.1), 0, TUNGSTEN, 8)
  const hall = lit.spot('hall_light', new Vector3(DOOR.x, 2.0, -D - 0.8), new Vector3(0, -0.4, 1), 1.1, 0, new Color3(1, 0.78, 0.5), 7)
  // the main light: a shaded ceiling fitting, off until he gets dressed
  const ceilingLight = lit.point('ceiling_light', new Vector3(0.1, H - 0.35, -0.2), 0, new Color3(1, 0.86, 0.66), 7)
  const fitting = s.glow('ceiling_fitting', new Color3(0.08, 0.07, 0.06))
  s.cyl('ceiling_shade', 0.45, 0.16, [0.1, H - 0.08, -0.2], fitting, { top: 0.3 })
  const phoneLight = lit.point('phone_light', new Vector3(STAND.x + 0.1, 0.7, STAND.z - 0.04), 0, new Color3(0.5, 0.7, 1), 2.5)
  const tablePhoneLight = lit.point('table_phone_light', new Vector3(LOW.x + 0.04, LOW.h + 0.15, LOW.z - 0.12), 0, new Color3(0.5, 0.7, 1), 2.5)
  // A red neon sign across the street: its glow comes in through the wet glass,
  // over the ceiling by the window, the wall beside it and the floor (night only)
  const NEON_OUT = new Color3(0.95, 0.18, 0.24)
  const nightGlow = [
    D_.lightPool(s, null, 'neon_ceiling', [-0.7, H - 0.03, 1.25], 2.6, 1.6, NEON_OUT, 0.22),
    D_.wallWash(s, null, 'neon_wall', [0.75, 1.75, D - 0.012], 1.5, 1.9, NEON_OUT, 0.16),
    D_.windowLight(s, null, 'moon_floor', [-0.15, 0, 0.45], 1.3, 1.5, new Color3(0.55, 0.42, 0.62), { cols: 2, rows: 2, strength: 0.3 }),
  ]
  // the bedside lamp's warm throw on the wall behind it and down its shade (lamp on only)
  const lampGlow = [
    D_.wallWash(s, null, 'lamp_wash', [STAND.x - 0.1, 1.05, D - 0.012], 1.5, 1.6, TUNGSTEN, 0.36),
    D_.halo(s, null, 'lamp_halo', [STAND.x - 0.1, 0.92, STAND.z + 0.05], 0.7, new Color3(1, 0.78, 0.5), 0.4),
  ]
  lit.enableGlow(0.3)
  for (const m of s.meshes) if (/^(hall|window|photo|phone_face|table_phone_face)/.test(m.name)) lit.glow?.addExcludedMesh(m as Mesh)
  for (const m of s.meshes) if (/^(bed_|wardrobe|chair|nightstand|lamp_base|lamp_shade|table_|gear_|sofa_|low_|floor_bag)/.test(m.name)) lit.castShadow(m)
  lit.raiseLightLimit(s.materials)
  D_.mergeDressing(s, [...nightGlow, ...lampGlow])
  lit.bakeProbe(new Vector3(0, 1.4, 0), s.meshes, 0.35)
  // the gear and the phone on its stand are shown and hidden by events
  s.freezeStatic([hinge, tablePhone, floorBag], { merge: true, keep: [gear, standPhone] })

  const duvet = s.meshes.find(m => m.material === blanket)
  let bedOccupied: boolean | null = null
  const setBedOccupied = (occupied: boolean) => {
    if (!duvet || bedOccupied === occupied) return
    bedOccupied = occupied
    duvet.unfreezeWorldMatrix()
    duvet.scaling.y = occupied ? 1 : .35
    duvet.position.y = occupied ? 0 : .52 - .63 * .35
    duvet.computeWorldMatrix(true)
    duvet.freezeWorldMatrix()
  }
  setBedOccupied(false)

  // ── Scripted events ─────────────────────────────────────────────────────
  type Tween = { t: number; dur: number; apply: (k: number) => void }
  const tweens: Tween[] = []
  const tween = (dur: number, apply: (k: number) => void, instant: boolean) => (instant ? apply(1) : tweens.push({ t: 0, dur, apply }))
  const setLamp = (on: boolean) => {
    lamp.intensity = on ? 16 : 0
    shade.emissiveColor.copyFrom(on ? new Color3(0.95, 0.68, 0.4) : new Color3(0.08, 0.06, 0.04))
    ambient.intensity = on ? 0.9 : 0.62
    for (const m of lampGlow) m.setEnabled(on)
  }
  const setDoor = (open: boolean, instant: boolean) => {
    const from = hinge.rotation.y
    tween(1.1, (k) => {
      hinge.rotation.y = from + ((open ? -1.4 : 0) - from) * (1 - (1 - k) ** 3)
      hall.intensity = (open ? k : 1 - k) * 14
    }, instant)
  }
  let ringing = false
  let tableRinging = false
  let clock = 0
  setLamp(false)

  const env: GameEnvironment = {
    id: 'room',
    marks: {
      door_in: [DOOR.x, -D - 0.4],
      inside: [DOOR.x - 0.1, -1.2],
      bedside: [BED.x + 0.75, BED.z - 0.2],
      // lying on his back, head on the pillow: the pose lies 0.9 m behind the
      // root, so he "faces" the foot of the bed (180°)
      in_bed: [BED.x, BED.z + BED.l / 2 - 0.28 - 0.91, BED.top],
      stand_by_bed: [BED.x + 0.85, BED.z + 0.4],
      nightstand: [STAND.x, STAND.z],
      photo: [STAND.x + 0.05, STAND.z + 0.12],
      window: [-W + 1.8, D],
      wardrobe: [W - 0.6, 1.1],
      wardrobe_stand: [W - 0.6, 0.45],
      // far enough back that a close-up of his face fits between him and the glass
      mirror_stand: [W - 1.35, -0.8],
      mirror: [W, -0.8],
      ravi_door: [DOOR.x, -D - 0.25],
      ravi_in: [DOOR.x - 0.05, -1.45],
      ravi_aside: [DOOR.x - 0.75, -1.5],
      room_mid: [0.4, -0.3],
      // talking to Ravi at the door, with room between them for the camera
      rookie_talk: [-0.35, 0.45],
      // putting his gear down at the table, then sitting on the edge of the bed
      // he puts the gear down from the table's far side, facing the room
      table_way: [TABLE.x - TABLE.w / 2 - 0.15, TABLE.z + TABLE.d / 2 + 0.3],
      table_stand: [TABLE.x - 0.05, TABLE.z + TABLE.d / 2 + 0.25],
      table: [TABLE.x, TABLE.z],
      bed_sit_approach: [BED_SIT.x + 0.35, BED_SIT.z + 0.1],
      bed_sit: [BED_SIT.x, BED_SIT.z, 0.07],
      // Scene 01's evening: in through the door, the bag down by the sofa, then
      // sitting in the middle of it facing the room (face 90°); the hip sits behind this root
      bag_stand: [0.35, -1.2],
      sofa_way: [-1.35, -0.62],
      sofa_sit: [SOFA.front + 0.13, SOFA.z, 0.0],
      // standing to take the call, between the sofa and the low table
      sofa_stand: [SOFA.front + 0.27, SOFA.z],
      table_phone: [LOW.x + 0.04, LOW.z - 0.12, LOW.h],
      // head back against the sofa: a point high on the far wall
      rest_look: [0.8, SOFA.z, 2.75],
      // look targets: the photograph on the nightstand, the window
      photo_look: [STAND.x + 0.05, STAND.z + 0.12, 0.68],
      window_look: [-W + 1.8, D, 1.7],
    },
    shots: {
      room_wide: { pos: [W - 0.35, 2.15, -D + 0.3], target: [-1.2, 0.6, 0.9], fov: 0.95, handheld: 0.004 },
      // from beside the bed, looking across the room to the door
      room_door: { pos: [-0.9, 1.6, 1.1], target: [DOOR.x, 1.1, -D], fov: 0.78, handheld: 0.004 },
      // from the foot of the bed, clear of the lamp: his face on the pillow
      bed_close: { pos: [BED.x + 1.0, 1.3, BED.z - 0.45], target: [BED.x, 0.62, BED.z + 0.85], fov: 0.66, to: { pos: [BED.x + 0.9, 1.22, BED.z - 0.3], target: [BED.x, 0.62, BED.z + 0.85] }, duration: 8, handheld: 0.004 },
      phone_close: { pos: [STAND.x + 0.35, 0.95, STAND.z - 0.35], target: [STAND.x + 0.1, 0.56, STAND.z - 0.04], fov: 0.5, handheld: 0.004 },
      // from behind his shoulder toward the mirror
      mirror_view: { pos: [-0.3, 1.7, 0.35], target: [W - 0.6, 1.45, -0.8], fov: 0.6, handheld: 0.004 },
      // the ending: his gear going down, the glance at the photograph, the look to the window
      // from the bed's head end across the room: the door, the path in, the table
      room_enter: { pos: [-2.2, 1.75, 1.75], target: [0.57, 1.15, -0.42], fov: 0.8, handheld: 0 },
      // from the rug: the table, with him on its far side
      table_front: { pos: [-0.6, 1.6, -1.6], target: [1.25, 1.0, 0.75], fov: 0.78, handheld: 0 },
      // from the door side: him on the edge of the bed, the nightstand and its photograph beside him
      bed_side: { pos: [1.2, 1.25, -1.0], target: [-0.82, 0.95, 0.98], fov: 0.66, handheld: 0 },
      window_end: { pos: [1.55, 1.25, -1.45], target: [-1.0, 1.3, 1.05], fov: 0.74, handheld: 0 },
      photo_close: { pos: [STAND.x + 0.35, 1.0, STAND.z - 0.55], target: [STAND.x + 0.03, 0.66, STAND.z + 0.1], fov: 0.5 },
      // from the door side across the room: the sofa, the low table, him on it
      sofa_wide: { pos: [1.85, 1.62, -1.2], target: [-1.75, 0.82, -1.0], fov: 0.82, handheld: 0 },
      // looking down at the phone on the low table
      table_phone_close: { pos: [LOW.x + 0.42, 0.95, LOW.z - 0.42], target: [LOW.x + 0.04, LOW.h, LOW.z - 0.12], fov: 0.5, handheld: 0 },
      // on his feet with the phone: waist-up from across the room
      sofa_call: { pos: [0.85, 1.55, -0.95], target: [SOFA.front + 0.27, 1.38, SOFA.z], fov: 0.56, handheld: 0 },
    },
    bounds: { minX: -W + 0.3, maxX: W - 0.3, minZ: -D + 0.3, maxZ: D - 0.3 },
    obstacles: [
      [BED.x - 0.6, BED.z - 1.1, BED.x + 0.6, BED.z + 1.1],
      [STAND.x - 0.25, STAND.z - 0.22, STAND.x + 0.25, STAND.z + 0.22],
      [W - 1.2, 1.05, W, 1.75],
      [1.05, -0.45, 1.55, 0.05],
      [TABLE.x - TABLE.w / 2 - 0.05, TABLE.z - TABLE.d / 2 - 0.05, TABLE.x + TABLE.w / 2 + 0.05, TABLE.z + TABLE.d / 2 + 0.05],
      [SOFA.back, SOFA.z - SOFA.len / 2, SOFA.front, SOFA.z + SOFA.len / 2],
      [LOW.x - LOW.w / 2, LOW.z - LOW.d / 2, LOW.x + LOW.w / 2, LOW.z + LOW.d / 2],
    ],
    followYaw: 0,
    cameraBox: { min: [-W + 0.15, 0.3, -D + 0.15], max: [W - 0.15, H - 0.15, D - 0.15] },
    lighting: lit,
    walkable: [floor],
    event(full, instant = false) {
      if (full === 'bedSleep' || full === 'bedWake') { setBedOccupied(full === 'bedSleep'); return }
      // the phone events say who it is: `phoneRing:Unknown number`, `tablePhoneMessage:Lucas` (Lucas if not given)
      const [name, who] = full.split(':')
      const caller = (who ?? 'Lucas').toUpperCase()
      switch (name) {
        case 'lampOn':
          setLamp(true)
          break
        case 'lampOff':
          setLamp(false)
          break
        case 'roomLight':
          ceilingLight.intensity = 9
          fitting.emissiveColor.set(1, 0.86, 0.62)
          break
        case 'roomLightOff':
          ceilingLight.intensity = 0
          fitting.emissiveColor.set(0.08, 0.07, 0.06)
          break
        // A sunny morning (Scenes 02 and 04): sun through the window instead of the
        // moon, a warm bright room, the street outside in the glass instead of rain
        case 'morning': {
          moon.diffuse.copyFrom(DAYLIGHT)
          moon.specular = DAYLIGHT.scale(0.5)
          moon.intensity = 260
          ambient.intensity = 1.7
          ambient.diffuse.set(1, 0.94, 0.86)
          ambient.groundColor.set(0.42, 0.34, 0.26)
          // the ceiling point doubles as daylight bouncing round the room (the fitting itself stays off)
          ceilingLight.intensity = 24
          scene.environmentIntensity = 0.9
          // in daylight the walls read as the warm cream paint they are
          plaster.albedoColor = Color3.FromHexString('#fff2dc').toLinearSpace()
          for (const m of nightGlow) m.setEnabled(false)
          if (!dayView) dayView = s.track(windowView(scene, 'tex_room_day_view'))
          glassMat.albedoTexture = dayView
          glassMat.emissiveTexture = dayView
          glassMat.emissiveColor.set(1, 1, 1)
          scene.clearColor.set(0.62, 0.56, 0.48, 1)
          lit.refreshProbe()
          break
        }
        case 'doorOpen':
          setDoor(true, instant)
          break
        case 'doorClose':
          setDoor(false, instant)
          break
        case 'phoneRing':
          ringing = true
          paintScreen(phoneScreen, caller)
          break
        // a text on the nightstand phone: the screen lights with it, no ringing
        case 'phoneMessage':
          ringing = false
          paintScreen(phoneScreen, caller, true)
          phoneScreen.level = 1
          phoneLight.intensity = 1.2
          break
        // read, or put away: the nightstand screen goes dark
        case 'phoneDark':
          ringing = false
          paintPhone()
          phoneLight.intensity = 0
          break
        case 'gearDown':
          gear.setEnabled(true)
          break
        // his phone on the low table by the sofa instead of the nightstand
        case 'phoneTable':
          tablePhone.setEnabled(true)
          standPhone.setEnabled(false)
          break
        case 'tablePhoneRing':
          tableRinging = true
          paintScreen(tableScreen, caller)
          break
        // picked up: it is in his hand now
        // a text arriving: the screen lights with it, no ringing
        case 'tablePhoneMessage':
          paintScreen(tableScreen, caller, true)
          tablePhoneLight.intensity = 1.2
          break
        // read: the table phone's screen goes dark, the phone stays where it is
        case 'tablePhoneDark':
          tableRinging = false
          paintScreen(tableScreen, null)
          tablePhoneLight.intensity = 0
          break
        case 'tablePhoneAnswer':
          tableRinging = false
          paintScreen(tableScreen, null)
          tablePhoneLight.intensity = 0
          tablePhone.setEnabled(false)
          break
        case 'bagFloor':
          floorBag.setEnabled(true)
          break
        case 'phoneAnswer':
          ringing = false
          paintPhone()
          phoneLight.intensity = 0
          break
        // the nightstand phone in his hand (Scene 02's morning call), and back down
        case 'standPhoneUp':
          ringing = false
          phoneLight.intensity = 0
          standPhone.setEnabled(false)
          break
        case 'standPhoneDown':
          paintPhone()
          standPhone.setEnabled(true)
          break
        default:
          console.warn(`[room] unknown event ${full}`)
      }
    },
    update(dt) {
      clock += dt
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]
        tw.t += dt
        tw.apply(Math.min(1, tw.t / tw.dur))
        if (tw.t >= tw.dur) tweens.splice(i, 1)
      }
      if (ringing) {
        // the screen lights the nightstand in pulses, in time with the buzz
        const pulse = Math.max(0, Math.sin(clock * Math.PI * 1.25)) ** 2
        phoneLight.intensity = 0.6 + pulse * 2.4
        phoneScreen.level = 0.55 + 0.45 * pulse
      }
      if (tableRinging) {
        const pulse = Math.max(0, Math.sin(clock * Math.PI * 1.25)) ** 2
        tablePhoneLight.intensity = 0.6 + pulse * 2.4
        tableScreen.level = 0.55 + 0.45 * pulse
      }
    },
    adopt(meshes: AbstractMesh[], materials: Material[]) {
      for (const m of meshes) lit.castActorShadow(m)
      lit.raiseLightLimit(materials)
    },
    dispose() {
      lit.dispose()
      s.dispose()
    },
  }
  return env
}

export default build
