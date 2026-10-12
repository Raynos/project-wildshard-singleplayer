# SHARD-PLATFORM lanes — the common brief (coordinator wildshard-new; G335)

Every SHARD-PLATFORM lane (5 Codex `sp-x*`, 5 Opus `sp-o*`) reads this, then its own row in `README.md`.
Kept in the repo because `/tmp` (scratchpads, old briefs) is wiped on a reboot.

## The goal (Jake, standing)

Finish SHARD-PLATFORM (`docs/plans/SHARD-PLATFORM.md`; route `design-system.md`; queue `open-x-queue.md`). At all moments
the game holds **60–120 fps on desktop/laptop and 30–60 fps on the iOS Simulator** (gates: desktop max ≤ 100 ms,
p95 ≤ 17.5 ms; Simulator max ≤ 200 ms, p95 ≤ 35 ms). Nothing you land may regress them.

## Rules (AGENTS.md and `docs/process/` win where they say more)

- **Never use the question tool** or wait on a prompt: decide, note the call in your report, keep going. A real fork for
  Jake goes to wildshard-new as one line with your recommendation.
- Don't run `~/.claude/set-label.sh`. Never herdr-message `wildshard-v` (the plan agent); only `wildshard-new`.
- **Herdr messages only via `scripts/herdr-prompt.sh <agent> "<msg>"`** (9a3b244cc; it refuses when a question is open). **Report** each landing in ≤ 10 lines: `scripts/herdr-prompt.sh wildshard-new "[from <lane>] LANDED <sha>: <what>; next: <what>"`.
  Reds you cause are yours to fix first. The Opus lanes `sp-o*` are the coordinator's subagents, not herdr panes (G337):
  message them as `scripts/herdr-prompt.sh wildshard-new "[for sp-oN] …"` and the coordinator relays.
- **Git (GIT.md):** small commits early and often; `git commit -m … -- <paths>` (pathspec), `git add` only new files;
  never stash / checkout / restore / reset / rm what you didn't author; never `git push` or `push-main.sh` (post-commit
  auto-pushes). Messages: Conventional subject ≤ 50 chars, body wrapped at 72, last line
  `Assisted-by: Codex:gpt-6.1-sol` (Codex lanes) or `Assisted-by: Claude Code:claude-opus-5-5` (Opus lanes).
- **Private-index commits must be built on the CURRENT HEAD.** `GIT_INDEX_FILE=x git read-tree HEAD` then commit
  immediately and verify the new commit's parent is the HEAD you read. If HEAD moved in between, your index silently
  reverts the newer landings (bb6291f57 reverted ae7304f04). Re-read the tree and retry rather than committing a stale index.
- **Strict TS:** no `any`, `!`, `@ts-ignore`, `as unknown as`, blanket disables. Fix the type, never the gate. Never
  disable a lint guard. No `?foo=` URL switches (Debug rows only, DEBUG-TOGGLES.md). Never edit frozen `*-legacy` folders.
- **Debt-row approvals:** a push refused for a generated rise under `src/shards/` (shard-engine-imports,
  shard-game-imports, shard-game-plugins, generator-imports, shard-services, shard-sandbox, public-index) → write the rows
  as a JSON list `[{"kind":"debt","key":"wildshard/…","file":"src/shards/…","before":n,"after":m}]` to
  `.git/approval-requests/<lane>-<n>.json`; the coordinator's sweeper merges them within 2 min (rejects land in
  `.git/approval-requests/rejected/` with a `.why`). Anything else (graph rows, non-shard files): ask wildshard-new.
- **Machine (MACHINE.md):** ≤ 4 game browsers machine-wide via `scripts/browser-lane.sh`; mute them; capture as
  "iPhone 16 Pro" unless your row says desktop. No vite dev servers (`scripts/serve-build.sh` from your own scratch dir).
  One Simulator via `scripts/sim-lane.sh`. Full suite / app build only through `python3 scripts/heavy-lane.py`; lanes run
  focused tests, never the full suite. Keep vitest light (`WS_VITEST_MAX_WORKERS=4`).
- **Quiet windows:** while `.git/quiet` exists and isn't yours: read and edit only (no vitest, tsc, lint, builds, bakes,
  browsers, Simulator). Owners take it, wait for the active push, measure, release, then leave a 2-minute gap.
- **Scratch:** your own folder `/private/tmp/sp-lanes/<lane>/`; clean it as you go; what you keep goes in the repo
  (`progress/` images ≤ 500 KB JPEG/WebP).
- **Status:** only the coordinator writes `STATE.md`, `red-green.md`, `open-x-queue.md`. Plan rows/decisions: send the
  text to wildshard-new unless your row says you own that row's line.
- **Pacing:** Codex weekly budget is low (18 % on 10-12, resets 10-18): Codex lanes stay on non-graphical engineering and
  avoid speculative reruns. Graphical work (rendering, looks, meshes, captures, art) is Opus-only.
