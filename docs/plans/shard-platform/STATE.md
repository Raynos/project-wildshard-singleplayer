# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory (C1-C7),
TOOLING-PERF (G668), Night Market, tile streaming, no-binaries.

**(1) LIVE ff45b6a24d (~7.5 h behind).** Every CI red since has a pushed fix; last: Nalati JSON-node overrun (audio scene
4724b9b77c + ratchet 2957b28a50); sp-x7 (G676) proved the full HEAD build locally (all 24 products). Release = the first fully green CI + exact six-leg smoke incl. grid
(hang fix 9ee919dc14 proven). SW8 gate: 55 s → 8-34 s; budget overruns now defer to CI (aa1994c3a6).

**(2) Nalati: 225 counted lines, stalled since 10:20 (my call, wrong).** I held the entry (state.ts 139, index.ts 57,
manifest.ts 25) behind pick 1 and spent lanes on extras. Fixed 15:00 local: sp-o3 on state.ts (R15c), sp-x6 on index.ts +
manifest.ts (R15d, Nine-style compiled entry); every commit names its counted spans; one-user pieces get listed, not held.

**(3) Frame floor.** Nalati (sp-o3, 9 landings): look max 200 → 67 ms (30 fps), its own frames all < 200 ms; drive
max 250-350 ms left = sp-o4's sync shader link + precompile slice. Pine p95 67 → 50 ms. Template-2 leave → 133 ms;
S2 tile streaming -277 TS (c2a06d82e6). sp-o4: DW 1,067 ms crossing (7 programs linked at draw + weapons), then Nalati's last two frames.
sp-o3: frame census of Nine, Sky, Signal, template.

**Loading/memory:** cold Signal Dunes tap → controls 6.78 → 5.29 s; cold wire 17.05 → 15.07 MB (legacy packs and card
art cut). C1: the '218 MB prefetch holder' is a MEASUREMENT ARTIFACT: Chromium DevTools' network response bank (with Network never
enabled the buffer is 10 MiB, not 216). Past Chromium memory readings were inflated by up to ~200 MB; tools being fixed.

**Tooling / no-binaries:** G668 gen warm 53-67 s → 2.70 s (G1-G5, G6 in progress; G10 determinism 195 of 267 jobs match,
0 differences). B5 today ≈ -10 M chars incl. Nine 52 M orphan; poiPaint shared raw intake (+57 of 160 approved TS).

**For wildshard-v:** answered: G677 one-user adapters (R26, sp-x2), Signal dusk lightened (8cfdbaf4a8), NM gaps
(NM12 night sky 727c05dbf8, more next). OPEN: Loading L10 total cold-wire ceiling (15.1 MB ratchet, recommended).

**Lanes:** Claude weekly 73 %: 2 Opus (sp-o3, sp-o4); 5 Codex + sp-x7.

**Rules:** G605. Fix forward in 30 min, NO reverts (G674). No new Debug rows (G669). Guardrails G670. No one-user
credit without a case pick (G571/G667); never herdr wildshard-v.
