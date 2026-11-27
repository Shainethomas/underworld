import { useFrame } from '@react-three/fiber'
import { forwardRef, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { flameTexture } from '../engine/textures'
import type { PoseName } from '../narrative/types'
import { POSES, JOINTS } from './characters/poses'
import { createRig } from './characters/rig'
import type { CharacterSpec } from './characters/specs'
import { Glow, Halo } from './common'

// ── Motorcycle (cruiser) ──────────────────────────────────────────────────
// Built once from primitives, merged per material, shared by every bike.

type Part = { geo: THREE.BufferGeometry; p?: [number, number, number]; r?: [number, number, number]; s?: [number, number, number] }
function merge(parts: Part[]) {
  return mergeGeometries(
    parts.map(({ geo, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1] }) =>
      geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(...p), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(...s))),
    ),
    false,
  )!
}

/** Tube from a to b. */
function tube(a: [number, number, number], b: [number, number, number], r: number): Part {
  const va = new THREE.Vector3(...a)
  const vb = new THREE.Vector3(...b)
  const len = va.distanceTo(vb)
  const geo = new THREE.CylinderGeometry(r, r, len, 8)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), vb.clone().sub(va).normalize())
  const mid = va.add(vb).multiplyScalar(0.5)
  geo.applyQuaternion(q)
  return { geo, p: [mid.x, mid.y, mid.z] }
}

let bikeGeo: Record<'rubber' | 'chrome' | 'paint' | 'black' | 'seat', THREE.BufferGeometry> | null = null
function getBikeGeo() {
  if (bikeGeo) return bikeGeo
  const wheelZ = [0.78, -0.72]
  const rubber: Part[] = []
  const chrome: Part[] = []
  for (const z of wheelZ) {
    rubber.push({ geo: new THREE.TorusGeometry(0.3, 0.075, 10, 28), p: [0, 0.36, z], r: [0, Math.PI / 2, 0] })
    chrome.push({ geo: new THREE.TorusGeometry(0.22, 0.014, 6, 24), p: [0, 0.36, z], r: [0, Math.PI / 2, 0] })
    chrome.push({ geo: new THREE.CylinderGeometry(0.06, 0.06, 0.14, 12), p: [0, 0.36, z], r: [0, 0, Math.PI / 2] })
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2
      chrome.push(tube([0, 0.36, z], [0, 0.36 + Math.sin(a) * 0.22, z + Math.cos(a) * 0.22], 0.006))
    }
  }
  const black: Part[] = [
    tube([0, 0.95, 0.5], [0, 0.42, -0.1], 0.03),
    tube([0, 0.42, -0.1], [0, 0.36, -0.72], 0.025),
    tube([0, 0.78, -0.25], [0, 0.36, -0.72], 0.022),
    tube([0, 0.95, 0.5], [0, 0.8, -0.25], 0.028),
    { geo: new THREE.BoxGeometry(0.24, 0.26, 0.38), p: [0, 0.5, 0.05] },
    // fenders
    { geo: new THREE.TorusGeometry(0.36, 0.06, 6, 16, Math.PI * 0.7), p: [0, 0.36, -0.72], r: [0, -Math.PI / 2, Math.PI * 0.32], s: [1, 1, 1.6] },
  ]
  for (const s of [-1, 1]) {
    chrome.push(tube([s * 0.08, 1.02, 0.56], [s * 0.08, 0.36, 0.78], 0.024))
    chrome.push({ geo: new THREE.CylinderGeometry(0.07, 0.07, 0.2, 12), p: [s * 0.1, 0.58, 0.12], r: [0.5 * s, 0, s * 0.5] })
  }
  chrome.push(tube([-0.18, 1.12, 0.48], [0.18, 1.12, 0.48], 0.014))
  chrome.push(tube([-0.18, 1.12, 0.48], [-0.32, 1.18, 0.38], 0.014))
  chrome.push(tube([0.18, 1.12, 0.48], [0.32, 1.18, 0.38], 0.014))
  chrome.push(tube([0.15, 0.42, 0.15], [0.18, 0.32, -0.75], 0.035))
  chrome.push(tube([0.15, 0.5, 0.0], [0.2, 0.42, -0.8], 0.032))
  chrome.push({ geo: new THREE.SphereGeometry(0.09, 14, 10), p: [0, 0.95, 0.68], s: [1, 1, 0.8] })
  const paint: Part[] = [
    { geo: new THREE.SphereGeometry(0.2, 18, 12), p: [0, 0.86, 0.22], s: [0.8, 0.6, 1.5] },
    { geo: new THREE.TorusGeometry(0.33, 0.07, 6, 16, Math.PI * 0.5), p: [0, 0.36, 0.78], r: [0, -Math.PI / 2, Math.PI * 0.25], s: [1, 1, 1.3] },
  ]
  const seat: Part[] = [
    { geo: new THREE.CapsuleGeometry(0.12, 0.28, 4, 10), p: [0, 0.74, -0.2], r: [Math.PI / 2 + 0.12, 0, 0], s: [1.15, 1, 0.45] },
    tube([-0.32, 1.18, 0.38], [-0.4, 1.19, 0.34], 0.022),
    tube([0.32, 1.18, 0.38], [0.4, 1.19, 0.34], 0.022),
  ]
  bikeGeo = { rubber: merge(rubber), chrome: merge(chrome), black: merge(black), paint: merge(paint), seat: merge(seat) }
  return bikeGeo
}

const bikeMats = {
  rubber: new THREE.MeshStandardMaterial({ color: '#0d0d0d', roughness: 0.75 }),
  chrome: new THREE.MeshStandardMaterial({ color: '#d8d4cc', roughness: 0.16, metalness: 1, envMapIntensity: 1.6 }),
  black: new THREE.MeshStandardMaterial({ color: '#141414', roughness: 0.4, metalness: 0.6 }),
  seat: new THREE.MeshStandardMaterial({ color: '#1a1410', roughness: 0.45 }),
}
const paintMats = new Map<string, THREE.MeshStandardMaterial>()
const paintMat = (c: string) => {
  let m = paintMats.get(c)
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color: c, roughness: 0.18, metalness: 0.55, envMapIntensity: 1.8 })
    paintMats.set(c, m)
  }
  return m
}

export const Motorcycle = forwardRef<THREE.Group, {
  position?: [number, number, number]
  rotation?: [number, number, number]
  paint?: string
  lights?: boolean
  lean?: number
  children?: React.ReactNode
}>(function Motorcycle({ position, rotation, paint = '#5a0f0e', lights = true, lean = 0, children }, ref) {
  const g = getBikeGeo()
  return (
    <group ref={ref} position={position} rotation={rotation}>
      <group rotation={[0, 0, lean]}>
        <mesh geometry={g.rubber} material={bikeMats.rubber} />
        <mesh geometry={g.chrome} material={bikeMats.chrome} />
        <mesh geometry={g.black} material={bikeMats.black} />
        <mesh geometry={g.paint} material={paintMat(paint)} />
        <mesh geometry={g.seat} material={bikeMats.seat} />
        {lights && (
          <>
            <Halo position={[0, 0.95, 0.78]} color="#ffe2b0" size={0.7} opacity={0.9} />
            <Halo position={[0, 0.82, -0.98]} color="#ff2a1a" size={0.35} opacity={0.8} />
          </>
        )}
        {children}
      </group>
    </group>
  )
})

// ── Posed character (no store / animation — riders, background extras) ──

export function PosedCharacter({ spec, pose, position, rotation }: {
  spec: CharacterSpec
  pose: PoseName
  position?: [number, number, number]
  rotation?: [number, number, number]
}) {
  const rig = useMemo(() => createRig(spec), [spec])
  useEffect(() => {
    const p = POSES[pose]
    for (const j of JOINTS) rig.joints[j].rotation.set(...(p[j] ?? [0, 0, 0]))
    rig.joints.hips.position.y = rig.hipsY + (p.h ?? 0)
    rig.joints.hips.position.z = p.hz ?? 0
    const shadow = rig.root.getObjectByName('shadow')
    if (shadow && pose === 'ride') shadow.visible = false
  }, [rig, pose])
  return <primitive object={rig.root} position={position} rotation={rotation} />
}

// ── Fire barrel ───────────────────────────────────────────────────────────

export function FireBarrel({ position, light = true }: { position: [number, number, number]; light?: boolean }) {
  const flames = useRef<THREE.Group>(null)
  const lightRef = useRef<THREE.PointLight>(null)
  const embers = useMemo(() => {
    const n = 40
    const g = new THREE.BufferGeometry()
    const p = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) p.set([(Math.random() - 0.5) * 0.5, Math.random() * 3, (Math.random() - 0.5) * 0.5], i * 3)
    g.setAttribute('position', new THREE.BufferAttribute(p, 3))
    return g
  }, [])
  useEffect(() => () => embers.dispose(), [embers])
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    flames.current?.children.forEach((c, i) => {
      const s = 0.85 + Math.sin(t * (7 + i * 1.7) + i) * 0.15 + Math.sin(t * 13 + i * 3) * 0.08
      c.scale.set(0.55 * s + i * 0.05, (0.95 + i * 0.12) * s, 1)
      c.position.x = Math.sin(t * 3 + i) * 0.04
    })
    if (lightRef.current) lightRef.current.intensity = 14 + Math.sin(t * 11) * 2.5 + Math.sin(t * 23) * 1.5
    const pos = embers.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) + dt * (0.8 + (i % 5) * 0.2)
      if (y > 3) y = 0
      pos.setY(i, y)
      pos.setX(i, pos.getX(i) + Math.sin(t * 2 + i) * dt * 0.1)
    }
    pos.needsUpdate = true
  })
  const tex = flameTexture()
  return (
    <group position={position}>
      <mesh position={[0, 0.45, 0]}>
        <cylinderGeometry args={[0.3, 0.29, 0.9, 18, 1, true]} />
        <meshStandardMaterial color="#3b2a20" roughness={0.7} metalness={0.5} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.87, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.29, 18]} />
        <meshBasicMaterial color="#ff8a2a" toneMapped={false} />
      </mesh>
      <group ref={flames} position={[0, 1.2, 0]}>
        {[0, 1, 2].map((i) => (
          <sprite key={i} position={[0, i * 0.08, 0]}>
            <spriteMaterial map={tex} transparent blending={THREE.AdditiveBlending} depthWrite={false} color={new THREE.Color(2.2, 1.6, 1.1)} toneMapped={false} />
          </sprite>
        ))}
      </group>
      <points geometry={embers} position={[0, 0.9, 0]}>
        <pointsMaterial color="#ffb060" size={0.035} transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
      </points>
      <Halo position={[0, 1.3, 0]} color="#ff7a2a" size={3.2} opacity={0.5} />
      <Glow position={[0, 0.02, 0]} color="#ff6a20" scale={6} opacity={0.5} ground />
      {light && <pointLight ref={lightRef} position={[0, 1.6, 0]} color="#ff8a3a" intensity={14} distance={14} decay={1.6} />}
    </group>
  )
}
