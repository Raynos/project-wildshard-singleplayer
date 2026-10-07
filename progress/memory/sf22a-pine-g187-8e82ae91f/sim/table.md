| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.662 / 1.058 (spread 0.659–0.664, 0.8%) | 0.651 / 1.003 (spread 0.651–0.651, 0.0%) | 0.671 / 1.081 (spread 0.671–0.671, 0.0%) | 0.298 | 61 MB / 5 MB |
| pine-hollow | 2 | 0.658 / 1.031 (spread 0.658–0.660, 0.3%) | 0.649 / 1.002 (spread 0.649–0.649, 0.0%) | 0.668 / 1.075 (spread 0.668–0.668, 0.0%) | 0.297 | 61 MB / 6 MB |
| pine-hollow | 3 | 0.643 / 1.033 (spread 0.634–0.644, 1.6%) | 0.629 / 1.020 (spread 0.629–0.630, 0.1%) | 0.647 / 1.075 (spread 0.647–0.647, 0.0%) | 0.295 | 61 MB / 6 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.654 / 1.041 | 0.643 / 1.008 | 0.662 / 1.077 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
