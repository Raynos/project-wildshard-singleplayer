# SHARD-PLATFORM — red → green log (G330; coordinator-written)

Each push-queue, GitHub CI or deploy red: the failing check, the culprit, the fix and the owner lane. sp-x7 reports each
one to the coordinator; only the coordinator writes this file.

| Date | Red | Culprit | Fix | Owner |
|---|---|---|---|---|
| 2026-10-11 | local gate: row-data JSON export | `255dd529c` | `b4a36e751` | sp-x4 |
| 2026-10-11 | Linux CI bake-check: Nine physics bytes | `669511341` | `baa8a3165` (verified on Linux CI 38139754563) | sp-x7 |
| 2026-10-11 | Linux CI bake-check: Nalati places specimens | `27b0d8da1` | `baa8a3165` + `0f0fa888d` (verified on Linux CI 38139754563) | sp-x7 |
| 2026-10-11 | local gate: typecheck-layers TS6307 | `baa8a3165` | `0f0fa888d` | sp-x7 |
| 2026-10-11 | local gate: Signal TS4023 | `e16d4119e` | `2ce849ed3` | sp-x4 |
| 2026-10-11 | admin-deploy: missing module + stale reader | `0e9cb9801`, `b34239411` | `e8574fbb8` | sp-x7 |
| 2026-10-11 | push: unapproved Signal standalone shard-game-plugins 0 → 2 | `f06f3eea9` | `02b4a2dfa` (receipt) | sp-x4 |
| 2026-10-11 | local gate: typed oxlint, Driftwood brain switches non-exhaustive | `33511c931` | `ea1c22453` | sp-x6 |
| 2026-10-11 | local gate: Sky TS2883 SKY_SPECIES_BRAINS inferred type | `f1a096bf1` | `d10d4a1b3` | sp-x6 |
| 2026-10-11 | deploy: release selected before an in-flight exact-SHA smoke (12:47 no-op) | `3b509cff0` | `7ed48b955` | sp-x7 |
| 2026-10-11 | local gate: Driftwood physics bake stale after a source edit | `ea1c22453` | `edd01ddce` (rebake) | sp-x5 |
| 2026-10-11 | detached commit-ratchet: false sim-no-render red on Sky isletLift | `5985020fe` | `c4b6aca04` | sp-x6 |
| 2026-10-11 | push: unapproved Signal skitterer generator-imports 0 → 3 | `79422f721` | `f3c23cb49` (receipt) | sp-x6 (row filed by sp-x7) |
| 2026-10-11 | push: E476 commit-msg hook refuses the pusher's legacy regeneration messages | `95cd3e37a` | `47b53311b` | wildshard-new / sp-x7 |
| 2026-10-11 | local gate: brain-factory refusal tests (flyer, grazer) | `70f2b1ede` | `26eb99d50` | sp-x5 |
| 2026-10-11 | commit message swapped between concurrent commits (shared COMMIT_EDITMSG; `fc3d42c39` kept its wrong label) | — | `b87365957` (commit lock) | sp-x7 |
| 2026-10-11 | local gate: group-factory missing-port assertions | `a52097c07` | `d2754ee70` | sp-x5 |
| 2026-10-11 | local gate: map-coverage expects old map URLs | `e2bc770ab` | `dd6a2b918` | sp-x4 |
| 2026-10-11 | push: unapproved Driftwood audio/install engine imports 2 → 3 | `992fd31b1` | `84193208e` (receipt) | sp-x5 |
| 2026-10-11 | push: unapproved Signal plugin game imports / plugins 6 → 7 | `630fcca7f` | `84193208e` (receipt) | sp-x5 |
| 2026-10-11 | regeneration: nine bake freshness tests (6 physics, Driftwood quest/spots, Pine spots) | `3ab73b7e2` (x2), `630fcca7f` + `786595307` (x5) | `d1b7d0333` (recapture) | sp-x2, sp-x5 |
| 2026-10-11 | Pine physics and spots stale after a runtime/index change | `4a7bb872d` | `da558cf70` (rebake) | sp-x5 |
| 2026-10-11 | local gate: commit-message-lock abort fixture timing under load | `b87365957` | `e5905be80` | sp-x7 |
| 2026-10-11 | local gate: typecheck (SDK flesh surface vs shape schema) and Nine physics stale source | `0cdf42300` | `9266e206c` | sp-x6 |
| 2026-10-11 | Linux push CI: pusher fixtures use BSD-only mktemp templates (GNU refuses) | `e38a138a1` | `36f64a51e` (Linux verified, CI 38182470819) | sp-x7 |
| 2026-10-11 | Linux push CI: Driftwood native-cache continuous vs mid-fight restore diverges on Node 24.21 | intermittent; artifact `dd61a915c` armed | pending | sp-x7 (diagnosis) |
| 2026-10-11 | local gate: oxlint, redundant process.versions.v8 fallback in number-path-probe.mjs | `dd61a915c` | `321a8043f` | sp-x7 |
| 2026-10-11 | nightly coverage (W12): 9 timeout files | heavy matchers, compiler, serial natives | `a2d0c5499`, `859e401d9`, `07865987e` (Linux run 38183108912 green) | sp-x7 |
| 2026-10-11 | push: unapproved Driftwood ground generator-import rows | `c5a704e60` | `ee237da77` (receipt) | sp-x6 |
| 2026-10-11 | push: unapproved Nalati Bowl game-imports / plugins | `669c3e6d6` | `ee237da77` (receipt) | sp-x4 |
| 2026-10-12 | deploy backstop: launchd registration lost after the reboot | host state (reboot) | re-registered with `scripts/deploy-backstop/install.sh` (no source change) | sp-x7 |
| 2026-10-12 | nightly coverage 38295529534: Pine night-continuation 20 s timeout (whole growing history compared every tick) | — | `56de6e642` (append-only suffix check, final exact history; Linux coverage 38307485374 green) | sp-x5 |
| 2026-10-12 | nightly GPU gate 38289166087: 3 asset-audit false positives (packed Nine BOOT_FILES, Pine `{id}` strings) + 7 parity cases red | parser `7942c79f0` | parser `bccea7dde`; parity: Template + Nalati re-baselined, 5 attributing (sp-o5) | sp-x7, sp-o5 |
| 2026-10-12 | commit-ratchet: Driftwood entryDecks / entryLandings sim-no-render 0 → 1 with their generated JSON missing | `aaf0854c4` (permissive fallback; the reboot exposed it; caller `c4b6aca04`) | `bbccee7ac` (refuse a missing pinned JSON; Git-local isolation) | sp-x7 |
| 2026-10-12 | push gate `034a887ec`: typed lint return-await (regionalWorld.ts:437); 10 vitest (3 stale maps, Nine physics stale scene hash, 6 author-closure expectations) | `a65a4043e`, `7e90dfbff`, `1706d021f` | lint `f3edbeeaf`; Nine physics `4b2da2770`; maps `96405d9c5`; closures `aae6717b6` | sp-o2, sp-o4, sp-x6 |
| 2026-10-12 | format export `./bakedTerrainSampling` dropped (public-index; HEAD exports fail to build) | `7e90dfbff` | `d5b11793f` | wildshard-new |
| 2026-10-12 | release proof 38302848245 on `61ac0049a`: hover cases pass but the 12-min job deadline cuts the timing/artifact step; release skipped | `8f1918525` (serial engines; build growth exposed it) | `be86697fb` (separate Chromium / WebKit exact-SHA legs, no timeout increase) | sp-x7 |
| 2026-10-12 | push gate `70e5636a8` bake-sky: Pine / Nalati `.gain.png` stale (ImageMagick 7.1.2-33 PNG8 palette quantized the gain) | toolchain update (reboot) | `72d43dd82` (lossless 8-bit greyscale gain, rebaked pixel-identical, maxdiff 0) | sp-o2 |
| 2026-10-12 | commit-message lock deadlock: post-commit's nested sweep-guard ledger commit waits on the lock its parent holds (hit 4 times) | `b87365957` + synchronous ledger hook | `93ec1c2fc` (ledger worker detached until the parent exits; real-hook regression) | sp-x7 |
| 2026-10-12 | look regression: Pine cell near grass missing on both tiers (look48) | `a6c81a933` (grid warm-up prepared grass outside the cell's level frame, seeded on the road heightfield) | `4213f5720` (grass captures its heightfield at build, enters it per slice) | sp-o5 (proof board sp-o10) |
| 2026-10-12 | gate `7240`: advisory declaration import/newline-after-import | `3b8c5033a` | `8219db760` | sp-x7 |
| 2026-10-12 | gate `7240`: stale Pine + Sunscar maps, Nine + Pine physics inputs, Pine spots | `95e2e8d34`, `38ea143c5`, `7c192ae99`, `0eb28545b` | maps `e6355981d`; Pine physics/spots `5b0efa66e`; Nine physics `278e5284b` | sp-o10, sp-x5, sp-x7 |
| 2026-10-12 | gate `221a20c3a`: far-reach physics-bake freshness | `7b8bdcff4`, then `accf9c96c` + a `scripts/bake/worldHost.mjs` change (physics inputs changed without a recapture) | `00fb50071` (official Node recapture on f508e4a83; `da2017283` was overtaken) | sp-o12 |
| 2026-10-12 | gate `221a20c3a`: six author-closure fixtures miss `src/format/nearPlaceholder.ts` | `69c4798aa` | `f17a7c846` (all nine author jobs) | sp-x6 |
| 2026-10-12 | gate `221a20c3a`: 18 frozen Pine named-place lookups; Pine manifest closure 44 > 43 | `cf0cf8bb1` | places `2434e2279`; closure 44 → 43 `651a0229c` | sp-x6 |
| 2026-10-12 | gate `221a20c3a`: oxlint prefer-template in capture-main-menu-hero | `64c23b133` | `9805aead8` | sp-x7 |
| 2026-10-12 | push queue stuck on obsolete prefixes (source-fix repairs earned no retry) | `e38a138a1` / `e50a44ceb` | `b0e5804e3` | sp-x7 |
| 2026-10-12 | gate `221a20c3a`: game-plugin-exports refuses `quest/coinReward`, `shardfile/bossView`, `shardfile/bakedSpecs` | `ff158375e`, `33db1ffb2`, `0ee63c170` | `0d8708dac` (moved under `game/plugin/`) | sp-o16 |
| 2026-10-12 | Sky canonical run drift: Roc fight ~5.3k ticks longer (21134 → 26469), undetected (ledger asserts only an eventual reward) | `dbcef52f5` (portable maths in recorder/worker; intended; record left stale) | `f0135d33c` (re-record on 00e7da5fb: 26469 / 26349 / `2c62014c`); endpoint guards `0808b458d` (Nine `3ef5ed223`, Nalati `a284c8f1d` records refreshed) | sp-x1 |
| 2026-10-12 | push retry refused the real mixed `221a20c3a` log (lint section ran into bake diagnostics) | `b0e5804e3` / old `e38a138a1` lint parser | `1e4406f18` | sp-x7 |
| 2026-10-12 | gate `221a20c3a`: TASK_CLOCK fixture context | `99b0866c0` | `7e3409bfe` | sp-x1 |
| 2026-10-12 | frozen gate `638194c1b`: Pine physics/spots freshness | `cd925ed46` (director.ts) | `997ec082f` | sp-x5 |
| 2026-10-12 | frozen gate: Driftwood + Nine physics freshness | `f508e4a83` (worldHost) | `5b17eb0a5` | sp-x7 |
| 2026-10-12 | frozen gate: Sky map stale stamp + raster (gate checked stamps only since `1157af929`) | first-bad not isolated | `ae7bda975` (official rebake); pixel-digest guard queued (sp-x1) | sp-o28 |
| 2026-10-12 | frozen gate: SDK release exports (near producer) | `26f3a96e4` | `e689457f1` | sp-x7 |
| 2026-10-12 | frozen gate: authoring-docs (near types undocumented) | `26f3a96e4` | `15d7f33b4` | sp-o25 |
| 2026-10-12 | frozen gate: Sky map POI coverage (all movers exposed) | `3345469e4` | `fba1c8aa8` | sp-x4 |
| 2026-10-12 | frozen gate: debug raisedBy named a plan row (G342) | `f508e4a83` | `db3e524d1` | wildshard-new |
| 2026-10-12 | stale private-index commits reverted other landings (`bb6291f57`, `15d7f33b4`) | private index read before HEAD moved | re-landed `3ba757ba5`, `957b05e68`; guard queued after push (sp-x7) | sp-o24, sp-o25 |
| 2026-10-12 | frozen gate: Sky headless-runtime test lint (duplicate Roc import; optional chains) | `cd925ed46` (duplicate import) + `fe3cb30c2` (`SKY_ITEMS … as const` made the test's optional chains unnecessary) | `957b05e68` (re-land of `d0a96e6e1` after `15d7f33b4` reverted it) | sp-x1 |
| 2026-10-12 | silent-revert guard refused native pathspec commits when HEAD moved during the hook | `afad1ea04` | `594cf8762` (validates Git's own next-index; native ref CAS kept) | sp-x7 |
| 2026-10-12 | gate: Pine manifest closure 44 > 43 (verified: only `pine-hollow/data/placeholder.ts` added) | `7d6b3c0b4` | `c21f24156` + `8c24b45d8` (manifest imports no placeholder data) | sp-o32 |
| 2026-10-12 | gate: Sunscar whip-parity require-await | `fd523da91` | `744854d7d` | wildshard-new |
| 2026-10-12 | gate: Driftwood + Pine physics/spots freshness (new `data/placeholder.ts` inputs) | `7d6b3c0b4`, then `c21f24156` + `8c24b45d8` | DW `ec8a8e7fa` (sp-x7); Pine `17d1d63d9` (sp-o32) | sp-x7, sp-o32 |
| 2026-10-12 | gate `5d957bdce`: Nine/Nalati/DW/Signal physics stale (new placeholder / moverBake / shared geometry inputs) | `c21f24156`, `8c24b45d8`, `83585e874`, `f526c81ca` | `87a20b7ee` (all-native recapture, gameplay identical) | sp-x7 |
| 2026-10-12 | gate: 5 Blender-template proofs (renderer reached Node closure via plugin/placeholder → grid/farView) | `677bd1cf1` | `caca880f5` | sp-o34 |
| 2026-10-12 | gate: authoring-docs SkinnedBake undocumented | `02e371386` | `5639fa58c` | sp-o33 |
| 2026-10-12 | **LIVE-GAME P0 (caught pre-release): Signal never reaches ready at HEAD** ('Shardfile requires the normal play stage'); boot smoke doesn't cover Signal page-ready | `677bd1cf1` (CLI baked placeholders by default → first-party products gained near/far → `emptyHybridData` false) | `54603cb17` (build-shardfiles `--no-placeholders`; phone+desktop ready proven); release pin `ba9d6e00e` until green; boot smoke widened to all shards (sp-x7) | sp-o33, sp-x7 |
| 2026-10-12 | app builds broke ('Author CLI must bundle to one module') | `7aa781064` (dynamic import in sdk/project.ts) | `c187596ec` | sp-o34 |
| 2026-10-12 | gate gap: exact-SHA boot smoke didn't cover every primary shard's page-ready | — | `b6ea23f72` (catalogue-driven, public + experimental + Developer grid) | sp-x7 |
| 2026-10-13 | gate `3ebe17265`: 14 tests (Signal ground not primed in 4 harnesses; Pine coat assumed catalogue order) + bake-navmesh (manifest base not installed) | `b60dde094` | `41ce25a91` | sp-x6 |
| 2026-10-13 | Linux CI 38327006887 / admin 38327006884: generation fails, `sunscar-dunes/ground/ring-mean.bin` pin differs on Linux x64 (native f64 trig) | `b60dde094` | `96366f3e6` (portable math, canonical re-pin; Linux CI 38333372980 passes generation) | sp-x6 |
| 2026-10-13 | gate `28f6a8f2c`: Driftwood physics + spots freshness (palm near floor edited a physics input) | `7caf1411f` | `6276fbf1f` | sp-x7 |
| 2026-10-13 | **LIVE-GAME P0 (caught pre-release): Signal not enterable from the grid** (required baked terrain read before install on the grid path); smoke's grid leg only proved home handoff | `b60dde094` | `96366f3e6` (required WSTR loaded before regional collision; real road entry 0 errors) + required road→Signal smoke leg `5c3397bd7`; release unpinned `e6eeefc1e` after Linux CI 38333372980 + exact-SHA boot smoke 38334018235 (road → Signal, 0 faults) green on `de0130e95` | sp-x6, sp-x7 |
| 2026-10-13 | gate `95dc6390e`: `test/baked-maps.test.ts` far-reach freshness (skyCards producer drop changed the Sky map's input key) | `768dff324` | `24a824346` (official restamp; image byte-identical) | sp-o40 |
| 2026-10-13 | draft build only (not main): `Cannot find package '@wildshard/commons'`; the draft carried stale working-tree `generation-jobs.json` hunks that dropped Signal's commons roots and the ring pin | — (draft `9aeeab354`) | main correct; multi-writer rule in `lanes/common.md`; reused-export link gap fix (sp-x7) | sp-x7 |
| 2026-10-13 | reused export: bare `@wildshard/commons` unresolved after a new workspace package arrives (source-link fallback skipped on rerun) | `28e178749` | `3fe2d08cf` | sp-x7 |
| 2026-10-13 | required road→Signal smoke leg red on every base: staged at Signal north 251.5 m, not the neutral-road midpoint (harness, not game) | `5c3397bd7` | `c0f31b6af` (Driftwood → road → Signal, ready + 10 live frames, 0 faults) | sp-x7 |
| 2026-10-13 | gate `4771331ba`: Pine map freshness (king-collision helper import is a map input), Pine spots + Signal physics freshness, typed lint on the road smoke `.d.mts` | `96366f3e6` (Pine map), `0e00aa4e7` (Signal physics), `30dc4c9ae` (Pine spots), `5c3397bd7` (lint) | `a185429b0` (map restamp, image identical), `562b60e64` (lint), `5c610fe90` (native recaptures, gameplay exact) | wildshard-new, sp-x7 |
| 2026-10-13 | admin deploy 38333424213: isolated admin archive omits `scripts/generate.mjs`, now imported by `scripts/shard-platform.mjs` (ERR_MODULE_NOT_FOUND in the admin-data collector) | `f36d2a239` | `b18aba4d4` (clean-export adapters include committed scripts / catalogues; real archive fixture) | sp-x7 |
| 2026-10-13 | gate `868e6350f`: Signal + Sky physics and map freshness (shared `bakedWorld` loader changed both shards' inputs; only one recaptured) | `115831666` | `940949695` (Signal physics), `1539110d9` (Signal map, image identical), Sky by `d5267c284`; rule `81914f07b` | sp-x7, wildshard-new |
| 2026-10-13 | gate `bd6653396`: `cone-fan-parity` viewmodel snapshot (test pinned the code-glove fallback; game viewmodel proven identical, 0 px) | `d5267c284` | `5dc782337` (test loads the hero hand; events unchanged) | sp-o58 |
| 2026-10-13 | debt rises refused under G349: Signal generator-imports +3; sdk-no-facade `modelLibrary.ts` +2 | `d9112c821`, `7b2261d1b` | `4914d7403`, `db3edc137` (source fixes, no receipts) | sp-o55, sp-o54 |
| 2026-10-13 | push gate: changed-root typecheck missing Node types (TS2591 `node:fs` …) | `233eae084` | `f0a3ade1d` | sp-x7 |
| 2026-10-13 | push gate: generation-inputs stale on ledger-only commits (cache key ≠ commit-time trigger) | `e11091664` | `f0a3ade1d` | sp-x7 |
| 2026-10-13 | push gate: Template / ink-cel / Signal map stamps stale (config + loader inputs) | `1441ef16f`, `8879ee194`, `115831666` | `8abc34dcf`, `45aa86743`, `1539110d9` (images identical) | wildshard-new |
| 2026-10-13 | push gate: oxlint prefer-optional-chain in `scripts/bake/near-placeholder.mjs` | `a6424d8f8` | `dd922e03b` | sp-o72 |
| 2026-10-13 | CI 38344750048 / build: Signal navmesh `--check` and grid-edge fixture still read the deleted `terrain.bin` | `602f8136a` | `daa20f9f3` (recipe-generated 256 lattice, 65536 Float32 exact; navmesh 739 polys exact; map image identical) | sp-x7 |
| 2026-10-13 | gate: Signal / Sky map stamps stale after authored physics rows | `e6f5078d8`, `3ed995b80` | `7fe8f1db8`, `c0f73d07d` (images identical) | wildshard-new |
| 2026-10-13 | gate: oxlint prefer-optional-chain (near placeholder); near grain shader failed to compile (B/C drew nothing) | `a6424d8f8` | `dd922e03b`, `1837ef8a4` (+ compile test) | sp-o72 |
| 2026-10-13 | CI on `c9f6e59be`: navigation-json lint; five nav contract/order fixtures; build ratchet rows for deleted files + stale README; changed-root typecheck in ratchet fixture | `c9f6e59be`, `ce5a5fcf0` | `e51f846ff`, `b7656034b`, `ce5a5fcf0`, `9ff0dccec` | sp-x7 |
| 2026-10-13 | gate: Driftwood loot RNG stream unseen by the narrowed typecheck | `37a702bdc` | `d3c462a00` (`rng.merge.d.ts`) | sp-o76 |
| 2026-10-13 | gate: changed-root typecheck missed unimported `declare module` augmentations (false reds on Driftwood loot RNG, Signal whip slot) | `233eae084` (narrowed roots) | `2d4b48bf2` | sp-x7 |
| 2026-10-13 | CI red since 02:01Z (nav fixtures, stale tables, lint, terrain readers, type docs) | various | **Full CI GREEN 38350364280 on `b7656034b`**; exact-SHA smoke 38351115302 queued | sp-x7 |
| 2026-10-13 | commit-time map producer never stamped (checked a `revision` field `version.json` never has) | `1a80b9e5c` | `03dc55baa` (pinned-preview check; changed-during-capture refused) | sp-x7 |
| 2026-10-13 | pre-commit fallback export ran `git diff --cached` outside a repo ("unknown option cached") | `ce5a5fcf0` | `29303b889` | sp-x7 |
| 2026-10-13 | release never shipped: selector chased newer pending smokes forever (prod stale on `957b05e6` since 23:23Z) | release selector | `6c9c810e7` (20-min bound) → **live `35e6c10ba-mv6a7k7z` 06:10Z** | sp-x7 |
| 2026-10-13 | gate: row-data refused a function (`isleNode`) exported from Sky `data/` | `fd1b0a9a4` | `ad1220312` | sp-o83 |
| 2026-10-13 | **LIVE regression (found by parity re-attribution):** Nine phone sounds: rock footstep 2 → 98 (double step every step), combat gains a metal step, lantern hum and both ambient beds gone; Nalati steppe beds + all ambient (eagle, herd, marmot) gone | `310110541` (harness: `?mute` no longer builds the AudioContext at load; parity runs with no gesture, so no graph). **Not live**: the game builds audio on first gesture | `921883fb7` (parity builds the muted graph on boot); left: Nine rock step 5 (deferred bank mid-leg), Nalati beds start twice; CI gh-macos15 Nalati baseline: only the 26 audio fields re-recorded in `1e7f6b8ef` (record 38366889945, classified by sp-o97) | sp-o92, sp-o97, sp-x7 |
| 2026-10-13 | desktop-only render change on Driftwood / Pine / Nine (programs −1, textures +1, renderbuffers −5.76 MB, ~−23 MB textures, 2nd programKeys change; Nalati both tiers) | `a7f9f2ca1` (n8ao writes the output buffer directly: −23 MB textures, −5.76 MB renderbuffers, Nine frame max diff 0) and `fbf4097b7` (Nalati grass/terrain read the static bake, G321). **Not regressions**: intended | re-baseline when parity records refresh | sp-o92 |
| 2026-10-13 | CI 38360704970 authoring-docs: GraphStages source doc binding lost | `7c88937bf` | `bac04cb0f` (inventory SDK 578/578, format 654/654) | sp-x6 |
| 2026-10-13 | CI 38360704970: whole-geometry partition fixture hit its 20 s timeout (126k-vertex 13-channel matcher fixture) | `8dbd7c025` | `9f35dd3f2` (108k vertices, still > 25 MB; byte-exact; deadline unchanged) | sp-x8 |
| 2026-10-13 | CI 38360704970 row-data: function `sandEntry` exported from Signal `data/familyLook.ts` | `7e4ee3740` | `4ffefcd05` (moved verbatim to `look/sandEntry.ts`; JSON identical, map pixels identical) | sp-o90 |
| 2026-10-13 | push gate: oxlint import/newline-after-import in `test/bake-kinds-native.test.ts` | `b8279e643` | `2c2aa3c71` | sp-x8 |
| 2026-10-13 | auto-push stuck: cached refusal for `b8279e643` lint suppressed retries after the real fix `2c2aa3c71` (native oxlint reads invisible to the Node trace) | `e1bacdb3b` | `595a7bded` | sp-x7 |
| 2026-10-13 | commit ratchet: Pine streams guard data "unavailable" (detached reader omitted the verified blob pool for a new ignored output) | `3b447618c` (surfaced) | `d15d6cf56` | sp-x7 |
| 2026-10-13 | CI 38363219335 (`595a7bded`): 9 author-closure cases, unkeyed pure-format `bakedTerrainBytes`/`Sampling` (Driftwood ground sampling); earlier GraphStages / row-data / geometry / lint reds gone | `f6d04dec7` (native terrain query profiles) | `8acd18700` (9 catalogue closures; 11 hashes exact); Template props closure next (sp-x6) | sp-x6, sp-x7 |
| 2026-10-13 | push gate: Nalati `hybrid-rows` test pinned `runtime.binds` without `terrain` (query form requires it) | `d3bdac368` | `52ebd4ed0` (pushed green 03:07 local) | sp-o95 |
| 2026-10-13 | push gate: `commit-ratchet` historical-helper fixture (empty historical exports lack `materializeGuardData`) | `d15d6cf56` | `d3c09f654` (CLI-only fallback + independent path/hash/JSON verification; bad bytes / missing pins still refused) | sp-x7 |
| 2026-10-13 | push gate: typecheck TS7006 implicit-any in `scripts/parity/audio-settle.mjs`, `init.mjs`, `resources.mjs` | `530a093ea` | `c8288fe0c` (JSDoc types) | sp-o97 |
| 2026-10-13 | Driftwood / Pine sound diffs (walk-only captures): beds raced the walk reset; Driftwood gull 14 vs 13 from intended `00196a4c2` ramps | walk-only mode, `00196a4c2` | `530a093ea` + `c8288fe0c` (settle level audio before the walk); `8470c8463` + `c2b50c90e` (partial/fast captures skip walk/combat sounds; full exact); gull 13 → 14 re-baselined `d3ba1301f` (fresh full m5 + CI record 38370695798) | sp-o97, sp-x7 |
| 2026-10-13 | `scripts/test-template-gate.mjs`: "Scripted weapon absent: template-whip" (gate pins legacy id; declared item is `weapon.template-whip`) | `ed790a281` (SF16: effective Weapon.id became `declared.weapon.template-whip`) | `4fbbe2193` (gate keys the declared slot); probe hooks missed simulation-backed creatures since `7f84cfff2`: fixed `6db4b85be` (hooks on `AnimalSim`); Template gate green end to end | sp-x7, sp-o102, sp-o103 |
| 2026-10-13 | frame floor: Pine grid desktop travel p95 33.3 ms (since before 10-11; long frames 10–14 per drive) | live warm-up compiled several materials per frame | `6f634c96f` (desktop warm-up sliced to 6 ms, one material / job): p95 16.8 ms ×2, long frames 3–4 | sp-o100 |
| 2026-10-13 | CI typed lint: `scripts/bake-query-terrain.mjs:14` no-overlap | `d3bdac368` | `ad30fba68` (Array.at; arity checks kept; Nalati hash exact) | sp-x7 |
| 2026-10-13 | post-commit hang: a captured caller's stdout pipe held open by the background launcher (private-index helpers waited forever) | `321ac29ca` (+ ledger `93ec1c2fc`, ratchet `71e0d2752`) | `c47be4afa` (redirect + exec the whole launcher in all three branches) | sp-x7 |
| 2026-10-13 | m5 parity boot fields red: Nalati meshes / programs / texture bytes; Driftwood update list / collider registry / GPU bytes | to attribute | pending (sp-o106: attribute per field, re-baseline intended ones only) | sp-o106 |
| 2026-10-13 | push gate: oxlint (3 formatting / type-import issues) | `9c2ce3013` | `d8eb3af14` (385 portable pins unchanged) | sp-x8 |
| 2026-10-13 | frame floor (Sim): Nine entry layout restore spikes 150–187 ms | layout restore (all pins) | `6a4beeeca` (sliced read into Float64Array runs; bounds in slices): 86–118 ms | sp-o101 |
| 2026-10-13 | **P0 frame floor (Sim): Nine world-hook frame 1786–1831 ms** (7 MB `data/world.generated.json` parsed at module eval via `shard.config.ts` + `runtime/geometry.ts`) | `9c2ce3013` (Nine port) | candidate `20ebf8bfa` (layout to a fetched build file, sliced decode; world.generated 6.96 MB → 141 KB) landing via sp-o112 after Linux re-proof | sp-o109, sp-o112 |
| 2026-10-13 | typecheck: `test/shards/nine-dragon-stack/vertex-spill.test.ts` constructs `LayoutBake` with one argument | `9c2ce3013` | `0bf72454a` (test-only old-byte decoder) | sp-x8 |
| 2026-10-13 | clean-export `pnpm gen`: Nine `data/physics.generated.json` "committed generated output differs" | none: stale ignored output in sp-x4's reused export | not a red (fresh export from HEAD) | sp-x4 |
| 2026-10-13 | CI 38375682767 / 38375488589 build: `check-paths` requires report-only `.wildshard/product` output destinations to exist (338 pins + two writer dirs) | `f04c2a912`, `8aabadebe` | `322b90b2b` (declared output destinations distinguished; 9 refusal fixtures) | sp-x7 |
| 2026-10-13 | shared tree: 49 working-tree files and 15 index entries were stale copies of older blobs (private-index landings never refreshed them), incl. `.githooks/pre-commit` and gate scripts | private-index landings | reset to `HEAD` by wildshard-new 10:00Z (verified ancestor blobs only) | wildshard-new |
| 2026-10-13 | cold `pnpm gen`: job `pine-lookout` isolated copy lacks `generators/timberWorld.ts` (ERR_MODULE_NOT_FOUND; breaks serve-build --rev and gate gen) + undeclared output `data/timberWorld.generated.json` | `c757e98b8` | `9f78c08f8` (world job ordered before its config/physics readers; full cold isolated gen passes) | sp-x4 |
| 2026-10-13 | commit measurement on package-only commits: oxlint "No files" text fed to JSON.parse | `c28916c9e` | `cc9140838` (filter to the 8 JS/TS extensions; guard receipt / Debug policy kept) | sp-x7 |
| 2026-10-13 | push gate: SDK release export missing for `./random` | `2e3b291b5` | `f9db02909` | sp-x8 |
| 2026-10-13 | push gate: lint on an optional guard parameter | `df983a6de` | `4a3a269ad` | sp-x5 |
| 2026-10-13 | m5 parity drift: Nalati, Driftwood, Pine, Nine boot fields | intended (`195597049` G271, `f9fe9e81e`, `fbf4097b7`, `00196a4c2`, `99ecc7bcd`, `7b7dc5dc5`, `cb2a03301`, `a1dd56dd4`) | re-baselined field by field: `d20130184`, `3e1cd7f85`, `725a930f4`, `4908bd6eb`, `c899d4d01` | sp-o106 |
| 2026-10-13 | **P0: Nine fails to load in the public build** (declared worst-location 1006.43 MB > 1000 MB cap; 14.45 MB of JSON partition vertex lists in the shardfile). Prod `ad30fba68` is clean; releases held past `9c2ce3013` | `9c2ce3013` | `1b39cec67` (run-length whole-partition ordinals: 1006.18 → 990.18 MB, wire 194.7 → 180.3 MB; Developer-off Nine loads); release unpins after CI + exact smoke incl. the public Nine case | sp-o113, sp-x7 |
| 2026-10-13 | commit ratchet false ROSE on `1a8eacadc`: ratchet export lacks `scripts/guard-index-tree.mjs` (ERR_MODULE_NOT_FOUND) | `df983a6de` | `7995d89e7` (helper + declaration in the committed export; real import fixture) | sp-x5 |
| 2026-10-13 | Nine tests red at HEAD `725a930f4` (darwin): grid-admission wire cap, ledger, replay ×2 | `9c2ce3013` (fixtures not refreshed with the approved recapture: compatibility.json, ledger, grid mock; gameplay itself compatible) | `e72e25d31` | sp-x8 |
| 2026-10-13 | push gate: `test/shards/pine-hollow/pine-crags.test.ts` "Cannot destructure property 'normalAt' of 'ground'" | `d9529723b` | `01f470b53` (native heightfield queries passed explicitly; thresholds kept) | sp-x4 |
| 2026-10-13 | boot smoke never entered Nine with Developer OFF (experimental shards excluded from the public leg), so the public load failure went unseen | smoke case list | `8e9a3e96a` (public leg enters Nine Developer-off; missing Nine fails closed); release pin `9d8f3bc52` holds `ad30fba68` | sp-x7 |
