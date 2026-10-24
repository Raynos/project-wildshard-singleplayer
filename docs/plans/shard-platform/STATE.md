# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE ff45b6a24d, pinned until the next green build.** Release candidate 7325af806f: full CI GREEN (28/28; has the
DW boot, Nalati boot, CI and smoke title-catalogue fixes); exact six-leg smoke 40046752360 queued (sp-x7), then unpin.
HEAD's Pine config build red from 092ca9544b fixed 889ee08a15 (sp-x8, full preview running).

**(2) NALATI 0: every shard at zero, C1-C9 closed, M3 100 %, M2 10/10 (ruler 27dd969127).** R27 done (168a974f29).
Next: HOST-AUDIT page READY docs/reviews/host-audit-inventory.md (6ec361162e: 114 groups, 95 keep / 18 fold / 1 retire;
Jake approves each), legacy deletion (G606).

**(3) Frame floor.** Desktop: 7 shards pass standing at 60 fps. c0436e94ba drives: Pine p95 33.4 → 16.8 ms (1.7 s
readback stall fixed; one 117 ms GPU-side frame left); Nalati p95 16.8, interior owner CPU 6.7 > 4.2 ms (sp-x6).
Phone (Chromium 4x): Nine travel + entry p95 33.4 (bar 33); drive p95 66.7: TSL node builds were multiplied by copied
warm-up lights, fixed 4764cd1705 (drive builds 189 → 129); sp-o3 cuts Nine's last 3 programs/material + 35 no-graph
builds. Official iOS Sim frame floor (sp-x1) runs on 889ee08a15.

**Memory:** WebKit Sim floors menu ~166, T1 ~310-330 MiB vs M1's 50/100 (FAIL). Same source drifts ~10 MiB between
cohorts, so only interleaved A/B counts; JS churn cuts (load + play, 8 SHAs) moved T1 +1.5 MiB (none): they cut GC work,
not the dirty pages WebKit keeps. M1's 50 MiB menu is below WebKit's own floor (framework 57 MiB): recommend re-basing
M1 on menu → T1 growth. Lanes are off memory floors; render targets (49 MiB) parked.

**Tooling:** gen warm 53-67 s → 2.7 s; B5 done; G6 cache isolation (sp-x2). DW tiles: wire 12.3 → 10.8 MB look-identical;
pick for Jake: art/driftwood-isle/round-19-tile-lod (3af5687a53) A landed / B / C; only C gets 6,4 + 2,5 under 4 MB.

**For wildshard-v:** Night Market road view A done (art/grid/round-60-night-market-road-a), still a wall: Jake may pick B
(see-through barrier) or C (raised road view). OPEN: (1) L10 cold-wire ceiling, ratchet from 15.1 MB (recommended);
(2) PMREM phone 64 landed fcc872ee4b, no visible change; (3) M1 re-base (above).

**Lanes:** Claude weekly 81 %: 1 Opus (sp-o3); 5 Codex + sp-x7.

**Rules:** G605. Fix forward, NO reverts (G674). No new Debug rows (G669). G670. No one-user credit without a case
pick (G571/G667/G677); never herdr wildshard-v.
