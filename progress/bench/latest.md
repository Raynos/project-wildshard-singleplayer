## bench 232eace-mu6dtfyq — 2026-09-18 03:13 · http://localhost:4175 · cpu 4× · 1 run · 1280×720 headless · ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)

*Phase 0 baseline. Taken under load (three stray headless Chromes, load average 24): counts valid, ms suspect.*

| condition | bytes MB net / cache | requests | title s | play s | long tasks n / ms / max | textures | programs | heap MB | sw |
|---|---|---|---|---|---|---|---|---|---|
| wifi/cold | 72.75 / 0.00<br><small>js 0.4 · css 0.0 · jpg 58.9 · png 1.6 · hdr 4.0 · glb 6.8 · gltf 0.0 · bin 0.9 · font 0.1 · json 0.0 · html 0.0 · other 0.0</small> | 78 | 0.52 | 30.30 | 15 / 5752 / 1244 | 166 | 156 | 130.2 | yes · 68 served |
| wifi/warm | 0.05 / 75.61<br><small>js 1.2 · css 0.0 · jpg 61.4 · png 1.3 · hdr 4.0 · glb 6.8 · gltf 0.0 · bin 0.9 · font 0.0 · json 0.0 · html 0.0</small> | 78 | 0.37 | 10.65 | 16 / 6275 / 1374 | 166 | 156 | 132.8 | yes · 71 served |
| 4g/cold | 72.75 / 0.00<br><small>js 0.4 · css 0.0 · jpg 58.9 · png 1.6 · hdr 4.0 · glb 6.8 · gltf 0.0 · bin 0.9 · font 0.1 · json 0.0 · html 0.0 · other 0.0</small> | 78 | 0.97 | 79.30 | 16 / 6505 / 1370 | 166 | 156 | 124.5 | yes · 67 served |
| 4g/warm | 0.05 / 75.61<br><small>js 1.2 · css 0.0 · jpg 61.4 · png 1.3 · hdr 4.0 · glb 6.8 · gltf 0.0 · bin 0.9 · font 0.0 · json 0.0 · html 0.0</small> | 78 | 0.55 | 9.49 | 16 / 5270 / 1047 | 166 | 156 | 124.8 | yes · 71 served |

### per-step · wifi/cold

| start s | took ms | step |
|---|---|---|
| 0.46 | 245 | renderer |
| 0.70 | 1674 | sky |
| 2.38 | 10029 | terrain |
| 12.40 | 1685 | cards |
| 14.09 | 112 | forest |
| 14.20 | 934 | edge |
| 15.14 | 5 | grass |
| 15.14 | 7021 | cabins |
| 22.16 | 2305 | props |
| 24.47 | 0 | animals |
| 24.47 | 418 | weapon |
| 24.89 | 3889 | shaders |
| 28.77 | 1531 | firstFrame |
| 30.30 | | *playable (`.ws-loading` gone, `__world` set)* |
