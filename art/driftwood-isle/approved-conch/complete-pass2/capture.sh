#!/usr/bin/env bash
# Run from repository root. One shared build lease per Blender invocation.
set -eu
export WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes" HOME="$PWD/tmp/home"
out=tmp/conch-complete-pass2
src=art/driftwood-isle/approved-conch/complete-pass2
mkdir -p "$out"
python3 scripts/heavy-lane.py build -- blender -b -t 2 --python-exit-code 1 -P "$src/build_conch_complete_pass2.py" -- --out "$out" --render > "$out/hero.log" 2>&1
python3 scripts/heavy-lane.py build -- blender -b -t 2 --python-exit-code 1 -P "$src/render_conch_complete_pass2_nine.py" -- --out "$out" --samples 16 --height 700 > "$out/nine.log" 2>&1
python3 "$src/board_conch_complete_pass2.py" --out "$out"
