# Wildshard — engineering audit (E108, 2026-09-24, HEAD f86b4c3)

## (a) Verdict

The engine itself is sound. The static checks are strict and they hold:
- strict TypeScript
- type-aware oxlint with `import/no-cycle`: 0 import cycles across 1,476 imports
- 398 unit tests, all passing in 2.8 s
- CI green on 97% of runs

The chaos comes from **growth with no runtime safety net**:
- `src/` went from **11.5k to 90.7k lines in 7 days**: +48k in the last 48 h, +25k in the last 24 h.
- About 10 agents wrote it, all wiring through **one file**: `main.ts`, edited 116 times in 7 days.
- Each shard is bolted on with if-branches instead of being its own module.
- Nothing ever checks that the game *plays*. Every gate is static; the boot, walk and load-budget scripts exist but no gate runs them.
- About a third of commits are bookkeeping.
- Every "locked in" pick still ships its losing variant.
- The next Nalati-sized merge is already waiting: Pine Hollow, +23k lines, touching 57 shared files.

To get closer to finished, in order: a feature freeze for stabilisation, a gate that plays the game, one module per shard (E5), deleting the variants nobody plays, and one owner per area.

## (b) Key metrics

| Metric | Value |
|---|---|
| `src/` size | 391 files, 90.7k lines (7 days ago 11.5k; 48 h ago 42k; 24 h ago 65k) |
| Commits | 977 in total since 2026-09-16; **869 in 7 days**, **503 in 48 h** (331 on 09-23 alone) |
| Commit mix, 7 days | 58% touch `src/`; **31% are asks/docs only** (110 asks-only + 154 docs-only); 5% art |
| Commits worded fix / regress / restore | 17% (144 of 869); 3 reverts |
| Commits touching `test/` | **5.7%** (49 of 864) |
| Most-edited files, 7 days | `src/main.ts` 116 commits · `Game.ts` 37 · `Audio.ts` 37 · `touch.css` 35 · `Menu.ts` 35 |
| `src/` files edited 10+ times in 7 days | 42 |
| Shard branches outside `src/chunks/` | **158** (slug / style / `ocean` / `LOOK_V2` checks) in **40 files**; 32 of them in `main.ts` |
| Nalati-only code | 19.0k lines (21% of `src/`) |
| URL query flags | **~123 distinct**; 65 `URLSearchParams` reads across 48 files |
| Unit tests | 39 files, 398 tests, **all pass, 2.8 s** |
| Code that tests import directly | 13% of lines (27% reachable); `nalati/` 0%, `entities/` 5%, `world/` 8%, `main.ts` 0% |
| Automated play test in CI | **none** |
| Download size | `main.js` **2.67 MB raw / 931 KB gzipped**, holding all three shards in one file. Also three.js 737 KB, WebGPU 788 KB, Rapier wasm 2.2 MB |
| Repo size | 1.73 GiB pack; `progress/` 755 MB, `art/` 428 MB |
| Docs | 210 tracked `.md` files, **about 171k words** (more words of docs than lines of code); 126 ask files; 9 live plans |
| Waiting on Jake | 16 asks marked "needs you" / "needs pick", plus 3 draft plans |

## (c) Findings by area

**1. Architecture: nothing separates the engine from the shards.**
- `bootstrap.ts` is small (143 lines). The real god object is **`main.ts` (822 lines)**:
  - it builds every Driftwood prop inline behind `isOcean` (`main.ts:154-263`);
  - it wires Nalati through `wireNalati` plus **15 `nalatiNow()?.bind…` calls** (`:314`, `:584-610`);
  - it picks weapons and music by shard name (`:364`, `:392`).
- `Game.ts` holds four separate post-processing chains: look-v2, painterly, clean and cinematic (`Game.ts:128-240`).
- Nalati landed as a second, parallel game rather than as data. Most shared systems now exist twice:

| Shared system | Nalati's copy |
|---|---|
| `IslandAmbience` | `SteppeAmbience` |
| `Music` | `SteppeScore` |
| `IslandSfx` | `nalati/sound` |
| `Adventure` | `nalati/adventure` |
| `Grass` / `GrassField` | `nalati/look/grass` |
| `Sky` / `StylizedSky` | `nalati/look/sky` |
| `Water` / `Ocean` | `nalati/water` |
| Crossbow (1.2k lines) / Sword (950) | Bow (960) / Spear (760) |

- `ChunkDef` (106 fields) covers terrain, sky and colour grade. Behaviour, props, animals, audio and the weapon kit all live as branches in `main.ts` instead.

**2. The frame loop is fragile.**
- Phases exist (`onInput`, `onFixed`, `onLate` at `Game.ts:242-263`), but 84 call sites still use the flat `onUpdate` list, which runs in registration order.
- There is **no per-system error isolation** (`Game.ts:363-370`). One updater that throws does so every frame, so the scene never renders again: you get a frozen image plus the error modal. A bug in Nalati weather freezes all of Nalati.
- **No error reports come back from players.** `ErrorModal` shows the error to the player only; nothing sends it to `api/inbox`, even though that channel exists.

**3. Too many switches.**
- About 123 URL flags and 9 settings that switch rendering paths.
- Picks marked "locked in" still ship the losers:
  - `lighting=standard`, `sky=hdri`, `post=cinematic`, `matte=off` (Settings.ts:106-112)
  - `look=v1`, `kuwahara`, `island=procedural`
  - a WebGPU path that draws only Driftwood (1.5k lines, a 788 KB download chunk)
- 3 shards × 2 device tiers × 2–3 renderers × those variants is far more combinations than anyone plays, so most of them rot silently.
- Also: 20 `window.__*` debug globals and 98 module-level `let`s.

**4. Testing: strong static checks, blind at runtime.**
- CI runs typecheck, lint, vitest, the CSS check, the build and the native build. The pre-push hook re-runs them on the exact tree Vercel will build.
- None of it starts the game. The runtime checkers exist but are only run by hand:
  - `scripts/nalati-boot-check.mjs` boots every shard and counts page errors;
  - `physics-baseline.mjs --mode=walk` reports stuck legs;
  - `bench-load.mjs --ci` checks load budgets.
- The committed bench table is from **2026-09-18**, about 80k lines of code ago. E44 loosened the load budgets (20 MB cold, 22 s to play on 4G), and nothing enforces even those.
- 27 of the 46 `.mjs` scripts drive a browser. Most are one-off captures (24 are `nalati-*`).
- The biggest untested files are the ones that break: `Audio.ts` (1.5k lines), `AnimalManager` (1.2k), `stormTitan` (1.1k), `KurganDungeon` (970), `Bow`, `Sword`, `elites`, `kurganBoss`.

**5. What the git history says keeps breaking.**
- Commit-message themes over 7 days:

| Theme | Commits |
|---|---|
| CI / gate / typecheck | 166 |
| Touch / phone / iOS | 158 |
| Perf / fps | 116 |
| Merge | 105 |
| Audio | 72 |
| Collision / stuck | 48 |
| Resume / app switch | 30 |
| Shader / compile | 29 |
| Black screen | 19 |

- Fix commits land most in `world/` (114 file touches), then `ui/`, `player/`, `entities/`, `boot/`, `core/`. By single file: `main.ts` (26), then `Game.ts` (14).
- Repeat offenders:
  - **touch HUD and menus**: touch.css 35 commits, TouchControls 29, Menu 35
  - **audio routing**: Audio.ts 37
  - **boot and download manifests**: generated files re-committed 21 times
  - **the post-processing / look chain**: Game.ts, Sky.ts

**6. Runtime robustness.**
- GPU context loss and app-switch recovery are handled well (`GpuRecovery.ts`, E54/E61).
- Cleanup is loose, though mostly harmless because switching shards reloads the page. It bites in Explore, the dev scenes and long sessions:
  - 815 `new *Geometry`, 211 materials and 70 textures, against only 69 `dispose()` calls;
  - 278 `addEventListener` against 15 removals.
- The legacy `player.colliders` bridge is still referenced 72 times in 28 files (PHYSICS-POLISH F3).

**7. Process.**
- Ten agents share one working tree, one index and one `main`. That needs a stack of guard rails: a push lock, sweep guards, a pathspec rule, a private-index recipe, a 500 KB image hook, the Vercel tree gate, and a sweepguard ledger with 42 logged bypasses.
- There is already scar tissue: `ASKS.md` wiped once, 16 files truncated once, six parallel pushes hung for 15 minutes, and Vercel's **100 deploys/day limit hit** (E38). CI ran about 290 times on 09-22 to 09-24.
- Shards are built on long-lived branches and landed as mega-merges. Nalati went from a 254-line plan to 25k lines of code in one day. Pine Hollow's worktree is 111 commits and +23k `src/` lines ahead, and touches 57 files that main also changed, including `main.ts`, `Game.ts`, `ChunkDef.ts` and `Audio.ts`.
- Jake is the only decision point for 16 asks and 3 plans, and the only person testing on a real device.

## (d) Root causes of the chaos

1. **No gate that plays the game.** Green CI means "it compiles", not "it plays". Regressions reach Jake's phone and come back as asks and fixes, each of which touches `main.ts` again. That's how CI can be 97% green while 17% of commits are fixes.
2. **No shard boundary.** With 158 shard branches in 40 files and all the wiring in `main.ts`, every shard feature edits shared hot files: every merge conflicts there, and one shard's change breaks another. E5 was proposed and never built, and Nalati then landed as a parallel set of systems.
3. **Speed without integration.** The code grew 8× in a week across about 10 lanes, with big-bang branch merges and no owner per file. Nobody owns `main.ts`, `Game.ts`, `Audio.ts` or the touch UI; everybody edits them.
4. **Variants never die.** Every look, sky, post and renderer experiment stays reachable by URL or setting. Each one multiplies the paths the next change can break, and nobody tests them.
5. **Process load crowds out the product.** 31% of commits are bookkeeping, the docs run to 171k words, and every decision queues behind one person. Agents spend their cycles on status updates, not on hardening.

## (e) Ranked fix list

**1. A stabilisation phase: a 1–2 week feature freeze. Effort: S (it's a decision).**
- Only bug fixes, deletions and new gates land. No new shard, no new system.
- Land or park Pine Hollow *before* the freeze, behind fix 3.
- Why: it stops the churn that feeds the bug rate.

**2. A gate that plays the game, built from the existing scripts. Effort: M.**
- For each shard, on desktop and touch:
  - boots with 0 page errors;
  - a 20-second scripted walk with 0 stuck legs;
  - one sword swing and one shot;
  - 95th-percentile frame time under budget;
  - a screenshot comparison, saved as evidence.
- Where it runs: on the Mac before each push (queued behind the push lock) or hourly on `main`. The boot-and-no-errors part also runs on a GitHub runner.
- When it goes red, it blocks the push or alerts the lane that broke it.
- Why: it catches what Jake catches today.

**3. E5, one module per shard. Effort: L (2–3 agent-days).**
- Each shard lives in `src/chunks/<shard>/index.ts`, which exports `{config, build(world), fauna, kit, audio, quest, hooks}` and is loaded on demand.
- `main.ts` becomes generic. Target: 0 slug / `ocean` / `painterly` branches outside `chunks/`.
- It also splits the 931 KB gzipped download by shard.
- Why: it removes the #1 source of merge conflicts and of one shard breaking another.

**4. Delete the losing variants. Effort: S–M.**
- Lighting standard, HDRI sky, cinematic post, look v1, Kuwahara and matte-off all go.
- WebGPU: decide whether to delete it or park it on a branch.
- URL flags move into one typed registry, dev builds only, cut from about 123 to about 25.
- Why: fewer paths that can break.

**5. Fault isolation and error reports. Effort: S.**
- Wrap each system in the loop in a try/catch: turn the failing system off and keep rendering.
- `window.onerror` posts the build id, shard, stack and player position to `api/`, the same way the inbox does, plus a daily error digest.
- Why: bugs arrive with stack traces before Jake has to file them.

**6. Ownership and fewer lanes. Effort: S (process).**
- At most 3–4 lanes, each owning its directories.
- One integrator owns `main.ts`, `Game.ts`, `ChunkDef`, `Audio.ts` and the touch UI.
- No long-lived branches: merge a shard branch daily or not at all.
- Why: ends the collisions on the hot files.

**7. Less bookkeeping. Effort: S.**
- The ask's status goes in the same commit as the code.
- CI writes the build id.
- Stop hand-editing plans for every tick.
- Why: cuts about 30% of commits.

**8. Tests where the bugs are. Effort: M.**
- Deterministic node tests for the boss, elite, quest and weather state machines, the AnimalManager AI and weapon timing, all at 0–5% coverage today.
- A "definition of done" per system: gate green, tested, has an owner, no dev flags.
- Why: regressions show up below the UI.

**9. Finish the physics boundary. Effort: M.**
- Retire `player.colliders` (F3) and move the dev scenes onto the registry (F7).
- Why: one collision path instead of two.

**10. Budgets that actually run. Effort: S.**
- `bench:ci` nightly, re-baselined after the freeze, with `latest.md` committed by CI.
- Why: load time and frame time stop drifting.

## (f) ENGINE-FIT's five engine parts, now

- **E1, the registry: built** during the PHYSICS work (`registry.add`, 19 call sites, shared with Explore). Finishing it means F3 and F7 (fix 9).
- **E2, frame phases: half built.** `Game` has input, fixed and late phases, but 84 call sites still use the flat `onUpdate` list, so the frame order is still decided in `main.ts`. Add fault isolation (fix 5) and named update phases while doing it.
- **E3, the CharacterMotor: built.** It moves the player, the horse (R2) and nearby creatures.
- **E4, input actions: still right, and more urgent.** There are 38 keydown/keyup listeners across 41 files, the touch HUD is the most-edited UI area, and riding has its own separate control scheme. Do it after E5.
- **E5, shard modules: the most important part, and the one that was skipped.** The audit said to do it "as part of the Nalati merge"; instead Nalati landed as 19k lines wired in by 15 bind calls. **Build E5 before Pine Hollow lands.**
- **What the earlier audit missed:** that no gate plays the game, the sprawl of variants and flags, error isolation and error reporting, splitting the download by shard, and the load of the process itself (lanes, ownership, bookkeeping).
- **Keeping three.js + Rapier is still right.** Switching engines fixes none of the root causes above.

---

**How this was measured.** Tests and build ran on a clean `git archive HEAD` export with a symlinked `node_modules`: vitest 39 files, 398 passed in 2.8 s; vite build 2 s. Import cycles and test reach came from my own scripts, `cycles.mjs` (Tarjan over non-type imports) and `reach.mjs` (the static import closure from the test files). There is no true line-coverage report: `@vitest/coverage-v8` isn't installed, and installing it would have touched the shared `node_modules`. Everything else came from git, `gh run list`, grep and wc.
