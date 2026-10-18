# V70 provisional rig1 / gait5 input

Source preparation only. V57 gait5 remains the tested live fallback. V70 is not
visually accepted, and this closure does not publish or replace an app.

## Exact identity

- Original native: `unaccepted-native-v70.json`, SHA-256
  `3d0606971754f7788e899fe31214748fd38f43b38b363f2d2b291be588de48dc`.
- Weighted native: `unaccepted-v70-motion-rig1-native.json`, SHA-256
  `b985594b98035df3a006464d5af76b0f2b10eca076fa3366b9d94bc325ba1762`.
- Selected descriptor: `v70-gait5-preview-candidate.json`.
- Calibrated dimensions: `v70-gait5-dimensions.json`, SHA-256
  `aac576c8ab54b45ef2beff42ceee591aeb41e70ac764fb1911bc51f7e59fd39e`.
- Measurement receipt: `v70-gait5-measurements.json`, SHA-256
  `a923ca6c0ca4ba7d853da3b871d536e2b2a3106202a21c3673f22a8eaa6c6f27`.

The immutable V70-only transfer profile maps the preserved V57 reference's twelve
root-cap coordinates per fin with the exact authored Float32 posterior compression
in game Z. Three fore-cap and twelve rear-cap unique coordinates change per side.
Lower stations remain exact. Only the expected tail absolute bind Z changes to
`-0.5174999833106995`; every other bone value is exact. Protected coordinate
multiplicities and oriented triangle neighborhoods must match the transformed
reference. The candidate's actual geometry, paint, triangle order and bones are
never transformed or replaced. Only 138 triangle-vertex weight rows per fin change.

The original V57 helper remains unchanged and rejects V70. The new profile rejects
any source bytes outside its one V70 hash. Its receipt records the generator,
compression study, original references, transformed coordinates and output pins.
Geometric leg length remains in the measured receipt; only the separate gait
dimension uses `.24 / (2 * sin(.36))`. Its receipt contains both complete measured
and calibrated dimensions, with the calibrated object matching the runtime bytes.

`scripts/puffer-gait-admission.mjs` admits V70 only for gait5 and checks the original
source, weighted source, dimensions, measurement, equivalence receipt and unchanged
base pose/gait/continuity source hashes. The existing pinned V57 gait4/gait5 path
remains available. The preview uses candidate `V70` for its receipt, build ID and
UI banner; no V57 identity is borrowed. Admission is preparation, not quality approval.

## Completed focused checks

- 19 Python transfer tests; 5 native-export tests; 3 measurement tests.
- 6 Node candidate/admission tests, including dependency and tuple tampering.
- 18 focused Vitest tests, including the real V70 packed consumer, with no skip.
- 2 V70 actual-pose tests: 1,068 sampled frames use the real admitted gait5 programs,
  Three.js bone matrices and V70 weighted vertices. Flat local minimum fin Y is
  `0.00400000018998975`, maximum cap-to-belly error is `0`, and minimum triangle
  area ratio is `0.5999999999999932`. Tail/head bind positions remain correct.
- Typed lint on changed JavaScript/TypeScript passes.

The codec has 9,993 vertices, 3,331 triangles, eight bones, seven parts and 53,440
compressed bytes. These are source/codec and sampled local-pose proofs. They do
not establish world terrain, yaw-turn planting, world ragdoll, rendered motion,
full Driftwood Noon, phone performance, gameplay quality or visual acceptance.

## Reproduce after coordinator assigns the build lane

The following are future app commands, not runs claimed by this closure. Use new
output directories and preserve the V57 product/app. From the prepared source root:

```sh
python3 scripts/heavy-lane.py build -- node scripts/build-puffer-native-preview.mjs art/driftwood-isle/approved-puffer/v70-gait5-dimensions.json gait5 tmp/puffer-native-preview/v70-gait5 art/driftwood-isle/approved-puffer/v70-gait5-preview-candidate.json
PUFFER_PREVIEW_DIR=tmp/puffer-native-preview/v70-gait5 python3 scripts/heavy-lane.py build -- node scripts/build-puffer-native-preview.mjs --app tmp/puffer-native-preview-v70-gait5-dist
```

Fresh normal-renderer full-cycle review, combat/reward/Retry/persistence checks,
and mounted-route identity verification are required before Site promotion.
