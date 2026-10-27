# Plan: BURN-DAMAGE-LIST — burn the damage list to zero

**State:** `parked` (draft, 2026-10-27): starts when SHARD-PLATFORM completes, on Jake's word. Nothing here is built
during the mega build; lanes only add items to the list. Decisions stay in
[shard-platform/decisions.md](shard-platform/decisions.md) (G768, G769, G771, G780, G788, G798, G799).

**This file is the damage list's only home, never STATE.md (Jake). This file is never compacted; every break stays
until it's fixed and marked.**

Jake, 2026-10-27 ~01:00 Cancun (G769): *"Finish all the mini plans by tomorrow, whatever the fuck it takes. Mega
build. Go fast as fuck. And then deal with the damage later."*

## Why it exists

- The mega build (G768, G769) lands on types + lint only. Main may be red; CI and the night after catch the rest.
- Checks that made lanes wait were switched off, not fixed ([mega-build](shard-platform/mega-build-mini-plan.md) MB1–MB7).
- Every break that lands needs one place to be written down, or it is forgotten by the time the plan ends.
- This file is that place: the one real damage list. STATE.md only points here.
- When SHARD-PLATFORM is done, this plan turns main green, gets the deploy moving and puts back what Jake wants back.

## How to add to it (lanes, during the mega build)

- One item per break: **what broke · first bad SHA · owner after the plan**. Add it to the table below, next
  number, Status `open`. Batch it into your next commit; no commit of its own.
- First bad SHA = the first CI run's head where it shows red (the culprit may be earlier in that push batch).
- Owner = the lane that broke it (G754). If nobody knows, write "breaker (sp-x7 finds)".
- **Not listed:** a break that stops lanes building (types fail on main, the app won't build or won't boot). That
  is fixed at once by whoever broke it (G674, G769 (4)).
- sp-x7 adds what it sees in CI (G771). A fixed item is marked `fixed <SHA>`, never deleted; nothing leaves the
  table until the plan archives.
- Never put damage items in STATE.md: it is compacted to 3 KB and items get lost.

## The damage list

Seeded 2026-10-27 ~01:35 Cancun at HEAD `0a7d63da0d`. CI: last green push run `59a595ab10` (live). Every push run
since is red; the latest (`60e9b7bfe6`) fails `generated-inputs`, which fails fast and hides the test shards.

| Item | What broke | First bad SHA | Owner after the plan | Status |
|---|---|---|---|---|
| D1 | `src/engine/core/entered-shader-pause.test.ts`: "Entered shader pause wiring missing" | `ac3e62895d` | sp-ci-deploy | fix landed 23dc524329; focused verification awaits generation |
| D2 | `test/boot-dist-transfer.test.ts`: smoke legs download without a relay | `0acf223e06` | sp-ci-deploy | fix landed 508d4143fe; focused verification awaits generation |
| D3 | `test/title-shell-graph.test.ts`: cold title stays off the world graph | `a49bb564ce` | sp-ci-deploy | fix landed e43824c7ae; focused verification awaits generation |
| D4 | `test/nalati-render-source.test.ts`: 30 s timeout | `0acf223e06` | sp-ci-deploy | fix landed 9c30863d2d; focused verification awaits generation |
| D5 | `test/world-targets.test.ts`: move/contain error not thrown | `06d14d8288` | sp-ci-deploy | fix landed cbe29231a5; focused verification awaits generation |
| D6 | `test/tile-bakes.test.ts`: exact coordinate debt | `06d14d8288` | tiles lane (sp-x8) | open |
| D7 | `test/night-market-kit-budget.test.ts`: RM8 target over | `06d14d8288` | sp-o2 | open |
| D8 | `test/open-plot-collision.test.ts`: quarter-turns | `06d14d8288` | breaker (sp-x7 finds) | fixed (sp-o1, `8907eeef3e`: per-part evidence, intended RM10/RM11 art) |
| D9 | CI `gate-deferred` job red | `06d14d8288` | sp-ci-deploy | obsolete handoff job removed defb0f9fd2; full ordinary CI remains |
| D10 | CI `generated-inputs`: the generation stage misses generator modules (`far-reach/generators/knoll`, `nalati-grasslands/generators/geographySource.ts`) | `998fcef0ba` | generator lanes (sp-x1, sp-x6) | open; hides every later test |
| D11 | Deploy stuck: live stays `59a595ab10` (newest-ci-green pin, no green push since) | `ac3e62895d` | sp-x7 (G771) | open |
| D12 | Official quiet Simulator frame floor 11/15 | `3694a487bc` | sp-x8, sp-o4 | open |
| D13 | Flaky (CF2 title PNG): Nine public/Developer title PNGs quarantined until 2026-10-28 03:30 UTC | `531c009fdd` | sp-x1 | quarantined |
| D14 | Flaky (SW13, GM4): `nalati-place-blob-program`, `nalati-map-program`, `nalati-state-intake`, `population-raster`, `map-generation-inputs` | — (G788) | sp-x6 (Nalati / GM4) | quarantined `9872fc12a0`, fix deadline 2026-10-28 07:12 UTC |
| D15 | Flaky (CF2 audit): `heavy-lane.test` timing, `nalati-creature-views` 5e-10 tolerance, V8 `SIGILL` in `shard-headless` | — (G788) | sp-x6 (creature views), sp-x9 (heavy-lane/headless) | quarantined `9872fc12a0`, fix deadline 2026-10-28 07:12 UTC |
| D16 | Off (MB1): push gate is a 45 s fail-open wall; batch split path gone, `push_batch.py` dormant | `7d70d351bb` | Jake's call (BD4) | kept off; 45-second fail-open policy verified feb2658690 |
| D17 | Off (MB2): fail-closed `unverified-inputs` refusal (G752); deferred-blob ledgers unread | `7d70d351bb` | Jake's call | kept off; unused deferred ledger readers removed defb0f9fd2 |
| D18 | Off (MB3): `ci-subset` push step; `push-ci-subset.mjs`, `push-subset-jobs.mjs`, `push-subset-mirror.mjs`, `push-deferred-ci.mjs`, `push_handoff.py` dormant | `7d70d351bb` | Jake's call | kept off; subset/handoff files and policy tests removed defb0f9fd2 |
| D19 | Off (MB4): red hold (G759); `push_red_hold.py` still loaded by `push-loop.py` | `7d70d351bb` | Jake's call | kept off; red hold and its tests deleted daf42ed943 |
| D20 | Off (MB5): the quiet lock no longer pauses pushes or lanes | `7d70d351bb` | Jake's call | kept off; dormant push marker reader deleted feb2658690 |
| D21 | Off (MB6): CF1 related walk in pre-commit (vitest + tsc); checker snapshots, proof receipts | `ea606a31d5` | Jake's call | off |
| D22 | Off (MB7): G746 pre-land product builds, parity previews, soaks, Sim readings before landing | — (G769 rule) | Jake's call | off |
| D23 | Readings deferred to one per plan at the end (G777, G780): ci-flow CF3/CF4; iphone-downloads I5, I12; loading S1, L16, G1, loading L9-L14 (own-content G763 units, current footer and actual first-start setup); js-heap H rows; night-market-remaster RM12; tiles T10 soak; SHARD-PLATFORM M2 | — (G780) | each plan's lane | waiting |
| D24 | 21 files in `vite/` (G799): assetHashes, assetTables, backdropPrefix, basis, bootExtras, bootModules, bootProducts, bootProductTiers, chunkReport, crossroadsRig, devserver, gen, genShards, gridSeamPlans, noTopLevelAwait, outputProducts, preview, pwa-plugin, rapier, worldMapAtlas (+ titleCatalogue) | — (G799) | after the plan (BD7) | open |
| D25 | Virtual module `vite/titleCatalogue.ts` (G799: no virtual modules) | — (G799) | after the plan (BD7) | open |
| D26 | Uncommitted gate edits left in the shared tree (MB8: owner drops them): `.github/workflows/deploy.yml`, `scripts/gate-related-tests.mjs` (+ `.d.mts`), `test/gate-related-tests.test.ts`, `test/boot-smoke-dispatch.test.ts`, `test/precommit-stop-types.test.ts` (staged), untracked `scripts/ci-related-first.mjs` (+ `.d.mts`, test) | — (tree) | their owners | open |
| D27 | Seven leftover `.push-config-*.json` files at the repo root (untracked) | — (tree) | sp-x7 | open |
| D28 | Nalati generation stage: `generators/geographySource.ts` (new) is not in its job's inputRoots, so HEAD previews fail with ERR_MODULE_NOT_FOUND (log tmp/serve/failed-20261027-013000-4402.log) | c954d624a0 | breaker (sp-x7 finds) | fixed 435c66d088 |
| D29 | Far Reach product build: far-reach/generators/product.ts:33 parseShardfile throws 'shardfile semantic rules' (no rule named), so `serve-build --head` and `--rev 2896dc0d85` fail (log tmp/serve/failed-20261027-011921-4400.log); a127a8a built | between `112cbc3787` and `84f531f9dc` (refactor(sky) handoff commits) | Far Reach generator lane (sp-x1, GR5) | open |
| D30 | HEAD preview build: `Missing or duplicate catalogue dependency: nalati-poi-paint` (log tmp/serve/failed-20261027-012330-4400.log) | `aec0cd6ff9` (refactor(nalati): own POI paint construction) or later | sp-o1 | fixed 117a93c517 |
| D31 | Shared tree: uncommitted `scripts/generation-jobs.json` edit leaves job `pine-grazers` incomplete, so `pnpm gen` / working-tree previews stop ('Incomplete generation job pine-grazers') and generated discovery files (e.g. far-reach/discovery.generated.ts) go missing for focused tests | — (working tree) | sp-o1 | fixed bc073a04c9; working catalogue synced |
| D34 | Developer Tile residency Whole cell selects radius8 but the entered-content helper caps2; static source mismatch, no capture run; prepared G790 T10 removes this choice after T8 | `ef46afdc19` (T5 choice after89f7d3598a cap) | sp-x2 (T10 after T8) | fixed `45086a7db8` (Whole cell removed after T8) |
| D32 | Pine generation stage: `src/shards/pine-hollow/generators/quests.ts` imports `@wildshard/sdk/quests`, which the generation stage's linked node_modules does not export, so `serve-build --rev 8a832edf7b` fails (ERR_MODULE_NOT_FOUND; log tmp/serve/failed-20261027-012212-4400.log:643) | `8a832edf7b` or earlier (sent to sp-x7 01:22) | breaker (sp-x7 finds) | open ; also observed on `65f396768e`, zero browser samples, `tmp/sp-x8-g717/g769-capture-preview.log` |
| D33 | Pre-G769 legacy GR5 related walk returned rc1/zero suites without a reported cause; no executed assertion result, and no repeat under G769 | — (local, before `83d1cd4c39`) | sp-x1 | open; classify after the plan |
| D35 | docs/ENGINE.md exceeds the 1 MB blob cap (1,000,366 B); additional API prose cannot land there. H11 notes stay in source/the counted heap plan. | `4b18cede14` | sp-x9 | fixed `46547f8e95`: condensed the affected API prose to 999,862 B without a cap change |
| D36 | Generation catalogue: 'Missing or duplicate catalogue dependency: pine-layout' stops every HEAD preview (log tmp/serve/failed-20261027-014157-4401.log) | 4645a57294 | sp-o1 | fixed 117a93c517 |
| D37 | Stale Far Reach ratchet allowance cleanup: remove the missing discovery row at the coordinator direction plus11 measured-zero retired boundary counts. The actual platform discovery restore and its regenerated-source count remain with sp-ci-deploy; no fake provider or allowance growth. | GR5 retirements / missing generated provider (tree) | sp-x1 (Far Reach counts), sp-ci-deploy (provider) | own stale counts fixed in this commit; required global check attempted, independent failures retained |

| D38 | Sealed `nalati-geography` cannot resolve `@wildshard/sdk/random` from `geographySource.ts`; generation still masks tests | `c954d624a0` | sp-ci-deploy | fixed 0c8f7e357f + 0bee1d1707 + d6aacec1a5; real Nalati boot metadata generates |
| D39 | Generation stage: `@wildshard/sdk/random` (and `sdk/quests`, D32) is not linked into the stage's node_modules, so clean builds of HEAD fail (`serve-build --head` at `4778e51ce1`: ERR_MODULE_NOT_FOUND, log tmp/serve/failed-20261027-014444-4401.log:35) | `4778e51ce1` or earlier | sp-ci-deploy | Nalati fixed d6aacec1a5; Pine SDK closure retained in D32 pending full generation |
| D40 | Nalati generation stage: `geographySource.ts` imports `@wildshard/sdk/random`, undeclared in its job's inputs; HEAD previews fail (ERR_MODULE_NOT_FOUND, log tmp/serve/failed-20261027-014514-4401.log) | c954d624a0 | sp-ci-deploy | fixed 0c8f7e357f + 0bee1d1707 + d6aacec1a5 |
| D41 | Nalati generation stage: `generators/bake-boot-metadata.mjs` imports `@wildshard/sdk/bake/terrain.ts`, undeclared in its job's inputs; HEAD previews fail (ERR_MODULE_NOT_FOUND, log tmp/serve/failed-20261027-015120-4401.log) | after 0c8f7e357f (sealing) | sp-ci-deploy | fixed d6aacec1a5; actual sealed boot metadata generates |
| D42 | Pine generation stage: `src/shards/pine-hollow/generators/layout` is not in the stage tree, so `serve-build --rev 41edbfdd9b` fails (ERR_MODULE_NOT_FOUND, log tmp/serve/failed-20261027-015940-4400.log); `60be37a2f2` still builds | after `60be37a2f2`, by `41edbfdd9b` | breaker (sp-ci-deploy finds, G802) | open |

| D43 | Working Driftwood writer stopped publishing piers/trailside before its catalogue retired them; generation failed output inventory | — (shared working tree) | sp-x10 | fixed 5d321977a7 |

| D44 | Push-loop fixtures still asserted retired split, red hold, 180-second cap and fail-closed behavior | `7d70d351bb` | sp-ci-deploy | fixed daf42ed943 + defb0f9fd2 + feb2658690; 45 native cases pass |

| D45 | Nalati grass native scatter constructor omitted geography program/source, seed and source metadata inputs from its sealed job | `6e84134e0c` (source migration; observed in shared tree) | sp-ci-deploy | fixed b4fb652955; real sealed grass producer generates 11 outputs (3.206s) |

| D46 | Shared-tree generation cannot discover `open-plots-world`: its declared `generators/bake-plots.mjs` was removed in an in-flight migration; real discovery restore is masked | — (working tree after `d6ca33cfc8`) | sp-o2 | working catalogue synced by sp-o2; committed GR9 retirement pending |

| D47 | CI `generated-inputs`: Driftwood map assembly cannot resolve owned geometry `cascade/mooringLines` (`scripts/map-world.mjs:44`, `mapAssembly.mjs:76`) | `c7a57488e4` (run 40464950813) | sp-x10 | fixed `15f149539c`; sp-x8 pinned `8422baac07` normal generation passes the map, then hits the separate Nine coarse L1 blocker below |

| D48 | Real strict discovery-provider build fails Far Reach with `Sky static contact envelope differs` (`staticSceneIntake.ts:36`); discovery modules cannot be restored | `452dadcbf1` (defining intake; observed in local provider restore) | sp-x1 | routed by sp-ci-deploy; source/intake correspondence fix requested |

| D49 | Driftwood's `shard.config.ts` default export is now a build function, so five tests that treat it as a Shardfile no longer typecheck or pass typed lint (`chapter-story`, `grid-query-terrain`, `quest-catalogue-sites`, `quest-story`, `runtime-equipment`: "Property 'identity' does not exist on type 'Shardfile \| ((ctx) => Promise<Shardfile>)'"); found by sp-o1 moving Pine's readers to `test/fixtures/pine-program.ts` | `60e393b0e8` | sp-x10 (GR7 Driftwood) | open; Pine's default is the program too since GR8 G20f (sp-o1), so these five read `PINE` from `test/fixtures/pine-program.ts` once Driftwood's side is fixed |

| D50 | Nine T8 coarse L1 city breaks strict product admission: tile/1/1/1 compressed 530,372 > 200,000, triangles 10,160 > 10,000 and draws 17 > 2, plus ten other exact L1 metrics; plan-end preview `8422baac07` refuses after 66.12 s (`tmp/serve/failed-20261027-022131-4407.log:901`), zero browser samples | `82ac81812d` | sp-o5 (G748.6) | producer correction `e389eb998e`: each L1 <=2 draws /191412B /3371 triangles, L0 unchanged and no allowance raise; plan-end preview not repeated while source work continues |
| D51 | Test types: `driftwood-creature-look`, `driftwood-island-look` and `driftwood-product-reads` read the Driftwood product default as an object (`.look`, `.rows`), but it is now `(ctx) => Promise<Shardfile>` (`tsc -p tsconfig.json`) | `60e393b0e8` | sp-x10 | open |
| D52 | Driftwood map bake: `generators/mapAssembly.mjs` still calls `siteCatalogue()` and imports `WORLD_SCENES`; both take the scene banks since the cargo bank landed (`driftwoodSceneBanksFrom(read)` is its direct seam) | the cargo-bank commit (sp-o4, GR7) | sp-x10 (agreed: adapts mapAssembly after the bank lands) | open |
| D53 | Full-tree ratchet now reaches counting but refuses existing shard-sandbox rises in Driftwood/Nalati/Nine generator readers (including oceanFiles/hibiscusFiles/palmFiles/bootFiles/casts/bootRecipes/coats/riggedHulls); exact S3 archive scope passes unchanged baseline. Raw list tmp/sp-x2/s3-road-owned/archive-ratchet-final.log; no guard/allowance edited. | observed `ec86872b48` (not culprit attribution) | breaker (sp-ci-deploy finds) | open |
| D54 | `test/explorer-catalogue.test.ts` imports `output` from Far Reach's `generators/sourceOutput`, which no longer exports it, so the file fails types and typed lint; it also still imports Pine's retired `WILDLIFE_DRAW` (now `PINE_WILDLIFE_DRAW` in `test/fixtures/pine-program.ts`, GR8 G20h, sp-o1) | `22bcb2170b` | sp-x1 (GR5 Far Reach) | open; swap the Pine import when the Far Reach read is fixed |
| D55 | CF2 grid far-cell preparation barrier refusal: receipt `40371580877` (fatal-free ready/unpaused/drawing snapshot, seven far cells fetching); held stage remains unattributed, no title-PNG claim | `2b11287c5fb143b960b15cf3e37fe17be1ead3c3` | sp-x6 | open; no grid quarantine or causal closure claimed |
| D56 | Selected ratchet on mapAssembly.mjs refuses inherited generator imports 8 + engine import 1, declaration imports 2 (committed allowances absent); 2478 incorrectly claimed a pass. Scalar additions did not change these counts. | observed `2478c3bf78` (not first-bad attribution) | sp-o5 (GR6 DataMap purity); sp-x6 corrects claim | fixed `53b85685ca`; pure caller-owned map/SDK source removes all inherited imports; original false claim retained, no allowance increase |
| D57 | `sky-data-map`'s entry is `scripts/bake-sky-map.mjs` under shard `far-reach`, so `discoverGeneration` refuses the whole catalogue ("Generator must be owned by far-reach"): every generation and every test that discovers jobs fails (seen in `test/sky-islet-rig-inputs`' cold sealed case) | `a13ff63a26` | sp-x1 (told 2026-10-27) | fixed `fa8ec9fe52` |
| D62 | The `driftwood-foliage-scenes` job cannot run: `islandDressing.ts` (imported by `bake-foliage-scenes.mjs`) imports `../discovery.generated`, which the job does not declare, so its stage fails with ERR_MODULE_NOT_FOUND and the phone / desktop foliage GLBs only change when it runs (seen while landing I3's foliage compaction) | `a5e53cc7d7` (not first-bad attribution) | sp-o4 (foliage bank, told) | fixed (sp-o4, this commit): the job runs with --import ./scripts/generation-level.mjs --generation-shard=driftwood-isle, as the dressing job does, and declares its roots; a stage-style --check run gets past the import (only the phone GLBs differ, from 03d206811a) |
| D58 | Pine `manifest.json` binds `./generators/fauna` (not a JSON / generated module), so `parseManifestMetadata` refuses it and `test/page-boot-discovery.test.ts` cannot load (its module-level manifest parse throws); found while landing page-mode program discovery | `d97f0e46a6` | sp-o1 | fixed (sp-o1, this commit: the format admits a `./generators/<name>` spawns binding, the form scripts/manifest-spawns.mjs runs) |
| D59 | For Jake's review (G20a, G769): `src/format/decisionScripts.ts` raises the decision-module cap from eight to nine, product-wide, so Pine's contract guest ships as a named module instead of 15,704 base64 characters in `quests/contracts.json`; `test/decision-module-cap.test.ts` pins nine and refuses ten. Nalati's practice course (GR6 B5) asks for the same ninth slot | this commit | sp-o1 (GR8) | open: Jake confirms the cap or names a module-budget design |

| D60 | Required ratchet aborts before counts on stale generator-imports allowance for deleted src/shards/driftwood-isle/generators/bake-driftwood-fixed-models.mjs; exact tmp/sp-x1-crown-retire/ratchet.log | 8a0cba55cd | sp-x10 | open, routed; Far Reach touched rules measure0 |
| D61 | HEAD previews fail: a Nalati generation stage opens `src/shards/nalati-grasslands/data/geography-forest.bin`, which the retired `nalati-geography` job no longer writes (`ENOENT`, log `tmp/serve/failed-20261027-030932-4400.log`); blocks every HEAD preview, so the G32 Pine tree check waits | `30a9e429c9` | sp-x6 (GR6) | open |
| D63 | Pine product build refuses 'config must bundle as one module': `generators/kingKit.ts` imports `@wildshard/game/plugin/geometry`, whose dynamic `import('../shardfile/runtimeProduct')` becomes a second config chunk (`runtimeProduct-*.js`, 199 modules) even with code splitting off; `node scripts/build-shardfiles.mjs --shard=pine-hollow` exits 1 | `98e0b24f9b` | sp-o1 | open |

| D64 | Plan-end preview `f7783051c9` passes Far Reach ownership then Pine map generation cannot read tracked `public/assets/models/pine-hollow-crags/crags.glb` from sealed `cragSceneContribution.ts` (`tmp/serve/failed-20261027-025756-4407.log:684`, 20.82 s, zero samples) | `bc78671a96` | sp-o3 (crag producer; sp-o1 routed) | open; no guard change or duplicate generation |

## Rows

Parked: none of these is built until SHARD-PLATFORM completes and Jake says go.

| Row | What | Done when |
|---|---|---|
| BD1 | Fix every red item, oldest first, each by the lane that broke it (G754); sp-x7 hands them out. Fix forward, keep every assertion (G690). | D1–D10 `fixed` with their SHAs |
| BD2 | Main green. | One push CI run on main is fully green |
| BD3 | Deploy resumes on the newest green main (`.github/deploy-pin.json`, hourly). Then Jake's phone check (G558). | Live build id is a green main SHA newer than `59a595ab10`; D11 `fixed` |
| BD4 | Decide which switched-off checks come back (Q1). Default (G768): the 45 s push gate and 5 s pre-commit stay; CF1, the red hold, `ci-subset` and fail-closed inputs stay deleted unless Jake asks. Delete the dormant code and its tests (Q2). | D16–D22 each `kept off` or `back`; no dormant gate file left |
| BD5 | Fix each quarantined flaky test deterministically (G690) and move it back to the blocking job. | D13–D15 `fixed`; the quarantine job is empty (Q3) |
| BD6 | Run the deferred readings, one per plan, in official quiet windows (G777, G780). | Each reading in D23 is recorded in its plan; its rows close or reopen |
| BD7 | Cut Vite to bundling only (G799): each `vite/` file is deleted, or its data becomes a committed file made by a plain script (G798); `titleCatalogue` stops being a virtual module. | `vite/` holds only what bundling needs (Q4); D24, D25 `fixed` |
| BD8 | Clean the tree: owners land or drop the abandoned gate edits; the `.push-config-*` leftovers go. | `git status` shows none of D26, D27 |
| BD9 | The list reaches zero; the plan archives to `project/archive/`. | Every item `fixed`, `kept off` or `back`; no row open |

## Questions for Jake (when it starts)

Option 1 of each is "Skip for now".

- **Q1 Which switched-off checks come back?** Options: Skip · Keep the G768 default (45 s push, 5 s pre-commit,
  the rest stays deleted) · Also bring back fail-closed inputs · Also bring back the CF1 related walk.
  **Recommended: the G768 default.** The old gate stalled lanes for hours (MB §1); CI catches the rest.
- **Q2 The dormant gate code (red hold, ci-subset, split, handoff, receipts): delete it?** Options: Skip · Delete it
  and its tests · Keep it dormant. **Recommended: delete.** G769 says delete machinery; dormant code rots and
  confuses lanes.
- **Q3 Once the flakies are fixed, does the quarantine job stay?** Options: Skip · Delete it when empty · Keep it for
  the next flake. **Recommended: delete it when empty.** A new flake is fixed the same hour (G690), so it needs no
  standing job.
- **Q4 How far does the Vite cut go?** Options: Skip · Bundling only: every plugin that makes data becomes a plain
  script + committed file · Only the virtual module and the dev-only plugins. **Recommended: bundling only** (your
  G799 words: *"really lean and simple"*).
- **Q5 Does the list burn before anything else after SHARD-PLATFORM?** Options: Skip · Burn first; HOST-AUDIT and
  the rest wait for zero · Run beside HOST-AUDIT. **Recommended: burn first.** Your phone check needs a green main
  and a moving deploy.

## Out of scope

- Jake's own after-plan work: the tiny repo, the git history rewrite, worktrees, and merging only when green.
- The tooling rows G770 moved to the end of the queue (green-main GM1, ci-flow, shared-waits, GS4/GS5): they are
  counted SHARD-PLATFORM rows, built in that plan.
- [HOST-AUDIT](HOST-AUDIT.md) and the other parked off-shoots of [SHARD-PLATFORM](SHARD-PLATFORM.md).
