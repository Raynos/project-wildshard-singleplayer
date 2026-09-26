# Dome B2 · B2-well-edge-look (E169, round 15: the eight domes)

where mockup B looks: mid-shaft, 34 m north of its camera, standing on a timber bridge that crosses the canyon 7 m below the rim. Mockup: `art/nine-dragon-stack/round-6-baseline-hud/comp-B-well-edge.jpg`. Pair: `B1-well-edge-stand`. Anchor (ground): (-14.0, 118.0, -22.0).

Jake (2026-09-26): only the first mockup is good, the other three views lack world detail; **two domes per mockup**
(where the camera stands, where it looks), a 3×3 of nine views per dome, then build them in the engine. These targets
are imagined from the mockup, not painted over the engine: codex is given the mockup and a floor plan and paints the
nine views of the mockup's world as one contact sheet, then every tile is upscaled on its own.

## Method

1. `cameras.json`: the nine poses in layout.ts coordinates (x east, z south, y altitude, Y0 = +125; yaw 0 = north,
   +90 = east; `eye` = camera position; `hfov` = horizontal FOV of a 2:3 portrait frame). Grid order:
   1 up · 2 aerial · 3 aerial / 4 left · 5 facing further on · 6 right / 7 back to the mockup's camera · 8 down · 9 aerial.
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
| 1 | look up | fp | (-14.0, 119.62, -22.0) | -3.0 | +64.0 | 62 |
| 2 | aerial from the south-west | aerial | (-24.0, 140.0, 8.0) | +18.4 | -36.0 | 60 |
| 3 | aerial from the north | aerial | (-4.0, 138.0, -42.0) | -153.4 | -43.2 | 60 |
| 4 | left (west wall) | fp | (-14.0, 119.62, -22.0) | -93.0 | -2.0 | 62 |
| 5 | facing further on (north) | fp | (-14.0, 119.62, -22.0) | -3.0 | -4.0 | 62 |
| 6 | right (east wall) | fp | (-14.0, 119.62, -22.0) | +87.0 | -2.0 | 62 |
| 7 | back to the mockup camera | fp | (-14.0, 119.62, -22.0) | +177.0 | +9.0 | 62 |
| 8 | look down | fp | (-14.0, 119.62, -22.0) | -3.0 | -76.0 | 62 |
| 9 | aerial from the east, rim height | aerial | (-3.0, 128.0, -6.0) | -34.5 | -27.2 | 60 |

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
