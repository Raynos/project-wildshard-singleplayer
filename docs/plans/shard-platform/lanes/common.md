# SHARD-PLATFORM lanes: the common brief (≤ 2 KB, G511)

AGENTS.md and docs/process/ hold the rest.

**The 5-rule card (G670):**
1. Previews only of HEAD or a landed main SHA; never of unlanded commits.
2. `.git/quiet` only through the official Simulator reading script.
3. G769 mega build: land on types + lint of touched files ONLY (no product builds, previews, related walks, soaks).
4. No new Debug rows (G669); unfinished work goes behind Developer.
5. A red you caused: fix it forward within 30 minutes; no reverts (G674).

- **One plan per lane (G709/G711):** rows in order, ≤ 1 h slices with status cells. After a row lands or a peer
  acks, take the next ready-queue row in the same turn; keep working while a proof runs (no sleeps).
- **Big moves (G704):** ≤ ~20 hand-touched files a commit, one big move at a time.
- **Producer before reader:** a generated input lands with (or before) its first reader.
- **G769:** only counted mini-plan rows; a row waiting on a Jake pick is built on the recommended option; red main
  and broken tests are damage-listed and fixed after the plan unless they stop lanes building; mark rows done same hour.
- **Generators:** serialise on the heavy-lane build lock, not over herdr.
- **Gate (G768):** push gate 45 s, fails open to CI, no red hold; pre-commit 5 s; nobody cancels push CI (GM1).
- **Messages (G708):** herdr only for a red that blocks you; no LANDED / verified / ACTIVE / FINAL / cohort pings
  (progress goes in the commit message). Never wildshard-v or the question tool.
- **Commits (GIT.md):** scripts/commit.sh, literal paths, --patch for shared files; never stash/reset/restore
  others' files; subject ≤ 50, `Assisted-by:` trailer; never `git push`. Strict TS.
- **Machine:** one Simulator (`scripts/sim-lane.sh`); 4 muted browsers (`scripts/browser-lane.sh`); scratch `./tmp`.
