| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.466 / 0.700 (spread 0.464–0.491, 5.7%) | 0.463 / 0.709 (spread 0.463–0.463, 0.0%) | 0.471 / 0.702 (spread 0.471–0.471, 0.0%) | 0.186 | 58 MB / 0 MB |
| driftwood-isle | 2 | 0.487 / 0.706 (spread 0.486–0.493, 1.4%) | 0.484 / 0.718 (spread 0.484–0.484, 0.0%) | 0.497 / 0.691 (spread 0.497–0.497, 0.0%) | 0.186 | 58 MB / 0 MB |
| driftwood-isle | 3 | 0.460 / 0.704 (spread 0.458–0.466, 1.8%) | 0.459 / 0.714 (spread 0.459–0.459, 0.0%) | 0.465 / 0.684 (spread 0.465–0.465, 0.0%) | 0.188 | 58 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.471 / 0.703 | 0.469 / 0.714 | 0.478 / 0.692 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
