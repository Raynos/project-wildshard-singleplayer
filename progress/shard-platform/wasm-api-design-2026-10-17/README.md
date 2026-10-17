# Shard Wasm API (design, updated 2026-10-17)

How behaviour that only one shard has runs without shard TypeScript: engine mechanics + data rows + small
AssemblyScript (AS) decision scripts. This replaces the 10-16 design
(`progress/shard-platform/wasm-api-design-2026-10-16/README.md`, `489075944`) as the current design. Statuses and line
counts are read from `main` at `4b5d02334` (2026-10-17). Read-only; nothing was built or run.

Decisions: G454 (host bar; Wasm decisions only, ≤ 10 Hz), G455 (AS, scenario-tested, seeded, declared state), G456 (3)
(Template reference script), G457 (the eight 10-16 questions, all as recommended), G463 (4) (build refuses AS over 10 %
of legacy), G470 (single-shard logic to AS), G473–G478 (approved platform features first), G480 (Z features need
designs), G481 (`docs/HOST-BAR.md`), G482 (features self-score).

## What changed since 10-16

- **Built.** ABI v1 tables (`src/format/scriptAbiV1.ts`), the decision host (`src/engine/script/decision.ts`,
  `decisionModule.ts`), the game's decision owner (`src/game/shardfile/decisions.ts` `ShardDecisions`, plus
  `borrowedDecisions.ts` for retained bodies), generated AS bindings (`src/sdk/decisionScriptBindings.ts`), rows built
  from author AS at intake (`8773818e4`), and the build's AS ceiling check.
- **Five real v1 scripts:** Sky Roc (`13ad96dda`), Signal Matriarch (`205bf946a`), Driftwood Captain and Pine King
  (`a68cc666a`), Template boss (`41dc937fc`). `phased-raptor` and `phased` (`format/phasedFlyers.ts`) are deleted.
- **G457:** engine moves library; one strike-targets host; coarse fuel; one instance per module; v0 dialects move as each
  shard ports; mover kernels become an engine mover mechanic; event-only scripts; view lane on its first real user.
- **Host bar is permanent** (`docs/HOST-BAR.md`): six tests; test 6 makes an AS script reference the only allowed
  per-shard hook. Every feature commit states its score (G482).
- **AS is the home for single-shard logic** (G470), but **approved platform features come first** (G473–G478).
- **Budgets re-based** on the frozen legacy basis (`lint/legacy-line-basis.json`, ruler-basis audit 10-17): Sky ceiling
  677 (10-16 page said ~1,219), Signal 412 (was ~574).
- **Gaps found 10-17:** `interact` not wired; `spawn`, `despawn`, `impulse`, `weather` refused (`decisions.ts:132`);
  proposed `view.field` 105, a `scene` client-script target kind, maybe `mover`; Signal's skitterer still steers per tick
  in v0 Wasm.
- **As-built script style:** one `step` slot (`phase × 10 + mode`), handlers must match the row's `on` list exactly, rows
  live in each shard's `generators/`.

## 1. The model

Where code goes (`docs/HOST-BAR.md`):

| Place | Holds |
|---|---|
| Engine `src/engine` | Rendering, physics, input, audio, boot, levels; moves, strikes, movers. No game or shard knowledge |
| Game `src/game` (+ rows in `src/format`) | Wildshard concepts two shards use or Jake approved (G473–G478); row-driven; never names a shard |
| Shard data | Rows, sections, GLB, look graphs, generator output (`generators/` never counts, G467) |
| Shard AS `behaviour/*.as` | Rules, decisions and story only this shard has; events in, commands out, ≤ 10 Hz; ≤ 10 % of legacy |
| Shard view code | Per-frame drawing only this shard has; listed with a reason; counts as custom |
| Delete | Dead code, finished Debug rows, legacy paths, plugin scaffolding when runtimes reach zero |

Decision ladder for each piece of behaviour:
1. Runs every frame or moves something smoothly → engine mechanic (move, strike, mover, channel). Never AS.
2. A setting on an existing feature row → data.
3. A look reacting to flags, clock or player mode → client channel row.
4. Two shards need the shape, or Jake approved it → platform feature scoring 6/6 on the host bar, plus rows.
5. Otherwise, only this shard has it → AS decision script.
6. Per-frame drawing only this shard has → listed view code.

Six host-bar tests: two real users (or approved / pending with recheck); no shard nouns; data-driven; server-safe or
labelled client; deletion test; data-only API (per-shard hook = AS script reference, never TS callback, subclass or
`{owner, path}`).

Why decisions only: a JS→Wasm crossing per body per frame is the cost (Sky's old mover scripts: up to ~720 calls/s); a
decision script is called only with events, all batched; the engine steps moves at 60 Hz so motion stays smooth; state is
declared slots, so saves and a headless server need no Wasm memory.

## 2. The ABI today (v1)

One call per binding with events, every 6th fixed step (10 Hz): rewind memory to the admitted image; write IO (tick, dt,
state, params, ≤ 16 events × 6 f64); `ws_handle()` returns N commands (≤ 32 × 5 f64); the host checks every id, range,
quota and authority; stages; applies at the next fixed step, or refuses the whole call.

Exports: `ws_abi(): i32` (1), `ws_init(lo, hi)`, `ws_io(): i32`, `ws_handle(): i32`. Imports: `ws_read(op, a, b): f64`,
`ws_list(op, a, b, out, cap): i32`, plus the compiler's `enter`, `leave`, `fuel`, `abort`, `finite32`, `finite64`.
Generated bindings: `Actor`, `Move`, `Strike`, `Timer`, `State`, `Params`, `Do`, `Read`, `Event`. One exported handler per
subscribed event (`checkDecisionHandlers`).

### Events

| Id | Event | Status |
|---|---|---|
| 1, 18 | start, stop | works (binding lifecycle) |
| 2 | tick (1/2/5/10 Hz opt-in) | works (King, Captain at 10) |
| 3 | timer | works |
| 4, 5 | zone.enter, zone.leave | works (quest region triggers) |
| 6 | interact | **not wired**: `ShardDecisions.interact(id)` exists (`decisions.ts:431`), no caller |
| 7 | hit | works |
| 8, 9 | threshold, death | works |
| 10, 11 | move.done, strike.done | works |
| 12, 13 | flag, signal | works (signal also from mover end events) |
| 14 | strike.target | id only (vanes and lash are strike-target rows) |
| 15–17 | player.join, player.leave, spawned | id only |
| 30–32 | field, cue, channel (view) | no view lane |

### Reads and lists

All 19 reads answered: x, y, z, yaw, hpShare, alive, field, distance, nearestPlayer (0 outside the encounter arena),
flag, timerLeft, random, actorInZone, playersInZone, moving, strikeState, playerFlag, spawnGroupAlive, bearing. All 5
lists: actorsInZone, playersWithin, groundHeight, nearestWalkable, path. Only declared ids plus handles given this call.

### Commands

| Id | Command | Status |
|---|---|---|
| 1–3 | move, strike, stop | works |
| 4 | field (public actor field) | works (King, Captain) |
| 5, 6 | spawn, despawn | **refused** (`decisions.ts:132`) |
| 7 | flag (world or own player flag) | works |
| 8 | timer | works |
| 9 | signal | works |
| 10, 11 | grant, reward (once per binding and fact) | works |
| 12, 13 | cue, channel | works |
| 14 | impulse | **refused** |
| 15 | encounter (phase, win, fail) | works (Template) |
| 16 | weather | **refused** |
| 100–104 | view.channel, view.clip, view.vfx, view.sound, view.visible | no view lane |
| 105 | view.field: client-only write of a host-private shared field | **proposed** (Z1 design) |
| 17? | state: the same write in the sim lane | **proposed** alternative (Signal classify) |
| – | mover (mover id, action) | **maybe**, only if Sky winch / Signal well go AS |

One bad command refuses the call: in the row's `commands`, declared ids, owned actors, within bounds.

### Engine moves library (built, `src/engine/ai/moves.ts`, rows in `actors/moves`)

orbit, stalk, dive (Roc, Matriarch; stalk also King, Captain); takeoff, perch (Roc); climb, rise, lie (Matriarch);
relocate (Captain, King; new); burrow, surface (Captain rise/sink); ring-run (built, unused; meant for the skitterer).

## 3. State, seeding, lanes, limits

- State: ≤ 16 slots (bool/i32/f64, default, min, max, scope binding/actor/player), ≤ 32 params. Stored by name with
  timers, RNG counter, failures, staged commands. Memory never saved; rewound every call. Restore never calls Wasm (Roc
  test: 0 calls after restore). `stateVersion` + migration rows.
- Seeding: time from sim tick only; `random` mixes the shard identity seed, binding id, instance and a saved per-binding
  counter. No clock, entropy, DOM or host maths.
- Sim lane (built): `ShardDecisions`; bindings `encounter` | `quest` | `zone` | `shard`, each naming actors; retained
  bodies lend body and encounter.
- Client lane: data first (client channels, look rows, cue rows). v1 view lane: ids reserved, not built (G457 (8)). v0
  client scripts still run samples' `idle.as` (pose and particles) on creature/panel/prop/particle targets. Z1 proposes
  `view.field` 105 and a `scene` target kind (format change).
- Limits: 10 Hz; per call 16 events, 32 commands, 4 spawns, 8 timers; 128 commands per decision tick; fuel 400k/call,
  2M/tick (max 2M/8M); 1–4 pages per module, one instance per module; 3 failures → disabled + `onFail` hold/reset/skip;
  build refuses AS over 10 % of frozen legacy (standalone `asLineCeiling`, samples 256).

## 4. Real scripts

- `far-reach/behaviour/roc.as` 53 lines; row `generators/rows/rocDecision.ts`: binding `shard`, `onFail: hold`,
  `on: start, stop, threshold, death, timer, move.done, strike.done`, reads `nearestPlayer`, commands
  `move, strike, stop, timer`; 9 moves, 3 strikes, timer `beat`, params `firstRest 0.5, rest 2.4, lowRest 1.2,
  stoopWindup 1.2`, state `step` i32 0–25. Scenario `test/scripts/far-reach-roc.test.ts`: all three phases, save/restore
  with 0 guest calls, identical continuation, fuel < 400k, under 2 s.
- `sunscar-dunes/behaviour/matriarch.as` 51 lines; row `generators/rows/matriarchDecision.ts`; 8 moves, strikes maw /
  tail / buffet; encounter keeps spawn, rise, storm, reward.
- `driftwood-isle/behaviour/captain.as` 56 and `pine-hollow/behaviour/king.as` 47: ground bosses on retained bodies,
  10 Hz tick, public fields.
- `_template/behaviour/boss.as` 25: the copy-me reference (G456 (3)); uses `Do.encounterPhase`, `Do.encounterWin`.

(The page quotes roc.as, matriarch.as and boss.as in full.)

## 5. AS budgets per shard (ruler rule: non-blank lines after comments)

| Shard | AS / ceiling | Used | v1 | v0 |
|---|---:|---:|---|---|
| Sky Reach | 53 / 677 | 7.8 % | roc 53 | – |
| Signal Dunes | 118 / 412 (131 raw) | 28.6 % | matriarch 51 | skitterer 67 (species) |
| Pine Hollow | 317 / 2,130 | 14.9 % | king 47 | elites 142 + prelude 47, night 46, director 35 |
| Driftwood Isle | 96 / 1,716 | 5.6 % | captain 56 | director 40 |
| Nalati | 162 / 2,837 | 5.7 % | – | qara 83 (elite), director 37, ghostVolley 22, weapons 20 |
| Nine Dragon | 0 / 2,111 | 0 % | – | – |
| Template | 120 / 256 | 47 % | boss 25 | idle 51, door 23, items 21 |

Pine's `lodge.as` and Driftwood's quest AS move (sp-x7) are not in the tree yet. Custom TS today (STATE): Sky 521
(7.7 %), Signal 392 (9.5 %).

## 6. Features first, and what stays AS

Approved features absorb logic as rows (each with a fixture second shard): quest step runner, spawn and population
director + native actor/save interface, boss fight host, contracts and elites, weather reactions + keyed sky, living
buildings, loadout/ammo/skins, collections and display, held arms; W3 mounts/taming, stealth, audio cue director,
practice courses, grapple, post chain.

What stays AS:
- Sky: the Roc phase plan only (winch = interaction row; vanes = strike targets; mill/vanes = channel rows).
- Signal: Matriarch; skitterer state choice after its v1 port; dusk only if it can't be a row.
- Pine: King and four named elite fights, night director choices, lodge story beats (G473 (4)), stag walk and night
  thralls, small quest laws (beaver-pool drain, hollow log, token shelf).
- Driftwood: Captain; adventure, finale and Spine beats the quest runner can't express (G475 (3)).
- Nalati: Storm Titan, balbal crack law, Qara, Naizagai lightning, golden king sun arrow, taming specifics
  (~2,540 TS → ≤ 2,675 AS room; plan step 4).
- Nine: none.

Net platform lines are reported beside shard cuts (G455, G481).

## 7. What's missing, in order

1. **spawn / despawn** owner = spawn director (sp-x8 in flight). Users: Pine night waves (`night.as`), Driftwood keeper,
   Nalati sheep raid.
2. **Quest runner → script by `signal`** instead of `call` closures (host-bar score test 6). Users: Pine trader, lodge,
   stag; Driftwood adventure, finale.
3. **Wire `interact`** from the native picker to `ShardDecisions.interact(id)`. Users: Pine lodge, Driftwood adventure;
   Sky winch / Signal well only if AS.
4. **Spawn-group binding + skitterer on v1** (moves exist). Users: Signal skitterer; later Pine/Nalati packs.
5. **Elites on v1** with the G473 elites host. Users: Pine's four elites, Nalati `qara.as`; delete `elitePrelude.as`.
6. **impulse** with the boss host; **weather** with weather reactions (Pine weather answers).
7. **View lane + `view.field` 105 + `scene` target kind** on first real user: Signal dusk (if not a row), Signal tower
   fire (`view.visible` on `tower.fire`).
8. **Follow-path step** for Pine's stag lead: a quest-step `lead` row or a move kind.
9. Don't build unless needed: `mover`; sim `state` command.
10. MMO later: player.join/leave, spawned, strike.target routing; per-block fuel; hot reload; delete v0.

v0 still in the six game shards: 13 scripts, 539 lines (species, elite, director, weapon hook), plus samples' scene-hook
and client scripts and the SDK mover kernels (G457 (6)).

## 8. iPhone

One call per script per decision tick, only with events. 10-16 Mac sketch: 1.3–4 µs warm call with rewind; expected
< 20 µs/call on a throttled iPhone 17 Pro. ~128 KB per module vs v0's 24 MB reservation. Per-frame Wasm left: skitterer
and the SDK mover kernels.

## 9. Questions for Jake (one recommendation each)

1. **Signal's dusk: row or script?** Recommend a step-table row (flag → dusk target) on the eased-field host; HOST-BAR
   names the dusk-per-step table as single-shot code that becomes a row; Sky's vanes need channel flag inputs anyway; no
   view lane, zero AS. `view.field` 105 is the fallback.
2. **ABI growth rule.** Recommend: an id gets an owner only in the commit where its feature lands (spawn/despawn with the
   spawn director, impulse with the boss host, weather with weather reactions); `interact` wired with its first script;
   no `mover` command.
3. **Skitterer.** Recommend porting to v1 in the W1 tail with ring-run/burrow/surface and a spawn-group binding, ending
   per-tick Wasm steering.
4. **Elite scripts.** Recommend the G473 elites host runs v1 decision rows; Pine's elites and Nalati's Qara leave the
   elite dialect.
5. **Who writes AS.** All five v1 scripts were Codex-written with scenario tests; G455 (3) says Opus; Opus is eyes-only
   (G479). Recommend Codex writes AS, gated by the scenario test and host-bar evidence.

Sources: `progress/shard-platform/wasm-api-design-2026-10-16/README.md`; `docs/HOST-BAR.md`; `docs/SCRIPT-ABI.md` (v0);
`progress/shard-platform/z1-z2-design-2026-10-17/README.md`; `progress/shard-platform/sky-signal-classify-2026-10-17/`;
`progress/shard-platform/mini-plans-2026-10-17/`; `progress/shard-platform/host-bar-scores-2026-10-17/README.md`;
`docs/plans/shard-platform/decisions.md` G454–G482.
