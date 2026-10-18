# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE.** Rulers (10-17 ~21:25 Cancun, lane post-gen): Pine ~5,262 (5,303 after x6, −41 x8), DW ~4,204 (4,371 after x6, −167 x8), Sky ~518, Signal 392, Nalati 20,486 (+141 chargeback, row N2). DEPLOY: live still a399c36f3 (10-13). e086a824e CI green, but its boot smoke failed the Developer grid leg (CI preparation ate the 90 s); sp-x7's fix aca0891f1 bounds preparation at 150 s and keeps the 90 s laws. It ships with the fifth map batch (sp-x10 baking on d0ab45464), then smoke, release, live check.

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6 per platform commit; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs; G493 sp-x7 owns unblocking a red gate/CI/smoke (fix forward or revert, no waiting on the owner).

**Fifth map window (closed 21:05 for the deploy):** 231c16e4f G486, 7ddae8a5a C2, 8e830e0be C1-DW rocks, 4e3060376 C6 figures (Pine −413, DW −38), 93053fc24 C9 sections (DW −167, Pine −41), 0d3bac6b0 model guards, 67d5565a2 item effects (Pine −106, DW −35). Sixth window (after PUSHED): x9 timber first (green, paired with producer 60fee31f), then x1 C4 returns and x5 DW batches 7–8, x4 C5 chapter, x8 schema tail.

**Lanes (7 Codex + sp-x7 deploy; Opus cap 1 until Mon):**
- C1-DW sp-x5 (batches 7–8; 9–10 next) · C1-Pine scenes sp-x9 · C1-Pine bakes + map owner sp-x10 · C4 creatures sp-x1 · C5 NPCs/quests sp-x4 (new task; trophy wall had already landed in d78cef781) · grid entry hitches sp-x6 (Sim travel p95; paced entered build) · C9 schemas to generators sp-x8 (new task) · sp-x7 deploy only (G485).
- Components left (post-gen): Pine C1 1,845 · C5 1,273 · C9 787 · C4 758 · C2 592 · C6 396 · C3 345; DW C1 2,012 · C5 773 · C4 768 · C9 683.

**Perf:** desktop floor ~60 fps passes; Sim holds ~30 fps (30.3), p95 43–45 ms on DW/Pine rows, ABBA no regression vs parent; the absolute p95 ≤ 35 ms miss is open (queue row, next free lane).

**Order (G471/G483/G486/G487):** W2 Pine/DW ≤ 20 %; Sky/Signal-to-zero then the Z1 lockstep deleting both runtimes after W2; W3 Nalati/Nine. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
