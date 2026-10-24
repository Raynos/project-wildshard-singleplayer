# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE a4cb1fc8f2 (18:40Z; after the TB1 hold; 9625ae97ec 16:58Z), each after full CI + all six exact smoke
legs; ff45 pin removed (692f9bd22e), hourly newest-CI-green deploys running (sp-x7). Six smoke reds + boot race fixed on the way.

**(2) NALATI 0: every shard at zero, C1-C9 closed, M3 100 %, M2 10/10 (ruler 27dd969127).** R27 done (168a974f29).
HOST-AUDIT: 114 recommendations accepted as its starting
point (G679, 3cb15f3b32, review archived); the plan is parked until every mini plan finishes. Legacy deletion (G606).

**(3) Frame floor.** Desktop (466c98bac7): ALL 24 shipped shards PASS standing (59.9 fps, max 16.8 ms); grid drives
p95 16.8, max Pine 1,117 → 66.7, Nalati 167 → 50.1 ms (f7e74f576e).
iOS Sim: road spike 448 → 67 ms (Wasm pool, DB1). Settled spikes were FULL GCs every 0.6 s because JSC's heap
(incl. external memory) was large vs RAM (Mac WebKit forced to 3 GiB reproduced it). RETAINED memory was the lever: snapshot 601 -> 457 MiB on 6f0c0dbd15 (closed shard scopes 121 -> 0: observedIn, Pine
residency, scope/audio/material keepers, raw+splat textures). Quiet Sim settled on f527: 36 FULL -> 1 full + 17 partial
GCs, p95 48 -> 34. OFFICIAL quiet Sim floor (bar p95 <= 35, max <= 200, median 30): a3fe576d34 13/15 PASS (b68f 12, 34aa 12/11, 9625 13; after TB1: 436f 11, a4cb 11, Nalati whole 45/199),
every median 30.3; short-travel rows swing 35-43 run to run; TB1 crossing red fixed 3974a26c13; releases pinned 9625 until CI green.
Desktop floor PASS: d6c530539b all 9 rows; interior-stop owner 4.0 ms on c2db00b25e (limit 4.17); frames 16.7 p95.

**Memory:** WebKit Sim floors menu ~166, T1 ~310-330 MiB vs M1's 50/100 (FAIL). Same source drifts ~10 MiB between
cohorts; churn cuts don't move floors (they cut GC, not WebKit's dirty pages). M1's 50 MiB menu is below WebKit's own floor (framework 57 MiB): recommend re-basing
M1 on menu → T1 growth. Lanes are off memory floors; render targets (49 MiB) parked.

**Tooling:** DW tiles: wire 12.3 → 10.8 MB look-identical;
pick for Jake: art/driftwood-isle/round-19-tile-lod (3af5687a53) A landed / B / C; only C gets 6,4 + 2,5 under 4 MB.

**For wildshard-v:** G679 -> sp-x6, G680 done 678e13894d + be5de70171, G681 needs Opus (softWallLook.ts, not data; Tue), G682 -> sp-x1; rows in lanes/ready-queue.md
(e542ed6c63, SW10). TS6307 was fixed 576b27c9df (17:06Z); TB1 hold lifted 3bea488858. PLEASE stop your grep PID 45432 (35+ min, ~65 % CPU over session
jsonl files): it overlapped sp-x1's quiet e664 floor (4/15) and its repeat; nobody else may kill it. DR19 and L10 code were already landed.

**Lanes:** Claude weekly 90 %: 0 Opus (sp-o3 stopped, G605); 5 Codex + sp-x7.

**Rules:** G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
