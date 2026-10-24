# Custom code freeze and loader deletion (E496)

**State:** `active` 2026-10-24 — Jake asked to build it. Audit by the plan agent's subagent, read only, at HEAD
a80ea662b5 (~14:40 Cancun): static import graph and export scan over `src/`, `scripts/`, `lint/`, `test/` (git-tracked
plus generated discovery files), no builds. Builds on [legacy-deletion](legacy-deletion-mini-plan.md) (LD5–LD8 are
built through this plan) and G693 (the ruler deletion is its own row there; this plan keeps and widens the zero lock
G693 keeps). HOST-AUDIT stays parked (G679): no host folds here.

Jake, 2026-10-24 (E496):

1. *"How do we freeze the custom code and delete all the legacy custom code loaders from engine and game? Make a mini
   plan in a subagent and then build it."*
2. *"In that subagent mini plan look for anything else we can delete in engine or game now and after deleting legacy
   shards."*

## Findings

**Headline:** ~5.0k lines can go **now** (up to ~7.1k once D3's native hosts are confirmed dead), and ~6.1k more
lines of engine / game / SDK / tooling **after legacy deletion**, on top of the six `-legacy` folders themselves
(1,143 files, 132,322 code lines, 25.4 MB).

### 1. What lets custom code come back today (the freeze holes)

1. **The zero lock is partial.** `lint/ratchet.json` `closedComponents` locks all nine components only on Nalati and
   Nine; Pine and Driftwood lock only C3, C7, C8; **Sky and Signal have no lock**; templates, open plots, Pastel Plain
   and Ink-Cel Valley are never checked (`COMPONENT_SHARDS` in `scripts/shard-components.mjs` is the six). Checked
   today with `closedComponentSources` and every component locked on all six: **0 lines everywhere**, so locking it
   all now is free. Once G693 removes the ruler, the partial lock is the only guard.
2. **The shardfile schema still accepts a TypeScript runtime.** `src/format/runtime.ts` `LegacyRuntimeSchema`
   (`entry: runtime/*.ts`) is half of `RuntimeSchema`; `src/format/outputIndex.ts:23` admits a copied first-party
   runtime; `src/format/minimap.ts` admits `bindings.entry.legacy` / `entry.native` plus `nativePlan`
   (`transitionPlan`, :205) and `runtimeEntry` (`runtime/index.ts | runtime/hybrid.ts`, :253); its `binding` /
   `moduleBinding` accept any `./path` module for budgets, navigation, `load`, `roster` (with `call`), `ktx2`, and so
   on, not only `.json` or `*.generated` files. No shipped manifest uses any of these (all four zero shards are
   `entry: {platform: "client-plan"}`; Sky and Signal have no entry).
3. **The emitter still writes TS loaders.** `scripts/authored-manifest.mjs:134-153` emits a
   `declaredRuntimeEntry(runtime, native, …)` thunk for `entry.legacy` / `entry.native`.
4. **The layout and lint still have a home for runtime TS.** `lint/shard-layout.json` `sourceLayout.folders` allows
   `runtime/`; its old top level still requires `manifest.ts`, `plugin.ts`, `roster.ts`, `budgets.ts`, allows 23
   folders, and keeps a `legacy` entry list for four *primary* shards (37 paths). `lint/wildshard-plugin.js` treats
   `src/shards/*/runtime/` as the trusted home (layer rule :384-391, `runtimeCommons` :418, `shard-game-plugins`
   G307, `runtime-standalone`); `@wildshard/sdk/runtime/*` facades are still exported.
5. **1,824 of 2,344 per-file ratchet allowances name files that no longer exist** (`lint/ratchet.json`:
   `shard-engine-imports` 611, `no-shard-host-callback` 345, `no-build-time-import` 299, `shard-game-plugins` 162,
   `runtime-standalone` 152, `shard-game-imports` 99, `shard-services` 52, `shard-sandbox` 39, plus 65 more). A file
   recreated at one of those paths inherits its allowance.
6. **Custom sections have a raise path:** `lint/custom-sections.json` `raises` (33 records); counts still sit at
   Pine 236, Nine 140, Nalati 80, Driftwood 58, Sky 19, Signal 16.
7. **A headless trusted-module loader:** `src/sdk/headlessRuntime.ts:98-160` (`trustedHeadlessModule`,
   `prepareHeadlessRuntime` / `headlessModules` exports), `src/sdk/headless.ts:27` (`trustedRuntime` option),
   `src/sdk/bake/headlessWorker.ts:22` load any `file:` module. Only test fixtures pass it
   (`test/fixtures/headless/trusted-run.mjs`, `deferred-run.mjs`); production uses `sim/runtime-plan`.
8. **The docs still teach it:** `docs/SHARDS.md` :69-77, :219-220, :242-259, :269-270, :310-311, :390 (optional
   trusted `runtime/`, `manifest.ts`, `plugin.ts`).

### 2. Legacy custom-code loaders in engine and game, and who still uses them

| Loader | Where | Users today |
|---|---|---|
| Trusted / native runtime entry | `game/shard/declaredEntry.ts` `declaredRuntimeEntry` + `nativePlan` selection; `game/plugin/context.ts:145-180` `TrustedRuntimeEntry`, `manifestRuntimeEntry`, `prepareTrustedRuntime`; `game/shardfile/hybrid.ts` `entries[]` (34 lines on trusted entries); `game/grid/liveSession.ts:231,591,727,735` and `pageShell.ts:16-18` `trustedRuntime` branches; `game/shardfile/client.ts:101,197` `trustedRuntime`; `game/shard/manifest.ts:681,746` `runtimeEntry` | **tests only** (6 test files) and the emitter branch; no shard |
| Copied-runtime catalogue | `src/outputRuntimeRegistry.ts` (no importer), `game/shard/catalogBoot.ts`, `format/shardCatalog.ts`, `sdk/outputCatalog.ts`, `sdk/outputCatalogScan.ts` | tests and the SDK CLI test only |
| Legacy entry (LD5) | `game/shard/legacy.ts` (32), `legacyButtons.ts` (58), `entryMode.ts` (73), `runtimeVariant.ts` `shardfileEntry`, manifest `entries` / `legacy`, `LEGACY_SHARDS` / `LEGACY_CONTENT_IDENTITIES` (`scripts/gen-shards.mjs`, `src/shardList.ts`, `scripts/bake-loader.mjs`), dual buttons in `titleDeck.ts`, `session/loadout.ts`, `summary.ts`, `travel/travel.ts`, Developer ▸ Legacy shard buttons | the six `-legacy` folders only |
| TS manifest and plugin | `ShardManifest.load` thunk, `game/shard/plugin.ts` `ShardPlugin` (importers: 10 legacy, 1 game, 3 tests), `game/plugin/*` `ShardContext` (12.8k lines; `context.ts` imported by 62 legacy files, 138 game) | legacy folders as authors; **the game itself** as plumbing: `declaredClientPlanEntry` wraps an empty `ShardPlugin` in `standaloneHybridEntry` → `prepareStandaloneHybrid` → `hybrid.ts` for all four zero shards |
| Headless trusted module | see hole 7; `sdk/headlessAssembly.ts` (258), `scripts/check-headless-assemblies.mjs` (115), `data/headlessAssembly.json` in Driftwood, Pine, Nalati, Nine | test fixtures; the native hosts it names are otherwise test-only |
| SDK runtime facades | `src/sdk/runtime/**` (weapons, audio, effects, prompts) | 11 modules legacy-only or test-only; 2 live (`combatCues`, `weaponVoices`) |

Templates (`_template`, `blender-template`, `pastel-plain`, `ink-cel-valley`) and the open plots use no custom-code
loader: `shard.config.ts` + generators + AssemblyScript only. Stale ratchet rows still name
`_template/manifest.ts` and `blender-template/manifest.ts`.

### 3. Anything else deletable (static graph, ranked by lines)

**Now:** 36 modules (2,778 lines) are reached only from tests and 3 small modules from nothing. The clear ones:
native hosts kept alive only by tests and the headless assembly (`quest/nativeComposition` 344, `population/
mixedRoster` 338, `boss/native` 148, `quest/nativeEntry` 107, `grapple/headless` 91, `loadout/nativeAmmunition` 86,
`boss/roaming` 77, `quest/nativeChapter` 51, `boss/continuation` 37, `boss/nativeWake` 35, `quest/killSteps` 34,
`combat/clipTiming` 14: 1,362 lines); the copied-runtime catalogue (208); Script V2 leftovers
(`engine/script/liveObservationsV2` 87, `selectionV2` 15, `format/scriptGridV2` 31, `sdk/bake/compileDualScriptV2` 70,
`compileSimV2` 20); small SDK leftovers (`kit/specimenSchemas`, `looks/posedInstances`, `looks/riggedHulls`,
`npc/figures`, `runtime/prompts`, `engine/physics/regionalState`, `game/grid/state`: 73). Kept as tools until a
builder proves otherwise: `sdk/scriptScenario`, `diskScriptScenario`, `cli`, `dev`, `bake/json`, `bake/export`,
`population/nativeBake` (named by a Driftwood generator). In live files, 34 exports (~200 lines) have no importer
and 25 (~470 lines, `riding/native.ts` `installMountedPlayer` 212 alone) only a test.

**After legacy deletion:** 34 modules (1,426 lines) are reached only from `-legacy` folders (`engine/world/
waterSurface` 252, `game/systems/items/lash` 211, `systems/npc/figureRig` 211, `engine/world/faunaLayout` 121,
`BakedCards` 74, `npc/figureMotion` 73, `npc/faceHeads` 59, `engine/models/glb` 92, `engine/ai/EliteBrain` 62, nine
`sdk/runtime/weapons/*` files, `sdk/{brains,flyers,grazers,groupBrains,socketLift}`, `engine/player/nalatiArms`,
`game/shardfile/{portalLink,socketLift,quests}` …), plus 26 legacy-only exports in live files (~350 lines:
`TreeFactory` `patchWind` / `patchFade`, `forest/treeSet` patches, `firearmFx` `HitLine`, `waves` GLSL, `place`
`copiesNear` / `copiesAt`, `rainCurtain` …). The legacy tooling is ~2.75k lines (`lint/legacy-shards.json` 1,430,
`lint/legacy-line-basis.json` 995 unless G693 takes it, `scripts/legacy-shards.mjs` 133, `decision-legacy-lines.mjs` 41,
`legacySourcePath` and `legacy-npc-imports` in `lint/wildshard-plugin.js`, ~25 importing scripts).

Graph caveats: workers, `*.merge.d.ts`, the service worker and `src/sdk/bin` show as orphans and are not
candidates; string-built imports are missed, so every delete row ends with root `tsc`, lint and `vitest related`.

## Rows

Owner is Codex for all (none is graphical); D1 and A1 also need the boot smoke. Every row lands in small commits
through `scripts/commit.sh` (G689: related tests), green on types / lint / related tests. Nothing adds automation
(G585) or a Debug row (G669); nothing is reverted (G674).

| Row | What | Lines deleted | Owner (Codex unless graphical) | Effort | Done when | After |
|---|---|---|---|---|---|---|
| **F1** | Lock every component C1–C9 on all six shards in `lint/ratchet.json`, and make `check-closed-components.mjs --source-only` also require **0 countable lines in every non-legacy folder under `src/shards/`** (templates, open plots, new shards), so a new shard is locked the day it exists; delete `closingComponents` (all at C7: 0) and its shrink-only code | ~40 | Codex | S | **done** `dd52fc84ea` (sp-x8): Pastel/Sky/new-folder one-line regressions refuse; every six-shard C1–C9 lock, closing-count removal, exact staged-source selection; 234 CF1 cases + four staged fixtures / types / lint / zero check pass. Template generation moved unchanged into generators, config is declaration-only | — |
| **F2** | Schema refusals: drop `LegacyRuntimeSchema` from `RuntimeSchema` and `outputIndex.ts`; drop `entry.legacy`, `entry.native`, `nativePlan`, `runtimeEntry` from `minimap.ts`; `binding` / `moduleBinding` accept only `*.json` or `*.generated` modules; the emitter branch in `authored-manifest.mjs:134-153` goes | ~70 | Codex | S | `parseShardfile` / manifest metadata reject a `runtime/index.ts` entry; all shards build | F1 |
| **F3** | Layout and lint: `shard-layout.json` loses `runtime` and the old top-level layout + its `legacy` list (37 stale paths); one hard rule `wildshard/no-shard-runtime` (hard rules cannot be ratcheted, `ratchet.mjs:177`): shard TS only in `generators/`, `*.d.ts`, `*.d.json.ts`, `*.generated.ts`, declaration-only `shard.config.ts`; delete the `runtime/` branches in the layer, `runtimeCommons`, `shard-game-plugins` and `runtime-standalone` rules; shards may not import `@wildshard/sdk/runtime/*`; SHARDS.md drops the runtime / manifest.ts / plugin.ts sections | ~150 | Codex | S | `src/shards/far-reach/runtime/index.ts` fails lint with no allowance possible | F2 |
| **F4** | Prune the 1,824 ratchet allowances for missing files, and have `lint/ratchet.mjs` refuse an allowance for a path that does not exist | ~1,820 | Codex | XS | `ratchet.json` names only existing files; a stale row fails the ratchet | — |
| **F5** | Custom sections shrink-only: delete the `raises` path in `lint/custom-sections.json` and `custom-section-policy.mjs`; counts can only fall | ~200 | Codex | XS | raising a count fails with no override | — |
| **D1** | Delete the trusted / native runtime entry: `declaredRuntimeEntry` and the `nativePlan` phase / feature selection, `TrustedRuntimeEntry` / `manifestRuntimeEntry` / `prepareTrustedRuntime`, `hybrid.ts` trusted entries, `liveSession` / `pageShell` / `client.ts` `trustedRuntime` branches, `manifest.ts` `runtimeEntry`; tests `authored-transition`, `grid-module-preparation`, `client-runtime-declaration`, the trusted parts of `client-plan-platform`, `hybrid-inventory`, `client-mover-owners` | ~650 | Codex | M | `git grep -E "declaredRuntimeEntry|TrustedRuntimeEntry|runtimeEntry"` empty; boot smoke green on all six | F2 |
| **D2** | Delete the copied-runtime catalogue: `src/outputRuntimeRegistry.ts`, `catalogBoot.ts`, `format/shardCatalog.ts`, `sdk/outputCatalog.ts`, `outputCatalogScan.ts`, `format/level.ts`, the `check-paths.allow.json` row, their tests (and the CLI command that only they serve) | ~375 | Codex | S | `git grep "out/\*/runtime"` empty | — |
| **D3** | Delete the headless trusted-module loader (hole 7), `sdk/headlessAssembly.ts`, `check-headless-assemblies.mjs` and its fixtures; then the native hosts only it reaches (1,362 lines above, with their ~720 test lines) once the regraph shows no product or client reads them. Each shard's `data/headlessAssembly.json` goes only if no shipped section reads `sim/headless-assembly.json` | ~470 (up to ~2,550) | Codex | M | `HeadlessSimulation.create` has no `trustedRuntime`; headless proofs run on `sim/runtime-plan` | — |
| **D4** | Delete the other test-only leftovers (Script V2 pieces, SDK leftovers, `regionalState`, `grid/state`) and their tests | ~500 | Codex | S | the graph's test-only list holds only the kept tools | — |
| **D5** | Delete unused and test-only exports in live files (34 + 25, ~670 lines) | ~670 | Codex | S | each removed with root `tsc` green | — |
| **D6** | Delete the 3 true orphans (`outputRuntimeRegistry` is in D2; `sdk/looks/shaderFamily.ts`, `commons/scripts.ts`) after a string grep | ~50 | Codex | XS | — | — |
| **LD5** | ([legacy-deletion](legacy-deletion-mini-plan.md)) Remove the LEGACY entry: the loader list in §2 row "Legacy entry", the Developer ▸ Legacy shard buttons row, `shard-select-entries` legacy cases | ~350 | Codex | S | SHARD SELECT shows one ENTER WORLD; `git grep "legacyButtons\|shard/legacy'"` empty | F1–F5 |
| **LD6** | Delete the folders in pairs, one commit each, each regenerating `shards.generated.ts` / `slugs.generated.json` and pruning lint rows: **Sky + Signal** (305 files, 17,742 code lines), **Driftwood + Pine** (431, 51,101), **Nalati + Nine** (407, 63,479) | 132,322 (25.4 MB) | Codex | M | gates green per pair; boot smoke after the last | LD5 |
| **LD7** | With each LD6 pair, delete what only that pair imported: the 34 legacy-only modules (1,426 lines) and 26 legacy-only exports (~350), `lint/host-reviews.json` frozen exceptions, `check-models.mjs` and `runtime-performance.json` legacy entries | ~1,780 | Codex | M | regraph shows no legacy-only module | LD6 pair |
| **LD8** | Retire the legacy tooling: `legacy-shards.{json,mjs,d.mts}`, `legacy-line-basis.json` (if G693 left it), `decision-legacy-lines.mjs`, `legacySourcePath`, `legacy-npc-imports` + `legacyNpcImport`, `LEGACY_SHARDS`, `legacy-seal.test.ts` and synthetic legacy tests | ~2,750 | Codex | S | `git grep -E "legacy-shards|LEGACY_SHARDS|legacySourcePath"` empty | LD6 |
| **A1** | Collapse the internal plugin plumbing to one client-plan boot: generated `load` thunk → a platform constant, `declaredClientPlanEntry` + empty `ShardPlugin` + `standaloneHybridEntry` + `prepareStandaloneHybrid` → one path; `retainHomeRuntime` / `stagesOwner` policy flags settled per shard as data or removed; `game/shard/plugin.ts`, `scopedRuntime.ts`, the hybrid-only parts of `hybrid.ts` (539) | ~700 | Codex | L | no `ShardPlugin` subclass outside the game; boot smoke + one Chromium walk per shard | LD8 |
| **A2** | Regraph and sweep the second wave: modules whose only importers were LD7 or A1 deletions, `sdk/runtime/**` and the `sdk-no-facade` ratchet, `ShardContext` methods with no caller (export- and member-level), stale ENGINE.md sections | ~500 (measured then) | Codex | M | the graph lists no orphan or test-only module except the kept tools | A1 |

Totals: **now** F1–F5 + D1–D6 ≈ 5.0k lines (≈ 7.1k with D3's hosts); **after legacy** LD5, LD7, LD8, A1, A2 ≈ 6.1k
lines plus LD6's 132.3k.

## Decisions

1. **Legacy deletion goes ahead now, superseding G606's phone-QA gate (and G604's "only on Jake's word after his
   QA")?** Recommended **yes**, per Jake's message 2 (*"after deleting legacy shards"*): LD4 parity is not re-run, LD5
   starts once F1–F5 land, and G673's Developer ▸ Legacy shard buttons row goes with LD5 (Clear downloads stays).
2. **The freeze is a structural zero, not per-component policy?** Recommended **yes**: F1's "0 countable lines in
   every non-legacy shard folder" plus F3's hard lint rule, with no ratchet or raise path; the CI census of platform
   chargebacks stays as G693 keeps it.
3. **Collapse the internal `ShardPlugin` / hybrid boot after legacy (A1)?** Recommended **yes, as the last row**
   behind the boot smoke and one Chromium walk per shard; if it turns risky, `ShardPlugin` stays game-internal and A2
   still runs.
