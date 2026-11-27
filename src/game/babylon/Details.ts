import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import type { Material } from '@babylonjs/core/Materials/material'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { SetBuilder } from './SetBuilder'
import { rand } from './ProceduralTextures'

/** Batched needle clusters: irregular silhouettes with no per-leaf draw calls. */
export function conifer(s: SetBuilder, name: string, x: number, z: number, h: number, foliage: Material, bark: Material): void {
  s.cyl(`${name}_trunk`, 0.2, h * 0.85, [x, h * 0.425, z], bark, { top: 0.06, tess: 10 })
  const positions: number[] = [], normals: number[] = [], uvs: number[] = [], indices: number[] = []
  for (let layer = 0; layer < 9; layer++) {
    const t = layer / 9
    const y = 0.65 + t * (h - 1.1)
    const radius = (1 - t) * 0.65 + 0.1
    for (let branch = 0; branch < 10; branch++) {
      const angle = branch * Math.PI / 5 + layer * 1.7 + rand() * 0.5
      const cx = Math.sin(angle) * radius * (0.5 + rand() * 0.5)
      const cz = Math.cos(angle) * radius * (0.5 + rand() * 0.5)
      for (let crossed = 0; crossed < 2; crossed++) {
        const a = angle + crossed * Math.PI / 2
        const w = (0.7 + rand() * 0.35) * (1 - t * 0.6)
        const height = (1.4 + rand() * 0.45) * (1 - t * 0.3)
        const right = new Vector3(Math.cos(a) * w / 2, 0, -Math.sin(a) * w / 2)
        const up = new Vector3(Math.sin(angle) * 0.16, height, Math.cos(angle) * 0.16)
        const origin = new Vector3(cx, y, cz)
        const base = positions.length / 3
        for (const v of [origin.subtract(right), origin.add(right), origin.add(right).add(up), origin.subtract(right).add(up)]) positions.push(v.x, v.y, v.z)
        for (let i = 0; i < 4; i++) normals.push(Math.sin(a), 0.2, Math.cos(a))
        uvs.push(0, 0, 1, 0, 1, 1, 0, 1)
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3)
      }
    }
  }
  const data = new VertexData()
  data.positions = positions; data.normals = normals; data.uvs = uvs; data.indices = indices
  const mesh = new Mesh(name, s.scene)
  data.applyToMesh(mesh)
  mesh.position.set(x, 0, z)
  mesh.parent = s.root
  mesh.material = foliage
  mesh.receiveShadows = true
  mesh.isPickable = false
  s.meshes.push(mesh)
}
