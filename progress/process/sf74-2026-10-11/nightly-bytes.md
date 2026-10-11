# Nightly coverage byte-comparison receipt

The exact `2fa93fa60` milestone coverage run `38170057725` timed out
in nine files. Four of them traverse large binary payloads through
Vitest's deep matcher. Native byte equality removes that traversal while
retaining every generated asset byte, length, independent scene run and
geometry channel. Cove attribute constructors and raw byte ranges must
also match; index values/order and all placement assertions remain.
All test and hook deadlines are unchanged.

Covered local measurements on 11 October 2026, with the push gate active:

| Complete test | Before | After |
|---|---:|---:|
| Pastel props, every immutable asset | 5.271 s | 0.460 s |
| Template props, every immutable asset | 5.294 s | 0.448 s |
| Template synth, two independent runs | 4.902 s | 0.147 s |
| Cove terrain/channels/GLBs/placements | 4.294 s | 0.180 s |
| Cove independent disposal/mutation | 2.027 s | 1.399 s |

All 14 tests in four files pass under V8 coverage. The three-file run
takes 10.14 → 5.23 s; the Cove run takes 10.17 → 4.09 s. Each pair's
complete per-file engine coverage summary is identical, including lines,
statements, functions and branches. Root strict and touched typed lint
pass. These are local timing receipts; Linux milestone requalification
is still required, and the other five timeout files remain open.

Commands: `pnpm exec vitest run` with the four named test paths,
`--coverage --coverage.reporter=json-summary --reporter=json`, before
and after the assertion changes. Reporter durations include each test's
complete producer execution, not just its byte comparison. No output,
baseline, runtime implementation or coverage ratchet changed.

## Commit message ownership

`b87365957` fixes the reproduced concurrent-private-index Git message
race. A disposable repository without the lock committed B's file with
A's message/model. The protected overlap, bounded timeout and aborted
owner fixtures retain the winning file's message/model, identify the
holder, and release the kernel lock on process exit; 6.12 s for all three.
Actual project pre-commit runs under the lock recorded 0.256, 0.262 and
6.366 s. Queue wait is excluded. No long hook stall was observed in these
three samples; this is not a machine-wide duration bound.

## SF60 later production receipt

Production independently serves `1d378b7ba-mv49rdxs`, built at
20:22:16.525 UTC, from `1d378b7ba2af5119d1f10a2366f8ffbc8003abe7`.
Push CI `38169957234`, exact commit boot-smoke status/run `38170546865`
and release `38171224015` are green. Checked again at 20:54 UTC.
The release run's workflow head is not used as the production proof pin.
The daily playtest and one-day release targets remain unqualified.
