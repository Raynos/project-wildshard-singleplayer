# AGENTS.md

## The user's asks

- Every user ask → **its own file** before you start: `scripts/ask-new.sh "<the user's words>"`
  claims the next id and creates `docs/tasks/asks/<ID>.md` (the file is the claim, so two agents
  never get the same id). Keep its `**Status:**` line true — `open` / `in flight (<date>, <owner>)` /
  `needs pick` / `done` / `dropped` — with the commit and build id as evidence underneath; flip it
  when it lands; files never leave. `.claude/hooks/session-brief.sh` prints the open ones at session
  start — relay them first. `docs/tasks/ASKS.md` is the legacy table (history up to 2026-09-22): don't
  add rows there; a legacy row that is still open moves to its own file under the same id.

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
| 3D props / creatures | **TRELLIS.2-4B** (MPS), then a Blender post | `microsoft/TRELLIS.2-4B` + TRELLIS-image-large, DINOv3, BiRefNet | `~/ml/img2mesh/trellis-mac/.venv` + `scripts/img2mesh/` ([README](scripts/img2mesh/README.md)) | MIT. Hunyuan3D-2 is in the store and faster, but **not for this game** (its licence bars the EU, UK and South Korea) |
| Mockups | **codex `image_gen`** (OpenAI, cloud): see [Mockups](#mockups) | — | `codex exec` / `scripts/horizon-matte/run_codex.py` | — |
| Mockups, local trial | **Qwen-Image-2.1** (7B, diffusers, MPS bf16): E100, on trial against codex. Results: [`art/local-image/round-1-qwen21-vs-codex/`](art/local-image/round-1-qwen21-vs-codex/README.md) | `Qwen/Qwen-Image-2.1` | `~/ml/imagegen/run_each.sh` (one process per job; [how-to](../../localai/docs/image-models.md)) | **Qwen Research Licence: evaluation only, nothing it makes ships** |

- **One model at a time, machine-wide.** Other agents (herdr panes making music, SFX and 3D for the other shards)
  load models on this same box.
  - Every load runs under `lockf -k ~/projects/localai/.model.lock` and waits until anonymous memory is below 70 GB.
    Use `~/projects/localai/bin/img2mesh/run-locked.sh <log> <cmd…>`, or `~/ml/imagegen/run-locked.sh`.
  - `pgrep -fl "lockf -k"` shows the queue.
  - Keep a batch under 30 minutes so the others get their turn.
- **`~/projects/localai/bin/evict.sh` unloads every LLM server on the box**, other agents' included. A music, SFX, 3D
  or image batch frees its memory when its python exits, so it needs no evict.
- **Check the licence before a new model**: read the card *and* its LICENSE file.
  - Non-commercial, research-only or territory-restricted means it is not for the game. TangoFlux and
    HunyuanVideo-Foley were refused for this.
  - Then fetch it with `fetch-repo.sh`, add a `MODELS.md` row, and write down its speed and memory in a localai doc.

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

## Version control

- Commit early and often with small commits, and `scripts/push-main.sh` after every commit —
  don't let local commits pile up. **A push is a deploy** (see Deploy), so before you push,
  HEAD must pass the four CI gates on a clean export of the tree — `tsc --noEmit`, `oxlint`,
  `node scripts/check-css.mjs`, `vite build` — not just the files you touched.
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
- **Game browsers are a shared lane: at most 3 open across all agents on this machine.** Check
  `agent-browser session list` and `pgrep -fl chrome-headless-shell` before you open one; if 3
  are already running, wait or reuse your own session. Each open game tab costs ~1.5 cores for as
  long as it is open (agent-browser now closes idle sessions after 5 min, via `idleTimeout` in
  `~/.agent-browser/config.json`). Render on the GPU: agent-browser does by default, and Playwright scripts
  pass `--use-angle=metal` like `scripts/bench-load.mjs`. **SwiftShader (`--use-angle=swiftshader`,
  Android `-gpu swiftshader_indirect`) only when the user asks for it**: it draws on the CPU,
  ~3 cores per page. No `--disable-frame-rate-limit`. One Android emulator at a time, killed
  (`adb -s <serial> emu kill`) when the run ends.

## Mockups

- To design the best game, you can use the codex CLI to generate mockup images
with openai image generation, the mockup images are screenshots of the wildshard
singleplayer demo running in Chrome, as if a playtester was hitting print screen
on his laptop.
- A local alternative, **Qwen-Image-2.1** on this Mac, is on trial against codex (E100; see
  [Local models](#local-models-music--sfx--3d--mockups-read-before-you-generate-any-asset)). Codex stays the mockup
  path until the user picks otherwise.
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
  The model and effort come from `~/.codex/config.toml`. `image_gen` is codex's built-in tool (the
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

## Games

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

- **`src/physics/` owns collision.** It is the only code that imports Rapier. Nothing else hand-rolls a collision test:
  no ray-vs-box maths, no terrain bisection, no push-out loops. Ask `src/physics/query.ts` (`castRay`,
  `castSegment`, `lineOfSight`, `sweepBall`, `floorBelow`). Code that isn't handed the world gets it from
  `activePhysics()`. `heightAt()` stays for placement and drawing only.
- **A new static thing collides by registering.** The builder emits `colliderDescs(): ColliderDesc[]` beside the
  geometry it draws:
  - box / capsule / ball / hull;
  - `treads` for any stair: rise ≤ 0.35 m and tread depth ≥ 0.36 m, or the capsule rides the edges;
  - trimesh only for walk-inside shapes.
  Then register it with `registry.add({ id, name, category, file, object, colliders, surface, floor?, solidFloor,
  model? })` (src/world/registry.ts). A moving piece `follows` its Object3D, which puts it on a kinematic body. `model`
  puts it in Explore's catalog: it is the one registry, so never register a built thing a second time for Explore.
  Don't push into `player.colliders`: that list is the legacy bridge for boxes that move (interactables, NPCs, dev
  scenes).
- **The player walks on colliders.** Step 0.35 m, max climb 40° (the user's picks). A walkable surface needs real
  geometry. A path over a crag is graded into the terrain (`TerrainSpec.graded`, never inside the Blender cove's
  baked area); a steep one gets a walkway from `src/physics/paths.ts`. After changing a builder's colliders, re-run
  `node scripts/physics-baseline.mjs --no-build --mode=walk` (and `--trails`): 0 stuck is the bar. If structures
  moved, re-bake the navmesh (`node --experimental-transform-types --import ./scripts/bake-loader.mjs
  scripts/bake-navmesh.mjs`; `--check` tells you when it's stale).
- **Moving things** go in Game's fixed step (`game.onFixed('pre' | 'step' | 'post')`, 60 Hz, hit-stop slows it) and
  are interpolated with `game.alpha`. Dynamic bodies go through `src/physics/bodies.ts`, which enforces the per-tier
  caps (phone 40 awake / 2 ragdolls).

## Deploy

- **Continuous deployment: every push to `main` deploys.** `.github/workflows/deploy.yml`
  runs typecheck → oxlint → css check → vite build and, if all green, ships the commit to
  production (project `wildshard-singleplayer`, live at
  https://wildshard-singleplayer.vercel.app) — about a minute push-to-live. A red gate means
  no deploy and the run is red on GitHub; that is your red to fix, now.
- After every push: `gh run watch $(gh run list --limit 1 --json databaseId -q '.[0].databaseId')
  --exit-status`, then confirm `https://wildshard-singleplayer.vercel.app/version.json` reports
  your HEAD's short SHA. Put that build id in the ask's file.
- Don't `vercel deploy` by hand while CI is healthy; `gh workflow run deploy` re-ships HEAD.
  The deploy uses a project-scoped Vercel token held in the repo's Actions secrets, so any
  collaborator's push deploys — nobody needs a Vercel login.
- Deploy frequently still applies: small commits, pushed as they land. Don't batch up a day
  of work before shipping it.
