# Lantern Bayou · round 3 · the open items (OB2, 2026-11-03, sp-o3)

The two items round 2 of the look loop logged as new work (`../round-2-look-loop/README.md`, "Finish"): the lanterns
mirrored in the water, and a fuller crown of lanterns. Taken over from sp-o2 on wildshard-new's word.

`board.jpg`: BEFORE (HEAD c8cf4b6792) · AFTER (round 2 below) · TARGET (the look loop's T0 targets) at the plot's dome
cameras (eye / look from `art/open-plots/lantern-bayou/domes/`, 62° across a 402 × 603 portrait frame), entered from
the SHARD SELECT card on the phone tier at 2x as an iPhone 16 Pro, plus two eye-level pond views. The pond rows' target
is the 40 m view's water: no target was made at eye level over a pond.

## What changed

- **Reflections.** Each low emitter within 5 m of water lays a streak on the water (`waterStreaks`,
  `src/shards/open-plots/generators/kit.mjs`): a small quad at the lamp's foot whose uvs name its corner, in the Pool's
  own additive draw. The streak pool graph (`data/poolStreaks.graph.json`, a row's `pool: "streaks"`) stretches it in
  the vertex stage toward the camera, as long as the lamp's mirror point lies away (2.5 × h / (h + H) of the distance,
  at most 0.85 of it), and shades it brightest round the mirror point, broken into drifting ripple bands. The boardwalks
  cover what runs under them. No reflection pass, no texture, no new draw: 1,048 streaks, +2,096 triangles in the Pool
  draws.
- **The crown.** The cypress hangs 72 lanterns (was 40), the extra 32 as second ropes on the 40 outer pads
  (`scripts/blender/open-plots/cypress.py` `OUTER`; the first 40 hooks are unchanged), and the lanterns are 2.1x (was
  1.6x). The ten inner pads get none: they sit inside the crown's top, and their lanterns pushed the plaza's SW tile past
  its 300 KB cap.

## Numbers

- Draws identical at all six views, before and after (158 / 178 / 156 / 90 / 112 / 164, standalone, Chromium).
- Triangles in view +9k (ponds) to +24k (plaza, crown); the cypress near model 15,207 → 15,399.
- Phone wire 6,422,962 → 6,478,566 B (+55.6 KB, under the +100 KB a round standing rule).
- No new tile debt.

## Ruling (G872, sp-o3)

- **R1:** 80 lanterns at 1.6x and 0.45 m streaks, gain 1.1. The crown read barely fuller and the streaks as wide, bright
  blobs. A first take with a 14 m cap left every streak under the boardwalk.
- **R2 ships:** 72 lanterns at 2.1x, 0.15 m streaks, gain 0.8. The crown reads full from the plaza and under it; the
  ponds carry banded warm columns under their lamps, as the targets do. Still apart from the targets: the glow reads
  cream more than amber (the shared Glow graph), and the sky is the grid's.
