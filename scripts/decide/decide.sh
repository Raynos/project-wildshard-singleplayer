#!/usr/bin/env bash
# decide.sh — run scripts/decide/decide.py in its venv under the machine-wide model lock (E394).
#
#   scripts/decide/decide.sh run   <set> [--image a.jpg …] [--state TEXT | --state-file F]
#   scripts/decide/decide.sh batch <set> --images <list.txt | dir> [--out results.jsonl]
#
# Prints one JSON line per item. The model is Clef-flash 4-bit (MLX, ~6 GB):
# ~/projects/weights/manual/mlx-community/clef-flash-4bit. The venv is ~/ml/decide/.venv (mlx-vlm 0.7.4, the version
# clef_mlx.py was tested with). Setup, speed and traps: ~/projects/localai/docs/decision-models.md. The lock may
# queue this behind music / SFX / 3D jobs: put many items in one batch instead of one call per image.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
py="$HOME/ml/decide/.venv/bin/python"
[ -x "$py" ] || { echo "decide: no venv at ~/ml/decide/.venv (see ~/projects/localai/docs/decision-models.md)" >&2; exit 2; }
runs="$HOME/.cache/wildshard-decide/runs"; mkdir -p "$runs"
id="$(date +%Y%m%d-%H%M%S)-$$"
# run-locked.sh sends the command's stdout and stderr to the log, so the answers come back through DECIDE_OUT
export DECIDE_OUT="$runs/$id.jsonl"
if ! "$HOME/ml/imagegen/run-locked.sh" "$runs/$id.log" "$py" "$here/decide.py" "$@"; then
  echo "decide: failed, see $runs/$id.log" >&2; exit 1
fi
cat "$DECIDE_OUT"
