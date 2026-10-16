# Custom code vs agent-hours, 2026-10-16

The successor of `../effort-recount-2026-10-09/share-vs-hours.jpg` on the G458 ruler. y is each legacy shard's custom
lines as a % of its frozen legacy lines (lower is better; goal 20 %, 10 % for Sky Reach and Signal Dunes), measured
with today's **source** ruler (`sourceProgressLines` in `scripts/shard-platform.mjs`) at historical commits. x is the
cumulative port agent-hours on the shard: Codex and Claude session logs since 10-04, idle gaps capped at 15 min,
credited to each commit's shard. `chart.jpg` is the chart (burned-in title, legend and readout); the admin Plan card
shows the same image from `../ruler/custom-vs-hours.jpg`.

**Measured:** 40 sample times, 30 distinct commits, 10-04 00:00 to 10-16 16:43 UTC: daily to 10-09, around G285,
every 6 h from 10-10, then dense on 10-16. Denominators are HEAD's frozen legacy lines (Pine 21,305, Driftwood 17,167,
Sky 6,777, Signal 4,122, Nalati 28,370, Nine 21,111). Points: `curve.json`.

**Missing:** 10-10 18:00 to 10-13 00:00 UTC (10 samples). Today's ruler refuses those trees: their
`scripts/generation-jobs.json` has the recorded-input job `pine-king-collision`, which today's `generate.mjs` does not
register. The chart draws that stretch as a faint dotted gap instead of inventing points.

**Events marked:** G285 bake lanes (10-09 21:05 UTC), W1 at the 10 % line and W2 starts (10-14 04:19), W1 closes on the
G420 grid check (10-14 13:14), the G447 shardfile redesign and the overnight stall (10-16 02:20 to ~12:00), and the
G451 rewire start (10-16 12:00). P4 has not landed, so there is no re-base yet.

**Readout.** Before the bakes every line rose: witnesses and native runtimes added code (Pine 86 → 118 %, Sky 76 →
140 % by 10-10). G285 cut Nine 104 → 73 % overnight. W1 took Signal 109 → 46 % and Sky 137 → 94 % in ~40 and ~60 port
hours; neither reached 10 %. W2 since 10-14 04:19 UTC: Pine 114 → 88 %, Driftwood 112 → 81 % on ~75 port hours each.
The flat runs are the 10-14/15 pause (nothing landed) and the 10-16 stall while the G447 redesign held the lanes.
Nalati never came down (104 %). In the last 12 h: Sky −2.6, Signal −0.1, Pine +0.1, Driftwood 0.0, Nalati and Nine flat.
Pine (85.6 → 87.9 %) and Driftwood (78.7 → 80.9 %) rose after 13:00 UTC: the rewire adds readers of the built output
to `runtime/` while their `data/` TypeScript still counts on the source ruler. Those lines go when P4 moves the ruler to
`out/<slug>/runtime`.

**Re-run** (scratch in a private folder; the mirror runs take ~7 s each, the log scan ~3 min):

    node measure.mjs                         # run by history.mjs inside the build mirror's check slot
    node history.mjs <scratch>/history.json <iso,iso,…>
    python3 commits.py <scratch> && python3 sessions.py <scratch> && python3 effort.py <scratch>
    python3 chart.py <scratch> . <now iso>   # then: rsvg-convert -w 1080 <scratch>/chart.svg -o <scratch>/chart.png
                                             #       magick <scratch>/chart.png -strip -sampling-factor 4:2:0 -quality 70 chart.jpg

The scripts extend the 10-09 recount's: `sessions.py` also credits a commit when a log first mentions its SHA (lanes
land through private indexes and rarely print `[main <sha>]`), and `commits.py` counts every non-docs Conventional
Commit that serves a shard as port work (the waves fold grid-ready into the port).
