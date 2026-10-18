# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Running net (fourteenth receipt 6b56f5f71, four layers incl. format):** W1 custom −4,543 vs platform +44,468 (net +39,925 lines); W2 custom −33,635 vs platform +40,904 (net +7,269). Platform totals engine 76,249 · game 60,092 · format 12,224 · sdk 10,797.

**W1 DONE. W2 at 20 % (10-18 ~02:40 Cancun):** Pine 4,100 (target 4,261), DW 3,276 (target 3,433), Sky 313, Signal 143, Nalati 19,804 (after x1 −501), Nine 12,144. G494 phase now: Pine/DW lanes keep closing components; freed lanes take Sky/Signal to zero (Z10, emitters, dusk, then Z1 lockstep); W3 after. Sky 518, Signal 392, Nalati 20,486 (row N2). DEPLOY: LIVE = aa10b6304 (build aa10b63-mvdhkaar, 07:10 UTC), replacing the 10-13 build; full Linux CI, exact four-leg smoke and deploy all green.

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6 per platform commit; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs; G493 sp-x7 owns unblocking a red gate/CI/smoke (fix forward or revert, no waiting on the owner).

**Batches:** live 067778604; twelfth pushed (57fe24a78; smoke split fix 019ee764b). Thirteenth baking (DW + Sunscar): ruler 4ed9c9a0f (Nine +264 ruler-only), drive e2141156c, DW 717aaf29a (−42) + C5 326442ec7 (−49), Signal Z8 987934f9f (−44). Fourteenth ready: x4 look rows (Sky −106, Signal −21), x9 Pine C5 stagWalk (−28), x6 G498 re-entry + sweep guard, x1 G499 tags + ruler net key + small fixes, x5/x8 Z1 lockstep.

**Lanes (7 Codex + sp-x7 deploy; Opus cap 1 until Mon):**
- CM1 + Pine C9 sp-x9 · C1-DW + C7/C8 sp-x5 · C4 sp-x1 · Sky/Signal: Z2/Z10 sp-x8, Z7/Z9 sp-x4 · G498 rows sp-x6 · switch-point rows sp-x1 · map owner sp-x10 · sp-x7 deploy only (G485/G493).
- Components left (10-18 rulers): DW C1 ~1,140, Pine C9 738, Pine/DW C4 ~750/733, C5 Pine ~600 / DW 648.

**Perf:** drive fix e2141156c (default-off until one device reading): desktop worst 16.8/33.4/33.4 ms, Simulator worst 78–85 ms and p95 34–35 ms on all three roads (meets the floor). PF1 closed: Pine spawn/cabin/pond 59.88 fps, p95 16.8 (one 283 ms cabin outlier unexplained).

**Attribution SHAs sent before landing (G496):** G499 d5a456d5e (net +296), ruler key 7b326dcb4, cue director key c3ff4774b (audio-cue-director:G478 in approvedFeatures; Sky gust named in ENGINE for Z1). **G501:** once Pine/DW hold under 20 % after G499, component lanes take their own component across Sky/Signal (to zero) first, then Nalati/Nine (W3) when none is left. **G499/G500 (10-18 switch point):** 9 approvedFeature tags removed; waterSurface stays in the engine until the legacy copy goes; Builder-Call only for steers and rule-bending ratifies. **Order (G471/G483/G486/G487):** W2 Pine/DW ≤ 20 %; Sky/Signal-to-zero then the Z1 lockstep deleting both runtimes after W2; W3 Nalati/Nine. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67. G495–G498 rules in the lane preamble.
