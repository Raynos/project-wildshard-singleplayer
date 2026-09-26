# scorecard e194-main — build b-muhzzdxe, 2026-09-26 06:20

http://localhost:4282 · headless Chromium, ANGLE Metal, muted · network wifi (service worker throttled too) · CPU 1× · 1 run · 10 s of frames per pose · darwin arm64 node v24.18.1

Boot pack parts: all 11 served.

## load

| shard / viewport | cold MB to play | cold req | background MB after play (info) | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |
|---|---|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| driftwood-isle/desktop | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| nalati-grasslands/phone | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| nalati-grasslands/desktop | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| pine-hollow/phone | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| pine-hollow/desktop | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## memory (warm page, settled, after GC)

| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| driftwood-isle/desktop | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| nalati-grasslands/phone | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| nalati-grasslands/desktop | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| pine-hollow/phone | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |
| pine-hollow/desktop | n/a | n/a | n/a | n/a | n/a | n/a | n/a | n/a |

## runtime + look (per pose)

| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |
|---|---|---|---|---|---|---|
| driftwood-isle/phone/pier | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| driftwood-isle/phone/beach | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| driftwood-isle/phone/wreck | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| driftwood-isle/desktop/pier | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| driftwood-isle/desktop/beach | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| driftwood-isle/desktop/wreck | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| nalati-grasslands/phone/camp | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| nalati-grasslands/phone/bridge | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| nalati-grasslands/phone/plains | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| nalati-grasslands/desktop/camp | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| nalati-grasslands/desktop/bridge | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| nalati-grasslands/desktop/plains | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| pine-hollow/phone/gate | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| pine-hollow/phone/cabin | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| pine-hollow/phone/pond | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| pine-hollow/desktop/gate | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| pine-hollow/desktop/cabin | n/a | n/a | n/a / n/a | n/a | n/a | n/a |
| pine-hollow/desktop/pond | n/a | n/a | n/a / n/a | n/a | n/a | n/a |

## switch route (menu → ENTER WORLD on another card → playable; a shard built in the page lands on its title first)

| viewport / switch | kind | s to playable | s to first frame | navigated | loading screen | MB downloaded | longest task ms | heap MB after | GPU tex MB after (running / all resident) |
|---|---|---|---|---|---|---|---|---|---|
| phone/1.driftwood-isle>nalati-grasslands | build | 3.43 | 3.71 | no | yes | 0.00 | 375 | 66.86 | 96.97 / 195.01 |
| phone/2.nalati-grasslands>driftwood-isle | resident | 0.06 | 0.16 | no | no | 0.00 | 0 | 67.77 | 258.74 / 347.99 |
| phone/3.driftwood-isle>pine-hollow | build | 2.12 | 2.21 | no | yes | 0.00 | 303 | 96.87 | 279.05 / 337.93 |
| phone/4.pine-hollow>nalati-grasslands | rebuild | 2.49 | 2.70 | no | yes | 0.00 | 328 | 121.96 | 96.97 / 349.42 |
| desktop/1.driftwood-isle>nalati-grasslands | build | 4.66 | 4.78 | no | yes | 0.00 | 1161 | 72.56 | 450.23 / 611.09 |
| desktop/2.nalati-grasslands>driftwood-isle | resident | 0.06 | 0.14 | no | no | 0.00 | 0 | 72.01 | 370.09 / 724.52 |
| desktop/3.driftwood-isle>pine-hollow | build | 4.08 | 4.52 | no | yes | 0.00 | 849 | 103.86 | 1205.27 / 1297.59 |
| desktop/4.pine-hollow>nalati-grasslands | rebuild | 3.08 | 3.16 | no | yes | 0.00 | 347 | 128.73 | 450.23 / 1509.88 |

- phone: Cache Storage after all three shards: **146.75 MB**; downloaded after the first play until idle: 121.01 MB
- desktop: Cache Storage after all three shards: **124.52 MB**; downloaded after the first play until idle: 97.48 MB

Units: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.

### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)

| rule | row | baseline | now | limit | verdict |
|---|---|---|---|---|---|
| first-play cold transfer ≤ 1.5× today: Driftwood phone ≤ 30.1 MiB | driftwood-isle/phone/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× today: Driftwood desktop ≤ 31.6 MiB | driftwood-isle/desktop/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× today: Nalati phone ≤ 43.4 MiB | nalati-grasslands/phone/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× today: Nalati desktop ≤ 52.1 MiB | nalati-grasslands/desktop/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× today: Pine Hollow phone ≤ 53.8 MiB | pine-hollow/phone/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× today: Pine Hollow desktop ≤ 137.0 MiB | pine-hollow/desktop/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | */*/cold.netBytes | | not measured | | n/a (enforced) |
| total SW cache, all three shards ≤ 300 MB | switch/phone/cacheStorageBytes | — | 146.75 | ≤ 300.00 | pass |
| total SW cache, all three shards ≤ 300 MB | switch/desktop/cacheStorageBytes | — | 124.52 | ≤ 300.00 | pass |
| cold time-to-play no worse than today | */*/cold.playMs | | not measured | | n/a (enforced) |
| cold time-to-play no worse than today, Fast 4G | */*/cold4g.playMs | | not measured | | n/a (enforced) |
| Driftwood cold time-to-play on 4G ≤ 30 s | driftwood-isle/*/cold4g.playMs | | not measured | | n/a (enforced) |
| Pine Hollow cold time-to-play on 4G ≤ 40 s (phone) | pine-hollow/phone/cold4g.playMs | | not measured | | n/a (enforced) |
| Nalati cold time-to-play on 4G ≤ 35.5 s (phone) | nalati-grasslands/phone/cold4g.playMs | | not measured | | n/a (enforced) |
| Nalati cold time-to-play on 4G ≤ 40.8 s (desktop) | nalati-grasslands/desktop/cold4g.playMs | | not measured | | n/a (enforced) |
| warm time-to-play: no worse (goal: improve) | */*/warm.playMs | | not measured | | n/a (enforced) |
| shard switch time: no worse (goal: improve) | switch/phone/1.driftwood-isle>nalati-grasslands.ms | — | 3.43 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/2.nalati-grasslands>driftwood-isle.ms | — | 0.06 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/3.driftwood-isle>pine-hollow.ms | — | 2.12 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/4.pine-hollow>nalati-grasslands.ms | — | 2.49 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/1.driftwood-isle>nalati-grasslands.ms | — | 4.66 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/2.nalati-grasslands>driftwood-isle.ms | — | 0.06 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/3.driftwood-isle>pine-hollow.ms | — | 4.08 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/4.pine-hollow>nalati-grasslands.ms | — | 3.08 | no baseline | n/a |
| bytes re-downloaded after a one-texture change ≤ 4 MB | retouch/*/netBytes | | not measured | | n/a (enforced) |
