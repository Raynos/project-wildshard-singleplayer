# round-13-turn-in: How does the boulevard turn into a shard at an edge midpoint?

Ask E438 (SHARD-PLATFORM mockups, wave 8), after G93 (one turn-in per road segment, at the midpoint of the cell edge)
and G99 (the entryway meets the road at y = 0). Every frame also follows G80 (four-lane asphalt boulevard), G90 (seam
heights) and G78 (on the road: bare hands, ATTACK dimmed with a "SAFE ZONE" chip).

First person on foot on the boulevard along Pine Hollow's south edge, about 40 m before the turn-in. Pine Hollow
(photoreal PBR pine forest) is on the right; its granite rim runs left and right of the entry behind a guard rail
(G90's over-14 m case: the shard's own cliff + talus + guard rail), and short neutral cut-stone retaining walls flank
the cut where the rim steps down to the entry (G90's 6–14 m case). Template cells on the left.

Made with codex `image_gen`, editing `art/grid/round-10-asphalt/B-boulevard.jpg` (road), `art/grid/round-12-vr-void/A-tron-grid-rail.jpg`
(safe-zone HUD) and the real Pine Hollow capture `progress/pine-hollow/20261002-0011-0d59505c/first-frame.jpg` (style).
Art direction, not renders: the rim reads closer to 25–30 m here than the measured 50 m.

## Board: `board.jpg`

| Variant | File | What it shows |
|---|---|---|
| A | `A-plain-t-junction.jpg` | A plain right-angle T-junction with a stop line and kerb radius; one green sign "PINE HOLLOW →" at the corner. Nothing over the lane. |
| B | `B-gateway-arch.jpg` | The same junction with a neutral platform gateway: two pale concrete pylons, a dark steel lintel with a thin cyan underlight and "PINE HOLLOW" on it; a green "PINE HOLLOW 40 M" sign before it. |
| C | `C-slip-lane-portal.jpg` | A deceleration slip lane (dashed taper, chevron arrow) curving right into the entry, through a slim portal frame glowing in Pine Hollow's accent colour (amber `#f2a13b`, a placeholder: no shard declares an accent yet, G87) with a "PINE HOLLOW" plate. |

Re-rolls: none. Small slips kept: C's green sign also lists "RANGER 1.9 km" (a quest name, not a place), B's sign says 40 M.

**Recommended: A.** It is the cheapest and the most generic, which matters because the engine generates it at all four
midpoints of every shard: one junction mesh, one sign whose text comes from the shardfile. The border shimmer (G78) and
the entry title card (G82) already announce the shard, so an arch (B) repeats them, and a slip lane (C) needs a
longer, wider strip at every midpoint and a per-shard accent portal on the road, which is the road's neutral zone.
