# Round 15 · the eight domes (E169, 2026-09-26)

Jake (2026-09-26): *"only the first mockup is good; the other three views are pretty terrible — lacking an incredibly
large amount of detail in the world modeling and in the models placed inside the world … I feel like you need TWO DOMES
FOR EACH MOCKUP … so I need to see EIGHT domes, the nine shots for those eight domes, eight pictures, a 3×3 each that I
can view on my phone … then build those eight domes in engine."*

For each of the four round-6 mockups (`round-6-baseline-hud/`: A `style-A-jiehua-neon`, B `comp-B-well-edge`,
C `comp-C-stair-street`, D `comp-D-well-down`), there are two domes:

- a **stand** dome where the mockup's camera stands (view 5 = the mockup's own camera);
- a **look** dome at the point the mockup looks at (view 5 = facing further on, view 7 = back toward the mockup's camera).

| Dome | Mockup | Anchor (ground, layout.ts) | What it is |
|---|---|---|---|
| `A1-spawn-stand` | A | (0.95, +125, 7.5) | the spawn by the balustrade, looking north at the paifang + banyan (shots.ts `spawn`) |
| `A2-gate-look` | A | (6.05, +125, −20) | 4.5 m in front of the paifang's centre bay |
| `B1-well-edge-stand` | B | (−10.5, +125.4, 11.75) | at the Well's south-rim balustrade looking north along the shaft (shots.ts `well-edge`) |
| `B2-well-edge-look` | B | (−14, +118, −22) | mid-shaft on a (future) timber bridge 7 m below the rim, 34 m north |
| `C1-stair-stand` | C | (18, +125, 6) | Lantern Square at the stair-street's foot, looking east up it (shots.ts `stair-street`) |
| `C2-stair-look` | C | (37.3, +132, 6) | landing 1, the paifang 17 m further up flight 2 |
| `D1-well-down-stand` | D | (−10.5, +125.75, 10.55) | leaning over the rim balustrade looking down the shaft (shots.ts `well-down`) |
| `D2-well-down-look` | D | (−14, +96, −6) | ~30 m down the shaft on a lower timber bridge |

## How the targets were made (the method Jake asked for)

Codex imagines the nine angles of the mockup's own world. It does not enhance engine captures (that was v1, see below).

1. **Cameras first**: `<dome>/cameras.json`, nine poses in world coordinates, 2:3 portrait frames. Grid order:
   1 up · 2 aerial · 3 aerial / 4 left · 5 centre · 6 right / 7 back · 8 down · 9 aerial.
2. **A floor plan** per dome (`floorplan.jpg`): the plan and a section, drawn with PIL from `layout.ts`, `well.ts` and
   `stairstreet.ts`, with the nine cameras as numbered dots, arrows and FOV wedges. It is spatial grounding only.
3. **One codex `image_gen` per dome**, inputs [mockup, floor plan], producing ONE image: a 3×3 grid of the nine views.
   The Jiehua Neon style paragraph comes first, then the mockup's features, then each tile in words.
   - Two candidates per dome; the one whose tiles face the way the cameras say was kept (`grid-raw.jpg`, the other
     `grid-raw-alt.jpg`).
   - Kept: A1 a, A2 a, B1 b, B2 b, C1 a, C2 b, D1 b, D2 a.
   - Why the rejects lost: in the alt grids, "look up" often stayed level (B1 a, B2 a, D1 a), a "back" aerial faced the
     wrong way (C1 b tile 3 looked up the stairs instead of back down), and A1 b's "turn left" re-showed the mockup view.
4. **Upscale**: the grid is cut at its gutters (`tile-N.jpg`). Each tile gets one codex EDIT, inputs [tile, mockup]
   ("keep the composition, camera and every structure; add detail at the mockup's density") → `target-N.jpg`,
   1024×1536. One of the 72 upscales was re-rolled: A2 7, where the grid had invented a second paifang at the
   square's south end.
5. **Sheets**: `<dome>/sheet-target-3x3.jpg` (labelled "<dome> · n · view"), `overview-upscaled.jpg` (all eight target
   sheets) and `grids-overview.jpg` (all eight raw grids).

Scripts (session scratchpad `eight/`):

| Script | What it does |
|---|---|
| `domes.py` | the cameras and the per-tile descriptions |
| `plan.py` | the floor plans and `cameras.json` |
| `mkgrid.py` | the grid jobs |
| `mkup.py` | the upscale jobs |
| `sheets.py` | crop, sheets, overview |
| `readme.py` | the per-dome READMEs |

Runner: `scripts/horizon-matte/run_codex.py`. Timing:

- the 16 grids took 160–210 s each, run in parallel;
- the 72 upscales took 90–190 s each, run 18 at a time.

## The engine, from the same cameras (not shot yet)

- `eight/cams2views.py <dome>` → `views-<dome>.json`.
- Then `lockf -k <scratchpad>/browser.lock node eight/cap8.mjs views-<dome>.json <out> --url=<private snapshot server>`.
- It uses a free camera posed from a late hook, hides the HUD and the viewmodel, and renders 2:3 frames at 512×768 @2
  (= 1024×1536).
- The captures go in `<dome>/capture-N.jpg` + `sheet-capture-3x3.jpg`, and they are measured against the targets.
- Caveat: B2 stands on a bridge that doesn't exist yet (the engine's nearest crossings are at −12 and −18).

## v1 (kept)

- `A1-spawn-stand/` and `A2-gate-look/` hold `sheet-target-3x3-v1.jpg`, `sheet-capture-3x3-v1.jpg` and
  `cameras-v1.json`.
- These are the earlier method: codex edits of the clean-room captures in `round-8-look-loop-1/` and
  `round-10-dome-b-1/`, relaid into this grid order.
