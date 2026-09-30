# GAME-NORMALIZATION v2 · the council's findings register

One row per finding, across every round (decision 92). The ID stays the same forever. Statuses:
- **fixed**: the commit that fixed it;
- **rejected**: the reason, with evidence;
- **settled**: it re-argues the ledger (a decision in [E357](../../../tasks/asks/E357.md) or a resolution in
  [13](../13-lead-resolutions.md)) without new evidence;
- **escalated**: it went to Jake as a decision.

**Rules for reviewers** (in every round's brief):
1. **Don't re-raise a closed row** (fixed / rejected / settled) unless you bring new evidence: a file:line, a quote, or
   a fix that broke something. A repeat without new evidence is closed as `settled` on sight.
2. **The bar:** would an executing agent fail, do the wrong thing, or have to guess? A finding needs a location, the
   evidence and a concrete fix. Wording, style and "I would design it differently" are **nits**, and nits never block.
3. **After round 1**, review only:
   - (a) the diff since the last round (did each fix land, and did it break anything nearby);
   - (b) the battery ([battery.md](battery.md)).
   A finding outside the diff counts only if it's must-fix and carries evidence.

**Convergence** (decision 93):
- Accepted must-fix plus should-fix must fall strictly each round. If they don't, the loop stops and the open rows go
  to Jake.
- The loop has 4 rounds at most. Two clean rounds in a row make the plan `ready`.

| ID | Round | Seat | Severity | Location | Finding (one line) | Status | Resolution / commit |
|---|---|---|---|---|---|---|---|

## Round summary

| Round | Seats | New must | New should | Accepted must+should | Fixed | Rejected / settled | Battery pass | Clean? |
|---|---|---|---|---|---|---|---|---|
