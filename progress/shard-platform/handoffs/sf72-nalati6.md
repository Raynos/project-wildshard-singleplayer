# Handoff (sf72-nalati6) — 2026-10-09, SF72 Nalati Grasslands headless, part 6

Coordinator `wildshard-new` pushes. Supersedes `sf72-nalati5.md`'s "Not yet" item 1 and the clock half of item 2. Nalati's
canonical witness (`test/proof/nalati-grasslands/`) is UNCHANGED and still fails closed (`compatibility.json` not flipped).

## Landed (this slice, two commits)

- **The trample map on the host step and in the snapshot.** `TrampleField.snapshot()` / `restore()`
  (`src/game/systems/looks/trample.ts`, `TrampleState`: the flattened texels as `[index, amount, angle]` triples, the window,
  the flags, the 10 Hz recovery clock; refuses with tracked movers). The player's trail is one law,
  `look/trampleMovers.ts pushPlayerTrail` (the page's `look/grass.ts update` now calls it: no page change).
  `runtime/headless.ts installNalatiTrample`: an `onStep('nalati.trample')` in the page's frame order (the player's push,
  then `update`, so later pushes this tick land in this tick's window, as the page's wildlife pushes land after the grass),
  with its trail and map as the `nalati.trample` adapter. `NalatiGroups.grass` exposes the field and map.
- **The page's day clock.** `install` calls `host.useDayClock(nalatiDayClock())`: `clockForSun(NALATI_SUN)` as
  world/installWeather.ts builds it (the manifest has a sun, so the page does NOT use plain `steppeClock()`; it starts at
  16.22 h, the day phase). `NALATI_SUN` is test-pinned to `manifest.ts sky.sun` (the manifest loads images, not Node).
  The roster's elite rules read the clock's boot phase (`nalatiBootClock`), storm false. A level with `day.start` at dusk
  refuses at install ("does not model the kokbori elite"): honest fail-closed until the elites are hosted.
- Tests: `test/game/trample-state.test.ts`; `test/shards/nalati-grasslands/headless-runtime.test.ts` (the trail fresh under
  the feet, half recovered 10 s back, stood up 25 s back inside the window; the groups' grassHeightAt reads it; the restore
  carries the trail; the host's hour after 2000 ticks equals a 60 Hz page clock's, golden).

## Not yet (next, in order)

1. **The storm** (world/Weather.ts `SteppeStorm`, renderer-free over `Rng` + engine Weather): host it as a `SimStateAdapter`
   on the host step reading `host.dayClock`; its world ports are the baked trees (`physics.baked.json trees`) for
   `exposed`, the grid's height, the host player. It sets the wind targets (`steppeWind`), `wildEnv.storm` and with the clock
   `wildEnv.light` (installWeather.ts `lightLevel`): move that light rule out of the renderer module first.
2. **The wildlife's trample pushes** (creatures/wildlife.ts: every moving wolf / horse / dog within 80 m, after the grass's
   update): share the rule with wildlife.ts in one module; that edits a bake input (`creatures/`), so rebake in that commit.
   Only matters once bodies move (item 3).
3. Tick the groups (nalati4 item 2), then the flock / dog / raid director, the elites on `EliteCore` (including Kokbori /
   Qyran / Qara Batyr on the clock and storm), the bosses on `installBossRow`, the sabre on `sweptMeleeCore`, the witness.

The day clock reaches golden at ~18 s and dusk at ~3.3 min from boot: a 10k-tick witness from boot crosses golden, not dusk.

Plan-State: unchanged.
