# SF60 daily release receipt: shipped preview recovery

Production reports `0a8cb8d-mv4udq2c`, built at
2026-10-12T05:59:31.486Z and independently read after 06:00 UTC.
The exact full pin is 0a8cb8d8f8292d43eebe81968d97374e0eabc33f.
The production-live status succeeds at 06:00:08 UTC; release
38210106848 succeeds at 06:00:12 UTC.

| Proof | Exact time or cost | Result |
|---|---|---|
| Source commit | 05:24:45 UTC | 0a8cb8d8f |
| Full local gate | 505.72 seconds | Green |
| Full local Vitest | 347.32 seconds | 7,633 passed, zero failed; 20 existing skips |
| Commit to origin | 9 minutes 16 seconds | Origin has the source at 05:34:01 UTC |
| Linux CI 38208490517 | 05:40:47 UTC | All eight shards, typecheck/lint and build green |
| Exact smoke 38208995451 | Status at 05:49:28 UTC | Boot and all four HOVER cases green |
| Manual release 38210106848 | 05:55:41 UTC | Success, exact pin verified live |

HOVER finishes in 8 minutes 25 seconds, within its unchanged 12-minute
limit. Runner/cache differences prevent an isolated speed claim against
the earlier 10-minute-56-second pass. Both completed exact proofs verify
the preview repair, without changing mount, unmount or error assertions.

Source commit to verified production is 35 minutes 23 seconds. CI to
verified production is 19 minutes 21 seconds; smoke to production is
10 minutes 40 seconds; dispatch to production is 4 minutes 27 seconds.
This individual release meets the one-day target; the complete-window
target and reliability accounting remain open.

Dispatch follows the prior release by 60 minutes 49 seconds. Immediately
before it, release-ready names this exact proven SHA, release-slot is
free, no release is queued/running, and the independent live reading
still reports 5f780a93a-mv4s89ks. The exact smoke previously declines a
second dispatch while the hour is occupied. Cron has not produced a
new schedule run since 01:24 UTC; this is the authorized hourly fallback.

The automatic full gate has six measured Vitest forks, all nice 10, on
18 cores. Load is 9.79 / 7.15 / 6.88 during the sample. Peers are idle:
this is not a controlled comparison with the reported earlier load 53.
The two-minute gate target is open; the full gate costs 505.72 seconds.

All 1,495 exact Linux project/file timing entries have zero failures
and no duplicate entries. The generated-workflow file is 51.364 seconds
versus the earlier 66.308 seconds; runner and source differences remain
confounders. Its thirteen existing cases are retained, plus one real
Git/source/dependency isolation case. The latest ten largest files are:

| Project/file | Seconds |
|---|---:|
| integration:test/proof/compatibility/determinism.test.ts | 152.600 |
| unit:test/shards/driftwood-isle/headless-runtime.test.ts | 83.543 |
| unit:test/shards/far-reach/headless-runtime.test.ts | 73.368 |
| unit:test/shards/nalati-grasslands/headless-taming.test.ts | 66.266 |
| unit:test/shards/pine-hollow/headless-runtime.test.ts | 64.654 |
| unit:test/lint-ratchet.test.ts | 53.964 |
| unit:test/generated-workflow.test.ts | 51.364 |
| unit:test/grid-render-rings.test.ts | 49.022 |
| unit:test/author-brief.test.ts | 38.200 |
| unit:test/arch-guards.test.ts | 37.295 |

Raw compact scalar observations are in [daily-release-0a8.json](daily-release-0a8.json).
No application exports or downloaded timing archives are retained.
The source and tests are unchanged after qualification. Historical GPU
parity residuals, Pine short-p95, Linux restore attribution and the
whole-window targets remain open. No baseline acceptance, witness
recapture, timeout, worker, assertion or selection change accompanies
this receipt. The shared index is clean; foreign source deletions stay
with their owner. STATE remains the coordinator's file.
