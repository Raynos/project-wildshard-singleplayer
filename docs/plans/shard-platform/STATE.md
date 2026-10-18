# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE.** Rulers (10-17 ~20:45 Cancun, lane post-gen): Pine 5,876, DW 4,611, Sky ~518, Signal 392, Nalati 20,345 (+141 chargeback from x5: geometryBake.ts Nalati-only, row N2). DEPLOY: e086a824e pushed (fourth map batch 2ebf1a871 + C4 + boot-smoke fix); CI 39085666517 all ten green; sp-x7 runs exact-SHA smoke, release, live check.

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6 per platform commit; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs.

**Fifth map window (open since e086a824e):** landed x8 G486 231c16e4f (−18), x4 C2 7ddae8a5a (Pine −158, DW −6), x5 C1-DW 8e830e0be (DW −89, global +52, approved). Next: x6 C6 NPC figures (after x5), x1 C4 keeper/Ecology, x9 Pine timber (paired with x10's producer 60fee31f). Then sp-x10 bakes and sp-x7 pushes.

**Lanes (7 Codex + sp-x7 deploy; Opus cap 1 until Mon):**
- C1-DW sp-x5 (stops after landing; fresh session for batches 7–10) · C1-Pine scenes sp-x9 · C1-Pine bakes + map owner sp-x10 · C4 creatures sp-x1 · C5 NPCs/quests sp-x4 (new task; trophy wall had already landed in d78cef781) · C6 NPC figures sp-x6 (check-models debt next) · C9 schemas to generators sp-x8 (new task) · sp-x7 deploy only (G485).
- Components left (post-gen): Pine C1 1,845 · C5 1,273 · C9 787 · C4 758 · C2 592 · C6 396 · C3 345; DW C1 2,012 · C5 773 · C4 768 · C9 683.

**Perf:** desktop floor ~60 fps passes; Sim holds ~30 fps (30.3), p95 43–45 ms on DW/Pine rows, ABBA no regression vs parent; the absolute p95 ≤ 35 ms miss is open (queue row, next free lane).

**Order (G471/G483/G486/G487):** W2 Pine/DW ≤ 20 %; Sky/Signal-to-zero then the Z1 lockstep deleting both runtimes after W2; W3 Nalati/Nine. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
