# Handoff (sf72-pine) — 2026-10-09, SF72 Pine Hollow headless (runtime/headless.ts + the roster keeper, sf72-pine4)

Coordinator `wildshard-new` pushes. Pine's canonical witness (`test/proof/pine-hollow/`) is UNCHANGED and still fails
closed (`finish` refuses: no entry proof yet).

## Landed

- Bake (`scripts/bake-pine-physics.mjs` → `runtime/physics.baked.json`): ground, 2082 solids, 164 actors, `parked`, herds,
  trees, pieces. Inputs hash `ai/hunt.ts`, `AnimalManager.ts`, Pine's `runtime/index.ts`, `plugin.ts`, `combat/`, `species/`,
  `models/`, `world/`, `data/`: an edit there rebakes in the same commit (hunt.ts / AnimalManager.ts also Driftwood's).
- Herd brain (334031a26), placement in Node (e4616421b), boot roster id for id (a7962acd0).
- **291b5cae4 (sf72-pine4):**
  - `runtime/headless.ts` `prepareHeadlessRuntime`: the baked world (heightfield + solids incl. trimeshes; `ground:false`),
    terrain.bin as the height query and HuntGround, navmesh.bin for paths. Pine admits no shardfile assets, so the trusted
    caller passes both by path (`PINE_TERRAIN_ASSET`, `PINE_NAVMESH_ASSET`) or prepare refuses. (Driftwood instead baked its
    navmesh into `navmesh.baked.json`, 4a218c00d; either is fine — the witness must hand Pine's two bakes.)
  - `runtime/roster.ts` `installPineRoster`: herds → swap → King prewarm (draws + ids only, bodiless, `parked()` keeps their
    recipes) → 4 lair elites (cosmetic-fork yaw, `scripted`, state 'sidestep'). Every roll is checked against the bake.
    Per tick in list order: 'ai' decision clock, elites every frame (`hunt.think` still runs ambient calls / confine on
    them, as the page does), lost.sight + hit wakes, `advanceCharge` with contact as PlayerHurt.creature (`feel.blow`).
    Exact restore = identical install + keeper continuation (stream, brain clock, per-body clocks, memories, herd centres).
  - `engine/physics/navmesh.ts` `Navmesh.datum` (default terrainDatum: the browser still refuses with no level); a
    renderer-free host sets `() => 0` on its instance.
  - The platform `homeKeeper` (4dca8153a) does not fit this roster (placement draws, distance bands, HuntBrain memory,
    swap / prewarm); kept shard-local.

## Next (Pine headless), in order

1. Engine host seam (sf72-host's file, ask the coordinator): the page's body update bands ('half' 60-160 m, 'paused'
   beyond) and the creature motor LOD (motors only within 45 m, released past 55) — the SimHost steps and collides every
   body every tick. Until then the herd bodies' motion differs from the browser far from the player.
2. Split `combat/ctx.ts LaneCharge` into a renderer-free lane (StrikeRunner) + its GroundTell decal; type `EliteGoals`
   over a body / lane interface `AnimalSim` satisfies; headless `EliteScript`s over `EliteBrain` on the roster's elite
   bodies (their `random` from a seeded stream: the page uses Math.random). Touches `combat/` → Pine rebake same commit.
3. One Antler King boss script shared by browser and headless (split antlerKing.ts's BossScript from BossBar / fx / fog /
   LightPool); unpark the roster's `parked()` recipes through `host.spawn` when present. Thralls through the same lane.
4. Witness: headless 10k → replay (King mid-fight) → ledger from gameplay (`pine.progress` facts) → entry proof on the four
   8 m entryways; player weapons (crossbow rows) as declared items. Flip `compatibility.json` only from a real run.

Also open: rain wander goals (`creature.wander-goal`, weather.ts) are null headless; `weapon.fired` / dodge interrupts.

Plan-State: unchanged.
