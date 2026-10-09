# Handoff (sf72-driftwood, part 8) — 2026-10-09, SF72 Driftwood Isle headless

Coordinator `wildshard-new` pushes. Supersedes part 7's "Exact next steps". Driftwood's canonical witness
(`test/proof/driftwood-isle/`) is UNCHANGED and still fails closed (its entry is still `runtime/hybrid.ts`).

## Landed (part 8, one commit: see the report's SHA)

- `runtime/quest.ts` "The Sealed Ring": `DeclaredQuests` (its `driftwood.quest` fact) plus the whole interactables table
  (quest/interactables.ts) on the engine kit's own rules (shown / locked / prompt radius / interact, walk-in sea glass, the
  plates' slab overlap against PLAYER + ITEM, the sluice's latch), driven by `script` commands on actor `driftwood.interact`:
  value 0 = Wendell's talk (`talked:castaway`, 3.2 m from his head), 1 = the iron sword (2.6 m; refused while a drowned
  sailor stands; `swords.equip(1)`), `100 + i` = table row `i`. The sailor's death drops the hold key where he fell
  (floor = max(baked floor, hold floor)). The reward beat starts within 7 m of the finale's spot once the captain is dead and
  sets `seen:reward` 7 s later (the quest completes). The flag feats (castaway, shards, glass, treasure, vista, zipline,
  quest) emit `driftwood.<id>` / `<id>:<n>` as quest/facts.ts does. Continuation: the key's point, the beat's clock, the iron
  taken, the feat counts.
- `scripts/bake-driftwood-spots.mjs` → `runtime/spots.baked.json`: every table row as the page's kit placed it (+ prompt
  point, the sluice's collider), Wendell's talk point, the sword's prompt, the reward spot (`finale.rewardAt`). Baked from
  a3fae021c's preview, two equal captures. No inputs-hash freshness guard yet (the test only holds ids / kinds to the table).
- The day clock (b109b957c): `host.useDayClock(driftwoodDayClock())` on every install (look/backdrop.ts's 0.2·DAY start,
  48 min cycle; the test reads backdrop.ts's two spellings). Nothing reads it yet.
- keeper.ts fix: a restored body takes its saved `levelGround` (a restored world answers no scene query before its first
  step, so the captain's pool deck was missed and his corpse drifted 0.4 m after a restore).

## Still different from the browser

1-4 as part 7 (charge contact a tick late; no dodge wake / clearBody; coconut swell on host clock; sword sweep details).
5. Quest: no prompt line of sight; no nearest-prompt pick (the command names its row); chest doubloons are pack items (no
   effect); the reward view does not carry the player; no zipline; the shown strongbox and the open sluice keep the baked
   load-time colliders.

## Exact next steps (in order)

1. **The puzzle barrel needs an engine seam (coordinator):** the host's player motor is `blockedBy: ['WORLD','PLAYER',
   'CREATURE']` (sim.ts `motor()`), the browser player's is `['WORLD','CREATURE','ITEM']` with mass 80, so a headless player
   cannot push an ITEM barrel. With a seam (level / port opt-in to ITEM), spawn `BARREL_BODY` (copy the spec renderer-free;
   Interactables.ts imports the app) at row `tide-barrel` through a `Bodies` service, add BarrelWatch's leash / lost /
   wedged rules, and plate b presses → `open:sluice` → the cave shard. Until then the quest cannot finish headless.
2. **Night respawns (Ecology.ts)**: the RespawnQueue on the 'spawn' stream, the sailor's night gate on `host.dayClock.night`.
3. **Entry proof**: probed on the baked world + `installDeclaredPropColliders(propColliderDescriptors(shard.props))`: the
   centre lanes walk 50 m onto every pier / jetty (feet up to 1.23 m), the outer lanes (±3.65 m) step off the jetty's side
   at 16.5 m into the lowered sea, as on the page. Define the off-socket route (lanes converge onto the deck after the
   landing) before writing `proveEntries`. Host must `step()` once before any ray (scene queries).
4. The witness on `runtime/headless.ts` (10k, a captain mid-fight replay checkpoint, ledger from gameplay); point
   `run.mjs` at the trusted entry; flip `compatibility.json` only from a real run.

Plan-State: unchanged.
