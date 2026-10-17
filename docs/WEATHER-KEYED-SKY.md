# Weather reactions + keyed sky

G474/G477 approve this feature as platform from day one. This landing replaces
Pine's complete keyed-sky runtime and preset-schema module with the
`look/keyed-sky` platform section. The rain/shelter/ambience wiring in
`world/weather.ts` remains a separate part of feature 11.

## Rows and consumers

`src/format/keyedSky.ts` defines photographic image keys, numeric and colour
presets, ordered phase frames, sun/moon arcs and day curves. `response` holds
shadow quantization, cloud-deck and mist tinting, lunar disc size, horizon
limits, cache size and environment refresh policy. A shard supplies graph ids
and the numeric channel group as data; no TS callback or subclass crosses the
keyed-sky API.

The data-only `DayClockStyle`, `DayLookSchema` and `DayLookRow` contracts
live in `@wildshard/format/dayLook`. Authoring rows import those definitions;
live colour presets and their clock consumers remain in game.
Optional dusk and lamp curves select numeric preset field ids. Both Pine
and Driftwood use these data selectors; the old TS reader callbacks are
removed in this landing.

`src/game/looks/keyedSkyClock.ts` constructs a renderer-free `DayCycle` from
these rows. The existing day clock owns snapshot/restore and normalized phase.
`src/game/looks/keyedSky.ts` is client-only presentation. It lends the two
resident textures to the existing material graphs, follows the viewer, applies
the declared weather responses to copied presets, and uses the shared graph
sky lifecycle for environment refresh, clock jumps and disposal. Context loss
drops keys and rereads their verified product bytes. The resident key count
bounds eviction; keys currently sampled by either graph remain resident.

## Offline packing

`generators/bake-keyed-sky.mjs` decodes the shipped JPEG/gain-map pairs with
the SDK's pinned image decoder. `scripts/bake/keyed-sky.mjs` reproduces the
half-float gain lookup and packs RGB half-float rows. It records horizon
means before packing, preserving the fog's source precision, and publishes gzip-compressed
immutable blobs plus the section rows. The registered portable producer runs
at build; generated key binaries are not committed.

The client verifies each blob through `ShardProduct.file`, inflates it, checks
its exact byte count and uploads the same `RGB / HALF_FLOAT` rows into
`RGB9_E5` as the previous path.
Driver quantization is retained: a Metal proof found that prequantized words
produce different texels from the existing upload. The build removes constant
alpha and the page's pixel walk without changing that conversion.
The existing grid memory trim selects packed keys and the phone's smaller
environment. Standalone play retains the original half-float gain-map
loader. Render resolution, draw count, material graphs and clock equations are
unchanged.

## Host bar

The new host is 5/6 under test 1's explicit G474 platform-from-day-one
exception. Pine is the first shipped user; Nalati's W3 G477 sky/weather work is
the pending real user. An invented second sky in
`test/keyed-sky-platform.test.ts` exercises different images, phase timing,
light levels and storm responses without a shard branch. It is a contract
fixture, not a claim that a second real shard already uses the feature.

The shared clock's field-selector extension scores 6/6: both Pine's lamps
and Driftwood's dusk are real users of the same declared numeric-field
selectors. Plain-data admission rejects callbacks before any preset or
clock is constructed. The renderer-free clock and independent sky fixture
cover the other five tests.

The defining format and clock have no browser dependency. The backdrop is
explicitly client-only; it would remain useful with any photographic sky
rows if its first shard vanished. Source parsers reject unknown fields,
callbacks, invalid frame references and incomplete packed-key sets.

| Test | Score | Source evidence |
|---|---:|---|
| Two real users | 0 | `lint/platform-pending-users.json` names Nalati, G477, end of W3; G474 is the explicit day-one exception. |
| No shard nouns | 1 | `src/game/looks/keyedSky.ts` reads image, graph and channel ids from the caller's rows. |
| Data-driven | 1 | `src/format/keyedSky.ts` defines frames, weather transforms, lunar and horizon responses. |
| Server-safe / client-only | 1 | `src/game/looks/keyedSkyClock.ts` is renderer-free; the backdrop is client-only presentation. |
| Deletion test | 1 | `test/keyed-sky-platform.test.ts` supplies an invented sky with different images, timing and lighting. |
| Data-only API | 1 | `keyedSkyBackdrop` accepts admitted rows, flags and graph/channel ids; `parseKeyedSky` rejects accessors and callbacks. |

Measured packing and rendered parity evidence lives in
`progress/shard-platform/keyed-sky-2026-10-17/look-proof.json`. The 48
comparisons cover two poses, phone and desktop tiers, clear/overcast/rain,
and day/dusk/night/dawn. Their minimum SSIM is 0.9999870939001777
against the 0.9995 threshold. All seven built keys match the original browser
worker's RGB half bits and horizon means exactly. The capture uses the
Feedback renderer API to exclude transient DOM notices without masking or
cropping the rendered world.
