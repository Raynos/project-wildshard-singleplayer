# Conch character-pass native preparation

The fresh full-nine 3.57 static visual pass is preserved. This is geometry/rig
preparation only, not animation, runtime, collider, combat, fun or phone approval.
No selected source, GLB, existing model, engine, Puffer app or Site was edited.

## Exact inputs and output

The producer pins source `build_conch_character_pass.py` SHA-256
`3c5771598f49b41d5bd3dde55977d693fc42b4ca921cc7eafa93a13542c00d5b` and ordinary
`conch-character-pass-study.glb` SHA-256
`214617350694ee61e43127eecf2ffe11ae484cff9ee1edfd86e3574ce4252c5d`.
No Blender rebuild is needed. It decodes the exact 56 meshes / 108 primitives /
2,446 ordered triangles, retaining all 7,338 expanded positions and linear RGB
factors. Native JSON is 1,010,414 bytes; the zlib packed payload is 25,351 bytes.
The output is ordinary files in `character-pass-native1/`, not an archive.
`mesh-map.json` records node, primitive, material and native vertex ranges.
`closure.json` pins outputs, producer and existing Puffer packing codec. Only a
transient view uses that codec's schema; the saved schema is Conch-specific and
packed identity is `conch-duelist.conch-duelist`.

Transforms are preserved, not fitted to old gameplay. The source explicitly
mirrors X and flips/recalculates polygons before exporting. glTF then maps
Blender (x,y,z) to (x,z,-y). The resulting character faces **-Z**, unlike the old
placeholder's +Z convention. There is no additional reflection or winding flip.
A later motion/product owner must explicitly resolve facing without hiding a
change in this exact-rest export. All current GLB nodes have identity transforms;
the decoder supports translation and fails closed on unsupported transforms.

## Rig and derived weights

There are 15 topologically ordered absolute bind pivots with identity-oriented
bones: body, shell, head, two eyestalks, shield shoulder/forearm, rapier
shoulder/forearm, and two hip/knee/ankle chains. The source contains no authored
armature, pivots, weights or exported extras. `rig-provenance.json` explicitly
records all pre-mirror source attachment stations and mirrored glTF pivots.
Left/Right names follow original source sign, not final world X.

Named thigh, shin and foot/toe armor is rigidly assigned to hip, knee and ankle.
The continuous dark `Leg hinge` meshes receive a shared deterministic weight
field: nearest point on the hip→knee or knee→ankle segment, with endpoint weights
1-t and t. Repeated exact positions get identical weights. This avoids tearing
that single hinge into rigid pieces while preserving every rest vertex. It does
not establish acceptable joint deformation, armor overlap, contact or gait.
All other mesh pieces are rigid. Eyes and their overlays share their eyestalk.

The actual packedCreatureBodies consumer is exercised, then THREE Skeleton and
SkinnedMesh test every joint about X/Y/Z, verify influence/descendant isolation
and return to exact rest within floating-point tolerance. These rotations are
bounded transform probes, not authored clips or motion acceptance. Bone setup
matches absolute-pivot parent subtraction in AnimalFactory.instantiate.

Old driftwoodRegularClips are incompatible. They target `guard`, `thrust` and a
single `foot`, apply rapier scale stretching and do not articulate these leg or
eyestalk chains. Old body height .50 differs from 1.04; old facing also differs.
No clip is reused or silently renamed.

## Normals and layered surfaces

Read-only Python and independent GLTFLoader audits find zero degenerate and zero
opposed-normal triangles. Sixty-three triangles differ from stored polygon
normals below cosine .999; minimum cosine is .13694908417625526. Exact IDs and
cosines are in `source-normal-caveats.json`. This is not a general fold or
self-intersection proof. No winding or polygon repair is emitted.

The packed schema does not retain GLB normals or per-part double-sided material
settings. The eventual flat-shaded native path recomputes triangle normals;
all source materials are double-sided. Toon, tint and grading differ too.
Matched source/native visual and culling review remains necessary.

`layered-surface-caveats.json` audits exact-position edges without editing or
welding output. Twelve individual open surfaces are intentional: two nostrils,
and socket/back/lens/pupil/glint on each side. Each socket + separate back + lens
jointly has zero boundary and nonmanifold edges. Pupil and glint remain overlays;
they must not be auto-capped, deleted or treated as disconnected damage. All 56
meshes have zero nonmanifold edges under exact-position edge counting. This does
not prove absence of z-fighting or arbitrary inter-mesh intersections. The
approved source's shell-only crossing audit remains separately scoped.

## Boundaries and next admission

Dimensions cover the entire rest hull conservatively, with low foot samples and
head-only geometry bounds. They are diagnostics, not approved gameplay capsules,
reach, ground contacts or animated bounds; the head bound does not include its
eyestalk descendants. No native/runtime catalogue or allowlist was changed.

Before any playable admission: matched source/native views and walk-around;
new idle/walk/guard/windup/rapier/flinch/death clips with motion/contact review;
real isolated attack/hit/interruption/death/retry tests; and practice persistence
isolation. Preserve null storage, persistent:false, empty save namespaces,
bout-local rewards and no quest/flag/boss/world writes. Do not broaden another
creature's allowlist or substitute diagnostic dimensions as approved tuning.

## Reproduce focused checks

From the repository root:

```
python3 -m unittest discover -s art/driftwood-isle/approved-conch/runtime-admission -p test_export_native.py -v
node_modules/.bin/vitest run art/driftwood-isle/approved-conch/runtime-admission/native-consumer.test.ts --config art/driftwood-isle/approved-conch/runtime-admission/vitest.config.ts
python3 art/driftwood-isle/approved-conch/runtime-admission/audit_source_normals.py
python3 art/driftwood-isle/approved-conch/runtime-admission/audit_layered_surfaces.py
```

Export with `export_native.py --out` into a new child directory. Existing outputs
are refused. Root owns checkpoint/publication. No Git/ref/remote write, browser,
Blender, full-suite run, app build, typecheck or physical-phone test is claimed.
