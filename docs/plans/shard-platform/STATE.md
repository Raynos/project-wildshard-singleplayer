# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 03:05Z. G345 sprint: Signal + Sky to 80/20 by ~09:30Z.** Review picks G349–G352: queue Part D.

| Shard (per-export G294) | 21:40Z → 03:00Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **50.9 %** | ≤ 824 lines | 80 / 3 |
| Sky Reach | 78.4 % → **54.4 %** | ≤ 1355 lines | 0 / 2 |

**Game exports (G351):** 104 total (from 328); `plugin/` 20 → 17, 14 next (sp-x5).
**Push (Jake `a44511f05`, `193a7e998`, `ef0eb5e04`, `267504b5a`; sp-x7 building):** debt shrink-only, refused per file at commit; generated files made at commit, never at push (regen bot goes); pre-commit ≤ 10 s, local gate ≤ 2 min, full suite/bakes in CI with fix-forward; no repeat retries; allowed graph counts report-only; exact-number tests → limits (sp-o66). **Origin stuck at `53d4b7aa0`** while the gate is rebuilt; live `957b05e6`, unpin `e6eeefc1e` queued.

**Fleet (Jake `267504b5a`): 4 Opus + 3 Codex.** Codex: sp-x7 push, sp-x5 plugin trim, sp-x6 navigation row (navmesh for both shards). Opus: sp-o63 Signal `terrain.bin`, sp-o64 Sky brains + rig compression, sp-o65 Sky island tiles, sp-o66 limit tests.

**Looks (Jake `90f70e28f`, `493f45cfd`):** hero **NA-a SHIPPED** (`8493cdba6`, cropped from round 4). **Next free Opus = looks lane:** (1) per-cell tier readout (near / far / entered) on the board; (2) B must hide the far proxy's terrain for near cells and draw the dense near terrain (round 3 shows "far proxy" everywhere, so B only stacked props); (3) nearest cells incl. diagonals (G371, Pine); then re-shoot four road views + hero + NA-a for the desk; round 4 on Nalati's hills + edges (don't ship). Next visual slot after: **bench-max lane**. Signal ground switch queued (`12af98655`).

**Calls for Jake (2026-10-13; reverse any):**
1. Bosses never shrink on phone (`30dc4c9ae`).
2. Signal road seam = drawn sand tint (`f54924aa3`).
3. Missing Sky models stand undrawn, no stand-ins (`d5267c284`).
4. Metric per-export (`ddf5c4dea`); entryway proof credits Sky's lift proof to Nine (`add1035d6`).
5. Signal dusk proven by uniforms, not captures (`d9112c821`).
6. New SDK export `./bake` (`6d2161e6f`).
7. Fan test snapshot re-accepted; game viewmodel 0 px diff (`5dc782337`).
8. Plugin folds into existing modules (SDK callers block internalising).
9. `terrain.bin` → session-installed engine ground loader (no debt rise).
10. Rigs +2.3 MB (`38145d61d`); compression in flight.
11. Sky tiles = island prop tiles its runtime draws, no fake tiles (`28439b8ee`).
12. Commons 0 packs; plan desk: SF26/DS1.6 done-when → "first two-real-shard pack (G355)".
13. Hero cropped from the labelled round-4 board image (label band removed).

**Jake picks waiting:** 80/20 reach **S1** quest machines as AssemblyScript / **S2** shaders as graph rows / **S3** accept ~25–30 % / ~35 %: recommend S1 + S3. Signal look A/B (`art/signal-look/round-1/`): recommend A.

Paused: frame floor, SF22, SF57, SF67.
