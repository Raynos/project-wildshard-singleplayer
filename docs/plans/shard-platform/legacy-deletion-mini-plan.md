# Legacy folders: what depends on them, and the deletion rows (G604)

**2026-10-27:** LD4 is a Node list compare, built now; it deletes nothing (G795). LD5–LD8 (and custom-code-freeze
A1–A2) still wait for Jake's word after his QA and stay in the plan % (G779); nobody touches them before that.

**2026-10-24 (E496):** [custom-code-freeze](custom-code-freeze-mini-plan.md) lists the concrete loader and module lists for LD5–LD8, but **they are not approved**: Jake, ~15:00, *"there's no go ahead to delete the 6 legacy shards and the legacy button … I haven't done the QA yet."* G606 stands.

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
5. **Small type/tool breaks:** `test/shard-select-entries.test.ts:78` (`'pine-hollow-legacy'`), `scripts/families-board/part2.js:21`.
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
| **LD4 — done audit with explicit gaps (`cfa1930bb0`, current inventory commit)** (G795) | Explorer parity in Node, built now, no browser lane (G795; was once per shard at a milestone in a browser): the LEGACY and SHARDFILE model / set / world / arena lists compared; deletes nothing | S | each diff empty, or every gap is a row in that shard's zero plan |
| **LD5** | Remove the LEGACY button: Debug row, dual buttons, legacy entry mode and loading path, `shard/legacy.ts`, `entries.legacy` | S | SHARD SELECT shows one ENTER WORLD everywhere |
| **LD6** | Delete the folders, one commit per shard: Sky + Signal (already unreachable), then Driftwood + Pine, then Nalati + Nine; each drops its list entry, regenerates `slugs.generated.json`, prunes lint entries | M | gates green per commit |
| **LD7** | Delete legacy-only engine/game code with each LD6 commit (~16 modules, exports, frozen exceptions) | M | nothing left whose only importer was legacy |
| **LD8** | Retire the legacy tooling: `legacy-shards.json`/`.mjs`, lint/script exemptions, `LEGACY_SHARDS`, synthetic legacy tests | S | `git grep legacy-shards` finds nothing |


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
