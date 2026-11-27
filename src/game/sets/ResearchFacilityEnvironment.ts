import { Color3, Vector3 } from '@render/core'
import type { AbstractMesh, Material, Mesh, TransformNode } from '@render/core'
import { dust } from '@render/Effects'
import { LightingManager } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import { buildChronosExperiment } from './ChronosExperiment'
import { buildChronosMachine } from './ChronosMachinePresentation'
import { SetBuilder } from '@render/SetBuilder'
import type { EnvContext, EnvironmentFactory, GameEnvironment } from './types'

// Project Chronos. From the blast door a glass corridor runs north (+Z)
// between two working laboratories to the observation deck. The deck's
// window wall (z = 6) looks down into the chamber pit, where the Chronos
// machine stands on its plinth. The palette is the opposite of the gym:
// charcoal, stainless steel, cool blue light, and only small amber practicals.

const CORR = { w: 2, z0: -24, z1: -4, h: 3.4 }
const LABS = { x: 9, z0: -22, z1: -6 }
const DECK = { w: 10, z0: -4, z1: 6, h: 4.6 }
const PIT = { y: -3, w: 13, z1: 30, h: 10 }
const MACHINE = { x: 0, z: 17 }
const SILL = 0.95
const DECK_BOX = { min: [-9.6, 0.35, CORR.z0 + 0.3], max: [9.6, 4.3, DECK.z1 - 0.2] } as { min: [number, number, number]; max: [number, number, number] }
const PIT_BOX = { min: [-PIT.w + 0.4, PIT.y + 0.3, DECK.z1 + 0.6], max: [PIT.w - 0.4, PIT.y + 9, PIT.z1 - 0.4] } as { min: [number, number, number]; max: [number, number, number] }
/** Floor positions in the pit carry its height, so actors stand on it. */
const pit = (x: number, z: number): [number, number, number] => [x, z, PIT.y]

const build: EnvironmentFactory = async (ctx: EnvContext): Promise<GameEnvironment> => {
  const { scene, quality } = ctx
  const s = new SetBuilder(scene, 'lab')
  const lit = new LightingManager(scene, quality)
  const hi = quality === 'high'
  T.reseed(88)

  scene.fogMode = 2
  scene.fogDensity = 0.012
  scene.fogColor = new Color3(0.02, 0.026, 0.035)
  scene.clearColor.set(0.012, 0.015, 0.02, 1)

  // ── Materials ───────────────────────────────────────────────────────────
  const floorTex = s.track(T.labFloor(scene, hi ? 1024 : 512))
  const floorMat = s.pbr('lab_floor', '#ffffff', { albedo: floorTex, rough: 0.28, uv: [5, 7] })
  floorMat.clearCoat.isEnabled = true
  floorMat.clearCoat.intensity = 0.5
  floorMat.clearCoat.roughness = 0.15
  const labFloorMat = s.pbr('lab_room_floor', '#c9ccd0', { albedo: floorTex, rough: 0.4, uv: [3, 3] })
  const pitFloor = s.surface('pit_floor', 'concrete', [6, 6], '#5d6066', 0.6)
  const panelTex = s.track(T.steelPanel(scene, 512, 2))
  const wallPanel = s.pbr('wall_panel', '#3b3e44', { albedo: panelTex, rough: 0.5, metal: 0.55, uv: [6, 2] })
  const charcoal = s.pbr('charcoal', '#1b1c20', { rough: 0.7 })
  const ceiling = s.pbr('lab_ceiling', '#111215', { rough: 0.9 })
  const stainless = s.pbr('stainless', '#b9bcc1', { albedo: panelTex, rough: 0.24, metal: 1 })
  const darkSteel = s.pbr('dark_steel', '#202227', { rough: 0.42, metal: 0.8 })
  const bench = s.pbr('bench_top', '#e3e4e2', { rough: 0.35 })
  const glass = s.pbr('lab_glass', '#9fb8c8', { rough: 0.16, metal: 0.1 })
  glass.alpha = 0.12
  glass.backFaceCulling = false
  const panelLight = s.glow('panel_light', new Color3(0.5, 0.56, 0.64))
  const amber = s.glow('amber_practical', new Color3(1, 0.62, 0.24))
  const blueLed = s.glow('blue_led', new Color3(0.3, 0.62, 1))
  const hazard = s.pbr('lab_hazard', '#ffffff', { albedo: s.track(T.stripes(scene, 'hazard')), rough: 0.7, uv: [10, 1] })
  const screens = (['graph', 'wave', 'rings', 'text'] as const).flatMap((kind, i) =>
    [0, 1].map((k) => {
      const tex = s.track(T.screen(scene, `tex_screen_${kind}_${k}`, kind, 400 + i * 10 + k))
      const m = s.glow(`screen_${kind}_${k}`, new Color3(0.85, 0.92, 1), tex)
      return m
    }),
  )
  const screen = (i: number) => screens[i % screens.length]
  const signMat = (name: string, lines: string[], o: Parameters<typeof T.sign>[3] = {}) => {
    const tex = s.track(T.sign(scene, `tex_${name}`, lines, o))
    return s.pbr(name, '#ffffff', { albedo: tex, rough: 0.5, emissiveTex: tex })
  }

  // ── Corridor ────────────────────────────────────────────────────────────
  const corrLen = CORR.z1 - CORR.z0
  const corrMid = (CORR.z0 + CORR.z1) / 2
  const floor = s.box('floor', [DECK.w * 2, 0.2, DECK.z1 - CORR.z0], [0, -0.1, (DECK.z1 + CORR.z0) / 2], floorMat)
  floor.metadata = { walkable: true }
  s.box('corridor_ceiling', [CORR.w * 2 + 0.4, 0.2, corrLen], [0, CORR.h + 0.1, corrMid], ceiling)
  for (let z = CORR.z0 + 1.5; z < CORR.z1; z += 2.5) s.box(`corridor_panel_${z}`, [1.2, 0.04, 1.6], [0, CORR.h - 0.02, z], panelLight)
  s.box('corridor_runner', [0.06, 0.012, corrLen], [-0.9, 0.005, corrMid], blueLed)
  s.box('corridor_runner_r', [0.06, 0.012, corrLen], [0.9, 0.005, corrMid], blueLed)
  // entry from the blast door
  s.box('entry_wall_l', [LABS.x - 1.2, CORR.h, 0.4], [-(LABS.x + 1.2) / 2, CORR.h / 2, CORR.z0 - 0.2], wallPanel)
  s.box('entry_wall_r', [LABS.x - 1.2, CORR.h, 0.4], [(LABS.x + 1.2) / 2, CORR.h / 2, CORR.z0 - 0.2], wallPanel)
  s.box('entry_head', [2.4, CORR.h - 2.9, 0.4], [0, 2.9 + (CORR.h - 2.9) / 2, CORR.z0 - 0.2], wallPanel)
  s.plane('entry_beyond', 2.4, 2.9, [0, 1.45, CORR.z0 - 1.6], s.glow('entry_glow', new Color3(0.08, 0.1, 0.13)), Math.PI)
  s.box('entry_hazard', [2.4, 0.012, 0.6], [0, 0.007, CORR.z0 + 0.4], hazard)

  // Glass walls with steel mullions on both sides of the corridor
  for (const side of [-1, 1]) {
    const x = side * CORR.w
    s.box(`glass_wall_${side}`, [0.03, CORR.h, LABS.z1 - LABS.z0], [x, CORR.h / 2, (LABS.z0 + LABS.z1) / 2], glass)
    for (let z = LABS.z0; z <= LABS.z1 + 0.01; z += 2) s.box(`mullion_${side}_${z}`, [0.08, CORR.h, 0.08], [x, CORR.h / 2, z], darkSteel)
    s.box(`glass_kick_${side}`, [0.1, 0.12, LABS.z1 - LABS.z0], [x, 0.06, (LABS.z0 + LABS.z1) / 2], darkSteel)
    // short solid walls where the corridor meets the entry and the deck
    s.box(`corr_wall_a_${side}`, [0.3, CORR.h, LABS.z0 - CORR.z0], [x + side * 0.1, CORR.h / 2, (CORR.z0 + LABS.z0) / 2], wallPanel)
    s.box(`corr_wall_b_${side}`, [0.3, CORR.h, CORR.z1 - LABS.z1], [x + side * 0.1, CORR.h / 2, (CORR.z1 + LABS.z1) / 2], wallPanel)
  }

  // ── The two laboratories ────────────────────────────────────────────────
  const labMeshes: AbstractMesh[] = []
  const labStart = s.meshes.length
  for (const side of [-1, 1]) {
    const cx = side * (CORR.w + LABS.x) / 2
    const w = LABS.x - CORR.w
    const zc = (LABS.z0 + LABS.z1) / 2
    const d = LABS.z1 - LABS.z0
    s.box(`lab_floor_${side}`, [w, 0.02, d], [cx, 0.01, zc], labFloorMat)
    s.box(`lab_ceiling_${side}`, [w, 0.2, d], [cx, CORR.h + 0.1, zc], ceiling)
    s.box(`lab_back_${side}`, [0.3, CORR.h, d], [side * (LABS.x + 0.15), CORR.h / 2, zc], wallPanel)
    for (const z of [LABS.z0 - 0.15, LABS.z1 + 0.15]) s.box(`lab_end_${side}_${z}`, [w, CORR.h, 0.3], [cx, CORR.h / 2, z], wallPanel)
    for (let z = LABS.z0 + 2; z < LABS.z1; z += 4) s.box(`lab_light_${side}_${z}`, [2.6, 0.04, 0.5], [cx, CORR.h - 0.02, z], panelLight)

    // a long island bench with instruments and monitors
    const bx = side * 5.2
    s.box(`lab_bench_${side}`, [1.4, 0.06, 9], [bx, 0.92, zc], bench)
    s.box(`lab_bench_base_${side}`, [1.25, 0.88, 8.6], [bx, 0.45, zc], darkSteel)
    for (let k = 0; k < 3; k++) {
      const z = LABS.z0 + 4.5 + k * 3.4
      // facing the aisle between bench and corridor
      s.plane(`lab_monitor_${side}_${k}`, 0.7, 0.44, [bx, 1.32, z], screen(k + (side > 0 ? 3 : 0)), side * Math.PI / 2)
      s.box(`lab_monitor_back_${side}_${k}`, [0.04, 0.48, 0.74], [bx + side * 0.03, 1.32, z], darkSteel)
      s.cyl(`lab_scope_${side}_${k}`, 0.12, 0.42, [bx - side * 0.2, 1.16, z + 1.3], stainless, { tess: 12 })
      s.box(`lab_scope_base_${side}_${k}`, [0.3, 0.06, 0.24], [bx - side * 0.2, 0.98, z + 1.3], darkSteel)
    }
    // equipment racks along the back wall, LEDs blinking blue and amber
    for (let k = 0; k < 4; k++) {
      const z = LABS.z0 + 1.5 + k * 1.1
      s.box(`lab_rack_${side}_${k}`, [0.8, 2.2, 1.0], [side * (LABS.x - 0.5), 1.1, z], darkSteel)
      // a column of small status lights, not a lit panel
      for (let r = 0; r < 7; r++) s.box(`lab_rack_led_${side}_${k}_${r}`, [0.02, 0.03, 0.06], [side * (LABS.x - 0.92), 0.5 + r * 0.24, z - 0.3 + ((r * 3 + k) % 4) * 0.12], (r + k) % 3 ? blueLed : amber)
    }
    // cryogenic dewars and a centrifuge
    for (let k = 0; k < 2; k++) {
      s.cyl(`lab_dewar_${side}_${k}`, 0.55, 1.3, [side * (LABS.x - 0.8), 0.65, LABS.z1 - 1.2 - k * 0.8], stainless, { tess: 20 })
      s.cyl(`lab_dewar_cap_${side}_${k}`, 0.3, 0.12, [side * (LABS.x - 0.8), 1.36, LABS.z1 - 1.2 - k * 0.8], darkSteel, { tess: 16 })
    }
    s.cyl(`lab_centrifuge_${side}`, 0.7, 0.5, [bx, 1.2, LABS.z1 - 1.0], bench, { tess: 24 })
    // whiteboard of working notes
    const notes = side < 0 ? ['Δt = ħ / ΔE', 'ψ(x, t) → ψ(x, t − τ)', 'RETRIEVAL WINDOW 0.8 s'] : ['SAMPLE 41 — RETURNED', 'MASS LOSS 0.0002 %', 'HUMAN TRIAL: NOT APPROVED']
    s.plane(`lab_board_${side}`, 3.2, 1.4, [side * (LABS.x - 0.02), 2.0, zc + 2.5], signMat(`lab_board_mat_${side}`, notes, { bg: '#d9dcdc', fg: '#22324a' }), side * Math.PI / 2)
  }
  for (let i = labStart; i < s.meshes.length; i++) labMeshes.push(s.meshes[i])

  // ── Observation deck ────────────────────────────────────────────────────
  s.box('deck_ceiling', [DECK.w * 2, 0.2, DECK.z1 - DECK.z0], [0, DECK.h + 0.1, (DECK.z0 + DECK.z1) / 2], ceiling)
  for (const x of [-6, -2, 2, 6]) s.box(`deck_light_${x}`, [0.3, 0.04, DECK.z1 - DECK.z0 - 1.5], [x, DECK.h - 0.02, (DECK.z0 + DECK.z1) / 2 - 0.4], panelLight)
  // back wall around the corridor opening
  for (const side of [-1, 1]) {
    s.box(`deck_back_${side}`, [DECK.w - CORR.w, DECK.h, 0.3], [side * (DECK.w + CORR.w) / 2, DECK.h / 2, DECK.z0 - 0.15], wallPanel)
    s.box(`deck_side_${side}`, [0.3, DECK.h, DECK.z1 - DECK.z0], [side * (DECK.w + 0.15), DECK.h / 2, (DECK.z0 + DECK.z1) / 2], wallPanel)
  }
  s.box('deck_back_head', [CORR.w * 2, DECK.h - CORR.h, 0.3], [0, CORR.h + (DECK.h - CORR.h) / 2, DECK.z0 - 0.15], wallPanel)
  // sliding glass doors into the deck
  const doorL = s.node('deck_door_l', [-CORR.w / 2, 0, DECK.z0])
  const doorR = s.node('deck_door_r', [CORR.w / 2, 0, DECK.z0])
  for (const [n, side] of [[doorL, -1], [doorR, 1]] as const) {
    s.box(`deck_door_glass_${side}`, [CORR.w, 2.9, 0.04], [0, 1.45, 0], glass, n)
    s.box(`deck_door_frame_${side}`, [CORR.w, 0.08, 0.08], [0, 2.9, 0], darkSteel, n)
    s.box(`deck_door_edge_${side}`, [0.06, 2.9, 0.08], [-side * CORR.w / 2, 1.45, 0], darkSteel, n)
  }

  // Window wall onto the chamber: sill, glass, mullions, header
  s.box('window_sill', [DECK.w * 2, SILL, 0.4], [0, SILL / 2, DECK.z1 + 0.2], charcoal)
  s.box('window_ledge', [DECK.w * 2, 0.06, 0.55], [0, SILL + 0.03, DECK.z1 + 0.1], stainless)
  s.box('window_glass', [DECK.w * 2, DECK.h - SILL, 0.04], [0, SILL + (DECK.h - SILL) / 2, DECK.z1 + 0.3], glass)
  for (let x = -DECK.w; x <= DECK.w + 0.01; x += 2.5) s.box(`window_mullion_${x}`, [0.1, DECK.h - SILL, 0.14], [x, SILL + (DECK.h - SILL) / 2, DECK.z1 + 0.3], darkSteel)
  s.box('window_head', [DECK.w * 2, 0.3, 0.5], [0, DECK.h - 0.05, DECK.z1 + 0.3], darkSteel)
  s.box('window_ledge_strip', [DECK.w * 2, 0.02, 0.04], [0, SILL + 0.065, DECK.z1 - 0.15], amber)

  // Console banks either side of the centre aisle, facing the window
  const consoleAt = (name: string, x0: number, x1: number, z: number) => {
    const w = x1 - x0
    const cx = (x0 + x1) / 2
    s.box(`${name}_desk`, [w, 0.08, 0.95], [cx, 0.86, z], darkSteel)
    s.box(`${name}_body`, [w, 0.8, 0.7], [cx, 0.42, z + 0.1], charcoal)
    const n = Math.floor(w / 1.1)
    for (let k = 0; k < n; k++) {
      const x = x0 + 0.55 + k * 1.1
      // screens face the operator and lean back a little
      s.plane(`${name}_screen_${k}`, 0.9, 0.55, [x, 1.32, z + 0.32], screen(k + (x0 < 0 ? 0 : 2))).rotation.x = 0.18
      s.box(`${name}_screen_back_${k}`, [0.96, 0.6, 0.04], [x, 1.32, z + 0.36], darkSteel).rotation.x = 0.18
      s.box(`${name}_keys_${k}`, [0.55, 0.03, 0.22], [x, 0.91, z - 0.15], charcoal)
    }
    // a single amber task lamp per bank
    s.box(`${name}_lamp`, [0.3, 0.05, 0.14], [x1 - 0.3, 1.25, z - 0.25], amber)
    s.rod(`${name}_lamp_arm`, [x1 - 0.3, 0.9, z - 0.15], [x1 - 0.3, 1.24, z - 0.25], 0.02, stainless)
  }
  consoleAt('console_l', -8.8, -2.6, 2.2)
  consoleAt('console_r', 2.6, 8.8, 2.2)
  // server racks either side of the deck doors
  for (const side of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const x = side * (3.2 + k * 1.0)
      s.box(`deck_rack_${side}_${k}`, [0.9, 2.3, 0.9], [x, 1.15, DECK.z0 + 0.6], darkSteel)
      for (let r = 0; r < 8; r++) s.box(`deck_rack_led_${side}_${k}_${r}`, [0.05, 0.03, 0.02], [x - 0.3 + ((r * 5 + k) % 6) * 0.1, 0.45 + r * 0.22, DECK.z0 + 1.06], r % 4 ? blueLed : amber)
    }
  // the project's name, on the deck's side wall
  s.plane('chronos_plaque', 3.6, 1.6, [-DECK.w + 0.02, 2.6, 1.0], signMat('chronos_plaque_mat', ['PROJECT CHRONOS', 'TEMPORAL DISPLACEMENT RESEARCH · LEVEL 4'], { bg: '#0d0f12', fg: '#d9e6f2', accent: '#3d7bd1' }), -Math.PI / 2)
  s.plane('deck_warning', 2.2, 0.8, [DECK.w - 0.02, 2.6, 1.0], signMat('deck_warning_mat', ['CHAMBER LIVE', 'DO NOT ENTER DURING ACTIVATION'], { accent: '#c99a1c' }), Math.PI / 2)

  // ── Chamber pit ─────────────────────────────────────────────────────────
  const pitZc = (DECK.z1 + PIT.z1) / 2
  const pitD = PIT.z1 - DECK.z1
  const pitFloorMesh = s.box('pit_floor', [PIT.w * 2, 0.2, pitD], [0, PIT.y - 0.1, pitZc], pitFloor)
  pitFloorMesh.metadata = { walkable: true }
  s.box('pit_ceiling', [PIT.w * 2, 0.3, pitD + 1], [0, PIT.y + PIT.h + 0.15, pitZc], ceiling)
  s.box('pit_back', [PIT.w * 2, PIT.h, 0.4], [0, PIT.y + PIT.h / 2, PIT.z1 + 0.2], wallPanel)
  for (const side of [-1, 1]) s.box(`pit_side_${side}`, [0.4, PIT.h, pitD], [side * (PIT.w + 0.2), PIT.y + PIT.h / 2, pitZc], wallPanel)
  s.box('pit_front_low', [PIT.w * 2, -PIT.y, 0.4], [0, PIT.y / 2, DECK.z1 + 0.2], wallPanel)
  s.box('pit_front_high', [PIT.w * 2, PIT.y + PIT.h - DECK.h, 0.4], [0, DECK.h + (PIT.y + PIT.h - DECK.h) / 2, DECK.z1 + 0.2], wallPanel)
  for (const side of [-1, 1]) s.box(`pit_front_wing_${side}`, [PIT.w - DECK.w, DECK.h, 0.4], [side * (PIT.w + DECK.w) / 2, DECK.h / 2, DECK.z1 + 0.2], wallPanel)
  // vertical ribs with small amber practicals, and a high catwalk
  for (let k = 0; k <= 8; k++) {
    const z = DECK.z1 + 1.5 + k * ((pitD - 3) / 8)
    for (const side of [-1, 1]) {
      s.box(`pit_rib_${side}_${k}`, [0.5, PIT.h, 0.35], [side * (PIT.w - 0.25), PIT.y + PIT.h / 2, z], darkSteel)
      s.box(`pit_lamp_${side}_${k}`, [0.12, 0.2, 0.12], [side * (PIT.w - 0.55), PIT.y + 1.1, z], amber)
    }
  }
  for (let k = 0; k <= 8; k++) {
    const x = -PIT.w + 1.5 + k * ((PIT.w * 2 - 3) / 8)
    s.box(`pit_back_rib_${k}`, [0.35, PIT.h, 0.5], [x, PIT.y + PIT.h / 2, PIT.z1 - 0.25], darkSteel)
  }
  for (const side of [-1, 1]) {
    s.box(`catwalk_${side}`, [1.4, 0.1, pitD - 2], [side * (PIT.w - 1.2), 2.4, pitZc], darkSteel)
    s.box(`catwalk_rail_${side}`, [0.05, 0.05, pitD - 2], [side * (PIT.w - 1.9), 3.45, pitZc], stainless)
    for (let z = DECK.z1 + 2; z < PIT.z1 - 1; z += 2.4) s.rod(`catwalk_post_${side}_${z}`, [side * (PIT.w - 1.9), 2.45, z], [side * (PIT.w - 1.9), 3.45, z], 0.04, stainless)
  }
  s.box('catwalk_back', [PIT.w * 2 - 2, 0.1, 1.4], [0, 2.4, PIT.z1 - 1.2], darkSteel)
  // concentric floor rings and a hazard ring around the plinth
  s.torus('pit_ring_inner', 11.2, 0.05, [MACHINE.x, PIT.y + 0.01, MACHINE.z], blueLed)
  s.torus('pit_ring_hazard', 12.6, 0.18, [MACHINE.x, PIT.y + 0.0, MACHINE.z], hazard)
  // a ring of downlights in the ceiling above the machine (dark until the reveal)
  const ringLight = s.glow('ceiling_ring_light', new Color3(0, 0, 0))
  s.torus('ceiling_ring', 12, 0.12, [MACHINE.x, PIT.y + PIT.h - 0.05, MACHINE.z], ringLight)

  // ── Lighting ────────────────────────────────────────────────────────────
  // a warm, readable ambient (the machine and the key light keep the cold blue)
  lit.hemi(1.55, new Color3(0.8, 0.75, 0.7), new Color3(0.3, 0.26, 0.22))
  lit.enableGlow(0.32)
  const machine = buildChronosMachine(s, lit, quality, PIT.y, MACHINE.x, MACHINE.z)
  const key = lit.spot('chamber_key', new Vector3(MACHINE.x + 1.5, PIT.y + PIT.h - 0.4, MACHINE.z - 3), new Vector3(-0.1, -1, 0.2), 1.4, 150, new Color3(0.72, 0.84, 1), 20)
  lit.enableShadows(key)
  const keyBase = key.intensity
  // the chamber stays dark until someone throws the lights for the reveal
  let chamberOn = 0
  lit.spot('corridor_light', new Vector3(0, CORR.h - 0.1, -14), new Vector3(0, -1, 0.15), 2.4, 170, new Color3(0.82, 0.9, 1), 16)
  const labL = lit.point('lab_light_l', new Vector3(-5.5, CORR.h - 0.5, -14), 40, new Color3(0.82, 0.9, 1), 11)
  const labR = lit.point('lab_light_r', new Vector3(5.5, CORR.h - 0.5, -14), 40, new Color3(0.82, 0.9, 1), 11)
  // the labs' own fill stays in the labs (and off the cast in the corridor)
  labL.includedOnlyMeshes = labMeshes.filter((m) => m.position.x < 0)
  labR.includedOnlyMeshes = labMeshes.filter((m) => m.position.x >= 0)
  lit.spot('deck_light', new Vector3(0, DECK.h - 0.2, 0.5), new Vector3(0, -1, 0.25), 2.1, 190, new Color3(0.8, 0.88, 1), 12)
  for (const m of s.meshes) if (/^(lab_board|chronos_plaque|deck_warning|entry_beyond|lab_monitor|console_._screen)/.test(m.name)) lit.glow?.addExcludedMesh(m as Mesh)
  s.track(dust(scene, quality, new Vector3(-10, PIT.y + 0.5, DECK.z1 + 1), new Vector3(10, PIT.y + 8, PIT.z1 - 1), false))

  for (const m of s.meshes) if (/^chronos_(ring|pylon|frame|mast)/.test(m.name)) lit.castShadow(m)
  lit.raiseLightLimit(s.materials)
  const experiment = buildChronosExperiment(s, lit, machine, { floorY: PIT.y, cx: MACHINE.x, cz: MACHINE.z, panelLight, key })
  lit.raiseLightLimit(s.materials)
  lit.bakeProbe(new Vector3(0, 1.8, 2), s.meshes.filter((m) => !/^chronos_(field|flash|wave)/.test(m.name)), 0.5)
  s.freezeStatic([...machine.moving, ...experiment.moving, doorL, doorR] as TransformNode[], { merge: true })

  // ── Scripted events ─────────────────────────────────────────────────────
  type Tween = { t: number; dur: number; apply: (k: number) => void }
  const tweens: Tween[] = []
  const tween = (dur: number, apply: (k: number) => void, instant: boolean) => (instant ? apply(1) : tweens.push({ t: 0, dur, apply }))
  const setDeckDoors = (open: boolean, instant: boolean) => {
    const fl = doorL.position.x
    const fr = doorR.position.x
    const tl = -CORR.w / 2 - (open ? CORR.w - 0.1 : 0)
    const tr = CORR.w / 2 + (open ? CORR.w - 0.1 : 0)
    tween(1.1, (k) => {
      const e = k * k * (3 - 2 * k)
      doorL.position.x = fl + (tl - fl) * e
      doorR.position.x = fr + (tr - fr) * e
    }, instant)
  }

  const env: GameEnvironment = {
    id: 'lab',
    marks: {
      corr_in: [0, CORR.z0 + 0.8],
      corr_mid: [0.15, -15],
      corr_end: [0.1, -7.2],
      don_wait: [0.2, -6.0],
      guard_l: [-1.1, -6.9],
      guard_r: [1.25, -7.1],
      guard_l_deck: [-2.2, -2.4],
      guard_r_deck: [2.2, -2.4],
      deck_in: [0, -2.6],
      deck_mid: [0.1, 0.4],
      // the conversation by the window
      don_window: [-1.35, 4.75],
      rookie_window: [0.25, 3.7],
      // the conversation by the window: a wide triangle, so no one stands
      // between the camera and whoever is speaking
      sci_window: [2.35, 4.0],
      don_talk: [-1.9, 3.6],
      rookie_glass: [0.15, 5.1],
      don_glass: [-1.4, 5.2],
      sci_glass: [1.5, 5.25],
      window: [0, 6],
      // things to look at on the deck
      console_spot: [-3.7, 2.2],
      console_stand: [-3.7, 1.1],
      plaque_spot: [-DECK.w, 1.0],
      plaque_stand: [-8.5, 0.1],
      guards_stand: [1.2, -1.4],
      // the right-hand console bank, where the test cycle is started
      console_beside: [5.7, 1.0],
      machine: [MACHINE.x, MACHINE.z],
      sci_console: [4.4, 1.25],
      console_r: [4.4, 2.2],
      tech3_console: [-5.6, 1.25],
      console_l: [-5.6, 2.2],
      tech1_bench: [-4.3, -15.2],
      bench_l: [-5.2, -15.2],
      tech2_rack: [7.9, -16.9],
      rack_r: [8.7, -16.9],
      tech1_walk_a: [-4.2, -18.5],
      tech1_walk_b: [-4.2, -11.0],
      // ── Scene 03, on the chamber floor ──
      // conversation by the machine: a wide triangle, the machine behind them
      pit_rookie: pit(0.1, 8.3),
      pit_don: pit(-1.8, 10.6),
      pit_sci: pit(2.0, 11.0),
      pit_entry: pit(-11.6, 9.0),
      prep: pit(-3.35, 9.75),
      cart: pit(-3.7, 10.7),
      sensor_tech: pit(-2.2, 10.2),
      return_rack: pit(3.9, 10.3),
      sci_rack: pit(3.9, 9.45),
      plinth_front: pit(0, 12.0),
      platform: [MACHINE.x, MACHINE.z, PIT.y + 1.01],
      machine_front: pit(0, 13),
      pit_tech_a: pit(-5.6, 12.6),
      pit_tech_b: pit(5.4, 12.8),
      rush_a: pit(-1.3, 12.2),
      rush_b: pit(1.4, 12.3),
      don_returned: pit(-2.3, 9.6),
      sci_returned: pit(2.4, 10.0),
      rookie_returned: pit(0.15, 11.8),
      sci_brief: pit(2.6, 10.0),
      glass_from_pit: [0, 6.2, 1.5],
    },
    shots: {
      corridor_enter: { pos: [0.85, 1.75, CORR.z0 + 0.6], target: [-0.25, 1.35, -8], fov: 0.86, to: { pos: [0.7, 1.7, CORR.z0 + 3.0], target: [-0.2, 1.35, -6] }, duration: 7, handheld: 0.006 },
      // tracks alongside Rookie from inside the left lab, the technician in the foreground
      corridor_through_glass: { pos: [-7.0, 1.95, -16.2], target: [0.1, 1.3, -15.2], fov: 0.62, to: { pos: [-7.0, 1.95, -10.4], target: [0.1, 1.3, -9.6] }, duration: 4.6 },
      lab_right: { pos: [1.2, 1.7, -19.5], target: [7.6, 1.0, -15.5], fov: 0.68 },
      deck_reveal: { pos: [0.6, 2.5, -3.4], target: [0, 1.3, 17], fov: 0.82, to: { pos: [0.4, 2.1, -0.4], target: [0, 1.4, 17] }, duration: 7, handheld: 0.005 },
      deck_wide: { pos: [8.0, 3.4, -2.8], target: [-1.0, 1.2, 4.8], fov: 0.82 },
      plaque: { pos: [-6.2, 2.0, -1.8], target: [-DECK.w, 2.5, 1.0], fov: 0.6, to: { pos: [-6.6, 2.1, -1.0], target: [-DECK.w, 2.55, 1.0] }, duration: 5 },
      machine_low: { pos: [-2.6, PIT.y + 0.45, 8.6], target: [MACHINE.x, 2.6, MACHINE.z], fov: 0.92, to: { pos: [-3.6, PIT.y + 1.6, 9.6], target: [MACHINE.x, 1.8, MACHINE.z] }, duration: 9, handheld: 0.004 },
      machine_orbit: { pos: [9.0, 0.6, 9.4], target: [MACHINE.x, 1.4, MACHINE.z], fov: 0.74, to: { pos: [10.6, 1.5, 15.2], target: [MACHINE.x, 1.5, MACHINE.z] }, duration: 9, handheld: 0.004 },
      machine_top: { pos: [0.3, 6.6, 9.0], target: [MACHINE.x, -0.8, MACHINE.z], fov: 0.82, to: { pos: [0.2, 6.2, 10.4], target: [MACHINE.x, -1.0, MACHINE.z] }, duration: 8, handheld: 0.004 },
      // high and in front, looking down through the rings onto the sample in its cradle
      machine_core: { pos: [0.3, 5.6, MACHINE.z - 5.4], target: [MACHINE.x, 1.55, MACHINE.z], fov: 0.34, to: { pos: [0.25, 5.3, MACHINE.z - 5.0], target: [MACHINE.x, 1.55, MACHINE.z] }, duration: 7, handheld: 0.005 },
      machine_back: { pos: [1.8, -1.4, PIT.z1 - 2.5], target: [0, 1.7, DECK.z1], fov: 0.6, handheld: 0.004 },
      glass_rookie: { pos: [0.55, 1.75, DECK.z1 + 1.6], target: [0.15, 1.58, 5.0], fov: 0.5, to: { pos: [0.5, 1.72, DECK.z1 + 1.2], target: [0.15, 1.58, 5.0] }, duration: 9, handheld: 0.005 },
      // over Rookie's right shoulder: he holds the left of the frame, the machine the rest
      over_rookie: { pos: [0.55, 1.78, 3.5], target: [-1.2, 1.45, MACHINE.z], fov: 0.78, to: { pos: [0.5, 1.76, 3.85], target: [-1.2, 1.45, MACHINE.z] }, duration: 8, handheld: 0.006 },
      // over Rookie's shoulder at the console, the chamber beyond the glass
      console_ots: { pos: [5.35, 1.9, -0.4], target: [3.9, 1.3, 2.6], fov: 0.68, to: { pos: [5.15, 1.85, -0.1], target: [3.9, 1.35, 2.6] }, duration: 6, handheld: 0.006 },
      // Scene 03, in the chamber pit
      pit_group: { pos: [0.6, -1.25, 6.95], target: [0.1, -1.65, 11.5], fov: 0.86, handheld: 0.005 },
      // from the side wall: all three of them in one portrait frame
      pit_side: { pos: [-9.6, -1.3, 9.8], target: [0.6, -1.7, 9.95], fov: 0.86, to: { pos: [-9.2, -1.2, 9.4], target: [0.6, -1.65, 10.0] }, duration: 7, handheld: 0.005 },
      pit_over_rookie: { pos: [0.6, -1.2, 7.05], target: [-0.5, -0.6, MACHINE.z], fov: 0.66, to: { pos: [0.5, -1.25, 7.4], target: [-0.5, -0.6, MACHINE.z] }, duration: 6, handheld: 0.005 },
      subject_front: { pos: [0.55, -1.05, MACHINE.z - 4.1], target: [0, -0.55, MACHINE.z], fov: 0.6, handheld: 0.005 },
      // raised to mid-pit so the line up to the deck clears the window sill
      glass_from_pit: { pos: [1.2, 0.6, 11.5], target: [-1.3, 1.55, 5.2], fov: 0.5, handheld: 0.004 },
      board_view: { pos: [0.3, 3.6, 12.4], target: [0, 5.55, 6.62], fov: 0.95, handheld: 0.004 },
      window_group: { pos: [3.6, 1.9, 1.2], target: [-0.6, 1.55, 5.0], fov: 0.7, handheld: 0.006 },
    },
    bounds: { minX: -9, maxX: 9, minZ: CORR.z0 + 0.5, maxZ: DECK.z1 - 0.5 },
    obstacles: [
      [-8.8, 1.7, -2.6, 2.7],
      [2.6, 1.7, 8.8, 2.7],
      [-6.2, DECK.z0, -2.7, DECK.z0 + 1.1],
      [2.7, DECK.z0, 6.2, DECK.z0 + 1.1],
      [-CORR.w - 9, CORR.z0, -CORR.w, LABS.z1],
      [CORR.w, CORR.z0, CORR.w + 9, LABS.z1],
    ],
    followYaw: 0,
    cameraBox: { min: [-9.6, 0.35, CORR.z0 + 0.3], max: [9.6, 4.3, DECK.z1 - 0.2] },
    // down in the chamber pit, cameras keep to the pit instead
    cameraBoxAt: (target) => (target.z > DECK.z1 + 0.3 ? PIT_BOX : DECK_BOX),
    lighting: lit,
    walkable: [floor, pitFloorMesh],
    event(name, instant = false) {
      switch (name) {
        case 'deckDoorOpen':
          setDeckDoors(true, instant)
          break
        case 'deckDoorClose':
          setDeckDoors(false, instant)
          break
        case 'chamberLights':
          tween(2.6, (k) => (chamberOn = Math.max(chamberOn, Math.min(1, Math.floor(k * 3 + 0.6) / 3))), instant)
          break
        case 'machineIdle':
          machine.setEnergy(0.12, instant)
          break
        case 'machineWake':
          machine.setEnergy(0.45, instant)
          break
        case 'machineSpin':
          machine.setEnergy(1, instant)
          break
        case 'machinePulse':
          machine.pulse(instant)
          break
        case 'payloadReturn':
          machine.restore(instant)
          break
        // Scene 03: lights already up, and the machine winding right down
        case 'chamberLit':
          chamberOn = 1
          break
        case 'machineDown':
          machine.setEnergy(0.04, instant)
          break
        default:
          if (!experiment.event(name, instant)) console.warn(`[lab] unknown event ${name}`)
      }
    },
    update(dt) {
      for (let i = tweens.length - 1; i >= 0; i--) {
        const tw = tweens[i]
        tw.t += dt
        tw.apply(Math.min(1, tw.t / tw.dur))
        if (tw.t >= tw.dur) tweens.splice(i, 1)
      }
      machine.update(dt)
      experiment.update(dt)
      // the chamber's own lights sag as the machine draws power
      const lights = chamberOn * experiment.lightScale
      key.intensity = keyBase * lights * (1 - 0.45 * machine.energy)
      ringLight.emissiveColor.set(0.78 * lights, 0.86 * lights, 0.98 * lights)
    },
    adopt(meshes: AbstractMesh[], materials: Material[]) {
      for (const m of meshes) lit.castActorShadow(m)
      lit.raiseLightLimit(materials)
      // technicians at work in the labs need the labs' light too
      labL.includedOnlyMeshes.push(...meshes)
      labR.includedOnlyMeshes.push(...meshes)
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
