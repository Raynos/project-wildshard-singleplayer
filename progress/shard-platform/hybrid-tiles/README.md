# M3 hybrid tiles, slice 1: runtime-bound world sections and Signal Dunes' compiled terrain tiles (G227, E435)

G227 (Jake, 2026-10-07): *"the shardfile is the bake."* A hybrid shard's world half goes into the shardfile's 62.5 m tiles first.
sf50-close named three blockers. This slice lands the first two and leaves the third for the runtime adoption.

## Landed

1. **Runtime-bound world sections** (`src/game/shardfile/runtimeBinds.ts`, `hybridRows.ts`, new `runtimeWorld.ts`).
   `runtime.binds` takes `terrain` and `props`. When a section is bound:
   - `withoutRuntimeRows` hands the data client no `terrain` / `props`, and none of the files only they reference
     (`runtimeBoundWorldFiles`: the collider, the terrain / props tile files, library models, panels, far proxy, textures),
     dropped from `files` / `critical` / `library` / `tiles` / `far` too. So a hybrid whose world is bound stays an empty data
     declaration (`emptyHybridData`), and the data client builds no second world. A file that another, unbound declaration
     still names stays with the data client. Admission still fetches and verifies every file with the product.
   - `bindRuntimeTerrain(ctx, source, { assets, terrain, x, z, residency? })` is the runtime's binder: it streams the
     admitted tiles through the shardfile's own residency (`clientWorld`: 16 coarse tiles resident, fine tiles inside the
     150 m disc, each leased and freed with its scope), drawn by the runtime's `terrain` view in its own material. Its
     `ground` queries come from the admitted 257² collider (`clientGround`). It refuses a source that does not bind `terrain`.
   - Format: the additions live in `runtimeBinds.ts` (the list) and `runtimeWorld.ts`; `schema.ts` is untouched
     (`RuntimeBindsSchema` already validates against the list).
2. **The compile step** (`src/shards/sunscar-dunes/generators/tiles.ts`, `scripts/bake-hybrid-tiles.mjs`).
   Signal Dunes' heightfield is the manifest's own field (`buildTerrain(SEED, { landscape: duneHeight, trails: TRAIL })`,
   entry roads and graded trails included), compiled by `@wildshard/sdk/bake/terrain` into 64 L0 + 16 L1 tiles and the
   critical collider: 81 hash-addressed files, 1,455,908 bytes, in `src/shards/sunscar-dunes/assets/`, rows in
   `data/tiles.json`. Vertex colours are the map palette's ground ramp in linear (what the grid's edge reader painted the
   seams in). `shard.config.ts` declares them with `binds: [..., 'terrain']`, the sim budget set to the collider's exact
   cost. The edge rows are now the bake's (257 samples, exact against the collider); they read the old WSTR-read rows
   (256 samples, `data/edges.ts`, deleted) within 8 cm in height and 0.008 in colour.
   - **Stale gate**: `test/shards/sunscar-dunes/tiles.test.ts` reruns the generator and requires the rows and every file
     byte-exact, and the assets folder to hold exactly this bake. Rebake: `node --import ./scripts/sim-node-loader.mjs
     scripts/bake-hybrid-tiles.mjs sunscar-dunes` (0.9 s).
   - The product builds: `wildshard build` reports critical 0.264 MB, tiles 1.192 MB, unique total 1.456 MB.

## Not landed (the runtime adoption, the next slice)

The tiles are declared and bound, but **nothing draws them yet**: Signal Dunes' ground is still the engine level's terrain,
built from `manifest.ground.terrain` (standalone) and by `createRegionalWorldFoundation` (grid cell). Until the runtime
calls `bindRuntimeTerrain`, the product costs 1.456 MB more download at grid admission (0.264 MB critical) for no render
change. The coordinator decides whether that lands now or waits for the adoption.

What the adoption needs:
1. **A product reader for the runtime.** Standalone Signal Dunes admits no product (the legacy manifest boots
   `plugin.ts`), and the grid admits it in `liveSession.admitRuntime` (`retained.admitted`) without a `ClientAssets`. The
   regional factory should pass `new ClientAssets(admitted.source, admitted.assets, productOptions)` to the resident context;
   standalone needs the hybrid boot (`prepareHybridShard`, as Driftwood / Nalati) or the same admission.
2. **The ground swap**, default-off behind a Debug row (a risky rendering change): skip the engine terrain mesh and its
   heightfield collider when `terrain` is bound; draw the bound tiles with the sand material (look/painted.ts) through a
   `terrain` view; register the collider heightfield through `src/engine/physics/` from `ground`; answer
   `queries.heightAt` from it.
3. **Parity gates** then: pixel diff at the standard poses (standalone and grid), `physics-baseline.mjs --mode=walk` 0 stuck,
   the sand on tiled terrain identical, the SF64 ledger and cold-load before / after.
4. **Props** (the dressing): the format binds `props`, but Signal Dunes' pieces are code-built three.js with behaviour
   (braziers, well, tower fire). The static dressing (rocks, scrub) can compile into props tiles; the interactive pieces stay
   runtime-built.

## How the bigger hybrids adopt it

- **Nalati** (painterly, an analytic heightfield): the same compile as Signal Dunes (generator over its field, the
  painterly family's vertex colours); its grass and flowers become props tiles later (instanced, per-tile).
- **Pine Hollow** (photoreal PBR forest): the terrain compile is the same; the forest needs the props path with PBR
  materials (`props.materials`, `splat` for the ground layers) and the far proxy. Biggest memory win, biggest parity risk.
- **Driftwood** (GLB islands over a sea): its ground is mesh collision, not a heightfield: it needs `meshCollision` tiles
  (`src/sdk/bake/worldCollision.ts`) bound the same way, plus the islands as props tiles.
- **Sky Reach** (floating islands): mesh collision and props, like Driftwood; the cloud sea stays runtime-drawn.
- Each binds only what it compiles; an unbound section stays the data client's or the runtime's as today.

## Evidence (a clean export of HEAD + this change, built and served with vite preview)

- Full vitest: 949 files, 5,439 tests; 2 failed, both expected: AG7 (`lint/layer-edges.json`: game → engine +2,
  sunscar-dunes → engine +1, → sdk +1, for the coordinator's serialized regeneration) and `shardfile-reference` (the
  `runtime.binds` values gained `terrain` / `props`; expectation updated in the follow-up commit, the generated
  reference doc is the coordinator's regeneration too).
- Focused: `test/shards/` 159 files pass (the one failure, `driftwood-isle/sea-lowered`, is another lane's uncommitted
  movers WIP; it passes on the clean export).
- Boot smoke (`scripts/parity/boot-smoke.mjs`): standalone PASS ×2, grid PASS, 0 faults. WebKit smoke: pass (14 s).
  `scripts/test-facade-instancing.mjs`: PASS desktop / phone-tier / iphone-desktop-quality, 0 batches.
- Grid run (`progress/shard-platform/sf50/close/grid-run.mjs`, muted Chromium, iPhone 16 Pro, Developer on):
  `grid-run.json`, `entered-1.jpg`, `whip-2.jpg`: enter the Signal Dunes cell with the 81-file product (3.1 s, ready),
  quest 0 → 1, whip crack, leave, re-enter (5.3 s; quest kept), leave; 0 page errors, only `/api/telemetry` 404s.
- Map rebaked (`bake-maps.mjs --shards=sunscar-dunes`): tilesHash e6ce0853…, 24,700 bytes (the world is unchanged).
- Not measured (the runtime draws no tile yet, so there is nothing to compare): pixel parity, physics from tiles, the
  SF64 ledger and cold-load before / after. The physics-baseline is unchanged by construction (no collider moved).
