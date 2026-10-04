# SF22c — automatic production rig delivery

`node scripts/crossroads-rig/production-probe.mjs --rev=974f1c73e` drove Simulator Safari through the actual
pause ▸ Settings ▸ Debug ▸ Memory check action, clicked Run once, and persisted three complete runs plus the summary
through real HTTP to the clean pinned production POST/GET handlers. Only private Blob storage was replaced by a
local fixture; this proves production-build behavior and delivery, not deployed telemetry or physical-phone memory.

Build `974f1c7-mutm0wu3`; iPhone 17 Pro Simulator, Safari, portrait 402×714, drawing buffer 804×1428 (2×), ASTC 4×4.
All three runs: 29 L0, 32 L1, 9 far, 4 libraries, 4 sims; zero over-cap units, errors, context loss or interrupted runs.
Summary: runs=3, completed=3, posted=3, errors=0, contextLosses=0, overCapRuns=0.

| Run | fps | Cadence p95 ms | CPU work p95 ms | Accounted content MB | Safari JS heap |
| --- | ---: | ---: | ---: | ---: | --- |
| 1 | 60 | 17 | 2 | 394.4 | null |
| 2 | 60 | 17 | 2 | 394.4 | null |
| 3 | 60 | 17 | 1 | 394.4 | null |

Each run: GPU geometry 41,250,224 B; GPU textures 175,117,569 B; retained CPU 178,032,120 B; JS upload copies 0.
Two temporary L0 tiles churn during measurement; counts/bytes in the final record describe the fixed residency after
those temporary tiles are disposed. The engine base is excluded; these are not OS-footprint numbers. A concurrent
Chromium census/local gate may have used the Mac during this delivery test; no physical-phone cadence claim is made.

The initial delivery attempt on `905fa50fd` completed and posted, but exposed all 29 L0 units at 4.055593 MB (>4 MB).
The production L0 control map was reduced to 256² in `974f1c73e`; the developer tool keeps its original 512² map.
The proof now rejects over-cap runs. The format remains version 0 pending the physical phone's three automatic runs.

Focused verification: 12 tests across API sanitization/persistence, static build emission, retry outbox and Debug
registry; API strict typecheck and owned-file lint pass. All owned preview, HTTP/Inspector proxy and Simulator
resources were cleaned up; `scripts/sim-lane.sh status` reported zero booted devices.
