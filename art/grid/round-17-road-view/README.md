# round-17-road-view: from the road, how do the neighbouring shards look? (E449 M2)

Ask E449 (SHARD-PLATFORM mockup wave, item M2). **G158** settled who owns the frame: inside a shard's cell the shard owns
the whole frame (its sky, sun, fog, lighting, exposure and post stack apply to everything on screen, neighbours included);
on the road and its strips the neutral road look; a blend at the cell edge. Nobody has shown what that means **while you
stand on the road**: do the neighbours sit under the road's light, or does each cell still show its own sky?

**Question: which view from the road?**

Each variant has two frames: **road level** (first person on foot at the roundabout where Pine Hollow, Driftwood Isle,
Nalati and a template meet, looking south down the boulevard: Nalati on the left, Driftwood on the right, the safe-zone
HUD) and **aerial** (the whole shipped 3 × 3 from a fly camera, the VR void beyond the outer ring).

## Board: `board.jpg`

| Variant | Files | What it shows |
|---|---|---|
| A · road light over everything | `A-road-light-road.jpg`, `A-road-light-aerial.jpg` | One calm grey-blue road daylight over the whole view. Driftwood stays faceted low-poly and Nalati painterly, but both sit under the same sun, sky and haze: only their geometry and materials differ. No Nalati sunset from the road; it appears as you cross into the cell (the G158 edge blend). |
| B · each cell keeps its own sky | `B-cell-skies-road.jpg`, `B-cell-skies-aerial.jpg` | Each cell's own sky and weather stands over its square as a visible column: Nalati's painterly sunset on the left, Driftwood's tropical noon on the right, the neutral road sky over the boulevard between them. From the air a patchwork of skies (Pine Hollow misty overcast, templates flat grey). |
| C · haze curtain at every border | `C-haze-curtain-road.jpg`, `C-haze-curtain-aerial.jpg` | Signal Dunes' dust band (G94) generalised to every shard: a tall haze curtain at each cell border, tinted by the shard (gold for Nalati, turquoise-white for Driftwood), hiding most of the cell until you cross; the road stays clear. |

## Recommendation: A

- A is G158 as written, and as SF19a's frame owner already builds it (default-off `6551dabab`): one frame state on the
  road, one inside a cell, a 16 m blend between. It costs nothing extra on the phone.
- The shard's own sky still has its moment: it lands during the edge blend as you cross, together with the G82 title
  card, so entering Nalati reads as walking into its sunset.
- Cost of A: from the road Nalati loses its sunset and reads only through its painterly materials and rims.
- B is the most striking, but it brings back what G158 just removed: several skies and lights drawn at once, a shard-id
  buffer or per-cell sky volumes, and large transparent columns. At 2× render scale on the iPhone that is the overdraw
  RENDERING.md warns about. It also contradicts "the road has the neutral look".
- C hides each shard behind fog, so the grid stops reading as one landmass from the road (G72). It also adds tall
  transparent curtains along 12 borders, which costs the same overdraw as B. Signal Dunes keeps its G94 band whichever
  variant wins.

## How they were made

codex `image_gen` (gpt-image), one image per run, run in parallel. The references were:

- road level: the real phone capture `progress/shard-platform/grid-hud/safe.jpg` (today's road HUD: dimmed ATTACK under
  "SAFE ZONE"), the picked roundabout `art/grid/round-10-asphalt/cr-B-boulevard-roundabout.jpg` (G81), and real shard
  captures `progress/{driftwood-isle,nalati-grasslands}/20261002-0011-0d59505c/first-frame.jpg`;
- aerial: `art/grid/round-12-vr-void/board-overview.jpg` (G89, title cropped) and
  `art/grid/round-15-cell-aerial/A-rims-canyon-gaps.jpg`.

Frames are about 853 × 1844 (iPhone portrait), saved as JPEG.

Re-rolled: B-aerial, once. In the first take only Pine Hollow's column rose; Driftwood's and Nalati's skies were painted
flat on the ground like postcards.

Drift kept:

- The sign text ("DRIFTWOOD ISLE" / "NALATI") has no distances.
- The aerials draw the cells taller than wide.
- The C-aerial curtains are lower than the prompt asked for.

These are mockups for art direction, not renders: they are more detailed than the game renders today, and nothing here
is built.
