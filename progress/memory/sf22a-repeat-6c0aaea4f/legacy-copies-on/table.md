| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.531 / 0.797 (spread 0.530–0.533, 0.5%) | 0.527 / 0.778 (spread 0.527–0.527, 0.0%) | 0.532 / 0.764 (spread 0.532–0.532, 0.0%) | 0.258 | 123 MB / 0 MB |
| driftwood-isle | 2 | 0.537 / 0.778 (spread 0.536–0.538, 0.4%) | 0.524 / 0.754 (spread 0.524–0.524, 0.0%) | 0.530 / 0.739 (spread 0.530–0.530, 0.0%) | 0.259 | 123 MB / 0 MB |
| driftwood-isle | 3 | 0.531 / 0.794 (spread 0.529–0.579, 9.4%) | 0.519 / 0.758 (spread 0.519–0.519, 0.0%) | 0.527 / 0.748 (spread 0.527–0.527, 0.0%) | 0.259 | 123 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.533 / 0.790 | 0.523 / 0.763 | 0.529 / 0.750 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
