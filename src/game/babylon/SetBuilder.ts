import type { BaseTexture } from '@babylonjs/core/Materials/Textures/baseTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import type { AssetContainer } from '@babylonjs/core/assetContainer'
import { envModelUrl, surfaceUrl, type Surface } from '../assets/urls'
import { loadContainer } from './AssetLoader'
import type { Material } from '@babylonjs/core/Materials/material'
import { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder'
import { CreatePlane } from '@babylonjs/core/Meshes/Builders/planeBuilder'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder'
import { CreateLathe } from '@babylonjs/core/Meshes/Builders/latheBuilder'
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import '@babylonjs/core/Meshes/instancedMesh'
import type { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator'
import type { RenderTargetTexture } from '@babylonjs/core/Materials/Textures/renderTargetTexture'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { Scene } from '@babylonjs/core/scene'

type V3 = [number, number, number]

interface PbrOpts {
  rough?: number
  metal?: number
  albedo?: BaseTexture
  bump?: Texture
  bumpLevel?: number
  emissive?: Color3
  emissiveTex?: BaseTexture
  clearCoat?: number
  uv?: [number, number]
}

/**
 * Small façade over MeshBuilder for hand-built sets. Every mesh hangs off one
 * root node and every material/texture is tracked, so an environment
 * disposes cleanly when the story moves on.
 */
export class SetBuilder {
  readonly root: TransformNode
  readonly meshes: AbstractMesh[] = []
  readonly materials: Material[] = []
  private owned: { dispose(): void }[] = []
  private matCache = new Map<string, Material>()
  private models = new Map<string, AssetContainer>()

  constructor(readonly scene: Scene, name: string) {
    this.root = new TransformNode(name, scene)
  }

  track<T extends { dispose(): void }>(x: T): T {
    this.owned.push(x)
    return x
  }

  /** Local scanned maps: RGB = ambient occlusion / roughness / metalness. */
  surface(name: string, source: Surface, uv: [number, number], tint = '#ffffff', rough = 1): PBRMaterial {
    const map = (kind: 'albedo' | 'normal' | 'arm', linear = false) => {
      const t = this.track(new Texture(surfaceUrl(source, kind), this.scene))
      t.uScale = uv[0]
      t.vScale = uv[1]
      t.gammaSpace = !linear
      t.anisotropicFilteringLevel = 8
      return t
    }
    const m = this.pbr(name, tint, { albedo: map('albedo'), bump: map('normal', true), bumpLevel: 0.65, rough })
    m.metallicTexture = map('arm', true)
    m.useRoughnessFromMetallicTextureAlpha = false
    m.useRoughnessFromMetallicTextureGreen = true
    m.useMetallnessFromMetallicTextureBlue = true
    m.useAmbientOcclusionFromMetallicTextureRed = true
    m.ambientTextureStrength = 0.7
    return m
  }

  /**
   * A set piece from public/assets/models/environment. The source model is
   * resident and shared between sets (see AssetLoader); each set gets its own
   * copies of its materials, so one set relighting the car's lamps doesn't
   * change another's, and the copies dispose with the set.
   */
  async model(file: string, name: string, pos: V3, yaw = 0, scale: V3 = [1, 1, 1], parent?: TransformNode): Promise<TransformNode> {
    let asset = this.models.get(file)
    if (!asset) {
      asset = await loadContainer(envModelUrl(file), this.scene)
      this.models.set(file, asset)
    }
    // built at the origin, merged, then placed: merging bakes transforms relative to `root`
    const root = this.node(name, [0, 0, 0])
    root.parent = null
    const instance = asset.instantiateModelsToScene(n => `${name}_${n}`, true, { doNotInstantiate: true })
    for (const n of instance.rootNodes) n.parent = root
    mergeByMaterial(root, name)
    root.parent = parent ?? this.root
    root.position.set(...pos)
    root.rotation.y = yaw
    root.scaling.set(...scale)
    for (const m of root.getChildMeshes()) {
      m.receiveShadows = true
      this.meshes.push(m)
      const mat = m.material
      if (mat && !this.materials.includes(mat)) {
        this.materials.push(mat)
        // the copy's textures are copies too (sharing the source's GPU texture by reference count)
        this.track({ dispose: () => mat.dispose(false, true) })
      }
    }
    return root
  }

  pbr(name: string, color: string | Color3, o: PbrOpts = {}): PBRMaterial {
    const cached = this.matCache.get(name)
    if (cached) return cached as PBRMaterial
    const m = new PBRMaterial(name, this.scene)
    // hex colours are authored in sRGB; PBR expects linear
    m.albedoColor = typeof color === 'string' ? Color3.FromHexString(color).toLinearSpace() : color
    m.roughness = o.rough ?? 0.8
    m.metallic = o.metal ?? 0
    if (o.albedo) {
      m.albedoTexture = o.albedo
      if (o.uv) {
        ;(o.albedo as Texture).uScale = o.uv[0]
        ;(o.albedo as Texture).vScale = o.uv[1]
      }
    }
    if (o.bump) {
      m.bumpTexture = o.bump
      o.bump.level = o.bumpLevel ?? 0.6
      if (o.uv) {
        o.bump.uScale = o.uv[0]
        o.bump.vScale = o.uv[1]
      }
    }
    if (o.emissive) m.emissiveColor = o.emissive
    if (o.emissiveTex) m.emissiveTexture = o.emissiveTex
    if (o.clearCoat) {
      m.clearCoat.isEnabled = true
      m.clearCoat.intensity = o.clearCoat
      m.clearCoat.roughness = 0.35
    }
    this.matCache.set(name, m)
    this.materials.push(m)
    this.track(m)
    return m
  }

  /**
   * Unlit emissive material (bulbs, windows, signs). With a texture (screens,
   * displays) the colour sets its brightness: StandardMaterial *adds* the
   * emissive colour to the texture, which would wash the picture out to white.
   */
  glow(name: string, color: string | Color3, tex?: BaseTexture): StandardMaterial {
    const cached = this.matCache.get(name)
    if (cached) return cached as StandardMaterial
    const m = new StandardMaterial(name, this.scene)
    m.disableLighting = true
    const c = typeof color === 'string' ? Color3.FromHexString(color) : color
    if (tex) {
      m.emissiveTexture = tex
      m.emissiveColor = Color3.Black()
      tex.level = Math.max(c.r, c.g, c.b)
    } else m.emissiveColor = c
    this.matCache.set(name, m)
    this.materials.push(m)
    this.track(m)
    return m
  }

  private add<T extends Mesh>(m: T, pos: V3, mat: Material, parent?: TransformNode): T {
    m.position.set(...pos)
    m.material = mat
    m.parent = parent ?? this.root
    m.receiveShadows = true
    this.meshes.push(m)
    return m
  }

  box(name: string, size: V3, pos: V3, mat: Material, parent?: TransformNode): Mesh {
    return this.add(CreateBox(name, { width: size[0], height: size[1], depth: size[2] }, this.scene), pos, mat, parent)
  }

  cyl(name: string, d: number, h: number, pos: V3, mat: Material, opts: { top?: number; tess?: number; parent?: TransformNode; cap?: boolean } = {}): Mesh {
    const m = CreateCylinder(name, { diameterTop: opts.top ?? d, diameterBottom: d, height: h, tessellation: opts.tess ?? 20, cap: opts.cap === false ? 0 : 3 }, this.scene)
    return this.add(m, pos, mat, opts.parent)
  }

  sphere(name: string, d: number, pos: V3, mat: Material, parent?: TransformNode): Mesh {
    return this.add(CreateSphere(name, { diameter: d, segments: 12 }, this.scene), pos, mat, parent)
  }

  torus(name: string, d: number, thickness: number, pos: V3, mat: Material, parent?: TransformNode): Mesh {
    return this.add(CreateTorus(name, { diameter: d, thickness, tessellation: 32 }, this.scene), pos, mat, parent)
  }

  lathe(name: string, profile: [number, number][], pos: V3, mat: Material, parent?: TransformNode): Mesh {
    return this.add(CreateLathe(name, { shape: profile.map(([r, y]) => new Vector3(r, y, 0)), tessellation: 32, cap: 3 }, this.scene), pos, mat, parent)
  }

  roof(name: string, width: number, height: number, depth: number, pos: V3, mat: Material): Mesh {
    const w = width / 2, d = depth / 2, r = Math.max(0.1, w - d)
    return this.add(CreatePolyhedron(name, { custom: {
      vertex: [[-w, 0, -d], [w, 0, -d], [w, 0, d], [-w, 0, d], [-r, height, 0], [r, height, 0]],
      face: [[3, 2, 1, 0], [0, 1, 5, 4], [1, 2, 5], [2, 3, 4, 5], [3, 0, 4]],
    }, flat: true }, this.scene), pos, mat)
  }

  plane(name: string, w: number, h: number, pos: V3, mat: Material, rotY = 0, parent?: TransformNode): Mesh {
    const m = this.add(CreatePlane(name, { width: w, height: h }, this.scene), pos, mat, parent)
    m.rotation.y = rotY
    return m
  }

  /**
   * Box-projects a mesh's UVs from its local positions, `tile` metres per
   * texture repeat, so a tiling texture (boards, wallpaper) keeps one size on
   * every face of every wall and floor instead of stretching 0–1 per face.
   */
  tileUV(m: Mesh, tile: number): Mesh {
    const pos = m.getVerticesData('position')
    const nrm = m.getVerticesData('normal')
    if (!pos || !nrm) return m
    const sx = m.scaling.x, sy = m.scaling.y, sz = m.scaling.z
    const uv = new Float32Array((pos.length / 3) * 2)
    for (let i = 0; i < pos.length / 3; i++) {
      const [x, y, z] = [pos[i * 3] * sx, pos[i * 3 + 1] * sy, pos[i * 3 + 2] * sz]
      const [ax, ay, az] = [Math.abs(nrm[i * 3]), Math.abs(nrm[i * 3 + 1]), Math.abs(nrm[i * 3 + 2])]
      const [u, v] = ax >= ay && ax >= az ? [z, y] : ay >= az ? [x, z] : [x, y]
      uv[i * 2] = u / tile
      uv[i * 2 + 1] = v / tile
    }
    m.setVerticesData('uv', uv)
    return m
  }

  /**
   * Another copy of `source` drawn in the same draw call (GPU instancing): a
   * repeated piece (a street lamp, a block's facade) on its own node, so it
   * can still move on its own, without a draw call each. It shares the
   * source's geometry and material; position, rotation and scale are its own.
   */
  instance(source: Mesh, name: string, pos: V3, parent?: TransformNode): InstancedMesh {
    const m = source.createInstance(name)
    m.position.set(...pos)
    m.parent = parent ?? this.root
    this.meshes.push(m)
    return m
  }

  /**
   * Merges the parts under `node` by material, keeping them under it: a
   * built piece that moves or shows as a whole (a building that scrolls in)
   * costs a draw call per material instead of one per part. `node` must
   * have no rotation or scaling of its own.
   */
  mergeChildren(node: TransformNode, name: string): void {
    const parent = node.parent
    const at = node.position.clone()
    node.parent = null
    node.position.setAll(0)
    node.computeWorldMatrix(true)
    const groups = new Map<Material, Mesh[]>()
    for (const m of node.getChildMeshes(false)) {
      if (!(m instanceof Mesh) || !m.material || m.hasInstances || !m.getTotalVertices() || m.billboardMode) continue
      if (m.material.needAlphaBlending() || m.hasVertexAlpha) continue
      m.computeWorldMatrix(true)
      const list = groups.get(m.material)
      if (list) list.push(m)
      else groups.set(m.material, [m])
    }
    for (const [mat, parts] of groups) {
      if (parts.length < 2) continue
      const merged = Mesh.MergeMeshes(parts, true, true)
      if (!merged) continue
      merged.name = `${name}_${mat.name}`
      merged.material = mat
      merged.parent = node
      merged.receiveShadows = parts[0].receiveShadows
      const gone = new Set<AbstractMesh>(parts)
      for (let i = this.meshes.length - 1; i >= 0; i--) if (gone.has(this.meshes[i])) this.meshes.splice(i, 1)
      this.meshes.push(merged)
    }
    node.parent = parent
    node.position.copyFrom(at)
  }

  /** A thin cylinder between two points (ropes, chains, pipes). */
  rod(name: string, a: V3, b: V3, d: number, mat: Material, parent?: TransformNode): Mesh {
    const va = Vector3.FromArray(a)
    const vb = Vector3.FromArray(b)
    const m = CreateCylinder(name, { diameter: d, height: Vector3.Distance(va, vb), tessellation: 8 }, this.scene)
    const mid = va.add(vb).scale(0.5)
    this.add(m, [mid.x, mid.y, mid.z], mat, parent)
    const dir = vb.subtract(va).normalize()
    const up = Vector3.Up()
    const axis = Vector3.Cross(up, dir)
    if (axis.lengthSquared() > 1e-8) {
      const angle = Math.acos(Math.max(-1, Math.min(1, Vector3.Dot(up, dir))))
      m.rotationQuaternion = Quaternion.RotationAxis(axis.normalize(), angle)
    }
    return m
  }

  node(name: string, pos: V3, parent?: TransformNode): TransformNode {
    const n = new TransformNode(name, this.scene)
    n.position.set(...pos)
    n.parent = parent ?? this.root
    return n
  }

  /**
   * Freeze static geometry so world matrices aren't recomputed every frame.
   *
   * With `merge`, static pieces that share a material also become one mesh:
   * a set is built from hundreds of primitives (ribs, rails, mullions), each a
   * draw call, and phones run out of draw calls long before triangles. Call it
   * after lighting is set up (shadow casters, glow exclusions and the probe's
   * list carry over to the merged mesh). `keep` names everything the set's
   * script changes later besides the `moving` nodes (shown, hidden, faded or
   * re-materialled pieces): those and their children stay separate.
   */
  freezeStatic(moving: TransformNode[], opts: { merge?: boolean; keep?: TransformNode[] } = {}): void {
    const isMoving = (m: AbstractMesh) => {
      for (let p = m.parent; p; p = p.parent) if (moving.includes(p as TransformNode)) return true
      return false
    }
    if (opts.merge) this.mergeStatic([...moving, ...(opts.keep ?? [])])
    for (const m of this.meshes) if (!isMoving(m)) m.freezeWorldMatrix()
  }

  private mergeStatic(keep: TransformNode[]): void {
    const scene = this.scene
    const held = (m: AbstractMesh) => {
      for (let n: TransformNode | null = m; n; n = n.parent as TransformNode | null) if (keep.includes(n)) return true
      return false
    }
    const generators = scene.lights.flatMap((l) => {
      const g = l.getShadowGenerator() as ShadowGenerator | null
      return g ? [g] : []
    })
    const glow = scene.effectLayers.find((l) => l.getClassName() === 'GlowLayer') as unknown as { hasMesh(m: AbstractMesh): boolean; addExcludedMesh(m: Mesh): void } | undefined
    // every other list that names meshes: the reflection probe, mirrors, and
    // lights limited to part of the set (a merged mesh joins the lists its parts were on)
    const shadowMaps = new Set(generators.map((g) => g.getShadowMap()))
    const targets = [...new Set([...scene.customRenderTargets, ...(scene.textures as RenderTargetTexture[])])].filter((t) => t.renderList && !shadowMaps.has(t))
    const lightLists = scene.lights.flatMap((l) => [l.includedOnlyMeshes, l.excludedMeshes]).filter((list) => list.length)
    const groups = new Map<string, Mesh[]>()
    for (const m of this.meshes) {
      if (!(m instanceof Mesh) || held(m) || m.isDisposed()) continue
      const mat = m.material
      if (!mat || m.skeleton || m.morphTargetManager || m.hasInstances || !m.getTotalVertices()) continue
      if (!m.isEnabled() || !m.isVisible || m.visibility < 1 || m.metadata || m.billboardMode) continue
      // transparent pieces are sorted one by one; merging would break their order
      if (mat.needAlphaBlending() || m.hasVertexAlpha) continue
      m.computeWorldMatrix(true)
      if (m.getWorldMatrix().determinant() < 0) continue
      const caster = generators.map((g) => (g.getShadowMap()?.renderList?.includes(m) ? 1 : 0)).join('')
      const probes = targets.map((t) => (t.renderList!.includes(m) ? 1 : 0)).join('')
      const excluded = glow && !glow.hasMesh(m) ? 1 : 0
      const lit = lightLists.map((list) => (list.includes(m) ? 1 : 0)).join('')
      const key = `${mat.uniqueId}|${m.receiveShadows}|${m.applyFog}|${m.layerMask}|${m.renderingGroupId}|${m.isPickable}|${caster}|${probes}|${excluded}|${lit}`
      const list = groups.get(key)
      if (list) list.push(m)
      else groups.set(key, [m])
    }
    this.root.computeWorldMatrix(true)
    for (const [key, parts] of groups) {
      if (parts.length < 2) continue
      const [, receive, , , , pickable, caster, probes, excluded, lit] = key.split('|')
      const first = parts[0]
      let merged: Mesh | null = null
      try {
        merged = Mesh.MergeMeshes(parts, true, true)
      } catch (err) {
        console.warn(`[sets] couldn't merge ${first.name} and ${parts.length - 1} more`, err)
      }
      if (!merged) continue
      merged.name = `${first.name}+${parts.length - 1}`
      merged.parent = this.root
      merged.receiveShadows = receive === 'true'
      merged.isPickable = pickable === 'true'
      generators.forEach((g, i) => caster[i] === '1' && g.addShadowCaster(merged!, false))
      targets.forEach((t, i) => probes[i] === '1' && t.renderList!.push(merged!))
      if (excluded === '1') glow?.addExcludedMesh(merged)
      const gone = new Set<AbstractMesh>(parts)
      for (const t of targets) t.renderList = t.renderList!.filter((x) => !gone.has(x))
      lightLists.forEach((list, i) => {
        for (let j = list.length - 1; j >= 0; j--) if (gone.has(list[j])) list.splice(j, 1)
        if (lit[i] === '1') list.push(merged!)
      })
      for (let i = this.meshes.length - 1; i >= 0; i--) if (gone.has(this.meshes[i])) this.meshes.splice(i, 1)
      this.meshes.push(merged)
    }
  }

  /**
   * Forgets meshes that have been disposed. A set's builder lives as long as
   * the set, but the hand props' builder lives all session and builds and
   * throws away props scene after scene: without this its list would keep
   * every dead prop (and, through them, the render lists they last sat in).
   */
  pruneDisposed(): void {
    for (let i = this.meshes.length - 1; i >= 0; i--) if (this.meshes[i].isDisposed()) this.meshes.splice(i, 1)
  }

  dispose(): void {
    this.root.dispose(false, false)
    for (const o of this.owned) o.dispose()
  }
}

/**
 * A set piece is authored as many parts (the sedan is 88), and each part is a
 * draw call. Parts that share a material become one mesh, so the sedan costs
 * 7. Sets move a model only as a whole and change only its materials (lit
 * headlamps), never a single part, so nothing they touch is lost. `root` must
 * be at the origin with no parent: the merge bakes each part's transform.
 */
function mergeByMaterial(root: TransformNode, name: string): void {
  const groups = new Map<Material, Mesh[]>()
  for (const m of root.getChildMeshes(false)) {
    if (!(m instanceof Mesh) || !m.material || m.skeleton || m.morphTargetManager || m.hasInstances || !m.getTotalVertices()) continue
    const list = groups.get(m.material)
    if (list) list.push(m)
    else groups.set(m.material, [m])
  }
  root.computeWorldMatrix(true)
  for (const [mat, parts] of groups) {
    if (parts.length < 2) continue
    try {
      const merged = Mesh.MergeMeshes(parts, true, true)
      if (!merged) continue
      merged.name = `${name}_${mat.name}`
      merged.material = mat
      merged.parent = root
    } catch (err) {
      // parts with mismatched vertex layouts stay separate: correct, just more draws
      console.warn(`[sets] ${name}: couldn't merge the ${mat.name} parts`, err)
    }
  }
  // drop the empty grouping nodes the parts hung from (a Mesh is a TransformNode too: keep those)
  for (const n of root.getChildTransformNodes(false)) if (!(n instanceof Mesh) && !n.isDisposed() && !n.getChildMeshes(false).length) n.dispose()
}
