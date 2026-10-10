#!/usr/bin/env bash
# qwen-repaint.sh — repaint chosen frames of a PNG sequence with LOCAL Qwen-Image-2.1 edit + the 6-step turbo LoRA
# (TRAILERS CT1 #5 / #6, E466). Image-to-image only: each frame is the first condition image; an optional style
# still rides along as the second. Same seed for every frame. Runs under the machine-wide model lock in batches of
# --budget-min (lock etiquette) and loops until every frame exists, so other model queues get turns in between.
#
#   qwen-repaint.sh --in <dir of %04d.png> --out <dir> --prompt-file <p.txt> --frames "1 11 21 ..." \
#                   [--style <still.png>] [--seed 42] [--res 949] [--budget-min 20]
#
#   --frames   frame numbers to repaint (default: every frame in --in)
#   --res      side of the ~res² pixel budget; 949 gives exactly 1280×704 for a 1280×704 input
# Output: <out>/<nnnn>.png (+ <nnnn>.json timings). Setup: ~/projects/localai/docs/image-models.md.
set -euo pipefail
IG="$HOME/ml/imagegen"
in=""; out=""; prompt=""; frames=""; style=""; seed=42; res=949; budget=20
while [ $# -gt 0 ]; do
  case "$1" in
    --in) in="$(cd "$2" && pwd)"; shift 2 ;;
    --out) mkdir -p "$2"; out="$(cd "$2" && pwd)"; shift 2 ;;
    --prompt-file) prompt="$2"; shift 2 ;;
    --frames) frames="$2"; shift 2 ;;
    --style) style="$(cd "$(dirname "$2")" && pwd)/$(basename "$2")"; shift 2 ;;
    --seed) seed="$2"; shift 2 ;;
    --res) res="$2"; shift 2 ;;
    --budget-min) budget="$2"; shift 2 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "qwen-repaint: unknown arg $1" >&2; exit 2 ;;
  esac
done
[ -n "$in" ] && [ -n "$out" ] && [ -n "$prompt" ] || { sed -n '2,13p' "$0"; exit 2; }
if [ -z "$frames" ]; then frames="$(ls "$in" | sed -n 's/^0*\([0-9][0-9]*\)\.png$/\1/p' | tr '\n' ' ')"; fi
size="$(sips -g pixelWidth -g pixelHeight "$in/0001.png" | awk '/pixelWidth/{w=$2} /pixelHeight/{h=$2} END{print w "," h}')"
jobs="$out/jobs.json"
for f in $frames; do
  id="$(printf %04d "$f")"
  if [ -n "$style" ]; then inputs="[\"$in/$id.png\",\"$style\"]"; else inputs="[\"$in/$id.png\"]"; fi
  jq -n --rawfile p "$prompt" --arg id "$id" --argjson inputs "$inputs" --argjson size "[$size]" \
    '{id: $id, prompt: $p, inputs: $inputs, size: $size}'
done | jq -s . > "$jobs"
want="$(jq length "$jobs")"
for pass in 1 2 3 4 5 6 7 8; do
  have=0
  for id in $(jq -r '.[].id' "$jobs"); do if [ -f "$out/$id.png" ]; then have=$((have + 1)); fi; done
  [ "$have" -ge "$want" ] && break
  echo "qwen-repaint: pass $pass, $have / $want done"
  "$IG/run-locked.sh" "$out/log.txt" "$IG/.venv/bin/python" "$IG/gen_qwen21.py" --jobs "$jobs" --repo / --out "$out" \
    --res "$res" --seed "$seed" --vae-fp32 --kv auto --turbo --budget-min "$budget" || true
done
black="$(cat "$out"/[0-9]*.json 2>/dev/null | jq -s '[.[] | select(.black)] | length')"
echo "qwen-repaint: $(ls "$out" | grep -c '^[0-9]*\.png$') frames in $out, black: $black"
