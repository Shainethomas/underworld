// Packs the clips the game uses from the CC0 Quaternius Universal Animation
// Libraries into public/assets/models/animations.glb: skeleton + clips only,
// no mannequin mesh. Clips are retargeted at runtime by bone name
// (see src/game/characters/CharacterAssets.ts).
//
// Bone lengths differ slightly between the mannequin and the characters, so
// only the hips keep a translation track; scale tracks are constant and
// dropped. Rotations are stored as normalised int16, which core glTF allows
// for rotation outputs.
//
//   node scripts/build-animations.mjs

import { Document, NodeIO } from '@gltf-transform/core'
import { resample } from '@gltf-transform/functions'

const SRC = 'art-source/quaternius/anim'
const OUT = 'public/assets/models/animations.glb'

const KEEP = {
  'UAL1_Standard.glb': [
    'Idle_Loop', 'Idle_Talking_Loop', 'Walk_Loop', 'Walk_Formal_Loop', 'Jog_Fwd_Loop',
    'Punch_Jab', 'Punch_Cross', 'Hit_Chest', 'Hit_Head', 'Death01', 'Roll',
    'Sitting_Enter', 'Sitting_Idle_Loop', 'Sitting_Talking_Loop', 'Sitting_Exit', 'Interact',
    'Fixing_Kneeling', 'PickUp_Table', 'Spell_Simple_Idle_Loop', 'Crouch_Idle_Loop',
  ],
  'UAL2_Standard.glb': [
    'Idle_FoldArms_Loop', 'Melee_Hook', 'Melee_Hook_Rec', 'Hit_Knockback',
    'LayToIdle', 'Idle_Rail_Loop', 'Idle_Rail_Call', 'Idle_TalkingPhone_Loop', 'Consume',
  ],
}
const ROOT_MOTION = new Set(['root', 'pelvis'])

const io = new NodeIO()
const out = new Document()
const buffer = out.createBuffer()
const scene = out.createScene('Scene')
const nodes = new Map()

function copySkeleton(src) {
  const map = new Map()
  for (const n of src.getRoot().listNodes()) {
    if (n.getMesh() || n.getSkin()) continue
    const copy = out.createNode(n.getName()).setTranslation(n.getTranslation()).setRotation(n.getRotation()).setScale(n.getScale())
    map.set(n, copy)
    nodes.set(n.getName(), copy)
  }
  for (const [n, copy] of map) for (const child of n.listChildren()) if (map.has(child)) copy.addChild(map.get(child))
  for (const n of src.getRoot().listScenes()[0].listChildren()) if (map.has(n)) scene.addChild(map.get(n))
}

function accessor(type, array, normalized = false) {
  return out.createAccessor().setType(type).setArray(array).setNormalized(normalized).setBuffer(buffer)
}

function quantize(arr) {
  const q = new Int16Array(arr.length)
  for (let i = 0; i < arr.length; i++) q[i] = Math.round(Math.max(-1, Math.min(1, arr[i])) * 32767)
  return q
}

for (const [file, clips] of Object.entries(KEEP)) {
  const src = await io.read(`${SRC}/${file}`)
  if (!nodes.size) copySkeleton(src)
  for (const name of clips) {
    const anim = src.getRoot().listAnimations().find((a) => a.getName() === name)
    if (!anim) throw new Error(`${file}: missing clip ${name}`)
    const clip = out.createAnimation(name)
    for (const ch of anim.listChannels()) {
      const path = ch.getTargetPath()
      const bone = ch.getTargetNode()?.getName()
      const target = bone && nodes.get(bone)
      if (!target || path === 'scale' || (path === 'translation' && !ROOT_MOTION.has(bone))) continue
      const s = ch.getSampler()
      const output = s.getOutput().getArray()
      const sampler = out
        .createAnimationSampler()
        .setInterpolation(s.getInterpolation())
        .setInput(accessor('SCALAR', new Float32Array(s.getInput().getArray())))
        .setOutput(path === 'rotation' ? accessor('VEC4', quantize(output), true) : accessor('VEC3', new Float32Array(output)))
      clip.addSampler(sampler).addChannel(out.createAnimationChannel().setTargetNode(target).setTargetPath(path).setSampler(sampler))
    }
  }
}

await out.transform(resample({ tolerance: 5e-4 }))
await io.write(OUT, out)
const names = out.getRoot().listAnimations().map((a) => a.getName())
console.log(`wrote ${OUT}: ${names.length} clips, ${out.getRoot().listNodes().length} bones`)
