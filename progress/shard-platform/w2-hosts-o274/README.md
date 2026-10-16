# W2 creature hosts: a Pine twin or back to Driftwood (2026-10-16, sp-o274)

sp-o267's audit (`progress/shard-platform/w2-sim-o267/README.md`, `07b5ec55a`) left six Driftwood-only creature hosts
failing Jake's G454 bar (two real users, no shard nouns, data-only differences, server-safe, the deletion test). sp-o269's
R1 (`a13e6f596`) already rescued the native roster and recipes. This lane checks each remaining host for a real parallel
in Pine Hollow's sim (`runtime/*.ts` sim files, `combat/`, `quest/`, `species/`) that can move onto it as data rows.

Search: every Pine file that spawns, places, decides, poses or lifts a creature: `runtime/{roster,herds,nightPopulation,
nightDirector,king,elites,kingPoseKeeper}.ts`, `combat/{eliteScripts,lane,kingFight,spawns,strikes}.ts`,
`runtime/species/{limbRig,herdShelter}.ts`, `quest/nightSpec.ts`. Pine's herds are placed by the engine's
`HuntBrain.placeHerds` and hunted by the stalker brain; its King and four elites run on `kingFight` / `EliteCore` with
Wasm lanes; its one runtime spawner of loose creatures is the night director's roamer call.

## Decision table

| Host (`src/game/plugin/`) | ~lines | Pine twin (file:lines) | Verdict | Data rows needed | Est. Pine cut |
|---|---:|---|---|---|---:|
| `sampleCreatureGroup` (`brain.ts`) | 56 | `runtime/nightDirector.ts` `callRoamer` 136–152: an elliptical area-law draw over the old growth, 12 tries, rejected by a distance band to the player, an exclusion circle, the map bound and the water line, yaw facing the player | **twin: convert** | source `axes: [ax, az]`, `bearing: 'compass'` (x = sin, z = cos); group `face: {x, z}` (yaw toward a point, no draw); `accept` row `{ band, clear[], bound, minHeight }` replacing the `accept` callback (DW's crab rule becomes `minHeight: water + 0.15`); the unused `joined` callback goes; the stream port narrows to `{ next }` | −8 |
| `selectCreatureSites` (`brain.ts`) | 34 | none. Pine never ranks candidate sites: herd centres come from `placeHerds`, elite lairs and the King's clearing are fixed layout points (`data/layout.ts`, `data/eliteHomes.ts`) | **counts back to DW** (its two callers' `score` callbacks, palm density and monkey perch preference, are Driftwood decisions) | — | 0 |
| `createCreatureSpawner` (`brain.ts`) | 60 | none. Pine's grouped spawns are `placeHerds` (engine); its loose spawns (night roamers, King adds, elite respawns, Bull rivals) go one body at a time through the shared roster's live spawn, with no herd grouping or dispose-retire set | **counts back to DW** (page `creatures/Enemies.ts` only) | — | 0 |
| `createMemoryActionBrain` (`brain.ts`) | 64 | none. No Pine creature gates effects on attack phase plus memory flags: deer / elk / boar / bear strike through the stalker brain's strike rows; the King and elites run `Lane` charges and Wasm scripts | **counts back to DW** (crab, sailor, monkey, captain) | — | 0 |
| `createNativeSpeciesContext` (`brain.ts`) | 42 | none as a host. Its job is binding a per-body species policy to the hunt's tokens, steering and a KeptPolicy; Pine has no per-body species policy. Pine's `king.ts` 61–65 and `elites.ts` 78–82 repeat one creature-blow port (reach, then `combat.hit`) that resembles the context's `hurt`, but differs in source (`combatActor`), the facing arc and `throughWalls` | **counts back to DW** | — (a shared blow row is a separate, ~6-line cut) | 0 |
| `sampleCreatureSwing` / `poseCreatureStride` / `stepCreatureLift` (`animation.ts`) | 84 | none. Pine has no biped creature (the King's legs are a hip / knee / hock / hoof chain, `data/kingRig.ts`, driven by baked clips, not the six-joint biped stride), no wind / cut / recover channel swing (the King's acts are baked clips, `generators/kingClips.ts`), and nothing writes `yOffset` (no rise from water or sand) | **counts back to DW** (sailor, captain poses and the captain's lift) | — | 0 |

**Result:** one honest conversion, `sampleCreatureGroup`, which then passes all five tests (Pine night roamers + DW crab
and monkey groups, data-only). The other five host groups, about **284 lines**, have no Pine twin and count back to
Driftwood until a W3 port brings a second real user (G454 (3)): Nalati's and Nine's ports are the candidates for the
memory-action brain and the stride / swing poses.

## What lands

| Slice | SHA | Pine Δ | DW Δ | Checks |
|---|---|---:|---:|---|
| decision table | `f36a9f8e9` | — | — | — |
| `sampleCreatureGroup` data rows, Pine roamer on it | `fa65c3da5` | 18,251 → 18,247 (C4 3,810 → 3,805) | 0 | check3 mirror, exact parent `9c182a970`: fresh boot, tick 60, 120, 180 snapshots equal for Pine and DW, and the parent's tick-120 save resumed at the candidate reaches the parent's tick 180 for both; oracle tests of the retired roamer loop (120 seeds) and crab callback (200 seeds), bit-identical points, yaws and stream; shard-headless + native fauna / roster / recipes / pose / spawner / site / coconut / elite-core 32/32; root tsc + layers clean; no new `no-shard-host-callback` site; no new runtime/ file |

The stream and ground reach the host as engine service views (`Pick<Rng, 'next'>`, `Pick<HuntGround, 'heightAt'>`), the
shape the hunting hosts already take, not shard decisions. No pose or visible behaviour changed (placement is
bit-identical), so no phone pair. The cut is small: the honest gain is G454 compliance, not lines.
