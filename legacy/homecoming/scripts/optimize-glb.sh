#!/usr/bin/env bash
# Compress a Blender GLB export for mobile: meshopt geometry, KTX2 (Basis)
# textures, deduped + pruned. Loaded at runtime by src/engine/assets.ts.
#   usage: scripts/optimize-glb.sh art/rookie.glb public/assets/models/rookie.glb
set -euo pipefail
in="$1"; out="$2"
mkdir -p "$(dirname "$out")"
npx --yes @gltf-transform/cli optimize "$in" "$out" \
  --compress meshopt \
  --texture-compress ktx2 \
  --texture-size 1024 \
  --simplify false
ls -lh "$out"
