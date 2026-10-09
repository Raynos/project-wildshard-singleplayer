# Handoff (sf72-driftwood5) — 2026-10-09, SF72 Driftwood Isle headless part 5

Coordinator `wildshard-new` pushes. Driftwood's canonical witness (`test/proof/driftwood-isle/`) is UNCHANGED and still
fails closed (its entry is still `runtime/hybrid.ts`). Supersedes the "Exact next steps" of `sf72-driftwood4.md`.

## Landed (this lane)

- `28834f54d` coconuts: `combat/coconuts.ts` is the one view-free volley (lob, 0.45 m feet-to-head strike, landing,
  rest / age, float on the swell). `creatures/Enemies.ts` only draws its slots; `runtime/keeper.ts` runs the same volley
  in the host's world through a `Bodies` service stepped around the host's world step (`post` at the keeper step's start,
  `pre` at its end), spun from the placement stream past placement (`placeEnemies(...).stream`). Continuation v3 keeps
  each live slot and its native rigid-body handle; `physicsRestored` adopts the restored world's bodies by handle (a
  mid-flight checkpoint restores exactly, `headless-runtime.test.ts`). Engine: `Bodies` is renderer-free
  (`setActiveBodies` / `activeBodies` moved to `physics/active.ts`; default cap = the phone's, bootstrap passes the tier's).
  Browser before/after (40 s beside the 105,108 troop): HEAD 27 throws / 25 hits, candidate 26 / 24.
- `a098b4964` the Driftwood physics bake re-read on top of 20225cf9a (my first landing carried a stale bake).
- Skirmisher fault fix (see the final report for the SHA): the manager's interrupt decides at once whatever the clock
  (`test/ai/tick-rates.test.ts` pins it), so a second wake in a frame carries dt 0; the skirmisher, guardian and
  perch-hunter policies refused dt <= 0 and now accept a zero step. Repro: `test/engine/interrupt-zero-dt.test.ts`.
  Browser: HEAD logs `Invalid skirmisher step` and switches engine.events off; the fix logs 0 faults over 800 wakes.
  The other declared policies (ramGrazer, challengeGrazer, orbitDiver, patrolDiver, burstFlyer) keep `dt <= 0` guards:
  they only run under the headless brain runtime today, but a browser row on them would need the same change.

## Still different from the browser (keeper.ts header)

1. Body bands: adopt `host.useBodyBands(...)` (3d68396a2) in `installIsland` BEFORE restore; it replaces the keeper's
   own `rateOf` / `due` clocks with `host.brainDt(id, urgent)` and gives the 45 / 55 m physics capsules. Then the
   charge-contact one-tick lag (item 2 of driftwood4) is the only known body-order gap.
2. No `target.attack` / `target.dodge` wakes, no `hunt.staggered`, no `clearBody` (wire with the swords). Mirror the
   browser: a wake decides at once, a zero step included (the policies accept dt 0 now).
3. The coconuts' swell runs on `host.clock.now` (the browser's ocean clock starts with its view).

## Exact next steps (in order)

1. Body bands (above), then rebake nothing (keeper-only); rerun `headless-runtime.test.ts`.
2. The captain: one view-free boss script shared by the browser and headless (Signal's `combat/matriarchFight.ts`, Sky's
   `runtime/rocEncounter.ts`) on `@wildshard/game/shardfile/bossRow` `installBossRow`; his spec baked by setting
   `used:altar` in the bake; his id from the keeper's `EntityIds` in the browser's spawn order.
3. Swords on `@wildshard/engine/combat/sweptMeleeCore` (84c4aedb2; Signal's `runtime/whip.ts` on `ItemRuntime` is the
   item pattern), with the swing / dodge wakes and the fauna stagger.
4. Quest / ledger facts, `proveEntries`, the witness on `runtime/headless.ts` with bands (10k, captain mid-fight
   replay, ledger); flip `compatibility.json` only from a real run.

Plan-State: unchanged.
