# Bellback V6 native preparation, not arena admission

## Frozen reference

The exact V6 editable source and GLB are SHA-pinned in `export_native.py`.
The producer performs no Blender run, source-model edit, winding correction,
recoloring, simplification, rescaling or runtime write. It decodes the final GLB
with baked scene translations; its glTF coordinates already map Blender
`(x,y,z)` to game `(x,z,-y)`. Front is game +Z. There is **no additional axis
reflection and no winding reversal**.

`v6-rigid1/closure.json` records the exact native JSON, map, diagnostic dimensions,
metadata and packed payload hashes. It also pins the producer and the existing
Puffer build-only codec it imports. The Bellback source has its own schema;
only a temporary in-memory codec view uses the existing validator's schema.
Packed metadata is explicitly `bellback.bellback`, never a Puffer identity.

- 73 source meshes / 166 material primitives / 4,458 original triangles
- 13,374 unindexed native vertices; eight hard parts; no eye/fur parts
- 1,785,350-byte editable native JSON; 38,760-byte compressed packed payload
- All ordered triangle vertices and linear material colors survive independent
  `GLTFLoader` decoding and the actual `packedCreatureBodies` consumer.
- The eight hard parts remain separately weighted regions. `AnimalFactory`
  ordinarily merges these into its existing one-material body geometry; eight
  parts is **not** a measured draw-call claim. No phone performance is claimed.

The exact native JSON hash is
`21eb128ec5b34a61df27cddb3b54a89e5982213eeb56e48256d8697088018fa6`.
Packed bytes hash is
`518a350a2c49349f5b5d3a6c03324bcc5c18b6e0edf085350c4dcff79970d9fb`.

## Rig and motion boundary

Bone order is body, head, bell, clapper, leg0, leg1, leg2, leg3. Every vertex
has exactly one unit influence on its semantic part. Absolute bind pivots retain
the GLB's seven authored pivots. Body is the only root; head/bell/legs descend
from body; clapper descends from bell. Leg0/1 are left/right fore, leg2/3 hind.

V6 put clapper stem/weight under the bell pivot. This native reference introduces
one separate clapper joint at the authored stem attachment, computed from V6's
`bp((0,0,1.19))`: `[0, 2.910570230503482, -0.395]`. The reparenting changes no rest
vertex. Head pivot is `[0,1.2000000476837158,0.6499999761581421]`; body bind height
is `1.2000000476837158`; bell pivot is approximately `[0,3.05,-0.475]`.

Actual THREE skeleton/skin tests exercise each rigid joint and prove expected
isolation, including bell carrying clapper, clapper moving alone, body carrying
all children, and return to rest. These are bounded transform probes, **not**
authored clips, motion review or an animation acceptance.

Do not reuse `tidalGiantsClips.ts` unchanged: its Bellback source targets missing
`cradle` and `knee0..3`, hardcodes body Y=1.05, and was authored for a different
bell, limb geometry and rig. A later numeric pose must use this exact bind table,
body height from measured dimensions, and separately reviewed gait, windup,
pulse/echo, stomp, flinch and death. Do not copy Puffer gait or its continuity
adapter. Root flinch ownership must be explicit and tested, without stacking
new authored recoil over the engine recoil.

## Open geometry/material admission blocker

`source-normal-caveats.json` preserves all 14 exact node/primitive/triangle IDs,
positions, three identical stored normals, normal alignment and same-normal
shared-edge companions. Eight triangles belong to Barrel timber hull, five to
Lower timber jaw and one to Crown tie. Each opposed triangle has a positively
oriented companion sharing an edge and the same authored polygon normal.
These are folded/nonplanar polygon ambiguities, not a demonstrated uniform
winding mistake. The crown-tie cosine is only −0.096 (companion +0.554).

**No winding repair was produced.** The exact source and native reference retain
all defects. The source preservation test now explicitly expects this recorded
source defect set; a pass is not a normal-validity claim. Root will separately
bound any source patch and require actual source/native visual comparisons.

All GLB materials have doubleSided=true. The packed-body schema does not carry
per-part sidedness. The existing native flat/toon path computes facet normals,
uses the game's grading and instance tint, and is not Blender Standard. Do not
silently make the engine double-sided to conceal the folded polygons. Rest
geometry parity is established, but appearance/culling/shading parity remains
open and blocks promotion.

## Dimensions are diagnostic only

`diagnostic-dimensions.json` supplies the explicit dimensions needed to test the
codec, with body Y from the actual pivot and foot centers from actual sole
vertices. Its capsule conservatively contains the full rest hull, including
the high frame: radius ≈2.3041 and half-length ≈1.7766. Its head sphere contains
all head-weighted horns/details (radius ≈1.6072). These deliberately oversized
bounds are **not gameplay tuning** and must not be admitted into a bout as-is.
Body contact, head hit volume, articulated foot contact, animated envelope,
corpse ground clearance and collision reach require separate measured approval.

## Exact proposed later isolated product closure

No product, app bundle, admission allowlist or Site was changed by this work.
After geometry and dimensions approval, root can create a Bellback-specific
build-only source entry following `generators/pufferNativePreview.ts`, with an
exact new descriptor and fresh output directory. Do not feed this tuple through
the existing Puffer admission or relax its checks.

The bounded allowlist is:

- one species `creature.bellback`, kind/variant `bellback`, HP 180;
- one actor `driftwood.bellback`, no home/boss/world placements;
- one guest `driftwood.bellback.decision`, from existing `behaviour/bellback.as`;
- one move `bellback.approach`;
- three unchanged strikes: `strike.bellback.pulse`, `.echo`, `.stomp`;
- shared numeric fields required by that guest: `tg-state`, `tg-clock`,
  `tg-awake`, `tg-phase`, `tg-exposed` (all five are declared aliases);
- one native packed body, one measured dimensions receipt, one reviewed numeric
  pose blob `poses/bellback.json`, one look with body/head/bell/clapper sockets;
- existing held wooden sword arms, existing creature material graphs and only
  the coin geometry needed for a 12-coin **bout-local** reward;
- compile only the selected Bellback guest with `prepareProjectOutput`, then
  `writeOutputProduct` and `validateOutputProduct`, preserving exact receipts.

No Colossus, regular enemy, full-world generator or production catalogue import.
No quest/flags/boss mutation. Bellback's `tg-awake` death write is a guest field,
not authority to alter a world boss. Keep the existing practice flag-authority
refusal in `PracticeDecisions.ts`; do not add flags or flag commands.

Consumer remains existing `preparePracticeContent` → `packedCreatureBodies` →
`AnimalFactory` / `numericCreaturePose` → `PracticeCreature` / real strike and
combat paths. `startPracticeDemo` installs `storage:()=>null`, `persistent:false`;
`PracticeLoot` owns an ephemeral receipt, not a world purse. Keep those paths.
Any future Bellback Vite config must use its own pinned input/product closure,
`__SAVE_NAMESPACES__=[]`, exact validation verdict, fresh output directory and
only its real asset byte/hash tables. The current Puffer app and Site stay intact.

Before root admits the exact native/dimensions/clip/product tuple: compare matched
source and real-native views, walk around, inspect all articulation/contact,
execute pulse→echo and stomp, check poise interrupt, hit/death and no post-death
strike, collect 12 local coins once, retry to fresh 100/180 health, check all
persistence stores empty, and verify no other species/guest can be selected.
Performance and fun remain untested until measured; cloud phone-size rendering
is not physical-phone performance.

## Reproducible source checks

From the repository root:

```sh
python3 -m unittest discover -s art/driftwood-isle/lowpoly-bellback/runtime-admission -p test_export_native.py -v
node_modules/.bin/vitest run art/driftwood-isle/lowpoly-bellback/runtime-admission/native-consumer.test.ts --config art/driftwood-isle/lowpoly-bellback/runtime-admission/vitest.config.ts --maxWorkers=1
python3 art/driftwood-isle/lowpoly-bellback/runtime-admission/audit_source_normals.py
```

The custom focused test config imports the repository's normal lane checks and
setup. Supply the explicit test filename (omitting it correctly triggers the
full-suite lane guard). There is no guard override. Repo lint ignores `art/`,
even with `--no-ignore`; a no-files result is **not** a lint or typecheck pass.
No full suite, app build, Blender run or browser/render proof was executed.

To reproduce native outputs, invoke `export_native.py --out` with a **new** child
folder inside this runtime-admission directory. Existing destinations are refused.
Root owns source checkpointing; this lane makes no Git or remote changes.
