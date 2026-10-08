# Script ABI v0

The provisional shardfile revision `0.x` uses numeric core-Wasm ABI version 0 in
`@wildshard/engine/script/abi`. `scripts/compile-script.mjs` compiles author source
in Node with pinned AssemblyScript 0.28.20 and Binaryen 132.0.0. The stub runtime
uses the host's imported `env.memory`, initially one page and at most 64 pages
(4 MiB). No Rust or native toolchain is involved.
`compileScript(source, { maximumPages: 8 })` may lower the declared maximum
to fit several modules in the sim budget; the default is 64 and v0 refuses
values outside 1..64. Runtime cost counts three maximum-sized guest copies
per unique module, independent of the number of entity/actor bindings.

The [generated schema and ABI reference](api/SHARDFILE.md) derives every required
import/export call signature and the toolchain/limits table from the defining
`SCRIPT_IMPORTS`, `SCRIPT_EXPORTS` and `SCRIPT_ABI` constants. Missing, duplicate,
obsolete or stale call entries fail checks; adding a call requires regenerating
the committed reference through the serialized pusher. `env.memory` is the
host-supplied memory import, not a function call. Instrumented `__state_<index>`
exports depend on each admitted module's mutable globals; admission verifies those
module-specific snapshots separately. The sections below explain call ordering,
record layout and authority, which a numeric signature alone cannot express.

Required exports are `abi_version():i32` (returns 0), `__start():void`,
`init(lo:i32,hi:i32):void`, `in_ptr():i32`, `in_cap():i32` (bytes),
`out_ptr():i32`, `out_cap():i32` (records), `out_count():i32`, and
`on_tick():void`. The host calls initialization explicitly after admission;
Wasm start sections are forbidden. Inputs and effects use little-endian f64
slots. Entity handles arrive through the input record, never through separate
instances for each entity.

Imports are limited to `env.memory`, `env.abort(i32,i32,i32,i32):void`,
`env.query(kind:i32,request:i32,response:i32):i32`, and the instrumenter's
`env.enter():void`, `env.leave():void`, `env.fuel(cost:i32):void`,
`env.finite32(f32):f32` and `env.finite64(f64):f64`.
No clock, host transcendental math, entropy, DOM or filesystem is exposed.

The JS instrumenter reads and rewrites Binaryen's IR. Every author function
becomes an implementation behind an exact enter/call/leave wrapper. All calls
and exports target those wrappers, enforcing the host's 64-level call-depth
limit independently of the native Wasm stack. Every implementation entry and
loop header charges a positive fuel amount conservatively exceeding its entire
function byte length. Optimization happens before instrumentation, never after.
This deliberately overcharges loops; changing the accounting requires an ABI
revision and rebuilding every first-party module.

`@wildshard/engine/script/admission` exports `admitScript(bytes)`. It validates
and inspects the actual bytes without instantiation or execution, independently
of metadata, hashes and custom sections. It checks wrappers, every entry/loop
charge, call targets, import signatures and required export signatures. A valid
SHA-256 hash establishes identity, not admission. Every mutable numeric global
must have its instrumented `__state_<index>` snapshot export.

V0 caps modules at 256 KiB, functions/types at 512, globals at 128 and locals at
1,024 per function. Tables are capped at zero: indirect calls and function
references are rejected. Allowed features are core numeric instructions,
mutable globals, sign extension and saturating conversions. Bulk memory
operations are refused: charging their opcode alone would let a forged module
copy megabytes for tiny fuel costs. The compiler disables bulk-memory lowering
and uses metered ordinary instructions; libm lookup data is active and bounded.
SIMD, threads/shared memory, GC/reference types, exceptions, tail calls,
memory64, multiple memories and passive segments are rejected. Every float
constant, load, arithmetic/conversion result and integer-to-float reinterpretation
must immediately pass through the matching finite guard. Admission verifies
the actual opcode sequence; removing a check is refused before execution.
Non-finite float globals are refused at admission and snapshot restore.
The guards each charge one fuel and trap on NaN/infinity before it can enter
state or effects. This closes both NaN sign/payload inspection and snapshot-bit
differences; merely banning reinterpretation would not close an integer load
of a stored NaN. AssemblyScript's deterministic libm and bit helpers remain
usable for finite computations. Overflow and non-finite intermediate calculations
trap, even when the author would have later converted them to finite effects.

`@wildshard/engine/script/host` provides `ScriptHost`, with one instance per
module name and entity handles in IN[3]. A host represents one active cell's
simulation. `beginTick(tick)` accepts only increasing integer ticks and drains
prior queued events. A call supplies up to 32 finite input slots; IN[0] must
match the current tick. IN[32] is event count, followed by six slots per event.
Regions must be aligned, disjoint and within memory, and their pointers/caps
remain fixed after initialization.

Effects are five f64 slots each. `SCRIPT_OP.field` writes the current entity's
declared field `[fieldId,value,0,0]`; `spawn` requests `[archetypeId,x,y,z]`;
`event` queues `[typeId,targetHandle,value,0]`; `position` requests `[x,y,z,0]`.
Ids, reserved slots, finite values and declared ranges are checked before any
world state changes. Coordinates stay inside ±250 m. `ScriptWorld` stages a
complete next state and publishes it once. Requests for future approved gameplay
systems extend this provisional ABI; these numeric effects do not install those
systems or resolve movement/collision themselves.

Default per-host limits are eight instances, 128 effects, eight spawns, 32
incoming/outgoing events and 64 queries per tick, 2,000,000 fuel per call,
8,000,000 fuel shared by all calls in a tick and
three failures before module disablement. Hosts may lower every limit. The
aggregate script-memory allowance is 24,000,000 bytes, reserving three capped
copies per module (live memory, good snapshot, in-flight copy). Each module's
actual host memory maximum is lowered to its remaining share; this may refuse
another instance before the instance-count ceiling is reached. Worlds cap at
10,000 entities. No effect recursively delivers an event.

The pure `env.query` import reads eight f64 request slots and writes at most 96
finite response slots. Each query charges 256 fuel and one shared query unit.
`scriptPhysicsQueries` implements raycast of world solids (origin xyz,
direction xyz, max distance, reserved), axis-aligned overlap (centre xyz,
half extents xyz), nearest walkable point and path (start xyz, end xyz, agent
radius). It delegates to engine physics/navigation, sorts unique overlap ids,
limits path search to 128 nodes and returns at most 32 points. Collision owner
handles are supplied by the host. Cross-engine conformance records these
replies; it does not require physics to be bit-identical across engines.

On a trap or invalid output, no effects publish. The host discards the instance,
creates a new capped instance and copies the last good memory and every mutable
global into it without executing initialization again. The invoking entity
freezes and becomes noninteractive. Only development hosts report its entity
and module name through the diagnostic callback. Explicit `resume` is required
to retry; disabled modules cannot resume. Snapshots are copies, and `restore`
validates their capacity and complete global names before replacing an instance.
`DeclaredScriptWorld` adds shared (`5`) and player (`6`) field effects with
`[stableFieldId,value,0,0]`. Only declared bool (0/1), i32 and finite f64 fields
participate in the numeric ABI; strings remain format fields but have no numeric
script binding. IDs are explicit, preserved across revisions and sorted when
forming inputs. Actor ids come from host bindings; a player effect cannot name
another actor. The full batch stages entity, shared and private state together.
Public views omit host-only fields and never expose another actor's player state.

`ScriptLane` runs server and entity bindings locally, one instance per module,
in module-name/entity-handle order at the declared divisor of 60 Hz. Its input
slots are tick, dt, actor command, entity, actor token, role (server=0/entity=1),
shared count, player count, then shared/player numeric values sorted by field id.
At most 24 numeric fields fit the 32-slot input record. `installScriptLane`
registers the work through `SimHost.onStep` and a scoped snapshot adapter.
`lane.enqueue({ type, target, value })` lets trusted gameplay/quest hooks queue
a declared event for the next script tick, under the same 32-event bound.
Conditions read declared fields instead of calling arbitrary author exports.
The actor-to-target mapping belongs to the trusted session dispatcher.
The lane snapshot includes memory, all globals, shared/player/entity state,
queued events, tick allowances, failure counts and disabled state. Restore
creates fresh instances without executing author initialization.

Run `scripts/browser-lane.sh --max 5 node scripts/script-conformance.mjs` for
the cross-engine gate (also a push/PR CI job). Node and Playwright WebKit run
the same admitted bytes with identical ABI inputs and recorded query replies;
every effect, fuel total and complete restored state must match exactly. The
fixture exercises AssemblyScript libm, f32 narrowing, i64 globals, memory
growth, all four query kinds and separate actor state. Physics itself is outside
this cross-engine contract.
