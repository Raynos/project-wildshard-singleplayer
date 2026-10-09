# Handoff (sf72-nalati7) — 2026-10-09, SF72 Nalati Grasslands headless, part 7

Coordinator `wildshard-new` pushes. Supersedes `sf72-nalati6.md`'s "Not yet" item 1. Nalati's canonical witness
(`test/proof/nalati-grasslands/`) is UNCHANGED and still fails closed (`compatibility.json` not flipped).

## Landed

- **Engine seam** `eaced021e` (+ fix `f63acf774`): `Wind.snapshot()` / `restore()` (`WindState`), `new Wind(strengthBox?)`
  (a `#private` box, so recipes that serialize the world's wind keep their bytes); `windStrength` moved to the renderer-free
  `src/engine/world/windStrength.ts` (wind.ts imports the shader patches, which the sim loader refuses).
- **The storm on the host step.** `world/weatherStep.ts` is the page's per-frame weather rule, renderer-free, shared by
  `world/installWeather.ts` and the host: `steppeStorm(seed, world)` (stormFrom set), `stormWind` / `stepStorm` (the state
  machine, the Storm Titan's held storm, the wind it asks for), `stormEnv` (light + storm), `windEnv` (the creatures' wind;
  runtime/state.ts's Wildlife frame uses it). The light rule moved out of the renderer module: `look/wildLight.ts`
  (`lightLevel`, `wildLight`). `SteppeStorm.snapshot()` / `restore()` (`StormState`; refuses an armed strike holding a tree
  reference). `runtime/headless.ts installNalatiWeather`: its own `Wind`, the storm on the page's `SEED`, stepped in the
  page's frame order after the trample step (wind.update, then the storm after the day clock), writing light / storm / wind
  into the groups' env (`installNalatiGroups` now takes `env`); `nalati.weather` adapter (wind, storm, ask), exact restore.
- Rebakes (world/ and runtime/state.ts are inputs): `runtime/physics.baked.json` on candidate `bcd5e8642` (bodies, herds,
  floor, solids, trees, groups, grass byte-identical; only the two saddled horses' first-sight `_graze` / yaw move, which
  vary run to run with frame timing: two bakes of one build differ the same way) and the map (`look/map.baked.json`,
  0.04 % of pixels moved, bake noise).

## Fail-closed (honest)

The lightning's world refuses when first read (`unmodelled`): the exposed things need tree TOPS (the bake has only trunk
circles `[x, z, r]`, not `y + height`) and the yurts (the page's `yurtsOf(pois.colliders)`), and the player's crouch /
mount / shelter. Clear and building never read it; the gust front's first GET LOW check (≤ 0.25 s in) does. No boss holds
the storm (`hold` off): the Golden King's dungeon and the Storm Titan aren't hosted. The storm's first phase change is
12–18 min in, so a 10k-tick witness never reaches it.

## Next (in order)

1. Bake the tree tops (the forest's `y + height`) and the yurt circles, then wire `exposed` / `player().sheltered`; the
   strike's `scare` and `hurt` (60) then need the host's wildlife and player damage.
2. The wildlife's trample pushes (nalati6 item 2), tick the groups, the flock / dog / raid director, the elites on
   `EliteCore` (Kokbori / Qyran / Qara Batyr on the clock and storm), the bosses on `installBossRow`, the sabre on
   `sweptMeleeCore` (the heavy / jump / dodge inputs are `a0aa16128`), the witness.

Plan-State: unchanged.
