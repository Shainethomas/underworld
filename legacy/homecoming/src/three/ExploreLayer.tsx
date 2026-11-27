import { Html } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { audio } from '../engine/audio'
import { currentBeat, useGame } from '../game/store'
import { actors } from './runtime'

interface Bounds { minX: number; maxX: number; minZ: number; maxZ: number }

/**
 * Interactive exploration: tap the ground to walk, tap a marker to walk to a
 * point of interest. Only live while the active beat is an `explore` beat.
 */
export function ExploreLayer({ bounds }: { bounds: Bounds }) {
  const beat = useGame(currentBeat)
  const aside = useGame((s) => s.aside)
  const visited = useGame((s) => s.explore.visited)
  const target = useGame((s) => s.explore.target)
  const ring = useRef<THREE.Mesh>(null)
  const ringT = useRef(1)
  const active = beat?.type === 'explore' && !aside

  useFrame((_, dt) => {
    // arrival detection for hotspot walks
    const s = useGame.getState()
    if (s.explore.target && beat?.type === 'explore') {
      const h = beat.hotspots.find((x) => x.id === s.explore.target)
      const r = actors.get('rookie')
      if (h && r) {
        const [x, z] = h.stand ?? h.pos
        if (Math.hypot(r.root.position.x - x, r.root.position.z - z) < 0.06) s.arriveHotspot(h.id)
      }
    }
    if (ring.current) {
      ringT.current = Math.min(1, ringT.current + dt * 1.4)
      ring.current.scale.setScalar(0.3 + ringT.current * 0.9)
      ;(ring.current.material as THREE.MeshBasicMaterial).opacity = 1 - ringT.current
    }
  })

  const onGround = (e: ThreeEvent<PointerEvent>) => {
    if (!active) return
    e.stopPropagation()
    const x = THREE.MathUtils.clamp(e.point.x, bounds.minX, bounds.maxX)
    const z = THREE.MathUtils.clamp(e.point.z, bounds.minZ, bounds.maxZ)
    useGame.getState().walkTo([x, z])
    ring.current?.position.set(x, 0.03, z)
    ringT.current = 0
    audio.play('tick')
  }

  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]} onPointerDown={onGround} visible={false}>
        <planeGeometry args={[200, 200]} />
      </mesh>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, -5, 0]}>
        <ringGeometry args={[0.32, 0.4, 32]} />
        <meshBasicMaterial color="#d9b26a" transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {active &&
        beat.hotspots.map((h) => {
          const seen = visited.includes(h.id)
          return (
            <Html key={h.id} position={[h.pos[0], h.ends ? 3.1 : 2.3, h.pos[1]]} center zIndexRange={[20, 10]}>
              <button
                className={`hotspot ${h.ends ? 'hotspot--main' : ''} ${seen ? 'hotspot--seen' : ''} ${target === h.id ? 'hotspot--target' : ''}`}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  audio.play('tick')
                  useGame.getState().walkToHotspot(h.id)
                }}
              >
                <span className="hotspot__ring">
                  <span className={`hotspot__icon hotspot__icon--${h.icon ?? 'eye'}`} />
                </span>
                <span className="hotspot__label">{h.label}</span>
              </button>
            </Html>
          )
        })}
    </group>
  )
}
