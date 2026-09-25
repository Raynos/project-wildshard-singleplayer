# scorecard baseline — build b-muhhtndx, 2026-09-25 22:48

http://localhost:4281 · headless Chromium, ANGLE Metal, muted · network wifi (service worker throttled too) · CPU 1× · 2 runs (median; ±x% = half the run-to-run range) · 10 s of frames per pose · darwin arm64 node v24.18.1

> **Boot pack parts not served: 11 of 11** (/assets/packs/driftwood-isle.phone-184f64ed.bin, /assets/packs/pine-hollow.phone-b6230b66.bin, /assets/packs/pine-hollow.phone-9ca3d479.bin, /assets/packs/pine-hollow.phone-2eb2d4df.bin…). The bake failed at build time; the boot fetches every packed file on its own.

## load

| shard / viewport | cold MB to play | cold req | background MB after play (info) | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |
|---|---|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 20.39 | 228 | 98.25 | 6.97 <small>±0%</small> | 23.65 <small>±5%</small> | 345.5 <small>±0%</small> | 0.00 | 230 | 1.83 | 346.5 <small>±0%</small> |
| driftwood-isle/desktop | 21.39 | 230 | 97.48 | 7.37 <small>±0%</small> | 23.13 <small>±0%</small> | 424.5 <small>±1%</small> | 0.00 | 230 | 2.00 <small>±1%</small> | 421 <small>±0%</small> |
| nalati-grasslands/phone | 29.41 | 266 | 93.83 | 9.12 <small>±0%</small> | 31.05 | 334.5 <small>±0%</small> | 0.00 | 269 | 3.14 <small>±0%</small> | 336 |
| nalati-grasslands/desktop | 35.36 | 268 | 83.50 | 11.16 <small>±0%</small> | 37.17 | 1121 <small>±1%</small> | 0.00 | 268 | 4.36 | 1094.5 <small>±0%</small> |
| pine-hollow/phone | 34.23 | 260 | 99.73 | 11.17 <small>±0%</small> | 34.52 | 302.5 <small>±1%</small> | 0.00 | 265 | 2.07 <small>±1%</small> | 284.5 <small>±0%</small> |
| pine-hollow/desktop | 90.80 | 274 | 28.06 | 27.51 <small>±0%</small> | 83.28 | 693 <small>±0%</small> | 0.00 | 274 | 3.32 <small>±1%</small> | 717 <small>±3%</small> |

## memory (warm page, settled, after GC)

| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 34.71 <small>±0%</small> | 264.23 | 0.33 | 109.02 | 31.53 | 109 | 424 | 98 |
| driftwood-isle/desktop | 36.25 | 370.09 | 7.19 | 194.34 | 59.03 | 127 | 772 | 105 |
| nalati-grasslands/phone | 45.89 <small>±0%</small> | 96.97 | 39.16 | 64.70 | 112.46 | 127 | 114 | 96 |
| nalati-grasslands/desktop | 48.92 <small>±1%</small> | 450.23 | 75.41 | 70.15 | 334.46 | 161 | 366 | 112 |
| pine-hollow/phone | 46.06 <small>±0%</small> | 279.05 | 0.00 | 38.28 | 283.22 | 403 | 219 | 106 |
| pine-hollow/desktop | 48.36 <small>±1%</small> | 1205.21 | 6.87 | 164.80 | 767.55 | 451 | 278 | 113 |

## runtime + look (per pose)

| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |
|---|---|---|---|---|---|---|
| driftwood-isle/phone/pier | 60.0 | 17.8 <small>±3%</small> | 2.6 <small>±4%</small> / 3.4 | 233 | 1102.3 | 0.9878 <small>±1%</small> |
| driftwood-isle/phone/beach | 60.0 | 17.6 <small>±2%</small> | 2.7 / 3.5 <small>±1%</small> | 228 | 1055.8 | 0.9987 <small>±0%</small> |
| driftwood-isle/phone/wreck | 60.0 | 17.9 <small>±3%</small> | 2.7 / 3.3 <small>±1%</small> | 180 | 928.2 | 0.9981 <small>±0%</small> |
| driftwood-isle/desktop/pier | 60.0 | 17.6 <small>±1%</small> | 3.5 / 4.0 <small>±1%</small> | 868 | 2980.7 | 0.9913 <small>±0%</small> |
| driftwood-isle/desktop/beach | 60.0 | 17.3 <small>±1%</small> | 3.3 / 3.8 <small>±1%</small> | 567 | 2309.1 | 0.9930 <small>±0%</small> |
| driftwood-isle/desktop/wreck | 60.0 | 17.3 | 3.0 / 4.3 <small>±1%</small> | 239 | 1452.3 | 0.9885 <small>±1%</small> |
| nalati-grasslands/phone/camp | 60.0 | 18.2 <small>±1%</small> | 2.6 / 3.8 <small>±1%</small> | 77 | 983.2 | 0.9995 |
| nalati-grasslands/phone/bridge | 60.0 | 18.4 <small>±2%</small> | 2.5 <small>±2%</small> / 3.9 <small>±3%</small> | 87 | 1228.9 | 0.9936 <small>±0%</small> |
| nalati-grasslands/phone/plains | 60.0 | 17.8 <small>±2%</small> | 2.8 <small>±2%</small> / 3.6 <small>±3%</small> | 102 | 1225 | 0.9834 <small>±1%</small> |
| nalati-grasslands/desktop/camp | 60.0 | 17.4 <small>±1%</small> | 2.7 / 4.0 | 195 | 4297.8 | 0.9892 <small>±1%</small> |
| nalati-grasslands/desktop/bridge | 60.0 | 17.9 <small>±3%</small> | 3.0 / 4.1 | 430 | 5979.9 | 0.9891 <small>±1%</small> |
| nalati-grasslands/desktop/plains | 60.0 | 17.6 <small>±2%</small> | 3.0 <small>±2%</small> / 4.0 <small>±1%</small> | 268 | 5987.2 <small>±0%</small> | 0.9927 <small>±0%</small> |
| pine-hollow/phone/gate | 30.0 | 35.2 <small>±0%</small> | 4.3 <small>±4%</small> / 6.2 <small>±2%</small> | 99 | 1101.3 | 0.9836 <small>±1%</small> |
| pine-hollow/phone/cabin | 30.0 | 34.8 <small>±0%</small> | 5.0 <small>±1%</small> / 6.3 <small>±2%</small> | 140.5 <small>±0%</small> | 1303.6 <small>±0%</small> | 0.9725 <small>±1%</small> |
| pine-hollow/phone/pond | 30.0 | 35.3 <small>±1%</small> | 4.3 <small>±1%</small> / 6.2 <small>±2%</small> | 88 | 885.6 <small>±0%</small> | 0.9736 <small>±1%</small> |
| pine-hollow/desktop/gate | 60.0 | 17.9 <small>±3%</small> | 8.5 / 8.9 <small>±1%</small> | 235 | 8355.8 | 0.9589 <small>±2%</small> |
| pine-hollow/desktop/cabin | 60.0 | 17.9 <small>±3%</small> | 7.5 <small>±1%</small> / 8.1 <small>±1%</small> | 269 | 7969.4 <small>±0%</small> | 0.9550 <small>±2%</small> |
| pine-hollow/desktop/pond | 60.0 | 17.3 <small>±1%</small> | 4.8 <small>±1%</small> / 5.3 <small>±1%</small> | 175.5 <small>±0%</small> | 4958 | 0.9632 <small>±2%</small> |

## switch route (menu → ENTER WORLD on another card → playable; a shard built in the page lands on its title first)

| viewport / switch | kind | s to playable | s to first frame | navigated | loading screen | MB downloaded | longest task ms | heap MB after | GPU tex MB after (running / all resident) |
|---|---|---|---|---|---|---|---|---|---|
| phone/1.driftwood-isle>nalati-grasslands | build | 3.13 | 3.19 <small>±0%</small> | no | yes | 2.68 | 345.5 <small>±0%</small> | 67.73 <small>±0%</small> | 75.64 / 400.86 |
| phone/2.nalati-grasslands>driftwood-isle | resident | 0.07 <small>±24%</small> | 0.13 <small>±6%</small> | no | no | 0.00 | 0 | 67.55 <small>±0%</small> | 285.73 / 400.86 |
| phone/3.driftwood-isle>pine-hollow | build | 3.60 <small>±2%</small> | 3.76 <small>±0%</small> | no | yes | 6.12 | 276.5 <small>±0%</small> | 97.11 <small>±1%</small> | 279.05 / 565.11 |
| phone/4.pine-hollow>nalati-grasslands | rebuild | 2.43 <small>±1%</small> | 2.50 <small>±0%</small> | no | yes | 0.00 | 299 <small>±1%</small> | 121.65 <small>±0%</small> | 96.97 / 415.18 |
| desktop/1.driftwood-isle>nalati-grasslands | build | 4.54 <small>±0%</small> | 4.61 <small>±0%</small> | no | yes | 0.00 | 1099 <small>±0%</small> | 72.26 <small>±0%</small> | 450.23 / 902.92 |
| desktop/2.nalati-grasslands>driftwood-isle | resident | 0.06 <small>±1%</small> | 0.12 <small>±1%</small> | no | no | 0.00 | 0 | 71.70 | 370.09 / 902.92 |
| desktop/3.driftwood-isle>pine-hollow | build | 3.24 <small>±0%</small> | 3.46 <small>±0%</small> | no | yes | 0.00 | 689.5 <small>±0%</small> | 102.51 <small>±0%</small> | 1205.27 / 1589.42 |
| desktop/4.pine-hollow>nalati-grasslands | rebuild | 2.75 <small>±1%</small> | 2.82 <small>±1%</small> | no | yes | 0.00 | 298.5 <small>±1%</small> | 128.76 <small>±0%</small> | 450.23 / 1737.71 |

- phone: Cache Storage after all three shards: **132.49 MB**; downloaded after the first play until idle: 98.25 MB
- desktop: Cache Storage after all three shards: **123.76 MB**; downloaded after the first play until idle: 97.48 MB

## one-texture change (/assets/hdri/qwantani_mid_morning_puresky_2k.key.jpg)

A re-download is a file build A had already fetched (the edited file, the code bundle every build re-stamps); files A never fetched (a sound first played in B) are in the second figure only.

- retouch/phone/netBytes: **1.42 MB** re-downloaded by a returning player; 1.42 MB downloaded in all ([["/assets/main-Cs2zspkr.js",1174650],["/assets/hdri/qwantani_mid_morning_puresky_2k.key.jpg?v=b4089371",178272],["/assets/tier-2Rywt6t4.js",28114],["/assets/BlenderIsland-KOP2sCYN.js",19809],["/assets/Explore-CzWFkl5_.js",18731]])
- retouch/desktop/netBytes: **1.40 MB** re-downloaded by a returning player; 1.40 MB downloaded in all ([["/assets/main-Cs2zspkr.js",1174650],["/assets/hdri/qwantani_mid_morning_puresky_2k.key.jpg?v=b4089371",178272],["/assets/tier-2Rywt6t4.js",28114],["/assets/BlenderIsland-KOP2sCYN.js",19809],["/assets/Explore-CzWFkl5_.js",18731]])

## noise (run to run)

| kind | rows | median spread | max spread | the noisiest row |
|---|---|---|---|---|
| bytes | 22 | 0.0 % | 0.0 % | switch/desktop/cacheStorageBytes |
| count | 12 | 0.0 % | 0.0 % | pine-hollow/desktop/warm.requests |
| time | 34 | 0.5 % | 47.3 % | switch/phone/2.nalati-grasslands>driftwood-isle.ms |
| longtask | 20 | 0.6 % | 5.3 % | pine-hollow/desktop/warm.longTaskMaxMs |
| memory | 54 | 0.0 % | 1.8 % | nalati-grasslands/desktop/mem.heapBytes |
| objects | 18 | 0.0 % | 0.0 % | pine-hollow/desktop/mem.programs |
| fps | 18 | 0.0 % | 0.0 % | pine-hollow/desktop/pose.pond.fps |
| frame | 54 | 2.3 % | 8.2 % | pine-hollow/phone/pose.gate.cpuP50Ms |
| drawcalls | 36 | 0.0 % | 0.9 % | pine-hollow/phone/pose.cabin.trisK |
| ssim (run 2 vs run 1's golden) | 18 | 0.9888 | min 0.9550 | pine-hollow/desktop/pose.cabin.ssim |

Units: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.

### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)

| rule | row | baseline | now | limit | verdict |
|---|---|---|---|---|---|
| first-play cold transfer ≤ 1.5× today: Driftwood phone ≤ 30.1 MiB | driftwood-isle/phone/cold.netBytes | — | 20.39 | ≤ 30.14 | pass |
| first-play cold transfer ≤ 1.5× today: Driftwood desktop ≤ 31.6 MiB | driftwood-isle/desktop/cold.netBytes | — | 21.39 | ≤ 31.64 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati phone ≤ 43.4 MiB | nalati-grasslands/phone/cold.netBytes | — | 29.41 | ≤ 43.44 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati desktop ≤ 52.1 MiB | nalati-grasslands/desktop/cold.netBytes | — | 35.36 | ≤ 52.15 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow phone ≤ 53.8 MiB | pine-hollow/phone/cold.netBytes | — | 34.23 | ≤ 53.77 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow desktop ≤ 137.0 MiB | pine-hollow/desktop/cold.netBytes | — | 90.80 | ≤ 137.04 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/phone/cold.netBytes | — | 20.39 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/desktop/cold.netBytes | — | 21.39 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/phone/cold.netBytes | — | 29.41 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/desktop/cold.netBytes | — | 35.36 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/phone/cold.netBytes | — | 34.23 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/desktop/cold.netBytes | — | 90.80 | no baseline | n/a |
| total SW cache, all three shards ≤ 300 MB | switch/phone/cacheStorageBytes | — | 132.49 | ≤ 300.00 | pass |
| total SW cache, all three shards ≤ 300 MB | switch/desktop/cacheStorageBytes | — | 123.76 | ≤ 300.00 | pass |
| cold time-to-play no worse than today | driftwood-isle/phone/cold.playMs | — | 6.97 | no baseline | n/a |
| cold time-to-play no worse than today | driftwood-isle/desktop/cold.playMs | — | 7.37 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/phone/cold.playMs | — | 9.12 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/desktop/cold.playMs | — | 11.16 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/phone/cold.playMs | — | 11.17 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/desktop/cold.playMs | — | 27.51 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/phone/cold4g.playMs | — | 23.65 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/desktop/cold4g.playMs | — | 23.13 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/phone/cold4g.playMs | — | 31.05 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/desktop/cold4g.playMs | — | 37.17 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/phone/cold4g.playMs | — | 34.52 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/desktop/cold4g.playMs | — | 83.28 | no baseline | n/a |
| Driftwood cold time-to-play on 4G ≤ 22 s | driftwood-isle/phone/cold4g.playMs | — | 23.65 | ≤ 22.00 | **FAIL** |
| Driftwood cold time-to-play on 4G ≤ 22 s | driftwood-isle/desktop/cold4g.playMs | — | 23.13 | ≤ 22.00 | **FAIL** |
| Pine Hollow cold time-to-play on 4G ≤ 40 s (phone) | pine-hollow/phone/cold4g.playMs | — | 34.52 | ≤ 40.00 | pass |
| Nalati cold time-to-play on 4G ≤ 35.5 s (phone) | nalati-grasslands/phone/cold4g.playMs | — | 31.05 | ≤ 35.50 | pass |
| Nalati cold time-to-play on 4G ≤ 40.8 s (desktop) | nalati-grasslands/desktop/cold4g.playMs | — | 37.17 | ≤ 40.80 | pass |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/phone/warm.playMs | — | 1.83 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/desktop/warm.playMs | — | 2.00 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/phone/warm.playMs | — | 3.14 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/desktop/warm.playMs | — | 4.36 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/phone/warm.playMs | — | 2.07 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/desktop/warm.playMs | — | 3.32 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/1.driftwood-isle>nalati-grasslands.ms | — | 3.13 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/2.nalati-grasslands>driftwood-isle.ms | — | 0.07 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/3.driftwood-isle>pine-hollow.ms | — | 3.60 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/4.pine-hollow>nalati-grasslands.ms | — | 2.43 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/1.driftwood-isle>nalati-grasslands.ms | — | 4.54 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/2.nalati-grasslands>driftwood-isle.ms | — | 0.06 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/3.driftwood-isle>pine-hollow.ms | — | 3.24 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/4.pine-hollow>nalati-grasslands.ms | — | 2.75 | no baseline | n/a |
| bytes re-downloaded after a one-texture change ≤ 2 MB | retouch/phone/netBytes | — | 1.42 | ≤ 2.00 | pass |
| bytes re-downloaded after a one-texture change ≤ 2 MB | retouch/desktop/netBytes | — | 1.40 | ≤ 2.00 | pass |
