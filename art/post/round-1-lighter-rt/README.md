# Round 1: lighter post-processing render targets (G713, core-memory C5)

Pick between today's post-processing render targets (A) and variant B's lighter chain, per shard look. In game:
pause ▸ Settings ▸ Debug ▸ Look ▸ **Post render targets** (A Today / B Lighter, reloads; A is the default).

B keeps every pass, its order and its settings; only the targets shrink:

- the composer's output buffer is 8-bit sRGB when nothing writes it before the tone map;
- bloom's luminance pass at a quarter of the frame (A: half), its mip chain one level smaller;
- the god rays' light mask at half the frame (the rays are drawn at the tier's ray scale from it);
- FXAA in place of SMAA where the tier runs SMAA (Template and Driftwood already ship FXAA).

Captures: phone tier, Chromium as iPhone 16 Pro (804×1362), the shard's spawn view, build `1873e9ca2c`. The lower
panels are the centre of the view at 2× (edges and the held item). Two separate boots each, so moving things (clouds,
water, creatures) differ by a little.

| Shard | A MiB | B MiB | Change | GPU ms A / B (median) | Frame ms A / B |
|---|---:|---:|---:|---|---|
| Template | 70.1 | 60.3 | -9.9 | 7.03 / 7.01 | 20.2 / 20.1 |
| Driftwood Isle | 70.1 | 60.3 | -9.9 | 7.07 / 6.93 | 20.1 / 20.1 |
| Pine Hollow | 61.3 | 33.7 | -27.6 | 6.71 / 5.68 | 20.2 / 20.2 |
| Sky Reach | 63.8 | 36.2 | -27.6 | 7.66 / 7.36 | 19.2 / 19.0 |
| Signal Dunes | 49.2 | 22.6 | -26.6 | 4.73 / 4.51 | 17.4 / 17.3 |
| Nine Dragon Stack | 55.1 | 55.1 | 0 | (its own graph pass; B changes nothing) | |

Nalati runs its own replace-look graph, which B does not touch. The 40 MiB left on Template and Driftwood is the phone
shadow rig (3 cascades + 2 fade ghosts at 2048², E174's pick; E318 already turned down half-size ghosts), not post.

Boards: `board-template.jpg`, `board-driftwood-isle.jpg`, `board-pine-hollow.jpg`, `board-far-reach.jpg` (Sky Reach), `board-sunscar-dunes.jpg`.
