#!/usr/bin/env bash
# run.sh — Pine Hollow's lever-action carbine (PINE-HOLLOW-REMASTER PH-C11), Blender → the game, end to end.
#   bash scripts/blender/weapons/run.sh [--lod=hi,lo] [--bake=2048] [--samples=48] [--preview] [--no-copy]
#
#   1. lever_rifle.py (Blender 5.2, headless, Cycles on the Metal GPU) → ~/.cache/wildshard-blender/weapons/build/{hi,lo}/
#      under the machine-wide model lock (~/projects/localai/.model.lock): it waits for a running model job. ~2 min.
#      hi: ≈ 8 k tris, 1024² atlases (desktop) · lo: ≈ 4 k tris, 512² atlases (phone) — each baked on its own UVs
#   2. meshopt (gltf-transform; the WebP textures ride along, EXT_texture_webp) → public/assets/pine-hollow/weapons/
#      lever-rifle.glb (desktop) + lever-rifle.phone.glb (tierUrl picks it on the phone tier)
# The walnut is Poly Haven's walnut_veneer_02 (CC0 1.0), fetched once into ~/.cache/wildshard-blender/weapons-src/.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
BUILD="${RIFLE_BUILD:-$HOME/.cache/wildshard-blender/weapons/build}"
SRC="$HOME/.cache/wildshard-blender/weapons-src"
DEST=public/assets/pine-hollow/weapons
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
lockf -k "$HOME/projects/localai/.model.lock" "$BLENDER" -b --factory-startup -P scripts/blender/weapons/lever_rifle.py -- "$BUILD" "--wood=$WOOD" ${PASS[@]+"${PASS[@]}"} 2>&1 \
  | grep -E '^\[rifle|Error|Traceback|  File|Exception' || true
[ "$COPY" = 1 ] || exit 0

mkdir -p "$DEST"
for lod in hi lo; do
  test -s "$BUILD/$lod/lever-rifle.glb" || { echo "run.sh: no $lod/lever-rifle.glb" >&2; exit 1; }
done
# meshopt: quantised + filtered streams (three's GLTFLoader decodes it with MeshoptDecoder; LeverRifle.ts undoes the
# quantisation into plain float geometry)
pnpm exec gltf-transform meshopt "$BUILD/hi/lever-rifle.glb" "$DEST/lever-rifle.glb" --level medium >/dev/null
pnpm exec gltf-transform meshopt "$BUILD/lo/lever-rifle.glb" "$DEST/lever-rifle.phone.glb" --level medium >/dev/null
cp "$BUILD/hi/stats.json" "$BUILD/stats-hi.json"; cp "$BUILD/lo/stats.json" "$BUILD/stats-lo.json"
ls -la "$DEST"
