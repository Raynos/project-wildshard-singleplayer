| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.636 / 0.862 (spread 0.625–0.649, 3.8%) | 0.622 / 0.864 (spread 0.622–0.622, 0.0%) | 0.629 / 0.839 (spread 0.629–0.629, 0.0%) | 0.259 | 201 MB / 0 MB |
| driftwood-isle | 2 | 0.635 / 1.035 (spread 0.631–0.664, 5.2%) | 0.630 / 1.079 (spread 0.630–0.630, 0.0%) | 0.627 / 0.846 (spread 0.627–0.627, 0.0%) | 0.258 | 201 MB / 0 MB |
| driftwood-isle | 3 | 0.637 / 0.853 (spread 0.628–0.654, 4.2%) | 0.625 / 0.862 (spread 0.625–0.625, 0.0%) | 0.632 / 0.837 (spread 0.632–0.632, 0.0%) | 0.259 | 201 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.636 / 0.917 | 0.626 / 0.935 | 0.629 / 0.841 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
