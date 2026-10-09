# Frame floor at head, 2026-10-09 (op-floor)

**Build:** origin/main `0cbcad374` (`0cbcad37495a18e7fff737bb10ba225d18da1583`), measured with `scripts/frame-floor.mjs`
(desktop Chromium on Metal, 1440×900 @2 = 2880×1800, uncapped; Simulator Safari on `frame-floor-iphone-17-pro`, phone tier,
30 fps cap). PASS = rounded median ≥ 60 / 30 fps, rAF p95 ≤ 17.5 / 35 ms, every content owner CPU p95 ≤ ¼ frame.
Standalone shards run with Developer on (the floor's protocol); the public grid with Developer off and `--grid-scenario=template`.

## Verdict

- **Simulator:** all eight shards pass; the Developer grid passes; the public grid passes in 2 of 3 runs (one doubled-frame
  miss per failing run, a different pose each time, see below).
- **Desktop:** seven of eight shards pass every run; the Developer grid and the public grid pass every run. **Pine Hollow's
  cabin pose missed once** (p95 33.3 ms, run A) and passed in three re-runs (G, H, and I with Developer off). It sits at the edge.

## Runs and load (1-minute load average at start → end)

| Run | What | JSON | Load |
|---|---|---|---|
| A | 8 shards, desktop | `0cbcad374-63871-1791577137156.json` | 5.0 → 7.4 (quiet) |
| B | 8 shards, Simulator | `0cbcad374-971-1791577610910.json` | 46 → 16, peak 77 (another lane's push gate): passes are under load |
| C | Developer grid, both | `0cbcad374-81644-1791577355747.json` | 7.4 → 13.7 |
| D | public grid (template scenario), both | `0cbcad374-1837-1791578694415.json` | 36 → 38 (another lane's push gate, full vitest) |
| E | public grid (template scenario), both | `0cbcad374-87056-1791579613460.json` | 5.6 → 7.8; 22 while the Simulator booted |
| F | public grid (template scenario), Simulator | `0cbcad374-23517-1791580058526.json` | 5.1 → 8.0 |
| G | Pine Hollow, desktop (repeat) | `0cbcad374-41729-1791578999972.json` | 38 → 19 |
| H | Pine Hollow, desktop (repeat) | `0cbcad374-96809-1791579884413.json` | 7.8 → 7.5 |
| I | Pine Hollow, desktop, Developer **off** | `0cbcad374-8182-1791579963075.json` | 7.5 → 5.9 |

The load sampled every 10 s is in the run scratch logs, which were not kept. The first public-grid run used the baseline
scenario, which never walks into the template, so its witness could not pass. It was deleted; D–F replace it.

## Table (pose / surface / median fps / rAF p95 ms / main-thread work p95 ms / pass)

| Run | Shard | Pose | Surface | fps | p95 | work p95 | Pass |
|---|---|---|---|---|---|---|---|
| A | _template | spawn | desktop | 59.88 | 16.7 | 2 | PASS |
| A | _template | spawn-reverse | desktop | 59.88 | 16.8 | 2 | PASS |
| A | driftwood-isle | spawn | desktop | 59.88 | 16.7 | 8.6 | PASS |
| A | driftwood-isle | wreck | desktop | 59.88 | 16.7 | 7.7 | PASS |
| A | driftwood-isle | pier | desktop | 59.88 | 16.7 | 8.6 | PASS |
| A | pine-hollow | spawn | desktop | 59.88 | 16.7 | 16 | PASS |
| A | pine-hollow | cabin | desktop | 59.88 | 33.3 | 19.1 | **FAIL** (frame cost / scheduling) |
| A | pine-hollow | pond | desktop | 59.88 | 16.8 | 14.9 | PASS |
| A | nalati-grasslands | spawn | desktop | 59.88 | 16.7 | 6.1 | PASS |
| A | nalati-grasslands | camp | desktop | 59.88 | 16.7 | 5.1 | PASS |
| A | nalati-grasslands | bridge | desktop | 59.88 | 16.7 | 5.8 | PASS |
| A | sunscar-dunes | spawn | desktop | 59.88 | 16.7 | 2.3 | PASS |
| A | sunscar-dunes | spawn | desktop | 59.88 | 16.7 | 2.2 | PASS |
| A | sunscar-dunes | whip | desktop | 59.88 | 16.7 | 2.3 | PASS |
| A | far-reach | spawn | desktop | 59.88 | 16.7 | 3.7 | PASS |
| A | far-reach | spawn | desktop | 59.88 | 16.7 | 3.8 | PASS |
| A | far-reach | hover | desktop | 59.88 | 16.7 | 3.2 | PASS |
| A | nine-dragon-stack | spawn | desktop | 59.88 | 16.7 | 3.4 | PASS |
| A | nine-dragon-stack | spawn-rail | desktop | 59.88 | 16.7 | 3.3 | PASS |
| A | nine-dragon-stack | well-edge | desktop | 59.88 | 16.7 | 3.1 | PASS |
| A | blender-template | spawn | desktop | 59.88 | 16.8 | 1.6 | PASS |
| A | blender-template | spawn-reverse | desktop | 59.88 | 16.7 | 1.6 | PASS |
| B | _template | spawn | Simulator | 30.303 | 34 | 3 | PASS |
| B | _template | spawn-reverse | Simulator | 30.303 | 34 | 3 | PASS |
| B | driftwood-isle | spawn | Simulator | 30.303 | 34 | 7 | PASS |
| B | driftwood-isle | beach | Simulator | 30.303 | 34 | 8 | PASS |
| B | driftwood-isle | wreck | Simulator | 30.303 | 34 | 8 | PASS |
| B | pine-hollow | spawn | Simulator | 30.303 | 34 | 8 | PASS |
| B | pine-hollow | pond | Simulator | 30.303 | 35 | 9 | PASS |
| B | pine-hollow | cabin | Simulator | 30.303 | 34 | 9 | PASS |
| B | nalati-grasslands | spawn | Simulator | 30.303 | 34 | 6 | PASS |
| B | nalati-grasslands | plains | Simulator | 30.303 | 34 | 6 | PASS |
| B | nalati-grasslands | camp | Simulator | 30.303 | 34 | 6 | PASS |
| B | sunscar-dunes | spawn | Simulator | 30.303 | 34 | 4 | PASS |
| B | sunscar-dunes | spawn | Simulator | 30.303 | 34 | 4 | PASS |
| B | sunscar-dunes | ray | Simulator | 30.303 | 34 | 3 | PASS |
| B | far-reach | spawn | Simulator | 30.303 | 34 | 6 | PASS |
| B | far-reach | hover | Simulator | 30.303 | 34 | 6 | PASS |
| B | far-reach | spawn | Simulator | 30.303 | 34 | 5 | PASS |
| B | nine-dragon-stack | spawn | Simulator | 30.303 | 34 | 6 | PASS |
| B | nine-dragon-stack | spawn-rail | Simulator | 30.303 | 34 | 6 | PASS |
| B | nine-dragon-stack | well-edge | Simulator | 30.303 | 34 | 5 | PASS |
| B | blender-template | spawn | Simulator | 30.303 | 34 | 3 | PASS |
| B | blender-template | spawn-reverse | Simulator | 30.303 | 34 | 3 | PASS |
| C | grid | spawn | desktop | 59.88 | 16.8 | 8 | PASS |
| C | grid | grid-crossroads | desktop | 59.88 | 16.7 | 6.6 | PASS |
| C | grid | grid-deck-north | desktop | 59.88 | 16.7 | 2.6 | PASS |
| C | grid | spawn | Simulator | 30.303 | 34 | 8 | PASS |
| C | grid | grid-crossroads | Simulator | 30.303 | 34 | 10 | PASS |
| C | grid | grid-deck-east | Simulator | 30.303 | 34 | 5 | PASS |
| D | grid (public) | spawn | desktop | 59.88 | 16.8 | 8.3 | PASS |
| D | grid (public) | grid-crossroads | desktop | 59.88 | 16.8 | 7.1 | PASS |
| D | grid (public) | grid-deck-east | desktop | 59.88 | 16.7 | 2.5 | PASS |
| D | grid (public) | grid-public-road-travel | desktop | 59.88 | 16.8 | 6.9 | PASS |
| D | grid (public) | grid-public-road | desktop | 59.88 | 16.7 | 2.7 | PASS |
| D | grid (public) | grid-public-template-travel | desktop | 59.88 | 16.8 | 3.1 | PASS |
| D | grid (public) | grid-public-template | desktop | 59.88 | 16.8 | 3.6 | PASS |
| D | grid (public) | spawn | Simulator | 30.303 | 34 | 8 | PASS |
| D | grid (public) | grid-deck-east | Simulator | 30.303 | 34 | 9 | PASS |
| D | grid (public) | grid-crossroads | Simulator | 30.303 | 34 | 10 | PASS |
| D | grid (public) | grid-public-road-travel | Simulator | 30.303 | 37 | 8 | **FAIL** (frame cost / scheduling) |
| D | grid (public) | grid-public-road | Simulator | 30.303 | 34 | 4 | PASS |
| D | grid (public) | grid-public-template-travel | Simulator | 30.303 | 35 | 4 | PASS |
| D | grid (public) | grid-public-template | Simulator | 30.303 | 34 | 10 | PASS |
| E | grid (public) | spawn | desktop | 59.88 | 16.7 | 7.3 | PASS |
| E | grid (public) | grid-deck-north | desktop | 59.88 | 16.7 | 3.3 | PASS |
| E | grid (public) | grid-crossroads | desktop | 59.88 | 16.7 | 6.3 | PASS |
| E | grid (public) | grid-public-road-travel | desktop | 59.88 | 16.7 | 6.1 | PASS |
| E | grid (public) | grid-public-road | desktop | 59.88 | 16.7 | 3.9 | PASS |
| E | grid (public) | grid-public-template-travel | desktop | 59.88 | 16.7 | 4.1 | PASS |
| E | grid (public) | grid-public-template | desktop | 59.88 | 16.8 | 4 | PASS |
| E | grid (public) | spawn | Simulator | 30.303 | 34 | 7 | PASS |
| E | grid (public) | grid-crossroads | Simulator | 30.303 | 38 | 11 | **FAIL** (frame cost / scheduling) |
| E | grid (public) | grid-deck-east | Simulator | 30.303 | 35 | 5 | PASS |
| E | grid (public) | grid-public-road-travel | Simulator | 30.303 | 34 | 10 | PASS |
| E | grid (public) | grid-public-road | Simulator | 30.303 | 34 | 5 | PASS |
| E | grid (public) | grid-public-template-travel | Simulator | 30.303 | 34 | 6 | PASS |
| E | grid (public) | grid-public-template | Simulator | 30.303 | 34 | 8 | PASS |
| F | grid (public) | spawn | Simulator | 30.303 | 34 | 8 | PASS |
| F | grid (public) | grid-deck-east | Simulator | 30.303 | 34 | 5 | PASS |
| F | grid (public) | grid-crossroads | Simulator | 30.303 | 34 | 10 | PASS |
| F | grid (public) | grid-public-road-travel | Simulator | 30.303 | 35 | 8 | PASS |
| F | grid (public) | grid-public-road | Simulator | 30.303 | 34 | 5 | PASS |
| F | grid (public) | grid-public-template-travel | Simulator | 30.303 | 34 | 5 | PASS |
| F | grid (public) | grid-public-template | Simulator | 30.303 | 34 | 9 | PASS |
| G | pine-hollow | spawn | desktop | 59.88 | 16.7 | 11.7 | PASS |
| G | pine-hollow | cabin | desktop | 59.88 | 16.7 | 12.7 | PASS |
| G | pine-hollow | gate | desktop | 59.88 | 16.7 | 11.1 | PASS |
| H | pine-hollow | spawn | desktop | 59.88 | 16.8 | 14.5 | PASS |
| H | pine-hollow | cabin | desktop | 59.88 | 16.7 | 15.2 | PASS |
| H | pine-hollow | gate | desktop | 59.88 | 16.8 | 14.7 | PASS |
| I | pine-hollow (public) | spawn | desktop | 59.88 | 16.7 | 7.4 | PASS |
| I | pine-hollow (public) | cabin | desktop | 59.88 | 16.7 | 8.5 | PASS |
| I | pine-hollow (public) | gate | desktop | 59.88 | 16.7 | 7.4 | PASS |

## Pine Hollow's cabin: the cause

Probe: [`probe.mjs`](probe.mjs), SF69's probe with a `pine-cabin` pose and `--set=<setting>=<value>`. It records rAF
intervals, main-thread work split into update and render, per-pass CPU, the GPU timer (`EXT_disjoint_timer_query_webgl2`)
over the composer and per pass, and a CDP CPU profile. Outputs are `probe-*.json`. Pose: (−14, −62), yaw π, 2880×1800.

| Variant | GPU frame p50 / p95 ms | work p50 / p95 ms | render CPU p50 ms |
|---|---|---|---|
| `0cbcad374`, Developer on | **16.8 / 18.6** | 10.6 / 12.0 | 9.3 |
| `0cbcad374`, Developer on, Shadow bias **old** | 16.2 / 17.6 | 11.6 / 12.8 | 10.2 |
| `0cbcad374`, Developer on, Memory saver on | 16.4 / 19.6 | 13.9 / 15.2 | 12.3 |
| `0cbcad374`, Developer **off** | 15.9 / 16.4 | 7.5 / 8.3 | 6.0 |
| `1f84c55dc` (last 8.6 ms work reading), Developer on | 15.5 / 15.9 | 7.7 / 8.7 | 6.3 |

1. **The cabin is GPU-bound right at vsync.** At 2880×1800 with MSAA the GPU timer reads about 16 ms a frame against a
   16.7 ms budget: scene pass ≈ 6.4 ms, N8AO ≈ 3.8 ms, plus the two effect passes. Any extra ≈ 1 ms, or a burst of
   machine load, doubles frames, which is why it fails one run in four.
2. **Developer on costs ≈ 3–7 ms of main thread at Pine (SF64 GPU labelling).** In the floor runs, work p95 is 15.2 ms
   with Developer on and 8.5 ms with it off (H vs I). Developer off matches `1f84c55dc`'s 8.6 ms, so the whole rise in work
   since then (8.6 → 12.3 → 19.1 ms) is Developer only. The CPU profile has ≈ 28 % of main-thread samples in `gpuLabels`
   (`amortizedTree`). SF69 amortised the *labelling*, but each `renderer.render` (3–4 a frame with n8ao's pre-passes)
   still visits **every node** in the scene and runs `due()` on it (WeakMap lookups, `Reflect.get`, material versions).
   Pine has the most nodes of any shard (herds, trees). The extra time is spent inside render, so submission stalls, and
   it also shows up as ≈ +0.9 ms of GPU-timer time.
3. **The receiver-plane shadow filter (`f9fe9e81e`, made unconditional in `c71039878` after Jake picked New) costs
   ≈ 0.6 ms median and ≈ 1.0 ms p95 of GPU** at this pose. That is small, but it comes out of the last 1 ms of headroom.
   The Memory saver gives back no GPU time (G271 turning it off is not the cause).

**Proposed fix (for routing, not built here: the lane does not push):**
- **gpuLabels (owner: the SF64 / SF69 engine-render lane).** Outside the census harness, stop visiting the whole tree on
  every render. Walk at most once a frame, and only a 1/REFRESH slice of the nodes, using a cursor or a node list kept by
  `childadded` / `childremoved`. Label new nodes from the add event instead of finding them by a walk. Labels are
  diagnostics, so up to 1 s of delay is fine, and `properties.get` already re-tags a handle when its label changes.
  Expected result: Developer-on Pine work goes from ≈ 15 ms back to ≈ 8.5 ms, the GPU timer drops ≈ 0.9 ms, and the cabin
  gets ≈ 1.5 ms of GPU headroom back. This is a CPU / diagnostics change with no pixels or memory affected, so it needs no
  Debug row.
- **Pine's GPU headroom on weaker desktops** stays Part B S21 (MSAA / density tier). A free saving already found:
  SF0c's note that n8ao's transparency pre-passes can be skipped when they change no pixel.

## Public grid in the Simulator: marginal at two poses

The misses are a single doubled-frame burst, not a steady cost. Run D: `grid-public-road-travel` 37 ms (load 36–38). Run
E: `grid-crossroads` 38 ms, p99 46 ms, measured right after the Simulator boot pushed load to 22. Run F (load 5–8) passes
every pose (crossroads 34 / 36 ms p99). The Developer grid passes the same poses (C). Content CPU p95 is 2–4 ms against
the 8.3 ms limit, so this is load sensitivity in Mac-backed Safari, not a shard or engine regression. The floor half of SF71's acceptance (the public grid floor is green) holds in quiet run F. Its other half (no periodic
task over 50 ms) is not shown here: the worst single frame interval was 166 ms in run D (under load), 47 ms in E and 56 ms
in F. A rAF interval is not a task trace, so this needs SF67's long-task benchmark.
