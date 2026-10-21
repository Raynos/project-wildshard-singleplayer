# Loading and download screen: mini plan (G543)

Jake, 2026-10-20 (G537, G543): *"if it says 12, but it downs 145, it has to be fixed. You have to fix all download counter
stuff. You have to fix the loading stuff. And then you have to optimize it. First let's have the loading be accurate. And
then let's optimize it later … one of the lanes that the builder has can be spent on this whole mini plan, just
continuously working on the loading screen until it's fixed."*

Audit: [Loading Screen Audit](https://claude.ai/artifact/5muMsLzQ8dBoAiuJs2oYoH) (live 97915af6c). One builder lane owns
this plan end to end and stays on it until every row is done; it is an M2 gate (G537): no 5 x 5 mobile runs until
Phase 1 is accepted.

**Owner:** dedicated loading lane (`sp-x1`), 2026-10-20. L1 source landing first; each row stays open until its exact-build proof passes. STATE.md remains coordinator-owned.

## Phase 1: accurate (nothing hidden, every number true)

| Row | What | Code (from the audit) | Effort (est.) |
|---|---|---|---|
| **L1 — source `0e5a42feb3`; Chromium first-frame proof green at `e1799246dd`; final gate pending** | Step number and name always match; time between steps becomes an explicit row ("gap after X · 75.7 s") so no second is unaccounted | `Loading.ts:174`, `:206`; `boot/plan.ts:232`, `:274` | 0.5 day |
| **L2 — source `56b1bdf71`; Chromium byte parity green (1.46% / 4.07%); Simulator pending** | **The download counter counts every byte**: shardfile file reads, grid neighbour products, everything fetched; cache hits shown separately ("from cache"); totals from each product index's sizes; never 100 % while files remain | `boot/steps.ts`, `session/data.ts:41`, `shardfile/product.ts`, `grid/products.ts` | 1 day |
| **L3 — source `583123db2a`; proof pending** | A `waitFor(label, promise)` registry at admission, file reads, Wasm, workers and shader linking; a live "Now waiting for: …" line with its age and files in flight | new in `engine/boot`; call sites per the audit | 0.5–1 day |
| **L4 — source `c54a3c5c54`; proof pending** | A step table per load path (grid, shardfile, legacy) replacing the fixed 16-row legacy table; page-shell rows dropped; every unreported await moved into a step | `session/loadout.ts:63-134`, `session/play.ts:99-121`, `session/finish.ts:26-55`, `grid/liveSession.ts:533-556` | 1–2 days |
| **L5 — source `7d02e8806a`; cadence proof pending** | Numbers inside every long step that move at least once a second: admission files N/M, world scenes N/M, home region scenes/models N/M, shaders built/linked N/M, textures N/M, first frame pass N/5 | `shardfile/product.ts:240`, `grid/products.ts:52`, `game/shardfile/worldScenes.ts`, `driftwood-isle/world/build.ts:85`, shader precompile | 1 day |
| **L6 — source `977a0d1303`; proof pending** | Stall text in amber after 10 s with no progress, naming the open wait; "Last reload" and "Longest page pause" removed or relabelled; Physics/Trees rows report the real region, not the empty shell | `Loading.ts:211-244`, `boot/lastEnd.ts`, `engine/core/bootstrap.ts:95`, `:106`, `play.ts:168` | 0.5 day |
| **L7 — framework `04027abce7`; Simulator calibration pending** | A realistic bar: per-path stage weights from a committed table measured on the iOS Simulator at phone tier, blended with the device's own runs (keyed by tier, path, shard); a running step without counts eases toward its share (1 − e^(−t/T)); no 99.5 % freeze; admission weighted by time | `boot/timing.ts:17-21`, `boot/plan.ts:216`, `Loading.ts:115-185` | 1 day + a Simulator session |
| **L8 — acceptance harness ready; exact-build receipts pending** | Acceptance: on both SHARD SELECT and the grid path, stage rows add up to the wall time within 3 s; the detailed text changes at least once a second; the byte counter matches network bytes within 5 %; measured in the Simulator and Chromium; a test fails if any unlabelled gap exceeds 2 s | test + a capture for Jake | 0.5 day |

## Phase 2: fast (after Phase 1 is accepted)

| Row | What | Code | Effort (est.) |
|---|---|---|---|
| **O1 — done `02fb4e4288`, `8f220455e8`, `94bf308bc1`** | Grid edges read from each neighbour's product index only, not the whole product (today 3,237 requests, 137.5 MB, 75.7 s) | `grid/edgeSources.ts:73-86`, `grid/products.ts:42-60`, `grid/session.ts:305-322` | 0.5 day |
| **O2** | Content cache: the worker stops giving up at 64 pending; batched index writes; running byte and entry totals instead of rescans and sorts per write | `boot/contentCacheWorker.ts:109`, `boot/contentCache.ts:100-178` | 1 day |
| **O3** | Home region reads files in parallel / prefetched from the product's file list (today one request in flight for 25 s) | `game/shardfile/worldScenes.ts` (~lines 88, 118, 146, 170, 178, 244), `grid/liveSession.ts:533-556` | 1 day |
| **O4** | Shardfile admission without waves of 4 that wait for the slowest file | `shardfile/product.ts:259` | 0.5 day |
| **O5** | Shader cost on shardfile/grid (~10 s main-thread vs ~1 s legacy): source-mapped profile, then fix (likely the node-material graph builder) | profile first | investigate |
| **O6** | Close the shardfile-vs-legacy gap for Driftwood (3.6x slower, 3x the bytes) | after O1–O5 | investigate |

Target after Phase 2: the grid Driftwood load at or under about 20 s at 4x CPU in Chromium, measured again in the Simulator.

The L1 receipt at `0e5a42feb3` stalled in Props for 240 s (no first frame).
Rows account for 238.1 / 239.9 s. It did not recur at `e1799246dd`:
SHARD SELECT first frame 33.5 s and grid 32.8 s. Stage sums are 33.769 /
32.824 s; observed HTTP byte errors 1.46% / 4.07%. Cadence remains open
(1.69 / 1.24 s), with shader/first-frame and assembly gaps retained in
`tmp/loading-lane/current-chromium/` until final evidence is committed.
