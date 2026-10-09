# SF57 checkpoint workspace: rejected, not shipped

The proposed reusable dictionary/output workspace reduces Chromium allocations but raises settled Simulator WebContent. The coordinator rejected it entirely on 2026-10-09: no source landed and no Debug row remains. This is failed experimental evidence, not a passing SF57 soak or a phone-cap reading.

All five accepted native runs use the same app parent `a81555ed2300205bebae7614f5af174911b09f9e`, public shipped grid, Developer OFF, seed 357, identical real road/cell route through template 1 → 2 → 3. Each cold Safari run clears saved data, samples fixed-PID kernel footprint every second, preserves fresh interval highs, and settles for ten seconds. No GL_INIT wrappers, heap tracking, heap snapshots or vmmap run during native travel. GPU-process footprint is recorded separately, not added to WebContent. Route failures, sampler gaps and load averages remain in the raw files.

| Variant | Drive interval-high peak MB | Settled WC median MB | Load range |
| --- | ---: | ---: | --- |
| Before 1 | 604.885 | 497.905 | 69–188 |
| Before 2 | 530.764 | 489.173 | 34.94–94.94 |
| Eight-second pool 1 | 663.277 | 503.501 | 37–129 |
| Eight-second pool repeat | 621.400 | 536.850 | 39.69–50.18 |
| One-second pool | 607.752 | 548.614 | 34.23–74.96 |

Decimal MB. The first pool result is +5.595 MB settled against Before 1; the repeat and one-second variants are +47.678 and +59.441 MB against Before 2. **The before-only spread is already 489–498 MB settled and 531–605 MB peak.** It must be reported beside rule (b) in the eventual qualifying soak receipt. This small cohort does not identify a stable distribution or explain every transient; it does establish that none of these pool readings is settled-neutral. Accepted runs have no document/GPU loss, no app errors and maximum sample gap 1.01–1.02 s. An additional first after attempt failed before boot with a Runtime-domain discovery error; its empty reading is retained and excluded, never treated as zero memory.

The unchanged codec allocates two 4,194,304-byte Int32 dictionaries when a basis exists, a worst-case output buffer, the native snapshot copy, and a byte copy of a boxed `number[]`. On Chromium, bounded constructor tracing found 20 large allocations / 47.021 MB before vs 15 / 28.428 MB with pooling (−18.593 MB). These are allocation counts in one instrumented route, not resident-memory savings. Chrome heap sampling and snapshots are intrusive, separate from the native ruler.

The raw Chromium profiles are compressed; `heap-extract.json.gz` preserves all nodes ≥64 KiB, available incoming owner edges, raw SHA-256 and heap node/edge counts from the four raw snapshots. Whole 500 MB heap snapshots were not added to the repo (72.6 MB compressed); their complete large-node extracts are retained. Original generated source maps disappeared with owned preview cleanup; the captured mapped large-allocation summaries remain. No causal claim is made from unmapped minified profile frames.

The experimental source patches, counterfactual IDs, staged/interleaved/cancelled byte-equality fixtures and complete validation logs are retained. The final one-second candidate passed 1063 files / 5872 tests (14 skipped), strict typing, root lint and ratchets, and regenerated native checkpoint payloads were byte-identical. Passing tests did not override the negative native result. The workspace code/test was removed from the working tree after rejection; those patches are evidence only.

Next: eliminate the boxed JS physics array with a fresh Uint8Array capture, preserving the exact packed wire, staged freezing, quota retry and latest-generation fencing. One matched native before/after pair is authorized; ship default-on only with a settled-neutral reading, then run one qualifying public cells + road invocation on the pushed fix SHA. SF57 is still open: the latest prior recorded cells verdict failed rule (b), and a regrade is not a new passing soak.
