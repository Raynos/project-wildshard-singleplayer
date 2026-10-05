| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.483 / 0.723 (spread 0.474–0.486, 2.5%) | 0.476 / 0.719 (spread 0.476–0.476, 0.0%) | 0.483 / 0.688 (spread 0.483–0.483, 0.0%) | 0.184 | 58 MB / 0 MB |
| driftwood-isle | 2 | 0.481 / 0.674 (spread 0.480–0.481, 0.2%) | 0.481 / 0.727 (spread 0.480–0.482, 0.3%) | 0.491 / 0.748 (spread 0.491–0.491, 0.0%) | 0.186 | 58 MB / 0 MB |
| driftwood-isle | 3 | 0.491 / 0.730 (spread 0.482–0.491, 1.8%) | 0.482 / 0.725 (spread 0.482–0.482, 0.0%) | 0.489 / 0.687 (spread 0.489–0.489, 0.0%) | 0.187 | 58 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.485 / 0.709 | 0.480 / 0.723 | 0.488 / 0.707 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
