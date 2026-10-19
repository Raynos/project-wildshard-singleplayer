# Colossus V4 native22 arena candidate1 — source scaffold

Selected static source remains V4 (3.65). This isolated native motion1 candidate is
**unaccepted WIP**, not a newly arena-ready enemy. Original nine native/source
comparisons, material/culling caveats and folded shin triangles remain unchanged.
Seam1 is not exported or selected. No art polishing occurs here.

## What this candidate supplies

- Original native JSON/payload referenced at `../v4-skin1`, with exact SHA256 and
  bytes. No duplicate geometry export. New metadata changes only measured dimensions.
- Conservative named trunk-core capsule: radius 2.273838, half-length .005093;
  mask-only head sphere 1.110766. Body bind Y stays 2.28. Decorative crown/foliage,
  limbs and mantle are excluded. These are measured candidates, not accepted hit volumes.
- New bind-aware 22-joint channels for stationary idle, left/right sweep, slam,
  hit, death and retry reset. Every joint has numeric motion. Roots, fingers and
  foliage retain their original weighted fields; no rigid-part approximation.
  The existing boss has walkSpeed=0, so no fabricated walking gait is advertised.
- Complete time-driven strike active windows (.25/.25/.18 seconds) and original
  `tide-root-colossus.as` plus all three strike definitions retained unchanged.
  Root recoil ownership is authored-pose. No absent heart/cage/crown sockets.
- Separate product and application routes based on the existing practice host,
  one guest, native body, held wood weapon, coin reward and neutral-gray-v2 light.
  No island generator, persistent quests, encounters or ledger content.
- Exact-path admission refuses missing/foreign inputs, hash/size drift and any
  attempt to turn acceptance flags true. No engine or other-creature edits.

## Focused measurements and blockers

The actual THREE skin sweep covers 366 sampled poses × 15,600 vertices, including
4,384 multi-influence vertices. It compares each vertex to the weighted matrix
sum, using all 22 joints rather than assigning each of the 12 batches one joint.
Local minimum Y is .027m in all six sweeps, with no vertices below −.005m.
Maximum radial reach: idle 2.585, left 3.929, right 3.935, slam 3.929m.
The original strikes remain radius 4.7m (sweeps), lane length 6.2m (slam), range7.
These numerical differences are explicit reach-review blockers, not a claim that
visible hands match damage extents. `envelope.json` records the measurements.

The existing 13 exporter tests still pass, including shared foliage/limb fields,
continuous bands and digits, weighted joint use and immutable byte reproduction.
Those numeric attachment tests and the new skin sweep do not prove intersecting
meshes remain visually attached at torso/shoulder, hip, mask or palms. Matched
close-up motion/contact review is required. The generic corpse controller can
translate/rotate the entire model independently: local clearance proves no actual
world corpse contact. Death is only the authored pose component here.

No full application build, browser combat/reward/retry/storage test, independent
motion/attachment verdict, collider acceptance or physical-phone measurement has
been performed for this candidate. Shading, DoubleSide and cyan eye/heart emission
remain explicit source-to-native semantic-loss blockers.

## Reproduce (root grants the heavy lane separately)

Lightweight:

```sh
python3 art/driftwood-isle/lowpoly-colossus/runtime-admission/arena-candidate1/measure.py
node --test scripts/colossus-native-admission.test.mjs
node_modules/.bin/vitest run test/colossus-native-preview.test.ts test/colossus-native-envelope.test.ts --maxWorkers=1
python3 -m unittest discover -s art/driftwood-isle/lowpoly-colossus/runtime-admission -p test_export_native.py -v
```

Build commands are prepared, **not run**:

```sh
WS_HEAVY_ROOT=tmp/heavy-lanes python3 scripts/heavy-lane.py build -- node scripts/build-colossus-native-preview.mjs tmp/colossus-native-preview/motion1
COLOSSUS_NATIVE_PREVIEW_DIR=tmp/colossus-native-preview/motion1 WS_HEAVY_ROOT=tmp/heavy-lanes python3 scripts/heavy-lane.py build -- node scripts/build-colossus-native-preview.mjs --app tmp/colossus-native-preview-dist
```

Future browser run must use the browser lane, existing supported headless shell,
shared HOME `tmp/home`, muted portrait viewport and fresh output. Root owns its
checkpoint and publication; this lane makes no remote or Git changes.

## Source checkpoint verification

Five focused Vitest tests pass (two files), two Node admission tests pass,
and all 13 original exporter/attachment tests pass. Focused type-aware oxlint on
the new generator, test, admission, build and Vite config files passes. Syntax
checks pass. This is not a full TypeScript project check or built product pass.
Death/retry snapshots compare numeric transforms with signed zero normalized;
there is no tolerance for positional drift or skipped animation state.
