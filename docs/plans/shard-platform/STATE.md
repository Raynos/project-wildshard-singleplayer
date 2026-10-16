# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**W2 at 01:00Z `f62a2b67b` (old ruler): Pine 66.32 %, Driftwood 56.20 % custom** (target ≤ 20 %; start 107.6 / 104.2). 0 unknown. W1: Sky 9.58, Signal 9.73 (old ruler).
Pine/DW: C1 3826/3833 · C2 1240/1272 · C3 156/0 · C4 3549/1726 · C5 1965/1256 · C6 2445/985 · C7 13/1 · C8 354/176 · C9 525/398.
Since 01:00Z: King on SDK phasedBoss `fcf93f28c` (Pine −133), Pine code parts baked `b90bb35a2` (−104), DW arm rig `e3b00d153` (−138), DW cover host `dadd92c84` (−70, G441), plant kit `1d333bfe7` (−125), Pine compendium `4bb555103` (−60), hand parts `bcca49a2e` (−46).

**Lanes (G432 Opus; Claude weekly 20 %; Codex 5 + pusher):**
- Opus: o253 DW bakes (fireflies, Cove, gull); o254 Pine bakes; o255 King pose onto NativeCreaturePose (old saves load, witness rebake). Two slots held: no non-overlapping visual target.
- Codex: x7 G445 ruler change, then re-measure; x1 Pine weapon channel rows; x4 DW keepsakes; x5 DW quest content; x6 DW Enemies/captain; x8 Pine HerdShelter page/native dedup.
- Slots: check = x1 x5 x8 · check2 = x4 x6 x7 · check3 = Opus + measure.

**Rulings:** offline bakes are honest (`1c125707c`): fixed geometry built by shard generators, loaded through a shared intake. Content rows replacing runtime search are honest, but under G445 only as JSON.

**G445 (01:30Z):** only JSON counts as data. x7 changes the ruler first (data/*.ts counted, GLSL rule kept, one ceiling rebase) and re-measures every shard. Every lane and Opus lane is told: content rows are JSON only. Then the conversion wave: declaration-only TS tables → JSON split by shard across Codex lanes, then data/ logic → runtime/ or hosts. W1 (Sky, Signal) reopens.

**Waves (G443/G444):** W2 closes 17:00Z 10-16 wherever it stands (or earlier at ≤ 20 % + G420); then final numbers here, leftovers → W3 rows, W3 starts, queue ordered by total lines dropped (G441 host ports first). G441 table checked 01:25Z: 78 entries / 43 rows, all consistent. No W3 prep before noon. In force: G415–G445.

**End-of-plan lists:** memory: Pine cabin props, DW piers, map correction `bf2f3fcb2`, weak image cache. Perf: graph per-draw CPU. UI: DW finale "THE SEALED RING · OPENED" overlaps the quest banner (pre-existing). Pine King/fallen witness hashes mismatched before `fcf93f28c` (o255 rebakes).
**G439 refs:** DONE.

**For wildshard-v:** G445 in progress (ruler first, then JSON conversion). G443/G444 in force. G442 closed.
Paused rows: SF22, SF57, SF67.
