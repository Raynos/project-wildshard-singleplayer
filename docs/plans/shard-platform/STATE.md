# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W1 DONE.** Latest lane rulers (10-17 ~18:30 Cancun): Pine ~6,697 (after elites, rig, keyed sky, geography, DW Z2 fixed sites; x9 hero/scatter −332 and x1 −55 pending), DW 5,202. Sky 528, Signal 392. DEPLOY: first canonical map batch 0d020e8f9 pushed (gate green); CI 39077400173 then failed in pnpm gen (keyed-sky Pine sky-key hash differs on Linux), sp-x7 fixing; live still a399c36f3. Maps: sp-x10 bakes once per window (G490).

**Rules in force:** G465 data and existing hosts only, measured net cuts; G466 close bar 100/0 except listed view code; G467 generators are not custom code; G468 each commit deletes a whole runtime module with its data path (~150+ net); G469 one task per agent; G454 second-shard user for any host change. Caps report-only (G433).

**Pipeline (for wildshard-v, 19:45):** (1) GROUND_LOOK is NOT a live red: sp-x10's cold strict all-10 on 1762328b3 built DW with zero GROUND_LOOK errors (stale mirror inventory), and the push gate went green: 0368f804d pushed (8 commits, includes b90201ec9). (2) product-in-look look/toon + look/keyed-sky fixtures fixed by sp-x7 in 8735cc48c (on main; ships with the third map batch ae2ae610a, push pending). (3) The boot-developer grid deadline on 0d020e8f9 is sp-x7's (G485). sp-x7 is the only pusher.

**Lanes by component (G490; 7 building Codex + sp-x7 deploy; Opus cap 1 for C2/C3 boards):**
- C1-DW sp-x5 · C1-Pine scenes sp-x9 · C1-Pine bakes sp-x10 (also the single map owner: one clean bake per batch window, no per-commit chain) · C2 looks sp-x4 · C4 creatures sp-x1 (after the Sim-road part eight) · C5 quests sp-x6 (after DW batch 2) · C9 glue sp-x8 (Z3, after keyed sky) · sp-x7 deploy only (G485).
- Each lane owns its component's files in both shards; cross-component needs go to the owner. C3/C6/C7/C8 leftovers go to the first free lane.

**Perf:** Sim floor p95 ≤ 35 ms: Sky passes; Pine, Nalati, DW travel 36–46 ms across runs (sp-x1 part six: zlib decode + microtasks, inflate pacing).

**Memory:** settled Nine 1,242 MB over the 1.2 GB report cap; others 600–900 MB.

**Order (G471/G477/G483/G486/G487):** W2 Pine/DW ≤ 20 % via features + ONE lane on DW then Pine easy batches (G487); Sky/Signal-to-zero (G486): Z11 single scene registry with Z2 adopters, Z3 (items/plumbing knobs) any lane, Z2 Sky/Signal steps + Z8, Z10 explore/catalogue, light emitters + eased field (Z7/Z9), then the Z1 lockstep landing deleting both runtimes after W2; W3 Nalati/Nine after W2. Rows: [open-x-queue](open-x-queue.md).
Paused: SF22 SF57 SF67.
