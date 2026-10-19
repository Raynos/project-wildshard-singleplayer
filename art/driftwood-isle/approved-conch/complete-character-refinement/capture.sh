#!/usr/bin/env bash
set -eu
export WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes" HOME="$PWD/tmp/home"
out=tmp/conch-complete-character-refinement
src=art/driftwood-isle/approved-conch/complete-character-refinement
python3 scripts/heavy-lane.py build -- blender -b -t 2 --python-exit-code 1 -P "$src/build_conch_character_refinement.py" -- --out "$out" --render > "$out/hero.log" 2>&1
python3 scripts/heavy-lane.py build -- blender -b -t 2 --python-exit-code 1 -P "$src/render_conch_character_refinement_nine.py" -- --out "$out" --samples 16 --height 700 > "$out/nine.log" 2>&1
