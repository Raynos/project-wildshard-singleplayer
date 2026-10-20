# Independent review: detached continuation repair

2026-10-20, 22:45 freeze, tested after the root released the shared test slot at 22:48. Checkpoint manifest SHA-256: `a7d998ce4ded39d226173a310c206ccb3d05de093ba12d2243053efa464e2d09`. All 25 selected paths matched before execution. Runtime source was read-only. Earlier reports and failed evidence remain unchanged.

## Result

**The six original refusal defects now pass their independent probes. One narrower initial-state boundary defect remains.** The independent combined run is **26 passed / 1 failed** across 27 tests. This is useful continuation hardening, not source/gameplay/visual admission.

The old off-slab, two-swing and source-fingerprint forgeries refuse. So do the later in-slab unreachable plants, reachable-but-unpublished plants and impossible swing-elapsed progression. The prior 25-millimetre discontinuity is now prevented by refusal rather than compensation. No tolerance, geometry, root height, hull cap, channel cap or motion parameter was changed to pass these tests.

## Remaining must-fix: validate the previous initial endpoint

Reproduction: initialize the actual packed-source fixture, advance and publish one stationary fixed tick, then snapshot. The previous contact endpoint has tick 0 and the current endpoint tick 1. Set both endpoints' `next` values from 0 to 1 and restore. Restore accepts this malformed continuation instead of refusing atomically.

`animation.ts` checks canonical initialization only when `contact.current.tick === 0`. At the first interval, previous tick 0 bypasses that check. The pure transition comparison merely carries the forged previous tie-break through the stationary step, so it agrees with the forged current endpoint. Both foot geometry checks pass because no transforms changed. However, initial tie-break 1 is not produced by the declared initializer and can change which foot wins a later exact release tie.

Validate every tick-zero endpoint against its own detached root and canonical initialization, including the previous endpoint. A never-stepped state must also retain its canonical initial tie-break. Preserve legitimate pre-publication and equal-tick event cases; do not simply discard previous state or reconstruct contact history. The exact desired-refusal probe and failed output are retained under repair2.

## What was independently established

- Added detached validation reads supplied bind transforms, world FK, ankle/sole frames, joint limits, knee branch/orientation, source hull clearance and root publication. It does not solve a replacement pose or run authored numeric animation.
- The one-tick comparison invokes the existing pure helper with cloned/detached state. That helper increments its local copy only; it does not advance the owner's clock/contact state, query terrain, write the actor or step physics. Owner mutation remains after these checks and scalar preflight.
- Published-current and pending-before-publish forms are explicitly distinguished. Equal-tick publication additionally compares current/prior transforms and contact state. Genuine cases are not rejected by forcing all local state to equal the older publication.
- Beyond the author's fourteen focused tests, independent genuine-state tests run nine yaw/motion combinations: yaw pi−0.015, −pi+0.015 and 0.4, each with reverse X, reverse Z or yaw-only motion, followed by stop. Each has forty ticks with both pending and published exact snapshot round-trips, unchanged actor/contact observations and alpha 0.25/0.75 support checks. Each also passes placement/reset continuation. Wrong previous sole yaw and mismatched equal-tick `next` refuse atomically.
- Original provenance probes still pass for Buffer caller mutation, detached dimensions with authored identity fields and a custom decoder. The current signed-zero spawn probe again produced no negative-zero contact yaw, so it supplies no stronger signed-zero preservation claim.
- Failed/released continuations now **explicitly refuse restoration atomically**; snapshots remain available as diagnostic evidence. This is a deliberate narrowed restore contract, not admitted recovery, a support exemption or a claim of exact restoration for failed states.

## Evidence and scope

Copy `repair2/review-probes.ts.txt` and `repair2/vitest-config.ts.txt` to `tmp/conch-grounded-final-review/review.test.ts` and `tmp/conch-grounded-final-review/vitest.config.ts`. Run `./node_modules/.bin/vitest run --config tmp/conch-grounded-final-review/vitest.config.ts tmp/conch-grounded-final-review/review.test.ts --maxWorkers=1`. `repair2/repro-result.txt` records the 26/27 result. No full suite, staged hook, application build, browser or device test was run by this review. The author separately reports 79/79 focused regression tests and strict/lint success; those are not substituted for independent execution here.

All previous continuous-path, predictive reach, actual weapon/additive-impulse envelope, recovery, player/obstacle, animated anatomy, real corpse/gameplay/lifecycle/persistence, Explorer and phone-performance gates remain open. No source or quality promotion follows. The test process ended and the heavy slot was handed directly to the Medusa reviewer.
