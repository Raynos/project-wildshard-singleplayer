# SF60 daily release receipt: 12 October 2026 UTC

Production reports `5f780a93a-mv4s89ks`, built at
2026-10-12T04:59:16.986Z, independently read at 05:00:17 UTC. Its exact
full pin is 5f780a93a9e18c633dc2485c05571047176c43a2; the successful
production-live status is published at 04:59:58 UTC.

| Proof | Exact pin or time | Result |
|---|---|---|
| Source commit | 04:34:00 UTC | 5f780a93a |
| Local cached gate | 118.89 seconds, both receipt commits | Green |
| Push CI 38204511958 | 04:43:46 UTC | All eight test shards, typecheck/lint and build green |
| Boot smoke 38204968369 | Exact status 04:54:40 UTC | Boot and all four HOVER cases green |
| Automatic release 38205706682 | Dispatched 04:54:52 UTC | Success; exact pin verified live |
| Production-live status | 04:59:58 UTC | Green |

Source commit to verified production is 25 minutes 58 seconds. CI to
verified production is 16 minutes 12 seconds; smoke to verified
production is 5 minutes 18 seconds; dispatch to verified production is
5 minutes 6 seconds. This individual release meets the one-day target;
it does not close the target across the full observation window.

The HOVER job runs 10 minutes 39 seconds within its existing 12-minute
limit. This candidate still uses the old preview generation path, so
its success does not qualify the subsequent preview repair 7250a95cc.
That repair has its own exact Linux CI and macOS smoke.

The exact green smoke starts this release automatically. No lane manual
dispatch consumes another hour. The 04:47 backstop correctly defers while
this candidate awaits its exact-SHA smoke. The selected candidate is
proven before the newer push finishes CI; no in-flight green candidate
is bypassed. Production previously served 92c179a16-mv4p42in.

The historical GPU parity residuals, Pine short-p95, two-minute gate and
whole-window reliability targets remain open. No parity baseline,
threshold, witness, timeout, test selection or hourly limit changes.
