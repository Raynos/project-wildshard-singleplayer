# Handoff (sf72-nalati4) — 2026-10-09, SF72 Nalati Grasslands headless, part 4

Coordinator `wildshard-new` pushes. Supersedes `sf72-nalati3.md`'s "Not yet" list. Nalati's canonical witness
(`test/proof/nalati-grasslands/`) is UNCHANGED and still fails closed (`compatibility.json` not flipped).

## Landed (this slice)

- **The group ports are generic** (`runtime/groupPorts.ts`): `nativePackPorts` / `nativeHerdPorts<A extends AnimalSim>(host,
  world)`; `NativeGroupWorld` carries the wild view, the ground's slope, the stampede pass-through and the pack lookup; the
  page passes `PAGE_GROUP_WORLD` (wildEnv, the installed terrain, the body's motor, `Pack.of`): no page behaviour change.
  `creatures/env.ts`'s senses take the view they read as a last argument (`wildEnv` by default).
- **The bake reads the groups' tick 0** (`scripts/bake-nalati-physics.mjs`): every body's memory at first sight and each
  declared group's `snapshot()` (`physics.baked.json` `spawns[].mem`, `groups`). It now pins the harness seed to the level's
  (`window.__wildshardHarness = { seed: 0x4a1a }`): a live page salts its random streams per load (session.ts `pageSeed`),
  so the 'ai' draws only compare under the pin. Rebaked on candidate `f85d4f971`: actors, herds, floor, solids, trees and
  pieces byte-identical; the shepherd's horse's first-sight heading moves by 2e-4 rad between runs (his ring turns him
  before first sight; the test's one-frame tolerance holds).
- **`runtime/groups.ts` `installNalatiGroups`** (called from `headless.ts` install): the pack (`PackBrain`, home at its layout
  spot), the wild herd and Argymaq's herd (`HerdBrain`, adopting him), seeded on the host's 'ai' stream in the page's order:
  pack 15 draws, herd 1, then two draws from unmodelled systems (the raid director's first-raid clock,
  `creatures/sheepRaid.ts raidT = rand(FIRST_RAID)`; the Golden King's `reset(0)` burst cooldown), then Argymaq's herd 1.
  The saddled horses (herd −1) are `owned`. **Test:** all three group snapshots equal the page's byte for byte and every
  body's memory equals the page's (minus the horses' pose easing `_*`, the elites' `noHeadBar`, Aqbars' `low`).

## Not yet (next, in order)

1. **The groups' wild view**, before they may tick (`nalatiHeadlessEnv()` refuses each of these today):
   - the grass field: `grassBaseHeightAt` reads the page's terrain, splat and `activeLevel()` (game/systems/looks/grassField.ts).
     Either bake its 4 m lattice's height channel (126²; expose it through `debug.expose`) plus a pure `trailGrass` with the
     authored bed, or make the field renderer-free over injected samplers;
   - the trample map (`grassHeightAt` = base × (1 − 0.85 × trample), pushed by every mover within 70 / 80 m of the player,
     recovering over 20 s; game/systems/looks/trample.ts `GrassTrample`);
   - the wind (`steppeWind` `Wind`, updated per frame, targets set by the weather) and the day's light (installWeather.ts).
2. Then tick them: `thinkWolf` / `thinkHorse` / `actWolf` / `actHorse` on `host.brainDt` / `host.bodyDt`, a `PackContext` from a
   `HuntBrain` (navmesh steer, `pathYawFor`, `confine`; memories adopted at each body's roster draw state), `claim` /
   `mayAttack` from `NalatiGroups`, the stampede pass-through on the host's motor, and a snapshot adapter for the brains.
3. The flock, its dog and the raid director (move `FIRST_RAID` / `NEXT_RAID` to `creatures/raidClock.ts`; that rebakes).
4. The elites on `src/game/eliteSystem.ts` `EliteCore` (`7e9bf1e0b`), the Golden King and Storm Titan on `installBossRow`,
   the sabre on `sweptMeleeCore`, the bow / spear as declared items; then Kokbori / Qyran / Qara Batyr and the day clock.
5. Witness: headless 10k → replay → ledger → entry proof.

Plan-State: unchanged.
