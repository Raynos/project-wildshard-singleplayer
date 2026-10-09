# Handoff: sf72-signal-rows (SF72, Signal Dunes' behaviour as declared rows), 2026-10-09

Status: unfinished (the 90-minute lane ended after slice 1). Inventory and move list:
`progress/shard-platform/m3-status/signal-8020.md`.

## Landed

- `a755bf10e` **declared interaction rows** (brief item 1). `@wildshard/game/quest/interactionRows`:
  `InteractionRules` (transient marks with an `initial` condition on the flags; rows `{ id, act, at, crack?, needs[], sets }`
  whose needs are checked in order and refuse with their `else` reason; `sets` raise marks first, then the view's
  `changed` beat, then durable flags; `never` combinations a restore refuses; `{ version: 1, marks }` continuation) and
  `installInteractionRows(host, rules, { actorId, stepId, spots, commands, crack?, done? })` (the renderer-free host's
  script-command step: prompt radius from the eye, crack rows only when the item's crack reached their act, within the
  spot radius plus the crack's reach). `@wildshard/sdk/interactions` publishes `parseInteractionRows` and the row type.
  Signal: rows in `quests/interactions.ts` (public), `runtime/interactions.ts` deleted, `runtime/quest.ts` is the spots
  and one install, the browser's `world/build.ts` runs the same rules. Witness re-recorded (final state hash only,
  gameplay identical). Signal's restore tests compare canonical state (`expectSameSimSnapshot`).
- Numbers: share 18.8 % → 19.6 % (public 790 → 813, custom 3415 → 3339); runtime + trusted 855 → 777 / 965.

## Adoption (not done: their lanes own the files)

- Driftwood (`runtime/quest.ts`) and Pine (`runtime/quest.ts`) loop `script` commands over a table at baked prompt radii
  from the eye: the same step. Their kit-table rows (latching levers, take, light) map to rows whose `sets` are the kit's
  flag spellings; the barrel / zipline / stag / clock stay their own fixed steps beside it.
- Sky Reach's roost prompts (`far-reach/runtime/quest.ts`, `SKY_INTERACT`) are the same shape.

## Next, in order

1. **Generic lash item on `ItemRuntime`** (brief item 2). Move `weapons/lash.ts` (`lashContact`, `lashLane`) into the
   engine / game (e.g. `@wildshard/game/items/lash`) and give `ItemRuntime` a lash shape: the contact rule
   (`runtime/whip.ts` `contact`), the heavy's second lash at `CRACK.second` (0.32 s) that staggers (`CRACK.stagger`) and
   pulls (`CRACK.pull` 16 m/s on ≤ `pullMaxHp` 40), the 0.12 s unroll, and the world-crack report (`cracked`). Then
   `Bullwhip.ts` keeps only the view (cord, wrap) and `runtime/whip.ts` goes. The witness tape will change if the second
   lash lands headless (it does today only in the browser): re-record with that stated.
2. **SDK species / strike row type** (brief item 3): `StrikeSpec.weight` is a function (`src/engine/ai/strikes.ts:29`);
   a data-only weight (e.g. `{ base, near?: { within, gain }, phase?: {...} }`) evaluated by the engine lets
   `runtime/species/*` numbers move to `data/` behind a published `@wildshard/sdk/species` type.
3. Headless `world()` in `runtime/headless.ts` can read the crack rows (`row.crack`, `row.at`) instead of indexing
   `spots.crack` by brazier, once the lash item reports world targets generically.
