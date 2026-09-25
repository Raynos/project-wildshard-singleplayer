# The regression scorecard — `scripts/scorecard.mjs`

Three big changes are built in parallel and land on `main` one at a time: shard switching in the page with two
shards resident (E155 / E159), GPU-compressed KTX2 textures and a baked PMREM (E157), and background prefetch with fewer
cache invalidations and a cache GC (E158 / E161). Each one trades memory, downloads, time and the look against each
other. The scorecard is how we keep all of them in balance: **one table, a baseline recorded on `main` before any of
them merged, and every merge at or better than the baseline on every row.**

## The merge rule

1. **One merge at a time.** A branch lands on `main` alone. The next one rebases on it.
2. **The scorecard is rerun on the merged tree**, from a clean export of the merge commit, before the push:
   `node scripts/scorecard.mjs --export=HEAD --tag=<ask id> --compare=baseline`.
3. **Any regression blocks the push**: a row worse than the baseline by more than its noise band, a row that went
   missing, or a missed enforced budget rule. The exit code is 1 and the table names the rows.
4. **The one exception is a row the user re-budgets.** The re-budget goes in `scorecard.budget.json` `rebudget`
   as `{ row, max | min, why, by }`, with the user's words as the why. An agent never re-budgets a row on its own.
5. When a merge improves rows and the user wants the gain locked in, rerun the baseline on the new `main`
   (`--tag=baseline --runs=2 --goldens --retouch`) and commit it. The old baseline stays in git history.

## How to run it

```
# the baseline (what progress/scorecard/baseline.{json,md} and the goldens are): two full runs, for the noise band
node scripts/scorecard.mjs --export=HEAD --tag=baseline --runs=2 --goldens --retouch

# a merge
node scripts/scorecard.mjs --export=HEAD --tag=e155 --compare=baseline

# a quick look at one shard on a server you already run
node scripts/scorecard.mjs --url=http://localhost:4173 --tag=try --shards=pine-hollow --viewports=phone --no-switch

# re-print a verdict from two result files, no browser
node scripts/scorecard.mjs --compare=baseline --against=e155
```

- `--export=<ref>`: `git archive <ref>` into `/tmp/scorecard-<sha>`, `node_modules` symlinked, `vite build`, then
  `vite preview` on a free port (from 4281). A second run of the same sha reuses the build.
- One headless Chromium for the whole run: ANGLE Metal, `--mute-audio`, `&mute=1`, back/forward cache off. It waits
  while 3 headless browsers already run on the machine (AGENTS.md), and closes everything at the end.
- A full run (3 shards × 2 viewports, 3 poses each, the 4G cold loads, both switch routes) takes about 25 minutes;
  `--runs=2 --retouch` about an hour. `node scripts/scorecard.mjs --help` lists every flag.
- Output: `progress/scorecard/<tag>.json` (every row, its runs and the raw measurements), `<tag>.md` (the tables, and
  the verdict with `--compare`), and the pose shots in `progress/scorecard/<tag>/`.

## What it pins

- Time of day midday and Pine Hollow's weather clear: the saved Settings the game reads (`ws.settings.v1`), written
  before the page's first script. `?weather=clear` holds Nalati's storm cycle at its clear phase.
- `Math.random` is a seeded mulberry32 stream from the first script on, so creatures spawn the same way each load.
- `?skipintro=1&nolock=1&mute=1`, the phone at `?touch=1&tier=phone`, the desktop at `?tier=desktop`.
- Network: Chrome's DevTools throttle at 30 Mbit/s, 20 ms, applied to the service worker's own fetches too (the
  bench-load method). CPU unthrottled. A second cold load per shard runs at "Fast 4G" (9 Mbit/s, 170 ms).

## The rows

Row keys are `<shard>/<viewport>/<metric>`, `switch/<viewport>/<n>.<from>><to>.<metric>` and
`retouch/<viewport>/netBytes`. The viewports are **phone** (iPhone portrait, 390 × 844 at 3×, touch, `?tier=phone`)
and **desktop** (1600 × 900 at 1×, `?tier=desktop`).

### Load

| row | what it is |
|---|---|
| `cold.netBytes` | Bytes over the network from a fresh browser context (service worker allowed) until 1.5 s after playable: the page's requests the SW did not serve, plus every fetch the SW made itself. |
| `cold.requests` | Page-level requests in that window (the SW's own fetches are counted in bytes, not here). |
| `cold.idleNetBytes` | Cold bytes until the network has been quiet for 5 s: the SW's precache, and a background prefetch of the other shards once E158 lands. |
| `cold.playMs` | Time to play, bench-load's definition: from navigation start until `.ws-load` is gone and `window.__world` is set. |
| `cold4g.playMs` | The same on Fast 4G, in a fresh context of its own. |
| `cold.longTaskMaxMs` | The longest main-thread task before playable (`PerformanceObserver('longtask')`). |
| `warm.*` | The second load in the same context: the service worker's cache. |

### Memory

Measured on the warm page, 5 s after it became playable, after a forced GC.

| row | what it is |
|---|---|
| `mem.heapBytes` | JS heap in use (CDP `Performance.getMetrics` `JSHeapUsedSize`). |
| `mem.glTexBytes` | GPU texture bytes of the renderer's WebGL context, counted at the API: every `texImage2D/3D`, `texStorage2D/3D`, `compressedTexImage2D/3D`, `copyTexImage2D` and `generateMipmap`, sized by internal format (compressed formats by block size: BCn, ETC2, ASTC, PVRTC), minus `deleteTexture`. Render targets, shadow maps and PMREM are in it. RGB formats count as 4 bytes a texel (the GPU pads them). |
| `mem.glRbBytes` | Renderbuffers (MSAA targets), × samples. |
| `mem.glBufBytes` | Vertex / index / uniform buffers (`bufferData`). |
| `mem.sceneTexBytes` | An estimate from a scene traversal: every texture a material, uniform, background or environment holds, width × height × bytes a texel × 4/3 for mips; a compressed texture by its mip data. It misses render targets, so it reads well under `glTexBytes`. The gap is the render targets. |
| `mem.textures / geometries / programs` | `renderer.info`. |

The JSON also keeps the 12 largest GL textures (`glTop`: bytes, size, internal format, levels), and whether any
upload was compressed (`glCompressedUploads`): E157 should turn that from 0 into most of the textures.

### Runtime and look

Three fixed poses a shard, from `scripts/physics-baseline.mjs`: Driftwood pier (the spawn), beach, wreck; Nalati camp,
bridge, plains; Pine Hollow gate, cabin, pond. The player is teleported there on the warm page, pitch 0, and left
5 s to settle.

| row | what it is |
|---|---|
| `pose.<name>.fps` | Drawn frames a second over 10 s: a frame counts when `game.frameNo` moves, so the tier's frame cap is honoured (Pine Hollow's phone tier draws every second vsync: 30 on purpose). |
| `pose.<name>.frameP95Ms` | The 95th percentile interval between drawn frames. |
| `pose.<name>.cpuP50Ms / cpuP95Ms` | Main-thread ms a drawn frame inside `requestAnimationFrame` callbacks (the game loop, draw submission included). Unlike fps it is not capped by vsync, so it moves when the work does. |
| `pose.<name>.calls / trisK` | Draw calls and triangles of the last frame (`game.lastFrame`), the median over the sample. |
| `pose.<name>.ssim` | SSIM of the pose's screenshot (JPEG, quality 80, CSS pixels) against its golden in `progress/scorecard/baseline/`, on luma with a 7 × 7 window (skimage's default), computed in the page. The row passes at ≥ 0.98. A pose whose run-to-run SSIM is below that is re-budgeted in `scorecard.budget.json` with the measured noise as the why. |

### Switch route

Per viewport, in a fresh context: a cold Driftwood Isle, then pause → *Exit to main menu* → pick Nalati Grasslands →
*Enter world*, and on to Pine Hollow and back to Driftwood. Before the switch, the cold load is left to go quiet
(a prefetch lands there). Each switch records:

| row | what it is |
|---|---|
| `.ms` | From *Enter world* to playable in the new shard (`__world.chunk.slug` is the new shard, no `.ws-load`, not on the title). |
| `.navigated` (info) | Whether the page navigated. A marker set on `window` before the click survives an in-page switch and is gone after a load. Today every switch is a full page load; after E155 it should be 0. |
| `.loadingShown` (info) | Whether the `.ws-load` loading screen appeared. |
| `.netBytes` | Bytes downloaded during the switch and the 5 s after it. |
| `.longTaskMaxMs` | The longest main-thread task in the switch. |
| `.heapBytes / .glTexBytes` | Memory once the new shard is up. With two shards resident (E155) this is where the cost shows. |
| `switch/<vp>/cacheStorageBytes` | Cache Storage (`navigator.storage.estimate().usageDetails.caches`) after all three shards. |
| `switch/<vp>/prefetchBytes` (info) | Bytes after the first shard's play until the network went quiet. |

### One-texture change (`--retouch`)

The same tree is built a second time into `dist-retouch/` with one texture re-encoded
(`/assets/tex/leafy_grass/nor_gl_1k.jpg`, Pine Hollow's ground normal map; in the phone boot pack, a file of its own on
desktop). A context loads build A cold and warm; then the origin serves build B, and the page is reloaded until it runs
B's entry script, the waiting service worker adopted the way the build pill does. `retouch/<vp>/netBytes` is every byte
downloaded after the switch of builds. Every build also stamps a new build id into the code bundle, so the code is
re-downloaded in this row too, as it is on every deploy.

## The noise band

A row regresses when it is worse than the baseline by more than
`max(rel, noise × the baseline's run-to-run spread) × baseline + abs`. `rel`, `noise` and `abs` are per row kind in
`scorecard.budget.json` `kinds`. The spread is the (max − min) / median of the baseline's two runs, so a row that
moved a lot between the two baseline runs gets a wider band on its own. Timing moves ±10 % (more on a loaded machine);
bytes and requests are near-exact.

Run-to-run noise of the committed baseline: see *Noise* in `progress/scorecard/baseline.md`.

## Budget rules

`scorecard.budget.json` `rules` are checked on top of the row-by-row rule. The user approved these on 2026-09-25 (E160),
and they fail `--compare`:

- first-play cold transfer ≤ 1.5 × today, per shard and viewport;
- Cache Storage for all three shards ≤ 300 MB;
- cold time to play no worse than today; on Fast 4G, Driftwood ≤ 22 s and Pine Hollow ≤ 40 s (bench.budget.json's
  rows), Nalati no worse than its baseline;
- warm time to play and the switch times no worse than today, with *improve* as the printed goal;
- bytes re-downloaded after a one-texture change ≤ 2 MB.

## What headless cannot measure

- **The real iOS memory limit.** Safari kills a tab (and a home-screen PWA) at a WebContent footprint that depends
  on the device and what else runs; there is no API for it and Chromium's numbers are not WebKit's. The
  scorecard's heap and GL bytes are the comparators; the limit itself needs the phone: Safari Web Inspector's Timelines →
  Memory on a cabled iPhone, or Xcode's Instruments (Allocations / VM Tracker on the WebContent process), switching
  shards until the tab reloads.
- **iPhone frame rate and thermal throttling.** The GPU here is the Mac's M5 Max. fps and frame times are a trend.
  The phone is the truth (and Low Power Mode caps it at 30).
- **Safari's service worker and Cache Storage quotas and eviction.** Chromium's `storage.estimate()` is used here.
- **Real network variance.** The throttle is DevTools' shaping, not a cell link.
