# Keelmaw DI-N19: complete first source model

Owner-approved concept, first complete editable/native source milestone. **Not in game, not runtime-admitted, not visually accepted.** No likeness score is claimed.

## Source

`build_keelmaw.py` authors the entire faceted creature: broad crocodilian torso and pale belly, four bent legs with sixteen claws, open tooth-lined hinged jaw, amber slit eyes, golden snout keel, dorsal armor/crests, long curved three-part tail, nautical rope and genuinely hollow barnacle shells. Native +Y up/+Z forward maps into Blender as `(x,-z,y)` without reflection. The script is the editable source; no .blend is needed.

19 actual skin joints, 19 native parts, 7,080 triangles. Limb joints remain planted in this first pose source. Components overlap at anatomical joints; this is an articulated assembly of closed solids, not one welded biological manifold. Skin weights are intentionally rigid one-bone weights, not blended organic deformation.

`v1/keelmaw-v1.glb`: 932,800 bytes. `v1/native-source.json`: 1,526,834 bytes. `v1/payload.bin`: 61,572 bytes. `prepare_corpse.py` derives the existing seven-hull rigid-corpse recipe from exact mesh convex hulls; no padded boxes. Body hull includes the static leg descendants. Animated neck, head, jaw and three tail joints have their own hulls. One native physics body, seven shapes, 392 support points. No solver changes, root lifts, added callbacks or runtime writes.

## Real verification and limits

- `audit_source.py`: all actual GLB/native positions, linear colors, skin assignments and oriented triangles agree; every component has consistent outward closed winding; materials are single-sided; nine numerical culling projections agree; actual inverse binds close. These are source checks, not visual acceptance.
- `source.test.ts`: strict shipping `packedCreatureBodies` consumes every typed attribute and recipe; shipping numeric pose compiler drives idle, bite anticipation/closure/recovery, hit and fixed death closure. 244 weighted frames / 5,182,560 corners clear authored ground by at least 6.866 mm, with independent skin error below 1.72e-7. No root position changes.
- `corpse.test.ts`: **FAILS the independent 5 mm contact gate.** Actual existing Rapier/Physics/Ragdolls/RigidCorpsePose, four lethal phases/directions, 480 ticks each, unchanged parameters. Fixed penetration: 26.38 / 11.78 / 3.13 / 13.59 mm; interpolated: 23.21 / 10.04 / 2.59 / 10.85 mm. One of four passes. Raw trajectories and the failed assertions are retained. Hull coverage is not contact acceptance.
- Living body/head volumes are core-only; feet/tail/crests are intentionally not expanded into vulnerable hits. Current provisional bind dimensions still under-cover the forward snout and a narrow 30 mm torso strip. Rest torso coverage is 96.55%, belly and neck 100%, upper snout 70% of authored corners. Full weighted per-joint coverage is in `weighted-pose-audit.json`. Facial hit design needs a reviewed bind/shape decision; no full facial-hit-fidelity claim.
- No walk/run locomotion clip, behavior controller, attack hit declaration, spawn, runtime catalogue, rewards or gameplay product has been authored here. Visible bite motion alone does not prove contact timing or reach. Slope, moving ground, corpse pile, native browser, phone, gameplay and performance acceptance are untested.

## Render evidence

`v1/hero.webp` and nine named angles are actual source renders. `paired-hero-board.webp`, `world-paired-nine-board.webp` and `explorer-paired-nine-board.webp` explicitly pair the owner-approved AI references with actual geometry. The original hero remains authoritative; AI hidden surfaces and side-camera estimates are approximate. These are not native gameplay captures. Earlier camera-facing mismatch evidence is preserved in `initial-camera-review/`.

The source silhouette captures the quadrupedal crocodile, keel mouth and crested curled tail. The actual model still has more regular tiles, simpler limbs, thinner rope, less dense barnacle clustering and a narrower/longer face than the approved hero. Those differences require visual review; no numeric likeness was invented.

## Reproduce

Use the shared heavy lane with Blender, this producer and a new `--out` folder, plus `--render`. Raw captures for each successful pass occupy about 7.3 MiB. Keep failed outputs; do not overwrite another pass. Copy final artifacts into a new version, run `prepare_corpse.py` for the current v1 target, then `audit_source.py <version-directory>`. Run focused tests with `vitest run --config art/driftwood-isle/approved-keelmaw/vitest.config.ts`. Current expected report is two source tests passed, one genuine contact admission test failed. No app/product build is needed for these checks.

Failed producers and their logs remain: `build_keelmaw_failed_size.py` (1,552,176-byte export), `build_keelmaw_failed_join.py` (removed-object reference), `build_keelmaw_failed_size2.py` (1,040,548-byte export). Their output tuples remain in the named ignored task scratch folders recorded in `checkpoint.json`; oversized failures are not promoted into repository binaries.
