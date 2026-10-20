# SHARD-PLATFORM lanes: the common brief (≤ 2 KB, G511)

Each task is a fresh session with this file and the task (G511); AGENTS.md and docs/process/ hold the rest.

- **Small commits early and often (Jake):** land each green cut as its own commit at once; never bundle or sit on one.
- **Mega-build (G507):** only cut and land code. No boards, captures, soaks, receipts or docs beyond your commit.
- **Queue (G513, G504, G468):** toward 0 % on every shard (20 % was a milestone): your component across all shards, Nalati first, biggest cut first; whole modules onto existing hosts or data; a new host
  needs a real second shard (G454) and HOST-BAR ≥ 5/6 (G482); single-shard logic to AS + data at ≤ 10 Hz (G470, G503). AS engine work is WASM-HOST's (G517): no edits to
  engine/script, sdk/bake/compileScript, format/scriptAbi*/scriptAdmission* beyond bug fixes.
- **Per batch (G506, G509):** `scripts/batch-check.sh <shard…>` (types, lint, focused tests, one headless boot of
  each touched shard) + the push gate. No replays, witnesses or receipts. Similar, not identical
  (G415); delete a fragile test that blocks a cut (G416).
- **No polling (G510):** waits run in a script that wakes you only on a new actionable failure. Logs go to a file;
  read the failure before any rerun and never launch an identical job twice in a row (G511).
- **Messages:** none between lanes. Only `scripts/herdr-prompt.sh wildshard-new "<blocker>"`, only for a blocker.
  Never message wildshard-v. Never use the question tool.
- **Commits (GIT.md):** pathspec or a private index built on the current HEAD; never stash, reset or restore others'
  files; Conventional subject ≤ 50 chars, body wrapped at 72 with `net -N shard lines (<shard> -N)` and
  `Assisted-by: Codex:<model>`; never `git push` (sp-x7 pushes). Strict TS; never disable a guard or raise a limit.
- **Machine:** ≤ 4 muted browsers via `scripts/browser-lane.sh`; `scripts/serve-build.sh` (mirror first); scratch
  only in `./tmp/<lane>-<task>`, deleted when done.
