| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.575 / 1.248 (spread 0.571–0.576, 0.8%) | 0.569 / 1.212 (spread 0.569–0.570, 0.2%) | 0.568 / 1.194 (spread 0.568–0.569, 0.2%) | 0.487 | 61 MB / 14 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.575 / 1.248 | 0.569 / 1.212 | 0.568 / 1.194 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
