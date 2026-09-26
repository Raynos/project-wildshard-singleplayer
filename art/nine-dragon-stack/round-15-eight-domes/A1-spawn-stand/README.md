# Dome A1 · A1-spawn-stand (E169, round 15: the eight domes)

mockup A's own camera: the spawn on Lantern Square by the carved balustrade at the Well's edge, looking north at the paifang and the banyan. Mockup: `art/nine-dragon-stack/round-6-baseline-hud/style-A-jiehua-neon.jpg`. Pair: `A2-gate-look`. Anchor (ground): (0.95, 125.0, 7.5).

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
| 1 | look up | fp | (0.95, 126.62, 7.5) | +12.0 | +62.0 | 58 |
| 2 | aerial over the square | aerial | (8.0, 148.0, 16.0) | -3.4 | -34.0 | 60 |
| 3 | aerial over the Well | aerial | (-14.0, 145.0, 0.0) | +56.3 | -42.8 | 60 |
| 4 | turn left (the Well) | fp | (0.95, 126.62, 7.5) | -78.0 | -8.0 | 58 |
| 5 | THE MOCKUP | fp | (0.95, 126.62, 7.5) | +12.0 | -4.0 | 58 |
| 6 | turn right (the stair-street) | fp | (0.95, 126.62, 7.5) | +102.0 | +0.0 | 58 |
| 7 | turn around (south) | fp | (0.95, 126.62, 7.5) | +192.0 | +2.0 | 58 |
| 8 | look down | fp | (0.95, 126.62, 7.5) | +12.0 | -75.0 | 58 |
| 9 | aerial from the gate, back | aerial | (8.0, 140.0, -30.0) | -169.4 | -21.5 | 60 |

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
| `sheet-target-3x3-v1.jpg`, `sheet-capture-3x3-v1.jpg`, `cameras-v1.json` | v1, the earlier method: codex EDITS of the clean-room captures (`round-8-look-loop-1` for A1, `round-10-dome-b-1` for A2), relaid into this grid order. Kept for comparison |
