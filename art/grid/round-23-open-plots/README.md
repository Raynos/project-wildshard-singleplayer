# Grid round 23: open plots (G198)

**Question:** Jake's pick G198 (2026-10-07): *"Half template copies half open plots that say you can build and upload
your own shard"*. On the public grid, the cells without a real shard alternate between Template 1 copies and **open
plots**. What does an open plot look like, and what does its sign say? G199 says the grid grows by rings (3 × 3 now,
then a 5 × 5 ring), so the open plot is also how an empty ring cell will look.

The open plot's floor is the VR void (G77: black floor, cyan grid), so the cell reads as unclaimed. It stays a
collision wall like the void today. Only the marker and the sign change between variants, and any variant can take
any of the three wordings.

| file | what it shows |
| --- | --- |
| `board.jpg` | the A / B / C board: rows = from the road, from above; columns = today, A, B, C; bottom row = today's 3 × 3 vs B in context |
| `today-road.jpg` | **real capture**: on the road's edge facing the south-east corner cell (`template-6`), a white grey-box Template copy |
| `today-above.jpg` | **real capture**: 220 m over the crossroads, looking down at the same cell, with the VR void beyond |
| `today-grid.jpg` | **real capture**: 2.5 km over the grid. The four corner cells are pale Template copies |
| `A-road.jpg`, `A-above.jpg` | **A, surveyor's staked plot**: knee-high timber stakes with orange flagging tape along the plot edges, and a timber signpost at the kerb with a navy plank reading **"BUILD YOUR OWN SHARD"** |
| `B-road.jpg`, `B-above.jpg` | **B, holographic frame**: the cell's 500 m cube outlined in thin cyan light (a floor border plus corner pillars into the sky), and a floating sign at the kerb in the HUD's style (navy glass, cyan hairlines, corner brackets) with two lines: **"OPEN PLOT"** and **"UPLOAD YOUR SHARD HERE"** |
| `C-road.jpg`, `C-above.jpg` | **C, meadow clearing with a notice board**: one ~20 m faceted grass pad at the kerb, and a roofed timber notice board with a pinned paper reading **"THIS CELL IS YOURS TO BUILD"** |
| `context-B.jpg` | **B in context**: the public 3 × 3 from above, with real shards on the edges and centre and the corners in a checkerboard: top-left and bottom-right are Template copies, top-right and bottom-left are B open plots, each signed **"OPEN PLOT"** |

## Recommendation: B, the holographic frame

B speaks the grid's own language: the void, the cyan hairlines and the HUD's navy glass. The cell then reads as an
empty slot in the system, while a Template copy reads as a place. It is also the only variant that shows from far away:
the cube's light pillars stand 500 m tall, so you see open plots from across the grid and from the sky-down reveal,
where A's stakes and C's notice board vanish. The sign is a UI panel, not painted wood, so its text stays crisp at
phone resolution and comes from the strings table. It is the cheapest to build: lines and one panel, with no modelled
props per plot. Its words, "OPEN PLOT · UPLOAD YOUR SHARD HERE", say what the cell is and what to do in six words.
A is the most charming up close, but its tape is gone at 100 m. C's grass pad is a small "place" in the void, which
muddies the line between empty and built.

## Notes

- Captures: a `git archive HEAD` build (`f50c08a56`, `scripts/serve-build.sh --head`), INFINITE WILDSHARD with Settings ▸
  Developer on, Chromium as an iPhone 16 Pro in portrait, phone tier, muted, through `scripts/browser-lane.sh`. The
  player was held at each pose, and the Developer budget bar was hidden for the frame. Live layout: Driftwood at the
  centre, Pine Hollow, Sunscar Dunes, Nalati and Sky Reach on the edges, `template-1/2/4/6` on the corners.
- Engines: three quick local Qwen-Image-2.1 turbo road takes (`scripts/mockup-local.sh`) checked the layout and wording
  first. They are not on the board, because Qwen greyed the HUD. The finals are codex `image_gen` edits of the real
  captures.
- Re-rolled: `C-above` once (the first take erased the road), `context-B` once (the first take repeated the desert in
  three cells).
- Mockup liberties: `B-above` redraws the camera as a full crossroads in front of the cell. `C-above` keeps only thin
  kerbs of the near road. The open plots' void floor is lighter than the real void in the road views. In `context-B`
  the shard cells are painted stand-ins, not their real far views. Today's real far views are pale, as `today-grid.jpg`
  shows.
- Prompts, the capture script and the runner were scratch files. This folder holds only the captures and the finals.
