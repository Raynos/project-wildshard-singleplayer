# Round 19: Driftwood tile LOD (T8)

The four over-cap Driftwood L0 tiles after the look-identical cut (80f03e95da, 419cf542cd, 8387c57635), and two
visible LOD options for what is left over the 4.0 MB resident cap. Real-game captures: phone tier, iPhone 16 Pro
portrait, Chromium, frozen midday frame. Each option's bake geometry is swapped onto the same meshes of the
pre-cut build 6fc15cec34.

| | Change | 6,4 resident | 2,5 resident |
|---|---|---|---|
| A (landed) | hidden faces dropped (inside other solids, buried, between touching solids), stem caps; differs from the pre-cut build by 0-36 of 1,095,048 pixels | 5.42 MB | 4.36 MB |
| B | A + cove/reef smooth rocks one detail step lighter, a quarter of the shrine's jungle clumps left out, 20-face pool-rim rocks | 4.67 MB | 3.52 MB |
| C | B + the rocks two steps lighter, and the wreck's sail and hull weed hang still (no sway channel on the wreck kit) | 3.86 MB | 3.52 MB |

Only C gets both tiles under the cap. 6,3 and 5,5 are under the resident cap already; none of the four gets near
the 0.3 MB wire cap with geometry alone.

- `board-wreck-20m.jpg`, `board-wreck-10m.jpg`: tile 6,4 (the wreck, the cove crag and its rocks).
- `board-shrine-12m.jpg`: tile 2,5 (the Ring Shrine and its jungle).
- `variant-B.patch`, `variant-C.patch`: the generator edits of each option, against 8387c57635 (each burns the random
  draws it removes, so nothing else on the island moves).
