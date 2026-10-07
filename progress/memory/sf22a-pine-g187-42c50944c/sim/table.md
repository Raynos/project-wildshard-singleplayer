| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.631 / 1.120 (spread 0.628–0.632, 0.7%) | 0.625 / 1.076 (spread 0.624–0.625, 0.0%) | 0.647 / 1.151 (spread 0.647–0.647, 0.0%) | 0.272 | 61 MB / 15 MB |
| pine-hollow | 2 | 0.620 / 1.089 (spread 0.620–0.625, 0.8%) | 0.617 / 1.063 (spread 0.617–0.617, 0.0%) | 0.638 / 1.139 (spread 0.638–0.638, 0.0%) | 0.290 | 61 MB / 15 MB |
| pine-hollow | 3 | 0.643 / 1.239 (spread 0.640–0.672, 5.0%) | 0.634 / 1.081 (spread 0.634–0.634, 0.0%) | 0.655 / 1.145 (spread 0.655–0.655, 0.0%) | 0.283 | 61 MB / 15 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.631 / 1.149 | 0.625 / 1.074 | 0.646 / 1.145 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
