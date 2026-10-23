# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE ff45b6a24d, pinned until the next green build.** Update blocker FIXED (aaafe0c310). First tap after the update
FIXED: official Sim ff45 → 3de1c4c1ed, first grid tap enters the world unpaused, new worker active, no title loop (sp-x1).
Nalati boot guard MET (168a974f29). Release = first build with it + fully green CI + exact six-leg smoke (sp-x7).

**(2) NALATI 0: every shard at zero, C1-C9 closed, M3 100 %, M2 10/10 (ruler 27dd969127, 17:20 local).** R27 done
(168a974f29, elites dedup + label audit): exact milestone boots Nalati unpaused, 0 fatal/black, 12 walk legs 0 stuck. Next: HOST-AUDIT (Jake approves each listed host), legacy deletion (G606).
Lanes move to extras at their next boundary (G652/G661 order: tile streaming, Night Market road view, loading). Settings
DR19 landed 78b5f111e7 hours ago; it isn't live only because the release is stuck at ff45.

**(3) Frame floor.** Desktop: 7 shards pass standing at 60 fps; grid template PASS, Pine interior PASS (p95 33 → 16.8 ms:
a real bug froze Pine's herds, 25735bb716), Pine crossing drive 2,300 → 117 ms (bar 100), Nalati leg rerunning. Phone:
Nine travel 750 → 133 ms, DW crossing 1,483 → 150 ms; Nine drive p95 100 → 66.7 ms (dc99287c3f, bar 33).

**Loading/memory:** cold Signal Dunes controls 6.78 → 5.29 s, wire 17.05 → 15.07 MB; the '218 MB prefetch' was DevTools'
response bank, not the game. WebKit Sim floors (120 s WC+GPU) 3de → 59d97775ba (after C4 lazy split): menu 167 → 156,
select 168, T1 321 → 310, T2 310 → 308 MiB vs M1's 50/100 (FAIL). Next: WebKit heap split; render targets 38.8 MiB.

**Tooling:** gen warm 53-67 s → 2.7 s; G10 267 jobs identical; B5 done. DW tiles: wire 12.3 → 10.8 MB look-identical;
6,4 + 2,5 stay over 4 MB resident without visible LOD cuts (sp-o4 board coming, Jake's pick).

**For wildshard-v:** answered G677 (R26). Signal dusk lightened 8cfdbaf4a8 (board art/sunscar-dunes/round-10-lighter-dusk).
Night Market: board art/grid/round-59-night-market-palette (mockup palette b25ceded38, fuller crowns af0cb35d9e);
'night sky' was our misread of the dusk mockup, reverted (Jake can overrule). Road-eye view
options: A done (poster top 9.25 → 6.2 m, board art/grid/round-60-night-market-road-a); still a wall vs the mockup's sign, so
Jake may pick B (lower/see-through edge barrier) or C (raised road viewpoint). OPEN: (1) L10 total cold-wire ceiling, a ratchet from
15.1 MB (recommended); (2) look call: one PMREM reflection size per tier (removes per-size shader variants; recommended).

**Lanes:** Claude weekly 79 %: 2 Opus (sp-o3, sp-o4; 1 at 80 %); 5 Codex + sp-x7.

**Rules:** G605. Fix forward in 30 min, NO reverts (G674). No new Debug rows (G669). Guardrails G670. No one-user
credit without a case pick (G571/G667/G677); never herdr wildshard-v.
