# W2b part 1, Driftwood: which play code is client-only

2026-10-16, sp-o264. Row W2b (shardfile design §3, §6), under G453: `runtime/` is
client-only (view, looks, UI, input, audio, presentation, camera, viewmodel).
Server logic (spawns, combat rules, quests, state, AI and brains, roster,
ecology, physics the native host owns, anything `runtime/headless.ts` runs)
stays out of `runtime/` and later becomes sections plus hosts or Wasm.

Method: two reads per file. (1) Reach: the shard files reachable by relative
imports from `runtime/headless.ts` (the sim) and from `plugin.ts` +
`runtime/index.ts` (the page). Anything the headless entry reaches is sim or
shared and never moves. (2) Nature: what the file does, so a server concern
the headless entry does not reach yet (quest spine, spawn tables, loot rules)
still stays out.

Moves are `git mv` plus import paths only, one folder or small group per
commit, folder names kept under `runtime/` (`look/x.ts` -> `runtime/look/x.ts`).

## Client: moves into `runtime/`

| Folder or file | Class | Reason |
|---|---|---|
| `onboarding/firstMinutes.ts` | client | first-time control hints (UI triggers) |
| `fpArms.ts` | client | first-person arms, the viewmodel |
| `npc/` (Castaway, Trader) | client | NPC meshes, clips, head focus, smoke; presentation only |
| `look/` backdrop, groundColor, render, stylizedSky, terrainPainter, toon | client | the toon look: light, fog, sky, ground painter |
| `boot/` geometry loaders (cove, cover, fixed, foliage, hibiscus, palm, reef, trailside, trailSpecimens), `sources.ts`, `lateReads.ts`, `poses.ts` | client | render-geometry intake, boot file lists, capture poses |
| `models/` (28) | client | Model Explorer mesh builders; their collider rows are model metadata the page registers, the native host collides from the bake (`runtime/baked.ts`) |

## Stays where it is

| Folder or file | Class | Reason |
|---|---|---|
| `combat/` | sim | headless reaches all three (captain, coconuts, strikes) |
| `creatures/` | sim | spawn tables and installer; headless reaches `species.ts`, `tables.ts` |
| `species/` | mixed, mostly sim | brains, policies and poses the headless runs; `captainMesh.ts`, `fauna.ts` are looks (move later with a split) |
| `quest/` | sim | the castaway spine, feats, finale, ecology, trader stall rules |
| `loot/` | mixed | keepsakes, perks, finds, shop are rules/state; `presentation.ts` is UI but imports quest and shop |
| `weapons/IronSword.ts` | mixed | the display model plus the pickup grant |
| `loadout/rows.ts` | sim | owns taking and saving the sword |
| `world/` | mixed | set pieces are view, but `build.ts` places the static colliders, the rope bridge's jointed deck (`RopeChain`), the zipline ride and the sea; `world/sea.ts` is read by headless |
| `look/dayKeys.ts` | shared | headless reads the day clock (`DRIFTWOOD_DAY`) |
| `look/far.ts`, `look/map.json`, `look/map.baked.json` | build-time | read by the far baker and the map bake only; go to `generators/` / `data/` later |
| `boot/ground.ts` | shared | the terrain field the manifest declares as `ground` (height queries, collision terrain) |
| `boot/bridgeFacts.ts` | shared | the rope bridge bake key, read by the bake and `world/` physics |
| `tiers.ts` | build + client | `islandKnobs()` is read by `generators/` and `data/` too; belongs in `data/` |
| `budgets.ts`, `strings.ts`, `roster.ts`, `plugin.ts`, `manifest.json` | root | design §3.1 sends them to `data/`, a debug section and `runtime/index.ts`; not this row |
| `explore/`, `thumbs/` | build-time assets | images only |

## A second gate: the runtime-performance hard rule

`wildshard/runtime-performance` (hard, `.oxlintrc.json`) runs only on
`runtime/**` files and its baseline grants no new allowances (SF62). A
client file with an unbounded loop, DOM, timer or frame allocation can
not move by paths alone, so these stay put until their loops are made
statically finite (a code change, not this row): `onboarding/firstMinutes.ts`,
`npc/Trader.ts`, `boot/foliageGeometry.ts`, `models/` entryDeck, people,
pier, ropeBridge, shrine, trophyPlaques. `look/groundColor.ts` stays too
(generators, the far look and the Blender export read it).

## Landings

| SHA | What moved | Ratchet note |
|---|---|---|
| `3f2479404` | `fpArms.ts` -> `runtime/fpArms.ts` | runtime-standalone +1 moved, -2 importers; shard-game-plugins -1 |
| `262295ea0` | `look/` backdrop, render, stylizedSky, terrainPainter, toon -> `runtime/look/` | runtime-standalone +10 moved, -2 importers; toon shard-game-plugins +1, shard-engine-imports +1 |
| `0d56683e7` | 11 `boot/` loaders, file lists, poses -> `runtime/boot/` | runtime-standalone +27 moved, -2 importers; shard-sandbox -2 |
| `d97143bee` | fix: the move script kept `.ts` on `shard.config` / `ktx2.generated` imports (TS5097) | none |
| `b3377f6c9` | 22 `models/` builders -> `runtime/models/` | runtime-standalone +23 moved, -5 importers; shard-game-imports -1 |
| `dcb111f5c` | `npc/Castaway.ts` -> `runtime/npc/Castaway.ts` | runtime-standalone +4 moved |

Every move is paths only. Headless reach (`scripts/sim-in-runtime.mjs`)
is unchanged by all of them: none of the moved files is reachable from
`runtime/headless.ts`. runtime-standalone rises are the moved files' own
imports of `data/`, `shard.config`, JSON and the folders that stay; they
fall as those become sections or `runtime/const.ts` mirrors.
