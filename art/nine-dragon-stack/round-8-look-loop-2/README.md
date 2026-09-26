# Round 8 · look loop 2 (E169, 2026-09-25): chasing the round-1 targets at blue hour

The second pass of the 9-angle loop (`docs/design/LOOK-LOOP.md`) on the clean room `dev/nine-dragon.html`, anchor
**P = the spawn** (1.45, +125, 5.05), animation frozen at `time(6.5)`, blue hour, no HUD. The loop cameras are the same
as round 1's, so every round stays comparable.

- **Targets: round 1's, kept as they are** (Jake, 2026-09-25: "chase THESE round-1 targets": deep blue hour, rain,
  grime, warm-lit windows, rich ink detail; not paler silk, not darker). No new codex edits this round:
  `../round-8-look-loop-1/target-1…9.jpg`, sheet `../round-8-look-loop-1/sheet-target-3x3.jpg`.
- Blue hour is the default look; warm silk stays a switch (`__nd.style('silk')`, key `3`): `warm-vs-cool.jpg`.
- Capture: `node scripts/nine-dragon-capture.mjs --url=<private clean export> --round=2 --only=loop,warmcool,cards,teasers`.
  The board: `--round=2 --only=sheets --targets=art/nine-dragon-stack/round-8-look-loop-1 --after=art/nine-dragon-stack/round-8-look-loop-3`.

| File | What |
|---|---|
| `capture-1…9.jpg` | this round's frames (after round 1's fixes): FP 1–6 portrait 804×1748, aerials 7–9 1600×900 |
| `sheet-ingame-3x3.jpg` | the 9 captures, same cell order as the target sheet |
| `board.jpg` | **BEFORE** (this round) \| **AFTER** (round 3's captures, after this round's fixes) \| **TARGET** (round 1), FP 1, FP 6, aerial 7 |
| `warm-vs-cool.jpg` | spawn and well-edge, A blue hour \| B warm silk |
| `stats.txt` | draw calls and triangles per camera |

## Gap list (capture → round-1 target)

1. FP front: grey and flat; the sky screen pale and blocky; streaks orange-red; the paifang's cinnabar too bright. From
   Jake's progress review: the spawn's weapon drifted (the dragon guard fills the lower right, the blade barely reads).
2. FP left: the Well's far wall light grey against the target's dark blue concrete with amber rooms; the balustrade
   pale and pinkish (neon spill from the sign masts bleaching the stone); few red lanterns on the galleries.
3. FP right: tower walls flat grey, too few warm windows, no rain grime.
4. FP back: the stair street reads; walls clean (no rain runs, no soot).
5. FP up: the sky screen pale; the sky grey where the target is a deeper blue.
6. FP down: the shaft clear where the target fills with silk fog; the balustrade pale.
7. Aerial square: a grey haze over everything; the wet square reads as streak bars; no lamp-lit depth.
8. Aerial shaft: flat grey walls, no atmosphere.
9. Aerial across: pale; the target is darker blue with warm lamps.

## TOP-10 and what happened

| # | Gap | Track | Fix | Status (round 3's captures) |
|---|---|---|---|---|
| 1 | The spawn's weapon and camera drifted from round-6 `style-A-jiehua-neon.jpg` | V / comp | `spawn` camera by the balustrade (0.95, +125, 7.5) yaw 12° pitch −4°, the paifang ~1/3 of the width left of centre, tables and noodle stall mid-right; a `spawn-card` shot for the 2:3 card (hfov 68°); viewmodel layout: the guard low-right (NDC 0.52, −0.4) at 1.05 m, the tip at the centre, the Fei Zhua smaller and lower-left (wrist −0.7, −0.56 at 1.35 m); blade half widths 21/16 → 24/19 mm, the glowing edge band 10 → 20 % of the half width; TRELLIS guard 0.135 → 0.115 m. Two mahjong tables moved nearer (square.ts, before it passed to dome B) | Fixed: the long jian diagonal with the bright cyan edge reads again |
| 2 | Warm windows: too few, some cold | C | lit share 0.6 / 0.62 → 0.72; cool rooms 14 → 7 %; a lit room's walls read warm whatever their paint; window glow 0.72 → 0.95; far windows' average brighter; painted far facades 30 → 45 % lit | Fixed (a little too bright now: lit windows ΔE 2.4 → 3.5, toned down for round 3) |
| 3 | Sky and fog too grey | C / F | blue-hour sky `#6781a8` → horizon `#a4b6cf`, base fog `#97a7c0`, shade `#939bae` (more contrast between lit and shaded faces) | Better (silk sky ΔE 8.5 → 4.4) |
| 4 | Streaks orange | G | shopfront reflections 0.55 → 0.3 and paler `#ffc48a`; lanterns 0.32 → 0.22; neon signs × 1.25 | Better (streaks ΔE 7.4 → 4.8) |
| 5 | Well walls light grey | C | the shaft's walls get their own darker, bluer concrete washes (`well.ts` SHAFT) | Fixed (FP 2 reads like the target's wall) |
| 6 | No grime | M | wall cells: rain streaks 10 → 20 %, rain-run striations under every slab (28 %), soot / splash at each floor's foot (16 %) | Partly (P5's painted textures will carry the rest) |
| 7 | Shaft too clear | F | the Well's silk bands denser: +101 m 0.07 → 0.1, +36 m 0.08 → 0.1, bluer band colours | Partly |
| 8 | Sky screens pale | L | the 青绿 painting more saturated (azurite / malachite), less mist, dot pitch 0.2 → 0.14 m, fog on it 0.22 → 0.12 | Better (P7's shanshui scroll will replace the procedural painting) |
| 9 | Balustrade pale and pink | M | wet stone (`wet` on K.stone) darker, tops most, with a sky sheen; baked neon spill capped at 0.7 and halved on wet stone | Partly: the rail and posts darker; the carved panels have no `wet` (square.ts, dome B) |
| 10 | Aerial grey haze | F | (round 3) | Open |

The ΔE per region (`palette-delta.py --regions ../round-8-look-loop-1/palette-regions.json`, targets vs captures):

| Region | Round 1 | Round 2 | Round 3 |
|---|---|---|---|
| wall | 6.3 | 1.6 | **1.3** |
| wet ground | 3.4 | 3.0 | 2.6 |
| streaks (neon; not fitted) | 6.0 | 7.4 | 4.8 |
| stone | 12.3 | 2.3 | 1.8 |
| silk sky | 3.7 | 8.5 | 4.4 |
| lit windows | 2.1 | 2.4 | 3.5 |
| cinnabar | 7.5 | 6.8 | 3.9 |

## For dome B (square.ts, the paifang, the balustrade)

- The balustrade reads about twice as light as the targets (`#757784` against `#31353e`–`#394154` in FP 2 / FP 6). The
  wet shading in `style.ts` darkens every face whose look has `wet` (tops × 0.55, sides × 0.7, linear) and caps the
  neon spill; the carved panels (`K.panel`, `#6f6f74`) have no `wet`, and the stone wash `#76767b` could go darker.
- The paifang's cinnabar is still brighter than the target (`#bd5147` against `#af493f`).

## Rulers

- Draws 75–96 per frame, 1.02–1.18 M triangles (`../round-8-look-loop-3/stats.txt`); the new budget is ≤ 200 draws,
  ≤ 2.5 M triangles.
- Frame time, the spawn at 804×1748 (iPhone DPR 2), M5 Max: 22.9–25.7 ms; the Well views 14.7–18.2 ms. These were
  measured while a TRELLIS batch and other agents' headless browsers were on the GPU, and repeats swung by 2×, so they
  are an upper bound. The full frame is fill-bound (DPR 1: 4.8 ms).
