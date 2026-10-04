| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.528 / 0.784 (spread 0.526–0.549, 4.3%) | 0.519 / 0.751 (spread 0.519–0.519, 0.0%) | 0.525 / 0.755 (spread 0.525–0.525, 0.0%) | 0.263 | 123 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.528 / 0.784 | 0.519 / 0.751 | 0.525 / 0.755 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
