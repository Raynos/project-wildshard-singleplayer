# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 at 01:00Z `f62a2b67b`: Pine 66.32 %, Driftwood 56.20 % custom** (target ≤ 20 %; 00:10Z 67.04 / 58.68; start 107.6 / 104.2). 0 unknown. W1: Sky 9.58, Signal 9.73.
Pine/DW: C1 3826/3833 · C2 1240/1272 · C3 156/0 · C4 3549/1726 · C5 1965/1256 · C6 2445/985 · C7 13/1 · C8 354/176 · C9 525/398.
Pace 00:10-01:00Z: −579 lines (Pine −152, DW −427), ~690/h vs ~935 needed; ~16k lines left to 20 %.
Biggest: DW fauna boot rows `4d5696fe2` (−39), captain brain `9ddef8bb5` (−24/−11 honest), Pine hand parts (x1, −46, landing), Pine props hosts (o246, −40), lever rows `444bc0818` (−26).

**Lanes (G432 Opus 5/5, Claude weekly 20 %; Codex 5 + pusher):**
- Opus: o245 Pine looks; o249 DW cover host/arms; o250 DW offline bakes; o251 Pine offline bakes; o252 Pine King onto SDK phasedBoss + NativeCreaturePose (save migration, old saves load).
- Codex: x1 Pine hands; x4 DW coconuts; x5 DW NPC facing; x6 DW keeper/Enemies; x7 Pine compendium rows, maps batch 5 ~02:30Z; x8 Pine elite continuation.
- Slots: check = x1 x5 x8 o250 · check2 = x4 x6 x7 · check3 = Opus + measure.

**Coordinator rulings:** offline bakes are honest (precedent `1c125707c`): session-invariant geometry built by shard generators and loaded through a shared intake; offline-only code is not runtime. Authored content rows (data, content = 0 runtime) replacing runtime search are honest.

**End-of-plan lists:** memory (G433/G434): Pine cabin props (+1.47 MB), DW piers (+6.58 MB), map correction `bf2f3fcb2`, weak image cache. Perf (G436): graph per-draw CPU, DW cover/kit graph cost. UI: DW finale "THE SEALED RING · OPENED" overlaps the quest banner (pre-existing).
**G439 refs:** DONE. **New platform features (G438):** yawFrame, instancedQuad, memoUntilDisposed (o246); ZiplineTrolley (o248); memory-action brain + bindCreatureBrain (x6); selectEffectGrants (x4); floorAtRects rows (x8); HitscanPresentation (x1); director emits (x5).

**Waves:** W2 → W3 starts by itself at Pine and DW ≤ 20 % + G420 (G434). In force: G415–G442.

**For wildshard-v (needs Jake):** every Opus lane reports the big remaining modules (Pine buildings/cave/trophy wall/leg IK, DW streamed cover/ocean/island) are shard-specific with no second user, so they cannot honestly move under G441. Recommendation: keep W2 running on bakes + content rows, and let Jake decide at Pine/DW ~40 % whether W3 starts there (W3 ports then add the second users). G442 closed.
Paused rows: SF22, SF57, SF67.
