# Round 8 · look loop 6 (E169, 2026-09-25): window light and canyon haze

The sixth pass of dome A's 9-angle loop: anchor P = the spawn, the same cameras, `time(6.5)`, blue hour, no HUD,
against round 1's targets (`../round-8-look-loop-1/target-1…9.jpg`). The captures export the shared working tree, so
dome B's crowd round the spawn and its gate show in the frames too.

| File | What |
|---|---|
| `capture-1…9.jpg`, `sheet-ingame-3x3.jpg` | this round's frames (after round 5's fixes) |
| `board.jpg` | **BEFORE** (this round) \| **AFTER** (round 7) \| **TARGET** (round 1), FP 1, FP 6, aerial 7 |
| `warm-vs-cool.jpg`, `stats.txt` | A blue hour \| B warm silk; draws and triangles per camera |

## Gap list (capture → target)

1. The Well's walls a shade darker than the targets' (wall ΔE 2.6).
2. Lit windows: warmer and more saturated than the targets' `#cf9e71`.
3. FP up: the targets dissolve the tower tops and the Cable Deck into blue silk haze. Ours are crisp to the sky.
4. FP left / down: the balustrade is lighter than the targets' wet granite (dome B).
5. Still waiting on the labs: wall surfaces (P5), the aerial square's light pools and contrast (P6), the sky screens'
   painting (P7).

## Fixes and what happened (round 7's captures)

| # | Gap | Track | Fix | Status |
|---|---|---|---|---|
| 1 | Well walls dark | C | The shaft's washes about 6 % lighter | Fixed (wall 2.6 → 2.1) |
| 2 | Windows too saturated | C | The warm room lights paler (`#ffc98a` `#ffbf78` `#ffd6a2` `#f6b070` `#ffcd96`) | The hue is closer but the value is now high (lit windows 2.9 → 3.2, `#dda876`); round 7 dims the room glow 0.85 → 0.78 and far windows 0.95 → 0.88 |
| 3 | Canyon haze | F | The silk band at +212 m 0.012 → 0.022; the one at +152 m back to 0.008 | Partly: the tower tops soften in FP 5 |
| 4 | Dead code | — | `weapon.ts` (the v1/v2 viewmodel, imported by nothing since the hero lab's merge) removed | Done |

ΔE per region (targets vs captures):

| Region | Round 5 | Round 6 | Round 7 |
|---|---|---|---|
| wall | 2.1 | 2.6 | **2.1** |
| wet ground | 2.6 | 2.2 | 2.2 |
| streaks (neon; not fitted) | 4.5 | 4.0 | 4.0 |
| stone (dome B) | 5.5 | 5.7 | 5.7 |
| silk sky | 1.7 | 1.9 | 1.7 |
| lit windows | 2.9 | 2.9 | 3.2 |
| cinnabar (dome B) | 0.8 | 0.8 | 0.8 |

## Rulers

- Draws 77–95 per frame (≤ 200); triangles 1.50–1.73 M (≤ 2.5 M), `../round-8-look-loop-7/stats.txt`.
- Frame time: not measured this round. The box's load average was 24–31 (other agents' builds and GPU jobs), and the
  spawn bench swung between 58 and 88 ms. The last quiet reading, round 4's build at 1.54 M triangles, was 4.5–4.9 ms
  at 804×1748 on the M5 Max.
- Gates: tsc clean on the clean room. The tree's current tsc errors are other agents' work in progress
  (`src/entities/pineCreatures.ts`, `src/main.ts`, `src/dev/nd-lab/viewmodel`). oxlint clean on `src/dev/nine-dragon`.
