# scorecard nd-port — build b-muhz6f00, 2026-09-26 06:23

http://localhost:4281 · headless Chromium, ANGLE Metal, muted · network wifi (service worker throttled too) · CPU 1× · 1 run · 10 s of frames per pose · darwin arm64 node v24.18.1

Boot pack parts: all 11 served.

## load

| shard / viewport | cold MB to play | cold req | background MB after play (info) | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |
|---|---|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 20.90 | 228 | 121.01 | 7.06 | 24.71 | 396 | 0.00 | 232 | 2.01 | 399 |
| pine-hollow/phone | 36.41 | 150 | 105.50 | 10.63 | 35.18 | 320 | 0.00 | 249 | 2.26 | 311 |
| nalati-grasslands/phone | 30.06 | 236 | 111.84 | 9.15 | 31.66 | 362 | 0.00 | 260 | 3.43 | 343 |

## memory (warm page, settled, after GC)

| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 33.76 | 117.24 | 0.33 | 136.21 | 31.53 | 102 | 454 | 94 |
| pine-hollow/phone | 45.34 | 279.05 | 0.00 | 38.28 | 283.22 | 403 | 219 | 106 |
| nalati-grasslands/phone | 46.67 | 96.97 | 39.16 | 64.70 | 112.46 | 127 | 114 | 96 |

## runtime + look (per pose)

| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |
|---|---|---|---|---|---|---|
| driftwood-isle/phone/pier | 30.0 | 34.3 | 1.8 / 2.2 | 177.5 | 945.6 | 0.9873 |
| driftwood-isle/phone/beach | 30.0 | 33.9 | 2.1 / 2.4 | 219 | 1054.7 | 0.9974 |
| driftwood-isle/phone/wreck | 30.0 | 33.8 | 2.1 / 2.3 | 171 | 927 | 0.9949 |
| pine-hollow/phone/gate | 30.0 | 34.2 | 2.5 / 2.8 | 100 | 1104.3 | 0.9855 |
| pine-hollow/phone/cabin | 30.0 | 34.3 | 2.8 / 3.2 | 142 | 1306.9 | 0.9751 |
| pine-hollow/phone/pond | 30.0 | 34.1 | 2.2 / 2.8 | 88 | 885.6 | 0.9761 |
| nalati-grasslands/phone/camp | 30.0 | 35.1 | 1.8 / 2.1 | 77 | 983.2 | 0.9964 |
| nalati-grasslands/phone/bridge | 30.0 | 34.9 | 1.8 / 2.0 | 87 | 1228.9 | 0.9888 |
| nalati-grasslands/phone/plains | 30.0 | 34.5 | 2.1 / 2.8 | 99 | 1212.3 | 0.9344 |

Units: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.

## compare · nd-port (b-muhz6f00) against nd-head (b-muhzk6sx)

Band = max(rel, noise × baseline run-to-run spread) × baseline + abs (scorecard.budget.json `kinds`). REGRESS blocks the merge; `info` rows never fail.

| row | baseline | now | Δ | band | verdict |
|---|---|---|---|---|---|
| driftwood-isle/phone/cold.bgNetBytes | 126886451 | 126886451 | +0.0 % |  | info |
| driftwood-isle/phone/cold.idleNetBytes | 148690047 | 148799683 | +0.1 % |  | info |
| driftwood-isle/phone/cold.longTaskMaxMs | 400 | 396 | -1.0 % | ±110 | pass |
| driftwood-isle/phone/cold.netBytes | 20.79 | 20.90 | +0.5 % | ±0.27 | pass |
| driftwood-isle/phone/cold.playMs | 7.00 | 7.06 | +0.8 % | ±0.85 | pass |
| driftwood-isle/phone/cold.requests | 227 | 228 | +0.4 % | ±6.5 | pass |
| driftwood-isle/phone/cold4g.playMs | 26.95 | 24.71 | -8.3 % | ±2.85 | pass |
| driftwood-isle/phone/mem.geometries | 454 | 454 | +0.0 % | ±24.7 | pass |
| driftwood-isle/phone/mem.glBufBytes | 136.21 | 136.21 | +0.0 % | ±8.81 | pass |
| driftwood-isle/phone/mem.glRbBytes | 0.33 | 0.33 | +0.0 % | ±2.02 | pass |
| driftwood-isle/phone/mem.glTexBytes | 117.24 | 117.24 | +0.0 % | ±7.86 | pass |
| driftwood-isle/phone/mem.heapBytes | 34.00 | 33.76 | -0.7 % | ±3.70 | pass |
| driftwood-isle/phone/mem.programs | 94 | 94 | +0.0 % | ±6.7 | pass |
| driftwood-isle/phone/mem.sceneTexBytes | 31.53 | 31.53 | +0.0 % | ±3.58 | pass |
| driftwood-isle/phone/mem.textures | 102 | 102 | +0.0 % | ±7.1 | pass |
| driftwood-isle/phone/pose.beach.calls | 188 | 219 | +16.5 % | ±23.8 | **REGRESS** |
| driftwood-isle/phone/pose.beach.cpuP50Ms | 1.9 | 2.1 | +10.5 % | ±1.2 | pass |
| driftwood-isle/phone/pose.beach.cpuP95Ms | 2.3 | 2.4 | +4.3 % | ±1.2 | pass |
| driftwood-isle/phone/pose.beach.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| driftwood-isle/phone/pose.beach.frameP95Ms | 34.2 | 33.9 | -0.9 % | ±4.4 | pass |
| driftwood-isle/phone/pose.beach.maskedFrac | 0.1 | 0.1 | +0.0 % |  | info |
| driftwood-isle/phone/pose.beach.ssim | 0.9959 | 0.9974 | +0.2 % | ≥ 0.98 | pass |
| driftwood-isle/phone/pose.beach.trisK | 952.7 | 1054.7 | +10.7 % | ±100.3 | **REGRESS** |
| driftwood-isle/phone/pose.pier.calls | 131 | 177.5 | +35.5 % | ±18.1 | **REGRESS** |
| driftwood-isle/phone/pose.pier.cpuP50Ms | 1.9 | 1.8 | -5.3 % | ±1.2 | pass |
| driftwood-isle/phone/pose.pier.cpuP95Ms | 2.4 | 2.2 | -8.3 % | ±1.2 | pass |
| driftwood-isle/phone/pose.pier.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| driftwood-isle/phone/pose.pier.frameP95Ms | 34.3 | 34.3 | +0.0 % | ±4.4 | pass |
| driftwood-isle/phone/pose.pier.maskedFrac | 0 | 0 | +0.0 % |  | info |
| driftwood-isle/phone/pose.pier.ssim | 0.9882 | 0.9873 | -0.1 % | ≥ 0.9782 | pass |
| driftwood-isle/phone/pose.pier.trisK | 790.1 | 945.6 | +19.7 % | ±84 | **REGRESS** |
| driftwood-isle/phone/pose.wreck.calls | 125 | 171 | +36.8 % | ±17.5 | **REGRESS** |
| driftwood-isle/phone/pose.wreck.cpuP50Ms | 2.1 | 2.1 | +0.0 % | ±1.2 | pass |
| driftwood-isle/phone/pose.wreck.cpuP95Ms | 4.2 | 2.3 | -45.2 % | ±1.4 | better |
| driftwood-isle/phone/pose.wreck.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| driftwood-isle/phone/pose.wreck.frameP95Ms | 34.4 | 33.8 | -1.7 % | ±4.4 | pass |
| driftwood-isle/phone/pose.wreck.maskedFrac | 0.1 | 0.1 | -0.7 % |  | info |
| driftwood-isle/phone/pose.wreck.ssim | 0.9940 | 0.9949 | +0.1 % | ≥ 0.98 | pass |
| driftwood-isle/phone/pose.wreck.trisK | 820.2 | 927 | +13.0 % | ±87 | **REGRESS** |
| driftwood-isle/phone/warm.longTaskMaxMs | 394 | 399 | +1.3 % | ±109.1 | pass |
| driftwood-isle/phone/warm.netBytes | 0.00 | 0.00 | -0.1 % | ±0.06 | pass |
| driftwood-isle/phone/warm.playMs | 1.96 | 2.01 | +2.6 % | ±0.35 | pass |
| driftwood-isle/phone/warm.requests | 231 | 232 | +0.4 % | ±6.6 | pass |
| nalati-grasslands/phone/cold.bgNetBytes | 117275794 | 117275794 | +0.0 % |  | info |
| nalati-grasslands/phone/cold.idleNetBytes | 148689839 | 148799475 | +0.1 % |  | info |
| nalati-grasslands/phone/cold.longTaskMaxMs | 335 | 362 | +8.1 % | ±100.3 | pass |
| nalati-grasslands/phone/cold.netBytes | 29.96 | 30.06 | +0.3 % | ±0.36 | pass |
| nalati-grasslands/phone/cold.playMs | 9.28 | 9.15 | -1.4 % | ±1.08 | pass |
| nalati-grasslands/phone/cold.requests | 235 | 236 | +0.4 % | ±6.7 | pass |
| nalati-grasslands/phone/cold4g.playMs | 31.63 | 31.66 | +0.1 % | ±3.31 | pass |
| nalati-grasslands/phone/mem.geometries | 114 | 114 | +0.0 % | ±7.7 | pass |
| nalati-grasslands/phone/mem.glBufBytes | 64.70 | 64.70 | +0.0 % | ±5.24 | pass |
| nalati-grasslands/phone/mem.glRbBytes | 39.16 | 39.16 | +0.0 % | ±3.96 | pass |
| nalati-grasslands/phone/mem.glTexBytes | 96.97 | 96.97 | +0.0 % | ±6.85 | pass |
| nalati-grasslands/phone/mem.heapBytes | 46.56 | 46.67 | +0.2 % | ±4.33 | pass |
| nalati-grasslands/phone/mem.programs | 96 | 96 | +0.0 % | ±6.8 | pass |
| nalati-grasslands/phone/mem.sceneTexBytes | 112.46 | 112.46 | +0.0 % | ±7.62 | pass |
| nalati-grasslands/phone/mem.textures | 127 | 127 | +0.0 % | ±8.4 | pass |
| nalati-grasslands/phone/pose.bridge.calls | 87 | 87 | +0.0 % | ±13.7 | pass |
| nalati-grasslands/phone/pose.bridge.cpuP50Ms | 1.8 | 1.8 | +0.0 % | ±1.2 | pass |
| nalati-grasslands/phone/pose.bridge.cpuP95Ms | 2.1 | 2.0 | -4.8 % | ±1.2 | pass |
| nalati-grasslands/phone/pose.bridge.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| nalati-grasslands/phone/pose.bridge.frameP95Ms | 33.7 | 34.9 | +3.6 % | ±4.4 | pass |
| nalati-grasslands/phone/pose.bridge.maskedFrac | 0 | 0 | +0.0 % |  | info |
| nalati-grasslands/phone/pose.bridge.ssim | 0.9900 | 0.9888 | -0.1 % | ≥ 0.98 | pass |
| nalati-grasslands/phone/pose.bridge.trisK | 1228.9 | 1228.9 | +0.0 % | ±127.9 | pass |
| nalati-grasslands/phone/pose.camp.calls | 77 | 77 | +0.0 % | ±12.7 | pass |
| nalati-grasslands/phone/pose.camp.cpuP50Ms | 1.9 | 1.8 | -5.3 % | ±1.2 | pass |
| nalati-grasslands/phone/pose.camp.cpuP95Ms | 2.3 | 2.1 | -8.7 % | ±1.2 | pass |
| nalati-grasslands/phone/pose.camp.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| nalati-grasslands/phone/pose.camp.frameP95Ms | 33.9 | 35.1 | +3.5 % | ±4.4 | pass |
| nalati-grasslands/phone/pose.camp.maskedFrac | 0.3 | 0.3 | +0.0 % |  | info |
| nalati-grasslands/phone/pose.camp.ssim | 0.9972 | 0.9964 | -0.1 % | ≥ 0.98 | pass |
| nalati-grasslands/phone/pose.camp.trisK | 983.2 | 983.2 | +0.0 % | ±103.3 | pass |
| nalati-grasslands/phone/pose.plains.calls | 103 | 99 | -3.9 % | ±15.3 | pass |
| nalati-grasslands/phone/pose.plains.cpuP50Ms | 2.0 | 2.1 | +5.0 % | ±1.2 | pass |
| nalati-grasslands/phone/pose.plains.cpuP95Ms | 3.3 | 2.8 | -15.2 % | ±1.3 | pass |
| nalati-grasslands/phone/pose.plains.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| nalati-grasslands/phone/pose.plains.frameP95Ms | 34.5 | 34.5 | +0.0 % | ±4.5 | pass |
| nalati-grasslands/phone/pose.plains.maskedFrac | 0.1 | 0 | -21.2 % |  | info |
| nalati-grasslands/phone/pose.plains.ssim | 0.9393 | 0.9344 | -0.5 % | ≥ 0.9293 | pass |
| nalati-grasslands/phone/pose.plains.trisK | 1230.3 | 1212.3 | -1.5 % | ±128 | pass |
| nalati-grasslands/phone/warm.longTaskMaxMs | 351 | 343 | -2.3 % | ±102.7 | pass |
| nalati-grasslands/phone/warm.netBytes | 0.00 | 0.00 | -0.1 % | ±0.06 | pass |
| nalati-grasslands/phone/warm.playMs | 3.26 | 3.43 | +5.4 % | ±0.48 | pass |
| nalati-grasslands/phone/warm.requests | 259 | 260 | +0.4 % | ±7.2 | pass |
| pine-hollow/phone/cold.bgNetBytes | 110620721 | 110620721 | +0.0 % |  | info |
| pine-hollow/phone/cold.idleNetBytes | 148689943 | 148799277 | +0.1 % |  | info |
| pine-hollow/phone/cold.longTaskMaxMs | 298 | 320 | +7.4 % | ±94.7 | pass |
| pine-hollow/phone/cold.netBytes | 36.31 | 36.41 | +0.3 % | ±0.43 | pass |
| pine-hollow/phone/cold.playMs | 10.58 | 10.63 | +0.5 % | ±1.21 | pass |
| pine-hollow/phone/cold.requests | 149 | 150 | +0.7 % | ±5 | pass |
| pine-hollow/phone/cold4g.playMs | 35.21 | 35.18 | -0.1 % | ±3.67 | pass |
| pine-hollow/phone/mem.geometries | 219 | 219 | +0.0 % | ±13 | pass |
| pine-hollow/phone/mem.glBufBytes | 38.28 | 38.28 | +0.0 % | ±3.91 | pass |
| pine-hollow/phone/mem.glRbBytes | 0.00 | 0.00 | +0.00 | ±2.00 | pass |
| pine-hollow/phone/mem.glTexBytes | 279.05 | 279.05 | +0.0 % | ±15.95 | pass |
| pine-hollow/phone/mem.heapBytes | 45.74 | 45.34 | -0.9 % | ±4.29 | pass |
| pine-hollow/phone/mem.programs | 106 | 106 | +0.0 % | ±7.3 | pass |
| pine-hollow/phone/mem.sceneTexBytes | 283.22 | 283.22 | +0.0 % | ±16.16 | pass |
| pine-hollow/phone/mem.textures | 403 | 403 | +0.0 % | ±22.2 | pass |
| pine-hollow/phone/pose.cabin.calls | 141 | 142 | +0.7 % | ±19.1 | pass |
| pine-hollow/phone/pose.cabin.cpuP50Ms | 3.0 | 2.8 | -6.7 % | ±1.3 | pass |
| pine-hollow/phone/pose.cabin.cpuP95Ms | 4.1 | 3.2 | -22.0 % | ±1.4 | pass |
| pine-hollow/phone/pose.cabin.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| pine-hollow/phone/pose.cabin.frameP95Ms | 34.2 | 34.3 | +0.3 % | ±4.4 | pass |
| pine-hollow/phone/pose.cabin.maskedFrac | 0.1 | 0.1 | +7.1 % |  | info |
| pine-hollow/phone/pose.cabin.ssim | 0.9864 | 0.9751 | -1.1 % | ≥ 0.9764 | **REGRESS** |
| pine-hollow/phone/pose.cabin.trisK | 1305.1 | 1306.9 | +0.1 % | ±135.5 | pass |
| pine-hollow/phone/pose.gate.calls | 99 | 100 | +1.0 % | ±14.9 | pass |
| pine-hollow/phone/pose.gate.cpuP50Ms | 2.8 | 2.5 | -10.7 % | ±1.3 | pass |
| pine-hollow/phone/pose.gate.cpuP95Ms | 4.0 | 2.8 | -30.0 % | ±1.4 | pass |
| pine-hollow/phone/pose.gate.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| pine-hollow/phone/pose.gate.frameP95Ms | 34.7 | 34.2 | -1.4 % | ±4.5 | pass |
| pine-hollow/phone/pose.gate.maskedFrac | 0.1 | 0.1 | +10.1 % |  | info |
| pine-hollow/phone/pose.gate.ssim | 0.9880 | 0.9855 | -0.3 % | ≥ 0.978 | pass |
| pine-hollow/phone/pose.gate.trisK | 1101.3 | 1104.3 | +0.3 % | ±115.1 | pass |
| pine-hollow/phone/pose.pond.calls | 88 | 88 | +0.0 % | ±13.8 | pass |
| pine-hollow/phone/pose.pond.cpuP50Ms | 2.7 | 2.2 | -18.5 % | ±1.3 | pass |
| pine-hollow/phone/pose.pond.cpuP95Ms | 4.0 | 2.8 | -30.0 % | ±1.4 | pass |
| pine-hollow/phone/pose.pond.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| pine-hollow/phone/pose.pond.frameP95Ms | 34.1 | 34.1 | +0.0 % | ±4.4 | pass |
| pine-hollow/phone/pose.pond.maskedFrac | 0 | 0 | +14.3 % |  | info |
| pine-hollow/phone/pose.pond.ssim | 0.9845 | 0.9761 | -0.9 % | ≥ 0.9745 | pass |
| pine-hollow/phone/pose.pond.trisK | 888.5 | 885.6 | -0.3 % | ±93.9 | pass |
| pine-hollow/phone/warm.longTaskMaxMs | 291 | 311 | +6.9 % | ±93.7 | pass |
| pine-hollow/phone/warm.netBytes | 0.00 | 0.00 | -0.1 % | ±0.06 | pass |
| pine-hollow/phone/warm.playMs | 2.11 | 2.26 | +7.0 % | ±0.36 | pass |
| pine-hollow/phone/warm.requests | 248 | 249 | +0.4 % | ±7 | pass |

**7 row regressions**, 1 better, 106 within the band; **0 budget rules missed**.

### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)

| rule | row | baseline | now | limit | verdict |
|---|---|---|---|---|---|
| first-play cold transfer ≤ 1.5× today: Driftwood phone ≤ 30.1 MiB | driftwood-isle/phone/cold.netBytes | 20.79 | 20.90 | ≤ 30.14 | pass |
| first-play cold transfer ≤ 1.5× today: Driftwood desktop ≤ 31.6 MiB | driftwood-isle/desktop/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× today: Nalati phone ≤ 43.4 MiB | nalati-grasslands/phone/cold.netBytes | 29.96 | 30.06 | ≤ 43.44 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati desktop ≤ 52.1 MiB | nalati-grasslands/desktop/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× today: Pine Hollow phone ≤ 53.8 MiB | pine-hollow/phone/cold.netBytes | 36.31 | 36.41 | ≤ 53.77 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow desktop ≤ 137.0 MiB | pine-hollow/desktop/cold.netBytes | | not measured | | n/a (enforced) |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/phone/cold.netBytes | 20.79 | 20.90 | ≤ 1.5× = 31.19 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/phone/cold.netBytes | 36.31 | 36.41 | ≤ 1.5× = 54.46 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/phone/cold.netBytes | 29.96 | 30.06 | ≤ 1.5× = 44.94 | pass |
| total SW cache, all three shards ≤ 300 MB | switch/*/cacheStorageBytes | | not measured | | n/a (enforced) |
| cold time-to-play no worse than today | driftwood-isle/phone/cold.playMs | 7.00 | 7.06 | ≤ 7.85 | pass |
| cold time-to-play no worse than today | pine-hollow/phone/cold.playMs | 10.58 | 10.63 | ≤ 11.79 | pass |
| cold time-to-play no worse than today | nalati-grasslands/phone/cold.playMs | 9.28 | 9.15 | ≤ 10.36 | pass |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/phone/cold4g.playMs | 26.95 | 24.71 | ≤ 29.80 | pass |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/phone/cold4g.playMs | 35.21 | 35.18 | ≤ 38.88 | pass |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/phone/cold4g.playMs | 31.63 | 31.66 | ≤ 34.94 | pass |
| Driftwood cold time-to-play on 4G ≤ 30 s | driftwood-isle/phone/cold4g.playMs | 26.95 | 24.71 | ≤ 30.00 | pass |
| Pine Hollow cold time-to-play on 4G ≤ 40 s (phone) | pine-hollow/phone/cold4g.playMs | 35.21 | 35.18 | ≤ 40.00 | pass |
| Nalati cold time-to-play on 4G ≤ 35.5 s (phone) | nalati-grasslands/phone/cold4g.playMs | 31.63 | 31.66 | ≤ 35.50 | pass |
| Nalati cold time-to-play on 4G ≤ 40.8 s (desktop) | nalati-grasslands/desktop/cold4g.playMs | | not measured | | n/a (enforced) |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/phone/warm.playMs | 1.96 | 2.01 | ≤ 2.30 | pass · goal (improve): not yet |
| warm time-to-play: no worse (goal: improve) | pine-hollow/phone/warm.playMs | 2.11 | 2.26 | ≤ 2.47 | pass · goal (improve): not yet |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/phone/warm.playMs | 3.26 | 3.43 | ≤ 3.73 | pass · goal (improve): not yet |
| shard switch time: no worse (goal: improve) | switch/*/*.ms | | not measured | | n/a (enforced) |
| bytes re-downloaded after a one-texture change ≤ 4 MB | retouch/*/netBytes | | not measured | | n/a (enforced) |
