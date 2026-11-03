# Mosslight Ruins · round 4 · the phone wire trim (OB6b, 2026-11-03)

`board.jpg` sets BEFORE (`def30fc8f4`) beside AFTER for the plaza and road-entry hero views, the above-neighbour view, a
close crop of the tower and the plaza poster at 15 m. The captures come from working-tree builds, on the phone tier at
2x as an iPhone 16 Pro, with matching cameras.

| | BEFORE | AFTER |
|---|---|---|
| Phone wire | 8,828,397 B | 8,222,060 B (Night Market's bar: 8,225,190 B) |
| Poster texture | 1024 x 576 (`billboard.webp`), 781 KB of KTX2 | 576 x 324 (`poster.webp`), Bayou's and Ember's pattern |
| Tower texture | 768 px | 704 px, resized from the original 1024 px take |

- **Pixels changed:** road entry 0, top-down 7, above-neighbour 121, plaza 0.54 %. The poster at 15 m changes 5.4 %:
  it is a little softer, but only when the two are compared side by side.
- **Draws and triangles** are the same at all seven views.
- The phone ceiling ratchets down to 8,222,060 B. The poster's KTX2 was counted in every tile that carries a poster.
  With the smaller poster, all 16 window rows and every L1 row leave Mosslight's tile debt, and the rest tighten to
  their new measured values.
