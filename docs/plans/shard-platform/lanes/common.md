# SHARD-PLATFORM lanes: the common brief (≤ 2 KB, G511)

AGENTS.md and docs/process/ hold the rest.

**The 5-rule card (G670; pasted into every task brief):**
1. No mirror or `serve-build --rev` probes of unlanded commits; previews are of HEAD or a landed main SHA only.
2. `.git/quiet` only through the official Simulator reading script; never for Chromium samples or profiles.
3. Land each slice on types + scoped typed lint + `vitest related` in the working tree (G612).
4. No new Debug rows (G669): new work lands on, or behind Developer only if unfinished.
5. A red you caused: fix it within 30 minutes or revert it (G620); sp-x7 reverts at 30 minutes.

- **Small commits (Jake):** land each green cut now (G507).
- **Never idle:** task done = take the top open row of your type in `ready-queue.md` (claim it,
  tell wildshard-new); while a check runs, prepare your next cut.
- **Queue:** biggest cuts first onto existing hosts or data with a REAL second shipped shard; one-user code waits for
  Jake's HOST-AUDIT pick (G571/G667); state net lines.
- **Per slice:** card rule 3; the push gate, CI and exact-SHA boot smoke own the full gate.
- **No polling (E491):** Codex 10 min exec yield, longer runs via `scripts/proof-run.sh`; never rerun an identical job;
  no receipts (G506): numbers go in the commit message.
- **Messages:** only `scripts/herdr-prompt.sh wildshard-new "<blocker>"`; never wildshard-v or the question tool.
- **Commits (GIT.md):** scripts/commit.sh with literal paths; --patch for shared-file hunks; never stash, reset or restore others'
  files; Conventional subject ≤ 50 chars, body wrapped at 72 with `net -N shard lines (<shard> -N)` and
  `Assisted-by: Codex:<model>`; never `git push` (sp-x7 pushes). Strict TS; never disable a guard or raise a limit.
- **Simulator:** one at a time via `scripts/sim-lane.sh`; never wait on it.
- **Machine:** 4 muted browsers via `scripts/browser-lane.sh`; previews via `scripts/serve-build.sh`; scratch `./tmp`.
