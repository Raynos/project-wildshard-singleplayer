# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE e6627ba522 (20:51Z, first with the T9 lattice; f42d192560 19:36Z), each after full CI + all six exact smoke
legs; ff45 pin removed (692f9bd22e), hourly newest-CI-green deploys running (sp-x7). Six smoke reds + boot race fixed on the way.

**(2) NALATI 0: every shard at zero, C1-C9 closed, M3 100 %, M2 10/10 (ruler 27dd969127).** R27 done (168a974f29).
HOST-AUDIT: 114 recommendations accepted as its starting
point (G679, 3cb15f3b32, review archived); the plan is parked until every mini plan finishes. Legacy deletion (G606).

**(3) Frame floor.** Desktop (466c98bac7): ALL 24 shipped shards PASS standing (59.9 fps, max 16.8 ms); grid drives
p95 16.8, max Pine 1,117 → 66.7, Nalati 167 → 50.1 ms (f7e74f576e).
iOS Sim: road spike 448 → 67 ms (Wasm pool, DB1). Settled spikes were FULL GCs every 0.6 s because JSC's heap
(incl. external memory) was large vs RAM (Mac WebKit forced to 3 GiB reproduced it). RETAINED memory was the lever: snapshot 601 -> 457 MiB on 6f0c0dbd15 (closed shard scopes 121 -> 0: observedIn, Pine
residency, scope/audio/material keepers, raw+splat textures). Quiet Sim settled on f527: 36 FULL -> 1 full + 17 partial
GCs, p95 48 -> 34. OFFICIAL quiet Sim floor: Jake ACCEPTED it at 13/15 (G687, a3fe576d34 / 9625ae97ec); frame-floor lanes moved to extras (G683).
Desktop floor PASS: d6c530539b all 9 rows; interior-stop owner 4.0 ms on c2db00b25e (limit 4.17); frames 16.7 p95.

**Memory (G682 budgets: menu <= 148.5, Template <= 198.5 MiB):** f4465ac4ab menu 165 (+16), select 169 (+21), Template 317
(+119), Template2 305 (+106). Template: JS 108, page 114, GPU render targets 40.4 (look call, parked), textures 52. Heap census (71b4a96c17): no leak, JS gap is code/JIT/page,
not retained data; cuts left are < 1 MiB each, so the budgets need a structural call (less code at boot, post-chain RTs) from Jake.

**Tooling:** DW tiles: wire 12.3 → 10.8 MB look-identical;
pick for Jake: art/driftwood-isle/round-19-tile-lod (3af5687a53) A landed / B / C; only C gets 6,4 + 2,5 under 4 MB.

**For wildshard-v:** G694 wave 1: F1-F5, D2, D4-D6, D1 source (17dddf9b3e, 12 modern boot cases PASS), D3 first slice 7c73ab50dd.
LEGACY smoke found two PRE-EXISTING breaks from 7719bbb5c4 (10-18, painterly adapter): Nalati bow shade 2.4 (fixed 205c46fdd7) and
uPSunDir (fixing, sp-x6); live LEGACY Nalati has been broken since 10-18. T1: ghosts fixed (7941053755); per-return growth owners:
composer depth +4.4 MB, DW site geometry, LUTs (sp-x9 / sp-x8). Your grep PID 45432 still ~99 % CPU.

**Lanes:** Claude weekly 90 %: 0 Opus (sp-o3 stopped, G605); 5 Codex + sp-x7.

**Rules:** G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
