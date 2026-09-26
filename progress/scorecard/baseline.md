# scorecard baseline — build b-muhl2ooi, 2026-09-25 23:59

http://localhost:4281 · headless Chromium, ANGLE Metal, muted · network wifi (service worker throttled too) · CPU 1× · 2 runs (median; ±x% = half the run-to-run range) · 10 s of frames per pose · darwin arm64 node v24.18.1

Boot pack parts: all 11 served.

## load

| shard / viewport | cold MB to play | cold req | background MB after play (info) | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |
|---|---|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 20.39 | 225 | 121.01 | 6.87 <small>±0%</small> | 23.65 <small>±0%</small> | 347 <small>±1%</small> | 0.00 | 229 | 1.79 <small>±1%</small> | 337 <small>±1%</small> |
| driftwood-isle/desktop | 21.39 | 230 | 97.48 | 7.33 <small>±0%</small> | 23.09 <small>±0%</small> | 415.5 <small>±0%</small> | 0.00 | 230 | 1.98 | 415 <small>±0%</small> |
| nalati-grasslands/phone | 29.56 | 233 | 111.84 | 9.25 <small>±0%</small> | 31.50 | 335 <small>±1%</small> | 0.00 | 257 | 3.13 | 336.5 <small>±0%</small> |
| nalati-grasslands/desktop | 35.36 | 268 | 83.50 | 11.18 <small>±0%</small> | 37.21 <small>±0%</small> | 1134 <small>±0%</small> | 0.00 | 268 | 4.35 <small>±1%</small> | 1099 <small>±2%</small> |
| pine-hollow/phone | 35.90 | 147 | 105.50 | 10.51 | 34.86 | 296 <small>±0%</small> | 0.00 | 246 | 2.05 <small>±1%</small> | 283.5 <small>±0%</small> |
| pine-hollow/desktop | 90.80 | 274 | 28.06 | 27.53 <small>±0%</small> | 83.25 <small>±0%</small> | 720.5 <small>±0%</small> | 0.00 | 274 | 3.28 <small>±1%</small> | 716.5 <small>±3%</small> |

## memory (warm page, settled, after GC)

| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 34.04 <small>±2%</small> | 264.23 | 0.33 | 109.02 | 31.53 | 109 | 424 | 98 |
| driftwood-isle/desktop | 36.25 | 370.09 | 7.19 | 194.34 | 59.03 | 127 | 772 | 105 |
| nalati-grasslands/phone | 46.32 <small>±1%</small> | 96.97 | 39.16 | 64.70 | 112.46 | 127 | 114 | 96 |
| nalati-grasslands/desktop | 48.28 <small>±0%</small> | 450.23 | 75.41 | 70.15 | 334.46 | 161 | 366 | 112 |
| pine-hollow/phone | 45.91 | 279.05 | 0.00 | 38.28 | 283.22 | 403 | 219 | 106 |
| pine-hollow/desktop | 48.59 <small>±1%</small> | 1205.21 | 6.87 | 164.80 | 767.55 | 451 | 278 | 113 |

## runtime + look (per pose)

| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |
|---|---|---|---|---|---|---|
| driftwood-isle/phone/pier | 60.0 | 17.2 | 2.8 <small>±2%</small> / 3.3 <small>±1%</small> | 233 | 1102.3 | 0.9901 <small>±1%</small> |
| driftwood-isle/phone/beach | 60.0 | 17.4 <small>±0%</small> | 2.8 / 3.5 | 228 | 1055.8 | 0.9994 |
| driftwood-isle/phone/wreck | 60.0 | 17.3 <small>±1%</small> | 2.7 / 3.3 | 181 | 929.1 | 0.9987 <small>±0%</small> |
| driftwood-isle/desktop/pier | 60.0 | 17.1 <small>±0%</small> | 3.5 / 3.9 | 868 | 2980.7 | 0.9981 <small>±0%</small> |
| driftwood-isle/desktop/beach | 60.0 | 17.1 | 3.3 / 3.9 | 567 | 2309.1 | 0.9981 <small>±0%</small> |
| driftwood-isle/desktop/wreck | 60.0 | 17.3 <small>±0%</small> | 3.0 <small>±2%</small> / 4.2 <small>±1%</small> | 239 | 1452.3 | 0.9993 |
| nalati-grasslands/phone/camp | 60.0 | 18.5 <small>±2%</small> | 2.5 <small>±2%</small> / 3.8 | 77 | 983.2 | 0.9988 <small>±0%</small> |
| nalati-grasslands/phone/bridge | 60.0 | 18.1 <small>±1%</small> | 2.6 / 4.0 <small>±1%</small> | 87 | 1228.9 | 0.9932 <small>±0%</small> |
| nalati-grasslands/phone/plains | 60.0 | 17.7 <small>±2%</small> | 2.8 <small>±2%</small> / 3.8 <small>±4%</small> | 99.5 <small>±2%</small> | 1213.8 <small>±1%</small> | 0.9819 <small>±1%</small> |
| nalati-grasslands/desktop/camp | 60.0 | 17.4 <small>±1%</small> | 2.8 <small>±1%</small> / 4.0 <small>±1%</small> | 195 | 4297.8 | 0.9975 <small>±0%</small> |
| nalati-grasslands/desktop/bridge | 60.0 | 17.2 | 3.0 / 4.1 | 430 | 5979.9 | 0.9888 <small>±1%</small> |
| nalati-grasslands/desktop/plains | 60.0 | 17.6 <small>±1%</small> | 3.0 <small>±2%</small> / 3.8 <small>±1%</small> | 268.5 <small>±0%</small> | 5991.1 <small>±0%</small> | 0.9570 <small>±2%</small> |
| pine-hollow/phone/gate | 30.0 | 35.8 | 4.2 / 6.1 | 99.5 <small>±1%</small> | 1102.8 <small>±0%</small> | 0.9857 <small>±1%</small> |
| pine-hollow/phone/cabin | 30.0 | 35.0 <small>±0%</small> | 4.9 <small>±2%</small> / 6.3 <small>±1%</small> | 141 | 1302.5 <small>±0%</small> | 0.9762 <small>±1%</small> |
| pine-hollow/phone/pond | 30.0 | 35.2 <small>±0%</small> | 4.5 <small>±1%</small> / 6.3 <small>±2%</small> | 88 | 887.1 <small>±0%</small> | 0.9698 <small>±2%</small> |
| pine-hollow/desktop/gate | 60.0 | 17.7 <small>±3%</small> | 8.4 <small>±1%</small> / 8.9 <small>±1%</small> | 235 | 8344.8 <small>±0%</small> | 0.9636 <small>±2%</small> |
| pine-hollow/desktop/cabin | 60.0 | 17.6 <small>±2%</small> | 7.5 <small>±1%</small> / 7.9 <small>±2%</small> | 269 | 8006.7 <small>±0%</small> | 0.9638 <small>±2%</small> |
| pine-hollow/desktop/pond | 60.0 | 17.3 <small>±0%</small> | 4.7 <small>±2%</small> / 5.2 <small>±2%</small> | 175.5 <small>±0%</small> | 4950 <small>±0%</small> | 0.9709 <small>±2%</small> |

## switch route (menu → ENTER WORLD on another card → playable; a shard built in the page lands on its title first)

| viewport / switch | kind | s to playable | s to first frame | navigated | loading screen | MB downloaded | longest task ms | heap MB after | GPU tex MB after (running / all resident) |
|---|---|---|---|---|---|---|---|---|---|
| phone/1.driftwood-isle>nalati-grasslands | build | 3.28 <small>±0%</small> | 3.34 <small>±0%</small> | no | yes | 0.00 | 334 <small>±2%</small> | 67.97 <small>±0%</small> | 96.97 / 422.19 |
| phone/2.nalati-grasslands>driftwood-isle | resident | 0.05 <small>±6%</small> | 0.12 <small>±3%</small> | no | no | 0.00 | 0 | 67.76 | 285.73 / 422.19 |
| phone/3.driftwood-isle>pine-hollow | build | 1.95 <small>±5%</small> | 2.09 <small>±2%</small> | no | yes | 0.00 | 281.5 <small>±0%</small> | 97.61 | 279.05 / 565.11 |
| phone/4.pine-hollow>nalati-grasslands | rebuild | 2.41 <small>±0%</small> | 2.49 <small>±0%</small> | no | yes | 0.00 | 302 <small>±0%</small> | 121.51 <small>±0%</small> | 96.97 / 415.18 |
| desktop/1.driftwood-isle>nalati-grasslands | build | 4.48 <small>±0%</small> | 4.55 <small>±0%</small> | no | yes | 0.00 | 1097 <small>±1%</small> | 71.61 | 450.23 / 902.92 |
| desktop/2.nalati-grasslands>driftwood-isle | resident | 0.06 <small>±8%</small> | 0.12 <small>±5%</small> | no | no | 0.00 | 0 | 72.28 <small>±0%</small> | 370.09 / 902.92 |
| desktop/3.driftwood-isle>pine-hollow | build | 3.18 <small>±1%</small> | 3.41 <small>±1%</small> | no | yes | 0.00 | 688.5 <small>±0%</small> | 102.06 <small>±0%</small> | 1205.27 / 1589.42 |
| desktop/4.pine-hollow>nalati-grasslands | rebuild | 2.77 <small>±1%</small> | 2.84 <small>±1%</small> | no | yes | 0.00 | 304.5 <small>±0%</small> | 128.98 <small>±0%</small> | 450.23 / 1737.71 |

- phone: Cache Storage after all three shards: **146.33 MB**; downloaded after the first play until idle: 121.01 MB
- desktop: Cache Storage after all three shards: **123.76 MB**; downloaded after the first play until idle: 97.48 MB

## one-texture change (/assets/hdri/qwantani_mid_morning_puresky_2k.key.jpg)

A re-download is a file build A had already fetched (the edited file, the code bundle every build re-stamps); files A never fetched (a sound first played in B) are in the second figure only.

- retouch/phone/netBytes: **3.83 MB** re-downloaded by a returning player; 3.83 MB downloaded in all ([["/assets/packs/pine-hollow.phone-93c2bcfe.bin",2729636],["/assets/main-dUS86Gll.js",1174646],["/assets/tier-CdvyP1Ei.js",28115],["/assets/BlenderIsland-CKRVU-sz.js",19809],["/assets/Explore-DkAnQ9ef.js",18732]])
- retouch/desktop/netBytes: **1.40 MB** re-downloaded by a returning player; 1.40 MB downloaded in all ([["/assets/main-dUS86Gll.js",1174646],["/assets/hdri/qwantani_mid_morning_puresky_2k.key.jpg?v=b4089371",178272],["/assets/tier-CdvyP1Ei.js",28115],["/assets/BlenderIsland-CKRVU-sz.js",19809],["/assets/Explore-DkAnQ9ef.js",18732]])

## noise (run to run)

| kind | rows | median spread | max spread | the noisiest row |
|---|---|---|---|---|
| bytes | 22 | 0.0 % | 0.0 % | switch/desktop/cacheStorageBytes |
| count | 12 | 0.0 % | 0.0 % | pine-hollow/desktop/warm.requests |
| time | 34 | 0.6 % | 16.2 % | switch/desktop/2.nalati-grasslands>driftwood-isle.ms |
| longtask | 20 | 0.7 % | 5.7 % | pine-hollow/desktop/warm.longTaskMaxMs |
| memory | 54 | 0.0 % | 3.2 % | driftwood-isle/phone/mem.heapBytes |
| objects | 18 | 0.0 % | 0.0 % | pine-hollow/desktop/mem.programs |
| fps | 18 | 0.0 % | 0.0 % | pine-hollow/desktop/pose.pond.fps |
| frame | 54 | 1.6 % | 8.0 % | nalati-grasslands/phone/pose.plains.cpuP95Ms |
| drawcalls | 36 | 0.0 % | 3.0 % | nalati-grasslands/phone/pose.plains.calls |
| ssim (run 2 vs run 1's golden) | 18 | 0.9894 | min 0.9570 | nalati-grasslands/desktop/pose.plains.ssim |

Units: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.

### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)

| rule | row | baseline | now | limit | verdict |
|---|---|---|---|---|---|
| first-play cold transfer ≤ 1.5× today: Driftwood phone ≤ 30.1 MiB | driftwood-isle/phone/cold.netBytes | — | 20.39 | ≤ 30.14 | pass |
| first-play cold transfer ≤ 1.5× today: Driftwood desktop ≤ 31.6 MiB | driftwood-isle/desktop/cold.netBytes | — | 21.39 | ≤ 31.64 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati phone ≤ 43.4 MiB | nalati-grasslands/phone/cold.netBytes | — | 29.56 | ≤ 43.44 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati desktop ≤ 52.1 MiB | nalati-grasslands/desktop/cold.netBytes | — | 35.36 | ≤ 52.15 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow phone ≤ 53.8 MiB | pine-hollow/phone/cold.netBytes | — | 35.90 | ≤ 53.77 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow desktop ≤ 137.0 MiB | pine-hollow/desktop/cold.netBytes | — | 90.80 | ≤ 137.04 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/phone/cold.netBytes | — | 20.39 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/desktop/cold.netBytes | — | 21.39 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/phone/cold.netBytes | — | 29.56 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/desktop/cold.netBytes | — | 35.36 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/phone/cold.netBytes | — | 35.90 | no baseline | n/a |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/desktop/cold.netBytes | — | 90.80 | no baseline | n/a |
| total SW cache, all three shards ≤ 300 MB | switch/phone/cacheStorageBytes | — | 146.33 | ≤ 300.00 | pass |
| total SW cache, all three shards ≤ 300 MB | switch/desktop/cacheStorageBytes | — | 123.76 | ≤ 300.00 | pass |
| cold time-to-play no worse than today | driftwood-isle/phone/cold.playMs | — | 6.87 | no baseline | n/a |
| cold time-to-play no worse than today | driftwood-isle/desktop/cold.playMs | — | 7.33 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/phone/cold.playMs | — | 9.25 | no baseline | n/a |
| cold time-to-play no worse than today | nalati-grasslands/desktop/cold.playMs | — | 11.18 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/phone/cold.playMs | — | 10.51 | no baseline | n/a |
| cold time-to-play no worse than today | pine-hollow/desktop/cold.playMs | — | 27.53 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/phone/cold4g.playMs | — | 23.65 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/desktop/cold4g.playMs | — | 23.09 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/phone/cold4g.playMs | — | 31.50 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/desktop/cold4g.playMs | — | 37.21 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/phone/cold4g.playMs | — | 34.86 | no baseline | n/a |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/desktop/cold4g.playMs | — | 83.25 | no baseline | n/a |
| Driftwood cold time-to-play on 4G ≤ 22 s | driftwood-isle/phone/cold4g.playMs | — | 23.65 | ≤ 22.00 | **FAIL** |
| Driftwood cold time-to-play on 4G ≤ 22 s | driftwood-isle/desktop/cold4g.playMs | — | 23.09 | ≤ 22.00 | **FAIL** |
| Pine Hollow cold time-to-play on 4G ≤ 40 s (phone) | pine-hollow/phone/cold4g.playMs | — | 34.86 | ≤ 40.00 | pass |
| Nalati cold time-to-play on 4G ≤ 35.5 s (phone) | nalati-grasslands/phone/cold4g.playMs | — | 31.50 | ≤ 35.50 | pass |
| Nalati cold time-to-play on 4G ≤ 40.8 s (desktop) | nalati-grasslands/desktop/cold4g.playMs | — | 37.21 | ≤ 40.80 | pass |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/phone/warm.playMs | — | 1.79 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/desktop/warm.playMs | — | 1.98 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/phone/warm.playMs | — | 3.13 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/desktop/warm.playMs | — | 4.35 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/phone/warm.playMs | — | 2.05 | no baseline | n/a |
| warm time-to-play: no worse (goal: improve) | pine-hollow/desktop/warm.playMs | — | 3.28 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/1.driftwood-isle>nalati-grasslands.ms | — | 3.28 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/2.nalati-grasslands>driftwood-isle.ms | — | 0.05 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/3.driftwood-isle>pine-hollow.ms | — | 1.95 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/phone/4.pine-hollow>nalati-grasslands.ms | — | 2.41 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/1.driftwood-isle>nalati-grasslands.ms | — | 4.48 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/2.nalati-grasslands>driftwood-isle.ms | — | 0.06 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/3.driftwood-isle>pine-hollow.ms | — | 3.18 | no baseline | n/a |
| shard switch time: no worse (goal: improve) | switch/desktop/4.pine-hollow>nalati-grasslands.ms | — | 2.77 | no baseline | n/a |
| bytes re-downloaded after a one-texture change ≤ 2 MB | retouch/phone/netBytes | — | 3.83 | ≤ 2.00 | **FAIL** |
| bytes re-downloaded after a one-texture change ≤ 2 MB | retouch/desktop/netBytes | — | 1.40 | ≤ 2.00 | pass |
