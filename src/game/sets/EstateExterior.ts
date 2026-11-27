import { Color3, DynamicTexture, Material, Mesh, MirrorTexture, PBRMaterial, Plane, StandardMaterial, Texture, Vector3 } from '@render/core'
import type { AbstractMesh } from '@render/core'
import { conifer } from '@render/Details'
import { rain, splashes } from '@render/Effects'
import { LightingManager, MOON, WARM } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import * as D from '@render/Dressing'
import { SetBuilder } from '@render/SetBuilder'
import { FOLIAGE_URL } from '../assets/urls'
import type { EnvContext, EnvironmentFactory, GameEnvironment } from './types'

// The Don's estate at night, in the rain. A neoclassical house on a terrace
// above a cobbled forecourt; Rookie's car stops near the front and he walks
// to the training annex on the right.

const HOUSE_Z = 32
// Rookie's car: parked pose, and the yaw whose front (model local −X) faces up the drive
const CAR = { x: 4.4, z: 1.2, yaw: 1.82 }
const carFront = (yaw: number) => new Vector3(-Math.cos(yaw), 0, Math.sin(yaw))

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'estate')
  const lit = new LightingManager(scene, quality)
  const hi = quality === 'high'
  T.reseed(21)

  scene.fogMode = 2
  scene.fogDensity = 0.011
  scene.fogColor = new Color3(0.085, 0.078, 0.088)
  scene.clearColor.set(0.085, 0.078, 0.088, 1)

  // All tiers: tune existing PBR uniforms only; retain material sharing,
  // texture sizes, clear-coat features, geometry and render budgets.
  // ── Materials ───────────────────────────────────────────────────────────
  const ground = s.surface('ground', 'paving', [55, 55], '#afa89b', 0.55)
  ground.clearCoat.isEnabled = true
  ground.clearCoat.intensity = 0.45
  ground.clearCoat.roughness = 0.28
  const stone = s.surface('stone', 'concrete', [2, 2], '#c8c0ad')
  const stoneDark = s.surface('stone_dark', 'concrete', [3, 1], '#77766d')
  const slate = s.pbr('slate', '#28303b', { rough: 0.74, metal: 0.03 })
  const annexMat = s.surface('annex', 'brick', [5, 3.2], '#aa9b89')
  const iron = s.pbr('iron', '#22272c', { rough: 0.57, metal: 0.25 })
  const bark = s.surface('bark', 'concrete', [1, 3], '#494438')
  const foliage = s.pbr('evergreen_needles', '#c3cfaa', { rough: 0.95 })
  const needles = s.track(new Texture(FOLIAGE_URL, scene))
  needles.hasAlpha = true
  foliage.albedoTexture = needles
  foliage.useAlphaFromAlbedoTexture = true
  foliage.transparencyMode = Material.MATERIAL_ALPHATEST
  foliage.alphaCutOff = 0.45
  foliage.backFaceCulling = false
  foliage.twoSidedLighting = true
  const lantern = s.glow('lantern', new Color3(1.0, 0.78, 0.48))
  const doorGlow = s.glow('annex_door', new Color3(0.42, 0.3, 0.16))
  const bannerMat = s.pbr('banner', '#ffffff', { albedo: s.track(T.banner(scene)), rough: 0.85 })
  bannerMat.backFaceCulling = false

  // ── Ground ──────────────────────────────────────────────────────────────
  const floor = s.box('ground', [140, 0.2, 140], [0, -0.1, 30], ground)
  floor.metadata = { walkable: true }
  if (hi) {
    const mirror = s.track(new MirrorTexture('wet', 1024, scene, true))
    mirror.mirrorPlane = new Plane(0, -1, 0, 0)
    mirror.adaptiveBlurKernel = 24
    mirror.level = 0.3
    ground.reflectionTexture = mirror
    s.root.onDisposeObservable.addOnce(() => (ground.reflectionTexture = null))
    queueMicrotask(() => {
      mirror.renderList = s.meshes.filter((m) => m !== floor && m.position.y > -0.5)
    })
  }

  // ── The house ───────────────────────────────────────────────────────────
  const terraceY = 1.6
  s.box('terrace', [62, terraceY, 14], [0, terraceY / 2, HOUSE_Z + 3], stoneDark)
  // centre block
  const cw = 26
  const ch = 12
  s.box('main_block', [cw, ch, 10], [0, terraceY + ch / 2, HOUSE_Z + 5], stone)
  s.box('foundation_band', [cw + 0.35, 0.5, 0.3], [0, terraceY + 0.25, HOUSE_Z - 0.12], stoneDark)
  s.box('main_cornice', [cw + 0.8, 0.5, 10.8], [0, terraceY + ch + 0.25, HOUSE_Z + 5], stone)
  s.roof('main_roof', cw + 1, 3.2, 11, [0, terraceY + ch + 0.5, HOUSE_Z + 5], slate)
  for (let i = -3; i <= 3; i++) {
    s.box(`dormer_${i}`, [1.4, 1.6, 0.9], [i * 3.4, terraceY + ch + 2.2, HOUSE_Z + 0.2], slate)
    s.plane(`dormer_win_${i}`, 0.8, 1, [i * 3.4, terraceY + ch + 2.1, HOUSE_Z - 0.26], i % 2 ? lantern : s.glow('dark_win', '#141922'))
  }
  for (const x of [-9, 9]) s.box(`chimney_${x}`, [1.2, 3.2, 1.2], [x, terraceY + ch + 3.9, HOUSE_Z + 6], stoneDark)
  // wings
  for (const side of [-1, 1]) {
    const x = side * 21
    s.box(`wing_${side}`, [16, 9, 9], [x, terraceY + 4.5, HOUSE_Z + 6.5], stone)
    s.roof(`wing_roof_${side}`, 16.6, 2.4, 9.8, [x, terraceY + 9.4, HOUSE_Z + 6.5], slate)
    s.box(`wing_cornice_${side}`, [16.6, 0.4, 9.6], [x, terraceY + 9.2, HOUSE_Z + 6.5], stone)
  }
  // Deep window reveals, stone surrounds and mullions catch real light.
  const recess = s.pbr('window_recess', '#141a20', { rough: 0.85 })
  const frame = s.pbr('window_frame', '#292724', { rough: 0.65 })
  const glazing = [0.06, 0.2, 0.42, 0.7].map((v, i) => s.pbr(`glazing_${i}`, '#66513a', { rough: 0.28, metal: 0.1, emissive: new Color3(v, v * 0.7, v * 0.36) }))
  const addWindow = (name: string, x: number, y: number, z: number, w = 1.45, h = 2.25) => {
    s.box(`${name}_reveal`, [w + 0.3, h + 0.28, 0.12], [x, y, z - 0.08], recess)
    s.box(`${name}_glass`, [w, h, 0.04], [x, y, z - 0.16], glazing[Math.floor(T.rand() * glazing.length)])
    for (const side of [-1, 1]) s.box(`${name}_jamb_${side}`, [0.13, h + 0.38, 0.22], [x + side * (w / 2 + 0.14), y, z - 0.17], stone)
    s.box(`${name}_lintel`, [w + 0.55, 0.2, 0.3], [x, y + h / 2 + 0.2, z - 0.19], stone)
    s.box(`${name}_sill`, [w + 0.58, 0.16, 0.4], [x, y - h / 2 - 0.13, z - 0.23], stone)
    s.box(`${name}_mullion`, [0.055, h, 0.07], [x, y, z - 0.21], frame)
    s.box(`${name}_transom`, [w, 0.07, 0.07], [x, y + h * 0.1, z - 0.21], frame)
  }
  for (let row = 0; row < 3; row++) {
    const y = terraceY + 2.1 + row * 3.8
    for (let column = 0; column < 9; column++) addWindow(`house_window_${row}_${column}`, -11 + column * 2.75, y, HOUSE_Z)
    s.box(`string_course_${row}`, [cw + 0.25, 0.12, 0.24], [0, y + 1.65, HOUSE_Z - 0.08], stone)
  }
  for (const side of [-1, 1]) for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 5; column++) addWindow(`wing_window_${side}_${row}_${column}`, side * 21 - 6.2 + column * 3.1, terraceY + 2.3 + row * 4, HOUSE_Z + 2, 1.5, 2.5)
  }
  for (const x of [-12.7, 12.7]) s.box(`corner_pilaster_${x}`, [0.42, ch, 0.32], [x, terraceY + ch / 2, HOUSE_Z - 0.12], stone)
  for (let i = -12; i <= 12; i++) s.box(`cornice_dentil_${i}`, [0.24, 0.24, 0.3], [i, terraceY + ch - 0.2, HOUSE_Z - 0.2], stone)
  // portico
  const colZ = HOUSE_Z - 2.6
  for (let i = 0; i < 6; i++) {
    const x = -6.25 + i * 2.5
    s.lathe(`column_${i}`, [[0.45, 0], [0.45, 0.18], [0.37, 0.25], [0.33, 0.45], [0.28, 7.6], [0.38, 7.78], [0.46, 7.85], [0.46, 8.2]], [x, terraceY, colZ], stone)
    s.box(`column_base_${i}`, [0.95, 0.35, 0.95], [x, terraceY + 0.18, colZ], stone)
  }
  s.box('entablature', [15.2, 1.1, 1.4], [0, terraceY + 8.75, colZ], stone)
  s.roof('portico_roof', 15.6, 2.2, 3.2, [0, terraceY + 9.3, colZ + 0.3], stone)
  const banner = s.plane('banner', 2.2, 4.4, [0, terraceY + 5.7, colZ - 0.05], bannerMat)
  s.box('front_door', [2.4, 4.2, 0.2], [0, terraceY + 2.1, HOUSE_Z - 0.1], s.glow('front_door_glow', new Color3(0.5, 0.33, 0.16)))
  // stairs
  for (let i = 0; i < 8; i++) {
    const y = (i + 1) * (terraceY / 8)
    s.box(`stair_${i}`, [14 - i * 0.4, terraceY / 8, 0.42], [0, y - terraceY / 16, HOUSE_Z - 4.2 - (7 - i) * 0.42], stone)
  }
  // balustrade along the terrace edge
  for (let x = -30; x <= 30; x += 0.6) {
    if (Math.abs(x) < 7.3) continue
    s.cyl(`baluster_${x.toFixed(1)}`, 0.14, 0.75, [x, terraceY + 0.38, HOUSE_Z - 3.9], stone, { tess: 6 })
  }
  for (const side of [-1, 1]) s.box(`rail_${side}`, [23, 0.14, 0.3], [side * 18.6, terraceY + 0.8, HOUSE_Z - 3.9], stone)

  // ── Grounds ─────────────────────────────────────────────────────────────
  for (const side of [-1, 1]) {
    for (let z = 2; z <= 26; z += 4) {
      const x = side * (11.5 + (z % 8 === 2 ? 0.4 : 0))
      const h = 5.5 + T.rand() * 2
      conifer(s, `conifer_${side}_${z}`, x + side * 0.55, z, h, foliage, bark)
      s.cyl(`tree_bed_${side}_${z}`, 1.8, 0.12, [x + side * 0.55, 0.04, z], stoneDark, { tess: 32 })
    }
  }
  s.cyl('fountain_basin', 6, 0.6, [0, 0.3, 14], stone, { tess: 40 })
  s.cyl('fountain_water', 5.6, 0.05, [0, 0.55, 14], s.pbr('water', '#0b1018', { rough: 0.12, metal: 0 }), { tess: 40 })
  s.torus('fountain_rim', 5.85, 0.24, [0, 0.62, 14], stone)
  s.lathe('fountain_tier', [[0.55, 0], [0.55, 0.12], [0.28, 0.3], [0.18, 1.3], [0.38, 1.55], [0.38, 1.7]], [0, 0.55, 14], stone)
  s.cyl('fountain_bowl', 2.2, 0.3, [0, 2.1, 14], stone, { top: 2.6, tess: 30 })

  // Lamp posts with halos
  const haloTex = s.track(T.radialSprite(scene, 'tex_halo', 128, '255,200,140', 0.6))
  const haloMat = new StandardMaterial('halo', scene)
  haloMat.disableLighting = true
  haloMat.emissiveTexture = haloTex
  haloMat.opacityTexture = haloTex
  haloMat.emissiveColor = new Color3(1, 0.75, 0.45)
  haloMat.alphaMode = 1
  haloMat.disableDepthWrite = true
  s.track(haloMat)
  const lampPos: [number, number][] = [[-5, 4], [5, 4], [-5, 10], [5, 10], [-5, 20], [5, 20], [-7.6, 27.4], [7.6, 27.4]]
  for (const [x, z] of lampPos) {
    s.cyl(`post_${x}_${z}`, 0.14, 3.4, [x, 1.7, z], iron, { tess: 8 })
    s.box(`lantern_${x}_${z}`, [0.32, 0.5, 0.32], [x, 3.6, z], lantern)
    s.box(`lantern_cap_${x}_${z}`, [0.44, 0.08, 0.44], [x, 3.9, z], iron)
    const halo = s.plane(`halo_${x}_${z}`, 1.25, 1.25, [x, 3.6, z], haloMat)
    halo.billboardMode = Mesh.BILLBOARDMODE_ALL
    halo.isPickable = false
  }

  // each lamp's light on the wet cobbles
  for (const [x, z] of lampPos) D.lightPool(s, null, `lamp_pool_${x}_${z}`, [x, 0, z], 5.5, 5.5, WARM, 0.3)

  // ── The gateway behind the forecourt ────────────────────────────────────
  // A stone boundary wall with the drive coming through it between two
  // lanterned piers, the iron gates swung open outward; dark trees beyond,
  // and the night sky over everything (the arrival looks back down the drive).
  const GATE_Z = -6
  const wallStone = s.surface('boundary_stone', 'concrete', [1, 1], '#8a8475')
  for (const side of [-1, 1]) {
    s.tileUV(s.box(`boundary_${side}`, [30, 2.3, 0.55], [side * 19.9, 1.15, GATE_Z], wallStone), 2)
    s.tileUV(s.box(`boundary_coping_${side}`, [30, 0.16, 0.75], [side * 19.9, 2.38, GATE_Z], stone), 1)
    const px = side * 5.1
    s.tileUV(s.box(`gate_pier_${side}`, [1.1, 3.4, 1.1], [px, 1.7, GATE_Z], wallStone), 1)
    s.box(`gate_pier_cap_${side}`, [1.35, 0.22, 1.35], [px, 3.5, GATE_Z], stone)
    s.box(`gate_lantern_${side}`, [0.36, 0.55, 0.36], [px, 3.9, GATE_Z], lantern)
    s.box(`gate_lantern_cap_${side}`, [0.48, 0.08, 0.48], [px, 4.22, GATE_Z], iron)
    D.halo(s, null, `gate_halo_${side}`, [px, 3.9, GATE_Z], 1.6, new Color3(1, 0.78, 0.5), 0.5)
    D.lightPool(s, null, `gate_pool_${side}`, [px, 0, GATE_Z + 0.8], 5, 4, WARM, 0.26)
    // the gate leaf, hinged on the pier, open outward along the drive
    const leaf = s.node(`gate_leaf_${side}`, [side * 4.5, 0, GATE_Z - 0.2])
    leaf.rotation.y = side * -0.35
    for (const y of [0.25, 1.4, 2.5]) s.rod(`gate_rail_${side}_${y}`, [0, y, 0], [0, y, -4.3], 0.06, iron, leaf)
    for (let k = 0; k <= 28; k++) {
      const z = -0.07 - k * 0.15
      const top = 2.6 + Math.sin((k / 28) * Math.PI) * 0.35
      s.rod(`gate_bar_${side}_${k}`, [0, 0.05, z], [0, top, z], 0.03, iron, leaf)
    }
  }
  // the lane outside the gates, a streetlamp on it, and a dark treeline
  D.halo(s, null, 'lane_halo', [8.5, 4.6, -10.5], 1.8, new Color3(1, 0.74, 0.44), 0.45)
  s.cyl('lane_post', 0.16, 4.8, [8.5, 2.4, -10.5], iron, { tess: 8 })
  s.box('lane_lamp', [0.5, 0.14, 0.4], [8.5, 4.78, -10.5], lantern)
  D.lightPool(s, null, 'lane_pool', [8.5, 0, -10.5], 7, 6, WARM, 0.22)
  for (const [x, z, h] of [[-9, -11, 9], [-14, -14, 11], [-21, -12, 10], [-27, -16, 12], [12, -13, 10], [17, -11, 8.5], [23, -15, 12], [29, -12, 10], [-6.5, -17, 8], [7, -18, 9]] as const)
    conifer(s, `outer_tree_${x}`, x, z, h, foliage, bark)
  // the night sky, all round the grounds: deep blue, the city's glow on the low cloud
  const nightSky = s.track(new DynamicTexture('tex_estate_sky', { width: 16, height: 256 }, scene, false))
  {
    const c = nightSky.getContext() as unknown as CanvasRenderingContext2D
    const g = c.createLinearGradient(0, 0, 0, 256)
    for (const [at, col] of [[0, '#04060c'], [0.5, '#0d1222'], [0.82, '#1f1d2a'], [1, '#2a2328']] as const) g.addColorStop(at, col)
    c.fillStyle = g
    c.fillRect(0, 0, 16, 256)
    nightSky.update(true)
  }
  const skyMat = s.glow('estate_sky', new Color3(1, 1, 1), nightSky)
  skyMat.fogEnabled = false
  skyMat.backFaceCulling = false
  for (const [name, z, rot] of [['sky_s', -70, Math.PI], ['sky_n', 120, 0]] as const) {
    const sky = s.plane(name, 320, 110, [0, 45, z], skyMat, rot)
    sky.applyFog = false
    sky.isPickable = false
  }

  // Authored sedan bodies, glazing, wheel wells and alloy wheels.
  const car = await s.model('sedan', 'car_rookie', [CAR.x, 0, CAR.z], CAR.yaw)
  // the grey sedan from Calder Yard, already at the house when Rookie arrives (Scene 02); `houseCarGone` if he came late
  const houseCar = await s.model('sedan_sports', 'car_house', [-4.6, 0, 22.4], Math.PI / 2 + 0.05)
  for (const m of s.materials) {
    if (!(m instanceof PBRMaterial)) continue
    if (m.name.startsWith('headlamp')) m.emissiveColor = new Color3(1, 0.93, 0.8)
    if (m.name.startsWith('tail lamp')) m.emissiveColor = new Color3(0.55, 0.02, 0.02)
  }

  // Training annex (right of the forecourt)
  s.box('annex', [8, 5, 9], [16.2, 2.5, 9.5], annexMat)
  s.box('annex_roof', [8.4, 0.3, 9.4], [16.2, 5.15, 9.5], slate)
  // Hinged door (swings into the annex) with a warm interior behind it
  const annexHinge = s.node('annex_hinge', [12.1, 0, 7.3])
  s.box('annex_door', [0.12, 2.6, 1.8], [0, 1.3, 0.9], iron, annexHinge)
  s.box('annex_glazing', [0.14, 0.7, 0.4], [-0.08, 1.95, 0.9], doorGlow, annexHinge)
  s.rod('annex_handle', [-0.11, 0.9, 1.5], [-0.11, 1.25, 1.5], 0.025, iron, annexHinge)
  s.plane('annex_interior', 1.8, 2.6, [12.18, 1.3, 8.2], s.glow('annex_interior_glow', new Color3(0.34, 0.22, 0.11)), Math.PI / 2)
  for (const z of [7.23, 9.17]) s.box(`annex_jamb_${z}`, [0.28, 2.85, 0.15], [12.05, 1.425, z], stone)
  s.box('annex_lintel', [0.3, 0.16, 2.1], [12.05, 2.85, 8.2], stone)
  s.box('annex_threshold', [0.65, 0.1, 2.3], [11.9, 0.05, 8.2], stoneDark)
  s.box('annex_canopy', [1.2, 0.12, 2.6], [11.6, 3.0, 8.2], iron)
  s.box('annex_lamp', [0.3, 0.2, 0.3], [12.0, 3.25, 8.2], lantern)

  // ── Lighting ────────────────────────────────────────────────────────────
  // All tiers: warm reflected stone light in the existing hemisphere; keep
  // the cool moon rim and tungsten key, with no extra light or shadow caster.
  const ambient = lit.hemi(0.85, new Color3(0.64, 0.69, 0.78), new Color3(0.22, 0.2, 0.18))
  const ambientBase = ambient.intensity
  lit.enableGlow(0.25)
  for (const m of s.meshes) if (/(facade|front_door|annex_door|^sky_)/.test(m.name)) lit.glow?.addExcludedMesh(m as Mesh)
  const key = lit.spot('key', new Vector3(7, 7, 2), new Vector3(0.15, -1, 0.35), 1.3, 70, WARM, 20)
  lit.enableShadows(key)
  // the floodlight on the house front: on the stone, not on whoever stands in front of it (adopt)
  const wash = lit.spot('facade_wash', new Vector3(0, 1.2, HOUSE_Z - 11), new Vector3(0, 0.48, 1), 1.8, 750, WARM, 45)
  // Rookie's headlights: a spot that rides with the car
  const headlight = lit.spot('headlight', new Vector3(-2.6, 0.75, 0), new Vector3(-1, -0.14, 0), 0.9, 0, new Color3(1, 0.94, 0.82), 30)
  headlight.parent = car
  lit.point('annex_light', new Vector3(11.8, 3.0, 8.2), 22, WARM, 9)
  const moon = lit.directional('moon', new Vector3(0.5, -1, 0.8), 0.95, MOON)

  const camPos = () => scene.activeCamera?.position ?? Vector3.Zero()
  s.track(rain(scene, quality, camPos))
  s.track(splashes(scene, quality, camPos))

  for (const m of s.meshes) if (m.name.startsWith('car_') || m.name.startsWith('post_')) lit.castShadow(m)
  lit.raiseLightLimit(s.materials)
  D.mergeDressing(s)
  lit.bakeProbe(new Vector3(2, 3, 6), s.meshes.filter((m) => !/^(halo|sky_)/.test(m.name)), 0.5)
  // the banner comes down in a later scene (`noBanner`)
  s.freezeStatic([car, annexHinge], { merge: true, keep: [banner, houseCar] })

  // ── Scripted events ─────────────────────────────────────────────────────
  type Tween = { t: number; dur: number; apply: (k: number) => void }
  const tweens: Tween[] = []
  const tween = (dur: number, apply: (k: number) => void, instant: boolean) => (instant ? apply(1) : tweens.push({ t: 0, dur, apply }))
  const parked = new Vector3(CAR.x, 0, CAR.z)
  const carArrive = (instant: boolean) => {
    const start = parked.subtract(carFront(CAR.yaw).scale(26))
    headlight.intensity = instant ? 0 : 140
    tween(4.6, (k) => {
      const e = 1 - (1 - k) ** 3
      car.position.copyFrom(Vector3.Lerp(start, parked, e))
      if (k >= 1) headlight.intensity = 0
    }, instant)
  }
  const annexDoor = (open: boolean, instant: boolean) => {
    const from = annexHinge.rotation.y
    tween(1.2, (k) => (annexHinge.rotation.y = from + ((open ? 1.45 : 0) - from) * (1 - (1 - k) ** 3)), instant)
  }
  // Until the arrival plays, the car waits out of sight down the drive
  car.position.copyFrom(parked.subtract(carFront(CAR.yaw).scale(26)))

  // ── Lightning ───────────────────────────────────────────────────────────
  let clock = 0
  let nextStrike = 4 + Math.random() * 4
  let flash = 0
  const moonBase = moon.intensity
  const strike = () => {
    flash = 1
    window.setTimeout(() => ctx.sfx('thunder'), 500 + Math.random() * 900)
  }

  const env: GameEnvironment = {
    id: 'estate',
    marks: {
      car_door: [5.6, 1.4],
      guard_patrol_a: [-5.5, 24.4],
      guard_patrol_b: [5.5, 24.4],
      walk_mid: [8.6, 5.4],
      annex_front: [11.2, 8.2],
      // the threshold: he stops in the doorway, silhouetted, and the scene cuts
      annex_in: [11.9, 8.2],
      guard_stairs: [-1.9, 24.6],
      guard_annex: [12.4, 6.3],
      // Scene 02's delivery: the man at the foot of the front steps, a second
      // up on the terrace by the door, and where Rookie stops in front of him
      door_guard: [0, 24.0],
      terrace_guard: [2.4, 28.6, terraceY],
      // the second man, come down the steps with the envelope
      door_guard2: [-1.35, 24.25],
      delivery_stand: [0, 22.75],
      drive_mid: [3.6, 6.2],
      fountain: [0, 14, 2.2],
      fountain_stand: [2.2, 10.3],
      house_car: [-4.6, 22.4, 1.1],
      house_car_stand: [-2.4, 19.6],
    },
    shots: {
      estate_crane: { pos: [11, 15, -16], target: [0, 7.5, HOUSE_Z], fov: 0.95, to: { pos: [6.5, 3.4, -5], target: [1.5, 5.2, HOUSE_Z] }, duration: 16, handheld: 0.004 },
      estate_walk: { pos: [3.2, 1.8, -1.2], target: [7.6, 1.3, 4.4], fov: 0.85, to: { pos: [7.4, 1.9, 1.6], target: [12.2, 1.45, 8.4] }, duration: 7 },
      car_arrive: { pos: [7.5, 0.55, 3.5], target: [-1.6, 0.9, -21], fov: 0.82, to: { pos: [7.7, 0.8, 3.9], target: [4.4, 0.9, 1.2] }, duration: 4.6, handheld: 0.006 },
      car_door_low: { pos: [8.1, 0.45, -0.4], target: [5.4, 1.45, 1.6], fov: 0.8 },
      annex_door: { pos: [7.1, 1.75, 3.0], target: [12.0, 1.35, 8.2], fov: 0.8 },
      // from up the drive, past the fountain: his car pulling in out of the rain
      drive_arrive: { pos: [2.2, 1.7, 8.6], target: [4.2, 0.9, 0.4], fov: 0.82, handheld: 0 },
      // on his side of the car: him out of the driver's door, the car behind him
      car_side_out: { pos: [8.9, 1.6, 6.8], target: [6.0, 1.15, 1.8], fov: 0.72, handheld: 0 },
      // from the side of the steps: the man at the door and Rookie in front of him, the house behind
      steps_side: { pos: [4.6, 1.7, 20.6], target: [-0.4, 1.5, 23.7], fov: 0.74, handheld: 0 },
      // from behind the men on the steps, down the drive: him walking back to his car
      drive_down: { pos: [-1.3, 2.4, 26.2], target: [3.0, 0.9, 7.0], fov: 0.74, handheld: 0 },
      // up the drive past the fountain to the grey sedan parked by the house
      house_car: { pos: [4.2, 1.75, 9.4], target: [-4.6, 0.95, 22.4], fov: 0.62, handheld: 0 },
    },
    bounds: { minX: -9, maxX: 9, minZ: -2, maxZ: 23.2 },
    obstacles: [
      // the fountain basin
      [-3.1, 10.9, 3.1, 17.1],
      // his car, and the one parked by the house
      [3.1, -1.2, 5.7, 3.6],
      [-5.6, 19.9, -3.6, 24.9],
    ],
    followYaw: 0,
    lighting: lit,
    walkable: [floor],
    event(name, instant = false) {
      if (name === 'lightning' && !instant) strike()
      else if (name === 'carArrive') carArrive(instant)
      else if (name === 'annexOpen') annexDoor(true, instant)
      else if (name === 'annexClose') annexDoor(false, instant)
      // a house that isn't the organisation's: no banner over the door
      else if (name === 'noBanner') banner.setEnabled(false)
      // the grey sedan has already left the house
      else if (name === 'houseCarGone') houseCar.setEnabled(false)
    },
    update(dt) {
      clock += dt
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]
        tw.t += dt
        tw.apply(Math.min(1, tw.t / tw.dur))
        if (tw.t >= tw.dur) tweens.splice(i, 1)
      }
      if (clock > nextStrike) {
        strike()
        nextStrike = clock + 9 + Math.random() * 9
      }
      if (flash > 0) {
        flash = Math.max(0, flash - dt * 2.6)
        const f = flash > 0.75 || (flash > 0.3 && flash < 0.45) ? flash : flash * 0.3
        moon.intensity = moonBase * (1 + f * 2.5)
        ambient.intensity = ambientBase + f * 0.9
      }
    },
    adopt(meshes: AbstractMesh[], materials: Material[]) {
      for (const m of meshes) lit.castActorShadow(m)
      wash.excludedMeshes.push(...meshes)
      lit.raiseLightLimit(materials)
      const mirror = ground.reflectionTexture as MirrorTexture | null
      if (mirror?.renderList) mirror.renderList.push(...meshes)
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
