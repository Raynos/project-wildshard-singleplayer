# Reproduce the unchanged V9 baseline

The captured baseline does not require keeping an untracked `.blend` forever.
Its authored source is `build_puffer_lowpoly_v9.py` in this directory, SHA-256
`ec6148f2620675eb52872269591e56212249ab7f1687c2546365c5e248d57500`.
The original capture receipt is `baseline-v9-shared-camera-receipt.json`.
All commands below run from the repository root. They are reproduction
instructions, not a claim that this regeneration has been executed.

## 1. Restore the exact shared camera receipt

The ordinary tracked receipt preserves the nine-camera scale and target.
Extract them without fitting anything to the regenerated model:

```sh
mkdir -p tmp/puffer-v9-reproduction
python3 - <<'PY'
import json
from pathlib import Path
source = Path('art/driftwood-isle/approved-puffer/baseline-v9-shared-camera-receipt.json')
receipt = json.loads(source.read_text())
out = Path('tmp/puffer-v9-reproduction/shared-camera.json')
if out.exists():
    raise SystemExit('Choose a fresh scratch directory; do not overwrite existing proof')
out.write_text(json.dumps(receipt['nineViewCamera'], indent=2) + '\n')
PY
```

## 2. Rebuild the original V9 inspection scene

With the coordinator's heavy lane, use the sanctioned Blender 4.3 executable,
two threads, and a fresh output directory. Run the original source unchanged;
omit `--render` so it saves the original pre-studio inspection scene:

```sh
blender -b -t 2 --python-exit-code 1 \
  -P art/driftwood-isle/approved-puffer/build_puffer_lowpoly_v9.py -- \
  --out tmp/puffer-v9-reproduction/model
```

This builds only the original V9 geometry, original material, original weights
and original rig. It writes a scratch GLB and `inspection.blend`; neither is
committed or substituted into the game. Never point it at the historical V9
output directory. A recreated `.blend` may differ in file metadata; compare
its model fingerprint and source hash rather than assuming binary identity.

## 3. Capture the shared-camera baseline

Keep the same heavy lane for this second command:

```sh
blender -b -t 2 --python-exit-code 1 \
  -P art/driftwood-isle/approved-puffer/capture_v9_shared_baseline.py -- \
  --blend tmp/puffer-v9-reproduction/model/inspection.blend \
  --camera tmp/puffer-v9-reproduction/shared-camera.json \
  --out tmp/puffer-v9-reproduction/frames
```

The capture script creates the same studio lighting, original matched hero
camera, and nine fixed diagnostic cameras. It never writes to the loaded
`.blend` or changes model geometry/materials. It refuses existing frame
outputs and emits `baseline-capture.json` with actual source and image hashes.

The original model fingerprint is
`72a261ca972eb9c1538bb6f40a83b36cafb5032e8b10c5aff6dd2db9a0a110ba`.
Compare the newly emitted `geometryFingerprint` and `v9BuilderSha256` with the
ordinary preserved receipt. Pixel-identical rendering is not promised across
Blender builds, CPU architectures or render settings; differences require
inspection. Use the same shared framing for candidate comparisons. The old
hero-only score and a new nine-view score are different evidence scopes.

No camera measurement against AI mockups, gameplay rendering, visual acceptance
or runtime integration is established by this baseline.
