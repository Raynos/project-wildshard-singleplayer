# Script ABI v0

The provisional shardfile version 0 uses the numeric core-Wasm ABI in
`@wildshard/engine/script/abi`. `scripts/compile-script.mjs` compiles author source
in Node with pinned AssemblyScript 0.28.20 and Binaryen 132.0.0. The stub runtime
uses the host's imported `env.memory`, initially one page and at most 64 pages
(4 MiB). No Rust or native toolchain is involved.

Required exports are `abi_version():i32` (returns 0), `__start():void`,
`init(lo:i32,hi:i32):void`, `in_ptr():i32`, `in_cap():i32` (bytes),
`out_ptr():i32`, `out_cap():i32` (records), `out_count():i32`, and
`on_tick():void`. The host calls initialization explicitly after admission;
Wasm start sections are forbidden. Inputs and effects use little-endian f64
slots. Entity handles arrive through the input record, never through separate
instances for each entity.

Imports are limited to `env.memory`, `env.abort(i32,i32,i32,i32):void`,
`env.query(kind:i32,request:i32,response:i32):i32`, and the instrumenter's
`env.enter():void`, `env.leave():void`, `env.fuel(cost:i32):void`.
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
mutable globals, sign extension, saturating conversions, and memory copy/fill.
SIMD, threads/shared memory, GC/reference types, exceptions, tail calls,
memory64, multiple memories, passive segments and float reinterpretation are
rejected. Banning float reinterpretation prevents observation of engine-specific
NaN payloads; finite numbers are required when data crosses the host ABI.
An AS library function that inspects floating-point bits needs a deterministic
implementation before this ABI can admit it.

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
incoming/outgoing events and 64 queries per tick, 2,000,000 fuel per call and
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
Entity/state bindings and WebKit script conformance are SF11c.
