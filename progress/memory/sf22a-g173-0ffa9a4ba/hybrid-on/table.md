| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.505 / 0.865 (spread 0.502–0.532, 6.0%) | 0.505 / 0.892 (spread 0.505–0.505, 0.0%) | 0.487 / 0.725 (spread 0.483–0.487, 0.8%) | 0.185 | 58 MB / 0 MB |
| driftwood-isle | 2 | 0.475 / 0.699 (spread 0.470–0.497, 5.7%) | 0.469 / 0.709 (spread 0.469–0.469, 0.0%) | 0.476 / 0.706 (spread 0.476–0.476, 0.0%) | 0.184 | 58 MB / 0 MB |
| driftwood-isle | 3 | 0.507 / 0.864 (spread 0.496–0.522, 5.1%) | 0.499 / 0.891 (spread 0.499–0.499, 0.0%) | 0.478 / 0.705 (spread 0.478–0.478, 0.0%) | 0.185 | 58 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.495 / 0.810 | 0.491 / 0.831 | 0.480 / 0.712 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
