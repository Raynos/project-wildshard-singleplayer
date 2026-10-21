# Cold/warm content-cache baseline

Served committed SHA: `8264f6dca2c86c2ec6ec8e2038735d750c5eed6b`.

iPhone 16 Pro Chromium, CPU 4x, muted. Each cold/warm pair shares its origin and browser context; page reloads keep the real HTTP, worker and content caches. No cache or layout switch is used.

| Path | Visit | Wall / stage sum (s) | HTTP / display bytes | From cache (MB) | Detail gap (ms) | Result |
|---|---|---|---|---|---|---|
| shardfile | cold | 30.8 / 30.843 | 173144377 / 173109076 | 100.71 | 533.2 | pass |
| shardfile | warm | 28.1 / 28.173 | 175893 / 134621 | 192.24 | 539.8 | Network bytes are unavailable or differ by more than 5%; Visible MB count differs by more than 5% |
| grid | cold | 27.5 / 27.534 | 173251753 / 173202835 | 96.94 | 577.0 | pass |
| grid | warm | 27.6 / 27.613 | 433126 / 387652 | 187.31 | 583.5 | Network bytes are unavailable or differ by more than 5%; Visible MB count differs by more than 5% |

Both warm cases fail the 5% byte gate. The independent observer saw two
unchanged `/sw.js` bodies of 20,476 bytes each, plus response headers, that
browser-internal update checks do not expose to the page resource observer.
These are real downloads and remain in the denominator. The cold entries
and all four stage sums and cadence checks pass.

The exact fix uses `no-cache` plus ETag revalidation, approved by the coordinator.
Every update still checks freshness; unchanged scripts return 304 without a
body, while changed scripts return their full new bytes. A real static-preview
HTTP test covers both outcomes. The new served proof follows separately.

This prototype same-origin revisit harness is now supported by
`scripts/loading-benchmark/accuracy.mjs --visits=cold,warm`. The regular
six-entry acceptance receipt is retained separately; this added warm test
exposes an accuracy follow-up instead of silently accepting its failure.
