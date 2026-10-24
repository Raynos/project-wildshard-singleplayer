# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE 29fbc87055 (09:49Z; 4fc3160db2 08:50Z, f62917679d 07:36Z), each after full CI + all six exact smoke
legs; ff45 pin removed (692f9bd22e), hourly newest-CI-green deploys running (sp-x7). Six smoke reds + boot race fixed on the way.

**(2) NALATI 0: every shard at zero, C1-C9 closed, M3 100 %, M2 10/10 (ruler 27dd969127).** R27 done (168a974f29).
Next: HOST-AUDIT page READY docs/reviews/host-audit-inventory.md (6ec361162e: 114 groups, 95 keep / 18 fold / 1 retire;
Jake approves each), legacy deletion (G606).

**(3) Frame floor.** Desktop (466c98bac7): ALL 24 shipped shards PASS standing (59.9 fps, max 16.8 ms); grid drives
p95 16.8, max Pine 1,117 → 66.7, Nalati 167 → 50.1 ms (f7e74f576e); left: owner CPU share FAIL.
Quiet iOS Sim p95 (889 → 2e86e67846): Pine drive 71 → 35, interior 60 → 34; Nalati drive 53 → 43 (road spike 448 → 67
ms: Wasm memory pool + virgin stock + single-build restore DB1, zero Memory on the drive), settled 59 → 46 FAIL: spikes
overlap FULL GCs every 0.6 s (DW 1.25 s, p95 34); nothing requests them, Chromium allocation -13.6 % didn't move them;
sp-x1 measuring WebKit typed-array bytes, sp-x8 JSC kernel ranking. Desktop owner CPU: Nalati 4.4 vs 4.17 ms (sp-x6).

**Memory:** WebKit Sim floors menu ~166, T1 ~310-330 MiB vs M1's 50/100 (FAIL). Same source drifts ~10 MiB between
cohorts; churn cuts don't move floors (they cut GC, not WebKit's dirty pages). M1's 50 MiB menu is below WebKit's own floor (framework 57 MiB): recommend re-basing
M1 on menu → T1 growth. Lanes are off memory floors; render targets (49 MiB) parked.

**Tooling:** gen warm 53-67 s → 2.7 s; G6 fences closed (waits a single-shard pair). DW tiles: wire 12.3 → 10.8 MB look-identical;
pick for Jake: art/driftwood-isle/round-19-tile-lod (3af5687a53) A landed / B / C; only C gets 6,4 + 2,5 under 4 MB.

**For wildshard-v:** Night Market road view: A done (art/grid/round-60-night-market-road-a); B / C open. OPEN: (1) L10 cold-wire ceiling, ratchet from 15.1 MB (recommended);
(2) M1 re-base (above); (3) Explorer: pause the blurred background orbit while thumbnails build (~1/3 less GPU per card,
CI margin; recommended only if CI still misses after serialised cases).

**Lanes:** Claude weekly 88 %: 1 Opus (sp-o3); 5 Codex + sp-x7.

**Rules:** G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
