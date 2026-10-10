# SF22: matched desktop crossing gates pass

2026-10-10. Runtime pin `1c807de6be3cc234ee69cdc01b471d46596a2a08`, build `1c807de-mv1xgxup`.
**The defined Chromium gates pass on this circuit.** Memory remains **phone runs (G269)**.

The 651-second proof used Chromium Metal (Apple M5 Max), iPhone portrait 402×874, phone tier, 2× rendering,
live clock, Developer off, Memory saver off and Auto textures. The real probe accepted ASTC/ETC2; Auto selected
KTX2. HTTP/disk version and owned listener identity matched. All six public G270 entries used held input;
standing poses were seeded only after the circuit. Network shaping began after the initial home became playable:
5 Mbit/s, with 25 injected 3/10-second asset stalls. No limits, claims or deadlines changed.

| Gate / ruler | Measured result |
|---|---|
| Entries / physical crossings / runtime activations | 6 / 12 / 5, all expected events recorded |
| Refusals / page errors / network failures | 0 / 0 / 0 |
| Maximum synchronous crossing | **32.7000002861 ms**, Pine departure |
| Pine departure save / frame commit / leave | 3.1 / 0.1 / **29.5 ms** |
| Maximum entry commit / readiness wait / activation | 0.2 / 3.9 / 5.9 ms |
| Crossing drawn-frame p95 / p99 / maximum | **33.40000000002328 / 33.5 / 249.9 ms** |
| Both same-session standing p95 values / observed timestamp quantum | **33.40000000002328 / 0.1 ms** |
| First crossroads shader calls, explicit / draw-driver / unknown | **232 / 0 / 0** |
| In-play explicit shader calls / complete warm-up invocations | 1,820 / 531 |
| Warm-up task maximum, for both calls and all invocations | **≤50 ms**, observer-censored upper bound |
| Maximum measured synchronous warm-up invocation | **12.9000000954 ms** |

Cadence passes the coordinator's observed-resolution rule (`84128ede1`): crossing p95 equals the smallest
same-session standing p95, within one observed 0.1 ms quantum; the original 33.3 ms limit remains the reference.
The shader gate (`1c807de6b`) requires zero draw/driver or unknown calls in the whole first crossroads vicinity
(83 observed frames, with one-second padding, 149876.9–154610.2 ms). Explicit warm-up is excluded only with its
50 ms task bound. No reported Long Task overlaps any in-play warm-up call **or any of the 531 full invocations**,
including cached calls issuing no new shaders. This establishes ≤50 ms, not an exact sub-threshold maximum.
The raw journal predates the extra invocation-gate conjunction; regrading its complete invocation intervals
with the same defining gate also passes. All raw counts and intervals are retained.

Departure totals were Driftwood 21.9, Pine **32.7**, Nalati 16.0, template 29.2, Sky 14.1 and Signal 5.2 ms.
Pine's preceding repeat was 38.9 ms (leave 35.9); `23ed90be1` removes duplicated sibling-world final capture,
with late-resource and exact-once-disposal fixtures. This circuit is a measured pass, not an isolated A/B credit.
Pine has only 0.3 ms headroom in this run. Route one-minute load medians were **29.44 / 32.79 / 34.53 / 24.26 /
29.44 / 40.41**, so every route's timings are **under load**.

Remaining loading outliers stay visible: Pine's first entered second had 2 draw/driver shader calls and a
69 ms task; Nalati had 14 and a 77 ms task. Signal had zero shader calls but a 61 ms task in that second.
An initial-boot warm-up task was **545 ms**, before routes began at 14641.4 ms. These are outside the defined
first-crossroads window. World / afterKit awaited wall times were Pine 52.2 / 18.0 s and Nalati 28.6 / 13.5 s;
Sky world was 46.1 s. Wall intervals include fetches and yields, and are not CPU-task totals.

Simulator Auto's honest image-fallback refusal remains recorded in the [earlier receipt](../sf22-approach-662a12434/README.md).
Forced-compressed Simulator Basis/RGBA storage is not a valid phone-memory model. This desktop pass provides no
Simulator or physical-phone timing/memory verdict; the phone-memory gate is G269, per the coordinator's ruling.
All owned browser/preview resources closed; no Simulator was acquired.

Immutable scratch artifact: `/private/tmp/claude-501/sp-builders/sp-x5/sf22-approach-proof/attempt-1c807-sibling-teardown-full.json`.
SHA-256 `eb058692e6a9ef3c3ff2589eaf16dc81618578f3f5d0912ca7e6328f4a093e14`.
Detached result `.git/proofs/20261010T000102-sf22-sibling-teardown-1c807-94151.json`; source hashes are in
`harness-1c807.json` alongside the raw artifact. Only this summary is committed.
