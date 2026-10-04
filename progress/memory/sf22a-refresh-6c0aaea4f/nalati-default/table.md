| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| nalati-grasslands | 1 | 0.588 / 0.935 (spread 0.585–0.615, 5.2%) | 0.586 / 0.900 (spread 0.586–0.586, 0.0%) | 0.619 / 0.952 (spread 0.619–0.619, 0.0%) | 0.201 | 100 MB / 9 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| nalati-grasslands | 0.588 / 0.935 | 0.586 / 0.900 | 0.619 / 0.952 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
