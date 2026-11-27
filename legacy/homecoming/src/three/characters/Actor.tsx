import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useGame } from '../../game/store'
import type { ActorState } from '../../narrative/stage'
import { actors } from '../runtime'
import { ACTIONS, ARM_SWING, EXPRESSIONS, JOINTS, POSES, type Pose, type V3 } from './poses'
import { createRig } from './rig'
import type { CharacterSpec } from './specs'

const damp = THREE.MathUtils.damp
const tmp = new THREE.Vector3()
const ZERO: V3 = [0, 0, 0]

function wrap(a: number) {
  while (a > Math.PI) a -= Math.PI * 2
  while (a < -Math.PI) a += Math.PI * 2
  return a
}
function dampAngle(cur: number, target: number, k: number, dt: number) {
  return cur + wrap(target - cur) * (1 - Math.exp(-k * dt))
}

/**
 * A character on stage. Reads its target state from the store every frame
 * (no React re-renders) and blends toward it: root motion, gait, pose,
 * one-shot actions, head look-at and facial expression.
 */
export function Actor({ id, spec }: { id: string; spec: CharacterSpec }) {
  const rig = useMemo(() => createRig(spec), [spec])
  const st = useRef({
    applied: null as ActorState | null,
    pending: null as { state: ActorState; at: number } | null,
    lastSnap: -1,
    action: null as { name: keyof typeof ACTIONS; start: number; id: number } | null,
    lastActionId: -1,
    yaw: 0,
    gait: 0,
    walk: 0,
    lookYaw: 0,
    lookPitch: 0,
    clock: 0,
  })

  useEffect(() => {
    const rt = { root: rig.root, head: rig.joints.head, headPos: new THREE.Vector3(), chestPos: new THREE.Vector3(), moving: false }
    actors.set(id, rt)
    return () => {
      if (actors.get(id) === rt) actors.delete(id)
    }
  }, [id, rig])

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 20)
    const s = st.current
    s.clock += dt
    const target = useGame.getState().stage.actors[id]
    if (!target) {
      rig.root.visible = false
      return
    }

    // ── adopt new target state (honouring choreography delays / snaps)
    if (target !== s.applied && target !== s.pending?.state) {
      if (target.snap !== s.lastSnap || !s.applied) s.pending = { state: target, at: s.clock }
      else s.pending = { state: target, at: s.clock + target.delay }
    }
    if (s.pending && s.clock >= s.pending.at) {
      s.applied = s.pending.state
      s.pending = null
    }
    const a = s.applied!
    const snapping = a.snap !== s.lastSnap
    if (a.action && a.action.id !== s.lastActionId) {
      s.lastActionId = a.action.id
      if (!snapping) s.action = { name: a.action.name, start: s.clock, id: a.action.id }
    }

    rig.root.visible = a.visible
    rig.props.bag.visible = a.prop === 'bag'
    rig.props.bat.visible = a.prop === 'bat'
    rig.props.cash.visible = a.prop === 'cash'

    // ── root motion
    const p = rig.root.position
    const dx = a.pos[0] - p.x
    const dz = a.pos[1] - p.z
    const dist = Math.hypot(dx, dz)
    let moving = false
    if (snapping) {
      p.set(a.pos[0], 0, a.pos[1])
    } else if (dist > 0.01) {
      const step = Math.min(dist, a.speed * dt * (dist < 0.4 && a.move !== 'slide' ? Math.max(0.35, dist / 0.4) : 1))
      p.x += (dx / dist) * step
      p.z += (dz / dist) * step
      moving = a.move !== 'slide' && dist > 0.05
    }

    // ── facing
    let faceYaw = s.yaw
    if (moving) faceYaw = Math.atan2(dx, dz)
    else if (typeof a.face === 'number') faceYaw = a.face
    else {
      const other = actors.get(a.face)
      if (other) faceYaw = Math.atan2(other.root.position.x - p.x, other.root.position.z - p.z)
    }
    s.yaw = snapping ? faceYaw : dampAngle(s.yaw, faceYaw, moving ? 7 : 5, dt)
    rig.root.rotation.y = s.yaw

    // ── pose = base pose + active action keyframe
    let pose: Pose = POSES[a.pose] ?? POSES.idle
    let k = 7
    if (s.action) {
      const def = ACTIONS[s.action.name]
      const t = s.clock - s.action.start
      if (t > def.duration) s.action = null
      else {
        let key = def.keys[0]
        for (const kk of def.keys) if (t >= kk.at) key = kk
        pose = { ...pose, ...key.pose }
        k = key.k
      }
    }

    // gait
    const run = a.move === 'run'
    s.walk = damp(s.walk, moving ? 1 : 0, 6, dt)
    s.gait += dt * (moving ? (run ? 9.5 : Math.min(7.5, 3.4 + a.speed * 2.3)) : 0)
    const w = s.walk * (run ? 1.35 : 1)
    const g = s.gait
    const swing = (ARM_SWING[a.pose] ?? 1) * w
    const breath = Math.sin(s.clock * 1.7 + id.length) * 0.012

    // look-at
    let lookYaw = 0
    let lookPitch = 0
    if (a.look) {
      const other = actors.get(a.look)
      if (other) {
        rig.joints.head.getWorldPosition(tmp)
        const ox = other.headPos.x - tmp.x
        const oz = other.headPos.z - tmp.z
        lookYaw = THREE.MathUtils.clamp(wrap(Math.atan2(ox, oz) - s.yaw), -1.1, 1.1)
        lookPitch = THREE.MathUtils.clamp(Math.atan2(tmp.y - other.headPos.y, Math.hypot(ox, oz)), -0.5, 0.5)
      }
    }
    s.lookYaw = snapping ? lookYaw : damp(s.lookYaw, lookYaw, 5, dt)
    s.lookPitch = snapping ? lookPitch : damp(s.lookPitch, lookPitch, 5, dt)

    const add: Partial<Record<(typeof JOINTS)[number], V3>> = {
      lThigh: [-Math.sin(g) * 0.55 * w, 0, 0],
      rThigh: [Math.sin(g) * 0.55 * w, 0, 0],
      lShin: [(Math.max(0, Math.sin(g - 1.3)) * 0.95 + 0.08) * w, 0, 0],
      rShin: [(Math.max(0, Math.sin(g + Math.PI - 1.3)) * 0.95 + 0.08) * w, 0, 0],
      lUpperArm: [Math.sin(g) * 0.42 * swing, 0, 0],
      rUpperArm: [-Math.sin(g) * 0.42 * swing, 0, 0],
      lForeArm: [-0.3 * swing, 0, 0],
      rForeArm: [-0.3 * swing, 0, 0],
      spine: [0.04 * w + (run ? 0.12 * w : 0), Math.sin(g) * 0.06 * w, 0],
      chest: [breath, -Math.sin(g) * 0.1 * w, 0],
      neck: [s.lookPitch * 0.35, s.lookYaw * 0.35, 0],
      head: [s.lookPitch * 0.65, s.lookYaw * 0.65, 0],
    }

    for (const j of JOINTS) {
      const base = pose[j] ?? ZERO
      const ad = add[j] ?? ZERO
      const r = rig.joints[j].rotation
      const tx = base[0] + ad[0]
      const ty = base[1] + ad[1]
      const tz = base[2] + ad[2]
      if (snapping) r.set(tx, ty, tz)
      else {
        r.x = damp(r.x, tx, k, dt)
        r.y = damp(r.y, ty, k, dt)
        r.z = damp(r.z, tz, k, dt)
      }
    }
    const hips = rig.joints.hips.position
    const ty = rig.hipsY + (pose.h ?? 0) + (Math.abs(Math.cos(g)) * 0.035 - 0.02) * w
    const tz = pose.hz ?? 0
    hips.y = snapping ? ty : damp(hips.y, ty, k, dt)
    hips.z = snapping ? tz : damp(hips.z, tz, k, dt)

    // expression
    const e = EXPRESSIONS[a.expr]
    rig.browL.rotation.z = damp(rig.browL.rotation.z, e.browZ, 10, dt)
    rig.browR.rotation.z = damp(rig.browR.rotation.z, -e.browZ, 10, dt)
    rig.browL.position.y = rig.browR.position.y = damp(rig.browL.position.y, 0.14 + e.browY, 10, dt)
    rig.mouth.scale.y = damp(rig.mouth.scale.y, e.mouthY, 10, dt)
    rig.mouth.scale.x = damp(rig.mouth.scale.x, e.mouthX, 10, dt)
    rig.mouth.rotation.z = damp(rig.mouth.rotation.z, e.mouthZ, 10, dt)

    s.lastSnap = a.snap
    const rt = actors.get(id)
    if (rt) {
      rt.moving = moving
      rig.joints.head.getWorldPosition(rt.headPos)
      rig.joints.chest.getWorldPosition(rt.chestPos)
    }
  })

  return <primitive object={rig.root} />
}
