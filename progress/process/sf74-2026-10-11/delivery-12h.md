# Delivery receipt at 22:23 UTC, 11 October 2026

SF74's delivery targets and SF60's one-day release target remain unqualified.
Reproduce the read-only rolling census with
`python3 progress/process/sf74-2026-10-11/measure-delivery.py --hours 12`.
The retained aggregate is [delivery-12h.json](delivery-12h.json).

| Measure over the preceding 12 hours | Observation |
|---|---|
| Commit to observed origin update | 305 reached commits; median 33.02 min, p90 149.27 min |
| Still unpushed | 100 commits; oldest 327.92 min |
| Regeneration commits, W27 | 53 of 405 commits, 13.09% |
| Cached gate scheduling, W24 | 54 attempts; median 314.5 s, p90 354 s |
| Full gate scheduling | 13 attempts; median 361 s, p90 427 s |
| All gate verdicts | 27 green, 40 red |
| Regeneration time | 91 push records; median 48 s, p90 117 s |
| Completed push CI | 20 green, 3 red; 87.0% |

Origin times are the local remote-ref reflog observation times, not the
commit timestamps. The latency excludes commits still unpushed and does
not claim an independently measured server arrival time. Regeneration
counts include both the historical SF6b subject and the new Conventional
Commit subject. The CI API sample covers the full window.

Gate scheduling labels describe the gate's cache mode; a cached gate can
still run full Vitest. Repeated failed attempts count in these medians.
The newest complete gate, `395a8d6ee`, took 529.04 seconds and passed all
17 previously red bake/freshness checks; its sole remaining failure was
the real-Git contention fixture. `e5905be80` fixes that event race and
`62d5f1c83` closes the subsequent FIFO reader-startup gap. The next full
gate is in flight, so the local focused pass is not a queue-green claim.

Production still serves **1d378b7ba-mv49rdxs**, built at
**20:22:16.525 UTC**. Its exact push CI `38169957234` and boot smoke
`38170546865` are green. Scheduled release `38179014718` started at
22:05:27 UTC and succeeded as an already-live no-op. The release-slot
reader correctly refuses another dispatch within that hour. This is a
partial daily receipt: it does not qualify a full day of hourly releases,
a current What's New card, or every-entry Simulator playtests.
