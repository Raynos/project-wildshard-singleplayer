# Loading accuracy diagnostic

Served committed SHA: `091224244315d67c88dc61ee1e34df8b5b2bb649`.

**Phase 1 remains open.** The six valid entries below passed, but a later
phone grid entry reached 1117.9 ms between detail updates. A focused profile
then reached 1049.2 ms. Both failures remain in `phone-grid-repeats.json`.
The crossing cases include the phone driver's failed return: it exited to
the road but waited for an exact coordinate before reversing. `5d61c19194`
steers by actual transfers and still requires both commits.

The profile attributes 443 ms of its longest interval to unchanged custom
schema validation, plus cache index/write and other queued work. Schema
factoring `9d40530bad` was already present. `fb4b943579` serializes checks
across products with a paint before each validator; `4313fc6482` batches
durable cache index metadata. Their batch and served proof run separately.
No Ajv options, hash checks or limits changed.

| Surface | Path | Wall / stages (s) | Network / display (MB) | Byte error | Longest detail gap (ms) | Result |
|---|---|---|---|---|---|---|
| simulator | shardfile | 17.1 / 17.165 | 184.55 / 181.38 | 1.72% | 327.0 | pass |
| simulator | grid | 15.9 / 15.909 | 184.66 / 181.82 | 1.54% | 501.0 | pass |
| phone | shardfile | 27.1 / 27.133 | 175.40 / 175.40 | 0.00% | 450.1 | pass |
| phone | grid | 26 / 26.005 | 174.18 / 174.16 | 0.01% | 817.6 | pass |
| desktop | shardfile | 10.3 / 10.348 | 179.83 / 179.84 | 0.00% | 194.1 | pass |
| desktop | grid | 10.2 / 10.223 | 180.72 / 180.74 | 0.01% | 536.0 | pass |

Phone Chromium uses iPhone 16 Pro emulation and CPU 4x; desktop uses native CPU.
Safari runs on the iPhone 16 Pro Simulator through sim-lane. Every browser is muted.
Network bytes come from the independent HTTP observer, including service-worker traffic.
Detail cadence excludes duration clocks. JSON retains dependency text, stage totals and counter samples.

Crossings use real held input from home to the south road and back. The play view remains unobstructed;
the five-phase diagnostic accounts for preparation, boundary, checkpoint, commit and activation.
HTTP bytes in these JSON receipts are independent observations; crossings show no loading-panel byte counter.

| Surface | Transfer | Wall / stages (ms) | Result |
|---|---|---|---|
| simulator | driftwood-isle → road | 71.000 / 71.000 | pass |
| simulator | road → driftwood-isle | 32.000 / 32.000 | pass |
| phone | driftwood-isle → road | 156.200 / 156.200 | Crossing route did not re-enter home; Missing actual road exit or home re-entry |
| desktop | driftwood-isle → road | 43.500 / 43.500 | pass |
| desktop | road → driftwood-isle | 15.500 / 15.500 | pass |

Source check `20261020T212344-loading-named-cache-source-batch-86735`
passed in 940.4 s. Preview 4443 reported build `0912242-mvhidxq5`.
Initial native launch failed on the boot logo; `1d2fe3980a` explicitly
launches Safari before navigation. Native receipts here are its valid retry.

Real portrait first frames, with burned-in build/device labels:
[phone shardfile](phone-shardfile.jpg), [phone grid](phone-grid.jpg),
[Simulator shardfile](simulator-shardfile.jpg), [Simulator grid](simulator-grid.jpg).
