#!/usr/bin/env bash
# knife-post.sh — build.sh's post step for pine-hollow/skinning-knife. build.sh has already meshopt'd both LODs into
# public/assets/pine-hollow/weapons/skinning-knife{,.phone}.glb.
#   - the sidecar skinning-knife.json: the desktop LOD's numbers (bladeTip, edgeMid, gripCentre, wristCentre, bbox — game
#     frame, metres; the same points on both tiers) + the phone's triangle count
#   - with --preview, the desktop render sheet → art/pine-hollow/round-16-knife/sheet.jpg
# Env from build.sh: BUILD.
set -euo pipefail
DEST=public/assets/pine-hollow/weapons
ART=art/pine-hollow/round-16-knife
python3 -c 'import json,sys; hi=json.load(open(sys.argv[1])); lo=json.load(open(sys.argv[2])); hi["phoneTris"]=lo["tris"]; json.dump(hi, open(sys.argv[3], "w"), indent=1)' \
  "$BUILD/hi/skinning-knife.json" "$BUILD/lo/skinning-knife.json" "$DEST/skinning-knife.json"
if [ -s "$BUILD/hi/sheet.jpg" ]; then
  mkdir -p "$ART"
  cp "$BUILD/hi/sheet.jpg" "$ART/sheet.jpg"
fi
