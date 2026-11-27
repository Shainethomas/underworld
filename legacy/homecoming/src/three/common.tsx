import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { glowTexture, neonTexture, releaseTextures } from '../engine/textures'
import { useGame } from '../game/store'
import type { EnvironmentId, FxName } from '../narrative/types'

// Building blocks shared by every environment.

/** Report readiness to the scene manager; release this env's textures on unload. */
export function useEnvLifecycle(env: EnvironmentId) {
  useEffect(() => {
    useGame.getState().setEnvReady(env)
    return () => {
      if (useGame.getState().envReady === env) useGame.getState().setEnvReady(null)
      releaseTextures(`${env}:`)
    }
  }, [env])
}

/** Subscribe to stage FX cues (after their choreographed delay). */
export function useFx(handler: (name: FxName) => void) {
  const seen = useRef(new Set<number>())
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    // ignore cues that were already on stage when this env mounted
    for (const f of useGame.getState().stage.fx) seen.current.add(f.id)
    return useGame.subscribe((s) => {
      for (const f of s.stage.fx) {
        if (seen.current.has(f.id)) continue
        seen.current.add(f.id)
        setTimeout(() => ref.current(f.name), f.delay * 1000)
      }
    })
  }, [])
}

/** Vertical-gradient sky dome with an optional horizon glow. */
export function Sky({ top, horizon, bottom, glow = '#000000', glowDir = [0, 0.05, -1] }: {
  top: string
  horizon: string
  bottom: string
  glow?: string
  glowDir?: [number, number, number]
}) {
  const mat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        fog: false,
        uniforms: {
          uTop: { value: new THREE.Color(top) },
          uHor: { value: new THREE.Color(horizon) },
          uBot: { value: new THREE.Color(bottom) },
          uGlow: { value: new THREE.Color(glow) },
          uDir: { value: new THREE.Vector3(...glowDir).normalize() },
        },
        vertexShader: `varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
        fragmentShader: `uniform vec3 uTop; uniform vec3 uHor; uniform vec3 uBot; uniform vec3 uGlow; uniform vec3 uDir; varying vec3 vDir;
          void main(){
            float h = vDir.y;
            vec3 c = h > 0.0 ? mix(uHor, uTop, pow(smoothstep(0.0, 0.55, h), 0.7)) : mix(uHor, uBot, smoothstep(0.0, 0.25, -h));
            float g = max(dot(vDir, uDir), 0.0);
            c += uGlow * (pow(g, 12.0) * 0.55 + pow(g, 60.0) * 0.35) * (1.0 - smoothstep(0.0, 0.35, h));
            gl_FragColor = vec4(c, 1.0);
            #include <colorspace_fragment>
          }`,
      }),
    [top, horizon, bottom, glow, glowDir],
  )
  useEffect(() => () => mat.dispose(), [mat])
  return (
    <mesh material={mat} renderOrder={-10} frustumCulled={false}>
      <sphereGeometry args={[800, 32, 16]} />
    </mesh>
  )
}

/** Additive glow sprite / ground light pool — fakes light without a light. */
export function Glow({ position, color, scale = 1, opacity = 0.8, ground = false, flicker = 0 }: {
  position: [number, number, number]
  color: string
  scale?: number | [number, number]
  opacity?: number
  ground?: boolean
  flicker?: number
}) {
  const ref = useRef<THREE.Mesh>(null)
  const seed = useMemo(() => Math.random() * 100, [])
  useFrame(({ clock }) => {
    if (!flicker || !ref.current) return
    const t = clock.elapsedTime + seed
    const m = ref.current.material as THREE.MeshBasicMaterial
    m.opacity = opacity * (1 - flicker * (0.5 + 0.5 * Math.sin(t * 13) * Math.sin(t * 7.3)))
  })
  const s: [number, number, number] = typeof scale === 'number' ? [scale, scale, 1] : [scale[0], scale[1], 1]
  return (
    <mesh ref={ref} position={position} rotation={ground ? [-Math.PI / 2, 0, 0] : [0, 0, 0]} scale={s} renderOrder={ground ? 1 : 5}>
      <planeGeometry />
      <meshBasicMaterial map={glowTexture()} color={color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Camera-facing glow (for lamp heads, headlights, distant lights). */
export function Halo(props: { position: [number, number, number]; color: string; size?: number; opacity?: number }) {
  const { size = 1, opacity = 0.9 } = props
  return (
    <sprite position={props.position} scale={[size, size, 1]}>
      <spriteMaterial map={glowTexture()} color={props.color} transparent opacity={opacity} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </sprite>
  )
}

/** Emissive neon sign with optional flicker. */
export function Neon({ text, color, position, rotation = [0, 0, 0], height = 0.8, vertical = false, flicker = 0, intensity = 2.2 }: {
  text: string
  color: string
  position: [number, number, number]
  rotation?: [number, number, number]
  height?: number
  vertical?: boolean
  flicker?: number
  intensity?: number
}) {
  const ref = useRef<THREE.MeshBasicMaterial>(null)
  const tex = neonTexture(text, color, vertical)
  const aspect = vertical ? 128 / 512 : 512 / 160
  const seed = useMemo(() => Math.random() * 50, [])
  useFrame(({ clock }) => {
    if (!flicker || !ref.current) return
    const t = clock.elapsedTime + seed
    const off = Math.sin(t * 3.1) > 0.94 - flicker * 0.2 && Math.sin(t * 37) > 0
    ref.current.color.setScalar(off ? 0.25 : intensity)
  })
  return (
    <group position={position} rotation={rotation}>
      <mesh scale={vertical ? [height * aspect, height, 1] : [height * aspect, height, 1]}>
        <planeGeometry />
        <meshBasicMaterial ref={ref} map={tex} color={new THREE.Color(intensity, intensity, intensity)} transparent depthWrite={false} toneMapped={false} />
      </mesh>
      <Glow position={[0, 0, 0.05]} color={color} scale={vertical ? [height * 0.9, height * 1.4] : [height * aspect * 1.3, height * 2.2]} opacity={0.35} />
    </group>
  )
}
