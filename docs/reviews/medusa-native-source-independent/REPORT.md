# Medusa actual native source: independent review

Review date: 2026-10-20. Scope: frozen `native-owner-candidate1`, two shared engine changes and two shared regression files. No application, browser, Mac, deployment or runtime admission. No tracked source or Git edits by this reviewer.

## Verdict

The complete native source slice is worth preserving and is internally coherent: actual selected editable/packed geometry, native hierarchy and pose, existing flight/burst/strike behavior, death-local continuity, and an independently cross-checked weighted-skin oracle. The two shared fixes are appropriately bounded. This is **source implementation acceptance, not gameplay/contact/artistic acceptance**. There is no complete flying owner or shape-faithful corpse recipe yet. Preserve the exact source now; do not wait for those separate milestones.

Static likeness remains 3.2925/5, with retained v2 fresh 3.015/5. No new artistic score, averaging or structural-test admission is supplied.

## Integrity and source geometry

- Checkpoint SHA-256 independently matches `11af8ac3e89f5ef648ee184cbb979d70a7ee62363ce16b7cd773172ac78df6b2`.
- All 19 listed file lengths and SHA-256 values match. This is 15 candidate files plus four shared paths; the checkpoint itself makes 16 candidate files.
- All four selected-art pins match: editable JSON, metadata, compressed payload and GLB. The GLB was hash-checked, not independently rendered or decoded for geometry parity.
- Read-only `source-parity.py` independently inflates the actual payload and compares every packed attribute against editable source after its declared Float32/Uint16 storage conversion: **310,068 scalar values exact**, 27 absolute bone records exact, ten mesh parts exact, 1,102,464 inflated bytes. Metadata's byte length is the inflated length, not the compressed file size; this is not a mismatch.
- Independently counted 17,226 vertices, including 2,304 blended vertices. The existing native test compares every actual packed vertex with THREE Skeleton/SkinnedMesh weighted skin at live, lethal, intermediate and terminal poses. Both computations use the actual rig, not a replacement fixture. The source recipe's rigid unit-scale assumptions are satisfied here; this is not a general scaled-bone oracle.

## Shared regression correctness

`nativeRigidCorpse.ts` now distinguishes a finite pivot from positive extents. It permits zero/negative bodyY while retaining finite positive halfWidth/bodyHalfLen/bodyRadius, finite Float32 body vectors and strictly positive Float32 principal inertia. Validation remains before reservation.begin/allocation. It does not change dimensions, root placement, hull budget or mass law. The retained mass law still uses bodyY in its inertia approximation; this is not a claim of mesh-integrated inertia.

The resource regressions initialize the real bundled Rapier WASM and count actual bodies/colliders/joints/reservations. Positive/zero/negative pivot cases, cleanup, invalid extents, nonfinite pivots and underflow are meaningful resource tests. Their two synthetic hulls are explicitly not Medusa geometry/contact proof. The final NaN-to-Number.NaN spelling change is semantically identical and disclosed, not hidden as a runtime change.

`animalPose.ts` adds only the declared-flight guard around terrestrial stride integration. It does not reset phase, fake a leg length, disable attack advancement, suppress custom flinch/death clocks, or change the grounded stride formula. `AnimalSim.flying` means a declared flight model, not a momentary airborne flag, so this freezes terrestrial phase for the entire declared-flight actor. Existing time-driven flyer clips remain time-driven. Near/far timer differences and explicit debug phases remain intentional pre-existing behavior.

Review-owned probes additionally cover preserving a nonzero phase, near custom timers, far timer split, caller-owned attack timing, and explicit debug gait. These strengthen the supplied zero-phase/five-flyer/Sky-Goat regressions without changing production source.

## Native pose and behavior

The source adapter constructs real AnimalSim, NativeCreaturePose, BurstFlyerBrain and strikeFromData using the selected flight/strike/home. It installs no second clock, scheduler, gameplay system or species registration. Own clips read actual attack/death/transition channels; they do not command the brain. Live channel parity is checked against the original selected clips. Death captures the published local endpoint and smoothly blends to the original terminal fold, with no root lift, floor support offset or collider padding.

The supplied burst test exercises real windup/pulse/shove/recovery through the real brain with test observation/contact ports. The alive guard stops brain activity after death. This does not prove Arena player contact or wall behavior. The continuation test covers real flight and native pose with a brain whose state is saved/restored but not actively advanced in that continuation loop; do not overstate it as active mid-strike replay or physical corpse persistence. Death continuity is local-joint continuity; no admitted physical handoff currently exists.

The unsafe fallback is deliberately retained in tests: dead flight reaches root y=0 while actual weighted mesh extends below -1 metre. The source adapter must remain unavailable as playable until physical admission is established.

## Exact next implementation boundaries

1. Implement a dedicated `PracticeNativeFlyer` owner rather than loosening `PracticeNativeActor`'s grounded-decision checks. Borrow one Arena physics/player/events/combat scope and clock; retain spawn.spec.flight; bind the actual burst policy/strike; advance brain, AnimalSim and NativeCreaturePose once in the established pre/physics/post sequence. Existing `practiceNativeSpawn` omits flight and `practiceNativeRecipe` rejects it, so unchanged reuse is incorrect.
2. Make living motor synchronization explicit. SimHost creates/resetAt's a page CharacterMotor and later syncBodies only creates/disposes it. AnimalSim excludes declared flight from ground motor movement. Thus a flying actor can move while its blocker stays at the spawn. Compare the legacy flight contract, preserve flight trajectory, and provide a deliberately named living-body synchronization path with exact position/velocity/contact semantics. Repeated resetAt is not evidence of collision-resolved flight: it directly translates the collider and clears contacts. Do not silently turn on grounded step/snap or claim wall stopping.
3. Keep three concepts distinct: the source's vertical body hit capsule (`capsuleAxis: y`), the living movement capsule, and a future native corpse recipe. Geometry loader and AnimalFactory reject vertical-axis dims.rigidCorpse; AnimalView uses that axis to select legacy upright death. Do not change the axis to z or remove general validation. Introduce a separately typed, source-pinned native corpse selection admitted by the dedicated installer and coordinated loader/schema path.
4. Reuse NativeCorpseOwner's concrete motor transaction and NativeRigidCorpse reservation/resource ownership. SimHost already skips AnimalSim.step while the corpse owns root and skips ordinary body synchronization for it. Reserve capacity before admission; failure must not fall back to the known-unsafe standard flight death. Retain the one world physics step and exact lethal pose/root.
5. Produce and test a concrete shape-faithful recipe within the existing limits: at most eight unique bone-bound convex parts, 128 points per part, 512 total points, current coordinate bound, animated locals (not captured-pose policy). Each hull must state which actual surface region it represents. Compare the entire blended weighted mesh and negative spaces against the hull union over lethal phases and every death-fold interval, not just rest vertices or a dominant influence. Then measure real floor, slope, edge and impact contacts and complete lifecycle/cleanup.

No such bounded recipe is demonstrated by this slice. Ten render parts or 27 joints neither establish a faithful eight-hull solution nor prove mathematical impossibility. An eight-ribbon-plus-central-body grouping is not automatically eight rigid hulls; combining regions may fill visible empty space, and assigning blended vertices to one joint loses deformation. A source redesign, if necessary, must remain a new reviewable variant preserving eight ribbons and complete editable anatomy, with the selected baseline protected. Do not raise caps, fabricate geometry, pad a giant hull or accept a coordinate-only fix.

## Independent execution

Read-only hash and editable-to-packed parity checks passed. Independent focused Vitest rerun **passed 40/40 tests across four files**, including all original 37 on the final Number.NaN spellings plus three review-owned timer tests. Canonical build lease ticket 161, 22.14 seconds; no app build. All checkpoint hashes still match. No reviewer process remains.

The first config-only command was refused before running tests because the repository guard requires explicit positional test filenames. That sanitized receipt is retained as `failed-config-only-invocation.txt`; the corrected command named all four files and respected the same canonical lease. No guard was bypassed. `focused-tests.txt` contains the successful receipt. Writer scoped strict TypeScript and explicit no-ignore type-aware lint receipts were inspected, not independently rerun; the reviewer tests were executed by Vitest, not separately strict-typechecked.

Reproduce from repository root:

```sh
python3 docs/reviews/medusa-native-source-independent/source-parity.py
WS_HEAVY_ROOT="$PWD/tmp/heavy-lanes" python3 scripts/heavy-lane.py build -- node node_modules/vitest/vitest.mjs run --config docs/reviews/medusa-native-source-independent/vitest.config.ts art/driftwood-isle/approved-pearlglass-medusa/native-owner-candidate1/native.test.ts test/native-rigid-corpse-resource.test.ts test/animal-pose-flight-clock.test.ts docs/reviews/medusa-native-source-independent/flight-clock.test.ts
```

Sanitized receipts: `hash-verification.json`, `source-parity.json`, `focused-tests.txt`. Review-only executable sources: `source-parity.py`, `flight-clock.test.ts`, `vitest.config.ts`.
