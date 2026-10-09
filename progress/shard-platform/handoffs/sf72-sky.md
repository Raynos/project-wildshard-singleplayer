# Handoff (sf72-sky) — 2026-10-08, SF72 Sky Reach headless, part 2 (sf72-sky2, 90-min cap)

Coordinator `wildshard-new` pushes. Landed locally with private indices + old-value CAS; no browser or preview of mine
left running. Sky's canonical witness (`test/proof/far-reach/`) is UNCHANGED and still fails closed: the runtime owns the
13 bodies, the Roc encounter and now the War Fan, but not yet the movers, the quest, the ledger's quest fact or an entry
proof.

## Landed

- Part 1: `defff10d1` (engine shove), `66330c07b` (13 creatures headless), `3361c50c3` (the Roc encounter on one
  shared view-free script).
- `43d7928cd` War Fan (step 1): `weapons/fanStrikes.ts` is the fan's one view-free move recipe (G51): cooldowns, the
  SWING / HEAVY arc slash and the GUST cone (impulse + wind hit), run by the browser `WarFan` (viewmodel, input, charge
  hold, cues stay its own) and by `runtime/fan.ts` (headless adapter `item.weapon.far-reach.fan`; a `player.attack` is
  the light SWING aimed eye → target body; `script` commands on actor `far.fan` value 1 = HEAVY, 2 = GUST, level along
  the player's yaw; locked through the Roc's intro; cooldowns are exact continuation). `quest/vanes.ts` (`turnVanes`,
  `VANE_REACH`, `VANE_HUB`) is the one vane rule the plugin's `gustVanes` and the headless GUST share; a contract test
  holds the built vane hubs equal to `VANES + VANE_HUB`. Sky physics rebaked: actors + pieces byte-identical.
  The Roc test still carries the fight with a labelled direct chip (the fan's own contacts are counted and asserted):
  before sf72-host's fall law a gale wall's lift floated the player off the crown out of reach.

## Exact next steps (in order)

1. **Movers** (coordinator chose option A): admit `behaviour/bridges.as` (module `1371d895…`, in
   `src/shards/far-reach/assets/`) in `shard.config.ts` `files` + `critical` beside `LIFT_MODULE` (an `assets` graph
   root is required; `budgets.sim.compressed` becomes the sum), with a generated `data/bridgeModule.ts` emitted by
   `scripts/bake/movers.mjs` like `liftModule.ts` (don't rerun the whole bake: it rewrites Driftwood's `data/movers.ts`,
   which had someone's WIP). Map-hash input → official map rebake in the same commit. Check sim / critical ceilings,
   the shardfile admission tests and Sky's grid admission.
   - Browser: the trusted plugin fetches both modules by asset URL (`runtime/movers.ts` `modules`), never the admitted
     bytes. In GRID the product admission (`game/shardfile/product.ts`) already fetches `files` (LIFT today), so the
     lift module is fetched twice there now; the coordinator wants the plugin to read the admitted bytes when present.
     Find how a first-party runtime cell reaches `retained.admitted` (`grid/liveSession.ts` `admitRuntime`) and pass it
     to `installDeclaredMovers` (it takes `shared` or URLs only today).
   - Headless: build the mover ScriptHost synchronously in `install` (hashes verified once in the async `prepare`, e.g.
     via `createMoverHost` there and a per-host copy, or the `ScriptHost` / `ScriptWorld` / `moverScriptEntities`
     exports). Run `MoverRuntime` WITHOUT `adopt` (restore refuses adopted rows) over `SKY_MOVERS` minus the static
     rope rows (those stay the baked `far.rope.*` pieces, as the browser adopts them); the winch bridge then collides
     through its own `KinematicMover` (enabled only when raised), replacing the inactive baked `far.bridge.crown`.
     Permissions for the bridge: `roost + vanes*2` (runtime/index.ts). Continuation as `bindShardfileSim` does
     (`snapshotState(resetMovers)` / `restoreState` / `physicsRestored: reconnect(resetMovers)`, `beginTick` per step).
2. **Quest**: `DeclaredQuests(host, shard.quests, { fact, coins })` (Signal's `runtime/quest.ts`); interactions as
   `script` commands at the browser radii from the eye (keeper talk: head `KEEPER_AT` at DECK + 1.8, r 3.5 → `far.notes`;
   lectern `NOTES` + 1.3, r 2.6 → `far.notes`; winch `WINCH` + 1.2, r 3 → bridge command 1 when unlocked; islet
   RIDE / CALL per `world/risingIslet.ts isletCalls` positions → `commandSocketLift`). Roost: the three `far.roost.*`
   dead after `far.notes` → `far.roost`; all three vane flags → `far.vanes`; bridge raised → `far.bridge`. Completion
   pays REWARD 10 + fact `far-reach.quest` once.
3. **Entry proof**: `proveEntries` = `proveSocketLift` per socketLift entry on a fresh host (colliders + movers only),
   the shardfile's `props.colliders` (landing / gate-isle strips) included as the browser installs them.
4. **Traversal + witness**: sf72-host's fall law (`1ddf64e42`, `SimHost.playerFall`) and knockback (`3c7c5c8f8`) are
   in main: drop the Roc test's chip for real fan play, then a four-entrance traversal and the witness flip
   (`test/proof/far-reach/run.mjs` through the trusted runtime; headless 10k, replay mid-Roc, ledger both facts).

## Proof receipts (43d7928cd)

- Candidate on `68bc208e4`: Sky tests 18 files / 60 tests; strict tsc + layers, oxlint, ratchet, coupling, graph,
  pre-commit hook green. Full Vitest on the prior base 5589 / 5592: AG7 generated-only (the approved +2), and
  driftwood / pine physics-bake + grid-rail-jump, which fail identically on clean `3c7c5c8f8`.
- Browser (muted Chromium, iPhone 16 Pro): boot smoke 3/3 PASS (grid included) on `e1e5ae59f`; physics-baseline
  `--mode=walk --shard=far-reach` 10 legs, 0 stuck; the rebake loaded Sky with 0 page errors, actors/pieces identical.
- Graph far-reach → engine 118 → 120 (approved).

Plan-State: unchanged.
