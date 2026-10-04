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

The script host and deterministic physics-query adapter are specified and
implemented by SF11b; entity/state wiring and WebKit conformance are SF11c.
