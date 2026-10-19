# Mantis V7 native preparation, not arena admission

## Exact preservation

V7 has a fresh full-nine likeness score of 3.6025. That is a static visual pass,
not animation, gameplay or runtime acceptance. No further model polishing occurs
here. `export_native.py` pins the exact editable V7 source and GLB, and independently
pins `metrics-v7.json` plus `mantis-mesh-v7.json`. The GLB has no pivot/joint extras:
the latter two authored receipts supply these, rather than guessing from names.
All GLB positions are checked against their named authored mesh's original vertices.

The producer decodes only this opaque translation-only GLB. glTF has already
mapped Blender (x,y,z) to game (x,z,-y); front is game +Z. There is no second axis
reflection, winding reversal, rescale, simplification, recolor or polygon repair.
It retains 75 meshes / 213 material primitives / 2,662 ordered triangles / 7,986
unindexed vertices as 22 rigid-weighted native parts. `mesh-map.json` maps every
source node, authored joint and individual material primitive to its native
part and ordered vertex interval. Original linear material factors are retained.

`v7-rigid1/closure.json` hashes the ordinary native JSON, packed metadata/payload,
mesh map and diagnostic dimensions, and pins the producer and existing build-only
Puffer codec. Mantis uses `wildshard.mantis.mesh.v1`; only an ephemeral codec view
uses that validator's schema. Packed identity is explicitly
`splinter-mantis.splinter-mantis`, not Puffer or Bellback. No source schema or old
clip is silently substituted. The compressed payload is 28,370 bytes, editable
native JSON 1,082,991 bytes. The packed consumer's eventual merge is not a measured
draw-call, runtime-memory or physical-phone performance result.

## Explicit rig boundary

`rig-provenance.json` records all 22 absolute game-space bind pivots and parents.
Twenty retain exact authored float32 metadata. Two are explicit derived centers
of V7's first loft stations: neck Blender (0,.38,1.40), abdomen (0,.14,1.47).
Body is the only root. Neck carries its existing bark/ridge/collar/shell geometry,
head and both shoulders. Abdomen carries core, tergites and lateral tail splinters.
Coxal shields remain body-weighted. Four leaf wings retain independent authored
pivots. Each of four walking legs has authored hip and knee; each raptorial limb
has shoulder, elbow and hook. Tarsi remain knee-weighted: there is no independently
articulated ankle yet. This is an honest future-motion preparation, not a claim
that overlaps, bending or ground contact look correct at arbitrary joint angles.

Every region receives one unit influence. Actual THREE Skeleton/SkinnedMesh tests
exercise all 22 joints, prove rest preservation and exact descendant isolation,
then restore rest. These bounded rotations are transform probes, not clips or a
motion review. Neck/abdomen separation changes no rest triangle. Continuous
prothorax remains rigid; later natural neck bending would need a separately
reviewed skinning decision, not an unrecorded edit to this closure.

Existing `driftwoodRegularClips.ts` Mantis clips are incompatible: body Y=.86
versus this exact 1.399999976158142; joint targets armL/R, hookL/R, legL/R0/1 and
kneeL/R0/1 do not match this rig. They omit the new neck/abdomen/wing hierarchy.
Do not reuse or rename their targets as an animation acceptance. New authored
idle, walk, windup, alternating sickle attacks, flinch and death need measured
contact/clearance and continuity. Root flinch ownership must avoid doubled recoil.

## Normal, folding and material caveats

The independent GLTFLoader and Python audit find zero degenerate triangles and
zero triangles opposed to stored polygon normals (unlike Bellback's 14 opposed
cases). No winding repair is emitted. This is not a general solid/watertight or
self-intersection proof; authored polygon-edge metrics are separate from triangle
normal consistency.

437 triangles have geometric-face / stored-polygon-normal cosine below .999;
the minimum is .4094854530691898. `source-normal-caveats.json` retains exact
node/primitive/triangle IDs and cosines for all 437, plus the empty opposed set.
Nonplanar authored polygons therefore remain a visible shading caveat even with
consistent orientation. The packed schema carries no normal channel, and the
native flat path recomputes triangle normals. All GLB materials are double-sided;
packed parts carry no per-part sidedness. Native toon/grading/instance tint also
differ from the source presentation. Matched source/native visual/culling proof
is still required. Do not change engine sidedness or source winding to hide this.

## Dimensions and later admission

Diagnostic dimensions conservatively cover the full rest hull and head-weighted
geometry. Foot centers derive from low tarsus vertices, not old gameplay tuning.
They are not approved colliders, reach, walk contact or an animated envelope.
Collider and head bounds are deliberately conservative and need measured tuning.

No current model, app, shared engine, Site, Puffer product, admission allowlist or
runtime catalogue was changed. No browser, Blender, full suite or app build ran.
Root must separately bound a fresh Mantis-only practice product and reviewed
native/dimensions/clip tuple before admission. Preserve practice `storage:()=>null`,
`persistent:false`, empty save namespaces, bout-local loot, no world placements,
quest/flag/boss writes, and the existing flag-authority refusal. Do not broaden a
Puffer or Bellback allowlist. Before promotion: matched native views, walk-around,
articulation and ground contacts, alternating real attacks, interrupt/flinch,
hit/death/no post-death strike, retry and persistence-isolation proof are required.

## Reproduce

From the repository root:

```
python3 -m unittest discover -s art/driftwood-isle/lowpoly-mantis/runtime-admission -p test_export_native.py -v
node_modules/.bin/vitest run art/driftwood-isle/lowpoly-mantis/runtime-admission/native-consumer.test.ts --config art/driftwood-isle/lowpoly-mantis/runtime-admission/vitest.config.ts --maxWorkers=1
python3 art/driftwood-isle/lowpoly-mantis/runtime-admission/audit_source_normals.py
```

The focused config retains normal lane guards/setup. No override. Export with
`export_native.py --out` and a new child folder inside runtime-admission; existing
folders are refused. Root owns checkpointing and publication. No Git/ref or remote
write is part of this lane. Focused tests are not a full-suite or typecheck claim.
