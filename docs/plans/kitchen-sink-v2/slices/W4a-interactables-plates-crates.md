# W4a: the interactables section, plates that feel any body, physics crates and balls

Slice rule: [README.md](README.md) · west index: [INDEX-west.md](INDEX-west.md). Absorbs the old **W2** (interactables
platform section), the barrels half of **W3** (promote `barrels.as` to commons), the dynamic-prop part of **W14**, and
**M6.1** (the templates' `door.as` / `items.as` / `idle.as` → commons where they duplicate).

## 1. The showcase piece

Zone 03, physics yard 78 × 54 (`layout.js` `PHYSICS`), first half:

| Item | Rows |
|---|---|
| 3 pressure plates → a gate | `plate { by: 'any' }` × 3; `door { look: 'grate', opensWhen: { all: [plate1, plate2, plate3] } }`, no latch: step off and it closes |
| 3 physics-crate stacks | declared prop bodies (cuboid, wood), 5–6 crates a stack; plates feel them |
| 4 balls | declared prop bodies (ball), shared with the ball run (W4b) |
| A refill crate at the range | `refill` interactable (W3b uses it) |

## 2. Engine / game / host work, just in time

Research:

- **The plate puzzle is already data.** `src/engine/world/interact/types.ts:143-191`: `InteractDef = Chest | Key | Door |
  Lever | Plate | Barrel | Pickup | Beacon | Bench | Altar`; `DoorDef.opensWhen` (cond) and `latch`; `PlateDef { size,
  by: 'player'|'barrel'|'any' }` (line 173). `plateOverlap` (`interact/barrel.ts`) sees groups `PLAYER`, `ITEM`.
- **But it ships as named JSON, three ways.** Driftwood writes a data table (`src/shards/driftwood-isle/generators/interactables.ts`
  → `interactables.generated.json`, a named blob, no platform section); Pine builds on Driftwood's kit through
  `@wildshard/sdk/interactions` (`generators/questTable.ts:17`); Signal declares `format/questInteractions` rows
  (`generators/signalInteractions.ts:23`). The engine kit: `src/engine/world/interact/` (1,535 lines).
- **Dynamic props are declarable.** `sim/bodies` (`src/format/bodySlots.ts:25` `DeclaredBodyOpsRows { bodies, floors,
  colliders }`, G566) with `BodySpec` shapes `ball | cylinder | cuboid` (`src/engine/physics/bodies.ts:43`), material,
  density, rolling. Driftwood's tide barrel is one (`generators/output.ts`). **Phone cap: 40 awake dynamic bodies**
  (`bodies.ts:84`).
- `barrels.as` (Driftwood, 40 lines) is a generic "never-jam" watch (leash home, wedge timeout) with Driftwood-only
  constants (sea depth, tide plate).

Work:

| Row / host | Shape | Layer |
|---|---|---|
| `world/interactables` platform section | the `InteractTable` as a validated section (`format/sections.ts` entry + schema); questInteractions rows fold into it | format + game reader (`game/models/interact.ts`) |
| plate `by` | `'player' | 'body' | 'any'` with `bodies?: [ids]` (a plate may name which bodies count); `'barrel'` kept as an alias read on load | engine `types.ts`, `barrel.ts` |
| `refill` kind | `{ kind: 'refill', ammo, to }` | engine kit (no game nouns: "ammo" row id only) |
| commons `pushable.as` | `barrels.as` with its constants as params (leash, wedge, lost-under); Driftwood binds it with its old numbers | commons AS (`src/commons/scripts/`) |

Host bar: the interactables kit has three users (Driftwood, Pine, Signal) and becomes a section: 6/6. Guards:
`shard-sandbox`, `no-raw-*`, the custom-section freeze (`test/custom-section-freeze.test.ts`) goes down by one named file.
Tests: `test/interact-placement-rows.test.ts`, `test/driftwood-barrel-saves.test.ts`, `test/driftwood-barrel-watch.test.ts`,
`physics/barrel-plate.test.ts`, `test/declared-body-ops.test.ts`, `test/platform-data-sections.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Deleted | Parity proof | Save risk |
|---|---|---|---|---|---|
| Driftwood | named `interactables.generated.json`; `barrels.as` | section rows; commons `pushable.as` with its params | the named blob, `behaviour/barrels.as` | tide-gate puzzle: `test/driftwood-barrel-*.test.ts`; physics walk 0 stuck; push the barrel onto the plate in game | **medium**: flags are named after row ids (`types.ts` "persisted (flags are named after it)"); ids stay identical |
| Pine Hollow | kit via `sdk/interactions` | section rows | its named table | resin, tokens and doors: `test/isolated-shard-pine-weather-quest-values.test.ts`; a look in game | medium, same id rule |
| Signal Dunes | `questInteractions` rows | the same rows in the section | the second grammar | `test/quest-page-interactions.test.ts`; braziers in game | low |
| Templates | `door.as`, `items.as`, `idle.as` (×3–4 copies) | one commons copy each where identical | duplicates | `wildshard validate`, `test/scripts/_template-boss.test.ts` | none |

## 4. Done when, hours, blockers

**Done when:** in the showcase, crates, balls or you on all three plates open the gate and stepping off closes it;
crates stack and topple; Driftwood's tide gate, Pine's doors and Signal's braziers work as before; one grammar left.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 10 h (Codex) | 14 h | 8 h (yard ground, gate, crates: Opus look) | **32 h** |

**Blockers:** W0b (the yard sits outside the Range Gate).

## 5. Risks

- Body cap: the yard's 18 crates + 4 balls + W4b's 10 skittles + 2 see-saws = 34 of the phone's 40 awake bodies.
  Bodies sleep when still and the yard is far from the other dynamic sets; W12 measures it.

## 6. Questions for Jake

1. **Plates latch or not?** (a) the gate stays open only while all three plates are held (no latch), so you must park
   crates on them; (b) it latches open once solved. **Recommended (a):** that is the puzzle (bring two crates, stand on
   the third); a latch makes it a button.
2. **Crates reset.** (a) crates and balls drift home after 60 s untouched and away from their stack; (b) they stay where
   left until you leave the shard. **Recommended (a):** the yard is always solvable for the next try.
