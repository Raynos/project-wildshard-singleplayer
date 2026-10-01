# E357 job F8a — the spine's pure modules, written ahead of F6 (02 F8 steps 2–6, the standalone half only)

Read `docs/plans/game-normalization/brief-common.md` first: its rules bind you.

## The job
F8 wires the spine into `Game.ts` / `main.ts` after the big move (F6). This job writes **only the standalone, unwired
modules and their tests now**, so the wiring later is short. Nothing in today's game imports them yet.
- Read `01-architecture.md` §0–§5 (and §5a for the `LevelSpec` type) and `02-foundations.md` § F8 in full.
- Write, in their final folders:
  - `src/engine/app/systems.ts` + `src/engine/app/app.ts`: `SystemSpec`, `Phase`, `RunCondition`, `inState`,
    `AppState`, the `App` class's system registry (`addSystem(spec, scope)`, the topological sort per phase with ties in
    registration order, cycle → an error naming the ids, `systemsByPhase()` for the probe), `setState` / `onEnter` /
    `onExit` emitting `'app.state'`. Services as typed optional fields only where 01 §5 needs a type now; don't invent
    services.
  - `src/engine/app/scope.ts`: `Scope` of 01 §4 (own / ownBody / ownSound / listen / timeout / interval / raf /
    onDispose / dispose in reverse, idempotent / child / census) and `src/engine/app/assets.ts` (`acquire` / `release`,
    ref-counted, `retained()`). Define small structural types for the physics / sound handles (no Rapier import).
  - `src/engine/events/`: `Events` of 01 §3 (`emit` queued, flushed per phase by an explicit `flush(phase)`; `on` with
    `order`; `ask` / `answer` synchronous chain; 1,000-per-flush bound → a `'fault'` event), `EventMap` / `AskMap` /
    `TagMap` for declaration merging, `hasTag` with `.*`.
  - `src/engine/core/clock.ts`: `GameClock` of 01 §2 with live + capture mode, driven by an explicit `tick(dtSeconds)`.
  - Export the public parts from `src/engine/index.ts` (keep `ENGINE_API`).
- **No Wildshard words** in `src/engine/**` (01 §0: no shard slug, "shard", Bag, coin, loot, compendium, feat,
  doubloon, or shard / creature / weapon names — not even in comments). Use "level" for what the game calls a shard.
- **Not in this job:** the RNG (its file collides with F6's move of `src/core/rng.ts`), any edit to `Game.ts`,
  `main.ts`, `shardScope.ts` or any existing file except `src/engine/index.ts`.
- Tests, all in node: `test/engine/systems.test.ts`, `test/engine/states.test.ts`, `test/engine/events.test.ts`,
  `test/engine/scope.test.ts` (the pure parts of 02 F8's list; the fake-Game parts wait for the wiring),
  `test/engine/clock.test.ts`.
- Done when: the tests pass, `tsc -p .` and oxlint clean on your files.
- Owns: `src/engine/app/**`, `src/engine/events/**`, `src/engine/core/clock.ts`, `src/engine/index.ts`, `test/engine/**`.
