# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**05:39Z `b203929fb` (G445 source ruler): Pine 89.92 %, DW 80.93 %, Sky 92.12 %, Signal 43.52 %.** Pine +1.47 pt = f542 water fix now imports engine waterSurface (303) directly; x7 checking route. W2 adoption is saturated at the -10 floor.
Pine/DW: C1 3832/3661 · C2 2645/2352 · C3 148/0 · C4 3724/1679 · C5 1945/1311 · C6 2424/898 · C7 13/503 · C8 983/1739 · C9 3366/1750.
G437 perf wins: DW first frame 183 → 16.7 ms (`b5fab36ec`); late shader links 0 on Pine, Signal, hub (`6c4e5a3c0`); road links 7 → 0, hitches 5 → 1 (`e310b515c`, `2a934f726`); UBO uploads 24 → 13/frame (`d78199cea`); Fixed shadow samples row −0.40 ms DW (`a88e5e415`, default-off).
Fixes: Pine grid entry (broke at de1b7286f) `f542a4cfb`; grid Pine KTX2 props white → textured (broke at 0ec8d4984) `c5ef7b1c1`.

**Lanes:** Opus none (5 held for the G447 design rows and W3). Codex: x4 last road hitch (Pine plugin import parse, interim prewarm); x7 milestone receipt (Pine cold stall, time-boxed); x1 x5 x6 x8 idle (pools dry, honest G437 cuts taken).

**Rulings:** offline bakes are honest (`1c125707c`); G448: no hand-converted JSON and no new data tables until the design lands.

**Holds:** G445 source ruler `f0ca1f1c8` landed before the G447 hold; left in place until the output ruler. G446 W1 conversion stopped. G447: design committed `2ead9dfa1` (6 questions for Jake). G449: runtime/ standalone; no new runtime→shard imports.

**Waves (G443/G444):** W2 closes 17:00Z 10-16 wherever it stands (or earlier at ≤ 20 % + G420); then final numbers here, leftovers → W3 rows, W3 starts, queue ordered by total lines dropped (G441 host ports first). G441 table: 78 entries / 43 rows, consistent. No W3 prep before noon. In force: G415–G449.

**End-of-plan lists:** memory: Pine props, DW piers, map fix `bf2f3fcb2`, image cache. Perf: graph per-draw CPU. UI: DW finale caption overlap. Look (Jake): Pine sluice is flat low-poly.

**For wildshard-v (needs Jake):** lifting G447 is now the main lever. (1) Every W2 pool is dry at -10, so pace is ~0. (2) Evidence: Pine's plugin import runs parseShardfile on every graph table synchronously, a 99.6 ms road hitch and likely the ~1 s cold Pine stall; the design's build-time validation removes it. Recommendation: Q6 option 2, P0–P4 on Codex now. Keep `f0ca1f1c8` until the output ruler lands.
Paused rows: SF22, SF57, SF67. G439 refs DONE. G442 closed.
