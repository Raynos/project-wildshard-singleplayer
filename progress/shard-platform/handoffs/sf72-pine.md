# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (elites seeded, the bare lane, body bands; sf72-pine5)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed (`finish` refuses: no entry proof yet).

## Landed

- Bake (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): inputs hash `ai/hunt.ts`, `AnimalManager.ts`, Pine's
  `runtime/index.ts`, `plugin.ts`, `combat/`, `species/`, `models/`, `world/`, `data/`: an edit there rebakes in the same
  commit (build the candidate with `scripts/serve-build.sh --rev <candidate>`, bake with `--revision=<candidate>`).
- Earlier: herd brain, placement in Node, boot roster id for id, `runtime/headless.ts` + `runtime/roster.ts` (291b5cae4).
- **sf72-pine5:**
  - `combat/eliteStreams.ts` `pineEliteStreams(id, seed = 1337)`: `pine.elite.spawn.<id>` (one draw a spawn) and
    `pine.elite.<id>` (wander goals + every fight roll) from the level seed alone. The page's EliteScripts (combat/elites.ts)
    and the headless roster both use it: the elites are deterministic per seed (no Math.random, no page salt).
  - `combat/lane.ts` `Lane<B extends LaneBody>`: the renderer-free lane charge; `ctx.ts LaneCharge` = Lane + GroundTell decal.
    `EliteGoals.ts` is generic over a LaneBody + Lane (Animal and AnimalSim satisfy it); `pineContact` takes a StrikeActor.
    `runtime/KingGoals.ts` `AntlerKingGoals<B>` likewise over `KingGoalEnv<B>` + `Lane<B>` (type-only: emitted JS unchanged).
  - The roster runs on the host's distance bands (3d68396a2): `useBodyBands` at install (scripted / sidestep / driven →
    'always', else 'ai'; the body LOD on), decisions on `host.brainDt(id, urgent)`, charges on `host.bodyDt(id)`. Pine's copy
    of TickScheduler.due is gone; roster continuation is version 2 (the band clocks ride SimSnapshot.bands).

## Next (Pine headless), in order

1. Headless elite scripts: a view-free elite system (game/Elite.ts's engage / aware / leash / phase-2-at-50 % / 20-min
   respawn state machine is renderer-tied: split its state from the bar, banner, drop and minimap, or keep a shard-local
   copy) + per-elite scripts over `EliteBrain<HuntBody>` on the roster's four elite bodies, each `random` / `next` from
   `pineEliteStreams(id, host.level.seed).fight`, a bare `Lane` per charge, Blackpaw's ring as pure contact timing, the
   Ghost Stag's fade as `hidden` + no hitbox. The Imperial Bull's rivals spawn through `host.spawn` and draw the creature
   stream (`rolls`), as `animals.spawn` does on the page. Save the streams' states in the roster continuation.
2. One Antler King boss script over `installBossRow` (58d6abc9e): split antlerKing.ts's fight (waves, lanterns, thralls,
   arena wall, shield = the beats) from BossBar / fx / fog / LightPool; a headless `AntlerKingGoals<HuntBody>` subclass;
   unpark the roster's `parked()` recipes through `host.spawn`; thralls through `Lane`. antlerKing.ts still has two
   Math.random calls (thrall placement angle, thrall charge onset): move them onto a seeded stream with it.
3. Witness: headless 10k with bands → replay (King mid-fight) → ledger from gameplay (`pine.progress` facts) → entry proof
   on the four 8 m entryways; player weapons (crossbow rows) as declared items. Flip `compatibility.json` only from a run.

Also open: rain wander goals (`creature.wander-goal`, weather.ts) are null headless; `weapon.fired` / dodge interrupts.

Plan-State: unchanged.
