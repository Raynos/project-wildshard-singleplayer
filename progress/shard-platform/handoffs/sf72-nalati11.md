# Handoff (sf72-nalati11) — 2026-10-09, SF72 Nalati Grasslands headless, part 11

Coordinator `wildshard-new` pushes. Supersedes `sf72-nalati10.md`. Written for a Codex lane (Jake: code moves to Codex).
Nalati's canonical witness (`test/proof/nalati-grasslands/`) is UNCHANGED and still fails closed (`compatibility.json` not
flipped; the runtime's `finish` refuses).

## Landed in this part (one commit; its SHA is in the coordinator's report)

- **The flock headless** on the engine's `FlockBrain` (`src/engine/ai/flock.ts`, unchanged). The page's default flock
  (`creatures/flock.ts`) runs the same spans as the frozen shipping copy (`test/fixtures/flock-oracle/shipping.txt`, which
  differs only by the declared-controller branches), and `test/shardfile-crowd-runtime.test.ts` proves FlockBrain equals that
  oracle. The rows come from one helper for the page's declared crowds and the host: `creatures/flockRows.ts`
  `nalatiFlockRows(seed)`, on Wildlife's seeds (`SEED + 101·i`).
  `runtime/headlessCreatures.ts` steps each flock inside Wildlife's frame (after the wolves refresh and `pushWildMovers`, before
  the stampede scare), with Wildlife's own smoothed player speed (a 14 m/s cap, a 6 /s ease). Its continuation and the speed
  are in the `nalati.creatures` adapter (`flocks`, `wild`).
- **The sheepdog on one rule**: `creatures/sheepdogBrain.ts` `thinkSheepdog` (renderer-free, generic over AnimalSim), reading a
  `DogFlock` port: `{ flock, wolves, ai, bark }`. The page's `Flock.setDog` registers its flock, `dogWolves` and the app's 'ai'
  stream. The host registers its FlockBrain, Wildlife's living wolves and `host.rng.stream('ai')`. `species/sheepdog.ts` now
  loads in Node: the hunting brain has its row and adopts the dog where the page does.
- **A strike's scare**: `installNalatiWeather` takes a `scare` port, which `prepareHeadlessRuntime` binds to the creatures'
  `wildScare`. This is Wildlife.scare: packs within 20 m break, herds within 60 m stampede, a flock within 60 m bolts, then the
  'scare' signal.
- Physics rebaked from a served build of a worktree commit whose bake inputs equal the landed commit's (revision `e12f8dcef`).
  Only the inputs moved, plus the same two render-timed rows as part 10 (creature:21 `_graze`, creature:23's yaw).
  Graph: nalati-grasslands → engine 780 → 782 (approved).

Gates on the candidate: full vitest on the rebased private worktree, typecheck, coupling / ratchet / graph guards and oxlint
on every touched file. Boot smoke passed 4/4, and the Nalati physics walk ended with 0 stuck in 12 legs.

## Still fail-closed (next, in order, for the Codex lane)

1. **The raid director and the shepherd's ring** (`creatures/sheepRaid.ts`, `creatures/raidClock.ts` `legacyRaidTick`). Do
   this first, because the ring draws `app.rng.stream('ai').next()` every page frame while it patrols. Until it is hosted,
   every host 'ai' draw (the dog's and the groups') runs on a stream the page has advanced further. Move `SheepRaid.ride`'s
   decision (no rider mesh, no `app.clock` cosmetics) into a renderer-free rule shared by both, the way `sheepdogBrain.ts`
   was done. The page's frame order is wildlife → stealth → night → **ride** (the raid's `update`) → `engine.creatures.update`,
   so on the host run it after the flocks and before the think loop. A raid that starts spawns the valley pack mid-session
   (`wildlife.spawnPack`): use `host.spawn` + a new `PackBrain` (groups.ts pattern), with its continuation saved. Its first
   raid timer is the draw `groups.ts` already takes; save `raidT`, `pendingT`, `spawned`, `cracks` and the shepherd's
   `restT` / `patrolA`.
2. **Bake the flock's tick-0 state**: in the bake's rAF hook, read `wildlife.flocks[i]`'s `positions` / `headingOf` / `cx` /
   `cz`. Then test the host's FlockBrain against it at tick 0. Today the parity rests on the oracle and identical seeds.
3. The marmots (`creatures/marmots.ts`: a whistle raises herd and pack awareness), Aqbars' and Argymaq's elite brains (on
   `EliteCore`), and the `target.dodge` wake (see the frame-order caveat in sf72-nalati10.md).
4. The mounted player (`ride/`, Mount) and crouch. Then the bosses on `installBossRow` and the sabre on `sweptMeleeCore`.
5. The witness from a committed checkpoint, with `canonicalSimDigest`.

Cost note: the 2k walk test in `headless-runtime.test.ts` took about 3.4 s locally under load (about 0.9 s before). A probe
put the flock's share at roughly 0.4–0.9 s over 2k ticks (noisy machine). Check its `--coverage` time against the
DEPLOY.md budget.

Plan-State: unchanged.
