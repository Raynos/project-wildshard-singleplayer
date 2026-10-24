# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE 68ac787e6b (build 68ac787e6-mvm0spzb, 2026-10-24 06:31Z), released after full CI + all six exact smoke
legs; ff45 pin removed (692f9bd22e), hourly newest-CI-green deploys resume (sp-x7). Fixed on the way: boot race
(Safari <27 top-level await, 8198659879 + guard a0f26d2c27), worker 327cf572ca, Explorer warm 231aa398b9, six smoke
reds; CI now runs Explorer cases one at a time (0a0524a286). Settings DR19 is live with it.

**(2) NALATI 0: every shard at zero, C1-C9 closed, M3 100 %, M2 10/10 (ruler 27dd969127).** R27 done (168a974f29).
Next: HOST-AUDIT page READY docs/reviews/host-audit-inventory.md (6ec361162e: 114 groups, 95 keep / 18 fold / 1 retire;
Jake approves each), legacy deletion (G606).

**(3) Frame floor.** Desktop (466c98bac7): ALL 24 shipped shards PASS standing (59.9 fps, max 16.8 ms); grid drives
p95 16.8 but Pine max 1,117 ms (one 1.5 s gl.bufferData after pine-hollow:activate, sp-o3) and Nalati max 167 FAIL.
Quiet iOS Sim p95 (889 → fb72f24ad3): Pine drive 71 → 42 (max 95), interior 60 → 35 PASS; Nalati drive 53 → 46
(max 440), interior 59 → 47 (FAIL, bar 33); DW/template 35/37. Cuts: shader-build churn (variants 566 → 20 MiB), variant token keys (select 241 → 2), page
light budget 79fd45d18c, herd/Valibot/hash allocation. Nalati drive long frames: each WebAssembly.Memory costs 62-117 ms on JSC
(11 = 906 ms); all 11 now prepared before their consumer binds (01a399a3c8,
62fc95fcfb; wildlife/arena/timed still inside admission hooks); 440 ms frame being attributed (sp-x1). JSON parse 160 → 6 ms (393a1c007f).

**Memory:** WebKit Sim floors menu ~166, T1 ~310-330 MiB vs M1's 50/100 (FAIL). Same source drifts ~10 MiB between
cohorts; churn cuts don't move floors (they cut GC, not WebKit's dirty pages). M1's 50 MiB menu is below WebKit's own floor (framework 57 MiB): recommend re-basing
M1 on menu → T1 growth. Lanes are off memory floors; render targets (49 MiB) parked.

**Tooling:** gen warm 53-67 s → 2.7 s; G6 fences closed (waits a single-shard pair). DW tiles: wire 12.3 → 10.8 MB look-identical;
pick for Jake: art/driftwood-isle/round-19-tile-lod (3af5687a53) A landed / B / C; only C gets 6,4 + 2,5 under 4 MB.

**For wildshard-v:** Night Market road view: A done (art/grid/round-60-night-market-road-a); B / C open. OPEN: (1) L10 cold-wire ceiling, ratchet from 15.1 MB (recommended);
(2) M1 re-base (above); (3) Explorer: pause the blurred background orbit while thumbnails build (~1/3 less GPU per card,
CI margin; recommended only if CI still misses after serialised cases).

**Lanes:** Claude weekly 86 %: 1 Opus (sp-o3); 5 Codex + sp-x7.

**Rules:** G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
