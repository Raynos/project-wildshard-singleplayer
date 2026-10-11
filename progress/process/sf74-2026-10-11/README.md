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

The repository-scoped W21 remeasurement at 18:10 UTC covers six Codex transcripts and one Claude transcript,
deduplicating tool IDs and excluding 27 foreign Codex sessions. It finds **202 paired Codex sleeps, 9,650 elapsed
seconds (2.68 h)**, versus 9,770 requested seconds. The two Claude Bash regex candidates total 5.85 s; this includes
commands mentioning polling and is not a shell execution measurement. The coordinator's required standing watch
is included, so this cannot classify all sleep as waste or close W21.
The W14 six-hour census covers 4,580 Codex and 166 Claude tool-result records and finds zero actual fatal index-lock
lines. It excludes quoted source code that merely names the error. This covers the available repository transcripts,
not every terminal or automatic pusher output, and does not measure lock hold times; no machine-wide zero-contention
claim follows. Reproduce with `python3 progress/process/sf74-2026-10-11/measure-waits.py --hours 4` (or `--hours 6`).
Only aggregates are retained in [waits-4h.json](waits-4h.json) and [waits-6h.json](waits-6h.json).
A second six-hour sample at **19:17 UTC** finds **one actual index-lock error** across 4,569 Codex and 141 Claude
tool-result records. The affected source-loader commit succeeded on the next attempt after the foreign lock was
released; no lock was deleted. Its 318 paired sleeps total 15,187.6 s across concurrent lanes and include the standing
watch. This is an observed collision, not a lock-hold-time measurement or a waste verdict. The aggregate is retained
in [waits-6h-1917.json](waits-6h-1917.json).

W23's duration refresh `64f25a011` retains all 1,168 previously measured files and adds 266. The actual duration cache
now uses each file's current project. Using these measurements to score both packings, the unit spread falls from
1.47× to 1.00×, and integration from 9.06× to 4.10× (one indivisible file is 48 s). Every one of the 1,434 files appears
once. These are estimates; the next Linux push CI must supply the wall-clock result.

W25 `59fb456cd` adds exact clean-export typecheck, lint, CSS, shard/plugin contract and Node-baker probes, combined
with failed test files. The live mixed lint/test red at `bd3e549ff` identifies `784665f49`, checks regeneration and
all four witness fences, and selects `c318474ff` for the complete gate. Unsupported build/browser failures and stale
historical outputs still refuse a prefix. No regeneration is inserted under shared main. Follow-up `37f609d29`
adds the existing map and six native physics freshness tests before the complete candidate gate. Actual historical
`13547292d` refuses in 37.96 s (11 s of checks), while exact-green `c318474ff` accepts in 21.02 s (4 s of checks).
This prevents newest-red-only probes from admitting an earlier stale bake and wasting another roughly 320-second
complete gate. Regeneration-stale historical prefixes still refuse; that remaining W25 tail stays open.

W28's heavy native sweep at exact `dbcef52f5` passes on matching Node **24.18.1 arm64 and Darwin x64**, in 281 s
including the clean committed export. All seven reports are byte-identical: Nalati's declared partial replay refusal,
Driftwood headless, Pine replay, Signal whole tape, both Nine worker replays and Sky worker replay. The aggregate
hashes/timings are in [native-x64.json](native-x64.json); reproduce with
`node progress/process/sf74-2026-10-11/prove-native-x64.mjs dbcef52f5`.
Sky initially refused on x64 because its recorder and actual worker entry did not install the established portable
math. `dbcef52f5` deliberately records portable checkpoints: the actual arm64/x64 manifest, exact 60-tick worker
replay and whole spawn-to-Roc report match byte-for-byte. Four focused proof tests and typed lint pass. No gameplay,
collider, deadline or assertion changed. This qualifies these native reports on Darwin x64; Linux CI remains a
separate qualification, and Nalati remains partial.

Nightly coverage's authoring inventory/compiler timeouts are addressed by `5077bb26e`, retaining the existing
10/20-second deadlines in the serial integration pool; exact inventory follow-up `40401f178`. Clean focused coverage
passes all 15 tests in 14.86 s; semantic compilation takes 4.93 s. The nightly run itself still needs requalification.
The same commit restores `pnpm gen` before the Linux GPU asset-case build, whose direct bake import otherwise misses
Pine's generated coat JSON. Seven nightly shard parity comparisons remain red; no baseline was recaptured blindly.
Nine's concrete disposal regression has the focused before/after proof and fix `e7c7d5b91`.

## SF60 daily receipt

Production independently serves **c318474-mv44h2ta**, built at **17:54:20.490 UTC**, from exact commit
`c318474fffde4044a8562d81acf681783d9b9537`. Push CI `38158959585`, exact-SHA boot/HOVER smoke `38159367449`, and release
`38161318176` passed. The live commit's What's New card is dated **8 OCT 2026**. A current daily card, every-entry
Simulator playtest/top-ten receipt and one-day hourly release proof are still absent from this receipt.

Backstop `c318474ff` fixes the observed 16:47 dispatch only five minutes after the 16:41 recovery: it checks the same
hourly slot as boot smoke before every attempt, refuses unreadable/API failures, and installs Node on launchd's PATH.
Twenty shell/selector tests pass; real installed dry-run refuses the occupied slot. The shared hourly limit, exact-SHA
proofs and fail-closed selector remain intact. The official backstop dispatched at **17:50:30 UTC**, after the shared
slot explicitly returned free, and shipped the new id above. No subsequent release is allowed before 18:50:30 UTC.

The later [local CPU pressure receipt](cpu.md) records the six-worker cap, nice priority, bounded gate phases,
full before/after timings, JSON top ten and byte-verified export reuse. The local full gate recovered and
`27d583885` reached origin; its 589-second total still fails the push-speed target.
