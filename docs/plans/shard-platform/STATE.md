# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE (10-17 ~09:30Z).** Ruler at `b0c578fa1` (~14:45Z, sp-x6's mirror run): **M3 64.0 % (51,306 of 80,173 cut)**, plan 38.4–71.7 %. Sky 528, Signal 392; W2: Pine 9,112 (42.8 %), DW 5,549 (32.3 %); W3: Nalati 20,078, Nine 11,889. Features done: quest runner 6/6, boss 6/6, held/loadout (feature 4) 6/6, collections 5/6, contracts 5/6 (G473 exception), Z2 6/6, skitterer v1 6/6. DEPLOY: CI fixes pushed (5fd0bfe96, 8066c946b, Pine map 581443e4b); awaiting a green run and live == main.

**Rules in force:** G465 data and existing hosts only, measured net cuts; G466 close bar 100/0 except listed view code; G467 generators are not custom code; G468 each commit deletes a whole runtime module with its data path (~150+ net); G469 one task per agent; G454 second-shard user for any host change. Caps report-only (G433).

**Whats-new push blocker:** resolved (pushes went through since).

**Lanes (W2):**
- sp-x5 Z2 world scene assembly (G483; first adopters DW cascade + Pine streams).
- sp-x8 population HOST-BAR fix (honest Pine charge-back; 7 crossings grandfathered until the AS adapter row).
- sp-x6 feature #4 rest: held gear/skins, toon 6/6 fix, DW IronSword claim.
- sp-x4 G484 (a): skitterer to ABI v1 with a generic spawn-group binding.
- sp-x1 Sim road part six (native traces: zlib decode + microtasks; shared inflate pacing).
- sp-x7 (G485): ONLY CI/deploy until live == recent main (red since this morning; live a399c36f3 from 10-13). Root cause so far: Nalati spear pool bake hash differs Linux 7fbead3b vs Mac af347349 and its GLB was git-ignored (8f5e76376); plus Nalati empty-URL model 404s. The G480 ruler task is already landed (49ac0b23a), so nothing to move.
- sp-x8 G484 (b) SCRIPT-ABI.md rewrite. Next free lane: spawn director Script ABI spawn/retire + Pine night waves to AS (wins back the +603 charge-back), then #5 living buildings; Z1 after Z2.

**Perf:** Sim floor p95 ≤ 35 ms: Sky passes; Pine, Nalati, DW travel 36–46 ms across runs (sp-x1 part six: zlib decode + microtasks, inflate pacing).

**Memory:** settled Nine 1,242 MB over the 1.2 GB report cap; others 600–900 MB.

**Order (G471/G477/G483/G486/G487):** W2 Pine/DW ≤ 20 % via features + ONE lane on DW then Pine easy batches (G487); Sky/Signal-to-zero (G486): Z11 single scene registry with Z2 adopters, Z3 (items/plumbing knobs) any lane, Z2 Sky/Signal steps + Z8, Z10 explore/catalogue, light emitters + eased field (Z7/Z9), then the Z1 lockstep landing deleting both runtimes after W2; W3 Nalati/Nine after W2. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
