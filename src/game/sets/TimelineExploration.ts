import { Color3, DynamicTexture, Vector3 } from '@render/core'
import type { AbstractMesh, Material, Mesh } from '@render/core'
import { dust } from '@render/Effects'
import { LightingManager } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import { SetBuilder } from '@render/SetBuilder'
import type { EnvContext, EnvironmentFactory, GameEnvironment } from './types'
import { PAST_DATE } from '../narrative/ExperimentState'

// The past: the same city, one year earlier, at dawn. A short stretch of the
// east pavement of an avenue Rookie knows: a news kiosk, a public information
// display, a gig poster on the hoarding, Rossi's diner (still open), and across
// the road Meridian Tower as a bare steel frame under a crane. The street runs
// along +Z; the explore area is the pavement (x ≈ 5.5–8.5).

const ROAD = 5
const WALK = 9
// across the avenue, seen through the vacant lot where the west block would be
const TOWER = { x: -22, z: 20 }

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'past')
  const lit = new LightingManager(scene, quality)
  const hi = quality === 'high'
  T.reseed(2025)

  scene.fogMode = 2
  scene.fogDensity = 0.011
  scene.fogColor = new Color3(0.62, 0.6, 0.62)
  scene.clearColor.set(0.66, 0.62, 0.62, 1)

  // ── Materials ───────────────────────────────────────────────────────────
  const roadTex = s.track(T.road(scene, hi ? 1024 : 512))
  const roadMat = s.pbr('past_road', '#c4c2bf', { albedo: roadTex, rough: 0.75, uv: [1, 120 / 12] })
  const pavement = s.surface('past_pavement', 'paving', [2, 30], '#c3c0b8', 0.85)
  const curb = s.surface('past_curb', 'concrete', [40, 1], '#9a9893')
  const steel = s.pbr('past_steel', '#4c4f55', { rough: 0.5, metal: 0.7 })
  const rust = s.pbr('past_rust', '#7a4a2c', { rough: 0.7, metal: 0.4 })
  const paint = s.pbr('past_paint', '#2e3138', { rough: 0.55, metal: 0.2 })
  const cream = s.pbr('past_cream', '#d8cfb8', { rough: 0.6 })
  const glass = s.pbr('past_glass', '#7f95a4', { rough: 0.1, metal: 0.5 })
  const facades = [0, 1, 2].map((i) => {
    const tex = s.track(T.facade(scene, `tex_past_facade_${i}`, 512, 1024, 5 + i, 10 + i * 2, 700 + i, false, 0.15))
    return s.pbr(`past_facade_${i}`, '#ffffff', { albedo: tex, rough: 0.85 })
  })
  const signMat = (name: string, lines: string[], o: Parameters<typeof T.sign>[3] = {}) => {
    const tex = s.track(T.sign(scene, `tex_${name}`, lines, o))
    return s.pbr(name, '#ffffff', { albedo: tex, rough: 0.5, emissiveTex: o.bg === '#05080c' ? tex : undefined })
  }

  // ── Street ──────────────────────────────────────────────────────────────
  const road = s.plane('past_road', ROAD * 2, 120, [0, 0, 20], roadMat)
  road.rotation.x = Math.PI / 2
  for (const side of [-1, 1]) {
    const w = s.plane(`past_pavement_${side}`, WALK - ROAD, 120, [side * (ROAD + WALK) / 2, 0.02, 20], pavement)
    w.rotation.x = Math.PI / 2
    s.box(`past_curb_${side}`, [0.3, 0.16, 120], [side * (ROAD + 0.1), 0.08, 20], curb)
  }
  const walkable = s.box('past_walk_floor', [WALK - ROAD, 0.1, 120], [(ROAD + WALK) / 2, -0.03, 20], pavement)
  walkable.isVisible = false
  walkable.metadata = { walkable: true }

  // Buildings down the east side (ours), the west side across the road
  const shopFront = (name: string, z0: number, z1: number, lines: string[], o: NonNullable<Parameters<typeof T.sign>[3]>) => {
    const zc = (z0 + z1) / 2
    s.box(`${name}_glass`, [0.05, 2.4, z1 - z0 - 0.6], [WALK - 0.02, 1.4, zc], glass)
    s.plane(`${name}_sign`, z1 - z0 - 0.8, 0.8, [WALK - 0.05, 3.1, zc], signMat(`${name}_sign_mat`, lines, o), Math.PI / 2)
    s.box(`${name}_awning`, [1.1, 0.08, z1 - z0 - 0.4], [WALK - 0.55, 2.65, zc], o.accent ? s.pbr(`${name}_awning_mat`, o.accent, { rough: 0.8 }) : paint)
  }
  const blocks: [number, number, number][] = [
    [-14, -2, 22],
    [-2, 12, 16],
    [12, 24, 28],
    [24, 40, 19],
  ]
  blocks.forEach(([z0, z1, h], i) => {
    s.box(`past_block_${i}`, [12, h, z1 - z0 - 0.3], [WALK + 6, h / 2, (z0 + z1) / 2], facades[i % 3])
  })
  shopFront('past_pharmacy', -12, -4, ['PARK STREET PHARMACY'], { bg: '#1f4d3a', fg: '#f2efe6' })
  shopFront('past_diner', 12.5, 19.5, ["ROSSI'S DINER", 'OPEN 24 HOURS · SINCE 1987'], { bg: '#7a1d22', fg: '#f6e6c8', accent: '#7a1d22' })
  shopFront('past_records', 20, 24, ['DISC & TAPE'], { bg: '#1c2a4a', fg: '#e9d9a8' })
  for (let i = 0; i < 4; i++) {
    const h = 14 + T.rand() * 18
    const z = -14 + i * 14
    if (i === 2) continue // the vacant lot opposite the tower
    s.box(`past_west_${i}`, [12, h, 13.5], [-(WALK + 6), h / 2, z + 6], facades[(i + 1) % 3])
  }
  // the hoarding with the gig poster, beside the kiosk
  s.box('past_hoarding', [0.15, 2.6, 5], [WALK - 0.1, 1.3, -1.5], paint)
  s.plane('past_poster', 1.3, 1.8, [WALK - 0.2, 1.55, -1.5], signMat('past_poster_mat', ['THE MIDNIGHT', 'ORCHESTRA', 'LIVE AT THE PALACE', 'THIS SATURDAY · 9PM'], { w: 256, h: 384, bg: '#2b1838', fg: '#f3c66b', accent: '#c03a6b' }), Math.PI / 2)
  s.plane('past_poster_2', 1.3, 1.8, [WALK - 0.2, 1.55, -3.1], signMat('past_poster2_mat', ['MERIDIAN', 'TOWER', 'LIVE ABOVE IT ALL', 'OPENING 2026'], { w: 256, h: 384, bg: '#d8d4cb', fg: '#1d2a3a', accent: '#b08a3a' }), Math.PI / 2)

  // ── The news kiosk ──────────────────────────────────────────────────────
  const kiosk = s.node('past_kiosk', [8.1, 0, 3.6])
  s.box('past_kiosk_body', [1.5, 2.3, 2.0], [0.2, 1.15, 0], s.pbr('past_kiosk_green', '#24493a', { rough: 0.6 }), kiosk)
  s.box('past_kiosk_roof', [1.9, 0.15, 2.4], [0.1, 2.38, 0], paint, kiosk)
  s.box('past_kiosk_counter', [0.5, 0.08, 1.8], [-0.7, 1.0, 0], cream, kiosk)
  const paperTex = new DynamicTexture('tex_past_paper', { width: 384, height: 512 }, scene, true)
  s.track(paperTex)
  {
    const c = paperTex.getContext() as unknown as CanvasRenderingContext2D
    c.fillStyle = '#ece6d8'
    c.fillRect(0, 0, 384, 512)
    c.fillStyle = '#16161a'
    c.textAlign = 'center'
    c.font = '700 44px Georgia, serif'
    c.fillText('THE CITY HERALD', 192, 60)
    c.fillRect(20, 76, 344, 3)
    c.font = '600 18px Oswald, sans-serif'
    c.fillText(`${PAST_DATE.day}, ${PAST_DATE.long}`, 192, 104)
    c.fillRect(20, 116, 344, 1)
    c.font = '700 34px Georgia, serif'
    c.fillText('MERIDIAN TOWER:', 192, 168)
    c.fillText('FIRST STEEL RISES', 192, 208)
    c.fillStyle = '#6b6658'
    c.fillRect(30, 232, 324, 150)
    c.fillStyle = '#16161a'
    for (let i = 0; i < 6; i++) c.fillRect(30, 400 + i * 16, i % 3 === 2 ? 220 : 324, 6)
    paperTex.update(true)
  }
  const paperMat = s.pbr('past_paper', '#ffffff', { albedo: paperTex, rough: 0.8 })
  for (let i = 0; i < 3; i++) {
    const p = s.plane(`past_paper_${i}`, 0.42, 0.56, [-0.7, 1.05, -0.6 + i * 0.6], paperMat, 0, kiosk)
    // lying on the counter, tilted toward the pavement
    p.rotation.set(Math.PI / 2 - 0.35, Math.PI / 2, 0)
  }

  // ── Public information display ──────────────────────────────────────────
  const infoTex = new DynamicTexture('tex_past_info', { width: 256, height: 512 }, scene, true)
  s.track(infoTex)
  {
    const c = infoTex.getContext() as unknown as CanvasRenderingContext2D
    c.fillStyle = '#05080c'
    c.fillRect(0, 0, 256, 512)
    c.fillStyle = '#f0b44a'
    c.textAlign = 'center'
    c.font = '600 22px Oswald, sans-serif'
    c.fillText('CITY INFORMATION', 128, 44)
    c.fillStyle = '#e8f2fa'
    c.font = '700 64px Oswald, sans-serif'
    c.fillText('06:48', 128, 140)
    c.font = '600 30px Oswald, sans-serif'
    c.fillText(PAST_DATE.short, 128, 190)
    c.fillStyle = '#7fb8e6'
    c.font = '500 22px Oswald, sans-serif'
    c.fillText('7°C · LIGHT CLOUD', 128, 240)
    c.fillStyle = '#f0b44a'
    c.fillText('ROUTE 12 · 4 MIN', 128, 310)
    c.fillText('ROUTE 31 · 9 MIN', 128, 345)
    c.fillStyle = '#e8f2fa'
    c.font = '500 18px Oswald, sans-serif'
    c.fillText('MERIDIAN TOWER WORKS:', 128, 410)
    c.fillText('LANE CLOSURES UNTIL 2026', 128, 436)
    infoTex.update(true)
  }
  const info = s.node('past_info', [5.75, 0, 8.6])
  s.box('past_info_post', [0.3, 2.4, 0.9], [0, 1.2, 0], steel, info)
  const infoScreen = s.plane('past_info_screen', 0.75, 1.5, [0.16, 1.45, 0], s.glow('past_info_mat', new Color3(1, 1, 1), infoTex), -Math.PI / 2, info)
  lit.glow?.addExcludedMesh(infoScreen)

  // ── Meridian Tower: a steel frame and a crane, years from finished ──────
  const tower = s.node('past_tower', [TOWER.x, 0, TOWER.z])
  const floors = 14
  for (let f = 0; f <= floors; f++) s.box(`past_tower_floor_${f}`, [12, 0.35, 12], [0, f * 3.6, 0], f < 4 ? s.pbr('past_concrete', '#8d8a85', { rough: 0.9 }) : steel, tower)
  for (const x of [-6, -2, 2, 6]) for (const z of [-6, -2, 2, 6]) s.box(`past_tower_col_${x}_${z}`, [0.4, floors * 3.6, 0.4], [x, (floors * 3.6) / 2, z], rust, tower)
  s.box('past_crane_mast', [1.2, 70, 1.2], [8, 35, 2], s.pbr('past_crane', '#c99a1c', { rough: 0.6, metal: 0.4 }), tower)
  s.box('past_crane_jib', [36, 1.0, 1.0], [-4, 69, 2], s.pbr('past_crane', '#c99a1c', { rough: 0.6, metal: 0.4 }), tower)
  s.box('past_crane_cab', [2.2, 2, 2], [9.5, 67, 2], cream, tower)
  s.plane('past_tower_sign', 9, 2.6, [0, 5.2, -6.3], signMat('past_tower_sign_mat', ['MERIDIAN TOWER', 'COMPLETION 2026'], { bg: '#d8d4cb', fg: '#1d2a3a', accent: '#b08a3a' }), 0, tower)

  // ── Street life: an old delivery van, a lamp post, a bench ──────────────
  // parked further up the avenue, out of the way of the wide shots
  const van = s.node('past_van', [ROAD - 1.2, 0, 30])
  s.box('past_van_body', [2.0, 2.0, 4.6], [0, 1.35, 0], cream, van)
  s.box('past_van_cab', [1.95, 1.2, 1.2], [0, 1.0, 2.9], cream, van)
  s.box('past_van_glass', [1.9, 0.6, 0.05], [0, 1.4, 3.52], glass, van)
  s.plane('past_van_sign', 3.6, 0.7, [1.02, 1.7, 0], signMat('past_van_sign_mat', ['LUCCI BAKERY · FRESH DAILY'], { bg: '#d8cfb8', fg: '#7a1d22' }), -Math.PI / 2, van)
  for (const [x, z] of [[-0.95, -1.5], [0.95, -1.5], [-0.95, 2.6], [0.95, 2.6]]) s.cyl(`past_van_wheel_${x}_${z}`, 0.7, 0.3, [x, 0.35, z], s.pbr('past_tyre', '#121214', { rough: 0.9 }), { parent: van, tess: 16 }).rotation.z = Math.PI / 2
  for (const z of [-6, 6, 18]) {
    s.cyl(`past_lamp_${z}`, 0.16, 6, [ROAD + 0.5, 3, z], steel, { tess: 8 })
    s.box(`past_lamp_head_${z}`, [0.6, 0.12, 0.3], [ROAD - 0.3, 6, z], steel)
  }
  s.box('past_bench', [0.5, 0.45, 1.8], [WALK - 0.5, 0.45, 11], s.pbr('past_bench_wood', '#6a4a30', { rough: 0.7 }))

  // ── Lighting: a low dawn sun down the avenue ────────────────────────────
  lit.hemi(1.0, new Color3(0.86, 0.84, 0.9), new Color3(0.32, 0.29, 0.27))
  const sun = lit.spot('dawn_sun', new Vector3(34, 30, -30), new Vector3(-0.6, -0.55, 0.7), 1.0, 2200, new Color3(1, 0.8, 0.6), 140)
  lit.enableShadows(sun, hi ? 2048 : 1024)
  const arrival = lit.point('arrival_flash', new Vector3(6.6, 1, -4), 0, new Color3(0.5, 0.75, 1), 12)
  lit.enableGlow(0.25)
  s.track(dust(scene, quality, new Vector3(5, 0.3, -8), new Vector3(9, 4, 22), true))
  for (const m of s.meshes) if (/^(past_kiosk|past_van|past_info|past_hoarding|past_bench|past_lamp)/.test(m.name)) lit.castShadow(m)
  lit.raiseLightLimit(s.materials)
  lit.bakeProbe(new Vector3(6.5, 2, 4), s.meshes, 0.8)
  s.freezeStatic([], { merge: true })

  // ── Events ──────────────────────────────────────────────────────────────
  let flashT = 0
  let distortT = 0
  const baseFog = scene.fogDensity
  const baseClear = scene.clearColor.clone()

  const env: GameEnvironment = {
    id: 'past',
    marks: {
      wake_spot: [6.7, -4.5],
      // the pavement just ahead of him, where he looks as he comes to
      wake_ground: [6.7, -3.6, 0],
      kiosk: [7.35, 3.6],
      newspaper_stand: [6.55, 3.4],
      display: [5.9, 8.6],
      display_stand: [6.95, 8.4],
      poster: [WALK - 0.2, -1.5],
      poster_stand: [7.75, -1.4],
      tower: [TOWER.x, TOWER.z],
      tower_look: [6.0, 12.5],
      diner: [WALK, 16],
      diner_stand: [7.7, 15.6],
      corner: [6.9, 21.5],
      street_mid: [6.8, 5.5],
    },
    shots: {
      street_wide: { pos: [-2.5, 1.7, -11], target: [6.6, 1.1, -3.6], fov: 0.82, to: { pos: [-2.0, 1.9, -10.2], target: [6.6, 1.2, -3.2] }, duration: 8, handheld: 0.006 },
      // low, looking up at him standing on the pavement
      wake_low: { pos: [5.4, 0.45, -2.3], target: [6.7, 1.05, -4.5], fov: 0.7, handheld: 0.004 },
      paper_close: { pos: [6.75, 1.75, 3.0], target: [7.42, 1.05, 3.6], fov: 0.68, handheld: 0.003 },
      display_close: { pos: [7.75, 1.55, 8.1], target: [5.92, 1.45, 8.6], fov: 0.85, handheld: 0.003 },
      tower_view: { pos: [7.4, 1.7, 13.0], target: [TOWER.x, 24, TOWER.z], fov: 0.72, to: { pos: [7.2, 1.6, 13.6], target: [TOWER.x, 34, TOWER.z] }, duration: 7, handheld: 0.004 },
      diner_view: { pos: [6.0, 1.7, 13.0], target: [WALK, 2.2, 16], fov: 0.7 },
      corner_wide: { pos: [3.2, 1.5, 15.5], target: [6.9, 1.4, 21.5], fov: 0.7, handheld: 0.006 },
    },
    bounds: { minX: ROAD + 0.5, maxX: WALK - 0.5, minZ: -7, maxZ: 22 },
    obstacles: [
      [7.4, 2.4, 9, 4.8],
      [8.6, -4.1, 9, 1.1],
      [5.45, 8.0, 6.1, 9.2],
      [WALK - 0.8, 10, WALK, 12],
    ],
    followYaw: 0,
    cameraBox: { min: [ROAD - 3, 0.3, -12], max: [WALK - 0.3, 6, 26] },
    lighting: lit,
    walkable: [walkable],
    event(name, instant = false) {
      if (name === 'arrive') {
        if (!instant) flashT = 1
      } else if (name === 'distort') {
        if (!instant) distortT = 2.4
      } else console.warn(`[past] unknown event ${name}`)
    },
    update(dt) {
      if (flashT > 0) {
        flashT = Math.max(0, flashT - dt * 0.8)
        arrival.intensity = 180 * flashT * flashT
      }
      // the return signal takes hold: the air thickens and the light goes cold
      if (distortT > 0) {
        distortT = Math.max(0, distortT - dt)
        const k = Math.sin(((2.4 - distortT) / 2.4) * Math.PI)
        scene.fogDensity = baseFog + k * 0.06
        scene.fogColor.set(0.62 - k * 0.3, 0.6 - k * 0.15, 0.62 + k * 0.25)
        scene.clearColor.set(baseClear.r - k * 0.3, baseClear.g - k * 0.15, baseClear.b + k * 0.2, 1)
        arrival.position.set(6.9, 1.2, 21.5)
        arrival.intensity = 120 * k
      }
    },
    adopt(meshes: AbstractMesh[], materials: Material[]) {
      for (const m of meshes) lit.castActorShadow(m as Mesh)
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
