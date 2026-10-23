# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE ff45b6a24d, pinned until the next green build.** Update blocker FIXED (aaafe0c310: the new worker rejected L9's
boot-*.json as foreign .js). KNOWN, one-time per phone: after updating from ff45 the FIRST INFINITE WILDSHARD tap lands on the
title (old boot's stale recovery drops the route); the second tap reaches the world, no loop. sp-x1 is still fixing it. I lifted
the hold for it: the next fully green CI + exact grid smoke releases. Full HEAD build passes locally (sp-x7, G676).

**(2) Nalati, 3 Codex lanes on the counted entry (R21-R27).** Landed: R21 manifest.json 0a735f4f2b (-25), R22 1ca71988dc
(-2), R23 c7ea68d934 + 839fa9e120 + 4090913f6a (index 57 → ~40), R24 room stage 69b1012ef9, R26 stealth/timers/elites
3f1365be73 + 94bab1a0cd + 289727c795, G677 credit d04c5bb554, plus 329c4bf058. Next: R24 native assembly (sp-x8), R26
activation (sp-x2), R27 compiled-entry flip (sp-x6).

**(3) Frame floor.** Desktop standing: 7 shards pass at 60 fps. Cold shader links fixed: DW crossing 1,483 → 150 ms,
Nalati desktop activate 1,700 → 317 ms, Pine 2,300 → 133 ms (108749e824, 0b5a4d7a8a). Nine travel 750 → 133 ms.
Next: Pine desktop interior p95 33 ms (sp-o4).

**Loading/memory:** cold Signal Dunes controls 6.78 → 5.29 s, wire 17.05 → 15.07 MB; the '218 MB prefetch' was DevTools'
response bank, not the game (tools fixed e17a51f183). C3 title has no three.js; corrected floors: menu 119 MiB combined.

**Tooling / no-binaries:** gen warm 53-67 s → 2.70 s; G10 267 jobs x2 identical. B5 today well over -11 M chars; shared
raw intake 4 users (+83 of 160 TS).

**For wildshard-v:** answered G677 (R26). Signal dusk lightened 8cfdbaf4a8 (board art/sunscar-dunes/round-10-lighter-dusk).
Night Market: board art/grid/round-59-night-market-palette (mockup palette b25ceded38, fuller crowns af0cb35d9e; clip
tmp/o27/nm/nm10-motion.mp4); 'night sky' was our misread of the dusk mockup, reverted (Jake can overrule). Road-eye view
options: A done (poster top 9.25 → 6.2 m, board art/grid/round-60-night-market-road-a); still a wall vs the mockup's sign, so
Jake may pick B (lower/see-through edge barrier) or C (raised road viewpoint). OPEN: (1) L10 total cold-wire ceiling, a ratchet from
15.1 MB (recommended); (2) look call: one PMREM reflection size per tier (removes per-size shader variants; recommended).

**Lanes:** Claude weekly 76 %: 2 Opus (sp-o3, sp-o4; 1 at 80 %); 5 Codex + sp-x7.

**Rules:** G605. Fix forward in 30 min, NO reverts (G674). No new Debug rows (G669). Guardrails G670. No one-user
credit without a case pick (G571/G667/G677); never herdr wildshard-v.
