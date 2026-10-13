# Main-menu hero, round 6: above Nalati's far edge, across it to Driftwood (G379 / G380)

Jake: *"not in the center of Nalati but in the center of the edge of Nalati so we can see all of Nalati, Driftwood and
a bit more of the other shards"* and *"render all 9 shards with the near placeholder view just for this screenshot"*.
Board: [`board.jpg`](board.jpg) (each pose, square beside landscape). Real canvas captures of a clean HEAD build
(`1837ef8a4`), no paint-over: `scripts/capture-main-menu-hero.mjs --round=6 --enter --sessions=1440x1440,1920x1080`,
labelled by `scripts/near-tier-board.py`. The shipped hero (G378, NW-b) is the coordinator's; nothing here touches it.

The eye stands over the midpoint of Nalati's edge on the side away from Driftwood and aims across Nalati at
Driftwood, phone-1x lens (62° square, 43° vertical landscape). Nalati is entered (its own runtime, full quality); every
other cell draws **Debug > Look > Neighbour detail C**, a capture-only option that puts every cell on its near view
whatever its distance (the game itself keeps B's four nearest cells).

| Panel | Eye | Aim |
| --- | --- | --- |
| `SQ-NE-a` / `LS-NE-a` | 320 m, 22° down | Driftwood's centre |
| `SQ-NE-b` / `LS-NE-b` | 520 m, 33° down | Driftwood's centre |
| `SQ-NE-c` / `LS-NE-c` | 420 m, 23° down | past Driftwood (1.35 × the span) |

Every panel's tiers (burned into its label from that frame's readout): **entered** Nalati; **near** Pine (633 m),
template (305 m, plus its 6 L1 / L0 tiles), Signal (1110 m), Driftwood (555 m), Pastel (1151 m), Ink-cel (305 m);
**far proxy** Sky Reach and Blender tmpl. Those two have no near view yet: Sky's islands are model parts only the far
runner's tools can bake and its tiles are not GLBs; Blender tmpl is an authored mesh world with no height field.
Signal's near view is its dense ground only (its tower and dressing are drawn by its own runtime from binary tiles).

**Recommended: SQ-NE-b and LS-NE-b.** The 520 m eye holds all of Nalati, all of Driftwood's island, Pine's forest, the
dunes beyond and the three plains, with only a band of sky.
