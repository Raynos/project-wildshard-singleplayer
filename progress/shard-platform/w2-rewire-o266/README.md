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

## For sp-x5: sections and named blobs Driftwood's client reads need

What is left in Driftwood's client `runtime/` after the const mirrors
(2026-10-16 13:15Z). sp-x5 emits these from `shard.config.ts` and owns
`runtime/sections.ts`; this lane then switches the reads to
`ctx.product.section(name, SECTIONS)` / `ctx.product.url(name)`.

### Named blobs (URL tables of baked GLBs; read with `product.url`)

| Blob names (proposed) | data/ source | Reader |
|---|---|---|
| `models/fixed/<key>.glb` (83) | `modelFiles.ts` `FIXED_MODEL_FILES` (key -> URL) | runtime/boot/{fixedGeometry,modelGeometry,coverGeometry,coveGeometry,trailsideGeometry}.ts |
| `ground/ground.glb`, `ground/slab.glb` | `groundFiles.ts` `GROUND_FILES` | runtime/look/terrainPainter.ts |
| `reef/<group>/<kind>.glb` | `reefFiles.ts` `REEF_FILES` | runtime/boot/reefGeometry.ts |
| `palms/<key>.glb`, `hibiscus/<key>.glb` | `palmFiles.ts`, `hibiscusFiles.ts` | runtime/boot/{palmGeometry,hibiscusGeometry}.ts |
| `zipline/<key>.glb` | `zipline.generated.json` (world, trolley, ...) | runtime/models/zipline.ts |

`bootFiles.ts` (`DRIFTWOOD_BOOT_FILES`, `DRIFTWOOD_BOOT_SOURCES`: boot
selections over the URLs above, `{ <sel>: { source: { urls: string[] } } }`)
is read by runtime/boot/{sources,lateReads}.ts; once the URLs are named
blobs it becomes lists of blob names (custom `custom/bootFiles`, or
sp-x6's boot inventory if that lands first).

### Custom sections (no platform section fits)

| Section (proposed) | data/ source | Shape | Reader |
|---|---|---|---|
| `custom/cumulusPuffs` | `cumulusPuffs.json` (generators/cumulus.ts) | `number[7][]`, 8.8 KB | runtime/look/backdrop.ts |
| `custom/islandClips` | `islandClips.generated.json` | `{ sourceVertices, sourceIndices, outputIndices: number; ranges: { start, count }[] }` | runtime/looks/bakedIsland.ts |
| `custom/hutBake`, `custom/lookoutBake` | `hutBake.json`, `lookoutBake.json` | `{ site, origin, floorY, ... }`, 7-9 KB | runtime/models/{hut,lookout}.ts |
| `custom/chimeSlots` | `chimeSlots.json` | `{ start, count }[]` | runtime/models/seaGlassChime.ts |
| `custom/reefSpecimens` | `reefSpecimenRows.ts` `REEF_SPECIMENS` | record of kind -> specimen row | runtime/boot/reefGeometry.ts |
| `custom/trailSpecimens` | `trailSpecimens.ts` + `trailSpecimenRows.ts` | record + row array | runtime/boot/trailSpecimens.ts |
| `custom/coveBake` | `coveBake.json` | `{ specKey, ... }`, 24 KB | runtime/boot/coveGeometry.ts |
| `custom/trailsideBake` | `trailsideBake.json` | `{ specKey, ... }`, **201 KB**: better a named blob if a JSON blob kind exists | runtime/boot/trailsideGeometry.ts |
| `custom/rows` (or platform economy rows) | `questInventory.ts` `DRIFTWOOD_ITEMS`, `DRIFTWOOD_FEATS`; `economy.ts` `DRIFTWOOD_EFFECTS`, `GOODS` | `ctx.rows.item/feat/effect/shop` inputs | runtime/index.ts |

`runtime/finalePresentation.ts` reads `captainEncounter.ts`
(`CAPTAIN_DEF.id`, `.arena.r`, `CAPTAIN_PRESENTATION.name`) and
`spots.generated.json` (`reward` point): small, so const mirrors (this
lane) unless the platform `combat/encounters` section carries them.

### Blocked on a product route (not sections)

- runtime/look/{backdrop,terrainPainter}.ts pass `shard.config` to the
  sky and ground look materials but run under the engine's
  `WorldLookContext` (renderer, sky, scope), which has no product.
- runtime/audio/files.ts `createDriftwoodAudio()` is the boot audio
  preload (discovery `audioBindings.preload`), called with no context.

## Landings

| SHA | Change | no-build-time-import DW | runtime-standalone DW |
|---|---|---|---|
| `a62ca473f` | look ids, sea constants (hybrid, looks) | 207 -> 194 | 106 -> 93 |
| `8f1090f43` | arms look, step surfaces, voice families | 193 -> 188 | -5 |
| `aa80aa697` | ground row, kit lends, sky, day light, fog | 188 -> 183 | -5 |
| `98d180613` | ctx.product: resident motion, arms, audio; data/residentWorld.ts deleted | 183 -> 177 | -6 |
| `844047b79` | loadout: profiles, pickup scene, items via ctx.product | 177 -> 173 | -4 |
| `59d229350` | models: rock palettes, boat, counter, island rows | 173 -> 167 | -6 |
| `4dd9fcce7` | Castaway scene, pose, focus, smoke | 167 -> 163 | -4 |
| `acc832f84` | reef look id, wreck sites | 163 -> 161 | -2 |
| `9d91ba79f` | runtime/looks/rows.ts: the looks' own row types; FACETED_DAY_PRESET mirror | 161 -> 156 | -5 |
| `b3514ee54` | finale: Captain id, arena radius, bar name | 156 -> 155 | -1 |

(Counts between rows moved as other lanes moved files into runtime/.)

Proof at `b3514ee54`: cold `pnpm gen`, `tsc -b tsconfig.layers.json`
clean, 37 focused files / 84 tests (mirror test, 17 shard-headless,
every `driftwood-*` and NPC test) in the build mirror; standalone
Driftwood boot (iPhone portrait, muted) 0 page errors, view unchanged
from `0705c51b0` (values are identical by the mirror test, so no
before/after pair). sim-in-runtime DW stays 12.
