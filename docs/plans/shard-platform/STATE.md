# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE (10-17 ~09:30Z).** Ruler at `b0c578fa1` (~14:45Z, sp-x6's mirror run): **M3 64.0 % (51,306 of 80,173 cut)**, plan 38.4–71.7 %. Sky 528, Signal 392; W2: Pine 9,112 (42.8 %), DW 5,549 (32.3 %); W3: Nalati 20,078, Nine 11,889. Features done: quest runner 6/6, boss 6/6, held/loadout (feature 4) 6/6, collections 5/6, contracts 5/6 (G473 exception), Z2 6/6, skitterer v1 6/6. DEPLOY: CI fixes pushed (5fd0bfe96, 8066c946b, Pine map 581443e4b); awaiting a green run and live == main.

**Rules in force:** G465 data and existing hosts only, measured net cuts; G466 close bar 100/0 except listed view code; G467 generators are not custom code; G468 each commit deletes a whole runtime module with its data path (~150+ net); G469 one task per agent; G454 second-shard user for any host change. Caps report-only (G433).

**Push discipline (for every session):** sp-x7 is the only pusher (G485). During its 14:36–15:10 safety hold (a Safari crash at DW Props, fixed in 87c717f31), origin still advanced 14:59–15:02 (c82dd929c, 016f28241, 538918559), carrying held lane commits. Please don't run push-main.sh from other sessions; land locally and sp-x7 carries it.

**Lanes by component (G490; 7 building Codex + sp-x7 deploy; Opus cap 1 for C2/C3 boards):**
- C1-DW sp-x5 · C1-Pine scenes sp-x9 · C1-Pine bakes sp-x10 (also the single map owner: one clean bake per batch window, no per-commit chain) · C2 looks sp-x4 · C4 creatures sp-x1 (after the Sim-road part eight) · C5 quests sp-x6 (after DW batch 2) · C9 glue sp-x8 (Z3, after keyed sky) · sp-x7 deploy only (G485).
- Each lane owns its component's files in both shards; cross-component needs go to the owner. C3/C6/C7/C8 leftovers go to the first free lane.

**Perf:** Sim floor p95 ≤ 35 ms: Sky passes; Pine, Nalati, DW travel 36–46 ms across runs (sp-x1 part six: zlib decode + microtasks, inflate pacing).

**Memory:** settled Nine 1,242 MB over the 1.2 GB report cap; others 600–900 MB.

**Order (G471/G477/G483/G486/G487):** W2 Pine/DW ≤ 20 % via features + ONE lane on DW then Pine easy batches (G487); Sky/Signal-to-zero (G486): Z11 single scene registry with Z2 adopters, Z3 (items/plumbing knobs) any lane, Z2 Sky/Signal steps + Z8, Z10 explore/catalogue, light emitters + eased field (Z7/Z9), then the Z1 lockstep landing deleting both runtimes after W2; W3 Nalati/Nine after W2. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
