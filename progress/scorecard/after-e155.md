# scorecard after-e155 — build b-muhg95uu, 2026-09-25 21:46

http://localhost:4281 · headless Chromium, ANGLE Metal, muted · network wifi (service worker throttled too) · CPU 1× · 1 run · 10 s of frames per pose · darwin arm64 node v24.18.1

## load

| shard / viewport | cold MB to play | cold req | cold MB until idle | cold play s | cold 4G play s | cold longest task ms | warm MB | warm req | warm play s | warm longest task ms |
|---|---|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 20.69 | 230 | 118.64 | 6.96 | 24.80 | 347 | 0.00 | 232 | 1.81 | 343 |
| driftwood-isle/desktop | 21.69 | 232 | 118.86 | 7.36 | 23.36 | 418 | 0.00 | 232 | 2.00 | 414 |
| nalati-grasslands/phone | 29.41 | 266 | 123.23 | 9.11 | 31.11 | 336 | 0.00 | 269 | 3.13 | 336 |
| nalati-grasslands/desktop | 35.36 | 268 | 118.86 | 11.16 | 37.22 | 1119 | 0.00 | 268 | 4.33 | 1093 |
| pine-hollow/phone | 34.75 | 265 | 133.96 | 11.15 | 34.49 | 297 | 0.00 | 270 | 2.06 | 288 |
| pine-hollow/desktop | 91.94 | 279 | 118.86 | 27.50 | 83.23 | 689 | 0.00 | 279 | 3.23 | 702 |

## memory (warm page, settled, after GC)

| shard / viewport | JS heap MB | GPU textures MB (GL) | renderbuffers MB | GPU buffers MB | scene textures MB (est) | textures | geometries | programs |
|---|---|---|---|---|---|---|---|---|
| driftwood-isle/phone | 34.68 | 264.23 | 0.33 | 109.02 | 31.53 | 109 | 424 | 98 |
| driftwood-isle/desktop | 36.23 | 370.09 | 7.19 | 194.34 | 59.03 | 127 | 772 | 105 |
| nalati-grasslands/phone | 46.62 | 96.97 | 39.16 | 64.70 | 112.46 | 127 | 114 | 96 |
| nalati-grasslands/desktop | 49.31 | 450.23 | 75.41 | 70.15 | 334.46 | 161 | 366 | 112 |
| pine-hollow/phone | 45.92 | 279.05 | 0.00 | 38.28 | 283.22 | 403 | 219 | 106 |
| pine-hollow/desktop | 47.67 | 1205.21 | 6.87 | 164.80 | 767.55 | 451 | 278 | 113 |

## runtime + look (per pose)

| shard / viewport / pose | fps | p95 frame ms | main-thread ms p50 / p95 | draw calls | tris k | SSIM vs golden |
|---|---|---|---|---|---|---|
| driftwood-isle/phone/pier | 60.0 | 17.3 | 2.7 / 3.3 | 233 | 1102.3 | 0.9791 |
| driftwood-isle/phone/beach | 60.0 | 17.3 | 2.8 / 3.4 | 228 | 1055.8 | 0.9796 |
| driftwood-isle/phone/wreck | 60.0 | 17.9 | 2.6 / 3.3 | 180 | 928.2 | 0.9784 |
| driftwood-isle/desktop/pier | 60.0 | 17.1 | 3.5 / 3.9 | 868 | 2980.7 | 0.9845 |
| driftwood-isle/desktop/beach | 60.0 | 17.0 | 3.3 / 3.8 | 567 | 2309.1 | 0.9839 |
| driftwood-isle/desktop/wreck | 60.0 | 17.9 | 3.0 / 4.2 | 239 | 1452.3 | 0.9725 |
| nalati-grasslands/phone/camp | 60.0 | 18.2 | 2.6 / 3.8 | 77 | 983.2 | 0.9467 |
| nalati-grasslands/phone/bridge | 60.0 | 18.2 | 2.6 / 4.0 | 87 | 1228.9 | 0.9793 |
| nalati-grasslands/phone/plains | 60.0 | 17.4 | 2.8 / 3.7 | 100 | 1216 | 0.8875 |
| nalati-grasslands/desktop/camp | 60.0 | 17.5 | 2.8 / 4.0 | 195 | 4297.8 | 0.9951 |
| nalati-grasslands/desktop/bridge | 60.0 | 17.3 | 3.0 / 4.1 | 430 | 5979.9 | 0.9948 |
| nalati-grasslands/desktop/plains | 60.0 | 17.3 | 3.0 / 4.0 | 268 | 5986.3 | 0.9789 |
| pine-hollow/phone/gate | 30.0 | 35.7 | 4.3 / 6.2 | 99 | 1101.3 | 0.9720 |
| pine-hollow/phone/cabin | 30.0 | 35.1 | 4.9 / 6.7 | 141 | 1305.1 | 0.9499 |
| pine-hollow/phone/pond | 30.0 | 35.9 | 4.4 / 6.1 | 88 | 888.5 | 0.9647 |
| pine-hollow/desktop/gate | 60.0 | 17.2 | 8.4 / 8.9 | 235 | 8355.8 | 0.9552 |
| pine-hollow/desktop/cabin | 60.0 | 18.0 | 7.5 / 7.9 | 269 | 7968.5 | 0.9476 |
| pine-hollow/desktop/pond | 60.0 | 17.4 | 4.7 / 5.3 | 176 | 4962.2 | 0.9499 |

Units: bytes rows in MiB, time rows in s, frame rows in ms. Row keys and raw values: the JSON.

## compare · after-e155 (b-muhg95uu) against baseline (b-muh8pnvl)

Band = max(rel, noise × baseline run-to-run spread) × baseline + abs (scorecard.budget.json `kinds`). REGRESS blocks the merge; `info` rows never fail.

| row | baseline | now | Δ | band | verdict |
|---|---|---|---|---|---|
| driftwood-isle/desktop/cold.idleNetBytes | 21.09 | 118.86 | +463.5 % | ±0.27 | **REGRESS** |
| driftwood-isle/desktop/cold.longTaskMaxMs | 352.5 | 418 | +18.6 % | ±102.9 | pass |
| driftwood-isle/desktop/cold.netBytes | 21.09 | 21.69 | +2.8 % | ±0.27 | **REGRESS** |
| driftwood-isle/desktop/cold.playMs | 7.24 | 7.36 | +1.7 % | ±0.87 | pass |
| driftwood-isle/desktop/cold.requests | 232 | 232 | +0.0 % | ±6.6 | pass |
| driftwood-isle/desktop/cold4g.playMs | 22.83 | 23.36 | +2.3 % | ±2.43 | pass |
| driftwood-isle/desktop/mem.geometries | 760 | 772 | +1.6 % | ±40 | pass |
| driftwood-isle/desktop/mem.glBufBytes | 190.66 | 194.34 | +1.9 % | ±11.53 | pass |
| driftwood-isle/desktop/mem.glRbBytes | 7.19 | 7.19 | +0.0 % | ±2.36 | pass |
| driftwood-isle/desktop/mem.glTexBytes | 370.09 | 370.09 | +0.0 % | ±20.50 | pass |
| driftwood-isle/desktop/mem.heapBytes | 34.35 | 36.23 | +5.5 % | ±3.72 | pass |
| driftwood-isle/desktop/mem.programs | 104 | 105 | +1.0 % | ±7.2 | pass |
| driftwood-isle/desktop/mem.sceneTexBytes | 59.03 | 59.03 | +0.0 % | ±4.95 | pass |
| driftwood-isle/desktop/mem.textures | 127 | 127 | +0.0 % | ±8.4 | pass |
| driftwood-isle/desktop/pose.beach.calls | 568 | 567 | -0.2 % | ±61.8 | pass |
| driftwood-isle/desktop/pose.beach.cpuP50Ms | 3.3 | 3.3 | +0.0 % | ±1.3 | pass |
| driftwood-isle/desktop/pose.beach.cpuP95Ms | 3.8 | 3.8 | +0.0 % | ±1.4 | pass |
| driftwood-isle/desktop/pose.beach.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| driftwood-isle/desktop/pose.beach.frameP95Ms | 17.1 | 17.0 | -0.6 % | ±2.7 | pass |
| driftwood-isle/desktop/pose.beach.ssim | 0.9916 | 0.9839 | -0.8 % | ≥ 0.98 | pass |
| driftwood-isle/desktop/pose.beach.trisK | 2479.1 | 2309.1 | -6.9 % | ±252.9 | pass |
| driftwood-isle/desktop/pose.pier.calls | 862 | 868 | +0.7 % | ±91.2 | pass |
| driftwood-isle/desktop/pose.pier.cpuP50Ms | 3.5 | 3.5 | -1.4 % | ±1.4 | pass |
| driftwood-isle/desktop/pose.pier.cpuP95Ms | 4.0 | 3.9 | -1.3 % | ±1.4 | pass |
| driftwood-isle/desktop/pose.pier.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| driftwood-isle/desktop/pose.pier.frameP95Ms | 17.0 | 17.1 | +0.6 % | ±2.7 | pass |
| driftwood-isle/desktop/pose.pier.ssim | 0.9904 | 0.9845 | -0.6 % | ≥ 0.98 | pass |
| driftwood-isle/desktop/pose.pier.trisK | 2980.8 | 2980.7 | -0.0 % | ±303.1 | pass |
| driftwood-isle/desktop/pose.wreck.calls | 239 | 239 | +0.0 % | ±28.9 | pass |
| driftwood-isle/desktop/pose.wreck.cpuP50Ms | 3.0 | 3.0 | -1.6 % | ±1.3 | pass |
| driftwood-isle/desktop/pose.wreck.cpuP95Ms | 4.2 | 4.2 | +0.0 % | ±1.4 | pass |
| driftwood-isle/desktop/pose.wreck.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| driftwood-isle/desktop/pose.wreck.frameP95Ms | 17.6 | 17.9 | +1.4 % | ±2.8 | pass |
| driftwood-isle/desktop/pose.wreck.ssim | 0.9860 | 0.9725 | -1.4 % | ≥ 0.976 | **REGRESS** |
| driftwood-isle/desktop/pose.wreck.trisK | 1462.2 | 1452.3 | -0.7 % | ±151.2 | pass |
| driftwood-isle/desktop/warm.longTaskMaxMs | 347 | 414 | +19.3 % | ±102.1 | pass |
| driftwood-isle/desktop/warm.netBytes | 0.00 | 0.00 | +235.4 % | ±0.06 | pass |
| driftwood-isle/desktop/warm.playMs | 1.88 | 2.00 | +6.6 % | ±0.34 | pass |
| driftwood-isle/desktop/warm.requests | 232 | 232 | +0.0 % | ±6.6 | pass |
| driftwood-isle/phone/cold.idleNetBytes | 20.10 | 118.64 | +490.4 % | ±0.26 | **REGRESS** |
| driftwood-isle/phone/cold.longTaskMaxMs | 299.5 | 347 | +15.9 % | ±94.9 | pass |
| driftwood-isle/phone/cold.netBytes | 20.10 | 20.69 | +3.0 % | ±0.26 | **REGRESS** |
| driftwood-isle/phone/cold.playMs | 6.82 | 6.96 | +2.0 % | ±0.83 | pass |
| driftwood-isle/phone/cold.requests | 227 | 230 | +1.3 % | ±6.5 | pass |
| driftwood-isle/phone/cold4g.playMs | 23.87 | 24.80 | +3.9 % | ±2.54 | pass |
| driftwood-isle/phone/mem.geometries | 407 | 424 | +4.2 % | ±22.4 | pass |
| driftwood-isle/phone/mem.glBufBytes | 100.87 | 109.02 | +8.1 % | ±7.04 | **REGRESS** |
| driftwood-isle/phone/mem.glRbBytes | 0.33 | 0.33 | +0.0 % | ±2.02 | pass |
| driftwood-isle/phone/mem.glTexBytes | 285.73 | 264.23 | -7.5 % | ±16.29 | better |
| driftwood-isle/phone/mem.heapBytes | 33.34 | 34.68 | +4.0 % | ±3.67 | pass |
| driftwood-isle/phone/mem.programs | 97 | 98 | +1.0 % | ±6.9 | pass |
| driftwood-isle/phone/mem.sceneTexBytes | 39.03 | 31.53 | -19.2 % | ±3.95 | better |
| driftwood-isle/phone/mem.textures | 109 | 109 | +0.0 % | ±7.5 | pass |
| driftwood-isle/phone/pose.beach.calls | 231 | 228 | -1.3 % | ±28.1 | pass |
| driftwood-isle/phone/pose.beach.cpuP50Ms | 2.6 | 2.8 | +7.7 % | ±1.8 | pass |
| driftwood-isle/phone/pose.beach.cpuP95Ms | 3.5 | 3.4 | -2.9 % | ±1.4 | pass |
| driftwood-isle/phone/pose.beach.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| driftwood-isle/phone/pose.beach.frameP95Ms | 17.8 | 17.3 | -2.8 % | ±2.8 | pass |
| driftwood-isle/phone/pose.beach.ssim | 0.9986 | 0.9796 | -1.9 % | ≥ 0.98 | **REGRESS** |
| driftwood-isle/phone/pose.beach.trisK | 1143 | 1055.8 | -7.6 % | ±119.3 | pass |
| driftwood-isle/phone/pose.pier.calls | 232 | 233 | +0.4 % | ±28.2 | pass |
| driftwood-isle/phone/pose.pier.cpuP50Ms | 2.5 | 2.7 | +5.9 % | ±1.6 | pass |
| driftwood-isle/phone/pose.pier.cpuP95Ms | 3.5 | 3.3 | -4.3 % | ±1.3 | pass |
| driftwood-isle/phone/pose.pier.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| driftwood-isle/phone/pose.pier.frameP95Ms | 17.9 | 17.3 | -3.1 % | ±2.8 | pass |
| driftwood-isle/phone/pose.pier.ssim | 0.9872 | 0.9791 | -0.8 % | ≥ 0.9772 | pass |
| driftwood-isle/phone/pose.pier.trisK | 1100 | 1102.3 | +0.2 % | ±115 | pass |
| driftwood-isle/phone/pose.wreck.calls | 179.5 | 180 | +0.3 % | ±23 | pass |
| driftwood-isle/phone/pose.wreck.cpuP50Ms | 2.7 | 2.6 | -3.7 % | ±1.3 | pass |
| driftwood-isle/phone/pose.wreck.cpuP95Ms | 3.5 | 3.3 | -4.3 % | ±1.3 | pass |
| driftwood-isle/phone/pose.wreck.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| driftwood-isle/phone/pose.wreck.frameP95Ms | 17.4 | 17.9 | +2.9 % | ±2.7 | pass |
| driftwood-isle/phone/pose.wreck.ssim | 0.9922 | 0.9784 | -1.4 % | ≥ 0.98 | **REGRESS** |
| driftwood-isle/phone/pose.wreck.trisK | 915.3 | 928.2 | +1.4 % | ±96.5 | pass |
| driftwood-isle/phone/warm.longTaskMaxMs | 286.5 | 343 | +19.7 % | ±93 | pass |
| driftwood-isle/phone/warm.netBytes | 0.00 | 0.00 | +509.2 % | ±0.06 | pass |
| driftwood-isle/phone/warm.playMs | 1.73 | 1.81 | +4.2 % | ±0.32 | pass |
| driftwood-isle/phone/warm.requests | 227 | 232 | +2.2 % | ±6.5 | pass |
| nalati-grasslands/desktop/cold.idleNetBytes | 34.76 | 118.86 | +241.9 % | ±0.41 | **REGRESS** |
| nalati-grasslands/desktop/cold.longTaskMaxMs | 1118 | 1119 | +0.1 % | ±217.7 | pass |
| nalati-grasslands/desktop/cold.netBytes | 34.76 | 35.36 | +1.7 % | ±0.41 | **REGRESS** |
| nalati-grasslands/desktop/cold.playMs | 11.07 | 11.16 | +0.8 % | ±1.26 | pass |
| nalati-grasslands/desktop/cold.requests | 268 | 268 | +0.0 % | ±7.4 | pass |
| nalati-grasslands/desktop/cold4g.playMs | 37.02 | 37.22 | +0.5 % | ±3.85 | pass |
| nalati-grasslands/desktop/mem.geometries | 366 | 366 | +0.0 % | ±20.3 | pass |
| nalati-grasslands/desktop/mem.glBufBytes | 70.15 | 70.15 | +0.0 % | ±5.51 | pass |
| nalati-grasslands/desktop/mem.glRbBytes | 75.41 | 75.41 | +0.0 % | ±5.77 | pass |
| nalati-grasslands/desktop/mem.glTexBytes | 450.23 | 450.23 | +0.0 % | ±24.51 | pass |
| nalati-grasslands/desktop/mem.heapBytes | 47.23 | 49.31 | +4.4 % | ±4.36 | pass |
| nalati-grasslands/desktop/mem.programs | 112 | 112 | +0.0 % | ±7.6 | pass |
| nalati-grasslands/desktop/mem.sceneTexBytes | 334.46 | 334.46 | +0.0 % | ±18.72 | pass |
| nalati-grasslands/desktop/mem.textures | 161 | 161 | +0.0 % | ±10.1 | pass |
| nalati-grasslands/desktop/pose.bridge.calls | 430 | 430 | +0.0 % | ±48 | pass |
| nalati-grasslands/desktop/pose.bridge.cpuP50Ms | 3.0 | 3.0 | +0.0 % | ±1.3 | pass |
| nalati-grasslands/desktop/pose.bridge.cpuP95Ms | 4.1 | 4.1 | +0.0 % | ±1.4 | pass |
| nalati-grasslands/desktop/pose.bridge.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| nalati-grasslands/desktop/pose.bridge.frameP95Ms | 17.3 | 17.3 | +0.0 % | ±2.7 | pass |
| nalati-grasslands/desktop/pose.bridge.ssim | 0.9914 | 0.9948 | +0.3 % | ≥ 0.98 | pass |
| nalati-grasslands/desktop/pose.bridge.trisK | 5979.9 | 5979.9 | +0.0 % | ±603 | pass |
| nalati-grasslands/desktop/pose.camp.calls | 195 | 195 | +0.0 % | ±24.5 | pass |
| nalati-grasslands/desktop/pose.camp.cpuP50Ms | 2.8 | 2.8 | +1.8 % | ±1.3 | pass |
| nalati-grasslands/desktop/pose.camp.cpuP95Ms | 4.0 | 4.0 | -1.2 % | ±1.4 | pass |
| nalati-grasslands/desktop/pose.camp.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| nalati-grasslands/desktop/pose.camp.frameP95Ms | 17.4 | 17.5 | +0.3 % | ±2.7 | pass |
| nalati-grasslands/desktop/pose.camp.ssim | 0.9944 | 0.9951 | +0.1 % | ≥ 0.98 | pass |
| nalati-grasslands/desktop/pose.camp.trisK | 4297.8 | 4297.8 | +0.0 % | ±434.8 | pass |
| nalati-grasslands/desktop/pose.plains.calls | 268 | 268 | +0.0 % | ±31.8 | pass |
| nalati-grasslands/desktop/pose.plains.cpuP50Ms | 3.0 | 3.0 | +0.0 % | ±1.3 | pass |
| nalati-grasslands/desktop/pose.plains.cpuP95Ms | 3.9 | 4.0 | +2.6 % | ±1.4 | pass |
| nalati-grasslands/desktop/pose.plains.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| nalati-grasslands/desktop/pose.plains.frameP95Ms | 17.4 | 17.3 | -0.6 % | ±2.7 | pass |
| nalati-grasslands/desktop/pose.plains.ssim | 0.9702 | 0.9789 | +0.9 % | ≥ 0.9602 | pass |
| nalati-grasslands/desktop/pose.plains.trisK | 5991.5 | 5986.3 | -0.1 % | ±604.2 | pass |
| nalati-grasslands/desktop/warm.longTaskMaxMs | 1108.5 | 1093 | -1.4 % | ±216.3 | pass |
| nalati-grasslands/desktop/warm.netBytes | 0.00 | 0.00 | +378.8 % | ±0.06 | pass |
| nalati-grasslands/desktop/warm.playMs | 4.33 | 4.33 | -0.0 % | ±0.58 | pass |
| nalati-grasslands/desktop/warm.requests | 268 | 268 | +0.0 % | ±7.4 | pass |
| nalati-grasslands/phone/cold.idleNetBytes | 28.96 | 123.23 | +325.5 % | ±0.35 | **REGRESS** |
| nalati-grasslands/phone/cold.longTaskMaxMs | 333 | 336 | +0.9 % | ±99.9 | pass |
| nalati-grasslands/phone/cold.netBytes | 28.96 | 29.41 | +1.5 % | ±0.35 | **REGRESS** |
| nalati-grasslands/phone/cold.playMs | 9.23 | 9.11 | -1.4 % | ±1.07 | pass |
| nalati-grasslands/phone/cold.requests | 232 | 266 | +14.7 % | ±6.6 | **REGRESS** |
| nalati-grasslands/phone/cold4g.playMs | 32.00 | 31.11 | -2.8 % | ±3.35 | pass |
| nalati-grasslands/phone/mem.geometries | 114 | 114 | +0.0 % | ±7.7 | pass |
| nalati-grasslands/phone/mem.glBufBytes | 64.70 | 64.70 | +0.0 % | ±5.24 | pass |
| nalati-grasslands/phone/mem.glRbBytes | 39.16 | 39.16 | +0.0 % | ±3.96 | pass |
| nalati-grasslands/phone/mem.glTexBytes | 129.89 | 96.97 | -25.3 % | ±8.49 | better |
| nalati-grasslands/phone/mem.heapBytes | 45.41 | 46.62 | +2.7 % | ±4.27 | pass |
| nalati-grasslands/phone/mem.programs | 96 | 96 | +0.0 % | ±6.8 | pass |
| nalati-grasslands/phone/mem.sceneTexBytes | 122.07 | 112.46 | -7.9 % | ±8.10 | better |
| nalati-grasslands/phone/mem.textures | 127 | 127 | +0.0 % | ±8.4 | pass |
| nalati-grasslands/phone/pose.bridge.calls | 87 | 87 | +0.0 % | ±13.7 | pass |
| nalati-grasslands/phone/pose.bridge.cpuP50Ms | 2.6 | 2.6 | +0.0 % | ±1.3 | pass |
| nalati-grasslands/phone/pose.bridge.cpuP95Ms | 3.8 | 4.0 | +3.9 % | ±1.4 | pass |
| nalati-grasslands/phone/pose.bridge.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| nalati-grasslands/phone/pose.bridge.frameP95Ms | 17.9 | 18.2 | +1.7 % | ±2.8 | pass |
| nalati-grasslands/phone/pose.bridge.ssim | 0.9953 | 0.9793 | -1.6 % | ≥ 0.98 | **REGRESS** |
| nalati-grasslands/phone/pose.bridge.trisK | 1228.9 | 1228.9 | +0.0 % | ±127.9 | pass |
| nalati-grasslands/phone/pose.camp.calls | 77 | 77 | +0.0 % | ±12.7 | pass |
| nalati-grasslands/phone/pose.camp.cpuP50Ms | 2.7 | 2.6 | -3.7 % | ±1.3 | pass |
| nalati-grasslands/phone/pose.camp.cpuP95Ms | 3.6 | 3.8 | +5.6 % | ±1.4 | pass |
| nalati-grasslands/phone/pose.camp.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| nalati-grasslands/phone/pose.camp.frameP95Ms | 17.7 | 18.2 | +2.8 % | ±2.8 | pass |
| nalati-grasslands/phone/pose.camp.ssim | 0.9947 | 0.9467 | -4.8 % | ≥ 0.98 | **REGRESS** |
| nalati-grasslands/phone/pose.camp.trisK | 983.2 | 983.2 | +0.0 % | ±103.3 | pass |
| nalati-grasslands/phone/pose.plains.calls | 105 | 100 | -4.8 % | ±15.5 | pass |
| nalati-grasslands/phone/pose.plains.cpuP50Ms | 2.8 | 2.8 | +1.8 % | ±1.3 | pass |
| nalati-grasslands/phone/pose.plains.cpuP95Ms | 3.6 | 3.7 | +1.4 % | ±1.6 | pass |
| nalati-grasslands/phone/pose.plains.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| nalati-grasslands/phone/pose.plains.frameP95Ms | 17.9 | 17.4 | -2.5 % | ±3.2 | pass |
| nalati-grasslands/phone/pose.plains.ssim | 0.9652 | 0.8875 | -8.1 % | ≥ 0.9552 | **REGRESS** |
| nalati-grasslands/phone/pose.plains.trisK | 1238.5 | 1216 | -1.8 % | ±128.9 | pass |
| nalati-grasslands/phone/warm.longTaskMaxMs | 324 | 336 | +3.7 % | ±98.6 | pass |
| nalati-grasslands/phone/warm.netBytes | 0.00 | 0.00 | +509.2 % | ±0.06 | pass |
| nalati-grasslands/phone/warm.playMs | 3.13 | 3.13 | -0.0 % | ±0.46 | pass |
| nalati-grasslands/phone/warm.requests | 232 | 269 | +15.9 % | ±6.6 | **REGRESS** |
| pine-hollow/desktop/cold.idleNetBytes | 91.36 | 118.86 | +30.1 % | ±0.98 | **REGRESS** |
| pine-hollow/desktop/cold.longTaskMaxMs | 706.5 | 689 | -2.5 % | ±156 | pass |
| pine-hollow/desktop/cold.netBytes | 91.36 | 91.94 | +0.6 % | ±0.98 | pass |
| pine-hollow/desktop/cold.playMs | 27.47 | 27.50 | +0.1 % | ±2.90 | pass |
| pine-hollow/desktop/cold.requests | 279 | 279 | +0.0 % | ±7.6 | pass |
| pine-hollow/desktop/cold4g.playMs | 83.30 | 83.23 | -0.1 % | ±8.48 | pass |
| pine-hollow/desktop/mem.geometries | 278 | 278 | +0.0 % | ±15.9 | pass |
| pine-hollow/desktop/mem.glBufBytes | 164.80 | 164.80 | +0.0 % | ±10.24 | pass |
| pine-hollow/desktop/mem.glRbBytes | 6.87 | 6.87 | +0.0 % | ±2.34 | pass |
| pine-hollow/desktop/mem.glTexBytes | 1205.21 | 1205.21 | +0.0 % | ±62.26 | pass |
| pine-hollow/desktop/mem.heapBytes | 46.16 | 47.67 | +3.3 % | ±4.31 | pass |
| pine-hollow/desktop/mem.programs | 113 | 113 | +0.0 % | ±7.7 | pass |
| pine-hollow/desktop/mem.sceneTexBytes | 767.55 | 767.55 | +0.0 % | ±40.38 | pass |
| pine-hollow/desktop/mem.textures | 451 | 451 | +0.0 % | ±24.6 | pass |
| pine-hollow/desktop/pose.cabin.calls | 269 | 269 | +0.0 % | ±31.9 | pass |
| pine-hollow/desktop/pose.cabin.cpuP50Ms | 7.7 | 7.5 | -2.0 % | ±1.8 | pass |
| pine-hollow/desktop/pose.cabin.cpuP95Ms | 8.0 | 7.9 | -1.2 % | ±1.8 | pass |
| pine-hollow/desktop/pose.cabin.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| pine-hollow/desktop/pose.cabin.frameP95Ms | 17.2 | 18.0 | +4.7 % | ±2.7 | pass |
| pine-hollow/desktop/pose.cabin.ssim | 0.9475 | 0.9476 | +0.0 % | ≥ 0.9375 | pass |
| pine-hollow/desktop/pose.cabin.trisK | 7972.3 | 7968.5 | -0.0 % | ±802.2 | pass |
| pine-hollow/desktop/pose.gate.calls | 235 | 235 | +0.0 % | ±28.5 | pass |
| pine-hollow/desktop/pose.gate.cpuP50Ms | 8.7 | 8.4 | -3.4 % | ±1.9 | pass |
| pine-hollow/desktop/pose.gate.cpuP95Ms | 9.2 | 8.9 | -2.7 % | ±1.9 | pass |
| pine-hollow/desktop/pose.gate.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| pine-hollow/desktop/pose.gate.frameP95Ms | 17.9 | 17.2 | -3.9 % | ±2.8 | pass |
| pine-hollow/desktop/pose.gate.ssim | 0.9567 | 0.9552 | -0.2 % | ≥ 0.9467 | pass |
| pine-hollow/desktop/pose.gate.trisK | 8355.8 | 8355.8 | +0.0 % | ±840.6 | pass |
| pine-hollow/desktop/pose.pond.calls | 176 | 176 | +0.0 % | ±22.6 | pass |
| pine-hollow/desktop/pose.pond.cpuP50Ms | 5.0 | 4.7 | -6.0 % | ±1.5 | pass |
| pine-hollow/desktop/pose.pond.cpuP95Ms | 5.4 | 5.3 | -2.8 % | ±1.6 | pass |
| pine-hollow/desktop/pose.pond.fps | 60.0 | 60.0 | +0.0 % | ±7.0 | pass |
| pine-hollow/desktop/pose.pond.frameP95Ms | 17.2 | 17.4 | +1.2 % | ±2.7 | pass |
| pine-hollow/desktop/pose.pond.ssim | 0.9564 | 0.9499 | -0.7 % | ≥ 0.9464 | pass |
| pine-hollow/desktop/pose.pond.trisK | 4957 | 4962.2 | +0.1 % | ±500.7 | pass |
| pine-hollow/desktop/warm.longTaskMaxMs | 692.5 | 702 | +1.4 % | ±153.9 | pass |
| pine-hollow/desktop/warm.netBytes | 2.13 | 0.00 | -99.8 % | ±0.08 | better |
| pine-hollow/desktop/warm.playMs | 3.50 | 3.23 | -7.6 % | ±0.50 | pass |
| pine-hollow/desktop/warm.requests | 279 | 279 | +0.0 % | ±7.6 | pass |
| pine-hollow/phone/cold.idleNetBytes | 35.84 | 133.96 | +273.7 % | ±0.42 | **REGRESS** |
| pine-hollow/phone/cold.longTaskMaxMs | 295 | 297 | +0.7 % | ±94.3 | pass |
| pine-hollow/phone/cold.netBytes | 35.84 | 34.75 | -3.1 % | ±0.42 | better |
| pine-hollow/phone/cold.playMs | 10.50 | 11.15 | +6.2 % | ±1.20 | pass |
| pine-hollow/phone/cold.requests | 145 | 265 | +82.8 % | ±4.9 | **REGRESS** |
| pine-hollow/phone/cold4g.playMs | 35.31 | 34.49 | -2.3 % | ±3.68 | pass |
| pine-hollow/phone/mem.geometries | 219 | 219 | +0.0 % | ±13 | pass |
| pine-hollow/phone/mem.glBufBytes | 38.28 | 38.28 | +0.0 % | ±3.91 | pass |
| pine-hollow/phone/mem.glRbBytes | 0.00 | 0.00 | +0.00 | ±2.00 | pass |
| pine-hollow/phone/mem.glTexBytes | 558.71 | 279.05 | -50.1 % | ±29.94 | better |
| pine-hollow/phone/mem.heapBytes | 43.63 | 45.92 | +5.2 % | ±4.18 | pass |
| pine-hollow/phone/mem.programs | 106 | 106 | +0.0 % | ±7.3 | pass |
| pine-hollow/phone/mem.sceneTexBytes | 362.55 | 283.22 | -21.9 % | ±20.13 | better |
| pine-hollow/phone/mem.textures | 406 | 403 | -0.7 % | ±22.3 | pass |
| pine-hollow/phone/pose.cabin.calls | 141 | 141 | +0.0 % | ±19.1 | pass |
| pine-hollow/phone/pose.cabin.cpuP50Ms | 4.9 | 4.9 | +0.0 % | ±1.5 | pass |
| pine-hollow/phone/pose.cabin.cpuP95Ms | 6.3 | 6.7 | +7.2 % | ±1.6 | pass |
| pine-hollow/phone/pose.cabin.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| pine-hollow/phone/pose.cabin.frameP95Ms | 35.0 | 35.1 | +0.1 % | ±4.5 | pass |
| pine-hollow/phone/pose.cabin.ssim | 0.9882 | 0.9499 | -3.9 % | ≥ 0.9782 | **REGRESS** |
| pine-hollow/phone/pose.cabin.trisK | 1301 | 1305.1 | +0.3 % | ±135.1 | pass |
| pine-hollow/phone/pose.gate.calls | 99 | 99 | +0.0 % | ±14.9 | pass |
| pine-hollow/phone/pose.gate.cpuP50Ms | 4.4 | 4.3 | -0.6 % | ±1.4 | pass |
| pine-hollow/phone/pose.gate.cpuP95Ms | 6.1 | 6.2 | +1.6 % | ±1.8 | pass |
| pine-hollow/phone/pose.gate.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| pine-hollow/phone/pose.gate.frameP95Ms | 35.4 | 35.7 | +0.8 % | ±4.5 | pass |
| pine-hollow/phone/pose.gate.ssim | 0.9880 | 0.9720 | -1.6 % | ≥ 0.978 | **REGRESS** |
| pine-hollow/phone/pose.gate.trisK | 1101.3 | 1101.3 | +0.0 % | ±115.1 | pass |
| pine-hollow/phone/pose.pond.calls | 88 | 88 | +0.0 % | ±13.8 | pass |
| pine-hollow/phone/pose.pond.cpuP50Ms | 4.3 | 4.4 | +1.1 % | ±1.6 | pass |
| pine-hollow/phone/pose.pond.cpuP95Ms | 6.3 | 6.1 | -2.4 % | ±1.6 | pass |
| pine-hollow/phone/pose.pond.fps | 30.0 | 30.0 | +0.0 % | ±4.0 | pass |
| pine-hollow/phone/pose.pond.frameP95Ms | 35.1 | 35.9 | +2.3 % | ±4.5 | pass |
| pine-hollow/phone/pose.pond.ssim | 0.9844 | 0.9647 | -2.0 % | ≥ 0.9744 | **REGRESS** |
| pine-hollow/phone/pose.pond.trisK | 888.5 | 888.5 | +0.0 % | ±93.9 | pass |
| pine-hollow/phone/warm.longTaskMaxMs | 283 | 288 | +1.8 % | ±92.4 | pass |
| pine-hollow/phone/warm.netBytes | 0.00 | 0.00 | +509.2 % | ±0.06 | pass |
| pine-hollow/phone/warm.playMs | 2.08 | 2.06 | -1.1 % | ±0.36 | pass |
| pine-hollow/phone/warm.requests | 144 | 270 | +87.5 % | ±4.9 | **REGRESS** |
| retouch/desktop/netBytes | 2.51 | — | | | **MISSING** |
| retouch/phone/netBytes | 19.70 | — | | | **MISSING** |
| switch/desktop/1.driftwood-isle>nalati-grasslands.glTexBytes | 450.23 | — | | | **MISSING** |
| switch/desktop/1.driftwood-isle>nalati-grasslands.heapBytes | 51.45 | — | | | **MISSING** |
| switch/desktop/1.driftwood-isle>nalati-grasslands.loadingShown | 1 | — | | | missing (info) |
| switch/desktop/1.driftwood-isle>nalati-grasslands.longTaskMaxMs | 1132 | — | | | **MISSING** |
| switch/desktop/1.driftwood-isle>nalati-grasslands.ms | 6.56 | — | | | **MISSING** |
| switch/desktop/1.driftwood-isle>nalati-grasslands.navigated | 1 | — | | | missing (info) |
| switch/desktop/1.driftwood-isle>nalati-grasslands.netBytes | 17.38 | — | | | **MISSING** |
| switch/desktop/2.nalati-grasslands>pine-hollow.glTexBytes | 1205.21 | — | | | **MISSING** |
| switch/desktop/2.nalati-grasslands>pine-hollow.heapBytes | 49.06 | — | | | **MISSING** |
| switch/desktop/2.nalati-grasslands>pine-hollow.loadingShown | 1 | — | | | missing (info) |
| switch/desktop/2.nalati-grasslands>pine-hollow.longTaskMaxMs | 689.5 | — | | | **MISSING** |
| switch/desktop/2.nalati-grasslands>pine-hollow.ms | 24.20 | — | | | **MISSING** |
| switch/desktop/2.nalati-grasslands>pine-hollow.navigated | 1 | — | | | missing (info) |
| switch/desktop/2.nalati-grasslands>pine-hollow.netBytes | 79.82 | — | | | **MISSING** |
| switch/desktop/3.pine-hollow>driftwood-isle.glTexBytes | 370.09 | — | | | **MISSING** |
| switch/desktop/3.pine-hollow>driftwood-isle.heapBytes | 34.52 | — | | | **MISSING** |
| switch/desktop/3.pine-hollow>driftwood-isle.loadingShown | 1 | — | | | missing (info) |
| switch/desktop/3.pine-hollow>driftwood-isle.longTaskMaxMs | 350 | — | | | **MISSING** |
| switch/desktop/3.pine-hollow>driftwood-isle.ms | 3.66 | — | | | **MISSING** |
| switch/desktop/3.pine-hollow>driftwood-isle.navigated | 1 | — | | | missing (info) |
| switch/desktop/3.pine-hollow>driftwood-isle.netBytes | 1.70 | — | | | **MISSING** |
| switch/desktop/cacheStorageBytes | 127.53 | 123.76 | -3.0 % | ±1.34 | better |
| switch/desktop/prefetchBytes | 0 | 101897574 | +101897574 |  | info |
| switch/phone/1.driftwood-isle>nalati-grasslands.glTexBytes | 129.89 | — | | | **MISSING** |
| switch/phone/1.driftwood-isle>nalati-grasslands.heapBytes | 48.31 | — | | | **MISSING** |
| switch/phone/1.driftwood-isle>nalati-grasslands.loadingShown | 1 | — | | | missing (info) |
| switch/phone/1.driftwood-isle>nalati-grasslands.longTaskMaxMs | 336 | — | | | **MISSING** |
| switch/phone/1.driftwood-isle>nalati-grasslands.ms | 4.25 | — | | | **MISSING** |
| switch/phone/1.driftwood-isle>nalati-grasslands.navigated | 1 | — | | | missing (info) |
| switch/phone/1.driftwood-isle>nalati-grasslands.netBytes | 12.38 | — | | | **MISSING** |
| switch/phone/2.nalati-grasslands>pine-hollow.glTexBytes | 555.38 | — | | | **MISSING** |
| switch/phone/2.nalati-grasslands>pine-hollow.heapBytes | 47.10 | — | | | **MISSING** |
| switch/phone/2.nalati-grasslands>pine-hollow.loadingShown | 1 | — | | | missing (info) |
| switch/phone/2.nalati-grasslands>pine-hollow.longTaskMaxMs | 344.5 | — | | | **MISSING** |
| switch/phone/2.nalati-grasslands>pine-hollow.ms | 7.50 | — | | | **MISSING** |
| switch/phone/2.nalati-grasslands>pine-hollow.navigated | 1 | — | | | missing (info) |
| switch/phone/2.nalati-grasslands>pine-hollow.netBytes | 25.11 | — | | | **MISSING** |
| switch/phone/3.pine-hollow>driftwood-isle.glTexBytes | 285.73 | — | | | **MISSING** |
| switch/phone/3.pine-hollow>driftwood-isle.heapBytes | 32.37 | — | | | **MISSING** |
| switch/phone/3.pine-hollow>driftwood-isle.loadingShown | 1 | — | | | missing (info) |
| switch/phone/3.pine-hollow>driftwood-isle.longTaskMaxMs | 289 | — | | | **MISSING** |
| switch/phone/3.pine-hollow>driftwood-isle.ms | 1.62 | — | | | **MISSING** |
| switch/phone/3.pine-hollow>driftwood-isle.navigated | 1 | — | | | missing (info) |
| switch/phone/3.pine-hollow>driftwood-isle.netBytes | 0.00 | — | | | **MISSING** |
| switch/phone/cacheStorageBytes | 66.72 | 132.49 | +98.6 % | ±0.73 | **REGRESS** |
| switch/phone/prefetchBytes | 0 | 102703678 | +102703678 |  | info |

**57 row regressions**, 9 better, 202 within the band; **2 budget rules missed**.

### budget rules (scorecard.budget.json `rules`: enforced ones fail the compare, proposed ones only print)

| rule | row | baseline | now | limit | verdict |
|---|---|---|---|---|---|
| first-play cold transfer ≤ 1.5× today: Driftwood phone ≤ 30.1 MiB | driftwood-isle/phone/cold.netBytes | 20.10 | 20.69 | ≤ 30.14 | pass |
| first-play cold transfer ≤ 1.5× today: Driftwood desktop ≤ 31.6 MiB | driftwood-isle/desktop/cold.netBytes | 21.09 | 21.69 | ≤ 31.64 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati phone ≤ 43.4 MiB | nalati-grasslands/phone/cold.netBytes | 28.96 | 29.41 | ≤ 43.44 | pass |
| first-play cold transfer ≤ 1.5× today: Nalati desktop ≤ 52.1 MiB | nalati-grasslands/desktop/cold.netBytes | 34.76 | 35.36 | ≤ 52.15 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow phone ≤ 53.8 MiB | pine-hollow/phone/cold.netBytes | 35.84 | 34.75 | ≤ 53.77 | pass |
| first-play cold transfer ≤ 1.5× today: Pine Hollow desktop ≤ 137.0 MiB | pine-hollow/desktop/cold.netBytes | 91.36 | 91.94 | ≤ 137.04 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/phone/cold.netBytes | 20.10 | 20.69 | ≤ 1.5× = 30.14 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | driftwood-isle/desktop/cold.netBytes | 21.09 | 21.69 | ≤ 1.5× = 31.64 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/phone/cold.netBytes | 28.96 | 29.41 | ≤ 1.5× = 43.44 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | nalati-grasslands/desktop/cold.netBytes | 34.76 | 35.36 | ≤ 1.5× = 52.15 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/phone/cold.netBytes | 35.84 | 34.75 | ≤ 1.5× = 53.77 | pass |
| first-play cold transfer ≤ 1.5× the baseline (any row the explicit ones above miss) | pine-hollow/desktop/cold.netBytes | 91.36 | 91.94 | ≤ 1.5× = 137.04 | pass |
| total SW cache, all three shards ≤ 300 MB | switch/phone/cacheStorageBytes | 66.72 | 132.49 | ≤ 300.00 | pass |
| total SW cache, all three shards ≤ 300 MB | switch/desktop/cacheStorageBytes | 127.53 | 123.76 | ≤ 300.00 | pass |
| cold time-to-play no worse than today | driftwood-isle/phone/cold.playMs | 6.82 | 6.96 | ≤ 7.65 | pass |
| cold time-to-play no worse than today | driftwood-isle/desktop/cold.playMs | 7.24 | 7.36 | ≤ 8.11 | pass |
| cold time-to-play no worse than today | nalati-grasslands/phone/cold.playMs | 9.23 | 9.11 | ≤ 10.30 | pass |
| cold time-to-play no worse than today | nalati-grasslands/desktop/cold.playMs | 11.07 | 11.16 | ≤ 12.32 | pass |
| cold time-to-play no worse than today | pine-hollow/phone/cold.playMs | 10.50 | 11.15 | ≤ 11.70 | pass |
| cold time-to-play no worse than today | pine-hollow/desktop/cold.playMs | 27.47 | 27.50 | ≤ 30.37 | pass |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/phone/cold4g.playMs | 23.87 | 24.80 | ≤ 26.41 | pass |
| cold time-to-play no worse than today, Fast 4G | driftwood-isle/desktop/cold4g.playMs | 22.83 | 23.36 | ≤ 25.26 | pass |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/phone/cold4g.playMs | 32.00 | 31.11 | ≤ 35.35 | pass |
| cold time-to-play no worse than today, Fast 4G | nalati-grasslands/desktop/cold4g.playMs | 37.02 | 37.22 | ≤ 40.88 | pass |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/phone/cold4g.playMs | 35.31 | 34.49 | ≤ 38.99 | pass |
| cold time-to-play no worse than today, Fast 4G | pine-hollow/desktop/cold4g.playMs | 83.30 | 83.23 | ≤ 91.78 | pass |
| Driftwood cold time-to-play on 4G ≤ 22 s | driftwood-isle/phone/cold4g.playMs | 23.87 | 24.80 | ≤ 22.00 | **FAIL** |
| Driftwood cold time-to-play on 4G ≤ 22 s | driftwood-isle/desktop/cold4g.playMs | 22.83 | 23.36 | ≤ 22.00 | **FAIL** |
| Pine Hollow cold time-to-play on 4G ≤ 40 s (phone) | pine-hollow/phone/cold4g.playMs | 35.31 | 34.49 | ≤ 40.00 | pass |
| Nalati cold time-to-play on 4G ≤ 35.5 s (phone) | nalati-grasslands/phone/cold4g.playMs | 32.00 | 31.11 | ≤ 35.50 | pass |
| Nalati cold time-to-play on 4G ≤ 40.8 s (desktop) | nalati-grasslands/desktop/cold4g.playMs | 37.02 | 37.22 | ≤ 40.80 | pass |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/phone/warm.playMs | 1.73 | 1.81 | ≤ 2.06 | pass · goal (improve): not yet |
| warm time-to-play: no worse (goal: improve) | driftwood-isle/desktop/warm.playMs | 1.88 | 2.00 | ≤ 2.22 | pass · goal (improve): not yet |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/phone/warm.playMs | 3.13 | 3.13 | ≤ 3.60 | pass · goal (improve): not yet |
| warm time-to-play: no worse (goal: improve) | nalati-grasslands/desktop/warm.playMs | 4.33 | 4.33 | ≤ 4.92 | pass · goal (improve): not yet |
| warm time-to-play: no worse (goal: improve) | pine-hollow/phone/warm.playMs | 2.08 | 2.06 | ≤ 2.44 | pass · goal (improve): not yet |
| warm time-to-play: no worse (goal: improve) | pine-hollow/desktop/warm.playMs | 3.50 | 3.23 | ≤ 4.00 | pass · goal (improve): not yet |
| shard switch time: no worse (goal: improve) | switch/*/*.ms | | not measured | | n/a (enforced) |
| bytes re-downloaded after a one-texture change ≤ 2 MB | retouch/*/netBytes | | not measured | | n/a (enforced) |
