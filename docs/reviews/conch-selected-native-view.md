# Corrected Conch: isolated native rest comparison

## Actual host appearance: normals and colors are transformed

The current actual practice host cannot preserve the selected source normals.
`src/practiceLevel.ts` uses `manifest.creatures.lowPoly: true`;
`src/practiceContent.ts` sets `faceted: true` unconditionally;
`src/engine/entities/AnimalFactory.ts` therefore calls `facetGeometry`;
`src/engine/entities/lowpoly.ts:30` calls `computeVertexNormals()` and applies
12% deterministic per-triangle color jitter. The packed consumer preserving a
normal attribute is not enough to preserve it through this downstream model path.

The strict practice presentation schema has no data field for this treatment.
Adding an ad hoc field would correctly fail validation. No shader, engine,
consumer, schema, host source, manifest or original asset was changed. Root explicitly narrowed this diagnostic to the unchanged faceted-host appearance.
The exact normal-bearing input is still pinned, but capture must record actual
post-facet attributes and quantify normal/color changes. No end-to-end normal/color
preservation or native visual admission is claimed. Any generic authored geometry
treatment feature is a separate future decision.

## Preparation only

This is a separate normal-preserving candidate, not Conch4, not motion5, and not a
production or animation promotion. The selected corrected source's independent
4.05 static-source score is historical context, not a native score. Native visual
review remains pending. Existing Conch4 host and motion5 failed evidence are unchanged.

All new implementation lives in
`art/driftwood-isle/approved-conch/selected-native-view/`. No shared engine, schema,
codec, top-level build/capture scripts, existing reviewed pins or assets are edited.

## Exact admission and real host

The adapter pins the corrected GLB, source generator, all selected-native-normal
files, source material/primitive map, exact normal/position/color/skin weights,
rig pivots, closure and independent source report. It rejects altered or missing
bytes and symlinks. The source-only freeze is never treated as build permission.
Root must supply a separate immutable build permission covering the current source
inventory, normal freeze, review and runtime version. Product and app builds require
the existing heavy-build lease and refuse nonempty destinations. Host capture
rechecks exact product, body tuple, source closure and every emitted host file.

The factory uses the established SDK product preparation/validation and actual
`practice.html` arena host. The normal-bearing packed payload reaches the existing
packed-body consumer and actual engine material. No old canonical tuple fallback
is available. Existing AI/strikes remain host scaffolding, not admitted gameplay.

The rest pose is ordinary data through the existing `creature.pose` schema:
45 constant-zero rotation outputs over 15 joints, no clocks, frame reads, position
or scale output. The rest pose itself changes no bind positions, skin weights, skeleton or normals;
the subsequent faceting stage still changes normals and colors as disclosed above. Focused tests exercise the real schema/evaluator and preserve positions
and scales at varied observation times. No native skeleton reset, override or
alternate renderer is used.

## Matched comparison design

Nine directions: front, left, right, back, top, elevated front, elevated left,
elevated right, elevated back. The source is the exact GLB loaded by GLTFLoader;
source materials retain their GLB properties. The native uses actual arena toon
materials. Both use the actual arena composer, lighting, camera, root and scale.
Material/shader differences are an explicit part of this review, not concealed.
These are new engine-context matched views, not the earlier Blender renders.

The comparison helper changes diagnostic camera and source/native visibility only.
It refuses changed actors, missing native channels, wrong vertex/bone counts or
nonzero native joint rotations. It records actual attributes, weights, material
identities, bind/inverse matrices, bone palette, camera and root matrices. The
source root must equal the actual native root. It never changes native bones,
health, damage, clocks, AI or animation.

Root approved two synchronous visibility-only render passes in one simulation
observation, recording identical root/camera/light state and restoring state.
Final source checkpoint and cleanup/build release are pending. The root has
authorized observing the real faceted host without changing it. No app build or browser execution has occurred in this preparation.

## Output bounds and paths

- Source preparation: under 3 MiB.
- Later separately released product/app/stills/evidence: under 40 MiB.
- Build permission/product: `tmp/conch-selected-view/`.
- Isolated host: `tmp/conch-selected-view-dist/`.
- New immutable capture attempts: `tmp/conch-selected-view-qa/`.
- No movie, full-frame cache, deployment, Site update or Git publication.

## Verification so far

- Focused Vitest: 2/2 pass, including unchanged numeric schema/evaluator.
- Node admission/identity tests: 4/4 pass.
- New adapter/helper syntax checks pass.
- Repository oxlint excludes art paths and reports no files, so no lint pass is claimed.
- Native pin admission deliberately refuses while root checkpoint is pending.
- Build, browser, native shading review and independent native visual score: not run.
