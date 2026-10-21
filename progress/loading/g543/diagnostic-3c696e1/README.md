# Warm metadata diagnostic: byte follow-ups remain open

Exact served committed SHA: `3c696e1134cea78a1d0142bb6969b02c149acd5b`.
One combined source batch passed in 814.6 s. Ten real entries reach first
frame; six pass every accuracy check. Three warm byte checks fail, and
native cold grid has a 1,002 ms completed-detail gap. No request or failure
is excluded from the independent wire denominator.

| Surface | Path / visit | Wall / stages s | Network / display MB | Cache MB | Byte error | Detail gap ms |
|---|---|---|---|---|---|---|
| phone | shardfile / cold | 22.3 / 22.299 | 175.504 / 175.264 | 99.14 | 0.14% | 446.5 |
| phone | shardfile / warm | 21.2 / 21.299 | 0.057 / 0.057 | 193.03 | 0.03% | 374.0 |
| phone | grid / cold | 21.9 / 21.894 | 170.878 / 170.239 | 101.42 | 0.37% | 496.2 |
| phone | grid / warm | 22.1 / 22.142 | 0.027 / 0.001 | 190.57 | 97.52% | 591.1 |
| simulator | shardfile / cold | 14.2 / 14.267 | 182.216 / 177.090 | 89.44 | 2.81% | 269.0 |
| simulator | shardfile / warm | 13.9 / 13.909 | 0.044 / 0.024 | 181.74 | 46.14% | 408.0 |
| simulator | grid / cold | 15.6 / 15.598 | 172.733 / 172.733 | 88.28 | 0.00% | 1002.0 |
| simulator | grid / warm | 8.5 / 8.546 | 0.044 / 0.024 | 179.41 | 46.14% | 653.0 |
| desktop | shardfile / cold | 14.3 / 14.392 | 181.620 / 181.658 | 106.35 | 0.02% | 933.1 |
| desktop | grid / cold | 9 / 9.051 | 179.612 / 179.627 | 111.86 | 0.01% | 169.0 |

Muted phone Chromium uses iPhone 16 Pro emulation and CPU 4x. Native
Safari uses the portrait iPhone Simulator through sim-lane; desktop grid
asserts the real AO pass is present and enabled. The real 5 x 5 is used.
Stage sums balance within 0.1 s throughout; all five real returns pass.

Verified metadata reuse removes native warm metadata revalidations entirely.
Both native warm entries still receive unchanged sw.js as a 200 with a
20,418-byte gzip body; the display misses that browser-internal update.
Phone warm grid also misses a 5,214-byte background document response and
its 235 response-header bytes. Its counter is 662 versus 26,671 actual
bytes; the remaining bytes include the worker body and real response
headers. Phone warm SHARD SELECT happens to receive worker 304s and passes.

The separate actual-worker/title probe (not a first-frame proof) isolates
Origin variation: explicit all-mode update sends validators and gets 304,
while restart navigation adds Origin, sends none, and receives 200/full.
Preview adds Vary: Origin; production's checked old live cdff44f21 response
has no Origin variation and a strong ETag, but still the old no-store
policy. c8dcbc0b23 makes the preview worker origin-invariant with the
production wildcard ACAO, keeping no-cache and conditional ETag updates.
The regression covers Origin absent/present and a same-length changed body.
Production no-cache after release remains to be verified.

A second focused real-worker regression reproduces lost recent replay:
320 requests fill the default 250-entry resource-timing buffer. Live
observers still receive later timings, but a new page can miss those
messages before its listener starts; replay then contains only older
entries. 41c2e21e54 clears a full buffer at its existing capacity. The
latest response is recovered with 78 entries retained, not a raised cap.
The separate buffer/live-observer and forced-GC probes ruled out a dead
observer; their results are diagnostic only.

Native cold grid's completed-detail gap is an opaque title-art wait
(27/28 to 28/28), with no network response during that interval and a
largest page-update pause of only 0.3 s. 0c78b3da6a names artwork queue,
read, decode and UI-module awaits in the real wait registry. No counters
advance on a timer, and wait ages remain excluded from completed work.
The 1,002 ms failure is retained rather than rounded into a pass.

The same four rolling admission reads, 64 posted cache slots, disk quotas,
integrity checks, one page-wide GLTF parser and render scale remain intact.
The next exact-build matrix covers the Origin and timing-replay repairs;
this diagnostic closes no added warm acceptance row.

| Surface | Visit | Real transitions | Home preparation s | Result |
|---|---|---|---|---|
| phone | cold | 2 | 28.913 | pass |
| phone | warm | 2 | 40.359 | pass |
| simulator | cold | 2 | 19.630 | pass |
| simulator | warm | 2 | 24.134 | pass |
| desktop | cold | 2 | 3.433 | pass |

Each road exit and home return uses normal hover input. The five named
crossing phases sum exactly to transition time. No pose, layout, cap or
readiness bypass is used; earlier unchanged-collider physics evidence
keeps its true SHA. Four viewed, labelled portrait frames accompany this
receipt. Source-mapped profiles remain separate from acceptance claims.
