# SHARD-PLATFORM lanes: the common brief (≤ 2 KB, G511)

AGENTS.md and docs/process/ hold the rest.

**The 5-rule card (G670; pasted into every task brief):**
1. No mirror or `serve-build --rev` probes of unlanded commits; previews are of HEAD or a landed main SHA only.
2. `.git/quiet` only through the official Simulator reading script; never for Chromium samples or profiles.
3. Land each slice on `tsc -b` of the layers you touched + scoped typed lint + `vitest related`; no fresh root (G708).
4. No new Debug rows (G669); unfinished work goes behind Developer.
5. A red you caused: fix it forward within 30 minutes; no reverts (G674).

- **One plan per lane, end to end (G709):** work your plan's rows in order; nothing is slotted in mid-plan except a
  red that blocks you. Split each L/XL row into ≤ 1 h slices with a status cell (done / in flight / waits-Jake /
  waits-Opus) in its plan, in the first code commit of that row (G711).
- **Big moves (G704):** ≤ ~20 hand-touched files a commit, typed lint first, one big move at a time.
- **Producer before reader:** a new generated input lands with (or before) its first reader, never after.
- **Shared plumbing (G746):** SDK/build/generator commits run every affected behaviour test group locally first.
- **Small commits:** land each green cut now; claims and progress go in the code commit's message, never a separate
  docs/record commit; no receipts (G506/G708).
- **Messages (G708):** herdr only for a red that blocks you (`scripts/herdr-prompt.sh <owner>`); no 'released'
  pings. Never wildshard-v or the question tool.
- **No polling (E491):** 10 min exec yield, longer via `scripts/proof-run.sh`; no status-poll loops.
- **Commits (GIT.md):** scripts/commit.sh, literal paths, --patch for shared files; never stash/reset/restore
  others' files; Conventional subject ≤ 50, body at 72, `Assisted-by: Codex:<model>`; never `git push`. Strict TS.
- **Machine:** one Simulator via `scripts/sim-lane.sh`; 4 muted browsers via `scripts/browser-lane.sh`; scratch `./tmp`.
