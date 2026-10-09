# Handoff (sf72-driftwood, part 6) — 2026-10-09, SF72 Driftwood Isle headless

Coordinator `wildshard-new` pushes. Supersedes part 5's "Exact next steps". Driftwood's canonical witness
(`test/proof/driftwood-isle/`) is UNCHANGED and still fails closed (its entry is still `runtime/hybrid.ts`).

## Landed (part 6)

- `94a99ca8a` ramGrazer, challengeGrazer, orbitDiver, patrolDiver and burstFlyer accept an interrupt's zero step (as
  407640b84 did for skirmisher / guardian / perch hunter); a zero-step test in each policy's test file.
- `01918d552` the keeper runs on `host.useBodyBands` (its own rateOf / due clocks gone; brainDt / bodyDt; 45 / 55 m
  capsules; a charge's next-tick contact only for a body its band stepped). Test: 'runs the bodies on the page's
  distance bands'.
- `cf59ecc55` the captain's rise / sink clock and `yOffset` run on his body step (`advanceCaptainRise` in
  species/captainPolicy.ts), not in the rig's animate (the page froze him mid-rise beyond the animation LOD); the
  Driftwood bake now sets `used:altar` and reads his spec, pool, spawn yaw and arena (`bake.captain`). Gates: full suite,
  boot smoke (grid), walk baseline 0 stuck, browser probe.
- `481a1cf2e` the headless finale: runtime/captain.ts (altar flag → keeper `spawnCaptain` under EntityIds' next id with
  the manager's spawn draws → the browser's CaptainBrain on the 'legacy' band + the browser's DrownedCaptain with the
  silent presentation; `dead:captain`, `boss.attempt`; exact mid-fight restore). Not on `installBossRow`: DrownedCaptain
  bypasses BossBrain's intro / checkpoint / beat machine (the reason is in the commit).

## Still different from the browser (keeper.ts header)

1. A charge's contact is tested at the next tick's start (the host steps bodies after its systems): one tick late.
2. No 'target.attack' / 'target.dodge' wakes, no `hunt.staggered`, no `clearBody` (they come with the swords).
3. The coconuts' swell runs on `host.clock.now`.
4. The captain's rise clock pauses while he is stunned or dead (page and headless alike since cf59ecc55).

## Exact next steps (in order)

1. **The swords.** Wait for (or check) the sword-module migration in the shared tree first: at the time of writing
   another lane had uncommitted moves of `starterMeleeProfile` / `starterMoves` / `Sword` from `@wildshard/game/weapons`
   and `src/sdk/runtime/weapons/` to `@wildshard/sdk/weapons/` (plus WIP in `engine/combat/items.ts`,
   `driftwood-isle/quest/install.ts`, `loadout/rows.ts`, `weapons/swordView.ts`). Build on whatever lands. Then a
   headless sword item on `@wildshard/engine/combat/sweptMeleeCore` (the browser's SweptMelee drives the same clock;
   Signal's `runtime/whip.ts` on `ItemRuntime` is the item pattern) for the two rows in `data/items.ts`, with the
   page's sweep contact, the swing wake (AnimalManager line ~397: `weapon.fired` → `interruptTargets('target.attack')`
   for aggressive or sensing bodies; the self-thinking enemies with `tick: 'ai'` take it, the captain does not), the
   dodge wake, and the fauna stagger (`a.onStaggered` → `hunt.staggered`). Wire the wakes through the keeper's `wake(i)`
   (brainDt(id, true): a zero step is fine now for every policy).
2. Quest / ledger facts from gameplay (the altar is now a host flag; the captain's death sets `dead:captain`), then
   `proveEntries`, then the witness on `runtime/headless.ts` with bands (10k, a captain mid-fight replay checkpoint,
   ledger); flip `compatibility.json` only from a real run.

Plan-State: unchanged.
