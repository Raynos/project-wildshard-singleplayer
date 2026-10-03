# Plan: LAYER-PURITY — each layer knows only what it should (E405, this session)

**State:** `archived` 2026-10-03 (finished 2026-10-03) — LP1–LP5 done: `layer`, `engine-words` and `shard-names` are hard errors at 0; LP6's Clef pilot ran (0 false alarms, caught the hidden leaks). Leftovers are open asks: E414 the app identity, E415 the generated boot tables, E416 adopt Clef (Jake's pick), E417 the interactables' props to #kit

Jake, 2026-10-03: the layers are engine → game → kit → shard. This plan makes the code match that, with a lint rule
per layer that ends as a hard error at 0. It carries out ARCH-GUARDS AG28 and is finished and archived this session.

| Layer | Knows | Never knows |
|---|---|---|
| `src/engine` | rendering, physics, audio, input, boot, levels in general | the game, Wildshard, that shards exist, any content (no deer, no loot, no Driftwood) |
| `src/game` | that it is Wildshard, that shards exist and run arbitrary content (bag, loot, travel, the title deck) | any particular shard (no Driftwood, no Nalati) |
| `src/kit` | reusable content: creatures (boar, deer, monkey), weapons, items, looks, used by any shard | any particular shard |
| `src/shards/<slug>` | its own details: places, people, quests, tuning, assets | another shard |

## Rows

| Id | Row | Measure | Rule (hard at 0) | Status |
|---|---|---|---|---|
| LP1 | The engine imports nothing above it | wrong-way imports: 21 → **0** | `wildshard/layer` | **done** 81cf4066 |
| LP2 | Engine code says nothing about the game, shards or content | `engine-words` hits: 266 → **0** | `wildshard/engine-words` | **done**, hard (cad1be5b) |
| LP2a | ↳ Driftwood-only content into Driftwood's folder: the Blender cove area, the sailor / crab / monkey voices (audio/gen.ts), the captain (explore/catalog.ts), the default level id (core/config.ts), perfProbe's rows | ~35 | | **done** fab438d4, 0802b3d0 (voices → #kit), 49ffd9fd |
| LP2b | ↳ the creatures into `#kit`: deer / elk species, AnimalManager's boar / bear / wolf / horse cases, creature models, HurtArc's names, fight rules | ~75 | | **done** 2c2e229f, b804b439, 4c50424b, d2aa3d39 |
| LP2c | ↳ items and weapons into `#kit` / `#game`: the item and weapon icons (ui/icons.ts), loot / coin / doubloon interactables, the bag (ui/Menu.ts, a shared HUD file: announce first), the spear touch control, rifle viewmodel textures | ~95 | | **done** dd2e42a1 (icons), 4c42cca5 (pickups), a408b2b9 (touch mode), 40991ca3 (material sets), cad1be5b (menu) |
| LP2d | ↳ the word "shard" (Jake: evict it too): code says "level"; player-facing engine copy that says "shard" moves into the game's string table | ~70 | | **done** c64d6d78 (wire contracts kept as named exceptions, Jake) |
| LP2e | ↳ the pine tree species into `#kit` (world/forest) | ~13 | | **done** 66848479 (placement byte-identical) |
| LP2f | ↳ hidden leaks the word list could not see (found by reading; "thrall" and "wildshard" join the word list so the rule sees them from now on): Pine Hollow's Antler King thralls (engine/ai/NightBrain.ts, the thrall hull path in AnimalFactory / species look / farHerd, elk's thrall variant, species/thrall.ts) → Pine Hollow; the Wildshard theme (engine/audio/score/wildshard-theme.ts) → the game; the engine string table's shard content (Driftwood's sailor label and the like, under hashed keys) → the owners' strings; the AnimalSound union of creature sound ids (done, 2c2e229f) | found 10-03 | | **done**: thralls → Pine (d47cbc07), the theme → the game (bd2e547d), the string table holds only the game's words (d95529c4); leftovers E414 (app identity), E415 (generated boot tables), E417 (the interactables' props) |
| LP3 | Game code names no particular shard | shard names in `src/game`: ~14 lines (session/play.ts, engineStrings.ts, Inventory.ts, session/finish.ts, bag/tabs.ts) | new `wildshard/shard-names` (game + kit: slugs, display names, unique stems, shard-scoped ids) | **done** d95529c4, hard |
| LP4 | Kit code names no particular shard | shard names in `src/kit`: 0 today | `wildshard/shard-names` | **done** d95529c4, hard |
| LP6 | Clef pilot (Jake's idea, E394's decision model): an advisory `layer-purity` decision set asks per touched file "does this depend on a particular shard's details?" (engine: "on game content?"), for what word lists can't see. Scored on a labelled set from this session's real moves; adopted only if it catches misses with no false alarms; runs at push, skips when the model lock is busy (`DECIDE_LOCK_WAIT`), never blocks | precision / recall on the labelled set | advisory only | **done** (pilot): 0/12 false alarms, 7/12 at 0.5, 9/12 at 0.3, the 3 hidden leaks caught; adoption is E416 (Jake's pick) |
| LP5 | The docs say it: ENGINE.md's layer table and §24, AGENTS.md's engine-layers section, SHARDS.md | — | — | **done** (AGENTS.md, ENGINE.md §24, SHARDS.md) |

**Done when:** `layer`, `engine-words` and `shard-names` are all on in `.oxlintrc.json` at 0; the full vitest, both
typechecks, whole-tree oxlint, check-paths and vite build + check-chunks are green; pushed and live
(version.json). Then this file moves to `project/archive/2026-10-03-layer-purity.md`, with any leftover as an open ask.

**Rules of the work:** one engine area per commit; a moved file keeps its public-index debt (AG3 pays it down);
shard files another agent is editing are left until they are idle; HUD files are announced over herdr first.
