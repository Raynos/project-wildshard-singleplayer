# Nalati bounds pacing — E435

**Arrival PASS; whole-drive p95 FAIL** on `9cb611dca`: plain Simulator Safari, 2× phone, Developer, graph materials ON, Memory saver OFF, build pacing ON. Normal held road input capped at shipping 30 m/s, start (277.5,277.5), turn (277.5,0), endpoint (345,0). First pose only seeded; genuine destination readiness, visibility and every drawn-frame wall blockage observed.

| Source / bounds step | Wait ms / blocked frames | Whole-drive p95 / max ms | Short travel p95 ms | Early-visible frames |
| --- | ---: | --- | ---: | ---: |
| f9d9f089c / 8,192 vertices | 600 / 18 | 38 / 99 (FAIL) | 40 | 0 |
| 9cb611dca / 32,768 vertices | 0.000 / 0 | 39 / 84 (FAIL) | 42 | 0 |

Actual collider/actor payloads for Nalati, Sky, Signal and Nine recaptured exactly. The larger step coalesces scheduling hops while preserving vertex order, arithmetic, bound identity and geometry bytes. 22 focused bounds/physics checks, root strict and touched typed lint passed. No collider or quality change.

Ready sample at 13.600 s; 10 m approach-zone sample at 13.600 s, lead 0.000 s. These trace times are quantized; the exact drawn-frame counters grade waiting. No game/document errors or recovery. Quiet 15:13:37–15:15:00 UTC, one-minute load 9.97. Window and Simulator released. One cold run per source; the earlier failure remains recorded and no repeated-cohort saving is claimed.

The landed plain outbound proof remains [34 / 93 ms](../nalati-outbound/README.md), with no 277 ms interval. Sky’s [full authored lift](../sky-lift/README.md) is 34 / 46 ms. Short travel remains its separate row; broader Pine/Nine coverage remains open.
