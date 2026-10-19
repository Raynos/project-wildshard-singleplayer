# Bellback rest-render diagnostics

This is a separate diagnostic, not an admitted actor/product or a gameplay host.
Read `docs/reviews/bellback-native-visual-diagnostic.md` for the final verdict and
limitations. The original V6 and Frame1 are preserved. Frame2 is root-selected only as the bounded technical fold-repair candidate
for next arena preparation. Visual/gameplay acceptance and a new likeness score
are not granted; root owns approval of the final runtime tuple.

## Current reproducible checks

From repository root:

```sh
python3 -m unittest discover -s art/driftwood-isle/lowpoly-bellback/runtime-admission/visual -p 'test_frame*.py' -v
node_modules/.bin/vitest run art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/native-frame2.test.ts --config art/driftwood-isle/lowpoly-bellback/runtime-admission/visual/vitest.config.ts --maxWorkers=1
```

The Python tests inspect the actual original/candidate loft ASTs without Blender.
The source preparation scripts reproduce only their exact separate candidate and
refuse a different existing file. Candidate native exporters are one-shot closure
producers; they refuse an existing native-output directory. Preserve frozen outputs.

Frame2 renderer library: `vite-frame2.config.ts`, built through the repository's
`heavy-lane.py build` wrapper. `capture-frame2.mjs` is run through `browser-lane.sh`.
It expects the existing tested clean V70 preview as a read-only renderer host.
It never edits or copies that app, admits an enemy, runs combat, or writes saves.
The host is verified against its 137-file inventory in `host-verification.json`.
All raw app bundles/PNG captures stay in the explicitly named `tmp` directories
recorded by the receipts. Build output directories must be fresh for reproduction.

`diagnostic-v1.ts` preserves the exact original diagnostic module corresponding
to the first receipt; `diagnostic.ts` adds Frame1 and isolated-node controls;
`diagnostic-frame2.ts` adds Frame2. The baseline capture script belongs to the first
bundle; the two later capture scripts are paired with their matching configs.

The final library imports the real packed consumer, merge/facet/one-material
functions and GLTFLoader. It binds the eight rest bones and borrows the actual
host's compiled creature material. The held host composer renders both versions
with identical fixed cameras/lights; the viewmodel and Puffer are hidden only in
this diagnostic page. Isolated node views use exact mesh-map draw ranges and
source-node visibility, never geometry edits. Side controls are diagnostic only.
