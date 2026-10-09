# Handoff (sf72-driftwood, part 12) — 2026-10-09, SF72 Driftwood Isle headless

Coordinator `wildshard-new` pushes. Supersedes part 11's "Not done". Driftwood's canonical witness
(`test/proof/driftwood-isle/`) is UNCHANGED and still fails closed (its entry is still `runtime/hybrid.ts`). The next three
steps are written for a Codex lane (non-graphical engineering); none needs a browser except where marked.

## Landed (part 12)

- **The flared sea ramps (pick (c)) + the entry proof**, one commit (see its message): `models/pier.ts`
  (`PierSeaRamp.flare`, `pierHalfWidthAt`), `world/Pier.ts` (`seaFlare`), `world/build.ts`, `world/pierRamps.ts` (the pick),
  the Debug row in `runtime/index.ts`'s `play` (`pierRamps`, Look, reload; `lint/ratchet.json` debugRows 6,
  `lint/shard-coupling.json` driftwood `context.debugRow` 1). Bakes: physics (40 of 2067 solids, ramps only), spots (input
  hashes only), map, navmesh + `runtime/navmesh.baked.json`. Images: `art/driftwood/round-1-pier-ramps/`.
- `runtime/entries.ts` `proveDriftwoodEntries` is the headless plan's `proveEntries`: 92 / 92 lanes; it refuses the old
  straight bake. `finish` no longer refuses for want of an entry proof.
- **When Jake picks** (the plan's needs-pick): delete the `pierRamps` row, `world/pierRamps.ts`, the losing branch in
  `models/pier.ts` (`flare === undefined` paths or the flare paths), `PIER_RAMP_STRINGS`, the ratchet/coupling +1s; if
  straight wins, `runtime/entries.ts` must route the outer lanes differently (it would refuse) and the physics bake reverts.

## Not done (in order, Codex steps)

1. **Night respawns** (port `quest/Ecology.ts`'s `RespawnQueue` to headless). Read `quest/Ecology.ts` and
   `runtime/keeper.ts` (its practice crab return is the pattern) first.
   - A dead creature queues a respawn with its delay drawn from the `spawn` stream exactly as the page draws it.
   - It respawns only when the player is ≥ 60 m away and out of sight (the page's rule, same order of checks).
   - The sailor returns only at night (`host.dayClock.night`), in the wreck hold (`bake.habitat.hold`, its floor via
     `bake.holdFloorAt`); land fauna spawn near their herd home with herd membership restored (`bake.herds`).
   - New ids from the same `EntityIds` allocator the practice crab uses; the queue goes into the keeper's continuation
     (snapshot / restore exact; one restore checkpoint per test, `expectSameSimSnapshot`).
   - Test: kill a boar, walk 60 m away, run until its delay, assert it is back with the page's herd; kill the sailor by
     day, assert no respawn until night. Keep it < 1/3 of its timeout under `--coverage`.
   - If `src/engine/ai/hunt.ts` or `AnimalManager.ts` changes, rebake Pine, Driftwood and Nalati in the same commit.
2. **The swords on the new inputs** (`a0aa16128`), in `runtime/swords.ts`: the dodge wake on `player.dodge`; the heavy
   swing from the held `heavy` command; the lunge via `host.dashTo` + `sweptLunge`. Mirror the page's numbers
   (`src/game/weapons/starterMeleeProfile.ts`, `starterMoves.ts`); extend `headless-runtime.test.ts`'s sword cases.
3. **The witness** on `runtime/headless.ts`: point `test/proof/driftwood-isle/run.mjs`'s entry at the trusted
   `runtime/headless.ts`, bands as Sky's (`c162fbd6a`): headless 10k, replay with a captain mid-fight checkpoint, ledger
   from gameplay; committed checkpoints with a freshness guard if the tape is long; flip `compatibility.json` only from a
   real run. `finish` now runs the entry proof (≈ 30k capsule steps, well under a second).

## Map notes

Entries: socket 15 m flat (y 0) + landing 1.5 m; the ramp starts 15 m in (sand-level slab at 14.8–15 m) and tops out at
24 m in, 1.2 m up; pier deck 4 m (south), jetties 3 m. The edge walls' inner face is 0.8 m inside the cell edge. Tide
puzzle: plate b (144.9, 9.9); barrel home (147.5, 3.5); three reef crabs within 20 m of plate b; the 1.7 m / 1.9 m blocks
leave a wedge lane at z 8.25–9.4.

Plan-State: unchanged.
