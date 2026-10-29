# Verb lists (FOUNDATIONS wave 3, G904)

One list per shard: each verb the player performs, with the input, where, and what the game says back, written from
LEGACY where LEGACY exists. A lane plays each verb in both modes on the phone page and fixes every difference (MF16-MF18).
CI12's harness tapes replay these lists. "Played" names the run that proved the row.

Driver for every row so far: Chromium as iPhone 16 Pro (touch), Developer on, a fresh save per run. The touches are
trusted, sent through CDP `Input.dispatchTouchEvent` on the real HUD discs (a tap is 90 ms, HOLD = HEAVY is 900 ms). The
Simulator has no OS-level touch injection here (no idb), so "real touch on the Simulator" is this, not a finger.

## Signal Dunes (sunscar-dunes): SHARDFILE only (no LEGACY copy)

| # | Verb | Input | Where | The game says | Played |
|---|---|---|---|---|---|
| 1 | Read the logbook | USE tap | the logbook (-77, 30) | "Read the logbook" prompt; toast "Step complete · Light signal fire", objective "Fetch oil from the dry well", the log text | MF16, 3/3 |
| 2 | Find the well | walk up | the dry well (84, -6) | "Discovered · Dry well"; prompt "The bucket hangs down the well" | MF16, 3/3 |
| 3 | Pull the crank | ATTACK held (HEAVY: the lash's double crack), facing the windlass from ~3 m | the crank (85.7, -6), crack reach 1.7 m (QB15) | toast "A heavy (double) crack pulls the crank"; prompt "Take the oil jar" | MF16, 3/3 |
| 4 | Take the oil jar | USE tap | the well | "Oil jar taken", "Step complete · Oil from the well", objective "Light the three waymark braziers" (0/3); prompt "The well is empty" | MF16, 3/3 |
| 5 | Pour oil into a waymark | USE tap | brazier.0 (58, -34), .1 (-44, -22), .2 (34, -102) | "Pour oil into the brazier" | not yet |
| 6 | Light a waymark | the lash's crack at the bowl (crack reach 1.2 m) | each brazier | "Crack the whip at the bowl to light it"; "Waymark lit"; after three, "All three waymarks burn: now the tower" | not yet |
| 7 | Light the signal fire | USE / crack | the tower fire (7.6, -75.5) | "Light the signal fire"; "Signal fire lit" | not yet |
| 8 | Talk to Sefa | USE tap | Sefa, the caravan scout | "Talk to Sefa" | not yet |
