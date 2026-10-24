# Custom code freeze and loader deletion (E496)

**State:** `active` 2026-10-24 — Jake asked to build it. **Legacy rows LD5–LD8 are NOT approved** (Jake ~15:00: *"there's no go ahead to delete the 6 legacy shards and the legacy button … I haven't done the QA yet"*; G606 stands); they wait for his QA and word. The legacy section below lists what becomes deletable then. Audit by the plan agent's subagent, read only, at HEAD
a80ea662b5 (~14:40 Cancun): static import graph and export scan over `src/`, `scripts/`, `lint/`, `test/` (git-tracked
plus generated discovery files), no builds. Builds on [legacy-deletion](legacy-deletion-mini-plan.md) (LD5–LD8 are
listed here but wait for Jake's QA and word, G606) and G693 (the ruler deletion is its own row there; this plan keeps and widens the zero lock
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

## Three waves (Jake, 2026-10-24 ~15:05)

*"The whole point of the freeze and delete plan is to go in two waves … Wave one, shit that we can delete right now.
And then shit that needs to be frozen right now. Wave two, I do the fucking QA. I use the legacy ones for the A-B
testing whilst I'm doing the fucking QA on my physical phone. Wave three, we delete the rest of the shit. Once the
legacy shards are ready to be deleted, we delete the legacy shards and the rest of the shit in the engine and in the
game that is depending on the legacy shards."*

| Wave | Rows | Gate |
|---|---|---|
| **1 · Now** | Freeze F1–F5 (F1 done dd52fc84ea); delete D1–D6 (only code no legacy shard uses) | none: Codex builds now |
| **2 · Jake's QA** | Jake plays every shard on his iPhone, A/B against its LEGACY version; the six `-legacy` folders, the LEGACY entry and the Developer ▸ Legacy shard buttons row must keep working | Jake's QA (G606) |
| **3 · After QA** (G695: Z1 last, A1 mandatory) | LD5 LEGACY entry, LD6 the six folders, LD7 legacy-only engine/game modules, LD8 legacy tooling, A1 one client-plan boot (ShardPlugin is legacy's authoring API), A2 sweep, Z1 delete the zero lock and census | Jake's word after his QA |

Wave 1 must not break the legacy path: any D-row that touches code a `-legacy` folder imports moves to wave 3.

## Rows

Owner is Codex for all (none is graphical); D1 and A1 also need the boot smoke. Every row lands in small commits
through `scripts/commit.sh` (G689: related tests), green on types / lint / related tests. Nothing adds automation
(G585) or a Debug row (G669); nothing is reverted (G674).

| Row | What | Lines deleted | Owner (Codex unless graphical) | Effort | Done when | After |
|---|---|---|---|---|---|---|
| **F1** | Lock every component C1–C9 on all six shards in `lint/ratchet.json`, and make `check-closed-components.mjs --source-only` also require **0 countable lines in every non-legacy folder under `src/shards/`** (templates, open plots, new shards), so a new shard is locked the day it exists; delete `closingComponents` (all at C7: 0) and its shrink-only code | ~40 | Codex | S | **done** `dd52fc84ea` (sp-x8): Pastel/Sky/new-folder one-line regressions refuse; every six-shard C1–C9 lock, closing-count removal, exact staged-source selection; 234 CF1 cases + four staged fixtures / types / lint / zero check pass. Template generation moved unchanged into generators, config is declaration-only | — |
| **F2** | Wave 1 authored-only refusals: drop `entry.legacy`, `entry.native`, `nativePlan`, `runtimeEntry` from `minimap.ts`; `binding` / `moduleBinding` accept only `*.json` or `*.generated` modules; the authored emitter branch goes. **Held for LD (wave 3):** `LegacyRuntimeSchema` / `RuntimeSchema` and copied-runtime `outputIndex.ts` removal: frozen Pine/DW/Nalati configs still parse `runtime.entry` | ~70 | Codex | S | **wave 1 done** `e5eb16f9f5` (sp-x8): 31 focused cases including real frozen Pine/DW/Nalati configs; 11 current authored manifests emit byte-identically; layers / root types / typed lint green. CF1 related hit its 60 s cap, explicitly deferred to CI. Runtime/copy schema removal **held for LD (wave 3)** | F1 |
| **F3** | Layout and lint: `shard-layout.json` loses `runtime` and the old top-level layout + its `legacy` list (37 stale paths); one hard rule `wildshard/no-shard-runtime` for primary (non-legacy) shards (hard rules cannot be ratcheted, `ratchet.mjs:177`): shard TS only in `generators/`, `*.d.ts`, `*.d.json.ts`, `*.generated.ts`, declaration-only `shard.config.ts`; delete the primary-shard `runtime/` branches in the layer, `runtimeCommons`, `shard-game-plugins` and `runtime-standalone` rules; primary shards may not import `@wildshard/sdk/runtime/*`; SHARDS.md drops the primary runtime / manifest.ts / plugin.ts sections. Exact registered `legacyInventory` files keep their layout/import paths (**held for LD**), with no suffix wildcard exemption; LEGACY entry and buttons stay unchanged | ~150 | Codex | S | **done** 2f6210f1b0 + c7445018a4 (sp-x9): hard primary runtime/import freeze, shared declaration AST, no hard ratchet writes; source layout/docs/new-project guide aligned. 230 + 116 related cases, focused / root / typed lint / tracked layout green. Exact registered legacy held for LD | F2 |
| **F4** | Prune the 1,824 ratchet allowances for missing files, and have `lint/ratchet.mjs` refuse an allowance for a path that does not exist | ~1,820 | Codex | XS | **done** `b984db9194` (sp-x2): 1,820 absent-file rows removed, missing/non-file zero and symbol allowances refused; registered frozen legacy exemption kept; 11 focused cases / types / lint | — |
| **F5** | Custom sections shrink-only: delete the `raises` path in `lint/custom-sections.json` and `custom-section-policy.mjs`; counts can only fall | ~200 | Codex | XS | **done** `194a455e2f` + `b1b5c7a613` (sp-x2; immutable Git-gate repair): count + byte ceilings shrink-only, no raise/reset/remeasure override; 9 focused + 24 related cases / types / lint | — |
| **D1** | Delete the trusted / native runtime entry: `declaredRuntimeEntry` and the `nativePlan` phase / feature selection, `TrustedRuntimeEntry` / `manifestRuntimeEntry` / `prepareTrustedRuntime`, `hybrid.ts` trusted entries, `liveSession` / `pageShell` / `client.ts` `trustedRuntime` branches, `manifest.ts` `runtimeEntry`; tests `authored-transition`, `grid-module-preparation`, `client-runtime-declaration`, the trusted parts of `client-plan-platform`, `hybrid-inventory`, `client-mover-owners` | ~650 | Codex | M | `git grep -E "declaredRuntimeEntry|TrustedRuntimeEntry|runtimeEntry"` empty; boot smoke green on all six | F2 |
| **D2** | Delete the unused copied-runtime catalogue: `src/outputRuntimeRegistry.ts`, `catalogBoot.ts`, `format/shardCatalog.ts`, `sdk/outputCatalog.ts`, `outputCatalogScan.ts`, `format/level.ts`, optional-glob allowance and catalogue-only tests/CLI/build publication. All six are unreachable from frozen legacy and LEGACY entry roots. Shared `runtime.ts` / `outputIndex.ts` / `sdk/outputRuntime.ts` transport remains **held for LD (wave 3), under F2**, not removed with this catalogue | ~375 | Codex | S | **done** `67cd40190e` + `dcc0abf878` (sp-x8): 940 legacy/entry roots, 2663-module closure, no unresolved code imports and no D2 reach; 15 focused + 44 guard cases / root / layers / scripts types / named lint green; exact deleted-path checks pass. CF1 broader related hit 60 s and deferred (unrelated physics-walk declaration prerequisite named) | — |
| **D3** | Delete the headless trusted-module loader (hole 7), `sdk/headlessAssembly.ts`, `check-headless-assemblies.mjs` and its fixtures; then the native hosts only it reaches (1,362 lines above, with their ~720 test lines) once the regraph shows no product or client reads them. Each shard's `data/headlessAssembly.json` goes only if no shipped section reads `sim/headless-assembly.json` | ~470 (up to ~2,550) | Codex | M | **in flight (2026-10-24, sp-x2):** legacy/entry runtime closure excludes the loader; shared legacy type contracts and four JSONs stay. Boot/re-entry migration `158ba5b338`; Nine direct native proof calls `57e623ab13` (360 complete native wires exact). Remaining shipped-behaviour recorders migrate before interpreter removal; native hosts wait for the regraph | — |
| **D4** | Delete the other test-only leftovers (Script V2 pieces, SDK leftovers, `regionalState`, `grid/state`); preserve compiler/height-grid scenario contracts as test fixtures, and retarget facade tests to their defining owners | ~500 | Codex | S | **done** `2cfb0ffc52` + `9021dc3cf1` + `6d46eeb66a` (sp-x8): all 12 modules unreachable from 940 legacy/entry roots; 31 + 21 focused cases / root / layers / named lint green; exact committed deleted-path checks pass. Real AS, replay, RNG, retry and height-grid assertions stay. CF1 broader related hit its 60 s cap and explicitly deferred to CI | — |
| **D5** | Delete unused and test-only exports in live files (34 + 25, ~670 lines) | ~670 | Codex | S | each removed with root `tsc` green | — |
| **D6** | Delete the 3 true orphans (`outputRuntimeRegistry` is in D2; `sdk/looks/shaderFamily.ts`, `commons/scripts.ts`) after a string grep | ~50 | Codex | XS | — | — |
| **LD5** (waits for Jake's QA, G606) | ([legacy-deletion](legacy-deletion-mini-plan.md)) Remove the LEGACY entry: the loader list in §2 row "Legacy entry", the Developer ▸ Legacy shard buttons row, `shard-select-entries` legacy cases | ~350 | Codex | S | SHARD SELECT shows one ENTER WORLD; `git grep "legacyButtons\|shard/legacy'"` empty | F1–F5 |
| **LD6** (waits for Jake's QA, G606) | Delete the folders in pairs, one commit each, each regenerating `shards.generated.ts` / `slugs.generated.json` and pruning lint rows: **Sky + Signal** (305 files, 17,742 code lines), **Driftwood + Pine** (431, 51,101), **Nalati + Nine** (407, 63,479) | 132,322 (25.4 MB) | Codex | M | gates green per pair; boot smoke after the last | LD5 |
| **LD7** (waits for Jake's QA, G606) | With each LD6 pair, delete what only that pair imported: the 34 legacy-only modules (1,426 lines) and 26 legacy-only exports (~350), `lint/host-reviews.json` frozen exceptions, `check-models.mjs` and `runtime-performance.json` legacy entries | ~1,780 | Codex | M | regraph shows no legacy-only module | LD6 pair |
| **LD8** (waits for Jake's QA, G606) | Retire the legacy tooling: `legacy-shards.{json,mjs,d.mts}`, `legacy-line-basis.json` (if G693 left it), `decision-legacy-lines.mjs`, `legacySourcePath`, `legacy-npc-imports` + `legacyNpcImport`, `LEGACY_SHARDS`, `legacy-seal.test.ts` and synthetic legacy tests | ~2,750 | Codex | S | `git grep -E "legacy-shards|LEGACY_SHARDS|legacySourcePath"` empty | LD6 |
| **A1** | Collapse the internal plugin plumbing to one client-plan boot: generated `load` thunk → a platform constant, `declaredClientPlanEntry` + empty `ShardPlugin` + `standaloneHybridEntry` + `prepareStandaloneHybrid` → one path; `retainHomeRuntime` / `stagesOwner` policy flags settled per shard as data or removed; `game/shard/plugin.ts`, `scopedRuntime.ts`, the hybrid-only parts of `hybrid.ts` (539) | ~700 | Codex | L | no `ShardPlugin` subclass outside the game; boot smoke + one Chromium walk per shard | LD8 |
| **A2** | Regraph and sweep the second wave: modules whose only importers were LD7 or A1 deletions, `sdk/runtime/**` and the `sdk-no-facade` ratchet, `ShardContext` methods with no caller (export- and member-level), stale ENGINE.md sections | ~500 (measured then) | Codex | M | the graph lists no orphan or test-only module except the kept tools | A1 |

Totals: **now** F1–F5 + D1–D6 ≈ 5.0k lines (≈ 7.1k with D3's hosts); **after legacy** LD5, LD7, LD8, A1, A2 ≈ 6.1k
lines plus LD6's 132.3k.

## Decisions

1. **Legacy deletion: NOT now.** Jake, ~15:00: *"there's no go ahead to delete the 6 legacy shards and the legacy button … Keep [them]. I haven't done the QA yet."* G606 stands: LD5–LD8 wait for his QA and word; the Developer ▸ Legacy shard buttons row stays.
2. **The freeze is a structural zero, not per-component policy?** Recommended **yes**: F1's "0 countable lines in
   every non-legacy shard folder" plus F3's hard lint rule, with no ratchet or raise path; the CI census of platform
   chargebacks stays as G693 keeps it.
3. **Collapse the internal `ShardPlugin` / hybrid boot after legacy (A1)?** Recommended **yes, as the last row**
   behind the boot smoke and one Chromium walk per shard; if it turns risky, `ShardPlugin` stays game-internal and A2
   still runs.
