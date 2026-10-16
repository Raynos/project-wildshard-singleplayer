# Driftwood runtime/ closure: where the last 76 escapes go (sp-o283, W2b)

The P4 output ruler counts Driftwood's raw `runtime-standalone` escapes
(`scripts/shard-runtime-closure.mjs`, the same rule the strict copier
uses). It counted 100 on the working tree before this lane and **76 after
it**. Driftwood is **not closed**.

What landed (W2b, sp-o283):

- `8184f77fc` the cove facts go into `custom/fixedLayouts` (100 to 99)
- `9b6820e60` the trailside rows become a new `custom/trailside` section (99 to 98)
- `21e7cdef7` the shrine and trophy slots go into `custom/fixedLayouts` (98 to 96)
- `0d79f3b34` the zipline rows become a `runtime/const.ts` mirror (96 to 95)
- `fd38ed7fb` six sim-only modules move out of runtime/ (95 to 76;
  sim-in-runtime 12 to 6). Their new homes are keeper and fauna in
  `creatures/`, enemyBrains in `species/`, kills in `quest/`, captain in
  `combat/captainEncounter.ts` and baked in `world/`.

Custom sections: 6 / 197,173 bytes, with a rise record for each step in
`lint/custom-sections.json`.

## The 76, by class

| Class | Escapes | Files | Home / owner |
|---|---:|---|---|
| (c) sim in runtime/ | 20 | `headless.ts` 10, `quest.ts` 4, `director.ts` 3, `ecology.ts` 1, `placement.ts` 1, `speciesBrains.ts` 1 | W3 rows, table below |
| (a) file tables | 13 | `boot/*Geometry.ts`, `look/terrainPainter.ts`, `boot/lateReads.ts`, `boot/sources.ts` (`data/modelFiles`, `palmFiles`, `reefFiles`, `hibiscusFiles`, `groundFiles`, `bootFiles`, `ktx2.generated`) | sp-x6 (blob intake); left alone on the brief |
| (a) bridge / pier rows | 3 | `models/pier.ts` (`data/pierRows`, `piers.generated.json`), `models/ropeBridge.ts` (`data/bridgeRows`) | stay on data/ (coordinator) |
| (a) dev poses | 1 | `boot/poses.ts` (`manifest.json`) | a `level` / dev-pose section once x1's source mode lands |
| (b) the world build | 18 | `index.ts` 8 (`world/build`, `systems`, `gpuOnlyCopies`, `quest/install`, `adventure`, `creatures/install`, `loadout/rows`, `strings`), `hybrid.ts` 6, `audio/install.ts` 4 | moving these means moving the whole client closure, below |
| (b) small play leaves | 21 | `finalePresentation` 3; `rockKit` 3; `tiers` 2; `quest/people` 2; `assets/contracts` 3; `world/coveLayout`, `trailsideLayout`, `pierLayout`, `boatFrame`, `Gulls`, `look/dayKeys`, `boot/ground`, `boot/bridgeFacts` 1 each | move into runtime/ with their importers (W3) |

**Why DW can't close inside its ceiling tonight.** The page entries
(`runtime/index.ts`, `runtime/hybrid.ts`) reach 230 shard files. 82 of them are
already in runtime/ (85 files there in all); the other 148 sit in world/, quest/, species/, creatures/,
combat/, loadout/, look/ and boot/. Moving all of them in would take runtime/
to about 233 files, well past the 128 ceiling in `lint/runtime-files.json`.
So closing (b) needs one of two things: a reviewed ceiling raise, which is
what Pine got (W2 seed, 152), or the world build first shrinking onto hosts
and sections. The 21 small leaves can move without a raise.

## (c) sim still in runtime/: proposed homes (W3)

| File | Escapes | Why it stays tonight | Proposed home |
|---|---:|---|---|
| `runtime/headless.ts` | 10 | The platform's native-entry convention: shard-headless, `test/proof/driftwood-isle/{run.mjs,worker.ts,witness.ts}` and sim-in-runtime's root all name `runtime/headless.ts` | a sim entry folder (needs a `lint/shard-layout.json` folder, coordinator) or the W1 script entry (KA2/KA6); its callers move with it |
| `runtime/quest.ts` | 4 | Imports the trusted `@wildshard/sdk/runtime/prompts` facade, and the hard `layer` rule keeps trusted SDK imports in runtime/ | quest prompts and spots as a platform interaction section on a host that passes G454; the native pack and policy JSON go to sections |
| `runtime/director.ts` | 3 | The page imports it too (`index.ts`, `finalePresentation.ts`) | director JSON goes to the platform director section; the client half stays as presentation |
| `runtime/ecology.ts` | 1 | Shared with the client's `quest/Ecology.ts` | `RespawnQueue` goes to a shared ecology host; `data/ecology` becomes a section |
| `runtime/placement.ts` | 1 | Shared with `creatures/Enemies.ts` | enemy placement becomes spawn rows (platform spawns section) |
| `runtime/speciesBrains.ts` | 1 | Shared with `species/sailor.ts` | species tables become rows; brains go to KS-style `.as` scripts plus moves (KA5) |

Moving the six sim-only modules out added no new debt: each one's lint
rows moved with it unchanged. `runtime/headless.ts` went from 6 to 10
escapes, because it now imports four of them from outside runtime/.

## Update (sp-o287, W2): 76 to 56

| Commit | Change | Escapes |
|---|---|---:|
| `c56a1fee2` | `quest/people`, `world/Gulls`, `world/boatFrame` into runtime/; `runtime/tiers.ts` copy of the root knobs (gull rows mirrored) | 76 to 69 |
| `9cc77904e` | `sim/` (DW-only legacy entry, exit row in open-x-queue.md): `headless.ts` plus keeper, fauna, enemyBrains, captainEncounter, kills, baked | 69 to 59 |
| `5d05be82b` | dev poses read a `CAPTURE_PROBES` mirror; shrine / wreck contract types copied into runtime with a type test | 59 to 56 |

sim-in-runtime 6 to 5. runtime/ holds 89 `.ts` files, under the 128
ceiling, so no raise line was needed.

**The world build does not close by moving.** A graph simulation that
moves every page-reached play file the headless entry does not reach (66
files) into runtime/ takes the shard-local escapes from 57 to 139: the
moved files import data/ rows and the sim-shared world/sea, species/ and
creatures/ modules. A greedy search for any move that lowers the count
finds only 5 more (Cove + coveLayout + Waterfall + rockKit, strings,
systems), and rockKit's load-time loops fail the runtime-performance
rule. So the 17 world-build escapes need sections and hosts first, not
a ceiling raise.

| Class | Escapes | Files |
|---|---:|---|
| (c) sim in runtime/ | 10 | `quest.ts` 4, `director.ts` 3, `ecology`, `placement`, `speciesBrains` 1 |
| (a) file tables | 13 | unchanged, sp-x6 |
| (a) bridge / pier rows | 3 | unchanged, stay on data/ |
| (a) dev poses | 1 | `boot/poses.ts` -> `boot/ground` (reaches world/sea, a sim module) |
| (b) world build | 17 | `index.ts` 8, `hybrid.ts` 5, `audio/install.ts` 4 |
| (b) leaves | 12 | `finalePresentation` 3 (Finale/adventure types, sim `combat/captain`); rockKit 3 (runtime-performance); `pier.ts` -> pierLayout + contracts/pier 2; coveLayout, trailsideLayout, bridgeFacts, dayKeys 1 each (each imports data/ or world/sea, so moving is net zero without a mirror or section) |
