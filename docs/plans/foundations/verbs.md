# Verb lists (FOUNDATIONS wave 3, G904)

One list per shard, `verbs/<slug>.json`: each verb the player performs, its input (the input service's action, a hold
in ms), where (x, z, yaw, pitch), what the game says back (prompt, toasts, objective, flags) and the run that played it
(`played: null` = written, not yet played). Taken from LEGACY where LEGACY exists; a lane plays each verb in both modes
and fixes every difference (MF16-MF18). CI12's harness (sp-x1) replays these files as sim command tapes.

The played rows used Chromium and WebKit as iPhone 16 Pro, Developer on, a fresh save per run, with trusted touch on the
real HUD discs: CDP `Input.dispatchTouchEvent` in Chromium (a tap is 90 ms, HOLD = HEAVY is 900 ms) and
`page.touchscreen.tap` in WebKit. The Simulator has no OS-level touch injection here (no idb), so "real touch on the
Simulator" is this, not a finger.

| Shard | File | Modes | Played |
|---|---|---|---|
| Signal Dunes | [verbs/sunscar-dunes.json](verbs/sunscar-dunes.json) | SHARDFILE only | MF16: logbook, well, crank (heavy crack), oil jar, 3/3 |
| Pine Hollow | [verbs/pine-hollow.json](verbs/pine-hollow.json) | LEGACY + SHARDFILE | MF17: crossbow 5 min (Chromium + WebKit, 0 faults), fire, Talk to Hale, the same in both modes |
| Driftwood Isle | [verbs/driftwood-isle.json](verbs/driftwood-isle.json) | LEGACY (91a9eef081) + SHARDFILE | MF18: 12 of 28 played, both modes the same (quest start, chest, zipline, wreck locks, discoveries, crab / sailor / boar deaths); the hold's items, shards, tide plates, altar next |
| Nalati Grasslands | [verbs/nalati-grasslands.json](verbs/nalati-grasslands.json) | LEGACY (91a9eef081) + SHARDFILE | MF18: written by sp-o3 (26 verbs); play: sp-o4 |
| Sky Reach | [verbs/far-reach.json](verbs/far-reach.json) | LEGACY (91a9eef081) + SHARDFILE | MF18: written by sp-o3 (24 verbs); play: sp-o4 |
