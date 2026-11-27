import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { corrugatedTexture, emblemTexture, graffitiTexture, groundTextures, rng } from '../../engine/textures'
import { Actor } from '../characters/Actor'
import { BIKERS, MAD_DOG, ROOKIE } from '../characters/specs'
import { CameraDirector, type ShotTable } from '../CameraDirector'
import { Glow, Halo, Neon, Sky, useEnvLifecycle, useFx } from '../common'
import { ExploreLayer } from '../ExploreLayer'
import { FireBarrel, Motorcycle } from '../props'
import { Rain } from '../Rain'
import type { EnvProps } from './types'

// SCENES 03–05 — Pier 9 container yard. The confrontation runs along x≈0.4:
// Rookie approaches from +Z, Mad Dog holds court near the fire, and the
// container wall whose face sits at z = −10.78 is where he gets pinned.

const SHOTS: ShotTable = {
  dk_establish: { pos: [14, 10.5, 16], look: [-1, 1, -6], fov: 46, drift: [-0.5, -0.22, -0.3], handheld: 0.02 },
  dk_enter: { rel: 'rookie', pos: [0.9, 1.45, 3.3], lookRel: 'rookie', look: [-1.6, 1.5, -9], fov: 45, dur: 2.6, follow: 3 },
  dk_follow: { rel: 'rookie', pos: [0.3, 4.6, 6.6], lookRel: 'rookie', look: [-0.6, 0.6, -5], fov: 54, dur: 1.6, follow: 3 },
  dk_md_notice: { rel: 'maddog', lookRel: 'maddog', local: true, pos: [0.65, 1.45, 1.9], look: [0, 1.5, 0], fov: 32, dur: 1.4 },
  dk_rookie_ots: { rel: 'maddog', lookRel: 'rookie', local: true, pos: [-0.55, 1.72, -0.75], look: [0, 1.58, 0], fov: 32, dur: 0.01 },
  dk_md_low: { rel: 'maddog', lookRel: 'maddog', local: true, pos: [0.5, 0.8, 2.4], look: [0, 1.8, 0], fov: 40, dur: 1.8, follow: 3 },
  dk_surround: { pos: [6.2, 7.6, 3.6], look: [0.2, 0.4, -3.4], fov: 48, dur: 2.4, drift: [-0.75, 0, -0.35] },
  dk_faceoff: { pos: [3.1, 1.6, -3.55], look: [0.4, 1.55, -3.75], fov: 46, dur: 1.4, drift: [-0.08, 0, 0] },
  dk_push: { pos: [2.0, 1.5, -2.5], look: [0.4, 1.45, -3.4], fov: 42, dur: 0.01 },
  dk_rookie_close: { rel: 'rookie', lookRel: 'rookie', local: true, pos: [1.35, 1.55, 1.05], look: [0, 1.6, 0], fov: 30, dur: 0.01, follow: 6 },
  dk_punch: { pos: [-0.55, 1.62, -2.35], look: [0.4, 1.75, -4.6], fov: 38, dur: 0.01 },
  dk_second: { pos: [2.6, 1.9, -1.6], look: [0.4, 1.4, -5.2], fov: 44, dur: 0.6 },
  dk_charge: { pos: [1.0, 1.5, -0.5], look: [0.4, 1.55, -5.6], fov: 40, dur: 0.01 },
  dk_rookie_close2: { rel: 'rookie', lookRel: 'rookie', local: true, pos: [-1.45, 1.5, 0.7], look: [0, 1.6, 0], fov: 32, dur: 0.01, follow: 6 },
  dk_wall_side: { pos: [5.6, 2.2, -5.8], look: [0.4, 1.3, -8.3], fov: 46, dur: 0.01 },
  dk_grab: { pos: [3.1, 1.75, -7.9], look: [0.4, 1.55, -10.0], fov: 40, dur: 0.9 },
  dk_pin_close: { pos: [-3.0, 1.85, -8.6], look: [0.4, 1.72, -10.0], fov: 38, dur: 1.0 },
  dk_md_extreme: { rel: 'rookie', lookRel: 'maddog', local: true, pos: [-0.38, 1.86, -0.62], look: [0, 1.92, 0], fov: 30, dur: 0.01 },
  dk_rookie_pin_close: { rel: 'rookie', lookRel: 'rookie', local: true, pos: [0.85, 1.7, 1.0], look: [0, 1.62, 0], fov: 30, dur: 0.01 },
  dk_md_extreme2: { rel: 'maddog', lookRel: 'maddog', local: true, pos: [0.9, 1.92, 1.05], look: [0, 1.92, 0], fov: 27, dur: 0.01 },
  dk_from_bikers: { pos: [0.95, 2.0, -5.0], look: [0.4, 1.7, -10.0], fov: 40, dur: 0.01 },
  dk_biker_close: { rel: 'biker3', lookRel: 'biker3', local: true, pos: [0.35, 1.62, 1.7], look: [0, 1.62, 0], fov: 30, dur: 0.01 },
  dk_from_bikers2: { pos: [-2.6, 2.5, -3.8], look: [0.4, 1.4, -9.5], fov: 46, dur: 0.01 },
  dk_two_shot: { pos: [4.0, 1.75, -9.2], look: [0.4, 1.6, -9.6], fov: 42, dur: 1.2 },
  dk_md_close_soft: { rel: 'maddog', lookRel: 'maddog', local: true, pos: [1.1, 1.82, 2.4], look: [0, 1.82, 0], fov: 32, dur: 0.01, follow: 3 },
  dk_rookie_soft: { rel: 'rookie', lookRel: 'rookie', local: true, pos: [0.75, 1.68, 1.3], look: [0, 1.62, 0], fov: 30, dur: 0.01, follow: 3 },
  dk_pause: { pos: [2.5, 2.2, -6.4], look: [0.4, 1.6, -9.6], fov: 40, dur: 0.01, drift: [0.15, 0.07, 0.35] },
  dk_choice: { pos: [-1.7, 1.85, -6.9], look: [0.4, 1.8, -9.9], fov: 42, dur: 1.4 },
}

const CONTAINER_COLORS = ['#7a2a1e', '#1f4a52', '#5a5f63', '#8a6a2a', '#2a3a5a', '#3e2a22', '#6a1e1e']

/** Every stacked container in one instanced draw call. */
function Containers() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const items = useMemo(() => {
    const r = rng(5)
    const list: { p: [number, number, number]; ry: number; c: string }[] = []
    const stack = (x: number, z: number, ry: number, n: number) => {
      for (let k = 0; k < n; k++) list.push({ p: [x, 1.3 + k * 2.6, z], ry, c: CONTAINER_COLORS[Math.floor(r() * CONTAINER_COLORS.length)] })
    }
    // the slam wall (bottom box drawn separately) gets a stack on top
    list.push({ p: [0, 3.9, -12], ry: 0, c: '#1f4a52' })
    list.push({ p: [-0.6, 6.5, -12.1], ry: 0.02, c: '#8a6a2a' })
    for (const x of [-13, -10.4]) for (const z of [-14, -6, 2, 10]) stack(x, z, Math.PI / 2, 1 + Math.floor(r() * 3))
    for (const x of [10.5, 13.1]) for (const z of [-15, -7, 1, 9]) stack(x, z, Math.PI / 2, 1 + Math.floor(r() * 3))
    for (const x of [-12, 0, 12]) stack(x, -16, 0, 2 + Math.floor(r() * 2))
    for (const x of [-18, -6, 6, 18]) stack(x, -24, 0, 3)
    return list
  }, [])
  useEffect(() => {
    const m = ref.current!
    const o = new THREE.Object3D()
    const c = new THREE.Color()
    items.forEach((it, i) => {
      o.position.set(...it.p)
      o.rotation.set(0, it.ry, 0)
      o.updateMatrix()
      m.setMatrixAt(i, o.matrix)
      m.setColorAt(i, c.set(it.c))
    })
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [items])
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, items.length]}>
      <boxGeometry args={[12.2, 2.6, 2.44]} />
      <meshStandardMaterial map={corrugatedTexture()} roughness={0.55} metalness={0.55} />
    </instancedMesh>
  )
}

/** The container Mad Dog is slammed into — rings with a dent flash on impact. */
function SlamWall() {
  const mat = useRef<THREE.MeshStandardMaterial>(null)
  const pulse = useRef(0)
  useFx((n) => {
    if (n === 'clang') pulse.current = 1
  })
  useFrame((_, dt) => {
    pulse.current = Math.max(0, pulse.current - dt * 2.5)
    if (mat.current) mat.current.emissiveIntensity = pulse.current * 0.4
  })
  return (
    <group position={[0, 1.3, -12]}>
      <mesh>
        <boxGeometry args={[12.2, 2.6, 2.44]} />
        <meshStandardMaterial ref={mat} map={corrugatedTexture()} color="#7a2a1e" roughness={0.5} metalness={0.6} emissive="#ff6a3a" emissiveIntensity={0} />
      </mesh>
      <mesh position={[-3.6, 0.05, 1.235]}>
        <planeGeometry args={[4.4, 2.2]} />
        <meshStandardMaterial map={graffitiTexture(0)} transparent roughness={0.6} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
      <mesh position={[3.9, 0.1, 1.235]}>
        <planeGeometry args={[1.9, 1.9]} />
        <meshStandardMaterial map={emblemTexture()} transparent roughness={0.6} polygonOffset polygonOffsetFactor={-2} />
      </mesh>
    </group>
  )
}

function Crane() {
  const blink = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    if (blink.current) blink.current.visible = Math.sin(clock.elapsedTime * 2.4) > 0.2
  })
  const steel = <meshStandardMaterial color="#1a1c20" roughness={0.6} metalness={0.6} />
  return (
    <group position={[2, 0, -40]}>
      {[-9, 9].map((x) =>
        [-5, 5].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 14, z]}>
            <boxGeometry args={[1, 28, 1]} />
            {steel}
          </mesh>
        )),
      )}
      <mesh position={[0, 28, 8]}>
        <boxGeometry args={[20, 2, 40]} />
        {steel}
      </mesh>
      <mesh position={[0, 32, 0]}>
        <boxGeometry args={[6, 6, 6]} />
        {steel}
      </mesh>
      <group ref={blink}>
        <Halo position={[0, 36, 0]} color="#ff2a1a" size={3} />
        <Halo position={[0, 28, 28]} color="#ff2a1a" size={2.5} />
      </group>
    </group>
  )
}

function Floodlight({ position, target }: { position: [number, number, number]; target: [number, number, number] }) {
  const light = useRef<THREE.SpotLight>(null)
  const tgt = useMemo(() => new THREE.Object3D(), [])
  useEffect(() => {
    tgt.position.set(...target)
    if (light.current) light.current.target = tgt
  }, [tgt, target])
  return (
    <group>
      <mesh position={[position[0], position[1] / 2, position[2]]}>
        <cylinderGeometry args={[0.12, 0.18, position[1], 8]} />
        <meshStandardMaterial color="#1a1b1e" metalness={0.7} roughness={0.4} />
      </mesh>
      <mesh position={position}>
        <boxGeometry args={[1.4, 0.6, 0.3]} />
        <meshBasicMaterial color="#fff3dc" toneMapped={false} />
      </mesh>
      <Halo position={position} color="#ffe6c0" size={5} opacity={0.65} />
      <primitive object={tgt} />
      <spotLight ref={light} position={position} color="#ffd9a8" intensity={260} distance={40} angle={0.62} penumbra={0.7} decay={1.7} />
    </group>
  )
}

/** Lightning: brief sky flash on the thunder cue. */
function Lightning() {
  const light = useRef<THREE.DirectionalLight>(null)
  const t = useRef(10)
  useFx((n) => {
    if (n === 'thunder') t.current = 0
  })
  useFrame((_, dt) => {
    t.current += dt
    if (!light.current) return
    const x = t.current
    light.current.intensity = x < 0.08 ? 6 : x < 0.16 ? 0.5 : x < 0.24 ? 4 : Math.max(0, 2 - x * 6)
  })
  return <directionalLight ref={light} position={[-30, 50, 10]} color="#bcd0ff" intensity={0} />
}

export default function Dockyard({ quality }: EnvProps) {
  useEnvLifecycle('dockyard')
  const ground = useMemo(() => groundTextures('dockyard', '#2a2b2c', 33, [10, 10]), [])
  const bikes: { p: [number, number, number]; r: number; c: string }[] = [
    { p: [-2.53, 0, -8.07], r: 0.5, c: '#5a0f0e' }, // Mad Dog's ride
    { p: [4.3, 0, -7.4], r: 1.3, c: '#151515' },
    { p: [5.8, 0, -5.0], r: 1.6, c: '#2a2a2a' },
    { p: [-5.7, 0, -7.6], r: -1.2, c: '#151515' },
    { p: [-6.6, 0, -2.8], r: -1.45, c: '#3a0c0c' },
    { p: [-4.8, 0, -9.8], r: 0.3, c: '#151515' },
  ]

  return (
    <>
      <color attach="background" args={['#05070a']} />
      <fogExp2 attach="fog" args={['#0f1218', 0.03]} />
      <Sky top="#030509" horizon="#161a22" bottom="#050608" glow="#4a2414" glowDir={[1, 0.04, 0.25]} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2.5} color="#ff8a3a" position={[-4, 2, -5]} scale={[4, 3, 1]} />
        <Lightformer form="rect" intensity={2} color="#ffe0b0" position={[8, 12, -2]} rotation-x={Math.PI / 2} scale={[6, 6, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#4a5a80" position={[0, 25, 0]} rotation-x={Math.PI / 2} scale={[60, 60, 1]} />
      </Environment>

      <hemisphereLight args={['#2f3a58', '#0b0806', 0.5]} />
      <directionalLight position={[-12, 18, -30]} color="#8aa4d6" intensity={0.9} />
      <Lightning />
      <Floodlight position={[8.5, 11, -1]} target={[0.4, 0, -6]} />
      <pointLight position={[0.4, 3.2, -8.6]} color="#c9d4ff" intensity={8} distance={7} decay={1.8} />

      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial map={ground.map} roughnessMap={ground.rough} roughness={0.85} metalness={0.3} envMapIntensity={1.8} />
      </mesh>
      {/* quay edge + black water on the far left */}
      <mesh rotation-x={-Math.PI / 2} position={[-46, -0.6, 0]}>
        <planeGeometry args={[40, 120]} />
        <meshStandardMaterial color="#05080c" roughness={0.08} metalness={0.9} />
      </mesh>
      <mesh position={[-29.8, -0.3, 0]}>
        <boxGeometry args={[0.6, 0.6, 120]} />
        <meshStandardMaterial color="#2a2a2a" roughness={0.9} />
      </mesh>
      {/* freighter silhouette */}
      <mesh position={[-56, 6, -20]}>
        <boxGeometry args={[18, 14, 90]} />
        <meshStandardMaterial color="#0a0c10" roughness={0.9} />
      </mesh>
      <Halo position={[-47, 13, 10]} color="#ffd38a" size={2} />
      <Halo position={[-47, 13, -40]} color="#ff2a1a" size={2} />

      <Containers />
      <SlamWall />
      <Crane />

      {/* site office with a neon pier sign */}
      <group position={[9.4, 0, 6]}>
        <mesh position={[0, 1.6, 0]}>
          <boxGeometry args={[3.2, 3.2, 5]} />
          <meshStandardMaterial color="#2a2d30" roughness={0.8} metalness={0.3} />
        </mesh>
        <Neon text="PIER 9" color="#ff4a3a" position={[-1.62, 3.5, 0]} rotation={[0, -Math.PI / 2, 0]} height={0.8} flicker={0.25} />
        <mesh position={[-1.61, 1.4, 1]} rotation-y={-Math.PI / 2}>
          <planeGeometry args={[1.4, 0.9]} />
          <meshBasicMaterial color="#e8c48a" toneMapped={false} />
        </mesh>
        <Glow position={[-3, 0.04, 0.5]} color="#ff4a3a" scale={[4, 6]} opacity={0.3} ground />
      </group>

      {/* bollards, drums, pallets */}
      {[[-8, 12], [-8, 4], [-8, -4]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.35, z]}>
          <cylinderGeometry args={[0.22, 0.26, 0.7, 10]} />
          <meshStandardMaterial color="#c9a020" roughness={0.6} metalness={0.3} />
        </mesh>
      ))}
      {[[6.4, -9.4], [6.9, -8.8], [-7.2, 0.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.45, z]}>
          <cylinderGeometry args={[0.3, 0.3, 0.9, 14]} />
          <meshStandardMaterial color={i === 2 ? '#1f3a5a' : '#5a1a14'} roughness={0.5} metalness={0.5} />
        </mesh>
      ))}

      <FireBarrel position={[-3.6, 0, -4.8]} />
      {bikes.map((b, i) => (
        <Motorcycle key={i} position={b.p} rotation={[0, b.r, 0]} paint={b.c} lights={i === 0} />
      ))}

      <Actor id="rookie" spec={ROOKIE} />
      <Actor id="maddog" spec={MAD_DOG} />
      {BIKERS.map((b) => (
        <Actor key={b.id} id={b.id} spec={b} />
      ))}

      <ExploreLayer bounds={{ minX: -4.5, maxX: 5, minZ: -3.4, maxZ: 18 }} />
      <Rain count={quality.rainDrops} />
      <CameraDirector shots={SHOTS} />
    </>
  )
}
