# Round 3: the roundabout from M-b, desktop landscape

G336 (Jake on round 2's M-b: *"m-b is a good position, but i realize we need to capture this on desktop landscape mode
because you just see almost nothing of the left & right shard"*). Five real-engine views around M-b's spot, each aimed
exactly at the roundabout cross.0.0 (277.5, 0, 277.5), so it sits at the centre of the frame. All five were captured at
2560×1440 and at 1920×1080.

[Board](board.jpg) · [the pick on the real menu, desktop and iPhone](menu-board.jpg)

**Recommended: L-b** (M-b's spot raised to 135 m, tilted 32° down). It reads all four surrounding shards:

- Pine Hollow fills the left and Nalati the right, each as large as M-b's corners, with the roundabout dead centre.
- Driftwood's island sits whole at the far apex and the template-2 plaza at the near one.
- It has the least empty sky of the five.

The other views:

- **L-a** (M-b exactly, 110 m, 27°): the same composition with a band more sky and the near plaza cut off.
- **L-c and L-d** (swung 20° toward Pine or Nalati): they make one side shard huge and push the other to a corner.
- **L-e** (straight down the road, a clean 2×2): it reads as a map rather than a hero, and Pine's dark proxy fills a
  quarter of the frame.

Every full-size JPEG carries a burned-in band with:

- the id and name;
- the resolution, a "real engine, canvas only" note and the build;
- the height, the down angle and the heading;
- where each cell falls, left to right.

All of them are ≤ 500 KB. The capture facts:

- Desktop Chrome at DSF 1, settings tier `desktop`, gfx dpr `native`, Developer on, muted.
- The live clock, the existing freeCamera gate and a detached late-phase camera, as in round 2.
- No HUD and no weapon viewmodel.
- The camera position matched the request to within 0.01 m. No page errors and no console errors.
- Build `6d20db0-mv5p9v4i`: HEAD 1706d021f failed to build at the time, which d5b11793f fixed later, and nothing
  hero-relevant changed between the two. Everything is recorded in [capture.json](capture.json).

The surrounding shards show the road view's real streamed far proxies, not specially loaded worlds. The road keeps its
fixed G242 dawn sky.

The menu sheet shoots the real menu of the same local build: 1920×1080 desktop and iPhone 16 Pro portrait, with
Developer off. L-b is answered for the hero image request, and nothing else changes.

## Reproduce

Run from the repository root, outside a foreign quiet window:

```sh
s=/private/tmp/<lane>; scripts/serve-build.sh --head --name hero   # prints <base>
HERO_CAPTURE_LANE=1 scripts/browser-lane.sh node scripts/capture-main-menu-hero.mjs --worker \
  --round=landscape --base=<base> --out=$s/cap
scripts/browser-lane.sh node art/main-menu-hero/round-3-landscape/menu-board.mjs <base> $s/menu $s/L-b-2560.jpg
uv run --with pillow python scripts/main-menu-hero-board.py $s/cap art/main-menu-hero/round-3-landscape \
  --menu=$s/menu/menu-desktop.png --phone=$s/menu/menu-phone.png --pick=L-b --why='…'
```

`node scripts/capture-main-menu-hero.mjs --round=landscape --out=…` without `--worker` owns its own preview and lane.

## Layout B (G338)

Jake's follow-up was: *"the hero image can be the top half of the screen"*, then *"Not the top half more like in the
center"*. The `layout/` folder holds the raw A / B screens of the main-menu layout row (pause ▸ Settings ▸ Debug ▸ Main
menu layout, default A). Only layout B loads L-b (1920×1080, `public/assets/title/main-crossroads-landscape.jpg`); layout
A keeps the shipped painted hero until Jake picks a layout. The screens, unlabelled for the plan desk's board, are on
iPhone 16 Pro portrait with Developer off and on, plus desktop 1920×1080 with Developer on:

- `A-painted-*`: layout A as shipped.
- `A-Lb-*`: layout A with L-b answered for its hero image request.
- `B-Lb-*`: layout B.

`layout/capture-layouts.mjs` reproduces them on a local build.
