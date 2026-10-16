# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**On the G445 source ruler (`f0ca1f1c8`, census at `61f8f4271`): Pine 90.56 %, DW 83.03 %, Sky 92.12 %, Signal 43.52 %** (Nalati 105.9, Nine 77.0). Unknown-owner files now 52 / 69 / 68 / 55 (Pine/DW/Sky/Signal), flagged. Old ruler at 01:00Z: Pine 66.32, DW 56.20, Sky 9.58, Signal 9.73.
Pine/DW (G445 ruler): C1 3777/3876 · C2 2470/2373 · C3 156/0 · C4 3801/1769 · C5 1995/1323 · C6 2592/896 · C7 13/503 · C8 1024/1757 · C9 3389/1756.
Since 01:00Z: King phasedBoss `fcf93f28c` (Pine −133), code parts `b90bb35a2` (−104), DW arm rig `e3b00d153` (−138), plant kit `1d333bfe7` (−125), Pine bakes o254 (−76), HerdShelter `ea61b9044` (−57).

**Lanes (G432 Opus; Claude weekly 20 %; Codex 5 + pusher):**
- Opus: o253 DW bakes (fireflies, Cove, gull); o254 Pine bakes; o255 King pose onto NativeCreaturePose (old saves load, witness rebake). 3 slots held (no free visual target).
- Codex: x7 maps batch 5 then Pine content; x4 DW C6/C8; x5 DW C5; x1 Pine weapon channel rows; x6 DW Enemies/captain; x8 Pine page/native dedup (HerdShelter `ea61b9044` −57).
- Slots: check = x1 x5 x8 · check2 = x4 x6 x7 · check3 = Opus + measure.

**Rulings:** offline bakes are honest (`1c125707c`); content rows replacing runtime search were honest; G448 now bars hand-converting data/ to JSON, so no new data tables until the design lands.

**G445 (01:30Z):** only JSON counts as data. x7 changes the ruler first (data/*.ts counted, GLSL rule kept, one ceiling rebase) and re-measures every shard. Every lane and Opus lane is told: content rows are JSON only. Then the conversion wave: declaration-only TS tables → JSON split by shard across Codex lanes, then data/ logic → runtime/ or hosts. W1 (Sky, Signal) reopens.
**G447 HOLD (02:00Z):** the ruler must measure the BUILT shardfile; design due ~03:30Z. G446 conversion stopped (x4, x5, o256 told to stop at a clean point or delete drafts). x7's source-side ruler `f0ca1f1c8` landed BEFORE the hold (data/*.ts counted; no gate fails); left in place, not extended: revert only if the design says so.

**Waves (G443/G444):** W2 closes 17:00Z 10-16 wherever it stands (or earlier at ≤ 20 % + G420); then final numbers here, leftovers → W3 rows, W3 starts, queue ordered by total lines dropped (G441 host ports first). G441 table checked 01:25Z: 78 entries / 43 rows, all consistent. No W3 prep before noon. In force: G415–G449 (G449: runtime/ standalone; no new runtime→shard imports).

**End-of-plan lists:** memory: Pine props, DW piers, map fix `bf2f3fcb2`, image cache. Perf: graph per-draw CPU. UI: DW finale caption overlaps the quest banner. Pine King/fallen witness hashes mismatched before `fcf93f28c` (o255 rebakes).
**G439 refs:** DONE.

**For wildshard-v:** G448/G449 applied. G447 hold applied; one question: keep or revert `f0ca1f1c8` until the output ruler lands? I recommend keep (W2 deltas stay comparable, nothing fails). G443/G444 in force. G442 closed.
Paused rows: SF22, SF57, SF67.
