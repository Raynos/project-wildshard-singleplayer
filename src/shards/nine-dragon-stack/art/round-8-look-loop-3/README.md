# Round 8 · look loop 3 (E169, 2026-09-25): air, sky and the new budget

The third pass of the 9-angle loop (`docs/design/LOOK-LOOP.md`), **dome A**: anchor P = the spawn (1.45, +125, 5.05),
the same 9 cameras as rounds 1–2, `time(6.5)`, blue hour, no HUD. The targets are still round 1's (Jake's pick):
`../round-8-look-loop-1/target-1…9.jpg`.

- From this round there are two domes. Dome B (a second agent) loops on the square from in front of the gate and owns
  `square.ts`, `props.ts`, the gate / banyan / stall / plaza constants and its new files (`gate.ts`). Dome A (this
  loop) owns the rest of the clean room.
- The budget went up (Jake: 30 fps on the phone is fine, like Pine Hollow): ≤ 200 draws, ≤ 2.5 M triangles. This
  round spends some of it on detail.
- The captures are taken from a private export of the shared working tree. Dome B's work in progress on the gate and
  the balustrade (`gate.ts`, `square.ts`) was in the tree when round 4 was captured, so round 4's stone and cinnabar
  numbers move with dome B's changes, not with this round's.

| File | What |
|---|---|
| `capture-1…9.jpg`, `sheet-ingame-3x3.jpg` | this round's frames (after round 2's fixes) |
| `board.jpg` | **BEFORE** (this round) \| **AFTER** (round 4) \| **TARGET** (round 1), FP 1, FP 6, aerial 7 |
| `warm-vs-cool.jpg` | A blue hour \| B warm silk |
| `stats.txt` | draws and triangles per camera |

## Gap list (capture → round-1 target)

1. FP front: close in value now. The streaks are still warmer than the target's. The sky screen's painting is simpler
   than the target's detailed shanshui (P7's generated scroll will replace it).
2. FP left: the wall reads right. The balustrade is pale (dome B). The target has more red lanterns on the galleries.
3. FP right: a good match; the lit windows are a little too bright.
4. FP back: good; the far towers turn into flat painted shells too early.
5. FP up: the sky is a little greyer than the target's.
6. FP down: the shaft fog is right; the balustrade is pale (dome B).
7. Aerial square: a grey veil over the whole frame; the wet square reads as streak bars.
8. Aerial shaft: flat, little depth.
9. Aerial across: the same veil; fewer lanterns on the verandas than the target.

## TOP-10 and what happened (round 4's captures)

| # | Gap | Track | Fix | Status |
|---|---|---|---|---|
| 1 | Aerial veil | F | The base fog now depends on height, read at the ray's mid height: it thins above the square (× 0.35 at the aerials) and thickens down the Well (× 2.2). The base density goes 0.0065 → 0.0052; the band at +152 m, where the aerial camera sits, goes 0.01 → 0.005 | Partly: the veil lifts. Aerial 7 is still lighter and flatter than the target (mean 117 / sd 33 against 103 / 38) |
| 2 | Sky greyer than the target | C | Blue-hour sky `#7390b8` → horizon `#aec0d8` | Fixed (silk sky ΔE 4.4 → 1.8) |
| 3 | Lit windows too bright | C | Room glow 0.95 → 0.85, the lit room's warm tint 55 → 45 %, far windows' average × 1.05 → 0.95 | Better (3.5 → 3.0) |
| 4 | Streaks too warm | G | Lantern reflections 0.22 → 0.18, shopfronts 0.3 → 0.24, neon × 1.4 | Better (4.8 → 3.8) |
| 5 | Far towers flat too early | M | Spending the new budget: facade LOD 1 past 95 m (was 65), painted past 170 m (was 120). The Well's full detail reaches 75 m below the square (was 50) and its mid detail 165 m (was 125) | Fixed; 1.18 → 1.54 M triangles |
| 6 | Too little clutter on high and low floors | M | Small clutter reaches 60 m up the towers (was 40) and 45 m down the Well (was 30); sill plants 0.5 → 0.65 | Fixed |
| 7 | Few lanterns on the verandas | M | Veranda lanterns 0.25 + 0.45 · timber → 0.4 + 0.5 · timber (the Well: 59 → 78 % of bays) | Fixed |
| 8 | Balustrade pale, cinnabar bright | M / C | Dome B's (square.ts, gate.ts); flagged in round 2's README | Dome B darkened the balustrade (now darker than the target: stone ΔE 11.2); cinnabar 0.7 |
| 9 | The wet square as bars from above | G | P6 (light pools) is due; not touched | Open |
| 10 | The sky screen's painting | L | P7's generated shanshui scroll is due | Open |

The ΔE per region (targets vs captures, `palette-delta.py --regions ../round-8-look-loop-1/palette-regions.json`):

| Region | Round 2 | Round 3 | Round 4 |
|---|---|---|---|
| wall | 1.6 | 1.3 | 2.3 (darker: less fog) |
| wet ground | 3.0 | 2.6 | 3.9 (darker: less fog) |
| streaks (neon; not fitted) | 7.4 | 4.8 | 3.8 |
| stone (dome B's balustrade) | 2.3 | 1.8 | 11.2 |
| silk sky | 8.5 | 4.4 | **1.8** |
| lit windows | 2.4 | 3.5 | 3.0 |
| cinnabar (dome B's gate) | 6.8 | 3.9 | 0.7 |

Rounds 4's first fixes answer the two regressions: the wet flagstones are 55 → 45 % darker where wet, and the facade
wash `#d4d8e6` → `#dadeeb`.

## Rulers

- Draws 75–96 per frame (≤ 200); triangles 1.31–1.54 M (≤ 2.5 M), `../round-8-look-loop-4/stats.txt`.
- Frame time at iPhone DPR 2 (804×1748) on the M5 Max, measured with the GPU quiet, best of 3 × 60 frames:
  - the spawn 4.5–4.9 ms;
  - the Well views 2.6–3.3 ms;
  - the canyon up 3.3–3.4 ms.
  - The spawn at DPR 1 takes 2.85 ms, so the frame is fill-bound.
- Round 2's 23–26 ms was measured under contention: a TRELLIS batch and other agents' browsers were on the GPU.
- Gates: `tsc --noEmit` clean, oxlint clean on `src/dev/nine-dragon` and the capture script, `check-css` ok, and
  `vite build` of the export succeeds.
