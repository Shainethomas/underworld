import { BoundingInfo, Color3, PBRMaterial, TransformNode, Vector3 } from '@render/core'
import type { AbstractMesh, AnimationGroup, AssetContainer, Node, Scene, Texture } from '@render/core'
import { loadContainer } from '@render/AssetLoader'
import { fabric } from '@render/ProceduralTextures'
import type { ActorId } from '../narrative/types'
import { ALL_CLIPS, clipsFor } from './CharacterExpressions'
import { characterUrl } from '../assets/urls'
import { ANIM_URL, castUrls, CHARACTERS, KIT_URL, type CharacterDef, type Fabric, type Garment, type Hair } from './CharacterDefs'

export { ANIM_URL, CHARACTERS, KIT_URL, type CharacterDef } from './CharacterDefs'

/** Skin segments each garment hides (they sit fully under the garment shell). */
const COVERS: Record<Garment, string[]> = {
  tank: ['trunk'],
  tee: ['trunk', 'shoulder'],
  hoodie: ['trunk', 'shoulder', 'arm'],
  jacket: ['trunk', 'shoulder', 'arm'],
  coat: ['trunk', 'shoulder', 'arm'],
  pants: ['hips', 'shins'],
  shorts: ['hips'],
  shoes: ['feet'],
  wraps: ['hand'],
  belt: [],
}
const SEGMENTS = ['head', 'trunk', 'shoulder', 'arm', 'hand', 'fingers', 'hips', 'shins', 'feet']
const GARMENT_MATERIAL: Record<string, Garment> = {
  M_Tank: 'tank', M_Tee: 'tee', M_Hoodie: 'hoodie', M_Jacket: 'jacket', M_Coat: 'coat', M_Pants: 'pants', M_Shorts: 'shorts', M_Shoes: 'shoes', M_Wraps: 'wraps', M_Belt: 'belt',
}
const DEFAULT_FABRIC: Partial<Record<Garment, Fabric>> = {
  tank: 'knit', tee: 'knit', hoodie: 'knit', shorts: 'knit', jacket: 'wool', coat: 'knit', pants: 'wool', belt: 'leather',
}
/** Detail colours on garment trims, unless a character overrides them. */
const TRIM_DEFAULTS: Record<string, string> = {
  M_Shirt: '#dcdcd8', M_Lapel: '#101013', M_Button: '#121214', M_Buckle: '#a8894f', M_String: '#c8c8c4', M_Band: '#d8d8d4', M_Sole: '#1a1a1c', M_Pocket: '#7a1018',
  M_Pen: '#1b2a52', M_Frame: '#141416',
}

/** Garments shown at spawn; the rest (e.g. Rookie's training tank) are toggled by stage directives. */
const DEFAULT_OFF: Partial<Record<ActorId, Garment[]>> = {}

export interface CharacterRig {
  root: TransformNode
  meshes: Map<string, AbstractMesh>
  clips: Map<string, AnimationGroup>
  /** Bone transform nodes by bone name. */
  bones: Map<string, TransformNode>
  garments: Record<string, boolean>
  setGarment(name: string, on: boolean): void
  dispose(): void
}

/**
 * Builds actors from resident model files. It loads nothing itself: the stager
 * makes the cast's files resident (castUrls → @render/AssetLoader) behind the
 * loading screen, then calls `use`; files the next cast doesn't need are freed
 * at the scene change.
 */
export class CharacterLibrary {
  private fabrics: Record<Fabric, { albedo: Texture; bump: Texture } | null> | null = null
  private kit: AssetContainer | null = null
  private anims: AssetContainer | null = null
  private models = new Map<string, AssetContainer>()
  /** Clip libraries whose hip keys are already scaled to the kit (done once per loaded file). */
  private fitted = new WeakSet<AssetContainer>()

  constructor(private scene: Scene) {}

  async use(cast: readonly ActorId[]): Promise<void> {
    const urls = castUrls(cast)
    const get = (u: string) => loadContainer(u, this.scene)
    const kitUrl = characterUrl(KIT_URL)
    const modelUrls = urls.filter((u) => u !== kitUrl && u !== ANIM_URL)
    const [kit, anims, ...models] = await Promise.all([
      urls.includes(kitUrl) ? get(kitUrl) : null,
      urls.includes(ANIM_URL) ? get(ANIM_URL) : null,
      ...modelUrls.map(get),
    ])
    this.kit = kit
    this.anims = anims
    this.models = new Map(modelUrls.map((u, i) => [u, models[i]!]))
    if (kit && anims && !this.fitted.has(anims)) {
      this.fitHipHeight(kit, anims)
      this.fitted.add(anims)
    }
    if (kit) this.fabrics ??= makeFabrics(this.scene)
  }

  /**
   * The clips were authored on the mannequin, whose hips sit a little lower
   * than the base characters'. Scale the hip translation keys so feet stay on
   * the floor.
   */
  private fitHipHeight(kit: AssetContainer, anims: AssetContainer): void {
    const kitPelvis = kit.transformNodes.find((n) => n.name === 'pelvis')
    const animPelvis = anims.transformNodes.find((n) => n.name === 'pelvis')
    if (!kitPelvis || !animPelvis) return
    const ratio = kitPelvis.position.length() / Math.max(1e-4, animPelvis.position.length())
    for (const group of anims.animationGroups) {
      for (const ta of group.targetedAnimations) {
        if ((ta.target as Node).name !== 'pelvis' || ta.animation.targetProperty !== 'position') continue
        for (const k of ta.animation.getKeys()) (k.value as Vector3).scaleInPlace(ratio)
      }
    }
  }

  create(id: ActorId): CharacterRig {
    const def = CHARACTERS[id]
    const model = def.model && this.models.get(characterUrl(def.model))
    if (model) return createFromModel(this.scene, id, def, model)
    if (!this.kit || !this.anims) throw new Error(`[characters] ${id}: the character kit isn't loaded for this cast`)
    const anims = this.anims
    const entries = this.kit.instantiateModelsToScene((n) => `${id}:${n}`, true, { doNotInstantiate: true })
    const root = new TransformNode(`actor:${id}`, this.scene)
    for (const n of entries.rootNodes) n.parent = root
    root.scaling.setAll(def.scale)

    const strip = (n: string) => n.slice(id.length + 1)
    const meshes = new Map<string, AbstractMesh>()
    const bones = new Map<string, TransformNode>()
    // Named parts by kit name. A multi-material part (the jacket and its shirt V)
    // is a transform node over `_primitiveN` meshes, so toggle the node itself.
    const parts = new Map<string, TransformNode>()
    for (const n of entries.rootNodes) {
      for (const d of n.getDescendants(false)) {
        const name = strip(d.name)
        if ('getTotalVertices' in d) meshes.set(name, d as AbstractMesh)
        else if (d instanceof TransformNode) bones.set(name, d)
        if (d instanceof TransformNode && /^(body|garment|hair|acc|eyes)_?/.test(name) && !name.includes('_primitive')) parts.set(name, d)
      }
    }
    for (const g of entries.animationGroups) g.dispose()

    // Build: widen torso bones a touch for heavier characters
    if (def.build !== 1) {
      for (const b of ['spine_02', 'spine_03']) {
        const node = bones.get(b)
        if (node) node.scaling = new Vector3(def.build, 1, def.build)
      }
    }

    // Materials. PBR colours are linear; definitions are authored as sRGB hex.
    const shared = new Set<unknown>(Object.values(this.fabrics ?? {}).flatMap((f) => (f ? [f.albedo, f.bump] : [])))
    const lin = (hex: string) => Color3.FromHexString(hex).toLinearSpace()
    const skin = lin(def.skin)
    const hair = lin(def.hairColor).scale(2.4)
    for (const m of meshes.values()) {
      m.receiveShadows = true
      const mat = m.material
      if (!(mat instanceof PBRMaterial)) continue
      const base = mat.name.split(':').pop()!.split('.')[0]
      const garment = GARMENT_MATERIAL[base]
      if (base.startsWith('MI_Superhero')) {
        mat.albedoColor = skin
      } else if (base.startsWith('MI_Hair')) {
        mat.albedoColor = hair
      } else if (base === 'M_Lens') {
        mat.roughness = 0.08
        mat.metallic = 0.7
      } else if (base === 'M_ClearLens') {
        // barely-there glass: a faint tint and a sharp highlight
        mat.albedoColor = lin('#cfd8df')
        mat.roughness = 0.04
        mat.metallic = 0
        mat.alpha = 0.16
        mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHABLEND
        mat.backFaceCulling = false
      } else if (garment) {
        const col = def.garments[garment]
        if (col) mat.albedoColor = lin(col)
        mat.metallic = 0
        const fabric = def.fabrics?.[garment] ?? DEFAULT_FABRIC[garment]
        const tex = fabric ? this.fabrics?.[fabric] : null
        if (tex) {
          mat.albedoTexture = tex.albedo
          mat.bumpTexture = tex.bump
        }
        mat.roughness = garment === 'shoes' ? (def.polished ? 0.22 : 0.6) : fabric === 'leather' ? 0.4 : fabric === 'wool' ? 0.72 : 0.88
        if (garment === 'shoes' && def.polished) {
          mat.clearCoat.isEnabled = true
          mat.clearCoat.intensity = 0.7
        }
        if (fabric === 'knit' || fabric === 'wool') {
          mat.sheen.isEnabled = true
          mat.sheen.intensity = fabric === 'wool' ? 0.25 : 0.4
          mat.sheen.color = lin(col ?? '#888888').scale(2.2)
          mat.sheen.roughness = 0.55
        }
      } else if (base in TRIM_DEFAULTS) {
        mat.albedoColor = lin(def.trims?.[base] ?? TRIM_DEFAULTS[base])
        mat.metallic = base === 'M_Buckle' || base === 'M_Frame' ? 1 : 0
        mat.roughness = base === 'M_Lapel' ? 0.32 : base === 'M_Buckle' || base === 'M_Frame' ? 0.25 : base === 'M_Button' || base === 'M_Pen' ? 0.3 : 0.7
        if (base === 'M_Shirt') mat.bumpTexture = this.fabrics?.knit?.bump ?? null
      }
    }

    fitBounds(meshes.values())

    const garments: Record<string, boolean> = {}
    for (const g of Object.keys(def.garments) as Garment[]) garments[g] = !(DEFAULT_OFF[id] ?? []).includes(g)

    const applyVisibility = () => {
      const covered = new Set<string>()
      for (const [g, on] of Object.entries(garments)) if (on) for (const s of COVERS[g as Garment]) covered.add(s)
      for (const s of SEGMENTS) parts.get(`body_${s}`)?.setEnabled(!covered.has(s))
      for (const g of Object.keys(COVERS)) parts.get(`garment_${g}`)?.setEnabled(Boolean(garments[g]))
      for (const h of ['simpleparted', 'buzzed', 'long', 'beard']) parts.get(`hair_${h}`)?.setEnabled(def.hair.includes(h as Hair))
      parts.get('acc_sunglasses')?.setEnabled(Boolean(def.sunglasses))
      parts.get('acc_glasses')?.setEnabled(Boolean(def.glasses))
      parts.get('acc_pocket_square')?.setEnabled(Boolean(def.pocketSquare) && Boolean(garments.jacket))
    }
    applyVisibility()

    // Retarget clips by bone name
    const clips = new Map<string, AnimationGroup>()
    for (const src of anims.animationGroups) {
      if (!ALL_CLIPS.includes(src.name)) continue
      const g = src.clone(`${id}:${src.name}`, (t: Node) => bones.get(t.name) ?? null, true)
      g.stop()
      g.weight = 0
      clips.set(src.name, g)
    }

    return {
      root,
      meshes,
      clips,
      bones,
      garments,
      setGarment(name, on) {
        if (!(name in garments)) return
        garments[name] = on
        applyVisibility()
      },
      dispose() {
        for (const g of clips.values()) g.dispose()
        // the cloth textures are the library's, shared by every outfit: detach
        // them so disposing this actor's materials doesn't destroy them for the next cast
        for (const m of meshes.values()) {
          const mat = m.material
          if (!(mat instanceof PBRMaterial)) continue
          if (shared.has(mat.albedoTexture)) mat.albedoTexture = null
          if (shared.has(mat.bumpTexture)) mat.bumpTexture = null
        }
        disposeRig(root, meshes.values())
      },
    }
  }
}

/**
 * Clothing textures on a complete model are a light neutral grey; scaling the
 * linear tint up by this much brings the result close to the kit's garments
 * for the same colour.
 */
const MODEL_TINT_GAIN = 2.5
/** Model mesh name → the garment colour that tints it. */
const MODEL_GARMENT_MESH: Record<string, Garment> = { rk_hoodie: 'hoodie', rk_pants: 'pants', rk_shoes: 'shoes' }

/** An actor from a complete rigged model (`CharacterDef.model`): its own meshes, materials and baked clips. */
function createFromModel(scene: Scene, id: ActorId, def: CharacterDef, model: AssetContainer): CharacterRig {
  const entries = model.instantiateModelsToScene((n) => `${id}:${n}`, true, { doNotInstantiate: true })
  const root = new TransformNode(`actor:${id}`, scene)
  for (const n of entries.rootNodes) n.parent = root
  root.scaling.setAll(def.scale)

  const strip = (n: string) => n.slice(id.length + 1)
  const meshes = new Map<string, AbstractMesh>()
  const bones = new Map<string, TransformNode>()
  for (const n of entries.rootNodes) {
    for (const d of n.getDescendants(false)) {
      const name = strip(d.name)
      if ('getTotalVertices' in d) meshes.set(name, d as AbstractMesh)
      else if (d instanceof TransformNode) bones.set(name, d)
    }
  }

  const lin = (hex: string) => Color3.FromHexString(hex).toLinearSpace()
  for (const [name, m] of meshes) {
    m.receiveShadows = true
    const mat = m.material
    if (!(mat instanceof PBRMaterial)) continue
    const part = name.split('_primitive')[0]
    if (/_(hair|lashes)$/.test(part)) {
      // hair cards: cut out rather than blended, so they sort and shadow correctly
      mat.transparencyMode = PBRMaterial.PBRMATERIAL_ALPHATEST
      mat.alphaCutOff = 0.45
      mat.useAlphaFromAlbedoTexture = true
      if (mat.albedoTexture) mat.albedoTexture.hasAlpha = true
      mat.backFaceCulling = false
    }
    const garment = MODEL_GARMENT_MESH[part]
    const col = garment && def.garments[garment]
    if (col) {
      mat.albedoColor = lin(col).scale(MODEL_TINT_GAIN)
      mat.sheen.isEnabled = true
      mat.sheen.intensity = 0.35
      mat.sheen.color = lin(col).scale(2.2)
      mat.sheen.roughness = 0.55
    }
  }

  const clips = new Map<string, AnimationGroup>()
  let contactRest: AnimationGroup | null = null
  for (const g of entries.animationGroups) {
    const name = strip(g.name)
    g.stop()
    if (name === 'Contact_Rest') { contactRest = g; continue }
    if (!ALL_CLIPS.includes(name)) {
      g.dispose()
      continue
    }
    g.weight = 0
    clips.set(name, g)
  }
  // Sparse baked contact tracks override the right arm. Reuse the original
  // body's Animation objects at spawn, so each carry group still evaluates
  // the same number of tracks as the original idle/walk, with no new layer.
  for (const [carry, base] of [['Carry_Idle_Loop', 'Idle_Loop'], ['Carry_Walk_Loop', 'Walk_Loop']]) {
    const group = clips.get(carry), source = clips.get(base)
    if (!group || !source) continue
    const overridden = new Set(group.targetedAnimations.map(t => t.target))
    for (const t of source.targetedAnimations) if (!overridden.has(t.target)) group.addTargetedAnimation(t.animation, t.target)
  }

  // Reconstruct repeated constant channels from a shared template. These
  // are the same tracks the original clips evaluated, with less GLB metadata.
  if (contactRest) {
    for (const group of clips.values()) {
      const present = new Set(group.targetedAnimations.map(t => `${t.target.uniqueId}:${t.animation.targetProperty}`))
      for (const t of contactRest.targetedAnimations) {
        if (!present.has(`${t.target.uniqueId}:${t.animation.targetProperty}`)) group.addTargetedAnimation(t.animation, t.target)
      }
    }
    contactRest.dispose()
  }

  const missing = clipsFor(id).filter((c) => !clips.has(c))
  if (missing.length) console.warn(`[characters] ${id}: model has no clip for ${missing.join(', ')}`)

  fitBounds(meshes.values())

  // The outfit is part of the model; record toggles so state reads stay consistent.
  const garments: Record<string, boolean> = Object.fromEntries(Object.keys(def.garments).map((g) => [g, true]))
  return {
    root,
    meshes,
    clips,
    bones,
    garments,
    setGarment(name, on) {
      if (name in garments) garments[name] = on
    },
    dispose() {
      for (const g of clips.values()) g.dispose()
      disposeRig(root, meshes.values())
    },
  }
}

/**
 * Disposes an actor's nodes, meshes, materials and textures, and its
 * skeletons: meshes don't own their skeleton, so without this every actor
 * would leave one behind (and its bone texture) at each scene change.
 */
function disposeRig(root: TransformNode, meshes: Iterable<AbstractMesh>): void {
  const skeletons = new Set([...meshes].flatMap((m) => (m.skeleton ? [m.skeleton] : [])))
  root.dispose(false, true)
  for (const sk of skeletons) sk.dispose()
}

/**
 * Skinned meshes keep their bind-pose bounds, so a hand thrown in a punch, a
 * seated or lying pose, or a garment piece far from where it started would be
 * culled while still in shot. Instead of drawing every character all the time
 * (on phones that doubled the draw calls of every shot), each piece gets the
 * whole character's bounds, grown to cover any pose: about the body's height
 * all round and a little above. Characters out of shot are then skipped.
 */
function fitBounds(parts: Iterable<AbstractMesh>): void {
  const list = [...parts].filter((m) => m.getTotalVertices() > 0)
  if (!list.length) return
  const min = new Vector3(Infinity, Infinity, Infinity)
  const max = new Vector3(-Infinity, -Infinity, -Infinity)
  for (const m of list) {
    m.computeWorldMatrix(true)
    const bb = m.getBoundingInfo().boundingBox
    min.minimizeInPlace(bb.minimumWorld)
    max.maximizeInPlace(bb.maximumWorld)
  }
  const h = max.y - min.y
  const cx = (min.x + max.x) / 2
  const cz = (min.z + max.z) / 2
  const reach = h * 0.75
  const lo = new Vector3(cx - reach, min.y - 0.1, cz - reach)
  const hi = new Vector3(cx + reach, max.y + h * 0.2, cz + reach)
  for (const m of list) {
    const inv = m.getWorldMatrix().clone().invert()
    const lmin = new Vector3(Infinity, Infinity, Infinity)
    const lmax = new Vector3(-Infinity, -Infinity, -Infinity)
    for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) for (const z of [lo.z, hi.z]) {
      const p = Vector3.TransformCoordinates(new Vector3(x, y, z), inv)
      lmin.minimizeInPlace(p)
      lmax.maximizeInPlace(p)
    }
    m.setBoundingInfo(new BoundingInfo(lmin, lmax))
  }
}

/** Tiling cloth detail shared by every outfit: grayscale albedo (tinted per garment) plus normal map. */
function makeFabrics(scene: Scene): Record<Fabric, { albedo: Texture; bump: Texture } | null> {
  const make = (kind: Exclude<Fabric, 'leather'>, tiles: number) => {
    const t = fabric(scene, kind)
    for (const tex of [t.albedo, t.bump]) {
      tex.uScale = tiles
      tex.vScale = tiles
    }
    t.bump.level = kind === 'denim' ? 0.55 : 0.4
    return t
  }
  return { knit: make('knit', 22), wool: make('wool', 26), denim: make('denim', 20), leather: null }
}
