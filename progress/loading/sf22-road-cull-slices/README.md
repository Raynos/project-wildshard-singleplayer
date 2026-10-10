# SF22: slice exact road admission and culling work

The source-mapped CPU diagnostic on `a45eb30e15796a6b60213ad6436f1b05c7d27b2b`
found a 503 ms initial-boot task dominated by road clipping/counting and construction
(`roadCull.ts`, `roadLook.ts`). The earlier 25aa82889 slice addressed the separate
native seam certification tasks (109–151 ms in this pre-fix capture).

The road now yields within its exact pre-allocation counts, triangle clipping,
attribute copies and bin/LOD sorting. `GridSession.create` consumes the same ordered
builder with a 12 ms cooperative work budget and a paint between batches. Admission
still happens before each allocation; failure/cancellation releases resources before
the claim, and incomplete meshes remain outside the scene. Synchronous callers drain
the same arithmetic. No collision, material, sampler or geometry law changes.

Focused proof: 17 checks across road bytes, road view budgets and render residency.
The real native platform's synchronous/sliced final attributes, indices, sorted LOD
sources and allocator entries match exactly; the zero-budget runner pauses over 100
times and publishes only completed culled meshes. Refusal advances no builder;
late failure, cancellation and parent disposal release their claims. Touched lint and
strict checking with committed public package exports pass (the shared package files
carry unrelated stale export edits). No full suite or input-only witness refresh.

This is a scheduling slice, not a measured post-fix task-time pass. One batch and
unsliced material/texture construction can exceed the cooperative budget. The
remaining boot/entry measurements need a build containing this slice.

## Exact pre-fix CPU attribution

Muted Chromium/Metal, phone tier at 2x, Developer off, Memory saver off; the same six
G270 routes and 5 Mbit/s shaping with 3/10 s stalls. Version `a45eb30-mv226rti`;
the exact compiled files and their maps were retained before preview teardown.
One-minute load ranged 11.7–43.1. Twelve transitions, six routes, no refusals/errors.
CPU profiler and diagnostic wrappers were enabled: no normative cadence credit.

| Task | Attribution / remaining action |
| --- | --- |
| Boot 503 ms | Road clipping/counting/building; addressed by this slice, browser re-measurement open |
| Boot 149 / 109 / 136 / 151 ms | Native seam certification; addressed by 25aa82889, browser re-measurement open |
| Boot 132 ms | Probe fingerprint SHA; harness-only work, ordinary boot fingerprint remains lazy |
| Boot 103 ms | Audio graph / context construction; exact loading-versus-gesture boundary remains open |
| Boot 384 ms | Driver program-info reads (237.4 ms sampled self time); rendered-loop warm-up gap remains open |
| Signal first entry 61 ms | `texSubImage2D` 43.5 ms sampled self time; zero shader compiles, texture identity still open |
| Signal preparation 125 ms | Dune builder on this pin; check current tiles-only ownership before further changes |

Sampled CPU self/inclusive attribution is not an exact task-duration allocation.
The route has zero draw/driver/unclassified shader compiles, but one warm-up-containing
task is 60 ms, so this instrumented run fails the 50 ms warm-up-task gate. Its longest
individual precompile invocation is 12.8 ms; that does not excuse surrounding task
work. Preparation completed 113.5–126.4 ms before the five retained activations.
Memory remains the physical-phone G269 verdict, not a Chromium or forced-compressed
Simulator claim.

Raw diagnostic stays in the lane scratchpad, SHA-256
`10031dcf196b893df2654e7ccbb5c55d764f2bffe4a28fd836dac980a435f80f`.
