# E8e: finishes and titles as grants (Nalati's finishes and legendaries; cosmeticFinishes retired)

Slice rule: [README.md](README.md) · east index: [INDEX-east.md](INDEX-east.md). Absorbs **M1.3** (Nalati's finishes
and legendaries; retire `cosmeticFinishes`, HOST-AUDIT **H059**), the elite-drop finish grant of the old **W16**,
**LW9** (the seven loot feats and joke titles: *Scrap Metal Enthusiast*, *Retail Therapist*, *Independent Contractor*,
*Interior Decorator*, *Graveyard Shift*, *Cube Collector*, *Patch Notes*) and the contract titles of E1f.

## 1. The showcase piece

- **Finishes**: each night elite's weapon finish (E8c), the Warden sword finish (E10d), the Titan gold finish (E12h),
  worn from the Bag on the weapon they fit.
- **Titles**: the contracts' joke titles (*Pest Control*, *Forklift Certified*, *Plate Expectations*, *Middle
  Management*, *Thinks Outside the Box*) and the loot feats' titles, worn from the Character tab (Progress's worn title).

## 2. Engine / game / host work, just in time

Research:

- Finishes are permanent cosmetic effects (`heldFinishEffect`, `src/game/loadout/effects.ts:15`). Nalati ships
  `held/finishes` read by `src/game/shardfile/clientCosmeticFinishes.ts`; `src/game/loadout/cosmeticFinishes.ts` has
  **one user** (H059). Pine ships `held/finishes` too; its two Mott finishes and its contract `skin`.
- Titles exist: achievements have a `title` (`src/format/quests.ts:23`); `Progress` keeps `earned` and the worn `title`
  per shard (`src/game/Progress.ts`, `progressSave`).

Work:

| Row / mechanic | Shape | Layer |
|---|---|---|
| finish grant | `{ finish: <id> }` grant (W2b) lands the finish; the finish row names its weapon family | format + game (one finish host) |
| title grant | `{ title: <text id> }` grant, recorded in `Progress.earned` | game |
| retire | `cosmeticFinishes.ts` folds into the shared finish host; Nalati's five elite skins and two legendaries become finish rows | game, Nalati data |
| loot feats | achievement rows on counters (parts picked, upgrades bought, contracts, trophies, elites, Gold, patch kits → *Patch Notes* is dropped with patch kits: 19h) | data |

Host bar: finishes get three users (Pine, Nalati, the showcase). Guards: `host-callbacks`. Tests: `test/` finish tests
(grep `finish`), `test/achievement-counters.test.ts`; new `finish-title-grants.test.ts`.

## 3. Other shards in this slice

| Shard | Today | Migration | Proof | Save risk |
|---|---|---|---|---|
| Nalati | five elite skins, two legendaries via `clientCosmeticFinishes` (one-user host) | finish rows on the shared host | finish goldens on the sabre and bow (Opus); Bag DOM snapshot | **medium**: worn finishes saved in `ownedSave.worn`; ids unchanged |
| Pine | Mott's two finishes, contract skins | `{ finish }` grants (W2b moved Mott; this moves the contract's) | a finish worn in game | low |

## 4. Done when, hours, blockers

**Done when:** every showcase finish and title is granted by a row and wearable; Nalati's finishes look and save the
same; `cosmeticFinishes.ts` is gone or shared with 2+ users.

| Engine | Migration | Shard | Total |
|---|---|---|---|
| 6 h (Codex) | 8 h | 4 h (finish looks: Opus) | **18 h** |

**Blockers:** E8a (elite drops), E1f (contract titles). Soft: E8c, E10d, E12h fill it as they land.

## 5. Risks

- *Patch Notes* (25 patch kits) has no source since patch kits were cut (19h); it is dropped, which the loot plan's
  feat list didn't note.

## 6. Questions for Jake

1. **Replace *Patch Notes*.** Patch kits are gone. (a) drop the feat; (b) *Patch Notes*: buy 25 BENCH ammo crafts.
   **Recommended (b):** keeps the joke and gives the BENCH a feat.
