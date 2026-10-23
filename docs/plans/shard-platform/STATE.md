# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras now: G672 settings burn-down
(dedicated), loading (U, L9-L15), TOOLING-PERF (G668/G670/G671), tile streaming.

**(1) LIVE ff45b6a24d.** OPEN: the INFINITE WILDSHARD grid boot hangs at "Building the world 79%" on 9cd55b1591
(fine at 7fb412a0de); sp-o3 bisects 22 commits, the culprit's owner fixes forward; sp-x7 releases nothing past
7fb412a0de without a passing exact grid smoke leg. Closed since 15:00: Signal Explorer dark (7dfa08ba3e, quest dusk),
config bundle (62c457234c), template map (f8b07296f3, 03fe313b4f), ruler spans (f5b7a2a7c8). No reverts (G674).

**(2) Nalati.** G665 Titan + G667 cases 1-3 listed (0e8fb84d34, cf7e52d1df, d0e5c8712a, fdf64a8fc9); case 4 weather
ported (7fb412a0de, -15 TS; night fix b13e49da3b, re-shoot pending). Left: the entry (R15c/R15d) plus pick 1 below.

**(3) Grid / frame floor.** DR11 5x5 shipped (070d9d96f0), 4-world cap deleted (8a97034b97), T6 dormancy, T11.
sp-o1: leave freeze (5c108bd3ce first step), ring prelink, DW walk 0.78 m low (checking 46556b0076 vs harness).
Update pill: tap → title 9.5 s → 1.56 s on the Sim (e69de24d5d); L11 product admission 4ebabae282, timing pending.

**G672 settings (sp-x8 + sp-o4 graphical):** DR19 78b5f111e7 + 4081790d50 (Apply staged, taps 1 ms, Sim pass),
DR18 892004cd85, DR2, DR6, DR13, DR15, DR4 landed; DR16 next. sp-o4: DR3 landed, DR12/DR10/DR1/DR5/DR8/DR9 next.
Title/Settings taps (0e57b19022): first-tap pass in a WebKit Sim harness, not a physical tap.

**Tooling:** GR1 generators closed (all 24 products build). H1 pre-commit 3.2 → 1.0-2.3 s (29d7c2079b). SW7 guards,
SW5, SW6, C4, P1 landed (sp-x9; XS rows next, V3 Explorer sweep first). S3: 24 of 31 repeat-red files green.

**For wildshard-v (Jake picks needed):**
1. Nalati's remaining one-user code (stealth controller + rows, riding world-frame loans, elite/titan/night frame
   adapters, signal → HUD effect adapter ~25): (a) HOST-AUDIT like G667 (recommended), (b) second shard, (c) charged.
2. Signal Dunes quest-end deep dusk is unchanged since 10-10 (key light 5 %); keep or lighten? Board
   art/grid/round-54-explorer-dark/board-explorer-fix.jpg.
3. Night Market pilot done: art/grid/round-55-night-market-in-game/board.jpg (daylight not dusk lanterns, sparser
   kit). Next NM step is Jake's.

**Lanes:** Claude weekly 66 % (+~1.5/h); at 70 % sp-o1 stops (2 Opus: sp-o3, sp-o4). 5 Codex + sp-x7.

**Rules:** G605. G620 fix forward in 30 min, NO reverts (G674). No new Debug rows (G669). Guardrails G670 (card in
lanes/common.md). No one-user credit without a case pick (G571/G667); never herdr wildshard-v.
