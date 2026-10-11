# Typed AssemblyScript ABI (OS-F4)

Use `generateScriptModule(state, handler)` from `@wildshard/sdk/directorAbi`,
then compile its `source` with `compileBehaviourModule` from
`@wildshard/sdk/buildBehaviour`. The retained
[`numericScriptExample`](../../scripts/docs/authoring/director-script.ts) is
compiled and executed against the actual native ScriptLane in
`test/sdk-script-abi.test.ts`, including checkpoint restore. The existing
`generateDirectorAbi` remains the typed observation accessor for director AS
escape handlers; its output and established directors stay unchanged.

The generated module supplies every required ABI-v0 export, initialized input
and output memory, `clock`, `incomingEvents`, `shared`, `player` and `effects`.
It uses AssemblyScript `memory.data` to allocate regions; callers never guess
addresses or overlap buffers with compiler data. One 64 KiB memory page suffices
for these regions. The compiler enforces the declared maximum pages; the native
host still enforces aggregate memory, metering, event and effect budgets.

`in_ptr`/`out_ptr` are byte addresses. **`in_cap` is bytes; `out_cap` is records.**
Every effect is five f64 values `[op, a, b, c, d]`, a 40-byte record. Defaults
reserve 1,800 input bytes (32 events) and eight output records (320 bytes).
The returned `layout` provides these units, capacities and relative offsets.
Changing capacities outside 0–32 events or 1–128 effects refuses before compile.

The first eight input f64 slots are tick, dt, command, self, actor token, role,
shared-field count and player-field count. Numeric shared values follow at byte
64, sorted by stable field ID; player values follow them in stable field-ID
order. Strings have no numeric ABI and refuse. Bool getters/setters use AS
`bool`, integer fields `i32`, and floating fields `f64`. Dots and hyphens become
camelCase aliases; collisions and reserved identifiers refuse.

Event count is at relative byte 256. Events start at byte 264, stride 48 bytes:
type, target, value and three reserved zero f64s. Typed accessors bounds-check
indices. `effects.event` writes operation 3 with type, target and value.
Generated shared/player setters emit operations 5/6 with the stable field ID;
they request an atomic native commit, rather than mutate host state directly.
The native owner remains responsible for validating every value and event.

Actor tokens are observations supplied by the native host. A server binding
has `actorId: null`; it cannot grant itself a player by writing a string or an
effect. A generated player setter refuses when no actor is bound, and the host
independently validates actor provenance. The rollback test proves that an
invalid player write also discards an earlier shared write in the same call.
Initialization emits nothing; restore publishes no effects until the next
real tick.
