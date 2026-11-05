# E9: storm hour and the four beacons (the Lights Out quest)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the storm-hour trigger of the old
**W13** ("a quest step that forces a weather state until a flag"), decision 8 (one quest turns the whole cell to an
evening storm until four beacons are lit) and the tier-2 quest **Lights Out** (L9). W11a's Developer "storm now" row is
deleted here.

## 1. The showcase piece

Accepting **Lights Out** turns the whole cell to an evening storm (rain, wind, thunder, dark light; storm hour counts
as night, so the night shift and night elites come out, E7b/E8c). Four **beacons** stand on band 5's corners; lighting
each (an interaction under fire) brings its lamp on; the fourth clears the storm with the `dawn` sting and the
`beaconLit` chimes. The music switches to `storm` (W11b's slot).

## 2. Engine / game / host work, just in time

Research:

- **A director stage can already set weather**: `directorStages` v2 actions include `{ weather: key }`
  (`src/format/directorStages.ts:12`), keyed in the plugin director (`src/game/server/plugin/director.ts:243`); inputs include
  `flag:` bindings (`:6`). Nobody uses the weather action today.
- **Beacons are an interactable kind**: `BeaconDef { kind: 'beacon', label }` (`src/engine/shared/world/interact/types.ts:187`),
  used by Driftwood's lookout beacon (`src/shards/driftwood-isle/generators/interactables.ts:57`).
- Weather state lives in W11a's `world/weather` (states, odds, storms) with continuation across reloads
  (`src/game/server/weather/continuation.ts`). Nothing *holds* a state against the schedule.

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| held weather | `world/weather.holds: [{ while: <condition>, state: 'storm', light: 'evening' }]`: while the condition holds, the schedule is paused and the state forced; released with the normal ease | format (W11a's section) + game weather host |
| quest | Lights Out sets `storm-hour.on` on accept; four beacon rows set `beacon.n`; the hold's condition is `storm-hour.on ∧ ¬all(beacons)` | data (W1b quest + W4a interactables) |
| delete | W11a's Developer "storm now" row | Debug registry |

The director's `{ weather }` action is not needed (a condition hold is simpler and saves through the flags); it stays
unused (Q1).

Host bar: the weather host gains a hold row (Pine, Nalati and the showcase are its users after W11a). Tests:
`test/weather-continuation.test.ts` (a held storm survives a reload), new `weather-hold.test.ts`.

## 3. Other shards in this slice

Pine and Nalati declare no `holds`: their weather logs are identical (W11a's seeded log test). Driftwood's beacon row is
untouched. No save risk beyond the new flags.

## 4. Done when, hours, blockers

**Done when:** Lights Out turns the cell to a storm that survives a reload, the night shift comes out, four beacons
clear it with the stings; the Developer storm row is gone.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 8 h (Codex) | 2 h | 10 h (Opus: beacon model and lamp look; quest rows) | **20 h** |

**Blockers:** W11a, E7b, E5b (band 5's corners are in the stealth yard's band), W4a, W1b.

## 5. Risks

- Storm hour lasts as long as you take; a player who accepts and leaves the shard comes back to a storm. That is the
  design (the quest is active), but the giver's line should say so.

## 6. Questions for Jake

1. **Delete the unused `{ weather }` director action?** (a) keep it (one line, no user); (b) delete it, holds are the
   one way. **Recommended (b):** a stage that sets weather fights the hold; one way to force weather.
2. **The Warden Core powering the beacons** (the mini-dungeon page's idea). (a) no: beacons need only you; (b) a beacon
   needs the Vault Warden's core first. **Recommended (a):** quests are freeform (decision 17); Lights Out is L9 and the
   Warden L12.
