| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| pine-hollow | 1 | 0.634 / 1.058 (spread 0.632–0.636, 0.6%) | 0.631 / 1.053 (spread 0.631–0.631, 0.0%) | 0.641 / 1.057 (spread 0.641–0.641, 0.0%) | 0.283 | 61 MB / 15 MB |
| pine-hollow | 2 | 0.660 / 1.097 (spread 0.657–0.662, 0.8%) | 0.653 / 1.065 (spread 0.651–0.661, 1.6%) | 0.661 / 1.046 (spread 0.661–0.661, 0.0%) | 0.272 | 61 MB / 15 MB |
| pine-hollow | 3 | 0.606 / 1.061 (spread 0.605–0.608, 0.5%) | 0.599 / 1.065 (spread 0.599–0.599, 0.0%) | 0.611 / 1.073 (spread 0.611–0.611, 0.0%) | 0.274 | 61 MB / 15 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| pine-hollow | 0.633 / 1.072 | 0.628 / 1.061 | 0.638 / 1.059 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
