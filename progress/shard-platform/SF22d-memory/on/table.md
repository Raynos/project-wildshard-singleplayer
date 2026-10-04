| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.561 / 1.035 (spread 0.548–0.564, 2.9%) | 0.545 / 1.010 (spread 0.544–0.545, 0.2%) | 0.547 / 1.031 (spread 0.547–0.547, 0.0%) | 0.372 | 55 MB / 14 MB |
| driftwood-isle | 1 | 0.518 / 0.705 (spread 0.517–0.589, 13.9%) | 0.506 / 0.703 (spread 0.504–0.506, 0.3%) | 0.513 / 0.678 (spread 0.513–0.513, 0.0%) | 0.233 | 195 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.561 / 1.035 | 0.545 / 1.010 | 0.547 / 1.031 |
| driftwood-isle | 0.518 / 0.705 | 0.506 / 0.703 | 0.513 / 0.678 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
