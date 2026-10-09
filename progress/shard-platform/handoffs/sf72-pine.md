# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (the three weapons and the swap; sf72-pine11)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed (`finish` refuses: no entry proof yet).

## Landed

- Bake (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): inputs hash `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `runtime/fauna.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`: an edit there rebakes
  in the same commit. `runtime/king.ts`, `runtime/roster.ts`, `runtime/headless.ts`, `runtime/weapons/`, `weapons/` are not inputs.
- Earlier lanes: herd brain, boot roster, elites, live spawns, the roar's stun, the King's fight on `installBossRow`, the day
  clock, the King's record on the flags (`797ad880b`), the headless crossbow (`dddb490ed`), one renderer-free home per
  ranged law (`5cf7506c7`: `weapons/crossbow/flight.ts`, engine `combat/projectileFlight.ts`, `weapons/leverAction.ts`).
- **sf72-pine11 (this commit):**
  - `runtime/weapons/headlessLoadout.ts`: the `script` command `pine.weapon` (value 0 crossbow, 1 lever, 2 longbow), owned:
    crossbow always, lever on flag `owned:lever-rifle` (`LEVER_FLAG`; the cabin pickup is not headless, a tape / test sets it),
    longbow on `paid:king`; EquipmentService's 0.25 s out (held changes) + 0.25 s in, a pick mid-swap finishes it first;
    `live(slot)` = held && !swapping && !king.locked(). Steps before the weapons.
  - `runtime/weapons/headlessLever.ts`: `LeverAction` with its own 21-round reserve, Firearm.tryFire's template, the page's
    hitscan (hip 0.96°, √ radius, 320 m, ×1.5, tags `weapon.lever`), auto reload 0.35–5 s after a dry pull, held only.
  - `runtime/weapons/headlessLongbow.ts`: engine `BowDraw` on the HEAVY hold (`blocked = !live || arrows <= 0`), loose at
    full only, aimed at the hold's last named body (else the player's facing), 0.3°, 32 + 30 m/s from 0.55 m, the arrow's
    law (`projectileFlightStep`, numbers in the new renderer-free `weapons/longbowFlight.ts`, which longbowView /
    longbowProfile now spread), 2 cm ball, glance 0.03 / 0.35 / 0.25 / 9 then rests, max(1, round(blow × 1.35)), 20 arrows.
  - Engine `combat/bowDraw.ts`: `BowDrawState` + `save()` / `load()` (approved).
  - `installPine` takes `heavy` / `pick` beside `shots`; the trusted runtime reads them from commands (player `heavy`,
    `script` `pine.weapon`). Tests: three new in `test/shards/pine-hollow/headless-runtime.test.ts` (~1 s each under coverage).
  - **Arrow wind, decided: still air headless (known gap).** Not moved to a sim clock: the page's arrow gusts read
    `windGustAt`, i.e. `uWindTime` (the render clock) AND `uGust`, which Pine's rain raises through `windBoost` (the page's
    weather, not headless); and the page integrates arrows on the render frame's dt anyway, so a sim-clock wind would not make
    a browser arrow's path frame-independent. A real fix is the page's weather on the host plus arrows on the fixed step.
  - Also not owned: the page's walk-over recovery of stuck arrows (70 %); the moving spread (headless shoots standing).

## Next (Pine headless), in order

1. **The quest + facts**: `PINE_QUESTS` (data/quests.ts, the seven-step `WARDENS_HOLLOW` chapter, `onComplete` fact
   `pine.feat.quest`) on `SimLevel.quests` or a shard quest module like Signal's `installSignalQuest` (script commands for
   the NPC / pickup interactions, the cabin's lever pickup setting `LEVER_FLAG`); the page's quest/index.ts raises
   `dead:king` on his kill, headless sets it on the record (`KING_RECORD`).
2. The entry proof, then the witness (bands + day clock, a King checkpoint replay, ledger from gameplay; committed
   checkpoints with an inputs-hash freshness test like Sky's `c162fbd6a` if the tape is long; see `test/proof/far-reach/`).

Also open: the re-fight's three amber resin (no item effect); rain wander goals null headless; the page's King record
still lives in `pine.bosses` state (not flags).

Plan-State: unchanged.
