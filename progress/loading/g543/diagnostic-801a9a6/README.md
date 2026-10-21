# Loading accuracy diagnostic

Served committed SHA: `801a9a68505d09b4f84b840660397d3ebcc5b39d`.

**All six entry accuracy cases pass; Phase 1 remains open for X17.**
The source batch passed in 623.1 seconds, including a real Driftwood first
frame. Recorder v2 excludes elapsed wait clocks from completed progress.

| Surface | Path | Wall / stages (s) | Network / display (MB) | Byte error | Longest detail gap (ms) | Result |
|---|---|---|---|---|---|---|
| simulator | shardfile | 13.6 / 13.667 | 185.84 / 185.17 | 0.36% | 250.0 | pass |
| simulator | grid | 20.2 / 20.241 | 182.51 / 182.52 | 0.01% | 360.0 | pass |
| phone | shardfile | 30.9 / 30.986 | 175.54 / 175.50 | 0.02% | 556.7 | pass |
| phone | grid | 29.3 / 29.322 | 174.60 / 174.63 | 0.02% | 651.0 | pass |
| desktop | shardfile | 11.2 / 11.223 | 181.60 / 181.62 | 0.01% | 158.1 | pass |
| desktop | grid | 10.9 / 10.895 | 180.01 / 180.03 | 0.01% | 190.4 | pass |

Phone Chromium uses iPhone 16 Pro emulation and CPU 4x; desktop uses native CPU.
Safari runs on the iPhone 16 Pro Simulator through sim-lane. Every browser is muted.
Network bytes come from the independent HTTP observer, including service-worker traffic.
Detail cadence excludes duration clocks. JSON retains dependency text, stage totals and counter samples.

Native and desktop crossings exit and return, with exact five-phase sums.
Phone returns stop at z -256.649 with no re-entry request: walking feet at
y 0.020 and normal hover at y 0.450. Both failures are retained below; the
coordinator assigned the real collision bug X17 to this lane. No return is
claimed for either phone attempt.

The registered readiness wall is centred at cell half +6 m. Its 0.25 m
half-width plus the 0.38 m capsule and 0.02 m controller skin explains the
6.65 m stop, outside the <=6 m entry trigger. The fix and its all-four-mouth
native regressions run separately; this diagnostic is the unchanged build.

| Surface / mode | Transfer | Wall / phases (ms) | Result |
|---|---|---|---|
| simulator | driftwood-isle → road | 59.000 / 59.000 | pass |
| simulator | road → driftwood-isle | 33.000 / 33.000 | pass |
| desktop | driftwood-isle → road | 42.700 / 42.700 | pass |
| desktop | road → driftwood-isle | 16.900 / 16.900 | pass |
| phone-walk | driftwood-isle → road | 131.400 / 131.400 | return blocked; X17 |
| phone-hover | driftwood-isle → road | 119.400 / 119.400 | return blocked; X17 |

Real portrait first frames with burned-in build/device labels:
[phone shardfile](phone-shardfile.jpg), [phone grid](phone-grid.jpg),
[Simulator shardfile](simulator-shardfile.jpg), [Simulator grid](simulator-grid.jpg).
