# Handoff (sf72-nalati10) — 2026-10-09, SF72 Nalati Grasslands headless, part 10

Coordinator `wildshard-new` pushes. Supersedes `sf72-nalati9.md`. Nalati's canonical witness (`test/proof/nalati-grasslands/`)
is UNCHANGED and still fails closed (`compatibility.json` not flipped).

## Landed

- **Engine seam `f0fda29be`**: `SimHost.dashPlayer(vx, vz, time)`, the client Player's velocity `dash` (refused on the board),
  proven step for step against the client Player while it carries (`test/engine/sim-player-moves.test.ts`). Sky's checkpoint
  manifest regenerated (inputs hash only).
- **`fd32b3203`**: sf72-nalati9's candidate `27c958e45` rebased (the groups decide on the host's clocks), plus:
  - the groups' continuations (`PackBrain` / `HerdBrain` `snapshot()`) in the `nalati.creatures` adapter. Before this, a
    restore beside the wild herd diverged on its first step: the groups ticked, but a restore rebuilt them at tick 0;
  - the knock-down on the host (`creatures/knockdown.ts`, one rule: the page's `runtime/state.ts` `Player.dash`, the host's
    `SimHost.dashPlayer`);
  - a mid-stampede restore test (`headless-runtime.test.ts`). The motor's pass-through was already saved (the motor
    snapshot's `ghost` / `filter` and the collider groups in Rapier's bytes); the test proves it;
  - physics rebaked from a clean build (bake revision `0983fd56b`, a worktree commit whose bake inputs equal `fd32b3203`'s;
    only the input hashes and two render-timed pose rows moved: creature:21 `_graze` and creature:23's yaw, both inside the
    tests' tolerances). Graph: nalati-grasslands → engine 765 → 780 (approved).

Gates: full vitest on a clean tree (1050 files / 5813 tests green, before the last rebase onto `ac189becd`; after it the
focused far-reach + Nalati + sim tests were green), typecheck, guards, oxlint on every touched file, boot smoke PASS, the
Nalati physics walk 0 stuck in 12 legs.

## Still fail-closed

Not hosted yet: the flock and its dog's decisions (`UNHOSTED`), the raid director, Aqbars' elite brain, Argymaq's elite
overlay, the marmots, and the 'target.attack' wake. A landed strike's scare still refuses. The 'target.dodge' wake can now be
wired: the host has `dodge`, so a `player.dodge` event can wake the targets (AnimalManager `interruptTargets`: the aggressive
or sensed bodies, urgent on their next `brainDt`). Check the page's frame order first: the dodge sets `dodgeFx.id` in the
player's update, and the manager reads it in the same frame.

## Next (in order)

1. The flock + dog + raid director, then wire the strike's scare (`packs.scare`, `herds.stampede`, flock, `onEvent('scare')`).
2. The mounted player (`ride/`, Mount) and crouch.
3. The elites on `EliteCore`, the bosses on `installBossRow`, the sabre on `sweptMeleeCore`.
4. The witness from a committed checkpoint. Use `canonicalSimDigest` (test/fake/simState.ts, `ba9d61dd9`).

Plan-State: unchanged.
