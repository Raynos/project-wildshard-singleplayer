| Build | Run | Loading, native / Inspector (cap 1.8) | Play, native / Inspector | Explorer, native / Inspector (cap 1.0) | GPU process | JS-held at the end (geometry / textures) |
| --- | --- | --- | --- | --- | --- | --- |
| far-reach | 1 | 0.292 / 0.607 (spread 0.272–0.358, 29.5%) | 0.278 / 0.648 (spread 0.276–0.278, 0.8%) | 0.278 / 0.603 (spread 0.278–0.278, 0.0%) | 0.237 | 33 MB / 2 MB |
| nine-dragon-stack | 1 | 0.343 / 0.618 (spread 0.342–0.343, 0.2%) | 0.332 / 0.597 (spread 0.332–0.332, 0.0%) | 0.341 / 0.656 (spread 0.341–0.341, 0.0%) | 0.248 | 57 MB / 2 MB |
| far-reach | 2 | 0.274 / 0.606 (spread 0.270–0.305, 12.9%) | 0.255 / 0.640 (spread 0.253–0.255, 0.9%) | 0.261 / 0.595 (spread 0.261–0.261, 0.0%) | 0.244 | 33 MB / 2 MB |
| nine-dragon-stack | 2 | 0.415 / 0.630 (spread 0.415–0.416, 0.3%) | 0.402 / 0.608 (spread 0.402–0.402, 0.0%) | 0.412 / 0.663 (spread 0.412–0.412, 0.0%) | 0.249 | 57 MB / 2 MB |
| far-reach | 3 | 0.277 / 0.592 (spread 0.267–0.301, 12.3%) | 0.271 / 0.647 (spread 0.269–0.271, 0.9%) | 0.282 / 0.712 (spread 0.282–0.282, 0.0%) | 0.245 | 33 MB / 2 MB |
| nine-dragon-stack | 3 | 0.410 / 0.628 (spread 0.409–0.411, 0.3%) | 0.399 / 0.609 (spread 0.399–0.399, 0.0%) | 0.409 / 0.665 (spread 0.409–0.409, 0.0%) | 0.248 | 57 MB / 2 MB |

| Build | mean loading | mean play | mean explorer |
| --- | --- | --- | --- |
| far-reach | 0.281 / 0.602 | 0.268 / 0.645 | 0.274 / 0.637 |
| nine-dragon-stack | 0.389 / 0.625 | 0.378 / 0.605 | 0.387 / 0.661 |

native/Inspector = median of three one-second samples after each phase's work, their spread beside it. Native phase peaks still enforce absolute caps. Decimal GB. Simulator: a regression check, not phone evidence.
