# T9 · the 62.5 m road gap

G638 option A: the 500 m cells use pitch 562.5 m. Asphalt remains 15 m;
the side strips are 23.75 m. No Debug row or shard-local collider rebake.

Source: `5a3e6eeb1e`, `e047d32b4a`, `68b031c179`, `ae2dca27dc`.
The milestone uses one shared exact app build:
`a80ea662b5f4f054d5940b6654209b89ef8f91ea`, `a80ea66-mvmssanv`.
Tool-only repairs after that pin need no app rebuild.

## Native crossing proof

[t9-native.json](t9-native.json) records the actual 15 and 30 m/s routes.
Both complete home → road → Template → road → home, four committed frame
changes, no stuck event, controller loss or fall. Only the initial pose is
placed; the route uses held input. Raw traces stay in ignored scratch,
with their SHA-256 in the receipt. This is no frame-floor or loading claim.

## Seam walking

The four-way route is [t9-road-walk-route.json](t9-road-walk-route.json).
Each leg starts on the unchanged static entry apron at 240 m, crosses the
250 m cell edge, both re-frame thresholds and the road midpoint at 281.25 m,
then returns by held walking input. The original 230 m north point is
inside a streamed jetty; it is not an appropriate static-seam seed.

Final four-leg result: still open. The corrected proof will run after the
already-active T1 browser milestone releases its shared preview.

The intermediate north return held at z=255.985 while the actual crossing
was preparing Driftwood, pending with no issue, in `afterPlay`. That is a
closed readiness fence rather than proof of bad seam geometry. The generic
walk now recognizes only that explicit pending incoming preparation as a
wait. Its whole-leg deadline and ready/failed two-second physical-snag
refusal remain. Incomplete and timed-out walks fail. A wall-clock deadline
also bounds a stopped frame gate. No wall is disabled.

An intermediate first-east diagnostic stopped after its fallback teleport
to exactly x=240: frameGate/gameplayReady were false before the fixed-step
interior event could activate the entered runtime. This was a harness trap,
not a demonstrated T9 activation regression. Both the pre-T9 live build
`f42d192560` (555 m pitch) and the same affected `a80` build (562.5 m)
subsequently completed their held east round trip with no stuck event,
three frame changes and both gates open. [The compact controls](t9-walk-controls.json)
retain raw hashes and final state. The coordinator lifted the precautionary
release hold. Grid refusal now stops at its measured feet and records state;
it never teleports into a not-yet-activated interior. Non-grid fallback
behavior remains unchanged. No app lifecycle code changed.

The entry inventory also records the real streamed pier owner `pier.c3`
with 20 registered and 20 native shapes at y=1.2000000477. The old exact
`pier` harness guard was repaired without changing game colliders.

## Portrait witnesses

[Road](../../../art/grid/t9-lattice/road.jpg) and
[junction](../../../art/grid/t9-lattice/junction.jpg) are real phone
portrait screenshots, labelled before capture. Both report pitch 562.5,
renderer scale 2, viewport 402 × 874, a live GL context and road ownership.
[t9-portrait.json](t9-portrait.json) retains those scalar observations.
These Chromium pictures are not Safari, Simulator or physical-device proof.

## Quick checks

The runtime slice passed 3,938 related cases / 844 suites; 44 unavailable
product suites were explicitly deferred to CI. Geometry/layout/bake and
far-ring cases, root types and direct typed lint passed. The native Node
fixture kept 600 frozen ticks and door/creature restoration, hash
`f9efae6fe25a1796fc262c993ee03e71eaebcf58c18613f0a40b3efca6081e5d`.

Historical builds without pitch telemetry still get byte-identical 555 m
floor plans and standing poses; `test/frame-floor-pitch.test.ts` pins them.
The pier repair passed its three focused CF1 cases/types. Readiness-aware
walking is `665ebcfef8`, with focused wait/refusal cases passing in
`f039ec9482`; `a752e033dd` adds the no-frame deadline. The latest grid refusal
regression passed all six cases plus CF1 types. The intervening collection
failure was fixed forward; it was never a passing test receipt. No
Simulator/FPS, memory saving or whole-grid soak result is claimed here;
T10 owns that milestone.
