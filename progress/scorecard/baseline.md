# scorecard baseline — build b-muh8pnvl, 2026-09-25 20:58

http://localhost:4281 · headless Chromium, ANGLE Metal, muted · network wifi (service worker throttled too) · CPU 1× · 2 runs (median; ±x% = half the run-to-run range) · 10 s of frames per pose · darwin arm64 node v24.18.1

## load

| shard / viewport | cold MB to play | cold req | cold MB until idle | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |
|---|---|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 20.10 | 227 | 20.10 | 6.82 <small>±0%</small> | 23.87 <small>±2%</small> | 299.5 <small>±0%</small> | 0.00 | 227 | 1.73 | 286.5 <small>±1%</small> |
| driftwood-isle/desktop | 21.09 | 232 | 21.09 | 7.24 <small>±0%</small> | 22.83 <small>±0%</small> | 352.5 <small>±0%</small> | 0.00 | 232 | 1.88 | 347 |
| nalati-grasslands/phone | 28.96 | 232 | 28.96 | 9.23 <small>±0%</small> | 32.00 <small>±0%</small> | 333 | 0.00 | 232 | 3.13 | 324 <small>±0%</small> |
| nalati-grasslands/desktop | 34.76 | 268 | 34.76 | 11.07 <small>±0%</small> | 37.02 <small>±0%</small> | 1118 | 0.00 | 268 | 4.33 | 1108.5 <small>±0%</small> |
| pine-hollow/phone | 35.84 | 145 | 35.84 | 10.50 <small>±0%</small> | 35.31 | 295 <small>±0%</small> | 0.00 | 144 | 2.08 | 283 <small>±0%</small> |
| pine-hollow/desktop | 91.36 | 279 | 91.36 | 27.47 <small>±0%</small> | 83.30 | 706.5 <small>±2%</small> | 2.13 | 279 | 3.50 <small>±0%</small> | 692.5 <small>±0%</small> |

## memory (warm page, settled, after GC)

| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 33.34 | 285.73 | 0.33 | 100.87 | 39.03 | 109 | 407 | 97 |
| driftwood-isle/desktop | 34.35 | 370.09 | 7.19 | 190.66 | 59.03 | 127 | 760 | 104 |
| nalati-grasslands/phone | 45.41 <small>±1%</small> | 129.89 | 39.16 | 64.70 | 122.07 | 127 | 114 | 96 |
| nalati-grasslands/desktop | 47.23 <small>±0%</small> | 450.23 | 75.41 | 70.15 | 334.46 | 161 | 366 | 112 |
| pine-hollow/phone | 43.63 | 558.71 | 0.00 | 38.28 | 362.55 | 406 | 219 | 106 |
| pine-hollow/desktop | 46.16 | 1205.21 | 6.87 | 164.80 | 767.55 | 451 | 278 | 113 |

## runtime + look (per pose)

| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |
|---|---|---|---|---|---|---|
| driftwood-isle/phone/pier | 60.0 | 17.9 <small>±2%</small> | 2.5 <small>±6%</small> / 3.5 <small>±1%</small> | 232 | 1100 | 0.9872 <small>±1%</small> |
| driftwood-isle/phone/beach | 60.0 | 17.8 <small>±2%</small> | 2.6 <small>±8%</small> / 3.5 | 231 | 1143 | 0.9986 <small>±0%</small> |
| driftwood-isle/phone/wreck | 60.0 | 17.4 | 2.7 / 3.5 <small>±1%</small> | 179.5 <small>±0%</small> | 915.3 | 0.9922 <small>±0%</small> |
| driftwood-isle/desktop/pier | 60.0 | 17.0 | 3.5 <small>±1%</small> / 4.0 <small>±1%</small> | 862 | 2980.8 | 0.9904 <small>±0%</small> |
| driftwood-isle/desktop/beach | 60.0 | 17.1 | 3.3 / 3.8 | 568 | 2479.1 | 0.9916 <small>±0%</small> |
| driftwood-isle/desktop/wreck | 60.0 | 17.6 <small>±3%</small> | 3.0 <small>±2%</small> / 4.2 | 239 | 1462.2 | 0.9860 <small>±1%</small> |
| nalati-grasslands/phone/camp | 60.0 | 17.7 <small>±1%</small> | 2.7 / 3.6 <small>±3%</small> | 77 | 983.2 | 0.9947 <small>±0%</small> |
| nalati-grasslands/phone/bridge | 60.0 | 17.9 | 2.6 / 3.8 <small>±1%</small> | 87 | 1228.9 | 0.9953 <small>±0%</small> |
| nalati-grasslands/phone/plains | 60.0 | 17.9 <small>±3%</small> | 2.8 <small>±2%</small> / 3.6 <small>±4%</small> | 105 | 1238.5 | 0.9652 <small>±2%</small> |
| nalati-grasslands/desktop/camp | 60.0 | 17.4 <small>±0%</small> | 2.8 <small>±2%</small> / 4.0 <small>±1%</small> | 195 | 4297.8 | 0.9944 <small>±0%</small> |
| nalati-grasslands/desktop/bridge | 60.0 | 17.3 | 3.0 / 4.1 | 430 | 5979.9 | 0.9914 <small>±0%</small> |
| nalati-grasslands/desktop/plains | 60.0 | 17.4 <small>±1%</small> | 3.0 <small>±2%</small> / 3.9 <small>±3%</small> | 268 | 5991.5 <small>±0%</small> | 0.9702 <small>±2%</small> |
| pine-hollow/phone/gate | 30.0 | 35.4 <small>±1%</small> | 4.4 <small>±1%</small> / 6.1 <small>±3%</small> | 99 | 1101.3 | 0.9880 <small>±1%</small> |
| pine-hollow/phone/cabin | 30.0 | 35.0 <small>±0%</small> | 4.9 / 6.3 <small>±1%</small> | 141 | 1301 <small>±0%</small> | 0.9882 <small>±1%</small> |
| pine-hollow/phone/pond | 30.0 | 35.1 | 4.3 <small>±3%</small> / 6.3 <small>±2%</small> | 88 | 888.5 | 0.9844 <small>±1%</small> |
| pine-hollow/desktop/gate | 60.0 | 17.9 | 8.7 <small>±1%</small> / 9.2 <small>±2%</small> | 235 | 8355.8 | 0.9567 <small>±2%</small> |
| pine-hollow/desktop/cabin | 60.0 | 17.2 | 7.7 <small>±1%</small> / 8.0 <small>±1%</small> | 269 | 7972.3 <small>±0%</small> | 0.9475 <small>±3%</small> |
| pine-hollow/desktop/pond | 60.0 | 17.2 | 5.0 <small>±2%</small> / 5.4 <small>±3%</small> | 176 | 4957 <small>±0%</small> | 0.9564 <small>±2%</small> |

## switch route (A → menu → B …, from ENTER WORLD to playable)

| viewport / switch | s | navigated | loading screen | MB downloaded | longest task ms | heap MB after | GPU tex MB after |
|---|---|---|---|---|---|---|---|
| phone/1.driftwood-isle>nalati-grasslands | 4.25 | yes | yes | 12.38 | 336 <small>±1%</small> | 48.31 <small>±1%</small> | 129.89 |
| phone/2.nalati-grasslands>pine-hollow | 7.50 <small>±0%</small> | yes | yes | 25.11 | 344.5 <small>±0%</small> | 47.10 <small>±0%</small> | 555.38 |
| phone/3.pine-hollow>driftwood-isle | 1.62 <small>±1%</small> | yes | yes | 0.00 | 289 <small>±0%</small> | 32.37 <small>±2%</small> | 285.73 |
| desktop/1.driftwood-isle>nalati-grasslands | 6.56 | yes | yes | 17.38 | 1132 <small>±1%</small> | 51.45 <small>±0%</small> | 450.23 |
| desktop/2.nalati-grasslands>pine-hollow | 24.20 | yes | yes | 79.82 | 689.5 <small>±0%</small> | 49.06 <small>±1%</small> | 1205.21 |
| desktop/3.pine-hollow>driftwood-isle | 3.66 <small>±0%</small> | yes | yes | 1.70 | 350 <small>±1%</small> | 34.52 | 370.09 |

- phone: Cache Storage after all three shards: **66.72 MB**; downloaded after the first play until idle: 0.00 MB
- desktop: Cache Storage after all three shards: **127.53 MB**; downloaded after the first play until idle: 0.00 MB

## one-texture change (/assets/tex/leafy_grass/nor_gl_1k.jpg)

- retouch/phone/netBytes: **19.70 MB** re-downloaded by a returning player ([["/assets/packs/pine-hollow.phone-7145ca56.bin",18685572],["/assets/main-CaSLlwBI.js",1116519],["/icon-512.png",290202],["/assets/baked/pine-hollow/navmesh.bin",170843],["/icon-192.png",57854]])
- retouch/desktop/netBytes: **2.51 MB** re-downloaded by a returning player ([["/assets/main-CaSLlwBI.js",1116519],["/assets/baked/pine-hollow/terrain.bin",537975],["/icon-512.png",290202],["/assets/baked/pine-hollow/navmesh.bin",170843],["/assets/baked/pine-hollow/tex/clouds.jpg",63536]])

## noise (run to run)

| kind | rows | median spread | max spread | the noisiest row |
|---|---|---|---|---|
| bytes | 26 | 0.0 % | 0.0 % | switch/desktop/cacheStorageBytes |
| count | 12 | 0.0 % | 0.0 % | pine-hollow/desktop/warm.requests |
| time | 24 | 0.2 % | 3.3 % | driftwood-isle/phone/cold4g.playMs |
| longtask | 18 | 0.7 % | 4.7 % | pine-hollow/desktop/cold.longTaskMaxMs |
| memory | 42 | 0.0 % | 4.4 % | switch/phone/3.pine-hollow>driftwood-isle.heapBytes |
| objects | 18 | 0.0 % | 0.0 % | pine-hollow/desktop/mem.programs |
| fps | 18 | 0.0 % | 0.0 % | pine-hollow/desktop/pose.pond.fps |
| frame | 54 | 2.4 % | 15.4 % | driftwood-isle/phone/pose.beach.cpuP50Ms |
| drawcalls | 36 | 0.0 % | 0.6 % | pine-hollow/phone/pose.cabin.trisK |
| ssim (run 2 vs run 1's golden) | 18 | 0.9881 | min 0.9475 | pine-hollow/desktop/pose.cabin.ssim |

Units: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.

### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)

| rule | row | baseline | now | limit | verdict |
|---|---|---|---|---|---|
| first-play cold transfer ≤ 1.5× today: Driftwood phone ≤ 30.1 MiB | driftwood-isle/phone/cold.netBytes | — | 20.10 | ≤ 30.14 | pass |
| first-play cold transfer ≤ 1.5× today: Driftwood desktop ≤ 31.6 MiB | driftwood-isle/desktop/cold.netBytes | — | 21.09 | ≤ 31.64 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati phone ≤ 43.4 MiB | nalati-grasslands/phone/cold.netBytes | — | 28.96 | ≤ 43.44 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati desktop ≤ 52.1 MiB | nalati-grasslands/desktop/cold.netBytes | — | 34.76 | ≤ 52.15 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow phone ≤ 53.8 MiB | pine-hollow/phone/cold.netBytes | — | 35.84 | ≤ 53.77 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow desktop ≤ 137.0 MiB | pine-hollow/desktop/cold.netBytes | — | 91.36 | ≤ 137.04 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/phone/cold.netBytes | — | 20.10 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/desktop/cold.netBytes | — | 21.09 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/phone/cold.netBytes | — | 28.96 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/desktop/cold.netBytes | — | 34.76 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/phone/cold.netBytes | — | 35.84 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/desktop/cold.netBytes | — | 91.36 | no baseline | n/a |
| total SW cache, all three shards ≤ 300 MB | switch/phone/cacheStorageBytes | — | 66.72 | ≤ 300.00 | pass |
| total SW cache, all three shards ≤ 300 MB | switch/desktop/cacheStorageBytes | — | 127.53 | ≤ 300.00 | pass |
| cold time-to-play no worse than today | driftwood-isle/phone/cold.playMs | — | 6.82 | no baseline | n/a |
| cold time-to-play no worse than today | driftwood-isle/desktop/cold.playMs | — | 7.24 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/phone/cold.playMs | — | 9.23 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/desktop/cold.playMs | — | 11.07 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/phone/cold.playMs | — | 10.50 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/desktop/cold.playMs | — | 27.47 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/phone/cold4g.playMs | — | 23.87 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/desktop/cold4g.playMs | — | 22.83 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/phone/cold4g.playMs | — | 32.00 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/desktop/cold4g.playMs | — | 37.02 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/phone/cold4g.playMs | — | 35.31 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/desktop/cold4g.playMs | — | 83.30 | no baseline | n/a |
| Driftwood cold time-to-play on 4G ≤ 22 s | driftwood-isle/phone/cold4g.playMs | — | 23.87 | ≤ 22.00 | **FAIL** |
| Driftwood cold time-to-play on 4G ≤ 22 s | driftwood-isle/desktop/cold4g.playMs | — | 22.83 | ≤ 22.00 | **FAIL** |
| Pine Hollow cold time-to-play on 4G ≤ 40 s (phone) | pine-hollow/phone/cold4g.playMs | — | 35.31 | ≤ 40.00 | pass |
| Nalati cold time-to-play on 4G ≤ 35.5 s (phone) | nalati-grasslands/phone/cold4g.playMs | — | 32.00 | ≤ 35.50 | pass |
| Nalati cold time-to-play on 4G ≤ 40.8 s (desktop) | nalati-grasslands/desktop/cold4g.playMs | — | 37.02 | ≤ 40.80 | pass |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/phone/warm.playMs | — | 1.73 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/desktop/warm.playMs | — | 1.88 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/phone/warm.playMs | — | 3.13 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/desktop/warm.playMs | — | 4.33 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/phone/warm.playMs | — | 2.08 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/desktop/warm.playMs | — | 3.50 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/1.driftwood-isle>nalati-grasslands.ms | — | 4.25 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/2.nalati-grasslands>pine-hollow.ms | — | 7.50 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/3.pine-hollow>driftwood-isle.ms | — | 1.62 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/1.driftwood-isle>nalati-grasslands.ms | — | 6.56 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/2.nalati-grasslands>pine-hollow.ms | — | 24.20 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/3.pine-hollow>driftwood-isle.ms | — | 3.66 | no baseline | n/a |
| bytes re-downloaded after a one-texture change ≤ 2 MB | retouch/phone/netBytes | — | 19.70 | ≤ 2.00 | **FAIL** |
| bytes re-downloaded after a one-texture change ≤ 2 MB | retouch/desktop/netBytes | — | 2.51 | ≤ 2.00 | **FAIL** |
