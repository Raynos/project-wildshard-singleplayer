# M3 effort recount, 2026-10-10 (10:45 UTC)

A re-run of yesterday's measured recount (`../effort-recount-2026-10-09/`, its scripts unchanged except as noted) up to
2026-10-10 10:45 UTC. Effort is the active time in 751 Codex and Claude session logs since 2026-10-04 (idle gaps capped
at 15 min), credited to each commit's shard. Share is today's `scripts/shard-platform.mjs` run on `git archive` exports of
committed HEAD: 3-hourly since 10-04, then hourly since 10-09 09:00, plus the exact G285 (21:05) and 12-hours-ago (22:45)
points. Machine-readable numbers: `effort.json`.

Two changes to the method: the port pattern in `commits.py` now also counts `SHARD-PLATFORM M3:` subjects and `G285`
commits. Yesterday's pattern wanted `M3 ` with a space, so it would have filed today's 105 M3 commits as non-port.
`history.mjs` also takes its output file, start, step and end as arguments.

| shard | port agent-h spent (last 12 h) | share now / 12 h ago | proofs of 6 | agent-h left | effort % done | phase |
|---|---|---|---|---|---|---|
| Template 1 | 57.6 (0.3) | 90.4 / 90.4 % | 6 | 0 | 100 % | done |
| Blender Template | 0 port, 13.7 other (0) | 90.2 / 90.2 % | 6 | ~3 (13 custom lines, SF55) | ~82 % | flat |
| Signal Dunes | 24.6 (6.1) | 58.4 / 26.5 % | 6 | ~8 | 75 % | late jump, tail next |
| Sky Reach | 26.8 (5.4) | 44.7 / 18.5 % | 5 | ~18 | 60 % | jump |
| Pine Hollow | 40.7 (13.9) | 23.7 / 8.0 % | 3 | ~55 | 43 % | jump |
| Driftwood | 33.0 (14.6) | 19.1 / 1.6 % | 3 | ~70 | 32 % | jump |
| Nalati | 37.6 (14.2) | 14.0 / 0.4 % | 0 | ~130 | 22 % | jump, slowing; no witness |
| Nine Dragon | 20.4 (9.3) | 70.2 / 0.3 % | 5 | ~12 | 63 % | tail |
| Shared systems | 59.2 (18.3) | — | — | ~85 | 41 % | — |
| **M3** | **300 (82)** | | | **~380 (270–550)** | **44 %** | |

**G285's jump happened**, within two hours of the call (10-09 21:05 UTC). Public lines gained per port agent-hour since
then: Nine Dragon 1,160/h (a 3,500/h peak: 10.4k lines in 2.9 h), Pine 185/h (peak 315), Driftwood 170/h (peak 360).
Custom lines fell faster still: 1,580, 350 and 250 an hour, because bakes delete code as well as move it. Yesterday's
prediction was 110–220 lines/h. Pine and Driftwood landed in that band; Nine Dragon was 5× above it. Nalati jumped too
(0.4 → 14 %, 280/h) without its witness, and Sky Reach (340/h) and Signal (2,240 custom lines out) kept moving.

**How the hours left are estimated:** first, the custom lines each shard must still remove to reach 80 %, at its own
measured public-in to custom-out ratio. Then, half of those at the shard's current rate and half at a third of it (the
behaviour tail), plus the missing proofs. Measure 2 (runtime lines ≤ 20 % of the baseline) is still over for Pine
(4,866 against 4,340), Driftwood (4,864 against 3,753) and Nalati (9,592 against 6,619). Those are behaviour lines, and they
are the tail.

**Fleet:** 113 active lane-hours in the last 12 h (9.4 lanes), 73 % of it on the port (38 % the day before; 62 % over
24 h). At that mix, the ~380 M3 hours take **~55 h of wall clock (40–80)**. With all 10 lanes on the port, they take ~38 h.

**M2:**
- SF22 desktop passed (`63636a567`). The Simulator / Safari gates are still open: a GL 1281 error on the
  Signal → Driftwood return crossing, the 50 ms preparation budget (one 162 ms `getProgramInfoLog` task) and the Safari
  Auto subset failures (`progress/loading/sf22-initial-layer-preparation/`).
- SF57's shipped leg passes (`ee8c0bcfd`). Its dev leg closes under M3.
- Jake's three phone runs (SF22c) and the G269 memory verdict are his gates.
- M2 has about 20 agent-hours left (SF22 took about 10 h in the last 12) and is about 95 % done by effort.
- Part A extras have about 24 h left: SF55's card, facade and floor; SF58 hardening, untouched since 10-07; SF66's map
  inside the shardfile.

**Part A:** about 630 agent-hours spent in the logged era, since 10-04 (work before that is not in the logs), and about
420 left, so **60 % by effort**. The finish ranges below leave out Jake's gates (the phone runs, G269, and the SF67 /
SF63 / Sky isles / SF59 picks; the Sky isles pick blocks Sky Reach's biggest bake).

| pace | finish (UTC) |
|---|---|
| Today's pace (73 % of 9.4 lanes on the port; M2 and the extras fit in the other lanes) | 2026-10-12 ~18:00 (10-12 05:00 – 10-13 19:00) |
| All 10 lanes on the plan | 2026-10-12 ~05:00 (10-11 17:00 – 10-13 09:00) |

Confidence is medium for the hours spent and low to medium for the hours left. The rates come from the bake phase. The
behaviour tail and Nalati's unbuilt witness could each add tens of hours.

Chart: `share-vs-hours.jpg`. Dashed lines run up to 12 h ago, solid lines are the last 12 h, and the diamonds mark G285.
