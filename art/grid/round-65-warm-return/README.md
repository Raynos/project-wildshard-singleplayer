# G724 / G725 · warm road return

App `774305c6a4df906152002e9d76937cf2f09ef404`, build
`774305c-mvnckbkm`. Muted Chromium phone tier, iPhone 16 Pro portrait;
this is gameplay evidence, not a physical-phone performance floor.

The old prediction path retired the world just left before the player committed
a different cell. `54c753f9ca` keeps that one world on the road. Metadata/module
prefetch continues; a committed different-cell entry still releases the old
whole world before allocating its replacement. It does not stack worlds.

The real frame/carrier regression found film grain blending outside a cinematic
cell with its colour grade (0.06 immediately outside). `774305c6a4` fences grain
to the geometric interior while keeping the authored inside strength and colour
edge blend. Four repeated exits/returns keep exactly one grain effect. This
proves an edge leak; it does not prove that every historical static screenshot
had that single cause.

## Held-input route

The first pose seeds the north road at (0, 281.25), after the owned Driftwood
boot; its normal leave completes. Three legs then use real held input, a
15 m/s maximum approach cap tapering near the target (the official floor
harness's stopping rule), and the real crossing/checkpoint/activation paths:
road -> Driftwood socket (0, 242.5) -> road -> Driftwood. No later teleport.

| Observation | First entry | Return |
|---|---:|---:|
| Crossing asynchronous preparation | 2.4 ms | 2.3 ms |
| Crossing request to motor commit | 32.7 ms | 33.6 ms |
| Retained `activate` hook | 20.4 ms | 17.7 ms |
| Request to gameplay ready, including 6 m travel | 1034.5 ms | 1033.0 ms |
| Driftwood loading-panel frames | 0 | 0 |
| Other cell loading-panel frames | 0 | 0 |
| Maximum resident native worlds | 1 | 1 |

The physical motor commits up to 6 m outside the geometric cell. The player
then walks that strip before the existing current-position fence runs entered
hooks. The approximately one-second total above includes this movement; it is
not a one-second loading stall. Only `activate` runs, with no world/kit/play
rebuild. The earlier uncapped route observed 32.6 ms from geometric entry to
ready; its overshoot briefly approached Pine's own unready edge screen. That
first route was not used to claim a panel-free result. The controlled route
above has zero panels of either owner. [Exact scalar timings](summary.json).

Road and Driftwood film-grain opacity are 0 throughout this route. Both
[captures](road.jpg) / [returned interior](driftwood.jpg) have clear skies and
no TV static; Driftwood's clean chain has no authored cinematic grain. Its
normal title banner is visible on entry and is not a loading panel. There is
one resident world (Driftwood), no runtime error and no context loss. Product
prefetch requests are not extra resident worlds.

Pinned preview build exits 0. Native warm-retention tests pass 8/8, related
16/3 suites, game/engine referenced layer types and scoped typed lint pass.
Grain plus frame-lifetime focused cases pass 3/2 suites. Its CF1 selection has
159 passing cases; one unrelated raw-JSON transform collection failure is
explicitly deferred by CF1, without an executed failing test. Both source
commits are on origin. JPEGs only add burned labels and resize; no scene edits.
