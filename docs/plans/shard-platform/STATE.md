# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**G872 (Jake, 10-29): AUTONOMOUS BUILDER. NEVER WAIT FOR JAKE.** Picks take the recommended answer, land, and are logged
below for Jake's review with wildshard-v (an overturn becomes a new row). No idle lane while a counted row is open.

**Order:** QA rows (all archive blockers, G877/G879), then LD5-LD10 on his word (G873), then CO7 / CO8, then all stop (G845).
The 14:00 deadline gave way to Jake's QA round 2.

**LIVE 8621318d93 (build 8621318d9-mvtvd1tf): Jake's QA build.** He QAs it now.
**[qa-2026-10-29-2](qa-2026-10-29-2-mini-plan.md) (G879):** QB2 done 125bda0483; QB1/3/4 sp-o3 slice 48cf59e3ce, rest in
RL; QB5 sp-x6; QB6 sp-o5 (title line done 4d63cf2513); QB7 sp-x9 cause → sp-o4; QB8 sp-o4; QB10 + QB14 sp-x9; QB11 sp-x6;
QB12 sp-o5; QB13 sp-x2. **[reload-simplify](reload-simplify-mini-plan.md):** RL1/RL3-RL6 sp-o3, RL2 sp-o4, RL7 sp-x10
(G881: no checksum on cache reads), RL8 sp-x2, RL9 sp-x1.

**Done today:** Nine + Far Reach archived (44c51cc4ac), G548 build speed, CO1-CO5, PL6, QA1-QA14, D196-D207.

**Autonomous decisions (for Jake's review):**
- D183 = B (tiles win); D185 keeps both texture paths; PL15 = A (parsePaced host kept); PL16 row default off.
- QA7 grass kept, no clump (69db68c0ff); QA8 world links under the loader (0865113756); QA6 fog 0.6 (e64b496bb9).
- QA8 / QA3 judged on WebKit + Simulator and Chromium 4x, not 10x; one cold 217 ms Sim frame accepted.
- QB11 (crossbow NaN draw) on Codex sp-x6: all 3 Opus on P0s, the fix restores behaviour, no look change (else Opus).
- RL7-RL9 (warm refetch, chunk hashes, persist) on Codex: SW caching changes no pixels (G848 keeps the SW on Codex).
- QB1 for wildshard-v: Sim cold launch shows launch image 0.4 s, title 1.4 s; Jake's ~5.5 s black is iOS starting the
  web app, and his home-screen install predates the launch image (48cf59e3ce, o3).
- families-board retired (3e9937f146); D53 debt; Pine pond, G99 isles kept; Pine drive (D12) under G815; D206 damage list.
- Spike section 3 taken (P1-P6, Q1-Q5, C1-C4, N1, F1, T1, L3-L6; X1 / X2 after the retro; DA1 / PF1 sent, G874).

**Rules:** G704, G807, G828, G844, G846, G848, G853, G858. No reverts (G674), no new Debug rows (G669), never herdr wildshard-v.
