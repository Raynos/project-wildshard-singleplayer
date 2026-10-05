| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.630 / 1.054 (spread 0.617–0.642, 3.9%) | 0.616 / 1.091 (spread 0.616–0.616, 0.0%) | 0.542 / 0.763 (spread 0.542–0.542, 0.0%) | 0.258 | 123 MB / 0 MB |
| driftwood-isle | 2 | 0.560 / 0.795 (spread 0.550–0.560, 1.8%) | 0.533 / 0.745 (spread 0.533–0.535, 0.3%) | 0.539 / 0.762 (spread 0.539–0.539, 0.0%) | 0.258 | 123 MB / 0 MB |
| driftwood-isle | 3 | 0.626 / 1.056 (spread 0.625–0.651, 4.1%) | 0.625 / 1.096 (spread 0.625–0.625, 0.0%) | 0.550 / 0.764 (spread 0.550–0.550, 0.0%) | 0.260 | 123 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.605 / 0.968 | 0.591 / 0.977 | 0.544 / 0.763 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
