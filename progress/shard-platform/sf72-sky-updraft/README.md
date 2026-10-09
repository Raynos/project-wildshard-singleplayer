# Sky Reach's updraft ride, before / after the board touchdown fix (SF72, sf72-sky6 + sf72-sky7)

The same ride on both hosts: stand on the windmill deck at the ramp's foot (-8.66, 30, -72.39), HOVER on, hold the
stick toward the step along the ramp (-11.53, -75.17) → (-54.55, -116.84) → (-64, -126).

- `browser-ride.mjs`: the page (muted Chromium, "iPhone 16 Pro", phone tier), the baseline autopilot's input path
  (`input.setHeld('move.forward')`, the yaw toward the waypoint), every frame logged and every `onLand` counted.
  Before: the d310069 preview (same board law and updraft as HEAD ae129cfb0); after: 6e3c561 (the fix).
- `headless-ride.mjs`: Sky's renderer-free host (`runtime/headless.ts`), the same start, press and stick, every tick.

| run | end (x, y, z) | max y | min v.y | hard landings | outcome |
|---|---|---|---|---|---|
| browser before | -19.72, 20.09, -45.76 | 32.33 | -12.21 m/s | 13 in ~2 s | dead on the ramp, respawned at the spawn (t 3 s); the drive on from there fell off |
| browser after | -63.20, 44.41, -125.23 | 44.61 | -0.83 m/s | 0 | on the step |
| headless before | -63.53, 44.41, -125.54 | 44.61 | -68.95 m/s | repeated (health 100 → 56) | on the step, hurt (no death respawn headless) |
| headless after | -63.57, 44.41, -125.58 | 44.61 | -0.83 m/s | 0 | on the step |

The cause (`src/engine/player/board.ts`): under the updraft's lift every tick is airborne (`boardShoved`), the airborne
branch adds -15 m/s² · dt to v.y, and the touchdown filed the landing but kept v.y, so it ran down 0.25 m/s a tick
(the browser's landings read 0.70, 0.95, 1.20 … m/s) until every touchdown was a hard fall hit. The fix spends the
downward speed on the touchdown (`groundedVelocity`, the walk's landing law); the landings now read 0.25 m/s each.

Left as found: the updraft's 0.2 m/s-per-tick feed sits under `IMPULSE_REST_SQ` (0.05 m²/s²), so `decayImpulse`
zeroes it every tick and the lift never builds to the "about UPDRAFT_LIFT / 3.5 m/s" its comment promises; the ramp
collider carries the board up on its own.

## The landed law (sf72-sky7, candidate 104d5d6)

sf72-sky6's `after` rows above are the first version (every touchdown spends v.y). It also flattened every ordinary
board landing: the ~0.33 m spring dip after a jump went, and a jump pressed while the board still bobbed fired (the
board-tape oracle's step-340 press). The landed law spends the downward speed only when the board began the step at
the ride height (`hoverBob <= 0.05`): a shove too weak to lift it, the updraft's steady feed, which lands the same
tick. A real flight (a jump, a strong shove) keeps its speed and the spring takes the landing with its dip, so both
board oracles (`test/engine/player-board-tape.test.ts`, the Player / SimHost bit-identical ride) are byte-identical.

| run (sf72-sky7) | end (x, y, z) | max y | min v.y | landings (hard) | health | outcome |
|---|---|---|---|---|---|---|
| browser before, ae129cfb0 (`browser-before-sky7-ae129cfb0.json`) | dead at tick 97, respawned at Sunrest (tick 130) | 32.35 | -12.24 m/s | 47 (13) | 100 → 0 | killed on the ramp |
| browser after, 104d5d6 (`browser-after-sky7-104d5d6.json`) | -63.35, 44.41, -125.37 | 44.61 | -0.84 m/s | 274 (0) | 100 | on the step |
| headless after, 104d5d6 (`headless-after-sky7-104d5d6.json`) | -63.57, 44.41, -125.58 | 44.61 | -0.84 m/s | 0 hard | 100 | on the step |

`browser-ride-sky7.mjs`: the real page on the HOVER button's own action (`input.press('hover')`), the stick held
toward the next point, every fixed step logged (y, v.y, the impulse, hoverAir / hoverBob, health) and every `onLand`.

Walk baselines on the candidate build (`physics-baseline --mode=walk --url=<104d5d6 preview>`, the 1.1 MB result not
kept): every shard 0 stuck: Driftwood 8 legs, Pine Hollow 7, Nalati 12, Nine Dragon 19 (its two hover legs included),
Signal Dunes 7, Sky Reach 10 (the roost, keeper and keeper-to-roost board legs end on their decks at 34.44 / 32.96 / 34.44).
Boot smoke 4/4 and hover-touch (template, road) PASS on the same build.
