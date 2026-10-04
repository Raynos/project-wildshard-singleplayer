| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.610 / 1.284 (spread 0.573–0.610, 6.2%) | 0.569 / 1.202 (spread 0.568–0.569, 0.2%) | 0.570 / 1.197 (spread 0.570–0.570, 0.0%) | 0.488 | 61 MB / 14 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.610 / 1.284 | 0.569 / 1.202 | 0.570 / 1.197 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
