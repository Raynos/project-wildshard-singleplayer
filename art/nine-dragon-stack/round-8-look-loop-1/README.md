# Round 8 · look loop 1 (E169, 2026-09-25): the clean room after the four labs merged

The 9-angle look loop (`docs/design/LOOK-LOOP.md`) on the clean room `dev/nine-dragon.html`, anchor **P = the spawn**
(1.45, +125, 5.05; between two balustrade posts), animation frozen at `time(6.5)`, blue hour, no HUD.

- Before this round the four look labs were merged into `src/dev/nine-dragon/` (copied, not imported):
  - **neon** (round-7-lab-neon): SDF brush-fill neon calligraphy (`glyphs.ts`, `neonsigns.ts`), optics-placed wet-ground
    streak cards (`streaks.ts`, replacing the quarter-res mirror pass), the 晕染 bleed bloom + screen-space drizzle
    (`post.ts`), ribbed paper lanterns (`lanterns.ts`), baked neon spill (`emitters.ts`);
  - **ink** (round-7-lab-ink): the architecture program (`style.ts`): box-filtered ruled borders at a fixed px width,
    rulings that fade to their average, one fade per job, a painted wash with a world-anchored fractal silk weave, the
    banded fog with billows; the silhouette from inverse depth in the colour target's alpha; blue-hour / raw-silk presets;
  - **facade** (round-7-lab-facade): the Kowloon grammar (`facade/`): every tower wall and the Well dressed by
    `dressWall` into one batch (28 piece types + interior-mapped windows + one shell);
  - **hero** (round-7-lab-hero): the viewmodel (`hero/viewmodel.ts`, the TRELLIS dragon-head guard), the paifang, the
    banyan, the mahjong tables, the TRELLIS crowd (`/assets/nine-dragon/lab/*.glb`).
- Capture: `node scripts/nine-dragon-capture.mjs --url=<private clean export> --round=1 --only=loop,warmcool`.
- Targets: codex `image_gen` EDITS of each capture (`scratchpad mkjobs.py` → `scripts/horizon-matte/run_codex.py`),
  style paragraph first, the capture + round-4 `A-jiehua-spawn.jpg` as the only style anchor, "keep every structure".
  All 9 kept the geometry; none re-rolled. **Jake (2026-09-25): the loop chases these targets as they are.**

| File | What |
|---|---|
| `capture-1…9.jpg` | FP 1–6 portrait 402×874 @2 (804×1748), aerials 7–9 1600×900 |
| `target-1…9.jpg` | the codex edits (the look target of every later round) |
| `sheet-ingame-3x3.jpg`, `sheet-target-3x3.jpg` | 3×3 sheets, same cell order: FP front / left / right · back / up / down · aerial square / shaft / across |
| `board.jpg` | **BEFORE** (this round) \| **AFTER** (round 2's captures) \| **TARGET**, FP 1, FP 6, aerial 7 |
| `warm-vs-cool.jpg` | the spawn and the well-edge, **A blue hour** \| **B warm silk** (Jake picked A as the default; B stays a switch: `__nd.style('silk')`, key `3`) |
| `palette-regions.json` | the ΔE00 regions + filters for these cameras (`palette-delta.py --regions`) |
| `stats.txt` | draw calls and triangles per frame |

## Gap list (capture → target)

1. FP front: the whole frame too pale and grey (C); the sky screen a flat grid with blocky pixels (L); streaks too wide,
   blocky and red-dominated, no stone visible between them (G); the balustrade pale beige, clean (M); blade edge unlit (V).
2. FP left: the Well wall reads right, but pale; target rooms warmer and brighter, more plants; the balustrade flat white.
3. FP right: towers grey, flat; streaks too saturated; lit windows too few.
4. FP back: the stair street's near walls are **painted grid faces** (a bug: undressed tower sides z-fighting the stair
   walls); target has dressed walls with plants, lit rooms, signs.
5. FP up: sky screen pixel grid vs a detailed shanshui; tone.
6. FP down: the balustrade cap bright and clean vs wet dark stone; the shaft haze too thin.
7. Aerial square: a flat grey mass vs lamp-lit depth, the wet square reads as noise.
8. Aerial shaft: walls flat grey; target warm-lit verandas and atmospheric depth.
9. Aerial across: pale; target darker blue hour with warm lamps.

## TOP-10 (ranked by area × frames) and what happened

| # | Gap | Track | Fix | Status |
|---|---|---|---|---|
| 1 | Overall value: washes too pale, warm-beige | C | blue-hour preset darkened (fog `#9aa6ba`, wash tint 0.9/0.93/1.0, shade `#a4abbb`), the facade shell's wash × `#d4d8e6` | Fixed (wall ΔE 6.3 → 1.6) |
| 2 | Streaks too wide, too red, blocky | G | card width 0.6 → 0.4, gain 1.5 → 1.15, dashes/jog up, lantern streak power 0.55 → 0.32 | Partly (streaks ΔE 6.0 → 7.4: still too orange) |
| 3 | Sky screen: grid, not a painting | L | LED pitch 0.42 → 0.2 m; five-layer 青绿 ridges with ink crests, mist feet, trees | Partly (reads as mountains; still paler than the target) |
| 4 | Painted grid faces in the stair street | M (bug) | the east towers' side faces flank the stair's first 12 m (dressed, `faces` 4/8), the stair walls start behind them | Fixed |
| 5 | Balustrade / paifang stone pale and clean | M | stone `#76767b` + wet 0.5, panels `#6f6f74`, paifang stone darker | Fixed (stone ΔE 12.3 → 2.3) |
| 6 | Too few warm lit rooms | C | facade lit share 0.5 → 0.6 (street), 0.55 → 0.62 (Well) | Partly |
| 7 | The blade's cyan edge invisible | V | edge band 0.07 → 0.1 of the half width, emit 2.3 → 4.2 | Fixed |
| 8 | Too few plants | M | sill plants 0.3 → 0.5 | Partly |
| 9 | Distance / Well haze too thin | F | base fog 0.005 → 0.0065 | Partly |
| 10 | Lines heavy and uniform | L | ruling 2.4 → 2.1 px at 3× | Fixed |

Also: paifang cinnabar `#b23020` → `#9c3627` (cinnabar ΔE 7.5 → 6.8, still too bright).

## ΔE00 per region (targets vs captures; `palette-delta.py --regions palette-regions.json`)

| Region | Round 1 | After (round 2 captures) |
|---|---|---|
| wall | 6.3 | **1.6** |
| wet ground | 3.4 | 3.0 |
| streaks (neon; not fitted) | 6.0 | 7.4 |
| stone | 12.3 | **2.3** |
| silk sky | 3.7 | 8.5 |
| lit windows | 2.1 | 2.4 |
| cinnabar | 7.5 | 6.8 |

## Rulers

- Draws 75–96 per frame (≤ 250). Triangles 1.30–1.46 M → 0.99–1.15 M after this round: facade LOD tightened
  (lod 1 past 65 m, painted past 120 m; the Well's lower bands lod 1 below +75 m, painted below 0 m), lanterns 700 → ~300 tris.
- Frame time: see round 2's README (measured on the round-2 build).
