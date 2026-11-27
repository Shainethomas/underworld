// Final look of a character's textures, after the Blender build: resizes the
// maps with a Lanczos filter (much sharper than Blender's own downscale), and
// can lift the colour map's saturation and sharpen it. Characters not listed
// pass through unchanged.
//
//   node scripts/grade-character.mjs <file.glb>

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import sharp from 'sharp'

/** Per character: colour map size, normal map size, saturation (1 = as made), sharpen sigma (0 = none). */
const GRADE = {
  // the protagonist gets close-ups: a 2K colour map, a little crisper and richer than the generator's
  rookie: { color: 2048, normal: 1024, saturation: 1.18, sharpen: 0.7 },
}

const file = process.argv[2]
if (!file) throw new Error('usage: node scripts/grade-character.mjs <file.glb>')
const grade = GRADE[file.split('/').pop().replace(/\.glb$/, '')]
if (!grade) process.exit(0)

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(file)
const colorMaps = new Set()
const normalMaps = new Set()
for (const m of doc.getRoot().listMaterials()) {
  if (m.getBaseColorTexture()) colorMaps.add(m.getBaseColorTexture())
  if (m.getNormalTexture()) normalMaps.add(m.getNormalTexture())
}
for (const tex of doc.getRoot().listTextures()) {
  const isColor = colorMaps.has(tex)
  const size = isColor ? grade.color : normalMaps.has(tex) ? grade.normal : null
  if (!size) continue
  let img = sharp(Buffer.from(tex.getImage())).resize(size, size, { kernel: 'lanczos3', fit: 'fill' })
  if (isColor && grade.saturation !== 1) img = img.modulate({ saturation: grade.saturation })
  if (isColor && grade.sharpen) img = img.sharpen({ sigma: grade.sharpen })
  const out = await img.webp({ quality: isColor ? 92 : 95 }).toBuffer()
  const before = (await sharp(Buffer.from(tex.getImage())).metadata()).width
  tex.setImage(new Uint8Array(out)).setMimeType('image/webp')
  console.log(`${file}: ${isColor ? 'colour' : 'normal'} map ${before} → ${size}${isColor ? `, saturation ×${grade.saturation}, sharpen ${grade.sharpen}` : ''} (${(out.length / 1024).toFixed(0)} KB)`)
}
await io.write(file, doc)
