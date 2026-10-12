# W16/W23: fresh Linux weights, every measured file retained

Push CI 38193988948 passed on exact 8891780f1. All eight timing-cache
uploads passed and were downloaded. Their 1,489 unique project/file
entries contain no failures. The weight producer now retains a lone
unit entry for a file placed in integration only under coverage; its
preferred project still wins when both were recorded. The old parser
dropped Nalati taming, Signal headless and shard coupling from this
non-coverage run. All 1,489 measured files now have duration weights.

The real standalone producer fixture passes, including preferred
project collisions, coverage-only fallback and deleted-file exclusion.
Scripts strict, focused test strict and touched typed lint pass. A root
strict attempt hit the foreign missing entryFloors.generated.json;
that source-only working-tree materialization is separate from this
change and the clean committed pusher owns its generation.

The actual old eight cache allocations match packShards exactly.
Using these fresh measurements to score that real allocation and the
new allocation, combined estimated work spread falls from 2.047 to
1.002. Every measured file occurs exactly once in both. This is a
packing estimate, not an observed CI wall-time improvement: unit jobs
run in parallel, integration follows serially, and setup/import costs
remain. The next Linux run must qualify the new weights.

The observed old Vitest steps, including native preparation, took
238, 286, 235, 284, 409, 309, 284 and 159 seconds (shards 1–8): 2.57x
spread. The indivisible 148-second determinism file remains complete;
its independent processes, journeys and refusal checks are preserved.
The two-minute push and one-day release targets remain open.

| Largest measured file | Seconds |
|---|---:|
| proof/compatibility/determinism | 148.031 |
| shards/driftwood-isle/headless-runtime | 78.247 |
| shards/far-reach/headless-runtime | 74.854 |
| shards/nalati-grasslands/headless-taming | 67.533 |
| shards/pine-hollow/headless-runtime | 66.327 |
| lint-ratchet | 57.216 |
| grid-render-rings | 48.756 |
| generated-workflow | 44.905 |
| proof/pine-hollow/headless | 43.483 |
| author-brief | 39.195 |

Reproduce weights from all eight exact-SHA artifacts with
scripts/vitest-durations.mjs; retain each cache as a separate input.
The aggregate allocation evidence is in linux-packing-889.json.
