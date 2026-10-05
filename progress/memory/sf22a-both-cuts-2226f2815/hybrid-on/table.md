| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| driftwood-isle | 1 | 0.501 / 0.716 (spread 0.497–0.529, 6.4%) | 0.507 / 0.737 (spread 0.507–0.507, 0.0%) | 0.499 / 0.682 (spread 0.499–0.499, 0.0%) | 0.186 | 58 MB / 0 MB |
| driftwood-isle | 2 | 0.539 / 0.850 (spread 0.536–0.562, 4.8%) | 0.534 / 0.887 (spread 0.534–0.534, 0.0%) | 0.502 / 0.715 (spread 0.498–0.502, 0.8%) | 0.186 | 58 MB / 0 MB |
| driftwood-isle | 3 | 0.489 / 0.715 (spread 0.483–0.510, 5.6%) | 0.495 / 0.734 (spread 0.478–0.495, 3.3%) | 0.487 / 0.687 (spread 0.487–0.487, 0.0%) | 0.185 | 58 MB / 0 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| driftwood-isle | 0.510 / 0.760 | 0.512 / 0.786 | 0.496 / 0.695 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
