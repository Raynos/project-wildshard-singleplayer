# SF61 Debug-row inventory (2026-10-13, sp-o94)

Scanner: `lint/debug-flags.mjs` over `src/` (engine registry `DEBUG_ROWS`, shard `ctx.debugRow`, `runtimeVariantEnabled`,
`directorVariant`, global actions). The 10-07 purge history (34 → 9 + 9) is in
`progress/shard-platform/sf61-debug-inventory.md`. Comparison rows count against `lint/ratchet.json` `debugRows.max`;
Developer tools (`purpose: 'developer'`) do not. Frozen `*-legacy` copies are counted but never edited.

**Before this pass: 6 comparisons (max 7) + 12 Developer tools.** Dispositions below; the result is at the end.

## Comparison rows

| Row | Source | Gates | Ask / G-row | Jake picked? | Disposition |
|---|---|---|---|---|---|
| `graphMaterials` | engine `debugOptions.ts` | SF59 graph materials via lazy TSL vs family presets | E435, SF59 | **pending** (physical-iPhone reading) | keep |
| `nearTier` (Neighbour detail) | engine `debugOptions.ts` | A far proxy / B near placeholder / C every cell near (captures) | E435, G342, G380 | **pending** A/B; C is capture-only (G380, G383) | keep |
| `tex` | engine `debugOptions.ts` | GPU textures auto / KTX2 / images | E157, G188 | yes: auto (E157 B, phone KTX2 first G188) | keep: scripts seed `tex` as a harness setting (bake-coats, gpu-texmem, load-mem-probe, test-nine-gpu-boot); the row goes when those move to a harness input |
| `gridDevserverCell` | `src/game/grid/debug.ts` | DEVSERVER build: Nine Dragon cell at (+1, −1) vs the template | E435, SF21a / G46 | no pick; DEVSERVER-only config, never in the public build | **delete** (E451: a row with no pending pick is debt); DEVSERVER keeps the cell |
| `pineMemoryTrim` | `src/shards/pine-hollow/debug/options.ts` | Pine memory cuts (RGB9_E5 sky, B1/B2/B4/B5, view distance B) | E435, SF47-g, G180, G187 | yes: on in the grid (G180 / G187) | **delete** the row; the shipped policy stays (grid on, standalone off) |
| `pineMemoryTrim` | `src/shards/pine-hollow-legacy/debug/options.ts` | same, frozen copy | E435 | yes | frozen: retires with the legacy folder |

## Developer tools (Settings ▸ Developer card)

| Row | Source | Gates | Ask / G-row | Disposition |
|---|---|---|---|---|
| `time` | engine `debugOptions.ts` | held time of day | E55 | keep (G221) |
| `weather` | engine `debugOptions.ts` | held weather | E357 | keep (G221) |
| `ai.brains` | `src/engine/ai/view/DebugOverlay.ts` | AI overlay | E357 | keep (G221) |
| `storage` | engine `debugOptions.ts` | storage readout | E357 | keep (G221) |
| `clearDownloads` | engine `debugOptions.ts` | two-tap cache wipe | E172 | keep (G221) |
| `budgetReadout` | engine `debugOptions.ts` | tier / budget readout | E357 | keep (G221) |
| `game.template` | `src/game/shard/templateDebug.ts` | Enter Template | E357 | keep (G221) |
| `fps` | engine `debugOptions.ts` | desktop frame cap | E193 | keep (G221) |
| `shardDirectors` | `src/game/shardfile/directorClient.ts` | director scripts vs legacy | E435, SF24 / SF81 | keep: G221 holds it until director parity closes (SF81 open) |
| `buildPacing` | engine `debugOptions.ts` | frame-paced build slices / batched uploads | E435, SF63 op-hitch | keep: added after G221; frame-floor scripts drive it, perf proof open |
| `memorySaver` | engine `debugOptions.ts` | SF22d engine memory cuts | E435, G114 ("ship default-off") | keep: frame-floor and soak scripts read it; retiring the on path is a feature deletion for the coordinator |
| `groundTiles` | `src/shards/sunscar-dunes-legacy/look/groundTiles.ts` | Signal ground tiles vs code-built | E435 | frozen legacy copy |

All G221 deletions (aim ring, balbal / ghost forcing, Crag channels, calibrate, load profiling, boot packs,
starter-effects forcing, Pine wildlife off, clock speed, SFX audition) already landed on 2026-10-07.

## Result

**After this pass: 4 comparisons (`debugRows.max` 4) + 12 Developer tools.**

| Commit | Change |
|---|---|
| `8ebbf72ba` | `pineMemoryTrim` row deleted; the trim stays on in the grid, off standalone |
| `ba40278b3` | `debugRows.max` 7 → 5 (a policy-only commit: commit-time debt producers refuse policy in the same commit) |
| `af889bfea` | `gridDevserverCell` row, its global-row helper and strings deleted; a DEVSERVER build always places its cell |
| this commit | `debugRows.max` 5 → 4 |

Left: `graphMaterials` and `nearTier` (pending Jake), `tex` (harness setting), the frozen legacy `pineMemoryTrim`.
