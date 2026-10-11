# DS1.6 lossless practice-figure source normalization

The readable SDK compiler `normalizeRigSource` decodes Meshopt into plain accessor
buffers and extracts the original embedded WebP files unchanged. The retained
GLBs and their generator sources remain authoritative. No large generated model
is committed, no image is re-encoded, and no native arena is switched yet.

Every position, normal, UV, skin and index channel is compared exactly to the
original decoded source for all three figures. Joint order, inverse binds,
local hierarchy, material factors and samplers also match. Skin weight encoding
is retained because GLTFLoader normalizes it after loading. Output is deterministic,
owns its buffers and refuses unsupported extensions instead of dropping them.

## O-check

The browser-lane proof runs the actual `TrainingDummyAssets.loadTrainingDummy` and
`DummyStudio.applyDummyStudio` functions, unchanged. Ordinary Driftwood and Pine
sessions both use this arena; template and frozen copies are not counted. Each
original figure and its normalized glTF source is loaded in a fresh muted Chromium
Metal context, iPhone 16 Pro, DPR2. This is their native practice studio, not a
capture of a shard world. The fixed three-quarter rest pose uses the same camera,
materials, shader patches and studio environment in both arms.

All 804 × 1520 RGBA pixels are exact, including alpha. Both figures have one draw
and one program; Driftwood wood has 39,448 triangles, Pine steel has 41,544.
No page or GL errors occurred. `summary.json` records both hashes and the source
snapshot. Labels are added only after the numerical comparison.
The proof requires the shared checkout quiet-file path explicitly, so scratch exports
cannot accidentally miss another lane's lease. A brief early overlap was reported;
no timing or memory credit is taken from this visual O-check.

[Driftwood O-check](driftwood-isle.jpg) · [Pine O-check](pine-hollow.jpg).

Reproduce in a clean linked export through the build and browser lanes:

```sh
WS_QUIET_FILE=<shared-main>/.git/quiet \
python3 scripts/heavy-lane.py build -- scripts/browser-lane.sh --max 6 \
  node scripts/proof-rig-normalization.mjs <owned-output-dir> <exact-source-tree>
pnpm exec vitest run test/rig-normalization.test.ts \
  test/commons-arm-motion.test.ts test/commons-practice.test.ts
```

## Admission is still blocked

The result is authoring glTF JSON plus immutable external resources, **not an
admitted model pack**. Product GLBs currently refuse all embedded images and
require separate declared KTX2 files; prop material slots require kind `ktx2`.
Presentation WebP admission is a different contract and is not used as a bypass.

The geometry-only inspection copy passes the unchanged strict GLB parser. Initial
inspection refused its skin weights: the source marks Float32 weights
`normalized: true`, so the parser attempted integer scaling. This compiler clears
that no-op Float32 flag; all actual weight bytes remain identical and already sum
to one within 4.5 × 10^-8. Integer joint/weight encoding keeps meaningful flags.
The exact native pixel comparison includes this repair. No skin values are
renormalized and no admission tolerance changes.

The remaining blocker is the original external WebP texture contract. It was
reported before any admission change. Native model-pack adoption stays open;
nothing is priced as opaque binary and no production residency saving is claimed.

The arm-motion, practice-motion and original-score packs remain independently
qualified. Native adoption and shared species-generator qualification are open.
