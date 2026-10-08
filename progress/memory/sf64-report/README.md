# SF64 report command (E456)

The command writes `memory-report/1` JSON, a file manifest, and one 1179 × 2556 portrait SVG/JPEG for the road, every requested shard centre and the worst crossing. It runs offline over native-audit receipts; it starts no browser, build, Simulator, Inspector or GL query.

```sh
node scripts/memory-report.mjs \
  --input=progress/memory/sf64-report/input.json \
  --out=/private/tmp/my-memory-report
```

The output directory must be new. `--svg-only` skips rasterization. JPEG rendering uses the existing SDK `sharp` dependency; every JPEG is checked against the 500 KB repository limit. Exit 0 means all requested fields are available, 2 means the report was written with explicit missing evidence, and 1 means invalid input or an I/O/rendering error. Missing data is never converted to zero.

## First report reused

This example imports the committed [first itemized report](../itemized-2026-10-08/README.md), its original classification/confidence rows and its exact native receipts. It does not repeat that attribution work. All original rows, confidence flags, pins, settings, heap sources, vmmap dirty regions and GPU-type subtotals remain in `poses[].evidence.itemized.situation`; native samples/categories/file references remain in `evidence.native`.

| Pose | WC MB | GL MB | WC + GL MB | Margin to 1000 MB |
| --- | ---: | ---: | ---: | ---: |
| Empty road after Nalati | 812.8 | 120.4 | 933.2 | +66.8 |
| Pine centre | 939.5 | 245.7 | 1185.2 | −185.2 |
| Nalati centre | 806.7 | 294.4 | 1101.0 | −101.0 |

These are historical single-cold-run observations, not current-build memory grades or savings claims. Native WC varies by roughly ±50 MB between cold runs; a saving needs at least three valid cold runs per side, medians/spreads and all failures. The example has no continuous crossing peak, no exact resident-RAM owner attribution and no native centre receipt for the other five shards. Those pages explicitly say missing. The first report's Driftwood **spawn** and old mixed-ruler engine baseline remain in the original folder; neither is relabelled as a shard centre here.

The first report's 339–457 MB unassigned RAM findings remain visible. Its RAM rows combine same-run storage capacities and heap estimates transplanted from another process/pin. The new pages therefore mark all historical RAM rows as estimates, keep the original unassigned WC remainder outside the storage allocations, and preserve it separately. Fractional-byte estimate arithmetic is rounded only for the displayed inventory; the original values remain unchanged in evidence. vmmap dirty categories overlap and may exceed physical footprint; they are context, not another additive owner budget.

## Rulers and alignment

`measured` is the native cap ruler: **WebContent physical footprint + same-pose labelled GL**. This follows the isolated allocation control establishing that the two are separate. `accounted.total` is the raw residency allocator sum, not the native total and not a fabricated sum of storage rows. `accounted.allocations`, `storageTotals` and `unattributed` are deduplicated observed storage, or explicitly identified historical estimates. WASM/backing-buffer capacity is not resident physical RAM; capacity rows are never added to WC.

Compared with the first report's 1100 × 2400 combined stack, the new image follows the coordinator's later 1179 × 2556 **GPU | RAM** two-column specification. The 1000 MB red cap line applies to a separate WC + GL gauge, because a cap line on mixed RAM storage estimates would imply a false resident-memory reconciliation. Each inventory brick carries at most 50,000,000 bytes; bytes are preserved exactly, including the last partial brick. Legend rows are sorted by bytes; the full owner/asset list remains in JSON. Engine is slate, platform blue, audio amber, WASM violet, shards use their HUD accents, and unassigned owners are hatched grey. A diagonal overlay marks estimates.

## Input and capture

The command accepts its own `memory-report/1` output or a `memory-report-input/1` manifest. [input.json](input.json) is a complete example. `centres` lists every required shard slug; absent sources produce missing pages. Each pose references `{native:{file,label}}`, an optional per-pose `pin`, an optional `attribution` JSON file containing sp-x1's engine v1 snapshot, and an optional `{itemized:{file,id}}` reference. Alternatively `{name,unavailable:"reason"}` records a known unavailable pose; it cannot coexist with native/owner evidence and hide it. Nine Dragon uses this because it is not in the grid catalogue. All paths resolve next to the input manifest. Plain JSON, gzip and Brotli inputs are bounded to 128 MB compressed and expanded.

The defining owner API is `@wildshard/engine/core/memoryAttribution` (`619c87c4f`), exposed by `__wildshard.memory()`. The shared native audit's getter-safe `snapshotExpression` now captures `memoryAttribution` from that explicit scalar function. Old probes, missing ports and accessors produce `null`, not a zero. The report can also consume that same scalar snapshot from a sidecar file. Resource identities deduplicate shared storage; conflicting copies refuse. No scene traversal or resource-restoring getter is added by this capture port.

A `crossing` manifest entry supplies `{complete:true,samples:[{measured:{wc,gl,total,time,source,pid},glTime,attribution?}]}`. `complete` is the capture harness's explicit attestation that the **whole route** was sampled. At least two samples are required, with one fixed PID, increasing timestamps, no gap above 1.5 s and WC/GL paired within 1 s. The report selects the largest matched WC + GL pair with its corresponding attribution. Interrupted/reloaded routes must set `complete:false`; failed native audits contribute no partial measurements. Settled samples must never be passed as a complete crossing. No complete window means a missing worst-crossing page.

## Validation

Eleven focused tests cover byte-exact bricks/shared identities, separate rulers, native failure/stale-PID refusal, incomplete/mismatched crossing windows, historical confidence preservation, null old probes/getter avoidance, XML escaping, deterministic portrait output, bounded compressed import and the real offline CLI's no-overwrite behavior. Own strict JS checks and typed lint pass. Tests use inline/temporary fixtures and do not depend on `progress/`, which Vercel excludes.

The real example was rendered and inspected at portrait size. Nine JPEGs are 99–262 KB each. Root typecheck during landing was blocked only by the concurrently authored engine memory panel's `string | undefined` rows, reported to its owner; no report type errors. Builders leave generated scripts inventories/API tables to the serialized pusher.

Plan-State: unchanged. This completes the report-command slice; complete new native centre/crossing evidence and <10% resident-RAM attribution remain separate SF64 work, not passes inferred from this example.
