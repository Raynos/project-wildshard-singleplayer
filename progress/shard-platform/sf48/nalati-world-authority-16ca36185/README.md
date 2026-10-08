# Nalati world authority before tiling — E435 / G227

Source pin: `16ca36185`. `inventory.json` was generated twice from a clean,
targeted git archive of that commit. Outputs are byte-identical. No runtime
scene, physics world, renderer or texture decoder was allocated.

Command, from the clean export: `node scripts/bake/nalati-world-inventory.mjs`.
Focused check: `pnpm exec vitest run test/nalati-world-inventory.test.ts` — 3/3.
Root strict typecheck, scoped lint and `node scripts/check-paths.mjs` pass.

The committed terrain authority is WSTR v1, native **256 × 256**, 500 m, seed
`0x4a1a`: 540,483 wire bytes; SHA256
`8e610bab24eeae2d8fbd710466c99fbaf9f7fdfe721adbbfb218b4f5550855fa`.
All 65,536 native Float32 heights remain untouched. All four 256-sample rows
equal `data/edges.ts` exactly. Each closed 8 × 15 m midpoint footprint is
covered by 54 native lattice corners at y=0; every intersecting bilinear cell
is flat, not merely a sparse set of test points. Native range is
−11.76138973236084 to 111.16221618652344 m.

The inventory hashes 96 source files, 72 model inputs (15,717,692 bytes) and
14 texture inputs (2,503,556 bytes). The model directory includes dynamic
creatures as well as static models; it is a source inventory, not the static
tile selection or an admitted resident-cost subtotal. Final tile costs require
emitted geometry, encoded textures and dependency-deduplicated accounting.

Source boundaries for conversion:

- Terrain mesh/slab: `look/terrainPainter.ts`, `terrainSurface.ts`, native bake
  and the existing painterly texture set. Preserve normals/colours and custom
  `surf`, `rdir`, `zone` attributes; normalized SF55a glTF currently lacks those
  attributes. Shader/contact-bake preservation is coordinated with Opus.
- Static buildings/POIs: `world/index.ts`, model definitions, `world/painted.ts`
  and `world/layout.ts`; outcrops/crags and deterministic dressing additionally
  enter through `runtime/state.ts`. Async generated-model completion must be
  awaited before geometry is inventoried or emitted.
- Animated/interactive balbals, cloth, smoke, water, grass/wind, ambient life,
  moving herds, weather, creatures, quests and combat retain their hybrid
  owner. Static extraction must retain stable anchors and collider ownership.

Next: consume sp-x5's shared native-lattice slicer for 64 × 62.5 m L0 and
16 × 125 m L1 tiles, with the independent native256 sim grid retained. No
analytic terrain rebake, collision resampling, content cut or live boot switch
is part of this receipt. Tile category budgets warn; the total envelope gates.
