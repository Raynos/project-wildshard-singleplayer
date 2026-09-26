# scorecard nd-head — build b-muhzk6sx, 2026-09-26 06:12

http://localhost:4282 · headless Chromium, ANGLE Metal, muted · network wifi (service worker throttled too) · CPU 1× · 1 run · 10 s of frames per pose · darwin arm64 node v24.18.1

Boot pack parts: all 11 served.

## load

| shard / viewport | cold MB to play | cold req | background MB after play (info) | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |
|---|---|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 20.79 | 227 | 121.01 | 7.00 | 26.95 | 400 | 0.00 | 231 | 1.96 | 394 |
| pine-hollow/phone | 36.31 | 149 | 105.50 | 10.58 | 35.21 | 298 | 0.00 | 248 | 2.11 | 291 |
| nalati-grasslands/phone | 29.96 | 235 | 111.84 | 9.28 | 31.63 | 335 | 0.00 | 259 | 3.26 | 351 |

## memory (warm page, settled, after GC)

| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 34.00 | 117.24 | 0.33 | 136.21 | 31.53 | 102 | 454 | 94 |
| pine-hollow/phone | 45.74 | 279.05 | 0.00 | 38.28 | 283.22 | 403 | 219 | 106 |
| nalati-grasslands/phone | 46.56 | 96.97 | 39.16 | 64.70 | 112.46 | 127 | 114 | 96 |

## runtime + look (per pose)

| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |
|---|---|---|---|---|---|---|
| driftwood-isle/phone/pier | 30.0 | 34.3 | 1.9 / 2.4 | 131 | 790.1 | 0.9882 |
| driftwood-isle/phone/beach | 30.0 | 34.2 | 1.9 / 2.3 | 188 | 952.7 | 0.9959 |
| driftwood-isle/phone/wreck | 30.0 | 34.4 | 2.1 / 4.2 | 125 | 820.2 | 0.9940 |
| pine-hollow/phone/gate | 30.0 | 34.7 | 2.8 / 4.0 | 99 | 1101.3 | 0.9880 |
| pine-hollow/phone/cabin | 30.0 | 34.2 | 3.0 / 4.1 | 141 | 1305.1 | 0.9864 |
| pine-hollow/phone/pond | 30.0 | 34.1 | 2.7 / 4.0 | 88 | 888.5 | 0.9845 |
| nalati-grasslands/phone/camp | 30.0 | 33.9 | 1.9 / 2.3 | 77 | 983.2 | 0.9972 |
| nalati-grasslands/phone/bridge | 30.0 | 33.7 | 1.8 / 2.1 | 87 | 1228.9 | 0.9900 |
| nalati-grasslands/phone/plains | 30.0 | 34.5 | 2.0 / 3.3 | 103 | 1230.3 | 0.9393 |

Units: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.

### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)

| rule | row | baseline | now | limit | verdict |
|---|---|---|---|---|---|
| first-play cold transfer ≤ 1.5× today: Driftwood phone ≤ 30.1 MiB | driftwood-isle/phone/cold.netBytes | — | 20.79 | ≤ 30.14 | pass |
| first-play cold transfer ≤ 1.5× today: Driftwood desktop ≤ 31.6 MiB | driftwood-isle/desktop/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× today: Nalati phone ≤ 43.4 MiB | nalati-grasslands/phone/cold.netBytes | — | 29.96 | ≤ 43.44 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati desktop ≤ 52.1 MiB | nalati-grasslands/desktop/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× today: Pine Hollow phone ≤ 53.8 MiB | pine-hollow/phone/cold.netBytes | — | 36.31 | ≤ 53.77 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow desktop ≤ 137.0 MiB | pine-hollow/desktop/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/phone/cold.netBytes | — | 20.79 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/phone/cold.netBytes | — | 36.31 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/phone/cold.netBytes | — | 29.96 | no baseline | n/a |
| total SW cache, all three shards ≤ 300 MB | switch/*/cacheStorageBytes | | not measured | | n/a (enforced) |
| cold time-to-play no worse than today | driftwood-isle/phone/cold.playMs | — | 7.00 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/phone/cold.playMs | — | 10.58 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/phone/cold.playMs | — | 9.28 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/phone/cold4g.playMs | — | 26.95 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/phone/cold4g.playMs | — | 35.21 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/phone/cold4g.playMs | — | 31.63 | no baseline | n/a |
| Driftwood cold time-to-play on 4G ≤ 30 s | driftwood-isle/phone/cold4g.playMs | — | 26.95 | ≤ 30.00 | pass |
| Pine Hollow cold time-to-play on 4G ≤ 40 s (phone) | pine-hollow/phone/cold4g.playMs | — | 35.21 | ≤ 40.00 | pass |
| Nalati cold time-to-play on 4G ≤ 35.5 s (phone) | nalati-grasslands/phone/cold4g.playMs | — | 31.63 | ≤ 35.50 | pass |
| Nalati cold time-to-play on 4G ≤ 40.8 s (desktop) | nalati-grasslands/desktop/cold4g.playMs | | not measured | | n/a (enforced) |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/phone/warm.playMs | — | 1.96 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/phone/warm.playMs | — | 2.11 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/phone/warm.playMs | — | 3.26 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/*/*.ms | | not measured | | n/a (enforced) |
| bytes re-downloaded after a one-texture change ≤ 4 MB | retouch/*/netBytes | | not measured | | n/a (enforced) |
