# Near tier, round 2: after the quality pass (G342)

Raw, unlabelled A / B screens, taken with the same poses as [round 1](../round-1/) (`scripts/capture-main-menu-hero.mjs
--round=near`) on build `c44c503` (it carries `ac87c91fd`). The plan desk makes Jake's board.

- **A** is Debug ▸ Look ▸ Neighbour detail A: the far proxy, as shipped.
- **B** is Neighbour detail B: the near placeholder on the four crossroads cells.

The files are named `<A|B>-<pose>-<iphone|desktop>.jpg`:

- `road-0` … `road-3` look from the roundabout (22 m up) into each crossroads cell.
- `SQ-c` is today's square hero pose.
- `iphone` is iPhone 16 Pro portrait (phone tier, 2×); `desktop` is 1920 × 1080 (desktop tier).

## What changed since round 1 (`ac87c91fd`)

- **Pine's forest.** Its 918 baked tree placements are now low-LOD stand-ins, chosen by species (pine, fir, giant,
  birch, sapling, snag) and tint band. They are merged into the one draw. The far look's raised canopy sheet is gone.
- **Placed models.** These are harvested from where they are built, every copy, whatever one bake camera's culler
  shows:
  - Driftwood's hut, pier and jetties, lookout, shrine, rope bridge and shore boulders.
  - Nalati's and Pine's placed models.
- **Texture colours.** Each colour map's mean texel is decoded from its own bytes. Pine's cabins and crates keep their
  paint instead of a guessed wood tint.
- **Budget.** The ceiling is 6 MB resident per cell:

  | Cell | Resident |
  | --- | --- |
  | Pine | 5.87 MB |
  | Driftwood | 5.21 MB |
  | Nalati | 4.34 MB |
  | Template | 0.77 MB |

  The four cells total at most 24 MB on the `near` residency line. Each cell is one draw.

Default A is unchanged.
