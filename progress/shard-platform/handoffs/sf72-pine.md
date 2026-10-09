# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (one ledger key, one zipline law, the day's tape; sf72-pine13)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/run.mjs`, the vitest proofs) is still
the old fail-closed compatibility probe; the tape that will become it walks the day.

## Landed

- Bake inputs (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `runtime/fauna.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`. Map inputs
  (`scripts/map-hash.mjs`): `shard.config.ts`, `layout.ts`, `world/`, `generators/`, `models/`. Run both bakes from a clean
  export of the candidate. `quest/` and `runtime/quest.ts` are neither.
- Earlier lanes: herds, roster, elites, live spawns, the roar, the King on `installBossRow` with his record on the flags, the
  day clock, the three weapons and the swap, the Warden's Hollow headless and the entry proof (`704a04d55`), the clear entry
  canyons (`77772d696`).
- **sf72-pine13:**
  - `950eecdf9` + `c7b37c09d` — one ledger key for a quest's fact: `DeclaredQuests` (game layer; the headless path of Pine,
    Sky, Signal and Driftwood, and the declared client) filed the quest's `onComplete` fact under `actor.player` where every
    hybrid page's `bindRuntimeQuest` files it under the quest's id; it now files the quest's id (Pine: `wardens-hollow`).
    Sky's and Signal's compatibility.json re-recorded from real runs (only `ledger.facts[0].entity` moved), Sky's checkpoints
    regenerated (snapshots byte-identical, inputs hash only); the two headless quest tests that asserted the old key fixed.
  - `609b3beef` — one zipline law: `quest/zipWire.ts` (renderer-free) is what the page's ZipRide and the headless keeper
    both ride, in the page's arithmetic. Boot smoke 4/4 (grid included), Pine walk baseline 7 legs 0 stuck.
  - this commit — the day's tape (`test/proof/pine-hollow/witness.ts`, driver `tape.mjs`): tick commands only (`player`
    moves, `pine.interact` presses) from the spawn up the south road to Hale on the porch, west to the dam (both logs, the
    glass; navmesh routes between the route's own points), the pond lantern, the den spur to the lookout trail's foot, the
    graded traverse up (layout.ts `LOOKOUT_TRAIL`), the five flights into the cab (the flint), down to the ridge lantern, up
    again to the launch, the zipline, the den's lantern past Old Blackpaw's cave: 16,955 ticks, ~5.5 s native, the quest on
    `stag`, facts `lanterns:1..3`, `zipline:1`. Run:
    `node --experimental-transform-types --import ./scripts/sim-node-loader.mjs test/proof/pine-hollow/tape.mjs`.

## Next (Pine headless), in order

1. **The native loader:** Pine's headless closure needs Node's type transform: `src/game/eliteSystem.ts`'s `EliteCore`
   constructor uses parameter properties, which strip-only mode refuses (the probe's "TypeScript parameter property is not
   supported in strip-only mode"). Rewrite them as fields (game layer; check the rest of the closure the same way) so
   `run.mjs` runs under `scripts/sim-node-loader.mjs` alone, as Sky's and Signal's do.
2. **The night on the tape:** Hale's second talk (`wait:night`), the stag's walk (follow `STAG_PATH`, within 16 m of each
   bend), the King in his clearing (150, −30) at night by weapon play (the lever-action from the cabin, `PINE_ACT.rifle` at
   (−13.1, −36.0), and the crossbow / longbow by `pine.weapon` + attack / heavy commands), the dawn. Then `run.mjs` becomes
   the witness (headless / replay from a King mid-fight checkpoint / ledger from gameplay through `FactIngress`, as Sky's
   `witness.ts`), compatibility.json from a real run, committed checkpoints + inputs-hash freshness (Sky's `c162fbd6a`:
   the day is already 17k ticks, over the 10k-a-test budget), `canonicalSimDigest`, and the vitest proofs replace the
   fail-closed ones.
3. Honest open items for the witness's list: arrow wind (headless arrows fly in still air); the page's walk-over recovery of
   stuck arrows; the moving spread (headless shoots standing); the dialogue box's reading time and the prompts' line of sight
   / nearest pick (a command names its prompt); the resin / token / secret / miller / thrall / journal / kill feats are not
   emitted headless (only the lanterns, zipline, quest and the King's); the night thralls, the millrace errand and the lodge
   are not hosted; the re-fight's amber resin has no item effect; rain wander goals are null headless; the page's King
   record still lives in `pine.bosses` state.
4. The grid admission (`grid-ready`) installs the same world with the standalone edge walls; the grid's world has none.

Plan-State: unchanged.
