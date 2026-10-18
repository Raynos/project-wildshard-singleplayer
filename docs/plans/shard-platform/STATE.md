# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Running net (receipt 16, four layers):** W1 net +40,370 lines, W2 net +8,184 (platform growth charged once).

**W1 DONE. W2 at 20 % (10-18 ~02:40 Cancun):** Pine 4,111, DW 3,266 (both under 20 %), **Sky 0 / Signal 0** (Z1 af0fee112, pushed in 3e60148e8), Nalati 19,225, Nine 11,688. G494 phase now: Pine/DW lanes keep closing components; freed lanes take Sky/Signal to zero (Z10, emitters, dusk, then Z1 lockstep); W3 after. Sky 518, Signal 392, Nalati 20,486 (row N2). DEPLOY: LIVE = aa10b6304 (build aa10b63-mvdhkaar, 07:10 UTC), replacing the 10-13 build; full Linux CI, exact four-leg smoke and deploy all green.

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6 per platform commit; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs; G493 sp-x7 owns unblocking a red gate/CI/smoke (fix forward or revert, no waiting on the owner).

**Batches:** live 114973d17; sixteenth pushed, smoke fix 62e14486d. Seventeenth closed and baking (Nine volume/LUT −154, Nine C9 −170, Nalati terrain −217, Nine kits −154). Eighteenth ready: x6 W3 audio (−188), x9 Nalati chapter (−68, platform +146), x4 Nine spill (−157), x1 NM2 prerequisite. G504: W3 = Step 1 batches by component. P0: display-encode lift on main (b835bba67, 13acb03ba, 0ccd5c900); sp-x4 on sampler3D + Nine B8 architecture.

**Lanes (7 Codex + sp-x7 deploy; Opus cap 1 until Mon):**
- CM1 + Pine C9 sp-x9 · C1-DW + C7/C8 sp-x5 · C4 sp-x1 · Sky/Signal: Z2/Z10 sp-x8, Z7/Z9 sp-x4 · G498 rows sp-x6 · switch-point rows sp-x1 · map owner sp-x10 · sp-x7 deploy only (G485/G493).
- Components left (10-18 rulers): DW C1 ~1,140, Pine C9 738, Pine/DW C4 ~750/733, C5 Pine ~600 / DW 648.

**Perf:** drive fix e2141156c (default-off until one device reading): desktop worst 16.8/33.4/33.4 ms, Simulator worst 78–85 ms and p95 34–35 ms on all three roads (meets the floor). PF1 closed: Pine spawn/cabin/pond 59.88 fps, p95 16.8 (one 283 ms cabin outlier unexplained).

**Attribution SHAs sent before landing (G496):** G499 d5a456d5e (net +296), ruler key 7b326dcb4, cue director key c3ff4774b, custom-section seal 68eb6e360 (exact limits, shrink-only), admin ruler fix e2a214cdc; W3 component classifier 3dd8f3f9b (Nalati/Nine path rules, totals unchanged). **G501:** once Pine/DW hold under 20 % after G499, component lanes take their own component across Sky/Signal (to zero) first, then Nalati/Nine (W3) when none is left. **G499/G500 (10-18 switch point):** 9 approvedFeature tags removed; waterSurface stays in the engine until the legacy copy goes; Builder-Call only for steers and rule-bending ratifies. **Order (G471/G483/G486/G487):** W2 Pine/DW ≤ 20 %; Sky/Signal-to-zero then the Z1 lockstep deleting both runtimes after W2; W3 Nalati/Nine. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67. G495–G498 rules in the lane preamble.
