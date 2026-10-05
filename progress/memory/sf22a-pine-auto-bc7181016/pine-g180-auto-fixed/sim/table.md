| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.638 / 1.152 (spread 0.634–0.667, 5.1%) | 0.634 / 1.142 (spread 0.632–0.635, 0.4%) | 0.641 / 1.119 (spread 0.641–0.641, 0.0%) | 0.283 | 61 MB / 15 MB |
| pine-hollow | 2 | 0.611 / 1.104 (spread 0.608–0.614, 1.0%) | 0.603 / 1.105 (spread 0.603–0.603, 0.0%) | 0.614 / 1.126 (spread 0.614–0.614, 0.0%) | 0.273 | 61 MB / 15 MB |
| pine-hollow | 3 | 0.657 / 1.175 (spread 0.655–0.692, 5.7%) | 0.651 / 1.141 (spread 0.649–0.655, 1.0%) | 0.663 / 1.122 (spread 0.663–0.663, 0.0%) | 0.278 | 61 MB / 15 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.635 / 1.144 | 0.629 / 1.130 | 0.639 / 1.122 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
