# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE ff45b6a24d, pinned until the next green build.** Six smoke reds fixed; boot race (Safari <27 top-level
await, hit by parallel boot imports) fixed 8198659879 + guard a0f26d2c27 + worker 327cf572ca; Explorer CI margin
231aa398b9 (SwiftShader first card 104 → 58 s). Release = first build with all three: CI 40063759655 running, then
exact six legs (sp-x7). Parked lever: shader size (~48 KB/program) for CI margin + phone builds.

**(2) NALATI 0: every shard at zero, C1-C9 closed, M3 100 %, M2 10/10 (ruler 27dd969127).** R27 done (168a974f29).
Next: HOST-AUDIT page READY docs/reviews/host-audit-inventory.md (6ec361162e: 114 groups, 95 keep / 18 fold / 1 retire;
Jake approves each), legacy deletion (G606).

**(3) Frame floor.** Desktop: 7 shards 60 fps standing; drives Pine/Nalati p95 16.8 ms (c0436e94ba).
Quiet iOS Sim p95 (889 → d587cf1c08): Pine drive 71 → 48, interior 60 → 35 PASS; Nalati drive 53 → 53, interior
59 → 48 (FAIL, bar 33). Cuts: shader-build churn (variants 566 → 20 MiB), variant token keys (select 241 → 2), page
light budget 79fd45d18c, herd/Valibot/hash allocation. Fresh edd48d2f4c drive profile split: Wasm Memory creation
(sp-x6), JSON number regex (sp-x9), node snapshots (sp-x8), render (sp-o3). All-shard desktop floor queued (sp-x1).

**Memory:** WebKit Sim floors menu ~166, T1 ~310-330 MiB vs M1's 50/100 (FAIL). Same source drifts ~10 MiB between
cohorts; churn cuts don't move floors (they cut GC, not WebKit's dirty pages). M1's 50 MiB menu is below WebKit's own floor (framework 57 MiB): recommend re-basing
M1 on menu → T1 growth. Lanes are off memory floors; render targets (49 MiB) parked.

**Tooling:** gen warm 53-67 s → 2.7 s; B5 done; G6 cache isolation (sp-x2). DW tiles: wire 12.3 → 10.8 MB look-identical;
pick for Jake: art/driftwood-isle/round-19-tile-lod (3af5687a53) A landed / B / C; only C gets 6,4 + 2,5 under 4 MB.

**For wildshard-v:** Night Market road view A done (art/grid/round-60-night-market-road-a), still a wall: Jake may pick B
(see-through barrier) or C (raised road view). OPEN: (1) L10 cold-wire ceiling, ratchet from 15.1 MB (recommended);
(2) PMREM phone 64 landed fcc872ee4b, no visible change; (3) M1 re-base (above).

**Lanes:** Claude weekly 85 %: 1 Opus (sp-o3); 5 Codex + sp-x7.

**Rules:** G605. Fix forward, NO reverts (G674). No new Debug rows (G669). G670. No one-user credit without a case
pick (G571/G667/G677); never herdr wildshard-v.
