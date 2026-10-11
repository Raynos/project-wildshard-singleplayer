# Nightly static compiler receipt

The static documentation compiler now runs in the actual Node binary,
outside V8's runtime coverage collection. The fixture calls the existing
`apiSurface` and `checkAuthoringExamples`: every package/context, exact
source and strict compiler option remains. Gameplay examples still run
under coverage in the parent. A malformed typed example still fails with
the same semantic diagnostic. The existing 10/20 s deadlines also bound
the subprocesses; no timeout increased.

The fresh transported inventory is exactly equal to the direct API:
2,456 engine, 556 format, 1,020 game, 497 SDK and 15 commons bindings;
16 LevelContext and 20 ShardContext members. This is the entire inventory,
including engine/game, rather than only the documentation's SDK tables.

Local five-file V8-covered proof, under `nice -n 10`, 11 October 2026:

| Complete static test | Before | After |
|---|---:|---:|
| All retained documentation examples, semantic compilation | 8.169 s | 2.710 s |
| Executing native author proof, semantic compilation | 4.860 s | 2.281 s |

Both runs pass all 39 tests. Whole proof wall time is 62 → 47 s, including
the real Nalati five-round bond/worker continuation, Signal native tapes,
seven-shard type-aware coupling and every documentation example/refusal.
No native tape, checkpoint or assertion changed. Root strict, touched
typed lint and actual full-inventory transport comparison pass.

Every engine file's covered line, statement, function and branch count
is identical between the two runs (4,653 / 6,704 / 989 / 3,615 overall).
The complete coverage summaries differ only in uncovered totals of two
concurrently edited rendering files, compressedUpload and precompile.
This receipt therefore claims unchanged covered counts, not identical
whole summaries or controlled machine conditions. Linux nightly coverage
still needs requalification.

Reproduce with `pnpm exec vitest run --coverage` and the five files:
`test/authoring-docs.test.ts`, `test/author-proof-bundle.test.ts`,
`test/shard-coupling.test.ts`, and both Nalati headless-taming and Signal
headless-runtime tests. Use the JSON reporter for per-test durations and
json-summary coverage for all per-file counts.
