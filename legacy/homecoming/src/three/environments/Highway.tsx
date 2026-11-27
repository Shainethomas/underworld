import { Environment, Lightformer } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import * as THREE from 'three'
import { groundTextures, rng, roadTexture, towerTexture, welcomeSignTexture } from '../../engine/textures'
import { Actor } from '../characters/Actor'
import { BIKERS, MAD_DOG, ROOKIE } from '../characters/specs'
import { CameraDirector, type ShotTable } from '../CameraDirector'
import { Glow, Halo, Neon, Sky, useEnvLifecycle, useFx } from '../common'
import { Motorcycle, PosedCharacter } from '../props'
import { Rain } from '../Rain'
import type { EnvProps } from './types'

// SCENE 01 — rainy highway into Port Argent at dusk. The road runs along Z;
// the city skyline sits far down -Z. Rookie walks the right shoulder (x≈8.6).

const SHOTS: ShotTable = {
  hw_wide: { pos: [22, 13, 52], look: [2, 14, -220], fov: 50, drift: [-0.7, -0.3, -1.3], handheld: 0.02 },
  hw_track: { rel: 'rookie', pos: [1.5, 1.95, 4.4], lookRel: 'rookie', look: [-0.8, 1.55, -7], fov: 42, dur: 4.0, follow: 3 },
  hw_front: { rel: 'rookie', lookRel: 'rookie', local: true, pos: [0.6, 1.1, 3.4], look: [0, 1.55, 0], fov: 38, dur: 2.2, follow: 3 },
  hw_close: { rel: 'rookie', lookRel: 'rookie', local: true, pos: [0.65, 1.5, 1.75], look: [0, 1.66, 0], fov: 30, dur: 1.6, follow: 4 },
  hw_title: { rel: 'rookie', pos: [-1.8, 2.4, 7.5], lookRel: 'rookie', look: [-4, 9, -120], fov: 50, dur: 3.2, drift: [0, 0.3, 0], follow: 2.5 },
}

function Skyline() {
  const towers = useMemo(() => {
    const r = rng(42)
    const list: { x: number; z: number; w: number; d: number; h: number; tex: number }[] = []
    for (let i = 0; i < 46; i++) {
      const x = (r() - 0.5) * 420
      const near = Math.abs(x) < 60
      list.push({ x: x * 1.4, z: -480 - r() * 200, w: 12 + r() * 18, d: 14 + r() * 20, h: (near ? 45 : 20) + r() * (near ? 110 : 60), tex: i % 6 })
    }
    return list
  }, [])
  const mats = useMemo(
    () =>
      Array.from(
        { length: 6 },
        (_, i) =>
          new THREE.MeshStandardMaterial({ color: '#1a1e28', emissive: '#ffffff', emissiveMap: towerTexture('highway', i + 1), emissiveIntensity: 0.75, roughness: 0.8, fog: false }),
      ),
    [],
  )
  return (
    <group>
      {towers.map((t, i) => (
        <mesh key={i} position={[t.x, t.h / 2, t.z]} material={mats[t.tex]}>
          <boxGeometry args={[t.w, t.h, t.d]} />
        </mesh>
      ))}
      {/* the old clock tower — the city's landmark */}
      <group position={[-6, 0, -520]}>
        <mesh position={[0, 60, 0]} material={mats[2]}>
          <boxGeometry args={[30, 120, 30]} />
        </mesh>
        <mesh position={[0, 138, 0]} material={mats[4]}>
          <boxGeometry args={[18, 36, 18]} />
        </mesh>
        <mesh position={[0, 175, 0]}>
          <coneGeometry args={[9, 40, 4]} />
          <meshStandardMaterial color="#141820" roughness={0.6} fog={false} />
        </mesh>
        <mesh position={[0, 215, 0]}>
          <cylinderGeometry args={[0.4, 0.8, 40, 6]} />
          <meshStandardMaterial color="#141820" fog={false} />
        </mesh>
        <Halo position={[0, 236, 0]} color="#ff2a1a" size={10} opacity={0.9} />
        <mesh position={[0, 140, 9.1]}>
          <circleGeometry args={[5, 24]} />
          <meshBasicMaterial color="#e8c47a" toneMapped={false} />
        </mesh>
      </group>
      {/* industrial edge: smokestacks + cranes */}
      {[-130, -150, -172].map((x, i) => (
        <group key={x} position={[x, 0, -190 - i * 20]}>
          <mesh position={[0, 38, 0]}>
            <cylinderGeometry args={[3, 4.5, 76, 10]} />
            <meshStandardMaterial color="#121418" roughness={0.9} />
          </mesh>
          <Halo position={[0, 78, 0]} color="#ff3020" size={5} />
        </group>
      ))}
      {[120, 150].map((x, i) => (
        <group key={x} position={[x, 0, -210 - i * 30]} rotation={[0, 0.6 + i * 0.4, 0]}>
          <mesh position={[0, 30, 0]}>
            <boxGeometry args={[3, 60, 3]} />
            <meshStandardMaterial color="#14161a" />
          </mesh>
          <mesh position={[18, 58, 0]}>
            <boxGeometry args={[60, 2.5, 2.5]} />
            <meshStandardMaterial color="#14161a" />
          </mesh>
          <Halo position={[46, 59, 0]} color="#ff3020" size={4} />
        </group>
      ))}
    </group>
  )
}

function StreetLamps() {
  const zs = useMemo(() => Array.from({ length: 14 }, (_, i) => 70 - i * 32), [])
  return (
    <group>
      {zs.map((z, i) =>
        [1, -1].map((side) => {
          const zz = side === 1 ? z : z - 16
          const x = side * 10.9
          return (
            <group key={`${i}${side}`} position={[x, 0, zz]}>
              <mesh position={[0, 4.5, 0]}>
                <cylinderGeometry args={[0.08, 0.12, 9, 8]} />
                <meshStandardMaterial color="#202226" metalness={0.7} roughness={0.4} />
              </mesh>
              <mesh position={[-side * 1.2, 8.95, 0]}>
                <boxGeometry args={[2.4, 0.1, 0.12]} />
                <meshStandardMaterial color="#202226" metalness={0.7} roughness={0.4} />
              </mesh>
              <mesh position={[-side * 2.3, 8.85, 0]}>
                <boxGeometry args={[0.7, 0.14, 0.3]} />
                <meshBasicMaterial color="#ffc27a" toneMapped={false} />
              </mesh>
              <Halo position={[-side * 2.3, 8.7, 0]} color="#ffae4a" size={3.2} opacity={0.75} />
              <Glow position={[-side * 2.3, 0.03, 0]} color="#ff9a3a" scale={[9, 11]} opacity={0.32} ground />
            </group>
          )
        }),
      )}
    </group>
  )
}

/** Distant traffic: headlight/taillight pairs gliding on the far lanes. */
function Traffic() {
  const cars = useRef<THREE.Group>(null)
  const seeds = useMemo(() => Array.from({ length: 6 }, (_, i) => ({ lane: i % 2 ? -3.2 : -6, offset: i * 70, speed: 16 + (i % 3) * 4 })), [])
  useFrame(({ clock }) => {
    cars.current?.children.forEach((c, i) => {
      const s = seeds[i]
      // oncoming (toward +z) on the left lanes
      c.position.z = -380 + ((clock.elapsedTime * s.speed + s.offset) % 460)
    })
  })
  return (
    <group ref={cars}>
      {seeds.map((s, i) => (
        <group key={i} position={[s.lane, 0, 0]}>
          <Halo position={[-0.7, 0.75, 0]} color="#fff1d6" size={1.6} />
          <Halo position={[0.7, 0.75, 0]} color="#fff1d6" size={1.6} />
          <Glow position={[0, 0.03, 4]} color="#ffe2b0" scale={[2.4, 9]} opacity={0.25} ground />
        </group>
      ))}
    </group>
  )
}

/** Three Mad Dogs blasting past toward the city when the `bikesPass` cue fires. */
function PassingBikes() {
  const group = useRef<THREE.Group>(null)
  const st = useRef({ t: -1 })
  useFx((name) => {
    if (name === 'bikesPass') st.current.t = 0
  })
  useFrame((_, dt) => {
    const g = group.current
    if (!g) return
    if (st.current.t < 0) {
      g.visible = false
      return
    }
    st.current.t += dt
    g.visible = st.current.t < 9
    g.children.forEach((b, i) => {
      b.position.z = 60 - st.current.t * (27 + i * 2) + i * 7
    })
  })
  const riders = [MAD_DOG, BIKERS[0], BIKERS[3]]
  return (
    <group ref={group} visible={false}>
      {riders.map((spec, i) => (
        <Motorcycle key={i} position={[2.4 + i * 1.6, 0, 60]} rotation={[0, Math.PI, 0]} paint={i === 0 ? '#2a0606' : '#151515'} lean={0.04 * (i - 1)}>
          <PosedCharacter spec={{ ...spec, id: `${spec.id}-rider` }} pose="ride" position={[0, 0, -0.12]} />
          <Glow position={[0, 0.03, 4]} color="#ffe2b0" scale={[2.4, 8]} opacity={0.4} ground />
        </Motorcycle>
      ))}
    </group>
  )
}

export default function Highway({ quality }: EnvProps) {
  useEnvLifecycle('highway')
  const road = roadTexture()
  const shoulder = useMemo(() => groundTextures('highway', '#1e1d1c', 9, [8, 60]), [])

  return (
    <>
      <color attach="background" args={['#0a0d16']} />
      <fogExp2 attach="fog" args={['#2a2834', 0.0045]} />
      <Sky top="#070b17" horizon="#3a2c38" bottom="#0c0b0d" glow="#a8482a" glowDir={[0, 0.02, -1]} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={1} color="#ff9a5a" position={[0, 6, -40]} scale={[60, 10, 1]} />
        <Lightformer form="rect" intensity={0.6} color="#5a6a9a" position={[0, 30, 0]} rotation-x={Math.PI / 2} scale={[80, 80, 1]} />
        <Lightformer form="ring" intensity={3} color="#ffae4a" position={[10, 9, 5]} scale={4} />
      </Environment>

      <hemisphereLight args={['#5d74a8', '#1a1410', 0.7]} />
      <directionalLight position={[-20, 25, -60]} color="#ff9a6a" intensity={1.4} />
      <directionalLight position={[30, 20, 40]} color="#6f86b8" intensity={0.35} />
      <pointLight position={[8.4, 8.6, 6]} color="#ffb860" intensity={18} distance={20} decay={1.8} />
      <pointLight position={[8.4, 8.6, 38]} color="#ffb860" intensity={18} distance={20} decay={1.8} />

      {/* road + shoulders */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -200]}>
        <planeGeometry args={[16, 600]} />
        <meshStandardMaterial map={road} roughness={0.4} metalness={0.2} envMapIntensity={0.9} />
      </mesh>
      {[1, -1].map((s) => (
        <mesh key={s} rotation-x={-Math.PI / 2} position={[s * 58, -0.02, -200]}>
          <planeGeometry args={[100, 600]} />
          <meshStandardMaterial map={shoulder.map} roughnessMap={shoulder.rough} roughness={1} metalness={0.15} />
        </mesh>
      ))}
      {/* guard rails */}
      {[1, -1].map((s) => (
        <group key={s}>
          <mesh position={[s * 10.2, 0.62, -200]}>
            <boxGeometry args={[0.08, 0.32, 600]} />
            <meshStandardMaterial color="#8d918f" metalness={0.85} roughness={0.35} />
          </mesh>
        </group>
      ))}

      {/* welcome sign, tagged by the gang */}
      <group position={[12.6, 0, 9]}>
        {[-2.1, 2.1].map((x) => (
          <mesh key={x} position={[x, 1.6, 0]}>
            <cylinderGeometry args={[0.07, 0.07, 3.2, 8]} />
            <meshStandardMaterial color="#5a5d5c" metalness={0.8} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, 3.7, 0]}>
          <planeGeometry args={[5.2, 2.6]} />
          <meshStandardMaterial map={welcomeSignTexture()} roughness={0.55} />
        </mesh>
        <mesh position={[0, 3.7, -0.03]} rotation-y={Math.PI}>
          <planeGeometry args={[5.2, 2.6]} />
          <meshStandardMaterial color="#1b1d1c" roughness={0.6} metalness={0.6} />
        </mesh>
      </group>

      {/* overhead gantry sign */}
      <group position={[0, 0, -60]}>
        {[-9.5, 9.5].map((x) => (
          <mesh key={x} position={[x, 3.6, 0]}>
            <boxGeometry args={[0.35, 7.2, 0.35]} />
            <meshStandardMaterial color="#2a2c2e" metalness={0.7} roughness={0.5} />
          </mesh>
        ))}
        <mesh position={[0, 7, 0]}>
          <boxGeometry args={[19.4, 0.4, 0.4]} />
          <meshStandardMaterial color="#2a2c2e" metalness={0.7} roughness={0.5} />
        </mesh>
        <Neon text="DOWNTOWN  ·  DOCKS" color="#7fe0a0" position={[3.8, 6.1, 0.25]} height={0.9} intensity={1.1} />
      </group>

      {/* roadside motel and bar, the first neon in town */}
      <group position={[-17, 0, -26]}>
        <mesh position={[0, 3, -3]}>
          <boxGeometry args={[14, 6, 8]} />
          <meshStandardMaterial color="#1b1716" roughness={0.9} />
        </mesh>
        <Neon text="MOTEL" color="#ff3b3b" position={[5, 7.5, 1.2]} rotation={[0, 0.5, 0]} height={3.2} vertical flicker={0.3} />
        <Neon text="VACANCY" color="#67d7ff" position={[-1, 4.3, 1.1]} rotation={[0, 0.4, 0]} height={0.7} flicker={0.6} />
        <Glow position={[6, 0.04, 6]} color="#ff3b3b" scale={[5, 14]} opacity={0.3} ground />
      </group>
      <group position={[-20, 0, -86]}>
        <mesh position={[0, 4, -3]}>
          <boxGeometry args={[16, 8, 10]} />
          <meshStandardMaterial color="#17171a" roughness={0.9} />
        </mesh>
        <Neon text="BAR" color="#ffb347" position={[6, 6.4, 2.2]} rotation={[0, 0.5, 0]} height={1.4} />
      </group>

      <StreetLamps />
      <Skyline />
      <Traffic />
      <PassingBikes />
      <Actor id="rookie" spec={ROOKIE} />
      <Rain count={quality.rainDrops} />
      <CameraDirector shots={SHOTS} />
    </>
  )
}
