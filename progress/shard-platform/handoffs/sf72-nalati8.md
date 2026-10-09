# Handoff (sf72-nalati8) — 2026-10-09, SF72 Nalati Grasslands headless, part 8

Coordinator `wildshard-new` pushes. Supersedes `sf72-nalati7.md`'s "Fail-closed" section and its next step 1. Nalati's
canonical witness (`test/proof/nalati-grasslands/`) is UNCHANGED and still fails closed (`compatibility.json` not flipped).

## Landed

- **The lightning's world headless.** The bake (`scripts/bake-nalati-physics.mjs`) now captures the forest's `tops`
  (each spruce's `y + height`, parallel to `trees`; the bake asserts the hunting brain's forest is the weather's) and the
  `yurts` (`NalatiWeather.yurts`, the page's own list). `world/weatherStep.ts` holds the shared rules the page and the host
  run: `yurtsOf` (moved out of installWeather.ts), `yurtShelters`, `exposeTrees`. Engine `TreeGrid` is generic over the
  tree record (type-only; coordinator approved the +1 nalati → engine edge), so `nalatiLightningGround(bake)` buckets the
  baked spruces exactly as the page's `forest.nearby` (its 16 m cells, its order). `installNalatiWeather` reads it: the
  exposed trees (no live `ref`, so an armed tree strike is a saveable plain value), the player as the page's `player()`
  builds it (the host's position; crouched / mounted from the wild view, false since the host has no crouch or horse;
  sheltered beside a baked yurt; never indoors, never held: no dungeon, no Storm Titan hosted). A strike within 4 m would
  hurt through `host.combat.hit` as the page's `hurt` does (`env.lightning`, the `weather.damage` ask).
- Rebakes: `runtime/physics.baked.json` on candidate `c65dad635` (only `tops` / `yurts` new; the two saddled horses'
  first-sight spawns move run to run as before) and the map (`look/map.baked.json`, 0.4 % of pixels by > 8 levels, spread
  evenly: bake noise).

## Fail-closed (honest)

The gust front and the storm's GET LOW now run on the real world (test: under the camp slope no warning, out on the flat it
trips). A **landed strike's scare refuses** (`storm.onStrike`): Wildlife's `scare` reaches the flock (not hosted) and the
rider's horse. The strike callbacks run scare before the player hit, so the hurt is wired but unreachable until the scare
is modelled. Strikes land only in the storm phase (12–18 min in), so a 10k-tick witness never reaches it.

## Next (in order)

1. The wildlife's trample pushes and tick the groups (nalati6 item 2), then the flock / dog / raid director (which also
   unblocks the strike's scare: packs `scare(x, z, 20)`, herds `stampede`, the flock, `onEvent('scare')`).
2. The elites on `EliteCore` (Kokbori / Qyran / Qara Batyr on the clock and storm), the bosses on `installBossRow`, the
   sabre on `sweptMeleeCore` (`a0aa16128` heavy / jump / dodge), the witness (start a storm-covering one from a committed
   checkpoint or a level clock / storm start, Sky's `c162fbd6a` pattern).

Plan-State: unchanged.
