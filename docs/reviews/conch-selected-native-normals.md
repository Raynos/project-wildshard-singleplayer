# Selected Conch: exact native source normals

## Result and scope

The selected corrected Conch now has a separate normal-preserving native asset at
`art/driftwood-isle/approved-conch/selected-native-normals/native/`.
This is **verified data preparation, not native visual or runtime admission**.
No source model, previous native payload, shared exporter, engine, schema, codec,
production asset, gate, or application code was changed. No render, browser,
app build, score, Git publication or Site publication was performed.

The isolated editable `export_native.py` retains the selected corrected source
pins and existing 15-joint assignment/weight calculation. It adds the source
NORMAL float32 channel to the existing generic packed-body attribute format,
using the same supported format demonstrated by the Mantis complete-pass2 adapter.
No new schema exception is needed. The previous statement that normals cannot
be carried by this format does not apply to this new six-channel payload.

## Preserved data

- Source GLB: `selected-geometry-admission/conch-study.glb`, SHA-256
  `21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a`.
- Source script: `selected-geometry-admission/build_selected_conch.py`, SHA-256
  `ecfcfa03a123b5b81343a96409ed769a7b85be03530c4ef30e2bd56a3ba95a0e`.
- 51 source meshes, 95 material primitives, 2,190 ordered oriented triangles,
  6,570 expanded vertices and 15 diagnostic joints/parts.
- Positions, linear colors, skin indices, skin weights, zero fur lengths, bone
  hierarchy and pivots exactly equal the previous native source asset. Existing
  float32 packing behavior is retained for those channels.
- Every source NORMAL float32 component is preserved at its exact expanded
  primitive/index position. Normals are neither recomputed nor flipped.
- Primitive material identity, vertex ranges and source double-sided flags remain
  in `native/mesh-map.json`. Colors retain the same primitive regions.
- All 21 non-opposed shell/cranium polygon-versus-triangle normal differences
  remain. Minimum normal/facet cosine is 0.1021281717893707; zero degenerate or
  opposed triangles. `normal-audit.json` computes this from the new native source.

## Executed checks

**10 Python tests pass.** They cover original-channel, pivot and material-region
identity; deterministic outputs; independent struct/zlib decoding of all packed
channels; source/GLB pin rejection; missing/nonfinite/nonunit normals; altered
pivots; and invalid rigid skin assignment. A fresh exporter run reproduced all
seven native files, including the closure receipt, byte for byte.

**4 focused Vitest tests pass through the real consumer.** They independently
load the pinned GLB with THREE.GLTFLoader, compare every ordered expanded
position/normal/color, and load the new metadata/payload with the unmodified
`packedCreatureBodies` implementation. All six channel arrays, types, widths,
normalization flags, counts, fresh-copy behavior and bones are checked. Preload,
foreign-identity and truncated-payload failures are exercised.

The same tests bind actual THREE.SkinnedMesh/Skeleton instances, prove rest
positions, and rotate each of the 15 joints independently. Affected parts are
computed from actual nonzero skin influences, including blended leg hinges.
They also CPU-evaluate the installed THREE skin-normal shader equation using
its actual Float32 skeleton matrix palette and bind matrices, comparing against
independent hierarchy-quaternion rotation of each weighted normal. Rest,
each joint rotation, pose reset and translation exclusion pass (error < 2e-7).
This checks shader-equation correspondence, **not GPU shader execution or
visual shading under the game's material**.

An initial Vitest invocation without a specific test path correctly hit the
repository full-suite guard. The corrected focused invocation below passed;
no lease, guard or configuration policy was bypassed. Vite emits its existing
future-native-config-loader warning. No full suite or full typecheck is claimed.

## Reproduce

Run from the repository root:

```sh
PYTHONDONTWRITEBYTECODE=1 python3 art/driftwood-isle/approved-conch/selected-native-normals/test_export_native.py
PYTHONDONTWRITEBYTECODE=1 python3 art/driftwood-isle/approved-conch/selected-native-normals/audit_normals.py
node_modules/.bin/vitest run art/driftwood-isle/approved-conch/selected-native-normals/native-consumer.test.ts --config art/driftwood-isle/approved-conch/selected-native-normals/vitest.config.ts
```

For a fresh export, run `export_native.py --out` with a nonexistent child directory
inside `selected-native-normals`. Existing output directories are deliberately
refused. Tests reproduce content in memory without overwriting frozen outputs.
`input-pins.json` also pins the original native source/payload/metadata and the
unchanged codec; `freeze.json` records this deliverable's files.

## Boundaries still open

The stricter all-closed/unit-facet diagnostic remains false. Original open
nostril/pupil/glint overlays remain; eye shells close only as assembled socket,
back and lens surfaces. This work does not repair, delete or extrude them.
The native format does not carry a per-part double-sided material policy:
source flags are evidence in the sidecar, not a claim of native culling parity.
The retained linear colors/normals do not establish equivalence between Blender
and engine toon shading, roughness, lighting, or flat-shading configuration.

These are derived diagnostic joints, not a newly authored production rig. The
CPU transforms do not establish plausible articulation, deformation quality,
contacts, collisions, animation, gameplay dimensions or phone performance.
The `/assets/` URL in metadata is a format identifier tested using an injected
local byte loader; the asset has not been published or mounted in the app.

Matched actual source/native visual captures and independent assessment remain
required before appearance admission. No score from the corrected static source
is assigned to this native payload. Native visual, animation, collider, runtime,
phone-performance and public-promotion acceptance remain false.
