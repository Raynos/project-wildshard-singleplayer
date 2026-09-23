#!/bin/bash
# Driftwood hero props: TRELLIS.2 generations (~/ml/img2mesh/out/driftwood/<ref>.glb) -> faceted game assets in
# public/assets/models/driftwood-hero/<asset>/<asset>.glb (+ .tex.glb with a WebP atlas where listed) + <asset>.json.
#   bash scripts/img2mesh/build_driftwood.sh            # every prop
#   bash scripts/img2mesh/build_driftwood.sh hut wreck  # just these refs
# Step 1 (scripts/img2mesh/driftwood_post.py, Blender) writes to a staging folder; step 2 meshopt-compresses the glbs
# into the repo with gltf-transform (EXT_meshopt_compression + quantization: the loader needs setMeshoptDecoder).
set -euo pipefail
REPO=$(cd "$(dirname "$0")/../.." && pwd)
GEN=${GEN:-$HOME/ml/img2mesh/out/driftwood}
STAGE=${STAGE:-$HOME/ml/img2mesh/out/driftwood-post}
DEST=$REPO/public/assets/models/driftwood-hero
BLENDER=${BLENDER:-/opt/homebrew/bin/blender}
mkdir -p "$STAGE" "$DEST"

# ref | driftwood_post.py args (sizes in metres; --tris is the per-asset triangle budget)
PROPS=$(cat <<'EOF'
palm-a    --name palm-a --tris 2000 --fit height --size 9.0 --atlas 256 --quant 12
palm-b    --name palm-b --tris 2000 --fit height --size 7.5 --atlas 256 --quant 12
palm-c    --name palm-c --tris 1600 --fit height --size 3.4 --atlas 256 --quant 12
boulders  --name boulder --split --names boulder-round,boulder-slab,boulder-wedge,boulder-small-a,boulder-small-b --tris 600,420,520,260,220 --fit height --size 1.7 --quant 6 --simplifier blender
driftwood --name driftwood --split --names driftwood-log,driftwood-fork,driftwood-branch,driftwood-stump --tris 420,520,380,520 --fit length --size 3.6 --quant 6 --simplifier blender
piling    --name piling --tris 700 --fit height --size 2.6 --atlas 256 --quant 8 --remesh 0.008 --simplifier blender
sailboat  --name sailboat --tris 2600 --fit length --size 6.5 --atlas 512 --quant 12 --remesh 0.007 --simplifier blender
hut       --name hut --tris 3000 --fit height --size 5.6 --atlas 512 --quant 14 --simplifier blender
wreck     --name wreck --tris 3000 --fit length --size 14 --atlas 512 --quant 12 --simplifier blender
shrine    --name shrine --tris 2200 --fit height --size 5.5 --atlas 512 --quant 12 --simplifier blender
conch     --name shell-conch --tris 240 --fit length --size 0.22 --quant 6
scallop   --name shell-scallop --tris 200 --fit length --size 0.16 --quant 6
cowrie    --name shell-cowrie --tris 140 --fit length --size 0.09 --quant 5
starfish-a --name starfish-a --tris 220 --fit length --size 0.26 --quant 5
starfish-b --name starfish-b --tris 220 --fit length --size 0.22 --quant 5
coconut-half --name coconut-half --tris 180 --fit length --size 0.2 --quant 5
coconut   --name coconut --tris 160 --fit length --size 0.24 --quant 5
coconut-cluster --name coconut-cluster --tris 360 --fit length --size 0.6 --quant 6
frond-a   --name frond-a --tris 420 --fit length --size 4.2 --quant 6
frond-b   --name frond-b --tris 420 --fit length --size 3.6 --quant 6
EOF
)

want() { [ $# -le 1 ] && return 0; for w in "${@:2}"; do [ "$w" = "$1" ] && return 0; done; return 1; }
while read -r ref args; do
  [ -z "$ref" ] && continue
  want "$ref" ${1+"$@"} || continue
  [ -f "$GEN/$ref.glb" ] || { echo "skip $ref: no $GEN/$ref.glb"; continue; }
  # shellcheck disable=SC2086
  "$BLENDER" -b -P "$REPO/scripts/img2mesh/driftwood_post.py" -- --in "$GEN/$ref.glb" --out "$STAGE" $args 2>&1 \
    | grep -E '^DRIFTWOOD_POST|Error|Traceback' || true
done <<< "$PROPS"

# meshopt every staged asset of this run into the repo
for d in "$STAGE"/*/; do
  a=$(basename "$d")
  [ -f "$d/$a.json" ] || continue
  if [ $# -gt 0 ]; then src=$(grep -o '"source": "[^"]*"' "$d/$a.json" | sed 's/.*: "\(.*\)\.glb"/\1/'); want "$src" "$@" || continue; fi
  mkdir -p "$DEST/$a"
  for g in "$d"/*.glb; do
    npx --prefix "$REPO" gltf-transform meshopt "$g" "$DEST/$a/$(basename "$g")" --level medium > /dev/null
  done
  cp "$d/$a.json" "$DEST/$a/$a.json"
  printf '%-22s %6s tris  %s\n' "$a" "$(grep -o '"tris": [0-9]*' "$d/$a.json" | grep -o '[0-9]*')" \
    "$(cd "$DEST/$a" && stat -f '%N %z B' ./*.glb | tr '\n' ' ')"
done
