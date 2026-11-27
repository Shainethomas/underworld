import { Color3, Vector3 } from '@render/core'
import type { Material } from '@render/core'
import * as I from '@render/InteriorTextures'
import { LightingManager, TUNGSTEN, WARM } from '@render/LightingManager'
import * as T from '@render/ProceduralTextures'
import * as D from '@render/Dressing'
import { SetBuilder } from '@render/SetBuilder'
import type { EnvironmentFactory } from './types'

// Victor's private office, high over the city on a sunny day: tall windows
// behind his desk, walnut panelling, bookshelves, a rug, a leather chair.
// 10 m × 10 m; the windows are in the back wall (z = +5), the door side is −z.

const SUN = new Color3(1, 0.9, 0.74)
const H = 4

const build: EnvironmentFactory = async ({ scene, quality }) => {
  const s = new SetBuilder(scene, 'office')
  const lit = new LightingManager(scene, quality)
  T.reseed(71)
  scene.fogMode = 0
  scene.clearColor.set(0.6, 0.72, 0.84, 1)

  const tex = <X extends { dispose(): void }>(x: X) => s.track(x)
  const paper = s.pbr('office_paper', '#ffffff', { albedo: tex(I.wallpaper(scene, 'tex_office_paper', '#eadcc0', '#dccaa4', '#c2a272')), rough: 0.9 })
  const panel = s.pbr('office_panel', '#ffffff', { albedo: tex(I.panelling(scene, 'tex_office_panel', [104, 64, 40])), rough: 0.45 })
  const boards = s.pbr('office_floor', '#ffffff', { albedo: tex(I.planks(scene, 'tex_office_planks', [120, 78, 48])), rough: 0.4, clearCoat: 0.35 })
  const walnut = s.pbr('walnut', '#ffffff', { albedo: tex(T.wood(scene, 256, [92, 56, 34])), rough: 0.4 })
  const dark = s.pbr('walnut_dark', '#3e2618', { rough: 0.4 })
  const trim = s.pbr('office_trim', '#efe4cc', { rough: 0.5 })
  const brass = s.pbr('brass', '#c7a05a', { rough: 0.28, metal: 1 })
  const leatherTop = s.pbr('desk_leather', '#2f4a3a', { rough: 0.55 })
  const ceilingMat = s.pbr('office_ceiling', '#f2e9d8', { rough: 0.95 })
  const rugMat = s.pbr('office_rug', '#ffffff', { albedo: tex(I.patternRug(scene, 'tex_office_rug', '#7a2a26', '#1f2e44', '#d9b06a')), rough: 0.95 })
  const art = s.pbr('office_art', '#ffffff', { albedo: tex(I.painting(scene, 'tex_office_art')), rough: 0.7 })
  const view = s.glow('office_view', new Color3(1.05, 1.05, 1.05), tex(I.skylineView(scene, 'tex_office_view')))
  const leaf = s.pbr('office_leaf', '#557a3a', { rough: 0.8 })
  const pot = s.pbr('office_pot', '#2c2a28', { rough: 0.5 })
  const paperMat = s.pbr('paper', '#ece2c4', { rough: 1 })
  const books = ['#7a2e26', '#2f4a63', '#b88a3a', '#3f5e3a', '#5a3a5e', '#c9b48a', '#22262e'].map((c, i) => s.pbr(`office_book_${i}`, c, { rough: 0.8 }))

  const tbox = (name: string, size: [number, number, number], pos: [number, number, number], mat: Material, tile = 1) => s.tileUV(s.box(name, size, pos, mat), tile)
  /** Papered wall over a tall walnut dado, with skirting and cornice. */
  const wall = (name: string, size: [number, number, number], pos: [number, number, number]) => {
    const thinX = size[0] < size[2]
    tbox(name, size, pos, paper, 0.8)
    const span = (t: number, h: number): [number, number, number] => (thinX ? [size[0] + t, h, size[2]] : [size[0], h, size[2] + t])
    tbox(`${name}_dado`, span(0.04, 1.3), [pos[0], 0.65, pos[2]], panel, 1)
    s.box(`${name}_rail`, span(0.1, 0.06), [pos[0], 1.33, pos[2]], dark)
    s.box(`${name}_skirting`, span(0.08, 0.18), [pos[0], 0.09, pos[2]], dark)
    s.box(`${name}_cornice`, span(0.16, 0.16), [pos[0], H - 0.08, pos[2]], trim)
  }

  // ── Shell ───────────────────────────────────────────────────────────────
  const floor = tbox('floor', [10, 0.2, 10], [0, -0.1, 0], boards, 1.2)
  for (const x of [-5, 5]) wall(`wall_${x}`, [0.2, H, 10], [x, H / 2, 0])
  wall('front_wall', [10, H, 0.2], [0, H / 2, -5])
  const ceiling = s.plane('ceiling', 10, 10, [0, H, 0], ceilingMat)
  ceiling.rotation.x = -Math.PI / 2
  // the back wall is three tall windows between walnut piers, the city beyond
  s.plane('view', 10, H, [0, H / 2, 5.25], view, Math.PI)
  for (const x of [-4.6, -1.55, 1.55, 4.6]) tbox(`pier_${x}`, [0.8, H, 0.3], [x, H / 2, 5], walnut, 0.6)
  tbox('window_sill_wall', [10, 0.6, 0.3], [0, 0.3, 5], walnut, 0.6)
  tbox('window_head', [10, 0.4, 0.3], [0, H - 0.2, 5], walnut, 0.6)
  for (const x of [-3.1, 0, 3.1]) {
    s.box(`window_bar_${x}`, [0.05, H - 1, 0.06], [x, H / 2 + 0.1, 5.02], dark)
    s.box(`window_transom_${x}`, [2.3, 0.05, 0.06], [x, 2.9, 5.02], dark)
  }
  // ── Furniture ───────────────────────────────────────────────────────────
  // the desk: walnut, a green leather top, a brass lamp, a phone, the note
  tbox('desk', [3.2, 0.08, 1.4], [0, 0.82, 1.2], walnut, 0.6)
  s.box('desk_leather', [2.6, 0.01, 0.9], [0, 0.865, 1.2], leatherTop)
  for (const x of [-1.2, 1.2]) {
    tbox(`pedestal_${x}`, [0.6, 0.78, 1.3], [x, 0.39, 1.2], walnut, 0.6)
    for (const y of [0.2, 0.45, 0.68]) s.box(`drawer_${x}_${y}`, [0.5, 0.2, 0.02], [x, y, 0.54], dark)
  }
  tbox('modesty', [1.8, 0.6, 0.05], [0, 0.5, 0.6], walnut, 0.6)
  s.box('note', [0.3, 0.01, 0.2], [0, 0.875, 1.2], paperMat)
  s.cyl('desk_lamp_base', 0.18, 0.04, [-1.15, 0.88, 1.5], brass)
  s.cyl('desk_lamp_stem', 0.03, 0.4, [-1.15, 1.08, 1.5], brass)
  s.cyl('desk_lamp_shade', 0.34, 0.14, [-1.15, 1.3, 1.45], s.pbr('lamp_green', '#2f6a48', { rough: 0.3 }), { top: 0.14 })
  s.box('desk_phone', [0.22, 0.08, 0.26], [1.1, 0.9, 1.4], s.pbr('phone_black', '#1a1a1c', { rough: 0.4 }))
  s.box('desk_folders', [0.35, 0.06, 0.26], [0.8, 0.9, 1.0], s.pbr('folder', '#a8853f', { rough: 0.9 })).rotation.y = 0.15
  s.cyl('desk_glass', 0.08, 0.1, [-0.6, 0.92, 1.55], s.pbr('crystal', '#d8e2e4', { rough: 0.05 }), { tess: 12 })
  // his chair behind the desk, two visitor chairs in front
  // pulled up to the desk: Victor sits in it to see Rookie (Scene 04)
  await s.model('club_chair', 'boss_chair', [0, 0, 2.45], Math.PI)
  await s.model('club_chair', 'guest_chair_l', [-1.0, 0, -0.75], 0.25)
  await s.model('club_chair', 'guest_chair_r', [1.2, 0, -0.85], -0.25)
  const rug = s.plane('rug', 5.4, 4.2, [0, 0.012, 0.6], rugMat)
  rug.rotation.x = Math.PI / 2
  // bookshelves along the left wall, a painting and a sideboard on the right
  for (const z of [-2.6, 0.2]) {
    tbox(`shelf_case_${z}`, [0.45, 3.0, 2.4], [-4.7, 1.5, z], walnut, 0.6)
    for (let r = 0; r < 5; r++) {
      s.box(`shelf_${z}_${r}`, [0.42, 0.03, 2.3], [-4.66, 0.3 + r * 0.6, z], dark)
      let zz = z - 1.1
      while (zz < z + 1.05) {
        const w = 0.05 + T.rand() * 0.05
        const h = 0.3 + T.rand() * 0.16
        if (T.rand() > 0.15) s.box(`obook_${z}_${r}_${zz.toFixed(2)}`, [0.28, h, w], [-4.6, 0.32 + r * 0.6 + h / 2, zz + w / 2], books[Math.floor(T.rand() * books.length)])
        zz += w + 0.006
      }
    }
  }
  tbox('sideboard', [0.55, 0.9, 2.4], [4.65, 0.45, -1.2], walnut, 0.6)
  for (const [i, c] of ['#d6c6a0', '#8a4a2a'].entries()) s.cyl(`decanter_${i}`, 0.14, 0.3, [4.62, 1.05, -1.6 + i * 0.4], s.pbr(`decanter_${i}`, c, { rough: 0.08 }), { tess: 12 })
  s.box('painting_frame', [0.06, 1.2, 1.7], [4.88, 2.3, -1.2], s.pbr('gilt', '#a8863f', { rough: 0.35, metal: 0.8 }))
  s.plane('painting', 1.5, 1.0, [4.84, 2.3, -1.2], art, Math.PI / 2)
  for (const [x, z] of [[-4.3, 4.3], [4.3, 4.3], [4.3, 2.2]]) {
    s.cyl(`plant_pot_${x}_${z}`, 0.5, 0.6, [x, 0.3, z], pot, { top: 0.55 })
    for (let i = 0; i < 6; i++) s.sphere(`plant_${x}_${z}_${i}`, 0.45 + T.rand() * 0.3, [x + (T.rand() - 0.5) * 0.4, 0.9 + T.rand() * 0.9, z + (T.rand() - 0.5) * 0.4], leaf)
  }
  s.cyl('ceiling_rose', 0.6, 0.04, [0, H - 0.02, 0.8], trim)
  s.rod('chandelier_rod', [0, H, 0.8], [0, H - 0.6, 0.8], 0.03, brass)
  s.torus('chandelier', 0.8, 0.04, [0, H - 0.65, 0.8], brass)

  // ── Lighting: sun through the tall windows, a warm fill ────────────────
  lit.hemi(1.3, new Color3(1, 0.95, 0.88), new Color3(0.45, 0.35, 0.26))
  const sun = lit.spot('window_sun', new Vector3(0.8, 6, 9), new Vector3(-0.1, -0.55, -1), 1.3, 700, SUN, 26)
  lit.enableShadows(sun)
  lit.spot('desk_key', new Vector3(-2, 3.8, -1.2), new Vector3(0.5, -0.6, 0.8), 1.6, 70, WARM, 12)
  lit.point('room_fill', new Vector3(0, 3.2, -2.5), 20, TUNGSTEN, 10)
  // the windows' sunlight lying across the boards in front of the desk, and contact shade
  // along the walls and under the desk (phones draw no set shadows)
  D.windowLight(s, null, 'office_sun_floor', [0.4, 0, 2.8], 4.2, 2.6, SUN, { cols: 3, rows: 2, strength: 0.28 })
  D.roomShade(s, 'office_shade', [-4.9, -4.9, 4.9, 4.9], 0, 0.8, 0.3)
  D.floorShade(s, 'office_desk_shade', [0, 0, 1.2], 3.8, 2.0, 0.45)
  D.halo(s, null, 'office_lamp_halo', [-1.15, 1.22, 1.45], 0.55, new Color3(1, 0.85, 0.6), 0.35)
  lit.enableGlow(0.2)
  lit.raiseLightLimit(s.materials)
  D.mergeDressing(s)
  lit.bakeProbe(new Vector3(0, 1.8, 0), s.meshes, 0.7)
  s.freezeStatic([], { merge: true })
  return { id: 'office', lighting: lit, walkable: [floor], followYaw: 0,
    bounds: { minX: -4.2, maxX: 4.2, minZ: -4.5, maxZ: 4.5 },
    obstacles: [[-1.7, 0.4, 1.7, 2], [-5, -3.9, -4.4, 1.5], [4.3, -2.5, 5, 0.1], [-0.6, 3.2, 0.6, 4.3], [-1.6, -1.3, -0.4, -0.2], [0.6, -1.4, 1.8, -0.3]],
    cameraBox: { min: [-4.7, 0.3, -4.7], max: [4.7, 3.8, 4.7] },
    // seat: Victor in his chair behind the desk; visitor: where Rookie stands
    // in front of it; lucas_side: Lucas by the window, out of the way
    marks: { boss: [0, 2.8], seat: [0, 2.45], visitor: [0.15, -0.35], lucas: [-0.7, 0.2], lucas_side: [-2.1, 2.2], evidence: [0, 1.2, 0.92] },
    // in front of the desk, both of them in frame against the sunny windows
    shots: {
      office_wide: { pos: [0.3, 2.1, -4.4], target: [-0.5, 1.25, 2.2], fov: 0.82 },
      // past Rookie's shoulder to Victor in his chair, the windows behind him
      office_desk: { pos: [0.75, 1.65, -1.6], target: [-0.1, 1.15, 2.4], fov: 0.66 },
    },
    event(name) { console.warn(`[office] unknown event ${name}`) }, update() {},
    adopt(meshes, materials) { for (const m of meshes) lit.castActorShadow(m); lit.raiseLightLimit(materials) },
    dispose() { lit.dispose(); s.dispose() },
  }
}
export default build
