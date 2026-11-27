import { Color3, Color4, CreateBox, CreateTorus, FresnelParameters, Mesh, ParticleSystem, SphereParticleEmitter, StandardMaterial, Vector3 } from '@render/core'
import type { PointLight, TransformNode } from '@render/core'
import type { Quality } from '@render/Renderer'
import type { LightingManager } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import type { SetBuilder } from '@render/SetBuilder'

// The Chronos machine: a stepped plinth in the chamber pit, a fixed
// horizontal frame on four pylons, and three steel rings, each tilted on its
// own axis and spinning in its own plane around a central field. A slim
// sample mast holds the test payload at the centre. Each ring is tilted about
// a different horizontal axis, never the Z axis, so no ring plane contains
// the vertical (the mast) or the deck's line of sight (Z): the payload stays
// in view from the window and nothing ever collides.
//
// One `energy` level drives everything: ring speed, the blue of the inlays and
// conduits, the field, the particles drawn inward and the machine's light.
// Restraint is deliberate: it should read as expensive hardware, not magic.

export interface ChronosMachine {
  /** Nodes that move every frame (exempt from world-matrix freezing). */
  moving: TransformNode[]
  light: PointLight
  /** Current energy, for sets that dim their own lights as the machine draws power. */
  readonly energy: number
  /** Spin up or down toward `level` (0 dormant … 1 full power). */
  setEnergy(level: number, instant: boolean): void
  /** Discharge: flash, shockwave, and the payload leaves this moment in time. */
  pulse(instant: boolean): void
  /** The payload comes back (or is reset). */
  restore(instant: boolean): void
  /**
   * Human mode: the sample mast sinks into the platform and the field drops
   * and widens to wrap a person standing on it.
   */
  setSubject(on: boolean, instant: boolean): void
  /** A full-power discharge (sending or recalling a person): a bigger, longer flash. */
  surge(): void
  /** Height of the platform a subject stands on. */
  readonly platformY: number
  update(dt: number): void
}

const BLUE = new Color3(0.32, 0.64, 1)

export function buildChronosMachine(s: SetBuilder, lit: LightingManager, quality: Quality, floorY: number, cx: number, cz: number): ChronosMachine {
  const { scene } = s
  const centreY = floorY + 4.6
  const root = s.node('chronos', [cx, 0, cz])

  // ── Materials ───────────────────────────────────────────────────────────
  const steelTex = s.track(T.steelPanel(scene, 512, 4))
  const steel = s.pbr('chronos_steel', '#b4b8be', { albedo: steelTex, rough: 0.34, metal: 0.72 })
  const gunmetal = s.pbr('chronos_gunmetal', '#4a4e55', { rough: 0.4, metal: 0.7 })
  const blackened = s.pbr('chronos_black', '#121316', { rough: 0.55, metal: 0.6 })
  const copper = s.pbr('chronos_copper', '#b86a3c', { rough: 0.32, metal: 1 })
  const ceramic = s.pbr('chronos_ceramic', '#d8d9d6', { rough: 0.5 })
  const inlay = s.glow('chronos_inlay', BLUE.scale(0.2))
  // conduit bands in four phases, so a pulse can travel inward along the floor
  const bands = [0, 1, 2, 3].map((i) => s.glow(`chronos_band_${i}`, BLUE.scale(0.1)))
  const marker = s.glow('chronos_marker', new Color3(1, 0.6, 0.22))

  // ── Plinth and platform ─────────────────────────────────────────────────
  s.lathe('chronos_plinth', [[4.5, 0], [4.5, 0.25], [4.0, 0.32], [4.0, 0.55], [3.3, 0.62], [3.3, 0.85], [0.01, 0.85]], [0, floorY, 0], blackened, root)
  s.torus('chronos_plinth_inlay', 6.7, 0.05, [0, floorY + 0.86, 0], inlay, root)
  s.torus('chronos_step_inlay', 8.05, 0.04, [0, floorY + 0.56, 0], inlay, root)
  s.cyl('chronos_platform', 2.8, 0.16, [0, floorY + 0.93, 0], steel, { parent: root, tess: 40 })
  s.torus('chronos_platform_ring', 2.5, 0.05, [0, floorY + 1.02, 0], inlay, root)
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2
    s.box(`chronos_plinth_vent_${i}`, [0.5, 0.1, 0.05], [Math.cos(a) * 4.02, floorY + 0.44, Math.sin(a) * 4.02], gunmetal, root).rotation.y = -a + Math.PI / 2
  }

  // ── Fixed frame on four pylons ──────────────────────────────────────────
  const FRAME_R = 5.1
  s.torus('chronos_frame', FRAME_R * 2, 0.34, [0, centreY, 0], gunmetal, root)
  s.torus('chronos_frame_inner', FRAME_R * 2 - 0.5, 0.08, [0, centreY, 0], steel, root)
  for (let i = 0; i < 4; i++) {
    const a = Math.PI / 4 + (i * Math.PI) / 2
    const x = Math.cos(a) * FRAME_R
    const z = Math.sin(a) * FRAME_R
    const h = centreY - floorY
    s.box(`chronos_pylon_${i}`, [0.7, h + 0.4, 0.7], [x, floorY + h / 2 + 0.2, z], gunmetal, root).rotation.y = -a
    s.box(`chronos_pylon_cap_${i}`, [1.0, 0.7, 1.0], [x, centreY, z], steel, root).rotation.y = -a
    s.box(`chronos_pylon_foot_${i}`, [1.2, 0.3, 1.2], [x, floorY + 0.15, z], blackened, root).rotation.y = -a
    s.box(`chronos_pylon_light_${i}`, [0.08, 1.4, 0.04], [x - Math.cos(a) * 0.37, floorY + 1.4, z - Math.sin(a) * 0.37], inlay, root).rotation.y = -a
  }
  // magnetic bearing pads on the frame, aimed at the rings
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    s.box(`chronos_pad_${i}`, [0.4, 0.5, 0.3], [Math.cos(a) * (FRAME_R - 0.3), centreY, Math.sin(a) * (FRAME_R - 0.3)], blackened, root).rotation.y = -a
  }

  // ── Sample mast and payload ─────────────────────────────────────────────
  // (one node, so the whole mast can sink into the platform for a human test)
  const mast = s.node('chronos_mast_node', [0, 0, 0], root)
  const mastBase = floorY + 1.01
  const mastTop = centreY - 0.24
  s.cyl('chronos_mast', 0.3, mastTop - mastBase, [0, (mastBase + mastTop) / 2, 0], steel, { parent: mast, top: 0.12, tess: 20 })
  for (const t of [0.15, 0.45, 0.75]) s.cyl(`chronos_mast_collar_${t}`, 0.34 - t * 0.18, 0.07, [0, mastBase + (mastTop - mastBase) * t, 0], copper, { parent: mast, tess: 20 })
  s.cyl('chronos_cradle', 0.34, 0.08, [0, mastTop, 0], blackened, { parent: mast, tess: 20 })
  s.torus('chronos_cradle_ring', 0.34, 0.025, [0, mastTop + 0.05, 0], inlay, mast)
  const payload = s.node('chronos_payload', [0, centreY, 0], mast)
  s.box('chronos_payload_core', [0.3, 0.3, 0.3], [0, 0, 0], steel, payload).rotation.set(0.6, 0.7, 0.2)
  s.sphere('chronos_payload_shell', 0.36, [0, 0, 0], s.pbr('chronos_payload_glass', '#9fb4c6', { rough: 0.05, metal: 0.4 }), payload).visibility = 0.35

  // ── Rings ───────────────────────────────────────────────────────────────
  /**
   * A ring of steel segments spinning in its own plane. The plane is the
   * horizontal tipped by `tilt` about a horizontal axis at `heading` (0 = X).
   */
  const ring = (name: string, r: number, heading: number, tilt: number, depth: number, thick: number) => {
    const holder = s.node(`${name}_tilt`, [0, centreY, 0], root)
    holder.rotation.y = -heading
    const tip = s.node(`${name}_tip`, [0, 0, 0], holder)
    tip.rotation.x = tilt
    const spin = s.node(`${name}_spin`, [0, 0, 0], tip)
    const n = Math.max(28, Math.round(r * 9))
    const parts: Mesh[] = []
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2
      const seg = CreateBox(`${name}_seg_${i}`, { width: ((Math.PI * 2 * r) / n) * 0.965, height: thick, depth }, scene)
      seg.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
      seg.rotation.y = -a + Math.PI / 2
      parts.push(seg)
    }
    // one draw call per ring instead of one per segment
    const body = Mesh.MergeMeshes(parts, true, true)!
    body.name = `${name}_body`
    body.material = steel
    body.parent = spin
    body.receiveShadows = true
    s.meshes.push(body)
    // blue inner face and a dark outer channel
    s.torus(`${name}_inlay`, (r - depth / 2) * 2, 0.045, [0, 0, 0], inlay, spin)
    s.torus(`${name}_channel`, (r + depth / 2) * 2, 0.07, [0, 0, 0], blackened, spin)
    // copper coil wraps and amber index markers make the spin legible
    const wraps = 6
    for (let i = 0; i < wraps; i++) {
      const a = (i / wraps) * Math.PI * 2
      const coil = CreateTorus(`${name}_coil_${i}`, { diameter: Math.max(depth, thick) + 0.16, thickness: 0.12, tessellation: 20 }, scene)
      coil.position.set(Math.cos(a) * r, 0, Math.sin(a) * r)
      // the torus axis is local Y; lay it along the ring's tangent
      coil.rotation.set(Math.PI / 2, -a, 0)
      coil.material = copper
      coil.parent = spin
      coil.receiveShadows = true
      s.meshes.push(coil)
      const b = a + 0.5
      s.box(`${name}_marker_${i}`, [0.06, thick + 0.02, 0.16], [Math.cos(b) * (r + depth / 2), 0, Math.sin(b) * (r + depth / 2)], marker, spin).rotation.y = -b
    }
    return { holder, tip, spin }
  }
  // headings stay clear of ±90° and tilts of 0 (see the note at the top); the
  // outer ring's tilt keeps its lowest point above the plinth
  const rings = [
    { ...ring('chronos_ring_a', 4.3, 0, 0.9, 0.5, 0.34), speed: 0.55 },
    { ...ring('chronos_ring_b', 3.45, 0.96, -0.62, 0.42, 0.3), speed: -0.85 },
    { ...ring('chronos_ring_c', 2.6, -0.7, 0.34, 0.34, 0.26), speed: 1.3 },
  ]

  // ── Floor conduits from the walls to the plinth ─────────────────────────
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8
    const dir = new Vector3(Math.cos(a), 0, Math.sin(a))
    const from = dir.scale(12)
    const to = dir.scale(4.55)
    const y = floorY + 0.14
    s.rod(`chronos_conduit_${i}`, [from.x, y, from.z], [to.x, y, to.z], 0.26, blackened, root)
    for (let k = 0; k < 9; k++) {
      const p = Vector3.Lerp(to, from, (k + 0.5) / 9)
      const band = s.cyl(`chronos_conduit_band_${i}_${k}`, 0.3, 0.12, [p.x, y, p.z], bands[k % 4], { parent: root, tess: 12 })
      band.rotation.set(Math.PI / 2, -a + Math.PI / 2, 0)
    }
    // ceramic insulators where the conduit meets the plinth
    s.cyl(`chronos_insulator_${i}`, 0.42, 0.34, [to.x, y + 0.02, to.z], ceramic, { parent: root, tess: 16 }).rotation.set(Math.PI / 2, -a + Math.PI / 2, 0)
  }

  // ── The field, shockwave and discharge flash ────────────────────────────
  // (under their own node: they rescale every frame, so must never be frozen)
  const fx = s.node('chronos_fx', [0, 0, 0], root)
  const additive = (name: string, color: Color3) => {
    const m = new StandardMaterial(name, scene)
    m.disableLighting = true
    m.emissiveColor = color
    m.alpha = 0
    m.alphaMode = 1
    m.disableDepthWrite = true
    m.backFaceCulling = false
    s.track(m)
    s.materials.push(m)
    return m
  }
  const fieldMat = additive('chronos_field', BLUE)
  fieldMat.opacityFresnelParameters = new FresnelParameters()
  // bright only at the rim (left = grazing), so the payload stays visible inside it
  fieldMat.opacityFresnelParameters.leftColor = Color3.White()
  fieldMat.opacityFresnelParameters.rightColor = Color3.Black()
  fieldMat.opacityFresnelParameters.power = 3
  fieldMat.emissiveFresnelParameters = fieldMat.opacityFresnelParameters.clone()
  fieldMat.backFaceCulling = true
  const field = s.sphere('chronos_field', 2.0, [0, centreY, 0], fieldMat, fx)

  const flashTex = s.track(T.radialSprite(scene, 'tex_chronos_flash', 128, '200,225,255', 0.5))
  const flashMat = additive('chronos_flash', new Color3(0.8, 0.9, 1))
  flashMat.emissiveTexture = flashTex
  flashMat.opacityTexture = flashTex
  const flash = s.plane('chronos_flash', 3.2, 3.2, [0, centreY, 0], flashMat, 0, fx)
  flash.billboardMode = Mesh.BILLBOARDMODE_ALL

  const waveMat = additive('chronos_wave', BLUE)
  const wave = s.torus('chronos_wave', 1, 0.03, [0, centreY, 0], waveMat, fx)
  for (const m of [field, flash, wave]) {
    m.isPickable = false
    lit.glow?.addExcludedMesh(m)
  }

  // Motes drawn in toward the centre: negative emit power on a sphere shell
  const centre = new Vector3(cx, centreY, cz)
  const motes = new ParticleSystem('chronos_motes', quality === 'high' ? 900 : 350, scene)
  motes.particleTexture = s.track(T.radialSprite(scene, 'tex_chronos_mote', 32, '190,220,255', 0.5))
  motes.particleEmitterType = new SphereParticleEmitter(3.4, 0)
  motes.emitter = centre.clone()
  motes.minEmitPower = -1.1
  motes.maxEmitPower = -0.7
  motes.minLifeTime = 2.6
  motes.maxLifeTime = 3.2
  motes.minSize = 0.015
  motes.maxSize = 0.04
  motes.color1 = new Color4(0.6, 0.8, 1, 0.8)
  motes.color2 = new Color4(0.85, 0.92, 1, 0.5)
  motes.colorDead = new Color4(0.4, 0.6, 1, 0)
  motes.blendMode = ParticleSystem.BLENDMODE_ADD
  motes.emitRate = 0
  motes.start()
  s.track(motes)

  const light = lit.point('chronos_light', centre.clone(), 4, BLUE, 18)

  // ── State ───────────────────────────────────────────────────────────────
  let energy = 0.08
  let target = 0.08
  let flashT = 1
  let waveT = 1
  let clock = 0
  let payloadScale = 1
  let payloadTarget = 1
  // human mode: 0 = sample on the mast, 1 = mast down, field around a person
  let subject = 0
  let subjectTarget = 0
  let surgeT = 1
  const fieldHigh = centreY
  const fieldLow = floorY + 1.95
  // the light comes down with the field but stays well over a standing man's head (it blew his face out)
  const lightLow = floorY + 3.3

  return {
    moving: [mast, payload, fx, ...rings.flatMap((r) => [r.holder, r.tip, r.spin])],
    platformY: floorY + 1.01,
    light,
    get energy() {
      return energy
    },
    setEnergy(level, instant) {
      target = level
      if (instant) energy = level
    },
    pulse(instant) {
      payloadTarget = 0
      if (instant) payloadScale = 0
      else flashT = waveT = 0
    },
    setSubject(on, instant) {
      subjectTarget = on ? 1 : 0
      if (instant) subject = subjectTarget
    },
    surge() {
      surgeT = 0
      flashT = waveT = 0
    },
    restore(instant) {
      payloadTarget = 1
      if (instant) payloadScale = 1
      else flashT = 0.35
    },
    update(dt) {
      clock += dt
      // spin-up is slow and heavy; spin-down slower still
      energy += (target - energy) * Math.min(1, dt * (target > energy ? 0.55 : 0.35))
      for (const r of rings) r.spin.rotation.y += r.speed * (0.05 + energy * 1.6) * dt
      const hum = 0.88 + 0.12 * Math.sin(clock * 9.5)
      inlay.emissiveColor.copyFrom(BLUE.scale((0.12 + energy * 1.1) * hum))
      bands.forEach((b, i) => {
        const travel = 0.5 + 0.5 * Math.sin(clock * 5 + i * (Math.PI / 2))
        b.emissiveColor.copyFrom(BLUE.scale(0.05 + energy * (0.2 + 0.9 * travel)))
      })
      const m = 0.35 + 0.65 * energy
      marker.emissiveColor.set(m, 0.6 * m, 0.22 * m)
      // human mode: the mast sinks, the field drops to wrap whoever stands on the platform
      subject += (subjectTarget - subject) * Math.min(1, dt * 1.4)
      if (Math.abs(subjectTarget - subject) < 0.002) subject = subjectTarget
      mast.position.y = -3.7 * subject
      mast.setEnabled(subject < 0.98)
      fx.position.y = (fieldLow - fieldHigh) * subject
      ;(motes.emitter as Vector3).y = centreY + (fieldLow - fieldHigh) * subject
      field.scaling.setAll((0.8 + energy * 0.35 + Math.sin(clock * 3.1) * 0.03 * energy) * (1 + 0.35 * subject))
      fieldMat.alpha = Math.max(0, energy - 0.15) * 0.3
      motes.emitRate = energy > 0.2 ? energy * (quality === 'high' ? 260 : 110) : 0

      // discharge
      flashT = Math.min(1, flashT + dt * 1.6)
      waveT = Math.min(1, waveT + dt * 1.1)
      const f = flashT < 1 ? (1 - flashT) ** 2 : 0
      flashMat.alpha = f
      flash.scaling.setAll(1 + flashT * 2.5)
      wave.scaling.setAll(1 + waveT * 16)
      waveMat.alpha = waveT < 1 ? (1 - waveT) * 0.8 : 0
      surgeT = Math.min(1, surgeT + dt * 0.6)
      const surge = surgeT < 1 ? Math.sin(surgeT * Math.PI) : 0
      light.position.y = centreY + (lightLow - fieldHigh) * subject
      // with someone on the platform the steady glow is halved; the discharge still floods the cage
      light.intensity = 4 + energy * 60 * (1 - 0.5 * subject) + f * 260 + surge * 420
      flash.scaling.setAll(1 + flashT * 2.5 + surge * 4)

      // the payload blinks out at the discharge peak, back in on restore
      const rate = payloadTarget < payloadScale ? 18 : 6
      payloadScale += (payloadTarget - payloadScale) * Math.min(1, dt * rate)
      payload.scaling.setAll(Math.max(0.0001, payloadScale))
      payload.setEnabled(payloadScale > 0.01)
      payload.rotation.y += dt * (0.2 + energy * 0.8)
    },
  }
}
