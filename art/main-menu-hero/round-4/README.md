# Main-menu hero, round 4: above the shards (G343)

Jake: the hero camera stands **above one of the three highest-quality shards, looking across the roundabout at the
others, never above the template**. Round 4 shoots from above Driftwood (`DW`), Nalati (`NA`) and Pine (`PH`), three
poses a spot (`a` over its centre, `b` nearer and lower, `c` back over its edge and higher), each as the square (the
portrait centre band, G341 B, 62° phone-1x lens, 2048² and 1440²) and the landscape (desktop, G341 A, 70° across,
2560 × 1440 and 1920 × 1080; this folder keeps every pose at 2048² / 2560 × 1440 and the two picks at the
smaller size too). Board: [`board.jpg`](board.jpg) (every capture labelled, then the pick on the real phone
menu beside today's SQ-c). Tools: `scripts/capture-main-menu-hero.mjs --round=4 --tree`,
`scripts/main-menu-hero-board.py`, `layout/capture-layouts.mjs`.

**Recommended: SQ-PH-a (square) and LS-PH-c (landscape).** Above Pine: its forest fills the front, Nalati's snow
peaks and river valley sit in the centre, Driftwood's island on the left and the template on the right. Above
Driftwood the template is the subject; above Nalati its own slope blurs across the front.

**The shard under the camera is near tier here, not its full runtime.** The player stands on the roundabout road and
all four crossroads cells draw Debug ▸ Look ▸ Neighbour detail B: round 3's near placeholder with its dense ground,
which now owns its cell over the shard's L1 tiles (see [near tier round 3](../../near-tier/round-3/)). The build is the
working tree on `638194c1b` (`--tree`, during the push freeze), with the round-3 bakes and that ring change. The plan
was to stand the player in the cell under the camera so that shard draws at full quality (`--enter` does this), but an
entered standalone level draws its own world over the grid when seen from the air (below), so the shot would show no
roundabout at all. When the engine clips an entered level's world to its cell in grid mode, round 4 is re-shot with
`--enter`.

## The entered-cell horizon bug (for the next looks lane)

Probe: [`entered-driftwood-probe.jpg`](entered-driftwood-probe.jpg) (SQ-DW-a at 1440², the player entered into
Driftwood a third of the way from its centre to the roundabout, camera 260 m up over the cell centre, aimed at the
roundabout).

- **Driftwood's ocean** (`src/shards/driftwood-isle/world/Ocean.ts`, the SDK faceted ocean
  `runtime/looks/facetedOcean`): one mesh "over the chunk (plus a margin) that coarsens geometrically out to ~4 km". It
  reflects the sky and covers every neighbour cell and the roundabout from above. This is the bug.
- **A grey ridge ring** stands round the whole grid behind it: the engine's default ridges
  (`src/engine/world/Horizon.ts`, built in `src/game/session/world.ts:72`). `gridLevel` (`src/game/grid/session.ts`)
  empties a level's *own* horizon in grid mode (G99) but keeps the engine's default ridges, "past the grid's outer
  road", for a level that declares none, as Driftwood does. That is by design; it only reads as a wall from the air.
- **Nalati**: the teleport entry did not admit within 240 s (no shot). **Pine**: entered (sim claims, rings settled),
  but by the shot it was no longer the playing cell. Neither has a probe image yet.

The fix, engine-side: in grid mode, clip a standalone level's ocean (and any other world-sized mesh) to its own cell,
so an entered cell sits in the grid like its neighbours.
