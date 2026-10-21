# Driftwood, Pine Hollow and Nine Dragon Stack: grid entry receipt, 2026-10-20

Source `914015a32f45b68eb4ae732d5a1c396e4cf5c067`, one devserver build served once (`scripts/serve-build.sh --rev`) and
measured with `node scripts/frame-floor.mjs --shards=grid --surface=sim --grid-scenario=milestone --devserver
--gl-observer=off --grid-routes=driftwood-isle-road-entry,pine-hollow-road-entry,nine-dragon-stack-road-entry
--serve-base=<preview>`. Portrait iPhone 17 Pro Simulator Safari, phone tier, Developer on, 120-frame windows. Taken
under a `.git/quiet` lease with no push holding the push lock during the sample (checked every 5 s); 182 s.
[receipt.json](receipt.json) keeps every row.

Ruling (wildshard-new, 2026-10-20): `oneFrameLooks` is the visual and stall witness (complete entry, no reload or hole,
no context loss, no frame over 200 ms): each row's `stallPass`. The p95 frame floor (≤ 35 ms on every grid row) stays
its own gate next to M2: each row's `pass`.

| Route | Entered | Stall witness | Travel p95 / max | Drive p95 / max | Interior p95 | Frame floor |
| --- | --- | --- | ---: | ---: | ---: | --- |
| driftwood-isle-road-entry | driftwood-isle | PASS | 34 / 34 ms | 43 / 143 ms | 34 ms | FAIL (drive) |
| pine-hollow-road-entry | pine-hollow | PASS | 43 / 143 ms | 40 / 143 ms | 34 ms | FAIL (travel, drive) |
| nine-dragon-stack-road-entry | nine-dragon-stack | PASS | 46 / 82 ms | 53 / 156 ms | 38 ms | FAIL |

The grid's own boot rows in the same run are not route rows: `spawn` p95 124 / max 247 ms and `grid-deck-north` max
201 ms fail the stall bound (`grid-deck-east` passes). The stall fixes that brought these routes under 200 ms:
6a2e8c505c (creature bake inflated once a burst), 6206e61e68 (shore hull support points), 528df1e67c (return programs
share one Wasm memory: iOS JSC ran a full GC per new Memory), 71baa56bfb (decision memories prepared before Pine's
elite fights). The Simulator is Mac-backed Safari, not physical-iPhone performance.
