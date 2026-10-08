# Shardfile 0.x

The [generated schema and script ABI reference](api/SHARDFILE.md) lists the actual
fields, optionality, defaults, union branches, bounds and Wasm signatures used by
`@wildshard/sdk/shardfile`. It is regenerated from the same schema the SDK validates,
through the serialized push; stale copies fail the committed-output check. Named
cross-field predicates remain opaque in the inventory and are explained below.

## Budget-first admission

The SDK emits `validation.json` with the canonical declaration SHA-256, validator
source revision, and conservative worst-location totals after full asset validation.
Only the client build’s own first-party catalogue or a locally admitted visited
product may reuse that exact verdict; authored/network sidecars are never trusted.
The validator revision includes parser dependency versions. A matching trusted verdict
skips repeated asset-cost and headless validation; it does not trust a network sidecar
or bypass immutable verification. Any declaration or validator change runs full validation
again. Every admission
still checks schema/closure, exact immutable wire sizes and SHA-256, runtime trust,
and the current page’s complete memory caps. Unbundled clients validate in full.

`wildshard build <folder>` and `wildshard validate <folder>` print the SF62 report:
near-player and worst-location grid memory, declared draws/triangles per view,
SF59 graph cost, measured script CPU/fuel, critical/tile/library downloads and
estimated time to playable. New/outside projects refuse wire/render/execution target
overages; the six canonical trusted-checkout shards warn during conversion.
Author identity alone cannot select that warning policy.

The **only hard memory caps** are complete totals: **1,000 MB playing / 1,800 MB
loading**. Category resident targets can trade space and appear as warnings.
Dependency integrity, actual-byte/cost understatement, script host limits and runtime
total-memory admission stay hard. Build observes 60 ticks before writing output;
validate retains the full headless simulation and entry proof. Native transition
portions without a measurement are labelled UNMEASURED rather than counted as zero.

The cold-loading model is unique playable bytes / 1 MB/s + 1 s setup. This is an
explicit estimate, not observed device performance. Measure cold-cache fetch,
decode, compile, admission and first playable frame separately. See
[the author targets, good/bad cards and completion checklist](SHARDS.md#performance-comes-first).
`@wildshard/sdk/reportCard` provides the same structured report for author tooling.

`SHARDFILE_VERSION = "0.1"` covers both the format and script ABI. This is the provisional
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
a registry selector and bounded data metadata, never TypeScript bytes, a fetch URL
or an executable callback.
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
| `meshCollision` | Optional/null exact WMC1 critical triangle tiles and interactive panel colliders; mutually exclusive with terrain. Runtime integration is pending (SF55a). |
| `nativeGround` | Optional/null `{version:1,file}` retaining the original critical WSTR256 binary of a trusted runtime world. Mutually exclusive with compiled terrain and mesh collision; no second collider is installed. |
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
| `entryways` | Required, four unique openings: north `[0,0,250]`, east `[250,0,0]`, south `[0,0,-250]`, west `[-250,0,0]`; width exactly 8 m (`ENTRY_WIDTH`); optional kind `ground`, `socketOverWater`, `socketLift` or `portalLink`. A lift names its admitted movers and may declare a permanent static approach. A portal names two directed links and static arrival/deck floors. Every opening reaches road height y=0 through its footprint/landing/traversal proof. |
| `tiles` | L0 62.5 m or L1 125 m; integer x/z address; exact horizontal grid bounds and vertical bounds inside the 500 m cube; nonnegative geometric error; file roots and declared costs. |
| `library`, `critical`, `far` | Library roots, critical roots, optional whole-shard proxy with bounds and costs. Critical flags match critical roots. |
| `ui` | Optional (defaults to empty), at most 64 declarations, each with a unique id: `marker`, `counter`, `bagPanel`, `bossPanel`, `relabel` (below). |
| `runtime` | Optional/null first-party transition declaration `{entry: "runtime/index.ts", cost?, binds?}`; a bounded relative TypeScript entry resolved only through the trusted registry. Optional measured cost carries decimal-MB WebContent, GL and engine-base totals plus revision, device and evidence provenance. |

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

Material graphs with the standard lighting model may add `stages.lighting`:
required `sun` (vec3 direct-diffuse radiance), optional `sunSpecular` (float scaling
the sun's physical specular; omitted means no specular), optional `ambient` (vec3
indirect diffuse; omitted uses irradiance × albedo / π), and optional `grade`
(vec3 mapping `litColour` after lighting and emissive, before the output transform).
A graded material bypasses tone mapping; the engine still appends its fog/output
epilogue. Unlit and post graphs cannot carry a lighting stage. Graph-level optional
`flatShading: boolean` selects face normals; omission preserves smooth shading.
This addition keeps IR version 1 and the same author caps.

Lighting reads engine-supplied `normalView`, `viewDirection` and `albedo` inputs;
`sunDirection`, `sunColour` and `sunShadow` are restricted to sun evaluation,
`irradiance` to ambient, and `litColour` to grade. All lighting subgraphs are typed
and costed by the same validator. Toon/painterly engine presets use this stage;
their trusted preset budget does not become a shardfile author budget.

Material graphs may also add `stages.outline: { offset, colour }`: both references
produce vec3 values (scalar values broadcast under the existing graph rules),
with a model-space displacement evaluated in the vertex
stage and linear ink colour evaluated without lighting inputs. The inverted hull
has fixed render state: back faces, depth test and write, opaque, unlit, fogged and
no shadow. Author data cannot change that state. Outline evaluation counts toward
the same program budget and raw graph caps, including unused nodes.

`objectOrigin` and `positionGeometry` supply vertex-only vec3 inputs;
`worldToLocal(vec3)` changes a world-space direction to model space in the vertex
stage; `viewToWorld(vec3)` changes a view-space direction to a unit world-space
direction in mesh stages. Types and stage placement remain validated.
These additions keep IR version 1. The engine compiler supports the second hull
draw, but the shardfile client's current one-material-per-ID adapter does not yet
attach an outline mesh: admitted outline data is preserved and costed, but is not
yet drawn by that client. A mesh-level binding is still required.

Before typing or compilation, graph admission bounds the raw JSON to 64,000
UTF-8 bytes, depth 64 and 160 declared nodes across every nested node table,
including unreachable nodes and loop bodies. The reachable program still must
fit the sampler/instruction budget and the loop-expanded node budget. Content
cannot supply a larger budget; an explicit trusted engine preset budget does not
widen the shardfile slot. Accessors and serializer callbacks are refused without
invocation. These per-graph caps supplement the whole-manifest admission limits.

Uniform bindings use `{state: "shared.<field>"}` or `{state: "player.<field>"}` for
public i32/f64 fields, with float params. `{day: "<path>"}` names an existing look-key
channel: `sky.zenith`, `sky.horizon`, `fog.colour`, `fog.density`, `sun.colour`,
`sun.intensity`, `ambient.sky`, `ambient.ground`, or `ambient.intensity`. Linear-fog
keys also admit `fog.near` and `fog.far`. Day bindings require at least one key;
scalar channels use float params and colour channels use colour/vec3 params.
Bindings change uniforms only. Runtime graph compilation and binding are SF59's
renderer adapter; existing preset entries keep their defaults. This additive slot
keeps SHARDFILE_VERSION in 0.x; the format never freezes.

`@wildshard/sdk/commonsCosts` exposes the defining cost schemas and
`assertCommonsCosts(hashes, table)`. A product declares one entry per required
commons hash (at most 1024), matching `commonsWire` exactly. Decoded/GPU values
are bytes; triangles/draws are counts. The SDK derives these costs from the pinned
commons catalogue bytes. Metadata establishes the declared envelope before fetch
or cache reads; byte validation subsequently checks equality with the declaration.
Empty older products may omit both maps and parse with empty defaults.

Admission checks declared transitive library, critical, tile/far and worst-location
costs before immutable asset network or cache reads. An oversized declared envelope
is refused at that stage. Hashes and parsed asset headers are then validated;
actual costs cannot exceed their declarations, and commons costs must match exactly.
Declared metadata never substitutes for byte validation or raises a budget.

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

First-party products rebuild every build. The client accepts current `"0.1"`; the only
previous-version exception is offline-cached first-party content.
Older content needs upgrade without touching its source or saves. A version bump
migrates all first-party source and retains saves in one commit. Outside authors
must update `version`, `requires.sdk`, the sim ABI and affected fields, then rebuild
and validate; incompatible state changes require an explicit save migration.
The format never freezes or cuts stable 1.0 in this plan (G195). Every breaking
change increments the integer revision in the canonical string `"0.<revision>"`
and migrates all first-party declarations and affected saves in that commit.
`requires.sdk` names the same string; command/snapshot ABI integers change only
when their own contracts change. No float comparison is used: 0.10 follows 0.9.
Malformed strings, unsupported revisions and numeric versions are refused by
normal admission. One bounded trusted reader explicitly names the previous wire
form, legacy integer `0`: only a completely visited first-party offline cache
can select it. It rewrites the two version fields, then repeats the current
strict grammar, graph/cost and immutable-byte admission. Missing old fields or
corrupt old assets remain refused. Online upgrades compare strict saved-state
lineage before publishing a new visit, preserving identity and migration rules.
The legacy reader is replaced explicitly at the next revision, never carried
forward as a general old-format or external-content bypass.

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

## Authored world source (SF55a, build input)

`@wildshard/sdk/worldSource` exports `WorldSourceSchema`, `WorldSource` and
`parseWorldSource`. This validates the build-only `world` declaration planned for
`shard.config.ts`; `world` is not a compiled `Shardfile` field. This first contract
slice does not yet make `wildshard build` ingest a world GLB: the CLI currently still
requires compiled shardfile data. The normalization API below is available;
texture/LOD tools, mesh collision and the build adapter follow in SF55a before
the Blender Template (SF55).

`@wildshard/sdk/bake/world` now exposes the memory-only normalization stage:
`await normalizeWorldGlb(bytes, world, admittedMaterialIds)`. It takes one embedded
static GLB and checks mapped output IDs against the supplied admitted material
catalogue. It returns indexed static and collision primitives, independent panels,
source material parameters and content-hashed embedded image bytes. It does not yet
write tile files, encode images, simplify geometry or install colliders.

Intake is bounded before accessor decode: at most 256 MB wire, 2 MB JSON,
10,000 rows per glTF collection, 64 hierarchy levels and 64 million accessor
components. Expanded placed geometry has at most 4 million vertices and 12 million
indices. Each embedded PNG/JPEG/WebP is at most 25 MB and 4,096 pixels per dimension.
External buffers/images, compression/extensions, skins, animation, morph targets,
cameras and unsupported vertex attributes fail explicitly in this static-world
stage. A source has exactly one scene and no disconnected nodes. Duplicate node or
material names, missing annotations and overlapping object/panel or collision/panel
subtrees fail with a diagnostic.

Normalization applies exact affine hierarchy matrices, including shear and negative
scale, without reducing them to TRS. Static positions use cell coordinates; normals
use the inverse transpose, tangents retain handedness, and mirrored triangle winding
is corrected. Panels retain their root world matrix and root-local primitives; their
geometry is excluded from merged static collision and tiles. Collision-prefix
subtrees supply collision only. Mesh collision shares static triangle topology,
preserving elevated bridges and overhangs. Terrain-prefix selection remains a flag
for the later sampling stage. Embedded images, material factors, UV0 and each
colour/normal/metallic-roughness/occlusion/emissive texture use and sampler survive;
unmapped materials, unused mapping names, invalid samplers and missing UV0 fail.
Repeated normalization leaves the caller's bytes unchanged and produces equal data.

```ts
import { parseWorldSource } from '@wildshard/sdk/worldSource';

const world = parseWorldSource({
  glb: 'assets/world.glb',
  materials: { 'Grey clay': 'world.clay', 'Door paint': 'world.door' },
  colliders: 'nodes:ws_collision_',
  objects: { Bridge: 'bridge' },
  interactive: [
    { node: 'Hall door', id: 'hall.door', colliderId: 'hall.door.collider' },
  ],
});
```

The GLB path is project-relative with forward slashes, a `.glb` suffix and no
absolute path, traversal, URL, query, encoded path segment or backslash. Material
names and node names are exact, case-sensitive glTF names (spaces and Blender's
numeric suffixes are preserved), at most 128 characters, without controls or edge
whitespace. Mapping keys `__proto__`, `prototype` and `constructor` are refused.
Every referenced glTF material must map to an admitted material ID in `look.materials`
or a platform default; the GLB ingest stage will check that coverage and refuse
unsupported materials instead of skipping them. The table has 1–256 mappings.

`colliders: 'mesh'` selects world mesh geometry; `nodes:<prefix>` explicitly selects
collision nodes by a nonempty literal name prefix. The ingest stage must refuse a
missing selection, apply node transforms, and preserve bridges and overhangs with
mesh collision. Nodes named with the `ws_terrain` prefix identify terrain sampling
inputs; they do not make non-heightfield geometry disappear.

Optional `objects` maps up to 1,024 noninteractive node names to stable object IDs.
Optional `interactive` lists up to 64 named nodes with stable panel `id` and
`colliderId`. Both collections default empty. Names and object/panel IDs are unique
across the two collections; interactive collider IDs are unique within their own
namespace. IDs are lowercase `[a-z][a-z0-9.-]*`, at most 128 characters. An interactive
node is excluded from static tiles and merged collision and becomes its own panel
and collider with the authored transform. Annotations live in config data, never
glTF extras or callbacks. Node existence and overlapping selected hierarchies are
checked when the GLB is ingested, not by this declaration-only parser.

Export from Blender as **glTF Binary**, **+Y up**, with **Apply Modifiers** and
materials exported. Units are metres and the shard-local origin is the cell centre;
the full transformed world stays in the 500 m cube. Author four clear, dry, flat
8×15 m entry footprints at the midpoints, at y=0. Existing entryways, spawn, material
look, gameplay data rows and admitted AssemblyScript remain separate author inputs;
the platform draws the asphalt socket after admission. The SDK ingest will produce
content-addressed tiles, LODs, collision, edge profiles and far geometry without
requiring a project generator or runtime.

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
product may select one; the 0.1 client explicitly supports the bounded integer-0 cache transition.

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
SF33 owns cross-revision migrations, tested on real saves as the 0.x format evolves; there is no version 1 freeze.

A transitional first-party product may declare `runtime`. Asset admission refuses
that declaration for external products, including cached ones. The ordinary product
installer refuses it too: the admitted data plugin must enter the explicit hybrid
compositor, whose trusted registry matches both shard slug and entry. Content cannot
select an import URL. Neighbours retain data without running trusted play hooks;
entering a cell installs those hooks in its child scope and leaving disposes them.
The trusted compositor may explicitly request `trustedRuntime` for a first-party
runtime declaration. Optional `runtime.binds` is a unique array of at most three
section names: `"quests"`, `"ledger"`, `"items"`. Omitted or `[]` means none; unknown
names, duplicates, null and unknown runtime keys are refused. The defining
`RuntimeBindsSchema` is composed by `RuntimeSchema` at the full schema's `runtime`
slot; it is not a second permissive format or a source-code hook.

Every bound section remains ordinary declared data and passes its full schema,
reference and budget checks before binding. The admitted source retains those rows.
Only the trusted data client's installation view removes bound sections, preventing
duplicate installation. Bound rows alone do not activate the full data gameplay
loader; unbound behaviour and other authored content retain their ordinary path.
If the remaining data/content/assets are empty, data stages add no services and the
existing runtime supplies gameplay and presentation. External products still refuse
a runtime declaration, and external empty products keep the ordinary Game path.

The trusted runtime explicitly calls the game-owned installers in
`@wildshard/game/shardfile/hybridRows` inside its play scope:

- `quests`: bind validated quest state to runtime flags and world-piece marker
  positions; completion facts use the declared ledger. The chip stays declared data
  (maximum 18 characters).
- `ledger`: emit only declared facts with placement/revision/entity provenance;
  the platform ledger grants rewards once, including after rebind.
- `items`: install declared weapon/tool rows and loadout with kit families or the
  trusted shard's `<slug>.<name>` families. The runtime registers declared input
  contexts through its entered-scope path. This binder refuses item script hooks;
  declaring ownership does not invent an independent simulation lane.

`binds` grants no runtime trust or automatic installation. The registered first-party
entry must still match the same slug and entry exactly, and a runtime cannot bind a
section it did not declare. Leaving the cell disposes its entered services; revisits
bind the same admitted rows through the ordinary retained/restored lifecycle.

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

Crowd declarations use optional top-level `crowds` (default `[]`), an ordered array
of flock rows from `@wildshard/sdk/crowds`. Each row names its stable ID, home x/z,
member count, seed, roaming range, run/walk/graze speeds and bleat cue. Admission
allows at most 64 unique rows and 4,096 members, requires home centres in the cell,
and counts members alongside creature spawns against `serverBudget.entities`.
Trusted recipes supply terrain bounds, perception, sound and presentation; data
cannot supply callbacks. The full client and headless factory share those injected
ports, preflight every recipe, then initialize only after the remaining simulation
admission succeeds. Each crowd owns one fixed callback and snapshot adapter;
restore skips setup draws and resumes its ordered member state/private RNG. The
minimal empty client refuses crowd content. No live shard changes selection here.

The authored-world texture encoder is `@wildshard/sdk/bake/textureWasm`:
`bakeWorldTexture(bytes, 'srgb' | 'linear')` reads a bounded still PNG/JPEG/WebP,
then emits UASTC KTX2 with a complete mip chain. The SDK pins
`@loaders.gl/textures` 4.5.3 (its packaged Basis Universal encoder JS and WASM),
`sharp` 0.34.5 for raster decode, and `meshoptimizer` 1.2.0 for the following LOD
slice. Encoder artifacts are SHA-256 checked before ordinary Node module loading;
there is no system `basisu` requirement or CDN download. Settings are single-thread
UASTC, quality 128, mip generation, and KTX2 UASTC Zstandard supercompression;
colour/emissive chooses sRGB transfer and normal/ORM chooses linear transfer.
Input dimensions are at most 4096², wire size at most 25 MB, with one still frame.
The existing generator helper `bakeColourTexture` keeps its historical system-tool
output; this additive helper is the portable authored-world path. The subsequent
world bake will call it and charge its output through ordinary KTX2 admission.

Authored-world LODs use `@wildshard/sdk/bake/worldLod` and pinned meshoptimizer
1.2.0 WASM. `simplifyWorldPrimitive(primitive, ratio, maxErrorMetres)` runs per
material, locks topological borders, weights normals/UV/colours/tangents and
retains original float64 positions and attributes for every surviving vertex.
It never merges material surfaces, moves bridge decks or converts them to a
heightfield. The returned triangle count is the actual result: seams/topology
or the error limit can prevent the requested ratio. `errorMetres` is meshopt's
absolute appearance-error estimate with a two-sided float32 position allowance,
not an independent Hausdorff measurement. If float32 precision alone exceeds
the ceiling, it returns unchanged geometry. Admission charges the actual output;
a triangle target is never treated as proof that the output fits a cap.

### Authored-world material bindings (SF55a)

Native world conversions can use `@wildshard/sdk/bake/nativeLattice`:
`sliceNativeLattice(source, lod)` accepts the original 256 or 257 vertex lattice,
explicit triangle indices (including its diagonal and holes) and bounded named
vertex channels. It clips those triangles into all 64 L0 or 16 L1 squares without
resampling heights, normalising attributes or simplifying geometry. Original
samples remain exact; cut vertices interpolate the original triangle attributes.
Supported channels include normal, UV, colour, splat and Nalati's `surf` vec4,
`rdir` vec2 and `zone` vec3. Collision retains its original native bake; this is
render geometry only. `simplifyNativeLatticeTile` from
`@wildshard/sdk/bake/worldLod` then simplifies L1 with locked tile and hole
borders, retaining exact surviving channel values. Report its actual count and
appearance-error estimate (not an independent Hausdorff bound), and charge the
emitted geometry; the target ratio is not a guaranteed reduction.

`props.materials` is an optional exact map from each source glTF material name
(case and spaces preserved) to `{id, colour?, normal?, metallicRoughness?,
occlusion?, emissive?}`. The id selects an admitted `look.materials` entry or
platform family default. Each non-null slot names a KTX2 file and its glTF sampler
(`wrapS`, `wrapT`, `minFilter`, `magFilter`); normal also carries `scale` and
occlusion `strength`. One file takes one sampler and one colour/data role. Named
materials replace `props.textures`; every GLB carries its used slot files as
dependencies, charged with that GLB. Format admission checks ids, supported slots
and declared references; immutable-byte admission refuses any unmapped or unnamed
GLB material, naming it. Omitting this map preserves the existing one-family path.

`props.splat` optionally declares `{material, layers: {colour: [four KTX2 hashes],
normal: [four KTX2 hashes], arm: [four KTX2 hashes]}, tints: [four linear RGB
triples], boreal: null | {normalK: [four factors], trailDust: [four factors]}}`.
Its exact GLB material name is the sole exception to `props.materials`; it cannot
also be a named prop slot. Each GLB using that name must directly declare all
layer files as dependencies. These compressed bytes are preserved and deduplicated;
colour and numeric roles cannot share a file, and array-owned layers cannot also
be ordinary material textures. Native terrain GLBs carry `_SPLAT` vec4 and
`_CANOPY` scalar channels. `WorldBakeRows.finish(family, {materials?, splat?})`
packs the same declaration and verifies each GLB's own dependencies. Forest
records and their renderer residency remain a separate pending product seam.

### Authored-world collision bake (SF55a)

`@wildshard/sdk/bake/worldCollision` exposes `bakeWorldCollision(normalized)`.
It clips actual collision triangles to the 62.5 m L0 lattice and emits nonempty,
ordered tile rows plus independent interactive collider rows and content-addressed
WMC1 bytes. It applies panel root matrices (including mirrored winding) into the
rest world pose; panels stay out of the static collision tiles. Collision receives
no LOD or heightfield conversion, so overhangs and ground below a bridge remain.
Shared edges interpolate in a canonical direction and exact Float32 positions are
welded within a chunk. A vertical surface exactly on a lattice line belongs to the
positive-side tile (or the last tile at +250), preventing duplicate boundary walls.

Each chunk is bounded to 40,000 triangles and 120,000 referenced vertices. Invalid
indices, nonfinite/out-of-cell geometry, singular panel matrices and triangles
that collapse at Float32 precision fail with the source node/panel name. Empty
intersections contribute no file. The caller's normalized geometry is unchanged,
and repeated bakes produce identical immutable bytes. This helper does not yet
write the compiled collision section or install it through
`wildshard build`; those are the next integration steps. A native capsule fixture
crosses 140 m with more than 98% aggregate travel and no blocked step or fall;
Rapier casts still briefly slow at flat internal diagonals, so this is not a
per-step 98% freedom proof or a completed SF55a playability verdict.

Collision residency is provisionally `2 * wireBytes + 64 * vertices + 256 *
triangles`, charged as decoded sim memory with no GPU resources or render draws.
Native snapshots at several chunk sizes check serialized growth against that
allowance; they do not measure native heap usage. SF22a must replace this model
with measured allocation costs before a shard using it ships.

The compiled section is optional/default-null:
`{version:1, tiles:[{x,z,file}], panels:[{id,panel,file,initialActive}]}`.
Tile addresses are unique integers 0–7 on the 62.5 m grid (at most 64); panels
are bounded to 64 with unique collider and render-panel identities. Every file
is an independent critical binary root with no dependencies; repeated chunk
hashes are refused to avoid counting one file for two native allocations.
Actual triangle positions must stay inside the declared tile. Panels resolve
declared prop panels, and their stable collider ids participate in the existing
published-state target bindings without authored physics callbacks.
The section excludes `terrain`; it preserves layered geometry instead of
inventing an implicit flat heightfield. Metadata and exact asset admission are
implemented; full validation and runtime construction explicitly refuse these
products until native restore, entry-footprint and client integration land.

### Socket lift declarations (SF8c)

`@wildshard/sdk/socketLift` defines the bounded data link
`{mover, roadStop, topStop, route, gate, rideTicks}`. Both ids resolve to admitted
SF30 mover rows; stops and route points are shard-local feet coordinates. The
route begins at the top stop and continues to playable ground; at most 32 points
and 3,600 fixed ticks per ride are admitted. The deck loads at its road stop,
flush with y=0, covers the full eight metre boarding line with at most a five
centimetre seam, and stays at least ten metres inside the cell at both stops.
Unknown movers, missing gates, mid-travel authored starting poses and undersized
decks refuse before physics allocation.
An optional `lift.approach: {colliders, route}` instead proves a permanent static
approach from the socket to a narrower boarding deck. It names 1–32 unique
`props.colliders` rows, active at load, with no panel or activation binding. Its
2–16 road-height waypoints start at the socket's inner midpoint (north +235 z,
south −235 z, east +235 x, west −235 x), stay ten metres inside the cell and
total at most 32 m including the final walk onto the deck. Real top triangles
must cover the full eight metre static mouth and the capsule-width corridor;
only the final static-to-moving seam permits a gap of at most five centimetres.
The deck must support the real capsule at its road stop. A static road gate
remains mandatory. Visual meshes, implicit ground and platform socket floors
cannot prove this approach. Without `approach`, the direct eight metre moving
deck rule is unchanged. This declaration alone is not a legal
entry: the executable admission must walk the real capsule, interact through
`MoverRuntime.command`, ride the admitted WASM-controlled deck, reach playable
ground, return and call from both stops. It must also witness the platform gate
blocking the road while the deck is away. The compiled `entryways` row uses
`kind: "socketLift"` and a `lift` with this shape. Other kinds refuse a lift link.
The optional top-level `movers` array defaults to `[]`; every mover module is
a critical admitted `sim.scripts` WASM module. Compiled chains remain refused
until native joint reconnection is available.

The executable helper `proveSocketLift(entry, {physics, runtime, fixedStep,
waterAt?, approachSource?})` uses the admitted `MoverRuntime` and the engine's real capsule motor.
The platform-owned `fixedStep` advances its single script host, mover and physics
world; author data cannot supply it. `commandSocketLift` is the normal queued
interaction used by both admission and play. A probe initializes feet once on
the road; subsequent travel is collision movement and platform carry. It checks
boarding, a complete ride, walking onto static playable ground, automatic idle
return, return travel and calls from both ends, with gate collision across 23
overlapping road capsule lanes. Deck motion above 15/60 metres per fixed step
is refused as a teleport. Temporary capsules dispose even on refusal. This
helper is an executable check, not a stored readiness flag. When `approach` is
declared, `approachSource` supplies the admitted `props` and collider activation
bindings; the ordinary factory supplies it automatically. The proof walks the
static waypoints out and back, verifies actual named floor support, and refuses
unowned hidden floors, low headroom, submerged paths or a gate that changes pose.
At touching floors and the admitted seam it queries named collision support
without changing the rider's position. The gate may toggle collision, but must
remain stationary throughout the ride and both calls. SDK headless validation
runs it in the same authoritative factory as the client. Ordinary edges retain
their full 50 metre walk; each lift adds 23 gate lanes and reports its two rides
and two stop calls. A fresh independent world starts each lift at its road stop.

Movers, numeric state and custom brains share one host and one `beginTick`, with
all module memory, entities, fuel and effects charged to that host. Lift-only
modules cannot also own numeric bindings, custom brains or persistent movers.
Their memories/globals, published poses and queued interactions are transient:
a fresh load resets the deck to `roadStop` and opens its gate, while persistent
numeric progress and the global tick continue. Native restore reconnects the
same saved body handles; it allocates no duplicate deck or gate and performs no
physics/gameplay tick. A lift rider checkpoint stores only the stable entry edge.
Loading puts that rider at the reset road boarding point after checking the real
upright capsule against current deck and obstacle poses. Missing, submerged or
blocked boarding falls back to the normal admitted safe spawn. This load policy
never teleports a capsule during the traversal admission proof.

Mesh entry admission clips every actual WMC1 triangle to the canonical 8 × 15 m footprints. Ground entries require exact continuous area coverage at y = 0 from permanent static chunks; gaps, slopes and panel-only ground are refused. All mesh panels, including inactive ones, are checked for above-road obstructions. Socket-over-water entries additionally require a continuous full-width permanent collision landing at the inner line; platform floors and interactive mesh panels cannot prove that landing. The existing dry-entry water exclusions still apply.

### Portal entry links (SF8c, G224)

An entry may declare `kind: "portalLink"` and `portal: {road, destination, exit, links, route}`. Each endpoint is `{id, at: [x,y,z], floor, yaw?}`; yaw defaults to zero and is bounded to ±π. The road endpoint sits at y=0 on the centreline of its canonical 8×15 m deck. Exactly two directed links are admitted: `road.id -> destination.id` and `exit.id -> road.id`. Unknown, missing, duplicate or conflicting bindings refuse. The 2–32-point cell-local route starts at the arrival and ends at the exit; this route is walked, not teleported. `@wildshard/sdk/portalLink` supplies the strict schema and parser.

Every endpoint names an active permanent static prop collider or `mesh.tile.x.z`; a moving, hidden, target-controlled or platform collider cannot bind it. Exact projected collision triangles must cover the entire road deck and every endpoint's capsule footprint. Existing footprint admission also refuses above-road dressing and water (intersecting water needs its canonical dry-entry exclusion). Above or below a stacked floor, a transfer queries only its named collision owner, never an implicit plane.

Headless validation uses the normal authoritative simulation factory, with implicit ground disabled in the portal proof world. Each entry proves 23 overlapping real capsule lanes across its full-width deck, a bound transfer to the destination, a native walk along the route, a transfer through the exit back to its deck, then a walk to the road. Counts report `portalTransfers` as well as lanes and steps. A gap, low headroom, submerged or blocked route refuses; every temporary capsule is disposed on either result.

The game-layer `createPortalTraversal` uses the existing physics, capsule and feet. `teleport(fromId)` rechecks the bound source and destination with `canStandAt`, including named static floor and full capsule clearance, before any pose change; it returns the admitted destination yaw. Transfers are synchronous and never evaluate author code. `portalTransitioning(physics)` fences profile/coin/continuation writes and native snapshots from validation through completion. Refused transfers leave the feet unchanged; no checkpoint contains a mid-transfer pose. Render and interaction bindings remain with the normal client view owner.

Native world-only hybrids retain the original `terrain.bin` as `nativeGround.file`, an independent critical binary root. Admission checks WSTR v1, the native 256² lattice over 500 m, the identity seed, finite cell-bounded heights, bounded placement metadata, exact full 256-sample boundary rows and every continuous 8×15 m entry footprint. The native runtime owns collision and interactive geometry. Render tiles do not replace its native physics, and a standalone flat declared simulation proxy is refused. The renderer-free native collision/worker adapter remains a follow-up; this byte witness is not a claim that arbitrary trusted gameplay has been headlessly replayed.
