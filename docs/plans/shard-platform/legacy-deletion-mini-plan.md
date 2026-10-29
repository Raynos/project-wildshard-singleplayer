# Legacy folders: what depends on them, and the deletion rows (G604)

**2026-10-27:** LD4 is a Node list compare, built now; it deletes nothing (G795). LD5–LD8 (and custom-code-freeze
A1–A2) still wait for Jake's word after his QA and stay in the plan % (G779); nobody touches them before that.

**2026-10-24 (E496):** [custom-code-freeze](../../../project/archive/2026-10-28-custom-code-freeze.md) lists the concrete loader and module lists for LD5–LD8, but **they are not approved**: Jake, ~15:00, *"there's no go ahead to delete the 6 legacy shards and the legacy button … I haven't done the QA yet."* G606 stands.

Jake, 2026-10-22: *"Explore world … is that still built on top of the legacy shards, or is that built on top of the shard
files? … What other things in the game are going to break when we delete all the legacy shards?"* Then (G604): legacy
folders are deleted only on his word, after all shards are at zero, all grid-ready, a stable finished build and his full
phone QA of all six shards in SHARD SELECT. Audit by the plan agent's subagent at HEAD adba978f4a → 861e8a6414.

## The answer

**Explore (hub, Model / Set / World explorers, compare), the practice arena, the horse and grapple arenas, SHARD SELECT's
ENTER WORLD and Infinite Wildshard all run on the shardfile builds for all six shards.** None imports a `*-legacy` folder:
Explore boots the normal shard (`game/travel.ts:76`) and opens its viewer over that world (`play.ts:470-490`); its lists
come from shardfile data (`explorerCatalogue`, `clientPlaceSets`, `worldSceneWeld.ts:227`); the arenas come from
shardfile rows (`practice/registration.ts`, `clientPlan`). The only runtime path into legacy is Developer ▸ Debug ▸
"Legacy shard buttons" (`shard/legacy.ts:15-20`; Driftwood, Pine, Nalati, Nine). **No mini plan is needed to move Explore.**

Deleting the folders today breaks the **pipeline, not the game**. The legacy folders are 1,147 files, ~26.7 MB,
~132.7k TS lines.

## What breaks if every `*-legacy` folder goes today (worst first)

1. **Shardfile builds fail, so nothing deploys:** the AS budget for Driftwood, Pine, Nalati, Sky, Signal is read only
   through the legacy list (`gen-decision-policy.mjs:9-12`, `wildshard.mjs:47`); `buildDecisionScripts.ts:20-23` throws in
   clean checkouts and CI (a stale ignored file hides it locally).
2. **The Developer LEGACY button half-boots the normal shard** (`entries.legacy: true`, `context.ts:272`, `declaredEntry.ts:20,36`).
3. **The ruler throws and the zero verdict goes null** (`ruler.mjs:114-115`, `shard-platform.mjs:986-998`); the pinned
   baselines in `lint/legacy-line-basis.json` are looked up through the legacy list.
4. **A generator and its test go red:** `scripts/bake-pickups.mjs:12,14`, `generation-jobs.json:1062,1066`, `test/pickup-catalogue.test.ts:47-48`.
5. **Small type/tool breaks:** `test/shard-select-entries.test.ts:78` (`'pine-hollow-legacy'`), `scripts/families-board/part2.js:21` (the whole tool retired: it already failed to build on removed Driftwood / Nine looks, sp-o4).
6. **Dead code left behind:** ~16 engine/game/SDK modules (~790 lines) only legacy imports (`DebugOverlay`, `nalatiArms`,
   `waterSurface`, `Thrown`, `faunaLayout` …), legacy-only exports, `lint/host-reviews.json` frozen exceptions, ~50
   `check-models.mjs` and 23 `runtime-performance.json` entries.
7. **The debugging reference is gone** (why G573 keeps them until Jake's QA).

## Rows

Rows LD1–LD4 delete nothing and need no QA; LD5–LD8 wait for Jake's word (G604). **Jake's picks (G606):** LD1–LD3 now, behind the zero work; LD4 once per shard as it reaches zero, before his QA; the LEGACY button stays until deletion day; LD6 deletes in pairs: Sky + Signal, Pine + Driftwood, Nalati + Nine.

| Row | What | Size | Done when |
|---|---|---|---|
| **LD1 — done (`a3922936a5`)** | Each shard declares its own AS budget (`shard.config.ts` or `legacy-line-basis.json`; Driftwood 1716, Pine 2130, Nalati 2837 already hard-code theirs in their bake scripts) | S | all six build in a mirror with the legacy list emptied; budgets unchanged |
| **LD2 — done (`c5165d06f9`, `5f6e4fcf55`)** | Pickups generator without the legacy tables | XS | pickup test green; the job has no `-legacy` input |
| **LD3 — done (`007cfe778e`)** | Ruler baselines read by shard name, not through the legacy list | S | an empty legacy list gives the same numbers and zero verdicts |
| **LD4 — done audit with explicit gaps (`cfa1930bb0`, `8da86fa78c`)** (G795) | Explorer parity in Node, built now, no browser lane (G795; was once per shard at a milestone in a browser): the LEGACY and SHARDFILE model / set / world / arena lists compared; deletes nothing | S | each diff empty, or every gap is a row in that shard's zero plan |
| **LD4b — done (2026-10-28, sp-x9)** (G843; before LD5) | Capture LEGACY goldens for every shard before anything is deleted: the board cameras plus a few more, phone portrait, labelled, into `art/legacy-goldens/`. Reference only, not a release check | S | every shard has a labelled LEGACY golden sheet committed under `art/legacy-goldens/` (24 goldens, G851); then tag `legacy-final` on the last commit that still has legacy, before LD5 starts (G851)  Six inspected sheets /36 real LEGACY captures: [goldens index](../../../art/legacy-goldens/round-1-2026-10-28/README.md), source `dfe3573258`, actual six LEGACY entries, errors0, four CO6 cameras plus two standing turns each; every JPEG≤500000B. Reference only, no look change or deletion approval. |
| **LD5** | Remove the LEGACY button: Debug row, dual buttons, legacy entry mode and loading path, `shard/legacy.ts`, `entries.legacy` | S | SHARD SELECT shows one ENTER WORLD everywhere |
| **LD6** | Delete the folders (G840, Jake 10-28: ALL AT ONCE on his word, LD5-LD10 one chain, not per shard; the order below is only the commit order inside that chain), one commit per shard: Sky + Signal (already unreachable), then Driftwood + Pine, then Nalati + Nine; each drops its list entry, regenerates `slugs.generated.json`, prunes lint entries | M | gates green per commit |
| **LD7** | Delete legacy-only engine/game code with each LD6 commit (~16 modules, exports, frozen exceptions) | M | nothing left whose only importer was legacy |
| **LD8** | Retire the legacy tooling: `legacy-shards.json`/`.mjs`, lint/script exemptions, `LEGACY_SHARDS`, synthetic legacy tests | S | `git grep legacy-shards` finds nothing |
| **LD9** (was custom-code-freeze A1, G838; after LD8) | Collapse the internal plugin plumbing to one client-plan boot: generated `load` thunk → a platform constant, `declaredClientPlanEntry` + empty `ShardPlugin` + `standaloneHybridEntry` + `prepareStandaloneHybrid` → one path; `retainHomeRuntime` / `stagesOwner` policy flags settled per shard as data or removed; `game/shard/plugin.ts`, `scopedRuntime.ts`, the hybrid-only parts of `hybrid.ts` (539). ~700 lines; Codex | L | no `ShardPlugin` subclass outside the game; boot smoke + one Chromium walk per shard |
| **LD10** (was custom-code-freeze A2, G838; after LD9) | Regraph and sweep the second wave: modules whose only importers were LD7 or LD9 deletions, `sdk/runtime/**` and the `sdk-no-facade` ratchet, `ShardContext` methods with no caller (export- and member-level), stale ENGINE.md sections. ~500 lines (measured then); Codex | M | the graph lists no orphan or test-only module except the kept tools |


## LD4 Node comparison (2026-10-27, sp-x9)

**In flight:** the data-only comparison is built in `dd127fefb8`. Full runtime
model/set/world registration coverage remains open below; LD4 is not declared parity-green.
Run `node --experimental-transform-types --import ./scripts/bake-loader.mjs
scripts/legacy-explorer-lists.ts <report.json>`. The checked-in inventory is
`legacy-explorer-lists.json`. It contains every compared identifier, exact
missing/added lists, input hashes and unresolved admissions for all six shards.
LEGACY and SHARDFILE run in separate Node processes because model definitions
own a process-global identity registry. No browser, geometry build or deletion
is involved. World here means manifest POIs; late map registrations remain unqualified. Arena lists include
the common Developer Practice card and each shard's registered course.

All six declared arena lists match. Declared manifest POIs match for Driftwood, Pine, Nalati
and Sunscar. Nine adds eight POIs and Far Reach four; the exact names are in
the inventory. Declared Model rosters now match for Driftwood (14), Pine (19), Nalati (27),
Far Reach (8) and Sunscar (10). These are declared catalogues, not the additional models
registered by world placement. Existing products are section/file-hash checked;
the report does not assert they match the current working source.

These are the remaining per-shard zero/Explorer rows for this comparison;
they remain here because no live per-shard zero-plan files remain:

| Gap | Shard | Remaining work | State |
|---|---|---|---|
| LD4-DW | Driftwood | Capture world-placed models and qualify conditional Set membership; declared rosters and nine literal Sets match. | open |
| LD4-PH | Pine | Qualify runtime-placed models, late map registrations and the conditional mill-hamlet Set. The phone Node catalogue now admits all 19 declared models exactly (recorded-cache capture below). | open |
| LD4-NG | Nalati | Qualify runtime-placed models, late map registrations and conditional Sets. Product-only species admission now resolves the complete 27-model declared catalogue exactly (recorded-cache capture below). | open |
| LD4-ND | Nine | Enumerate native assembly registrations: fp-arms and six literal Sets are absent from the declaration-only adapter. Account for eight added POIs. This is a coverage gap, not proof the runtime lost them. | open |
| LD4-FR | Far Reach | Qualify world-placed models; account for four added POIs. Declared eight-model rosters and arena lists match. | open |
| LD4-SD | Sunscar | Qualify world-placed models and conditional/computed Set registration. Declared ten-model rosters and arena lists match. | open |

Touched script types and typed lint pass. The whole ratchet command currently
refuses its missing generated Far Reach discovery input; no allowance changed.
The source audit is built; unresolved coverage is retained rather than counted
as empty. LD5-LD8 remain unauthorized and untouched.


### LD4 Node admission follow-up

The `dd127fefb8` list inventory above remains the last executed comparison.
This follow-up adds the exact data-only species seam confirmed by sp-x6:
`productSpeciesCatalogue` over the product feature's actors/look files, then a
fresh scoped `SpeciesService` and resolver. It calls no preload or model build;
the live-world wrapper and legacy species seed are not used for SHARDFILE.

Pine's relative public URL has no existing named-file adapter (sp-x1 confirmed).
The Node audit therefore supplies a narrow public HTTP-byte capability: local
asset GETs only, read from **regular files in one pinned Git revision**, never
the dirty tree, an untracked asset, a symlink or the network. Existing model
size/hash/decoder checks still run. Actual public input hashes join the report;
the original fetch is restored on every outcome. No runtime loader changes.

**Blocked prerequisite:** the follow-up command refused missing
`out/driftwood-isle/shard.json`; Pine and Nalati output indexes are absent too.
No new comparison result is claimed, and the prior JSON inventory is preserved.
No generator/product build was started under G769. LD4-PH/NG are in flight for
one cause-fixed Node admission when existing products return; native placed-
model/conditional-set coverage remains explicit in all six gap rows.
Touched types and typed lint pass. Full ratchet is invoked; after discovery
returned it reports existing foreign source-count increases/reductions, not
an own audit-source increase. No policy/allowance or peer source is changed.


### LD4 exact recorded-cache phone capture

The follow-up above was prerequisite-refused, not passing. The same six exact
recorded index hashes were subsequently found in the existing immutable product
cache. `--recorded-cache <report.json>` reads those entries under the existing
reader leases, verifies their section bytes and consumed named payloads, and
releases every lease. No product is built, restored, copied or served. These
historical product identities do not claim current-source freshness.

The **executed phone-tier** capture in `7aa20be8f8` resolves all six catalogues.
Five declared Model lists match (78 identities); Nine's declaration-only list
lacks the original `nine-dragon-stack/fp-arms`. All six declared arena lists
match. Every exact Set/POI difference and every input digest is retained in the
inventory. Models/Sets/World are explicitly **unqualified for late/native world
registrations**, not silently counted as parity-green; all six LD4 gap rows
remain open for that coverage. No legacy deletion is authorized here.

The existing non-drawing bake environment supplies Three's Node URL/progress
boundary, while actual bytes stay constrained: committed source/public objects,
hash/size-checked named product payloads with their real `/shardfiles/<slug>/`
base, or a complete generated-cache receipt whose **full output hash is named
by the committed generation catalogue**. Generated bytes never come from loose
public files. Every receipt output is checked; source freshness is not inferred
from a historical generated hit. The species resolver uses the actual product
catalogue and scoped service. CPU source decoding can occur; no world/specimen
rendering or visual/physics parity is claimed.

Model preparation errors invalidate a captured list. Node's exact experimental
transform-types warning is retained separately as infrastructure, never confused
with a model refusal. The inventory pins the executed collector's SHA256 as well
as the public revision and all selected data. Touched types and typed lint pass.
Full lint:ratchet is invoked; unrelated current source-count differences remain
with their owners. This audit adds no source allowance or policy exception.

## G805 preparation ownership and current checks (2026-10-27, sp-x2)

LD1-LD3 source is already landed; mark the actual defining commits in
those rows rather than rebuilding existing adapters. LD1's six-project
empty-inventory compile regression landed with a3922936a5. LD3's
empty-inventory full-ruler equality control landed in007cfe778e. LD2's
plain committed pickup producer c5165d06f9 imports modern authored
rows, and5f6e4fcf55 preserves raw prepared geometry intake; its existing
regression refuses any frozen-legacy import.

A new direct empty-inventory check compares all six pinned baseline
records exactly (98854 lines total) and asserts unchanged ceilings:
DW1716/Pine2130/Nalati2837/Far677/Sunscar412/Nine2111. It passes;
no legacy list/folder/budget is edited. The focused three-file Vitest
attempt collected zero tests because test/setup imports the missing
Driftwood discovery module through src/shards.generated.ts (the existing
shared generated-input prerequisite). It is retained as a refusal,
not a new green test claim. Do not mutate test setup or frozen files.

LD4 remains in flight. The report now links every shard's nonempty
diff and every unqualified native-registration boundary to its exact
LD4-DW/PH/NG/ND/FR/SD row and owner, instead of leaving an unassigned
list. All six original category comparisons, full input hashes,
null/refusal states and qualified=false boundaries remain unchanged.
Source types, typed lint and scoped ratchet pass; no runtime/build/
browser/Simulator path changed. LD5-LD8 remain unapproved and untouched.

## LD1-LD4 preparation reading (G805, 2026-10-27)

**Prep4/4; whole plan4/8 (50%).** LD5-LD8 require Jake and are not
started. LD4's original bar allows a nonempty diff when each gap has a
row; the six owned LD4 follow-up rows above retain that work. Audit
completion does not mean native runtime/visual/physics parity passes.
No legacy source, list, button, loading path or policy was deleted.

Current Node comparison is pinned to collector sourcecfa1930bb0 and
six exact hash-verified existing products, with all consumed section,
file and public-input hashes in legacy-explorer-lists.json. Product
freshness is explicitly unqualified. The collector refuses a missing
gap owner. Every nonempty diff and every native-runtime coverage gap
links its exact owned LD4 row; none becomes an empty passing list.

| Shard / follow-up | Declared Models LEGACY / shardfile | Declared Sets | Manifest POIs | Arenas | Exact nonempty difference |
|---|---:|---:|---:|---:|---|
| Driftwood / LD4-DW |14 /14 |9 /9 |6 /6 |1 /1 | none in captured declarations |
| Pine / LD4-PH |19 /19 |19 /18 |18 /18 |1 /1 | conditional pine-hollow/mill-hamlet Set not in declared rows |
| Nalati / LD4-NG |27 /27 |17 /17 |17 /17 |2 /2 | none in captured declarations |
| Nine / LD4-ND |1 /0 |6 /0 |0 /8 |2 /2 | fp-arms and six Sets absent from declaration adapter; eight POIs added |
| Far Reach / LD4-FR |8 /8 |0 /0 |0 /4 |1 /1 | four cardinal islet POIs added |
| Sunscar / LD4-SD |10 /10 |0 /0 |0 /0 |1 /1 | none in captured declarations |

The inventory retains every exact identifier. Five declared Model
lists match78 identities; all six Arena lists match. Models/Sets/World
keep qualified=false: world-placed/native models, conditional Set
membership and late map registration have not been captured by this
Node declaration adapter. These are coverage rows, not evidence of
lost runtime content. LD4-ND names crossings, lantern-square,
night-market, stair-street, well-galleries and well-rim explicitly.
No original input pin or oracle is changed.

LD2's unchanged plain producer --check also passes:23 variants,
370224 raw bytes,78685 compressed,0 encoded JSON bytes (104948
historical encoded characters). The empty-list baseline direct check
passes98854 original lines and all six AS ceilings. Keep the earlier
three-file Vitest setup refusal separate; no tests executed in it.
The owned Node captures have exited; no browser, preview, geometry
rendering, Simulator, build or generation run was started for LD4.


## Prepared deletion chain (G871 / G873; audit 2026-10-29)

**Preparation only; no deletion in this commit.** Source inventory and searches below are pinned to
`f8ccbaa6c3af46b885da26fc8b66673ce72f7040` (HEAD when this audit began), not loose peer files.
G873 now puts this chain **after Jake's phone QA of the ~12:15 release**, as the last implementation batch before
archive. The coordinator names the go; sp-ci-deploy first publishes `legacy-final` on the last legacy-containing
commit. G840 means one continuous batch, with no early per-shard deletion or per-pair release. The three pair commits
below supersede the older six-commit wording. Owners/order follow
[the finish spike §2](finish-everything-2026-10-29-mini-spike.md#2-output-1-the-4-hour-schedule):
LD5 sp-o3; three LD6+LD7 pairs sp-x9; LD8 sp-x2; LD9 sp-x10; LD10 sp-x6. Preparation continues on other assigned work
until the release condition is satisfied; it is not permission to delete now.

At this revision the six sealed trees have **1,143 tracked files**, exactly matching `lint/legacy-shards.json`.
“Sky” in the old pair label means **`far-reach-legacy` (125)**, not a nonexistent `sky-reach-legacy` folder;
“Signal” means **`sunscar-dunes-legacy` (180)**. Driftwood/Pine have 192/239, Nalati/Nine 249/158.
The directory operands below mean the complete `git ls-tree -r --name-only <audit-SHA> <directory>` result, including
assets, declaration companions and manifests; do not delete similarly named modern/public files.

The audit used `git grep -n/-l` at that SHA for `legacy-shards`, `LEGACY_SHARDS`, `legacyShardButtons`,
`ws-menu-shardfile`, `standaloneHybridEntry`, `prepareStandaloneHybrid`, `prepareTrustedRuntime`, `retainHomeRuntime`
and `stagesOwner`, then resolved package-export aliases and checked literal tool loads. A secondary import/export
parse covered 7,860 tracked code files with zero parser errors. A graph edge is not the only consumer:
`scripts/blender/lib/export-scene.mjs:62` string-loads `src/engine/world/blenderArea.ts`, so that module **stays**.
Historical line-basis JSON and save/oracle fixtures also stay unless the specific action below names them.
Repeat the same searches on the actual parent of each implementation commit; a new retained caller is not discarded
just to match this snapshot.

**Checks used below.** Each implementation commit runs the existing strict solution
`pnpm exec tsc -b tsconfig.layers.json`, typed lint on its remaining changed TS/JS files, the staged-file ratchet,
`git diff --check`, and its named focused tests (`pnpm exec vitest run <files>`). Deleted-module tests keep useful
native/byte/save/physics assertions by targeting the defining modern owner or a small test-only oracle; only assertions
about a deliberately retired entry/module disappear. No tolerance, data pin, quarantine, budget or guard is relaxed.
Registered source outputs (`src/shards.generated.ts`, `src/game/shard/slugs.generated.{ts,json}` and their source tables)
regenerate through the existing producer/commit wrapper, never a hand-written manifest list. Public assets shared with
the modern products and the committed goldens stay. Boot legs below name the **existing** exact-SHA smoke cases,
not new local gate steps: `boot-public`, `boot-developer`, `boot-grid`, `hover-chromium`, `hover-webkit`, `explorer`.
Use one full-inventory containing build; `phone-route` remains report-only. Final release consumes the completed chain,
not an intermediate pair. No smoke, browser, product build or deletion was executed for this docs preparation.

1. **LD5 — remove the entry UI/mode (sp-o3), after the tag.**

   **Files/modules/exports:** `src/game/titleDeck.ts`, `src/game/mainMenu.css`, `src/game/strings.ts`,
   `src/game/shard/{legacyButtons,entryMode,legacy}.ts`, `src/game/shard/manifest.ts`,
   `src/game/travel/entry.ts`, `src/game/session/{loadout,play}.ts`, `src/game/summary.ts`,
   `src/game/grid/pageEntry.ts`, `src/game/shardfile/{clientSource,productGround}.ts`, `src/entry.ts`,
   `src/game/package.json`. Remove `legacyShardButtons`, dual `.ws-menu-shardfile` UI, choice/save-mode plumbing,
   `chooseShardEntry`/`ShardEntryChoices`, legacy lookup and LEGACY loading/species branches. Keep primary filtering
   (`manifest.legacy !== true`) until pair 3; frozen manifests and the helpers they still type-import must compile
   between commits. Delete `entries.legacy` from the primary/UI contract, without rewriting sealed frozen manifests.
   `standaloneHybridEntry`/hybrid ownership are LD9, not a second LD5 rewrite. No new look/layout choice.

   **Drivers/scripts:** adapt the actual alternate-button consumers to the existing single ENTER WORLD in
   `scripts/loading-benchmark/{accuracy,accuracy-safari,capture,safari-data}.mjs` and `safari-data.d.mts`,
   `scripts/parity/{boot-smoke,hover-touch}.mjs`, `scripts/phone-loading/{main,instrument}.ts`,
   `scripts/shard-phone-memory.{mjs,d.mts}`, `scripts/{sim-grid-entry,tile-plan-reading,bake-grid-seams}.mjs`.
   `art/legacy-goldens/compare/capture.mjs` is the preserved reference driver: retire its live LEGACY invocation at LD8,
   never rewrite the captured images as though they were taken after deletion.

   **Tests/policy/checks:** migrate `test/shard-select-entries.test.ts`,
   `src/game/travel/travel-entry.test.ts`, `test/shard-phone-memory-entry.test.ts` and
   `test/vite-boot-modules.test.ts`; retain public/Developer single-button, locked-card, travel and actual-entry checks.
   Remove only the matching `debugRows` allowance if present at execution; recompute the current
   `wildshard/no-build-time-import` row for `src/game/titleDeck.ts` (4 at audit), shrink only on a real removal.
   Pass common checks plus `boot-public`, `boot-developer`, `boot-grid`, and both hover legs (the clickers changed).

2. **LD6+LD7 pair 1 — Far Reach (“Sky”) + Sunscar (“Signal”) (sp-x9).**

   **Delete:** all 305 tracked files under `src/shards/{far-reach,sunscar-dunes}-legacy/` and the two complete matching
   `lint/legacy-shards.json.shards` entries in the same commit. Remove these last-importer modules:
   `src/game/shardfile/socketLift.ts`, `src/game/systems/items/lash.ts`,
   `src/engine/world/terrainTileData.ts`, `src/sdk/{socketLift,flyers,grazers}.ts`,
   `src/sdk/runtime/audio/silentScore.ts`. Prune each defining `exports` key from its engine/game/SDK `package.json`;
   also prune the matching SDK `publishConfig.exports` key. No legacy helper/script retirement here.

   **Exact shrinking policy:** `lint/ratchet.json` → `wildshard/sdk-no-facade` →
   `src/sdk/runtime/audio/silentScore.ts: 1`; `lint/generated-import-debt.json.files` →
   `src/shards/far-reach-legacy/{boot/files,manifest}.ts: 1` each;
   `lint/generated-source-debt.json.files[]` → the 8 Far Reach and 81 Sunscar paths under these deleted prefixes.
   No `runtime-performance.json`, `host-reviews.json` or `check-models.mjs` deletion site exists for this pair at audit.
   Regenerate discovery/slugs after both complete inventory removals; keep the remaining four sealed rows unchanged.

   **Tests/checks:** remove only retired declaration cases in
   `src/engine/isolated-engine-world-uniform-declarations.test.ts` (`world/terrainTileData`) and
   `src/sdk/isolated-sdk-binding-declarations.test.ts` (deleted SDK keys); adapt the source-only frozen reference in
   `test/sunscar-world-program.test.ts` to its retained native/oracle evidence.
   Run `test/{sky-signal-fixed-layouts,sky-signal-quest-product,sunscar-source-entry,sunscar-world-program,
   platform-data-counts,legacy-seal,shard-select-entries}.test.ts` plus those declaration cases and common checks.
   Smoke impact: `boot-public`, `boot-developer`, `boot-grid` (Signal road), `explorer`.

3. **LD6+LD7 pair 2 — Driftwood + Pine (sp-x9).**

   **Delete:** all 431 tracked files under `src/shards/{driftwood-isle,pine-hollow}-legacy/`, atomically removing their
   two sealed rows. Shared leaves: `src/engine/ai/bossDefinition.ts`, `src/engine/models/{glb,hull}.ts`,
   `src/engine/world/{BakedCards,faunaLayout,waterSurface}.ts`, `src/game/systems/npc/faceHeads.ts`,
   `src/game/models/creatures.ts`, `src/game/shardfile/quests.ts`, `src/sdk/brains.ts`,
   `src/sdk/runtime/effects.ts`, `src/sdk/runtime/weapons/Weapon.ts`. Remove defining package export/publish keys.
   **Keep `src/engine/world/blenderArea.ts` and its export/tests**: it has a real Blender tool reader.

   **Exact shrinking policy:** `wildshard/sdk-no-facade` rows `src/sdk/runtime/effects.ts: 3` and
   `src/sdk/runtime/weapons/Weapon.ts: 1`; `lint/host-reviews.json.entries` only
   `src/engine/world/waterSurface.ts#*`. In `lint/runtime-performance.json.sites`, remove all keys whose file prefix is
   `src/shards/driftwood-isle-legacy/runtime/finale.ts` (2 sites), and Pine's `runtime/{kingLifetime,questClock,
   questDirector,antlerKing}.ts` (10 sites). Remove matching `scripts/check-models.mjs` keys: Driftwood
   `world/{rockKit,Boat,Seabed,Trailside,Wreck,Cove,GroundCover,Gulls,islandInstances}.ts`,
   `weapons/swordView.ts`, `creatures/Enemies.ts`; Pine `world/{treeFactory,trophyWall,crags,landmarks,streams}.ts`,
   `weapons/{longbowView,hunterHands}.ts`, `runtime/weapons/LeverRifle.ts`,
   `runtime/weapons/crossbow/Crossbow.ts`. All paths in this sentence are relative to the appropriate frozen tree.
   Remove generated-import rows for Driftwood `boot/{lateReads,sources}.ts`, `manifest.ts` (1 each), Pine
   `boot/files.ts: 1`, `boot/gpuTable.ts: 2`; generated-source list entries under the two prefixes (6/4).
   Remove base64-debt rows Driftwood `runtime/{baked,headless}.ts`, Pine `runtime/baked.ts` (1 each), and binary-JSON
   rows Driftwood `runtime/{navmesh,physics}.baked.json`, Pine `runtime/physics.baked.json`.

   **Tests/checks:** retarget `src/engine/anim/rig-parser-preparation.test.ts` to the defining rig owner and
   `test/bake-collider-kernels.test.ts` to the existing native codec/reference. Prune only deleted declaration entries.
   `test/{frozen-legacy-format,model-contract-paths}.test.ts` drop these two live-folder cases; saved historical oracle
   JSON is retained. Replace the frozen-config import in `test/legacy-runtime-state.test.ts` with the original five-field
   fixture; retain the modern twenty-field and mismatch/save-identity assertions. Retire frozen-only
   `test/pine-legacy-journal-entry.test.ts`; retain/run `test/{pine-journal,pine-journal-late,pine-journal-view-demand,
   pine-night-emits}.test.ts`. `test/legacy-settings.test.ts` loses obsolete frozen trim construction, while its ordered
   clock-effect oracle stays covered by the existing Pine night fixtures/tests. Run these plus
   `test/{driftwood-ground-bounds,legacy-seal,shard-select-entries}.test.ts` and common checks.
   Smoke impact: `boot-public`, `boot-developer`, `boot-grid`, both hover legs, `explorer`.

4. **LD6+LD7 pair 3 — Nalati + Nine (sp-x9), then hand the exact SHA to LD8.**

   **Delete:** all 407 tracked files under `src/shards/{nalati-grasslands,nine-dragon-stack}-legacy/` and their last two
   sealed rows. Shared leaves: `src/engine/ai/EliteBrain.ts`, `src/engine/player/nalatiArms.ts`,
   `src/game/systems/npc/{figureMotion,figureRig}.ts`, `src/game/shardfile/portalLink.ts`,
   `src/sdk/groupBrains.ts`, `src/sdk/weapons/firearmProfile.ts`, and
   `src/sdk/runtime/weapons/{Firearm,Melee,Sword,Thrown,starterBow,starterMeleeProfile,starterMoves}.ts`.
   Remove all matching defining export/publish keys. Keep the empty **sealed** inventory and the seal helper until LD8.

   **Exact shrinking policy:** `wildshard/sdk-no-facade` rows (all under `src/sdk/runtime/weapons/`):
   `Firearm.ts: 1`, `Melee.ts: 2`, `Sword.ts: 5`, `starterBow.ts: 4`, `starterMeleeProfile.ts: 2`, `starterMoves.ts: 10`.
   Remove 15 `runtime-performance.json.sites` with Nalati file prefixes `runtime/{state,index,enteredAdventure}.ts`
   and `runtime/audio/{SteppeScore,files}.ts`, plus Nine's 2 sites under `runtime/audio/files.ts`.
   `check-models.mjs`: remove Nalati `runtime/weapons/{Spear,Rifle}.ts`, `world/glbPaint.ts`,
   `world/dressing/{statics,index,layer,life}.ts`, `weapons/{recurve,meleeGeo}.ts`, `species/sheep.ts`,
   `world/{WeatherFX,paint,Balbals,Bowl}.ts`, `playground/HorsePlayground.ts`, `cragRock.ts`, `campPeople.ts`,
   `combat/{stormTitan,stormTitanLook}.ts`, plus the separate `src/engine/player/nalatiArms.ts` key;
   Nine `vm/{swordSupport,geo}.ts`, `playground/GrapplePlayground.ts`, `world/{install,portals}.ts`,
   `world/facade/batch.ts`, `world/hero/kitx.ts`. Remove generated-import rows for both `boot/files.ts`/`manifest.ts`
   (1 each), generated-source entries (Nalati 4 / Nine 1), Nalati base64 `runtime/baked.ts: 1` and binary-JSON
   `runtime/physics.baked.json`. Do not delete the live `painterly.ts` host-review entry merely because its historical
   evidence mentions Nalati legacy; current client material/uniform readers still use that module.

   **Tests/checks:** move retained `test/fixtures/species-oracle/pineElites.ts` and
   `test/fixtures/weapon-oracle/{leverAction,leverBridge,nalatiRifleProfile,pineFirearmProfile}.ts` off deleted APIs,
   preserving their original native/weapon laws. Retarget `test/sampled-ambience.test.ts`; remove only retired cases
   from `src/engine/isolated-engine-world-uniform-declarations.test.ts` and
   `src/game/isolated-game-registry-declarations.test.ts`. Run
   `test/{frozen-legacy-format,model-contract-paths,nalati-data-runtime,nalati-creature-views,legacy-seal,
   runtime-performance-rekey,sampled-ambience,shard-select-entries}.test.ts`, the existing elite/weapon oracle tests,
   and common checks. All six frozen prefixes must be absent from the tracked tree, with no stale path allowance.
   Smoke impact: `boot-developer`, `boot-grid`, both hover legs, `explorer`; Opus owns the six-shard camera-1 spot check.

5. **LD8 — retire the empty legacy registry/tooling (sp-x2), after pair 3.**

   **Delete/exports:** `lint/legacy-shards.json`, `scripts/legacy-shards.{mjs,d.mts}`,
   `src/shards.generated.ts`'s `LEGACY_SHARDS`/`LEGACY_CONTENT_IDENTITIES` exports and their consumers in
   `src/{shardList,shardSelection}.ts`; remove frozen identity plumbing in `src/game/shard/list.ts` only after preserving
   ordinary save identity. Retire `legacySourcePath`, `legacyNpcImport` and `wildshard/legacy-npc-imports` in
   `lint/wildshard-plugin.js`/`.d.ts`, its `.oxlintrc.json` rule entry, and only frozen-inventory exemptions in
   `lint/{host-files,ratchet}.mjs`. Remove the terminal legacy-seal invocation from `.githooks/commit-msg`, preserving
   message conventions, signing, storage, strict lint and every other live check.

   **Scripts touched (drop frozen branches/imports, not entire useful tools):**
   `scripts/{bake-loader,boot-dist-plan,build-shardfiles,check-custom-section-growth,check-graph,check-models,
   check-platform-ratchets,check-shards,committed-fast-checks,frame-floor-inventory,game-plugins,
   gen-budget-derivations,gen-programs,gen-shard-words,gen-shards,generated-files,json-declarations,map-hash,
   precommit-checks,shard-coupling,shard-platform,shard-runtime-closure,sim-in-runtime,source-generators,
   title-catalogue}.mjs`, `scripts/push-source.py` and matching declarations where their signatures change.
   Remove the obsolete LEGACY mode from `scripts/legacy-explorer-lists.ts` / `legacy-explorer-lists.json`, and retire the
   live A/B command in `art/legacy-goldens/compare/capture.mjs`; preserve goldens, boards and historical reports.

   **Important retained policy:** `lint/legacy-line-basis.json` and the numerical parts of
   `scripts/decision-legacy-lines.{mjs,d.mts}` still supply modern AS budgets and ruler denominators. Keep
   `shardLineBaselines`/`decisionLegacyLines` and their exact 98,854-line total/AS ceilings
   (DW1716/Pine2130/Nalati2837/Far677/Sunscar412/Nine2111). Delete only `legacyGeneratedPaths`, its inventory import and
   frozen exclusions path. Historical names are not a runtime loader. Keep current primary C1–C9 zero locks,
   no-shard-runtime/layout rules and modern shared-runtime/AS cost checks.

   **Tests/checks:** retire `test/legacy-seal.test.ts`; migrate frozen-inventory setup/assertions in
   `test/{committed-fast-checks,custom-section-growth,decision-project-policy,decision-project,frame-floor-inventory,
   host-callbacks,platform-build-tools,platform-data-counts,platform-milestones,product-report-failure,
   ruler-legacy-basis,runtime-performance-rekey,gen-source,generated-isolated-declarations,shard-select-entries}.test.ts`
   and `test/fixtures/precommit-vocabulary.py`. Keep meaningful baseline/save/security cases, no skipped replacements.
   Run these plus common checks; source/tool/config grep for `legacy-shards`, `LEGACY_SHARDS`, `legacySourcePath`,
   `legacy-npc-imports` must be empty (docs/archive/golden provenance excluded). Existing six required smoke legs pass
   on the containing chain SHA. No `.github` gate or report-only phone policy change is needed.

6. **LD9 — one client-plan boot (sp-x10), after LD8, by 13:30.**

   **Files/modules/exports:** `scripts/authored-manifest.mjs`, `src/format/minimap.ts`,
   `src/game/shard/{manifest,declaredEntry,plugin,runtimeVariant,scopedRuntime}.ts`,
   `src/game/plugin/context.ts`, `src/game/shardfile/{hybrid,hybridPresentation,client,clientSource,
   runtimeProduct}.ts`, `src/game/grid/{liveSession,regionalRuntime}.ts`, `src/game/package.json` and the ordinary manifest producer
   outputs. Replace emitted `load` thunks with the finite client-plan platform declaration; remove
   `declaredClientPlanEntry`, `standaloneHybridEntry`, empty `ShardPlugin` constructor shells,
   `TrustedRuntimeEntry`/`prepareTrustedRuntime`, `prepareStandaloneHybrid`, the legacy composite
   `prepareHybridShard` branch and its scoped proxy adapter. Preserve the actual regional admission/activation,
   retained resident scope, grid-home handoff, cancellation, charged ownership and world/kit/play order; do not delete
   all of `hybrid.ts` just because its current name is transitional. No new loader registry, Vite plugin or virtual module.

   **Preserve data semantics:** current declared entry policy is DW `false/declared`, Pine `true/runtime`,
   Nalati `true/declared`, Nine `true/declared` for `retainHomeRuntime/stagesOwner`; Far/Sunscar have no such entry.
   Keep needed ownership distinctions as validated data, not shard-name branches or one new default for all worlds.
   Retire `LegacyRuntimeSchema` and the `entry` arm of `RuntimeSchema`/`RuntimeDeclaration` in `src/format/runtime.ts`,
   `src/format/{outputIndex,outputFields,shardSchema}.ts`; keep the modern client-plan binds/spawns/cost schema.
   Remove copied TS-runtime emission/execution in `src/sdk/{outputRuntime,outputProduct,project,cli,formatJsonSchema}.ts`
   only where it serves that arm; retain ordinary named payloads, schemas, constants, data codecs and AS execution.
   Prune defining format/game/SDK package exports when a whole module actually disappears.

   **Tests/checks:** adapt `test/{authored-manifest,authored-transition,client-runtime-declaration,entry-styles,
   copied-runtime-build,output-runtime,platform-output-reader,frozen-legacy-format,hybrid-entry-preparation,
   hybrid-inventory,hybrid-product-rows,hybrid-render-preparation,client-plan-platform,client-mover-owners,
   held-entered,held-primary-entry,mounted-entry,driftwood-entry-lifetime,nalati-entry-construction}.test.ts`;
   retain modern assembly, entry retirement, save/quest, inventory, population and lighting-readiness oracles.
   Migrate runtime-entry acceptance cases to explicit refusal while keeping current client-plan admission positive.
   Common checks, all six smoke legs, and `node scripts/physics-baseline.mjs --no-build --mode=walk` → 0 stuck
   implement spike L4 (no six additional hand walks). A miss at 13:30 becomes the spike's dated damage row, not a waiver.

7. **LD10 — regraph, remove second-wave exports/members and stale manual sections (sp-x6), after LD9, by 13:30.**

   **Concrete remaining runtime facades:** `src/sdk/runtime/audio/{combatCues,weaponVoices}.ts` are still loaded by
   `src/entry.ts:193`, so they cannot be deleted in LD7. Replace both loans with the same defining public
   `@wildshard/game/plugin/audio` exports (`sharedCombatCues`, `sharedWeaponVoices`), preserving function identity,
   cue/sample order and boot-bank correspondence. Then delete the two wrappers, their SDK export/publish keys and
   `wildshard/sdk-no-facade` rows 1/3. Do not zero that whole ratchet: retained author/tool rows at audit are
   `src/sdk/kit/bakedGeometry.ts:7`, `src/sdk/phasedBoss.ts:9`, `src/sdk/species/clips.ts:11`,
   `src/sdk/speciesBrains.ts:3`, `src/sdk/weapons/bowProfile.ts:4`, `src/sdk/weapons/meleeProfile.ts:2`.
   Any additional removed wrapper must first lose its actual production/tool caller; decrease only its own allowance.

   **Second-wave review files:** the exact current export sites below have frozen/LD7 readers and no other resolved
   production import at the audit pin; they are the member/export review set, not permission to remove used bodies.
   Drop an export only after its last reader is gone; keep private code called inside the same module. Preserve raw
   data/tool string consumers and move genuinely test-only reference implementations to test fixtures with all original
   assertions. Fresh post-LD9 reachability decides which whole modules are now orphaned. In `ShardContext`, review
   `rows.places` and inherited/member-level calls; `bag.tab/fragment`, `rows.item/lootTable/skin/feat/shop/compendium`,
   `manifest`, `product` and the actual `cube` data have current modern callers and are not blanket deletion targets.
   String-keyed row dispatch, reflection and typed host ports count as callers. Keep workers, service worker entry,
   `*.merge.d.ts`, `src/sdk/bin`, CLI/dev/bake tools and the string-loaded Blender exporter as roots.

   Review set (visibility/body checks above apply to every name):

   | Defining module | Export names to recheck after LD9 |
   |---|---|
   | `src/engine/ai/challengeGrazer.ts` | `ChallengeGrazerSpec` |
   | `src/engine/ai/hunt.ts` | `HuntMemory` |
   | `src/engine/ai/inspect.ts` | `pinBrain` |
   | `src/engine/ai/patrolDiver.ts` | `PatrolDiverSpec` |
   | `src/engine/ai/species.ts` | `SpeciesVariant`, `deriveSpecies` |
   | `src/engine/app/cachedAssets.ts` | `cacheUntilDisposed` |
   | `src/engine/audio/AmbienceBeds.ts` | `BedDef`, `ZoneWeights`, `AmbienceBeds` |
   | `src/engine/audio/ambience.ts` | `ZoneVoice` |
   | `src/engine/audio/audioProfiles.ts` | `requireAudioZone` |
   | `src/engine/audio/gen.ts` | `synthKit` |
   | `src/engine/combat/Equipment.ts` | `RangedFeelProfile` |
   | `src/engine/combat/ammo.ts` | `ProjectileModification` |
   | `src/engine/combat/effects/types.ts` | `SourceMulDef`, `sourceMultiplier` |
   | `src/engine/combat/view/brass.ts` | `brassFloor` |
   | `src/engine/combat/view/firearmFx.ts` | `HitLine` |
   | `src/engine/combat/view/ranged.ts` | `CrossbowWorld`, `CrossbowOptions`, `dataTexture`, `box`, `cyl`, `remapUV`, `edgeWear`, `stripExtra` |
   | `src/engine/combat/view/rangedFeel.ts` | `installRangedFeel` |
   | `src/engine/core/assets.ts` | `PBRSet`, `loadGLTF` |
   | `src/engine/core/ktx2.ts` | `readTexturePixels` |
   | `src/engine/entities/AnimalManager.ts` | `AnimalSound`, `Herd` |
   | `src/engine/entities/species/loft.ts` | `Station`, `setShapeFn` |
   | `src/engine/entities/species/rigs.ts` | `smooth01`, `bump` |
   | `src/engine/models/creature.ts` | `CREATURE_CLIPS` |
   | `src/engine/models/cull.ts` | `CullView` |
   | `src/engine/models/model.ts` | `ModelPlacementVisit`, `withModelPlacementVisitor`, `ModelRendererHost`, `ModelLod`, `ModelInfo`, `GeometryModelPart`, `GeometryModelRow`, `GeometryModelSource`, `SceneModelPort` |
   | `src/engine/models/place.ts` | `Draw`, `InstancedCuller`, `HandedBatch`, `copiesNear`, `copiesAt`, `weld`, `finishWeld` |
   | `src/engine/models/slots.ts` | `SlotRecorder` |
   | `src/engine/models/weld.ts` | `twoSidedPositions`, `flatPositions` |
   | `src/engine/physics/bodies.ts` | `overlapBox` |
   | `src/engine/physics/terrain.ts` | `terrainGrid`, `EDGE_WALL_INSET`, `TerrainCut` |
   | `src/engine/player/WeaponPickup.ts` | `PickupTier`, `TIER_COLOUR`, `ItemPickupOptions` |
   | `src/engine/quest/view.ts` | `ChipSource` |
   | `src/engine/render/look.ts` | `LookComposeContext` |
   | `src/engine/render/shaderPatches.ts` | `ownUniforms` |
   | `src/engine/ui/Minimap.ts` | `MapPoi`, `MapOverlay` |
   | `src/engine/world/Grass.ts` | `TrampleField`, `GrassTrampleField` |
   | `src/engine/world/HorizonMatte.ts` | `HORIZON_RADIUS` |
   | `src/engine/world/TreeFactory.ts` | `TreeVariant`, `FadeBand`, `patchFade`, `patchWind` |
   | `src/engine/world/dayCycle.ts` | `DayPhase`, `ScheduleSeg`, `DayKeys` |
   | `src/engine/world/geometryBake.ts` | `withGeometryBake` |
   | `src/engine/world/geometryKit.ts` | `sagLine`, `pole`, `blob`, `mergeVerticesByPos`, `lathe`, `revolve`, `revolveUV` |
   | `src/engine/world/interact/types.ts` | `PoiId`, `PickupDef` |
   | `src/engine/world/lowpolyKit.ts` | `Part`, `PLANT`, `fern`, `broadClump`, `hibiscus`, `hibiscusBush`, `lilyPad`, `lotus`, `grassTuft`, `vineStrand`, `BakedLight`, `bakeLight`, `lowPolyMaterial` |
   | `src/engine/world/steppeWind.ts` | `WIND_GLSL` |
   | `src/engine/world/voxelAO.ts` | `withVoxelAOBake` |
   | `src/engine/world/water/body.ts` | `swellBody` |
   | `src/engine/world/water/view.ts` | `surfaceReflect` |
   | `src/engine/world/waves.ts` | `WAVES_GLSL`, `WAVES_NORMAL_GLSL` |
   | `src/engine/world/wind.ts` | `swayDepthMaterial` |
   | `src/game/Boss.ts` | `BossDef`, `BossPersistence` |
   | `src/game/Elite.ts` | `EliteDef`, `ElitePersistence`, `GroundTellWedgeStyle` |
   | `src/game/Progress.ts` | `ProgressSink` |
   | `src/game/bag/bag.ts` | `CosmeticSlot` |
   | `src/game/bake/entryways.ts` | `proveSocketLift` |
   | `src/game/compendium/types.ts` | `CompendiumSkin` |
   | `src/game/inventoryLaw.ts` | `InventoryState` |
   | `src/game/loot/tables.ts` | `LootContext`, `LootTableRow` |
   | `src/game/plugin/context.ts` | `ShardCube` |
   | `src/game/plugin/mover.ts` | `moverQueries` |
   | `src/game/saves.ts` | `shardSave` |
   | `src/game/shard/manifest.ts` | `Vec2`, `RGB`, `ChunkTerrain`, `OceanDef`, `ChunkHorizon` |
   | `src/game/shard/retainedHooks.ts` | `installEnteredRuntimeUpdate` |
   | `src/game/shardfile/bakedKinds.ts` | `BakedKindRow`, `BakedColliderRow`, `loadBakedKinds`, `bakedColliders`, `bakedKindsGroup` |
   | `src/game/shardfile/bossRow.ts` | `installBossRow` |
   | `src/game/shardfile/homeKeeper.ts` | `KeptBossRow` |
   | `src/game/shardfile/movers.ts` | `MoverData` |
   | `src/game/systems/looks/grassField.ts` | `TALL_GRASS`, `GrassFieldLayout`, `configureGrassField`, `trailGrass`, `grassToneAt`, `flowerPatchAt`, `grassBloomAt`, `flowerSpeciesAt`, `groundColorAt` |
   | `src/game/systems/looks/particles.ts` | `makeMistTexture` |
   | `src/game/systems/looks/rainCurtain.ts` | `rainCurtain` |
   | `src/game/systems/looks/trample.ts` | `RECOVER`, `MAX_MOVERS`, `TrampleState`, `installTrampleTrail`, `GrassTrample` |
   | `src/game/systems/npc/npcRig.ts` | `NpcRigProfile`, `NpcRow`, `NpcRig`, `rigLegs`, `legRigOf` |
   | `src/game/systems/species/boar.ts` | `BOAR_TUNING` |
   | `src/game/systems/species/view/bear.ts` | `BEAR_PALETTE` |
   | `src/game/systems/viewmodel/armRig.ts` | `JointAngles` |
   | `src/game/weapons/starterBowProfile.ts` | `BOW` |
   | `src/game/weapons/starterMoves.ts` | `key` |
   | `src/sdk/crowds.ts` | `FlockData` |
   | `src/sdk/headlessRuntime.ts` | `HeadlessRuntimePreparation`, `HeadlessRuntimeInstallation`, `HeadlessRuntimePlan`, `PrepareHeadlessRuntime` |
   | `src/sdk/weapons/bowProfile.ts` | `BowProfile`, `BowView`, `GripPose` |
   | `src/sdk/weapons/thrownProfile.ts` | `ThrownProfile` |

   **Manual/scripts/tests/policy:** update only obsolete legacy/plugin authoring sections of `docs/ENGINE.md` and
   `docs/SHARDS.md`, defining `src/{engine,game,sdk}/package.json` keys, `scripts/{check-models,shard-components}.mjs`
   entries for actually removed symbols/modules, and their precise lint rows. Generated API/index files remain the
   normal docs producer's outputs. Keep `src/game/quest/legacyRecords.ts`,
   `test/fixtures/quest-step-legacy-saves.{json,d.json.ts}`, `test/fake/legacy{Actor,Hurt,Source}.ts` and static
   `test/fixtures/legacy-oracles/**` when modern migration/native comparisons still consume them: “legacy” in a
   historical fixture name is not a runtime loading path.

   Run common checks and the affected current test families, including
   `test/{boot-home-modules,vite-boot-modules,runtime-equipment,client-plan-platform,held-primary-entry,
   runtime-product-loader}.test.ts`, typed declaration/namespace controls for each deleted export, and the retained
   native species/weapon/save oracles. The fresh graph must leave no unclassified orphan/test-only production module:
   remove it, move its reference implementation to tests, or name its real tool/worker/data-string root.
   Run all six existing smoke legs on the completed chain SHA; preserve exact native entry, actual drawn frames,
   cache/hash/refusal and gameplay assertions. A remaining graphical change belongs to Opus (G848), not a Codex rewrite.
   Apply the finish spike's 13:30 disposition if this row misses its current deadline; G873's later QA release order is
   controlled by the coordinator, not inferred from this preparation document.

The only change made by this preparation is this ordered list. It neither creates the tag, deletes source/policy/tests,
nor claims any of the implementation checks or boot smoke has run. The implementation owners refresh this pinned
inventory against their actual commit parents, keep exact decreases with their deletions, and report the final pair-3
SHA directly to LD8 so the chain has one unambiguous boundary.
