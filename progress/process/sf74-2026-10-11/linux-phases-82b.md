# W16/W23: exact Linux phase evidence, balance still open

Push CI 38202915035 passes on exact 82b919f09158dc79febeac8a43699e05d4ba5bf1.
All eight downloaded timing artifacts contain 1,494 unique project/file
entries, no duplicates and no failing files. No extra suite supplied them.

| Shard | Files | Generation, native preparation and Vitest seconds | Whole job seconds |
|---|---:|---:|---:|
| 1 | 184 | 269 | 326 |
| 2 | 187 | 187 | 242 |
| 3 | 187 | 170 | 215 |
| 4 | 187 | 215 | 265 |
| 5 | 187 | 274 | 325 |
| 6 | 187 | 332 | 381 |
| 7 | 187 | 324 | 367 |
| 8 | 188 | 388 | 429 |

The combined step spread is 388 / 170 = 2.28x. File durations can
overlap in the parallel pool, while integration runs after that pool
drains and is serial. Their summed weights are not job wall time.
Runner and cache state also differ; this is no isolated regression or
improvement claim. The allocation and phase data are preserved in
[linux-phases-82b.json](linux-phases-82b.json).

| Largest measured file | Seconds |
|---|---:|---:|
| integration:test/proof/compatibility/determinism.test.ts | 117.835 |
| unit:test/shards/pine-hollow/headless-runtime.test.ts | 69.309 |
| unit:test/generated-workflow.test.ts | 66.308 |
| unit:test/shards/driftwood-isle/headless-runtime.test.ts | 54.235 |
| unit:test/lint-ratchet.test.ts | 52.600 |
| unit:test/shards/nalati-grasslands/headless-taming.test.ts | 52.463 |
| unit:test/grid-render-rings.test.ts | 49.230 |
| unit:test/shards/far-reach/headless-runtime.test.ts | 45.063 |
| unit:test/author-brief.test.ts | 40.006 |
| unit:test/shards/sunscar-dunes/headless-runtime.test.ts | 36.158 |

The next push prints CPU/core availability plus separate generation,
native-cache preparation and Vitest wall seconds in each existing job
log. The same three commands, test selection, serial integration pool,
workers, assertions and deadlines remain intact. A failed command still
aborts the default GitHub Bash step before the following receipt.
Actionlint and whitespace checks pass. The previously passed immutable
tooling-path proof is reusable: all source/tooling/asset inputs read by
check-paths remain byte-identical to 82b919f09; this changes workflow
logging and receipts only. Real private-index hooks also run at landing.

Further phase balance, the two-minute push and the one-day release
targets remain open. Preserve the determinism suite's independent real
processes and gameplay journeys; its large file time is not permission
to reduce coverage or raise a timeout.

## First two completed phase receipts

The logging slice is now qualified by two successful exact Linux push
runs: 38204511958 on 5f780a93a and 38205581726 on 7250a95cc. All eight
jobs in both runs report four cores and four available processors.

| Shard | 5f780 generation / native / Vitest seconds | 7250 generation / native / Vitest seconds |
|---|---:|---:|
| 1 | 17 / 2 / 328 | 15 / 2 / 250 |
| 2 | 17 / 2 / 237 | 17 / 2 / 231 |
| 3 | 14 / 1 / 196 | 17 / 2 / 254 |
| 4 | 11 / 2 / 160 | 17 / 3 / 250 |
| 5 | 14 / 2 / 200 | 16 / 3 / 257 |
| 6 | 17 / 3 / 259 | 18 / 3 / 263 |
| 7 | 17 / 2 / 237 | 17 / 2 / 237 |
| 8 | 17 / 3 / 304 | 18 / 2 / 302 |

Vitest wall-time spread is 2.05x in the first run and 1.31x in the
second. Generation and native preparation do not explain the larger
test-phase spread. The allocation algorithm and worker settings are
unchanged between these runs; the latter adds one real preview fixture.
Runner, cache and contention differences remain confounders. These
numbers do not prove an allocation improvement or justify replacing
weights from a single run. The compact job IDs and raw scalar receipt
lines are preserved in [linux-phases-two-runs.json](linux-phases-two-runs.json).
