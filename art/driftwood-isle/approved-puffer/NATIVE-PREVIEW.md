# Native V23 actual-engine arena preview

This is an explicit, local developer WIP route. V23 is visually unaccepted;
colliders, numerical poses, fight integration and phone performance are also
unaccepted. This is **not Model Explorer Solid/Paint**, not a palette approval,
and not the public practice demo. Default/shipping sources and old generated
fixtures remain unchanged. The other four creatures are not built or admitted.

## Reproducible inputs and outputs

- Source: `unaccepted-native-v23.json`, SHA-256
  `18e8847e87e9e6d9546000572e1775cced8b20b78c0317e2a0599b5fb3a4fd68`.
  The build refuses any changed bytes under that candidate identity.
- Body packing reuses `native_export.py`; there is no second coordinate
  conversion, material approximation or custom renderer. The stored source is
  already in game axes and has reversed winding.
- An explicit AnimalDims JSON is required. The codec receipt's scratch dimensions
  are not measured hit volumes and must not silently become gameplay tuning.
  `unaccepted-native-v23-preview-dimensions.json` is a separate conservative
  candidate measured from actual V23 vertices by `measure_native_preview.py`.
  `native-v23-preview-measurements.json` records source hash, part bounds, each
  formula, four fin/toe centres and limitations. All rest-hull vertices fit the
  candidate capsule; inflated geometry, terrain contacts and gameplay response
  are untested. The capsule may include too much empty space; the eye-derived
  head sphere is expressly not an anatomical head-volume design.
- `pufferNativePreview.ts` emits one species, one Puffer decision, one strike,
  one move, one body catalogue and one numeric pose through the existing SDK
  product validation. The burst remains .9 s windup + .1 s active + 1.1 s recovery.
- `pufferNativeClips.ts` targets `joint.belly` by name. The actual exported order
  puts head at index 7; head stays at its bind-local translation with identity
  rotation/scale. No old .43 body height, .33 head shift or 1.57 scale is retained.
- Build-time modes: `rest`, `inflate-105`, `inflate-110`, `attack`. The attack
  diagnostic is deliberately restricted to at most 1.10 belly scale. Fin, tail,
  death and flinch animation are not newly authored by this preview.

The root coordinator grants build/test/browser lanes before executing:

```sh
python3 scripts/heavy-lane.py build -- node scripts/build-puffer-native-preview.mjs art/driftwood-isle/approved-puffer/unaccepted-native-v23-preview-dimensions.json rest
python3 scripts/heavy-lane.py build -- node scripts/build-puffer-native-preview.mjs --app
```

The first command writes only a new/empty `tmp/puffer-native-preview/rest/`:
`pack/`, `product/`, exact `unaccepted-dimensions.json`, and `preview.json` with
input/output hashes and explicit false acceptance flags. No generated production
asset is overwritten. Another mode uses its own new directory. For example,
`PUFFER_PREVIEW_DIR=tmp/puffer-native-preview/inflate-105` selects that product
for the Vite step. Its default output is `tmp/puffer-native-preview-dist`; use a
new `--app tmp/puffer-native-preview-105-dist` output to preserve earlier outputs.
The named Vite configuration is invoked programmatically by `--app`, avoiding
a new default-export exception. It refuses a nonempty output, verifies packed-body hashes,
and reuses the existing practice HTML/boot/Game/AnimalFactory code with a WIP
label. It does not publish or modify the review Site.

Focused source/real-native-bind tests (no renderer or Blender):

```sh
node_modules/.bin/vitest run test/puffer-native-preview.test.ts --maxWorkers=1
```

On 2026-10-18 the focused command passed **5 tests, zero skipped**, in 10.18 s:
three actual-native-bind scale cases, one attack-clock case and one isolated
product-source case. This did not compile Wasm, build the app, render pixels,
exercise actual mesh deformation/containment or approve colliders. The full
build/browser steps are intentionally still queued for the coordinator.

## Rendering audit: source-confirmed, not yet browser-confirmed

The actual path is `practiceBoot` → `startPracticeDemo` → `Game`, with
`preparePracticeContent` → `packedCreatureBodies` → `AnimalFactory` and
`numericCreaturePose`. Materials compile through `runtimeLookMaterials`,
`clientMaterials`, and the real graph compiler.

- `driftwood-creature` graph: model `toon`, flat shading, vertex colour multiplied
  by material colour, material emissive, roughness .85, metalness 0. The existing
  per-instance tint remains; this is not a raw-albedo viewer.
- The isolated product leaves `familyLooks` at the empty-source defaults.
  Toon defaults: face edge [.14, .20], shadow edge [.25, .75], lit grade .2,
  shade grade 0, lift [.07, .035, .2], rim [1.3, .95, .6], terminator
  [.4, .16, .06], gloss threshold .72. Cloud shade is strength .6, scale 60,
  wind [3.2, 1.4]; caustic water level is null.
- Practice content lends the material catalogue but does not call its `tick`;
  the toon family's cloud-time uniform therefore starts/stays at 0. The arena
  simulation, creature transform and camera are **not frozen** by static pose mode.
- `practiceLevel` imports the manifest's numerical sky and grade, but its look is
  `emptyLook(.5)`, not Driftwood's full runtime look. That backdrop supplies a
  paused hour-12 clock, a flat #9ca7b4 background, no clouds/planet, no environment
  capture and `lut: null`. Its `bind` is a no-op, so the hour-12 label does not
  install the real Driftwood Noon lighting. The base sun direction remains
  normalize([.3, .6, .4]); intensity 2.7, colour [1, .97, .9]. Hemisphere sky
  8098036, ground 14198904, intensity .9; environment intensity .7 is configured
  but an imported HDRI is not loaded by this backdrop.
- `Game` uses its real **clean** composer: AgX tone mapping, saturation .3,
  brightness 0, contrast .2, bloom .4/threshold 1, split-tone shadow
  [.94, .98, 1.06], highlights [1.04, 1.01, .96], lift [0, 0, .005], gain
  [1.02, 1.02, 1], gamma 1. AO/shadow/AA choices remain tier-dependent.
  The learned Driftwood LUT is absent because `sky.lut` is null. No cinematic
  grain/chromatic aberration is added by the clean chain.

Therefore this route can establish native geometry/rig admission in the actual
engine, but cannot establish the requested final Noon Solid/Paint palette proof.
That requires the real Driftwood backdrop/LUT/lighting and Model Explorer host,
plus frozen animation/cloud/camera time and honest portrait screenshots. Paint
there is unlit vertex paint plus the game's grading, not raw albedo. No rendered
proof, geometric containment result, collider acceptance or phone result is
claimed by the source tests or this document.


## Explicit newer candidates (source support, no rendered proof)

The V23 default remains pinned to its original source and dimensions. A new
optional fourth positional CLI argument is a JSON candidate descriptor:
`{ "candidate": "V38", "source": "project-relative/native.json", "sourceSha256": "64 lowercase hex characters", "measurement": "project-relative/measurement.json" }`.
Source and receipt must remain inside the project. The receipt must match both
source hash and exact dimensions-file bytes and state both acceptance flags false.
The preview banner/build identity derives from this checked candidate; species
uses the version-neutral `Brine Puffer Native · UNACCEPTED WIP` label.

Prepare dimensions without Blender or an app build:

```sh
python3 art/driftwood-isle/approved-puffer/measure_native_preview.py --source art/driftwood-isle/approved-puffer/unaccepted-native-v38.json --sha256 34c8652efcca0a454a06a83749eb3a56b4990f70c22f022b76117f6df966d38b --candidate V38 --output NEW_MEASUREMENT_DIRECTORY
```

Custom measurement selects vertices by positive skin influence on named body/belly,
head and individual fin bones, across all merged parts; it does not depend on part
labels. The head sphere encloses the entire head-weighted region, not merely eyes.
It is a conservative diagnostic envelope, not anatomical or gameplay tuning. The
V23 no-argument measurement keeps the original selection and dimensions unchanged.
Each measurement output refuses overwrites.

The reviewed V38 input is preserved as `unaccepted-native-v38.json`,
`unaccepted-native-v38-preview-dimensions.json`, `native-v38-preview-measurements.json`
and `native-v38-preview-candidate.json` beside this document. Source SHA-256 is
`34c8652efcca0a454a06a83749eb3a56b4990f70c22f022b76117f6df966d38b`.
The descriptor uses repository-relative paths. Originals remain in scratch.
V39 scratch measurements are exploratory only; its framing failure leaves it a
hero-only study and it is not the selected preview candidate. If a source changes,
prepare a new receipt instead of editing an old identity.

Root-owned build commands, **not run by this source audit**:

```sh
python3 scripts/heavy-lane.py build -- node scripts/build-puffer-native-preview.mjs art/driftwood-isle/approved-puffer/unaccepted-native-v38-preview-dimensions.json rest tmp/puffer-native-preview/v38-rest art/driftwood-isle/approved-puffer/native-v38-preview-candidate.json
PUFFER_PREVIEW_DIR=tmp/puffer-native-preview/v38-rest python3 scripts/heavy-lane.py build -- node scripts/build-puffer-native-preview.mjs --app tmp/puffer-native-preview-v38-rest-dist
```

V38 is the selected input. Use a new output for each of
`rest`, `inflate-105`, `inflate-110`, `attack`. Native pivots resolve by name:
body/belly Y≈0.60, head Y≈0.83 and tail Y≈0.58. Head local Y≈0.23 and Z=0.5.
The pose source needs no changes; no independent head channel is introduced and
attack remains 2.1 seconds. All rest/1.05/1.10 geometry checks precede attack tuning.

Source checks: `node --test scripts/puffer-preview-input.test.mjs` and
`python3 test/puffer-preview-measurement_test.py`. These cover preserved V23
identity/dimensions, pinned source/dimension rejection, merged weight selection,
current pivot inputs and parent rejection. They do not render or approve inflation.

### Full Driftwood Noon remains outside this preview

No lighting admission was added. Actual Driftwood's `generators/toonPresentation.ts`
emits TOON_LOOK as `look/toon`, with authored lighting/shadows, sky channel programs,
dome/cloud graphs, environment capture and asset dependencies. Its skyDay named
Noon is phase .42 (fixed midday .4166666667), not the empty clock's .5. ModelExplorer
pins the real host clock via `pin('noon')`. Replacing a label or manifest scalars,
or using the simpler shardfileLook/dataLook sky, does not install that presentation.
A future isolated adapter must admit its exact dependencies and real LUT bytes,
bind/pin the light rig, then freeze cloud/animation/camera time. It must avoid
importing the full world output generator or rebaking other enemies. Until then
this is the actual-engine arena with the previously documented empty-look,
fixed-light/no-LUT limitations, not final Noon Solid/Paint palette proof.

### Clean-source build diagnostic (2026-10-18)

A fresh source export of `c4339d90a93ccc289540e3a72c1e9cbf221d98fb`
packed and compiled V38 rest successfully in 3.98 seconds: 8,127 vertices,
2,709 triangles, eight bones, seven merged parts and 48,446 compressed bytes.
This validates product construction, not rendered geometry or runtime admission.
The app build then failed because practice.ts imports ignored generated byte/hash
tables absent from a clean source export. A diagnostic retry exposed those two
original unresolved imports after fixing a masking closeBundle copy error.

The preview config now supplies virtual byte/hash tables from its actual copied
asset closure, including packed body, static dependencies and admitted product
files. No production boot tables are generated, imported or overwritten. Its
closeBundle copy runs only after writeBundle succeeds, preserving genuine bundle
errors. Focused static checks verified both virtual modules against real Rapier
bytes/hash and verified the failed-build guard; typed lint passed. App build and
browser evidence after these fixes are still pending. A subsequent app attempt
passed the byte/hash imports, then exposed two more ignored tables (arm clips and
starter effects) plus a missing budgets directory in the selective source export.
The preview now uses the existing official source generators for those two tables
as virtual TypeScript modules, again without writing production generated files.
Static checks matched both module bodies exactly to their official generators;
typed lint passed. The clean export now also includes the pinned budgets directory.
No successful app bundle, browser boot or screenshot is claimed by these checks.

For clean exports using installed dependencies, recreate the five @wildshard
workspace package links to the exported src/{commons,engine,format,game,sdk}; a
single symlink to the original node_modules otherwise resolves workspace packages
back into the mutable source tree. Other installed dependency links can be reused.
Copy the installed Rapier WASM byte-identically into the export's public assets
when it is absent from Git; do not manufacture a substitute or modify production.


### Actual cloud runtime result (2026-10-18)

The repaired app build succeeded in 1.77 seconds. V38 rest and 1.05 static belly
swell both booted the real arena in cloud Chromium at 390×844 portrait (software
WebGL, device scale 1). There were zero JavaScript page errors and zero HTTP errors;
the only console warnings were THREE.Clock deprecation and already-nonindexed
geometry. Exactly one Puffer opponent was admitted. Local/session storage remained
empty, no service worker controlled the page, and Retry reported a fresh bout.

Genuine screenshots and source/product/asset pins are preserved under
`docs/reviews/brine-puffer-native-preview-v38/`. Both captured front views show no
obvious detached head or fin pieces. The model is relatively distant in the arena;
this is not an all-angle containment test, animation acceptance or a quality pass.
The 1.10 mode and dynamic attack animation were not browser-tested. No phone
performance, human-playtest, full Noon lighting or Model Explorer parity is claimed.
The empty-look/fixed-light/AgX-grade/no-LUT limitations still apply unchanged.

The clean source used the pinned commit above plus the scoped preview config
fixes recorded in the receipt. Export `src`, `scripts`, `vite`, `lint`, `test`,
`budgets`, package.json, pnpm-lock.yaml, tsconfig.json, practice.html, the preserved
approved-puffer inputs and public/assets/models/driftwood-fp/fp-arms.glb. Reuse
installed dependency packages without installation, but rebind top-level
@wildshard workspace links to the export. Also preserve the installed package-local
node_modules symlink trees under src/{format,game,commons,sdk}; their relative
workspace links then resolve inside the export and their third-party links reach
the reused .pnpm store. The missing SDK-local @valibot/to-json-schema link caused
one failed swell attempt before this was corrected. Preserve failed output folders
and use new destinations. No global generation or other-enemy bake is required.

The current config provides byte/hash, arm-clip and starter-effect modules virtually
from actual copied files and official generators. It never writes the production
boot tables. Rest/1.05 product and app commands remain the explicit CLI above;
serve the resulting isolated app directory and click Start practice. The screenshot
browser scripts and full failed/successful logs remain in the clean export's tmp;
public-safe evidence receipts carry no private absolute paths.
