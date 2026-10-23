# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory (C1-C7),
TOOLING-PERF (G668), Night Market, tile streaming, no-binaries.

**(1) LIVE ff45b6a24d (~6.5 h behind).** Every CI red since has a pushed fix; the last (Roc test, 6dbc3ee3a5 and the
King fixture in 969b88c9d9) closed by 19:00Z. Release = the first fully green CI + exact six-leg smoke incl. grid
(hang fix 9ee919dc14 proven). SW8 gate: 55 s → 8-34 s; budget overruns now defer to CI (aa1994c3a6).

**(2) Nalati.** Titan + G667 listed, weather ported. Left: the entry (R15c/R15d) plus pick 1 below.

**(3) Frame floor.** Nalati (sp-o3, 9 landings): look max 200 → 67 ms (30 fps), its own frames all < 200 ms; drive
max 250-350 ms left = sp-o4's sync shader link + precompile slice. Pine wrappers 4.4 → 2.95 ms/f, look/travel p95
67 → 50 ms. Template-2 leave 417-700 → 133 ms; ring prelink proven; x5 memory flat. S2 tile streaming -277 TS
(c2a06d82e6). sp-o4: DW 1,067 ms crossing (7 programs linked at draw + weapons), then Nalati's last two frames.
sp-o3: frame census of Nine, Sky, Signal, template.

**Loading/memory:** cold Signal Dunes tap → controls 6.78 → 5.29 s; cold wire 17.05 → 15.07 MB (legacy packs and card
art cut). C1 prefetch capped at 23.6 MiB but a ~203 MiB native buffer stays; one decisive diagnostic (DevTools
network never enabled) decides app vs inspector.

**Tooling / no-binaries:** G668 gen warm 53-67 s → 2.70 s (G1-G5, G6 in progress; G10 determinism 195 of 267 jobs match,
0 differences). B5 today ≈ -10 M chars incl. Nine 52 M orphan; poiPaint shared raw intake (+57 of 160 approved TS).

**For wildshard-v (Jake picks needed):**
1. Nalati's remaining one-user code (stealth controller + rows, riding world-frame loans, elite/titan/night frame
   adapters, signal → HUD effect adapter ~25): (a) HOST-AUDIT like G667 (recommended), (b) second shard, (c) charged.
2. Signal Dunes quest-end deep dusk unchanged since 10-10 (key light 5 %): keep or lighten?
   art/grid/round-54-explorer-dark/board-explorer-fix.jpg.
3. Night Market NM11 board: art/grid/round-56-night-market-nm11/board.jpg (gaps: fewer greens, dusk-not-night sky, no
   canal glow). NM10 motion (~4-6 h) only if you want more.
4. Loading L10: cold wire 15.07 MB vs ≤ 1.2x product (raw models ~3.7 MB + Rapier 3.3 MB are required). Recommended:
   a separate TOTAL cold-wire ceiling, a ratchet from 15.1 MB.

**Lanes:** Claude weekly 72 %: 2 Opus (sp-o3, sp-o4); 5 Codex + sp-x7.

**Rules:** G605. Fix forward in 30 min, NO reverts (G674). No new Debug rows (G669). Guardrails G670. No one-user
credit without a case pick (G571/G667); never herdr wildshard-v.
