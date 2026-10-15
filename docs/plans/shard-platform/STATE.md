# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 at 19:15Z `9296a81cc`: Pine 78.66 %, Driftwood 71.74 % custom** (target ≤ 20 %; 16:39Z 80.85 / 75.72; start 107.6 / 104.2). 0 unknown. W1 closed (Sky 9.58, Signal 9.75).
Pine/DW: C1 4401/4615 · C2 1805/2126 · C3 209/0 · C4 3922/2237 · C5 2503/1459 · C6 2952/1266 · C7 12/0 · C8 356/186 · C9 532/426.
Pace: about −0.9 pt/h Pine and −1.6 pt/h DW over the last 2.5 h. G432's 24 h needs roughly 2.4 / 2.1 pt/h.
Since 17:50Z: DW rock table `25fb99192` (−199), arms on graph toon `a1602d555` (−71), backdrop + ramp fog `3b651edbd` `e4841389d` (≈−49), W2 manifest JSON `a5e53cc7d` (Pine −51, DW −26), Pine elite brain `4c12492ec` (−32), King FX on graphs `5d7fbf38b` (C3 −60), lens drops + cover `fc7868cf4` `5d378a55d` (−53); DW re-entry fix `66984dac5`; engine I `9296a81cc`; six graph inputs (sp-x4).

**Lanes (G432 5 Opus while Claude < 50 %; Codex 5 + pusher; slots G435):**
- Opus: o225 DW island + creatures (island HELD on graph per-draw CPU cost); o227 Pine forest; o228 Pine water; o229 DW kit/rocks/palms (waits engine II); o230 Pine site lights shared with Signal, then DW gulls.
- Codex: x1 Pine rifle, then DW swords; x4 Pine cabin (G434), then C4 ambient; x5 Pine C5 quests; x6 DW pier (G434), then DW C4; x7 push, git, maps; x8 engine II, then node per-draw cost (~45 vs 8 µs, profile from o225).
- Slots: check = x1 x5 o225 o228 · check2 = x4 x7 o230 o229 · check3 = x6 x8 o227 measure.

**For the end-of-plan memory pass (G433/G434):** Pine cabin props (+1.47 MB GPU, +1.31 MB RAM, sp-x4); DW piers (+6.58 MB resident, +3.73 MB wire, sp-x6); map accounting correction `bf2f3fcb2`; parked `refs/parked/sp-x8-weak-cache`, `refs/parked/sp-x8-h`.

**Waves:** W2 → W3 (Nalati + Nine) starts by itself at Pine and DW ≤ 20 % + G420 (G434). In force: G415–G435.

**For wildshard-v:** the engine's graph-material per-draw CPU cost now gates the biggest DW look ports (island, creatures, kit): sp-x8 takes it right after II. G433 `dc01e03fb` received; G435 slots in use; no memory constant touched by my lanes.
Paused rows: SF22, SF57, SF67.
