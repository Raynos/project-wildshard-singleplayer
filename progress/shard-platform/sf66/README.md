# SF66 / E460 — the template's black held items, and the first baked maps

## E460: the template's sword and lantern rendered black (fixed in c8edefe20)

`e460-held-items-before-after.jpg`: Playwright WebKit as an iPhone 16 Pro, muted, the template from a clean build.
Left to right: before with the whip, before with the iron sword, after with the whip, after with the iron sword.

- Cause: this was not a WebKit shader failure. Chromium on ANGLE Metal draws the same black pixels. The template's
  declared kit items (whip, sword, lantern) are plain grey `MeshStandardMaterial`s. The template's neutral look has no
  environment and a dim sun, so the side of each item facing away from the light renders near black. Only the
  measure-layer surfaces, which add their own glow, read correctly.
- Fix: the item views now glow at half their declared colour (`ITEM_VIEW_LIFT`, `src/kit/items/declared.ts`).
- Gate: `scripts/webkit-render-smoke.mjs` takes about 5 s and runs as the `webkit-smoke` step of
  `scripts/vercel-tree-gate.sh`. It renders the held models alone over magenta and checks they are not black.
  - Before: whip mean luminance 34 with 73% near-black pixels; sword 44 with 72%.
  - After: whip 86 with 0%; sword 109 with 0%.
- Not changed:
  - The engine's gloved hands are still dim in the template, for the same reason. That is the engine look and is
    shared by every shard.
  - The lamp posts are the dev map's grey trim, seen on the side away from the light, as designed.

## SF66: maps baked from the world (G246 / G247)

`baked-maps-placeholder.jpg` shows every shard rendered straight down by `scripts/bake-maps.mjs`. The render is
orthographic over the full 500 m cell, 1000 px (0.5 m per px), with north (+Z) up as on the minimap. Sky, fog, the
player and held items are left out. The look is a neutral placeholder: Jake picks photo or stylized from the plan
agent's board.

- Images: `public/assets/<slug>/map/top.webp`, 5 to 120 KB each.
- Stamps: `src/shards/<slug>/look/map.baked.json` records the hash of the files that place the world: `shard.config.ts`,
  `layout.ts`, `world/`, `generators/`, `models/` and the shard's `look/map.json`.
- `look/map.json` is optional, per shard. Sky Reach uses it to hide its painted cloud sea and storm and to clip below
  y = -1.5.
- Gate: `test/baked-maps.test.ts` (Node only, inside vitest, so it runs in the push gate and in CI) fails when a
  stamp's hash no longer matches the shard's world.
- Rebake: `scripts/browser-lane.sh node scripts/bake-maps.mjs --url=<scripts/serve-build.sh --head>`. It bakes only
  the stale shards, or the ones named with `--shards=a,b`.

## SF66: the minimap and the MAP draw the baked images (33a6568ce)

Captured by `capture-draw.mjs` (Chromium as an iPhone 16 Pro portrait, muted, Developer on, build `33a6568ce`):
`<slug>-play.jpg` (the minimap) and `<slug>-map.jpg` (BAG > MAP) for Driftwood, Sky Reach and Signal Dunes;
`grid-inside-play.jpg`, `grid-road-play.jpg` and `grid-map.jpg` for INFINITE WILDSHARD. `capture-draw.json` has the
fetched map URLs (all 200) and the memory readouts.

- Each manifest names its image (`minimap.image`, held equal to its stamp by `test/map-coverage.test.ts`); the URL
  carries the build id, because `/assets` is cached as immutable for a year.
- Minimap: the image is decoded once into one ImageBitmap the first time the map draws, and closed when the minimap
  goes. It replaces the 1000 px painted canvas, which is now made only for a level with no baked map. Fog, animals,
  marks, labels and the arrow draw on top as before. The per-frame work is the same single `drawImage` of the ground.
- MAP: the same image, with no painted zoom tiles over it. Its default pins are the level's listed places.
- Grid: each other shard's map is downscaled once to 400 px (0.64 MB) and shared by its copies. These replace the
  far-proxy rasters, which were the same size. The full map lays out every cell's map at its cell, plus the road and
  each shard's name.
- Memory: the maps are 2D canvas or ImageBitmap, never GL textures, so the GL MB added is 0.
  - Driftwood centre: 4.0 MB for the bitmap, against the 4.0 MB painted canvas it replaces, so net 0.
  - Grid: 5 neighbour maps at 0.64 MB each, against the same number of 400 px rasters before, so net 0. Each load has a
    transient 4 MB decode.
  - The ledger's accounted total at the grid road pose is 155 MB, and the Developer chip read 534 / 1000 MB.
- Removed: `mapShapes.ts`, the per-shard `pieces` / `paths` / `ground` specs, the GLB-parsing grid rasterisers and
  their tests.
- The coverage test checks listed data only. Every listed place, entry, portal and quest marker must be on the baked
  map, named and listed once, and the MAP's pin source must carry every place. A dead entry fails (fixture).

Still to do:
- Nine Dragon renders as black blocks from above.
- A few cloud puffs remain over Sky Reach.
- The image is not yet inside the shardfile (that needs a format module for sp-x5).
