# Tooling + content pipeline audit (E357, 2026-09-30)

What breaks in `scripts/`, the tests, `src/dev/`, the content pipeline and the gates when ~450 files move into
`src/engine/`, shard code into `src/shards/<slug>/` and shared shard code into `src/kit/`, with `#engine/*`, `#kit/*`,
`#shards/*` subpath imports. Also: what the parity harness and a per-push GPU gate can be built from. Tree at
`3580db5c`; every count below was measured on it (read-only, no browser launched).

**Verdict.** The move is mechanical for `src/` and `test/`, where tsc and vitest catch every broken import. Everything
else breaks at run time only, or silently:
- `scripts/` is not typechecked (`tsconfig.json` includes `src` and `test` only). 21 scripts import game modules by
  path, and 35 name 132 distinct `src/` paths as strings.
- 14 `import.meta.glob` calls (4 in src, 10 in 8 test files) return an empty set when their folder moves. That is no
  error: the tests just pass vacuously, and `extras.ts` declares no art.
- 116 scripts drive the game through the untyped 42-field `window.__world` handle (`src/main.ts:1296`), whose
  shard-specific fields (`ocean`, `boat`, `nalati`, `pineLife`, `crossbow`, …) the normalization removes.

So the move needs three things first: a path check, a typed probe and the parity baseline. After those, a codemod
driven by one mapping table. The content pipeline already has the right pieces (packs, KTX2 sets, byte and version
tables, a content-hashed SW). But `src/boot/manifest.ts` infers each shard's files with slug branches. A node-safe
shard manifest should declare them instead.

## 1. Scripts that import `src/` (what breaks when files move)

| Coupling | Count | Examples | Fails how |
|---|---|---|---|
| Node import of game TS through `bake-loader.mjs` | 21 scripts | the bakers `bake-chunk` (13 src paths), `bake-packs`, `bake-ktx2`, `bake-navmesh` (16 modules via `src('…')`), `bake-sky`, `bake-sky-keys`; `unused-assets`; the Blender pre-steps `blender/lib/export-scene.mjs`, `driftwood-isle/export.mjs`, `pine-hollow/crags/export-cave.mjs`; `king-rig-bake/gate`, `e350-*`, `playground-cards`, `practice/verify_unimate_skin` | `ERR_MODULE_NOT_FOUND` at build time. `vite.config.ts` runs `bake-chunk`, `bake-sky`, `bake-packs` on every build, and `bake-packs` is fatal |
| Hash-input / allowlist path strings | 35 files, 132 unique paths | `check-models.mjs` (81 paths: the model contract's folder rules 1–5 and its allowlists), `blender/targets.json` `sources` (11), `bake-chunk` `shared` + `EXTRA_DEPS`, `bake-textures` `SOURCES`, `bake-cards` `inputs` | `readFileSync` throws (loud), or a staleness hash stops covering a moved file (silent) |
| Shard discovery by directory listing | 2 | `bake-chunk.mjs:39`, `bake-sky.mjs:24`: `readdirSync('src/chunks')` minus a regex of non-shard files | a new layout finds 0 shards (silent: nothing is baked) |
| Generated modules | 6 files, 4 writers | `src/boot/{bytes,versions,audio,art}.generated.ts` from `vite.config.ts` (which also reads `src/chunks/thumbs`, `src/explore/img`), `packs.generated.ts` from `bake-packs`, `gpu.generated.ts` from `bake-ktx2`. Read by `scorecard`, `unused-assets`; `.oxlintrc.json` ignores `src/boot/bytes.generated.ts` by path | writers recreate the old folder; the lint ignore goes stale |
| In-page `import('/src/…')` in Playwright | 9 scripts | `creature-rig-bake`, `nalati-rig-bake` (asset bakers named in skills), `creature-strip`, `creature-lineup`, `nalati-models-compare`, … | already broken: they need a Vite dev server, banned since E317 (`serve-build.sh` serves a build, which has no `/src/`) |
| `window.__world.*` / `__pine*` / `__nalati*` hooks | 116 scripts; 36 window hooks | `__world.player` ×112, `.game` ×88, `.weapons` ×28, `.crossbow` ×8, `.pineLife`, `.nalati`, `.cabins` | runtime `undefined` once a handle field is renamed or merged |
| Tests importing `scripts/` | 6 | 5 import `check-models.mjs`, 1 imports `ota-release.mjs` | vitest catches it |

What the move needs:
- **`bake-loader.mjs`** resolves only `.`-relative specifiers (its `resolve` hook). Node would resolve `#engine/x` from
  package.json `imports` to an extensionless path and fail. The hook needs a `#` branch that maps through the
  package.json `imports` and then does the same `.ts` / `/index.ts` probing.
- **`lint/wildshard-plugin.js:104`** returns `null` for any non-relative import. A URL-param key imported through
  `#engine/…` then becomes "a key the rule cannot read", which is an error. It needs the same `#` mapping.
- **One alias spike before the move.** Check the `imports` pattern (`"#engine/*": "./src/engine/*"` with extension
  probing, or `"./src/engine/*.ts"`) against TS 7 `moduleResolution: bundler`, Vite 8 / rolldown, vitest 5, oxlint's
  `import/no-cycle` resolver, the lint plugin and bake-loader, each with one moved file. If any of them refuses,
  fall back to tsconfig `paths` + `resolve.alias` + a loader map (three copies to keep in sync).
- **A codemod driven by one mapping table** (old path → new path). The same table rewrites:
  - imports: cross-layer ones become aliases, same-folder ones stay relative;
  - glob patterns, script path strings, `targets.json`, `check-models` rules;
  - the `vite.config.ts` outputs;
  - the path mentions in docs (1,440 in 182 files under `docs/`) and in src comments (1,511), because AGENTS.md
    says "fix the links when moving".
- **Node-safe manifests.** `bake-packs.mjs:43` fakes `globalThis.location` because modules read the tier from the URL
  at import time. `bake-navmesh` imports shard world builders (`chunks/pine-hollow/world/props.ts`, `world/Cabin.ts`,
  `world/Forest.ts`, `world/PineLandmarks.ts`, `nalati/wet.ts`) to get their colliders. Rule for anything a manifest
  reaches: no DOM, URL or tier reads at import. Static colliders come from a manifest hook the navmesh baker calls.

## 2. Scripts inventory

`scripts/` holds 185 entries: 176 files and 9 folders. That is 390 files in all: 175 `.mjs`, 102 `.py`, 58 `.json`,
30 `.sh`. The top-level files hold ~26.4k lines. The repo's history starts 09-16, so "touched in the last 7 days"
covers nearly everything and says nothing about liveness. The liveness test here is: referenced by `package.json`, a
git hook, a Claude hook, CI, `vite.config.ts`, a skill / AGENTS.md, a test or another script.

| Group | Entries | Referenced | Notes |
|---|---|---|---|
| Bake / asset build | 17 | 16 | 5 wired into `vite.config.ts` (chunk, sky, packs; cards and textures as `--check`). `bake-ktx2`, `bake-navmesh`, rig bakes by hand |
| Check / audit | 7 | 5 | `check-css` (CI), `check-model-sources` (`pnpm test`), `unused-assets` (pre-push, warn only), `check-models` (via 5 tests) |
| Infra / lane / release | 19 | 14 | lanes, `push-main`, `serve-build`, `vercel-tree-gate`, `deploy-version`, native, OTA, `debug-settings` |
| Bench / perf / memory | 20 | 16 | `bench-load` (`pnpm bench`, `bench:ci`), GPU-ms rulers (`pine-hollow-gpu`, `nine-dragon-gpu`), iPhone / Simulator memory |
| Gameplay verify (browser) | 11 | 3 | `scorecard`, `physics-baseline` + `physics-route.json`, the Nalati checks (boot, quest, raid, ragdoll, walk) |
| Test harness (browser / native) | 7 | 4 | `test:gpu-boot` = `test-facade-instancing` + `test-nine-gpu-boot` ×4 faults + the native startup test |
| Capture / board / mockup | 46 | 23 | one per look pass: `nalati-*` 22, `pine-hollow-*` 9, `playground-*` 5, `creature-*` 4 |
| One-off ask scripts `eNNN-*` | 35 | 5 | E54 to E350. 30 are named by nothing; the 5 others only by a sibling one-off |
| Other (probes, A/B, LUT) | 14 | 4 | `ktx2-ab*`, `fit-lut.py`, `palette-delta.py`, `pine-hollow-nan-scan`, `king-phases` |
| Folders | 9 | 7 | `blender/` (49 files), `music/` (62), `img2mesh/` (38), `practice/`, `horizon-matte/`, `trailer/`, `steam-trailer/` (21, unreferenced), `docs/` (unreferenced) |

**88 of 185 entries are referenced by nothing, or by docs only.** Most are finished-ask captures. Some are still used
by hand: `release-url.sh` is in the memory notes, and `pine-hollow-perf-lap` is a harness block. Delete by rule, not in
bulk: an `eNNN-*` or capture script whose ask is `done` goes; `scripts/README.md` indexes the rest by group.

### Parity-harness building blocks

| Script | Already records | Gaps for the harness |
|---|---|---|
| `scorecard.mjs` (1,177 lines) | Per shard × viewport:<br>• cold / warm bytes, requests, time to play, longest task<br>• JS heap; GPU bytes counted at the WebGL API; `renderer.info`<br>• 3 poses: fps, p95, draw calls, triangles, SSIM vs `progress/scorecard/baseline/` (36 files)<br>• the shard-switch route<br>Pins: seeded `Math.random`, midday, clear weather | `SHARDS` has 3 slugs (`:49`): no Nine Dragon. No boot fingerprint. A full run takes 32 min. Last committed run 09-26 |
| `physics-baseline.mjs` | poses at 4× CPU (per-updater ms), and the walk route per shard (`physics-route.json`, which already has 19 Nine Dragon legs), stuck count, `--video` | uses `vite preview` itself. Its walk is the golden-path walk |
| `bench-load.mjs` | bytes by type, requests, title / play s, per-step ms, long tasks, textures, programs, heap. `--ci` checks `bench.budget.json` | node-green CI never runs it |
| `nalati-boot-check.mjs` (43 lines) | boot each shard: page errors plus a screenshot | the smallest seed for the boot smoke |
| `bench-shard-switch.mjs`, `e155-shard-switch.mjs` | prefetch bytes; an in-page switch, eviction, context loss | switch route only |
| `test-facade-instancing.mjs`, `test-nine-gpu-boot.mjs` | multi-draw routing; the GPU boot fault panel ×4 faults (context, precision, shader, texture) | `test-nine-gpu-boot.sh` runs `pnpm build` **in the working tree** on a fixed `--strictPort 4184` |
| `pine-hollow-perf-lap.mjs` | the perf lap, plus a before / after diff of every localStorage key (a save-safety check) | Pine Hollow only |
| `nine-dragon-gpu.mjs`, `pine-hollow-gpu.mjs` | GPU ms per pose, by subtraction | ms: nightly / info only, never a gate |

## 3. Tests

There are 115 vitest files (113 in `test/`, 2 in `api-tests/`), all in node. None runs `bootstrap()`, `Game` or a
shard. By subject: gameplay 24, models / rigs 18, world / UI / audio / core 17, boot / PWA / ops 16, Pine Hollow 14,
physics 14, Nalati 6, Nine Dragon 5, other 1.

Direct-import coverage (the src files some test imports) by folder:

| Folder | Covered | Folder | Covered |
|---|---|---|---|
| `physics` | 89 % of lines | `player` | 28 % |
| `models` | 86 % | `ui` | 26 % |
| `boot` | 84 % | `core` | 25 % |
| `world`, `game` | 52 % | `nalati` | 10 % |
| `chunks` | 33 % | `dev`, `shard`, `fx` | 0 |

Engine areas with no coverage:

| Area | Files covered | Untested |
|---|---|---|
| Loop | 0 of 4 | `core/Game.ts`, `fixedStep.ts`, `time.ts`, `bootstrap.ts` |
| Events | — | there is no event bus to test |
| Weapons | 2 of 11 (only Crossbow and LeverRifle helpers) | `Sword`, `Bow`, `Longbow`, `Rifle`, `Spear`, `Weapons`, `meleeGeo` |
| AI | 3 of 8 | `Animal.ts`, `eliteBrain.ts`, `game/Boss.ts`, `game/Elite.ts` |
| Quests | 18 of 29 | better covered. Gaps: `Spine`, `Finale`, `Feats`, Pine Hollow's `nightThralls`, `rides`, `stagLead` |
| Saves | 1 of 4 | `loot/store.ts`, `native/saves.ts`, `BootSettings.ts`. 42 src files touch `localStorage` by hand |

Moving with the code:
- **28 test files import shard code directly** and go to `test/shards/<slug>/`:
  - Pine Hollow 14: `pine-*`, `token-shelf`, `models-pine-hollow`;
  - Nalati 5: `nalati-*`, `quest-nalati`;
  - Driftwood 5: `models-driftwood`, `models-contract`, and `fight-rules`, `hit-damage`, `loot`. The last three are
    engine tests that use Driftwood as their fixture: point them at the template shard instead of moving them;
  - Nine Dragon 3: `bag-tabs`, `nd-specimen-light`, `nine-dragon-models`;
  - one spans every shard: `models-rosters`.
- 11 more reach every shard through `chunks/registry`.
- **12 files read files by path**: 8 through `import.meta.glob`, 3 through `?raw` imports, 1 through `readFileSync`.
  For example, `models-driftwood` and `models-pine-hollow` glob `../src/main.ts` + `../src/world/*.ts`, and
  `facade-no-multidraw` globs `../src/chunks/nine-dragon-stack/**`. After the move the globs match nothing, and their
  "no X in the source" assertions pass on an empty set. Each needs a non-empty assert, or should become a contract
  test.

## 4. `src/dev/` and the harness pages

- **Size.** `src/dev/` has 37 files and 6,590 lines: 19 page scripts and `threeKit.ts`, plus `nd-lab/` (17 files,
  4,771 lines, the Nine Dragon clean-room copies). Behind them are 20 pages in `dev/*.html`.
- **All 20 pages are dead.** `vite.config.ts` has no `rollupOptions.input`, so `vite build` emits `index.html` only;
  E317 (29 Sep) banned the Vite dev server, their only host; no game file imports `src/dev/`. Their commits since
  09-26 are other refactors keeping them compiling; the last real use was E169's labs, 09-25/26.
- **Only scripts use them.** 6 scripts import `/src/dev/threeKit.ts` in the page, and they need a dev server too.
- **What refers to the folder.** The `src/dev/**` override in `.oxlintrc.json`, the dev-only exemptions in
  `check-models.mjs` and `unused-assets.mjs`, and the Blender target `nine-dragon-stack/fei-zhua`, whose GLB only the
  lab page loads.
- **Careful.** The shipped shard still loads from `public/assets/nine-dragon/lab/` (`def.ts:29-32`, `world/jian.ts:103`,
  `world/canopy.ts:524`, `world/build.ts:413`). Delete the code, not that folder. Only `lab/grapple/fei-zhua.glb` and
  `lab/grade-lut*.bin` are lab-only.

## 5. Content pipeline per shard

| | Driftwood Isle | Pine Hollow | Nalati Grasslands | Nine Dragon Stack |
|---|---|---|---|---|
| In `CHUNKS` | yes | yes | yes | **no: `PROTOTYPES`** (`registry.ts`), so no pack, no prefetch, no every-shard tests |
| `baked/<slug>/` | terrain 516 K, navmesh 164 K, sky, textures | terrain 528 K, navmesh 168 K, sky, cards | terrain 528 K, navmesh 264 K, sky | none (structure-first) |
| Boot pack (phone only: `TIERS = ['phone']`) | 1 part, 0.5 MB | 8 parts (~18 MB) | 2 parts | none |
| Own public folder | none: `models/driftwood-*`, `horizon/`, base audio | `pine-hollow/` 12 MB + `models/pine-hollow-*` | `nalati/` 28 MB | `nine-dragon/` 14 MB (`lab/`, `viewmodel/`, `paint/`) |
| KTX2 (`gpu/`, 204 MB) | `gpu/models`, `gpu/baked` | `gpu/pine-hollow` 17 MB | `gpu/nalati` 42 MB | `gpu/nine-dragon` 18 MB (hard-coded folders, `bake-ktx2.mjs:231`); on phone forced to images (E248) |
| Music / SFX | `music/{folk,orchestral,piano}`, `sfx/best` | `music/pine-hollow-*` ×3, `sfx/pine-hollow` | `music/nalati` 6 MB; 51 `sfx/best` entries tagged `shard: 'nalati'` | none of its own |
| Blender targets (11) | `island`, `fp-arms` | 7 (area-export, trees, crags, crags-b, cave, lever-rifle, skinning-knife) | 0 | `fei-zhua` (lab only), `fp-rig` (manual) |
| `art/` | `driftwood-isle/` + ~30 cross-shard subject folders (1.3 GB in all) | `pine-hollow/` | `nalati-grasslands/` | `nine-dragon-stack/` |

How a shard's files are known today:
- **Files.** `src/boot/manifest.ts` `chunkFiles(def)` infers them from `ChunkDef` fields with shard branches:
  `def.slug === 'pine-hollow'` (sky keys, hero props, rigged hulls), a hand-kept Nalati list (`painterlyBoot()`,
  20 GLBs), and `ocean` / `painterly` / `structures` for "no cabins or props". Nine Dragon already declares its own
  files (`def.structures.files`): that is the model to follow.
- **Art and audio.** `extras.ts` adds the art and every audio file.
- **Offline.** The service worker precaches every hashed emitted file at install (`vite/pwa-plugin.ts`, `hashed`).
  That includes Nine Dragon's lazy 373 KB chunk: **lazy shard code saves parse time and memory, not download**.
  Shard assets are cached as the boot fetches them (cache-first on `?v=`).
- **Explore bug.** `extras.ts:57,118,149` preload Explore's art and code only when `def.ocean`, so three shards miss it
  offline.
- **unused-assets.** It reports 171 MB of shipped KTX2 (`/assets/gpu/**`) as "dev-only", because `gpu.generated.ts` is
  the only thing that names those files.

**Can a shard directory own its manifest?** Yes, as a node-safe `src/shards/<slug>/manifest.ts` that the game, the
bakers and the checks all import. It would declare: slug and status (`released` / `experimental`, replacing the
separate `PROTOTYPES` list); the lazy code entry; the terrain / sky / tree specs the bakers read, the navmesh agent
classes and a static-collider hook; per tier, the boot files (feeding packs, the download bar and the offline list),
the KTX2 set and the precompile material list; the music and SFX sets, Blender target ids and art thumbs; and the
budgets (draw calls, tris, programs, GPU MB, load s: MW5).

What moves: the slug branches of `manifest.ts`, `extras.ts`, `bake-navmesh.mjs` and `bake-ktx2.mjs` become data.
`scripts/blender/<shard>/` and `art/<shard>/` already follow the shard layout.

**`public/assets` should not move in E357.** Its URLs are versioned by content (`?v=`, content-named packs) and cached
by the service worker. A path change re-downloads every moved byte for every player, and it rewrites the KTX2 and pack
names. The manifest points at today's URLs. A physical per-shard re-layout is a later, separate row.

## 6. CI and gate timings

- **Push CI** (`deploy.yml`, ubuntu). Median wall time 2.5 min over 29 green runs (1.5–9.8), including the queue. The
  job's own ~1.6 min: checkout 38 s, test 24 s, web build 11 s, lint 8 s, native build 6 s, typecheck 2 s. A release
  run adds `vercel build` + deploy. Nothing GPU-side runs.
- **Pre-push gate** (`vercel-tree-gate.sh`, M5 Max; medians from session logs): vite-build 3 s (max 9), vitest 2 s
  (max 7), oxlint 2 s, typecheck 1 s. About 10 s in all, plus the checkout-index, then `unused-assets` as a warning.
- **Slow rulers.** A full scorecard run takes 32 min (`docs/design/scorecard.md`). Cold time-to-play on the phone tier
  is 6.9 s (Driftwood), 9.3 s (Nalati) and 10.5 s (Pine Hollow); Pine Hollow desktop takes 27.5 s.

A ≤ 5 min GPU gate fits on the phone tier: build ~15 s; per shard about 11 s to boot, 2 s of fingerprint, a 10 s walk,
a swing and a shot, and 3 poses (~40 s); 4 shards ≈ 3–3.5 min. Desktop, the soak and the full scorecard run nightly.

**Where it runs:** on the Mac, not in Actions, and not as a self-hosted runner: the repo is **public**, so fork PRs
would run code on the Mac. `push-main.sh` starts `scripts/gpu-gate.sh <sha>` detached after a push, with a launchd
poller of `origin/main` as the backstop. The gate posts `gh api repos/Raynos/project-wildshard-singleplayer/statuses/<sha>`
with the context `gpu-gate`. `deploy.yml` (through `deploy-version.mjs`) then checks out the newest `main` SHA whose
`gpu-gate` is green, not HEAD.

What must be true:
1. **A clean export.** `git archive <sha>` plus a `node_modules` symlink, as `vercel-tree-gate.sh` does. Never
   `test:gpu-boot`'s working-tree `pnpm build`.
2. **A free port and one browser-lane slot** (`browser-lane.sh --max 8`), with `--mute-audio` and
   `--use-angle=metal`, under `caffeinate`.
3. **Counts, not ms.** Gate on the fingerprint, errors, stuck, hits, draw calls, programs and GPU bytes. The M5's GPU
   is shared with the MiniMax / TRELLIS / Qwen jobs under the model lock, so frame ms is information only.
4. **Pinned rng, time and weather** (scorecard's pins), and a committed baseline that only a wave's board re-blesses.
5. **Every shard**, Nine Dragon included (it is outside `CHUNKS` today).
6. **A flake rule.** Re-run once, red on the second failure, and keep a quarantine list with owners (MW3).
7. **Jake's call:** what the hourly deploy does when the Mac is asleep and no status arrives. Hold, or ship node-green
   with a warning.

## 7. Plan rows

Tags: **[pre]** before the first file moves · **[move]** during the waves · **[post]** after. Sizes: S ≤ ½ day,
M ≤ 2 days, L more.

| Row | Tag | Size | What | Done when |
|---|---|---|---|---|
| TP1 | pre | S | **Alias spike**: the `#engine/*`, `#kit/*`, `#shards/*` pattern in package.json `imports`, checked against tsc 7, Vite 8, vitest 5, oxlint `import/no-cycle`, the lint plugin and bake-loader | one file per alias is imported from src, test and a baker, and all 5 gates are green |
| TP2 | pre | S | A `#` branch in `bake-loader.mjs` and in `lint/wildshard-plugin.js` import resolution | a baker and a URL-param key both resolve through `#engine/…` |
| TP3 | pre | S | **`scripts/check-paths.mjs` in `pnpm test`**: every `src/` path string in scripts, `targets.json`, `vite.config.ts` and `.oxlintrc.json` resolves, and every `import.meta.glob` in src/test matches ≥ 1 file | planting a bad path fails `pnpm test` |
| TP4 | pre | S | **A typed probe** `window.__wildshard` (`fingerprint()`, `teleport()`, `walk()`, `swing()`, `shoot()`, `events`), plus a `.d.ts` for scripts. `__world` stays as a deprecated alias | the parity harness uses only the probe |
| TP5 | pre | M | **Parity harness v1** `scripts/parity.mjs` (MW1), assembled from `scorecard` (poses, SSIM, GPU bytes, pins), `physics-baseline` (route walk), `nalati-boot-check` (errors), `bench-load` (steps, programs), `test-facade-instancing` and the perf lap's save diff, over 4 shards × 2 tiers. Baseline recorded on the pre-move tree | a planted one-line regression per wave area fails it |
| TP6 | pre | M | **GPU gate** `scripts/gpu-gate.sh` plus a commit status, and `deploy.yml` deploying the newest gpu-green SHA (MW3). Section 6's seven conditions | a broken shard boot never deploys; the gate runs in ≤ 5 min |
| TP7 | move | M | **Move codemod** `scripts/normalize/move.mjs` from one mapping table: `git mv`, imports (cross-layer to aliases), globs, script strings, `targets.json`, `check-models` paths, generated-file outputs, doc and comment links | a wave's move is one idempotent commit; TP3 and the gates are green |
| TP8 | move | M | **Node-safe `src/shards/<slug>/manifest.ts`** read by the game and the bakers. Shards discovered from `#shards/*/manifest`, not `readdirSync`. Status replaces `PROTOTYPES`. No URL, tier or DOM reads at import | `bake-*`, `unused-assets` and the harness iterate all 4 shards; the `globalThis.location` fake is gone |
| TP9 | move | M | **The shard declares its assets**. The slug branches of `boot/manifest.ts` and `extras.ts` become manifest data. Packs, the download bar, the offline list and the asset audit derive from it. Explore becomes a declared engine feature, which fixes the `def.ocean` preload bug | `manifest.ts` has 0 slug / style branches, and each shard boots offline with Explore |
| TP10 | move | S | `check-models.mjs` folder rules re-pointed to `engine/`, `kit/` and `shards/<slug>/models`, and generalised into `wildshard/layer` (shard ↛ shard, kit ↛ shard, engine ↛ kit / shard) with a ratchet (MW2) | the 81 allowlisted paths are re-mapped; the layer counts are in CI |
| TP11 | move | S | **The tests move with the code**: 28 to `test/shards/<slug>/`. The 12 source-scanning tests get a non-empty assert or become contract tests | no vacuous pass: every glob asserts a non-empty set |
| TP12 | move | S | **Generated files** to `src/engine/boot/`: the 4 `vite.config.ts` outputs, the `bake-packs` and `bake-ktx2` outputs, the lint ignore, the scorecard and unused-assets readers. The art module reads `src/shards/*/thumbs` | a clean build rewrites them in place; `git status` stays clean |
| TP13 | move | S | **Delete `src/dev/` + `dev/*.html`** (6,590 lines): the `.oxlintrc` override, the dev exemptions, the `fei-zhua` target and its GLB. Keep `public/assets/nine-dragon/lab/` | no `src/dev`; the build and the harness are unchanged |
| TP14 | move | S | **SW precache per shard**: decide whether lazy shard chunks stay precached at install (offline-safe, today's behaviour) or precache on the shard's first play | the decision is written in `docs/design/cache-policy.md`, with an offline boot per shard |
| TP15 | move | M | **Actor-test layer** (MW4): a fake `Game` for the loop, weapons (the archetypes), strike timing, AI, bosses and the save store, which have 0–2 tests each today | each wave lands with its engine tests |
| TP16 | post | S | **Script cleanup**: the eNNN / capture scripts of `done` asks deleted, `scripts/README.md` indexing the rest, and the 9 dev-server-only scripts ported (`creature-rig-bake`, `nalati-rig-bake` first) or deleted | 0 scripts import `/src/` in the page; every live script is indexed |
| TP17 | post | S | `unused-assets` counts `gpu.generated.ts` as a reference; folded into the MW17 asset audit | the 171 MB of KTX2 is no longer "dev-only" |
| TP18 | post | L | Optional per-shard `public/assets/<slug>/` re-layout, with a one-time re-download budget; Jake's call | — |

Order: TP1–TP4 (a day), then TP5 + TP6 (the baseline has to exist before the first move), then TP7–TP15 per wave in
the E357 order (Nine Dragon → Pine Hollow → Nalati → Driftwood). TP16 and TP17 come after the last wave.
