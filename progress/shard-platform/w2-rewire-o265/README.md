# W2a part 2: Pine runtime/ → product rewire (sp-o265, 2026-10-16)

Scope: Pine Hollow's **client** `runtime/` files that import `data/`, `behaviour/` or `shard.config.ts` (the P0
`runtime-standalone` / `no-build-time-import` ratchets), switched to the P2a product API
(`progress/shard-platform/p2a-runtime-data-api/README.md`). Driftwood moved to sp-o266 (coordinator split, 12:40Z).
Sim files (reachable from `runtime/headless.ts`, `scripts/sim-in-runtime.mjs`) are listed, never edited (G453).

Targets: **P** = platform section / `ctx.product.shardfile` (P2a §3.1, §3.3) · **C** = custom section
(`runtime/sections.ts` + `defineSection` in `data/`) · **M** = `runtime/const.ts` mirror, checked by
`runtimeMirrorIssues` · **T** = type-only import: a runtime-local type with a type-equality test · **B** = blocked.

## Client files (rewire here)

| File | Imports | Target |
|---|---|---|
| runtime/index.ts | `shard.config` | P: `ctx.product.shardfile` (runtimeLookMaterials, bindRuntimeEquipment, runtimeAudio) |
| | crossbow/lever/bow profiles | P: `combat/items` rows (`items.rows[id].profile`, the same values `data/items.ts` attaches) |
| | `lookMaterials.generated.json` `.runtime`, `wildlifeLook` | M: the graph id lists (strings) |
| | `questInventory` (bag items, feats) | C (needs the custom-section writer, see blockers) |
| | `eliteBrainRows`, `behaviour/night.generated.json`, `behaviour/director.json` | B: Wasm bytes → `product.file('behaviour/<stem>.wasm')` once the writer emits named blobs |
| | `skinPickups.json`, `ambientLife` | C (blocked) |
| runtime/antlerKing.ts | `layout` KINGS_CLEARING, `kingFxLook`, `kingFight` arena fog | M |
| runtime/persistence.ts, runtime/facts.ts | `shard.config` | P: `ctx.product.shardfile` |
| runtime/audio/{sfx,ambience,score,wiring}.ts | `shard.config` | P: the audio rows passed in from `ctx.product.shardfile.audio` |
| runtime/audio/{files,profile}.ts | `shard.config` (module-level; the manifest's `audioBindings.preload` / `BOOT_AUDIO` run before any ctx) | B: needs P3 boot bindings to receive the product |
| runtime/weapons/LeverRifle.ts, crossbow/Crossbow.ts | handsLook, heldLook, leverPresentation, leverDetails.json, crossbowPool.generated.json, leverProfile | P (profile) + C (viewmodel looks, blocked) |
| runtime/items/{leverFirearm,boltCrossbow}.ts | held*.json, leverPlayback.json, rangedFrame | C (blocked) |
| runtime/birds.ts, looks/paintedTextures.ts, compendium/trophyWall.ts | generated JSON bakes | C (blocked) |
| runtime/looks/keyedSky.ts | type-only `keyedSkyRows` | T |
| data/cabinLook.ts, data/cragLook.ts, data/handsLook.ts … | type imports **from** runtime/ (`no-runtime-in-build`) | T |

## Sim files (listed, not touched: G453 moves them out to sections + hosts or Wasm)

air, baked, directorClock, elites, headless, herds, king, kingCollisionBake, kingPoseKeeper, lodge, looks/graphLooks,
nightDirector, nightPopulation, pack, quest, rainShelter, rangedVolumes, roster, species/herdShelter, species/limbRig,
trader, weapons/{ammunition,gustClock,headlessCrossbow,headlessLever,headlessLongbow,headlessRanged,motion}.

## Blockers

- **Custom sections and named Wasm blobs are not emitted yet.** `defineSection` / `emitDefinedSections` (40db802bc) and
  `emitPlatformSections` exist but no shard build calls them: `public/shardfiles/<slug>/` is still a v1 `shard.json`.
  Every **C** / **B** row waits for the writer (P1 sp-x5 + P2b sp-x6) to take a config's sections.
- **The build's mirror check isn't wired** (`validateRuntimeData` has no caller; no `mirrors` config field). Until it
  is, `test/pine-runtime-mirrors.test.ts` runs the same `runtimeMirrorIssues` over `data/runtimeMirrors.ts` and
  `runtime/const.ts` (review item 8's per-shard test).
- **P** rows need sp-x8's step 3 (`ctx.product` passed by session, pluginLoad and the grid).

Order: M (antlerKing, index graph ids) → T → P once step 3 lands (index, persistence, facts, audio).

## Landed (12:20Z-12:50Z)

| Commit | What | Escapes |
|---|---|---|
| 4337ac6ae | antlerKing: clearing, arena fog, fx ids from `runtime/const.ts`; `data/runtimeMirrors.ts` + `test/pine-runtime-mirrors.test.ts` | antlerKing rs 12 -> 9 |
| 11aabf6b3 | cabinLook / cragLook drop their runtime type imports; `test/pine-runtime-types.test.ts` | no-runtime-in-build -2 |
| 984396843 | index.ts graph ids (look materials, wildlife) from const mirrors | index rs -2 |
| 0ba7892c0, 1dc83e4ba | rangedFrame, leverPresentation (no build reader) into runtime/items; lever and buckskin mirrors; test path | rs -4, no-runtime-in-build -2 |
| 2adc2cdfb | heldLook into runtime/weapons; hands palette/materials mirrored | LeverRifle -2, Crossbow -2 |
| 52d7cd405 | index, persistence, facts, audio sfx/ambience/wiring read `ctx.product` (shardfile, `combat/items` profiles) | rs -9 |
| d3c02c3e1 | score.ts profile passed in (no module-level config read) | rs -1 |

Pine totals (ratchet at start -> now, all lanes): runtime-standalone 178 -> 155, no-build-time-import 200 -> 176,
no-runtime-in-build 15 -> 10.

Not landed: `keyedSkyRows` into runtime/ (look/dayKeys is sim-reachable, so the move made a new sim-in-runtime file).
