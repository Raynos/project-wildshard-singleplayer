# Dome C1 · C1-stair-stand (E169, round 15: the eight domes)

mockup C's own camera: standing on Lantern Square at the foot of the stair-street, looking east up the stairs. Mockup: `art/nine-dragon-stack/round-6-baseline-hud/comp-C-stair-street.jpg`. Pair: `C2-stair-look`. Anchor (ground): (18.0, 125.0, 6.0).

Jake (2026-09-26): only the first mockup is good, the other three views lack world detail; **two domes per mockup**
(where the camera stands, where it looks), a 3×3 of nine views per dome, then build them in the engine. These targets
are imagined from the mockup, not painted over the engine: codex is given the mockup and a floor plan and paints the
nine views of the mockup's world as one contact sheet, then every tile is upscaled on its own.

## Method

1. `cameras.json`: the nine poses in layout.ts coordinates (x east, z south, y altitude, Y0 = +125; yaw 0 = north,
   +90 = east; `eye` = camera position; `hfov` = horizontal FOV of a 2:3 portrait frame). Grid order:
   1 up · 2 aerial · 3 aerial / 4 left · 5 the mockup camera · 6 right / 7 turn around · 8 down · 9 aerial.
2. `floorplan.jpg`: the plan (and a section) drawn from layout.ts / well.ts / stairstreet.ts with the nine cameras.
3. One codex `image_gen` per candidate, inputs [mockup, floor plan] → one 1024×1536 image = a 3×3 of 2:3 tiles.
   Two candidates; kept **a** (`grid-raw.jpg`; the other is `grid-raw-alt.jpg`): its up / back / aerial tiles
   face the way the cameras say.
4. The grid cut at its gutters (`tile-N.jpg`), each tile upscaled by one codex EDIT, inputs [tile, mockup]
   ("keep the composition, camera and every structure; add detail at the mockup's density") → `target-N.jpg`
   (1024×1536). No upscale was re-rolled.
5. Scripts: scratchpad `eight/` (`domes.py` the cameras, `plan.py`, `mkgrid.py`, `mkup.py`, `sheets.py`,
   `cap8.mjs` the engine capture for later).

## The nine cameras

| # | view | kind | eye (x, y, z) | yaw | pitch | hfov |
|---|---|---|---|---|---|---|
| 1 | look up | fp | (18.0, 126.62, 6.0) | +90.0 | +64.0 | 62 |
| 2 | aerial over the square | aerial | (6.0, 150.0, 6.0) | +90.0 | -40.2 | 60 |
| 3 | aerial over the stairs, back | aerial | (48.0, 152.0, 6.0) | -90.0 | -42.0 | 60 |
| 4 | turn left (north) | fp | (18.0, 126.62, 6.0) | +0.0 | -2.0 | 62 |
| 5 | THE MOCKUP | fp | (18.0, 126.62, 6.0) | +90.0 | +10.0 | 62 |
| 6 | turn right (south) | fp | (18.0, 126.62, 6.0) | +180.0 | -2.0 | 62 |
| 7 | turn around (west) | fp | (18.0, 126.62, 6.0) | +270.0 | +0.0 | 62 |
| 8 | look down | fp | (18.0, 126.62, 6.0) | +90.0 | -58.0 | 62 |
| 9 | top-down over the foot | aerial | (20.0, 178.0, 6.0) | +90.0 | -83.5 | 60 |

## Files

| File | What |
|---|---|
| `cameras.json` | the nine poses (+ a one-line description of what each view should show) |
| `floorplan.jpg` | plan + section with the numbered cameras (the spatial grounding codex was given) |
| `grid-raw.jpg`, `grid-raw-alt.jpg` | codex's 3×3, kept and other candidate |
| `tile-1…9.jpg` | the kept grid cut at its gutters |
| `target-1…9.jpg` | the upscaled tiles: the look targets (1024×1536 portrait) |
| `sheet-target-3x3.jpg` | the nine targets, labelled, phone-friendly |
| (later) `capture-1…9.jpg`, `sheet-capture-3x3.jpg` | the engine from the same cameras (`cap8.mjs`) |
