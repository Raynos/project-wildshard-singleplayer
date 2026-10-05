| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.478 / 0.707 (spread 0.474–0.496, 4.6%) | 0.474 / 0.720 (spread 0.474–0.474, 0.0%) | 0.482 / 0.703 (spread 0.482–0.483, 0.0%) | 0.185 | 58 MB / 0 MB |
| driftwood-isle | 2 | 0.481 / 0.700 (spread 0.473–0.498, 5.3%) | 0.472 / 0.728 (spread 0.472–0.472, 0.0%) | 0.483 / 0.748 (spread 0.481–0.483, 0.4%) | 0.186 | 58 MB / 0 MB |
| driftwood-isle | 3 | 0.486 / 0.694 (spread 0.480–0.508, 5.8%) | 0.477 / 0.717 (spread 0.477–0.477, 0.0%) | 0.484 / 0.703 (spread 0.484–0.484, 0.0%) | 0.185 | 58 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.482 / 0.700 | 0.474 / 0.722 | 0.483 / 0.718 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
