#!/usr/bin/env bash
# Run one LTX-2.5 job (ltx_comfy.py) under the machine-wide model lock (TRAILERS CT1 #9 / #10, E466).
#
#   ltx-run.sh <logfile> layout|i2v <ltx_comfy.py args...>
#
# Setup (once): ComfyUI in ~/ml/video/ComfyUI with its own .venv, ComfyUI-LTXVideo symlinked into custom_nodes,
# the LTX-2.5 weights symlinked from ~/projects/weights/manual/Lightricks/ into its models/ folders, and the MPS
# patch for comfy-org/ComfyUI#15804 (torch.empty -> torch.zeros in sub_quadratic_attention.py, bf16 -> fp32 in
# force_upcast_attention_dtype). Peak memory lands in the log via /usr/bin/time -l ("peak memory footprint").
set -uo pipefail
LOG=${1:?usage: ltx-run.sh <logfile> layout|i2v <args...>}; shift
HERE=$(cd "$(dirname "$0")" && pwd)
LOCK="$HOME/projects/localai/.model.lock"
MEM="$HOME/projects/localai/bin/mem-gb.sh"
LIMIT_GB=${LIMIT_GB:-50}
PY="$HOME/ml/video/ComfyUI/.venv/bin/python"
export LOG MEM LIMIT_GB
exec lockf -k "$LOCK" bash -c '
  echo "=== $(date +%H:%M:%S) lock taken (ltx): $*" >> "$LOG"
  while :; do
    read -r anon wired free < <(bash "$MEM")
    awk -v a="$anon" -v l="$LIMIT_GB" "BEGIN{exit !(a<l)}" && break
    echo "$(date +%H:%M:%S) anon ${anon}G >= ${LIMIT_GB}G, waiting" >> "$LOG"; sleep 30
  done
  echo "$(date +%H:%M:%S) mem before (anon wired free GB): $(bash "$MEM")" >> "$LOG"
  "$@" >> "$LOG" 2>&1; rc=$?
  echo "=== $(date +%H:%M:%S) rc=$rc, lock released" >> "$LOG"
  exit $rc
' _ "$PY" "$HERE/ltx_comfy.py" "$@"
