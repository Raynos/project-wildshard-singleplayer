# Verb lists (FOUNDATIONS wave 3, G904)

One list per shard, `verbs/<slug>.json`: each verb the player performs, its input (the input service's action, a hold
in ms), where (x, z, yaw, pitch), what the game says back (prompt, toasts, objective, flags) and the run that played it
(`played: null` = written, not yet played). Taken from LEGACY where LEGACY exists; a lane plays each verb in both modes
and fixes every difference (MF16-MF18). CI12's harness (sp-x1) replays these files as sim command tapes.

Sim commands (`sim` on a verb, for CI12's tapes): `spawn` {x, z, pitch?} puts the player there; `interact` {near} runs the
nearest interact point's own handler (where the input's focus is not aimable); `bodyTo` {near, to} moves the dynamic physics
body nearest `near` to `to` (a push); `kill` {near, radius} deals lethal damage to every live creature in range through its
own death path (a fight); `wait` {ms}.

The played rows used Chromium and WebKit as iPhone 16 Pro, Developer on, a fresh save per run, with trusted touch on the
real HUD discs: CDP `Input.dispatchTouchEvent` in Chromium (a tap is 90 ms, HOLD = HEAVY is 900 ms) and
`page.touchscreen.tap` in WebKit. The Simulator has no OS-level touch injection here (no idb), so "real touch on the
Simulator" is this, not a finger.

| Shard | File | Modes | Played |
|---|---|---|---|
| Signal Dunes | [verbs/sunscar-dunes.json](verbs/sunscar-dunes.json) | SHARDFILE only | MF16: logbook, well, crank (heavy crack), oil jar, 3/3 |
| Pine Hollow | [verbs/pine-hollow.json](verbs/pine-hollow.json) | LEGACY + SHARDFILE | MF17: crossbow 5 min (Chromium + WebKit, 0 faults), fire, Talk to Hale; later steps (door, lever-action, swap, dam, lanterns, flint, token, zipline, den): 11 of 14, the same in both modes |
| Nine Dragon Stack | [verbs/nine-dragon-stack.json](verbs/nine-dragon-stack.json) | LEGACY + SHARDFILE | Spawn, stairs, street, well rim walked in both modes, the same; hook / zip in MF15; no talks, quests or shop in either |
| Driftwood Isle | [verbs/driftwood-isle.json](verbs/driftwood-isle.json) | LEGACY (91a9eef081) + SHARDFILE | MF18: 24 of 28 played in both modes, every label and toast the same (0 differences, no fix): spawn to 'Quest complete · The Sealed Ring', the sea-glass counter, hover; reef dive by sp-o4; walk / jump / swim / swap need touch input |
| Nalati Grasslands | [verbs/nalati-grasslands.json](verbs/nalati-grasslands.json) | LEGACY (91a9eef081) + SHARDFILE | MF18: written by sp-o3 (26 verbs); sp-o4 played 14 in both modes, all the same (camp, elder and herders' talks, discoveries to the kurgan and cairn); Qara Batyr's 5-rider gate kept in SHARDFILE; taming, kokpar, combat and bosses not played |
| Sky Reach | [verbs/far-reach.json](verbs/far-reach.json) | LEGACY (91a9eef081) + SHARDFILE | MF18: written by sp-o3 (24 verbs); sp-o4 played 12 in both modes, all the same (keeper, notes step, winch lock, discoveries, islet); vane hint fixed ffd883c464; GUST, hover, combat and the Roc not played |
