| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.648 / 1.390 (spread 0.646–0.649, 0.4%) | 0.591 / 1.484 (spread 0.591–0.591, 0.1%) | 0.589 / 1.277 (spread 0.589–0.589, 0.0%) | 0.420 | 61 MB / 14 MB |
| pine-hollow | 2 | 0.602 / 1.320 (spread 0.590–0.606, 2.6%) | 0.590 / 1.168 (spread 0.590–0.590, 0.0%) | 0.588 / 1.154 (spread 0.588–0.589, 0.2%) | 0.420 | 61 MB / 14 MB |
| pine-hollow | 3 | 0.645 / 1.327 (spread 0.643–0.647, 0.6%) | 0.597 / 1.317 (spread 0.597–0.597, 0.0%) | 0.594 / 1.152 (spread 0.594–0.594, 0.0%) | 0.420 | 61 MB / 14 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.632 / 1.346 | 0.593 / 1.323 | 0.591 / 1.194 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
