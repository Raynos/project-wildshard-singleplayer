# Dead code: what to delete now that custom shard TypeScript is gone (mini plan)

**State:** `approved` 2026-11-04 ~15:46 Cancun by Jake (G1014): *"Yeah, the 13,000 lines deleted, 11 items, that plan sounds approved to me … You said it was what, 17,000 lines? Trailer tooling, we probably want to keep some trailer tooling. We want to make more trailers in the future that should be generic … Oh, fuck it. If you want to nuke it, we can bring him back from Git history. Like, just fuck it. Nuke the soak, nuke the trailer, we can bring him back from Git history."* DC1–DC15 are approved; the "Needs a closer look" items are approved too, each deleted once its own fresh importer search shows it dead (keep anything a live reader still uses). Was: `open`. Audit only (ask E531): nothing is deleted yet. 13 rows, about **17,500 lines: 175 files
deleted, ~190 trimmed**, all believed safe. One more row needs Jake's word (DC14, the soak, 1,713 lines). A "Needs a
closer look" list holds ~13,800 more lines (6,100 of them trailer tooling) that need an owner's check first. Builder:
take the rows in order. Each row is one or two small commits. Mark it here with the SHA when it lands.

Jake, 2026-11-04 (E531): *"Hey, shard platforms closed, all the custom codes deleted, spin up a sub-agent into audit and
review, what dead code we have to remove from the whole repository now that all the custom TypeScript has been deleted.
I feel like there must be so much fucking dead code everywhere, in the runtime, in the engine, just everywhere. So I need
a sub-agent that can use a cheaper Explorer sub-agent to just like really figure out where the hell is going on, where's
all the dead code, make a mini plan, dead code deletion."*

## The short answer

The runtime and engine are **cleaner than they feel at the file level**. The engine, game, SDK and format layers have no
whole module that nothing imports, apart from four (the legacy species catalogue and three frozen "before" copies). The
custom-TS deletions (SF/LD/NF18) took the modules with them. What is left falls into two groups:

1. **Dead functions and types inside live modules.** About 230 exports have no importer anywhere and are not used in their
   own file (~2,150 lines), plus ~100 more that are probably dead. Many are the `installNative*` / `native*` hosts that
   custom shard TypeScript used to call: today only tests call them.
2. **`scripts/`, the real graveyard.** Of the 737 scripts, about 230 are run by nothing (no `package.json` script, CI
   workflow, hook, skill, process doc or other live script). Most are one-off capture or measure tools for closed asks
   (E172, E314, E334, E350, SF22), SHARD-PLATFORM proofs and retired gate machinery. That is ~13,000 lines.

## How the audit was done, and its limits

- **Module graph (`tmp/dead-code-audit/`, deleted after):** every tracked `.ts/.mts/.mjs/.js` file outside
  `progress/ art/ project/ docs/` (7,797 files, with the git-ignored `discovery*.generated.ts` included because they
  import shard data). Static, dynamic and `vi.mock` imports were resolved through each workspace `package.json`
  `exports`. Reachability started from the app entries, the HTML pages, the Vite configs, `shard.config.ts`,
  `package.json`, `.github/`, `.githooks/`, `.claude/`, `AGENTS.md` and `docs/process/`. It followed import edges and any
  path or file name written in a reachable file. This was run twice: once leniently (comments and JSON count), once
  strictly (code only). A file counts as dead only if both runs missed it.
- **Per-file check:** each candidate's stem was grepped across the whole tree (bare word, `scripts/`, JSON registries,
  `.as`, `.py`, `.sh`). Candidates were kept only if no live non-test file names them, or if every file that names them is
  itself dead (computed as a greatest fixed point, so dead cycles count). Files with a commit since 2026-11-01 or a dirty
  working copy were moved to "Needs a closer look".
- **Export check:** for every `export function|const|class|type|interface|enum` in `src/{engine,game,sdk,format,commons,shards}`,
  the audit looked for named imports from that module, namespace and dynamic imports (where the export name must appear
  in the importing file), and string literals. "Dead" means no production importer and no other use in its own file.
  "High" means the bare name also appears in no other non-test file in the repo.
- **Also checked:** `scripts/unused-assets.mjs` finds **0 unused files under `public/`** (126 dev-only, kept). All 12
  `*.merge.d.ts` are live (each merged member has a reader). The Debug registry has no row whose winner was picked and
  is still live: the comparison capacity is 4 and every row has an open pick (`lint/ratchet.json` `debugRows`).
- **Limits:** a script an agent runs by hand from memory looks dead. So does a symbol reached only through a computed
  name or a dynamic path built at runtime. The audit already found one example and removed it from the rows:
  `placeUndergrowth`, which `scripts/bake-chunk.mjs` calls through a namespace. **Every row's check re-greps its own list
  first.** Templated runners (`scripts/bake-check.mjs` builds `bake-${baker}.mjs`) were checked by hand. Test fixtures
  are read through template paths, so this audit does not judge them. The subagent cap kept this a one-agent audit (the
  Explore fan-out was refused by `guard-subagents.sh`).

## Summary

| Category | Rows | Files | Lines | Confidence |
|---|---|---|---|---|
| Scripts nothing runs (one-off captures, old proofs, gate machinery, GAME-NORMALIZATION tools, loading bench) | DC1–DC5, DC13 | 149 deleted | 13,329 | high (DC13 medium) |
| Tests that only test dead scripts (counted in the row above) | DC1, DC3, DC4, DC13 | 9 | 603 | high |
| Engine / game / SDK / format whole modules (legacy species, "before" copies) | DC8, DC10 | 9 deleted | 1,212 | high / medium |
| Dead exports in engine / game / SDK / format / commons | DC6, DC11 | ~97 trimmed | ~1,310 | high |
| Dead exports in shard generators | DC7 | 84 trimmed | ~850 | high |
| Shard generator witness files only tests read | DC9 | 17 deleted | 817 | medium |
| Lint / budget / allow-list entries naming deleted files | DC12 | 7 trimmed | ~355 entries | high |
| `*.merge.d.ts`, `public/` assets, Debug rows | — | 0 | 0 | checked, nothing dead |
| Soak harness (needs Jake's word) | DC14 | 12 | 1,713 | high, ruling |
| Needs a closer look | list | ~200 | ~13,800 | owner's call |

By layer (DC1–DC13): **scripts/ + lint/ + test/ ~13,500 lines**, **engine/game/SDK/format/commons ~2,350**, **shards
~1,670**. Total ~17,500.

## Rows (biggest and safest first)

Every row lands as small commits with `scripts/commit.sh`. Re-grep the row's list first: the bare stem across the
tree, including `scripts/`, `.github/`, `.githooks/`, `.claude/`, JSON registries, `.as` and `.py`. Delete only what is
still unread. Each row's check:

- **Types:** `node scripts/typecheck-root.mjs` plus `tsc -b tsconfig.engine.json tsconfig.game.json` for layer rows. Run
  the SDK tests' own `src/sdk/tsconfig.test.json` when SDK files change.
- **Lint:** `node lint/ratchet.mjs --files-from` on touched files.
- **Tests:** `vitest related` on the edited files.

Deleting a `.mjs` also deletes its `.d.mts`. A deleted test also comes out of `test/durations.json` and
`test/ci-module-durations.json`. `*` marks a symbol that a test imports: delete that test case with it.

### DC1: one-off capture, measure and probe scripts for closed asks (73 files, 7,597 lines) · Codex · M

**DC1 source:** committed (2026-11-04, `5721c5896f84649745b5efba450d6b98cc0fef34`, migration-inventory follow-up `77f49c4c7306b2084a715bae0dc618d743c4a5c0`; types, related, deletion guard and scoped ratchet pass): remove 66 unread files. Keep number-path-probe and declaration (DW witness/fake reads), latch-grid-evidence and declaration (maintained latch tests), MIDI exporter (byte/hash tests), crossroads production-probe (current production recipe), and grid-ready-chromium (open KITCHEN-SINK finish rows). Fresh tracked-tree basename/path search includes tests, registries and data references; historical prose is not an importer.

The original candidate list follows. The committed cut excludes the live readers recorded above; the other asks or waves are closed.

- Ask captures: `scripts/{e172-clear-downloads,e314-nine-bag-capture,e314-pine-bag-capture,e334-fp-capture,e334-look-review-capture,e350-king-measure}.mjs`
- SF22: `scripts/sf22-{cadence,drawn-frames,shader-observer,shaders}.mjs`
- Pine shots: `scripts/pine-hollow-{audio-wiring,crag-shots,fps,hero-shots,perf-lap,polish-shots,sound-gaps}.mjs`
- Nalati captures: `scripts/nalati-{bow-capture,capture,creature-motion,hud-capture,king-music,ragdoll-check,reach,ride-b1,ride-capture,ride-physics,walk,creature-lineup}.mjs`, `scripts/creature-lineup.mjs`
- Other tools: `scripts/{playground-cards,playground-hubs,popin-fly,explore-multitouch,explore-view-taps,batch-first-frame,pwa-reload-check,grid-ready-chromium,number-path-probe,latch-grid-evidence,benchmark-generation,test-home-build-cache}.mjs`
- Folders: `scripts/{mem-trim/heap,memory/pausedSnapshot,graph-mesh-map/run,library-cache/run,tone-parity/run,music/export-midi,img2mesh/strip_backdrop,crossroads-rig/production-probe,bake/far-board,bake/rings-drive,parity/glbytes-probe,parity/prove-speed}.mjs`
- Practice: `scripts/practice/{bake_unimate_clips,capture_unimate_arena,unimate-rig-input}.mjs`
- Oneshot: `scripts/oneshot/{browser-broker,browser-channel,browser-policy,seat-browser}.mjs`
- Test: `test/generation-benchmark.test.ts`
- **Evidence:** fresh importer/data/ref searches find no remaining consumer of the 66-file cut; the initial graph missed the seven retained files. **Risk:** an agent
  still runs one by hand. Its git history keeps it. **Check:** the re-grep, then types.

### DC2: SHARD-PLATFORM M3 look-parity proofs (15 files, 1,661 lines) · Codex · S

**DC2 source:** committed (2026-11-04, `b8a2e57b12e2100badc13ae64a91458b0ff90984`; types, related and scoped ratchet pass): remove 13 unread proof files; keep parity/shader-code.mjs and its declaration because world-scene-baked-model.test.ts imports the shader normalizer.

These are base-vs-candidate pixel proofs from SHARD-PLATFORM M3 and W1 C1. That plan is archived, and the `goldens`
skill (24 SHARDFILE cameras) is now the look check (AGENTS.md).

- `scripts/proof-{driftwood,pine,nalati,signal,sky}-look-parity.mjs`
- `scripts/{look-parity-creatures,w1-c1-parity,nalati-parity,nalati-paintover,nalati-poses,proof-texture-retirement}.mjs`
- `scripts/parity/{shader-code,terrain-settle}.mjs`
- **Evidence:** the 13-file cut has no live reader; the shader normalizer and declaration remain for their maintained test. **Risk:** none at runtime. **Check:** the re-grep, then
  types.

### DC3: tile-plan, tile-census and draw-hook proof tools (16 files, 1,383 lines) · Codex · S

**DC3 source:** committed (2026-11-04, `c12abf07402398b4ea0f255748d1862d99d0341d`; types, related and scoped ratchet pass): remove 17 unread files, including all eight retirement-only cases. The frame-floor-grid import was type-only; there were no frame-floor-grid runtime cases in that test to retain. Live frame-floor-grid and its dedicated tests remain.

- `scripts/tile-plan-{page,reading,report}.mjs`, `scripts/tile-retirement-{chromium,proof}.mjs`
- `scripts/parity/tile-census{,-scene}.mjs`
- `scripts/perf/draw-hook-component{s,-build,-scene}.mjs`
- Tests: `test/tile-census.test.ts`, `test/tile-census-scene.test.ts`
- `test/tile-retirement-proof.test.ts` had only a type import from live `scripts/frame-floor-grid.mjs`; all eight cases exercised the retired harness, so that exclusive test was removed.
- **Evidence:** only each other and their tests read them. Three were swept by `d0d8d26283` today (an ENTER WORLD rename),
  which is upkeep, not use. **Risk:** a manual tile proof. **Check:** the re-grep, types, `vitest related`.

### DC4: retired commit and push gate machinery (19 files, 940 lines) · Codex · S

**Done (2026-11-04, sp-x9): `a0683f3a83`.** Fresh full-tree and relative importer searches include tests, data and references. Delete 19 retired files and five exclusive suites, their nine timing entries, and the one retired local-checker case in the otherwise live project tests. Root types, all six retained project tests and scoped scratch-baseline ratchet pass. The current commit hook still runs successfully. No live hook/workflow/publisher reader remains.

CF1's walk, candidate planner and related checks were retired by DL3 (`18fa9fcfe6`, GIT.md). The 45 s push gate (G768)
replaced the local gate.

- `scripts/precommit-{imports,selection,projects}.mjs`, `scripts/push-committed-check.mjs`,
  `scripts/local-gate-checks.mjs`, `scripts/check-staged-inputs.mjs`
- `lint/commons-closure.mjs` (G143: nothing loads it)
- Tests: `test/precommit-{imports,projects,selection}.test.ts`, `test/push-committed-check.test.ts`,
  `test/commons-closure-cache.test.ts`
- **Evidence:** nothing in `.githooks/`, `scripts/commit.sh`, `scripts/push-loop.py` or CI names them. **Risk:** low.
  **Check:** the re-grep, then commit through `scripts/commit.sh` (the hook itself proves it does not need them).

### DC5: GAME-NORMALIZATION and E357 one-offs (10 files, 830 lines) · Codex · S

**Done with live dependencies retained (2026-11-04, sp-x9): `16383f934c`.** Delete six unread script/declaration files. Keep `normalize/classify.mjs`, `core.mjs` and their declarations: the explicitly retained `move.mjs` imports both, a fresh-search correction to the original list. Root types and scoped scratch-baseline ratchet pass; related finds no surviving suites and exits 0. No timing/product/chargeback row names these deleted paths.

- `scripts/normalize/{classify,core,port-probe}.mjs` (E357 F6: `normalize/move.mjs` and `move.dry-run.json` stay,
  because `check-paths.mjs` reads them)
- `scripts/plan-lint.mjs` (the GAME-NORMALIZATION v2 plan's lint; the plan is archived)
- `scripts/shard-custom-inventory.mjs` (G396 custom-TS inventory: custom TS is now zero)
- `scripts/check-asset-case.mjs` (E357 F3.2)
- **Evidence:** no live reader. **Check:** the re-grep, then types.

### DC6: dead exports in engine, game, SDK, format and commons, non-visual (~98 symbols, ~937 lines, 80 files) · Codex · M

**DC6 source committed (2026-11-04, sp-x2; handed off by sp-x9):**
27 exports in 23 modules retired in four layer commits: engine
`9eadffa837`, game `68bc672313`, format `04216c3b37`, SDK `dac765c2d4`.
Fresh symbol, module/namespace/dynamic-import and data/ref searches found
no consumer for the 26 prepared exports; `HerdMode` was one additional
unused alias (the native oracle defines its own independent type).
Seventy candidates retain real tests/native-fixture/component-registry
readers; `CustomSectionSchemas` remains exclusively with Z15. No native
oracle constructor or refusal/restore assertion is retired by this slice.
Newly unused imports/private `Present` and the two obsolete manual API
paragraphs are gone; no timing/product/chargeback row names this cut.

Root test types, engine/game and SDK-test types pass. Existing G612 live
related selections pass: engine 59 suites/159 cases, game 56/153; format's
32 remaining suites/62 cases and SDK's 42 remaining suites/159 cases pass
without repeating already-passed consumers, plus the writer's 1/1 case.
The full deferred closure remains for CI. Typed lint, per-layer scoped
scratch ratchets and the derived schema-reference check pass. All schema
fields/bounds and live host consumers remain unchanged.

These are mostly the `installNative*` / `native*` hosts that custom shard TS called, now reached only by tests:
`installNativeTaming`, `installNativeEliteFeature`, `installNativeQuestProps`, `installNativeHerdShelter`, the
`nativeQuestChannels` set, `installHostPortalRide`, `nativeDecisionAuthority`. The rest are input and output types and
parsers that nothing reads. The exact list is in the appendix "DC6".

- **Evidence:** no named import, no namespace or dynamic importer that names them, not used in their own file, and the
  bare name appears in no other non-test file.
- **Risk:** a test may be the only harness for a host that a shardfile still binds by name. The re-grep covers `.as`
  and JSON. Delete the starred test cases with the symbol, then remove the helpers that `noUnusedLocals` reports in the
  same commit.
- **Check:** types (layers + root), lint, `vitest related`.

### DC7: dead exports in shard generators (~111 symbols, ~850 lines, 84 files) · Codex · M

**done (2026-11-04, sp-x2 + sp-x6): `a6f68ae757` + `5967f0bdb7`.**
Fresh 111-symbol importer/namespace/dynamic/test/data searches retained
actual readers, including Nalati's namespace-spread COLLISION and the
original Spear profile admission. Removed 54 unread exports across 42
modules (sp-x2: 23/18; sp-x6: 31/24); five older appendix candidates were
already retired by DC9. Root/shard/SDK-test types, typed lint and scoped
ratchets pass. Related: sp-x2 59 suites/157 cases pass; sp-x6 161/165
suites passed initially, then the four pre-existing Z15 fixture failures
were aligned in `6277ba41d9` (4 suites/23 cases pass). Schema controls pass;
the ignored generated reference still needs the pusher's Z15 max-0 refresh.

Normal immutable all-28 BEFORE `dba567db5c` / `dba567d-mw2n0ivo` and
combined AFTER `5967f0bdb7` / `5967f0b-mw2o1po8` qualified. Independent
physical eight-shard audit: 2,750 files, 382 sections, 112 packs and 3,063
members; every file and 375 sections exact. Seven 164-byte look/map bodies
change only tilesHash, with identical image hashes; Pine's payload is exact.
Pack order, offsets, lengths and every byte outside those map members stay
exact. All other raw header fields stay exact except seven sourceHash and
eight validator receipts. Validator hashes were independently reproduced
from package/lock plus recursive format, game/shardfile, engine/boot and
engine/pwa sources; only clientWorldAssembly.ts and earlyPrograms.ts changed
within that defining set. **G872, wildshard-new:** these seven volatile-map
stamps and receipt changes qualify, as for Fossil/Z15; this is not a claim
of literal all-payload parity and the staleness guard stays unchanged.
Raw: `tmp/sp-x2-dc7/{comparison,header-deltas,validator-trace}.json`;
maintained native/index/census checks pass on all eight, independently
cross-checked for sp-x6's four in `tmp/sp-x6-dc7/product-audit.json`.

These are generator-side exports that no build path, test or other generator imports. The list is in the appendix
"DC7". **Risk:** a generator's output could change if a deleted function was reached through a computed name. **Check:**
types, `vitest related`, then rebuild the touched shards' products with `node scripts/build-shardfiles.mjs`. The shard
outputs (`git status` on the shard's output paths) must be byte-identical. If any changes, it was not dead.

### DC8: legacy species catalogue (4 files, 693 lines, plus 2 edits) · Codex · S

**done (2026-11-04, sp-x8): `4b0c5fe400`.** Fresh untruncated whole-tree
module/symbol and bare-stem searches found no live legacy installer caller.
The four retired files (693 lines), dead API, two legacy declaration cases,
manual references and the deleted test's duration/module rows are gone.
Modern shared species and shard-owned deer/elk hulls stay unchanged; no
product/chargeback registry entry named the deleted test or modules.
Root and engine/game types, typed lint and scoped ratchet pass; original
`vitest related` passes 26 suites / 116 cases in 49.14 s. The HEAD patch
preserves peer timing rows; ratchet reductions remain pusher-owned.

- `src/game/systems/species/legacy/{deer,elk,install}.ts`
- `test/legacy-species-install.test.ts`
- Edits: `installLegacyKitSpecies` in `src/game/client/systems/species/install.ts`, and the two `legacy/*` names in
  `src/game/isolated-game-rig-default-declarations.test.ts`
- **Evidence:** "Held for LD: only a frozen legacy boot requests the original procedural catalogue". The LD waves
  deleted legacy boots, and only the test calls `installLegacyKitSpecies`. **Risk:** none at runtime.
  **Check:** types, `vitest related`.

### DC9: shard generator witness files only tests read (17 files, 817 lines) · Codex · S · medium

**done (2026-11-04, sp-x8): `b5923118f3`.** Fresh untruncated
whole-tree importer/symbol/data-ref review deletes 11 unused source
modules (596 lines), their obsolete template comparison and retired
wrapper/equivalence cases. Current Far Reach source-byte inventories,
complete original output comparisons, input refusals and source boundary
checks remain. Nine's current graph compilation/sampler/mip/cap checks and
cumulus geometry/refusals remain. Types/lint/scoped ratchet pass; original
related passes 5 suites / 18 cases in 4.27 s. Deleted-file timing/debt rows
are retired by exact HEAD patch.

Six audit candidates are **kept with live readers**: `coatFlap.ts` is
called by production `coatProducer.readCoatRig`; `entryWalk.ts` feeds the
maintained typed headless/native oracle; `keeperRows.ts` and `nativeFauna.ts`
feed maintained native and mixed-population fixtures; `trailParams.ts`
provides current specimen fixture types; `bake-species.mjs` drives current
source-byte body/look preparation proofs. No actual native constructor,
resource/refusal owner, asset, encoder or runtime path changes.

These are retained native "witness" and equivalence files from the port. No shardfile build path imports them:

- `src/shards/_template/generators/templateScene.ts`
- `src/shards/driftwood-isle/generators/{cumulus,entryWalk,keeperRows,nativeFauna,trailParams}.ts`
- `src/shards/far-reach/generators/{worldPackProgram,worldPlacementProgram}.ts`
- `src/shards/nalati-grasslands/generators/{horizon,nalatiCaptureInventory}.ts`, `.../{bake-species,nalati-world-inventory}.mjs`
- `src/shards/nine-dragon-stack/generators/canopyGraphs.ts`
- `src/shards/pine-hollow/generators/coatFlap.ts`, `.../pine-world-inventory.mjs`

The tests that import them: `test/{template-props-generation,driftwood-cumulus,native-keeper-rows,native-fauna-boot,specimen-catalogue,sky-world-pack-program,sky-world-placement-program,nalati-generation-order,scene-author-ports,light-emitters}.test.ts`
and the fixtures `test/fixtures/{driftwood-headless,mixed-population,driftwood-trail-models,check-nalati-species-source}.ts`.
Delete the cases that pin the witness and keep the ones that pin live outputs. **Risk:** these pins guard port equivalence.
Under G416, a pin of a finished port is a fragile test. **Check:** types, `vitest related`.

### DC10: frozen "before" copies kept for equivalence tests (5 files, 519 lines) · Codex · S · medium

**DC10 source committed (2026-11-04, sp-x2): `4e248bde78`.** Fresh
full-tree importer/data/ref searches found only dedicated equivalence
readers. Delete three frozen modules and two exclusive suites; retire
four timing/module rows. Remove only the uniform suite's two old-copy
comparisons and unused fixture capture/injection plumbing. Its first
four actual-Three test bodies remain byte-identical, all four pass
focused and related. Root/engine/game types, typed lint, scoped scratch
ratchet and exact deletion guard pass. No product/chargeback row names
the cut, and no production rendering or HUD source changes.

- `src/engine/test/{hud-markers-before,uniform-caches-before,weapon-strip-before}.ts`
- `test/hud-marker-values.test.ts`, `test/weapon-strip-values.test.ts`
- The before-vs-after cases in `src/engine/client/render/uniform-vector-buffer.test.ts`
- **Evidence:** each is the pre-refactor copy of a live module, kept only to assert equal output. The refactors
  landed weeks ago. **Check:** types, `vitest related`.

### DC11: dead exports near rendering, and lowpolyKit's legacy plants (~25 symbols, ~370 lines, 17 files) · Opus · S

**done (2026-11-04, sp-o1): `2dad4e2e6c`.** Fresh repo-wide search per symbol (src, test, scripts, lint, tools,
dynamic imports). Deleted, no consumer anywhere: DISPLAY_COLOUR_ALPHA, warmOffscreenPass, retainRendererPrograms,
bakedUndergrowth, sameChecksum, patchBarkArrays, patchCardCrownTop, NpcFace, HEAVY_CHARGE, swellBody, and lowpolyKit's
plant block (hibiscusBush, lilyPad, grassTuft, vineStrand plus leaf, leafAt, broadClump, hibiscus, PLANT, Part):
206 lines, 12 files incl. ENGINE.md and Driftwood's README. Kept by DC6's rule (real readers): compileLight* /
compileScene*, shaderPatch*, loadTreeSetGeometry, bindInteractionTransitions*, keyedSkyDaySpec*, installTrampleTrail*
(tests or fixtures), TRACER_ORDER / TRACER_RED (component registry), withVoxelAOBake (native oracle fixture). No
reachable code changed and no rng-consuming kit call was touched, so no pixel can move; typecheck-root, vitest
related 979 files green (two reds were a stale local Nalati product: green after build-shardfiles, exit 0).

- The appendix "DC11" list (render, world, look and weapon modules).
- `src/engine/client/world/lowpolyKit.ts` lines ~156–262: `hibiscusBush`, `lilyPad`, `grassTuft`, `vineStrand` and their
  private helpers. The file's own comment says only the frozen legacy authoring folder imported them, and Driftwood's
  generators carry their own copy (the name match in `foliageModels.ts` is that copy, not an import).
- **Evidence:** the same export check as DC6. **Risk:** nothing calls these, so pixels cannot change. These are render
  files, so G848 keeps them on Opus. **Check:** types, lint, `vitest related`. Goldens are not needed, since no reachable
  code changes.

### DC12: lint, budget and allow-list entries that name deleted files (~355 entries, 7 files) · Codex · S

**done (2026-11-04, sp-x2): `793c258d2e`, plan `f641d311d5`, both verified on origin/main.** Fresh HEAD
census and policy-reader searches retired **2,413 missing-file entries in
six policies**, after DC7 qualification: 1,488 performance sites, 906
coupling sites, 13 obsolete SDK dist chunks, two private product JSON
allowances and four historical baseline references (three X7, one Nalati).
The path allow-list has zero stale entries and stays untouched. All two
live Sunscar performance sites stay exact. Coupling counts decrease only
by their removed site rows; six unattributed metric headroom values stay
unchanged rather than inventing a deletion proof. Every numeric render,
memory and wire ceiling, source/review field and live baseline reference
stays exact. HEAD-only patches preserve peer debt additions in the tree.
No test, timing, product or chargeback row is deleted by this metadata cut.

Root types, 6 guard suites / 46 cases, direct policy shape/shrink controls
and scoped scratch-baseline ratchet pass; `vitest related` finds no suites.
Required full ratchet was attempted and **refused** a foreign shared-index
entry for missing `src/engine/render/graph/compile.ts` (absent from HEAD).
Required full path check was attempted and reports 708 existing generated,
layout and tooling-path failures, including current ignored SDK outputs,
old empty generator globs and a missing storage pin. Neither failure is
suppressed or represented as passing. Raw untruncated reader/census and
check logs: `tmp/sp-x2-dc12/`. The unchanged guards remain authoritative;
publication is handled by the scheduled committed-source gate.

### DC13: loading-benchmark leftovers (16 files, 918 lines) · Codex · S · medium

**Done with live accuracy dependencies retained (2026-11-04, sp-x9): `3af513134e`.** Delete 11 unread files (ten scripts and one declaration). Keep `arrival.mjs`, `crossing.mjs`, its declaration and its two-case proof: retained `accuracy.mjs` and `accuracy-safari.mjs` import them. Keep every `accuracy*.mjs`, including `accuracy-summary`, and the explicitly listed benchmark/capture/safari-data. Root types, two retained crossing cases and scoped scratch-baseline ratchet pass. No deleted-test timing/product/chargeback rows need pruning.

- `scripts/loading-benchmark/{accuracy-summary,analyze,arrival,crossing,matched,report,worker-bootstrap-safari,worker-core-chromium,worker-revalidation-safari,worker-timing-replay,safari,safari-fixture,safari-matched}.mjs`
- `test/loading-crossing-proof.test.ts`
- **Keep:** `benchmark.mjs` (the admin page reads it), `accuracy*.mjs`, `capture.mjs` and `safari-data.mjs` (touched
  today).
- **Check:** the re-grep, types, `vitest related`.

### DC14: the soak harness (12 files, 1,713 lines) · Codex · S · **approved (G1014): delete, and drop "the soak" from AGENTS.md in the same commit**

**Done (2026-11-04, sp-x9): `b45e7f1130`.** After DC3 `c12abf0740` retired the last external owned-plan readers, delete nine soak script/route modules and six exclusive suites. The same commit removes "the soak" from AGENTS.md's milestone proof rule and the stale MACHINE.md proof-run example; six CI timing rows retire and the generic related-selector MJS fixture uses a neutral name. Keep Inspector, memory categories and boundary attribution because current Simulator/loading/core-heap readers still import them. Root types, 16 retained boundary/selector cases and scoped scratch-baseline ratchet pass. No product or chargeback rows name deleted paths.

- `scripts/soak/{bisect,drive,gl,owned,pine-events,pine-rate,report,soak}.mjs`, `scripts/soak/route.ts`
- `test/tooling/soak/{drive,gl,pine-events}.test.mjs`
- `scripts/soak/boundary.mjs` and `test/tooling/soak/owned.test.mjs` stay if the boundary is still read.
- Jake, 2026-10-03 (E388): *"Don't soak at all"*. The soak verdicts were deleted then, but the harness stayed.
  AGENTS.md still lists "the soak" among the per-milestone heavy proofs. **Recommended:** delete the harness and drop
  "the soak" from that AGENTS.md line in the same commit.

### DC15: trailer tooling (127 files, ~6,145 lines + ~18 MB) · Codex · M · **approved (G1014)**

**DC15 source:** committed (2026-11-04, `cf104912d315992fbdc2b812e4e3df7b1fe5c4fc`; types, related, deletion guard and scoped ratchet pass): remove the 126 retired trailer files, including three WAVs; TRAILERS stays parked under G1014. Current gameplay music and the independent progress-recording helper/tests remain.

- `scripts/progress-trailer/`, `scripts/steam-trailer/`, `scripts/trailer/`, their tests, and the three `.wav` files outside `public/`.
- Jake: "Nuke the soak, nuke the trailer, we can bring him back from Git history." Future trailers start from a generic tool, built fresh or restored from git (`git log --all -- scripts/trailer/` names the last commit). TRAILERS is parked in the same commit.
- Check: nothing outside the three folders imports them (`git grep` bare basenames, package.json scripts, CI workflows); root types; ratchet.

## Needs a closer look (not rows)

Each item needs its owner, or a reading, to say it is dead. Most of these look dead to the graph but have one live
signal: a live plan, a process doc, a commit this week, or a runtime name.

1. **Trailer tooling**: `scripts/progress-trailer/`, `scripts/steam-trailer/`, `scripts/trailer/`. That is 127 files:
   6,145 code lines plus ~18 MB that includes three `.wav` files. Storage policy keeps audio inside `public/`. TRAILERS is
   still `in progress`. Recommend deleting it when TRAILERS archives, and moving the WAVs out now.
2. **Probably-dead exports** (~98 symbols, ~1,250 lines, 75 files). These are dead by import but their bare name appears
   elsewhere (a same-named local, a comment, an inventory string). Listed in the appendix "Closer look"; each needs a
   look by eye. Example: `placeUndergrowth` is live through a namespace in `scripts/bake-chunk.mjs`.
3. **Manual bakers whose output still ships** (543 lines). Keep them while the output they rebuild is committed:
   `scripts/bake-{pickups,nine-decal-atlas,nalati-poi-contacts,nalati-sign-atlases,query-terrain,map-rest,sky-maps,template-shardfile}.mjs`,
   `src/shards/nine-dragon-stack/generators/decalAtlasPage.ts`, `src/shards/pine-hollow/generators/bake-hdri-keys.mjs`.
4. **Tools a live plan names** (~4,100 lines). That plan's owner decides:
   - E525 spikes: `scripts/bulk-pack*.mjs`, `scripts/download-bench/*` (751)
   - OPEN-PLOTS: `scripts/open-plots/{audio-check,audio-observer,card-capture,clay-review,life-capture,make-poster,template,tiling,walk}.mjs` (512)
   - NINE-DRAGON-STACK: `scripts/nine-dragon-{budget,domes,grapple-touch}.mjs` (659)
   - FINISH-LINE, NATIVE-APPS, DOWNLOAD and WORLDCLAW: `scripts/king-rig-gate.mjs`, `scripts/practice/verify_unimate_skin.mjs`,
     `scripts/roc-fight/*`, `scripts/native-android-e2e.mjs`, `scripts/gpu-gate/{matrix,probe,status}.mjs` (1,444)
   - Title hero: `scripts/capture-main-menu-hero.mjs`, `scripts/main-menu-aerial-{plan.mjs,poses.ts}` (754, re-shot 11-03)
5. **Scripts a process or reference doc still names as current** (1,407 lines). Either the doc is stale or something runs
   them that the graph cannot see:
   - `scripts/authoring-inputs.mjs` (AUTHORING-CLEAN-ROOM.md)
   - `scripts/native-recorder-cache.mjs` (GENERATION.md)
   - `scripts/witness-{manifests,generation,checkpoints}.mjs` (GIT.md: "the pusher's"; `test/proof/*` reads them)
   - `scripts/shards.mjs`, `scripts/gen-shard-layout-doc.mjs` (SHARDS.md)
   - `scripts/section-inventory.ts` (PLATFORM-FILE-FAMILIES.md)
   - `scripts/proof-rig-normalization.mjs` with `src/sharddev/bake/normalizeRig.ts` (ENGINE.md)
   - `scripts/pine-hollow-{views,nan-scan}.mjs`, `scripts/docs/proof-standalone.mjs`
6. **Touched this week** (364 lines): `scripts/generated-files.mjs` and `scripts/legacy-explorer-lists.ts` (both
   11-04), `scripts/push-tables.mjs` (11-03, only `test/discovery-output-placement.test.mjs` reads it),
   `src/shards/nalati-grasslands/generators/nativeGroupWire.ts` (11-03). `legacy-explorer-lists.ts` is an "LD4 legacy
   Explorer comparison" and is likely dead with the legacy boots.
7. **Headless proof hosts**: `bindHeadlessCommands`, `headlessSpecCatalogue` and `PrepareHeadlessRuntime` in
   `src/sdk/headlessRuntime.ts`, and `productHeadlessSections` in `src/sdk/headlessSections.ts` (~80 of 274 lines). Only the
   `test/proof/*` headless witnesses and fixtures use them. Delete them only if those proofs are retired too.
8. **AssemblyScript ABI export**: `queryPoints` in `src/sharddev/as/wsV2.ts`. Hosts and scripts call it by name, so no
   import is expected. Check the host binding table before deleting.
9. **Oracle and provenance test fixtures from the custom-TS port**: 256 files and ~11 MB in `test/fixtures/` whose names
   contain oracle, original, legacy, provenance or before. Many name the deleted `src/shards/*/runtime|species|combat`
   files as their source. They pin port equivalence. Under G416 this is a test-pruning pass of its own, not something
   for this plan.
10. **Small loose ends:**
    - `'item.reaction'` is asked by `src/game/server/plugin/nativeItems.ts`, but only a test answers it.
    - The empty untracked folder `src/shards/far-reach-legacy/` sits on disk, not in git: `rmdir` it locally.
    - The `src/engine/test/`, `src/sharddev/test/` and `src/game/test/` helpers stay with their live tests.
11. **Docs about deleted systems** (low priority, list only): the AGENTS.md soak mention (DC14),
    `docs/tasks/asks/E388.md`'s soak table, `docs/MOVED.md` entries for files deleted since.

## Appendix: export lists

`*` means a test imports the symbol; the number is the approximate line span of the declarations. Re-grep each before
deleting it.

### DC6 (non-visual layers)

- `src/commons/practiceCourse.ts`: buildCourseProgram* (9)
- `src/engine/server/ai/eliteRoster.ts`: nativeEliteBindings* (2)
- `src/engine/server/ai/herd.ts`: HerdMode, StallionState* (6)
- `src/engine/client/boot/download.ts`: readDownloadFiles* (14)
- `src/engine/client/boot/idle.ts`: controlIdle* (17)
- `src/engine/client/boot/shardPrefetch.ts`: ktx2Ready (6)
- `src/engine/client/core/assets.ts`: decodedImageCount* (5)
- `src/engine/client/core/deflate.ts`: base64Bytes* (8)
- `src/engine/shared/physics/navmesh.ts`: readNavmesh* (8)
- `src/engine/shared/physics/query.ts`: hasStaticGround* (12)
- `src/engine/shared/script/moduleV2.ts`: scriptMemoryCensus*, consumeScriptMemory (9)
- `src/engine/shared/sim/edgeProfiles.ts`: nativeEdgeProfiles (7)
- `src/engine/shared/sim/snapshot.ts`: onSimHostRestored* (9)
- `src/format/arenaScriptRows.ts`: parseArenaScriptData* (7)
- `src/format/audioRouting.ts`: parseAudioRouting (3)
- `src/format/bowVariantRows.ts`: BowSourceMultipliersSchema* (2)
- `src/format/brains.ts`: ShardGuardianPatternInput (11)
- `src/format/chapterDirector.ts`: chapterObservations* (9)
- `src/format/commonsCosts.ts`: CommonsCostsInput (1)
- `src/format/decisionScripts.ts`: decisionScriptRules*, DecisionScriptsInput (26)
- `src/format/eliteContinuation.ts`: EliteContinuationRows* (4)
- `src/format/fenceReads.ts`: fenceReadIdentity* (4)
- `src/format/flyers.ts`: DiverRowsInput, DiverRows (39)
- `src/format/grapple.ts`: parseGrappleFilament* (3)
- `src/format/grazers.ts`: ShardGrazerInput (13)
- `src/format/heldArms.ts`: parseToonArmsLook*, HeldArmsRowsInput (5)
- `src/format/inputDeclarations.ts`: InputActionRowsInput, InputKeyRowsInput (3)
- `src/format/outputIndex.ts`: OutputPlatformSectionName* (3)
- `src/format/plumbing.ts`: PlumbingRowsInput, PlumbingRows (3)
- `src/format/questPageComposition.ts`: QuestPageCompositionRows (5)
- `src/format/questSteps.ts`: parseQuestKillRows* (8)
- `src/format/questStory.ts`: parseAdventureContent* (3)
- `src/format/sceneRefs.ts`: admitSceneRefs* (10)
- `src/format/scriptGroupStepV2.ts`: groupStepColumnV2* (6)
- `src/format/scriptWireV2.ts`: V2_HEADER_BYTES (1)
- `src/format/speciesBookRows.ts`: NativeSpeciesLookBookSchema* (3)
- `src/format/speciesPrograms.ts`: readSpeciesPrograms* (3)
- `src/format/state.ts`: StateRowsInput, StateRows (3)
- `src/format/terrain.ts`: ShardTerrainInput (1)
- `src/format/toonLook.ts`: ToonDayRow* (4)
- `src/format/uiStrings.ts`: parseUiStrings* (3)
- `src/format/weaponProfiles.ts`: parseHeldModelRows*, parseHeldPresentation* (7)
- `src/game/shared/achievements.ts`: AchievementCounterBook* (23)
- `src/game/client/cosmetics/locker.ts`: CosmeticDef (1)
- `src/game/shared/grid/compiledStrips.ts`: decodeCompiledGridStrips* (7)
- `src/game/client/grid/refusal.ts`: FarViewStatus (3)
- `src/game/shared/inventoryLaw.ts`: grantNativeInventory* (6)
- `src/game/shared/plugin/director.ts`: nativeStageLane* (3)
- `src/game/server/plugin/headless.ts`: bindRuntimeItemContexts, spawnRuntimeHome*, bindRuntimeActor (24)
- `src/game/server/plugin/nativeItems.ts`: nativeMeleeItem* (3)
- `src/game/shared/plugin/quests.ts`: installNativeQuestProps*, bindQuestTableSpots* (33)
- `src/game/server/population/perchBody.ts`: nativePerchProgram* (5)
- `src/game/shared/population/respawn.ts`: ReturnGate* (16)
- `src/game/server/population/shelter.ts`: installNativeHerdShelter* (29)
- `src/game/server/population/spawnScript.ts`: installNativeSpawnScript* (15)
- `src/game/shared/quest/contractBoard.ts`: CONTRACT_ACTION* (4)
- `src/game/server/quest/eliteFeature.ts`: installNativeEliteFeature* (68)
- `src/game/server/quest/nativeInputs.ts`: nativeQuestInputs*, installNativeQuestChannels*, nativeQuestChannels* (14)
- `src/game/shared/quest/nativeProps.ts`: lendQuestBodyScripts* (6)
- `src/game/server/riding/nativePopulation.ts`: installNativeBootRoster*, installNativePopulationHunt* (30)
- `src/game/server/riding/nativeTaming.ts`: installNativeTaming*, respawnNativeMounted* (145)
- `src/game/client/shard/registry.ts`: chunkUrl (7)
- `src/game/client/shard/retainedHooks.ts`: installEnteredRuntimeUpdate (8)
- `src/game/client/shardfile/bakedKinds.ts`: loadBakedKinds (16)
- `src/game/server/shardfile/borrowedDecisions.ts`: nativeDecisions*, nativeDecisionAuthority* (17)
- `src/game/client/shardfile/clientViewProgram.ts`: lendViewSlots (3)
- `src/game/client/shardfile/controlRefinement.ts`: spawnViewBusy (3)
- `src/game/client/shardfile/enteredTileReadout.ts`: enteredTiles* (5)
- `src/game/client/shardfile/portalRideBinding.ts`: installPortalRide*, installHostPortalRide* (37)
- `src/game/client/shardfile/sceneDressing.ts`: readSceneNumericTable* (4)
- `src/game/shared/shardfile/shardProduct.ts`: CustomSectionSchemas (3)
- `src/sharddev/bake/contactRows.ts`: admitContactRows* (6)
- `src/sharddev/bake/export.ts`: sampleSkinClip* (19)
- `src/sharddev/bake/mapRaster.ts`: mapPixel* (3)
- `src/sharddev/bake/wholePieceJoin.ts`: joinWholePieces* (13)
- `src/sharddev/formatJsonSchema.ts`: composeNamedJsonSchema* (7)
- `src/sharddev/outputRuntime.ts`: runtimeCodeLines* (16)
- `src/sharddev/productOutput.ts`: writeAuthoredProduct (14)
- `src/sharddev/rows.ts`: questStepRows* (3)
- `src/sharddev/sections.ts`: defineSection* (13)


### DC11 (render, world, looks, weapons; Opus)

- `src/engine/client/combat/view/ranged.ts`: TRACER_ORDER, TRACER_RED (3)
- `src/engine/client/render/compileLights.ts`: compileLightSource*, compileSceneSource* (11)
- `src/engine/client/render/displayColour.ts`: DISPLAY_COLOUR_ALPHA (6)
- `src/engine/client/render/parkedDraws.ts`: warmOffscreenPass (14)
- `src/engine/client/render/programRetention.ts`: retainRendererPrograms (13)
- `src/engine/client/render/shaderPatches.ts`: shaderPatchSet*, shaderPatchSceneShape* (32)
- `src/engine/shared/world/BakedTerrain.ts`: bakedUndergrowth (6)
- `src/engine/shared/world/forest/placement.ts`: sameChecksum (5)
- `src/engine/client/world/forest/treeSet.ts`: loadTreeSetGeometry*, patchBarkArrays, patchCardCrownTop (66)
- `src/engine/shared/world/interact/flags.ts`: bindInteractionTransitions* (54)
- `src/engine/client/world/voxelAO.ts`: withVoxelAOBake (9)
- `src/engine/shared/world/water/body.ts`: swellBody (14)
- `src/game/shared/looks/keyedSkyClock.ts`: keyedSkyDaySpec* (6)
- `src/game/client/systems/looks/trample.ts`: installTrampleTrail* (15)
- `src/game/client/systems/npc/npcRig.ts`: NpcFace (5)
- `src/game/server/weapons/Sword.ts`: HEAVY_CHARGE (4)

### DC7 (shard generators)

- `src/shards/_template/generators/mapInputs.ts`: templateMapInputs* (8)
- `src/shards/_template/generators/templateScene.ts`: templateScene* (9)
- `src/shards/driftwood-isle/generators/coarseTiles.ts`: driftwoodCoarseOutput (9)
- `src/shards/driftwood-isle/generators/economy.ts`: FULL_CLEAR (4)
- `src/shards/driftwood-isle/generators/entryWalk.ts`: ENTRY_WALK* (4)
- `src/shards/driftwood-isle/generators/islandCover.ts`: islandCoverUrl (4)
- `src/shards/driftwood-isle/generators/keeperRows.ts`: keeperRows* (36)
- `src/shards/driftwood-isle/generators/mapProgram.ts`: driftwoodMapPixels (6)
- `src/shards/driftwood-isle/generators/nativeBake.ts`: driftwoodNativeRows* (33)
- `src/shards/driftwood-isle/generators/nativeQuest.ts`: DRIFTWOOD_NATIVE_QUEST* (18)
- `src/shards/driftwood-isle/generators/nativeQuestProps.ts`: NATIVE_QUEST_PROPS* (14)
- `src/shards/driftwood-isle/generators/reefScatter.ts`: reefLayoutJson (5)
- `src/shards/driftwood-isle/generators/scene.ts`: exactShape*, driftwoodScene* (13)
- `src/shards/driftwood-isle/generators/seaGlassChime.ts`: CHIME_PIECES (2)
- `src/shards/far-reach/generators/bookStand.ts`: bakeSkyBookStand (2)
- `src/shards/far-reach/generators/crown.ts`: bakeSkyCrown (2)
- `src/shards/far-reach/generators/dressing.ts`: bakeSkyDressing (3)
- `src/shards/far-reach/generators/fileInventory.ts`: BRIDGES_URL, MILL_MODEL_URL (8)
- `src/shards/far-reach/generators/geometries.ts`: bakeSkyGeometries (2)
- `src/shards/far-reach/generators/isletRig.ts`: bakeSkyIsletRig (2)
- `src/shards/far-reach/generators/knoll.ts`: bakeSkyKnolls (2)
- `src/shards/far-reach/generators/mill.ts`: bakeSkyMill (2)
- `src/shards/far-reach/generators/questRows.ts`: questPageFiles (9)
- `src/shards/far-reach/generators/restScene.ts`: winchGlb, hover0Glb, hover1Glb, hover2Glb, stormGlb, bookStandGlb (11)
- `src/shards/far-reach/generators/risingIslets.ts`: risingIsletSource* (7)
- `src/shards/far-reach/generators/roost.ts`: bakeSkyRoost (2)
- `src/shards/far-reach/generators/routeScene.ts`: skyRouteSource* (5)
- `src/shards/far-reach/generators/rows/equipment.ts`: FAN_PRESENTATION (2)
- `src/shards/far-reach/generators/rows/rocFight.ts`: ROC_FIGHT (4)
- `src/shards/far-reach/generators/rows/stormNoise.ts`: STORM_NOISE_SAMPLER* (3)
- `src/shards/far-reach/generators/scene.ts`: skyReachBake (9)
- `src/shards/far-reach/generators/skyDock.ts`: bakeSkyDocks (2)
- `src/shards/far-reach/generators/stormNoise.ts`: bakeStormNoise* (8)
- `src/shards/far-reach/generators/viewData.ts`: skyViewData* (5)
- `src/shards/far-reach/generators/winchHouse.ts`: bakeSkyWinchHouse (2)
- `src/shards/far-reach/generators/worldPackProgram.ts`: skyWorldPackProgram* (10)
- `src/shards/far-reach/generators/worldPlacementProgram.ts`: skyWorldPlacementProgram* (9)
- `src/shards/ink-cel-valley/generators/materials.ts`: inkMaterials (5)
- `src/shards/nalati-grasslands/generators/bodies.ts`: tamingPoses* (21)
- `src/shards/nalati-grasslands/generators/campProps.ts`: CLUTTER_KINDS (3)
- `src/shards/nalati-grasslands/generators/heldSlots.ts`: heldSlotRows* (16)
- `src/shards/nalati-grasslands/generators/horizon.ts`: NALATI_HORIZON_V2* (29)
- `src/shards/nalati-grasslands/generators/horseCourse.ts`: LAP_M (3)
- `src/shards/nalati-grasslands/generators/kurganLayout.ts`: COLLISION (3)
- `src/shards/nalati-grasslands/generators/modelParts.ts`: nalatiModelParts* (7)
- `src/shards/nalati-grasslands/generators/nalatiWorldRows.ts`: bakeNalatiWorldRows* (15)
- `src/shards/nalati-grasslands/generators/nativeGroupWire.ts`: nalatiNativeGroupWire* (12)
- `src/shards/nalati-grasslands/generators/output.ts`: nalatiOutputRows* (5)
- `src/shards/nalati-grasslands/generators/packGroup.ts`: PACK_RESULT_CHANNELS (1)
- `src/shards/nalati-grasslands/generators/paint.ts`: bakeSmoothAO (10)
- `src/shards/nalati-grasslands/generators/places.ts`: buildPeopleFallback (5)
- `src/shards/nalati-grasslands/generators/sabre.ts`: SABRE_PROFILE* (12)
- `src/shards/nalati-grasslands/generators/sheep.ts`: SHEEP_BONES, sheepSkinnedGeometry (12)
- `src/shards/nalati-grasslands/generators/spear.ts`: JAVELIN (7)
- `src/shards/nine-dragon-stack/generators/canopyGraphs.ts`: canopyGraphs* (152)
- `src/shards/nine-dragon-stack/generators/castSources.ts`: CAST_BLOBS* (2)
- `src/shards/nine-dragon-stack/generators/composite.ts`: compositeRows (9)
- `src/shards/nine-dragon-stack/generators/layoutProjection.ts`: restoreLayoutZeros* (16)
- `src/shards/nine-dragon-stack/generators/lightVolumes.ts`: LightPoolProfilesSchema*, LIGHT_POOL_INPUTS (2)
- `src/shards/nine-dragon-stack/generators/mapProgram.ts`: nineMapPixels* (5)
- `src/shards/nine-dragon-stack/generators/product.ts`: nineProduct (5)
- `src/shards/nine-dragon-stack/generators/sections.ts`: GeometryLibrarySchema*, FixedRowsSchema*, parseFixedRows*, NINE_SECTION_INPUTS (13)
- `src/shards/nine-dragon-stack/generators/spillBake.ts`: bakedSpill (9)
- `src/shards/pastel-plain/generators/materials.ts`: pastelMaterials (5)
- `src/shards/pine-hollow/generators/cabinLivingContribution.ts`: CabinLivingProfile* (3)
- `src/shards/pine-hollow/generators/contractRows.ts`: CONTRACT_ROWS* (4)
- `src/shards/pine-hollow/generators/cragScene.ts`: pineCragWorldScene (14)
- `src/shards/pine-hollow/generators/nativeQuest.ts`: PINE_NATIVE_QUEST* (17)
- `src/shards/pine-hollow/generators/populationEnvironment.ts`: POPULATION_ENVIRONMENT* (9)
- `src/shards/pine-hollow/generators/questBeats.ts`: isBeat (3)
- `src/shards/pine-hollow/generators/questPrompts.ts`: PINE_INTERACT*, PINE_ACT*, PINE_AMMO (6)
- `src/shards/pine-hollow/generators/sections.ts`: CabinAmbienceSchema*, PropKindSchema, NativeViewSchema*, parsePineQuestRows*, parseTradeCatalogue*, ThrallLookSchema, CabinRowsSchema, CabinAppearanceSchema*, TradeGoodSchema, PineTradeSkinSchema, parseQuestLeadRows* (53)
- `src/shards/pine-hollow/generators/sourceOutput.ts`: staticOutput* (9)
- `src/shards/pine-hollow/generators/treeSet.ts`: PINE_TREE_IDS* (2)
- `src/shards/pine-hollow/generators/undergrowth.ts`: pineUndergrowthBake (15)
- `src/shards/pine-hollow/generators/wildlifeKinds.ts`: WILD_BAKE_KINDS, WildRows (10)
- `src/shards/pine-hollow/generators/wildlifeLook.ts`: WILDLIFE_LOOK* (3)
- `src/shards/sunscar-dunes/generators/dressing.ts`: bakeSignalDressing (2)
- `src/shards/sunscar-dunes/generators/landscape.ts`: signalAuthorGround (12)
- `src/shards/sunscar-dunes/generators/places.ts`: bakeSignalCaravan, bakeSignalWell, bakeSignalBraziers (11)
- `src/shards/sunscar-dunes/generators/rocks.ts`: bakeSignalRocks (2)
- `src/shards/sunscar-dunes/generators/rows/items.ts`: WHIP_MOVES (3)
- `src/shards/sunscar-dunes/generators/rows/whip.ts`: STRAND_A (3)
- `src/shards/sunscar-dunes/generators/scene.ts`: signalDunesBake (9)

### Closer look (probably dead; check each)

- `src/commons/bake/portableMath.ts`: portableMath* (3)
- `src/engine/server/ai/pack.ts`: PackPhase (3)
- `src/engine/client/audio/AmbienceBeds.ts`: AmbienceBeds (24)
- `src/engine/client/audio/score/score.ts`: Mode (2)
- `src/engine/client/boot/filePolicy.ts`: resolveBootSources* (8)
- `src/engine/client/combat/view/ranged.ts`: edgeWear (14)
- `src/engine/client/core/assets.ts`: pbrUrls (4)
- `src/engine/client/debug/probe.ts`: programHash* (3)
- `src/engine/client/entities/species/loft.ts`: setShapeFn (8)
- `src/engine/shared/entities/species/registry.ts`: speciesKinds (3)
- `src/engine/client/events/maps.ts`: Tag (2)
- `src/engine/client/models/model.ts`: withModelPlacementVisitor (12)
- `src/engine/shared/physics/box.ts`: siteFloor* (6)
- `src/engine/client/ui/offlineDownload.ts`: offlineDownload (3)
- `src/engine/client/world/blenderArea.ts`: blenderAreaFor (5)
- `src/engine/shared/world/forest/placement.ts`: plantSpecs, placementChecksum, placeUndergrowth (131)
- `src/engine/client/world/forest/treeSet.ts`: standIn, patchImpostorCrownTop (38)
- `src/engine/client/world/geometryBake.ts`: decodeGeometryBake, encodeGeometryBake*, geometryBakeStats* (64)
- `src/engine/client/world/geometryKit.ts`: sagLine*, withoutHidden* (18)
- `src/engine/client/world/interact/Interactables.ts`: canSee (6)
- `src/engine/shared/world/terrainField.ts`: landscapeHash (18)
- `src/engine/client/world/voxelAO.ts`: recordVoxelAO*, encodeVoxelAOBake*, voxelAOBakeStats* (45)
- `src/format/contentCost.ts`: contentEstimate (16)
- `src/format/gridReadiness.ts`: parseGridStructuralEvidence (5)
- `src/format/materialFamilies.ts`: Rgb (7)
- `src/format/scriptAdmissionV2.ts`: parseScriptArtifactV2* (8)
- `src/game/client/audio/theme.ts`: ArrangementName (4)
- `src/game/shared/inventoryLaw.ts`: NativeInventory* (42)
- `src/game/client/models/specimenCatalogue.ts`: PackedSpecimenBake, SpecimenModelRow (7)
- `src/game/server/plugin/brain.ts`: sampleCreatureGroup*, selectCreatureSites* (98)
- `src/game/shared/plugin/quests.ts`: createReadingRoster* (63)
- `src/game/client/shard/registry.ts`: setActiveChunk* (16)
- `src/game/client/shardfile/worldSceneWeld.ts`: worldSceneWeldFile* (4)
- `src/game/client/systems/looks/rainCurtain.ts`: rainCurtain (13)
- `src/game/client/systems/props/interact.ts`: chestGlint, altarSocket (18)
- `src/game/client/systems/viewmodel/armRig.ts`: GRIP, solveArm (43)
- `src/game/server/weapons/Sword.ts`: REACH (4)
- `src/game/server/weapons/starterBowProfile.ts`: BOW* (6)
- `src/sharddev/bake/placeholders.ts`: placeholderJson, bakedTerrainGrid (11)
- `src/sharddev/buildDecisionScripts.ts`: buildDecisionScripts* (7)
- `src/sharddev/director.ts`: DirectorData (4)
- `src/sharddev/interactions.ts`: InteractionRows (3)
- `src/sharddev/kit/geometryPack.ts`: fetchDeflated (9)
- `src/sharddev/speciesBrains.ts`: speciesBrains* (10)
- `src/sharddev/weapons/thrownProfile.ts`: ThrownProfile* (4)
- `src/shards/_template/generators/farLook.ts`: farLook (16)
- `src/shards/driftwood-isle/generators/far.ts`: farLook (9)
- `src/shards/driftwood-isle/generators/questStory.ts`: QUEST_EXTERNAL* (4)
- `src/shards/driftwood-isle/generators/reefSpecimenRows.ts`: ReefKind (2)
- `src/shards/driftwood-isle/generators/sections.ts`: EnemyPlacements (2)
- `src/shards/driftwood-isle/generators/trailParams.ts`: CatalogueParams* (8)
- `src/shards/far-reach/generators/bootInventory.ts`: BOOT_FILES* (3)
- `src/shards/far-reach/generators/layoutMath.ts`: spanYaw, spanPitch (3)
- `src/shards/far-reach/generators/preparedModels.ts`: bakePreparedModels* (6)
- `src/shards/ink-cel-valley/generators/farLook.ts`: farLook (17)
- `src/shards/nalati-grasslands/generators/coats.ts`: produceNalatiCoats* (22)
- `src/shards/nalati-grasslands/generators/farLook.ts`: farLook (16)
- `src/shards/nalati-grasslands/generators/layout.ts`: KOKBORI_DEN, QARA_CAIRN (6)
- `src/shards/nalati-grasslands/generators/panoramaData.ts`: PANO_HORIZON_V, PANO_DEG_PER_V (7)
- `src/shards/nine-dragon-stack/generators/canopyGeometry.ts`: LEAVES (2)
- `src/shards/nine-dragon-stack/generators/facades.ts`: buildWall (113)
- `src/shards/nine-dragon-stack/generators/farLook.ts`: farLook (24)
- `src/shards/nine-dragon-stack/generators/floorRows.ts`: SLAB (3)
- `src/shards/nine-dragon-stack/generators/fragmentFloor.ts`: fragmentFloor* (14)
- `src/shards/nine-dragon-stack/generators/layoutBlobs.ts`: layoutBlobs* (17)
- `src/shards/nine-dragon-stack/generators/meshLod.ts`: triCount (11)
- `src/shards/nine-dragon-stack/generators/util.ts`: INK, SILK (5)
- `src/shards/nine-dragon-stack/generators/well-plan.ts`: DEEP (3)
- `src/shards/pastel-plain/generators/farLook.ts`: farLook (17)
- `src/shards/pastel-plain/generators/world.ts`: poolMask (15)
- `src/shards/pine-hollow/generators/crags.ts`: shuffleLanes (12)
- `src/shards/pine-hollow/generators/farLook.ts`: farLook (15)
- `src/shards/pine-hollow/generators/questPrompts.ts`: QUEST_STEP*, PineSpots* (3)
- `src/shards/pine-hollow/generators/sections.ts`: PineQuestRows, TradeGood, TradeItem, PineTradeSkin, FILE_SCHEMAS (10)
- `src/shards/sunscar-dunes/generators/farLook.ts`: farLook (15)
- `src/shards/sunscar-dunes/generators/lash.ts`: lashTip (25)

