# LEGACY goldens, per camera (G843)

These are the 24 LEGACY reference frames, one per camera, kept for reference after legacy is deleted.
`<shard>/<n>-<camera>.jpg` is the LEGACY frame. `compare-2026-10-28/<shard>/<n>-<camera>-shardfile.jpg` is the SHARDFILE
frame from the same camera, captured in the same session. The six-up sheets from earlier today are in
[round-1-2026-10-28/](round-1-2026-10-28/).

## Capture

- Source `033398c5c663bffc79b0024989b1559cdfbab980`, served build `033398c-mvskb8po` (a shared `serve-build.sh --head`
  preview). Captured 2026-10-28.
- Muted Chromium (`--use-angle=metal`) through `scripts/browser-lane.sh`, iPhone 16 Pro portrait, phone tier, render
  scale 2×. Frames are 402 × 681 CSS px. The HUD is visible; the Developer overlays are hidden.
- Seed 357. Saved settings are **midday / clear** and volume 0, the same as the CO6 board; each shard's authored sky
  stays its own.
- Each entry ran in a fresh context, through SHARD SELECT, with Developer and the Legacy shard buttons row on. The
  LEGACY button entered `<slug>-legacy` and SHARDFILE entered `<slug>`. All 12 entries had 0 page errors.
- For each camera the player was posed at the camera's probe and the game ran ≥ 120 drawn frames, plus a streaming-idle
  check. Then the camera was pinned to the canonical eye, rotation and FOV and one frame was rendered.

## Cameras

The same cameras as the CO6 board,
[cameras.json](../legacy-vs-shardfile/round-1-2026-10-28/cameras.json) (eye in metres; yaw and pitch in degrees):

| Shard | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| driftwood-isle | pier (0, 2.9, -194) yaw -180 | beach (-10, 2.4, -150) yaw -246 | wreck (105, 4.5, 0) yaw 90 | spawn-opposite (0, 2.9, -194) yaw -360 |
| pine-hollow | gate (0, 1.8, -200) yaw -180 | cabin (-14, 3.8, -62) yaw -180 | pond (-56, 1.0, 95) yaw -180 | spawn-opposite (0, 1.7, -235) yaw -360 |
| nalati-grasslands | camp (60, -2.0, 214) yaw 90 | bridge (0, 1.5, 200) yaw 0 | plains (65, 27.6, 0) yaw -180 | spawn-opposite (0, 1.7, 232) yaw -180 |
| far-reach | spawn (0, 31.7, -5.5) yaw 0 | hover (12, 31.7, -2.5) yaw 80 pitch -6 | windmill (0, 31.7, -5.5) yaw 0 | roost (-1.6, 31.7, -5.7) yaw 0 |
| sunscar-dunes | spawn (0, 23, 70) yaw 0 pitch 2 | whip (0, 22, 66) yaw -20 pitch -4 | ray (0, 23, 70) yaw -3 pitch 9 | quest (4, 20.6, -63) yaw 15 pitch 22 |
| nine-dragon-stack | A (1, 126.7, 7.5) yaw 12 pitch -4 | B (-19.5, 126.7, 13.3) yaw 0 pitch -10 | C (18, 126.7, 6) yaw 90 pitch 10 | D (18, 126.7, 6) yaw 0 |

FOV: 86.8° for Driftwood, Pine and Nalati, 72° for Far Reach and Sunscar, 93° for Nine.

## Comparison at this build

HUD-masked luma SSIM, LEGACY against SHARDFILE, cameras 1–4, with the rating by eye out of 10:

| Shard | SSIM 1 / 2 / 3 / 4 | Rating |
|---|---|---|
| nine-dragon-stack | 0.62 / 0.48 / 0.57 / 0.67 | 3 (NR1 hands, NR2 wet stone, NR3 facades, NR6 rain, NR7 fu) |
| pine-hollow | 0.77 / 0.87 / 0.82 / 0.96 | 6 (lime far stand-in cones, missing pond prop and snow patch, blown-out sky haze; no row) |
| driftwood-isle | 0.89 / 0.90 / 0.85 / 0.87 | 8 (more and higher clouds, warmer planks; no row) |
| far-reach | 0.75 / 0.85 / 0.61 / 0.82 | 9 (matches since 18aaab1583; a drift ray flies through camera 3) |
| nalati-grasslands | 0.93 / 0.97 / 0.83 / 0.99 | 9 |
| sunscar-dunes | 0.98 / 0.98 / 0.98 / 1.00 | 10 |

Clouds, rain, crowds and creatures move between the two visits, so SSIM is a guide, not a parity claim.

## Re-shot 2026-10-28 (four of the 144, G859 set)

With the fixed compare harness (`compare/capture.mjs`: the eye is the live game camera, a free camera's player hovers under
it, a drifting player is put back, and the spectator takes no damage), on `2856d1669f`:

- `pine-hollow/24/11-bear-den.jpg`, `20-grid+170+170.jpg`: the first shots showed spawn. At the probe LEGACY's player slid
  downhill and the bear den's elite killed it; the death fade put it back at spawn, and that eye was written into
  `cameras24.json`. Now the bear den and the grid corner, with their eyes written back (`compare.py eyes`).
- `sunscar-dunes/24/21-aerial-south.jpg`, `22-aerial-west.jpg`: the first shots held the ground camera's night sky for an
  aerial eye; the sky follows the camera in its update, so a player up there sees a dusk band. LEGACY now draws it too.
