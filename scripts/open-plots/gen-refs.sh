#!/usr/bin/env bash
# Open-plot hologram references for image-to-3D (G542/G545, open-plots-mini-plan P3).
#   bash scripts/open-plots/gen-refs.sh <idea> [<idea> ...]
# One codex image_gen call per idea (at most 7 at once): a single object on a plain light background, the landmark
# taken from the idea's billboard. Writes tmp/open-plots/refs/<idea>.png (the model input) and the committed
# art/grid/round-30-hologram-refs/<idea>.jpg. Descriptions live in scripts/open-plots/holo-subjects.tsv.
set -uo pipefail
R=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
D=$R/art/grid/round-30-hologram-refs
T=$R/tmp/open-plots/refs
mkdir -p "$D" "$T"
run() {
  id=$1; desc=$2; art="$R/art/grid/round-27-billboards/$id.jpg"
  [ -f "$art" ] || art="$R/public/assets/grid/open-plot/$id.webp"
  [ -f "$art" ] || { echo "FAILED $id (no billboard)"; return; }
  prompt="Look at the attached billboard artwork only for WHAT this world's signature landmark looks like and its palette. Create a NEW image: a single 3D game asset reference for an image-to-3D model generator, $desc. Plain very light warm-grey seamless studio background, nothing else in the frame: no ground plane, no grass, no water around it, no scenery, no sky, no text, no border, no second object. Soft even front lighting, no strong cast shadows, no dramatic rim light, no fog, no glow halos. The object is centred and fills about 80 percent of the square frame with a small margin on every side. Chunky, clearly readable stylised forms with solid volumes; avoid thin wires, ropes, flags and spindly parts that cannot be modelled; every part is attached to the main body, and any thin part (chain, rail, mast, crane arm) stands clear of the body with plain background visible around it, never overlapping another part. Stylised game-asset rendering as a turnaround-sheet single view. Square 1:1 image.
TASK FOR CODEX: generate exactly one image with your built-in image_gen tool, then copy the PNG path that YOUR image_gen call reported (other runs are writing to ~/.codex/generated_images at the same time, so never pick 'the newest file') to $T/$id.png. Do not read or edit any other file."
  gtimeout 1500 codex exec -s workspace-write --skip-git-repo-check -C "$R" --add-dir "$HOME/.codex/generated_images" \
    -i "$art" -o "$T/$id.last.txt" "$prompt" > "$T/$id.log" 2>&1
  if [ -f "$T/$id.png" ]; then
    magick "$T/$id.png" -resize '1024x1024>' -strip -quality 78 "$D/$id.jpg" && echo "done $id"
  else echo "FAILED $id"; fi
}
n=0
for id in "$@"; do
  desc=$(awk -F'\t' -v id="$id" '$1 == id { print $2 }' "$R/scripts/open-plots/holo-subjects.tsv")
  [ -n "$desc" ] || { echo "FAILED $id (no subject row)"; continue; }
  run "$id" "$desc" &
  n=$((n + 1)); if (( n % 7 == 0 )); then wait; fi
done
wait
