# Round 2: the real roundabout from the sky

G332: fifteen in-engine candidates, including Jake's E2 corner, M midpoint
and T centre requests. The shipped main-menu image is unchanged.

[Portrait contact sheet](board.jpg). Recommended candidate: **M-b**,
which balances the real roundabout with the four surrounding cell corners.
All fifteen full-size images and the sheet have been visually inspected. Every full-size JPEG is 1179×2556
and at most 500 KB, with a burned-in title, candidate, camera height and
actual downward angle. All shots are muted iPhone 16 Pro, Developer on,
phone tier, 2×, real live engine, canvas only, no HUD or weapon viewmodel.

The camera uses the existing freeCamera gate and a detached late-phase
pose. The player stays on the roundabout; scene objects, lens, quality,
materials and colour grade are untouched. Actual camera and viewmodel
state are recorded in capture.json. No paint-over or recomposition.

The target is roadLayout's real cross.0.0, roundabout:true at (277.5, 277.5).
Its surrounding cells are Driftwood, Pine, Nalati and template-2. In this
road view the game displays its actual streamed content/far proxies, not
four specially loaded or repositioned worlds.

E2 is above the template's nearest corner (305, 305); M above (430, 430); T above
its centre (555, 555). Those cameras keep aiming at the real roundabout with
small three-degree sweeps. Their recorded downward angles are shallower
where the requested camera home requires it; there is no misleading
45–70° label on the M/T views.

The existing Debug time presets are requested, but the shipping neutral
road has G242's fixed low-dawn ROAD_SKY. The sheet says dawn because those
presets do not change the road key light. No look change was made to
manufacture sunset variants.

Reproduce from the repository root outside a foreign quiet window:

```sh
node scripts/capture-main-menu-hero.mjs --round=aerial \
  --out=/absolute/scratch/captures
uv run --with pillow python scripts/main-menu-hero-board.py \
  /absolute/scratch/captures art/main-menu-hero/round-2-aerial
```

The command owns one clean serve-build --head preview and a single muted
browser-lane browser, and closes both. No Simulator is used.

Capture pin: `5f2d57a76`, build `5f2d57a-mv4kiryn`. Actual
capture window: 2026-10-12T01:22:32.839642+00:00 to 2026-10-12T01:25:24.985423+00:00.
All fifteen shots completed; camera position tolerance <= 0.01 m.
No reported page errors or console errors; all viewmodels witnessed hidden.
The capture browser and preview closed before the explicit release.

| Candidate | Full-size image | Height | Downward angle |
| --- | --- | ---: | ---: |
| A | [Free aerial](A-grid.jpg) | 30 m | 45.0° |
| B | [Free aerial](B-grid.jpg) | 60 m | 55.0° |
| C | [Free aerial](C-grid.jpg) | 90 m | 60.0° |
| D | [Free aerial](D-grid.jpg) | 120 m | 65.0° |
| E | [Free aerial](E-grid.jpg) | 150 m | 70.0° |
| F | [Free aerial](F-grid.jpg) | 100 m | 50.0° |
| E2-a | [Template corner](E2-a-grid.jpg) | 45 m | 49.2° |
| E2-b | [Template corner](E2-b-grid.jpg) | 75 m | 62.6° |
| E2-c | [Template corner](E2-c-grid.jpg) | 100 m | 68.7° |
| M-a | [Corner-centre midpoint](M-a-grid.jpg) | 70 m | 18.0° |
| M-b | [Corner-centre midpoint](M-b-grid.jpg) | 110 m | 27.0° |
| M-c | [Corner-centre midpoint](M-c-grid.jpg) | 150 m | 34.8° |
| T-a | [Template centre](T-a-grid.jpg) | 80 m | 11.5° |
| T-b | [Template centre](T-b-grid.jpg) | 115 m | 16.3° |
| T-c | [Template centre](T-c-grid.jpg) | 150 m | 20.9° |
