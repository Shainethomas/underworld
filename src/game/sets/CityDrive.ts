import { Color3, DynamicTexture, Mesh, PBRMaterial, StandardMaterial, Vector3 } from '@render/core'
import type { AbstractMesh, Material, Texture, TransformNode } from '@render/core'
import { rain } from '@render/Effects'
import { LightingManager, MOON } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import * as D from '@render/Dressing'
import { SetBuilder } from '@render/SetBuilder'
import type { DriveControl, EnvContext, EnvironmentFactory, GameEnvironment } from './types'

// The drive across the city at night (or, after a 'morning' event, on a dry
// sunny morning: Scene 04). The car never moves: the avenue
// streams past it (a treadmill), so every camera can be a fixed named shot
// and the street lamps sweep their light over the bodywork. Everything that
// scrolls wraps round a 240 m loop that the fog hides at both ends.
//
// Cutscenes cruise at a steady speed. A drive beat hands the speed to the
// player (DriveControl): holding the screen opens the throttle, letting go
// coasts, and the destination (a building at the kerb, its name over the door) comes up out of the haze as
// the distance runs down; the car brakes to a stop in front of it.

const SPEED = 15
/** The player's drive: top speed (m/s), acceleration and braking (m/s²). */
const TOP = 24
const ACCEL = 5
const COAST = 3.5
const BRAKE = 4.5
/** The destination's entrance is this far ahead of the car when it pulls up. */
const DEST_AHEAD = 12
/** Its street front (x), just in front of the shopfront line. */
const DEST_X = 9.6
/** The car eases over to the kerb (x) over the last PULL metres of a trip. */
const KERB_X = 5.3
const PULL = 38
const LOOP = 240
const BACK = -60
const CAR_X = 1.9
const LAMP_GAP = 20
const ROAD_W = 14
const TILE = 12

const wrap = (z: number) => ((((z - BACK) % LOOP) + LOOP) % LOOP) + BACK
const wrapGap = (z: number) => ((((z + LAMP_GAP / 2) % LAMP_GAP) + LAMP_GAP) % LAMP_GAP) - LAMP_GAP / 2

interface Scroller {
  node: TransformNode
  /** Extra speed toward the camera (oncoming traffic). */
  extra: number
}

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'city')
  const lit = new LightingManager(scene, quality)
  const hi = quality === 'high'
  T.reseed(52)

  scene.fogMode = 2
  scene.fogDensity = 0.012
  // the haze meets the sky's glowing lower edge
  scene.fogColor = new Color3(0.135, 0.1, 0.105)
  scene.clearColor.set(0.135, 0.1, 0.105, 1)

  // All tiers: tune existing PBR uniforms only; retain material sharing,
  // texture sizes, clear-coat features, geometry and render budgets.
  // ── Materials ───────────────────────────────────────────────────────────
  const roadTex = s.track(T.road(scene, hi ? 1024 : 512))
  const roadMat = s.pbr('road', '#ffffff', { albedo: roadTex, rough: 0.3, uv: [1, 300 / TILE] })
  roadMat.clearCoat.isEnabled = true
  roadMat.clearCoat.intensity = 0.6
  roadMat.clearCoat.roughness = 0.12
  const pavement = s.surface('pavement', 'paving', [2, 300 / 4], '#8d949c', 0.6)
  pavement.clearCoat.isEnabled = true
  pavement.clearCoat.intensity = 0.4
  const curb = s.surface('curb', 'concrete', [60, 1], '#77787a')
  const iron = s.pbr('lamp_iron', '#1d2024', { rough: 0.58, metal: 0.3 })
  const sodium = s.glow('sodium', new Color3(1.0, 0.66, 0.32))
  const shopWarm = s.glow('shop_warm', new Color3(0.85, 0.56, 0.3))
  const shopCool = s.glow('shop_cool', new Color3(0.42, 0.55, 0.7))
  const shopDim = s.glow('shop_dim', new Color3(0.16, 0.13, 0.1))
  const facadeMats = [0, 1, 2, 3].map((i) => {
    const tex = s.track(T.facade(scene, `tex_city_facade_${i}`, 512, 1024, 6 + i, 14 + i * 2, 300 + i, true, 0.22 + i * 0.08))
    const m = s.pbr(`facade_${i}`, ['#2c2e33', '#33302c', '#24272d', '#2e2f31'][i], { rough: 0.82, emissiveTex: tex })
    m.emissiveColor = new Color3(0.75, 0.75, 0.75)
    return m
  })

  const haloTex = s.track(T.radialSprite(scene, 'tex_city_halo', 128, '255,255,255', 0.55))
  const halo = (name: string, color: Color3, alpha = 1) => {
    const m = new StandardMaterial(name, scene)
    m.disableLighting = true
    m.emissiveTexture = haloTex
    m.opacityTexture = haloTex
    m.emissiveColor = color
    m.alpha = alpha
    m.alphaMode = 1
    m.disableDepthWrite = true
    m.backFaceCulling = false
    s.track(m)
    return m
  }
  const haloAmber = halo('halo_amber', new Color3(1, 0.62, 0.3), .38)
  const haloHead = halo('halo_head', new Color3(0.95, 0.95, 0.9), .42)
  const haloTail = halo('halo_tail', new Color3(0.9, 0.06, 0.04))
  const streakAmber = halo('streak_amber', new Color3(0.9, 0.52, 0.22), 0.5)

  // ── Street ──────────────────────────────────────────────────────────────
  const roadMesh = s.plane('road', ROAD_W, 300, [0, 0, 70], roadMat)
  roadMesh.rotation.x = Math.PI / 2
  for (const side of [-1, 1]) {
    const walk = s.plane(`pavement_${side}`, 4, 300, [side * (ROAD_W / 2 + 2), 0.15, 70], pavement)
    walk.rotation.x = Math.PI / 2
    s.box(`curb_${side}`, [0.3, 0.16, 300], [side * (ROAD_W / 2 + 0.1), 0.08, 70], curb)
  }

  const scrollers: Scroller[] = []
  const mover = (name: string, z: number, extra = 0) => {
    const node = s.node(name, [0, 0, z])
    scrollers.push({ node, extra })
    return node
  }

  // The blocks and lamps each ride their own scroller, so they can't be
  // merged: every repeated piece is instead a GPU instance of the first one
  // built, one draw call per piece and material instead of one per copy
  // (about 200 draw calls down to about 15 on a phone that was CPU-bound on them).
  const sources = new Map<string, Mesh>()
  const repeat = (key: string, m: Mesh) => {
    const src = sources.get(key)
    if (!src) return sources.set(key, m), m
    const inst = s.instance(src, m.name, [m.position.x, m.position.y, m.position.z], m.parent as TransformNode)
    if (m.rotationQuaternion) inst.rotationQuaternion = m.rotationQuaternion.clone()
    else inst.rotation.copyFrom(m.rotation)
    inst.scaling.copyFrom(m.scaling)
    inst.billboardMode = m.billboardMode
    s.meshes.splice(s.meshes.indexOf(m), 1)
    m.dispose()
    return inst
  }
  // a box of any size as a scaled unit box, so boxes of every size share one source
  // (box UVs run 0–1 per face whatever the size, so the textures sit the same)
  const block = (key: string, name: string, size: [number, number, number], pos: [number, number, number], mat: Material, parent: TransformNode) => {
    const m = s.box(name, [1, 1, 1], pos, mat, parent)
    m.scaling.set(...size)
    return repeat(`${key}:${mat.name}`, m)
  }

  // Building blocks down both sides, with lit shopfronts at street level
  const blocks: { node: TransformNode; side: number; depth: number; height: number }[] = []
  for (const side of [-1, 1]) {
    let z = BACK
    let i = 0
    while (z < BACK + LOOP - 8) {
      const depth = 14 + T.rand() * 12
      const height = 14 + T.rand() * 30
      const width = 10 + T.rand() * 8
      const n = mover(`block_${side}_${i}`, z + depth / 2)
      const x = side * (ROAD_W / 2 + 4 + width / 2)
      block('body', `block_${side}_${i}_body`, [width, height, depth - 0.6], [x, height / 2, 0], facadeMats[(i + (side > 0 ? 1 : 0)) % facadeMats.length], n)
      block('cornice', `block_${side}_${i}_cornice`, [width + 0.4, 0.5, depth - 0.2], [x, height + 0.25, 0], curb, n)
      const shop = T.rand()
      block('shop', `block_${side}_${i}_shop`, [0.1, 2.6, depth - 3], [side * (ROAD_W / 2 + 4.0), 1.75, 0], shop < 0.3 ? shopWarm : shop < 0.5 ? shopCool : shopDim, n)
      block('awning', `block_${side}_${i}_awning`, [1.2, 0.12, depth - 2.6], [side * (ROAD_W / 2 + 3.5), 3.25, 0], iron, n)
      blocks.push({ node: n, side, depth, height })
      z += depth + (T.rand() < 0.3 ? 6 + T.rand() * 4 : 0)
      i++
    }
  }

  // Neon blade signs jutting out over the pavement from some of the shopfronts,
  // facing down the avenue: five designs built once, every other copy an instance
  const NEONS: [string[], Color3][] = [
    [['B', 'A', 'R'], new Color3(1, 0.16, 0.22)],
    [['H', 'O', 'T', 'E', 'L'], new Color3(1, 0.3, 0.62)],
    [['P', 'A', 'W', 'N'], new Color3(0.2, 0.85, 0.95)],
    [['D', 'I', 'N', 'E', 'R'], new Color3(1, 0.62, 0.2)],
    [['C', 'L', 'U', 'B'], new Color3(1, 0.16, 0.22)],
  ]
  const neonTemplates: Mesh[][] = []
  blocks.forEach(({ node, side, depth, height }, i) => {
    // a fixed pattern rather than the seeded random, so the blocks themselves stay as they were
    if ((i * 7 + 3) % 5 > 1 || height < 12) return
    const k = (i * 3 + (side > 0 ? 1 : 0)) % NEONS.length
    const [lines, color] = NEONS[k]
    const h = 0.82 * lines.length + 0.4
    const pos: [number, number, number] = [side * (ROAD_W / 2 + 3.3), 4.1 + h / 2, -depth / 2 + 2.2]
    if (!neonTemplates[k]) {
      const before = s.meshes.length
      D.neon(s, null, `neon_${k}`, lines, pos, 1.25, h, color, { brightness: 2 })
      // and its colour on the wet pavement below
      D.lightPool(s, null, `neon_${k}_pool`, [pos[0], 0.15, pos[2] - 0.6], 3.2, 3.6, color, 0.22)
      neonTemplates[k] = s.meshes.slice(before) as Mesh[]
      for (const m of neonTemplates[k]) m.parent = node
      return
    }
    for (const src of neonTemplates[k]) s.instance(src, `${src.name}_${i}`, [src.position.x, src.position.y, src.position.z], node).rotation.copyFrom(src.rotation)
  })

  // Street lamps: right side on the 20 m grid, left side staggered by 10 m
  for (const side of [1, -1]) {
    for (let k = 0; k < LOOP / LAMP_GAP; k++) {
      const n = mover(`lamp_${side}_${k}`, BACK + k * LAMP_GAP + (side < 0 ? LAMP_GAP / 2 : 0))
      const px = side * (ROAD_W / 2 + 0.5)
      repeat('lamp_pole', s.cyl(`lamp_${side}_${k}_pole`, 0.18, 7.6, [px, 3.8, 0], iron, { tess: 8, parent: n }))
      repeat(`lamp_arm_${side}`, s.rod(`lamp_${side}_${k}_arm`, [px, 7.5, 0], [side * (ROAD_W / 2 - 1.6), 7.65, 0], 0.09, iron, n))
      repeat('lamp_head', s.box(`lamp_${side}_${k}_head`, [0.7, 0.12, 0.32], [side * (ROAD_W / 2 - 1.6), 7.58, 0], sodium, n))
      const h = s.plane(`lamp_${side}_${k}_halo`, .9, .9, [side * (ROAD_W / 2 - 1.6), 7.45, 0], haloAmber, 0, n)
      h.billboardMode = Mesh.BILLBOARDMODE_ALL
      repeat('lamp_halo', h)
      // the lamp's smeared reflection on the wet tarmac
      const r = s.plane(`lamp_${side}_${k}_streak`, 1.1, 9, [side * (ROAD_W / 2 - 1.8), 0.02, -1.5], streakAmber, 0, n)
      r.rotation.x = Math.PI / 2
      repeat('lamp_streak', r)
    }
  }

  // Soft contact shadows under every car (no shadow map on the street)
  const blob = s.track(T.radialSprite(scene, 'tex_car_shadow', 128, '0,0,0', 0.9))
  const blobMat = new StandardMaterial('car_shadow', scene)
  blobMat.disableLighting = true
  blobMat.diffuseColor = Color3.Black()
  blobMat.emissiveColor = Color3.Black()
  blobMat.opacityTexture = blob
  blobMat.alpha = 0.75
  blobMat.disableDepthWrite = true
  s.track(blobMat)
  const shadowUnder = (root: TransformNode, name: string) => {
    const p = s.plane(`${name}_shadow`, 5.6, 2.6, [0, 0.025, 0], blobMat, 0, root)
    p.rotation.x = Math.PI / 2
  }

  // Oncoming traffic in the far lane (a taxi, a sedan, a van), and an SUV ahead in ours
  const TRAFFIC = ['taxi', 'sedan', 'van']
  const cars: TransformNode[] = []
  for (let k = 0; k < 3; k++) {
    const n = mover(`oncoming_${k}`, 30 + k * 85, SPEED + 11)
    shadowUnder(await s.model(TRAFFIC[k], `oncoming_${k}_car`, [-CAR_X, 0, 0], -Math.PI / 2, [1, 1, 1], n), `oncoming_${k}`)
    for (const dx of [-0.52, 0.52]) {
      const h = s.plane(`oncoming_${k}_lamp_${dx}`, .65, .65, [-CAR_X + dx, 0.75, -2.5], haloHead, 0, n)
      h.billboardMode = Mesh.BILLBOARDMODE_ALL
      repeat('car_head_halo', h)
    }
    cars.push(n)
  }
  const lead = await s.model('suv', 'lead_car', [CAR_X - 0.15, 0, 34], Math.PI / 2)
  shadowUnder(lead, 'lead')
  const leadTails = [-0.48, 0.48].map((dx) => {
    const h = s.plane(`lead_tail_${dx}`, 0.8, 0.8, [CAR_X - 0.15 + dx, 0.75, 31.5], haloTail)
    h.billboardMode = Mesh.BILLBOARDMODE_ALL
    return repeat('lead_tail_halo', h)
  })

  // Rookie's car (the Don's in the old cutscenes), motionless at the origin
  const car = await s.model('sedan', 'car_don', [CAR_X, 0, 0], Math.PI / 2)
  shadowUnder(car, 'car')
  for (const m of s.materials) {
    if (!(m instanceof PBRMaterial)) continue
    if (m.name.startsWith('headlamp')) m.emissiveColor = new Color3(1, 0.95, 0.85)
    if (m.name.startsWith('tail lamp')) m.emissiveColor = new Color3(0.6, 0.02, 0.02)
    // the glossy glass catches the sky light as a hard white disc on the rear
    // window, right in the chase camera's eye: a duller glass spreads it out
    if (m.name.endsWith('smoked glass')) m.roughness = 0.45
  }

  // Distant skyline (static: at this range the parallax is negligible)
  for (let i = 0; i < 18; i++) {
    const side = i % 2 ? 1 : -1
    const h = 40 + T.rand() * 70
    const w = 14 + T.rand() * 14
    s.box(`tower_${i}`, [w, h, w], [side * (38 + T.rand() * 50), h / 2, 140 + T.rand() * 160], facadeMats[i % 4])
  }

  // The private underpass the car finally turns into
  const portal = mover('portal', 400)
  const concrete = s.surface('portal_concrete', 'concrete', [4, 2], '#6f7072')
  const black = s.pbr('portal_black', '#030304', { rough: 1 })
  // seen from inside once the car is through: nothing but dark
  black.backFaceCulling = false
  s.box('portal_frame_top', [ROAD_W + 6, 3.4, 2.2], [0, 7.2, 0], concrete, portal)
  for (const side of [-1, 1]) s.box(`portal_frame_${side}`, [3.2, 7, 2.2], [side * (ROAD_W / 2 + 1.6), 3.5, 0], concrete, portal)
  s.box('portal_void', [ROAD_W, 5.5, 40], [0, 2.75, 21], black, portal)
  const signTex = s.track(T.sign(scene, 'tex_private_sign', ['PRIVATE ROAD', 'AUTHORISED VEHICLES ONLY'], { accent: '#c99a1c' }))
  s.plane('portal_sign', 6, 1.5, [0, 7.4, -1.15], s.pbr('portal_sign', '#ffffff', { albedo: signTex, rough: 0.6, emissiveTex: signTex }), 0, portal)
  const beacon = s.glow('portal_beacon', new Color3(1, 0.55, 0.12))
  const beacons = [-4, 4].map((x) => s.sphere(`portal_beacon_${x}`, 0.3, [x, 9.1, -0.4], beacon, portal))

  // The destination of a drive: a four-storey brick building at the kerb on
  // our side of the avenue, its name on a board over the entrance. It scrolls
  // in with the trip and the car pulls in beside it.
  const dest = s.node('dest', [0, 0, 200])
  const brick = s.surface('dest_brick', 'brick', [1, 1], '#c98e6e', 0.9)
  const stone = s.surface('dest_stone', 'concrete', [1, 1], '#e4dccb', 0.8)
  const destGlass = s.pbr('dest_glass', '#20364a', { rough: 0.08, metal: 0.4 })
  const destDoor = s.pbr('dest_door', '#2e4a3c', { rough: 0.45 })
  const DW = 8
  const DL = 18
  const DH = 13
  s.tileUV(s.box('dest_body', [DW, DH, DL], [DEST_X + DW / 2, DH / 2, 0], brick, dest), 1.6)
  s.tileUV(s.box('dest_plinth', [0.2, 1.0, DL + 0.1], [DEST_X - 0.05, 0.5, 0], stone, dest), 1)
  s.tileUV(s.box('dest_band', [0.2, 0.3, DL + 0.1], [DEST_X - 0.05, 3.45, 0], stone, dest), 1)
  s.tileUV(s.box('dest_cornice', [0.6, 0.5, DL + 0.6], [DEST_X - 0.1, DH - 0.25, 0], stone, dest), 1)
  for (const y of [4.6, 7.6, 10.6])
    for (let i = 0; i < 6; i++) {
      const z = -7.5 + i * 3
      s.box(`dest_win_${y}_${i}`, [0.12, 1.9, 1.3], [DEST_X - 0.05, y + 0.95, z], stone, dest)
      s.box(`dest_glass_${y}_${i}`, [0.06, 1.7, 1.1], [DEST_X - 0.1, y + 0.95, z], destGlass, dest)
      s.box(`dest_bar_${y}_${i}`, [0.08, 0.06, 1.1], [DEST_X - 0.13, y + 1.2, z], stone, dest)
      s.box(`dest_sill_${y}_${i}`, [0.3, 0.08, 1.5], [DEST_X - 0.12, y - 0.04, z], stone, dest)
    }
  // ground floor: the entrance between two wide windows, steps, a canopy, lamps, shrubs
  for (const z of [-5.5, 5.5]) {
    s.box(`dest_shopwin_${z}`, [0.12, 2.0, 4.2], [DEST_X - 0.06, 2.0, z], stone, dest)
    s.box(`dest_shopglass_${z}`, [0.06, 1.8, 4.0], [DEST_X - 0.11, 2.0, z], destGlass, dest)
  }
  s.box('dest_door_frame', [0.14, 2.9, 2.2], [DEST_X - 0.07, 1.45, 0], stone, dest)
  s.box('dest_door', [0.08, 2.6, 1.8], [DEST_X - 0.12, 1.45, 0], destDoor, dest)
  for (let i = 0; i < 2; i++) s.tileUV(s.box(`dest_step_${i}`, [0.4, 0.15, 2.6 - i * 0.3], [DEST_X - 0.2 - (1 - i) * 0.35, 0.22 + i * 0.15, 0], stone, dest), 1)
  s.box('dest_canopy', [1.4, 0.12, 3.0], [DEST_X - 0.7, 3.05, 0], destDoor, dest)
  const destLamp = s.glow('dest_lamp', new Color3(1, 0.86, 0.6))
  for (const z of [-1.4, 1.4]) s.box(`dest_lamp_${z}`, [0.2, 0.36, 0.2], [DEST_X - 0.15, 2.4, z], destLamp, dest)
  const shrub = s.pbr('dest_shrub', '#4f7a38', { rough: 0.85 })
  const planter = s.pbr('dest_planter', '#5a5650', { rough: 0.7 })
  for (const z of [-2.1, 2.1]) {
    s.box(`dest_planter_${z}`, [0.6, 0.5, 0.6], [DEST_X - 0.6, 0.4, z], planter, dest)
    s.sphere(`dest_shrub_${z}`, 0.8, [DEST_X - 0.6, 1.0, z], shrub, dest)
  }
  const gateSignTex = s.track(new DynamicTexture('tex_gate_sign', { width: 1024, height: 192 }, scene, true))
  const signMat = s.pbr('dest_sign', '#ffffff', { albedo: gateSignTex, emissiveTex: gateSignTex, rough: 0.5 })
  signMat.emissiveColor = new Color3(0.35, 0.35, 0.35)
  s.box('dest_sign_board', [0.12, 1.2, 6.4], [DEST_X - 0.1, 3.9, 0], destDoor, dest)
  s.plane('dest_sign', 6.2, 1.1, [DEST_X - 0.17, 3.9, 0], signMat, Math.PI / 2, dest)
  const paintGate = (name: string) => {
    const c = gateSignTex.getContext() as unknown as CanvasRenderingContext2D
    c.fillStyle = '#1f3a2e'
    c.fillRect(0, 0, 1024, 192)
    c.fillStyle = '#d9b46a'
    c.fillRect(0, 0, 1024, 8)
    c.fillRect(0, 184, 1024, 8)
    c.fillStyle = '#f2e6c8'
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.font = `700 112px 'Barlow Semi Condensed', Oswald, 'Arial Narrow', sans-serif`
    c.fillText(name.toUpperCase(), 512, 100, 960)
    gateSignTex.update(true)
  }
  // drawn once now: a texture never drawn is never "ready", and the set would wait on it
  paintGate('')
  // one draw call per material instead of one per window, sill and bar (about 95 down to 8)
  s.mergeChildren(dest, 'dest')

  // Pieces that are hidden until the story needs them (the destination, the
  // underpass) would compile their shaders and GPU pipelines the first time
  // they show, mid-drive: a freeze of up to 2 s on a phone. They stay on for
  // the set's first frames instead, drawn whether in view or not (far off in
  // the fog, past the far clip), so that cost lands under the loading screen.
  const warmMeshes = [dest, portal].flatMap((n) => n.getChildMeshes(false))
  for (const m of warmMeshes) m.alwaysSelectAsActiveMesh = true
  let warmFrames = 3


  // A morning sky behind the skyline, shown only by the 'morning' event (at
  // night the clear colour is the sky)
  const skyTex = s.track(new DynamicTexture('tex_city_sky', { width: 16, height: 256 }, scene, false))
  const skyCtx = skyTex.getContext() as unknown as CanvasRenderingContext2D
  const paintSky = (stops: readonly (readonly [number, string])[]) => {
    const skyGrad = skyCtx.createLinearGradient(0, 0, 0, 256)
    for (const [at, colour] of stops) skyGrad.addColorStop(at, colour)
    skyCtx.fillStyle = skyGrad
    skyCtx.fillRect(0, 0, 16, 256)
    skyTex.update(true)
  }
  // night: deep blue overhead, the city's sodium glow low on the cloud
  paintSky([[0, '#04060d'], [0.45, '#0e1326'], [0.75, '#2a2130'], [0.9, '#3d2a2e'], [1, '#2c2024']])
  // kept under the bloom threshold, or the bright sky would wash a milky glow over the street
  const skyMat = s.glow('city_sky', new Color3(0.88, 0.88, 0.88), skyTex)
  skyMat.fogEnabled = false
  // inside the camera's far clip (220 m), past where the avenue fades out
  const sky = s.plane('city_sky', 560, 200, [0, 92, 208], skyMat)
  sky.applyFog = false

  // ── Lighting ────────────────────────────────────────────────────────────
  const ambient = lit.hemi(0.8, new Color3(0.57, 0.58, 0.66), new Color3(0.22, 0.18, 0.14))
  // shopfront spill along the kerb keeps the bodywork readable between lamps
  const fill = lit.point('street_fill', new Vector3(CAR_X + 3.5, 2.2, 0.5), 18, new Color3(0.95, 0.72, 0.5), 9)
  // a soft fill: no hard highlight of its own on the glass
  fill.specular = Color3.Black()
  const moon = lit.directional('moon', new Vector3(0.4, -1, 0.6), 0.35, MOON)
  // two sodium spots ride the lamps nearest the car, fading as each lamp passes
  const lampR = lit.spot('lamp_r', new Vector3(ROAD_W / 2 - 1.6, 7.3, 0), new Vector3(-0.35, -1, 0), 1.6, 0, new Color3(1, 0.66, 0.36), 16)
  const lampL = lit.spot('lamp_l', new Vector3(-(ROAD_W / 2 - 1.6), 7.3, 0), new Vector3(0.35, -1, 0), 1.6, 0, new Color3(1, 0.66, 0.36), 16)
  const beam = lit.spot('car_beam', new Vector3(-2.6, 0.75, 0), new Vector3(-1, -0.12, 0), 0.8, 90, new Color3(1, 0.94, 0.82), 32)
  beam.parent = car
  beam.specular = Color3.Black()
  lit.enableGlow(0.35)
  for (const m of s.meshes) if (/(_body$|_shop$|portal_sign|^neon_\d+_(pool|spill|board))/.test(m.name)) lit.glow?.addExcludedMesh(m as Mesh)
  // seen from behind (the chase camera) his own headlamps would bloom through the cabin glass
  for (const m of car.getChildMeshes()) if (/headlamp/i.test(m.material?.name ?? '')) lit.glow?.addExcludedMesh(m as Mesh)

  const drops = s.track(rain(scene, quality, () => scene.activeCamera?.position ?? Vector3.Zero()))
  // the car is moving: rain streaks slant back past it
  drops.direction1 = new Vector3(-0.5, -14, -5.5)
  drops.direction2 = new Vector3(-0.3, -16, -4.5)

  lit.raiseLightLimit(s.materials)
  lit.bakeProbe(new Vector3(CAR_X, 3, 0), s.meshes.filter((m) => !/(halo|streak|lamp_.*_head|oncoming_.*_lamp|lead_tail|dest_|_shadow)/.test(m.name)), 0.6)
  // the portal and its beacons come and go, the oncoming cars hide behind it
  s.freezeStatic([...scrollers.map((x) => x.node), car, lead, dest], { merge: true, keep: [portal, sky, ...cars] })

  // ── Morning ─────────────────────────────────────────────────────────────
  // A clear sunny day: blue sky, sun behind the car lighting the right-hand
  // fronts and the road, dry tarmac, no rain, lamps off. The far end of the
  // avenue (where it wraps, ~180 m) fades into the pale horizon; the skyline
  // towers stand clear of the haze against the sky.
  let day = false
  const morning = (instant: boolean) => {
    if (day) return
    day = true
    paintSky([[0, '#1857bd'], [0.45, '#3681d8'], [0.8, '#7fb3e8'], [1, '#c4dbf0']])
    for (const m of s.meshes) if (/^neon_/.test(m.name)) m.setEnabled(false)
    // the sky's lower edge as drawn (its colour × the 0.88 level), so haze and sky meet seamlessly
    const horizon = new Color3(0.68, 0.76, 0.83)
    scene.clearColor.set(horizon.r, horizon.g, horizon.b, 1)
    scene.fogMode = 3
    scene.fogStart = 110
    scene.fogEnd = 182
    scene.fogColor = horizon
    for (const m of s.meshes) if (/^tower_/.test(m.name)) m.applyFog = false
    ambient.intensity = 1.0
    ambient.diffuse = new Color3(0.78, 0.86, 1)
    ambient.groundColor = new Color3(0.58, 0.52, 0.44)
    moon.direction = new Vector3(0.45, -0.72, 0.55).normalize()
    moon.diffuse = new Color3(1, 0.95, 0.85)
    moon.specular = new Color3(0.6, 0.57, 0.5)
    moon.intensity = 3.4
    fill.intensity = 4
    lampR.intensity = lampL.intensity = 0
    beam.intensity = 0
    if (lit.glow) lit.glow.intensity = 0.1
    // lamps and shop lights off in daylight, shop windows clear glass, no wet reflections
    sodium.emissiveColor = new Color3(0.22, 0.2, 0.17)
    shopWarm.emissiveColor = new Color3(0.42, 0.36, 0.28)
    shopCool.emissiveColor = new Color3(0.3, 0.38, 0.46)
    shopDim.emissiveColor = new Color3(0.2, 0.26, 0.32)
    haloAmber.alpha = 0
    streakAmber.alpha = 0
    haloHead.alpha = 0
    destLamp.emissiveColor = new Color3(0.5, 0.45, 0.36)
    signMat.emissiveColor = new Color3(0.15, 0.15, 0.15)
    for (const m of [roadMat, pavement]) m.clearCoat.isEnabled = false
    roadMat.roughness = 0.85
    // daytime brick and stone, windows dark glass
    facadeMats.forEach((m, i) => {
      m.albedoTexture = s.track(T.facade(scene, `tex_city_facade_day_${i}`, 512, 1024, 6 + i, 14 + i * 2, 300 + i, false, 0.04))
      m.albedoColor = new Color3(...([[1, 0.9, 0.8], [0.92, 0.86, 0.8], [0.96, 0.88, 0.78], [0.86, 0.86, 0.88]] as const)[i])
      m.emissiveColor = new Color3(0, 0, 0)
    })
    drops.stop()
    if (instant) drops.reset()
    lit.refreshProbe()
  }


  // ── Motion ──────────────────────────────────────────────────────────────
  const scrollTex = [roadTex, pavement.albedoTexture, pavement.bumpTexture, pavement.metallicTexture].filter(Boolean) as Texture[]
  let travel = 0
  let clock = 0
  let portalOn = false
  let speed = SPEED
  // the player's trip, while a drive beat is on
  let trip: { left: number; on: boolean; arrived: boolean } | null = null

  // As the car pulls in, the chase camera rides over with it and turns toward the destination's door
  let pull = 0
  const chaseFollow = () => {
    const dx = (car.position.x - CAR_X) * 0.8
    return { pos: [dx - pull * 0.6, 0, 0] as [number, number, number], target: [dx + pull * 4, 0, 0] as [number, number, number] }
  }

  const drive: DriveControl = {
    start(destination, distance) {
      trip = { left: distance, on: false, arrived: false }
      speed = 0
      paintGate(destination)
      dest.setEnabled(true)
      car.position.x = CAR_X
      car.rotation.y = Math.PI / 2
      pull = 0
      // our lane is clear: the player sets the pace, so nothing to run into
      lead.setEnabled(false)
      for (const h of leadTails) h.setEnabled(false)
    },
    throttle(on) {
      if (trip && !trip.arrived) trip.on = on
    },
    state() {
      return { left: trip?.left ?? 0, speed, arrived: trip?.arrived ?? false }
    },
    // The car stays parked at the destination: the story cuts to the place
    // itself, and the city must not jump back to mid-lane while it fades out.
    // The next trip (start) puts everything back.
    stop() {
      trip = null
      speed = 0
    },
  }

  const env: GameEnvironment = {
    id: 'city',
    marks: {},
    shots: {
      drive_aerial: { pos: [15, 17, -27], target: [CAR_X, 0.4, 8], fov: 0.86, to: { pos: [9, 9.5, -13], target: [CAR_X, 0.8, 9] }, duration: 7, handheld: 0.004 },
      drive_side: { pos: [4.7, 0.5, -3.6], target: [1.7, 0.9, 1.4], fov: 0.72, handheld: 0.014 },
      drive_rear: { pos: [3.3, 2.0, -9], target: [CAR_X, 1.1, 12], fov: 0.74, to: { pos: [2.9, 1.8, -7.6], target: [CAR_X, 1.1, 12] }, duration: 6, handheld: 0.012 },
      drive_window: { pos: [3.45, 1.38, -1.6], target: [2.8, 1.24, -0.2], fov: 0.5, handheld: 0.01 },
      drive_front: { pos: [CAR_X - 0.6, 1.0, 11], target: [CAR_X, 0.85, 0], fov: 0.42, handheld: 0.012 },
      // third person, behind and above the car: the road ahead, the destination when it comes
      drive_chase: { pos: [CAR_X, 2.75, -8.6], target: [CAR_X, 1.2, 9], fov: 0.8, handheld: 0.004, follow: chaseFollow },
      portal_approach: { pos: [4.0, 2.6, -11.5], target: [CAR_X, 1.6, 30], fov: 0.72, to: { pos: [3.4, 2.1, -8.5], target: [CAR_X, 1.4, 20] }, duration: 5, handheld: 0.01 },
    },
    bounds: { minX: -6, maxX: 6, minZ: -20, maxZ: 20 },
    obstacles: [],
    followYaw: 0,
    lighting: lit,
    walkable: [],
    drive,
    event(name, instant = false) {
      if (name === 'portal') {
        portalOn = true
        portal.setEnabled(true)
        portal.position.z = instant ? 0 : 62
      } else if (name === 'morning') morning(instant)
      else console.warn(`[city] unknown event ${name}`)
    },
    update(dt) {
      clock += dt
      if (warmFrames > 0 && --warmFrames === 0) {
        for (const m of warmMeshes) m.alwaysSelectAsActiveMesh = false
        if (!trip) dest.setEnabled(false)
        if (!portalOn) portal.setEnabled(false)
      }
      if (trip) {
        // never faster than can still stop at the destination
        const cap = Math.sqrt(2 * BRAKE * Math.max(0, trip.left))
        const want = Math.min(trip.on ? TOP : 0, cap)
        const rate = want > speed ? ACCEL : trip.on ? BRAKE : COAST
        speed = want > speed ? Math.min(want, speed + rate * dt) : Math.max(want, speed - rate * dt)
        trip.left = Math.max(0, trip.left - speed * dt)
        if (!trip.arrived && trip.left < 0.4 && speed < 0.3) {
          trip.arrived = true
          trip.on = false
          speed = 0
        }
        dest.position.z = trip.left + DEST_AHEAD
        // ease over to the kerb on the last stretch, steering into it and straightening up
        const t = Math.min(1, Math.max(0, (PULL - trip.left) / PULL))
        pull = t * t * (3 - 2 * t)
        car.position.x = CAR_X + (KERB_X - CAR_X) * t * t * (3 - 2 * t)
        car.rotation.y = Math.PI / 2 + Math.atan(((KERB_X - CAR_X) * 6 * t * (1 - t)) / PULL)
      }
      const step = speed * dt
      travel += step
      for (const t of scrollTex) t.vOffset = (t.vOffset + step / (t === scrollTex[0] ? TILE : 4)) % 1
      for (const sc of scrollers) {
        if (sc.node === portal) continue
        sc.node.position.z = wrap(sc.node.position.z - step - sc.extra * dt)
      }
      if (portalOn && portal.position.z > -30) portal.position.z -= step
      for (const [i, b] of beacons.entries()) b.visibility = Math.sin(clock * 6 + i * Math.PI) > 0 ? 1 : 0.15
      // Lamp spots: centred on the nearest lamp each side, cos² falloff
      const zr = wrapGap(BACK - travel)
      const zl = wrapGap(BACK + LAMP_GAP / 2 - travel)
      lampR.position.z = zr
      lampL.position.z = zl
      lampR.intensity = day ? 0 : 520 * Math.cos((Math.PI * zr) / LAMP_GAP) ** 2
      lampL.intensity = day ? 0 : 380 * Math.cos((Math.PI * zl) / LAMP_GAP) ** 2
      // a little suspension movement, none at a standstill
      const ride = Math.min(1, speed / SPEED)
      car.position.y = (Math.sin(clock * 7.3) * 0.006 + Math.sin(clock * 2.1) * 0.004) * ride
      for (const n of cars) n.setEnabled(!portalOn || n.position.z > 10)
    },
    adopt(_meshes: AbstractMesh[], materials: Material[]) {
      lit.raiseLightLimit(materials)
    },
    dispose() {
      lit.dispose()
      s.dispose()
      scene.fogMode = 0
      scene.clearColor.set(0.02, 0.02, 0.025, 1)
    },
  }
  return env
}

export default build
