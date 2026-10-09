# SF57: native snapshot bytes without a boxed physics array

Default-on is authorized by wildshard-new after three checks: source-mapped allocation shows the boxed array gone, an error-free native after reading sits inside the before spread, and stored bytes are identical. The rejected dictionary pool has no source, timer or Debug row in this change (its separate rejected receipt remains `checkpoint-workspace-2026-10-09/`). This is the checkpoint optimization proof; the qualifying soak is the next step, still open.

`snapshotSimHostBytes` captures the same metadata and freshly owned Rapier Uint8Array. The optional durable `LiveGridPorts.saveBytesSteps` passes it to the existing staged region writer; plain snapshot/restore/cache consumers keep their existing array API and wire. One byte copy freezes the typed input before the first serializer pause, preserving staged mutation/interleaving/cancellation semantics. No multi-megabyte `number[]`, pooled dictionary/output capacity, timer, retained cache or new whole-string copy is introduced. The codec, compression choices, dictionary allocation, wire string and durable write/refusal/generation fences are unchanged.

## Same-parent matched pair

Before `93640b1585406b167efe8d83fd35d9f9f4b2b885`; after `474f3fbf7b240c30ff0c004209f82817438d57a1` has that sole parent and the ten listed source/test paths only. One cold Simulator run per arm, same owned device/public shipped grid/Developer OFF/seed357/three real route legs, fixed game PID sampled every second with fresh interval highs. No heap snapshots, GL_INIT hooks, WebKit heap tracker or vmmap during the native readings. Chromium allocation sampling is a separate pair with no heap snapshots or forced GC.

| Measurement | Before | After |
| --- | ---: | ---: |
| byteArray source-mapped sampled self allocation | 22,591,036 B | 0 B |
| Drive WC interval-high peak | 640.225 MB | 516.624 MB |
| Settled WC median (10 samples) | 538.407 MB | 505.925 MB |
| Settled WC interval-high | 575.803 MB | 509.841 MB |
| Maximum native sample gap | 1.02 s | 1.02 s |
| Load min / max / mean | 17.73 / 33.07 / 26.92 | 61.49 / 142.41 / 106.75 |
| App errors / native losses | 0 / 0 | 0 / 0 |

Decimal MB; fixed game PIDs85599 /40225. GPU-process measurements are retained separately, never added to WC. Both Chromium routes have zero witness failures/errors. `byteArray` uses an array literal sized via `.length`, so constructor interception alone cannot see it: the direct disappearance proof is the source-mapped sampling at `snapshotPhysics.ts:23`, corroborated by the typed-capture/native restore fixtures. Constructor rows are additional bounded evidence, not an Array count assertion.

The settled delta is −32.481 MB and peak delta −123.601 MB in this pair, **not a stable causal saving estimate**. Historical before controls alone ranged489–498 MB settled /531–605 MB peak; with this current-parent control the observed settled-median spread is489–538 MB and peak531–640 MB. The earlier559 MB figure was a phase maximum, not a median. Report these spreads alongside the eventual soak's rule(b). The after falls inside the before spread and retains no workspace by construction; this meets the coordinator's explicit default-on criteria. It does not prove physical-iPhone cap clearance or a distribution from a single pair.

## Validation

Clean export, pnpm gen, all three native checkpoint bakes, export-only central generation, root strict, root-config oxlint, ratchet, full Vitest via heavy-lane ticket1058: **1065 files /5885 passing tests /14 skipped**, 113.32 s test duration. Clean layer-project build also passes. All11 native `.snap.gz` payloads are byte-identical; only three input manifests refresh. Latest-HEAD rebuilding also preserves all11 payloads, including the separately landed Pine resin/pack witness (297e99d6e); no stale Pine checkpoint is restored by this change.

Focused fixtures cover actual Rapier capture/restore with and without basis, exact wire, byte subview mutation after first pause, interleaved/cancelled jobs, byte bounds, staged no-write-until-end, quota refusal/retry, frozen worlds/re-entry and durable-only ownership with no cache. Real muted phone-profile boot smoke passes Driftwood(3.806 s), Pine(11.143 s), Signal Dunes(3.856 s) and grid(8.984 s), all faults0. Raw JSONs/logs/source-mapped profiles and exact diagnostic patch are retained here.

Next: coordinator pushes the source, then ONE qualifying shipped-layout cells + road invocation on that pushed SHA, catalogue route, light observer/raw OFF, footprint-only/no per-pose vmmap. Record the tool's verdict; do not regrade to close SF57.
