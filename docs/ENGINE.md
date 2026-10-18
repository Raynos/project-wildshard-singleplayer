# The engine API: `@wildshard/engine`, `@wildshard/game`, `@wildshard/sdk`

`@wildshard/game/systems/audio/weaponVoices` owns the existing sample-first weapon
recipes and `WeaponSynth` mixer port; trusted runtimes consume them through
`@wildshard/sdk/runtime/audio/weaponVoices`. The three recipe modules retain their
original oscillator parameters, cue taps and audio random-draw ordering.
`@wildshard/game/systems/audio/silentScore.installSilentScore` scopes a score-only
gain mute and restores the previous value at disposal; its SDK defining facade is
`@wildshard/sdk/runtime/audio/silentScore`. Both systems install only when called.

`@wildshard/game/systems/viewmodel/{rigArms,armClips,armRig}` define the first-person arm player
(`RigArms`, `swordArmsOf`, `vmScale`), the arm rigs' clip alias tables and the two-bone arm IK the
arm bakes and `measure` share; they moved unchanged from the kit (SF54). Trusted runtimes reach them through
`@wildshard/sdk/runtime/viewmodel/*`, whose facades bind the same values; legacy shard files outside `runtime/`
import the game modules until their -p port. Nothing installs on import.

`@wildshard/game/models/{interact,pickups}` and `src/game/systems/props/interact.ts` hold the shared interactables' models
(sea chest, key, door, lever, plate, barrel, beacon, bench, glyph altar) and pickup looks with the low-poly prop
geometry they are built from, moved unchanged from the kit (SF54). The composition root calls `installKitProps` /
`installKitPickups`; nothing installs on import. Their baked commons entries are SF54 step 4.

`@wildshard/game/systems/species/view/{boar,bear}` define the lofted boar and bear looks (`BOAR_LOOK`, `BEAR_LOOK`, the
palettes); `@wildshard/game/systems/npc/npcRig` is the procedural humanoid leg rig (`NpcRig`, `rigLegs`, `legBones`, `legPose`, `WALK`).
Both moved unchanged from the kit (SF54); shard files outside `runtime/` import them directly. They stay runtime
builders until their baked commons entries (SF54 step 4) replace the procedural path.

`@wildshard/game/systems/species/{boar,bear,deer,elk}` hold the shared species rows (`BOAR`, `BEAR` and their tunings; the
lofted `DEER` / `ELK` with `DEER_PALETTE` / `ELK_PALETTE`), and `@wildshard/game/systems/species/install.installKitSpecies`
registers the four plus the default creature calls; the composition root calls it, nothing installs on import.
`@wildshard/game/models/creatures` defines the shared `shared/deer`, `shared/boar` and `shared/bear` models, and
`@wildshard/game/systems/audio/forest` the asset-free forest profile and its synth wind bed (`createForestAudio`,
`installForestAmbience`). All moved unchanged from the kit (SF54); species ids (`kit.creature.*`) and model ids are kept.

`@wildshard/game/systems/looks/{particles,trample,grassField,fogProgram,rainCurtain}` hold the shared look layers
(mist / needle-fall / mote particles, GPU grass trampling, the meadow height and tone fields, the fog GLSL chunk for
custom programs, the rain curtain), moved unchanged from the kit (SF54). Shard world files import them directly;
Nalati and Pine runtime world hooks lazily import these defining modules. The kit `lookApi` loaders are removed.
A curtain's frame of motion is data (W2 C2, H4): Pine Hollow's rain turns its curtain's velocity and wrapped offset,
the splash and lens clocks and the lens's wetness through the numeric channel group `pine.rain`
(`generators/rainChannels.ts`, private slots for the integrated values) over graph param roots
(`@wildshard/game/looks/graphDaySky#graphParamRoots`); G441's W3 match is Nalati `world/WeatherFX.ts` `update`'s
curtain block.

The historical `@wildshard/game/systems/npc/{figureRig,figureMotion,faceHeads}` exports remain literally unchanged
for exact SF73-registered frozen callers only. Primaries own Nalati `models/npc/{figureRig,figureMotion}` and Driftwood
`npc/faceHeads`; `wildshard/legacy-npc-imports` rejects every other caller. The historical internal type dependency is
kept, and each definition/export is deleted with its last registered legacy consumer. No aliases or frozen edits.

`@wildshard/game/plugin/ui` (`installStarterEffects` and its status-icon row; trusted runtimes use
`@wildshard/sdk/runtime/effects`), `@wildshard/game/plugin/weaponFamily` (`declaredKitItemFamilies`),
`@wildshard/game/systems/tools/hoverboard` and `@wildshard/game/icons` (with `src/game/icons.merge.d.ts`) moved unchanged
from the kit, and its weapon compatibility names gave way to the defining `@wildshard/game/weapons/*` and engine
modules (SF54). That emptied the kit: `@wildshard/kit`, its workspace entry and its guard layer are deleted.

`@wildshard/game/plugin/ui.STARTER_EFFECTS` owns the typed runtime
view of the authored rows in `game/systems/effects/starterRows.json`. The SDK exposes the same rows through
`runtime/effects`; `pnpm gen` and direct Vite/native builds generate their literal
table before compilation. Runtime imports apply nothing.

`@wildshard/sdk/runtime/effects.bindPlayerEffects` is the same defining function
as `@wildshard/engine/combat/effects/EffectService.bindPlayerEffects`. It owns scoped
status movement / periodic-damage / death bindings, with no second kit wrapper,
HUD changes or import-time installation. `StatusMovement` derives from that port.

`@wildshard/sdk/bag.normalizeItemRow` is the trusted facade for the existing
`@wildshard/game/bag/items` normalizer. Starter harvest content is authored once in
`game/bag/starterItems.json` and expanded by `pnpm gen` into
`game/bag/starter.generated.ts`; boot installs those rows explicitly. No import
registers a row.

`@wildshard/game/systems/audio/combatCues` defines the shared equipment cue router.
Trusted runtimes use `@wildshard/sdk/runtime/audio/combatCues.sharedCombatCues(audio, meleeSilent)`;
its SDK facade refers to the same function. It calls the supplied mixer's existing
sound operations exactly once, preserves surface / pan / gain and the melee-silence
policy, returns false for unknown cues, and installs nothing on import. Sound
recipes and authored audio assets remain separate content; this router carries none.

`@wildshard/engine/render/memorySaver.memorySaverOn()` reads the existing reload-scoped Debug setting. Immutable procedural textures may call `core/gpuOnly.gpuOnlyTexture` before first draw only when it returns true: after upload the canvas shrinks without another texture upload. Lit and depth passes must share that texture; CPU readers, redrawn canvases and different-sampler clones are ineligible. Rebuild these sources for each admitted world; GPU-only context loss uses the existing recovery reload.

`@wildshard/engine/render/memorySaver.releaseOnUpload(source, done)` opts an exclusively owned, immutable decoded image into the existing Memory saver upload retirement. The callback closes the private bitmap or releases its cache owner after upload; the texture keeps its dimensions and GPU allocation. Register only when no later CPU reader or different-sampler clone needs the pixels, and also release on owner disposal. Memory saver OFF keeps the decode until disposal; GPU-only context-loss recovery reloads the page.

`@wildshard/engine/world/BakedTerrain.installBakedGrid(grid, binding?)` installs original native samplers and undergrowth decisions into the selected binding without a second fetch. It refuses a mismatched seed. The Node authored-world bake uses this before forest/model construction; geometry capture still supplies the production terrain constructor and retains native collision ownership.

`@wildshard/game/grid/simulation` owns local physics residencies, prepared fixed-step frame changes and durable
two-phase unloads through the session's one allocator. `@wildshard/engine/sim/strips` generates deterministic
highway, strip and crossroads meshes with local duplicates; where an edge observes a sea at exactly 0 over seabed (the
shore rule, G149) the strip holds 0 to the cell edge and builds a +0.6 m rip-rap revetment there (feature `revetment`,
part of the collider), and a shard clips its sea at `SHORE_REVETMENT_INNER_FACE` from `@wildshard/engine/sim/shore`.
`sim/strips.generatePlatformSliced` uses the same ordered geometry/certification generator as
synchronous `generatePlatform`, awaiting its supplied paint pause when the slice budget expires.
It yields within adaptive native-lattice subdivision and vertex-removal checks, rather than waiting
for an entire strip to finish; partial strips remain private. `sim/seamGeometry` and `sim/seamLattice`
expose the ordered step generators for this scheduling. Vertex/index/colour bytes, features,
regional placement and the certification tolerances are identical to synchronous construction.
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
`@wildshard/game/plugin/context` resolves a declared `runtime/*.ts` entry only through a trusted first-party
registry. `prepareHybridShard` admits the shardfile and its trusted entry, chooses the catalogue instance inside
the game layer, and composes their world, kit and play stages. Empty transitional data adds no gameplay services.
`HybridRuntimeSession.prepare` prefetches module code without running hooks. `installAhead(instance)` requires an
inactive, retained, fully claimed resident with reversible construction bindings; it builds world/kit/play and warms
programs while entered callbacks, input actions, parent runtime slots and presentation stay unpublished. Input
definitions resolve during preparation so native pushes and declared equipment references can validate them;
their keys, blocking and touch presentation remain disabled outside the entered scope. Definitions retire with
the resident, while binding descriptions retire on leave. Nested registrations belong to the installing service
and are recreated once per entry. `enter` activates
the prepared resident without repeating those stages. Ordinary borrowed-home callers retain entry-time installation. `bindScopedRuntime` restores each parent slot's original
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
a default-off reload row. `@wildshard/sdk/director` validates author declarations without installing code. An external director borrows the existing
owner's clock instead of registering a second fixed callback. `DirectorLane.dispatch` delivers at
zero elapsed time on the current tick and shares its remaining allowances; `step` accepts a bounded
elapsed delta (the default remains 1/60). `prepareDirectorModule` verifies the hash once and returns
a factory of independent author-state instances. Full snapshots remain the only continuation.

This is the public API a shard is written against. It covers the three public layers and what each one gives a
shard. One section per § of [01-architecture](../project/archive/game-normalization/01-architecture.md), in the same order.

- **How to write a shard** is [SHARDS.md](SHARDS.md). This file is the reference it points into.
- **The worked example** is the template shard, [`src/shards/_template/`](../src/shards/_template/). It uses every
  plugin verb once. Most examples below are copied from it.
- **This file describes HEAD, not the plan.** Where 01-architecture names something that isn't built yet, or built
  under another name, the section says so.
- **It can't drift.** The export index ([docs/api/EXPORTS.md](api/EXPORTS.md)) and the per-package tables in
  `docs/api/` are build outputs: `pnpm gen` runs `scripts/gen-api.mjs` over the TypeScript sources and writes them with
  `lint/api-surface.json`, all gitignored (SF74 W13, Jake G281). Builders document public APIs in source (JSDoc) and
  in the manual sections here; nobody commits the generated lists.

**No barrels (E434).** There is no index file. The layers are workspace packages (`pnpm-workspace.yaml`), and
each `package.json`'s `exports` lists the layer's public modules one by one. An import names the module that defines
the binding:

```ts
import { castRay, floorBelow } from '@wildshard/engine/physics/query';
import { buildTerrain } from '@wildshard/engine/world/terrainField';
import type { ShardManifest } from '@wildshard/game/shard/manifest';
import { Bow } from '@wildshard/game/weapons/Bow';
```

| Package | Public modules | What it is |
|---|---|---|
| `@wildshard/engine` | `src/engine/package.json` `exports` | The engine: app, scopes, events, saves, input, UI, render, physics, audio, combat, AI |
| `@wildshard/game` | `src/game/package.json` `exports` | The Wildshard game: the manifest and plugin types, Bag, coins, loot, compendium, feats, travel |
| `@wildshard/sdk` | `src/sdk/package.json` `exports` | The authoring SDK; existing trusted runtime facades are transitional and being deleted under G307 |
| `@wildshard/commons` | `src/commons/package.json` `exports` | Build-time packs that emit hash-named content; no commons code runs in the game |

`@wildshard/commons/bake/portableMath` supplies the established portable
transcendental functions for cold authoring. `withPortableMath(fn)` installs
those functions only for a synchronous call and restores them even on failure;
`installPortableMath()` returns an explicit restore function for native proof
processes. Importing the module changes no Math binding. Neither API is a
runtime rendering path. Bit-exact producers use the portable result as their
canonical output and retain their immutable output hashes.

[docs/api/ENGINE.md](api/ENGINE.md), [GAME.md](api/GAME.md), [SDK.md](api/SDK.md) and [COMMONS.md](api/COMMONS.md) (generated) list every export
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
| **Layers** | `src/engine/` → `src/game/` → `src/sdk/` → `src/commons/` → `src/shards/<slug>/`. Imports point down the arrow only. A shard never imports another shard |
| **Public modules only** | A shard imports the modules `@wildshard/engine`, `@wildshard/game` and `@wildshard/sdk` list in their `exports`, by the module that defines each name (`@wildshard/engine/physics/query`), nothing else. Inside your own folder, use `./` |
| **Composition root** | `src/entry.ts` and `src/main.ts` sit outside the layers. You never edit them for a shard |
| **Node-safe manifest** | `manifest.ts` imports only data and types: node-safe engine modules (`@wildshard/engine/world/terrainField`, `@wildshard/engine/core/config`, `@wildshard/engine/core/noise` …), `@wildshard/game` types and its own data files; `lint/manifest-closure-budget.json` caps the files it pulls. Code arrives through lazy thunks (`load`, `render`, `cues`, `roster`, `preload`). `test/manifests-node-safe.test.ts` imports every manifest in bare node |
| **Extractable engine** | `src/engine/**` holds no Wildshard word: no slug, no "shard", no Bag, coin, loot, compendium or feat. The engine says `level` |
| **Behaviour vs tuning** | Behaviour is a class that extends an engine or game class. Tuning is a typed data row |
| **Names** | Events, asks, tags, cues, actions and effect ids are dot-case strings: `'damage.dealt'`, `'creature.greyBlob'`, `'cue.sword.hit'`, `'effect.poison'`. Prefix your own with your shard's short name (`template.*`) |
| **Strict** | Strict TS, type-aware oxlint at zero warnings. No `any`, `!`, `as unknown as` or ts-ignore |
| **Simulation apart from visuals** | Gameplay state is plain data. `src/engine/{ai,combat,events,quest,saves}/**` (less their `view` parts) may not import three beyond its math types or read the DOM (`wildshard/sim-no-render`; a test keeps every listed folder real) |
| **Determinism** | Gameplay randomness comes from `app.rng`, time from `app.clock` |
| **Strings** | Every player-facing line comes from a string table: your `strings.ts`, or `engineString` for the engine's |

The template's imports show the rule:

```ts
import { ShardPlugin, installLoot, installCompendium, type ShardContext } from '@wildshard/game';
import { Sword } from '@wildshard/game/weapons/Sword';
import { STARTER_EFFECTS, installStarterEffects } from '@wildshard/sdk/runtime/effects';
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



The build-only `Rng` and `RngState` in `@wildshard/sdk/random` give shard
generators Mulberry32 without an engine/runtime import. `new Rng(seed)`,
`Rng.scrambled(seed)`, draws, snapshot/restore and numeric/string forks
match `core/rng` exactly. The structural `Rng` instance shape also accepts the
runtime oracle when a builder is exercised by parity tests. Never use
this constructor for live gameplay; use `app.rng` there. The permanent
`test/sdk-author-random.test.ts` fences both implementations' sequences.

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
| `ownPrimitives(root, {instances?})` | a code-built mesh tree’s geometry/materials, optionally instanced meshes; detaches the root on disposal, leaves textures to their existing owners |
| `own(resource)` | a geometry, material, texture, render target or InstancedMesh (`Disposable3`) |
| `ownBody(handle)` | a Rapier body or collider (`PhysicsHandle`) |
| `ownSound(handle)` | an audio node (`SoundHandle`); `ownAudioSource` wraps a source for you |
| `listen(target, type, fn, opts?)` | a DOM listener (input events go through `app.input` instead, §10) |
| `timeout(ms, fn)`, `interval(ms, fn)`, `raf(fn)`, `cancelTimer(id)` | timers (wall clock, owned) |
| `onDispose(fn)` | anything else |
| `child(name)`, `belongsTo(scope)`, `disposed` | sub-scopes |
| `census` (`ScopeCensus`) | counts per kind, for the leak test |

`Scope.sharesTeardown(other)` detects a common ancestor currently running synchronous disposal. Delegated sibling scene owners then keep their own final resource capture without repeating it through the outer scene. An independently disposed outer root still captures a live delegated owner that can outlive it; late textures remain owned, and shared native resources are freed once.

**The construction owner.** Engine code that builds a reusable service doesn't take a scope argument everywhere;
it asks for the current owner instead.

The browser composition root calls `installBrowserScopeEnvironment()` from `app/view/scopeEnvironment` before
registering presentation work. It supplies exact Mesh/InstancedMesh primitive classification, frame scheduling and diagnostic DOM target classification; a headless
scope owns callbacks and resources without importing browser globals.

| Export | What it does |
|---|---|
| `withOwner(scope, fn)` | runs `fn` with `scope` as the owner; callbacks registered inside re-enter it |
| `currentOwner()`, `enterOwner(scope)` | read or set the owner (prefer `withOwner`) |
| `onOwnerDispose(fn)` | `fn` runs when the current owner disposes |
| `asShell(fn)` | runs `fn` with no owner: what it builds belongs to the page, not a level |
| `pageScope`, `resourceScope()` | the page's scope, which outlives every level; `resourceScope()` is the current owner or else `pageScope` |
| `ownedFacade(scope, service)` | the service with every method call run under `withOwner(scope)` (one level deep, the real service as `this`) |
| `ownerTask(scope, fn)` | `withOwner` for an async build; while its promise is pending, `ownerCensus()` counts ambient owner reads |
| `bindConstructionEnvironment(scope, enter)` | holds one admitted construction's reversible terrain/registry/selection bindings across awaits; unrelated scoped callbacks restore the page bindings, cancellation releases them, and concurrent ambient constructions refuse; it installs no input, systems or presentation and does not supply async-local ownership |
| `ownerCensus()` | owned builds pending, ambient owner reads seen meanwhile and their newest stacks (the probe's `app.owners`) |

A shard rarely needs these: every `ctx` verb already runs in its scope.

**An owner lasts only until the first `await`** (SF57). `withOwner(scope, () => build())` owns the build's synchronous
prefix; every continuation after an `await` runs under the ambient owner, which is the page's level scope. Browsers give
no hook into native `await` continuations, so an asynchronous build carries its owner explicitly: the resident build path
runs each hook with `ownerTask`, the level installation's adapters (HUD, input, debug rows, playgrounds) run under the
installation scope, and a resident's play host gets the page HUD, menu and maps as `ownedFacade`s. A registration made
through those after an `await` ends with the resident. Anything else that reads `currentOwner()` after an `await` (a bare
`onOwnerDispose`, `resourceScope()`) still lands on the page; pass the build's scope instead, and read
`ownerCensus().stacks` to find such a site.

**Owned vs acquired.** `own` only what your level creates. A shared engine or kit asset comes through
`app.assets.acquire(key)` and is released, never disposed (`AssetService`, `AssetCensus`, `AssetRecord`).
`retainCachedResources` marks engine caches that survive a level.

**The leak test.** The gate loads your shard, unloads it and checks the census is back to its title-screen value
(geometries, textures, materials, bodies, listeners, audio nodes, timers). Code-built trees use their explicit scope:

```ts
ctx.scope.ownPrimitives(root); // geometry and materials
ctx.scope.ownPrimitives(root, { instances: true }); // also instance buffers
```

This walks native meshes once at registration. It does not acquire textures,
recapture late resources or change delegated scene/asset ownership. The pure
native host has no presentation classifier; rendered Node world bakes install
the same adapter explicitly.

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

`LevelSpec.bakedId` optionally names the offline resource folder independently of `id`.
`levelBakedId(level)` (the defining `engine/level/spec` module) resolves it, defaulting to `id`.
Terrain, procedural textures, HDR sky metadata/LUT and viewmodel planes use that resolved folder;
`loadNavmesh(levelId, bakedId?)` keeps cache ownership under `levelId` while fetching that folder.
The game supplies it only for an inventoried, registered legacy copy, preserving its separate level and save identity.
Branch-card URL readers take the resolved folder too (Pine already names its original folder explicitly).

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
| `audio` | `{ bed?, ambience, score, cues?, preload?, samples?, alertOnlyHostile? }` (§15); `cues` is a serializable name-to-ID map (frozen trusted manifests may retain a lazy loader) |
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

Loading has its own task budget, independently of steady-state fps. Report observed
sub-progress within builders and explicit waits from the first HTML panel; whole-step
percentages cannot explain a long Props stall. Keep individual main-thread tasks below
about 100 ms through baking, workers or time slicing. This is a target, not a claim
that current worlds meet it: see the [matched SF67 report](../progress/loading/sf67/README.md).

Ordinary boot does not eagerly walk the scene/HUD/shaders to create a probe fingerprint.
A pinned harness may capture it eagerly; an ordinary reader computes it lazily. The
GPU allocation journal runs only with Developer or the explicit census harness;
labels remain a separate bounded mechanism. Do not enable diagnostic walks or journals
in production merely because they were useful during a capture. The first physics
frame after loading starts with one fixed tick rather than catching up loading time;
subsequent bounded catch-up is unchanged.

`ProgressView.worldBytesReady` closes the world transport independently from menu art,
music and SFX. Loading switches to “Building the world” when that transport is in;
the download numerator still reports all actual bytes. `slicer(budgetMs, progress?)`
returns a yield callback accepting `(done?, total?, detail?)`, so builders report
completed authored work units before the budget check without changing yield timing.

In play (a grid cell built on the road while the engine loop draws frames) the same builders can pace themselves to the
frame floor (op-hitch26), with `buildPacing` defaulting on after its quiet frame-floor proof. The existing Developer tool (Settings ▸ Developer ▸ Performance) can switch it off:
`@wildshard/engine/core/framePacing` learns each drawn frame from `Game`'s loop, `presenting()` is true while it keeps
drawing (and the tool is on), and `slicer()` then caps its stretches at `WORK_SLICE_MS`. `macrotask()`, `slicer()` and a
`workSlice()` yield all go through `paceYield`: when a frame is due they wait until the loop has drawn it (rAF, then a
scoped MessageChannel task after paint, without a nested timer clamp). With the tool off, or off the road (the loading screen, Node bakers and tests), nothing changes.

Build pacing uses the actual drawn frame's rAF timestamp and active fps cap to set the next deadline.
`noteFrameDrawn(done, rafAt, cap, cadenceAt)` optionally receives the capped loop's recovery anchor.
After a late draw, builds then owe the same recovered deadline as the cap instead of delaying it again;
omitting the anchor preserves the original deadline, and uncapped cadence still comes from actual rAF pairs.
The CPU/render work already spent by that frame is not spare construction time; `workSlice` yields
when that deadline is due even if its own nominal budget is not exhausted. Uncapped deadlines use the
fastest observed cadence from actual rAF pairs, so neither the synchronous first draw nor a missed vsync changes the target.
Piece-to-piece macrotasks share the same budget as sliced loops, capped at a quarter of the game cadence and half a 60 Hz display slot (at most 8.33 ms). Caller budgets remain authoritative: the default 8 ms phone slice cannot grow with a slower cap; 60 Hz and faster retain their previous quarter-frame bound. Completion-only
`noteFrameDrawn(at)` callers keep their original smoothed cadence. This changes scheduling only: no
frame-cap, geometry, simulation, render-scale or quality change.

`fetchDeflatedBytes(url)` in `@wildshard/engine/core/deflate` feeds zlib-compressed
HTTP bodies to the native decoder in at most 16 KiB blocks, checking the shared
construction slice between blocks. The geometry bake readers use it without
changing decoded bytes; lane-shuffled readers also reconstruct bounded word
blocks before yielding. `unshuffleLanes(lanes, output?, wordStart?, wordEnd?)`
can fill a validated word range in a distinct complete output buffer; omitted
arguments restore all words. This changes scheduling, not geometry or compression.
The fetch is page-lived, preserving an in-flight cached read when its original
construction owner retires.
Lane restoration shares that page lifetime as well. `fetchLaneBytes(url)` restores
four-byte lanes in bounded batches under the shared frame budget; the SDK's lazy
`fetchLaneBake(url)` facade shares it with the existing geometry reader. Species,
place and dressing bakes use the same paced reader as crags and other shards.
`AnimalFactory.prepareModels(rows)` prepares each declared kind/variant with its
original key seed and cache, under the calling construction scope. A null or
omitted variant prepares all declared variants without rolling placement RNG.
It checks the shared frame budget before each model and refuses further work after retirement.
Driftwood awaits it before enemy placement; Pine uses it for its existing boss
variant preparation. It creates no actors and consumes no placement RNG.
The existing probe-skipped KTX2 safety conversion also uses that frame budget:
`widenRgbEtc2Async(texture)` widens RGB ETC2 to opaque RGBA ETC2/EAC in batches,
publishing only complete mips. The synchronous bake helper uses identical steps.

`geometryBoundsSteps(geometry, "box" | "sphere" | "both")` in `@wildshard/engine/world/geometryBounds`
scans ordinary CPU positions in 8,192-vertex steps using three.js arithmetic. Sliced model builders
and painted-mesh finishers may pause between steps; synchronous callers exhaust them. Bounds publish
only when complete and preserve existing object identity. Morph/GPU-only/invalid inputs use the original
three.js path. Vertex data, culling results and geometry quality stay unchanged.

`frameCapAnchor(lastDrawn, timestamp, positiveFps)` in `@wildshard/engine/core/Game` returns null when a capped
draw is not due, otherwise its cadence anchor. A late 30 fps draw keeps its slot within a bounded phase window,
so the following draw does not lose another vsync; normal jitter tolerance and the uncapped path are unchanged.

`Game.frameRafTime` is the browser rAF timestamp attached to the last completed draw; it is null for the
initial synchronous draw. Read it with `frameCount` for delivered-frame cadence, retaining missing counter
increments as incomplete coverage. `clock.oldTime` measures callback-start timing, and an observer's own
rAF timestamp measures polling timing; neither substitutes for the delivered draw timestamp.

`beginLoading({id, name, trace?})` from `@wildshard/engine/ui/Loading` adopts the first-HTML panel before product hydration. Repeating it for the same active identity returns the same panel and clock. `Loading.paintAdmission({phase, detail, bytesRead, bytesTotal, filesDone, filesTotal})` shows actual pre-plan work; an unknown total stays explicit. `waiting(detail)` identifies module or service waits. The session then hands its ordinary plan to that instance with `paint(view)`, preserving verified admission bytes and reaching 100 only at plan completion. The first HTML reads the title-arrival display name without consuming its one-shot navigation intent.

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
| `audio?`, `precache?`, `explore?` | serializable audio URL list (trusted legacy async loaders also supported), service-worker precache, Explore art |
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
// manifest: boot: { files: bootFiles, sources: bootSources, viewmodelSets: [], shaders: { background: false }, audio: [], precache: [] }
```

Boot helpers on `@wildshard/engine`: `StepProgress`, `StepRunner`, `macrotask`, `slicer` (yield inside a long build),
`preloadBakedTextures`, `loadBakedSky`, `skyHorizonColor` (an equirect sky's mean horizon row, the fog colour; the HDR
sky and Pine Hollow's keyed sky keys), `loadLUT`, `fetchLut`, `LUT_SIZE`,
`PUBLIC_BYTES`, `markUnload`, `setTitleArrival` / `TitleArrival`, `Ktx2Table`, `LoadFailure`. For node-side tools and a
manifest's creature and loot tables, the node-safe modules are `boot/filePolicy` (`filePolicy`), `boot/bytes`
(`ChunkFiles`), `core/tier` (`Tier`), `boot/gpuFiles` (`TexMode`), `core/config` (`CHUNK_SIZE`, `CELL_HEIGHT` /
`CELL_BELOW` / `CELL_ABOVE`: the 500 m cell, 250 m each side of the highway level, SHARD-PLATFORM SP4; `TERRAIN_RES`,
`ROAD_LENGTH`, `ROAD_WIDTH`, `SEED`), `core/noise` (`Noise2D`), `core/rng` (`Rng`), `ai/species` (`deriveSpecies`) and
`ai/weighted` (`WeightedTable`); `lint/manifest-closure-budget.json` keeps a manifest on them.

Compressed textures use one renderer-wide upload queue during warm-up and asynchronous loading. Set the final
colour space and sampler before awaiting `prepareCompressedTexture(texture, renderer?, current?)` from
`@wildshard/engine/core/ktx2`; publish the material only after it resolves. Each compressed 2D or array texture
gets a painted slice and graphics-error fence before any consumer draw. Raw KTX2 layers remain CPU inputs until
array assembly. Shader patches declare borrowed textures and also record actual sampler uniforms at compilation;
warm-up re-collects those uniforms before uploading. Cancellation and upload errors refuse readiness. A glTF loader
uses `prepareCompressedTexture(texture, renderer, current, false)` provisionally: its consumer may still change
the sampler. All loader uploads retain mip data through configuration and the final fence; only the first
successful real draw binding that texture releases it. A later sampler/storage/source mutation fails at the
renderer property boundary before Three can access retired pixels. `loadTexture` accepts a fifth `configure`
callback for sampler changes before publication (including baked cards). Final readiness checks the live GPU
allocation, complete sampler/storage key and source version; disposed textures or empty unresident clones refuse
with a descriptive error rather than attempting an upload from released pixels.

The grid's `GridSessionHost.prepareView(root, current)` uses `Game.warmSceneRoots` for far/near placeholders
and cell screens before exposure. Near views retain their far fallback while linking and uploading; cancellation,
eviction or preparation failure retires the pending view without covering its far proxy. A screen's slot likewise
stays hidden until its first painted canvas and material are prepared. The existing page draw barrier paces this work.

Streamed-root preparation now shares the entered-frame presented-time bound: a stalled draw or driver link rejects
with a named issue instead of leaving a far/near fetch pending forever. The draw barrier itself also carries this bound,
including sky/post callers outside an entered-frame warm-up. Disposing its owner rejects immediately.

The experimental `entry` choice in the existing Build pacing developer row slices scene-inventory traversal by the
shared frame budget. Compile-only ordinary instanced stand-ins borrow population buffers rather than copying them; no live
geometry, transforms or visibility change. Desktop preparation preserves already-drawn material selections across
yields and waits for a completed game draw between compile batches. The default remains the measured `on` choice.

`Game.warmEnteredFrame(owner, futureRoot?, before?)` captures the installing content scene before yielding. Regional callers
pass their whole view root so authored sibling lights outside the native scene are included. Only that root's parked
visibility is ignored; hidden descendants remain hidden. The bound native scene supplies the PMREM independently.
The owner's staged camera equipment also receives sliced first draws before entry. The staging group, its direct
equipment roots and the destination lighting root are temporarily revealed; authored detail visibility stays intact.
Only selected equipment draws. Each 1×1-scissored draw restores visibility, layers, culling, shadows, environment
and targets before yielding, failing or cancelling.
Shader preparation includes future lights through detached light clones in jobs targeting the rendered root. This
warms the first visible frame's light-count variants without showing the parked world, changing live light counts,
or adding per-frame lighting work. Visible lights are not counted twice; unrelated post targets keep their own lighting.
Shadow jobs also warm the preceding road light state: Three draws shadows before refreshing its light state, so
the first entered shadow pass can still use that prior count. The subsequent pass uses the entered count. Both
variants resolve during the sliced approach warm-up; the visible scene and its per-frame lights stay unchanged.
An admitted regional sky finishes before warm-up. Its parked scene carries the sky's borrowed environment;
compile jobs temporarily use that exact PMREM mapping and cube-UV height, then restore the road environment
in `finally` before yielding or drawing. This changes compilation inputs only, with no new sky allocation,
visibility change or disposal ownership. Cancellation and driver errors restore the page too.
The warm-up is bounded in presented time (`boundEntryWarmup`, `src/engine/render/entryWarmupBound.ts`): `before`
(a region's sky build, `beforeWarm`) runs first inside the bound, and 5 s with no drawn frame or 30 s in all rejects
with an `EntryWarmupStallError` naming the stage. Each rAF gap counts at most 100 ms, so a hidden page never expires
it. The grid records the rejection as the cell's admission issue and the next crossing retries; nothing waits silently.

During WebKit entered-world preparation, `Game.warmEnteredFrame` requests isolated image uploads.
`precompileLevel` accepts `isolateImageUploads`; `runPrecompile` accepts it before its optional `pause` callback.
Each image keeps its original texture/source/sampler and upload order, with a paint opportunity before the next
upload. Compressed textures retain their fenced upload path. Ordinary boot and desktop keep batched uploads.
This bounds combined upload work; it cannot split or guarantee the duration of one native upload.

Live WebKit shader preparation separates drawable compile jobs and settles one program per drawn frame.
Incomplete links yield before retrying completion; ready links resolve in the same slice, then yield.
Ready programs are not polled again; weak resolved identities avoid repeating work for borrowed variants.
KHR completion is checked before uniforms are resolved, and shader-error diagnostics remain enabled.
The same linked-program slice calls `EngineNodesHandler.prepareProgram` for its node materials.
`NodeUniformBuffers.prepare` resolves their block indices without allocating buffers, uploading values,
selecting a material variant or changing bindings; the first draw retains ordinary pairing and uploads.
A two-sided material can still issue two variants; one native query can still overshoot. Paced live world
preparation uses the existing 6 ms slice on both browser families. Initial boot retains its
ordinary grouping and 12 ms bound; readiness still awaits the complete inventory before exposure.

For a running WebKit game, `Game.warmEnteredFrame` supplies `waitForDrawnFrame` as the
`pause` callback. It waits for a fresh completed game draw and a paint opportunity; a capped/skipped browser rAF
Entered-frame diagnostics are scalar: `Game.entryPreparation` records compile/link/upload, composer,
parked-draw and offscreen-draw elapsed times and completed units, including their painted waits. It holds
no materials, textures, scenes or native handles. `PrecompileStage` is the optional `onStage` callback
of `precompileLevel` (and the argument after `uploadBudget` in `runPrecompile`); observers do not change
work ordering or readiness. Older frame-floor captures omit this field.

Isolation costs a drawn frame per image: Pine's entered warm-up took 7.8 s on the Simulator at 30 fps (op-hitch27).
An optional `UploadBudget` (`{ ms, bytes }`, `precompileLevel`'s `uploadBudget`, `prepareSceneRoots`' and
`runPrecompile`'s last argument) batches the image uploads instead: several per frame while their measured time stays
under `ms`, the next one's cost predicted before it starts from its decoded size (`imageUploadBytes`) and the
byte-weighted rate measured so far, so a large image still uploads alone and one native upload can overshoot by itself
only. Without isolation (desktop) the same budget replaces the 12 ms check made after each upload, so a slice never
starts an upload it cannot fit. Compressed textures keep their fenced path. `Game` passes `LIVE_UPLOAD_BUDGET` (8 ms, 8 MiB) during paced live WebKit preparation. Explicit `off` retains isolated uploads; desktop retains its ordinary path unless `uploads` selects `SLICED_UPLOAD_BUDGET` (10 ms, 64 MiB).

Live WebKit parked draws can share the same bounded construction slice through `buildYield`. Each existing drawable/material-count slice restores every flag before its task yield. A final `waitForDrawnFrame` remains before offscreen warm-up and readiness; compressed-upload fences and desktop parked-draw cadence are unchanged.

`pacedResolve(value)` (`@wildshard/engine/core/workSlice`) hands back a value an async API already holds: on its
microtask, or after the next drawn frame once a presenting frame's shared build budget is spent. Cached product reads
(`ClientAssets.read`, admitted product files) and the grid runtime's `step()` use it, so a runtime hook awaiting cached
reads one after another on the road cannot run its whole chain in one task. Not presenting, it is `Promise.resolve`.

cannot release the next preparation batch. Scope retirement or an obsolete owner rejects and clears its scheduling
handles. It never advances simulation or forces a draw. Initial boot (no completed draw yet) and desktop keep the
ordinary paint barrier. Newly streamed roots use the completed-draw barrier on every browser through
`Game.warmSceneRoots`. `prepareSceneRoots` and `precompileLevel` accept the same optional callback.

**Resident CPU preparation.** `prepareSceneRoots` runs owner-scoped render-data preparations before
compiling/uploading a newly resident root. The camera is converted to each registered root's local frame.
Grass fills its initial toroidal cell window in cooperative slices here, using the same cell order and
per-cell seeds as its ordinary first update. Gameplay, clocks, trample and live visibility do not advance;
the completed matrices and colours reach the first draw together. Retirement cancels preparation and
removes the registration. Ordinary standalone updates retain their existing first-fill behaviour.

## 9. Saves

All persistent state goes through `SaveStore` (`app.saves`, also exported as `saves`). Raw `localStorage` /
`sessionStorage` is a lint error (`wildshard/no-raw-save`).

```ts
interface SaveKeyDef<T> { key: string; scope: SaveScope; version: number; schema: v.GenericSchema<T>; initial: () => T; migrate?: … }
interface SaveSlot<T> { peek(ns?): T | null; revision?(ns?): number; read(ns?): T; write(value: T, ns?): boolean; reset(ns?): void }
```

`SaveSlot.revision(ns)` is an opaque document-change token, not admission.
It detects writes, resets, imports and external storage replacement without
parsing or validating the document. Consumers may cache admitted values while
it stays equal; after it changes they must run the normal status/read checks.
Runtime-owned state uses it to avoid migrating an unchanged save every frame.

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

`SaveStore.inspectShardGeneration(identity)` reads the validated reset generation without importing legacy keys.
Grid New-game recovery records that generation before resetting; a replaced process completes the captured road
receipt only after the target namespace proves exactly one durable generation advance. Failed, declined, expired
or superseded resets cannot initiate that recovery.

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
| `ItemCardSpec`, `ItemCardState`, `itemCardTile`, `ItemCardPop` | the big item card (SF28, Jake's G87): an item as plain data (name, icon id, detail, price, state) drawn by the platform as a shop grid tile or the pickup / reward card under the top bar, in the accent hex it is handed (`--ws-accent`; the HUD cyan when none). Text lands as `textContent`. `HUD.pickupCard(spec)` shows it for every platform pickup (the only look since Jake's G181 pick, E450; the trader's `ShopPanel` is the same G87 sheet); the game sets `HUD.cardAccent` from the shard's declared accent |
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

`render/dataLook` admits generated painted-look JSON with
`parsePaintedLookRow`, then binds it with `paintedLookFromRow`. The row holds
the clock, key, fog, painter light and its page/material scope, dusk curves, and two
painted strips or a heading haze. Image loading, graph compilation, dressing,
LUTs, terrain ownership and live dusk stay explicit ports; a stateful row
refuses a missing live state. Material-scoped light stays in the admitted row
for the caller to apply with `painterLightPatch`. `painterLightPatch(null, ...)`
installs that light in the page lighting chunk; a material target scopes it.

`manifest.render` returns a `LookStrategy`: how your level looks. It is one of two shapes.

| Shape | `compose` | Use |
|---|---|---|
| `ExtendLook` (`mode: 'extend'`, the default) | `(c: LookComposeContext) => LookComposition`: your passes in the slots `beforeScene`, `afterScene`, `beforeChain`, `chain`, `afterChain`. `c.engineChain('clean' \| 'cinematic')` is the engine's chain, `c.fx` its effects (`EngineEffects`), each yours to tune: e.g. `c.fx.tone.mode` (the engine's default `ToneMappingMode.AGX`, from `postprocessing`, compresses highlights hard, so a look whose target has bright sun bloom and gold rims may pick `NEUTRAL` or `ACES_FILMIC`), `c.fx.bloom.intensity` / `luminanceMaterial.threshold`, `c.fx.godRays`. **Ask `c.engineChain(kind)` before you read `c.fx`**: the first `c.fx` read builds the `'cinematic'` chain, so a later `engineChain('clean')` throws (the load then stops on the error modal; `<html data-ws-state="error">` tells a harness) | most shards (Driftwood, Pine, the template) |
| `ReplaceLook` (`mode: 'replace'`) | `(c: LookReplaceContext) => LookChain`: `{ chain: Pass[] }`, the whole chain in order. Optional `engineKnobs(tier) => EngineKnobs`: what that chain amounts to on an engine chain that draws your content instead (a grid cell on a page shell): `bloom` (or null), `vignette`, `rays`, `ao`, and `display`, your tone curve and grade as one NORMAL-blend `Effect` that takes over the engine's tone mapping by the cell's weight | a look with its own composer (Nalati) |

Both shapes take these optional parts:

| Part | What it does |
|---|---|
| `backdrop` (`SkyBackdropFactory` → `SkyBackdrop`) | your sky backdrop and day clock. It gets `SkyBackdropContext`, `SkyBackdropTargets`, `SkyBackdropPost`. `SkyBackdrop.dressing` (G321): its world-anchored sky pieces in your level's own frame (a cloud sea, cloud puffs, a glow at a painted sun); the engine adds them to the scene standalone, and a grid cell's layer draws them at its region's origin (their programs read the view and camera in your level's frame), faded by the cell's weight |
| `sky` (`SkyDressing`) | `{ clouds, planet, sun?: { disc?: boolean, halo?: boolean, rays?: boolean \| { azimuth, elevation } }, build?, update? }`: which engine sky objects to build/show |
| `lighting` (`LightingRig`), `shadows` (`ShadowStyle`) | the light model and shadow rig |
| `fog` (`FogModel`), `fogControl` | your fog patch (`{ order, install }`) and suspend / resume for Explore and playgrounds |
| `terrainPainter` (`TerrainPainter`, `PainterField`) | `build(terrain, field, scope)` builds the ground mesh; `scope` is the owning level scope |
| `grass` (`GrassDriver`, `GrassLayer`) | grass |
| `frame(dt, t)`, `dispose()` | per-frame work and cleanup |
| `worldPatch(material, scope)` (G321) | your own patch on each of your world's materials (a haze by heading): your compose runs it on its scene standalone; a grid cell runs it on every unshared material under its region's root |

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

**Exterior lighting preparation.** `@wildshard/engine/render/precompile` defines
`registerExteriorLighting(scene, owner, root, environment)`. A framed content owner declares
which subtree leaves the page's light inventory outside its frame and the exterior
environment (including an explicit `null`). Ordinary sliced preparation borrows
detached light clones to compile that state's world/depth variants too. Live visibility,
parents, lights and environment stay unchanged; retiring the owner removes the declaration.

**Offscreen preparation.** `@wildshard/engine/render/offscreenPreparation` defines
`registerOffscreenPreparation(scene, owner, pass)` and `OffscreenPreparation`:
`{label, camera, material, target, roots(), positionOnly?}`. The SDK defining facade is
`@wildshard/engine/render/offscreenPreparation`. Register an existing override pass
with its resource owner; the ordinary sliced precompile gathers the current,
visible caster variants in the pass camera's layers and borrows the exact material,
camera and render target. It does not advance a clock, rewrite shader sources, or change
caster visibility/parents. An entered frame's warm-up (`Game.warmEnteredFrame`) then draws
each pass once, one caster per program-and-layout key, into a 1×1 stand-in with its
target's formats (`warmOffscreenPasses` in `render/parkedDraws`), so the pass's first real
update builds no driver pipeline; the real target is never written. Disposal unregisters before resources
retire. `offscreenPreparations(scene)` reads registrations; `offscreenJobs(scene)`
collects detached compile jobs across the page's nested scenes. During entered-frame preparation,
`entryFrameExclusions(scene, futureRoot)` excludes only other registered, hidden
content roots. The future hierarchy, visible roots, shared materials and page
passes remain eligible. The same exclusions apply to colour/depth/family jobs
and offscreen pre-draws; ordinary boot retains its complete inventory. `CompileJob.camera?`
overrides the page camera for those jobs, keeping light-layer program keys exact. Set `positionOnly: true` only when the authored vertex shader reads no normal, colour or UV attributes; preparation then keeps the real draw cache's one representative per object flag set, including instancing, batching and skinning, without adding unused attribute programs.

**Offscreen builds.** `@wildshard/engine/render/offscreenBuild` defines
`prepareOffscreenBuild(renderer, build, current)`. A synchronous offscreen factory
keeps its meshes and materials alive until this promise resolves. Its ordinary
2D-target draws are captured, their exact shader variants prepared in painted
slices, and their original draws replayed in order with a paint between passes.
Camera poses, target viewport/scissor, renderer settings and vector uniforms are
captured per draw; samplers remain borrowed. The live renderer and original
uniform references are restored before each yield. Canvas/cube/mip draws and
depth-clear commands refuse; at most 256 passes are accepted. Owner cancellation
retires the returned target. A retained factory renderer forwards normally after
capture. This scheduling port does not change shader sources or texture formats. Pass
`{webKitOnly: true}` to keep other browsers on the synchronous factory path.
HDR and faceted-sky initial environments use this policy; retained day-clock
refreshes keep their existing synchronous calls. `CompileJob.toneMapping?`
prepares a captured pass with its own mapping and restores the page value.

**Asynchronous material resources.** `@wildshard/engine/render/materialPreparation`
defines `registerMaterialPreparation(material, work)` and
`waitMaterialPreparations(materials, current)`. Register the existing loader's promise
before preparation starts. Preparation awaits publication before compiling and
collecting upload samplers; it starts no additional fetch. A loader may resolve after
its own fallback, or reject to refuse preparation. Cancellation remains the loader's
responsibility; preparation checks its current owner before and after waits. Settled
work is removed from the weak material registry. The shared fire effect registers its
flipbook fetch here, preserving its texture pixels, samplers, shaders and procedural
failure fallback while avoiding a late first-draw upload.

**Initial layered presentation.** `SkyRig.prepareLayers()` restores prior layer
slots and applies the current owner weights at zero delta before shader preparation.
It advances neither backdrop time nor alternating-cascade cadence. The game grid's
`GridSession.prepareFrame()` publishes its existing feet-based sky/grade owners and
installs the existing composer effects. Boot calls these after composer construction,
before collecting jobs, so warm-up sees the same PMREM and post-chain as the first
live frame. The ordinary frame still restores and applies layers in its usual order.

### 13.2 Shader patches

Every shader patch goes through `patchShader(material, id, order, fn, { scope, mode?, key? })`. A raw
`onBeforeCompile` or `customProgramCacheKey` is a lint error (`wildshard/no-raw-shader-patch`).

| Export | What it is |
|---|---|
| `patchShader` | registers a patch; returns its remover. Pass `scope` so it goes with your level |
| `PATCH_ORDER` | order bands: material 100 · decorate 200 · shadows 900 · view 950 (fog slots: engine 100, stylize 200, a level's 300) |
| `ShaderSource`, `ShaderPatchFn`, `ShaderPatchKey`, `ShaderPatchOptions` | its types |
| `setProgramKey`, `hasProgramKey`, `setInheritedPatch`, `takeForeignHook` | program-key control and legacy hook adoption |
| `ownUniforms`, `OwnUniform` | a patch declares and binds the uniforms it reads that the compiled stage lacks (a look's chunk patch is absent, e.g. a region under the grid's neutral page shell); a no-op where the look declares them, so the standalone source is unchanged (G226) |

```ts
patchShader(material, 'template.linear-fog', PATCH_ORDER.decorate, (shader) => {
  shader.fragmentShader = shader.fragmentShader.replace('#include <fog_fragment>', '…');
}, { scope });
```

The renderer type is named only in `src/engine/render/**` (`wildshard/no-renderer-type`). The handle is `Renderer`
(`probeRenderer`, `isRenderer`). No WebGPU. **Facade multi-draw is banned everywhere** (AGENTS.md E271).

Coarse prop masks keep classic shader sources unchanged. The loaded node handler explicitly installs the internal
`render/nodeCoarseMask.ts` port: node materials compose their existing `maskNode` with the quadrant predicate using
their final world position, including instances. The port itself imports no TSL. Raw GLSL3 chunk shaders use matching
`out highp` / `in highp` declarations; node shaders use their native mask because they have no classic chunk anchors.

**Material graphs (SF59, lazy, not on the default path).** TSL is reached only through `render/graphBackend.ts`:
`loadGraphBackend(renderer)` installs `EngineNodesHandler` (the output transform, the upright target sample and scene environment, the fog
epilogue, the tent and cascade shadows as nodes, and the coarse-mask port); `loadGraphCompiler(renderer)` then loads `compileGraph(ir)`
(`render/graph/compile.ts`), which turns a graph IR into a node material. The renderer-neutral IR (`core/materialGraph.ts`,
`GRAPH_IR_VERSION` 1) is data: `nodes` of an allowlisted vocabulary (`GRAPH_OPS`: inputs, safe maths, comparisons and a
branch-light `select`, swizzles, MaterialX noise, an admitted texture, a constant-count `loop`), the stages
`vertex.offset`, `surface`, `lighting` and `post`, typed `params` that are uniforms only (bindable to a day key
or a declared shard-state field; `setParam` never recompiles; a texture param with `role: 'lent'` names no admitted file:
its trusted runtime lends the sampled texture (a decoded baked key, say) with `setTexture`, which swaps every sample of it,
a 1×1 black stand-in until then, through `runtimeLookMaterials` and the backdrop's `lookGraphMaterials`), and a
per-program budget. `validateGraph(ir, opts)`
refuses unknown ops, type mismatches, cycles and over-budget graphs before any node exists. A select with cheap sides
compiles branch-free (`mix`); one with an expensive side nothing else reads becomes a real `if / else`. Presets
(`render/graph/presets.ts`) re-express a family for the parity bench (`scripts/tsl-spike/`, the `graph` variants):
`pbrMeasureGraph` (PBR + the SF56 measure layer, size labels included) and `emissiveGraph` (the emissive surface and
tube), `toonGraph` and `painterlyGraph` (their light models through the `lighting` stage), compiled under
`PRESET_GRAPH_BUDGET` (the labelled measure preset runs past the content budget). The `lighting` stage (a `standard`
material only) has four outputs: `sun`, the radiance a directional light adds, built per light from `sunDirection`,
`sunColour` (unshadowed) and `sunShadow` (the cast-shadow ratio) with `normalView`, `viewDirection` and `albedo`;
`sunSpecular`, a factor on the physical specular (absent: no specular); `ambient`, the indirect diffuse from `irradiance`;
`grade`, the lit colour (`litColour`) before the output transform, which turns tone mapping off. An `ambient` that
reads `radiance` (the environment's prefiltered radiance along the reflected view ray) or `environmentIrradiance` owns
the whole indirect term: the physical model adds no environment diffuse or specular of its own (Pine Hollow's water
writes its Fresnel reflection there). The SDK's `environmentIrradianceAt(direction)` (`vec3 → vec3`, ambient only)
reads diffuse sky irradiance along a nonzero **world-space** direction, normalized by the compiler, instead of the
surface normal. It includes the environment's rotation and live intensity, keeps three's × π convention, and returns
black without an environment. It also makes ambient own the whole indirect term. A reflected crown can sample its
own normal while the water body retains `environmentIrradiance`.
`surface.normal` (vec3, world space, lit models only) replaces the shading normal
the lights, the environment and the lighting stage's `normalView` use: a per-pixel ripple or detail normal. The compiler's
`GraphLitMaterial` keeps three's physical model and the engine's light nodes (tent, cascades, fade) underneath, so the
epilogue is unchanged. `toonGraph` refuses caustics and `painterlyGraph` a wind sway (not ported yet);
`emissiveGraph` refuses a sky, an additive blend or a fog share other than 1. No shipped material uses a preset, and
today's families stay hand-written GLSL.


SF59 effect graphs may add `effectState: { blend?, fog?, depthWrite?, depthBias? }`.
`blend` is `alpha` (straight RGB), `additive` (straight RGB multiplied by alpha
and added), or `premultiplied` (RGB already multiplied by alpha, One /
OneMinusSrcAlpha factors). Each explicit blend enables transparency. `fog` can
only be `false`, bypassing fog for the effect; output colour conversion stays.
`depthWrite` is boolean; depth testing stays on. `depthBias` is `{ factor, units }`,
finite numbers within -16 … 16, using polygon offset. Omission keeps all old
material state, including fog and opaque depth writes. Post graphs cannot use it.

`primitive: "points"` requires `model: "unlit"` and
`stages.points: { size: <float vertex reference> }`. Size is drawing-buffer pixels,
clamped to 1 … 2048 and the hardware point range. Fragment input `pointCoord`
is vec2 over the point sprite (top-origin); it is refused on mesh graphs. Points
cannot have a mesh outline. Mesh remains the implicit primitive.
Vertex input `viewBillboard` is the absolute model-space position of a camera-facing
vertex: geometry coordinates are world metres, independent of object rotation or
scale, with object/instance origins retained. Use
`vertex.offset = sub(viewBillboard, positionLocal)`; instance scale is deliberately
not applied. Its camera/model matrix work is included in the instruction budget.

A trusted runtime can call `runtimePresentation(source)?.bindMaterial(id, object,
scope)` to lend a `look.materials` material to its own Mesh or Points by id.
It keeps geometry ownership, shares the data client's material and uniform feeds,
and gets a disposer. Either scope retiring restores the prior material and removes
any graph outline. Unknown ids, mismatched primitives and double bindings refuse.
This uses the existing runtime-product door, with no SDK facade. The Graph materials
Debug setting still controls graph compilation; when off, existing family fallbacks
remain active (a new point graph falls back to an unlit one-pixel point).

Exact optional GLB instances use `EXT_mesh_gpu_instancing.attributes._MATRIX`:
packed, unnormalized FLOAT MAT4 accessors (64-byte stride, aligned to 4 bytes),
column-major as Three's `instanceMatrix`. They cannot coexist with TRANSLATION,
ROTATION or SCALE. Each matrix is finite and affine (last row 0, 0, 0, 1), has
positive determinant, and preserves the existing 1000 scale bound with float32
rounding tolerance (squared basis-column length at most 1,000,000.25).
`_COLOR_0` optionally supplies packed unnormalized FLOAT VEC3 linear RGB in 0 … 1
(12-byte stride). Counts match across all instance attributes, still 1 … 10,000.
Matrices and colours are admitted and charged before the loader allocates them;
all old TRS admission and bytes stay unchanged when the attributes are absent.

SDK `staticGlb` opts in with `exactInstances: true` and optional
`instanceColours: readonly Color[]`; `bakeKinds(..., { exactInstances: true })`
keeps the original float32 matrices and any instance colour buffer. Omitted options
retain the old TRS writer and its refusal of coloured kinds. The engine's
`applyExactInstanceMatrices(root)` copies the admitted matrix attribute into
`instanceMatrix` before upload, without decomposition, and drops the unused custom
geometry attribute. GLTFLoader already copies `_COLOR_0` without colour conversion.
The normal rig loader and declared runtime-props reader apply this step. There is
no shard adoption or new SDK runtime facade in this addition.

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
| `EngineProbe.colliderTag(handle)` | reads the active probe world's actual material / owner identity for a live native collider; missing handles return `undefined`, retired probes refuse, with no debug overlay or native write |
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

`@wildshard/engine/core/meshCollision` admits the bounded WMC1 indexed-triangle format (at most 40,000 triangles and 120,000 referenced vertices per chunk). It preserves triangle winding and rejects nonfinite positions, degenerate triangles, unused vertices and trailing bytes. `@wildshard/engine/physics/meshCollision` installs those bytes as one scoped static WORLD collider with internal-edge fixing; queries keep bridges and ground below them as separate surfaces. Native installation is explicit and unload removes the collider. This codec is the authored-world collision seam; it does not install itself or convert geometry to a heightfield.

`installBakedMeshColliders(rows, physicsOrGetter, scope, restoring?)` supplies the existing activation and snapshot ports for stable mesh ids. All chunk bytes and supplied restore handles are preflighted before allocation. A restoring adapter reconnects existing static native triangles without resetting activation; it checks triangle coordinates/winding and rest pose, allowing Rapier's vertex remapping. An empty handle list is only an unbound adapter awaiting continuation restore. The lazy physics getter and scoped handle cleanup follow world replacement, so disposal never retains or removes a retired world's wrapper.

## 15. Audio

`audio.playback` declares ordered voice controls or recorded-sample
policies. `audio.voices.playback(recipe, ports)` uses the existing pool,
listener and RNG, with borrowed lazy clips when declared. It evaluates
state and scalar rows in order, preserving the native playback chain.

`audio.surfaces` declares ordered floor, scalar and circle probes with a
fallback surface. `Audio.surfaceMap(recipe, names, ports)` binds those rows
to actual floors, terrain, weather and optional points. Floors use the
specified feet tolerance; height and slope are queried only when reached,
and the first matching rule wins. Pine and Driftwood use the same host. `GROUND_SURFACES` exports the ordered seven terrain/deck names; ambience appends its existing five extra surfaces.

`audio.emitters` declares sample-first loop graphs, native output routing,
fade curves, stop/disconnect timing and optional proximity ducking.
`Audio.loopEmitter(recipe, graphs, ports)` leaves the context locked until
the existing gesture and borrows the actual point, scope and music bus.

Ambience schedules can play a named recorded shot through a borrowed
player, with declared chance, gain and radial placement. `start: built`
runs after graph construction; `entered: true` cancels it on exit and
restarts on entry. The declared global/host random source is preserved.

Ambience routing `probes` reads native bounds, nearby point lists, oriented
floor footprints, circular regions and live zone spots. Ordered rows feed
the existing mixer expressions; `probeFinite` holds the mix on invalid
listener/weather input. Floor, site and point ports remain real owners.

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
| `Synth`, `impact`, `synthKit` | synth fallbacks, the impact generator, and the synthesis primitives (`noise`, `voice`, `strike`, `bubbles`, …) content voices build on (a shard's creature voices) |
| `panFromYaw`, `loopAt`, `audioRandom`, `ownAudioSource` | helpers |

`audio/util.spatialAudio(position, listener, yaw, reach, scale, power = 1.4)`
returns distance, gain and stereo pan, or null beyond the inclusive reach.
It shares the creature-call and ambient-call spatial law while callers keep
their own buses, filters, sample fallback and random streams.

Paired music without boss layers uses the same bounded native AAC reader at
48 kHz, including mono tension. Both stems enter one `Deck` at the same
absolute start time and keep its existing independent gains, bar changes and
fade end. Authored loop cuts round to the nearest sample for both stems
(maximum half a sample); no track is time-stretched. Unsupported native
codecs/files or a live context at another rate keep the whole-file decoder.
Single-track bounded playback retains the existing Memory saver option.
Each short PCM window is observed by the audio memory ledger and released
when its source ends; preparation retains ten seconds, never a full recording.

`compactSampleLoop` (`engine/audio/preload`) keeps only an authored integer-sample loop window plus
128 interpolation samples on each side. It preserves the sample rate, channels, gains, random phase
and loop duration; fractional cuts keep the original recording. Compact windows share a bounded weak
cache by encoded-content digest, source shape and bounds. They never replace the full-file decoder
cache used by one-shots. `compactLoopWindow` (`engine/audio/loopWindow`) is the allocation-injected
PCM operation; it opens no device. Native 48 kHz playback is unchanged; another output rate may
produce inaudible resampler rounding from the shifted buffer origin.

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

`loadRigFile(url, aliases?)` can lend a file's dependency aliases by resolved URL pathname.
Alias and ordinary dependency URLs still pass through the default loading manager's tier and pack routing;
the aliases use a private manager and never replace the session's resolver.

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
| Weather | `Weather`, `WeatherProfile`, `WeatherNumbers`, `WeatherSaved`; asks `weather.hold` / `weather.damage`; kit `rainCurtain` | `new Weather<'clear' \| 'cloudy'>({ states, next, length, … }, ctx.app.rng.stream('gameplay'))`; `captureWeather()` / `prepareWeatherRestore(value)` / `restoreWeather(value)` preserve the base RNG, phase, mode, hold and exact numeric output keys silently; content-owned extra state is separate |
| Water | `WaterBody`, `WaterBodies` (`app.world.water`), `swellBody`, `basinBody` (`@wildshard/engine/world/water/body`), `surfaceReflect`, `WaterView`, `pondGrid`, `waveHeight` | the template's `POOL` row in `ground.water` |
| Fog | `attachFogUniforms`, `addFogUniforms`, `fogUniforms`; your `FogModel`; weather fog `weatherFog`, `WeatherFog`, `WeatherFogSpec` (E390: a second exponential fog over the level's own, compiled only when the manifest sets `atmosphere.weather: true`; `set(strength 0..1)` each time it changes, cleared when the scope ends; it composes with a backdrop's clock and the underwater blend) | `const storm = weatherFog(ctx.scope, { dist: 0.05, color: 0x8a5238 }); storm.set(eased)` (Signal Dunes' sand storm) |
| Wind | `wind`, `WIND_DIR`, `windGustAt`, `windUniforms`, `WindField` | grass, trees and arrow drift read it |
| Placement and models | `defineModel`, `ModelDef`, `modelContext`, `ModelContext`, `ModelPart`, `live`, `listModel`, `RosterEntry`, `twoSidedPositions`, `WeldBuild`, `markGpuOnly` | `defineModel({ id: '_template/lantern', pipeline: 'code', build: () => … })` |
| Forest and trees | `Forest`, `TreeFactory`, `TreeVariant`, `FadeBand`, `patchFade`, `patchWind`, `TREE_SPECS`, `TreeSpeciesTraits` (a species' planting: scale, growth, girth, spacing, hue), `TreeSetVariant` (a tree set's variant), `SpeciesWeights` (the level's own set and traits: `TreeSpec.setVariants`, `ForestSpec.speciesTraits`; E405), `treeSetOf`, `treeSetUrls`, `loadTreeSetGeometry`, `BARK_LAYERS`, `patchBarkArrays`, `patchCardCrownTop`, `patchImpostorCrownTop`, `standIn`, `loadBakedCards`, `exportCardTextures` | |
| Geometry kit | `log`, `beam`, `rope`, `sagLine`, `rock`, `plank`, `tris`, `wobble`, `pole`, `blob`, `lathe`, `revolve`, `revolveUV`, `mergeVerticesByPos`, `voxelAO`, `aoTint`, `hemisphere`, `VoxelAOParams`, `HemiRing`, `HemiDir`, `lin`; the AO bake (SF67): `addVoxelAOBake`, `withVoxelAOBake` (a world build with a shard's baked table added, then dropped), `decodeVoxelAOBake`, `encodeVoxelAOBake`, `recordVoxelAO`, `voxelAOBakeStats`; its key drops the trig last bits Node and the browsers disagree on (hemisphere directions to 1e-9, normals to 2^-16) and probes the ground coarsely, so a hit skips the full column cache | |
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
depth clear when every model is hidden. The game's weapon families share this root through `game.viewmodel`.

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

**The swept melee clock (SF72).** `@wildshard/engine/combat/sweptMeleeCore` is the swept family's swing clock without a renderer: `new SweptMeleeCore(moves, timing, attackQueue, { start, charge })` with `tryFire()`, `strike(move)`, `stop()` and `step(dt, t, swingScale, held) → { move, active }` takes the combo (gap, one-deep chain after `chainLag`), the held heavy's charge and release, the active window and the cooldown; `snapshot()` / `restore()` are its exact continuation and `sweptMoveDamage` a move's damage. `SweptMelee` drives one for every sword, sabre and jian and adds only the pose, sweep rays, lunge and FX, so a headless runtime that steps the same clock from tick commands runs the browser's timing.

`@wildshard/engine/player/WeaponPickup` exports `ItemPickup`, the shared
orb, take callback, proximity cue and disposal owner. A subclass may wrap its
public `interactable` to expose a guarded prompt; the orb retains its original
interaction point/radius internally, so guard presentation cannot change its
proximity effects or prevent take/disposal from clearing the prompt.

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
| `CameraFX`, `Impacts`, `BladeGlow`, `dodgeFx`, `dodgeEnv`, `fxMaterial`, `annulus`, `FX`, `FxMaterial`, `FxMode`, `LightPool`, `SiteLights`, `LightSite`, `SiteLightAnchor`, `SiteLightKind`, `SiteFlicker`, `SiteRoom`, `SiteWave`, `SiteLightsLook`, `ParticlePool`, `ParticlePoolSpec`, `ParticleAttr`, `pointScale` | feel and FX (`SiteLights`: shared point lights that visit the nearest lit site's anchors and flicker by intensity) |

**Site light state ports.** `engine/fx/SiteLights` borrows a
`SiteLightState` (`{ lit: boolean }`) through `LightSite.state` or the
fifth argument of `addLamp`. The page publishes ignition before `step`;
an omitted state means always lit. The host reads values and never invokes
shard code. Pine waystones retain one box per stone; Sunscar publishes
brazier ignition into boxes before updating its shared pool. Room ranking,
anchor transforms and flicker stay in the light host. `test/site-lights.test.ts`
checks both shipped lamp rows, ignition changes and an empty pool slot.

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
The game's melee weapons call this separately from their damage request. For a velocity push, use
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

The starter set (`@wildshard/game/plugin/ui`) is `effect.poison`, `effect.burn`, `effect.bleed`, `effect.slow`, `effect.stun`
(`STARTER_EFFECTS`, `installStarterEffects`). Register rows with `ctx.rows.effect(STARTER_EFFECTS)` in `kit`.

**Held arms (G474 / G475 / G477).** `@wildshard/game/systems/viewmodel/toonArms`
defines `ToonArms`, the game host for sword arms, sockets, material binding and swimming.
`new ToonArms(row)` admits `@wildshard/format/heldArms`'s `ToonArmsLookSchema` before
loading anything: rig URL/skeleton/joint names, sockets, offset/frame, blade base,
shadow lookup distance, swim plane and graph material identities. The rig uses
`RigArms`'s semantic `arms`, `sword_wood`, `sword_iron` meshes and arm/swim clips.
`prepare(context)` resolves graph material identities under the platform scope
and obtains shared day uniforms from the row's lighting id. The backdrop reads
those uniforms with `ToonArms.lighting(row)`. Each scope releases its prepared
catalogue independently; the newest live preparation wins.
`load()` returns the manifest's wooden/iron sword arms and swimming hands;
`specimen(sky, kind)` creates an independent Explorer skeleton with shared geometry.
The host preserves blade quantization/glow, per-vertex metalness, shadow following
and the camera-space swim plane. A shard supplies rows and the platform context.
No rig or material catalogue is installed by importing the module. The host uses
the native `RigArms` loader, without an injected loader port. The fixture
`test/held-arms-platform.test.ts` drives invented harbour material/lighting rows
on the native rig file path, including release, glow and swim behaviour.

**Item effects.** `game/loadout/effects` defines the client-only
`installItemEffects(context)` installer. `combat/items.loadout.effects` selects
status icons, ordered owned/worn player grants, and grants for explicit native
weapon item ids. Optional `hitCap` selects an effect only when the manifest has
a finite fight cap. Build admission rejects missing or duplicate native targets.
The installer resolves player, equipment, ownership and entered/resident lifetimes
from the context; no shard callbacks or reflected paths cross its API. Pine's
status binding and Driftwood's owned perks use this same installer. Engine
`bindPlayerEffects` combines status movement, periodic damage, max-health changes
and dodge cooldown modifiers in one observer, so one effect cannot overwrite
another attribute adapter. The existing health, ownership and weapon saves remain
authoritative; the installer creates no save slot. A scope releases every grant
listener and restores native attribute bases. Weapon damage keeps its integer
rounding, while heavy multipliers remain unrounded.

**Held melee claims (G475).** `game/loadout/claims` defines the client-only
`HeldClaims` host. The platform `held/arms` section (`format/heldArms`) contains
one rig/look identity, native item ids and blade families, cold Explorer cards,
and world claim rows. A claim names its site, owned/save key, prompt/toast,
original geometry files, scene recipe and material ids; its guard is a quest
condition row over flags and live actor facts. Halo, light, seed and fade
values are data. `HeldClaims.prepare(context)` loads verified geometry through
engine `createOwnedGeometry`, preserving every attribute and the authored
indexed or triangle-soup draw. It resolves its own graph materials and native
rig; `install()` binds the existing melee and EquipmentService owners internally.
No shard-created factory, guard or material loan crosses the public API.
`claim(id).bindGuardFlags(flags)` accepts plain save facts; the host reads live
native actors when the prompt is queried. Ownership and take/save behaviour
stays with EquipmentService. `HeldClaims.gear(rows)` defines cold Explorer
cards; `ToonArms.admit(look)` explicitly admits a shared rig identity.
A manifest's `bindings.sword: { rows: "./data/heldArms.json" }` generates the
standard lazy provider, so the shard supplies no TS wrapper. No service is
installed on import. `test/driftwood-sword-scene.test.ts` drives an invented
harbour catalogue through the real geometry intake and existing guard
save/death semantics.

**Held equipment catalogue (G474 / G477).** `@wildshard/game/plugin/heldEquipment`
reads the platform `held/equipment` section, defined by
`@wildshard/format/heldEquipment`. It replaces the separate private held-playback,
input, sights, action, firearm-detail, launcher-pool, hand-pool and tool envelopes.
`HeldEquipment.prepare(product)` explicitly admits and prepares its immutable
geometry libraries; `current(slug)` refuses access before preparation.
`install(context)` resolves item ids and constructs the native held families;
`launcherRows`, `launcherModel`, `preloadFirearm` and `firearmSpecimen` let the
world pickup and Explorer use those same parts on their own materials.
The section owns camera/hand/material/channel rows and extra feel values.
`heldLauncherProfile` and `heldFirearmSettings` project action clocks, ammunition
and ballistics from the item's native profile, preserving its single source.
Baked hands are borrowed; firearm detail geometry is copied, and native atlases
retain their existing refresh and cache/disposal policy. Coat maps load before
sleeves are created. The fictional harbour fixture in
`test/held-equipment-platform.test.ts` supplies different assets, materials,
channels and tuning through this same host.

**Held loadout (G474 / G477).** `@wildshard/game/loadout/held` installs
`installHeldLoadout(context, rows)` from the platform `held/loadout` section
(`@wildshard/format/loadout`). Rows declare ordered ammunition kinds, fallback,
stack capacity, ownership identities, save fields, input, cues and presentation.
`AmmoPouch` in `@wildshard/game/loadout/pouch` stashes the selected live stack,
skips empty special stacks and preserves the fallback refill rule. Native weapon
families retain their fire/reload clocks and live ammunition.
`NativeHeldAmmunition` in `@wildshard/game/loadout/nativeAmmunition` adapts the
same pouch to native continuations. Its constructor takes the native `SimHost`,
loadout rows and item rows. `readNativeRangedItem` in `game/plugin/nativeItems`
resolves platform-installed owners by declared slot. Bow capacity and the combat
frame come from those native declarations. The held host resolves its declared
sound bank internally. The outer saved
schema admits named stacks; `prepareRestore` validates the exact declared keys,
caps and agreement with the live weapon before returning a mutation.
`loadoutLegacySlot` in `@wildshard/game/loadout/persistence` explicitly registers the row's original shard-scoped v1 save
ABI once per store; matching existing documents continue without a rename or
reset. `restoreHeldOwnership` takes legacy/owned identity arrays and returns
plain grant rows before unlocking equipment. `Inventory.had` accepts legacy row identities even when absent from
the current pack catalogue; `Owned.has` accepts row identities, while grants
refuse unregistered identities. The loadout host resets the pouch before
respawn refill, and `heldFinishEffect` in `@wildshard/game/loadout/effects` produces the shared permanent cosmetic
grant. Input and cue timers follow the existing entered-cell lifetime. Importing
these modules installs no service. `test/held-loadout-platform.test.ts` drives a
fictional harbour pouch and ownership rows, and resumes an existing Pine v1 save.

**Held skins and gear (G474 / G477).** `game/loadout/finishes` admits
`held/finishes` through `format/heldFinishes`; `HeldFinishes.prepare(product,
scope, geometrySourceId)` resolves owned copies through the engine's scoped
geometry source registry. Shards register pack rows through
`@wildshard/sdk/models/geometrySources`. Finish order, card order, material overrides,
drop identities and optional named extras are rows. The existing SkinLocker owns
v1 ownership/worn continuation. `game/models/heldGear` reads `format/heldGear`
rows for cold Explorer cards, variants and native ammunition counts. Its builders
borrow the admitted catalogue and preserve original materials, buffers, loading
bounds and live counts. `game/plugin/heldTool` reads tool rows and beat values
under the standard platform context; it owns delayed loading and timed motion.
No family, geometry or beat callback comes from a shard. Fictional harbour rows
and existing Pine saves/buffers are covered by
`test/held-finishes-platform.test.ts` and `test/pine-finish-product.test.ts`.

**Ranged ports** (the game's families use them; a custom ranged weapon may too): `Projectiles`, `projectileFlightStep`,
`ProjectileKind`, `ProjectileWorld`, `ShotOpts`, `DropArc`, `hitscan`, `HitscanProfile`, `HitscanResult`, `HitLine`,
`makeFlashTexture`, `brassFloor`, `stepBrass`, `BrassCase`, `installRangedFeel`, `RangedFeelProfile`, `ImpactSurface`,
`AmmoId`, `AmmoRow`, `ProjectileModification`, and the shared viewmodel helpers in `./combat/view/ranged`
(`Puffs`, `worldHit`, `FOV_HIP`, `FOV_ADS`, `viewmodelMaterial`, `TRACER_ORDER` … listed in the appendix);
`viewmodelRowMaterial` builds that shared material from a data row (`ViewmodelMaterialRow`: factors, a named texture set, tuples).
Renderer-free numeric ranged laws are defined by `./combat/shotSpread` (`shotSpread`, `ShotCone`,
`drawnSpreadDegrees`, `instantSpreadDegrees`) and `./world/windField` (`clockGust`, `fieldGustAt`, `WindFieldSpec`).
Cones consume exactly four caller-supplied gameplay draws; wind reads only its explicit clock, gust and front policy.
Callers own scratch vectors, easing, tuning and continuation; neither law reads the page or installs a service.
`./combat/projectileContact` defines contact-tip correction, glance, rest, burial, detachment and shaft-midpoint reach.
It writes only caller-owned vectors; collision queries, pickup cadence, attachment identity, capacity and survival RNG stay with the owner.
**Melee view ports**: `Move`, `Key`, `Trail`, `SwordWorld`, `SwordRig`, `SwordArms`, `SwordFraming`, `SwordMoveSet`.
**Arms ports**: `ARM_PAL`, `gloveFist`, `riderArm`, `placeArm`, `forearm` (Nalati's arms, waiting to move);
`buildHoverboard` (the hoverboard's geometry).

`SlashTrail` (`@wildshard/engine`) is the shared melee ribbon drawing block. `SlashTrailProfile` supplies capacity, subdivisions, motion threshold and the age/alpha channel. `sample(inner, tip, time)`, `reset()` and `rebuild(time, life, alpha?)` keep caller-owned materials and clocks; `geometry`, `count` and `newest` expose drawing and expiry handles.

`GroundTell` (`@wildshard/game`) supports ring, lane and wedge decals. `GroundTellWedgeStyle` supplies the cone and authored material/fill/alpha uniforms; `wedge(x, z, yaw, reach, fill, alpha, lift?)` uses animal yaw convention and drapes the sector onto terrain. Existing ring/lane shader behavior remains unchanged.

`smoothstep` (`@wildshard/engine/core/noise`) also drives DeathFade and the bow/spear authored curves; the normalized fade uses edges zero and one. Unclamped and early-return curves retain their distinct behavior.

`@wildshard/engine/combat/view/rangedFeel` separates `prepareRangedFeel(game)`
from entered listeners: it builds the existing camera/debris resources and returns
a `RangedFeelInstaller(events, scope, rowFor)`. Prepare while an admitted resident
is hidden, before shader warm-up; bind the returned installer only during entry.
It uses the same particle pool, seeded bursts, hit-stop and camera laws.
`installRangedFeel(game, events, scope, rowFor)` retains the immediate prepare-and-bind
contract for ordinary callers. Listener disposal and re-entry remain scope-owned.

## 19. Creatures and AI

`AnimalManager.replace(retired, x, z, yaw, variant?, placement?)` rebuilds one of that manager’s retired creatures with fresh rig and state, the same species and logical identity, and ordinary spawn RNG draws. It refuses foreign, live, already-replaced and simulation-bound views, or a live duplicate of the identity, before construction. This supports an authored home’s respawn after a portable logical checkpoint; it does not restore its former AI memory or reuse an authoritative simulation identity. Ordinary `spawn` is unchanged.

Import `AnimalSim` from `@wildshard/engine/entities/AnimalSim` for creature state, motion, attack clocks, geometric perception and damage without a rig. Its `AnimalSimSpec` supplies authored dimensions and multipliers; `AnimalSimPorts` supplies height, floor, time, random and damage services, and `AnimalMotor` supplies collision displacement. `step(dt)` advances the body and attack clock. Every instance has a stable `entityId`.

`@wildshard/engine/entities/animalPose` defines `AnimalPoseLaw`, `AnimalPoseInput`, `AnimalPoseRecipe` and `P_COUNT` (27 numeric pose channels). Supply existing dimensions and reuse the law's input object; `advance(dt, t, near)` preserves the shipping Float32 gait blend, overlays, clocks, terrain ease and far-LOD freeze. `sampleTerrain(heightAt)` runs at the caller's existing sample cadence; body movement, actor clocks, custom bones and matrix publication stay caller-owned. `onFootfall` receives the existing strength once per crossing. The leaf imports no renderer or active app and installs no scheduler.

`@wildshard/engine/entities/animalRig` defines numeric transform ports (`AnimalRigJoint`, `AnimalRigContext`) and the shipping `QuadrupedRigPose` channel-to-joint law. Construct it once with the existing named joints, then `apply(pose, dt, clock)` at the owner's nearby-pose phase. It writes local position, Euler rotation and scale only; it never creates a bone, scene, mesh, scheduler or collision publication. `snapshot()` / `restore(number)` own the breathing phase only; restore joint transforms through their existing owner and preserve last-published collision history separately. `applyAnimalRoot` copies the final actor position and applies the same terrain/flinch YXZ root tilt. These defining functions do not activate a page or native controller by import.

`@wildshard/game/plugin/animation` resolves ordered plain collision joints under an owner-supplied frame. Optional `CollisionJoint.order` and `scale` retain YXZ/unit defaults. `set(index, offset, angles, scale?)` poses relative to rest; `setLocal(index, CollisionTransform)` takes a numeric absolute local transform and its current Euler order without subtracting and re-adding rest offsets. Both write locals only. `solve(frame)` explicitly publishes world joints; point/capsule queries keep the previous publication until then. Upright y capsules follow the scaled y axis directly, while x/z capsule pitch keeps the existing formula.

`AnimalSim.advancePose(law, dt, t, near, advanceAttack = false, debugGait?)` samples the actor's scalar pose clocks after body motion, advances the supplied numeric law, and returns updated flinch/brace/death history to the same actor. It never moves, decides, draws or publishes joints. The default leaves the attack clock with `step`; a legacy view that called `stepMotion` passes `true`. `samplePoseTerrain(law)` updates targets at the existing owner's sampling cadence without stepping anything.

`AnimalSim.bindVolumes(port)` attaches one trusted `AnimalVolumePort` with the same `entityId`, published `headWorld` / `bodyCapsule` queries and an optional `foreCapsule`. Binding and actor restore execute no volume callbacks. Until bound, authored dimensions retain their existing queries and fore volumes are absent. The installer owns pose continuation and the explicit publication boundary; rendered `Animal` views refuse this binding because their real bones remain their source.

`snapshot()` / `restore(string)` preserve the bounded blend/foot history and scalar IEEE bits, including signed zero. Restore validates before mutation and neither advances clocks nor emits footsteps. Restore the actor's own clocks separately and feed them into the input before advancing; the pose snapshot owns no actor or physics state. A posed-volume caller must preserve when the page publishes its bone matrices: shipping contact checks may read the previous published pose before render propagation. This additive leaf alone changes no page update or hit-volume path.

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
| `CreatureBrain<S, A, C = ThinkCtx>` | a state machine: `think(ctx)` (decisions, on the brain tick) and `act(ctx)` (the body, every body tick); `transition(state)` |
| `ThinkCtx`, `EnemyWorld`, `AnimalDims`, `VariantMods`, `RigAnimCtx`, `FurStyle` | what a brain and a look receive |
| `StrikeRunner`, `StrikeSpec`, `StrikeContext`, `StrikeActor`, `StrikePhase`, `UtilityScore` | strikes as data: `pick(specs, ctx)`, `start(spec, actor, target)`, `update(dt, ctx)` |
| `canReach`, `ReachActor` | occlusion only: a WORLD ray from target feet + 1.2 m to the creature aim point; no navmesh test |
| `Hfsm`, `StateDef`, `StateChange` | the hierarchical state machine under the brains |
| `GroupBrain`, `GroupMember` | herds (Pine Hollow's night spawns moved into its folder: src/shards/pine-hollow/quest/nightBrain.ts, E405) |
| `WeightedTable`, `WeightedRow`, `TableDrop`, `TableSpec` | spawn and loot tables (`mode: 'weighted' \| 'each'`) |
| `inspectBrain`, `pinBrain`, `brainInspection`, `BrainInspection`, `installAiDebug`, `AiDebugHost`, `AiDebugView` | the AI debug overlay |



`@wildshard/engine/ai/strikeState` exposes `readStrikeState(value, specs)`, the strict continuation decoder shared by trusted policies. It validates finite clocks, phases and catalogue identities before returning a strike snapshot; malformed state refuses before the caller mutates its runner. `CreatureBrain` accepts a typed context parameter for renderer-free policies; existing subclasses retain `ThinkCtx` by default.
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
species with no `sounds` falls back on, by temperament (the game's `installKitSpecies` does; E405). `runtime.play.animals.spawn(kind,
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
| Coins and loot | `installLoot`, `installRuntimeLoot`, `ScopedLootHost`, `ScopedLoot`, `LootPresentation`, `LootShop`, `CoinBurst`, `registerLootTable`, `getLootTable`, `rollLoot`, `LootTableRow`, `LootContext`, `onCreatureDeath`, `DEATH_ORDER`, `CreatureDeathSource`, `ShopPanel`, `ShopGood`, `ShopState`, `ShopOpts` | the purse is per shard (`purseSave`); trusted runtime calls `installRuntimeLoot(context, presentation)` without a scene handle |
| Gear | `Owned`, `OWNED`, `isOwnedId`, `isCosmetic`, `OwnedId` | owned gear and cosmetics |
| Compendium and feats | `installCompendium`, `CompendiumHost`, `CompendiumWallPort`, `AchievementDef` | `ctx.rows.compendium(row)`, `ctx.rows.feat(row)` |
| Quest UI | `QuestState`, `QuestMarker`, `NpcDef`, `DialogueBox`, `ObjectiveLine`, `NpcTalk`, `QuestChip`, `LiveMarker`, `RewardCaption`, `ProgressSink` | the engine quest core is §17 / below |
| Completion | `ShardComplete`, `setCompleteEntry`, `ShardCompleteData` | the end card |
| Saves | `progressSave`, `inventorySave`, `purseSave`, `ownedSave`, `bountySave`, `compendiumSave`, `bossesSave`, `elitesSave`, `shardSave`, `saveSlug` | §9 |
| Travel | `travel`, `bindTravelInventory`, `applyTravelCarry`, `consumeTravelHandoff`, `TravelRequest`, `TravelHandoff` | a page-reload travel today |
| Cosmetics | `BodyShadow`, `installBodyShadow` | `manifest.bodyShadow` |
| Template | `installTemplateDebug` | the Debug ▸ Developer tools entry that opens a hidden level |

`CosmeticsLocker<Slot, Row>` (`@wildshard/game`) owns registered cosmetics, validates saved ownership and slot matches, and provides `own`, `wear`, `toggle`, `wearing`, `entries`, `version` and `onChange`. A `CosmeticProfile` supplies a slot selector, save slot and optional `autoWear` for empty slots. `SkinLocker` is the weapon-material profile (`SkinDef.weapon`), using the existing per-shard `skins` save with manual wear; Nalati supplies its own saved skin rows and auto-wear policy.

`src/game/cosmetics/locker.ts` owns the cosmetic inventory card state.
`CosmeticsLocker.pick(id)` returns the registered owned row and its next
`wear` / `off` action without changing state, saving or applying a look.
`cardRows(cards)` combines authored card order, icon, name, owned blurb and
`lockedBlurb` with live ownership and per-slot wear state. Unknown card IDs
refuse; `toggle` uses the same choice before its existing save path. Pine's
finish menu uses these methods. Nalati's W3 `bag.ts#skinRows` adopts the same
card-state owner, retaining its source labels and slot icons; its existing
locker already uses the shared toggle and auto-wear policy.


`@wildshard/game/inventoryLaw` defines the shipping `DEFAULT_PACK_SLOTS` fallback and renderer-free `InventoryState`, `InventoryPolicy`, `addInventory` and
`takeInventory`. The page's `Inventory` supplies its actual catalogue, kept kinds and slot limit; it continues to own
legacy save filtering, write timing and change notifications. Headless consumers supply the same authored pack policy.
The law preserves first-pickup order, stacks existing kinds when slots are full, and trades all or nothing.
Nonpositive trades remain successful no-ops; no save format or numeric admission changes are introduced.

`@wildshard/engine/world/interact/pickup` defines `walkInPickup(physics, feet, pickup)`, shared by rendered and native
pickup hosts: strict 1.1 m horizontal radius and 2.2 m vertical separation, with chest-to-pickup line of sight through
actual world collision (0.3 m target slack). The caller owns visibility, taken flags, events and inventory admission.
A null physics world retains the pre-physics page behavior; an admitted headless world supplies its native physics.
`itemPickupFloor(physics, point)` preserves the untossed item’s WORLD-floor settle ray (1.2 m above, 3.2 m reach),
including the inside-surface refusal. `ITEM_PICKUP_HOVER` defines its 0.78 m hover; callers own prompt lift and rewards.

`@wildshard/engine/world/interact/prompts` defines `PromptPoint`, `PromptTarget`, `PromptSight`, `pickPrompt`,
`promptVisible` and `setPromptSight` without a renderer or view dependency. Picking preserves strict eye-distance
reach, first-row equal-distance ties and strong-before-weak priority. Visibility queries the actual native world;
a first hit on the target's exact registered or reconstructed owner also counts as visible. The owner association
is weakly held by the prompt. A null boot world retains distance-only picking; admitted native hosts supply physics.
`@wildshard/game/quest/interactionRows` and `@wildshard/sdk/runtime/prompts` define
`parsePromptRegistrations`, `bindHeadlessPrompts` and `createHeadlessPromptPicker`. Signal Dunes and Driftwood
use this one client prompt law in their native hosts: eye = authoritative feet + 1.68 m, strict reach,
stable page registration order, strong-before-weak priority and actual-world LOS. Captures retain native sight
slack and registered owner identity; piece-object and string owners remain distinct. Known prompts bind live
positions/reach, while unhosted page prompts still compete. Selection never performs an action; only its selected
act can answer an explicit script command. Cracks, walk-in pickups and pressure plates keep their separate owners.
`Physics.colliderTag` exposes the same surface/owner association collision queries read for trusted native captures;
`PromptTarget.sight` reads the actual association installed by `setPromptSight` without inferring an owner.


`@wildshard/engine/quest/dialogueClock` defines `DialogueClock`, the panel's exact type-out / advance law;
`DialogueBox` delegates to it while retaining its UI layer and input guards. Its bounded `snapshot()` /
`prepareRestore(value)` / `restore(value)` preserve fractional typing silently. `NpcDialogue` from
`@wildshard/game/quest/dialogue` selects authored NPC entries and commits their flags only on completion;
cancel and restore never raise flags. Its caller owns prompt eligibility, input guards and presentation.

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

`@wildshard/game/plugin/quests` defines renderer-free `applyQuestRewardPose(elapsed, origin, target, player, dayNight)` and its structural pose ports. It is the same defining law called by `QuestRewardBeat`: no timer, carry owner, caption, DOM, renderer or state restore is installed. The trusted owner captures/persists the origin and elapsed time, then supplies its existing player and clock; omitted destinations preserve the shipping behavior.

`QuestRewardController(player, dayNight, spec, effects?)` in the same module
owns the reward's existing elapsed/carry continuation. `spec` supplies its
start predicate, pose destination, hold duration and finish callback; returning
true from finish lends carry to the completion owner. Optional `start`,
`finish` and `release` effects retain the page's caption/sting/weapon order.
`snapshot` copies the native reward envelope; `restore` validates it completely
before changing pitch/carry and never runs effects. Position, velocity, yaw,
day clock and save registration remain with the caller. `QuestRewardBeat`
uses this controller for presentation; native quests use it without a view.

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

**A quest's coin reward (SHARD-PLATFORM M3).** Signal Dunes’ private `runtime/quest/questReward.ts` holds its reward plumbing. `questReward(ctx, { player, coins, amount, paid, markPaid, toast })` makes the `CoinBurst` (on
the play scene, or a scene of its own headless) and `pay`, which pays `amount` coins once per save through the platform
purse (`coins`, a `RuntimeCoins`) and toasts after the last lands; `paid` / `markPaid` are the save's record (a quest
flag, a shard save). `presentRewardedQuest(ctx, quest, reward, { id, player, paidAtLoad, newQuest, presentation, beat })`
installs the presentation (entered for a retained home, plain in play, none headless) with the held reward beat
(`beat`: kicker, title, subtitle, optional pose; shown while the quest is complete and `paidAtLoad` was false) finishing
in `pay`, pays at once on completion headless, toasts `newQuest` while the quest is open, animates the burst under the
system `id` and frees it with the level; it returns the live view's getter. Signal Dunes' `quest/install.ts` uses both.

`installPersistedQuest` in `@wildshard/game/plugin/ui` composes declared
NPC, reward, marker and bounded startup flag-repair rows. Model/material
ports retain ownership, and flags and rewards retain existing saved keys.

`bindPageQuestStages(ctx, source, ports)` in `@wildshard/game/plugin/ui`
binds the admitted `questHost` stages to real saved flags, actor liveness and
named owner observations. Saved seed flags initialize stages quietly; native
actions require explicit bindings. Declared ticking stages register through
`ctx.system`; event owners call `advance(id)`. Missing owners and undeclared
stage ids refuse. This transient page projection adds no saved cursor.

### Approved platform feature receipts (G474–G477)

The ruler records five approved features and their named future users in
`lint/platform-pending-users.json`. `game/plugin/heldLauncher` (bolt flight,
Nalati) and `engine/world/water/ripples` (Nalati) carry G474. G475 covers
`engine/world/Atmosphere` (`ColourRampFog`, Nalati),
`engine/world/lowpolyKit` (`bindLowPolyMaterial`, Nine) and
`game/shardfile/hybrid` (`HybridResidentWorld`, Nine; G476 extends residency
to every shard). The linked W3 rows state the adoption and its checks.
These explicit feature receipts stay platform when their wave is next;
ordinary G441 pending-user entries retain the current/completed-wave rule.

## 21. Shared content (the kit's, now the game's)

SF54 dissolved `@wildshard/kit`: content that 2+ shards use (the rule of two) lives in `@wildshard/game`, its trusted
existing transitional runtime facades in `@wildshard/sdk/runtime/*` (deleted under G307), and content one shard uses stays in that shard. Trusted `runtime/` callers migrate to the defining game plugin exports, not a replacement wrapper package. Shard files outside
`runtime/` import the defining game modules; `runtime/` files import the SDK facades. Ids are unchanged (`kit.creature.*`,
`kit.look.*`, the declared `kit.melee` / `kit.lantern` item families, `shared/*` model ids).

| Content | Defining module (runtime facade) |
|---|---|
| starter weapons | `@wildshard/game/weapons/{Sword,Bow,starterMoves,starterMeleeProfile,starterBowProfile,starterEquipment,starterGlyphs}` (`@wildshard/sdk/runtime/weapons/*`); the families themselves are the engine's (`@wildshard/engine/combat/{Melee,Thrown,bowDraw}`, `combat/view/*`) |
| species, creatures | `@wildshard/game/systems/species/*` (`installKitSpecies`), `@wildshard/game/systems/species/view/{boar,bear}`, `@wildshard/game/models/creatures` |
| icons | `@wildshard/game/icons` (`installKitIcons`, `BAG_ICONS`); their ids merge into `IconMap` from `src/game/icons.merge.d.ts` |
| interactables, pickups | `@wildshard/game/models/{interact,pickups}` (`installKitProps`, `installKitPickups`) |
| effects | `@wildshard/game/systems/effects/{starter,install}` (`STARTER_EFFECTS`, `installStarterEffects`; `@wildshard/sdk/runtime/effects`) |
| NPCs | `@wildshard/game/systems/npc/{npcRig,figureRig,figureMotion,faceHeads}` |
| declared items | `@wildshard/game/plugin/weaponFamily` (`declaredKitItemFamilies`: `kit.melee`, `kit.lantern`) |
| tools | `@wildshard/game/systems/tools/hoverboard` (`Hoverboard`, `HOVERBOARD_TOOL`; all shards; its `board` movement mode stays engine) |
| viewmodel, looks, audio | `@wildshard/game/systems/{viewmodel,looks,audio}/*` (`@wildshard/sdk/runtime/{viewmodel,audio}/*`) |

**A dusk look (SHARD-PLATFORM M3).** `@wildshard/game/systems/looks/duskLook` (`@wildshard/sdk/looks/duskLook`)
`duskLook(row, parts)` is a whole `extend` look from one `DuskLookRow` (pure data: the scene fog, the key light's
direction / colour / deepest-dusk colour / intensity, the held day clock, the dusk curves of the key, the sky fill, the
fog's sun tint, the far rings' haze and the aerial fog, the sand's height tint `DuskTintRow`, the skirt's grid and
swells, the procedural dusk dome, the sand and sky family rows and the painted sky stages that replace the dome once
they load) and its live `DuskLookParts` (the dusk and fire-pool uniforms, the sand's wind, the analytic field built
when the ground is, the sand maps, the `TintedTileGround` and the held `CubeSkirt`). `loadDuskSandMaps(rows, means,
fault)` uploads the dune-shadow, trail and grain maps with the grain tile's means. Signal Dunes' `look/render.ts` is its
binding (row `data/renderLook.ts` SIGNAL_DUSK_LOOK).

**Rigged creature hulls (SHARD-PLATFORM W2 C2).** `@wildshard/sdk/looks/riggedHulls` (`src/sdk/looks/riggedHulls.ts`)
`riggedHulls(row, urls)` is a shard's family of generated creature hulls pre-skinned offline to the procedural species'
skeletons, from one `RiggedHullFamilyRow` (pure data: the log label, the rigs to preload, `kind:variant` → hull, each
hull's generator flap `RiggedHullFlap` and each coat's fur sheen and rim `RiggedHullFur`) and its `RiggedHullUrls` (a
hull's rig file per tier, a baked coat's KTX2 key and lossless image, and an optional per-variant `parts`: baked rigid
geometry with per-vertex `_bone` and `_glow`, as a static GLB node loads it, appended once to the hull in the same draw
and flagged `overgrown`). `preload()` loads every rig and adopts its baked coats once; `skin(kind, variant, bones)` is a
species look's `skin` (null keeps the procedural mesh: no hull, not loaded, or baked against other bones). `pressFlap(pos, nrm, index, flap)` collapses a flap in place.
Pine Hollow's `species/hulls.ts` is its binding (row `data/creatureHulls.ts` PINE_HULLS; the thralls' eyes and ferns
baked by `generators/bake-pine-thrall-extras.mjs`).

**Weather reactions + keyed sky (G474/G477).** `look/keyed-sky` is an admitted
platform section defined by `@wildshard/format/keyedSky`. The client-only
`@wildshard/game/looks/keyedSky` consumes its image keys, preset frames,
weather-response rows and graph/channel ids through `keyedSkyBackdrop`.
`@wildshard/game/looks/keyedSkyClock` constructs the same renderer-free day clock for simulation.
Photographic gain-map keys are packed as RGB half-float rows at build, with their original
half-float horizon means retained as data; the page inflates and uploads packed
texels into RGB9_E5 without a pixel conversion loop. The standalone half-float path still
reads the original gain maps. See [WEATHER-KEYED-SKY.md](WEATHER-KEYED-SKY.md)
for the data contract, lifetime and host-bar scope. The shared day-clock,
day-air, overcast and graph-sky helpers now live in `@wildshard/game/looks/`.
Their authoring contracts live in `@wildshard/format/dayLook`; live colour
presets remain in `@wildshard/game/looks/dayLookPresets`.
Day-clock dusk/lamps readers are numeric preset field ids, with no caller
callbacks.


**Graph day skies (SHARD-PLATFORM W2 C2).** `@wildshard/game/looks/graphDaySky` (`src/game/looks/graphDaySky.ts`)
`graphDaySkyBackdrop(spec)` is a shard's day sky drawn on material graphs as a `SkyBackdropFactory`: the host compiles
the sky's graphs (`spec.ids` from `spec.source`'s look catalogue, `DaySkyGraphs`), preloads the baked textures and LUT,
adds the dome, owns the image-based light (`SkyEnvironment`; a scene source may build its first PMREM offscreen), runs
the clock's jumps (`onSet`: `prepare`, then a snapped `drive` and a whole refresh), keeps the dome on the camera
(`follow`) or hands it to Game as `clouds`, and frees the dome, the environment pass and the environment on dispose with
their GPU bytes. The dome is a row (`spec.dome`: its graph, radius, segments, draw order, name): the host builds the
back-faced, depth-test-free, untonemapped sphere and hands it to `build(context, graphs, dome)`, which returns a
`DaySkyBody`: its environment source (`domeEnvironmentScene(dome)` for a scene source), running clock (`runDayClock`)
and frame (`drive(targets, post, snap)`), plus what it holds beyond them. **The frame as data (H4):** `spec.channels`
names a numeric client-channel group (`installChannelPrograms`, below) installed at `bind`; after each `drive` the host
fills the `clock` owner (`phase`, `day`, `night`, `sunX…Z`, `moonX…Z`), evaluates the group over it, the body's
`owners` (its blended preset, uniforms) and the backdrop targets (`sky.fog` `{ color }`, `sky.fogSun`, `sky.disc`,
`sky.discColour` `{ color }`, `sky.planetSun`, `sky.planetHaze`), then pushes every sky-graph param an output names
(target = a graph id, path `[param]` or `[param, x|y|z|w]`). Build-time authoring is
`@wildshard/sdk/clientChannels#numericChannelPrograms` (twelve outputs a program, each read a declared owner path).
Pine Hollow's keyed sky (`runtime/looks/keyedSky.ts`, group `pine.sky`) and Driftwood's faceted day
(`runtime/looks/facetedDayBackdrop.ts`, group `driftwood.sky`) are its users.

**Day air (SHARD-PLATFORM W2 C2).** `@wildshard/game/looks/daySky` (`src/game/looks/daySky.ts`) `driveDayAir(targets,
post, scene, row, frame)` writes the air a keyed day preset sets beside its key light (`driveDayLight`): the scene's
`environmentIntensity`, the fog's colour, sun in-scatter and distance / height densities (left alone under water), the
disc's colour and scale, the corona's colour and opacity, the cloud layer, the far ridges' haze and sea glint, and the
post chain's shafts, god rays and saturation. `DayAirRow` names the preset's fields (`env`, `fogSun`, `fogDist`,
`fogHeight`, `disc`, `halo`, `haloO`, `cloudSun`, `cloudLit`, `cloudA`, `far`, `light`, `volColor`, `vol`, `rays`,
`sat`); `DayAirFrame` is the caller's reused frame (fog colour, light body, cloud light direction, fade, above-horizon
share, disc scale, corona share). Uniforms only, no program changes. Pine Hollow's keyed sky is its user; G441's W3 match
is Nalati `look/skyRig.ts` `SkyRig.apply`, whose environment, fog, disc, corona and cloud-light writes move onto it.

**Overcast rows (SHARD-PLATFORM W2 C2).** `@wildshard/game/looks/overcast` (`src/game/looks/overcast.ts`)
`overcastOver(look, rows, s, level)` lays a cloud deck `s` (0 … 1) over the hour's blended look in place from
`OvercastRow` data: `scale` (× 1 + by·s, optionally through a smoothstep `curve`), `add`, `atLeast`, `grey` (toward the
colour's luminance × a tint) and `toward` (a storm palette colour, × the caller's light `level` when `lit`). Pine
Hollow's keyed sky reads its rows from `data/sky.ts` (`PINE_SKY.overcast`); G441's W3 match is Nalati
`world/installWeather.ts` `stormLook`, whose deck terms (key light, slate palette × the hour's level, disc curve, fill,
grade, shafts) become rows; its rain fog, wet-after and lightning flash stay Nalati's.

Shared species take a plain `{ ...BOAR, variants: [...] }` spread to add a variant (the template's Greyback elite).

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
note, ask: 'E<n>', reviewBy: 'YYYY-MM-DD', purpose?: 'developer' }`. Groups: `look · cover · sky · audio · combat · creatures · perf ·
loading · tools` (Look · Ground cover & foliage · Sky & weather · Audio · Combat & weapons · Creatures & NPCs ·
Performance · Loading & memory · Developer tools). The value is a `device` save (`debug.plugin.<level>.<id>`); `change`
runs on a pick and once at load when the saved value differs from `initial`.

```ts
ctx.debugRow({ id: 'template.oil', group: 'tools', label: STRINGS.debug,
  choices: [{ value: 'keep', text: STRINGS.keep }, { value: 'refill', text: STRINGS.refill }], initial: 'keep',
  change: (value) => { if (value === 'refill') lantern.oil = 1; }, note: STRINGS.debugNote, ask: 'E357', reviewBy: '2026-12-01' });
```

Comparison rows consume the Debug-row cap (`debugRows.max`, with the ask in `raisedBy`). A diagnostic or unfinished
system declares `purpose: 'developer'` on the same port: both Settings menus place it in Developer tools. Outside
Developer, its saved choice is ignored, its initial value runs, and its actions are inert; the saved pick is retained.
Developer tools still need ask/review metadata, but do not consume comparison capacity. A direct saved-slot reader
must apply the same Developer fence before selecting a reload-only system. `manifest.debugOptions` opts a level into engine rows that already exist (`['clockSpeed', 'ghosts']`).

**Capture.** `app.clock.setCapture(fps)` plus seeded streams make a frame-exact capture. The only URL params are the
`harness` allowlist in `lint/url-params.json`; never add one (AGENTS.md "No URL switches").

The composition root installs the gold coin geometry recipe with `installCoinModel()` from
`@wildshard/game/loot/coinModel`; loot simulation imports only the recipe port, without geometry construction.

### Declared platform movers

`@wildshard/sdk/runtime/movers` exposes the declared platform owner to shard runtime code.
`installDeclaredMovers` admits guest modules and installs scoped page fixed steps; views read published poses.
`verifiedMoverModules` detaches and SHA-256-checks admitted bytes before page or native construction.
`MoverScriptDriver` on `@wildshard/game/plugin/mover` supplies a consuming role and schedule to the generic
composed script lane. `compose(content, assets, ports, brains?, permissions?)` joins numeric state, optional
brain roles and movers under one module union and aggregate allowance. `install(sim, lane, options)` attaches
the separate pending-command/native-handle adapter. The full data host already owns the lane clock; a trusted
host opts into `drive: true` to advance that same lane once per fixed step and capture its complete continuation.
Restoration reconnects saved handles without an installation tick or duplicate bodies. Explicit reset IDs restart
dedicated road lifts; an empty list preserves durable mid-travel poses and pending commands. Adopted views and
chains keep their existing native owners and cannot use the platform/static native restore path.

### Embedded simulation

`@wildshard/engine/sim` exports `SIM_API_VERSION`, `SimLevel`, `SimCommand`, `SimHost` and `createSimHost`.
The embedding root loads Rapier WASM and supplies it to `createSimHost(level, { rapier })`; plain level data
defines the heightfield, player, creature identities, strike timings and quests. `step(command)` advances one
60 Hz tick; `advance(seconds, command)` retains its fixed-step accumulator. Each host owns its physics,
clock, RNG, events, entities, damage pipeline, flags, quest progress and timers.
`onStep(id, run, adapter?, phase?)` registers scoped per-instance behaviour with optional continuation state.
Nalati’s local `runtime/playerModes.ts` adapter registers its traversal against the host’s events.
After physics, an undriven player asks `player.traversal`; a true answer owns that tick's capsule movement,
clears impulse and suppresses ordinary walk, board, swim, dodge and jump motion. Entered drivers take precedence;
creatures, health and events still advance once. The mode installer owns traversal continuation in its adapter
and reinstalls it before restore. Headless input contexts are refused; commands supply input explicitly.
The optional snapshot player `traversals` retains the registry's last claimed identities, validated against
the freshly installed traversal declarations. Restore publishes their active modes without invoking motion;
inactive hosts omit the field and keep existing bytes. `PlayerModes.snapshotTraversals` / `restoreTraversals`
only transfer those identities; the traversal's own clocks and targets remain its adapter's responsibility.
`@wildshard/sdk/playerModeData` exposes `MOTOR_MODE_MECHANISMS`, the pure manifest declaration for the fixed
swim/wade and hoverboard modes, defined by `@wildshard/engine/player/modeData`.
`usePlayerDriver({ input, step })` binds one scoped motion law to an owned host with a player motor.
`input(command, dt, host)` runs before the one native physics step; true delegates the player to
`step(dt, host)` after physics, skipping the ordinary walk/board/dodge/jump. False runs the ordinary
motion unchanged. Creature systems, health and fixed-post events still advance exactly once. Borrowed,
frozen, disposed and duplicate bindings refuse; the returned remover releases the binding early.
The installer registers its mutable clocks/native handles through a `SimStateAdapter` and reinstalls
both before restore; `physicsRestored` reconnects its handles after the native world is replaced.
An absent driver adds no continuation fields and preserves the original snapshot bytes.
`observePlayerMotion(receive)` supplies one owned host's combat velocity input before gameplay callbacks.
The native walk samples commanded, shove or dash velocity before the motor, excluding transient impulses;
ground and hover state are post-move. Board motion uses its velocity. A delegated driver's optional
`motionSample()` supplies its authoritative velocity/state; absence delivers null, never an invented sample.
The observer is scope-owned, removable, and unavailable on borrowed/frozen hosts. Its reused scalar sample
must be copied by a retaining caller; gameplay owners register their own continuation. An absent observer
preserves native output and snapshot bytes. `player/combatMotion` defines `combatSpeedFactor(horizontalSpeed,
grounded, swimming, hover, referenceSpeed)`, the page's unchanged arithmetic from velocity magnitude.

Optional resident walking: {speed, crouching} on SimPlayerDriver tunes ordinary on-foot motion only
when input returns false; the standing native motor, fall, impulse and jump law still run. Crouching
blocks the grounded/coyote jump through the same jump law as the page; absent controls retain the
level speed and exact prior output. Non-finite or negative speed refuses before physics.
The defining module @wildshard/engine/player/walk exports walkingSpeed(crouching, sprinting,
wadeFraction, moveScale, effectMoveScale), the page's unchanged on-foot speed arithmetic;
callers resolve eligibility and depth.

A player's optional ride.sampleCommand() returns RideCommandSample (defined in input/commands):
{steer, sprint, jump} from the traversal's last consumed inputs. Only sampleCommand(1) reads it
and detaches its axes into existing fields. Legacy sampling and a traversal without that port keep
the original device sampling; no traversal identity or new wire version is introduced.

**Command version 1.** Optional `steer: {keyX, keyY, stickX, stickY}` preserves raw local
keyboard/semantic direction and stick strength separately; optional `sprint` / `crouch` are held
booleans. Any of those fields requires `commandVersion: 1`; finite axes lie in [-1, 1]. Old commands
omit all four fields and keep their original bytes and motion. `Player.sampleSteer()` reads the
same semantic directions and touch stick, without combining or normalizing them;
`sampleCommand(1)` opts a recorder into that detached sample. The ordinary no-argument sample
is unchanged. SDK tick admission validates the version before any step, and `simPlayerCommand`
forwards the detached fields to both ordinary and trusted native workers. Alternative motion
drivers consume the raw fields; their presence alone does not change the default motion law.
The default `beforeBodies` phase preserves existing fixed-step order; `afterBodies` runs after every creature
body and its contact hook, for equipment that follows the creature loop. `useBodyStep({ before, after })`
wraps each actual body step once, in actor order; paused bodies run neither hook. Installation and restore
register the same phases without advancing them. `SimSlots` provides typed script memory, module globals,
quest data and ledger dedupe slots for the F1 adapters. `dispose()` frees the host.

`@wildshard/engine/entities/bodyClear` defines the renderer-free `clearBody(actor, player)` law: an overlapping
creature moves through its native motor, respecting walls while retaining its ground-follow height.
The page AnimalManager forwards to this same law; an optional mesh receives the displacement after its pose
was drawn. No motor means no displacement.


Trusted deferred keepers use `SimHost.spawn(SimSpawn)` and `retire(id)`. A spawn copies its pure
recipe, owns a native creature motor and optional strike, and records the recipe in the existing
adapter continuation. Duplicate identities and conflicting adapter registrations refuse. Retirement
removes only explicitly spawned actors, frees their motor/strike and cancels attacks targeting them;
static level entities retain their original lifetime. Reinstall the saved dynamic roster, in its
original order and with the same recipes, during `restoreSimHost`'s install callback before restore.
The keeper must register its own respawn clocks/generation counters through `onStep`; installation
must not advance them. A missing roster or changed recipe refuses exact restoration. Pending strikes
resolve through `strikeSpecifications(id)` against those installed recipes, including dynamic actors.

The owned player rides the hoverboard on the client Player's own board law (`player/board.ts` `stepBoard`: momentum
steering, the 0.45 m ride-height spring, ballistic flight after an upward shove, a hard touchdown past 9 m/s files the
fall hit). `SimCommand.hover: true` is that tick's HOVER press and toggles the board, as the client's `hover` action
(`advance` refuses it, since it repeats its command); `setBoard(on)` is the direct switch. `boardColliders(colliders)`
registers board-only colliders (a `Piece.active` that follows `app.player.mode === 'board'`, such as hover decks):
they collide only while the player rides, synced before each step's physics. On the board a creature's knockback is
ignored and `impulsePlayer` with upward speed lifts the board off, as on the client. The snapshot keeps the ride
(`player.board`) and the handles (`boardColliders`) only when present, so a host that never boards keeps its bytes.

**Player modes and water (SF34).** The player's modes are one registry for both hosts (`@wildshard/engine/player/modes`,
Nalati’s local `runtime/playerModes.ts` adapter): the page Player's is `playerModes(player)`, a host's is `host.modes` over its own
player. The motor modes (`foot`, `board`, `swim`, `wade`) read the player's own state; a driven mode (`ride`, `grapple`;
`glide` / `climb` / `drive` approved) is declared `PlayerModeDef { id, hud, context?, traverse?, enter?, exit? }` and
entered with a driver: on the page a `PlayerModeDriver` takes the Player's `ride` slot; headless a `SimPlayerDriver`
(`enterHeadlessMode(host, 'ride', driver)`) owns the motion ahead of any `usePlayerDriver` driver until
`exitHeadlessMode`; the entered driver is not snapshot state, so the installer re-enters it from its own adapter before
restore. A headless host runs no traversal or input context yet. A mode-only piece collides only in its mode, one rule
(`modeCollides`) on both hosts: `Piece.mode: 'board'` on the page, `boardColliders` headless, synced from `host.modes`.
The water law (wade, then swim past 1.2 m of water over the ground, the dive and the haul-out) is `player/swim.ts`,
run by the client Player and, once a runtime calls `host.useWater({ surfaceAt, bob? })` (once, in its install, before
restore), by the headless player: the walk slows by the wade, the jump saps, a landing in water is soft, a dash stops
at deep water, `SimCommand.dive` / `surface` are the held swim controls and the board rides the surface. The swim rides
`SimSnapshot.player.swim` only while it runs; a host without water keeps its exact bytes.

**Body bands (SF72).** By default a host steps and collides every body every tick. A native shard's headless runtime
calls `useBodyBands({ rates?, rate?, present?, physics? })` once, in its install (before restore), to run its bodies as the page's
creature manager does: each body updates on its tick rate (§12; `rate(body)` names it, default `'always'` for a driven
or `'sidestep'` body, else `'ai'`; `'legacy'` is the manager's self-thinking rate), and with `physics` (default on) a
body holds a creature motor in the page's capsule only within 45 m of the player, released past 55 m. `bodyDt(id)` is
the tick's update step (0 while paused or on the off tick of `'half'`) and `brainDt(id, urgent?)` takes the decision
step on the same clocks, so a runtime's brains need no copy of the scheduler. The page's `TickScheduler` and
`CreatureBodies` run on the same functions (`src/engine/sim/bands.ts`). The clocks ride `SimSnapshot.bands`, absent
for a host without bands. An optional roster-owned `present(body)` predicate freezes absent bodies' brain and motion
clocks and, with physics LOD enabled, releases their motors. The installer restores its roster state before the next
tick; re-entry starts a fresh cadence without catching up the absent time. Omitted predicates retain the existing path.

`@wildshard/engine/sim/bands` is the defining pure module for the shared decision/body clocks and creature capsule LOD.
Trusted deferred-spawn installers use `creatureBodyDistance`, `keepsCreatureBody` and `creatureBodyShape` to synchronize
a new native body at the same frame position as the page; callers do not duplicate its thresholds or shape law.

`@wildshard/engine/sim/snapshot` exports `SIM_SNAPSHOT_VERSION`, `SimSnapshot`, `snapshotSimHost(host)`
and `restoreSimHost(level, { rapier }, saved, install?)`. Capture between fixed steps; the versioned JSON state
includes entities and strikes, queued events, timers and the accumulator, RNG and clock continuations,
the complete Rapier world and motor contacts, flags and quest progress, the four `SimSlots`, and each
registered adapter. Actor and live-position references resolve by stable identity in the restored host.
Restore boots a fresh matching level and invokes `install` to register its scoped callbacks and adapters;
authored content and functions stay outside the snapshot. Engine, snapshot and level fingerprints must match.
Use the returned host for the recorded suffix and dispose it normally. The sim-level fight fixture proves
identical hashes at five checkpoints after a JSON round trip, including pending damage and moving contacts.
Logical memory and custom snapshot values preserve `Infinity` and `-Infinity` through the reserved transport object
`{"$sim.number":"infinity"}` or `{"$sim.number":"-infinity"}`. Native positions, motor state and physics metadata still
require finite numbers; `NaN`, malformed tags and authored objects using the reserved key refuse. Finite-only snapshots
retain their previous wire bytes, including signed zero.

The native Node witness is `node --import ./scripts/sim-node-loader.mjs test/fixtures/sim-level/run.mjs`.
It boots JSON-round-tripped kit species and iron-sword data, runs 10,000 fixed ticks with real Rapier
collision, and proves damage and quest completion without a renderer, DOM or active app.

## 24. Lint rules and the ratchet

| Rule | What it refuses | Status |
|---|---|---|
| `wildshard/layer` | import direction (engine < game < kit < shards); shard ↔ shard; a file or import outside the four layers | hard (`.oxlintrc.json`, E405 AG28) |
| `wildshard/shard-game-imports` | shard game imports outside `runtime/`, including type/dynamic/re-export and relative forms; only exact SF73 inventory-registered frozen files are exempt. Engine imports remain G143/SF62 transition debt. | shrink-only ratchet seeded at 233 measured sites; promote to hard only at zero |
| `wildshard/legacy-npc-imports` | historical `figureRig`, `figureMotion` or `faceHeads` imports from any non-registered source, including primary runtime, relative/type/dynamic/re-export forms; preserves only the literal historical internal type dependency | hard; exact SF73 registered files only, never folder suffixes |
| `wildshard/public-index` | a cross-layer import names a module the layer's package does not export (`@wildshard/engine/x/y` does not resolve at all; a relative path into another layer is refused too); a module the layer's `package.json` `exports` lists is public | ratchet (per file) |
| `wildshard/no-reexport` | `export … from` (or `export *`, or exporting an imported binding) of our own modules: no barrels; a third-party re-export (a bundler shim) passes | hard (`.oxlintrc.json`, E434) |
| `wildshard/engine-words` | Wildshard vocabulary (shard names, species, items, the word "shard") in engine code; comments are not counted. A wire contract's field may keep the name `shard` (telemetry tags, reports, the harness probe, a model id) only as a property name or key, only in the files `lint/ratchet.json` `allow['wildshard/engine-words']` lists with the reason (E405, Jake). Engine copy says "level" and the game supplies its word (`s_level_word`) | hard (`.oxlintrc.json`, E405 LAYER-PURITY) |
| `wildshard/shard-names` | the game names no particular shard: slugs, display names, camelCase forms, distinctive stems and shard-declared ids, from `lint/shard-words.generated.json`; comments and ordinary words (pine, driftwood) pass | hard (`.oxlintrc.json`, E405 LAYER-PURITY) |
| `wildshard/no-shard-branch` | outside `src/shards/`: a branch on a slug or a style (`slug ===`, `style ===`, `isNalati`, a slug literal in a comparison or `case`) | hard error |
| `wildshard/no-level-identity` | outside `src/shards/`: comparing, switching on, or keying a table by a level's `id`, `slug`, `kitLook`, `style`, `biome` … Pass a capability or a data strategy instead | ratchet (4 at HEAD) |
| `wildshard/runtime-standalone` | source `runtime/` imports leaving its own folder, non-public packages, JSON/assets and raw/URL transforms; includes type/re-export/lazy/glob/resource forms | G450 per-file ratchet; new files start at zero |
| runtime/ file ceiling (`src/sdk/runtimePerformance.ts` `checkProjectRuntime`, `lint/runtime-files.json`) | an author build whose `runtime/` holds more source files than its ceiling: 128 for third-party projects, the Template and any slug without a line; a first-party checkout shard (`performancePolicy` 'warn') reads its own ceiling, seeded for the W2 client moves (G450 (5): Pine 152, Driftwood 128). `pnpm build` (the push gate) builds every shardfile project, so it refuses there | shrink-only: lower a ceiling as files leave `runtime/`; a rise needs a new `raises` line `{slug, from, to, why}`, checked by pre-commit (`scripts/precommit-inputs.mjs`) and `scripts/check-platform-ratchets.mjs` |
| `wildshard/no-build-time-import` | play imports of shard `data/`, `generators/`, `behaviour/`, `assets/`, `blender/` or `shard.config`; same-shard build composition and SDK CLI/bakers stay legal | G450 per-file ratchet |
| `wildshard/no-runtime-in-build` | build inputs importing `runtime/` or legacy play folders/root modules; G297 bridges remain measured migration debt | G450 per-file ratchet |
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

G450's three source-boundary rules enforce `lint/ratchet.json` ceilings directly during ordinary oxlint,
including the active commit/push gates. Existing file counts pass; every excess site fails, and missing rows mean zero.
Their `{count: true}` option emits all violations for census tooling, as configured in `.oxlintrc.ratchet.json`.
`lint/shardfile-boundaries.mjs` supplies the same AST visitors to oxlint and
`shardfileBoundaryViolations(root, sourceRelativeFile, sourceText)` to the verbatim runtime copier. The latter returns
raw `{rule, message, start, end}` diagnostics without applying migration debt; callers decide when a shard must be closed.
Exact registered frozen sources keep their historical exemption. Each migration removes its now-unused ceilings;
the new closed shard remains at zero.

**The other checks a shard meets**

| Check | When | What it checks |
|---|---|---|
| `scripts/precommit-guards.mjs` (`.githooks/pre-commit`) | every `git commit` | the commit's own files: oxlint, the custom rules against the ratchet, the shard layout when `src/shards/**` is touched, `gen-shards --check` when a manifest is touched |
| `tsc -b tsconfig.layers.json` (AG4) | `pnpm typecheck` (CI), the push gate | the layers as TypeScript projects (`tsconfig.engine.json` → `.game` → `.sdk` → `.commons` → `.shards`, declarations to the gitignored `.tsc-layers/`): an import that reaches up a layer in any syntax (type-only, `import()` types, a JSON file) fails with TS6307. The shard list is the composition root's (`src/shards.generated.ts`, installed by `src/shardList.ts` into `src/game/shard/list.ts`); the game sees only `ShardSlug` (`src/game/shard/slugs.generated.ts`); content icons reach the game as data (`BagIcons` from the kit, a compendium skin's `icon`) |
| `scripts/gen-api.mjs` (AG21) | `pnpm test` | the public surface, generated: every `@wildshard/engine` / `@wildshard/game` / `@wildshard/sdk` / `@wildshard/commons` export and `ShardContext` member with its kind and first doc line in `lint/api-surface.json`, rendered to `docs/api/` at build time (`pnpm gen`; gitignored, SF74 W13). `--check` fails when more lack a doc line than `lint/api-undocumented.json` allows (647, may only fall) |
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

`@wildshard/sdk` is the workspace layer above the game. Its public modules are the author boundary:
`@wildshard/sdk/version` defines `SHARDFILE_VERSION` (currently provisional v0). Public shard project files
(`shard.config.ts`, `data/`, `behaviour/`, `quests/`) import only the SDK or their own public files.
Trusted transition code in `runtime/` keeps legacy public engine/game/kit access; build-time generators never ship.
The SDK cannot import shard content. Each module owns its exports; there is no barrel.

`@wildshard/sdk/assets.assetBytes(base64)` decodes a JSON-safe authored payload without fetching or installing a service. The resulting bytes still pass through `assetCost(kind, bytes)` and normal library admission; decoding alone makes no residency claim.

`src/engine/models/ownedGeometry.ts` defines `createOwnedGeometry(url, channels?)`:
an explicit owned-template intake for a single identity-space offline GLB.
`load(bytes?)` deduplicates fetch/parse, or clones an explicitly supplied
`BufferGeometry`; `copy()` returns independent mutable attributes. `adopt()`
accepts an already-owned geometry only while unloaded, without retaining a
second copy. `take()` transfers the template and clears both template and
pending load, so subsequent reads refuse until another load/adopt. Custom GLB
channel aliases and triangle-soup identity-index restoration preserve the draw.
The owner still supplies materials, placement, animation and colliders; import
installs nothing. Driftwood's fixed, foliage and specimen intakes use this host.
G441 pending user: Nine's `world/specimens.ts` `SpecimenBake` will replace its
keyed clone/delete templates with owned intakes, adopting assembled geometry
from `runtime/geometry.ts`; `world/modelLook.ts` keeps its context ownership.
`createOwnedGeometryBatch()` groups up to 128 unique named/source intakes;
`geometry(url, channels?)` returns the same owned handle, and `load(bytes?)`
starts every declared intake concurrently. A missing map entry retains the
original URL fetch path. The batch holds handles, never another geometry copy;
callers still decide when readiness is committed and when admitted sources
are released. Driftwood's fixed and cover preloads use it. Nine's
`runtime/geometry.ts#readNineSpecimens` and `world/specimens.ts` will register
its bounded keyed templates and adopt the assembled geometry into these
handles; the existing copy/take and per-context ownership remain local.
This pending second user is rechecked at the end of W3.


`@wildshard/game/plugin/ui` admits a browser product with `shardfileSource` or selects it with
`installShardfileProduct`; `browserShardfileOptions` supplies the verified origin-wide content cache. Trusted kit
recipes and item factories are injected by the composition root. The resulting manifest runs the ordinary Game
stages and borrows its player, physics and fixed-step driver. Terrain and props refine under scoped tile residency;
UI reads the same admitted script and item state. The SDK's client includes the platform's base audio assets.

## Appendix: every export

The complete inventory, one line per module and the names it exports, is generated from the TypeScript sources at build
time. The sections above describe what to use; the notes below cover recent additions.

The numeric script mechanism is documented in [SCRIPT-ABI.md](SCRIPT-ABI.md).
`@wildshard/engine/script/admission` validates imports, memory and structured fuel/depth guards
without executing bytes; `@wildshard/engine/script/abi` defines the versioned contract.
`@wildshard/engine/script/host` owns bounded module instances and complete snapshots;
`@wildshard/engine/script/effects` publishes validated numeric batches atomically.

`withPreparedScriptMemories(modules, scope, pause, install)` allocates fresh AS memories across caller-supplied frame yields before an owned installer consumes them; asynchronous installers explicitly carry that owner across awaits. Every module is admitted before any allocation, and each request describes a separate default-limit host. Matching descriptors are consumed once by that owner or its child, including its admitted construction binding after an await; explicit foreign or unowned callbacks, lower custom ceilings and restores allocate normally. Seeds, initialization, quota accounting and snapshots remain in `ScriptHost.install`. Owner retirement rejects cancelled frame waits and pending installers. Cancellation, failure and return clear unused references; every prepared allocation remains in the CPU inventory. The caller keeps input/readiness fenced until installation finishes. This schedules allocation work; it is no memory discount or proven frame-rate saving.
`@wildshard/engine/script/queries` adapts read-only collision/navigation queries with stable numeric handles.


### Baked terrain (SHARD-PLATFORM SF9a)

`@wildshard/engine/world/terrainTileData` owns the bounded little-endian terrain codec and the triangle-diagonal height sampler. `@wildshard/engine/physics/terrainTiles` installs a critical collider heightfield in one local world and removes it with its scope. The SDK terrain baker emits 64 L0 and 16 L1 tiles from one shared 257² lattice, with ordered hand overrides applied before both rendering and collision. Linear RGB, geometric errors and the four 129-sample edges are baked data. Actual asset costs include decoded arrays, GPU geometry and L0 shadow draws. `@wildshard/game/plugin/product` checks grid completeness, collider/render seams, edge agreement and conservative errors; the full SF15a loader consumes its optional terrain section.

**Terrain tile views (SF15a).** `installTerrainTile(bytes, { root, scope, material, shadow })` from `@wildshard/engine/world/terrainTileView` draws one admitted render tile (its wire bytes, or its `TerrainTileData` already decoded off the main thread, SF18b) as a mesh whose triangles split along the Rapier heightfield's diagonal (the drawn ground is the collider's ground), with grid normals that two neighbouring tiles light alike. The scope owns the geometry and removes the mesh; normals and colours are GPU-only after upload. Every tile but a coarse one hangs a size/16 skirt under its edges so a fine edge never cracks against a coarse neighbour. A tile casts whole: it opts out of E153's shadow splitter (`chunkShadowCasters`), because it is already one cascade-culling piece and its `castShadow` is the 80 m shadow disc's switch (split, a 62.5 m tile drew up to 64 always-casting pieces: SF16 measured 85 % of the M1 template's calls there). `maskTerrainTile(mesh, quadrants)` hides a coarse (L1, 17², 125 m) tile's quadrants in its one index buffer while fine tiles cover them (no allocation, no extra draw, no overlap). `coarseTileMask(root, x, z, scope)` from `@wildshard/engine/world/coarseTileMask` does the same for a coarse tile's props in the fragment shader, keeping instanced meshes instanced; its updater takes the hidden quadrants. The game's `clientViews` (`@wildshard/game/shardfile/clientViews`) wires these and `installDeclaredProps` into the loader's `ClientWorldViews`; `clientMaterials` compiles `look.materials` and the family looks, and `shardfileLook(look, assets)` hands an admitted LUT's bytes to `dataLook`.

`@wildshard/engine/core/gpuOnly.gpuOnlyTrees(roots, label, keep)` marks static mesh attributes under explicit owned or borrowed native roots for release after upload. This client-only helper never expands to the whole scene. It visits shared geometries once, skips skinned and morphing meshes, retains dynamic attributes, and preserves `position` and indices by default for picking and collision readers. Bounds are computed before release; context loss uses the existing reload policy. Driftwood world roots and admitted terrain tile meshes use the same helper without changing their upload policy.



`prepareHybridShard` accepts an explicit first-party `stagesOwner: "runtime"` transition when the native runtime installs all admitted world, kit and play declarations (including its movers). Product validation, immutable-byte admission and residency run before native hooks. The data plugin is not constructed, so it registers no duplicate simulation, equipment or handoff. The default remains declared stages; outside products cannot select runtime stage ownership. This is a trusted composition port, not a shardfile-authored escape from admission.


**Data-only catalogue cards.** `@wildshard/game/plugin/context` defines `sourceManifest(source, admittedAssets?)`: pure identity/accent/presentation mapping with no fetch, decode or install. `@wildshard/game/shardfile/presentation` defines the exact `PresentationSchema` and `presentationCard`; `@wildshard/game/shardfile/stillImage` defines `parseStillImage`, `stillImageUrl` and `STILL_IMAGE_LIMITS`. Local charged image hashes resolve only from admitted bounded PNG/JPEG/WebP bytes to inert MIME-sniffed data URLs. The full loader uses these fields when present and preserves existing cards otherwise. SDK `assetCost("image", bytes)` uses the same parser and residency law.

### Declared water (SHARD-PLATFORM SF9d)

`@wildshard/engine/world/water/declared` compiles bounded local pools, seas and sloping stream paths into the existing `WaterBody` motor port. `@wildshard/game/shardfile/water` rejects nonfinite/out-of-cell data, duplicate ids, self-intersecting polygons and zero-length stream segments. The sea is last, preserving pool and stream surfaces in the registry. Each projection returns fresh bodies; normal level scopes own registration and unload. The real player fixture swims in a declared pool, wades on its shelf and leaves water at its boundary. No renderer or service is installed by importing these modules.


### Authoritative creature views (SHARD-PLATFORM SF3b forward bridge)

An `Animal` rig can bind once to its matching `AnimalSim` with `bindSimulation(sim)`. Its combat actor, health, feet position and commands then use that exact host creature. Render updates sample pose inputs into one reused buffer and never step the host, advance its attack timer or dispose its motor. Unbound legacy views retain their existing update path. `AnimalPoseSample` is the allocation-free presentation port; complete continuation remains the simulation snapshot.


### Declared props and author baking

`@wildshard/sdk/bake/props` merges opaque rough prop surfaces into the canonical tile grid, clips edge-crossing triangles, keeps interior scatter as `EXT_mesh_gpu_instancing` transform lists and produces a self-contained coarse/far mesh. Named panels and gear remain library GLBs. `bakeColourTexture` in `bake/texture` invokes the trusted local Basis encoder for mipmapped UASTC KTX2; the existing loader chooses ASTC on supported GPUs. Declared costs include CPU buffers, GPU buffers, instance matrices and shadow draws. Every resulting row must fit the content caps.

Shader patches that inject sampler uniforms declare their borrowed textures in `patchShader(..., { textures })`
(`@wildshard/engine/render/shaderPatches`). Warm-up includes these resources before the callback compiles;
copying a patch chain preserves its declarations, and undo removes them without disposing content resources.
Compressed array textures upload on separate painted slices with a graphics-error fence before the composer draw.

`@wildshard/game/shardfile/props` validates file, tile, library and texture dependencies. The admitted bytes enter `installDeclaredProps` from `@wildshard/engine/world/declaredProps`; `selectedTiles` contains `lod/x/z` keys, `includeLibrary:false` skips subsequent panel/model loads, and `disposeTile(key)` removes and disposes a streamed tile. Family materials and textures come from resolved catalogues. Stable panel roots expose visibility and pose ports to admitted scripts; collision remains separate declared data.


### Declared props and author baking

`@wildshard/sdk/bake/props` merges opaque rough prop surfaces into the canonical tile grid, clips edge-crossing triangles, keeps interior scatter as `EXT_mesh_gpu_instancing` transform lists and produces a self-contained coarse/far mesh. Named panels and gear remain library GLBs. `bakeColourTexture` in `bake/texture` invokes the trusted local Basis encoder for mipmapped UASTC KTX2; the existing loader chooses ASTC on supported GPUs. Declared costs include CPU buffers, GPU buffers, instance matrices and shadow draws. Every resulting row must fit the content caps.

`@wildshard/game/shardfile/props` validates file, tile, library and texture dependencies. The admitted bytes enter `installDeclaredProps` from `@wildshard/engine/world/declaredProps`; `selectedTiles` contains `lod/x/z` keys, `includeLibrary:false` skips subsequent panel/model loads, and `disposeTile(key)` removes and disposes a streamed tile. Family materials and textures come from resolved catalogues; each prop mesh draws with a shared, counted `familyVariant` (`@wildshard/engine/render/families/registry`) of its family material, which keeps the family's shader patches, program key and uniforms (`copyShaderPatches` in `@wildshard/engine/render/shaderPatches`), so toon and painterly props shade as their family and equal surfaces are one material. Stable panel roots expose visibility and pose ports to admitted scripts; collision remains separate declared data. `propColliderDescriptors` passes bounded box/stair shapes into `installDeclaredPropColliders` in `@wildshard/engine/physics/declaredProps`. Its stable-ID owners serialize without callbacks; activation ports have handle snapshots, a lazy Physics getter and a restoring mode that allocates no duplicate colliders. Scope cleanup removes render and collision resources.


### Declared items (SHARD-PLATFORM SF7e)

`bindRuntimeBoss` in `@wildshard/game/shardfile/hybridRows` accepts optional
`RuntimeBossOptions.identity`: `declared` (the default) gives retained boss bodies
their declared row identity, including retries; `runtime` preserves ordinary
runtime-assigned identities and allocation order when adopting existing saves.
Standalone bodies retain their ordinary identities in either mode.

`bindRuntimeActor` binds a finite `runtime.spawns.actors` body with no refill or
encounter. It accepts the same identity policy as `bindRuntimeBoss`; native
altitude/floor placement and spawn/retirement timing remain caller-owned.

SF70 adds exact melee/ranged/bow/spear declared input profiles. A hybrid's optional
`items.runtimeContexts` names existing input definitions, admitted only when its
runtime binds items; the runtime installer checks `InputService.has` for every
reference before constructing equipment. It registers no duplicate baseline.
`ItemFamily.presentation` (`ItemFamilyPresentation`, defining module
`@wildshard/engine/combat/itemFamilies`) preserves trusted UI/ammo, cues, hit-stop
and ranged-feel metadata. The declaration retains identity, slot, input context,
name, icon and swap glyph. The override is not author JSON and creates no new
projectile or script lane. Existing families without it keep their previous row.

`@wildshard/engine/combat/items` owns fixed-step cooldown, held charge, queued command aim and lantern fuel/light state. An admitted hook on the existing shared `ScriptHost` may select only its requested action for its host-bound item handle; configured contacts, damage and effects remain trusted. `@wildshard/game/shardfile/items` validates JSON rows, input contexts, loadout and module references, constructs trusted ownership aliases and resolves injected `ItemFamily` constructors. `installDeclaredItems` returns the normal primary/secondary/extras/order/install handoff plus the authoritative runtime map and fixed-step callback. `@wildshard/game/plugin/weaponFamily` supplies melee and lantern factories with scoped primitive views; the fixture uses the template whip and lantern numbers and a content-addressed 740-byte AssemblyScript module. Toggle/refill use action3/action4; UI reads `remainingFuel` and `lightOn` from the same runtime. The existing template switches at SF16. Bound creature views expose `simulationBound`: the legacy manager skips their decisions, damage, separation and movement-body allocation, while retaining pose/query hitboxes.

`@wildshard/game/systems/items/lash` provides renderer-free `LashRuntime` for a declared weapon row. `lashSpec` combines its contact, damage and cooldown data with lash timing and move ids. The owner supplies aim, combat targets, world crack targets and the damage pipeline; `cool` and `advance` run on its existing clock. `snapshot` / `restore` retain the unroll and second-lash continuation. The browser keeps its cord and charge view while the headless owner supplies physical contact volumes. `lashVolumeHit`, `lashLane` and `lashContact` share the contact geometry. `@wildshard/game/systems/items/lashHost` `installLashHost(host, { step, row, timing, moves, eye, commands, targets })` is a declared lash weapon in the renderer-free host (SF27): locked on, each lash leaves the player's eye toward the commanded creature's body or a world command's target spot (a target gone keeps the last aim); it takes the first body it meets (head balls and body capsules), else a chest in its lane, else a target row's spot (`LashTargetRow`: an interaction row's act, its spot and radius, and `crack: 'light'` — a crack's first lash — or `'heavy'` — the double crack's second, its first wraps); `cracked()` names the act it reached this tick, which the interaction step's crack rows read. Its continuation is `{ version: 2, …lash, target, world, dir }`. Signal's whip is the first (`data/headless.ts` SIGNAL_HEADLESS.lash, the well's crank and the waymark bowls as its targets).

`@wildshard/game/plugin/weaponFamily` is the weapon families' hook surface (SF36). A family holds
`hooks: WeaponHooks | null` (null, the default, is its row rule) and asks `hooks.damage({ phase, base, facts })` where it
computes a number a shard may own; a null answer keeps the row rule, so a hook can never stop a weapon working. The
mounted sword asks at its pass slash (phase `pass`, facts `speed` and `links`). `@wildshard/game/plugin/weaponFamily`
validates a shard's declaration (`{ id, entity, module, parameters, weapons: [{ weapon, damage: { event, phases, facts,
min, max } }] }`), checks the module's SHA-256 and admits it on its own `ScriptHost` under the unchanged ABI-v0 fuel,
memory, event, query and failure ceilings; `WeaponHookLane.hooks(weaponId)` refuses an undeclared weapon. Each call is its
own script tick with the inputs `[tick, 0, 1 (damage), entity, phase, weapon, base, ...facts]`, and must answer one
declared event whose integer value lies in `[min, max]`; a trap, a fuel overrun, a stray effect or an out-of-bounds fact
declines. `parameters` reach the module through the parameter query (410). The module's memory and globals return to their
admitted snapshot after every call, so a hook is pure and carries no continuation. `installWeaponHooks`
(`@wildshard/game/plugin/weaponFamily`) fetches and admits behind the default-off Developer "Shard directors
(data)" row and clears the hooks with the level scope. Nalati's sabre is the first: `behaviour/weapons.as`,
`behaviour/weapons.json` (rebuilt by `node scripts/bake/weapon-hooks.mjs` in a clean export), and
`test/combat/mounted-sword-parity.test.ts` plays its twenty-second trace identically on the hook.

`@wildshard/engine/ai/strikeRows` binds admitted `StrikeData` to the existing `StrikeRunner`. Scores are data (`constant` or `horizontal-distance` with a strict `above` boundary), evaluated without RNG, rendering or actor memory; `range: null` explicitly preserves an unlimited native contact range. `@wildshard/sdk/species` validates these rows and gameplay-only species data before native registration. Brain callbacks and view recipes stay with the trusted runtime.

`StrikeRunner.contains(spec, { actor, target, origin?, ringRadius?, airborne?, direction? })` is the native overlap query for owners that apply cover and damage themselves. The actor supplies only position, scale and yaw. It runs the same shape, scale and eligibility checks as `contact`, without invoking callbacks or changing runner clocks, deadlines or hit state. Pine and Driftwood use it before their existing cover check and damage call.

**Species brains (SF27).** `@wildshard/game/plugin/brain` (SDK `@wildshard/sdk/speciesBrains`) puts a
platform brain on a species row: `brain: { archetype, data }`, today `challenge-grazer` (with `phaseSlots`: the actor
seed's slot in `[0, phaseSlots)` is its circling phase, `seedSlot`) or `patrol-diver`, its data the archetype's strict
schema (`shardfile/grazers`, `shardfile/flyers`). `speciesBrains(species, strikes)` admits a catalogue: each strike row
passes the SDK strike schema, each brain its schema, and every strike a brain names resolves, before any row or policy
exists. The browser spreads `brains.bind(kind)` onto the species row (`think` / `act` bound to one policy per animal;
`brains.witness(animal)` names the archetype it runs); the headless host calls `installSpeciesHomes(host, spec)`,
the platform home keeper (`installHomeKeeper`) whose bodies take their species' brain, or the runtime's `custom` policy
for a kind with none (a unique boss), all observing through one reused `HomeObservation` per body; contacts file through
the host's combat pipeline inside the 70° strike arc with a clear line (`creature.<kind>`, `feel.blow`, `cover.checked`,
the move `contactMove(kind)`). Both sides build the same engine brain from the same admitted data, so a row behaves the
same in the client and the headless host. Signal Dunes' ray and strider are the first (`data/brains.ts` SIGNAL_SPECIES).

**Declared body contacts (X-C4).** `CreatureBodyRecipe.actions` selects bounded,
ordered actor-memory gates on the existing skirmisher or guardian policy.
Each gate names a state index, minimum attack phase, once field, admitted
strike and optional memory condition. Optional charge damage, point-radius
scaling and contact sound read the live body at contact. A miss still spends
the once field; sound runs only after a successful contact. Catalogue
admission resolves every strike before any body or policy is constructed.
`SpeciesBrains.bind(kind)` runs these rows on the page; `actions(kind, actor)`
lends the same policy to the native species observation. Both retain the
existing actor memory and policy snapshot, attack owner and decision clock.
The contact packet is shared with `ScriptSpeciesPolicy`; Driftwood's crab
and sailor and Signal's scripted species use the same reach/damage authority.

**Parametric stalker (SF82 BR-1).** `StalkerBrain({pattern: 'pack', members, home, spec, ports})` also owns
the circling-pack pattern over its actual ordered roster. `CirclingPackSpec`, `CirclingPackContext`,
`CirclingPackPorts` and `CirclingPackPrey` define the native ports and parameters. `initialize` performs
the original role/offset draws after preflight; `tick` shares the group decision clock and `drive`
preserves native per-body cadence. `snapshotPack` retains the complete token/prey/role continuation.
`ai/pack#PackBrain` stays the historical constructor preset; group-only calls refuse other patterns. The `hunt` pattern receives one manager-owned `config`, native `ports` and `player` observation. It inherits the original herd placement, per-body memories, awareness/flee/stalk/charge, navigation and attacker tokens from the renderer-free hunt core. Its `think(actor, dt, player, sprinting, speed)` overload preserves the original decision point; `sampleTerrain(actor)` binds the actual body's sampler. `HuntBrain` remains the historical constructor preset. Hunt memory, clock, herd centres and tokens stay in the roster owner's existing continuation; generic policy `snapshot`/`restore` refuse rather than inventing an incomplete save.

 `@wildshard/engine/ai/stalker` defines `StalkerBrain(profile)` for
`skirmish`, `howler` and `pouncer`. The skirmish profile supplies tuning; howl/pounce profiles also supply explicit
native encounter/query/event ports. `think(actor, taggedObservation)` keeps manager perception separate from
`act(actor)` contacts and `advance(actor|null, dt, time, engaged, leashing)` encounter frames.
`decideSkirmisher(actor, observation)`, `decideHowler(actor, observation)` / `decidePouncer(actor, observation)` let native presets reuse their untagged
observations without a per-frame allocation. No deferred actor is invented
at construction. The real pack, ledges, bodies, shared RNG, stage/engagement clock and callback ordering remain owned by
the host. `spawned`, `reset`, `disposeTell`, `damage` and the howl-only `enterPhase2` preserve each preset's existing
lifecycle. `snapshot()` / atomic `restore(value)` retain the original contract/object shapes; `howlerSnapshot()` and
`pouncerSnapshot()` retain typed preset access and refuse the other pattern. `readHowlerSpec` / `readPouncerSpec` retain
strict bounds. `ai/skirmisher` and Nalati's old runtime constructor paths are parameter presets of this shared policy,
not independent decision implementations. The admitted `stalker`/`skirmish` row and species catalogue canonicalize to the old skirmisher adapter and save
contract, using the same native body/token/RNG ports. Howl/pounce encounter row hosting and group `pack`/`hunt` remain
separate follow-up slices.

**Parametric guardian (SF82 BR-1).** `@wildshard/engine/ai/guardianPolicy` defines `GuardianPolicy(actor, profile)`:
`{ pattern: 'interior', spec: GuardianSpec }` or `{ pattern: 'perch', spec: PerchHunterSpec }`. `think(observation)`
requires the same `pattern` tag, preserving each pattern's native floor, reach, attack-token and perch ports. Interior
rise/sink and perch drop/climb/projectile recipes remain host-owned; the perch cooldown still draws the host's shared
attack RNG. `snapshot()` / `restore(value)` preserve the old tuning-contract string exactly; mutable decisions stay in
the actor snapshot, and construction/restore draw no RNG or body effects. A wrong pattern or invalid step refuses before
mutation; zero-step interrupts remain admitted. `ai/guardian` `GuardianBrain` and `ai/perchHunter` `PerchHunterBrain`
retain their defining paths, constructors and type names as presets of this one policy. This is a policy consolidation,
with no species row adoption, native body or collision change.

Species decision families `skirmisher`, `guardian` and `perch-hunter` use the strict `shardfile/brains` schemas.
`brains.bind(kind, native)` requires a trusted body factory for these families, called once per animal with the
admitted `{ archetype, policy }` and an optional third `firstContext`
argument from that first think/act callback. It retains native contact,
rise/sink, perch and shared RNG recipes; later callbacks lend their current
context without reconstructing the adapter.
`brains.decision(kind, actor)` supplies the same admitted policy to a renderer-free native body adapter. Construction
and restore perform no decisions or RNG draws. Automatic `bind` / `policy` without that body ownership refuses.

The guardian family also admits explicit `pattern: 'interior' | 'perch'` data through
`@wildshard/format/brains` `GuardianPatternsSchema` / `parseGuardianPattern` (author helper
`@wildshard/sdk/brains` `guardianPattern`). The species catalogue and full shardfile factory canonicalize it to the
legacy native family before all-row preflight. The declared tuning, body adapter and ordered save-contract bytes stay
exact; no-pattern `guardian` and old `perch-hunter` rows remain unchanged. This adds author data rather than a second
body, RNG or presentation owner.

**Species scripts (SF27).** A row's brain may be `{ archetype: 'script', data }`
(`@wildshard/game/plugin/brain`): an AssemblyScript module (`module`, its SHA-256) with up to 64 parameters,
up to 8 numeric `slots` (its state, with spawn values), up to 4 actor `memory` fields it reads and writes (a pose's
`mem`, with spawn values), `maxSpeed` / `maxTurnRate` and a catalogue of 1–8 `{ event, strike }`. `speciesBrains(species,
strikes, modules)` takes the module as the base64 its bake wrote (`scripts/bake/species-scripts.mjs`), checks its hash
(synchronous `sha256`) and admits it on its own `ScriptHost` under the unchanged ABI-v0 ceilings. Each think / act is one
pure call (`ScriptHost.rewind` returns the module to its admitted memory and globals in place afterwards), its inputs the
phase, alive, calm, clock, the distance and yaw to the player, both positions, the actor's yaw and `seedHash`, its strike
phase and busy flag, its slots and memory; it answers field records (new slots, memory, one steer within the bounds) and
at most one declared strike event, which the host turns into reach, then an attack token, then the trusted
`StrikeRunner`'s pick and start. Trigonometry goes through the math query (kind 1, `SPECIES_MATH_QUERY`: sin, cos,
atan2 on the host's Math, a large argument split at multiples of 8192), so a script matches the TypeScript policy it
replaces bit for bit. `ScriptSpeciesPolicy` holds the slots and the strike clock; its continuation is those two, never
module memory. Signal's skitterer is the first (`behaviour/skitterer.as`), held to its old policy by
`test/shards/sunscar-dunes/skitterer-script.test.ts`. The `modules` argument is a plain row (SHA-256 → base64), so a
shard keeps it in `data/`.

**Marked spawned boss fights.** Decisions belong to admitted `sim/scripts`
guests on the existing species body; the encounter keeps its memory marks.
`@wildshard/game/plugin/bossPhase` `bossFight({kind: 'boss', pattern: 'spawned', fight}, ports)` is the matching
view-free `BossScript`: a fresh body per checkpoint at `hpShares[checkpoint]`, the intro's rise over `riseSeconds`, the
phase marks, a storm (0..1, goal 1 in `stormPhases`, eased over `stormFade` s) the views read through `update(dt, storm)`,
invulnerability through the beats and the victory, inside a circular `arena`; its continuation is `{ stormGoal, storm,
invulnerable }`. The browser runs it under its views and the headless host through `installBossRow`. Signal's Dune
Matriarch uses `behaviour/matriarch.as` on the same borrowed authority as the
Roc. `test/matriarch-borrowed-body.test.ts` exercises its live native body,
three phases, checkpoint replacement and logical continuation.

**Phased boss fights (SF27).** `@wildshard/game/shardfile/phasedBoss` (SDK `@wildshard/sdk/phasedBoss`)
`bossFight({kind: 'boss', pattern, fight}, ports)` is the defining parametric fight entry. `arena` and `roaming` retain the existing phase/strike/add/hazard policies; `spawned` binds a real fresh body per checkpoint with phase memory and eased weather; `held` binds one retained body and its native brain restart. Pattern/host mismatches refuse before allocation, RNG or actor/view effects. The spawned and held patterns replace the unused shard preset wrappers; `phasedBossFight` retains the phase presets. Their native clocks, callback order, body ownership and serialized continuations stay unchanged. This entry does not replace the outer `BossBrain`/director encounter clock or an admitted AS body policy.

`phasedBossFight(row, ports)` is the richer sibling of `markedBossFight`: one body fought through a declared state machine.
A `PhasedBossRow` holds the arena frame (`origin`, `bounds`), the body's `rest` and `shieldSpot`, the `phases` (hp share
at each checkpoint, memory at a reset, how a resumed checkpoint begins, what entering the phase does: a roar act that may
shed a memory field, a mode, cooldowns, view calls, hazards started or stopped), the `modes` (each its damage rule, 0 =
immune and above 1 a soft opening; `shielded` = the bar shimmers and hp is locked; its look, its glow, its 10 Hz motion
`hold` / `fight` / `face` / `goto`, its timed beats `timeouts` and its `enter` effect), the attack patterns as strike rows
(`attacks`: a charged `burst` that fires expanding rings, a `combo` of cuts with per-cut damage, reach, arc and shove, the
commit turn and the chase; pairs are `[normal, enraged]` from `enragedFrom`), the `hits` rule (head sphere, an armour
melee breaks), a `crown` weak point worn by headshots, the hazards (`rings`, a timed `pour` that piles drift on the arena,
a sweeping `sweep` beam that also burns the boss), the `adds` (waves from spots in alternating pairs while the shielded
mode holds, a reinforce wait, the beat when the last falls) and the `victory`. Every dressing change is a declared, named
VIEW call (`views`: `arena.lid.open`, `arena.shaft`, `arena.shield`, `adds.spot`, `boss.glow`, `strike.arc`,
`hazard.ring`, `hazard.pour.fall`, `hazard.sweep`, `victory.heap`, …), numbers only, world space; the shard's
`BossViewBinding` must bind exactly the declared names. The ports lend the arena (floor heights, drift pile / clear /
drain, the threshold, the seal), the bodies (spawn, retire, bind the species brain, ready), the adds' spawn, the player,
the hit resolvers (`cut`, `hazard` by strike name), the rng and the feed. It returns the engine's `BossScript`, the body's
`brain` (think / act / damageMul the species forwards), the bodies and `snapshot()`. Nalati's Golden King is the first
(`combat/goldenKingRow.ts`, views `combat/goldenKingViews.ts`), replayed tick for tick against the shipped fight
(`test/fixtures/species-oracle/goldenKing.ts`) by `test/shards/nalati-grasslands/golden-king-phased.test.ts`.

The same installer accepts a `RoamingBossRow` (`kind: 'roaming'`) for a pursuing boss: named mode policies,
phase HP/reset checkpoints, authored strike clips, expanding rings, falling/burning hazards, lane chains and roaming
adds. Its ports lend actual collision contacts, bodies, charge lanes, player state and independent summon/charge RNG
streams; presentation stays in the shard through explicit view calls. `snapshot(id)` / `restore(state, find)` retain
body identities, hazard clocks, lane state and both streams. Pine's `data/kingFight.ts` declares the Antler King;
`combat/kingFight.ts` binds the page and native hosts and translates the existing saved continuation without changing
its fields or order. The frozen shipping fight and goals in `test/fixtures/species-oracle/antlerKing*.ts` cover every
mode, phase transition, view/contact ordering and restored suffix tick for tick. The fixed-arena policy above is unchanged.

**A spawned boss's storm** (`@wildshard/game/plugin/bossStorm`, SF27). `ui.RowBossView`'s spawned branch presents its
marked boss presentation row (`@wildshard/format/bossProfiles` `parseMarkedBossPresentation`: the arena `floor` the coin
burst leaves from, the `respawn` point, the `storm` and the toasts; the boss bar is the engine's `BossBar`) and runs
`bossStorm(ctx, source, player, storm)` over the play scene with the fight's storm strength each frame. The storm is the
level's weather fog (`weatherFog`: `dist` per metre in `color`, eased in and out; the level sets
`atmosphere.weather: true`, else the storm blows without fog) and one sphere shell per `shells` row
(`[radius m, share, look]`, outer first) riding 1.6 m above the player, drawn from inside after the scene and shown
while the strength is above 0.01. Each shell wears the shard's `look.materials[look]` graph, compiled through
`prepareClientWorld`, which reads the strength as the host field `shared.storm` (declare it in `runtime.binds`); the
graph owns the shell's colour, alpha and streaks, so a shard's storm is data only. A host with no world stage has no
shells. Signal's Dune Matriarch is the first user (`data/matriarchPresentation.ts`, `data/stormLook.ts`); Nalati's
Storm Titan (SF48) is the planned second (`lint/platform-pending-users.json`).

`game/plugin/headless.runtimeEquipment` constructs a primary and optional rifle
and secondary in declared order. Each preparation is awaited, then paused before
construction; the shared slice starts when equipment builds. `bindRuntimeEquipment`
adopts these same instances through admitted item families, checking profiles and
retaining native ammunition, legacy slots, metadata and declared presentation.
Its `{ factories }` form returns the equipment builder. `items.loadout.runtime`
declares owner item ids in construction order, primary/rifle/secondary/extra
slots, task pauses and optional slice milliseconds. Each factory receives the
admitted weapon spec and normal build arguments; missing factories refuse before
construction. `row: "native"` retains the original row, including pickup/Owned
locks; `row: "declared"` adopts the admitted row with optional native presentation.
The normal equipment service owns unlocks. Driftwood's two swords and Pine's
three ranged weapons use this path; extras retain their declared order.
`createClientScene` also accepts a named geometry map, borrowed with the same
validation as its resolver port; Driftwood's pickup and Far Reach's storm use it.
W1 single-item kits and Pine's three ranged owners use the same builder.
`game/plugin/simulation.bindNativeLoadout` supplies the existing slot/swap law,
live body and aim readers, and optional step/snapshot registration at the native
owner's original id and phase. Weapon and ammunition continuations keep their
existing owners; single-item `prepareRuntimePlan` adds no new saved step.

`@wildshard/game/plugin/quests` `installQuestGraph(host, { quests, interactions, npcs, graph }, ports)` runs a shard's
declared quest graph headless (SF27): `DeclaredQuests` plus the interaction step at the baked spots and each quest-giver's
talk spot, its runtime row (`parseQuestGraph`: `actor`, `step`, `actions`: `{ row, summon }` arms a boss when the row
runs). `drive: "external"` lets an existing modal/ride owner deliver `run(id)` without a second step or snapshot; transient marks refuse without their own continuation. `compileQuestTable(table, bindings)` compiles only supported latched-lever, pickup and bench flag effects, preserving ordered sets and leaving geometry, inventory and sitting with their existing owners.
Live native prompt rows may be supplied as `QuestGraphPorts.prompts` (at most 1,024).
`bindHeadlessPrompts` retains each registration id, moving position, reach and sight;
external QuestHost routes use the same nearest visible selection, including unhosted
competitors. This borrows data only and adds no callbacks, clock or continuation.
A skinned NPC can use `parseNpcDialogueRow` (SDK `questGraph`) to validate its unchanged dialogue without inventing pivot-body data. A quest-giver is an NPC row (`@wildshard/game/plugin/quests` `parseNpcRow`, `npcDef`, `npcSpot`): id, name, talk spot,
place, home facing, met flag, talk height and reach, face and wave ranges, its solid column, its pivot figure (model,
height, neck, shoulder, arm cut, material) and its dialogue. The shared pivot NPC host
(`@wildshard/game/plugin/geometry`) `installPivotNpc(ctx, row, { source, groundAt, player, met, file, dress })` stands it
in a level; `pivotNpcParts` is its Model Explorer figure. `pivotNpcParts` and `pivotNpc` also accept `PivotNpcGeometry`: body, head, arm and forearm geometries already baked into their local pivot frames. The native pivots, NPC motion and speaker registration stay unchanged. `bindRuntimeHomes` accepts an optional async pause between bodies; the synchronous form keeps its original allocation order, and the paced form retires partial bodies if its scope closes. 
`@wildshard/game/plugin/ui` `installQuestNpc(ctx, binding, ports)` admits the
`@wildshard/format/npcs` `QuestNpcBindingSchema` before borrowing the model.
`QuestNpcPorts` lends the player, flags, model geometry/material and optional
resource dressing. The binding declares the ground query, prompt label, system
id, met-flag observation and missing-model policy. It retains the existing pivot
motion and collider registration; an omitted figure and an empty talk anchor
remain distinct lifecycle choices.
The geometry loan also accepts prepared `PivotNpcGeometry` local-frame parts;
the binding forwards them without fitting or partitioning them again.
The pure `@wildshard/format/questGraph` contract defines `QuestGraphSchema`,
`QuestGraphRow` and `parseQuestGraph`: the bounded interaction actor, step and
ordered summon actions. `@wildshard/format/questInteractions` defines
`InteractionRowsSchema`, `InteractionRowsData`, `InteractionRow` and
`parseInteractionRows`: bounded marks, prompt/crack rows, ordered flag needs,
sets and forbidden restore combinations. Both modules admit data without
installing native or presentation owners. Their JSON Schema roots are
`questGraph.QuestGraph` and `questInteractions.InteractionRows`; the existing
game and SDK parsers preserve the defining schema identities and verdicts.

The pure `@wildshard/format/questHost` module declares `QuestHostRow`, the
`QuestHostSchema` admission contract, `parseQuestHost` and its semantic
`questHostRules`. It bounds external command routes, body and owner
observations, ordered data-only directors and individual continuations.
`installQuestHost` in `@wildshard/game/plugin/simulation` borrows actual
`QuestHostPorts`: native observation/action maps and the existing director
action bindings. Quiet initial observations preserve saved flag ownership;
optional seeds choose the original loaded state without replaying effects.
No body, mover, encounter or new clock is created by the quest composition.
Root `questHost` is optional and names `questHost.QuestHost` in JSON
Schema discovery. `questHostBindingRules` requires native quest ownership
and declares every durable flag; transient marks keep their existing
limits. `installDeclaredQuestHost` selects that admitted composition before
borrowing native ports. Bound presentation projections retain no quest host;
omission leaves the previous serialized bytes unchanged.

Root `questNpcs` also accepts `kind: "posed-talk"`: unchanged dialogue,
named figure, reading policy, optional authored placement and named conditional
completion. `installDeclaredNpcTalks(source, ports)` preflights every figure and
completion owner, then installs the roster in order through `installNpcTalk`.
The figure ports retain their native head position, animation, entry ownership,
weapon stow and approach callbacks. An optional prompt offset borrows an explicit
ground query. No new clock, save slot or figure fallback is installed.

`installDeclaredQuestNpc(ctx, source, id, ports)` selects the root's `questNpcs`
binding by NPC identity. Missing identities refuse before resource lookup. Root
admission requires native quest ownership, declared dialogue/met flags and unique
NPC ids, talk spots and update-system ids; absent declarations add no wire field.

Signal’s private `runtime/rowsHeadless.ts` `rowsHeadlessRuntime(manifest)` is a whole trusted
`prepareHeadlessRuntime` from rows: the baked metadata (`bakedSpecs`, `bakedSpots`), the homes and their brains (with
`holds`: a home's memory field held until a flag), the marked boss, the lash item, the quest graph and the terrain entry
walk (`@wildshard/game/plugin/productEntries` `proveTerrainEntries`). Signal’s private `runtime/shard/standaloneEntry.ts`
`standaloneHybridEntry(Native, { name, source, entry, runtime })` is a first-party primary's standalone hybrid entry.
These one-user implementations and their SDK facades returned to Signal under DS0.1; its bindings live in
`runtime/headlessRows.ts`, `quests/graph.ts`, `quests/scout.ts` and `runtime/quest/matriarchFight.ts`.


### Exported creature skins and clips

`@wildshard/sdk/bake/export` samples existing pose closures at a bounded 30–120 Hz cadence, retaining root motion, declared joint order and local joint TRS. `skinnedGlb` deterministically writes actual geometry, weights, inverse binds and named clips into a self-contained GLB. Its textures are explicit external KTX2 bindings. The shared admitted-byte parser checks node trees, skin indices and normalized weights, finite inverse binds, bounded ordered clip times and rotation channels before the loader allocates them. Reported residency includes the skeleton palette texture/matrices and decoded clip tracks; clip accessors also stay conservatively counted in GPU bytes. Engine playback continues through `GLTFLoader`, `bindRig` and `AnimationMixer`.


### Traversal readiness (SHARD-PLATFORM SF18d)

`@wildshard/engine/sim/readiness` computes a cold-cache distance from speed, request latency, critical wire transfer at the configured link rate, stall and decode. Its separate hybrid line conservatively adds runtime-chunk request, transfer and parse work on the shared link. Critical wire is capped at 2,000,000 bytes: 30 m/s, 5 Mbit/s, 0.5 s latency, 10 s stall and 0.8 s decode give 435 m; a 500 kB hybrid chunk plus 0.2 s parsing raises it to 480 m. `TraversalReadiness` requests by radial edge distance, tracks completion of colliders/sim/runtime separately and invalidates stale generations on unload or failure. `@wildshard/game/shardfile/readiness` counts actual admitted dependency bytes, including cold-cache commons, without charging render tiles. `@wildshard/engine/physics/readinessWalls` installs closed WORLD colliders in each frame and opens them only after all fences pass; call `sync` before the traveler moves. Null-instance proxy edges stay closed. Highway, strip and proxy ground belong to a separate platform scope and survive wall removal. Place an entry wall at the 6 m re-frame line on shared strip ground, so late readiness cannot push the capsule into a cell seam before its world transfer. Walls carry the same platform owner tag as deck/strip colliders. The joined Node fixture drives a gravity-bearing capsule at 30 m/s through the actual generated strip and residency driver with 3 s and 10 s stalls, a deliberately late collider, a U-turn, two world transfers, one enabled traveler capsule, unload/stale completion and a closed proxy edge.

The list itself is generated at build time: [docs/api/EXPORTS.md](api/EXPORTS.md) (`pnpm gen`).

### Declared script state and the local lane (SF11c)

`@wildshard/engine/script/host` restores a complete host checkpoint only after validating every module. Equal-sized linear memories and all admitted mutable globals restore in place; changed-sized memories use fresh instances. Both paths run no initialization, query or author function and preserve quota history, pending events and quarantine state. Admission forbids tables, start functions and passive data, so memory and exported mutable globals cover the complete guest state.

`@wildshard/engine/script/state` validates atomic shared/player effects over explicit stable field ids, with actor identity supplied by the host. `@wildshard/engine/script/lane` installs local authoritative server/entity work through the scoped sim step and captures complete continuations, including pending events and quarantine history. `@wildshard/game/shardfile/scripts` validates binding references and translates typed numeric state into the engine lane. See [SCRIPT-ABI.md](SCRIPT-ABI.md) for inputs, restore and the Node/WebKit conformance gate.

### Declared creature brain and spawns (SF13)

`@wildshard/engine/ai/platform` expands stable spawn data and installs a scoped pursuit brain over physics perception, navigation, creature motors and the existing strike pipeline. `@wildshard/game/shardfile/creatures` validates the archetypes and references. See [PLATFORM-AI.md](PLATFORM-AI.md) for parameters and the complete same-engine continuation.

### Declared phase encounters (SF13b)

`@wildshard/engine/ai/phases` drives declared elite and boss tables over the existing `BossBrain`, combat pipeline, checkpoint/retry clocks and scoped sim snapshot adapters. `BossBrain.snapshot/restore` captures the complete continuation without replaying grants. `@wildshard/game/shardfile/encounters` validates ordered phases and actor/panel references; `@wildshard/game/shard/declaredEncounters` binds an already mounted SF7f panel. Encounter-owned spawns use a null ordinary brain, while `buildPlatformSpawns` accepts a catalogue variant resolver. See [PLATFORM-AI.md](PLATFORM-AI.md) for thresholds, persistence ports, restore and presentation.

### Ground boss encounter host (G474 / G475 / G477)

`@wildshard/format/bossEncounter` admits encounter identity, phases, arena and
presence bands, strike bindings, presentation actions, rewards and ordered save
aliases. `bossEncounterPresentation` admits the reward card and music rows.
`NativeBossBindingSchema` admits concrete population/inventory service ids and
a weak-point joint/offset. Unknown keys and callback bags are rejected.

`@wildshard/game/boss/native` takes the existing `SimHost`, encounter/profile
rows, a species program and native binding rows. It resolves the population by
its installed step id, the existing admitted decision authority and the retained
actor's `NativeCreaturePose`. No shard callback, subclass or reflection binding
is accepted. The host adopts the reserved body once, spawns later lives through
that population, owns phases, arena effects, telegraphs, damage and reward
lifetime, and preserves the original fixed-step and continuation order.
Reward grant rows resolve the existing `NativeInventory` by world and pack id;
the pack's own item/count admission remains authoritative. Native inventories
may register their concrete world/id in their constructor. They retain their
existing snapshot owner and do not create another save adapter.

`@wildshard/game/boss/wake` is a closed value machine. Its constructor takes rows
and an arena center. `update` observes plain player/body/flag data;
`takeEffects` returns bar and attempt-outcome rows once. `wake` and
`onPlayerDeath` take observations/positions, never hooks. Restoration is silent.
`@wildshard/game/boss/presentation` is client-only: `presentWakeBoss` applies
effect rows to the existing `BossBar` and `Events`, without renderer hooks.
`@wildshard/game/boss/nativeWake` resolves the existing body's declared kind on
its actual `SimHost`; materialization stays with the existing AS director and
roster command. It binds death flags, attempts and the exact save envelope.

`@wildshard/game/boss/lane` exposes the existing `Lane`, `LaneBody` and
`LaneState` to counted client adapters. `Lane` takes a strike spec and reach
callback, and its body-clock `update` takes a damage callback; this compatibility
API remains callback scaffolding (HOST-BAR 5/6), without new platform credit.
`snapshot`/`restore` retain the strike clock and authored tell duration; a client
adapter owns its decal and preserves the pre-transition drawing frame.

Private `game/boss/roaming` and `game/boss/continuation` keep the seeded streams
and ordered wire aliases. They are not shard extension APIs. The older callback-driven
`game/shardfile/phasedBossRoaming` and `game/plugin/bossPhase` remain migration
scaffolding and receive no new approved-feature credit in this slice. The
counted client rig/effect and lane bindings remain with their shard.

`test/boss-fight-platform.test.ts` drives invented Salt Marsh/Reed Titan rows,
including phase presentation, arena leave/return, one-shot victory and silent
mid-fight native restoration. Native encounter scenarios and strict shipping
replays cover both real fights, damage ranges and save continuation.

### Author dev client (SF8c)

`buildProject` in `@wildshard/sdk/project` accepts an optional third argument choosing the compiled client or a product-only build. `wildshard dev` rebuilds admitted static products and reloads the normal client, using a separate compiled author mode. `__DEVSERVER__` is false in production/native modes; the production artifact checker refuses an enabled flag. See [SDK-DEV.md](SDK-DEV.md) for commands, cleanup and build-mode checks.

### Declared simulation composition and author validation (SF8c)

`@wildshard/game/plugin/simulation` composes admitted terrain, prop colliders, stable actor identities, trusted item handles, numeric scripts, published-state targets, quests, brains and encounters. `createShardfileSim` owns a standalone world by default; its typed ports can borrow the normal client's physics/player/fixed-step driver and existing collider/water ports. `bindShardfileSim` reinstalls matching snapshot adapters without collider allocation or stepping in restore mode. Borrowed snapshots belong to the existing world owner. `@wildshard/engine/physics/edgeEntries` walks overlapping capsule paths across each real entry; `@wildshard/engine/physics/rapier` loads the distributed physics binary without browser globals. See [SDK-DEV.md](SDK-DEV.md) for native validation and the authoritative target update.

### Content-addressed disk cache (SF18c)

`@wildshard/engine/boot/contentCache` exposes `ContentCache` with injected storage, SHA-256 and quota ports. Immutable addresses are shared across content sources; reads verify hashes and offline misses never fetch. Read-age index updates coalesce through a scoped two-second window; `flush()` forces pending metadata on pagehide. A durable LRU index, active-content leases, bounded entry/byte counts and quota eviction/retry keep disk growth bounded. Service-worker activation preserves this independently versioned cache and visited product manifests. See [CONTENT-CACHE.md](CONTENT-CACHE.md) for limits, ownership and recovery.

### Seamless grid crossing (SF20a)

Grid road construction uses one ordered builder for synchronous callers and the sliced
`GridSession.create` path. Internal `roadCull.ts` step generators yield during exact
byte planning, triangle clipping, attribute copies and bin/LOD sorting. The internal
`installPlatformRoadSliced` runner offers a paint after its 12 ms cooperative budget;
one batch can exceed that budget, so it is not a hard task-time guarantee.
`allocateRenderSteps` admits each exact byte plan before advancing its builder and
releases resources before its claim on failure or cancellation. Only completed culled
meshes and plans enter the scene. The final attributes, indices, LODs, materials and
collision ownership are unchanged.

`@wildshard/game/grid/crossing` stages destination admission ahead of the fixed step, then commits a rollback-safe frame change only after local and residency checkpoints succeed. `installGridCrossing` connects the signed assembly and residency driver without another simulation, player or navigation service. Local equipment is stowed at the cell edge before the strip re-frame; superseded and failed admissions retain the current frame. `GridCrossing.timings()` copies the last 32 committed checkpoint/frame-change/changed-callback intervals. The grid readout publishes them as `crossingTiming`; trusted retained-service activation has its own `runtimeTiming` `activate` row. Both use the diagnostic performance clock. Each committed crossing also records `requestedAt` (the fixed-step demand) and `readyAt` (completed admission): `readyAt - requestedAt` exposes an entry wait separately from the synchronous `end - start`. A short commit alone never proves a ready-before-entry crossing.

`@wildshard/game/grid/wallet` binds the existing inventory and purse keys and item continuation to a stable instance. Coins and shard items stay local, while catalogue equipment, titles and achievements remain in the profile ledger. Border stow cancels charged and queued attacks, retains selection and fuel, and restores prior pause/dialogue visibility on return. Fresh-document item restoration rebases the continuation clock. Select a shard and explore continue through `travel/travel`; first-party grid and standalone saves use the same instance identity.

### Scoped level installation

`@wildshard/engine/level/installation` provides `createLevelInstallation(app, scope, adapters, progress)`. It constructs the same scope-bound context used by `LevelLoader`, without starting another load or changing the active level. `openKit()` and `closeKit()` delimit the row-registration window. The caller owns the supplied scope and disposes it to remove its systems, events, content rows, scene root and adapter contributions. `context.inputContext(definition, owner?)` defaults to that scope; an explicit live descendant owns the adapter inverse, letting an entered scope retire input before its resident world. Unrelated or disposed owners are refused.

### Allocation memory diagnostics (SF64)

`@wildshard/engine/core/memoryAttribution` defines `MemoryAttribution`, the shared `memoryAttribution` ledger and scalar
`MemorySnapshot` v1. Native GPU handles are counted by allocation storage (compressed blocks, faces, mip levels, array
layers, buffers and multisample targets), using the existing upload labels and scene owners. Subuploads add no bytes.
CPU rows count shared array backing stores once, decoded PCM and Wasm linear capacity; image/canvas RGBA backing is
explicitly estimated. Weak references and finalization never retain retired content; disposal/context loss removes GPU
storage and resize/growth updates the original identity. Unknown labels remain an explicit unattributed part of totals.

The live probe's `memory()` returns only scalars, even after level retirement. `snapshot()` keeps allocation totals,
allocator `accountedBytes`, and optional provenance-bearing native `measured` (WebContent plus labelled GPU) SEPARATE.
Capacity is not dirty resident RAM: never add the RAM census to WebContent or call its difference physical attribution.
`measurement()` accepts a native ruler receipt; absent readings stay null. `bindAccounting()` borrows the existing
allocator reader and returns an exact detach; it creates no admission claims.

The existing Developer MEMORY budget chip consumes this same scalar ledger when expanded: GPU and RAM storage by owner or asset, sortable rows of at least 1 MB and an explicit smaller-row remainder. Its accounted PLAYING / LOAD lines remain the admission model; the provenance-bearing native WC + labelled GPU ruler is shown separately, or NOT SAMPLED. No additional Developer tool or panel is installed.

### Regional texture admission

`@wildshard/engine/level/frame.LevelFrameOptions.textures` accepts the structural `enter()` port of a retained texture policy. The frame enters that same policy for each resident callback and leaves it afterward. Game regional admission resolves `TexturePolicyBinding` once before reserving the runtime: an accepted compressed path uses its primary measured claim, while an image fallback uses `runtime.cost.imagesFirst` when declared. Construction and entered frames reuse the resolved policy; the capability probe and total-memory caps remain unchanged. Measurements keep their source revision and evidence.

### Matched runtime residency (G258)

`runtimeAccountedBytes` subtracts an optional reviewed `residentBaseMB`, the matched settled pre-entry road resident set,
instead of the dated `engineBaseMB`. The platform, composer and highway included in that baseline retain their independent
claims. A regional runtime marks its own `sim:<instance>` lease as measured only after its exact source/manifest measurement
and bytes have been admitted. Its sky keeps an exact visible `sim-sky:<instance>` page claim covered by that same live parent;
it receives no engine-base credit, and becomes independently charged if the parent retires first. Estimated runtime rows and
other instances cannot cover it. The claim uses the largest paired worst-entered-pose increment across three cold runs.


### Attached sky preparation (SF22)

`BackdropLayer.prepare(renderer, camera, target)` prepares its attached dome and
followers against the page's real lighting and the world's real render target
on WebKit, before the grid exposes the layer. It borrows existing materials,
keeps live parents, visibility, uniforms and blending unchanged, and fences
every painted slice to the layer owner. Chromium retains its ordinary
whole-world preparation. `sceneJobs(scene, target, per, roots)` can restrict the
material inventory to explicit roots without replacing the target scene's
lighting, fog or environment; omitted roots keep the whole-scene inventory.

`Game.warmSkyLayer(layer)` calls the attached layer's preparation only after the
composer exists, using its actual input target. During early boot it leaves
preparation to the ordinary shader / first-frame stages, preserving the
attached sky's environment and ownership without reading `Game.composer` early.

`prepareSceneRoots(renderer, camera, scene, target, roots, current)` uses the
ordinary sliced compile/link/upload path for newly resident roots against both
the current page and its declared exterior lighting. It borrows the real
materials, leaves the live scene untouched, and fences work to the resident
owner. `Game.warmSceneRoots(roots, current)` supplies the real composer target
on every browser; early boot retains ordinary whole-world preparation.
The grid's optional `prepareFar(view)` port prepares a hidden, already-admitted
proxy during fetch. Its upload exposes the same mesh and material; cancellation
or failure disposes the staged view with its existing ring lease.

The grid's initial admitted-edge stage also awaits each declared module through
`manifestRuntimeEntry` and `prepareTrustedRuntime`, while the product lease is
held and the loading panel is still up. This evaluates the registered module
without constructing its runtime or running hooks. Later regional admission
uses the same adapter and ordinary module cache. A preload failure is logged;
normal admission retains its validation, refusal and retry authority.

The grid residency ledger indexes category totals, covered children and eligible
eviction candidates. `coverageRemaining(parent, replacing?)` reads a sim claim's
remaining coverage without materialising the sorted diagnostic table; `null`
means no live sim. Removing a parent exposes retained children immediately.
Admission still applies the same cost model, warning/refusal policy and
farthest-first, id-tied two-phase eviction transaction.

`Game.preparePostPass(pass)` serializes additions to a live compound display
shader. It links a temporary material while the original keeps drawing, then
publishes the prepared sources onto that same original material and acquires
its cached program before retiring the temporary holder. Entry readiness awaits
the preparation; failure or a concurrent recompile never publishes stale sources.
The readback shader used by streamed texture samplers is retained by a single
private white texel per preparation owner, released with that owner. Far haze
bands are patched and prepared while hidden alongside their far view.

The grid's `prepareTile(tile)` port prepares newly decoded neighbour terrain and
props before the ring publishes them. Horizon shader patches run first. The
detached tile keeps its original mesh/material identities and residency lease;
preparation failure or retirement disposes only its own scope. Current and
declared exterior lighting variants use the same sliced compile/link/upload
path, so a streamed neighbour does not first compile during its visible upload.

During live preparation, the borrowed material's renderer property selection and
uniform bindings return to its last actual draw before yielding. The expanded
program cache remains, and the issued variant resolves through the existing
parallel-link queue. A future lighting job cannot leave an unfinished program
selected for an already-visible mesh; new, unrendered materials keep normal
preparation. Scope retirement and compile failures retain the same fence.


`ViewmodelRoot.stage(owner)` routes only that owner's newly added models into
an initially hidden identity-transform group under the existing camera pass.
Other owners retain normal mounting; geometry, material identity, authored
visibility and the shared depth-clear order stay unchanged. The owner removes
the group without disposing its models, whose equipment/resource owners keep
cleanup. `Game.stageViewmodels(owner)` enables this on every browser with a
live composer (otherwise returns `null`; sp-o6 extended it from WebKit, since
an unstaged weapon drew on the live camera mid-construction and uploaded its
textures inside a travel frame). Regional preparation keeps the group
hidden through ordinary whole-world shader warm-up, exposing it only during
entry and hiding it again on leave.


## Trusted game plugin imports (SF78 / G307)

`@wildshard/game` publishes its plugin modules in `src/game/package.json`'s
`exports` map. That map is the public surface; there is no second runtime SDK,
wrapper layer or separate module allowlist. Trusted shard `runtime/` files import
the defining game module directly. Type imports follow the same boundary.
`data/` and `generators/` use the authoring SDK and build-time commons, never game
runtime modules. Frozen registered legacy copies retain their compatibility inputs.

The current migration inventory is reproducible with `node scripts/game-plugins.mjs`:
it follows primary shards' runtime closures to their SDK facade imports and lists
those facades' defining game targets alongside direct game consumers. Context and
plugin installation use `plugin/context` and `plugin/context`; brain policies
use `plugin/brain`; weapon bindings use `plugin/headless` and
`plugin/weaponFamily`; boss phases use `plugin/bossPhase`. These existing modules are exported directly, not rebound.
The inventory is evidence of current reachability, not permission to keep one-user
systems in the game: SF76 deletes their facades and moves their implementations home.

`node scripts/game-plugins.mjs --report` runs `wildshard/shard-game-plugins` in
report-only mode during SF76. It flags imports outside `runtime/`, unpublished
modules, relative bypasses, and computed game module names. Existing layer,
public-index and sandbox checks remain active. Promote this rule to `error` in the
root config after the move-backs; its tests already exercise enforcement.

The defining plugin modules also own shared geometry packing (`plugin/geometry`), model and atlas registries (`plugin/geometry`), quest rows (`plugin/quests`), native prompt selection (`quest/interactionRows`), weapon hook admission (`plugin/weaponFamily`), collision pose and clip metadata (`plugin/animation`), and starter effect installation (`plugin/ui`). Their implementations live in these modules; consumers do not pass through forwarding facades. Frozen compatibility keys remain until their registered consumers retire.

The admitted product API is defined by `plugin/product`: bounded byte parsers, dependency preflight, terrain validation, saved-state lineage, build verdicts, report cards and memory admission. Existing defining hosts own their associated laws: `plugin/brain` resolves numeric species/strike rows; `plugin/director` owns the isolated director lane; `plugin/mover` proves terrain entries and lift approaches; `plugin/context` resolves trusted runtime constructors and maps admitted catalogue data. These imports install no service.

## Trusted plugin definitions (SF79 DS0.2)

### Shared arm clips and starter bow (game content)

The 16 arm aliases and two swim aliases Driftwood and Nine share are authored once in
`game/systems/viewmodel/armAliases.json`; `scripts/gen-starter-arm-clips.mjs` expands the same
bytes into an ignored literal table before rig producers run and during ordinary boot-table
generation. The game `armClips` path keeps the same names, key order and `armClipNames` behavior.
The bow parameters Nalati and Pine share are authored in `game/weapons/starterBow.json` and
expanded the same way by `scripts/gen-starter-weapons.mjs`; the starter profile keeps its mutable
`wind` field and injected view strategies. Both were commons packs until G355 (a commons pack
needs two real shard users of the pack itself; these shards read the game tables, not the pack).

`@wildshard/game/plugin/context` defines `ShardContext` and `shardContext`;
`@wildshard/game/plugin/context` defines the staged `ShardPlugin` base class. Its `standaloneHybridEntry(Native, admit, shardfile, name)` defines the shared standalone lifecycle used by Nine and Sky: choose one composite in the world stage, await admission, then forward kit/play to that same owner. Shards retain their own admitted source, bindings, native constructor and entry choice; optional constructor ports keep existing test/host injection. Calling the factory or importing it installs no service.
Internal game consumers import these defining modules relatively. The frozen
`./shard/context` and `./shard/plugin` export keys point to those distinct modules,
preserving the exact constructor identity without collapsing distinct frozen imports. They retire with the old consumers; no duplicate class or service
registry exists. DS0.2 admits at most twenty defining `./plugin/*` modules beyond compatibility exports.
`node scripts/game-plugins.mjs --check` enforces this in the push gate and CI checks.
Compatibility is derived from actual literal imports in files registered by `lint/legacy-shards.json`;
there is no hand-maintained export allow list. When the last registered importer disappears,
the old export fails until removed. Unregistered files in a legacy-named folder grant nothing.
Missing definitions and unresolved consumers also fail.

Four named temporary exceptions remain: `./shardfile/schema` and `./shardfile/validate` (DS1.1),
and `./shardfile/splatTerrain` and `./systems/looks/surfaceLooks` (DS1.4). The audit reports their
owners, reasons and exact target paths separately; these are migration tails, not extra plugin slots.
`node scripts/game-plugins.mjs` retains the raw total and every exact consumer for inspection.


### Authoring boundary checks (SF79 DS0.3)

`generator-imports` restricts shard `generators/`, `data/`, `quests/` and
`shard.config.ts` to three.js, the authoring SDK, commons and their own shard
files. Module paths must be literal. `shard-engine-imports` records every direct
primary-shard engine import, including relative paths and type imports.
`sdk-no-facade` refuses public value/type aliases of game or engine bindings;
the SDK defines authoring implementations rather than another runtime interface.
Renamed and nested destructuring, namespace aliases and TypeScript `import = require`
bindings retain that provenance; changing export syntax cannot hide a runtime facade.
`shard-game-plugins` allows game imports only from `runtime/`, through published
`@wildshard/game/plugin/*` definitions. Exact sealed legacy source paths remain
exempt. Static, dynamic, require and type-import syntax are checked.

These four rules are report-only in the root config during the move-backs and
measured in `.oxlintrc.ratchet.json` for shrink-only debt. The serialized pusher
seeds the generated ratchet from its clean tree; builders do not edit counts.
`node scripts/game-plugins.mjs --report --json` exposes the current diagnostics.
Root enforcement follows consumer migration; existing layer and sandbox guards
remain active throughout.


### Existing runtime definitions under plugin modules

The following modules contain the existing implementations; there is no facade
or parallel registration service. Their old export keys temporarily point to the
same files while runtime consumers and sealed legacy copies migrate.

| Public definition | Existing API |
|---|---|
| `plugin/context` | `ShardContext`, `shardContext` |
| `plugin/context` | staged `ShardPlugin` constructor |
| `plugin/lifecycle` | retained context and entered-service/input lifetime hooks |
| `plugin/headless` | runtime row bindings for quests, items, ledger, state and spawns |

`projectRuntimeFacts(emit, progress)` in `@wildshard/game/plugin/headless` projects an already bound runtime ledger into its caller-owned Progress view. The original ledger owns grants, writes and pending retries; its exact achievement/flush ports are retained. Emission refreshes the view once after the receipt, including duplicates; an undeclared fact throws before refresh. An absent view adds no presentation. Nine and Signal use this same binding.
| `plugin/brain` | `SpeciesBrains` and the shared home/brain installers |
| `plugin/bossPhase` | declared boss phase runtime and trusted observations |
| `plugin/mover` | `MoverRuntime` and declared mover host installation |
| `plugin/director` | `DirectorInstallation`, `installDeclaredDirector` |
| `plugin/ui` | entered quest and input presentation |
| `plugin/clientScript` | `ClientScriptViews` over detached script frames |
| `plugin/shaderFamily` | shared `ShaderFamily`, uniform rows and blending presets |

All internal game callers use relative imports. Source relocation preserves
implementations, constructor identity and installed behaviour; plugin paths do
not introduce new gameplay APIs. Weapon-family, mode, audio and raw-look surfaces
still need consolidation. The final ≤20 export gate remains open until old
schema/app and runtime consumers can retire their aliases.


`plugin/audio` defines the existing `CombatAudio`, `sharedCombatCues`,
`WeaponSynth`, `sharedWeaponVoices` and `declaredWeaponVoices` in one module.
Their mixer operations, sampled/synth routes, RNG order and cue IDs are unchanged.
The two former audio export keys point at this same implementation while callers
migrate; internal audio recipes import its types relatively.

### Native behaviour author builds (SF79 DS0.4)

`@wildshard/sdk/buildBehaviour` defines `BehaviourBuildSchema`, `compileBehaviourModule(source, maximumPages)` and `buildBehaviourProject(project)`. A project may retain `behaviour/build.json` with source `.as` files, maximum pages, an immutable asset directory, JSON module bindings and optional embedded outputs for its trusted native plugin. `wildshard build <project>` generates these declared outputs before compiling the project; `wildshard build <project> --behaviour-only` regenerates just the modules; append `--check` to regenerate in memory and compare every declared output without writes. `bake-check --node-only --only=directors` checks all three native consumers. Every read and write stays inside the project. All modules compile before writes begin. There is no shard-name dispatch, runtime installation, or implicit source discovery. Driftwood, Nalati and Pine use the same retained compiler declaration; their Wasm and embedded bytes stay identical. Historical embedded notices remain unchanged for byte identity; the build descriptor and CLI are the current regeneration authority.

### Node scene authoring core (DS1.3)

`@wildshard/sdk/bake` compiles an authored scene with `bake(scene, identity)`.
Wrap a static mesh in `new WholeShape(name, mesh)` to keep its original
geometry in one owning L0 tile. Parent and child transforms are retained;
the mesh is emitted once through the whole-prop path and is never also
merged or decimated. Its optional third argument accepts `customAttributes`
and `nativeAttributes`, as `props.whole` does.

The SDK authors ordinary three.js objects in Node. `@wildshard/sdk/scene` defines
`readScene(root)` and its JSON-only `SceneDescription`: local graph matrices,
geometry channels/index/groups/draw ranges, shared material references, instance
matrices/colors, LOD links, ordinary lights and fog. Unique object names remain
graph IDs; repeated display names get deterministic traversal IDs. A subtree's
root includes its actual world transform. No UUID, rendering context or game
service enters the description. The SDK library keeps `three` external so its
Object3D subclasses and the caller share the same installed constructors.

`@wildshard/sdk/physics` defines Object3D subclasses `BoxCollider(width, height,
depth, surface?)`, `CapsuleCollider(radius, length, surface?)`,
`HullCollider(geometry, surface?)` and `MeshCollider(geometry, surface?)`. Box
dimensions are full extents; capsule length excludes its caps. Named collider
objects emit `ColliderData` from their actual world transforms. Boxes accept
positive nonuniform scale; capsules require uniform scale. Shear, reflection,
collapsed axes and nonfinite values refuse. Geometry channels retain their order.
`BoxCollider.fromData(row)` adopts an existing authored box while retaining its
optional yaw/quaternion encoding for byte-stable migrations. `clone`/`copy` keep
the subclass's dimensions, surface and shared geometry references.

`@wildshard/sdk/spawns` defines `PlayerStart` and `Spawn(kind)` as Object3D
subclasses. Starts are unique; actor spawns need unique names and keep traversal
order. They require upright unscaled placement. `@wildshard/sdk/entries` defines
`Entry(edge, kind?)`; `Entry.midpoints()` returns north/east/south/west objects.
Their exact 8 m road-height openings cannot be moved, rotated, scaled or sheared.
They declare an opening, never supply ground or create platform socket floors.

This initial reader handles the static PBR/toon pilot. Raw shader materials and
material callbacks refuse. Textures, physical-material extensions, morph targets
and skinned objects require their dedicated compilers; unsupported features
never disappear silently. The description is a build intermediate, not a new
shardfile schema key. Template 1 and Pastel Plain's actual authoring geometry and
box rows pass through the reader and rebuild to identical compiled rows and GLB
hashes. Existing authoring stair rows remain stairs, with no ramp approximation.
The page-bound physics producers still need their G320 authoring-only conversion.

### Materials and light rows (DS1.4)

`@wildshard/sdk/materials` defines the authoring materials a generator puts on its
three.js meshes. Each is an ordinary three.js material (a generator previews in
any three.js renderer) that also knows its shardfile catalogue entry,
`toMaterialEntry()`; `readScene` writes that entry into `SceneMaterial.entry`
and `restoreSceneGraph` rebuilds the same class from it. No material becomes
shader code (G306).

- `ToonMaterial extends MeshToonMaterial` (`color`, `vertexColors`, `faceted`,
  `doubleSided`, `roughness`, `metalness`): the `toon` family entry, or with
  `graphPreset: true` the `{ family: 'graph', preset, version: 1 }` reference.
  Setting `bands` (an integer 2–8) or `rim` (0–2) bakes a cel graph instead: the
  sun in N hard steps over the albedo and a sun-coloured rim on the lit side.
- `PainterlyMaterial extends MeshStandardMaterial` (`rim`, `bands`, `shade`,
  `floor`, `sway`, `emissive`, `alphaCutoff`): the `painterly` family entry or its
  graph preset. A mapped or painted-terrain surface still needs its texture
  declarations and is refused on restore.
- `GraphMaterial extends MeshStandardMaterial`: holds one validated material
  graph (`GraphIr`, or a `GraphSpec` it compiles) and bakes to
  `{ family: 'graph', graph }`.
- `graph(spec)` compiles TSL node trees (`three/tsl`) placed in the graph stages
  (`vertex`, `surface`, `lighting`, `outline`, `post`) into SF59 graph IR
  (`@wildshard/format/materialGraph`), validated under the author caps. Shared
  subtrees become one node, `.toVar('name')` names a node (otherwise `n0`, `n1`
  …), TSL constants become inline literals, and `clamp(x, 0, 1)` is `saturate`.
  TSL operators and math map one to one onto the version 1 vocabulary; the TSL
  built-ins `positionLocal`, `positionGeometry`, `positionWorld`, `normalLocal`,
  `normalWorld` (and `normalWorldGeometry`), `normalView`,
  `positionViewDirection` (`viewDirection`), `cameraPosition`, `time`,
  `screenUV` and `uv()` are graph inputs as they are. `param(name, def)` declares
  a typed param (the format's `GraphParam`, with its range and optional day /
  state binding); `sample(param, uv)` reads a texture param; `noise`,
  `viewToWorld`, `worldToLocal`, `sceneColourAt`, `sceneDepth`, `sceneNormal` and
  `graphInputs` (`sunDirection`, `sunColour`, `sunShadow`, `albedo`,
  `irradiance`, `litColour`, `instanceHash`, `objectOrigin`, `vertexColour`,
  `vertexColourAlpha` (1 where colour is RGB or absent), `materialColour` and
  `materialEmissive` (the material's own colour and emissive × intensity, read
  live: the per-animal tint and hit-flash ports a creature's runtime drives),
  `sceneColour`) are the graph-only inputs. Anything else (`uniform()`, a `Fn`,
  `sqrt`, a node-valued conversion, `loop`) is refused with its name.
- The vocabulary for a trusted shard's own programs (SF51-p, Nine Dragon's GLSL):
  - `atan(y, x)` and `mod(a, b)` are graph ops, GLSL's two-argument `atan` and
    `a − b·floor(a / b)`.
  - `varying(node)` is the `varying` op: its input is typed and costed in the
    vertex program and interpolated to the fragment, so a vertex-only input
    (`positionGeometry`) reaches the surface through it. It runs in fragment places
    only.
  - `attribute('aSeed', 'float')` is the `attribute` op (`name`, `type`): a
    geometry attribute named `a` plus a capital (never one of three's own),
    typed float to vec4. It is a mesh-place op and is refused in a post graph.
  - `screenCoordinate` is the `fragCoord` input: the pixel's window coordinate,
    from the top left as three's node back-end gives it. It is a mesh-fragment
    input; a full-screen pass uses `screenUV`.
  - `surface.discard` is a bool: the fragment is dropped where it is true (three's
    `maskNode`), for an ordered dither or a clip.
  - A **code-fed uniform** (`uCam`, `uRootAt`, `uFogScale`, a look clock) is a
    `param()` with no `bind`: the trusted runtime moves it with
    `CompiledGraph.setParam` each frame.

  `test/sdk-graph-vocabulary.test.ts` proves these on real Nine programs:
  - the portal disc, node for node against its hand transcription of `FS_DISC`;
  - the disc, the jian heat halo (`aSide` through a varying) and the
    `bayer4` dither discard, evaluated on the CPU against line-by-line
    transcriptions of the shipped GLSL;
  - the GLSL that three's node back-end emits for each.

  Nine is not switched over: a graph look compiles only while the
  `graphMaterials` row is on (E435).

Ink & Cel Valley and Pastel Plain author their looks this way
(`generators/materials.ts`): `test/sdk-materials-parity.test.ts` holds the
ground presets identical and the TSL rocks equal, node for node, to the shipped
`data/rock.graph.json` graphs.

`@wildshard/format/lights` defines light rows: `PointLightRowSchema`,
`SpotLightRowSchema`, `LightRowsSchema` (at most `LIGHT_ROWS_MAX` = 64, unique
ids) and `parseLightRows`. `readScene` writes every `PointLight` and `SpotLight`
as a row in `SceneDescription.lights` (graph order, world `position`, linear
`colour`, three.js `intensity`, `distance`, `decay`; a spot adds its world
`target`, `angle` and `penumbra`); the field is absent when no local light is
placed. Directional, hemisphere and ambient lights stay look rows. The rows are
a build intermediate: no shardfile key or renderer consumes them yet.

`@wildshard/game/plugin/shaderFamily` publishes the shared shader-family implementation
used by multiple shards. It resolves directly to `systems/looks/shaderFamily.ts`;
the historical export and defining file remain intact for frozen consumers.
Trusted `runtime/` consumers use the plugin key; no facade or duplicate implementation is installed.

### Format boundary (G313)

`@wildshard/format` is the dependency-free shardfile contract layer. Its explicit
package exports name defining schema modules; there is no barrel. The layer and
public-index guards recognise it between engine and game. Format imports only
`valibot` and its own modules; game and the authoring SDK may import its published
modules. Engine cannot import it, and private schema paths remain refused.

### Report-only conversion content gate (SF77 / G304)

`node scripts/shard-platform.mjs --json` reports each emitted product’s content gate
separately from its source ratio and gameplay witnesses. `candidate` requires L0
render tiles, declared asset files and actual world collider shapes, with no trusted
simulation/native-ground owner or private binary payloads. Missing or malformed
products are `unavailable`; missing structural evidence is `incomplete`, with reasons.
This is structural evidence, not parity or asset admission, and adds no hard failure.
Templates do not make a one-user system public; AssemblyScript remains its own uncapped column.

### Inspectable scene synth (DS1.2)

`wildshard synth <project>` compiles `shard.config.ts` in Node and reads its named
`scene` (a real three.js Object3D) and `identity.slug` exports. These author-only
exports are transitional alongside the existing default shardfile declaration;
missing scenes refuse. The command writes canonical JSON to
`.wildshard/cache/<slug>/scene.json` and retains an immutable copy under its
SHA256 directory. `@wildshard/sdk/synth` defines `synthProject(project)` and
`synthScene(scene, project, slug)`; each returns the description, digest and path.
The latter also accepts an already generated graph, including Template 1's
retained generator. Geometry, material and node traversal use the DS1.3 reader;
its explicit unsupported-feature refusals still apply. Synth supplies compiler
input, not a finished shardfile or an entry proof. It adds no schema field.

Graph generation executes during synth; expensive bake jobs remain owned by the
shared generation-job cache. Immutable scene copies are verified before reuse;
corrupt bytes refuse. Sources and cache paths cannot escape through symlinks;
project imports must live in authoring folders. Game/engine and SDK runtime
imports refuse. Scene JSON never ships or enters git. Two independently generated
Template 1 graphs produce identical bytes; the CLI also works with a pure Node
three.js author project without drawing a frame.

### Format contracts (DS1.1 foundation)

`@wildshard/format/edgeProfiles` defines the unchanged Valibot boundary contract: 256 or 257 finite height/colour samples and zero road height. The format workspace imports only Valibot; the loader imports its defining schema directly. The SDK package declaration copier and author-input audit include this layer. This first extraction does not complete the full shardfile contract migration or JSON Schema generation.

The scoped input/knob/Debug wire contract is now defined by `@wildshard/format/plumbing`: both loader admission and SDK author validation consume it. Namespace ownership, duplicate IDs, touch-action references and Debug defaults retain their existing checks. `@wildshard/sdk/plumbing` is author-time Valibot parsing; it no longer calls a game module.

**Declared controls and quality (G486).** `combat/items.contexts[].extra`
adds action/key rows, blocks, relabels, two existing touch verbs,
`hiddenWhen` and binding descriptions to a weapon's baseline context.
`sim/plumbing.input` shares these rows, with optional scene actions and a
closed AND `when` on player mode, held item and declared flag ids. The
session reads its existing owners and synchronizes input before
collection; author callbacks and property paths refuse. Plumbing knobs
accept finite numbers or booleans with matching tier kinds.
`@wildshard/game/shard/declaredPlumbing#plumbingKnob` resolves an admitted
id/kind before world construction; plain namespaced tier overrides may
replace only declared values. `state/migrations.equipmentSlots` renames
old worn-slot keys before the existing cosmetics save filters them;
canonical keys win and repeated loads are idempotent. Sky's fan controls
and meadow count, Pine's seven original tier values, Nine's paint/decal
values, Signal's saved whip alias, the templates and a fictional harbour
fixture exercise these paths. Pine's phone GRID override stays 52.5;
alternate-tier builds isolate and restore namespaced overrides. See [DECLARED-CONTROLS.md](DECLARED-CONTROLS.md).

Game `./plugin/mover` defines the admitted static approach data used by native lift proofs; it does not install a service.

### Generated format JSON Schema (DS1.1)

`pnpm gen` writes `.wildshard/format/edge-profiles.schema.json` and
`plumbing.schema.json` through `@wildshard/sdk/formatJsonSchema` and the pinned
`@valibot/to-json-schema` converter. These ignored build outputs carry DO-NOT-EDIT
provenance. Only the migrated `@wildshard/format` roots are included; the mixed
whole-shard contract still awaits extraction. No game or renderer is imported.

The draft-2020-12 edge document expresses matching 256/257 sample counts with
exact array-length branches. Plumbing names its remaining namespace, uniqueness,
reference and default checks in `x-wildshard-checks`; tools must also run
`@wildshard/format/plumbing#plumbingRules`. Annotated string bounds use Valibot
UTF-16 code units, while standard JSON Schema counts Unicode code points. The
defining Valibot parser remains authoritative for admission. Unknown custom
validators, additional checks and transformations refuse generation; familiar
messages cannot grant an override. The bridge identifies the actual defining
schema objects. Regenerate with `node --import ./scripts/bake-loader.mjs
scripts/gen-format-schema.mjs`; generated bytes are compared by the focused test.

### Internal game modules and export pruning (SF79 DS0.2)

A game module needs a package export only when an outside consumer imports it.
The grid, admission and composition code inside game use relative defining-module
imports. Removing an unused public key keeps its implementation and internal
callers intact. Exact registered frozen legacy imports keep their existing keys;
they are listed separately by `node scripts/game-plugins.mjs`. Compatibility keys
remain visible in the total until the coordinator resolves the final surface.

DS1.1: `@wildshard/format/{admissionLimits,version,state,preflight,json,commonsCosts}` now defines the renderer-neutral admission contracts. The author and loader use the same bounded plain-JSON, typed defaults, numeric state capacity and exact commons-cost checks. These modules import only Valibot and one another; parsing does not read assets or install a service.

DS1.1: the pure creature/brain, audio, ledger, director, migration, traversal, runtime declaration and sampled skin contracts now live in defining `@wildshard/format` modules. Their Valibot bounds, semantic checks and pure continuation transformations move verbatim; native hosts and renderer adapters remain in game. Public format schemas join the SF45 generated reference inventory automatically.

DS1.1: presentation metadata, exact mesh-collision declarations, script bindings/fields and named hooks are defined in `@wildshard/format`. Image URL resolution, native mesh-byte validation and script-host installation remain in game; all bounds and reference verdicts are unchanged.

DS1.1: terrain tile addressing, bounded water declarations and the immutable accent palette are defined in `@wildshard/format`. Game retains byte validation, fresh water motor bodies and HUD CSS mapping unchanged. Authors and loader consume the same defining Valibot contracts.

DS1.1: the pure row contracts a shard's `data/` declares for looks and maps are defined in `@wildshard/format`: `surfaceLooks` (the surface look rows `applySurfaceLooks` installs; the GLSL stays in game), `minimap` (`MapPoi`, a named place; `@wildshard/engine/ui/Minimap` keeps an alias for frozen legacy folders) and `dayCycle` (`DayClockPhase`, `DayClockSegment` and `DayClockRow`, the plain-data part of the engine's `DayCycleSpec`, which extends it with sun paths, look keys and curves). Engine and game import them from format; no behaviour moved.

DS1.1: item/loadout declarations, target binding references and quest/dialogue graphs are defined in `@wildshard/format`. Game keeps item construction and collider activation unchanged. The frozen legacy quest type path infers its type from the single defining format schema.

DS1.1: numeric world rows, inert sketches, mover/entry declarations, native-ground references, HUD rows and client presentation bindings live in `@wildshard/format`. Engine runtime bounds remain independent; `test/format-wire-limits.test.ts` requires exact wire/runtime agreement. Native solver, terrain/GLB byte validation, draw and input ownership remain game/engine functions. Frozen legacy mover handles retain the original game path.

DS1.1: local checkpoint, lift rider, runtime measurements/declarations, skin rows and script-species/elite/weapon-hook declarations live in `@wildshard/format`. Native runtime admission, allocations, script hosts and playback remain in game. The wire calibration and weapon phase table are checked against the native owners; the skin clip narrowing is identity-only and grants no bridge to an unfamiliar author transform. Material and post graph contracts remain in game pending DS1.4.

DS1.1: `@wildshard/format/shardSections` defines root identity, requirements, budgets, simulation, author/server limits, file/tile inventories, library/critical roots, far proxy and spawn. Root composition retains every original default and native reference check. Material-dependent props/splats and look/post graphs remain in game for DS1.4. Native tile sizes and fixed wire cell bounds are equality-tested.

### Node authoring: retained rig and raster readers (DS1.3 / G320)

`@wildshard/sdk/bake/rig` defines `readRigRest(glb)`: a bounded, single-skin triangle GLB becomes real Three `BufferGeometry`, ordered world-space rest joints and embedded colour image bytes. Positions stay mesh-local; normalized channels become Float32 exactly as in Three's GLTF loader. Meshopt and embedded WebP extensions are supported. Multiple skins/primitives, absent indices or atlas, and malformed input refuse. No renderer, registry or game service is installed.

`@wildshard/sdk/bake/image` defines `readImagePixels(bytes, {flipY?})` and `writeImagePixels({width,height,pixels})`. The pinned Node decoder admits still PNG/JPEG/WebP up to 4096²; the writer emits lossless PNG with exact unpremultiplied RGBA, including transparent RGB. Source row order is preserved unless the caller asks to flip it. World texture baking uses this same reader.

Starter equipment rows (`SWORD`, `WOODEN_SWORD`, `IRON_SWORD`) and melee profiles
share the defining `game/weapons/starterMeleeProfile` module. Native simulations
import those rows without loading the view-bearing `plugin/weaponFamily` module.
The native director lane is defined by `plugin/director`; the retained
`shardfile/directorClient` module owns Debug selection and page installation.
Its page entry-choice service is not part of the native lane closure.

`plugin/context` defines page routing, recovery and early residency admission.
`plugin/ui` defines client-script pose/particle presentation alongside quest UI;
these modules retain their existing singleton and lifecycle identities.

SF25: `plugin/ui.createClientChannels(program)` evaluates the bounded
`format/clientChannels` numeric grammar over copied `{time, delta, values}`
observations. Its frozen visual frame publishes atomically and provides no
shared-state, player, physics or event write port. `sdk/clientChannels` defines
the author builder; SHARDFILE.md documents the executed example and limits.
Optional bounded private recurrence slots retain first-frame copied seeds and
finite next-node values atomically. They expose no storage or state setter;
programs without slots retain their original continuous-clock behaviour.
`createClientChannelView` binds declared transforms to private Object3D targets;
`moverChannelViews` projects a declared mover source onto those same visual
sinks without a new clock/body. Private value/turn outputs remain read-only.


DS1.3: the scene reader now includes `SkinnedMesh` bind mode/matrices, ordered joint references and inverse binds, typed skin channels, and standard `AnimationClip` / `KeyframeTrack` interpolation, times and values. Raw integer channels stay raw even when normalized or interleaved. Named targets and all rest joints must belong to the author graph; UUID-bound tracks, duplicate joints, malformed influences and custom interpolants refuse. Local TRS is retained alongside matrices so clips remain executable without a decomposition changing the rest pose.

`@wildshard/sdk/sceneGraph` defines `restoreSceneGraph(description)`: reconstruct the real three.js draw/animation hierarchy from persisted JSON, retaining shared geometry/materials, ordered skeletons, explicit LODs, instance data, lights and fog. Collider/spawn/entry sections remain data for their existing compilers, not simulated objects. SDK catalogue materials (DS1.4, `@wildshard/sdk/materials`) restore from their entries; texture and physical-material serialization remain open. Both shipping template geometry byte gates use this reader; an added animated rig in each pilot also regenerates identical sampled channels and skin GLB bytes.


DS1.3 audio authoring: `@wildshard/sdk/sceneAudio` defines `Cue(id, voice)`, `AmbienceZone(recipe)` and `Score(recipe)` as ordinary Object3D declarations. `Score.fromData(profile)` adopts cue/zone registration order; `toAudioData()` emits the defining format contract. `readScene` collects one profile and its graph declarations into optional `SceneDescription.audio`. These objects never create an AudioContext, decode or play a sound. Cues bind named events to catalogue voices; event owners supply moving sound positions. Zones move their centres and scale their circular radii through horizontal similarity transforms; tilt, shear, nonfinite or elliptic frames refuse. A zone requires its real mixer profile. Existing Template 1 and Pastel profiles emit identical bytes through persisted scene JSON.

`@wildshard/sdk/entries` also defines `Portal(edge, link)` and `SocketLift(edge, lift)` as Entry subclasses. Both occupy the existing exact road-height midpoint socket and emit its existing `portalLink` or `socketLift` entry row. Portal data retains the named road/arrival/exit floors, two directed links and walked static route. Lift data retains named mover/gate, road/top stops, approach colliders, onward route and ride ticks. Link coordinates remain cell-local, independent of the socket's Object3D transform; moving a socket still refuses. Constructors and emission use the single defining format schemas. Clone/copy keep independent mutable author rows; missing/malformed bindings refuse. No floor, mover, teleport, physics or native owner is invented. Both pilots retain identical original compiled geometry bytes, and their added entry fixtures preserve every independently admitted entry byte through JSON.


`@wildshard/sdk/audio` remains the pure data contract and parser: shard audio rows and native simulation never import three.js author objects through it. Scene audio objects are defined separately in `@wildshard/sdk/sceneAudio`.


SF81 DIR-1: `@wildshard/sdk/director` defines `new Director({ id, inputs, stages, script? }).toJSON()`. `@wildshard/format/directorStages` owns the v2 wire contract; v1 numeric AssemblyScript declarations remain unchanged. Inputs are at most 16 named booleans bound to `flag:`, `zone:`, `event:` or `actor:<id>.dead/present` sources. Native installers supply actual observations from those owners; the row does not create or grant actor authority.

`@wildshard/game/plugin/director` defines `DirectorStageLane`: `step(tick, observations)` returns ordered entry actions, and `snapshot()` / `restore(text)` preserve the immutable contract and active cursor. The first stage is unconditional and enters on the first accepted tick. Each later tick enters at most one successor whose `when` is true; without `next` the successor is the next listed stage, and the final stage is terminal. Explicit `next` permits cycles, including a guarded self transition. Each entry emits its actions once; restore emits none. Actions are only `spawn`, `despawn`, `flag: { key, value }`, `score`, `weather`, `toast`, `reward`, and `emit` (bounded boolean/numeric payload). Their existing native/presentation owners apply them; the interpreter installs no service. A non-null script requires the subsequent typed-script installation and is refused by the row-only lane.

`@wildshard/format/directorWhen` compiles `!`, `&&`, `||`, parentheses and boolean literals over declared names, in that precedence order, to JSON instructions. Limits: 1,024 source code units, 128 tokens, 16 nested unary/parenthesized operations, 64 stages and 32 actions per entry. No eval, method calls, arithmetic, property access or undeclared name is accepted. All named observations must be present and boolean before any cursor mutation. The native proof installs the row on a real SimHost, quietly restores its checkpoint, and compares exact native continuation plus the complete suffix effect/hash tape.


SF81 DIR-2: `@wildshard/sdk/directorAbi` defines `generateDirectorAbi(declaration)`, an allocation-free AssemblyScript source generator for the unchanged ABI-v0 input packing. v1 numeric input keys become camelCase `inputs.<name>: f64` getters, retaining fractional channels even at bounds 0..1; v2 stage inputs retain their declared names and become `bool` getters. Declaration order defines offsets in both versions. Ambiguous aliases and reserved AS identifiers refuse before compilation. `clock.tick`, `clock.dt`, `clock.self` and `incomingEvents.count/type(index)` expose the existing host channels. Native admission validates observations and incoming event counts before author code runs.

`behaviour/build.json` modules may declare `director: "data/director.json"`. `wildshard build --behaviour-only` admits that confined declaration and supplies the generated `./wildshard-director` module to the pinned compiler in memory. The generated module is build-time source, never a runtime facade or manually maintained offset table. `compileBehaviourModule(source, maximumPages, virtualSources)` also accepts these named virtual AS sources. All declared modules compile before publishing outputs; `--check` compares existing immutable outputs without writing. Driftwood, Pine and Nalati now read named input getters; their original event/parameter writers and host bindings remain unchanged. Rebuilt metered Wasm bytes, hashes, fuel behavior and embedded declarations are byte-identical.

### AAC packet index

`@wildshard/engine/audio/aacIndex` defines `indexAac(bytes)`, the renderer-free bounded
48 kHz stereo AAC-LC packet reader shared by incremental playback and product admission.
Unsupported/encrypted/fragmented layouts refuse; costs include priming and full final
packet padding. PCM WAV admission remains unchanged.


SF81 DIR-3: `DirectorStageLane` accepts ordered `next: [{ target, when }]` edges in addition to the unchanged string successor. The first edge whose own guard and target guard both admit wins; one step enters at most one stage. Guards use the same bounded when-language. `DirectorScriptStageLane(rows, nativeLane, {observe, publish}, restoring?)` binds every declared native AS output to an `event:<key>` boolean observation. It requires the exact immutable handler hash, preserves the owner's zero-dt dispatch and elapsed-time clock, and publishes authored fixed actions in native event order. It neither allocates actors nor grants flag, reward or presentation authority.

Scripted row continuations are version 3: original row contract, stage cursor and the unchanged complete native AS checkpoint. Restore validates both owners atomically, never steps or publishes, and explicitly refuses pre-row continuations. Driftwood's cinematic body/camera/carry/golden-hour work remains trusted presentation; authored event rows route the unchanged AS pacing. Its four cached witnesses are re-recorded deliberately, with exact decoded native state after removing the new wrapper.

The optional shardfile `directors` root contains at most sixteen uniquely named stage machines. Its generic native binding presently admits only declared quest-flag observations and flag actions; other observations/actions and AS handlers require an explicit trusted installation and refuse here. Template 1 observes its actual door script condition through the existing quest owner, then the shipped creature's death flag. Its director cursor survives a real native checkpoint and the existing weapon/quest/ledger suffix.

`@wildshard/sdk/bake/rig` also defines `readRigMotion(glb)`: Meshopt-decoded Float32
transform keys become standard Three `AnimationClip`, `VectorKeyframeTrack` and
`QuaternionKeyframeTrack` objects, with owned local node transforms. STEP and LINEAR
interpolation stay exact. Duplicate/unnamed targets, morphs, cubic splines, non-finite,
normalized or integer keys refuse. This is a Node authoring reader, not a playback service.

`@wildshard/sdk/sceneAnimation` defines `readSceneAnimations` and
`restoreSceneAnimations` for exact standard Three track data;
`@wildshard/sdk/immutable` defines canonical JSON encoding and exact byte hashing.
Author generators import these defining author-only modules directly.

`@wildshard/sdk/bake/normalizeRig` defines `normalizeRigSource(glb)`, an author-only
compiler for embedded Meshopt/quantized glTF rigs. It decodes to ordinary accessor
buffers and externalizes the original WebP/PNG/JPEG files under exact SHA-256 names,
without re-encoding. Joint indices and skin-weight encoding are retained because
GLTFLoader normalizes weights after loading. Hierarchy, inverse binds, topology,
materials and samplers survive; unknown extensions refuse instead of disappearing.
The returned glTF JSON/resource map is source for authoring, not an admission verdict.
Current product/material-slot admission requires KTX2 textures; external WebP model
textures still need an explicit contract before these figures can enter product admission.
The source marks Float32 skin weights normalized; clearing that no-op flag yields
admitted geometry without changing a weight byte or relaxing the admission tolerance.
`test/rig-normalization.test.ts` compares every decoded position, normal, UV, skin and
index channel against the original retained figures, including deterministic output.
`scripts/proof-rig-normalization.mjs` compares native TrainingDummyAssets/DummyStudio
pixels on the two real ordinary-arena users and emits labelled portrait O-check stills.


SF81 DIR-4 Pine watch/dawn clock consumes authored `data/watchStages.json` through `DirectorScriptStageLane`, using the original admitted AssemblyScript module and native quest-owned observation/publication ports. `initialDt` is an optional bounded initialization ABI value (0 through 1 seconds, default 0); Pine supplies the original 1/60-second input without advancing its tick-zero handler. Requests dispatch at zero dt in the original caller; variable frame/fixed-step deltas advance only at the existing quest phase. Page installation admits one clock authority and retains scope cancellation. The version-3 stage contract/cursor wraps the complete unchanged AS continuation; unversioned AS-only and legacy scalar saves are explicitly refused. No native sky, lantern, flag, caption, population or body owner moves into the stage interpreter.


SF81 typed stage publication: `DirectorScriptStageLane` supplies the original admitted `Readonly<DirectorEvent>` as the optional second native publication argument. Row actions keep their literal values; a native parameter port can validate the matching event identity and consume its bounded numeric payload. Initialization has no source event, and restore still emits no actions. Pine night uses this for its AS-owned flee and population clocks while native ports retain actor identities, placement RNG and motor effects.


SF81 Pine elite prelude: authored elitePreludeStages.json selects absent, home, fight and idle in the native priority order. Each live stage advances the original owner clock before its motor or admitted fight actions; the absent stage clears tells without advancing time. Pine retains the real actor, lair math, RNG and existing SF27 fight ABI. Four independent versioned cursors restore quietly; the native elite continuation is version 3 and refuses older snapshots.

### Parametric grazers (SF82 BR-1)

`@wildshard/engine/ai/grazer` defines `GrazerBrain`, with `GrazerProfile` selecting
`wander-ram` or `circle-challenge` tuning and strike data. `GrazerObservation` supplies
only the selected pattern's trusted target, random stream, home and body/contact ports.
One owner handles the strike runner, observation fence and atomic continuation. Neither
pattern installs a body, chooses a random stream or executes contacts on restore.

`ai/ramGrazer` and `ai/challengeGrazer` remain the defining legacy constructor paths:
they are parameter presets, preserving their row names, public observations, inspect
phases and byte-identical saved JSON. Wandering rams retain their three-dimensional
notice distance and duration-before-yaw random draws; circular challengers retain their
horizontal notice distance, timed face phase and ordered charge/close utility selection.
The `herd` pattern uses a real ordered roster: `new GrazerBrain(members, {pattern: 'herd', spec, ports})`.
`GuardedHerdSpec`, `GuardedHerdContext` and `GuardedHerdPorts` define its native laws.
`initialize` performs the sole initial timer draw after preflight; `tick` shares one decision clock
while `drive` retains each member's body cadence. Taming/guard fields, callback identity and the
complete string continuation remain unchanged. `ai/herd#HerdBrain` is the legacy constructor preset.
Single-body patterns refuse group-only entry points before effects. The hunt and pack extensions remain open. The additive row
spelling below changes no species registration, collider or gameplay law.

The matching author declaration is `@wildshard/format/grazers#GrazerSchema`:
`kind: 'grazer'`, `pattern: 'wander-ram' | 'circle-challenge'`, with that preset's
existing bounded flat tuning and strike ids. SDK `grazers.grazer(data)` validates
without installing code. `grazerPreset` converts admitted data to the historical
contract; the native installer and full-shard strike checks use this same pure
mapping, so existing body ports and save bytes survive the spelling change.

### Parametric divers (SF82 BR-1)

The `wind` pattern keeps the encounter's actual deferred-spawn body: construct
`DiverBrain(null, {pattern: 'wind', spec, ports})`, then pass the real body to
`spawnWind` and `advanceWind`. `WindDiverPorts` supplies terrain, wind, shared RNG,
weak-point and tell authority; manager `think` uses the tagged wind observation.
`resetWind`, `disposeWindTell` and `windDamage` preserve native encounter ordering.
`windSnapshot` and `restore` keep the original typed clocks/target object exactly;
null-body frames do no work. Nalati's `WindStooperBrain` is this pattern's preset.
The host still owns flight-frame cadence, weather and encounter stage.


`@wildshard/engine/ai/diver` defines `DiverBrain`. Its immutable `DiverProfile`
selects `orbit`, `patrol` or `burst`, each with admitted tuning, home and a sphere
strike. `DiverObservation` tags the matching trusted flight/contact ports. The
policy owns one strike runner, target vector, phase clocks and atomic restore;
the host retains movement, collision, damage and player-shove authority.

The existing `ai/orbitDiver`, `ai/patrolDiver` and `ai/burstFlyer` constructors are
presets of that implementation. Their observation signatures, inspect phases and
serialized continuation bytes remain unchanged. Orbit keeps its horizontal stalk
test and calm cancellation; patrol keeps its held-field reset and strike-before-
flight order; burst keeps its three-dimensional notice test and contact shove.
The pattern tag is not inserted into historical save contracts. A different
observation pattern refuses before effects. Wind stooping remains open; this seam
changes no body or collider.

`@wildshard/format/flyers#DiverSchema` admits `kind: 'diver'` with a strict
`orbit`, `patrol` or `burst` pattern and the historical row's bounded flat tuning.
SDK `flyers.diver(data)` validates author data only. `diverPreset` canonicalizes
to the original contract before full-shard reference checks and native recipe
installation; missing sphere strikes, flight motors or cell-bounded homes refuse.



SF81 ghost volley: Nalati page and renderer-free roster advance the same typed firing author after their unchanged death/fade/hidden guards, in reverse rider order. The AS publishes the elapsed clock delta, native shot and retry timer; native ports retain real ballistic sockets, two spread draws followed by the retry draw, body allocation and retirement. Signed eligibility projections bound author inputs without clamping negative native timers. GhostRosterKeeper v2 carries the complete v3 AS/stage cursor and refuses v1 quietly. Native roster admission does not allocate riders or register a second owner.


SF81 authored boss stages: DirectorBossBrain in game/plugin/director is the shared page/native encounter adapter for Sky Reach and Signal. BossBrain exposes protected introReady, fightReady, beatReady, winReady and phaseReady hooks at the original eligibility/read phase; its clocks, camera/skip/bar order, body/retry/reward callbacks and post-transition script tick stay native. Each shard supplies bounded DirectorStageLane rows through fixed emit actions. The complete cursor is added only to explicitly authored BossContinuation instances; installBossRow accepts stages and uses continuation version2 for them, while absent stages preserve version1 bytes. Pre-row/foreign continuations refuse quietly. No SDK facade or new plugin export module.


SF81 Signal signal-fire stages: the in-shard SignalDirector uses DirectorStageLane at the accepted fire callback, after the native interaction flags and dressing. Its fixed spawn action admits the original Matriarch summon port. Page load keeps the existing already-lit boss arm without a summons toast; a loaded stage is seeded quietly. Native sunscar.signal-fire stores the complete contract/cursor and performs no effects or extra update work; the actual quest interaction edge advances it. Restore never evaluates guards or summons.


SF81 Nine portal stages: walkInRide uses the admitted nine.portal-ride DirectorStageLane at the original hold, dark-transfer and clear guards. Native ring registration order, cardinal axes, feet volume, capped fade clock, checked floor transfer, player reset/release and step-out rearm remain their original owners. Fixed emit actions select portal.hold/transfer/clear. PortalRideState version2 includes the complete author contract/cursor; strict host restore validates the director before mutating its held body state, and never holds, transfers or paints during restore. Older/foreign continuation refuses explicitly.


SF85 WP1: `@wildshard/format/weaponProfiles` defines JSON-only, bounded melee/swept, bow, firearm and thrown numeric profiles. An item may attach `profile` with a matching family (`swept` consumes `melee`); absent profiles retain their exact pre-existing rows. `ItemFamily.profiles` explicitly admits supported profile kinds, and `installDeclaredItems` refuses unsupported profiles before calling icons, allocating a scope or constructing a controller. The admitted data reaches the native constructor through `ItemFamilyPorts.profile`. Contact, aim, wind, targets, RNG, inventory, clocks and rendering remain the existing native owners. This contract alone does not migrate a native weapon.


SF85 WP2 bows: Pine and Nalati declare numeric bow profiles in data/bowProfile.ts and attach them to their shared bow item family. The existing Bow/BowDraw reads those clocks, draw/fatigue, cone, muzzle, quiver, speed/damage and projectile integration numbers; original defaults remain exact for callers without authored parameters. Page views, mounted/reward modifiers, native body queries, weather, random stream and pickup law retain their original owners. Pine’s renderer-free installer reads its admitted item profile; its isolated native fixtures use the same authored default. A prebuilt page bow refuses a different profile at adoption. No second weapon, body, model or input owner is constructed.

SF85 WP-2: Pine's lever rifle reads a `firearm` profile with its explicit per-round lever clocks. The local `parseLeverProfile` refuses other actions/delivery, unhosted bloom and inconsistent cycle intervals before install. The existing page action and native host consume the same authored row; body queries, target damage, aim, RNG, chamber/gate order and restore remain their native owners. View rigs are unchanged.

SF85 WP-2 single-bolt rows: Pine declares crossbow and lever on `firearm`, dispatching admitted identities to their existing native owners. Crossbow launch/spread, pool, gravity/drag, substeps, lifetime, quiver and reload clocks derive from its JSON profile; ammunition/weather and body/cover queries remain actual owner ports. The fixed world domain (`range: 310`) is not a configurable bolt hitscan limit; unsupported bloom/movement/wind/action contracts refuse before allocation. View rigs, slot IDs, cues and native glance behavior stay unchanged.

SF85 WP-2 Nalati rifle declaration: its existing magazine owner reads `data/rifleProfile.ts` through the native AR15 profile. The numeric firearm declaration owns magazine/reserve, reload/interval, hitscan range/damage/spread and bloom; the native class body, rendered rig and saved slot remain unchanged. Declaration adoption does not host a headless rifle: Nalati's native weapon requirement stays open.

SF85 WP-2 Nalati javelins: the numeric `thrown` declaration in `data/javelinProfile.ts` feeds the existing native spear-slot `Thrown` profile (weapon.javelin), its gravity helper, ammunition, launch/recovery, pickup and pool. Thrust and mounted lance remain independent native laws; the rendered rig, class body and saved spear slot do not change. This declaration does not close Nalati's unhosted headless spear/weapon requirement.

SF82 `plugin/bossPhase.bossFight` also accepts the strict `script` boss profile
with `{bytes, random}` ports. It validates the full existing elite declaration
and module hash before constructing the original `EliteScriptLane`. The same
`plugin/brain.stepEliteScript` steps lanes first, reads host values, then applies
the returned ordered verbs. This changes neither the native engagement prelude
nor the fixed encounter clock. No module bytes or random stream are inferred.

SF82 Signal and Sky's native page and headless hosts admit the same authored
`{kind: "boss", pattern, fight}` data profile before allocating their fight.
Signal's `data/matriarchBoss.ts` owns its fresh-body/storm/checkpoint tuning;
Sky's `data/rocFight.ts` owns its held-body tuning. The old row/preset names
retain the same interpreted values. Director stages, native bodies, clocks,
rewards and continuations are unchanged. These trusted bindings do not claim
whole-shard recipe admission or eliminate each shard's custom brain policy.

SF85 melee rows: `combat/meleeProfile.applyMeleeCombatProfile(view, admitted)` overlays numeric combo/heavy phases, damage, stagger/sweep/reach, charge/combo/cooldown, lunge and sweep limits on an existing native pose recipe. It refuses missing or differently sized combos. Native identity, equipment metadata, keyframes, trails, cues and camera feel remain in the view. Driftwood and Nine use the same composition in their real owners; the shared starter move objects retain identity. No rendering or schema dependency enters the engine.

SF82 Pine and Nalati's native King hosts consume the same strict boss profiles
as their renderer-free fight traces. Pine declares `pattern: roaming` and keeps
its clearing geometry outside the wire profile; Nalati declares `pattern: arena`
with its original phase row. Profile validation occurs before body or RNG
allocation. Health, bodies, chamber views, rewards, strike clocks and continuation
fields keep their native owners. This data adoption does not close either
shard's remaining gameplay compatibility gaps.

SF85 WP-3: melee numeric rows may declare paired `moves.passes` and a bounded `mounted` contact/chain profile. Nalati consumes these in its existing mounted sword, preserving side selection, horse speed authority, pose recipes and reward effects.

SF82 Pine's actual elite hosts and Nalati's prepared Qara keeper admit the `script` boss
profile through `plugin/bossPhase.bossFight`, then use the defining
`plugin/brain` module for byte decoding, lane-first stepping and host types.
Pure authored declarations import their types from format. Their native
engagement, body, prelude, contact, random and continuation owners are unchanged.
The unused SDK eliteScripts runtime forwarding module and export are removed;
no frozen legacy source imported that module.

SF82 Driftwood's live species catalogue selects `stalker/skirmish` for the crab,
`guardian/interior` for the sailor and `guardian/perch` for the monkey. The
existing strict admission resolves each to its legacy preset before selecting
the original native body adapter. Every tuning field, cadence, perch/floor
recipe, shared attack stream and contact clock stays unchanged. The unique
Captain remains its custom recipe; this slice does not claim to port that boss.

SF85 WP-5: `@wildshard/game/plugin/weaponFamily` defines both the built-in held-item families and weapon hooks. `registerWeaponFamily(registry, id, family)` inserts a trusted weapon constructor into a caller-owned session-local `Map`; it never allocates the weapon or installs inputs. Names must be bounded dotted ids outside `kit.*`; duplicates and non-weapon families refuse. The existing item binder checks the shard namespace and all item declarations before construction. Signal and Sky register their native lash and fan factories; local models, cues and continuation owners remain in the shard.

H3 (G466 C6 view): `@wildshard/game/plugin/heldFirearm` is the data-only held-firearm host. `new HeldFirearm(world,
targets, { row, profile, view, rows, model, hands? })` takes no callbacks (G454): `model.geometry` is borrowed geometry by
id (a GLB's node names) plus `rows.primitives` merged per id; `rows.materials` builds the viewmodels' shared lit program
(`look`, over `model.textures` and the procedural `rows.textures`) or an unlit sight glow (`basic`); `rows.parts` places
each mesh at an anchor (`sighted: false` hides a stock under the eye, `display` adds it to `displayModel()` and
`heldFirearmDisplay`, the Model Explorer card). The profile picks the action: a `lever` row runs `RangedAction.Cycle`
(per-round gate, events `cycle`/`eject`/`chambered`/`reloadStart`/`round`/`reloadEnd` at their original boundaries), else a
magazine on `RangedReload` with bloom. `rows.playback` is HeldPlayback groups with input bindings, outputs onto the
host records (`frame`, `sight`, `values`, `grip`) and a `schedule` (action groups, grip groups, frame, sight, pose).
`hands` are two baked fists on `HeldHandParts`, the right posed by the grip groups. Rows read owner paths on `weapon`
(`time`, `player`, `feel`, `holster`, `hip`, `view`, `profile`, `act`, `partValues`, `poseFrame`, `adsPose`, `grips`,
`handFrame`, `gate`, `anchors.<id>`, `round`, `inspect`, `game`): a data contract, so a rename moves the JSON paths.
`parseHeldModelRows` and `parseHeldPresentation` (`@wildshard/format/weaponProfiles`) admit a model's and its
presentation's JSON rows (frame, flash, ejection, tracer, hit muzzle).
`parseHeldFirearmRows` admits the complete model, mount and playback schedule;
`parseHeldFirearmView` admits camera/pool tuning while preserving additional view
fields read by authored playback. Pine's lever and Nalati's generated rifle use
both before constructing the existing owner. Users: Pine's lever-action (GLB parts, the
hunter's hands) and Nalati's
AR-15 (primitive rows, `mount: 'shared'`, `scaleRoot`, the ghost-ring `glow`). A texture row may name any engine
viewmodel set (`walnut`, `brushed-steel`, `leather`, `cord`, `bolt` beside the modern three); its `repeat` is optional.

H3's bolt-flight action: `@wildshard/game/plugin/heldLauncher`. `new HeldLauncher(world, targets, { row, profile, view,
rows, model, hands? })` is a held crossbow on data only: `rows.scene` is the model's private hierarchy
(`createClientScene` rows over `model.geometry`), `rows.objects` its declared sight groups, `rows.nodes` the meshes the
rows pose (string legs, serving, the loaded bolt, the sight post), `rows.fade` the materials that fade in sighted. The
action is `RangedAction` in quiver mode; the string is a spring row (`spring`, `reloadSpring`, `release`, the reload
window). Bolts fly the engine's `projectileFlightStep` (the profile's gravity / drag × the loaded `HeldBolt`'s, or the
`projectile.modify` answer for an ammo row) and resolve on `ProjectileContact` (`rows.glance`); the trail, spin and
glow sizes are `rows.tracer`. `boltMod: HeldBolt` is plain data: flight multipliers, a damage table by target kind
(`default` + `kinds`) and an optional material. Playback groups are `frame`, `pose`, `parts`, `sight`, `string` and
`peep`; owner paths add `draw`, `tipModel`, `tipL`, `tipR`, `nockRest`, `nockDrawn`. `displayModel()` and
`heldLauncherDisplay(sky, rows, model)` pose a copy at `rows.displayRest`; `heldLauncherBolt` is the bolt card. User:
Pine's crossbow.

H3's bow draw (same module): `heldBowProfile(base, rows, model)` returns the platform `Bow`'s profile for a baked stave
bow, so the shard passes no `build` / `arrow` / `wind` callback. `rows.bake` is the bake's bow row (its serialised
`look` and `arrow`, the stave's rings, dynamic vertex counts, section samples and the fists' wrist / hook points); the
stave bends on `BowShape`'s analytic curve from that look (optional `tipKink` for a recurve's ears, `backScale`,
`tipInset` / `tipOffset` for the string anchors, `nockX`). `rows.parts` names the borrowed parts in `model.geometry`
(stave with the left fist, nocked arrow, right fist, sleeves, loose arrow); `rows.materials` the bow's and the arrows'
lit rows or painterly ones (`{ name, painterly: { rim, bands, shade, transparent } }`, opaque on a card); `rows.arrow`
the arrow kind's flight, bury, recover and pools; `rows.wind` the pull (`base + gust × windGustAt`, along `WIND_DIR`, or
`{ field: 'steppe' }` for the steppe's wind); `rows.poses` the six grip poses as triples; `rows.styles` (optional) style →
a colour channel on the stave, the first the base: `Bow.setStyle` swaps the channel in (borrowed, never written).
`bindHeldBow({ base, bow }, library)` validates the complete serializable binding,
borrows its named parts and returns `{ rows, model, profile }`. `base` follows
`HeldBowBaseSchema` (`@wildshard/format/weaponProfiles`); a null mounted gait bound
becomes infinity. It creates no mesh, clock or save. Pine compiles its original
longbow binding into `custom/handsPool.heldBow`; Nalati emits its recurve binding
beside the bake. `loadHeldBow(url)` fetches that file once per url
(`{ pool: { url, parts, channels }, base, bow }`), parses it strictly and preloads
the pool before using the same binder. `HeldBowDefinitionSchema` and
`HeldBowRowsSchema` in `@wildshard/format/weaponProfiles` expose those data boundaries.
`heldBowDisplay(sky, rows, model, paint?)` / `heldBowArrow` are the Model Explorer cards.
Users: Pine's longbow; Nalati's recurve with its Golden Bow and Sky-Wolf paints (generators/recurvePool.ts).

`@wildshard/engine/combat/contactWeapon` defines the renderer-free
`ContactWeaponHost` and `HeldWeaponClock`. Signal's lash and Sky's fan consume
these same clocks, contact-shape arithmetic and ordered pipeline responses.
`claim(lane, seconds)` refuses a cooling lane; `countDown(dt)` advances it in the
existing owner phase. `weaponContactDistance(from, dir, at, kind, reach, size,
height, allowance)` tests a numeric cone or chest lane; native callers retain
target order and nearest/all selection. `contact(target, move, point, dir, from,
accepted)` executes the move's ordered numeric `before` reactions, samples the
request, runs the pipeline and accepted hook, then applies `survived` reactions
only for a surviving hit. Health predicates read the real actor at that instant.
The move declares vector/tag ownership for event lifetime. Gust pushes precede damage; lash pulls/staggers
follow acceptance. The host creates no actors, RNG, query grants or callbacks.

`HeldWeaponClock.step(dt, enabled, held, release)` invokes release before
clearing elapsed charge, and cancels a disabled hold without firing. `reset()`
cancels on scope retirement. Signal's native input adapter serializes these
scalars in its existing version-1 continuation; both families retain their
existing move snapshots. Admission and registration stay on the defining
`plugin/weaponFamily` surface. Model, rope, pose and cue owners stay local.

SF82 Nalati's page factories and renderer-free wildlife/raid/Argymaq groups
read `stalker/pack` and `grazer/herd` authored profiles. The defining format
`nativeGroupBrain` admits the complete ordered roster and resolves its original
pack/herd preset before the existing native controller is constructed. Prey,
threat, tame/mount, aggression, RNG, initialization and restore remain the
original owners. No alternative creature manager or group registry is added.

SF82 `plugin/brain` admits species `grazer/circle-challenge` and `diver/patrol`
profiles through their defining format schemas, resolves their original presets,
and constructs the unchanged native policy. Other flight/ram recipes still need
an explicit native adapter and refuse automatic hosting. Signal's strider and
ray use these canonical profiles; saved contracts, live witness names, six
circling slots, body, contact, strike and RNG owners remain the original ones.


SF82 Nalati's Aqbars/Kokbori trusted keepers construct the defining engine
`StalkerBrain` from their authored `pouncer`/`howler` profiles. Original tuning
rows and preset constructors remain; the constructor copies/validates finite
specs before bodies/callbacks mutate. Existing keeper methods retain their exact
cadence, contact/tell order, real pack/body/path ports and continuation wire.
No extra creature, manager, random stream or policy implementation is installed.
Qyran similarly binds its authored wind-diver profile directly to `DiverBrain`
with the same deferred body, wind, altitude, weak-point and continuation ports.
Its old wind-stooper constructor remains a preset; no second weather owner.

SF82 the live creature manager and Driftwood/Pine/Nalati native fauna hosts
bind the defining `ai/stalker` hunt profile directly. `config`, `ports`, player
vector identity and real-body `sampleTerrain` remain the original authorities;
actor memory, ordered herd state and continuation are still roster-owned.
`ai/hunt.HuntBrain` remains the old-name preset constructor for existing and
frozen callers, with exactly the same configuration and shared hunt law.
This changes no tuning, family selection, placement, callback or RNG order.

The native entry proof owners are `@wildshard/game/plugin/simulation` (`proveShardfileEntries`, `proveSocketLift`, `commandSocketLift`). The proof advances the existing host and mover through real capsule walks, both lift stop calls, the closed road gate and portal arrival/exit floors; it neither teleports a rider nor installs a second simulation. These are the existing shared admission laws. Sky's trusted runtime consumes the same definitions rather than retaining a copy.
The old `./shardfile/socketLiftProof` package path resolves directly to this defining plugin for frozen legacy consumers; no forwarding file is retained. The alias leaves with those frozen folders.

### Per-body ram, orbit and burst policies (SF82)

`@wildshard/game/plugin/brain` admits `grazer` / `wander-ram` and `diver` / `orbit` or `burst` rows against their strike catalogue. `brains.decision(kind, actor, home)` constructs their historical native policy. Orbit and burst require the actual owning body's `{x,z,r,y}` home before the initial angle and continuation contract are created; the authored home is not a fallback grant. The browser uses `brains.bind(kind, nativeAdapter, homeOfBody)`, allocating one policy and adapter at the body's first callback.

The adapter supplies the existing pattern ports: the ram's live home and shared manager RNG; orbit's native `mayAttack` and flight steering; burst's native flight steering and authorized player shove. Each supplies the live player, reach, claim and hurt. `bind` without the native adapter and `policy` without body authority refuse. No RNG draws, movement, strikes or player impulses occur during admission, construction or restoration. Existing challenge, patrol, phased and script presets and all historical witness/save names are unchanged.

## Author schema discovery (OS-F3)

The author CLI `wildshard schema list` lists every format JSON Schema and the complete shardfile declaration. `wildshard schema shardfile /properties` discovers all sections without Valibot internals. `schemaDeclaration` and `schemaAt` are defined in `@wildshard/sdk/formatJsonSchema`; discovery preserves native semantic checks and grants no admission. See [schema discovery](authoring/schema-discovery.md) for pointers, tuple arity, identifier grammars and installed declaration locations.

## Typed numeric author scripts (OS-F4)

`@wildshard/sdk/directorAbi.generateScriptModule` produces the complete ABI-v0 AS module from admitted state rows and an on_tick body. It allocates memory, emits typed stable-ID state accessors, and documents byte versus record capacities and native actor provenance. The [typed ABI guide](authoring/script-abi.md) and executed numericScriptExample are checked against ScriptLane, including rollback and exact restore. Existing director accessor bytes remain unchanged.

## Director day observations (OS-F5)

Stage inputs admit day:FROM..TO as a bounded boolean over the declared look clock, with half-open normalized endpoints. The renderer and native host share world/dayCycle.normalizedDayClock; the client lends its actual page clock and never steps it twice. Complete clock continuation restores silently, and flag-only directors retain their prior state shape. See [the day observation guide](authoring/director-day.md) and the executed dayDirectorExample/native continuation checks.

## Author grid and ledger proof (OS-F6)

The public SDK headless.proveAuthorSimulation and CLI prove run a fixed native worker: the real GridSimulation admission/save/unload/restore contract, uninterrupted regional suffix comparison, and quest-derived facts filed by Ledger through serialized SaveStore storage. No author host modules or synthetic facts are accepted. See [the author proof workflow](authoring/author-proof.md); validate still owns the full entry walk.


OS-F8: SDK `@wildshard/sdk/modes` adds the ordinary three.js `Ladder` authoring
object and its `LadderOptions` data. The defining format modes module validates
vertical floors, outward direction, reach, speed and a bounded upper exit. The
normal data client/Node simulation installs the existing `climb` traversal;
its real CharacterMotor still owns collision. No new engine mode, command field,
HUD control or public game plugin is introduced. SHARDFILE.md's OS-F8 contract
describes the authored collider corridor and retained continuation.

`Player.traversalCommand` exposes the current fixed-step's admitted `PlayerCommand`
only inside `Player.step`; outside it returns null, including after a refusal.
Data traversal reads this command rather than sampling input/aim a second time.
The record sink, command shape, motion math and use/consume order stay unchanged.

## Author scene proof (OS-F7)

Data-only interaction commands use the shipping prompt law (distance, nearest priority and native LOS). SDK headless.proveSceneClient reads the built client's actual native-bound visible skins and selected prompt; it accepts no caller evidence. See [scene proof](authoring/scene-proof.md).

## Mandatory author brief proof (OS-F9)

SDK headless.proveMesaNative runs a bounded native approach, proves all three goats flee and the hawk dives and lands damage, controls the beacon interaction against an unlit replay, and restores an exact suffix. headless.proveEquippedItemClient checks actual mounted visible geometry from the admitted asset lease. The retained author-template/prove-mesa.ts combines these with scene proof and the exact catalogue of the template's own spear (`generators/spear.ts`). See [mandatory brief coverage](authoring/brief-coverage.md).

G320 pure contract boundary: `@wildshard/format` is the bottom layer and imports only Valibot and its own defining modules. The engine may import these pure data contracts. `@wildshard/format/materialGraph` now defines the unchanged graph IR, admission limits, node vocabulary, cost calculation and `validateGraph`. Engine graph compilation and game material/post admission consume that one definition; material creation and rendered output are unchanged.

G320: `@wildshard/format/materialFamilies` owns the verbatim pure family parameter schemas and their parsers, defaults, texture references and preset refusal checks. Renderers read those contracts directly. The old engine renderer-schema simulation exception is retired; format closures remain free of Three.js and DOM.

G320: `@wildshard/format/contentBounds` defines the immutable cell dimensions, entry widths and content caps. Engine `core/config` retains its public bindings to those same values and the same `CONTENT_CAPS` object, so existing runtime imports remain compatible. Authoring and validation import format directly; `test/format-content-bounds.test.ts` checks identity for all nine bounds.

G320: the pure AAC index, WMC1 collision and terrain-tile byte readers are defined in `@wildshard/format/{aacIndex,meshCollisionBytes,terrainTileBytes}`. Engine installation stays separate. Frozen runtime terrain imports keep `engine/world/terrainTileData`, whose public functions are the same format function objects, with no duplicate codec or legacy source edit.

G320: `@wildshard/format/{scriptAbi,scriptAdmission,scriptLimits}` owns the numeric ABI, metered Wasm byte admission and immutable host caps. `contentCost`, `bakedTerrainBytes` and `waterWaves` define the original pure cost law, WSTR parser and swell rows. Native hosts, terrain sampling and rendered water remain engine code; retained runtime bindings are identical objects/functions. Author validation has no native host or terrain service dependency.

G320: the complete pure shardfile/asset admission closure is defined by format: props/material/post contracts, GLB/image/cost readers and entry geometry checks share `@wildshard/format/shardSchema` and `assetAdmission`. Native installation and collider descriptor conversion remain game/engine code. Frozen portal/lift entry imports retain identical format function bindings; presentation URL construction remains game code. No look, pixel, clearance or transform rule changes. The SDK author compiler imports these format definitions directly.

### Author-only terrain job (G320)

Pastel Plain retains its seeded yard/pool/trail/entry grading in `generators/landscape.ts`; `bake-pastel-terrain.mjs` emits all 81 immutable terrain files plus the defining terrain JSON through the SDK compiler. `pastel-author-terrain` is a registered cold regeneration job, with no runtime, legacy, registry or page input. It currently compares retained output bytes; cache promotion and a complete shard-product job remain separate gates. The authoring loader supports direct generator script paths and the confined SDK JSON driver, and refuses game/engine/runtime imports in both.

G320 Pastel props: `pastel-author-props` retains readable geometry builders, authored collider rows and the original seeded cosmetic scatter stream. Its Node producer has no game, engine, runtime or generated-source imports. It regenerates `data/props.json` and all 79 immutable prop assets; complete shard-product and Linux removal gates remain separate. The props compiler and combined terrain/props producer use the pure immutable byte helpers.

G320 Pastel behavior: `pastel-author-behaviour` compiles the retained `door.as`, `items.as` and `idle.as` with their original 2/64/2-page caps. It emits all three immutable Wasm files and the door metadata without importing generated metadata as a source. The SDK loads its pinned AssemblyScript compiler via a literal external dependency in an internal MJS adapter, keeping compiler ambient declarations out of host types. Source auditing stays strict about computed imports; every existing compiler job declares the adapter in its source closure. Config loading still refuses compiler dependencies before execution.

G320 Template terrain: `template-author-terrain` rebuilds `data/terrain.json` and all 81 terrain assets from retained author seed, pool, trail, ground and entry laws. Layout rows live in `data/`; board callers consume those same rows. The complete terrain producer closure stays inside the template authoring folders plus SDK/format, without runtime captures or generated seeds. Complete shard-product, skin-source and Linux removal gates remain separate.

G320 Template props: `template-author-props` compiles the original readable geometry, collider authoring and named cosmetic scatter law without a native field, registry or session service. It owns the full props declaration and every immutable geometry output. The retained Template and Pastel persisted scene tests compare their declarations and every asset byte; no look or material rewrite is part of this boundary.

G320 Template behavior: `template-author-behaviour` compiles its own retained door, item-hook and idle sources with the unchanged 2/64/2-page limits. All three Wasm files and door metadata are outputs, never source seeds. No caller reads trusted runtime or another shard in this complete authoring compiler job.

### Emitted recording readers (SF29)

`ClientAssets.audioRead()` binds `audio.recordings` catalogue identities to
verified local or commons library bytes. It returns `undefined` when the
section is omitted. A declared reader refuses unknown identities before I/O;
it never fetches a catalogue URL. Each read gives the existing decoder an
owned, exact-length `ArrayBuffer`, preserving all encoded bytes and preventing
buffer padding or a decoder mutation from altering the admitted transport.

`ShardfileClientBindings.audioProfiles(play, { source, read })` receives the
actual emitted audio section and that reader. Installers keep the existing
sample/score decoder, selection order, WebAudio clock and scoped RNG. Existing
one-argument installers remain valid. Native runtime ownership and catalogue
adoption are separate; this port does not create another audio owner.

`indexAac(bytes)` keeps the stereo-only incremental playback contract.
`indexRecordingAac(bytes)` inspects bounded, unfragmented 48 kHz mono/stereo
AAC-LC recordings for immutable admission, including ordered multiple chunks.
Packet/configuration checks and channel
agreement remain strict. `parseAudio` charges either accepted layout's actual
full float32 frames, including priming/padding; it never decodes or changes
recording bytes. This does not lower the library cap or promise a new playback
backend for mono clips.

Trusted hybrid contexts expose `ctx.game.declaredAudio`, the exact admitted
audio rows of that resident's emitted shardfile. Home and neighbour runtimes
receive their own rows during world, kit and play, including road preparation.
The parent page's services remain unchanged. Legacy-only entries omit this
port and retain their existing declarations; it installs no second mixer,
score, bank or RNG owner. Native installers can consume those rows without
importing a build-time config or fetching a different recording.

`runtimeAudio(ctx, legacyAudio)` in `@wildshard/game/plugin/audio` resolves
the resident's emitted declaration with a legacy-only fallback. It returns
the existing declaration without creating an audio owner or drawing RNG.
Sky and Signal use it for native cue aliases and silent-score selection.

### CPU navigation authoring (G320)

`@wildshard/sdk/bake/navigation` defines
`bakeNavigation({positions, indices}, layers, settings)`. It runs the
retained navcat tiled compiler and emits WSNM v1 bytes plus ordered layer
counts. Positions are world-space authored triangles; walkable faces
point up. Settings are explicit, including metre-based edge length and
voxel sizes. Layer clearance, erosion rounding, tile insertion order,
centimetre detail quantisation and neighbour packing match the original
native baker. The runtime uses its existing WSNM reader and path queries.

The caller must supply retained authored collider/floor triangles, dry
ground selection and any datum conversion. This CPU compiler imports no
game or engine code and installs no renderer. The transitional shared
navmesh CLI still collects trusted world colliders; extracting its CPU
compiler does not qualify that CLI as a complete author-only product or
permit any output deletion.

SF81 native boss ownership: `@wildshard/game/shardfile/bossRow.installBossOwnerRow`
consumes `@wildshard/format/bossProfiles.BossOwnerRowSchema` data and a real
spawned keeper or held actor/brain. It refuses a mismatched body pattern before
installation. The existing boss step owns the unchanged stage cursor and fight
continuation. Flags, facts and coins retain declared claim/victory timing; quiet
restore re-adopts the keeper's body without drawing or emitting a reward. Signal
and Sky use this shared binding with their own authored phase and stage rows.

`plugin/director.bindDirectorActions` resolves each declared fixed action to an
explicit native callback before installation. Duplicate or unbound actions
refuse before any observation or effect. `initial` observations seed the stage
cursor quietly; `advance()` reads the native observations and runs entered-stage
actions in author order. Snapshot/restore retain the same stage contract/cursor
and restore emits nothing. Signal's fire edge and both native boss transition
owners use this binding; it introduces no tick loop or independent clock.

`@wildshard/engine/world/bakedTerrainField.createBakedTerrainField(source, metadata)`
creates a required manifest ground. `source` is `{ key, seed }`: the key names it
to the session's required-ground loader and the seed is the level's. `metadata`
retains the existing trail, water, pond, cabin and datum laws; no landscape is
evaluated. Construction never selects a level, loads or installs a service.
Height/normal/splat reads refuse until the owning boot calls
`loadBakedTerrain(binding)`, which admits the samples through the loader, or a
custom terrain painter binds its own ground (`field.bindGround`, which counts as
the required ground and may bring its splat). `installRequiredGroundLoader(loader)`
installs that port and returns its restore (E434: the game session calls it; the
game's `installProductGround` reads the shard's own admitted product collider).
A missing loader, a rejected load or a wrong seed fails boot instead of falling
back. The existing optional analytic bake path keeps its warning/fallback
behavior. Installation shifts datum exactly once and targets the captured frame.

`@wildshard/engine/world/BakedTerrain.installBakedSamplesReader(reader)` installs
the session's admitted-samples port for that optional path and returns its
restore (E434: the game session calls it). `loadBakedTerrain` asks it first with
`{ key: levelBakedId(level), seed }`; samples it returns are installed at the
same moment the fetched `terrain.bin` would have been, with no placement log; a
null (at once or after looking) keeps the fetch, and a rejection or a wrong seed
falls back with the usual warning. The game's `installProductSampling` answers
for a shard whose shardfile declares query-only terrain (G384): its sampling
file, read from the grid cell's admitted product, or standalone from the
canonical product ahead of the hybrid boot (the descriptor read once and handed
to `prepareHybridShard`, the file cached for its admission), so the ground's
lattice downloads once.

### Declared navigation (WSNM v1)

`navigation` is an optional shardfile root with `version: 1`, a SHA-256
`file`, `layout: "wsnm-v1-le-quantized"`, six global `bounds`, and ordered
agent `layers`. Each layer declares radius, height, climb, voxel cell size
and height, origin, tile size and its ordered `[tileX, tileZ]` grid. The
file is an independent critical binary root, charged for decoded CPU
navigation data. Admission verifies its hash, complete bounded stream and
every bound/grid declaration before creating a runtime mesh.

`bake(scene, identity, { navigation: originalBytes })` emits that row, its
critical file and immutable asset without re-encoding. The format reader
owns the original little-endian WSNM header, quantized voxel/detail vertex
layout, polygon neighbour encoding and detail triangles. The engine
constructs its existing navcat mesh from those same decoded arrays; path,
wander, snap, radius selection and vertical-datum laws remain unchanged.
The game supplies admitted bytes to ordinary level and grid boot. A
trusted manifest can declare the same row with an immutable URL; hash or
layout failure is fatal. Manifests without a row retain the older optional
navmesh lookup while they migrate.

`@wildshard/engine/physics/navmeshLoad.installNavigationReader(reader)`
installs the session's admitted-navigation port and returns its restore
(E434: the game session calls it). `loadNavmesh` asks it for a row declared
with a URL, with `{ key: levelBakedId(level), file: row.file }`; bytes it
returns stand in for the URL's fetch and are hashed and checked against the
row the same way; a null (at once or after looking) keeps the fetch, and a
rejection falls back to it with a warning. The game's
`installProductNavigation` answers from the shard's product when it declares
the same file: a resident grid cell's admitted bytes, or standalone the
canonical product read ahead of the hybrid boot (the descriptor shared with
that boot, the file cached for its admission), so the navigation downloads
once.

### Typed whole-shape GLBs (SHARD-PLATFORM M3)

`PropWhole` in `@wildshard/sdk/bake/props` accepts `customAttributes`
(application semantic → source channel) and opt-in `nativeAttributes: true`.
`staticGlb` in `@wildshard/sdk/bake/glb` accepts the same storage option.
Ordinary glTF semantics stay portable float32. Original integer and
half-float channels also travel as typed `_WS_RAW_*` application accessors;
node extras `nativeAttributes` record their source names, storage, item
sizes and normalization. Half floats use uint16 bits because glTF has no
float16 component type. A trusted client reconstructs those channels before
using its own material. Extras `matrix64` and `instances64` retain source
transform doubles alongside portable glTF transforms. These bytes count in
normal product admission; omitting the options preserves existing outputs.

### Provisional prop-tile budgets

`bakeProps` warns when a tile exceeds the provisional resident, compressed,
triangle or draw caps and includes the exceeded values in that tile's
`report[].warnings`. It still computes exact costs and emits admitted GLBs.
Product admission retains the hard playing/loading memory limits. Far and
library checks remain unchanged. `BakedPiece` options `nativeAttributes`
and `compactIndex` forward the corresponding static GLB options; omitted
options preserve existing kind bytes.

### Exact whole-geometry partitions

`WholeShape(..., { partition: true })` and `PropWhole.partition` assign each
triangle to its transformed centroid's 62.5 m tile. Nothing clips, rounds
or decimates source attributes. Each GLB node's `wholePartition` extras
retain its source id, vertex ordinals, triangle ordinals, source vertex and
index counts and original index width. A trusted client can reconstruct the
original draw from its tile subsets, retaining its material and draw count.
`partitionWholeGeometry` and `assembleWholeGeometry` are defined in
`@wildshard/sdk/bake/props`: assembly takes a storage/layout template,
checks duplicate triangles and differing shared vertices, then restores
attributes, index, groups, draw range and bounds. A missing subset refuses.
An unreferenced authored vertex travels in the first occupied tile.
Omitting partition keeps the original whole-shape byte path. Application
GLB extras are charged bytes and cannot overwrite reserved storage keys.

### Runtime whole-geometry assembly

Props tile rows optionally carry `additionalFiles` beside their first
`file`. All files belong to the same canonical tile address and are
individually admitted, charged and leased. Existing rows omit this field.
Partitioned whole shapes are batched into bounded GLBs; no parser bound
is raised. Their native metadata also supports a vec4 shader normal as
an application accessor, while portable glTF NORMAL remains vec3.

`@wildshard/engine/models/nativeGeometry` defines `nativeWholeGeometry`.
`@wildshard/game/plugin/geometry` defines `assembleWholeGeometryViews` and
`readWholeGeometry(scope, source, refs?)`.
The reader uses the admitted product, decodes one bounded file at a time,
frees transient GLB geometries/materials immediately, and scopes each
reconstructed source geometry. Final completeness validation and exact sphere scans use
32,768-element steps on the shared work-slice budget. An explicit `pause` also fences each
finalization step; a closed owner disposes the unpublished draws. The synchronous assembler
exhausts those same steps without yielding. Default refs are every declared props tile
file; explicit refs select a declared library subset. It returns a map of
source ids to `{ geometry, matrix }`, restoring the original typed bytes,
index and double-precision transform without adding render objects.
Missing triangles, duplicate triangles, conflicting shared vertices and
inconsistent layouts refuse. Trusted clients retain their original source
materials and draw structure; they never import the authoring SDK to read
these tiles.

Native whole storage retains every authored BufferAttribute, including
UVs and shader channels, even without partitioning or explicit semantic
maps. Explicit custom semantics take precedence; omitted mappings get
deterministic application semantics. Absent native storage preserves
existing bytes. `BakedPiece.nodeExtras` supplies plain per-kind node rows
for library subsets; one-copy instanced subsets reconstruct at their exact
`instances64` matrix through the same game assembler.

### Query-only native terrain

`@wildshard/format/terrain` admits `form: "query"` with a required bilinear
sampling profile and zero tiles, only when the hybrid runtime binds `terrain`.
An omitted collider reference derives from sampling.file; an explicit separate
collider retains the complete critical-heightfield checks. Neither form installs
collision through the runtime terrain binder. Query binding returns original
height/normal/splat queries and no render residency; it compiles no family
material. Rings, regional presentation and the data client allocate no query
terrain view. The default 80-tile form retains its original bytes and defaults.

The content audit uses the existing bounded SDK `readNativeTerrain` reader in
an isolated Node bake-loader process. A retained WSTR alias loses its private
classification only after exact height/splat re-encoding to the admitted
sampling payload, with no placement section or unread bytes. This does not
waive hashes, critical costs, entry checks or native collision ownership.

### Original native terrain queries

`readNativeTerrain(bytes)` in `@wildshard/sdk/bake/terrain` admits an
original bounded WSTR lattice for author placements. It copies the supplied
view and exposes the defining bilinear height, normal and splat queries.
It does not substitute the physics ground or install runtime services.

`bakeTerrain({ heightAt, colourAt, sampling: { source, normalEpsilon: 0.6,
datum: -0.8 } })` can retain that original query lattice separately. The
optional `terrain.sampling` section names a charged critical binary file,
its bilinear law, normal epsilon and height datum. The existing render
tiles and 257-sample collider are unchanged; the query file adds no draws
or colliders. Without this section, triangular queries remain unchanged.
Required native ground applies its manifest datum once to the raw samples.
The executed admission and exact-query example is
`test/native-terrain-authoring.test.ts`.

`readWholeGeometry` returns a `release()` handle on each source draw. After
copying or adopting it into an existing render owner, the caller forgets
the temporary assembler registration. The scope disposes draws that
have not been adopted.

`bakeQueryTerrain(source, { normalEpsilon: 0.6, datum: -0.8 })` in
`@wildshard/sdk/bake/terrain` encodes the original 256/257 native lattice
as one charged critical WTT root. It evaluates no landscape, performs no
resampling and creates no render tiles or colliders. Its query-only
terrain requires `runtime.binds: ['terrain']`; the runtime keeps its
existing renderer and collision authority. The compatibility collider
reference names that same query root. Heights and splat bytes remain
exact, and native placement logs stay outside the query payload. Omitted
use leaves existing `bakeTerrain` products unchanged.

### Exact whole-draw edge overhang

`WholeShape` / `PropWhole` can declare `overhang` from 0 to 1 metre. The
default is zero and preserves the fixed-cell refusal. The compiler keeps
every source vertex and triangle. An outside centroid within the declared
allowance belongs to the nearest edge tile; source geometry is never
clamped. `props.overhang` and each optional tile `drawBounds` charge and
cull the actual geometry. Admission checks transformed triangle bytes
against both the allowance and the declared draw bounds. Collider bounds
and physics are unaffected. Reconstruct each original source draw through
the existing whole-geometry reader; do not draw its subsets separately.

### Author-only complete product jobs (SF87)

`@wildshard/sdk/productOutput` shares deterministic admission and emission
with `wildshard build`: `admitProduct` checks actual immutable asset bytes
and costs; `assertProductTargets` applies the same target policy;
`writeProduct` writes canonical `shard.json`, every charged asset, and an
informational validation receipt. `writeAuthoredProduct` reads bounded
immutable inputs from the project assets folder before using that writer. It reads no config, runtime or retained
product. `@wildshard/sdk/projectMap` supplies `packProjectMap` and its
`ProjectMap` input to retain the exact bounded map raster in the library.

A registered complete product job lists `shard.json` and every charged
asset as outputs. Its `comparisonOutputs` pins are report-only: clean-room
CI removes runtime/legacy directories and generated outputs, then compares
all cold bytes. These pins never activate `prepareGeneration`, restore an
output, or authorize a tracked-output removal. Promotion to `buildOutputs`
remains a separate G318 change, requiring the complete product fixtures.

### Runtime-owned admission transports (G384)

First-party `AdmittedProduct.releaseTransport(refs)` owns its admission
Map; it releases `runtimeBoundWorldFiles` after a decoder handoff, or
`runtimeOnlyProductFiles` before neighbour readers copy it, and only when
exact-size, hash-checked durable bytes remain available. Online grid
admission passes `cache-or-fetch`: immutable cache misses may use the
existing size/hash-checked network reader. Offline or ordinary decoder
releases still retain the admitted copy after a quota failure.
Undeclared refs refuse before
any deletion; host-referenced unbound/shared files remain. Caller-provided Maps
without this callback are never mutated.

`runtimeOnlyProductFiles(source)` excludes inventory-only references
(`files`, `critical`, `library`) and retains every host-declared hash and
its dependency closure. Grid admission releases the remaining runtime-only
page buffers before any neighbour reader copies the admission. Temporary
release pins end immediately; the bounded browser cache can evict old
neighbours. Entry rereads through the verified cache-or-network
asynchronous product API. `ProductLeases` reduces its shared product claim
by the actual released wire bytes; `ResidencyLease.shrink(bytes)` only
reduces a live, uncovered allocation, preserving its identity and holders.

`neighbourProductFiles(source)` also releases terrain/props render tiles
and near/far placeholder wires, plus props-bound models and whole-library
wire files. Neighbour ring tiles and placeholders already read
these through `ClientAssets.read`; entered whole geometry uses the same
verified reader. Terrain-bound runtime query/collider wires also reread on
entry; neighbours draw their tiles without these queries.
Panels, texture bindings, unbound collider inputs, shared host
references and their dependencies stay resident. Unbound library models
stay resident for synchronous installers. Independent platform sections retain their own
blob-path inputs, including native decision Wasm.

`provideRuntimeProduct(admitted, scope, options?)` copies the admission
into its resident reader and pins runtime-owned disk refs until disposal.
Its `RuntimeProduct.releaseTransport(refs)` invokes the owner's callback
then prunes only the released refs from its mirror. Required-ground and
query-lattice decoders release their wire refs once sampling takes over.
Subsequent reads still verify declared size and hash. The optional options
use the admitting transport/cache; omitted options use the canonical
first-party browser product. Standalone readers start without an
admission Map and retain no decoded transports.

`readWholeGeometry(scope, slug, refs?, pause?)` consumes that slug's
already admitted or declared runtime reader and refuses unknown slugs.
Its default reads the declared props tiles plus whole library. Passing
a source object retains the original tile-only default. Explicit refs
and per-mesh pauses work in both forms; neither form changes draws,
source ordinals, attribute storage or decoder-release ownership.

The defining `bakedSamplers` retains four components for a proven-uniform
complete immutable splat lattice. Its original bilinear operation order,
clamps, NaN fallback and positive-only normalization remain exact.
Partial and varying lattices keep their original storage. The encoded
terrain, collider, native heights and conservative admission costs do
not change; separate decoded WTT arrays can release their redundant
uniform splat backing while samples stay live.

### PORT headline (G390, G392)

`node scripts/shard-platform.mjs --json` reports `port` and explorer
`generators` totals for each shard, with `_summary.portAverage` for the
shipping seven. PORT is 80 × clamp((100 − custom %) / 80, 0, 1), plus 20
world points (tiles and zero private binaries: 20; one: 10; neither: 0).
Missing admitted products make PORT unavailable. Trusted runtime remains
a separate report. Registry entry totals are context, not another weight.
The admin export generates and packs its own admitted products before
measurement; it builds no game application. The 80/20 finish count remains
under the headline. A declaration-only `shard.config.ts` adds no custom
lines; a function body or computation in it remains custom.

G394 shared ordered melee contacts: a declared weapon may attach `contacts`,
a bounded array of `MeleeContactRow` values from `@wildshard/format/weaponProfiles`.
Each move declares its cooldown lane, cone/lane shape, immediate or ordered
delayed landings, contact damage/tags and ordered before/survived reactions.
The defining `@wildshard/game/plugin/simulation.bindMeleeContacts(weaponId,
rows, { owner, ...ports })` admits JSON and constructs the existing engine
`ContactFamily`. `owner` supplies the native player actor or page environment
for `source: owner`; `source: env` always remains environmental. Identity,
aim, body/chest/world queries, reaction ports and update phases stay trusted.
Binding does not advance clocks, enqueue commands or change continuation.
The declared vector/tag copy flags retain their event-lifetime semantics;
health predicates run after the accepted hit and its callback. Signal's lash
and Sky's fan use the same controller and keep their original held release.
Absent `contacts` leaves existing item admission and serialised bytes unchanged.

G394 melee AS secondaries: optional item `secondary: { action, code, move }`
requires an admitted item hook and an in-range secondary-lane contact. Codes
3 and 4 select only that declared move through the existing actor-bound
`scriptItemHook`; script events cannot provide damage or impulses.
`@wildshard/game/plugin/simulation.startMeleeSecondary(family, hook, input)`
checks the original secondary clock and command bounds, then starts an
immediate or timed contact only after the hook accepts. A missing, forged
or failed hook declines without touching the contact continuation. Immediate
contacts still land in the owner's original phase; timed contacts advance
only when that owner advances them. No second contact controller is created.
Absent `secondary` keeps existing item admission bytes unchanged.

G394 composed item hooks: `ScriptWorld.actor(handle)` supplies host-bound
provenance, with no grant in an ordinary world. A composed world delegates
only to the entity's own role. `scriptItemHook` therefore works on the same
composed host while refusing unknown, unbound and cross-role actors.
`@wildshard/game/plugin/simulation.createMeleeScriptDriver(items, actorId,
admittedAssets, seed)` detaches and verifies the declared module hashes,
then prepares an item role without constructing another ScriptHost.
`driver.role()` joins the existing composition; `driver.hooks(host)` binds
its actor-owned hooks after that join. Include its modules and entity handles
in the existing aggregate admission. Item responses are consumed on the
following tick; sleeping numeric-role input stays charged across restore.
The owning composition advances the single clock and all shared allowances.


### Ordered boot declarations

`BootSpec.sources` accepts `BootSourceRows`: a `tiers.phone` and
`tiers.desktop` record of the ten ordinary source categories. Each ordered
entry is a URL or `{ gpu: url }`. `bootSourceFiles` in
`engine/boot/filePolicy` resolves GPU entries with the existing phone and
texture policy at consumption; plain URLs remain unchanged. Duplicates and
category order are retained. The optional `gpuFiles` table supplies the
level's stand-ins alongside the engine table.

`BootSpec.files` accepts a URL array or `{ sources, tier, tex }`, resolved by
`bootFileList`. The fixed selection preserves inventories which intentionally
use phone/image sources even for desktop accounting. `lateReads` accepts an
ordered URL array, resolved by `bootLateReads`. Callable legacy inventories
retain their original arguments and results. Both Sky and Signal consume
these declarations; frozen manifests remain callable.

`BootModeRows<T>` adds offline-resolved inventories: `modes.phone` and
`modes.desktop`, each with ordered `img` and `ktx2` values. Sources use
`ChunkFiles`; files and late reads use URL arrays. `bootFileList` selects
the requested tier image inventory, preserving the callable file-list
contract; `bootSourceFiles` and `bootLateReads` select the exact mode
(default image for late reads). A fixed `{ sources, tier, tex }` selection
also accepts compiled sources. Generators bind these JSON rows through
authored manifest boot bindings before admission, including background
prefetch, with no runtime recipe tables or per-shard selector callbacks.
Offline recipe compilers may pass file-presence facts through
`BootFileInputs.inventory`: retained file sizes or `true` for guaranteed
admitted producer outputs. Presence and phone fallbacks use those facts
instead of installing application asset-table services. Bootstrap inventory
producers precede manifest consumers; output declarations break the cycle
where those consumers produce a file in the same inventory. Generation
still refuses if a declared output fails to publish.
Terrain-dependent diagnostic poses can use the authored manifest `poses`
binding with compiler-emitted JSON: the native lattice and datum are sampled
offline, and `defineShard` returns independent copies through its dev API.

These are native level boot rows, not a second untrusted asset-admission
path. A compiled shardfile's files must still pass its content and cost
admission before the data client can read them.

`MoverScriptDriver.compose(content, assets, ports, brains?, permissions?,
{ roles, schedules? })` joins additional trusted item or other roles into
the existing mover composition. Their handles, module bytes and optional
schedules share the same aggregate entity, effect, event and fuel limits.
Owner provenance remains local to each role. Omitting the last argument
preserves the previous role order and continuation bytes; no second host
or fixed tick is created.

`MoverInstallation.composition` optionally joins verified `{ modules, roles,
schedules?, seed }` with the existing page mover lane. Its installer owns
one fixed tick; mover contacts still publish in their original fixed.pre
phase. The original 32-entity cap and all shared allowances stay fatal.
The defining `createComposedMoverHost` verifies and detaches extra module
bytes before admission. `MoverRuntime.scriptHost` exposes the admitted
host for trusted item binding; an injected shared host cannot also compose.

`bindRuntimeItems` optionally accepts a host-bound `hooks` map. Every
declared item hook must resolve before equipment is created. The declared
item loader forwards its hook, contacts and secondary selection to trusted
families without changing existing absent-field calls. It creates no script
host or new tick; the runtime's existing composition owns both.

Declared client-channel prompts publish only their own copied `x/y/z`
coordinates. `ClientChannels.prompt` supplies a bounded label, reach, initial
position and named or admitted socket-lift intent (at most 64 prompts).
`createClientChannelPrompt` binds each intent before allocation; its trusted
callback receives the owned prompt for label changes, and runs only on real
interaction. `moverChannelPrompts` updates the same ordered roster from copied
mover poses. Evaluation never dispatches an action or writes player/shared
state. Socket-lift intents require a matching admitted edge and mover. The
`hypot3` expression preserves the original three-axis `Math.hypot` boundary.

### Native melee owner rows (W1-C6)

A weapon's optional `native` attachment is admitted as a `NativeMeleeRow`
(`@wildshard/format/weaponProfiles`). It selects fixed-step command and
cooldown ordering, eye/pitch aiming, body selection and a bounded ordered
continuation layout. Contact values remain in `item.contacts`; hooks remain
actor-bound to the existing composed ScriptHost.

`installNativeMelee` in `@wildshard/game/plugin/simulation` takes the admitted
weapon, its native policy and the authoritative command/world/hook ports.
It returns the original shared contact controller and the tick's world
outcome. It installs one scoped native step and never creates a second
ScriptHost or begins another script tick. `hookTick` reads the composed
host's current tick. Continuation field order and encoding are declared
explicitly so existing JSON and object contracts survive a restore unchanged.
Absent `item.native` preserves existing item and product bytes.

The public `@wildshard/sdk/compileScript` module is implemented by the Node
authoring host `sdk/bake/compileScript.ts`; gameplay never loads it.

`@wildshard/sdk/compileScript.bakeScriptModule(sourceFileUrl, assetsDirUrl,
{ hash, bytes }, options?)` compiles an author-owned AS file with the same
pinned portable compiler and metering as `compileScript`. It checks the
exact declared size and SHA-256 before emitting the hash-named file. A
crossed pin refuses before any directory or output is created. File I/O
stays in this Node authoring operation; importing it installs no service.

The Sky page fan constructs one `bindMeleeContacts` controller from its
admitted item rows. Its GUST hook uses the existing mover composition's
actor-owned item role and current tick. Accepted actions retain the original
claim, pose, onGust and contact phases; cooldown, held release and pendant
pose arithmetic remain unchanged. Signal and Sky share the contact and
script hosts; their remaining presentation recipes stay with C6.

The material graph input `meshMap` samples the original model colour map at
its mesh UV, including the borrowed texture's sampler, transform and colour
space. It is a fragment-only vec4 input and costs one sampler even when reused;
post, points and vertex stages refuse it. Unmapped meshes read white RGBA.
`@wildshard/sdk/materials.meshMap` authors this input. The client compiler's
optional second texture argument and declared props' colour slots bind it via
`bindGraphMeshMap` in the existing engine graph backend. Equal graph/map pairs
share a scope-owned material; different maps remain separate. Original textures
and source materials are never modified or disposed by the binding helper.

`@wildshard/format/items.parseNativeMeleeBinding(policy, contacts)` admits
JSON-only native policy and contact rows together. Every action must resolve
to a contact with the declared immediate/delayed phase; scripted actions
require a secondary contact. It retains original contact and tag arrays for
event lifetimes. `installNativeMelee` uses this items admission before
allocating its controller or registering a native step.

**Held species controllers (W1 C4).** `plugin/brain#admitSpeciesBrains`
admits `{ archetype: 'raptor', data }` through the strict raptor schema and
resolves every phase's strike before creating a body. `brains.body(kind,
actor, shared)` uses the actual host, motor, attack authority and RNG; it
registers one controller, available through `brains.held(kind, actor)`.
The held encounter sets `phase` and `fighting` or calls `restart()`, while
presentation reads `current` and `windup`. `snapshot()` / `restore(value)`
retain the original controller continuation without advancing the body.

For the browser, `brains.bind(kind, undefined, undefined, { shove })`
returns the normal `think` / `act` callbacks plus `control(actor)`.
Preparing that controller draws no RNG and advances no clock. The trusted
body supplies the player-impulse port; authored rows supply numeric recipes
only. Missing authority, foreign body kinds, duplicate controller owners
and undeclared strikes refuse. Other archetypes keep their existing
callback shapes. Lookup through `held()` does not construct a controller.

**Ordered held-rig clip state (W1 C4).** A clip factor may declare
`{ bounded: [terms], max?, min?, divide? }`: sum the terms in order,
apply the upper cap, then the lower cap, then divide. Division uses the
authored divisor directly so existing floating-point values survive.
Nonfinite bounds, inverted bounds and a zero divisor refuse.

A clip row may instead write scratch memory with `{ mem, ease, cases }`.
It evaluates the selected case's target, then writes
`old + (target - old) * min(1, dt * ease)`. An absent old value is zero.
Subsequent rows read the new value, including when the rig lacks a bone.
These rows require finite nonnegative frame `dt` and easing rate; missing
frame authority refuses. Ordinary bone clips require no new inputs and
keep their original arithmetic and signed zeroes.

**Actual page homes (W1 C4).** `SpeciesBrains.home(kind, actor, at)` lends
the catalogue a finite circular home for the declared live body, without
constructing a policy or consuming RNG. A bind's home resolver is its
fallback; a home lent before the first decision takes precedence.
`bind(kind, undefined, homes, { shove })` can run the admitted wander,
orbit and burst patterns on the existing page body and observation.
Wander refreshes its home each call; orbit and burst retain the home
chosen at policy construction, preserving their original continuation.
Burst requires the trusted player-impulse port before construction.
Explicit native adapters remain supported with their original behavior.

`installSpeciesHomes` permits an omitted `custom` fallback when every
kind declares its body policy. A kind without a body then refuses rather
than constructing a default policy. Held controllers also expose their
read-only `aim` for copied strike presentation.

The graph material catalogue's `bindMeshMap(id, map)` borrows an original
mesh colour map for an already compiled graph. Equal graph/map pairs share
a scope-owned material variant; different maps share the graph program.
The current draw supplies its material reference, including on later frames.
Unknown catalogue IDs refuse. Maps retain their original sampler, UV transform
and colour space and remain owned by their original asset scope.

G409 KTX2 library residency uses the admitted file's complete mip dimensions:
ASTC LDR and BC7 charge 16-byte 4x4 blocks, including padded small mips.
GPU capabilities are trusted, probe-filtered transcoder support, never authored
metadata. Unsupported/raw/HDR sources retain the full RGBA charge. File rows
and conservative pre-read ceilings keep their RGBA fallback; actual byte
admission and library allocator claims use the selected footprint. The
25 MB library target and complete 1.0/1.8 GB memory limits do not change.


### Bounded held playback

`@wildshard/sdk/clientChannels.ClientChannels.sample(a, keys, interpolation)`
compiles 2–32 finite, strictly ordered scalar keys into the existing visual
DAG. `linear` and `smoothstep` retain the original segment arithmetic, including
the 1e-6 interval denominator floor. The first and final endpoints clamp the
sample outside its key range. Inputs and backward references use the existing
DAG admission limits.

`@wildshard/game/plugin/weaponFamily.HeldPlayback(rows, parts)` binds named
groups of admitted client-channel programs to privately owned model parts.
`beginFrame(dt)` advances one presentation clock; `apply(group, observations)`
copies named numeric observations into that group's reusable buffers and
evaluates its visual bindings. Admission allows 1–16 groups and 1–8 programs
per group, within the existing aggregate expression/slot budgets. Contacts and
held-action clocks keep their caller's original phase order.

Signal's root/grip flick and Sky's eased root/pendant poses use this owner. Their
retained authoring recipes emit cheap build-only JSON, using the generic SDK
JSON writer. Runtime does not interpret the authoring recipe or allocate
observation objects per frame. Cord deformation and caught-wrap lifecycle remain
the separate open C6 tail.

Held species controllers preserve the existing `stageLap(angle)`,
`stageOpening()` and `stageStalk(at, face)` capture operations on their
own admitted body. These do not construct another policy. The shipped
page and native encounter both obtain that controller from their single
species catalogue, while the boss stage rows retain their existing clock.

`projectRuntimeFacts` also returns `bindProgress(view, checkpoint?)`. It attaches
a later caller-owned Progress view or replaces the current view. Emissions
refresh only that current view; absent views install nothing. The default
checkpoint is the original ledger flush. A caller-owned checkpoint can retain
its exact state/continuation write order before flushing that same ledger.

Node graphs on `InstancedMesh` use the classic renderer's reserved
`instanceMatrix` and `instanceColor` attributes, bound from the current
object for each draw. Instance count and object identity never enter the
program key. Plain meshes, instanced meshes and coloured instances have
separate feature keys; maps still share one compiled catalogue graph.
Morph, skin, displacement, instance-normal and authored position order
remain unchanged. The executed `scripts/graph-mesh-map/run.mjs` oracle
checks three instanced meshes (3/5/2), shared geometry, two maps, map
swaps and live matrix updates, alongside the original plain-mesh case.

**Native species placement and holds (W1 C4).** Optional
`installSpeciesHomes` placement rows lend each declared body's actual
home and WORLD-floor ray start, with a finite analytic fallback. The
existing keeper owns body order, shared RNG, floor query and restore.
Placement requires exactly one row per declared body and cannot combine
with private home/place/adopt callbacks. Homes validate strictly while
retaining authored field order in native continuation records.

Optional `holds: [{ home, field, until }]` writes each retained home's
memory field to one until the host flag is set, then zero, in authored
order at the original beforeStep phase. Invalid home indices refuse
before body allocation. Neither option allocates another policy, clock
or stream; absent options preserve the original callback paths and wire.

**Baked creature look catalogues (W1 C4).** `creatureLooks(bodies, rows)`
builds an ordered catalogue over an existing `creatureBodies` loader.
Each row lends a body key, the unchanged baked look metadata and its
clip rows. Every spawn still obtains its own cloned body and animation
state through the original loader and `bakedLook`; no rig fitting,
material, palette or clip arithmetic is added by catalogue assembly.

**Ordered species metadata binding (W1 C4).**
`SpeciesBrains.catalogue(rows, { homes?, held? })` binds a declared
catalogue to original page metadata in authored order. It refuses
unknown/duplicate kinds, more than 1,024 rows and missing home/body
protocol authority before creating callback tables. Homes validate
strictly and retain their authored values. It never allocates an actor,
consumes RNG or runs a decision. Self-contained protocols and the
existing automatic body protocols share the original `bind` callbacks.

The returned `prepareHeld(kind, actualBody)` obtains the same held
controller as that row's binding. It is explicit and idempotent, with
no perception or movement tick; unknown/foreign kinds refuse. Ordinary
kinds return null without constructing their decision policy. Existing
`bind`, native body and quiet controller lookup paths stay unchanged.


### Declared private geometry kernels in held playback

`ClientChannels.deformTube(row)` retains a `tubeCurve` descriptor on the
admitted client-channel program. Its `from`, `to`, `extent` and `wave`
fields refer to already evaluated scalar nodes; the bend, ripple, drop
and radius tuples retain the author's original coefficients. Geometry
programs may have no transform outputs; an ordinary empty program still
refuses. Admission bounds the segments to 1–1024, radial sides to 3–64
and their vertex product to 4096; every scalar reference is checked
before a private target is bound. This is declaration and scalar
evaluation, not a per-vertex DAG or simulation command.

`HeldPlayback(groups, privateParts, kernels?)` forwards an optional map
of trusted private geometry factories to `createClientChannelView`. The
map keys name the declared private target. A factory receives the
admitted descriptor and that private scene object, and returns its
owned `(frame, time)` kernel. The frozen frame exposes eight detached
scalar outputs; `time` is the existing presentation clock. No function
arrives in shardfile data. Missing factories, non-private scene targets
and invalid observations refuse; default transform-only callers remain
unchanged. A geometry owner must validate its storage and preserve its
original normal/bounds updates and lifetime.

Signal's original ring loop stays in its private `LashCord.bindCurve`,
where literal iteration caps enforce the admitted bounds. Only
frame-invariant original arithmetic is cached; its vertex backing,
animated arithmetic order and normal computation stay exact. The
shared host does not copy the loop, and its relocation is not claimed
as a custom-code cut. Both lash and fan still use the same held
presentation owner; this private geometry law is an open Signal C6 tail.

**Native species encounter population (W1 C4).**
`installSpeciesEncounter(host, population, bossOwnerRow, effectPorts,
snapshot?)` installs the existing species home keeper and binds the boss
only to an owner from that population. A spawned profile requires the
matching declared boss row; a held profile requires a matching home.
Foreign addresses refuse before allocation. Held control comes from the
population's admitted brain on its actual body, and a spawned encounter
uses that keeper's boss lifetime. The returned `keeper` and `encounter`
retain the original continuations and ordered reward ports. Callers own
brain construction phase, install order and the final `keeper.settle()`;
no extra host, clock or body is created.

**Creature Model Explorer specimens (W1 C4).**
`@wildshard/sdk/looks/modelLibrary#creatureSpecimen`
`(actualBodyCopy, { parts, material, scale? })` builds an
unposed specimen from the body's original hard-part geometries. `all`
retains every part in order inside a Group, with a distinct standard
material per part; `first` retains a Mesh of the first part and the
existing zero-area stand-in when none exists. Material values pass to
the original standard constructor, and the optional positive finite
scale applies to the root (default one). No geometry fitting, animation
or RNG draw occurs. Model declarations retain their own ids and rigs.

**Authored page body homes and holds (W1 C4).**
`bindRuntimeHomes` accepts optional `bodyHomes` (declared body ids and
finite homes, plus the existing `authority.home` port), `held.placements`
(late floor rows replacing the callback), and `holds` (ordered home
indices, numeric memory fields, until-flags and the existing flag owner).
References, duplicates, finite placements and callback conflicts refuse
before allocation. The authority binds the actual body once spawned;
null authority retains the existing unbound-home path. Held allocation,
late WORLD-floor placement, retained restoration and paced cancellation
keep their original order. Holds run in the page's original update phase;
a null flag owner writes zero, retaining the original unheld state.
Legacy callbacks and absent options retain their behaviour. These rows
create neither a host nor a clock and consume no random values.

### Declared page and native populations

`HybridRuntimeRows.species` accepts a population program instead of a private
callback: `program` contains the species, strict strike rows and hash-keyed
base64 modules; `page` retains registration order, `looks` the existing catalogue,
and optional `homes` and `shove` lend the existing actual-body authorities.
The hybrid host admits it during kit, retains its catalogue and witness, and
binds the player's shove port in the original entered lifetime before audio.
The callback form retains existing behavior for other consumers.

`prepareNativePopulation` in `game/shardfile/bossRow` resolves the same baked
body recipes once. Its authored homes may select `late: 'ground'`, unlimited
attackers use `null`, and `think: 'legacy'` selects the existing decision band.
`admission` preserves preparation or per-host catalogue construction. Its
`install` binds the existing population and encounter in the caller's phase;
the caller still owns settle timing. Preparation allocates no actor or tick.
Both page and native programs use the SDK's unchanged strict strike schema,
now defined by `CreatureStrikeSchema` in `format/creatures`.

### Admitted private held models (C6, G405)

`@wildshard/format/clientChannels` defines `PrivateSceneSchema`,
`PrivateScene` and `parsePrivateScene`. Version 1 admits at most 128 ordered
nodes, 32 materials and 16 textures; identities, connectivity, bounds and
references are checked before assembly. Group, mesh, imported owned object
and indexed child-anchor nodes preserve the original hierarchy and draw
order. Optional resources omit their entire subtree before decoding.

`@wildshard/game/plugin/ui.createClientScene(row, ports)` constructs only a
private model, with no registry, collision, fetch or installation. Standard
material properties and transforms are rows. Texture ports retain original
samplers; bounded RGBA planes reference admitted bytes at exact offsets,
without resampling. A repeat port supplies an immutable copied pair from
baked fit metadata. Named trusted material decorators keep existing shader
programs in their defining owners. Missing references or invalid byte
extents refuse; no fallback rewrites accepted data. The returned owned
boundary disposes its new materials/textures and empty fallback geometry,
never borrowed assets, and retains no source transport map or callbacks.

`@wildshard/game/plugin/weaponFamily.HeldPlayback` accepts an optional fourth
argument `{row, ports}`. Its `model` exposes the exact hierarchy and typed
part/material accessors; a trusted optional geometry-kernel factory binds
once against those owned meshes. Absent model input preserves existing
callers. Signal lash and Sky fan use this one model/presentation owner in
both gameplay and their catalogue, retaining the original contact phase,
clock and independent shader ports. No SDK runtime forwarding alias exists.

### Graph effect coordinates and exact raster inputs

`@wildshard/format/materialGraph` admits these optional vertex inputs:
`modelScale` reads the world model matrix's positive axis lengths;
`cylindricalBillboard` returns an absolute local position facing the camera
about world Y, retaining X/Y model scale (subtract `positionLocal` for
`vertex.offset`). `viewDepth(worldPoint)` returns minus camera-space Z.
`screenDirection(worldA, worldB)` returns the normalized NDC displacement
B minus A, Y up, biased by `[0.00001, 0]` for a coincident pair. Pass it
through `varying` to a point fragment; `pointCoord` is Y up. No source code
or camera matrix comes from the shard. Existing ops and absent effect
state keep their programs unchanged.

`@wildshard/sdk/bake/texture#bakeRawColourTexture` stores decoded bounded
PNG/JPEG/WebP RGBA pixels in Zstd RGBA8-sRGB KTX2 without lossy encoding.
Its explicit `flipY` option selects row order. A graph texture param names
the admitted file hash; the file belongs to the charged library. A sampler
with `filter: 'linear', mips: 'gpu'` preserves the existing painted-image
GPU mip law. This is an author writer, with no new runtime SDK facade.

`runtimeLookMaterials` reads immutable graph files and their texture closure
before compiling selected IDs. A hybrid compiles them in its world stage
before making runtime meshes; its existing entered owner feeds declared
host clock params through `graphs.bind` and `tick(0)`. Material and texture
ownership stay with the resident scope; required files and failed graph
compilation refuse before constructing effects.

`Game.captureHeightMaterial()` makes the official map capture's unchanged
world-height override (16-bit R/G, B coverage). Its caller disposes it;
no ordinary frame creates it and it never depends on a retained scene shader.
The confined SDK JSON writer's optional `--files` mode accepts a bounded
Map of own project outputs, validates every path and byte array before
publishing any, and reads only that shard's authored input folders.


### Declared creature libraries and page fights

`engine/models/model.defineBakedModels(rows, build)` defines bounded,
unique model metadata without registering a species or building a model.
`defineGeometryModel(row, field, policy, source)` binds authored variant
part names to a caller-owned geometry/material library. Recipes retain
part order, optional geometry fallback, clone and shadow policy, lazy LOD
bands, optional specimen material and Float32 convex hulls. It never loads,
fits or poses geometry. Pine crags and Driftwood cove prototypes use it.

`@wildshard/game/models/specimenCatalogue.defineSpecimenCatalogue<Params>(rows,
packed?, materials?)` returns a typed `.model(key)` binder and registers parameterized models from data alone. Each
`SpecimenModelRow` declares its model metadata, defaults, partial variants,
optional own-space collider rows and one specimen source. `owned` selects a
bounded exact parameter record and an identity-space GLB with a loading-box
size; `packed` selects the model id plus its ordered JSON parameters in a
`PackedSpecimenBake`; `asset` borrows declared direct-child geometry and
material-atlas slots from a prepared GLB, with an optional phone file and
retained authoring attribute. An optional inert `instance` name and LOD
marker lets existing placement owners read the same declared material look.
Unknown owned
parameters refuse rather than invoking procedural shard code. Registration
does not fetch or build a specimen, and there are no shard callbacks.
The authored catalogues produce generated boot JSON and parameter declarations,
so pre-admission Explorer registration does not import authoring modules.
Driftwood uses owned GLBs; Nalati uses packed parts and prepared assets.
The renderer-free `@wildshard/sdk/kit/specimenSchemas` module exports
`SpecimenCatalogueSchema`, `PackedSpecimenSchema` and
`SpecimenMaterialSchema` for Node/schema discovery. The render binder
imports these pure declarations; constructors also refuse non-JSON values, accessors,
cycles, callbacks, unbounded catalogues and paths outside `/assets/`.

`createPackedSpecimens(bake)` lazily inflates the declared lane-shuffled
binary and checks its byte count and complete geometry coverage. `use(raw)`
admits the same inflated bytes in Node (`catalogue.usePacked(raw)` for a
complete catalogue); each build owns fresh typed arrays,
retaining the original index, optional non-indexed expansion and bounds.

`installPickupCatalogue(rows)` explicitly installs prepared pickup looks
for interaction tables and the loot coin model. `PickupCatalogueSchema`
declares each model's identity, specimen height, ordered lit/glow parts,
bob/pulse values and finite seed-qualified geometries. Each geometry stores
zlib-compressed base64 bytes with the existing packed-geometry metadata;
an owner receives fresh arrays through `readBakedGeometry`. Registration
keeps only encoded bytes, never decoded templates. Missing seeds refuse.
Driftwood's glyphs/glass and Pine's flint/resin/tokens use the same host;
the offline producer runs the real interaction cache to retain spawn order
and includes Explorer, loot-burst and frozen shelf seeds.
Parts bind their declared material slots in order and announce model-ready
after their group fills. `specimenMaterial(sky, row)`,
`loadSpecimenTexture(row)` and `loadBoundSpecimen(sky, row)` share material,
texture and prepared geometry lifetimes with live world users. Material rows
borrow a low-poly variant or declare painterly knobs, an optional mapped
texture pair and a floor amount. They retain the original shader factories;
no fitting, painting or shader generation occurs in this loader.
`awaitSpecimenAssets(sky)` awaits only loads already requested. Driftwood's
trail props and Nalati's camp/landmark, yurt and bridge catalogues use this
host; Nalati's live draws borrow the same material and prepared-asset caches.

The SDK model library's `models(rows)` method resolves those
metadata rows through the original rig specimen builder. Sky and Signal
use their declared rig libraries for both play and Model Explorer.

`ModelLibraryRows.rigs` contains body files and ordered look rows;
`rigLoad: 'manual'` preserves an explicit preparation phase. Libraries
expose `rig`, `bakedRig`, `looks` and `preloadRigs`. Absent rig rows retain
the original preload. `CreatureBodyRows.releaseDecoded` releases decoded
ImageBitmaps at upload through the existing texture resource hook.

`HybridRuntimeRows.population` binds actual body homes, held bodies,
ordered groups and witness selection. The base `populate` preserves the
caller's install phase, pause and scope. `actor(id)` reads those actual
bodies; `inspect` admits bounded, read-only capture aliases.

`HybridRuntimeRows.fight` is a `BossViewRows` declaration.
`ui.bindDeclaredFight(ctx, row, ports)` binds its original held or spawned
controller, record, reward, presentation and victory actions. It adds no
simulation clock. Sky and Signal supply actual bodies, page flags and
Ledger facts; a spawned row's storm is the platform's (`bossStorm`).
`headless.bindRuntimeBossRecord` retains
the existing strict state JSON or flag-backed save representation;
`bossRow.parseBossRecord` admits the shared saved-field contract.

### Content cache worker

`@wildshard/engine/boot/contentCacheWorker` defines `ContentCacheWorker`,
an explicit bounded worker owner over the original `ContentCache`.
`get`, `put`, `pin`, `flush` and `stats` retain the cache contracts;
`has(hash, bytes)` verifies durable SHA and length without returning an
unneeded byte array. `close()` drains, flushes and terminates its worker.
Failed workers terminate before one shared checked fallback takes over;
its refcounted leases survive. Importing the module starts no worker.

### Paired visual channels and prompts

`plugin/ui.bindClientChannels(programs, ports)` binds named private scene
targets once. Its borrowed `movers` map publishes the existing native
pose and field observations, without creating a body or clock. Direct
`evaluate(id, observation)` retains a caller's own time, delta and copied
values. Sky uses native winch and lift observations; Signal uses its
original frame-delta bucket ramp and boot-only oil initialization.

Call `bindPrompts(bind)` in the original input-binding phase. It creates
the ordered `interactables`; `prompt(id)` returns their actual spots.
`updateMovers(pose)` evaluates only copied-pose prompts. Native views
remain driven by the existing mover callback. `view(id)` lends the
original view lane. Unknown identities and repeated prompt binding
refuse; native owner, target, clock and authority checks remain intact.

The former single-user `moverChannelView`, `moverChannelViews` and
`moverChannelPrompts` exports are retired; both shards use the defining
`bindClientChannels` export directly.


### Declared page held-melee phases

`@wildshard/format/clientChannels` defines `HeldMeleePhaseSchema` and
`parseHeldMeleePhase`: a strict version-1 immediate/delayed schedule with
two ordered primary phases, bounded durations/charge/spring/placement and
an immediate namespaced secondary action or delayed channel/part bindings.
The schema refuses crossed phase identities, intervals and unknown fields.

`@wildshard/game/plugin/ui.createHeldMeleeBinding` binds that schedule to
existing private scene parts and compiles a stable phase lookup. It does
not allocate geometry, alter poses or install input, collision or scripts.

`@wildshard/game/plugin/weaponFamily.HeldMeleeWeapon` is one page owner for
immediate and delayed melee. Trusted ports supply the existing contact
factory, targets, owned model/playback and optional deformation/catch
parts. It keeps claim-before-aim, delayed landing/hold release, callbacks
and original frame ordering; ContactFamily and the composed AS host stay
authoritative. Primary and secondary contact lanes/modes and all channel
groups are verified before input installation. `HeldPlayback.requireGroups`
refuses unbound groups. Native hosts and contact snapshot bytes do not
change. Sky's fan and Signal's lash are the two shipping users; both old
page controllers are deleted. The private cord kernel and material shader
ports remain honestly shard-owned.

### Bounded connector transforms

`ClientChannels.connector(row)` declares private object poses or explicit
intervals in an existing instance mesh. Coordinate, scale, enabled and
optional cache references name already evaluated scalar DAG nodes. `aim`
aligns a literal unit axis with the endpoint direction; an optional axis
turn can alternate repeated copies. Instance capacity and aggregate slots
are capped at 8,192, with disjoint ownership admitted before binding.
The optional field is omitted from existing programs and their wire bytes.

`createClientChannelView` borrows scene storage and writes these transforms
without constructing geometry or granting physics/state authority.
`bindClientChannels(..., { copiedOwners })` reads poses in the caller's
existing visual phase, batches dirty instance buffers, and excludes these
views from its native mover adoption map. Copied views cannot read native
fields. Sky's chains, gates and rails and Signal's well bucket/rope use the
same kernel; their original bodies, clocks and interaction owners remain.

### Fixed-capacity material graph placement

`@wildshard/format/materialGraph` admits `stages["vertex.position"]`
with `{ position }`: the entire post-instance model-space vertex position.
It is exclusive with `vertex.offset`; neither path supplies a custom shadow
variant. `arrays` declares numeric uniform lists with `type` (`float`,
`vec2`, `vec3`, `vec4`) and `value`. Each list has 1–64 elements; all lists
share a 128 padded-vector-slot cap. `arrayElement` names its list in `param`
and takes one float index, floored and clamped to the list bounds. Existing
bounded loops may read it through their `index` node; cost limits still apply.
The graph compiler's `setArrayParam(name, values)` requires the original
length and element type and copies values before changing any uniforms.
A refused update leaves the current list intact. Scalar day/state bindings
continue to use `params` and `setParam`.

### Declared hybrid entry configuration

`HybridRuntimePlugin.rows.boot` supplies world bounds, the initial player
pitch, admitted item contexts and a semantic input definition with binding
labels. The host installs these on the same scoped entry lifetime;
`hiddenMode` hides input verbs while that player mode is active. Bounds and
pitch must be finite. The declaration contains data; the host supplies the
visibility callbacks. Sky and Signal use this path.

Hybrid audio defaults to the shared declared combat router. Catalogue voice
ids and routing overrides select existing native sound recipes; a shard
does not need a custom dispatcher. Legacy custom dispatchers remain
supported through the optional `cues` binding.

### Camera-relative graph cards

The vertex-only `cameraRelativeBillboard` op takes three inputs: a world
`vec3` direction, a float distance, and card-local `vec2` coordinates. The
centre is camera position plus direction times distance; the card faces
back toward the camera with world-up orientation and a stable polar basis.
The result is an absolute model-space vertex for `vertex.position`.
Direction is used as supplied; normalize it in the graph for metre distance.
Card attributes or array rows can supply individual distances; ordinary
graph arithmetic applies size, angle and pulse before passing coordinates.
A zero direction gets a finite facing basis. No object origin is added.

`bindRuntimePersistence(ctx, source, rows, flags?, instance?)` binds a
declared reward state or flag, its read-only legacy boolean seed, an
optional encounter record and the projected ledger. `bindProgress` drains
all durable owners before the checkpoint completes. Sky and Signal
consume this binding; their rows select the existing keys and owners.

### Numeric graph textures

A texture param may declare `role: "data"` to retain numerical channel
values instead of applying sRGB decoding. The material client forwards
that role to the existing admitted texture resolver, which continues to
refuse mixed colour/data usage of one hash. Texture nodes already take
computed UV inputs. The SDK's `bakeRawColourTexture` accepts
`colourSpace: "linear"` for lossless single-level numerical KTX2; omission
retains sRGB. Original row orientation and filtering remain authored.


`HeldPlayback.root`, `part(id)` and `material(id)` require the admitted
private scene's group, object and standard material respectively. Missing
or incorrectly typed handles refuse before equipment installs. Sky's fan
and Signal's lash share these handles for gameplay and catalogue views;
callers no longer reconstruct a second model-binding object. The private
cord kernel and shader decorators remain caller-owned.

`defineShard(rows, bindings)` in the defining manifest module assembles
first-party discovery and boot metadata from data rows. `runtimeEntry`,
`poses` and `groundColour` replace entry getters, pose loader callbacks
and fixed colour callbacks. Native render, plugin, roster, GPU table and
terrain owners remain explicit bindings. Sky and Signal use the same
constructor; it copies mutable host arrays from readonly authored rows.

Private scene mesh rows accept optional `instances` (1–8192, at most
8192 per scene). The shared scene host allocates InstancedMesh storage;
existing channel connectors populate its bounded slots. Geometry and
material ownership remain with the existing scene ports.


### Trusted material graph ceilings

A `GraphIr.budget` declares `{ nodes, samplers, instructions }` for one
program. The default remains `DEFAULT_GRAPH_BUDGET`. Declared values are
positive integers bounded by `MAX_GRAPH_BUDGET` (4096 nodes, 16 samplers,
8192 estimated instructions); loop trips still contribute their full cost.
The existing JSON byte/depth and uniform-list limits also apply.

Format admission validates the declaration. Only an admitted trusted runtime
passes `trustedBudget: true` to graph validation/compilation through
`clientMaterials`' host-owned `trustedGraphs` option. Authored JSON cannot
set that authority. A declared graph that exceeds its own budget or lacks
host authority refuses; it never silently substitutes an emissive material.
Legacy graphs and the explicit graph-materials Debug choice retain their
existing family-preset behavior.

`prepareClientWorld(ctx, source, rows)` in `game/shardfile/runtimeProduct`
prepares up to 64 named painted textures in ordered phases (0–7), owns
them on the existing scope, and compiles the existing product materials.
Rows retain sampler settings and optional required material IDs; missing
required materials and an unloaded owner refuse. `painted` contains the
named texture handles, `material(id)` requires a compiled material, and
the existing graph/material bindings remain available on the result.
Sky world boot and Signal graph preparation consume the same binding.


`@wildshard/game/plugin/simulation` defines `readRuntimeWorldMetadata`
for generated native actor rows. Passing `true` as the second argument
requires the complete boss, interaction and crack-spot metadata as well.
The reader validates finite positions and nonnegative radii; collision
rows continue through `addBakedWorld` and native population keeps body
and behaviour ownership.

`verifiedScriptModules(assets, refs)` in `game/shardfile/scripts` reads
an admitted byte map or async asset reader, detaches each module, and
checks its SHA-256 identity before installation. Mover and melee roles
share this verifier; their existing ABI, memory, fuel and entity caps
remain in force. `createMeleeScriptDriver` accepts the same asset-reader
port, so a page can read verified product modules without its own copy
loop. Every restore still constructs its own role and uses one host.

### Declared held and authored tube curves

`compileTubeCurve(profile)` in format/clientChannels admits a bounded ring
profile and caches its coefficients. Its `write(positions, frame, time)`
updates an owned Float32 position lattice without frame allocations. The
client UI binds declared tubeCurve rows to the named private scene mesh.
SDK `clientSceneGlb(root, materialPorts, {curves})` may generate a named
mesh from up to 32 authored tube profiles, with optional closed caps and
local placement. All curves merge into that original mesh; absent options
keep the ordinary scene path. Signal's animated cord and Sky's baked tassel
use the same sampler.


`HybridRuntimeRows.boot.itemContexts` may name `'source'` to bind the
plugin's admitted item contexts in the existing play phase. The source
is required for that binding; absent rows retain the previous behaviour.
Discovery, encounter, completion and population values may all be authored
in the shard's data recipe, leaving its plugin only the native bindings.

`createHeldMelee(app, equipmentRow, phaseRows, scenePorts)` in
`@wildshard/game/plugin/weaponFamily` constructs the existing held-melee
owner directly. It admits item contacts, binds the HeldPlayback scene, and
borrows optional body-raycast and caught-scene ports. Signal and Sky use
this factory instead of private weapon subclasses; phases and contacts
keep their existing owners.

`bindClientChannels(...).bindPrompts` and `createClientChannelPrompt`
also accept `ClientPromptBindings`: a bounded named-action map, or
admitted socket-lift entryways with a deferred mover-runtime getter.
Unknown actions refuse before installation. Dispatch uses the existing
spot callback or paired lift/gate commands; a retired mover is inert.
The original function binding remains supported. Sky lift prompts and
Signal well prompts use these rows on their existing input owners.

### Static world scene recipes

`format/clientChannels.parseWorldScene` admits bounded private scene rows
with named baked-piece and model imports. `game/plugin/ui.createWorldScene`
uses the caller's real geometry, model and baked ports, returning its Group,
named parts and borrowed baked metadata in `baked`. Material collectors stay
owned ports. `game/shardfile/bakedKinds.worldPieces.scene` registers named
parts without reparenting them or applying placement transforms twice.

ModelLibrary `paintedModels` pairs named rest geometry with an existing
painted atlas and optional four-slot pivots. `painted(name)` clones geometry
for each owner and shares its atlas; `preload(pause)` retains preparation
yields. `model(name, fit)` validates a recipe's hero name before copying it.

`Entry(edge, kind?, bindings?)` accepts admitted portal or lift data in
its optional third argument. Its existing frame checks and link parsers
still refuse malformed or missing matching links. Omission retains the
ordinary entry output. Cloning detaches binding data with the normal
scene state; Sky's authoring recipe now uses the shared Entry directly.

`bindRuntimeMelee(ctx, source, ports)` in `@wildshard/game/plugin/headless`
resolves the declared primary weapon family and installs exactly the
created or adopted owner. Its normal loader retains contact/profile
admission, presentation, and actor-bound composed hooks. Signal and Sky
use this path instead of private item registry modules.

`bindPlayerImpulse(apply)` in `@wildshard/game/shardfile/dataCreaturePorts`
loans one reusable velocity vector to the real player impulse owner. Its
`directed(yaw, speed, lift)` projects a creature shove; `column(row, feet,
enabled)` admits a wind-column row and returns a fixed-step callback. The
caller retains phase and clock ownership. Columns keep strict side and upper
bounds, with no lower floor, and act only while the supplied mode is enabled.

Private scene mesh rows may carry bounded `matrices` for every declared
instance. Admission checks the full matrix count before allocation. The
host copies those rows to the native instance buffer and computes its
bound; optional `name` retains authored object names. `BakedMeshWorld.object`
resolves a named recipe piece and own-field primitive selector. An explicit
snapshot, including an empty one, always wins over the latest loaded bake.

`Entry(edge, kind?, bindings?)` accepts admitted portal or lift data in
its optional third argument. Its existing frame checks and link parsers
still refuse malformed or missing matching links. Omission retains the
ordinary entry output. Cloning detaches binding data with the normal
scene state; Sky's authoring recipe now uses the shared Entry directly.

`bindClientChannels(...).installMovers(ctx, world, source, row, flags,
assets, composition?)` installs the source's admitted movers through the existing
product reader and fixed-step owner. The authored row names a system and
bounded flag-bit grants. Its read-only `runtime` becomes null on disposal;
`updateMovers()` reads that owner, while an explicit pose reader still lends
external motion. No additional host or clock is created.

Declared action roles on `createShardfileComposedLane` use serializable
`id`, `sim`, `state`, `rules` and `events` rows in `extra.declarations`.
The session binds entity aliases and actor provenance separately. At most
128 roles join the same admitted module union and aggregate entity budget;
action roles have no query grants or scheduled bindings. Mover compositions
forward these declarations without creating another host or fixed clock.
`declaredItemScriptBindings` supplies actor-bound aliases, verified modules
and hook maps for both native equipment and the data client.

Native melee rows may declare held player input and its release action.
`installNativeMelee` samples a bounded admitted stream once per tick,
using the same ContactFamily.hold clock as page held weapons. A named
step preserves an existing hold save slot; an inline continuation field
is optional when reading older saves. Disabled input cancels quietly.
Signal replaces its timed command on release; Sky applies the held heavy
after its existing ordered commands. Original contact/AS owners remain.

The player impulse binding's `columns(routes, feet, enabled, register)`
selects admitted column modes and supplies callbacks under their declared
ids. It validates the bounded roster before registering any callback. The
caller supplies its existing fixed-step registration and player owner.

`bindQuestPageInteractions(source, ports)` in `@wildshard/game/plugin/ui`
consumes admitted `questHost.page` rows, validated with the format's
`QuestPageInteractionsSchema`. Native `InteractionRules` keep marks, flags and
ordered needs; borrowed label/visibility/command targets must resolve before
any effect. Accepted actions run before/after view beats around native flag
writes; denied reasons select declared hints. Initial conditions restore only
view state. Sky notes/winch and Signal logbook/well/crank share the binding.

The optional native melee `input` row maps player attacks, named script
aim/actions and quest-owned light/heavy world targets. `inputCommands` lends
the already-admitted tick stream; `worldActor` supplies the trusted quest
identity. The contact owner samples that stream once per tick, keeps command
order and the last pitch, and shares it with held release. Existing direct
`commands` callers remain supported when no mapping is declared.

`defineSceneModels(rows, builders)` extends the lazy model catalogue with
bounded named builder ports, visible owned parts and optional specimen
framing. A position creates a fresh outer group; `subtractY` reads a finite
owned builder anchor. Geometry, materials and effects remain on the actual
page/Explorer builder. Construction stays lazy and catalogue order is kept.

`flagValue(flags, terms)` in `@wildshard/engine/world/interact/flags` reads
at most 64 authored `{name, bit}` terms in their declared order. It sums
Boolean flags with bounded integer coefficients without allocation or state
writes. Director observations retain Boolean outputs; native and client
motion permissions retain their numeric grants.

`MoverScriptDriver.install` accepts an already composed lane or a declared
native composition (`content`, verified `assets`, `rules`, optional
`declarations`). Both use the existing role scheduler and restoration
adapters. `drive: true` advances that same host once per fixed tick;
`permissions` supplies copied trigger observations. Default ground
activation reads the native player motor; explicit activation ports remain
available. The installer creates no second clock or collision owner.

### Quest capture rows

`HybridRuntimePlugin.bindQuestCapture` preflights bounded named stages of
flag writes and borrowed gameplay callbacks. The inherited `stage(name)`
runs those same owners; unknown names do nothing. The rows do not add a
save cursor, bypass interaction rules or substitute a reconstructed world.

`HeldMeleeRecipe` declares equipment, phase, playback and private-scene rows,
optional borrowed attachment rows, rest/tip and caught-wrap bindings.
`createHeldPresentation(recipe, ports)` builds the same hierarchy for page
and Explorer. `createDeclaredHeldMelee(app, recipe, ports)` supplies it to the
existing held factory; targets/raycast, charge and shader/texture/geometry
resources remain owned ports. No recipe advances gameplay or installs actors.

`questNpcSpecimen(source, npcId, provider)` reads the model identity from
the admitted NPC figure. The provider still borrows the original mesh or
prepared pivots and material; an explicit model row remains supported.

### Borrowed quest view bindings

Optional `questHost.page.bindings` rows map labels, visibility, Boolean
observations and named calls to supplied owners and bounded property paths.
`bindQuestPageInteractions` checks every required binding before restoring
views. Calls retain the actual receiver; optional null owners keep their
existing absence policy. Explicit maps remain supported. Prototype and
traversal keys refuse. `readBorrowedOwner` in `plugin/headless` is the same
reader for other runtime ports; it returns the field, receiver and key.

The native melee `questWorld` port borrows an already-admitted quest host
and prompt spots. The existing contact owner resolves each crack row's
world target and quest actor before registering its step, refusing missing
spots. Original light/heavy crack outcomes remain on the timed contact
family; direct owned `world` targets remain supported.

`bindWorldSceneParts(scene, kinds, rows)` in `game/plugin/ui` binds named
native groups, meshes, point lights, materials and baked collider arrays.
Vector and scalar rows copy bounded authored anchors; scene parts remain
borrowed identities. `format/clientChannels.parseWorldSceneBindings` admits
the finite field rows. Missing parts or a mismatched typed contract refuse.
Plain `ClientScene` hierarchies need no baked metadata; collider bindings
still require an actual baked map and refuse when it is absent.

### Declared saved page quests

`HybridRuntimeRows.pageQuest` optionally declares saved quest presentation,
borrowed model/material/flag paths, resource dressing and capture actions.
`HybridRuntimePlugin.play` imports UI lazily, installs those rows before
the shard play hook, and exposes the resident `pageQuest`. Libraries stay
borrowed; prepared pivots, null model policy, reward coins and saved flags
keep their existing owners. The native headless installer is unchanged.

Held recipe `resources` lend named geometry/object/texture/decorator ports
through the defining `readBorrowedOwner` capability. Ordered bounded local
reads retain method receivers and JSON arguments. Optional missing heroes
stay absent; geometry copies/index reconstruction, exact byte-length checks
and literal texture repeats are declared explicitly. Sealed owner maps lend
only model/world-resource providers and private material decorators. The
resource binder never reads an authoritative actor or advances gameplay.

`prepareRuntimeWorld(shard, assets, baked, recipe)` prepares native
spawn/ground and collision intake on an existing `SimHost`. A recipe may
select admitted terrain or solid floor queries, and optional motion grants,
item roles and named quest observation/action bindings (64 per list).
Preparation verifies modules; `install(host, context)` registers the
original world pieces and the existing mover driver without another clock.
A recipe without motion creates no script host or item role.

`SpeciesLook.decorateMaterials` decorates existing per-instance materials
after the factory installs lighting. `bakedLook` accepts bounded optional
`materialEdits` rows (`id`, shader `edits`) and chains them at decorate order.
It preserves the original materials, maps, lighting and hit-flash ownership;
shared materials receive each look's edit once. Sky and Signal use this
existing baked creature catalogue. Omission retains the ordinary path.

Native world recipes also declare population metadata sources, seed policy
and the existing encounter owner. `prepareRuntimeWorld` takes the complete
baked world. `install(host, context)` retains collision, motion and population
order and returns ledger, keeper and encounter ports. The caller still owns
weapon/quest installation and final settling. Population admission and restore
continue through `prepareNativePopulation`; no second host or clock is added.

### Quest world reactions

Optional `questHost.page.world` rows describe borrowed contact points or
authored cone points, flag gates, contact phase, existing page actions and
accepted flag/toast effects. `bindQuestWorldReactions` supplies real
ContactWorldTargets and a cone scan using the engine contact-distance law.
Both page and native owners use the same bounded rows; marks and saved
flags remain with their existing rules. Required points/actions refuse
before restore effects.

Quest page `bindings.prompts` resolve bounded owner paths to actual prompt
callbacks and named actions before any saved view effect runs.
`questPagePrompt(label, position, radius)` supplies the unbound real
prompt; interacting before admitted binding refuses. Both worlds use
the same prompt factory and binding.

ClientMoverInstallation.itemRole optionally lends an admitted item role to
the existing client mover host. The installation verifies its module files
through the product asset reader and composes aliases on the same clock.
The scoped channel binding exposes that host item hooks and clears them on
disposal. Omission preserves ordinary channel/mover installation and
creates no item role. Existing extra declarations and schedules remain.

The HybridRuntimePlugin optional `melee` row installs an existing HeldMeleeRecipe
at its original `kit` or `equipment` stage. `targets` chooses the normal combat
scan or equipment raycast; borrowed owners, optional material decoration, a
stowed player mode and an inspection alias retain the actual one held instance.
Presentation loads only in the page world stage. `bindHeldScripts` completes
that instance with the admitted item hooks and clock from the existing composed
script host; it creates no second controller, actor, script host or timer.
Absent rows preserve subclasses' existing arm/armed/prepare hooks.

`HybridPageQuestRows.stages` and `bindBorrowedPageQuestStages` bind the
existing page director lane through bounded observation, action and
event owner paths. `HybridRuntimePlugin.bindPageStages(ctx, extraOwners)`
uses the resident saved flags at the original installation point.
Required fields preflight before quiet initial observations; no saved
cursor or replacement flag owner is introduced.

prepareRuntimePlan(shard, assets, baked, recipe) returns a complete native
runtime plan from paired world recipes. Runtime rows select weapon gating,
quest spot intake and director summons, world reactions, impulse columns
and optional terrain entry proofs. Original owner installers run in order:
world/motion, population, melee, quests, columns, then keeper settling.
The caller still owns the one SimHost and its tick input/effect boundary.

`BakedMeshWorld.geometry(piece, kind, {index, empty})` lends independent original
channels with explicit index preservation, array reconstruction or identity-index
removal. `placements(register, root, snapshot?)` mounts its declared piece and
collider rows; an explicit snapshot never falls back to a later load.

`HybridRuntimePlugin.keepClientChannels(ctx, channels)` retains a page's
actual channel binding once, and clears it when that page scope ends. Sky's
winch/lift views and Signal's well use the same protected `clientChannels`
owner. `bindClientChannels().dispose()` releases borrowed view and prompt
references; it does not dispose their caller-owned geometry or materials.
The hybrid module imports this renderer-facing contract only as a type.

Declared channel setup may lend bounded `initialPoses` to copied views
and existing `bindings` to the same mover pose publisher. An optional
`ClientMoverInstallation.viewSystemId` updates those views in the normal
page update phase; `socketLiftPrompts` binds admitted entry prompts after
the existing mover installation. There is no extra simulation clock.

`InteractionRules.fromDeclared(source, flags)` requires the admitted
quest host and creates its original transient marks over the supplied
durable owner. Both early world and default page bindings use it; no
second interaction table or continuation is created.

An optional `HybridRuntimeRows.clientMotion` installs its declared mover
row on the already retained page channels after `pageQuest` is restored,
before custom page installation. The protected `clientMotion` lends that
same owner to held hooks and commands, and clears on scope teardown.
Omission leaves a page's ordinary visual channels without a mover role.

HybridRuntimeRows.pageFight declares the existing held or spawned fight
ports, a boolean or bounded borrowed armed field, optional borrowed dress
method and optional stage binding after the fight. HybridRuntimePlugin
pageEntry supplies the resident player/quest context; bindPageFight calls
the existing UI fight owner at the shard original phase, with the same
flags, facts, coins, held controller and saved record. It creates no host
or clock, and never changes population installation order.

`geometry.modelCatalogue` also accepts SceneCatalogueRow metadata/framing and
`{ owners, builds?, source? }` ports. A `specimen: { kind: 'held', recipe }` row
uses the same HeldMeleeRecipe and sealed resources as the page weapon, created
only when its Explorer model builds. Original shown parts, framing and catalogue
order use the defining engine scene-model runner. The existing rig/body specimen
signature keeps its original builder; no model, preload or service is installed
by declaring either catalogue. Both held gear catalogues use this one row shape.

A ModelDef may declare an async `prepare` port. `live` retains that port and the
shared roster loader awaits preparations before listing any of its synchronous
specimens. Baked/scene catalogues accept the same optional preparation callback.
Held modelCatalogue rows memoize their dynamic renderer import behind that door;
declaring a catalogue in a cold generator never imports the UI or builds a model.
Models without prepare keep their original listing/build path.

Model libraries borrow compiled world looks through `bindLooks(scope,
ports)`, keeping the original material identities and mesh-map binder.
`look(id)` remains optional before preparation; `material(id)` requires
an admitted material. `mappedLook(id, map)` uses the compiled binder or
the authored `mappedFallback` roughness/metalness in a model viewer.
Sky world materials and Signal's fire book use these same library ports.
They borrow resources and release the look-book references with the scope.

NPC `SceneCatalogueRow.specimen` rows use the same model catalogue as
held scenes. `BorrowedNpcSpecimen` and `borrowedNpcSpecimen` borrow the
admitted figure, copied geometry and original material methods; a
bounded prepare path loads the original library before cold Explorer
builds. The page and Explorer share one copier admission path.

### Native equipment selection

`createNativeLoadout(row, ports)` in `game/plugin/simulation` owns a bounded
ordered set of numeric equipment slots. `row` declares `slots`, `initial`,
`lower` and `raise` seconds; zero timings select immediately. Borrowed
`owned(slot)` and `locked()` ports retain the caller's unlock and input laws.
The caller advances `step(dt, pick)` in its existing adapter and borrows
`snapshot`/`restore` for the original `{held, swap}` continuation; creating
the owner registers no clock. `select`, `held`, `swapping`, `owned` and `live`
serve both immediate melee kits and timed ranged kits.

`game/plugin/ui#createQuestPagePrompts` creates selected prompt frames from
admitted quest page rows. Rows declare labels, radii and bounded borrowed
position paths; the actual `Vector3` is retained. Every requested row and
position resolves before creation. Existing page action binding and save
restoration remain the owners of interaction and restored presentation.

`QuestPageInteractionPorts.interactables` optionally registers the actual
preflighted prompts in binding-row order, after restored presentation is
seeded. Invalid prompt objects refuse before the host list is changed.

`prepareClientWorld` accepts optional model-library ports as its fourth
argument. It lends the compiled look book at the return boundary, after
ordered paint/material preparation and bumps, before caller graph state
bindings. Sky and Signal use this same step; absent ports keep the original
preparation result with no library binding.

### Native posed-volume contacts

`nativeVolumeContact(origin, direction, limit, volumes, out)` in
`game/plugin/simulation` queries the caller's posed head sphere, body capsule
and optional fore capsule. A unit ray direction reports the nearest solid
hit and whether it hit the head; `null` reports the nearest skin point. It
refills caller-owned `out` (`distance`, `point`, `head`) without allocating
result objects. Actors, posed-volume lending, ordered target scans, damage,
cover and Rapier remain with their original owners.

The game/inventoryLaw NativeInventoryProfile declares native roster, slots,
count bounds, quantity checks and snapshot ordering. NativeInventory uses
the existing stacking/trade laws without owning persistence;
nativeInventorySchema admits the same counts/order save representation.
Profiles preserve historical numeric and complete-order policies. Restore
copies admitted state without pickups, flags, facts or writes.

`plugin/mover.proveTerrainEntries` also accepts a bounded optional `ramp`
profile: socket-to-deck run, height, per-edge half-widths, stride and look
ahead. It walks the real capsule through all four admitted water sockets,
following the flare and checking grounded support, lane, floor and stalls.
The default remains the ground-height walk. `engine/physics/terrain` defines
`isStandaloneEdgeWall` beside `addEdgeWalls` for grid admission of native
bakes without the standalone rim slabs. Neither API changes collision.

The game/achievements AchievementCounterRows declares matching, saturation,
fact prefixes and historical total/write policy. createAchievementCounters
uses AchievementCounterPorts read/write/emit on the existing saved owner;
kill/event/count emit newly reached identities, replay submits old saved
identities for the ledger's normal deduplication. No flags, rewards or save
slots are allocated by the counter.

### Renderer-free projectile slots

`ProjectileSlots<Data>` in `engine/combat/projectileFlight` owns bounded
flight slots (1–1024), first-free/oldest reuse, age, declared integration
substeps (1–64) and extent/floor/lifetime expiry. Borrowed data is combined
with position, velocity, active, age and glanced state. `take()` resets only
the mechanical slot state; the caller supplies launch vectors and its own
metadata. `step(dt)` invokes trusted integration, contact, advanced, moved
and expired ports in that order without allocating per-step result data.
Integration laws, damage, sticking, render meshes and tracers remain with
the original owners; the pool installs no physics or rendering service.

The engine/ai/huntPattern huntMemoryCodec copies live hunt memory to
SavedHuntMemory and restores real Vector3 path corners. Callers retain
schemas, snapshot versions and save ownership. Complete field/type
preflight or an authored historical subset precedes all mutation; the
codec never advances the brain, clock, RNG or body.


`createNativeTargetQueries<T>({pose?, fore?})` in
`@wildshard/game/plugin/simulation` owns reusable posed head/body/fore
volumes and result storage. `ray(bodies, origin, unitDirection, max)` visits
at most 512 bodies in original order, retaining alive/hidden, coarse range
and nearest-contact fences. `closest(body, origin, limit, out)` writes a
borrowed skin-contact result. The optional pose reader lends synchronized
hitboxes; `fore:false` keeps a head/body-only contact recipe. Both methods
reuse `nativeVolumeContact`; neither changes actor or physics state.

The existing `game/achievements` counter profile optionally declares bounded
`flags` totals (a flag, ordered flags, prefix count, or zero). Its `syncFlags`
borrows the live flags and submits through the existing event/count owner,
with optional one-shot suppression and a caller presentation callback. It
installs no clock, subscription or save owner.

`@wildshard/sdk/movers` defines `CableLayout` and `ZiplineDriver`: one
renderer-free cable/deck geometry and gravity/drag ride law used by Pine
and Driftwood. A bounded optional direct-anchor profile selects start,
release and landing values; absent profile keeps the deck ride law.
`step` can advance the caller's existing `{s,v}` state; `update` owns the
driver's original flat continuation. Both use the existing caller clock.
`ZiplineTrolley(cable, rest, object, prompt, riding, start)` owns the drawn
trolley's rest pose (`rest` metres down a `TrolleyCable`: a `CableLayout` or
driver, turned across its heading), its `follow(s)` roll along the wire and
the ride prompt hidden while riding. Pine's ZipRide and Driftwood's Zipline
use it; mesh, material, player and ride clock stay the caller's.


`engine/world/interact/flags.bindInteractionState` binds one validated kit
row to read-only automatic flags, ordered chest contents, visibility, lock
reason and prompt reach. Page callers lend current door animation and
cached visibility; native callers use static door state. Actions, physics
and durable writes remain in their existing owners.

`HybridResidentWorld` accepts optional motion rows: an admitted source,
system id and up to 32 borrowed group/chain bindings. Its existing load
installs motion for each entered scope, even when static geometry is cached.
`plugin/mover.installDeclaredMovers` borrows named constructed groups or
actual `RopeChain` instances, with an optional `refreshPose` presentation
hook. Render groups publish `userData.declaredMotion` to prevent a second
legacy update owner; mooring geometry stays with its original owner.

`runtime.binds: ['movers']` retains motion and its verified Wasm roots for
the trusted resident, stripping them from data-client installation. Native
chains are admitted only under that binding, where the resident supplies
the existing RopeChain and its restore owner; pure-data chains still refuse.

`engine/quest/dialogueClock.NpcDialogue` selects authored NPC lines, commits
flags only on completion and preflights old reading continuations before
mutation. It uses its native clock or the actual `DialogueBox.readingClock`
lent when a page talk opens; UI, key delay and save owners stay with callers.

`runtimeLookMaterials(...).setParam(materialId, paramName, value)` updates
a compiled graph's live uniform without rebuilding its material/program.
The declared scalar/vector shape, finite components and inclusive min/max
are checked before mutation; colours take three sRGB components. Unknown
catalogue/param names, texture params, fallback materials and disposed
scopes refuse. Borrowed mesh-map variants share their graph's uniforms.

`SkyBackdropContext.renderer` is the page renderer, read-only. A sky
backdrop compiles its own `look.materials` graphs before the world stage
with `lookGraphMaterials(scope, context, source, ids)` from
`@wildshard/game/plugin/shaderFamily`: it hands over its whole context,
the helper reads the renderer, and the shard's runtime never holds it for
that (the `raw-render` guard). The result carries the materials and the
same checked `setParam`; they leave with `scope`.

Material graph `dFdx(value)` and `dFdy(value)` preserve a numeric scalar
or vector type and run only in fragment, lighting, outline or post work.
Vertex use refuses before compilation. `cross(vec3, vec3)` returns vec3;
`normalize(cross(dFdx(positionWorld), dFdy(positionWorld)))` derives a
faceted surface normal without geometry or a content shader. Each op is
counted in the declared graph instruction budget.

Material graph `gerstner(restXZ, seconds, damping)` returns the engine
ocean's vec3 surface displacement. Its four fixed waves read the same
`engine/world/waves.GERSTNER_TERMS` as CPU `waveDisplace`; there is no
authored program, extra wave clock or CPU allocation per sample. Inputs
are vec2, float, float; use the result in vertex displacement or fragment
work. The graph admission charges 120 estimated instructions per call.

A material graph may set `model: 'toon'` to use the existing graph lit
path with the toon family's face/shadow bands, rim, lift, cloud shading
and caustics. `clientMaterials` supplies `look.familyLooks.toon` and its
existing family clock; `compileGraph({ ... }, { toon: existingToonLook })`
can borrow that owner directly. Authored surface and uniform names are
isolated from the family recipe. Faceted normals default on (override
with `flatShading:false`). Point/spot lights retain physical lighting.
An authored lighting stage instead uses `model:'standard'`.

`engine/ai/stalker.StalkerBrain.bindRoster` lends one bounded native hunt
cadence to an existing roster. `observe(dt)` updates its lent noise meter;
`decide()` checks sight loss and schedules decisions in roster order.
Combined mode requests one urgent tick; interrupt mode wakes before the
ordinary tick. `damaged(target, killed)` wakes hunt actors after a blow;
custom policies keep their own damage listeners. `wake(body)` also serves
external alarms. Caller noise/sight records, snapshot envelopes, clocks,
policy/charge/body phases and RNG streams remain with their owners.

`bindMeshMap(id, originalMaterial)` and model-library
`mappedLook(id, originalMaterial)` borrow the original colour/bump and
normal, roughness and AO maps for a compiled lit graph. Normal scale,
bump scale and AO intensity are copied; textures retain their sampler,
UV channel and owner. Equal graph/source loans share one scoped variant,
while different source materials remain separate. Graph roughness and
occlusion factors multiply the borrowed channels. Existing Texture-only
calls retain the colour-map path; graph uniforms stay shared on variants.

Material graph `fogColour` reads the current drawn scene's live linear
fog colour as vec3 (black when there is no fog). It is a uniform input
available to vertex, surface and post work; it adds no fog owner, clock
or colour conversion, and remains separate from the fog epilogue.

**Shard-declared fog graphs (O11).** A look catalogue entry may be a
`kind: 'fog'` graph: the shard's own fog as data, one stage
`stages.fog.colour` (vec3) in the `fog` place. Its inputs are `fogInput`
(the colour reaching the fog, after the output transform), `engineFogged`
(the engine fog's result for it), `fogScale` (the material's
`vertex.scale.fog`, else 1), `positionWorld` and `cameraPosition` (the
fog's frame), plus its params, lists, lent textures and the safe maths;
alpha passes through. A material graph selects it with
`effectState.fog: '<catalogue id>'` (`false` still bypasses fog). The
compiler builds the fog graph once (an inert carrier material keeps its
`setParam` / `setTexture` / `setLentParam` by catalogue id and its bound
params on the day feeds) and hands its patch to each selecting material
through `fogPatches.ownMaterialNodeFog`, so the engine epilogue runs it
instead of the engine fog, for the material and its outline hull. One
program per fog per compile (the program key carries it); a region's
`bindMaterialNodeFog` still overrides it while bound. The fog graph is
costed under its own budget and adds to each selecting program.
`materialGraphRules` refuses a selection that names no inline fog graph.
Users: Nalati's painted fog `nalati-fog` (the grass, water and puddles;
`look/fog.ts syncPaintedFog` writes the air and tint each frame) and Nine
Dragon's silk fog `nine-silk-fog` (the Well's mist sheets and the neon:
the sign atlas's `nine-neon`, the calligraphy's `nine-neon-board` and
additive `nine-neon-tube`, each passing its emitters' fog share as
`vertex.scale.fog`; `look/render.ts` writes the shared rows at every eye
write).

`engine/audio/interactSfx.InteractSfx.bindEvents(rows, ports)` preflights
bounded first-match kit-event presentation. Selectors match event types,
definition kind/look and flag prefix. Ordered effects call a named lent
callback, toast event text, play a procedural interaction sound or give
an item through the actual inventory port. Unknown effects, excessive
rows and unbound callback/inventory owners refuse before any effect.
Rows own no flags, quest decisions or saved state; omitted event types
do nothing. Existing `interact()` callers keep their current behaviour.

Material graph `stages['vertex.normal']:{normal: vec3Ref}` replaces the
object-space normal before its ordinary view/world transform and lighting
interpolation. The existing vertex position remains independent. Mesh
normal output rejects fragment-only ops and point primitives; it installs
no geometry builder and changes no CPU attributes or collider state.

Graph materials may declare `stages['vertex.clip'].position` as a vec4
raw homogeneous clip-space output. It becomes gl_Position directly,
without model/view/projection transforms. It excludes vertex.position
and vertex.offset. Vertex-only admission still refuses derivatives; CPU
geometry, bounds and colliders remain the authored rest geometry.

Graph materials accept `stages['vertex.scale']` with optional float
`sun` and `fog` outputs. Each evaluates per vertex, clamps to 0..1 and
interpolates across the surface. Sun attenuates directional diffuse and
specular (including toon/custom lighting); local lights and ambient stay
unchanged. Fog attenuates the engine scene and weather fog blends. An
unlit graph refuses sun. Omitted factors retain the existing shader path.

Boot filePolicy interprets bounded `BootFileRecipes` through resolveBootFiles
and resolveBootSources. Named rows select explicit tier URLs, public prefixes,
PBR/GLTF inventories, GPU table prefixes or supplied image-page inventories;
concat preserves ordering. Optional unique, layer/GPU transforms, public-file
filtering, exclusions and admitted alias maps apply in that order. Page rows
require KTX2 stand-ins in that mode. Named references refuse cycles, depth 16,
256 visits or over 4096 files. No recipe performs IO or owns another boot.


Declared score lifecycle: `audio.music.lifecycle` selects resident reuse,
disposal, scene/phase logging and a delayed sting on the next non-excluded
deck. Saved Debug picks are read by a borrowed `pin` callback;
`CatalogueScore.get` and `CatalogueScore.install` keep the existing bank
and entered scope.

`engine/quest/view.PlaceGuide(profile, ports)` shares bounded place-guidance
selection and cadence. Profiles use centre/edge distance and periodic or
idle/progress schedules. It borrows the journal, clock, random source and
flight callback. Periodic delays are sampled before eligibility/flight;
idle guides retain progress, retry and cooldown order. `target()` retains
the authored point identity; `attempt()` does not change schedule state.
There is no save owner, flight/pose code or random generator in the controller.
Malformed profiles, invalid points/steps/clocks and missing periodic ports refuse.

The node handler pairs compiled programs and selects their original uniforms
on the first draw, even when renderer.compile selected a program without a
program-switch callback. A material shared by a main/composer scene and a
PMREM scene retains every program's own uniform blocks and sampler list.
Actual material disposal releases them; environment refresh does not.

The stock node model-world matrix uses the classic renderer's `modelMatrix`
uniform. Custom, high-precision and normal-matrix inputs retain their original
nodes and blocks. Consecutive graph draws retain indexed UBO bindings until a
classic draw, render boundary or disposal displaces them; live values still
upload when changed, including callback edits inside a render.

Model-library `geometry(name, { borrow: true })` lends its cached rest primitive. The default remains an independent owned clone. Borrowers must never transform, recolour, replace attributes or dispose the immutable geometry; bake all geometry transforms before admission. Held crossbow and fallback sword meshes use this door without retaining a second backing.

`clientMaterials` and `runtimeLookMaterials` return `toon`, the live
`ToonLook` shared by their classic toon and graph toon materials. A
shard's day clock calls `looks.toon.set(partialLook)` to update bands,
lift, rim, cloud shade and caustics without rebuilding shaders. The
catalogue's existing `tick(dt)` advances its cloud/caustic time once.
The SDK author route is `graph({ model: 'toon', surface: ... })` from
`@wildshard/sdk/materials`: the compiler supplies the existing toon
lighting preset, so shards need no engine preset import. An authored
lighting stage uses `model:'standard'` instead.

A trusted look may supply `FogModel.node(out, context)` alongside its
existing classic `install()`. It replaces fog in graph materials at
the engine epilogue, after the output colour transform; classic chunks
and uniforms are unchanged. The last installed fog replacement wins,
matching classic chunk writes. `context.engine` is the engine-fogged
colour if the replacement needs it; `context.fog` is the live scene fog,
`position`/`camera` are in the level frame, and optional `scale` is the
graph's interpolated fog share. Return RGBA, preserving alpha.
The page registry forwards the node hook once; `scopeLookChunks` lends
a region's hook and origin to its own materials and restores them on
unload. A region without a node hook retains engine fog. No shader text
is parsed and importing the registry does not load the graph backend.

`Audio.windBed(ambience, scope?)` constructs the declared fallback wind and
registers it when a scope is supplied. Its `zone()` handoff stops that fallback
once the declared spatial mix takes over, while sampled beds keep their
existing precedence.

`engine/quest/dialogueClock.NpcReading(npc, flags, at, radius, keyDelay?, clock?)`
shares the NPC reading's use delay and feet-to-head walk-away rule. With
an owned clock, `use()` and `step(dt, feet)` drive the existing `NpcDialogue`;
`snapshot()` / `prepareRestore()` keep its old `{dialogue, elapsed}` envelope.
Restore preflights the NPC, open entry and delay before any field or flag
changes. A page lends its actual `DialogueClock` lazily, uses `select()` /
`finish()` and `outside(feet)`, and retains its own input and type-out timer.
Driving or restoring a lent page clock refuses; no second timer/save owner
is created. Positions, radius, delay and native step are bounded/finite.
`DialoguePoint` is the borrowed world point read by this session.

Audio `voiceBindings` loans explicit native methods to cue routing. Each
binding declares its owner, method, argument fields and optional refusal
conditions; bounded options keep the caller's point and direction references.
Supply the actual owners to `createCueRouter` alongside those bindings.

### Native interaction transitions

`engine/world/interact/flags.ts` defines `InteractionTransitionPorts`,
`InteractionTransitions` and `bindInteractionTransitions`. A preflighted,
bounded table borrows graph-run, item-grant, touch and plate callbacks.
Transitions preserve ordered automatic/explicit flags, physical door toggles,
chest grants, plate release, walk-in pickups and latched doors. The caller keeps
reach, sight, physics phases and its existing save owner. Direct touch grants
and graph touch actions are explicit policies; no new clock or save is created.

### Authored quest notices

`engine/quest/core.ts` defines `QuestMessageRows`, `QuestMessagePorts` and
`questMessageHandlers`. Bounded notice prefixes and an optional first-step id
produce existing quest text; transition order is toast, sting, borrowed beat.
`game/plugin/ui.ts`'s `QuestPresentationOptions.messages` consumes these rows.
Its optional `afterStep` preserves caller-owned dawn/stage timing. No quest,
flag or save is created by the message handlers; existing options are unchanged.

The graph `toon` model excludes environment diffuse, matching the classic
toon family's shade band. Its physical environment specular remains;
compilation restores the lighting context after substituting zero IBL
irradiance for that calculation. Standard graphs, including authored
lighting stages, retain their existing physical environment lighting.


`engine/render/viewmodelFeel.RangedFrame` owns a ranged view's ADS/FOV, camera recoil recovery and heading spring. Supply explicit `clock` (`frame` or `world`), `fovWhen` (`always` or `active`), recoil/lag coefficients and post-step clamping. The original `viewmodel.step` keeps its world-scaled default; an optional fourth time-scale argument permits an already-scaled frame without multiplying it twice. `shot(kick)` runs at the weapon's original shot phase; `sampleFrame` runs after its action/flash phases, returns ADS, and precedes its held pose. Camera/heading/frustum ports are borrowed; the owner never advances reloads, flight or contacts.
`RangedFrame.presentEffects` advances the borrowed puff pool after pose/contact work, samples the drawing-buffer size once and paints a bounded (≤128) tracer roster through an owned callback. Style/material/contact ownership remains with the existing effect objects.

`FogModel.node` also accepts `{ colourRamp: { start, end, near, zenith } }`.
Each field borrows a live `{ value }` uniform: metre distances and linear
`Color` values. The engine combines the distance ramp, height contrast,
zenith tint and sun scattering with integrated height/distance fog; dense
underwater fog wins. Day-clock changes and map suspension update the same
uniforms without rebuilding shaders. It uses the level frame and optional
vertex fog scale from the existing node-fog context. Classic fog installs
and callback replacements keep their current path.

`engine/world/Atmosphere.ColourRampFog` owns one such ramp for both
paths: `new ColourRampFog({ start, end, near, zenith })` (metres, linear
RGB) holds the live uniforms, `model(order)` is the look's `fog` (the
engine fog chunk compiled with the ramp term for classic materials, the
`{ colourRamp }` node for graphs) and `control` its `fogControl`.

Graphs expose fragment-only `frontFacing` (bool), also accepted as the TSL
builtin by the SDK author. `texture` now samples in vertex stages too: the
compiler uses explicit mip zero there and preserves derivative-selected
fragment sampling. Admitted texture roles and runtime `role: 'lent'`
slots share this path; retargeting a lent slot still updates every sample
without rebuilding the shader. Texture limits/accounting remain unchanged.

Quest figure installation (`game/plugin/ui`, `installNpcTalk`) accepts bounded
`NpcInstallationRow` policies and borrowed `NpcInstallationPorts`. It keeps the
existing figure, box collider, prompt and `NpcTalk`/DialogueBox clock. Authored
figure-first/talk-first frame order, greeting hysteresis, optional one-time
approach and weapon stow run at the caller's original update phase. Rows refuse
invalid reach, source escapes or missing greeting owners before construction;
entry ownership and save/flag authorities remain with the caller.

A numeric `varying` node accepts `interpolation: 'flat'`. The vertex and
fragment declarations use matching flat qualifiers, so every fragment
reads the primitive's provoking vertex value with no geometry duplication.
Absent interpolation preserves ordinary perspective interpolation. The
SDK retains `varying(value).setInterpolation('flat')`; other interpolation
modes/sampling modifiers and interpolation fields on other ops refuse.

`game/plugin/geometry.posedAssets` reads bounded named fitted geometry and
borrows its atlas from a declared model through the original tier/GPU path.
The SDK bake writes phone UVs separately. Pivots and Uint8 vertex-part ids
are authored; missing assets or incompatible channels refuse. The caller
copies frames into its existing posed draw, then releases intake references.

`engine/render/viewmodelFeel.RangedTrace` consumes a bounded segment/trail row
(points 2..2048, width/color/order and source-clock lifetime/fade). Segment
`show(from,to,time)` keeps the original straight positions upload; trail
`begin/addPoint/finish` keeps the preallocated dynamic segment buffer. Optional
impact marker geometry/material ports are borrowed, with original facing,
distance scale and expiry. `publish(time,camera,resolution,life?)` runs at the
existing after-pose phase, retaining a caller's live segment-life knob. Pool
sizes remain caller-owned; no shader, physics or damage owner changes.

Graph wind inputs `windTime`, `windGust` and `windDirection` borrow the
engine's existing wind owner. `windGustAt(worldXZ)` samples its gust front
on mesh vertices or fragments. The SDK exposes the inputs and the same
authoring op. CPU sampling and graph nodes use one renderer-free gust
front kernel through typed arithmetic adapters; no new clock or update
system is installed. Its bounded arithmetic counts in the graph budget.

Interactable rest sites can be admitted by `readInteractPlacements` and bound
with `bindInteractPlacements` (`engine/world/interact/types`). The original
ordered table keeps its flags, conditions, contents, labels and models; only
world-space rest points/yaw come from bounded authored rows. Missing, duplicate,
foreign, non-finite or mismatched sites refuse before construction. The optional
second argument of `Interactables.build` applies the same binder; absent keeps
the existing placement resolver. Moving keys, barrels and native body/save
ownership remain with their original runtime owners.

`plateOverlap` in `engine/world/interact/barrel` shares the renderer-free
pressure-plate slab query between the drawn kit and native quests. Its default
inset/depth are 0.1 m and it sees player/item bodies; optional dimensions,
collision groups and an owner predicate preserve the caller's plate policy.
It reads current physics without installing a body, clock or state owner.


Client numeric presentation loans: `createClientChannels(program).bindNumeric(rows,
targets)` binds up to 32 copied outputs to explicit one- or two-field visual
paths. Scene objects accept only position, rotation and scale axes; plain
visual uniforms accept numeric fields. Prototype paths and authoritative
actor classes refuse. `apply(frame)` writes the evaluated numbers;
`capture()` returns a restore callback for rows marked `restore`. No clock,
body, scene object or state grant is created. Pine weather and Signal well
transforms use this binding.

Pine's former ambient-life runtime is deleted. `sdk/looks/pageLife` owns
its client presentation alongside Driftwood's actual gull draw. Forest rules
live in `behaviour/life.as`; model, flock, forager and timed-tool rows are
emitted as `actors/page-life.json`. The real journal, sound bank, actor
manager and reward reservation retain ownership.

`engine/ai/ambientFlight.CirclingFlyer` is the reusable circling-flyer law.
Its bounded tuning controls vertical waves, pitch and bank; `step` borrows
the caller's phase/radius/home and `face` reuses its existing pose channels.
Nalati's W3 valley raptors are the documented pending user.

CirclingFlyer also accepts an optional bounded harmonic wheel row. Its `wheel`
samples the caller's actual flock/time/body into a borrowed point; `face` accepts
the native transition's bank gain. The ambient-flock host's wheeling flyers (Driftwood's gulls) lend their poses
and clock. No new
clock, body roster, wing draw or RNG is allocated by the circling law.

CirclingFlyer accepts optional bounded wingbeat rows as its third argument.
`burst(state, dt, flap, fold, id, rng, gliding?)` advances the caller's existing
phase/burst/glide fields and returns a borrowed two-channel pose. Rows declare
phase factors, flap/fold gain, rest/rates and glide/beat ranges. Equal bounds
use the fixed value without drawing RNG; disabling glide also draws none.
Pine's raven/owl/woodpecker and Driftwood's gulls use the same law, retaining
native clocks, seeded streams, body ownership and material/shader posing.

### Ambient flocks (G466 H6)

`@wildshard/sdk/looks/ambientFlock` is the ambient-flock host: one row
(`@wildshard/format/ambientLife#AmbientFlockSchema`) drives a flock's
perched, wheeling, flushed and guiding flyers, and the platform owns the
frame. `createAmbientFlock(row, look, perches)` validates the row and
builds one `PosedInstances` draw of the look (`name`, authored `geometry`,
posed `material`); `installAmbientFlock(ctx, draw, player)` ticks it in the
row's `system` slot; `draw.guide(player, tx, tz)` flies the row's
`formation` past the player toward a place (a `PlaceGuide` fly).

The row carries the seed and count, the scale and foot height, the flight
and wingbeat rows of `CirclingFlyer`, `wheeling` (centre, radius, loop
offsets and ranges, harmonic wheel, perch-after time; `null` keeps idle birds
hidden), `perch` (share perched, flush radius, hop, head turns, takeoff and
landing curves), `guide` (speed, borrow distance, start / pass / end offsets
in the player's frame, formation slots, stagger, leader call fraction, and
`after`: back into a loop, or `null` hidden), `call` (a cue id played with
`app.audio.cue(id, { point })`) and `channels` / `attributes`: how each
bird's pose (`flap`, `fold`, `head`, `legs` or a constant) packs into the
look's per-instance vec4s. Perches are plain points. No callback crosses it
(G454). The motion is `engine/ai/ambientFlock.AmbientFlock`: render-free,
seeded, server-safe.

Users: Driftwood's gulls (`custom/gullFlock`, data/gullsLook.ts GULL_FLOCK,
perched on the pier, boat, rocks and sand) and Pine Hollow's breadcrumb
ravens (`custom/ambientLife` `guide.flock`, hidden until a guide pass).

`@wildshard/game/ambient/flock#AmbientGroup` admits the same flock rows plus
`AmbientPerchesSchema` numeric sites (bounded to 4,096, with optional bark
radius `r` and selection weight `w`). Driftwood's gulls, Pine's guide ravens,
scavengers, night sentinels and trunk foragers all use this render-free game
host. `birds` and `calls` lend current pose and cue buffers; `update(dt,
viewer)` reads numeric position, sprint, night light, forward and optional
heading. No shard function, port or reflected owner enters the host.
Optional `when.light` and named numeric `when.weather` ranges park inactive
presentation groups: no poses or calls, no clock advance, no reseeding on
resume. A missing weather observation refuses that gate. These are view
gates; authoritative actor spawn/retire decisions remain ABI v1 commands.

`scavenge` rows describe arrival, circle, land, peck, hop, flush, return and
departure motion; `gather(x,z,width,count)` borrows hidden birds, `siteVisit(id)`
reads the visit and `release(id,viewer)` sends them away. `visit` rows select
weighted nearby perches, gate arrivals and departures on light, face or cling
to a perch, animate calls and flee when approached. `visitAt` / `visitSoon`
retain capture controls. Seeds, perch-shuffle draws and all motion equations
are preserved. The existing engine owns wheel/guide flight and the SDK owns
one instanced posed draw; Pine keeps its shared wildlife draw.

Carcass selection, harvest rewards, guide discovery and story remain shard
rules and count as custom until their script migration. H6 adds no shard
callbacks or decision guest; arbitrary shard decisions use ABI v1 scripts.
`test/ambient-flock-host.test.ts` checks counts, flee and night gates plus
18,000 pose/call frames against a pinned pre-migration shipping trace.

### Ambient foragers (G466 H6)

`@wildshard/engine/ai/ambientForager` is the ground sibling of the flock:
small render-free animals that feed, keep watch and bolt, from one row
(`@wildshard/format/ambientLife#ForagerPolicySchema`). The caller owns the
population, its placement, band clocks, save and draw; it makes each state
with `foragerState(x, z, yaw, homeX, homeZ)` and calls
`forager.step(state, motion, dt, player, fast, crouched)` once a scheduled
tick. `motion` gets the hop lift (add the ground height), hind / fore leg
swing and body pitch; the state's `sit` (up on the hind legs) and `sink`
(down the burrow) drive the pose. `step` returns true when a sentry raised
the alarm; `forager.bolt(state, player)` then sends the rest running.

The row holds the scare radii (`scare` walking / fast, `crouched`), the
alert margins and pauses, `grazing` (`gait: 'hop'` turns and short hops,
or `gait: 'walk'` a shuffle to points near home), `escape` (`to: 'away'`
zig-zag bounds for `distance` metres, or `to: 'home'` a run home, hidden for
`hide` seconds, peeking up once the player is `emerge` away), `sentry`
(chance, duration, sight multiplier, `alarm`), `posture` rows per mode and
`ground` (where a forager may step: chunk margin, height above water, pond
and cabin mask ceilings, creeks, slope, trunk clearance; `null` anywhere).
The constructor takes the row, the caller's seeded `Rng` and the planted
trees (data); `canStep(x, z)` answers the `ground` rule. No callback
crosses it (G454).

`ForagerPopulation` owns a whole population from one
`ForagerPopulationSchema` row (`id`, `count` bound, `policy`, `place`):
the rows and their motion, the fx band clocks (ids `<id>:<n>`) and a
private `Rng` from the caller's seed. `place.kind: 'colonies'` seats
`size` foragers round each burrow site (`colonies(sites)`); `'roam'`
seats `count` round the viewer (`roam(viewer)`) and re-seats any that
leave `range` (or `visibleRange` while behind the view) on the `reseat`
ring, out of sight. `update(dt, viewer, fast, crouched)` steps the due
rows (`due[i]`), marks the drawable ones (`shown[i]`) and returns the
sentry that raised the alarm (every awake row then bolts) or null; the
caller draws from `rows` and `motion`. `snapshot()` / `restore()` save it
as `@wildshard/format/ambientLife#ForagerContinuation` (row keys `x z bx bz
yaw stand sink state t tx tz`, the Rng and the clocks).

Users: Pine Hollow's hares (`custom/ambientLife` `forager`: hop, away,
roaming) and Nalati's marmot colonies (`creatures/marmotForager.json`:
walk, home, sentries that whistle, colonies, saved in the bake and the
headless state).

### Water surfaces (G466 H7)

`@wildshard/sdk/looks/waterSurface` is the water-surface host: one water body
drawn on a look.materials graph from a row
(`@wildshard/format/water#WaterSurfaceSchema`). `new WaterSurface(row, look)`
validates the row; `look` is the compiled graph (`material`, plus `param` /
`texture` writers for a row that feeds params or a floor;
`waterSurfaceLook(runtimeLookMaterials(...), id)` makes one).
`draw(geometry, { level, floor, dry, params, lent })` draws the baked grid at
its level; `foamAround(boxes)` stamps foam rings round every collider box that
pierces the surface; `update(dt)` feeds the bound params once a frame.

The row names the graph (`look`), the mesh `name`, `renderOrder`, `culled`
and `waves` (the engine's `waveClock` follows this surface's clock, so boats
and swimmers ride the drawn swell), `bind` (the graph params the host
writes: `clock`, `waterHalf` from `waterExtent`, and at draw `chunkHalf`),
static `params`, an optional `floor` (a
`res`² RG half-float texture over the chunk: R = the baked floor height,
G = the foam proximity, reach `foamReach` m, for boxes within `foamBand` m of
the level) and `dry` sockets (`prefix` + index, `slots`, the empty rectangle
`none`). A draw adds what only the run knows: the level, the baked floor's
heights, dry rectangles, params and `lent` uniforms (read each frame into
the named params). No callback crosses it (G454).

Users: Driftwood's faceted sea (`custom/oceanSurface`: data/oceanLook.ts
OCEAN_SURFACE and the baked grid and floor, data/oceanFiles.ts; grid, floor,
foam, four dry sockets, waves) and Pine Hollow's creek and waterfall, beaver
pool, dam trickle and rain puddles (data/waterLook.ts WATER_SURFACES).

`bindDirectorActions(...).validate(saved)` checks the installed immutable
stage contract and cursor without mutating its lane or calling native ports.
Use it before an aggregate encounter restore applies any body effects.

### Graph shadow depth

Set `shadow: true` on `vertex.offset` or `vertex.position` to cast with the
graph's object-space displacement, surface alpha cutoff and discard mask.
The existing node handler caches one depth variant per material, including
clones, borrows its live parameters and mapped textures, and uses the actual
shadow camera without advancing the clock. Explicit custom depth/distance
materials remain authoritative. Clip-position plus matching shadow is refused:
a camera-space position cannot be reused in another camera. Absent/false keeps
the existing stock shadow path. The variant leaves with its source material.

`RangedFrame.bindInputs` installs the original scoped ranged actions and lock/context
refusal. `scanAim` uses declared held policy, cadence mask and wall-capped reach;
its scratch vectors and posed model are borrowed. `RangedFlash` builds the original
two quads from transform rows, borrows the pooled light/muzzle/profile, and owns
only their fire/fade clock. It preserves four cosmetic RNG draws and caller phases.
`engine/combat/Firearm.RangedReload` supplies quiver/magazine begin/progress/finish
through the existing state envelope; callbacks keep the weapon receiver. Progress
uses the explicit duration/scale; transfer and completion keep the original ammo
and reserve rules. Per-round/cycle policies use `RangedAction.Cycle` below.

### Quest view lifetimes

`@wildshard/game/plugin/ui#QuestViews` borrows a shard context's existing
scope. `view(name, create)` returns the current widget getter; names are
bounded and unique, and a retained home recreates its widgets on entry.
The getter refuses after leaving that home. `enter`, `leave`, `timeout`,
`cancelTimer`, `retainRoot`, and `exposeBrowser` use the same entered owner.
`disposeLegacy` keeps the ordinary resident teardown order. Quest flags,
saves, NPC figures and the lent DialogueBox reading clock keep their owners.

`QuestViews.panelHold` binds existing modal views to the borrowed HUD, weapons
and menu. It releases pointer lock and uses the entered 450 ms pause timer;
callers retain their stow/resume, menu-close and other-open-panel policies.
No panel content, durable state or reading clock is created by the binding.

### Foliage graph normals

A mesh graph may set `flipBackfaceNormals: false` to retain its front-face
normal and tangent basis when both sides draw. The same borrowed normal/bump
map path and authored vertex normals still feed lighting. This is independent
of `doubleSided`: the draw's side/culling stays unchanged, and clones retain
the option. Absent/true keeps the existing back-face flip. Derivative-built
flat geometry normals retain their existing winding behavior.

`RangedFrame.publishHitscan` uses the defining hitscan solver, then preserves
hit callbacks, tracer publication and impact callbacks in that order. The
weapon supplies its live profile/bloom, source time, muzzle row and borrowed
trace/puff roster and scratch vectors; it does not advance weapon phases.
`combat/view/brass.brassRoster` allocates a bounded original case roster from
borrowed geometry/material. `ejectBrass` consumes a `BrassEjectionRow` with
ordered camera-axis velocity, spin coefficients, rotation and floor offset;
six cosmetic RNG draws and the live floor query stay in their original order.
Vectors/quaternion are borrowed, with no additional effect buffer backing.

### Gerstner graph normals

`gerstnerNormal(restXZ, clock, damping)` takes vec2/float/float and returns
a unit, upward wave normal. Its analytic tangents use `GERSTNER_TERMS`,
the same coefficients as CPU `waveDisplace` and graph `gerstner`. Evaluate
it at the rest point, not the displaced position; damping zero is flat.
It costs 200 estimated instructions and adds no clock or sampler.

### Live graph atmosphere inputs

`graphInputs.atmosphereSunDirection` and `atmosphereSunColour` expose the
existing IR inputs: live `fogSunDir` and linear `fogSunColor` references
from the atmosphere/day owner. `fogColour` reads the scene fog colour.
`fogZenithColour` reads the active material/page FogModel.node colour-ramp
zenith; without a ramp it reads scene fog colour, and without fog it is
black. All are vec3 inputs; none installs a clock or owns a new uniform.

### Toon graph caustics

A `model: 'toon'` graph may set `toonCaustics: false` to omit its underwater
caustic term, for example on the water surface itself. It keeps the same
shared ToonLook bands, clock and other lighting; other materials and the
shared water-level/strength uniforms are unchanged. Absent/true follows
the existing family caustics. Other lighting models refuse this option.

### Full graph instance transform

`instanceTransform(vec4)` returns the renderer-bound instance matrix times
the vector in vertex stages. `w=1` places points, `w=0` rotates/scales
directions, and ordinary meshes use identity. It reads the existing raw
instanceMatrix attribute, allocating no matrix copies or new buffers.
Apply placement once: `positionLocal` already includes instancing. A
`vertex.position` output should transform `vec4(positionGeometry, 1)`;
transforming positionLocal again applies placement twice.

### Graph shadow receiver shift

`shadow: { offset }` in the SDK (`stages['shadow.offset']` in the IR)
adds a world-space vec3 to the receiver's shadow lookup position. For a
sun shift, use the live atmosphereSunDirection times an admitted distance
param. This output is charged by the existing graph budget and is limited
to lit meshes. It leaves vertex placement, visible geometry and caster
depth unchanged; clones retain it and parameter updates need no rebuild.
Absent keeps the normal lookup. It is separate from vertex shadow:true.

`physics/bodies.DynamicBodySlots<T>` is the bounded slot/lifecycle owner for
existing dynamic bodies: ordered reuse, source identity, age/rest clocks,
optional flight landing and the exact native handle continuation. Rows choose
Float32 versus numeric clocks and strict versus inclusive retirement. Ports
borrow the existing Bodies service, original collider recipe and contact,
landing/removal callbacks; caller-owned fixed phases and pose scratch remain
unchanged. Tossed Drop and native/page volleys use the same owner. Restore
loads counters before reattaching saved Rapier handles after world replacement.
The optional contact port also borrows the current step's player pose (or
null). A specialized volley may extend this owner directly and keep only its
launch/contact policy, inheriting disposal and native continuation unchanged.

`physics/bodies.RowBodySlots` is the data-only ball-body binding used by
creature volleys and pickup drops. `format/bodySlots.BodySlotsSchema` admits
slot bounds, retirement/landing coefficients, body material and radius,
optional capsule contact/rebound, spin ranges, sea float and floor settlement.
The constructor takes those rows and concrete Bodies/Physics/SimHost services.
It accepts no content callbacks. Contact and landing observations drain once
in slot order; rendering reads its retained pose table. `throw` consumes the
existing Rng's phase and angular draws only when the body service exists.
Snapshots retain the historical slot/handle/source-index wire. `restore`
loads counters silently; `bind` adopts saved handles after physics restore.
Page float reads the installed terrain/water services; native float reads
the simulation ground and clock. `Drop` uses the same owner with settlement
rows, including immediate settlement if the physics cap removes its body.

### Graph shadow-depth warm-up (E435)

A graph material that moves its vertices (`graphShadowDepth`) draws its
shadow casters with the node handler's own depth variant
(`EngineNodesHandler.shadowDepthOf`), swapped in inside the shadow
draw. The handler registers that substitution on its renderer
(`render/shadowDepthVariants.ts`), and precompile's `shadowJobs` compile
the same configured variant, one job per source material, configured
just before its compile (`CompileJob.prepare`), so the first shadow
draw finds its program issued and linked (sp-o289: Pine Hollow's road
entry built and queried them inside 107-164 ms travel frames).
`test/precompile-variants.test.ts`.

### Conditional quest page prompts

`createQuestPagePrompts` and `bindQuestPageInteractions` accept admitted
shard page content or parsed standalone presentation rows. Standalone
interaction actions must resolve against lent `rules` or `interactions`;
missing native rows still refuse. `promptIds` constructs prompts for the
reserved `prompts` owner; `prompt(id)` returns the actual registered object.
Prompt `when` and ordered `labels` borrow flags and bounded Boolean
observations. Borrowed call arguments use the existing safe owner/path
reader. An optional bounded `delay` borrows `timer.timeout`; no new clock
is installed. Keyed `refused` effects follow their original denial toast.
All paths, arguments and effects resolve before registration or writes.

### Native hunting keepers

`createNativeHunt(host, row, ports)` binds the existing body bands and
StalkerBrain to the host's navigation, reach queries and creature blows.
`huntRosterContinuation` shares clock/noise/sight/memory/herd continuation
with authored roster bounds and optional historical memory fields; shard
adapters retain their existing versioned wire fields and policy state.
`orderedNativeReinstall` restores actor registration order before/after
the keeper step and returns an idempotent settle callback for later spawns.
No helper creates a second simulation or random stream.

### Quest placement floors and anchors

`engine/world/interact/types.createQuestPlacements` borrows terrain,
platforms, registry floors and authored POI frames. `registryReach` is a
strict maximum rise above the already selected floor; omission preserves
unbounded higher-floor selection. The returned `place` respects explicit
height and local yaw. `setAnchor` lends a bounded world anchor that takes
precedence over a model anchor and ignores `dy`; a model anchor without
height uses the selected floor plus `dy`. Borrowed models/floors remain
live. Malformed coordinates, unsafe anchor paths and absent local frames
refuse before the caller registers a prompt or piece. It owns no save.

Private-scene standard material properties also admit the original material
`name` and bounded nonnegative `envMapIntensity` (up to 32). The existing
scene assembler passes them to MeshStandardMaterial before its named world
decorator. Absence keeps the constructor defaults and existing scenes.


**Native bake intake (W2 C9).** `@wildshard/sdk/headlessRuntime` defines
`nativeGroundSchema(resolution)` for strict native lattice metadata,
`nativeBakeGround(row, resolution, size, label)` for owned Float32 heights
and scale admission, and `nativeBakeActors(rows, label)` for ordered actor
rows whose specs match their declared kind and variant. Pine and
Driftwood use these same functions; special terrain sampling, collision
provenance, shelter metadata and boss spawn policy remain with their owners.

Stopped shafts use `StoppedProjectileSlots` from engine/combat/projectileContact:
capacity, length, bury, contact radius, reach, survival and recovery stride are
rows. Native entity ids or page actor references and bone frames are borrowed;
changed/removed ports keep the existing rendered slot ownership. Flight and
damage are separate. `stoppedProjectileSaved(capacity)` retains the version-one
position/direction/body/local/localDirection/recoverable envelope and update
count; restore validates before changing the roster. Bone-frame saves belong to
the page owner and are refused by this native envelope.

### Native quest table and captured spots

`game/plugin/quests.bindQuestTableSpots(table, spots, flags, bounds)`
preflights the complete bounded id/kind index before binding the engine's
read-only interaction state. Values borrow the original spots; Map
iteration follows table order. Optional `ordered` requires the capture to
match that order too, and `rows` / `items` bound the table and chest size.
Duplicates, missing/foreign/mismatched spots and excess contents refuse
without flag writes. Reach, command dispatch, rewards and save envelopes
remain caller-owned. Pine and Driftwood use this same native intake.

Graph `objectOrigin` uses the renderer-bound instance matrix for each drawn
instance. Cull compaction and `instanceMatrix.needsUpdate` therefore update its
origin with its placement; it allocates no separate origin buffer. Fragment
reads use a vertex varying. Ordinary meshes keep their model origin.

The lowpolyKit bindLowPolyMaterial(sky, variant, material, scope) API lends a
material to the existing kit factory. The newest live binding wins for that
sky and variant; manual unbind or scope disposal restores the previous binding.
The loan is never patched or disposed. lowPolyMaterial returns Material,
including node materials; without a loan its classic cache and initializer
remain unchanged. Meshes already built retain their material.

A look may declare LookStrategy.prepareWorld(context) to compile and lend its
graph materials before terrain and kit construction. WorldLookContext borrows
renderer, sky and the existing world scope; lookGraphMaterials accepts this
context directly. Standalone and regional worlds await preparation once per
look and scope, after the sky exists and before Terrain.build. Failure or
disposal refuses construction. With no hook, the old build order remains.

Graph materials on existing BatchedMesh objects use the classic renderer's
batchingTexture, batchingIdTexture and optional batchingColorTexture. The
existing draw-ID dispatch and its uniform fallback remain responsible for
selecting each member. Positions, normals, colours, displaced shadow depth and
objectOrigin all follow the current member's placement. No graph-only batch
buffers or dispatch are created. This support admits existing non-facade
batches; facade multi-draw remains prohibited.


`@wildshard/game/plugin/quests` `bindQuestDeathEffects(rows, ports)` preflights bounded ordered death consequences.
Optional `when` alternatives match kind/variant/label; all matching rows run once in order. Effects lend existing
flag, achievement kill/event, named callback or toast owners. Missing owners refuse before any effects. The caller
keeps actual actor lookup, subscription priority, key placement, contract persistence and save continuation.
rity, key placement, contract persistence and save continuation.

`buildTerrainMetadata` builds the same trail/pad/pond queries with an explicit
water-level port without allocating an analytic ground. `terrainTileHeight`
accepts an optional column-major/clamped sampling policy for admitted native
heightfields; the default row-major/refusing policy remains unchanged.
`parseBakedTerrain` accepts owned byte views plus expected header fields, and
`readNavmesh` owns admitted bytes with an explicit datum and refusal message.

`ProjectileContact` in engine/combat/projectileContact resolves one posed flight
segment through borrowed world/target queries. Rows retain the spent-surface
rule and first/repeated glance impact ordering. Live radius, shaft length and
sticking observations stay with the weapon. Synchronous hit/stop/rest/impact
ports retain damage, material, attachment and effects ownership; no Rapier
service or actor is created or mutated by this owner.


`@wildshard/engine/models/place` `placeModelSite(model, origin, layout, options)` places one authored fixed site through
ordinary `single` model placement (a parts build or a whole object, such as a library model). Its origin translates
existing own-space geometry, legacy boxes, anchors and floor; it never reapplies authored rotation. The returned `ModelSite` lends the actual `Placed` object and collider descriptors.
`ModelSiteLayout` supplies authored boxes/anchors and the existing floor evaluator. Invalid origins and unsafe anchors
refuse before placement. A null registry builds the same export specimen without registering it. Optional typed `options.params` override the model defaults for this copy; absent params keep the default build.

Held ranged playback uses the same admitted `HeldPlayback` groups for root
poses and moving parts. Pine's loaded bolt, lever, hammer and cartridge, and
Nalati's magazine/rack, are authored channel rows; their original action
clocks, reload transfer, string spring, hand grips and ADS solve remain with
the weapon. Apply parts after action/reload progress and before hand placement,
then apply the root after the frame/ADS inputs. Begin presentation once per
source frame. Rows can initialize a private smoothing slot from a borrowed
part's initial angle; no shared gameplay state is published or retained.

G424 authored discovery uses `manifest.json`, checked by the defining
`ManifestMetadataSchema` in `@wildshard/format/minimap` and the shardfile schema's
optional `manifest` section. `defineAuthoredShard` in
`@wildshard/game/shard/manifest` combines those admitted rows with explicit lazy
native loaders and generated boot/navigation/budget bindings. Folder discovery
emits `discovery.generated.ts`: every `/src/` image string becomes a literal
bundler import, while public map images and inline card art keep their URLs.
`bindings` names existing shard-local exports. The general generator emits
literal typed imports for resources and lazy imports for loaders; unknown modules
or exports fail generation or typechecking. Handwritten native providers remain
ordinary counted source. The exact discovery outputs are listed under this
producer in `scripts/source-generation-outputs.json`.
Missing source images and mismatched folder identities refuse admission.

Model-library `geometryPools` can declare an optional `native` policy for
original rigid GLBs: bounded named parts (or one first mesh), original
position/normal/UV accessor decoding to Float32, U32 indices with optional
index requirement, and the original world transform. `white` initializes
the original held vertex-colour channel before immutable borrowing;
`disposeSource` drops replaced source buffers. Absent keeps every existing
strict identity-space rest-pool refusal. A pool's bounded `atlases` declare
PBR map/normal/ARM loans by original part plus anisotropy/refresh policy.
`library.atlas(id)` returns those original textures or null; consumers
never mutate/dispose borrowed geometry. Independent materials keep their
existing normal scale, map repeats and other presentation factors.

**Authored posed draws.** `@wildshard/game/plugin/geometry#posedAssets`
reads one identity-space GLB mesh, its declared Float32 shader channels,
contiguous per-kind index ranges and the original atlas: `atlasModel` (a GLB
whose material carries it) or `atlas` (its own KTX2 file, a product's named
blob, loaded with `ktx2File` and sampled as the glTF atlas: flipY false,
repeat, anisotropy 4, sRGB); exactly one of the two. It lends one
attribute/index set to the live view and Explorer wrappers: cards change
only drawRange and their own instance pose. Missing channels, repeated
kinds, gaps and out-of-range indices refuse before the view is installed.

**Animal graph materials.** `AnimalMaterial` also accepts a compiled standard/toon node material; body colour, map and emissive hit-flash ports retain the same types. This is a type-only extension and adds no eager graph-backend import.

**View-space position.** Graph `positionView` is the camera-space position after skinning and instancing, with forward along negative Z. SDK graphs accept both `graphInputs.positionView` and TSL `positionView`.

**Directional sky light.** `graphInputs.skyLightDirection` points toward the first visible scene directional light in world space (shadow casters first, as classic light ordering). `skyLightColour` is its linear colour times intensity, without shadowing. Both are zero if absent and update on each draw from the renderer's collected lights, without a scene traversal.

**Texture arrays.** `sampleArray(param, uv, layer)` authors `textureArray`: a lent texture parameter, vec2 UV and numeric nearest-integer layer. `setTexture` requires a DataArrayTexture or CompressedArrayTexture; a parameter cannot mix 2D and array sampling. Existing arrays are borrowed without repacking, with base mip in vertex stages and derivative-selected fragment mips. Swaps retain the program; the unbound array slot is black.


### Retained grid map pixels

`leaseMapImage` reserves the admitted full image cost before decoding.
`CellMinimaps` reports retained dimensions only after closing a downsized
bitmap: the home keeps its full bitmap, and neighbours keep one 400-pixel
canvas each. The grid then charges RGBA pixels once, without an independent
GPU texture claim. Failed or cancelled decodes release the reservation. The
loading phase keeps the full decode charge until that handoff. This is an
accounting correction, not recovered RAM; standalone map leases are unchanged.

The geometry table recorder `recordGeometryBake(producer?)` accepts an
optional build-only `GeometryBakeProducer`. It supplies raw geometry for
retired procedural builders while the existing numeric inputs and RNG
continuation still determine each table record. Returning null delegates
to the caller's build callback; runtime lookup is unchanged.


### Optional graph attributes

An `attribute` node may declare `default`, a finite numeric literal exactly
matching its `type`: for example `{ op: 'attribute', name: 'aSway',
type: 'vec2', default: [0, 0] }`. The SDK author route is
`graph({ attributeDefaults: { aSway: [0, 0] }, ... })` around ordinary TSL
`attribute('aSway', 'vec2')` reads. Without a default, existing attribute
behaviour is unchanged. Conflicting defaults for one name are refused.

The shader always declares the same typed input, whichever geometry builds
first. Present vertex or instance attributes use the renderer's ordinary
buffer binding; a missing attribute uses the declared constant. No filler
vertex buffers or per-geometry programs are created. Constants are restored
on each draw because they are context state, rather than VAO state. Defaults
survive material clones, outlines and displaced/alpha-cut shadow variants.
### Claimed pickup ownership

`ClaimedPickupRoster` in `@wildshard/game/loot/runtime` owns at most 128
active or fading item pickups. Authored rows retain tier, scale, tilt,
walk-in radius, toss and retirement policy. Content supplies the original
model, ownership/grant callbacks and separate loot/visual random streams.
`spawn` refuses unknown rows and full rosters; optional uniqueness checks
only pending drops. `update` retains the declared after-take grace and
never steps physics. `drops` exposes pending identities for diagnostics.

HeldPlayback numeric inputs: `bindInputs(group, rows, owners)` admits at most
128 unique `{input, owner, path}` rows, each path bounded to 16 safe field
keys. It borrows only finite numeric values from supplied owned capabilities,
never exposes those objects to the channel evaluator, and refuses missing or
non-numeric fields before use. `apply(group, values)` retains the existing
frame-local overrides and phase order; omitted reads use the admitted owner
bindings. Native action clocks, ADS solves and springs remain caller-owned.

Forest-community ambient rows declare bounded local `perches` profiles
(step and per-variant knots). TrunkProbe applies the existing planted tree
rotation/scale and section interpolation; no bark geometry is traversed
at runtime. The shard-owned cheap producer derives profiles from the
original authored tree GLB. Ambient clocks, RNG and flock owners remain
with the shared page-life presenter.


`ProjectileContact<T, H = TargetHit>` accepts the native owner's existing
hit result as `H`; the target and damage ports exchange that value without
conversion. Default page callers retain `TargetHit`. Surface policy, nearest
world fence, flight slots and stopped-shaft continuation keep their existing
owners; the host never installs physics or applies damage itself.

ModelLibrary geometry pools may declare up to 16 Float32 application
channels with `{name, source, width, parts?}`. Width is 1–4; source names
are glTF loader application semantics, and optional parts restrict the
required channel to an explicit subset. Admission refuses undeclared,
missing or colliding channels. Aliasing lends the original BufferAttribute
without copying, transforming or normalizing it. Absent channels retain
the original strict rest-pool path; native source pools do not accept them.

The existing `installNativeMelee` also accepts an admitted item array and a
`kind: "swept"` policy through `parseNativeSweptMeleeBinding` in format/items.
The bounded slots declare item/profile IDs, ordered combo/heavy move IDs,
source tags, lunge limits and contact tuning. SweptMeleeCore owns combo,
heavy-charge and queued-follow-up timing; existing posed queries and the
native loadout retain contacts, switching and old saved clock envelopes.
Borrowed input, alarm and stagger ports preserve each world's reactions.

HeldPlayback.bindOutputs(group, rows, owners) binds exactly one numeric
programme through the existing client-channel numeric loan validator. Rows
name published channels and explicitly borrowed private numeric fields;
unknown channels, repeated binding, oversized rosters and authoritative
actor roots refuse. Numeric-only held groups use the same bounded DAG;
visual groups retain their existing scene and connector bindings. Both
crossbow and magazine sights publish into their original sight records;
contact, action and reload clocks remain with their existing owners.

### Bodyless ambient policy

`src/shards/pine-hollow/runtime/life/bodylessForager.ts` owns Pine's
renderer-free grazing, alert and escape policy over caller-owned state,
RNG, scheduled deltas and ground queries. It borrows motion channels;
visibility, reseating and population lifetime stay with the caller. It is
Pine client content. A future Nalati adoption must meet the five-test host
bar with real users rather than importing this shard's code.

### Native creature recipe intake

`game/shardfile/homeKeeper.createNativeCreatureRoster(host, rows)` is the
native creature roster Pine Hollow (`runtime/roster.ts`) and Driftwood Isle
(`runtime/keeper.ts`) both run on (G454: two real users, data-only rows).
It owns baked kind/variant and scale lookup, caller-stream spawn draws,
native body materialization, structure-aware floors, herd membership, the
hunting brain's adoption and release, pose-roster attachment and
saved-recipe reinstallation. It calls back into no shard code: every
function returns the body it made and the shard acts on it (Pine joins its
list and the King's pose; Driftwood builds an enemy's policy and keeps a
sailor's hold floor). `NativeRosterRows` holds what differs as data: the
baked `specs` and their `duplicates` rule (`first` for Pine, `last`
default), the `variants` scale table, `spawnY`, the optional
`attackTurnCap` (absent: the body keeps its own), the floor's
`heightfield` policy, the `hunt` (`createNativeHunt`'s brain on `rng`),
the `hunted` kinds the brain adopts (`every` for Pine, the fauna for
Driftwood), the optional platform `poses` roster (attachment preflight
precedes spawn) and a restoring host's `saved` entities, whose floor flags
win over a fresh install's sample. `remember(slot)` lets the brain adopt
a hunted kind at its recipe point, or skips three draws for any other.
`retarget` reuses a cold recipe slot; it creates no actor until `arrive`
or `materialize`. `reinstall(slot, saved)` restores the original adapter
placement and structure flag without drawing RNG; `read(saved, id)` is
the recipe reader. `adopt(rows, stream)` preflights at most 1,024 unique
live body identities, optional recipe seeds, finite points and valid
checkpoints on the owned RNG before any memory is made, restores each
declared checkpoint in row order into the hunting brain and continues at
the final stream. `NativeCreatureSlot` names the mutable identity,
variant, herd, recipe, scale range and nullable owned actor. `retire`
admits only the exact registered slot, detaches its member (bounded to
1,024), forgets its memory, retires the native identity and its pose and
clears the actor without drawing RNG. `retireDead(id)` skips missing or
living predecessors and returns the retired slot. `refill` requires a
singleton home herd and retires the old identity while retaining
membership until the caller allocates its new ID, clears its old herd,
creates its new home herd, then draws and arrives with the same recipe
object. Callers keep their spawn rolls, boot order, clocks and saves.
Nalati `runtime/headlessCreatures.ts#retireBondedHorse` and `retireElite`
are the G441 W3 retirement match; their hidden/parked flags, continuation
records and policy cleanup remain caller-owned.
`creatureFloor` defaults to the existing ground-material heightfield rule;
its explicit `any` policy treats every heightfield hit as terrain.

Nalati's native creature manager is the W3 third user: its
pack/elite/bonded spawns and restored roster join the same rows.


`engine/combat/view/ranged.weaponDisplay(parts, policy)` builds at most 128
world/Explorer weapon parts. `mode: 'parts'` keeps their original draw order,
borrowed geometry/materials and local position/rotation. `copyGeometry: true`
returns independent geometries; `whiteColors: true` requires that copy policy.
`mode: 'merged'` bakes local transforms into the geometry, merges only equal
material identities in source order, and owns one material clone per source
material, with the existing viewmodel IBL and supplied sky decorators. It uses
the existing position-only shadow proxy, keeping per-part casters when the
merge cannot represent their attributes. Inputs remain borrowed and unchanged;
the caller retains its existing disposal policy. No animation, contact, ammo or
pickup policy is installed. The pending W3 consumer is Nalati's
`runtime/weapons/magazineFirearm.ts#displayModel`, whose direct mesh/position
loop adopts the default borrowed `parts` policy.

`@wildshard/game/plugin/quests` `createReadingRoster(rows, spots, create, completed)`
borrows ordered reading handles and captured head/prompt positions. One active
speaker owns USE; range cancellation and restore never invoke completion payouts.
The native continuation policy declares its bare speaker and wrapped speakers,
retaining old save envelopes and validating the selected reading before any
mutation. Page handles may omit save ports; their existing panel/clock and
speaker animation remain borrowed. Pine uses its existing native `NpcReading`;
G441's W3 match is Nalati `adventure.ts`'s ordered `CAMP_NPCS` / `NpcTalk`
roster, shared dialogue USE routing and walk-away cancellation. W3 adopts that
roster without inventing native saves or replacing its `DialogueBox`.

### Named GLB nodes and placed geometry colliders

`src/engine/models/glbNodes.ts#loadGlbNodes(source, attributes?, prepare?)` reads
all named mesh nodes from a URL (Meshopt supported) or an existing Object3D.
It dequantizes before applying each complete file-space world transform,
computes bounds, and returns owned geometries by name. With no projection,
all channels remain. A projection maps output names to `{source,size,fill?}`
float channels (at most 16; widths 1–4). Position stays a vec3; missing
channels require a finite fill, and wider channels pad with 1. Materials
are borrowed; optional `prepare` receives them without transferring ownership.
Nalati's W3 `world/glbPaint.ts` adopts this reader while retaining its AO
and material policy (G441).

`src/engine/models/colliders.ts#placedGeometryCollider(source,matrix,surface)`
accepts `{kind:'trimesh',geometry}` or `{kind:'hull',points}`. It transforms
fresh Float32 vertices relative to the matrix translation, retaining mesh
index order (or sequential indices for a non-indexed mesh). Register the
returned descriptor through the normal world physics registry. Nalati's
W3 `world/solid.ts#hullAt` adopts the same hull projection (G441).

### Native species observations

`game/plugin/brain.createNativeSpeciesContext` lends one native body its
existing host, hunt authority, creature stream, herd and world. The context
uses the host's clock and shared AI stream, checks facing and physics reach
before environment damage, and delegates steering, confinement and attack
tokens to that hunt owner. `bind` adapts caller-owned think/act and save
policies without another state envelope, scheduler or random stream.
Foreign bodies refuse before any ports are installed. The engine's existing
`EnemyWorld<A = Animal>` type also describes a renderer-free body's world;
its default retains the browser contract.

G441 pending second user: Nalati's native `headlessCreatures.ts` think
context and clock refresh (its current `c` / `context` bindings). Nalati
keeps pack/group token selection, body lookup and observed player speed.
This pending allowance is rechecked at the end of W3.

### Shader-posed instance owner

`src/sdk/looks/posedInstances.ts` defines `PosedInstances`: one bounded
(1–4096) instanced draw with one or two named dynamic vec4 channels.
`begin/add/commit` packs the current visible roster; `wrap` lends the same
channel buffers to replacement geometry without copying its source arrays.
The caller retains geometry, material, shader semantics, colours, bounds,
clocks and visibility decisions. `PosedDraw` adds named numeric pose lanes,
constants and bounded threshold unions, compiled once before drawing. Its
`begin/add/commit` consumes the caller's poses without owning their clocks.
Driftwood's gulls and Pine's guide ravens use it through `AmbientFlockDraw`;
Pine's free wildlife uses the same draw directly.

`PosedDraw.library(product, name)` admits a named JSON library of tiered
geometry/atlas files, original vertex ranges and Explorer rest cards.
Admission loads no geometry: `preload()` prepares its shared immutable
arrays, `draw(capacity)` borrows them with the lent look, and `models` lists
its original rest specimens with loading boxes until preparation finishes.
The library is shared by content-addressed row URL across world and Explorer
readers. Atlas and glow parameter names, channel packing and rest poses
belong to the rows. The host preserves each source range's original box.

### Cell-streamed instances

`src/engine/render/streamedInstances.ts` holds the bookkeeping of a scatter
streamed round a viewer. `CellWindow<T>(size, build)` keys square cells,
builds a cell's contents once through `build`, keeps at most `cacheMax`
of them (oldest dropped first) and lists the cells within a radius,
nearest first (`within`). `instanceTier(parent, name, geometry, material,
cap, attrs, { coloured, castShadow })` makes an `InstanceTier`: two
InstancedMeshes on twin geometries (the model's attributes shared, the
per-instance matrices, colours and declared attributes each their own).
`begin`, write into `arrays()` at `n`, then `upload(bytes)` marks only the
written instances, a byte budget at a time, and `swap` shows the set in
one frame. Both meshes start visible at count 0, so the boot creates
their GPU buffers. What a cell holds, which instances show and what each
attribute means stay the caller's. The game's `looks/streamedCover` host
owns the ground-cover decoder, near/far handover, slope reach and upload
budgets from `format/streamedCover` rows (G475). Driftwood supplies rows
and baked cells. Nalati's dressing layer is the planned W3 adopter; the
feature carries G475's day-one approval directly.

### First-person arm rigs

`src/game/systems/viewmodel/rigArms.ts` plays a baked skinned arm rig
(one GLB: the arms, weapons under `R_weapon`, clip metadata in `vm_root`'s
extras). `RigArms.load(url, contract, bake, swimming, options)` parses a
URL once and skeleton-clones it per rig, binds the clips through the
`RigArmsOptions.aliases` (default ARM_CLIPS + SWIM_CLIPS) and plays a
right and a left channel: a base loop (idle to walk by speed) under
crossfading one-shot moves. `play` / `playLeft` start a move (the
`holdRight` / `holdLeft` moves keep their last pose; `playLeft('idle')`
fades back), `update` drives the walk weight (`walkRate`) and the
clamped look lag (`lag`), `blade` reads the weapon's blade in root space
and `swim` blends the swim loops. `swordArmsOf` adapts a rig to the
engine Sword's `SwordArms` (move-to-clip map, `vmScale` projection,
framing, blade). Driftwood's toon arms use the defaults. G441 registers
Nine `runtime/viewmodel/fpArmsRig.ts#FpArmsRig` (its parse, `vm_root`
intake, channels, play / playLeft holds, walk and lag, blade) and
`vm/arms.ts#jianArms` (its clip map, projection and blade composition)
as the W3 adopter, rechecked at the end of W3.

### Ordered model placement batches

`src/engine/models/placementBatch.ts` provides `ModelPlacementBatch` over
existing `place` / `placeSliced`. It borrows a model context and registry,
optionally collecting collider descriptors and attaching unregistered
objects to a fallback parent. Await successive typed calls to retain
heterogeneous model order. A supplied `due` uses the existing slicer.
`frames` keeps full matrices and params; `poses` applies a front yaw then
composes the authored YXZ transform with `modelPoseMatrix`. Corrected pose
rows and the original `Placed` result remain available to callers.
Floors, materials, lights and gameplay remain caller-owned.

G441's W3 users are Nine's `world/squareProps.ts` (ordered matrices,
per-copy params, parent/culler and sliced registration) and
`world/props3d.ts#place` (authored yaw/scale frames). Their existing share
selection, names and named sets remain local; pending credit ends at W3.

`game/Boss.installBossEncounter(rows, makeScript, ports)` assembles the existing
rendered `Boss`: the original `BossBar` is made before `makeScript` prepares
and prewarms the actual fight, then the reward card/callbacks, persistence,
interactable list and encounter registration are bound in that order. The
returned `BossEncounter` retains `fight`, `boss`, `ui`, `update` and death
checkpoint forwarding. Caller-owned presence, weather, mount/weapon locking,
respawn and dormant-room stepping remain borrowed through `advance`.
`BossEncounterRows`, `BossEncounterPorts` and `BossEncounterScore` retain typed
cards and callbacks; ordered `BossScoreAction` rows select scenes, mapped fight
phases, combat intensity and existing stings at the five original Boss events.
Score ownership is lazy and missing ports refuse; no music starts at install.
Pine uses this instead of its private outer encounter wrapper. G441's real
W3 adopters are Nalati `combat/stormTitan.ts#bind` and
`combat/goldenKing.ts#bind`, with `runtime/index.ts`'s score-event callback;
its storm/tie/leash and mounted-respawn policies stay native, with no new body.


`engine/combat/view/projectile.ProjectilePresentation` composes the existing
flight data factory, `StoppedProjectileSlots` retained FIFO and `RangedTrace`.
It borrows geometry/materials and bounds flying, stopped and trace rosters.
The row supplies the model axis, spin, tip/nock offsets and trace style; the
caller keeps flight/contact/ammunition/damage and source time. `flight`,
`launch`, `move`, `finishTrace` and `stick` replace private draw loops, with
`prepareTraces` retaining their allocation phase. Stopped poses use `settle`
only: no recovery step or random draw runs. A global FIFO cursor pages retained draws
into unchanged 128-slot stopped rosters, preserving larger declared limits. An optional borrowed writer keeps
an existing instanced draw via `publish(object,index,phase)` and `retire(index)`;
the pose frames then remain outside the scene. The pending W3 adopter is
Nalati `runtime/weapons/javelinSpear.ts`'s world roster/matrix publication;
its Y axis, instancing, contact and recovery law remain its own.

### Native creature pose and contact publication

`game/plugin/animation.NativeCreaturePose` runs the existing scalar animal
pose law, quadruped joints or a borrowed custom animation callback over a
numeric `NativeCreaturePoseRecipe`. The borrowed numeric `context` allows
caller-owned overlays after the quadruped base pose inside the existing
body-step callback; `deathSplay: false` preserves an overlay's
authored death stance. Actor scale follows each advance.
It owns no renderer, geometry, body,
scheduler or random stream. `advance` changes current locals; `publish`
alone updates the cached contact frame read by `headWorld`, `bodyCapsule`
and `foreCapsule`. The bounded saved wire keeps both sets independently.
`restore` validates recipe identity, scalar history, transform sizes and
Euler orders before changing live state, without posing or publishing
current locals. `attachNativeCreaturePose` binds that contact provider to
the caller's actual native actor and lends its terrain-sampling callback.
`publish(joint)` stages a partial publication of that joint's parent chain
(a forced getter's read) while descendants keep their last publication;
`jointPoint(joint, at, out)` reads an extra contact point (a weak point) on
any recipe joint; `adopt(scalar)` resumes approximately from an older
owner's saved scalar clock after the caller writes the current locals.
`adopt` also accepts a legacy object with `pose`, optional `breath`, and
optional complete `root` and ordered named `bones` local transforms
(`p`, `r`, `order`, `s`). Complete transforms retain frozen far-LOD joints;
every identity validates before mutation. `restore` recognizes that old
unversioned envelope. `snapshot('local')` keeps that transform envelope
byte-for-byte for callers that fully publish their locals before saving;
the default native wire retains separate current and published contacts.
Pine's Antler King and Nalati's taming horses use the same converter.

`game/plugin/animation.createNativeCreaturePoses` lends a bounded pose
roster over admitted kind/variant recipe rows. Its `binding` supplies the
existing creature intake's preflight and attachment ports; duplicate
recipe rows retain last-match order. `get` lends the same numeric pose
for caller-owned advance and quiet snapshot/restore; `delete` retires
only its pose. `publish(at)` visits the caller's roster slots in order,
so retired bodies and sparse slots do not publish. It adds no clock,
save envelope, animation or publication phase. Nalati's taming owner
uses `NativeCreaturePose` directly with offline joint rows from
`generators/bodies.ts` (`sim/taming-poses.json`). It retains its wind
overlay, body cadence, adoption, legacy transforms and publication phase.

`src/engine/boot/plan.ts#BuildStages<T>` sequences up to 512 world-build completions on a borrowed `Slice`.
`build(detail, work, {objects?, values?})` returns the original constructor result, attaches selected objects
to the supplied `parent` in order, appends selected values to `collect`, then reports completion and yields.
Missing attachment/collection ports refuse before construction; failed work never reports completion.
`next(detail)` completes work kept local. Optional `total` supplies progress units (1..512); without it the
borrowed slice is called without progress arguments. The caller retains constructors, disposal and physics.

`src/sdk/headlessRuntime.ts` also defines `createNativeBakeReader(input,
options)`, a typed one-time native-world intake composed from those readers.
`NativeBakedActor` and `NativePhysicsBake` retain ordered body/herd metadata,
owned ground/collider buffers and optional parked-body recipes. The returned
`NativeBakeReader` admits individual solids through the same caller-provided
strict provenance schema. The caller supplies its body recipe schema, extra
root metadata schema and optional cross-record check; failed admission or
checks never populate the memo. A declared parked roster cannot be missing,
and extra metadata cannot shadow world fields. No bodies, transforms, samples
or random draws are produced. Pine keeps King hit volumes and shelter checks
in its reader declaration. G441's real W3 user is Nalati
`runtime/baked.ts` (lattice, solids, actors and parsed-world memo); its
flock/tree/group/spawn cross-record checks remain its own admission callback.

### Ranged action clocks

`engine/combat/Firearm.ts` defines `RangedAction` and `RangedActionRow`.
The bounded row selects quiver or magazine consumption and declares capacity,
interval, reload duration, auto-reload delay and its shot/empty-trigger clock.
`trigger` preserves reload/cooldown/empty refusals; `shot` claims consumption
before caller-owned effects; `reload` composes `RangedReload`. `advance` uses
the caller's frame delta and optional reload scale/active policy, observes
progress before the original end callback, and never advances physics or pose.
The port borrows only ammunition state and dry/reload hooks. `trigger()`
without a callback returns admission for a native caller's existing fire
phase; passing a callback retains the page path. `snapshot()` owns only
`reloadT`, `cooldown` and `sinceFire`; `restore(envelope)` validates all three
finite clocks before a silent commit and ignores other owner-envelope fields.
Ammunition, save version and flight stay with the caller. `RangedReload`
also snapshots/restores its elapsed source-clock seconds independently.
`engine/physics/query.ts#worldHit(physics, from, to, radius)` is the shared
page/native ranged query: a segment at radius zero or a ball sweep otherwise,
passing up to four invisible edge strips in order and accumulating distance
from the original start. The page wrapper alone allows missing physics.
The string spring remains caller-owned. W3's real matching consumer is
Nalati’s generated rifle rows on `HeldFirearm`; its bloom,
muzzle flash, shot callbacks and active-only automatic reload stay ordered.

`src/engine/models/sets.ts#placedWithin(placed, x, z, radius, mode)` returns an Explorer-only copy view.
`bounds` selects intersecting horizontal boxes and uses box distance for nearest; `centre` selects box centres
and uses squared centre distance. Whole selections keep the original placement; partial views borrow its
object and boxes and own no colliders. Bounds views retain the original registration promise; centre views
follow the source promise. `registerPlaceSets(rows, {file, registry?, skipEmpty?, members})` registers rows
in order, combining borrowed `whole` placements with optional `near` views. Each row may override `file`;
empty sets register unless `skipEmpty` is true. Content resolution and any inter-row pacing stay with the caller.
Optional `centres: {placed, point(row)}` batches centre-selected views in one pass over each source, preserving
source/copy order, nearest-by-centre, borrowed objects and the existing no-op cull of `copiesNear` views.

**Declared panel lifetime (W2 C5).** `@wildshard/sdk/panels` defines
`DeclaredPanel` and `DeclaredPanelPolicy`. Persistent panels mount once and
retain their DOM across close/open; per-open panels make a fresh child scope
and content tree, blur before close callbacks and release their scoped layer
and listeners on close. `renderRows` retires old row listeners before replacing
content. Close refs, bounded close-key lists and pointer isolation are policy;
`bind(view, scope, close)` retains custom submit keys, focus/input guards and UI
layer ownership with the caller. A closed/disposed owner cannot reopen.
`@wildshard/format/panelTemplate` admits bounded read-only templates and
input policy; `@wildshard/sdk/panelTemplates` expands their markup without
a DOM. `@wildshard/sdk/dataPanels` reads named `quests/panels.json` and
installs `DataPanel` over the existing scoped panel and modal owners. Pine's
lodge rows and transient count, and Nalati's horse-name form, are real users.
Templates select scalar fields, finite repeats, comparisons, text and named
actions; they cannot write gameplay state. Original claim/reroll payouts and
horse-name cleaning stay with their callers. Open forms keep Enter/save,
the first-input grace, synchronous focus, modal order and fresh scopes.

`src/engine/models/colliders.ts#readColliderRows(rows, {kinds, surfaces, requireSurface?})` reads serialized
box, capsule, ball, hull, trimesh and tread descriptors into fresh registry data. The caller explicitly
admits kinds and surface names; an empty surface list permits only absent surfaces, while `requireSurface`
refuses absence. Strict fields, finite numbers, positive integer tread counts and Uint32 indices refuse
malformed input. Hull/trimesh lanes become independent typed arrays; nested points and rotations are fresh.
Limits are 65,536 rows and 6,000,000 values per geometry lane. This reader never installs colliders; return
the descriptors through the normal model/world registry and engine physics owner.

### World display part transforms

`engine/combat/view/ranged.ts#weaponDisplay` accepts a borrowed per-part
`matrix` as an alternative to `pos`/`rot`; crossed or non-finite transforms
refuse. Direct parts apply it to the owned mesh; merged parts transform an
owned geometry copy, leaving source buffers unchanged. The merged policy's
optional `opaque: true` restores normal world material flags on its owned
clones. Omission preserves existing direct/merged material ownership.
Tree cloning, content selection and the crossbow's three cord-rest rows
remain Pine-owned; there is no tree-copy host or extra pending-user credit.

`src/game/bag/findsCatalogue.ts#createFindsCatalogue` prepares bounded
`FindsCatalogueRows` for the existing Bag FINDS renderer. Counters read
declared flag sets (explicit IDs or a numbered prefix); stickers read
flags or registered ownership, preserving authored labels, icons, prizes
and dense/wide presentation. Optional glass rows cycle authored colours;
an optional numbered milestone uses a counter for the next reward text.
Metadata is copied and bounded before use. Every view observes current
flags and ownership; missing required ownership refuses. This owner never
grants rewards or changes UI layout. Driftwood is the first user. G441's
W3 match is Nalati `bag.ts#nalatiFinds`, whose elite/place counters and
prize stickers use the same catalogue; Nalati's skin painter stays local.

**NPC head attention (G441).** `game/plugin/animation` defines
`stepNpcHeadFocus` and its `NpcHeadFocusState`, `NpcHeadFocusProfile` and
`NpcHeadFocusInput` ports. The caller retains transient head/glance state
and reuses its numeric input. Profiles select near-focus bounds, linear
or exponential response, and a sine/cycle idle cadence. Glance time only
advances while idle is selected; trusted gesture targets or offsets keep
their existing caller phase. No renderer, random stream, dialogue clock
or save owner is installed. Driftwood's two NPCs keep their original
head equations, gesture timing and body/rig ownership. The W3 Nalati
user is `models/npc/figureMotion.ts#stepNpcFigure`: retain its phase clock,
talking head accent, motion/orbit and pose matrix ownership when adopting
the focus/glance law at the end of W2.

**Resource acquisition memo (W2 C5/C9).**
`@wildshard/engine/app/cachedAssets#ResourceMemo` shares keyed asynchronous
`load` promises and synchronous `acquire` values. `peek` never starts a load;
`entries` visits ready values. Resources remain borrowed: `invalidate` only
forgets, and `cacheUntilDisposed` invalidates on real retirement, preserving
geometry rebinding. Failed factories retry; invalidated late promises cannot
overwrite newer values. The optional invalidation callback clears dependent
memo/preload state. Pine keeps its own NPC skin admission, PBR and pose law.
The G441 W3 user is Nalati `species/hulls.ts#CreatureRigs`: replace its
ready/loading maps and disposal invalidation while preserving coat adoption,
preload policy, generated rig decoding and existing failure behaviour.

**One-value disposal memo.** `cachedAssets#memoUntilDisposed(memo, key, make)` is the single-map form: it returns
the Map / WeakMap's value for `key`, else makes, stores and tracks it with `cacheUntilDisposed`, so a retired
value (or a rejected promise) is forgotten and the next call makes it afresh; an older value's retirement never
evicts a newer one. The viewmodel's rig-file parse and Pine's cabin material set use it.

### Bow shape publication (G441)

`src/engine/combat/view/bowProfile.ts#BowShape` rewrites bounded dynamic
limb/cap/string ranges in caller-owned Float32 position/normal attributes.
Its row declares ring samples, side signs, radial counts, dynamic range,
back-section scale, tip anchors, nock offsets and served-string dimensions.
The caller supplies section and grip laws plus stable endpoint vectors.
The optional `curve` declares `gripH`, `limbW`, `kappaRest`, `kappaDraw`
and optional `tipKink`: a straight grip, circular working limb and rigid
terminal arc. It is exclusive with the original trusted `limbAt` callback;
absent curve keeps that callback unchanged. Construction refuses non-finite,
non-positive grip/length/rest curvature, negative draw curvature, magnitudes
above 10,000 and tip kinks outside ±PI. Curve sampling writes only the
borrowed centre/tangent vectors and retains the original arithmetic.
The named W3 match also includes Nalati `weapons/recurve.ts#limbAt`, whose
siyah uses the same law with `tipKink = 0.95`. Static channels, indices and vertices stay untouched;
disposal remains the caller's ownership. `BowShape.prepareGeometry(rest)`
claims Float32 position/normal backing for the first view; later views copy
only those mutable channels and borrow color, UV and index backing. It
returns the geometry and its DynamicDrawUsage attributes with the existing
radius-two bounding sphere. Call before deforming the source. Interleaved,
non-Float32, crossed, empty or over-1,048,576-vertex channels refuse before
claiming. The named W3 consumer is Nalati `weapons/recurve.ts#BowMesh`'s
constructor, which binds the same dynamic position/normal channels and
bounds; its palette, repaint and static geometry production stay local.
Construction refuses crossed channel lengths, non-Float32 attributes,
non-finite coefficients and layouts beyond 1024 rings / 64 radial samples
/ 65,536 dynamic vertices. `shape(draw, nock)` retains the original draw
clamp and dirty-range cadence; it does not advance combat or input clocks.
Pine's stave is the current user. The named G441 W3 consumer is Nalati
`weapons/recurve.ts#BowMesh.shape` and `writeLeg`, with its original centreline coefficients and tip kink declared on the shared
curve; fixed section and grip values come from its producer; palette and repaint policies remain local.

**Packed creature body copies (G441).** `game/plugin/geometry` defines
`packedCreatureBodies(input)` and its `PackedCreatureBodies` handle. It
admits a bounded catalogue of hash-named assets, offset-addressed typed
geometry blocks, bones and dimensions. `preload()` retains the existing
compressed source once; `copy(kind, variant)` returns fresh owned
geometry, bone tuples and feet. Missing keys, early copies, unsafe paths,
truncated blocks and mismatched inflated lengths refuse. Optional raw indices,
multiple parts and draw groups retain contiguous body layouts; a lent
decode port handles a caller's existing lane encoding. It installs no
materials, animation or save owner. Rendered code may import the reader
lazily at preload so native species modules remain renderer-free.
Driftwood keeps its existing payload and metadata. The W3 counterpart is
Nalati `species/bodies.ts`: normalize its contiguous channel/group rows
at intake, then replace its private body-part, bone and dimension copying;
its lane decoding, family keys and painterly materials stay unchanged.

`BowShape.sectionSamples` optionally supplies producer-owned `widths` (two
positive finite half extents per ring) and `ridges` (one positive finite
multiplier per radial vertex). Each value is at most 10,000; lengths must
match the admitted ring/radial layout. Samples and trusted section/ridge
callbacks are exclusive. Absent samples retain the callback path. The
Pine hands producer computes these invariant values with the original
section and spiral arithmetic; draw deformation and buffer ownership stay
live. Nalati `weapons/recurve.ts#limbSection` and `gripRidge` are the named
W3 match: its binding bulges and ear bridge are also fixed per ring.

### Held weapon queue preparation (G441)

`src/engine/combat/view/ranged.ts#prepareWeaponView(root, options)` prepares
up to 256 borrowed held meshes for the shipping transparent queue. It
retains geometry/material identity, transforms, visibility and authored
colour channels; vertex-coloured materials get the existing white channel
only when missing. It sets culling off, cast-shadow off and receive-shadow
on, with ordinary order 1000 and explicit flash meshes at 1001. An optional
borrowed clearer keeps its authored order (999) and material untouched,
with receive-shadow off. An explicit flash material keeps its depth-write
policy; other materials become transparent with depth-write on. Crossed
clearer/flash handles and flash rosters over eight refuse before mutation.
The function allocates no geometry/material and installs no services.
Pine crossbow and lever adopt now; the G441 W3 match is Nalati
`runtime/weapons/magazineFirearm.ts#buildViewmodel`.

**Clip transform ports.** `game/plugin/animation.playClips` accepts named
local transform ports in `ClipCtx.bones` (`AnimalRigJoint`), including
existing bones, meshes and groups. The reader writes only position,
rotation and scale; it creates no pivots, materials or animation clock.
NPC gesture acceptance, timers and head focus stay with their owners.

`src/engine/combat/effects/EffectService.ts#selectEffectGrants` reads
`EffectGrantRow<Key>` declarations against the caller's current key
predicate and returns ordered permanent grants for `EffectService.sync`.
Each row names an effect, required key, optional excluding keys and
optional positive stack count. Admission bounds rows to 128, exclusions
to 32 per row and keys to 256 characters; invalid rows refuse before
reading the predicate. The selector owns no effects, storage, clocks or
subscriptions. Driftwood's existing player and weapon effect binding
uses authored owned/worn rows; highest upgrades and grant order remain
content facts. G441's W3 match is Nalati's worn-skin grant selection in
`weapons/nalatiSkins.ts#NalatiSkinLocker.syncEffects`.

**Declared deck floors.** `src/engine/physics/box.ts#floorAtRects(floors, x, z, policy)` queries inclusive
rectangles with x/z centre, half extents hw/hd, height y and optional rot (zero when absent). Rotation uses the
BoxSpec negative-Y convention and the existing scalar inverse transform. `first` preserves authored priority;
`highest` returns the uppermost matching floor; no match returns undefined. It creates no collision or clock.
An optional `profile` supplies two to eight ordered `[localZ, halfWidth, relativeY]` knots.
The contact evaluator interpolates width and height within the profile and returns no floor beyond either end.
Pine keeps its floor rows and registration owners; Nine `world/floorRows.ts#entryDeckFloor` is the G441 W3
adoption of its inclusive entry-slab loop, with first-match policy and the existing zero deck height.

**Yaw frames and plan polygons.** `src/engine/world/yawFrame.ts` holds a ground frame turned about +Y
(`YawFrame`: origin x/z and yaw, the BoxSpec / FloorRect `rot` convention): `yawLocal(frame, x, z)` maps world
x/z into the frame and `yawWorld(frame, lx, lz)` maps back; `insidePolygon(points, x, z)` is the even-odd plan test
against [x, z] corners (false under three). Pure scalar math: no clocks, heights or allocation beyond the returned
pair. Users: declared pool water (`world/water/declared.ts`), Pine's cave interior (its passage frame and dry
footprint) and Driftwood's sea cave floor.

**Instanced quads.** `src/sdk/looks/cardField.ts#instancedQuad(quad, attributes)` draws a quad (index, position and
uv shared, never copied) once per instance with the caller's named `InstancedBufferAttribute`s; the instance count
is the first attribute's. `cardGroup` feeds its baked card rows through it; Pine's baked buildings feed their
seeded smoke and spark clouds the same way.

**Creature lift (G441).** `game/plugin/animation.stepCreatureLift` steps
an actor's existing `rise`, `rising`, `sinking` and `init` memory, returning
the eased lift and updating its body offset. Numeric rise/sink durations
and the lower offset are required; an optional floor-easing rate borrows
the existing `floor`/`floorS` values. Up advances before down, clearing its
flag at the endpoint. Explicit `up`/`down`/`hold` leaves flag transitions
caller-owned. Invalid frames refuse before any memory or offset write.
The helper allocates nothing and installs no clock or save owner.
Driftwood's captain body step and sailor pose consume it. Named W3 user:
Nalati `species/balbal.ts#thinkBalbal` RISE/SINK and `#animateBalbal` lift;
Nalati retains phase changes, defaults, chamber floors and death sinking.

**Creature group materialization (G441).** `game/plugin/brain` defines
`createCreatureSpawner(manager)`, `CreatureSpawner` and `CreatureSpawnRow`.
It owns ordered `spawn`, `group` and
`place` herd/member joins plus idempotent retirement of only its actors.
`place` preflights bounded pose rows and herd indices before creating any
herd; ungrouped rows remain caller-owned. Callbacks retain practice,
reporting and effects in their original actor/group order. Placement RNG,
species policy, scenery and saved state remain with their existing owners.
Driftwood's Enemies uses it for authored herds, practice and the sailor.
The named W3 user is Nalati `creatures/wildlife.ts#spawnPack/#spawnHerd`,
replacing manager spawn/membership wiring while preserving free-spot
searches, wolf tracking and pack/herd controllers.

**Actor-memory actions (G441).** `game/plugin/brain` defines
`createMemoryActionBrain` and `MemoryActionRows`. The bounded row names an
existing numeric state field, its inspection labels, and ordered body-step
actions: an attack-phase threshold, an existing once field and an optional
truthy/falsy selector. All effect ids are preflighted against borrowed
callbacks before the brain is installed. A due action writes its once field
before invoking the callback, including a miss or thrown effect. There is
no expression evaluator, clock, RNG, contact solver or save envelope;
CreatureBrain still owns inspection and the caller's existing StrikeRunner
and projectile owner perform the effects. Act-before-think stays valid.
Driftwood uses it for crab, sailor and monkey page/native adapters. The
named W3 user is Nalati `species/balbal.ts#actBalbal`, replacing its numeric
state/attackPhase/hit gate while preserving motion, slam flags, damage,
contact, sound order and actor-memory continuation.

**Trusted tick wiring (W2 C9).** `@wildshard/sdk/headlessRuntime` defines
`bindHeadlessCommands(context)`: one installation binds the current admitted
tape to native ports and the existing `ledgerPorts`/`pickCommands` owners.
`shots` reads every attack in order; `heavy` reads the first held command;
`melee` and `walk(speed)` use the last player command, including releases.
`scripts(ids?)` creates a filtered reader; `lastScript(id, fallback)` keeps
the last matching numeric value. Every read samples the current tape and
refuses more than 1024 commands. Filtered arrays and melee input are borrowed
scratch, never saved between ticks. Pine and Driftwood use this wiring
without changing their controller install, restore, clock or effect order.

### Hitscan effect presentation

`src/engine/render/viewmodelFeel.ts#HitscanPresentation` composes the existing
`RangedFlash`, `RangedFrame`, brass, segment tracers and impact puffs from a
`HitscanPresentationRow`. Profiles, muzzle source, geometry and materials
are borrowed; counts use the existing 128-slot caps. Construct the flash/light
at boot, call `flash.build(model)` at the original mesh phase, `prepare` once
for cases/traces and `mount` at the original puff insertion phase. The caller
keeps firing/reload/action/pose phases: `flash.fire`, `hit`, `eject`,
`flash.advance`, then after pose `publish`. Publication integrates cases before
puffs/traces, with the live tracer lifetime and caller time. No action, damage,
physics service or random stream is replaced. G441's pending W3 adopter is
Nalati `runtime/weapons/magazineFirearm.ts`: allocation, hitscan/ejection and
final publication; its bloom, magazine/reload and callbacks stay local.

### Baked hunting-ground queries

`engine/ai/huntPattern.ts#bakedHuntGround(grid, ports)` binds the existing baked
height/normal samplers to a hunting ground. The caller lends its terrain field,
chunk half-size, tree query, treeless, wetness and sea predicates. Bounds stay
inclusive after the requested margin; an absent stream returns null. Water
level and pond remain live field reads. The helper neither registers physics
nor changes terrain, species, placement or RNG policy. Pine uses it for native
herds; W3 Nalati replaces `runtime/headlessCreatures.ts#nalatiHuntGround` with
the same binding, retaining its river wetness and forest queries.

**Memory-action cadence and callback binding.** The same `createMemoryActionBrain` accepts optional `cadence: "decision"`
rows: one pending body action per successful decision. `snapshot()` and
`restore()` preserve that boolean continuation; malformed values refuse.
An optional borrowed `beforeAct` runs on every body step, before the latch,
and a numeric `threshold` resolver reads the current body at action time.
Defaults keep body-step actions and their original memory ownership.

`bindCreatureBrain(create)` exposes the same lazy per-animal callback
binding used by admitted species: its first think or act constructs once,
later calls receive the current context, and `live` reports ownership
without allocating a brain. Captain and existing admitted ground species
share this binder; no clock, decision or random draw runs at binding time.

### Scripted director named emit bindings

`embeddedDirectorBytes(declaration, bake)` checks an embedded bake's hash
before decoding it. `prepareEmbeddedDirector(declaration, bake, seed)`
verifies the bytes once and returns independent admitted lanes. Driftwood
finale and Pine watch use these from their page and headless entry owners.
The optional native `scope` port stops requests, dispatch, advancement and
publication after disposal. `request(key, value?)` queues an admitted AS
input and dispatches at zero delta. `emits.value: 'literal'` requires row
values to satisfy their declared AS output and delivered same-key events
to carry that exact value. Pine retains its 1/60 initialization delta;
both shards retain their AS bytes and unchanged version-3 snapshots.
`readDirectorProduct(product, scope?)` admits the named `directors/main.json`
blob. `DirectorScriptStageLane.bind(stages, lane, bindings, owners, scope,
restoring?)` reads bounded declared observations, applies ordered native
method calls or field writes, and subscribes to declared flag edges. It
borrows only supplied objects through the existing safe owner paths. Pine
watch and Driftwood finale both use this data binding on page and headless
hosts. Restore remains quiet, and disposal releases edge subscriptions.

`src/game/plugin/director.ts#DirectorScriptStageLane` also accepts
`DirectorScriptStagePorts` with `emits: {source, actions}` instead of
`publish`. The copied action map has at most 64 named callbacks. Every
row action must be an emit with literal value zero and a bound name,
preflighted before the script initializes. `source: 'matching'` requires a
real AS event with the same key; `'optional'` retains bootstrap publication.
Callbacks receive the admitted event payload (zero for bootstrap). Native
callbacks retain spawn, clock, reward and flag authority; quiet restore and
legacy publication are unchanged.

Driftwood's finale uses these bindings. The G441 W3 adopters are Nalati
`runtime/raidDirector.ts` and `runtime/ghostVolleyDirector.ts`, whose matching
event checks and named native clock/shoot callbacks move onto this policy.

### Native elite rule continuation

`game/eliteSystem#EliteCore.snapshot()` copies lair clocks, records and ordered
entry state; script, body, lane and RNG continuations remain caller-owned.
`prepareRestore(value)` checks all rows and the installed ID order before
returning a quiet commit. The commit refuses if the installed entry references
changed after preparation, and invokes no script, hook, persistence write or
random source. Untouched last-hit clocks retain the historical null wire value.

`EliteCoreContinuationSchema.entries` composes these fields into a caller's
strict versioned envelope. Its top-level parser can also project those core
fields directly from that envelope; nested rows remain strict.

`game/shardfile/eliteEncounters#installEliteEncounters(host, spec)` owns the
ordered native encounter roster on this core. Pine Hollow and Nalati both
install it from their admitted headless assemblies. `scripted` lends an
existing controller factory with its field/lane/RNG continuations; `rows` declares keeper constructors, member kind
and variant, boot/spawn/herd adoption, initial memory, pack offsets and member
order. Lair and respawn rules remain each row's `def` on `EliteCore`.
`eliteBindings()` lends pins and decision/act bindings to the one manager body
step. Keeper state is restored before body bindings are reattached; pack
members must retain their declared kind, count and consecutive native IDs.
The optional `win-and-detach` adoption action validates the native reward,
sets its declared scale, retires the encounter and detaches its herd lookup.
It takes no shard callback.

The installer's scripted ports give existing fights boot-body adoption,
cover-checked combat, lane constructors, bounds and a saved player root.
The roster retains spawn IDs, draws and retirement; no second body installer,
attack clock or decision controller is introduced.

`wire` names the existing adapter envelope's script, stun and optional
permanent-detachment keys. Pine saves version 4 and Nalati version 1, retaining
their historical field and actor identities. Explicit `wire.upgrades` admit
Pine v2 and remove v3's obsolete prelude cursors; v1 binds the install-time
bodies and supplies its implicit no-rivals/no-root state. Unknown versions
refuse. Restore checks the complete ordered core roster, exact record keys,
body identities, phase/pack bindings, keeper payloads, fields, lanes and RNG
before committing live state. It invokes no spawn, reward or random draw.

### Borrowed held hand parts

`src/engine/player/heldHandParts.ts#HeldHandParts` assembles 1..8
`HeldHandPartRow` fist/sleeve pairs from borrowed geometry and materials.
It creates only meshes and an owned group; it never builds, copies or disposes
geometry/material backing. Queue flags stay at 1000 with receive-shadow;
`viewmodelOnly` tags and `transparentMaterials` are explicit opt-ins.
`fist(index)` lends the stable mesh for the caller's original grip solve.
A sleeve without an elbow rides its fist at the supplied wrist/direction.
For free sleeves, `aim(model, scale?)` transforms camera-space elbows into the
model and points each sleeve from its wrist. An optional borrowed `frame`
uses an independently posed rig matrix; mutate live elbow vectors before
publication and supply scale only when the original rig did. `cost` counts
the same existing channels/draws. `dispose` removes owned parts while keeping
borrowed rig parents and backing. Pine retains its baked-key lookup,
HandSpec/palette and grip-quaternion law. G441 pending W3 user: Nalati
`runtime/weapons/javelinSpear.ts` fist/sleeve setup and wrist/elbow loop.

### Native NPC facing

`src/game/plugin/animation.ts#stepNpcFacing(current, target, profile, dt)`
advances the caller's yaw by the wrapped shortest-angle difference and its
exponential response. `NpcFacingProfile.rate` sets that response;
`maxSpeed` optionally caps the angular step. `wrapTarget` and `wrapOutput`
independently retain the native input and final-yaw policies. The helper
allocates nothing and owns no acceptance predicate, clock, figure or save.

Driftwood's Trader and Castaway lend their original range/talking/tidy
predicates and their placed facing. The G441 W3 user is Nalati
`src/shards/nalati-grasslands/models/npc/figureMotion.ts#stepNpcFigure`:
its talking/near/idle target and 5 / 2.5 response use the uncapped policy
without wrapping the accumulated output yaw. Orbit, head and arm pose
remain native owners.


`game/shardfile/hybridRows.bindRuntimeJsonRecord(ctx, source, key, schema,
legacyRead, instance?)` binds a typed JSON record to one declared host state
field. The legacy callback seeds that field only on its first initialization.
Reads and writes validate through the supplied schema and refuse another
instance namespace. Writes return the underlying durability result; callers
retain their existing refusal policy. Pine uses this for its boss/elite saves.
`game/quest/persistence.bindAdventurePersistence(ctx, source, rows, instance?,
legacy?)` composes those records for Pine and Nalati. Declared keys retain
content-versus-placement legacy namespaces, numeric validation, failed-write
policy, boss/elite/cosmetic flags, companion bonds and feat receipt identities.
Legacy callbacks initialize optional companion records once. Subsequent reads,
writes and checkpoints use the bound state and projected ledger only.

**Creature swing envelopes (G441).** `game/plugin/animation.sampleCreatureSwing`
samples a `CreatureSwingSpec` into caller-owned numeric scratch: bounded
smooth wind, cut and recovery windows and up to 32 named channels, each
holding rest, wind and impact values. Invalid windows, channels and output
owners refuse before writes; inactive phases return rest. Sampling owns no
clock, RNG, actor memory or save state and allocates nothing per frame.
Driftwood captain and sailor poses consume it. Nalati
`species/balbal.ts#animateBalbal` is the named W3 user of the same layered
arm/body/knee envelope; emergence, grind and tremor remain caller-owned.

`game/shardfile/homeKeeper.nativeCreatureRecipes(specs, duplicates?)` is the
shared baked kind/variant registry and saved `runtime.actor.<id>` reader.
Duplicate policy defaults to `last`; `first` keeps the earliest baked spec.
`spec(kind, variant)` refuses absent recipes. `read(saved, id)` checks the
serialized actor identity, finite placement and kind/variant names before
returning the decoded contract. It never spawns, draws RNG or mutates a
roster. Pine uses first-match lookup across actors then parked recipes;
the existing native creature intake retains last-match lookup. Each
caller keeps its placement, hunt, pose and versioned continuation owners.

**Creature leg stride (G441).** `game/plugin/animation.poseCreatureStride`
poses six borrowed hip/knee/foot joints using a `CreatureStrideProfile`
and the caller's phase, movement, brace, kneel and topple values. The
profile holds numeric swing, spread and optional stance coefficients;
an optional bend adds the existing attack knee bend. All scalars and
required joints preflight before any write. No clock, RNG, actor memory,
position or save state is owned, and no per-frame allocation is needed.
Driftwood captain/sailor use the shared weighted stance. Nalati
`species/balbal.ts#animateBalbal` is the G441 later user: its leg loop uses
the same alternating swing and knee law with zero rest/brace terms,
1.7 knee folding and caller-owned attack bend. The rest of its pose stays
with the native caller.

**Creature site selection (G441).** `game/plugin/brain.selectCreatureSites`
ranks up to 1024 borrowed points or positioned actors. Range admission
precedes ordered caller scoring; `null` rejects a site, equal scores keep
source order, and greedy minimum spacing follows ranking. It returns
original site/index pairs for up to 16 choices, adding no RNG or actor
owner. Invalid bounds or coordinates refuse before scoring. Driftwood
keeps perch occupancy/escape weights and grove density/exclusion policy.
The named W3 match is Nalati `creatures/Wildlife.ts#nearestWolf` and
`#nearestFoal`: select one live positioned actor within the caller radius
with negative distance as its score; keep the original body identity and
pack/herd ownership. Pending credit is rechecked at the end of W3.


**Creature group sampling (G441).** `game/plugin/brain.sampleCreatureGroup`
accepts a `CreatureGroupSpec` and returns ordered `CreatureGroupSample`
poses. Groups are bounded to 16 members; indexed sources borrow up to
1,024 points. Radial sources keep angle-before-radius order, optional
first-at-centre, linear or area radius, up to 40 rejection attempts and
an explicit centre fallback. Accepted poses draw yaw after acceptance
unless yaw is supplied. First/rest or per-member variants stay authored.
The borrowed acceptance and joined callbacks retain ground/body policy
and per-member materialization before the next sample. Invalid inputs
refuse before RNG or callbacks. No stream, body, herd or save is owned.
Driftwood crab circles and indexed monkey groves use the same sampler.
The G441 W3 match is Nalati `creatures/wildPlacement.ts#freeSpot`,
`#placePack` and `#placeHerd`: preserve area-radius rejection, live-body
clearance, centre fallback, variants and interleaved native spawning.

`@wildshard/engine/sim/cableTraversal#ZiplineDriver(row, profile?, landing?)`
accepts an optional third landing point for direct-anchor profile rides.
The default release still uses the
declared bottom endpoint. `speed` lends the live cable speed to camera
and trolley presentation; `update` retains the one ride state and clock,
returning whether the cable still carries the rider.
Pine's page and native quest use that same update law. Native callers
keep their motor/fall/impulse publication and adapt existing `{s,v}|null`
saves through silent `restore`; page callers keep their carry flag,
trolley, camera roll and ride callbacks. No extra step is installed.

Driftwood's `runtime/director.ts#createDriftwoodFinale` is the renderer-free
page/native finale controller over the existing `DirectorScriptStageLane`.
It reads the same player/target and flags, routes the captain callbacks in
stage order, owns the reward-start/finish flags and subscribes to altar/death
edges until scope disposal. Callers retain their update phase and original
version-3 stage snapshot; restoring stays silent. Captain combat, reward
pose/carry and page sound/caption effects remain with their existing owners.

### Authored custom shardfile sections (P2b)

Build-time `@wildshard/sdk/sections` defines a private table with
`defineSection('custom/name', valibotSchema, value)`.
Values must be plain JSON;
Valibot supplies defaults before emission. Predicates or transformations
that cannot be represented by JSON Schema refuse instead of being dropped.

`emitDefinedSections(definitions)` returns sorted index descriptors and a
map of canonical bytes at `sections/custom/name.json` and
`schemas/custom/name.schema.json`. The product writer owns publishing those
files. Duplicate names and path escapes refuse before any file is written.
`validateDefinedSection(schemaBytes, value)` independently checks a custom
section loaded from disk against its canonical draft-07 schema, without
loading author code. It refuses unknown checks, unresolved external schemas,
asynchronous validation and non-JSON values; it never coerces data, supplies
defaults or removes unknown properties. Runtime custom-section readers keep
their own local schema; the authoring SDK never enters the play graph.


For migrated custom sections, declare `SECTIONS` only in
`runtime/sections.ts`. The official section-schema producer copies that
schema-only registry into ignored `generators/sectionSchemas.generated.ts`
and derives draft-07 structural documents with
`formatJsonSchema(schema, 'draft-07')`. The default format-schema target
remains draft-2020-12. The authoring entry imports the generated bridge,
never `runtime/`. Relative, dynamic or non-schema package imports refuse.
The producer and copied-runtime proof keep the defining Valibot checks;
disk admission uses the derived structural schema. Unknown predicates and
transforms still refuse conversion. The generation cache binds the bridge
to the registry and public format sources; `pnpm gen` regenerates it.

### Built shard discovery catalog (P3)

`@wildshard/sdk/outputCatalog.writeOutputCatalog(outRoot, entries)` writes
canonical `out/catalog.json` after the caller validates and emits its
products. Each entry supplies the exact index bytes plus title-card,
accent, placement and nullable first-party runtime metadata. The writer
hashes those original bytes, derives `<slug>/shard.json`, and sorts by
card order then slug without mutating its input. It does not load source
manifests or execute shard code.

`@wildshard/format/shardCatalog.parseShardCatalog` admits that bounded JSON
contract. Unknown versions, fields, duplicate slugs/instances/cells and
index path escapes refuse. Thumbnail paths name the shard's hash-named
image blobs relative to the catalog; data-image thumbnails support the
data-only Template. Source `/src/` paths cannot leak into discovery.
This is the catalog contract/emitter prerequisite; the live discovery
switch follows the output writer and closed-runtime migration.

### Verbatim runtime output (P3)

`@wildshard/sdk/outputRuntime.writeRuntimeFiles(project, destination,
{check})` copies only the project's `runtime/**/*.ts` bytes, including
local declarations, into the owned output's `runtime/`. The required
checker receives project-relative paths and decoded source; build
orchestration supplies the repository boundary checker and migration
policy. The published SDK does not depend on repository lint scripts.
All checks finish before output replacement. Symlinks, non-TS files,
overlapping author/output directories and a nonempty runtime missing
`index.ts` refuse. Removed source files cannot linger in the new copy.
The result inventories paths, exact SHA-256, bytes and nonblank code lines
with parser-recognised comments removed, plus total lines and the optional
entry. Source bytes, import spelling and line endings remain unchanged;
there is no closure walk outside `runtime/`. `runtimeCodeLines` exposes
that same parser/comment counting law for author tools.

### Split shardfile loading (P1b)

`game/shardfile/product.readProductDescriptor` reads the v2 index.
An optional trusted `descriptorHash` checks the
exact index bytes before section requests. The reader fetches sections in
parallel, verifies every section's declared size and SHA-256, and assembles
the existing `Shardfile` through `format/outputIndex`'s field schemas.
Today's complete hosts receive all sections. Custom section values remain
available in `game/shardfile/outputDescriptor.outputDescriptor(source)`.

`outputBlobUrl(source, ref, base)` resolves declared references through the
validated v2 kind/hash paths. `ClientAssets` and
admission use the same builder. Transport metadata follows parser copies
without adding fields to the host model. Offline products retain the v2 index
plus hash-checked section bytes in the existing content cache. Publication
requires all section and asset bytes; missing or corrupt sections refuse
before a host is built. Old monolithic descriptor caches are evicted.

### Independently authored platform sections (P2b)

`@wildshard/format/platformDataSections` registers new plain-value sections
separately from the older v1 root-key envelopes. `ui/strings` uses
`UiStringsSchema`: a bounded flat key-to-text table with no code or unsafe
property keys. `world/physics` uses `WorldPhysicsSchema`: raw native ground,
colliders, actors, optional parked actors and herds, with explicit contact
rig and collider provenance. It preserves actor order and encoded buffers.

Build-time `@wildshard/sdk/platformSections.worldPhysicsSection(bake,
{rig, provenance})` extracts those common fields from an unchanged producer
output. Owner-specific encounter, habitat, shelter and hit-volume metadata
must use custom sections and retain their existing owner validation. The
platform section does not replace these checks or decode native buffers.
`emitPlatformSections(map)` validates values and returns canonical bytes
and descriptors with schema ids `wildshard:<name>@1` for the product writer.

The original SDK `nativeBodySpecSchema`, `nativeGroundSchema` and
`nativeColliderSchema` now delegate to defining parsers in
`@wildshard/format/nativePhysics`. Their admission and decoded return APIs
stay unchanged; buffer decoding and native installation stay in the SDK.

### Catalog boot and compiled runtime identity (P3)

`format/level.LevelSectionSchema` holds `{manifest}` with the existing
plain level metadata schema. `ui/card` keeps title presentation separate
from level configuration; code-valued discovery bindings belong to the
copied runtime's optional `discovery()` export, not JSON evaluation.
`game/shard/catalogBoot.prepareCatalogBoot` is an async publication
barrier: all level reads and identity checks finish before a caller
installs the result. It does not evaluate play code for title discovery.

The composition root's `outputRuntimeRegistry` pairs the literal
`/out/*/runtime/index.ts` lazy glob with the corresponding emitted index
runtime inventories. `compileCatalogRegistry` fingerprints sorted
`[path,hash,bytes,lines]` tuples using
`format/shardCatalog.runtimeInventoryBytes`; the catalog writer uses the
same representation. `loadCatalogRuntime` checks identity/revision and
catalog, compiled and admitted-product inventory hashes before evaluating
code, refusing an incompatible offline product. Native runtime entry
selection stays separate from this page entry. The catalog writer
regenerates the complete list, writes it in an owned temporary directory,
and renames `catalog.json` atomically; readers see a complete old or new
catalog. Build orchestration serializes publication of each output root.
This spike leaves live discovery on its existing path until runtime
closure, level emission and the full asynchronous composition are wired.

`wildshard build <project> <output> --copy-runtime` enables the strict
copied-runtime build path (`buildProject` option `copyRuntime: true`). It
copies the complete TS inventory before the format-2 writer, preserves
the admitted runtime entry, and runs
`sdk/outputRuntime.proveRuntimeData(destination, index, mirrors)` before
the build succeeds. Repository orchestration injects the raw P0 boundary
checker through `runtimeCheck`; ordinary SDK output admission also checks
imports on the actual copy. There is no migration allowance or source
fallback. Current app builds opt in together when their runtimes close.

The proof reads hashed emitted custom JSON and evaluates only the copied
`runtime/sections.ts` and `runtime/const.ts` namespaces using an in-memory
Node build. It never executes either page or native entry and emits no
JavaScript artifact. `validateRuntimeData` requires a synchronous Valibot
schema for every custom section, refuses undeclared schema keys and
parses emitted values. The config's `mirrors` export is checked with the
defining `runtimeMirrorIssues` comparer. A failed proof removes the owned
product, including its validation receipt. Client runtime code is
compiled into the app and never imported from a remote JavaScript URL.

### Named author blobs (P2b)

`@wildshard/sdk/blobs.nameBlob(name, kind, bytes, options)` owns and
admits binary assets, derives their content hash, measured minimum costs
and `blobs/<kind>/<hash>.<extension>` path. Logical names remain in the
index. `emitNamedBlobs(rows)` revalidates the bytes and returns sorted
`files` and an `assets` map for output admission; duplicate names, aliases,
mutated bytes and understated costs refuse. Host configuration uses sections;
large client-only JSON bakes may use named `json` blobs. Admission checks
fatal UTF-8 and JSON syntax, and the existing async consumer must parse
the verified `product.file(name)` bytes with its strict defining schema.
Textual glTF cannot enter as a JSON blob.

`readNamedBlob(project, name, source, kind, options)` reads bounded local
files after resolving symlinks within the project. Textual `.gltf` sources
compile to a self-contained GLB through the existing SDK bake dependencies;
local and embedded resources are bounded, remote/escaping resources and
unsupported extensions refuse. No textual GLTF is emitted as JSON or bin.
Simulation declarations belong to platform sections and hosts, not copied
runtime code; custom-section policy and exit rows remain writer-owned.

### Build-validated custom section types

`ShardProduct.section<T>(name)` reads a custom section synchronously using
its generated declaration type, without importing a runtime schema. The
build-only `generators/sections.ts` registry owns validation; the section
schema producer emits wire schemas and standalone
`runtime/productSections.generated.d.ts` declarations from that same registry.
Missing, streamed and absent-product reads keep the normal product refusals.
Checked products deep-freeze these values; schema-backed reads remain
available for external or unconverted readers. Immutable product content
uses this path; saved state still validates at its continuation boundary.
`ShardProduct.json<T>(name)` reads large build-validated named JSON with
the same generated types, fatal UTF-8 decoding and verified file reader.
Its defining schema parses the payload in the generator before emission.

Build-only `generators/sections.ts` may also declare `FILE_SCHEMAS` for
immutable `data/` or `boot/` JSON imports. The compiler validates those files
and emits standalone `.d.json.ts` companions, including tuple shapes. Both
the raw file and its companion are declared generation-job inputs/outputs;
the runtime imports only JSON and generated types. Dynamic data and save
continuations retain their boundary validators.

### Product loading and build-pinned assembly (P2a)

`game/shardfile/runtimeProduct.loadShardProduct(slug, options, scope)`
loads the output index and all sections before the first plugin hook.
Concurrent requests share a product; each live scope leases its roots
and sections, and the last lease removes the cache entry. Failed reads
retry. `loadManifestProduct` runs at the standalone/plugin boundary;
`shardProductFromAdmission` reuses a grid admission without fetching its
descriptor again. `loadFirstPartyProduct` uses the configured first-party
base for early readers and requires the same live owner.

A build-owned validation receipt pins both the canonical index digest
and assembled host-model digest. Only that exact root skips section and
full-model schemas; section bytes still pass their declared sizes and
hashes. A changed index falls back to checked admission, and a changed
assembled source refuses. External inputs retain schema validation.
Custom section schemas run on read in checked/proof products. No network
sidecar or authored receipt can grant this trust.

`configuredShardfile(document, options)` awaits the same section reader
for the SDK client's embedded index. Installed data-client manifests
retain their admitted product, so session context creation reuses its
sections and file reader instead of loading a descriptor a second time.

### Built level image packing and catalog scan (P3)

`@wildshard/sdk/projectManifest.manifestImages` lists the image inputs in
plain level metadata. `packManifestImages(folder, metadata, images)`
requires those exact bytes, admits still images through `nameBlob`,
deduplicates identical content and returns the rewritten metadata plus
named blobs. Project declaration intake charges new hashes once. Inline data
images remain inline; absent bytes refuse. Emitted level image URLs are
bounded `/shardfiles/<folder>/blobs/image/<sha256>.<webp|jpg|png>` paths.
No runtime source image import or missing-image fallback is introduced.

`@wildshard/sdk/outputCatalogScan.writeCatalogFromOutputs(out, placements)`
regenerates discovery from every published product directory. It reads
only output indexes, current index-hash receipts, `ui/level`, `ui/card`
and the referenced image blobs, verifies their hashes and emits the
complete catalog by atomic rename. It does not load all product assets,
read a source manifest or patch a prior catalog. Missing level, card,
placement, image or copied page runtime refuses before catalog publish.
These are build-only preparation APIs; app activation follows the writer
and standalone-runtime migration.

### Sectioned output writer (P1)

`@wildshard/sdk/outputProduct.writeOutputProduct` emits the format-2 index,
canonical platform/custom sections and kind-specific immutable blobs.
`validateOutputProduct` checks the on-disk inventory, exact hashes and
sizes, binary headers and costs, platform schemas and emitted custom JSON
Schemas. Unlisted files, symlinks, unknown majors, changed section bytes
and understated costs refuse. Logical blob names remain in the index.
Validation receipts pin the validator, assembled source and exact index.

The format-2 writer adds `gridReady` structural evidence to that same
receipt after full on-disk asset admission. The defining
`format/gridReadiness.structuralGridEvidence` records L0 baked-tile presence,
four edge profiles, all four y=0 midpoint openings and their full 8 x 15 m
terrain/mesh/socket/prop/collider/water clearance, and the HUD palette accent.
The report checks both the receipt binding and its agreement with emitted
sections; runtime closure is independent. Unclosed products can have grid
facts while their custom percentage remains unavailable.

G458 memory and look/travel verdicts require measured exact-source-SHA
receipts. Declared costs never supply a memory reading. The report accepts
qualified native WebContent-plus-labelled-GPU soak peaks and completed
Safari milestone grid windows for the shard actually entered. It hashes
the receipt bytes, uses current memory caps and lets the latest eligible
observation override an older pass. Missing/stale/incomplete readings stay
unknown. Current frame-floor receipts have no native memory field, so their
GL allocation journal alone cannot pass memory. No runtime is installed.

Runtime copies may import only installed public exports of
`@wildshard/engine`, `@wildshard/game`, `@wildshard/sdk`,
`@wildshard/format`, exported Three.js modules and the Valibot root, or
TypeScript within the same copied runtime. Node, commons, private package
paths, asset imports and computed imports refuse. G304 private-binary
classification and G453 asset budget targets remain report-only; structural
admission and truthful parsed costs remain enforced. Runtime copying and
its data-boundary checks are supplied by the runtime output integration.

### Product-built hybrid host rows (P2a step 5)

`game/plugin/headless.HybridRuntimePlugin` calls its protected
`rows(product: ShardProduct)` factory during `world()`, before strings
and world construction, and retains the result for kit/play. The factory
runs once per plugin; an absent product refuses before publication, and
another product cannot replace an initialized plugin's rows. A refused
factory publishes no partial rows and may be retried with a valid product.

`HybridRuntimeRows` has no source field. All existing quest, held-item,
channel, audio and population hosts receive the admitted product's
`shardfile`; no second source parser is installed. Row factories can read
platform sections synchronously at load time. Simulation declarations
remain sections consumed by hosts, outside copied shard runtime code.

### Bundled output publication (P1)

First-party builds publish every product under `out/<slug>` using the
format-2 writer. The build cache uses a new content-key namespace and
publishes complete directories by replacement. The app copies these
products to `dist/shardfiles/<slug>`, excluding transitional runtime
sources. It refuses missing or stale receipts, checking the validator,
assembled-source and exact index hashes before bundling. SDK clients
embed the same index and resolve sections relative to their document.

### Loading program experiment (G451)

`engine/render/programRetention.retainRendererPrograms(renderer, owner,
camera, scene)` lends already compiled native programs an ordinary
material-owned cache reference until `owner` retires. Captures are
idempotent and bounded to 512 keys; normal material disposal releases
both Three's program list and key map. It retains no source geometry,
textures or live material uniforms. Driver storage is opaque: the grid
reserves a conservative 256 KiB per possible key and reports native
loading memory separately.

The reload Debug row **Grid programs during loading** defaults off.
When enabled, an owned grid prepares the single selected admitted
cell under the loader, cancels entry, retains programs and retires the
temporary world before initial entry or saved continuation restoration.
Saved continuation semantics and ordinary off-mode ordering stay unchanged. This risky render/memory lifetime
experiment remains off pending device evidence and a green quiet frame
floor; see `docs/reviews/grid-loading-programs.md`.

### Product-built hybrid host rows (P2a step 5)

`game/plugin/headless.HybridRuntimePlugin` calls its protected
`rows(product: ShardProduct)` factory during `world()`, before strings
and world construction, and retains the result for kit/play. The factory
runs once per plugin; an absent product refuses before publication, and
another product cannot replace an initialized plugin's rows. A refused
factory publishes no partial rows and may be retried with a valid product.

`HybridRuntimeRows` has no source field. All existing quest, held-item,
channel, audio and population hosts receive the admitted product's
`shardfile`; no second source parser is installed. Row factories can read
platform sections synchronously at load time. Simulation declarations
remain sections consumed by hosts, outside copied shard runtime code.

### Project output exports (P2b)

`shard.config.ts` may export `output` alongside its default declaration.
`blobs` contains plain `{name, kind, source, options?}` rows; the CLI reads
project-contained sources and compiles textual glTF into GLB. Author
configs need no filesystem import. In-memory `nameBlob` / `emitNamedBlobs`
results enter as `namedFiles: emitted.files, assets: emitted.assets`.
`custom` accepts `emitDefinedSections` and `platform` accepts
`emitPlatformSections`. `buildProject` always emits format 2 and passes
these extensions to the same disk-validating product writer.

`@wildshard/sdk/projectOutput.mergeProjectBlobs(source, assets, blobs,
namedFiles?)` admits new bytes and library closure costs once. Reused
content keeps its original declaration, conservative costs and logical
name; conflicting bytes, kinds or names refuse. The helper returns
`{shard, assets, namedFiles}` without mutating its inputs, so manifest
image packing uses the same accounting as source blobs.

`readProjectAssets` also returns `output` writer options and the config's
`mirrors` export. Mirrors are validated plain build data; loading them
never imports copied runtime code. Runtime mirror verification/copying
remains the separate build step. Config exports cannot inject writer
runtime inventories or policy allowances.

### Runtime and native product boundaries (P2a step 4)

`game/shard/runtimeVariant.prepareStandaloneHybrid` uses `ctx.product`;
its rows and `firstPartyStandaloneEntry` no longer accept a source
loader. `prepareHybridShard` takes that loaded product and never fetches
its descriptor again. Frozen callers may provide structural identity;
the loader ignores their data and loads their format-2 output instead.
Bundled runtime selection remains separate from data admission.

`@wildshard/sdk/headlessProduct.loadHeadlessProduct(outDir)` reads only
the selected local format-2 inventory. It checks section sizes/hashes,
the host schema, and each named blob's size/hash on read, and refuses
escaping symlinks. Its product checks custom sections against the
runtime's schemas. Native factories require
`HeadlessRuntimePreparation.product`. The existing trusted resident and
adapter input boundaries accept an explicit product or load `out/<slug>`;
a missing output says `run wildshard build <slug>` and has no fallback.
The existing `shard` field remains for native proof overrides until Z1.

Disk and embedded descriptors now require format 2. There is no v1
reader, previous-version migration or bare-hash blob URL fallback.
Browser descriptor caches use the v2 namespace and evict the old one;
immutable content-addressed asset caches retain valid shared bytes.
Normalized in-memory Shardfile inputs remain the current host API.

### G454 host callbacks and catalogue

`wildshard/no-shard-host-callback` resolves play-code calls into engine,
game and SDK signatures, including inherited methods and function aliases.
Each explicit function value (including named/spread option fields) is a
ratcheted site in `lint/ratchet.json`; existing file counts may only shrink.
Build-only sources and exact registered legacy predecessors are excluded.
Opaque engine services are not expanded into their inherited methods.
Unresolved/dynamic calls require review; this static check is not a proof of
absence. New host APIs take data or Wasm references instead of shard TS hooks.

`pnpm gen` writes `lint/host-catalogue.generated.json` and
`docs/api/HOSTS.md`: resolved host callers, callback sites, planned W3 users,
all platform section fields, the wire schema field inventory and the exact
Wasm import/export ABI. Proof/input-only generation skips derived docs.
Resolved calling shards are candidates, not proof of live adoption: orphaned
source can contain calls too. Pending users never prove real use. Observed
callbacks fail the data-only test. Other semantic
judgments remain `needs-review`, granting no pass. The historical host audit
is linked as evidence, not silently treated as a current verdict.

`lint/host-reviews.json` accepts entries keyed by `src/<layer>/<module>#export`
(or `#*` for a module), with `sourceHash` (the catalogue's SHA-256), `evidence`
and `verdicts` (`twoRealUsers`, `noShardNouns`, `dataOnly`, `serverSafe`, `deletionTest`, each
`pass` or `fail`). Changed source invalidates review credit; a review cannot
override observed TS callbacks or substitute a planned user for a real one.

G456 H1 retains two content closures solely to preserve frozen callers.
`engine/world/waterSurface.ts` belongs to Pine: frozen `world/PineWeatherFX`,
`streams` and `beaverPool` still call `createWaterMaterial`; the shared pond
also uses its material and skyline probe. `engine/world/painterly.ts` belongs
to Nalati: frozen `look/terrainPainter`, `look/creatureMaterial` and
`world/glbPaint` still use its factory and per-material knobs. Frozen shaders
also share its uniform objects, which `game/grid/regionLight.ts` snapshots.
These shader/preset bodies get no shared-host credit; their unchanged source
hashes and owning shards are recorded in `lint/host-reviews.json`. Generic
state/math stays public; no platform module imports a shard, and no frozen
source changes. `game/systems/viewmodel/armRig.ts` remains an H3 review:
Nine runtime and Driftwood's `blender/fp-arms/bake.mjs` are real users.

### CLI-only output sidecars

An author project may put its named `output` export in `generators/output.ts`.
`readProjectAssets` compiles that module independently at build time, with
normal config boundary checks and output admission. The config cannot also
export `output`. This keeps section emission and hashing outside the browser
import graph while existing client code still borrows `shard.config.ts`.

### Authored level metadata in output builds (P3)

`projectManifest.readManifestSource({folder, file, imageRoots}, declared?)` is an
explicit build-only input. With `file`, it reads bounded JSON; without
it, it accepts only metadata explicitly declared in the config product.
Still images are read through caller-declared `{prefix, directory}` roots. Each image must match exactly
one prefix and stay inside its real filesystem root; missing, ambiguous,
traversing and escaping symlink paths refuse. No TypeScript manifest or
runtime source path is evaluated. Pure in-memory manifest packing remains
usable without loading file services.

`buildProject` accepts this descriptor as `manifest`; `readProjectAssets`
accepts it as its third argument. The repo CLI wrapper supplies authored
`manifest.json` plus the project's image root and public assets root.
The SDK itself discovers no source files when this option is absent.
When both the optional file and config metadata are absent, no level is
emitted; there is no TypeScript manifest evaluation or source fallback.
Existing configured metadata must agree with the authored JSON. Packed
metadata enters `ui/level`, and every image URL names its immutable
`/shardfiles/<folder>/blobs/image/<hash>.<ext>` output.

Manifest images use `mergeProjectBlobs` with the existing source outputs
and map. Content already admitted keeps its original name, dependencies
and conservative costs. Only new reachable library content is charged;
a map also used by the card or level is one file and one cost. Title
catalog generation subsequently reads this output, never the source
manifest or source image paths.

Image blobs use `format/stillImage.parseImageAsset`: wide texture strips
may reach 8192 pixels per axis but at most 4096² total pixels, with the
same 4 MiB wire, format/header and no-animation checks. This admits the
existing 6144×704 horizon without changing its bytes. The title's
`parseStillImage` keeps its 4096-per-axis limit. Image blob cost and
extension readers share the asset parser; decoded/GPU accounting stays
byte-derived.

### Complete catalog build orchestration (P3)

`node scripts/build-shardfiles.mjs --catalog` builds every first-party
product with `--copy-runtime`, including the strict runtime boundary,
section-schema and constant-mirror proofs, then regenerates discovery
from every output. The game supplies grid placements; all title metadata
comes from validated output sections and image blobs. The author CLI
`wildshard catalog <out-directory> <placements.json>` admits a bounded
array through `ShardCatalogPlacementsSchema` before scanning outputs.
A declared placement without its output refuses publication.

Catalog generation runs once after all product and map checks pass.
Failure preserves the previous catalog. `--catalog` refuses `--shard`;
ordinary and partial builds remove an obsolete catalog. The orchestration
option `copyRuntime:true` also proves selected products without
publishing discovery; this supports per-shard output measurement. Vite publishes
`out/catalog.json` as `dist/shardfiles/catalog.json`, alongside data
products but without runtime TypeScript or build-cache stamps.

This strict complete-build mode is opt-in until client runtime closure.
The live title still uses its current discovery path. Switching that
reader must enable `--catalog` in the app, push-gate and Vercel build
commands in the same commit, so no shipped reader lacks its catalog.

### Decision-script v1 transport and host contract

`format/scriptAbiV1` defines the numeric event/read/list/command tables and
`scriptV1Layout(states, params)`, the bounded little-endian f64 IO layout.
Header slots 5–7 are reserved zero. The admitted row supplies slot counts;
there are no hidden capacity fields. View command ids start at 100.

`engine/script/decision` implements the renderer-free `DecisionHost`:
`enqueue(binding,event)`, consecutive 60 Hz `step(tick)`, logical
`snapshot`/`restore`, named `state`, and per-binding `metrics`. Decision
calls stage validated commands and proposed state until the next fixed
step. Snapshots include staged calls, pending events, timers and RNG;
restore validates everything and re-prepares staged transactions without
entering Wasm. Engine adapters supply read/list queries and a read-only
`prepare` returning an atomic, non-throwing commit. Optional trace observers
are tooling ports, never shard-authored callbacks. The authoritative world
adapter checks actual actor ownership and row-specific field bounds during
`prepare`; it must not mutate the world until its non-throwing commit.

Construct with resolved declarations/bindings, verified module bytes keyed
by their content address, a two-u32 seed and the engine world adapter. One
instance per module key (eight maximum) rewinds its initialized memory and
mutable globals before each binding call. AS `__start`, when exported, runs
once before `ws_init`; neither runs during restore. Parameters use sorted
name order, state slots authored order. Actor/player slots require one
binding per script/owner with a nonzero `self`. The sim host refuses view
scripts until their first real client user supplies that implementation.

`engine/script/decisionModule.prepareDecisionMemories(pages, owner)` prepares
fresh fixed-size v1 memories from admitted page counts before synchronous
controller construction. Live preparation allocates at most one memory per
completed game draw; loading and Node use ordinary tasks. It runs no guest
code. Only the owner and its descendants consume a matching allocation, once;
unused memories leave with the owner. Invalid/changed plans and cancellation
refuse. Constructors still admit the actual bytes and initialize their own
module/global image at the original point. The page decision authority derives
this inventory from `sim/scripts` and `actors/spawn-scripts` for both creature
and encounter consumers; the v0 preparation path remains separate.

`fetchImage` keeps counted network reads and header-based size selection on the
page, then decodes its Blob in one page-owned image worker with the same bitmap
options. Completed ImageBitmaps transfer back without a canvas copy. The worker
serializes native decodes, ends after 30 idle seconds and rejects all pending
requests on failure/disposal. Unsupported workers and failed jobs use the original
page `createImageBitmap` API, then the existing image-element fallback. KTX2
transcoding and its format probe are independent of this image decode path.

Calls consume at most 16 queued events and emit 32 commands, four spawns
and eight timer writes. A decision tick caps 64 calls and 128 commands.
Reads/list writes enforce declarations, observed handles and memory bounds;
list scratch holds at most 96 f64 values (32 three-coordinate path points).
The production handle path reuses IO views, command pools and scratch;
tooling traces and logical snapshots copy their observations explicitly.
Fuel defaults to 400k/call and 2M/decision tick; optional limits stop at
2M/call and 8M/tick. A refusal preserves durable slots, RNG and world, and
three failures disable the binding until a declared start/restart. Timers,
seeded RNG, queued events and validated next-step calls all survive saves.

### Decision-script scenario core

`@wildshard/sdk/scriptScenario.createScriptScenario(DecisionHost, input)`
drives the production host with built module bytes, resolved script and
binding rows, a seed, and a small declared world. It advances consecutive
60 Hz steps; `send` reaches the next decision and following commit step.
`advance(seconds)` accepts whole fixed ticks. `commands`, `trace`, `state`
and `maxFuel` inspect real host outputs; a fuel query with no calls refuses.
Named event arguments and command expectations use the row's id maps.

`ScenarioWorld` answers actor/player/zone/flag reads in deterministic order.
Physics/navigation answers must be explicitly declared; random and timers
belong to the host. Native movement completion is an explicit test event,
not another movement implementation. Logical saves include host and fixture
observations; restore rolls observations back if host validation refuses.
The constructor port takes the real host, never a substitute Wasm runner.
`scenario(folder,id,{seed,products?,actors?,players?})` reads only a published
format-2 output (default root `out/`). It hash-verifies sections and the selected Wasm,
uses the defining actor/move/spot binding registry and runs the actual
DecisionHost. Missing output or bytes refuse; it never builds, compiles or
imports author/runtime modules. Actors default to declared three-dimensional
spawn poses. Retained actors with only XZ metadata require explicit XYZ
fixtures, named by the script alias or the actual actor id. Public field
bounds come from the product and cannot be widened by a fixture.
`product.sectionHash` and `product.indexHash` bind observations to disk bytes.
The gate builds published outputs once before selected disk scenarios; the
Template save/restore sample consumes these outputs inside its two-second
scenario budget. Standalone test setup builds outside the timed scenario.

### Lossless named GLB compression

`readNamedBlob(project, name, source, 'glb', {meshopt:true})` encodes
buffer views with `EXT_meshopt_compression` at build time. Project output
blob declarations accept the same `options.meshopt` flag. The intake keeps
the candidate only when its gzip-9 size does not exceed the original;
otherwise the original bytes are admitted. This is lossless:
there is no quantization, welding, index reordering, scene or material
change. Already compressed GLBs are admitted unchanged, without a flag.
The output stays a named `blobs/glb/<hash>.glb`; the existing engine
meshopt-capable GLTFLoader decodes it.

`format/glbBuffers` checks physical BIN ranges, declared virtual fallback
buffers, modes, strides, filters and aggregate decoded caps before decoding.
The existing parser then validates positions, indices, skin, animation and
triangle accounting against those decoded bytes. Compressed wire bytes
and decoded resident costs remain distinct. The format layer's sole codec
exception is this defining module importing the already-pinned
`meshoptimizer/decoder` (1.2.0): server-safe pure Wasm needed for decoded-byte
admission, not a schema bypass. Its initialization is awaited once; each
view is decoded once per admission and reused by all subsequent checks.

`admitScript(bytes, 1)` checks the v1 signatures and the same structural
fuel/depth/finite guards as v0, with fixed memory of 1–4 pages and no
`memory.grow`. `compileScript(source, { abi: 1 })` defaults to one fixed
page; `maximumPages` selects another fixed size up to four. Omitting `abi`
preserves v0's one-page initial memory and 64-page maximum. Both versions
use the pinned coarse G457 function/loop fuel instrumentation.
### Closed shardfile boundaries (Z1)

The P0 lint rules accept `closedShards` for completed migrations. These
shards receive hard errors even if an obsolete per-file ratchet still
records an allowance. Template is closed for all three rules. The native
Blender Template, Ink Cel Valley and Pastel Plain products are closed for
`runtime-standalone`; their remaining build/discovery bridges retain the
existing shrink-only ceilings. New files still start at zero everywhere.

Scenario fixture transactions verify physical actor/player kind and
binding ownership as well as the host's known-handle/capability checks.
Player-scoped flags stay separate. Actor fields must be declared;
`ScenarioActor.fieldBounds` optionally supplies min/max/integer rules
(absent bounds declare a finite f64 fixture field). Full-batch refusal
leaves all observations unchanged, including during staged-save replay.

### Decision-script section admission (KA1)

`format/decisionScripts.DecisionScriptsSchema` defines the plain
`sim/scripts` platform section. `parseDecisionScripts` rejects non-JSON
input before reading properties. Rows declare ABI `1.0`, an immutable
`blobs/wasm/<hash>.wasm`, authored `.as` source, encounter/quest/zone or
`{shard:true}` binding, capabilities, local aliases, state and parameters.
The registry and SDK `emitPlatformSections` share this defining schema.

Local admission bounds modules, IO dimensions and fixed pages; verifies
side-specific events/reads/commands, 1/2/5/10 Hz tick subscriptions, typed
state defaults/ranges and generated identifiers. View slots are `local`;
simulation slots are binding/actor/player scoped. Lists are named in the
same `reads` capability list as scalar reads. `scriptV1Identifier` refuses
reserved names and the row refuses aliases that collide after conversion.

`decisionScriptRules(rows, references)` requires facts from admitted
platform registries: module ABI/pages, each named reference, binding ids,
and consecutive `script:<id>` migrations reaching the latest state version.
It never treats aliases in the script itself as evidence of a real target.
A3/A6 supply those real registries while building/resolving scripts; missing
registries refuse. Byte admission uses `admitScript(bytes,1)` and the v1
compiler contract; existing v0 bindings remain separate until their Z row.

`@wildshard/sdk/decisionBindingMap.decisionBindingMap(row, registries)` is
the common generated-binding/resolver/scenario map. It uses authoritative
per-kind positive handles and refuses missing, duplicate or unsafe ids.
Actor handles are never allocated from alias order or hashes. Timers alone
are local sorted names with 1-based ids; parameters sort by name and state
slots retain authored order. The inverse maps provide readable labels.


### Decision module byte contracts

`format/scriptContract` defines `ScriptContract`: `{ abi: 0 }` for the
legacy host, or `{ abi: 1, pages }` for a fixed one-to-four-page decision
module. `admitScriptContract` checks the declared ABI, instrumentation and
exact fixed memory without executing the guest. `assetCost` and
`assetOverdraw` require this explicit contract for Wasm.

`nameBlob` / `readNamedBlob` accept `options.script`; `NamedBlob` retains
that build-only contract across revalidation. It never adds an ABI field
to the output index. Format-2 emission and disk/browser admission derive
v1 contracts only from the verified `sim/scripts` section and exact
`blobs/wasm/<hash>.wasm` inventory paths. A legacy Wasm file declaration
retains its v0 contract when no decision row names it. Missing v1 rows,
page disagreement, mixed legacy/decision hosts and conflicting module
contracts refuse. Sim decision modules belong to critical; view decision
modules belong to the library. Both charge live and initial memory images
at their fixed page count, once per module, before budget admission.

`outputDecisionScripts(platform)` verifies emitted section hash/size and
reads its rows for author-side admission. `admitProduct` and
`validateProject` accept these rows explicitly; the project admission
callback receives them as its fourth argument. The full
`validateShardfileAssets` validator accepts them after its optional device
arguments. Browser products obtain the same rows from their checked output
descriptor; no byte-sniffing or opaque Wasm fallback is used.


### Fixed-step actor moves (KA5)

`@wildshard/format/actorMoves` defines the plain `actors/moves` section: bounded, uniquely named orbit, stalk, dive, climb, takeoff/perch, rise/lie, ring-run and burrow/surface rows. `actorMoveRules` resolves perch spots, strike ids and pose fields against actual platform registries. The defining schema is emitted with the format schemas.

`@wildshard/engine/ai/moves.ActorMoveRunner` runs one admitted move at 60 Hz from data observations and emits steering, bank, normalized field, strike and one-shot completion requests. The platform applies requests through its existing flight, collision and strike owners, then publishes `move.done`; the runner never moves a body or damages a target itself. Missing targets, named perches, strike range or field values refuse before clocks change. `snapshot`/`restore` retain the declaration identity, clocks, orbit angle and completion latch without invoking motion or repeating completed effects.

The public steering kernels serve both admitted decision guests; the raptor and phased policies are deleted. No phase policy, renderer, shard callbacks or random source enters this library. A stalk declares exactly one of `above`/`altitude`; range readiness borrows the admitted strike range. Takeoff explicitly declares its destination altitude and named perch. Dive contact is authoritative `reach`, with the declared strike requested once; a timeout completes with `ok=false`. Orbit and ring-run continue until replaced, timed/ready moves finish once.


### Mover endpoint lifecycle (KA7)

`@wildshard/format/movers` admits optional `atEnd: {field, equals}` and `restoreFrom: {flag, action: "end"}` rows. The latter requires a real one-shot track/hinge endpoint and normalized progress field 5 equal to 1. Unsupported loops/drivers refuse; numeric legacy commands are not treated as load operations. `kind: "channel"` is a track with no colliders, suitable for a sim-owned scalar/visual pose; it allocates no native physics body.

`@wildshard/engine/sim/moverLifecycle` observes committed fixed-step fields and retains edge latches plus a bounded 64-event FIFO. `MoverRuntime.drainEndEvents()` returns `{mover, atEnd}` edges for the platform's declared signal routes; drain each fixed step. These are distinct from the actor `move.done` ABI event. Snapshot/restore retains undelivered events and refuses incompatible declarations atomically.

Fresh installations pass saved flag DATA as `restoreFlags: ReadonlySet<string>` through `installDeclaredMovers` or native `MoverScriptDriver.install`. `moverEndState` resolves an admitted track's final pose and stopped progress without executing its guest or advancing time. The platform validates the whole replacement state before publishing it and seeds endpoint latches without emitting a completion, quest write or reward. Native checkpoint restore keeps its own world/guest continuation and lifecycle latches; it does not rerun durable flag restoration. Existing movers without these rows retain their current command/physics law.

### Native decision section transport (KT2)

`@wildshard/sdk/headless.HeadlessSimulation.create` accepts optional
`options.sections`: the admitted `sim/scripts` and `actors/moves` payloads.
The parent parses them before asset admission and sends owned plain values
to the worker, which parses them and verifies the same explicit Wasm
contracts again. No ABI is inferred from an asset. Omitted sections retain
the v0 path; v1 bytes without their declared rows refuse. The author build
passes its decision rows into this boundary before measuring the native
simulation. Decision execution/event wiring remains KA6; KT2 exercises the
real DecisionHost separately, rather than inventing a second interpreter.

### Declared decision author compilation (KA3)

`@wildshard/sdk/decisionScriptBindings.generateDecisionBindings(row, registries)`
uses the defining format binding map to generate only declared constants,
state/parameter accessors, reads, commands and subscribed event dispatch. The
`@wildshard/sdk/as/ws` core owns the v1 IO layout and bounded list/command buffers.
Guest sources stay virtual compiler inputs, outside the host TypeScript program.

`@wildshard/sdk/buildDecisionScripts.compileDecisionScripts(rows, registries,
authoredSources, options)` compiles and meters those inputs, then admits each
module with its declared v1 page contract. `buildDecisionScripts` reads bounded
project-owned `.as` files and refuses symlinks. The parser checks handler
subscriptions and counts all authored `.as`, including unused sources, without
comments or blank lines. Generated code never counts. Root adapters supply the
sealed `decisionLegacyLines` denominator (10 percent); standalone projects must
declare `asLineCeiling`. No SDK module reads repository policy.

### Direct held secondary contacts (KS2)

A weapon's admitted `secondary: {action, move}` selects its secondary contact
without a script. `hook` must be null. A declared `code` retains the existing
actor-bound script requirement; missing hooks still refuse. Page held owners and
the renderer-free melee owner claim the same contact-family cooldown and land
in their original phase. The Sky fan uses this row instead of an item Wasm
module; contact targets, damage and impulses remain on the existing owner.


### Declared decision author compilation (KA3)

`@wildshard/sdk/decisionScriptBindings.generateDecisionBindings(row, registries)`
uses the defining format binding map to generate only declared constants,
state/parameter accessors, reads, commands and subscribed event dispatch. The
`@wildshard/sdk/as/ws` core owns the v1 IO layout and bounded list/command buffers.
Guest sources stay virtual compiler inputs, outside the host TypeScript program.

`@wildshard/sdk/buildDecisionScripts.compileDecisionScripts(rows, registries,
authoredSources, options)` compiles and meters those inputs, then admits each
module with its declared v1 page contract. `buildDecisionScripts` reads bounded
project-owned `.as` files and refuses symlinks. The parser checks handler
subscriptions and counts all authored `.as`, including unused sources, without
comments or blank lines. Generated code never counts. Root adapters supply the
sealed `decisionLegacyLines` denominator (10 percent); standalone projects must
declare `asLineCeiling`. No SDK module reads repository policy.

### Simulation decision wiring (KA6)

`@wildshard/game/shardfile/decisions` defines `ShardDecisions` over one
existing `SimHost`. `ShardfileSimPorts.sections` lends verified platform
payloads; the ordinary page, grid regional host and isolated SDK worker
all install the same v1 decisions. There is no author-module evaluator.

Encounter, quest and region bindings enqueue start/stop events. Combat,
flags, actor move/strike completion and KA7 mover endpoints enqueue ABI
records for the next decision tick. A decision-owned encounter keeps its
existing boss/checkpoint/reward owner and replaces only its default
steering/strike policy. An actor with another brain refuses.

All commands validate before the next fixed-step commit. Selected strikes
use `SimHost.registerStrikeCatalogue` / `startDeclaredStrike` on the
existing runner and contact pipeline. Logical snapshots include enabled
bindings, queued/staged decisions, move clocks, public fields/channels and
completion latches. Restore never enters Wasm. Page and native mover
installers forward the actual saved flag set to KA7 endpoint restoration;
loading neither invokes a guest action nor emits an endpoint event. SDK worker observations
include actual v1 fuel and call CPU, and refuse failed calls.

`simulation.decisions.publication()` exposes numeric public actor fields,
channels, cues and move/strike starts, detached from authoritative state.
The SDK publishes the same schema-checked packet in
`HeadlessTickCommit.decisions`, so worker consumers receive actual data.
`publish(event)` and the native picker enqueue observations without
synchronous script execution. `DecisionHost.setEnabled` suppresses periodic
work while permitting explicit final inboxes to drain.

Spawn/despawn, impulse and weather declarations currently refuse without
an admitted mechanic owner. Named spots/perches also refuse until their
platform section exists. The sim world-target contact section is the next
KA6 slice; interaction prompts are not treated as strike targets.

The author build reads `sim/scripts`, resolves its constants through
`buildDecisionRegistries(source, moves)` and recompiles every decision `.as`
entry before reading named assets. It replaces old producer module hashes and
re-emits the canonical section, admitting only the newly built v1 contract.
Standalone `shard.config.ts` exports `buildOptions = { asLineCeiling: N }`;
the official root CLI supplies sealed legacy counts instead. The ruler and
root adapter share `scripts/decision-legacy-lines.mjs`, including exact generated
producer exclusions. Template's handlers use this same compiler and no private
ABI glue. Generated bindings are virtual `behaviour/generated/<camelId>.ts`.

### Quest mover endpoint bindings (KS2)

`MoverRuntime.atEnd(id)` reads the admitted lifecycle latch, including silent
load/restore seeding. It refuses undeclared endpoints. Native motion observation
rows select it with `atEnd: true`; old observations keep their enabled-pose law.
Page quest stage bindings use `movers: [{id, mover, stage, toast?}]` to read the
same endpoint and dispatch its existing stage on the fixed-step edge. The
platform drains edges and emits an optional toast once; restored endpoints
never replay that toast. Hinge endpoint restore retains the fixed yaw/roll.

Hybrid page play installs its runtime-bound updraft rows on the existing
impulse owner in `fixed.pre`, with the actual player position and board state.
The runtime presents the wind and winch; their force and completion bindings
live in the platform. Gust target scanning remains a separate KS2 adoption.

### World contact section (KA6)

`world/targets` holds `{targets, spots}`. Targets name a weapon and immutable
XYZ/radius, one cone/all or ray/nearest scan law, flag conditions and ordered
move/contact rules. Contact numbers are landing ordinals within the move.
Effects select declared interactions, durable flags and hints; `caught` is
independent of effect acceptance. Rays borrow the landing's actual reach and
width (light and heavy retain distinct ranges). Nearest geometry is selected before gates,
so an unresponsive front target never exposes another one behind it.

`WorldTargetHost` in `@wildshard/game/shardfile/worldTargets` uses
`StrikeRunner.contact`, with full 3D cone/ray aim. Attach it through the
existing `ContactFamily.bindWorldTargets` or `HeldMeleeWeapon.bindWorldTargets`
landing owner. It adds no step, input, guest, body or clock. Platform quest
installation lends its existing interaction/flag/hint owners; shards supply
only the section data. Sky gust and Signal lash are the adoption consumers.

`worldTargetSpots` in `@wildshard/format/worldTargets` resolves named immutable
XYZ/yaw points for the move owner. `buildDecisionRegistries` accepts that
same section as its third argument; compiler and runtime must both pass it.
The writer and full validator check target move/contact and flag/interaction
identities; worker admission transports the same validated section.

### Borrowed decision authorities (KS1 / KS4)

`game/shardfile/decisions.DecisionRuntime` is an internal game-owned port
for `ShardDecisions`, implemented directly by `SimHost`. A retained-world
adapter lends its actual player, bodies, strike runners, fixed-step
registrations, events, flags and ledger dedupe. It creates no body and
advances no second physics or decision clock. Shards supply admitted rows,
not callbacks or adapters. `DecisionEncounter` lends the existing boss's
phase, retry and decision authority without replacing its encounter.

`borrowedActors` explicitly transfers decision ownership of real
`runtime.spawns` identities; missing bodies, undeclared names, overlapping
spawn identities and a second declared controller refuse. Compiler and
runtime use `buildDecisionRegistries` over the same joint catalogue.
Numeric public `state.shared` fields use those bodies' actual `mem` entries
under the declared field names and bounds. Encounter/view writes are read
live; guest writes and restore update that same memory.

`strikeObservation(id)` returns live read-only `current`, `state`,
`windup` and `aim` observations from the existing runner. `snapshot()` and
`restore()` preserve only the decision continuation; body, encounter and
strike saves remain with their owners. Restore validates before mutation,
enters no Wasm and emits no gameplay edge. This authority seam alone does
not remove a species' existing controller: the page/native adopter must
hand it over before its old policy can be deleted.

### Project decision budgets (KA3)

The v1 author compiler runs only for declared `sim/scripts` rows. ABI0-only
sources keep their existing intake and do not require a decision ceiling.
Root `gen-shards` emits `.wildshard/build-policy.json` from the same sealed
legacy inventory and exclusions used by the ruler. SDK project intake reads
that bounded portable policy, so direct `buildProject` and `readProjectAssets`
calls enforce the same ten-percent ceiling as the root CLI. The SDK imports
no repository policy module. Standalone v1 projects still declare an explicit
`buildOptions.asLineCeiling`; generated code never counts as authored AS.
Early asset target errors report target checks alone; execution sample
requirements are checked only after the real simulation measurement.

### Declared trusted headless assembly (W2 C9)

`@wildshard/sdk/headlessAssembly.prepareHeadlessAssembly(preparation,
modules)` reads `sim/headless-assembly.json` from the verified product and
assembles the existing native installers. Pine and Driftwood use it. A
shard's `boot/headlessModules.ts` supplies static imports only: the official
product build resolves every listed module and checks its exported names
against that catalogue without executing gameplay code. The SDK never
turns a data string into a URL or imports a shard or a test fixture.
The explicit `sdk/headlessRuntime` trusted-module loader accepts this
export-only catalogue alongside its existing `prepareHeadlessRuntime`
factory contract. It calls the assembly host inside the SDK; a shard
does not pass installer callbacks across an ordinary platform API.

Native proof callers may instead use `generateHeadlessModuleMap(root, slug)`
from `scripts/check-headless-assemblies.mjs`. It admits the same named exports
without executing them and emits static imports in
`tmp/headless-modules/<slug>/modules.mjs`, outside source and play products.
Nine uses this generated map; no handwritten shard catalogue imports its
proofs. `@wildshard/game/proof/entryways` defines `proveEntryways`,
`proveSocketLift`, `proveShardfileEntries` and their proof port/result types.
Only native proof callers import that module. Gameplay retains
`commandSocketLift` in `game/plugin/simulation`; it never imports the proof
module. Entry walks, gate lanes, transfers and fresh-world disposal are
unchanged.

The sim-in-runtime guard also follows the JSON module roots, retaining
existing native runtime debt when no handwritten catalogue remains.

The bounded JSON declaration contains `modules`, product `constants`,
ordered named `prepare` and `install` rows, level settings, ports and an
entry-proof callback. `$ref` borrows a field or its correctly bound method;
`$call` and `$new` call supplied capabilities. `$fn` reads its own arguments
and the current installation's live bindings, so a callback can borrow a
roster installed later. Conditional, coalescing and sequential expressions
preserve the original short-circuit and effect order. Prototype keys,
unknown operations, excessive nesting and duplicate row names refuse.
Each install gets a fresh binding environment; asynchronous installation
refuses. Existing owners retain every step phase, clock, RNG stream,
snapshot adapter and scope. Preparation may await product files; the
separate fresh entry-proof primitive always disposes its native world.

This is an explicit trusted-code boundary, like a selected legacy native
entry. Authoring a module name grants no capability: the host only exposes
the declared exports from the caller's already imported catalogue. The
ordinary data-only `sim/runtime-plan` path does not select this host.
`sim-in-runtime` follows the static catalogue as a native root, keeping
the remaining shard-owned simulation code in its existing census.

### World-target landing attachments (KA6)

`bindQuestPageInteractions(source, ports, worldTargets?)` creates the target
dispatcher using the entered quest's real marks, flags, named action beats
and hint port. The optional third argument is the admitted `world/targets`
section; otherwise it reads the source's verified output descriptor. Call
`page.bindWorldTargets(weapon)` with the actual held owner. No shard function
is passed, and the existing immediate or delayed landing remains the clock.
Target interaction ids resolve through exactly one page action's native
`interaction`, so presentation aliases cannot change mechanical identity.
Absent contact rows refuse explicit binding; perch-only sections stay inert.

`prepareRuntimePlan` accepts the full verified section map as its fifth
argument. When the selected weapon has target rows, it attaches
`bindNativeWorldTargets` after the existing quest owner and replaces the
legacy reaction callback. A section with only perch points leaves the old
weapon path intact. Installation and restore emit no contacts. Native hint
effects publish as bounded `{kind:'hint', text}` tick data, alongside the
existing fact/coin effects, only when the tick completes.

### Native strike decision handles

`@wildshard/format/creatures.readCreatureStrikes(input)` admits a plain,
bounded `actors/strikes` catalogue with unique ids, preserving native
geometry, units and motion. Pass those verified rows as the optional fourth
argument to `buildDecisionRegistries(source, moves, worldTargets, strikes)`.
Compiler, scenarios and runtime use the same joint root/native strike
namespace; duplicate identities refuse instead of allocating aliases.

### Frame-floor Debug isolation

`EngineProbe.debugSettings()` reads the effective registered Debug choices,
including defaults, without changing them. Frame-floor replaces its saved
Settings and clears persisted `debug.*` overrides before each page boot, then
applies only its explicit picks. Each case records the effective choices;
older previews without this diagnostic report `null`, never inferred values.

### Native plan section selection (KS2)

`sim/runtime-plan` selects the existing held-melee native interpreter with
`{kind: "held-melee", recipe, baked}`. The defining schema in
`format/nativeRuntimePlan` admits bounded plain data, not callbacks or module
URLs. The build-only output sidecar emits it; client `runtime/` never loads
the native recipe or world. Signal uses the same recipe shape as Sky.
The schema carries authored director input order as `ownerInputs` and
reconstructs native home fields in their original order, preserving the
existing string-based save contracts across canonical JSON serialization.

`game/shardfile/nativePlan.prepareProductRuntimePlan(product, assets)`
requires a verified output descriptor, forwards its complete section map,
and reads missing named blobs through the checked product reader. It calls
the existing `prepareRuntimePlan`; installation, fixed steps, RNG, collision
and save owners stay there. `sdk/headlessRuntime.prepareNativeRuntime`
selects this section when no explicit legacy entry is supplied. A missing
section refuses rather than selecting source code. The resident and worker
reuse their existing tick, effect and snapshot boundaries.

### Borrowed decision bodies (KS1)

A species brain `{archetype:'decision', data}` selects one verified
`sim/scripts` binding and its actual `runtime.spawns` actor. The internal
`borrowedDecisionAuthority` in `game/shardfile/borrowedDecisions.ts` lends
that same body to `ShardDecisions`, through the existing page/native fixed
step and contact ports. It allocates no body, encounter or simulation host.
BossBrain still owns fight/phase/retry/victory; the guest owns decisions,
timers and move selection. The existing policy save slot contains logical
guest/move and strike continuation; restoring it invokes no Wasm or rewards.
Rebinding a retired actor releases its prior scope before registering again.
The data row names the perch, presentation memory fields and strike impulse
recipes; it supplies no TypeScript callbacks. The old raptor controller and
its capture-only staging API are removed. The Roc and Matriarch now both
adopt this same authority in their real page and native hosts.

`actors/moves` may declare `orbit.angularSpeed` independently of its travel
speed. A dive may follow `targetAltitude:true` (the target plus aimHeight)
and `contactCompletes:false` when its existing strike owner supplies the end
edge. Defaults retain the original geometric altitude and contact completion.

### Mover compiler output format

`MoverBakeSchema.output` selects `typescript` (the default) or `json`. The
existing mover compiler emits the same captured rows as `data/movers.ts`
or `data/movers.generated.json`; fixed driver admission is unchanged.

### Per-round ranged cycles

`engine/combat/Firearm.ts#RangedAction.Cycle` takes borrowed reserve data
and a `RangedCycleRow`: magazine size, round/reload-entry durations, cycle
delay/duration and normalized ejection/cocking phases. It owns the tube,
chamber, hammer, reload progress and phase clocks; it accepts no hooks.
`events(dt, autoDue)` yields `cycle`, `eject`, `chambered`, `reloadStart`,
`round` and `reloadEnd` in source-clock order. Consume the iterator fully:
it suspends at each effect boundary, so an observer can inspect or interrupt
the exact intermediate state before the next transition. Each reload step
feeds at most 1,024 rounds. Snapshots and restore versions remain with the
caller; constructing or restoring fields never emits a phase event.
### Spawn-group decision bindings (G484)

A `sim/scripts` row may bind `{spawnGroup: id}` and name the group's
members in `actors`. All slots must have `scope: 'actor'`. The defining
`actorDecisionRows` resolver gives each member a stable logical binding;
`Clock.self` identifies that member. One admitted module image serves the
whole group, while slots, timers, random counters and staged commands stay
independent. Members cannot command other members' bodies.

A species brain names `{script, group, strikeEffects}` instead of `actor`.
The game lends existing ground bodies to one group owner, using their
keeper's fixed steps, contact authority and save slots. All declared group
bodies bind before stepping or saving. A home replacement resets only its
own continuation with `ShardDecisions.restartActor`; fresh-host restore
reconstructs logical state and moves without running decision handlers.
The keeper retains spawn, retirement, attack tokens and rewards.
Standalone pages allocate these members under their declared ids too,
then refill a retired home through the same manager's replacement path.
The existing borrowed-body decision host owns the group adapter.

`buildDecisionRegistries` accepts decision rows as its fifth argument to
register group ids beside individual spawn ids. `spawnGroupAlive` counts
living declared group members; dead or unmaterialized members count zero.
An individual spawn id still returns 0 or 1. Compiler, game and disk
scenarios share the same group membership resolver.

`ring-run` optionally declares `angularSpeed`, `closeRadius` (approach the
target directly inside this radius) and `stopDistance`. All default to zero,
preserving existing rows. Motion, burial and emergence stay at 60 Hz;
script decisions remain at most 10 Hz.

### Borrowed spawned decision bodies (KS4)

`format/decisionScripts.BorrowedDecisionSchema` optionally names existing
encounter `marks: {fight, phase}` and `idle: {move, progress}`. The game
adapter reads those numeric body marks; the idle reference must resolve
to an admitted `rise` move, driven by the encounter's own normalized
progress. No second timer, body, encounter or guest call runs during
intro or restore. `perch`, `leanField` and `bankField` are optional, so
a spawned body keeps its owner's original placement and pose fields.
The absent options preserve the held-body contract.

Both real page/native adopters use `game/shardfile/borrowedDecisions`: the
Roc and the Matriarch. BossBrain retains checkpoint spawning, thresholds,
weather, victory and rewards. The guest owns durable decisions/timers;
the same strike runner owns contact and its continuation. The retired
`phased` diver policy, schema and compatibility constructor are deleted.

A dive with `strike` and `contactCompletes:false` requests that declared
strike once when the actual admitted range and reach permit, while keeping
its flight motion until replaced. Its saved move includes that request edge.
The script must declare the strike capability and id; completion comes from
the same live strike runner. No periodic guest polling is required.

### Quest mechanic bindings (H2)

Quest-host observations can name actual mover endpoints/enabled state, cables,
flags or existing native timers. Command routes can name mover commands, cable
start or flag writes. `QuestHostPorts.mechanics` lends the installed platform
owners; admission refuses unknown ids before registering saved steps. Stage
spawn actions resolve named installed encounters, retaining quiet restore.

`QuestCableOwner.state(id)` returns live `{riding, atEnd}` and refuses unknown
ids; `start(id)` queues on that same owner. It exposes no clock or save methods.
Sky mover and Signal encounter bindings use these data-only paths. Legacy owner
maps remain explicit only while Pine/DW migrate; no mechanic row falls back to
one. Cable installation and its continuation stay with the traversal component.

### Declared native voice banks (G466 C8)

`installDeclaredAudio(rows, {audio, scope}, 'voices')` constructs a
`DeclaredSoundBank` from admitted `audio.bank` and `audio.playback` data. Pine's
recorded sprite/bark bank and Driftwood's procedural bank use this same owner;
no shard generator or playback closure moves into the platform. The ordinary
installer signature keeps its existing cue/profile/bed behaviour.

`audio.bank.families` selects bounded PCM programs or native impact recipes,
variant counts, channels and half-rate rendering. Registration is scope-owned;
missing programs refuse before changing the pool. `bank.catalogue` selects the
existing recording/sprite decoding policy. Counted boot decoding and playback
borrow the same per-set clip cache without copying AudioBuffers. `bank.barks`
selects the family prefix and gain; sorted decoded families, the cosmetic RNG
stream and immediate-repeat exclusion retain their original order.

Voice bindings can target `bank.playback.play(action, parameters, options)`
directly. `bank.spatial(id, position, listener, yaw)` uses declared full-3D range,
attenuation and tap IDs, tries the native sampled shot first, and executes the
existing phrase only after sample refusal. Construction needs no AudioContext
or browser; only the supplied native mixer performs playback. Frozen legacy
sound banks remain unchanged.

### Native item rows and combat input

`game/plugin/nativeItems` installs renderer-free ranged or swept items with
`installNativeItems(host, frame, row)`. Its policies and profiles are data only;
`format/nativeItems` bounds contact, flight, stopped-shaft and ammunition rows.
Pine's bow, bolt and cycling firearm and Driftwood's swept kit use this entry.
The existing `RangedAction`, `BowDraw`, projectile/contact and swept-melee laws
retain their clocks and each item's existing continuation id and payload.

The SDK owns one mutable `NativeCombatFrame` per native resident and refills it
at `lend()`: all attacks in tape order, first ranged heavy hold, last melee and
movement input (including release), and last value per script actor. It is
transient input, never a second saved owner. Existing world owners publish
numeric weather/wind and synchronized contact points; item rows receive no
shard functions. `observeNativeCombatMotion` samples the actual pre-motor
boundary and refuses unavailable delegated motion. Swept items synchronously
ask `item.reaction` for the world's existing alarm/stagger consequences, keeping
their original order. `bindNativeRangedVolumes` borrows numeric published points
separately from live joint queries; it retains actors only weakly.

### Declared catalogue boot bindings (G466 C8)

Authored manifest `audio.catalogue: true` binds the existing native catalogue
preload and boot inventory. Both read the verified `audio/audio` section;
explicit native preload/inventory bindings retain precedence. The same reader
serves Pine and Driftwood without a shard audio-files facade. It borrows a
temporary product scope, releases it before returning, and keeps only plain
catalogue rows. Recording order, style selection and the shared sprite cache
continue through `createCatalogueAudio`.

Score-set catalogues use `music.setCatalogue` on the same reader. `inventory`
selects the full base inventory or title-only inventory; `priority` controls
own-score download priority. `bootSynth`, `titleStings`, `baseSamples` and
`cueOverlay` retain the native Synth gates, title stings, base SFX decode and
cue-bank overlay order. Nalati and Nine Dragon both use this data path; no
shard audio-files adapter or extra PCM copy is needed.

`SetScore.declared(profile, music, optionalIO)` reads
`music.setPlayback`: the initial scalar `scene`, optional music `stateMode`
input, and `waitForBank` latch. It keeps SetScore's resident-slot limit,
failed-slot fallback, decode clock and cancellation behavior. Mutable scene
observations remain with the native listener owner; ordered selection and
initial state live in the admitted audio section. Optional IO lends isolated
read/decode ports for proofs; normal playback borrows the cached native reader
and decoder and refreshes the supplied music owner directly.

### Declared cable traversal (G466 C7)

`@wildshard/engine/sim/cableTraversal.CableTraversal` binds admitted `state/modes`
zipline rows to one existing `ZiplineDriver` each. `state(id)` and
`start(id)` are the actual H2 cable registry, with unknown ids refused.
Bounded `profile`, `landing`, `lifecycle` and `presentation` fields keep
the anchor/release, completion flag, carry timing and wind-roll differences
as data. Rows and borrowed real flag/rider/view owners replace shard
callbacks; `takeTransitions(id)` returns presentation data only.

`updateNative(id, dt, host)` runs on the existing quest clock and preserves
the row's position or motor carry policy. `bindRider` lends a shared carry
owner (including a reward owner while idle). `bindView` borrows the drawn
trolley, rider and optional camera; `update` advances them at the original
page phase. `snapshot`/`restore` retain the driver's existing continuation
inside each caller's old save envelope, without a new clock/save owner or
restore effects. Pine and Driftwood adopt this same owner in page and
native paths; only their model assembly and sounds/hints remain local.

`@wildshard/engine/player/modes.installCableModes(scope, rows, flags)`
installs that scope's bounded admitted rows once; `cableModes(scope)` borrows
its actual owner and refuses missing/disposed scopes. Repeated bindings must
retain the same rows and flag owner. The page quest binder installs it from
the admitted modes; native preparation installs it before the selected plan
and lends the actual native carry/reward pose with `bindNative(host)`.
No cable controller remains in the SDK. `nativeRider(id)` and
`declaration(id)` borrow the actual installed pose and validated row. Page
and native scopes never share a driver; their original update/save phases
remain separate, including silent old-save continuation.

### Declared score entry lifecycle (G466 C8)

`installDeclaredAudio(audioRows, {audio, music, scope}, 'score') installs the
existing `CatalogueScore` and decoded-bank listener. `installRuntimeScore`
(`game/plugin/audio`) applies persistent catalogues on each entered home scope;
ordinary catalogues keep their level scope. Detaching a persistent score releases
its entered decks/listener without resetting scene or boss phase. The music deck
continues to own its playback, crossfades and bar-grid clock.

An optional `music.lifecycle.debugPin` carries an existing reload comparison's
choices, saved device key and legacy settings member. `CatalogueScore.pin`
resolves device before legacy, refuses an unknown value to the declared default,
and initializes the existing scene/phase/sting rows. The platform registers the
comparison once before score binding; shards supply no selection callback.
Pine and Driftwood both use this installer; their lifecycle and catalogue rows
remain the source of their differences.

`readItemAmmunition(items, id)` in `game/plugin/nativeItems` reads the
admitted ranged ammunition as page `AmmoRow` values and bounded target-damage
coefficients. Optional presentation declares labels and pouch capacity; missing
presentation refuses. Native flight remains additive in rain; page rows retain
absolute wet multipliers for the existing weather owner. No save owner is added.

### Product-backed rich compendiums (X-C5)

`ui/compendium` retains its simple species/sketch rows and also admits a
`kind: journal` row. `format/compendiumRows` defines bounded rich entries,
variants and places, ordered icon selectors, stamp words, stat selectors,
trophy references and wall placement. Publication checks tab/entry/trophy
references and requires every sketch, explicit silhouette and chalk image
in the charged image library. No authored display callback is serialized.

`game/shard/declaredRows.declaredProductCompendium(product, id, sketches?)`
resolves the admitted row and logical image names through that same product.
The existing journal, discovery/save rules and trophy wall consume its output.
Simple vector rows retain their admitted SVG map; rich images never synthesize
adjacent silhouette URLs. The Template and Pine use the same defining host.
Pine's authored journal/POI/trophy assembly runs only in its generators; its
original chunk id, entry ids, text, images and display order remain data.

### Native track-row movers (G466 H5)

`engine/sim/moverMotion.MoverMechanic` evaluates admitted stop/driver rows
without a guest call. It takes numeric entity state and the existing caller's
clock, command and permission, returning a detached next entity and effects.
The existing mover host validates and commits those effects before publishing
colliders, views and endpoint events. It owns no physics, timer or save adapter.

A `world/movers` row may select `execution: 'native'`; its declared motion must
still lower to its historical module/input identity. Sky's twelve movers
and Driftwood's boat/bridge use this path. Native rows admit no guest asset
or memory. Their baker emits rows without compiling the retired guests.
The composed scheduler preserves execution order, entity fields, role ownership
and the entity continuation. Loading an old composition removes only retired
native module inventories (including typed numeric/brain role contracts); every
remaining contract field is checked unchanged. Unmarked rows retain their guest
execution. The native row itself proves each retired module identity.

### Declared ambience lifecycle (G466 C8)

`installDeclaredAudio(rows, ports, 'ambience')` binds the existing
`AmbienceMix` and native sound bank to `audio.zones.lifecycle`. The rows
select the initial zone, scope ownership, wind handoff, sample-only or
whole-scope teardown, and ordered numeric input reads. Derived inputs can
only reference earlier inputs; missing owners and disposed scopes refuse.
Pine and Driftwood supply their real geometry and live native values.
The installer preserves listener, sample, timer and random-stream order;
no extra audio clock or copied PCM buffers are introduced.

`economy/loot` rows may carry an optional strict `economy` payload: ordered
permanent effects, trader goods, owned/worn effect grants, finds counters and
world-space chart marks. `declaredLootEconomy(rows)` in `game/shard/declaredRows`
re-admits that data and checks Owned/cosmetic keys before callers lend it to the
existing EffectService, FindsCatalogue and ShopPanel. These readers create no
save, reward, transaction or timing owner. Authored tables can compile entirely
at build time. `runtime.binds: ['loot']` declares the existing runtime as the
sole installer; `withoutRuntimeRows` empties only the secondary client's loot
rows, retaining the original admitted payload for that owner.

### Build-emitted gameplay species catalogues

`@wildshard/format/speciesPrograms` owns `SpeciesSchema`, `readSpecies` and the
strict `actors/species-programs` section (`{page, native}`). Each array preserves
registration order and has unique kinds; empty arrays install nothing. This is
separate from the normalized `actors/species` inventory. Both owners read admitted
product rows; visuals remain with existing species looks and bodies.

`@wildshard/sdk/bake/species.bakeSpecies(row, id)` extracts the callback-free
gameplay fields and ordered variants at build time. It refuses native think/act
callbacks, strips visual variant fields, and admits the result through the same
canonical schema as `@wildshard/sdk/species.species`. Pine and Driftwood emit both
catalogues in their output producers; their existing hunt/brain and save owners
remain unchanged.

Pine's `world/ambience.json` emits cabin-then-hamlet floor rectangles and
fire-pit positions from the building records. The page passes those rows
to `DeclaredAmbience.floorRows` and its declared fire-point owner. Rain
cover reads the same rectangles through `floorAtRects`; `BuildingLife`
keeps lighting, doors and the live wheel gain, without floor/fire lists.
`test/pine-ambience-rows.test.ts` checks the emitted ordering and floor
queries. `test/ambient-forager-host.test.ts` exercises shipped hare and
marmot rows; `test/water-surface-host.test.ts` exercises Driftwood's
floor/foam/dry draw and Pine's plain water rows.

### Numeric channel programs (H4)

`@wildshard/game/plugin/channelPrograms#installChannelPrograms` binds one
`numeric.group` from the admitted client-channel rows. Each row names private
numeric `outputs`, optional read-only `inputs`, and `restoreOnly` fields. The
caller lends an owner map and supplies copied observations; no shard function,
clock, state write or graph traversal is admitted. Output properties use the
existing bounded numeric capability binder (one or two field components).

A frame snapshots all borrowed inputs, evaluates the existing straight-line
channel programs, then publishes their fields. `capture()` returns the original
values of fields marked `restore` and all restore-only fields, for the owner's
existing scope lifetime. Restore-only fields are never written during evaluation.
Pine's weather projections and Nalati's storm-look projection are the two live
users; the graph day sky's `channels` (Pine's `pine.sky`, Driftwood's
`driftwood.sky`) run their frames on it too. Their generators emit ordinary client-channel JSON; neither playback
path imports the build-time expression authoring.

`readLootTables(input)` in `game/loot/tables` admits ordered economy table data
before registration. Each row selects one kind, an optional exact variant and
optional unowned suppression; count ranges, weights and selection mode remain
inputs to the existing WeightedTable. It introduces no reward, registry, clock,
transaction or random owner. Missing/malformed tables and executable selectors
refuse. `economy/loot.economy.tables` carries these build-emitted declarations.
`rollLoot` defaults to the fixed zero draw for deterministic awards; supplying a
random stream keeps the existing weighted selection and count draw order.

### Build-emitted species brain and body programmes

`actors/species-programs.program` optionally supplies ordered `species`,
`strikes` and hashed script `modules` to the existing `SpeciesBrains` owner.
`readSpeciesProgram` admits callback-free gameplay metadata plus optional
`brain` and `body` declarations, refusing duplicate kinds or strike ids.
`SpeciesBrainSchema` in `@wildshard/format/speciesBrain` is also the defining
policy union for native runtime plans; extracting it changes no admission.

Build-time authoring may resolve presets and labels before emitting these rows.
Page kit registration and native installation consume the verified product;
their body, clock, contact and save owners retain their original order. A
species without a brain still requires its existing local policy adapter.
The programme does not install an extra host or construct replacement bodies.

### Declared creature phrases (H10)

`Synth.playPhrase` consumes bounded audio phrase data for both Driftwood's
gull and Nalati's creature calls. Nalati compiles its call recipes into its
audio section at build time; runtime keeps sample-first selection, call
gaps, positional buses and the sheep's native amplitude-modulation graph.
The producer hoists random arguments in authored order before each native
sound operation, preserving the noise source's interleaved random draw.
Supplied call times use the explicit `at` parameter rather than the host's
current-time `t` value.

`economy/loot.economy.progression` admits one reward state for every possible
found-flag count (zero through the bounded flag list length). States carry
ordered earned ownership keys/notices, a display count and the next threshold;
the existing `Owned` service still grants and persists them. Build-time tables
replace finite threshold arithmetic. The existing `CurveSchema`/`curveAt`
controls an owned numeric glow, with no shard callback or new clock. Missing
states, duplicate keys and unknown ownership refuse before gameplay mutation;
quiet save restoration and the caller's ordered notice queue stay unchanged.


### Build-only root-mapped sections (C7)

A project's CLI-only `generators/output.ts` may export `sections`, a plain
record from existing platform section names to their ordinary envelopes.
The author pipeline validates each with `parseOutputSection`, merges only
absent or empty configured fields, then validates the complete shardfile
before compiling decisions or writing output. A conflicting field, unknown
section or malformed payload refuses; nothing overrides a nonempty config.
These are the same canonical sections the product reader reconstructs, not
a second runtime source. Driftwood's `world/movers` is emitted here and its
resident borrows that admitted section. No config imports the mover JSON.

Pine's mill-door permissions are ordinary ordered page interaction needs.
Its building owner only reports a completed toggle to view/audio listeners.
The canoe's admitted transit data supplies the shared mover tuning and XZ
anchors; the existing page admission still samples live terrain at banks
(with the declared water minimum) and registry floors at both landings.
Ride phase, sound/visibility order and the mover surface clock are unchanged.

### Native phrase panning and source census

`AudioPhraseProgram` tone/burst rows accept an optional numeric `pan`
expression. It forwards to the existing native sound operation, preserving
its panner creation, clamp and output rather than adding a shared bus.
Programs without this field retain their existing arguments. Nalati's
transient weather, hoof, weapon and bed phrases use the same data host as
Driftwood's gull. Native sample-first gates, live storm loops and timer
lifetimes remain with their existing owners.

`scripts/shard-platform.mjs#sourceProgressInventory` exposes the full
source-basis progress inventory, including component spans and sole-user
charges, after resolving every consumer. Filter its returned map only
then. Its `measurement: source` label never supplies output percentages
or closure credit for a shard whose runtime is still unclosed.

### Declared spawn tables and native hunt settings

`actors/species-programs.spawns` contains bounded each/weighted tables with
ordered kind/variant items, weights and fixed or inclusive count ranges.
Optional `when.kind` and `when.tags` are conjunctive gates: every named tag
must be present. `@wildshard/format/spawnTables.readSpawnTables` refuses
callbacks, duplicate ids and reversed counts before registration.

`@wildshard/engine/ai/encounters.declaredSpawnTables(input)` admits those rows
and binds their gates to the existing EncounterRegistry/WeightedTable path.
Selection and count draws retain their original order and consume the caller's
stream; each-mode fixed counts consume no draws. Optional respawn delay/distance
are data for the existing caller-owned lifecycle, not a new scheduler.

The catalogue's optional `hunt` uses `NativeHuntSchema` in
`@wildshard/format/speciesPrograms`: existing native bands, fight/tuning,
contact tags and continuation memory fields. Pine and Driftwood emit both
sets at build time. Their native owners read the admitted hunt settings;
the existing bodies, cadence, random streams and save envelopes stay owned
by NativeHunt and each shard's roster.

Until catalogue activation replaces discovery, a declared `spawns` binding in
`generators/` executes only at generation time. Its local bounded TS graph is
checked against the canonical ui/level spawns schema and embedded as a literal;
the shipping discovery imports no generator and never falls back to source.

`combat/items.loadout.inventory` carries the bounded saved-pack policy consumed
by `@wildshard/game/inventoryLaw.NativeInventory`: ordered kinds, slot/count
bounds, quantity and snapshot modes, and the existing refusal message. The
public `@wildshard/game/plugin/nativeItems.readItemInventory(items)` admits
that data without a fallback. Callers keep their original save envelopes and
use `nativeInventorySchema(policy)` before restoration; the shared stacking
and trade laws remain the sole inventory state owner. Missing policy, repeated
kinds, invalid slot bounds and reversed count bounds refuse before allocation.

### Declared gameplay audio bindings

`audio/audio.gameplay` binds the existing `installDeclaredAudio(...,
'gameplay')` phase to bounded native owner paths, typed observation commands,
and door/entry policy. `installRuntimeGameplayAudio` in
`@wildshard/game/plugin/audio` supplies the resident/entered registration
adapter. Pine and Driftwood both consume this phase. Observation and cue
policy are DATA; small existing entry files retain the native door, floor
and dusk loans until those providers themselves become declared data. Reads
borrow live native owners and rosters,
never copies. The native observer retains cadence, hysteresis and transition
history while the original entry scope owns subscriptions and shade restore.

`audio/audio.entry` selects at most four named wind/score stages through
`installRuntimeAudioEntry`. Existing score-bank and wind-bed installers remain
the resource owners. Retained wind waits for entry, restores only the bed it
still owns, and re-registers on re-entry; ordinary wind keeps the kit scope.
A missing stage, owner, required profile or nonnumeric write refuses rather
than selecting a shard-specific fallback. No service starts on import.

The optional gameplay environment binds existing floor owners, emitter points,
near lists and object loans; it never generates colliders or renderer state.
Declared ambience points use its existing mix algebra and numeric owner reads.
The platform owns native melee/underwater cue subscriptions, original callback
order, emitter/ambience disposal and identity-checked published handle removal.
Voice-bank `shots` is the admitted one-shot identity list; `acceptsShot` checks
membership independently of sample readiness. Pine no longer ships a TS copy.

The retained native-method crossings stay visible to the G454 inventory and
within their original per-file ceilings; no cast or guard increase hides them.

`combat/items.loadout.native` declares bounded native slot order, the initial
slot, lower/raise clocks and optional per-slot ownership flags (`null` means
always owned). `bindNativeLoadout` and `createNativeLoadout` validate these rows
before installing state; timed and immediate kits retain the held/swap save wire.
The existing live lock remains caller-owned. An optional numeric input row names
the aim command, clamp/default/sentinel and the ordered publication step. Binding
it borrows the mutable combat frame, clears/refills its existing live-slot set
after selection and before item updates, and adds no continuation adapter.

### Product achievement counter catalogues (C5)

`@wildshard/format/achievementCounters` defines the strict bounded
`AchievementCounterDataSchema` and `parseAchievementCounterData`. Pine and
Driftwood emit named `quests/achievements.json` from their build-only author
catalogues. Page and native owners admit those exact bytes before lending
ordered matching/flag rows, prefixes and write policy to the existing
`createAchievementCounters`; persistence, stable identities, grants and
presentation remain with their prior owners. Native Driftwood retains its
explicit per-increment write override. The public counter data carries no
storage callback or presentation-only feat metadata. Their ledger author
assembly likewise stays build-only. Driftwood emits its trader prompt/action
rows as `quests/trader.json`; the existing strict page binder consumes it.

### Seeded weather programs and wind continuation (H4 continuation)

`@wildshard/format/weatherProgram.parseWeatherProgram` admits bounded phase,
mode, numeric expression and optional projectile-wind data. Expressions reuse
`AudioMixExpressionSchema` and the server-safe scalar evaluator; they do not
install an audio service. Ordered temporary values precede output evaluation.
`@wildshard/engine/world/weatherContinuation.WeatherContinuation` applies these
rows on the existing `Weather` transition loop. Pine and Nalati are real users:
their differences are phase lengths, mode policies and numeric DATA. The host
knows no shard names, requires no DOM, and replaces both private profile bodies.
The optional `registers` box and bounded `actions` lists contain no functions.
Each action assigns one declared register from a scalar expression or a two-end
random range, gated by an optional `when`. Lists run in order; they read `t`,
`u`, `dt`, `state.*`, `mode.*`, `output.*` and `register.*`. `enter` runs after
the phase-length draw and before existing phase observers; `force` follows the
forced phase position/wetness; `tick` follows numeric outputs. Native consumers
may invoke another declared list with `applyActions`. Range actions and native
mechanics borrow `random`, the same stream as phase lengths, so draw order is
preserved. No shard callback enters this host.

Pine publishes its previous wind boost through the post-cadence `step` action. Nalati declares
its phase-entry resets, wind ramps/targets and bolt cadence as actions; its
counted `world/Lightning.ts` composes the plain continuation and retains strike
targeting, GET LOW and damage. There is no storm subclass or phase subscription.
Nalati's combined snapshot adapter preserves the old flat storm save, including
register values, while Pine's v1 envelope retains weather, wind, cadence and boost.
Silent restore draws no RNG, emits no event and preserves the gust publication.

`@wildshard/game/plugin/weather.installWeatherContinuation` is used by both
shards. Native wind rows install the declared fixed-step and save owner. A page
borrows its existing `system` service, clock and optional plain pause box; the
admitted `page` row preserves the system id, ordering and weather tick. Pine's
page uses this installer rather than constructing/stepping a second owner.
A native composite without an independent wind cadence retains its existing
combined step/save adapter and drives the returned owner directly (Nalati's
weather/lightning/wind order). Both shards read admitted `world/weather.json`;
H4 channel programs remain read-only visual consumers.
`@wildshard/engine/combat/ammo.wetFlight` shares exact wet-flight arithmetic
between the page request and authoritative item policies.

`DynamicBodySlots.velocity` and `launch` in `engine/physics/bodies` consume
bounded `BodyLaunchRow` coefficients for aimed flight or a radial toss. They
advance no random stream: the existing owner supplies the phase and keeps
post-spawn angular draws. Driftwood's volley reads `combat/items.items.launches`;
Pine's legendary pickups use the radial profile through `ClaimedPickupRoster`.
That roster's optional death policy matches kind/variant and resolves source or
player-side placement as data; its caller keeps the existing terrain query,
claim effects and death-listener order. No contact callback port is added.

### Commanded carries on admitted mover paths

The existing `winch/ride` motion accepts optional `return: 'command'`,
`smoothstep` easing and a bounded endpoint snap. Default platform rides
retain their existing guest ABI, dwell and easing. Native channel rows
may add `carry`: baked seat/landing positions, surface oscillation,
arrival flag/hint and two prompt rows. Guest execution refuses this data.
`MoverRuntime` owns commands, carry, release and publication on the
existing fixed mover tick; the page borrows its pose and transition queue.
The native installer drives the same owner and carries its ordinary
mover/script continuation. A restore just before arrival still releases
at the baked landing. Terrain and deck queries run only in the producer.
No shard callback, extra ride controller or clock enters the row.

### Declared completion cards (`ui/completion`)

`@wildshard/format/completion` defines bounded find groups, stat selectors,
completion/seen flags, safe-poll policy and card copy. Generators resolve static
find coordinates and emit the admitted `ui/completion` section. Driftwood uses
its existing reward handoff; Template uses a minimal first-adventure card with
no new runtime module. Both use `@wildshard/game/complete/declared.installCompletion`
and the existing `ShardComplete` renderer.

The installer borrows the actual play, flag and progress owners, registers its
system on the existing clock and preserves their save envelopes. Reward cards
open only through their existing reward handoff; a safe fallback offers the menu
once per session. Quest-triggered cards open once after their declared flag.
`completionProjection` reads current counts without mutation; the card retains
its existing pause, viewmodel, audio and Keep/Next/Title actions. Shards supply
data, never card-policy callbacks. `createQuestPlacements().anchors` is a
readonly view of that placement owner's validated anchors, so late ride anchors
remain authoritative for completion markers without a second placement cache.

`sameRuntimeProfile(left, right)` in `game/plugin/headless` compares admitted native profiles by JSON value, preserving array order and rejecting changed values while ignoring object-key order.

### Retained decision bodies: placement and pose

`ActorMoveRunner` admits `kind:'relocate'` in `actors/moves`. Its point is
an admitted world spot or two admitted numeric actor fields (`x`, `z`).
Optional `facing:'target'` uses the observed target; a numeric facing is
an angle in radians. The existing body applies the placement through
`AnimalSim.place` once. A completed or restored move never repeats it.
Unknown fields/spots, nonfinite points and missing targets refuse before
changing the move or body.

`CreatureBodyRecipe.actions` can map a decision guest's admitted numeric
`stateKey` onto canonical AnimalState names. This pose mapping has empty
contact actions: the existing StrikeRunner remains the only contact
clock. Optional `offset:{field,from,to}` reads a normalized actor field
and smoothsteps between the two body offsets, preserving the original
rise/sink easing. Pose marks are validated together before mutation.

`borrowedDecisionAuthority` binds only the existing actor, physics,
encounter observations and fixed tick. `nativeDecisionAuthority` lends
an existing SimHost; `pageDecisionAuthority` prepares verified product
modules and lends the actual page's bodies, combat and fixed system.
The page preparation is deliberately flag-free; a flag-capable guest
must use the quest-bound catalogue and its actual Flags owner.

A retained encounter's numeric public fields are backed by that body's
memory, not a second shared-state store. A runtime-bound state can retain
host-owned fields beside numeric public actor fields only when a declared
sim guest names them and owns the actual retained boss ids. Player state,
public strings and undeclared guest fields refuse. Runtime JSON saves
continue to admit host-owned fields only.

The roaming arena owner now applies guest requests to its existing
contacts, rings, lanes and summons. AS owns mode selection and timing;
the arena retains collision, hazards, adds, UI, rewards and checkpoint
ownership. Its continuation includes logical guest/move state. Older
scalar encounters hydrate the admitted actor fields without invoking
Wasm; Driftwood's old v8 boolean Captain contact record is still readable.
King and Captain both use the same retained-body adapter, relocation and
pose-state path. Cosmetic water/audio observers read the Captain's marks
and never select his next action or write his simulation state.

Generated ABI transport accessors are inlined before instrumentation. IO,
capability and bounds checks are unchanged, and the resulting function and
loop bodies still pass the same structural fuel/depth/finite guards. This
keeps field-heavy decision guests within the existing per-call fuel cap.
Native borrowed guests run in the existing after-body phase and resolve the
current host physics after snapshot restore.
Retained bodies that have no mover owner and no channel/signal capabilities
can restore across changes to cosmetic channel programs and unowned mover rows.
Channel identities and every mechanical contract field still match exactly.
Guests with those capabilities retain the full channel/mover contract.


### Product quest story and journal rows (C5)

`@wildshard/format/questStory` admits `quests/story.json` for Driftwood
and Pine. `@wildshard/game/quest/story` binds the existing journal,
flag observation, kit seat, presentation and NPC talk owners. Rows retain
the original migration source, achievement prefix, write/refresh order,
messages and seat pose. `quest/storyLaw` supplies the same seat arithmetic
to the native keeper without importing page views. These hosts add no
saved cursor, reward, timer, prompt or alternate NPC rig.


`bindStoryChapters` binds one or more declared chapters over the original
runtime flags and completion facts. Driftwood and Nalati use
`presentChapterStory` for the same chip, MAP card, message and discovery
laws; the policy admits optional single-quest notices or chapter reward
captions. Nalati emits `quests/chapters.json`. Existing world figures,
NPC dialogue, update order and saves stay with their owners. `QuestViews`
retains the objective/captions and recreates only entered dialogue input;
its timer cancels when the home cell exits. `installFeats` runs after the
adventure's initial world poll, preserving synchronous flag-event order.

### Quest step runner (G474 / G477 / G482)

`game/quest/steps.QuestStepRunner` is a bounded pure evaluator over strict
`format/questSteps.QuestStepRows`: go-to, talk, kill, collect, deliver,
lead, follow, wait and interact. Construction takes only rows. `signal`
and `update` take plain `QuestStepFrame` values: flag names, inventory
counts, position and live actor facts. They return ordered data effects;
they accept no callbacks, reflected paths or mutable gameplay owners.
The existing native owner commits effects synchronously in order at its
original event phase. Evaluation itself never calls shard code, opens a
panel, grants an item or installs another scheduler or save slot.

`game/quest/effects.commitQuestEffects(ctx, questId, effects)` commits
flag, item and take rows against the original bound quest and play pack.
Its framework lookup borrows the `QuestState` already created by
`bindRuntimeQuest`; it creates no flags, listener or continuation.
`commitQuestEffects(host, inventoryId, effects)` applies the same
ordered effects to the native host's flags and registered pack. Both run
at the caller's existing event phase. Commands and notices still require
an admitted lane and refuse here. Pine's page/native payment and follow
signals and Driftwood's native kill flags use this data-only dispatch.

Client-only `toast` and `sting` effects use the actual play HUD and music.
A toast may count its original flags by an admitted prefix and goal; it
creates no counter. Native dispatch refuses these presentation effects.
`readQuestServiceActions(ctx, questId, file)` admits a named product's
bounded action rows and returns `run(actionId)`. Rows accept only these
closed services, with no owner map, callback, method path, delayed job or
new continuation. Binding is silent; each run borrows the bound quest.
Pine's payment/stag notices and Driftwood's glass/pickup feedback use it.
Errand wheel synchronization retains its counted legacy adapter until
C1 publishes its actual handle.

`game/inventoryLaw.creditNativeInventory(host, id, row)` and
`debitNativeInventory(host, id, row)` borrow an existing native pack.
Credit retains its authored admission/capacity result; a debit accepts a
positive safe quantity and returns false without changing counts or
order when stock is insufficient. Restore replaces the pack's state,
while id-based calls continue using that same pack. Neither call creates
inventory, emits rewards or installs a save adapter. Boss grants retain
their existing rejection policy through `grantNativeInventory`.

The former `call` effect is refused. A `command` names an admitted script
and its numeric Script ABI event `type`, `target` and `value`. No TS
callback fallback exists. Delivery rows contain their item and quantity;
an accepted delivery returns its take before its grants. `once` flags
prevent repeated effects. Later rows observe earlier effects in the same
evaluated transaction. Native owners must commit a returned transaction
before submitting another signal; uncommitted evaluation is inert.

Only authored waits have a `snapshot` / `restore` map of elapsed seconds.
False gates pause waits. Shards with no waits keep their legacy envelope
unchanged. Guard reads receive a fresh roster snapshot; a historical
death flag covers only an absent roster, never a live respawn.
The Copper Town fixture exercises all nine kinds, numeric script commands,
non-mutating evaluation, delivery order, idempotence and wait restore.

G482 returned the single-user `StagWalk` to Pine `quest/stagWalk.ts` and
removed its public platform export. It remains charged to Pine.
`game/quest/chapter.installQuestChapter(ctx, story, rows, anchors?)` is a
client-only presenter used by Pine and Driftwood. `installQuestFlags(ctx,
id, level)` lends the original saved flag book once per entered scope;
`bindStoryAchievements` publishes its exact ledger and refresh service.
The chapter resolves those services by `story.quest.id`, reusing a bound
quest when one exists and borrows the entered map, music, HUD and
completion progress directly. Rows may supply world marker coordinates
keyed by the authored placement, a completion projection and its remaining
objective label. `chapter.discover(rows)` registers the ordered discovery
catalogue at its original phase, after late placement anchors exist.
The optional anchor coordinate table stays owned by the
existing placement resolver, so late zipline anchors remain live data.
Unknown rows, missing placements, unbound quests and disposed entries
refuse. There are no shard callbacks, reflected owner paths, NPC factories,
update systems or save adapters in the chapter intake. Callers keep their
original chip update phase. Both shipped quests preserve their flags,
notice/sting ordering, map card and completion marker policy.

`game/quest/chapter.installQuestCatalogue(ctx)` registers `items.catalogue`
from `combat/items` and `quests.achievements` from `quests/quests` through
the existing scoped item and achievement registries. Both are optional,
bounded, duplicate-checked display rows; they add no counter or save owner.
Pine and Driftwood use these declarations instead of private catalogue
sections. Achievement display metadata is excluded from decision save
contracts, so a mid-quest continuation keeps its original gameplay basis.

Pine's remaining page assembly, Driftwood's adventure/finale and both
native quest keepers retain their charge. NPC rig updates, death drops,
model, pool, door, traversal and reward-camera assembly stay in their
existing native owners; chapter presentation does not construct them.

`game/quest/killSteps.installQuestKillSteps` runs ordered kill flags before
existing achievement counts and retains the legacy flat save envelope.
`game/quest/hints.installQuestHints` feeds the existing FirstHints owner.
Both still have legacy owner callbacks and therefore score 5/6, failing
HOST-BAR test 6; their data-only service binding remains for the N4 audit.
The step evaluator itself scores 6/6. No callback-shaped native-quest
relocation was admitted in slice two.

### Build-emitted numeric creature poses

`game/plugin/channelPrograms.numericCreaturePose(input)` lends existing
rig joints and copied frame inputs to the numeric channel evaluator. Each
programme targets one optional joint (`joint.<name>`; underscores become
dots); `read.joint.<name>.rotation` contains the pre-pose Euler scalars.
Rows may select a variant/alive gate, enumerate state indices, borrow the
existing bounded look-angle helper, and finish with the existing flinch
squash. The returned callback caches per rig, owns no actor memory or clock,
and works on the same renderer-free joints as the native pose owner.
Driftwood's crab and Pine's living thralls consume build-emitted JSON rows.
The existing numeric DAG's `pow` operation preserves native `Math.pow`
semantics, including the crab's squared smoothstep and thrall's sharp jerk.

The numeric evaluator, scalar binders and detached frame types are defined
in `game/plugin/channels`; browser UI imports that module. Native pose
imports therefore load no DOM or CSS presentation code.

`@wildshard/game/quest/trader.installQuestTrader` binds Driftwood and Pine
trader opening to admitted `quests/stall.json` rows. Driftwood lends its original
models, entry scope, NPC rig, placement/floor queries and page prompt rows; the
host preserves counter ownership, facing, pitch restoration, distance closing and
late shop readiness. Pine lends its existing lazy panel and keeps its talk gate
and panel-hold lifetime. Catalogue, flags, payments and saves stay with their
existing owners. `parseQuestTrader` validates rows before any placement.

Numeric creature poses may declare up to 64 `scalars` observations. Each
`{ name, path, fallback? }` copies one permitted frame field or a numeric
`mem`/`dims` field into the read-only `scalars` input owner. Missing legacy
memory may use the row's finite fallback; the adapter never initializes or
changes actor memory. Duplicate names, unsafe paths and non-finite values
refuse before posing. Driftwood's sailor and captain use these rows for
rise/rage joints; Pine's thralls use them for their existing gait inputs.
Sailor lift remains the caller's existing `stepCreatureLift` before posing,
and the captain's admitted body step retains his lift. Numeric rows add no
continuation, policy, physics write or random draw. Driftwood's ecological
delays and clearance are compiled into `sim/keeper.json`; the native keeper
reads those admitted rows while its version-8 live save remains unchanged.

### Declared exchanges

`@wildshard/game/loot/exchange.Exchange` binds `ExchangeRows` from
`@wildshard/format/exchange` to the session's lent inventory, purse,
capacity and ownership methods. Pine emits `quests/exchange.json`;
Driftwood includes the same rows in its admitted loot economy.
Affordability reads precede ordered payments and grants. A payment
marked `required` returning false stops the purchase before grants.
Panels keep their original hold lifetimes; native modal saves retain
`{ version: 1, open }`, with silent validation before restore.

`@wildshard/sdk/quests.parsePersistedQuestPage` validates compiled saved-page JSON
for the shared persisted-quest host: places, markers, model, reward persistence,
held camera beat, transient startup repair and bounded capture steps. It adds no
quest state or callbacks; both Sky Reach and Signal Dunes use the same reader.

## Native actor identity and population (G474/G475/G477)

`game/population/actors.NativeActors` owns game-native identities above
`game/shardfile/homeKeeper.createNativeCreatureRoster`. The roster exposes
`identities` and uses it for materialization and retirement. Allocation is
RNG-free and monotonic. A dormant identity has a reserved recipe and no
body; a materialized identity can be alive or a retained corpse; retirement
permanently prevents that identity from being materialized again. Listing,
group ownership and encounter ownership are independent of body state.
`preflight` refuses duplicate materialization before `host.spawn` changes
anything. `sleep` and `retire` require auxiliary handles to be released.
The shared roster's `sleep(body)` detaches its physics body, herd membership,
pose and live-body map while keeping the dormant recipe and identity.
`arrive(body)` can then materialize it again without allocating an id or
drawing RNG. A permanently retired body refuses before `host.spawn`.

Auxiliary handles have a stable id, actor owner, service and native handle.
The service scopes handle uniqueness; adopting a saved handle creates no
physics body. `format/nativeActors.NativeActorEnvelopeSchema` defines the
v1 envelope: allocator, actor lifecycle/ownership rows, auxiliary handles.
`prepareRestore` resolves every materialized actor and validates all aliases
before returning a silent commit. Dormant and retired actors never resolve
to native bodies. Existing embedded allocator wires remain available via
`allocatorState` and `restoreAllocator`, preserving old saves without adding
an adapter or reordering native registrations. Pine and Driftwood retain
their established embedded wires; new callers can persist the v1 envelope.

`game/population/roster.installPopulationRoster` consumes
`format/populationRoster` rows: stream seed, ordered fauna, reserved identity
replacements, ordinary variants, dormant reserves and scripted homes.
`actors/roster.json` is the admitted native product path. Boot order is herd
placement and its spawn/memory draws, identity replacement, dormant reserve
draws, then home spawns. A reserved recipe consumes its original six draws
while parked and none when adopted. Every boot recipe is checked against
the trusted bake. Body materialization, floors, herd adoption and retirement
use the existing shared roster. Pose attachment is a native service; fight
decisions remain in their own encounter owner. The existing v3 roster wire,
entity ids, saved actor registration order and RNG continuation are retained.

Pine's counted `quest/waves.PopulationWaveDirector` runs its phase ABI:
clock, roam actors, sentries, periodic gate, sentry group completion/spawn,
far-roamer retirement, then new roamers. The admitted director script owns
all decisions. Pine's `quest/waveRows` declares its spatial/tuning rows;
content supplies kinds, sound ids, placement bounds and movement values.
The host uses `sampleCreatureGroup` and the caller's stream in its original
draw order. The v2 continuation stores actor identities, the script state,
placement contract and scheduler clocks. Restore emits no spawn, control,
voice, quest, retirement or RNG effects. `preparePopulationModule` uses the
existing embedded director admission and supplies independent lanes.
Pine's `quest/nativeWaves.installNativePopulationWaves` receives its rows and the existing native
roster/clock ports from assembly data; its v1 embedded RNG/population wire
remains unchanged. Pine's `quest/pageWaves.PagePopulationWaves` receives an `AnimalManager` and
rows, then scalar night/errand observations. Its ordered effects contain
copied world positions so a retirement cannot park a pending puff below
the world. These four files are custom Pine TypeScript, charged in full.
The full AssemblyScript spawn/retire command and legacy-save migration is an
open SHARD-PLATFORM row. No platform wave director or wave SDK facade remains.

`game/population/shelter.HerdShelter` consumes `format/herdShelter` rows:
species, tree threshold, search radius, score weights, wet/dry gates, crown
clearance and home hold. It reads the caller's herds, tree inventory and
cover samples, owns no weather or RNG, and preserves the v1 herd-order save.
Cover is sampled once at each tree's fixed position. The native
`installNativeHerdShelter` consumes the same look plus its step id and herd
bound from assembly data. `actors/night.json` and `actors/shelter.json`
are the shared admitted product paths for native and page installations.
`game/population/respawn.RespawnQueue` consumes `format/populationRespawn`
delay/night rows and a `RespawnTraversal` row: forward/reverse order, an
optional queue limit, and fresh/reused results. The owner checks `accepts`
before supplying one draw to `add` (even a fixed delay); `take` never draws.
The API accepts no entropy callback or subclass hook. Native rows select
reverse order, limit 256 and reusable results; Driftwood's page selects
reverse order, no limit and fresh results. Its subclass is deleted.
Named RNG authorities stay with the death owner and remain absent until the
first declared scheduling draw. Identity allocation, variant rolls and native
bodies remain with the roster at the due event.

`game/population/returnProgram.ReturnProgram` runs event-only stateless ABI-v1
projections for queue policies. The actors/return-scripts catalogue admits the
same critical Wasm blob in product validation and worker context. The constructor
checks the embedded bytes against the declared module hash, admits fixed pages,
and rejects durable slots, timers, ticks, body commands and undeclared reads. Requests
supply numeric observations and optionally the actual spawn Rng; guest channels
are validated before publication and a refusal restores that stream. Native/page
factories use their built-in terrain authorities. This owner neither advances a
second clock nor changes the existing v8 creature envelope. Delay, sight/night
gates and six-attempt land placement are Driftwood's behaviour/returns.as.

RespawnQueue can select this concrete policy owner; place retains entry
identity when a guest defers it. ReturnGate keeps native corpse/fade clocks in
the existing save object, or observes the page body's real hidden state.
`game/population/pageReturns.installPageReturns` binds the page's actual manager,
ordered deaths,
night clock and spawn stream using rows.
`game/population/pageGroups.PageActorGroups` owns
grouped placement, training refills and perches over the real manager; it changes
neither body AI nor existing herd membership. All three owners are the approved
G474/G475 actor-spawn feature and have independent salt-marsh fixture coverage.

`sdk/looks/pageLife.installPageLife` is a client-only ambient presenter.
`format/pageLife` rows select actual flock draws or a packed model library,
forager populations, journal guidance, corpse ownership and timed tools.
The API accepts the trusted context, rows and concrete platform journal,
sound-bank and flock instances; no shard callback or owner/path reflection.
Driftwood lends its existing gull draw; Pine declares packed birds and hares.
The existing flock/forager owners keep their streams and pose channels.
A stateless ABI-v1 projection selects corpse arrival/cleanup and guide
eligibility, at most 10 Hz; per-frame tool/camera interpolation stays native.
Guide attempts keep their native clock and RNG phase; eligibility is read
lazily only when due, with a minimum declared period of 0.1 seconds.
The tool retains the real harvest reward reservation and restores equipment,
material colour and camera offsets on interrupted resident entry. Its guest
has no durable state or additional save adapter. Product Wasm metadata admits
its fixed page; the existing page decision authority prepares that memory.
Named `actors/page-life.json` data is emitted with its defining source.

SDK defining facades are `sdk/populationRoster`, `sdk/populationShelter`
and `sdk/populationRespawn`; they
borrow the same game implementation and install nothing on import.
`populationRoster` also admits author rows before emission. Native identity
and respawn retain the approved **native actor interface + spawn director**
feature (`actor-spawn`, G474/G475/G477) in
`lint/platform-pending-users.json`. The fabricated salt-marsh fixture drives
roster reservation/adoption, versioned continuation, ownership/auxiliary
refusals, shelter and delayed returns without Pine or Driftwood rows.

`NativeActors.prepareRestore` resolves materialized ids from its already
reinstalled identity table without a supplied resolver callback. Validation
returns a silent commit and neither allocates nor draws.

The roster's ground/wander/pose ports and the native shelter's herd/rain
callbacks still fail HOST-BAR test 6. Their pending platform credit and their
SDK facades' credit are removed; sole-user code charges back to Pine. They
remain unchanged for exact collision-pose and old-save continuation. The
open data-only ownership row requires concrete built-in service ids or AS
references, never a registry or event that hides a per-shard TypeScript hook.

### Collections and display (G474/G475/G477)

Client-only presentation: `format/collectionDisplay` admits baked collection cards, bounded vertex
ranges, paired empty/full trophy slots, count reveals, mount packs, chalk
atlases and keepsake presentation rows. `game/models/collectionDisplay` defines
cold Explorer cards and `CollectionDisplay`: the existing engine
`engine/models/slots.SlotGeometry` rewrites the same index in place.
`collectionTrophy` uses the
same baked loose geometry and authored mounting offset as its wall plaque.
Geometry, materials, names and placements remain the shard's rows.

`game/compendium/keepsakes.installCollectionKeepsakes` owns count-to-display
synchronization, quiet
restoration of earned rewards, trophy displays, delayed announcements,
claimed pickups, restart reward drops, cosmetics and blade glow. It borrows
the existing Flags, Owned, progression/effect, model, world and save owners.
It creates no save slot: previous glass flags, owned/worn ids and compendium
entry statistics continue unchanged. Perk application stays with effects.
The owning entry scope retains subtree ownership and listener teardown.

`game/models/collectionWall.installCollectionCompendium` supplies the existing
compendium's wall port. Rows place slots and select chalk cells; the host
merges taken mounts, draws untaken chalk, resolves look-at prompts and opens
the journal on EXAMINE. The product loader lends mount geometry and chalk
texture capabilities. Pine uses its original baked mounts and atlas;
Driftwood uses its original chime, trophies and keepsake placements. A
made-up gallery fixture exercises different slot names and saved entries.

`sdk/models/geometrySources.registerPackedGeometrySource(scope, id, rows)`
registers a URL, pack rows and label under an owner-local id. The SDK alone
constructs the decoder. `engine/models/geometrySources.readGeometrySource`
borrows fresh owned copies using that id and geometry indices; disposal
retires the registration. A shard supplies no decoder object or callback.
The canonical authoring codec remains in `sdk/kit/geometryPack`, preserving
the isolated baker's existing dependencies.

Host bar: **5/6**, passing tests 1–5. Both collection presenters use admitted
rows, contain no shard identities and are labelled client-only. Test 6 is
still open: the legacy world/save owners are borrowed as capability bundles
at the collection entry points. Batch 11 of the Pine under-20 mini-plan owns
the remaining context-and-id API work (G482, sp-x4, recheck 2026-10-18).

## Scene references and building names (Z11, G486)

`game/shardfile/sceneHandles.SceneHandles` is the single client scene name
registry. Z2 recipe parts, deferred placements and living buildings publish
into the same namespace; cross-kind duplicates refuse. Resource loans retain
native identity and construction-scope disposal ownership. Native migration
builders may publish or lend a resource, but consumers resolve an exact id,
never a property path into a shard object. Geometry, generic/basic/standard
materials, objects, groups, meshes, vectors, numbers, lights and colliders
have checked accessors. Deferred `place(id)` keeps its once-per-resident result.
Shared batches retain lazy finalization through `object(id)` and `mesh(id)`.
`release(id, resource)` retires only an identity-equal native publication;
a stale figure owner cannot remove its successor, and release never disposes
the borrowed resource.

`format/sceneRefs` admits bounded plain JSON `SceneRef` values (`part`,
`point` with optional offset, or `prompt`) and `ObservationRef` values
(`flag`, `mark`, or mover `at-end`/`moving`). `admitSceneRefs` checks a
consumer's complete ref list against its declared publications and prompts.
A scene point resolves a published vector or an object's world origin;
its optional offset is in world units. Building cloud rows accept a scene
point ref as well as their existing literal position. An optional parent id
converts that world point into the cloud's local frame. Missing names and
wrong resource kinds refuse before cloud geometry is allocated. Driftwood's
shrine cloud resolves its published point through its resident Z2 registry.

The building-only `SceneResources` module is removed. Living building life,
assembly and clouds use the same typed handles as Z2. Each independently
owned scene (including a cold Explorer scene) retains its own registry.
The remaining owner/path consumers migrate with their Z1 feature, as G486
specifies; this change does not introduce a second effect dispatcher.

## World scene assembly (Z2, G480/G483)

`@wildshard/game/shardfile/worldScenes.installWorldScenes(context, rows,
resident)` builds the client-only `world/scenes` platform section once per
resident scope and product. The optional resident defaults to the context scope; transitional resident
worlds pass their static world's owner. Re-entry returns
the same handles. Disposal removes its scene parts, owned materials and geometry,
and any registered pieces. Failed construction disposes partial results and can
retry. Nothing installs on import.

The section declares named model libraries (`owned`: exact identity-space GLBs
with application-channel aliases; `pool`: prepared model pools), material slots
(existing look ids, low-poly family variants, or plain standard/basic
materials), and ordered recipe steps.
Recipes are verified named JSON blobs containing `WorldSceneRecipe` rows.
Every library, material, recipe port and publication is admitted before visual
allocation. A cube variant selects standalone or cell data. Repeated steps have
named instance poses. Bounds overrides retain authored shader-displacement
spheres. Static box and tread collider rows register through the resident owner.
A registry row may declare its surface; tread rows retain their authored
endpoints, width, count and optional surface, transformed by the repeated pose.

Each step publishes `<step>.root` and optional typed named handles, with a repeat
id between the step and handle. `SceneHandles` exposes checked object, group,
mesh, vector, number, standard-material and point-light accessors. Consumers
mount the root where their existing hierarchy requires it; the host preserves
recipe child order. The engine frame budget paces library reads, slots, steps
and registrations. Existing lent look materials remain shared with their live
uniform writers; missing look slots compile under the resident.

The first adopters replace Driftwood's cascade and cove geometry modules and
Pine Hollow's stream assembly module without changing its
draws, attribute channels, graph materials, render order or puff sphere. Pine's
stream and quad geometry compile from the retained original bake offline; its
spray instance matrices and attributes are rows.
The fictional harbour fixture exercises two steps, cube variants, repeated
instances, named handles, resident re-entry, collider ownership and disposal.
Baked imports, props-node libraries and active collider predicates are refused
until their own data bindings land; ordinary decoration remains props tiles.
No animation, gameplay or geometry builder runs in this host. Both shards
drive the host; the G483 platform approval is also recorded in the
pending-user table. `residentWorldScope(context)` resolves a transitional
world hook to its resident owner. Instance attributes remain bounded static data.

The optional `catalogue` names a verified `WorldSceneModels` JSON blob.
Models can retain raw authored parts (`assembly: 'parts'`) and ordered LOD
bands, including per-part shadow flags, bounds spheres and distance limits.
Every choice shares the same increasing LOD distances. Owned GLB intake
restores `nativeAttributes` with the same decoder as whole-geometry libraries;
no source geometry is fitted or transformed at load.

`game/shardfile/worldSceneMaterials` owns source PBR slots (`kind: 'source'`).
They declare a source URL, asset-manager aliases,
material ordinal, sampler anisotropy and environment intensity. The existing
GLB decoder retains the original material and embedded maps; source mesh
geometry is retired immediately. Aliases preserve tier and compressed-texture
routing. Their owning resident retires the maps and materials. A source slot's
`load: 'placement'` defers decoding until its first named placement, preserving
ordered construction and native opaque-material ordering; static recipe slots
use the default resident load.

`game/shardfile/worldScenePlacement` executes deferred `placements`: named
model draws, exact matrices, culling
policy and optional preplaced native collider rows. Large rows are verified
named JSON blobs (`{ id, file }`), admitted independently before construction.
`handles.place(id)` runs
the named row once, in the caller's world-build order, through the existing
model placement host. It publishes `<id>.root` and `<id>.colliders` into the
same SceneHandles registry. The `forest` cull view, numeric or per-tier distance and angular-size
policies, `piece.follows: 'copy'`, and split-registration pacing are explicit row choices.
`handles.floorAt(id, x, z)` queries the same admitted floor the placement lends to its registry piece.
Owned world-scene model files may be `{ phone, desktop }` references; only
the active tier is decoded, including cold Explorer admission. A placement's
`drawnInto: { part, boxes }` borrows a published SceneHandles object and its
authored six-number box per copy. It performs no mesh rebuild or merge.
Preplaced contacts replace model-contact calculation for that world placement;
the model's original local contacts remain available to Explorer specimens.
No shard callback, private owner path, geometry builder or gameplay rule enters
the host. Ordinary decoration still belongs in props tiles unless it requires
a named handle, a distinct look or a collision registration.


`@wildshard/game/models/worldSceneCatalogue.defineWorldSceneCatalogue(rows)`
extends Z2 to cold-loadable fixed models. Its input is plain JSON: product id,
model metadata, exact parameter choices, library/material slot ids, draw flags,
collider rows, and optional site origins, floor rectangles, boxes and anchors.
`model(key)` returns the model contract; `site(key, choice, modelContext,
registry)` places the declared site through the existing model/physics owner.
Unknown parameters refuse before construction. No geometry builder, callback,
subclass or shard service is accepted.

The section's optional `catalogue` names the admitted model JSON blob. Generated
boot metadata registers Explorer models before the product arrives; a cold
card compares it with that admitted blob before reading verified owned GLBs.
Graph slots borrow existing lent materials, or compile on the card's renderer.
`installWorldScenes` lends prepared native geometry/material resources under
its owner through `sharedModelContext(sky)`. World placements use
that same shared sky context; a fresh `modelContext` has a private memo.
Disposal retires that loan; failed cold loads may retry. Living
building behavior remains on its existing host.

Host bar for the fixed catalogue: **5/6**, passing tests 2–6. Test 1 uses
G483's approved-platform exception while Pine's cabin static shells and
homestead (Pine under-20 batch 6) adopt it; the pending-user entries recheck
at the end of W3. Driftwood supplies the first live rows. The fictional port
fixture checks draw flags, independent geometry, exact collider ownership,
translated floors/anchors, invalid choices, disposal and cold Explorer fill.

### Shared world-scene batches

The client-only `game/shardfile/worldSceneBatch` owner backs these rows;
`@wildshard/format/worldSceneBatch` defines their public data schema.

Optional `batches` reserve named client-only native `BatchedMesh` allocations.
A row declares its material id, instance/vertex/index capacities, draw flags,
fixed geometry references and ordered fixed instances (matrix, sphere, near/far
bands and geometry slots). The LOD threshold may exceed the draw range
when a fixed instance keeps its near geometry throughout that range.
A placement's `batch` references that id. Admission
requires a batched draw with one part and the same material per choice and LOD;
the fixed tail and declared placements must fit the instance capacity.

Run the named placements first. Reading `handles.object(batchId)` or
`handles.mesh(batchId)` finalizes the batch by appending the fixed geometry and
instances after the model calls. Finalization is memoized; later placement
reservations refuse. The resident's existing view camera updates fixed culling.
Unused declarations allocate no GPU batch, so a product can declare separate
phone and desktop capacity rows without allocating both. Disposal retires the
allocation once while source geometry and material retain their existing owners.

A raw model LOD's `from` accepts a number or `{ phone, desktop }`; each choice
must share increasing distances for both profiles. The catalogue resolves the
current engine tier without a shard branch. These remain data declarations:
no builder, cull callback or reflected private owner enters the section.

A placement pose declares either its exact `matrix` or a `yxz` row containing
`yaw`, uniform `scale`, and optional `pitch`/`roll`. The latter delegates to the
existing native `modelPoseMatrix` owner, preserving browser transform and
collider operation order without portable-math copies or executable data.

### Baked objects and original surfaces

A catalogue model may declare `assembly: 'objects'` for a completed offline
weld. Draw order is retained; `depthOnly: true` places a baked caster on the
engine shadow layer with its shared proxy material. Draw `until` and
`castShadow` accept a scalar or `{phone, desktop}` row. A draw may instead
reference a declared plumbing `knob`: distance adds bounded `multiply` and
`add` values; shadow flags read a boolean knob. These resolve when a model
builds, retaining level overrides. Objects have no extra
LOD levels; ordinary `parts` models retain the shared LOD contract.

A placement's `piece` may declare world-space `floors`, `floorPolicy`
(`first` or `highest`) and `solidFloor`. Authored `yxz.yawAtan2` operands
preserve the native browser's turn when offline and browser trigonometry
round differently. They override only the yaw in that authored pose.

The `surface` material row builds an original standard material or a named
PBR scan, optionally mapped through a declared graph. Its bounded properties
retain linear colour vectors, normal scale and ordinary material flags.
`map` borrows a product appearance image by file/id; `lookTextures` binds
named original map slots into the graph. Texture caps are optional tier rows; a cell profile may lower the cap
only at or below its authored native threshold. Appearance file, texture id
and image references are admitted before scene allocation. Construction is
shared per sky, immutable product files and complete row; living parts, world
copies and Explorer specimens borrow one material. Each borrowing scope
retains a lease; the last scope disposes the original and evicts the cache.
Scan bases prepare together so equal sources retain shared texture uploads;
final materials then publish in declared row order, including graph mapping.
`game/shardfile/worldSceneSurface` is client presentation;
its `prepareWorldSceneSurfaces`, `worldSceneSurfaceMaterial` and
`admitWorldSceneSurface` take rows and product data; no shard callback enters
its API.

## Contract boards (G473, G474)

`format/contracts` admits finite offer rows, match rules, weighted draw bands,
initial offers, fallback, board slots, saved-store identity and claim milestones.
Targets, rarity ranks, excluded tags and all reward ids belong to the rows.
`parseContractCatalogue` refuses duplicate offers, invalid selection bands and
missing references before a board can use them.

`game/quest/contracts` provides the deterministic serial draw and pure board
operations: `newBoard`, `recordKill`, `claim`, `reroll`, `loadBoard`, `saveBoard`.
A kill may advance several active offers; progress caps at each target count.
Claiming consumes a completed slot once, increments the streak and draws its
replacement. Tearing consumes a draw and resets the streak. Neither operation
reads time. `saveBoard` returns a string and `loadBoard` accepts saved text; storage stays
with the existing save owner, with no callback ports. Loading rebuilds
descriptions and rewards from admitted rows,
preserving the original serial and bounded progress of older saves.

`game/quest/contractBoard` adds a renderer-free modal owner. Its constructor
accepts only catalogue rows, prompt coordinates and a radius. `use` opens inside
the prompt radius, closes, claims or tears a slot through `CONTRACT_ACTION`.
Successful claims return `{ reward, streak }`; the caller's inventory and
cosmetic owners apply those ids. It accepts no callback, subclass or reflected
owner path. `snapshot` and `prepareRestore` retain the version-1 modal/board
wire; restore validates the complete continuation before mutating live state
and never reapplies rewards. Page panels use the same pure board operations.

The host uses G473's approved-platform exception. A made-up second shard in
`test/contracts-platform.test.ts` drives two slots, unrelated kinds and tags,
a different rarity ladder, four-item rewards and a first-claim finish. Pine's
catalogue fingerprint and old-save test retain its original three-slot serial
sequence, words, rewards and save wire. The pending-user entry names the
contracts + elites feature and the W3 recheck.


### Population Script ABI spawn and retire (G474, G484)

`game/population/spawnScript` owns ABI-v1 `spawn` (5) and `despawn` (6)
for population directors. `installNativeSpawnScript(host, day, rows)`
resolves the existing roster by its step id. `SpawnScript.page(manager,
rows)` is the client-only binding to the actual AnimalManager. Neither
installer accepts a shard callback, subclass or reflected owner path.

`format/spawnScripts` declares bounded logical actor slots, species recipes,
spawn sites, field sources and moves. A spawn command names a recipe row;
that row names its species and site. Dynamic sites read declared x/z fields
written by the script. The real roster allocates the native actor identity
and consumes the existing recipe/memory draws; logical handles never become
native entity ids. Retire releases that same body through its real owner.
Recipe and capacity checks precede command commit. The decision host still
validates the complete batch, authority and four-spawn quota before effects.

The guest owns placement attempts, its declared placement RNG slot, group
iteration and story choices at 10 Hz. Existing ActorMoveRunner mechanics
steer the real bodies at fixed-step frequency. The bounded v1 `radial`
list query (6) returns `[sin(angle) * radius, cos(angle) * radius]`, with
radius 0–10000; the compiler generates `Read.radial` and `List.at` accessors.
This uses the same native math as existing placement and avoids guest trig
library calls consuming the coarse fuel budget. It reads no world state.

Snapshots keep logical-to-native identities, declared guest slots, staged
commands, site fields, moves, channels and the fixed-step remainder. A
row-declared legacy map adopts old population ids and their placement stream
without spawning, drawing, replaying effects or entering Wasm. A quiet
re-save retains the validated input wire until the first simulation step;
subsequent saves write the new continuation. Other v1 owners continue refusing spawn/retire until they bind a population owner;
impulse and weather still need their own feature owners.

`actors/spawn-scripts` admits population-owned v1 rows separately from the
normal actor decision catalogue. `scriptAdmissionRows` supplies both sets to
product byte/memory admission; automatic actor decisions still read only
`sim/scripts`. Catalogue bytes are empty: `readSpawnScript(product, step)`
resolves the exact declared module through the admitted product inventory,
then supplies those verified bytes to the synchronous owner. The worker
forwards this catalogue as part of its explicit admitted context.

### Living buildings (G474)

`format/buildings` holds bounded, JSON-only building, life and cloud rows.
`game/shardfile/sceneHandles` is the platform's typed resource context:
exact ids resolve native geometries, materials, objects and lights. Publication
lends engine resources; it accepts no shard behavior or reflection path.
Native publication adapters remain custom code until Z2 assembles their data.

`game/shardfile/buildingAssembly` builds a record's static weld parts and its
live fittings against that context. It emits life rows for doors, lamps,
swings and wheels. Assembly has no owner callbacks and needs no subclass.
A specimen can assemble the same rows without entering a living system.
`game/shardfile/buildingCloud` draws either baked smoke quads or instanced
hearth seeds with their authored bounds and graph material. Both cloud kinds
use the same resource-id contract; they have no CPU particle update.

`game/shardfile/livingBuildings` owns reversible eased doors, prompts,
kinematic-leaf descriptions, clock-driven lamp glass, lantern swings, wheel
rotation, flickering lights and pooled site lights. Door pieces and prompts
command one state. Its native door event stream is an output notification surface for
platform audio observers, never a shard behavior hook. Static collision
stays with the scene/weld; `registerDoors` registers each moving leaf once
using the declared collision metadata. Moving leaves stay passable until
motion stops and the player clears the declared hinge radius.
The light count stays fixed; day/night and ignition change intensity only.

`snapshot` / `restore` carry door direction, collision rearm state, fractional progress and wheel
phase. Restore validates the complete continuation and stable identities
before changing any live pose. `persist` binds the engine SaveStore and an
instance/group row after all buildings are admitted; interaction, periodic,
page-hide and scope-end checkpoints preserve continuation. Native UUIDs are
resource references only and never durable door or wheel identities.

The assembly and life owners use G474's approved-platform exception while
Nalati's SF48 buildings adopt them; the declaration lives in
`lint/platform-pending-users.json`. Pine drives the complete contract today;
Driftwood's castaway camp drives the same smoke-cloud and resource context;
its shrine drives living material pulse rows and graph dusk parameters.
A made-up second building tests different door motion, prompts and lights.


## Declared client plans (Z1, G480/G483)

`client/plan` (`wildshard:client/plan@1`) is a client-only plain-value section:
`{version:1, features:[...]}`. `src/format/clientPlan.ts` refuses unknown kinds,
duplicates, executable values, reflected owners and caller-selected order.
`admitClientPlan(input, product)` refuses any missing required section with
`ProductError` before any feature runs. Headless simulation ignores this plan.

The compiled registry in `src/game/shardfile/clientPlan.ts` owns the order:

| Kind | Phase / rank | Lifetime | Required section |
|---|---|---|---|
| `strings.register` | world / 0 | entered | `ui/strings` |
| `world.scenes` | world / 20 | resident | `world/scenes` |
| `debug.expose` (`name`) | play / 100 | entered | none |

`installClientPhase(ctx, plan, phase, resident)` uses the shared frame budget.
`clientSceneHandles(product, resident)` reads Z2's typed resident results.
Debug exposes the platform runtime diagnostic object; rows cannot traverse
or invoke it.
There is no dynamic loader, condition, loop or TS hook in a plan.
`wildshard/no-client-plan-reflection` walks imported section schemas and refuses
`BorrowedOwnerPath` and `{owner,path}` reflection.

`ShardfileClient` runs all phases even when trusted runtime stages are otherwise
empty. Templates without a plan keep their existing data path. Pine and
Driftwood declare strings; Driftwood declares its existing debug alias. Their
scene calls keep their current construction order for this entry landing.
Regional trusted entry runs the same phases around its raw runtime hooks;
retained strings and debug exposure unpublish on leave and replay on entry.

First-party `bindings.entry` declares `legacy`, `retainHomeRuntime` and
`stagesOwner`. The discovery generator verifies `runtimeEntry` and emits
literal lazy imports for those exact constructors. `declaredRuntimeEntry`
composes the existing standalone/hybrid entry, running the plan on the native
path too. These constructor links remain trusted migration scaffolding,
separate from the data-only feature API. Runtime saves keep their owners.
Deleting outer `plugin.ts` glue does not close remaining runtime dependency
escapes or remove the runtime block. Sky and Signal retire in a later lockstep
landing. No module path in a client plan selects JavaScript.

`currentPageMode()` (`@wildshard/game/grid/pageMode`) reads the existing leaf
page mode for cold tier rows without a constructor callback. Only page boot
sets this mode through the internal `setPageMode` function.

`ViewFieldHost` (`@wildshard/engine/script/viewFields`) is the isolated client-only
ABI-v1 fallback for `view.field` 105: `[0, fieldId, value, 0]`. Numeric
host-private shared presentation fields have their own storage, defaults and
bounds. Every command validates before publication on the next fixed step.
Public/player fields, authoritative commands, simulation reads and lists are
refused. Local slots remain view-local; guest memory rewinds every call. No
save, physics, replication or authoritative world port enters this host.
`value(name)` reads a presentation number. Simulation scripts still refuse all
view commands. The data client does not automatically execute view rows, and
other v1 view commands still lack adapters. Signal dusk remains G484's row-first
case; this API is its optional fallback.

### Quadruped rig and foot IK (G474/G477)

`game/animation/limbRig` poses borrowed GLB bones from scalar spine channels
and four foot targets. The client-only solver measures the rest bend planes
once, applies spine FK, then two-bone IK with toe pitch. `format/limbRig`
admits bone names, proportions, strides, bounded baked clip samples and blend
rows. `game/animation/limbBlend.LimbAnimator` evaluates locomotion, held action,
recoil and attention in that order on the existing animal clock. Clip ids,
action ids, memory keys, thresholds, response rates and look weights are data.
It neither loads a rig nor creates a simulation timer.

`game/animation/limbView.limbAnimation` binds those rows to a rendered species.
`game/animation/limbQueryView.bindLimbQueryView` stages its already-evaluated scalar pose into
`game/animation/limbQueryPose.LimbQueryPose`, preserving separate body, chest and head
publication clocks. It restores borrowed methods when the view retires.
`format/limbCollision` validates the same collision bake for client and native;
`game/animation/limbCollision.LimbCollision` resolves its four-joint chain without scene nodes.

Native population rows optionally declare `limbPose` (`format/limbPopulation`):
step id, capacity, near distance, head name, collision metadata, blend and clip
bank. The population roster installs `game/animation/limbPopulation` directly,
replacing executable shard pose attachments. The service retains pre-body hit
publication, pre-movement near selection, after-body posing and final render
publication. Version 2 continuations preserve exact cached hits and pose bits;
the version 1 migration remains supported. Native code is renderer-free; GLB
skinning and view bindings are explicitly client-only.

Host bar: **5/6**, failing only two shipped users under G474's approved
quadruped rig + foot IK exception. Pine supplies rows today. A made-up marsh
quadruped proves different skeleton names, proportions, clips and memory keys;
Nalati creature/horse adoption is tracked against G477 for the end of W3.
The host takes rows and existing platform actors, with no shard callback,
subclass or reflected owner path.

## Elite decision features (G473, G484)

`format/eliteFeature` admits named encounter definitions, variants, independent
stream prefixes, ordinary replacements, mode labels and legacy save mappings.
Each fight owns an `actors/spawn-scripts` catalogue entry with an ABI v1
`spawnGroup` binding. Pine's four fight laws live in its AssemblyScript guests;
the platform contains no content actions or shard callbacks.

`game/quest/eliteFeature.readEliteFeature(product, name)` resolves the named
JSON and exact admitted module bytes. `installNativeEliteFeature(host, day,
rows)` binds the real population roster, EliteCore, native combat and clock.
`game/quest/elitePage.installEliteFeaturePage` is client-only presentation using
the same owner, actual AnimalManager, prepared drop models and declared cues.
Both preserve named variants and resolve main/rival identities through the
concrete body authority. Restores validate every binding and strike before
commit; a quiet re-save preserves the validated historical wire.

The internal `game/quest/eliteDecisions` adapter maps row-named observations
and saved fields to the owned guest. `game/quest/eliteStreams` derives each
independent random stream from the declared seed, prefix and encounter id.

Spawn-owned v1 programs can declare bounded strikes and actor fields, execute
`steer` moves from named heading/speed/turn fields, and relocate using declared
coordinate fields. `game/population/scriptStrikes` uses the existing fixed-step
StrikeRunner for cover, geometry, one-hit contact and continuation. Cue edges,
root duration, trauma and tell style are data. An elite guest cannot supply a
TypeScript body adapter, arbitrary callback or reflected owner path.

Host bar: **5/6**, failing only two real shipped users under G473's approved
feature exception. Pine is the first user; the reed-marsh fixture exercises a
different species, three-slot family and AS law. Nalati adoption is tracked in
`lint/platform-pending-users.json` against G484, rechecked at the end of W3.

**Streamed ground cover (G475).** The client-only
`game/looks/streamedCover#createStreamedCover(resources, row, cells)` host
reads `format/streamedCover` rows: cell spacing and cache capacity, per-tier
reach/capacity and work budgets, fade bands, near/far geometry ids, far density
retention, material prefix and shared toon-light identity. `SceneHandles`
resolves geometry ids; version-1 baked cell bytes carry placement, yaw, scale,
tint, ground normals and surface colours. No shard callbacks or subclasses
participate. Terrain placement height comes from the engine's installed field.
`engine/render/streamedInstances` owns the existing twin-buffer upload
and swap path. The unused SDK facade is retired. No renderer algorithm,
material graph, placement density or reach tuning changes during adoption.

Lighting is admitted explicitly through `game/looks/toonLighting` with a
`format/toonLighting` row. The sky, held meshes and cover resolve the same
lighting id; a host-owned follow copies it into the compiled toon family.
Missing lighting, geometry, corrupt cells and mismatched kind counts refuse
before the stream starts. G475 approves the feature from day one, recorded
as approval metadata in `lint/platform-pending-users.json`; a marsh fixture in
`test/streamed-cover-platform.test.ts` drives different geometry/material ids,
bands and capacities without adding a host branch.

**Cover appearance rows.** `game/looks/coverAppearance#createCoverAppearance` is a
client-only material/vertex-channel book shared by fixed and streamed cover.
Rows name compiled graphs, immutable product textures, material properties,
constant geometry attributes and viewer/origin/sun graph parameters. It keeps
the drawing owner's placement, culling, upload and shadow policy. Texture
acquisition shares resources until disposal and retries failures;
`productCoverAppearance(product, file)` borrows one book per immutable product.
The API accepts rows and ids, with no shard callbacks or constructor overrides.

**Toon look host (G475).** `game/looks/toonLook#toonLook(product)` reads
`look/toon` (`format/toonLook`), preparing a client-only look. Its rows name
the lighting identity, ramp-fog colours and range, shadow policy, baked
ground/slab files and material ids, kit variants, sky dome and cloud graphs,
puff instances, channel group and a keyed palette clock.
`game/looks/toonSky` owns sky construction and its day/night drive; all
callbacks remain inside the platform. The terrain painter resolves verified
product bytes and borrows materials from its preparation scope. That scope
clears its loan on disposal; a painter used before preparation refuses.
`game/looks/toonLighting` supplies shared lighting for these hosts and held
meshes. Shards declare cover rows rather than extending the instance streamer.

The feature is approved from day one by G475: the approval metadata names
the feature and decision directly, with no invented future toon shard. The
fictional chalk-coast fixture varies files, materials, fog, shadows, puff
rows, dome dimensions and environment cadence without a host branch.
Ordinary pending-user entries still require a named future shard, live plan
row and recheck; an approval-only entry requires an exact known feature and
its recorded decision. Both forms require public module documentation.


### Row-owned NPC figures (C6)

`format/figures` admits bounded JSON figure rows, baked humanoid skin/rest
facts, material properties, fallback draw ids, pivot joints, sockets,
box/capsule anchors and prompt heights. `game/systems/npc/figureRows.FigureRows`
is client-only presentation: its inputs are the resident `SceneHandles`,
rows and the owning scope. Roots, prompts, joints and sockets publish under
explicit ids; no TypeScript callback, subclass or reflected shard path is
accepted. Z2 `ScenePointRef` names scene parts. Story, dialogue and gesture
decisions remain with their existing owners.

A figure replaces a fallback with the declared baked skin after intake,
using independent skeletons over cached geometry and textures. The existing
humanoid `legBones`/`legPose` preserves the leg, talk, point and walk math;
the quadruped limb-rig solver is a different skeleton contract. Declared
hand attachments follow their socket. LOD, walking collision boxes and talk
points retain their authored values. Pivot figures borrow existing scene
parts and may replace a fitted mesh from a published geometry id. The
replacement retains the old deferred completion order. Live quest builds
supply their concrete resident scope at construction. Scope disposal stops
late adoption and removes only identity-equal publications; it does not
dispose borrowed scene geometry or materials.

`game/models/figureCatalogue.FigureCatalogue` owns the model definitions.
`sdk/npc/figures.FigureCatalogue` reads a named product catalogue containing
the same live and Explorer rows, packed fallback geometry, tier-specific
skin files and card identities. Pivot-only rows use their published scene
parts without a geometry pack. Preparation is explicit and atomic. It
shares the authored fallback material with compatible props, while each
figure gets its own publication namespace and skeleton. Pine Hollow's three
people and Driftwood's Castaway/Trader use the game host; their dialogue,
prompt reach, save ownership and gesture laws stay unchanged. The callback
`NpcRig` wrapper is retired from both current shards, alongside Pine's
three figure runtime modules. The legacy snapshots still use the old wrapper.
