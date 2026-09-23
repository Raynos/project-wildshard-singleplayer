# Driftwood Isle: round 9, the painted horizon (DRIFTWOOD-REMASTER X4)

The film matte-painting trick. The mockups' far distance (sea stacks, far islands with palms, cloud banks on the sea,
sea haze) is painted. Before this round the game had sparse geometry and a gradient there. This round paints a 360° band
with codex image_gen, stitches it and ships it as `src/world/HorizonMatte.ts` with
`public/assets/horizon/driftwood-isle-{day,night}.webp` (4096 × 512 RGBA, 148 KB + 166 KB).

## Files

- `capture-h<t>.jpg`: the six in-game references at headings t = 0, 60 … 300° (dir = (cos t, 0, sin t), so t = 0 looks
  +x (W), t = 90 looks +z (N), t = 270 looks at the midday sun (S)). Each is shot from (0, 3, 0) at pitch 0, vfov 72°,
  1536 × 1024, `tod=0.4167`. Everything is hidden except the sky dome and the sea, so the horizon line sits exactly on
  the middle row, and the sky gradient and sun glow are the game's own.
- `segment-day-h<t>.jpg`: codex edits of each capture: far islands and stacks in the middle 40 %, a continuous cloud
  bank on the horizon, the upper sky left plain. The horizon line stays on the middle row. There were two rounds. The
  first put the stacks at ~3° high and read too small at phone width, so it was not kept. This set is the second, bolder
  round (the tallest element ~10°, towering cumulus up to ~14°). Prompts: `scripts/horizon-matte/mkjobs_day2.py`.
- `segment-night-h<t>.jpg`: a codex edit of each day segment into a moonlit night. It keeps the same silhouettes: phase
  correlation of the edge maps against the day segments gives a (0, 0) px shift for every heading except h000, which
  shifts 1 px. So the night texture reuses the day alpha, and the day↔night blend never double-exposes.
- `strip-day.jpg`, `strip-night.jpg`: the six segments projected into the cylindrical strip (u = azimuth, rows linear
  in elevation −4° … +24°). Neighbours join along a min-cost vertical seam inside their ±11° overlap, feathered 10 px
  where the content is and 150 px in the open sky (that hides the segments' sky-tone steps). The 0/360 wrap falls in the
  middle of segment h000, so it is seamless by construction. Script: `scripts/horizon-matte/stitch.py`.
- `strip-day-keyed-over-checker.jpg`: the keyed day strip over a blue / orange checker. Alpha is each pixel's distance
  from a slowly varying sky model estimated from the strip's own sky pixels. Enclosed low-alpha pockets (hazy blue-grey
  rock faces) are filled, the colour is un-mixed at soft edges, the painted feet are kept 0.6° below the horizon, and the
  painted sea is faded out by −1.6°. Script: `scripts/horizon-matte/key.py`.
- `sheet-before-after.jpg`: the 9 spawn-cove cameras from `round-4-remaster/README.md` with P = (0, −146.5) and the eye
  at ≈ 3.14, before (`?matte=0`) and after, plus FP back and left at night (`tod=0.9`). Phone 390 × 844 for 1–4,
  desktop 1600 × 900 for 5–9.

## In game

A 2300 m open cylinder (128 × 8 quads) follows the camera on XZ at sea level. It is unlit and fogless, transparent and
depth-tested, with no depth write, at renderOrder −16: after the dome, before the 3D cumulus, the planet and the sea. The
sea covers everything below its own horizon line. The day texture is tinted by the cumulus' lit colour relative to
midday (golden hour warms it, dusk dims it) and fades into the night texture on `DayNight.night`. Near the sea it is
hazed toward the dome's live horizon colour, and the sun glow reaches over it. The paintings load on `ws:ready` (after
boot) and fade in over 1.5 s. When they are shown, Horizon.ts' faceted islet rings (the geometry the painting replaces)
are hidden. With `?matte=0` or a failed load, the islets stay as the fallback.

Phone tier (`?tier=phone`) at P, calls matte on / off: front 92 / 94, left 80 / 82, right 78 / 80, back 75 / 77. That
is +1 band − 3 islet rings. Triangles are −1.9 k.
