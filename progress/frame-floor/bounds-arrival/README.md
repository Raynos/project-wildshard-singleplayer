# Nalati bounds pacing — E435

**Latest: arrival and whole-drive PASS on `8d8ae2711` (0 ms wait; p95 35 / max 97 ms).** Short travel is separately FAIL at 36 ms, owned by sp-x1. This is not an all-floor or all-cell pass.

The earlier `9cb611dca` run below passed arrival and failed whole-drive p95: plain Simulator Safari, 2× phone, Developer, graph materials ON, Memory saver OFF, build pacing ON. Normal held road input capped at shipping 30 m/s, start (277.5,277.5), turn (277.5,0), endpoint (345,0). First pose only seeded; genuine destination readiness, visibility and every drawn-frame wall blockage observed.

| Source / bounds step | Wait ms / blocked frames | Whole-drive p95 / max ms | Short travel p95 ms | Early-visible frames |
| --- | ---: | --- | ---: | ---: |
| f9d9f089c / 8,192 vertices | 600 / 18 | 38 / 99 (FAIL) | 40 | 0 |
| 9cb611dca / 32,768 vertices | 0.000 / 0 | 39 / 84 (FAIL) | 42 | 0 |
| 8d8ae2711 / AO prerequisite + expanded place scans sliced | 0.000 / 0 | 35 / 97 (PASS) | 36 (FAIL) | 0 |

Actual collider/actor payloads for Nalati, Sky, Signal and Nine recaptured exactly. The larger step coalesces scheduling hops while preserving vertex order, arithmetic, bound identity and geometry bytes. 22 focused bounds/physics checks, root strict and touched typed lint passed. No collider or quality change.

Ready sample at 13.600 s; 10 m approach-zone sample at 13.600 s, lead 0.000 s. These trace times are quantized; the exact drawn-frame counters grade waiting. No game/document errors or recovery. Quiet 15:13:37–15:15:00 UTC, one-minute load 9.97. Window and Simulator released. One cold run per source; the earlier failure remains recorded and no repeated-cohort saving is claimed.

The landed plain outbound proof remains [34 / 93 ms](../nalati-outbound/README.md), with no 277 ms interval. Sky’s [full authored lift](../sky-lift/README.md) is 34 / 46 ms. Short travel remains its separate row; broader Pine/Nine coverage remains open.

## AO prerequisite and expanded place scans

Source `8d8ae2711`, measured `8d8ae2711`: arrival **PASS**, 0.000 ms / 0 blocked frames / 0 early-visible frames. Whole-drive **PASS**, 35 ms p95 / 97 ms max across 750 frames; short travel 36 ms remains its separate row. Same plain Simulator Safari, graph ON, Memory saver OFF, 2×, 30 m/s road route.

The diagnostic mapped the remaining 333,948-vertex box scan to the Kurgan AO prerequisite and 157,632-vertex sphere scan to expanded baked place meshes. Both now use the exact sliced bounds primitive; shading only changes colours. 21 focused checks and root strict/touched lint passed; the official Node actor/collider payload is exact. The earlier failures remain above; one cold run supplies no repeated-cohort saving or all-cell readiness claim.

Quiet 16:11:58–16:13:24 UTC; one-minute load 22.08 (reported, not hidden). No app build or suite was active when the window was acquired; the high load average follows the push gate. Ready trace sample 13.639 s, 10 m approach-zone sample 13.368 s; these are quantized and readiness occurred within the approach zone. The exact blocked-frame counter, rather than a claimed positive trace lead, grades 0 ms waiting. No document, recovery or game errors. Simulator and window released.
