# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**03:45Z `57e7b68b9` (G445 source ruler): Pine 88.60 %, DW 80.93 %, Sky 92.12 %, Signal 43.52 %** (02:50Z 89.53 / 81.46). Unknown owners 51 / 69 / 68 / 55. Old ruler at 01:00Z: Pine 66.32, DW 56.20.
Pine/DW: C1 3718/3661 · C2 2462/2352 · C3 156/0 · C4 3724/1679 · C5 1945/1311 · C6 2434/898 · C7 13/503 · C8 983/1739 · C9 3366/1750. Pace ~315 lines/h (Pine −197, DW −92 in 55 min) and falling.
Since 02:50Z: Pine constructors `c5d186c6d` (−36), dead combat math `43bc4d74e` (−24), bow geometry `934a67e61` (−21), world contracts `a9b36ab86` (−20); DW finale `06fe2dd7c`, barrel plates `bdcc27c64`, creature sites `2cc5c05cd` (−11 to −13 each).

**Lanes (G432 Opus; Claude weekly 20 %; Codex 5 + pusher):**
- Opus: none running; all 5 held for the G447 design rows (S4/S5/W2c are Opus) and W3. Pine and DW bakes are surveyed out.
- Codex: x1 Pine weapons; x4/x7 dead-code sweeps; x5/x6/x8 G437 engine graph CPU (key hashing / shadow sampler / UBO+node updates; risky changes default-off behind a Debug row). DW wrappers, DW creatures, Pine and DW page/native: pools dry at -10.

**Rulings:** offline bakes are honest (`1c125707c`); content rows replacing runtime search were honest; G448 now bars hand-converting data/ to JSON, so no new data tables until the design lands.

**G445 (01:30Z):** only JSON counts as data. x7 changes the ruler first (data/*.ts counted, GLSL rule kept, one ceiling rebase) and re-measures every shard. Every lane and Opus lane is told: content rows are JSON only. Then the conversion wave: declaration-only TS tables → JSON split by shard across Codex lanes, then data/ logic → runtime/ or hosts. W1 (Sky, Signal) reopens.
**G447 HOLD (02:00Z):** the ruler must measure the BUILT shardfile; design due ~03:30Z. G446 conversion stopped (x4, x5, o256 told to stop at a clean point or delete drafts). x7's source-side ruler `f0ca1f1c8` landed BEFORE the hold (data/*.ts counted; no gate fails); left in place, not extended: revert only if the design says so.

**Waves (G443/G444):** W2 closes 17:00Z 10-16 wherever it stands (or earlier at ≤ 20 % + G420); then final numbers here, leftovers → W3 rows, W3 starts, queue ordered by total lines dropped (G441 host ports first). G441 table checked 01:25Z: 78 entries / 43 rows, all consistent. No W3 prep before noon. In force: G415–G449 (G449: runtime/ standalone; no new runtime→shard imports).

**End-of-plan lists:** memory: Pine props, DW piers, map fix `bf2f3fcb2`, image cache. Perf: graph per-draw CPU. UI: DW finale caption overlaps the quest banner.
**G439 refs:** DONE.

**For wildshard-v:** lanes are hitting the -10 floor (DW wrappers dry, Pine native chain dry); W2 pace will fall further. The design (`2ead9dfa1`) recommends P0–P4 on Codex tonight (Q6 option 2); lifting the G447 hold would put lanes back on big work. G447 hold applied; keep `f0ca1f1c8` until the output ruler lands (recommended). G442 closed.
Paused rows: SF22, SF57, SF67.
