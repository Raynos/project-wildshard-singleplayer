# Articulated Conch: authoritative grounded-motion diagnostic

2026-10-20. Editable implementation, not source/gameplay/visual admission. No application build or publication. Articulated candidate1 geometry remains frozen; all six output hashes were rechecked against its freeze. No runtime selection references this new declaration. Existing legacy selection remains unchanged.

## Implemented boundary

- `prepare.py` emits a separately editable `motion.json`: exactly two real hip/knee/ankle chains, actual bind lengths/poles/sole polygons, explicit XYZ joint limits, fixed body ancestor, 18 exclusive solved-rotation copy lanes and the source's exact 333-point/eight-owner geometry. Original anatomical Left is negative actor X; weapon side is positive X. No old facing correction is reintroduced.
- NativeCreaturePose remains the only contact writer. Actual full root position/yaw/tilt/uniform scale is staged after body motion and before pure bind-axis IK. Immutable world ankle/sole frames, deterministic alternate release, latched quintic swings, fixed-tick phases and finite-support diagnostics are owner state, not speed/distance-driven synthetic gait.
- TrainingArena supplies its actual finite Y=900 slab lease and existing wall interior (50 minus 0.22 m), invalidated when that arena entry ends. No authored terrain callback, underlying-shard fallback, extra world/physics step, root lift, collider padding, raised cap or broad exemption.
- Quiet presentation solves detached joints against the canonical previous/current contact interval, including release, landing and zero-time event publications. Alpha zero/one retain exact published endpoints. Failed interpolation throws a diagnostic refusal instead of claiming contact. Collision/FK reads remain on the authoritative endpoint.
- Source-wide hull clearance is checked, not only ankle or sole rays. Failed reach, joint limits, movement bounds, source clearance and lifetime mark contacts released. Actual body movement and subsequent damage are retained. This is explicit failure, not accepted recovery. Placement is preflighted before adapter actor/motor mutation; nonlethal event publication retains foot time and solved legs; lethal release occurs only on commit. Contact continuation is versioned and validates detached source/surface/phase/frame data before owner mutation. Physical pose-only restore remains refused.

## Verification

Final focused suite: **66/66 tests across five files passed**. Exact final source strict TypeScript and changed-files type-aware lint passed with no diagnostics.

Focused actual-source tests cover all original source corners and source-derived hulls, yaw/scale, forward/reverse/lateral and yaw-only paths, finite support, stance no-slip, stopped swings, blocked intended motion, intermediate render alpha and quiet read order, strict declaration refusals, real accumulated impulses plus stagger, repeated real zero-time hits, lethal release, exact tested mid-swing continuation and placement. Existing native pose/actor/ownership/corpse tests are rerun separately from any quality claim.

The first event-boundary run exposed a 58.522800731 mm diagnostic mismatch: an equal-tick post-hit sampler returned the old plant instead of the current swing frame. `zero-time-witness.json` preserves it. The fix retains the latched swing elapsed fraction; no source geometry, root, timing parameter or tolerance changed.

## Explicit unpassed gates

This is not a certified reachable gameplay envelope. The declaration's step/turn/release values are editable diagnostic bounds, not proof that every root path inside them is feasible. Whole-interval reach/clearance certification, predictive swing feasibility, the unchanged real weapon/accumulated-knockback domain, safe recovery, player/other obstacle clearance and independent motion/anatomy review are still open. Sampled interpolation tests are witnesses, not a universal continuum proof. Unsupported source/root paths fail rather than stretch or compensate. No source is admitted merely because it is labelled released.

Upper-body strike choreography, actual Arena gameplay/lifecycle, real corpse handoff for this source, reward/Retry/reload, browser/phone performance and Explorer coverage are separate pending work. Candidate static likeness remains the separate fresh 3.89/5 tie, not a passing score. Runtime remains four WIP and zero complete.

## Independent-review blockers preserved in this checkpoint

The independent review reproduced three strict-contract defects: continuation accepts off-slab frames, continuation accepts two simultaneous swings, and the authored source digest is not yet bound to the actual loader payload. The packed Float32 positive sweep passed, but these defects block strict-contract acceptance. They remain deliberately unrepaired in this first protected source slice; a separate bounded repair is underway.

The first real staged-tree hook also refused root-test imports from the deliberately excluded art tree. `prepare.py` now produces complete byte-identical normal-tree fixtures under `test/proof/conch-grounded-source/`, with origin/hash receipt. The repaired test file passes 9/9 and its type-aware lint is clean. No gate, type exemption or runtime code changed for that fixture repair. `mirror-loading-witness.json` retains the cause.

## Bounded strict-contract repair, 2026-10-20

The original three negative reproductions remain in `docs/reviews/conch-grounded-motion-independent/` and the original failed runtime source is preserved at local checkpoint `4f9f8c81e2653cd73ca0744674d5d157b4276be3`. This repair changes no geometry, joint limits, motion parameters, collision caps, actor-root compensation, or runtime selection.

Restore now rejects both simultaneous swings and any plant/start/target sole footprint outside the finite slab before changing owner state. This applies to both continuation endpoints and to released feet as well. An invalid failed frame is not silently restorable or exempted; it remains a diagnostic failure. Restore does not advance or re-solve the controller.

The packed loader privately retains its own input-byte copy and associates provenance with the exact emitted dimensions object, which the actual model and AnimalSim retain. Only the standard packed decoder establishes this provenance. NativeCreaturePose's opt-in contact constructor reads that loader-owned identity, checks the actual payload hash against the authored metadata filename, and rejects absent or mismatched identity. A copied authored digest in dimensions cannot establish provenance. The source field explicitly means SHA-256 of the compressed loader input, not canonical model JSON; the full input receipt separately records payload, model JSON, and metadata JSON hashes. No new authored field or pose callback can confer that identity.

Complete byte-identical metadata and binary payload fixtures join the existing full source fixtures in the normal test tree, so the staged build mirror can test the actual loader. Tests include positive identity, forged declaration hash, detached dimensions, metadata filename mismatch, and mutation of the caller's byte buffer after preload. Legacy non-contact poses do not consult provenance. Private retention adds an owned byte copy; standard geometry output and decoding semantics are otherwise unchanged.

Independent repaired-byte review and actual staged-tree hooks remain required. This is still diagnostic WIP, not a visual, motion, gameplay, source, or corpse admission.
