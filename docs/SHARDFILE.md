# Shardfile v0

`SHARDFILE_VERSION = 0` covers both the format and script ABI. This is the provisional
author contract, published by `@wildshard/sdk/shardfile` (`ShardfileSchema`,
`parseShardfile`, `Shardfile`, `shardfileRules`) and `@wildshard/sdk/version`.
The build product is `shard.json` plus immutable files named by SHA-256. No placement,
three.js object, function, closure, custom shader or source generator appears in it.

G146: the cartridge carries data, admitted AssemblyScript/WASM and baked assets.
The complete author export is checked as JSON data before any field is read: functions,
accessors, class instances, symbols and cycles are refused rather than silently erased
by JSON encoding. Named hooks are bounded field tests or next-tick event declarations;
migrations are declarative field transforms. Their reserved `asHook` remains null until
an admitted migration WASM ABI exists. JavaScript/TypeScript assets and executable
callback fields have no format arm. Build-time TypeScript config/generators compile to
this data product and are not copied into it.

`runtime` is the explicitly temporary first-party transition exception: it carries
only a registry selector, never TypeScript bytes, a fetch URL or an executable callback.
External products cannot select it. Trusted platform code and transition chunks belong
to the application build; they are not admitted author code in the cartridge.

The committed empty example is `test/fixtures/shardfile/empty.json`. Every object is
strict: unknown keys fail. Numbers are finite; counts and byte sizes are safe unsigned
integers. MB means 1,000,000 bytes. The platform owns caps in
`@wildshard/engine/core/config` (`CONTENT_CAPS`, measured caps v1).

Every shard occupies a 500×500×500 m cube. Validation reports “illegal shard”
for a missing, duplicate, displaced or elevated midpoint entryway. North is +z;
south is −z. An omitted entry `kind` means `ground`. Its boundary samples must be flat at y=0 across the opening's full width,
and admission clips the critical baked collider's native triangles against each
full 8×15 m approach. Every point must lie at y=0; an interior trench, raised
patch or missing ground fails before platform socket floors exist. An author cannot
forge a zero-height edge row to hide a raised collision surface. Non-terrain
data products use the loader's existing full-cell implicit flat ground. A transitional
trusted runtime with `terrain:null` still needs a separate proof of its legacy ground;
the cartridge check cannot infer that geometry from its runtime selector. Empty author
projects and the template explicitly declare four 8 m openings. Canonical
`ENTRY_WIDTH = 8` and `ENTRY_ASPHALT = 15` live in the engine core config;
entry width is independent from the boulevard width.

G164's explicit `kind: "socketOverWater"` permits below-zero native ground inside
the canonical footprint. Ground above zero still fails. Admission proves a continuous
collision landing across the entire 8 m shard-side line, 15 m inward, at y=0: actual
native collision triangles or active, static declared deck/stair top triangles must
cover it. Hidden, inactive or panel-controlled colliders and visible-only GLBs never
prove that landing. A `terrain:null` runtime must declare its collision deck; its
selector and the ordinary implicit flat-ground default cannot prove a socket landing.
Only this admitted kind uses the platform socket floor at top y=0 as its approach
ground. Ordinary ground entries keep the independently authored footprint requirement
and the platform's 5 mm backstop.

Each approach must also stay clear and dry. Admission inspects actual placed GLB
triangles (including node hierarchy and GPU instance transforms), every declared
box/stair collider, and water regions. Hidden panels and inactive colliders still
count because they can become active. Reusable unplaced model assets do not count
as scenery. Side walls may touch the boundary of the 8 m opening; no surface above
y=0 may enter it. Water at road height is refused; a declared sea must remain below
the road even at its bounded maximum swell. These checks run without allocating
socket floors and apply equally to implicit-flat non-terrain data products.
Every water row may declare unique `dryEntries` (at most four edge names). These clip
the whole canonical 8×15 rectangles, including their boundaries, from the swim/wade
body and the water view. A socket entry requires this explicit exclusion for any
intersecting water, even below-zero pools, streams or seas; a low rest level alone
does not establish the clip. Render adapters consume the same exclusion data.

| Section | Contract |
|---|---|
| `identity` | Kebab/dot slug, nonempty display name and author (128 characters max), positive revision, unsigned seed. No grid coordinates. |
| `accent` | Required lowercase ID from the platform’s 20-colour palette; road/safe-zone cyan is reserved. |
| `requires` | SDK revision 0; capability names; unique declared SHA-256 commons hashes and `commonsWire` (exact hash→wire bytes) and `commonsCosts` (exact hash→`{decoded, gpu, triangles, draws}`). Both maps default to `{}` only for an empty commons list; missing or extra keys fail format admission before asset reads. Costs are nonnegative safe integers derived from pinned bytes, not author estimates. |
| `budgets` | Library resident ≤25 MB and wire ≤8 MB; sim resident ≤25 MB and critical wire ≤2 MB; decode/refinement slack ≤80 MB. |
| `look` | Fixed platform family names; grade exposure/saturation/contrast and optional LUT reference; engine clock with an optional `day`; optional normalised day override; ordered day keys carrying sky gradient, fog, sun and ambient values (below). |
| `sim` | 60 Hz fixed step; positive script tick divisor dividing 60; command and snapshot schema version 0; script references. |
| `clientScripts` | Optional/default-empty presentation lane: cadence dividing 60, named creature/panel/prop/particle targets, selected public/owner numeric fields, bounded pose and emitters. |
| `rows` | Optional/default-empty numeric strikes, weather output tables, day schedules, species/variants, registered look recipes, compendium and loot presentation data. |
| `terrain`, `water` | Optional/null bounded baked terrain binding; optional/default-empty declared pools, sea and streams. |
| `creatures`, `encounters` | Optional/default-empty individual brains, ordered pack/herd groups, stable spawns and phase tables; each actor has one controller and resolves declared species/variant/strike and boss panel references. |
| `quests`, `audio`, `ledger` | Optional/default-empty quest graphs/triggers/dialogue, admitted cue/ambience/score declarations, and witnessed fact/reward mappings. |
| `hooks`, `plumbing`, `spawn` | Optional named numeric field conditions and next-tick scene events; optional scoped input/tier/Debug declarations; cell-local player position and yaw (default 0, 2, 0, 0). |
| `props`, `items`, `targets` | Optional admitted tile/library GLBs and static collider descriptors; optional/default-empty registered kit item families; named published-state panel/collider bindings and existing interaction prompts. |
| `state` | Positive state-schema version, `sharedOwner: "host"`, `playerKey: "actorId"`; named shared and per-player fields with bool/i32/f64/string type and matching default. |
| `migrations` | Optional/default-empty sequential state-version rows: bounded declarative default/rename/drop/value-map operations addressed by stable scope/field IDs. Author hooks remain reserved and null. |
| Field `privacy` | `public` replicates to everyone; `owner` only to the owning actor; `host` never leaves the host. Shared writes always belong to the host regardless of visibility. Names are unique within each state scope. |
| `authorCaps` | 1–32 players (authors may lower the room cap); in-cell speed 0–15 m/s. Highway speed belongs to the platform. |
| `serverBudget` | Positive tick budget ≤16,666 μs, positive memory ≤25 MB, ≤10,000 entities, ≤1,024 commands per tick. These are author declarations, not a server implementation. |
| `edge` | Four ordered perimeter profiles with exactly 256 (legacy native bake) or 257 (tile-bake native lattice) height and RGB samples of equal length, heights inside ±250 m, colours in [0,1], road height exactly 0. North/south samples run west→east; east/west run south→north. |
| `files` | Unique lowercase 64-character SHA-256 hash, kind (`glb`, `ktx2`, `audio`, `json`, `wasm`, `binary`), compressed/decoded/GPU byte sizes, triangles, draws including shadows, dependency references, critical flag. |
| `entryways` | Required, four unique openings: north `[0,0,250]`, east `[250,0,0]`, south `[0,0,-250]`, west `[-250,0,0]`; width exactly 8 m (`ENTRY_WIDTH`); optional kind `ground` or `socketOverWater`. Every opening reaches road height y=0 through the applicable footprint/landing proof. |
| `tiles` | L0 62.5 m or L1 125 m; integer x/z address; exact horizontal grid bounds and vertical bounds inside the 500 m cube; nonnegative geometric error; file roots and declared costs. |
| `library`, `critical`, `far` | Library roots, critical roots, optional whole-shard proxy with bounds and costs. Critical flags match critical roots. |
| `ui` | Optional (defaults to empty), at most 64 declarations, each with a unique id: `marker`, `counter`, `bagPanel`, `bossPanel`, `relabel` (below). |
| `runtime` | Optional/null first-party transition declaration `{entry: "runtime/index.ts", cost?}`; a bounded relative TypeScript entry resolved only through the trusted registry. Optional measured cost carries decimal-MB WebContent, GL and engine-base totals plus revision, device and evidence provenance. |

Manifest admission runs before schema/reference traversal and immutable asset reads.
The canonical UTF-8 JSON source is at most 2,000,000 bytes, with at most 4,096
file rows, 1,024 commons references, 128 state fields per scope and 64 water
bodies. Identifiers are at most 128 characters and free text at most 4,096.
Distinct declared wire bytes, including commons, total at most 256,000,000;
the same hash is counted once and conflicting size declarations are refused.
These bounds supplement the per-bundle content budgets and exact byte checks.
`@wildshard/sdk/admission` publishes `SHARDFILE_ADMISSION_LIMITS` and
`preflightShardfile` for checking author output before opening assets; full
`parseShardfile` and product validation still follow.

HUD accent (`@wildshard/sdk/accent`) is one required palette ID: `ember`, `coral`,
`tangerine`, `apricot`, `marigold`, `citron`, `lime`, `moss`, `jade`, `mint`, `teal`,
`azure`, `cornflower`, `periwinkle`, `iris`, `lilac`, `orchid`, `pink`, `rose`, or
`sand`. Missing IDs, unknown IDs and raw colours fail validation. The road and
safe zone keep HUD cyan `#8fe3ff`; `cyan`, `road`, `hud-cyan` and that hex are
explicitly refused. New author projects and the template declare `sand`.
Admitted shardfile metadata carries the accent into the existing manifest.

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
PBR ground layers). PBR `faceted` defaults to false; true selects flat shading.
`look.familyLooks` optionally carries `toon`, `painterly` and
`emissive` look parameters. Engine schemas fill defaults and reject unknown family
names or shader fields. Terrain and prop `family` bindings select a material ID;
the four family names also select platform defaults. Creature look rows may name a
`material` ID. Texture references resolve admitted files through the loader.

An additive material entry `{ family: "graph", graph: GraphIr }` carries engine
IR version 1 data. `validateGraph` checks node types, cycles, stage placement,
constant loops and the engine's default per-program budget (160 nodes, 4 samplers,
480 estimated instructions). Only `kind: "material"` belongs in this slot; post
passes, shader source and callbacks are refused. Graph texture params name admitted
KTX2 hashes in the charged library closure, including declared commons; they cannot
be bound. Graphs have no implicit default material: terrain, props and creature
looks reference their authored material ID.

Uniform bindings use `{state: "shared.<field>"}` or `{state: "player.<field>"}` for
public i32/f64 fields, with float params. `{day: "<path>"}` names an existing look-key
channel: `sky.zenith`, `sky.horizon`, `fog.colour`, `fog.density`, `sun.colour`,
`sun.intensity`, `ambient.sky`, `ambient.ground`, or `ambient.intensity`. Linear-fog
keys also admit `fog.near` and `fog.far`. Day bindings require at least one key;
scalar channels use float params and colour channels use colour/vec3 params.
Bindings change uniforms only. Runtime graph compilation and binding are SF59's
renderer adapter; existing preset entries keep their defaults. This additive slot
keeps SHARDFILE_VERSION at 0; version 1 is not frozen.

`@wildshard/sdk/commonsCosts` exposes the defining cost schemas and
`assertCommonsCosts(hashes, table)`. A product declares one entry per required
commons hash (at most 1024), matching `commonsWire` exactly. Decoded/GPU values
are bytes; triangles/draws are counts. The SDK derives these costs from the pinned
commons catalogue bytes. Metadata establishes the declared envelope before fetch
or cache reads; byte validation subsequently checks equality with the declaration.
Empty older products may omit both maps and parse with empty defaults.

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

`@wildshard/sdk/migrations` exposes `MigrationsSchema`, `parseMigrations` and
`DeclaredMigrations`. Each row has `{from, to: from+1, fields, asHook: null}`;
admission rejects future target versions, duplicate version steps and ambiguous
field edits. At most 64 rows contain at most 256 edits each. `default` supplies a
typed field value; `rename` preserves the stable ID; `drop` explicitly removes it;
`map` supplies bounded typed value mappings and a `keep` or `reject` fallback.
Rename and map may compose for one ID in the same row. No author code, old Wasm
memory or old physics snapshot is executed for a revision migration. The loader
restores portable declared state into fresh revision execution; additive fields
take their defaults. Same-revision full execution continuation is unchanged.

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

Client scripts run in an isolated `ClientScriptLane`, independently of authoritative
simulation ticks. Frozen neighbours animate without changing colliders, health,
shared state or the simulation clock. Bindings select a library Wasm module,
stable positive visual entity ID, name and target (`creature`, `panel`, `prop`, or
`particles` with a cell-local `at`). Creature/panel/prop IDs must exist; each target
has one visual writer. Modules cannot also be sim modules. `reads: [{scope, id}]`
selects up to 24 numeric fields by stable ID: shared reads must be public, player
reads public or owner-visible. The platform supplies the actor and copies its
permitted state. Bytecode receives no authoritative world or physics-query port.
A frozen render-only neighbour with `reads: []` needs no state world; requested
reads require an owned state view.

Input is `[tick, divisor/60, frozen, self, x, y, z, readCount, ...values]`. Query 410
with eight zero arguments returns up to 64 declared numeric parameters. Effects
101/102/103 set relative offset/rotation/scale, within authored limits: offset at
most 50 m, rotation ±π, scale 0.01–16. Effect 104 requests
`[emitterId, count, 0, 0]` particles. An admitted `platform.particles` emitter
declares linear RGB colour, size, velocity, gravity, lifetime (1–3,600 ticks),
per-tick and live counts. Aggregate ceilings are 256 particles/tick and 4,096
live across all bindings. Authoritative writes, spawns, events and physics queries
are refused. The complete batch validates before any visual output commits.
Modules share one private guest per module; three maximum-sized memory copies
are charged to the library budget and a per-instance library allocator claim.
The pooled particle view adds 56 CPU and 32 GPU bytes per live slot, capped at
4,096 slots across all emitters. `clientScriptViewCost` supplies this cost for
the library budget; each instance owns its own view claim.
Same-engine visual continuation restores memory, globals, lifetimes, quotas and
failure history without running an authoritative tick.

Named hook conditions resolve a stable numeric field ID and a typed equality value.
Shared conditions read public fields; player conditions may read the owning actor's
fields. Host-only fields stay private. Scene hooks declare a numeric event type and
value, delivered to the host-resolved actor on the next script tick. Quests, input
and Debug choices may refer only to these declared hook names; hooks require a
script binding. The platform resolves callbacks, and the product contains only data.

`targets.panels` names a prop panel, published `scope`/`fieldId` and typed `equals`
value, with `visibleWhenMatched`, collider IDs and `activeWhenMatched`. One binding
owns each panel/collider. The authoritative host updates collision after scripts;
the renderer reads the same field. `targets.interactions` supplies stable IDs,
cell-local `at`, reach radius, text label and a declared scene hook to the normal
interaction list. Item hooks select admitted modules; the trusted host supplies
their owner actor and merges explicit item handles into its single script lane.
Optional `targets.itemActions` maps a named scene to a declared tool and action
`3` (toggle) or `4` (refill). Optional `targets.itemFields` maps a tool's `fuel`
or `lit` value to a compatible player field ID. These are read-only projections
from the single authoritative item runtime, published after its fixed step.

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

`assetOverdraw(kind, bytes)` in `@wildshard/sdk/assets` returns byte-derived
`layers`, `blendedLayers` and `maskedLayers`, with `basis: "primitive-bounds"`.
For each GLB primitive it takes the largest projected triangle-area / bounding-
rectangle ratio over three local orthographic axes, then conservatively stacks
primitive, node and instance copies. The bounded triangle walk uses constant
working storage. This is a rest-pose, local-axis estimate before camera selection,
culling or occlusion; it is neither measured screen overdraw nor an admission cap.
The CLI prints it as an advisory alongside the admitted asset costs.

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

The browser product loader binds admitted terrain and prop tiles, water, creature views, equipment, script state,
quests, encounters, declared UI, audio and target interactions through the existing world/kit/play stages.
Its simulation borrows the Game's physics, player, events and fixed-step driver. Creature views share their core's
health and position; a rendered frame never steps that core. Library and critical cache leases last for the level,
while tile leases end with residency. A quota refusal permits online play without publishing an incomplete offline
visit. `emptyShardfileSource` and `loadShardfile` retain the minimal empty-world adapter for installed-driver callers.
Unsupported format versions request a compatible client. Optional `traversal.hoverCap` accepts 0.1–14 m/s,
defaults to 14 m/s, and may lower the platform's interior travel ceiling; placement and highway speed remain platform-owned.

The browser and CLI share game-layer asset admission: exact wire hashes and sizes, bounded parsers, terrain semantics,
transitive bundle costs and the script memory growth ceiling are checked before allocating a level. Cached Wasm passes
admission again on every load. A visited product is published to Cache Storage only after all its immutable files pass;
an offline load reads those files without fetching and refuses missing or corrupted bytes. A revision keeps each saved
field's scope, name, id and type. Previous-format readers are trusted client code, and only an offline visited first-party
product may select one; provisional v0 currently has no previous format reader.

The client reserves library and commons claims in the session residency allocator;
shared dependencies are charged once and leases end with the level. The grid sim
registry owns sim claims and render rings own tile claims. A grid page may share an
early home claim through an explicitly injected page residency owner.
For its data-only home, the non-ring client also reserves each combined terrain/props
tile's validated decoded plus GPU bytes before either view installs. All 16 coarse
claims survive refinement; fine claims end with their tile scopes. A deferred fine
tile leaves its coarse parent unmasked. Failed or cancelled installs release their
claims. Ring-owned callers receive no second tile claim. An owner-present opaque
runtime home keeps cache leases but skips separate home library and tile charges,
because its measured whole-home claim already includes those parts.
The loader uses that owner's allocator before bootstrap and checks that the declared
sim resident budget fits inside the existing home claim. Data-only products account
their admitted parts separately; only opaque trusted runtime homes use a measured total.
Trusted runtime
homes require that claim before their shell world runs; no empty budget or one-byte
placeholder substitutes for the measurement. Optional `runtime.cost` contains
`webContentMB`, `glMB`, `engineBaseMB`, `rev`, `device` and a `progress/memory/*.json`
evidence path. Accounted bytes are derived once as the upward-rounded
`(webContentMB + glMB - engineBaseMB) * 1e6 / residentFactor`; the allocator applies
its calibration and current engine base. Root activation requires reviewed metadata;
missing metadata never acquires a placeholder claim. The live registry retains the same claim,
while the composition root releases the boot reference after consumers dispose.
Local instance checkpoints
retain admitted script continuation, item fuel/cooldowns/queued commands, quest flags,
current steps and dialogue. They restore silently before panel/collider bindings,
without replaying rewards or replacing the Game physics world. A changed revision
or incompatible continuation starts fresh. SF15a proves same-revision logical restore;
SF33 owns cross-revision migrations, tested on real saves before the version 1 freeze.

A transitional first-party product may declare `runtime`. Asset admission refuses
that declaration for external products, including cached ones. The ordinary product
installer refuses it too: the admitted data plugin must enter the explicit hybrid
compositor, whose trusted registry matches both shard slug and entry. Content cannot
select an import URL. Neighbours retain data without running trusted play hooks;
entering a cell installs those hooks in its child scope and leaving disposes them.
The trusted compositor may explicitly request `trustedRuntime` for a first-party
runtime declaration. When its data/content/assets are empty, the data stages add no
services; the existing runtime supplies gameplay and presentation. Authored data
still installs normally, and external empty products retain the ordinary Game path.

First-party picker manifests may carry a built `shardfile` URL. The normal entry
admits that same-origin source before starting the session, retaining the manifest's
canonical slug, picker art and catalogue save instance. Offline admission reads the
complete visited product without requesting its source or immutable files again.

Creature look recipe `platform.skin` names a library JSON hash in `parameters.skin`.
The JSON contains one exported `{row, binding}` rig declaration and depends on exactly
one admitted GLB. Animation recipe `platform.clips` takes an `attackSpan` in seconds
(default 1, bounded 0.05–10). The rig, clips and numeric pose layers are validated
without importing a renderer; the client samples the same exported clips as the skin player.

Quest `track` defaults to true; false leaves the HUD tracker empty while retaining
quest state, map presentation and completion/reward handling. The teaching template
keeps its previous untracked adventure. Declared item views mount in the normal
equipment viewmodel host, including off-hand tools, and leave with the level scope.

Edge rows retain every native boundary vertex; 129-point decimation is refused. A modern terrain collider is 257² and carries 257 samples per side, without resampling. When a 256-point neighbour meets a 257-point neighbour, the platform strip uses the sorted union of their native positions (511 points), so both exact boundaries survive.

`creatures.brains` accepts `pursue`, `skirmisher`, `guardian`, `perch-hunter`,
`ram-grazer`, `challenge-grazer`, `orbit-diver`, `patrol-diver`, `burst-flyer` and `script`
policies. The three native families use the strict schemas in `shardfile/brains`;
their optional `thinkDivisor` defaults to six and must divide 60. Decisions run at
that cadence, and the owning body recipe runs once per fixed step. The loader
preflights all actor identities and native recipe ports before registering any
brain callback. Native perception, attack tokens, floor/reach, rise/sink,
perches, projectiles and movement remain explicitly injected trusted recipes;
missing recipes refuse boot rather than inventing gameplay. Policy contracts,
actor memory and RNG restore without executing a decision or body callback.
`pursue` retains its existing platform behavior. A custom `script` policy declares
an admitted module in `sim.scripts`, a `thinkDivisor` dividing 60, bounded
`maxSpeed`, `maxStrafe` and `maxTurnRate`, up to 64 finite parameters, and up to
32 unique numeric strike events resolving `rows.strikes`. No actor handle is
accepted from this declaration. The factory derives a trusted `brain:<actorId>`
alias per spawn and rejects collisions with actor, item and director handles.
All aliases count toward the one `serverBudget.entities` allowance.

The two grazer families use `shardfile/grazers` and the author adapter
`@wildshard/sdk/grazers`. A ram grazer names a `rows.strikes` lane profile with
positive windup and range; a challenge grazer names distinct lane-charge and
arc-close profiles plus distinct windup/recovery actor-memory fields. Both
default to a six-tick decision divisor. The full factory and client require
explicit `brains.ramGrazer` or `brains.challengeGrazer` recipes for observations,
native body work and the matching named strikes. Missing ports or mismatched
strike identities refuse before brain callbacks, RNG draws or actor-memory
writes. One actor callback runs divisor-scheduled decisions, fixed-step policy
action and native body work. Mutable policy and strike clocks are snapshotted
with their cadence and tuning contracts; restoration runs no observations,
body work or random draws.

Flying policies use `shardfile/flyers` and name a declared sphere strike and a
home inside the cell. Their spawned species must declare `flight`: finite
`altitude` (-250..250), positive `climbRate` and `diveRate` (at most 30 m/s),
optional `above` (`ground` or `world`, engine default ground), positive
`lockRange` (at most 600 m), and optional `bank` strictly between 0 and pi/2.
The species resolver copies this data into the existing flight motor; omission
keeps a ground species. Trusted `brains.orbitDiver`, `brains.patrolDiver` and
`brains.burstFlyer` recipes supply observations, native body work and the named
sphere strike; the burst contact shove is an authorized host operation. Decisions
default to six ticks, policy action and body work run once per fixed step, and
mutable flight/policy/strike state restores without observations or RNG draws.

Custom policies and numeric state share one module union and one host: memory,
fuel, queries, effects, events and quarantine are charged once per fixed tick,
with independent binding cadences. Brain effects request bounded motion and
named strikes only; they cannot use the numeric role to write shared state.
The factory requires injected observation, attack-token and strike recipes;
missing recipes refuse boot. Its structural numeric-state facade preserves
quest/item plumbing and snapshots both roles and the one host together.
Restoration executes no observation or decision; logical migration extracts
only the explicit numeric role, preserving historical standalone saves.

`creatures.groups` defaults to `[]` and admits at most 64 pack or herd controllers.
Each declares a unique controller ID, strict finite tuning, six-tick decisions
and an ordered roster of at most 128 stable actor IDs. That roster must exactly
match the spawn order whose `brain` names the group. Individual, group and
encounter controllers cannot share an actor or controller ID. One group policy
owns the roster; body work runs once per live actor per fixed step.
The client injects trusted perception, shared RNG, prey/taming, contact and
steering recipes through `groups`; absent recipes refuse boot. All group,
individual, custom-script alias and encounter admission finishes before group
initialization. Cold setup consumes shared RNG in declared group order once.
Each group has one typed snapshot adapter; restoration skips initialization
and executes no observation, decision or body work.

`audio` retains `cues`, nullable wind `ambience` and `score: "silent" | "default"`.
Its optional `routing` defaults to an empty ordered array. At most 512 cue rules
select catalogue voices on the audio or combat bus; each has at most 16 actions
and 16 conditions. Actions may apply bounded numeric defaults and a scope-owned
delay of 0–60 seconds. Routing contains no author callback or random draw.

Optional `samples` selects a catalogue set, bed and at most 32 loop gains in
0–8. Optional `music` declares the score ID/base, up to 32 slots and boot slots,
slot-to-set mappings, `pluck` or `marimba` lead, a 0–60-second minimum fade, and
up to 64 ordered selection rows (`first` or `all`). Its nullable source names
an `/assets/music/<slug>/` directory and manifest key, without a free-form URL.
Optional `zones` declares mixer timing, up to 64 named levels, 16 room wetness
values and 512 uniquely named radial ambience zones. These are validated data;
catalogue resolution, existing sample decoders, bar-grid scheduling, geometry
queries and bespoke synthesis remain trusted platform/runtime installers.

The full client owns declared audio by default. An explicit `audioOwner: "runtime"`
binding is allowed only for a trusted first-party runtime declaration, whose
installer consumes the same audio data once. This transition avoids duplicate
cues, beds and scores; ordinary authored products use the declared installer.
