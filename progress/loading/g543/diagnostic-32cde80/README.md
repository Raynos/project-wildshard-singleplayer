# Post warm-up diagnostic: native warm bytes remain open

Exact served committed SHA: `32cde805434270f8ab04091082bfc6b6fcc3c733`.

| Surface | Path / visit | Wall / stages s | Network / display MB | Cache MB | Byte error | Detail gap ms |
|---|---|---|---|---|---|---|
| phone | shardfile / cold | 26.9 / 26.934 | 173.672 / 173.138 | 100.72 | 0.31% | 371.7 |
| phone | shardfile / warm | 24.1 / 24.154 | 0.136 / 0.130 | 192.26 | 4.08% | 368.6 |
| phone | grid / cold | 30 / 29.997 | 173.951 / 173.502 | 96.95 | 0.26% | 689.9 |
| phone | grid / warm | 27.5 / 27.563 | 0.620 / 0.614 | 187.33 | 0.85% | 776.5 |
| simulator | shardfile / cold | 14.1 / 14.127 | 174.837 / 174.839 | 89.69 | 0.00% | 282.0 |
| simulator | shardfile / warm | 12.2 / 12.232 | 0.045 / 0.024 | 181.01 | 45.69% | 417.0 |
| simulator | grid / cold | 15.2 / 15.201 | 172.733 / 172.735 | 87.50 | 0.00% | 374.0 |
| simulator | grid / warm | 11.5 / 11.475 | 0.053 / 0.042 | 175.73 | 21.88% | 610.0 |
| desktop | shardfile / cold | 8 / 7.985 | 181.599 / 181.630 | 113.29 | 0.02% | 114.8 |
| desktop | grid / cold | 9.1 / 9.073 | 179.723 / 179.741 | 111.09 | 0.01% | 192.5 |

Phone Chromium is muted iPhone 16 Pro emulation / CPU 4x; native Safari
is the muted iPhone 16 Pro Simulator through sim-lane. The real 5 x 5 is
used throughout. Each warm entry retains its real origin and caches.
All entries balance stages and pass detail cadence. Eight byte checks
pass; both native warm checks fail. Independent HTTP observation includes
browser-internal worker checks: native receives full unchanged script
bodies while Chromium revalidates them. No request is excluded.

Both native warm frames are valid gameplay entries; their labelled
portraits and both cold phone portraits were viewed. Each native warm
window includes one unchanged `/sw.js` 200 response with a 20,449-byte
body. The grid also has 58 more metadata 304 responses than SHARD SELECT:
their actual headers total 8,700 bytes, while Resource Timing charges
17,400 bytes. These two causes remain open, without changing the wire
denominator. Follow-up source `4a2bed9f6f` reuses hash-verified metadata;
`8e3d697c79` makes Safari consult the worker's ETag under the same
`no-cache` freshness rule. Their new served proof is separate.

The 64 posted worker slots, bounded FIFO fallback, quotas, integrity, pins,
one page-wide GLTF parser and render scale are unchanged. The public HTTP
policy still requires worker freshness revalidation; the real preview test
also proves that a changed script is fetched in full.

Initial loading issues post links first, then warms linked post materials
individually with a paint between completed pipeline draws. Existing target
identities and sizes are retained, and target face/mip restore on failures.
No simulation or effect clock advances. This addresses preparation omitted
before the first composer draw; the earlier intermittent stall and the
non-reproducing GL diagnostic remain in [the diagnostic](../diagnostic-bd459da/README.md).

The six post tests include actual N8AO unbound arrays; root tsc and strict lint pass. One
source batch covers the AO forward fix and boots Driftwood and Pine. The O2 source
batch on bd459da had already passed and was not re-run.

| Surface | Visit | Real transitions | Home preparation s | Result |
|---|---|---|---|---|
| phone | cold | 2 | 42.531 | pass |
| phone | warm | 2 | 33.758 | pass |
| simulator | cold | 2 | 21.134 | pass |
| simulator | warm | 2 | 21.305 | pass |
| desktop | cold | 2 | 2.799 | pass |

Each actual road exit and return uses normal hover input. The five named
crossing phases sum exactly to transition wall time; no pose, layout, cap
or readiness bypass is used. The unchanged-collider physics receipt retained
with Phase 1 is still the walk evidence; this shader/cache change adds none.

Desktop grid also asserts that the actual AO pass is present and enabled.
Its compact receipt retains that assertion and the observed composer passes.
