# Collision-owned XYZ continuation: bounded, not full admission

2026-10-21. Continuation of the frozen planar candidate at `8705f9ea68d85fac5a030f5831ac2ae966a836e4`.

The exact 68-point source body now owns one accepted 3D root through Rapier. A readonly motor authority contract makes AnimalSim combine locomotion, stagger/impulse and desired ground follow before one KCC computation. Terrain and player contacts remain enabled. The accepted native float32 translation is published back to actor and groundY; the normal pose owner consumes it without a later analytic Y overwrite. No root lifts, shape changes, padding, KCC skin changes, contact exemptions, second physics step or corrective teleports were introduced. Capsule-only stalled-floor retry remains capsule-only.

## Physical findings

- The exact metal WORLD Arena slab is still 100 × 4 × 100 at Y898, top Y900. At scale 1, yaw 0, a requested X0.1 movement reproduces the old KCC Y correction: +0.00011967930913669989 m. The native accepted root is Y900.0001220703125. Actor and collider now share that actual value, rather than claiming the unrounded sum is exact.
- The same ordinary travel passes at scales .85, 1 and 1.25, followed by 60 movement ticks, idle, turn, stagger and impulse. No AnimalSim or motor path steps physics. Genuine WORLD step and slope fixtures accept nonzero vertical corrections with one KCC computation: +0.20544353127479553 m and +0.22107160091400146 m respectively.
- Twelve real PLAYER KCC lunges, four approach directions at each scale, stop outside the exact living body on the actual Arena slab. This tests the body, not the six moving head/lid hulls.
- At every scale the real native owner publishes a nonzero accepted Y to the view, retains it across explicit placement, motor transfer and same-host recreation, then preserves the exact lethal actor/view root through held death and 120 later ticks. The existing corpse-owner scheduling skips analytic body motion; no new dead-actor flag or corpse policy was added.
- Default capsule analytic ground follow, terrain filtering, driven and dead behavior retain their prior path. Existing flight pose-clock, native practice, rollback/cleanup and both-direction snapshot shape checks remain covered. Embedded practice snapshots remain unsupported.

Explicit external reset/placement coordinates and yaw/hull transforms cross Rapier's float32 boundary, so those are float32-equivalent, not mathematically identical arbitrary doubles. Accepted movement XYZ is copied from the native collider and is exactly equal in actor/collider publication. These proofs do not establish swept rotation or continuous terrain traversal outside the named cases.

## Evidence and limits

Final focused validation: 59/59 tests in four files, selected type-aware lint exit 0, focused strict TypeScript exit 0. Heavy checks used the canonical `tmp/heavy-lanes` lease.

The first continuation test incorrectly assumed every yaw must yield a nonzero native Y correction; yaw π/2 at scale 1 rounded to Y900. Its exact failure output is retained as `test/proof/pitcher-convex-vertical-ownership/orientation-assumption-failure.txt`. The fixture was corrected to the historical yaw0/X-travel case, without changing physics or tolerances.

All old planar negative evidence remains byte-identical under `test/proof/pitcher-convex-body-motor/`; `historical-sha256.txt` records the checked identities. New measurements and checks belong to the separate `test/proof/pitcher-convex-vertical-ownership/report.json` and final raw output.

This is not full creature or app admission. Six moving head/lid hulls still need actual lethal-clearance tests. Swept rotation, unsupported moving decks, complete app interaction, physical-phone performance and animation quality are unproved. No browser, full build, full suite, installation, Git write, deployment or STATE edit was performed by this continuation.
