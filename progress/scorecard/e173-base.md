# scorecard e173-base — build b-muhyz9be, 2026-09-26 06:07

http://localhost:4281 · headless Chromium, ANGLE Metal, muted · network wifi (service worker throttled too) · CPU 1× · 1 run · 10 s of frames per pose · darwin arm64 node v24.18.1

Boot pack parts: all 11 served.

## load

| shard / viewport | cold MB to play | cold req | background MB after play (info) | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |
|---|---|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 20.79 | 227 | 121.01 | 7.03 | 24.30 | 405 | 0.00 | 231 | 1.88 | 393 |
| driftwood-isle/desktop | 22.12 | 233 | 97.48 | 7.66 | 23.63 | 522 | 0.00 | 233 | 2.26 | 543 |
| nalati-grasslands/phone | 29.96 | 235 | 111.84 | 9.13 | 31.65 | 347 | 0.00 | 259 | 3.61 | 394 |
| nalati-grasslands/desktop | 36.09 | 271 | 83.50 | 12.08 | 37.76 | 1634 | 0.00 | 271 | 5.98 | 1426 |
| pine-hollow/phone | 36.31 | 149 | 105.50 | 10.68 | 35.18 | 453 | 0.00 | 248 | 2.13 | 295 |
| pine-hollow/desktop | 91.53 | 277 | 28.06 | 28.45 | 84.14 | 1070 | 0.00 | 277 | 3.43 | 735 |

## memory (warm page, settled, after GC)

| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 34.37 | 117.24 | 0.33 | 136.21 | 31.53 | 102 | 454 | 94 |
| driftwood-isle/desktop | 36.55 | 370.09 | 7.19 | 252.42 | 59.03 | 127 | 920 | 105 |
| nalati-grasslands/phone | 46.64 | 96.97 | 39.16 | 64.70 | 112.46 | 127 | 114 | 96 |
| nalati-grasslands/desktop | 48.24 | 450.23 | 75.41 | 70.15 | 334.46 | 161 | 366 | 112 |
| pine-hollow/phone | 45.32 | 279.05 | 0.00 | 38.28 | 283.22 | 403 | 219 | 106 |
| pine-hollow/desktop | 47.76 | 1205.21 | 6.87 | 164.80 | 767.55 | 451 | 278 | 113 |

## runtime + look (per pose)

| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |
|---|---|---|---|---|---|---|
| driftwood-isle/phone/pier | 30.0 | 34.2 | 2.1 / 3.8 | 224 | 1101.2 | 0.9848 |
| driftwood-isle/phone/beach | 30.0 | 33.8 | 2.1 / 2.9 | 219 | 1054.7 | 0.9964 |
| driftwood-isle/phone/wreck | 30.0 | 34.0 | 2.1 / 2.4 | 171 | 927 | 0.9933 |
| driftwood-isle/desktop/pier | 60.0 | 17.7 | 3.6 / 4.3 | 868 | 2980.7 | 0.9941 |
| driftwood-isle/desktop/beach | 60.0 | 17.7 | 3.5 / 4.1 | 567 | 2309.1 | 0.9976 |
| driftwood-isle/desktop/wreck | 60.0 | 17.4 | 3.2 / 3.7 | 239 | 1452.3 | 0.9934 |
| nalati-grasslands/phone/camp | 30.0 | 33.8 | 1.9 / 2.3 | 77 | 983.2 | 0.9969 |
| nalati-grasslands/phone/bridge | 30.0 | 34.4 | 1.9 / 2.4 | 87 | 1228.9 | 0.9884 |
| nalati-grasslands/phone/plains | 30.0 | 34.7 | 2.3 / 3.4 | 100 | 1216.8 | 0.9362 |
| nalati-grasslands/desktop/camp | 60.0 | 17.5 | 2.4 / 3.0 | 195 | 4297.8 | 0.9949 |
| nalati-grasslands/desktop/bridge | 60.0 | 17.6 | 3.6 / 4.4 | 430 | 5979.9 | 0.9944 |
| nalati-grasslands/desktop/plains | 60.0 | 17.7 | 2.8 / 3.5 | 268 | 5986.3 | 0.9553 |
| pine-hollow/phone/gate | 30.0 | 34.2 | 2.5 / 4.9 | 99 | 1101.3 | 0.9881 |
| pine-hollow/phone/cabin | 30.0 | 34.1 | 2.7 / 3.2 | 141 | 1305.1 | 0.9777 |
| pine-hollow/phone/pond | 30.0 | 34.4 | 2.4 / 2.9 | 88 | 888.5 | 0.9757 |
| pine-hollow/desktop/gate | 60.0 | 17.5 | 8.5 / 9.2 | 235 | 8355.8 | 0.9685 |
| pine-hollow/desktop/cabin | 60.0 | 17.3 | 7.5 / 8.4 | 269 | 7954.3 | 0.9627 |
| pine-hollow/desktop/pond | 60.0 | 17.5 | 4.9 / 5.6 | 176 | 4939.8 | 0.9713 |

## switch route (menu → ENTER WORLD on another card → playable; a shard built in the page lands on its title first)

| viewport / switch | kind | s to playable | s to first frame | navigated | loading screen | MB downloaded | longest task ms | heap MB after | GPU tex MB after (running / all resident) |
|---|---|---|---|---|---|---|---|---|---|
| phone/1.driftwood-isle>nalati-grasslands | build | 3.35 | 3.44 | no | yes | 0.00 | 351 | 65.98 | 96.97 / 136.13 |
| phone/2.nalati-grasslands>driftwood-isle | rebuild | 1.69 | 1.79 | no | yes | 0.00 | 381 | 81.77 | 117.24 / 117.56 |
| phone/3.driftwood-isle>pine-hollow | build | 1.89 | 2.11 | no | yes | 0.00 | 284 | 110.47 | 279.05 / 279.05 |
| phone/4.pine-hollow>nalati-grasslands | rebuild | 2.49 | 2.58 | no | yes | 0.00 | 310 | 134.42 | 96.97 / 136.13 |
| desktop/1.driftwood-isle>nalati-grasslands | build | 4.59 | 4.66 | no | yes | 0.00 | 1150 | 70.55 | 450.23 / 525.64 |
| desktop/2.nalati-grasslands>driftwood-isle | rebuild | 1.98 | 2.07 | no | yes | 0.00 | 466 | 87.43 | 370.15 / 377.35 |
| desktop/3.driftwood-isle>pine-hollow | build | 3.31 | 3.55 | no | yes | 0.00 | 707 | 116.71 | 1205.27 / 1212.14 |
| desktop/4.pine-hollow>nalati-grasslands | rebuild | 2.86 | 2.94 | no | yes | 0.00 | 309 | 143.24 | 450.23 / 525.64 |

- phone: Cache Storage after all three shards: **146.75 MB**; downloaded after the first play until idle: 121.01 MB
- desktop: Cache Storage after all three shards: **124.52 MB**; downloaded after the first play until idle: 97.48 MB

Units: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.

### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)

| rule | row | baseline | now | limit | verdict |
|---|---|---|---|---|---|
| first-play cold transfer ≤ 1.5× today: Driftwood phone ≤ 30.1 MiB | driftwood-isle/phone/cold.netBytes | — | 20.79 | ≤ 30.14 | pass |
| first-play cold transfer ≤ 1.5× today: Driftwood desktop ≤ 31.6 MiB | driftwood-isle/desktop/cold.netBytes | — | 22.12 | ≤ 31.64 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati phone ≤ 43.4 MiB | nalati-grasslands/phone/cold.netBytes | — | 29.96 | ≤ 43.44 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati desktop ≤ 52.1 MiB | nalati-grasslands/desktop/cold.netBytes | — | 36.09 | ≤ 52.15 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow phone ≤ 53.8 MiB | pine-hollow/phone/cold.netBytes | — | 36.31 | ≤ 53.77 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow desktop ≤ 137.0 MiB | pine-hollow/desktop/cold.netBytes | — | 91.53 | ≤ 137.04 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/phone/cold.netBytes | — | 20.79 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/desktop/cold.netBytes | — | 22.12 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/phone/cold.netBytes | — | 29.96 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/desktop/cold.netBytes | — | 36.09 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/phone/cold.netBytes | — | 36.31 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/desktop/cold.netBytes | — | 91.53 | no baseline | n/a |
| total SW cache, all three shards ≤ 300 MB | switch/phone/cacheStorageBytes | — | 146.75 | ≤ 300.00 | pass |
| total SW cache, all three shards ≤ 300 MB | switch/desktop/cacheStorageBytes | — | 124.52 | ≤ 300.00 | pass |
| cold time-to-play no worse than today | driftwood-isle/phone/cold.playMs | — | 7.03 | no baseline | n/a |
| cold time-to-play no worse than today | driftwood-isle/desktop/cold.playMs | — | 7.66 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/phone/cold.playMs | — | 9.13 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/desktop/cold.playMs | — | 12.08 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/phone/cold.playMs | — | 10.68 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/desktop/cold.playMs | — | 28.45 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/phone/cold4g.playMs | — | 24.30 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/desktop/cold4g.playMs | — | 23.63 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/phone/cold4g.playMs | — | 31.65 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/desktop/cold4g.playMs | — | 37.76 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/phone/cold4g.playMs | — | 35.18 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/desktop/cold4g.playMs | — | 84.14 | no baseline | n/a |
| Driftwood cold time-to-play on 4G ≤ 30 s | driftwood-isle/phone/cold4g.playMs | — | 24.30 | ≤ 30.00 | pass |
| Driftwood cold time-to-play on 4G ≤ 30 s | driftwood-isle/desktop/cold4g.playMs | — | 23.63 | ≤ 30.00 | pass |
| Pine Hollow cold time-to-play on 4G ≤ 40 s (phone) | pine-hollow/phone/cold4g.playMs | — | 35.18 | ≤ 40.00 | pass |
| Nalati cold time-to-play on 4G ≤ 35.5 s (phone) | nalati-grasslands/phone/cold4g.playMs | — | 31.65 | ≤ 35.50 | pass |
| Nalati cold time-to-play on 4G ≤ 40.8 s (desktop) | nalati-grasslands/desktop/cold4g.playMs | — | 37.76 | ≤ 40.80 | pass |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/phone/warm.playMs | — | 1.88 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/desktop/warm.playMs | — | 2.26 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/phone/warm.playMs | — | 3.61 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/desktop/warm.playMs | — | 5.98 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/phone/warm.playMs | — | 2.13 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/desktop/warm.playMs | — | 3.43 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/1.driftwood-isle>nalati-grasslands.ms | — | 3.35 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/2.nalati-grasslands>driftwood-isle.ms | — | 1.69 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/3.driftwood-isle>pine-hollow.ms | — | 1.89 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/4.pine-hollow>nalati-grasslands.ms | — | 2.49 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/1.driftwood-isle>nalati-grasslands.ms | — | 4.59 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/2.nalati-grasslands>driftwood-isle.ms | — | 1.98 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/3.driftwood-isle>pine-hollow.ms | — | 3.31 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/4.pine-hollow>nalati-grasslands.ms | — | 2.86 | no baseline | n/a |
| bytes re-downloaded after a one-texture change ≤ 4 MB | retouch/*/netBytes | | not measured | | n/a (enforced) |
