# SHARD-PLATFORM lanes (G335 + G337: 5 Codex herdr panes + 5 Opus as the coordinator's own subagents; coordinator wildshard-new)

Read `common.md` first. Order (Jake via the plan desk, 2026-10-12): graphical rows first on the Opus lanes (G321, G322, the hero, DS1.4, parity); Codex lanes saturated on SF79–SF85 engineering with green (G330) as one of them. One row per lane; the coordinator rewrites a row when a lane finishes it. Herdr tab `wT`.

| Lane | Kind | Pane | Row |
|---|---|---|---|
| sp-x7 | Codex | wT:pE | **Green (G330) + tree hygiene (G331).** Push queue, GitHub CI and the hourly deploy green; every red goes to wildshard-new as red / culprit / fix for `red-green.md`. After the 10-12 reboot, first check the auto-pusher, the launchd deploy backstop and any push left half-done. Every ~30 min: `git status`; orphaned work gets committed by its owner (ask them over herdr) or, if ownerless and clearly finished, in small commits; junk goes to `.gitignore`. Between reds: SF74 tails, SF60. |
| sp-x1 | Codex | wT:p3 | **Desktop frame floor:** Pine short travel p95 33.4 → ≤ 17.5 ms (main-thread / CPU side; rendering causes go to sp-o2). Then SF67 responsive loads (remaining > 100 ms work, cold-arrival waits, home exit / return, per-phase remeasure). |
| sp-x4 | Codex | wT:p4 | **SF22 Safari cadence:** p95 49 from main-thread waits (165 ms gaps with 5 ms frame work); Nine cell entry 191 ms on the Simulator; then the assembled-route requalification for the M2 gate. |
| sp-x5 | Codex | wT:p5 | **SF57:** Pine re-admission refused ("[cabins] not built"), residency, road growth, unlabelled GL; the current-catalogue memory qualification. Then SF82 BR-1, BR-2, BR-4, BR-5. |
| sp-x6 | Codex | wT:p6 | **SF87 / G320 CPU tail:** physics bakes and the Driftwood / Pine spots off trusted constructors; Driftwood navmesh from a cold author source. Geometry / rig / pixel producers are sp-o3's. Then SF29 native audio routing. |
| sp-o1 | Opus subagent | — | **G332/G336 main-menu hero round 3 (desktop landscape)**: captures of `landscapeHeroPlan()` (`884b0ee6f`) at 2560×1440 and 1920×1080, labelled JPEGs + board in `art/main-menu-hero/round-3-landscape/`. |
| sp-o2 | Opus subagent | — | **G321 own skies**: every shard declares its sky / light / grade in its cell, 16 m blend band, default on, Debug row `s_grid_sky_environment` deleted; frame floor holds; board `progress/shard-platform/sky47/`. |
| sp-o3 | Opus subagent | — | **Simulator frame floor** (travel-window misses: Driftwood 59, Pine 58, Signal 52, Sky 37, Nalati 36; Sunscar interior 46): busy-vs-idle discriminator, then GPU/upload/compile fixes; CPU stacks go to sp-x4 / sp-x1. |
| sp-o4 | Opus subagent | — | **DS1.4 materials and lights**: `sdk/materials` ToonMaterial + TSL graph, point / spot light rows; ink-cel-valley and pastel-plain at parity (`progress/shard-platform/ds14/`). |
| sp-o5 | Opus subagent | — | **Pine official map capture for sp-x5's SF57 fix**, then the **look-parity sweep** across the cells on HEAD (`progress/shard-platform/look48/`). |
