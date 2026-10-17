# Script ABI v1 — as built

Reviewed against local `main` at `74cc3361d`, 2026-10-17, for G484(b).
This is the executable contract, including its gaps. The design and future
feature ownership are recorded in [G484](plans/shard-platform/decisions.md).
Source links give the defining file and line at this revision; concurrent
uncommitted work is excluded.

## Authoring, compilation and admission

A v1 row in `sim/scripts` declares `abi: "1.0"`, `side`, an authored
`behaviour/*.as` source, a `blobs/wasm/<sha256>.wasm` module, binding, capabilities,
state, parameters, pages and fallback. Only `side: "sim"` reaches `ShardDecisions`;
the engine decision host rejects view bindings. [format/decisionScripts.ts:18](../src/format/decisionScripts.ts#L18) [game/shardfile/decisions.ts:103](../src/game/shardfile/decisions.ts#L103) [engine/script/decision.ts:138](../src/engine/script/decision.ts#L138)

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
| 17 | `spawned` / `onSpawned(spawn)` | Not wired: generated handler, no spawn-command owner or producer | [sdk/decisionScriptBindings.ts:44](../src/sdk/decisionScriptBindings.ts#L44) [game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) |
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
| 18 | `spawnGroupAlive(spawn)` | **Single actor alive (0/1)** using a declared spawn/actor handle; not a group count | [game/shardfile/decisions.ts:197](../src/game/shardfile/decisions.ts#L197) [format/decisionBindings.ts:64](../src/format/decisionBindings.ts#L64) |
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
| 5 | `spawn`: `[0, spawn, 0, 0]` | Refused at installation; **spawn director** feature commit must own it | [game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200) |
| 6 | `despawn`: `[actor, 0, 0, 0]` | Refused at installation; **spawn director** feature commit must own it | [game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200) |
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

These four refused sim commands fail even if never executed: listing the
capability is sufficient to refuse `ShardDecisions` construction. There is no
`mover` command. G484 keeps winch/well behavior in interaction rows; `view.field`
105 is only a fallback proposal and is absent from the numeric table.
[game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) [format/scriptAbiV1.ts:16](../src/format/scriptAbiV1.ts#L16) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200)

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
| Spawn group | G484(a) port is separate work; absent from this reviewed committed schema | [format/decisionScripts.ts:23](../src/format/decisionScripts.ts#L23) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200) |

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
| Spawns/timers | ≤ 4 spawn commands / ≤ 8 timer commands per call; spawn mechanic still refused; ≤ 64 declared timer names | [engine/script/decision.ts:298](../src/engine/script/decision.ts#L298) [game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) [format/decisionScripts.ts:33](../src/format/decisionScripts.ts#L33) |
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
create a separate player-indexed storage bank. `local` is schema-only view state
and never accepted by the sim owner. [format/decisionScripts.ts:13](../src/format/decisionScripts.ts#L13) [format/decisionScripts.ts:60](../src/format/decisionScripts.ts#L60) [engine/script/decision.ts:72](../src/engine/script/decision.ts#L72) [engine/script/decision.ts:167](../src/engine/script/decision.ts#L167) [engine/script/decision.ts:379](../src/engine/script/decision.ts#L379) [game/shardfile/decisions.ts:142](../src/game/shardfile/decisions.ts#L142)

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
  `spawned` and `strike.target` still lack producers in the decision owner.
  [progress/shard-platform/wasm-api-design-2026-10-17/README.md:88](../progress/shard-platform/wasm-api-design-2026-10-17/README.md#L88) [game/shardfile/decisions.ts:336](../src/game/shardfile/decisions.ts#L336) [game/shardfile/decisions.ts:380](../src/game/shardfile/decisions.ts#L380) [sdk/decisionScriptBindings.ts:42](../src/sdk/decisionScriptBindings.ts#L42)
- **Group API:** `spawnGroupAlive` reads one actor's alive flag. G484(a)'s
  spawn-group binding/skitterer port is not part of this reviewed revision;
  do not infer a group count or group binding from the read's name.
  [game/shardfile/decisions.ts:197](../src/game/shardfile/decisions.ts#L197) [format/decisionBindings.ts:64](../src/format/decisionBindings.ts#L64) [format/decisionScripts.ts:23](../src/format/decisionScripts.ts#L23) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200)
- **Refused operations:** spawn/despawn, impulse and weather remain install-time
  refusals until their owning feature commits. No mover command exists. View
  ids are declarations without a v1 runner; `view.field` 105 has no numeric id
  in the built ABI. [game/shardfile/decisions.ts:132](../src/game/shardfile/decisions.ts#L132) [format/scriptAbiV1.ts:16](../src/format/scriptAbiV1.ts#L16) [engine/script/decision.ts:138](../src/engine/script/decision.ts#L138) [docs/plans/shard-platform/decisions.md:200](../docs/plans/shard-platform/decisions.md#L200)
- **Saves:** migration chains are checked by format admission, but decision
  restore requires exact stateVersion; it does not run those migrations.
  Player-scoped state is per binding with owner validation, not a multiplayer
  player map. [format/decisionScripts.ts:112](../src/format/decisionScripts.ts#L112) [engine/script/decision.ts:413](../src/engine/script/decision.ts#L413) [engine/script/decision.ts:167](../src/engine/script/decision.ts#L167) [engine/script/decision.ts:394](../src/engine/script/decision.ts#L394)
- **Bounds/fallbacks:** 16 events bounds a delivered batch, not total queued
  events. `hold` does not freeze an already-running move; `skip` does not
  advance story state. These are the actual implementations, not guarantees
  of queue boundedness or story recovery. [engine/script/decision.ts:80](../src/engine/script/decision.ts#L80) [engine/script/decision.ts:269](../src/engine/script/decision.ts#L269) [game/shardfile/decisions.ts:149](../src/game/shardfile/decisions.ts#L149)
