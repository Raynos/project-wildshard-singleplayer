# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE. W2 at 20 % (10-18 ~02:40 Cancun):** Pine 4,004 (target 4,261), DW 3,289 (target 3,433), Sky 375, Signal 339 after x8 Z2/Z10 0b2cd0503. G494 phase now: Pine/DW lanes keep closing components; freed lanes take Sky/Signal to zero (Z10, emitters, dusk, then Z1 lockstep); W3 after. Sky 518, Signal 392, Nalati 20,486 (row N2). DEPLOY: LIVE = aa10b6304 (build aa10b63-mvdhkaar, 07:10 UTC), replacing the 10-13 build; full Linux CI, exact four-leg smoke and deploy all green.

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6 per platform commit; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs; G493 sp-x7 owns unblocking a red gate/CI/smoke (fix forward or revert, no waiting on the owner).

**Batches:** tenth b7f052ae4, eleventh f5aca1824 and CI fix 067778604 pushed (CI green, smoke running; live aa10b6304). Twelfth open: landed x8 Z2/Z10 0b2cd0503 (−243; Sky −143, Signal −53). Next x4 Z7/Z9 (Signal −99, Sky +44 cardGroup charge), x1 monkeyPolicy (DW −10), x5 cargo (DW −42), x9 CM1 (Pine estimate 1,282 MB, chip Developer-only) + C9 budgets (−40), x6 drive hitches.

**Lanes (7 Codex + sp-x7 deploy; Opus cap 1 until Mon):**
- CM1 + Pine C9 sp-x9 · C1-DW + C7/C8 sp-x5 · C4 sp-x1 · Sky/Signal: Z2/Z10 sp-x8, Z7/Z9 sp-x4 · drive hitches sp-x6 (PF1 next) · map owner sp-x10 · sp-x7 deploy only (G485/G493).
- Components left (10-18 rulers): DW C1 ~1,140, Pine C9 738, Pine/DW C4 ~750/733, C5 Pine ~600 / DW 648.

**Perf:** x6 final ABBA: desktop worst Sky 16.8 / Pine 50 / DW 50.1 ms (was 50 / 66.6 / 66.6), p95 16.8; Simulator worst Sky 79 / DW 85 ms (was 152 / 107), Pine one 458 ms outlier at activation being traced; Sim p95 floor 35 ms still open; Pine desktop cabin/pond 30 fps (row PF1).

**Steer for Jake (G498 conflict):** moving engine/world/waterSurface.ts into primary Pine needs the 4 sealed pine-hollow-legacy files to import from Pine, which the layer and graph guards forbid (sp-x5 log .git/proofs/20261018T040530-sp-x5-water-B-land-64889.log). Options: (a) an exact legacy-edge authorization both guards read, or (b) leave the body in the engine until the legacy copy retires. Not landed; recommend (b). **G495–G498:** Builder-Call trailers; no new approvedFeature tags without a G-row; custom-section limit only shrinks; legacy crash-fix only; no fallbacks. **Overnight (G494):** no mid-task re-briefs; at Pine ≤ 4,261 and DW ≤ 3,433 Pine/DW lanes keep closing components (C1; C7/C8 near 100/0) and freed lanes take Sky/Signal to zero (Z10, light emitters, eased-field dusk, then the Z1 lockstep); W3 only after that. Claude 92 %: lean; Opus 0 at 95 %.

**Order (G471/G483/G486/G487):** W2 Pine/DW ≤ 20 %; Sky/Signal-to-zero then the Z1 lockstep deleting both runtimes after W2; W3 Nalati/Nine. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
