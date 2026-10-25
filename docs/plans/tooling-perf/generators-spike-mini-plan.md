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
| GR3 | in flight (2026-10-24, sp-x1): **Nine** (28 jobs at claim; 5 remain): direct row, physics and schema calls replace imports; `castHook` / `lightSpill` become cached `.glb` / `.bin`; dead `paintArray` retires (G416, closes B4); atlases per D2; its tests call functions | L | 0 Nine rows in the catalogue, 0 `*.generated.*` under its folder, product validates, boot smoke green |
| GR4 | **in flight (2026-10-24, sp-x6): Sunscar** (23 at claim; 2 remain). Twenty-one jobs retired with exact source-product parity; cached rigs are now owned by the product, ground metadata/tint use direct source queries. | M | same bar |
| GR5 | **Far Reach** (47) | L | same bar |
| GR6 | **Nalati** (47; 69 product imports, `poiPaint` / `grass` / `geography`) | L | same bar |
| GR7 | **Driftwood** (41; chain of 5, `rockScenes` / `mapAssembly` number arrays) | L | same bar |
| GR8 | **Pine** (60; HDRI keys and painted per D2) | XL | same bar |
| GR9 | Small shards (ink-cel, blender-template, open-plots) and the 5 shared `scripts/bake-*` (pickups, textures, terrain, schemas) as game functions | M | catalogue empty |
| GR10 | Runtime: the 7 runtime / plugin imports of outputs read shardfile sections | M | no runtime file imports a step output |
| GR11 | App tables to virtual modules (D4): starter tables, slugs, discovery, boot tables, budgets | M | no `*.generated.*` anywhere under `src/` |
| GR12 | Delete `generation-jobs.json`, `generate.mjs`, the `generation-*` helpers, the `*.d.json.ts` shims and the generated `.gitignore` lines; burn-down lists empty | M | the files are gone and both bans have no exceptions |

### GR4 current ≤ 1 h slices (G711)

| Slice | Status | Boundary |
|---|---|---|
| Rig recipe | done | Cached source inputs; all five original native files byte-exact, detached cache hits, one pure author bundle. No job removed in this preparation slice. |
| Rig adoption | done | `signal-rigs` retired (19 → 18): four original GLBs (1,372,196 B) plus the same parsed skeleton. Product URLs and computed boot bindings replace four public URLs; retained native view producer keeps all 20 files exact. Cold scoped generation passed (26 s), full original admission projection and sealed omission proofs pass. |
| Ground handoff retirement | done | `signal-manifest-ground` retired (18 → 17; 1,189,382 B / two unused JSON outputs). Existing pose/tint consumers query source directly; stale input roots and unused sampler/writer removed. All 66,049 f64 means and original pose metadata pinned; full product/discovery/physical-byte oracles unchanged. 74 related cases / 12 suites, touched-layer/fixture types and typed lint pass; four unrelated product suites explicitly deferred. Stable scoped inputs-only generation passes (39.67 s), both retired files remain absent and source-tree guard passes. The initial generation refused an owned whitespace edit during its input hash fence; no guard relaxation or runtime-memory gain claimed. |
| World cache recipe | done | Cache the next-largest handoff, `signal-world` (818,685 B / 15 files), from the original well model through the existing pure world bake. All original GLB/JSON/plait bytes match on cold and detached cached results; incomplete/extended/empty bank refusals and a single config-safe author chunk pass. Four related cases, touched shard/fixture types and scoped typed lint pass. Production entry stays unchanged; consumer adoption and job retirement are next, with 17 jobs still present. |
| World map byte reader | done | Forward the painter's existing owned-or-file resolver to scene pools/bakes; physical-path callers and their document caching stay intact. Real GLBs paint without published files, preserve selectors/placements and produce byte-identical WebP to physical inputs; missing undeclared sources still refuse. 343 ready-related cases / 47 suites, fixture types and scoped typed lint pass; one stale Template product suite explicitly deferred. World consumer adoption / job retirement remain next; 17 jobs still present. |
| World map consumer | done | Supply all seven original world GLBs and metadata directly from the defining native bake; no physical world handoff is read by the painter. Original complete 172,348 B WebP and pixel hash match in isolation. Real sealed native producer passes (3.02 s); omitted well-model root refuses. 20 related cases / two suites, touched-shard/fixture types and scoped typed lint pass. Product/world metadata consumers still precede final `signal-world` retirement; 17 jobs remain. |
| Owned bake file binding | done | Bind admitted bake mesh/deflated companion names to verified product URLs in the existing scene preparation path. Preserve public-file descriptor identity, source rows, resource failure policy and URL refusals; no new loader or host. Seven focused cases, 852 related cases / 152 suites, game/test project types and scoped typed lint pass. World product consumer adoption and final job retirement remain next; 17 jobs remain. |
| World metadata decoding | done | Decode the seven existing cached documents, validate original kind/box/anchor fields and bind each to its GLB hash. Complete original JSON byte/hash and aggregate pins, detached results and malformed/missing/oversized/UTF-8 refusals pass: 15 related cases, touched-shard/fixture types and scoped typed lint. No new named JSON/schema or host; production consumer adoption and job retirement follow, with 17 jobs remaining. |
| World recipe factories | done | Held/specimen recipes, model/bake descriptors, scene bindings and output accept explicit world rows. Full original output byte/hash and every scene-file identity match; supplied dimensions are consumed, repeated calls own scene arrays, missing braziers/surfaces refuse. 74 ready-related cases / 11 suites, touched-shard/fixture types and scoped typed lint pass; four stale-product suites explicitly deferred. Current entry stays valid; owned asset/discovery adoption and final `signal-world` retirement follow, with 17 jobs remaining. |
| World quest anchors | done | Quest markers, saved page and client plan accept the verified world anchors without JSON reads in the factory. Full original saved-page hash and plan parity retained; moved/missing anchors are tested. 63 ready-related cases / 10 suites (four stale-product suites deferred), touched shard/fixture types and scoped typed lint pass. World adoption follows. The five public rocks/dressing/tower/caravan/well GLBs (380,964 B) are legacy-held, owner LD, under G606/G694; byte-exact until legacy deletion. RM2/RM3 are done (`aab5aca4737`); 17 jobs remain. |
| World product ownership | done | Actual source entry admits all seven original GLBs and the plait companion (15-file cold/cache hashes unchanged); scene libraries and quest policy consume the same verified metadata. Boot discovery drops exactly the 11 owned rig/world public URLs. Exact old declaration/assets/output projection retains all original hashes while adding the 12 rig/world files; plait costs include 196,608 decoded + 262,140 GPU bytes. Ready-related cases, touched shard/fixture types and typed lint pass. Default readers/writer removal follows; 17 jobs remain. |
| World handoff retirement | done | Retire `signal-world` (17 → 16 jobs), its writer/default readers, seven metadata and three public binary handoffs (437,721 B). Actual product owns all 15 original bytes/hash identities; full declaration/output projections and map WebP remain exact. Cold scoped generation passes 48.86 s (Sunscar product 8.4 s), no handoff regrowth; 75 ready-related cases / 13 suites, touched shard/fixture types and scoped typed lint pass (four stale-product suites deferred). Five public GLBs remain legacy-held, owner LD: `rocks`, `dressing`, `tower`, `caravan`, `well` (380,964 B), byte-exact under G606/G694 until LD. RM2/RM3 are done (`aab5aca4737`). |
| Sand cache recipe | done | Next-largest `signal-sand` handoff: 772,825 B / seven files. Cache the original procedural shadow/trail/grain maps, means and skirt using the pinned deflate/zstd codecs. Every original file hash is exact cold and warm; cached results detach, injected inputs and incomplete/extended/misnamed/empty banks refuse. One author chunk has no file/compiler service. Four related cases, touched shard/fixture types and scoped typed lint pass. Source product remains unchanged; map/mean consumer adoption and job retirement follow, with 16 jobs remaining. |
| Sand consumer adoption / retirement | done | Retire `signal-sand` (16 → 15 jobs), its writer and all seven handoffs (772,825 B). Source product publishes the same three KTX2 hashes/costs and consumes verified grain means; unchanged skirt GLBs own the scene. The retained declaration derives sand from the same bake, with an exact native closure and no output seeds. Original 196,187 B declaration hash plus old product/output oracles remain exact. All seven cold/cache hashes match; missing helper negative / repaired sealed positive and metadata/cost/reference refusals pass. 80 ready-related cases / 15 suites, touched-shard/fixture types and typed lint pass; four stale-product suites deferred. Cold scoped generation 42.47 s, Sunscar product 9.1 s; no handoff regrowth. Computed phone boot drops only the unused 553,758 B skirt pack. No shader/look/frozen source change. |
| Map raster separation | done | Prepare next-largest `signal-data-map` (345,386 B / four outputs): one canonical terrain/props/private-scene raster operation now returns owned RGBA before image/stamp publication. The existing adapter retains declared-file authority, output exclusions/styles, source-change checks and exact codec/stamps. Independent calls own their pixel/height storage; original refusals stay strict. Sunscar full WebP/pixel and Nine full-map goldens remain exact; 347 related cases / 48 suites, touched fixture types and scoped typed lint pass. Actual sealed Sunscar producer retains the original 172,348 B image and all source triangles. No product adoption/job retirement yet; 15 jobs remain. |
| Map geometry byte boundary | done | The existing ground baker and retained terrain/private-scene painters now share one typed raster class with no filesystem/module/compiler graph. Owned GLBs need no reader; retained file identities resolve only through an explicit adapter and keep per-raster document caching. Native selectors/placements, clipping, terrain coverage and full Template/Pastel/Sunscar/Nine pixel goldens remain exact. Sealed map closures and all eight retained painter freshness declarations explicitly include the new defining leaf; actual Sunscar producer passes (5.98 s), with all 269,039 triangles and the original 172,348 B WebP. 366 related cases / 55 suites, touched SDK/fixture types and scoped typed lint pass. No new package export or runtime service; private-scene byte consumer wiring remains next, with 15 jobs remaining. |
| Map private-scene byte boundary | done | Move the existing pool/packed/baked/fitted-model interpreter into a typed SDK build-only leaf; remove its script implementation rather than retaining a second algorithm. Preserve traversal/order, exact poses, aliases, transparent omissions, hidden-standing instances and refusals. The caller supplies model URL mapping; no public directory, filesystem or runtime service is inferred. All five retained freshness declarations and six sealed job roots follow the defining module. Full Sunscar/Nine image goldens, 359 ready-related cases / 51 suites, SDK/fixture types and scoped typed lint pass. The actual sealed Sunscar producer passes (3.28 s), retaining 269,039 triangles and its original 172,348 B WebP; one author chunk passes the unchanged config guard. Source-product map consumer adoption follows; 15 jobs remain. |
| Map source operation | done | The existing SDK ground-map module now defines `rasterSceneMap` for caller-owned terrain/props/GLB/private-scene inputs. Retained adapters and source programs share one placement loop; palette/codec, file authority and whole-library/empty/refusal checks stay intact. Full map goldens and 370 ready-related cases / 55 suites, SDK test-project types and scoped typed lint pass; the source map prototype reproduces every original pixel and encoded byte. Manual/source API documentation included. No package export, host, runtime or output file added; Sunscar activation/retirement is the next slice, with 15 jobs still present. |

| Map product adoption / retirement | done | Retire `signal-data-map` (15 → 14 jobs), its writer/readers and three shard-source handoffs (173,038 B). The product caches the original terrain/world/rest raster and publishes its exact 172,348 B WebP; the public map URL remains product-published. Full original pixels, encoded hash, world inputs, cold/cache isolation, missing/extra inputs and cache refusals pass. External models require the caller’s explicit asset root; one author chunk passes the unchanged service guard. Cold scoped generation passes in 44.97 s (Sunscar product 8.7 s), with retired shard-source files absent. 74 ready-related cases / 13 suites, touched shard/fixture types and scoped typed lint pass; four stale product suites remain CI-deferred. Legacy-held world assets and look stay untouched. |

| Declaration handoff retirement | done | Retire `signal-declaration` (14 → 13 jobs), its unused JSON writer and 196,187 B handoff. The product already calls the defining source function; quest regressions now consume its actual result. Full original declaration bytes/hash remain exact; fire/sand cache ownership and refusal cases stay intact. Cold scoped generation passes in 30.12 s with the handoff absent. 80 ready-related cases / 15 suites, 13 focused cases, touched shard/fixture types and scoped typed lint pass; four stale product suites remain CI-deferred. No product/look/frozen-source change. |

| Rest-fire cache and URL binding | done | Cache the next-largest `signal-rest-fire` GLB (72,196 B) and its actual primitive names; cold/hit full-byte hash, detached ownership, input/cache/publication refusals and one pure author chunk pass. The existing scene-source URL resolver binds admitted geometry pools as well as rigs, retaining public-row/part/channel identity and refusal propagation. Eight focused/related cases, game/shard production types, touched fixture types and named typed lint pass. No adoption/job removal yet; 13 jobs remain. |

| Rest-fire product adoption / retirement | done | Retire `signal-rest-fire` (13 → 12 jobs), its wrapper and 72,196 B public handoff. The product owns the original GLB hash/costs and nine named primitives; its scene descriptor rebinds only that pool, and phone/desktop discovery removes only the retired URL. Well/oil pools, original declaration/output projections and frozen legacy assets stay exact. Final scoped generation passes in 19.60 s with the handoff absent; 78 ready-related cases / 15 suites, touched shard/fixture types and scoped typed lint pass (four stale product suites CI-deferred). |

| View metadata source preparation | done | Prepare the next-largest `signal-view-data` (48,373 B / 20 files). The actual cached rig result now supplies the skeleton explicitly; the unused population-library field and generated default import are gone. Source discovery also supplies budgets, poses, cues and late reads before manifest adoption. All 20 original JSON/declaration hashes match, with namespace enumeration normalized only in the test oracle; 71 other ready-related cases, touched shard/fixture types and scoped typed lint pass. Four product suites stay CI-deferred; the old producer/bindings remain for the next slice (12 jobs). |

| View handoff retirement | done | Retire `signal-view-data` (12 → 11 jobs), its writer, obsolete sealed-writer test and all 20 source handoffs (48,373 B). Budgets, poses, cues and late reads now use the already-landed strict product discovery values; the actual cached skeleton remains explicit. All 20 original JSON/type-file hashes and complete original product/output oracles pass. Cold scoped generation passes in 13.30 s with every handoff absent. 33 related cases / five suites, touched shard/fixture types and scoped typed lint pass. Follow-up refusal coverage checks each of the six required discovery values independently, preserving the original missing-boot-files refusal as budgets now comes first (seven focused/related cases pass). No frozen source or runtime guard change. |

| Navigation transport ownership | done | Prepare the next-largest `signal-navigation` (38,644 B / two outputs) by declaring the existing public transport URL as an exact shard-owned asset before its source consumer. The original 36,183 B WSNM hash is checked; no transport bytes or guard change. Five source-entry cases, touched shard/fixture types and scoped typed lint pass. Cached source operation and adoption follow; 11 jobs remain. |

| Navigation source adoption / retirement | done | Retire `signal-navigation` (11 → 10 jobs), its writer, duplicate 36,183 B WSNM and 2,461 B metadata handoff. The source program owns the original native bytes and supplies the same ordered layers/costs/URL to both declaration and strict discovery. Cold/hit isolation, changed-source and missing/extra/cache/byte/publication refusals plus one pure author chunk pass. Cold scoped generation passes in 24.99 s with both handoffs absent. The related run passes 76 cases; its one stale first-refusal assertion was fixed forward, and the seven-case suite now covers navigation too. Touched shard/fixture types and scoped typed lint pass; four stale product suites remain CI-deferred. No collider, frozen source or look change. |

| Rest-scene metadata retirement | done | Retire `signal-rest-scenes` (10 → 9 jobs), its wrapper and 29,610 B JSON handoff. The source program passes actual place bindings into the existing scene assembler; its existing format parser validates fields without bringing a geometry builder into the metadata-only bundle. Every original metadata byte and complete product/scene oracle remains exact, with independent mutable recipe/list ownership. Cold scoped generation passes in 20.55 s with the file absent. 82 ready-related cases / 17 suites, touched shard/fixture types and scoped typed lint pass; four stale product suites remain CI-deferred. No geometry, collider, frozen-source or look change. |
| Physics handoff retirement | done | Retire `signal-physics` (9 → 8 jobs) and its 23,200 B JSON handoff. The existing product and native witness consume the same defining source declaration; both fresh and shared values retain every original collider/actor/seed/prompt byte. The native witness now uses the actual admitted product and verifies every asset length/hash instead of invoking a graphics-producing fixture under the strict renderer-free loader. Gameplay, restore, 60 shipping-worker ticks and durable/deduplicated Ledger outcomes pass (6 s); no historical receipt re-pin or loader waiver. Cold scoped generation passes in 40.85 s with no handoff. Six related cases / two suites, touched-fixture types and scoped typed lint pass. No production physics, collider, look or frozen-source change. |
| Well pool retirement | done | Retire `signal-rest-well` (8 → 7 jobs), its wrapper and 8,124 B public handoff. The existing fire cache operation now also admits the unchanged well rope/pail/jar GLB under an owned product name; live motion/material/physics owners stay unchanged. Full original hash/part identities, cold/cache isolation, inventory/input/publication refusals and one config-safe author chunk pass. Original complete declaration/asset/output projections remain exact; boot drops only the retired well URL. Cold scoped generation passes in 39.85 s with no handoff; final-source refresh passes in 14.27 s. 79 ready-related cases / 16 suites pass after the one catalogue test was re-run on the completed removal; touched-shard/fixture types and scoped typed lint pass. Four stale product suites are CI-deferred. Legacy-held world-well bytes stay untouched. |
| Fixed-layout handoff retirement | done | Retire `signal-fixed-layouts` (7 → 6 jobs), its writer and three JSON handoffs (6,553 B). Coordinate/dune recipes already feed source consumers; the actual palette now enters validated product discovery, with data-only runtime literals and strict missing-value refusals. All three original complete byte hashes, fixed coordinate pins and full product/discovery oracles pass. Five retained jobs drop only obsolete layout/dune JSON input roots; their defining source roots remain. Cold scoped generation passes in 44.08 s with every handoff absent; the first attempt built Sunscar but refused a concurrently invalidated Nine receipt, with no guard relaxation. 75 related cases / 15 suites, touched shard/fixture types and scoped typed lint pass; four stale product suites are CI-deferred. No coordinate, palette, frozen-source or runtime look change. |
| Tower-physics handoff retirement | done | Retire unused `signal-tower-colliders` (6 → 5 jobs) and its 4,798 B JSON handoff. Production physics already calls the defining function directly; every original stair, rail, deck and contact byte is pinned by the new source golden. No collider recipe or runtime reader changes. Six related cases / two suites, touched-fixture types and scoped typed lint pass. Final scoped generation passes in 5.34 s with the handoff absent; an earlier boot-tail input-change refusal and collection-only prerequisites were retained, with no guard relaxation. |
| Placement-physics handoff retirement | done | Retire unused `signal-physics-placements` (5 → 4 jobs) and its 4,519 B JSON handoff. Existing production physics still calls the same camp/well/horse/brazier recipe; its complete original byte/hash golden passes. No recipe, contact, RNG, collider or runtime reader changes. Six related cases / two suites, touched-fixture types and scoped typed lint pass. Actual scoped generation passes in 35.25 s with the file absent. |
| Oil pool retirement | done | Retire `signal-rest-oil` (4 → 3 jobs), its wrapper and 3,336 B public handoff. The existing bounded rest-pool cache admits the original oil GLB and named part directly into the product; live visibility/material/physics owners stay unchanged. Original full bytes/hash, detached cold/cache results, publication refusal, all complete declaration/asset/output projections and boot URL parity pass. Actual scoped generation passes in 45.36 s with the file absent. 85 ready-related cases / 19 suites, touched-shard/fixture types and scoped typed lint pass; four stale product suites are CI-deferred. No shader, look, frozen-source or host/API change. |
| Held-playback handoff retirement | done | Retire unused `signal-held-playback` (3 → 2 jobs), its 3,156 B JSON handoff and obsolete ignore line. Production held recipes already call the defining function; all original root/grip/cord expression bytes remain pinned. No animation, clock, contact or runtime reader changes. Six related cases / two suites, touched-fixture types and scoped typed lint pass. Actual scoped generation passes in 6.28 s with no handoff regrowth. |

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
the real SDK product build passes in 13.1 s. Nine legacy rows remain for course/discovery and other native assets.
Source navigation now derives the exact ordered WSNM declaration and publishes all 6,047 original
bytes through the build capability; the world assembly receives this invocation's seed/material IDs as data.
The full declaration/file/pixel oracles and actual SDK build pass (11.1 s). Discovery now consumes the source program's
validated navigation receipt: the marker replaces the generated JSON reader,
and the navigation row, duplicate blob and old scene wrapper retire. A real cold scoped inputs-only generation, with
both old outputs absent, builds Nine before discovery/boot and passes in 36.8 s (product 15.1 s). Its strict current
receipt equals every original navigation value and all 6,047 bytes. The import allowance shrinks from three to two.
The held profile now reads all 14 original mesh/channel/transform rows from the authored GLB through the injected cache;
the 209-byte linear black texel is packed as owned binary, with no base64 JSON. Its graph/declaration/output consumers
receive this invocation's profile. All original declaration, admitted-file and material byte oracles remain pinned.
The legacy held-profile row, launcher and two handoffs retire.
The layout now returns checked source rows plus all 397 original GLBs through the injected cache and asset capability.
Its 399 former outputs (187,238,917 bytes) and scheduler row retire. Every predecessor wire and GLB hash stays exact;
scene, window, presentation and layout consumers receive the checked invocation rather than generated source.
Cold scoped generation passes with all 399 old files absent before and after (product 21.6 s); the strict discovery
receipt still equals the original navigation. The cache/output/entry and consumer checks pass 101 cases, related
passes 168 cases (one other-shards product suite explicitly deferred), and layers/root plus named typed lint pass.
Paint-array had no production reader: the live `kind:layers` path still reads the original JPEG/WebP images.
The dead job, 35,081,427 bytes across six outputs (including four declaration shims), and two dead-pack tests retire (G416).
The live baseline pins all nine layers, four looks and 24 tier images (4,867,237 bytes); full admitted-file checks stay.
The corrected sealed boot closure and scoped cold generation pass in 35.25 s (Nine product 21.2 s), with all six
retired files absent before and after. Sixteen focused cases, full layers/root and named typed lint pass. Ready-related checks pass 156 cases / 44 suites; two product suites explicitly defer to CI.
The casts now return owned raw/packed GLBs and checked hook metadata through the same source cache and asset capability.
All 78 predecessor files (28,871,657 bytes) and the launcher retire; the single job removal takes Nine from nine to eight.
Every predecessor hash, admitted asset/declaration byte and retained map/budget/world-row hash stays exact.
Cold scoped inputs-only generation passes with all 78 retired files absent before and after; discovery equals every
original navigation value. The final current-input receipt refresh after removing the obsolete scheduling hint also passes (38.67 s).
Fifteen focused checks and 160 ready-related cases / 35 suites pass; one other-shards product suite explicitly defers.
Touched shard/scripts types, named typed lint and the generated-source guard pass. No look or runtime policy changes.
The map painter now calls the source assembly and receives its scene and compressed geometry as owned values.
The single assembly job and its two source files (13,489,602 bytes) retire: Nine falls from eight legacy jobs to seven.
All original geometry/scene bytes and the 16,556-byte WebP hash remain exact. The retained native map job passes the
confined sealed-source loader; missing supplied inputs still refuse at the ordinary declared-path boundary.
Cold scoped generation passes in 54.11 s; strict original-navigation discovery, touched shard/scripts types and named typed lint pass.
696 related cases pass; one concurrent Sunscar fixture failure passes alone after its defining isolated-catalog fix.
GR3's zero-row, zero-generated-source and final boot acceptance remain open.

GR3 bounded slices (G711; each <= 1 h, one producer retirement per commit):

| Slice | Status | Boundary |
|---|---|---|
| C1 casts source/cache and host fixtures | done | All 78 predecessor files, admitted costs, cold/hit/refusal checks; no job retirement |
| C2 casts reader handoff and retirement | done | Nine 9 → 8; all 78 former files exact, cold scoped generation and full live output parity |
| Practice | open | Direct course program, then remove its two source handoffs |
| D1 declarations source/cache | done | Both original canonical wires (3,470,533 B), checked partition owners and cache/refusal checks; no job retirement |
| D2 declarations reader handoff | done | Nine 6 → 5; both source handoffs (3,470,533 B) absent, original canonical rows and full product bytes exact; cold scoped generation |
| Boot metadata | open | Direct checked geometry/presentation metadata |
| Glyphs | open | Preserve native raster bytes and replace source handoff |
| S1 sign-source cache | done | 28 files / 9,308,309 B and all 27 admitted rows exact; cold/hit/refusal and sealed adapter checks; no job retirement |
| S2 sign-source reader handoff | done | Nine 7 → 6; 28 source files (9,308,309 B) absent; all original admitted rows and full product bytes exact; cold scoped generation |
| A1 native sign-atlas admission | done | Defining metadata validator, seven-file cache admission and original native pixel/geometry checks; no job retirement |
| A2 GD2 native sign-atlas inputs | done | Seven original native files (2,126,972 B) committed outside source, explicit input ownership and standalone WebKit staleness check; no job retirement |
| A3 native sign-atlas reader handoff | in flight (2026-10-25, sp-x1; ≤ 1 h per slice) | First separate the defining metadata validator from the legacy generated-data adapter; then supply native metadata/bytes to scene, spill, light and sign builders. Their cache identities must include the native inputs; the light-volume seam is complete in A3a. No job retirement in this slice |
| A3a light-volume native input/cache | done | Checked readonly native atlas rows feed the light-volume factory; existing readers retain the validated legacy adapter. The layout cache includes all consumed atlas rows, including in-place edits. Both original compressed blobs/costs and all eight variants retained; four supplied-light/cache regressions, touched types/lint and related checks pass. No job retirement |
| A3b native world-cache handoff | done | The source entry admits all seven committed native atlas files before the world program. Supplied checked light rows participate in the world bake and persistent cache identity; all 399 original wires/geometry hashes, detached hits and changed-native cache refusals pass. Eight focused cases, touched types/lint and related checks pass; shared scoped generation passes in 44.08 s on stable bytes. No job retirement |
| A3c sign/scene native handoff | done | The admitted native metadata/bytes feed sign production and both participate in its cache identity. The same checked atlas reaches scene volumes, emitted volumes and presentation geometry. All 28 original sign wires, 27 admitted rows and complete product/scene oracles remain exact; changed native metadata must rebuild. Thirteen focused cases, touched/fixture types, scoped lint and related checks pass. Legacy adapters remain until A4 |
| A4 native sign-atlas retirement | open | Remove native scheduler handoff and seven source files (Nine 5 → 4); cold scoped generation |
| M1 map geometry/encoding separation | done | Pure defining geometry module; all original scene/pack bytes and native map image exact; no job retirement |
| M2 map assembly reader handoff/retirement | done | Nine 8 → 7; both former source files absent, exact scene/pack and WebP bytes; cold scoped generation |
| Data map | open | Own original PNG and metadata through source entry |
| Final acceptance | open | Zero rows/generated source, current product and boot smoke |


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

