| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.605 / 0.887 (spread 0.603–0.607, 0.7%) | 0.604 / 0.863 (spread 0.602–0.604, 0.3%) | 0.610 / 0.850 (spread 0.610–0.610, 0.0%) | 0.258 | 201 MB / 0 MB |
| driftwood-isle | 2 | 0.620 / 0.866 (spread 0.618–0.621, 0.5%) | 0.628 / 0.861 (spread 0.628–0.628, 0.0%) | 0.628 / 0.860 (spread 0.628–0.628, 0.0%) | 0.258 | 201 MB / 0 MB |
| driftwood-isle | 3 | 0.622 / 0.979 (spread 0.620–0.643, 3.7%) | 0.606 / 0.861 (spread 0.606–0.606, 0.0%) | 0.614 / 0.841 (spread 0.614–0.614, 0.0%) | 0.257 | 201 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.616 / 0.911 | 0.613 / 0.862 | 0.617 / 0.850 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
