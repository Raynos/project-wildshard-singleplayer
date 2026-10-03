# Plan: ARCH-GUARDS — static analysis that holds the engine / game / kit / shard split (E362)

**State:** `in progress` 2026-10-03 — built: batch 1 (897baa67), AG8, AG23–AG27, AG2 (the `layer` split) and AG28 (via LAYER-PURITY, archived: `layer`, `engine-words`, `shard-names` hard at 0). Open: batch 2's AG3, AG4, AG7, AG10, AG18 (E379); LAYER-PURITY's leftovers E414–E417

## Summary

GAME-NORMALIZATION split the code into `src/engine` (#engine), `src/game` (#game), `src/kit` (#kit) and
`src/shards/<slug>` (lazy plugins). The guards that hold that split today are 16 custom oxlint rules, a per-file
ratchet and a handful of node checks. They work, but:

- **Nothing runs at commit time.** `.githooks/pre-commit` only checks image sizes and `.blend` files. The layer rules
  run in `pnpm test`, in the pre-push gate and as a post-commit *advisory* (it cannot refuse).
- **The anti-branch rules match words, not meaning.** A shard branch that is renamed passes. The real case:
  `getActiveChunk().style === 'toon'` (caught) became `activeLevel().kitLook === 'toon'` (not caught) in 875b82f6
  (B66). The X1 input move turned `addEventListener('keydown')` into `listenDom(scope, window, 'pointermove')`, and
  `no-raw-input` fell from 137 to 10 while 31 window/document input listeners remain.
- **The ratchet only refuses rises, so cleaned files keep their old allowance.** At HEAD, 28 files that reached 0 raw
  input listeners still allow 127 between them.
- **New shards are invisible to the word lists.** `lint/engine-words.json` is hand-kept. `level.id === 'emberfall'`,
  `case 'emberfall':` and `{ emberfall: 1 }` pass every rule in every layer today. Z3 adds two new shards.

The checks are fast. tsc 7 type-checks the whole app in 0.9 s, the custom rules lint all of `src/` in 1.1 s and a
whole-src import graph takes 1.0 s. So most of what follows costs **0 s extra** (new visitors in the same oxlint
pass), and a staged-files pre-commit runner fits in **~0.2–1.5 s**.

The recommended first batch is 8 levers, ordered at the end. Every lever ships under the existing ratchet: today's
count per file, never a blanket disable, and hard error once it reaches 0.

---

## Status (2026-10-03, E405 review)

Jake answered P1 on 10-01 (00d5f6bd0): build the first batch, then the second. Batch 1 is built (897baa67, ratchet
data 68fbb592) and so is AG8 (e94b842d). Each lever table below has a Status column. All 22 leak probes in 1.4 are
caught at HEAD 3802308b7. The review's 25 new probes found six holes, H1–H6. They are rows AG23–AG27 in 2.9.

| Hole | What passes today | Row |
|---|---|---|
| H1 | A new `src/<dir>/` has no layer: its deep imports, shard-plugin imports and engine → it all pass (`layerOf` maps only `src/*.ts` to `app`) | AG23 |
| H2 | Dead exemptions: `no-shard-branch` skips `src/chunks/…`, `src/nalati/`, `src/pinehollow/`; `no-raw-input` exempts `src/core/input/`; `TIME_ALLOW` lists `src/core/…` and `src/boot/…` | AG24 |
| H3 | `no-level-identity` evasions: `const { kitLook } = activeLevel()`, `const look = level.kitLook`, `current.kitLook` (a receiver it doesn't know), `=== TOON` (a const), `['toon','pbr'].includes(level.kitLook)`, `new Map(…).get(level.id)`, `/^pine/.test(level.id)` | AG25 |
| H4 | `shard-sandbox` misses page-level `document` reach (`document.body.style.cursor = …`) and bare window globals (`innerWidth`, `navigator`) | AG26 |
| H5 | 19 window / document input listeners through helpers in the engine (explore 17, ui 2) | AG18 |
| H6 | `import('../game/' + 'index')`: a string-concat specifier passes `layer` | AG27 |
| AG28 | **built** via [LAYER-PURITY](../../project/archive/2026-10-03-layer-purity.md): `layer`, `engine-words` and `shard-names` hard at 0; leftovers E414–E417 | **Evict shard knowledge from the engine** | The engine's ~310 real shard sites at 10-03: 21 upward imports (17 into `#game`, mostly `#game/shard/manifest`; `Grass.ts` → `#kit`; `Explore.ts` → a Nalati webp; `native/boot.ts` → `main` / `pageServices`) and 289 shard content words in 58 files (Pine's species `elk.ts` / `deer.ts` / `AnimalManager`, Driftwood's sailor / crab / monkey / doubloon, `icons.ts` 42, `audio/gen.ts` 18, `Menu.ts` 16) | A sweep, one engine area per commit: the upward imports become data the game hands in, then species, loot / icons, audio. Content moves into its shard, or into `#kit` when two shards share it. With AG2's split, `layer-direction` and `engine-code-words` go hard at 0. Comment words (1,428) leave the count | 0 s | PC, PP, CI | 310 → 0, then hard | low | **yes** (Jake, 10-03) |

Ratchet at 10-03 (vs 1.3's 10-01 numbers): `layer` 2,762; `no-raw-input` and `no-global-listener-patch` reached 0
and are hard errors; `no-raw-random-time` 215; `no-active-singleton` 47; `no-hook-chain` 18; `no-renderer-type` 5;
`shard-sandbox` 88 (was 95 when it landed); `no-level-identity` 4 (`Hands.ts`, `HorizonMatte.ts` ×2, `probe.ts`).
Debug rows max 24. `node lint/ratchet.mjs` takes 2.6 s and `scripts/check-shards.mjs` 0.08 s; both pass.

---

## 1. Audit: what exists

### 1.1 The guards

| Guard | Where | What it checks | Runs in |
|---|---|---|---|
| `wildshard/layer` | `lint/wildshard-plugin.js:293-330` | Import direction (engine < game < kit < shards), no shard → shard, cross-layer `#x/deep` imports banned except `#engine/data`, the engine word list (`lint/engine-words.json`, 37 words) in identifiers, strings and comments | ratchet only |
| `wildshard/no-shard-branch` | `:332-383` | Outside `src/shards/`: `isOcean` / `isNalati` / … identifiers, `nalatiNow()` / `isStylized()` calls, `slug ===` / `style ===`, the 4 slugs as comparison operands or `case` labels, `.structures/.weapon/.style/.ocean` on `chunk/def/manifest/getActiveChunk()` | ratchet only |
| `wildshard/no-raw-save` | `:385-388` | `localStorage` / `sessionStorage` outside engine/saves and native | ratchet only |
| `wildshard/no-raw-random-time` | `:389-405` | `Math.random`, `performance.now` outside rng/clock (+ a measurement allowlist with reasons in `ratchet.json` `allow`) | ratchet only |
| `wildshard/no-raw-input` | `:406-410` | `addEventListener('<input event>')` outside `engine/input` | ratchet only |
| `wildshard/no-renderer-type` | `:411-414` | `WebGLRenderer` outside `engine/render` | ratchet only |
| `wildshard/no-raw-shader-patch` | `:415-422` | `onBeforeCompile` / `customProgramCacheKey` assignment outside `engine/render` | ratchet only |
| `wildshard/sim-no-render` | `:423-447` | `engine/{combat,ai,saves,quests,effects}` importing three beyond math, visual modules or DOM globals | ratchet only |
| `wildshard/no-hook-chain` | `:449-454` | `const prev = x.onFoo` hook chaining | ratchet only |
| `wildshard/no-active-singleton` | `:455-458` | `activeRegistry()` / `activePhysics()` / … calls | ratchet only |
| `wildshard/no-active-chunk` | `:459-462` | `getActiveChunk()` outside `game/shard` | ratchet only |
| `wildshard/no-global-listener-patch` | `:464-481` | `addEventListener` / `setTimeout` / `setInterval` / rAF / `document.body.append` outside `engine/app` | ratchet only |
| `wildshard/no-raw-animation-mixer` | `:483-499` | `new AnimationMixer` outside `engine/anim` | ratchet only |
| `wildshard/no-inline-ui-string` | `:501-517` | Player-facing literals in engine | `.oxlintrc.json` (hard) + ratchet |
| `wildshard/no-raw-hud` | `:519-550` | Appending to `#hud` / `document.body` outside `hudSlots.ts` | ratchet only |
| `wildshard/no-url-switch` | `:137-262` | Query params against `lint/url-params.json` | `.oxlintrc.json` (hard) |
| Stock oxlint | `.oxlintrc.json` | Every category at error, type-aware, `import/no-cycle` (ignoreTypes) | `pnpm lint`, pre-push, CI |
| Ratchet | `lint/ratchet.mjs`, `lint/ratchet.json`, `.oxlintrc.ratchet.json` | Per rule, per file count may not rise; Debug row count (max 25) | `pnpm test`, pre-push, post-commit (advisory) |
| tsc | `tsconfig.json` (src + test, one program), `scripts/tsconfig.json`, `api/tsconfig.json` | Strict types. **No per-layer projects**: one program sees everything | `pnpm typecheck`, pre-push, CI |
| `package.json` `imports` | `#engine`, `#engine/*`, `#game`, `#game/*`, `#kit`, `#kit/*`, `#shards/*` | The wildcard rows make every deep module resolvable from anywhere. No `exports` map | — |
| `scripts/gen-shards.mjs` | folder discovery → `shards.generated.ts`, `manifest-closure.generated.json` | The only shard list; `--check` | `pnpm gen`, pre-push |
| `scripts/check-chunks.mjs` | X3 | No shard module in the cold-boot chunk set; one `shard-<slug>` chunk per shard | **nowhere** (`pnpm check:chunks` by hand; X3 leftover, chunk groups blocked on B69) |
| `scripts/check-paths.mjs` | F1 | Stale tooling paths and `import.meta.glob` patterns | `pnpm test` |
| `scripts/check-model-sources.mjs` | M10 | Blender GLB ↔ script | `pnpm test` |
| `scripts/check-lock.mjs` | `.githooks/commit-msg` | The E357 lock and reopened-shard allowlists (`.github/lock.json`, `reopened: {}` today) | every commit |
| `test/manifests-node-safe.test.ts` | vitest | Manifests import in bare node (no window / document) | `pnpm test` |
| `test/alias.test.ts` | vitest | The `imports` map resolves in vitest, the baker loader and the lint resolver | `pnpm test` |
| `test/lint-ratchet.test.ts` | vitest | The ratchet script itself | `pnpm test` |

The hooks: `pre-commit` = progress image ≤ 500 KB and no `.blend`. `commit-msg` = the lock. `post-commit` = sweep-guard
ledger + the ratchet on a HEAD export, advisory, ~3 s. `pre-push` = `scripts/vercel-tree-gate.sh` (check-css, gen,
gen-shards `--check`, three tsc programs, oxlint, ratchet, liveness, vitest, vite build) on main only.

### 1.2 Measured cost

Measured on a `git archive HEAD` export (3dbb1dbc), M5 Max, with load average ~25 from other agents, so read these as
upper bounds. The export was deleted afterwards.

| Command | Wall time |
|---|---|
| `tsc --noEmit -p .` (TS 7.0.2) | **0.9 s** |
| `tsc --noEmit -p scripts` / `-p api` | 1.2 s / 0.1 s |
| `oxlint` whole tree, type-aware, all rules | **6.3 s** |
| `oxlint -c .oxlintrc.ratchet.json src` (the 15 custom rules only) | **1.1 s** |
| `node lint/ratchet.mjs` (the above + Debug-row parse + compare) | 3.6 s |
| `oxlint` on 5 files: type-aware / custom rules only / `--type-aware=false` | 0.4 s / 0.1 s / 0.03 s |
| `node scripts/gen.mjs` / `gen-shards.mjs --check` | 4.7 s / 1.0 s |
| `check-paths` / `check-css` / `check-model-sources` / `audit-assets` | 0.3 / 0.15 / 0.24 / 0.8 s |
| Whole-src import graph prototype (vite `parseSync`, 1,118 files, Tarjan SCC) | **1.0 s** |
| Engine-only composite TS project (`composite`, `include: src/engine`) | 2.2 s |

### 1.3 Ratchet state at HEAD (2026-10-01; today's numbers are under Status)

| Rule | Baseline in `ratchet.json` | Now | Slack (allowance in files below baseline) |
|---|---|---|---|
| `layer` | 2,875 | 2,844 | 31 in 4 files |
| ↳ engine comment words | | 1,512 | |
| ↳ deep cross-layer imports (shards 945, game 40, kit 12) | | 997 | 118 distinct targets; the top 20 cover 718 |
| ↳ engine code words | | 312 | |
| ↳ engine → game / kit / shards imports | | 21 / 1 / 1 | |
| `no-global-listener-patch` | 439 | 146 | **293 in 44 files (42 files at 0)** |
| `no-raw-input` | 137 | 10 | **127 in 28 files (28 at 0)** |
| `no-raw-random-time` | 219 | 215 | 4 |
| `no-active-singleton` | 47 | 47 | 0 |
| `no-hook-chain` | 18 | 18 | 0 |
| `no-renderer-type` | 5 | 5 | 0 |
| `no-shard-branch`, `no-raw-save`, `no-raw-shader-patch`, `sim-no-render`, `no-active-chunk`, `no-raw-hud`, `no-raw-animation-mixer`, `no-inline-ui-string` | absent (= 0) | **0** | — |

### 1.4 Leak probes

Throwaway files in the export, run through the custom rules and the full oxlint config.

| # | Probe (file) | Caught? | By |
|---|---|---|---|
| L1 | engine → `../game/index` (relative) | yes | `layer` direction |
| L2 | engine → ``import(`../shards/${s}/plugin.ts`)`` | **no** | — (a template literal has no static string) |
| L3 | engine → `import.meta.glob('../shards/*/manifest.ts')` | **no** | — |
| L4 | engine: `level.kitLook === 'toon'` (B66, live in `src/engine/player/Hands.ts:130`) | **no** | — |
| L5 | engine: `level.id === 'shard5'`, `switch (level.id) { case 'emberfall': }`, `level.id.startsWith('pin')` | **no** | — |
| L6 | engine: `BY[level.id]` with `{ emberfall: 1 }` (live: `HorizonMatte.ts:59` `STRIPS[level.id]`, `debug/probe.ts:333` `SHARD_KEYS[…level.id]`) | only when a key is an existing slug, only in engine, only as a word | `layer` words |
| L7 | engine: `level.tags.includes('ocean')` | **no** | — |
| L8 | game → `../engine/world/Sky` (relative deep import) | **no** | — (the public-index check only looks at `#` specifiers) |
| L9 | game: `{ 'pine-hollow': 1, 'nalati-grasslands': 2 }[manifest.slug]` | **no** | — (the word list is engine-only) |
| L10 | game: `manifest.slug.includes('pine')`, `manifest.kitLook === 'toon'` | **no** | — |
| L11 | game: `manifest.slug === 'pine-hollow' ? 1 : 0` | yes | `no-shard-branch` |
| L12 | game: `(window as …)['__ndRender']` | **no** | — |
| L13 | game → `import('#shards/pine-hollow/plugin')` | yes | `layer` |
| L14 | kit → `#game/shard/shards.generated`, kit → `../shards/…`, `m.slug === 'pine-hollow'` | yes | `layer`, `no-shard-branch` |
| L15 | shard → `../pine-hollow/zz`, shard → `#shards/pine-hollow/zz` | yes | `layer` |
| L16 | shard → `#engine/world/Heightfield`, shard → `#game/shard/shards.generated` | yes | `layer` public index |
| L17 | shard → `../../engine/world/Sky` (relative deep) | **no** | — |
| L18 | shard: `(window as …)['__nalati'] = 1`, `globalThis.document.title` (live: `nalati-grasslands/adventure.ts:261` `Object.assign(window, { __nalatiQuest })`) | **no** | — |
| L19 | shard: `getActiveChunk()`, `activePhysics()`, `localStorage`, `setTimeout`, `addEventListener('keydown')` | yes | the matching rules |
| L20 | shard: `scope.listen(window, 'keydown', …)` (live: `nalati-grasslands/combat/goldenKing.ts:701-704`) | **no** | — (`no-raw-input` only matches `addEventListener`) |
| L21 | shard: writing a property on `import * as E from '#engine'` through a cast | **no** | — |
| L22 | `src/zzprobe.ts` (outside the 4 layers) → any deep path | **no** | — (`src/*.ts` has no layer; `engine/native/boot.ts` imports `src/main.ts` and `src/pageServices.ts`) |

Also found:
- The stock oxlint run (`pnpm lint`, editors) does **not** run the layer rules. Only `no-url-switch` and
  `no-inline-ui-string` are on in `.oxlintrc.json`. Everything else exists only inside `lint/ratchet.mjs`.
- `import/no-cycle` keeps module-level runtime cycles at **0** (graph prototype agrees).
- Shard folders differ: the four share only `audio boot explore look models thumbs weapons world` + `manifest.ts
  plugin.ts roster.ts budgets.ts budgetCeilings.ts ktx2.generated.ts`. Quest is `quest/` in Driftwood and Pine,
  `quest.ts` in Nalati, absent in Nine Dragon. Nalati has ~20 loose top-level files. Pine has `dev/` and `debug/`.
  No shard has a README.
- No shard borrows another shard's assets today (0 hits). 22 shard-named `/assets/…` paths sit in engine / game / kit.
- An engine-only composite TS project finds 7 engine files that reach outside the engine: `boot/extras.ts` →
  `game/shard/art.generated.ts`, `native/boot.ts` → `src/main.ts` + `src/pageServices.ts`,
  `render/desktopReference.ts` → `budgets/desktop-reference.json`, `ui/HUD.ts` → `game/titleDeck.ts`,
  `ui/mapShapes.ts` → `game/shard/manifest.ts`, `ui/Menu.ts` → `game/Progress.ts`.

---

## 2. Proposals

Costs are **extra** seconds on top of today's gates. "0 s" means a new visitor in the existing oxlint pass.
"Where": PC = pre-commit (your paths only), PP = pre-push gate (clean export), CI = `deploy.yml`.

### 2.1 Layer and privacy boundaries

| Id | Status | Rule | Catches | Mechanism | Cost | Where | Adoption | FP risk | Rec |
|---|---|---|---|---|---|---|---|---|---|
| AG1 | built 897baa67 | **Close the `layer` holes** | L2, L3, L8, L17, L22 | `wildshard/layer`: (a) the public-index check also applies to relative specifiers (it already resolves them with `modulePath`); (b) `src/*.ts` (`entry`, `main`, `pageServices`) become an `app` layer above shards that nothing but `entry` imports; (c) `import.meta.glob` patterns and template-literal `import()` prefixes resolve to a layer and obey direction | 0 s | PC, PP, CI | (a) and (c) are at 0 today → hard error. (b) ratchet the 2 `engine/native/boot.ts` sites | low | **yes** |
| AG2 | built ea431ea6 (E405) | **Split `layer` into three rules** | A new engine → game import hiding inside a file whose 40 comment words dropped by one | `layer-direction` (23 sites), `public-index` (997), `engine-words` (code 312 + comments 1,512). Optionally `engine-words-comments` as its own rule so code hits stay visible | 0 s | PC, PP, CI | `ratchet.mjs --add-rule` per new name, delete the `layer` section | none | **yes** |
| AG3 | open (E379), after the shard agents idle | **Pay down deep imports into the indexes** | 997 deep `#engine/<dir>/x` imports (shards 945): `models/model` 183 fan-in, `world/Sky` 103, `world/registry` 96, `Heightfield` 77, `core/tier` 72, `core/rng` 67, `core/config` 64 | A sweep, not a rule: re-export the top 20 targets (718 sites) from `#engine` / `#game` / `#kit`, codemod the imports. One public surface per layer, no sanctioned sub-entries besides `#engine/data` | 0 s | — | `public-index` count drops ~1,000 → ~280; `--update` | none | yes (batch 2) |
| AG4 | open (E379) | **Layered TS project references** | Any engine → upper reach, in any syntax (relative, alias, type-only, `declare module`, json), in the editor as well | `tsconfig.engine.json` (`composite`, `include: src/engine`, `emitDeclarationOnly` to a temp dir). Then game → engine, kit → game + engine, shards → all three. TS6307 ("not listed within the file list of project") is the refusal | engine alone 2.2 s measured; all four via `tsc -b` est. 5–8 s | PP, CI | Engine first, after the 7 files in 1.4 move. The root `tsconfig.json` stays for tests | low | yes (batch 2) |
| AG5 | later | **Drop the `#engine/*` wildcard** | Deep imports become unresolvable for TS, Vite and node, no lint needed | `package.json` `imports`: keep `#engine` + `#engine/data`; tests (740 deep imports) get a vitest-only `#engine-internal/*` alias | 0 s | everywhere | Only after AG3 reaches ~0 | medium (tests, bake scripts) | no (later) |
| AG6 | later | **`@internal` index exports** | A shard importing a game-only engine export (session adapters, boot hooks) | `/** @internal game */` on index exports. The rule reads the index's JSDoc once at load (like `importedConst` does) and refuses those names from kit / shards. `stripInternal` only bites with AG4's declaration emit | 0 s | PC, PP, CI | Tag the game-only exports, count 0 | low | later |

### 2.2 Import graph ("import spaghetti")

| Id | Status | Rule | Catches | Mechanism | Cost | Where | Adoption | FP risk | Rec |
|---|---|---|---|---|---|---|---|---|---|
| AG7 | built 2026-10-03 (E379): `scripts/check-graph.mjs`, 27 pairs recorded, no shard reach today | **`scripts/check-graph.mjs`** | A new layer pair (kit → shards, engine → kit), a cycle spanning two layers or two shards, a shard file imported by anything but its own manifest's `import()`, a static import of `plugin.ts` | One `parseSync` pass over `src` (prototype: 1.0 s, 1,118 files). Writes `lint/layer-edges.json` (edge counts per layer pair, e.g. `shards/pine-hollow → engine 230`). A new pair or a rising count fails. Only `src/game/shard/shards.generated.ts` may import `#shards/*/manifest`; `plugin.ts` only via `import()` from its own manifest | 1.0 s full; ~0.1 s for edges from your paths | PC (your paths), PP + CI (full) | Snapshot today; counts may only fall | low | **yes** |
| AG8 | built e94b842d | **Wire `check-chunks.mjs` into the gate** | A shard module in the cold-boot chunk (MW13) | After `vite build` in `vercel-tree-gate.sh` and CI (`dist/` already exists there) | ~0.2 s | PP, CI | Cold-boot clause now; the one-chunk-per-shard clause after B69 (chunk groups) | low | **yes** |
| — | Fan-in / fan-out limits | — | `import/max-dependencies` stays off: the `#engine` barrel's fan-out of 222 is by design. AG7 prints the top fan-in / fan-out instead | — | — | — | high | no |

### 2.3 Shard conventions

| Id | Status | Rule | Catches | Mechanism | Cost | Where | Adoption | FP risk | Rec |
|---|---|---|---|---|---|---|---|---|---|
| AG9 | built 897baa67 | **Shard layout validator** `scripts/check-shards.mjs` | A shard missing `README.md` / `plugin.ts`, a new loose top-level file, `quest.ts` vs `quest/` drift, a folder named outside the convention | `lint/shard-layout.json`, written from Z1's `_template`: required files (`manifest.ts`, `plugin.ts`, `README.md`, `roster.ts`, `budgets.ts`), the canonical folders (`audio boot explore look models thumbs weapons world`, optional `combat creatures quest species npc loadout playground`), one name per concept, slug = folder name, `_`-prefix = hidden. `docs/SHARDS.md`'s checklist is generated from the same file (AG22) | < 0.2 s | PC when `src/shards/**` is touched, PP, CI | Ratchet: unknown top-level entries per shard (Nalati ~20 today) | medium (naming) — the template decides | **yes** |
| AG10 | built 2026-10-03 (E379): `manifestContract` in `gen-shards.mjs --check`, budgets in `lint/manifest-closure-budget.json` | **Manifest contract** | A manifest whose `load` is a static import, a slug that differs from its folder, a manifest closure that grows (pulls code into cold boot), manifest fields nothing reads | In `gen-shards.mjs --check`: slug = folder; `load` is `() => import('./plugin')`; a file-count budget per shard in `manifest-closure.generated.json`; every `ShardManifest` field is read somewhere in `src/game` or `src/engine` | ~0 s (inside gen-shards' 1.0 s) | PP, CI | Record today's closure sizes | low | yes |
| AG11 | built 897baa67; extended by AG26 | **`wildshard/shard-sandbox`** (`src/shards/**`) | Global writes (`Object.assign(window, { __nalatiQuest })`), `globalThis` / `window` / `self` member reads, window / document input listeners through any helper (10 shard sites, `goldenKing.ts:701-704`), `setting(key)` for a key the shard does not own, `/assets/…` literals outside its own and the kit-shared folders | AST rule. Debug handles must go through `ctx.debug.expose`, Debug rows through `ctx.debugRow` (ids auto-prefixed with the slug) | 0 s | PC, PP, CI | Ratchet per file | low | **yes** |
| AG12 | later | **ShardContext-only services** | A plugin calling an engine service directly instead of through `ctx` | An allowlist of the `#engine` names shards may import (types, pure helpers, `#engine/data`). Services only arrive through `ShardContext` | 0 s | PC, PP, CI | After AG3 / AG6 | medium | later |

### 2.4 Anti-branch rules that look at meaning, not words

| Id | Status | Rule | Catches | Mechanism | Cost | Where | Adoption | FP risk | Rec |
|---|---|---|---|---|---|---|---|---|---|
| AG13 | built 897baa67; extended by AG25 | **`wildshard/no-level-identity`** (outside `src/shards/`) | L4–L7, L10. Live: `Hands.ts:130` `activeLevel().kitLook === 'toon'` (the renamed `getActiveChunk().style === 'toon'`, 875b82f6 / B66), `HorizonMatte.ts:59` `STRIPS[level.id]`, `probe.ts:333` `SHARD_KEYS[…level.id]` | Flags an **identity or style field** (`id slug levelId kitLook style creatureStyle look biome`) of a **level-ish value** (`level spec manifest chunk def`, `game.level`, `activeLevel()`, `getActiveChunk()`) when it is: compared with a string literal; a `switch` discriminant with literal cases; the receiver of `includes` / `startsWith` / `endsWith` / `indexOf` / `match`; or the computed key into a module-level object literal. **Allowed** (R3-05): capability reads such as `mechanisms.includes('dayCycle')` and `level.ground.structures === true` | 0 s | PC, PP, CI | Ratchet ~5 sites today. Each kept one (B66) goes in `ratchet.json` `allow` with a reason, as Jake's pick | medium: genuine enum dispatch. The fix is a strategy table filled by data (`KIT_LOOKS[kitLook]`), which the rule allows when the table comes from the level spec | **yes** |
| AG14 | built 897baa67 | **Generated shard word list, applied in game and kit too** | L5 / L6 for shards that don't exist yet (Z3's two). L9: `{ 'pine-hollow': 1 }` keyed maps in `src/game` | `gen-shards` writes `lint/shard-words.generated.json` from the folder names, manifest names and the species / weapon ids that shard rows declare. `no-shard-branch`'s `slugs` and `layer`'s WORDS read it. Slug object keys and slug literals as a computed key are flagged in game and kit as well as engine | 0 s (gen already runs) | PC, PP, CI | The engine part is already ratcheted; game / kit start at their count (expected ~0) | low | **yes** |
| AG15 | covered: engine words (AG14) see engine option keys | **No feature flags named after shards** | A Debug row / `OPTION_VALUES` key such as `nalatiFog` added to the engine registry instead of through `ctx.debugRow` | The word list (AG14) applied to `opt(...)` ids and `OPTION_VALUES` keys outside `src/shards/` | 0 s | PC, PP, CI | Ratchet | low | yes |

### 2.5 Determinism and hygiene: make "0 stays 0" automatic

| Id | Status | Rule | Catches | Mechanism | Cost | Where | Adoption | FP risk | Rec |
|---|---|---|---|---|---|---|---|---|---|
| AG16 | built 897baa67 | **Promote zero rules to hard errors** | Today `no-shard-branch`, `no-raw-save`, `no-raw-shader-patch`, `sim-no-render`, `no-active-chunk`, `no-raw-hud`, `no-raw-animation-mixer` are 0 but only the ratchet sees them: not `pnpm lint`, not the editor | Turn them on in `.oxlintrc.json`'s `src/**` override. `ratchet.mjs` then refuses a rule section whose total is 0 ("move it to `.oxlintrc.json`"), so a rule is promoted the commit it reaches 0 | 0 s | everywhere | Today: 7 rules | none | **yes** |
| AG17 | built 897baa67 | **A cleaned file locks** | The 127 raw-input and 293 listener-patch allowances in files that are already clean (1.3) | `ratchet.mjs` check fails when a file's baseline is above 0 and its count is 0: "run `pnpm lint:ratchet --update` in this commit". Partial slack only warns. The fix commit carries the lowered `ratchet.json` lines | 0 s | PC, PP, CI | One `--update` now | low. With 10 agents on one `ratchet.json`, conflicts are per line (sorted keys), and only your files' lines move | **yes** |
| AG18 | built 2026-10-03 (E379): paid down to 0 (Jake's pick), every page-wide listener on `listenPage` | **`no-raw-input` sees helpers** | L20: `scope.listen(window, 'keydown')`, `listenDom(scope, document, 'pointermove')` — 31 window / document sites (engine/explore 11, Nalati 8, Pine 2, ui 1) besides the 7 legit ones in `engine/input` | Any call with a `window` / `document` argument and an input-event literal, outside `engine/input`. Listeners on the widget's own element stay legal (Explorer's divider) | 0 s | PC, PP, CI | Re-baseline: ~22 sites | low | yes |
| AG19 | partly: no-raw-input, no-global-listener-patch hard | **Promote the rest as they finish** | — | `no-global-listener-patch` (146) after X1 / X2, `no-active-singleton` (47), `no-hook-chain` (18), `no-renderer-type` (5) go hard through AG16 the day they reach 0. `no-raw-random-time` (215, shards 91) stays ratcheted | 0 s | — | automatic | — | yes |

### 2.6 A fast pre-commit

| Id | Status | Rule | Catches | Mechanism | Cost | Where | Adoption | FP risk | Rec |
|---|---|---|---|---|---|---|---|---|---|
| AG20 | built 897baa67 | **`scripts/precommit-guards.mjs`** from `.githooks/pre-commit` | Every rule above, before the commit lands rather than at push. Today a rise is only *announced* by post-commit | The commit's own paths (`git diff --cached --name-only`; under `git commit -- <paths>` that is the temporary index of exactly those paths), filtered to `src/**/*.{ts,js}`: (1) `oxlint --type-aware=false` with all rules on them; (2) the custom rules on them, compared per file with `lint/ratchet.json`; (3) AG7's edges from those files; (4) AG9 when `src/shards/**` is touched; (5) `gen-shards --check` when a `manifest.ts` is touched | ~0.2 s typical (5 files), ≤ 1.5 s worst (a manifest touched); measured parts: 0.03 + 0.1 + ~0.1 + 0.2 + 1.0 s | PC | Escape `git commit --no-verify` or `SKIP_ARCH_GUARDS=1`, logged in the sweep-guard ledger | low | **yes** |

Never in pre-commit: tsc, type-aware lint and whole-tree scans. The tree is shared with ~10 agents, so their
half-finished files would fail *your* commit. Those stay in the pre-push gate, which builds a clean export. The
private-index commit recipe (`commit-tree`) skips hooks. The pre-push gate is the backstop.

| Stage | Runs |
|---|---|
| Pre-commit (your paths, ≤ 1.5 s) | AG20: oxlint (no types) + custom rules vs the ratchet + graph edges + layout + gen-shards when touched |
| Pre-push (clean export, `vercel-tree-gate.sh`) | Today's gates + AG4 `tsc -b` (est. 5–8 s) + AG7 full graph (1 s) + AG8 check-chunks (0.2 s) + AG21 api check (~1–2 s) |
| CI | The same as pre-push |
| Post-commit | Keep the advisory ratchet as a backstop for hook-less commits |

### 2.7 Docs as enforcement

| Id | Status | Rule | Catches | Mechanism | Cost | Where | Adoption | FP risk | Rec |
|---|---|---|---|---|---|---|---|---|---|
| AG21 | partly: docs/ENGINE.md + engine-docs test (Z2) | **Generated API surface** | A new public export (223 / 34 / 42 export statements in the engine / game / kit indexes today) or a new `ShardContext` verb with no docs, and API growth nobody noticed | `scripts/gen-api.mjs` (TS compiler API, already a dependency via gen-shards) writes `lint/api-surface.json` (name, kind, first JSDoc line per export, plus the `ShardContext` / `LevelContext` members) and renders `docs/api/{ENGINE,GAME,KIT,SHARD-CONTEXT}.md`. `--check` fails when stale or when an export has no JSDoc line. The JSON lives under `lint/` because Vercel's tree drops `docs/` (the `lint/ask-ids.json` precedent) | ~1–2 s (estimate) | PP, CI | Generate once; missing JSDoc lines go in a ratchet count | low | yes |
| AG22 | open | **SHARDS.md ↔ validator** | Z2's how-to drifting from what AG9 enforces | The SHARDS.md checklist section is generated from `lint/shard-layout.json` | 0 s | PP, CI | With Z1 / Z2 | none | yes (with Z2) |

### 2.8 Not recommended

- **dependency-cruiser / madge / ESLint boundaries plugins:** each adds a dependency and a second parser. The 1.0 s
  `parseSync` graph (AG7) and the existing oxlint JS plugin cover the same ground.
- **Per-layer npm workspaces** (`packages/engine` with an `exports` map): the strongest privacy, but a tree-wide move
  during the E357 lock. AG5 gets the same result once AG3 is done.
- **Fan-in / fan-out caps:** see 2.2.

---

### 2.9 Holes found in the E405 review (2026-10-03)

| Id | Status | Rule | Catches | Mechanism | Cost | Where | Adoption | FP risk | Rec |
|---|---|---|---|---|---|---|---|---|---|
| AG23 | built 6d30ee6d | **Every `src` file has a layer** | H1 | `wildshard/layer`: a file under `src/<dir>/` that is not one of the four layers is refused, and so is an import of one. Only `src/{entry,main,pageServices}.ts` are `app` | 0 s | PC, PP, CI | 0 sites → hard | none | **yes** |
| AG24 | built 6d30ee6d | **No dead exemptions** | H2 | Delete the legacy paths from `no-shard-branch`, `no-raw-input` and `TIME_ALLOW`; a test fails when a path a rule exempts doesn't exist | 0 s | PP, CI | 0 sites | none | **yes** |
| AG25 | built 6d30ee6d + 064795009 (hard at 0) | **`no-level-identity` sees through aliases**, and the engine's 4 sites move to data | H3; the 4 sites | Track destructured and aliased identity fields and const strings; flag `[…].includes(field)`, `Map.get(field)` and `regex.test(field)`. Jake's pick 1A: the level spec gets a `hands` field (`Hands.ts`), Driftwood sets its own `horizonStrips` and `HorizonMatte`'s table goes, shards expose their probe keys with `ctx.debug.expose` (`probe.ts`'s `SHARD_KEYS` goes) | 0 s | PC, PP, CI | 4 → 0, then hard | medium (genuine enum dispatch: a data-filled strategy table stays legal) | **yes** |
| AG26 | built 6d30ee6d | **`shard-sandbox`: page-level `document` and bare globals** | H4 | Jake's pick 2A: flag `document.body` / `title` / `documentElement`, `getElementById`, pointer lock, `dispatchEvent`, and bare `innerWidth` / `innerHeight` / `devicePixelRatio` / `navigator` / `location` in shards. `createElement` stays legal | 0 s | PC, PP, CI | Ratchet today's ~30 | low | **yes** |
| AG27 | built 6d30ee6d | **`layer` reads string-concat `import()`** | H6 | The specifier's leading string of a `+` chain is resolved like a template prefix | 0 s | PC, PP, CI | 0 sites → hard | none | **yes** |

## 3. Recommended first batch

Eight levers, all fast. **All eight are built** (897baa67, 10-01). In order:

| # | Lever | Extra cost | Why first |
|---|---|---|---|
| 1 | AG16 promote the 7 zero rules to hard errors, with auto-promotion | 0 s | Zero risk. Locks today's wins (shard-branch 81 → 0, active-chunk 80 → 0) in the editor and in `pnpm lint` |
| 2 | AG17 a cleaned file locks | 0 s | Closes 420 allowances in already-clean files today |
| 3 | AG1 close the `layer` holes (relative, `src/*.ts`, glob / template `import()`) | 0 s | 0 sites today, so hard error from day one |
| 4 | AG14 generated shard word list, also in game and kit | 0 s | Z3's two new shards are covered automatically |
| 5 | AG13 `no-level-identity` | 0 s | Catches the renamed branch (B66 class) that Jake asked about. ~5 sites to ratchet |
| 6 | AG11 `shard-sandbox` | 0 s | Shards stay inside `ctx`: no globals, no raw window input, own assets and settings |
| 7 | AG20 the pre-commit runner | ~0.2 s typical, ≤ 1.5 s | Turns 1–6 from "found at push" into "refused at commit" |
| 8 | AG9 the shard layout validator (with Z1's template) | < 0.2 s | Every shard, including the Z3 ones, follows the template |

**Batch 2 (E379, open):** AG2 split `layer`, AG18 `no-raw-input` helpers, AG7 the graph check, AG10 manifest contract, then AG3's deep-import sweep (it touches every shard, so it waits until the shard agents are idle) and AG4's engine project once the 7 engine files in 1.4 have moved. AG8 is built (e94b842d). AG21 is mostly done by docs/ENGINE.md and `test/engine-docs.test.ts`.

**E405 rows:** AG23, AG24, AG26, AG27 built (6d30ee6d; AG26 ratcheted 88 → 121); AG25 built and `no-level-identity` hard at 0 (064795009). AG28, the engine eviction (Jake 10-03), is in flight.

