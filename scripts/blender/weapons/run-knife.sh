#!/usr/bin/env bash
# run-knife.sh — Pine Hollow's first-person skinning knife in a gloved hand, Blender → the game, end to end.
#   bash scripts/blender/weapons/run-knife.sh [--lod=hi,lo] [--bake=2048] [--samples=48] [--preview] [--no-copy]
#
#   1. skinning_knife.py (Blender 5.2, headless, Cycles on the Metal GPU) → $KNIFE_BUILD/{hi,lo}/ (default
#      ~/.cache/wildshard-blender/weapons/knife-build) under the machine-wide model lock (~/projects/localai/.model.lock).
#      hi: ≤ 3.5 k tris, 1024² atlas (desktop) · lo: ≤ 1.8 k tris, 512² atlas (phone) — one mesh `knife_hand`, one
#      material, each LOD baked on its own UVs. ~1 min per LOD.
#   2. meshopt (gltf-transform; the WebP textures ride along, EXT_texture_webp) → public/assets/pine-hollow/weapons/
#      skinning-knife.glb (desktop) + skinning-knife.phone.glb, plus the sidecar skinning-knife.json (bladeTip, edgeMid,
#      gripCentre, wristCentre, bbox — game frame, metres); with --preview the desktop render sheet goes to
#      art/pine-hollow/round-16-knife/sheet.jpg.
# The walnut is Poly Haven's walnut_veneer_02 (CC0 1.0), the rifle's, fetched once into ~/.cache/wildshard-blender/weapons-src/.
# The rifle's run.sh is untouched.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BUILD="${KNIFE_BUILD:-$HOME/.cache/wildshard-blender/weapons/knife-build}"
SRC="$HOME/.cache/wildshard-blender/weapons-src"
DEST=public/assets/pine-hollow/weapons
ART=art/pine-hollow/round-16-knife
BLENDER="${BLENDER:-$(command -v blender || echo /opt/homebrew/bin/blender)}"
COPY=1
PASS=()
for a in "$@"; do
  case "$a" in
    --no-copy) COPY=0 ;;
    *) PASS+=("$a") ;;
  esac
done
mkdir -p "$BUILD" "$SRC"
WOOD="$SRC/walnut_veneer_02_diff_2k.jpg"
[ -s "$WOOD" ] || curl -sfL -o "$WOOD" https://dl.polyhaven.org/file/ph-assets/Textures/jpg/2k/walnut_veneer_02/walnut_veneer_02_diff_2k.jpg
lockf -k "$HOME/projects/localai/.model.lock" "$BLENDER" -b --factory-startup -P scripts/blender/weapons/skinning_knife.py -- "$BUILD" "--wood=$WOOD" ${PASS[@]+"${PASS[@]}"} 2>&1 \
  | grep -E '^\[knife|Error|Traceback|  File|Exception' || true
[ "$COPY" = 1 ] || exit 0

mkdir -p "$DEST"
for lod in hi lo; do
  test -s "$BUILD/$lod/skinning-knife.glb" || { echo "run-knife.sh: no $lod/skinning-knife.glb" >&2; exit 1; }
done
pnpm exec gltf-transform meshopt "$BUILD/hi/skinning-knife.glb" "$DEST/skinning-knife.glb" --level medium >/dev/null
pnpm exec gltf-transform meshopt "$BUILD/lo/skinning-knife.glb" "$DEST/skinning-knife.phone.glb" --level medium >/dev/null
# the sidecar: the desktop LOD's numbers (the points are the same on both tiers) + the phone's triangle count
python3 -c 'import json,sys; hi=json.load(open(sys.argv[1])); lo=json.load(open(sys.argv[2])); hi["phoneTris"]=lo["tris"]; json.dump(hi, open(sys.argv[3], "w"), indent=1)' \
  "$BUILD/hi/skinning-knife.json" "$BUILD/lo/skinning-knife.json" "$DEST/skinning-knife.json"
if [ -s "$BUILD/hi/sheet.jpg" ]; then
  mkdir -p "$ART"
  cp "$BUILD/hi/sheet.jpg" "$ART/sheet.jpg"
fi
ls -la "$DEST"/skinning-knife*
