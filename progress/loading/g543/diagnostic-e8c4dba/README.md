# Worker handoff diagnostic

Exact committed served SHA: `e8c4dba97ea739c25102480e7fe1984602ecc9f7`.

Eight of ten entries pass; all five actual road exits and home returns pass.
Both failures are warm-grid byte parity; stage sums and detail cadence pass
on every entry. These are diagnostic receipts, not acceptance.

| Surface | Path / visit | Wall / stages s | Wire / displayed bytes | Error | Detail gap ms |
|---|---|---|---|---|---|
| phone | shardfile / cold | 24.1 / 24.208 | 172363793 / 172356607 | 0.00% | 390.9 |
| phone | shardfile / warm | 24.4 / 24.462 | 6263 / 6176 | 1.39% | 381.1 |
| phone | grid / cold | 29.2 / 29.194 | 173165407 / 173107345 | 0.03% | 649.4 |
| phone | grid / warm | 23.6 / 23.644 | 78045 / 57302 | 26.58% | 632.5 |
| simulator | shardfile / cold | 14.3 / 14.294 | 174816614 / 174832681 | 0.01% | 277.0 |
| simulator | shardfile / warm | 8.8 / 8.844 | 23617 / 23892 | 1.16% | 300.0 |
| simulator | grid / cold | 10.6 / 10.616 | 173819916 / 173559000 | 0.15% | 275.0 |
| simulator | grid / warm | 10.7 / 10.769 | 26728 / 28992 | 8.47% | 700.0 |
| desktop | shardfile / cold | 7.7 / 7.754 | 179741093 / 179742581 | 0.00% | 118.0 |
| desktop | grid / cold | 8.6 / 8.573 | 177180561 / 177002756 | 0.10% | 180.7 |

Phone Chromium is muted iPhone 16 Pro / CPU 4x. Native Safari uses the
portrait phone Simulator through sim-lane. Each warm visit retains its
origin and real caches. Desktop grid asserts enabled AO. Normal hover
drives the five return routes; no pose, layout, readiness or cap bypass.

Native warm grid overcounts by exactly 2,264 bytes: seventeen immutable
GLB 304s report 300 bytes each in Resource Timing, versus 183 actual header
bytes (+1,989). HTML adds 94, manifest 49, telemetry 72 and version 60.
The independent observer retains actual body plus actual response headers.
The blob URL-cache fallback in de51698358 removes avoidable admission and
released-library revalidations while preserving exact size/hash checks.

Phone warm grid undercounts by 20,743 bytes. Its automatic browser-owned
worker script check sends no validators and receives 20,539 gzip body
bytes plus 292 header bytes. The following explicit update returns 304.
Page and worker Resource Timing do not expose that browser-owned script
download. The Origin split is gone; warm shard-select checks return 304.
The residual is reported to the coordinator for a decision, without a
body-only metric, guessed header credits or excluded wire requests.

The exact source batch passed types, strict lint and 762 tests. A foreign
uncommitted preview shell syntax error interrupted only the browser stage;
after its owner withdrew it, both official Driftwood and Pine first-frame
checks passed on this same SHA. The prior green source checks were reused.
