# SHARD-PLATFORM — State (coordinator wildshard-new; ≤ 3 KB; overwritten)

**2026-10-13 03:35Z. G345 sprint: Signal + Sky to 80/20 by ~09:30Z.** Review picks G349–G352: queue Part D.

| Shard (per-export G294) | 21:40Z → 03:00Z | Target | Tiles / private bins |
|---|---|---|---|
| Signal Dunes | 70.7 % → **50.9 %** | ≤ 824 lines | 80 / 2 (`far.glb`, navmesh) |
| Sky Reach | 78.4 % → **54.4 %** | ≤ 1355 lines | 0 / 2 |

**Game exports (G351):** 104 (from 328); `plugin/` 20 → **14** (`1a513ba40`).
**Push (Jake `a44511f05`, `193a7e998`, `ef0eb5e04`, `267504b5a`; sp-x7 building):** debt shrink-only, refused per file at commit; generated files made at commit, never at push (regen bot goes); pre-commit ≤ 10 s, local gate ≤ 2 min, full suite/bakes in CI with fix-forward; no repeat retries; allowed graph counts report-only; exact-number tests → limits (sp-o66). **Origin stuck at `53d4b7aa0`** while the gate is rebuilt; live `957b05e6`, unpin `e6eeefc1e` queued.

**Sprint = S1 + S3 (Jake `fd841c551`):** quest state machines → AssemblyScript hooks now (next free Opus); land Signal ~25–30 %, Sky ~35 %, keep porting to 20 %; S2 later. **Never stop the line:** no holds; lanes CAS-retry.
**Fleet: 4 Opus + 3 Codex.** Codex: sp-x7 push, sp-x6 navigation, sp-x5 **bench-max** (pre-commit ≤ 10 s; today 13–25 s). Opus: sp-o67 looks, sp-o65 Sky island tiles, sp-o69 quests → AS (S1), sp-o70 far placeholder → SDK cache. Pre-commit 26 → 9.4 s (`91cf2cdb7`).

**Looks (sp-o67):** hero **NA-a SHIPPED** (`8493cdba6`). Readout honest + distance/diagonals (`97bd944c2`, `8e2e24d7a`); B does hide far terrain (round 3's "far proxy" was the readout); near ground keeps paint/creases (`043a96789`). Next: re-shoot four road views + hero, and NA above Nalati's centre LOOKING TOWARD DRIFTWOOD (`fd841c551`; square + landscape, phone 1x lens, a few heights/tilts filling the 3×3, each labelled with per-cell tiers); round 4 on Nalati's hills + edges (don't ship). Signal ground switch queued (`12af98655`).

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
13. Hero cropped from the labelled round-4 board.
14. Signal glows drape on a generated copy of the old ground heights (pixel-exact; `5cfc5674b`); `terrain.bin` gone (`602f8136a`).

**Jake picks waiting:** Signal look A/B (`art/signal-look/round-1/`): recommend A.

Paused: frame floor, SF22, SF57, SF67.
