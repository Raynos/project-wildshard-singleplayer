# SHARD-PLATFORM lanes — the common brief (coordinator wildshard-new; G335)

Every SHARD-PLATFORM lane (5 Codex `sp-x*`, 5 Opus `sp-o*`) reads this, then its own row in `README.md`.
Kept in the repo because `/tmp` (scratchpads, old briefs) is wiped on a reboot.

## The goal (Jake, standing)

Finish SHARD-PLATFORM. Read the compacted plan `docs/plans/SHARD-PLATFORM.md` (40 KB: §0, measures, live rules, open-rows index) and `docs/plans/shard-platform/STATE.md`; open `decisions.md` (G-rows) and `rows.md` (full row text) only for what you need (route `design-system.md`; queue `open-x-queue.md`). At all moments
the game holds **60–120 fps on desktop/laptop and 30–60 fps on the iOS Simulator** (gates: desktop max ≤ 100 ms,
p95 ≤ 17.5 ms; Simulator max ≤ 200 ms, p95 ≤ 35 ms). Nothing you land may regress them.

## Mega-build: G507 + G506 (Jake, 2026-10-18) — read this first

Jake (G507): *"Only build only mega build fuck everything else"*. Like G345: every lane only cuts and lands code. No
boards, frame floor, Simulator, soak, parity captures, receipts, lane-to-lane messages, or docs beyond STATE.md (the
coordinator's) and your commit message.

Jake (G506): *"What the fuck is all that proof work? … I don't know why you're always doing so much fucking process porn."*

- A batch lands on **types + lint + focused tests of what it touched + ONE headless boot of each shard the batch
  touched, to its first frame + the push gate** (G509, Jake, amends G506: it catches startup throws before the bake).
  Boot it muted through `scripts/browser-lane.sh` on `scripts/serve-build.sh --rev <sha> --shard <slug>` (the shard's
  own startup check where one exists, e.g. `scripts/nalati-boot-check.mjs`, `scripts/test-nine-native-startup.mjs`).
  Nothing else per batch.
- **Not per batch:** exact replays (workerExact 1000/1200, replay counts), witnesses or re-recordings, old-save
  envelopes, all-ten source-product runs, Simulator or iPhone progression runs, proof receipts in `progress/` or
  `.git/proofs/`, receipt or ack relays between lanes over herdr.
- Similar, not identical (G415). A fragile test that blocks a cut is deleted (G416).
- Heavy proofs run only at a W3 milestone or before a grid deploy, once, by one lane.
- Commit bodies say what changed and the line count (`net -N shard lines (<shard> -N, ...)`), nothing more.
- Cuts are big (G468): the largest uncut mini-plan batch first; no sub-200 cuts while big ones remain.
- Landings are source-only (G490); never bake maps yourself. In an open map window the push gate's strict build refuses
  a stale baked map (SF66) for a shard whose inputs landed source-only: that refusal alone is expected until sp-x10
  seals the window, and your batch counts as done. Any other gate failure is yours.
- **No messages between lanes** (G506 follow-up, Jake): sp-x10 (bakes) and sp-x7 (push) read `git log` and
  `STATE.md` to see what landed. Nobody sends them SHAs or 'ready' notes, and they never reply 'confirmed'. A lane
  messages only wildshard-new, and only for a blocker. No landing reports: the coordinator reads `git log`.

## Rules (AGENTS.md and `docs/process/` win where they say more)

- **Never use the question tool** or wait on a prompt: decide, note the call in your commit body, keep going. A real fork for
  Jake goes to wildshard-new as one line with your recommendation.
- Don't run `~/.claude/set-label.sh`. Never herdr-message `wildshard-v` (the plan agent); only `wildshard-new`.
- **Herdr messages only via `scripts/herdr-prompt.sh <agent> "<msg>"`** (9a3b244cc; it refuses when a question is open). Use it only for a blocker, to wildshard-new; never to another lane.
  Reds you cause are yours to fix first. The Opus lanes `sp-o*` are the coordinator's subagents, not herdr panes (G337):
  message them as `scripts/herdr-prompt.sh wildshard-new "[for sp-oN] …"` and the coordinator relays.
- **Git (GIT.md):** small commits early and often; `git commit -m … -- <paths>` (pathspec), `git add` only new files;
  never stash / checkout / restore / reset / rm what you didn't author; never `git push` or `push-main.sh` (post-commit
  auto-pushes). Messages: Conventional subject ≤ 50 chars, body wrapped at 72, last line
  `Assisted-by: Codex:gpt-6.1-sol` (Codex lanes) or `Assisted-by: Claude Code:claude-opus-5-5` (Opus lanes).
- **Private-index commits must be built on the CURRENT HEAD.** `GIT_INDEX_FILE=x git read-tree HEAD` then commit
  immediately and verify the new commit's parent is the HEAD you read. If HEAD moved in between, your index silently
  reverts the newer landings (bb6291f57 reverted ae7304f04). Re-read the tree and retry rather than committing a stale index.
  **After a private-index commit, reset only the shared INDEX for your own paths; never write HEAD bytes over working-tree
  files you did not author** (sp-x8's uncommitted geometry.ts work was wiped that way, 2026-10-13).
  **After landing from an export, refresh your own stale shared copies:** for each path you committed whose
  shared working-tree bytes still equal its previous committed blob (`git hash-object` found by
  `git log --find-object`), write the `HEAD` bytes; leave anything else alone (49 stale copies, incl.
  `.githooks/pre-commit`, were found and reset on 2026-10-13).
  **Generated files are made by pre-commit (G367):** a private-index helper must run pre-commit FIRST and `git write-tree`
  AFTER it, so the regenerated outputs are in the commit; the push regenerates nothing.
- **Silent-revert guard (`afad1ea04`):** both commit hooks refuse a commit that puts a path back to bytes/modes from an
  ancestor of HEAD (including deleting a newer file). A DELIBERATE rollback or a recapture that legitimately restores older
  bytes must set `WS_COMMIT_INTENT='{"base":"<full current parent SHA>","paths":["<every staged path>"]}'`; it is admitted
  only if the parent is unchanged and every staged path is listed. Recompute it on every CAS retry.
- **`scripts/generation-jobs.json` has many writers.** Never commit or build the working-tree copy wholesale: start from
  `git show HEAD:scripts/generation-jobs.json`, apply only your own job's entries, commit via a private index (a draft
  that carried stale hunks dropped Signal's commons roots and ring pin, 2026-10-13).
- **A shared file can be a physics input of several shards** (`scripts/*-physics-inputs.mjs`): changing it needs every
  affected shard's official recapture, which sp-x10 makes in its next map bake (G490); land source-only.
- **Moving code is not a cut.** Code (TS, GLSL strings, shader bodies) moved into `data/`/`generators/` or a one-user
  engine/game/SDK module still counts (G294, G306); only real rows/data, baked outputs or ≥ 2-user modules reduce custom %.
- **Strict TS:** no `any`, `!`, `@ts-ignore`, `as unknown as`, blanket disables. Fix the type, never the gate. Never
  disable a lint guard. No `?foo=` URL switches (Debug rows only, DEBUG-TOGGLES.md). Never edit frozen `*-legacy` folders.
- **Debt counts are shrink-only (Jake, G349).** No standing approvals and no coordinator sweeper. A generated rise
  (shard-engine-imports, shard-game-imports, shard-game-plugins, generator-imports, sdk-no-facade, shards → engine/game
  graph edges) is refused: restructure so it doesn't rise. If a rise is truly unavoidable, stop and tell wildshard-new;
  it needs a plan row naming the deletion that pays it back, approved by Jake, never by the coordinator.
- **Log every call (Jake, G352).** Each trade-off you decide alone goes in your commit body as `CALL: …`; the coordinator
  reads `git log` and lists it in STATE.md. Anything touching an approved G-row asks first.
- **Machine (MACHINE.md):** ≤ 4 game browsers machine-wide via `scripts/browser-lane.sh`; mute them; capture as
  "iPhone 16 Pro" unless your row says desktop. No vite dev servers (`scripts/serve-build.sh` from your own scratch dir).
  **Proofs are fast by default** (MACHINE.md): `serve-build.sh --head` reuses every unchanged shard's product by content
  key; add `--shard <slug>` for a one-shard capture; `node scripts/build-mirror.mjs run HEAD -- pnpm build:proof` for a
  build without a server. Never `--full` or a plain `pnpm build` for a proof: the push gate does the full build.
  One Simulator via `scripts/sim-lane.sh`. Opus subagents share one session id: start previews as
  `SERVE_OWNER=<lane> scripts/serve-build.sh …`, or another lane's cleanup evicts them (sp-o100, 2026-10-13). Full suite / app build only through `python3 scripts/heavy-lane.py`; lanes run
  focused tests, never the full suite. Keep vitest light (`WS_VITEST_MAX_WORKERS=4`).
- **Quiet windows:** while `.git/quiet` exists and isn't yours: read and edit only (no vitest, tsc, lint, builds, bakes,
  browsers, Simulator). Owners take it, wait for the active push, measure, release, then leave a 2-minute gap.
- **Scratch:** your own folder `/private/tmp/sp-lanes/<lane>/`; clean it as you go; what you keep goes in the repo
  (`progress/` images ≤ 500 KB JPEG/WebP).
- **Status:** only the coordinator writes `STATE.md`, `red-green.md`, `open-x-queue.md`. Plan rows/decisions: send the
  text to wildshard-new unless your row says you own that row's line.
- **Pacing:** Codex weekly budget is low (18 % on 10-12, resets 10-18): Codex lanes stay on non-graphical engineering and
  avoid speculative reruns. Graphical work (rendering, looks, meshes, captures, art) is Opus-only.
