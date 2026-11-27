import { Color3, PBRMaterial, StandardMaterial, Vector3 } from '@render/core'
import type { AbstractMesh, Material, Mesh } from '@render/core'
import { dust } from '@render/Effects'
import { LightingManager, TUNGSTEN } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import { SetBuilder } from '@render/SetBuilder'
import type { EnvContext, EnvironmentFactory, GameEnvironment } from './types'

// Entrance to the Don's research facility, four levels under an anonymous
// industrial lot. A ramp drops into a concrete vehicle bay; the car stops at
// a manned barrier, passes under a scanning gantry and parks in front of the
// blast door, which only opens to a palm scan. Entry is along +Z.

const W = 6
const RAMP = { top: -46, bottom: -28, h: 3.2 }
const H = 5
const FRONT = 9
const DOOR = { x: -2, w: 2.4, h: 3 }
const CAR_X = 1.2
const STOPS: Record<string, number> = { top: -54, barrier: -21.6, scan: -11.2, bay: -1 }
const LOW = { x: 3.3, y: 1.0, z: -17.6 }
// Plate centre. Rookie's held palm (the "palm" gesture, his left hand) sits
// 0.19 m left of him, 1.44 m up and 0.44 m ahead (Palm_Loop, logged by
// build_character.py), so his mark is set back from the plate by that.
const SCANNER = { x: -0.25, y: 1.44 }
const PALM = { x: -0.21, z: 0.44 }

/** Floor height under a point of the lane. */
const floorY = (z: number) => (z <= RAMP.top ? RAMP.h : z >= RAMP.bottom ? 0 : RAMP.h * (1 - (z - RAMP.top) / (RAMP.bottom - RAMP.top)))

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'facility')
  const lit = new LightingManager(scene, quality)
  T.reseed(64)

  scene.fogMode = 2
  scene.fogDensity = 0.018
  scene.fogColor = new Color3(0.025, 0.03, 0.038)
  scene.clearColor.set(0.015, 0.018, 0.024, 1)

  // ── Materials ───────────────────────────────────────────────────────────
  const floorMat = s.surface('bay_floor', 'concrete', [6, 30], '#8c8f94', 0.7)
  floorMat.clearCoat.isEnabled = true
  floorMat.clearCoat.intensity = 0.25
  floorMat.clearCoat.roughness = 0.3
  const wallMat = s.surface('bay_wall', 'concrete', [14, 2], '#7c7f84')
  const ceilMat = s.pbr('bay_ceiling', '#17181b', { rough: 0.95 })
  const steelTex = s.track(T.steelPanel(scene, 512, 2))
  const steel = s.pbr('bay_steel', '#7d8189', { albedo: steelTex, rough: 0.42, metal: 0.85 })
  const dark = s.pbr('bay_dark_steel', '#1a1c20', { rough: 0.5, metal: 0.7 })
  const hazard = s.pbr('hazard', '#ffffff', { albedo: s.track(T.stripes(scene, 'hazard')), rough: 0.7, uv: [8, 1] })
  const barrierMat = s.pbr('barrier', '#ffffff', { albedo: s.track(T.stripes(scene, 'barrier')), rough: 0.5, uv: [6, 1] })
  const paint = s.pbr('lane_paint', '#c9c6bd', { rough: 0.6 })
  const strip = s.glow('strip_light', new Color3(0.82, 0.9, 1))
  const booth = s.glow('booth_glow', new Color3(0.55, 0.38, 0.2))
  const amber = s.glow('amber_lamp', new Color3(1, 0.6, 0.18))
  const corridor = s.glow('corridor_glow', new Color3(0.26, 0.32, 0.4))
  const glass = s.pbr('booth_glass', '#22303a', { rough: 0.08, metal: 0.4 })
  glass.alpha = 0.35
  const signMat = (name: string, lines: string[], accent?: string) => {
    const tex = s.track(T.sign(scene, `tex_${name}`, lines, { accent, fg: '#e9e4d6' }))
    return s.pbr(name, '#ffffff', { albedo: tex, rough: 0.6, emissiveTex: tex })
  }

  // ── Shell: ramp, lane, walls, ceiling ───────────────────────────────────
  const rampLen = Math.hypot(RAMP.bottom - RAMP.top, RAMP.h)
  const slope = Math.atan2(RAMP.h, RAMP.bottom - RAMP.top)
  const ramp = s.box('ramp', [W * 2, 0.3, rampLen], [0, RAMP.h / 2 - 0.15, (RAMP.top + RAMP.bottom) / 2], floorMat)
  ramp.rotation.x = slope
  s.box('ramp_top', [W * 2, 0.3, 14], [0, RAMP.h - 0.15, RAMP.top - 7], floorMat)
  const floor = s.box('floor', [W * 2, 0.2, FRONT - RAMP.bottom], [0, -0.1, (FRONT + RAMP.bottom) / 2], floorMat)
  floor.metadata = { walkable: true }
  const rampCeil = s.box('ramp_ceiling', [W * 2, 0.3, rampLen], [0, RAMP.h / 2 + H + 0.15, (RAMP.top + RAMP.bottom) / 2], ceilMat)
  rampCeil.rotation.x = slope
  s.box('ceiling', [W * 2, 0.3, FRONT - RAMP.bottom], [0, H + 0.15, (FRONT + RAMP.bottom) / 2], ceilMat)
  for (const side of [-1, 1]) {
    s.box(`wall_${side}`, [0.4, H + RAMP.h + 2, FRONT - RAMP.top + 16], [side * (W + 0.2), (H + RAMP.h) / 2, (FRONT + RAMP.top - 16) / 2], wallMat)
    s.box(`wall_band_${side}`, [0.06, 0.9, FRONT - RAMP.bottom - 4], [side * (W - 0.03), 0.45, (FRONT + RAMP.bottom) / 2 + 2], hazard)
    for (const z of [-24, -16, -8, 0, 6]) {
      s.box(`pillar_${side}_${z}`, [0.6, H, 0.7], [side * (W - 0.3), H / 2, z], wallMat)
      s.box(`pillar_band_${side}_${z}`, [0.64, 0.5, 0.74], [side * (W - 0.3), 0.5, z], hazard)
    }
  }
  for (let z = RAMP.top - 6; z < FRONT - 1; z += 4) {
    s.box(`strip_${z}`, [0.22, 0.06, 2.6], [0, floorY(z) + H - 0.05, z], strip)
    s.box(`beam_${z}`, [W * 2, 0.4, 0.3], [0, floorY(z) + H - 0.2, z + 2], dark)
  }
  // lane markings and the bay box
  for (let z = RAMP.bottom + 1; z < -6; z += 3) s.box(`dash_${z}`, [0.14, 0.012, 1.4], [-0.5, 0.006, z], paint)
  for (const x of [CAR_X - 1.5, CAR_X + 1.5]) s.box(`bay_line_${x}`, [0.12, 0.012, 6.5], [x, 0.006, STOPS.bay], paint)
  s.box('stop_line', [4.6, 0.012, 0.35], [0.8, 0.006, -18.9], paint)
  s.box('door_hazard', [5.2, 0.012, 1.2], [DOOR.x + 1.2, 0.007, FRONT - 1.1], hazard)

  // ── Front wall, blast door, palm scanner ────────────────────────────────
  const dl = DOOR.x - DOOR.w / 2
  const dr = DOOR.x + DOOR.w / 2
  s.box('front_l', [dl + W, H, 0.5], [(dl - W) / 2, H / 2, FRONT + 0.25], wallMat)
  s.box('front_r', [W - dr, H, 0.5], [(W + dr) / 2, H / 2, FRONT + 0.25], wallMat)
  s.box('front_top', [DOOR.w, H - DOOR.h, 0.5], [DOOR.x, DOOR.h + (H - DOOR.h) / 2, FRONT + 0.25], wallMat)
  s.box('door_frame', [DOOR.w + 0.5, 0.25, 0.7], [DOOR.x, DOOR.h + 0.12, FRONT + 0.1], dark)
  for (const x of [dl - 0.12, dr + 0.12]) s.box(`door_jamb_${x}`, [0.25, DOOR.h, 0.7], [x, DOOR.h / 2, FRONT + 0.1], dark)
  const doorL = s.node('blast_l', [DOOR.x - DOOR.w / 4, 0, FRONT + 0.25])
  const doorR = s.node('blast_r', [DOOR.x + DOOR.w / 4, 0, FRONT + 0.25])
  for (const [n, side] of [[doorL, -1], [doorR, 1]] as const) {
    s.box(`blast_${side}_slab`, [DOOR.w / 2, DOOR.h, 0.32], [0, DOOR.h / 2, 0], steel, n)
    s.box(`blast_${side}_edge`, [0.14, DOOR.h, 0.34], [-side * (DOOR.w / 4 - 0.07), DOOR.h / 2, 0], hazard, n)
  }
  s.plane('corridor_beyond', DOOR.w + 0.4, DOOR.h + 0.3, [DOOR.x, DOOR.h / 2, FRONT + 2.4], corridor)
  s.plane('sign_sublevel', 2.6, 0.65, [DOOR.x, DOOR.h + 0.9, FRONT - 0.02], signMat('sign_sublevel', ['SUBLEVEL 4'], '#c99a1c'))
  s.plane('sign_restricted', 3.2, 1.0, [3.4, 2.6, FRONT - 0.02], signMat('sign_restricted', ['RESTRICTED AREA', 'AUTHORISED PERSONNEL ONLY · BIOMETRIC ACCESS'], '#b0161d'))
  // palm scanner: a steel housing with a lit glass plate at palm height
  s.box('scanner_body', [0.36, 0.5, 0.12], [SCANNER.x, SCANNER.y, FRONT - 0.06], dark)
  const scanScreen = new StandardMaterial('scanner_screen', scene)
  scanScreen.disableLighting = true
  scanScreen.emissiveColor = new Color3(0.2, 0.55, 1)
  s.track(scanScreen)
  s.materials.push(scanScreen)
  s.plane('scanner_plate', 0.26, 0.34, [SCANNER.x, SCANNER.y, FRONT - 0.125], scanScreen)

  // ── Security booth and boom barrier ─────────────────────────────────────
  s.box('booth_base', [2.4, 1.0, 3.6], [4.7, 0.5, -20.2], dark)
  s.box('booth_roof', [2.7, 0.2, 3.9], [4.7, 2.9, -20.2], dark)
  for (const z of [-21.95, -18.45]) s.box(`booth_post_${z}`, [0.12, 1.9, 0.12], [3.55, 1.95, z], dark)
  s.box('booth_window', [0.05, 1.8, 3.4], [3.55, 1.95, -20.2], glass)
  s.box('booth_back', [0.1, 1.9, 3.5], [5.85, 1.95, -20.2], booth)
  s.box('booth_desk', [0.7, 0.08, 3.2], [4.0, 1.1, -20.2], dark)
  s.plane('sign_checkpoint', 2.2, 0.5, [4.7, 3.3, -22.05], signMat('sign_checkpoint', ['SECURITY CHECKPOINT']), 0)
  s.box('barrier_post', [0.35, 1.1, 0.35], [LOW.x, 0.55, LOW.z], dark)
  const boom = s.node('boom', [LOW.x, LOW.y, LOW.z])
  s.box('boom_arm', [6.0, 0.12, 0.12], [-3.0, 0, 0], barrierMat, boom)
  s.box('boom_counter', [0.6, 0.22, 0.2], [0.35, 0, 0], dark, boom)
  const beacons = [s.sphere('beacon_booth', 0.22, [4.7, 3.1, -18.5], amber), s.sphere('beacon_door', 0.22, [dr + 0.4, DOOR.h + 0.35, FRONT - 0.15], amber)]

  // ── Scanning gantry ─────────────────────────────────────────────────────
  const GZ = -11.2
  for (const side of [-1, 1]) s.box(`gantry_post_${side}`, [0.4, 4.2, 0.5], [side * 4.3, 2.1, GZ], steel)
  s.box('gantry_beam', [9.0, 0.5, 0.6], [0, 4.2, GZ], steel)
  s.box('gantry_emitter', [8.0, 0.12, 0.2], [0, 3.92, GZ], strip)
  const sheetMat = new StandardMaterial('scan_sheet', scene)
  sheetMat.disableLighting = true
  sheetMat.emissiveColor = new Color3(0.25, 0.65, 1)
  sheetMat.alpha = 0
  sheetMat.alphaMode = 1
  sheetMat.disableDepthWrite = true
  sheetMat.backFaceCulling = false
  s.track(sheetMat)
  s.materials.push(sheetMat)
  const sheet = s.plane('scan_sheet', 8.0, 3.9, [0, 1.95, GZ], sheetMat)
  sheet.isPickable = false
  const floorLine = s.box('scan_floor_line', [8.0, 0.015, 0.08], [0, 0.01, GZ], s.glow('scan_line', new Color3(0.2, 0.55, 1)))

  // The Don's car (shared sedan model)
  const car = await s.model('sedan', 'car_don', [CAR_X, RAMP.h, STOPS.top], Math.PI / 2)
  for (const m of s.materials) {
    if (!(m instanceof PBRMaterial)) continue
    if (m.name.startsWith('headlamp')) m.emissiveColor = new Color3(1, 0.95, 0.85)
    if (m.name.startsWith('tail lamp')) m.emissiveColor = new Color3(0.5, 0.02, 0.02)
  }

  // ── Lighting ────────────────────────────────────────────────────────────
  lit.hemi(0.9, new Color3(0.55, 0.62, 0.75), new Color3(0.2, 0.2, 0.22))
  const key = lit.spot('bay_key', new Vector3(1.5, H - 0.3, -6), new Vector3(-0.1, -1, 0.35), 2.2, 240, new Color3(0.82, 0.9, 1), 22)
  lit.enableShadows(key)
  lit.spot('ramp_light', new Vector3(0, RAMP.h + H - 0.4, -34), new Vector3(0, -1, 0.3), 1.9, 160, new Color3(0.78, 0.86, 1), 16)
  lit.point('booth_light', new Vector3(3.2, 2.4, -19.8), 30, TUNGSTEN, 9)
  const scanLight = lit.point('scan_light', new Vector3(0, 3.4, GZ), 0, new Color3(0.25, 0.6, 1), 9)
  const doorLight = lit.spot('door_light', new Vector3(DOOR.x, 2.6, FRONT + 2), new Vector3(0, -0.35, -1), 1.2, 0, new Color3(0.7, 0.82, 1), 14)
  const headlight = lit.spot('car_beam', new Vector3(-2.6, 0.75, 0), new Vector3(-1, -0.14, 0), 0.85, 0, new Color3(1, 0.94, 0.82), 26)
  headlight.parent = car
  lit.enableGlow(0.3)
  for (const m of s.meshes) if (/^(corridor_beyond|booth_back|sign_)/.test(m.name)) lit.glow?.addExcludedMesh(m as Mesh)
  lit.glow?.addExcludedMesh(sheet)
  s.track(dust(scene, quality, new Vector3(-5, 0.4, -24), new Vector3(5, 4.5, 8), false))

  for (const m of s.meshes) if (/^(car_don|booth_|boom_|gantry_post|pillar_\S+_\S+$)/.test(m.name)) lit.castShadow(m)
  lit.raiseLightLimit(s.materials)
  lit.bakeProbe(new Vector3(0, 2.4, -6), s.meshes.filter((m) => m !== sheet), 0.5)
  // the scan sheet sweeps the gate, the beacons pulse
  s.freezeStatic([car, boom, doorL, doorR], { merge: true, keep: [sheet, floorLine, ...beacons] })

  // ── Scripted events ─────────────────────────────────────────────────────
  type Tween = { t: number; dur: number; apply: (k: number) => void }
  const tweens: Tween[] = []
  const tween = (dur: number, apply: (k: number) => void, instant: boolean) => (instant ? apply(1) : tweens.push({ t: 0, dur, apply }))
  const ease = (k: number) => k * k * (3 - 2 * k)

  /** Seats the car on the lane at `z`, pitched to the ramp under its axles. */
  const placeCar = (z: number) => {
    const yf = floorY(z + 1.5)
    const yr = floorY(z - 1.5)
    car.position.set(CAR_X, (yf + yr) / 2, z)
    car.rotation.z = Math.atan2(yr - yf, 3.05)
  }
  placeCar(STOPS.top)
  const drive = (to: number, instant: boolean) => {
    const from = car.position.z
    const dur = Math.max(1.6, Math.abs(to - from) / 6.5)
    headlight.intensity = 140
    tween(dur, (k) => {
      placeCar(from + (to - from) * ease(k))
      if (k >= 1 && to === STOPS.bay) headlight.intensity = 25
    }, instant)
  }
  const setBoom = (up: boolean, instant: boolean) => {
    const from = boom.rotation.z
    tween(1.7, (k) => (boom.rotation.z = from + ((up ? -1.45 : 0) - from) * ease(k)), instant)
  }
  let scanning = -1
  const scan = (instant: boolean) => {
    if (instant) return
    scanning = 0
  }
  const setScanner = (ok: boolean) => scanScreen.emissiveColor.copyFrom(ok ? new Color3(0.25, 1, 0.45) : new Color3(0.2, 0.55, 1))
  const setBlast = (open: boolean, instant: boolean) => {
    const fl = doorL.position.x
    const fr = doorR.position.x
    const tl = DOOR.x - DOOR.w / 4 - (open ? DOOR.w / 2 + 0.05 : 0)
    const tr = DOOR.x + DOOR.w / 4 + (open ? DOOR.w / 2 + 0.05 : 0)
    tween(2.2, (k) => {
      const e = ease(k)
      doorL.position.x = fl + (tl - fl) * e
      doorR.position.x = fr + (tr - fr) * e
      doorLight.intensity = (open ? e : 1 - e) * 60
    }, instant)
  }

  let clock = 0
  const env: GameEnvironment = {
    id: 'facility',
    marks: {
      car_door: [CAR_X + 1.4, STOPS.bay - 0.7],
      // where security stops Rookie on his way to the door
      frisk: [CAR_X + 1.7, STOPS.bay + 1.6],
      booth: [3.05, -19.6],
      sentry_door: [DOOR.x - 1.9, FRONT - 1.5],
      scanner_stand: [SCANNER.x - PALM.x, FRONT - 0.125 - PALM.z],
      scanner: [SCANNER.x - PALM.x, FRONT],
      door_in: [DOOR.x, FRONT + 1.2],
      door_front: [DOOR.x, FRONT - 1.0],
      door_out: [DOOR.x, FRONT + 3.5],
    },
    shots: {
      ramp_down: { pos: [-3.4, 0.6, -24], target: [CAR_X, 4.2, -48], fov: 0.82, to: { pos: [-3.2, 0.8, -23.6], target: [CAR_X, 1.0, -24] }, duration: 6, handheld: 0.008 },
      checkpoint: { pos: [5.3, 1.75, -13.4], target: [0.6, 1.0, -21.5], fov: 0.72 },
      barrier_close: { pos: [-1.6, 0.85, -14.6], target: [2.2, 1.35, -18.2], fov: 0.62, handheld: 0.006 },
      gantry: { pos: [-4.4, 3.4, -3.2], target: [CAR_X, 1.2, -11.4], fov: 0.7, to: { pos: [-4.0, 3.1, -4.2], target: [CAR_X, 1.0, -11] }, duration: 6 },
      bay_wide: { pos: [5.0, 3.3, -9.0], target: [-0.6, 1.0, 5.0], fov: 0.8 },
      door_low: { pos: [1.4, 0.55, 3.0], target: [DOOR.x, 2.0, FRONT], fov: 0.78, handheld: 0.006 },
      // from his left: the reaching hand, the plate and his face in one frame
      scanner_close: { pos: [-1.5, 1.68, FRONT - 1.75], target: [-0.15, 1.45, FRONT - 0.35], fov: 0.78, handheld: 0.004 },
      door_open: { pos: [0.6, 1.5, 3.4], target: [DOOR.x, 1.5, FRONT + 2], fov: 0.72, to: { pos: [-0.6, 1.5, 5.2], target: [DOOR.x, 1.5, FRONT + 3] }, duration: 6 },
    },
    bounds: { minX: -5.5, maxX: 5.5, minZ: -26, maxZ: FRONT - 0.5 },
    obstacles: [
      [CAR_X - 1.05, STOPS.bay - 2.5, CAR_X + 1.05, STOPS.bay + 2.5],
      [3.4, -22.1, 6, -18.3],
    ],
    followYaw: 0,
    cameraBox: { min: [-5.6, 0.3, -50], max: [5.6, 4.7, FRONT - 0.3] },
    lighting: lit,
    walkable: [floor],
    event(name, instant = false) {
      if (name.startsWith('carTo:')) drive(STOPS[name.slice(6)], instant)
      else if (name === 'carParked') {
        drive(STOPS.bay, true)
        headlight.intensity = 25
      }
      else if (name === 'barrierUp') setBoom(true, instant)
      else if (name === 'barrierDown') setBoom(false, instant)
      else if (name === 'scanCar') scan(instant)
      else if (name === 'palmOk') setScanner(true)
      else if (name === 'blastOpen') setBlast(true, instant)
      else if (name === 'blastClose') setBlast(false, instant)
      else console.warn(`[facility] unknown event ${name}`)
    },
    update(dt) {
      clock += dt
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]
        tw.t += dt
        tw.apply(Math.min(1, tw.t / tw.dur))
        if (tw.t >= tw.dur) tweens.splice(i, 1)
      }
      // the scan sheet sweeps back and forth over the car twice
      if (scanning >= 0) {
        scanning += dt
        const k = Math.min(1, scanning / 3.2)
        const z = GZ + 3 * Math.cos(k * Math.PI * 2)
        sheet.position.z = z
        floorLine.position.z = z
        const a = Math.sin(k * Math.PI)
        sheetMat.alpha = 0.22 * a
        scanLight.intensity = 26 * a
        if (k >= 1) {
          scanning = -1
          sheet.position.z = floorLine.position.z = GZ
        }
      }
      for (const [i, b] of beacons.entries()) b.visibility = 0.25 + 0.75 * Math.max(0, Math.sin(clock * 4 + i * 2))
    },
    adopt(meshes: AbstractMesh[], materials: Material[]) {
      for (const m of meshes) lit.castActorShadow(m)
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
