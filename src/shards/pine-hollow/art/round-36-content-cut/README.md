# Pine Hollow content-cut boards (G180, SHARD-PLATFORM SF47-g)

Jake's G180 (E450): apply B1 + B2 + B4 + B5, then a **real-capture** board for the last ~100 MB: view distance, tree
density and herd size, each with measured MB at the same poses. **None of these cuts is applied.** Jake picks.

## Where Pine stands with the trim on (`3f8409900`)

Labelled GL (iPhone 16 Pro context, phone tier, KTX2, every capture pose; `progress/shard-platform/g180/cuts-glbytes.json`):
**357.0 MB off → 271.0 MB on (−86.0 MB)**: sky keys −16.8, B1 512² sets −14.0, B2 ASTC 6×6 −38.0, B4 128 environment
cube −12.6, B5 herd shadows −4.7. The trim is on by default in the grid. Since `bc7181016` Pine's phone also boots KTX2
on a first visit: before that, a cold Auto boot read images and its GL was 555.4 MB. The Simulator total (WebContent + GL, was
1,192 MB) is sp-x2's SF22a reading with the row on.

## The boards

`board-view-distance.jpg`, `board-tree-density.jpg`, `board-herd-size.jpg`: each one A / B / C, iPhone 16 Pro portrait.
A is today (trim on), B and C are the two steps. The rows are the same three poses (gate, cabin, pond) at midday, clear
weather. On each option's head: labelled GL and JS heap against A (the mean of its runs), and the animal count.

| Lever | B | C | GL (B / C) | JS heap (B / C) |
|---|---|---|---|---|
| View distance (tree hi / lo / twig, cabin detail, animal draw / eye / shadow, sun shadow reach × the step) | 75 % | 50 % | **−6.5 / −6.5** | +2.3 / −2.2 |
| Tree density (each tree kept with the step's chance, spread evenly) | 75 % | 50 % | +2.7 / +1.2 | +2.8 / +6.4 |
| Herd size (every herd group scaled: 164 → 88 → 49 animals) | 50 % | 25 % | +2.6 / +1.1 | −0.7 / +8.6 |

How measured: `progress/shard-platform/g180/cut-capture.mjs` (one browser through `scripts/browser-lane.sh`, muted,
service worker blocked, phone tier, render scale 2, KTX2, trim on), A × 3 runs, every step × 2 runs.
`measured.json` holds every run. The labelled GL is deterministic: A's three runs all gave 285.27 MB. The JS heap is
noise: A's runs read 240.5, 249.4 and 249.4 MB, so no heap figure on these boards is outside ±5 MB. The variants come
from a dangling scratch build (`localStorage` knobs in the forest placement, the fauna layout and the level tier, never
pushed), so nothing reaches the game.

## What the boards say

**None of the three levers comes close to 100 MB.** Pine's forest and herds are instanced. A tree is one instance row,
and an animal shares its species' geometry and coat. Fewer of them saves bytes inside the noise. The GL even rises a
little, because a coat atlas follows the variants that happen to spawn, not the count. View distance is the only lever
that measures, and only −6.5 MB, from the cabins' detail meshes that never build. B and C give the same figure, and the
frames barely differ: the fog already hides the reach it cuts.

The remaining ~100 MB is in things these levers don't touch (`round-35-memory-variants/README.md` and the census):
- the engine's practice dummies, resident at Pine's spawn: **−33.6 MB GL**. SF22d's Memory saver loads them only
  when the room opens. That cut is invisible.
- the creature coats and hulls as KTX2 (coat canvases 15.4, hull albedos 8.4, hull normal maps 11.2): **~−26 MB**,
  close to invisible.
- the ground decal / pond sets' RGBA8 parts: **≤ −15 MB**.
- the composer targets at render scale 2: EffectComposer colour 17.5 + depth 8.8, luminance 8.8, SMAA 8.8. These are
  engine-wide and stay, because render scale stays 2×.

**Recommendation:** don't take a content cut. View distance B (−6.5 MB) is the only one that pays, and it is small. Close the gap
with the invisible cuts above, starting with the dummies on demand, then re-read the Simulator.
