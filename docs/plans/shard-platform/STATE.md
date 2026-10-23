# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE ff45b6a24d, pinned until the next green build.** Update blocker FIXED (aaafe0c310: the new worker rejected L9's
boot-*.json as foreign .js). KNOWN, one-time per phone: after updating from ff45 the FIRST INFINITE WILDSHARD tap lands on the
title (old boot's stale recovery drops the route); the second tap reaches the world, no loop. sp-x1 is still fixing it. I lifted
the hold for it: the next fully green CI + exact grid smoke releases. Full HEAD build passes locally (sp-x7, G676).

**(2) Nalati: ZERO in source.** R23-R26 all landed (sp-x8 R23-R25 incl. final 1415be1c65 + weather fix 982cadec11;
sp-x2 R26 + activation 20a179698e + G677 credit d04c5bb554). R27 (sp-x6: index.ts/state.ts deleted, compiled entry) is
green locally; sp-x8's read-only census shows Nalati C1..C9 = 0. Landing next, then boot smoke + physics walk. Every shard
is then at 0 custom lines; next comes HOST-AUDIT (Jake approves each listed host) and legacy deletion (G606, Jake).

**(3) Frame floor.** Desktop: 7 shards pass standing at 60 fps; grid template PASS, Pine interior PASS (p95 33 → 16.8 ms:
a real bug froze Pine's herds, 25735bb716), Pine crossing drive 2,300 → 117 ms (bar 100), Nalati leg rerunning. Phone:
Nine travel 750 → 133 ms, DW crossing 1,483 → 150 ms. Release still waits on a fully green CI (sp-x7 + sp-x9 fixing the
last reds: DW headless raw loan e4fbebbd23, director schema).

**Loading/memory:** cold Signal Dunes controls 6.78 → 5.29 s, wire 17.05 → 15.07 MB; the '218 MB prefetch' was DevTools'
response bank, not the game (tools fixed e17a51f183). C3 title has no three.js; corrected floors: menu 119 MiB combined.

**Tooling / no-binaries:** gen warm 53-67 s → 2.7 s; G10 267 jobs identical; B5 done bar 55 k kept/blocked chars.

**For wildshard-v:** answered G677 (R26). Signal dusk lightened 8cfdbaf4a8 (board art/sunscar-dunes/round-10-lighter-dusk).
Night Market: board art/grid/round-59-night-market-palette (mockup palette b25ceded38, fuller crowns af0cb35d9e; clip
tmp/o27/nm/nm10-motion.mp4); 'night sky' was our misread of the dusk mockup, reverted (Jake can overrule). Road-eye view
options: A done (poster top 9.25 → 6.2 m, board art/grid/round-60-night-market-road-a); still a wall vs the mockup's sign, so
Jake may pick B (lower/see-through edge barrier) or C (raised road viewpoint). OPEN: (1) L10 total cold-wire ceiling, a ratchet from
15.1 MB (recommended); (2) look call: one PMREM reflection size per tier (removes per-size shader variants; recommended).

**Lanes:** Claude weekly 77 %: 2 Opus (sp-o3, sp-o4; 1 at 80 %); 5 Codex + sp-x7.

**Rules:** G605. Fix forward in 30 min, NO reverts (G674). No new Debug rows (G669). Guardrails G670. No one-user
credit without a case pick (G571/G667/G677); never herdr wildshard-v.
