# SHARD-PLATFORM lanes (G335 + G337: 4 building Codex panes + 1 push/deploy Codex pane + 5 Opus as the coordinator's own subagents; coordinator wildshard-new)

## G345 SPRINT (Jake, 2026-10-12 21:30Z → 09:30Z, `34527bde0`): Signal Dunes + Sky Reach to 80/20

"rip into mega build and no process porn". Quick checks of what a change touched + the push gate only; NO frame floor,
Simulator, soak or boards (one board only for a taste call); no .git/quiet windows. SF22 / frame floor / SF57 / SF67
timing proofs are paused. Progress: custom % per shard in STATE.md every ~2 h.

| Lane | Sprint row |
|---|---|
| sp-x7 | Push queue first (96 waiting, origin stale), then CI / deploys green. |
| sp-x4 | Land the held G342 format slice, then **Sky movers MV-2** (SF83) for the Sky port. |
| sp-x5 | **Lash + war-fan weapon families WP-5** (SF85) for Signal / Sky; BR-4 Qara parked. |
| sp-x6 | Land the Pine layout move (map from sp-o10), then **directors DIR-5** (`signalPlan` etc., SF81). |
| sp-x1 | **Headless proofs + the metric** for Signal / Sky (`scripts/shard-platform.mjs`, witnesses the ports need). |
| Opus × 2 | **Signal port** (generators in real three.js + shared rows). |
| Opus × 2 | **Sky port** (sp-o12 = Sky A). |
| Opus × 1 | **Looks, start to end:** G342 near tier (on sp-x4's selection `18fad8ea2` + format slice), then G343 / G344 hero round 4 (above Driftwood / Nalati / Pine, 1x lens, square + landscape), shipped via G341. |

The rows below are the pre-sprint lanes (history).

Read `common.md` first. Order (Jake via the plan desk, 2026-10-12): graphical rows first on the Opus lanes (G321, G322, the hero, DS1.4, parity); Codex lanes saturated on SF79–SF85 engineering with green (G330) as one of them. One row per lane; the coordinator rewrites a row when a lane finishes it. Herdr tab `wT`.

| Lane | Kind | Pane | Row |
|---|---|---|---|
| sp-x7 | Codex | wT:pE | **Push + deploy only (G330; Jake 2026-10-12, `248f50470`: "the 5th codex lane only responsible for pushing, making sure the website deploy succeeds etc").** Owns the push queue, GitHub CI, the hourly game release and the Vercel deploys (game, wildshard-admin, wildshard.io); fixes or reverts whatever turns them red, and reports each red to wildshard-new for `red-green.md`. Takes no build rows (no tree hygiene, no SF60, no feature work). |
| sp-x1 | Codex | wT:p3 | **Desktop frame floor:** Pine short travel p95 33.4 → ≤ 17.5 ms (main-thread / CPU side; rendering causes go to sp-o2). Then SF67 responsive loads (remaining > 100 ms work, cold-arrival waits, home exit / return, per-phase remeasure). |
| sp-x4 | Codex | wT:p4 | **G342 near-placeholder tier, the engineering** (Jake, `b59d2a6ab`; plan row G342): the cells around the player's crossroads (or adjacent to the player's cell) get a near placeholder; cells beyond keep the far proxy (`src/game/grid/farProxy.ts`, SF23). Build the tier: terrain at L1 density from each shard's baked terrain, plus a slot for each shard's landmark / canopy / water low-LOD content emitted by its own generators (G320) into its shardfile; its own residency line inside the 1.0 GB Explorer envelope; streaming in / out as the player's crossroads changes; behind ONE Debug row (default off, A far proxy / B near placeholder). The per-shard look content (Driftwood pier / huts / palms, Pine cabins + forest, Nalati yurts + herds, Signal dunes, Sky isles) is an Opus subagent's; deliver the tier with terrain first. Frame floor must hold. Then: the assembled SF22 timing slot (still queued after sp-x5). SP3 continues after. |
| sp-x5 | Codex | wT:p5 | **SF57:** Pine re-admission refused ("[cabins] not built"), residency, road growth, unlabelled GL; the current-catalogue memory qualification. Then SF82 BR-1, BR-2, BR-4, BR-5. |
| sp-x6 | Codex | wT:p6 | **SF87 / G320 CPU tail:** physics bakes and the Driftwood / Pine spots off trusted constructors; Driftwood navmesh from a cold author source. Geometry / rig / pixel producers are sp-o3's. Then SF29 native audio routing. |
| sp-o1 | Opus subagent | — | **Done** (`855a6b714`, `051d2fd3d`, `ad9671a1e`, `ed74128ef`): hero round 3 (recommend L-b), G338 Debug row, raw layout screens. Left: Jake's A / B pick, then L-b + the winner land together and the row goes. |
| sp-o2 | Opus subagent | — | **G321 own skies**: every shard declares its sky / light / grade in its cell, 16 m blend band, default on, Debug row `s_grid_sky_environment` deleted; frame floor holds; board `progress/shard-platform/sky47/`. |
| sp-o3 | Opus subagent | — | **Done** (`cb32a58e2`, `6d20db071`, `c661d98f2`, `53e508139`, `bec345453`): attribution tooling and write-up `progress/frame-floor/sp-o3-attribution-2026-10-12/`; Sunscar interior 34. Fixes passed to sp-o6. |
| sp-o6 | Opus subagent | — | **Render stalls:** Pine world-hook program recompiles (warm the variant / fixed light slots), program settles, desktop bufferData pacing, the 1024² afterKit ImageBitmap; then the other Simulator routes. |
| sp-o7 | Opus subagent | — | **M3 port, Signal** (SF50-p) toward ≤ 20 %: row files to `data/`, world / props to generator GLBs, shared Signal + Sky systems as 2-user plugin modules. |
| sp-o4 | Opus subagent | — | **DS1.4 materials and lights**: `sdk/materials` ToonMaterial + TSL graph, point / spot light rows; ink-cel-valley and pastel-plain at parity (`progress/shard-platform/ds14/`). |
| sp-o5 | Opus subagent | — | **Pine official map capture for sp-x5's SF57 fix**, then the **look-parity sweep** across the cells on HEAD (`progress/shard-platform/look48/`). |
