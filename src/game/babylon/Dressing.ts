import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture'
import { Texture } from '@babylonjs/core/Materials/Textures/texture'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Material } from '@babylonjs/core/Materials/material'
import type { PBRMaterial } from '@babylonjs/core/Materials/PBR/pbrMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Mesh as MeshCtor } from '@babylonjs/core/Meshes/mesh'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import { AbstractMesh } from '@babylonjs/core/Meshes/abstractMesh'
import type { LightingManager } from './LightingManager'
import { rand } from './ProceduralTextures'
import type { SetBuilder } from './SetBuilder'

// Set dressing that reads as light without being light: pools on the floor
// under lamps, the shape of a window thrown across a room, neon, halos round
// bulbs, puddles. All unlit and additive (or one glossy material), so they cost
// no light slots (sets are at WebGPU's 8 per shader) and next to nothing on a
// phone, where they stand in for the bloom and shadows the low tiers lose.

type V3 = [number, number, number]

const cache = new WeakMap<SetBuilder, Map<string, Material>>()
const shared = (s: SetBuilder, key: string, make: () => Material): Material => {
  let m = cache.get(s)
  if (!m) cache.set(s, (m = new Map()))
  let mat = m.get(key)
  if (!mat) m.set(key, (mat = make()))
  return mat
}

/** Materials this module made: the ones mergeDressing may merge across. */
const dressingMats = new WeakSet<Material>()
/** Neon tubes: the one piece of dressing the glow layer should bloom. */
const tubes = new WeakSet<AbstractMesh>()

const canvas = (t: DynamicTexture) => t.getContext() as unknown as CanvasRenderingContext2D

/** An unlit additive material showing `tex` (its colour is painted in; black adds nothing). */
function additive(s: SetBuilder, name: string, tex: DynamicTexture, alpha: number): StandardMaterial {
  const m = new StandardMaterial(name, s.scene)
  m.disableLighting = true
  m.emissiveTexture = tex
  m.emissiveColor = Color3.Black()
  m.diffuseColor = Color3.Black()
  m.specularColor = Color3.Black()
  tex.level = 1
  m.alpha = alpha
  m.alphaMode = 1 // ALPHA_ADD
  m.transparencyMode = Material.MATERIAL_ALPHABLEND
  m.disableDepthWrite = true
  m.backFaceCulling = false
  // fog would add its own colour to an additive surface; distance fades it instead
  m.fogEnabled = false
  s.materials.push(m)
  s.track(m)
  dressingMats.add(m)
  return m
}

/** A soft round gradient in `rgb`, transparent black at the edge. */
function radial(s: SetBuilder, name: string, rgb: Color3, inner = 0.18): DynamicTexture {
  const size = 128
  const t = s.track(new DynamicTexture(name, { width: size, height: size }, s.scene, true))
  const c = canvas(t)
  const col = (a: number) => `rgb(${Math.round(rgb.r * 255 * a)},${Math.round(rgb.g * 255 * a)},${Math.round(rgb.b * 255 * a)})`
  c.fillStyle = '#000'
  c.fillRect(0, 0, size, size)
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, col(1))
  g.addColorStop(inner, col(0.7))
  g.addColorStop(0.55, col(0.22))
  g.addColorStop(1, col(0))
  c.fillStyle = g
  c.fillRect(0, 0, size, size)
  t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE
  t.update(true)
  return t
}

const key = (c: Color3) => `${c.r.toFixed(2)}_${c.g.toFixed(2)}_${c.b.toFixed(2)}`

function noGlow(lit: LightingManager | null | undefined, m: Mesh): Mesh {
  lit?.glow?.addExcludedMesh(m)
  m.isPickable = false
  m.receiveShadows = false
  return m
}

/**
 * A pool of light on a floor, as if a lamp above lit it: an ellipse `w` × `d`
 * metres lying on y = pos[1] (a couple of millimetres above the surface).
 * `strength` is how bright its centre adds (0.2 subtle, 0.6 strong).
 */
export function lightPool(s: SetBuilder, lit: LightingManager | null, name: string, pos: V3, w: number, d: number, color: Color3, strength = 0.35): Mesh {
  const mat = shared(s, `pool_${key(color)}_${strength}`, () => additive(s, `pool_${name}`, radial(s, `tex_pool_${name}`, color), strength))
  const m = s.plane(name, w, d, [pos[0], pos[1] + 0.006, pos[2]], mat)
  m.rotation.x = Math.PI / 2
  return noGlow(lit, m)
}

/**
 * The same on a wall: a wash of light up or across it from a fixture
 * (a sconce, a lamp on a sideboard). The plane faces −Z unless rotated by `rotY`.
 */
export function wallWash(s: SetBuilder, lit: LightingManager | null, name: string, pos: V3, w: number, h: number, color: Color3, strength = 0.3, rotY = 0): Mesh {
  const mat = shared(s, `pool_${key(color)}_${strength}`, () => additive(s, `wash_${name}`, radial(s, `tex_wash_${name}`, color), strength))
  return noGlow(lit, s.plane(name, w, h, pos, mat, rotY))
}

/**
 * Light through a window thrown across the floor: `cols` × `rows` soft panes
 * in a `w` × `d` patch, fading toward the far end, lying on y = pos[1]. `yaw`
 * turns it to follow the light's direction.
 */
export function windowLight(s: SetBuilder, lit: LightingManager | null, name: string, pos: V3, w: number, d: number, color: Color3, o: { cols?: number; rows?: number; yaw?: number; strength?: number } = {}): Mesh {
  const cols = o.cols ?? 2, rows = o.rows ?? 2
  const size = 256
  const t = s.track(new DynamicTexture(`tex_winlight_${name}`, { width: size, height: size }, s.scene, true))
  const c = canvas(t)
  c.fillStyle = '#000'
  c.fillRect(0, 0, size, size)
  c.filter = 'blur(6px)'
  const bar = size * 0.05
  const pw = (size - bar * (cols + 1)) / cols, ph = (size - bar * (rows + 1)) / rows
  for (let i = 0; i < cols; i++)
    for (let j = 0; j < rows; j++) {
      // nearer the window (top of the texture) is brighter
      const a = 1 - (j / rows) * 0.55
      c.fillStyle = `rgb(${Math.round(color.r * 255 * a)},${Math.round(color.g * 255 * a)},${Math.round(color.b * 255 * a)})`
      c.fillRect(bar + i * (pw + bar), bar + j * (ph + bar), pw, ph)
    }
  t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE
  t.update(true)
  const m = s.plane(name, w, d, [pos[0], pos[1] + 0.007, pos[2]], additive(s, `winlight_${name}`, t, o.strength ?? 0.4))
  m.rotation.x = Math.PI / 2
  m.rotation.y = o.yaw ?? 0
  return noGlow(lit, m)
}

/**
 * A soft halo round a bulb or lamp head, always facing the camera: the glow a
 * lens sees in haze, which the phone tiers (no glow layer, little or no bloom)
 * otherwise lose.
 */
export function halo(s: SetBuilder, lit: LightingManager | null, name: string, pos: V3, size: number, color: Color3, strength = 0.5, facing?: number): Mesh {
  const mat = shared(s, `halo_${key(color)}_${strength}`, () => additive(s, `halo_${name}`, radial(s, `tex_halo_${name}`, color, 0.06), strength))
  // with `facing` (a yaw) it stays put, facing that way, so it can merge with others (see merge)
  const m = s.plane(name, size, size, pos, mat, facing ?? 0)
  if (facing === undefined) m.billboardMode = AbstractMesh.BILLBOARDMODE_ALL
  return noGlow(lit, m)
}

/**
 * Merges dressing pieces that share a material into one mesh each (one draw
 * call). Additive light needs no back-to-front sort, so pools, washes and
 * fixed halos merge safely even though the set's own merge skips anything
 * transparent. Returns what's left: the merged meshes and any loners.
 */
export function merge(s: SetBuilder, meshes: Mesh[]): Mesh[] {
  const groups = new Map<Material, Mesh[]>()
  for (const m of meshes) {
    if (m.billboardMode || !m.material) continue
    const list = groups.get(m.material)
    if (list) list.push(m)
    else groups.set(m.material, [m])
  }
  const out: Mesh[] = meshes.filter((m) => m.billboardMode || !m.material)
  for (const [, parts] of groups) {
    if (parts.length < 2) {
      out.push(parts[0])
      continue
    }
    const parent = parts[0].parent
    const merged = MeshCtor.MergeMeshes(parts, true, true)
    if (!merged) {
      out.push(...parts)
      continue
    }
    merged.name = `${parts[0].name}+${parts.length - 1}`
    merged.parent = parent
    merged.isPickable = false
    merged.receiveShadows = false
    const gone = new Set<AbstractMesh>(parts)
    for (let i = s.meshes.length - 1; i >= 0; i--) if (gone.has(s.meshes[i])) s.meshes.splice(i, 1)
    s.meshes.push(merged)
    out.push(merged)
  }
  return out
}

/**
 * A neon sign: `lines` of tube lettering in `color`, with the gas glow round
 * every stroke, on a dark backing board. Faces −Z unless rotated by `rotY`.
 * Returns the tube mesh (its material's level flickers it).
 */
export function neon(
  s: SetBuilder,
  lit: LightingManager | null,
  name: string,
  lines: string[],
  pos: V3,
  w: number,
  h: number,
  color: Color3,
  o: { rotY?: number; board?: Material | null; font?: string; brightness?: number } = {},
): Mesh {
  const tw = 1024, th = Math.round((1024 * h) / w)
  const t = s.track(new DynamicTexture(`tex_neon_${name}`, { width: tw, height: th }, s.scene, true))
  const c = canvas(t)
  c.fillStyle = '#000'
  c.fillRect(0, 0, tw, th)
  const hex = (k: number) => `rgb(${Math.round(Math.min(1, color.r * k) * 255)},${Math.round(Math.min(1, color.g * k) * 255)},${Math.round(Math.min(1, color.b * k) * 255)})`
  const lh = th / (lines.length + 0.4)
  const fontPx = Math.min(lh * 0.82, (tw * 0.9) / Math.max(...lines.map((l) => l.length * 0.62)))
  c.font = `${o.font ?? "italic 800"} ${fontPx}px "Barlow Semi Condensed", "Arial Narrow", sans-serif`
  c.textAlign = 'center'
  c.textBaseline = 'middle'
  c.lineJoin = 'round'
  lines.forEach((line, i) => {
    const y = lh * (i + 0.7)
    // the gas glow, then the tube, then its hot core
    c.shadowColor = hex(1)
    c.shadowBlur = fontPx * 0.45
    c.lineWidth = fontPx * 0.11
    c.strokeStyle = hex(0.75)
    c.strokeText(line, tw / 2, y)
    c.shadowBlur = fontPx * 0.18
    c.lineWidth = fontPx * 0.06
    c.strokeStyle = hex(1.3)
    c.strokeText(line, tw / 2, y)
    c.shadowBlur = 0
    c.lineWidth = fontPx * 0.022
    c.strokeStyle = '#fff6ee'
    c.strokeText(line, tw / 2, y)
  })
  t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE
  t.update(true)
  const mat = additive(s, `neon_${name}`, t, 0.999)
  // above the bloom threshold, so it blooms where bloom runs
  t.level = o.brightness ?? 1.8
  const rotY = o.rotY ?? 0
  if (o.board !== null) {
    const board = s.box(`${name}_board`, [w * 1.04, h * 1.06, 0.06], [pos[0] + Math.sin(rotY) * 0.05, pos[1], pos[2] + Math.cos(rotY) * 0.05], o.board ?? s.pbr('neon_board', '#0c0c0e', { rough: 0.6, metal: 0.3 }))
    board.rotation.y = rotY
  }
  const tube = s.plane(name, w, h, pos, mat, rotY)
  // a wash of its colour on whatever it hangs on
  wallWash(s, lit, `${name}_spill`, [pos[0] + Math.sin(rotY) * 0.02, pos[1], pos[2] + Math.cos(rotY) * 0.02], w * 1.9, h * 2.6, color, 0.22, rotY)
  tubes.add(tube)
  return noGlow(lit, tube)
}

/**
 * Rain puddles: flat, nearly mirror-smooth patches in a rectangle
 * [x0, z0, x1, z1] at height y. They pick up the set's baked reflection probe
 * (lamps, windows, neon) on every tier.
 */
export function puddles(s: SetBuilder, name: string, area: [number, number, number, number], y: number, count: number, tint = '#1d1e22'): PBRMaterial {
  const mat = s.pbr('puddle', tint, { rough: 0.04, metal: 0.0 })
  mat.environmentIntensity = 1.6
  mat.zOffset = -2
  for (let i = 0; i < count; i++) {
    const x = area[0] + rand() * (area[2] - area[0])
    const z = area[1] + rand() * (area[3] - area[1])
    const w = 0.8 + rand() * 1.8, d = 0.5 + rand() * 1.2
    const p = s.cyl(`${name}_${i}`, 1, 0.004, [x, y + 0.003, z], mat, { tess: 18 })
    p.scaling.set(w, 1, d)
    p.rotation.y = rand() * Math.PI
    p.isPickable = false
  }
  return mat
}

/** Stray bits of dressing scattered on a floor: crumpled paper, a can, cigarette ends. */
export function litter(s: SetBuilder, name: string, area: [number, number, number, number], y: number, count: number): void {
  // one material for all of it: a few specks don't need three draw calls
  const paper = s.pbr('litter', '#a59d8c', { rough: 0.85 })
  const can = paper
  const butt = paper
  for (let i = 0; i < count; i++) {
    const x = area[0] + rand() * (area[2] - area[0])
    const z = area[1] + rand() * (area[3] - area[1])
    const k = rand()
    if (k < 0.45) {
      const m = s.sphere(`${name}_paper_${i}`, 0.09 + rand() * 0.06, [x, y + 0.03, z], paper)
      m.scaling.set(1, 0.6, 1.2)
      m.rotation.y = rand() * 3
    } else if (k < 0.65) {
      const m = s.cyl(`${name}_can_${i}`, 0.066, 0.12, [x, y + 0.033, z], can, { tess: 10 })
      m.rotation.z = Math.PI / 2
      m.rotation.y = rand() * 3
    } else {
      const m = s.cyl(`${name}_butt_${i}`, 0.012, 0.035, [x, y + 0.006, z], butt, { tess: 6 })
      m.rotation.z = Math.PI / 2
      m.rotation.y = rand() * 3
    }
  }
}

const POSTERS: { bg: string; ink: string; accent: string; top: string; title: string[]; sub: string }[] = [
  { bg: '#d9c9a6', ink: '#1a1410', accent: '#a3121c', top: 'FRIDAY NIGHT', title: ['FIGHT', 'NIGHT'], sub: 'DOWNTOWN · 9 PM' },
  { bg: '#a3121c', ink: '#f2e6cf', accent: '#111', top: 'MAIN EVENT', title: ['KOVAC', 'VS', 'REYES'], sub: '12 ROUNDS' },
  { bg: '#1b1d22', ink: '#e9dcc0', accent: '#c9a24e', top: 'GOLDEN GLOVES', title: ['CITY', 'FINALS'], sub: 'TICKETS AT THE DOOR' },
  { bg: '#e8dfcc', ink: '#121212', accent: '#1d3a6b', top: 'TRAIN HARD', title: ['NO', 'EXCUSES'], sub: 'MEMBERS ONLY' },
  { bg: '#c7b089', ink: '#251a12', accent: '#6b1218', top: 'SATURDAY', title: ['SABLE', 'CUP'], sub: 'AMATEUR BOUTS' },
]

const atlases = new WeakMap<SetBuilder, Material>()
const CELL_W = 256, CELL_H = 368

/** Every poster design side by side in one texture, so a set's posters share one material (and merge into one draw). */
function posterAtlas(s: SetBuilder): Material {
  const have = atlases.get(s)
  if (have) return have
  const n = POSTERS.length
  const t = s.track(new DynamicTexture('tex_poster_atlas', { width: CELL_W * n, height: CELL_H }, s.scene, true))
  const c = canvas(t)
  c.clearRect(0, 0, CELL_W * n, CELL_H)
  POSTERS.forEach((p, k) => {
    const x0 = k * CELL_W, tw = CELL_W, th = CELL_H
    c.save()
    c.translate(x0, 0)
    c.beginPath()
    c.rect(0, 0, tw, th)
    c.clip()
    c.fillStyle = p.bg
    c.fillRect(0, 0, tw, th)
    c.fillStyle = p.accent
    c.fillRect(0, 0, tw, th * 0.13)
    c.fillRect(0, th * 0.86, tw, th * 0.14)
    c.textAlign = 'center'
    c.textBaseline = 'middle'
    c.fillStyle = p.bg
    c.font = `italic 800 ${th * 0.07}px "Barlow Semi Condensed", "Arial Narrow", sans-serif`
    c.fillText(p.top, tw / 2, th * 0.066)
    c.fillText(p.sub, tw / 2, th * 0.93)
    c.fillStyle = p.ink
    const lh = (th * 0.68) / p.title.length
    p.title.forEach((line, i) => {
      const px = Math.min(lh * 0.92, (tw * 0.92) / (line.length * 0.56))
      c.font = `italic 800 ${px}px "Barlow Semi Condensed", "Arial Narrow", sans-serif`
      c.fillText(line, tw / 2, th * 0.17 + lh * (i + 0.5))
    })
    // age: fade, grime and creases
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(${rand() < 0.5 ? '255,245,220' : '30,20,10'},${0.04 + rand() * 0.06})`
      c.fillRect(rand() * tw, rand() * th, 10 + rand() * 60, 4 + rand() * 30)
    }
    c.strokeStyle = 'rgba(0,0,0,0.18)'
    c.lineWidth = 1.5
    c.beginPath()
    c.moveTo(0, th * 0.5)
    c.lineTo(tw, th * 0.5 + (rand() - 0.5) * 10)
    c.moveTo(tw * 0.5, 0)
    c.lineTo(tw * 0.5 + (rand() - 0.5) * 8, th)
    c.stroke()
    // torn corners (transparent)
    c.globalCompositeOperation = 'destination-out'
    for (const [x, y] of [[0, 0], [tw, 0], [0, th], [tw, th]]) {
      if (rand() < 0.5) continue
      const r = 10 + rand() * 18
      c.beginPath()
      c.moveTo(x, y)
      c.lineTo(x + (x ? -r : r), y)
      c.lineTo(x, y + (y ? -r * 1.2 : r * 1.2))
      c.fill()
    }
    c.globalCompositeOperation = 'source-over'
    c.restore()
  })
  t.hasAlpha = true
  t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE
  t.update(true)
  const mat = s.pbr('poster_atlas', '#ffffff', { albedo: t, rough: 0.85 })
  mat.useAlphaFromAlbedoTexture = true
  mat.transparencyMode = 1 // alpha test
  mat.zOffset = -1
  atlases.set(s, mat)
  return mat
}

/**
 * An old printed poster or bill pasted to a wall: one of a handful of
 * fight-night designs (`kind`), slightly sun-faded, with torn corners and
 * creases. Faces −Z unless rotated by `rotY`. All of a set's posters share one
 * material, so the set's static merge makes them a single draw call.
 */
export function poster(s: SetBuilder, name: string, kind: number, pos: V3, w: number, h: number, rotY = 0): Mesh {
  const k = kind % POSTERS.length
  const m = s.plane(name, w, h, pos, posterAtlas(s), rotY)
  // this design's cell of the atlas
  const uv = m.getVerticesData('uv')
  if (uv) {
    for (let i = 0; i < uv.length; i += 2) uv[i] = (k + uv[i]) / POSTERS.length
    m.setVerticesData('uv', uv)
  }
  m.rotation.z = (rand() - 0.5) * 0.03
  m.isPickable = false
  return m
}

/** Black with an alpha falloff: `radial` (a soft blob) or `vertical` (dark at the bottom edge). */
function shadeTexture(s: SetBuilder, kind: 'radial' | 'vertical'): DynamicTexture {
  const size = 64
  const t = s.track(new DynamicTexture(`tex_shade_${kind}`, { width: size, height: size }, s.scene, true))
  const c = canvas(t)
  c.clearRect(0, 0, size, size)
  const g = kind === 'radial' ? c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2) : c.createLinearGradient(0, size, 0, 0)
  g.addColorStop(0, 'rgba(0,0,0,1)')
  g.addColorStop(kind === 'radial' ? 0.45 : 0.2, 'rgba(0,0,0,0.55)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  c.fillStyle = g
  c.fillRect(0, 0, size, size)
  t.hasAlpha = true
  t.wrapU = t.wrapV = Texture.CLAMP_ADDRESSMODE
  t.update(true)
  return t
}

function shadeMaterial(s: SetBuilder, kind: 'radial' | 'vertical', strength: number): Material {
  return shared(s, `shade_${kind}_${strength}`, () => {
    const m = new StandardMaterial(`shade_${kind}_${strength}`, s.scene)
    const t = shadeTexture(s, kind)
    m.disableLighting = true
    m.diffuseColor = Color3.Black()
    m.emissiveColor = Color3.Black()
    m.specularColor = Color3.Black()
    m.opacityTexture = t
    m.alpha = strength
    m.disableDepthWrite = true
    m.backFaceCulling = false
    m.zOffset = -2
    s.materials.push(m)
    s.track(m)
    dressingMats.add(m)
    return m
  })
}

/**
 * Contact shadow under a piece of furniture (or anything standing on a
 * floor): a soft dark ellipse `w` × `d` at floor height. Stands in for the
 * set shadows and ambient occlusion that phones don't draw.
 */
export function floorShade(s: SetBuilder, name: string, pos: V3, w: number, d: number, strength = 0.5, yaw = 0): Mesh {
  const m = s.plane(name, w, d, [pos[0], pos[1] + 0.004, pos[2]], shadeMaterial(s, 'radial', strength))
  m.rotation.x = Math.PI / 2
  m.rotation.y = yaw
  m.isPickable = false
  m.receiveShadows = false
  return m
}

/**
 * The darkening where a wall meets the floor: a strip `len` long and `h`
 * high, darkest at its foot, standing just off the wall at `pos` (its
 * bottom-centre). Faces −Z unless rotated by `rotY`; a whole room's walls
 * take one call each.
 */
export function wallShade(s: SetBuilder, name: string, pos: V3, len: number, h: number, rotY = 0, strength = 0.4): Mesh {
  const m = s.plane(name, len, h, [pos[0], pos[1] + h / 2, pos[2]], shadeMaterial(s, 'vertical', strength), rotY)
  m.isPickable = false
  m.receiveShadows = false
  return m
}

/** Shade along the foot of every wall of an axis-aligned room [x0, z0, x1, z1] with its floor at y. */
export function roomShade(s: SetBuilder, name: string, room: [number, number, number, number], y: number, h = 0.7, strength = 0.38): void {
  const [x0, z0, x1, z1] = room
  const e = 0.015
  wallShade(s, `${name}_n`, [(x0 + x1) / 2, y, z1 - e], x1 - x0, h, 0, strength)
  wallShade(s, `${name}_s`, [(x0 + x1) / 2, y, z0 + e], x1 - x0, h, Math.PI, strength)
  wallShade(s, `${name}_w`, [x0 + e, y, (z0 + z1) / 2], z1 - z0, h, -Math.PI / 2, strength)
  wallShade(s, `${name}_e`, [x1 - e, y, (z0 + z1) / 2], z1 - z0, h, Math.PI / 2, strength)
}

/**
 * Merges all of a set's light and shade dressing (pools, washes, window
 * light, fixed halos, contact shade) by material: call it after building,
 * before the set's freezeStatic. `keep` lists pieces the set's script shows
 * or hides later; pieces on moving nodes, billboards and instance sources stay
 * as they are. Run it after the set's glow layer exists and before its
 * reflection probe is baked.
 */
export function mergeDressing(s: SetBuilder, keep: AbstractMesh[] = []): void {
  const held = new Set(keep)
  const pick = s.meshes.filter((m): m is Mesh => m instanceof MeshCtor && !!m.material && dressingMats.has(m.material) && m.parent === s.root && !m.hasInstances && !m.billboardMode && !held.has(m) && m.isEnabled())
  merge(s, pick)
  // the glow layer (high tier) would bloom every pool and wash; only the neon should
  const glow = s.scene.effectLayers.find((l) => l.getClassName() === 'GlowLayer') as unknown as { addExcludedMesh(m: Mesh): void } | undefined
  if (glow) for (const m of s.meshes) if (m instanceof MeshCtor && m.material && dressingMats.has(m.material) && !tubes.has(m)) glow.addExcludedMesh(m)
}
