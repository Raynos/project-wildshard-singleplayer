# Round 8 · look loop 5 (E169, 2026-09-25): the shaft opens, the Well dresses deeper

The fifth pass of dome A's 9-angle loop: anchor P = the spawn, the same cameras, `time(6.5)`, blue hour, no HUD, against
round 1's targets (`../round-8-look-loop-1/target-1…9.jpg`). The captures export the shared working tree. Dome B's
crowd round the spawn (FP 1 / 3 / 4) and its gate appear in round 6's frames; they are dome B's work.

| File | What |
|---|---|
| `capture-1…9.jpg`, `sheet-ingame-3x3.jpg` | this round's frames (after round 4's fixes) |
| `board.jpg` | **BEFORE** (this round) \| **AFTER** (round 6) \| **TARGET** (round 1), FP 1, FP 6, aerial 7 |
| `warm-vs-cool.jpg`, `stats.txt` | A blue hour \| B warm silk; draws and triangles per camera |

## Gap list (capture → target)

1. The streaks are warmer than the targets' now that the lit windows reflect (streaks ΔE 4.5).
2. The walls are a shade dark (wall ΔE 2.1).
3. Aerial shaft (the weakest frame): the base air, read at the ray's mid height down in the Well, greys out the
   shaft's top; the walls near the camera sit in the mid LOD with no clutter.
4. Aerial across: the Well's wall under the square is window rows. The target stacks timber verandas with glazed
   eaves, red posts and lanterns there.
5. The sky screens' painting and the wall surfaces wait on P7 (the scroll) and P5 (painted textures).

## Fixes and what happened (round 6's captures)

| # | Gap | Track | Fix | Status |
|---|---|---|---|---|
| 1 | Warm streaks | G | Window cards 0.1 → 0.07, 30 % white in their colour | Better (4.5 → 4.0) |
| 2 | Walls dark | C | Facade wash `#dadeeb` → `#e0e3ef` | The street towers lifted, but the Well's darker walls now fill more of the wall frames (2.1 → 2.6). Round 6 lifts the shaft's washes ~6 % |
| 3 | Shaft greys out | F | Looking up, the base air is read near the ray's top instead of its middle: from inside the Well the shaft opens toward the lit sky, while looking down keeps the thick silk | Fixed: aerial 8 shows the stacked walls and the sky slot at the top |
| 4 | No clutter near the shaft camera | M | The Well's full detail reaches 95 m below the square (was 75), its clutter band 90 m (was 45) | Fixed; triangles 1.62 → 1.73 M |
| 5 | Windows where the target has verandas | M | Veranda floors in the Well 40 → 60 % | Fixed (aerial 9, FP 2, FP 6) |

ΔE per region (targets vs captures):

| Region | Round 4 | Round 5 | Round 6 |
|---|---|---|---|
| wall | 2.3 | 2.1 | 2.6 |
| wet ground | 3.9 | 2.6 | **2.2** |
| streaks (neon; not fitted) | 3.8 | 4.5 | 4.0 |
| stone (dome B) | 11.2 | 5.5 | 5.7 |
| silk sky | 1.8 | 1.7 | 1.9 |
| lit windows | 3.0 | 2.9 | 2.9 |
| cinnabar (dome B) | 0.7 | 0.8 | 0.8 |

## Rulers

- Draws 77–95 per frame (≤ 200); triangles 1.50–1.73 M (≤ 2.5 M), `../round-8-look-loop-6/stats.txt`.
- Gates: tsc clean on the clean room (the tree's one tsc error is P8's `src/dev/nd-lab/viewmodel`); oxlint clean.
