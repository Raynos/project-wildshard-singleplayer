| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.637 / 1.059 (spread 0.637–0.667, 4.8%) | 0.627 / 1.086 (spread 0.627–0.627, 0.0%) | 0.619 / 0.833 (spread 0.619–0.619, 0.0%) | 0.259 | 201 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.637 / 1.059 | 0.627 / 1.086 | 0.619 / 0.833 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
