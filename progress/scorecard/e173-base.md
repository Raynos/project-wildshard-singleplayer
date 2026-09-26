# scorecard e173-base — build b-mui2hmc7, 2026-09-26 07:46

http://localhost:4281 · headless Chromium, ANGLE Metal, muted · network wifi (service worker throttled too) · CPU 1× · 1 run · 10 s of frames per pose · darwin arm64 node v24.18.1

Boot pack parts: all 11 served.

## load

| shard / viewport | cold MB to play | cold req | background MB after play (info) | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |
|---|---|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 20.91 | 228 | 121.01 | 7.05 | 24.51 | 398 | 0.00 | 232 | 1.98 | 417 |
| driftwood-isle/desktop | 22.23 | 234 | 97.48 | 7.68 | 24.01 | 486 | 0.00 | 234 | 2.08 | 481 |
| nalati-grasslands/phone | 30.08 | 236 | 111.84 | 9.20 | 31.84 | 363 | 0.00 | 260 | 3.21 | 345 |
| nalati-grasslands/desktop | 36.21 | 272 | 83.50 | 11.43 | 37.86 | 1191 | 0.00 | 272 | 4.46 | 1139 |
| pine-hollow/phone | 36.42 | 150 | 105.50 | 10.63 | 35.29 | 302 | 0.00 | 249 | 2.13 | 295 |
| pine-hollow/desktop | 91.65 | 278 | 28.06 | 27.80 | 86.66 | 721 | 0.00 | 278 | 3.28 | 724 |

## memory (warm page, settled, after GC)

| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 33.67 | 96.17 | 10.37 | 136.21 | 31.53 | 95 | 454 | 92 |
| driftwood-isle/desktop | 36.11 | 370.09 | 7.19 | 252.42 | 59.03 | 127 | 920 | 105 |
| nalati-grasslands/phone | 46.45 | 96.97 | 39.16 | 64.70 | 112.46 | 127 | 114 | 96 |
| nalati-grasslands/desktop | 48.64 | 450.23 | 75.41 | 70.15 | 334.46 | 161 | 366 | 112 |
| pine-hollow/phone | 46.01 | 279.05 | 0.00 | 38.28 | 283.22 | 403 | 219 | 106 |
| pine-hollow/desktop | 47.86 | 1205.21 | 6.87 | 164.80 | 767.55 | 451 | 278 | 113 |

## runtime + look (per pose)

| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |
|---|---|---|---|---|---|---|
| driftwood-isle/phone/pier | 30.0 | 34.0 | 2.0 / 2.5 | 175.5 | 945.6 | 0.9834 |
| driftwood-isle/phone/beach | 30.0 | 33.8 | 2.0 / 2.6 | 155 | 850.7 | 0.9918 |
| driftwood-isle/phone/wreck | 30.0 | 35.0 | 2.0 / 2.4 | 122 | 819.3 | 0.9932 |
| driftwood-isle/desktop/pier | 60.0 | 17.5 | 3.2 / 4.1 | 868 | 2980.7 | 0.9909 |
| driftwood-isle/desktop/beach | 60.0 | 18.1 | 3.2 / 3.6 | 567 | 2309.1 | 0.9945 |
| driftwood-isle/desktop/wreck | 60.0 | 18.3 | 2.8 / 3.1 | 239 | 1452.3 | 0.9906 |
| nalati-grasslands/phone/camp | 30.0 | 35.2 | 2.3 / 4.0 | 77 | 983.2 | 0.9963 |
| nalati-grasslands/phone/bridge | 30.0 | 35.2 | 2.7 / 5.5 | 87 | 1228.9 | 0.9925 |
| nalati-grasslands/phone/plains | 30.0 | 34.0 | 2.2 / 2.9 | 101 | 1221.3 | 0.9720 |
| nalati-grasslands/desktop/camp | 60.0 | 17.1 | 2.5 / 2.9 | 195 | 4297.8 | 0.9918 |
| nalati-grasslands/desktop/bridge | 60.0 | 17.2 | 2.7 / 3.1 | 430 | 5979.9 | 0.9903 |
| nalati-grasslands/desktop/plains | 60.0 | 18.2 | 2.7 / 3.1 | 268 | 5995.1 | 0.9679 |
| pine-hollow/phone/gate | 30.0 | 35.1 | 2.4 / 3.1 | 100 | 1104.3 | 0.9834 |
| pine-hollow/phone/cabin | 30.0 | 34.6 | 2.7 / 3.8 | 142 | 1315.1 | 0.9678 |
| pine-hollow/phone/pond | 30.0 | 34.7 | 2.4 / 3.1 | 89 | 891.5 | 0.9715 |
| pine-hollow/desktop/gate | 60.0 | 18.6 | 8.6 / 10.5 | 235 | 8333.9 | 0.9566 |
| pine-hollow/desktop/cabin | 60.0 | 18.4 | 7.9 / 9.1 | 267 | 7935.6 | 0.9661 |
| pine-hollow/desktop/pond | 60.0 | 18.2 | 4.8 / 6.7 | 175 | 4954.2 | 0.9666 |

## switch route (menu → ENTER WORLD on another card → playable; a shard built in the page lands on its title first)

| viewport / switch | kind | s to playable | s to first frame | navigated | loading screen | MB downloaded | longest task ms | heap MB after | GPU tex MB after (running / all resident) |
|---|---|---|---|---|---|---|---|---|---|
| phone/1.driftwood-isle>nalati-grasslands | build | 3.20 | 3.42 | no | yes | 0.00 | 329 | 67.64 | 96.97 / 194.04 |
| phone/2.nalati-grasslands>driftwood-isle | resident | 0.05 | 0.16 | no | no | 0.00 | 0 | 67.67 | 237.67 / 336.97 |
| phone/3.driftwood-isle>pine-hollow | build | 2.03 | 2.12 | no | yes | 0.00 | 290 | 97.21 | 279.05 / 336.96 |
| phone/4.pine-hollow>nalati-grasslands | rebuild | 2.33 | 2.54 | no | yes | 0.00 | 300 | 122.01 | 96.97 / 349.42 |
| desktop/1.driftwood-isle>nalati-grasslands | build | 4.62 | 4.69 | no | yes | 0.00 | 1144 | 72.05 | 450.23 / 611.09 |
| desktop/2.nalati-grasslands>driftwood-isle | resident | 0.05 | 0.13 | no | no | 0.00 | 0 | 72.52 | 370.09 / 724.52 |
| desktop/3.driftwood-isle>pine-hollow | build | 3.71 | 3.95 | no | yes | 0.00 | 789 | 103.57 | 1205.27 / 1297.59 |
| desktop/4.pine-hollow>nalati-grasslands | rebuild | 2.82 | 2.90 | no | yes | 0.00 | 305 | 129.10 | 450.23 / 1509.88 |

- phone: Cache Storage after all three shards: **147.08 MB**; downloaded after the first play until idle: 121.01 MB
- desktop: Cache Storage after all three shards: **124.85 MB**; downloaded after the first play until idle: 97.48 MB

Units: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.

### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)

| rule | row | baseline | now | limit | verdict |
|---|---|---|---|---|---|
| first-play cold transfer ≤ 1.5× today: Driftwood phone ≤ 30.1 MiB | driftwood-isle/phone/cold.netBytes | — | 20.91 | ≤ 30.14 | pass |
| first-play cold transfer ≤ 1.5× today: Driftwood desktop ≤ 31.6 MiB | driftwood-isle/desktop/cold.netBytes | — | 22.23 | ≤ 31.64 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati phone ≤ 43.4 MiB | nalati-grasslands/phone/cold.netBytes | — | 30.08 | ≤ 43.44 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati desktop ≤ 52.1 MiB | nalati-grasslands/desktop/cold.netBytes | — | 36.21 | ≤ 52.15 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow phone ≤ 53.8 MiB | pine-hollow/phone/cold.netBytes | — | 36.42 | ≤ 53.77 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow desktop ≤ 137.0 MiB | pine-hollow/desktop/cold.netBytes | — | 91.65 | ≤ 137.04 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/phone/cold.netBytes | — | 20.91 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/desktop/cold.netBytes | — | 22.23 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/phone/cold.netBytes | — | 30.08 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/desktop/cold.netBytes | — | 36.21 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/phone/cold.netBytes | — | 36.42 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/desktop/cold.netBytes | — | 91.65 | no baseline | n/a |
| total SW cache, all three shards ≤ 300 MB | switch/phone/cacheStorageBytes | — | 147.08 | ≤ 300.00 | pass |
| total SW cache, all three shards ≤ 300 MB | switch/desktop/cacheStorageBytes | — | 124.85 | ≤ 300.00 | pass |
| cold time-to-play no worse than today | driftwood-isle/phone/cold.playMs | — | 7.05 | no baseline | n/a |
| cold time-to-play no worse than today | driftwood-isle/desktop/cold.playMs | — | 7.68 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/phone/cold.playMs | — | 9.20 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/desktop/cold.playMs | — | 11.43 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/phone/cold.playMs | — | 10.63 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/desktop/cold.playMs | — | 27.80 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/phone/cold4g.playMs | — | 24.51 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/desktop/cold4g.playMs | — | 24.01 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/phone/cold4g.playMs | — | 31.84 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/desktop/cold4g.playMs | — | 37.86 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/phone/cold4g.playMs | — | 35.29 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/desktop/cold4g.playMs | — | 86.66 | no baseline | n/a |
| Driftwood cold time-to-play on 4G ≤ 30 s | driftwood-isle/phone/cold4g.playMs | — | 24.51 | ≤ 30.00 | pass |
| Driftwood cold time-to-play on 4G ≤ 30 s | driftwood-isle/desktop/cold4g.playMs | — | 24.01 | ≤ 30.00 | pass |
| Pine Hollow cold time-to-play on 4G ≤ 40 s (phone) | pine-hollow/phone/cold4g.playMs | — | 35.29 | ≤ 40.00 | pass |
| Nalati cold time-to-play on 4G ≤ 35.5 s (phone) | nalati-grasslands/phone/cold4g.playMs | — | 31.84 | ≤ 35.50 | pass |
| Nalati cold time-to-play on 4G ≤ 40.8 s (desktop) | nalati-grasslands/desktop/cold4g.playMs | — | 37.86 | ≤ 40.80 | pass |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/phone/warm.playMs | — | 1.98 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/desktop/warm.playMs | — | 2.08 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/phone/warm.playMs | — | 3.21 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/desktop/warm.playMs | — | 4.46 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/phone/warm.playMs | — | 2.13 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/desktop/warm.playMs | — | 3.28 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/1.driftwood-isle>nalati-grasslands.ms | — | 3.20 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/2.nalati-grasslands>driftwood-isle.ms | — | 0.05 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/3.driftwood-isle>pine-hollow.ms | — | 2.03 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/4.pine-hollow>nalati-grasslands.ms | — | 2.33 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/1.driftwood-isle>nalati-grasslands.ms | — | 4.62 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/2.nalati-grasslands>driftwood-isle.ms | — | 0.05 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/3.driftwood-isle>pine-hollow.ms | — | 3.71 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/4.pine-hollow>nalati-grasslands.ms | — | 2.82 | no baseline | n/a |
| bytes re-downloaded after a one-texture change ≤ 4 MB | retouch/*/netBytes | | not measured | | n/a (enforced) |
