# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (the quest, the entry proof, the clear canyons; sf72-pine12)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is still the old fail-closed
compatibility probe: the witness is the next lane's work.

## Landed

- Bake inputs (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `runtime/fauna.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`. Map inputs
  (`scripts/map-hash.mjs`): `shard.config.ts`, `layout.ts`, `world/`, `generators/`, `models/`. Run both bakes from a clean
  export of the candidate (their stamps hash the files under the script's own root, so a shared tree with WIP stamps wrong).
- Earlier lanes: herds, roster, elites, live spawns, the roar, the King on `installBossRow` with his record on the flags, the
  day clock, the three weapons and the swap (`4dc3744b3`).
- **sf72-pine12:**
  - `704a04d55` — the Warden's Hollow headless (`runtime/quest.ts`): `DeclaredQuests` over the shard's rows and every beat's
    prompt at the page's baked point (`scripts/bake-pine-spots.mjs` → `runtime/spots.baked.json`), pressed by `script`
    commands `pine.interact` (`PINE_ACT`: talk 0, logs 1 / 2, glass 3, flint 4, lanterns 5–7, zipline 8, lever-action 9).
    Hale's talk raises his current line's `sets` (engine `lineFor`); the dam on the table's own rules; the zipline on
    ZipRide's law (weapons stowed while riding); the cabin's lever-action owns `owned:lever-rifle` and selects it; the stag's
    walk (`quest/stagWalk.ts`, whose road and lengths the page's StagLead now reads); Hale's night and the dawn on the
    page's `LegacyPineClock` (now with save / load) over the host's day clock; the lantern / zipline / quest feats' facts.
    The entry proof (`runtime/entries.ts`) walks a real capsule 50 m in through all 92 lanes of the grid's world (a fresh
    host of the bake without the standalone page's edge walls, `isPineEdgeWall`).
  - this commit — the entry canyons clear: `world/entryLanes.ts` `inEntryLanes` (generic over the shardfile's entryways:
    a solid whose centre stands in an opening's 8 m × 50 m) gates the boulder and stump scatter in `world/props.ts`; a
    gated slot keeps its draws and its count, so only the four lane-blocking solids left the world (rocks at
    (223.77, −3.37), (−3.57, −204.99), (−218.7, 3.8), the stump at (−233, −3.76)); physics + map rebaked; the entry proof
    passes (92 lanes). Before / after: `progress/shard-platform/sf72-pine/entry-mouths.jpg`. Parity (phone, poses):
    colliders 2421 → 2417, GL buffers −64 B (4 instances), the gate pose −1270 tris (the south rock); cabin and pond poses
    unchanged. The parity baselines (`test/parity/baselines/m5/pine-hollow*`) were not rebaselined.

## Next (Pine headless), in order

1. **The witness** (`test/proof/pine-hollow/`, Sky's `c162fbd6a` / Signal's `witness.ts` as patterns): headless with the
   bands and the day clock, a tape of tick commands only walking the quest from the spawn (Hale, the dam, the pond, up the
   lookout's stair to the flint and the launch, the zipline, the den past Old Blackpaw, the stag after dark, the King in the
   clearing at night, the dawn), a replay from a King mid-fight checkpoint, the ledger from gameplay. The tape is long:
   committed checkpoints with an inputs-hash freshness test. Hash with `canonicalSimDigest` (test/fake/simState.ts,
   `ba9d61dd9`); `expectSameSimSnapshot` already compares canonical state.
2. Honest open items for the witness's list: arrow wind (headless arrows fly in still air); the page's walk-over recovery
   of stuck arrows; the moving spread (headless shoots standing); the dialogue box's reading time and the prompts' line of
   sight / nearest pick (a command names its prompt); ZipRide's law is a copy in `runtime/quest.ts` (the page's rides.ts
   keeps its own); the resin / token / secret / miller / thrall / journal / kill feats are not emitted headless (only the
   lanterns, zipline, quest and the King's); `DeclaredQuests` files the quest fact with the player's id where the page's
   `bindRuntimeQuest` files `wardens-hollow` (a game-layer difference); the night thralls, the millrace errand and the
   lodge are not hosted; the re-fight's amber resin has no item effect; rain wander goals are null headless; the page's
   King record still lives in `pine.bosses` state.
3. The grid admission (`grid-ready`) installs the same world with the standalone edge walls; the grid's world has none.

Plan-State: unchanged.
