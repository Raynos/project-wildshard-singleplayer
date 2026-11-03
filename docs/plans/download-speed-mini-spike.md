# Download speed: from 50 s towards 5 s (mini spike)

**State:** `open` 2026-11-03. Written by a wildshard-v subagent (ask E525). This spike landed only the harness and this
page, no product changes. The rows at the bottom are for the builder. Jake, 2026-11-03: *"50 seconds of downloading is
completely fucked. Figure out how to download fast … see how to download in 5 seconds instead of 50 seconds."*

## The answer in five lines

1. **There was no 33 s code regression.** On an ideal 10 Mb/s link the 10-31 build and today's build replay to the
   same time (48.9 s vs 47.5 s). The 50 s "Application modules" was the Mac's own internet link, not the game.
2. **The download is one barrier.** It fetches the whole spawn set before the engine starts: 18.4 MB wire, 417 files,
   54 MB decoded. At 10 Mb/s that set alone has a floor of 14.8 s, and the real code takes 15.5 s. Request count costs
   only 0.7 s, so bytes are everything.
3. **A 5 s download at the phone preset means at most ~5.5 MB before control, packed.** Measured: a 6 MB set with its
   small files bundled takes 4.97 s, and a 4 MB set takes 3.37 s. Today's set is 3.5× too big.
4. **A 5 s *total* load is impossible at this preset whatever the network does.** With zero bytes (warm cache) the boot
   still takes 35.5 s, and with an infinitely fast network it replays to 29–30 s. That is the 10× CPU throttle.
5. **On Jake's real phone network the download is already small.** Modelled at 100 Mb/s and 30 ms, the spawn set takes
   2.1 s, and 4.4 s at 40 Mb/s. The rest of his wait is CPU.

## First principles (live `8bdf53f`, `phone` preset: 10 Mb/s down, 100 ms latency, CPU 10×)

| what | measured |
| --- | --- |
| wire bytes before control | 20.8 MB in 1,194 requests (16.6 s of pure wire); no request downloaded twice, nothing after control |
| spawn set (`/assets/spawn/driftwood-isle-grid-phone-*.json`) | 417 files, 18.4 MB wire / 54.5 MB decoded; 309 files are < 10 KB (0.6 MB in all) |
| code | JS 2.58 MB (95 files) + wasm 1.10 MB (Rapier 0.84, Basis 0.25) + CSS 0.08 |
| geometry | GLB 6.99 MB (150 files) + bin 4.34 MB (10 files; the biggest is 2.66 MB) |
| textures | KTX2 1.26 MB (one file, already supercompressed: brotli saves 0) + WebP 0.46 + wtt 0.23 |
| data | section and blob JSON 1.10 MB (141 files) |
| HTTP | HTTP/2 on one connection, brotli on everything except KTX2, WebP and tiny files (85 files, 1.75 MB, already compressed) |
| serial depth before the bulk | tap → `/?chunk=` HTML → entry JS → spawn manifest (starts 0.8 s after the tap) → 8 lanes over 417 files |
| read before control | 314–397 of the 417 spawn files are fetched again (from cache) by the boot before control, so the set is not padding: the spawn view reads it |
| CPU | warm (0 bytes) cold-to-control 35.5 s local / 38.3 s live; the replay with a free network gives 29–30 s |

The cold boot is roughly **CPU + download, added together**: the replay with free CPU is 18.9 s, with a free network
29.0 s, and as recorded 47.4 s. Download and CPU barely overlap, because "Application modules" waits for the whole spawn
set (`src/entry.ts` → `startSpawnDownload`, `src/game/boot/spawnDownload.ts`) before the engine runs.

## Why it looked 33 s worse than 10-31

| run | recorded | "Application modules" | replay on an ideal 10 Mb/s link |
| --- | --- | --- | --- |
| live `0f1906e`, 10-31 | 52.5 s | 17.2 s | 48.9 s |
| live `8bdf53f`, 11-03 14:27 | 92.7 s | 50.5 s | 54.1 s |
| live `8bdf53f`, 11-03 14:43 (re-measure) | 77.5 s | 40.1 s | 47.5 s |
| local preview `d4d4b17` (newer), 11-03 14:46 | 53.5 s | 19.8 s | 47.4 s |

The same code served from localhost takes 19.8 s in the modules step, and 40–50 s from live. `phone-loading --live`
puts DevTools throttling on top of the Mac's real internet link. That link measured 15 Mb/s (1.9 MB/s), and other agents
share it. At 14:42 a plain `curl` of the 1.26 MB KTX2 took 14.1 s, and a minute later 0.6 s. Under HTTP/2, one stalled
TCP connection holds every stream: 1 KB files took 5–9 s with 8 in flight and 0 bytes arriving for 10 s at a time.
Bytes before control did not grow (22.2 MB on 10-31, 20.8 MB today). **Cause: measurement noise from the Mac's network,
not a commit.** One real growth to watch: the newer local build's spawn set is 1.8 MB bigger (a new 1.9 MB
`/assets/grid-strip-mesh-*.bin`, worth +1.5 s at the preset), and this spike did not trace it to a commit.

## The harness: `scripts/download-bench/` (no browser, no engine)

`node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/download-bench/main.mjs <command>`

- `link.mjs`: a virtual-time phone link that matches DevTools emulation. Each request waits its latency, then all
  active responses share the bandwidth equally. It can cap connections (HTTP/1.1 = 6). The clock moves only when the
  JS event loop is idle, so the real boot code runs on it in milliseconds with no wall-clock noise.
- `bodies.mjs`: every URL is fetched once from the target with `Accept-Encoding: br, gzip`, and its exact wire size and
  decoded body are kept in `tmp/download-spike/bodies/`, so benchmarks never touch the Mac's link again.
- `spawn`: runs the game's own `downloadSpawnManifest` headless against the virtual link, reading the manifest address
  from the target's HTML. **Live 8bdf53f: 15.47 s.**
- `levers`: replays the same shape with N lanes, packs, deferrals, compression and link presets. Before it reports
  anything it checks that its mirror matches the real module (15.47 s = 15.47 s).
- `replay <phone-loading.json>`: rebuilds the whole recorded boot graph (each request's parent is the request that
  finished last before it started, and the gap between them is CPU), then replays it as recorded, with free CPU, with a
  free network and on faster links.

**How well it predicts:** on the same `d4d4b17` build, the headless spawn phase is 16.8 s and the browser takes 19.1 s
from manifest to modules end (the browser also loads ~0.7 MB of JS at the same time under 10× CPU). The replay
predicts 47.4 s for a recorded cold run of 53.5 s (−11 %), and 34.6 s for a recorded warm run of 35.5 s (−3 %).

## Levers, measured (spawn set of live 8bdf53f, `phone` preset, baseline 15.47 s)

| # | lever | seconds | vs baseline |
| --- | --- | --- | --- |
| 1 | only ≤ 6 MB before control, small files bundled (28 requests) | **4.97** | −10.5 |
| 1b | only ≤ 4 MB before control, bundled (18 requests) | **3.37** | −12.1 |
| 1c | ≤ 6 MB in one pack, started at the title | 1.97 | −13.5 |
| 2 | defer every GLB until after control (−7.0 MB) | 9.87 | −5.6 |
| 3 | defer every bin (−4.3 MB) | 12.03 | −3.4 |
| 4 | start the download on the title for first visits (the title prefetch runs only for a saved last shard) | 12.47 | −3.0 (the harness's 3 s title dwell; more for a real player) |
| 5 | precompressed brotli q11 on every body (18.4 → 15.7 MB) | 13.42 | −2.0 |
| 6 | defer every JS chunk not needed before control (−2.6 MB if all of it) | 12.89 | −2.6 (upper bound) |
| 7 | defer the KTX2 (−1.26 MB) / the JSON (−1.1 MB) / the wasm (−1.4 MB) | 14.46 / 14.10 / 14.57 | −1.0 / −1.4 / −0.9 |
| 8 | 16, 32 or unlimited lanes (instead of 8) | 14.96 | −0.5 (the floor) |
| 9 | bundle files < 64 KB into one pack (49 requests), or 1 / 4 / 16 packs | 14.96 | −0.5 (the floor) |
| 10 | brotli on the KTX2 (1.263 → 1.26 MB) | 15.47 | 0 (already supercompressed) |
| — | HTTP/1.1 with 6 connections (what live does not use) | 16.39 | +0.9: keep HTTP/2 |
| — | 4 lanes | 19.20 | +3.7: never lower the lanes |
| — | the same set on LTE 40 Mb/s / 5G 100 Mb/s | 4.39 / 2.14 | real-phone context |

Bounded rather than replayed:

- **Overlap the download with CPU** (drop the modules barrier and let the engine and home region start while bytes
  stream). Today the exposed download is 47.4 − 29.0 = 18.4 s. The best case is cold ≈ free-network time (29–30 s).
- **Preload or priority hints** for the manifest. The bulk starts 0.8 s after the tap (HTML → entry JS → manifest), so
  at most ~0.8 s to gain.
- **Service-worker precache order.** Not a cold lever: a first visit has no controlling worker, the spawn download
  writes Cache Storage itself, and `sw.js` PREFETCH runs only after playable.
- **HTTP/3.** The DevTools model has no packet loss, so it measures the same as HTTP/2. On a lossy phone link it would
  avoid the head-of-line stall seen above, but this spike did not measure that.

## Rows for the builder (product changes, not landed here)

1. **DS1: a ≤ 5.5 MB spawn set.** Split the bake-time spawn manifest into *before control* (the near view at the spawn
   point: its collider, nearest LOD and the code that runs before the first frame) and *after control*. Stream the rest
   once the player is in. This is the only lever that reaches a 5 s download (rows 1–3: 15.5 → 3.4–5.0 s).
2. **DS2: pack the before-control set.** Concatenate it into one or a few range-free packs (the shardfile `blobs/pack`
   format exists). On its own it is only −0.5 s; combined with DS1 it takes 6 MB from 8.5 s to 5.0 s.
3. **DS3: start the spawn download on the title for first visits**, not only for a saved last shard
   (`startTitlePrefetch`, `src/game/grid/prefetch.ts`): −3 s or more.
4. **DS4: overlap download and CPU.** Drop the "Application modules" wait on the whole set and let engine evaluation and
   home-region CPU run while bytes stream: up to −18 s at the preset (cold towards 29–30 s).
5. **DS5: precompressed brotli q11** for blobs and chunks, if Vercel can serve it (−2.7 MB, −2.0 s). Otherwise skip it.
6. **DS6: run the daily phone-loading against a served build** (`--rev`), or read live numbers as link noise. Add
   `download-bench spawn --base <live>` to the daily so download time is tracked without the Mac's link.
7. **DS7: trace the +1.9 MB `grid-strip-mesh` bin** that entered the spawn set after `8bdf53f` (+1.5 s at the preset).
8. **DS8: CPU, the real wall.** 29–35 s of the cold load is CPU at 10×. A "5 s to play" goal needs the CPU plan, not
   the download plan.
