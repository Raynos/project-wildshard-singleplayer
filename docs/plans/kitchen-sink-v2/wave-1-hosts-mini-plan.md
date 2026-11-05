# Mini plan: KITCHEN-SINK v2 Wave 1, the host work first

Parent: [KITCHEN-SINK.md](../KITCHEN-SINK.md) §4. Jake, 2026-11-02 (E523): *"All the host and engine work has to be
front loaded before we start building the kitchen sink … if we have to make existing hosts more generic and more
friendly, if we have to get rid of some custom JSON in the shard files, then yeah, sure, that's approved."* Then:
"Yes, all of it" to about 380 h, run as its own lane plan.

Source: a read-only host audit, 2026-11-02, against the features in the parent's §2. It ran before levels, the economy
redesign and the shrine host were added; those rows live in their own mini plans (LV, LE, DG) and join this order at
step 5. Effort figures are the audit's estimates.

## State key

G = generic and shared · 1U = one real user (needs the showcase as its second user, and Jake's approval host by host,
G595) · SO = shard-only rows or AS · M = missing.

## Corrections the audit made to earlier notes

- Pressure plates exist in the engine (`engine/shared/world/interact/types.ts` `PlateDef`, `plateOverlap`); only the puzzle
  logic is in Driftwood's `barrels.as`, and no platform section admits interactables (Driftwood ships named JSON).
- Zipline is shared (Driftwood and Pine, `engine/sim/cableTraversal`).
- The arena room has a real user (Nalati's storm titan).
- A wave director exists (`format/directorStages` v2) but runs in `game/shared/plugin/director.ts`, which N5 deletes.
- Night-only enemies exist (`format/eliteFeature.ts` night/dusk/storm rule).
- Spinners and sliders exist as mover tracks; lifts use the winch ride driver.
- Parry is only an animation clip; no mechanic. The held-equipment schema is Pine-shaped.
- Shared AssemblyScript lives in `src/commons/scripts/`.

## Rows

| Row | Feature | State | Work | Key files | h |
|---|---|---|---|---|---|
| W1 | Ruler + one host register | — | HOST-AUDIT HA0 a–f, HA1, HA5 slice: an honest "0 % custom TS", promoted hosts credited | `scripts/shard-platform*.mjs`, `lint/platform-pending-users.json` | 20 |
| W2 | Interactables section | engine G, data SO | `world/interactables` platform section (bench, chest, key, door, lever, plate, barrel, altar, beacon) replacing Driftwood's named JSON | `engine/shared/world/interact/types.ts`, `format/sections.ts` | 8 |
| W3 | Commons AS prefabs | SO | Promote `barrels.as` and `bridgeSway.as`; add a wave-director stage script beside `course.as` | `src/commons/scripts/`, `commons/catalogue.ts` | 12 |
| W4 | Movers and director out of the plugin | G in scaffolding | N2/N5 slice: real game hosts reached from client-plan rows; save parity | `game/server/plugin/mover.ts`, `director.ts`, `format/directorStages.ts` | 20 |
| W5 | Quests, dialogue, vendor, currency, shop | G, three quest paths | One author quest path (CS5, retire `custom/questRuntime`); trade rows with an upgrade effect; generic `Owned.ts` kinds | `format/questStory.ts`, `game/client/quest/trader.ts`, `game/shared/loot/Owned.ts`, `format/exchange.ts` | 28 |
| W6 | Held weapons | sword, bow G; spear 1U; crossbow, rifle, ammo SO; parry M | `held/equipment` as weapon-family rows; `heldFirearm` out of the plugin; ammo rows; parry window + stagger on the melee profile | `format/heldEquipment.ts`, `game/client/plugin/heldFirearm.ts`, `engine/shared/combat/ammo.ts`, `meleeProfile.ts` | 36 |
| W7 | Loaner mount | 1U (Nalati) | A given-mount roster row with no taming session | `game/server/riding/roster.ts`, `native.ts` | 14 |
| W8 | Riding course | G | Docs and a template example | `game/client/practice/course.ts` | 2 |
| W9 | Conveyor, jump pad | M | A surface-velocity box row and a launch trigger row in the character motor, through the host bar | `engine/shared/physics/CharacterMotor.ts`, `format/movers.ts` | 16 |
| W10 | Grapple, stealth | 1U | Approvals (showcase as second user) | `game/grapple/*`, `game/stealth/*` | 6 |
| W11 | Elites, waves, boss | elites G; boss in four paths | One boss row set: phases, telegraphs, `arenaFire` hazards, `arenaRoom`; fold H110; CS8 | `game/boss/*`, `format/bossProfiles.ts`, `bossEncounter.ts` | 36 |
| W12 | Cutscene intro | M | IN-GAME-CUTSCENES IC1–IC4: `engine/cinematic` timeline, `sdk/cutscenes`, a boss `intro` row; port `BossBrain`'s intro | `src/engine/cinematic/` (new), `engine/shared/ai/BossBrain.ts` | 40 |
| W13 | Weather, day/night | G, forest-named | Rename the `weather.forest` / `world.forest-page` kinds; unify Pine's and Nalati's weather envelopes (CS7); a storm-hour quest trigger | `format/forestWeather.ts`, `game/client/weather/forest.ts` | 14 |
| W14 | Physics props, hoverboard, tricks, see-saw | props SO; board misplaced; tricks M; see-saw M | Dynamic-prop rows; move the board to game (HA4d); trick events → score rows + commons AS; a hinged-body row | `engine/shared/physics/bodies.ts`, `engine/shared/player/board.ts` | 32 |
| W15 | Portal, interiors, caves | portal 1U; cave SO | A generic `world/interior` (cave is one kind) split from the forest page (H073). **The shard cube** (Jake 11-03, ruling 19ad): every interior and every portal destination must lie inside the shard's own 500 × 500 × 500 m cell (`core/config` `CELL_BELOW` / `CELL_ABOVE`, ±250 m); a shardfile validator rule refuses an interior outside the cube, two volumes that overlap, or a portal to anywhere but its own cube; documented in SHARDS.md | `game/client/shardfile/walkInPortalRide.ts`, `caveInterior.ts`, `clientForestPage.ts`, `format/shardSchema.ts` | 24 |
| W16 | Benches, secrets, perks, trophies, finishes | mixed | Flag → feat rows; finds `every: N` → perk rows; elite-drop finish grant row | `format/findsCatalogue.ts`, `game/client/models/collectionWall.ts`, `game/client/loadout/cosmeticFinishes.ts` | 18 |
| W17 | Shard-complete card required | G, two users | Backfill `ui/completion` in every product, then a validator rule that requires it (Jake 11-02) | `format/shardSchema.ts`, `format/completion.ts` | 14 |
| W18 | Ladders, scramble, rope bridge | ladders G; scramble M; rope bridge 1U | Build the `climb` mode for scramble surfaces; generalise the rope-deck site | `engine/shared/player/modes.ts`, `engine/shared/physics/ropeChain.ts`, `game/client/models/ropeDeckSite.ts` | 28 |
| W19 | Audio | G | Check elite and boss music states and stem layers exist as rows; small schema addition if not | `format/audio.ts`, `engine/client/audio/score/score.ts` | 7 |
| W20 | Breadcrumb guide | built twice | Merge the two | `engine/client/quest/view.ts`, `game/client/quest/chapterDirector.ts` | 6 |
| W21 | Docs and template | — | A SHARDS.md section per feature; template example rows; Jake's approval sheet | `docs/SHARDS.md`, `src/shards/_template/` | 12 |
| | **Subtotal** | | | | **~386** |
| LV | Levels, XP, attributes, combat maths, hidden L1 parity, HUD | M | [levels-combat-mini-plan.md](levels-combat-mini-plan.md) | | tbd |
| LE | Economy and loot | partial | [loot-economy-mini-plan.md](loot-economy-mini-plan.md) | | tbd |
| DG | Shrine host | M (pieces exist) | [mini-dungeon-mini-plan.md](mini-dungeon-mini-plan.md) | | ~40 |

## Order

W1 → W2, W3 → W4 → W5–W19 in parallel (W11 needs W4; W12 needs W11) → LV, LE, DG (LV's damage stage needs W6 and
W11) → W20, W21.

## Cleanup in other plans (cross-referenced, not absorbed)

Jake, 2026-11-02: keep them separate. These rows stay owned by their plans; Wave 1 sequences around them and
never duplicates them.

- HOST-AUDIT: HA0, HA1, HA5 (W1); HA4b for the forest family (H073), `ropeDeckSite` (H026), `cosmeticFinishes` (H059),
  `sceneDressing`; HA4d for the hoverboard, `engine/player/nalatiArms.ts`, `engine/shared/world/steppeWind.ts`, HUD item labels;
  HA4e for the plugin routes; H110.
- Custom sections HA7: CS5 quests and `questRuntime`, CS6 the director envelope, CS7 weather and held kits, CS8 combat,
  boss and riding. CS10 (deleting the custom path) can follow after the showcase.
- SHARD-PLATFORM-NEXT: N2/N5 slices for `mover.ts`, `director.ts`, `heldFirearm.ts`, `bossPhase.ts`.
- WASM-HOST: H8 only if combo and parry windows move to AS; H14 (a pure-AS demo shard) folds into the showcase.
- IN-GAME-CUTSCENES: IC1–IC4.
- BURN-DAMAGE-LIST: D53 (with D192): the full ratchet and the scoped gate disagree, which blocks an honest 0 % reading.
  The showcase's AS count may hit D59's decision-module cap of 9 per product.

## Riskiest

1. W11 + W12: boss unification plus the cutscene timeline re-homes five shipped boss intros across four boss paths.
2. W4 + W6: moving movers, the director and firearms out of the plugin touches Driftwood and Pine saves and fixed-step
   ownership.
3. W17: the required completion card is red on every product without it; backfill first, rule last.
4. LV: hidden level-1 parity on every existing shard (no feel change).

## Rules for the lanes

Each new host passes the host bar (docs/HOST-BAR.md: six tests, data-only APIs, no shard branches). Every row that
changes a shipped shard proves it unchanged with that shard's focused tests and a look at it in the game. Graphical
work is Opus-only (G848).
