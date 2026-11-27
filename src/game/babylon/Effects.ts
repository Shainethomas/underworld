import { Color4 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem'
import '@babylonjs/core/Particles/particleSystemComponent'
import { BoxParticleEmitter } from '@babylonjs/core/Particles/EmitterTypes/boxParticleEmitter'
import type { Scene } from '@babylonjs/core/scene'
import type { Quality } from './Renderer'
import { radialSprite, streakSprite } from './ProceduralTextures'

const box = (min: Vector3, max: Vector3) => {
  const e = new BoxParticleEmitter()
  e.minEmitBox = min
  e.maxEmitBox = max
  return e
}

/** Falling rain in a box that follows `anchor` (normally the camera). */
export function rain(scene: Scene, quality: Quality, anchor: () => Vector3): ParticleSystem {
  const ps = new ParticleSystem('rain', quality === 'high' ? 5000 : 2200, scene)
  ps.particleTexture = streakSprite(scene)
  ps.particleEmitterType = box(new Vector3(-14, 9, -6), new Vector3(14, 12, 26))
  ps.emitter = anchor().clone()
  ps.minSize = 0.03
  ps.maxSize = 0.05
  ps.minScaleY = 9
  ps.maxScaleY = 14
  ps.minLifeTime = 0.9
  ps.maxLifeTime = 1.1
  ps.emitRate = quality === 'high' ? 4200 : 1800
  ps.direction1 = new Vector3(-0.6, -14, 0.2)
  ps.direction2 = new Vector3(-0.4, -16, 0.4)
  ps.minEmitPower = 1
  ps.maxEmitPower = 1
  ps.color1 = new Color4(0.75, 0.82, 1, 0.42)
  ps.color2 = new Color4(0.65, 0.72, 0.9, 0.28)
  ps.colorDead = new Color4(0.6, 0.7, 0.9, 0)
  ps.billboardMode = ParticleSystem.BILLBOARDMODE_STRETCHED
  ps.blendMode = ParticleSystem.BLENDMODE_ADD
  ps.updateSpeed = 0.016
  const obs = scene.onBeforeRenderObservable.add(() => {
    const a = anchor()
    ;(ps.emitter as Vector3).set(a.x, 0, a.z)
  })
  ps.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(obs))
  ps.preWarmCycles = 60
  ps.start()
  return ps
}

/** Tiny bright splashes popping on the ground near the camera. */
export function splashes(scene: Scene, quality: Quality, anchor: () => Vector3, groundY = 0.02): ParticleSystem {
  const ps = new ParticleSystem('splashes', quality === 'high' ? 900 : 350, scene)
  ps.particleTexture = radialSprite(scene, 'tex_splash', 32, '220,230,255', 0.6)
  ps.particleEmitterType = box(new Vector3(-7, groundY, -1), new Vector3(7, groundY, 14))
  ps.emitter = anchor().clone()
  ps.minSize = 0.03
  ps.maxSize = 0.09
  ps.minLifeTime = 0.08
  ps.maxLifeTime = 0.18
  ps.emitRate = quality === 'high' ? 1600 : 600
  ps.direction1 = new Vector3(-0.3, 0.6, -0.3)
  ps.direction2 = new Vector3(0.3, 1.2, 0.3)
  ps.minEmitPower = 0.4
  ps.maxEmitPower = 0.9
  ps.color1 = new Color4(0.8, 0.86, 1, 0.5)
  ps.color2 = new Color4(0.7, 0.78, 1, 0.3)
  ps.colorDead = new Color4(0.7, 0.8, 1, 0)
  ps.blendMode = ParticleSystem.BLENDMODE_ADD
  const obs = scene.onBeforeRenderObservable.add(() => {
    const a = anchor()
    ;(ps.emitter as Vector3).set(a.x, 0, a.z)
  })
  ps.onDisposeObservable.addOnce(() => scene.onBeforeRenderObservable.remove(obs))
  ps.start()
  return ps
}

/** Slow dust motes hanging in a lit volume. */
export function dust(scene: Scene, quality: Quality, min: Vector3, max: Vector3, warm = true): ParticleSystem {
  const ps = new ParticleSystem('dust', quality === 'high' ? 700 : 260, scene)
  ps.particleTexture = radialSprite(scene, 'tex_dust', 32, warm ? '255,226,180' : '200,215,255', 0.5)
  ps.particleEmitterType = box(min, max)
  ps.emitter = Vector3.Zero()
  ps.minSize = 0.008
  ps.maxSize = 0.022
  ps.minLifeTime = 8
  ps.maxLifeTime = 14
  ps.emitRate = quality === 'high' ? 60 : 24
  ps.direction1 = new Vector3(-0.04, -0.02, -0.04)
  ps.direction2 = new Vector3(0.04, 0.03, 0.04)
  ps.minEmitPower = 0.5
  ps.maxEmitPower = 1
  ps.color1 = new Color4(1, 0.9, 0.75, 0.55)
  ps.color2 = new Color4(1, 0.95, 0.85, 0.25)
  ps.colorDead = new Color4(1, 1, 1, 0)
  ps.blendMode = ParticleSystem.BLENDMODE_ADD
  ps.preWarmCycles = 400
  ps.preWarmStepOffset = 10
  ps.start()
  return ps
}
