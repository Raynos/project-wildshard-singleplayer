# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**05:39Z `b203929fb` (G445 source ruler): Pine 89.92 %, DW 80.93 %, Sky 92.12 %, Signal 43.52 %.** Pine +1.47 pt = f542 water fix now imports engine waterSurface (303) directly; x7 checking route. W2 adoption is saturated at the -10 floor.
Pine/DW: C1 3832/3661 · C2 2645/2352 · C3 148/0 · C4 3724/1679 · C5 1945/1311 · C6 2424/898 · C7 13/503 · C8 983/1739 · C9 3366/1750.
G437 perf wins: DW first frame 183 → 16.7 ms (`b5fab36ec`); late shader links 0 on Pine, Signal, hub (`6c4e5a3c0`); road links 7 → 0, hitches 5 → 1 (`e310b515c`, `2a934f726`); UBO uploads 24 → 13/frame (`d78199cea`); Fixed shadow samples row −0.40 ms DW (`a88e5e415`, default-off).
Milestones `78254116d` → `68cd273ea`: the ~1 s Pine stall is gone (drive 983 → 83 ms desktop, 852 → 148-216 ms Safari, after `3efc0d81d`). Floor still FAILS: Pine grid travel p95 33 ms desktop / 86-91 ms Safari; DW Safari standing 44 ms, road 52-75 ms (worse than before). x4 on Pine travel, DW Safari work 6-7 → 15-18 ms: first cause c5b1f0b2f (pickup graph), later graph ports also contribute; no ≥3 ms fix on HEAD, receipt `06f180053`, goes to the G437 perf pass. Pine ledger `54210bc02` + Safari 6 ms slice `ec3527529`: Safari approach p95 91 → 72 ms (still > 33; the rest would need longer loading, Jake's call); cold-gen catalogue fix `3e1f25d7b`.
Fixes: Pine grid entry (broke at de1b7286f) `f542a4cfb`; grid Pine KTX2 props white → textured (broke at 0ec8d4984) `c5ef7b1c1`.

**Lanes (G450, hold lifted 11:15Z):** Codex: x4 P0 lint · x5 P1 writer · x8 P1 loader · x6 P2b sections · x1 P3 runtime copy/catalog · x7 P4 output ruler + pusher. Opus: o258 P2a API spec · o259 S4 Sky/Signal graphs · o260 Pine W2c · o261 DW W2c · o262 S5 Sky/Signal world/. Rows in open-x-queue.md.

**Rulings:** offline bakes are honest (`1c125707c`); G448: no hand-converted JSON and no new data tables until the design lands.

**Decisions:** G450 lifts G447: Jake's picks (out/<slug>/, verbatim runtime/ copy, hashed blobs + logical names, build-only SDK uncounted, Pine/DW play folders into runtime/ now, P0–P4 now). G445 ruler `f0ca1f1c8` stays until P4. G449: runtime/ standalone.

**Waves (G443/G444):** W2 closes 05:00Z 10-17 (G451, midnight Cancun) wherever it stands (or earlier at ≤ 20 % + G420); then final numbers here, leftovers → W3 rows, W3 starts, queue ordered by total lines dropped (G441 host ports first). G441 table: 78 entries / 43 rows, consistent. No W3 prep before noon. In force: G415–G452.

**End-of-plan lists:** memory: Pine props, DW piers, map fix `bf2f3fcb2`, image cache. Perf: graph per-draw CPU (DW Safari +6-12 ms, receipt `06f180053`). UI: DW finale caption overlap.

**For wildshard-v:** G450 applied: 6 Codex + 5 Opus lanes on the design rows at 11:20Z. G451: W2 close moved to 05:00Z 10-17; rewire first; G452: then a W1 mini spike (Sky/Signal to ≤ 10 % on the output ruler, S1–S5), W3 only after both ≤ 10 %; Codex full speed; longer Pine loading OK (x4 next).
Paused: SF22, SF57, SF67.
