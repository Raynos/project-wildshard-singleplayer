# Handoff (sf72-sky) — 2026-10-08, SF72 Sky Reach headless, part 3 (sf72-sky3, 90-min cap)

Coordinator `wildshard-new` pushes. Landed locally with a private index + old-value CAS. Sky's canonical witness
(`test/proof/far-reach/`) is UNCHANGED and still fails closed: the played headless host owns the 13 bodies, the Roc
encounter and the War Fan, but not yet the movers, the quest or the ledger's quest fact. `finish` now has a real proof.

## Landed

- Part 1: `defff10d1`, `66330c07b`, `3361c50c3`. Part 2: `43d7928cd` (War Fan).
- Part 3 (this commit), step 1 movers + step 3 entry proof:
  - `behaviour/bridges.as` is admitted: `shard.config.ts` `files` + `critical` hold both modules (hash order: bridge
    `1371d895…`, islet `f8f90ba2…`), `budgets.sim.compressed` is the sum; `data/bridgeModule.ts` is the generated
    constant (`scripts/bake/movers.mjs` now emits it beside `liftModule.ts`; the bake was NOT rerun whole, Driftwood's
    `data/movers.ts` untouched). Official Sky map rebake in the same commit (pixels equal but for rim noise).
  - Grid double fetch fixed: `MoverInstallation.admitted?` (game/shardfile/moverRuntime.ts, additive, approved) is read
    before any URL; Sky passes `runtimeProduct(source).assets.retained`, the cell admission's verified bytes. Contract
    test: standalone fetches each module once, a provided product fetches none and the islets still ride on it;
    grid-discovery already pins the admission's one fetch per file.
  - `runtime/moverRows.ts`: `SKY_MOVERS` moved out of `runtime/movers.ts` (that one imports the browser loader) so the
    headless runtime can read it.
  - `runtime/headlessMovers.ts`: hash-checked modules in the async `prepare`, a synchronous per-host `ScriptHost` +
    `MoverRuntime` without adoption over every row but the static ropes (they stay the baked `far.rope.*` pieces),
    a `far.movers` step (`beginTick`, the winch permission map, `capture`) and an exact continuation adapter (script
    checkpoint, mover entity fields, pending + handles, `reconnect` after the native restore).
  - `proveEntries`: each socketLift entry on a fresh host of the trusted world (baked colliders + entry socket decks +
    the shardfile's `landing.*` / `gate-isle.*` props + the movers), the platform `proveSocketLift` on real host steps:
    92 lanes, 8 rides, 8 calls, zero script failures.

## Blocker found (routed by the coordinator to the engine host lane)

Rapier `World.restoreSnapshot` re-parents every parentless collider (all static pieces) to rigid body 0: the JS
`Collider.finalizeDeserialization` does `bodies.get(raw.coParent(handle))`, `coParent` is undefined, the Coarena index of
NaN is 0. Once a mover body exists, a restored capsule standing on a static piece anchors to it (`CharacterMotor.pin`)
and the restored run diverges on its first step. So the movers are NOT installed in the played host yet (only in the
entry proof's fresh hosts). Isolated repro: one parentless cuboid + one kinematic body, snapshot, restore,
`getCollider(h).parent()?.isKinematic() === true`.

## Exact next steps (in order)

1. When the restore-parent fix lands: add `installSkyMovers(host, modules, context.restoring, permission)` to
   `install` (after `colliders`), and check the headless restore tests (they caught it: checkpoints 0 / 1 / 700 / 2600).
2. **Quest**: `DeclaredQuests(host, shard.quests, { fact, coins })` (Signal's `runtime/quest.ts`); interactions as
   `script` commands at the browser radii from the eye (keeper talk: head `KEEPER_AT` at DECK + 1.8, r 3.5 → `far.notes`;
   lectern `NOTES` + 1.3, r 2.6 → `far.notes`; winch `WINCH` + 1.2, r 3 → bridge command 1 when unlocked; islet
   RIDE / CALL at `world/risingIslet.ts isletCalls` positions → `commandSocketLift`; that file imports three, so lift
   the positions into a view-free helper). Roost: the three `far.roost.*` dead after `far.notes` → `far.roost`; all
   three vane flags → `far.vanes`; bridge raised → `far.bridge`. The winch permission is `roost + vanes*2`; completion
   pays REWARD 10 + fact `far-reach.quest` once.
3. **Traversal + witness**: drop the Roc test's labelled chip for real fan play (the fall law and knockback are in
   main), a four-entrance traversal into the crown, then flip `test/proof/far-reach/run.mjs` through the trusted
   runtime (headless 10k, replay mid-Roc, ledger both facts).

## Proof receipts (this commit)

- Clean export of `79687f85b` + these files: strict tsc, oxlint, ratchet, coupling green; graph far-reach → engine
  120 → 126, → game 29 → 35, → sdk 14 → 15 (approved). Sky tests incl. contract 10/10, headless-runtime 14/14,
  grid-entry-native, entries, grid-discovery.
- Browser on that export's build (muted Chromium, iPhone 16 Pro): boot smoke 3/3 PASS, grid included; physics-baseline
  `--mode=walk --shard=far-reach` 10 legs, 0 stuck, 0 walk errors; bake-maps loaded Sky and rebaked it.

Plan-State: unchanged.
