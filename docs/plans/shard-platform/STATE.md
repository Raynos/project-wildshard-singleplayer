# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE. W2 at 20 % (10-18 ~02:40 Cancun):** Pine 4,011 (target 4,261), DW 3,309 (target 3,433) on f5aca1824. G494 phase now: Pine/DW lanes keep closing components; freed lanes take Sky/Signal to zero (Z10, emitters, dusk, then Z1 lockstep); W3 after. Sky 518, Signal 392, Nalati 20,486 (row N2). DEPLOY: LIVE = aa10b6304 (build aa10b63-mvdhkaar, 07:10 UTC), replacing the 10-13 build; full Linux CI, exact four-leg smoke and deploy all green.

**Rules in force:** G465 data and existing hosts; G467 generators are not custom code; G468 whole-module deletes; G469 one task per agent; G470 single-shard logic to AS + data; G482 HOST-BAR ≥ 5/6 per platform commit; G490 source-only landings, sp-x10 bakes once per window; G492 no mid-task re-briefs; G493 sp-x7 owns unblocking a red gate/CI/smoke (fix forward or revert, no waiting on the owner).

**Batches:** tenth b7f052ae4 and eleventh f5aca1824 pushed (Pine C2 hulls −54 / Nalati −152, DW reef −75). Twelfth open: x8 Z2/Z10, x4 Z7/Z9, x1 monkeyPolicy (DW −10), x9 CM1 (Pine estimate 1,341 → 1,266 MB), x6 drive hitches.

**Lanes (7 Codex + sp-x7 deploy; Opus cap 1 until Mon):**
- C2 Pine looks sp-x9 · C1-Pine bakes + map owner sp-x10 · C4 creatures sp-x1 · Sky/Signal light emitters + dusk sp-x4 · drive hitches + memory chip label sp-x6 (DW drive max 566 ms) · Sky/Signal Z2 steps + Z10 sp-x8 · C1-DW sp-x5 (GroundCover, batch 10, cove) · sp-x7 deploy only (G485).
- Components left (post-gen): Pine C1 1,845 · C5 1,273 · C9 787 · C4 758 · C2 592 · C6 396 · C3 345; DW C1 2,012 · C5 773 · C4 768 · C9 683.

**Perf:** fresh ABBA baseline: desktop p95 16.7–16.8 ms, max 66.7 ms on all roads (the 566 ms DW hitch gone after TX1); Simulator p95 38–42 ms, max 90–197 ms (35 ms floor open). Pine desktop cabin/pond still 33.4 ms (30 fps): row PF1 → sp-x6 next.

**Steer for Jake (G498 conflict):** moving engine/world/waterSurface.ts into primary Pine needs the 4 sealed pine-hollow-legacy files to import from Pine, which the layer and graph guards forbid (sp-x5 log .git/proofs/20261018T040530-sp-x5-water-B-land-64889.log). Options: (a) an exact legacy-edge authorization both guards read, or (b) leave the body in the engine until the legacy copy retires. Not landed; recommend (b). **G495–G498:** Builder-Call trailers; no new approvedFeature tags without a G-row; custom-section limit only shrinks; legacy crash-fix only; no fallbacks. **Overnight (G494):** no mid-task re-briefs; at Pine ≤ 4,261 and DW ≤ 3,433 Pine/DW lanes keep closing components (C1; C7/C8 near 100/0) and freed lanes take Sky/Signal to zero (Z10, light emitters, eased-field dusk, then the Z1 lockstep); W3 only after that. Claude 92 %: lean; Opus 0 at 95 %.

**Order (G471/G483/G486/G487):** W2 Pine/DW ≤ 20 %; Sky/Signal-to-zero then the Z1 lockstep deleting both runtimes after W2; W3 Nalati/Nine. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
