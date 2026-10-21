# Loading diagnostic: priority still open

Served committed SHA: `e245b2d5a798fd694c2df74ff7fa1a3ef49f1db0`.

| Surface | Path | Wall / stages (s) | Network / display (MB) | Byte error | Longest detail gap (ms) | Result |
|---|---|---|---|---|---|---|
| simulator | shardfile | 16.7 / 16.741 | 185.46 / 179.43 | 3.25% | 283.0 | pass |
| simulator | grid | 14 / 13.993 | 183.87 / 178.85 | 2.73% | 338.0 | pass |
| phone | shardfile | 25.7 / 25.719 | 173.03 / 172.98 | 0.03% | 437.4 | pass |
| phone | grid | 30 / 30.028 | 173.16 / 172.87 | 0.17% | 504.3 | pass |
| desktop | shardfile | 14 / 13.990 | 181.62 / 181.68 | 0.03% | 188.1 | pass |
| desktop | grid | 18.6 / 18.640 | 181.64 / 180.97 | 0.37% | 566.6 | pass |

Phone Chromium uses iPhone 16 Pro emulation and CPU 4x; desktop uses native CPU.
Safari runs on the iPhone 16 Pro Simulator through sim-lane. Every browser is muted.
Network bytes come from the independent HTTP observer, including service-worker traffic.
Detail cadence excludes duration clocks. JSON retains dependency text, stage totals and counter samples.

Crossings use real held input from home to the south road and back. The play view remains unobstructed;
the five-phase diagnostic accounts for preparation, boundary, checkpoint, commit and activation.
HTTP bytes in these JSON receipts are independent observations; crossings show no loading-panel byte counter.

| Surface | Transfer | Wall / stages (ms) | Result |
|---|---|---|---|
| simulator | driftwood-isle → road | 69.000 / 69.000 | pass |
| simulator | road → driftwood-isle | 28097.000 / 28097.000 | pass |
| phone | driftwood-isle → road | 134.600 / 134.600 | Crossing route did not re-enter home: {"left":true,"feet":{"x":0.02339908926651635,"y":0.44932165214603303,"z":-255.98506017313127},"issues":{}}; Missing actual road exit or home re-entry |
| desktop | driftwood-isle → road | 38.300 / 38.300 | pass |
| desktop | road → driftwood-isle | 9599.700 / 9599.700 | pass |

This is diagnostic, not Phase 1 acceptance: the phone return reached the
independent transfer fence at z -255.985 and requested home preparation,
but that preparation remained pending beyond the unchanged 120 s limit.
The earlier collider stop at -256.649 is gone. Native Safari and desktop
return successfully; all six entry accuracy checks pass.

[The required physics walk](physics-walk.json) uses the same committed SHA,
iPhone 16 Pro and CPU 4x: eight routes, zero stuck and zero page errors.
[Phone return traffic](phone-return-traffic.json) retains the observed
4,921 requests and pending crossing sample. Actual regional admission
priority is fixed separately in b284b0cc61; its final proof remains open.

Inspected portrait captures retain their in-frame SHA/path/device captions:
[phone SHARD SELECT](phone-shardfile.jpg), [phone grid](phone-grid.jpg),
[Simulator SHARD SELECT](simulator-shardfile.jpg), [Simulator grid](simulator-grid.jpg).
