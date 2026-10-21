# Loading accuracy diagnostic

Served committed SHA: `6c1495e58896afd8f142b7a5acd82b7f94378719`.

**All three actual road returns pass; native SHARD SELECT cadence fails.**
The source batch passed in 367.5 seconds. No Phase 1 acceptance is claimed.

| Surface | Path | Wall / stages (s) | Network / display (MB) | Byte error | Longest detail gap (ms) | Result |
|---|---|---|---|---|---|---|
| simulator | shardfile | 22.5 / 22.485 | 185.86 / 179.44 | 3.46% | 1486.0 | Detailed update gap exceeds 1 s |
| simulator | grid | 12.8 / 12.781 | 184.23 / 187.48 | 1.77% | 570.0 | pass |
| phone | shardfile | 36.7 / 36.741 | 172.40 / 172.35 | 0.03% | 618.2 | pass |
| phone | grid | 29.6 / 29.565 | 171.07 / 171.02 | 0.03% | 643.3 | pass |
| desktop | shardfile | 8.4 / 8.468 | 179.74 / 179.74 | 0.00% | 150.5 | pass |
| desktop | grid | 11.2 / 11.173 | 179.75 / 179.77 | 0.01% | 222.9 | pass |

Phone Chromium uses iPhone 16 Pro emulation and CPU 4x; desktop uses native CPU.
Safari runs on the iPhone 16 Pro Simulator through sim-lane. Every browser is muted.
Network bytes come from the independent HTTP observer, including service-worker traffic.
Detail cadence excludes duration clocks. JSON retains dependency text, stage totals and counter samples.

Crossings use real held input from home to the south road and back. The play view remains unobstructed;
the five-phase diagnostic accounts for preparation, boundary, checkpoint, commit and activation.
HTTP bytes in these JSON receipts are independent observations; crossings show no loading-panel byte counter.

| Surface | Transfer | Wall / stages (ms) | Result |
|---|---|---|---|
| simulator | driftwood-isle → road | 63.000 / 63.000 | pass |
| simulator | road → driftwood-isle | 19417.000 / 19417.000 | pass |
| phone | driftwood-isle → road | 120.300 / 120.300 | pass |
| phone | road → driftwood-isle | 52482.600 / 52482.600 | pass |
| desktop | driftwood-isle → road | 42.500 / 42.500 | pass |
| desktop | road → driftwood-isle | 5549.800 / 5549.800 | pass |

The admission priority correction makes the phone return complete in 52.483 s;
native and desktop return in 19.417 / 5.550 s. The independent transfer fence
remains solid until destination readiness and the fixed-boundary reframe.
No pose, layout, parser bound or other cap changes support these results.

The native SHARD SELECT failure is a 1,486 ms detail interval from first-frame
Pass 0 (world + shadows) to Pass 1. A second 1,056 ms interval follows Pass 4.
The coordinator routed shader poll pacing to its owner; a separate GL-call
and WebKit Timeline diagnostic tests that attribution. This failure stays
visible even though all other entry measurements and all crossings pass.

The required [CPU 4x grid physics walk](physics-walk.json) passes all eight
routes with zero stuck results and zero page errors on this same build.
[Native seam regressions](native-entry-fences.json) cover walking and hover
at each of the four grid mouths; eight original-data failures become eight
passes without changing the engine motor or entry trigger.

Four viewed real portrait frames carry burned-in build and device labels:
[phone shardfile](phone-shardfile.jpg), [phone grid](phone-grid.jpg),
[Simulator shardfile](simulator-shardfile.jpg), [Simulator grid](simulator-grid.jpg).
