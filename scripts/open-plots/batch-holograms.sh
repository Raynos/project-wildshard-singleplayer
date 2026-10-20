#!/usr/bin/env bash
# Open-plot holograms, the G545 recipe (piloted on Ember Forge, 2026-10-20; open-plots-mini-plan P4).
#   bash scripts/open-plots/batch-holograms.sh <idea> [<idea> ...]
# Input: art/grid/round-30-hologram-refs/<idea>.jpg (or tmp/open-plots/refs/<idea>.png when present), one object on a
# plain light background. Per idea: BiRefNet cutout -> Hunyuan3D-2 FULL shape (30 steps, octree 512, no paint) ->
# holo_post.py (8k tris, 12 m, pivot base centre, front +Z) -> meshopt GLB at public/assets/open-plots/<idea>/hologram.glb.
# Every model call runs under the shared local-model lock (localai run-locked.sh), in batches of 7 so a hold stays
# under ~30 min. SEED overrides the shape seed (a regenerate), TRIS the triangle budget.
set -uo pipefail
R=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
L=$HOME/projects/localai/bin/img2mesh
W=$R/tmp/open-plots/batch
GT=$R/node_modules/.bin/gltf-transform
TRIS=${TRIS:-8000}
SEED=${SEED:-42}
mkdir -p "$W/in" "$W/cut" "$W/hy" "$W/glb" "$W/logs"
IN=()
for id in "$@"; do
  src="$R/tmp/open-plots/refs/$id.png"; [ -f "$src" ] || src="$R/art/grid/round-30-hologram-refs/$id.jpg"
  [ -f "$src" ] || { echo "[holo] NO REFERENCE $id"; continue; }
  magick "$src" "$W/in/$id.png"; IN+=("$W/in/$id.png")
done
(( ${#IN[@]} > 0 )) || exit 1
"$L/run-locked.sh" "$W/logs/cutout.log" "$HOME/ml/img2mesh/trellis-mac/.venv/bin/python" \
  "$L/cutout.py" --out "$W/cut" "${IN[@]}"
CUT=(); for f in "${IN[@]}"; do CUT+=("$W/cut/$(basename "$f")"); done
for ((i = 0; i < ${#CUT[@]}; i += 7)); do
  "$L/run-locked.sh" "$W/logs/hy-$SEED-$i.log" "$HOME/ml/img2mesh/Hunyuan3D-2/.venv/bin/python" \
    "$L/hy3d_batch.py" --out "$W/hy" --shape full --octree 512 --no-paint --faces 400000 --seed "$SEED" "${CUT[@]:i:7}"
done
for f in "${CUT[@]}"; do
  s=$(basename "$f" .png)
  [[ -s "$W/hy/$s.shape.glb" ]] || { echo "[holo] MISSING $s"; continue; }
  blender -b --factory-startup -noaudio --python-exit-code 1 -P "$R/scripts/open-plots/holo_post.py" -- \
    --in "$W/hy/$s.shape.glb" --out "$W/glb/$s.raw.glb" --tris "$TRIS" --height 12 --yaw 0 \
    2>&1 | grep -E '^\[holo\]|Error'
  mkdir -p "$R/public/assets/open-plots/$s"
  "$GT" optimize "$W/glb/$s.raw.glb" "$R/public/assets/open-plots/$s/hologram.glb" --compress meshopt --simplify false --instance false >/dev/null \
    && echo "[holo] DONE $s $(stat -f %z "$R/public/assets/open-plots/$s/hologram.glb") bytes"
done
