# Handoff (sf72-driftwood, part 7) — 2026-10-09, SF72 Driftwood Isle headless

Coordinator `wildshard-new` pushes. Supersedes part 6's "Exact next steps". Driftwood's canonical witness
(`test/proof/driftwood-isle/`) is UNCHANGED and still fails closed (its entry is still `runtime/hybrid.ts`).

## Landed (part 7)

- `b7fa5ec86` runtime/swords.ts: both swords on `SweptMeleeCore` (84c4aedb2) over the starter moves and the page's
  profiles (`driftwoodSwordProfiles` = loadout/rows.ts's recipe, built from HEAD's `@wildshard/game/weapons/starterMeleeProfile`,
  not the stale uncommitted sword-module move). A player command's attack is a light tap at its target (no heavy: the
  protocol has no hold). Every swing start is the page's 'weapon.fired': `island.alarm()` wakes the live aggressive or
  sensing load-time bodies through the keeper's `wake(i)` (the captain is never interrupted). In the active window the
  blade meets the named target once when its skin (head ball / body capsule) is within `reach` of the eye (1.68 m) and
  `bladeBlocked` is false: `Melee.contact`'s hit (source 'env', tags actor.player / row id / dmg.melee / cover.checked,
  `move.<name>`, `sweptMoveDamage` rounded: 12 / 12 / 16 on the wood combo), then the page's knockback + `AnimalSim.stagger`,
  and `island.staggered` → `hunt.staggered` on a fauna body. `equip(0|1)` swaps the hand (stops the other clock).
  The swords step registers after the keeper, so a wake is a zero step in the keeper's frame.
- `14fb7f900` runtime/kills.ts: 'actor.died' → `dead:sailor` (Spine.ts) and the kill feats' ledger facts
  (`driftwood.<id>` for `<id>:<n>`, sailor / crab10 / monkey6, capped at each feat's count; counts are continuation).
  The test harness's `emit` now collects effects instead of throwing.

## Still different from the browser (keeper.ts / swords.ts headers)

1. A charge's contact is tested at the next tick's start: one tick late.
2. No 'target.dodge' wake (the tick protocol has no dodge); no `clearBody`.
3. The coconuts' swell runs on `host.clock.now`.
4. Swords: no camera-space sweep rays (the command's target is the crosshair's), no lunge dash, no hit-stop, no clang,
   no heavy. The swing wake is not directly asserted by a test (only through exact restore).

## Exact next steps (in order)

1. **The quest's interactables headless** (quest/interactables.ts `DRIFTWOOD_INTERACT`, questLine.ts): the castaway talk
   (`talked:castaway`), the chest (`has:flint`), the beacon (`lit:beacon`) and lookout shard, the hold key (dropped at
   the sailor's death point; `kit.moveTo`) → pump → winch → strongbox (`shard:wreck`), the tide plates + barrel + sluice
   (`open:sluice`, a pushable barrel in the host's physics — the hard one), the cave shard, the altar (`used:altar`, which
   already spawns the captain), the reward view (`seen:reward`), and the iron sword pickup (guarded while a sailor lives,
   then `swords.equip(1)`). Every anchor's world point must come from the bake (extend scripts' Driftwood bake with the
   resolved interactable spots, as Signal's `signalSpots()`), driven by `script` commands at the page's prompt radii
   from the eye (Signal's runtime/quest.ts is the pattern), through `DeclaredQuests` with the fact / coins ports. Then
   the feats from flags (quest/Feats.ts: castaway, shards, quest, glass, treasure, vista, zipline).
2. `proveEntries`, then the witness on `runtime/headless.ts` with bands (10k, a captain mid-fight replay checkpoint,
   ledger); point `test/proof/driftwood-isle/run.mjs` at the trusted entry and flip `compatibility.json` only from a real run.

Plan-State: unchanged.
