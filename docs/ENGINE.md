# The engine API: `@wildshard/engine`, `@wildshard/game`, `@wildshard/kit`

`@wildshard/game/grid/simulation` owns local physics residencies, prepared fixed-step frame changes and durable
two-phase unloads through the session's one allocator. `@wildshard/engine/sim/strips` generates deterministic
highway, strip and crossroads meshes with local duplicates; where an edge observes a sea at exactly 0 over seabed (the
shore rule, G149) the strip holds 0 to the cell edge and builds a +0.6 m rip-rap revetment there (feature `revetment`,
part of the collider), and a shard clips its sea at `SHORE_REVETMENT_INNER_FACE` from `@wildshard/engine/sim/shore`.
`@wildshard/engine/physics/frame` prepares rider/mount
motor transfers. `@wildshard/game/grid/state` fingerprints authored continuation without global placement or
platform colliders. See [GRID-SIMULATION.md](GRID-SIMULATION.md) for readiness, snapshot and client integration ports.

`@wildshard/game/shardfile/skinLayers` declares independent numeric pose clocks in skin bindings.
Each clock has a period, monotonic sample times and joint-local translation, Euler rotation, scale
or quaternion deltas. Coupled clocks use bounded quaternion phase tables with their own phase period.
Admission proves both wrap endpoints, joint references and table sizes; decoded cost includes tables,
compiled floats and cached base transforms. The skin player restores its sampled base before summing
layers, so breathing, sway and gestures continue across gait loops without accumulating deltas.
The trusted skin baker compacts constant GLB channels and samples the walk at 120 Hz; runtime content
contains numeric data, with no procedural pose callback.

`@wildshard/engine/level/installation` constructs the ordinary level registration context for a supplied scope;
`LevelLoader` and child installations share that implementation and the same kit registration window.
`@wildshard/game/shardfile/runtime` resolves a declared `runtime/*.ts` entry only through a trusted first-party
registry. `prepareHybridShard` admits the shardfile and its trusted entry, chooses the catalogue instance inside
the game layer, and composes their world, kit and play stages. Empty transitional data adds no gameplay services.
`HybridRuntimeSession` prefetches module code without running hooks, activates only the entered cell and removes
its play scope on leave while resident data remains frozen. `bindScopedRuntime` restores each parent slot's original
descriptor on exit; late hooks retain a private overlay and cannot register into a disposed scope. The staged home-cell
adapter consumes the same cell events and reinstalls only trusted hooks on re-entry. Driftwood's first transition
keeps its legacy presentation and gameplay in the declared entry; it does not claim a baked or grid-ready conversion.

`@wildshard/game/shardfile/movers` admits numeric local box decks and bounded rope-chain rest poses.
`MoverRuntime` projects admitted script output in fixed.pre before collision; Rapier bodies and joints stay in
`@wildshard/engine/physics/mover` and `physics/ropeChain`. A session injects its one script host and calls
beginTick once for the entire tick. Parameter opcode 410 reads immutable declared constants selected by the
host's trusted calling entity; `moverQueries` delegates physics opcodes 1–4 to the existing query adapter.
The 32-number input limit, query count/fuel and bounded memory buffers stay unchanged. Full Wasm state and
entity fields belong to that shared host; pending mover interactions have a separate continuation adapter.
`@wildshard/sdk/movers` validates source data. Trusted legacy view recipes only project published poses.

`@wildshard/game/shardfile/director` validates typed shard events and observations. Its bounded
`DirectorLane` admits immutable module bytes, executes decisions in AssemblyScript with the existing
script allowances, and restores full author memory, mutable globals, quota history and queued input.
Shard subscriptions deliver declared payloads on the next fixed tick; grid subscriptions are reserved
data and reject delivery in v1. `installDeclaredDirector` owns fixed-step and scope lifetime while
trusted runtime recipes observe combat and render the published events. `directorVariant` requires
a default-off reload row. `@wildshard/sdk/director` validates author declarations without installing code.

This is the public API a shard is written against. It covers the three public layers and what each one gives a
shard. One section per § of [01-architecture](../project/archive/game-normalization/01-architecture.md), in the same order.

- **How to write a shard** is [SHARDS.md](SHARDS.md). This file is the reference it points into.
- **The worked example** is the template shard, [`src/shards/_template/`](../src/shards/_template/). It uses every
  plugin verb once. Most examples below are copied from it.
- **This file describes HEAD, not the plan.** Where 01-architecture names something that isn't built yet, or built
  under another name, the section says so.
- **It can't drift.** [`test/engine-docs.test.ts`](../test/engine-docs.test.ts) reads `lint/api-surface.json` (every
  export of every public module, built by `scripts/gen-api.mjs`) and fails when an export is missing from the
  [appendix](#appendix-every-export) or the appendix names one that is gone. Builders document public APIs in source
  and in the manual sections here; the serialized pusher regenerates the tables and appendix from clean committed
  input before the gate (SF6b). Do not generate or commit these outputs from the shared working tree.

**No barrels (E434).** There is no index file. The three layers are workspace packages (`pnpm-workspace.yaml`), and
each `package.json`'s `exports` lists the layer's public modules one by one. An import names the module that defines
the binding:

```ts
import { castRay, floorBelow } from '@wildshard/engine/physics/query';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { Bow } from '@wildshard/kit/weapons/bow/family';
```

| Package | Public modules | What it is |
|---|---|---|
| `@wildshard/engine` | `src/engine/package.json` `exports` | The engine: app, scopes, events, saves, input, UI, render, physics, audio, combat, AI |
| `@wildshard/game` | `src/game/package.json` `exports` | The Wildshard game: the manifest and plugin types, Bag, coins, loot, compendium, feats, travel |
| `@wildshard/kit` | `src/kit/package.json` `exports` | Shared content, used by 2+ shards: weapon families, boar and bear, starter effects, NPC rig, hoverboard |

[docs/api/ENGINE.md](api/ENGINE.md), [GAME.md](api/GAME.md) and [KIT.md](api/KIT.md) (generated) list every export
with the module to import it from; where this file says a name is "on `@wildshard/engine`", that list gives its
module. A path the package does not export (`@wildshard/engine/world/Sky`) is `ERR_PACKAGE_PATH_NOT_EXPORTED` in
TypeScript, Vite and node alike; `wildshard/no-reexport` (hard) refuses any `export … from` of our own modules, so a
barrel can't come back. A module that should be public gets a line in its package's `exports`.

Many engine exports are **ports**: legacy classes a shard still needs while the plan runs (`Game`, `World`, `HUD`,
`AnimalManager`, `Animal`, `getActiveChunk`). Each section says which ones are ports. Prefer the context verbs
(`ctx.*`) and the services on `ctx.app` where both exist.

The composition root (`src/*.ts`, outside the layers) and the tests import by relative path
(`../src/engine/world/Sky`); `src/` code across layers never does (`wildshard/public-index`).

## 0. Conventions

| Rule | What it means for you |
|---|---|
| **Layers** | `src/engine/` → `src/game/` → `src/kit/` → `src/shards/<slug>/`. Imports point down the arrow only. A shard never imports another shard |
| **Public modules only** | A shard imports the modules `@wildshard/engine`, `@wildshard/game` and `@wildshard/kit` list in their `exports`, by the module that defines each name (`@wildshard/engine/physics/query`), nothing else. Inside your own folder, use `./` |
| **Composition root** | `src/entry.ts` and `src/main.ts` sit outside the layers. You never edit them for a shard |
| **Node-safe manifest** | `manifest.ts` imports only data and types: node-safe engine modules (`@wildshard/engine/world/terrainField`, `@wildshard/engine/core/config`, `@wildshard/engine/core/noise` …), `@wildshard/game` types and its own data files; `lint/manifest-closure-budget.json` caps the files it pulls. Code arrives through lazy thunks (`load`, `render`, `cues`, `roster`, `preload`). `test/manifests-node-safe.test.ts` imports every manifest in bare node |
| **Extractable engine** | `src/engine/**` holds no Wildshard word: no slug, no "shard", no Bag, coin, loot, compendium or feat. The engine says `level` |
| **Behaviour vs tuning** | Behaviour is a class that extends an engine or kit class. Tuning is a typed data row |
| **Names** | Events, asks, tags, cues, actions and effect ids are dot-case strings: `'damage.dealt'`, `'creature.greyBlob'`, `'cue.sword.hit'`, `'effect.poison'`. Prefix your own with your shard's short name (`template.*`) |
| **Strict** | Strict TS, type-aware oxlint at zero warnings. No `any`, `!`, `as unknown as` or ts-ignore |
| **Simulation apart from visuals** | Gameplay state is plain data. `src/engine/{ai,combat,events,quest,saves}/**` (less their `view` parts) may not import three beyond its math types or read the DOM (`wildshard/sim-no-render`; a test keeps every listed folder real) |
| **Determinism** | Gameplay randomness comes from `app.rng`, time from `app.clock` |
| **Strings** | Every player-facing line comes from a string table: your `strings.ts`, or `engineString` for the engine's |

The template's imports show the rule:

```ts
import { ShardPlugin, installLoot, installCompendium, type ShardContext } from '@wildshard/game';
import { IRON_SWORD, Sword, SWORD_IRON, BOAR, BOAR_LOOK, STARTER_EFFECTS, installStarterEffects } from '@wildshard/kit';
import type { QuestState, Interactable } from '@wildshard/engine';
import { STRINGS } from './strings';
```

Constants every level shares come from `@wildshard/engine/core/config`: `CHUNK_SIZE` (500 m), `CHUNK_HALF`, `CHUNK_DEPTH`,
`TERRAIN_RES`, `ROAD_LENGTH`, `SEED`.

## 1. App, phases, systems, states

There is one `App` per page: `app` (from `@wildshard/engine`). A shard reaches it as `ctx.app`.

| Export | What it does |
|---|---|
| `App` | The services (§5), the state machine and the system list |
| `PHASES`, `Phase` | `'input' · 'fixed.pre' · 'fixed.step' · 'fixed.post' · 'update' · 'late' · 'render'`, in that order every frame. The `fixed.*` phases run at 60 Hz and slow under hit-stop |
| `SystemSpec` | `{ id, phase, run(dt, t), before?, after?, when?, tick?, core? }`. Within a phase, systems sort on `before` / `after`; ties keep registration order. A cycle is a boot error |
| `RunCondition`, `inState` | `when: inState('play')` skips the system outside those states |
| `AppState` | `'boot' · 'title' · 'loading' · 'play' · 'paused' · 'dead' · 'explore' · 'practice' · 'playground' · 'capture' · 'error'` |
| `SystemsByPhase` | `app.systemsByPhase()`: the ids per phase, the harness fingerprint |
| `TickRateId` | The scheduler's rate class for `tick` (§12) |

A shard adds a system with `ctx.system(spec)`. It is removed when the shard's scope disposes. Give every system a
dot-case id; the harness lists them.

```ts
ctx.system({ id: 'template.lantern', phase: 'update', run: (dt) => {
  if (ctx.app.input.consume('template.lantern.toggle')) this.lantern.toggle();
} });
```

A fault in a system is isolated (3 in a row: retry, 5 in 10 s: off). Mark a system `core` only if the game can't run
without it; its fault is fatal.

## 2. Clock and RNG

| Export | What it does |
|---|---|
| `GameClock` | `app.clock`: `now` (game seconds, paused time excluded), `real` (wall seconds), `frame`, `mode` (`'live' \| 'capture'`), `setCapture(fps)`, `snapshot()`, `restore(state)` |
| `RngService`, `Rng`, `RngStream`, `RngStreams` | `app.rng.stream(name)` returns a seeded `Rng`: `next()`, `range(a, b)`, `int(a, b)` (inclusive), `pick(list)`, `chance(p)`, `weighted(pairs)`, `fork(salt)`. Streams: `'gameplay' · 'ai' · 'spawn' · 'cosmetic'`; add one by merging into `RngStreams` |
| `gameplayRandom` | The `gameplay` stream as a plain `() => number`, for code that takes a function |
| `fnv1a32`, `pageSeed` | Stable hashing and the page's seed |
| `worldTime` | `{ scale, realDt }`: presentation time scale for hit-stop; gameplay phases and the simulation clock keep their unscaled delta |

`RngState` and `RngStreamsState` from `core/rng` preserve the continuation and fork seed of each instantiated
stream. `Rng.snapshot()` / `restore(state)` save one generator; `RngService.snapshot()` / `restore(state)` save
the seed and all named streams, retaining existing generator references. `GameClockState` from `core/clock`
also saves pause, capture rate and time scale. Each state carries version `1`; restore validates before changing
state. These continuations support replay in the same engine version.

Use the stream the randomness belongs to. The harness seeds every stream, so a seeded run repeats.

```ts
spawner.spawn({ tags: [] }, { ...BLOB, yaw: 0 }, () => ctx.app.rng.stream('spawn').next());
const random = ctx.app.rng.stream('cosmetic');   // prop scatter: may stay unseeded in live play
```

`Math.random` and `performance.now` are ratcheted (`wildshard/no-raw-random-time`): a new shard file starts at 0.

## 3. Events, asks, tags

`app.events` (class `Events`) carries typed events and asks. A shard uses the scoped verbs `ctx.on` and `ctx.answer`.

| Verb | Rule |
|---|---|
| `emit(name, payload)` | **Queued.** The queue flushes at the end of the phase, in emit order. More than `EVENT_FLUSH_LIMIT` (1,000) in one frame is a fault |
| `on(name, fn, scope, opts?)` / `ctx.on(name, fn, opts?)` | Listeners run by `opts.order` (`ListenerOptions`), then registration order |
| `ask(name, value)` | **Synchronous pipeline.** Each answerer gets the previous answer and returns the next |
| `answer(name, fn, scope, opts?)` / `ctx.answer(name, fn, opts?)` | Adds an answerer, in `order` |

**The events at HEAD** (`EventMap`; payload types in the source):

| Event | When |
|---|---|
| `app.state` | `{ prev, next }` on every state change |
| `player.mode` | `{ prev, next }` movement modes; sampled once per player-health update, only on change |
| `level.loaded`, `level.unloaded` | `{ id }` |
| `damage.dealt` | `DamageDealt { req, dealt, killed }` after the pipeline applies a hit |
| `actor.died` | `{ actor, req }` |
| `player.died`, `player.respawned` | the player's death (`checkpoint`, `cause`) and respawn |
| `effect.applied`, `effect.removed` | an effect on a target |
| `weapon.fired`, `weapon.action`, `weapon.hit`, `weapon.impact`, `weapon.reload`, `weapon.dry`, `weapon.swap`, `weapon.unlocked`, `weapon.charge`, `tool.used` | equipment beats; the cue maps listen to these |
| `quest.step` | `{ level, quest, step, previous }` |
| `boss.attempt` | `{ boss, outcome, level? }`; analytics reads it |
| `ai.windup` | `{ actor, duration }`: a creature telegraphs |
| `creature.signal` | `{ name, x, z }`: a creature call other creatures react to |
| `practice.active`, `explore.studio`, `explore.turntable` | mode flags for practice and Explore |
| `fault` | `FaultEvent`: a system fault |

**The asks at HEAD** (`AskMap`; `AskInput<K>` / `AskOutput<K>` give the two halves):

| Ask | Input → output |
|---|---|
| `damage.modify` | `DamageRequest \| null` → the same. Return `null` to veto the hit. Hit caps, dodge guards, stealth and invulnerability answer here |
| `death.checkpoint` | `{ cause? } \| boolean` → `boolean`: does this death respawn at a checkpoint |
| `player.crouch` | `{ want, via: 'toggle' \| 'hold' }` → `{ allowed, latched }` |
| `player.traversal`, `player.stepSurface` | traversal speed and the footstep surface |
| `projectile.modify` | a shot's `ProjectileModification` (bolt mods, broadheads) |
| `combat.targets.ray`, `combat.aimTargets` | what a ray or the aim assist can hit |
| `ai.claim`, `ai.mayAttack` | the aggression director's tokens (§18) |
| `creature.wander-goal` | where a wandering creature heads |
| `weather.hold`, `weather.damage` | weather overrides and weather damage |
| `feat.toast` (from `@wildshard/game`) | whether a feat toast shows |

**Extend the maps by declaration merging.** Your own events, asks, actions and tier knobs are typed this way. From
the template's `plugin.ts`:

```ts
declare module '@wildshard/engine' {
  interface TierKnobMap { 'template.propCount': number }
  interface ActionMap { 'template.lantern.toggle': true }
  interface EquipmentSlotMap { 'template-whip': true }
}
```

Every extension point merges through `@wildshard/engine` (AG5: deep engine paths do not resolve). A merge through a named
re-export does not depend on the order TypeScript reads files (checked in AG5); a program sees a merge only when it
includes the file that declares it, so declare it in a file the shard's code imports.

Use them through the scoped verbs:

```ts
ctx.on('actor.died', ({ actor }) => { if (actor.tags.includes('creature.greyBlob')) flags.set('template.blob'); });
ctx.answer('damage.modify', (request) => request !== null && invulnerable && request.target === boss ? null : request);
```

**Tags.** `Tag` is `keyof TagMap` (empty today; merge into it). Combat tags (`CombatTag`) are dot-case strings such as
`'actor.player'`, `'creature.greyBlob'`, `'weapon.template-whip'`, `'dmg.melee'`, `'status.poison'`. `hasTag(tags,
pattern)` and `matchesTag(tags, pattern)` match a tag or a `parent.*` pattern.

## 4. Scope and resource ownership

`Scope` owns everything a level creates and frees it in reverse order on `dispose()`. Every `ctx` verb is bound to the
shard's scope (`ctx.scope`), so a verb never takes a scope.

| Method | Owns |
|---|---|
| `own(resource)` | a geometry, material, texture, render target or InstancedMesh (`Disposable3`) |
| `ownBody(handle)` | a Rapier body or collider (`PhysicsHandle`) |
| `ownSound(handle)` | an audio node (`SoundHandle`); `ownAudioSource` wraps a source for you |
| `listen(target, type, fn, opts?)` | a DOM listener (input events go through `app.input` instead, §10) |
| `timeout(ms, fn)`, `interval(ms, fn)`, `raf(fn)`, `cancelTimer(id)` | timers (wall clock, owned) |
| `onDispose(fn)` | anything else |
| `child(name)`, `belongsTo(scope)`, `disposed` | sub-scopes |
| `census` (`ScopeCensus`) | counts per kind, for the leak test |

**The construction owner.** Engine code that builds a reusable service doesn't take a scope argument everywhere;
it asks for the current owner instead.

The browser composition root calls `installBrowserScopeEnvironment()` from `app/view/scopeEnvironment` before
registering presentation work. It supplies frame scheduling and diagnostic DOM target classification; a headless
scope owns callbacks and resources without importing browser globals.

| Export | What it does |
|---|---|
| `withOwner(scope, fn)` | runs `fn` with `scope` as the owner; callbacks registered inside re-enter it |
| `currentOwner()`, `enterOwner(scope)` | read or set the owner (prefer `withOwner`) |
| `onOwnerDispose(fn)` | `fn` runs when the current owner disposes |
| `asShell(fn)` | runs `fn` with no owner: what it builds belongs to the page, not a level |
| `pageScope`, `resourceScope()` | the page's scope, which outlives every level; `resourceScope()` is the current owner or else `pageScope` |

A shard rarely needs these: every `ctx` verb already runs in its scope.

**Owned vs acquired.** `own` only what your level creates. A shared engine or kit asset comes through
`app.assets.acquire(key)` and is released, never disposed (`AssetService`, `AssetCensus`, `AssetRecord`).
`retainCachedResources` marks engine caches that survive a level.

**The leak test.** The gate loads your shard, unloads it and checks the census is back to its title-screen value
(geometries, textures, materials, bodies, listeners, audio nodes, timers). The template's helper is the pattern:

```ts
export function ownPrimitives(root: Object3D, scope: Scope): void {
  root.traverse((node) => {
    if (!(node instanceof Mesh)) return;
    scope.own(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) scope.own(material);
  });
  scope.onDispose(() => { root.removeFromParent(); });
}
```

## 5. Services

`App`'s typed fields are the services. There is no string-keyed locator.

| Field | What it is |
|---|---|
| `clock`, `rng`, `events` | §2, §3 |
| `assets` | `AssetService`: ref-counted shared assets (§4) |
| `scene`, `render` | the three.js scene and the renderer host (`Game`, a port) once the engine stage ran |
| `physics`, `bodies`, `navmesh` | §14 |
| `registry` | `WorldRegistry`: every built piece (§14) |
| `world` | `water` (`WaterBodies`), `dayCycle`, `trample` (§17) |
| `input` | `InputService` (§10) |
| `ui` | the UI layers and HUD (§11) |
| `audio` | the engine `Audio` (§15) |
| `anim` | `AnimService` (§16) |
| `combat`, `aggression` | `CombatPipeline`, `AggressionService` (§18) |
| `effects`, `player`, `equipment`, `equipmentHost` | the level's `EffectService`, `PlayerHealth`, `EquipmentService` and the equipment's render host; `null` outside a level |
| `encounters`, `species` | `EncounterRegistry` and `SpeciesService` (§19) |
| `scheduler` | `TickScheduler` (§12) |
| `saves` | `SaveStore` (§9) |
| `debug` | the probe behind `ctx.debug.expose` (§23) |
| `engineScope`, `levelScope` | the engine's scope and the running level's scope |
| `levelRegistrations` | what the level registered (rows, strings, knobs) |
| `loadLevel(spec, hooks)`, `unloadLevel()` | run and dispose a level (§5a). `@wildshard/game` calls them; a shard never does |
| `setState(s)`, `onEnter`, `onExit`, `addSystem` | §1 |
| `registerDayCycle(clock, scope)`, `registerTrample(field, scope)` | hand a clock or trample field to the engine for this level |

Not built as separate services yet (01 §5 names them): `app.params`, `app.strings`, `app.tiers`, `app.budgets`,
`app.player?.mode` is the immediate movement mode (`PlayerMode`): `'foot' | 'board' | 'swim' | 'ride'`.
Riding takes precedence over board, then swimming; wading and falling on foot stay `'foot'`. Use it in a piece's
`active()` callback to gate a collider. Subscribe to `player.mode` through your scope for change notifications;
the update-phase event reports the final mode for that frame, so intermediate changes within the frame are coalesced.

`app.analytics`, `app.explore`, `app.practice`. Their APIs are the exports in §13, §22 and §23.

`window.__wildshard` is the typed probe built from these services. The engine dispatches `ws:ready` once on reaching
`title` (the native shell waits for it).

## 5a. LevelSpec and LevelContext: all the engine sees of a level

The engine never reads a manifest. `@wildshard/game`'s `toLevelSpec(manifest)` turns it into a `LevelSpec`, then calls
`app.loadLevel(spec, hooks)`. The hooks wrap your plugin's `world`, `kit` and `play`.

| Export | What it is |
|---|---|
| `LevelSpec` | the engine's view of a level: ground, spawn, bounds, sky, atmosphere, grade, look, tiers, budgets, `mechanisms`, fight rules, boot, audio, loadout, species, spawns, minimap, `kitLook` … |
| `BootSpec`, `LoadoutSpec`, `EngineMechanism`, `TierKnobs`, `TierKnobMap`, `TierOverrides` | parts of it (§8, §18, §6, §13.3) |
| `LevelContext` | the verbs below, every one bound to `ctx.scope` |
| `LevelHooks` | `{ world?, kit?, play? }`, each awaited in its stage |
| `LevelAdapters` | how the game shell installs the UI-side verbs (`inputContext`, `hud`, `debugRow`, `playground`) and the Debug memory readout's source (`residentMemory`); a shard never uses it |
| `ResidentMemory` | `{ cap, levels: { id, running, textureMB }[] }`: the levels held in memory, oldest first, for that readout |
| `LevelDriver`, `LevelStage`, `LevelLoadError` | the stage runner and the error a failed stage throws |
| `LevelRegistrations` | the registrations a level made (rows, strings, knobs). `assertKit` makes a row outside `level.kit` throw |
| `levelSequenceDriver`, `LevelSequence`, `LevelBoundary` | the boot's stage sequence |
| `needsTerrainCollider(spec)` | true when `ground.terrain` is set and `ground.structures` is not |
| `resolveTierKnobs(defaults, kit, level, tier)` | the knob precedence (§13.3) |
| `activeLevel`, `selectedLevel`, `onLevelChange`, `configureLevel` | the page's level, for engine-side readers (ports; a shard has `ctx`) |

**The context verbs** (`LevelContext`; `ShardContext` adds the game verbs, §7):

| Verb | Stage | What it does |
|---|---|---|
| `ctx.app`, `ctx.scope`, `ctx.root`, `ctx.progress` | any | the app, your scope, your root `Group`, the loading-bar step (`progress.set(f)`, `progress.detail(text)`) |
| `ctx.system(spec)` | any | a system (§1) |
| `ctx.on(name, fn, opts?)`, `ctx.answer(name, fn, opts?)` | any | events and asks (§3) |
| `ctx.rows.weapon / tool / ammo / species / speciesLook / effect / damageRule / encounter / spawnTable (row \| rows)` | **kit only** | content rows (§18, §19). `ctx.rows.creatureLook(kitLook, factory)` registers a creature material factory |
| `ctx.inputContext(def)` | any | an input context (§10) |
| `ctx.hud.widget / disc / relabel / verb / pin` | any | HUD verbs (§11) |
| `ctx.piece(piece)` | world | a built piece in the world registry: drawn, collides, on the map (§14) |
| `ctx.debugRow(row)` | any | a Debug menu row owned by this level (§23) |
| `ctx.playground(spec)` | any | a playground in Explore (§22) |
| `ctx.strings(table)` | any | your string table (§23) |
| `ctx.tiers.knobs(schema)` | any | your own tier knobs (§13.3) |
| `ctx.debug.expose(name, value)` | any | `window.__wildshard.shard[name]` for captures and tests (§23) |

**Rows register only in `level.kit`.** A row verb called in `world` or `play` throws. When `kit` returns, the engine
builds the loadout from `level.loadout` against the registered rows and preloads its models. `play` can't add weapons.

```ts
override kit(ctx: ShardContext): void {
  ctx.rows.weapon([IRON_SWORD, WHIP_ROW]); ctx.rows.tool(LANTERN_ROW); ctx.rows.effect(STARTER_EFFECTS);
  ctx.rows.species([BOAR, GREY_BLOB]); ctx.rows.speciesLook([BOAR_LOOK, GREY_BLOB_LOOK]);
  ctx.rows.encounter([{ id: 'template.elite', displayName: STRINGS.elite }, { id: 'template.boss', displayName: STRINGS.boss }]);
}
```

Every row verb takes one row or a readonly array. A duplicate id throws. `ContentRow` (`{ id }`) and `ContentRowMap`
are the row types; `EngineRows` is the verb set.

## 6. The shard manifest (`@wildshard/game`)

`ShardManifest` (`src/game/shard/manifest.ts`) is the game's type. `manifest.ts` default-exports one, and
`scripts/gen-shards.mjs` discovers it by folder. There is no `defineShard` helper: the manifest is a typed constant.

**Identity and the title deck**

| Field | Meaning |
|---|---|
| `api: 1` | the plugin API version; a mismatch fails before any asset loads |
| `slug` | the folder name (`ShardSlug` is generated from the folders). `_`-prefixed = hidden namespace |
| `name`, `blurb`, `biome`, `label` | title-deck text; `label` is the HUD grid label like `(+0, +0)` |
| `order` | deck order; Driftwood is 1 |
| `status` | `'live'` (on the deck) · `'experimental'` (taped band) · `'earlyAccess'` (tag) · `'hidden'` (Debug only, the template) |
| `card` | `{ thumb, portrait, landscape }` image URLs, imported from your `thumbs/` |
| `placement` | `{ grid, size }`: where it sits on the Wildshard map |
| `seed`, `treeCount`, `trees`, `forest?` | the master seed and the forest (`trees: { factory: 'none', noun }` for a treeless level) |

**World and look**

| Field | Meaning |
|---|---|
| `style` | an open, opaque string authored by the shard; familiar `pbr`, `toon`, `painterly`, `jiehua`, `greybox` words retain editor completion. Render choices use `render`, `creatures` and `kitLook` |
| `ground` | `{ terrain?, structures?, paths?, water? }`, at least one of terrain / structures. `terrain` comes from `buildTerrain(seed, spec)` (`@wildshard/engine/world/terrainField`). `water` is `WaterBody` rows (§17) |
| `spawn`, `bounds?`, `camera?` | where the player starts; a soft-respawn box; the portrait FOV |
| `world?` | `{ killY, fallCause? }`: optional creature death plane (§19); the engine reports an out-of-world cause below it |
| `sky`, `atmosphere`, `grade`, `look?` | pure-data look fields |
| `style` | `'toon' · 'painterly' · 'pbr' · 'jiehua' · 'greybox'`: data only, never branched on |
| `kitLook?` | `'toon' · 'painterly' · 'pbr'`: the look shared kit pieces render in |
| `hands?` | `'toon' · 'pbr'` (default `'pbr'`): the first-person swimming hands, faceted or smooth. The engine never derives it from `kitLook` (E405) |
| `render?` | `() => Promise<LookStrategy>`: your look (§13.1) |
| `groundColor?`, `surfaceAt?` | per-vertex ground colour and masks for a textureless ground |
| `minimap?`, `pois?`, `hud?` | maps, named places, HUD bands to switch on |
| `horizon?`, `horizonStrips?`, `boundary?` | authored distant scenery and visual edge dressing (below) |
| `tiers?`, `budgets` | §13.3, §13.4 |

**Distant scenery and the drawn boundary**

Omitting `horizon` keeps the engine default: three ridge rings and a cloud sea on dry worlds,
sea stacks without the cloud sea on open-water worlds, or `horizonStrips` imagery when present on a dry world. On an open-water world, `horizonStrips` is the painted band above the sea (`HorizonMatte`).
An authored `horizon` replaces that default (including the dry-world strips):
`horizon: { rings: [], cloudSea: false }` draws neither rings nor a cloud sea. `cloudSea: true` adds the
engine's animated cloud floor below the slab. Supply any number of rings, ordered near → far, to reshape the skyline.
They are visual scenery, move with the camera on XZ, and create no colliders.

| Horizon field | Meaning |
|---|---|
| `rings[].r` | ridge radius in metres |
| `rings[].base` | base height in metres relative to world y = 0 |
| `rings[].color`, `rings[].top` | linear RGB tuples; body → crest colour ramp |
| `rings[].snowLine` | fraction of the tallest peak above `base` where snow starts; 0…1, > 1 disables snow |
| `rings[].haze` | aerial-perspective mix, 0…1 |
| `rings[].floor` | hidden foot reference height in metres; geometry extends 600 m below it |
| `rings[].bands` | compass-shaped peaks; empty draws a flat ring at `base` |
| `bands[].azimuth` | compass bearing in degrees: 0 = north (+Z), 90 = east (−X) |
| `bands[].spread` | positive half-width in degrees, with cosine falloff either side of the bearing |
| `bands[].height` | peak height in metres above `base` |
| `bands[].rough` | 0 = rolling hills; 1 = jagged ridges |
| `horizonStrips` | `{ day, night, elMin, elMax, scale?, phone?: { day, night } }`: painted panorama URLs, elevation limits in degrees, optional vertical scale and phone URLs |

`boundary: { visible: false }` omits the engine's drawn edge lines, beacons, ribbons and road gates.
Omitting `boundary` (or `visible`) keeps them visible. `Boundary` is visual-only: the physics terrain's
player-containment edge walls are registered independently and remain active when the drawing is hidden.
This does not change `bounds` / soft respawn or the creature death plane `world.killY`.

**Content and play**

| Field | Meaning |
|---|---|
| `uses` | the opt-in mechanisms. Engine: `'weather' · 'dayCycle' · 'bosses' · 'elites' · 'spawns' · 'quests' · 'swim' · 'hover' · 'explore' · 'practice'`. Game: `'coins' · 'loot' · 'compendium' · 'feats' · 'bag.pack'`. A mechanism you don't list isn't built. The retired compatibility tags `pack`, `water`, `creatures` are rejected (E357 L11 / B81) |
| `loadout` | `{ weapons, tools, start, held?, pickups?, loans?, grants?, viewmodel?, ammo? }` by row id (§18) |
| `weapon` | `'crossbow' · 'sword' · 'custom'`: a legacy field the shell still reads. New shards say `'custom'` and build their own equipment |
| `species`, `encounters?`, `spawns`, `faunaTuning?`, `creatures?` | creature ids, encounter ids, herd plans, per-species tuning, creature render flags |
| `fight?` | `{ input: { bufferMs, coyoteMs }, telegraphed?, maxHitDamage?, capExempt?, attackers? }` |
| `bag?`, `loot?`, `bodyShadow?` | Bag tabs and pack, coins on kills, the body shadow |
| `audio` | `{ bed?, ambience, score, cues?, preload?, samples?, alertOnlyHostile? }` (§15) |
| `boot` | §8 |
| `explore?`, `roster?` | Explore art and the Model Explorer roster (§22) |
| `debugOptions?` | which engine Debug rows apply to this level (§23) |
| `assets?`, `assetGlobs?`, `ktx2?` | PBR ground sets; the asset folders the lock lets your lane commit; the KTX2 table thunk (a level with none boots without it) |
| `dev?`, `next?`, `blender?` | capture poses, the deck's next-shard hint, the Blender area |
| `load` | `() => import('./plugin')`: the lazy plugin chunk |

**Structures-only ground:** `ground: { structures: true }` needs no `terrain`. The engine draws no terrain mesh
and creates no terrain collider. Analytic placement readers (`heightAt`, `terrainFor`) return the fixed floor
**y = −1,000 m** everywhere; this floor is not walkable geometry. `terrainFieldFor(ground, id)` (`@wildshard/engine/world/groundField`)
returns the authored field when present, otherwise this fallback for structures; missing both is an error.

**A world shifted vertically at runtime:** a level whose field moves every height by a constant (a Debug variant that
lowers the whole world, Driftwood's G164) applies the shift in its own `heightAt` / `waterLevel` and declares it as the
field's `datum?: number` (read once; a getter may compute it). The offline bake (`public/assets/baked/<slug>/terrain.bin`) holds the unshifted heights,
so `_installBakedTerrain` installs it shifted by `datum`; absent or 0, the bake installs exactly as baked.
The fallback has no trails, cabins, pond or stream, an upward normal and a dry water sentinel at **y = −1,001 m**.
Set `spawn.y` to an authored structure's floor, register its colliders with `ctx.piece`, and set `bounds.floor` /
`world.killY` above the analytic floor when falls should respawn / kill. Supplying both terrain and structures
keeps the authored analytic field; structure-first rendering/collision policy stays in effect.

The template's manifest is the shortest complete one:

```ts
export const TEMPLATE: ShardManifest = {
  budgets: BUDGETS, api: 1, slug: '_template', order: 1000, status: 'hidden', name: STRINGS.name, label: '(+0, +0)', seed: 357,
  style: 'greybox', kitLook: 'toon', weapon: 'custom', treeCount: 0, trees: { factory: 'none', noun: 'trees' },
  ground: { paths: 'plugin', water: [POOL], terrain: buildTerrain(357, { landscape: (x, z, { n }) => n.get(x * 0.015, z * 0.015) * 0.5, trails: TRAIL, cabinSites: [] }) },
  render: async () => (await import('./look/render')).templateLook(),
  uses: ['weather', 'dayCycle', 'bosses', 'elites', 'spawns', 'quests', 'swim', 'hover', 'explore', 'practice', 'coins', 'loot', 'compendium', 'feats', 'bag.pack'],
  loadout: { weapons: ['weapon.sword-iron', 'weapon.template-whip'], tools: ['tool.template-lantern', 'tool.hoverboard'], start: [/* … */], held: 'weapon.template-whip' },
  load: () => import('./plugin'),
  // … the rest is in src/shards/_template/manifest.ts
};
export default TEMPLATE;
```

`@wildshard/game` also exports `ShardSword` (a legacy `sword` field's viewmodel), `ChunkTerrain` (the built terrain functions),
and `RGB` / `Vec2` (`@wildshard/engine/level/data` has `Vec2`, `TerrainNoise` too).

### 6.1 Authored diagnostic cameras

`manifest.dev.poses()` returns a map of named `{ eye: [x,y,z], feet?: [x,y,z], yaw, pitch, mockup, frame }` cameras.
`eye` is the world-space camera; `feet` is an optional standing player position. Camera yaw and pitch are **degrees**:
0 yaw faces −Z, +90 faces +X; positive pitch looks up. Eye-only cameras are free views (budget captures), while
standing cameras are parity poses. The game exposes them as `LevelSpec.capturePoses`; parity reads that declaration,
so a new shard needs no camera table entry in scripts. Without standing poses it samples the spawn as `current`.
If the budget declares a `current` ceiling, parity also measures its frozen render counts.

An optional `probe: { name?, x?, y?, z?, yaw?, pitch? }` overrides player placement for an exact existing harness pose.
These yaw/pitch values are **engine radians**; omitted `y` preserves ground-following spawn / collider landing.
It is useful when migrating an existing baseline without floating-point degree round-trips. Free camera `eye` still
uses the normal degree fields, and parity keeps `probe.name` when present.

Capture controls (`__wildshard.pose`, walk/combat/arena) require `window.__wildshardHarness` installed **before**
the game loads; setting it after `ws:ready` cannot unlock a probe created without it. Use parity’s
`installInit(context, pins)` from `scripts/parity/init.mjs` for deterministic captures (it also installs frame control,
resource counters and seeded saves). Ad-hoc board scripts may use `context.addInitScript` to install
`{ seed: 0x2545f491, capture: null, lane: 'board', sha, browser, errors: [], saves: { read: [], written: [] } }`
before navigation; wait for `ws:ready` / `__wildshard` and the loading overlay to clear before posing. `capture: null`
keeps normal RAF timing for boards. Pose APIs use engine radians; convert a camera’s degree yaw with
`-camera.yaw * Math.PI / 180` and pitch with `camera.pitch * Math.PI / 180`.

`LevelSpec.navmesh.excludeGroundAt(x, z, y)` is optional offline creature-navigation policy, copied from `ShardManifest.navmesh`. The node baker runs the manifest world hook and collects static registry colliders; the predicate excludes ground triangles only, so registered bridges remain walkable. Omit it to use the default water exclusion.

## 7. The shard plugin and the registry

```ts
export class TemplatePlugin extends ShardPlugin {
  override world(ctx: ShardContext): void { /* level.world: terrain dressing, pieces, playgrounds */ }
  override kit(ctx: ShardContext): void { /* level.kit: weapon / tool / species / effect / encounter rows */ }
  override play(ctx: ShardContext): void { /* level.play: systems, events, input, HUD, quests, encounters */ }
}
export default TemplatePlugin;
```

| Export (`@wildshard/game`) | What it is |
|---|---|
| `ShardPlugin` | the base class; each hook may be async |
| `ShardContext` | `LevelContext` + `manifest`, `game`, `bag`, and `rows` = `EngineRows & GameRows` |
| `GameRows`, `GameRowMap` | `ctx.rows.item / lootTable / skin / feat / shop / compendium / places` (kit stage) |
| `BagVerbs` | `ctx.bag.tab(spec)`, `ctx.bag.fragment(tab, fragment)` (§11) |
| `GameServices` | `ctx.game`: `shard` (the manifest), `rows`, `bag`, and `runtime` |
| `ShardRuntime` | `ctx.game.runtime`: the game shell's handoff, below |
| `shardContext(ctx, manifest, game)` | builds a `ShardContext`; the game shell calls it |
| `toLevelSpec(manifest)` | the pure manifest → `LevelSpec` mapping; a node test runs it on every shard |
| `game`, `findShard`, `findChunk` | the running game state and registry lookups |
| `getActiveChunk` | a **port**: the running manifest for legacy readers. `wildshard/no-active-chunk` keeps it out of new code |
| `ShardWorld` | `runtime.world`: the built world (game, player, sky, terrain) after `level.world` |

**`ctx.game.runtime` (`ShardRuntime`).** The engine verbs don't cover everything a shard needs yet. The game shell hands
over the rest here. It is typed, per build, and may be `undefined` in the headless contract test, so read it with `?.`.

| Field | What it holds |
|---|---|
| `world` | the built world (`ShardWorld`); `world.game.scene`, `world.game.camera`, `world.player` |
| `play` | after the shell built the kit and UI (`ShardPlayHost`): `animals`, `weapons`, `hud`, `menu`, `audio`, `music`, `cues`, `owned`, `progress`, `inventory`, `touchUi()`, `nolock` |
| `buildEquipment` | **set it in `kit`** to build your weapons (B79). The template's whip and lantern go in here |
| `hooks` | `ShardPlayHooks`: callbacks the shell calls (`questFlags`, `places`, `checkpoint`, `stepSurface`, `harvest` …) |
| `interactables` | push an `Interactable` (a door, a chest) here |
| `objects`, `overhead`, `viewer`, `horizonVeil`, `step` | shell bookkeeping |

```ts
const rt = ctx.game.runtime;
if (rt) rt.buildEquipment = (targets, nolock, viewmodel) => {
  const iron = new Sword(rt.world, targets, { row: IRON_SWORD, profile: SWORD_IRON, allowUnlocked: nolock, ...viewmodel });
  this.whip = new TemplateWhip(ctx.app, targets, actorFor);
  return Promise.resolve({ primary: this.whip, secondary: iron, rifle: null,
    install: (equipment) => { equipment.unlock('sword-iron'); equipment.add(this.lantern, { locked: false }); } });
};
```

**Discovery.** `scripts/gen-shards.mjs` reads `src/shards/*/manifest.ts` and writes `src/game/shard/shards.generated.ts`
(git-ignored; `pnpm gen` writes it before test, typecheck and lint). There is no hand-kept list.

**Load order.** The engine boots → `manifest.load()` fetches the plugin chunk → `level.data` → `plugin.world` →
`plugin.kit` and the loadout → `plugin.play` → `finish` → `app.setState('play')`.

**A load failure** (any throw in `load` or a hook) disposes your scope, reports to Sentry and shows the full-screen error
with the stack and a Reload button. **Unload** is `scope.dispose()`; switching shards is a page reload.

## 8. Boot (staged load)

### Pre-entry safe

`@wildshard/engine/boot/retry` is the import-free retry module: it exports only `retried`. Use it before the renderer and App can load; the chunk gate rejects App or Three in the pre-entry static graph. Every other loader imports the same module.

`retried(load)` retries a rejected async module download after 800 ms and 2500 ms, then preserves the final
rejection. The entry (including composition-root imports), shard plugin loader and level look loader share this policy. It is the import-free module
`@wildshard/engine/boot/retry`, for the pre-engine entry and for game and shard loaders alike.

| Stage | The engine does | You fill |
|---|---|---|
| `engine` | renderer, physics, sky rig, audio unlock, input, UI shell, saves | — |
| `level.data` | reads the `LevelSpec`; registers water bodies; fetches `boot.files(tier)` | `boot.steps` labels and weights |
| `level.world` | terrain (if `ground.terrain`), registry wiring | `plugin.world` |
| `level.kit` | equipment service, the loadout from rows | `plugin.kit` |
| `level.play` | creatures, encounters, audio beds, HUD | `plugin.play` |
| `finish` | the composer (your `LookStrategy`), shader precompile, first frame, the probe | — |

`BootSpec` fields (`manifest.boot`):

| Field | Meaning |
|---|---|
| `files(tier)` | the pack files the loading bar downloads. Required |
| `sources?(tier, tex)` | the same, split by kind (`ChunkFiles`: sky, baked, terrain, trees, physics, cabins, props, art, music, sfx) |
| `audio?()`, `precache?`, `explore?` | audio files, service-worker precache, Explore art |
| `steps?` | `{ key: { label, weight } }` for the loading screen |
| `viewmodelSets?`, `shaders?` | viewmodel texture sets to preload; which shader groups to precompile |
| `stagedWorld?`, `lateReads?`, `bakedUnread?`, `bytes?` | pack bookkeeping for big shards |
| `barrier?`, `phone?: { deferExtras?, fragile?, trace? }`, `cullBeforeFirstDraw?` | fragile-boot flags (Nine Dragon) |

Card, Explore and `boot.precache` artwork may use imported image URLs or paths in the shard's `public/assets/`
folders. Boot counts imported art from `ART_URL_BYTES` and public art from `PUBLIC_BYTES`, normalizes and deduplicates
file paths, and includes both in the loading bar and background prefetch. Inline `data:` images are bundled and add
no download (E357 Z3 public-art gap).

A shard with no assets declares empty lists. The template:

```ts
export const bootSources = () => ({ sky: [], baked: [], terrain: [], trees: [], physics: [], cabins: [], props: [], art: [], music: [], sfx: [] });
export const bootFiles = (): readonly string[] => Object.values(bootSources('phone', 'img')).flat();
// manifest: boot: { files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: () => Promise.resolve([]), precache: [] }
```

Boot helpers on `@wildshard/engine`: `StepProgress`, `StepRunner`, `macrotask`, `slicer` (yield inside a long build),
`preloadBakedTextures`, `loadBakedSky`, `loadLUT`, `fetchLut`, `LUT_SIZE`,
`PUBLIC_BYTES`, `markUnload`, `setTitleArrival` / `TitleArrival`, `Ktx2Table`, `LoadFailure`. For node-side tools and a
manifest's creature and loot tables, the node-safe modules are `boot/filePolicy` (`filePolicy`), `boot/bytes`
(`ChunkFiles`), `core/tier` (`Tier`), `boot/gpuFiles` (`TexMode`), `core/config` (`CHUNK_SIZE`, `CELL_HEIGHT` /
`CELL_BELOW` / `CELL_ABOVE`: the 500 m cell, 250 m each side of the highway level, SHARD-PLATFORM SP4; `TERRAIN_RES`,
`ROAD_LENGTH`, `ROAD_WIDTH`, `SEED`), `core/noise` (`Noise2D`), `core/rng` (`Rng`), `ai/species` (`deriveSpecies`) and
`ai/weighted` (`WeightedTable`); `lint/manifest-closure-budget.json` keeps a manifest on them.

## 9. Saves

All persistent state goes through `SaveStore` (`app.saves`, also exported as `saves`). Raw `localStorage` /
`sessionStorage` is a lint error (`wildshard/no-raw-save`).

```ts
interface SaveKeyDef<T> { key: string; scope: SaveScope; version: number; schema: v.GenericSchema<T>; initial: () => T; migrate?: … }
interface SaveSlot<T> { peek(ns?): T | null; read(ns?): T; write(value: T, ns?): boolean; reset(ns?): void }
```

| Scope (`SaveScope`) | Stored in | Use |
|---|---|---|
| `'shard'` | `wildshard.save.v2.<slug>` | everything that belongs to one shard: coins, progress, compendium, gear, bosses. Pass your slug as the namespace |
| `'global'` | `wildshard.save.v2.global` | settings, controls, the Wildshard summary |
| `'profile'` | `wildshard.save.v2.profile` | **reserved, no key yet**: the player above every shard (identity, inventory, gear, titles) that will travel between shards (MMO-REQUIREMENTS M6, SHARD-PLATFORM SP2). Exported and imported like `'global'`; no shard namespace may be named after a scope |
| `'device'` | machine-local | bookkeeping that is never exported or reset (Debug row values) |
| `'session'` | sessionStorage | per tab |

**The rules**
- Keys are dot-case. Prefix your own: `template.notes`.
- A `'shard'` key needs a namespace that is a slug; a hidden level uses a leading `_` (B80).
- Change the shape → bump `version` and add a `migrate` step. A save that fails its schema is moved aside to
  `<key>.corrupt.<time>`, reset to `initial()` and reported; the game never throws.
- The composition root calls `installBrowserSaveEnvironment()` (`@wildshard/engine/saves/view/storage`) before save readers run. The store imports no browser APIs; a headless host uses its memory default or explicit `SaveStorage` ports.
- `SaveStore.persist()` / `persistHomeScreen()` ask the browser to keep the data. `exportAll`, `importAll`
  (`ImportReport`) and `CorruptSave` back Settings ▸ Save.

The template's one shard key:

```ts
const NOTES = { key: 'template.notes', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
const notes = ctx.app.saves.define(NOTES);
if (!notes.read(ctx.manifest.slug)) notes.write(true, ctx.manifest.slug);
```

`@wildshard/game` defines the shared game keys: `progressSave`, `inventorySave`, `purseSave`, `ownedSave`, `bountySave`,
`compendiumSave`, `bossesSave`, `elitesSave`. Bind one to your shard with `shardSave(slot, slug)`:
`shardSave(purseSave, ctx.manifest.slug).write(n)`. `saveSlug(id)` strips a legacy `chunk://local/` id.
`jsonSlot(key, scope)`, `jsonSchema`, `jsonRecord` and `saveStorage(scope)` cover untyped JSON and the pre-boot keys.

## 10. Input

`app.input` (`InputService`) owns every input listener. A shard never adds a DOM input listener
(`wildshard/no-raw-input`, and `wildshard/shard-sandbox` for window / document listeners). A page-wide one (a drag
that leaves its widget, "a touch anywhere" that skips or dismisses, a key a panel takes first) goes through
`listenPage(scope, type, fn, { capture?, on?: 'window' | 'document' })` from `input/dom`, the one place such
listeners attach (E362 AG18); `no-raw-input` also refuses the helper form (`scope.listen(window, 'keydown')`).

| Export | What it is |
|---|---|
| `Action` | the action union: the engine's (`move`, `look`, `dodge`, `jump`, `use`, `crouch`, `sprint`, `pause`, `map`, …), `EquipmentAction` (`attack`, `heavy`, `aim`, `reload`, `lock`, `swap.*` …) and everything merged into `ActionMap` (`bag` from `@wildshard/game`, your own) |
| `ActionMap` | merge your actions into it (§3) |
| `InputContextDef` | `{ id, actions, blocks?, keys?, keysFrom?, touch?, priority?, enabled? }` |
| `TouchVerb`, `TouchVerbSpec` | a touch verb button: `{ action, label, icon, hold?, show? }` |
| `EquipmentInput` | what equipment reads from input |
| `installGameplayInput`, `weaponInputContext`, `weaponActionGate` | the shell's gameplay contexts (ports) |
| `listenDom` | a scoped DOM listener for engine-side UI code; shards don't need it |

| `InputService` method | What it does |
|---|---|
| `push(id, scope)`, `pop(id)`, `top`, `contexts`, `active(id)`, `has(id)` | the context stack |
| `pressed / held / released (action)`, `consume(action)`, `axis2(action)` | read an action; `consume` takes a buffered press (`buffer.ms`, 120); `axis2` reads `move` / `look` |
| `bind(action, run, scope, enabled?)`, `bindRelease(action, run, scope)` | callbacks |
| `observeLook`, `observeWheel`, `firstGesture`, `onReset` | look deltas, wheel, the first user gesture, a reset |
| `bindings` | keyboard / mouse / touch bindings; rebinding persists as a global save |
| `recordCommand`, `executeCommand(command)` | record and replay `ActionCommand` through the same callbacks and action buffers used by device input and UI gestures |
| `snapshot()`, `restore(state)` | save and restore versioned `InputState`: held controls, buffered presses, axes and context order; the fresh host registers contexts and callbacks first |

`ActionCommand` from `input/InputService` covers presses, queues, releases, held controls, axes, physical
keyboard/mouse transitions, look and clear, with a simulation timestamp in milliseconds and optional canonical
`AimCommand`. Interact, mount and UI actions use this boundary. The weapon strip records `swap.ui` and `swap.weapon.<id>` through the same bindings; its selection remains available during a swap. Recording saves each outer command once;
actions derived by its callback run again during replay. `captureAim` supplies the live player's eye and heading;
`commandAim` carries that recorded aim while callbacks execute. `PlayerCommand` and `FightCommand` from
`input/commands` carry motor/look and weapon actions; camera and viewmodel offsets do not select contacts.

**Contexts are additive.** An action resolves top-down through the stack; a context blocks only what its `blocks`
names. Touch draws the merged discs of the whole stack, and a higher context's relabel wins per disc. A Tool's context
sits on top of the weapon's and the weapon keeps firing.

**Register, then push.** `ctx.inputContext(def)` registers a context. Registration doesn't push it: push it yourself
with `ctx.app.input.push(id, ctx.scope)`. A weapon names its context in its row (`ui.inputContext`), and the
equipment service pushes it on draw.

`keysFrom: 'weapon.melee'` inherits keyboard/mouse bindings for only the actions declared in your context.
The source must already be registered; it does not need to be pushed. Only keys are inherited (no actions,
blocks, touch layout or enabled predicate). The player's saved rebinds of Attack/Heavy stay live on custom
melee weapons; the Key bindings table keeps one row and one saved source for each inherited action.
Explicit `keys` override the inherited binding per action, and `[]` unbinds it. Legacy saved copies of keys that
are now inherited cannot shadow the source. This is generic: any registered context may be a key source.

**Touch labels and spots.** `touch.relabel.r0` labels the existing ATTACK / FIRE disc (including a melee
weapon's SWING label); `lock` and `jump` label their named controls. Labels and optional icons restore to the
lower context on pop and to the built-in defaults when none remain. `tone` / `accent` dress LOCK / JUMP;
the attack disc keeps its existing charge/ready appearance. A context already active when the touch layer mounts
paints immediately.

For added discs, `ctx.hud.disc({ spot, … })` uses placement anchors instead:

| `DiscSpot` | Added-disc placement |
|---|---|
| `r0`, `jump` | lower-right JUMP position (the added-disc anchor differs from the attack relabel key above) |
| `r1` | DODGE / SURFACE position, one step left |
| `r2`, `lock` | LOCK position, two steps left |
| `r3` | fourth lower-row position |
| `aim` | AIM position |
| `up0` | above JUMP |
| `lean-l`, `lean-r` | left / right edges just above the bottom bar |
| `edge-l`, `edge-r` | left / right edge tabs |

```ts
ctx.inputContext({ id: 'template.whip', actions: ['attack', 'heavy', 'lock'], keysFrom: 'weapon.melee', touch: { mode: 'melee', lockable: true, relabel: {} } });
ctx.inputContext({ id: 'template.lantern', priority: 20, enabled: () => ctx.app.state === 'play',
  actions: ['template.lantern.toggle'], keys: { 'template.lantern.toggle': ['KeyL'] },
  touch: { relabel: {}, verbs: { 'verb.1': { action: 'template.lantern.toggle', label: STRINGS.toggle, icon: '' } } } });
ctx.app.input.push('template.lantern', ctx.scope);
```

**`touch.relabel` values** (`TouchRelabel`): `{ label: string, icon?: string, tone?: 'rest' | 'ready' | 'active', accent?: string }`.
`label` is required; `icon` is inline SVG markup, `accent` is a CSS colour, and omitted `tone` defaults to `'rest'`.
`r0` is the ATTACK/FIRE disc; `lock` and `jump` relabel LOCK and JUMP. The attack disc retains its weapon styling;
its relabel changes its text/icon. LOCK and JUMP use the hint tone/accent styling. A baseline attack label with no
icon/accent and resting tone restores its ordinary markup and classes.

```ts
ctx.inputContext({ id: 'template.swing', actions: ['attack'],
  touch: { mode: 'melee', relabel: { r0: { label: 'SWING' },
    lock: { label: 'PARRY', tone: 'ready', accent: '#ffd28a' } } } });
```

**Buffer and coyote time** are per-shard data: `manifest.fight.input = { bufferMs: 120, coyoteMs: 100 }`.
**Crouch** requires a shard answer to `player.crouch` (§3); without one the motor stays standing.
Nalati owns its C / Ctrl bindings and grass/taming eligibility. The shared on-foot context has no crouch binding.
Bows use manual hold/release draw on both devices; the automatic-shot action has been removed.

## 11. UI: layers, HUD slots, Bag tabs, error screen

| Export | What it is |
|---|---|
| `UiLayers`, `UiLayer`, `UiView`, `UiHandle` | `app.ui`: layers `'hud' · 'gameMenu' · 'menu' · 'modal' · 'error'`. Pushing a view gives it the one Escape / back handler and the pointer lock; z-order comes from the layer. `UiView.embedded` registers nested map/Debug placement and lifetime without blocking, receiving back, or inerting its ancestor menu |
| `uiScope`, `mountUi` | a UI scope and mount helper for engine-side views |
| `isDev`, `setDev`, `onDev` | the saved Developer switch, its current state and live subscription (unsubscribe returned). The game reveals hidden title cards through this switch. |
| `hudSlots`, `HudBand`, `DiscSpot`, `TouchRelabel` | the one shared HUD. Bands `'band.1'` … `'band.6'`; disc spots `'r0' · 'r1' · 'r2' · 'r3' · 'aim' · 'up0' · 'lean-l' · 'lean-r' · 'edge-r' · 'edge-l' · 'lock' · 'jump'` |
| `HudVerbs`, `VerbSlotOpts` | the scoped verbs on `ctx.hud` |
| `TabRegistry`, `TabId`, `TabSpec`, `TabFragment` | the Bag / menu tab registry the game builds on; game-owned GEAR / FINDS / PACK / FEATS renderers register TabSpecs and ordered fragments. Menu options carry Settings capabilities rather than Bag kit / skins / tools / pack data |
| `registerPickupLook`, `PickupLook`, `PickupPart`, `pickupModel`, `interactParts`, `LowPolyKit` | a pickup row's look is registered content (its batched model and the parts drawn up close); `LowPolyKit` builds their flat-shaded geometry (E405) |
| `registerInteractProps`, `InteractProps`, `ChestLook`, `DoorLook`, `ChestDims` | the props the interaction runtime draws (chest, key, door, lever, plate, barrel, brazier, bench, altar: each part's geometry, and the catalog model it places a kind's rows as) are registered content; the engine keeps the kinds, poses, colliders and prompts (E405 E417; the kit's: `installKitProps`) |
| `IconId`, `IconMap`, `icon`, `registerIcons`, `iconParts` | the icon registry: the engine's UI glyphs (lock, check, map pins, the Bag's tabs); a content library merges its ids into `IconMap` through `declare module '@wildshard/engine'` and registers SVGs drawn with `iconParts` (the kit's `installKitIcons`; E405) |
| `BossBar`, `EliteBar` | the shared encounter bars (decision 91: one boss bar look) |
| `ItemCardSpec`, `ItemCardState`, `itemCardTile`, `ItemCardPop` | the big item card (SF28, Jake's G87): an item as plain data (name, icon id, detail, price, state) drawn by the platform as a shop grid tile or the pickup / reward card under the top bar, in the accent hex it is handed (`--ws-accent`; the HUD cyan when none). Text lands as `textContent`. `HUD.pickupCard(spec, fallback)` shows it for platform pickups when pause ▸ Settings ▸ Debug ▸ Look ▸ Item cards is Big, else the toast `fallback`; the game sets `HUD.cardAccent` from the shard's declared accent |
| `HUD`, `GameMenu`, `GameMenuOptions`, `FullMap`, `FullMapPoi`, `MapQuest`, `MapMark`, `MapPoi`, `MapOverlay`, `MinimapPalette`, `FirstHints`, `Feedback`, `KitEntry` | **ports**: the legacy HUD, menu and map types `runtime.play` hands over |

**HUD verbs** (`ctx.hud`, all scoped):

| Verb | What it does |
|---|---|
| `widget(band, el, order)` | mounts an element in a numbered band. Switch the band on in `manifest.hud.bands` |
| `disc(opts)` | adds a touch disc |
| `relabel(spot, label, icon, appearance?)` | relabels a disc while your scope lives |
| `verb('verb.1' \| 'verb.2', opts)` | fills a reserved verb slot |
| `pin(at, el)` | a screen-projected world marker; `at` is a `Vector3` or a function |

```ts
const meter = document.createElement('meter'); meter.min = 0; meter.max = 1;
ctx.hud.widget('band.3', meter, 0); ctx.hud.relabel('jump', STRINGS.toggle, '');
const pin = document.createElement('span'); pin.textContent = STRINGS.hut; ctx.hud.pin(this.doorAt, pin);
```

Appending to `#hud` or `document.body` yourself is a lint error (`wildshard/no-raw-hud`). A new shard uses the
baseline HUD and maps its verbs onto existing controls. **Any HUD change is an E332 HUD change**: it needs Jake's pick
and a herdr notice (AGENTS.md).

**Bag tabs** (`@wildshard/game`, `ctx.bag`): `tab({ id, title, icon?, order?, hint? })` adds a tab and
`fragment(tab, { id, order?, render(host) })` adds content to it. List the tab in `manifest.bag.tabs`. The finds are
`ctx.bag.fragment('finds', …)`.

```ts
ctx.bag.tab({ id: 'notes', title: STRINGS.notes, icon: 'book', order: 50 });
ctx.bag.fragment('notes', { id: 'template.notes', render: (host) => { const p = document.createElement('p'); p.textContent = STRINGS.note; host.append(p); } });
```

**The error screen** belongs to the engine: a failed load shows it (§7). A shard never builds its own.

## 12. Scheduler (tick rates)

`app.scheduler` (`TickScheduler`) decides when a brain thinks and a body moves.

| Export | What it is |
|---|---|
| `TickScheduler` | `rate(id, rate)`, `brainDue(id, actor)`, `bodyDue(id, actor)`, `interrupt(actor, why)`, `pin(actor, scope)` |
| `TickRate`, `TickBand` | `{ bands: [{ upTo, brainHz, body }] }`: `upTo` metres, `brainHz` a number or `'paused'`, `body` `'frame' · 'half' · 'paused'` |
| `TickActor`, `InterruptReason` | `'hit' · 'target.attack' · 'target.dodge' · 'lost.sight' · 'ally.died'` or your own |

The default bands: near (0–60 m) brain 20 Hz, body every frame; mid (60–160 m) brain 10 Hz, body every 2nd frame; far
paused. Interrupts re-think the same frame. `pin` keeps an active boss, elite or quest actor running. Strike phases run
on the body clock. A shard overrides a rate in `manifest.tiers.<tier>.ticks`.

## 13. Render, tiers, budgets

### 13.1 LookStrategy

`manifest.render` returns a `LookStrategy`: how your level looks. It is one of two shapes.

| Shape | `compose` | Use |
|---|---|---|
| `ExtendLook` (`mode: 'extend'`, the default) | `(c: LookComposeContext) => LookComposition`: your passes in the slots `beforeScene`, `afterScene`, `beforeChain`, `chain`, `afterChain`. `c.engineChain('clean' \| 'cinematic')` is the engine's chain, `c.fx` its effects (`EngineEffects`), each yours to tune: e.g. `c.fx.tone.mode` (the engine's default `ToneMappingMode.AGX`, from `postprocessing`, compresses highlights hard, so a look whose target has bright sun bloom and gold rims may pick `NEUTRAL` or `ACES_FILMIC`), `c.fx.bloom.intensity` / `luminanceMaterial.threshold`, `c.fx.godRays`. **Ask `c.engineChain(kind)` before you read `c.fx`**: the first `c.fx` read builds the `'cinematic'` chain, so a later `engineChain('clean')` throws (the load then stops on the error modal; `<html data-ws-state="error">` tells a harness) | most shards (Driftwood, Pine, the template) |
| `ReplaceLook` (`mode: 'replace'`) | `(c: LookReplaceContext) => LookChain`: `{ chain: Pass[] }`, the whole chain in order | a look with its own composer (Nalati) |

Both shapes take these optional parts:

| Part | What it does |
|---|---|
| `backdrop` (`SkyBackdropFactory` → `SkyBackdrop`) | your sky backdrop and day clock. It gets `SkyBackdropContext`, `SkyBackdropTargets`, `SkyBackdropPost` |
| `sky` (`SkyDressing`) | `{ clouds, planet, sun?: { disc?: boolean, halo?: boolean, rays?: boolean \| { azimuth, elevation } }, build?, update? }`: which engine sky objects to build/show |
| `lighting` (`LightingRig`), `shadows` (`ShadowStyle`) | the light model and shadow rig |
| `fog` (`FogModel`), `fogControl` | your fog patch (`{ order, install }`) and suspend / resume for Explore and playgrounds |
| `terrainPainter` (`TerrainPainter`, `PainterField`) | `build(terrain, field, scope)` builds the ground mesh; `scope` is the owning level scope |
| `grass` (`GrassDriver`, `GrassLayer`) | grass |
| `frame(dt, t)`, `dispose()` | per-frame work and cleanup |

**Sky dressing sun.** `sky.sun.disc` and `sky.sun.halo` independently select the engine sun surface and corona at
build time; each defaults to `true` when omitted. For a sky that paints its own sun or needs no visible sun:

```ts
sky: { clouds: false, planet: false, sun: { disc: false, halo: false } }
```

These flags affect drawing only: sun direction, key light, shadows and the backdrop clock keep working. Disc `false`
hides its surface material so a selected halo can still draw; the parent mesh remains available to the rig and
post effects. A backdrop can additionally drive `targets.disc.visible` / `targets.halo.visible` for day/night;
hiding the disc parent also hides its child halo. The engine does not re-enable a dressing-disabled surface or halo.

**God rays from a painted sun** (E398). With `disc: false` the god rays have no source, because the rays pass masks the
disc. `sun.rays` keeps the disc as the rays' source only: it is left out of the scene (never drawn in the frame), and
the rays pass draws it in its own light scene. `rays: true` puts it at the light's sun; `rays: { azimuth, elevation }`
(degrees, the `sky.sun` compass) puts it at the painted sun when the key light points elsewhere. `sky.raysDir` is that
direction (the sun's by default).

```ts
sky: { clouds: false, planet: false, sun: { disc: false, halo: false, rays: { azimuth: 352.5, elevation: 4.75 } } }
```

**`SkyBackdropTargets` field table.** `backdrop.bind(targets)` runs after the engine builds the light rig and sun,
before frame updates. These are shared live objects: copy/set their values in place, rather than replacing them.

| Field | Type | Meaning / ownership |
|---|---|---|
| `sunDir` | `Vector3` | Unit world direction toward the sun; continuous visual/fog direction. Use `sky.setKeyLight(dir, color, intensity)` to update the shadow rig coherently |
| `sunColor` | `Color` | Live sun light color |
| `lights` | `DirectionalLight[]` | Engine key-light shadow cascades; a clock may set their color/intensity |
| `lightDirection` | `Vector3` | Shadow rig direction (opposite the direction toward the sun); separate from continuous `sunDir` so shadow stepping can be held |
| `hemi` | `HemisphereLight` | Ambient sky/ground colors and intensity |
| `fog` | `Fog` | Scene linear fog color, near and far; defer changes while `underwater()` is true. Read live: it returns the scene's current `Fog`, so read `targets.fog` in each update rather than keeping it from `bind`. A look that sets its own fog should edit the existing `scene.fog` fields in `compose`; replacing the object leaves anything that kept the old one turning a fog nobody draws |
| `fogU` | `{ fogSunDir: { value: Vector3 }, fogSunColor: { value: Color }, fogDistDensity: { value: number }, fogHeightDensity: { value: number } }` | Atmosphere shader's sun direction/color and distance/height fog densities |
| `underwater` | `() => boolean` | Whether the eye is underwater; the atmosphere owns fog then |
| `disc` | `Mesh` | Engine visible sun surface, with child corona; engine positions it along `sunDir`. `visible = false` hides both. The dressing's disc flag controls its material |
| `halo` | `Sprite \| null` | Corona child when present; visibility, material color/opacity and scale are writable. Guard null |
| `cloud` | `{ uSunDir: { value: Vector3 }, uSunColor: { value: Color }, uCloudLit: { value: Color }, uCloudAlpha: { value: number } }` | Engine cloud layer's light direction/color, tint and opacity |
| `far` | `{ uHazeCol: { value: Color }, uSeaSky: { value: Color }, uSeaSun: { value: Color }, uSeaSunDir: { value: Vector3 } }` | Horizon haze and cloud-sea sky/sun colors and direction |
| `planet` | `{ uSunDir: { value: Vector3 }, uHaze: { value: Color }, uCrisp: { value: number } }` | Engine gas-giant shading; `uCrisp = 1` selects a crisp opaque disc |
| `shadowBusy` | `() => boolean` | True while a stepped key-light shadow crossfades; hold the next shadow step until false |

The template's grey-box look extends the engine chain and adds nothing to it:

```ts
export function templateLook(): LookStrategy {
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => { /* a gradient dome, linear fog */ return { chain: engineChain('clean') }; },
    sky: { clouds: false, planet: false },
    backdrop: ({ sky }) => { const clock = createDay(); return Promise.resolve({ clock, horizon: new Color(0xa9afb5), lut: null, /* … */ }); },
    terrainPainter: { build: (terrain, field, scope) => { /* a flat-shaded PlaneGeometry on field.heightAt */ return Promise.resolve(); } },
  };
}
```

A `TerrainPainter.build(terrain, field, scope)` receives the same live level `Scope` used by the engine’s boot.
Pass it to `patchShader(..., { scope })`, and register painter-created geometry, material, texture and other
resources with `scope.own(resource)` as you create them (before an await can fail). Add meshes to `terrain.group`,
and set `terrain.mesh` / `terrain.material` if downstream ground code needs them. Do not own a shared asset
acquired through `app.assets`; its lease owns it. No global or hidden module scope is needed by a painter.
Direct `Terrain.build(ground, painter, scope)` callers must provide that scope; missing or disposed scopes fail
before invoking a custom painter.

`@wildshard/game` re-exports the old names `ShardRender`, `ShardComposeContext`, `ShardComposition` for manifests not yet moved.

### 13.2 Shader patches

Every shader patch goes through `patchShader(material, id, order, fn, { scope, mode?, key? })`. A raw
`onBeforeCompile` or `customProgramCacheKey` is a lint error (`wildshard/no-raw-shader-patch`).

| Export | What it is |
|---|---|
| `patchShader` | registers a patch; returns its remover. Pass `scope` so it goes with your level |
| `PATCH_ORDER` | order bands: material 100 · decorate 200 · shadows 900 · view 950 (fog slots: engine 100, stylize 200, a level's 300) |
| `ShaderSource`, `ShaderPatchFn`, `ShaderPatchKey`, `ShaderPatchOptions` | its types |
| `setProgramKey`, `hasProgramKey`, `setInheritedPatch`, `takeForeignHook` | program-key control and legacy hook adoption |

```ts
patchShader(material, 'template.linear-fog', PATCH_ORDER.decorate, (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', '…');
}, { scope });
```

The renderer type is named only in `src/engine/render/**` (`wildshard/no-renderer-type`). The handle is `Renderer`
(`probeRenderer`, `isRenderer`). No WebGPU. **Facade multi-draw is banned everywhere** (AGENTS.md E271).

**Material graphs (SF59, lazy, not on the default path).** TSL is reached only through `render/graphBackend.ts`:
`loadGraphBackend(renderer)` installs `EngineNodesHandler` (the output transform, the upright target sample, the fog
epilogue, the tent and cascade shadows as nodes); `loadGraphCompiler(renderer)` then loads `compileGraph(ir)`
(`render/graph/compile.ts`), which turns a graph IR into a node material. The renderer-neutral IR (`core/materialGraph.ts`,
`GRAPH_IR_VERSION` 1) is data: `nodes` of an allowlisted vocabulary (`GRAPH_OPS`: inputs, safe maths, comparisons and a
branch-light `select`, swizzles, MaterialX noise, an admitted texture, a constant-count `loop`), the stages
`vertex.offset`, `surface` and `post` (`lighting` reserved), typed `params` that are uniforms only (bindable to a day key
or a declared shard-state field; `setParam` never recompiles), and a per-program budget. `validateGraph(ir, opts)`
refuses unknown ops, type mismatches, cycles and over-budget graphs before any node exists. A select with cheap sides
compiles branch-free (`mix`); one with an expensive side nothing else reads becomes a real `if / else`. Presets
(`render/graph/presets.ts`) re-express a family for the parity bench (`scripts/tsl-spike/`, the `graph` variants):
`pbrMeasureGraph` (PBR + the SF56 measure layer, size labels included) and `emissiveGraph` (the emissive surface and
tube), compiled under `PRESET_GRAPH_BUDGET` (the labelled measure preset runs past the content budget). The toon and
painterly families redefine three's light model, which is the reserved `lighting` stage, so they have no preset yet;
`emissiveGraph` refuses a sky, an additive blend or a fog share other than 1. No shipped material uses a preset, and
today's families stay hand-written GLSL.

### 13.3 Tiers as data

A tier is `'phone'` or `'desktop'` (`Tier`). Knobs resolve in one order: engine default → kit schema default →
`manifest.tiers[tier]`. The last one wins (`resolveTierKnobs`).

| Knob (`TierKnobs`) | Meaning |
|---|---|
| `slices`, `ao`, `aa` (`'fxaa' · 'smaa' · 'off'`), `msaa`, `godRays`, `skipRaysOffscreen` | post |
| `treeHiDist`, `shadowFar`, `animalShadowDist`, `grassSlots`, `envSteps`, `pointLightSkip` | detail distances and counts |
| `warmTurns`, `textures` (`'img' · 'ktx2'`) | boot |
| `ticks` | scheduler overrides (§12) |
| your own | merged into `TierKnobMap`, declared with `ctx.tiers.knobs({ id, defaults })` |

```ts
// manifest
tiers: { phone: { 'template.propCount': 10, godRays: false, ao: false }, desktop: { 'template.propCount': 20, godRays: false, ao: false } },
// plugin.world
ctx.tiers.knobs({ id: 'template', defaults: { 'template.propCount': 10 } });
```

`TIER`, `buildTier`, `TIER_CONFIG` are the page's resolved tier (ports for code without `ctx`).

### 13.4 Budgets

`manifest.budgets` (`BudgetInputs`) holds **inputs only**: per tier `{ fps, variability, cpuMs, gcMs, systems,
vertexShare, lanes, linkMs }`, plus `load` and optional `ceilings`. `src/engine/render/budgets.ts` derives draws,
triangles, programs, GPU MB, ms per system and download MB from them and the M5 calibration (`budgets/calibration/`; `budgets/calibration.json` once a stable one is published). The gate fails a
shard over a derived number. `ceilings` are the recorded F2 maxima of the existing shards (`budgetCeilings.ts`); a new
shard has none. Memory limits are hard: 1.8 GB loading, 1.0 GB in the world.

```ts
const tier = (fps: number) => ({ fps, variability: 1.3, cpuMs: fps === 30 ? 9.6 : 4.8, gcMs: 0.3,
  systems: { physics: 0.3, ai: 0.3, animation: 0.3, player: 0.2, world: 0.2, hud: 0.1, audio: 0.1 },
  vertexShare: 0.5, lanes: { opaque: 0.4, shadow: 0.2, transparent: 0.1, viewmodel: 0.1, post: 0.1, reserve: 0.1 }, linkMs: 1000 });
export const BUDGETS: LevelSpec['budgets'] = { phone: tier(30), desktop: tier(60), load: { coldPlay4G: null, fixedSeconds: 0, cpuRatio: 2, bytesPerSecond: 1125000 } };
```

`Bucket` is the frame-cost bucket type the budget report uses.

`SkyRig` is the engine lighting/shadow mechanism, exposed through the compatible `Sky` name. `SkyBackdropView` owns the default background/IBL and the clouds, disc, planet and their drawing uniforms. Authored `SkyBackdrop.clouds` domes are attached to the scene by the engine and kept on the camera; a backdrop does not need to attach its dome. These engine handles are type exports to preserve Node-safe manifests. The backdrop strategy still owns its clock, colors and disposal.

## 14. Physics

`src/engine/physics/` is the only code that imports Rapier. Nothing else hand-rolls a collision test.

| Export | What it is |
|---|---|
| `castRay`, `castSegment`, `floorBelow`, `lineOfSight`, `sticksIn` | the queries |
| `ctx.piece(piece)` | registers a built piece: `{ id, name, category, file, object, colliders?, surface?, active?, floor?, model? }`. It draws, collides, shows on the map and in Explore's catalog |
| `WorldRegistry`, `activeRegistry` | the registry (`app.registry`); `activeRegistry` is a port |
| `boxDesc`, `ColliderDesc` | collider descriptions: `box`, `capsule`, `ball`, `hull`, `treads` (stairs), `trimesh` (walk-inside only) |
| `pathRampDescs` | a graded walkway over steep ground |
| `activeBodies`, `Body`, `BodySpec` | dynamic bodies, with the per-tier caps (phone: 40 awake, 2 ragdolls) |
| `groups`, `GroupName` | collision groups |
| `RopeChain`, `RopeChainSpec`, `boxInFrame`, `BoxSpec` | rope chains; a box in a frame |

**The rules.** Step 0.35 m, max climb 40°. A stair is `treads` (rise ≤ 0.35 m, tread ≥ 0.36 m). A piece that moves
`follows` its object (kinematic). Moving gameplay runs in the fixed step. After changing colliders, run
`node scripts/physics-baseline.mjs --no-build --mode=walk`: 0 stuck is the bar.

The template's ramp with stair treads:

```ts
ctx.piece({ id: 'template.ramp', name: STRINGS.ramp, category: 'buildings', file: 'src/shards/_template/world/build.ts', object: ramp,
  colliders: [{ kind: 'box', x: 12, y: from[1] + 0.9, z: -11, hx: 1.5, hy: 0.12, hz: Math.sqrt(40) / 2, rot, surface: 'wood' },
    { kind: 'treads', from: { x: 8, y: from[1], z: -8 }, to: { x: 8, y: from[1] + 2, z: -14 }, width: 3, count: 10, surface: 'wood' }], surface: 'wood' });
```

A door is a piece whose `active()` is false while it is open, plus an `Interactable` pushed to
`ctx.game.runtime.interactables` (§17).

## 15. Audio

| Export | What it is |
|---|---|
| `Audio`, `StepSurface`, `AnimalSound`, `HoofSurface`, `ImpactKind` | the engine mixer (`runtime.play.audio`, a port while S3.5 finishes) |
| `Music`, `MusicState`, `ScoreSource`, `SetScore`, `SlotAudio`, `StyleBank`, `StemSting`, `BossPhase` | the score engine and its sources |
| `CueMap`, `CuePlayer`, `CueOpts`, `CueBank`, `SampleClip`, `CueId` | cues: the engine and weapons emit `cue.*`; your cue map turns a cue into sound |
| `CombatCues`, `audioCueMap`, `CombatCueMap`, `CombatCueOpts` | `runtime.play.cues`: `cues.use(fn, scope)` adds a handler; `fire`, `charge`, `cue` play one |
| `AmbienceZones`, `ZoneVoice`, `ZoneWeights` | ambience beds by zone |
| `VoicePool`, `VoiceTable`, `SampleVoice`, `SamplePolicy` | the positional voice engine |
| `LevelAudioProfile` | a level's audio profile (the audio runtime loads lazily: `await import('@wildshard/engine/audio/Stems')` …, by the module a level uses) |
| `installScore`, `Score`, `Arrangement`, `Segment`, `NoteEv`, `ChordEv`, `MixEv`, `LayerId`, `MixKey`, `Mode`, `ChordName` | the synth score Music plays: the composition root installs the game's (src/game/audio/theme.ts, E405: the engine holds no theme) |
| `Synth`, `impact`, `synthKit` | synth fallbacks, the impact generator, and the synthesis primitives (`noise`, `voice`, `strike`, `bubbles`, …) content voices build on (@wildshard/kit's creature voices) |
| `panFromYaw`, `loopAt`, `audioRandom`, `ownAudioSource` | helpers |

`manifest.audio` is `{ bed?, ambience, score, cues?, preload?, samples?, alertOnlyHostile? }`. The template points every
cue at kit sounds:

**No ambience.** Use `audio: { ambience: 'none', score: '<your score id>', … }`, omit `bed`, and install no ambient
beds/zones or `installForestAmbience` in the plugin. `ambience` names authored content; it does not start an
installer on its own. With no selected bed or installer, the engine starts no ambient loop. Keep `cues` and
`preload` for weapon / creature SFX and music as needed; those are independent of ambience. An asset-free shard
can omit `preload` as well. Do not invent a shard-specific silence id or inherit the template’s forest bed.

```ts
export const CUES = { fire: 'cue.sword.swing', impact: 'cue.sword.hit', heavy: 'cue.sword.heavy', reload: 'cue.reload' } as const;
export function installTemplateCues(audio: Audio, cues: CombatCues, scope: Scope): void {
  const voices = sharedWeaponVoices(audio);
  cues.use((id, opts) => {
    switch (id) {
      case CUES.fire: voices.swordSwing(); return true;
      case CUES.impact: voices.swordHit(opts.surface === 'wood' ? 'wood' : 'flesh', opts.pan, opts.gain); return true;
      default: return false;
    }
  }, scope);
}
```

New music comes from MiniMax Music 3; every SFX is made with MOSS and Stable Audio 3 and the better take ships (AGENTS.md).
The credits "Music: MiniMax-Music3" and "Powered by Stability AI" are licence conditions and stay.

## 16. Animation

| Export | What it is |
|---|---|
| `loadRig`, `loadRigFile`, `bindRig` | the one rig loader (GLB + bake) |
| `AnimMachine`, `AnimMachineDef`, `AnimState`, `ClipChannel` | the state machine a brain or a viewmodel drives |
| `RigContract`, `RigRef`, `RigInstance`, `RigBake`, `ClipName`, `SocketName`, `AnimService` | the contract a species, NPC or viewmodel declares |

`ClipName` is `idle · walk · run · attack · hit · die · turn · swim · fly`, optionally with `.suffix`. A raw
`new AnimationMixer` outside `src/engine/anim` is a lint error (`wildshard/no-raw-animation-mixer`). The template's blob
declares its contract on its look row:

```ts
rigContract: { skeleton: 'template.greyBlob', sockets: ['body', 'head'], clips: ['idle', 'walk', 'attack', 'hit', 'die'] },
```

## 17. World mechanisms

| Mechanism | Exports | Example |
|---|---|---|
| Terrain | `buildTerrain` (`@wildshard/engine/world/terrainField`, node-safe), `heightAt`, `terrainNormal`, `terrainWaterLevel`, `Terrain`, `Noise2D`, `smoothstep`, `clamp`, `lerp`, `TerrainNoise` | `buildTerrain(357, { landscape, trails, cabinSites: [] })` |
| Sky | `Sky`, `SkyBackdrop*` (§13.1), `compassDir` | the template's backdrop drives `sky.setKeyLight` |
| Day cycle | `DayCycle`, `DayCycleSpec`, `DayCycleClock`, `DayKeys`, `DayPhase`, `TimePick`, `LightPreset`, `ScheduleSeg`; `app.registerDayCycle(clock, scope)` | `createDay()` in `_template/world/climate.ts` |
| Weather | `Weather`, `WeatherProfile`, `WeatherNumbers`; asks `weather.hold` / `weather.damage`; kit `rainCurtain` | `new Weather<'clear' \| 'cloudy'>({ states, next, length, … }, ctx.app.rng.stream('gameplay'))` |
| Water | `WaterBody`, `WaterBodies` (`app.world.water`), `swellBody`, `basinBody` (`@wildshard/engine/world/water/body`), `surfaceReflect`, `WaterView`, `pondGrid`, `waveHeight` | the template's `POOL` row in `ground.water` |
| Fog | `attachFogUniforms`, `addFogUniforms`, `fogUniforms`; your `FogModel`; weather fog `weatherFog`, `WeatherFog`, `WeatherFogSpec` (E390: a second exponential fog over the level's own, compiled only when the manifest sets `atmosphere.weather: true`; `set(strength 0..1)` each time it changes, cleared when the scope ends; it composes with a backdrop's clock and the underwater blend) | `const storm = weatherFog(ctx.scope, { dist: 0.05, color: 0x8a5238 }); storm.set(eased)` (Signal Dunes' sand storm) |
| Wind | `wind`, `WIND_DIR`, `windGustAt`, `windUniforms`, `WindField` | grass, trees and arrow drift read it |
| Placement and models | `defineModel`, `ModelDef`, `modelContext`, `ModelContext`, `ModelPart`, `live`, `listModel`, `RosterEntry`, `twoSidedPositions`, `WeldBuild`, `markGpuOnly` | `defineModel({ id: '_template/lantern', pipeline: 'code', build: () => … })` |
| Forest and trees | `Forest`, `TreeFactory`, `TreeVariant`, `FadeBand`, `patchFade`, `patchWind`, `TREE_SPECS`, `TreeSpeciesTraits` (a species' planting: scale, growth, girth, spacing, hue), `TreeSetVariant` (a tree set's variant), `SpeciesWeights` (the level's own set and traits: `TreeSpec.setVariants`, `ForestSpec.speciesTraits`; E405), `treeSetOf`, `treeSetUrls`, `loadTreeSetGeometry`, `BARK_LAYERS`, `patchBarkArrays`, `patchCardCrownTop`, `patchImpostorCrownTop`, `standIn`, `loadBakedCards`, `exportCardTextures` | |
| Geometry kit | `log`, `beam`, `rope`, `sagLine`, `rock`, `plank`, `tris`, `wobble`, `pole`, `blob`, `lathe`, `revolve`, `revolveUV`, `mergeVerticesByPos`, `voxelAO`, `aoTint`, `hemisphere`, `VoxelAOParams`, `HemiRing`, `HemiDir`, `lin` | |
| Interactables | `Interactable`, `Interactables`, `InteractEvent`, `Flags`, `Place`, `PoiId` | the template's hut door |
| Bounds and layout | `installBounds`, `layoutFauna` (`@wildshard/engine/world/faunaLayout`), `CHUNK_*` | |
| Content loaders | `loadPBR`, `loadPBRArray`, `loadGLTF`, `loadTexture`, `pbrMaterial`, `PBRSet` | lazy engine content (ports) |
| Painterly helpers | `painterlyMaterial`, `syncPainterlySun`, `updatePainterly`, `setPainterlyLook`, `painterlyUniforms` | ports of Nalati's material, waiting to move |
| Light layers | `SHADOW_LAYER`, `World` (a port) | |

`Flags` stores quest flags per level: `new Flags(ctx.manifest.slug)`, `flags.set('template.hut')`.

## 18. Combat: Equipment, Weapon, Tool, GAS-lite

```ts
abstract class Equipment { row: EquipmentRow; attributes; effectTags; holster; enabled; install(ctx: EquipContext); update(dt, t); dispose() }
abstract class Weapon extends Equipment { tryFire(); state: WeaponState; model; /* onFire, onHit, altHeld, aimInfo … */ }
abstract class Tool extends Equipment { slot: 'tool' | 'offhand'; actions: readonly Action[] }   // runs beside the weapon
```

| Export | What it is |
|---|---|
| `Equipment`, `Weapon`, `Tool` | the base classes |
| `EquipmentRow` | `{ id, ui, meta, cues?, hitStop?, tags?, pickup?, rangedFeel?, legacySlot? }`. Also on `@wildshard/game` |
| `EquipmentMeta` | `{ name, icon, blurb, category }`: the Bag builds its entries from it |
| `WeaponUi` | `{ name, icon, touch, lockOn, melee, tracers, swapIcon, inputContext?, ammo? … }`; `ammo.magazine: true` makes the touch ammo chip a reload button. Its glyph appears below full; a tap uses the reload input action. |
| `EquipmentId`, `WeaponId`, `ToolId` | `'weapon.*'` / `'tool.*'` ids; `WeaponId` is a legacy slot from `EquipmentSlotMap` |
| `EquipmentSlotMap`, `EquipmentIconMap`, `EquipmentTouchMap` | merge your slot, icon or touch mode into them |
| `EquipContext`, `BlockSet`, `WeaponState`, `AimInfo`, `WeaponHooks`, `EquipmentAction`, `quiverState` | equipment plumbing |
| `EquipmentService` | `app.equipment`: the loadout, `add`, `unlock`, swapping |
| `EquipmentHost` | `app.equipmentHost`: the scene/player ports and `viewmodel` root for camera-space equipment |

`EquipmentService` accepts an explicit `input` binding port. The client session connects it to `app.input` and
the active weapon's enabled predicate; a simulation service can omit device bindings.

Mount a finished custom model in `app.equipmentHost.viewmodel` during `play`, and remove it with your scope.
The engine keeps the camera in the scene and owns one depth clear at transparent render order 999. Added meshes
draw at order 1000 or their higher declared order, without frustum culling or shadow casting; their materials use
the transparent queue and retain their depth-write setting. Opaque materials are cloned so a shared world prop
keeps its own rendering; already-transparent materials keep their identity. Parts added after mounting are prepared
on the next matrix update. Hide the model to holster it. The engine skips its
depth clear when every model is hidden. Kit weapon families share this root through `game.viewmodel`.

```ts
const host = ctx.app.equipmentHost;
if (host !== null) {
  host.viewmodel.add(weapon.model);
  ctx.scope.onDispose(() => { weapon.model.removeFromParent(); });
}
```

**The blocks** are public and the same for kit families and custom weapons:

| `blocks.*` | What it gives you |
|---|---|
| `viewmodel(feel)` | look-lag spring, sway, bob (`LookSpring`, `LookLag`, `DrawingBuffer`) |
| `melee(combat)` | contact through the damage pipeline: windup → active → recover, occlusion |
| `aimRay()`, `ads(...)`, `fovForAspect(...)` | the aim ray, one ADS blend, the FOV for an aspect |

`viewmodel`, `melee`, `aimRay`, `fovForAspect` and `blendAds` are also exported on their own.

**The ladder.** Pick the lowest rung that works.

| Rung | How | Real example |
|---|---|---|
| Profile | a kit family with a profile row | `new Bow(world, targets, { row: LONGBOW, profile: LONGBOW_PROFILE })` (Pine); `new Sword(world, targets, { row: IRON_SWORD, profile: SWORD_IRON })` (template) |
| Extend | a subclass of a kit family | `class LeverRifle extends Firearm` (Pine) |
| Custom | `extends Weapon` or `extends Tool`, built from `blocks` | `class TemplateWhip extends Weapon`, `class TemplateLantern extends Tool`, `class FeiZhua extends Tool` (Nine Dragon) |

The custom whip, cut down:

```ts
export class TemplateWhip extends Weapon {
  private readonly vm = blocks.viewmodel({ gain: 0.01, clampYaw: 0.1, clampPitch: 0.1, k: 50, c: 12 });
  private readonly contact: ReturnType<typeof blocks.melee>;
  constructor(app: App, targets: Targets | null = null, actorFor = …) {
    super(WHIP_ROW); this.contact = blocks.melee(app.combat); this.blocks.vm = this.vm; this.blocks.melee = this.contact;
  }
  override install(ctx: EquipContext): void { super.install(ctx); this.app.input.bind('attack', () => { this.tryFire(); }, ctx.scope, () => this.enabled); }
  strike(actor: Actor, point: Vector3, dir: Vector3, from: Vector3, heavy: boolean): void {
    const result = this.contact.hit({ source: 'env', sourceTags: ['actor.player', 'weapon.template-whip', 'dmg.melee'], target: actor,
      amount: heavy ? 30 : 18, point, dir, from, weaponId: this.row.id, moveId: heavy ? 'template.whip.heavy' : 'template.whip.light', surface: 'flesh' });
    if (heavy && result !== null && actor.alive) this.app.effects?.apply(actor, 'effect.poison');
  }
}
```

**The damage pipeline** (`CombatPipeline`, `app.combat`). Every source calls one `hit(req)`:
build a `DamageRequest` → occlusion (`lineOfSight`, unless `throughWalls`) → `ask('damage.modify')` → apply →
`emit('damage.dealt')` and on death `emit('actor.died')` → `cue('cue.hit.<surface>')`.

| Export | What it is |
|---|---|
| `DamageRequest` | `{ source, sourceTags, target, amount, point, dir, surface?, weaponId?, moveId?, headshot?, stagger?, knockback?, throughWalls?, from?, distance?, scale?, cause?, toast? }` |
| `DamageDealt`, `DeathCause`, `StringKey` | the result, the killer for the death card, a string key |
| `DamageRuleDef` | the data form of a simple rule: `{ id, order, when: { sourceTags?, targetTags?, weaponTags?, targetState? }, op: 'cap' · 'add' · 'mul' · 'negate' · 'override', value }`. A rule it can't express is a plain `ctx.answer('damage.modify', fn, { order })` |
| `Actor`, `CombatTag`, `HealthAttributes` | anything that has attributes and can hit or be hit |
| `PlayerHealth`, `PlayerHealthPorts` | `app.player`: the player's health lives in the engine |
| `sourceMultiplier`, `SourceMulDef` | per-source multipliers inside a source's base formula |
| `AggressionDirector`, `AggressionService` | attack tokens: `manifest.fight.attackers` (2 on Driftwood, unlimited elsewhere) |
| `resolveHitStop`, `HitStopProfile` | hit-stop |
| `Targets`, `TargetAnimal`, `TargetHit`, `authoredTargets`, `RayTargets`, `getAimTargets`, `lockOn`, `meleeLock`, `targetRadius`, `AimTarget`, `bladeBlocked`, `bladeContact`, `Clang` | what a weapon can hit, aim assist and lock-on, blade occlusion |
| `CameraFX`, `Impacts`, `BladeGlow`, `dodgeFx`, `dodgeEnv`, `fxMaterial`, `annulus`, `FX`, `FxMaterial`, `FxMode`, `LightPool`, `ParticlePool`, `ParticlePoolSpec`, `ParticleAttr`, `pointScale` | feel and FX |

**Damage request motion fields (G21).** These optional fields are currently metadata, not movement commands.
`CombatPipeline.hit` preserves them through modifiers and in `DamageDealt.req`, but neither the built-in Animal
actor adapter nor `PlayerHealth.applyDamage` reads them. A custom actor or listener must define its own semantics
before using them; do not assume a request with either field pushes or interrupts its target.

| Field | Type, unit and range | Built-in Animal / player effect |
|---|---|---|
| `stagger` | `number` (optional). No runtime unit, range validation or clamping is defined for this request field; it is not a duration in seconds. | Neither target applies a stun, push or attack cancellation from it. An Animal still gets the normal damage flinch. |
| `knockback` | `number` (optional), not a vector. No runtime unit, range validation or clamping is defined for this request field; it is not a distance or velocity command. | Neither target moves from it. |

For an Animal, after an accepted, nonlethal hit, call `animal.stagger(dir, strength)` explicitly for a melee
interruption. Here `strength` **is** a dimensionless number clamped to `[0, 1]`: 0 gives a 0.6 m push and 0.4 s
stun; 1 gives 1.5 m and 0.8 s, with linear interpolation between them. Push distance is divided by
`Math.max(1, animal.scale)`, the world direction is flattened to XZ and normalized, and the push takes 0.25 s.
The call cancels the Animal's attack and holds its AI/body steering while stunned; dead Animals ignore it.
The kit melee weapons call this separately from their damage request. For a velocity push, use
`animal.impulse(worldVelocity)` (§19), which does not itself stun or cancel attacks. Neither Animal method is a
player health/motor port; the request fields do not give the player either behaviour.

**Player impulse.** `app.player?.impulse(worldVelocityMps)` copies and adds a finite `THREE.Vector3` in world-space
metres per second. It applies on foot and on the hoverboard, independently of steering and the existing hit shove.
Each fixed body step uses the collision controller (walls and ceilings block the displacement), then decays the
transient velocity by `exp(-3.5 * dt)` and clears it below squared speed `0.05`, matching `animal.impulse`. Positive
Y lifts the feet; on the board it releases the hover spring until landing, so updrafts work. Respawn clears it.
Calls while dead, mounted on an animal, carried by a traversal or movement-locked have no effect; swimming is not
a supported impulse mode. Health-only `PlayerHealthPorts` may omit the optional `impulse` callback; the live game
binds it to the player motor. Damage metadata does not automatically call this verb.

```ts
app.player?.impulse(new THREE.Vector3(6, 3, 0)); // gust east and up, without a damage hit
```

**Custom weapon targets.** `app.combat.targets()` returns scoped `CombatTarget` ports for creatures, or only the
training dummies while the Practice Arena is open. Each port has `actor`, world `position`, live `hittable`, its
raycast `target` identity, `hurt(req)` (a `DamageRequest` without `target`) and optional `impulse(velocity)`.
`app.combat.target(hit.animal)` resolves a shared raycast hit to the same port. Select through these queries rather
than a shard creature array so custom weapons work in practice. `hurt` and `blocks.melee(app.combat).hit` both run
the normal pipeline; dummy ports keep the same armour, damage numbers and reactions as kit hits.

```ts
for (const target of app.combat.targets()) {
  if (!target.hittable || target.position.distanceTo(from) > reach) continue;
  target.hurt({ source: 'env', sourceTags: ['actor.player', 'weapon.my-blade', 'dmg.melee'],
    amount: 30, point: target.position.clone().add(new Vector3(0, 1, 0)), dir, from,
    weaponId: this.row.id, stagger: 0.6 });
}
```

The engine registers world targets and practice overrides with `combat.registerTargets(scope, source, practice?)`;
`combat.targetPort(actor, body, impulse?, available?)` adapts a contact body without changing its damage formula.
The practice predicate isolates the room when true, even when it has no targets. Scope disposal removes the source.

**GAS-lite: effects.** `EffectService` (`app.effects`) applies `EffectDef` rows to an actor or a piece of equipment.

| Export | What it is |
|---|---|
| `EffectDef` | `{ id: 'effect.*', tags, kind: 'instant' · 'timed' · 'permanent', duration?, period?, modifiers, stacking, cue?, icon?, blockedBy?, grants? … }` |
| `EffectService`, `EffectTarget`, `EffectId`, `ActiveEffect`, `AttributeSet`, `matchesTag` | `apply(target, id, source?)`, `remove(target, id)`, `has(target, tag)` |

The kit's starter set is `effect.poison`, `effect.burn`, `effect.bleed`, `effect.slow`, `effect.stun`
(`STARTER_EFFECTS`, `installStarterEffects`). Register rows with `ctx.rows.effect(STARTER_EFFECTS)` in `kit`.

**Ranged ports** (the kit families use them; a custom ranged weapon may too): `Projectiles`, `projectileFlightStep`,
`ProjectileKind`, `ProjectileWorld`, `ShotOpts`, `DropArc`, `hitscan`, `HitscanProfile`, `HitscanResult`, `HitLine`,
`makeFlashTexture`, `brassFloor`, `stepBrass`, `BrassCase`, `installRangedFeel`, `RangedFeelProfile`, `ImpactSurface`,
`AmmoId`, `AmmoRow`, `ProjectileModification`, and the shared viewmodel helpers in `./combat/view/ranged`
(`Puffs`, `worldHit`, `FOV_HIP`, `FOV_ADS`, `viewmodelMaterial`, `TRACER_ORDER` … listed in the appendix).
**Melee view ports**: `Move`, `Key`, `Trail`, `SwordWorld`, `SwordRig`, `SwordArms`, `SwordFraming`, `SwordMoveSet`.
**Arms ports**: `ARM_PAL`, `gloveFist`, `riderArm`, `placeArm`, `forearm` (Nalati's arms, waiting to move);
`buildHoverboard` (the hoverboard's geometry).

`SlashTrail` (`@wildshard/engine`) is the shared melee ribbon drawing block. `SlashTrailProfile` supplies capacity, subdivisions, motion threshold and the age/alpha channel. `sample(inner, tip, time)`, `reset()` and `rebuild(time, life, alpha?)` keep caller-owned materials and clocks; `geometry`, `count` and `newest` expose drawing and expiry handles.

`GroundTell` (`@wildshard/game`) supports ring, lane and wedge decals. `GroundTellWedgeStyle` supplies the cone and authored material/fill/alpha uniforms; `wedge(x, z, yaw, reach, fill, alpha, lift?)` uses animal yaw convention and drapes the sector onto terrain. Existing ring/lane shader behavior remains unchanged.

`smoothstep` (`@wildshard/engine/core/noise`) also drives DeathFade and the bow/spear authored curves; the normalized fade uses edges zero and one. Unclamped and early-return curves retain their distinct behavior.

## 19. Creatures and AI

Import `AnimalSim` from `@wildshard/engine/entities/AnimalSim` for creature state, motion, attack clocks, geometric perception and damage without a rig. Its `AnimalSimSpec` supplies authored dimensions and multipliers; `AnimalSimPorts` supplies height, floor, time, random and damage services, and `AnimalMotor` supplies collision displacement. `step(dt)` advances the body and attack clock. Every instance has a stable `entityId`.

The client imports `Animal` from `@wildshard/engine/entities/AnimalView`. It extends the same simulation and retains skeletal pose, posed hit volumes, LOD, hit flash and ragdolls. `canReach(actor, target, physics)` requires the owning physics world explicitly.

A creature is two rows: a `SpeciesRow` (simulation) and a `SpeciesLook` (render). Register both in `kit`.

**Creature coordinates.** A creature faces **+Z** in model space (+Y up, +X right). Each `BoneDef.pos` is an
**absolute bind-space position in model units**, even when it has a parent. The factory subtracts the parent’s
absolute position to construct the local bone transform; do not subtract it yourself. For example, a body at
`[0, 1, 0]` and its head at `[0, 1.2, 2]` put the head two metres forward and 0.2 metres above the body.

**Required creature bones.** Every rig, including `rig: 'custom'` and flying rigs, needs named `body` and `head`
bones in `build().bones`; `body` must be the first bone. They anchor the body capsule and head hit sphere even
when the creature does not have a visually separate head. Declare both names in `rigContract.sockets`.
`ctx.rows.speciesLook` / `app.species.registerLook` and legacy `registerSpecies` reject a missing declaration during
registration, naming the species and bone. The factory also validates the actual built bones before constructing
an `Animal`, so a declaration cannot hide an incomplete model. Default quadruped animation additionally needs its
neck, ears, tail, belly and leg bones; use `rig: 'custom'` with `animate` for other skeletons.

`animal.impulse(worldVelocity)` copies and adds a velocity in metres per second, then decays it at 3.5/s on the body
clock. Ground bodies resolve its XZ displacement through their normal collision motor; flying bodies also use Y.
Bodies sampling WORLD floors fall ballistically when the floor drops more than 1 m: gravity is −20 m/s²,
initial vertical velocity is the pending impulse Y (otherwise zero), and XZ impulses continue decaying.
They land on the next floor or cross `world.killY`; ordinary analytic terrain ground follow is unchanged.
`animal.hasImpulse` reads whether that transient motion remains. It does not change the existing melee stagger or
`DamageRequest.knockback` semantics. Do not update an Animal's position from a shard to push it.

`manifest.world: { killY, fallCause? }` declares a creature death plane. The engine body clock calls
`app.combat.fall(actor, point, cause)` below it; without `world.killY`, no automatic fall death runs.
The default cause is `{ kind: 'out-of-world', label: 'Out of world' }`; an authored `FallCause` can use
`kind: 'fall' | 'out-of-world'`, `label` and optional `text`. `fall` consumes the target's remaining health directly,
bypasses damage modifiers and cover, runs its damage/death presentation, and emits `damage.dealt` and `actor.died`
once with that cause. A shard may call it for an authored pit instead of supplying a magic damage amount.

| Export | What it is |
|---|---|
| `SpeciesRow` | `{ id, kind, label, variants, aggressive?, tuning?, sounds?, flight?, lockable?, think?(animal, ctx), act?(animal, ctx), tick?, blood?, parent? … }` |
| `SpeciesFlight` | `{ altitude, above?: 'ground' \| 'world', climbRate, diveRate, lockRange? }`; rates are metres per second |
| `SpeciesVariant` | `{ id, label, weight, rarity, scale, hp?, mods? }` |
| `deriveSpecies(parent, patch)` | a row that overrides its parent field by field |
| `SpeciesLook`, `speciesWithLook`, `CreatureHull`, `EyeSpot` | the render row: `{ id, species, kind, rig, fur, rigContract, build(variant: VariantDef, rng: Rng): AnimalSpecies, animate(ctx: RigAnimCtx) }` |
| `SpeciesService` | `app.species` |
| `CreatureBrain<S>` | a state machine: `think(ctx)` (decisions, on the brain tick) and `act(ctx)` (the body, every body tick); `transition(state)` |
| `ThinkCtx`, `EnemyWorld`, `AnimalDims`, `VariantMods`, `RigAnimCtx`, `FurStyle` | what a brain and a look receive |
| `StrikeRunner`, `StrikeSpec`, `StrikeContext`, `StrikeActor`, `StrikePhase`, `UtilityScore` | strikes as data: `pick(specs, ctx)`, `start(spec, actor, target)`, `update(dt, ctx)` |
| `canReach`, `ReachActor` | occlusion only: a WORLD ray from target feet + 1.2 m to the creature aim point; no navmesh test |
| `Hfsm`, `StateDef`, `StateChange` | the hierarchical state machine under the brains |
| `GroupBrain`, `GroupMember` | herds (Pine Hollow's night spawns moved into its folder: src/shards/pine-hollow/quest/nightBrain.ts, E405) |
| `WeightedTable`, `WeightedRow`, `TableDrop`, `TableSpec` | spawn and loot tables (`mode: 'weighted' \| 'each'`) |
| `inspectBrain`, `pinBrain`, `brainInspection`, `BrainInspection`, `installAiDebug`, `AiDebugHost`, `AiDebugView` | the AI debug overlay |

**Brain context (`ThinkCtx`, G20).** `think(animal, ctx)` receives the scheduled decision delta;
`act(animal, ctx)` receives the scheduled body delta. Do not hard-code 0.1 s: cadence depends on the species tick
policy and scheduler (§17). The manager reuses one context object across Animals/callbacks, including its
per-animal `hurt`/`sound` closures and player reference. Read it during the callback; copy positions or values
needed later rather than retaining `ctx`.

| Field | Type | Meaning |
|---|---|---|
| `dt`, `t` | `number`, `number` | Seconds for this callback; elapsed simulation seconds (`app.clock.now`), not wall-clock milliseconds. |
| `player` | `Vector3` | Player **feet**, in world metres. It is not the camera/chest. Clone before adding a chest-height offset for a sphere's target. |
| `playerSpeed` | `number` | Smoothed horizontal movement speed in m/s (sample capped at 9); while sprinting the manager supplies 7.2 rather than that measurement. |
| `rng` | `Rng` | Manager's shared seeded random stream (`next`, `range`, `int`, `chance`, `pick`, `weighted`, `fork`). Drawing advances it. |
| `calm` | `boolean` | Debug unawareness: the player should be invisible to this brain. Custom thinkers must honour it themselves; it does not veto `hurt`. |
| `herd` | `Animal[] \| null` | Spawn herd members, including dead members; `null` when not in a herd. |
| `hurt` | `(damage: number) => void` | Player damage via the manager's wired charge callback, attributed to this Animal. Rechecks reach; on melee shards also requires facing within ±70°. It checks neither distance nor strike shape nor attack tokens; the brain/runner supplies those. |
| `sound` | `(name: string) => void` | Routes an authored Animal sound name to the manager's sound callback at this Animal's position. |
| `world` | `EnemyWorld` | Optional shard-supplied `perches`, matching `perchBases`, `throwCoconut(from, target, thrower)`, `splash(at, strength)`, `hold: { x, z, r, guardR, floorAt }` (floor height or `undefined`), and `night()` (0 midday to 1 night). Test for missing pieces. |
| `heightAt` | `(x: number, z: number) => number` | Terrain height in world metres; not a raycast for a bridge/deck floor. |
| `waterLevel` | `() => number` | Current world water height in metres. |
| `steer` | `(a: Animal, yaw: number, speed: number, turnRate: number) => void` | Ground steering: yaw in radians (0 faces +Z), speed in m/s, maximum turn rate in rad/s (further capped during an attack). Avoids trunks, slopes, edges and water; uses nav avoidance when the manager enables `navSteer`. Sets motion. |
| `flight.steer` | `(a: Animal, yaw: number, speed: number, altitude: number, turnRate?: number) => void` | Sets flight target altitude in metres under `flight.above`, heading and speed, without ground/nav avoidance. Default maximum turn rate 2.5 rad/s. Requires a species `flight` declaration. |
| `pathYaw` | `(a: Animal, tx: number, tz: number, every?: number) => number` | Radian heading to the next ground-nav path corner. Replans after goal movement >2 m or `every` seconds (default 1); limited to 8 plans per manager frame. No nav/path means straight heading. Not aerial routing. |
| `confine` | `(a: Animal) => void` | Ground containment: backs out of water, clamps XZ inside chunk edges and pushes off trunks. Do not use as aerial obstacle avoidance. |
| `reach` | `(a: Animal) => boolean` | Exactly `canReach(a, ctx.player)`: WORLD occlusion, with no distance, facing, navmesh or ground-connectivity test. Works for a flyer as well as a ground creature. |
| `claim` | `(a: Animal) => boolean` | Takes/retains an attack token; false means wait. Without a registered finite cap it returns true. The manager reclaims a custom thinker's token when its attack presentation ends (`attackPhase < 0`), dies or hides. |
| `mayAttack` | `(a: Animal) => boolean` | Checks for a free token or this Animal's held token without taking one; unlimited/unregistered policies return true. |

**`canReach` does not query navigation.** Both it and `ctx.reach` ray from the target feet plus 1.2 m to the
creature's scaled body centre (averaged with head height when body height exceeds 0.9 m), with slack equal to the
scaled body radius plus 0.1 m at the creature. Other creatures and sensors do not block this WORLD-only ray. With no physics world
they return true; ranged shards do not unconditionally bypass cover. Use `ctx.reach(a)` for a flyer's strike cover
callback, or `canReach(a, feet)` for an explicit feet target. Passing an already elevated chest point to `canReach`
adds another 1.2 m. Neither helper proves a ground path or a clear flight trajectory.

**Strike context (`StrikeContext`, G20).** The shard constructs this context; the manager does not fill it in.
A point is `{ x: number, y: number, z: number }` in world metres. Keep `target` and `origin` current on body ticks.

| Field | Type | Meaning |
|---|---|---|
| `actor` | `StrikeActor` | Live attacker: `position` (world point), `alive` (boolean), `scale` (dimensionless number), `yaw` (radians), plus `startAttack(seconds)`, `cancelAttack()` and `setMotion(yaw, speed, turnRate)`. An Animal supplies these ports. |
| `target` | world point | Point tested by the shape and selection range. A sphere tests this point, not a player capsule; choose feet or a copied chest-height point deliberately. |
| `airborne?` | `boolean` | **Target's** airborne state, supplied by the shard, not the flyer's state. Only `eligibility.jumpDodges: true` reads it: `true` rejects contact, omitted/false does not. It changes no distance, shape, steering or cover rule. |
| `origin?` | world point | Override for shape-distance/angle tests (default `actor.position`). Does not replace the actor point in `pick`'s range test or `eligibility.maxDy`, or the committed lane endpoints. |
| `ringRadius?` | `number` | World-metre expansion added to ring inner/outer radii; default `motion.speed * runner.time` (or 0). |
| `canReach` | `() => boolean` | Cover check at contact, after shape/eligibility. Called unless `spec.tags` contains `cover.exempt`. It is not checked by `pick`. |
| `hit` | `(spec: StrikeSpec) => void` | Apply damage/presentation for the accepted contact, e.g. `ctx.hurt(spec.damage)`. The runner does not apply `damage` itself. `update` consumes its one hit per active window even if this callback's damage is vetoed downstream. Direct `contact` calls have no one-hit latch. |

`StrikeSpec.eligibility` is optional and applies to contact (including alternative shapes), **not** selection:

| Field | Type / unit | Rule |
|---|---|---|
| `maxDy?` | `number`, metres | Reject when `abs(target.y - actor.position.y) > maxDy`; equality passes. No actor scaling or `origin` override. Author a nonnegative value; there is no validation. Omitted means no vertical limit, including for XZ shapes. |
| `jumpDodges?` | `boolean` | Only `true` combined with `ctx.airborne === true` rejects contact. No automatic player-grounded lookup. |

`pick` filters only cooldown and range, then chooses the greatest finite `weight(ctx)` (list order breaks ties).
Sphere range uses 3-D actor-to-target distance; other shapes use XZ distance. Selection range is unscaled even
when a contact shape uses `units: 'actor'` (scale) or the omitted default (`max(1, actor.scale)`);
`units: 'world'` uses scale 1. Use `weight` or brain logic for any selection-time cover/height/jump restriction.
Ground XZ shapes otherwise ignore target height; a sphere measures 3-D contact distance from `origin`.

**Steering without a navmesh.** `ctx.steer(animal, yaw, speed, turnRate)` repels trunks and, on authored
terrain (including mixed worlds), avoids analytic wet/steep ground and chunk edges. When `ground.terrain` is
absent (`ground.structures: true`), it preserves the requested heading with trunk repulsion only: the analytic
−1,000 m field is not a navigation surface, and the body samples WORLD floors for support. Steering does not
avoid platform edges. A brain that needs ledge avoidance can probe
`floorBelow(app.physics, x, z, fromY, maxDrop)` through the plugin’s app closure (when physics is non-null)
before choosing its yaw; pass the creature feet Y + 1 as `fromY` and the allowed step-down
plus 1 as `maxDrop`. A missing floor means no support ahead. The normal body collision motor still resolves
walls; navmesh steering, when a mesh exists, is unchanged.

**Flight.** Declare `flight: { altitude: 17, above: 'ground', climbRate: 7, diveRate: 28 }` on the species.
In `act`, call `ctx.flight.steer(animal, yaw, speed, altitude, turnRate?)` (or `animal.fly` with the same arguments).
The body owns position, heading and vertical motion; animation changes bones only. `above` defaults to `ground`:
the engine queries WORLD physics below the flyer about every 0.2 seconds, smooths the sampled floor between queries,
and adds the requested altitude. A missing floor or one more than 200 metres below uses world altitude.
Use `above: 'world'` to fly over a void at an absolute height. Climb/dive rates cap vertical movement;
species without `flight` retain their ground body. Dead flyers descend to the sampled floor (or keep falling over a void).
`bank` (radians, 0 to π/2, optional) rolls a live flyer into its turns by the coordinated-turn angle atan(speed × yaw rate / g),
capped at `bank`; without it the body flies level. A live flyer never tilts to the slope of the ground below it.

**Lock eligibility.** `SpeciesRow.lockable?: boolean` controls LOCK and target taps for any authored species.
Set `lockable: true` on a ground species to opt in; omitted ground rows default to false. Omitted flight rows
retain their lockable default; explicit `false` opts out even with `flight`. `animal.lockable` exposes the
resolved row value to `AimTarget`; synthetic targets declare the same `lockable` field themselves.
All previously lockable original species, the Storm Titan heart and practice dummies declare `true`, preserving
original-four behavior without a kind allowlist. Eligibility is independent of `aggressive`; alive/visible,
range, cone, line of sight and weapon `ui.lockOn` checks still apply. `flight.lockRange` remains the finite,
positive acquire distance in metres (24 m when omitted), with release at 1.5×; ground distance and pitch are unchanged.

Flight bodies default to lockable through LOCK and target taps regardless of the species kind. `animal.flying` exposes
that capability to `AimTarget`; `animal.lockRange` reads `species.flight.lockRange`. The flight default is **24 m**
(twice the ground acquire range), measured in 3-D from the eye to the body edge; release is at **36 m** (1.5×).
Set `flight.lockRange` to a finite positive distance in metres to tune a species; its release stays at 1.5×.
The aim cone and WORLD line of sight use the live body point in 3-D, including high targets. Camera assist uses
the player’s full ±1.45 rad pitch envelope with the existing easing/rate caps; it retains heading directly overhead
and caps all flyer tracking (including movement of the player) so a dive cannot snap the camera. The reticle
projects the live body each frame. Ground eligibility, horizontal range, pitch clamps and movement feed-forward
remain unchanged. Lock-on still requires a weapon with `ui.lockOn: true` and obeys Lock-on camera / Auto re-lock.

A `StrikeSpec` is `{ id, shape, windup, active, recover, cooldown, range, damage, tags, weight, units?, alternatives?, motion?,
eligibility? }`. Shapes: `arc` (radius, halfAngle), `lane` (length, width), `ring` (inner, outer), `wedge` (length,
halfAngle), `point` (radius), `sphere` (radius). A sphere tests three-dimensional distance from the live actor
or `ctx.origin`, obeys normal cover and eligibility rules, and lands once per active window. Its selection `range`
is also three-dimensional. `motion: { track: 'lead', speed, overshoot }` commits its horizontal dive heading;
the flight brain supplies altitude. The template's blob:

```ts
export const BLOB_STRIKES: readonly StrikeSpec[] = [
  { id: 'template.blob.bump', shape: { kind: 'point', radius: 1.8 }, windup: 0.7, active: 0.15, recover: 0.8, cooldown: 1, range: 2, damage: 8, tags: ['creature.greyBlob'], weight: () => 2 },
  { id: 'template.blob.lane', shape: { kind: 'lane', length: 5, width: 1.4 }, windup: 1, active: 0.6, recover: 1, cooldown: 3, range: 6, damage: 12, tags: ['creature.greyBlob'], motion: { speed: 5 }, weight: () => 1 },
];
export class GreyBlobBrain extends CreatureBrain<'idle' | 'fight'> {
  override think(ctx: ThinkCtx): void { /* pick a strike when in range */ }
  override act(ctx: ThinkCtx): void { this.strikes.update(ctx.dt, this.context(ctx)); /* steer */ }
}
export const GREY_BLOB: SpeciesRow = { id: 'template.creature.greyBlob', kind: 'greyBlob', label: STRINGS.blob, aggressive: true,
  variants: [{ id: 'grey', label: STRINGS.blob, weight: 1, rarity: 'common', scale: [1, 1], hp: 60 }],
  think: (a, ctx) => { brain(a).think(ctx); }, act: (a, ctx) => { brain(a).act(ctx); } };
```

**Short flyer example.** A species with `flight.above: 'world'` can use this body callback after its own
approach/circle brain has brought it into swoop range. Keep one `StrikeRunner` per Animal. The sphere targets a
copied chest point; reach still receives the original feet. Airborne is omitted because this swoop does not grant
a jump dodge. This simple non-lane sphere leaves horizontal/vertical movement to the flight brain:

```ts
import { type Animal, type ThinkCtx, type StrikeContext, type StrikeSpec, StrikeRunner } from '@wildshard/engine';

const SWOOP: StrikeSpec = {
  id: 'example.ray.swoop', shape: { kind: 'sphere', radius: 1.6 },
  windup: 0.3, active: 0.2, recover: 0.8, cooldown: 2,
  range: 2.2, damage: 14, tags: ['creature.exampleRay'], units: 'world', weight: () => 1,
};
function swoopBody(a: Animal, ctx: ThinkCtx, strikes: StrikeRunner): void {
  if (ctx.calm) { strikes.cancel(); a.cancelAttack(); return; }
  const chest = ctx.player.clone(); chest.y += 1.2;
  const strike: StrikeContext = {
    actor: a, target: chest, canReach: () => ctx.reach(a), hit: (spec) => { ctx.hurt(spec.damage); },
  };
  ctx.flight.steer(a, Math.atan2(chest.x - a.position.x, chest.z - a.position.z), 5, chest.y, 4);
  if (!strikes.busy) {
    const next = strikes.pick([SWOOP], strike);
    if (next !== null && ctx.reach(a) && ctx.claim(a)) strikes.start(next, a, chest);
  }
  strikes.update(ctx.dt, strike);
}
```

**Encounters.** `app.encounters` (`EncounterRegistry`, also exported as `EncounterService`) runs bosses, elites and
spawn tables. Register the ids in `kit` with `ctx.rows.encounter` / `ctx.rows.spawnTable`, then in `play`:

| Call | What it does |
|---|---|
| `encounters.boss(id, brain, scope)` | binds a `BossBrain`; it disarms with the scope |
| `encounters.elite(id, brain, scope)` | binds an `EliteBrain`; it despawns with the scope |
| `encounters.spawn(tableId, scope, { create, retire })` | a `Spawner` over a `SpawnTableRow` |

| Export | What it is |
|---|---|
| `BossBrain`, `BossDefinition`, `BossScript`, `BossPorts`, `BossPresentation`, `BossSaved`, `BossState`, `BossDef` | the boss runtime: intro, HP-threshold phases, checkpoint and retry, victory. Your `BossScript` supplies the fight |
| `EliteBrain`, `EliteDefinition`, `EliteActor`, `ElitePorts` | the elite runtime: lair, aware / leash radii, spawn / despawn |
| `EncounterDefinition`, `SpawnTableRow`, `SpawnEntry`, `SpawnContext`, `SpawnPoint`, `Spawner` | rows and spawning |
| `setEliteBrain`, `setEliteDamage`, `setEliteAct`, `eliteThink`, `eliteDamageMul`, `eliteAct` | elite hooks on the legacy creature manager (ports) |

```ts
const elite = ctx.app.encounters.elite('template.elite', new Greyback(ctx, player), ctx.scope); elite.spawn();
const boss = ctx.app.encounters.boss('template.boss', new BigBlob(ctx, player, blob), ctx.scope); boss.arm();
ctx.answer('death.checkpoint', (value) => boss.onPlayerDeath() || value === true);
```

**Ports for the legacy creature manager:** `AnimalManager`, `Animal`, `HuntTuning`, `registerSpecies`, `speciesDef`,
`variantDef`, `hasSpecies`, `SpeciesDef`, `VariantDef`, `AnimalSpecies`, `BoneDef`. A species carries its own fight numbers
(`chargeWindup`, `ringRadius`, `trampleRadius`); `setCreatureSoundDefaults` (`CreatureSoundDefaults`) installs the calls a
species with no `sounds` falls back on, by temperament (the kit's `installKitSpecies` does; E405). `runtime.play.animals.spawn(kind,
x, z, yaw, variant?, placement?)` and `.retire(animal)` are how the template spawns today. `variant` is an id
or a weighted list of ids. Optional `placement` has shape `{ y?: number; fromY?: number }`, in world metres.
Without `y`, spawn queries the first non-sensor **WORLD** floor below `(x, fromY, z)`; creature bodies are ignored.
`fromY` defaults to one metre above the greater of the manifest's `spawn.y` and the local analytic terrain height.
Use `fromY` to select a storey in a stacked world. The downward search reaches at least 201 m and extends to one
metre below the analytic floor; no hit (or no physics) falls back to that analytic height (§6: −1000 m for a
structures-only world). The tagged terrain heightfield keeps exact analytic wildlife heights, preserving ordinary
terrain movement; decks and other WORLD surfaces use their collider height. Ground creatures continue sampling
below their current height after spawn, so they remain on a platform and lose support when they leave its edge.
A species with `flight.above: 'ground'` starts at the resolved floor plus `flight.altitude`; `'world'` starts at
that absolute altitude. Explicit finite `y` is the initial world feet height, overriding both floor placement
and the flight offset; normal ground/flight motion resumes on update. `fromY` must also be finite.

```ts
// Spawn below the upper deck, on the first WORLD floor under y=24.
runtime.play.animals.spawn('my-shard.goat', x, z, yaw, 'common', { fromY: 24 });
// Script an exact initial world height (no additional flight offset).
runtime.play.animals.spawn('my-shard.wisp', x, z, yaw, undefined, { y: 32 });
```
**Species look helpers:** `loft`, `tube`, `skinPlain`, `S`, `boneIndex`, `srgb`, `mix`, `speciesSstep`, `paintNoise`,
`setShag`, `isLowPoly`, `registerToonPaint`, `toonPaint`, `paletteColors`, `Paint`, `ToonPaint`, `SpeciesRGB`,
`setShapeFn`, `Station`, `crestSpikes`, `NO_FUR`, `lookAngles`, `smooth01`, `bump`, `step`, `rigClamp`, `squashBody`.

## 20. The game layer (`@wildshard/game`)

| Part | Exports | Notes |
|---|---|---|
| Shard | `ShardPlugin`, `ShardContext`, `GameServices`, `GameRows`, `GameRowMap`, `BagVerbs`, `shardContext`, `toLevelSpec`, `ShardManifest`, `ShardSword`, `ChunkTerrain`, `RGB`, `Vec2`, `ShardRuntime`, `ShardWorld`, `game`, `findShard`, `findChunk`, `getActiveChunk` | §6, §7 |
| Bag and items | `ItemRow`, `RegisteredItemRow`, `normalizeItemRow`, `registerItemRow`, `ItemId`, `ITEMS`, `isItemId`, `renderFinds`, `GearLoot`, `CosmeticSlot`, `FindsView` | `ctx.rows.item(row)`; an item row's `travels` flag (default off) carries it between shards |
| Coins and loot | `installLoot`, `ScopedLootHost`, `ScopedLoot`, `LootPresentation`, `LootShop`, `CoinBurst`, `registerLootTable`, `getLootTable`, `rollLoot`, `LootTableRow`, `LootContext`, `onCreatureDeath`, `DEATH_ORDER`, `CreatureDeathSource`, `ShopPanel`, `ShopGood`, `ShopState`, `ShopOpts` | the purse is per shard (`purseSave`) |
| Gear | `Owned`, `OWNED`, `isOwnedId`, `isCosmetic`, `OwnedId` | owned gear and cosmetics |
| Compendium and feats | `installCompendium`, `CompendiumHost`, `CompendiumWallPort`, `AchievementDef` | `ctx.rows.compendium(row)`, `ctx.rows.feat(row)` |
| Quest UI | `QuestState`, `QuestMarker`, `NpcDef`, `DialogueBox`, `ObjectiveLine`, `NpcTalk`, `QuestChip`, `LiveMarker`, `RewardCaption`, `ProgressSink` | the engine quest core is §17 / below |
| Completion | `ShardComplete`, `setCompleteEntry`, `ShardCompleteData` | the end card |
| Saves | `progressSave`, `inventorySave`, `purseSave`, `ownedSave`, `bountySave`, `compendiumSave`, `bossesSave`, `elitesSave`, `shardSave`, `saveSlug` | §9 |
| Travel | `travel`, `bindTravelInventory`, `applyTravelCarry`, `consumeTravelHandoff`, `TravelRequest`, `TravelHandoff` | a page-reload travel today |
| Cosmetics | `BodyShadow`, `installBodyShadow` | `manifest.bodyShadow` |
| Template | `installTemplateDebug` | the Debug ▸ Developer tools entry that opens a hidden level |

`CosmeticsLocker<Slot, Row>` (`@wildshard/game`) owns registered cosmetics, validates saved ownership and slot matches, and provides `own`, `wear`, `toggle`, `wearing`, `entries`, `version` and `onChange`. A `CosmeticProfile` supplies a slot selector, save slot and optional `autoWear` for empty slots. `SkinLocker` is the weapon-material profile (`SkinDef.weapon`), using the existing per-shard `skins` save with manual wear; Nalati supplies its own saved skin rows and auto-wear policy.

The game's quest wiring sits on the engine's quest core: `QuestState`, `QuestLine`, `lineFor`, `validateQuest`,
`CHIP_MAX`, `QuestDef`, `QuestStep`, `QuestMarker`, `NpcDef`, `DialogueEntry`, `QuestChip`, `NpcTalk` (load the quest views lazily with `import('@wildshard/engine/quest/view')`)
(all `@wildshard/engine`). The template's quest:

```ts
const quest = new QuestState({ id: 'template.quest', title: STRINGS.quest, completeFlag: 'template.complete', steps: [
  { id: 'hut', objective: STRINGS.reach, done: { all: ['template.hut'] } },
  { id: 'blob', objective: STRINGS.beat, done: { all: ['template.blob'] } },
] }, flags, ctx.app.events, ctx.scope);
quest.onComplete = () => { burst.spawn(player, 5, onCoin, () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); }); };
```

**One-call quest presentation (E383).** `installQuestPresentation(ctx, quest, options?)` from `@wildshard/game` accepts
a `QuestState`, `QuestDef`, or `PresentedQuestDef` whose steps have `title`, `target: { position: Vector3,
label, short?, npc? }` and the normal `done` flags. It reuses Wendell's `QuestChip`, `DialogueBox`, `NpcTalk`,
saved discovery and held reward view. One scoped update system drives the objective chip with metres and bearing,
active-step minimap diamonds, styled cyan world pins, MAP card, step-complete / objective toasts and reward caption.

Simple targets are discovered within 12 m (`seen:<quest>.<step>`); `places` supplies authored `PlacePoint` radii
and quiet arrivals. A target's `npc` supplies `npc: NpcDef`, head position `at`, talk `label`, `speaker: { talking }`
and optional `radius`, `onOpen` / `onDone`. Its prompt is active during that step. `options.npc` is a persistent
giver, including the intro. The installer stows the weapon during dialogue; models and gestures stay in the shard.

`flags` defaults to the existing state's public `flags`, or a saved `Flags(ctx.manifest.slug)` for a definition.
POI-local markers need `place(at)`; simple target positions need no resolver. `introTitle`, `stepToast`,
`stepCompleteToast` (`false` disables it), `completeToast`, `chip` and `markers` retain authored copy and leftovers.
`worldPins`, `mapMarkers` and `minimapMarks` can be disabled individually.

The default completion holds the player and shows the shared seven-second caption once; a completed save does
not replay it. `reward: false` disables that hold. An authored `QuestRewardSpec` supplies `kicker`, `title`,
`subtitle`, `when()`, optional camera `at`, `yaw`, `pitch`, day-cycle `phase`, `holdSeconds`, and `finish()`.
It uses Driftwood's exact 2.5 s camera ease, shortest yaw, 3.5 s forward clock ease and caption. Award loot / raise
the reward flag in `finish()`; return `true` if a completion card takes camera ownership, otherwise `false` or
`undefined`. `QuestRewardBeat` exposes the same beat for authored finales with a `QuestRewardHost` / player port.

`QuestPresentation` returns `quest`, `chip`, `markers()`, `places`, `reward`, `update(dt, t)` and `dispose()`.
Disposal removes views, prompts and overlays, removes transition observers and releases an active reward hold.
A state created by the installer is unsubscribed; an external state remains caller-owned. `QuestPresentationContext`
and `QuestPresentationHost` are structural ports; ordinary `ShardContext` works. `presentQuest(host, state, options)`
is the same wiring for older adventures that own their frame order: call `update` yourself. Automatic presentation
runs only during play; discovery / presentation skip practice rooms.

`FullMap.addPois(source)` / `addQuest(source)` and `Minimap.addMarks(source)` return removers. These overlays
coexist with shard places and loot charts (`setPois` / `setMarks`); quest cards can retire in any order.
`QuestState.observe({ step?, complete? })` returns a remover and preserves authored `onStep` / `onComplete` callbacks.

```ts
import { installQuestPresentation } from '@wildshard/game';
import { Vector3 } from 'three';

const view = installQuestPresentation(ctx, {
  id: 'template.bell', title: STRINGS.quest, completeFlag: 'template.quest.done',
  steps: [{ id: 'bell', title: STRINGS.findBell, done: { all: ['template.bell.rung'] },
    target: { position: new Vector3(12, 4, -20), label: STRINGS.bell } }],
});
// In the shard's bell interaction; every presentation surface follows this flag.
view.quest.flags.set('template.bell.rung');
```

## 21. The kit (`@wildshard/kit`)

The kit holds content that 2+ shards use (the rule of two). Content one shard uses stays in that shard.

| Folder | Exports |
|---|---|
| `weapons/melee` | `Melee`, `MeleeProfile`, `ViewmodelFeel`, `meleeActor`, `Sword`, `swordEvents`, `buildSword`, `swordMaterial`, `SWORD_WOOD`, `SWORD_IRON`, `key`, `COMBO`, `HEAVY`, `REST`, `CHARGE`, `SPRINT`; rows `SWORD`, `WOODEN_SWORD`, `IRON_SWORD` |
| `weapons/bow` | `Bow`, `BowWorld`, `BowOptions`, `BOW`, `BowProfile`, `BowStyle`, `BowView`, `GripPose`, `ARROW_LEN`, `POSE`, `VM_SHADE`, `buildArrowGeometry`, `arrowKind`, `arrowMaterial`, `bowSpecimen`, `QUIVER_MAX`, `AIM_ZOOM`, `AIM_VM_ZOOM`, `AIM_SWAY`, `AIM_SPREAD`, `AIM_IN` |
| `weapons/crossbow` | `Crossbow`, `CROSSBOW_PROFILE`, `CrossbowProfile`, `PLAIN_BOLT`, `MAX_BOLTS`, `buildCrossbow`, `buildBolt`, `boltFlightStep`, `BoltMod`, `crossbowDisplayModel` |
| `weapons/firearm` | `Firearm`, `Rifle`, `RifleParts`, `RifleOptions`, `buildRifleParts`, `AR15`, `FirearmProfile` |
| `weapons/thrown` | `Thrown`, `ThrownProfile` |
| `weapons/ui` | `SWAP_GLYPHS` |
| `viewmodel` | `WeaponHands`, `HandHold`, `BUCKSKIN`, `HANDS_MATERIAL`, `coatMaterialParams`, `holdDef`, `withHunterPalette`, `blendGrip`, `gripPose`, `ARM_CLIPS`, `SWIM_CLIPS`, `armClipNames` |
| `species` | `BOAR`, `BOAR_TUNING`, `BOAR_LOOK`, `BOAR_PALETTE`, `BEAR`, `BEAR_TUNING`, `BEAR_LOOK`, `BEAR_PALETTE`, `installKitSpecies`; `installKitIcons` (the creature, item and weapon icons, moved from the engine, E405); `installKitProps` (the interactables' props and models, `INTERACT_PROPS`, moved from the engine, E417); `installKitPickups` (the pickup looks a pickup row names: flint, coin, sea glass, resin, token, glyph shard; moved from the engine's interactables, E405) |
| `effects` | `STARTER_EFFECTS`, `STARTER_CHOICES`, `StarterChoice`, `starterId`, `installStarterEffects` |
| `npc` | `NpcRig`, `NpcRow`, `NpcModel`, `NpcFace`, `rigLegs`, `legRigOf`, `legBones`, `legPose`, `footPlan`, `LEG_BONE_NAMES`, `WALK`, `LegBuilt`, `NpcRigProfile`, `fitNpcFigure`, `mergeNpcFigures`, `NpcFigureFrame`, `NpcFigureBones`, `NpcFigureRig`, `stepNpcFigure`, `npcFigurePose`, `NpcFigureState`, `NpcFigureMotionProfile`, `faceHead`, `loadFaceHead`, `FaceHead` |
| `tools` | `Hoverboard`, `HOVERBOARD_TOOL` (all four shards; its `board` movement mode stays engine) |
| `weather`, `looks` | `rainCurtain`, `RainProgram`, `RainCurtainSpec`, `fogGLSL`, `loadParticles`, `Particles`, `loadGrassField` |
| `audio` | `sharedWeaponVoices`, `createForestAudio`, `installForestAmbience`, `installSilentScore`; creature voices `vocal`, `windup`, `CREATURE_VOICES`, `CreatureVoice`, `CreatureWindup` (boar, crab, monkey, the drowned sailor; moved from the engine, E405) |
| `bag` | `KIT_ITEMS` |

Kit species take a plain `{ ...BOAR, variants: [...] }` spread to add a variant (the template's Greyback elite).
`SwordWorld`, `SwordRig`, `SwordArms`, `SwordFraming`, `SwordMoveSet` are re-exported from `@wildshard/engine` for the melee family.

## 22. Explore, practice, playgrounds

| Export / field | What it is |
|---|---|
| `ctx.playground(spec)` (`PlaygroundSpec`) | `{ id, title, blurb, icon, art?, load }`: a feature playground listed in Explore. `load` returns the class |
| `Playground`, `PlaygroundHost`, `PlaygroundId` | the interface a playground implements, and what it gets: `registry`, `player`, `game` |
| `manifest.explore` (`ExploreSpec`) | Explore's art for this shard: `{ art: { world, models, sets, practice } }` |
| `manifest.roster` | `() => Promise<RosterEntry[]>`: the Model Explorer cards (`live(model)`) |
| `Explore`, `ExploreMode`, `TrainingArena`, `practiceRoom` | Explore and the practice arena (ports) |

The template's jump course:

```ts
ctx.playground({ id: 'template.jump', title: STRINGS.jump, blurb: STRINGS.jumpBlurb, icon: '',
  load: async () => (await import('./playground/JumpCourse')).JumpCourse });
export class JumpCourse implements Playground { readonly id = 'template.jump'; enter(): void { … } exit(): void { … } }
```

A playground's pieces are registry pieces with `active: () => this.entered`, so they collide only while it is open.

## 23. Analytics, session health, capture, debug

| Export / verb | What it is |
|---|---|
| `AnalyticsSink`, `AnalyticsMap`, `AnalyticsEvent`, `AnalyticsBatch` | anonymous batches to `api/`. Events: `death.cause`, `quest.step`, `weapon.used`, `level.time`, `boss.attempt` |
| `tap`, `ambientTick` | harness taps (the sound log, ambient ticks) |
| `ctx.debug.expose(name, value)` | puts a handle on `window.__wildshard.shard[name]` for captures and tests. A shard never writes to `window` itself (`wildshard/shard-sandbox`) |
| `ctx.debugRow(row)` (`DebugRowSpec`) | a Debug menu row owned by the level, shown only on it |
| `registerGlobalDebugAction`, `GlobalDebugActionSpec` | a one-shot app-wide Debug action (the template's entry, B82) |
| `setting`, `getSetting`, `getNumber`, `onNumber`, `onSettingChange`, `OptionValue`, `MusicStyle` | the engine's saved options. A shard reads only keys it owns (`shard-sandbox`) |
| `ENGINE_STRINGS`, `engineString`, `installEngineStrings`, `EngineStringKey` | the engine's string table |
| `publicBytes`, `assetVersions`, `musicManifests`, `sfxManifests`, `bootPacks`, `installAssetTables`, `AssetTables`, `PackDef`, `PackPart`, `PackFile` | the app's asset tables (E405 E415): every shipped file's size and `?v=` hash, the music / sound-effect manifests and each level's boot pack. They list the game's files, so they are the game's (`src/game/boot/*.generated.ts`, written by `vite/gen.ts` and `scripts/bake-packs.mjs`); `src/identity.ts` installs them with the identity, `scripts/bake-loader.mjs` for Node tools (a table not generated yet installs empty). The engine reads them only through these accessors, at call time |
| `installAppIdentity`, `appIdentity`, `AppIdentity`, `EngineProbe`, `HarnessPins` | the app the engine runs in (E405 E414): its name, wordmark and tagline, the save keys' prefix and export format, the file-name prefix, where the probe is exposed and where the harness pins are read. The game's (`src/game/identity.ts`) is installed by `src/identity.ts`, the first module every page entry runs; nothing has a default, and a save with real storage throws without one rather than writing under another prefix |
| `ctx.strings(table)` (`StringTable`) | registers your table; every player-facing line comes from it |

**A Debug row** (`DebugRowSpec`): `{ id, group, label, choices: [{ value, text }], initial, change(value), reload?,
note, ask: 'E<n>', reviewBy: 'YYYY-MM-DD' }`. Groups: `look · cover · sky · audio · combat · creatures · perf ·
loading · tools` (Look · Ground cover & foliage · Sky & weather · Audio · Combat & weapons · Creatures & NPCs ·
Performance · Loading & memory · Developer tools). The value is a `device` save (`debug.plugin.<level>.<id>`); `change`
runs on a pick and once at load when the saved value differs from `initial`.

```ts
ctx.debugRow({ id: 'template.oil', group: 'tools', label: STRINGS.debug,
  choices: [{ value: 'keep', text: STRINGS.keep }, { value: 'refill', text: STRINGS.refill }], initial: 'keep',
  change: (value) => { if (value === 'refill') lantern.oil = 1; }, note: STRINGS.debugNote, ask: 'E357', reviewBy: '2026-12-01' });
```

Every new `ctx.debugRow` call raises the Debug-row count that `lint/ratchet.json` caps (`debugRows.max`, with the ask
in `raisedBy`). `manifest.debugOptions` opts a level into engine rows that already exist (`['clockSpeed', 'ghosts']`).

**Capture.** `app.clock.setCapture(fps)` plus seeded streams make a frame-exact capture. The only URL params are the
`harness` allowlist in `lint/url-params.json`; never add one (AGENTS.md "No URL switches").

The kit composition root installs the gold coin geometry recipe with `installCoinModel()` from
`@wildshard/game/loot/coinModel`; loot simulation imports only the recipe port, without geometry construction.

### Embedded simulation

`@wildshard/engine/sim` exports `SIM_API_VERSION`, `SimLevel`, `SimCommand`, `SimHost` and `createSimHost`.
The embedding root loads Rapier WASM and supplies it to `createSimHost(level, { rapier })`; plain level data
defines the heightfield, player, creature identities, strike timings and quests. `step(command)` advances one
60 Hz tick; `advance(seconds, command)` retains its fixed-step accumulator. Each host owns its physics,
clock, RNG, events, entities, damage pipeline, flags, quest progress and timers. `onStep(id, run, adapter?)`
registers scoped per-instance behaviour with optional continuation state; `SimSlots` provides typed script
memory, module globals, quest data and ledger dedupe slots for the F1 adapters. `dispose()` frees the host.

`@wildshard/engine/sim/snapshot` exports `SIM_SNAPSHOT_VERSION`, `SimSnapshot`, `snapshotSimHost(host)`
and `restoreSimHost(level, { rapier }, saved, install?)`. Capture between fixed steps; the versioned JSON state
includes entities and strikes, queued events, timers and the accumulator, RNG and clock continuations,
the complete Rapier world and motor contacts, flags and quest progress, the four `SimSlots`, and each
registered adapter. Actor and live-position references resolve by stable identity in the restored host.
Restore boots a fresh matching level and invokes `install` to register its scoped callbacks and adapters;
authored content and functions stay outside the snapshot. Engine, snapshot and level fingerprints must match.
Use the returned host for the recorded suffix and dispose it normally. The sim-level fight fixture proves
identical hashes at five checkpoints after a JSON round trip, including pending damage and moving contacts.

The native Node witness is `node --import ./scripts/sim-node-loader.mjs test/fixtures/sim-level/run.mjs`.
It boots JSON-round-tripped kit species and iron-sword data, runs 10,000 fixed ticks with real Rapier
collision, and proves damage and quest completion without a renderer, DOM or active app.

## 24. Lint rules and the ratchet

| Rule | What it refuses | Status |
|---|---|---|
| `wildshard/layer` | import direction (engine < game < kit < shards); shard ↔ shard; a file or import outside the four layers | hard (`.oxlintrc.json`, E405 AG28) |
| `wildshard/public-index` | a cross-layer import names a module the layer's package does not export (`@wildshard/engine/x/y` does not resolve at all; a relative path into another layer is refused too); a module the layer's `package.json` `exports` lists is public | ratchet (per file) |
| `wildshard/no-reexport` | `export … from` (or `export *`, or exporting an imported binding) of our own modules: no barrels; a third-party re-export (a bundler shim) passes | hard (`.oxlintrc.json`, E434) |
| `wildshard/engine-words` | Wildshard vocabulary (shard names, species, items, the word "shard") in engine code; comments are not counted. A wire contract's field may keep the name `shard` (telemetry tags, reports, the harness probe, a model id) only as a property name or key, only in the files `lint/ratchet.json` `allow['wildshard/engine-words']` lists with the reason (E405, Jake). Engine copy says "level" and the game supplies its word (`s_level_word`) | hard (`.oxlintrc.json`, E405 LAYER-PURITY) |
| `wildshard/shard-names` | the game and the kit name no particular shard: slugs, display names, camelCase forms, distinctive stems and shard-declared ids, from `lint/shard-words.generated.json`; comments and ordinary words (pine, driftwood) pass | hard (`.oxlintrc.json`, E405 LAYER-PURITY) |
| `wildshard/no-shard-branch` | outside `src/shards/`: a branch on a slug or a style (`slug ===`, `style ===`, `isNalati`, a slug literal in a comparison or `case`) | hard error |
| `wildshard/no-level-identity` | outside `src/shards/`: comparing, switching on, or keying a table by a level's `id`, `slug`, `kitLook`, `style`, `biome` … Pass a capability or a data strategy instead | ratchet (4 at HEAD) |
| `wildshard/shard-sandbox` | in `src/shards/`: `window` / `globalThis` / `self` reads or writes, window or document input listeners, `setting(key)` for a key you don't own, an `/assets/…` path outside your `assetGlobs` and the shared folders | ratchet (new files at 0) |
| `wildshard/no-raw-save` | `localStorage` / `sessionStorage` outside the save store | hard error |
| `wildshard/shard-services` | a shard importing an engine page service (`app`, `saves`, `hudSlots`, `practiceRoom`, `lockOn`) instead of taking it from its ShardContext (AG12) | ratchet (the four original shards' 58 imports may only fall; a new shard starts at 0) |
| `wildshard/engine-internal` | a kit or shard import of a game-only `@wildshard/engine` export (`lint/engine-internal.json`: the session, boot, title and installers; marked "game only" in docs/api/ENGINE.md) — a shard asks for a ShardContext verb instead (AG6) | hard error |
| `wildshard/no-module-mock` | `vi.mock` / `doMock` / `resetModules` / `hoisted` / `importActual` in test/, api-tests/, drafts/test/: a test drives the real module through its seams (a class, a factory, an injected loader or port; E422) | hard error |
| `wildshard/no-raw-input` | DOM input listeners outside `src/engine/input`, including a helper call given `window` / `document` and an input event (AG18) | hard error |
| `wildshard/no-raw-shader-patch` | `onBeforeCompile` / `customProgramCacheKey` outside `src/engine/render` | hard error |
| `wildshard/no-raw-hud` | appending to `#hud` / `document.body` outside the HUD slots | hard error |
| `wildshard/no-raw-animation-mixer` | `new AnimationMixer` outside `src/engine/anim` | hard error |
| `wildshard/sim-no-render` | render / DOM imports in the simulation folders | hard error |
| `wildshard/no-active-chunk` | `getActiveChunk()` outside `src/game/shard/` | hard error |
| `wildshard/no-inline-ui-string` | player-facing literals in the engine | hard error |
| `wildshard/no-url-switch` | a query param not on the allowlist | hard error |
| `wildshard/no-raw-random-time` | `Math.random` / `performance.now` outside rng / clock | ratchet |
| `wildshard/no-global-listener-patch` | raw `addEventListener` / timers / rAF / body appends outside `src/engine/app` | ratchet |
| `wildshard/no-active-singleton` | `activeRegistry()`, `activePhysics()` … | ratchet |
| `wildshard/no-hook-chain` | `const prev = x.onFoo` hook chaining | ratchet |
| `wildshard/no-renderer-type` | `WebGLRenderer` outside `src/engine/render` | ratchet |

**How the ratchet works.** `lint/ratchet.json` holds `{ rule: { file: count } }`. Builders commit source only; the
serialized pusher measures and lowers debt from a clean HEAD export. A new file starts at 0; an increase warns in
pre-commit and requires an exact coordinator approval trailer in the generated commit before the gate accepts it.
A rule whose total reaches 0 still moves to `.oxlintrc.json` as a hard error. Allow lists, budgets and the Debug-row
cap (`debugRows`) are human-reviewed source policy and never regenerate. Historical allowances and SF2's
`lint/shard-coupling.json` remain shrink-only. See [GIT.md](process/GIT.md) for the receipt and source-only workflow.

**The other checks a shard meets**

| Check | When | What it checks |
|---|---|---|
| `scripts/precommit-guards.mjs` (`.githooks/pre-commit`) | every `git commit` | the commit's own files: oxlint, the custom rules against the ratchet, the shard layout when `src/shards/**` is touched, `gen-shards --check` when a manifest is touched |
| `tsc -b tsconfig.layers.json` (AG4) | `pnpm typecheck` (CI), the push gate | the layers as TypeScript projects (`tsconfig.engine.json` → `.game` → `.kit` → `.shards`, declarations to the gitignored `.tsc-layers/`): an import that reaches up a layer in any syntax (type-only, `import()` types, a JSON file) fails with TS6307. The shard list is the composition root's (`src/shards.generated.ts`, installed by `src/shardList.ts` into `src/game/shard/list.ts`); the game sees only `ShardSlug` (`src/game/shard/slugs.generated.ts`); content icons reach the game as data (`BagIcons` from the kit, a compendium skin's `icon`) |
| `scripts/gen-api.mjs` (AG21) | `pnpm test` | the public surface, generated: every `@wildshard/engine` / `@wildshard/game` / `@wildshard/kit` export and `ShardContext` member with its kind and first doc line in `lint/api-surface.json`, rendered to `docs/api/` (ENGINE, GAME, KIT, SHARD-CONTEXT). `--check` fails when stale, or when more lack a doc line than `lint/api-undocumented.json` allows (647, may only fall) |
| `scripts/check-graph.mjs` (AG7) | pre-commit (`--source-only --paths`), `pnpm test` (CI, push gate) | staged increases warn for exact coordinator approval in central regeneration; committed counts are checked from clean input. Shard reach and two-way pairs stay fatal; only the generated registry imports shard manifests, and a plugin loads only by `import()` from its own manifest |
| `scripts/gen-shards.mjs --check` (AG10) | push gate, `pnpm test` (`test/gen-shards.test.ts`) | the manifest contract: `load` is `() => import('./plugin')` and nothing imports `./plugin` statically; the manifest's static closure stays within `lint/manifest-closure-budget.json` (may only fall; `default` for a new shard); every `ShardManifest` field is read by the engine, the game or the tooling |
| `scripts/check-shards.mjs` (AG9) | pre-commit, `pnpm test` via `check-paths` | the folder layout in `lint/shard-layout.json`: required files, canonical folders, slug = folder name, `manifest.slug` = folder |
| `scripts/gen-shards.mjs --check` | gate | the generated registry and the shard word list are current |
| `scripts/check-lock.mjs` (`.githooks/commit-msg`) | every commit | the E357 lock: only reopened shards' allowlists, unless `E357-Lead: yes` |
| `scripts/check-paths.mjs` | `pnpm test` | no stale tool paths or empty globs |
| `test/manifests-node-safe.test.ts`, the shard contract tests | `pnpm test` | manifests import in bare node; a shard boots in the fake `Game` |
| `test/engine-docs.test.ts` | `pnpm test` | this file lists every export; SHARDS.md names the layout; every shard has a README |
| the gate (`.github/workflows/gpu-gate.yml`) | every push | one `macos-15` job per shard, from the registry: boot, walk, combat, the leak test, budgets |

## 25. Author SDK

`@wildshard/sdk` is the fifth workspace layer above the kit. Its public modules are the author boundary:
`@wildshard/sdk/version` defines `SHARDFILE_VERSION` (currently provisional v0). Public shard project files
(`shard.config.ts`, `data/`, `behaviour/`, `quests/`) import only the SDK or their own public files.
Trusted transition code in `runtime/` keeps legacy public engine/game/kit access; build-time generators never ship.
The SDK cannot import shard content. Each module owns its exports; there is no barrel.

`@wildshard/game/shardfile/loader` admits a browser product with `shardfileSource` or selects it with
`installShardfileProduct`; `browserShardfileOptions` supplies the verified origin-wide content cache. Trusted kit
recipes and item factories are injected by the composition root. The resulting manifest runs the ordinary Game
stages and borrows its player, physics and fixed-step driver. Terrain and props refine under scoped tile residency;
UI reads the same admitted script and item state. The SDK's client includes the platform's base audio assets.

## Appendix: every export

Generated from `lint/api-surface.json` (each package's exported modules). Each line is one module and the names it exports. The
sections above describe what to use; this list is the complete inventory.

The numeric script mechanism is documented in [SCRIPT-ABI.md](SCRIPT-ABI.md).
`@wildshard/engine/script/admission` validates imports, memory and structured fuel/depth guards
without executing bytes; `@wildshard/engine/script/abi` defines the versioned contract.
`@wildshard/engine/script/host` owns bounded module instances and complete snapshots;
`@wildshard/engine/script/effects` publishes validated numeric batches atomically.
`@wildshard/engine/script/queries` adapts read-only collision/navigation queries with stable numeric handles.


### Baked terrain (SHARD-PLATFORM SF9a)

`@wildshard/engine/world/terrainTileData` owns the bounded little-endian terrain codec and the triangle-diagonal height sampler. `@wildshard/engine/physics/terrainTiles` installs a critical collider heightfield in one local world and removes it with its scope. The SDK terrain baker emits 64 L0 and 16 L1 tiles from one shared 257² lattice, with ordered hand overrides applied before both rendering and collision. Linear RGB, geometric errors and the four 129-sample edges are baked data. Actual asset costs include decoded arrays, GPU geometry and L0 shadow draws. `@wildshard/game/shardfile/terrain` checks grid completeness, collider/render seams, edge agreement and conservative errors; the full SF15a loader consumes its optional terrain section.

**Terrain tile views (SF15a).** `installTerrainTile(bytes, { root, scope, material, shadow })` from `@wildshard/engine/world/terrainTileView` draws one admitted render tile (its wire bytes, or its `TerrainTileData` already decoded off the main thread, SF18b) as a mesh whose triangles split along the Rapier heightfield's diagonal (the drawn ground is the collider's ground), with grid normals that two neighbouring tiles light alike. The scope owns the geometry and removes the mesh; normals and colours are GPU-only after upload. Every tile but a coarse one hangs a size/16 skirt under its edges so a fine edge never cracks against a coarse neighbour. A tile casts whole: it opts out of E153's shadow splitter (`chunkShadowCasters`), because it is already one cascade-culling piece and its `castShadow` is the 80 m shadow disc's switch (split, a 62.5 m tile drew up to 64 always-casting pieces: SF16 measured 85 % of the M1 template's calls there). `maskTerrainTile(mesh, quadrants)` hides a coarse (L1, 17², 125 m) tile's quadrants in its one index buffer while fine tiles cover them (no allocation, no extra draw, no overlap). `coarseTileMask(root, x, z, scope)` from `@wildshard/engine/world/coarseTileMask` does the same for a coarse tile's props in the fragment shader, keeping instanced meshes instanced; its updater takes the hidden quadrants. The game's `clientViews` (`@wildshard/game/shardfile/clientViews`) wires these and `installDeclaredProps` into the loader's `ClientWorldViews`; `clientMaterials` compiles `look.materials` and the family looks, and `shardfileLook(look, assets)` hands an admitted LUT's bytes to `dataLook`.


### Declared water (SHARD-PLATFORM SF9d)

`@wildshard/engine/world/water/declared` compiles bounded local pools, seas and sloping stream paths into the existing `WaterBody` motor port. `@wildshard/game/shardfile/water` rejects nonfinite/out-of-cell data, duplicate ids, self-intersecting polygons and zero-length stream segments. The sea is last, preserving pool and stream surfaces in the registry. Each projection returns fresh bodies; normal level scopes own registration and unload. The real player fixture swims in a declared pool, wades on its shelf and leaves water at its boundary. No renderer or service is installed by importing these modules.


### Authoritative creature views (SHARD-PLATFORM SF3b forward bridge)

An `Animal` rig can bind once to its matching `AnimalSim` with `bindSimulation(sim)`. Its combat actor, health, feet position and commands then use that exact host creature. Render updates sample pose inputs into one reused buffer and never step the host, advance its attack timer or dispose its motor. Unbound legacy views retain their existing update path. `AnimalPoseSample` is the allocation-free presentation port; complete continuation remains the simulation snapshot.


### Declared props and author baking

`@wildshard/sdk/bake/props` merges opaque rough prop surfaces into the canonical tile grid, clips edge-crossing triangles, keeps interior scatter as `EXT_mesh_gpu_instancing` transform lists and produces a self-contained coarse/far mesh. Named panels and gear remain library GLBs. `bakeColourTexture` in `bake/texture` invokes the trusted local Basis encoder for mipmapped UASTC KTX2; the existing loader chooses ASTC on supported GPUs. Declared costs include CPU buffers, GPU buffers, instance matrices and shadow draws. Every resulting row must fit the content caps.

`@wildshard/game/shardfile/props` validates file, tile, library and texture dependencies. The admitted bytes enter `installDeclaredProps` from `@wildshard/engine/world/declaredProps`; `selectedTiles` contains `lod/x/z` keys, `includeLibrary:false` skips subsequent panel/model loads, and `disposeTile(key)` removes and disposes a streamed tile. Family materials and textures come from resolved catalogues. Stable panel roots expose visibility and pose ports to admitted scripts; collision remains separate declared data.


### Declared props and author baking

`@wildshard/sdk/bake/props` merges opaque rough prop surfaces into the canonical tile grid, clips edge-crossing triangles, keeps interior scatter as `EXT_mesh_gpu_instancing` transform lists and produces a self-contained coarse/far mesh. Named panels and gear remain library GLBs. `bakeColourTexture` in `bake/texture` invokes the trusted local Basis encoder for mipmapped UASTC KTX2; the existing loader chooses ASTC on supported GPUs. Declared costs include CPU buffers, GPU buffers, instance matrices and shadow draws. Every resulting row must fit the content caps.

`@wildshard/game/shardfile/props` validates file, tile, library and texture dependencies. The admitted bytes enter `installDeclaredProps` from `@wildshard/engine/world/declaredProps`; `selectedTiles` contains `lod/x/z` keys, `includeLibrary:false` skips subsequent panel/model loads, and `disposeTile(key)` removes and disposes a streamed tile. Family materials and textures come from resolved catalogues; each prop mesh draws with a shared, counted `familyVariant` (`@wildshard/engine/render/families/registry`) of its family material, which keeps the family's shader patches, program key and uniforms (`copyShaderPatches` in `@wildshard/engine/render/shaderPatches`), so toon and painterly props shade as their family and equal surfaces are one material. Stable panel roots expose visibility and pose ports to admitted scripts; collision remains separate declared data. `propColliderDescriptors` passes bounded box/stair shapes into `installDeclaredPropColliders` in `@wildshard/engine/physics/declaredProps`. Its stable-ID owners serialize without callbacks; activation ports have handle snapshots, a lazy Physics getter and a restoring mode that allocates no duplicate colliders. Scope cleanup removes render and collision resources.


### Declared items (SHARD-PLATFORM SF7e)

`@wildshard/engine/combat/items` owns fixed-step cooldown, held charge, queued command aim and lantern fuel/light state. An admitted hook on the existing shared `ScriptHost` may select only its requested action for its host-bound item handle; configured contacts, damage and effects remain trusted. `@wildshard/game/shardfile/items` validates JSON rows, input contexts, loadout and module references, constructs trusted ownership aliases and resolves injected `ItemFamily` constructors. `installDeclaredItems` returns the normal primary/secondary/extras/order/install handoff plus the authoritative runtime map and fixed-step callback. `@wildshard/kit/items/declared` supplies melee and lantern factories with scoped primitive views; the fixture uses the template whip and lantern numbers and a content-addressed 740-byte AssemblyScript module. Toggle/refill use action3/action4; UI reads `remainingFuel` and `lightOn` from the same runtime. The existing template switches at SF16. Bound creature views expose `simulationBound`: the legacy manager skips their decisions, damage, separation and movement-body allocation, while retaining pose/query hitboxes.


### Exported creature skins and clips

`@wildshard/sdk/bake/export` samples existing pose closures at a bounded 30–120 Hz cadence, retaining root motion, declared joint order and local joint TRS. `skinnedGlb` deterministically writes actual geometry, weights, inverse binds and named clips into a self-contained GLB. Its textures are explicit external KTX2 bindings. The shared admitted-byte parser checks node trees, skin indices and normalized weights, finite inverse binds, bounded ordered clip times and rotation channels before the loader allocates them. Reported residency includes the skeleton palette texture/matrices and decoded clip tracks; clip accessors also stay conservatively counted in GPU bytes. Engine playback continues through `GLTFLoader`, `bindRig` and `AnimationMixer`.


### Traversal readiness (SHARD-PLATFORM SF18d)

`@wildshard/engine/sim/readiness` computes a cold-cache distance from speed, request latency, critical wire transfer at the configured link rate, stall and decode. Its separate hybrid line conservatively adds runtime-chunk request, transfer and parse work on the shared link. Critical wire is capped at 2,000,000 bytes: 30 m/s, 5 Mbit/s, 0.5 s latency, 10 s stall and 0.8 s decode give 435 m; a 500 kB hybrid chunk plus 0.2 s parsing raises it to 480 m. `TraversalReadiness` requests by radial edge distance, tracks completion of colliders/sim/runtime separately and invalidates stale generations on unload or failure. `@wildshard/game/shardfile/readiness` counts actual admitted dependency bytes, including cold-cache commons, without charging render tiles. `@wildshard/engine/physics/readinessWalls` installs closed WORLD colliders in each frame and opens them only after all fences pass; call `sync` before the traveler moves. Null-instance proxy edges stay closed. Highway, strip and proxy ground belong to a separate platform scope and survive wall removal. Place an entry wall at the 6 m re-frame line on shared strip ground, so late readiness cannot push the capsule into a cell seam before its world transfer. Walls carry the same platform owner tag as deck/strip colliders. The joined Node fixture drives a gravity-bearing capsule at 30 m/s through the actual generated strip and residency driver with 3 s and 10 s stalls, a deliberately late collider, a U-turn, two world transfers, one enabled traveler capsule, unload/stale completion and a closed proxy edge.

<!-- exports:start (generated by test/engine-docs.test.ts; do not edit by hand) -->

### `@wildshard/engine` (`src/engine/package.json`)

2053 exports, grouped by the module to import them from.

- `@wildshard/engine/ai/BossBrain`: `BossBrain`, `BossContinuation`, `BossDefinition`, `BossPhaseDef`, `BossPorts`, `BossPresentation`, `BossSaved`, `BossScript`, `BossState`
- `@wildshard/engine/ai/bossDefinition`: `BossDef`
- `@wildshard/engine/ai/burstFlyer`: `BurstFlyerBrain`, `BurstFlyerPorts`, `BurstFlyerSpec`
- `@wildshard/engine/ai/challengeGrazer`: `ChallengeGrazerBrain`, `ChallengeGrazerPorts`, `ChallengeGrazerSpec`
- `@wildshard/engine/ai/CreatureBrain`: `CreatureBrain`
- `@wildshard/engine/ai/EliteBrain`: `EliteActor`, `EliteBrain`, `EliteDefinition`, `ElitePorts`
- `@wildshard/engine/ai/encounters`: `EncounterDefinition`, `EncounterRegistry`, `EncounterService`, `SpawnContext`, `SpawnEntry`, `Spawner`, `SpawnPoint`, `SpawnTableRow`
- `@wildshard/engine/ai/GroupBrain`: `GroupBrain`, `GroupMember`
- `@wildshard/engine/ai/guardian`: `GuardianBrain`, `GuardianPorts`, `GuardianSpec`
- `@wildshard/engine/ai/herd`: `HerdBrain`, `HerdContext`, `HerdMode`, `HerdPorts`, `HerdSpec`, `StallionState`
- `@wildshard/engine/ai/inspect`: `brainInspection`, `BrainInspection`, `brainPinned`, `inspectBrain`, `inspectTick`, `pinBrain`
- `@wildshard/engine/ai/orbitDiver`: `OrbitDiverBrain`, `OrbitDiverHome`, `OrbitDiverPorts`, `OrbitDiverSpec`
- `@wildshard/engine/ai/pack`: `PackBrain`, `PackContext`, `PackPhase`, `PackPorts`, `PackPrey`, `PackSpec`
- `@wildshard/engine/ai/patrolDiver`: `PatrolDiverBrain`, `PatrolDiverPorts`, `PatrolDiverSpec`
- `@wildshard/engine/ai/perchHunter`: `PerchHunterBrain`, `PerchHunterPorts`, `PerchHunterSpec`
- `@wildshard/engine/ai/phases`: `EncounterPhase`, `PhaseEncounter`, `PhaseEncounterPorts`, `PhaseEncounterSpec`, `silentBossPresentation`
- `@wildshard/engine/ai/platform`: `BrainNavigation`, `BrainTarget`, `buildPlatformSpawns`, `installPlatformBrains`, `PlatformBrain`, `PlatformBrainPorts`, `PlatformBrainSpec`, `PlatformSpawn`, `PlatformSpecies`, `preparePlatformBrains`
- `@wildshard/engine/ai/ramGrazer`: `RamGrazerBrain`, `RamGrazerPorts`, `RamGrazerSpec`
- `@wildshard/engine/ai/reach`: `canReach`, `ReachActor`
- `@wildshard/engine/ai/scriptBrain`: `BRAIN_FIELD`, `ScriptBrainBinding`, `ScriptBrainDriver`, `ScriptBrainLane`, `ScriptBrainOptions`, `ScriptBrainPorts`
- `@wildshard/engine/ai/skirmisher`: `SkirmisherBrain`, `SkirmisherPorts`, `SkirmisherSpec`
- `@wildshard/engine/ai/species`: `deriveSpecies`, `SpeciesRow`, `SpeciesVariant`
- `@wildshard/engine/ai/strikes`: `BrainPoint`, `StrikeActor`, `StrikeContext`, `StrikePhase`, `StrikeRunner`, `StrikeShape`, `StrikeSpec`, `UtilityScore`
- `@wildshard/engine/ai/view/DebugOverlay`: `AiDebugHost`, `AiDebugView`, `DebugActor`, `installAiDebug`
- `@wildshard/engine/ai/weighted`: `TableDrop`, `TableSpec`, `WeightedRow`, `WeightedTable`
- `@wildshard/engine/anim/channel`: `ClipChannel`
- `@wildshard/engine/anim/machine`: `AnimMachine`, `AnimMachineDef`, `AnimService`, `AnimState`
- `@wildshard/engine/anim/rig`: `bindRig`, `ClipName`, `loadRig`, `loadRigFile`, `RigBake`, `RigContract`, `RigInstance`, `RigRef`, `SocketName`
- `@wildshard/engine/app/app`: `App`, `SystemsByPhase`, `TrampleField`
- `@wildshard/engine/app/cachedAssets`: `retainCachedResources`
- `@wildshard/engine/app/identity`: `appIdentity`, `AppIdentity`, `currentProbe`, `harnessPins`, `installAppIdentity`, `installedIdentity`, `setCurrentProbe`
- `@wildshard/engine/app/ownership`: `asShell`, `currentOwner`, `enterOwner`, `onOwnerDispose`, `withOwner`
- `@wildshard/engine/app/resources`: `pageScope`, `resourceScope`
- `@wildshard/engine/app/runtime`: `app`, `gameplayRandom`
- `@wildshard/engine/app/scheduler`: `InterruptReason`, `TickActor`, `TickBand`, `TickPoint`, `TickRate`, `TickScheduler`
- `@wildshard/engine/app/scope`: `Disposable3`, `disposalErrorMessages`, `NativeCensus`, `nodeOwner`, `PhysicsHandle`, `registrationTimerIds`, `Scope`, `ScopeCensus`, `scopeRegistrations`, `SoundHandle`
- `@wildshard/engine/app/systems`: `AppState`, `inState`, `Phase`, `PHASES`, `RunCondition`, `sortSystems`, `SystemSpec`, `TickRateId`
- `@wildshard/engine/app/view/scopeEnvironment`: `installBrowserScopeEnvironment`
- `@wildshard/engine/audio/ambience`: `AmbienceZones`, `ZoneBed`, `ZoneVoice`
- `@wildshard/engine/audio/AmbienceBeds`: `AmbienceBeds`, `BedDef`, `PositionalLoops`, `ZoneWeights`
- `@wildshard/engine/audio/Audio`: `AmbientBed`, `AnimalSound`, `Audio`, `CallVoice`, `GameAudio`, `HoofSurface`, `ImpactKind`, `LoopName`, `OneShot`, `SampleLoop`, `SynthBed`
- `@wildshard/engine/audio/audioLog`: `audioLog`, `AudioLogEntry`
- `@wildshard/engine/audio/audioProfiles`: `AudioMusicProfile`, `AudioSampleProfile`, `AudioZone`, `AudioZoneProfile`, `requireAudioLevel`, `requireAudioProfile`, `requireAudioZone`
- `@wildshard/engine/audio/cueRouting`: `createCueRouter`, `CueAction`, `CueCondition`, `CueRoute`, `CueRoutingPorts`
- `@wildshard/engine/audio/Cues`: `CueBank`, `cueFiles`, `CueMap`, `CueOpts`, `CuePlayer`, `decodeCueSet`, `SampleClip`
- `@wildshard/engine/audio/declared`: `DeclaredAudioData`, `DeclaredAudioPorts`, `installDeclaredAudio`
- `@wildshard/engine/audio/gen`: `bubbleBed`, `death`, `footstep`, `hurt`, `impact`, `impulse`, `impulseChannel`, `interact`, `INTERACT_SOUNDS`, `InteractSound`, `Material`, `MATERIALS`, `noiseLoop`, `plunge`, `Room`, `ROOMS`, `STEP_KINDS`, `StepKind`, `synthKit`, `whoosh`
- `@wildshard/engine/audio/interactSfx`: `InteractSfx`
- `@wildshard/engine/audio/levelAudio`: `AudioMixer`, `LevelAudioBank`, `LevelAudioProfile`, `NO_AUDIO`
- `@wildshard/engine/audio/Music`: `Music`, `MusicMode`, `MusicState`, `StingName`
- `@wildshard/engine/audio/ownership`: `ownAudioSource`
- `@wildshard/engine/audio/preload`: `AudioKind`, `cachedBytes`, `DECODE_RATE`, `decodeBytes`, `decodeSfxSet`, `onAudioBusy`, `SfxBank`, `SfxDecodePolicy`, `sfxFiles`, `trackBusy`
- `@wildshard/engine/audio/score/score`: `Arrangement`, `ChordEv`, `ChordName`, `installScore`, `LayerId`, `MixEv`, `MixKey`, `Mode`, `NoteEv`, `score`, `Score`, `Segment`
- `@wildshard/engine/audio/scoreSelection`: `ScoreCondition`, `ScoreSelection`, `selectScoreSlots`
- `@wildshard/engine/audio/SetScore`: `AudioDecode`, `AudioRead`, `decodeScore`, `ScoreBank`, `scoreFiles`, `scoreManifest`, `ScoreSet`, `ScoreSource`, `SetScore`, `SetScoreOptions`
- `@wildshard/engine/audio/Stems`: `BossPhase`, `Deck`, `decodeStyle`, `GenreBank`, `musicManifest`, `MusicManifest`, `MusicSet`, `musicSetDir`, `parseManifest`, `setFiles`, `shipped`, `SlotAudio`, `SlotName`, `SlotSpec`, `StemSting`, `StyleBank`, `styleFiles`
- `@wildshard/engine/audio/surface`: `GroundSurface`, `StepSurface`, `StepSurfaceRequest`
- `@wildshard/engine/audio/util`: `audioRandom`, `bindAudioRandom`, `loopAt`, `panFromYaw`
- `@wildshard/engine/audio/Voices`: `FAMILIES`, `Family`, `FamilyName`, `PlayOpts`, `SamplePlay`, `SamplePolicy`, `SampleVoice`, `VoicePool`, `Voices`, `VoiceTable`
- `@wildshard/engine/blocks`: `blocks`
- `@wildshard/engine/boot`: `bootLevel`, `LevelBoundary`, `LevelSequence`, `levelSequenceDriver`
- `@wildshard/engine/boot/audioFiles`: `AudioFilePolicy`, `audioFiles`, `manifestFiles`, `musicDir`, `musicStyles`, `sfxDir`, `sfxSets`
- `@wildshard/engine/boot/bakedApi`: `loadBakedSky`, `loadLUT`, `preloadBakedTextures`
- `@wildshard/engine/boot/bootTrace`: `beginExploreEntry`, `bootDiagnostic`, `bootDiagnosticJson`, `BootTrace`, `bootTraceActive`, `BootTraceTransports`, `createBootTrace`, `endExploreEntry`, `exploreEntryPending`, `flushBootReports`, `inspectPreviousBoot`, `markBootContextLost`, `markBootHandledError`, `markBootPlanned`, `previousBootLevel`, `previousBootLine`, `recordBootCheckpoint`, `recordBootProgress`, `recordExploreFrame`, `recordGpuRecovery`, `startBoot`
- `@wildshard/engine/boot/bytes`: `addBytes`, `ChunkFiles`, `declareTotals`, `fetchImage`, `gpuLayerUrl`, `gpuUrl`, `installByteCounter`, `phoneUrl`, `releaseByteCounter`, `tierUrl`, `versionedUrl`
- `@wildshard/engine/boot/catalog`: `bootCatalog`, `BootCatalog`, `BootLevel`, `setBootCatalog`
- `@wildshard/engine/boot/contentCache`: `CONTENT_CACHE_NAME`, `ContentCache`, `ContentCachePorts`, `ContentCacheStats`
- `@wildshard/engine/boot/extras`: `AudioBanks`, `bootFiles`, `extraFetches`, `Preload`, `startAudioPreload`, `startDeferredAudioPreload`, `startMenuPreload`
- `@wildshard/engine/boot/filePolicy`: `filePolicy`
- `@wildshard/engine/boot/gpuFiles`: `gpuFile`, `Ktx2Table`, `MAY_KTX2`, `registerGpuFiles`, `setAutoKtx2Check`, `setTexturePolicy`, `standIn`, `texMode`, `TexMode`, `texModeWhy`
- `@wildshard/engine/boot/lastEnd`: `AliveInfo`, `lastEnd`, `LastEnd`, `lastEndLine`, `lastRecordedEnd`, `markUnload`, `PageLife`, `setAliveSource`
- `@wildshard/engine/boot/pack`: `bootParts`, `packFor`, `streamPack`
- `@wildshard/engine/boot/plan`: `ByteProgress`, `createBootPlan`, `formatMB`, `LogRow`, `macrotask`, `Plan`, `PlanOptions`, `ProgressView`, `runDirect`, `Sink`, `slicer`, `StepProgress`, `StepRunner`
- `@wildshard/engine/boot/prefetch`: `bootFetches`, `prefetch`, `prefetchAfter`, `whenPrefetched`
- `@wildshard/engine/boot/retry`: `retried`
- `@wildshard/engine/boot/runtime`: `loadExplore`, `loadFeedback`
- `@wildshard/engine/boot/shardPrefetch`: `ktx2MarkerKey`, `ktx2Ready`, `ktx2Set`, `lateReads`, `PrefetchEnv`, `PrefetchHandle`, `PrefetchState`, `prefetchVeto`, `setHash`, `shardBootRequests`, `shardPrefetchList`, `ShardTally`, `startShardPrefetch`
- `@wildshard/engine/boot/steps`: `BOOT_STEPS`, `BootStep`, `BYTE_SOURCES`, `ByteKey`, `byteLabel`, `closedBy`, `shardTimingKey`, `STEP_INFO`, `StepInfo`, `useShardSteps`
- `@wildshard/engine/boot/tables`: `AssetTables`, `assetVersions`, `bootPacks`, `installAssetTables`, `musicManifests`, `PackDef`, `PackFile`, `PackPart`, `publicBytes`, `sfxManifests`
- `@wildshard/engine/boot/titleArrival`: `consumeTitleArrival`, `setTitleArrival`, `TitleArrival`, `TitleArrivalMode`
- `@wildshard/engine/combat/ammo`: `AmmoId`, `AmmoRow`, `ProjectileModification`
- `@wildshard/engine/combat/blocks/ads`: `ads`
- `@wildshard/engine/combat/blocks/melee`: `aimRay`, `fovForAspect`, `melee`
- `@wildshard/engine/combat/cues`: `audioCueMap`, `CombatCueMap`, `CombatCueOpts`, `CombatCues`, `HitStopProfile`, `resolveHitStop`, `WeaponChargePhase`
- `@wildshard/engine/combat/effects/EffectService`: `EffectService`
- `@wildshard/engine/combat/effects/types`: `ActiveEffect`, `AttributeSet`, `CueId`, `EffectDef`, `EffectId`, `EffectTarget`, `matchesTag`, `SourceMulDef`, `sourceMultiplier`
- `@wildshard/engine/combat/Equipment`: `BlockSet`, `EquipContext`, `Equipment`, `EquipmentBlock`, `EquipmentCues`, `EquipmentIcon`, `EquipmentIconMap`, `EquipmentId`, `EquipmentMeta`, `EquipmentRow`, `EquipmentSlotMap`, `EquipmentTouchMap`, `RangedFeelProfile`, `ToolId`, `WeaponId`, `WeaponUi`
- `@wildshard/engine/combat/EquipmentPickup`: `EquipmentPickup`, `EquipmentPickupHost`, `EquipmentPickupSpec`, `PickupLoadout`
- `@wildshard/engine/combat/EquipmentService`: `EquipmentService`
- `@wildshard/engine/combat/health`: `HealthLifecycle`, `PlayerHealth`, `PlayerHealthPorts`, `PlayerMode`
- `@wildshard/engine/combat/itemFamilies`: `ItemFamily`, `ItemFamilyPorts`, `ItemViewRecipe`
- `@wildshard/engine/combat/items`: `ItemAction`, `ItemAttack`, `ItemContact`, `ItemHook`, `ItemPorts`, `ItemRuntime`, `ItemSpec`, `ItemState`, `ItemTarget`, `scriptItemHook`
- `@wildshard/engine/combat/pipeline`: `Actor`, `CombatPipeline`, `CombatTag`, `CombatTarget`, `DamageDealt`, `DamageRequest`, `DamageRuleDef`, `DeathCause`, `FallCause`, `HealthAttributes`, `StringKey`
- `@wildshard/engine/combat/targets`: `authoredTargets`, `RayTargets`
- `@wildshard/engine/combat/Tool`: `EquipmentAction`, `Tool`
- `@wildshard/engine/combat/types`: `TargetAnimal`, `TargetFrame`, `TargetHit`, `Targets`
- `@wildshard/engine/combat/view/brass`: `BrassCase`, `brassFloor`, `stepBrass`
- `@wildshard/engine/combat/view/DropArc`: `DropArc`
- `@wildshard/engine/combat/view/EquipmentHost`: `EquipmentHost`
- `@wildshard/engine/combat/view/firearmFx`: `HitLine`, `makeFlashTexture`
- `@wildshard/engine/combat/view/hitscan`: `hitscan`, `HitscanProfile`, `HitscanResult`
- `@wildshard/engine/combat/view/melee`: `Key`, `Move`, `SwordArms`, `SwordFraming`, `SwordMoveSet`, `SwordRig`, `SwordWorld`, `Trail`
- `@wildshard/engine/combat/view/projectile`: `projectileFlightStep`, `ProjectileKind`, `Projectiles`, `ProjectileWorld`, `ShotOpts`, `WindField`
- `@wildshard/engine/combat/view/ranged`: `box`, `CrossbowOptions`, `CrossbowWorld`, `cyl`, `dataTexture`, `edgeWear`, `fixIBL`, `FOV_ADS`, `FOV_HIP`, `fovForAspect`, `impactSurfaceOf`, `isMesh`, `makeBoltAtlas`, `makeCord`, `Puffs`, `RangedOptions`, `RangedWorld`, `remapUV`, `startViewmodelTextures`, `stripExtra`, `TexSet`, `TRACER_ORDER`, `TRACER_RED`, `VIEWMODEL_GROUP`, `viewmodelMaterial`, `viewmodelTexSet`, `viewmodelTexturesReady`, `whiteColors`, `worldHit`
- `@wildshard/engine/combat/view/rangedFeel`: `installRangedFeel`
- `@wildshard/engine/combat/view/slashTrail`: `SlashTrail`, `SlashTrailProfile`
- `@wildshard/engine/combat/Weapon`: `AimInfo`, `EquipmentView`, `ImpactSurface`, `quiverState`, `ViewFrame`, `Weapon`, `WeaponHooks`, `WeaponState`
- `@wildshard/engine/core/assets`: `loadGLTF`, `loadHDR`, `loadImage`, `loadPBR`, `loadPBRArray`, `loadTexture`, `pbrMaterial`, `PBRSet`, `pbrUrls`, `setAnisotropy`, `texUrl`
- `@wildshard/engine/core/bootstrap`: `bootstrap`, `World`
- `@wildshard/engine/core/clock`: `diagnosticNow`, `GameClock`, `GameClockState`
- `@wildshard/engine/core/config`: `_applyChunkConstants`, `CELL_ABOVE`, `CELL_BELOW`, `CELL_HEIGHT`, `CHUNK_COORDS`, `CHUNK_DEPTH`, `CHUNK_HALF`, `CHUNK_SIZE`, `CONTENT_CAPS`, `CONTENT_MB`, `ENTRY_ASPHALT`, `ENTRY_WIDTH`, `PAGE_LEVEL`, `ROAD_LENGTH`, `ROAD_WIDTH`, `SEED`, `TERRAIN_RES`, `TREE_COUNT`
- `@wildshard/engine/core/contentCost`: `contentCost`, `ContentCostInput`
- `@wildshard/engine/core/devMode`: `isDev`, `onDev`, `setDev`
- `@wildshard/engine/core/errorReport`: `ContextValue`, `ErrorPayload`, `ErrorReporter`, `keyOf`, `LoadFailure`, `QUEUE_KEY`, `QUEUE_MAX`, `REPORT_DELAY_MS`, `ReporterDeps`, `reportError`, `ReportOutcome`, `REPORTS_MAX`, `safeUrl`, `sendReport`, `SendResult`, `SESSION_KEY`, `StorageLike`
- `@wildshard/engine/core/frameCost`: `Bucket`, `BUCKETS`, `frameCost`, `FrameCostSnapshot`, `FrameRecord`, `Sub`, `SUBS`
- `@wildshard/engine/core/Game`: `FixedPhase`, `Game`
- `@wildshard/engine/core/gpuOnly`: `gpuOnlyAttributes`, `gpuOnlyContent`, `gpuOnlyTexture`, `markGpuOnly`, `onGpuRestored`, `rebakeGpuContent`
- `@wildshard/engine/core/GpuRecovery`: `installGpuRecovery`, `RecoveryHost`, `RELOAD_PARAM`
- `@wildshard/engine/core/harnessTap`: `ambientTick`, `tap`
- `@wildshard/engine/core/KeepAlive`: `KeepAlive`
- `@wildshard/engine/core/ktx2`: `BASIS_PATH`, `initKtx2`, `ktx2Layers`, `ktx2Texture`, `readTexturePixels`, `releaseAfterUpload`
- `@wildshard/engine/core/materialGraph`: `DEFAULT_GRAPH_BUDGET`, `GRAPH_IR_VERSION`, `GRAPH_OPS`, `GraphBinding`, `GraphBudget`, `GraphCost`, `GraphIr`, `GraphLiteral`, `GraphLoopBody`, `GraphNode`, `GraphOpSpec`, `GraphParam`, `GraphParamType`, `GraphRef`, `GraphStages`, `GraphSurface`, `GraphValidation`, `GraphValidationOptions`, `GraphValueType`, `GraphVertexOffset`, `LOOP_MAX`, `validateGraph`
- `@wildshard/engine/core/noise`: `clamp`, `lerp`, `Noise2D`, `smoothstep`
- `@wildshard/engine/core/perfLap`: `LapPlayer`, `LapSpot`, `perfLap`, `PerfLapHost`
- `@wildshard/engine/core/practiceRoom`: `practiceRoom`
- `@wildshard/engine/core/rng`: `fnv1a32`, `pageSeed`, `Rng`, `RngService`, `RngState`, `RngStream`, `RngStreams`, `RngStreamsState`
- `@wildshard/engine/core/shadowLayer`: `SHADOW_LAYER`
- `@wildshard/engine/core/tier`: `_buildAs`, `applyLevelTier`, `automaticTier`, `buildTier`, `frameCapFps`, `frameProbe`, `gfxPrefs`, `GfxPrefs`, `initializeTier`, `MOBILE_DEVICE`, `practiceFps`, `saveGfxPrefs`, `Tier`, `TIER`, `TIER_CONFIG`
- `@wildshard/engine/core/time`: `worldTime`
- `@wildshard/engine/debug/probe`: `CombatTarget`, `compiledProgramHash`, `createProbeNav`, `EngineProbe`, `Fingerprint`, `GameplayState`, `GpuBytes`, `HarnessPins`, `installProbe`, `LeakCensus`, `LeakResult`, `ProbeApp`, `ProbeDeps`, `ProbeNav`, `ProbePose`, `ProbeWorld`, `programHash`, `ResourceCounts`, `Saves`, `SoundLog`, `Vec3`, `WalkLeg`, `WalkResult`
- `@wildshard/engine/entities/AnimalFactory`: `AnimalFactory`, `AnimalKind`, `AnimalMaterial`, `AnimalModel`, `AnimalRig`, `AnimalStyle`, `AnimalVariant`, `DEFAULT_CREATURE_RENDER`, `SHELL_LAYERS`
- `@wildshard/engine/entities/AnimalManager`: `AnimalHit`, `AnimalManager`, `AnimalSound`, `BOAR_TUNING`, `BodyClearable`, `clearBody`, `DEER_TUNING`, `Herd`, `HuntTuning`, `WanderGoalQuery`
- `@wildshard/engine/entities/AnimalSim`: `AnimalMotor`, `AnimalPoseSample`, `AnimalSim`, `AnimalSimPorts`, `AnimalSimSpec`, `AnimalState`, `DAMAGE`, `damageFor`
- `@wildshard/engine/entities/AnimalView`: `Animal`, `damageFor`, `P_COUNT`
- `@wildshard/engine/entities/eliteBrain`: `eliteAct`, `eliteDamageMul`, `eliteThink`, `setEliteAct`, `setEliteBrain`, `setEliteDamage`
- `@wildshard/engine/entities/lowpoly`: `crestSpikes`, `facetGeometry`, `lowPolyMaterials`, `LowPolyMaterials`, `oneMaterial`, `patchEyeGlow`
- `@wildshard/engine/entities/species/loft`: `boneIndex`, `isLowPoly`, `loft`, `lowPolySides`, `mix`, `Paint`, `paintNoise`, `paletteColors`, `registerToonPaint`, `RGB`, `S`, `setLowPoly`, `setShag`, `setShapeFn`, `skinPlain`, `srgb`, `Station`, `TEX_M`, `toonPaint`, `ToonPaint`, `tube`
- `@wildshard/engine/entities/species/look`: `CreatureHull`, `EyeSpot`, `SpeciesLook`, `SpeciesService`, `speciesWithLook`
- `@wildshard/engine/entities/species/registry`: `AnimalDims`, `AnimalSpecies`, `BoneDef`, `creatureSoundDefaults`, `CreatureSoundDefaults`, `EnemyWorld`, `FurStyle`, `hasSpecies`, `Rarity`, `RARITY_ORDER`, `registeredSpecies`, `registerSpecies`, `RigAnimCtx`, `rollVariant`, `setCreatureSoundDefaults`, `setSpeciesResolver`, `speciesDef`, `SpeciesDef`, `speciesKinds`, `ThinkCtx`, `validateCreatureBones`, `variantDef`, `VariantDef`, `variantMods`, `VariantMods`
- `@wildshard/engine/entities/species/rigs`: `bump`, `clamp`, `lookAngles`, `NO_FUR`, `smooth01`, `squashBody`, `step`
- `@wildshard/engine/events/events`: `EVENT_FLUSH_LIMIT`, `Events`, `ListenerOptions`
- `@wildshard/engine/events/maps`: `AskInput`, `AskMap`, `AskOutput`, `CrouchAnswer`, `CrouchRequest`, `EventMap`, `FaultEvent`, `Tag`, `TagMap`
- `@wildshard/engine/explore/Explore`: `Explore`, `ExploreHost`, `ExploreMode`, `ExplorePane`, `ExploreTitle`
- `@wildshard/engine/fx/groundFx`: `annulus`, `FX`, `fxMaterial`, `FxMaterial`, `FxMode`
- `@wildshard/engine/fx/Impacts`: `ImpactKind`, `Impacts`
- `@wildshard/engine/fx/LightPool`: `LightPool`
- `@wildshard/engine/fx/ParticlePool`: `ParticleAttr`, `ParticlePool`, `ParticlePoolSpec`, `pointScale`
- `@wildshard/engine/input/commands`: `AimCommand`, `FightCommand`, `PlayerCommand`
- `@wildshard/engine/input/dom`: `listenDom`, `listenPage`, `mountDom`, `PageInputEvent`
- `@wildshard/engine/input/gameplay`: `installGameplayInput`, `weaponInputContext`
- `@wildshard/engine/input/InputService`: `Action`, `ActionCommand`, `ActionMap`, `DeclaredAction`, `InputService`, `InputState`, `TouchStack`, `TouchVerb`, `TouchVerbSpec`
- `@wildshard/engine/input/weaponActions`: `weaponActionGate`
- `@wildshard/engine/level/context`: `ContentRow`, `ContentRowMap`, `CreatureMaterialFactory`, `DebugRowSpec`, `EngineRows`, `HudVerbs`, `InputContextDef`, `LevelAdapters`, `LevelContext`, `LevelHooks`, `PlaygroundSpec`, `ResidentMemory`, `RowVerb`, `StringTable`, `TierKnobSchema`, `VerbSlotOpts`
- `@wildshard/engine/level/data`: `AtmosphereSpec`, `CabinSite`, `CompareTarget`, `exploreArt`, `ExploreArt`, `ExploreSpec`, `FaunaKind`, `ForestSpec`, `GradeLook`, `GradeSpec`, `HerdPlan`, `HorizonBand`, `HorizonRing`, `HorizonSpec`, `HudSpec`, `LevelAssets`, `MapLook`, `MinimapSpec`, `PoiSpec`, `PondDef`, `RGB`, `SkySpec`, `SpawnPose`, `TerrainField`, `TerrainNoise`, `TerrainSpec`, `TreeSpec`, `Vec2`
- `@wildshard/engine/level/installation`: `createLevelInstallation`, `LevelInstallation`
- `@wildshard/engine/level/load`: `LevelDriver`, `LevelLoader`, `LevelLoadError`, `LevelStage`
- `@wildshard/engine/level/selection`: `activeLevel`, `configureLevel`, `onLevelChange`, `selectedLevel`
- `@wildshard/engine/level/spec`: `AudioSpec`, `BootSpec`, `Bounds`, `CreatureRenderSpec`, `EngineMechanism`, `FightRules`, `LevelSpec`, `LoadoutSpec`, `needsTerrainCollider`, `resolveTierKnobs`, `TierKnobMap`, `TierKnobs`, `TierOverrides`
- `@wildshard/engine/math/color`: `lin`
- `@wildshard/engine/models/colliders`: `drawnHullOwn`, `drawnHullWorld`, `placeCollider`, `Pose`, `poseGeometry`, `poseOf`
- `@wildshard/engine/models/creature`: `creature`, `CREATURE_CLIPS`, `creatureContext`, `creatureFactory`, `CreatureParams`
- `@wildshard/engine/models/cull`: `BatchedCull`, `BatchedSlot`, `CellCull`, `CelledCopiesCull`, `CullOptions`, `CullView`, `HostedSet`, `InstancedCull`, `InstancedSink`, `SetCull`, `UntilCull`, `WeldCull`
- `@wildshard/engine/models/gear`: `GearSkinParams`, `loadingSpecimen`, `skinVariants`, `wearSkin`
- `@wildshard/engine/models/glb`: `GlbPart`, `loadGlbPart`, `loadLodPair`, `loadLodPairInto`, `LodPair`, `lodPairOf`, `vertexHull`
- `@wildshard/engine/models/hull`: `bakePart`, `supportPoints`
- `@wildshard/engine/models/interact`: `glow`, `lit`, `pickup`
- `@wildshard/engine/models/live`: `listModel`, `ListOptions`, `listRoster`, `live`, `RosterEntry`
- `@wildshard/engine/models/model`: `ColliderSpec`, `definedModels`, `defineModel`, `ModelBuild`, `modelContext`, `ModelContext`, `ModelDef`, `ModelInfo`, `ModelLod`, `ModelPart`, `ModelVariant`, `paramsOf`, `Placement`, `seedOf`
- `@wildshard/engine/models/place`: `CLAIM_MARGIN`, `claimCopy`, `copiesAt`, `copiesNear`, `cullPlaced`, `Draw`, `DrawnInto`, `finishWeld`, `HandedBatch`, `InstancedCuller`, `PieceOptions`, `place`, `Placed`, `placedCopies`, `placedGroups`, `PlaceOptions`, `rayCopy`, `weld`, `Weld`, `WeldOptions`
- `@wildshard/engine/models/roster`: `listShardModels`, `ShardModelsOptions`
- `@wildshard/engine/models/sets`: `placeSet`, `SetOptions`
- `@wildshard/engine/models/slots`: `SlotGeometry`, `SlotRange`, `SlotRecorder`
- `@wildshard/engine/models/swimHands`: `swimHands`, `SwimHandsParams`
- `@wildshard/engine/models/weld`: `flatPositions`, `mergeOrNull`, `nearProxy`, `shadowProxy`, `twoSidedPositions`, `UnitDrawn`, `UnitParts`, `weldAcross`, `WeldBatch`, `WeldBuild`, `WeldPart`, `WeldView`
- `@wildshard/engine/physics/bodies`: `activeBodies`, `Bodies`, `Body`, `BODY_CAP`, `BodyShape`, `BodySpec`, `Drop`, `DROP_BODY`, `FixedClock`, `FloatSpec`, `overlapBox`, `setActiveBodies`
- `@wildshard/engine/physics/box`: `boxInFrame`, `BoxSpec`
- `@wildshard/engine/physics/CharacterMotor`: `CharacterMotor`, `MotorOptions`, `MoveResult`, `rideable`
- `@wildshard/engine/physics/declaredProps`: `installDeclaredPropColliders`, `PropColliderPort`, `PropColliderState`
- `@wildshard/engine/physics/edgeEntries`: `walkEdgeEntries`
- `@wildshard/engine/physics/entrySockets`: `EntrySocket`, `EntrySocketMode`, `EntrySocketOrigin`, `entrySockets`, `installEntrySockets`
- `@wildshard/engine/physics/frame`: `FrameMember`, `PreparedFrameMotors`, `prepareFrameMotors`
- `@wildshard/engine/physics/gridBorders`: `gridCreatureConstraint`, `GridMountBody`, `installGridBorders`, `installGridMountPassage`
- `@wildshard/engine/physics/groups`: `GROUP`, `GroupName`, `groups`, `queryGroups`
- `@wildshard/engine/physics/heightPatch`: `HeightPatch`, `HeightPatchOpts`
- `@wildshard/engine/physics/mover`: `KinematicMover`, `MoverBox`, `MoverPose`
- `@wildshard/engine/physics/paths`: `pathRampDescs`, `PathRampOptions`
- `@wildshard/engine/physics/Physics`: `Physics`
- `@wildshard/engine/physics/query`: `castRay`, `castSegment`, `floorBelow`, `Hit`, `lineOfSight`, `sticksIn`, `sweepBall`
- `@wildshard/engine/physics/rapier`: `loadRapier`, `Rapier`
- `@wildshard/engine/physics/readinessWalls`: `ReadinessEdge`, `ReadinessWalls`
- `@wildshard/engine/physics/regionalState`: `regionalPhysicsState`
- `@wildshard/engine/physics/ropeChain`: `RopeChain`, `RopeChainSpec`
- `@wildshard/engine/physics/stripColliders`: `installStripCollider`, `PLATFORM_COLLIDER_OWNER`
- `@wildshard/engine/physics/surface`: `clearTags`, `ColliderTag`, `Material`, `tagCollider`, `tagOf`, `untagCollider`
- `@wildshard/engine/physics/terrain`: `addEdgeWalls`, `addTerrain`, `cutTerrain`, `EDGE_WALL_INSET`, `TerrainCut`, `terrainGrid`, `toColumnMajor`
- `@wildshard/engine/physics/terrainTiles`: `addBakedTerrainCollider`
- `@wildshard/engine/player/AimTargets`: `AimTarget`, `getAimTargets`, `lockOn`, `meleeLock`, `setAimTargets`, `targetRadius`
- `@wildshard/engine/player/bladeGlow`: `BladeGlow`
- `@wildshard/engine/player/CameraFX`: `CameraFX`
- `@wildshard/engine/player/dodge`: `dodgeEnv`, `dodgeFx`
- `@wildshard/engine/player/Hands`: `buildSwimGloves`, `ELBOW`, `Hands`, `IDLE`, `SwimArms`, `SwimStyle`
- `@wildshard/engine/player/hoverSpeed`: `hoverSpeed`
- `@wildshard/engine/player/LockOnTarget`: `addLockOffset`, `aimPoint`, `FlickDir`, `FlickTracker`, `LOCK`, `LockOnSystem`, `lockScore`, `pickSwitch`, `wrapAngle`
- `@wildshard/engine/player/MeleeSweep`: `BLADE_SLACK`, `bladeBlocked`, `bladeContact`, `BladeContact`, `Clang`, `clangOf`
- `@wildshard/engine/player/nalatiArms`: `ARM_PAL`, `Fist`, `FistOpts`, `forearm`, `gloveFist`, `placeArm`, `riderArm`
- `@wildshard/engine/player/Player`: `HOVER_TOP`, `Player`, `PlayerFrameQueries`, `STROKE_PERIOD`, `SWIM_SPEED`
- `@wildshard/engine/player/Skins`: `applySkin`, `clearSkin`, `SkinDef`, `SkinId`, `WeaponKind`
- `@wildshard/engine/player/TouchControls`: `IS_TOUCH`, `TouchControls`
- `@wildshard/engine/player/viewmodelTextures`: `clamp01`, `CLASSIC_SETS`, `Ctx2D`, `makeNoise`, `makePixels`, `MODERN_SETS`, `Noise`, `normalPixels`, `Pixels`, `SetName`, `sstep`
- `@wildshard/engine/player/WeaponPickup`: `ItemPickup`, `ItemPickupOptions`, `PickupTier`, `TIER_COLOUR`, `WeaponPickup`
- `@wildshard/engine/practice/playground/catalog`: `asPlaygroundId`, `PLAYGROUND_CARDS`, `playgroundCard`, `PlaygroundCard`, `PlaygroundId`, `playgroundsFor`, `registeredPlayground`, `registerPlayground`
- `@wildshard/engine/practice/playground/devGrid`: `DevKit`, `devLabel`, `devMaterial`, `devTexture`, `DevTone`, `TILE`
- `@wildshard/engine/practice/playground/hud`: `clock`, `PlaygroundChip`
- `@wildshard/engine/practice/playground/load`: `loadPlayground`
- `@wildshard/engine/practice/playground/Playground`: `Playground`, `PLAYGROUND_Y`, `PlaygroundHost`
- `@wildshard/engine/practice/TrainingArena`: `TrainingArena`, `TrainingTarget`
- `@wildshard/engine/quest/core`: `CHIP_MAX`, `DialogueEntry`, `lineFor`, `NpcDef`, `QuestDef`, `QuestLine`, `QuestMarker`, `QuestState`, `QuestStep`, `validateQuest`
- `@wildshard/engine/quest/view`: `ChipSource`, `LiveMarker`, `NpcTalk`, `NpcTalkOpts`, `PlacePoint`, `Places`, `placesWithDiscovery`, `QuestChip`
- `@wildshard/engine/quest/view/ui`: `DialogueBox`, `ObjectiveLine`, `RewardCaption`
- `@wildshard/engine/render/dataLook`: `DATA_LOOK_DAY`, `dataLook`, `dataLookClock`, `DataLookSpec`, `LookDay`, `LookKey`, `lookSample`, `LookSample`, `sampleLook`
- `@wildshard/engine/render/families/emissive`: `compileEmissive`, `EMISSIVE_PROGRAM_KEY`, `EmissiveLook`, `EmissiveLookUniforms`, `injectEmissive`
- `@wildshard/engine/render/families/ground`: `applyGround`, `GROUND_PROGRAM_KEY`, `injectGround`, `updateGround`
- `@wildshard/engine/render/families/measure`: `applyMeasure`, `MEASURE_PROGRAM_KEY`
- `@wildshard/engine/render/families/painterly`: `compilePainterly`, `gradeRgb`, `injectPainterly`, `PAINTERLY_PROGRAM_KEY`, `PainterlyLook`, `PainterlyLookUniforms`, `PainterlyMaterialUniforms`
- `@wildshard/engine/render/families/params`: `EmissiveLookParams`, `EmissiveLookSchema`, `EmissiveMaterialParams`, `EmissiveMaterialSchema`, `FAMILY_IDS`, `FamilyId`, `FamilyMaterialInput`, `FamilyMaterialParams`, `FamilyMaterialSchema`, `GradeParams`, `GradeSchema`, `GroundLayerParams`, `GroundLayerSchema`, `MEASURE_SLOT`, `MeasureLayerParams`, `MeasureLayerSchema`, `MeasureRole`, `measureUv`, `NeonTubeSchema`, `PainterlyLookParams`, `PainterlyLookSchema`, `PainterlyMaterialParams`, `PainterlyMaterialSchema`, `parseEmissiveLook`, `parseFamilyMaterial`, `parseGroundLayer`, `parsePainterlyLook`, `parseToonLook`, `PbrMaterialParams`, `PbrMaterialSchema`, `Rgb`, `SkyDomeSchema`, `ToonLookParams`, `ToonLookSchema`, `ToonMaterialParams`, `ToonMaterialSchema`
- `@wildshard/engine/render/families/pbr`: `compilePbr`, `pbrFillers`, `TextureResolver`, `TextureUse`
- `@wildshard/engine/render/families/registry`: `familyCompileJobs`, `FamilyContext`, `familyMaterial`, `familyVariant`, `liveFamilyMaterials`
- `@wildshard/engine/render/families/toon`: `compileToon`, `injectToon`, `TOON_PROGRAM_KEY`, `ToonLook`, `ToonLookUniforms`
- `@wildshard/engine/render/frameCounter`: `installFrameCounter`, `renderCount`, `Renders`
- `@wildshard/engine/render/graph/presets`: `emissiveGraph`, `pbrMeasureGraph`, `PRESET_GRAPH_BUDGET`
- `@wildshard/engine/render/graphBackend`: `GraphCompiler`, `loadGraphBackend`, `loadGraphCompiler`
- `@wildshard/engine/render/hoverboardGeometry`: `buildHoverboard`
- `@wildshard/engine/render/look`: `EngineChainKind`, `EngineEffects`, `ExtendLook`, `FogControl`, `FogModel`, `GrassDriver`, `GrassLayer`, `LightingRig`, `LookChain`, `LookComposeContext`, `LookComposition`, `LookReplaceContext`, `LookStrategy`, `PainterField`, `ReplaceLook`, `ShadowStyle`, `SkyBackdrop`, `SkyBackdropContext`, `SkyBackdropFactory`, `SkyBackdropPost`, `SkyBackdropTargets`, `SkyDressing`, `TerrainPainter`
- `@wildshard/engine/render/lut`: `fetchLut`, `LUT_SIZE`
- `@wildshard/engine/render/nodes/cascadeLightNode`: `EngineDirectionalLightNode`
- `@wildshard/engine/render/nodes/engineFog`: `engineFog`
- `@wildshard/engine/render/nodes/engineNodesHandler`: `EngineNodesHandler`, `EpilogueContext`, `EpilogueStage`, `outputTransform`, `targetTexture`
- `@wildshard/engine/render/nodes/tentShadowFilter`: `tentShadowFilter`
- `@wildshard/engine/render/precompile`: `backgroundJob`, `collectTextures`, `CompileJob`, `postJobs`, `precompileLevel`, `PrecompileReport`, `runPrecompile`, `sceneJobs`, `shadowJobs`
- `@wildshard/engine/render/renderer`: `createRenderer`, `isRenderer`, `probeRenderer`, `Renderer`
- `@wildshard/engine/render/shaderPatches`: `copyShaderPatches`, `hasProgramKey`, `PATCH_ORDER`, `patchIds`, `patchShader`, `setInheritedPatch`, `setProgramKey`, `ShaderPatchFn`, `ShaderPatchKey`, `ShaderPatchOptions`, `ShaderSource`, `takeForeignHook`, `usedPatchIds`
- `@wildshard/engine/render/textureBytes`: `textureBytes`
- `@wildshard/engine/render/viewmodelFeel`: `DrawingBuffer`, `LookLag`, `LookSpring`, `viewmodel`
- `@wildshard/engine/saves/runtime`: `homeScreenPersistence`, `installLegacyMirror`, `installSaveReporter`, `persistHomeScreen`, `saves`, `standaloneDisplay`
- `@wildshard/engine/saves/slots`: `Json`, `jsonRecord`, `jsonSchema`, `jsonSlot`, `saveStorage`
- `@wildshard/engine/saves/store`: `CorruptSave`, `ImportReport`, `InstanceSaveKeyDef`, `InstanceSaveSlot`, `SaveInstance`, `SaveKeyDef`, `SaveScope`, `SaveSlot`, `SaveStorage`, `SaveStore`, `SchemaFailure`
- `@wildshard/engine/saves/view/storage`: `installBrowserSaveEnvironment`
- `@wildshard/engine/script/abi`: `SCRIPT_ABI`, `SCRIPT_EXPORTS`, `SCRIPT_IMPORTS`
- `@wildshard/engine/script/admission`: `admitScript`, `ScriptAdmission`
- `@wildshard/engine/script/client`: `CLIENT_SCRIPT_LIMITS`, `CLIENT_SCRIPT_OP`, `ClientParticleRequest`, `ClientScriptBinding`, `ClientScriptEmitter`, `ClientScriptFrame`, `ClientScriptLane`, `ClientScriptObservation`, `ClientScriptOptions`
- `@wildshard/engine/script/composition`: `ScheduledScriptBinding`, `ScriptComposition`, `ScriptCompositionOptions`, `ScriptRole`, `ScriptSchedule`
- `@wildshard/engine/script/effects`: `EffectRules`, `EffectTransaction`, `SCRIPT_OP`, `ScriptEffect`, `ScriptEntity`, `ScriptEvent`, `ScriptWorld`
- `@wildshard/engine/script/host`: `SCRIPT_LIMITS`, `SCRIPT_PARAMETER_QUERY`, `ScriptCall`, `ScriptEventDelivery`, `ScriptHost`, `ScriptHostOptions`, `ScriptHostState`, `ScriptLimits`, `ScriptQuery`, `ScriptSnapshot`
- `@wildshard/engine/script/lane`: `installScriptLane`, `ScriptBinding`, `ScriptDriver`, `ScriptDriverOptions`, `ScriptLane`, `ScriptLaneOptions`, `ScriptLanePort`, `ScriptModule`
- `@wildshard/engine/script/queries`: `SCRIPT_QUERY`, `ScriptPhysics`, `scriptPhysicsQueries`
- `@wildshard/engine/script/state`: `DeclaredScriptWorld`, `SCRIPT_STATE_OP`, `ScriptStateDeclaration`, `ScriptStateField`, `ScriptWorldState`
- `@wildshard/engine/sim`: `createSimHost`, `SIM_API_VERSION`, `SimCommand`, `SimExternalPlayer`, `SimHost`, `SimHostPorts`, `SimLevel`, `SimSlots`, `SimSpawn`, `SimStateAdapter`, `SimStrike`, `SimValue`
- `@wildshard/engine/sim/edgeProfiles`: `bakedEdgeProfiles`, `EdgeColour`, `EdgeProfiles`, `EdgeResolution`, `edgeSample`, `edgeSampleLocations`, `nativeEdgeProfiles`, `validateEdgeProfile`
- `@wildshard/engine/sim/readiness`: `ReadinessBundle`, `ReadinessEstimate`, `ReadinessLink`, `readinessModel`, `ReadinessPart`, `ReadinessStatus`, `ReadinessTicket`, `TraversalReadiness`
- `@wildshard/engine/sim/shore`: `SHORE_DEPTH`, `SHORE_REVETMENT_INNER_FACE`
- `@wildshard/engine/sim/snapshot`: `decodeSimSnapshot`, `regionalContinuation`, `restoreSimHost`, `serializeSimSnapshot`, `SIM_REGION_SNAPSHOT_CHAR_BUDGET`, `SIM_SNAPSHOT_VERSION`, `SimSnapshot`, `SnapshotBasisMismatchError`, `snapshotSimHost`
- `@wildshard/engine/sim/strips`: `generateCrossroads`, `GeneratedStrip`, `generatePlatform`, `generateStrip`, `PlatformCell`, `STRIP_OFFSETS`, `StripCell`, `StripCorner`, `StripMesh`, `StripProfile`
- `@wildshard/engine/strings`: `ENGINE_STRINGS`, `engineString`, `EngineStringKey`, `installEngineStrings`
- `@wildshard/engine/ui/authoredDebugRows`: `authoredRows`, `GlobalDebugActionSpec`, `registerGlobalDebugAction`
- `@wildshard/engine/ui/BossBar`: `BossBar`
- `@wildshard/engine/ui/Combat`: `aimReadout`, `Combat`
- `@wildshard/engine/ui/DeathFade`: `DARK_UNTIL`, `DeathFade`, `DeathHooks`, `FADE_IN`, `FADE_OUT`
- `@wildshard/engine/ui/debugOptions`: `action`, `DEBUG_GROUPS`, `DEBUG_READOUTS`, `DEBUG_ROWS`, `DebugActionSpec`, `DebugChoice`, `DebugCtx`, `DebugGroup`, `DebugGroupId`, `DebugRow`, `levelDebugRows`, `opt`, `registerLevelDebugRow`, `TITLE_SKIPPERS`
- `@wildshard/engine/ui/declared`: `DeclaredBoss`, `DeclaredBossPanel`, `DeclaredCounter`, `DeclaredHud`, `DeclaredHudHandles`, `DeclaredHudPorts`, `DeclaredMarker`, `DeclaredRelabel`, `DeclaredTextPanel`, `mountDeclaredHud`, `textPanelFragment`
- `@wildshard/engine/ui/EliteBar`: `EliteBar`, `SkullMark`
- `@wildshard/engine/ui/ErrorModal`: `installErrorModal`, `showError`
- `@wildshard/engine/ui/errorScreen`: `showLoadFailure`
- `@wildshard/engine/ui/Feedback`: `bake`, `Feedback`, `FeedbackHost`, `headingDeg`, `reproUrl`, `SHOT_MAX_BYTES`, `SHOT_MAX_W`
- `@wildshard/engine/ui/FirstHints`: `FirstHints`, `FirstHintsOptions`, `HintControl`, `HintTrigger`
- `@wildshard/engine/ui/haptics`: `buzz`, `CAN_VIBRATE`, `HAPTIC`
- `@wildshard/engine/ui/HUD`: `bearingTo`, `HUD`, `HUDOptions`, `HUDState`, `IntroStats`, `TitleDeckFactory`, `TitleDeckView`, `WEATHER_EVENT`, `WeatherHUD`
- `@wildshard/engine/ui/hudAdapters`: `hudAdapters`
- `@wildshard/engine/ui/hudSlots`: `DiscOpts`, `DiscSpot`, `HudBand`, `hudSlots`, `HudSlots`, `ROW`, `TouchRelabel`
- `@wildshard/engine/ui/HurtArc`: `deathCause`, `deathLine`, `HurtArc`, `respawnWhere`
- `@wildshard/engine/ui/icons`: `icon`, `IconId`, `IconMap`, `iconParts`, `registerIcons`
- `@wildshard/engine/ui/ItemCard`: `ItemCardPop`, `ItemCardSpec`, `ItemCardState`, `itemCardTile`
- `@wildshard/engine/ui/layers`: `UiHandle`, `UiLayer`, `UiLayers`, `UiView`
- `@wildshard/engine/ui/Loading`: `Loading`
- `@wildshard/engine/ui/LockOn`: `LockOn`
- `@wildshard/engine/ui/Map`: `FullMap`, `MapPoi`, `MapQuest`, `MapZone`
- `@wildshard/engine/ui/Menu`: `GameMenu`, `GameMenuOptions`, `KitEntry`, `MenuGroup`, `MenuTab`, `SkinRow`
- `@wildshard/engine/ui/Minimap`: `LAYER_PPM`, `MapExtraImage`, `MapExtraLabel`, `MapExtraRect`, `MapExtras`, `MapFeatures`, `MapMark`, `MapOverlay`, `MapPoi`, `mapPois`, `Minimap`, `MinimapAnimal`, `MinimapPalette`
- `@wildshard/engine/ui/ownership`: `mountUi`, `uiScope`
- `@wildshard/engine/ui/Perf`: `Perf`, `PerfBudget`
- `@wildshard/engine/ui/playerDeath`: `installPlayerDeath`
- `@wildshard/engine/ui/playerHurt`: `HurtPlayer`, `PlayerHurt`, `PlayerHurtPorts`
- `@wildshard/engine/ui/ReloadPrompt`: `askReload`, `currentPose`, `reloadWithPicks`, `setPoseProvider`
- `@wildshard/engine/ui/Resume`: `BRAND_KEY`, `resumeHtml`, `resumeProgress`, `resumeScreen`, `SHOT_KEY`
- `@wildshard/engine/ui/review`: `CATEGORIES`, `Category`, `ContextValue`, `flushQueue`, `INBOX_URL`, `loadState`, `lockReview`, `NotePayload`, `onReview`, `QUEUE_MAX`, `queuedCount`, `quickNote`, `readQueue`, `ReviewDesk`, `reviewUnlocked`, `sendNote`, `setQuickNote`, `StorageLike`, `unlockReview`, `writeQueue`
- `@wildshard/engine/ui/roomMap`: `arenaMap`, `fitRoom`, `paintRoom`, `ROOM_BG`, `RoomMap`, `RoomMarker`, `RoomShape`, `RoomView`
- `@wildshard/engine/ui/RotateGate`: `rotateGated`
- `@wildshard/engine/ui/Settings`: `BOOT_OPTIONS`, `createSettings`, `getMusicStyle`, `getNumber`, `getSetting`, `getSfxSet`, `MUSIC_STYLES`, `MusicStyle`, `NUM_RANGE`, `NumberKey`, `onMusicStyle`, `onNumber`, `onSetting`, `onSettingChange`, `onSfxSet`, `OPTION_VALUES`, `OptionKey`, `OptionValue`, `overrideSetting`, `pendingReload`, `savedSetting`, `saveSetting`, `setMusicStyle`, `setNumber`, `setSetting`, `setSfxSet`, `setting`, `settingFromUrl`, `SettingKey`, `settingParams`, `Settings`, `settingsReloadUrl`, `SFX_SETS`, `SfxSet`
- `@wildshard/engine/ui/SpeedLines`: `SpeedLines`
- `@wildshard/engine/ui/tabs`: `TabFragment`, `TabId`, `TabRegistry`, `TabSpec`
- `@wildshard/engine/ui/WeaponStrip`: `WeaponStrip`
- `@wildshard/engine/ui/WindupWarn`: `Warned`, `WindupWarn`
- `@wildshard/engine/world/Atmosphere`: `addFogUniforms`, `atmosphereTerms`, `attachFogUniforms`, `fogUniforms`, `installAtmosphere`, `isUnderwater`, `setUnderwater`, `updateUnderwater`, `volumetricFog`, `weatherFog`, `WeatherFog`, `WeatherFogSpec`, `weatherFogUniforms`, `weatherUniforms`
- `@wildshard/engine/world/BakedCards`: `bakedCardUrls`, `CardTextures`, `exportCardTextures`, `loadBakedCards`
- `@wildshard/engine/world/BakedTerrain`: `BakedGrid`, `BakedPlacement`, `bakedSamplers`, `bakedTerrainUrl`, `bakedUndergrowth`, `loadBakedTerrain`, `parseBakedTerrain`
- `@wildshard/engine/world/blenderArea`: `BlenderArea`, `blenderAreaFor`, `blenderModelsBase`, `CELL`, `STEP`
- `@wildshard/engine/world/Boundary`: `Boundary`
- `@wildshard/engine/world/bounds`: `BoundsHost`, `installBounds`
- `@wildshard/engine/world/cascadeLights`: `cascadeOf`, `CascadeSet`, `ghostOf`, `isCascadeGhost`, `registerCascades`
- `@wildshard/engine/world/coarseTileMask`: `coarseTileMask`
- `@wildshard/engine/world/csmLightBlock`: `patchCSMShaderChunk`
- `@wildshard/engine/world/dayCycle`: `compassDir`, `DayCycle`, `DayCycleClock`, `DayCycleSpec`, `DayKeys`, `DayPhase`, `LightPreset`, `PhaseListener`, `phaseOfHour`, `ScheduleSeg`, `smooth`, `TimePick`
- `@wildshard/engine/world/declaredProps`: `DeclaredProps`, `installDeclaredProps`, `InstalledProps`
- `@wildshard/engine/world/faunaLayout`: `FaunaCell`, `FaunaGroup`, `FaunaLayoutOpts`, `layoutFauna`, `layoutFaunaCells`
- `@wildshard/engine/world/forest/Forest`: `Forest`, `FOREST_BANDS`, `trunkCapsule`
- `@wildshard/engine/world/forest/placement`: `DecisionLog`, `FERN_MAX`, `LITTER_MAX`, `MOSS_MAX`, `placeForest`, `Placement`, `placementChecksum`, `placeUndergrowth`, `PlantSpec`, `plantSpecs`, `REED_MAX`, `sameChecksum`, `SHRUB_MAX`, `STONE_MAX`, `TreeGrid`, `TreeInstance`, `UNDER_KINDS`, `UnderPlacements`
- `@wildshard/engine/world/forest/treeSet`: `BARK_LAYERS`, `CrownTop`, `crownTopUniforms`, `loadTreeSetGeometry`, `patchBarkArrays`, `patchCardCrownTop`, `patchImpostorCrownTop`, `standIn`, `TREE_SET_PARTS`, `treeSetFiles`, `TreeSetPart`, `treeSetUrls`
- `@wildshard/engine/world/forest/treeSpec`: `TREE_SPECS`, `treeSetOf`
- `@wildshard/engine/world/forest/treeSpecies`: `SpeciesWeights`, `TreeSetVariant`, `TreeSpecies`, `TreeSpeciesTraits`
- `@wildshard/engine/world/geometryKit`: `beam`, `blob`, `lathe`, `log`, `mergeVerticesByPos`, `plank`, `pole`, `revolve`, `revolveUV`, `rock`, `rope`, `sagLine`, `tris`, `wobble`
- `@wildshard/engine/world/Grass`: `Grass`, `GrassTrampleField`, `TrampleField`
- `@wildshard/engine/world/groundField`: `terrainFieldFor`
- `@wildshard/engine/world/Heightfield`: `_installBakedTerrain`, `CABIN_SITES`, `cabinMask`, `hasPond`, `heightAt`, `inChunk`, `normalAt`, `overrideTerrain`, `POND`, `pondMask`, `splatAt`, `streamAt`, `trailDistance`, `TRAILS`, `waterLevel`
- `@wildshard/engine/world/Horizon`: `Horizon`, `horizonLight`
- `@wildshard/engine/world/HorizonMatte`: `HORIZON_RADIUS`, `HorizonMatte`, `horizonStrips`, `HorizonStrips`, `levelHorizonStrips`, `PaintedHorizon`
- `@wildshard/engine/world/interact/flags`: `FlagListener`, `Flags`, `test`
- `@wildshard/engine/world/interact/Interactables`: `BARREL_BODY`, `BARREL_LOST_T`, `BARREL_SEA_DEPTH`, `BARREL_UNDER`, `BARREL_WEDGE_T`, `BarrelEnv`, `BarrelWatch`, `canSee`, `Interactables`, `InteractEvent`, `InteractHost`, `Live`, `pickInteractable`, `plateDown`, `setSight`, `Sight`, `SIGHT_SLACK`
- `@wildshard/engine/world/interact/kit`: `interactParts`
- `@wildshard/engine/world/interact/types`: `AltarDef`, `autoFlag`, `BarrelDef`, `BeaconDef`, `BenchDef`, `ChestDef`, `ChestDims`, `ChestItem`, `ChestLook`, `Cond`, `DoorDef`, `DoorLook`, `flagsRaised`, `flagsRead`, `Interactable`, `InteractDef`, `InteractKind`, `interactProps`, `InteractProps`, `InteractTable`, `KeyDef`, `LeverDef`, `PickupDef`, `pickupLook`, `PickupLook`, `PickupPart`, `Place`, `PlateDef`, `PoiId`, `registerInteractProps`, `registerPickupLook`, `TRANSIENT_PREFIXES`
- `@wildshard/engine/world/lowpolyKit`: `AddOpts`, `AOOptions`, `bakeAO`, `BakedLight`, `bakeLight`, `broadClump`, `ColorLike`, `fern`, `grassTuft`, `hibiscus`, `hibiscusBush`, `leaf`, `lilyPad`, `lotus`, `LowPolyKit`, `lowPolyMaterial`, `Part`, `PLANT`, `vineStrand`
- `@wildshard/engine/world/painterly`: `painterlyKnobs`, `PainterlyKnobs`, `PainterlyLook`, `painterlyMaterial`, `PainterlyOpts`, `painterlyUniforms`, `paintGeometry`, `setPainterlyLook`, `syncPainterlySun`, `updatePainterly`
- `@wildshard/engine/world/pond`: `Water`
- `@wildshard/engine/world/pondGrid`: `pondGrid`
- `@wildshard/engine/world/registry`: `activeRegistry`, `boxDesc`, `ColliderDesc`, `DrawnAs`, `installWorldRegistry`, `ModelCategory`, `ModelEntry`, `ModelFacts`, `Piece`, `PieceCategory`, `Pipeline`, `RegisteredModel`, `RegisteredPick`, `RegisteredSet`, `SetPlacement`, `WorldRegistry`
- `@wildshard/engine/world/shadowFade`: `installShadowFadeChunk`, `ShadowFade`, `sunFadeUniform`
- `@wildshard/engine/world/shadowFilter`: `installShadowFilter`, `SOFT_RADII`, `tentShadowFilterOn`
- `@wildshard/engine/world/skyRig`: `shadowRig`, `ShadowRig`, `SkyRig`
- `@wildshard/engine/world/steppeWind`: `wind`, `Wind`, `WIND_GLSL`
- `@wildshard/engine/world/Terrain`: `Terrain`
- `@wildshard/engine/world/terrainField`: `buildTerrain`, `landscapeHash`
- `@wildshard/engine/world/terrainHeight`: `setTerrainDatum`, `setTerrainHeight`, `setTerrainPlacement`, `terrainDatum`, `terrainHeight`, `terrainNormal`, `terrainWaterLevel`
- `@wildshard/engine/world/terrainTileData`: `decodeTerrainTile`, `encodeTerrainTile`, `isTerrainTileData`, `terrainTileCost`, `TerrainTileData`, `terrainTileHeight`
- `@wildshard/engine/world/terrainTileView`: `installTerrainTile`, `maskTerrainTile`
- `@wildshard/engine/world/TreeFactory`: `FadeBand`, `forestFade`, `patchFade`, `patchWind`, `TreeFactory`, `TreeMaterial`, `TreeVariant`, `windUniforms`
- `@wildshard/engine/world/voxelAO`: `aoTint`, `HemiDir`, `HemiRing`, `hemisphere`, `voxelAO`, `VoxelAOParams`
- `@wildshard/engine/world/water/body`: `basinBody`, `swellBody`, `WaterBodies`, `WaterBody`
- `@wildshard/engine/world/water/declared`: `declaredWaterBody`, `dryEntryContains`, `DryEntryEdge`, `WaterDeclaration`
- `@wildshard/engine/world/water/view`: `surfaceReflect`, `waterView`, `WaterView`
- `@wildshard/engine/world/waterSurface`: `buildSkyline`, `createWaterMaterial`, `WaterMaterial`, `WaterMaterialOptions`, `waterTexture`, `waterTime`, `waterWeather`
- `@wildshard/engine/world/waves`: `insideWaterExtent`, `seaDamp`, `WATER_UNBOUNDED`, `waterExtent`, `waveClock`, `waveDisplace`, `waveHeight`, `WAVES`, `WAVES_GLSL`, `WAVES_NORMAL_GLSL`
- `@wildshard/engine/world/weather`: `Weather`, `WeatherFrame`, `WeatherNumbers`, `WeatherProfile`
- `@wildshard/engine/world/wind`: `FRONT_LEN`, `FRONT_SPEED`, `FRONT2_LEN`, `patchSway`, `patchWindField`, `swayByHeight`, `swayDepthMaterial`, `updateWind`, `WIND_DIR`, `WIND_FIELD_GLSL`, `windBoost`, `windGustAt`, `windStrength`, `windUniforms`

### `@wildshard/game` (`src/game/package.json`)

534 exports, grouped by the module to import them from.

- `@wildshard/game/achievements`: `AchievementDef`, `achievementsFor`, `registerAchievements`
- `@wildshard/game/bag/bag`: `BagHas`, `bagTabs`, `CosmeticSlot`, `FindsView`, `GearLoot`, `GearOpts`, `GearTool`, `renderFinds`, `renderGear`
- `@wildshard/game/bag/itemCatalog`: `isItemId`, `ITEMS`, `registerItemRow`
- `@wildshard/game/bag/items`: `ItemRow`, `normalizeItemRow`, `RegisteredItemRow`
- `@wildshard/game/bag/tabs`: `BagIcons`, `BagLoot`, `bagMenu`, `BagMenu`, `BagMenuOptions`
- `@wildshard/game/Boss`: `Boss`, `BossDef`, `BossHost`, `BossPhaseDef`, `BossReward`
- `@wildshard/game/compendium/install`: `CompendiumHost`, `CompendiumWallPort`, `installCompendium`
- `@wildshard/game/compendium/Journal`: `Journal`, `loadHandFont`, `silhouetteOf`
- `@wildshard/game/compendium/state`: `COMPENDIUM_STORE`, `CompendiumState`
- `@wildshard/game/compendium/types`: `AnimalMatch`, `CompendiumSkin`, `EntryDef`, `EntryKind`, `EntryState`, `EntryStats`, `Plate`, `ShardCompendium`, `STATE_ORDER`, `TabDef`, `TrophySlot`, `WallPlacement`
- `@wildshard/game/complete/ShardComplete`: `completeEntry`, `CompleteEntry`, `CompleteHandlers`, `CompleteStat`, `setCompleteEntry`, `ShardComplete`, `ShardCompleteData`, `shardCompleteUp`
- `@wildshard/game/cosmetics/bodyShadow`: `BodyHost`, `BodyPlayer`, `BodyShadow`, `installBodyShadow`
- `@wildshard/game/cosmetics/locker`: `CosmeticDef`, `CosmeticProfile`, `CosmeticsLocker`, `CosmeticState`, `SkinLocker`
- `@wildshard/game/Elite`: `EliteDef`, `EliteHost`, `EliteRule`, `Elites`, `EliteScript`, `GroundTell`, `GroundTellWedgeStyle`
- `@wildshard/game/grid/assembly`: `EmptyNeighbour`, `GridAssembly`, `GridCell`, `GridPoint`, `GridSide`
- `@wildshard/game/grid/catalogue`: `GridCatalogue`, `GridCatalogueSchema`, `GridMode`, `GridPlacement`, `parseGridCatalogue`
- `@wildshard/game/grid/crossing`: `GridCrossing`, `GridCrossingDriver`, `GridCrossingPorts`, `GridCrossingSession`, `GridCrossingState`, `installGridCrossing`, `PreparedGridCrossing`
- `@wildshard/game/grid/edgeProfiles`: `GridEdgeObservations`, `GridEdgeSource`, `loadGridEdgeProfiles`
- `@wildshard/game/grid/instances`: `firstPartyInstance`, `templateInstance`
- `@wildshard/game/grid/live`: `LiveGridAdmission`, `LiveGridFrame`, `LiveGridHome`, `LiveGridHost`, `LiveGridPorts`, `LiveGridRegion`, `LiveGridState`
- `@wildshard/game/grid/pageBoot`: `PageResidencyBoot`, `preflightGridReload`, `preparePageResidency`, `validatePlannedGridReload`
- `@wildshard/game/grid/reloadBoot`: `consumeGridReloadBoot`, `finishPlannedGridReload`, `GridReloadBoot`, `installPlannedGridReload`, `plannedGridReload`
- `@wildshard/game/grid/rules`: `gridCanAct`, `GridCombatRules`, `GridHoverPort`, `gridHoverSpeed`, `GridPresence`, `GridTravelMember`, `GridTravelUnit`, `gridZone`, `installGridHoverSpeed`, `installGridTravellerCombat`, `reframeGridUnit`
- `@wildshard/game/grid/simulation`: `GridResident`, `GridSimLease`, `GridSimulation`, `GridSimulationPorts`, `PreparedGridFrame`, `PreparedGridUnload`
- `@wildshard/game/grid/state`: `regionalState`
- `@wildshard/game/grid/wallet`: `GridLoadout`, `GridWallet`, `installGridLoadout`, `stowGridEquipment`, `stowGridMount`
- `@wildshard/game/instanceSaves`: `instanceSave`, `instanceSaveIdentity`, `LocalSaveInstance`
- `@wildshard/game/Inventory`: `harvestOf`, `Inventory`, `ItemId`, `PACK_SLOTS`
- `@wildshard/game/ledger`: `installLedgerEmitter`, `Ledger`, `LedgerCatalogueItem`, `LedgerEmitter`, `ledgerFactId`, `LedgerInstance`, `LedgerReceipt`, `LedgerRewardPolicy`
- `@wildshard/game/loot/CoinBurst`: `CoinBurst`, `nearScale`
- `@wildshard/game/loot/coinModel`: `coinModel`, `installCoinModel`
- `@wildshard/game/loot/deaths`: `CreatureDeathSource`, `DEATH_ORDER`, `onCreatureDeath`
- `@wildshard/game/loot/Owned`: `CosmeticId`, `isCosmetic`, `isOwnedId`, `Owned`, `OWNED`, `OwnedId`, `OwnedKind`
- `@wildshard/game/loot/runtime`: `installLoot`, `LootBody`, `LootPresentation`, `LootShop`, `ScopedLoot`, `ScopedLootHost`
- `@wildshard/game/loot/tables`: `getLootTable`, `LootContext`, `LootTableRow`, `registerLootTable`, `rollLoot`
- `@wildshard/game/loot/ui/ShopPanel`: `ShopCost`, `ShopGood`, `ShopOpts`, `ShopPanel`, `ShopSlate`, `ShopState`
- `@wildshard/game/newGame`: `NewGameProgress`, `NewGameQuest`, `NewGameSummary`, `previewNewGame`, `resetNewGame`
- `@wildshard/game/Progress`: `Progress`, `ProgressRow`, `ProgressSink`
- `@wildshard/game/quest/declared`: `createQuestScriptPorts`, `DeclaredQuests`, `DialogueView`, `QuestDataPorts`, `QuestScriptBindings`, `QuestScriptPorts`
- `@wildshard/game/quest/presentation`: `installQuestPresentation`, `PresentedQuestDef`, `PresentedQuestStep`, `presentQuest`, `QuestPresentation`, `QuestPresentationContext`, `QuestPresentationHost`, `QuestPresentationNpc`, `QuestPresentationOptions`, `QuestTarget`
- `@wildshard/game/quest/reward`: `QuestRewardBeat`, `QuestRewardHost`, `QuestRewardPlayer`, `QuestRewardSpec`
- `@wildshard/game/saves`: `bossesSave`, `bountySave`, `compendiumSave`, `elitesSave`, `inventorySave`, `ownedSave`, `progressSave`, `purseSave`, `saveSlug`, `shardSave`
- `@wildshard/game/shard/context`: `BagVerbs`, `GameRowMap`, `GameRows`, `GameServices`, `shardContext`, `ShardContext`, `ShardCube`
- `@wildshard/game/shard/declaredEncounters`: `installDeclaredEncounters`
- `@wildshard/game/shard/declaredPlumbing`: `installDeclaredPlumbing`, `PlumbingHandles`, `PlumbingPorts`
- `@wildshard/game/shard/declaredRows`: `declaredCompendium`, `declaredDay`, `declaredLootPresentation`, `declaredSpeciesLook`, `declaredWeather`
- `@wildshard/game/shard/declaredUi`: `DeclaredUiPorts`, `mountDeclaredUi`
- `@wildshard/game/shard/manifest`: `CabinSite`, `ChunkAssets`, `ChunkAtmosphere`, `ChunkForest`, `ChunkGrade`, `ChunkHorizon`, `ChunkHud`, `ChunkLook`, `ChunkMapDef`, `ChunkPoi`, `ChunkSky`, `ChunkStructures`, `ChunkStyle`, `ChunkTerrain`, `ChunkTrees`, `ChunkWeapon`, `FaunaKind`, `FieldModelsContext`, `formatGrid`, `HerdPlan`, `hitDamage`, `HorizonBand`, `HorizonRing`, `KnownChunkStyle`, `MapLook`, `OceanDef`, `PondDef`, `RGB`, `ShardManifest`, `ShardSword`, `SpawnPose`, `StructureContext`, `terrainFor`, `TerrainNoise`, `TerrainSpec`, `Vec2`
- `@wildshard/game/shard/plugin`: `ShardPlugin`
- `@wildshard/game/shard/registry`: `chunkSlugFromUrl`, `chunkUrl`, `defaultChunk`, `defaultShard`, `findChunk`, `findShard`, `game`, `getActiveChunk`, `onActiveChunkChange`, `playable`, `setActiveChunk`, `shardSlugFromUrl`
- `@wildshard/game/shard/retainedHooks`: `installEnteredRuntimeService`, `RetainedRuntimeHooks`, `retainsRuntimeServices`
- `@wildshard/game/shard/runtime`: `resolveLevelBounds`, `ShardPlayHooks`, `ShardPlayHost`, `ShardRuntime`
- `@wildshard/game/shard/runtimeVariant`: `runtimeVariantEnabled`
- `@wildshard/game/shard/scopedRuntime`: `bindScopedRuntime`, `createScopedRuntimeBinding`, `ScopedRuntimeBinding`
- `@wildshard/game/shard/slug`: `parseShardSlug`, `ValidatedShardSlug`
- `@wildshard/game/shardfile/accent`: `ACCENT_IDS`, `AccentId`, `ACCENTS`, `AccentSchema`, `accentVars`, `parseAccent`, `ROAD_ACCENT`
- `@wildshard/game/shardfile/admissionLimits`: `SHARDFILE_ADMISSION_LIMITS`
- `@wildshard/game/shardfile/assetGraph`: `preflightAssetGraph`
- `@wildshard/game/shardfile/assets`: `assetCost`, `AssetCost`, `assetOverdraw`, `parseAudio`, `parseGlb`, `parseKtx2`, `visitGlbTriangles`
- `@wildshard/game/shardfile/audio`: `AudioData`, `AudioDataSchema`, `parseAudioData`
- `@wildshard/game/shardfile/brainRuntime`: `DeclaredBrainPorts`, `DeclaredBrainRecipe`, `DeclaredNativeBrain`, `installDeclaredBrains`
- `@wildshard/game/shardfile/brains`: `GuardianSchema`, `parseGuardian`, `parsePerchHunter`, `parseScriptBrain`, `parseSkirmisher`, `PerchHunterSchema`, `ScriptBrainSchema`, `ShardGuardian`, `ShardPerchHunter`, `ShardScriptBrain`, `ShardSkirmisher`, `SkirmisherSchema`
- `@wildshard/game/shardfile/budget`: `worstContentCost`
- `@wildshard/game/shardfile/clientScripts`: `ClientScriptContent`, `clientScriptRules`, `ClientScriptsSchema`, `ClientScriptTarget`, `clientScriptViewCost`, `createShardfileClientScripts`, `parseClientScripts`, `ShardClientScripts`, `ShardfileClientScriptPorts`
- `@wildshard/game/shardfile/commonsCosts`: `assertCommonsCosts`, `CommonsCosts`, `CommonsCostSchema`, `CommonsCostsSchema`
- `@wildshard/game/shardfile/creatures`: `creatureRules`, `CreaturesSchema`, `ShardCreatures`
- `@wildshard/game/shardfile/director`: `DirectorData`, `DirectorEvent`, `DirectorSchema`, `parseDirector`
- `@wildshard/game/shardfile/directorClient`: `DirectorInstallation`, `directorVariant`, `installDeclaredDirector`
- `@wildshard/game/shardfile/directorRuntime`: `createDirectorLane`, `DirectorLane`
- `@wildshard/game/shardfile/encounters`: `encounterRules`, `EncountersSchema`, `ShardEncounters`
- `@wildshard/game/shardfile/flyers`: `BurstFlyerSchema`, `OrbitDiverSchema`, `parseBurstFlyer`, `parseOrbitDiver`, `parsePatrolDiver`, `PatrolDiverSchema`, `ShardBurstFlyer`, `ShardOrbitDiver`, `ShardPatrolDiver`
- `@wildshard/game/shardfile/grazers`: `ChallengeGrazerSchema`, `parseChallengeGrazer`, `parseRamGrazer`, `RamGrazerSchema`, `ShardChallengeGrazer`, `ShardRamGrazer`
- `@wildshard/game/shardfile/groupBrains`: `groupBrainRules`, `GroupBrainSchema`, `HerdGroupSchema`, `PackGroupSchema`, `parseGroupBrain`, `ShardGroupBrain`, `ShardHerdGroup`, `ShardPackGroup`
- `@wildshard/game/shardfile/groupRuntime`: `DeclaredGroupPolicy`, `DeclaredGroupPorts`, `DeclaredHerdRecipe`, `DeclaredPackRecipe`, `prepareDeclaredGroupBrains`, `PreparedGroupBrains`
- `@wildshard/game/shardfile/hybrid`: `HybridCellBinding`, `hybridInstallation`, `HybridResident`, `HybridResidentWorld`, `HybridRuntimeSession`, `HybridRuntimeState`, `hybridShardManifest`, `HybridShardPlugin`, `installHybridRuntime`, `prepareHybridShard`
- `@wildshard/game/shardfile/items`: `DeclaredItemPorts`, `DeclaredItems`, `declaredItemScriptEntities`, `installDeclaredItems`, `itemRules`, `ItemsSchema`, `parseItems`, `ShardItems`
- `@wildshard/game/shardfile/json`: `isJsonData`
- `@wildshard/game/shardfile/ledger`: `LedgerFact`, `LedgerFactSchema`, `LedgerRule`, `LedgerRulesSchema`, `parseLedgerRules`
- `@wildshard/game/shardfile/loader`: `browserShardfileOptions`, `configuredShardfile`, `emptyShardfileSource`, `installManifestShardfile`, `installShardfileProduct`, `installShardfileSource`, `loadShardfile`, `shardfileLevelSpec`, `shardfileSource`
- `@wildshard/game/shardfile/migrations`: `assertMigrationCompatibility`, `DeclaredMigrations`, `LogicalState`, `LogicalStateSchema`, `migrateLogicalState`, `MigrationFieldDeclaration`, `migrationRules`, `MigrationsSchema`, `parseMigrations`
- `@wildshard/game/shardfile/moverRuntime`: `createMoverHost`, `installDeclaredMovers`, `MoverInstallation`, `MoverPorts`, `moverQueries`, `MoverRuntime`, `MoverView`
- `@wildshard/game/shardfile/movers`: `MOVER_FIELD_RANGES`, `MOVER_FIELDS`, `MoverData`, `moverScriptEntities`, `MoversSchema`, `parseMovers`
- `@wildshard/game/shardfile/plumbing`: `parsePlumbing`, `PlumbingData`, `plumbingRules`, `PlumbingSchema`
- `@wildshard/game/shardfile/preflight`: `preflightShardfile`
- `@wildshard/game/shardfile/product`: `admitProduct`, `AdmittedProduct`, `boundedResponse`, `browserContentHash`, `browserProductCache`, `CachedProduct`, `ProductCache`, `ProductOptions`, `ProductVersions`
- `@wildshard/game/shardfile/props`: `propColliderDescriptors`, `PropsSchema`, `ShardProps`, `validatePropsReferences`
- `@wildshard/game/shardfile/quests`: `parseQuestData`, `QuestData`, `questDataRules`, `QuestDataSchema`
- `@wildshard/game/shardfile/readiness`: `criticalWireBytes`, `CriticalWireSource`
- `@wildshard/game/shardfile/revision`: `assertStateCompatibility`, `parseStateLineage`
- `@wildshard/game/shardfile/rows`: `parseRows`, `rowRules`, `RowsSchema`, `scoredStrikes`, `ShardRows`, `simStrikes`, `speciesResolver`
- `@wildshard/game/shardfile/runtime`: `prepareTrustedRuntime`, `RuntimeDeclaration`, `RuntimeSchema`, `TrustedRuntimeEntry`
- `@wildshard/game/shardfile/schema`: `LOOK_LUT_BYTES`, `parseShardfile`, `Shardfile`, `shardfileRules`, `ShardfileSchema`
- `@wildshard/game/shardfile/scriptComposition`: `createShardfileComposedLane`, `DeclaredScriptBrainActor`, `DeclaredScriptBrainPorts`
- `@wildshard/game/shardfile/scripts`: `createShardfileScriptLane`, `numericScriptState`, `prepareShardfileScriptOptions`, `scriptBindingRules`, `ScriptBindingsSchema`, `ShardScriptBindings`, `ShardScriptContent`, `ShardScriptField`, `ShardScriptPorts`
- `@wildshard/game/shardfile/simulation`: `bindShardfileSim`, `createShardfileSim`, `numericScriptEntityId`, `ShardfileSimPorts`, `ShardfileSimulation`
- `@wildshard/game/shardfile/skinLayers`: `skinLayerDecoded`, `SkinPoseLayer`, `SkinPoseLayerSchema`, `validateSkinLayers`
- `@wildshard/game/shardfile/terrain`: `ShardTerrain`, `TerrainSchema`, `validateTerrainAssets`
- `@wildshard/game/shardfile/traversal`: `parseTraversal`, `ShardTraversal`, `TraversalSchema`
- `@wildshard/game/shardfile/ui`: `ShardUi`, `ShardUiDeclaration`, `UI_DECLARATIONS_MAX`, `uiRules`, `UiSchema`
- `@wildshard/game/shardfile/validate`: `validateShardfileAssets`
- `@wildshard/game/shardfile/version`: `SHARDFILE_VERSION`
- `@wildshard/game/shardfile/water`: `shardfileWater`, `ShardWater`, `WaterSchema`
- `@wildshard/game/travel/travel`: `applyTravelCarry`, `bindTravelInventory`, `consumeTravelHandoff`, `replaceTravelDocument`, `travel`, `TravelHandoff`, `TravelRequest`, `travelService`, `travelSlot`, `TravelSource`

### `@wildshard/kit` (`src/kit/package.json`)

217 exports, grouped by the module to import them from.

- `@wildshard/kit/audio/creatureVoices`: `CREATURE_VOICES`, `CreatureVoice`, `CreatureWindup`, `vocal`, `windup`
- `@wildshard/kit/audio/forest`: `createForestAudio`, `installForestAmbience`, `installSilentScore`
- `@wildshard/kit/audio/weaponVoices`: `declaredWeaponVoices`, `sharedWeaponVoices`, `WeaponSynth`
- `@wildshard/kit/effects/install`: `installStarterEffects`
- `@wildshard/kit/effects/starter`: `STARTER_CHOICES`, `STARTER_EFFECTS`, `StarterChoice`, `starterId`
- `@wildshard/kit/icons`: `BAG_ICONS`, `installKitIcons`
- `@wildshard/kit/items/declared`: `declaredKitItemFamilies`
- `@wildshard/kit/lookApi`: `loadGrassField`, `loadParticles`
- `@wildshard/kit/looks/fogProgram`: `fogGLSL`
- `@wildshard/kit/looks/grassField`: `configureGrassField`, `flowerPatchAt`, `flowerSpeciesAt`, `grassBaseHeightAt`, `grassBloomAt`, `GrassFieldLayout`, `grassToneAt`, `groundColorAt`, `TALL_GRASS`, `trailGrass`
- `@wildshard/kit/looks/particles`: `makeMistTexture`, `Particles`
- `@wildshard/kit/looks/trample`: `grassHeightAt`, `GrassTrample`, `MAX_MOVERS`, `RECOVER`, `trample`, `TRAMPLE_GLSL`
- `@wildshard/kit/models/creatures`: `bear`, `boar`, `deer`
- `@wildshard/kit/models/pickups`: `carvedToken`, `carvedTokenGeometry`, `doubloon`, `flintKit`, `flintKitGeometry`, `glyphShard`, `glyphShardGeometry`, `installKitPickups`, `resinDrop`, `resinDropGeometry`, `seaGlass`, `seaGlassGeometry`, `tokenRimGeometry`
- `@wildshard/kit/npc/faceHeads`: `faceHead`, `FaceHead`, `loadFaceHead`
- `@wildshard/kit/npc/figureMotion`: `NpcFigureMotionProfile`, `npcFigurePose`, `NpcFigureState`, `stepNpcFigure`
- `@wildshard/kit/npc/figureRig`: `fitNpcFigure`, `mergeNpcFigures`, `NpcFigure`, `NpcFigureBones`, `NpcFigureFrame`, `NpcFigureRig`, `packNpcAtlases`
- `@wildshard/kit/npc/npcRig`: `footPlan`, `LEG_BONE_NAMES`, `legBones`, `LegBuilt`, `legPose`, `LegPoseIn`, `legRigOf`, `NpcFace`, `NpcModel`, `NpcRig`, `NpcRigProfile`, `NpcRow`, `rigLegs`, `WALK`
- `@wildshard/kit/species/bear`: `BEAR`, `BEAR_TUNING`
- `@wildshard/kit/species/boar`: `BOAR`, `BOAR_TUNING`
- `@wildshard/kit/species/view/bear`: `BEAR_LOOK`, `BEAR_PALETTE`
- `@wildshard/kit/species/view/boar`: `BOAR_LOOK`, `BOAR_PALETTE`
- `@wildshard/kit/viewmodel/armClips`: `ARM_CLIPS`, `armClipNames`, `SWIM_CLIPS`
- `@wildshard/kit/viewmodel/armRig`: `armConst`, `ArmConst`, `ArmWorld`, `BONES`, `buildBones`, `frameYZ`, `GRIP`, `HandSpec`, `JointAngles`, `LEFT_HAND`, `LEFT_SCALE`, `LIMITS`, `measure`, `Pose`, `RIGHT_HAND`, `settleLeft`, `Side`, `signedAngle`, `softLimit`, `solveArm`, `TWISTS`, `twoBone`
- `@wildshard/kit/viewmodel/hunterHands`: `blendGrip`, `BUCKSKIN`, `COAT_FROM`, `coatMaterialParams`, `coatTextures`, `gripPose`, `GripPose`, `gripQuat`, `HandDef`, `handGeometry`, `HandGeometry`, `HandHold`, `HANDS_MATERIAL`, `HandSpec`, `holdDef`, `HUNTER_PAL`, `hunterCoatSleeve`, `hunterGauntlet`, `hunterSleeve`, `V3`, `WeaponHands`, `withHunterPalette`
- `@wildshard/kit/viewmodel/rigArms`: `RigArms`, `RigMeta`, `RigState`, `swordArmsOf`, `VM_FOV`, `VmFrame`, `vmScale`
- `@wildshard/kit/weapons/bow/family`: `Bow`, `BowOptions`, `BowWorld`
- `@wildshard/kit/weapons/bow/index`: `AIM_IN`, `AIM_SPREAD`, `AIM_SWAY`, `AIM_VM_ZOOM`, `AIM_ZOOM`, `QUIVER_MAX`
- `@wildshard/kit/weapons/bow/profile`: `BowProfile`, `BowStyle`, `BowView`, `GripPose`
- `@wildshard/kit/weapons/bow/profiles`: `BOW`
- `@wildshard/kit/weapons/bow/recurve`: `ARROW_LEN`, `arrowKind`, `arrowMaterial`, `bowSpecimen`, `BowStyle`, `buildArrowGeometry`, `buildRecurve`, `POSE`, `VM_SHADE`
- `@wildshard/kit/weapons/crossbow/Crossbow`: `boltFlightStep`, `BoltMod`, `buildBolt`, `buildCrossbow`, `Crossbow`, `CrossbowParts`, `MAX_BOLTS`, `PLAIN_BOLT`
- `@wildshard/kit/weapons/crossbow/display`: `crossbowDisplayModel`
- `@wildshard/kit/weapons/crossbow/profiles`: `CROSSBOW_PROFILE`, `CrossbowProfile`
- `@wildshard/kit/weapons/equipment`: `IRON_SWORD`, `SWORD`, `WOODEN_SWORD`
- `@wildshard/kit/weapons/firearm/Firearm`: `Firearm`
- `@wildshard/kit/weapons/firearm/profiles`: `AR15`, `FirearmProfile`
- `@wildshard/kit/weapons/firearm/Rifle`: `buildRifleParts`, `Rifle`, `RifleOptions`, `RifleParts`
- `@wildshard/kit/weapons/melee/Melee`: `isMeleeProfile`, `Melee`, `meleeActor`, `MeleeProfile`, `ViewmodelFeel`
- `@wildshard/kit/weapons/melee/moves`: `BACKHAND`, `CHARGE`, `COMBO`, `FINISHER`, `HEAVY`, `key`, `poseQuat`, `REST`, `SLASH`, `SPRINT`
- `@wildshard/kit/weapons/melee/profiles`: `SWORD_IRON`, `SWORD_WOOD`
- `@wildshard/kit/weapons/melee/SweptMelee`: `buildSword`, `HEAVY_CHARGE`, `REACH`, `Sword`, `swordEvents`, `swordMaterial`, `SwordOptions`
- `@wildshard/kit/weapons/thrown/Thrown`: `Thrown`, `ThrownProfile`
- `@wildshard/kit/weapons/ui`: `SWAP_GLYPHS`
- `@wildshard/kit/weather/rainCurtain`: `rainCurtain`, `RainCurtainSpec`, `RainProgram`

### `@wildshard/sdk` (`src/sdk/package.json`)

110 exports, grouped by the module to import them from.

- `@wildshard/sdk/accent`: `ACCENT_IDS`, `AccentId`, `ACCENTS`, `AccentSchema`, `parseAccent`
- `@wildshard/sdk/admission`: `preflightShardfile`, `SHARDFILE_ADMISSION_LIMITS`
- `@wildshard/sdk/assets`: `assetCost`, `AssetCost`, `assetOverdraw`, `OverdrawEstimate`, `parseAudio`, `parseGlb`, `parseKtx2`
- `@wildshard/sdk/audio`: `AudioData`, `AudioDataSchema`, `parseAudioData`
- `@wildshard/sdk/author`: `declareLookLut`, `emptyShardfile`
- `@wildshard/sdk/bake/export`: `SampledSkinClip`, `sampleSkinClip`, `skinnedGlb`
- `@wildshard/sdk/bake/glb`: `GlbPrimitive`, `propBounds`, `staticGlb`
- `@wildshard/sdk/bake/props`: `BakedProps`, `bakeProps`, `PropsBakeSource`, `PropScatter`
- `@wildshard/sdk/bake/terrain`: `BakedTerrain`, `bakeTerrain`, `TerrainBakeSource`, `TerrainOverride`
- `@wildshard/sdk/bake/texture`: `bakeColourTexture`
- `@wildshard/sdk/brains`: `guardian`, `GuardianData`, `perchHunter`, `PerchHunterData`, `scriptBrain`, `ScriptBrainData`, `skirmisher`, `SkirmisherData`
- `@wildshard/sdk/clientScripts`: `ClientScriptsSchema`, `clientScriptViewCost`, `parseClientScripts`, `ShardClientScripts`
- `@wildshard/sdk/commons`: `buildCommons`, `BuiltCommons`, `CommonsAsset`, `CommonsCatalogue`, `CommonsEntry`, `CommonsPack`
- `@wildshard/sdk/commonsCosts`: `assertCommonsCosts`, `CommonsCosts`, `CommonsCostSchema`, `CommonsCostsSchema`
- `@wildshard/sdk/director`: `director`, `DirectorData`
- `@wildshard/sdk/flyers`: `burstFlyer`, `BurstFlyerData`, `orbitDiver`, `OrbitDiverData`, `patrolDiver`, `PatrolDiverData`
- `@wildshard/sdk/grazers`: `challengeGrazer`, `ChallengeGrazerData`, `ramGrazer`, `RamGrazerData`
- `@wildshard/sdk/groupBrains`: `groupBrain`, `GroupBrainData`
- `@wildshard/sdk/headless`: `HeadlessSimulation`, `validateSimulation`
- `@wildshard/sdk/ledger`: `LedgerFact`, `LedgerFactSchema`, `LedgerRule`, `LedgerRulesSchema`, `parseLedgerRules`
- `@wildshard/sdk/migrations`: `DeclaredMigrations`, `MigrationsSchema`, `parseMigrations`
- `@wildshard/sdk/movers`: `MoverData`, `movers`
- `@wildshard/sdk/plumbing`: `parsePlumbing`, `PlumbingData`, `PlumbingSchema`
- `@wildshard/sdk/project`: `buildProject`, `canonicalJson`, `contentHash`, `newProject`, `projectAssets`, `readProject`, `validateProject`
- `@wildshard/sdk/quests`: `parseQuestData`, `QuestData`, `QuestDataSchema`
- `@wildshard/sdk/rows`: `isJsonData`, `parseRows`, `RowsSchema`, `ShardRows`, `simStrikes`, `speciesResolver`
- `@wildshard/sdk/shardfile`: `assertStateCompatibility`, `parseShardfile`, `Shardfile`, `shardfileRules`, `ShardfileSchema`
- `@wildshard/sdk/traversal`: `parseTraversal`, `ShardTraversal`, `TraversalSchema`
- `@wildshard/sdk/version`: `SHARDFILE_VERSION`

### `@wildshard/commons` (`src/commons/package.json`)

2 exports, grouped by the module to import them from.

- `@wildshard/commons/catalogue`: `catalogueRef`, `createCatalogue`

<!-- exports:end -->

### Declared script state and the local lane (SF11c)

`@wildshard/engine/script/state` validates atomic shared/player effects over explicit stable field ids, with actor identity supplied by the host. `@wildshard/engine/script/lane` installs local authoritative server/entity work through the scoped sim step and captures complete continuations, including pending events and quarantine history. `@wildshard/game/shardfile/scripts` validates binding references and translates typed numeric state into the engine lane. See [SCRIPT-ABI.md](SCRIPT-ABI.md) for inputs, restore and the Node/WebKit conformance gate.

### Declared creature brain and spawns (SF13)

`@wildshard/engine/ai/platform` expands stable spawn data and installs a scoped pursuit brain over physics perception, navigation, creature motors and the existing strike pipeline. `@wildshard/game/shardfile/creatures` validates the archetypes and references. See [PLATFORM-AI.md](PLATFORM-AI.md) for parameters and the complete same-engine continuation.

### Declared phase encounters (SF13b)

`@wildshard/engine/ai/phases` drives declared elite and boss tables over the existing `BossBrain`, combat pipeline, checkpoint/retry clocks and scoped sim snapshot adapters. `BossBrain.snapshot/restore` captures the complete continuation without replaying grants. `@wildshard/game/shardfile/encounters` validates ordered phases and actor/panel references; `@wildshard/game/shard/declaredEncounters` binds an already mounted SF7f panel. Encounter-owned spawns use a null ordinary brain, while `buildPlatformSpawns` accepts a catalogue variant resolver. See [PLATFORM-AI.md](PLATFORM-AI.md) for thresholds, persistence ports, restore and presentation.

### Author dev client (SF8c)

`buildProject` in `@wildshard/sdk/project` accepts an optional third argument choosing the compiled client or a product-only build. `wildshard dev` rebuilds admitted static products and reloads the normal client, using a separate compiled author mode. `__DEVSERVER__` is false in production/native modes; the production artifact checker refuses an enabled flag. See [SDK-DEV.md](SDK-DEV.md) for commands, cleanup and build-mode checks.

### Declared simulation composition and author validation (SF8c)

`@wildshard/game/shardfile/simulation` composes admitted terrain, prop colliders, stable actor identities, trusted item handles, numeric scripts, published-state targets, quests, brains and encounters. `createShardfileSim` owns a standalone world by default; its typed ports can borrow the normal client's physics/player/fixed-step driver and existing collider/water ports. `bindShardfileSim` reinstalls matching snapshot adapters without collider allocation or stepping in restore mode. Borrowed snapshots belong to the existing world owner. `@wildshard/engine/physics/edgeEntries` walks overlapping capsule paths across each real entry; `@wildshard/engine/physics/rapier` loads the distributed physics binary without browser globals. See [SDK-DEV.md](SDK-DEV.md) for native validation and the authoritative target update.

### Content-addressed disk cache (SF18c)

`@wildshard/engine/boot/contentCache` exposes `ContentCache` with injected storage, SHA-256 and quota ports. Immutable addresses are shared across content sources; reads verify hashes and offline misses never fetch. A durable LRU index, active-content leases, bounded entry/byte counts and quota eviction/retry keep disk growth bounded. Service-worker activation preserves this independently versioned cache and visited product manifests. See [CONTENT-CACHE.md](CONTENT-CACHE.md) for limits, ownership and recovery.

### Seamless grid crossing (SF20a)

`@wildshard/game/grid/crossing` stages destination admission ahead of the fixed step, then commits a rollback-safe frame change only after local and residency checkpoints succeed. `installGridCrossing` connects the signed assembly and residency driver without another simulation, player or navigation service. Local equipment is stowed at the cell edge before the strip re-frame; superseded and failed admissions retain the current frame.

`@wildshard/game/grid/wallet` binds the existing inventory and purse keys and item continuation to a stable instance. Coins and shard items stay local, while catalogue equipment, titles and achievements remain in the profile ledger. Border stow cancels charged and queued attacks, retains selection and fuel, and restores prior pause/dialogue visibility on return. Fresh-document item restoration rebases the continuation clock. Select a shard and explore continue through `travel/travel`; first-party grid and standalone saves use the same instance identity.

### Scoped level installation

`@wildshard/engine/level/installation` provides `createLevelInstallation(app, scope, adapters, progress)`. It constructs the same scope-bound context used by `LevelLoader`, without starting another load or changing the active level. `openKit()` and `closeKit()` delimit the row-registration window. The caller owns the supplied scope and disposes it to remove its systems, events, content rows, scene root and adapter contributions.
