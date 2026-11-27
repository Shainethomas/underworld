import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo } from 'react'
import * as THREE from 'three'

// GPU rain: one LineSegments draw call. Drops are animated and wrapped around
// the camera entirely in the vertex shader, so CPU cost is a uniform update.

const vert = /* glsl */ `
  uniform float uTime;
  uniform vec3 uCam;
  uniform vec3 uArea;
  uniform float uLen;
  uniform float uSpeed;
  uniform float uWind;
  attribute vec3 aOffset;
  attribute float aEnd;
  attribute float aSpeed;
  varying float vA;
  void main() {
    vec3 base = vec3(uCam.x - uArea.x * 0.5, max(0.0, uCam.y - uArea.y * 0.5), uCam.z - uArea.z * 0.5);
    vec3 p;
    p.x = base.x + mod(aOffset.x - base.x, uArea.x);
    p.z = base.z + mod(aOffset.z - base.z, uArea.z);
    p.y = base.y + mod(aOffset.y - uTime * uSpeed * aSpeed, uArea.y);
    p.y += aEnd * uLen;
    p.x += aEnd * uWind;
    vA = 1.0 - aEnd;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vA *= smoothstep(60.0, 4.0, -mv.z) * smoothstep(0.3, 2.0, -mv.z);
    gl_Position = projectionMatrix * mv;
  }
`
const frag = /* glsl */ `
  uniform vec3 uColor;
  uniform float uOpacity;
  varying float vA;
  void main() { gl_FragColor = vec4(uColor, vA * uOpacity); }
`

export function Rain({ count, area = [36, 22, 36], color = '#a9bccf', opacity = 0.45, speed = 20, len = 0.55, wind = -0.06 }: {
  count: number
  area?: [number, number, number]
  color?: string
  opacity?: number
  speed?: number
  len?: number
  wind?: number
}) {
  const { geo, mat } = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const off = new Float32Array(count * 6)
    const end = new Float32Array(count * 2)
    const spd = new Float32Array(count * 2)
    for (let i = 0; i < count; i++) {
      const x = Math.random() * 1000
      const y = Math.random() * area[1]
      const z = Math.random() * 1000
      const s = 0.8 + Math.random() * 0.45
      for (let k = 0; k < 2; k++) {
        off.set([x, y, z], i * 6 + k * 3)
        end[i * 2 + k] = k
        spd[i * 2 + k] = s
      }
    }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 6), 3))
    g.setAttribute('aOffset', new THREE.BufferAttribute(off, 3))
    g.setAttribute('aEnd', new THREE.BufferAttribute(end, 1))
    g.setAttribute('aSpeed', new THREE.BufferAttribute(spd, 1))
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e6)
    const m = new THREE.ShaderMaterial({
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uCam: { value: new THREE.Vector3() },
        uArea: { value: new THREE.Vector3(...area) },
        uLen: { value: len },
        uSpeed: { value: speed },
        uWind: { value: wind },
        uColor: { value: new THREE.Color(color) },
        uOpacity: { value: opacity },
      },
    })
    return { geo: g, mat: m }
  }, [count, area, color, opacity, speed, len, wind])

  useEffect(() => () => {
    geo.dispose()
    mat.dispose()
  }, [geo, mat])

  useFrame(({ camera }, dt) => {
    mat.uniforms.uTime.value += Math.min(dt, 0.05)
    mat.uniforms.uCam.value.copy(camera.position)
  })

  return <lineSegments geometry={geo} material={mat} frustumCulled={false} renderOrder={10} />
}
