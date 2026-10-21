# Loading accuracy receipt

Served committed SHA: `8264f6dca2c86c2ec6ec8e2038735d750c5eed6b`.

| Surface | Path | Wall / stages (s) | Network / display (MB) | Byte error | Longest detail gap (ms) | Result |
|---|---|---|---|---|---|---|
| simulator | shardfile | 13.4 / 13.426 | 184.66 / 182.02 | 1.43% | 267.0 | pass |
| simulator | grid | 14.8 / 14.819 | 183.46 / 183.47 | 0.01% | 382.0 | pass |
| phone | shardfile | 21 / 21.077 | 172.36 / 172.35 | 0.01% | 368.7 | pass |
| phone | grid | 22.4 / 22.479 | 171.06 / 171.01 | 0.03% | 416.3 | pass |
| desktop | shardfile | 9.4 / 9.425 | 181.72 / 181.74 | 0.01% | 132.2 | pass |
| desktop | grid | 9 / 9.023 | 179.49 / 179.50 | 0.01% | 188.2 | pass |

Phone Chromium uses iPhone 16 Pro emulation and CPU 4x; desktop uses native CPU.
Safari runs on the iPhone 16 Pro Simulator through sim-lane. Every browser is muted.
Network bytes come from the independent HTTP observer, including service-worker traffic.
Detail cadence excludes duration clocks. JSON retains dependency text, stage totals and counter samples.

Crossings use real held input from home to the south road and back. The play view remains unobstructed;
the five-phase diagnostic accounts for preparation, boundary, checkpoint, commit and activation.
HTTP bytes in these JSON receipts are independent observations; crossings show no loading-panel byte counter.

| Surface | Transfer | Wall / stages (ms) | Result |
|---|---|---|---|
| simulator | driftwood-isle → road | 59.000 / 59.000 | pass |
| simulator | road → driftwood-isle | 16197.000 / 16197.000 | pass |
| phone | driftwood-isle → road | 106.600 / 106.600 | pass |
| phone | road → driftwood-isle | 33594.500 / 33594.500 | pass |
| desktop | driftwood-isle → road | 37.100 / 37.100 | pass |
| desktop | road → driftwood-isle | 2999.900 / 2999.900 | pass |

X17 is closed by registered readiness-fence data `e77e887075`, followed by
admission IO priority `b284b0cc61`: all four mouths pass both native walking
and hover, and all three real road routes now return. No pose, layout,
parser bound or cap bypass is used. The independent transfer fence holds
until the destination is ready and the actual fixed-boundary reframe.

The required [CPU 4x physics walk](physics-walk.json) is the retained
`6c1495e588` eight-route run with zero stuck results and zero page errors.
The physics tree, readiness data, plot geometry/layout and Driftwood world
builder are byte-identical to that pin. The only intervening session edit
changes its read-only cost display from entries() to claims(). The walk
is not re-labelled as this newer build. [Eight native seam regressions](native-entry-fences.json)
retain the original failures and the green focused source check.

The current pin includes `2f9eb0dc08` (live link polling at 4 Hz only in
play). The earlier native first-frame gap is not attributed to it: the
[old-pin GL trace](../diagnostic-6c1495e/native-link-polls.json) found 8 ms
shader rechecks and no first-frame link queries; its Timeline stop timed
out. That diagnostic and the original 1,486 ms failure remain visible.

The loading source batch passed at `6c1495e588` in 367.5 seconds. This
newer exact build verifies the owner's subsequent rendering fixes and
all entry/crossing acceptance cases; no green loading-source check was
repeated. Four labelled real portrait frames are inspected before their
inclusion with this receipt.

Viewed real portrait frames: [phone shardfile](phone-shardfile.jpg), [phone grid](phone-grid.jpg), [Simulator shardfile](simulator-shardfile.jpg), [Simulator grid](simulator-grid.jpg).
