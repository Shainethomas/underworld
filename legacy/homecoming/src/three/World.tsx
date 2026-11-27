import { PerformanceMonitor } from '@react-three/drei'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import { lazy, Suspense, useState } from 'react'
import * as THREE from 'three'
import { detectQuality, resolveQuality, type QualityPreset } from '../engine/quality'
import { currentScene, useGame } from '../game/store'
import type { EnvironmentId } from '../narrative/types'
import type { EnvProps } from './environments/types'

// Environments are code-split: each scene downloads/builds only its own world,
// and the previous one is unmounted (textures released) when it changes.
const ENVIRONMENTS: Record<EnvironmentId, React.LazyExoticComponent<(p: EnvProps) => React.JSX.Element>> = {
  highway: lazy(() => import('./environments/Highway')),
  street: lazy(() => import('./environments/Street')),
  dockyard: lazy(() => import('./environments/Dockyard')),
}

const ORDER: QualityPreset['level'][] = ['low', 'medium', 'high']

export function World() {
  const env = useGame((s) => currentScene(s).environment)
  const qualitySetting = useGame((s) => s.settings.quality)
  const [autoLevel, setAutoLevel] = useState(detectQuality)
  const preset = resolveQuality(qualitySetting, autoLevel)
  const Env = ENVIRONMENTS[env]

  const step = (dir: -1 | 1) =>
    setAutoLevel((l) => ORDER[Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(l) + dir))])

  return (
    <Canvas
      className="world"
      dpr={preset.dpr}
      gl={{ antialias: preset.antialias, powerPreference: 'high-performance', stencil: false }}
      camera={{ fov: 45, near: 0.05, far: 1000, position: [0, 2, 10] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.15
      }}
    >
      {qualitySetting === 'auto' && <PerformanceMonitor onDecline={() => step(-1)} onIncline={() => step(1)} flipflops={3} />}
      <Suspense fallback={null}>
        <Env key={env} quality={preset} />
      </Suspense>
      {preset.bloom && (
        <EffectComposer multisampling={0} enableNormalPass={false}>
          <Bloom mipmapBlur intensity={0.85} luminanceThreshold={0.62} luminanceSmoothing={0.2} radius={0.7} />
          <Vignette eskil={false} offset={0.22} darkness={0.72} />
        </EffectComposer>
      )}
    </Canvas>
  )
}
