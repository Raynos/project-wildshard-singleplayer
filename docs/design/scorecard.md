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

# re-measure one section into an existing result of the same build (here: the one-texture row)
node scripts/scorecard.mjs --serve=/tmp/scorecard-<sha> --tag=baseline --patch --no-load --no-poses --no-switch --retouch

# a request-count change: every request of each load, with when it started and whether the worker served it
node scripts/scorecard.mjs --url=… --tag=try --shards=pine-hollow --viewports=phone --no-poses --no-switch --dump-urls
```

- `--export=<ref>`: `git archive <ref>` into `/tmp/scorecard-<sha>`, `node_modules` symlinked, `vite build`, then
  `vite preview` on a free port (from 4281). A second run of the same sha reuses the build.
- One headless Chromium for the whole run: ANGLE Metal, `--mute-audio`, `&mute=1`, back/forward cache off. It waits
  while 3 headless browsers already run on the machine (AGENTS.md), and closes everything at the end.
- A full run (3 shards × 2 viewports, 3 poses each, the 4G cold loads, both switch routes) takes about 32 minutes;
  `--runs=2 --retouch` about 70. Use `run_in_background`: it outlives a 10-minute tool timeout. `node scripts/scorecard.mjs --help` lists every flag.
- Output: `progress/scorecard/<tag>.json` (every row, its runs and the raw measurements), `<tag>.md` (the tables, and
  the verdict with `--compare`), and the pose shots in `progress/scorecard/<tag>/`.

## What it pins

- Time of day midday and Pine Hollow's weather clear: the saved Settings the game reads (`ws.settings.v1`), written
  before the page's first script. `?weather=clear` holds Nalati's storm cycle at its clear phase.
- `Math.random` is a seeded mulberry32 stream from the first script on, so creatures spawn the same way each load.
- On the measured page creatures are calm (`animals.calm`: they still walk, graze and animate, but do not react to the
  player) and Pine Hollow's named elites have no aware / engage radius. Without that the Imperial Bull charged the pond
  pose and killed the player mid-sample (SSIM 0.22 between two runs of the same build).
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
| `cold.netBytes` | The boot's bytes, from a fresh browser context (service worker allowed): every request that STARTED before playable — the page's requests the SW did not serve, plus every fetch the SW made itself. (Before 2026-09-25 it was every request that finished within 1.5 s after playable.) |
| `cold.requests` | The boot's page-level requests, same window (the SW's own fetches count in bytes, not here). |
| `cold.bgNetBytes` (info) | The background download: every byte of a request that started after playable, until the network has been quiet for 6 s (up to 4 min). Since E158 that is the other shards' boot files plus every shard's KTX2 set (~95–105 MB on the phone; ~175–255 MB on the desktop since E173 baked its own sets, 147 MB of them KTX2); it is not a boot row and never fails a compare. |
| `cold.idleNetBytes` (info) | Boot + background, until quiet. |
| `cold.playMs` | Time to play, bench-load's definition: from navigation start until `.ws-load` is gone and `window.__world` is set. |
| `cold4g.playMs` | The same on Fast 4G, in a fresh context of its own. |
| `cold.longTaskMaxMs` | The longest main-thread task before playable (`PerformanceObserver('longtask')`). |
| `warm.*` | The second load in the same context, after the background download: the service worker's cache. This load is the KTX2 one (E157 B: Auto boots KTX2 once the shard's set is cached; the phone since E157, the desktop since E173), so its requests include the KTX2 stand-ins, which are not packed, and its GPU rows are the compressed ones. |

The JSON keeps each load's requests by file type (`reqByType`) and bytes by type (`byType`), so a request-count
change can be traced to its files.

**The boot pack check.** Before measuring, every boot pack part the served tree's `src/boot/packs.generated.ts` names
is fetched (HEAD, its own size): a pack bake that failed at build time only warns, and then every part 404s and the boot
falls back to one request per packed file. The report's head says whether all parts are served.

### Memory

Measured on the warm page, 5 s after it became playable, after a forced GC.

| row | what it is |
|---|---|
| `mem.heapBytes` | JS heap in use (CDP `Performance.getMetrics` `JSHeapUsedSize`). |
| `mem.glTexBytes` | GPU texture bytes of the renderer's WebGL context, counted at the API: every `texImage2D/3D`, `texStorage2D/3D`, `compressedTexImage2D/3D`, `copyTexImage2D` and `generateMipmap`, sized by internal format (compressed formats by block size: BCn, ETC2, ASTC, PVRTC), minus `deleteTexture`. Render targets, shadow maps and PMREM are in it. RGB formats count as 4 bytes a texel (the GPU pads them). |
| `mem.glRbBytes` | Renderbuffers (MSAA targets), × samples. |
| `mem.glBufBytes` | Vertex / index / uniform buffers (`bufferData`). |
| `mem.sceneTexBytes` | An estimate from a scene traversal: every texture a material, uniform, background or environment holds, width × height × bytes a texel × 4/3 for mips; a compressed texture by its mip data. It misses render targets, so it reads well under `glTexBytes`. The gap is mostly render targets and shadow maps. |
| `mem.textures / geometries / programs` | `renderer.info`. |

The JSON also keeps the 12 largest GL textures (`glTop`: bytes, size, internal format, levels), and whether any
upload was compressed (`glCompressedUploads`): E157 should turn that from 0 into most of the textures.

### Runtime and look

Three fixed poses a shard, from `scripts/physics-baseline.mjs`: Driftwood pier (the spawn), beach, wreck; Nalati camp,
bridge, plains; Pine Hollow gate, cabin, pond. The player is teleported there on the warm page (onto the static floor under a ray, so the pier pose stands on the deck), pitch 0, and left
5 s to settle.

| row | what it is |
|---|---|
| `pose.<name>.fps` | Drawn frames a second over 10 s: a frame counts when `game.frameNo` moves, so the tier's frame cap is honoured (Pine Hollow's phone tier draws every second vsync: 30 on purpose). |
| `pose.<name>.frameP95Ms` | The 95th percentile interval between drawn frames. |
| `pose.<name>.cpuP50Ms / cpuP95Ms` | Main-thread ms a drawn frame inside `requestAnimationFrame` callbacks (the game loop, draw submission included). Unlike fps it is not capped by vsync, so it moves when the work does. |
| `pose.<name>.calls / trisK` | Draw calls and triangles of the last frame (`game.lastFrame`), the median over the sample. |
| `pose.<name>.ssim` | SSIM of the pose's screenshot (JPEG, quality 80, CSS pixels) against its golden in `progress/scorecard/baseline/`, on luma with a 7 × 7 window (skimage's default), computed in the page, **with the creatures masked**: every animal's skinned-mesh bounds are projected to a screen box (padded, plus a strip above for its label) when the shot is taken, and windows touching a box in either frame (the golden's boxes are in the baseline JSON) are left out. It measures the render, not where the herd wandered. The row passes at ≥ min(0.98, the baseline's own run-2-vs-golden SSIM − 0.01). |
| `pose.<name>.maskedFrac` (info) | The share of the frame the creature mask left out. The unmasked SSIM is kept in the JSON (`ssimUnmasked`). |

### Switch route

Per viewport, in a fresh context: a cold Driftwood Isle, left to go quiet (the background download of the other shards
lands there), then pause → *Exit to main menu* → the other shard's card → *Enter world*, along
**Driftwood → Nalati → Driftwood → Pine Hollow → Nalati**. With two shards resident (E155 / E159) that is a first build,
a resident return, a build that evicts the least recently used shard (Nalati), and that shard's rebuild. The route's
context saves *Shards in memory* = 2 before the page loads, whatever the game's default (1 since da2566d4): under cap 1
step 2 is a rebuild, not a resident return, and its time is not comparable (E194: the "0.05 → 1.7 s resident return"
was exactly that). A step whose `ShardHost` kind is not the route's (build, resident, build, rebuild) prints a WARNING. Only the live
deck is clicked (`#hud .ws-menu:not(.hide)`: the deck being left fades out with its buttons still in the DOM). A shard
built in the page lands on its own title, as a reload did, and the scorecard presses *Enter world* again when it is up.
Step 1's key (`1.driftwood-isle>nalati-grasslands`) is the old navigation route's; the others are new. Each switch
records:

| row | what it is |
|---|---|
| kind (report) | `ShardHost`'s own timing kind: `build`, `resident`, `rebuild` — or `navigation` on a build without in-page switching. |
| `.ms` | From *Enter world* to playable in the new shard (`__world.chunk.slug` is the new shard, no `.ws-load`, not on the title); a build's title wait and the second click are in it. |
| `.firstFrameMs` | … to the new shard's second drawn frame (`game.frameNo`). |
| `.navigated` (info) | Whether the page navigated: a `window.scDocMark` set before the click (not a `__*` name — ShardHost moves those with the shard that set them) survives an in-page switch and is gone after a load. |
| `.loadingShown` (info) | Whether the `.ws-load` loading screen appeared (never on a resident return). |
| `.netBytes` | Bytes downloaded during the switch and the 5 s after it. |
| `.longTaskMaxMs` | The longest main-thread task in the switch. |
| `.heapBytes` | JS heap after a forced GC, the new shard up. |
| `.glTexBytes / .glAllTexBytes` | GPU texture + renderbuffer bytes of the running shard's context / of every live context (each resident shard keeps its renderer; an evicted one's context is lost and drops out). |
| `switch/<vp>/cacheStorageBytes` | Cache Storage (`navigator.storage.estimate().usageDetails.caches`) after all three shards. |
| `switch/<vp>/prefetchBytes` (info) | Bytes of the requests that started after the first shard's play, until the network went quiet (the background download). |

### One-texture change (`--retouch`)

The same tree is built a second time into `dist-retouch/` with one texture re-encoded (sips, the same picture, new bytes):
`/assets/hdri/qwantani_mid_morning_puresky_2k.key.jpg`, one of the two Pine Hollow sky keys the pinned midday reads, on
both tiers (in the phone boot pack, a file of its own on desktop). It was a ground normal map until 2026-09-25: since
E157 a returning player boots KTX2, which never reads the JPEG a KTX2 twin replaces, so that row measured no texture at
all. A context loads build A cold and warm; then the origin serves build B, and the page is reloaded until it runs B's
entry script, the waiting service worker adopted the way the build pill does.

`retouch/<vp>/netBytes` counts the **re-downloads**: files build A had already fetched, compared by name without their
version (`?v=`, the `-<hash>` suffix). The edited file counts, and so does the code bundle, which every build re-stamps
with its build id. A file A never fetched (a sound first played during B) is not a re-download: it is in
`retouch/<vp>/allNetBytes` (info) only.

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

| rule | ceiling | the 2026-09-25 baseline on main 5486794 |
|---|---|---|
| first-play cold transfer ≤ 1.5 × the first baseline (7893668) | Driftwood 30.1 / 31.6 MiB · Nalati 43.4 / 52.1 · Pine Hollow 53.8 / 137.0 (phone / desktop) | 20.4 / 21.4 · 29.4 / 35.4 · 34.2 / 90.8 |
| Cache Storage, all three shards | ≤ 300 MB | 132.5 MiB phone · 123.8 MiB desktop |
| cold time to play | no worse than the baseline (wifi and Fast 4G) | |
| Fast 4G, Driftwood | ≤ 22 s (bench.budget.json's row) — **the user is deciding** | **23.7 s phone / 23.1 s desktop: missed** |
| Fast 4G, Pine Hollow phone | ≤ 40 s (bench.budget.json's row is the phone tier; desktop is held to no worse) | 34.5 s (desktop 83.3 s) |
| Fast 4G, Nalati | ≤ 35.5 s phone, ≤ 40.8 s desktop (the first baseline + its band) | 31.1 / 37.2 s |
| warm time to play, switch times | no worse than the baseline; *improve* is the printed goal | |
| re-download after a one-texture change | ≤ 2 MB — **the user is deciding** | 1.42 MiB phone / 1.40 MiB desktop: met, **but only because the phone boot packs are broken on this main** (below) |

**The phone boot packs on main 5486794 (and in production):** `scripts/bake-packs.mjs` cannot load
`src/core/shardScope.ts` (a TypeScript parameter property, which node's type stripping rejects), so a clean build emits
no pack parts; the build only warns, every part 404s, and the phone boots one request per packed file. Fixed by 80dfc2c
(on the scorecard branch). With packs served, the one-texture change re-downloads the pack part that holds the file:
3.83 MiB on the phone (a 2.6 MiB part + the 1.1 MiB code bundle), which misses the 2 MB rule. The scorecard checks the
served parts before every run and says so at the head of the report.

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
