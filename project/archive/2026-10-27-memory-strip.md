# Memory strip spike audit (read at HEAD 9d5ea7c139, 2026-10-22)

Jake's phone ran live ab93dccfe (17:49). 2227e069ec (18:37, "align shard diagnostics") landed after it and already fixes
two of the symptoms (see §1). Nothing below was built or run; it is a code read.

## 1. Every number, where it comes from

Code: `src/game/grid/budgetOverlay.ts` (strip), `src/game/grid/budgetPoints.ts` (scoring), `src/game/grid/allocator.ts`
(the residency allocator), `src/format/contentCost.ts` (cost model), `src/game/grid/memoryWarning.ts` (banner),
`src/format/product.ts` `MemoryAdmission`, `src/format/assetAdmission.ts` (estimates). Wiring: `src/game/session/play.ts:505-522`.

None of these numbers is measured on the phone. All come from the allocator's ledger of *claims* (bytes each piece
declares: tiles, far proxies, near placeholders, libraries, sims/worlds, commons, page components), through one formula:

    playing = engineBase (300 MB minus calibrated credits) + page components + ceil(1.11 × other claimed bytes) + 80 MB overlap

| Shown | What it is | Unit / denominator |
|---|---|---|
| `ALL LOADED 1404 MB` | `allocator.cost().playing`: the formula over every claim on the page | decimal MB, no denominator (G556) |
| `DRIFTWOOD ISLE 269% OF BUDGET` (live) | `points(ownerAccounted, SHARD_BUDGET)`: Driftwood's raw claimed bytes (≈ 289 MB) over **SHARD_BUDGET = 107.6 MB** (SF22a's "one quarter of a 4-shard crossroads": library 25 + sim 25 + far 1.6 + 10 L0 × 4 + 8 L1 × 2). A design-era category budget no real shard world fits in | % of 107.6 MB |
| `737 / 1200 MB` | `shardLimit()`: the formula run as if Driftwood were alone: engine base + **all** page components + 1.11 × 289 + 80 ≈ 336 + 321 + 80 | MB of the 1.2 GB per-shard limit (= 61 %) |
| `NINE DRAGON STACK 331% · 945 / 1200` | same two rulers: ≈ 356 MB raw / 107.6; 945 includes ≈ 470 MB of base + page (grew since the first screenshot: `page:kept-programs` is claimed at the first retirement, liveSession.ts:563) | |
| `24 SHARDS OK` | count of **grid cells** (owners = cell instances) scoring green; on the 5×5 that is the other 24 cells, each holding only a few MB of far proxy / near placeholder / edge claims. Not shards, not worlds | count |
| `SHARED 632.9 MB` | raw claimed bytes of non-cell owners (`platform`: road tiles, commons, map images, page components, continuation cache), **not** ×1.11, so not in the same unit as the line above | raw MB |
| Red border, pink `MEMORY` badge | static CSS (`budgetOverlay.css`), always on: not a danger signal | |
| Banner `MEMORY LIMIT · nine-dragon-stack ESTIMATE · +390.9 MB` | a `declared` / `actual` report from `assetAdmission.preflightDeclaredCosts` → `worstContentCost`: Nine's shardfile at its **worst location if loaded alone** ≈ 1.59 GB > 1.2 GB. Recorded when the grid admitted Nine's product (neighbour far/near/build-ahead), kept in `MemoryAdmission`, and shown on any page (live) | static content estimate, unrelated to current memory |

Why 269 % disagrees with 737 / 1200: two rulers, two numerators. 269 % = raw own bytes / 107.6 MB category budget;
737 = base + shared + 1.11 × own, over 1200. At HEAD (2227e069ec) the chip shows `61% OF LIMIT · 737 / 1200`, and the
banner shows a cold estimate only for the entered shard, so Driftwood no longer names Nine; inside Nine it still shows
the static +382 MB worst-spot estimate.

Further problems the code shows:
- Per-shard numbers can't be summed: each repeats the 300 MB base, every page component and the overlap.
- The model is low against measurements: G607's Chromium read renderer 1.8–2.0 GB and G615 2,151 MB at SQ-NE-b, while
  the strip said 1404–1489.
- The one real on-phone measurement exists but is buried: Developer installs the GL allocation journal
  (`render/diagnosticJournal.ts` → `allocationJournal.ts`, wrapping tex/buffer/renderbuffer storage and deletes), plus
  observed wasm, ArrayBuffer, decoded image and audio rows (`memoryAttribution`). They appear only in the expanded
  "GPU / RAM · OBSERVED STORAGE" section; the `measured` native reading only exists under a Simulator harness.

## 2. What is resident on a crossing, and what the strip misses

Resident on Infinite Wildshard (HEAD): the home/active shard world (`sim:<cell>` claim at its measured product bytes);
up to **4 live worlds** (`live.ts:194` `maxResidents ?? 4`; G590 default "owned worlds overlap"): the source kept for
a 5 s cold dwell after leaving, the warm build-ahead neighbour (`warmAhead`, kept whole while it borders the source),
and any world still inside its readiness radius; the highway world; far proxies and near placeholders for **all 24 other
cells**, drawn to a 6 km far plane with no fade (G607); road tiles, commons, map images; kept and loading shader
programs (page claims, conservative estimates); the continuation cache. The allocator claims each of these, so the
strip counts them **at their declared sizes**.

What it misses, which is what kills the tab:
- **Leaks after retirement.** Retiring a world releases its claim, so the strip drops even if the memory stays. O18
  (STOPPED under G561) measured exactly this: empty-grid footprint ~590 → ~1000 MB across a tour, ~120 MB of ArrayBuffer
  plus ~50 MB of JS heap per Driftwood↔Nalati round trip, 225 closed region scopes and ~2.8k disposed materials still
  reachable through three's program cache. Driftwood → Sky → Driftwood is two builds plus two retirements.
- **Build transients.** World-build peaks (O18: Pine's grid entry 1.49 GB interval high for ~6 s) against a fixed
  80 MB "overlap".
- **JS heap, driver and compositor memory.** Safari exposes none of them.
- **Real vs declared GPU bytes** for render-everything far content.

What would predict an iPhone tab kill:
- The 17 Pro's jetsam log reads ActiveHard **2,048 MiB ≈ 2.15 GB** for WebContent
  (`docs/design/engine-fit-v2/budget-design.md`). WebKit quotes ~1.5 GB as typical, and typed arrays plus wasm share a
  2 GB Gigacage.
- Usable proxies on the phone:
  - (a) GL journal bytes, which are real GPU storage, leaked GL objects included.
  - (b) Observed RAM: wasm capacity, labelled ArrayBuffers, decoded images, audio.
  - (c) The claim model.
  - (d) **Ghost worlds**: retired regions not yet garbage-collected, counted with a FinalizationRegistry on each
    retired region root. Safari supports it, it is cheap, and it is the direct leak signal.
  - (e) **Trend**: the headline at first controls, then after each crossing. Growth that never returns after
    retirements means the next crossing dies.
- The best single predictor: `max(model, journal GPU + observed RAM + engine base)` plus the ghost count and the
  trend.

## 3. Redesign: one honest readout

Collapsed: one line. Its colour is the danger band (green / amber / red, against a ~2.0 GB crash line). There is no
permanent red chrome.

    MEM ≈1.46 GB ███████░░░ /2.0 · 3 worlds · +440 since start ▾        (amber)

Expanded on tap:

    MEMORY ≈ 1.46 GB of ~2.0 GB crash line (estimate)            amber
    ─ worlds (own bytes, these add up) ──────────────────────────
     Driftwood Isle   active      410 MB
     Sky Reach        warm ahead  380 MB
     Pine Hollow      leaving 3s  220 MB
    ─ shared ───────────────────────────────────────────────────
     engine base 300 · shader programs 96 · road+commons 140
     far + near, 24 cells  85
    ─ seen on this phone (measured) ─────────────────────────────
     GPU storage 690 MB · wasm 64 · images 120
     ghost worlds 2 (retired, not freed: leak)                   red
     start 1.02 → 1.21 → 1.33 → 1.46 GB (3 crossings)
    ─ shard limits (each alone, 1.2 GB) ────────────────────────
     Driftwood 61% · Sky 54% · Pine 48%     [details ▸ allocations]

Delete:
- The `% OF BUDGET` category score and SHARD_BUDGET from the strip (tile and category budgets stay in author tooling).
- `N SHARDS OK`.
- `SHARED` in raw units.
- The always-red border and pink badge.
- The `MEMORY LIMIT … ESTIMATE` banner on the grid. A shard's static worst-spot estimate belongs in its performance
  report; only a resident over-limit stays, as a red line inside the strip.
- The "no owner %" gauge and the worst-tiles list. They move behind "details", or are deleted if unused.

## 4. Rows (disjoint files, sized)

| Row | What | Files | Size | Done when |
|---|---|---|---|---|
| M1 | Headline: page estimate vs crash line, colour bands, one line | budgetOverlay.ts/.css | S | Focused test over a fixture; a Driftwood capture shows one line, no red chrome |
| M2 | Breakdown that adds up: own bytes per world (×1.11, no base); shared split; cells grouped | budgetPoints.ts | S | Test: worlds + shared = headline ± 1 MB |
| M3 | Delete category %, SHARDS OK, raw SHARED, gauge / worst tiles (or move them behind details) | budgetOverlay.ts, budgetPoints.ts, tests | S | Strings gone; tests green; net lines negative |
| M4 | Banner: no declared/actual estimate chip on grid pages; resident over-limit becomes a strip line | memoryWarning.ts, play.ts | S | No banner in Driftwood/Nine for estimates; the G217 blocked screen still works |
| M5 | Measured row in the headline: journal GPU + observed RAM, and `max(model, measured)` | budgetOverlay.ts (reads memoryAttribution) | S | Chromium phone tier shows journal GPU MB within ~15 % of Chromium's GPU-process reading; test fixture |
| M6 | Ghost-world counter (FinalizationRegistry on retired region roots, counted after 30 s) | grid/live.ts (one hook), new grid/ghosts.ts | M | Chromium Driftwood↔Nalati loop at HEAD shows ghosts rise (O18 leak); a clean retire shows 0 |
| M7 | Trend: baseline at controls, value after each crossing (last 6) | budgetOverlay.ts | S | Expanded view lists per-crossing values in a Chromium tour |

## 5. Decisions for Jake (option 1 is always Skip)

- **D1 Crash-warning bands.** Skip / **A amber at 1.5 GB, red at 1.75 GB, against the 17 Pro's 2.05 GB jetsam line
  (rec)** / B one red line at 1.8 GB (the loading limit) / C no bands, numbers only.
- **D2 What the headline counts.** Skip / **A the larger of model and measured, plus ghosts and trend (rec)** /
  B the claim model only (today) / C measured only (GPU journal + observed RAM).
- **D3 Who sees it.** Skip / **A Developer only, as today (rec)** / B also a public one-line "memory high" toast at red /
  C off.
- **D4 The crash itself.** Skip / **A resume O18's per-visit leak fix now (retained region scopes and materials; the
  likely kill on Driftwood → Sky → Driftwood) as one lane before T1 tuning (rec)** / B leave it stopped under G561
  until the zero rows.
