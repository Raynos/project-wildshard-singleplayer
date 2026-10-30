# Native headless simulation

`HeadlessSimulation.journey({ticks, points})` runs bounded native fixed ticks
inside the owned worker, then 60 neutral settle ticks. Points come from the
authored physics route; movement follows committed feet, including jump presses.
The report contains actual travel, visited waypoints, stalls, final feet and
support, and maximum native tick time. The 0.8 m waypoint tolerance and
0.3 m / two-second progress rule are shared with the physics walk.

This terminal offline operation requires advisory timing and at least one
player command per tick. It retains per-tick script, decision and finite-state
checks plus the independent worker request watchdog. It does not encode or
publish a new resumable checkpoint after every tick: the previous complete
checkpoint stays authoritative, further steps refuse, and the caller disposes
the worker. Ordinary `step`, restore, fuel and runtime deadlines are unchanged.
The defining schemas, cursor and result types live in
`@wildshard/sdk/headlessJourney`; no caller-selected code or synthetic facts
enter the worker.

`walkLeg(plan)` runs the same native route with a full checked continuation
published only after the leg completes. It keeps the resident for the next
ordered leg; terminal `journey` semantics stay unchanged. Both operations
retain the independent 30 s request watchdog. Physics plans accept at most
14,400 ticks (the maintained ruler's longest four-minute simulated leg), an
optional finite start pose, one-way completion and declared escape bounds.
A start releases the prior native ride, swimming, dash and velocity before
36 settling ticks; ordinary routes never skip a blocked waypoint. Only an
escape leg may advance a target after the original 1.2 s held-edge interval.
The walk records any bounds escape. The standard integration journey still
uses exactly 1,800 movement ticks and 60 neutral settling ticks.

The Node physics proof uses `PLAYER_CAPSULE` from
`@wildshard/engine/physics/CharacterMotor`, the page's unchanged settings.
An owned host's `resetPlayerPose(feet, yaw)` requires a living owned motor,
validates every coordinate before mutation, and never advances physics.
Native owned players carry their grounded feet with a moving body's pose
before their own move, matching the existing page's ride law.

