# Nine Dragon Stack: measured port inventory

Status: OPEN, 2026-10-11. Baseline clean HEAD `f24a1a30c0f34344900f9f68f78d51c5b8bc3e86`; defining measure: `node scripts/shard-platform.mjs --json`.

G291/G294 before: **15,209 / 21,111 = 72.0430% custom**.
After the native Jian row slice: **15,208 / 21,111 = 72.0383% custom**.
After explicit grapple-mode admission: **15,212 / 21,111 = 72.0572% custom**.
After explicit native portal/director admission: **15,218 / 21,111 = 72.0856% custom**; 20% gate FAIL. The ten additional host admission lines are charged, not presented as a size reduction.
The frozen denominator is `nine-dragon-stack-legacy` at `8e297137b940f50da7f1949106d5576f80f238ca`. Current numerator: 14,309 authored shard TS lines, 1 additional GLSL line and 908 one-user platform lines. Embedded GLSL (3,205 lines) is already inside the TS numerator, not added twice. AS: 0. Generated data never counts. The template is not a second user.

Nine remains **transitional**: its gameplay witness/replay/ledger pass, but trusted TS still runs its simulation. The source-only export has no emitted shardfile product, so the content gate is unavailable; no tiles/collider/file completeness or finished 80/20 conversion is claimed.

## First slice: admitted Jian numeric profile

The native Jian now reads `items.rows[].profile` directly. Its former `vm/jianRow.ts` dependency and separate profile argument are removed; the page already composes the same declared numbers with its pose recipe. Missing melee profiles refuse before registering a step. The real `SweptMeleeCore` continues to own combo, charge, release and cooldown; no new combat algorithm or platform module was created.

A 2,000-tick real-Rapier oracle compares every adapter continuation field against the frozen native installer, including queued light taps, early/full heavy release and an exact mid-charge checkpoint suffix. A changed admitted cooldown actually changes the native clock. The historical Jian test now checks composed values plus identical pose-key/trail references, rather than the stale pre-composition move-container identity.

## Slice validation

- **44 focused tests / 12 files**, including the real native witness, replay, ledger and checkpoint suffixes; root strict and touched-file typed lint pass. The ledger fixture now names the already-shipped `modes` binding; rewards and durability assertions are unchanged.
- All **four** native witness recordings reproduce checkpoint payloads and outcomes byte-identically in the clean export.
- The official generator was run in both exports. All **148** Nine physics inputs are identical; the shipped **23 pieces / 31 hooks** are unchanged. The map input hash remains `5a02e32c2e7a8de42be17385aa31990b84df0c9fb12300590e10f1551ea0892f`. No collider or map rebake is needed for these runtime-only edits.
- Native entry coverage retains **92 capsule lanes / 8 portal transfers**, with no blocked lane. No new browser or full-suite claim is made per slice.

## Second slice: admitted grapple mode

The native plan requires the declared `modes.grapple` row and supplies it to the same `wellCourse`/`GrappleSim` used by the page. The page keeps its original authored default; native course hooks, Well visibility, guard, lift geometry, aim, callbacks and restored fields are unchanged. There is no second grapple algorithm or inferred course owner.

An 800-tick real-Rapier oracle matches every frozen native continuation field and restores an actual flight suffix exactly. A changed admitted range changes actual hook selection; an omitted mode refuses before plan construction. All 25 focused tests/5 files pass, plus the native witness, replay, ledger and checkpoint proofs. Strict and touched typed lint pass. The four witnesses are checked; the changed recording reproduces every payload and outcome exactly. The 148 physics inputs and map hash above remain identical, so no collider/map recapture is needed. Remaining native course adapters still count as custom.

## Third slice: admitted native portal/director root

Native entry admission already proved the supplied root, but native play constructed its ride from module-global shard.config. It now supplies the admitted entries, collision declarations and director directly to the existing page ride/playerRider law. The global world factory is no longer a native dependency; missing directors refuse before a step is registered. Portal fade/trigger values, callback order and native physics ownership are unchanged.

All 20 focused tests/4 files pass, including the real entry capsules, 10k-step row motion oracle, native factory comparison and held-phase restore. Mutating an admitted node changes actual native trigger selection; a declared false transition prevents transfer. The old factory and the new host emit the same gameplay ledger fact. Strict and touched typed lint pass. All four witness recordings are checked with identical payloads/outcomes; all 148 physics inputs and the map hash remain identical. No new platform algorithm, graphical change or compatible/20% claim is made.

After the landing freeze, rebased on `c673ec015` and repeated the 20 focused tests, strict and touched typed lint: all green. All four witness recordings remain byte-identical. The current 148 physics inputs are unchanged by this slice; the current map hash is `cb806256f74e67ec7983bbb63ee09aa1c33305c656372de0f51ff6a4009b2a36`, also unchanged by this slice (the generator path migration landed separately during the freeze).

## Remaining work

- **OPEN, non-visual:** native item/portal/grapple host adapters and continuation. Portal links and DIR stages already drive the native ride; grapple numeric modes already drive the shared law. The Well’s line-of-sight exception, cap owner and lift geometry require explicit course ports. Deleting those adapters without an equivalent row host would change gameplay.
- **OPEN, authoring:** an emitted structural world product and readable SDK generators must replace the remaining code-built world. Moving a runtime builder into `data/` or counting generated files as authored work is not a conversion.
- **WAITING FOR OPUS:** raw GLSL/materials, signs/font atlas, viewmodels/aim/HUD presentation, visual culling, portal veil, cloth/canopy, and final world/material pixel parity. These remain custom until genuinely replaced.
- **OPEN, shared ownership:** the one-user platform modules below count fully under G294. A second real shard must actually use them; no wrapper or template user removes that charge.

## One-user platform attribution

| Defining module | Lines |
|---|---:|
| `src/engine/audio/AmbienceBeds.ts` | 83 |
| `src/game/systems/viewmodel/armRig.ts` | 205 |
| `src/sdk/entries.ts` | 63 |
| `src/sdk/physics.ts` | 164 |
| `src/sdk/scene.ts` | 271 |
| `src/sdk/sceneAnimation.ts` | 44 |
| `src/sdk/sceneAudio.ts` | 50 |
| `src/sdk/spawns.ts` | 28 |

## Remaining authored TS by file

Paths are relative to `src/shards/nine-dragon-stack/`. This lists **all** numerator TS, not just the `runtime/` directory. Nonblank parser-counted lines reproduce the defining shard numerator exactly. `O` means graphical ownership WAITING FOR OPUS; `X` means non-visual host/data/generator follow-up. Neither label excludes a line from the metric.

| File | Lines | Owner |
|---|---:|---|
| `runtime/looks/look.ts` | 1230 | O |
| `runtime/looks/facadeLook.ts` | 577 | O |
| `runtime/looks/passes.ts` | 527 | O |
| `runtime/tools/grappleAim.ts` | 372 | O |
| `runtime/viewmodel/fpArmsRig.ts` | 334 | O |
| `runtime/signs/signAtlas.ts` | 329 | O |
| `runtime/looks/strandCloth.ts` | 328 | O |
| `runtime/looks/vmLook.ts` | 309 | O |
| `world/build.ts` | 307 | O |
| `runtime/signs/neonText.ts` | 300 | O |
| `runtime/tools/hookCourse.ts` | 270 | O |
| `runtime/kit/ruledKit.ts` | 260 | O |
| `runtime/kit/tangentKit.ts` | 246 | O |
| `runtime/looks/light.ts` | 228 | O |
| `runtime/looks/renderPass.ts` | 228 | O |
| `runtime/kit/sweptKit.ts` | 226 | O |
| `runtime/cull/instanceCuller.ts` | 225 | O |
| `runtime/kit/classKit.ts` | 222 | O |
| `world/hero/weapon-parts.ts` | 217 | O |
| `runtime/looks/streaks.ts` | 211 | O |
| `vm/jian.ts` | 210 | O |
| `runtime/looks/ropeFilament.ts` | 195 | O |
| `runtime/looks/canopy.ts` | 186 | O |
| `world/layoutBake.ts` | 185 | O |
| `runtime/looks/burstFx.ts` | 179 | O |
| `runtime/signs/glyphField.ts` | 179 | O |
| `look/render.ts` | 170 | O |
| `runtime/looks/hangingLanterns.ts` | 160 | O |
| `runtime/kit/propGlb.ts` | 149 | O |
| `runtime/looks/heroVm.ts` | 144 | O |
| `runtime/portals/walkInRide.ts` | 134 | X |
| `vm/swordSupport.ts` | 133 | O |
| `runtime/looks/paint.ts` | 113 | O |
| `manifest.ts` | 112 | X |
| `runtime/cull/figureCrowd.ts` | 111 | O |
| `world/facade/batch.ts` | 107 | O |
| `runtime/viewmodel/brushTrail.ts` | 106 | O |
| `runtime/looks/scroll.ts` | 103 | O |
| `vm/fpArms.ts` | 103 | O |
| `plugin.ts` | 98 | X |
| `runtime/looks/lightVolume.ts` | 95 | O |
| `world/jian.ts` | 94 | O |
| `runtime/looks/lanterns.ts` | 89 | O |
| `look/style.ts` | 83 | O |
| `runtime/cull/meshLod.ts` | 83 | O |
| `runtime/looks/paintArray.ts` | 79 | O |
| `runtime/looks/reflectionCards.ts` | 78 | O |
| `look/render/jiehua.ts` | 77 | O |
| `runtime/grapple.ts` | 78 | X |
| `runtime/audio/ambience.ts` | 76 | X |
| `runtime/headless.ts` | 78 | X |
| `runtime/looks/cardCanopy.ts` | 70 | O |
| `look/light/install.ts` | 68 | O |
| `runtime/kit/kitConvert.ts` | 65 | O |
| `runtime/looks/vertexSpill.ts` | 65 | O |
| `world/entries.ts` | 63 | O |
| `world/crowd.ts` | 62 | O |
| `runtime/looks/portalLook.ts` | 61 | O |
| `world/modelLook.ts` | 61 | O |
| `models/crowd.ts` | 58 | O |
| `world/colliders.ts` | 57 | X |
| `world/ctx.ts` | 57 | O |
| `models/feiZhuaHook.ts` | 55 | O |
| `runtime/portals/ringPortals.ts` | 55 | X |
| `world/props3d.ts` | 55 | O |
| `runtime/signs/signModel.ts` | 54 | O |
| `world/portals.ts` | 53 | O |
| `world/specimens.ts` | 52 | O |
| `world/floorRows.ts` | 51 | X |
| `grapple/FeiZhua.ts` | 49 | O |
| `runtime/portals/hostRide.ts` | 49 | X |
| `runtime/looks/weave.ts` | 48 | O |
| `look/light/pools.ts` | 47 | O |
| `runtime/state.ts` | 47 | O |
| `models/banyan.ts` | 46 | O |
| `runtime/looks/mistGeometry.ts` | 46 | O |
| `models/facade.ts` | 43 | O |
| `world/squareProps.ts` | 43 | O |
| `look/light/halos.ts` | 42 | O |
| `look/scroll.ts` | 42 | O |
| `runtime/kit/drawnInto.ts` | 42 | O |
| `runtime/audio/files.ts` | 41 | X |
| `vm/arms.ts` | 41 | O |
| `runtime/viewmodel/inkedRig.ts` | 40 | O |
| `vm/materials.ts` | 40 | O |
| `world/stairPlan.ts` | 40 | O |
| `models/inKit.ts` | 39 | O |
| `models/gear.ts` | 38 | O |
| `world/facade/pieceIds.ts` | 38 | O |
| `look/far.ts` | 36 | O |
| `runtime/standalone.ts` | 36 | X |
| `world/hero/vm-material.ts` | 36 | O |
| `world/hipRoof.ts` | 36 | O |
| `runtime/audio/cues.ts` | 35 | X |
| `world/install.ts` | 35 | O |
| `mockupCameras.ts` | 34 | O |
| `models/market.ts` | 34 | O |
| `runtime/jian.ts` | 34 | X |
| `grapple/sim.ts` | 33 | X |
| `runtime/kit/kitSet.ts` | 32 | O |
| `vm/cloth.ts` | 32 | O |
| `budgetCeilings.ts` | 31 | X |
| `runtime/items.ts` | 31 | X |
| `runtime/looks/aoTuning.ts` | 31 | O |
| `runtime/looks/lutTexture.ts` | 31 | O |
| `runtime/props/edgeDecks.ts` | 31 | X |
| `world/wellBounds.ts` | 31 | X |
| `look/specimenLight.ts` | 30 | O |
| `runtime/props/pathMovers.ts` | 29 | O |
| `runtime/kit/clothTopology.ts` | 28 | O |
| `look/renderEvents.ts` | 27 | O |
| `models/movers.ts` | 27 | O |
| `world/portalPlan.ts` | 27 | X |
| `layout.ts` | 26 | X |
| `models/paifang.ts` | 26 | O |
| `runtime/props/bakedColliders.ts` | 26 | X |
| `look/signs.ts` | 25 | O |
| `models/stalls.ts` | 25 | O |
| `vm/jianRow.ts` | 25 | O |
| `world/sets.ts` | 25 | O |
| `world/specimenDims.ts` | 25 | O |
| `models/wellBalustrade.ts` | 24 | O |
| `models/lion.ts` | 23 | O |
| `models/signs.ts` | 22 | O |
| `runtime/looks/emitterCards.ts` | 19 | O |
| `world/feats.ts` | 19 | X |
| `world/portalRide.ts` | 19 | X |
| `budgets.ts` | 18 | X |
| `look/lanterns.ts` | 18 | O |
| `runtime/kit/kitMeshes.ts` | 18 | O |
| `world/facade/dressing.ts` | 18 | O |
| `boot/files.ts` | 17 | X |
| `models/laundry.ts` | 17 | O |
| `look/light/grade.ts` | 16 | O |
| `models/bridgePosts.ts` | 16 | O |
| `playground/GrapplePlayground.ts` | 16 | O |
| `runtime/looks/wrappedTexture.ts` | 16 | O |
| `look/facadeMaterial.ts` | 15 | O |
| `look/streaks.ts` | 15 | O |
| `shard.config.ts` | 15 | X |
| `models/balustradePanel.ts` | 14 | O |
| `models/paperLantern.ts` | 14 | O |
| `world/hero/glb.ts` | 14 | O |
| `look/paint.ts` | 13 | O |
| `models/wallKit.ts` | 13 | O |
| `runtime/looks/fogBands.ts` | 13 | O |
| `runtime/portals/rideVeil.ts` | 13 | O |
| `terrain.ts` | 13 | X |
| `util.ts` | 13 | X |
| `runtime/cull/handedBatches.ts` | 12 | O |
| `runtime/props/moverCopies.ts` | 12 | O |
| `tier.ts` | 12 | X |
| `world/facade/geo.ts` | 12 | O |
| `runtime/cull/placedDraws.ts` | 11 | O |
| `runtime/looks/uniformScan.ts` | 11 | O |
| `world/canopy.ts` | 11 | O |
| `look/light/lightvol.ts` | 10 | O |
| `runtime/facts.ts` | 10 | X |
| `models/landingPlanter.ts` | 9 | O |
| `runtime/portals.ts` | 15 | X |
| `vm/geo.ts` | 9 | O |
| `world/inKit.ts` | 9 | O |
| `places.ts` | 8 | X |
| `world/words.ts` | 8 | O |
| `grapple/row.ts` | 7 | X |
| `models/lotusFinial.ts` | 7 | O |
| `playground/registration.ts` | 7 | O |
| `world/portalVeil.ts` | 7 | O |
| `look/render/family.ts` | 5 | O |
| `runtime/signs/fontWait.ts` | 5 | O |
| `world/hero/kitx.ts` | 5 | O |
| `world/kit.ts` | 5 | O |
| `world/banyanPlan.ts` | 4 | O |
| `look/light/glow.ts` | 3 | O |
| `roster.ts` | 3 | X |
| `grapple/context.ts` | 2 | X |
| `runtime/index.ts` | 2 | X |
| `strings.ts` | 1 | X |
