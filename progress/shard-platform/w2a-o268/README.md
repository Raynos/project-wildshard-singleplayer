# W2a: Pine mixed folders, client / sim split (sp-o268, 2026-10-16)

G453: `runtime/` is client-only. A file moves into `runtime/` only when it is client-only (render, look, view, UI,
input, audio), is not reached from `runtime/headless.ts` (`scripts/sim-in-runtime.mjs` reach, measured at `d42fa9f7a`),
is not imported by a generator (build time never reads `runtime/`), and passes `wildshard/runtime-performance` as is
or with a small honest edit. Everything else stays where it is for sp-o267 (sim → sections + hosts) or a later row.

Done before this table: `dev/` (`396777351`), `models/` (`d42fa9f7a`).

## Moves now (zero runtime-performance sites, no generator importer)

| File | Why it is client-only |
|---|---|
| world/cabinBake.ts | draws the log buildings from their offline bake |
| world/cabinKit.ts | the homestead's prop dressing as the prop models read it |
| world/codeParts.ts | code-built parts from their offline bake (drawing) |
| world/cragKit.ts | the Ridge's granite kit for the crag models |
| world/heroFiles.ts | the hero props' file table (drawing) |
| world/undergrowthKit.ts | the forest-floor plants as their models read them |
| species/rigs.ts | the rigged hull files |
| weapons/Longbow.ts | the longbow's presentation |
| weapons/longbowView.ts | the arrow's view geometry |
| loadout/finishes.ts | the Bag's FINISHES row (UI) |
| loadout/skins.ts | authored material finishes (looks) |

Landed in `000e91270` without species/looks.ts: moved, it would raise shard-game-plugins 2 → 4 (runtime/ may import
only trusted game facades), so it stays until its game imports go through one.

Then, with one small edit each (`4533df34f`): world/hero.ts (anisotropy set per map, no fresh array loop) and
world/streams.ts (the spray loop under a literal cap, MAX_SPRAY 64 over the bake's 11).

## Stays: sim (reached from runtime/headless.ts)

world/terrain, treeSet, water, weatherProfile · loadout/ammo, effects · weapons/crossbow/flight, crossbow/profiles,
leverAction, longbowFlight · combat/combatMath, eliteRoster, eliteScripts, eliteStreams, kingFight, kingRig, kingTiming,
lane, strikes · quest/benchPose, contracts, featLaw, graph, nightSpec, stagWalk, table, trades, wardensHollow ·
species/rows.

## Stays: sim-shaped play code not reached from headless yet (sp-o267's conversions)

weapons/equipment, longbowProfile · combat/spawns, elites, install, ctx, chargeTells · quest/index, beats, content,
hollowLog, nightThralls, rides, rifleFloor, stagLead, tokenShelf, ui · loadout/loadout, events · world/places,
weather · species/bodies, thrall.

## Stays for now: client, but not a clean move today

| File | Blocker |
|---|---|
| world/timberBake.ts, world/undergrowth.ts, world/logKit.ts | read by generators (build time) |
| world/homestead.ts, crags.ts, landmarks.ts, cabins.ts, props.ts, drawnModels.ts, treeFactory.ts, timber.ts, timberSites.ts, cragBake.ts, context.ts | runtime-performance sites (raw scene / renderer, unbounded loops, frame allocations) need their own honest edits |
| combat/fxKit.ts, species/hulls.ts, weapons/crossbow/display.ts, quest/npcModels.ts | same |
| world/beaverPool.ts | writes `beaverPoolLevel` (the pool's water level other code reads): check it is presentation only first |
| species/looks.ts | shard-game-plugins would rise (above) |
