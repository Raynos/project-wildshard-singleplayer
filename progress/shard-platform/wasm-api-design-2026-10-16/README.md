# The shard Wasm API, designed: decision scripts on engine mechanics (2026-10-16)

Design only. No game, engine or script code changed. Written by an Opus 5.5 design agent for the W1 mini spike that
starts when W2 closes (G451, G452), under G453 (simulation never lives in `runtime/`) and Jake's picks of 2026-10-16:
engine mechanics + data + Wasm decisions; host APIs take data only; any behaviour hook is a Wasm script reference;
Wasm runs decisions only, event-driven at ≤ 10 Hz; each shard's AssemblyScript stays ≤ 10 % of its legacy size; the
5-test host bar (two real users, no shard nouns, data-driven, server-safe, deletion test); rule of two from W3.
Folded in from the coordinator: the language is AssemblyScript; **Opus writes every per-shard script, Codex builds
the host, bindings and tooling**; every script lands with a seeded headless scenario test in the related-tests gate;
the sim is server-authoritative and seeded (no lockstep, no rollback, no wall clock, no `Math.random`); persistent
script state is **declared in the section and stored by the platform, never in Wasm memory**, with migration rows for
shape changes; the client end state is data first, with a small client-side script only for one-off presentation,
under the same API family and the same budget; hot reload is a later NEXT row.

**The short version.** One ABI (v1) replaces today's six numeric dialects. A script is a pure function per call:
the platform loads its declared state slots, its parameters and a batch of events into a fixed IO block, calls
`ws_handle()`, reads back the state and up to 32 commands, validates all of it as one transaction, and rewinds the
module's memory to its admitted image. Commands drive engine mechanics (moves, strikes, spawns, flags, timers,
cues); they never run code. Sky Reach and Signal Dunes turn out to be almost all data already: their genuinely
one-off logic is the two boss fights' phase decisions (plus the skitterer, already Wasm), about **60 AS lines for
Sky and 130 for Signal**, against budgets of ~1,220 and ~570. The rest of their remaining sim-in-`runtime/` goes
onto hosts that pass the bar (each has the other shard as its second user).

A feasibility sketch compiled the Roc script below against this ABI with the repo's pinned compiler and metering
(`src/sdk/compileScript.ts`, AssemblyScript 0.28.20, stub runtime): 5.4 KB, no table section, and it passes today's
admission (`src/format/scriptAdmission.ts`) with only the export and import lists swapped for v1's. A warm call,
including the 64 KB memory rewind, took 1.3–4 µs on the Mac.

---

## 1. Today: what the Wasm/AS system can do

### 1.1 The kernel is solid

| Piece | What it does | Evidence |
|---|---|---|
| ABI v0 constants | version 0, AS 0.28.20, Binaryen 132, ≤ 256 KB module, ≤ 64 pages, ≤ 512 functions, call depth 64 | `src/format/scriptAbi.ts:2` |
| Exports | `abi_version, __start, init(lo,hi), in_ptr, in_cap, out_ptr, out_cap, out_count, on_tick` | `src/format/scriptAbi.ts:4-6` |
| Imports | `enter, leave, fuel, abort, query(kind,req,resp), finite32, finite64` (+ `memory`), at most 9 | `scriptAbi.ts:8-10`, `scriptAdmission.ts:72` |
| Admission | parses bytes without running them: numeric types only, no tables/start/passive data, every function fuel-metered and depth-wrapped, every float op checked finite, every mutable global exported for snapshots | `src/format/scriptAdmission.ts:57-139` |
| Metering | Binaryen rewrite: a fuel charge at each function entry and loop head, cost `bytes*4 + 128*functions + 1024` per charge | `src/sdk/compileScript.ts:48-96`, cost at `:60` |
| Compile | in-memory asc, `--runtime stub --importMemory -O3`, no bulk memory, virtual helper sources allowed | `src/sdk/compileScript.ts:99-115` |
| Host | one instance per module, f64 IO block (32 input slots + 6-f64 events, 5-f64 effect records), per-call and per-tick fuel, queries ≤ 64/tick, effects ≤ 128, spawns ≤ 8, events ≤ 32, 3 failures disable a module and freeze its entity | `src/engine/script/host.ts:125-325`, limits `src/format/scriptLimits.ts:4` |
| Transactions | effects validated against declared field ranges / archetypes / event ids, then committed with the memory snapshot, or nothing changes | `src/engine/script/effects.ts:50-74`, `host.ts:309-311` |
| Declared state | shared + per-actor numeric fields with privacy, typed bounds, ≤ 24 numeric fields | `src/engine/script/state.ts:16-80`, `src/format/state.ts:24` |
| Composition | one level host, many roles, role-owned entities, cross-role events refused | `src/engine/script/composition.ts:7-60` |
| Client lane | presentation-only ops (offset, rotation, scale, particles), never the sim world | `src/engine/script/client.ts:6-8`, `src/format/clientScripts.ts:14-20` |
| Physics queries | ray, box overlap, nearest walkable, path, deterministic ordering | `src/engine/script/queries.ts:8-36` |

### 1.2 Where scripts run, and how often

| Role (dialect) | Lane | Runs on | Rate | Users |
|---|---|---|---|---|
| Species script | `SpeciesScriptLane`, `src/game/plugin/brain.ts:347-390` | client + headless | think, then act **every body step** (up to 60 Hz per creature) | Signal skitterer |
| Elite script | `EliteScriptLane`, `brain.ts:559-640`, 12 verbs `:500-530` | client + headless | every engaged step | Pine elites, Nalati Qara |
| Director | `DirectorLane`, `src/game/plugin/director.ts:33-80` | client + headless | fixed tick + immediate dispatch | Driftwood, Pine, Nalati |
| Weapon hook | `WeaponHookLane`, `src/game/plugin/weaponFamily.ts:261-300` | client + headless | per hit | Nalati |
| Mover kernel | `src/game/plugin/mover.ts:128,382-389`, kernels in `src/sdk/moverPrograms.ts` | client + headless | **divisor 1 = 60 Hz each** | Sky: 12 mover modules (`far-reach/data/movers.ts`) |
| Shardfile lane | `createShardfileScriptLane`, `src/game/shardfile/scripts.ts:39` | headless sim | `scriptTickDivisor` | Template family |
| Client script | `ClientScriptLane`, `src/engine/script/client.ts` | client | divisor | none shipped |
| Held action | `bindHeldScripts`, Sky `runtime/index.ts:111` | client | per input | Sky `fanGust.as` |

### 1.3 What is missing for real shard logic

1. **Six dialects, magic offsets.** Every lane invents its own slot layout. `skitterer.as` reads input 15 as the
   strike phase and writes fields 31–33 as steering (`src/shards/sunscar-dunes/behaviour/skitterer.as:5-10`);
   elite scripts carry 12 verbs and two argument registers (`brain.ts:500-530`); directors use slots from 6
   (`src/sdk/directorAbi.ts:22`). Only directors and generated state modules get typed AS accessors.
2. **No vocabulary for the world.** A script can set numeric fields on itself, spawn by archetype id, move its own
   position and emit events (`effects.ts:2`). It can't start an engine move or strike, set a quest flag, grant a
   ledger fact, start a timer, play a cue or watch a zone. Each lane bolts those on with its own TS ports.
3. **Per-frame calls.** Species, elite and mover scripts run at body-step rate. Sky alone makes up to ~720 mover
   calls a second. Jake's rule moves per-frame work into engine mechanics.
4. **Saves hold Wasm memory.** `ScriptHost.checkpoint()` writes each module's whole linear memory as a JSON number
   array (`host.ts:221-225`): 65,536 numbers per page. The logical save format already refuses it ("executable
   script memory is deliberately excluded", `src/format/migrations.ts:9`) and has no AS migration hook
   (`asHook` reserved null, `migrations.ts:22`).
5. **Math through the host.** Species and elite scripts call `query(1)` for `sin/cos/atan2` to match old TS bit
   for bit (`skitterer.as:22-29`). AssemblyScript's own `Math` is pure Wasm and deterministic everywhere, so new
   scripts don't need this.
6. **Fuel is a size proxy.** A charge costs `bytes*4 + …` per function entry (`compileScript.ts:60`), so the Roc
   sketch burns ~88k fuel for ~40 µs of work. Budgets are fine as ceilings, not as a cost model.
7. **Hooks still bind to TS objects.** Quest pages reach runtime objects by owner path
   (`far-reach/data/questPageInteractions.ts:12-14`, `sunscar-dunes/data/questPageInteractions.ts:16-29`), and
   the winch observation and the gust scan are TS callbacks in Sky's `runtime/index.ts:88-96,143-146`.

---

## 2. The model: what runs where

### 2.1 Three buckets, one rule

| Bucket | Owns | Examples | Lives in |
|---|---|---|---|
| **Engine mechanics** | anything that runs every frame or fixed step, or is reused | physics, rendering, animation, pathing, flight/ground **moves**, strike runner and contacts, damage, movers, spawns, timers, replication | `src/engine/`, `src/game/` hosts |
| **Data rows** | the numbers and shapes that configure a mechanic | a move's orbit radius, a strike's windup, a quest step's flags, an interaction's needs/sets, a director's stages | platform sections |
| **Wasm decisions** | the genuinely one-off choice of *which* mechanic to run *when* | a boss's phase plan, an odd puzzle rule, a trigger with memory | `behaviour/*.as` → `blobs/wasm/` |

**The rule, in order.** For each piece of behaviour ask:

1. Does it run per frame, or move something smoothly? → **engine mechanic** (a move, presenter or mover). Never Wasm.
2. Can an existing host express it with rows? → **data**.
3. Do two shards (now, or the W3 shard credited under G441) need the same shape, with no shard nouns, data-driven,
   server-safe, and would deleting it break both? → **new host + data**.
4. Otherwise → **Wasm decision script**: event-driven, ≤ 10 Hz, commands only.

A decision is "pick the next move, strike, phase or flag". If you can write it as "every 5 s, if the player is
inside 10 m, start strike X", that is a script over mechanics, not a mechanic.

### 2.2 Sim vs client presentation

| Side | Runs | Holds | Never |
|---|---|---|---|
| **Sim** (server in the MMO; the local sim in single player) | engine mechanics, hosts, data, **sim scripts** | all durable state: flags, ledger, script state slots, actor fields | rendering, wall clock, `Math.random` |
| **Client** | renderer, presenters, client channels, cue rows, **view scripts** (rare) | presentation-only scalars | writes to sim state |
| `runtime/` (transitional) | client-only TS (looks, feel, effects) until it's gone | nothing durable | sim code (ratchet, G453) |

The client learns about sim decisions only through replicated data: actor fields (`phase`, `mode`), flags, public
channel scalars, the current move and strike of each actor (id, start tick, target), and one-shot **cues**.
Because moves and strikes are engine mechanics with data rows, the client runs the same mechanic from the
replicated "move M started at tick T toward target X" and gets smooth motion without a script.

---

## 3. The API (ABI v1)

### 3.1 Shape of a call

```
platform                               module (AssemblyScript)
--------                               -----------------------
rewind memory to the admitted image
write IO block:  header, state slots,
                 params, inbox events ─► ws_handle(): i32
                                         reads IO, calls ws_read / ws_list,
                                         writes state slots in place,
                                         appends commands to the outbox
read state slots + N commands       ◄─  returns N
validate all (types, ranges, declared ids, quotas)
commit state + apply commands at the next fixed step, or refuse the whole call
```

A script keeps nothing between calls. Its memory is a scratch arena; its durable state is the declared slots.
This is what species, elite and weapon hooks already do with `rewind` (`brain.ts:370,597`), made the only mode.

### 3.2 Exports and imports

```ts
// exports (admission checks names, signatures and depth wrappers, as today)
export function ws_abi(): i32                    // ABI major: 1
export function ws_init(seedLo: i32, seedHi: i32): void  // once per instance; builds static tables only
export function ws_io(): i32                     // address of the IO block (8-byte aligned)
export function ws_handle(): i32                 // handle the inbox; returns the command count

// imports (module "env"): the 6 instrumentation imports + memory + two reads = 9, today's cap
declare function ws_read(op: i32, a: f64, b: f64): f64                              // one scalar
declare function ws_list(op: i32, a: f64, b: f64, out: usize, cap: i32): i32       // up to cap f64s
```

Two read imports instead of a generic `query(kind, req, resp)` buffer: scalar reads (most of them) cost one call
and no memory traffic, and admission can check the signatures.

### 3.3 The IO block

All slots are f64, little-endian, at `ws_io()`. Capacities are in the header the module writes in `ws_init`; the host
reads them once at admission and refuses anything over the v1 ceilings.

| Offset (f64) | Name | Writer | Meaning |
|---|---|---|---|
| 0 | `tick` | host | sim tick of this decision tick (60 Hz ticks) |
| 1 | `dt` | host | sim seconds since this binding's previous call |
| 2 | `binding` | host | the binding's stable id |
| 3 | `self` | host | the binding's own actor handle (0 if none) |
| 4 | `events` | host | inbox count, ≤ 16 |
| 5–7 | reserved | | 0 |
| 8 … | `state[0..S)` | host, then script | declared durable slots, S ≤ 16 |
| … | `params[0..P)` | host | the binding's declared parameters, P ≤ 32 |
| … | `inbox[16][6]` | host | `[kind, subject, a, b, c, d]` |
| … | `outbox[32][5]` | script | `[op, target, a, b, c]` |

The generated bindings (§7.2) hide every offset. Authors write `State.phase = 1` and `Do.strike(Actor.roc,
Strike.stoop, target)`.

### 3.4 Entry points: events

A binding is asleep unless it has events. `tick` is just another event, delivered only when the section subscribes
at a declared rate (`tick: 2` means 2 Hz; ≤ 10 Hz, a divisor of the 10 Hz decision tick). Timers are the normal way
to wait.

| Kind | Id | subject | a, b, c, d | Side |
|---|---|---|---|---|
| `start` | 1 | 0 | — | sim, view: the binding became active (encounter began, shard entered, player joined) |
| `tick` | 2 | 0 | — | sim, view: declared rate |
| `timer` | 3 | timer | — | sim, view |
| `zone.enter` / `zone.leave` | 4 / 5 | zone | actor | sim |
| `interact` | 6 | spot | player, act | sim: an interaction row routed to `script` |
| `hit` | 7 | actor | by, damage, hpShare | sim |
| `threshold` | 8 | actor | index | sim: an hp share in the encounter row was crossed |
| `death` | 9 | actor | killer | sim |
| `move.done` | 10 | actor | move, ok | sim: arrived / ready test passed (ok 1) or gave up (ok 0) |
| `strike.done` | 11 | actor | strike, hit | sim |
| `flag` | 12 | flag | value | sim, view |
| `signal` | 13 | signal | value, from | sim: from a director, quest stage or another script |
| `strike.target` | 14 | target | player, strikeKind | sim: a player's strike reached a declared world target |
| `player.join` / `player.leave` | 15 / 16 | player | — | sim (MMO) |
| `spawned` | 17 | actor | spawn row | sim |
| `stop` | 18 | 0 | — | sim, view: deactivated (reset, retry, leave) |
| `field` / `cue` / `channel` | 30 / 31 / 32 | actor / cue / channel | value | **view only**: a replicated change |

Events reach a binding at the next decision tick, in sim order (fixed step, then source order), batched into one
call. More than 16 waiting carry to the next tick. A command never calls back into a script in the same tick.

### 3.5 What a script can READ

Pre-filled (no call): `tick`, `dt`, `self`, its own state slots, its parameters, the event batch.

`ws_read(op, a, b)` (v1.0 op table; each read charges fuel and is recorded in the scenario trace):

| Op | Read | Notes |
|---|---|---|
| 1–4 | actor x, y, z, yaw | declared actors, or handles from events and lists |
| 5 / 6 | actor hp share / alive | |
| 7 | actor field (declared field id) | e.g. `phase`, a pose memory |
| 8 / 19 | distance / bearing between two actors | horizontal |
| 9 | nearest player to an actor | 0 if none in the binding's area |
| 10 / 17 | shared flag / player flag | player flags only with a player handle from an event |
| 11 | timer seconds left | own timers |
| 12 | **seeded random** in [0, 1) | the binding's own stream (§3.8) |
| 13 / 14 | actor in zone / players in zone | declared zones |
| 15 / 16 | actor moving / actor strike state (0 idle 1 windup 2 active 3 recover 4 cooldown) | |
| 18 | alive count of a spawn group | |

`ws_list(op, a, b, out, cap)`: 1 actors in zone, 2 players within r of an actor (sorted by distance, then id),
3 ground height under x, z, 4 nearest walkable point, 5 a path (≤ 32 points). Lists 3–5 reuse today's physics
queries (`src/engine/script/queries.ts`).

A script reads only ids its section declares (actors, zones, flags, fields), plus handles the host gave it in this
call. Anything else is refused.

### 3.6 What a script can DO: commands

| Op | Command | target | a, b, c | Mechanic |
|---|---|---|---|---|
| 1 | `move` | actor | move row, target actor (0 none) | engine move library (§3.7) |
| 2 | `strike` | actor | strike row, target actor | engine strike runner + contacts (`StrikeRunner`) |
| 3 | `stop` | actor | — | cancels move and strike windup |
| 4 | `field` | actor | field id, value | declared public actor field (`phase`, `mode`) |
| 5 / 6 | `spawn` / `despawn` | 0 / actor | spawn row | runtime spawns host |
| 7 | `flag` | 0 | flag, 0/1 | quest flags (shared; player scope with a player handle) |
| 8 | `timer` | 0 | timer, seconds (0 cancels) | platform timers |
| 9 | `signal` | 0 | signal, value | director / quest stage `event:` inputs, other scripts |
| 10 | `grant` | player or 0 | ledger fact | ledger (platform keeps once-only) |
| 11 | `reward` | player or 0 | reward row | coins/items rows |
| 12 | `cue` | actor or 0 | cue row | one-shot presentation (sound, VFX, toast, shake) |
| 13 | `channel` | 0 | channel, value | public replicated scalar for presenters |
| 14 | `impulse` | actor/player | impulse row | player/creature shove (G24 style) |
| 15 | `encounter` | 0 | verb (1 phase, 2 win, 3 fail), value | the boss host (bar, captions, reward, retry) |
| 16 | `weather` | 0 | weather row | weather host |

View scripts (§4) get their own op range from 100: `view.channel`, `view.clip`, `view.vfx`, `view.sound`,
`view.visible`. A sim op from a view script, or a view op from a sim script, is refused at admission of the section
and again at run time.

**Validation.** Each command must name an op in the section's `commands` list, ids declared in the section, a
target the binding owns (its actors, spawns, or a player handle from this call), and arguments inside the row's
bounds. One bad command refuses the whole call. Quotas per call: 32 commands, 4 spawns, 8 timers; per decision tick
across all bindings: 128 commands. Applied commands take effect at the next fixed step.

### 3.7 Engine moves: the mechanic a script drives

The heavy part of a boss is motion, and motion is the part both shards share. A **move** is an engine mechanic with
a data row in a new platform section `actors/moves.json`. It runs every fixed step until it finishes, then raises
`move.done`. Kinds for W1, taken from what `src/engine/ai/diver.ts` does today:

| Kind | Row fields | Users today |
|---|---|---|
| `orbit` | center, r, y, speed, turn, lead, ground? | Roc lap + dais circle, Matriarch circle, rays, wisp |
| `stalk` | standOff, above or altitude, retreat, speed, turn, ready (`over` / `band` / `range`), giveUp | Roc phases 1–3, Matriarch crawl |
| `dive` | speed, slope, skim, maxSeconds, strike (fires on reach) | Roc stoop, Matriarch dive, rays |
| `climb` | seconds, speedBonus, altitude | Matriarch, rays |
| `takeoff` / `perch` | from perch, seconds, speed, turn, bank | Roc |
| `rise` / `lie` | from, to altitude, speed, yaw lead | Matriarch dormant rise, grounded lie |
| `ring-run` | radius, angle, speed, turn | skitterer |
| `burrow` / `surface` | rate | skitterer |

That makes `phased-raptor` (Sky only) and the `phased` diver pattern (Signal only) unnecessary: their phase logic
becomes Wasm and their motion becomes moves. Deleting them removes two single-user engine patterns that would fail
the host bar.

### 3.8 State, saves and migrations

- **Declared state.** A script's section lists its state fields: `{ name, type: bool|i32|f64, default, min, max,
  scope }`, with `scope` one of `binding` (one record per binding), `actor` (per bound actor) or `player` (per
  player, MMO). At most 16 slots a binding. Strings stay out of the numeric ABI (as `directorAbi.ts:43` does today).
- **Storage.** The platform stores the slots with the binding's timers, its RNG draw counter and its failure count.
  The save record is logical and named: `{ script, stateVersion, slots: { phase: 1, … }, timers: { rest: 1.4 },
  rng: 37, failures: 0 }`. Wasm memory is never saved. `ScriptHost.checkpoint()`'s memory dump goes with v0.
- **Migrations.** A change to a script's state shape bumps its `stateVersion` and adds a row to
  `state/migrations.json`, using the ops it already has (`default`, `rename`, `drop`, `map`,
  `src/format/migrations.ts:14-21`) under a new scope `script:<id>`. A new module with the same declared state needs
  no migration: saves hold names, not memory.
- **Restore** never calls a script. The next decision tick carries on. Presentation that must match a restored
  state (a raised bridge) is data on its host (a mover's `restoreFrom` row), not script code.

### 3.9 Determinism

The sim is server-authoritative with no lockstep and no rollback, so determinism serves three things: scenario tests,
save/restore identity and reproducing a server bug. The rules:

- **Time** is `tick` and `dt` from the IO block. No wall clock reaches the module (no import exists).
- **Random** is `ws_read(12)`: a counter-based stream keyed by (shard seed, binding id, encounter instance, draw
  counter). The counter is saved, so a loaded game continues the same stream. AS `Math.random` needs a `seed` import
  that admission refuses.
- **Floats.** Wasm arithmetic is IEEE-exact; NaN and infinities trap (`finite32/64`). AS `Math` is pure Wasm, so new
  scripts drop the host math query.
- **Order.** Bindings are called in ascending id; events in sim order; commands applied in outbox order.

### 3.10 Memory, fuel and time

| Limit | v1 default | Ceiling | Why |
|---|---|---|---|
| Module bytes | — | 256 KB | as v0 |
| Memory | 1 page (64 KB) | 4 pages | 1 page holds the IO block (~3 KB) plus a scratch arena; no `memory.grow` (max = initial) |
| Instance | one per module hash, shared by all its bindings | 8 modules a shard | state lives outside memory, so 100 encounters share one instance |
| Fuel per call | 400k (measured ~88–110k for the Roc sketch) | 2M (v0) | v0 metering is a size proxy (§1.3); set from scenario traces |
| Fuel per decision tick | 2M | 8M (v0) | across all bindings |
| Commands per call / tick | 32 / 128 | | |
| Calls per decision tick | one per binding with events | 64 | |

Allocation inside a call is allowed (AS arrays and strings work on the stub runtime) because the rewind resets the
arena every call. Nothing leaks between calls.

### 3.11 Errors

A trap, fuel overrun, an invalid command or a state value out of range refuses the call: no command applies and
the state slots stay as they were. The failure count goes up. At 3 the binding is disabled and its section's
declared fallback runs: `onFail: "hold"` (actors keep their current move, then idle), `"reset"` (the encounter host
resets the fight) or `"skip"` (the binding's quest step is marked failed for the dev toast only). Development builds
toast the module, event and reason (as `host.ts:319` does); the server logs it. A disabled binding stays disabled
until the encounter restarts.

### 3.12 The host side

- **Who calls in.** The sim's fixed step runs at 60 Hz; the **decision tick** is every 6th step (10 Hz,
  `scriptTickDivisor: 6`, `src/format/shardSections.ts:42`, matching the "decisions 10 Hz" body rate in
  `src/engine/sim.ts:124`). At each decision tick the host walks bindings with pending events in id order.
- **Bindings** come from data: an encounter row (`binding: { encounter: "far.roc.encounter" }` activates while the
  boss host runs the fight), a quest step, a zone, or the shard itself. The binding owns the actors it declares.
- **One host** per sim session (`DecisionHost` in `src/engine/script/`), reusing admission, metering and the
  transaction pattern of `ScriptHost`, without its per-lane worlds. The hot path allocates nothing: prebuilt
  `Float64Array` views over the IO block, commands decoded into a preallocated pool, the rewind a single
  `Uint8Array.set`. Today's host allocates arrays and objects every call (`host.ts:298-307`).
- **Versioning.** `ws_abi()` returns the major. The section declares `abi: "1.0"`; minor versions add ops and event
  kinds only. A section that names an op the engine doesn't know is refused at validation. A major change rebuilds
  every output (G453 (6)); the engine keeps one previous major reader once the MMO needs it. The section's
  `commands` and `reads` lists are also the capability manifest a reviewer reads before admitting a third-party
  shard.

---

## 4. Client vs server

| | Sim script (`side: "sim"`) | View script (`side: "view"`) |
|---|---|---|
| Where | the sim (server; local sim in single player) | each client |
| Events | start, tick, timer, zone, interact, hit, threshold, death, move.done, strike.done, flag, signal, strike.target, player.join/leave, spawned, stop | start, tick, timer, stop, flag, and the replicated `field`, `cue`, `channel` changes |
| Reads | §3.5, all sim | replicated actor position and fields, flags, channels, camera distance, a cosmetic seeded stream |
| Commands | §3.6 | `view.channel` (a local presentation scalar presenters interpolate per frame), `view.clip`, `view.vfx`, `view.sound`, `view.visible` |
| State | declared, platform-stored, saved | declared `local` slots, not saved |
| Budget | counts toward the shard's AS budget | the same budget |

**Data first on the client.** The client end state is graph JSON looks, VFX and animation rows on engine
presenters, and client channel programs (`src/format/clientChannels.ts`) that read replicated fields, flags,
channels and strike state. A view script is for presentation logic a channel program can't express, and neither
Sky nor Signal needs one in W1. The client lane is designed here and built on its first real user.

**How the client reacts without logic in `runtime/`.** A sim script sets `field phase = 2` and fires
`cue far.roc.screech`; the boss bar reads the encounter phase; a clip row reads `phase`; a cue row plays the sound
and the shake; a telegraph presenter reads the strike state the engine already replicates (strike id, windup
progress, aim). Nothing on the client calls into the script, and nothing in `runtime/` decides.

---

## 5. Sky Reach and Signal Dunes, concretely

Both shards are already ported far: Sky's `runtime/` is 212 + 7 + 6 + 5 + 66 lines, Signal's play code is
`plugin.ts` (81) and `world/build.ts` (121). Their quests, interactions, directors, spawns, boss profiles and creature
brains are data rows on platform hosts. What's left is a handful of sim leaks in TS, and two single-user engine
patterns for the bosses.

### 5.1 Sky Reach: sim logic → bucket

| Logic | Where today | Bucket |
|---|---|---|
| Quest: notes → roost → vanes → raise, markers, reward | `data/quests.ts`, `data/questStages.ts`, `data/questHost.ts` | **existing host** (quests + director stages) |
| Roost clear when its 3 rays die | `data/questHost.ts:12` (`all-dead` observation) | **existing host** |
| Keeper talk, notes, winch permission | `data/questGraph.ts`, `data/questPageInteractions.ts:15-18` | **existing host** (interactions) |
| GUST turns a vane in its cone (step 3) | `runtime/index.ts:143-146,203-205` → page `scan`, cone rows `questPageInteractions.ts:10-11` | **new host: strike targets in the sim** (2nd user: Signal's lash cracks). The cone rows stay; the scan moves from the client page into the sim and raises `strike.target` |
| Winch raised → `far.quest.raised` + toast | `runtime/index.ts:88-96` (client channel observer) | **existing host + small addition**: the mover raises `mover.at-end` as the stage input (2nd user: Signal's well bucket); the toast is a cue row |
| Bridge restored raised on load | `runtime/index.ts:112` | **mover row** `restoreFrom: { flag, action }` (2nd user: Signal's bucket `initial: oil`) |
| Updraft columns push the board | `runtime/index.ts:117-118` (installed by runtime) | **existing host** (traverse modes); the platform installs it from the section |
| Creature spawns | `runtime/index.ts:153` `populate` | **existing host** |
| Goat, ray, wisp brains | `data/brains.ts:9-19` | **existing host** (grazer, diver orbit/burst) |
| Roc encounter: arena, hp shares, reward, retry, victory fact | `data/rocFight.ts:24-38`, `bossStages.json` | **existing host** (boss profile `held`, director stages) |
| Roc phases: takeoff, lap, stalk, strike per phase, rests | `data/brains.ts:43-54` + engine `diver.ts` `raptor` pattern (~220 lines, Sky only) | **Wasm `roc.as`** over **engine moves** |
| Gale wall visual | `runtime/index.ts:167-179` | **client presenter row** (lane telegraph; 2nd user: Matriarch's tail ring, Pine's elite ring) |
| Held fan GUST request | `behaviour/fanGust.as` (19 lines) | **data**: a held-melee row field (`heavy: gust`); delete the script |
| Mill, vane rotors, deck glow, wakes, wind fields, storm | `runtime/index.ts:124-161` | client (channel programs, presenters) |
| `stage()` capture helpers | `runtime/index.ts:189-201` | dev capture tooling, not sim |

### 5.2 Signal Dunes: sim logic → bucket

| Logic | Where today | Bucket |
|---|---|---|
| Quest: scout → logbook → oil → waymarks → fire → Matriarch | `data/signalQuest.ts` | **existing host** |
| Talk, logbook, well, pour, light, tower fire rules | `data/signalInteractions.ts:30-44` | **existing host** (interactions) |
| Lash crack on crank / bowl → action | `world/build.ts:100`, page world targets `data/questPageInteractions.ts:11-15` | **new host: strike targets in the sim** (shared with Sky's gust) |
| Fire lit → `rules.mark('fire')`, `flags.set(lit)` | `world/build.ts:88-92` | **existing host**: the interaction row already sets `fire` and `sunscar.lit` (`signalInteractions.ts:39`); delete the TS write, keep `fireCaught` as a client cue |
| Fire summons the Matriarch | `data/signalStages.json` (`spawn`), `questHost.ts:15` | **existing host** |
| Save repair | `data/questRepair.ts` | **existing host** (director) |
| Well bucket raised / restored | client channel `world/build.ts:62-66`, mark `raised` | **mover/channel rows** with `restoreFrom` (shared with Sky) |
| Ray, strider brains | `data/brains.ts:11-20` | **existing host** |
| Skitterer burrow hunt | `behaviour/skitterer.as` (78 lines, every body step) | **Wasm v1 `skitterer.as`** at 10 Hz over `burrow` / `surface` / `ring-run` moves |
| Matriarch encounter: arena, hp shares, rise, storm phase, reward | `data/matriarchBoss.ts`, `matriarchEncounter.ts`, `matriarchPresentation.ts` | **existing host** (boss profile `spawned`, presentation row) |
| Matriarch phases: circle, dive, climb, storm altitude, grounded crawl, tail vs buffet | `data/brains.ts:36-42` + engine `diver.ts` `phased` pattern (~150 lines, Signal only) | **Wasm `matriarch.as`** over **engine moves** |
| Dusk deepens with the quest | `plugin.ts:21-28,69-70` | client channel program over flags (no script) |
| Fire FX, way lights, flicker | `world/fireFx.ts`, `world/build.ts:103-119` | client presenters |

### 5.3 Sky: `roc.as` (recommended, Wasm)

The data the script drives. Every number below is already in `data/brains.ts:43-54` and `data/strikes.ts`; this is
a reshuffle into rows, not new tuning.

```jsonc
// sections/sim/scripts.json (one row)
{ "id": "far.roc", "abi": "1.0", "side": "sim", "module": "blobs/wasm/<sha>.wasm", "source": "behaviour/roc.as",
  "binding": { "encounter": "far.roc.encounter" }, "onFail": "reset",
  "on": ["start", "timer", "move.done", "strike.done", "threshold", "stop"], "tick": null,
  "actors": { "roc": "far.roc" },
  "moves": { "takeoff": "far.roc.takeoff", "lap": "far.roc.lap", "stalkOver": "far.roc.stalk-over",
             "holdBand": "far.roc.hold-band", "daisCircle": "far.roc.dais", "daisWalk": "far.roc.dais-walk" },
  "strikes": { "stoop": "far.roc.stoop", "galeWall": "far.roc.galeWall", "sweep": "far.roc.sweep" },
  "timers": ["rest", "stalkGiveUp"], "cues": { "screech": "far.roc.screech", "lightning": "far.storm.bolt" },
  "fields": { "phase": "phase" },
  "stateVersion": 1,
  "state": [ { "name": "phase", "type": "i32", "default": 0, "min": 0, "max": 2, "scope": "binding" },
             { "name": "mode", "type": "i32", "default": 0, "min": 0, "max": 3, "scope": "binding" },
             { "name": "strikes", "type": "i32", "default": 0, "min": 0, "max": 100000, "scope": "binding" } ],
  "params": { "firstRest": 2, "rest0": 2.4, "rest1": 2.4, "rest2": 1.2, "stalkMax": 12 },
  "reads": ["nearestPlayer", "random"], "commands": ["move", "strike", "field", "timer", "cue", "encounter"] }

// sections/actors/moves.json (excerpt)
{ "id": "far.roc.lap", "kind": "orbit", "center": [ROC.x, ROC.z], "r": 13, "y": ROC.y, "speed": 10, "turn": 2 }
{ "id": "far.roc.stalk-over", "kind": "stalk", "above": 10, "standOff": 2.5, "speed": 12, "turn": 3,
  "ready": { "kind": "over", "radius": 4, "height": 2 }, "giveUp": 12 }
{ "id": "far.roc.hold-band", "kind": "stalk", "altitude": CROWN.y + 7, "standOff": 14, "retreat": true,
  "speed": 12, "turn": 3, "ready": { "kind": "band", "tolerance": 3 } }
{ "id": "far.roc.dais", "kind": "orbit", "center": [DAIS.x, DAIS.z], "r": DAIS.r * 0.4, "y": CROWN.y + DAIS.h + 0.05,
  "speed": 2.4, "turn": 4, "ground": true }
{ "id": "far.roc.dais-walk", "kind": "stalk", "ground": true, "standOff": 3, "speed": 2.4, "turn": 4, "ready": { "kind": "range" } }
{ "id": "far.roc.takeoff", "kind": "takeoff", "perch": "far.roc.perch", "seconds": 4, "speed": 1.6, "turn": 0.15, "bank": 0.35 }
```

The script (the feasibility sketch compiled this file: 50 code lines, ~60 with comments, glue excluded):

```ts
// behaviour/roc.as: the Storm Roc's decisions. Laps, stalks, stoops, landing and contacts are engine mechanics.
import { Actor, Move, Strike, Timer, Cue, Field, State, Params, Do, Read } from './generated/roc';

const REST: i32 = 0, STALK: i32 = 1, STRIKE: i32 = 2, OFF: i32 = 3;
function stalkMove(phase: i32): i32 { return phase == 0 ? Move.stalkOver : phase == 1 ? Move.holdBand : Move.daisWalk; }
function phaseStrike(phase: i32): i32 { return phase == 0 ? Strike.stoop : phase == 1 ? Strike.galeWall : Strike.sweep; }
function restSeconds(phase: i32): f64 { return phase == 0 ? Params.rest0 : phase == 1 ? Params.rest1 : Params.rest2; }

function rest(): void {
  State.mode = REST;
  Do.move(Actor.roc, State.phase == 2 ? Move.daisCircle : Move.lap);
  Do.timer(Timer.rest, restSeconds(State.phase));
}
function stalk(): void {
  const target = Read.nearestPlayer(Actor.roc);
  if (target == 0) { rest(); return; }            // nobody in the arena: keep lapping
  State.mode = STALK;
  Do.move(Actor.roc, stalkMove(State.phase), target);
  Do.timer(Timer.stalkGiveUp, Params.stalkMax);
}

export function onStart(): void {
  State.phase = 0; State.strikes = 0; State.mode = REST;
  Do.move(Actor.roc, Move.takeoff);
  Do.cue(Cue.screech, Actor.roc);
  Do.timer(Timer.rest, Params.firstRest);
}
export function onTimer(timer: i32): void {
  if (State.mode == OFF) return;
  if (timer == Timer.rest && State.mode == REST) stalk();
  else if (timer == Timer.stalkGiveUp && State.mode == STALK) rest();
}
export function onMoveDone(move: i32, ok: bool): void {
  // a stalk that arrives (its row's `ready` test passed) commits the phase's strike
  if (State.mode != STALK || move != stalkMove(State.phase)) return;
  if (!ok) { rest(); return; }
  State.mode = STRIKE; Do.timer(Timer.stalkGiveUp, 0);
  Do.strike(Actor.roc, phaseStrike(State.phase), Read.nearestPlayer(Actor.roc));
}
export function onStrikeDone(_strike: i32, _hit: bool): void {
  if (State.mode != STRIKE) return;
  State.strikes = State.strikes + 1;
  if (State.phase == 0 && Read.random() < 0.25) Do.cue(Cue.lightning, Actor.roc); // a bolt behind it, now and then
  rest();
}
export function onThreshold(index: i32): void {
  // the encounter row's hpShares [1, 0.66, 0.33]: index 1 and 2 open phases two and three
  if (index <= State.phase || index > 2) return;
  State.phase = index;
  Do.field(Actor.roc, Field.phase, f64(index));
  Do.encounterPhase(index);
  Do.cue(Cue.screech, Actor.roc);
  if (State.mode != STRIKE) rest();               // a strike in flight finishes first
}
export function onStop(): void { State.mode = OFF; }
```

The sketch's run, five calls through a mock host (`[op, target, a, b, c]`):

```
start           → move(roc, takeoff) · cue(screech) · timer(rest)                 state [0,0,0]
timer rest      → move(roc, stalkOver, player 101) · timer(stalkGiveUp)           state [0,1,0]
move.done ok    → timer(stalkGiveUp, 0) · strike(roc, stoop, 101)                 state [0,2,0]
strike.done     → move(roc, lap) · timer(rest)                                    state [0,0,1]
threshold 1     → field(roc, phase, 1) · encounter(phase 1) · cue · move(lap) · timer   state [1,0,1]
```

**Before → after.** Before: `ROC_BRAIN` (`data/brains.ts:43-54`) feeds the `phased-raptor` pattern in
`src/engine/ai/diver.ts` (schema `:143-171`, think/act/restore/stage `:415-560`), Sky's only user, and Sky's
`runtime/index.ts:167-179` reads the brain's windup for the gale wall. After: six move rows, three strike rows
(unchanged), one script row, `roc.as` (~60 lines + generated glue), and a telegraph presenter row for the wall.
The raptor pattern leaves the engine.

### 5.4 Sky: the vane and winch step as a script (the Wasm form; **not** recommended)

Under the rule in §2.1 this step is data: the strike-target host and the mover observation each have Signal as a
second user. The script is shown so the API is exercised on a quest step, and as the fallback if Jake rejects the
strike-target host (Q2).

```jsonc
{ "id": "far.vanes", "abi": "1.0", "side": "sim", "source": "behaviour/vanes.as", "binding": { "shard": true },
  "on": ["strike.target", "interact", "move.done", "start"],
  "targets": { "vane0": "far.vane.0", "vane1": "far.vane.1", "vane2": "far.vane.2" },
  "spots": { "winch": "winch" }, "actors": { "bridge": "far.winch.bridge" }, "moves": { "raise": "far.winch.raise" },
  "flags": { "notes": "far.notes", "roost": "far.roost", "vanes": "far.vanes", "raised": "far.bridge",
             "v0": "far.vane.0", "v1": "far.vane.1", "v2": "far.vane.2" },
  "cues": { "vaneTurned": "far.toast.vane", "locked": "far.toast.winch-locked", "raised": "far.toast.raised" },
  "state": [], "commands": ["flag", "move", "cue"], "reads": ["flag"] }
```

```ts
import { Target, Spot, Actor, Move, Flag, Cue, Do, Read } from './generated/vanes';
function vaneFlag(t: i32): i32 { return t == Target.vane0 ? Flag.v0 : t == Target.vane1 ? Flag.v1 : Flag.v2; }
export function onStrikeTarget(target: i32, _player: i32, _kind: i32): void {
  if (!Read.flag(Flag.notes) || Read.flag(vaneFlag(target))) return;
  Do.flag(vaneFlag(target), true); Do.cue(Cue.vaneTurned, 0);
  if (Read.flag(Flag.v0) && Read.flag(Flag.v1) && Read.flag(Flag.v2)) Do.flag(Flag.vanes, true);
}
export function onInteract(spot: i32, _player: i32): void {
  if (spot != Spot.winch || Read.flag(Flag.raised)) return;
  if (!Read.flag(Flag.roost) || !Read.flag(Flag.vanes)) { Do.cue(Cue.locked, 0); return; }
  Do.move(Actor.bridge, Move.raise);
}
export function onMoveDone(_move: i32, ok: bool): void { if (ok) { Do.flag(Flag.raised, true); Do.cue(Cue.raised, 0); } }
export function onStart(): void { if (Read.flag(Flag.raised)) Do.move(Actor.bridge, Move.raise); } // on shard entry
```

Before: `runtime/index.ts:88-96, 112, 143-146, 203-205` plus three stage rows and the page's cone rows. After
(recommended): the same rows, with the cone scan and `mover.at-end` running in the sim host and `restoreFrom` on the
mover row; zero script lines. The fallback script costs ~20 lines.

### 5.5 Signal: `matriarch.as` (recommended, Wasm)

```jsonc
{ "id": "sunscar.matriarch", "abi": "1.0", "side": "sim", "source": "behaviour/matriarch.as",
  "binding": { "encounter": "sunscar.matriarch" }, "onFail": "reset",
  "on": ["start", "timer", "move.done", "strike.done", "threshold", "stop"],
  "actors": { "matriarch": "sunscar.matriarch" },
  "moves": { "rise": "sunscar.m.rise", "circle": "sunscar.m.circle", "stormCircle": "sunscar.m.circle-storm",
             "dive": "sunscar.m.dive", "climb": "sunscar.m.climb", "lie": "sunscar.m.lie", "crawl": "sunscar.m.crawl" },
  "strikes": { "maw": "sunscar.matriarch.dive", "tail": "sunscar.matriarch.tail", "buffet": "sunscar.matriarch.buffet" },
  "timers": ["rest"], "fields": { "phase": "phase", "fight": "fight" }, "cues": { "roar": "sunscar.m.roar" },
  "stateVersion": 1,
  "state": [ { "name": "phase", "type": "i32", "default": 0, "min": 0, "max": 2, "scope": "binding" },
             { "name": "mode", "type": "i32", "default": 0, "min": 0, "max": 5, "scope": "binding" } ],
  "params": { "firstRest": 3, "rest0": 5, "rest1": 3.2, "tailWeight": 2, "buffetWeight": 1 },
  "reads": ["nearestPlayer", "random"], "commands": ["move", "strike", "field", "timer", "cue", "encounter"] }

// moves (numbers from data/species/matriarch.ts MATRIARCH and data/brains.ts:36-42)
{ "id": "sunscar.m.rise", "kind": "rise", "from": 0.9, "to": 18, "speed": 3, "yawLead": 0.4, "turn": 0.6 }
{ "id": "sunscar.m.circle", "kind": "orbit", "center": [BASIN.x, BASIN.z], "r": 30, "y": 18, "speed": 12, "turn": 1.1, "lead": 0.5 }
{ "id": "sunscar.m.circle-storm", "kind": "orbit", "center": [BASIN.x, BASIN.z], "r": 30, "y": 24, "speed": 12, "turn": 1.1, "lead": 0.5 }
{ "id": "sunscar.m.dive", "kind": "dive", "speed": 19, "slope": 0.4, "skim": 4.2, "maxSeconds": 5.5, "aimHeight": 1.2, "strike": "sunscar.matriarch.dive", "turn": 2.4 }
{ "id": "sunscar.m.climb", "kind": "climb", "seconds": 2.4, "speedBonus": 3, "turn": 1 }
{ "id": "sunscar.m.lie", "kind": "lie", "to": 0.2, "speed": 3 }
{ "id": "sunscar.m.crawl", "kind": "stalk", "ground": true, "standOff": 9, "speed": 2.2, "turn": 1.2, "ready": { "kind": "range" } }
```

```ts
// behaviour/matriarch.as: the Dune Matriarch's decisions. The boss row owns the rise, the storm weather and the reward.
import { Actor, Move, Strike, Timer, Cue, Field, State, Params, Do, Read } from './generated/matriarch';

const RISE: i32 = 0, CIRCLE: i32 = 1, DIVE: i32 = 2, CLIMB: i32 = 3, CRAWL: i32 = 4, OFF: i32 = 5;
const m = Actor.matriarch;

function circle(): void {
  State.mode = CIRCLE;
  Do.move(m, State.phase == 1 ? Move.stormCircle : Move.circle);
  Do.timer(Timer.rest, State.phase == 0 ? Params.rest0 : Params.rest1);
}
function grounded(): void {
  const target = Read.nearestPlayer(m);
  State.mode = CRAWL;
  Do.move(m, Move.crawl, target);                   // lies down first if still aloft (the move row handles the drop)
}
function groundStrike(): void {
  // tail sweep twice as often as the buffet (row weights 2 : 1); the strike rows keep their own cooldowns
  const total = Params.tailWeight + Params.buffetWeight;
  const pick = Read.random() * total < Params.tailWeight ? Strike.tail : Strike.buffet;
  Do.strike(m, pick, Read.nearestPlayer(m));
}

export function onStart(): void {
  State.phase = 0; State.mode = RISE;
  Do.field(m, Field.fight, 1);
  Do.move(m, Move.rise);
  Do.cue(Cue.roar, m);
}
export function onMoveDone(move: i32, ok: bool): void {
  if (State.mode == OFF) return;
  if (State.mode == RISE) { circle(); Do.timer(Timer.rest, Params.firstRest); return; }
  if (State.mode == DIVE) { State.mode = CLIMB; Do.move(m, Move.climb); return; }   // hit or miss, she climbs away
  if (State.mode == CLIMB) { circle(); return; }
  if (State.mode == CRAWL && ok) groundStrike();
  else if (State.mode == CRAWL) grounded();
}
export function onTimer(_timer: i32): void {
  if (State.mode != CIRCLE) return;
  const target = Read.nearestPlayer(m);
  if (target == 0) { circle(); return; }
  State.mode = DIVE;
  Do.move(m, Move.dive, target);                    // the dive row fires the maw strike when it reaches the chest
}
export function onStrikeDone(_strike: i32, _hit: bool): void { if (State.mode == CRAWL) grounded(); }
export function onThreshold(index: i32): void {
  if (index <= State.phase || index > 2) return;
  State.phase = index;
  Do.field(m, Field.phase, f64(index));
  Do.encounterPhase(index);                         // the boss row turns the storm on for phase index 1
  Do.cue(Cue.roar, m);
  if (index == 2) { Do.timer(Timer.rest, 0); Do.move(m, Move.lie); State.mode = CRAWL; }
  else if (State.mode == CIRCLE) circle();
}
export function onStop(): void { State.mode = OFF; Do.field(m, Field.fight, 0); }
```

Before: `MATRIARCH_BRAIN` (`data/brains.ts:36-42`) on the `phased` pattern in `src/engine/ai/diver.ts` (and its
`phasedFlyer.ts` wrapper), Signal's only user. After: seven move rows, the unchanged strike rows and boss profile,
one script row and ~75 lines of AS.

### 5.6 Signal: the signal fire as a script (the Wasm form; **not** recommended)

The signal fire is already declared rows: `SIGNAL_INTERACTIONS` (`data/signalInteractions.ts:30-44`) holds every
rule, and `signalStages.json` summons the Matriarch. What remains in TS is a duplicate flag write in
`world/build.ts:88-92`, which goes. For comparison, the same rules as a script (~35 lines):

```ts
import { Spot, Target, Flag, Mark, Spawn, Cue, Do, Read } from './generated/signal';
// marks are binding-scoped state slots (oiled.0..2, lit.0..2, raised, fire); flags are the saved quest flags
export function onInteract(spot: i32, _player: i32): void {
  if (spot >= Spot.pour0 && spot <= Spot.pour2) {
    const i = spot - Spot.pour0;
    if (Mark.lit(i)) { Do.cue(Cue.already, 0); return; }
    if (!Read.flag(Flag.oil)) { Do.cue(Cue.needOil, 0); return; }
    Mark.setOiled(i, true); Do.cue(Cue.crackToLight, 0);
  } else if (spot == Spot.fire) {
    if (Mark.fire) return;
    if (!(Mark.lit(0) && Mark.lit(1) && Mark.lit(2))) { Do.cue(Cue.fireHint, 0); return; }
    Mark.fire = true; Do.flag(Flag.lit, true); Do.cue(Cue.catchFire, 0);
    Do.spawn(Spawn.matriarch);
  }
}
export function onStrikeTarget(target: i32, _player: i32, heavy: i32): void {
  if (target == Target.crank && heavy != 0 && !Mark.raised) { Mark.raised = true; return; }
  if (target >= Target.bowl0 && target <= Target.bowl2) {
    const i = target - Target.bowl0;
    if (Mark.lit(i) || !Mark.oiled(i)) return;
    Mark.setLit(i, true); Do.flag(Flag.waymark0 + i, true); Do.cue(Cue.waymarkLit, 0);
  }
}
```

The rows win: they are already shared with Driftwood, Pine and the Template through the interactions host, and
they carry the prompt labels and progress toasts the script would have to re-declare.

### 5.7 Signal: `skitterer.as` moves to v1

Today it runs every body step and does its own steering math through the host's `Math`
(`behaviour/skitterer.as:22-29,73-76`). In v1 it subscribes to `tick: 10` plus `move.done` and `strike.done`,
and drives three moves: `burrow` / `surface` (the burrow pose rate, `field 21` today), `ring-run` (the ring round
the player at the body's own angle, `:73-76`) and a retreat `stalk` with `retreat: true`. Its three slots become
declared state (`state`, `clock`, `far`). Estimated 55 lines, down from 78. It stays Wasm: a burrow-and-ring hunt
has no second user yet. When a W3 shard needs one, it becomes a host (rule of two) and the script goes.

### 5.8 Line estimates

**AssemblyScript per shard** (legacy measured as `.ts` + `.as` lines under `src/shards/<slug>-legacy/`; the ruler's
TS-only count will be a little lower):

| Shard | Legacy | AS budget (10 %) | W1 scripts | AS lines | % of legacy |
|---|---|---|---|---|---|
| Sky Reach | 12,189 | ~1,219 | `roc.as` (60); `fanGust.as` deleted (−19) | **~60** (net +41) | 0.5 % |
| Signal Dunes | 5,741 | ~574 | `matriarch.as` (75), `skitterer.as` v1 (55, was 78) | **~130** (net +52) | 2.3 % |

Generated glue and bindings are build output and don't count.

**Platform lines W1 adds and removes** (for the net-lines report, Jake's pick (4)):

| Piece | Adds | Removes | Lane |
|---|---|---|---|
| `src/format/scriptAbiV1.ts` + `scripts` section v1 schema and rules | 220 | | Codex |
| `src/format/moves.ts` (move rows) | 90 | | Codex |
| `src/engine/script/decision.ts` (DecisionHost: IO, rewind, slots, RNG, timers, scheduler, validation, fallback, metrics) | 420 | | Codex |
| `src/engine/ai/moves.ts` (orbit, stalk, dive, climb, takeoff, rise/lie, ring-run, burrow) | 380 | | Codex |
| `diver.ts` `raptor` + `phased` patterns, `phasedFlyer.ts` | | 400 | Codex |
| game wiring: encounter → binding, events from combat / movers / zones / interactions, commands → mechanics, replication | 260 | | Codex |
| strike targets in the sim (scan out of the page into the sim host) | 120 | 80 | Codex |
| mover `at-end` observation + `restoreFrom` | 60 | | Codex |
| lane telegraph presenter (client) | 90 | | Opus |
| SDK: AS core lib, binding + glue generator, `wildshard build` compile + budget check | 300 | | Codex |
| SDK: scenario harness + gate mapping | 180 | | Codex |
| **Total** | **~2,120** | **~480** | net **+1,640** |

Shard custom TS going down in W1: Sky `runtime/index.ts` loses ~60 sim lines (winch observer, restore command, gust
scan, updraft install, gale wall system); Signal loses ~30 (`world/build.ts` flag writes, crack routing). So W1 is
a platform investment: ~+1,640 platform, ~−90 shard TS, ~+95 AS net. The payback comes when the v0 dialects go (the
species, elite, director and weapon-hook lanes and v0 worlds in `brain.ts`, `director.ts`, `weaponFamily.ts`,
`host.ts`, `effects.ts`, `composition.ts`, roughly −1,200 lines) as W3 ports Pine, Nalati and Nine onto v1. A
cheaper W1 (Q1 option B) keeps the two diver patterns and skips the moves library: ~+1,260 / −80.

---

## 6. Performance and safety on the iPhone

| Item | Rule | Number |
|---|---|---|
| Call frequency | one call per binding with events per decision tick (10 Hz); a sleeping binding costs nothing | Sky ~2 calls/s in the Roc fight; Signal ~10/s with the skitterers awake. Today: Sky's 12 mover modules alone at 60 Hz (up to ~720 calls/s) |
| Batching | all of a binding's events in one call (≤ 16); all commands back in one outbox read | one JS↔Wasm crossing per binding per tick, plus its reads |
| Reads | scalar `ws_read` is one import call, no memory traffic; lists write straight into the module's memory | fuel-charged, ≤ 64 per call |
| Host allocation | none on the hot path: preallocated views and command pool, no per-call arrays or objects | today `host.ts:298-307` allocates every call |
| Wasm allocation | arena per call, reset by the rewind; no `memory.grow` | 1 page = 64 KB copied per call |
| Measured (Mac, sketch) | warm call incl. rewind | 1.3–4 µs; first calls ~20–60 µs (JIT) |
| Expected (iPhone 17 Pro, throttled ×2) | | < 20 µs a call, < 0.5 ms a second: under 0.1 % of a 30 fps frame budget |
| Memory | one instance per module, 1 page live + 1 admitted image | ~128 KB a module, vs today's 24 MB reservation (`scriptLimits.ts:4`, `host.ts:184-185`) |
| Fuel | per-call 400k, per-tick 2M; a module that exceeds them is refused, then disabled | |

**What's measured.** The DecisionHost counts, per binding: calls/s, µs per call (p50/p95), fuel per call
(p50/p95/max), events carried over, commands, refusals and disables. They show in the perf HUD's script row and in
telemetry, and every scenario test asserts the fuel ceiling of each call it runs. The phone checks follow the
milestone rule (soak, frame floor): no new per-frame cost is expected, because nothing in v1 runs per frame.

---

## 7. Build, tooling, testing

### 7.1 `wildshard build <slug>`

1. Read `sections/sim/scripts.json` rows from source `data/` (TypeScript, build-time only, G448).
2. For each row: generate `behaviour/generated/<id>.ts` (the bindings, §7.2) and the glue entry, compile with the
   pinned compiler (`compileScript`, unchanged flags plus `--maximumMemory` = the row's pages), instrument, admit
   with the v1 contract, and write `blobs/wasm/<sha256>.wasm`. The row's `module` gets the hash.
3. Check the AS budget: author `.as` lines per shard (comments and blanks out, generated files out) against 10 % of
   legacy. The ruler shows the AS column beside custom %.
4. Validation (§2.8 of the shardfile design, step 6) gains: every row's ids resolve in their sections, `on` / `reads`
   / `commands` are v1.0 names, `tick` ≤ 10 Hz, pages ≤ 4, `side` matches the op ranges, state matches the latest
   `stateVersion` and a migration chain reaches it.

Authors keep `.as` sources in `behaviour/` (the build passes them as `.ts` to asc, as `buildBehaviourProject` does
today, `src/sdk/buildBehaviour.ts:57-63`). The old `behaviour/build.json` goes when the last v0 module does.

### 7.2 Type-safe bindings, generated from the format

From the script's row the build writes, for that script only:

- `namespace Actor / Move / Strike / Timer / Cue / Field / Flag / Zone / Spot / Target / Spawn / Signal`:
  `const` i32 ids, the row's names in camelCase (collisions and reserved words refused, as `directorAbi.ts:16`).
- `class State` with typed getters and setters per declared slot (`bool` / `i32` / `f64`), range-checked on write
  in development builds.
- `class Params` getters.
- `class Do` with one method per op in `commands`, and `class Read` with one per op in `reads`. An op not in the
  row has no method, so a script can't even compile a call the section doesn't allow.
- The glue: `ws_abi`, `ws_init` (writes the layout header), `ws_io`, and `ws_handle`, a `switch` over the row's `on`
  list that calls the author's `onStart`, `onTimer(timer)`, `onMoveDone(move, ok)` … A missing handler is a compile
  error; a handler for an event not in `on` is a build error. A `switch` compiles to `br_table`, not a function
  table, so admission's "no tables" rule holds (confirmed in the sketch).

The core library (`@wildshard/sdk/as/ws.ts`: IO offsets, `command()`, the import declarations) is hand-written once.

### 7.3 Testing: the scenario test

Every script lands with one (Jake's pick (3)). It is seeded, deterministic, runs in seconds and is the
server-safety proof: it runs the real DecisionHost on the built `.wasm` with no renderer, no `runtime/` and no
browser.

```ts
// test/scripts/far-reach-roc.test.ts
import { scenario } from '@wildshard/sdk/scriptScenario';
test('the Roc stalks, stoops, rests and opens phase two at 66 %', async () => {
  const s = await scenario('far-reach', 'far.roc', { seed: 6417, players: [{ id: 101, at: [0, 30, -20] }] });
  s.send('start');                        expect(s.commands()).toEqual([['move', 'roc', 'takeoff'], ['cue', 'screech'], ['timer', 'rest', 2]]);
  s.advance(2);                           expect(s.commands()).toContainEqual(['move', 'roc', 'stalkOver', 101]);
  s.send('move.done', 'roc', 'stalkOver', true);  expect(s.commands()).toContainEqual(['strike', 'roc', 'stoop', 101]);
  s.send('threshold', 'roc', 1);          expect(s.state()).toMatchObject({ phase: 1 });
  expect(s.maxFuel()).toBeLessThan(400_000);
  s.save(); s.restore();                  expect(s.state()).toMatchObject({ phase: 1 });   // logical save round trip
});
```

The harness feeds events, answers reads from a small declared world (actor positions, flags, players), advances
sim time so timers fire, and records every command, read and state change. A trace snapshot can be committed for
the boss fights. The gate's related-tests selection (`scripts/gate-related-tests.mjs`) gets one rule: a changed
`src/shards/<slug>/behaviour/<id>.as` or its script row selects `test/scripts/<slug>-<id>.test.ts`.

The milestone proof stays the full headless sim of the shard from its built shardfile alone (`wildshard prove`, no
`runtime/headless.ts`): that is what G453 (2) asks W1 to show.

### 7.4 Admission

Admission runs `admitScript` with a contract parameter (v0 or v1 export and import lists; the sketch passed with
only those swapped), then the v1 checks: layout header within the ceilings, `ws_abi() == 1`, memory max = initial
≤ 4 pages, and the section cross-checks above. The bytes' hash must equal the row's `module`.

---

## 8. Migration rows for the W1 spike

Lane rules: **Codex builds** the host, format, bindings and tooling; **Opus writes every per-shard script** and does
the graphical rows; Opus designs (this doc) and reviews Codex's host rows against it. In order:

| # | Row | Size | Lane | Done when |
|---|---|---|---|---|
| A1 | `scriptAbiV1.ts` op tables (events, reads, commands, layout) + `scripts` section v1 schema + rules + admission contract parameter | M | Codex | schema in `pnpm gen`; admission test passes the sketch module |
| A2 | `DecisionHost`: IO block, rewind, platform-stored slots, seeded per-binding stream, timers, event queue, 10 Hz scheduler, command validation transaction, `onFail`, zero-alloc hot path, metrics | L | Codex | unit tests: refusal leaves state and world untouched; restore never calls the module; fuel ceilings |
| A3 | SDK: `ws.ts` core lib, bindings + glue generator, `wildshard build` compiles and checks the AS budget, logical save records + `script:<id>` migration scope | M | Codex | Template builds a v1 test script end to end |
| A4 | Scenario harness `@wildshard/sdk/scriptScenario` + gate mapping | M | Codex | a sample scenario runs in < 2 s in the gate |
| A5 | Engine moves library + `actors/moves` section (orbit, stalk, dive, climb, takeoff, rise/lie, ring-run, burrow) | L | Codex (Opus checks motion against captures) | headless traces of the old raptor / phased patterns and the new moves are close (G415: similar, not identical) |
| A6 | Game wiring: encounter/quest/zone bindings, events from combat, movers, zones, interactions; commands to mechanics; replication of fields, cues, channels, move/strike starts | M | Codex | both bosses run headless from rows |
| S1 | `roc.as` + Roc script row + move rows + scenario test; delete the `raptor` pattern and `ROC_BRAIN` | S | **Opus** | scenario green; Roc fight plays in the build |
| S2 | Sky sim out of `runtime/`: strike targets in the sim (gust), mover `at-end` + `restoreFrom` (winch), platform-installed updraft; `fanGust.as` → held-melee row | M | Codex | `runtime/index.ts` holds no sim; quest completes headless |
| S3 | Gale wall → lane telegraph presenter row | S | **Opus** (graphical) | looks as before in a capture |
| S4 | `matriarch.as` + row + moves + scenario; delete the `phased` pattern | S | **Opus** | scenario green; fight plays |
| S5 | `skitterer.as` → v1 at 10 Hz on burrow / ring-run moves + scenario | S | **Opus** | scenario green; no per-step Wasm calls left in Signal |
| S6 | Signal sim out of TS: drop `world/build.ts` flag writes, lash cracks through strike targets, bucket `restoreFrom` | S | Codex | quest completes headless |
| R1 | Ruler and report: AS column beside custom %, net lines (shard custom vs platform), script metrics row in the report | S | Codex | hourly report shows them |
| P1 | Milestone proof: both shards' sim run from the built shardfile alone (`prove`), then the milestone soak and frame floor | S | Opus | receipts in `progress/` |

Later rows (not W1): migrate each v0 role (species, elite, director, weapon hook) to v1 as its shard ports in W3,
then delete v0 (Z row); mover kernels to an engine mover mechanic (Q6); the client view-script lane on its first
real user; per-block fuel metering (Q3); hot reload (NEXT, Jake's pick).

---

## 9. Questions for Jake

1. **Boss motion: moves library or keep the patterns?** (A) Engine moves library; Wasm picks the moves; the
   single-user `raptor` and `phased` patterns leave the engine (+380 / −400 lines, MMO-ready, the shape every later
   boss uses). (B) Keep both patterns as engine code and let Wasm only set the phase (cheaper now, keeps two
   single-user patterns that fail the host bar). **Recommend A.**
2. **Gust vanes and lash cracks: one sim host or two scripts?** (A) Strike targets become a sim host (Sky's gust
   and Signal's crack are the two users; the rows already exist). (B) Each shard handles them in its own Wasm
   (~20 + ~35 AS lines). **Recommend A.**
3. **Fuel metering in W1.** (A) Keep v0's coarse per-function metering and set ceilings from scenario traces;
   per-block metering is a NEXT row. (B) Build per-block metering now (~150 lines of Binaryen pass) so fuel means
   cost. **Recommend A.**
4. **Module instances.** (A) One instance per module hash, shared by every binding (state lives outside memory, so
   a hundred MMO encounters share one). (B) One instance per binding (simpler to reason about, ×N memory).
   **Recommend A.**
5. **The v0 dialects.** (A) Migrate each v0 role to v1 when its shard ports in W3, delete v0 after (Z row).
   (B) Migrate all of them inside the W1 spike (+3–4 L rows, delays W3). **Recommend A.**
6. **Mover kernels at 60 Hz.** (A) Move them to an engine mover mechanic driven by track rows (a NEXT row), so no
   Wasm runs per frame anywhere. (B) Keep them as platform-owned Wasm kernels, exempt from the 10 Hz rule.
   **Recommend A.**
7. **Ticks by default?** (A) Event-only by default; a script opts into `tick` at ≤ 10 Hz and waits with timers.
   (B) Every binding ticks at 10 Hz. **Recommend A.**
8. **Client view-script lane.** (A) Design now (§4), build on its first real user; Sky and Signal need none.
   (B) Build it in W1 anyway. **Recommend A.**
