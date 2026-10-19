# Colossus V4 exact native preparation

This is a build-only geometry and derived-rig candidate, **not** arena admission.
V4's fresh independent full-nine static likeness score is 3.65. Its source model
is preserved without further art changes. Runtime appearance, motion, contacts,
combat, reward/persistence and physical-phone performance remain unaccepted.

## Frozen geometry and consumer

`export_native.py` pins `build_colossus_v4.py` at
`f10cdec46537f8d579fa7af687890aebe6c2f0e9d82c962e64a478567e3a0218`
and the ordinary `tide-root-colossus-v4.glb` at
`8c94ed4a452f10ca5c9e1e663c7437c2905e42b90bf5abe9faaf970391a8189b`.
There is no Blender run, decimation, new triangulation, recoloring, rescaling,
axis reflection, normal repair or winding reversal. The GLB already uses native
right-handed `(x,y,z) = Blender (x,z,-y)`, with +Z front. Its 227 mesh nodes all
have identity world transforms; the decoder bakes the actual scene translations
and fails on unsupported rotations/scales/matrices rather than ignoring them.

All 730 material primitives, 5,200 ordered rest triangles and 15,600 unindexed
vertices are preserved. The map retains node/primitive IDs, ordered per-part
vertex ranges, source world translation and explicit ownership. Global node
order is recoverable through the map, although batching groups semantic regions.
Every linear glTF base-color factor is copied unchanged into `colorsLinear`.
The native JSON is 2,395,775 bytes; the packed payload is 76,711 bytes. JSON hash:
`32c4f9b55c5303e75877c8abae7765947a3814c39bb15d3c7a0046e61cb93641`.
Packed payload hash:
`bfb9cd8333fb8ba2b17209a51126e26cc5c1e56a521627fc68910af86b506e46`.

The existing `approved-puffer/native_export.py` build-only codec packs a temporary
schema view; this candidate retains its own `wildshard.colossus.mesh.v1` schema
and `tideRootColossus.tide-root-colossus` consumer identity. No Puffer source,
app, admission allowlist, engine, Site or production catalogue is changed.
The 12 hard batches are body, head, left/right arms, left/right legs, and their
six corresponding foliage batches. There are no eye/fur batches. Existing
`packedCreatureBodies` consumes every attribute, and `AnimalFactory` ordinarily
merges hard geometry in its native low-poly path. Twelve batches is **not** a
measured draw-call or phone-performance claim.

## Explicit derived rig and attachment contract

Neither the source nor GLB contains an authored rig, weights or pivots. Named
source anatomy is the only semantic metadata. `v4-skin1/rig-provenance.json`
records the exact source station for each **derived** pivot, in both frames.
All 22 bones have identity bind orientation and absolute native bind positions:
body; head; and per side arm → forearm → hand → four independent digits
(outer, middle, inner, thumb), plus leg → shin → foot. Body is the sole root.
Crown, eye inlays and mask follow head; the heart and interwoven chest/back roots
follow body. These are intentional future-motion boundaries, not recovered
Blender animation axes. All joints affect nonempty geometry.

Do not split whole roots into disconnected rigid upper/lower objects. The arm
and leg roots cross multiple joints. Every vertex uses a documented spatial
linear-blend field, with at most three nonzero influences, retaining each source
triangle. Native Y bands, listed from low to high:

- Arm hand/forearm: 1.50–1.95; forearm/arm: 2.70–3.10;
  arm/body: 3.70–4.20. Between bands the corresponding segment is rigid.
- Leg foot/shin: 0.35–0.80; shin/leg: 1.10–1.65;
  leg/body: 1.95–2.45.
- Neck rear root body/head: 3.73–4.15. Remaining face, crown and nape are rigid
  head regions, preserving the eye inlays and mask together.
- Finger influence fades continuously into the common palm field over these
  low/high bands: outer 0.95–1.16, middle 1.22–1.54, inner 1.21–1.52,
  thumb 1.25–1.74. Below the low end it is rigid finger. The outer digit belongs
  to the continuous `Forearm main to outer claw` source mesh. Finger influence
  multiplies the underlying palm field; it does not abruptly replace it.

Foliage ownership is explicit and exhaustive: outer shoulder, elbow and forearm
patches use their side's arm field; hip and shin patches use their side's leg
field; rear nape follows head; collar, back mantle, spinal, low rear hip and
forward rib patches follow body. Each living seam and every blade uses the same
field as its named region. There are no independent foliage joints or floating
leaf animations. Tests prove coincident points within each limb/foliage region
receive identical transforms, with continuous weights at all band boundaries.
Unknown anatomy names fail closed.

**This does not prove that existing overlaps remain attached under motion.**
These meshes intersect rather than forming a welded skin. Distinct region
boundaries at torso/shoulder, torso/hip, neck/mask and palm/digits still require
matched close-up deformation/contact review. The field may bend leaves or
embedded stones; preserving a rigid rock instead would change its attachment
contract. No visual or anatomical correctness is claimed from numeric LBS alone.
Keep arm/leg/foliage attachment review as a blocker before any clip or gameplay
admission; do not hide a separation with detached rigid motion.

## Preserved normal and material caveats

`source-normal-caveats.json` records 1,733 triangle/stored-polygon-normal
cosine deviations below 0.999. Three triangles in `Shin growth -1 living seam`
oppose their stored polygon normal (minimum cosine −0.18608508391712192).
Each has same-normal shared-edge companions, supporting the nonplanar/folded
source-polygon ambiguity. There are zero degenerate triangles in the pinned GLB.
No triangle was reversed, welded, removed or otherwise repaired.

All 15 source materials are double-sided. `heartLight`, `heart` and `eye` also
carry nonzero emissive factors. Exact material records are retained in
`v4-skin1/source-materials.json`, indexed by the primitive map. The packed body
schema does **not** carry these emissive factors or per-part sidedness; this is
an explicit loss in appearance semantics, not a silent approximation or claim
of material equivalence. Existing flat native shading recomputes triangle
normals, and toon grading/instance tint differs from Blender Standard. Do not
make global engine changes to conceal this. Exact-rest geometry parity is
established; native appearance and culling acceptance remain blocked.

## Diagnostic dimensions and incompatible old clips

Dimensions exist only to exercise the codec. Body bind height is 2.28; the
conservative rest capsule has radius ≈3.63996 and half-length ≈1.23373, head
sphere radius ≈2.26227 and half-width ≈2.55889. Sole centers derive from the
actual lowest leg vertices. These oversized bounds enclose the rest geometry;
they are **not** collider acceptance, hit volume, foot contact or gameplay tuning.
No floor correction was applied. Animated envelope, ground/corpse clearance,
limb reach and body/head hit volumes require separate measured approval.

Do not reuse `generators/tidalGiantsClips.ts` Colossus clips. They target absent
`crown`, `heart`, `cageL/R`, `root0..3`, `bend0..3` and `tip0..3`, hardcode body
Y=1.5 instead of 2.28, and scale roots/cages of a different body plan. Do not
rename current joints to pretend that contract fits. New bind-aware clips,
explicit root/flinch ownership and reviewed gait, attacks, hit, death and retry
are required. Heart scale pulses or opening cages are not implemented here.
Future isolated arena work must retain nonpersistent quests/rewards/boss state.

## Focused proof and reproduction

- 13 Python tests: exact pins/topology/map, all packed attributes, explicit
  ownership, shared foliage fields, continuous bands/digits, all used joints,
  bind/axes, diagnostic bounds, fail-closed mutations, normal/material caveats,
  complete byte-for-byte output reproduction and closure hashes.
- 4 Vitest tests: independent real `GLTFLoader` ordered positions/linear colors/
  world transforms and exact source caveats; real `packedCreatureBodies` byte
  attributes and fresh geometry; actual THREE `SkinnedMesh`/`Skeleton` all 22
  joints compared vertex-by-vertex against an independent analytic LBS oracle;
  and identity/preload/truncated payload refusals. The rotation probe is 0.15
  radians per joint, with unaffected vertices checked and return to rest.
- These tests pass. The numeric probes are not authored animation or render
  proofs. No full suite, app build, browser, Blender, collider, combat or physical
  phone run was performed. Vitest transpilation is not a typecheck; repository
  lint excludes `art/`, so no ignored-file lint success is claimed.

From the repository root:

```sh
python3 -m unittest discover -s art/driftwood-isle/lowpoly-colossus/runtime-admission -p test_export_native.py -v
node_modules/.bin/vitest run art/driftwood-isle/lowpoly-colossus/runtime-admission/native-consumer.test.ts --config art/driftwood-isle/lowpoly-colossus/runtime-admission/vitest.config.ts --maxWorkers=1
python3 art/driftwood-isle/lowpoly-colossus/runtime-admission/audit_source_normals.py
```

The focused Vitest configuration inherits normal repository setup/lane checks,
without overrides. Supply the explicit test filename. To reproduce outputs, run
`export_native.py --out` with a new child directory inside `runtime-admission`;
existing destinations are refused. `source-closure.json` freezes this complete
local preparation and `v4-skin1/closure.json` freezes the emitted geometry tuple.
Root owns publication. This lane makes no Git or remote changes.
