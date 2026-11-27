// Slims the animation data in a complete character GLB (written by
// scripts/blender/build_character.py): the Blender exporter keys translation,
// rotation and scale on every bone. Only the hips move, and no bone scales, so
// everything else is dropped; rotations are stored as normalised int16, as in
// scripts/build-animations.mjs.
//
//   node scripts/optimize-character.mjs <file>

import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { prune, resample } from '@gltf-transform/functions'

const FILE = process.argv[2]
if (!FILE) throw new Error('usage: node scripts/optimize-character.mjs <file.glb>')
const MOVES = new Set(['pelvis'])

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS)
const doc = await io.read(FILE)

let dropped = 0
for (const anim of doc.getRoot().listAnimations()) {
  for (const ch of anim.listChannels()) {
    const path = ch.getTargetPath()
    const bone = ch.getTargetNode()?.getName()
    if (path === 'scale' || (path === 'translation' && !MOVES.has(bone))) {
      const s = ch.getSampler()
      ch.dispose()
      if (!s.listParents().some((p) => p.propertyType === 'AnimationChannel')) s.dispose()
      dropped++
    }
  }
}

await doc.transform(resample({ tolerance: 5e-4 }), prune())

for (const anim of doc.getRoot().listAnimations()) {
  for (const ch of anim.listChannels()) {
    if (ch.getTargetPath() !== 'rotation') continue
    const out = ch.getSampler().getOutput()
    if (out.getComponentType() !== 5126) continue
    const src = out.getArray()
    const q = new Int16Array(src.length)
    for (let i = 0; i < src.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, src[i])) * 32767)
    out.setArray(q).setNormalized(true)
  }
}

await io.write(FILE, doc)
console.log(`${FILE}: dropped ${dropped} channels`)
