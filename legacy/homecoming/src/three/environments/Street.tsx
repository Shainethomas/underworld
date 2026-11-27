import { Environment, Lightformer } from '@react-three/drei'
import { useMemo } from 'react'
import { facadeTexture, graffitiTexture, groundTextures, rng, storefrontTexture, emblemTexture } from '../../engine/textures'
import { Actor } from '../characters/Actor'
import { BIKERS, ROOKIE, SHOPKEEPER_2, SHOPKEEPER_3, SHOPKEEPER_SAL } from '../characters/specs'
import { CameraDirector, type ShotTable } from '../CameraDirector'
import { Glow, Halo, Neon, Sky, useEnvLifecycle } from '../common'
import { ExploreLayer } from '../ExploreLayer'
import { Motorcycle } from '../props'
import { Rain } from '../Rain'
import type { EnvProps } from './types'

// SCENE 02 — Calloway Street. Road along Z (x −4.5..4.5), sidewalks to ±8,
// shopfronts at x = ±8. Rookie enters from +Z. Old Sal's deli is on the left.

const SHOTS: ShotTable = {
  st_establish: { pos: [-2.6, 7.2, 34], look: [0.6, 1.4, 4], fov: 48, drift: [0.15, -0.3, -0.9], handheld: 0.02 },
  st_rookie_front: { rel: 'rookie', lookRel: 'rookie', local: true, pos: [0.45, 1.55, 1.95], look: [0, 1.62, 0], fov: 32, dur: 1.5 },
  st_follow: { rel: 'rookie', pos: [0.4, 4.4, 6.4], lookRel: 'rookie', look: [-0.2, 0.7, -4.5], fov: 54, dur: 1.6, follow: 3 },
  st_ots_sal: { rel: 'rookie', lookRel: 'sal', local: true, pos: [-0.42, 1.74, -0.95], look: [0, 1.5, 0], fov: 34, dur: 1.4 },
  st_ots_rookie: { rel: 'sal', lookRel: 'rookie', local: true, pos: [0.4, 1.62, -0.95], look: [0, 1.6, 0], fov: 34, dur: 0.01 },
  st_sal_close: { rel: 'sal', lookRel: 'sal', local: true, pos: [-0.35, 1.48, 1.55], look: [0, 1.5, 0], fov: 30, dur: 0.01 },
  st_rookie_react: { rel: 'rookie', lookRel: 'rookie', local: true, pos: [0.3, 1.64, 1.5], look: [0, 1.64, 0], fov: 28, dur: 0.01, drift: [0.01, 0, -0.04] },
}

interface Shop { z: number; side: 1 | -1; name: string; accent: string; shutter: number }
const SHOPS: Shop[] = [
  { z: 24, side: -1, name: 'HOTEL ROYALE', accent: '#c9a45c', shutter: 0 },
  { z: 14, side: -1, name: 'BARBER', accent: '#d8d0c0', shutter: 0.9 },
  { z: 1, side: -1, name: 'LIQUOR', accent: '#9fc4ff', shutter: 0 },
  { z: -12, side: -1, name: "SAL'S DELI", accent: '#f0c070', shutter: 0 },
  { z: -24, side: -1, name: 'CHECKS CASHED', accent: '#d9d36a', shutter: 0.6 },
  { z: 20, side: 1, name: 'LOUNGE', accent: '#ff6b6b', shutter: 0 },
  { z: 10, side: 1, name: 'PAWN', accent: '#c9a45c', shutter: 0.4 },
  { z: -6, side: 1, name: "BENNY'S HARDWARE", accent: '#e2ddd0', shutter: 0 },
  { z: -18, side: 1, name: 'LAUNDROMAT', accent: '#8fd8ff', shutter: 1 },
]

function Buildings() {
  const blocks = useMemo(() => {
    const r = rng(7)
    const bases = ['#3b2a24', '#2e2826', '#433128', '#2a2a2c', '#3a302a', '#24282b']
    const out: { z: number; side: 1 | -1; w: number; h: number; seed: number; base: string }[] = []
    for (const side of [1, -1] as const) {
      let z = 40
      let seed = side === 1 ? 10 : 30
      while (z > -42) {
        const w = 8 + Math.floor(r() * 4)
        out.push({ z: z - w / 2, side, w, h: 9 + r() * 9, seed: seed++, base: bases[seed % bases.length] })
        z -= w
      }
    }
    return out
  }, [])
  return (
    <group>
      {blocks.map((b) => {
        const tex = facadeTexture('street', { base: b.base, windowCols: 4, floors: 5, lit: 0.32, trim: '#1c1715', seed: b.seed })
        return (
          <mesh key={`${b.side}${b.seed}`} position={[b.side * (8 + 3), b.h / 2 + 3.4, b.z]}>
            <boxGeometry args={[6, b.h, b.w - 0.1]} />
            <meshStandardMaterial map={tex} roughness={0.9} />
          </mesh>
        )
      })}
      {/* ground floor band (storefront level) */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 11, 1.7, 0]}>
          <boxGeometry args={[6, 3.4, 84]} />
          <meshStandardMaterial color="#1a1716" roughness={0.9} />
        </mesh>
      ))}
      {/* the far end: a building closing the street with the gang banner */}
      <mesh position={[0, 10, -44]}>
        <boxGeometry args={[30, 20, 4]} />
        <meshStandardMaterial map={facadeTexture('street', { base: '#2b2522', windowCols: 6, floors: 6, lit: 0.25, seed: 99 })} roughness={0.9} />
      </mesh>
      <mesh position={[0, 9, -41.9]}>
        <planeGeometry args={[6, 6]} />
        <meshStandardMaterial map={emblemTexture()} transparent roughness={0.8} />
      </mesh>
    </group>
  )
}

function Shopfronts() {
  return (
    <group>
      {SHOPS.map((s) => (
        <group key={s.name} position={[s.side * 7.99, 0, s.z]} rotation={[0, s.side === 1 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <mesh position={[0, 1.75, 0]}>
            <planeGeometry args={[7, 3.5]} />
            <meshStandardMaterial
              map={storefrontTexture('street', s.name, s.accent, s.shutter, s.name.length * 13)}
              emissive="#ffffff"
              emissiveMap={storefrontTexture('street', s.name, s.accent, s.shutter, s.name.length * 13)}
              emissiveIntensity={0.35}
              roughness={0.6}
            />
          </mesh>
          {/* awning */}
          <mesh position={[0, 3.35, 0.7]} rotation={[0.35, 0, 0]}>
            <boxGeometry args={[6.6, 0.05, 1.5]} />
            <meshStandardMaterial color={s.side === 1 ? '#3a1414' : '#14262a'} roughness={0.7} />
          </mesh>
          <Glow position={[0, 0.03, 2.4]} color="#ffb060" scale={[6, 3.6]} opacity={0.22} ground />
        </group>
      ))}
    </group>
  )
}

function Graffiti() {
  const tags: { pos: [number, number, number]; side: 1 | -1; v: number; s: number }[] = [
    { pos: [7.97, 2.3, 7.0], side: 1, v: 0, s: 5.2 },
    { pos: [-7.97, 2.0, -5.4], side: -1, v: 1, s: 4.4 },
    { pos: [7.97, 2.2, -20.6], side: 1, v: 2, s: 4.2 },
    { pos: [-7.97, 2.2, 19.6], side: -1, v: 2, s: 3.4 },
  ]
  return (
    <group>
      {tags.map((t, i) => (
        <mesh key={i} position={t.pos} rotation={[0, t.side === 1 ? -Math.PI / 2 : Math.PI / 2, 0]}>
          <planeGeometry args={[t.s, t.s / 2]} />
          <meshStandardMaterial map={graffitiTexture(t.v)} transparent roughness={0.7} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      ))}
    </group>
  )
}

function Lamps() {
  const lamps: [number, number][] = [[4.9, 18], [-4.9, 6], [4.9, -6], [-4.9, -18], [4.9, -30]]
  return (
    <group>
      {lamps.map(([x, z]) => (
        <group key={`${x}${z}`} position={[x, 0, z]}>
          <mesh position={[0, 3, 0]}>
            <cylinderGeometry args={[0.06, 0.1, 6, 8]} />
            <meshStandardMaterial color="#1b1c1e" metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[-Math.sign(x) * 0.7, 6, 0]}>
            <boxGeometry args={[1.4, 0.08, 0.1]} />
            <meshStandardMaterial color="#1b1c1e" />
          </mesh>
          <mesh position={[-Math.sign(x) * 1.3, 5.9, 0]}>
            <boxGeometry args={[0.45, 0.12, 0.25]} />
            <meshBasicMaterial color="#ffc27a" toneMapped={false} />
          </mesh>
          <Halo position={[-Math.sign(x) * 1.3, 5.75, 0]} color="#ffae4a" size={2.4} opacity={0.7} />
          <Glow position={[-Math.sign(x) * 1.3, 0.04, 0]} color="#ff9a3a" scale={7} opacity={0.38} ground />
        </group>
      ))}
    </group>
  )
}

function Clutter() {
  return (
    <group>
      {/* dumpster + trash bags by the alley */}
      <mesh position={[6.6, 0.65, -27]}>
        <boxGeometry args={[1.6, 1.3, 2.4]} />
        <meshStandardMaterial color="#1f3a2a" roughness={0.6} metalness={0.4} />
      </mesh>
      {[[6.4, -24.6], [6.9, -24.2], [-6.8, 8.6], [-6.4, 9.1]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.3, z]} scale={[1, 0.8, 1]}>
          <sphereGeometry args={[0.42, 10, 8]} />
          <meshStandardMaterial color="#0b0b0b" roughness={0.25} />
        </mesh>
      ))}
      {/* overhead wires */}
      {[-30, -8, 16].map((z) => (
        <mesh key={z} position={[0, 8.5, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.015, 0.015, 18, 4]} />
          <meshBasicMaterial color="#050505" />
        </mesh>
      ))}
      {/* curbs */}
      {[1, -1].map((s) => (
        <mesh key={s} position={[s * 6.25, 0.08, 0]}>
          <boxGeometry args={[3.5, 0.16, 84]} />
          <meshStandardMaterial color="#3a3836" roughness={0.75} />
        </mesh>
      ))}
    </group>
  )
}

export default function Street({ quality }: EnvProps) {
  useEnvLifecycle('street')
  const ground = useMemo(() => groundTextures('street', '#1c1c1e', 21, [3, 7]), [])
  const bikes: { p: [number, number, number]; r: number; c: string }[] = [
    { p: [-3.3, 0, -21.2], r: 1.25, c: '#151515' },
    { p: [-1.0, 0, -21.6], r: 1.45, c: '#4a0d0c' },
    { p: [1.3, 0, -21.0], r: 1.75, c: '#151515' },
    { p: [3.5, 0, -21.5], r: 1.5, c: '#2a2a2a' },
    { p: [4.3, 0, -1.4], r: 0.15, c: '#4a0d0c' },
    { p: [-4.0, 0, 2.6], r: 2.9, c: '#151515' },
  ]

  return (
    <>
      <color attach="background" args={['#06070b']} />
      <fogExp2 attach="fog" args={['#15141b', 0.026]} />
      <Sky top="#04060b" horizon="#1b1a22" bottom="#07070a" glow="#4a2414" glowDir={[0, 0.05, -1]} />
      <Environment resolution={64} frames={1}>
        <Lightformer form="rect" intensity={2.2} color="#ffb070" position={[0, 4, -20]} scale={[30, 6, 1]} />
        <Lightformer form="rect" intensity={1.5} color="#ff4a4a" position={[8, 4, 18]} rotation-y={-Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={1.4} color="#7fb0ff" position={[-8, 4, 0]} rotation-y={Math.PI / 2} scale={[8, 3, 1]} />
        <Lightformer form="rect" intensity={0.4} color="#6a78a0" position={[0, 20, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} />
      </Environment>

      <hemisphereLight args={['#3c4866', '#120e0b', 0.5]} />
      <directionalLight position={[10, 30, -30]} color="#7b8fc4" intensity={0.55} />
      <pointLight position={[-5.6, 3.2, -12]} color="#ffb060" intensity={22} distance={10} decay={1.6} />
      <pointLight position={[3.6, 5.6, -6]} color="#ffae4a" intensity={26} distance={14} decay={1.7} />
      <pointLight position={[-3.6, 5.6, 6]} color="#ffae4a" intensity={22} distance={14} decay={1.7} />
      <pointLight position={[6.5, 4.5, 19.5]} color="#ff3b3b" intensity={10} distance={9} decay={1.8} />
      <pointLight position={[0, 4, -20]} color="#ff9a5a" intensity={12} distance={12} decay={1.7} />

      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[40, 90]} />
        <meshStandardMaterial map={ground.map} roughnessMap={ground.rough} roughness={0.95} metalness={0.2} envMapIntensity={1.0} />
      </mesh>

      <Buildings />
      <Shopfronts />
      <Graffiti />
      <Lamps />
      <Clutter />

      <Neon text="LOUNGE" color="#ff3b3b" position={[7.5, 5.6, 19.5]} rotation={[0, -Math.PI / 2, 0]} height={2.8} vertical flicker={0.4} />
      <Neon text="HOTEL" color="#ffb347" position={[-7.4, 7.0, 24]} rotation={[0, Math.PI / 2, 0]} height={3} vertical />
      <Neon text="LIQUOR" color="#7fb0ff" position={[-7.7, 3.9, 1]} rotation={[0, Math.PI / 2, 0]} height={0.85} />
      <Neon text="DELI" color="#ffcf7a" position={[-7.7, 4.0, -12]} rotation={[0, Math.PI / 2, 0]} height={0.85} flicker={0.2} />
      <Neon text="PAWN" color="#e6c068" position={[7.7, 4.0, 10]} rotation={[0, -Math.PI / 2, 0]} height={0.9} />
      <Neon text="OPEN" color="#ff4a3a" position={[-7.9, 1.6, -13.6]} rotation={[0, Math.PI / 2, 0]} height={0.35} flicker={0.8} />
      <Glow position={[5.5, 0.04, 19.5]} color="#ff3b3b" scale={[3, 9]} opacity={0.35} ground />
      <Glow position={[-5.8, 0.04, 1]} color="#7fb0ff" scale={[2.8, 6]} opacity={0.3} ground />
      <Glow position={[-5.8, 0.04, -12]} color="#ffcf7a" scale={[2.8, 6]} opacity={0.32} ground />

      {bikes.map((b, i) => (
        <Motorcycle key={i} position={b.p} rotation={[0, b.r, 0]} paint={b.c} lights={i < 4} />
      ))}
      <Halo position={[0, 1.0, -20.4]} color="#ffe2b0" size={2.2} opacity={0.4} />

      <Actor id="rookie" spec={ROOKIE} />
      <Actor id="sal" spec={SHOPKEEPER_SAL} />
      <Actor id="shop2" spec={SHOPKEEPER_2} />
      <Actor id="shop3" spec={SHOPKEEPER_3} />
      <Actor id="biker1" spec={BIKERS[0]} />
      <Actor id="biker2" spec={BIKERS[1]} />
      <Actor id="biker3" spec={BIKERS[2]} />
      <Actor id="biker4" spec={BIKERS[3]} />

      <ExploreLayer bounds={{ minX: -5.6, maxX: 5.6, minZ: -18, maxZ: 27 }} />
      <Rain count={quality.rainDrops} />
      <CameraDirector shots={SHOTS} />
    </>
  )
}
