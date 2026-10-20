# Sky Reach and Signal Dunes: grid entry receipt, 2026-10-20

Source `aab292309f90e5ceb95e7da2289953532f39660f`, one devserver build served once (`scripts/serve-build.sh --rev`) and
measured with `node scripts/frame-floor.mjs --shards=grid --surface=sim --grid-scenario=milestone --devserver
--gl-observer=off --grid-routes=far-reach-road-entry,sunscar-dunes-road-entry --serve-base=<preview>`. Portrait
iPhone 17 Pro Simulator Safari, phone tier, Developer on, 120-frame windows. Taken under a `.git/quiet` lease with no
push holding the push lock during the sample (checked every 5 s). [receipt.json](receipt.json) keeps every row.

Ruling (wildshard-new, 2026-10-20): `oneFrameLooks` is the visual and stall witness (complete entry, no reload or hole,
no context loss, no frame over 200 ms): each row's `stallPass`. The p95 frame floor (≤ 35 ms on every grid row) stays
its own gate next to M2: each row's `pass`.

| Route | Entered | Stall witness | Travel p95 / max | Drive p95 / max | Interior p95 | Frame floor |
| --- | --- | --- | ---: | ---: | ---: | --- |
| far-reach-road-entry | far-reach | PASS | 43 / 146 ms | 41 / 164 ms | 34 ms | FAIL |
| sunscar-dunes-road-entry | sunscar-dunes | PASS | 36 / 78 ms | 34 / 82 ms | 34 ms | FAIL |

The Simulator is Mac-backed Safari, not physical-iPhone performance. Approach profiles (Safari script profiler, not
part of this receipt) put the remaining travel cost in shader warm-up and node builds (~29 %), texture uploads (10–15 %)
and Developer-mode GPU labelling (12–14 %).
