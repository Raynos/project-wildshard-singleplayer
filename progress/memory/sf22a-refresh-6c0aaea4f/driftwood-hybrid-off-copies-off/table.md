| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.605 / 0.835 (spread 0.603–0.607, 0.6%) | 0.602 / 0.816 (spread 0.602–0.602, 0.0%) | 0.610 / 0.827 (spread 0.610–0.610, 0.0%) | 0.257 | 201 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.605 / 0.835 | 0.602 / 0.816 | 0.610 / 0.827 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
