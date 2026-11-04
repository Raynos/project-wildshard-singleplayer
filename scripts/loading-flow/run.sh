#!/usr/bin/env bash
# DL23 (E529, G1006, G1008): the loading flow recording on the iPhone Simulator, for each shard named: cold then warm on
# the default level download (Shardfile), then the same pair on Runtime packs (DL16's gate; --no-packs skips it). Each
# run plays 30 s after control: 10 s on foot with a slow look, then the hoverboard at boost.
# Run after every boot / download / loading landing and each deploy; a row touching loading closes on a passing run.
#   scripts/loading-flow/run.sh [--base <url>] [--out <dir>] [--no-packs] <shard regex>...   e.g. run.sh driftwood pine nine
# Default base: live. Each run: <out>/<shard>/<shardfile|packs>/{cold,warm}-timeline.jsonl, -raw.mp4, timeline.json (the
# bar's verdicts, seconds after the tap) and board.jpg (labelled, iPhone portrait). Keep boards in art/download/dl23-flow/.
set -euo pipefail
cd "$(dirname "$0")/../.."
base=https://wildshard-singleplayer.vercel.app
out="tmp/loading-flow/$(date +%Y%m%d-%H%M)"
downloads=(shardfile packs)
shards=()
while [ "$#" -gt 0 ]; do
  case "$1" in
    --base) base="$2"; shift 2 ;;
    --out) out="$2"; shift 2 ;;
    --no-packs) downloads=(shardfile); shift ;;
    *) shards+=("$1"); shift ;;
  esac
done
[ "${#shards[@]}" -gt 0 ] || { echo 'usage: run.sh [--base <url>] [--out <dir>] [--no-packs] <shard regex>...' >&2; exit 2; }
status=0
for shard in "${shards[@]}"; do
  for download in "${downloads[@]}"; do
    dir="$out/$(printf '%s' "$shard" | tr -c 'a-zA-Z0-9-' '-')/$download"
    flag=''; [ "$download" = packs ] && flag='--packs'
    mkdir -p "$dir"
    scripts/sim-lane.sh run --max 15 wildshard-loading bash -c \
      "node scripts/loading-flow/drive.mjs cold --shard '$shard' --base '$base' --out '$dir' $flag && node scripts/loading-flow/drive.mjs warm --shard '$shard' --base '$base' --out '$dir' $flag" \
      || { echo "run.sh: $shard ($download) recording failed" >&2; status=1; continue; }
    node scripts/loading-flow/analyse.mjs "$dir" || status=1
    python3 -I scripts/loading-flow/board.py "$dir" || status=1
  done
done
exit "$status"
