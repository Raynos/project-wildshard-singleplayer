# Near tier, round 3: dense ground (G342)

Jake on round 2: *"the whole terrain and mountains of Nalati looks super low poly"*. Pine's trees helped, but Driftwood
and Nalati looked almost the same as A, because only props were added: the ground was still the far proxy's 7.8 m
lattice.

Raw A / B screens, same poses as [round 2](../round-2/) (`scripts/capture-main-menu-hero.mjs --round=near`), on a
build of the working tree on `638194c1b` (`--tree`, the push freeze) with the round-3 bakes and the ring change
below. The plan desk makes Jake's board.

- **A** is Debug ▸ Look ▸ Neighbour detail A: the far proxy, as shipped.
- **B** is Neighbour detail B: the near placeholder on the four crossroads cells, now with the dense ground.

Files are `<A|B>-<view>-<iphone|desktop>.jpg`. Every neighbour has its own road view (Jake's board rule):

- `road-driftwood`, `road-nalati`, `road-pine`, `road-template` look from the roundabout (22 m up) into that cell.
- `SQ-c` is today's square hero pose.
- `iphone` is iPhone 16 Pro portrait (phone tier, 2×); `desktop` is 1920 × 1080 (desktop tier).

## What changed since round 2

- **The ground.** It is sampled at the shard's own height field (~2 m, 64 quads a 125 m region, was 16) and reduced per
  region by geometric error (meshoptimizer, 0.5 m, region borders locked so the skirts still hang from them). A mountain
  keeps its ridges; a flat meadow or sea floor spends almost nothing. Its normals come from the 2 m field, its colour
  from the shard's own far look sampled at every kept vertex (splat, height, slope).
- **G348: no per-shard code in the bake.** Driftwood declares its own ground generator and Pine its tree stand-ins in
  their manifests (`placeholder`, schema `@wildshard/format/placeholderSource`); the bake reads that data. A shard that
  declares nothing gets its `terrain.bin` and one generic conifer. `wildshard/no-shard-branch` now covers the near bake.
- **Pine's firs.** Their crowns are lighter (they read near-black in round 2) and the crown's dark base ring is softer.
- **Budget.** The per-cell ceiling went 6 → 8.5 MB (coordinator approval): four cells at most 34 MB on the `near`
  residency line, inside the 1.0 GB Explorer envelope.

  | Cell | Ground (triangles, resident) | Whole cell (resident) | Round 2 |
  | --- | --- | --- | --- |
  | Pine | 20.4k, 1.67 MB | 8.07 MB (40k props kept, was cut to 25.9k) | 5.87 MB |
  | Driftwood | 16.1k, 1.38 MB | 5.81 MB | 5.21 MB |
  | Nalati | 27.4k, 2.15 MB | 5.72 MB | 4.34 MB |
  | Template | 12.5k, 1.13 MB | 1.13 MB | 0.77 MB |

  The round-2 ground was 10.2k triangles, 0.77 MB a cell. Each cell is still one draw.

Default A is unchanged.

## The near view now owns its cell (B only)

The first round-3 shoot (on HEAD, before this fix) showed **B still looking like A near the roundabout**: A / B differed
on 2 % of the Nalati road view's pixels, and the near Nalati slope on the square hero was pixel-identical. Within
~400 m of the player the render rings refined each neighbour to **its own L1 ring tiles** (the shard's shardfile L1
terrain, ~7.8 m), and the near view mirrored the far proxy's mask, so the dense ground only drew beyond L1 range. The
"super low poly" Nalati from the crossroads was its L1 tiles, in A and B alike.

So under B a cell whose near view draws, and whose bake carries the shard's own world (props, trees: a non-zero
`near.content`), now owns it whole: the rings stop offering that cell's L1 / L0 tiles
(`src/game/grid/session.ts`, the catalogue) and retire the ones already drawn (`RenderRings.retireRefinement`), so the far mask empties and the near view's dense
ground draws right up to the road. A terrain-only bake (the template, whose buildings live in its tiles) keeps its tiles
refining. A constructs no near view, so nothing changes there. These captures are that build (`--tree`: the working
tree, during the push freeze). A / B now differ on 3 % (Nalati road), 5 % (Driftwood) and 17 % (Pine) of the road
views, 0 % on the template (it keeps its tiles) and 6 % of the square hero (its Nalati and Pine cells).

What B gives up: the L1 tiles carry the shard's own ground material; the near view is vertex-coloured from the far
look. If Jake wants both, the next step is denser L1 tiles in the shards' own bakes instead.
