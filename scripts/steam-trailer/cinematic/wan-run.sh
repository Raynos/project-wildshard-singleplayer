#!/usr/bin/env bash
# wan-run.sh — run one LOCAL Wan generation (mlx-gen) under the machine-wide model lock (TRAILERS CT1 #7 / #8, E466).
#
#   wan-run.sh <log> <mlxgen args...>
#
# Examples (paths are the CT1 folders; weights from ~/projects/weights/manual via bin/fetch-repo.sh):
#   #7 Wan 2.2 TI2V-5B image-to-video from a keyframe, native 1280×704 @ 24 fps:
#     wan-run.sh run.log generate --model ~/projects/weights/manual/AbstractFramework/wan2.2-ti2v-5b-diffusers-8bit \
#       --image key.png --prompt "$(cat prompt.txt)" --width 1280 --height 704 --frames 121 --fps 24 \
#       --steps 25 --guidance 5 --seed 42 --low-ram --metadata --output out.mp4
#   #8 Wan 2.1 VACE 1.3B, depth video as control (no mask = all-white = control) + keyframe as reference:
#     wan-run.sh run.log generate --model ~/projects/weights/manual/Wan-AI/Wan2.1-VACE-1.3B-diffusers \
#       --video-path depth.mp4 --reference-image key.png --prompt "..." --width 832 --height 480 \
#       --frames 49 --fps 24 --steps 20 --guidance 5 --seed 42 --low-ram --metadata --output out.mp4
#     (a per-frame mask video is accepted too: frame 0 black + keyframe in the source = first-frame anchor; see
#      wan-vace-inputs.sh)
#
# Runtime: ~/ml/video/venv (mlx-gen 0.38.0 from github lpalbou/mlx-gen). Holds ~/projects/localai/.model.lock with
# lockf -k, waits until anonymous memory < LIMIT_GB (70), never evicts anyone. Peak RSS and wall time land in the log
# (/usr/bin/time -l). Offline: nothing downloads at run time.
set -uo pipefail
LOG=${1:?usage: wan-run.sh <log> <mlxgen args...>}; shift
LOCK="$HOME/projects/localai/.model.lock"
MEM="$HOME/projects/localai/bin/mem-gb.sh"
MLXGEN="$HOME/ml/video/venv/bin/mlxgen"
[ -x "$MLXGEN" ] || { echo "wan-run: $MLXGEN missing (uv venv ~/ml/video/venv; uv pip install mlx-gen)" >&2; exit 2; }
. "$HOME/projects/weights/env.sh"
export HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1
LIMIT_GB=${LIMIT_GB:-70}
export LOG MEM LIMIT_GB MLXGEN
mkdir -p "$(dirname "$LOG")"
echo "=== $(date +%H:%M:%S) waiting for model lock" >> "$LOG"
exec lockf -k "$LOCK" bash -c '
  echo "=== $(date +%H:%M:%S) lock taken (wan): $*" >> "$LOG"
  while :; do
    read -r anon wired free < <(bash "$MEM")
    awk -v a="$anon" -v l="$LIMIT_GB" "BEGIN{exit !(a<l)}" && break
    echo "$(date +%H:%M:%S) anon ${anon}G >= ${LIMIT_GB}G, waiting" >> "$LOG"; sleep 30
  done
  echo "$(date +%H:%M:%S) mem before (anon wired free GiB): $(bash "$MEM")" >> "$LOG"
  t0=$(date +%s)
  /usr/bin/time -l "$MLXGEN" "$@" >> "$LOG" 2>&1; rc=$?
  echo "=== $(date +%H:%M:%S) rc=$rc wall=$(( $(date +%s) - t0 ))s, lock released (no evict)" >> "$LOG"
  exit $rc
' _ "$@"
