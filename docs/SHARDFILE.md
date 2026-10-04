# Shardfile v0

`SHARDFILE_VERSION = 0` covers both the format and script ABI. This is the provisional
author contract, published by `@wildshard/sdk/shardfile` (`ShardfileSchema`,
`parseShardfile`, `Shardfile`, `shardfileRules`) and `@wildshard/sdk/version`.
The build product is `shard.json` plus immutable files named by SHA-256. No placement,
three.js object, function, closure, custom shader or source generator appears in it.

The committed empty example is `test/fixtures/shardfile/empty.json`. Every object is
strict: unknown keys fail. Numbers are finite; counts and byte sizes are safe unsigned
integers. MB means 1,000,000 bytes. The platform owns caps in
`@wildshard/engine/core/config` (`CONTENT_CAPS`, measured caps v1).

| Section | Contract |
|---|---|
| `identity` | Kebab/dot slug, nonempty display name and author (128 characters max), positive revision, unsigned seed. No grid coordinates. |
| `requires` | SDK revision 0; capability names; declared SHA-256 commons hashes. |
| `budgets` | Library resident ≤25 MB and wire ≤8 MB; sim resident ≤25 MB and critical wire ≤2 MB; decode/refinement slack ≤80 MB. |
| `look` | Fixed platform family names; grade exposure/saturation/contrast and optional LUT reference; engine clock with an optional `day`; optional normalised day override; ordered day keys carrying sky gradient, fog, sun and ambient values (below). |
| `sim` | 60 Hz fixed step; positive script tick divisor dividing 60; command and snapshot schema version 0; script references. |
| `rows` | Optional/default-empty numeric strikes, weather output tables, day schedules, species/variants, registered look recipes, compendium and loot presentation data. |
| `terrain`, `water` | Optional/null bounded baked terrain binding; optional/default-empty declared pools, sea and streams. |
| `creatures`, `encounters` | Optional/default-empty reusable brains, stable spawns and phase tables; each actor has one controller and resolves declared species/variant/strike and boss panel references. |
| `quests`, `audio`, `ledger` | Optional/default-empty quest graphs/triggers/dialogue, admitted cue/ambience/score declarations, and witnessed fact/reward mappings. |
| `hooks`, `plumbing`, `spawn` | Optional named numeric field conditions and next-tick scene events; optional scoped input/tier/Debug declarations; cell-local player position and yaw (default 0, 2, 0, 0). |
| `state` | Positive state-schema version, `sharedOwner: "host"`, `playerKey: "actorId"`; named shared and per-player fields with bool/i32/f64/string type and matching default. |
| Field `privacy` | `public` replicates to everyone; `owner` only to the owning actor; `host` never leaves the host. Shared writes always belong to the host regardless of visibility. Names are unique within each state scope. |
| `authorCaps` | 1–32 players (authors may lower the room cap); in-cell speed 0–15 m/s. Highway speed belongs to the platform. |
| `serverBudget` | Positive tick budget ≤16,666 μs, positive memory ≤25 MB, ≤10,000 entities, ≤1,024 commands per tick. These are author declarations, not a server implementation. |
| `edge` | Four ordered perimeter profiles with 2–129 height and RGB samples of equal length, heights inside ±250 m, colours in [0,1], road height exactly 0. North/south samples run west→east; east/west run south→north. |
| `files` | Unique lowercase 64-character SHA-256 hash, kind (`glb`, `ktx2`, `audio`, `json`, `wasm`, `binary`), compressed/decoded/GPU byte sizes, triangles, draws including shadows, dependency references, critical flag. |
| `tiles` | L0 62.5 m or L1 125 m; integer x/z address; exact horizontal grid bounds and vertical bounds inside the 500 m cube; nonnegative geometric error; file roots and declared costs. |
| `library`, `critical`, `far` | Library roots, critical roots, optional whole-shard proxy with bounds and costs. Critical flags match critical roots. |
| `ui` | Optional (defaults to empty), at most 64 declarations, each with a unique id: `marker`, `counter`, `bagPanel`, `bossPanel`, `relabel` (below). |

Declared UI (`@wildshard/game/shardfile/ui`, SF7f) is plain data the platform draws in
the shared HUD's own style and slots; a shard ships no DOM. Labels are 1–128 characters
and render as text only; icons are engine icon ids (`lock`, `check`, `poi`, `you`,
`map`, `pack`, `star`, `book`, `heart`, `pin`, `laurel`), never markup.
`marker {id, label, at: [x, y, z]}` pins a label over a cell-local point inside the cell.
`counter {id, label, band: band.2–band.5, order 0–999, min < max, field}` is a meter row
in the status column; `field` names a declared `i32`/`f64` state field, read every frame.
`bagPanel {id, tab: {id, title, icon, order}, order, paragraphs}` adds 1–16 paragraphs
(≤1,024 characters each) to a Bag tab; every panel naming a tab declares it identically.
`bossPanel {id, encounter, name, title, retry}` is the engraved boss bar, name card and
retry card for one encounter (one panel per encounter); the encounter's phase table
(SF13b) drives it. `relabel {id, spot, label, icon | null}` relabels one shared touch
disc (one per disc). The engine renderers are `@wildshard/engine/ui/declared`; the
game's `@wildshard/game/shard/declaredUi` binds a section to a shard's HUD and Bag.

Look v0 (SF10b) is data the engine renders (`@wildshard/engine/render/dataLook`; the game's loader
binds the section through `src/game/shardfile/look.ts`); a shard ships no sky shader, fog patch or clock. Colours are
linear working-space RGB in [0,1]. `day {minutes 1–1440, start 0–1, maxElevation 0–90°, azimuth −180–180°}` sets the
engine clock (default 12 minutes from noon, 60°, 35°); `dayOverride` pins it. Each key is
`{time 0–1, sky {zenith, horizon}, fog {colour, density, near?, far?}, sun {colour, intensity}, ambient {sky, ground, intensity}}`:
the engine draws a gradient dome from `sky`, feeds `fog` to its distance fog (density per metre, exponential), sets the
key light's colour and intensity (its direction is the clock's sun) and the hemisphere ambient. Keys blend linearly
by time and wrap across midnight. `grade.lut` names a `binary` file of exactly 33³ × 4 = 143,748 bytes (RGBA8, index
`(b·33 + g)·33 + r`, display sRGB in and out), applied last in the grade. The fixture is
`test/fixtures/shardfile/look/` (`shard.json` beside its LUT file, the product layout).

Linear fog supplies both ordered `near`/`far` distances in metres, with density zero
in every key. It blends by world-space camera distance, matching the template's
60–180 m fog. Modes cannot mix across keys. Shader patches belong to the level scope.
`grade.exposure` is parsed but awaits SF19a's single-frame lighting composite.

`look.materials` is an optional record from stable material ID to the engine's
`FamilyMaterialSchema` parameters (`toon`, `pbr`, `painterly`, `emissive`, including
PBR ground layers). `look.familyLooks` optionally carries `toon`, `painterly` and
`emissive` look parameters. Engine schemas fill defaults and reject unknown family
names or shader fields. Terrain and prop `family` bindings select a material ID;
the four family names also select platform defaults. Creature look rows may name a
`material` ID. Texture references resolve admitted files through the loader.

State fields carry explicit stable positive `id` values (1–2³¹−1), unique across
shared and player fields. IDs never come from declaration positions. The numeric
script input supports at most 24 bool/i32/f64 fields; string fields stay outside
that ABI. Optional finite `min`/`max` tighten the type bounds (bool 0–1, signed i32,
finite f64); defaults must fit, and integer types require integer bounds. The
public `assertStateCompatibility(previous, next)` checks two parsed revisions of
the same shard: existing scope/name/id/type must remain, and old IDs cannot name
another field. Declaration reordering and new fields are allowed. Outside authors
must assign an ID to every pre-existing v0 field before rebuilding; an empty
world has no fields to migrate. This is a provisional v0 refinement before freeze.

Author rows pass an independent JSON-only check before their strict schema: functions,
accessors, cycles, sparse arrays, nonfinite numbers and other lossy values fail before
serialization. Strike weights are numbers; weather outputs are state tables; day
clocks have complete ordered schedules. Species rows carry collision dimensions and
each variant's health and modifiers. View and animation recipes are registered IDs
with numeric/text parameters, resolved by the loader's injected catalogue. Compendium
stamps/stats are constants and loot presentation selects the purse/cue mechanisms.
`@wildshard/sdk/rows` exposes the schemas and numeric sim catalogue helpers. The fixture
`rows.json` matches `src/shards/_template/data/rows.ts`; SF16 activates these declarations.
The legacy row-function ratchet stays until its old types lose their closure fields.

`sim.bindings` optionally binds a declared script module to a positive entity ID,
`server` or `entity` role, and a nullable host actor ID. Both roles may be actor-bound;
the runtime checks actor provenance. Modules are unique in `sim.scripts` and must
belong to the critical closure. Validation reserves three full maximum-sized
memories per unique module (live, last-good, in-flight), including permitted growth,
plus the critical assets. Multiple bindings share that module reservation. The
result must fit both declared sim resident and server memory budgets and the host
24 MB script pool. Critical commons bytes also count against the wire cap.

Named hook conditions resolve a stable numeric field ID and a typed equality value.
Shared conditions read public fields; player conditions may read the owning actor's
fields. Host-only fields stay private. Scene hooks declare a numeric event type and
value, delivered to the host-resolved actor on the next script tick. Quests, input
and Debug choices may refer only to these declared hook names; hooks require a
script binding. The platform resolves callbacks, and the product contains only data.

Local references are file hashes; shared references are `commons:<hash>` and must be
declared in `requires.commons`. Every local dependency resolves. The dependency graph
is acyclic. A file's compressed bytes are its stored wire representation, decoded
bytes its persistent CPU representation, GPU bytes its uploaded representation.
Decoded geometry copies must be released after upload; decode/refinement overlap is
charged separately. CPU state that must persist stays in decoded bytes.

Per tile resident = decoded + GPU: L0 ≤4 MB / 0.3 MB wire / 40k triangles / 8 draws;
L1 ≤2 MB / 0.2 MB / 10k / 2; far ≤1.6 MB / 1 MB / 8k / 1. Shadow draws count;
only L0 within 80 m may cast them. L1 and far are self-contained and cannot depend
on the shard library. The builder verifies actual assets and transitive dependency
costs against declarations. The worst 150 m disc includes lookahead, three neighbours
at caps, deduplicated libraries/commons, L1, far, four sims and streaming overlap.
The engine base is 300 MB, playing envelope 850 MB, loading envelope 1.8 GB.

First-party products rebuild every build. The client accepts current v0; the only
previous-version exception in Part A will be offline-cached first-party content.
Older content needs upgrade without touching its source or saves. A version bump
migrates all first-party source and retains saves in one commit. Outside authors
must update `version`, `requires.sdk`, the sim ABI and affected fields, then rebuild
and validate; incompatible state changes require an explicit save migration.
Version 1 freezes only after SF22c's physical-phone reading. Future rows add content
schemas and bindings; v0 does not yet claim tiles, quests or scripts are playable.

The author CLI is built with `node scripts/build-sdk.mjs` in this checkout and run
as `node src/sdk/bin/wildshard.mjs`. Outside projects get `wildshard` from the SDK
tarball. Commands: `new <fresh-directory>`, `build <project> [output-directory]`,
`validate <project|shard.json>`. Default output is the project's
`public/shardfiles/<slug>/`. Source assets live at `assets/<sha256>`; declared
commons inputs live at `commons/<sha256>` and are copied once into the product.
The build compiles trusted local `shard.config.ts`, parses its default export,
verifies wire hashes and parser costs, rejects understated transitive budgets and
critical wire >2 MB, then writes stable sorted-key JSON and unchanged immutable
bytes. Configs and generators execute only on the author's machine.

SDK distribution (SF8b): `pnpm --dir src/sdk pack --pack-destination <directory>`
builds portable ESM author tools, their complete declaration closure and the normal
Game client. An outside project installs the tarball with a `file:` dependency;
`wildshard build` copies that prebuilt client and embeds its validated shardfile in
`index.html`. Serve the output directory as a static site. The bundle includes the
normal client's fonts and physics Wasm; it owns no separate render loop. Workspace
source exports remain `.ts`, while the tarball's exports name its packaged JS and
declarations. `node scripts/test-sdk-distribution.mjs` proves installation outside
the workspace, two byte-identical clean products and standalone strict TypeScript.
For the browser load/unload census, run `scripts/browser-lane.sh node
scripts/test-sdk-client.mjs <built-product-directory> [report.json]` from scratch
after any active performance quiet window; it serves only that installed product.

The initial parsers accept GLB 2 with embedded buffers and separate KTX2 textures,
2D KTX2 within 4096² (RGBA transcode is the conservative GPU bound), and PCM WAV
within 180 seconds / two channels. Unsupported mesh compression, sparse accessors,
external GLB URLs, embedded images and non-PCM audio fail explicitly. Subsequent
asset rows extend supported encodings; they do not bypass these caps. The shared
model is `@wildshard/engine/core/contentCost`, consumed by the game's
`@wildshard/game/shardfile/budget`. The validator expands its 5 m search grid's
radius by the sample spacing's half diagonal, so gaps cannot hide a heavier disc.

## Minimal singleplayer load

The normal client accepts an embedded `<script id="ws-shardfile" type="application/json">` source. The game validates it before selecting the level, then uses the existing session, Game, player, physics, HUD and staged LevelLoader. `loadShardfile(app, input)` also feeds an installed level driver; `app.unloadLevel()` owns disposal. External names cross `parseShardSlug`; built-in names keep their generated union.

SF15a-min accepts an empty authored world only, plus a look (day keys and a LUT, whose file is the only file allowed). It refuses other content, declared state and non-empty UI before allocation; the full loader binds those in SF15a. The asset-free backdrop and inert primary satisfy the current session ports. Unsupported format versions request a compatible client.

The browser and CLI share game-layer asset admission: exact wire hashes and sizes, bounded parsers, terrain semantics,
transitive bundle costs and the script memory growth ceiling are checked before allocating a level. Cached Wasm passes
admission again on every load. A visited product is published to Cache Storage only after all its immutable files pass;
an offline load reads those files without fetching and refuses missing or corrupted bytes. A revision keeps each saved
field's scope, name, id and type. Previous-format readers are trusted client code, and only an offline visited first-party
product may select one; provisional v0 currently has no previous format reader.
