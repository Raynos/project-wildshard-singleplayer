| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.505 / 1.057 (spread 0.497–0.553, 11.1%) | 0.491 / 0.994 (spread 0.491–0.491, 0.0%) | 0.505 / 1.016 (spread 0.505–0.505, 0.0%) | 0.256 | 41 MB / 8 MB |
| pine-hollow | 2 | 0.677 / 1.293 (spread 0.612–0.742, 19.2%) | 0.530 / 0.991 (spread 0.530–0.530, 0.0%) | 0.546 / 1.035 (spread 0.546–0.546, 0.0%) | 0.266 | 41 MB / 8 MB |
| pine-hollow | 3 | 0.566 / 1.213 (spread 0.550–0.621, 12.6%) | 0.499 / 0.980 (spread 0.499–0.531, 6.4%) | 0.510 / 1.012 (spread 0.510–0.510, 0.0%) | 0.267 | 41 MB / 8 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.583 / 1.188 | 0.507 / 0.989 | 0.520 / 1.021 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
