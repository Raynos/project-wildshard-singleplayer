# W16/W23/W24: current timing census

Exact source: `441bb32b8202ad230d350060152923e451004e0c`.

The complete local gate passed in 468.95 seconds with 1,478 files,
7,596 passing tests, zero failing tests and the same 20 pending tests.
The JSON reporter supplies test time, separately from import and queue time.

| File | Test seconds |
|---|---:|
| test/proof/compatibility/determinism.test.ts | 46.611 |
| test/shards/driftwood-isle/headless-runtime.test.ts | 26.903 |
| test/shards/nalati-grasslands/headless-taming.test.ts | 21.628 |
| test/generated-workflow.test.ts | 21.056 |
| test/shards/pine-hollow/headless-runtime.test.ts | 19.130 |
| test/shards/far-reach/headless-runtime.test.ts | 18.846 |
| test/grid-render-rings.test.ts | 15.556 |
| test/lint-ratchet.test.ts | 13.290 |
| test/proof/pine-hollow/headless.test.ts | 13.204 |
| test/proof/driftwood-isle/reef.test.ts | 12.534 |

Linux push CI 38184434898 is green on the same SHA. Its eight combined
generation/native-cache/Vitest steps took 161, 250, 296, 337, 341, 347,
320 and 273 seconds respectively (shards 1–8). This is a 2.16× spread;
the figures include preparation, so they are not pure test execution.
The longest job took 396 seconds; checks/build took 258 seconds plus
40 seconds for native web build. Typecheck/lint took 166 seconds total.

The current source census has 1,486 test files, of which 1,432 have
committed duration weights and 54 do not. The duration map was last
refreshed by 64f25a011 at 17:12 UTC; it predates several W12 scheduling
and compiler changes. Not every source test is included in a Vercel tree.

The next complete cached gate, 574417281, passed in 214.21 seconds.
Neither result qualifies the two-minute whole-push target or a one-day
balance proof. Different SHAs and machine activity prevent a causal
before/after claim. Keep every native journey and refusal; collect fresh
per-file CI timings before changing the shard weights.

The next cached source gate, 6258db198, passed in 312.79 seconds.
Its related command names 93 changed input paths, while the JSON reporter
actually records 817 test files, 4,513 passes and six pending tests.
Vitest took 182 seconds; the complete gate took 311 seconds, excluding
the wrapper. Regeneration took 59 seconds and push work took 316 seconds
in the delivery ledger. These fields are recorded separately; do not
sum them into an elapsed delivery duration without their boundaries.

The largest test times in this related run were Driftwood headless
27.864 seconds, generated workflow 24.063, Nalati taming 23.122,
Pine headless 21.263 and Sky headless 19.761. The repeated native worlds
are already prepared once per suite. Preserve independent processes and
real gameplay journeys in the compatibility proof. The generated and
ratchet suites exercise real isolated Git/CLI operations; any fixture
reuse must still start each case from an untouched baseline.

## W27 and the 12-hour delivery census

Window: 2026-10-11 12:24:18 UTC to 2026-10-12 00:24:18 UTC.
The frozen first-parent HEAD is 19809d3e7. Reproduce with
`python3 progress/process/sf74-2026-10-11/measure-delivery-exact.py
--hours 12 --at 2026-10-12T00:24:18Z --head 19809d3e7`
(on one command line). Summary: delivery-exact-20261012.json. The remote-tracking reflog
contains 38 actual update-by-push events in the window. Each delivery
uses the earliest such push of a current first-parent descendant;
commit age uses the committer epoch. No recent push is unmapped, and
there are no negative clock anomalies.

| Measure | Observation | Target |
|---|---:|---:|
| Delivered commits | 397 of 397 | all |
| Commit to origin median | 29.13 min | at most 2 min |
| Commit to origin p90, nearest rank | 119.50 min | at most 5 min |
| Maximum commit to origin | 163.83 min | reported only |
| Serialized regeneration commits | 54 of 397, 13.60% | at most 10% gate/receipt commits |
| Source commits, excluding regeneration | 343 | reported only |
| Source delivery median / p90 | 31.25 / 118.28 min | reported only |

The regeneration classification uses Generated-Source or either the
historical regenerate-committed subject or the current chore(gen) subject; the full gate-only/receipt-only count can
be higher. The latency target is not met. This is a Git-only census, not
the full process audit: lane full suites, lease queues, polling hours,
CI green percentage and a whole day of production age remain open.
The reproducible reader was validated after the measurement quiet release.
The initial census missed 13 current chore(gen) commits because their
Generated-Source field precedes the final attribution paragraph, outside
Git's parsed trailers. This corrected classification preserves all 397
deliveries and their median/p90; the regeneration and source subsets change.

A separate GitHub main push-CI census at 00:30:56 UTC covers the preceding
12 hours completely: 30 runs, all completed, 26 successful and four failed.
The green fraction is 86.67%, below the 95% target. None is cancelled or
in progress in this sample. The latest pushes are green; the four failures
are historical, so this count does not name a new unresolved failure.

## W24: complete gate records in that window

The same 12-hour interval contains 74 gate records. Cached gates have
34 passes and 26 failures: passing wall-time median 187.5 seconds,
p90 377 seconds. Full gates have four passes and ten failures:
passing median 408 seconds, p90 589 seconds. Percentiles use nearest
rank; failing attempts remain in the separate counts. The sample mixes
source changes and machine activity, so it is not a controlled speed
comparison and does not meet the whole-push target.

| Baker | Positive-duration records | Median / p90 seconds | Zero-second records |
|---|---:|---:|---:|
| navmesh | 54 | 55 / 70 | 20 |
| geometry | 52 | 38.5 / 48 | 22 |
| voxel AO | 52 | 35.5 / 44 | 22 |
| Pine coat pages | 15 | 24 / 26 | 59 |
| chunk | 22 | 10 / 11 | 52 |
| Nine physics | 49 | 10 / 14 | 25 |

All rows have 74 records. Zero seconds is the integer timing field;
it can mean a cache skip or an operation rounded below a second.
Do not equate it automatically with a measured cache hit. Gate step
times overlap and must not be added to reconstruct total wall time.

The final 19809d3e7 push ledger records sequential regeneration of
36 seconds followed by 103 seconds for gate and upload. The source
resets its timer between these phases: their 139-second subtotal is
valid, but excludes queueing, batching and lock wait. Its separate
gate record is 100 seconds (101.68 with the wrapper). It does not
qualify the two-minute whole-push target even before those waits.

## W14: measured hook time under the message lock

The same 12-hour window has 76 ordinary-commit pre-commit records:
median 0.254 seconds, nearest-rank p90 5.611 seconds, maximum 8.037
seconds. None exceeds ten seconds and all recorded hooks succeed.
This measures time under the message lock, excluding queue wait;
private-message commit-tree landings intentionally do not take that
lock and do not enter this ledger. It does not prove zero collisions
or close the six-hour contention census. The repair's own hook and
CAS wrapper took 1.09 seconds, a separate measurement.

## W14/W21: six-hour follow-up

Window: 2026-10-11 22:11:33 UTC to 2026-10-12 04:11:33 UTC.
The same read-only reader, `measure-waits.py --hours 6`, emits aggregates
only. Its frozen output is [waits-6h-0411.json](waits-6h-0411.json).

| Measure | Observation |
|---|---:|
| Repository Codex / Claude transcripts | 6 / 4 |
| Foreign Codex sessions excluded | 45 |
| Index-lock error tool outputs | 0 |
| Codex sleep calls | 210 |
| Observed sleep time | 8,719.584 s, 2.42 agent-hours |
| Requested sleep time | 10,430 s |
| Claude Bash poll candidates | 6, 7.632 s |
| Ordinary pre-commit hooks | 47, all successful |
| Hook median / p90 / maximum | 0.244 / 0.362 / 0.458 s |

Authorized quiet-window waits and the standing gate/deploy watch are
included in sleep time. Bash candidates are regex matches, not proof of
an executed polling loop. Transcript spans overlap and can include
copied history, so neither their sum nor the sleep total supplies a waste
percentage. Zero recorded index-lock errors does not prove zero message
collisions. Hook durations exclude queue wait and private-message
commit-tree landings. These limitations keep W14/W21 qualification open.

The following source push, 82b919f09, passes its complete cached gate:
132 seconds internally, 133.56 seconds with the heavy-lane wrapper;
related Vitest takes nine seconds. Commit time is 04:10:30 UTC and the
actual origin update is 04:13:32 UTC, a 182-second delivery. This single
observation exceeds the two-minute median target and supplies no new
12-hour or one-day qualification. Its Linux CI is a separate proof.
