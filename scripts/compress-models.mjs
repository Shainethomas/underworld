// Last step for every runtime GLB: meshopt compression (quantised, filtered
// vertex, index and animation streams) and WebP for any JPEG/PNG texture still
// embedded. Roughly halves character files and cuts set props to a quarter.
// The game decodes with the self-hosted decoder this script copies to
// public/assets/lib (see src/game/babylon/AssetLoader.ts), never a CDN.
//
// Quantisation uses one volume for the whole file. Per-mesh volumes would
// give every skinned piece its own inverse bind matrices, splitting a shared
// skin into one per piece (the character kit has 28 pieces on one skeleton)
// and each skin is a skeleton the engine updates every frame. Any skins left
// identical afterwards are merged back into one.
//
// Already-compressed files are skipped, so it is safe to run on everything:
//
//   node scripts/compress-models.mjs                 (every GLB under public/assets/models)
//   node scripts/compress-models.mjs <file.glb> ...
//
// Run it after any script that writes a GLB (build_character, build-animations,
// build_environment_props): those read the file back and need it uncompressed.
// Blender can't import meshopt either, so the uncompressed file is kept in
// art-source/models-uncompressed (same relative path) for tools like
// render_avatar.py.

import { copyFileSync, mkdirSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { meshopt, prune, textureCompress } from '@gltf-transform/functions'
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer'
import sharp from 'sharp'

const ROOT = 'public/assets/models'
const list = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? list(join(dir, n)) : n.endsWith('.glb') ? [join(dir, n)] : []))
const files = process.argv.length > 2 ? process.argv.slice(2) : list(ROOT)

mkdirSync('public/assets/lib', { recursive: true })
copyFileSync('node_modules/meshoptimizer/meshopt_decoder.cjs', 'public/assets/lib/meshopt_decoder.js')

await MeshoptEncoder.ready
await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder })

/** Points every skinned node at the first of any identical skins; returns how many were merged. */
function mergeSkins(doc) {
  const seen = new Map()
  let merged = 0
  for (const skin of doc.getRoot().listSkins()) {
    const ibm = skin.getInverseBindMatrices()?.getArray()
    const key = skin.listJoints().map((j) => j.getName()).join(',') + '|' + (ibm ? Array.from(ibm, (v) => v.toFixed(5)).join(',') : '')
    const keep = seen.get(key)
    if (!keep) {
      seen.set(key, skin)
      continue
    }
    for (const node of doc.getRoot().listNodes()) if (node.getSkin() === skin) node.setSkin(keep)
    skin.dispose()
    merged++
  }
  return merged
}

for (const file of files) {
  const before = statSync(file).size
  const doc = await io.read(file)
  if (doc.getRoot().listExtensionsUsed().some((e) => e.extensionName === 'EXT_meshopt_compression')) {
    console.log(`${file}: already compressed`)
    continue
  }
  const keep = join('art-source/models-uncompressed', relative(ROOT, file))
  mkdirSync(dirname(keep), { recursive: true })
  copyFileSync(file, keep)
  const skins = doc.getRoot().listSkins().length
  await doc.transform(
    textureCompress({ encoder: sharp, targetFormat: 'webp', formats: /jpeg|png/, quality: 82 }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizationVolume: 'scene' }),
  )
  mergeSkins(doc)
  await doc.transform(prune())
  const after = doc.getRoot().listSkins().length
  if (after !== skins) throw new Error(`${file}: ${skins} skins became ${after}; not writing it`)
  await io.write(file, doc)
  console.log(`${file}: ${before >> 10} kB → ${statSync(file).size >> 10} kB`)
}
