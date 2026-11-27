// Phone-sized variants of the heaviest runtime files, the way mobile games
// ship a lower-resolution texture set for phones (src/game/assets/urls.ts
// picks them by device tier):
//
//   public/assets/models/mobile/<name>.glb    character models: colour maps at
//     most 1024 px, normal maps at most 512 px. A 2048² colour map is ~21 MB of
//     GPU memory once decoded; on a phone screen it can't show more detail
//     than 1024. The character kit (extras, guards) gets 512 px throughout.
//   public/assets/textures/environment/512/   set surfaces at 512 px, for the
//     'lite' tier (each 1024² map is ~5.3 MB of GPU memory).
//
// Geometry and animation are untouched. Run after the character or texture
// pipelines rebuild their files:
//
//   node scripts/make-mobile-assets.mjs

import { mkdirSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const MODELS = 'public/assets/models'
const OUT_MODELS = join(MODELS, 'mobile')
/** Longest side per model: [colour and other maps, normal maps]. */
const SIZES = {
  character_kit: [512, 512],
  rookie: [1024, 512],
  alex: [1024, 512],
  don: [1024, 512],
  victor: [1024, 512],
  lucas: [1024, 512],
}
const SURFACES = 'public/assets/textures/environment'
const SURFACE_SIZE = 512

await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })
const kb = (n) => `${Math.round(n / 1024)} KB`
const gpuMB = (w, h) => (w * h * 4 * 1.33) / 1048576

mkdirSync(OUT_MODELS, { recursive: true })
for (const [name, [colour, normal]] of Object.entries(SIZES)) {
  const src = join(MODELS, `${name}.glb`)
  const doc = await io.read(src)
  const normals = new Set(doc.getRoot().listMaterials().map((m) => m.getNormalTexture()).filter(Boolean))
  let before = 0
  let after = 0
  for (const tex of doc.getRoot().listTextures()) {
    const [w, h] = tex.getSize() ?? [0, 0]
    before += gpuMB(w, h)
    const max = normals.has(tex) ? normal : colour
    if (Math.max(w, h) <= max) {
      after += gpuMB(w, h)
      continue
    }
    const scale = max / Math.max(w, h)
    const [nw, nh] = [Math.round(w * scale), Math.round(h * scale)]
    // normal maps hold vectors, not colours: a higher quality setting keeps them smooth
    const image = await sharp(tex.getImage()).resize(nw, nh, { kernel: 'lanczos3' }).webp(normals.has(tex) ? { quality: 92 } : { quality: 88 }).toBuffer()
    tex.setImage(new Uint8Array(image)).setMimeType('image/webp')
    after += gpuMB(nw, nh)
  }
  const out = join(OUT_MODELS, `${name}.glb`)
  await io.write(out, doc)
  console.log(`${name}: ${kb(statSync(src).size)} → ${kb(statSync(out).size)} on disk, ~${before.toFixed(1)} → ${after.toFixed(1)} MB of GPU textures`)
}

const outSurfaces = join(SURFACES, String(SURFACE_SIZE))
mkdirSync(outSurfaces, { recursive: true })
for (const file of readdirSync(SURFACES).filter((f) => /_(albedo|normal|arm)\.webp$/.test(f))) {
  const isNormal = file.includes('_normal')
  await sharp(join(SURFACES, file))
    .resize(SURFACE_SIZE, SURFACE_SIZE, { kernel: 'lanczos3' })
    .webp(isNormal ? { quality: 92 } : { quality: 88 })
    .toFile(join(outSurfaces, file))
}
console.log(`surfaces: ${SURFACE_SIZE} px copies in ${outSurfaces}`)
