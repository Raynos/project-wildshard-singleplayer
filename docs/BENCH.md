# Load bench — `pnpm bench`

The ruler for project/archive/2026-09-22-load-perf.md. One script, headless Chromium, no dev server involved.

```
pnpm bench                       # pnpm build → vite preview :4175 → wifi,4g × cold,warm at 4× CPU (~2.5 min)
pnpm bench:ci                    # same + bench.budget.json check; exit code = rows over budget
pnpm bench -- --url=https://wildshard-singleplayer.vercel.app     # the live site, no build
pnpm bench -- --compare progress/bench/<before>.json progress/bench/<after>.json   # phase receipt
pnpm bench -- --runs=3 --conditions=wifi --cache=cold              # p50 of 3 for the headline row
node scripts/bench-load.mjs --help                                 # all flags (--cpu, --gpu, --timeout, --no-build, --viewport)
```

Output: `progress/bench/<build>-<timestamp>.json` (everything, per run) and `progress/bench/latest.md` (the table).
Cold = fresh browser context. Warm = second navigation in the same context (HTTP cache + service worker).
The GPU is the host's Metal via ANGLE (same stack as iOS Safari), so shader compile is real, not SwiftShader.

**Method rule.** ms on a shared host swing ±25 % run to run; compare **counts** (bytes by type, requests, programs,
textures, long-task count) and treat ms only as a p50 trend (`--runs=3`). The iPhone is the truth for ms.

## Columns

- **bytes MB net / cache** — net crossed the emulated network (page fetches + the service worker's own fetches);
  cache came from the HTTP cache or the SW cache (sized from asset-index.json). Small print: per type, net + cache.
- **requests** — page-level requests (blob:/data: excluded); the SW's fetches are counted in bytes, not here.
- **title s** — first paint of `.ws-loading` / `#hud.intro`. **play s** — `.ws-loading` gone and `window.__world` set.
- **long tasks n / ms / max** — `PerformanceObserver('longtask')` during load; budget is max ≤ 100 ms.
- **textures / programs / heap** — `renderer.info.memory.textures`, `renderer.info.programs.length`, `usedJSHeapSize`.
- **sw** — whether `navigator.serviceWorker.controller` was set, and how many page requests it served.
- Per-step table: `start s` is when the step's `data-step` (or log line) appeared, `took ms` until the next one.

## Phase 0 baseline — build `232eace`, 2026-09-18, M5 Max, 4× CPU, 1280×720

*Taken while three stray headless Chromes from other agents had the box at load average 24: counts are valid, ms are
suspect (likely high). Re-run on a quiet box with `pnpm bench -- --runs=3` before using the ms as a before.*

| condition | bytes MB net / cache | requests | title s | play s | long tasks n / ms / max | textures | programs | heap MB | sw |
|---|---|---|---|---|---|---|---|---|---|
| wifi/cold | 72.75 / 0.00 — jpg 58.9 · glb 6.8 · hdr 4.0 · png 1.6 · bin 0.9 · js 0.4 · font 0.1 | 78 | 0.52 | 30.30 | 15 / 5752 / 1244 | 166 | 156 | 130.2 | yes · 68 served |
| wifi/warm | 0.05 / 75.61 | 78 | 0.37 | 10.65 | 16 / 6275 / 1374 | 166 | 156 | 132.8 | yes · 71 served |
| 4g/cold | 72.75 / 0.00 | 78 | 0.97 | 79.30 | 16 / 6505 / 1370 | 166 | 156 | 124.5 | yes · 67 served |
| 4g/warm | 0.05 / 75.61 | 78 | 0.55 | 9.49 | 16 / 5270 / 1047 | 166 | 156 | 124.8 | yes · 71 served |

Per-step, wifi/cold: renderer 245 · sky 1674 · terrain 10029 · cards 1685 · forest 112 · edge 934 · grass 5 ·
cabins 7021 · props 2305 · animals 0 · weapon 418 · shaders 3889 · firstFrame 1531 ms → playable at 30.3 s.

Budget status (`pnpm bench:ci`): first-launch transfer 72.75 MB > 12, requests 78 > 20, longest task 1244 ms > 100,
play 79 s > 10 on 4g cold, warm play 9.5 s > 3 — over. Warm transfer 0.05 MB ≤ 0.1 and SW control — met.

## What only a human can do (iPhone, ~3 min)

1. Open the URL in Safari, wait for the title screen, then Share → Add to Home Screen.
2. Kill Safari and the app; turn on Aeroplane Mode (Wi-Fi off too).
3. Open the home-screen icon. Report: what is on screen while it starts; whether the loader reaches 100 % and shows
   the title; whether you can enter the chunk and walk.
4. Radio back on, reopen: one loading screen on the new build, and the build pill matches the deploy?
