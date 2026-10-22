# SHARD-PLATFORM lanes: the common brief (≤ 2 KB, G511)

AGENTS.md and docs/process/ hold the rest.

- **Small commits (Jake):** land each green cut now (G507).
- **Never idle:** task done = take the top open row of your type in `ready-queue.md` (claim it,
  tell wildshard-new); while a check runs, prepare your next cut.
- **Queue (G513, G518):** easy cuts toward 0 %, biggest first; whole modules onto existing hosts or data; a new or grown host
  needs a REAL second shard this wave, never a fixture, and HOST-BAR ≥ 5/6; state net lines; one-shard logic to AS + data (G470). G517: AS engine files
  (engine/script, compileScript, scriptAbi/scriptAdmission) only for bug fixes.
- **Per slice (G568, G612):** types, lint and focused tests must pass before landing each slice;
  no batch checks, exact-commit mirror checks or checks on unlanded commit objects. The push gate,
  CI and exact-SHA boot smoke own the full gate; first frames follow landing when needed.
- **No polling (G510, E491):** waits run in a script that wakes you only on a new actionable failure. Logs go to a file;
  read the failure first; never rerun an identical job (G511). Codex: a 10 min exec yield so a build or test returns
  in one call; longer runs go through `scripts/proof-run.sh` (it pings you); never `sleep`/`wait` in a loop. No new
  receipts under `.git/proofs` or `progress/` (G506): the numbers go in the commit message.
- **Messages:** only `scripts/herdr-prompt.sh wildshard-new "<blocker>"`; never wildshard-v or the question tool.
- **Commits (GIT.md):** scripts/commit.sh with literal paths; --patch for shared-file hunks; never stash, reset or restore others'
  files; Conventional subject ≤ 50 chars, body wrapped at 72 with `net -N shard lines (<shard> -N)` and
  `Assisted-by: Codex:<model>`; never `git push` (sp-x7 pushes). Strict TS; never disable a guard or raise a limit.
- **Simulator (G549):** only sp-o5 runs it; add a row to `sim-queue.md` and move on, never wait.
- **Machine:** 4 muted browsers via `scripts/browser-lane.sh`; `scripts/serve-build.sh`; scratch `./tmp`.
  `WILDSHARD_MIRROR_SLOT`: five pooled `check`…`check5` slots; `ruler` is reserved (G612).
