# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (the Antler King, the day clock; sf72-pine8)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed (`finish` refuses: no entry proof yet).

## Landed

- Bake (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): inputs hash `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `runtime/fauna.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`: an edit there rebakes
  in the same commit (build the candidate with `scripts/serve-build.sh --rev <candidate>`, bake with `--url=… --revision=<candidate>`).
- Earlier lanes: herd brain, boot roster id for id, the elites (seeded streams, EliteCore, shared `combat/eliteScripts.ts`), live
  creature spawns (an elite's respawn, the Imperial Bull's rivals), the roar's stun.
- **sf72-pine8:**
  - Tests: restore checkpoints serialise against the fresh-world physics basis; bugle + rivals' charge are one test; live-spawn
    budgets 30 s (f8a1e8caf). The rest of each restore test is the engine's decode re-validating the 8.4 M physics array
    through valibot (reported to the coordinator: `snapshotData.ts decodeSnapshotData`, not Pine's file).
  - **One Antler King fight** (`combat/kingFight.ts` `AntlerKingCore`): the BossScript, his moves (KingGoals), root rings,
    lanterns, thralls, soft wall, leash, beat hp lock, ribcage multiplier, presence rule (`kingPresence` / `kingDormant` /
    `kingTick`), and a continuation (`fightState` / `restoreFight`, bodies by entity id). The page's `AntlerKingFight`
    (runtime/antlerKing.ts) is now this plus its views (hooks: glow, lanterns, waves, puffs, light, fog wall, impacts). His two
    `Math.random` calls are the level seed's `pine.king.call` / `pine.king.charge` streams (a small gameplay change: thralls
    are deterministic per seed, same distributions). `test/shards/pine-hollow/king-fight.test.ts`.
  - **Headless King** (`runtime/king.ts` `installPineKing`, installed between the elites and the roster): `installBossRow`
    over the shared fight; his body is the parked prewarm creature:161 made real out of the roster's list
    (`roster.adoptParked`, no draws); thralls are live spawns ('thrall' recipes from `bake.parked`), owned like the elites'.
    The roster's restoring install now reinstalls every saved body the boot did not make in the host's entity order, listed or
    not (`roster.actor(id)` finds either).
  - **Day clock** (b109b957c): `installPine` installs `host.useDayClock(new DayCycle(PINE_DAY))`; dusk / night come from it
    unless a test holds them. Test: a level started just before dusk hears the bull bugle on his own, exact restore.

## Next (Pine headless), in order

1. King gaps: his record on the shard's flags + reward (in memory now); a fallen King's next night (refused: `makeKing`
   throws after his first body); the ribcage weak point / bark ×0.25 on the player's hits (needs the weapons; headless has no
   look, so `onRibs` is false); the King in the page's manager list while present (headless keeps him unlisted: his species
   thinks nothing, so no draws differ, but the manager's legendary check for another King spawn would).
2. Player weapons as real projectile items (crossbow / lever rifle / longbow), with the Ghost Stag's fade hiding its hitbox.
3. The quest + facts, the entry proof, then the witness (headless 10k with bands, replay with a King checkpoint, ledger).

Also open: rain wander goals (`creature.wander-goal`, weather.ts) are null headless; `weapon.fired` / dodge interrupts.

Plan-State: unchanged.
