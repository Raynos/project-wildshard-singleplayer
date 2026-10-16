# W2b part 2, Driftwood: runtime reads the product, not data/

2026-10-16, sp-o266. Row W2b (shardfile design §6) with the P2a recipe
(`progress/shard-platform/p2a-runtime-data-api/README.md` §4, §5). sp-o265
does Pine. Measure: the P0 ratchets `wildshard/no-build-time-import` (DW
207 imports in 114 files at survey) and `wildshard/runtime-standalone` (DW
106 in 30 runtime/ files). Survey script: `node tmp/sp-o266/survey.mjs
[rule]` (scratch; reads `lint/shardfile-boundaries.mjs`).

## Targets

- **const**: a true constant (look.materials ids, sizes, tunables) copied
  into `runtime/const.ts`; `data/` declares it with `defineMirror` in
  `data/runtimeMirrors.ts`; `test/shards/driftwood-isle/runtime-mirrors.test.ts`
  runs `runtimeMirrorIssues` until P2b wires `mirrors` in shard.config.
- **product**: `ctx.product.shardfile` / `section(...)` / `strings(...)`
  (needs sp-x8's P2a step 3 in HEAD: product passed into `shardContext`).
- **type**: a type-only import becomes a local type in `runtime/`; the call
  site that hands it a `data/` value keeps the two shapes in step.
- **custom**: a shard-only table with no platform section; needs P2b's
  config `sections` field (not wired yet) and raises the custom-section
  ratchet (DW 0), so last resort with an exit row.
- **blob**: a file table that becomes named blobs (`product.url/file`),
  waiting on sp-x6's Driftwood asset move.

## Client files in runtime/ (this lane)

| File | data/ imports | Target |
|---|---|---|
| runtime/hybrid.ts | 10 look-id modules | const |
| | shard.config, residentWorld (wraps shard.config) | product |
| runtime/index.ts | fpArmsLook | const |
| | shard.config | product |
| | questInventory, economy (feats, items, effects, goods) | product (`quests`, `items`, `ledger`) or const |
| runtime/loadout.ts | fpArmsLook, meleeProfile | const |
| | ironSwordScene.json | const or custom |
| | shard.config | product |
| runtime/audio/{sfx,install,ambience,files}.ts | shard.config (`audio`) | product (`audio/audio`) |
| | audioPlayback, audioSurfaces | const |
| runtime/fpArms.ts | fpArmsLook | const |
| runtime/looks/{creatureLooks,facetedOcean,smokeColumn}.ts | look ids, ocean sizes | const |
| runtime/looks/{facetedGround,reefBed,streamedCover,smokeColumn,facetedDayBackdrop}.ts | lookRows / facetedDayRows types | type |
| runtime/looks/bakedIsland.ts | islandClips.generated.json | custom (generated) |
| runtime/boot/modelGeometry.ts | modelFiles | blob (sp-x6) |
| runtime/finalePresentation.ts | captainEncounter, spots.generated.json | product (`combat/encounters`) or custom |

Order: consts first (no dependency), then product reads once step 3
lands (sp-o261's four `source` users: hybrid, index, look/terrainPainter,
look/backdrop), then types.

## Client folders outside runtime/ (after sp-o264 moves them)

npc/, look/ (backdrop, stylizedSky, terrainPainter, toon), boot/ geometry
loaders, models/: same targets; mostly look ids and bake JSON (blob or
custom). Rewired only after the move lands, never over another lane's hunk.

## Sim: not touched (G453)

Reached from runtime/headless.ts (`scripts/sim-in-runtime.mjs`):
runtime/{baked,captain,director,ecology,enemyBrains,fauna,headless,keeper,
kills,placement,quest,speciesBrains}.ts. By nature (sp-o264's
classification): combat/, creatures/, species/ (but captainMesh, fauna),
quest/, loot/, loadout/rows.ts, world/build.ts, world/sea.ts,
look/dayKeys.ts, boot/ground.ts, boot/bridgeFacts.ts. These leave runtime/
as sections plus hosts or Wasm (W1/W3 rows), not here.

## Landings

| SHA | Change | no-build-time-import DW | runtime-standalone DW |
|---|---|---|---|
