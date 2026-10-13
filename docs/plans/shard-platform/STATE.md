# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 02:20Z. G345 sprint: Signal + Sky to 80/20 by ~09:30Z.** Review picks G349–G352 applied (queue Part D).

| Shard (per-export G294, `ddf5c4dea`) | 21:40Z → 02:20Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **51.8 %** | ≤ 824 lines | 80 / 3 |
| Sky Reach | 78.4 % → **53.3 %** | ≤ 1355 lines | 0 / 3 |

**Game exports (G351):** 104 total (from 328), 20 shard-facing `plugin/` modules.
**Ratchets (G349):** standing debt rule deleted, sweeper stopped (02:25Z); debt shrink-only.
**Next (Jake, review):** `bake(scene, identity)` and Signal through it to tiles + 0 private bins; SF81–SF85 reopened until their runtime is deleted; G350 exit row per shard.

**Fleet:** Codex sp-x7 push/deploy (others parked, Codex 7 %). Opus: world-rows host sp-o51, creatures sp-o54, Signal ground sp-o55, Signal through `bake()` + private bins sp-o59, war-fan viewmodel red sp-o58.
**Live:** `957b05e6`; release unpin `e6eeefc1e` (green on `de0130e95`) waits on the gate; origin `53d4b7aa0`.

**Calls for Jake (2026-10-13; reverse any):**
1. Bosses never shrink on the phone (`30dc4c9ae`).
2. Road seam beside Signal = drawn sand tint, not map brown (`f54924aa3`; `progress/shard-platform/sp-o46/`).
3. Sky parity rename `far.boss`→`far.roc` via `test/parity/renames/G345.json`, not a re-record (`586f62fa2`).
4. Missing Sky models stand undrawn instead of code stand-ins (`4312d61a7`, `d5267c284`).
5. Code moved into `data/` is no cut; shaders moved back (`5a5ff7f6d`); metric made per-export (`ddf5c4dea`).
6. Kept graph standing rules only for downward layer edges (game→engine, sdk→engine/game, →format, shards→sdk/commons); removed shards→engine/game. **Touches G349: confirm or delete all.**
7. Viewmodel ≤ 33 px / 1.1 M differences accepted as identical (`0e00aa4e7`).
8. One entryway proof for Sky, Nine and shardfiles (`add1035d6`): the metric now credits Sky's 110-line socket-lift proof to Nine too (Nine has no lifts), so Sky's −120 is really ~−20 lines.
9. Rope/tie bake skipped (bridges.bin 19 → 227 KB for −10 lines; sp-o52).
10. New SDK export `./bake` (`6d2161e6f`, the design's call); `BakedPiece` / `Scatter` nodes live in it; terrain stays a bake input, not a scene node; Signal pieces stay piece GLBs (merging into tiles would change materials).

**Jake picks waiting:** 80/20 reach: **S1** quest state machines as AssemblyScript hooks / **S2** shaders as graph rows / **S3** accept ~25–30 % Signal, ~35 % Sky; recommend S1 + S3. Signal look A/B (`art/signal-look/round-1/`), recommend A. Near board `art/near-tier/round-3/`; hero round 4 `art/main-menu-hero/round-4/board.jpg` (recommend SQ-DW-a + LS-DW-c; LOOKS LINE, Jake: "I don't want to forget this main hero thing"). Others: `docs/reviews/shard-platform-open-picks.md`.

**Paused (G345):** frame floor (Sim Sky 37, Nalati 36; fixes unproven), SF22, SF57, SF67. Reds: `red-green.md`.
