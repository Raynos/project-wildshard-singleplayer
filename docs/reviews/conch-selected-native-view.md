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
The exact normal-bearing input is still pinned, but capture records actual
post-facet attributes and quantifies normal/color changes. No end-to-end normal/color
preservation or native visual admission is claimed. Any generic authored geometry
treatment feature is a separate future decision.

## Scope

This is a separate candidate with a normal-preserving input payload, not Conch4, not motion5, and not a
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
Root supplied separate immutable build permissions covering the current source
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
The final successful capture is attempt3. All eighteen raw source/native images
were opened individually by the capture author and checked for complete visible
character, no ceiling occlusion and no frame-edge crop. This is capture completeness,
not independent quality review. Source materials and native faceted-host material
are explicitly distinct. GLB double-sided settings are not a packed per-part feature.

The actual native mesh is merged to one skinned draw geometry. All 6,570 vertices,
15 bind joints and exact weights are recorded. Every captured native joint has its
exact derived bind position, unit scale and zero rotation; no post-simulation reset.

The diagnostic uses 402×874 iPhone 16 Pro emulation at device scale 1. The camera is
95° perspective, fitted identically across the nine directions and both variants.
These are not physical-phone, normal rendering-policy, cadence or animation proofs.
Two composer renders per observation are expressly diagnostic. No movie was made.

## Attempts preserved

1. Attempt1: exact product/app built. The first pair failed strict light equality.
   A read-only rerun on that exact host found stale pre-render DirectionalLight
   world matrices; the native and source scene-render observations were identical.
   Original error report, raw geometry, light diagnosis, pin and host remain.
2. Attempt2: snapshot timing fixed without changing lights. Nine pairs passed
   transport/identity/root/light checks, but direct image review found only four
   useful pairs: top plus all four elevated views showed the actual ceiling.
   Its `completed: true` means transport completion only. Separate immutable
   `visual-completeness.json` explicitly records four usable and five occluded.
   Camera distance 20.26 put top y = 922.08/elevated y = 914.48 above the y = 909 ceiling.
   The complete fourteen-file editable source snapshot matches its pin hashes.
3. Attempt3: adds tested camera preflight, not hidden room geometry. Exact arena
   bounds are verified against `TrainingArena.ts`: x/z ±50, floor 899.97, ceiling 909.
   All nine camera positions must stay inside with 0.5 m safety margins and all eight
   character-box corners must project inside the image and near/far planes.
   A single 95° FOV and distance 6.481802 m fit all nine; top camera y = 908.304196.
   The former 35° fit is a negative test. A separate warm-character pixel guard
   rejects the blue ceiling, followed by direct inspection of all eighteen images.
   All checks pass; all previous failures remain unchanged.

The initial default heavy-lane invocation failed before building because its
home location was read-only. Subsequent builds used the established shared lane,
existing installed tools and approved browser. No alternate lease namespace,
reinstallation, engine/schema exemption or room hiding was used.

## Actual post-facet measurements

- All 19,710 position components, 26,280 skin indices, 26,280 weights and 6,570 fur
  lengths are exactly equal to the selected normal-bearing input.
- 19,503 of 19,710 normal components differ; many differences are floating-point
  normalization. At a meaningful 1° threshold, 75 vertices / 25 triangles differ,
  with maximum 84.138266°. Exact source normal preservation ends before this stage.
- All 19,710 linear color components differ, maximum absolute component 0.116593,
  consistent with the actual facet-color treatment. Shader/material/tint differences
  are additional disclosed appearance differences, not proof of source-material parity.

## Final evidence and independent-review handoff

Successful raw pairs and observations are under
`tmp/conch-selected-view-qa/attempt3/`:

- Eighteen `<view>-native.png` and `<view>-source.png`, untouched renderer canvases.
- Nine `<view>-observation.json`, including room/projected bounds and per-pass lights.
- `actual-runtime-geometry.json`: actual post-facet attributes, materials and bind data.
- `report.json`: exact pre/post source/product/host identity and all image hashes.
- `verification.json`: separate numeric recheck plus author capture-completeness
  inspection; quality review remains pending.
- `phone-rest-diagnostic.png`: browser screenshot with explicit diagnostic label.

Exact successful artifacts:

- Input normal freeze: `a1e13c4fb4a62a5bba2ab978621d9cf955c031e0eed8b1d237cbec8811baba60`.
- Pin: `tmp/conch-selected-view-attempt3/reviewed-build-pin.json`,
  SHA256 `3c21d5a45e2e308471097263769de54e514196e19ce424aedbb13362d9cdad57`.
- Host: `tmp/conch-selected-view-dist-attempt3/`.
- Host inventory SHA256 `6b9375aa5b718f1c52ea10a0bfb04b3c16f9e066fecd8c693e06cdb4e3bdb00a`.
- Report SHA256 `0dfd2416a5b4e48eee810eed20c97c15e2f12fc0ef7a21e79fdeef0bed669bd8`.
- Verification SHA256 `00186d23cb1256dea96e371b512650f18616171f1f1b96746399bd189820d0c0`.

A fresh reviewer should view the approved concept first, then all nine native
images independently, then the matched source images. Rehash the evidence and
inspect the actual source/native material differences. Do not inherit the source's
4.05 score, equate source/native geometry with shading equivalence, or treat these
constant-rest captures as movement, combat, contacts, phone performance or owner
acceptance. No score or promotion is supplied by this capture task.

## Verification and boundaries

- Focused Vitest 3/3: real rest schema/evaluator, isolated catalogue, actual
  packed→merge→facet behavior and exact non-normal/color channels.
- Node admission/identity 4/4, camera-preflight 3/3, Python visibility 2/2.
- Adapter/helper syntax checks pass. Repository oxlint excludes art paths and
  reports no files; no lint/full-suite/full-typecheck pass is claimed.
- Product and app builds succeeded under shared heavy leases; exact host capture
  passed source/product/host verification before and after. Browser/server closed.
- Source prep is below 3 MiB. Preserved builds, failed attempts and captures total
  approximately 53.4 MiB, below root's revised 60 MiB allowance.
- No native visual/animation/gameplay acceptance, Site change, deployment or
  publication was performed by this task. Root owns any source checkpointing.
