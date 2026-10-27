# SHARD-PLATFORM lanes: the common brief (≤ 2 KB, G511)

AGENTS.md and docs/process/ hold the rest.

**The 5-rule card (G670):**
1. Previews only of HEAD or a landed main SHA; never of unlanded commits.
2. `.git/quiet` only through the official Simulator reading script.
3. Land each slice on `tsc -b` of touched layers + scoped typed lint + ONE `vitest related` walk (G708).
4. No new Debug rows (G669); unfinished work goes behind Developer.
5. A red you caused: fix it forward within 30 minutes; no reverts (G674).

- **One plan per lane (G709/G711):** rows in order, ≤ 1 h slices with status cells. After a row lands or a peer
  acks, take the next ready-queue row in the same turn; keep working while a proof runs (no sleeps).
- **Big moves (G704):** ≤ ~20 hand-touched files a commit, one big move at a time.
- **Producer before reader:** a generated input lands with (or before) its first reader.
- **Shared plumbing (G746):** a commit touching src/sdk/** or a shared bake/build file runs `tsc -b` and builds
  every shard locally first. Every test input is tracked (`git ls-files`), never an untracked file.
- **Previews (Opus):** reuse a running shared preview that contains your commit; one per 2-3 commits.
- **Generators:** serialise on the heavy-lane build lock, not over herdr.
- **Green main (GM1, G757-G759):** nobody cancels push CI; while main is red only `Red-fix:` commits push; a flaky
  test is quarantined (owner, 24 h fix), never deleted; a gate at its cap splits the batch, defers only that step.
- **Messages (G708):** herdr only for a red that blocks you; no LANDED / verified / ACTIVE / FINAL / cohort pings
  (progress goes in the commit message). Never wildshard-v or the question tool.
- **Commits (GIT.md):** scripts/commit.sh, literal paths, --patch for shared files; never stash/reset/restore
  others' files; subject ≤ 50, `Assisted-by:` trailer; never `git push`. Strict TS.
- **Machine:** one Simulator (`scripts/sim-lane.sh`); 4 muted browsers (`scripts/browser-lane.sh`); scratch `./tmp`.
