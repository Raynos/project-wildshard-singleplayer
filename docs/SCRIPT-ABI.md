# Script ABI v1 — as built

Reviewed against local `main` at `74cc3361d`, 2026-10-17, for G484(b).
This is the executable contract, including its gaps. The design and future
feature ownership are recorded in [G484](plans/shard-platform/decisions.md).
Source links give the defining file and line at this revision; concurrent
uncommitted work is excluded. Z9 retires the unused client-field fallback;
weather step rows supply eased presentation state (G484/G486).

## Authoring, compilation and admission

A v1 row in `sim/scripts` declares `abi: "1.0"`, `side`, an authored
`behaviour/*.as` source, a `blobs/wasm/<sha256>.wasm` module, binding, capabilities,
state, parameters, pages and fallback. Only `side: "sim"` reaches `ShardDecisions`;
the simulation owner rejects view bindings. The unused client-only field
fallback was retired with Z9. Weather field rows are ordinary presentation
data and do not start a view script.

Use `buildDecisionScripts(project, rows, registries, options)` (or
`compileDecisionScripts` with in-memory sources). It inspects all authored AS,
requires the exported `on…` handlers to match `on` exactly, generates binding
constants and glue, compiles with `abi: 1`, admits the actual bytes, and names
immutable Wasm blobs. Glue is virtual compiler input, not shard runtime TS.
Project intake replaces `sim/scripts` with these freshly compiled rows.
[sdk/buildDecisionScripts.ts:27](../src/sdk/buildDecisionScripts.ts#L27) [sdk/buildDecisionScripts.ts:40](../src/sdk/buildDecisionScripts.ts#L40) [sdk/buildDecisionScripts.ts:91](../src/sdk/buildDecisionScripts.ts#L91) [sdk/decisionSource.ts:48](../src/sdk/decisionSource.ts#L48) [sdk/projectDecisions.ts:37](../src/sdk/projectDecisions.ts#L37)

`compileScript` defaults to **v0** unless passed `abi: 1`. For v1 it uses fixed
initial/maximum memory (default one page, allowed 1–4), the stub AS runtime,
imported memory, `-O3`, explicit `__start` and disabled bulk-memory lowering.
The pinned toolchain is AssemblyScript 0.28.20 / Binaryen 132.0.0.
`buildBehaviour` is the retained v0/native build path, not the v1 row compiler.
[sdk/bake/compileScript.ts:99](../src/sdk/bake/compileScript.ts#L99) [format/scriptAbi.ts:2](../src/format/scriptAbi.ts#L2) [sdk/buildBehaviour.ts:29](../src/sdk/buildBehaviour.ts#L29) [sdk/buildBehaviour.ts:57](../src/sdk/buildBehaviour.ts#L57)

Admission reads bytes without running them: it checks signatures, structural
meter/depth wrappers, function and loop fuel charges, finite-float guards and
mutable-global exports. V1 also refuses `memory.grow`; tables, start sections,
passive data, indirect calls, bulk operations and non-numeric features are
outside the admitted instruction/section whitelist. A hash alone is not
admission. [format/scriptAdmission.ts:58](../src/format/scriptAdmission.ts#L58) [format/scriptAdmission.ts:31](../src/format/scriptAdmission.ts#L31) [format/scriptAdmission.ts:82](../src/format/scriptAdmission.ts#L82) [format/scriptAdmission.ts:96](../src/format/scriptAdmission.ts#L96) [format/scriptAdmission.ts:102](../src/format/scriptAdmission.ts#L102) [format/scriptAdmission.ts:120](../src/format/scriptAdmission.ts#L120) [format/scriptContract.ts:11](../src/format/scriptContract.ts#L11)

## Transport and call order

All function imports are from `env`; `env.memory` is the host-owned memory
import. These are the complete v1 function interfaces. [format/scriptAbiV1.ts:45](../src/format/scriptAbiV1.ts#L45) [format/scriptAbiV1.ts:49](../src/format/scriptAbiV1.ts#L49) [format/scriptAdmission.ts:74](../src/format/scriptAdmission.ts#L74)

| Direction | Name | Signature / meaning | Source |
|---|---|---|---|
| Export | `ws_abi` | `() → i32`, must return 1 | [engine/script/decisionModule.ts:37](../src/engine/script/decisionModule.ts#L37) |
| Export | `ws_init` | `(lo: i32, hi: i32) → void`; generated glue initializes IO, ignores seed arguments | [sdk/decisionScriptBindings.ts:89](../src/sdk/decisionScriptBindings.ts#L89) |
| Export | `ws_io` | `() → i32`, aligned byte address of IO | [engine/script/decisionModule.ts:39](../src/engine/script/decisionModule.ts#L39) |
| Export | `ws_handle` | `() → i32`, returns command count | [sdk/decisionScriptBindings.ts:92](../src/sdk/decisionScriptBindings.ts#L92) |
| Import | `ws_read` | `(op: i32, a: f64, b: f64) → f64` | [format/scriptAbiV1.ts:52](../src/format/scriptAbiV1.ts#L52) |
| Import | `ws_list` | `(op: i32, a: f64, b: f64, out: i32, cap: i32) → i32`; count is f64 slots, not points | [format/scriptAbiV1.ts:52](../src/format/scriptAbiV1.ts#L52) [engine/script/decision.ts:344](../src/engine/script/decision.ts#L344) |
| Import | `enter`, `leave` | `() → void`, metered call-depth guards | [format/scriptAbiV1.ts:50](../src/format/scriptAbiV1.ts#L50) [engine/script/decisionModule.ts:27](../src/engine/script/decisionModule.ts#L27) |
| Import | `fuel` | `(cost: i32) → void` | [format/scriptAbiV1.ts:50](../src/format/scriptAbiV1.ts#L50) |
| Import | `abort` | `(i32, i32, i32, i32) → void`, traps | [format/scriptAbiV1.ts:50](../src/format/scriptAbiV1.ts#L50) [engine/script/decisionModule.ts:32](../src/engine/script/decisionModule.ts#L32) |
| Import | `finite32`, `finite64` | `(f32) → f32`, `(f64) → f64`; charge and trap on NaN/infinity | [format/scriptAbiV1.ts:51](../src/format/scriptAbiV1.ts#L51) [engine/script/decisionModule.ts:58](../src/engine/script/decisionModule.ts#L58) |

At module construction the host admits, instantiates, calls optional `__start`,
checks `ws_abi`, calls `ws_init`, reads `ws_io`, then captures the initialized
memory image and mutable globals. There is one instance per module key **within
a DecisionHost**, shared by that host's bindings. [engine/script/decisionModule.ts:21](../src/engine/script/decisionModule.ts#L21) [engine/script/decision.ts:174](../src/engine/script/decision.ts#L174)

Before each call it rewinds the entire memory image and globals, writes inputs,
then invokes `ws_handle` once for the event batch. Generated glue dispatches
handlers in inbox order. Scratch globals/heap changes do not survive to the next
call. [engine/script/decisionModule.ts:70](../src/engine/script/decisionModule.ts#L70) [engine/script/decision.ts:260](../src/engine/script/decision.ts#L260) [sdk/decisionScriptBindings.ts:88](../src/sdk/decisionScriptBindings.ts#L88)

| IO area | Little-endian f64 slots, relative to `ws_io()` | Source |
|---|---|---|
| Header | 0 tick; 1 elapsed seconds since last successful call (first: tick/60); 2 binding id; 3 self handle; 4 event count; 5–7 zeroed/reserved | [engine/script/decision.ts:263](../src/engine/script/decision.ts#L263) [sdk/as/ws.ts:9](../src/sdk/as/ws.ts#L9) |
| State | Starts at slot 8, in row declaration order; bool is 0/1 | [format/scriptAbiV1.ts:34](../src/format/scriptAbiV1.ts#L34) [engine/script/decision.ts:72](../src/engine/script/decision.ts#L72) [engine/script/decision.ts:265](../src/engine/script/decision.ts#L265) |
| Params | After actual state slots, names sorted lexically | [format/decisionBindings.ts:40](../src/format/decisionBindings.ts#L40) [engine/script/decision.ts:181](../src/engine/script/decision.ts#L181) |
| Inbox | After actual params; 16 reserved records of `[kind, subject, a, b, c, d]` | [format/scriptAbiV1.ts:27](../src/format/scriptAbiV1.ts#L27) [format/scriptAbiV1.ts:31](../src/format/scriptAbiV1.ts#L31) [format/scriptAbiV1.ts:34](../src/format/scriptAbiV1.ts#L34) |
| Outbox | After all 96 inbox slots; 32 reserved records of `[op, target, a, b, c]` | [format/scriptAbiV1.ts:28](../src/format/scriptAbiV1.ts#L28) [format/scriptAbiV1.ts:32](../src/format/scriptAbiV1.ts#L32) [format/scriptAbiV1.ts:40](../src/format/scriptAbiV1.ts#L40) |

Successful calls stage commands, declared slots, timers and RNG together; the
**next fixed step** commits them. Every command and state value must validate
before preparation succeeds. A trap/refusal publishes none of that call's
staged changes; its consumed inbox batch is not retried automatically.
[engine/script/decision.ts:227](../src/engine/script/decision.ts#L227) [engine/script/decision.ts:280](../src/engine/script/decision.ts#L280) [engine/script/decision.ts:298](../src/engine/script/decision.ts#L298) [engine/script/decision.ts:302](../src/engine/script/decision.ts#L302)

## Events

IDs are defined by `scriptAbiV1.ts:2`; handler argument positions come from the
generated bindings (`Event.subject` remains available for implicit subjects).
**Works** means a production route exists, not that every shard subscribes.
**Not wired** means an id/handler exists but lacks its delivering lane or producer.
[format/scriptAbiV1.ts:2](../src/format/scriptAbiV1.ts#L2) [sdk/decisionScriptBindings.ts:34](../src/sdk/decisionScriptBindings.ts#L34)

| Id | Event / generated handler | Status and actual payload / producer | Source |
|---|---|---|---|
| 1 | `start` / `onStart()` | Works: binding activates | [game/shardfile/decisions.ts:336](../src/game/shardfile/decisions.ts#L336) |
| 2 | `tick` / `onTick(dt)` | Works: explicit `tick: 1, 2, 5, 10`; no subscription means no periodic event | [format/decisionScripts.ts:26](../src/format/decisionScripts.ts#L26) [engine/script/decision.ts:250](../src/engine/script/decision.ts#L250) |
| 3 | `timer` / `onTimer(timer)` | Works: timer deadline reached; subject is timer id | [engine/script/decision.ts:237](../src/engine/script/decision.ts#L237) |
| 4 | `zone.enter` / `onZoneEnter(zone, actor)` | Works: quest region boundary, subject zone / a actor | [game/shardfile/decisions.ts:386](../src/game/shardfile/decisions.ts#L386) |
| 5 | `zone.leave` / `onZoneLeave(zone, actor)` | Works: same region observation | [game/shardfile/decisions.ts:386](../src/game/shardfile/decisions.ts#L386) |
| 6 | `interact` / `onInteract(target, player, verb)` | Works in native simulation: picker validates selected target, then queues target / player / verb=0; G484 still requires its first-script proof | [game/plugin/simulation.ts:575](../src/game/plugin/simulation.ts#L575) [game/shardfile/decisions.ts:431](../src/game/shardfile/decisions.ts#L431) |
| 7 | `hit` / `onHit(by, amount, hpShare)` | Works: damage dealt; subject damaged actor | [game/shardfile/decisions.ts:166](../src/game/shardfile/decisions.ts#L166) |
| 8 | `threshold` / `onThreshold(index)` | Works: encounter/borrowed phase changes; subject actor; phase index in a | [game/shardfile/decisions.ts:395](../src/game/shardfile/decisions.ts#L395) |
| 9 | `death` / `onDeath(by)` | Works: actor death; subject dead actor | [game/shardfile/decisions.ts:172](../src/game/shardfile/decisions.ts#L172) |
| 10 | `move.done` / `onMoveDone(move, ok)` | Works: move completion; subject actor | [game/shardfile/decisions.ts:377](../src/game/shardfile/decisions.ts#L377) |
| 11 | `strike.done` / `onStrikeDone(strike, hit)` | Works: runner finished or start refused; subject actor | [game/shardfile/decisions.ts:300](../src/game/shardfile/decisions.ts#L300) [game/shardfile/decisions.ts:380](../src/game/shardfile/decisions.ts#L380) |
| 12 | `flag` / `onFlag(flag, value)` | Works: world flag change; subject flag / a 0 or 1; player-flag writes do not emit this event | [game/shardfile/decisions.ts:165](../src/game/shardfile/decisions.ts#L165) [game/shardfile/decisions.ts:305](../src/game/shardfile/decisions.ts#L305) |
| 13 | `signal` / `onSignal(signal, value, source)` | Works: signal command or mover end; subject signal / a value / b source actor (0 for mover end) | [game/shardfile/decisions.ts:309](../src/game/shardfile/decisions.ts#L309) [game/shardfile/decisions.ts:406](../src/game/shardfile/decisions.ts#L406) |
| 14 | `strike.target` / `onStrikeTarget(target, by, strike)` | Not wired: handler/id reserved; decision owner has no strike-target event producer | [sdk/decisionScriptBindings.ts:42](../src/sdk/decisionScriptBindings.ts#L42) [game/shardfile/decisions.ts:380](../src/game/shardfile/decisions.ts#L380) |
| 15 | `player.join` / `onPlayerJoin(player)` | Works as binding activation notification for the local player; not a network membership event | [game/shardfile/decisions.ts:348](../src/game/shardfile/decisions.ts#L348) |
| 16 | `player.leave` / `onPlayerLeave(player)` | Works as binding deactivation notification | [game/shardfile/decisions.ts:348](../src/game/shardfile/decisions.ts#L348) |
| 17 | `spawned` / `onSpawned(spawn)` | Spawn-owned programs deliver it to the declared actor binding after a committed spawn | [game/population/spawnScript.ts:225](../src/game/population/spawnScript.ts#L225) |
| 18 | `stop` / `onStop()` | Works: binding deactivates | [game/shardfile/decisions.ts:349](../src/game/shardfile/decisions.ts#L349) |
| 30 | `field` / `onField(actor, field, value)` | Not wired: no v1 view lane; refused by sim host | [engine/script/decision.ts:138](../src/engine/script/decision.ts#L138) [engine/script/decision.ts:157](../src/engine/script/decision.ts#L157) [sdk/decisionScriptBindings.ts:45](../src/sdk/decisionScriptBindings.ts#L45) |
| 31 | `cue` / `onCue(cue, actor)` | Not wired: same view-lane restriction | [engine/script/decision.ts:157](../src/engine/script/decision.ts#L157) [sdk/decisionScriptBindings.ts:45](../src/sdk/decisionScriptBindings.ts#L45) |
| 32 | `channel` / `onChannel(channel, value)` | Not wired: same view-lane restriction | [engine/script/decision.ts:157](../src/engine/script/decision.ts#L157) [sdk/decisionScriptBindings.ts:46](../src/sdk/decisionScriptBindings.ts#L46) |

Enqueue never calls Wasm synchronously. Unsubscribed events are ignored; active
game bindings receive publications, and the decision scheduler drains up to
16 events per binding per decision tick. Disabling a binding cancels staged
work/timers but still allows queued lifecycle events to drain.
[game/shardfile/decisions.ts:409](../src/game/shardfile/decisions.ts#L409) [engine/script/decision.ts:205](../src/engine/script/decision.ts#L205) [engine/script/decision.ts:211](../src/engine/script/decision.ts#L211) [engine/script/decision.ts:248](../src/engine/script/decision.ts#L248) [engine/script/decision.ts:269](../src/engine/script/decision.ts#L269)

## Read whitelist

Only capabilities listed in the row's `reads` may run. The host checks finite
arguments, declared namespace IDs and observed actor handles. Binding-owned
actors are observed initially; event actors, `nearestPlayer` and actor/player
lists extend visibility for the current call. Observation alone does not grant
body ownership. Each scalar/list query charges 256 fuel. [engine/script/decision.ts:267](../src/engine/script/decision.ts#L267) [engine/script/decision.ts:318](../src/engine/script/decision.ts#L318) [engine/script/decision.ts:344](../src/engine/script/decision.ts#L344) [engine/script/decision.ts:359](../src/engine/script/decision.ts#L359) [engine/script/decisionModule.ts:33](../src/engine/script/decisionModule.ts#L33)

Scalar op IDs are a separate namespace from list op IDs. Generated `Read`
methods have these argument shapes; omitted wire arguments are zero.
[format/scriptAbiV1.ts:8](../src/format/scriptAbiV1.ts#L8) [format/scriptAbiV1.ts:14](../src/format/scriptAbiV1.ts#L14) [sdk/decisionScriptBindings.ts:7](../src/sdk/decisionScriptBindings.ts#L7) [sdk/as/ws.ts:27](../src/sdk/as/ws.ts#L27)

| Id | Scalar `Read` | Result as built | Source |
|---|---|---|---|
| 1 | `x(actor)` | Position x | [game/shardfile/decisions.ts:209](../src/game/shardfile/decisions.ts#L209) |
| 2 | `y(actor)` | Position y | [game/shardfile/decisions.ts:210](../src/game/shardfile/decisions.ts#L210) |
| 3 | `z(actor)` | Position z | [game/shardfile/decisions.ts:210](../src/game/shardfile/decisions.ts#L210) |
| 4 | `yaw(actor)` | Actor/player yaw | [game/shardfile/decisions.ts:211](../src/game/shardfile/decisions.ts#L211) |
| 5 | `hpShare(actor)` | Current/max health | [game/shardfile/decisions.ts:212](../src/game/shardfile/decisions.ts#L212) |
| 6 | `alive(actor)` | bool | [game/shardfile/decisions.ts:213](../src/game/shardfile/decisions.ts#L213) |
| 7 | `field(actor, field)` | Declared public numeric actor field; unavailable/private/string fields refuse | [game/shardfile/decisions.ts:244](../src/game/shardfile/decisions.ts#L244) [game/shardfile/decisions.ts:250](../src/game/shardfile/decisions.ts#L250) |
| 8 | `distance(actor, target)` | Horizontal xz distance | [game/shardfile/decisions.ts:207](../src/game/shardfile/decisions.ts#L207) |
| 9 | `nearestPlayer(actor)` | Local living player handle or 0; encounter bindings return 0 outside their spherical arena | [game/shardfile/decisions.ts:198](../src/game/shardfile/decisions.ts#L198) |
| 10 | `flag(flag)` | World bool flag | [game/shardfile/decisions.ts:194](../src/game/shardfile/decisions.ts#L194) |
| 11 | `timerLeft(timer)` | Nonnegative seconds remaining; local declared timer | [engine/script/decision.ts:330](../src/engine/script/decision.ts#L330) |
| 12 | `random()` | Seeded [0,1), advances staged binding RNG counter | [engine/script/decision.ts:331](../src/engine/script/decision.ts#L331) |
| 13 | `actorInZone(actor, zone)` | bool; circular xz quest region | [game/shardfile/decisions.ts:188](../src/game/shardfile/decisions.ts#L188) [game/shardfile/decisions.ts:208](../src/game/shardfile/decisions.ts#L208) |
| 14 | `playersInZone(zone)` | 0 or 1 for the single local player | [game/shardfile/decisions.ts:196](../src/game/shardfile/decisions.ts#L196) |
| 15 | `moving(actor)` | Whether decision owner has a move runner | [game/shardfile/decisions.ts:215](../src/game/shardfile/decisions.ts#L215) |
| 16 | `strikeState(actor)` | 0 idle, 1 windup, 2 active, 3 recover, 4 cooldown | [game/shardfile/decisions.ts:216](../src/game/shardfile/decisions.ts#L216) |
| 17 | `playerFlag(player, flag)` | Local player's decision-owned flag; another player refuses | [game/shardfile/decisions.ts:195](../src/game/shardfile/decisions.ts#L195) |
| 18 | `spawnGroupAlive(spawn)` | Live member count for a declared creature group or script spawn group; an actor spawn id returns 0/1 | [game/shardfile/decisions.ts:200](../src/game/shardfile/decisions.ts#L200) [format/decisionBindings.ts:50](../src/format/decisionBindings.ts#L50) [format/decisionBindings.ts:76](../src/format/decisionBindings.ts#L76) |
| 19 | `bearing(actor, target)` | `atan2(dx, dz)` | [game/shardfile/decisions.ts:207](../src/game/shardfile/decisions.ts#L207) |

`ws_list` writes at most 96 finite f64 slots to an aligned in-memory range;
generated `Read` list calls return the slot count and `List.at(index)` retrieves
values until the next list call. Ground/navigation xz inputs must stay within
±250; navigation requires the supplied navigation owner.
[engine/script/decision.ts:344](../src/engine/script/decision.ts#L344) [sdk/as/ws.ts:28](../src/sdk/as/ws.ts#L28) [game/shardfile/decisions.ts:219](../src/game/shardfile/decisions.ts#L219)

| Id | List `Read` | Response | Source |
|---|---|---|---|
| 1 | `actorsInZone(zone)` | Non-player actor handles, sorted ascending, truncated to capacity | [game/shardfile/decisions.ts:234](../src/game/shardfile/decisions.ts#L234) |
| 2 | `playersWithin(actor, radius)` | Local living player handle if within 3D radius; radius ≥ 0 | [game/shardfile/decisions.ts:236](../src/game/shardfile/decisions.ts#L236) |
| 3 | `groundHeight(x, z)` | One y value (or none at zero capacity) | [game/shardfile/decisions.ts:220](../src/game/shardfile/decisions.ts#L220) |
| 4 | `nearestWalkable(x, z)` | xyz triple or empty | [game/shardfile/decisions.ts:224](../src/game/shardfile/decisions.ts#L224) |
| 5 | `path(actor, target)` | At most 32 xyz triples / 96 slots; agent body radius, search bound 128 | [game/shardfile/decisions.ts:228](../src/game/shardfile/decisions.ts#L228) |
| 6 | `radial(yaw, radius)` | xz offset `[sin(yaw) * radius, cos(yaw) * radius]`; radius 0–10,000 | [game/population/spawnScript.ts:108](../src/game/population/spawnScript.ts#L108) |

There is **no v1 raycast/overlap query**. Those belong to v0's separate
`env.query` protocol (`raycast=1`, `overlap=2`, `nearest=3`, `path=4`).
[format/scriptAbiV1.ts:8](../src/format/scriptAbiV1.ts#L8) [format/scriptAbiV1.ts:14](../src/format/scriptAbiV1.ts#L14) [engine/script/queries.ts:7](../src/engine/script/queries.ts#L7)

## Commands and authority

The row's `commands` is a capability whitelist; IDs, finite values, owned
actors, observed targets and mechanic-specific bounds are checked before the
batch can stage. Generated `Do` helpers write the following records (unused
trailing slots are zero). The game handlers currently read `[op,target,a,b]`;
this does not promise validation of every unused slot.
[engine/script/decision.ts:286](../src/engine/script/decision.ts#L286) [engine/script/decision.ts:359](../src/engine/script/decision.ts#L359) [sdk/decisionScriptBindings.ts:21](../src/sdk/decisionScriptBindings.ts#L21) [sdk/as/ws.ts:23](../src/sdk/as/ws.ts#L23) [game/shardfile/decisions.ts:274](../src/game/shardfile/decisions.ts#L274)

| Id | Command / record after op | Status and authority | Source |
|---|---|---|---|
| 1 | `move`: `[actor, move, target, 0]` | Works: own body, declared engine move; target required for stalk/dive/takeoff/ring-run; engine runs motion each fixed step | [game/shardfile/decisions.ts:278](../src/game/shardfile/decisions.ts#L278) [game/shardfile/decisions.ts:286](../src/game/shardfile/decisions.ts#L286) [game/shardfile/decisions.ts:352](../src/game/shardfile/decisions.ts#L352) |
| 2 | `strike`: `[actor, strike, target, 0]` | Works: own actor, declared strike, nonzero target; actual strike owner may decline and emit done/false | [game/shardfile/decisions.ts:300](../src/game/shardfile/decisions.ts#L300) |
| 3 | `stop`: `[actor, 0, 0, 0]` | Works: stops own move; cancels a windup, does not forcibly cancel later strike phases | [game/shardfile/decisions.ts:280](../src/game/shardfile/decisions.ts#L280) [game/shardfile/decisions.ts:329](../src/game/shardfile/decisions.ts#L329) |
| 4 | `field`: `[actor, field, value, 0]` | Works: own actor, declared public numeric shared field, type/bounds checked | [game/shardfile/decisions.ts:281](../src/game/shardfile/decisions.ts#L281) [game/shardfile/decisions.ts:244](../src/game/shardfile/decisions.ts#L244) |
| 5 | `spawn`: `[0, spawn, 0, 0]` | Spawn owner resolves declared recipe/species/site and available capacity; a group binding creates only its own slot | [game/population/spawnScript.ts:207](../src/game/population/spawnScript.ts#L207) |
| 6 | `despawn`: `[actor, 0, 0, 0]` | Spawn owner retires its bound body through the real roster/manager | [game/population/spawnScript.ts:229](../src/game/population/spawnScript.ts#L229) |
| 7 | `flag`: `[playerOr0, flag, bool, 0]` | Works: 0 means world; otherwise only observed local player | [game/shardfile/decisions.ts:305](../src/game/shardfile/decisions.ts#L305) |
| 8 | `timer`: `[0, timer, seconds, 0]` | Works: own declared timer, ≥ 0 seconds; 0 cancels, deadline must fit safe tick range | [engine/script/decision.ts:292](../src/engine/script/decision.ts#L292) [engine/script/decision.ts:369](../src/engine/script/decision.ts#L369) |
| 9 | `signal`: `[0, signal, value, 0]` | Works: declared signal; game catalogue currently supplies mover-end IDs | [game/shardfile/decisions.ts:309](../src/game/shardfile/decisions.ts#L309) [format/decisionBindings.ts:67](../src/format/decisionBindings.ts#L67) |
| 10 | `grant`: `[playerOr0, fact, 0, 0]` | Works with authoritative fact port; dedupe by binding, target, fact | [game/shardfile/decisions.ts:133](../src/game/shardfile/decisions.ts#L133) [game/shardfile/decisions.ts:311](../src/game/shardfile/decisions.ts#L311) |
| 11 | `reward`: `[playerOr0, reward, 0, 0]` | Works through same ledger fact port/dedupe; only local player or 0 | [game/shardfile/decisions.ts:311](../src/game/shardfile/decisions.ts#L311) |
| 12 | `cue`: `[actorOr0, cue, 0, 0]` | Works: publishes cue event for presentation | [game/shardfile/decisions.ts:315](../src/game/shardfile/decisions.ts#L315) [game/shardfile/decisions.ts:438](../src/game/shardfile/decisions.ts#L438) |
| 13 | `channel`: `[0, channel, value, 0]` | Works: publishes declared numeric channel | [game/shardfile/decisions.ts:318](../src/game/shardfile/decisions.ts#L318) [game/shardfile/decisions.ts:438](../src/game/shardfile/decisions.ts#L438) |
| 14 | `impulse`: `[target, impulse, 0, 0]` | Refused at installation; **boss host** feature commit must own it; registry has no impulse IDs yet | [game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) [format/decisionBindings.ts:58](../src/format/decisionBindings.ts#L58) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200) |
| 15 | `encounter`: `[0, verb, value, 0]` | Works only for own encounter binding: 1 phase, 2 win, 3 fail; encounter validates value | [engine/script/decision.ts:376](../src/engine/script/decision.ts#L376) [game/shardfile/decisions.ts:320](../src/game/shardfile/decisions.ts#L320) [sdk/decisionScriptBindings.ts:84](../src/sdk/decisionScriptBindings.ts#L84) |
| 16 | `weather`: `[0, weather, 0, 0]` | Refused at installation; **weather reactions** feature commit must own it | [game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200) |
| 100 | `view.channel`: `[0, channel, value, 0]` | Not wired: no v1 view runner; refused by sim host | [engine/script/decision.ts:138](../src/engine/script/decision.ts#L138) [engine/script/decision.ts:160](../src/engine/script/decision.ts#L160) [sdk/decisionScriptBindings.ts:30](../src/sdk/decisionScriptBindings.ts#L30) |
| 101 | `view.clip`: `[actor, clip, 0, 0]` | Not wired: same restriction | [engine/script/decision.ts:160](../src/engine/script/decision.ts#L160) [sdk/decisionScriptBindings.ts:30](../src/sdk/decisionScriptBindings.ts#L30) |
| 102 | `view.vfx`: `[actor, cue, 0, 0]` | Not wired: same restriction | [engine/script/decision.ts:160](../src/engine/script/decision.ts#L160) [sdk/decisionScriptBindings.ts:31](../src/sdk/decisionScriptBindings.ts#L31) |
| 103 | `view.sound`: `[actor, cue, 0, 0]` | Not wired: same restriction | [engine/script/decision.ts:160](../src/engine/script/decision.ts#L160) [sdk/decisionScriptBindings.ts:31](../src/sdk/decisionScriptBindings.ts#L31) |
| 104 | `view.visible`: `[actor, bool, 0, 0]` | Not wired: same restriction | [engine/script/decision.ts:160](../src/engine/script/decision.ts#L160) [sdk/decisionScriptBindings.ts:32](../src/sdk/decisionScriptBindings.ts#L32) |
| 105 | `view.field`: `[0, fieldId, value, 0]` | Reserved; no runtime adapter after Z9. Simulation bindings refuse it. | [eased weather fields](../src/engine/world/easedFields.ts) |

These four refused sim commands fail even if never executed: listing the
capability is sufficient to refuse `ShardDecisions` construction. There is no
`mover` command. G484 keeps winch/well behavior in interaction rows; `view.field`
105 remains the optional future fallback. G484 keeps Signal dusk on an
eased-field row by preference.
[game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) [format/scriptAbiV1.ts:16](../src/format/scriptAbiV1.ts#L16) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200)

Z9 removes the unused isolated `ViewFieldHost` and its tests. The approved
weather field table selects first-match flag targets, snaps on loaded saves
and eases during play. It does not own simulation flags, saves or replication.
[Weather field rows](../src/format/easedFields.ts)

## Bindings: bodies, lifetimes and IDs

The built schema accepts exactly one of `{encounter: id}`, `{quest: id}`,
`{zone: id}`, `{shard: true}`. These choose lifetime; the row's `actors` aliases
choose the bodies it controls. Encounter self is its entity handle (which must
also be owned); other built binding kinds use self=0. Therefore actor/player
scoped slots currently require an encounter self, whereas binding-scoped slots
work with any kind. [format/decisionScripts.ts:23](../src/format/decisionScripts.ts#L23) [game/shardfile/decisions.ts:118](../src/game/shardfile/decisions.ts#L118) [game/shardfile/decisions.ts:134](../src/game/shardfile/decisions.ts#L134) [engine/script/decision.ts:167](../src/engine/script/decision.ts#L167)

| Binding | Active when | Source |
|---|---|---|
| Encounter | Boss state is `fight` | [game/shardfile/decisions.ts:336](../src/game/shardfile/decisions.ts#L336) |
| Quest | Started and incomplete | [game/shardfile/decisions.ts:336](../src/game/shardfile/decisions.ts#L336) |
| Zone | Local player is inside the declared region | [game/shardfile/decisions.ts:336](../src/game/shardfile/decisions.ts#L336) |
| Shard | Always while installed | [game/shardfile/decisions.ts:336](../src/game/shardfile/decisions.ts#L336) |
| Borrowed body | Existing body's controller says fighting; original owner supplies body, combat, fixed-step and save ports | [game/shardfile/decisions.ts:339](../src/game/shardfile/decisions.ts#L339) [game/shardfile/borrowedDecisions.ts:105](../src/game/shardfile/borrowedDecisions.ts#L105) [game/shardfile/borrowedDecisions.ts:149](../src/game/shardfile/borrowedDecisions.ts#L149) |
| Spawn group | One logical binding per declared actor, with actor-scoped slots and an owned self handle | [format/decisionScripts.ts:23](../src/format/decisionScripts.ts#L23) [format/decisionScripts.ts:98](../src/format/decisionScripts.ts#L98) |

An actor/body cannot have two decision controllers. Native actors must have
`brain: null`; borrowed actors must resolve to existing runtime spawn declarations.
No row creates a replacement body. Borrowed decision owners can use separate
DecisionHosts, so sharing one Wasm instance is not a shard-wide guarantee.
[game/shardfile/decisions.ts:120](../src/game/shardfile/decisions.ts#L120) [game/shardfile/borrowedDecisions.ts:113](../src/game/shardfile/borrowedDecisions.ts#L113) [game/shardfile/borrowedDecisions.ts:166](../src/game/shardfile/borrowedDecisions.ts#L166)

Aliases resolve through real platform registries, not row order or guessed IDs.
Most catalogues sort stable names and allocate positive handles; public field IDs
come directly from declared state. Player handle is `0x7fffffff`; 0 is the
no-target sentinel. Timers are sorted local names with IDs starting at 1.
The game allocates binding IDs as row index+1 and instance=0, so row order is part
of binding identity, seed stream and save compatibility.
[format/decisionBindings.ts:18](../src/format/decisionBindings.ts#L18) [format/decisionBindings.ts:37](../src/format/decisionBindings.ts#L37) [format/decisionBindings.ts:43](../src/format/decisionBindings.ts#L43) [format/decisionBindings.ts:54](../src/format/decisionBindings.ts#L54) [game/shardfile/decisions.ts:146](../src/game/shardfile/decisions.ts#L146)

## Limits, cadence and failures

| Limit | Built behavior | Source |
|---|---|---|
| Scheduling | Fixed steps are consecutive 60 Hz ticks; decisions only on every sixth tick (~10 Hz), only with queued events; optional tick events at 1/2/5/10 Hz | [format/scriptAbiV1.ts:28](../src/format/scriptAbiV1.ts#L28) [engine/script/decision.ts:222](../src/engine/script/decision.ts#L222) [engine/script/decision.ts:245](../src/engine/script/decision.ts#L245) |
| Calls | At most 64 binding calls per decision tick, in ascending binding ID; fuel exhaustion carries later queues | [engine/script/decision.ts:199](../src/engine/script/decision.ts#L199) [engine/script/decision.ts:248](../src/engine/script/decision.ts#L248) |
| Rows/modules | Schema ≤ 64 rows, ≤ 8 distinct modules; host ≤ 8 module instances | [format/decisionScripts.ts:82](../src/format/decisionScripts.ts#L82) [engine/script/decision.ts:174](../src/engine/script/decision.ts#L174) |
| Inbox | ≤ 16 events delivered per call; remainder carried; **pending queue grows, no total queue cap here** | [engine/script/decision.ts:80](../src/engine/script/decision.ts#L80) [engine/script/decision.ts:269](../src/engine/script/decision.ts#L269) |
| Commands | ≤ 32 per call, ≤ 128 per decision tick; quota excess refuses the call | [engine/script/decision.ts:280](../src/engine/script/decision.ts#L280) |
| Spawns/timers | ≤ 4 spawn commands / ≤ 8 timer commands per call; spawn-owned recipe and capacity checks; ≤ 64 declared timer names | [engine/script/decision.ts:298](../src/engine/script/decision.ts#L298) [game/population/spawnScript.ts:207](../src/game/population/spawnScript.ts#L207) [format/decisionScripts.ts:33](../src/format/decisionScripts.ts#L33) |
| Fuel | Default 400,000/call, 2,000,000/decision tick; configured ceilings 2,000,000 and 8,000,000 | [engine/script/decision.ts:131](../src/engine/script/decision.ts#L131) |
| Query cost | 256 fuel per scalar/list; no separate v1 query-count quota | [engine/script/decisionModule.ts:33](../src/engine/script/decisionModule.ts#L33) [engine/script/decision.ts:318](../src/engine/script/decision.ts#L318) [engine/script/decision.ts:344](../src/engine/script/decision.ts#L344) |
| Depth/structure | Depth 64; ≤ 256 KiB module, 512 functions/types, 128 globals, 1,024 locals/function | [format/scriptAbi.ts:2](../src/format/scriptAbi.ts#L2) [format/scriptAdmission.ts:61](../src/format/scriptAdmission.ts#L61) [format/scriptAdmission.ts:72](../src/format/scriptAdmission.ts#L72) [format/scriptAdmission.ts:88](../src/format/scriptAdmission.ts#L88) [format/scriptAdmission.ts:95](../src/format/scriptAdmission.ts#L95) |
| Memory | Fixed 1–4 × 64 KiB per module; memory.grow refused; initialized image retained alongside live memory, plus module/global bookkeeping; not v0's three-copy 24 MB policy | [format/scriptAdmission.ts:85](../src/format/scriptAdmission.ts#L85) [format/scriptAdmission.ts:126](../src/format/scriptAdmission.ts#L126) [engine/script/decisionModule.ts:21](../src/engine/script/decisionModule.ts#L21) [engine/script/decisionModule.ts:41](../src/engine/script/decisionModule.ts#L41) |
| State/params | ≤ 16 declared slots, ≤ 32 finite parameters | [format/decisionScripts.ts:34](../src/format/decisionScripts.ts#L34) [engine/script/decision.ts:140](../src/engine/script/decision.ts#L140) |
| AS source | Compiler requires explicit standalone ceiling or floor(legacy lines / 10); counts every authored .as including unused imports/sources, excluding comments/blank lines | [sdk/buildDecisionScripts.ts:19](../src/sdk/buildDecisionScripts.ts#L19) [sdk/buildDecisionScripts.ts:30](../src/sdk/buildDecisionScripts.ts#L30) [sdk/buildDecisionScripts.ts:70](../src/sdk/buildDecisionScripts.ts#L70) [sdk/decisionSource.ts:43](../src/sdk/decisionSource.ts#L43) |
| Failure budget | Third accumulated refusal disables binding; successful calls do not clear prior failures; fallback is invoked once on disable | [engine/script/decision.ts:299](../src/engine/script/decision.ts#L299) [engine/script/decision.ts:303](../src/engine/script/decision.ts#L303) |

Metering is deliberately coarse: compilation inserts a positive charge at every
implementation entry and loop header (`bytes.length * 4 + 128 * functionCount +
1024`); every function is wrapped with enter/leave. No optimization follows
instrumentation. Finite guards also charge one fuel. Fuel is an accounting
budget, not milliseconds or an exact instruction count.
[sdk/bake/compileScript.ts:38](../src/sdk/bake/compileScript.ts#L38) [sdk/bake/compileScript.ts:47](../src/sdk/bake/compileScript.ts#L47) [sdk/bake/compileScript.ts:60](../src/sdk/bake/compileScript.ts#L60) [sdk/bake/compileScript.ts:69](../src/sdk/bake/compileScript.ts#L69) [engine/script/decisionModule.ts:58](../src/engine/script/decisionModule.ts#L58)

The game's fallback behavior is literal: `hold` leaves existing mechanics alone;
`reset` stops owned actors and retries an encounter binding; `skip` stops owned
actors, without advancing a quest or encounter. All three leave the script
disabled. A later `start` enqueue can clear disabled/failures, reset slots,
timers and RNG; ordinary stop/start does not reset healthy slots/RNG.
[game/shardfile/decisions.ts:149](../src/game/shardfile/decisions.ts#L149) [engine/script/decision.ts:211](../src/engine/script/decision.ts#L211) [engine/script/decision.ts:205](../src/engine/script/decision.ts#L205)

## State, save behavior and determinism

Only declared bool/i32/f64 slots are durable guest state, stored by name per
logical binding. Bounds and types are checked after the call and on restore.
Scope (`binding`/`actor`/`player`) imposes ownership checks; the host does not
create a separate player-indexed storage bank. `local` is accepted only by the
isolated client view host, and never by the simulation owner. [format/decisionScripts.ts:13](../src/format/decisionScripts.ts#L13) [format/decisionScripts.ts:60](../src/format/decisionScripts.ts#L60) [engine/script/decision.ts:72](../src/engine/script/decision.ts#L72) [engine/script/decision.ts:167](../src/engine/script/decision.ts#L167) [engine/script/decision.ts:379](../src/engine/script/decision.ts#L379) [game/shardfile/decisions.ts:142](../src/game/shardfile/decisions.ts#L142)

The engine snapshot includes tick, binding/script/stateVersion identities,
named slots, remaining timers, RNG counters, failures/disabled/enabled state,
pending events, last-call tick, and staged commands plus their next slots/timers/
RNG and observed handles. It excludes guest memory/globals and metrics. Restore
validates and re-prepares staged transactions without invoking Wasm, then installs
the continuation. It requires the **same** stateVersion; format migration-chain
validation is not automatic migration of these snapshots.
[engine/script/decision.ts:29](../src/engine/script/decision.ts#L29) [engine/script/decision.ts:391](../src/engine/script/decision.ts#L391) [engine/script/decision.ts:402](../src/engine/script/decision.ts#L402) [format/decisionScripts.ts:112](../src/format/decisionScripts.ts#L112)

The game additionally saves enabled bindings, public actor fields, channels,
player flags, zone/phase observations, move-runner state and strike tracking.
Body/encounter/strike-runner state belongs to the existing owners; the game
registers its continuation with `SimHost.onStep`. Borrowed owners explicitly
save/restore both decision and real strike-runner continuation. Loading does not
replay init, start handlers, rewards or presentation edges. Contract mismatches
refuse, with a narrow exception for mechanically equivalent borrowed view-channel
program edits. [game/shardfile/decisions.ts:173](../src/game/shardfile/decisions.ts#L173) [game/shardfile/decisions.ts:446](../src/game/shardfile/decisions.ts#L446) [game/shardfile/decisions.ts:451](../src/game/shardfile/decisions.ts#L451) [game/shardfile/decisions.ts:466](../src/game/shardfile/decisions.ts#L466) [game/shardfile/borrowedDecisions.ts:136](../src/game/shardfile/borrowedDecisions.ts#L136)

Simulation time is integer ticks; timers use tick deadlines and generated
`Clock.dt` is elapsed simulation time. The production seed is
`[identity.seed >>> 0, 0]`, with binding id, instance (currently 0) and saved RNG
counter mixed into `Read.random()`. Failed calls discard the staged RNG advance;
restoring preserves its continuation. Author globals cannot retain hidden RNG
state because the module rewinds every call. [game/shardfile/decisions.ts:156](../src/game/shardfile/decisions.ts#L156) [engine/script/decision.ts:263](../src/engine/script/decision.ts#L263) [engine/script/decision.ts:330](../src/engine/script/decision.ts#L330) [engine/script/decision.ts:331](../src/engine/script/decision.ts#L331) [engine/script/decision.ts:233](../src/engine/script/decision.ts#L233) [engine/script/decisionModule.ts:70](../src/engine/script/decisionModule.ts#L70)

The import whitelist exposes no wall clock, entropy, DOM, filesystem or arbitrary
host call. Deterministic continuation requires the same admitted bytes, binding
identities, event order and authoritative read/list replies; it does not make
physics/navigation or host `Math.atan2` results bit-identical across platforms.
Lists sort returned handles; trace ports can record exact read/list replies.
[format/scriptAbiV1.ts:49](../src/format/scriptAbiV1.ts#L49) [game/shardfile/decisions.ts:207](../src/game/shardfile/decisions.ts#L207) [game/shardfile/decisions.ts:219](../src/game/shardfile/decisions.ts#L219) [engine/script/decision.ts:44](../src/engine/script/decision.ts#L44) [engine/script/decision.ts:341](../src/engine/script/decision.ts#L341) [engine/script/decision.ts:356](../src/engine/script/decision.ts#L356)

## Legacy v0

V0 remains a separate numeric protocol: `abi_version`, `init`, `in_ptr/in_cap`,
`out_ptr/out_cap/out_count`, `on_tick`, `__start`; `env.query` instead of v1 reads/
lists. `ScriptLane`/`ScriptComposition`, native behavior builds, client scripts
and `DirectorLane` still use it. Director events are typed input/output rows,
not v1 command/event IDs: the director admits event-only effects, can dispatch
at zero elapsed time using the same tick allowances, and saves guest memory/
globals with its host checkpoint. V0 is retired per shard and deleted with its
last user (G484), not silently reinterpreted as v1.
[format/scriptAbi.ts:4](../src/format/scriptAbi.ts#L4) [game/shardfile/scriptComposition.ts:17](../src/game/shardfile/scriptComposition.ts#L17) [game/shardfile/clientScripts.ts:17](../src/game/shardfile/clientScripts.ts#L17) [sdk/buildBehaviour.ts:29](../src/sdk/buildBehaviour.ts#L29) [game/plugin/director.ts:21](../src/game/plugin/director.ts#L21) [game/plugin/director.ts:48](../src/game/plugin/director.ts#L48) [game/plugin/director.ts:75](../src/game/plugin/director.ts#L75) [game/plugin/director.ts:97](../src/game/plugin/director.ts#L97) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200)

## Gaps between the design and code

These are findings, not additional API promises or code changes:

- **Interaction:** the design says no caller, but native simulation already
  routes picker-selected interactions to `ShardDecisions.interact`. G484's
  first-script proof remains required.
  [progress/shard-platform/wasm-api-design-2026-10-17/README.md:82](../progress/shard-platform/wasm-api-design-2026-10-17/README.md#L82) [game/plugin/simulation.ts:575](../src/game/plugin/simulation.ts#L575) [game/shardfile/decisions.ts:431](../src/game/shardfile/decisions.ts#L431) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200)
- **Membership:** `player.join/leave` are delivered on binding lifetime changes,
  despite the design's “id only” status. They do not prove multiplayer joins.
  Spawn-owned programs produce `spawned`; `strike.target` still lacks a
  producer in the decision owner.
  [progress/shard-platform/wasm-api-design-2026-10-17/README.md:88](../progress/shard-platform/wasm-api-design-2026-10-17/README.md#L88) [game/shardfile/decisions.ts:336](../src/game/shardfile/decisions.ts#L336) [game/shardfile/decisions.ts:380](../src/game/shardfile/decisions.ts#L380) [sdk/decisionScriptBindings.ts:42](../src/sdk/decisionScriptBindings.ts#L42)
- **Group API:** G484(a)'s spawn-group binding and skitterer port landed in
  `9c6361f6b` / `74c87e851`. A `{ spawnGroup: id }` binding expands into one
  logical binding per declared actor, with actor-scoped slots and an owned
  self handle. `spawnGroupAlive` counts live members of creature groups or
  declared script groups; actor spawn ids retain their 0/1 behavior.
  [format/decisionScripts.ts:23](../src/format/decisionScripts.ts#L23) [format/decisionScripts.ts:98](../src/format/decisionScripts.ts#L98) [format/decisionBindings.ts:50](../src/format/decisionBindings.ts#L50) [game/shardfile/decisions.ts:200](../src/game/shardfile/decisions.ts#L200)
- **Refused operations:** generic decision rows still refuse spawn/despawn;
  owned population/elite programs bind them to concrete native/page bodies.
  Impulse and weather remain install-time refusals. No mover command exists. View
  ids 100–105 lack runtime adapters after Z9; weather field tables supply
  eased presentation state without a view guest. [game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) [format/scriptAbiV1.ts:16](../src/format/scriptAbiV1.ts#L16) [engine/script/decision.ts:138](../src/engine/script/decision.ts#L138) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200)
- **Saves:** migration chains are checked by format admission, but decision
  restore requires exact stateVersion; it does not run those migrations.
  Player-scoped state is per binding with owner validation, not a multiplayer
  player map. [format/decisionScripts.ts:112](../src/format/decisionScripts.ts#L112) [engine/script/decision.ts:413](../src/engine/script/decision.ts#L413) [engine/script/decision.ts:167](../src/engine/script/decision.ts#L167) [engine/script/decision.ts:394](../src/engine/script/decision.ts#L394)
- **Bounds/fallbacks:** 16 events bounds a delivered batch, not total queued
  events. `hold` does not freeze an already-running move; `skip` does not
  advance story state. These are the actual implementations, not guarantees
  of queue boundedness or story recovery. [engine/script/decision.ts:80](../src/engine/script/decision.ts#L80) [engine/script/decision.ts:269](../src/engine/script/decision.ts#L269) [game/shardfile/decisions.ts:149](../src/game/shardfile/decisions.ts#L149)

## Stateless return projections (G475)

ReturnProgram is an additive event-only owner of ABI-v1 modules, separate from
DecisionHost's scheduled and saved bindings. It runs a single signal event in
the caller's existing death/one-second queue phase. There are no durable state
slots, timers, tick subscription, actor writes or second simulation scheduler.
The actors/return-scripts catalogue admits the module as a critical Wasm blob
in the official product inventory and native worker context. Embedded bytes must
hash to the named module. The IO layout, generated handlers, byte admission,
scratch rewind, finite guards, 400,000-fuel call bound and 32-command output
bound are the same v1 transport.

The only scalar reads are declared numeric field(0, field) observations and
random() from the explicitly lent real spawn stream. The only lists are
groundHeight(x,z) from the built-in native/page terrain and radial(yaw,radius)
with the existing [sin(yaw)*radius, cos(yaw)*radius] convention. Fields, signals
and result channels resolve in sorted declared-target order. Only declared
channel outputs may publish; duplicate/unknown channels and invalid values
refuse. A refusal rewinds the borrowed RNG and publishes nothing. The projection
has no private save payload: the caller's existing queue and RNG continuation are
still authoritative. Scheduled decision bindings retain next-step commit rules.

Driftwood uses this for scheduling, return eligibility and terrain retry policy.
Its v8 keeper adapter retains every saved field and actor/adapter order. The page
uses the same guest on its existing update clock. The generic corpse ReturnGate
is fixed-step engine mechanics driven by delay, distance and fade rows.

### Owned elite programs (G473, G484)

Named encounters use the same concrete native/page `SpawnScript` owner as
population directors. A `spawnGroup` catalogue assigns one actor-scoped v1
binding to each declared slot. Guest spawn commands may create only their own
slot through its recipe, species and site rows. Group liveness counts the
currently bound living bodies; detached rivals leave the group.

Declared strike rows bind the existing fixed-step StrikeRunner. A guest starts
an attack with `strike`; `strikeState` observes its phase, and `stop` cancels
contact and movement. Finite observed fields expose encounter phase, engagement,
leash and day weights. Data field steering remains bounded by the admitted
move's speed and turn limits. Native/page authorities retain all identity,
physics, damage and retirement operations; no shard TypeScript port is accepted.
See [spawn owner](../src/game/population/spawnScript.ts),
[strike owner](../src/game/population/scriptStrikes.ts), and
[elite admission](../src/format/eliteFeature.ts).

### Client ambient projections

The client-only `game/population/pageLife` presenter also uses `ReturnProgram`:
`arrival`, `carcass` and `guide` requests supply finite observations and receive
validated channels. Carcass/guide decisions run at most 10 Hz; object lifetime,
flock pose packing and timed-tool interpolation remain native. Pine's
`behaviour/life.as` contains its forest rules. The product admits the same
fixed-page Wasm bytes through `actors/return-scripts`; the existing page
decision authority prepares its memory before construction. The guest owns no clock, actor or durable save state.


### Stateless population site projections

DW declares `perchScore` and `perchHeight`; Pine declares `shelterScore` and
`shelterPlace`. Site traversal supplies native `Math.hypot` distances and
preserves candidate/RNG order. Only scoring and site decisions enter AS.
Per-frame root integration remains counted native TypeScript at its original
near-pose phase, preserving absent old-save memory keys and the v8 wire (G457).

A projection may receive at most eight transient numeric candidate records.
`field(0, id)` reads the request; `field(n, id)` reads candidate `n - 1`.
These are not actor handles. Undeclared fields and out-of-range indices refuse.
The records are cleared on every exit and never enter guest or host save state.
Site selection divides its admitted list into eight-site batches, preserving
source order and the existing 400,000 coarse fuel cap per guest call.

Native and page factories share an admitted module inside the same owner scope.
An inconsistent declaration for the same module refuses; disposal releases the
scope's instance. No extra scheduler, actor controller or instance is installed.

## ABI v2 wire contract (WASM-HOST H0b)

This section specifies the target contract before implementation. The v0/v1
sections above remain the shipped contract. G570 starts the Pine/Driftwood view
wave; H1–H6 add an explicitly versioned Developer path. Selecting that path must
not change any existing v0/v1 compilation, admission, module hash or save.
H13 owns the later cutover. See [WASM-HOST](plans/WASM-HOST.md).

The implemented build entry is
[`compileScriptV2(source, { lane, maximumPages, ioBytes, sources })`](../src/sdk/bake/compileScriptV2.ts).
Select `sim`, `project` or `view`; inference is allowed only when one authored
work export exists. The compiler keeps that work export, init and the getters.
[`admitScriptV2(bytes, { lane, ioBytes })`](../src/format/scriptAdmissionV2.ts)
verifies actual bytes before execution; the structural reader or fuel inspector
alone does not grant execution.

H13 v2 artifact metadata requires ABI 2.0, compiler revision 1 and admission
revision 1, a content hash, lane, fixed page count and full IO byte length.
`parseScriptArtifactV2` returns a frozen checked snapshot; unknown revisions
refuse, rather than selecting a different compiler or admission path. Both
`compileScriptV2` and `admitScriptV2` accept explicit revision requests and
refuse unsupported values before entering their pipelines. Metadata parsing
does not execute Wasm or verify the content hash: the native asset owner still
verifies bytes and executable admission before constructing its selected lane. The host supplies the full trusted IO byte
length (default 656 for header/directory only), also used to reserve compiler
static data and stack outside the wire area. The
[`ScriptModuleV2`](../src/engine/script/moduleV2.ts) primitive admits one sim or
projection lane per instance and rewinds the complete image/globals before
every call. Output domain/authority validation and the remaining lane
integration below still belong to their defining hosts. Shipped v0/v1 loaders
continue to select their original paths.

The native entry owner lends its existing Developer boolean to
selectDeveloperScriptV2 once at construction. Off returns the existing
native/v0/v1 path without reading the optional v2 declaration; on snapshots
strict versioned metadata. Setting changes apply at the next owner entry,
never by hot swapping writers. This selector grants no execution authority:
the selected owner verifies and copies bytes, admits that copy with its lane,
trusted IO size and explicit compiler/admission revisions, compiles the same
copy, then calls the getters and ws_init. Refusal never instantiates a guest.

The build-only compileDualScriptV2 receives one captured authored closure
and separate v1/v2 adapters, requires both adapters to reach every authored
file, and returns independently admitted shadow artifacts with source hashes.
It never publishes either artifact or replaces a shipping producer. CI's
test/script-v2-ports.test.ts discovers each .dual.ts port fixture, repeats
v1 compilation after v2 to check unchanged bytes, and runs the port's artifact
exercise. The initial Pine contract-helper pair is enrolled; unported AS
families still need their own adapters before H13's full-coverage cutover.

### Encoding, authority and memory

All multibyte values are little-endian. `u16` occupies two bytes,
`u32`/`i32` occupy four bytes, `f32` four,
and `f64` eight; bool columns are f64 0 or 1. Durable numeric columns are f64,
including integers, so every valid v1 i32/f64 slot round-trips without narrowing
or normalizing negative zero. Values must be
finite; integer and declared range checks precede commit. Handles are positive
local i32 values, zero means absent. The host maps them to stable declared
identities; a wire handle is never the identity stored in a save. This preserves
v1 identities that exceed 32 bits and permits remapping on restore.

There is one fixed, unshared memory per admitted module **per lane**, imported
as `env.memory`, with equal initial/maximum page counts. Sim/projection and view
never share memory. A page is 65,536 bytes; admission permits the existing 1–4
page range, preferring one page. The compiler reserves the entire IO range
outside its static data and heap. The host computes its size before instantiation:
`end = align16(io + 128 + 22*24)` followed by each aligned region's
`stride*capacity`. Static data, IO, stack and declared scratch must fit. Refuse a
layout that does not fit; never grow memory or silently drop rows. Scratch may
use the remaining admitted memory but cannot become durable sim state.

Region bases are aligned to 16 bytes; records and f64 columns to eight; f32
samples to four. The host calculates offsets, strides, capacities, ownership,
column types and capabilities from admitted metadata, retaining a copy outside
Wasm. Guest-written header/descriptors cannot grant access, change a length or
choose a renderer target. Validate against that copy before reading outputs.
Check multiplication and addition without coercing to i32 first; reject overflow,
misalignment, overlaps, negative addresses and ends beyond the fixed memory.
Every address is a byte offset, never a JS pointer or f64 slot index.

All unused header fields, descriptor flags and record padding are zero. An
unknown major/minor, region kind, flag, enum or command refuses admission/call;
there is no best-effort version fallback. A compatible additive layout requires
an explicit minor-version change and its own admission rules.

### Exports and entry order

Only memory is imported: **no function imports**, table, indirect call, start
section, shared memory, memory growth, SIMD or relaxed SIMD. Getter bodies must
be admitted constants. Executable exports have the following exact signatures:

| Export | Signature and result |
|---|---|
| `ws_abi` | `() -> i32`, constant 2 |
| `ws_io` | `() -> i32`, constant aligned IO base matching admitted metadata |
| `ws_init` | `(seedLo:i32, seedHi:i32, fuel:i32) -> i32`, remaining fuel |
| `ws_step` | `(tick:i32, fuel:i32) -> i32`, remaining fuel |
| `ws_project` | `(fuel:i32) -> i32`, remaining fuel |
| `ws_view` | `(dt:f64, alpha:f64, fuel:i32) -> i32`, remaining fuel |

The three work entries are step, project and view. A lane admits only its work
entry, plus the getters and init; unsupported work entries are absent. The view
signature includes fuel explicitly; the plan's `ws_view(dt, alpha)` names the
presentation arguments. Header values must match entry arguments. No work entry
may be called by guest code, even from an acyclic helper. Init cannot call a
work entry or itself. H2 verifies this before instantiation.

The host admits bytes, supplies fixed memory and validated layout, then invokes
init once with a bounded positive i32 budget. Compiler startup is internal to
that metered init, never an unmetered exported `__start`. Init emits no gameplay
commands or requests. After validating initialization, capture the complete
memory image and every mutable global except the private fuel global. Every other mutable global must have an
admitted snapshot export. Before
each sim/project entry and retry, restore that whole image and globals, then
write the input frame. View keeps its initialized memory between frames.

Each executable entry sets a non-exported fuel global from its argument exactly
once, decrements it by verified basic-block charges, traps on exhaustion and
returns its remaining value. The host accepts only `0 <= remainder <= budget`.
Only the entry prologue writes the initial budget; other writes must be exact
admitted charges. Read access is allowed. Direct calls must form an acyclic graph
with maximum depth 64. Float stores and reinterpret inputs receive inline finite
checks, and every published float is checked again by the host. NaN/infinity and
local abort trap without crossing into JS. H0 measures charge overhead; the
chosen charge granularity belongs to the versioned compiler/admission pair.

### Header and region directory

Offsets below are relative to `ws_io()`. The header is exactly 128 bytes.

| Offset | Type | Field |
|---|---|---|
| 0 | u32 | magic `0x32565357` (`WSV2`) |
| 4, 6 | u16, u16 | major 2, minor 0 |
| 8, 12 | u32, u32 | header bytes 128, complete IO byte length |
| 16, 20 | u32, u32 | module handle, lane (1 sim, 2 projection, 3 view) |
| 24, 28 | u32, i32 | call sequence, relative 60 Hz tick |
| 32, 36 | u32, u32 | due-binding count, player count |
| 40, 44 | u32, u32 | event count, input-edge count |
| 48, 52 | u32, u32 | query-reply count, projection-request count |
| 56, 60 | u32, u32 | candidate command count, query-request count |
| 64, 68 | u32, u32 | running binding hint, query-reply scalar count |
| 72, 76 | u32, u32 | changed view-transform count, changed view-channel count |
| 80, 88 | f64, f64 | view dt seconds, fractional fixed-step alpha |
| 96, 100 | u32, u32 | directory count 22, directory byte offset 128 |
| 104 | f64 | absolute tick origin |
| 112, 116 | u32, u32 | view frame sequence, reserved zero |
| 120 | 8 bytes | reserved zero |

Directory entries are 24 bytes: `kind:u32, offset:u32, stride:u32,
capacity:u32, count:u32, flags:u32`. Offsets are IO-relative. Entries appear in
ascending kind order. Inactive regions have capacity/count zero and still have
the defined stride. Counts of host input regions are host-written. Counts of
output regions are proposals bounded by admitted capacities. The host clears
output counts before every call. An output count is never used to allocate.

The following are complete region/record layouts; fields follow the written
order, without implicit padding. `pad` is zero. Indices into another region are
record indices, validated together with their counts against host metadata.

| Kind | Region | Stride and fields |
|---|---|---|
| 1 | Bindings | 64: `handle,self,player,flags,stateBase,stateCount,paramBase,paramCount,observationIndex,fieldBase,fieldCount,divisor:u32`; `previousTick,currentTick:i32`; `fuelSlice,pad:u32` |
| 2 | Committed state | 8: `value:f64`, ordered by binding, then declared column |
| 3 | Candidate state | 8: `value:f64`, same shape as kind 2 |
| 4 | Parameters | 8: `value:f64`, binding-local names in lexical order |
| 5 | Standard observations | 96: `binding,self,target,validBits:u32`; `sampleTick:i32,pad:u32`; `x,y,z,yaw,hpShare,groundY,walkX,walkZ,lineOfSight:f64` |
| 6 | Declared numeric observations | 16: `field,present:u32`; `value:f64`, binding-local declared fields in lexical order |
| 7 | Players | 80: `handle,validBits:u32`; `sampleTick:i32,pad:u32`; `x,y,z,yaw,hpShare,forwardX,forwardZ,walkIntent:f64` |
| 8 | Input edges | 32: `player,action:u32`; `atTick:i32`; `phase:u32`; `x,y:f64` |
| 9 | Events | 56: `kind,binding,subject,player:u32`; `atTick:i32`; `sequence:u32`; `a,b,c,d:f64` |
| 10 | Commands | 64: `binding,op,target,request:u32`; `a,b,c,d,e,f:f64` |
| 11 | Query requests | 80: `binding,id,op,flags:u32`; `atTick:i32`; `target:u32`; `a,b,c,d,e,f,g:f64` |
| 12 | Query replies | 64: `binding,id,status,count:u32`; `atTick:i32`; `dataBase:u32`; `a,b,c,d,e:f64` |
| 13 | Query-reply data | 8: `value:f64`; each reply's slice is checked independently |
| 14 | Height grid | Byte region: 64-byte header followed by f32 heights, as specified below |
| 15 | View sample directory | 32: `binding,validBits:u32`; `previousTick,currentTick:i32`; `previousBase,currentBase,columnCount,pad:u32` |
| 16 | Public view sample columns | 8: `value:f64`, previous/current slices lent by kind 15 |
| 17 | Candidate view transforms | 80: `binding,output,element,changed:u32`; 16 column-major `matrix:f32` values |
| 18 | Candidate view channels | 8: `value:f64`, targets and dirty positions fixed by metadata |
| 19 | Projection requests | 48: `id,binding,signal,flags,fieldBase,fieldCount,candidateBase,candidateCount,candidateWidth,resultBase,resultCapacity,pad:u32` |
| 20 | Projection channels | 16: `request,channel:u32`; `value:f64` |
| 21 | Committed RNG | 64: `binding,stream,algorithm,draws:u32`; six `state:f64` values |
| 22 | Candidate RNG | 64: same shape as kind 21 |

Kind 14 has stride 1 and a byte capacity. Its header is
`originX,originZ,cellX,cellZ:f64; cols,rows,samplesOffset,pad:u32;
waterY:f64; validBits,pad:u32`. Cell dimensions must be positive and rows/cols
at least two. Samples are row-major f32 at the IO-relative samplesOffset, finite
and inside the same region. Compute `rows*cols*4` with checked arithmetic. Bit 0
means grid present; all other bits are reserved. Samples use bilinear interpolation on the original f32 lattice, with f64
arithmetic in the native sampler's order: lerp the two x pairs, then z. Both
boundaries are inclusive, selecting the last cell at its upper edge.
Outside-grid reads refuse; they
never consult page terrain implicitly. A sim/projection grid comes only from its
native world owner. H5 uses asynchronous requests for unavailable queries.

Standard-observation valid bits 0–4 respectively mean pose, health, ground,
walkable and line of sight present. Player valid bits 0–3 mean pose, health,
forward and intent present. Absent values are zero; the SDK must test the bit
before reading a group. View-sample bit 0 means previous/current columns present;
bit 1 permits interpolation. Binding flags are enabled=1 and due=2; all other
bits are reserved. Input phases are press=1, release=2, analogue=3. Query status
is ok=1, unavailable=2, refused=3; non-ok replies have no data payload. Other
numeric enums use their v1 operation/event ids where an operation exists; new
operations require an explicit defining table before admission can accept them.
A numeric field has present=0 or 1; absent values are zero and a guest read of
an absent field traps locally. A projection's candidateCount is at most eight;
candidateWidth equals its admitted field-row width. Each candidate occupies that
many kind-6 records beginning at candidateBase. Ordinary request fields begin at
fieldBase; both ranges are independently checked. Field ids and presence cannot
grant an undeclared read. View cannot emit sim commands or queries. Projection flags and query flags are
zero in 2.0. A changed transform has `changed=1`, otherwise zero. Kind 17's count equals its
admitted record count and header offset 72 equals the sum of changed flags;
identity fields must match the target assigned to that position. Kind 18 publishes
the complete declared channel bank or none: its count and header offset 76 are
both its capacity or both zero. Frozen targets are excluded by the host's trusted
binding table even when the guest writes those positions.

### Query operation and reply records

Query ids 4 and 5 retain the v1 list ids; 8 through 11 are v2 query ids.
Flags are zero and a request's atTick equals its issuing entry tick. A
nonzero target is an observed body to exclude, resolved to its stable identity
before queuing. Navigation, nearest-roster and point-sight requests use target zero. The a..g fields are:

| Op | Request | Successful reply |
|---|---|---|
| 4 walkable | x,y,z,radius,0,0,0; radius >= 0 | inline x,y,z,0,0; no data |
| 5 path | fromX,fromY,fromZ,toX,toY,toZ,radius; radius >= 0 | inline pointCount,0,0,0,0; data is flat xyz triples |
| 8 ray | origin xyz, unit direction xyz, maxDistance >= 0 | inline hit (0/1), point xyz, distance; hit data is normal xyz then body handle (0 absent); a miss is all zero with no data |
| 9 overlap | center xyz,radius > 0,0,0,0 | inline bodyCount,0,0,0,0; data is unique observed body handles |
| 10 nearest | origin xyz,radius >= 0,declaredRosterCode,0,0 | inline body handle, point xyz, horizontal distance; no match is five zeroes; no data |
| 11 sight | from xyz,to xyz,slack >= 0 | inline visible (0/1),0,0,0,0; no data |

Roster codes are positive signed-i32 stable declaration values, not transient
entity handles. Each binding's native capability supplies an ordered array of
its actual actors. Nearest skips dead actors, compares Math.hypot(dx,dz) with
strict distance < radius and retains the first source-order tie. It has no
implicit self exclusion. The result copies that actor's current position and
stable identity at afterBodies, then remaps the identity at delivery. Unknown
roster capabilities refuse; no species name or global actor book is inferred.
Point sight uses the existing WORLD-only lineOfSight segment/slack law,
excluding sensors. It is delayed advisory information. Original urgent reach,
eye/chest targeting, cover and 60 Hz contact remain with their native owners.

The reply's count is its scalar data length; dataBase is a record index into
kind 13, not a byte address. Unavailable/refused replies have zero inline and
data payloads. Answer stamps are absolute while saved and relative on the
wire; delivery must occur in a later eligible entry than afterBodies answered.
Pending request targets and answer bodies retain stable identities. Local
binding/body handles are resolved afresh when marshalling a reply; stale bodies
refuse the complete batch. Capacity failures never publish a partial prefix.

Request ids increase monotonically per stable binding; the u32 high-water mark
survives delivery and save/restore. Zero, reuse and wrap refuse. Each admitted
operation reserves its worst-case scalar reply capacity while pending or ready;
all reservations must fit the fixed bank. An oversized native answer returns
explicit status refused with no partial data.

After all module candidates validate, acceptance atomically consumes the
eligible delivered replies and queues new pure query work. World commands and
columns still commit at the next fixed step. One afterBodies resolver receives
all modules' requests in stable module/binding/id order; all reply batches
validate before any ring publishes. Excluded/inactive bindings retain their
undelivered replies. Query continuations retain pending/ready phases and ids;
restore validates them without querying the world or replaying an answer.

### Tick, ordering and overflow rules

The authoritative simulation remains 60 Hz. Wire ticks and sample/event stamps
are signed i32 **relative** to the header's exact integer f64 origin. The host
chooses `origin = floor(absoluteTick / 2^30)*2^30`; absolute tick is an integer
within JS's safe-integer range. Adjacent older samples may have negative relative
ticks. Refuse a stamp outside i32 instead of wrapping. Saved ticks/deadlines are
absolute exact integers; origin is marshalling state and is recomputed on load.
No timer duration, handle, sequence or count silently wraps. A sequence exhausting
u32 starts a new host-owned epoch only at a quiescent boundary; pending work is
first saved/drained or admission pauses with an explicit refusal.

Bindings execute in stable declared identity order, independently of transient
handle assignment. Player rows sort by their stable player identity; edges sort
by `(atTick, sequence)`, events by `(atTick, sequence, binding identity)`.
Input-edge sequence is its host-owned position in that sorted batch; duplicate
positions are refused. Each row's player/subject is resolved against that entry's
observed handles and capabilities. A player observation never grants ownership
of that body. Input stamps come from the authority; a future server bounds receipt
lag to six ticks. View dt, alpha, camera, tier and wall time are absent from sim
and sim-projection frames (their header dt/alpha/frame sequence are zero).

Sim divisors are six for 10 Hz or two for an explicitly approved 30 Hz binding.
All bindings in a sim module share its admitted divisor; a module runs only when
`absoluteTick % divisor == stableModuleOrdinal % divisor`. This ordinal is a
saved declared registry identity, not a load-order index. Finer binding staggering
requires an explicit admitted binding count/policy, never a device-dependent
choice. Each binding receives its actual last/current successful sample stamps.
A missed call advances neither state nor RNG. Input/event stamps retain 60 Hz
precision even when the next script call is at 10 Hz.

### Outputs, queries and saved continuation

The host snapshots its input identity/length metadata outside memory, then enters
once per due module. Generated glue sets the running-binding hint before a
binding and checks its fuel slice at each boundary. The hint is advisory: on a
trap, accept it only if it names a due binding. Discard all module candidates;
restore image/globals and the original frame; re-step once with that binding
excluded. A second trap skips the module. Do not rerun successfully committed
world effects. Failures accumulate per module and the third disables it. A
healthy call does not erase failure history. No guest can refill fuel by calling
another export or invent a binding by rewriting its directory.

Validate every candidate column, command, capability, ownership reference,
integer, count and RNG continuation before staging anything. Preserve the v1
quotas: 32 commands per call, 128 per tick, four spawns and eight timers, enforced
by the host over all bindings/calls in its authority. A full output/request ring
refuses that call atomically; no partial prefix, truncation or overwrite of
pending work. Requests and replies use unique nonzero request ids scoped to the
stable binding. Their capacities are declared by host metadata and must fit the
fixed memory; no guest chooses an allocation size.

Sim commits the validated transaction at the next fixed step, retaining v1's
ordering. Queries are answered in that tick's `afterBodies` phase and delivered
to the next eligible sim entry, not synchronously. Pending queries, input/events,
staged commands, timers, columns, RNG and failure state belong to the saved host
continuation, keyed by stable identities. Restore validates and re-prepares it
without running init/start or replaying rewards. Contact goes through existing
60 Hz strike/held-melee owners, never through the query ring.

RNG algorithm 1 is the current `engine/core/rng.ts` Mulberry32 continuation:
state columns 0–2 are `state,initial,scrambledFork` (0/1); remaining columns zero.
Algorithm 2 is `engine/script/decision.ts`'s current seed/binding/instance/counter
mix: columns are `seedLo,seedHi,counter,logicalBindingId,instance,0`. Seeds and
Mulberry states are exact u32 values; logical ids/counters remain exact safe
integers in f64. Input draws is zero; a candidate reports its u32 draw count.
The host checks its next state/counter against that count and the pinned
algorithm, preserving initial/identity fields. Projections borrow the caller's
stream and commit its advance only with all channels; refusal rewinds the loan.
No random stream is reseeded because a transient handle changed.

The memory-only AS SDK `random(stream)` writes candidate continuations in kind
22, copied from kind 21 at entry. `format/scriptRngV2#prepareV2Rng` snapshots
the admitted binding/stream/algorithm tuple before entry and checks the complete
candidate bank against its reported draw counts. Inactive or excluded bindings
cannot advance. The native owner commits the copied candidates only with its
validated state/command transaction; refusal or a re-step advances no stream.

Projection requests are synchronous, stateless and channel-only. Independent
requests may share one call; dependent requests require staged continuations,
never a reentrant guest callback. A failed batch publishes no channel or RNG
advance. Families are explicitly tagged sim or view: sim observations and ground
are renderer-free; view families cannot write simulation or durable columns.

### View persistence, interpolation and rate control

Each view binding receives its own previous/current sample ticks and declared
public columns. For divisor `d`, compute the delayed render tick
`relativeTick + alpha - d`, then clamp
`(renderTick - previousTick)/(currentTick - previousTick)` to [0,1]. Equal/missing
stamps hold the latest valid pose; there is no extrapolation. This handles
staggered modules without treating their samples as if they arrived every frame.
The fixed-step alpha is finite in [0,1]; view dt is finite and nonnegative.
It accumulates the existing paused/clamped presentation-clock deltas since the
last scheduled view call, including skipped display frames, rather than slowing
animation by dividing elapsed time with the call rate.
Neither value is ever passed to sim. There is no local-player prediction; the
native held-melee host applies the declared cancel/combo table at 60 Hz.

View memory persists, but output authority does not. Before upload, validate
complete changed transforms/channels against the host's declared targets and
translation/scale/shear bounds, then clamp admitted presentation ranges in place.
Set `needsUpdate` only after the whole frame validates. The host does not
re-enter that view module before the renderer consumes that frame's uploads. A trap/refusal uploads
nothing and freezes the identified binding at its last good GPU data; an invalid
hint freezes the module. Frozen output targets are excluded from future uploads.
After context loss, hide frozen bindings instead of uploading possibly damaged
CPU memory. Re-enter/reinitialize or an explicit Developer reset recovers them;
view memory and rate counters never enter a gameplay save.

Rate policy is host-owned and client-only. Start at display rate; halve after
three successive scheduled calls whose **total** view cost (marshalling, guest,
validation and renderer adapter) exceeds the admitted view-time target. Never
schedule below 15 Hz while the display can supply 15 Hz; when it cannot, run on
every displayed frame. Recompute the halving limit when display rate changes.
At a reduced rate, recover one halving level after 120 successful scheduled calls
each below half the time target, then start a fresh window. A trap is a failure,
not a cheap recovery sample. Reset overrun/recovery windows on a rate change.
H0 establishes the time target; these thresholds specify the policy rather than
claiming a phone measurement. H14's ≤1 ms/20-binding acceptance remains separate.

H1–H6 rejection coverage must include forged lengths/offsets, arithmetic overflow,
NaN/reinterpret stores, unmetered paths, direct entry-to-entry fuel refill,
recursive/deep calls, hidden memory/global state, stale player handles, per-binding
sample stamps, ring overflow and mixed valid/invalid transaction output. No v1
fallback is permitted for a refused v2 binary, and no shipped v1 bytes change
merely because this additional contract is present.
