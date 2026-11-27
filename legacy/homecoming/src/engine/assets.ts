import type { WebGLRenderer } from 'three'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'

// Asset pipeline for production art. Blender exports → `scripts/optimize-glb.sh`
// (meshopt geometry + KTX2/Basis textures) → loaded here per scene. Until the
// rigged models exist, characters/environments use procedural placeholders
// (src/three), but the loader is configured and ready.

let gltf: GLTFLoader | null = null

export function getGltfLoader(renderer: WebGLRenderer) {
  if (gltf) return gltf
  const draco = new DRACOLoader().setDecoderPath('/decoders/')
  const ktx2 = new KTX2Loader().setTranscoderPath('/decoders/').detectSupport(renderer)
  gltf = new GLTFLoader().setDRACOLoader(draco).setKTX2Loader(ktx2).setMeshoptDecoder(MeshoptDecoder)
  return gltf
}
