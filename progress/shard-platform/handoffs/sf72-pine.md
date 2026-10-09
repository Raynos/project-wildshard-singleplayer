# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (the elites under the game's elite rules; sf72-pine6)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed (`finish` refuses: no entry proof yet).

## Landed

- Bake (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): inputs hash `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`: an edit there rebakes in the same
  commit (build the candidate with `scripts/serve-build.sh --rev <candidate>`, bake with `--revision=<candidate>`).
- Earlier: herd brain, placement in Node, boot roster id for id, `runtime/headless.ts` + `runtime/roster.ts` (291b5cae4); the
  elites' seeded streams, the bare `Lane`, the roster on the host's bands (sf72-pine5).
- **sf72-pine6:**
  - `@wildshard/game/eliteSystem` `EliteCore<S>`: the elite system's rules, renderer-free (spawn rule, aware / engaged / leash,
    phase 2 at 50 % + the 1 s beat, banner arming, death → play-time respawn, retire, discovery), view moments as optional
    hooks, persistence injected (`memoryElitePersistence()` for a host). `game/Elite.ts` `Elites` is EliteCore + the bar,
    banner, orb and skulls (API unchanged; Nalati untouched).
  - `combat/eliteScripts.ts`: the four elite scripts generic over a `PineEliteBody` and a `PineEliteWorld<B>`; `elites.ts` is
    the page's world (decals, puffs, dirt, voices, orb model). Each script saves `fields()` / `lanes()` / `rngs()`.
  - `runtime/elites.ts` `installPineElites`: the same scripts + EliteCore on the roster's four lair bodies (first spawn adopts
    the roster body), step `pine.elites` before `pine.roster`, a blow via `host.combat.hit` as `ctx.hurt` files it, one
    continuation (clocks, records, entries, scripts with lanes + stream states). `Lane.snapshot()/restore()`.

## Next (Pine headless), in order

1. Live creature spawns: the Imperial Bull's rivals (`host.spawn` drawing the creature stream as `animals.spawn` does, no
   bake row) and an elite's respawn after 20 min; both refuse today (`world.spawn` throws), and a restore must re-create them
   at install. Rivals need dusk: there is no headless day-night clock (dusk / night read 0, so he never bugles).
2. Roar stun on the headless player (no host stun effect; `world.stun` is silent), the Ghost Stag's fade hiding its hitbox.
3. One Antler King boss script over `installBossRow` (58d6abc9e), thralls through `Lane`, antlerKing.ts's two Math.random calls
   seeded; then the witness (headless 10k with bands → replay with a King checkpoint → ledger from gameplay → entry proof),
   player weapons as declared items. Flip `compatibility.json` only from a run.

Also open: rain wander goals (`creature.wander-goal`, weather.ts) are null headless; `weapon.fired` / dodge interrupts.

Plan-State: unchanged.
