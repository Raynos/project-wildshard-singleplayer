# Handoff (sf72-nalati9) — 2026-10-09, SF72 Nalati Grasslands headless, part 9

Coordinator `wildshard-new` pushes. Supersedes `sf72-nalati8.md`'s next step 1 (first half). Nalati's canonical witness
(`test/proof/nalati-grasslands/`) is UNCHANGED and still fails closed (`compatibility.json` not flipped).

## Landed

- **Engine seam `b96db5aff`**: `SimHost.useBodyStep({ before, after })`, hooks around each stepping body in the host's
  order (the page manager's per-body act → move → charge contact). Unused by current hosts; Sky's checkpoint manifest
  regenerated (inputs hash only).

## Candidate, not landed: `27c958e45` (on main `0a2d52665`; pinned as the HEAD of worktree
`/private/tmp/claude-501/sp-builders/sf72-nalati9/wt`)

The groups decide on the host's clocks. Code done, typecheck and lint clean, Nalati suite green except
`physics-bake.test.ts`:
- `runtime/headlessCreatures.ts installNalatiCreatures`: the manager's `HuntBrain` on its own stream
  (`Rng(SEED + 31)` carrying on from the boot roster; `bootRoster.ts` now records each body's `adopted` stream and spawn
  spot, so every memory is adopted where the page adopted it; the dog is not adopted because its species module is the
  flock's), `navSteer`, the baked navmesh (`NALATI_NAVMESH_ASSET`, a new trusted asset), the forest from the bake.
  Each tick: Wildlife's frame (heading and health into the wild view, `pushWildMovers`, a stampede scares the packs), then
  the think loop in list order on `brainDt` with the 'lost.sight' wake. `useBodyStep`: `act` before a body moves,
  `chargeContact` after it. Its continuation is the `nalati.creatures` adapter (stream, clock, speed, seen, memories,
  herd centres). Restore is exact (the existing mid-walk restore test now covers decisions).
- Shared with the page, one law each: `groupDispatch.ts` `decideWolf` / `actWolfBody` / `decideHorse` / `actHorseBody` /
  `horseHeld`; `groupPorts.ts passThroughPlayer` (the host's capsule via `groups.ts hostPassThrough`);
  `look/trampleMovers.ts pushWildMovers` (creatures/wildlife.ts calls it). `attackTurnCap = ATTACK_TURN` on every body,
  as the melee manager sets it.
- Test: the 2k walk asserts all 15 wild-herd horses decide and move. The owned horses, the dog, Aqbars and Argymaq's herd
  (too far for the bands) stand still.

**To land it:** (1) rebake `runtime/physics.baked.json` on a clean build of the candidate (`groupDispatch.ts`,
`groupPorts.ts`, `creatures/wildlife.ts`, `look/trampleMovers.ts` are bake inputs; `scripts/bake-nalati-physics.mjs`).
Do not rebake the map: no map-hash input changed. (2) The coordinator approves the graph rise nalati → engine
765 → 780. (3) Run the full suite on a clean export, then the boot smoke, a muted Chromium iPhone run and physics walk
0 stuck.

## Fail-closed (honest, still)

These are not hosted: the flock and its dog's decisions (`UNHOSTED`: their brain clocks run, they don't think), the raid
director, Aqbars' elite brain, Argymaq's elite overlay (phase 2 run, leash), the knock-down (`onKnockdown` refuses: the
host has no Player dash), the marmots, and the 'target.dodge' / 'target.attack' wakes. The motor's pass-through state is
not in the physics snapshot (a restore mid-stampede between brain ticks would differ). A landed strike's scare still
refuses.

## Next (in order)

1. Land the candidate above.
2. The flock + dog + raid director (then wire the strike's scare: `packs.scare`, `herds.stampede`, flock, `onEvent('scare')`).
3. The mounted player (`ride/`, Mount) and crouch; the elites on `EliteCore`, the bosses on `installBossRow`, the sabre on
   `sweptMeleeCore`; the witness from a committed checkpoint.

Plan-State: unchanged.
