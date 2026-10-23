# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE ff45b6a24d, pinned until the next green build.** Update blocker and first tap after the update FIXED (official
Sim ff45 → 3de1c4c1ed). Nalati boot PASS (168a974f29); DW boot red from dcecab09e0 FIXED fe75139cd2 (sp-x8, DW boots).
CI reds fixed 90489bdb95 + 05437036a8 (sp-x6); CI on 05437036a8 running, then exact six-leg smoke (sp-x7).
HEAD build red from 6ab51ca8ef (skin schema export), sp-x8 fixing forward.

**(2) NALATI 0: every shard at zero, C1-C9 closed, M3 100 %, M2 10/10 (ruler 27dd969127).** R27 done (168a974f29).
Next: HOST-AUDIT page READY docs/reviews/host-audit-inventory.md (6ec361162e: 114 groups, 95 keep / 18 fold / 1 retire;
Jake approves each), legacy deletion (G606). Settings DR19 (78b5f111e7) waits only on the release.

**(3) Frame floor.** Desktop: 7 shards pass standing at 60 fps; grid template + Pine interior PASS. fe75139cd2 runtime
travel: Nalati 59.9 fps (owner CPU p95 6.8 > 4.2 ms, sp-x6); Pine drive p95 33.3 / max 117 ms FAIL (sp-o3 next). Phone: Nine travel 750 → 133 ms, DW crossing 1,483 → 150 ms. Nine drive
p95 83 ms: long frames are TSL node builds (~20 ms each, 189 per drive), multiplied by warm-up scene contexts
(env × PMREM size × layer × light set). sp-o3: one phone PMREM size fcc872ee4b, then drops warm-up contexts that never draw.

**Loading/memory:** cold Signal Dunes controls 6.78 → 5.29 s, wire 17.05 → 15.07 MB. WebKit Sim floors (120 s WC+GPU)
3de → 59d97775ba: menu 167 → 156, T1 321 → 310 MiB vs M1's 50/100 (FAIL). 83 % of menu → T1 growth is WebKit malloc
(+111 MiB) from JS allocation churn: load top skin Valibot + download snapshot (both cut), play 203 MiB / 20 s led
by tileStreamer 49 (sp-x9), gpuLabels 19 (sp-x8), checkpoints 17 (cut 338c538eb7). Render targets 49 MiB parked.

**Tooling:** gen warm 53-67 s → 2.7 s; G10 267 jobs identical; B5 done. DW tiles: wire 12.3 → 10.8 MB look-identical;
pick for Jake: art/driftwood-isle/round-19-tile-lod (3af5687a53) A landed / B / C; only C gets 6,4 + 2,5 under 4 MB.

**For wildshard-v:** Signal dusk lightened 8cfdbaf4a8 (art/sunscar-dunes/round-10-lighter-dusk). Night Market: board
art/grid/round-59-night-market-palette; road view A done (art/grid/round-60-night-market-road-a), still a wall, so Jake
may pick B (see-through barrier) or C (raised road view). OPEN: (1) L10 cold-wire ceiling, ratchet from 15.1 MB
(recommended); (2) one PMREM size per tier (phone landed fcc872ee4b; board only if visible).

**Lanes:** Claude weekly 80 %: 1 Opus (sp-o3; sp-o4 stopped 8387c57635); 5 Codex + sp-x7.

**Rules:** G605. Fix forward, NO reverts (G674). No new Debug rows (G669). G670. No one-user credit without a case
pick (G571/G667/G677); never herdr wildshard-v.
