# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE.** Rulers (10-18 00:10 Cancun, lane post-gen): Pine 4,800, DW 3,708 on main (targets 4,261 / 3,433). Proven for the ninth window: x1 ambientLife Pine −259, x9 cabins Pine −292, x4 chapter Pine −29 / DW −51, x5 GroundCover + batch 10 DW −112, giving Pine ~4,220 (under) and DW ~3,545 (112 to go). Sky 518, Signal 392, Nalati 20,486 (row N2). DEPLOY: origin at seventh maps + docs; Linux maps/build-and-deploy now green; eighth bake cbb225d2d with sp-x7's CI fixes 287a89978 pushed; Linux CI, smoke, release next. Live still a399c36f3 (10-13).

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6 per platform commit; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs; G493 sp-x7 owns unblocking a red gate/CI/smoke (fix forward or revert, no waiting on the owner).

**Eighth map window (closed 00:00 for the deploy, Pine ambience only).** Ninth (open since cbb225d2d pushed): x5 GroundCover + batch 10 (+ x6's count-1 precompile allowance, Builder-Call), x1 ambientLife, x9 cabins + x10 producer, x8 memory (tier + audio + image + staging; Pine phone estimate 1,195 MB, Sim Explorer 702 → 644 MB), x4 chapter, x6 TX1 (engine-only).

**Lanes (7 Codex + sp-x7 deploy; Opus cap 1 until Mon):**
- C1-Pine cabins sp-x9 · C1-Pine bakes + map owner sp-x10 · C4 creatures sp-x1 · C5 Pine quest runtime sp-x4 · TX1 texture fault sp-x6 (entry pacing off, no repeatable gain) · Pine memory overlay sp-x8 (Pine estimate 1,219 MB vs 1.2 GB; tier membership next) · C1-DW sp-x5 (GroundCover, batch 10, cove) · sp-x7 deploy only (G485).
- Components left (post-gen): Pine C1 1,845 · C5 1,273 · C9 787 · C4 758 · C2 592 · C6 396 · C3 345; DW C1 2,012 · C5 773 · C4 768 · C9 683.

**Perf:** desktop p95 16.7–16.8 ms; Simulator holds ~30 fps, p95 34–38 ms on most roads, Pine travel/drive max 88–110 ms, Sky drive max 152–183 ms (first-use shader work); the p95 ≤ 35 ms floor stays open; TX1 blocks full DW comparison.

**G495–G498 (10-18 switch point):** Builder-Call trailers; no new approvedFeature tags without a G-row; custom-section limit only shrinks; legacy copies crash-fix only; no fallbacks. **Overnight (G494):** no mid-task re-briefs; at Pine ≤ 4,261 and DW ≤ 3,433 Pine/DW lanes keep closing components (C1; C7/C8 near 100/0) and freed lanes take Sky/Signal to zero (Z10, light emitters, eased-field dusk, then the Z1 lockstep); W3 only after that. Claude 92 %: lean; Opus 0 at 95 %.

**Order (G471/G483/G486/G487):** W2 Pine/DW ≤ 20 %; Sky/Signal-to-zero then the Z1 lockstep deleting both runtimes after W2; W3 Nalati/Nine. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
