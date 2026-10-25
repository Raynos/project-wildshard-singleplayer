# Generators spike and redesign: mini plan (TOOLING-PERF, G648/G650)

**State:** `in progress` 2026-10-24 — G654/G656 decided; GR0–GR2 complete (sp-x1), including Template/Pastel's
zero-catalogue, source-only product build acceptance on `ea96805666`;
GR3 is in flight (sp-x1); GR4–GR12 and GS1–GS5 remain open. Separate from the [gen speed plan](gen-mini-plan.md)
(caching and timing), the [TypeScript plan](typescript-mini-plan.md) and [no binaries in JSON](no-binaries-in-json-mini-plan.md).

Jake, 2026-10-23: *"It sounds completely fucked that the generators are reading the generated output of other generators.
Like, can't I just import the TypeScript and like call functions? … I feel like each generator should be a standalone
program. Like the whole generator repository should be a standalone program, or like one fucking massive generator program
that like tries to generate everything at once. That's not like 20 generator programs that run in some arbitrary order that
must import each other's temporary outputs in the correct order … what is this dependency hell? Why are they doing imported
files? Why can't they import the source code?"*

G650 (Jake): *"Writing generated JSON files into the data directory of the shard … we need a complete redesign of how
generators work and the source code of shard files work and the data and the generators."* Binaries stay out of JSON (G649).

## Findings

**1. The real graph.** `pnpm gen` (`scripts/gen.mjs`) runs, in a fixed sequence: four starter tables and decision policies,
then the **generation phase**, then format schemas, `gen-shards` (discovery, closures), boot tables, budgets, `gen-shards`
again, and the API docs and inventories. The generation phase is **264 jobs** declared by hand in
`scripts/generation-jobs.json` (22,465 lines): Pine 60, Nalati 47, Far Reach 47, Driftwood 41, Nine 27, Sunscar 23,
templates and small shards 14, shared `scripts/bake-*` 5. They write **3,040 files**: 2,476 under `src/` (343
`*.generated.*`, 133 other JSON and TS, ~2,000 hash-named blobs in `src/shards/*/assets/` and `.wildshard/`) and 564 under
`public/` (420 GLB).
- **How the order is decided:** catalogue row order. `prepareGeneration` (`scripts/generate.mjs`) starts a row only when
  no earlier unfinished row writes a path the row declares as input. Each row runs as its own Node process in a copied
  temp tree, cached by content hash in `~/.cache/wildshard/generate` (3.9 GB). Inputs are declared by hand, and most rows
  declare whole folders (`src/engine`, `src/game`, `src/sdk`, `src/shards/<slug>`). The declared graph therefore has 2,152
  edges, 1,878 of them whole-folder, so nearly every row waits on every earlier row of its shard.
- **What really flows** (each entry's static import closure): 91 jobs import another job's output: **196 job→job edges
  over 123 files, longest chain 5** (Driftwood: trail font → fixed models → island dressing → pier scenes → specimen
  catalogue; Nalati 3, Pine 4, Far Reach 4, Nine 2). Only 1 real edge crosses shards (`shared-pickups` reads Pine's
  `spots.generated.json`). 8 edges point at a producer *later* in the catalogue (e.g. `siteCatalogue.ts` imports
  `nativeSpecimens.generated.json`: consumer row 188, producer row 263). At least 14 generator files also `readFileSync`
  outputs outside the import graph.
- **The bigger fan-in is the shard program itself.** `wildshard build` already evaluates each shard in one Node process
  (`shard.config.ts` → `generators/product.ts`, plus `generators/output.ts`). That closure imports **239 outputs of 167
  jobs, ~184 MB** (Nine 97 MB, Nalati 37, Pine 25, Driftwood 23). On top of that, **266 test files** and 7 runtime files
  import outputs directly.
- **Edges that exist only because a step was cached to a file:** nearly all of them. **90 jobs** are literally
  `src/sdk/bake/json.mjs <file> <exportedFunction> <out>`: the function already exists. For example, `trailFont.ts`
  exports `trailFontFacts()` (a 5×7 block font), and `trailsideModels.ts` imports its JSON instead of calling it. 75 more
  are script→JSON jobs, and 92 are asset bakes writing GLB / bin. **Only 7 jobs need a tool outside Node:** 6 Darwin canvas
  renders in a browser (Nine glyphs / sign / decal atlases, Nalati sign atlases, Sky textures, Pine painted) and
  ImageMagick for Pine's HDRI keys (Nalati POI paint is Darwin-only for float bytes, not for a tool). Blender, TRELLIS / Hunyuan and KTX2 encoding are not in `pnpm gen` at all;
  their GLB / KTX2 files are committed inputs. gltf-transform and three.js are plain JS.

**Root cause:** the shard program was never allowed to call its generators. SP5 kept `generators/` out of the runtime, so
every step was made a subprocess that writes JSON beside the code. Consumers then `import … with { type: 'json' }`, so
outputs had to sit under `src/`. That put a hand-ordered catalogue, a cache per file and ~250 MB of data inside
TypeScript's view (G643).

**2. Can the consumer import the producer and call it?**

| Edge type | Jobs (consumed by others) | Call in-process? | What blocks it |
|---|---|---|---|
| function → JSON (`json.mjs`) | 90 (34) | yes, today | nothing; most are cheap pure functions |
| script → JSON | 75 (15) | yes, after the script's body becomes an exported function | the same |
| asset bake (GLB / bin out) | 92 (34) | yes; the costly ones go behind a content-hash cache returning bytes | cold cost (the gen plan measures it), memory in one process, process-wide installs (`installShards` in `generation-level.mjs`, portable Math), so one process **per shard**, not per repo |
| browser / ImageMagick | 7 (2) | no | needs a browser (machine cap of 4) or `magick`: stays a separate asset tool with committed binary output |

Determinism does not change: 49 `native` jobs only add the host's platform and arch to the cache key (float output differs
between hosts), and an in-process call keeps that key. Node vs browser: generators are Node-only already, and the runtime
gets everything from the shardfile, never from `generators/`.

**3. Binaries in JSON vs real data** (459 generated JSON under `src/`, 318 MB): **44 are base64** (151 MB: `lightSpill` 52,
`paintArray` 47, `castHook` 29, `poiPaint` 2.9 ×2, `physics` 2.5 / 2.0 / 1.2, `signAtlas` 2.3, `glyphs` 2.0, `grass` /
`geography` 1.5). **19 are number arrays standing in for bytes** (101 MB of vertex / layout data: Driftwood `mapAssembly`
28.7, `modelCatalogue` 18.2, `rockScenes` 17.7, Nalati `mapAssembly` 9.1, Nine `layout` 6.8): G649 bans these too.
**396 are real data** (66 MB; biggest Pine `floorLayout` 11.2, Nalati `dressing-stone` 6.3, `species` 5.8). The ~2,000
blobs in `src/shards/*/assets/` (~980 MB locally) are binaries under `src/` as well.

**4. Options**
- **A. One program per shard (recommended).** The program already exists: `wildshard build <shard>` (one process per
  shard via `runShardBuildPool`). Each job becomes an exported function that `product.ts` / `output.ts` imports and calls.
  An SDK `cached(step, inputs, fn)` wraps only the costly steps. Its key is the step module's import-closure hash
  (`scripts/function-source.mjs` / the loader receipt already do this) plus the declared input files plus the host for
  `native`. It stores `.glb` / `.bin` / `.json` in `~/.cache/wildshard/gen/<slug>/`. The product receipt (`shardfile-cache`)
  stays the whole-shard cache. **Deletes:** the 22k-line catalogue, `generate.mjs` and ~1,500 lines of `generation-*.mjs` /
  `bake-input-hashes` / `gen-shards` closure passes, 27 `*.d.json.ts` type shims, ~120 `.gitignore` lines and every
  `*.generated.*` under `src/shards`. **Risks:** a cold shard runs its steps one after another (mitigate: shards run in
  parallel, costly steps are cached, independent steps run in parallel inside the shard). The product receipt must key on
  `cached` keys, not cache files. 266 tests move. **Size:** XL in total, one L lane-task per shard.
- **B. One program for the repo.** It is A plus one process holding all shards. Process-wide installs collide, memory is
  the sum of six closures (Nine alone loads 616 modules), and nothing runs in parallel. What it adds (one entry point) is
  just A's driver. Rejected.
- **C. Keep the files, move them out of `src/`, read them at run time.** S–M, and it gives the quick G643 win. But it keeps
  the 264 subprocesses, the hand order, the hand-declared roots and the cache per file, and it loses types. That is the
  dependency hell in a new folder. Rejected; A's lint ratchet gives the TypeScript win shard by shard.

**5. Shard folder after the redesign.** Source only under `src/shards/<slug>/`:
- `shard.config.ts`: the program entry, source in → shardfile out.
- `generators/`: pure build-time functions (inputs → rows / bytes). They do I/O only through `ctx.cached` and `ctx.asset`,
  and the runtime never imports them.
- `data/`: authored rows only (hand-edited JSON / TS, committed).
- `runtime/`, `behaviour/` (`.as`), `look/`, `models/`, `blender/` (`.py`), `audio/`, as today.

Generated output, never under `src/`:
- `out/<slug>/`: the shardfile product. Its content-addressed files replace `public/assets/<slug>/baked/` and
  `src/shards/*/assets/`.
- `~/.cache/wildshard/gen/<slug>/`: the step cache.

Committed authored binaries (TRELLIS / Hunyuan / Blender GLBs, HDRIs, the 7 browser / ImageMagick outputs per D2) stay
in `public/assets/<slug>/` as real `.glb` / `.png` / `.ktx2` / `.bin`. App-wide tables (`src/game/**/*.generated.ts`,
`discovery.generated.ts`, boot tables) become build-time virtual modules (D4).

**6. Lint bans.**
- `wildshard/no-generated-import`: no import specifier matching `.generated.`, or naming a path a step writes, from `src/`
  or `test/`. It uses a shrinking burn-down list (today: ~200 generator files, 266 tests, 7 runtime files).
- `scripts/check-paths.mjs` adds a check: after `pnpm gen`, `git status --ignored src` lists nothing. No file under `src/`
  is generated, and `.gitignore`'s `src/**/*.generated.*` becomes this ban.
- `ktx2.generated.ts` (committed) is renamed to `ktx2.ts` as authored data, or moves into the product.

## Rows (per shard: biggest win first, Nine as pilot)

| Row | What | Size | Done when |
|---|---|---|---|
| GR0 | done (2026-10-24, sp-x1): existing import ban `7d9ada1bbb` plus generated-source guard; exact-path output debt only shrinks, G656 app sources remain separately reviewed | S | staged/push Git checks and pre/post-gen + CI tree checks refuse new source outputs; 138 focused cases pass |
| GR1 | done (2026-10-24, sp-x1): SDK `ctx.cached` / `ctx.asset`, in-memory boss metadata and Template/Pastel map/world programs; `de4c2ed072` + `89dc5c0c07` + `ea96805666` | M | Exact `ea96805666` full preview passes all 24 products in 165.42 s; both folders have zero job rows and no new file under `src/` after generation/build |
| GR2 | done (2026-10-24, sp-x1): `326950c025` + `78681f7cf5`; app tables then the existing per-product build pool, heavy-lane, scoped `--shard=`; preparation-only CI preserved | S | fresh Node refuses any scheduler import for a fully converted folder; 29 focused + 410 ready-related cases pass; exact `78681` generation builds all 24 products |
| GR3 | in flight (2026-10-24, sp-x1): **Nine** (28 jobs at claim; 13 remain): direct row, physics and schema calls replace imports; `castHook` / `lightSpill` / `paintArray` become cached `.glb` / `.bin` (closes B4); atlases per D2; its tests call functions | L | 0 Nine rows in the catalogue, 0 `*.generated.*` under its folder, product validates, boot smoke green |
| GR4 | **Sunscar** (23 jobs) | M | same bar |
| GR5 | **Far Reach** (47) | L | same bar |
| GR6 | **Nalati** (47; 69 product imports, `poiPaint` / `grass` / `geography`) | L | same bar |
| GR7 | **Driftwood** (41; chain of 5, `rockScenes` / `mapAssembly` number arrays) | L | same bar |
| GR8 | **Pine** (60; HDRI keys and painted per D2) | XL | same bar |
| GR9 | Small shards (ink-cel, blender-template, open-plots) and the 5 shared `scripts/bake-*` (pickups, textures, terrain, schemas) as game functions | M | catalogue empty |
| GR10 | Runtime: the 7 runtime / plugin imports of outputs read shardfile sections | M | no runtime file imports a step output |
| GR11 | App tables to virtual modules (D4): starter tables, slugs, discovery, boot tables, budgets | M | no `*.generated.*` anywhere under `src/` |
| GR12 | Delete `generation-jobs.json`, `generate.mjs`, the `generation-*` helpers, the `*.d.json.ts` shims and the generated `.gitignore` lines; burn-down lists empty | M | the files are gone and both bans have no exceptions |

GR0–GR2 first, then one shard at a time, each an independent lane-task that lands in small commits. The gen plan's timings
pick which steps get `cached`.

GR0's `lint/generated-source-debt.json` records 4,059 existing paths at
`63cf947c11dee851358580da8f10b1645d60d5bd`: committed declared outputs, marked generated source and historical ignored outputs.
This is a conservative path ceiling, not a live-byte census or permission to add another path. Dependency installations
are excluded. `scripts/generated-source.mjs` sees both Git checkouts and sealed build manifests; ignored generated TS
cannot hide behind lint exclusions. The real hook previously accepted a new generated TS file with no staged JSON;
its regression now refuses. Immutable push fixtures prove dirty guard/policy/output files cannot hide the committed
offender. Ordinary authored JSON/TS stays allowed; G656's app-source exemptions keep their existing separate ratchet.
Current-tree source-output check passes. The broader `check-paths` command remains red on stale/frozen-layout and fixture
path diagnostics, separate from the generated-source check; no broad path-check pass is claimed.

GR2's ordinary `pnpm gen` now runs app inputs then the product pool. `--shard=<slug>[,<slug>]` resolves composed product
slugs to their source folders and bounds product/map work even in strict mode. A named value-level `generate` export
with zero remaining catalogue rows bypasses `generate.mjs`; partial conversions retain it. Scoped legacy preparation
keeps shared producers and all transitive declared input writers, in catalogue order. Map preparation imports the
scheduler only when a selected painter needs it. CI's `--inputs-only` retains the generated-inputs → products split;
historical `--proof` / `--build-inputs` stay preparation-only. Types, lint, native and admin source preparation do not
start products, and unprepared CI checks no longer build products twice. Strict receipts/maps/admission remain intact.
The first scoped build exposed a noncanonical root argument (entry regression RED then GREEN in `78681`); its corrected
working-tree run refused concurrent source movement during boot-table generation. The exact-commit milestone instead
completed the new generation command with 24 products in 160 s, without borrowing the moving working tree.
Its full preview also passed (227.87 s total) and was stopped. Full-preview and parity wrappers now explicitly prepare
inputs before their own product phase; a real shell fixture reproduced duplicate product work before that correction.

GR1's Template and Pastel programs now pass compiled behaviour/boss metadata and map pixels directly to their
product. The SDK retains the original lossless map codec and charges its image; the existing public minimap URLs
are published only from the verified product, without shard-source metadata. Both original terrain/GLB raster
oracles are byte-identical; Pastel preserves its 167 file rows and 199,225-byte canonical declaration
(`56c3f47c…b864d`). Six remaining catalogue rows, seven launchers and 511 untracked old outputs retire;
the committed source art inputs remain unchanged. Final checks: 72 focused, 595 ready-related, named typed lint,
check-paths and refreshed layer/root/scripts types pass. CF1's separate bounded related check deferred at 60 s;
its warm-root check reported concurrent foreign assembly-fixture types, not a passing root result. The exact
full preview validates Template in 11.2 s and Pastel in 9.2 s. Both served public maps match their admitted image
hashes (5,438 / 5,822 bytes), and both built source folders contain exactly their committed files. The preview
was stopped. The push gate passes through `ea96805666`; its dirty-input fast lint explicitly defers to CI.

| Follow-up | What | Done when |
|---|---|---|
| GR-PATHS | done (2026-10-24, sp-x8): 181 → 0 tooling-path failures. Five identical Python harnesses moved beside their TS runners (`0228d34c52`); quoted Python f/regex strings no longer rescan as bare paths (`ac7db8225b`), with missing-literal refusals retained. Twenty stale references pruned/repaired (`b7f3e18243`): current client-plan retry witness, defining people-row source, retired census/model metadata. The sole unregistered/unreferenced Pastel product blob (`155219…`, 28,496 bytes) was rechecked and unlinked after the Template/Pastel writer released; no allow-list additions. | `node scripts/check-paths.mjs` exits 0. Python runner contracts, 32 model/retry cases, six path lexer cases, component census contracts, root/scripts types before concurrent GR1 movement, scoped typed lint, source-only freeze and exact committed deleted-path checks pass. Final source CF1 ran 300 tests / 43 suites green; its warm root explicitly deferred on concurrent GR1 Template-generator removal. Existing standalone model audit stays at the same 14 violations before/after; no model ceiling widened. |

GR3 source boundaries: product/layout/movers and the pure output factory are callable with owned inputs.
`1399b039e1` removes duplicate source preparation while retaining every original layout/metadata/397 asset-byte oracle.
Native decal inputs are pinned real PNGs under `public/assets/nine-dragon/authored/`, with a separate native staleness
check and cold/hit image admission. The author entry now returns owned output: movers compile through the injected
cache, portal evidence is freshly proved, and pinned native PNGs enter as owned bytes. Three scheduler rows and
their old handoffs retire. Every original admitted file hash/length/contract and PNG pixel oracle is retained;
the real SDK product build passes in 13.1 s. Thirteen legacy rows remain for world/course/discovery and other
native assets. Source navigation now derives the exact ordered WSNM declaration and publishes all 6,047 original
bytes through the build capability; the world assembly receives this invocation's seed/material IDs as data.
The full declaration/file/pixel oracles and actual SDK build pass (11.1 s). Its legacy discovery binding/job stays
until the shared cold-product discovery bootstrap is resolved; the import allowance shrinks from three to two.
GR3's zero-row, zero-generated-source and final boot acceptance remain open.

## Decisions (decided G654: GD1 A, GD2 committed binaries, GD3 call functions, GD4 superseded by G656: app-wide tables are committed generated source in `src/`, regenerated by pre-commit when their inputs change, GD5 Nine)

1. **Design:** A (one program per shard, the shardfile build calling its generators), B, or C? **Recommend A.**
2. **The 7 browser / ImageMagick steps:** committed real binaries in `public/assets/<slug>/`, rebuilt by a separate
   `pnpm assets <slug>` with a staleness check, or run inside gen with a browser in CI? **Recommend committed binaries.**
3. **Tests that read outputs (266):** call the functions (cached), or read the built `out/<slug>` product?
   **Recommend calling the functions; only whole-product tests read `out/<slug>`.**
4. **App-wide tables:** Vite virtual modules with a hand-written `.d.ts`, or files in `out/gen/` behind an import alias?
   **Recommend virtual modules.**
5. **Pilot shard:** Nine (biggest base64 and TypeScript win, every kind of step) or Sunscar (smallest)?
   **Recommend Nine.**

## G656: generated source files (committed, never stale)

| Row | What | Size | Done when |
|---|---|---|---|
| GS1 | Inventory every generated file meant to live in `src/` (today's 15 app-wide tables: shard list, slugs, boot packs / versions / bytes / audio, starters, ktx2, art, clips, port shares, manifest closure) with its inputs and the command that makes it | S | a table of file → inputs → command |
| GS2 | `pnpm gen:source`: one generic runner over a small registry (output path, input globs, generate function), separate from the shard builds | M | every generated source file comes from it |
| GS3 | Commit them: drop their `.gitignore` lines; each starts with a 'generated by gen:source from <inputs>' header | S | the files are tracked |
| GS4 | Pre-commit: when a staged file matches a registered input, regenerate the outputs it feeds and stage them (no 5 s cap for this step, per Jake) | M | changing an input in a commit always carries the regenerated output |
| GS5 | CI and the push gate run `gen:source --check`: fail if any committed output differs from a fresh run | S | a stale generated source file cannot reach main |
