# Kitchen Sink v2: what it means to touch the engine, the game and the hosts

For every lane that runs a slice ([README.md](README.md): platform work just in time, every other shard that uses it
migrated in the same slice, then the showcase piece). Researched from the code and docs at HEAD `749d7e7f44`
(2026-11-03); built products read from `out/*/sections/` (a working-tree build of 11:48 that day). Every claim below was
checked by grep unless marked **unverified**. The row map from the old plans is [COVERAGE.md](COVERAGE.md).

Short names: DW Driftwood Isle, PH Pine Hollow, NG Nalati Grasslands, ND Nine Dragon Stack, SR Sky Reach
(`far-reach`), SD Signal Dunes (`sunscar-dunes`), T `_template`, BT `blender-template`, IC `ink-cel-valley`,
PP `pastel-plain`, OP `open-plots`. The `-legacy` folders are frozen (SF73) and never migrated.

## 1. The layers and what each may know

| Layer (package) | Folder | May know | Never |
|---|---|---|---|
| format (`@wildshard/format`) | `src/format/` (398 files) | row schemas, section names, limits | runtime objects |
| engine (`@wildshard/engine`) | `src/engine/` | rendering, physics (the only Rapier import, `engine/physics/`), input, audio, boot, "levels" in general | the game, Wildshard, any shard, any content (E405); copy says "level" |
| game (`@wildshard/game`) | `src/game/` | that it is Wildshard and shards run arbitrary content; content two or more shards share | a particular shard (no slug, name, id or branch) |
| sdk (`@wildshard/sdk`) | `src/sdk/` | author build tools, bakers, trusted runtime facades | shard imports |
| commons (`@wildshard/commons`) | `src/commons/` (`catalogue.ts`, `scripts/abi.as`, `bridge.as`, `course.as`) | build-time packs and shared AS | runtime closures (`lint/commons-closure.mjs`) |
| shard | `src/shards/<slug>/` | everything particular to it: `data/`, `generators/` (build-time, never custom, G467), `behaviour/*.as`, assets | another shard; runtime TS (primary shards have none: `wildshard/no-shard-runtime`) |

Imports point down only. No barrels (E434): each `package.json` `exports` lists public modules and an import names the
defining module. No module installs a service by being imported: installers are functions the session calls. A
declaration merge other layers read lives in `*.merge.d.ts` (`src/game/equipmentTypes.merge.d.ts`,
`icons.merge.d.ts`, `items.merge.d.ts`, `nativeItems.merge.d.ts`, `population.merge.d.ts`, `rng.merge.d.ts`).

**`src/game/plugin/` is migration scaffolding** (HOST-BAR), 15,521 lines. It is not a layer to build on: a slice that
"moves X out of the plugin" moves X's own module and deletes it there, but `plugin/context` (`ShardContext`) is imported
by 134 modules outside the plugin and stays until SHARD-PLATFORM-NEXT N5. Importers outside the plugin today:
`plugin/geometry` 28, `plugin/headless` 25, `plugin/simulation` 14, `plugin/ui` 14, `plugin/brain` 13, `plugin/mover` 9
(six named in the matrix), `plugin/weaponFamily` 5, `plugin/heldFirearm` 5, `plugin/quests` 4, `plugin/nativeItems` 3.

## 2. The host bar (docs/HOST-BAR.md)

A host is shared code in engine / game / sdk / format that shards drive. It counts as platform only if it passes all six:

1. **Two real users** today, or a Jake-approved platform feature (G473–G478), or a pending-user entry naming a real
   future shard, plan row and recheck date. **G595: every one-user host needs Jake's own approval, host by host.**
2. **No shard nouns**: no slugs, ids, shard-only constants, `if (shard === …)` or `mode === 'board'` branches.
3. **Data-driven**: shards differ only in declared data, not in parameter lists shaped like one shard.
4. **Server-safe**, or labelled client-only presentation.
5. **Deletion test**: you would keep it if its first shard vanished.
6. **Data-only API** (G454 (5)): rows and ids in; a per-shard hook is an AS script reference, never a TS callback,
   subclass override, port object or `{owner, path}` reflection.

6/6 (or 5/6 failing only test 1 under its exception) = platform; 3–5 borderline (named fix, row, owner, recheck); 0–2
silly (back to the shard at once). Single-shot code is never a host: it is a row, a number or AS. Every report shows
shard lines cut **and** platform lines added (G455); a move is not a cut until the host passes. Known fails a slice
inherits: `held/equipment` + loadout `held.ts` score 2/6 (G496; W3b), the exchange's `{owner, path}` grants (test 6;
W2b), `BossBrain`'s `intro: (t, short) => Vector3` callback (`src/engine/ai/BossBrain.ts:46`, test 6; E-titan).

## 3. How a new host or a host change is born

The recipe, from two landed examples: `54867da20f` (Nalati stealth: a section, a game host, the shard onto it) and
`d3cf098233` (decision script rows: a section plus an SDK binding map). Do the steps in one slice; land them as small
commits in this order.

1. **Format schema.** `src/format/<name>.ts`, a valibot schema with an explicit declared type (`wildshard/explicit-schema-types`,
   G655), plain JSON only, finite limits; export it in `src/format/package.json`.
2. **Route it.** One of: a platform data section (`src/format/sections.ts` name → type, `src/format/platformDataSections.ts`
   name → schema); a Shardfile field mapped by `src/format/outputFields.ts`; a row in `src/format/shardSchema.ts` with
   its cross-field rule (`shardSchema.ts:278–292` is where traverse / ladder / item gates live); or a client-plan kind
   (`src/format/clientPlan.ts` + the kind → module table in `src/game/shardfile/clientPlan.ts`, checked by
   `lint/client-plan-boundary.mjs`). Never a `custom/` section (CS0: new custom sections are refused;
   `lint/custom-sections.json` only shrinks, G694) and never named JSON without a defining schema.
3. **Author schema and types.** Add it to `src/sdk/formatJsonSchema.ts`; regenerate section types with
   `scripts/bake-section-schemas.mjs` (run through `pnpm gen:source`; the commit hook's mirror only rebuilds missing
   generated section types, so run it yourself before landing a reader of a new field).
4. **The host.** `src/game/<area>/<host>.ts` (or engine, only if it is engine words), exported in `src/game/package.json`.
   Data-only API; a per-shard decision is an AS script reference resolved through `format/decisionScripts.ts`.
   Server-safe or labelled client-only.
5. **SDK facade** when authors build the rows (`src/sdk/<host>.ts`, `src/sdk/package.json`), e.g. `sdk/decisionBindingMap.ts`.
6. **Commons AS** when the logic is shared: `src/commons/scripts/<x>.as` on `abi.as`, registered through
   `src/commons/catalogue.ts` (`catalogueRef(id)`); a shard references it by id, never copies it.
7. **The bake.** The shard's `generators/output.ts` and `generators/product.ts` emit the rows (a committed generated
   source gets a row in `scripts/source-generators.mjs`; the old job controller `scripts/generation-jobs.json`, which
   `54867da20f` still edited, was deleted in `ffd68bd29e`); `wildshard build` then `wildshard validate out/<slug>`.
8. **The ruler and the standing.** Name the host in `scripts/shard-platform-hosts.mjs` / `scripts/shard-platform.mjs`;
   record it in `lint/platform-pending-users.json` + a HOST-BAR "Dated exceptions" line (today), or one row of the host
   register after W0d. Two users, or a G595 row Jake approved.
9. **Tests 2–6.** `test/<host>.test.ts` driven by an unrelated fixture shard (the house convention: an orchard, moor,
   reed marsh or cavern fixture), the real module through its seams (`wildshard/no-module-mock`), refusal cases.
10. **Docs.** JSDoc in source and an ENGINE.md manual section (the API tables are `pnpm docs` output, gitignored);
    a SHARDS.md section; a template example row in `src/shards/_template/data/` (built by `scripts/bake-template-shardfile.mjs`).
11. **Migrate every user and delete** (section 7), then the showcase piece.

## 4. The guards that fire

Never disable one; fix the code. Hard rules take no debt allowance. Ratchet increases need an exact
`Ratchet-Approved: wildshard-new <rule> <file> +<delta>` trailer per row; counts are lowered by the pusher from a clean
HEAD, never by hand.

| Guard | File | What trips it in a slice |
|---|---|---|
| `wildshard/layer`, `public-index`, `no-reexport` | `lint/wildshard-plugin.js`, `.oxlintrc.json`, `lint/layer-edges.json` | a host moved up a layer without updating every importer; a compatibility re-export left behind (refused: update the importers) |
| `engine-words`, `shard-names`, `no-shard-branch`, `no-level-identity` | `lint/engine-words.json`, `lint/shard-words.generated.json` | a moved file keeps a shard's ids or names (e.g. `engine/player/nalatiArms.ts`, `engine/world/steppeWind.ts`); new showcase ids become forbidden words in game code |
| `shard-sandbox`, `shard-game-imports`, `runtime-standalone`, `no-build-time-import`, `no-runtime-in-build` | `lint/shardfile-boundaries.mjs`, `lint/ratchet.json` | shard generators reaching runtime; showcase files start at 0 |
| `explicit-schema-types` | `lint/schema-types.mjs` | a new exported schema without an explicit type |
| host callbacks (test 6) | `lint/host-callbacks.mjs`, `lint/host-callback-syntax.mjs`, `lint/host-files.mjs` | a TS callback or port in a host API |
| `no-url-switch`, `debugRows` cap | `lint/url-params.json`, `lint/debug-flags.mjs` | a variant switch outside pause ▸ Settings ▸ Debug |
| `no-raw-hud`, `no-raw-input`, `no-inline-ui-string` | plugin rules | HUD pieces (also E332 herdr notice before a HUD change) |
| `no-module-mock` | plugin rule | `vi.mock` in a parity test |
| sim / commons closures | `lint/sim-closure.mjs` (`lint/sim-closure.json`), `lint/commons-closure.mjs` | render imports in sim; commons packs entering a runtime |
| generated imports / sources | `lint/no-generated-import.mjs`, `lint/generated-import-debt.json`, `lint/generated-source-debt.json` | importing a generated table from the wrong layer |
| custom sections | `scripts/custom-section-policy.mjs`, `scripts/check-custom-section-growth.mjs`, `lint/custom-sections.json` | any new `custom/` name; growth of a shard's named JSON |
| binary / base64 / tile debt | `lint/no-binary-json.json`, `lint/base64-debt.json`, `lint/tile-bake-debt.json` | a blob smuggled into JSON (D59's history) |
| row functions | `lint/row-functions.json` | a content row holding a function (may only shrink) |
| runtime files ceiling | `lint/runtime-files.json` | a runtime file added to a shard |
| platform ratchets | `scripts/check-platform-ratchets.mjs`, `lint/shard-platform.json` | custom-TS numerator rises |
| layout / manifests / graph | `scripts/check-shards.mjs` (`lint/shard-layout.json`), `scripts/gen-shards.mjs --check`, `scripts/check-graph.mjs` | a new shard folder, a manifest field nobody reads |
| API docs | `scripts/gen-api.mjs --check`, `lint/api-undocumented.json` (may only fall) | a new export without a doc line |
| storage | `scripts/repo-size.mjs` | GLBs > 1 MB, previews > 250 KB, > 10 MB binary per push |
| types | `node scripts/typecheck-root.mjs`; `tsc -b tsconfig.engine.json tsconfig.game.json` (build, not `--noEmit`); `src/sdk/tsconfig.test.json` for sdk tests | stale engine `.d.ts` hides a break |

Before landing a slice commit: types, `node lint/ratchet.mjs --files-from <touched>` (oxlint-fast misses
`generator-imports` and `shard-sandbox`), `pnpm exec vitest related --run <touched>`, then `scripts/commit.sh`. A product
change also needs a full `wildshard build` exit 0 (an aborted build skips the late policy checks).

## 5. Generated files: when to rebuild

All committed generated sources have one registry row in `scripts/source-generators.mjs`; `pnpm gen:source` writes
them, `pnpm gen:source --check` (in `pnpm lint`) and the pre-commit hook select them by input.

| Touch | Regenerate | Outputs |
|---|---|---|
| a schema / section | `scripts/bake-section-schemas.mjs` (via `gen:source`) | section types and wire schemas |
| a manifest, a new shard, a new id | `scripts/gen-shards.mjs`, `gen-shard-words.mjs` | `src/shards.generated.ts`, `src/game/shard/slugs.generated.{ts,json}`, `manifest-closure.generated.json`, `lint/shard-words.generated.json` |
| product bytes, boot packs, audio | `pnpm gen` (`gen-boot-cache.mjs`, `bake-packs.mjs`, `boot-publication.mjs`) | `src/game/boot/{bytes,packs,versions,audio}.generated.ts`, `scripts/boot-publication.generated.json` |
| starter weapons, bag, effects, arm clips | `gen-starter-*.mjs` | `src/game/weapons/starter.generated.ts`, `bag/starter.generated.ts`, `systems/effects/starter.generated.ts`, `systems/viewmodel/clips.generated.ts` |
| KTX2 art | `bake-ktx2.mjs` | `src/shards/<slug>/ktx2.generated.ts` |
| layout policy | `gen-shard-layout-doc.mjs` | SHARDS.md §2 table |
| API docs | `pnpm docs` | `docs/api/` (gitignored; never commit) |
| shard data | `wildshard build` | `out/<slug>/` (never committed) |
| ratchet counts, graph counts, debt | the pusher from clean HEAD | `lint/ratchet.json` and friends (never hand-edit upward) |

Gotchas: a schema or bake-output shape change breaks tests that pin the old shape or hash: `git grep` them and fix the
oracles in the same commit. A retired generator needs its outputs out of `scripts/source-generators.mjs`, the debt
files and `lint/no-binary-json.json`. A deleted module or data file: grep the bare basename across `src/` and `test/`.

## 6. The per-shard parity kit

Every migrated shard proves itself unchanged in the slice (README: focused tests always; 24-camera goldens when pixels
can move; one in-game look otherwise; an old-save fixture when saved ids or state move).

| Shard | Focused tests (start here; `vitest related` finds more) | Goldens | Saved state at risk |
|---|---|---|---|
| DW | 101 `test/driftwood-*`: `driftwood-barrel-saves`, `driftwood-quest-content-product`, `driftwood-mover-entry`, `driftwood-audio-environment`, `isolated-shard-driftwood-*-values` | `art/shardfile-goldens/driftwood-isle/24/` | `ws.owned.v1`, `ws.inventory.v1`, `ws.purse.v1`, `ws.bounty.v1`, flags named after interactable row ids, mover poses |
| PH | 85: `isolated-shard-pine-*-values` (11 files), `pine-*-product` (15), `quest-step-pine-native-parity` | `…/pine-hollow/24/` | the same keys, loadout ammo, longbow `had(id)` migration, weather continuation |
| NG | 198: `nalati-*`, `isolated-shard-nalati-*-values`, the four riding tests | `…/nalati-grasslands/24/` | bonded mount recipe, weather, `ws.elites.v1` |
| ND | 67: `nine-*`, `isolated-shard-nine-*-values`, `declared-portal-entry` | `…/nine-dragon-stack/24/` | practice room (none saved) |
| SR | `sky-*`, `quest-step-traces`, `mover-mechanic` fixture | `…/far-reach/24/` | mover lifecycle in the physics snapshot |
| SD | 31: `sunscar-*`, `isolated-shard-signal-*-values`, `quest-page-interactions` | `…/sunscar-dunes/24/` | low |
| T, BT, IC, PP | `template-*`, `test/scripts/_template-boss.test.ts`, `wildshard validate` | none (OP plots: 8 views each) | none |

- **Goldens:** the `goldens` skill (`.claude/skills/goldens/SKILL.md`, `docs/process/GOLDENS.md`): serve the candidate,
  capture `cameras24.json` through `scripts/browser-lane.sh`, board it, read every panel; WebKit too for shaders,
  textures, culling or perf cuts. An engine-wide move is all six shards, two lanes of three, about 10 min a shard.
- **Replays** (exact): mover poses per tick (`test/mover-mechanic.test.ts`), seeded weather logs, cue logs per tick,
  scripted course laps (`test/course-differential.test.ts`), quest step traces. Saves and replays are exact; looks are
  "similar, no glitches" by the goldens skill (G415), not zero-pixel.
- **Walk:** after any collider change `node scripts/physics-baseline.mjs --no-build --mode=walk` reports 0 stuck.
- **Saves:** declared shard state migrates by data (`format/migrations.ts`: `default / rename / drop / map` ops and
  `equipmentSlots` renames; `asHook` is reserved `null`, there is no AS migration ABI). The game-level keys above are
  outside declared state: a shim there is game code with one committed old-save fixture per affected shard under
  `test/fixtures/`. `Inventory.ts` drops unknown ids on load, so the shim and fixtures land first (W2a).
- **No shared parity kit exists yet** (old M0.1). Each slice commits the fixture it needs; the first slice that needs a
  helper (W2a old-save fixtures, W6a mover replay) puts it in `test/fixtures/` for the rest.

## 7. Cross-shard migration, step by step

1. **Find every user.** Products, not just source:
   ```bash
   git grep -lE '<module-or-kind>' -- src ':!src/shards/*-legacy' test           # source importers and tests
   grep -l '"kind":"<kind>"' out/*/sections/client/plan.json                       # declared client-plan kinds
   ls out/*/sections/<area>/                                                       # which products ship the section
   grep -rlE 'plugin/<module>[\x27"]' src --include=*.ts | grep -v '^src/game/plugin/'  # scaffolding importers
   node scripts/shard-platform.mjs                                                 # the ruler: users and charges
   ```
   Check the templates (T is the only product that fills `world/days`, `world/weather`, `actors/species`,
   `actors/creatures`, `combat/encounters`, `combat/strikes`; every shipped shard ships 18–52 B shells there) and the
   open plots (one `door.as`).
2. **Read the in-flight lanes first.** Custom-sections Z rows and WASM-HOST H13 are editing the same families today
   (section 9). A lane mid-task is never interrupted; take the boundary.
3. **Baseline:** capture the parity evidence on HEAD before changing anything (replay logs, goldens if pixels can move,
   the ruler table, the old-save fixture).
4. **Move the host** (section 3), then **migrate each shard** in its own small commit: its rows onto the host, its
   custom section / named JSON / shard-named code / duplicate AS **deleted in the same commit**, ids byte-identical.
5. **Prove each shard** with its kit (section 6); numbers in the commit message (G506: no receipts, no proof files).
6. **Delete the old path** (plugin module, schema, export, tests that pinned it) with every importer updated; retire
   charged-span rows in `scripts/platform-chargebacks.mjs` and its test in the same commit.
7. **Register** the host (two users or the G595 row), update HOST-BAR / ENGINE.md / SHARDS.md / the template row.
8. **Then the showcase piece**, data + AS only, behind Developer; land; request a push tick
   (`scripts/push-main.sh`, background). The slice is one sequence of small commits on `main`, never a branch.

## 8. WASM and AssemblyScript

- **The cap is nine modules per side, plus memory.** `src/format/scriptLimits.ts:5` `SCRIPT_LIMITS = { instances: 9,
  memoryBytes: 24 000 000, … }`, enforced in `format/decisionScripts.ts:94` (distinct decision modules),
  `format/assetAdmission.ts:195` (sim scripts + sim decision modules ≤ 9, script memory ≤ 24 MB) and `:209` (client +
  view modules ≤ 9), `engine/script/host.ts:82` and `game/grid/liveSession.ts:715`. `test/decision-module-cap.test.ts`
  pins it (G20a / G769 raised 8 → 9 for Pine's contract guest; BURN-DAMAGE-LIST D59).
- **Today's counts** (distinct `blobs/wasm/*.wasm` referenced by built sections, both sides together; approximate):
  PH **9** (at the sim cap), NG 15 (sim + view), DW 4, ND 2, SD 2, SR 1, T 1. Any slice that adds a Pine module (a
  commons law Pine adopts, the contract board in E1f) is refused until the cap moves.
- **Each module costs a GC on the phone.** `game/grid/liveSession.ts:711`: *"each declared script module's
  WebAssembly.Memory is a synchronous full GC on iOS JSC (40–80 ms each)"* (SF88e); modules are leased one frame apart
  at grid entry. Raising the cap trades entry hitches, not just a count (question 1).
- **Rules for AS** (HOST-BAR, SCRIPT-ABI.md): event-driven, at most 10 Hz, Script ABI commands only, within 10 % of the
  legacy lines it replaces (G463); per-shard logic only. Shared logic is commons AS, referenced not copied.
- **The ABI is moving.** WASM-HOST H13 (ABI v2 cutover, behind Developer, dual-compile check) is started for the view
  lane (G570), and its port list is the plugin's v0 `ScriptHost` users: `plugin/brain.ts`, `plugin/director.ts`,
  `plugin/weaponFamily.ts`, `plugin/mover.ts`, `engine/script/client.ts`: the same modules W3b, W6a, E1 and the
  E-director slice move. The old migration map said "don't run H13 during Wave 1" (question 3).

## 9. Memory and phone budgets, and work already in flight

- **Per shard: 1.8 GB loading, 1.2 GB Explorer** (AGENTS.md, G534 / G556); the Infinite Wildshard page total has no cap,
  only "don't crash". Render scale 2× on the phone; Low Power Mode caps 30 fps; the phone throttles about 2× in minutes.
- **The switch** is `src/format/memoryGates.json`: `mode: "report-only"`, `explorerMB: 1200`, `loadingMB: 1800`, `until:
  "SHARD-PLATFORM closes … explorerMB 1000"`. Nothing refuses memory today. `docs/process/RENDERING.md:18` still says
  1.0 GB Explorer (stale against G534). Per-shard ceilings ratchet in `budgets/ceiling-sources.json` (draws, tris,
  programs, `gpuMB`, frame ms); a ceiling is a ratchet, not the limit; nothing trips below 500 MB.
- **No enemy cap exists** (old EC1; no `maxAnimated` / `aiRadius`-style limit found by name search, **absence
  unverified beyond names**). The east bands need it (E0h).
- **No facade multi-draw anywhere** (E271 / E272); instancing only. Risky rendering or memory changes ship default-off
  behind a Debug row until a device reading.
- **In flight on the same files (2026-11-03, custom-sections mini plan Z rows):** Z6 (sp-x8) weapon pages into `held/*`:
  NG bow-page, rifle, sabre, spear, held slots; ND jian; PH loadout / finishes (overlaps W3a–W3c). Z13 (sp-x6) headless
  derivation. Open Z rows overlapping slices: Z4 populations (E1/E2), Z7 model library (W9b), Z8 quest documents incl.
  PH `custom/questRuntime` → AS (W1b, E1h / E1i), Z11 weather remainder (W11a), Z14 encounters and riding (W10a, E-titan),
  Z15 delete the custom path (after the slices that still read it).

## 10. Host × shard matrix

Who uses each system the showcase touches **today**, how, and the slice that moves them. West slice ids are from
[INDEX-west.md](INDEX-west.md); east ids are **provisional** (README's E rows; INDEX-east.md was not written when this
was; E0a–E0i and E1a–E1i slice files existed and are named where they fit): E0 levels / combat / HUD, E1 band 1 + contracts, E2 bands 2–6 + variants, E-elites, E-stealth (yard, storm hour,
beacons), E-vault (Training Vault shrine), E-gauntlet (wave director), E-titan (boss path, intro, portal arena),
E-quests (quest tiers), E-complete (shard-complete card), E-audio, E-balance, E-finish.

| System | Platform code today | Users today: how | Moves in | Check |
|---|---|---|---|---|
| NPCs, dialogue | `actors/npcs` (`questNpcs` field) | DW, PH, SR, SD ship `actors/npcs.json`; DW's row carries a stale `install.file` (`driftwood-isle/generators/questStory.ts`) | W1a | yes |
| Quests (author path) | `quests/quests`, `quests/host`, `quests/directors`; `game/quest/chapterDirector.ts` imports `plugin/director`, `plugin/quests`, `plugin/headless`, `plugin/context` | DW quests + host + `quest.composition` / `quest.world` / `quest.reference` kinds; PH quests + host + **`custom/questRuntime` 29 KB** (its only custom section left in `out/`); NG quests + `quest.chapter-view` + `behaviour/chapter.as`; SR, SD quests + host + directors + `quest.page`; ND quests (64 B) + directors; T `data/quests.json` | W1b (parity, additive fields); PH runtime E1h, E1i | yes |
| Contract board | `game/quest/contractBoardPage.ts` (imports `plugin/ui`), `format/contracts.ts` | PH only: `contracts.as`, `contractsRandom.as`, `contractsRules.as`; its guest is PH's ninth module | E1f | yes |
| Currency, pack, owned | `game/loot/Purse.ts` (`ws.purse.v1`), `Owned.ts` `OWNED` = DW ids (`ws.owned.v1`), `game/Inventory.ts` `ItemId` = PH ids + `PINE_PACK_KINDS` (`ws.inventory.v1`), `Bounty.ts` (`ws.bounty.v1`); `economy/loot`, `economy/ledger` | coins in the manifests of DW, SR, SD, T, IC, PP; `economy/loot` DW 10.9 KB, PH 3.9 KB, the rest 21 B; NG, ND no purse | W2a | yes |
| Shops (exchange) | `format/exchange.ts`, `game/quest/trader.ts` (imports `plugin/ui`), `format/catalogueEconomy.ts` | DW Maren; PH Mott (barter, `addBolts`) | W2b | yes (trader import); users per W2b |
| Melee (sword, spear, sabre) | `held/arms` (`format/heldArms`), `game/weapons/heldPolearm`, `heldDecision`, `mountedBlade`, `game/shardfile/clientHeldMelee` (imports `plugin/weaponFamily`, `plugin/simulation`); `held.melee` kind | DW, ND `held/arms`; NG spear + sabre (`heldWeapons.as`, Z6 in flight); SR, SD `held.melee`; T `data/moves`; `meleeProfile` read by DW, NG | W3a (spear's second user); W3d proves the rest bit-identical | yes |
| Bow, crossbow, ammo | `held/equipment` (PH 102 KB, 2/6), `game/plugin/weaponFamily.ts` (571), `engine/combat/ammo.ts` (also read by `game/weather/forest.ts` for `wetFlight`), **`engine/player/nalatiArms.ts`** (an engine file named after a shard; read by `game/weapons/starterBowProfile.ts`, `heldLauncher.ts`) | PH crossbow + longbow (`held/equipment`, `gear`, `loadout`, `held.ranged-page`, `held.ranged-feel`); NG recurve (`boot/bowVariant*.json`, `held.ranged-feel`, mounted) | W3b | yes |
| Firearms | `game/plugin/heldFirearm.ts` (391), imported by `combat/roamingSession`, `weapons/heldLauncher`, `loadout/claims`, `loadout/rangedPage`, `loadout/held` | PH lever rifle (`held.ranged-page`); NG roaming / mounted rifle (Z6 in flight) | W3c | yes |
| Parry | none (a clip name in `game/systems/viewmodel/clips.generated.ts`) | nobody | W3d (opt-in) | yes |
| Personal-best records | none saved; `game/practice/numericCourse.ts` keeps `best` in memory | NG riding and ND grapple Explore rooms (`practice.course`) | W3a host, W6d rooms | yes |
| Interactables (plates, levers, doors, barrels) | `engine/world/interact/types.ts` `PlateDef`; no platform section | DW `generators/interactables.ts` → named JSON + `barrels.as`; PH `generators/questTable.ts`, `questGraph.ts` (via `sdk/interactions`); SD `generators/signalInteractions.ts`; T `door.as` `items.as` `idle.as`, IC 3 and PP 3 AS files, BT 1, OP one `door.as` | W4a | yes |
| Physics props, joints | `sim/bodies` (`format/bodySlots`), `engine/physics/bodies.ts` | DW only (`sim/bodies.json`: one barrel); PH `world/physics` is creature physics, not props; no joints anywhere | W4a, W4b | yes |
| Board, tricks, rails | `engine/player/board.ts` (law stays engine); look to game (HA4d); `world/traversal` | every product's `world/traversal` is `{hoverCap}` only; the board is on every shard and the highway | W5a (all shards, paths only), W5b, W5c | yes |
| Movers | **`game/plugin/mover.ts` (599), imported by `quest/pageFacets`, `quest/pageComposition`, `quest/declaredPage`**, `bake/entryways`, `shardfile/decisions`, `shardfile/clientMoverOwners` | `world/movers`: SR 39.9 KB, DW 6.4 KB (+ `world.movers` kind, `generators/moverBake.ts` drivers `boat.as`/`bridge.as`), PH 1 KB, SD 0.6 KB, others empty; ND `movers.as` is view WASM, not this host | W6a | yes |
| Conveyor, jump pad, updraft | `state/modes` traverse rows | SR `updraft` only; no conveyor or launch anywhere | W6b | yes |
| Zipline, grapple, ride | `state/modes` `traverse` / `grapple` / `ride`; gated on a quest page or runtime `modes` (`format/shardSchema.ts:285`); `engine/sim/cableTraversal`, `game/grapple/*` (`tool.ts` imports `plugin/headless`) | zipline DW, PH; grapple ND; ride NG | W7a, W7b (riding W10a) | yes |
| Ladders, climb, scramble | ladder rows need the data-only player owner (`shardSchema.ts:286`); `DrivenMode` names `climb` | none | W8a, W8b | yes |
| Rope bridges | `game/models/ropeDeckSite` (H026), `engine/physics/ropeChain.ts`, `bridgeSway.as` | DW only (`rope-deck`, `rope-chain` kinds); SR's "bridges" are movers; NG's kunes bridge is static | W6c | yes |
| Interiors, caves, portals, arenas | `format/caveInterior.ts`, `game/shardfile/clientForestPage`; **`game/shardfile/walkInPortalRide` imports `plugin/director`**; `game/boss/arenaRoom.ts` (1,641; imports `plugin/bossPhase`, `scene`, `headless`); `engine/practice/playground/Playground.ts:26` `PLAYGROUND_Y = 3000` | PH crag cave (`world.forest-page`); ND `portal.ride`; NG `arena-room`, `arena-room.entry`; NG and ND playgrounds at y 3000 | W0e (cube), W9a (cave), E-vault / E-titan (portals, arena) | yes |
| Finds, perks, trophies, compendium, achievements | `format/findsCatalogue.ts`, `game/models/collectionWall.ts`, `collections/displays` (DW, ported `3c42144c50`), `ui/compendium`, `game/achievements.ts` | finds DW (`generators/finds.ts`), NG `bag.finds`; trophies DW (10 files), PH (12), NG (3); **every product ships `ui/compendium`**, PH fills it (icon picklist in `format/compendiumRows.ts:21`); **achievements in all 10 products** | W9b (collectibles, record feats), E-elites (trophy wall), E-complete (loot feats) | yes (file counts) |
| Cosmetic finishes | `game/loadout/cosmeticFinishes` (H059), `held/finishes` | PH, NG `held/finishes`; NG `held.cosmetics`, `cosmetic-finishes` | E-elites (proposed) | yes |
| Mounts | `game/riding/*` (eight G478 hosts) | NG only (`riding.session`, `taming.entry`, `mounts.as`) | W10a | yes |
| Weather, day / night | `format/forestWeather`, `game/weather/forest.ts` (imports `engine/combat/ammo`, `engine/world/steppeWind`, `population/wildlife`, `audio/voicePatches`, `looks/keyedSky`); **`engine/world/steppeWind.ts` also read by `game/looks/paintedLook` (SR, SD), `grassPresentation`, `population/wildlife`, `shardfile/worldUpdates`**; `world/days`, `world/weather` are 21 / 24 B shells in every shipped product | PH, NG `weather.forest`; SD `weather.fields`; `dayCycle` in DW, PH, NG, T, IC, PP manifests | W11a | yes |
| Audio states, stings | `format/audioProfiles.ts:67`: four fixed stings `pickup, death, chunk, dawn`; `engine/audio/score/score.ts`; `game/audio/sceneDirector`, `voicePatches` | `audio/audio` everywhere: DW 68 KB, PH 19.7 KB (boss layers), NG 44.7 KB + `audio.scene`, ND 9 KB, SR, SD, T < 1 KB; `audio.cues` kind PH, NG, SR | W11b (stings, one genre), E-audio (band / boss / elite fields, metal, combat cues) | yes |
| Elites | `format/eliteFeature.ts`, `engine/ai/EliteBrain`, `eliteRoster`, `game/eliteSystem.ts` (`ws.elites.v1`) | PH (`night.as`, `ghost.as`, `imperial.as`, `ironhide.as`, `blackpaw.as`, elite rows); NG (`elite.entry`, `elite.construct`, `eliteViews.as`) | E-elites | yes |
| Boss path | **five paths**: wake (`game/boss/wake.ts` + `bossEncounter`); phased (`sdk/phasedBoss` → `game/plugin/bossPhase.ts`, 1,007); held (`boss.held`, `game/shardfile/bossRow.ts` `HeldBossBrain`); spawned (`boss.spawned`, `DirectorBossBrain` from `plugin/director`); sim script (T `boss.as`) | DW Captain (wake, `captain.as`); PH Antler King (phased, `king.as`, `generators/kingFight.ts`); NG Storm Titan (phased through `arenaRoom`, 13+ `titan*.as`) and Golden King; SR Roc (held + `boss.telegraph`, `roc.as`); SD Matriarch (spawned + `boss.telegraph`, `matriarch.as`); T `boss.as` | E-titan | yes |
| Boss intros, cutscene timeline | `BossBrain.ts:46` `intro` callback; `src/engine/cinematic/` does not exist | five intros (DW, PH, NG ×2, SR, SD per IN-GAME-CUTSCENES IC0; per-shard list **unverified** here) | E-titan | partly |
| Wave director | `format/directorStages`, **`game/plugin/director.ts` (435), imported by `quest/chapterDirector`, `quest/chapterClock`, `shardfile/walkInPortalRide`, `shardfile/clientQuestPage`, `shardfile/bossRow`** | DW `director.as`, `directorV2.as` (via `generators/guestPrograms.ts`); PH the same pair (`generators/sourceOutput.ts`); `quests/directors` in T, SR, SD, ND | E-gauntlet | yes |
| Stealth | `game/stealth/controller`, `stealthLaw`; `player/stealth` | NG only | E-stealth | yes |
| Shrine host | none (pieces: arena room, plates, director) | nobody (DG5 proposes DW's sea cave) | E-vault | yes |
| Completion card | `format/completion.ts`, `ui/completion` | DW (`generators/completion.ts`) and T; nobody else | E-complete (backfill all, then the rule) | yes |
| Levels, combat maths | none (no `game/progression/`, no `levelMath`); `fight.maxHitDamage` read by `game/session/play.ts`, `loadout/effects.ts`, `engine/level/spec.ts`, declared only by DW | nobody; opt-in (19z) | E0a–E0d, E0i | yes |
| Enemy cap | none found | — | E0h | names only |
| HUD pieces | `engine/ui/` (HUD, hudSlots, LockOn, Combat, Menu, tabs, BossBar, EliteBar, WindupWarn, FirstHints, playerDeath); quest HUD in `game/plugin/ui.ts`, `game/quest/story.ts` | one HUD for every shard; no shard imports `engine/ui` at play (PH, NG, ND generators only) | W1b (quest list, markers), W3d (guard), W5b (trick score), E0e / E0f (level, XP, nameplates, numbers, Character tab): each an E332 notice | yes |
| Shard cube (19ad) | bake bounds `sdk/bake/terrain.ts:34`, `props.ts:227`, `world.ts:58`, `format/contentBounds.ts`; spawn `shardSchema.ts:293`; unchecked: `format/portalLink.ts:10` destinations, cave volumes, arena rooms | PH cave, ND portal, NG arena + playgrounds (y 3000) | W0e | yes |
| Decision modules | `format/scriptLimits.ts:5` (9 per side, 24 MB) | PH 9 (full), NG 15 over two sides, DW 4, ND 2, SD 2, SR 1, T 1 | W0e | approx. |

### What the matrix shows that the plans did not

1. **The mover and director scaffolding is wired into quests.** `plugin/mover` is imported by three quest page modules
   and `plugin/director` by the chapter director, the chapter clock, Nine's walk-in portal ride and two boss paths. W6a
   (movers) and W1b (quests) edit `src/game/quest/` together; the east director move touches quests, Nine's portal and
   the Sky / Signal boss rows. Sequence them (question 4).
2. **Weather is coupled to arrows, wildlife and the painted looks.** `game/weather/forest.ts` reads `engine/combat/ammo`
   (`wetFlight`), and `steppeWind` (the "un-named wind" in W11a) is read by SR's and SD's `paintedLook`, the grass and
   wildlife. W11a proves four shards' looks, not two, and runs after W3b.
3. **Pine is at the module cap now** (9 of 9), and each module is a 40–80 ms GC on iOS at grid entry.
4. **The template is the only real user of six platform sections** (days, weather, species, creatures, encounters,
   strikes): every shipped shard ships empty shells. So T is in every host family a slice touches.
5. **Some families are every product:** achievements (10), `ui/compendium` (all), coins (6 manifests), the board
   (all + highway), `audio/audio` (all), the HUD. An additive field there still needs a validate of every product.
6. **Five boss paths, not four**, counting T's sim-script boss.
7. **`engine/player/nalatiArms.ts`** is a shard-named engine file on the bow path; W3b has to carry HA4d's move.
8. **Custom-sections lanes are in the same files today** (Z6 weapons, Z13 headless; Z4, Z7, Z8, Z11, Z14 open) and
   **WASM-HOST H13** ports exactly the plugin modules the slices move.
9. **Memory is not enforced anywhere** (report-only) and RENDERING.md disagrees with AGENTS.md on the Explorer cap.

## 11. Questions for Jake (cross-cutting; one recommendation each)

Already decided, not asked: whole host families migrate; tests + goldens where pixels move; Jake plays at the end of
each half; parallel toy slices after W0–W2. Slice-local questions stay in the slice files.

1. **The decision-module cap, given the phone cost.** W0e recommends 9 → 32, but each module's `WebAssembly.Memory` is a
   synchronous 40–80 ms GC on iOS at grid entry (`liveSession.ts:711`), so 32 could add 1.3–2.6 s of hitches. (a) 32
   now; (b) 16 per side now, more only after a Simulator grid-entry reading; (c) keep 9 and pack laws per zone.
   **Recommended (b):** the west needs about seven, Pine is at nine, 16 covers the west and E0–E1 with headroom, and the
   reading (one Simulator run at W12) decides the east's number on evidence.
2. **What "touching a host family" obliges.** (a) any change, even a new optional field, normalises every user's
   variant of that system (e.g. W1b would have to collapse DW / PH / NG / SR's quest paths); (b) a slice that changes
   or replaces what users run migrates them all; a purely additive optional field only proves every user unchanged
   (validate every product + their focused tests). **Recommended (b):** it keeps the slice rule's "no half-migrations"
   for real changes without dragging Pine's questRuntime into W1b; the additive case is still proved on every shard.
3. **The ABI under the slices.** WASM-HOST H13 (ABI v2) is started and ports `brain.ts`, `director.ts`,
   `weaponFamily.ts`, `mover.ts`: the modules W3b, W6a, E1 and E-gauntlet move. (a) slices move hosts on today's ABI and
   every new AS joins H13's dual-compile check; H13's flip lands only between the halves; (b) H13 flips first and the
   slices wait; (c) each slice ports its module to v2 as it moves. **Recommended (a):** no slice waits, no slice carries
   a second migration, and the flip has one quiet window (after W12).
4. **One owner for `src/game/quest/` at a time.** W1b, W2b (trader), W6a (mover importers) and later E1 / E-gauntlet all
   edit quest modules. (a) run them strictly in turn, as INDEX-west already does for HUD pieces; (b) let them run in
   parallel and merge hunks. **Recommended (a):** W6a lands its quest-import changes as one small first commit, then W1b;
   same-file hunks across lanes are where whole-file commits have taken peers' edits before.
5. **In-flight custom-sections rows on slice files.** (a) Z rows already in flight (Z6, Z13) finish first, and open Z
   rows that overlap a slice fold into it ("run here", like HA0 / N2 rows) with the CS plan marked; (b) the CS plan keeps
   them and slices wait; (c) slices take over in-flight Z rows. **Recommended (a):** never interrupt a lane (G492-style),
   and never build the same family twice: Z4 → E1, Z7 → W9b, Z8 → W1b / E1, Z11 remainder → W11a, Z14 → W10a / E-titan.
6. **The parity bar for migrations.** The Z rows use exact bars (zero-pixel A/A + A/B, identical payload bytes); G415
   says "similar, not identical, no glitches". (a) exact for saves, ids, replays and payloads where a row only moves;
   the goldens skill's green (G415) for looks; (b) zero-pixel for every migration. **Recommended (a):** exactness where
   a player could lose something, G415 where only the look could drift; zero-pixel bars are what made CS rows take days.
7. **One-user hosts the showcase creates** (ladder law, scramble climb, records, hinge joint, tricks, rails, conveyor /
   launch, the world course host, the given mount, the shrine host…). (a) land each as "pending, showcase first user"
   in the W0d register with a recheck date and bring them as one G595 sheet at the end of each half; (b) ask host by
   host as each lands. **Recommended (a):** G872 says never wait on a pick; two batched sheets are two question panels,
   not fifteen.
8. **Save shims.** Declared state migrates by data, but `ws.owned.v1`, `ws.inventory.v1`, `ws.purse.v1` are game-level
   keys outside it. (a) ids stay byte-identical, the shim only maps unions to rows, one committed old-save fixture per
   affected shard, never a key-version bump; (b) bump to `.v2` with a converter. **Recommended (a):** an old save loads
   unchanged and nothing can drop items on load (`Inventory.ts` drops unknown ids).
9. **The memory switch.** `memoryGates.json` is report-only at 1,200 MB "until SHARD-PLATFORM closes … 1000", and
   RENDERING.md says 1.0 GB. (a) W12 measures every shard and flips `enforce` at 1,200 (G534) if all pass, and fixes the
   two stale texts; (b) leave it report-only until SHARD-PLATFORM closes. **Recommended (a):** the showcase is the
   biggest single cell yet, and the stale "1000" would cap it 200 MB below the agreed limit.
10. **Codex lanes for this plan.** AGENTS.md names only SHARD-PLATFORM and GAME-NORMALIZATION for Codex lanes; the
    5 + 5 crew (11-02) is in the plan, not in AGENTS.md. **Recommended:** add KITCHEN-SINK to that AGENTS.md line in the
    commit that starts W0, so lanes don't refuse their own brief.
11. **Template example rows.** (a) each slice adds its template example row (about 0.5 h, the proof that a new shard
    can author it); (b) W12 / E-finish batch them (old W21). **Recommended (a):** T is already in every family it touches.
