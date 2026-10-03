# Council brief: does each new shard match the other four?

You are one seat of a clean-room council (`docs/process/COUNCIL.md`). Read `ledger.md` (frozen), `battery.md` (walk
every scenario) and `register.md` (closed rows are not re-raised without new evidence) in this folder. You never see the
conversation that built the shards.

**The review surface**
- The two new shards: Signal Dunes (`src/shards/sunscar-dunes/`) and Sky Reach (`src/shards/far-reach/`).
- The comparison: `progress/<slug>/<latest stamp>/` for all six shards. Every shard is captured by the same tool
  (`scripts/shard-progress.mjs`), the same phone (iPhone portrait 390×844 @3, phone tier, touch HUD) and the same kinds of
  view: `first-frame`, four first-person hero views `h1`–`h4`, `aerial-spawn`, `aerial-overview`, and a 10 s orbit
  `clip.mp4`. Side-by-side sheets: `art/shard-polish-council/round-<n>/compare-*.jpg`.
- Supporting: each new shard's plan (`docs/plans/SIGNAL-DUNES.md`, `docs/plans/SKY-REACH.md`), style bible, mockups and
  loop boards in `art/<slug>/`, and the time-lapses in `progress/<slug>/`. You may capture more yourself with
  `scripts/shard-progress.mjs` on a served build (`scripts/serve-build.sh` from a scratch export of HEAD, and
  `scripts/browser-lane.sh` around every browser run; close what you open).

**The bar** (one bar for every seat). A finding counts if Jake, playing the new shard on his iPhone right after the
other four, would see it as **clearly below their level** on a concrete point. Each finding needs:
- a **location**: the shard, the view or scenario, and the file or system that causes it;
- **evidence**: the frame path in the new shard and the comparison frame in another shard;
- a **concrete fix** the shard's builder can do (no new content: ledger 4; no invented numbers: ledger 7).

Severities: `must-fix` (reads as unfinished or broken next to the others), `should-fix` (a visible gap the others
don't have), `nit` (taste; never blocks).

**Write** `round-<n>-seat-<A|B|C>.md` in this folder: a findings table (ID `R<n><seat>-<k>`, shard, severity,
location, evidence, fix), then each battery scenario with pass / finding IDs, then the last line, one verdict per shard:
`VERDICT signal-dunes: at the bar | below the bar` and `VERDICT sky-reach: …`. Do not edit anything else.
