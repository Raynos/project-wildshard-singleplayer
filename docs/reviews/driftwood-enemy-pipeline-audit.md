# Driftwood enemy pipeline audit

**Status:** unread 2026-10-18 — source findings and implementation/test plan.
**Plan:** [DRIFTWOOD-ENEMIES](../plans/DRIFTWOOD-ENEMIES.md)
**Made by:** E487, dot audit

Source baseline: `gamedev-dot` at `11c99f5f2b037f77de45f454d9b74b491110df63`, 2026-10-18. Read-only source findings below are separate from runtime verification. Requested next content: three regular enemies, one elite, one boss.

## Six shards and counting rules

A species/body kind, a variant, an encounter and a placement are different counts. Rarity does not imply an elite encounter. Shared species reused by a shard count once in that shard; frozen `-legacy` copies do not add enemies. Non-hostile wildlife, props and NPC models are excluded from hostile totals.

- **Driftwood Isle** (`driftwood-isle`): six hostile body kinds: boar, bear, reef crab, coconut monkey, drowned sailor, Drowned Captain. Six boar and five bear variants are inherited, plus two crab, two monkey, one sailor and one captain: 17 defined variants. Normal placement restricts boars to four variants and bears to three. No separate named elite encounter found. Big crab and elder monkey are uncommon variants, not extra species. Captain is the single boss, 320 HP, three phases at 1/.66/.33 despite its variant rarity being `uncommon`. Current deterministic phone/desktop enemy generator returns 9 crabs, 11 monkeys and one sailor; authored fauna adds 11 boars and two bears. Thus 34 ordinary placements plus a conditional boss, not 35 distinct enemy types. Sources: `generators/enemySpecies.ts`, `monkeyVariants.ts`, `fauna.ts`, `faunaSpecies.ts`, `enemyPlacement.ts`, `data/bossEncounter.json`.
- **Pine Hollow** (`pine-hollow`): four wildlife body kinds (deer/elk normally non-aggressive; boar/bear aggressive), plus Antler King. Base variants: deer 7, elk 5, boar 6, bear 5. Two spawn-only thrall variants (boar and elk). Four named elites reuse variants: Old Ironhide, Ghost Stag, Old Blackpaw, Imperial Bull. Antler King is a separate boss. Rare rows such as Scarback, Grizzled Sow, Piebald Hind and Pale Elk are not automatically separate elites. Generated fauna requests 90 deer, 22 elk, 53 boar and three bears (168) before elite replacement/night/boss systems; `population.ts`'s native bodyCount is 164 and must not be presented as the same measure. Sources: `generators/speciesRows.ts`, `deerRows.ts`, `elkRows.ts`, `eliteRoster.ts`, `population.ts`, `data/bossEncounter.json`, shared `game/systems/species/{boar,bear}.ts`.
- **Nalati Grasslands** (`nalati-grasslands`): ordinary hostile families are steppe wolf (5 variants including alpha), balbal warrior (2), ghost rider (rider and captain). Named elites: Aqbars the Pale (leopard), Kokbori, Qyran the Storm-Wing (eagle), Qara Batyr (ghost captain), Argymaq the Unbroken (horse-taming challenge, not ordinary hostile wildlife). Two bosses: Golden King (2400 HP) and Jel Ata / Storm Titan (2600 heart HP; custom encounter target rather than an ordinary species). Eight hostile body/target families if the Titan is counted, plus Argymaq's nonstandard challenge. Do not double-count Qara's ghost-horse fallback as a second enemy. Boot wolf pack is five; night/dusk/boss add populations are conditional. Sources: `data/eliteEncounters.ts`, `data/fauna.ts`, `species/{wolf,balbal,ghostRider,goldenKing}.ts`, `data/species/`, `generators/stormTitanFight.ts`, `roster.ts`.
- **Nine Dragon Stack** (`nine-dragon-stack`): zero declared combat species or encounters in current primary manifest rows. Walker/sitter/guard geometry is not evidence of implemented enemies. Sources: `generators/manifestRows.ts` (`species: []`, `encounters: []`).
- **Sky Reach** (`far-reach`): sky goat, drift ray, gale wisp, Storm Roc; four species/four variants, three regular families and one boss. Placements: five goats, four rays, three wisps, one Roc = 13. Sources: `generators/rows/{species,variants,spawns}.ts`, `generators/layout.ts`.
- **Signal Dunes** (`sunscar-dunes`): sand skitterer, dune strider, dune ray, Dune Matriarch; four species/four variants, three regular families and one boss. Placements: ten skitterers, two striders, one ray, one Matriarch = 14. Strider is uncommon, not a separately declared elite. Sources: `generators/rows/species/`, `generators/rows/spawns.ts`, `generators/layout.ts`.

## Variant identity detail

- Shared boar: `boar`, `sow`, `black`, `big`, `scarback`, `ironhide`. Driftwood authored groups allow only the first four; Pine also adds spawn-only `thrall`.
- Shared bear: `black`, `black-blaze`, `brown`, `black-old`, `brown-old`. Driftwood authored groups use brown and black/black-blaze; Pine Blackpaw is `black-old`.
- Driftwood crab: `small`, `big`; monkey: `monkey`, `elder` (Grey Elder); sailor: `sailor`; captain: `captain`.
- Pine deer: `hind`, `stag`, `white-hind`, `white-stag`, `big-stag`, `piebald`, `ghost`. Elk: `cow`, `bull`, `big-bull`, `pale`, `imperial`, plus spawn-only `thrall`.
- Nalati wolf: `grey`, `tawny`, `dark`, `scout`, `alpha`. Balbal: `warrior`, `capped`. Ghost rider: `rider`, `captain`. Aqbars, Kokbori, Qyran, Golden King each have one dedicated variant; Argymaq uses `stallion`. Titan is a custom target/encounter rather than a normal weighted variant.
- Sky: ray `dusk`, goat `cloud`, wisp `gale`, Roc `storm`.
- Signal: ray/skitterer/strider each use `dusk`; Matriarch uses `matriarch`. Reusing the variant id across different species does not make them one variant identity.

## Migration boundary

`docs/SHARDS.md`'s frozen-copy section and `docs/plans/shard-platform/{STATE,open-x-queue}.md` are authoritative. All six primary entries admit data through the hybrid loader but still contain trusted runtimes. W2 is Pine/Driftwood reduction; Sky/Signal cleanup follows; W3 is Nalati/Nine. The primary folders remain authoring sources. Frozen `-legacy` source inventory must not receive feature edits. New enemies should use shard data, baked rigs/looks, shared hosts and shard-specific AssemblyScript where new decision logic is needed. Do not add shard branches to the engine or reinterpret unfinished migration as complete.

## Explorer and arena trace

Supported launch: frozen dependency install, then `scripts/serve-build.sh --shard driftwood-isle --devserver`; never Vite dev. `--head` has a Mac-specific `cp -c` asset-copy path, so a cloud Linux working-tree proof is preferable. Local cloud cache/lock directories are needed because this VM's nominal home is not writable. `chunk=driftwood-isle` is the existing routing parameter; use Settings > Developer and Explore > Model explorer / Practice arena. Do not add new URL toggles.

`game/session/loadout.ts` calls the shard roster, then engine `models/roster.ts` lists the shared dummy/hoverboard and shard model entries. `engine/explore/Explore.ts` creates `ModelExplorer.ts`. Its viewer supports variants, idle/walk/trot/charge/hit/die, solid/wire/facets/paint/tiers and day lighting. This is a specimen viewer, not a combat proof. Driftwood roster explicitly includes boar/bear/crab/monkey/sailor/captain; captain uses Hunyuan plus code and the others are code-derived/baked bodies.

`engine/practice/TrainingArena.ts` builds a 100 m room at y=900 with three fixed `ARENA_LINEUP` placements from `engine/practice/lineup.ts`. `TrainingTarget` has `alive=true` forever, hit springs, isolated hitboxes and no enemy AI/death/loot. It registers combat targets and is selected by `engine/combat/targets.ts` whenever practice is active. `HUD.enterArenaNow()` enters it; `game/session/finish.ts` also handles arena arrival. `weapons.lendAll()` loans the current shard's entire kit and `endLoan()` restores unlocks on exit.

Existing loadouts: Driftwood wooden/iron swords; Pine crossbow/lever rifle/longbow; Nalati bow/sabre/spear plus practice-loan rifle; Nine jian plus Fei Zhua/hoverboard tools; Sky fan; Signal whip. All have hoverboard tooling. No generic AR-15 should be added to Driftwood.

## Minimal safe one-on-one extension

1. Add a data-only practice encounter catalog supplied by the game/shard product, with stable id, label, role, species/variant and required arena features. Keep engine UI free of shard names. Exactly one selected opponent exists; switching retires the old one before spawning the next.
2. Keep normal world enemies intact. Use an isolated practice runtime/actor scope and practice reward ledger. The existing live `AnimalManager` has global ground/app-level dependencies, so creating another manager is not sufficient isolation. Never simply move a world enemy to y=900: onKill records real progress, and shard hooks chain loot/quests/boss flags.
3. Reuse admitted species brain/strike/rig data and combat damage pipeline. Extend the host only where needed for explicit ground, scope, target and reward ports. Boss/elite scripts must receive a practice context instead of live saved encounter state. Mark unsupported encounter dependencies clearly until their host is tested.
4. Replace the initial three-dummy lineup with selection + one-opponent/retry flow, preserving a dummy as an optional existing test target if useful. Player death/retry and opponent death must reset the practice fight without granting world items or advancing quests. Current shard weapon loans remain intact.
5. After selection/session proof, integrate three regular Driftwood species, one elite and one boss through authored data/rig/strike/loot rows and add natural map placements. Keep unfinished content behind Developer until evaluated.

Proposed file ownership: arena integrator owns `src/engine/practice/TrainingArena.ts`, new `practice/encounter.ts`, `practice/arena.css`, `src/game/session/loadout.ts`, necessary session routing, `src/engine/models/roster.ts` dummy-count truth, and focused arena tests. Enemy content owner owns only `src/shards/driftwood-isle/` new enemy data/generator/species/behaviour/model files plus its roster/placement/loot integration, and enemy tests. Coordinator owns any shared public exports/manual API documentation and source checkpoint. No legacy changes, policy ratchet edits, deployment changes or broad regeneration commits should be bundled with the feature.

## Verification ladder

- Catalog: stable unique IDs; every selection resolves species, variant, body, required clips, strikes and loot; normal/elite/boss labels are explicit rather than inferred from rarity.
- Rig/assets: decode real GLBs, validate skin joints/weights/bounds/sockets; play idle/locomotion/attack/hit/death; no stand-in counted as passed.
- Combat: telegraph, active window, range/arc/LOS, one damage event per strike, stagger/interruption, recovery/cooldown, death disables attack, loot emits once.
- Arena: one actor only, rapid A/B selection, restart, exit during async load, stale completion, repeated enter/exit, player death, opponent death; colliders/targets/events/rigs disposed; world save/quest/inventory and weapon unlocks byte-equivalent before/after.
- Six kits: every listed weapon hits its intended arena target; loans reset on exit. Airborne/large boss requirements cannot be assumed to fit a 9 m ceiling.
- World: placement counts, ground/water suitability, spawn separation, no blocked traversal or overwritten assets; map rebake parity; deterministic save/reload and boss rewards.
- Existing focused tests: `test/driftwood-enemy-placement.test.ts`, `species-native-binding.test.ts`, `species-programs.test.ts`, `driftwood-creature-bodies.test.ts`, `driftwood-creature-look.test.ts`, `driftwood-finale-controller.test.ts`, `strike-geometry.test.ts`, `loot-table-data.test.ts`, relevant headless product/scenario tests. Add arena integration tests; none named TrainingArena/ARENA_LINEUP were found in the current test sources.
- Final checks: generated products, relevant types/lint/related tests, supported production build, muted portrait browser smoke and real captures; per-project milestone mobile/render checks remain separate from cloud Chromium success.

## Baseline execution status

Pinned dependencies fetched (374 packages). pnpm 11 reported an ignored sharp install script; no project permission-policy change retained. Cold `gen --proof`, Driftwood shardfile and supported Vite preview bundle all completed. They report a pre-existing baked-map/world mismatch and report-only rendering/download budget overages. The full suite/typecheck/lint are not claimed.

Six focused test files / 17 tests passed: enemy placement, native species binding, Driftwood body/look, finale controller and strike geometry. Deterministic phone/desktop placement execution matches the census above.

Actual Model Explorer browser proof completed with official Chrome Headless Shell, muted software WebGL, iPhone portrait 402x874 viewport. Loaded reef crab (932 tris), coconut monkey (636), drowned sailor (1,686), and Drowned Captain (15,064) were individually captured and visually inspected. Captain's Die control produced a visibly collapsed pose. This is a specimen/pose proof, not a full combat AI/death/loot validation or physical-device performance measurement. No page errors or failed HTTP responses occurred in that capture run.

The installed desktop Chromium executable failed on its process-singleton socket in this executor; the existing official headless-shell avoids that unsupported desktop requirement. Preview and browser must share one owned command lifecycle because detached preview processes do not persist here. Each capture run closes both; no preview URL should be described as permanently live.

The first direct-probe arena attempt entered y=900 but retained Explorer/pause overlays. Its screenshot is invalid as arena visual proof; a real Explorer > Practice arena UI-flow retest is pending. Do not count an `entered` boolean alone as a visible arena pass.

The generator runs all shard producers even when `serve-build --shard` selects one shardfile. Its generated tracked/untracked diff is separate from feature source changes: about 30.85 MB across generated outputs, exceeding a single 10 MB binary push allowance if swept together. No feature code edits or worker Git operations were performed.

## Foundation follow-on (2026-10-18)

Public baseline review: https://wildshard-enemy-lab.raynos.chatgpt.site. Four Model Explorer turntables and Captain Die-pose remain verified. Real Practice UI entry reproduced a renderer crash after `arena.entered=true`; no arena screenshot passed. Software-renderer stderr contains normal-attribute, shader-extension and audio-backend warnings, without a definitive crash cause.

An initial Developer-only data-fed one-opponent source path is now WIP. It admits fresh declared ground stalker/skirmisher bodies (Reef Crab initially), preserves default dummy mode, uses private combat/health and an in-memory reward receipt, and rejects unsupported behavior families. This is not full creature/loot acceptance: pickup visualization, broader AI adapters, six-kit runtime testing and browser proof remain open. Lifecycle tests cover replacement, stale async completion, retry, cleanup and reward-once. Post-edit focused regression: 4 files / 23 tests pass; full integration validation remains pending.
