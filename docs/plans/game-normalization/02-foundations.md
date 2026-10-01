# GAME-NORMALIZATION v2 · 02 — Foundations (F0–F12)

The build spec for the foundation rows of [GAME-NORMALIZATION.md](../GAME-NORMALIZATION.md) §4 F. It builds against the
interfaces in [01-architecture.md](01-architecture.md) (cited as "01 §n") and the decisions in
[E357](../../tasks/asks/E357.md) (cited as "decision n"). The parity harness and the GPU gate that F2 / F3 build are
specified in [03-harness-gate.md](03-harness-gate.md) (cited as "03 §n"); this file says what to build and in what order,
03 says how the harness behaves.

**Conventions used below**
- "Today" is the tree at `b1b8f9c9` (2026-09-30). Every count was measured on it, `src/dev/` excluded unless stated.
- Paths are today's paths for rows that run before F6. For rows after F6, the path is given as `today → after F6` the
  first time, then the new path. The F6 folder map (F6 step 3) decides every new path.
- Every commit follows the plan's rule (GAME-NORMALIZATION §3): a pathspec commit (`git commit -m "…" -- <paths>`,
  with the `E357-Lead: yes` trailer, F0 step 5) → the local parity run on it, `--export=HEAD` (12 §5; R1-10) →
  `scripts/push-main.sh` once green. A red result is reverted with `git revert <sha>`, never patched forward and never
  `git reset`.
- Sizes: **S** ≤ ½ agent-day, **M** ≤ 2 agent-days, **L** more (the plan's scale).
- "The lead" is the build session that holds the lock (decision 33). A subagent runs a row only when this spec says the
  row is splittable, under the E352 caps.

## 0. Order and why

| Step | Row | Why here |
|---|---|---|
| 1 | **F0** the lock | Nothing else may land while other agents still edit the tree. |
| 2 | **F3.1** the deploy pin (F3 part 1) | Every later commit changes `src/`. The pin must hold production on today's build before the first `src/` change (F2's probe) is pushed, or the hourly deploy ships the refactor (decision 32). |
| 3 | **F1** tooling | The alias resolution, `check-paths` and the vacuous-glob guard must exist before any file moves or is deleted (F7, F6), and before the harness scripts are written against them. |
| 4 | **F2** parity harness v1 | "Nothing moves before the harness has baselines." Baselines are recorded on the tree right after F2's probe commit, which is today's game plus a read-only probe. |
| 5 | **F3.2** the GPU gate (F3 part 2) | The gate runs F2's harness on GitHub `macos-15`. It needs F2. It must be green before F4's first lint change is pushed, so every later push is gated. |
| 6 | **F4** ratchets | `wildshard/layer` and the count rules must exist before F6, so the move records its layer counts instead of hiding them. |
| 7 | **F5** actor tests | A node-side safety net (the loop, strike timing, a sword combo, saves) that moves with the code in F6 and must stay green unchanged. |
| 8 | **F7** delete the dead | Run **before** F6: every deleted file is a file the F6 codemod does not have to move, and every script ported to the probe is a script whose `__world` reads F6 does not have to touch. It needs F1 (`check-paths`) and F2 (the probe). |
| 9 | **F6** the big move | Needs F1 (aliases, `check-paths`), F2 (parity), F4 (layer counts), F5 (node net), F7 (less to move). |
| 10 | **F8** the spine | New engine code is written in its final folder (`src/engine/app/`, `src/engine/core/`), so it comes after F6. |
| 11 | **F9** the shard registry | Needs F6's `src/shards/<slug>/manifest.ts` files and F8's `Scope` (a failed load disposes the shard's scope). |
| 12 | **F10** SaveStore | Needs F9's generated `ShardSlug` union for shard-scoped keys, and F8's services (`app.saves`). |
| 13 | **F11** retire the old machinery | Needs F8's `Scope` (it replaces ShardHost's park / evict) and F6's registry location. |
| 14 | **F12** Rapier 0.21 | After F11, so the walk and trails baselines already run on the one collision path the upgrade must keep. |

F1 and F2 touch disjoint files and may run as two parallel subagents (the lead plus one subagent, E352 caps). Every
other row runs in the order above, one at a time, by the lead.

---

## F0 — Declare the lock

**Goal.** Every live plan, the session brief and AGENTS.md say that E357 holds the whole repository (decision 33) until
the plan is archived, with each shard's folder reopening at its milestone (decision 52).

**Depends on.** Jake's go on the plan (the plan's State line moves from `draft` to `in progress`).

**Interfaces.** None.

**Steps.**
1. `AGENTS.md`: add a section right under the title, `## The E357 lock (Jake, 2026-09-30)`, 6 lines: no other agent
   edits the repo while GAME-NORMALIZATION is `in progress`; the engine (`src/engine/`), game (`src/game/`) and kit
   (`src/kit/`) stay locked until the plan is archived; `src/shards/<slug>/` reopens to content agents at that shard's
   milestone (M1 Nine Dragon, M2 Pine Hollow, M3 Nalati, M4 Driftwood); production is pinned (F3.1) and moves only at a
   milestone; bug fixes land on main and ship with the next milestone (decision 53); link to the plan.
2. `.claude/hooks/session-brief.sh`: print, before the open asks, one line
   `LOCK: E357 GAME-NORMALIZATION holds the repo — see docs/plans/GAME-NORMALIZATION.md §3` when
   `docs/plans/GAME-NORMALIZATION.md` line 3 contains `` `in progress` ``. The line disappears by itself when the
   plan is archived (the file moves away).
3. Rewrite line 3 (the State line) of each overlapping plan, keeping its tables:

   | Plan | New State line says |
   |---|---|
   | `docs/plans/ENGINE-FIT.md` | `archived <date> (folded into GAME-NORMALIZATION v2)`; the file moves to `project/archive/<date>-engine-fit.md` in the same commit (AGENTS.md → Plans); every link to it in `docs/` and code comments is fixed |
   | `docs/plans/FINISH-LINE.md` | `blocked` — S1 (the gate), S3, S5, S6, S7 moved to GAME-NORMALIZATION (F2 / F3 / Z4, the plan, X1, F5, S1.6 / X7); its other rows wait for the E357 lock to end |
   | `docs/plans/PHYSICS-POLISH.md` | `blocked` — F3 moved to GAME-NORMALIZATION F11; F7 goes with `src/dev` (F7); F1, F2, F4, F5, F6 wait for the lock |
   | `docs/plans/ANIMATION-REMASTER.md` | `blocked` — its engine layer moved to GAME-NORMALIZATION X4; A3–A7 wait for X4's rig contract |
   | `docs/plans/DEPLOYMENT_ASSET_TRIM.md` | `blocked` — T3 moved to GAME-NORMALIZATION X3; T2, T4, T5 wait for the lock |
   | `docs/plans/NINE-DRAGON-STACK.md` | `blocked` — paused for E357 until M1, then re-planned for the new engine (decision 66) |
   | `docs/plans/DRIFTWOOD-REMASTER-V2.md`, `EXPLORE-V2.md`, `NATIVE-APPS.md`, `SHARD-CHECKPOINTS.md` | `blocked` — waits for the E357 lock (Driftwood: until M4; the others: until the plan is archived) |
4. `herdr agent list`; send each live agent `"[from E357] The repo is locked for GAME-NORMALIZATION v2 from <sha>. Stop,
   commit your own paths, and end. Details: AGENTS.md → The E357 lock."` (no `--wait`). Record who was told in
   `docs/tasks/asks/E357.md`.
5. **The lock check (R1-09).** `scripts/check-lock.mjs`, run by a new `.githooks/commit-msg` hook (`node
   scripts/check-lock.mjs "$1"`; a `commit-msg` hook can read the message, a pre-commit hook cannot). It reads the
   message file and `git diff --cached --name-only` (the paths being committed; a pathspec commit's hook sees its
   temporary index) and `.github/lock.json`: `{ "locked": true, "reopened": { "<slug>": ["<extra asset glob>", …] } }`.
   F0 writes `{ "locked": true, "reopened": {} }`; each milestone commit adds its shard's slug with the asset folders
   its manifest declares (for example `public/assets/nine-dragon/**`); the archive commit sets `"locked": false`.
   While `locked` is true, a commit whose trailers (`git interpret-trailers --parse`) carry `E357-Lead: yes` passes
   (the lead and the subagents it spawns); any other commit may touch only the reopened-shard allowlist of a slug in
   `reopened`: `src/shards/<slug>/**`, `test/shards/<slug>/**`, `test/parity/baselines/*/<slug>.*` (its lane owns its
   baselines, R1-12), `art/<slug>/**`, `public/assets/<slug>/**` and that slug's extra asset globs,
   `scripts/blender/<slug>/**`, and `docs/tasks/asks/**`. Also always allowed: a commit that touches only
   `project/sweepguard-ledger.md`, which `.githooks/post-commit` writes and commits by itself after a `SKIP_SWEEPGUARD`
   commit (13 R1 K-ledger). Anything else exits 1, listing each refused path. Generated
   files are never committed (F9, R1-11), so none is on the list. The pure check `lockVerdict(message, paths, lock)`
   is a named export, so the test calls it without git.
6. **AGENTS.md beyond the lock section (R1-49).**
   - **Deploy** is rewritten for the pin: production and the OTA channel serve the SHA in `.github/deploy-pin.json`
     (F3.1: `M0`, then `M1` … `Mn`), moved only by `node scripts/deploy-pin.mjs set` at a milestone or `rollback`
     (03 §13); after a push, verify CI and the `gpu-gate` status only (`version.json` stays on the pinned build, and
     `gh workflow run deploy` ships the pin, never main's head).
   - **No URL switches** gains the route for a new Debug toggle: its owner adds it through `ctx.debugRow` (01 §7) once
     that owner is a plugin, else through today's registry (`src/ui/Settings.ts` + `src/ui/debugOptions.ts`). During
     the lock a new toggle is added only for an E357 row or a Jake ask: by the lead, or by a content agent through
     `ctx.debugRow` inside its reopened shard folder.

**Tests added.** `test/check-lock.test.ts` (R1-09): `lockVerdict` refuses a message without the trailer that touches
`src/engine/app/app.ts`, passes the same paths with `E357-Lead: yes`, passes `src/shards/<slug>/x.ts` and
`docs/tasks/asks/E400.md` for a reopened slug, refuses them for a slug that isn't reopened, and passes everything when
`locked` is false.

**Done when.**
- `bash .claude/hooks/session-brief.sh | grep -c '^LOCK: E357'` prints `1`.
- `grep -l 'E357' docs/plans/*.md` lists every plan in the table above, and `docs/plans/ENGINE-FIT.md` no longer exists.
- `herdr agent list` shows no agent other than the lead with a working state in this repo.
- A planted commit without the trailer that touches `src/main.ts` is refused by the `commit-msg` hook, naming the
  path (the plant is not kept), and `grep -c 'deploy-pin' AGENTS.md` is at least 1 (R1-09, R1-49).

**Risks and rollback.** An agent that ignores the notice commits into a locked folder: the lead reverts that commit and
tells the agent again. Rollback of F0 itself: `git revert` of its commit.

**Size.** S.

---

## F1 — Tooling before any move (TP1–TP3)

**Goal.** `#engine`, `#game`, `#kit` and `#shards/*` resolve in every consumer (tsc, Vite 8, vitest 5, oxlint's import
resolver, the `wildshard/no-url-switch` rule, `scripts/bake-loader.mjs`); a path string that points nowhere fails
`pnpm test`; an `import.meta.glob` that matches nothing fails `pnpm test`.

**Depends on.** F0, F3.1.

**Interfaces.** 01 §0 (aliases, public API).

**Steps.**
1. **The alias spike (TP1).** Add to `package.json`:
   ```json
   "imports": {
     "#engine": "./src/engine/index.ts",  "#engine/*": "./src/engine/*.ts",
     "#game": "./src/game/index.ts",      "#game/*": "./src/game/*.ts",
     "#kit": "./src/kit/index.ts",        "#kit/*": "./src/kit/*.ts",
     "#shards/*": "./src/shards/*.ts"
   }
   ```
   Targets end in `.ts`, so Node resolves them with no extension probing. A deep specifier always names a file
   (`#shards/pine-hollow/manifest`), never a folder. **Asset specifiers (R1-21).** The map also gets one
   extension-preserving entry per layer for each asset type imported across folders today (`.jpg`, `.webp`):
   `"#engine/*.jpg": "./src/engine/*.jpg"`, `"#engine/*.webp": "./src/engine/*.webp"`, and the same pair for `#game`,
   `#kit` and `#shards`. The longer key wins in Node's and Vite's pattern match, so a non-TS target never gets `.ts`
   appended. Create the three layer indexes with one export each so the spike
   has something to import: `src/engine/index.ts` (`export const ENGINE_API = 1;`), `src/game/index.ts`
   (`export const GAME_API = 1;`), `src/kit/index.ts` (`export const KIT_API = 1;`), the lint fixture
   `src/engine/aliasFixture.ts` (`export const ALIAS_FIXTURE_PARAM = 'tier';`, a param on the `harness` allowlist), and
   the asset fixture `src/engine/aliasFixture.webp` (a 1 × 1 WebP).
2. Prove each consumer with one import through the alias:
   - src: `src/main.ts` gets `import { ENGINE_API } from '#engine';`, `import aliasArt from
     '#engine/aliasFixture.webp';` and `void ENGINE_API; void aliasArt;` in its first line of `main()` (removed again
     in F6 when real engine imports exist);
   - test: `test/alias.test.ts` imports `#engine`, `#game`, `#kit`, `#engine/aliasFixture` and asserts the values, and
     imports `#engine/aliasFixture.webp` and asserts its URL ends in `.webp` (R1-21);
   - baker: `test/alias.test.ts` also runs `node --import ./scripts/bake-loader.mjs -e "…import('#engine/aliasFixture')…"`
     through `child_process.execFileSync` and asserts stdout `tier`;
   - oxlint: `pnpm exec oxlint src/main.ts` exits 0 (the `import/no-cycle` resolver follows `#engine`);
   - tsc, vite: `pnpm run typecheck` and `pnpm exec vite build` exit 0.
   **Fallback** if any consumer refuses the `.ts` targets: extensionless targets (`"#engine/*": "./src/engine/*"`) plus
   a `#` branch in `bake-loader.mjs` that maps through package.json `imports` and then probes `.ts` / `/index.ts` exactly
   as its relative branch does (`bake-loader.mjs:11-22`). If that also fails: tsconfig `paths` + Vite `resolve.alias` +
   a loader map, three copies kept in sync by a vitest test that compares them. The chosen form is written into
   01 §0's Aliases row by the lead (this file does not edit 01).
3. **The lint resolver (TP2).** `lint/wildshard-plugin.js:103-115` (`importedConst`) returns `null` for any
   non-relative specifier. Add: a specifier starting with `#` is mapped through the repo's `package.json` `imports`
   (read once at plugin load, patterns with one `*`), then tried as today (`base`, `.ts`, `.js`, `/index.ts`). Export
   `importedConst` as a named export so the test can call it.
4. **`scripts/check-paths.mjs` (TP3).** A node script, no dependencies, exit 1 with a list on any failure:
   - **Path strings.** In `scripts/**/*.{mjs,js,sh,py,json}`, `vite.config.ts`, `vite/**/*.ts`, `.oxlintrc.json`,
     `scripts/blender/targets.json`: every quoted string literal (`'…'`, `"…"`, `` `…` `` without `${`) that starts
     with `src/` or `./src/` or `test/` is checked. A plain path must exist (`existsSync`); a path with `*`, `**` or
     `{a,b}` must match at least one file (`fs.globSync`, Node ≥ 22). In `.sh` / `.py` files every `src/…` token is
     checked, quoted or not.
   - **Globs in code.** Every `import.meta.glob(<string | string[]>, …)` in `src/**/*.ts` and `test/**/*.ts` (14 today:
     4 in src, 10 in 8 test files) is parsed with a regex over the call's first argument; each non-negated pattern is
     resolved against the calling file's folder and must match ≥ 1 file.
   - **Allowlist.** `scripts/check-paths.allow.json`: `[{ "path": "...", "file": "<the file that names it>",
     "why": "..." }]` for a literal that is deliberately not a file (for example a prefix used in a `startsWith`).
     Starts empty; every entry needs a `why`. An entry whose `file` no longer contains the literal fails the check.
5. `package.json` `"test"` becomes
   `node scripts/check-model-sources.mjs && node scripts/check-paths.mjs && vitest run`.
6. **Non-empty asserts.** Each of the 8 test files with a glob gets `expect(Object.keys(<GLOB>).length).toBeGreaterThan(0)`
   as its first assertion: `test/shell.test.ts`, `test/models-pine-hollow.test.ts`, `test/nalati-roster.test.ts`,
   `test/compendium.test.ts`, `test/models-driftwood.test.ts`, `test/facade-no-multidraw.test.ts`,
   `test/ktx2-auto.test.ts` (all three of its globs), `test/species.ts` (the helper; the assert throws at import).
   The 4 src globs (`src/boot/extras.ts:47`, `src/explore/Compare.ts:9`, `src/entities/AnimalFactory.ts:15`, and the
   `species/registry.ts` doc reference) are covered by `check-paths`.
7. **Bakers hash their inputs, not their own source (R1-20).** A baker whose stamp hashes its own script file
   re-stamps on every edit of that script, and F7, F6 and F9 all edit the bakers. Each such baker drops its own source
   from the digest and hashes a `BAKE_VERSION` constant (bumped by hand when its output format or maths changes) plus
   its data inputs: `bake-sky.mjs:22,32` (`self` leaves the digest; its `VERSION` stays), `bake-navmesh.mjs:419`
   (`readFileSync(import.meta.filename)` → `BAKE_VERSION`), and `bake-chunk.mjs:40` (`'scripts/bake-chunk.mjs'` leaves
   `shared`). The lead greps `scripts/bake-*.mjs` for any other baker that reads its own file into a hash and changes
   it the same way. The re-stamp this causes once (the `hash` fields under `public/assets/baked/`, and the packs that
   carry them) is committed in F1: it is the accepted one-time re-download (13-lead-resolutions 04#5), which now
   happens here instead of in F6.

**Tests added.** `test/alias.test.ts` (aliases in vitest, in a baker, the lint resolver via the exported
`importedConst` with a `#engine/aliasFixture` specifier → `'tier'`, and the asset specifier
`#engine/aliasFixture.webp`); `test/check-paths.test.ts` (runs the script on a
temp copy with one planted bad path in a script string and one planted empty glob; both must exit 1 and name the
planted item).

**Done when.**
- `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `pnpm exec vite build` all exit 0.
- `test/alias.test.ts` passes (a baker and a lint key both resolve through `#engine/…`, and an asset specifier resolves
  with its own extension).
- `test/check-paths.test.ts` passes (a moved file can't make a test pass vacuously).
- The bakers' re-stamp is committed, and a comment-only edit to `scripts/bake-sky.mjs` followed by `pnpm exec vite
  build` leaves `git status --porcelain public/assets src` empty (the edit is not kept; R1-20).

**Risks and rollback.** TS 7's bundler resolution may reject `.ts` targets under `verbatimModuleSyntax` → the fallback
in step 2. Rollback: `git revert` (no runtime change; the bundle is byte-identical except the `ENGINE_API` constant, the
fixture image and step 7's re-stamped `hash` fields).

**Size.** S.

---

## F2 — Parity harness v1 (TP4, TP5, MW1)

**Goal.** A typed probe `window.__wildshard` and `scripts/parity.mjs` that record and compare, for 4 shards × phone /
desktop, a boot fingerprint, 3 poses, a scripted walk and a swing + shot to a kill and loot. Baselines from the tree
right after the probe commit. Nine Dragon joins (it is outside scorecard's `SHARDS`, `scripts/scorecard.mjs:49`).

**Depends on.** F1 (check-paths guards the new scripts' path strings).

**Interfaces.** 01 §5 (`window.__wildshard`, `__world` alias with the same key names). The harness itself: 03.

**Steps.**
1. **The probe (src, read-only).** New `src/core/probe.ts` (→ `src/engine/debug/probe.ts` in F6):
   `installProbe(handle, deps)` sets `window.__wildshard = { version: 1, world, shard, boot, fingerprint(),
   pose(), walkLeg(), combat, arena(), state(), onResume(), saves }` exactly as 03 §2 defines each member (`state()` /
   `onResume()` serve the pause → resume step, 03 §5.6; F3.2 adds `nav` for the soak bot, 03 §14.2), and keeps
   `window.__world = world` (the same object). `world` is today's handle (`src/main.ts:1296`, all its keys);
   `shard = { slug, …handles }`: each shard-named key of that handle sits at `shard.<name>`, the place
   `ctx.debug.expose(name, value)` writes from S1.1 on (01 §7). The keys: Driftwood `ocean, pier,
   jetties, boat, hut, lookout, wreck, shrine, bushes, gulls, bridge, bridgeDeck, cove, enemies, shrineHum, islandSfx`;
   Pine Hollow `pineLife, cabins, props, streams`; Nalati `nalati, ride, wildlife`; Nine Dragon none today. `boot` is
   the fingerprint captured **synchronously inside `installProbe`** (03 §2.1).
2. Accessors the probe needs, each read-only and unused by the game:
   - `src/core/Game.ts`: `systemLabels(): Record<'input' | 'fixed.pre' | 'fixed.step' | 'fixed.post' | 'update' | 'late', string[]>`
     returning the `label` of every `GameSystem` in `inputs`, `fixed.pre/step/post`, `updaters`, `lates` (lines 125-128),
     in list order.
   - `src/world/registry.ts`: `pieces(): readonly Piece[]` (the registry's internal list, as registered).
   - `src/core/harnessTap.ts` (new, 10 lines): `export const tap: { hit: ((kind: string, amount: number) => void) | null;
     kill: ((kind: string) => void) | null } = { hit: null, kill: null };`. One call each at the two damage sites:
     `Animal.applyDamage` (`src/entities/Animal.ts`) calls `tap.hit?.(this.kind, amount)`, and the TrainingTarget damage
     method (`src/practice/TrainingArena.ts`, the method that calls `this.motion.hit(…)` at line 125) calls
     `tap.hit?.('training-dummy', amount)`. `AnimalManager`'s kill path calls `tap.kill?.(a.kind)` where it calls
     `onKill`. A third tap, `resume: (() => void) | null`, is called by the pause menu's resume handler
     (`src/ui/Menu.ts`) right before it clears the pause, so `probe.onResume` reads the state before the next frame
     (03 §5.6). A fourth, `sound: ((id: string) => void) | null`, feeds the sound-play log (03 §2.3; R1-45): the probe
     wraps each public cue method of the page's `Audio` instance (`src/audio/Audio.ts`: `crossbowFire`, `swordSwing`,
     `footstep`, `boltImpact` and the rest from line 350 on, a name list in `probe.ts`) so a call records `<method>`,
     or `<method>:<its first string argument>`, then runs unchanged. The probe sets the functions only when
     `window.__wildshardHarness` exists (03 §6).
   - `src/entities/AnimalManager.ts`: an animal with `harnessHold === true` skips its think / motor update (the harness
     holds one target still, 03 §5). Nothing sets it except the probe.
3. `src/main.ts`: move the `const handle = {…}` line (1296) and `debug.__world = handle` (1298) above
   `document.dispatchEvent(new Event('ws:ready'))` (1291) and call `installProbe(handle, …)` there. This is a reorder of
   window-global assignments only.
4. **Typed for scripts.** `scripts/types/wildshard-probe.d.ts` declares `interface Window { __wildshard: WildshardProbe;
   __wildshardHarness?: HarnessPins }` with every member of 03 §2. `scripts/tsconfig.json`:
   `{ "compilerOptions": { "allowJs": true, "checkJs": true, "strict": true, "noEmit": true, "module": "ESNext",
   "moduleResolution": "bundler", "target": "ES2022", "types": ["node"], "lib": ["ES2022", "DOM"] },
   "include": ["types/*.d.ts", "parity.mjs", "parity/**/*.mjs", "gpu-gate/**/*.mjs", "deploy-pin.mjs"] }`.
   `package.json` `"typecheck"` becomes `tsc --noEmit && tsc --noEmit -p api && tsc --noEmit -p scripts`.
5. **`scripts/parity.mjs`** plus helpers in `scripts/parity/` (`fingerprint.mjs`, `poses.mjs`, `walk.mjs`,
   `combat.mjs`, `compare.mjs`, `ssim.mjs`, `glbytes.mjs`, `serve.mjs`). Code is lifted, not re-invented, from:
   `scorecard.mjs` (the init script's pins and GL-API byte hooks, lines 161-260; `measurePose` 528-600; `SSIM_FN`
   730-755; `exportTree` 1052), `physics-baseline.mjs` (the walk autopilot and stuck rule, lines 240-300),
   `nalati-boot-check.mjs` (page-error filter), `bench-load.mjs` (step timings), `test-facade-instancing.mjs` (the
   multi-draw assertion, as a Nine Dragon fingerprint field), `pine-hollow-perf-lap.mjs` (the localStorage diff).
   The CLI, outputs and every rule are 03 §1–§9.
6. **Routes.** `scripts/physics-route.json`: add `"gate": true` to the 3 legs per shard that 03 §4 names. No leg
   changes otherwise.
7. **Record the baselines** (03 §8) on the commit that contains steps 1–6: `--record --runs=3` for the `m5` lane (4 shards
   × phone and desktop), committed as `test/parity/baselines/m5/**`. Add `/test/parity` to `.vercelignore`.
8. **Prove it** (03 §9): green twice on the unchanged HEAD, red on each planted change in `test/parity/plants/`.

**Tests added.** `test/parity-compare.test.ts`: the pure comparison (`scripts/parity/compare.mjs`) on fixture JSON —
exact fields, noise bands, SSIM floors, renames (03 §7), quarantine (03 §12). `test/probe-shape.test.ts`: the
`.d.ts` and `installProbe`'s returned keys agree (a type-level check through `tsc -p scripts`).

**Done when.**
- `node scripts/parity.mjs --export=HEAD --lane=m5 --tiers=phone,desktop` exits 0 twice in a row on the baseline SHA.
- Each plant in `test/parity/plants/` makes it exit 1 with that plant's expected field named in the report (03 §9).
- The probe commit itself changed no behaviour: on that commit, `node scripts/physics-baseline.mjs --no-build
  --mode=walk` reports 0 stuck on every leg, and `node scripts/nalati-boot-check.mjs --url=<the served build> --touch
  --shards=driftwood-isle,pine-hollow,nalati-grasslands,nine-dragon-stack` reports 0 errors.

**Risks and rollback.** Pose noise larger than expected makes a band so wide it misses real changes: the plant list is
the check (a plant that passes means the band is wrong, and it is narrowed or the field made exact before F2 is done).
Rollback: `git revert` of the probe commit (the scripts and baselines stay harmless without it).

**Size.** M. Splittable: one subagent writes `scripts/parity/*.mjs` while the lead does steps 1–4.

---

## F3 — GPU gate + pinned deploys (TP6, ci-gpu-options)

Two parts at two points in the order (§0). The full behaviour is 03 §11 (the gate), §13 (the pin), §14 (nightly).

### F3.1 — The deploy pin (runs right after F0)

**Goal.** Production (`https://wildshard-singleplayer.vercel.app`) and the native OTA channel serve the pinned build
while main moves; the pin moves only at a milestone (decision 32).

**Steps.**
1. `.github/deploy-pin.json` (03 §13.1) with `mode: "pinned"`, `sha` = the full SHA of the build production serves
   when F3.1 lands (read `https://wildshard-singleplayer.vercel.app/version.json`, `build` = `<sha7>-<time>`, resolve
   `<sha7>` with `git rev-parse`), `milestone: "M0"`, `gate: "grandfathered"` (it predates the gate).
2. `scripts/deploy-pin.mjs` (03 §13.2): `read` (prints the SHA; writes `sha=` and `mode=` to `$GITHUB_OUTPUT`),
   `check-gate <sha>`, `set <sha> --milestone <Mn> --go <where Jake said go>`, and `rollback <sha> --go <Jake's words>`
   (any SHA in the pin history, M0 included, with no gate check; R1-16). The F3.1 commit is M0's entry in that
   history: M0 is recorded as trusted there.
3. `.github/workflows/deploy.yml` (03 §13.3): the schedule / dispatch path deploys the pinned SHA; the push / PR path
   is unchanged. `scripts/deploy-version.mjs` reads the target SHA from `DEPLOY_SHA` when set.
4. `.github/workflows/ota-promote.yml`: the same pin read, and `actions/checkout` of the pinned SHA before its build.

**Done when.** After a push of an unrelated `src/` commit, the next scheduled deploy run logs `Already deployed;
skipping.` and `version.json` still reports the pinned `<sha7>` (checked at the first :17 after the push, and again one
hour later).

### F3.2 — The GPU gate (runs after F2)

**Goal.** Every push to main runs F2's harness on GitHub `macos-15`, one job per shard, Chromium with ANGLE Metal
(renderer asserted), and posts a `gpu-gate` commit status. A nightly `gpu-perf` launchd poller on Jake's Mac posts
timing and GPU bytes. Neither is a self-hosted runner (the repo is public).

**Steps.**
1. **The probe run (ci-gpu-options "First step").** `.github/workflows/gpu-probe.yml`, `workflow_dispatch` only: boots
   Driftwood phone tier with full Chromium and logs the renderer string, the time to `ws:ready`, peak RSS
   (`/usr/bin/time -l`) and the boot fingerprint. Run it once; record the numbers in E357. This sets the job timeout
   (03 §11.5). The workflow file is deleted after F3.2 lands.
2. `.github/workflows/gpu-gate.yml` exactly as 03 §11, including the Linux `asset-case` job and
   `scripts/check-asset-case.mjs` (03 §11.6; 13-lead-resolutions G15).
3. Port `scripts/test-facade-instancing.mjs` to launch with `channel: 'chromium'` (its `chromium.launch` at line 8 uses
   the headless shell, which falls back to SwiftShader on the runner). `pnpm test:gpu-boot` keeps calling it unchanged.
4. **Runner baselines.** Dispatch `gpu-gate.yml` with `record: true` on the F2 baseline SHA (the harness runs from
   main's head against a build of that SHA, 03 §8; R1-19); download the four artifacts, one per matrix job
   (`gh run download <run> -p 'parity-baselines-gh-macos15-*' -D <tmp>`, each into its own folder), merge their files
   into `test/parity/baselines/gh-macos15/`, check that all four shards are there, and commit
   `test/parity/baselines/gh-macos15/**` (R1-18).
5. **Nightly.** `scripts/gpu-perf/nightly.sh`, `scripts/gpu-perf/com.wildshard.gpu-perf.plist`,
   `scripts/gpu-perf/install.sh` (03 §14), with the Simulator memory run (`scripts/sim-memory.mjs`, 03 §14.1;
   13-lead-resolutions G2) and the soak bot (`scripts/soak.mjs`, 03 §14.2; G13, MW19). The lead runs `install.sh`
   once on Jake's Mac.
6. **Proof** (03 §9) on the runner lane: dispatch twice with no plant (green, green), then once per plant (each red).

**Done when.**
- A broken shard turns the gate red: `gh workflow run gpu-gate -f plant=boot-throw` fails the `pine-hollow` job and
  the run, and leaves the other three jobs green (a plant posts no commit status by design, 03 §11.1); a clean push
  gets `gpu-gate` = `success` within 15 minutes of the push.
- `gh api repos/Raynos/project-wildshard-singleplayer/commits/<sha>/status` lists context `gpu-gate` for every main
  commit pushed after F3.2 that was not superseded (03 §11.4).
- The hourly deploy does not move production between milestones (F3.1's check, repeated after F3.2).
- `launchctl print gui/$(id -u)/com.wildshard.gpu-perf` shows the job loaded, and its first run posts a `gpu-perf`
  status on the newest gpu-green SHA, with the Simulator memory table and the soak table in its report.
- `gh workflow run gpu-gate -f plant=asset-case` fails the `asset-case` job naming the wrong-case URL (03 §11.6), and
  a one-off `scripts/gpu-perf/nightly.sh --plant=soak-leak` reports `failure` naming the GPU-byte growth (03 §14.2; a
  plant run posts no status); both results are recorded in E357.

**Risks and rollback.** The M1 VM boots a shard slower than the 8-minute job budget: split that shard's job in two
(03 §11.5). The macOS queue stalls: pushes stay ungated (no status), deploys don't move (they're pinned), and the lead's
local run (03 §10) is the net until the queue recovers. Rollback: `git revert` of the workflow commit; the pin stays.

**Size.** M.

---

## F4 — Ratchets (MW2)

**Goal.** The rules that will fall to 0 over the plan exist on day one, with today's counts in `lint/ratchet.json`,
and a count may only go down. Adding a shard branch, a raw save, a raw random / time read or an upward import fails.

**Depends on.** F3.2 (the first push after F4 is gated).

**Interfaces.** 01 §24 (the rules and the ratchet), 01 §0 (layers, the engine word list).

**Steps.**
1. **Rules** in `lint/wildshard-plugin.js`, each a new oxlint JS rule. They run from a separate config
   `.oxlintrc.ratchet.json` (extends nothing; `jsPlugins` = the plugin; every category off; only these rules on, as
   `error`; `lint/ratchet.mjs` runs it on `src`), so the main `pnpm lint` stays at zero warnings while the counts are
   above 0:
   - `wildshard/layer`: a file's layer is its path — `src/engine/**` engine, `src/game/**` game, `src/kit/**` kit,
     `src/shards/<slug>/**` shard `<slug>`, anything else under `src/` **unlayered** (ignored by this rule; after F6 the
     only unlayered files are the composition root `src/entry.ts` and `src/main.ts`, 01 §0). Reports: an import that points up the arrow (engine → game / kit / shard, game → kit / shard,
     kit → shard); shard → another shard; a `#engine/…`, `#game/…` or `#kit/…` deep specifier from a different layer
     (01 §0 public API); in `src/engine/**`, any identifier, string literal or comment word matching the word list
     `lint/engine-words.json` (the 4 slugs, `shard`, `Shard`, `bag`, `Bag`, `coin`, `loot`, `compendium`, `feat`,
     `doubloon`, and the shard / creature / weapon names listed there: `driftwood, pine, nalati, nine, dragon, kurgan,
     titan, captain, antler, boar, bear, wolf, deer, elk, horse, crab, monkey, sailor, jian, sabre, spear, longbow,
     crossbow, rifle, naizagai, feizhua`), case-insensitive, whole words. A hit in a comment counts like one in code;
     an English false positive ("bear in mind") is fixed by rewording the comment.
   - `wildshard/no-shard-branch`, outside `src/shards/**` and (until F6) outside today's shard territories
     (`src/chunks/<slug>/**`, `src/chunks/<slug>.ts`, `src/nalati/**`, `src/pinehollow/**`): exactly the patterns of
     01 §24's list, which is the rule's one definition (R1-06). F4 writes that list as `SHARD_BRANCH` in
     `lint/wildshard-plugin.js` and adds no pattern of its own; a pattern the rule should gain is added to 01 §24 first.
     The `style` literals follow F6's rename (`'lowpoly'` → `'toon'`), so the count is unchanged.
   - `wildshard/no-raw-save`: the identifiers `localStorage` / `sessionStorage` anywhere outside `src/engine/saves/**`
     (created by F10, after the move) and `src/native/**` (`src/engine/native/**` after F6: the Capacitor save mirror
     and OTA storage; `ws.ota.*` is never reset, 01 §9, 13-lead-resolutions 02/03#2).
   - `wildshard/no-raw-random-time`: `Math.random` and `performance.now` member expressions outside `src/core/rng.ts`,
     `src/core/time.ts` (→ `src/engine/core/{rng,clock}.ts` in F8) and the allowlist in `lint/ratchet.json`
     `"allow"."wildshard/no-raw-random-time"`. The allowlist holds only files whose every `performance.now` feeds a
     measurement and never gameplay state, each with a reason: `src/core/frameCost.ts`, `src/ui/perfHud.ts`,
     `src/ui/perfProbe.ts`, `src/ui/perfLap.ts`, `src/ui/Perf.ts`, `src/boot/plan.ts`, `src/boot/timing.ts`,
     `src/boot/precompile.ts`, `src/core/lifeTrace.ts`, `src/core/errorReport.ts`, `src/boot/nineBootTrace.ts`,
     `src/boot/nineGpuTrace.ts`. `Math.random` has no allowlist (cosmetic randomness moves to the `'cosmetic'` stream,
     01 §2).
   - `wildshard/no-raw-input` (counted now, driven to 0 in X1): `addEventListener` with a type in
     `keydown keyup keypress pointerdown pointerup pointermove pointercancel mousedown mouseup mousemove wheel
     contextmenu touchstart touchmove touchend touchcancel` outside `src/core/input/**` (→ `src/engine/input/**`).
   - `wildshard/no-renderer-type` (counted now, driven to 0 in X6): the identifier `WebGLRenderer` outside
     `src/engine/render/**` (before F6: outside `src/core/Game.ts` and `src/core/bootstrap.ts`). Its start count is the
     rule's own count at F4, not the audit's "52 files" grep (13-lead-resolutions C9, 02 Q15). F6 re-keys the two
     exempt files to their moved paths (`src/engine/core/Game.ts`, `src/engine/core/bootstrap.ts`), which stay exempt
     beside `src/engine/render/**` until X6 moves their renderer code, so the move adds no count (R1-07).
   - `wildshard/sim-no-render` (01 §0 "Simulation apart from visuals", §24; decision 56; 13-lead-resolutions G12): in
     `src/engine/{combat,ai,saves,quests,effects}/**`, (a) an import from `three` of anything but the math types
     `Vector3`, `Quaternion`, `Matrix4`, `Box3`, `Ray` (type-only imports included); (b) an import of a module under
     `src/engine/{render,ui,fx,anim}/**`; (c) a read of the DOM globals `document`, `HTMLElement`,
     `HTMLCanvasElement`, `requestAnimationFrame` (the storage APIs `localStorage`, `sessionStorage` and
     `navigator.storage` stay allowed: `saves` is their one home, `wildshard/no-raw-save`). The files that draw a block (01 §18's `viewmodel`, the projectile tracer,
     `brass`, the slash trail) sit in `src/engine/combat/view/**`, which the rule skips: the block's state and rules
     live beside it in `src/engine/combat/blocks/**` and import no renderer. Today none of the five folders exists, so
     the rule's own count at F4 is 0 and every simulation module is born under it: the rows that create them (S1.2 /
     S1.3 `combat` and `effects`, S2.3 `ai`, S2.5 `quests`, F10 `saves`) cannot add a count, because a file with a
     count and no ratchet entry fails (step 2). `Boss.ts` and `Elite.ts` (04: final `src/engine/ai/`) are split by
     S2.3 into the runtime (`src/engine/ai/`) and their arena and seal visuals (`src/engine/fx/encounter/`).
2. **`lint/ratchet.mjs`** (`pnpm lint:ratchet`): runs `oxlint -c .oxlintrc.ratchet.json -f json src`, counts reports
   per rule per file, compares with `lint/ratchet.json` (`{ "<rule>": { "<file>": <count> }, "allow": {…} }`):
   a count above its entry, or any count for a file with no entry, exits 1 and prints file, rule, was, now.
   `--update` rewrites the file with the lower counts, drops entries at 0 and entries for deleted files, and refuses
   (exit 1) if any count rose. `--add-rule <rule>` (R1-07) records the counts of one rule that has no file entry yet,
   once, and refuses (exit 1) when the rule already has entries: every rule added after F4 is recorded this way (F8's
   `no-hook-chain`, `no-active-singleton`, `no-active-chunk`; F11's `no-global-listener-patch`; the later rows' rules),
   and so is `wildshard/layer` at F6, which has no entry until files are layered. The file is sorted (rule, then path)
   so diffs are readable.
3. `package.json`: `"lint:ratchet": "node lint/ratchet.mjs"`; `"test"` gains `&& node lint/ratchet.mjs` after
   `check-paths`. `scripts/vercel-tree-gate.sh` runs `pnpm test`, so the pre-push gate enforces it too.
4. Record today's counts: `node lint/ratchet.mjs --init` (the one-time write mode; refuses if the file exists) and
   commit `lint/ratchet.json`. Reference points from the audits (the rule's own count is what gets recorded): shard
   branches 269 in 70 files; raw storage 149 occurrences in 46 files; `Math.random` 250 and `performance.now` 229
   occurrences (without `src/dev`); raw input listeners 179 in 47 files; `WebGLRenderer` in 52 files; `layer` 0 (no
   layered files yet); `sim-no-render` 0 (no simulation folder yet).

**Tests added.** `test/lint-ratchet.test.ts`: runs each rule on fixtures in `test/fixtures/lint/` (one allowed and one
reported case per rule clause above; for `sim-no-render`: `import { Vector3 } from 'three'` in
`src/engine/ai/x.ts` allowed, `import { Mesh } from 'three'` there reported, the same `Mesh` import in
`src/engine/combat/view/x.ts` allowed) through `oxlint -c .oxlintrc.ratchet.json -f json`; and runs `ratchet.mjs`
against a temp ratchet file to prove a rise exits 1, a fall with `--update` lowers, a new file with a count exits 1,
and `--add-rule` records a rule with no entries and refuses one that has entries (R1-07).

**Done when.**
- `pnpm test` exits 0 on the F4 commit.
- A planted `if (chunk.slug === 'pine-hollow')` in `src/ui/HUD.ts` and a planted `localStorage.getItem('x')` in
  `src/core/Game.ts` each make `pnpm test` exit 1 naming the rule and file (the plant is not committed).

**Risks and rollback.** 01 §24's patterns are syntactic (`slug ===`, `chunk.ocean`, a slug literal), so
`no-shard-branch` needs no type information from oxlint's JS-plugin API (R1-06). Rollback: `git revert`.

**Size.** S.

---

## F5 — Actor tests (TP15, MW4)

**Goal.** A fake `Game` (no WebGL) that node tests drive; the first contract tests; a coverage ratchet on the engine
folders that may only go up (decision 68).

**Depends on.** F4.

**Interfaces.** 01 §1 (phases), §2 (clock, RNG), §9 (saves: today's stores until F10), §18 (weapons), §19 (strikes).

**Steps.**
1. Dev dependencies, exact versions, with the local virtual store flag (memory: pnpm add):
   `pnpm add -D --save-exact @vitest/coverage-v8@<V> happy-dom --config.enable-global-virtual-store=false`, where `<V>`
   is the exact `vitest` version resolved in `pnpm-lock.yaml` (coverage-v8 must equal it); `happy-dom` resolves to its
   newest release on the day and `--save-exact` pins that version in `package.json`.
2. `test/fake/FakeGame.ts`: implements the surface of `Game` that weapons, creatures and the loop use —
   `onInput`, `onFixed(pre|step|post)`, `onUpdate`, `onLate`, `hitStop`, `scene` (a real `THREE.Scene`), `camera` (a
   real `PerspectiveCamera`), `renderer` stub with `info.render` counters, a manual clock
   `advance(seconds, { fixedHz: 60 })` that runs phases in `Game.ts` order including the fixed-step accumulator and
   hit-stop slowdown, and a seeded `Math.random` replacement (`seedRandom(0x2545f491)`, mulberry32, restored after each
   test). `test/fake/fakeStorage.ts`: a `Storage` over a `Map`. `test/fake/world.ts`: a player stub, a
   `WorldRegistry`, and a Rapier-free physics stub whose `castRay` / `lineOfSight` answer from a list of boxes.
3. Contract tests (each file header says which future row turns it into a contract of the new engine):
   - `test/actor/loop.test.ts`: phase order, fixed-step count per `advance` at 30 / 60 / 144 Hz frame rates, hit-stop,
     fault isolation (a throwing system is switched off after the `faults.ts` streak; a `core` one stops the loop).
   - `test/actor/strike-timing.test.ts`: Pine's `LaneCharge` windup → hit → recover timings, and one boar strike from
     `AnimalManager` / `Animal`, asserted in fixed steps.
   - `test/actor/sword-combo.test.ts` (`// @vitest-environment happy-dom`): `Sword` from `src/player/Sword.ts` with
     `SwordMoves.ts`, three attack presses 150 ms apart → the combo steps, their active windows and damage, the queue
     behaviour when a press arrives mid-swing.
   - `test/actor/saves-roundtrip.test.ts`: today's stores (`Progress`, `Inventory`, `Purse`/`Owned`/`Bounty` via
     `game/loot/store.ts`, `Flags`) written and read back through `fakeStorage` on `globalThis.localStorage`; F10
     replaces this file with the SaveStore's contract test.
4. **Coverage ratchet.** `vitest.config.ts` (create; today there is none) with `coverage: { provider: 'v8', include:
   [<the engine folders>], reporter: ['json-summary'] }`, where the engine folders before F6 are `src/{audio,boot,core,
   entities,explore,fx,models,native,physics,player,playgrounds,practice,shard,telemetry,ui,world}/**` and after F6
   `src/engine/**`. `test/coverage-ratchet.json` holds `{ lines, statements, functions, branches }` (percent, 2
   decimals). `scripts/coverage-ratchet.mjs` compares `coverage/coverage-summary.json` with it: below → exit 1;
   above → `--update` raises it. `package.json` `"test:coverage": "vitest run --coverage && node
   scripts/coverage-ratchet.mjs"`. `.github/workflows/deploy.yml` gains a step `pnpm run test:coverage` after `Test` on
   the push / PR path. It is not in the pre-push gate (too slow for every push; CI enforces it).

5. **The proof of decision 56's split** (01 §0 "Simulation apart from visuals"; 13-lead-resolutions G12).
   `vitest.config.ts` sets `environment: 'node'` for `test/actor/**` and `test/engine/**`: no DOM, no WebGL. Only
   `sword-combo.test.ts` opts into happy-dom, because today's `Sword` builds its viewmodel at construction. From S1.2
   on, every contract test of a module under `src/engine/{combat,ai,saves,quests,effects}/**` runs in `node` (the
   fake `Game` of step 2, no renderer). With F4's `wildshard/sim-no-render` rule, that is the proof that gameplay
   state runs with no renderer, the door decision 56 keeps open for netcode.

**Tests added.** The four files in step 3 plus `test/coverage-ratchet.test.ts` (a drop exits 1, a rise with
`--update` raises).

**Done when.**
- Strike timing, a sword combo and a save round-trip run in node: the three files pass under `pnpm test`.
- `pnpm run test:coverage` exits 0 and `test/coverage-ratchet.json` holds today's measured numbers.

**Risks and rollback.** `Sword` constructs DOM listeners at import: happy-dom covers `window` / `document`; if a
module reads the URL at import (`TIER`), the test sets `location` through happy-dom's `window.happyDOM.setURL` before
the dynamic import. Rollback: `git revert` (tests only).

**Size.** M. Splittable: a subagent writes steps 2–3 while the lead does step 4.

---

## F7 — Delete the dead (TP13, TP16) — runs before F6

**Goal.** Dead code and dev copies are gone (~5,200 lines of game-side code plus the dead scripts), and every live
script reads the typed probe instead of `window.__world`.

**Depends on.** F1 (check-paths), F2 (the probe).

**Interfaces.** 01 §5 (`__world` survives until the last live script is ported; that happens here).

**Steps.**
1. **`src/dev/` and `dev/*.html`.** Delete `src/dev/` (37 files, 6,553 lines incl. `nd-lab/` 4,771) and `dev/` (20
   pages: ambient, animals, cabins, dive, driftwood, enemies, grass, loot, music, nalati-bow, nalati-creatures,
   nalati-elites, nalati-grass, nalati-melee, nalati-pois, nalati-ride, nalati-spruce, nd-lab-grapple, sword, weapon).
   Nothing in the game imports them (checked: no `src/` import outside `src/dev`), and `vite build` has no
   `rollupOptions.input` for them.
2. **What refers to them.** `.oxlintrc.json` lines 153-158 (the `src/dev/**`, `dev/**` override): delete the block.
   `scripts/check-models.mjs:310` (the `src/dev/` exemption): delete the line. `scripts/unused-assets.mjs:10,15,92,95,155`
   (the dev-only bucket reads `src/dev`, `dev/`): drop `src/dev` and `dev/` from both reads, keep `scripts/` and `test/`
   in the dev-only bucket. `scripts/blender/targets.json` target `nine-dragon-stack/fei-zhua` (lines 120-130, "Lab
   only"): delete the target, `scripts/blender/nine-dragon-stack/lab/fei_zhua.py` and
   `public/assets/nine-dragon/lab/grapple/fei-zhua.glb` (`check-model-sources` refuses an orphan script). Keep every
   other file under `public/assets/nine-dragon/lab/`: the shipped shard loads it (`def.ts:29-32`, `world/jian.ts:103`,
   `world/canopy.ts:524`, `world/build.ts:413`). `lab/grade-lut*.bin` is lab-only too: delete it only if
   `grep -rn "grade-lut" src` returns nothing after step 1.
3. **Dead game code.** `src/chunks/nine-dragon-stack/look/post.ts` (372 lines; no import anywhere outside `src/dev`,
   only comments in `look/render.ts:5`, `render/bleed.ts:2`, `render/jiehua.ts:2` name it: reword those three comments to
   "the clean room's post.ts, deleted in E357 F7; git show b1b8f9c9:src/chunks/nine-dragon-stack/look/post.ts").
   `src/player/meleeGeo.ts` lines 157-213: `RIDER` and `forearm()` (imported by nothing; the other 12 exports are used by
   `Sabre.ts`, `Spear.ts`, `nalati-grasslands/models/gear.ts`). `src/chunks/_template.ts` (146 lines; imported by
   nothing; `bake-chunk.mjs:39` and `bake-sky.mjs:24` only exclude it by name — drop `_template` from both regexes, which
   re-stamps nothing since F1 step 7 took the bakers' own source out of their hashes (R1-20); its
   role passes to Z1's `src/shards/_template/`; `ChunkDef.ts:16`'s comment points at `docs/SHARDS.md` instead).
   The 7 images under `src/explore/img/` that nothing shows (04 Q7, 13-lead-resolutions 04#7): `practice.jpg`,
   `models.webp`, `world.webp` (`extras.ts`'s ART glob preloads them; no code displays them) and
   `mockups/{lookout,shrine,spawn,wreck}.jpg` (no `Compare.ts` pair names them). The three preloaded ones leave the
   boot's preload list: `test/parity/renames/F7.json` lists them as removed (the only fingerprint change F7 makes).
   **The shard specs' dead files join this one list** (13-lead-resolutions still-open 05#7 / 07#8 / 08#8), so every
   dead-code deletion is in this one reviewed row:
   - `src/chunks/nine-dragon-stack/world/hero/paifang.ts` (267 lines; 05 §1.1): imported by nothing in `src/`,
     `test/` or `scripts/` (a clean-room copy that `world/gate.ts` superseded). Reword the comment at `world/gate.ts:2`
     to "grown from the hero lab's paifang (deleted in E357 F7; git show b1b8f9c9:src/chunks/nine-dragon-stack/world/hero/paifang.ts)".
   - `src/world/spruceMask.ts` (79 lines; 07 §1.3): its only importer is `src/dev/nalati-spruce.ts`, deleted in step 1.
     Reword the comments at `src/world/Spruce.ts:14` and `src/chunks/ChunkDef.ts:263` so they no longer name it (the
     forest mask stays a manifest function; Nalati's is `loneSpruceMask` / `edgeSpruceMask`).
   - `src/world/interact/validate.ts` (67 lines; 08 §1.1) is **checked and kept, not deleted**: `grep -rn
     "interact/validate" test` shows `test/interact.test.ts:5` and `test/pine-quest.test.ts:6` import `validateTable`,
     which validates Driftwood's and Pine Hollow's interactable tables and has its own "catches a broken table"
     cases. It is a live, pure (no three, no DOM) engine validator, so it follows 04's row
     (`src/engine/world/interact/validate.ts`, rule F). The F7 commit message records this verdict beside the list.
   - The step reruns `grep -rn "<file stem>" src test scripts` for each file on the day, and deletes a file only when
     the grep shows no importer (comments excepted).
   The reviewed move map (`docs/plans/game-normalization/move-map.json`) gets the same form for every file F7 deletes
   that `src/chunks/_template.ts`'s row already has (`"f6": null, "final": null, "layer": "deleted", "row": "F7"`):
   the 7 images, `paifang.ts` and `spruceMask.ts`. The rows are rewritten in the F7 commit, so F6's classifier check
   (F6 step 1) finds no row for a file that is gone.
4. **Scripts: liveness by decision 88** (which revises 46; 13-lead-resolutions 02/03#3). Commit
   `scripts/normalize/liveness.mjs`, which computes, for every entry of `scripts/` (top-level files and folders), whether
   it is **live**. An entry is live when it is **referenced** (the first two bullets, or the last) or when it was
   **run in the last 5 days and is not a one-off of a finished ask** (the third bullet). A one-off of a finished ask is
   an entry whose name starts with an ask id (`e<NNN>-` / `E<NNN>-`, case-insensitive) whose ask is `done` or
   `dropped` (the `**Status:**` line of `docs/tasks/asks/E<NNN>.md`, else its row in `docs/tasks/ASKS.md`):
   - named (as `scripts/<name>`, or `./<name>` inside another script) by `package.json`, `.githooks/*`,
     `.claude/hooks/*`, `.claude/settings.json`, `.github/workflows/*`, `.claude/skills/**`, `vite.config.ts`, `vite/**`,
     `test/**`, `api-tests/**`, or the living docs (`AGENTS.md`, `README.md`, `docs/*.md`, `docs/design/**`,
     `docs/plans/**`, the auto-memory folder `~/.claude/projects/-Users-raynos-projects-games-wildshard-singleplayer/memory/`);
   - or a `.d.mts` next to a live `.mjs`;
   - or **executed** in the 5 days before the run, and not a one-off of a finished ask: a Bash tool call in any Claude transcript under
     `~/.claude/projects/*wildshard*/**/*.jsonl`, or a shell call in a Codex session whose `cwd` contains `wildshard`,
     whose command runs the script (its executable is the script, or `node` / `bash` / `sh` / `python3` / `uv run` /
     `npx` / `pnpm exec` followed after options by it, also behind `lockf -k <file>`, `caffeinate`, `timeout <n>`,
     `scripts/browser-lane.sh [--max <n>]`, `run-locked.sh <log>`); reads like `cat`, `sed`, `grep` do not count;
   - or named by another live script (transitive, to a fixpoint).
   The history docs (`docs/tasks/**`, `docs/audits/**`, `project/**`, `progress/**`) do not make a script live.
   Run it on the day F7 executes; delete every entry it reports as not live (`git rm` is allowed here only for files
   the lead confirms are listed; each deletion is in the commit message list).
   **Projection.** The scratch run on today's tree used decision 46's 14-day clause: 185 entries, 66 live by a hard
   source, 29 more by the living docs, 87 more only by an execution since 2026-09-16, 3 not live. Under decision 88 the
   87 execution-only entries are live only if run in the last 5 days and not a finished ask's one-off, so the deletion
   list grows (the tooling audit's narrower one-off rule alone projected ~40). F7 runs
   `node scripts/normalize/liveness.mjs --dry-run` first, records the list and its count in E357, and the lead reads it
   before step 4's deletions.
5. **Port live scripts to the probe.** `scripts/normalize/port-probe.mjs` rewrites, in every live script (115 script
   files read `__world` today), `window.__world` → `window.__wildshard.world` and bare `__world` → `__wildshard.world`
   (inside `page.evaluate` strings and functions alike); then `grep -rn "__world" scripts` must print nothing. Then
   delete the alias line `debug.__world = handle` in `src/main.ts` and the `window.__world = world` line in
   `installProbe`, and delete `__world` from `scripts/types/wildshard-probe.d.ts`. The other 51 `window.__*` names
   (`__loot`, `__pine*`, `__nalati*` …) stay until the row that moves their owner; each such row ports its scripts.
   Each ported script that is typechecked (`scripts/tsconfig.json` include) must pass `tsc -p scripts`.
   **The living docs that teach `window.__world` are ported in the same commit (R1-55)**, by the same rewrite to
   `window.__wildshard.world`: `docs/SUBAGENT-BRIEF.md:98` (the subagent brief template), `docs/RUNNING.md:28,36`,
   `docs/BENCH.md:26`, `docs/design/scorecard.md`, `docs/design/LOOK-LOOP.md`, `docs/design/nalati/look-pass.md`, and
   any hit in `AGENTS.md`, `README.md` or `.claude/skills/**` on the day. The engine-fit-v2 research files and the
   history folders quote today's code and are not touched.
6. **`scripts/README.md`** (new): one line per surviving entry, grouped as in the tooling audit §2 (bake, check,
   infra, bench, gameplay verify, test harness, capture, one-off `eNNN`, other, folders), generated by
   `node scripts/normalize/liveness.mjs --readme` and checked by `--readme --check` in `pnpm test`.

**Tests added.** `test/liveness.test.ts`: the classifier on a fixture tree (a script named only by an ask file is not
live; a script run under `lockf -k` is live; a `.d.mts` beside a live `.mjs` is live).

**Done when.**
- `test -e src/dev || test -e dev` fails (both gone); `grep -rn "src/dev\|nd-lab" scripts src .oxlintrc.json` prints
  nothing.
- `node scripts/check-paths.mjs` and `pnpm test` exit 0.
- `grep -rn "__world" scripts src` prints nothing, and `grep -rln "__world" docs AGENTS.md README.md .claude/skills |
  grep -v "^docs/design/engine-fit-v2/\|^docs/tasks/\|^docs/audits/\|^docs/plans/"` prints nothing (R1-55).
- The parity run (03 §10) is green: the fingerprint is identical under `test/parity/renames/F7.json` (the three
  preloaded images are the only change; nothing else deleted was reachable at runtime).
- `git diff --stat <before>..<after> -- src dev` shows ≥ 5,200 deleted lines (src/dev 6,553 + post.ts 372 + meleeGeo
  57 + _template 146 + paifang 267 + spruceMask 79).
- `test -e src/chunks/nine-dragon-stack/world/hero/paifang.ts || test -e src/world/spruceMask.ts` fails (both gone),
  `test/interact.test.ts` and `test/pine-quest.test.ts` still pass (`validate.ts` kept), and `move-map.json` has a
  `deleted` / `F7` row for every file F7 deleted.

**Risks and rollback.** A script some agent still runs by hand is deleted: it is in git history
(`git show <sha>^:scripts/<name>`). Rollback: `git revert` of the deletion commit.

**Size.** S (steps 1–4, 6) + the port (step 5) is mechanical; the whole row stays S.

---

## F6 — The big move (TP7–TP12)

**Goal.** The four layers exist on disk: engine folders under `src/engine/`, `src/game/` as the game layer,
`src/kit/` created, one folder per shard under `src/shards/<slug>/` holding its manifest and every single-shard file,
tests under `test/shards/<slug>/`, done by a codemod from one committed mapping table; every layer violation is a
ratchet count; parity green; the bakers bake the same bytes.

**Depends on.** F1, F2, F3.2, F4, F5, F7.

**Interfaces.** 01 §0 (layers, aliases), §6 (ShardManifest), §24 (ratchet). The TP audit §1 (what breaks).

**Steps.**
1. **The map and its check.** The codemod's only input is the reviewed map
   [`docs/plans/game-normalization/move-map.json`](move-map.json) (04; 13-lead-resolutions 04#2). The classifier
   `scripts/normalize/classify.mjs` is a **check, never a writer**: it builds the import graph of `src/**/*.ts` (static
   `import` / `export … from`, dynamic `import('…')`, relative and `#` specifiers) with the TypeScript compiler API
   (`ts.createSourceFile`, no type check), re-derives every file's destination by the rules below, and exits 1 on any
   row that differs from the reviewed map. Where 04 departs from these rules (04 §1.5), 04 wins and the rules are
   corrected to agree (13-lead-resolutions 04#8–#10). The rules, in order:
   1. **Shard territory** (by path): `src/chunks/<slug>.ts` → `src/shards/<slug>/manifest.ts`;
      `src/chunks/<slug>/**` → `src/shards/<slug>/**`; `src/chunks/nine-dragon-stack/def.ts` →
      `src/shards/nine-dragon-stack/manifest.ts`; `src/nalati/**` → `src/shards/nalati-grasslands/**`;
      `src/pinehollow/**` → `src/shards/pine-hollow/**`; `src/chunks/nalatiLayout.ts` →
      `src/shards/nalati-grasslands/layout.ts`; `src/chunks/nalatiEdge.ts` → `src/shards/nalati-grasslands/edge.ts`;
      `src/chunks/pineHollowLayout.ts` → `src/shards/pine-hollow/layout.ts`; `src/chunks/thumbs/<slug>*.jpg` →
      `src/shards/<slug>/thumbs/`.
   1b. **Interim exceptions** (04 §1.3, E1–E6): the species files and the creature stack they import wait for S2.3 /
      S3.4 / S4.2 (`AnimalFactory.ts:15` registers them through one folder-wide glob); the weapon files wait for the
      families (S1.2 / S2.2 / S3.3); `src/explore/img/mockups/*.jpg` wait for each shard's `manifest.explore.compare`
      (S1.1–S4.1); `Boss.ts`, `Elite.ts` and the quest core stay in `src/game/` until S2.3 / S2.5; the Nine Dragon boot
      traces keep their names until S1.1; the resident host waits for F11. Each takes 04's interim path.
   2. **Single-shard by importers.** A file outside rule 1 whose every non-test importer is in one shard's destination
      (to a fixpoint) goes to `src/shards/<slug>/<its folder under src/>/<file>` (e.g. `src/world/nalati/Bowl.ts` →
      `src/shards/nalati-grasslands/world/nalati/Bowl.ts`). Today this rule alone finds 57 files, ~10.6k lines (Nalati 49 /
      9,420; Pine Hollow 7 / 1,146; Driftwood 1 / 89); rule 1b and rule 5 take some of them back (04 §2 has the result per
      file).
   3. **Single-shard by gate.** A file outside rules 1–2 whose every import site is in engine files and whose every
      referenced import is used only inside a conditional (`if`, `?:`, `&&`, `||`) whose test mentions one shard's
      gate identifiers: Driftwood `isOcean`, `sea`, `chunk.ocean`, `slug === 'driftwood-isle'`; Pine `isPine`,
      `slug === 'pine-hollow'`; Nalati `painterly`, `nalatiNow`, `style === 'painterly'`,
      `slug === 'nalati-grasslands'`; Nine `isNine`, `built`, `chunk.structures`, `slug === 'nine-dragon-stack'`.
      Expected, from `src/main.ts` today: the Driftwood world builders `src/world/{Ocean,Pier,Boat,Hut,Lookout,Wreck,
      Shrine,Cove,Palms,BlenderIsland,RopeBridge,Seabed,Boulders,Bushes,Trailside,GroundCover}.ts`,
      `src/entities/Enemies.ts`, `src/player/IronSword.ts`, `src/audio/IslandAmbience.ts`, `src/audio/ShrineHum.ts`, and
      Pine Hollow's `src/world/PineStreams.ts`.
   4. **Named single-shard.** A file outside rules 1–3 whose name contains a shard token (`Pine`, `pine`, `Nalati`,
      `nalati`, `Nine`, `nine`, `Driftwood`, `driftwood`, `Island`, `Steppe`) and whose importers are that shard's files
      or engine files only: that shard. Expected: `src/world/{PineCrags,PineLandmarks,PineDayNight,pineSkyKeys,
      pineHero,nalatiTextures,driftwood}.ts`, `src/entities/{pineCreatures,pineCreatureRigs,pineCoats}.ts`,
      `src/audio/{PineHollowSfx,SteppeScore}.ts`, `src/player/{nalatiArms,nalatiKit}.ts`,
      `src/ui/compendium/shards/pine-hollow.ts`, `src/world/interact/driftwood.ts`, `src/game/quest/driftwood.ts`,
      `src/world/nalati/{glbPaint,paint,layout}.ts`.
   5. **Stays engine (mechanism) — overrides rules 2–4.** A loader, builder, geometry helper or runtime with no shard
      data stays in the engine even when one shard uses it today (01 §2.1 mechanism vs content): `src/models/glb.ts`,
      `src/models/hull.ts`, `src/models/slots.ts` (`SlotGeometry`), `src/chunks/fauna-layout.ts` (→
      `src/engine/world/faunaLayout.ts`, a placement primitive), `src/world/fx.ts`, `src/physics/paths.ts`, `src/physics/ropeChain.ts`,
      `src/boot/nineBootTrace.ts` and `src/boot/nineGpuTrace.ts` (a generic boot trace a manifest flag turns on,
      EI5, renamed in S1.1). The override list is a const array in `classify.mjs`; adding to it needs a one-line
      reason in the array. Not overridden, on purpose: `src/world/Weather.ts`, `WeatherFX.ts` (Nalati) and
      `PineWeather.ts`, `PineWeatherFX.ts` (Pine) are two separate content stacks today, so rule 2 sends each to its
      shard; S2.4 builds the engine `Weather` mechanism and the kit FX from them.
   6. **Everything else by folder:**

      | Today | After F6 |
      |---|---|
      | `src/{audio,boot,core,entities,explore,fx,models,native,physics,player,playgrounds,practice,shard,telemetry,ui,world}/**` | `src/engine/<same>/**` |
      | `src/pwa/sw.js` | `src/engine/pwa/sw.js` |
      | `src/main.ts` | `src/main.ts`, unchanged: the **composition root**, outside the layers (01 §0; 13-lead-resolutions 04#12). S4.4 cuts it to ≤ 20 lines and moves the generic boot into `src/engine/boot.ts` (≤ 150) |
      | `src/boot/entry.ts` | `src/entry.ts`: the page's module entry, the composition root's other half, outside the layers (01 §0; 13-lead-resolutions C6). An exception to the `src/boot/**` → `src/engine/boot/**` row above; moved as is (its `retried()` helper moves into the engine later, at 10 X3 step 9) |
      | `src/meshopt-simplifier.d.ts`, `src/n8ao.d.ts` | `src/engine/types/` |
      | `src/chunks/ChunkDef.ts` | `src/game/shard/manifest.ts` (step 4) |
      | `src/chunks/registry.ts` | `src/game/shard/registry.ts` (replaced by F9's generated registry) |
      | `src/chunks/terrain.ts` | `src/engine/world/terrainField.ts` (the shared landscape maths every terrain shard uses) |
      | `src/chunks/fauna-layout.ts` | `src/engine/world/faunaLayout.ts` (rule 5; 04 §1.5 #2) |
| `src/ui/titleDeck.ts`, `src/shard/switch.ts` | `src/game/titleDeck.ts`, `src/game/travel/switch.ts` (Wildshard ideas, 01 §20; 13-lead-resolutions 04#11) |
      | `src/game/**` | `src/game/**` (unchanged path; it becomes the `#game` layer). The engine runtimes inside it (`Boss.ts`, `Elite.ts`, `quest/core.ts`, `quest/quest.ts`, `quest/QuestUI.ts`) move to `src/engine/` in the rows that build those runtimes (S2.3, S2.5) |
      | `src/chunks/nine-dragon-stack/vm/rig.ts`, `src/player/rigArms.ts`, `src/world/GrassField.ts`, `src/world/GrassTrample.ts`, `src/world/Particles.ts` | `src/kit/viewmodel/armRig.ts`, `src/kit/viewmodel/rigArms.ts`, `src/kit/looks/grassField.ts`, `src/kit/looks/trample.ts`, `src/kit/looks/particles.ts` (13-lead-resolutions 04#9: the 5 files 2+ shards already use; 04 §2 has each today path). Beside `src/kit/index.ts` (from F1), nothing else: the rest of the kit moves in the rows that restructure it (weapons S1.2 / S2.2, species S2.3, the rain curtain S2.4, `#kit/npc` S2.5) |
      | `test/<shard-importing>.test.ts` | `test/shards/<slug>/` (step 6) |

   The reviewed map's `files` rows have the keys `from · lines · bytes · f6 · final · layer · rule · row · why` (04 §0;
   R1-05): the codemod moves `from` to `f6` (a row with `"f6": null` was deleted by F7 and is skipped), `final` is the
   end-state path a later row moves it to, and `lines` / `bytes` record the file's size on the map's tree. The check
   also exits 1 on any destination collision (two sources, one target, case-insensitive) or any `src/` file left
   unmapped. The map was committed with 04, before the move; the lead re-runs the check on the day F6 executes (a
   file added since 04's tree gets a row by 04 §1's rules first). **One amendment before the move**
   (13-lead-resolutions C6): the committed
   map still sends `src/boot/entry.ts` to `src/engine/boot/entry.ts` (its file row and its `index.html` line-137
   rewrite). The lead's map commit changes both to `src/entry.ts` (`"layer": "root"`, `"rule": "C6"`), and
   `classify.mjs`'s rule 6 gains the same one-line exception, so check and map agree. F7 already rewrote the rows of
   the files it deleted (F7 step 3).
2. **The codemod** `scripts/normalize/move.mjs docs/plans/game-normalization/move-map.json`, idempotent (a second run changes nothing).
   **Safe to run, safe to undo (R1-54).** It refuses to start unless `git status --porcelain` is empty (a clean tree;
   under the lock every path is the lead's). `move.mjs --dry-run` first writes the full list of paths the run will
   touch (every `from`, every `f6`, every file it rewrites) to `scripts/normalize/move.dry-run.json`, and the lead
   commits that list on its own before the real run. A run that stops half-way is undone by restoring exactly those
   paths: `git restore --source=HEAD --staged --worktree -- <every listed path that exists in HEAD>`, then `git rm -f
   -q -- <every listed destination that does not>`; never a tree-wide restore.
   1. `git mv` every row, creating each destination folder first (`mkdir -p`).
   2. Rewrite imports in `src/**` and `test/**`: an import between two files of the same layer folder stays relative
      (recomputed); an import across layers becomes an alias — `#engine/<path>`, `#game/<path>`, `#kit/<path>`,
      `#shards/<slug>/<path>` (deep aliases are allowed now; `wildshard/layer` counts them, step 5). **Asset imports
      (R1-21).** The shard art the map moves (the card thumbs to `src/shards/<slug>/thumbs/`, the Explore and
      playground images to `src/shards/<slug>/explore/`) is imported by its own shard's manifest, relative, into
      `card` and `explore`. The title deck and Explore end up reading those URLs from the manifests: the title deck
      at F9 (until then a manifest import would pull the world modules into the opening document, `titleDeck.ts:15`),
      Explore as each S row moves its shard's art map (04's `Explore.ts` row). Until then their remaining
      cross-layer asset imports keep the file's own extension (`#shards/<slug>/thumbs/<x>.jpg`, F1's
      extension-preserving entries) and are counted by `wildshard/layer`.
   3. Rewrite `import.meta.glob` patterns (the 14 of F1), `?raw` / `?url` imports, and `readFileSync` paths in tests.
   4. Rewrite path strings with the map: every file `check-paths` scans (scripts, `vite.config.ts`, `vite/**`,
      `.oxlintrc.json`, `scripts/blender/targets.json` `sources` / `feeds`, `scripts/check-models.mjs`'s folder rules and
      81 allowlisted paths, `bake-chunk.mjs`'s `shared` + `EXTRA_DEPS`, `bake-textures.mjs` `SOURCES`, `bake-cards.mjs`
      `inputs`), `index.html` (`/src/boot/entry.ts` → `/src/entry.ts`: `index.html` loads `/src/entry.ts`, 01 §0),
      `vite.config.ts`'s native plugin strings (`/src/boot/entry.ts` → `/src/entry.ts`, `/src/native/boot.ts`,
      `/src/boot/sw.ts`, `/src/ui/Update.ts`) and its generated
      outputs (`src/boot/*.generated.ts` → `src/engine/boot/`), `writeArtModule`'s folders (`src/chunks/thumbs` →
      every `src/shards/*/thumbs`), `.oxlintrc.json`'s ignore `src/boot/bytes.generated.ts`, `lint/ratchet.json` keys,
      `test/coverage-ratchet.json` scope.
   5. Rewrite path mentions in comments under `src/**`, `test/**`, `scripts/**` and in the living docs (`AGENTS.md`,
      `README.md`, `docs/*.md`, `docs/design/**`, `docs/plans/**`, `.claude/skills/**`). History (`docs/tasks/**`,
      `docs/audits/**`, `project/**`, `progress/**`, `art/**`) is not touched. `docs/MOVED.md` is generated: the full
      old → new table, so a history link can be followed.
3. **Shard discovery for the bakers, before F9.** `bake-chunk.mjs:39` and `bake-sky.mjs:24` list
   `src/shards/*/manifest.ts` and skip a manifest with `ground.structures` (equivalent to today: Nine Dragon was never
   a top-level `src/chunks/*.ts`, so it was never baked). `bake-packs.mjs:46`, `bake-ktx2.mjs:85`,
   `bake-navmesh.mjs:93/398` and `unused-assets.mjs:37` keep importing the `CHUNKS` export, now from
   `src/game/shard/registry.ts` (still the 3 shards, Nine Dragon in `PROTOTYPES`). F9 replaces both with the registry.
4. **`ChunkDef` → `ShardManifest`.** In `src/game/shard/manifest.ts` the interface is renamed `ShardManifest` and its
   fields are renamed and regrouped by the table below (one row per `ChunkDef` field, in `ChunkDef.ts`'s declaration order). Fields
   01 §6 adds that have no `ChunkDef` source (`api`, `uses`, `tiers`, `budgets`, `loadout`, `species`, `encounters`,
   `audio`, `input`, `boot`, `load`) are **absent** from the F6 type and are added by the row named in the last
   column of the table below or its footnote; there are no optional stubs. `type ChunkDef = ShardManifest` is not
   kept: every user is rewritten (tsc finds them).
5. **The layer counts (R1-07).** After the move, in this order: (a) step 2.4 has re-keyed `lint/ratchet.json`'s
   entries to the moved paths (the `no-renderer-type` exemption included, F4 step 1); (b) `node lint/ratchet.mjs
   --add-rule wildshard/layer` records the first `wildshard/layer` counts per file (the rule has no entry before F6,
   so this is its one recording); (c) `node lint/ratchet.mjs --update` then runs as the post-move check and must only
   lower counts. Commit `lint/ratchet.json` with the move.
6. **Tests** (TP11; 04 §4; 13-lead-resolutions 04#6): a test moves when its subject is a shard's code. **34** files
   move to `test/shards/<slug>/`: Nine Dragon 3 (`bag-tabs`, `nd-specimen-light`, `nine-dragon-models`); Pine Hollow 15
   (`models-pine-hollow`, `pine-audio-wiring`, `pine-bag`, `pine-beaver-pool`, `pine-combat`, `pine-crags`,
   `pine-day-night`, `pine-hollow-roster`, `pine-life`, `pine-loadout`, `pine-npc-rig`, `pine-quest`, `pine-sfx-sprite`,
   `pine-weather`, `token-shelf`); Nalati 9 (`horse-names`, `nalati-bag`, `nalati-models`, `nalati-navmesh`,
   `nalati-roster`, `quest-nalati`, `ride-assist`, `steppe-score`, `weather`); Driftwood 7 (`ecology`, `guards`,
   `gull-guide`, `keepsakes`, `models-contract`, `models-driftwood`, `shop`). The other 83 stay, their imports
   rewritten: `models-rosters` spans every shard; `fight-rules`, `hit-damage`, `loot` are engine tests using Driftwood as
   a fixture (Z1 points them at the template). The 12 source-scanning tests keep F1's non-empty asserts.
7. **Remove the F1 spike import** from `src/main.ts` (real `#engine` imports exist now).

**Mapping: `ChunkDef` field → `ShardManifest` field.** D = Driftwood, P = Pine Hollow, N = Nalati, 9 = Nine Dragon (who
sets it today). "Kept" means the name and type are unchanged at F6.

| # | `ChunkDef` field | Set by | F6 `ShardManifest` field | End state (row that converts it) |
|---|---|---|---|---|
| 1 | `id` (`chunk://local/<slug>`) | D P N 9 | removed; `legacyShardId(slug)` in `src/game/shard/manifest.ts` returns the same string for the 7 stores that key saves by it (`Progress`, `Inventory`, `Owned`, `Purse`, `Bounty`, compendium, `Boss`) | helper deleted in F10 (saves reset, keyed by slug) |
| 2 | `slug` | D P N 9 | `slug: ShardSlug` (`ShardSlug` = the 4 literals by hand until F9 generates it) | F9 generates the union |
| 3 | `displayName` | D P N 9 | `name` | — |
| 4 | `gridCoords` (string `(−1, +6)`) | D P N 9 | `label` (today's exact string, unchanged: U+2212 minus, `+` sign) and `placement: { grid, size }` (`grid` parsed: D `[-1, 6]`, P `[3, -2]`, N `[4, -2]`, 9 `[-2, 1]`; `size: [500, 500, 500]`); `formatGrid(placement.grid)` must equal `label` (01 §6; 13-lead-resolutions 05/06#1) | — |
| 5 | `seed` | D P N 9 | `seed` (01 §6) | F8 seeds `app.rng` from it when no harness seed is set |
| 6 | `treeCount` | D P N 9 | `treeCount` (kept, carried as data: 13-lead-resolutions 05/06#1) | — |
| 7 | `biome` | D P N 9 | `biome` (01 §6; the title deck's card line) | — |
| 8 | `blurb` | D P N 9 | `blurb` | — |
| 9 | `experimental` | 9 | `status: 'experimental'` | — |
| 10 | `earlyAccess` | N | `status: 'earlyAccess'`; D and P get `status: 'live'` | — |
| 11 | `thumbnail` | D P N 9 | `card.thumb` | — |
| 12 | `heroPortrait` | D P N 9 | `card.portrait` | — |
| 13 | `heroLandscape` | D P N 9 | `card.landscape` | — |
| 14 | `terrain: ChunkTerrain` | D P N 9 | `ground.terrain` (`TerrainSpec` = today's `ChunkTerrain`) | — (Nine Dragon keeps its flat terrain beside `structures`: 01 §6, "Nine Dragon has both today") |
| 15 | `assets` | P N 9 | `assets` (kept, carried as data) | S1.1 drops Nine Dragon's (never downloaded, `def.ts:63`) |
| 16 | `trees` | D P N 9 | `trees` (kept, carried as data) | S1.1 drops Nine Dragon's (`factory: 'none'`) |
| 17 | `forest` | P N 9 | `forest` (kept, carried as data) | S1.1 drops Nine Dragon's (`density: () => 0`) |
| 18 | `fauna: HerdPlan[]` | D P N 9 (N and 9 empty) | `spawns` (renamed, same `HerdPlan[]`: 01 §6) | S2.3: `species` + `encounters` (spawn `WeightedTable`s) |
| 19 | `faunaTuning` | D | `faunaTuning` (kept) | S2.3 (Pine first) / S4.2 (Driftwood's boars): species rows with a `parent` |
| 20 | `maxHitDamage` | D | `fight.maxHitDamage` | — |
| 21 | `hitCapExempt` (kinds) | D | `fight.capExempt` (string kinds at F6) | S1.3: `Tag[]` (`'boss.drowned-captain'`) |
| 22 | `loot: { coins }` | D | `loot` (kept, carried as data: 01 §6) | S4.3 / `#game` loot rows |
| 23 | `bodyShadow` | D | `bodyShadow` (kept) | S4.3: Driftwood's plugin adds the body shadow |
| 24 | `fightRules: { maxAttackers }` | D | `fight.attackers` | — |
| 25 | `sky` | D P N 9 | `sky` | — |
| 26 | `atmosphere` | D P N 9 | `atmosphere` | — |
| 27 | `grade` | D P N 9 | `grade` | — |
| 28 | `look: ChunkLook` | P | `look` (kept) | S2.1: into Pine's `LookStrategy` |
| 29 | `spawn` | D P N 9 | `spawn` | — |
| 30 | `style` (omitted = `'pbr'`) | D `lowpoly`, N `painterly` | `style` required: D `'toon'` (F6 maps `lowpoly` → `toon`; the codemod rewrites every `'lowpoly'` style literal to `'toon'`, so the branch count is unchanged), P `'pbr'`, N `'painterly'`, 9 `'pbr'` (13-lead-resolutions 02/03#1) | S1.1: Nine Dragon `'jiehua'` (05 §3) |
| 31 | `weapon` (omitted = `'crossbow'`) | D `sword`, N `nalati`, 9 `sword` | `weapon` required: D `'sword'`, P `'crossbow'`, N `'nalati'`, 9 `'sword'` | S1.2 (Nine), S2.2 (Pine), S3.3 (Nalati; fixes bug §7.5), S4.1 (Driftwood): `loadout` |
| 32 | `hud: { dayBadge }` | N | `hud` (kept) | X2: Nalati's plugin adds the badge widget |
| 33 | `horizon` | N 9 | `horizon` (kept) | X5: `LookStrategy.backdrop` |
| 34 | `groundColor` | N | `groundColor` (kept, carried as data) | S3.2: `LookStrategy.terrainPainter` |
| 35 | `surfaceAt` | N | `surfaceAt` (kept, carried as data) | S3.2: `LookStrategy.terrainPainter` |
| 36 | `ocean: OceanDef` | D | `ocean` (kept) | S4.1: a `WaterBody` row, the sea (01 §6, §17: the interface is built in S4.1) |
| 37 | `pondClip` | P | `pondClip` (kept, carried as data) | S2.1 / X5: `WaterBody` |
| 38 | `map: ChunkMapDef` | D 9 | `minimap` (renamed: `map` now means the Wildshard map place, 01 §6) | X2 |
| 39 | `pois` | D P N | `pois` (kept, carried as data: 01 §6) | — |
| 40 | `explore: boolean` | D P N 9 (all true) | `explore: ExploreSpec` (present = offered; at F6 it carries the URLs of the shard's Explore images, imported by the manifest from `src/shards/<slug>/explore/`, R1-21; the compare pairs join it in S1.1–S4.1 and X3) | X3: Explore art from `boot.explore` |
| 41 | `render` | 9 | `render` | S1–S4: every shard gets one |
| 42 | `structures: ChunkStructures` | 9 | `ground.structures` (the builder thunk and `files`) | S1.1: the builder → the plugin's world build; `files` → `boot.files` |
| 43 | `bounds` | 9 | `bounds` | — |
| 44 | `sword` (lazy) | D 9 | `sword` (kept, lazy, node-safe) | S1.2 (9) / S4.1 (D): the plugin |
| 45 | `roster` (lazy) | D P N 9 | `roster` | — |
| 46 | `fieldModels` (lazy) | P | `fieldModels` (kept) | S2.1: the plugin |
| 47 | `traversal` | 9 | `traversal` (kept) | S1.4: the Fei Zhua Tool and the grapple input context |
| 48 | `fov: { portrait }` | 9 | `camera.portraitFov` (01 §6; the camera's field, not the weapon's) | — |
| — | (new) `order` | — | D 1, P 2, N 3, 9 4 (1-based, as 05–08 §3; today's `TITLE_CARDS` order, `src/ui/titleDeck.ts:47-52`) | — |

`ground` at F6 is `{ terrain?: TerrainSpec; structures?: ChunkStructures }`, at least one set (01 §6;
13-lead-resolutions 02/03#1), where `TerrainSpec` is today's `ChunkTerrain`. S1.1 moves Nine Dragon's builder into its
plugin, which leaves 01 §6's `structures: true` (beside its flat `terrain`). Added later by their rows: `api` (F9), `uses` (the first S row that needs each mechanism: S2.4
`weather` / `dayCycle`, S2.3 `elites` / `bosses`, S2.5 `quests`), `tiers` (S1.1 Nine's AO, S2.1 Pine's override, X7),
`budgets` (S1.6), `loadout` (row 31), `species` / `encounters` (row 18), `audio` (S1.5, S3.5), `input` (S1.4), `boot`
(S1.1 Nine's fragile-boot data, X3), `load` (S1.1).

**Tests added.** `test/manifest-map.test.ts`: for each of the 4 manifests, `label` equals the old `gridCoords` string
(hard-coded in the test) and `formatGrid(placement.grid) === label`, `status` matches the old flags, and every field in the table is present
with its old value (the old values are inlined as fixtures in the test file, taken from `b1b8f9c9`).

**Done when.**
- `node scripts/normalize/classify.mjs --check` exits 0 (the re-derived map equals the reviewed one, no unmapped `src/`
  file, no collision) and `node scripts/normalize/move.mjs docs/plans/game-normalization/move-map.json` run a second
  time changes nothing (`git status` clean).
- `find src -maxdepth 1 -mindepth 1 | sort` prints exactly `src/engine src/entry.ts src/game src/kit src/main.ts
  src/shards`, and `grep -n "/src/entry.ts" index.html` prints the module script line.
- `pnpm test`, `pnpm run typecheck`, `pnpm run lint`, `node scripts/check-css.mjs`, `pnpm exec vite build` exit 0;
  `lint/ratchet.json` has a count for every layer violation and `pnpm lint:ratchet` exits 0.
- **Bakers bake the same bytes** (their stamps hash inputs, not their own source, since F1 step 7; R1-20): after `pnpm
  exec vite build` on the moved tree, `git status --porcelain public/assets
  src` prints nothing (terrain, sky, packs, generated modules unchanged), and `node --experimental-transform-types
  --import ./scripts/bake-loader.mjs scripts/bake-navmesh.mjs --check` exits 0.
- The parity run (03 §10) is green on both lanes with **no** rename map (the move changes no system label, key or
  registry id).

**Risks and rollback.** The codemod misses a path in a string that only runs at a later date (a nightly script):
`check-paths` covers string literals; a computed path (`join('src', x)`) is found by `grep -rn "'src'" scripts` during
step 2 and fixed by hand. A Vite chunk graph change (aliases can alter chunk boundaries): the parity fingerprint does not
see chunk names; the lead compares `ls dist/assets/*.js | wc -l` and the main chunk's byte size before / after
(±1 %). A half-applied, uncommitted run: undone from the committed dry-run list (step 2; R1-54). Rollback: `git
revert` of the move commit (the map commit and the dry-run list stay; they are data), **only until F8's first commit**.
From then on F8 builds on the new paths, so a break the move caused (a rarely run script or baker) is fixed forward,
with a test, in a commit that cites F6: the one exception to 12 §5's revert rule (R1-54).

**Size.** L. The classifier and codemod may be written by one subagent (disjoint: `scripts/normalize/`); the run, the
review of the map and the commit are the lead's.

---

## F8 — The spine (EI1, EI2, EI17, EI20)

**Goal.** App systems with ids, ordering and run conditions; app states; the typed event bus (`emit` / `ask`); typed
services on the app; the per-shard `Scope` with resource ownership and the leak test; the seeded RNG and the game
clock with capture mode. Identical behaviour: the phase lists match today's under a rename map.

**Depends on.** F6.

**Interfaces.** 01 §1, §2, §3, §4, §5.

**Steps.** (Each numbered step is one commit with a green parity run.)
1. **Clock and RNG.** `src/engine/core/clock.ts` (`GameClock` of 01 §2: `now`, `real`, `frame`, `mode`,
   `setCapture(fps)`), fed by `Game.ts`'s frame loop (today `THREE.Clock` + `fixedStep.ts`): in `live` mode it reads
   the same deltas as today; in `capture` mode each frame advances exactly `1 / fps` s. `src/engine/core/rng.ts`
   (today's `Rng` class, 16 lines, extended to 01 §2's `Rng` and `RngService`): streams `gameplay`, `ai`, `loot`,
   `spawn`, `cosmetic`, each seeded with `fnv1a32(seed + ':' + stream)`. The seed is `window.__wildshardHarness.seed` when
   present (03 §6), else the manifest's `seed` XOR a per-page `crypto.getRandomValues` value (live play stays
   unrepeatable, as today). No `Math.random` call site moves in F8; the `wildshard/no-raw-random-time` ratchet drives
   that migration in the S rows.
   **The one RNG** (13-lead-resolutions G18; audit N-G "RNG ×3"). F8 lands one `Rng` class and deletes the other two
   copies in the same commit:
   - The class in `src/engine/core/rng.ts` (mulberry32, as all three are today) is the superset of the three copies'
     methods: `next`, `range(a, b)`, `int(a, b)` (the signature all three share; 01 §2's `int(n)` is read as it),
     `pick`, `chance(p)` (from Nine Dragon's `util.ts`), `weighted(pairs)` and `fork(salt: number)` (from
     `world/facade/rng.ts`), beside 01 §2's `fork(stream: string)` for the `RngService` streams. `pick` on an empty
     list yields `undefined` (the core copy's rule, which 81 importers rely on). Nine Dragon's copy threw there; its
     deterministic builds never pass an empty list, and the parity boot, which builds every tower, proves it.
   - A static `Rng.scrambled(seed)` = `new Rng((seed * 2654435761) >>> 0)` is the facade copy's constructor. The facade
     grammar (`world/facade/grammar.ts`, its one importer) calls it, so every tower keeps its layout.
   - Deleted: `src/shards/nine-dragon-stack/world/facade/rng.ts` (34 lines) and the `Rng` class in
     `src/shards/nine-dragon-stack/util.ts` (lines 4-23; the palette exports `INK`, `SILK`, `SUTRA`, `METAL`, `MIN`,
     `NEON`, `WALL` and the helpers stay). Their importers (the 25 Nine Dragon files that import `Rng` from `util.ts`,
     and `grammar.ts`) import `Rng` from `#engine`.
   - A test (`test/engine/rng.test.ts`, below) pins that `new Rng(s)` gives the old core sequence and that
     `Rng.scrambled(s)` gives the old facade sequence for 1,000 draws of 3 seeds each. The parity boot fingerprint
     (`scene.named`, `registry`, `render.programKeys`) is identical on Nine Dragon, with no rename map.
     `grep -rn "class Rng" src` prints one line. X5's RNG item is then only that check (10 X5).
2. **Systems.** `src/engine/app/app.ts` + `systems.ts`: `App.addSystem(spec, scope)` of 01 §1, the topological sort
   (ties keep registration order), cycle → a boot error naming the ids. `Game.onInput / onFixed / onUpdate / onLate`
   become thin wrappers that call `addSystem` with `id` = the label given, else a generated id from the rename rule
   below, `phase` from the method, `core` passed through. `faults.ts` unchanged (it receives the id as `label`).
   **The rename map.** Every anonymous label (`update#12` style, `faults.ts:48` fallback) gets a dot-case id:
   `engine.<folder>.<function name>` for engine registrations, `shard.<slug>.<function name>` for registrations in a
   shard folder, `main.<n>` for the 11 `main.ts` registrations until S4.4 splits them (the `'main'` updater keeps id
   `main.frame`). The table is `test/parity/renames/F8.json` (`{ "systems": { "<old label>": "<new id>" } }`), written
   by a one-shot script that runs the parity boot fingerprint before and after and pairs labels by position within
   each phase. The harness applies it (03 §7).
3. **App states.** `AppState` of 01 §1 with `setState`, `onEnter`, `onExit`, `inState`. Wire the existing mode flags
   as state transitions without removing them: `hud.entered` true → `play`, the title → `title`, the pause menu →
   `paused`, Explore → `explore`, the practice room → `practice`, the playgrounds → `playground`, death → `dead`,
   the loading screen → `loading`, a fatal fault → `error`. The flags stay the source of truth until X1 / X2 remove
   them; `app.state` mirrors them and emits `'app.state'`. Parity: `app.state` sequence joins the fingerprint
   (`boot.appStates`, exact).
4. **Events.** `src/engine/events/` with 01 §3's `Events` (`emit` queued per phase, `on`, `ask`, `answer`) and
   `EventMap` / `AskMap` / `TagMap` for declaration merging. F8 declares only the engine events it emits itself:
   `'app.state'`, `'level.loaded'`, `'level.unloaded'`, `'fault'`. The 48 `onFoo =` fields, 29 chained hooks and 8
   `ws:*` DOM events move in the S / X rows (09-combat-ai.md and each shard spec map them); F8 adds a ratchet rule
   `wildshard/no-hook-chain` counting `const prior = x.onY` chains (29 today), recorded in `lint/ratchet.json` with
   `--add-rule` (F4 step 2; R1-07), as are step 5's two rules.
5. **Services.** `App` of 01 §5 with typed fields. F8 fills `clock`, `rng`, `events`, `scene`, `render`, `physics`,
   `registry`, `saves` (a placeholder that throws until F10), `debug`, `scheduler` (today: every system every frame;
   S2.6 adds rates); the rest are filled by the rows that build them (the `App` type lists them as they land). The 6
   `active*()` singletons (`activeRegistry`, `activePhysics`, …) become `app.registry`, `app.physics` …; their old
   functions stay as one-line wrappers returning `app.x`, counted by a ratchet rule `wildshard/no-active-singleton`
   (target 0 at S4.4). The `wildshard/no-active-chunk` rule (01 §24) is recorded here too: every `getActiveChunk()`
   call outside `#game/shard` (136 calls in 42 files); every shard phase lowers it and S4.4 takes it to 0
   (13-lead-resolutions 02/03#5).
6. **Scope + leak test (R1-28; 01 §4 "Owned vs acquired").** `src/engine/app/scope.ts` of 01 §4, and
   `app.assets` (`acquire(key)` / `release(key)`, ref-counted). For the code that does not call the scope yet, the
   scope records what today's `ShardScope` capture sees (`src/core/shardScope.ts` → `src/engine/core/shardScope.ts`:
   `window` / `document` listeners, timers, `<body>` appends while a shard scope is current) into `scope.census`.
   **Unload is not app shutdown.** `scope.dispose()` releases only what the shard created: the shard half of today's
   host `dispose` (`src/main.ts`: `loot.dispose(); windupWarn?.dispose();`), the shard's physics bodies and colliders
   (removed from the world one by one; never `world.physics.dispose()`), its sound handles (never `audio.evict()`
   of the engine's context and buses), its look strategy's render targets, its registry pieces and systems, and the
   geometries / materials / textures reachable from the shard's scene root, skipping anything acquired. It never
   calls `game.dispose()`, which kills the renderer (`src/core/Game.ts:736-747`) and stays the whole-app shutdown.
   Shared engine / kit assets (the sky rig, the composer, a kit mesh, the title's art) are `acquire`d and `release`d,
   never disposed by a scope. **B0** is the census when the engine has booted to `title` (01 §4): renderer, physics
   world, sky rig, UI shell, audio context and input exist, and no shard resource does yet (with the harness's
   `?skipintro=1` the title isn't shown, and B0 is taken at that same point). The probe gains `leak()` (03 §5.5).
7. The probe (`src/engine/debug/probe.ts`) is built from the services (01 §5): `__wildshard.app` = a read-only view of
   `app` (state, systems by phase, clock, rng seed, census).

**Mapping: today → F8.** `Game.onX(fn, label, core)` → `app.addSystem({ id, phase, run, core }, engineScope)`;
`faults.ts` fallback labels → the rename map; `shardScope.ts` capture → `Scope` census; `active*()` → `app.*`.

**Tests added.** `test/engine/systems.test.ts` (sort, ties, cycle error), `test/engine/states.test.ts`,
`test/engine/events.test.ts` (queue per phase, flush order, 1,000-per-frame fault, `ask` chaining),
`test/engine/scope.test.ts` (dispose order, idempotent, census counts, a scope that owns a geometry disposes it, an
acquired asset is released and not disposed, and after a dispose the fake `Game`'s renderer and physics world still
run a frame: unload leaves the engine usable, R1-28),
`test/engine/rng.test.ts` (same seed → same sequence per stream, streams independent, `fork`; the old core and
facade sequences reproduced, step 1),
`test/engine/clock.test.ts` (capture mode advances exactly `1/fps`). F5's `loop.test.ts` passes unchanged.

**Done when.**
- The phase-list fingerprint is identical under `test/parity/renames/F8.json` (03 §7) on both lanes.
- The leak test (03 §5.5) is green for all 4 shards: load → unload returns every shard-owned count to B0
  (engine-retained resources are not counted; R1-28).
- `pnpm test` exits 0 with the new tests; the ratchets for `no-hook-chain`, `no-active-singleton` and `no-active-chunk`
  are recorded.
- `grep -rn "class Rng" src` prints one line (`src/engine/core/rng.ts`), and Nine Dragon's boot fingerprint is
  identical with no rename map (step 1).

**Risks and rollback.** The leak test finds a real leak today's evict path never freed: that is a found bug, fixed
inline with a test (decision 4). Topological sort reorders a system: the rename-mapped fingerprint catches it; fix by
declaring `after` to keep today's order. Rollback: per-step `git revert`.

**Size.** L. Not split (it is the spine; one author).

---

## F9 — The shard registry (EI8, TP8, MW20)

**Goal.** A generated `shards.generated.ts` (manifests + lazy `load`), the `ShardManifest` type with `api` version, and
the full-screen error on a failed load. No hand-kept shard list anywhere.

**Depends on.** F6, F8.

**Interfaces.** 01 §6, §7, §20 (`game.shard`), decision 69.

**Steps.**
1. `scripts/gen-shards.mjs`: lists `src/shards/*/manifest.ts` (every folder with one, `_template` included once Z1
   creates it), writes `src/game/shard/shards.generated.ts`:
   `import m0 from '#shards/driftwood-isle/manifest'; … export const SHARDS: readonly ShardManifest[] = [m0, …]
   .sort((a, b) => a.order - b.order); export type ShardSlug = 'driftwood-isle' | …;`. `--check` exits 1 when the
   file on disk differs from what it would write. **Generated files are built, not committed (R1-11).** The file is
   written by a Vite plugin (`vite/genShards.ts`, before the bakers, on every build) and by `pnpm gen`, and is listed
   in `.gitignore`. The same rule covers every `src/**/*.generated.*` file, so a content commit never carries one
   (R1-09): the six boot tables (`src/engine/boot/{art,audio,bytes,gpu,packs,versions}.generated.ts`, committed
   today) are removed from the index in this row (`git rm --cached`, the lead's own files under the lock), and
   `.gitignore` gains `src/**/*.generated.*`. `pnpm gen` (`scripts/gen.mjs`) writes all of them: `gen-shards.mjs`, the
   table writers `vite.config.ts` runs today (moved into `vite/gen.ts`, which the Vite plugin and the script both
   import) and `bake-packs.mjs` for `packs.generated.ts`. `package.json`'s `"test"`, `"typecheck"` and `"lint"` each
   start with `pnpm gen &&`, because tsc and oxlint read the generated modules too; CI and
   `scripts/vercel-tree-gate.sh` run those scripts on a clean export, so they generate first as well. With the
   registry generated and the gate's matrix derived from it (03 §11.1), a new shard lands with **zero engine edits**:
   no change under `src/engine`, `src/game`, `src/kit`, `lint`, `scripts` or `.github` (R1-11; 11 Z3).
   Each `manifest.ts` gets `export default` of its manifest (named exports stay for existing importers until they are
   rewritten in this row).
2. `ShardManifest` gains `api: 1`. `src/game/shard/registry.ts` (today's `chunks/registry.ts`) becomes a thin module
   over `SHARDS`: `findShard(slug)`, `shardSlugFromUrl()` (the `chunk` harness param, unchanged), `DEFAULT_SHARD =
   'driftwood-isle'`, and `playable(m) = m.status === 'live' || m.status === 'earlyAccess'` (≡ today's `CHUNKS`),
   `CHUNKS` and `PROTOTYPES` deleted. A manifest whose `api !== SHARD_API` (1) is refused at boot with the error
   screen (step 4), naming the shard and both numbers.
3. **Readers.** The title deck (`src/game/titleDeck.ts`, `#game`: 01 §20) builds its cards from `SHARDS` (`name`, `biome` as
   the card's line, `status` → badge: `earlyAccess` → `'Early access'`, `experimental` → `'Experimental'`, `hidden` → not
   shown unless Settings ▸ Debug ▸ Developer tools ▸ `showHiddenShards` is on) and `TITLE_CARDS` is deleted (EI8).
   The bakers (`bake-chunk`, `bake-sky`, `bake-packs`, `bake-ktx2`, `bake-navmesh`, `unused-assets`) import `SHARDS`
   and filter: terrain / sky bakers `ground.structures === undefined`, the others `playable(m)`; the
   `globalThis.location` fake in `bake-packs.mjs:43` is removed once no module a manifest reaches reads the URL at
   import (TP8; the `TIER` read in `src/engine/core/tier.ts` moves behind a function called at boot).
   `getActiveChunk()` (136 calls in 42 files) becomes a one-line wrapper over `game.shard` (01 §20), still counted by F8's
   `wildshard/no-active-chunk` ratchet (target 0 at S4.4).
4. **The load-failure screen.** `src/engine/ui/errorScreen.ts`: a full-screen view (the `error` UI layer arrives with
   X2; until then it is appended to `<body>` with `data-ws-shell` so the shell owns it) with the shard name, build id,
   stage, the error message and the stack in a scrollable monospace block, and one button `RELOAD`
   (`location.reload()`). It is shown when any of these throws or rejects: a manifest's `load` (from S1.1), `render`,
   `structures.build`, `sword`, `roster`, `fieldModels`, `traversal` thunks, or the shard build steps. Before it shows,
   the shard scope is disposed and `reportError({ kind: 'shard-load', shard, build, stage, stack })` is sent through
   `src/engine/core/errorReport.ts` (the `/api/errors` queue and Sentry when configured).

**Tests added.** `test/gen-shards.test.ts` (a temp folder with a new `manifest.ts` appears in the output; `--check`
fails on a stale file); `test/manifests-node-safe.test.ts` (imports every manifest in node with no `window`,
`document` or `location` defined and asserts no throw — 01 §6's rule); `test/shard-load-failure.test.ts`
(happy-dom: a manifest whose `render` rejects → the scope is disposed, the report is queued with shard and stage, the
screen has the stack and a RELOAD button).

**Done when.**
- `grep -rn "CHUNKS\|PROTOTYPES\|TITLE_CARDS" src scripts` prints nothing.
- `node scripts/gen-shards.mjs --check` exits 0; the title deck, the 6 bakers and `unused-assets` read `SHARDS`.
- `git ls-files 'src/**/*.generated.*'` prints nothing, and on a fresh `git archive HEAD` export `pnpm test` and
  `pnpm run typecheck` exit 0 (they generate first; R1-11).
- A planted `throw` in Nine Dragon's `render` thunk shows the error screen with the stack in the harness (plant
  `render-throw`, 03 §9), and the gate reports that shard red.
- Parity green; bakers unchanged (`git status --porcelain public/assets src` empty after a build: F9 edits the bakers,
  whose stamps no longer hash their own source, F1 step 7; R1-20).

**Risks and rollback.** A manifest that reaches a module with import-time side effects breaks the node-safety test:
the side effect moves behind a function (TP8's rule). Rollback: `git revert`.

**Size.** M.

---

## F10 — SaveStore (EI19, MW7, MW15)

**Goal.** One namespaced, versioned store with a migration chain; today's saves are reset once (decision 13);
`navigator.storage.persist()` on a home-screen launch; export / import in Settings; 0 raw `localStorage` /
`sessionStorage` outside the store.

**Depends on.** F8 (`app.saves`), F9 (`ShardSlug`).

**Interfaces.** 01 §9: the scopes `global`, `shard`, `device` (machine-local; never exported, never reset) and
`session` (sessionStorage, per tab).

**Steps.**
1. `pnpm add valibot@1.5.0 --config.enable-global-virtual-store=false` (exact pin; engine-fit: "adopt valibot, at
   trust boundaries only").
2. `src/engine/saves/store.ts`: `SaveStore` of 01 §9 over localStorage documents `wildshard.save.v2.global` and
   `wildshard.save.v2.<slug>`, each `{ keys: { <key>: { v, data } } }`, write-through on every `write`; read validates
   with the key's valibot schema, runs `migrate` from the stored `v` to the current `version` in order, and on a stored
   `v` newer than the build knows keeps the data untouched and serves `initial()` read-only for that key (01 §9
   "never downgrades"). Unknown keys in a document are kept on write.
   **A save that fails its schema** (01 §9; 13-lead-resolutions G16; aaa §2.9 "backed up and defaulted, never a boot
   crash"), in every scope:
   - a key whose stored `data` fails its valibot schema (after migration): the store copies the raw stored entry to
     `<key>.corrupt.<ISO time>` in the same document, writes `initial()` to the key, and calls
     `reportError({ kind: 'save-schema', scope, key, version, issue })` (`src/engine/core/errorReport.ts`: the
     `/api/errors` queue and Sentry; `issue` = the first valibot issue's path and message). It never throws; the game
     carries on with `initial()`.
   - a whole document that is not JSON or has no `keys` object: the raw string moves to the storage key
     `<document key>.corrupt.<ISO time>` (e.g. `wildshard.save.v2.pine-hollow.corrupt.2026-10-02T09:14:03Z`), a fresh
     `{ keys: {} }` document replaces it, and the same report is sent with `key: '*'`.
   - at most 3 aside copies are kept per key or document; a fourth drops the oldest.
   - the aside copies of the `global` and `shard` documents are listed by `app.saves.corrupt()`
     (`{ scope, key, at, bytes }[]`), which step 8's Settings save screen shows with an export button per copy.
3. **The `device` and `session` scopes** (01 §9; 13-lead-resolutions 02/03#2). A `device` key lives in the
   localStorage document `wildshard.save.v2.device` (same `{ keys }` shape): machine-local bookkeeping and
   diagnostics, **never** exported, **never** mirrored to native, **never** reset by the store; a schema failure is
   handled as in step 2 (aside, `initial()`, report), but its aside copies are not listed in Settings (device keys are
   never exported). A `session` key lives in the sessionStorage document `wildshard.save.v2.session`: per-tab
   state, never exported; a schema failure falls back to `initial()` and is reported the same way.
4. **The reset** (`src/engine/saves/legacy.ts`; R1-08): on the first boot of a build with the v2 store, if
   `wildshard.save.v2.global` does not exist, delete the **game-save** keys only: the "old key" of every **G** and
   **S** row of the table below (prefixes expanded by enumerating `localStorage`), plus the dead `ws.debug`; then
   create the global document with `{ keys: {} }`. Never deleted: the **L** (`device`) and **X** (`session`) rows'
   keys, `ws.ota.*` (native OTA state) and the three pre-boot keys (step 6). Before the new readers run, the same
   first boot copies each L / X row's old value into its new `device` / `session` key (`ws.dev` `'1'` → `devMode:
   true`), so the machine-local and per-tab values carry over; the old keys stay where they are. The native mirror
   (`src/engine/native/saves.ts:15`, `PREFIX = 'ws.'`) mirrors exactly the documents `wildshard.save.v2.global` and
   `wildshard.save.v2.<slug>` (one per `ShardSlug`, 01 §9's per-shard document), plus `ws.ota.*` as today: never
   `wildshard.save.v2.device`, never a `*.corrupt.*` copy, and never sessionStorage. The reset calls the mirror's new
   `forgetLegacy(keys)` so the deleted keys also leave Capacitor Preferences.
5. **Port every user** by the table below; delete `src/game/loot/store.ts` (`readShard` / `writeShard`) and the
   `legacyShardId` helper (F6 row 1). `ws.elites.v1` becomes shard-scoped, which fixes bug §7.6 (Nalati and Pine
   shared one store), with a test.
6. **`index.html`** (not linted, read before the bundle): a tiny pre-boot reader (01 §9; 13-lead-resolutions C3) for
   its three keys, each in a `try` so a missing or unparseable document reads as "absent". Line 75 reads `ws.dev` →
   the **`device`** key `devMode`:
   `JSON.parse(localStorage.getItem('wildshard.save.v2.device') ?? '{}').keys?.devMode?.data === true`; lines 111 / 114
   read `wsResumeShot` / `wsResumeBrand` → the **`session`** keys `resume.shot` / `resume.brand` of the sessionStorage
   document `wildshard.save.v2.session` (per tab, as today, so an old reload screenshot never shows on a later cold
   start). None of the three is ever reset by step 4.
7. **Persistence.** `app.saves.persist()` runs once per page when `matchMedia('(display-mode: standalone)').matches ||
   navigator.standalone === true`, stores the result in the `device` key `storage.persisted`; Settings ▸ Debug ▸
   Loading & memory gets a read-only row `storage` showing `persisted` and `navigator.storage.estimate()`
   (usage / quota MB) (a `debugOptions.ts` row with a text readout, per AGENTS.md's registry).
8. **Export / import.** pause ▸ Settings gets a `SAVE` section with `EXPORT` (downloads
   `wildshard-save-<date>.json` = `exportAll()`: `{ format: 'wildshard.save', version: 2, build, exported, docs:
   { global, <slug>… } }`) and `IMPORT` (a file picker; `importAll(json)` validates each key, migrates older versions,
   keeps newer ones untouched, and shows the `ImportReport`: imported keys, skipped keys with reasons). Below them, a
   `SET ASIDE` list shows `app.saves.corrupt()` (step 2: scope, key, time, size), each with `EXPORT` (downloads
   `wildshard-corrupt-<key>-<time>.json` with the raw value); the list is hidden when empty. Strings from the engine
   string table (01 §0).
9. **Scripts.** `scripts/debug-settings.mjs` writes the pick into the v2 global document's `settings` key (not
   `ws.settings.v1`); the scorecard init script (`scorecard.mjs:164`, `:620`), `test-facade-instancing.mjs:16` and every
   other live script that writes a `ws.` key (`grep -rln "ws\.[a-z]" scripts`) use `debugSettings()` or a new
   `saveFixture(page, { scope, key, data })` in the same file.

**Mapping: every storage key today → its new home.** Kinds (the `SaveKeyDef.scope`, 01 §9): **G** `global`, **S** `shard` (the
document of the running shard's slug), **L** `device`, **X** `session`, **N** native (unchanged).

| Old key (storage) | File(s) today | New key | Kind | Notes |
|---|---|---|---|---|
| `ws.settings.v1` (local) | `ui/Settings.ts:40`; raw reads `ui/Perf.ts:198` | `settings` | G | Perf.ts reads it through `app.saves` |
| `ws.gfx.v1` | `core/tier.ts:142` | `gfx` | G | |
| `ws.debug` | `core/tier.ts:146` (removed at boot already) | — | — | legacy list only |
| `ws.dev` | `core/devMode.ts:14`; `index.html:75` | `devMode` | L | a pre-boot key (01 §9): index.html step 6 |
| `ws.hints.v1` | `ui/FirstHints.ts:61` | `hints` | G | |
| `ws.review.v1` | `ui/review.ts:19` | `review` | G | |
| `ws.review.queue.v1` | `ui/review.ts:20` | `review.queue` | G | player notes waiting for the network |
| `ws.progress.v1` (per chunk id) | `game/Progress.ts:14` | `progress` | S | decision 76 |
| `ws.inventory.v1` (per chunk id) | `game/Inventory.ts:89`; `game/loot/store.ts` doc | `inventory` | S | |
| `ws.flags.v1` (per shard) | `world/interact/flags.ts:13` | `flags` | S | `?resetquest` resets this key |
| `ws.boss.v1` (`<chunkId>#<bossId>`) | `game/Boss.ts:129` | `bosses` (record by boss id) | S | |
| `ws.elites.v1` (one global) | `game/Elite.ts:120`, `nalati/adventure.ts:95` | `elites` | S | fixes bug §7.6 |
| `ws.purse.v1` (per chunk id) | `game/loot/Purse.ts:16` | `purse` | S | decision 74 |
| `ws.owned.v1` | `game/loot/Owned.ts:44` | `owned` | S | |
| `ws.bounty.v1` | `game/loot/Bounty.ts:16` | `bounty` | S | |
| `ws.compendium.v1` (per chunk id) | `ui/compendium/state.ts:17` | `compendium` | S | |
| `ws.skins.v1` | `player/Skins.ts:280` | `skins` | S | owned gear is per shard (decision 77) |
| `ws.nalati.skins.v1` | `player/nalatiSkins.ts:42` (Nalati's folder after F6) | `nalati.skins` | S | defined in the Nalati folder |
| `ws.nalati.tulpar` | `game/Taming.ts:55` (Nalati's folder after F6) | `tulpar` | S | |
| `ws.nalati.horseNames` | `player/horseNames.ts:14` (Nalati's folder after F6) | `horseNames` | S | decision 77 |
| `ws.ph.loadout.v1` | `pinehollow/loadout.ts:66` | `loadout` | S | defined in Pine's folder |
| `ws.lodge.v1` | `pinehollow/quest/contracts.ts:164`, `pinehollow/quest/index.ts:290` | `lodge` | S | |
| `ws.debug.open` | `ui/DebugMenu.ts:21` | `debug.open` | L | |
| `ws.fold.<id>` | `ui/cards.ts:12` | `ui.fold` (record by id) | L | |
| `ws.perf.probe` | `ui/Perf.ts:31` | `perf.probe` | L | |
| `ws.perf.rec.v1` | `ui/perfHud.ts:30` | `perf.rec` | L | |
| `ws.perf.lap.v1` | `ui/perfLap.ts:26` | `perf.lap` | L | |
| `ws.ktx2set.<slug>.<tier>` | `boot/shardPrefetch.ts:114`, `boot/clearDownloads.ts:45` | `ktx2set` (record by `<slug>.<tier>`) | L | cleared by Clear downloads |
| `ws-load-times:v1:<tier>:<cores>[:<shard>]` | `boot/timing.ts:14` | `boot.times` (record by the same suffix) | L | |
| `ws.lastUnload` | `boot/lastEnd.ts:26` | `life.lastUnload` | L | |
| `ws.lastEnd` | `boot/lastEnd.ts:28` | `life.lastEnd` | L | |
| `ws.alive` (session) | `boot/lastEnd.ts:27` | `life.alive` | X | |
| `wsLifeTrace`, `wsLifeTraceAt` | `core/lifeTrace.ts:17,131` | `life.trace`, `life.traceAt` | L | |
| `ws.nineBoot` | `boot/nineBootTrace.ts:7` | `boot.trace` | L | |
| `wsNineReports` | `boot/nineBootTrace.ts:10` | `boot.reports` | L | |
| `wsErrQueue` | `core/errorReport.ts:28` | `err.queue` | L | |
| `wsErrSession` (session) | `core/errorReport.ts:26` | `err.session` | X | |
| `wsErrReloads` (session) | `core/reloadGuard.ts:10` | `err.reloads` | X | |
| `wsGpuReloads` (session) | `core/GpuRecovery.ts:81` | `gpu.reloads` | X | |
| `wsResumeShot`, `wsResumeBrand` (session) | `ui/Resume.ts:21,23`, `core/GpuRecovery.ts:104,134`; `index.html:111,114` | `resume.shot`, `resume.brand` | X | index.html step 6 |
| `wsClearDownloads` (session) | `boot/clearDownloads.ts:43` | `clearDownloads.report` | X | |
| `ws.titleArrival` (session) | `boot/titleArrival.ts:5` | `titleArrival` | X | |
| `ws.titleArrival.once` (local backup) | `boot/titleArrival.ts:6` | `titleArrival.once` | L | |
| `ws.shardArrival.arena` (session) | `shard/switch.ts:19` | `shardArrival.arena` | X | |
| `ws.loadAttempt` (session) | `ui/Loading.ts:60` | `loadAttempt` | X | |
| `ws.ota.*` | `native/updates.ts:97`, `native/ota.ts:51` | unchanged | N | never reset; mirrored |
| (storage handles only) | `ui/ErrorModal.ts:51-52`, `boot/stuck.ts:37`, `native/saves.ts`, `native/boot.ts` | pass `device` / `session` `SaveSlot`s instead of `Storage` | — | `native/**` keeps raw access (the mirror) |

Paths in the table are today's under `src/`; after F6 they are under `src/engine/`, `src/game/` or the shard folder
per the move map.

**Tests added.** `test/engine/saves.test.ts`: round-trip per scope; migration chain 1 → 2 → 3 on a fixture key; a
newer stored version stays untouched and read-only; unknown keys kept; the reset deletes the G / S old keys and never
`ws.ota.*`, an L or X old key, or a pre-boot key, and it carries `ws.dev = '1'` into `devMode: true` (R1-08); the
mirror's key filter passes `wildshard.save.v2.global`, `wildshard.save.v2.pine-hollow` and `ws.ota.x` and refuses
`wildshard.save.v2.device` and `wildshard.save.v2.pine-hollow.corrupt.<time>`; `exportAll` → `importAll` round-trip;
a key failing its schema is moved to `<key>.corrupt.<time>`, reset to `initial()` and reported once (a stubbed
`reportError` sees scope, key, version and the first issue), with no throw;
an unparseable document is moved aside whole and replaced; a fourth aside copy drops the oldest; `corrupt()` lists
`global` / `shard` copies and not `device` ones. `test/preboot-keys.test.ts` (happy-dom) runs `index.html`'s pre-boot
reader against a device document with `devMode` true, a session document with `resume.shot`, and a garbage document
(reads as absent, no throw).
`test/fixtures/saves/v2-global.json`, `v2-driftwood-isle.json` (the fixture corpus starts here; every later version
bump adds one, 01 §9). `test/elites-per-shard.test.ts` (bug §7.6). F5's `saves-roundtrip.test.ts` is replaced by the
store's contract test.

**Done when.**
- `pnpm lint:ratchet` shows `wildshard/no-raw-save` at 0 and the rule's entries are gone from `lint/ratchet.json`.
- On the harness (03 §2.1 `saves`), the saves read / written list the v2 documents only, under
  `test/parity/renames/F10.json` (`{ "saves": { "<old key>": "<new doc>/<key>" } }`).
- A save exported on Driftwood imports into a fresh browser context and restores purse, owned and progress (a
  Playwright check in `scripts/parity/combat.mjs`'s save step, run once, recorded in E357).

**Milestone check, not a row done-when (R1-50).** On the physical iPhone home-screen app, Debug ▸ Loading & memory ▸
storage shows `persisted: true`. It is Jake's one glance on the M1 checklist (05 §9), recorded in E357; F11 does not
wait for it.

**Risks and rollback.** A native install loses its saves because the mirror prefix changed: the reset is deliberate
(decision 13); the risk is losing OTA state, which the `ws.ota.*` rule protects, with a test. Rollback: `git revert`;
the v2 documents are ignored by the old code and the old keys are already gone (a second reset is not possible — this
is why the reset ships only after the store's tests pass).

**Size.** M.

---

## F11 — Retire the old machinery (EI6, PHYSICS-POLISH F3)

**Goal.** One collision path (registry pieces): `player.colliders` and `src/physics/bridge.ts` are gone. The resident
host is gone: ShardHost (park / activate / evict), the 76 `shardSlot` registrations, the `disposeListeners`
`EventDispatcher.prototype` patch and the park / activate half of `shardScope.ts` (~800 lines).

**Depends on.** F8 (the `Scope` replaces ShardHost's evict), F6.

**Interfaces.** 01 §4 (scope), §14 (physics), decision 21, decision 63.

**Steps.**
1. **Colliders.** Port every user by the table below, then delete `ColliderBridge` (`src/engine/physics/bridge.ts`,
   64 lines), its two lines in `src/engine/core/bootstrap.ts` (113, 138: the fixed-step `pre` system keeps
   `for (const m of moving) m()` under id `engine.physics.movers`), and `colliders: Collider[] = []` in
   `src/engine/player/Player.ts:104`. The box shape `Collider` stays as a data type (32 files build boxes and convert
   them with `boxDesc`): it moves from `Player.ts` to `src/engine/physics/box.ts` as `BoxSpec`, re-exported from
   `Player.ts` until its importers are rewritten in the same commit.
2. **The resident host.** Delete `src/engine/shard/ShardHost.ts` (325), `src/engine/shard/disposeListeners.ts` (79),
   `src/engine/core/shardState.ts` (141) and every `shardSlot` / `stateSlot` / `listSlot` / `setSlot` / `mapSlot` call
   (81 calls in 54 files: they re-point module state when a parked shard resumes, which never happens since E216's
   `SHARD_CAP = 1`). From `shardScope.ts` delete park / activate (`parkScope`, `activateScope`, the comment-swap of
   parked `<body>` nodes, the `active` wrapper check), keep the **capture** (listeners, timers, body appends recorded
   into the current `Scope`), and rename the file `src/engine/app/legacyCapture.ts`. `src/game/travel/switch.ts`
   stays (the page-reload switch; `#game`, 01 §20). `main.ts`'s `SHARD_CAP` / host wiring goes; `buildShard` is called once and its
   `dispose` registered as the shard scope's `onDispose`.
3. The capture is counted by the ratchet rule `wildshard/no-global-listener-patch` (01 §24; 396 at the start; every `addEventListener`,
   `setTimeout`, `setInterval`, `requestAnimationFrame` and `document.body.append*` call in a file that runs while a
   shard scope is current, i.e. outside `src/engine/app/**` and the shell overlays listed in `SHELL`, `shardScope.ts:46`): X1
   moves the input listeners and X2 the UI appends, and the capture file is deleted when the count is 0
   (13-lead-resolutions 02/03#4).

**Mapping: every `player.colliders` / `bridge.ts` user today → its replacement.**

| Site today | What it does | Replacement |
|---|---|---|
| `src/player/Player.ts:104` | declares `colliders: Collider[]` | deleted |
| `src/core/bootstrap.ts:113` | `new ColliderBridge(physics, player.colliders)` | deleted |
| `src/core/bootstrap.ts:138` | `bridge.sync()` in fixed `pre` (+ the movers) | the movers only |
| `src/main.ts:423` | passes `colliders: player.colliders` to `BlenderIsland.install` | passes `registry` instead |
| `src/world/BlenderIsland.ts:490` | `ctx.colliders.push(...unclaimed)` (the cove boxes no model claims, E344) | `registry.add({ id: 'cove-unclaimed', name: 'Cove rocks', category: 'nature', file: 'src/shards/driftwood-isle/world/BlenderIsland.ts', colliders: unclaimed.map((c) => boxDesc(c, 'rock')), surface: 'rock', solidFloor: false })` — surface `'rock'` replaces the bridge's blanket `'wood'` tag only if the parity footstep sounds stay the same; otherwise `'wood'` (the bridge's tag, `bridge.ts:44`) is kept |
| `src/world/interact/Interactables.ts:450` | pushes `lv.collider` for barrel, beacon, altar, lever | one piece per interactable: `registry.add({ id: 'interact-<def id>', …, colliders: [boxDesc(lv.collider)] })`; **static** for beacon, altar, lever; for a barrel (its box moves with `BarrelWatch`) a **kinematic** piece with `follows: lv.object` (01 §14: a moving piece follows its Object3D) |
| `src/game/quest/Spine.ts:50` | pushes the Castaway NPC's box (Driftwood) | `registry.add({ id: 'npc-castaway', category: 'people', colliders: [boxDesc(castaway.collider)], follows: castaway.group })` |
| `src/pinehollow/quest/index.ts:356` | pushes each Pine NPC figure's box | `registry.add({ id: 'npc-<kind>', category: 'people', colliders: [boxDesc(fig.collider)], follows: fig.group })` |
| `src/entities/npc/Castaway.ts:9`, `world/{Boulders,Trailside,Boat,Pier,Shrine,Wreck,Cove,Lookout,Palms,Hut}.ts` header comments, `world/Ocean.ts:7,39`, `chunks/pine-hollow/world/props.ts:25`, `world/nalati/index.ts:18` | comments naming `player.colliders` | reworded to "its registry piece" |
| `src/physics/bridge.ts` | the whole P2 bridge | deleted |

Paths are today's; after F6 they are under `src/engine/` or the shard folder per the move map.

**Tests added.** `test/engine/no-legacy-colliders.test.ts`: `Player` has no `colliders` field (a type-level check) and
`grep`-style scan of `src/**` finds no `player.colliders` (non-empty glob assert). `test/engine/interact-pieces.test.ts`
(fake registry: a barrel piece is kinematic with `follows`, a lever piece is static).

**Done when.**
- `grep -rn "player.colliders\|ColliderBridge\|shardSlot\|ShardHost\|disposeListeners" src` prints nothing.
- Walk + trails 0 stuck: `node scripts/physics-baseline.mjs --no-build --mode=walk` and `… --trails` (every shard)
  report 0 stuck legs.
- Parity green under `test/parity/renames/F11.json` (`{ "registry": { "added": ["cove-unclaimed", "interact-*",
  "npc-*"] }, "physics": { "colliders": "same total" } }`): the total collider count equals today's bridge mirror count
  + registry colliders.
- The leak test (03 §5.5) stays green.

**Risks and rollback.** A box that the bridge re-created every step when its fields changed (not only x / z / rot)
becomes a kinematic piece that only moves: the port reads each site for writes to `hw`, `hd`, `yTop`, `yBottom` and
rebuilds that piece's collider on change. Rollback: two commits (colliders, host), each revertible alone.

**Size.** M.

---

## F12 — Rapier 0.21 (decision 45)

**Goal.** `@dimforge/rapier3d-simd` 0.20.0 → 0.21.0 with no gameplay difference.

**Depends on.** F11.

**Interfaces.** 01 §14.

**Steps.**
1. `pnpm add @dimforge/rapier3d-simd@0.21.0 --config.enable-global-virtual-store=false` (exact pin). Read the 0.21.0
   changelog in the dimforge/rapier monorepo (rapier.js is archived since 2026-07-12) and list every API the repo calls
   that changed (`src/engine/physics/**` is the only importer; `grep -rn "@dimforge" src vite` shows the rest).
2. `vite/rapier.ts` (`copyRapierWasm`, `rapierAlias`, `rapierPreviewPlugin`): update the package paths if the new
   layout moved the wasm or the bindings module.
3. Fix API changes inside `src/engine/physics/` only.
4. Re-bake the navmesh only if `bake-navmesh.mjs --check` reports stale (it should not: the navmesh is baked from
   colliders, not from Rapier's solver).
5. **The iPhone reading is on the M1 checklist (05 §9), not this row's done-when (R1-50).** At M1, on the M1 build
   (the Vercel preview candidate or the pinned production, 12 §3), Jake loads Nine Dragon (the fragile phone boot)
   and Pine Hollow (the largest phone pack) on his iPhone 17 Pro, plays 60 s in each, and sends each reading **in the
   chat** (R1-17): the lead asks with AskUserQuestion carrying the reading template (shard; build id; reached play
   yes / no; WebContent crash yes / no; Debug ▸ Performance ▸ RUN PROBE's text, copied with the panel's COPY button,
   `src/ui/Perf.ts:61`), and records both answers in E357. The in-game inbox isn't used for it.

**Tests added.** None new; F5's and the physics tests (`test/physics*`, 14 files) must pass unchanged.

**Done when.**
- Walk + trails 0 stuck (as F11).
- `node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/bake-navmesh.mjs --check` exits 0.
- Parity green on both lanes with no rename map, or green after a pure numeric walk drift is re-baselined (Risks
  below; R1-52).
- The physical-iPhone reading of step 5 is an M1 checklist item (R1-50), not a condition of this row.

**Risks and rollback.** The wasm grows 732 → 1,145 KB gz (E357 handoff, engine-fit research): +413 KB on every cold
load, accepted by Jake (decision 89), against Driftwood's 30 s Fast-4G cap that the scorecard already reads at 23.7 s. The parity boot fingerprint's
bytes field is information only; the nightly scorecard (03 §14) reports it. The new solver changes the character
controller's behaviour at steps: the walk and trails runs are the check. **A walk that drifts (R1-52; 03 §8 case
5).** If every leg and trail still has 0 stuck but a `walk.legs[].end` or `maxY` moves beyond its band, the lead
inspects those legs (and the trails, `--full`): a pure numeric drift is re-baselined with a note in the commit
(decision 89 accepted the upgrade); a new stuck waypoint or a fall (a leg ending lower than its baseline by more than
the band, or an `out` frame) reverts F12. Rollback: `git revert` of the package bump (the lockfile returns to 0.20.0).

**Size.** S.

---

## Questions for the lead

Every question below is answered in [13-lead-resolutions.md](13-lead-resolutions.md) and the body of this file follows
the answer; none is open.

1. **ChunkDef fields with no home in 01 §6** (`seed`, `biome`, `loot`, `bodyShadow`, `look`, `hud`, `horizon`, `ocean`,
   `fauna` / `faunaTuning`, `weapon`, `map`). **Resolved → 13-lead-resolutions 02/03#1 and 05/06#1:** every field is
   carried over; `map` → `minimap`, `gridCoords` → `label` + `placement`, `fov` → `camera.portraitFov`, `fauna` →
   `spawns`, `ocean` → a `WaterBody` row (S4.1), `weapon` → `loadout`. The F6 table follows.
2. **The `ground` union.** **Resolved → 13-lead-resolutions 02/03#1:** `ground: { terrain?; structures? }`, at least
   one; Nine Dragon keeps both. The F6 table and step 4 follow.
3. **The `style` values.** **Resolved → 13-lead-resolutions 02/03#1:** F6 maps `lowpoly` → `toon`; Nine Dragon becomes
   `'jiehua'` in S1.1 (05 §3). The F6 table (row 30) and F4's `no-shard-branch` literal list follow.
4. **Machine-local and per-tab keys; the 3 pre-boot keys.** **Resolved → 13-lead-resolutions 02/03#2:** the scopes
   `device` and `session` replace this spec's `LocalRecord` / `SessionRecord` (F10 step 3 and the key table). The
   pre-boot keys: **Resolved → 13-lead-resolutions C3:** `ws.dev` → a `device` key; `wsResumeShot`, `wsResumeBrand` →
   `session` keys (per tab, as today). F10 step 6 follows.
5. **`src/native/**` and `ws.ota.*`.** **Resolved → 13-lead-resolutions 02/03#2:** `ws.ota.*` is never reset. F4 keeps
   `src/native/**` outside `no-raw-save` (the Capacitor mirror needs raw access).
6. **Decision 46's 14-day clause kept almost every script.** **Resolved → 13-lead-resolutions 02/03#3** (Jake,
   decision 88): one-offs of finished asks go, and any script not run in the last 5 days goes, unless package.json, a
   hook, CI, a skill or a doc references it. F7 step 4 follows.
7. **Shard handles on the probe after F7.** **Resolved → 13-lead-resolutions 02/03#6:** `ctx.debug.expose(name, value)`
   → `window.__wildshard.shard[name]` (01 §7). F2 step 1 puts today's handles at the same place.
8. **F11 and the `addEventListener` patch.** **Resolved → 13-lead-resolutions 02/03#4:** kept, counted by
   `wildshard/no-global-listener-patch` (396), deleted when X1 / X2 move the last listeners onto scopes (F11 step 3).
9. **F7 before F6.** **Resolved → 13-lead-resolutions 02/03#5:** the order is F0 → F3.1 → F1 → F2 → F3.2 → F4 → F5 →
   F7 → F6 → F8 → F9 → F10 → F11 → F12 (index §4 and §0 above).
10. **The kit at F6; `#kit/npc`.** **Resolved → 13-lead-resolutions 02/03#5, 04#9 and 05/06#14:** the 5 files that
    already have 2+ shard users enter the kit at F6 (the F6 folder table); everything else fills it as rows move
    content in. `#kit/npc` is seeded from Pine's rig in S2.5; Nalati's camp people join in S3.3, Driftwood's Castaway
    and Trader in S4.3.
11. **The engine runtimes inside today's `src/game/`.** **Resolved → 13-lead-resolutions 04#2:** the reviewed map's
    interim exception E4 (04 §1.3) keeps `Boss.ts`, `Elite.ts` and the quest core in `src/game/` until S2.3 / S2.5;
    `wildshard/layer` counts every engine → `#game` import until then.
12. **Who owns the `getActiveChunk()` call sites.** **Resolved → 13-lead-resolutions 02/03#5:** the
    `wildshard/no-active-chunk` ratchet from F8 (F8 step 5), lowered by every shard phase, 0 at S4.4.
13. **Nine Dragon outside `CHUNKS`.** **Resolved → 13-lead-resolutions 02/03#5:** Nine Dragon becomes a full shard in
    S1.1 (boot packs, prefetch, the every-shard tests). F2 adds it to the harness only.
14. **Rapier 0.21's +413 KB.** **Resolved → 13-lead-resolutions 02/03#8** (Jake, decision 89: accepted). F12 follows.
15. **`wildshard/no-renderer-type` before F6.** **Resolved → 13-lead-resolutions C9 (02 Q15):** accepted. The rule
    allows `Game.ts` and `bootstrap.ts` until F6 re-keys it to `src/engine/render/**`, and its start count is the
    rule's own at F4 (01 §24; F4 step 1).
