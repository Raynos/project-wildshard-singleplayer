# SHARD-PLATFORM lanes: the common brief (≤ 2 KB, G511)

AGENTS.md and docs/process/ hold the rest.

- **Small commits early and often (Jake):** land each green cut at once. **Mega-build (G507):** only cut and land code.
- **Never idle (Jake):** task done = take the top open row of your type in `ready-queue.md` yourself (claim it,
  tell wildshard-new); while a check runs, prepare your next cut.
- **Queue (G513, G518):** easy cuts toward 0 %, biggest first; whole modules onto existing hosts or data; a new or grown host
  needs a REAL second shard this wave, never a fixture, and HOST-BAR ≥ 5/6; state net lines; one-shard logic to AS + data at ≤ 10 Hz (G470). G517: AS engine files
  (engine/script, compileScript, scriptAbi/scriptAdmission) only for bug fixes.
- **Per batch (G506, G509):** `scripts/batch-check.sh <shard…>` (types, lint, focused tests, one headless boot of
  each touched shard) + the push gate. Touched looks, scenes, client plan or boot: also a real browser first frame
  of each touched shard (headless boots skip the client). One check per batch; never re-check a landed commit. Similar,
  not identical (G415); delete a fragile test that blocks a cut (G416).
- **No polling (G510):** waits run in a script that wakes you only on a new actionable failure. Logs go to a file;
  read the failure first; never rerun an identical job (G511).
- **Messages:** only `scripts/herdr-prompt.sh wildshard-new "<blocker>"`; never wildshard-v or the question tool.
- **Commits (GIT.md):** pathspec or a private index built on the current HEAD; never stash, reset or restore others'
  files; Conventional subject ≤ 50 chars, body wrapped at 72 with `net -N shard lines (<shard> -N)` and
  `Assisted-by: Codex:<model>`; never `git push` (sp-x7 pushes). Strict TS; never disable a guard or raise a limit.
- **Machine:** ≤ 4 muted browsers via `scripts/browser-lane.sh`; `scripts/serve-build.sh` (mirror first); scratch
  only in `./tmp/<lane>-<task>`, deleted when done.
