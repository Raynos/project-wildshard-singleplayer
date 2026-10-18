# First isolated practice encounters

Source tree: `e58e4752c493a7d4cd473dd99f0299a212bf31f6`.
Observed 18 October 2026 in a muted, portrait iPhone-emulated cloud browser.
The owner rejected these creature models; they are mechanics fixtures only.

All five selected creatures entered with one opponent and no visible dummies,
retried with restored local health and rewards, and exited with unchanged world
health/quest snapshots and restored weapon. No page errors were recorded.

| Creature | Verified in this short run |
| --- | --- |
| Brine Puffer | Guest attack state; touch attacks killed it, 45 to 0 HP; two local coins collected |
| Conch Duelist | Enemy 60 to 48 HP; local player 100 to 86 HP; HUD displays 86 |
| Splinter Mantis | Enemy 55 to 43 HP and guest attack state |
| Bellback | Enemy 180 to 168 HP and guest attack state |
| Tide-Root Colossus | Entry/retry/exit; guest clock advanced; boss combat needs longer sampling |

The JSON report retains the actual before/after observations. The two portraits
show the local health and coin receipts. Overbright effects/materials obscure
the creatures; their cause is still being investigated. These are not clean
animation portraits or approved visuals.

The test uses real touch attacks and diagnostic pose placement. This is not a
skilled playthrough or evidence of phone performance. Full player defeat, every
attack, all-enemy deaths, balance and fun remain unverified by this run.

Reproduction scripts: `scripts/qa-practice-five.mjs` and
`scripts/qa-practice-depth.mjs`. Run through the repository browser lane against
an immutable supported preview. `CAPTURE_SOURCE` records its exact tree;
`CHROME_PATH` selects an installed official headless browser. The depth probe
uses simulated-time waits and inspects pre-hit material values.

## Longer contact probe

The same immutable source then ran with waits based on simulated time. The
Colossus attacked and reduced local player health from 100 to 62 to 0. Its own
health fell from 480 to 462; the 18 damage matches the authored exposed-core
multiplier applied to a 12-damage hit, although the hit instant was not sampled.
Local health stayed at zero through the defeat capture. Retry restored player
100 and boss 480; exit again preserved the world snapshots and weapon.
Conch remained active for 20 simulated seconds and reduced local player health
to 16; its retry and exit also restored state. Both runs had no page errors.

The pre-hit material observation establishes the overbright cause: flash 0,
emissive [0,0,0], but base RGB [19732.05,17758.935,13812.705]. The practice adapter
passed an integer identity-like seed to the factory's 0..1 tint argument.
The source correction uses a deterministic unit RNG draw. Four focused tests
(including real factory color conversion) pass. The original report
and pre-hit/defeat portraits preserve this failure; actual rendering verification of the correction remains pending.
