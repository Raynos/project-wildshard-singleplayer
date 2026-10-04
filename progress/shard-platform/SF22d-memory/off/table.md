| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.578 / 1.161 (spread 0.573–0.585, 2.1%) | 0.574 / 1.169 (spread 0.573–0.574, 0.2%) | 0.575 / 1.166 (spread 0.575–0.575, 0.0%) | 0.487 | 63 MB / 14 MB |
| driftwood-isle | 1 | 0.592 / 0.811 (spread 0.590–0.597, 1.2%) | 0.587 / 0.797 (spread 0.585–0.587, 0.2%) | 0.597 / 0.790 (spread 0.597–0.597, 0.0%) | 0.264 | 201 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.578 / 1.161 | 0.574 / 1.169 | 0.575 / 1.166 |
| driftwood-isle | 0.592 / 0.811 | 0.587 / 0.797 | 0.597 / 0.790 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
