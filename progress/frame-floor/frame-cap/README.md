# Late 30 fps frame-cap slot (E435 / G329)

Isolated baseline `5af2e411356da578d70494f9c248ad8281d5d776` versus `619c2ef9d7ac248c76ae8085cd8335552f752f2e`: only the Game frame-cap production change. Developer grid, live clock, 2× render scale, build pacing ON, muted. Simulator uses phone Auto (30 fps); desktop Auto is uncapped. Each arm loads a fresh browser; Simulator is closed between arms. Short machine quiet windows; no CPU profile.

| Surface / run | Arm | fps | Drive p95 / p99 / max ms | Frames >50 / >100 ms | Interior p95 ms | Full-run floor |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| sim 1 | before | 30.303 | 45 / 82 / 158 | 17 / 2 | 34 | FAIL |
| sim 1 | after | 30.303 | 44 / 67 / 93 | 14 / 0 | 35 | FAIL |
| sim 2 | before | 30.303 | 52 / 77 / 96 | 23 / 0 | 35 | FAIL |
| sim 2 | after | 30.303 | 45 / 65 / 95 | 13 / 0 | 34 | FAIL |
| desktop 1 | before | 59.88 | 33.2 / 50 / 66.7 | 1 / 0 | 16.7 | FAIL |
| desktop 1 | after | 59.88 | 16.8 / 33.4 / 66.7 | 2 / 0 | 16.7 | FAIL |

Simulator order was baseline → cap, then cap → baseline. No 524 ms Nalati constructor/drive spike reproduced in either arm. The cap drive maxima were 93/95 ms, compared with 158/96 ms on baseline. These two runs per side support the cadence fix; they do not establish that all intermittent construction stalls are gone.

The full Simulator floors remain FAIL: the drives miss the existing tail-cadence thresholds, and the spawn samples include stalls in both arms (baseline 901/212 ms; cap 232/229 ms). All four Nalati interiors PASS. Desktop travel also misses its tail-cadence threshold in both arms. Desktop Auto is uncapped, so the differing drive p95 values there are run variance, not a cap effect. No desktop frame exceeded 100 ms in either arm. Full-floor failures remain open.

Harness failures excluded before timing: the first desktop attempt lacked a worker deadline; the first Simulator attempt refused an unavailable Developer fixture. The deadline and origin-local Safari fixture were corrected, with configuration guards unchanged (`96ecd2cf8`). No route was replayed after a document/protocol failure.

Load (1-minute, start → finish): Simulator run 1 baseline 8.42 → 16.15, cap 16.15 → 16.36; run 2 cap 5.22 → 13.64, baseline 13.64 → 15.79. Desktop baseline 6.52 → 7.70, cap 7.70 → 7.94.

Checks: four cadence tests, root strict and touched typed lint. Normal jitter, 60 fps decisions and the uncapped path remain unchanged; a bounded late slot prevents a second unnecessary delayed draw and consecutive 60 Hz draws at a 30 fps cap. Raw recordings stay in scratch.

Desktop load record (1 / 5 / 15-minute averages):

```text
22:38  up 50 days, 15:10, 2 users, load averages: 6.52 16.88 18.59
22:38  up 50 days, 15:11, 2 users, load averages: 7.70 15.91 18.16
22:38  up 50 days, 15:11, 2 users, load averages: 7.70 15.91 18.16
22:39  up 50 days, 15:11, 2 users, load averages: 7.94 15.04 17.75
```
