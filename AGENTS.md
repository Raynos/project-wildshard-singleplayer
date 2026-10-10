# AGENTS.md

The rules for every agent in this repo, one or two lines each. The why, the incidents and the how-tos live in
`docs/process/`: read the linked file before you work in its area. Jake's own words outrank anything here.

## Jake: how he plays, steers and judges → [docs/process/JAKE.md](docs/process/JAKE.md)

- He plays on an **iPhone 17 Pro as a portrait Safari home-screen PWA**. Every screenshot you send him is iPhone
  portrait. Low Power Mode caps it at 30 fps; the phone throttles ~2× within minutes.
- **He does no phone chores and no A/B toggling.** Don't file "Jake checks on his iPhone" items; his playtests and
  FEEDBACK notes are the check. Give a verdict and wrap.
- **He steers by the plans** in `docs/plans/`. Lead with their true state; when something needs him, give one
  recommended answer. "Implement X" in a plan session means update the plan.
- **Taste is his call**: a stylistic change keeps the old look as a Debug variant and goes to him as a variant sheet.
  Each shard keeps its own style (Driftwood low-poly toon, Nalati painterly, Pine Hollow photoreal PBR).
- **Fun levels, not dioramas; no screenshot cheats.** Everything playable is real 3D that survives a walk-around.
- **Render scale stays 2× on the phone** (no dynamic resolution). Memory limits: **1.8 GB loading, 1.0 GB Explorer**;
  a `gpuMB` ceiling is a ratchet, not the limit, and nothing trips below 500 MB.
- **North and South America only: never raise a territory licence caveat.** Hunyuan3D is as allowed as TRELLIS.2.
  Only non-commercial / research-only terms matter, and only for shipped assets (fine for mockups).

## Asks, plans, leftovers, handoffs → [docs/process/ASKS.md](docs/process/ASKS.md)

- **An ask is a receipt of a request for work from Jake.** `f=$(scripts/ask-new.sh "<his words>")` before you start,
  and use the id it prints. A question answered in chat gets no file.
- **Status vocabulary:** `open` · `in flight (date, owner)` · `needs pick (date)` · `done` · `dropped` ·
  `folded into <X>` · `superseded by <X>`. A claim lapses after **71 h** without a commit. `scripts/asks.mjs` checks
  it in pre-commit and prints it in the session brief.
- **Picks go to Jake with the question tool** (AskUserQuestion with context and one recommendation; boards / images
  sent right above it), never as a decision page. A skipped pick stays `needs pick` and is asked again next session;
  it never expires (Jake, E423 grill).
- **Done = pushed to `origin/main` with the local gates green** (E428): no wait for the CI run or the deploy. Add the
  live build id when the deploy ships it.
- **Plans are the one queue.** Follow-up work is a plan row, never another ask. **A leftover is built in the session
  that found it, or it stays an open row of its live plan.** Never file a plan's tail as asks.
- **Status lives in one small State file per plan** (`docs/plans/<plan>/STATE.md`, ≤ 3 KB), written only by that plan's
  coordinator; the plan file holds decisions and rows; no `Plan-State` trailer check (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`). A plan archives (to `project/archive/<date>-<name>.md`) in the same commit it finishes, with no row open.
- **No per-lane handoff files** (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`): lanes report landings over herdr; the coordinator's STATE.md is the restart record.
- **Agent-to-agent requests** go over herdr to the owner (who replies with the SHA), else into the owner's plan.
- **Pages for Jake to read** get `docs/reviews/<slug>.md` in the commit that links them; only Jake's words mark one read.
- **Council rounds** ([docs/process/COUNCIL.md](docs/process/COUNCIL.md)): three fresh seats a round, four rounds at
  most; the round files are archived the day the council ends.

## Engine layers → [docs/ENGINE.md](docs/ENGINE.md), [docs/SHARDS.md](docs/SHARDS.md)

- Layers: `src/engine/` (`@wildshard/engine`) → `src/game/` (`@wildshard/game`) → `src/sdk/` (`@wildshard/sdk`) →
  (`src/commons/`, `@wildshard/commons`: build-time packs) → `src/shards/<slug>/`. Imports point down only; a shard never
  imports another shard. SF54 dissolved `@wildshard/kit`: shared content lives in the game, runtime facades in the SDK.
- **No barrels (E434).** The layers are pnpm workspace packages (E432) with no index file: each `package.json`'s
  `exports` lists its public modules, and an import names the module that defines the binding
  (`@wildshard/engine/physics/query`). `wildshard/no-reexport` refuses `export … from` of our own modules. A clean export
  of the tree links `node_modules` with `scripts/link-node-modules.mjs`, never a whole-folder symlink.
- **No module installs a service by being imported** (E434): an installer is a function the session or the setup calls
  (`installWorldRegistry()`). A declaration merge that other layers read lives in a `*.merge.d.ts` file the layer
  projects include (`src/game/equipmentTypes.merge.d.ts`, `src/game/icons.merge.d.ts`).
- **What each layer knows** (E405): the engine knows rendering, physics, input, audio, boot and levels in general, never
  the game, Wildshard, shards or any content (content arrives as data). The game knows it is Wildshard and that shards
  run arbitrary content, never a particular shard, and holds the content two or more shards share. Shards build against
  the SDK (`runtime/` files through its trusted runtime facades). Everything particular to one shard lives in its folder.
- **The guards** (`lint/wildshard-plugin.js`, ENGINE.md §24): `layer`, `public-index`, `engine-words`, `shard-names`,
  `shard-sandbox`, `no-level-identity`, `no-shard-branch`, the `no-raw-*` rules, the ratchet (`lint/ratchet.json`), the
  layout check and the pre-commit runner. Never disable one; fix the code.
- ENGINE.md is the public API: document new APIs in source and its manual sections. Builders commit source only;
  the API tables and export index are build outputs of `pnpm gen` (gitignored, SF74 W13); the pusher regenerates
  graph counts and debt from clean HEAD (SF6b; GIT.md). A new shard starts from `src/shards/_template/` per SHARDS.md.
- **The E357 lock** is lifted (GAME-NORMALIZATION archived 2026-10-01; `.github/lock.json` `"locked": false`).

## Version control → [docs/process/GIT.md](docs/process/GIT.md)

- ~10 agents share **one working tree, one index and one `main`**. Never stash, checkout, restore or rm what you didn't
  author; kill only your own processes, by PID.
- **Commit with a pathspec** (`git commit -m "…" -- <paths>`; `git add` only new files). A file with someone else's
  uncommitted hunk: wait, or commit your hunks through a private index.
- **Pushes are automatic** (SF74): post-commit starts `scripts/auto-push.sh`, which runs `scripts/push-main.sh` for
  you; never `git push`. The pre-push gate builds what Vercel builds; a red gate pings your lane and is yours to fix.
- **Strict means strict**: no `any`, no `!`, no `@ts-ignore`, no `as unknown as`, no blanket `oxlint-disable`. Fix the
  type, never the gate.
- Never open a shared file for writing before you've read it. No tree-wide destructive git. `progress/` images ≤ 500 KB
  (JPEG / WebP); never commit a `.blend`.
- Feature worktrees never push; the main checkout lands them.

## The shared Mac → [docs/process/MACHINE.md](docs/process/MACHINE.md)

- **At most 4 game browsers machine-wide**: every Playwright script through `scripts/browser-lane.sh`, every new
  agent-browser session after `scripts/browser-lane.sh wait`; close it before you report. Mute every test browser;
  capture as "iPhone 16 Pro".
- **No vite dev servers**: `scripts/serve-build.sh`, started from your scratchpad. **One iOS Simulator**, through
  `scripts/sim-lane.sh`. **One local model at a time**, under the model lock.
- **One full suite and one app build machine-wide**: use `python3 scripts/heavy-lane.py full-test|build -- <command>`; the push gate has queue priority, focused tests are unrestricted. Lanes never run the full suite: `full-test` refuses outside CI without `WS_FULL_SUITE=1` (SF74 W1).
- **Clean your scratchpad**: delete throwaways as soon as you have the result; never rename aside. What you keep goes in
  the repo.

## Subagents → [docs/process/SUBAGENTS.md](docs/process/SUBAGENTS.md)

- The main agent builds by default. **At most 3 live subagents, no forks**, one job each, capped at **400k context,
  90 min, ~200 turns**; reports ≤ 40 lines. Never recycle a finished one. Long waits belong to the main agent.
- Every brief says: don't run `set-label.sh`, mute browsers, capture as the phone, follow GIT.md.
- **Heavy proofs run per milestone, not per slice** (Jake, 2026-10-09, after the process audit `progress/process/audit-2026-10-09/`): the soak, frame floor, boot smoke and Simulator runs at each
  milestone and before a deploy that changes the grid; the physics walk only after collider changes; slices land on quick
  checks of what they touched. The gpu-gate parity CI runs nightly and at milestones, not on every push.
- **At most 3 agents per session** (Jake, 2026-10-10: *"What we write down and commit in AGENTS.md is 3 agents"*).
- **No Codex workers** (Jake, 2026-10-10): don't start Codex panes or hand build work to Codex. Only a plan Jake granted
  it in his own words may (SHARD-PLATFORM, GAME-NORMALIZATION), and those rules live in that plan. `codex exec` for
  mockup images ([MOCKUPS.md](docs/process/MOCKUPS.md)) and a council's Codex seat ([COUNCIL.md](docs/process/COUNCIL.md)) are not workers.

## Variants: no URL switches, ever → [docs/process/DEBUG-TOGGLES.md](docs/process/DEBUG-TOGGLES.md)

- **Every variant, look, tuning value or toggle goes in pause ▸ Settings ▸ Debug**: a shard's own `ctx.debugRow`, or
  an engine-wide registry row. Never a `?foo=` param; `wildshard/no-url-switch` and `lint/url-params.json` enforce it.
- **As few Debug rows as humanly possible** (E451): a row is a short-lived feature flag or an A / B / C (not only
  on / off) for Jake to compare in-game; it goes, with all its dead code, the moment he picks.
- When Jake picks a winner, delete the row, the option and the losing code in one commit.
- **Developer is the unfinished-work switch** (E451). One site, one deployment: Developer **off** is the public / staging
  build (only what's nearly ready to share with friends and family); Developer **on** is Jake's view of everything
  unfinished he's still steering. New, unfinished work goes behind Developer, never straight to the public build.

## Local models and assets → [docs/process/LOCAL-MODELS.md](docs/process/LOCAL-MODELS.md)

- Music is **MiniMax Music 3**; every SFX is generated with **MOSS-SoundEffect v2** and **Stable Audio 3 Medium** and
  the better take ships; 3D is **TRELLIS.2** or **Hunyuan3D-2**, whichever is better. Credits are licence conditions.
- Weights live only in `~/projects/weights` (`bin/fetch-repo.sh`); how to run each model is in `~/projects/localai`.
  Newest models first.
- **Blender: the script is the source, the GLB is committed, a `.blend` never is** (`scripts/blender/build.sh`).
- A shard's generated assets go in its own folders (`public/assets/<slug>/`, `music/<slug>/`, `sfx/<slug>/`).

## Mockups and boards → [docs/process/MOCKUPS.md](docs/process/MOCKUPS.md)

- Two engines: **Qwen-Image-2.1 turbo** locally for fast iteration (`scripts/mockup-local.sh`), **codex `image_gen`**
  for fidelity. Start from a live capture; quote every UI string; read every image before you send it.
- Every mockup lives in `art/<subject>/round-<n>-<label>/`, committed as JPEG.
- **Every pick is one labelled A / B / C board**, iPhone portrait; **every image Jake sees has burned-in labels** saying what each panel is (a file name is not enough). Motion is a video. Mockups are for UI and art
  direction, never for rendering or perf bugs (show the real game instead).
- A plan with prototypes gets one read-only review page.

## HUD changes are coordinated over herdr (E332)

- One HUD is shared by every shard: `src/engine/player/TouchControls.ts`, `src/engine/ui/` (HUD, hudSlots,
  WeaponStrip, RideHUD, FirstHints, Minimap, Map) and `src/engine/ui/styles/` (touch, game, ride).
- **Before** you change what a HUD control is, where it sits or when it shows: `herdr agent list`, then
  `herdr agent prompt <name> "[from <you>] HUD change: <what, files, ask id>"`. **After** it lands, send the SHA.
- A HUD change that isn't a bug fix needs Jake's pick first. New shards use the baseline HUD with no custom elements.
- The current layout is E319: the left edge is HORSE · HOVER · SWAP ring; VITALS hide at full health; LOCK shows only
  with a target.

## Rendering and physics → [docs/process/RENDERING.md](docs/process/RENDERING.md)

- **No facade multi-draw anywhere**, on any shard, tier or platform (E271 / E272): it killed the iPhone. Use
  instancing; keep `scripts/test-facade-instancing.mjs` passing.
- A risky rendering or memory change ships **default-off behind a Debug row** until a physical-device reading backs it.
- **`src/engine/physics/` owns collision** (the only Rapier import). Ask its queries; a static thing collides by
  registering colliders (`ctx.piece` / `app.registry.add`); moving things run in the fixed step. After changing
  colliders, `node scripts/physics-baseline.mjs --no-build --mode=walk` must report 0 stuck.

## Deploy → [docs/process/DEPLOY.md](docs/process/DEPLOY.md)

- Production ships the **newest CI-green `main` with an exact-SHA green boot smoke** hourly (`.github/deploy-pin.json`), with a launchd backstop.
  `gh workflow run deploy` for an immediate release. Never `vercel deploy` by hand while CI is healthy.
- After a push you are done: the local gates are the check. **Don't wait for the CI run or the deploy** (Jake, E428); CI and the hourly deploy run on their own, and a red run someone sees gets fixed then.
