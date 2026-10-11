# SF74 follow-up and SF60 daily receipt — 11 October 2026

Measured at 17:10 UTC over the preceding 12 hours. The speed and one-day release targets are **not qualified**.
Sources: committed Git history, origin/main's local reflog, `.git/gate-timings.jsonl`, `.git/push-timings.jsonl`, and
GitHub's deploy workflow API. Reproduce the original census with
`python3 progress/process/audit-2026-10-09/measure.py --hours 12 --ci`.
The latency below uses commit timestamps and the first observed origin update containing each commit; it excludes
unpushed commits. Timing records count repeated failed attempts too. CI percentages count completed push runs only.

| Measure | Observation | Target / verdict |
|---|---|---|
| Commit → origin | 357 reached commits; median 45.8 min, p90 178.4 min | ≤ 2 / ≤ 5 min: red |
| Cached gate | 47 attempts, median 317 s, p90 341 s; 21 green / 26 red | ~90 s: red |
| Full gate | 18 attempts, median 349.5 s, p90 382 s; 3 green / 15 red | ~90 s: red |
| Regeneration | Median 46.5 s, p90 87 s across 116 push records | Still adds material delay |
| Dominant gate steps | Vitest median 314 s; shardfiles 97 s; lint 84 s; x64 digests 34 s | Test execution dominates |
| Regeneration commits (W27) | 51 / 371 commits, 13.7% | Regeneration alone exceeds the 10% paperwork ceiling |
| Push CI | 16 green / 5 red, 76.2% | ≥ 95%: red |
| Latest three green CI test spreads (W16/W23) | 359–491 s (1.37×), 259–380 s (1.47×), 220–472 s (2.15×) | No day-long balance proof |

The 51 regeneration commits touched Sky witness inputs 40 times, Driftwood 36, Pine 34, Nine 29, ratchet debt 29,
layer edges 25, King collision input hashes 14 and script inventory seven. These counts overlap. Downward shard graph
rows are already excluded; the remaining churn is largely witness provenance and other retained gates. This census
requires no new allowance or removal of a proof.

The original transcript census records 5.2 hours of explicit Codex sleep. It does not distinguish the coordinator's
required standing first-responder watch from wasteful proof polling, so it cannot close W21. W14 likewise remains
open: the tool-output lock census found no matching index-lock errors, but has not independently qualified transcript
coverage or measured lock hold times. No zero-contention claim follows from that count.

W23's duration refresh `64f25a011` retains all 1,168 previously measured files and adds 266. The actual duration cache
now uses each file's current project. Using these measurements to score both packings, the unit spread falls from
1.47× to 1.00×, and integration from 9.06× to 4.10× (one indivisible file is 48 s). Every one of the 1,434 files appears
once. These are estimates; the next Linux push CI must supply the wall-clock result.

W25 `59fb456cd` adds exact clean-export typecheck, lint, CSS, shard/plugin contract and Node-baker probes, combined
with failed test files. The live mixed lint/test red at `bd3e549ff` identifies `784665f49`, checks regeneration and
all four witness fences, and selects `c318474ff` for the complete gate. Unsupported build/browser failures and stale
historical outputs still refuse a prefix. No regeneration is inserted under shared main. W25's stale-prefix tail
therefore remains open.

Nightly coverage's authoring inventory/compiler timeouts are addressed by `5077bb26e`, retaining the existing
10/20-second deadlines in the serial integration pool; exact inventory follow-up `40401f178`. Clean focused coverage
passes all 15 tests in 14.86 s; semantic compilation takes 4.93 s. The nightly run itself still needs requalification.
The same commit restores `pnpm gen` before the Linux GPU asset-case build, whose direct bake import otherwise misses
Pine's generated coat JSON. Seven nightly shard parity comparisons remain red; no baseline was recaptured blindly.
Nine's concrete disposal regression has the focused before/after proof and fix `e7c7d5b91`.

## SF60 daily receipt

Production independently serves **8a29173-mv421b2l**, built at **16:46:02.240 UTC**, from exact commit
`8a29173dd15159bccd36e606b525a743c6d6f97f`. Push CI `38154910894`, exact-SHA boot/HOVER smoke `38155362519`, and release
`38156525798` passed. The live commit's What's New card is dated **8 OCT 2026**. A current daily card, every-entry
Simulator playtest/top-ten receipt and one-day hourly release proof are still absent from this receipt.

Backstop `c318474ff` fixes the observed 16:47 dispatch only five minutes after the 16:41 recovery: it checks the same
hourly slot as boot smoke before every attempt, refuses unreadable/API failures, and installs Node on launchd's PATH.
Twenty shell/selector tests pass; real installed dry-run refuses the occupied slot. The shared hourly limit, exact-SHA
proofs and fail-closed selector remain intact. No extra release was dispatched for this measurement.
