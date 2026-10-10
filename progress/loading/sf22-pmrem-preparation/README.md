# SF22 initial PMREM preparation

WebKit initial HDR and faceted-sky PMREMs now compile the exact offscreen
variants in painted slices, then execute every original draw in order with a
paint between passes. Captured tone mapping participates in the compile key.
Other browsers retain their synchronous factory path. A retained faceted
PMREM generator delegates normally for later day-clock refreshes. Cancellation
is fenced to the captured construction owner; generators retire on failure.
No shader source, sampler, target format, look or memory cap changes.

## Proof

- Four PMREM/owner/browser-policy fixtures plus four lighting fixtures PASS.
- Strict types and touched root-config typed lint PASS.
- Actual GPU comparison, muted Chromium and WebKit at iPhone 16 Pro dimensions:
  HDR and scene (coloured background + real mesh), 336×128 half-float targets.
  **0 differing half-float values**, nonzero output, **GL error 0** in all four
  comparisons. Each comparison: **2 programs before and 2 after**. The factory
  replay uses the same meshes/materials and exact native shader source.
- Fixture result SHA-256: `9432ece0dd15e8c4c36cfbab020ae5ddc9291bbdb2dd8bf34fff5b743e038d4e`.
  Scratch: `/private/tmp/claude-501/sp-builders/sp-x5/pmrem-pixels/`.
  Earlier fixture-only setup/readback failures carry no parity credit.

This is an exact-output scheduling proof, **not a Safari cadence PASS**. The
matched network-shaped desktop/Simulator route remains the next measurement;
its preceding clean result is in `../sf22-exterior-clean/README.md` (Safari
47/68 ms, 18 draw/driver calls). No local full suite; the serialized push gate
owns the full suite. Downward game→engine +2 defining ports (`offscreenBuild`
and `app/resources`); no new shard-specific branch.

## Matched follow-up: 7eb7bc08c (2026-10-10)

The detached proof completed; **SF22 is still open**. Both muted phone-tier
routes use 5 Mbit/s and the same 3/10-second asset stalls. No refusal, game
error or GL fault occurred. The owned quiet marker covered
12:20:18–12:35:32 UTC and was removed in `finally`; the preview and browsers
closed. Other machine CPU work remained visible in the recorded load.

| Surface / route | Cadence p95 / p99 | Crossing install | Draw/driver compile calls | Verdict |
|---|---:|---:|---:|---|
| Desktop, six G270 routes | 33.4 / 49.9 ms | max 43.2 ms | first crossroads 0; entire route 102 | FAIL install |
| Simulator Safari, Driftwood → Signal → Driftwood | 51 / 81 ms | 24 / 0 / 7 / 0 ms | 16 across the route | FAIL cadence / compilation |

Desktop's 43.2 ms template departure includes a 42.4 ms checkpoint; other
commits are ≤25.2 ms. Standing p95 is 33.4 ms with observed timestamp quantum
0.1 ms, so cadence passes the recorded resolution rule. First-crossroads
explicit warm-ups: 208, max compile invocation 12.3 ms; no overlapping
>50 ms long task. This bounds a warm-up task at 50 ms, not at zero.
Desktop per-route median load: 19.54, 14.21, 16.93, 15.25, 11.40, 9.39;
timing under load remains labelled as such.

Safari's forward / return median load was 28.72 / 20.98. All initial GGX
draw-time compiles disappeared, but 10 other environment-shaped calls,
4 no-fog vertex-colour calls and 2 sword calls remain. Explicit warm-ups: 386,
max compile invocation 7 ms. Safari has no LongTask observer; total warm-up
task duration is **unavailable**, not zero. This subset provides no Pine,
Nalati or Sky memory verdict; the honest image-fallback refusal and G269
physical-phone memory authority are unchanged.

Raw outputs retained outside git:
`/private/tmp/claude-501/sp-builders/sp-x5/sf22-approach-proof/`.
SHA-256 fences:

- `attempt-7eb-pmrem-clean-desktop.json`: `c48a9ccf3a33ddbc8ab2cd291701bb7bb035a49918c317ba4bbd2b4140a5532a`
- `attempt-7eb-pmrem-clean-safari.json`: `8ca5fda15d35054895552f7801920659cc5ebb86b65ad3e3eef6c575511ae76a`
- `quiet-7eb-pmrem-clean.json`: `cb7dfc8720850d9095cb16a1e08ff85967473f6e2e000706e811bd6097064801`

Next: identify the remaining shader owners, then fix the template departure
checkpoint outlier without changing the limit.
