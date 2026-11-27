import { Color3, DynamicTexture } from '@render/core'
import type { Mesh, SpotLight, StandardMaterial, TransformNode } from '@render/core'
import type { LightingManager } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import type { ChronosMachine } from './ChronosMachinePresentation'
import type { SetBuilder } from '@render/SetBuilder'

// The first human experiment (Scene 03): the hardware that turns the sample
// rig into a chamber for a person, and the effects of sending him.
//
//   cage           a ring of steel bars that rises out of the plinth around
//                  the platform once the subject is inside (the chamber closing)
//   prep cart      monitoring kit and the tray for his belongings
//   return rack    the console that holds the return signal, with its beacon
//   countdown      a display above the window, written to by `board:` events
//   flicker        the lab's lights stutter as the machine draws everything
//
// Events (all routed from the lab environment):
//   cageOpen · cageClose · belongings · beaconArm · beaconLive · beaconOff
//   subjectOn · subjectOff · surge · flicker · board:<TEXT>

export interface ChronosExperiment {
  /** Handles an experiment event; false if the name isn't one of ours. */
  event(name: string, instant: boolean): boolean
  /** Multiplier the set applies to its chamber lights (flicker, brownout). */
  readonly lightScale: number
  moving: TransformNode[]
  update(dt: number): void
}

export function buildChronosExperiment(
  s: SetBuilder,
  lit: LightingManager,
  machine: ChronosMachine,
  o: { floorY: number; cx: number; cz: number; panelLight: StandardMaterial; key: SpotLight },
): ChronosExperiment {
  const { scene } = s
  const { floorY, cx, cz } = o
  const steel = s.pbr('exp_steel', '#9ea3aa', { rough: 0.3, metal: 0.9 })
  const dark = s.pbr('exp_dark', '#1c1e22', { rough: 0.45, metal: 0.7 })
  const cageGlow = s.glow('exp_cage_glow', new Color3(0.1, 0.25, 0.45))
  const amber = s.glow('exp_amber', new Color3(1, 0.6, 0.2))

  // ── Safety cage around the platform ─────────────────────────────────────
  const cage = s.node('exp_cage', [cx, 0, cz])
  const base = machine.platformY
  const BARS = 14
  const R = 1.25
  for (let i = 0; i < BARS; i++) {
    const a = (i / BARS) * Math.PI * 2
    s.cyl(`exp_cage_bar_${i}`, 0.05, 2.35, [Math.cos(a) * R, base + 1.2, Math.sin(a) * R], steel, { parent: cage, tess: 8 })
  }
  s.torus('exp_cage_top', R * 2, 0.06, [0, base + 2.38, 0], steel, cage)
  s.torus('exp_cage_mid', R * 2, 0.03, [0, base + 1.3, 0], cageGlow, cage)
  s.torus('exp_cage_low', R * 2, 0.05, [0, base + 0.1, 0], dark, cage)
  // starts sunk into the plinth: Scene 02's demonstration never shows it
  const CAGE_DOWN = -2.45
  cage.position.y = CAGE_DOWN
  cage.setEnabled(false)

  // ── Prep cart: monitors, sensors, the belongings tray ───────────────────
  const cart = s.node('exp_cart', [-3.7, floorY, 10.7])
  s.box('exp_cart_body', [1.3, 0.85, 0.65], [0, 0.45, 0], dark, cart)
  s.box('exp_cart_top', [1.36, 0.04, 0.7], [0, 0.9, 0], steel, cart)
  const screenTex = s.track(T.screen(scene, 'tex_exp_vitals', 'wave', 911))
  // facing whoever stands at the cart (on the window side), leaning back a little
  const vitals = s.plane('exp_cart_screen', 0.7, 0.44, [0.25, 1.3, 0.2], s.glow('exp_vitals', new Color3(0.9, 0.95, 1), screenTex), 0, cart)
  vitals.rotation.x = 0.2
  s.box('exp_cart_screen_back', [0.74, 0.48, 0.03], [0.25, 1.3, 0.23], dark, cart).rotation.x = 0.2
  s.box('exp_tray', [0.45, 0.03, 0.3], [-0.35, 0.93, -0.1], steel, cart)
  const things: Mesh[] = [
    s.box('exp_tray_phone', [0.08, 0.012, 0.16], [-0.45, 0.955, -0.12], dark, cart),
    s.box('exp_tray_watch', [0.06, 0.02, 0.06], [-0.3, 0.955, -0.05], amber, cart),
    s.box('exp_tray_wallet', [0.1, 0.02, 0.08], [-0.22, 0.955, -0.15], s.pbr('exp_leather', '#3a2416', { rough: 0.6 }), cart),
  ]
  for (const t of things) t.setEnabled(false)
  s.cyl('exp_sensor_reel', 0.22, 0.12, [0.45, 1.0, -0.15], amber, { parent: cart, tess: 16 })

  // ── Return-signal rack ──────────────────────────────────────────────────
  const rack = s.node('exp_return', [3.9, floorY, 10.3])
  s.box('exp_return_body', [0.9, 2.1, 0.6], [0, 1.05, 0], dark, rack)
  const retTex = s.track(T.sign(scene, 'tex_exp_return', ['RETURN SIGNAL', 'CARRIER STANDBY'], { w: 384, h: 192, bg: '#06121c', fg: '#9fd6ff', accent: '#3d7bd1' }))
  const retScreen = s.plane('exp_return_screen', 0.7, 0.35, [0, 1.55, -0.31], s.glow('exp_return_glow', new Color3(0.9, 0.95, 1), retTex), 0, rack)
  const beaconMat = s.glow('exp_beacon', new Color3(0.08, 0.06, 0.03))
  s.sphere('exp_beacon_lamp', 0.16, [0, 2.2, 0], beaconMat, rack)
  for (const m of [vitals, retScreen]) lit.glow?.addExcludedMesh(m)

  // ── Countdown board above the window, facing the chamber ────────────────
  const boardTex = new DynamicTexture('tex_exp_board', { width: 512, height: 160 }, scene, true)
  s.track(boardTex)
  const bctx = boardTex.getContext() as unknown as CanvasRenderingContext2D
  const paintBoard = (text: string) => {
    bctx.fillStyle = '#05080c'
    bctx.fillRect(0, 0, 512, 160)
    bctx.fillStyle = '#3d7bd1'
    bctx.fillRect(0, 0, 512, 6)
    bctx.fillStyle = '#7fb8e6'
    bctx.font = '600 24px Oswald, sans-serif'
    bctx.textAlign = 'center'
    bctx.fillText('PROJECT CHRONOS · HUMAN TRIAL 01', 256, 42)
    bctx.fillStyle = text.startsWith('T-') ? '#ffb347' : '#e8f2fa'
    bctx.font = '700 50px Oswald, sans-serif'
    bctx.fillText(text, 256, 122)
    boardTex.update(true)
  }
  paintBoard('STANDBY')
  const board = s.plane('exp_board', 3.2, 1.0, [cx, 5.6, 6.62], s.glow('exp_board_mat', new Color3(1, 1, 1), boardTex), Math.PI)
  lit.glow?.addExcludedMesh(board)

  // ── State ───────────────────────────────────────────────────────────────
  let cageTarget = CAGE_DOWN
  let flickerT = 0
  let brownout = 1
  let beacon: 'off' | 'armed' | 'live' = 'off'
  let clock = 0
  let lightScale = 1

  const exp: ChronosExperiment = {
    moving: [cage],
    get lightScale() {
      return lightScale
    },
    event(name, instant) {
      if (name.startsWith('board:')) {
        paintBoard(name.slice(6))
        return true
      }
      switch (name) {
        case 'cageOpen':
        case 'cageClose':
          cageTarget = name === 'cageClose' ? 0 : CAGE_DOWN
          cage.setEnabled(true)
          if (instant) cage.position.y = cageTarget
          return true
        case 'belongings':
          for (const t of things) t.setEnabled(true)
          return true
        case 'beaconArm':
        case 'beaconLive':
        case 'beaconOff':
          beacon = name === 'beaconArm' ? 'armed' : name === 'beaconLive' ? 'live' : 'off'
          return true
        case 'subjectOn':
        case 'subjectOff':
          machine.setSubject(name === 'subjectOn', instant)
          return true
        case 'surge':
          if (!instant) machine.surge()
          return true
        case 'flicker':
          if (!instant) flickerT = 3.2
          return true
        default:
          return false
      }
    },
    update(dt) {
      clock += dt
      cage.position.y += (cageTarget - cage.position.y) * Math.min(1, dt * 1.6)
      if (cageTarget === CAGE_DOWN && cage.position.y < CAGE_DOWN + 0.02) cage.setEnabled(false)
      // stuttering lights while the machine pulls power, then a slow recovery
      if (flickerT > 0) {
        flickerT -= dt
        brownout = Math.random() < 0.18 ? 0.05 : 0.35 + Math.random() * 0.5
      } else brownout += (1 - brownout) * Math.min(1, dt * 1.5)
      lightScale = brownout
      o.panelLight.emissiveColor.set(0.5 * brownout, 0.56 * brownout, 0.64 * brownout)
      const pulse = beacon === 'live' ? (Math.sin(clock * 10) > 0 ? 1 : 0.15) : beacon === 'armed' ? 0.5 + 0.5 * Math.sin(clock * 2) : 0
      beaconMat.emissiveColor.set(0.08 + pulse * 0.25, 0.06 + pulse * 0.75, 0.03 + pulse * 1.0)
    },
  }
  return exp
}
