#!/usr/bin/env bash
set -euo pipefail
here=art/driftwood-isle/approved-brine-pitcher/grown-fan-anatomy
raw=tmp/pitcher-grown-fan-20261020
export WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes"
python3 scripts/heavy-lane.py build -- blender -b -t 2 --python-exit-code 1 -P art/driftwood-isle/approved-brine-pitcher/complete-character-next/build_complete.py -- --out "$raw/predecessor" --render > "$here/predecessor-render.log" 2>&1
for kind in candidate predecessor; do
 python3 scripts/heavy-lane.py build -- blender -b -t 2 --python-exit-code 1 -P "$here/supplemental_capture.py" -- --kind "$kind" --out "$raw/supplemental-$kind" > "$here/supplemental-$kind.log" 2>&1
done
