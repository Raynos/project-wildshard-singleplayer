# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE.** Rulers (10-17 23:30 Cancun, lane post-gen): Pine 4,800, DW 3,708 (targets 4,261 / 3,433); proven next: x1 ambientLife Pine −259, x5 GroundCover DW −27, x9 cabins. Sky 518, Signal 392, Nalati 20,486 (row N2). DEPLOY: origin 102f09445 (sixth maps); Linux CI refused DW maps from two ARM/x64 drifts, both fixed by sp-x7 (rock matrices 2e2b2a491, foliage quaternions 80e10a200); the seventh bake ships them. Live still a399c36f3 (10-13).

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6 per platform commit; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs; G493 sp-x7 owns unblocking a red gate/CI/smoke (fix forward or revert, no waiting on the owner).

**Seventh map window (closed 23:20 for the deploy):** 6cc9ae231 C9 tail (Pine −208), 470436a99 C5 (Pine −123), 2267c3066 entry waits (engine +55), 8950b5523 tier estimate (Pine −78.9 MB, DW −49.7 MB estimate), 80e10a200 foliage fix. Eighth (after PUSHED): x5 GroundCover, x1 ambientLife, x9 cabins + x10 producer, x8 tier membership, x4 Pine quests.

**Lanes (7 Codex + sp-x7 deploy; Opus cap 1 until Mon):**
- C1-Pine cabins sp-x9 · C1-Pine bakes + map owner sp-x10 · C4 creatures sp-x1 · C5 Pine quest runtime sp-x4 · TX1 texture fault sp-x6 (entry pacing off, no repeatable gain) · Pine memory overlay sp-x8 (Pine estimate 1,219 MB vs 1.2 GB; tier membership next) · C1-DW sp-x5 (GroundCover, batch 10, cove) · sp-x7 deploy only (G485).
- Components left (post-gen): Pine C1 1,845 · C5 1,273 · C9 787 · C4 758 · C2 592 · C6 396 · C3 345; DW C1 2,012 · C5 773 · C4 768 · C9 683.

**Perf:** desktop p95 16.7–16.8 ms; Simulator holds ~30 fps, p95 34–38 ms on most roads, Pine travel/drive max 88–110 ms, Sky drive max 152–183 ms (first-use shader work); the p95 ≤ 35 ms floor stays open; TX1 blocks full DW comparison.

**Overnight (G494):** no mid-task re-briefs; at Pine ≤ 4,261 and DW ≤ 3,433 Pine/DW lanes keep closing components (C1; C7/C8 near 100/0) and freed lanes take Sky/Signal to zero (Z10, light emitters, eased-field dusk, then the Z1 lockstep); W3 only after that. Claude 92 %: lean; Opus 0 at 95 %.

**Order (G471/G483/G486/G487):** W2 Pine/DW ≤ 20 %; Sky/Signal-to-zero then the Z1 lockstep deleting both runtimes after W2; W3 Nalati/Nine. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
