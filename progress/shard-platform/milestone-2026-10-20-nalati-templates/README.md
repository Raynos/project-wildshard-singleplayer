# Nalati Grasslands and the template routes: grid entry receipt, 2026-10-20

Source `914015a32f45b68eb4ae732d5a1c396e4cf5c067`, the same served devserver build as
[the Driftwood, Pine and Nine receipt](../milestone-2026-10-20-driftwood-pine-nine/README.md), measured with
`node scripts/frame-floor.mjs --shards=grid --surface=sim --grid-scenario=milestone --devserver --gl-observer=off
--grid-routes=nalati-grasslands-road-entry,template-interior,template-return --serve-base=<preview>`. Portrait iPhone 17
Pro Simulator Safari, phone tier, Developer on, 120-frame windows. Taken under a `.git/quiet` lease, started only with no
push and no heavy-lane lease active, with no push holding the push lock during the sample (checked every 5 s); 283 s.
[receipt.json](receipt.json) keeps every row. (An earlier sample of these routes overlapped a build and was discarded.)

Ruling (wildshard-new, 2026-10-20): `oneFrameLooks` is the visual and stall witness (complete entry, no reload or hole,
no context loss, no frame over 200 ms): each row's `stallPass`. The p95 frame floor (≤ 35 ms on every grid row) stays
its own gate next to M2: each row's `pass`.

| Route | Entered | Stall witness | Travel p95 / max | Drive p95 / max | Interior p95 | Frame floor |
| --- | --- | --- | ---: | ---: | ---: | --- |
| template-return | driftwood-isle | PASS | 34 / 45 ms | 48 / 114 ms | 59 ms | FAIL |
| nalati-grasslands-road-entry | nalati-grasslands | FAIL (drive 207 ms, Nalati activate) | 78 / 127 ms | 43 / 207 ms | 35 ms | FAIL |
| template-interior | template-2 | FAIL (drive 418 ms, between hooks) | 43 / 77 ms | 37 / 418 ms | 34 ms | FAIL |

Open: Nalati's activate frame (207 ms, 7 over) and template-interior's long frame right after Nalati's last hook, which
has no GL work and little game frame work (an async continuation between frames; being attributed).
