| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.647 / 1.036 (spread 0.639–0.669, 4.6%) | 0.642 / 1.079 (spread 0.642–0.642, 0.0%) | 0.653 / 1.128 (spread 0.653–0.653, 0.0%) | 0.260 | 123 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.647 / 1.036 | 0.642 / 1.079 | 0.653 / 1.128 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
