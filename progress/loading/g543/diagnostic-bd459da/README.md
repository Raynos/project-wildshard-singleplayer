# O2 cold/warm diagnostic

Exact served committed SHA: `bd459dadaf9da655af6b37bdb91aed3ec3aad63f`.
Source batch green: 368.4 s inner / 556 s including queue. All sessions muted;
Chromium is iPhone 16 Pro / CPU 4x; native is iPhone 16 Pro Simulator.

| Surface | Path / visit | Wall / stages (s) | Network / display MB | Cache MB | Byte error | Detail gap ms | Result |
|---|---|---|---|---|---|---|---|
| phone | shardfile / cold | 28 / 28.026 | 176.081 / 175.564 | 99.15 | 0.29% | 619 | pass |
| phone | shardfile / warm | 19 / 19.089 | 0.135 / 0.130 | 192.26 | 3.99% | 764.1999999880791 | pass |
| phone | grid / cold | 25.3 / 25.285 | 175.690 / 175.720 | 93.09 | 0.02% | 543 | pass |
| phone | grid / warm | 21.5 / 21.492 | 0.340 / 0.337 | 187.33 | 0.97% | 606.5999999642372 | pass |
| simulator | shardfile / cold | 24.8 / 24.847 | 185.883 / 179.946 | 89.60 | 3.19% | 1916 | cadence fails |
| simulator | shardfile / warm | — / — | — / — | 0.00 | — | — | invalid: title returned / recorder lost |
| simulator | grid / cold | 11.1 / 11.096 | 177.554 / 174.966 | 87.42 | 1.46% | 258 | pass |
| simulator | grid / warm | 0 / 0.000 | 0.000 / — | 0.00 | — | 1 | invalid: title returned / recorder lost |

All four phone cases pass. Warm worker checks are actual 304 responses with
zero body bytes; no network denominator was reduced. Native cold grid passes.
Native cold SHARD SELECT has a 1,149 ms pending-link gap, then 1,916 ms
between post-chain and ready; its program count stays 120. O5 is pulled
forward to warm native post draw pipelines during Shaders.

Both native warm cases are invalid harness results, not acceptance. Controlled
navigation to the setup fixture served the cached app, while background
revalidation replaced its cached shell with the redirect fixture. The next
chunk navigation returned to title and lost the recorder. The retained viewed
portrait shows that title. `7fc9a635db` moves save setup into the inspected page;
the follow-up also opens the real title for Inspector instead of navigating
to JSON. No service worker, content cache or app path is bypassed.

A separate fresh-origin native GL diagnostic did not reproduce the pause:
17.1 s, maximum detail gap 400 ms, no incomplete completion polls, and no
additional linked program during first frame. Its instrumentation is diagnostic,
not acceptance. It retained no shader text or GL handles and made no extra GL
queries. Checkpoints were not captured by this version of the diagnostic;
the trace therefore does not attribute the original stall to a particular pass.

O2 and the added warm L2/L8 follow-up remain open for corrected native proof.
