# SF64 missing-pose capture plan

Approved by wildshard-new, 2026-10-08. Prepared Node-only while the Simulator is reserved for sp-x4's Pine P0 proof. No build, game browser, Inspector or Simulator was started for this preparation. Launch waits for the coordinator's explicit queue handoff and selected post-fix pin.

## Common ruler

- One committed pin/build for all new captures; record the source SHA, served `version.json`, actual boot identity and effective settings. Phone tier, 2× render scale, Auto texture policy, Developer ON, Memory saver ON, muted, seed 357.
- One Simulator through `sim-lane.sh`, one muted browser through `browser-lane.sh`. One Inspector connection; no heap collection, forced GC, continuous GL mutation journal or auxiliary rendering workload.
- Fence the measurement document by its random token, retain time-origin drift as diagnostic context, and bind the dominant admitted WebContent PID once. Never substitute another PID after admission or accept a new document as continuation.
- At each actual centre: verify the expected resident/current cell and gameplay readiness, actual world/local feet, ground/support and no recovery. Stand still, then take three fresh one-second native kernel samples. Capture same-pose labelled GL and the optional scalar `__wildshard.memory()` ledger; keep native WC, labelled GL, raw allocator accounted bytes and storage capacities separate.
- Read `vmmap -summary` on that same PID after the original pose samples. Detailed `vmmap -v`, `footprint` and passive memory categories follow only if needed; their overhead cannot change the already sampled ruler. Preserve native categories and paths in the report.
- One valid cold route per case fills coverage, not a savings claim. Record every failed attempt, its final document/recovery state and last native/GL pair. A native saving would still require ≥3 valid cold runs per arm, medians/spreads and failure counts.

## Routes

| Cold case | Real route and pose | Report name |
| --- | --- | --- |
| A | Enter the owned Driftwood home normally, walk from its authored spawn to local `(0,0)`, verify feet/ground and sample. This is a new centre reading; the old spawn receipt is not relabelled. | `driftwood-isle-centre` |
| A continued | Follow the existing template floor route through midpoint turn-ins/crossroads. Resolve the actual `_template` instance from the live catalogue, then continue from the inner entry to its local `(0,0)`. Record both slug and stable copy instance. | `_template-centre` |
| A continued | Drive back to the permanent road, confirm no region resident after retirement, then sample. | `road` |
| B | Reuse the proven `sky-entry` north socket → rising islet → dock/gate → bridge route. From the island lip continue to the central Sunrest island's actual centre, using the live `entry.isle` coordinates and ground height. The old `sky-island` bridge-end pose is not called the centre. | `far-reach-centre` |
| C | Reuse the proven Signal Dunes midpoint socket route, then continue to local `(0,0)`. Its authored spawn at local `(0,70)` is a separate optional check, never the centre substitute. Return and re-enter through real input if needed for a crossing leg. | `sunscar-dunes-centre` |

Only an initial declared source/road approach may use the existing harness's staging port. All sampled seam crossings, lifts, bridges and travel inside a cell use real input/collision. A route that cannot reach supported centre ground fails with its trace; it does not teleport, flatten terrain or substitute an entry/spawn pose. Current catalogue placement determines cell origins and the chosen template copy; no display label is used as a cell identity.

Nine Dragon centre stays explicitly **missing: not in the grid catalogue**, per the coordinator's decision. Historical Pine and Nalati receipts remain provenance-labelled until a same-pin centre capture is available; no claim that a mixed-pin report is a new whole-build grade.

## Worst matched crossing

Capture the full measured seam leg, including source departure, the load/retirement wait and destination readiness. A read-only scalar observer runs while the existing fenced input driver moves: timestamped labelled-GL totals and the optional owner ledger, without scene walks, heap/GC, mutation callbacks or new GL allocations. Pair each fresh native sample to the closest scalar observation within 1 s, using the fixed admitted PID. Preserve both timestamps, token, time-origin drift, leg name, feet/current cell and readiness. No sample uses phase-wide retained highs as if simultaneous with later GL.

The match must cover the whole leg: at least two samples, increasing timestamps, no native/observer hole above 1.5 s, one document token/PID, no recovery or context loss, and settled source/destination witnesses. Frame-blocking admission that prevents observation creates a **missing interval**, not an interpolated peak. A kernel-only maximum cannot be combined with a different-time GL maximum.

Select the largest matched WC + GL pair across **all completely observed legs in this A/B/C capture suite** and retain that sample's ledger. Name the route scope in the evidence; it is the worst observed crossing in this suite, not a guarantee about unvisited routes. If any intended leg is incomplete, keep its failure/window and mark the suite's global worst-crossing page missing; a complete-leg maximum may remain diagnostic evidence. Never replace it with the biggest settled pose.

## Commands and regeneration

Use the shared native harness and a new report-only route/observer seam; existing `full`, `pine-centre`, `sky-entry`, `sun-entry` and public-cohort behavior stay unchanged. Node fixtures must check actual centre coordinates/copy identity, cold-route coverage, null old-ledger behavior, nearest-time pairing, sample/PID/token loss and incomplete-window refusal before launch.

```sh
# Exact report-only mode/output paths are recorded with the capture source SHA before the queue handoff.
scripts/browser-lane.sh --max 20 scripts/sim-lane.sh run --max 20 wildshard-iphone \
  node progress/memory/g227-budget/native.mjs BASE OUT_JSON OWNED_DIST REPORT_MODE on

node scripts/memory-report.mjs --input=CAPTURE_MANIFEST --out=NEW_REPORT_DIRECTORY
```

Store the compact raw reports, native samples/categories, route/failure witnesses and per-pose ledger under this receipt. Update the manifest to point to actual centre labels and the fully matched crossing window, then regenerate all JSON/SVG/JPEG pages. Inspect the portrait pages; JPEGs must stay ≤500 KB. Close Safari/Inspector/proxy/sampler and explicitly release the Simulator before reporting the result.

Plan-State: unchanged. This is the prepared capture plan, not completed native evidence.
