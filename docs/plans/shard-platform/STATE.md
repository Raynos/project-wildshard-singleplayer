# SHARD-PLATFORM — State (wildshard-new; ≤ 3 KB)

**Order (G639):** (1) live reds → (2) NALATI TO ZERO → (3) grid / frame floor. Extras: loading, core memory, TOOLING-PERF,
Night Market, tile streaming, no-binaries.

**(1) LIVE 0b1ca136e9 (01:31Z 10-25; da94 G694 wave 1, LEGACY fixes, L9), each after full CI + all six exact smoke
legs; hourly newest-CI-green deploys (sp-x7, G705).

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

**For wildshard-v (G711):** effort-% follows once lanes split their L/XL rows into <= 1 h slices (first commit of each row).
Rows: GR3 9 jobs (c33e3cea3c), GR4 19 (fire-book 6679231bf6), T3 293 / 1,039, T4 format 5.5 MB (< 2), T1 plain run
on ccc4402e4e closes on a settled sample (G710). Road B 58e8609229 (eb489a1734; white panel + cyan arch being checked).
G708-G711 applied: lane plans in ready-queue.md, common.md rewritten. **Blocked on Jake:** LEGACY phone QA, memory
budget call, road B pilot play, DW tile-LOD pick. **On Opus:** G681/G685 look rows, U2 occupied parents, T3/T6 visual.

**Lanes:** Claude weekly 96 %: 0 Opus (sp-o3 stopped, G605); 5 Codex + sp-x7.

**Rules:** G704 (<= ~20 files/move commit, one big move: T3; a job's generated-output deletion = one unit). G605. Fix forward, no reverts (G674). No new Debug rows (G669). G670. Never herdr wildshard-v.
