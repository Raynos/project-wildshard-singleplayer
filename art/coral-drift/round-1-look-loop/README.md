# Coral Drift: the G983 look loop

G983 (Jake, 2026-11-03 00:35): every built open plot gets a finish step. Capture its hero views in the engine, have
codex `image_gen` remaster each capture into the target look, then run the look loop (`docs/design/LOOK-LOOP.md`) over
9 fixed angles until the gap closes. sp-o2 decides each round from the boards and logs the pick (G872); the last board
goes to Jake. The method and the 9 angles are Lantern Bayou's (`art/lantern-bayou/round-2-look-loop/README.md`).

## Round 0: capture 02f325dade, targets

- `sheet-r0-capture-vs-target.jpg`: each angle's capture beside its target.
- `target-1.jpg` … `target-9.jpg`: codex `image_gen`. Each run got the capture to edit, the round-62 board
  `art/grid/round-62-open-plot-palettes/10-coral-drift.jpg` as a style reference, and one shared prompt. All 9 were
  usable; 5 and 6 kept the capture's burned header strip, which is ignored.

### Gap list

| # | gap | frames | track | round 1 |
|---|---|---|---|---|
| 1 | a saturated cyan noon sky with white clouds, where the game draws a pale lavender haze | 2, 3, 5, 7, 8, 9 | look key | partly: a deeper sky key and a paler, further fog (b595178992); clouds are the sky's |
| 2 | the arch bright and saturated (pink, peach, lilac), where the game dims it under the bayou's dusk light | 4, 7, 9 | landmark light | fixed: `landmarkNoon` (b595178992) |
| 3 | vivid turquoise water with caustics over a pale sandy floor, where the game draws flat cyan | 1, 3, 4, 6 | water | partly: water #3ad6d0 (b595178992); caustics and a visible floor need the lagoon water kind |
| 4 | pale bleached planks, where the game draws grey boards | 2, 7 | palette | partly: warmer bleached boards (b595178992) |
| 5 | palms along the lagoons, where the plaza quarters plant Night Market's boxy trees | 4, 6, 7 | kit | fixed: the banks plant young palms (47648e0b8f) |

## Round 1: capture 6ed2e90 (72 views)

- `sheet-r1-r0-r1-target.jpg`: each angle as R0, R1 and its target.
- Moved: the plaza sky is bluer (8), and the boxy trees are gone from the banks.
- Still open: the sky is still pale beside the targets' saturated cyan; the arch barely moved under the noon fill (its
  swatches are what lack saturation); the bank palms read small (the young palm unscaled, 4 m); the water has no
  caustics or visible floor (the lagoon water kind).

## Round 2: capture 3f18b9d190 (72 views; with the lagoon water kind 2dcaf72e22)

- `sheet-r2-r0-r1-r2-target.jpg`: each angle as R0, R1, R2 and its target.
- Moved: the arch reads saturated (9), the plaza sky bluer (8), and the caustic web shows on the lagoons (4).
- Still open: the boardwalks read grey beside the targets' warm pale boards; the road views' sky is the grid's (out of
  scope). Bar 7 (sp-o3's road-entry clip): lamps and black-blinking specks only, hence gulls and no fireflies
  (3221e06306).

## Round 3: capture 583f2b3ae4 (72 views)

- Closed: the arch saturated, the plaza sky a deeper blue, the caustic web over every lagoon, palms on the banks, gulls
  over the water and no noon specks (bar 7 passes: lamp flicker and gulls, sp-o3 at acc0a955d6).
- Open: the boards are warmer but still greyer than the targets' bright pale planks under noon light; the road views'
  sky is the grid's; the lagoons show no sandy floor through the water (a transparent lagoon would be a new material).

## Final board

`final-board.jpg`: four hero angles (road entry, 40 m toward the arch, the plaza, under the arch), each as A before
(the first build, 02f325dade), B after (round 3, 583f2b3ae4) and C target. This is the board for Jake.

## Picks (G872, logged)

- **R1** (sp-o2, 2026-11-03, b595178992): gaps 2 and 4, the sky key and fog of gap 1, and the water colour of gap 3.
  This is a light and palette round, and it trades nothing the old look had.
- **R2** (sp-o2, 2026-11-03, a2de5f3227): more saturated coral swatches (peach, pink and lilac); a deeper, more
  saturated sky key and a bluer fog; the bank palms scaled to the trees they replace (the same model, no new bytes).
- **R3** (sp-o2, 2026-11-03): warmer bleached boards (paving, lanes, plaza, forecourts, court, planks); the gulls and
  firefly removal of 3221e06306. Coral's last round: the final board comes from its capture.
- **Finish** (sp-o2, 2026-11-03): stop after round 3. The structure, light, life and colour gaps are closed. The
  boards' last bit of brightness, a visible lagoon floor and the grid's sky are logged as open items, not more rounds.
