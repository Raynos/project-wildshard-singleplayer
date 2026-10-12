# SF60: recovered push context reaches production

Production independently serves **92c179a16-mv4p42in**, built at
2026-10-12T03:32:00.711Z, from exact source
92c179a1673228ce7067bf1d7019a80e94552df3.

- Exact push CI [38197826454](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38197826454) succeeded at 03:03:57 UTC: all eight
  Vitest shards, strict, typed lint and build passed.
- Exact boot/HOVER smoke [38198281655](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38198281655) published boot-smoke success at
  03:13:28 UTC after both real macOS legs passed.
- Release [38199898501](https://github.com/Raynos/project-wildshard-singleplayer/actions/runs/38199898501) selected that exact source at 03:29:26 UTC,
  verified production at 03:32:58.536 UTC and completed successfully.
  Its workflow head was the docs-only 51caa44ae, not the deploy pin.

The :17 scheduled run had not appeared. At 03:28:43 UTC the actual
selector reported ready, the shared release-slot check reported free,
and production still served 8891780f1-mv4mxtt3. One authorized fallback
was dispatched at 03:28:45 UTC, more than an hour after the prior
02:27:52 dispatch, with no active or queued release. No force flag,
direct Vercel deployment or second dispatch was used. The next manual
slot is no earlier than 04:28:45 UTC; a later scheduled release can
extend that deadline.

| Exact source proof to verified production | Time |
|---|---:|
| Commit at 02:53:59 UTC | 38 min 59.5 s |
| CI green at 03:03:57 UTC | 29 min 1.5 s |
| Smoke green at 03:13:28 UTC | 19 min 30.5 s |
| Release dispatch at 03:28:45 UTC | 4 min 13.5 s |

The GNU startup red at 39c838c177 is fixed by 92c179a167, owner sp-x7.
Its complete local gate passed in 147.02 seconds. The subsequent
cadence-triggered full gate at c73fe79e9 passed all 7,628 tests, with
six workers and zero failures, in 490.60 seconds. The qualification
receipt 51caa44ae reached origin with a 115.77-second cached gate.

This is one proven release within an hour of its source commit, not a
one-day cadence qualification. The two-minute delivery target, daily
card and every-entry playtest/feedback receipts remain open. The older
[nightly GPU attribution](nightly-attribution.md) retains its residual
reds; newest-ci-green does not treat that run as a release proof.
