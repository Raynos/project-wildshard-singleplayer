#!/usr/bin/env bash
# run.sh — PH-B2's Blender builds (PINE-HOLLOW-REMASTER): the Ridge's granite kit and the Den's bear cave.
#   bash scripts/blender/crags/run.sh [kit|cave|all] [--preview]
#
#   kit   build_crags.py → public/assets/models/pine-hollow-crags/crags.glb   (the modules src/world/PineCrags.ts places)
#   cave  export-cave.mjs (the baked heights round the mouth, the arch's pose) → build_cave.py
#         → public/assets/models/pine-hollow-crags/cave.glb                  (the interior + the hood over its first metres)
# Headless Blender (Cycles on the Metal GPU for the vertex AO / light bakes) under the machine-wide model lock, then meshopt.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
WHAT="${1:-all}"; shift || true
BLENDER="${BLENDER:-$(command -v blender || echo /opt/homebrew/bin/blender)}"
BUILD="${BLENDER_CACHE:-$HOME/.cache/wildshard-blender}/pine-hollow-crags"
DEST=public/assets/models/pine-hollow-crags
LOCK="$HOME/projects/localai/.model.lock"
mkdir -p "$BUILD" "$DEST"
blend() { lockf -k "$LOCK" "$BLENDER" -b --factory-startup -P "$@" 2>&1 | grep -E '^\[(crags|cave)|Error|Traceback|  File|Exception' || true; }

if [ "$WHAT" = kit ] || [ "$WHAT" = all ]; then
  blend scripts/blender/crags/build_crags.py -- "$BUILD" "$@"
  test -s "$BUILD/crags.glb" || { echo "run.sh: no crags.glb" >&2; exit 1; }
  pnpm exec gltf-transform meshopt "$BUILD/crags.glb" "$DEST/crags.glb" --level medium >/dev/null
  cp "$BUILD/crags.json" "$DEST/crags.json"
fi
if [ "$WHAT" = cave ] || [ "$WHAT" = all ]; then
  node --experimental-transform-types --no-warnings --import ./scripts/bake-loader.mjs scripts/blender/crags/export-cave.mjs "$BUILD/cave-in.json"
  blend scripts/blender/crags/build_cave.py -- "$BUILD/cave-in.json" "$BUILD" "$@"
  test -s "$BUILD/cave.glb" || { echo "run.sh: no cave.glb" >&2; exit 1; }
  pnpm exec gltf-transform meshopt "$BUILD/cave.glb" "$DEST/cave.glb" --level medium >/dev/null
  cp "$BUILD/cave.json" "$DEST/cave.json"
fi
ls -la "$DEST"
