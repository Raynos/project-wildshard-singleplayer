# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 04:30Z. G345 sprint: Signal + Sky to 80/20 by ~09:30Z.** Review picks G349–G352: queue Part D.

| Shard (per-export G294) | 21:40Z → 04:30Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **48.2 %** | ≤ 824 lines | 80 / **1** (navmesh; physics from authored rows `e6f5078d8`) |
| Sky Reach | 78.4 % → **54.4 %** | ≤ 1355 lines | 0 / **1** (navmesh; physics `3ed995b80`) |

**Game exports (G351):** 104 (from 328); `plugin/` 20 → **14** (`1a513ba40`).
**Push (Jake `a44511f05`, `193a7e998`, `ef0eb5e04`, `267504b5a`; sp-x7 building):** debt shrink-only, refused per file at commit; generated files made at commit, never at push (regen bot goes); pre-commit ≤ 10 s, local gate ≤ 2 min, full suite/bakes in CI with fix-forward; no repeat retries; allowed graph counts report-only; exact-number tests → limits (sp-o66). **Origin stuck at `53d4b7aa0`** while the gate is rebuilt; live `957b05e6`, unpin `e6eeefc1e` queued.

**Sprint = S1 + S3 (Jake `fd841c551`). For wildshard-v: S1 is net-zero on Signal/Sky** (quest machines are already data rows). The counted mass is looks (fire, ground, dusk, Sky wind, 614 GLSL) and weapons. S1 dropped for these two shards; sp-o69 moved to Signal's ground switch. Recommend Jake re-weigh S2 (shader rows). **Never stop the line:** no holds; lanes CAS-retry.
**Fleet: 4 Opus + 3 Codex.** Codex: sp-x7 push, sp-x6 navigation, sp-x5 **bench-max** (warm ~10 s, cold 13.8 s open). Opus: sp-o65 Sky island tiles, sp-o75 looks (Sky/Blender near, near round 5), sp-o76 G350 exit rows for Nine/Driftwood. Pre-commit 26 → 9.4 s (`91cf2cdb7`).

**For wildshard-v, Jake pick:** hero round 6 over Nalati's far edge toward Driftwood, `art/main-menu-hero/round-6/board.jpg` (7 near + Nalati entered; Sky + Blender still far), **recommend SQ-NE-b + LS-NE-b**. NW-b ships (`53ba19d09`). Navigation switch (sp-x6) takes both shards to **0 private binaries**; Signal ground switch parked (`5449941c9`).

**Calls for Jake (2026-10-13; reverse any):**
1. Bosses never shrink on phone (`30dc4c9ae`).
3. Missing Sky models stand undrawn, no stand-ins (`d5267c284`).
4. Metric per-export (`ddf5c4dea`); entryway proof credits Sky's lift proof to Nine (`add1035d6`).
6. New SDK export `./bake` (`6d2161e6f`).
8. Plugin folds into existing modules (SDK callers block internalising).
9. `terrain.bin` → session-installed engine ground loader (no debt rise).
11. Sky tiles = island prop tiles its runtime draws, no fake tiles (`28439b8ee`).
12. Commons 0 packs; plan desk: SF26/DS1.6 done-when → "first two-real-shard pack (G355)".
14. Signal glows drape on a generated copy of the old ground heights (pixel-exact; `5cfc5674b`); `terrain.bin` gone (`602f8136a`).

**Jake picks waiting:** Signal look A/B (`art/signal-look/round-1/`): recommend A.

Paused: frame floor, SF22, SF57, SF67.
