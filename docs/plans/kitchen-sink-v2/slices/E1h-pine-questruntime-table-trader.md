# E1h: Pine's custom questRuntime I: its interactables table, trader and readings onto platform rows

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs the first half of **M2.1** (Pine
`questRuntime` → rows + AS, CS5's open exit, HOST-AUDIT HA4a **H021**). W1b Q5 sent this to the east assuming the
runtime was "mostly the lodge contract board"; research shows the board is 9 % of it (E1f), so the runtime is retired
in two slices of its own. A migration slice: no showcase piece.

## 1. The showcase piece

None. It runs here because the contract board (E1f) is the first east host Pine's runtime moves onto, and the rest of
the runtime's pieces target west hosts that exist by now (W4a, W2b, W1a/W1b).

## 2. Engine / game / host work, just in time

Research (`out/pine-hollow/sections/custom/questRuntime.json`, 29,289 bytes; listed in `lint/custom-sections.json:330`):

| Key | Bytes | What it is | Target host |
|---|---|---|---|
| `table` | 11,422 | 44 interactable rows (levers, doors, pickups; e.g. `dam-log-a` "Heave the log off the sluice", latch, `requires`) + `external` flags | W4a's `world/interactables` section |
| `content.trader` | 1,759 | Mott's barter page | W2b's typed exchange (already moved Mott's goods; the page copy goes) |
| `readings` | 4,174 | `speakers`, `continuation` (the journal / NPC reading lines) | W1a dialogue rows |
| `content.npcs` | 4,061 | the lodge NPCs | W1a NPC rows |
| `content.board` | 2,500 | the lodge board | moved in E1f |

The reader is the plugin scaffolding: `src/game/plugin/simulation.ts` (1,576 lines) loads `custom/questRuntime`; Pine's
generators that write it: `generators/sourceOutput.ts`, `sections.ts`, `forestStory.ts`, `nativeQuest.ts`,
`pageComposition.ts`, `rangedPage.ts`.

Work: emit `table` into `world/interactables`, `npcs` + `readings` into the NPC / dialogue rows, drop the trader copy;
the plugin's reader stops reading those keys. No row shape changes are expected (W4a/W1a/W2b made them); if a key has a
field the platform rows lack (the `lead`'s `nightAbove`, a lever's `lockedLabel`), it is added to the platform row
there, never kept as custom.

Host bar: no new host. Guards: the custom-section freeze (`test/custom-section-freeze.test.ts`: Pine's custom bytes go
down), `shard-game-plugins` ratchet. Tests: `test/quest-step-pine-native-parity.test.ts`,
`test/isolated-shard-pine-weather-quest-values.test.ts`, `test/fixtures/pine-headless.ts` replays.

## 3. Other shards in this slice

| Shard | Migration | Parity proof | Save risk |
|---|---|---|---|
| Pine Hollow | the four keys above out of the custom section | headless chapter replay (same steps, flags, save trail); the dam lever, the mill door and Mott's trades in game; Pine goldens of the lodge (Opus) | **high**: interactable flags are named after row ids (`types.ts:144`): ids byte-identical; a mid-quest old-save fixture |

## 4. Done when, hours, blockers

**Done when:** Pine's `custom/questRuntime` holds only `chapters`, `lead`, `spawns`, `deaths`, `events`, `steps`,
`policy` (E1i); the replay and the old-save fixture pass; the lodge plays the same.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 2 h | 16 h (Codex) | 0 | **18 h** |

**Blockers:** E1f, W4a, W1a, W2b.

## 5. Risks

- M2.1 is the plan's riskiest quest migration (live, save and phase rules). Two commits per key: emit both, then stop
  reading the custom copy once the replay is green.

## 6. Questions for Jake

None: this is approved cleanup (Jake 11-02, "get rid of some custom JSON in the shard files … approved").
