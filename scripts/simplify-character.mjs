// Brings a complete character GLB (scripts/blender/build_character.py) down to
// the phone triangle budget (ARCHITECTURE.md): about 10k triangles for a main
// character. meshoptimizer collapses edges onto existing vertices, so skin
// weights, UVs (seams kept together), normals and every animation stay valid.
// The full-detail builds are kept in art-source/models-full/.
//
//   node scripts/simplify-character.mjs <file.glb> [targetTriangles] [maxError=0.012]
//
// Without a target, the character's own budget below (by file name). Rookie
// (Roddy) was made at 8.3k, so his build passes through untouched. The Don
// and the bodyguards were reduced from 20k and 42k and look the same at 10k.

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { simplify, weld } from '@gltf-transform/functions'
import { MeshoptSimplifier } from 'meshoptimizer'

const BUDGET = { rookie: 9000, don: 10000, alex: 10000, victor: 10000, lucas: 9000 }
const [file, given, maxError = '0.012'] = process.argv.slice(2)
const target = given ?? BUDGET[file?.split('/').pop().replace(/\.glb$/, '')]
if (!file || !target) throw new Error('usage: node scripts/simplify-character.mjs <file.glb> [targetTriangles] [maxError]')

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(file)
const triangles = () => {
  let n = 0
  for (const m of doc.getRoot().listMeshes()) for (const p of m.listPrimitives()) n += (p.getIndices()?.getCount() ?? p.getAttribute('POSITION').getCount()) / 3
  return Math.round(n)
}

const before = triangles()
const ratio = Math.min(1, Number(target) / before)
await MeshoptSimplifier.ready
// weld first: vertices split only by a UV seam become one for the simplifier's
// purposes, so seams collapse together instead of tearing
await doc.transform(weld(), simplify({ simplifier: MeshoptSimplifier, ratio, error: Number(maxError), lockBorder: false }))
await io.write(file, doc)
console.log(`${file}: ${before} → ${triangles()} triangles (target ${target})`)
