# Loading accuracy diagnostic

Served committed SHA: `4313fc648240b2a9034e7396b8af070dbf85768e`.

**Phase 1 remains open.** Five entry cases pass; phone grid fails its
1070.8 ms detail gap. All three real crossing cases pass. Recorder v2
(`6324155e85`) excludes elapsed wait clocks and observes actual byte,
dependency and unit changes. The source batch passed in 786.1 s.

The phone profile attributes 370 ms of the failing interval to schema
validation, with queued IO and consumer work. The session constructor
accounts for 21 ms and plot internals for 7 ms; neither was changed.
The queue's leading paint boundary lacked a trailing boundary before
consumer assembly/hashing. `91a491c8a8` restores that boundary and reports
actual schema completion before it. `390a57867c` keeps parallel stage
counts visible while time remains exclusive. Both have focused checks;
their exact-build batch and served proof run separately.

| Surface | Path | Wall / stages (s) | Network / display (MB) | Byte error | Longest detail gap (ms) | Result |
|---|---|---|---|---|---|---|
| simulator | shardfile | 14.2 / 14.209 | 185.73 / 182.58 | 1.70% | 309.0 | pass |
| simulator | grid | 15.6 / 15.638 | 183.25 / 178.28 | 2.72% | 682.0 | pass |
| phone | shardfile | 35.3 / 35.321 | 176.20 / 176.19 | 0.01% | 570.1 | pass |
| phone | grid | 28.8 / 28.850 | 173.90 / 173.74 | 0.09% | 1070.8 | Detailed update gap exceeds 1 s |
| desktop | shardfile | 13.7 / 13.740 | 179.81 / 179.82 | 0.01% | 264.0 | pass |
| desktop | grid | 11.4 / 11.397 | 181.33 / 181.35 | 0.01% | 259.4 | pass |

Phone Chromium uses iPhone 16 Pro emulation and CPU 4x; desktop uses native CPU.
Safari runs on the iPhone 16 Pro Simulator through sim-lane. Every browser is muted.
Network bytes come from the independent HTTP observer, including service-worker traffic.
Detail cadence excludes duration clocks. JSON retains dependency text, stage totals and counter samples.

Crossings use real held input from home to the south road and back. The play view remains unobstructed;
the five-phase diagnostic accounts for preparation, boundary, checkpoint, commit and activation.
HTTP bytes in these JSON receipts are independent observations; crossings show no loading-panel byte counter.

| Surface | Transfer | Wall / stages (ms) | Result |
|---|---|---|---|
| simulator | driftwood-isle → road | 76.000 / 76.000 | pass |
| simulator | road → driftwood-isle | 34.000 / 34.000 | pass |
| phone | driftwood-isle → road | 134.400 / 134.400 | pass |
| phone | road → driftwood-isle | 33.400 / 33.400 | pass |
| desktop | driftwood-isle → road | 45.200 / 45.200 | pass |
| desktop | road → driftwood-isle | 19.900 / 19.900 | pass |

Real portrait first frames with burned-in build/device labels:
[phone shardfile](phone-shardfile.jpg), [phone grid](phone-grid.jpg),
[Simulator shardfile](simulator-shardfile.jpg), [Simulator grid](simulator-grid.jpg).
