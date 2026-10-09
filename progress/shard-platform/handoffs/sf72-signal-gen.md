# Handoff: sf72-signal-gen (SF72, Signal Dunes' code-built world → offline bake), 2026-10-09

Status: unfinished (the 90-minute lane ended). Nothing landed in the game; the first slice is an **unlanded candidate at
`refs/wip/sf72-signal-gen`** (`ef5a05797`, parent `cd97d8c40`). Inventory and move list:
`progress/shard-platform/m3-status/signal-8020.md`.

## The slice in the candidate (rocks + dead buttes)

- `generators/rocks.ts`: `world/rocks.ts` moved to build time, unchanged shapes; `bakeSignalRocks()` bakes the ridges
  (30 instances, one `EXT_mesh_gpu_instancing` node, one draw) with `@wildshard/sdk/bake/glb` on the manifest's own
  field (`signalDunesField()`, now exported by `generators/tiles.ts`; tiles bytes unchanged). The empty boulder
  InstancedMesh (`SCATTER.boulders = 0`) is not baked.
- `scripts/bake-signal-world.mjs` (`node --import ./scripts/bake-loader.mjs …`; the sim loader refuses the renderer
  deps) writes `public/assets/sunscar-dunes/baked/rocks.glb` (11,552 B) and `data/rocks.json` (content hash, kinds with
  colour / roughness, the 30 box colliders exactly as `boxDesc` made them, same key order).
- `world/baked.ts` (client): `loadBakedWorld()` beside `preloadDuneMeshes()` in the plugin's `world` hook; `bakedRocks()`
  makes the InstancedMesh with the runtime's own material and registers the baked colliders. Colliders never wait on
  the GLB (the Node contract test, which refuses fetch, still registers `sunscar.rocks`).
- `world/buttes.ts` deleted: dead since E399 (`void buildButtes`, no caller, no Debug row).
- `test/shards/sunscar-dunes/world-bake.test.ts`: byte-exact stale gate; the GLB's TRS round trip is within 1e-5 of the
  builder's matrices (float32 noise; pixel parity not yet measured).
- `scripts/signal-physics-inputs.mjs` walks `generators/` too (the colliders now come from there).
- The URL is a literal in `boot/files.ts` (`BAKED_ROCKS_URL`): a template URL trips `shard-sandbox`, and importing
  `world/baked.ts` from `boot/files.ts` pushed the manifest closure 33 → 41 (AG10).

Share with the candidate (`node scripts/shard-platform.mjs --json`): public 185 → 247 / custom 4139 → 3989
(4.3 % → 5.8 %); runtime + trusted 854 → 855 / 965.

## Blocker found (must be solved before it lands)

The candidate build refuses Signal's boot: **"Runtime cache coverage exceeds its measured bytes"**
(`src/game/grid/allocator.ts` `validateCoverage`, via `reserveClaim` → `reservePageComponent` at the `finish` stage).
The new `loadRigFile` GLB is a page component covered by the measured whole-page claim (`SIGNAL_DUNES_RUNTIME_COST`),
and the covered components already sit at that bound. Next: read `coverRuntimeAssets` / `reservePageComponent` to see
what the GLB is charged as. Either load it outside the cached-asset path (it is tiny, and the scene owns the geometry),
or re-measure the runtime cost (a Simulator + GL census, `progress/memory/…`), which the brief's memory check wants anyway.

## Clean-export suite on the candidate (before the blocker fix)

Green except the expected ones: `physics-bake.test.ts` (rebake natively: `scripts/bake-signal-physics.mjs --url=<candidate>`),
`baked-maps` (rebake: `scripts/bake-maps.mjs --shards=sunscar-dunes`), and AG7 **`shards/sunscar-dunes → sdk 12 → 13`**
(the generator's `@wildshard/sdk/bake/glb` import, which the brief names as the pattern; it needs the coordinator's
approval). The engine edge went back to 126 by reusing `signalDunesField`. Not yet run: parity poses, physics walk
(0 stuck), boot smoke, memory / cold load before and after, frame floor, the facade test.

## After the blocker, in order

1. Land rocks with the native physics rebake and the map rebake in the same commit.
2. `dressing.ts` (static scatter part; its `tick` stays), `tower.ts`, `places.ts` (caravan / well / brazier: animated
   sub-parts as named GLB nodes; `models/gear.ts` builds them for the Model Explorer, so it moves to the bake too).
3. The `species/` rigs → baked GLBs; the look tables (`minimap`, `far`, `dusk`, `families`) → `data/` rows.
