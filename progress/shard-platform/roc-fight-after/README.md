# Roc fight: AFTER check for the C4 shared-rows candidate (G393)

Candidate `591577b57` (sp-x8: the Storm Roc and flock on shared catalogue rows, clips and boss view; five
private Sky policy/home/encounter modules retired) against the baseline in
[`../roc-fight-baseline/`](../roc-fight-baseline/README.md) (`6e136f0b1`). Captured by the coordinator
(wildshard-new, on Opus) with the baseline's own recipe: `scripts/roc-fight/capture.mjs` on a served build of the
candidate, then `scripts/roc-fight/compare.mjs`.

**Verdict: PASS. The fight is unchanged.**

- **Headless (canonical tape):** every fact is identical. End 26,469, victory 26,349, crown 8,888, 17,461 fight
  ticks, 1 attempt, 14 hits / 172 damage, minimum HP 80, 3 stoops; phase 2 at tick 10,038 (HP 277.2) and phase 3
  at 17,234 (HP 138.6). Only the end-state hash differs, `146505ca` → `04dd4bf8`. That is the approved paired-fan
  role/module change (`0d915f548`, coordinator-approved under G394/G405), already in the candidate's parent; sp-x8
  showed the candidate's facts and hash are identical to that parent.
- **Page (served build):** every fact is identical: victory at frame 6,529, 15 hits / 182 damage, 2 stoops, the
  same frames for every phase change.
- **Look:** I read `sheets.jpg` (12 fixed frames BEFORE over AFTER). Every frame shows the same Roc pose, HP bar,
  fan, scenery and HUD. The only visible difference is the intro frame (f15): the "Storm Roc" title card reads
  slightly further into its fade in AFTER, which is the title's wall-clock fade, not the fight.
- `compare.mjs` exits 1 only because of the hash row; no fight fact moved, so no trace re-record is needed.

Files: `diff.md` / `diff.json` (the fact table and encounter beats), `sheets.jpg` (BEFORE over AFTER),
`after-facts.json`. The side-by-side clip (3.3 MB) stayed in scratch to keep the tree light.
