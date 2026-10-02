# AGENTS.md

## The E357 lock: lifted (2026-10-01)

[GAME-NORMALIZATION](project/archive/2026-10-01-game-normalization.md) is archived, so the repo is open again: `.github/lock.json` says
`"locked": false`, any agent may commit, and production deploys the newest CI-green `main`
(`.github/deploy-pin.json` mode `newest-ci-green`, Jake 2026-10-02). The layer rules, guards and ratchet below still apply.

## Engine layers (E357)

- The code is four layers: `src/engine/` (`#engine`, plus the node-safe `#engine/data`) → `src/game/` (`#game`) →
  `src/kit/` (`#kit`) → `src/shards/<slug>/`. Imports point down the arrow only; a shard never imports another shard.
- **[docs/ENGINE.md](docs/ENGINE.md)** is the public API of the three layers, one section per 01-architecture §.
  `test/engine-docs.test.ts` fails when an index export is missing from it: after an index change, run
  `ENGINE_DOC_WRITE=1 pnpm exec vitest run test/engine-docs.test.ts` and describe the new API in its section.
- **[docs/SHARDS.md](docs/SHARDS.md)** is how to write a shard: copy `src/shards/_template/`, fill the manifest, the
  plugin verbs, weapons, creatures, the look, audio, budgets, saves, strings, and the checklist to `live`. Every shard
  folder has a `README.md` (what it declares, its custom code and why, budgets, look, open asks).
- **The guards** ([ARCH-GUARDS](docs/plans/ARCH-GUARDS.md), `lint/wildshard-plugin.js`): `wildshard/layer` (public
  indexes only), `shard-sandbox` (no globals, own settings and assets), `no-level-identity` and `no-shard-branch` (no
  branching on a level's name or style outside its folder), the `no-raw-*` rules, the ratchet (`lint/ratchet.json`),
  the layout check (`scripts/check-shards.mjs`, `lint/shard-layout.json`) and the pre-commit runner
  (`scripts/precommit-guards.mjs`). ENGINE.md §24 lists them all.

## The user's asks

- Every user ask → **its own file** before you start: `scripts/ask-new.sh "<the user's words>"`
  claims the next id and creates `docs/tasks/asks/<ID>.md` (the file is the claim, so two agents
  never get the same id). Keep its `**Status:**` line true — `open` / `in flight (<date>, <owner>)` /
  `needs pick` / `done` / `dropped` — with the commit and build id as evidence underneath; flip it
  when it lands; files never leave. `.claude/hooks/session-brief.sh` prints the open ones at session
  start — relay them first. `docs/tasks/ASKS.md` is the legacy table (history up to 2026-09-22): don't
  add rows there; a legacy row that is still open moves to its own file under the same id.

## Subagents are short-lived: max 400k context, max 90 min (Jake, E352, 2026-09-30)

Subagents were 92 % of the plan usage that burned a whole weekly limit in 12 hours (E352). Since 09-22 the subagents
that ran over 2 h cost 73 % of all subagent spend, and each one ended at a median 600k context. Every call re-reads the
whole context. A subagent's prompt cache lives **5 minutes** (a main session's lives 1 h), so after any longer wait
the whole context is written to cache again at full price.
- **The main agent builds by default.** Work through a plan's rows yourself, one after another. A main session keeps its
  cache for an hour, so its waits are cheap. Spawn a subagent only for:
  - a read-heavy search that returns a conclusion (`Explore`: 8 cost $21 in E352); or
  - a job that is truly independent, owns disjoint files and fits inside the caps below.

  "Several rows are open" is not a reason to parallelise.
- **At most 3 live subagents per main session, no forks, no subagent spawning subagents.** Enforced by
  `.claude/hooks/guard-subagents.sh` (PreToolUse `Agent`). It counts a subagent as live until its transcript ends on
  `end_turn`. When it blocks, wait for a result, or do the job yourself. Escape (rare): `SKIP_SUBAGENT_CAP=1`.
- **One job per subagent, then it reports and ends.** Brief it with a job it can finish inside the caps.
- **Max context 400k tokens, max wall clock 90 min, max ~200 turns.** These caps cut off the >2 h, 600k+ tail (73 % of
  subagent spend) without chopping normal jobs in half. A subagent can't see its own context size, but it can count its
  turns, so 200 is the cap it checks itself. Put all three in the brief: "stop at 400k context, 90 min or ~200 turns,
  whichever comes first. Commit what is done, update your Handoff, report what is left." The parent starts a
  **fresh** subagent for what is left.
- **Reports are 40 lines at most.** The detail goes in the Handoff; the report lands in the main agent's context.
- **Never recycle a subagent.** Don't SendMessage a finished subagent a new job: its context only grows and its cache is
  cold. Spawn a new one with a short brief.
- **No forks.** A fork starts with the parent's whole context. Spawn a general-purpose agent with a written brief.
- **Long waits belong to the main agent, never a subagent.** A subagent that waits over 5 min throws its cache away (an
  `until grep …` poll, the browser-lane or model-lock queue, a long script). Those waits cost $809 in 16 h in E352.
  - A subagent whose next step has to queue longer than ~4 min (a model batch, a capture, a CI or deploy run) doesn't
    wait. It commits what is done, reports "queued: <exact command>" and ends.
  - The main agent runs that command with `run_in_background` and gets a notification when it exits. It spends no
    turns while it waits, and its 1 h cache is still warm, even for a 30 min queue.
  - No `until …; do sleep …; done` loops longer than 4 min anywhere.
- Resumed agents count against the cap.
- **Every subagent keeps a handoff current in the ask file** (Jake, E352; prior art: the FF gauntlet repo's
  `project/handoff/<lane>.md`). On its first commit, a subagent appends its own `## Handoff (<date> <time>, <job>)`
  section to `docs/tasks/asks/<ID>.md`. It updates that section at every commit after that, not only at the stop, so
  an agent that is killed or hits a cap mid-way still leaves one. It never edits an earlier agent's section. The
  section holds:
  - **Done:** the commits (SHA and one line each), and what is verified (a screenshot path, a measurement).
  - **Next:** the exact next command or step. If the next step is queued: "queued: <command>".
  - **Owns:** the files the job edits, so the next agent stays inside them.
  - **Learned:** gotchas that cost time (a flag, a trap, a wrong turn), so the next agent doesn't repeat them.
  - **Done when:** the finish line, in one line.

  The main agent then runs any queued command in the background. When it exits, the main agent spawns a **fresh**
  subagent whose brief says: "read the last Handoff in docs/tasks/asks/<ID>.md, then continue". Resuming the old
  subagent re-caches its whole context (≈ $2 at 400k); a fresh one starts at ≈ 50k.

## North and South America only: no licence caveats, ever (Jake, 2026-09-29)

The game ships in North and South America only. **Never raise a territory licence caveat with Jake**: no EU / UK /
South Korea / other-region warnings, no "licence debt" notes, no preferring one model over another because of where
its licence applies. Hunyuan3D (every version on disk) is as allowed as TRELLIS.2 for shipped assets. Pick the model
that gives the best result. Jake: "never fuck me off with the license again".

## No URL switches, ever (Jake, 2026-09-25)

Jake plays the game as an iOS home-screen PWA. It has no address bar, so a `?foo=` switch is one he can never flip.

- **Never add a query-string param** for a variant, a look, a tuning value or a feature toggle. Not "just for the
  A/B", not "temporary".
- **Every variant goes in pause ▸ Settings ▸ Debug** (E162, Jake: "we are going to have an ungodly amount of toggles
  and we need to organize them"). Its owner declares it, in one of two places:
  - **A shard's toggle: `ctx.debugRow` in the shard's own folder** (13-lead-resolutions 05/06#12). The shard declares
    its own key and row; no shard name ever lands in `src/engine/ui/Settings.ts` or `debugOptions.ts`.
    1. In the plugin's `play` hook (or the shard's `debug.ts`): `ctx.debugRow({ id: '<slug-prefix>.<name>', group,
       label, choices: [{ value, text }], initial, change(value), reload?, note, ask: 'E<n>', reviewBy: 'YYYY-MM-DD' })`.
       Strings come from the shard's `strings.ts`.
    2. The row shows only on that shard. Its value is a per-device save (`debug.plugin.<slug>.<id>`); `change` runs on
       a pick, and once at load when the saved value differs from `initial`. The row goes when the shard unloads.
    3. A test or capture drives it through a handle the shard exposes with `ctx.debug.expose(name, value)`
       (`window.__wildshard.shard[name]`).
    4. A shard never reads an engine option it doesn't own (`wildshard/shard-sandbox`). To show an existing engine row
       on a shard, list its key in the manifest's `debugOptions`.
  - **An engine-wide toggle: the registry.** Only for a variant of engine code, never named after a shard:
    1. `src/engine/ui/Settings.ts`: a key in `OPTION_VALUES` (the first value is the default) and `OPTION_SPECS` → `DEBUG_ONLY`.
    2. `src/engine/ui/debugOptions.ts`: one `opt(key, group, label, choices, { reload?, when?, note, ask: 'E<n>', reviewBy: 'YYYY-MM-DD' })`
       row in `DEBUG_ROWS`, under the group whose domain it is. `when` shows it only where it applies; `reload: true` if
       the thing is built once. `src/engine/ui/DebugMenu.ts` renders it — no Menu.ts edit. `test/debug-options.test.ts`
       fails an option with no row.
    3. The game reads it with `setting(key)` (at load for a reload row) and `onSettingChange(key, fn)` (live).
    4. A test / capture script sets it before the load: `debugSettings(page, { key: 'value' })` (`scripts/debug-settings.mjs`).
  - Both routes: `pnpm gen` updates `lint/ask-ids.json`; commit that inventory when a new ask owns a flag (Vercel
    excludes docs). Every row raises the Debug-row count capped in `lint/ratchet.json` (`debugRows.max`, the ask in
    `raisedBy`); a reopened shard's lane can't edit `lint/`, so it asks the lead.
  - **Never add a new group without need.** The groups are Look · Ground cover & foliage · Sky & weather · Audio ·
    Combat & weapons · Creatures & NPCs · Performance · Loading & memory · Developer tools; lighting, shadows, post and
    water are Look. A new group is for a new domain with several rows, not for one toggle.
  - When Jake picks a winner, delete the row, the option and the losing code in one commit (E136 / E162 style).
  - **Under the E357 lock** (GAME-NORMALIZATION) a new toggle is added only for an E357 row or a Jake ask: by the lead,
    or by a content agent through `ctx.debugRow` inside its reopened shard folder.
- **The params the game may read are a fixed allowlist**, `lint/url-params.json`. `harness` is what the test, capture
  and bench scripts pass to drive the game headless (tier, touch, chunk, spawn, skipintro, mute, …). Adding to it needs
  Jake's explicit OK. `legacy` (the old switches, E162) is empty: never add to it.
- **The lint enforces it.** `wildshard/no-url-switch` (`lint/wildshard-plugin.js`, on for `src/` except the `src/dev/`
  harness pages) refuses `.get` / `.has` / `.getAll` of any param not on the list, a param name it cannot read as a
  string, and raw `location.search` parsing. Don't disable it; move the variant to the menu.

## Local models: music · SFX · 3D · mockups (read before you generate any asset)

The game's music, sound effects and 3D models are generated **on this Mac** (M5 Max, 128 GB unified memory), not in
the cloud. Mockups are the exception: they still come from codex. Two repos next to this one hold all of it:

- **[`~/projects/weights`](../../weights/)** is the machine's one weight store.
  - [`MODELS.md`](../../weights/MODELS.md) lists what is downloaded, with sizes and licences.
  - Add a model only with `bin/fetch-repo.sh <org/repo>`: it resumes and checks sha256. Never use `hf download`, and
    never copy weights into a tool's folder.
  - Never `git add` a weight ([its AGENTS.md](../../weights/AGENTS.md)).
- **[`~/projects/localai`](../../localai/)** says how to run each model, how fast it is and what breaks.
  - [`docs/music-models.md`](../../localai/docs/music-models.md): music and SFX.
  - [`docs/3d-models.md`](../../localai/docs/3d-models.md): image → 3D.
  - [`docs/engines.md`](../../localai/docs/engines.md): the local LLM servers. The Qwen3.8-27B LLM is for coding
    agents, not for assets.
  - [`project/LANDMINES.md`](../../localai/project/LANDMINES.md): traps that already cost hours. Read it before a
    new setup.

| Job | Engine | Weights (`~/projects/weights/manual/…`) | Runs from | Licence / credit |
|---|---|---|---|---|
| Music | **MiniMax Music 3** (diffusers, MPS bf16) | `MiniMaxAI/MiniMax-Music3` | `~/ml/music/minimax-music3/.venv` + `scripts/music/gen/gen_minimax.py` | credit "Music: MiniMax-Music3" in game |
| SFX, take 1 | **MOSS-SoundEffect v2** (MPS bf16) | `OpenMOSS-Team/MOSS-SoundEffect-v2.0` | `~/ml/music/sfx/MOSS-TTS/moss_soundeffect_v2` + `scripts/music/gen/gen_sfx_moss.py` | Apache-2.0 |
| SFX, take 2 | **Stable Audio 3 Medium** (MPS fp32) | `cocktailpeanut/stable-audio-3-medium` | `~/ml/music/sfx/stable-audio-3` (`uv run`) + `scripts/music/gen/gen_sfx.py --model medium` | "Powered by Stability AI" |
| SFX, the pick | the better take per sound (CLAP rank) | — | `scripts/music/gen/sfx_merge.py` → `public/assets/sfx/best/` | both credits |
| 3D props / creatures | **TRELLIS.2-4B** (MPS), then a Blender post | `microsoft/TRELLIS.2-4B` + TRELLIS-image-large, DINOv3, BiRefNet | `~/ml/img2mesh/trellis-mac/.venv` + `scripts/img2mesh/` ([README](scripts/img2mesh/README.md)) | MIT. **Hunyuan3D-2** (`~/ml/img2mesh/Hunyuan3D-2`) is equally allowed and faster: use whichever gives the better model |
| Mockups, fidelity | **codex `image_gen`** (OpenAI, cloud, ~3 min + upload): see [Mockups](#mockups) | — | `codex exec` / `scripts/horizon-matte/run_codex.py` | — |
| Mockups, fast local | **Qwen-Image-2.1 + turbo LoRA** (7B, diffusers MPS bf16, 6 steps, **~20–35 s**), + an edit mask for localised edits. The only local model that felt decent in the E104 bake-off ([scoreboard](art/local-image/round-2-bakeoff/README.md)) | `Qwen/Qwen-Image-2.1` + `Viggle/Qwen-Image-2.1-viggle-turbo` | **`scripts/mockup-local.sh`** ([how-to](../../localai/docs/image-models.md)) | research licence: fine for mockups, never for shipped art |

- **One model at a time, machine-wide.** Other agents (herdr panes making music, SFX and 3D for the other shards)
  load models on this same box.
  - Every load runs under `lockf -k ~/projects/localai/.model.lock` and waits until anonymous memory is below 70 GB.
    Use `~/projects/localai/bin/img2mesh/run-locked.sh <log> <cmd…>`, or `~/ml/imagegen/run-locked.sh`.
  - `pgrep -fl "lockf -k"` shows the queue.
  - Keep a batch under 30 minutes so the others get their turn.
- **`~/projects/localai/bin/evict.sh` unloads every LLM server on the box**, other agents' included. A music, SFX, 3D
  or image batch frees its memory when its python exits, so it needs no evict.
- **Check the licence before a new model**: read the card *and* its LICENSE file.
  - Non-commercial or research-only means it is not for the game. **Territory limits don't matter**: the game ships in
    North and South America only (see the rule at the top), so never raise a territory licence caveat.
  - Then fetch it with `fetch-repo.sh`, add a `MODELS.md` row, and write down its speed and memory in a localai doc.
- **Blender models: the script is the source, the GLB is committed, a `.blend` never is** (M10, E315;
  [why](docs/design/blender-practice.md)). A Blender model is a headless `bpy` script in `scripts/blender/<slug>/` with a
  row in `scripts/blender/targets.json`. Build it with `bash scripts/blender/build.sh <target>` (Blender 5.2.1,
  `--python-exit-code 1`, the model lock) and commit the GLB. `--check` rebuilds and compares with the committed GLB;
  `--save-blend` puts an inspection `.blend` in `~/.cache/wildshard-blender/`. `scripts/check-model-sources.mjs` (in
  `pnpm test`) refuses a Blender GLB with no script, an orphan script and a tracked `.blend`.
- **Where a shard's generated assets go:** its own folders, `public/assets/<slug>/`, `public/assets/music/<slug>/`,
  `public/assets/sfx/<slug>/` (and the folders in its manifest's `assetGlobs`). Its code loads them by those paths;
  an `/assets/…` path outside them fails `wildshard/shard-sandbox`. A model it shows is a `defineModel` row in
  `src/shards/<slug>/models/` and a `live(model)` entry in its `roster.ts` (`#engine`).

## Plans (`docs/plans/`) and their state

- A plan is a `docs/plans/<NAME>.md` with a checkpoint / lever table. Line 3, right under the title,
  is its **State** line — `**State:** \`<state>\` <YYYY-MM-DD> — <one line: what landed, what is open,
  who or what it waits on>`. The session brief prints it, so keep it true; rewrite it (don't append)
  whenever the state or the open work changes. The plan's detailed status tables stay below it.
- States, in order:
  - `draft` — written, waiting on the user's go. Nothing gets built from a draft.
  - `in progress` — being built; the line names the open rows and their owners / ASKS ids.
  - `blocked` — nothing to build until something named arrives (a phone reading, a user pick).
  - `finished` — every row is built, deployed and ticked, and every leftover is an **open ASKS row**
    (a plan table is not a queue once it is archived).
  - `archived` — a finished plan, moved **in the same commit it finishes** to
    `project/archive/<YYYY-MM-DD>-<name>.md` (the date it finished), the State line reading
    `archived <today> (finished <date>)` plus where the leftovers went. So `docs/plans/` only ever
    holds live plans (`draft` / `in progress` / `blocked`).
  - `dropped` — the user dropped it: State line with their words, then archived like a finished one.
- Moving a plan: fix the links to it in docs and code comments; `docs/tasks/ASKS.md` rows keep the
  old path (they are history).

## Council rounds (Jake, E361, 2026-10-01)

When Jake says "do N council rounds on X", it means the protocol in [docs/process/COUNCIL.md](docs/process/COUNCIL.md):
- Each round has three fresh reviewer seats: Codex `codex exec`, plus two Claude subagents.
- The council keeps a frozen ledger, one bar for what counts as a finding, one register of findings, a review surface
  that shrinks each round, and a scenario battery that only grows.
- **Four rounds at most, always.** Never loop "until two rounds come back clean": two clean rounds may end a council
  early, but never extend it. After the last round, open items go to Jake as decisions, one recommended answer each.

## Version control

- Commit early and often with small commits, and `scripts/push-main.sh` after every commit —
  don't let local commits pile up. A push runs CI; the hourly deploy ships the latest green `main`
  (see Deploy), so before you push,
  HEAD must pass the four CI gates on a clean export of the tree — `tsc --noEmit`, `oxlint`,
  `node scripts/check-css.mjs`, `vite build` — not just the files you touched.
- **Before you push (E357 Z4):** keep the permanent per-push gate green: `macos-15` parity jobs for every shard
  and the template; node checks for layers, ratchets, contracts, the asset audit, `gen-shards --check` and coverage.
  Keep the nightly `gpu-perf` run on Jake's Mac enabled. The lead owns the batched runs and push during E357.
- **Strict means strict.** `tsconfig.json` has every strictness flag on and `.oxlintrc.json` is
  type-aware with every category at error and zero warnings allowed. Fix the type, never the
  gate: no `any`, no non-null `!`, no `@ts-ignore` / `@ts-expect-error`, no `as unknown as`, no
  tsconfig `exclude`, no blanket `oxlint-disable`. A per-line
  `oxlint-disable-next-line <rule> -- <reason>` only where the rule is genuinely wrong there.
- **Shared-tree safety** — this checkout has **up to ~10 agents editing the working tree at
  once** (parallel Claude sessions and their subagents, all on `main`, no worktrees), sharing
  **one working tree, one git index and one local `main`**. **NEVER** `git stash`, `checkout`,
  `restore`, `git rm`, or otherwise mutate files you didn't author, and leave everyone else's
  uncommitted WIP untouched. Verify before you claim: `git status`, `git log origin/main..main`
  (empty = shipped), and `version.json`.
- **Commit with a pathspec, never from the shared index** — enforced by
  `.claude/hooks/guard-git-add-all.sh` (ported from kami-kakushi):
  - an edit to a tracked file is never staged; commit it directly:
    `git commit -m "…" -- path/a path/b` (commits those paths' working-tree copies, nothing else);
  - `git add` only for a **new** file, then the same pathspec commit;
  - blocked: `git add -A` / `.` / `-u`, `git add <tracked file>`, `git commit -a`, and any
    `git commit` without `-- <paths>`. Rare deliberate escape: `SKIP_SWEEPGUARD=1`, and every use
    lands in `project/sweepguard-ledger.md` (auto-committed by `.githooks/post-commit`).
  - A pathspec commit takes the **whole file**. If a file you're committing also carries another
    agent's uncommitted hunk (`git diff -- <path>` shows lines you didn't write), don't ship their
    half-done work inside yours: wait for them, or commit only your hunks (the private-index recipe,
    `.claude/skills/prepare-to-exit/SKILL.md` step 1).
- **Push with `scripts/push-main.sh`, never `git push`** — enforced by
  `.claude/hooks/guard-bash-safety.sh`. The uplink is ~10–100 KB/s and six parallel pushes of the
  same pack hung for 15+ minutes (E19). The script takes `.git/push.lock`; if another push holds it,
  your commits stay local and it exits 0 — that push re-checks `origin/main..main` before it lets go,
  so it carries yours. Escape (rare): `SKIP_PUSHLOCK=1`.
- **No tree-wide destructive git, no escape** (same hook): `git restore .` / `checkout .`, a bare
  `git stash`, `git reset --hard`, `git clean -f` without paths are blocked; name the paths you
  authored instead.
- **Keep pushes small.** `.githooks/pre-commit` refuses a `progress/` image over 500 KB: save
  screenshots as JPEG / WebP. `.gitattributes` marks binaries `-delta`.
- **The pre-push gate builds what Vercel builds.** `.githooks/pre-push` runs `scripts/vercel-tree-gate.sh` on the tip
  you push (~6 s, stamped per commit). The script checks out only the files `.vercelignore` lets through and runs
  check-css · typecheck · oxlint · vitest · vite build on them. It refuses the push when `.vercelignore` would drop
  anything under `src/`, `public/`, `api/` or `scripts/`. Before it (E41), unanchored patterns (`art`) dropped
  `src/explore/art/`, and deploys went red on Vercel with CI green. Anchor every `.vercelignore` line with `/`. A red
  gate is yours to fix before the push, not after. Escape (rare): `SKIP_VERCEL_GATE=1`.
- **Hooks on:** every checkout runs `git config core.hooksPath .githooks` once (the session brief
  warns when it's off). The Claude hooks are in `.claude/settings.json`; an edit there takes effect
  on a session restart.
- Never open a shared file for writing before you've read it: `open(p, 'w').write(f(open(p).read()))`
  truncates first and reads nothing (it wiped every uncommitted ASKS row on 2026-09-22). Append with
  `>>` or Edit; never `>` onto a shared file.
- Deploy from a clean export of HEAD (`git archive HEAD | tar -x -C <dir>`), never from the working
  tree, so nobody's half-finished files ship.
- Every screenshot session must be closed (`agent-browser --session <s> close`) before you
  report — an open one keeps rendering the game and pins the box.
- **Game browsers are a shared lane: at most 4 open across all agents on this machine (Jake raised it from 3 on 2026-09-30), enforced (E312).**
  Each open game tab costs ~1.5 cores and ~1 GB for as long as it is open, and memory competes with the local-model jobs.
  - Run every Playwright / Puppeteer script through **`scripts/browser-lane.sh [--max <min>] <cmd…>`**. It waits for a
    free slot, releases it when the command exits (a crash included) and kills the command after `--max` minutes
    (default 60).
  - Before a new agent-browser session: `scripts/browser-lane.sh wait && agent-browser --session <s> open …`. Reusing
    your open session is always fine; `close` it the moment you are done (idle sessions also close after 5 min, via
    `idleTimeout` in `~/.agent-browser/config.json`).
  - `.claude/hooks/guard-browser-lane.sh` blocks a browser-launching `node` / `pnpm` script that isn't wrapped, and a new
    agent-browser session while the lane is full. Escape (rare): `SKIP_BROWSER_LANE=1`.
  - Zombies are reaped: `scripts/browser-lane.sh reap` kills headless Chromiums whose parent died or that are older than
    90 min, and vite servers started from a session scratchpad more than 24 h ago. It runs before every lane wait and
    from the SessionStart / Stop / SubagentStop hooks. `scripts/browser-lane.sh status` shows who holds what; the
    log is `~/.browser-lane/reap.log`.
  - **No vite dev servers (Jake, E317: "Vite dev sucks").** Serve a build:
    `scripts/serve-build.sh [--head] [--hours <h>] [--name <label>]` (≈ 10 s; public/ is symlinked, not copied) prints
    `http://127.0.0.1:<port>/`; `scripts/serve-build.sh stop <port>` when done. `pnpm dev` runs it too. The hook blocks
    `vite` dev; the reaper stops a preview past its `--hours` (default 4), an unregistered preview after 6 h and any dev
    server after 2 h.
  - **iOS Simulators go through `scripts/sim-lane.sh` (E316):** at most 1 booted machine-wide; `run [--max <min>]
    <device> <cmd…>` boots, runs and shuts down, `lease <device> [<min>]` holds it while you drive it by hand, `release`
    shuts it down. The reaper shuts down a Simulator whose lease expired, or one with no lease that has been idle for
    30 min. The hook blocks a raw `simctl boot` / `open -a Simulator`. How to drive one: `.claude/skills/ios-simulator/SKILL.md`.
  - Render on the GPU: agent-browser does by default, and Playwright scripts pass `--use-angle=metal` like
    `scripts/bench-load.mjs`. **SwiftShader (`--use-angle=swiftshader`, Android `-gpu swiftshader_indirect`) only when
    the user asks for it**: it draws on the CPU, ~3 cores per page. No `--disable-frame-rate-limit`. One Android emulator
    at a time, killed (`adb -s <serial> emu kill`) when the run ends.

## Mockups

- To design the best game, you can use the codex CLI to generate mockup images
with openai image generation, the mockup images are screenshots of the wildshard
singleplayer demo running in Chrome, as if a playtester was hitting print screen
on his laptop.
- **Two engines. Pick by the job** (E100, E104, E107):
  - **Qwen-Image-2.1 turbo, local: fast.** `scripts/mockup-local.sh --ref <live capture> --prompt-file <p.txt> --out
    <png>` takes ~20–35 s per image on this Mac, against ~3 min plus upload and reconnect hangs for codex. Use it to
    iterate on a layout, to explore many variants quickly, for text-heavy panels, for asset references on white, and
    whenever codex is out of quota.
    - **For a localised edit** (move a button, add a chip or a panel), pass `--mask <png>`, white where the change
      goes. The frame outside the mask comes back pixel-identical.
    - Inside the mask it is seed-dependent. On the hover-pill job, 2 of 3 seeds placed the new pill correctly; seed 42
      removed the old pill without drawing the new one. Run 2–3 seeds (`--seed <n>`, ~25–35 s each) and keep the one
      that did the edit. Read every image.
    - Its weak spots: it greys Driftwood's toon palette, garbles text under ~10 px, and re-composes the camera when
      given several `--ref`s. Give it one reference and read every image.
    - It runs under the shared model lock, so it can queue behind music, SFX and 3D jobs.
  - **codex `image_gen`: fidelity.** Use it for the final frames on a decision board, whole-frame HUD re-layouts that
    need correct small text, icons and anything shipped. The flow is below.
- **Where they go:** every mockup / concept image / art asset lives in
  `art/<subject>/round-<n>-<label>/` (e.g. `art/hud/round-7-sword-touch/`,
  `art/feedback/round-1-inbox/`; next free round per subject). Never loose in `art/`, never a new
  top-level folder (`mockups/`, `renders/` …). Existing `art/` files are not moved or renamed.
  `art/README.md` is the index. The plan that asked for them lists each file and what it shows.
- **Start from a live capture, not from nothing.** Take the real game's frame first
  (`agent-browser --session <s> set viewport 1600 900`, or `390 844` + `?touch&tier=phone` for the
  phone; `open "https://wildshard-singleplayer.vercel.app/?skipintro&nolock&weapon=sword"`; wait for
  the load (~60–120 s headless); `screenshot`; `close`). Save it in the session scratchpad and pass it
  with `-i`. codex then **edits** that frame, so the world, the camera and the existing HUD stay true
  and only the new thing is invented. Shots in `progress/` have no HUD, so they are poor UI references.
- **One image per headless run, runs in parallel** (one `&` per variant, then `wait`; 4–6 at once is
  fine, each takes a few minutes):

  ```bash
  codex exec -s workspace-write --skip-git-repo-check -C "$REPO" --add-dir ~/.codex/generated_images \
    -i "$SP/ref-desktop.png" -o "$SP/<id>.last.txt" "<COMMON><SCREEN>
  TASK FOR CODEX: Use the built-in image_gen tool to EDIT the attached reference screenshot into
  exactly ONE 16:9 landscape image as described above (keep the world, camera and existing HUD; add
  the new UI in the same UI language). One generation only. Then copy the PNG that YOUR image_gen
  call produced (its path is in the tool result; other runs are writing to ~/.codex/generated_images
  at the same time, so never 'the newest file') into
  $REPO/art/<subject>/round-<n>-<label>/<id>.png. Create or modify no other file." > "$SP/<id>.log" 2>&1
  ```

  **Don't wait for codex to copy its own file.** The image lands in
  `~/.codex/generated_images/<session id>/` about 3 min in. codex's follow-up "copy it" turn can then hang 10+ min on
  reconnects over the slow uplink (E41, 2026-09-23). The runner reads `session id:` from each run's log, polls that
  folder, copies the PNG the moment it appears and kills that codex. Pass the reference as a JPEG (~300 KB, not a
  1.4 MB PNG): every run uploads it. More parallel runs don't slow each other; the waiting is per run, not a queue.
  The model and effort come from `~/.codex/config.toml` (gpt-6.1-sol). If a run fails with "model is not
  supported when using Codex with a ChatGPT account", the CLI is stale: `codex update` fixes it (E357: 0.157.1 → 0.159.2). `image_gen` is codex's built-in tool (the
  system `imagegen` skill), so it needs no `OPENAI_API_KEY`. Write the prompts and the runner script
  into the scratchpad with the Write tool: the `dcg` hook blocks shell redirects to computed paths.
- **The prompt has two blocks.** COMMON is shared by every run. It says what the game is (low-poly
  stylized first person, Driftwood Isle) and that the image must read as a real print-screen of it,
  not concept art, with no device frame, browser chrome or watermark. It also carries the UI language:
  dark navy glass `#0d1b26` ~80 %, 1 px cyan `#8fe3ff` hairlines with corner brackets, letter-spaced
  monospace uppercase labels, no gradients or emoji. SCREEN is one variant: what is on screen, where
  (the left 30 %, under PAUSE …), and **every string of UI text verbatim, in quotes**. Unquoted text
  comes back garbled.
- **Look at every image before you report it** (Read the PNG). Re-run a variant whose text is garbled
  or whose HUD drifted from the reference. Say which ones were re-rolled.
- Make several different variants per question (a layout A / B / C…), not one. Then the user can pick
  one and name its letter.
- **Commit JPEG, not PNG.** image_gen hands back 1.4–2 MB PNGs, and the uplink is slow.
  `sips -s format jpeg -s formatOptions 88 X.png --out X.jpg && rm X.png` → ~300–450 KB each.

## HUD changes are coordinated over herdr (Jake, E332)

Every shard shares one HUD (E154), so HUD work collides between sessions. The HUD files are src/engine/player/TouchControls.ts,
src/engine/ui/HUD.ts, hudSlots.ts, WeaponStrip.ts, RideHUD.ts, FirstHints.ts, Minimap.ts, Map.ts and src/engine/ui/styles/touch.css /
game.css / ride.css.
- **Before** you change what a HUD control is, where it sits or when it shows, tell the other live agents:
  `herdr agent list`, then `herdr agent prompt <name> "[from <you>] HUD change: <what, which files, the ask id>"`
  (no `--wait`). Say what their code may need to follow: a selector, a slot, a visibility rule.
- **After** it lands, send the SHA to the same agents.
- A HUD change that isn't only a bug fix also needs Jake's pick (a board) first. The current layout is E319: the left
  edge is HORSE · HOVER · SWAP ring; VITALS hide at full health; LOCK shows only with a target.

## Games

### Rendering regression: no facade multi-draw anywhere (E271 / E272)

- **Facade multi-draw is prohibited across the baseline, every shard, every quality tier, and every platform.**
  Jake explicitly made this global on 2026-09-28. Do not narrow it to iOS, mobile, Nine Dragon, or a default setting.
- Read [the permanent incident and evidence](docs/audits/nine-dragon-mobile-multidraw.md) before changing facade
  rendering, batching, `BatchedMesh`, `WEBGL_multi_draw`, shader preparation, or memory policy. The facade batching
  implementation, shader branch and toggle were removed. Do not reintroduce them, create another toggle, rename the
  same path, or move it into a shared helper. Use instancing and preserve the scene's visual content.
- Extension support, a Simulator pass, a desktop benchmark, lower draw-call counts and JS heap readings did not
  establish safety: an actual iPhone killed WebContent after multi-GB allocations while the Simulator stayed below
  1 GB. New rendering optimizations require physical-device memory/stability evidence as well as local tests.
- `pnpm test:gpu-boot` includes `scripts/test-facade-instancing.mjs`: it requires the actual facade to stay instanced
  with multi-draw available on desktop, phone tier, and an iPhone using desktop quality. Keep this regression check;
  do not weaken it to make an optimization pass. Memory targets remain 1.8 GB loading / 1.0 GB Explorer (decimal).

- A finished game will run at 60 FPS only.
- A finished game will have AAA graphics that are photo realistic worthy of PS5

## Audio engines (the user, 2026-09-23)

- **Music: MiniMax Music 3**, generated locally (weights in `~/projects/weights`). New music is made with it and
  nothing else; the in-game credit "Music: MiniMax-Music3" is a licence condition.
- **Sound effects: every sound is generated twice**, once with **MOSS-SoundEffect v2** and once with
  **Stable Audio 3 Medium**, and **the better take of the two ships**, picked per sound. The game has one merged
  set, not a set per model. Both credits show ("Powered by Stability AI" is a Stability licence condition).
- How to run them, the shared lock and the weight store: [Local models](#local-models-music--sfx--3d--mockups-read-before-you-generate-any-asset)
  (top of this file).

## Physics (Rapier, PHYSICS.md — since the physics merge)

- **`src/engine/physics/` owns collision.** It is the only code that imports Rapier. Nothing else hand-rolls a collision test:
  no ray-vs-box maths, no terrain bisection, no push-out loops. Ask the queries: a shard imports `castRay`,
  `castSegment`, `lineOfSight`, `floorBelow` and `sticksIn` from `#engine`; engine code also has `sweepBall`
  (`src/engine/physics/query.ts`). Engine code gets the world from `app.physics`; `activePhysics()` is a legacy
  singleton the `wildshard/no-active-singleton` ratchet is retiring. `heightAt()` stays for placement and drawing only.
- **A new static thing collides by registering.** The builder emits `ColliderDesc`s (`boxDesc` on `#engine`) beside
  the geometry it draws:
  - box / capsule / ball / hull;
  - `treads` for any stair: rise ≤ 0.35 m and tread depth ≥ 0.36 m, or the capsule rides the edges;
  - trimesh only for walk-inside shapes.
  A shard registers it with `ctx.piece({ id, name, category, file, object, colliders, surface, floor?, active?,
  model? })` in its plugin's `world` hook; the piece leaves with the shard's scope. Engine code registers with
  `app.registry.add(…)` (`WorldRegistry`, `src/engine/world/registry.ts`). A moving piece `follows` its Object3D, which
  puts it on a kinematic body; a door is a piece whose `active()` is false while it is open. `model` puts it in
  Explore's catalog: it is the one registry, so never register a built thing a second time for Explore. The old
  `player.colliders` bridge is retired (F11).
- **The player walks on colliders.** Step 0.35 m, max climb 40° (the user's picks). A walkable surface needs real
  geometry. A path over a crag is graded into the terrain (`TerrainSpec.graded`, never inside the Blender cove's
  baked area); a steep one gets a walkway from `pathRampDescs` (`#engine`, `src/engine/physics/paths.ts`). After changing a builder's colliders, re-run
  `node scripts/physics-baseline.mjs --no-build --mode=walk` (and `--trails`): 0 stuck is the bar. If structures
  moved, re-bake the navmesh (`node --experimental-transform-types --import ./scripts/bake-loader.mjs
  scripts/bake-navmesh.mjs`; `--check` tells you when it's stale).
- **Moving things** go in the fixed step: a system in phase `'fixed.pre'`, `'fixed.step'` or `'fixed.post'`
  (`ctx.system` in a shard; 60 Hz, hit-stop slows it), interpolated with `game.alpha`. Dynamic bodies go through
  `activeBodies` (`#engine`, `src/engine/physics/bodies.ts`), which enforces the per-tier caps (phone 40 awake /
  2 ragdolls).

## Deploy

- `.github/workflows/deploy.yml` runs the gates on every push and pull request. Production
  deploys at :17 each hour or from `gh workflow run deploy`; the job skips if
  `/version.json` already reports `main`'s short SHA. `gh workflow run deploy -f force=true`
  redeploys the same commit. The job builds Vercel output in GitHub Actions and uploads it
  with `vercel deploy --prebuilt`, so Vercel does not repeat the build.
  `VERCEL_BUILD_TOKEN` is the team-scoped Actions secret used for `vercel pull`,
  `vercel build` and `vercel deploy`; the old project-scoped token cannot run the
  CLI account lookup. No credentials belong in Git.
- **Production ships the newest CI-green `main`** (Jake, 2026-10-02: "fix the deploy, whatever it takes"). The hourly
  or manual release reads `.github/deploy-pin.json`: mode `newest-ci-green` picks the newest main commit whose push
  `deploy` run (typecheck, lint, test, build) passed. `gpu-gate` still reports on every push but does not hold a release
  (its push runs cancel each other under the agents' push stream). `mode pinned` (`deploy-pin.mjs set` / `rollback`)
  freezes production on one SHA; `mode newest-green` waits for gpu-gate.
- After every push, watch that push's CI run. After
  the next hourly or manual deployment, confirm `https://wildshard-singleplayer.vercel.app/version.json` reports the
  shipped short SHA and record the build ID in the ask file. A green push means verified in GitHub, not yet live. If
  the game needs an immediate release, run `gh workflow run deploy` and watch it.
- Do not run `vercel deploy` by hand while CI is healthy. Keep commits and pushes small.
