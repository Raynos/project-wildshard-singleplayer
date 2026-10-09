# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (the King's record, the crossbow; sf72-pine9)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed (`finish` refuses: no entry proof yet).

## Landed

- Bake (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): inputs hash `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `runtime/fauna.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`: an edit there rebakes
  in the same commit. `runtime/king.ts`, `runtime/roster.ts`, `runtime/headless.ts`, `runtime/weapons/` are not inputs.
- Earlier lanes: herd brain, boot roster, elites, live spawns, the roar's stun, the shared King fight (`combat/kingFight.ts`)
  on `installBossRow`, the day clock.
- **sf72-pine9:**
  - `797ad880b` — the King's record on the shard's flags (`KING_RECORD`: `dead:king` beaten, `paid:king` the Warden's
    Longbow taken at the first fall, no orb pickup headless), his ledger fact `pine.feat.king / king:1` on every win
    (`PineInstall.fact` → the `fact` effect); a fallen King goes by day and the next night is a fresh body
    (`roster.spawnLoose`: the declared row spawned live, out of the list, the next entity id); a parked King's `hidden`
    rides the fight's continuation.
  - The King's damage rule headless (the page's `damageMul` at the pipeline's order 50: bark ×0.25, ribcage ×3 open /
    ×0.6 shut, beat / dormant ×0.01). The ribcage is a ball on his chest (¾ along his body capsule, RIB_R 0.36 × scale ×
    1.15): headless has no chest bone.
  - The crossbow as a real projectile item (`runtime/weapons/headlessCrossbow.ts`): a player command's `attack` fires at
    that body; the page's profile, flight law, hip spread (host gameplay stream), 4 substeps, world sweep + glance,
    hitboxes from the host bodies' head ball / body capsule (hidden bodies — the Ghost Stag's fade, a parked King — take
    no bolt), the damage model through the host pipeline, reload / auto-reload, locked through the King's intro; bolts in
    flight restore exactly. Installed before the roster (step order = registration order; a restoring roster adds live
    spawns at install), so bolts fly before creatures move in a tick (the page: after).

## Next (Pine headless), in order

1. The lever rifle and the longbow (the longbow's draw on `heavy: {targetId?}` held, a0aa16128); a weapon switch command.
   `boltStep` duplicates Crossbow.ts `boltFlightStep` (that module imports views); split the flight law into a
   renderer-free module both import.
2. The quest + facts (the page's quest/index.ts raises `dead:king` on his kill; headless now sets it on the record).
3. The entry proof, then the witness: headless with bands + day clock, replay with a King checkpoint, ledger from
   gameplay (committed checkpoints + inputs-hash freshness test like Sky's `c162fbd6a` if the tape is long).

Also open: the re-fight's three amber resin (no item effect); rain wander goals null headless; the page's King record
still lives in `pine.bosses` state (not flags).

Plan-State: unchanged.
