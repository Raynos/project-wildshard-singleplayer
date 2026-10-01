# E357 P3 · rejected roof fixture audit

Checked on clean HEAD `064e06763548ab6bf060b7ed76b82ccb01ce00db` (2026-10-01), muted Chromium / Metal, phone tier. [Measured traces](roof-fixture-audit.json).

The old roof branch of `capture-timing.mjs` called `pose({ x:24, z:-10, y:165, yaw:-Math.PI/2 })`, settled 20 frames, and walked east until airborne. It did not remove a collider. The separate `coyote` branch raised the player 5m and was never the roof branch.

`src/shards/nine-dragon-stack/layout.ts` sets `Y0=125`. In `world/colliders.ts`, `fragmentColliders()` builds the east front north of the stair as `span(PLAZA.x1+0.6, Y0, PLAZA.z0-0.6, PLAZA.x1+DEEP, Y0+WALL_H, STAIR.z0)`: x22.6…28, y125…165, z−26.6…2. The roof fixture was on top of this boundary wall. Visual facade geometry continues beyond its back edge and is not a walkable street there.

A normal walk from the actual spawn, without any pose/teleport, ground edits or collider edits, traversed toward `(12,4)`, `(12,-10)` and `(26,-10)`. It stayed grounded at y125.006…125.020 throughout, stopped against market props at x19.4, and never reached the fixture's y165. The plaza slab extends x0…22.6; the building-front wall blocks normal eastward travel.

Downward Rapier rays at z−10 from y180 found prop tops127.4 at x20/21, plaza floor125 at x22, and boundary-wall top165 at x23…27. At x28…31 they found no surface within100m: those coordinates are outside the playable fragment. An exact old-fixture replay started grounded at `(24,165.004,-10)` and became airborne at frame33, `(28.495,164.793,-10)`, after passing the box's back edge. All 525 colliders remained registered. The natural fall reached `(35.088,137.525,-10)` by frame79.

Conclusion: an invalid capture teleport onto a boundary-wall top, followed by leaving the playable collision volume. No real street fall-through was reproduced, so no runtime hunk is proposed. The replacement uses Driftwood's real pier edge, unchanged pier/boat colliders and visible water. The board README explains the equal two-press comparison and existing air jump.

Reproduction source: `capture-timing.mjs` in `df398947` contains the rejected roof pose; normal-route waypoints, sampled positions and downward-ray results are retained in the audit JSON. No normal walk is claimed to reproduce that impossible height.
