import { Color3, DynamicTexture, Vector3 } from '@render/core'
import type { AbstractMesh, Material, Mesh, PBRMaterial, PointLight, StandardMaterial } from '@render/core'
import { LightingManager, TUNGSTEN, WARM } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import * as D from '@render/Dressing'
import { SetBuilder } from '@render/SetBuilder'
import type { EnvContext, EnvironmentFactory, GameEnvironment } from './types'

// The Don's private training gym from the street, at dusk: a converted
// industrial hall in dark steel and concrete. A deep entrance under a steel
// canopy with the organisation's crest above it; tall windows either side
// look onto the training floor, where fighters are working.
//
// The façade is the plane z = 0, facing the street (−Z). The pavement top is
// at y = 0.16. The entrance recess is 4 m wide; the glass doors sit at z = 1.6.

const FACADE_H = 9.4
const DOOR_Z = 1.6
const KERB = 0.16
const WIN = { x0: 2.55, x1: 6.65, y0: 0.75, y1: 4.15 }

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'gym_ext')
  const lit = new LightingManager(scene, quality)
  const tex = quality === 'high' ? 1024 : 512
  T.reseed(13)

  scene.fogMode = 2
  scene.fogDensity = 0.012
  scene.fogColor = new Color3(0.085, 0.074, 0.075)
  scene.clearColor.set(0.06, 0.055, 0.085, 1)

  // All tiers: tune existing PBR uniforms only; retain material sharing,
  // texture sizes, clear-coat features, geometry and render budgets.
  // ── Materials ───────────────────────────────────────────────────────────
  const paving = s.surface('ext_paving', 'paving', [10, 1.4], '#92918d', 0.68)
  // wet from the afternoon's rain: it picks up the lamps and the neon
  const asphalt = s.pbr('ext_road', '#ffffff', { albedo: s.track(T.road(scene, tex)), rough: 0.36, uv: [3, 1] })
  const concrete = s.surface('ext_concrete', 'concrete', [3, 2], '#8a8c8e')
  const concreteDark = s.surface('ext_concrete_dark', 'concrete', [2, 1], '#55585b')
  const brickIn = s.surface('ext_brick_in', 'brick', [2.5, 2], '#9c8b7b')
  const floorIn = s.surface('ext_floor_in', 'concrete', [3, 3], '#6f7378')
  const cladding = s.pbr('ext_cladding', '#2a2c31', { albedo: s.track(T.steelPanel(scene, tex, 2)), rough: 0.62, metal: 0.12, uv: [10, 2.5] })
  const steel = s.pbr('ext_steel', '#1b1c20', { rough: 0.52, metal: 0.35 })
  const chrome = s.pbr('ext_chrome', '#c9c9c9', { rough: 0.2, metal: 1 })
  const brass = s.pbr('ext_brass', '#b48c4a', { rough: 0.3, metal: 1 })
  const rubber = s.pbr('ext_mat', '#ffffff', { albedo: s.track(T.rubberMat(scene, 512)), rough: 0.92, uv: [3, 2] })
  const ceilingIn = s.pbr('ext_in_ceiling', '#141416', { rough: 0.95 })
  const glass = s.pbr('ext_glass', '#9fb2bf', { rough: 0.08, metal: 0.2 })
  glass.alpha = 0.16
  const lobbyGlow = s.glow('ext_lobby_glow', new Color3(0.36, 0.23, 0.12))
  const clerestory = s.glow('ext_clerestory', new Color3(0.42, 0.28, 0.15))
  const bulb = s.glow('ext_bulb', new Color3(1.35, 1.08, 0.72))
  const redStrip = s.glow('ext_red_strip', new Color3(0.62, 0.05, 0.06))
  const bannerMat = s.pbr('ext_banner', '#ffffff', { albedo: s.track(T.banner(scene)), rough: 0.85 })
  bannerMat.backFaceCulling = false

  // The crest above the entrance: gold on a dark steel roundel.
  const crestTex = s.track(new DynamicTexture('tex_ext_crest', { width: 512, height: 512 }, scene, true))
  {
    const c = crestTex.getContext() as unknown as CanvasRenderingContext2D
    c.clearRect(0, 0, 512, 512)
    T.drawCrest(c as never, 256, 290, 150, '#5a0c12', '#d4aa5c')
    crestTex.hasAlpha = true
    crestTex.update(true)
  }
  const crestMat = s.pbr('ext_crest', '#ffffff', { albedo: crestTex, rough: 0.35, metal: 0.6, emissive: new Color3(0.16, 0.11, 0.05) })
  crestMat.useAlphaFromAlbedoTexture = true
  crestMat.transparencyMode = 1 // alpha test

  // A dusk sky: deep blue overhead, the last warm light low over the city.
  const skyTex = s.track(new DynamicTexture('tex_ext_sky', { width: 16, height: 256 }, scene, false))
  // dusk by default; the `night` event repaints it after dark (Scene 02's late return)
  const paintSky = (stops: [number, string][]) => {
    const c = skyTex.getContext() as unknown as CanvasRenderingContext2D
    const g = c.createLinearGradient(0, 0, 0, 256)
    for (const [at, colour] of stops) g.addColorStop(at, colour)
    c.fillStyle = g
    c.fillRect(0, 0, 16, 256)
    skyTex.update(true)
  }
  paintSky([[0, '#0b0d1c'], [0.45, '#1f1d36'], [0.78, '#5a3341'], [1, '#a4593e']])
  const skyMat = s.glow('ext_sky', new Color3(1, 1, 1), skyTex)
  skyMat.fogEnabled = false

  // ── Street ──────────────────────────────────────────────────────────────
  s.box('pavement', [40, KERB, 5], [0, KERB / 2, -2.5], paving)
  s.box('kerb', [40, 0.18, 0.25], [0, 0.09, -5.1], concreteDark)
  s.box('road', [40, 0.04, 12], [0, 0.0, -11.2], asphalt)
  s.box('far_pavement', [40, KERB, 4], [0, KERB / 2, -19.2], paving)

  // the Don's car, waiting at the kerb past the entrance (model front is local −X)
  await s.model('sedan', 'ext_car', [7.6, 0.02, -6.6], Math.PI)

  // street lamps
  const lampLights: PointLight[] = []
  const lampPost = (name: string, x: number, z: number) => {
    s.cyl(`${name}_pole`, 0.14, 5.2, [x, 2.6, z], steel, { tess: 10 })
    s.box(`${name}_arm`, [0.1, 0.1, 1.1], [x, 5.15, z + 0.5], steel)
    s.box(`${name}_head`, [0.36, 0.14, 0.6], [x, 5.08, z + 1.0], steel)
    s.box(`${name}_lens`, [0.3, 0.02, 0.5], [x, 5.0, z + 1.0], bulb)
    lampLights.push(lit.point(`${name}_light`, new Vector3(x, 4.8, z + 1.0), 26, WARM, 11))
  }
  lampPost('lamp_l', -9.5, -4.6)
  lampPost('lamp_r', 9.5, -4.6)

  // ── The building ────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    s.box(`plinth_${side}`, [WIN.x1 - WIN.x0, WIN.y0, 0.5], [side * ((WIN.x0 + WIN.x1) / 2), WIN.y0 / 2 + KERB, 0.25], concrete)
    s.box(`pier_out_${side}`, [0.6, 4.3, 0.6], [side * (WIN.x1 + 0.3), 2.15 + KERB, 0.3], concrete)
    s.box(`pier_in_${side}`, [0.55, 4.3, 0.6], [side * (WIN.x0 - 0.27), 2.15 + KERB, 0.3], concrete)
    s.box(`wall_end_${side}`, [5, 4.3, 0.5], [side * (WIN.x1 + 3.1), 2.15 + KERB, 0.25], concrete)
    s.box(`side_${side}`, [0.5, FACADE_H, 12], [side * 12, FACADE_H / 2, 6], concrete)
  }
  s.box('cladding', [24, FACADE_H - 4.45, 0.4], [0, 4.45 + (FACADE_H - 4.45) / 2, 0.2], cladding)
  s.box('parapet', [24.4, 0.35, 0.7], [0, FACADE_H + 0.17, 0.2], steel)
  s.box('roof', [24, 0.3, 12], [0, FACADE_H, 6], steel)
  // vertical ribs on the cladding, clear of the crest
  for (let x = -11.5; x <= 11.6; x += 1.15) if (Math.abs(x) > 3.4) s.box(`rib_${x.toFixed(2)}`, [0.08, FACADE_H - 4.5, 0.12], [x, 4.5 + (FACADE_H - 4.5) / 2, -0.05], steel)
  // a row of high clerestory windows, warm with the floor lights behind them
  for (const side of [-1, 1])
    for (let i = 0; i < 3; i++) {
      const x = side * (4.6 + i * 2.6)
      s.box(`clerewin_${side}_${i}`, [2.0, 0.9, 0.06], [x, 7.05, -0.03], clerestory)
      s.box(`clereframe_${side}_${i}`, [2.15, 1.05, 0.08], [x, 7.05, 0.0], steel)
    }

  // ── The entrance ────────────────────────────────────────────────────────
  s.box('entry_floor', [4, KERB, DOOR_Z + 0.2], [0, KERB / 2, DOOR_Z / 2], concreteDark)
  for (const side of [-1, 1]) s.box(`entry_wall_${side}`, [0.3, 4.3, DOOR_Z], [side * 2.15, 2.15 + KERB, DOOR_Z / 2], concrete)
  s.box('entry_ceiling', [4.6, 0.3, DOOR_Z], [0, 4.45, DOOR_Z / 2], steel)
  s.box('door_head', [4, 0.14, 0.18], [0, 3.1, DOOR_Z], steel)
  for (const x of [-2, 2]) s.box(`door_post_${x}`, [0.12, 4.3, 0.18], [x, 2.15 + KERB, DOOR_Z], steel)
  s.box('transom', [4, 1.2, 0.04], [0, 3.75, DOOR_Z], glass)
  const hingeL = s.node('ext_hinge_l', [-1.94, KERB, DOOR_Z])
  const hingeR = s.node('ext_hinge_r', [1.94, KERB, DOOR_Z])
  for (const [hinge, sgn] of [[hingeL, 1], [hingeR, -1]] as const) {
    s.box(`door_glass_${sgn}`, [1.82, 2.86, 0.03], [sgn * 0.94, 1.45, 0], glass, hinge)
    s.box(`door_rail_t_${sgn}`, [1.9, 0.09, 0.07], [sgn * 0.95, 2.9, 0], steel, hinge)
    s.box(`door_rail_b_${sgn}`, [1.9, 0.18, 0.07], [sgn * 0.95, 0.09, 0], steel, hinge)
    s.box(`door_stile_${sgn}`, [0.08, 2.9, 0.07], [sgn * 1.88, 1.45, 0], steel, hinge)
    s.rod(`door_pull_${sgn}`, [sgn * 1.7, 0.75, -0.08], [sgn * 1.7, 1.95, -0.08], 0.035, chrome, hinge)
  }
  // the lobby behind the doors: warm light, a dark floor, the hall beyond
  s.box('lobby_floor', [4, 0.1, 5], [0, 0.11, DOOR_Z + 2.5], floorIn)
  const LOBBY_Z = DOOR_Z + 5
  for (const side of [-1, 1]) s.box(`lobby_back_${side}`, [1.3, 4.4, 0.2], [side * 1.45, 2.2, LOBBY_Z], brickIn)
  s.box('lobby_back_top', [1.6, 1.6, 0.2], [0, 3.6, LOBBY_Z], brickIn)
  s.box('lobby_arch', [1.7, 0.1, 0.24], [0, 2.82, LOBBY_Z], steel)
  s.plane('lobby_beyond', 1.6, 2.7, [0, 1.46, LOBBY_Z + 0.4], lobbyGlow)
  for (const side of [-1, 1]) s.box(`lobby_wall_${side}`, [0.2, 4.4, 5], [side * 2.05, 2.2, DOOR_Z + 2.5], brickIn)
  s.box('lobby_ceiling', [4.2, 0.2, 5], [0, 4.35, DOOR_Z + 2.5], ceilingIn)

  // canopy with downlights and a thin red line along its edge
  s.box('canopy', [6.6, 0.3, 2.8], [0, 4.6, -1.2], steel)
  s.box('canopy_strip', [6.6, 0.05, 0.05], [0, 4.44, -2.58], redStrip)
  for (const x of [-2, 0, 2]) s.cyl(`canopy_light_${x}`, 0.22, 0.03, [x, 4.44, -1.3], bulb)
  for (const side of [-1, 1]) s.rod(`canopy_tie_${side}`, [side * 3.0, 4.75, -2.5], [side * 3.0, 6.0, -0.05], 0.06, steel)

  // the crest high above the door, between two of the house banners
  s.cyl('crest_roundel', 2.5, 0.12, [0, 6.6, -0.12], steel, { tess: 48 }).rotation.x = Math.PI / 2
  s.torus('crest_ring', 2.5, 0.08, [0, 6.6, -0.19], brass).rotation.x = Math.PI / 2
  // (planes face −Z, the street, unrotated)
  s.plane('crest', 2.1, 2.1, [0, 6.6, -0.2], crestMat)
  for (const side of [-1, 1]) s.plane(`ext_banner_${side}`, 1.1, 2.2, [side * 2.3, 6.55, -0.08], bannerMat)

  // ── Training floor seen through the windows ─────────────────────────────
  for (const side of [-1, 1]) {
    const cx = side * ((WIN.x0 + WIN.x1) / 2)
    const w = WIN.x1 - WIN.x0
    const mid = (WIN.y0 + WIN.y1) / 2 + KERB
    s.box(`win_glass_${side}`, [w, WIN.y1 - WIN.y0, 0.03], [cx, mid, 0.25], glass)
    s.box(`win_head_${side}`, [w + 0.1, 0.16, 0.22], [cx, WIN.y1 + KERB, 0.25], steel)
    s.box(`win_sill_${side}`, [w + 0.2, 0.12, 0.34], [cx, WIN.y0 + KERB, 0.2], steel)
    for (let i = 1; i < 3; i++) s.box(`win_mullion_${side}_${i}`, [0.08, WIN.y1 - WIN.y0, 0.14], [cx - w / 2 + (i * w) / 3, mid, 0.2], steel)
    s.box(`win_transom_${side}`, [w, 0.07, 0.14], [cx, 3.3, 0.2], steel)
    // the room behind: floor, mats, brick walls, a ceiling with hanging lamps
    s.box(`in_floor_${side}`, [w + 1.4, 0.1, 6], [cx, 0.12, 3.5], floorIn)
    s.box(`in_mat_${side}`, [w, 0.03, 4.4], [cx, 0.185, 3.6], rubber)
    s.box(`in_back_${side}`, [w + 1.4, 4.6, 0.2], [cx, 2.3, 6.5], brickIn)
    s.box(`in_ceil_${side}`, [w + 1.4, 0.2, 6], [cx, 4.6, 3.5], ceilingIn)
    for (const dz of [2.2, 4.6]) {
      s.rod(`in_cord_${side}_${dz}`, [cx, 4.5, dz], [cx, 3.9, dz], 0.02, steel)
      s.cyl(`in_shade_${side}_${dz}`, 0.6, 0.28, [cx, 3.78, dz], steel, { top: 0.18, cap: false })
      s.sphere(`in_bulb_${side}_${dz}`, 0.14, [cx, 3.66, dz], bulb)
    }
    lit.point(`in_light_${side}`, new Vector3(cx, 3.4, 3.2), 22, TUNGSTEN, 7.5)
    s.plane(`in_banner_${side}`, 1.0, 2.0, [cx + side * 1.3, 2.6, 6.38], bannerMat)
  }
  // heavy bags hanging in each window
  for (const [i, x, z] of [[0, -5.6, 4.1], [1, -3.4, 4.6], [2, 5.4, 4.4]] as const) {
    const pivot = s.node(`ext_bag_pivot_${i}`, [x, 4.5, z])
    await s.model('heavy_bag', `ext_bag_${i}`, [0, -2.35 - 0.575, 0], i * 0.9, [1, 1, 1], pivot)
    s.rod(`ext_bagline_${i}`, [0, -2.35 + 0.365, 0], [0, 0, 0], 0.016, chrome, pivot)
  }

  // ── Distant city over the roofline ──────────────────────────────────────
  const sky = s.plane('sky', 160, 70, [0, 26, 75], skyMat)
  sky.applyFog = false
  const towers: [number, number, number, number][] = [
    [-30, 26, 10, 55], [-16, 18, 8, 60], [-4, 30, 9, 65], [9, 22, 11, 58], [22, 34, 9, 62], [34, 20, 12, 56],
  ]
  const towerMats: PBRMaterial[] = []
  for (const [i, [x, h, w, z]] of towers.entries()) {
    const facade = s.track(T.facade(scene, `tex_ext_tower_${i}`, 256, 512, 6, 14, 40 + i, true, 0.35))
    const m = s.pbr(`ext_tower_${i}`, '#1a1b22', { albedo: facade, emissiveTex: facade, rough: 0.6, emissive: new Color3(0.5, 0.42, 0.3) })
    towerMats.push(m)
    s.box(`tower_${i}`, [w, h, 6], [x, h / 2, z], m)
  }

  // ── Street life ─────────────────────────────────────────────────────────
  // the gym's name in red neon above each window
  const neonRed = new Color3(1, 0.16, 0.2)
  const signs = [
    D.neon(s, null, 'neon_l', ['DOWNTOWN'], [-4.6, 5.45, -0.06], 3.4, 0.78, neonRed),
    D.neon(s, null, 'neon_r', ['BOXING CLUB'], [4.6, 5.45, -0.06], 3.4, 0.78, neonRed),
  ]
  // light from the lit windows lying across the pavement, pools under the street
  // lamps and the canopy, glows round the lamp heads and the canopy's downlights:
  // all night-only, merged into a few draw calls
  const nightOnly: Mesh[] = []
  for (const side of [-1, 1])
    nightOnly.push(D.windowLight(s, null, `win_spill_${side}`, [side * ((WIN.x0 + WIN.x1) / 2), KERB, -1.4], 4.4, 2.6, new Color3(1, 0.66, 0.36), { cols: 3, rows: 1, strength: 0.32 }))
  for (const x of [-9.5, 9.5]) {
    nightOnly.push(D.lightPool(s, null, `lamp_pool_${x}`, [x, KERB, -3.4], 7, 5.5, WARM, 0.34))
    nightOnly.push(D.lightPool(s, null, `lamp_pool_road_${x}`, [x, 0.02, -7.5], 6, 5, WARM, 0.18))
    nightOnly.push(D.halo(s, null, `lamp_halo_${x}`, [x, 4.92, -3.6], 1.9, new Color3(1, 0.8, 0.55), 0.55))
  }
  nightOnly.push(D.lightPool(s, null, 'canopy_pool', [0, KERB, -1.5], 6.4, 3.6, WARM, 0.26))
  for (const x of [-2, 0, 2]) nightOnly.push(D.halo(s, null, `canopy_halo_${x}`, [x, 4.36, -1.36], 0.8, new Color3(1, 0.82, 0.6), 0.4, 0))
  const nightGlow = D.merge(s, nightOnly)
  // rain left standing on the road
  D.puddles(s, 'road_puddle', [-13, -16, 13, -6], 0.02, 10)
  // bins against the end wall, a hydrant at the kerb, rubbish in the gutter
  const binMat = s.pbr('ext_bin', '#23302a', { rough: 0.55, metal: 0.4 })
  const lidMat = binMat
  for (const [i, x] of [[0, 7.7], [1, 8.55]] as const) {
    s.box(`bin_${i}`, [0.72, 1.05, 0.62], [x, KERB + 0.53, -0.55], binMat)
    s.box(`bin_lid_${i}`, [0.78, 0.07, 0.68], [x, KERB + 1.08, -0.57], lidMat).rotation.x = i ? -0.08 : 0
  }
  const hydrant = s.pbr('ext_hydrant', '#8c1a1a', { rough: 0.45, metal: 0.3 })
  s.cyl('hydrant_body', 0.26, 0.62, [-7.4, KERB + 0.31, -4.55], hydrant, { tess: 14 })
  s.sphere('hydrant_cap', 0.27, [-7.4, KERB + 0.64, -4.55], hydrant)
  s.cyl('hydrant_nozzle', 0.1, 0.36, [-7.4, KERB + 0.42, -4.55], hydrant, { tess: 10 }).rotation.x = Math.PI / 2
  D.litter(s, 'gutter', [-12, -5.05, 12, -4.75], KERB, 14)
  D.litter(s, 'road_litter', [-12, -6, 12, -5.4], 0.02, 6)

  // ── Lighting ────────────────────────────────────────────────────────────
  const ambient = lit.hemi(0.55, new Color3(0.57, 0.55, 0.59), new Color3(0.24, 0.2, 0.16))
  ambient.direction.set(0.2, 1, -0.5)
  // the canopy's downlight is the key: it pools in front of the door and throws the shadows
  const key = lit.spot('canopy_key', new Vector3(0, 4.3, -1.3), new Vector3(0, -1, -0.12), 1.7, 120, WARM, 9)
  lit.enableShadows(key)
  lit.point('lobby_light', new Vector3(0, 2.6, DOOR_Z + 1.6), 18, TUNGSTEN, 6)
  const crestUp = lit.spot('crest_up', new Vector3(0, 4.9, -1.6), new Vector3(0, 1, 0.5), 0.9, 70, WARM, 6)
  lit.enableGlow(0.35)
  for (const m of s.meshes) if (/^(sky|tower_|lobby_beyond|clerewin_)/.test(m.name)) lit.glow?.addExcludedMesh(m as Mesh)
  for (const m of s.meshes) if (/^(canopy|ext_car|door_|ext_bag)/.test(m.name)) lit.castShadow(m)
  lit.raiseLightLimit(s.materials)
  D.mergeDressing(s, nightGlow)
  lit.bakeProbe(new Vector3(0, 2, -3), s.meshes.filter((m) => !/^(sky|tower_)/.test(m.name)), 0.4)
  s.freezeStatic([hingeL, hingeR], { merge: true })

  // ── Scripted events ─────────────────────────────────────────────────────
  type Tween = { t: number; dur: number; apply: (k: number) => void }
  const tweens: Tween[] = []
  const tween = (dur: number, apply: (k: number) => void, instant: boolean) => (instant ? apply(1) : tweens.push({ t: 0, dur, apply }))
  const setDoors = (open: boolean, instant: boolean) => {
    const fromL = hingeL.rotation.y
    const fromR = hingeR.rotation.y
    // they swing inward, into the lobby
    const toL = open ? -1.35 : 0
    const toR = open ? 1.35 : 0
    tween(open ? 1.2 : 0.9, (k) => {
      const e = open ? 1 - (1 - k) ** 3 : k * k
      hingeL.rotation.y = fromL + (toL - fromL) * e
      hingeR.rotation.y = fromR + (toR - fromR) * e
    }, instant)
  }

  const env: GameEnvironment = {
    id: 'gym_ext',
    marks: {
      // Rookie comes along the pavement, past the left-hand window
      street: [-3.6, -2.4, KERB],
      approach: [-0.9, -2.2, KERB],
      doorway: [0, DOOR_Z + 0.3, KERB],
      lobby: [0, DOOR_Z + 3.4, 0.11],
      // security either side of the entrance
      guard_door_l: [-2.75, -0.75, KERB],
      guard_door_r: [2.7, -0.8, KERB],
      // fighters at work behind the glass, side-on to the street, each facing a bag
      win_l_fighter: [-6.3, 4.1, 0.2],
      win_l_bag: [-5.6, 4.1, 1.3],
      win_l2_fighter: [-2.7, 4.6, 0.2],
      win_l2_bag: [-3.4, 4.6, 1.3],
      win_r_fighter: [4.7, 4.4, 0.2],
      win_r_bag: [5.4, 4.4, 1.3],
      // Scene 02: Lucas waiting out front by the right-hand window, and where
      // Rookie stops in front of him
      lucas_wait: [1.7, -1.5, KERB],
      rookie_meet: [0.15, -2.55, KERB],
    },
    shots: {
      // medium-wide on the façade: the entrance, the crest and both windows
      ext_establish: { pos: [-9.2, 1.45, -12.4], target: [-1.2, 3.5, 0.6], fov: 0.82, handheld: 0 },
      // from the far side of the pavement: he walks past the lit window to the door and in
      ext_door: { pos: [-3.0, 1.75, -17.5], target: [-1.6, 2.2, 0], fov: 0.8, handheld: 0 },
      // across the pavement from the kerb: the two of them under the canopy, the door behind
      ext_meet: { pos: [-1.9, 1.58, -7.2], target: [0.9, 1.45, -1.8], fov: 0.6, handheld: 0 },
    },
    bounds: { minX: -9, maxX: 9, minZ: -4.6, maxZ: -0.5 },
    obstacles: [
      [5.2, -7.6, 10.0, -5.6],
      [-12, -0.1, -2.2, 0.6],
      [2.2, -0.1, 12, 0.6],
      [7.25, -0.95, 9.0, -0.1],
      [-7.65, -4.8, -7.15, -4.3],
    ],
    followYaw: 0,
    lighting: lit,
    walkable: [],
    event(name, instant = false) {
      switch (name) {
        case 'doorsOpen':
          setDoors(true, instant)
          break
        case 'doorsClose':
          setDoors(false, instant)
          break
        // A clear sunny morning: blue sky, sun on the façade, lamps and night glows off.
        // The crest's uplight becomes the sun (the set is at its light budget).
        case 'morning':
          paintSky([[0, '#2a6fcb'], [0.5, '#5e9de0'], [0.82, '#a9cdee'], [1, '#d6e6f2']])
          ambient.intensity = 1.5
          ambient.diffuse = new Color3(0.86, 0.9, 1)
          ambient.groundColor = new Color3(0.55, 0.5, 0.42)
          scene.fogColor = new Color3(0.74, 0.82, 0.9)
          scene.fogDensity = 0.005
          scene.clearColor.set(0.74, 0.82, 0.9, 1)
          crestUp.position.set(-18, 34, -40)
          crestUp.direction = new Vector3(0.35, -0.6, 0.72).normalize()
          crestUp.angle = 0.9
          crestUp.range = 90
          crestUp.intensity = 9000
          crestUp.diffuse = new Color3(1, 0.93, 0.8)
          crestUp.specular = new Color3(0.5, 0.46, 0.4)
          for (const l of lampLights) l.intensity = 0
          // the street lamps are off in daylight; the neon stays on but reads weaker
          for (const m of nightGlow) m.setEnabled(false)
          for (const sign of signs) (sign.material as StandardMaterial).emissiveTexture!.level = 1.1
          bulb.emissiveColor.set(0.45, 0.42, 0.36)
          clerestory.emissiveColor.set(0.55, 0.64, 0.74)
          for (const m of towerMats) {
            m.emissiveColor.set(0, 0, 0)
            m.albedoColor = new Color3(0.62, 0.6, 0.58)
          }
          lit.refreshProbe()
          break
        case 'night':
          paintSky([[0, '#05060c'], [0.5, '#0e0f1c'], [0.82, '#24202e'], [1, '#3e2b2c']])
          ambient.intensity = 0.42
          break
        default:
          console.warn(`[gym_ext] unknown event ${name}`)
      }
    },
    update(dt) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]
        tw.t += dt
        tw.apply(Math.min(1, tw.t / tw.dur))
        if (tw.t >= tw.dur) tweens.splice(i, 1)
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
