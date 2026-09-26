# Dome D1 · D1-well-down-stand (E169, round 15: the eight domes)

mockup D's own camera: leaning over the carved balustrade on the Well's south rim, looking steeply down the shaft. Mockup: `art/nine-dragon-stack/round-6-baseline-hud/comp-D-well-down.jpg`. Pair: `D2-well-down-look`. Anchor (ground): (-10.5, 125.75, 10.55).

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
   Two candidates; kept **b** (`grid-raw.jpg`; the other is `grid-raw-alt.jpg`): its up / back / aerial tiles
   face the way the cameras say.
4. The grid cut at its gutters (`tile-N.jpg`), each tile upscaled by one codex EDIT, inputs [tile, mockup]
   ("keep the composition, camera and every structure; add detail at the mockup's density") → `target-N.jpg`
   (1024×1536). No upscale was re-rolled.
5. Scripts: scratchpad `eight/` (`domes.py` the cameras, `plan.py`, `mkgrid.py`, `mkup.py`, `sheets.py`,
   `cap8.mjs` the engine capture for later).

## The nine cameras

| # | view | kind | eye (x, y, z) | yaw | pitch | hfov |
|---|---|---|---|---|---|---|
| 1 | look up | fp | (-10.5, 127.37, 10.55) | -3.0 | +66.0 | 64 |
| 2 | aerial above the rim | aerial | (-14.0, 150.0, 13.0) | +5.0 | -65.2 | 60 |
| 3 | aerial in the shaft, back up | aerial | (-20.0, 108.0, -22.0) | +163.9 | +27.7 | 60 |
| 4 | turn left (down the west wall) | fp | (-10.5, 127.37, 10.55) | -93.0 | -45.0 | 64 |
| 5 | THE MOCKUP | fp | (-10.5, 127.37, 10.55) | -3.0 | -64.0 | 64 |
| 6 | turn right (down the east wall) | fp | (-10.5, 127.37, 10.55) | +87.0 | -45.0 | 64 |
| 7 | turn around (south) | fp | (-10.5, 127.37, 10.55) | +177.0 | +4.0 | 64 |
| 8 | look straight down | fp | (-10.5, 127.37, 10.55) | -3.0 | -88.0 | 64 |
| 9 | aerial over the far end | aerial | (-4.0, 136.0, -38.0) | -167.5 | -47.3 | 60 |

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
