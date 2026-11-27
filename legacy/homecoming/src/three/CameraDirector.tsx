import { useFrame, useThree } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { useGame } from '../game/store'
import { actors, shake } from './runtime'

type V3 = [number, number, number]
type Anchor = string | [string, string]

/**
 * A named camera setup. `pos`/`look` are world coordinates, or offsets from
 * an actor's ground position (or the midpoint of two actors) when `rel` /
 * `lookRel` are given — so shots track actors as they move.
 */
export interface ShotDef {
  pos: V3
  look: V3
  rel?: Anchor
  lookRel?: Anchor
  /** offsets are in the anchor actor's own space (+z = where they face) */
  local?: boolean
  fov?: number
  /** seconds to blend in from the previous shot */
  dur?: number
  ease?: 'inOut' | 'out' | 'linear'
  /** slow camera travel in m/s for a living frame */
  drift?: V3
  handheld?: number
  /** follow smoothing (higher = tighter) */
  follow?: number
}
export type ShotTable = Record<string, ShotDef>

const ease = {
  inOut: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  out: (t: number) => 1 - Math.pow(1 - t, 3),
  linear: (t: number) => t,
}

const Y = new THREE.Vector3(0, 1, 0)

/** Anchor position plus offset; with `local`, the offset turns with a single actor. */
function resolve(a: Anchor | undefined, offset: V3, local: boolean | undefined, out: THREE.Vector3) {
  anchorPos(a, out)
  const o = new THREE.Vector3(...offset)
  if (local && typeof a === 'string') {
    const r = actors.get(a)
    if (r) o.applyAxisAngle(Y, r.root.rotation.y)
  }
  return out.add(o)
}

function anchorPos(a: Anchor | undefined, out: THREE.Vector3) {
  out.set(0, 0, 0)
  if (!a) return out
  const ids = typeof a === 'string' ? [a] : a
  let n = 0
  for (const id of ids) {
    const r = actors.get(id)
    if (r) {
      out.x += r.root.position.x
      out.z += r.root.position.z
      n++
    }
  }
  if (n) out.multiplyScalar(1 / n)
  return out
}

const v = new THREE.Vector3()

export function CameraDirector({ shots }: { shots: ShotTable }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const st = useRef({
    shotId: -1,
    def: null as ShotDef | null,
    t0: 0,
    from: new THREE.Vector3(),
    fromLook: new THREE.Vector3(),
    fromFov: 50,
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(0, 1, 0),
    tPos: new THREE.Vector3(),
    tLook: new THREE.Vector3(),
    clock: 0,
    snapFollow: true,
  })

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = st.current
    s.clock += dt
    const stage = useGame.getState().stage
    const def = shots[stage.shot]
    if (!def) return

    if (stage.shotId !== s.shotId) {
      s.shotId = stage.shotId
      s.def = def
      s.t0 = s.clock
      s.from.copy(s.pos)
      s.fromLook.copy(s.look)
      s.fromFov = camera.fov
      s.snapFollow = true
      if (stage.cut || s.def === null) s.t0 = -1e9
    }
    const d = s.def!
    const elapsed = s.clock - s.t0

    // raw target, then smoothed so actor-relative shots don't jitter
    resolve(d.rel, d.pos, d.local, v)
    if (d.drift) v.addScaledVector(new THREE.Vector3(...d.drift), Math.max(0, Math.min(elapsed, 30)))
    const lookT = resolve(d.lookRel, d.look, d.local, new THREE.Vector3())
    const f = d.follow ?? 5
    if (s.snapFollow) {
      s.tPos.copy(v)
      s.tLook.copy(lookT)
      s.snapFollow = false
    } else {
      s.tPos.lerp(v, 1 - Math.exp(-f * dt))
      s.tLook.lerp(lookT, 1 - Math.exp(-f * dt))
    }

    const dur = d.dur ?? 2.2
    const t = Math.min(1, Math.max(0, elapsed / dur))
    const e = ease[d.ease ?? 'inOut'](t)
    s.pos.lerpVectors(s.from, s.tPos, e)
    s.look.lerpVectors(s.fromLook, s.tLook, e)
    const fov = THREE.MathUtils.lerp(s.fromFov, d.fov ?? 45, e)

    // handheld breathing + impact shake
    shake.amount = Math.max(0, shake.amount - dt * 1.4)
    const hh = (d.handheld ?? 0.012) + shake.amount * 0.18
    const c = s.clock
    camera.position.set(
      s.pos.x + (Math.sin(c * 1.1) * 0.6 + Math.sin(c * 2.9) * 0.3) * hh + (Math.random() - 0.5) * shake.amount * 0.08,
      s.pos.y + (Math.sin(c * 1.37 + 1) * 0.6 + Math.sin(c * 3.3) * 0.25) * hh + (Math.random() - 0.5) * shake.amount * 0.08,
      s.pos.z + Math.sin(c * 0.9 + 2) * 0.4 * hh,
    )
    if (Math.abs(camera.fov - fov) > 0.01) {
      camera.fov = fov
      camera.updateProjectionMatrix()
    }
    camera.lookAt(s.look)
  })

  return null
}
