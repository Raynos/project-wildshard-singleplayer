# Cover appearance rows

Pine's fixed undergrowth and Driftwood's streamed cover use one bounded,
client-only material and texture book. Pine keeps its Forest placement and
culling; Driftwood keeps its cell decoding, refill, upload and growth laws.
Water look and surface values become JSON. The headless day binding uses
Driftwood's existing published day style.

The landing deletes Pine `runtime/looks/groundCover.ts`,
`runtime/looks/paintedTextures.ts`, `data/undergrowthLook.ts`,
`data/waterLook.ts`, and Driftwood `look/dayKeys.ts`.

## Look and frame evidence

`measurements.json` retains pixel comparisons and sanitized frame-floor
measurements, pixel-hash pairs, dimensions and GPU/collider census, with
no local save/session records. Phone captures use muted
iPhone 16 Pro emulation at render scale 2; both phone and desktop tiers
cover midday and night. All 48 populated world frames are pixel-exact,
with matching draws and triangles (SSIM 1, required 0.9995). The 16
creature supplements also match, including pre-existing empty desktop
shots. The secondary Pine night baseline has a different shader-source
census hash with identical pixels; the canonical night baseline and
candidate census match. There is no visible look change.

The desktop floor is not globally green before or after this change.
Pine cabin stays at p95 33.4 ms. Spawn varies with scheduling: the paired
midday repeat improves from 33.4 to 16.7 ms; cabin work p95 improves
from 14 to 13 ms. Driftwood desktop passes all three measured poses.
Pine Simulator passes; Driftwood's existing Simulator misses remain,
with spawn 64 to 58 ms, beach 73 to 58 ms and pier 51 to 51 ms.
Different automatic third-pose choices are retained without treating
them as paired measurements.

## View code retained

- Pine undergrowth: original model geometry, placement, Forest culling,
  shadows and local-to-world frame.
- Pine rain effects: camera-following particles and frame drawing remain
  custom view code; the weather-channel values already arrive as data.
- Pine water: live rain, top-down view, borrowed ripple and pond skyline
  bindings. Its creek/spray meshes already arrive through scene rows.
- Pine and Driftwood render adapters: product admission, keyed sky/toon
  attachment and memory trimming; these small view bindings stay custom.
- Driftwood GroundCover composition: deletion waits for C1 batch 8's
  actual static-log scene and placement handles. No speculative log ID
  or unused admission is introduced.

The component ruler still assigns C2 lines to model material bindings in
C1/C6-owned modules. Those modules follow their owners' scene/figure data
paths; this slice does not claim that the complete C2 inventory is zero.

## Integration

On integrated upstream tree `1559f3998` plus C2 tree `9a1353c53`, root
and layer types, typed lint, 36 focused tests (including 17 headless),
and all ten products pass. Strict product mode refuses stale map stamps
for Driftwood, Far Reach, Nine Dragon, Pine and Sunscar. This is recorded
as a refusal, not a green strict build. The source-basis ruler is Pine
6034 to 5876 (−158), Driftwood 4757 to 4751 (−6); platform +100 lines.
The five product-look consumer tests also pass after exact-tree
regeneration on `fc7539f82` (the same runtime plus the committed fixture
repair), giving 41 focused cases in total. A first attempt without
regeneration exposed a stale generated schema; no source change was
needed. Final actual-parent results follow below at landing.
G490 assigns canonical map baking to sp-x10 after source intake. New
Pine map fact roots are `data/coverAppearance.json` and
`data/waterLook.json`; Driftwood reuses `data/skyDay.json`.

The current frozen dependency `01e24e8a9` plus C2 `432e51c47` also
passes root/layer types, typed lint, all nine focused files (41 tests,
including 17 headless), and all ten products in one integration run.
The exact post-generation parent ruler is Pine 6034, Driftwood 4706;
the candidate is Pine 5876, Driftwood 4700. The cut remains −164 shard
lines and +100 platform lines. Strict mode again refuses the same five
stale map stamps. These are proof trees; actual publication waits for
the dependency landing and the coordinator’s map-window release.

## Landed dependency composition

The source composition uses actual G486 commit `231c16e4f`. Its runtime
source equals the fully checked `432e51c47` candidate. Incoming changes
are the fourth map metadata, documentation/evidence and the inherited
crag exact-byte test repair `e086a824e`, validated by its pusher. The
source-equivalence check pins that test’s content to the landed repair;
it permits no other test or runtime changes. Fresh post-generation
products and the source ruler use validation tree `1f32ed4fb`.
