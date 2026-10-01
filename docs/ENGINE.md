# The engine API: `#engine`, `#game`, `#kit`

This is the public API a shard is written against. It covers the three public layers and what each one gives a
shard. One section per § of [01-architecture](plans/game-normalization/01-architecture.md), in the same order.

- **How to write a shard** is [SHARDS.md](SHARDS.md). This file is the reference it points into.
- **The worked example** is the template shard, [`src/shards/_template/`](../src/shards/_template/). It uses every
  plugin verb once. Most examples below are copied from it.
- **This file describes HEAD, not the plan.** Where 01-architecture names something that isn't built yet, or built
  under another name, the section says so.
- **It can't drift.** [`test/engine-docs.test.ts`](../test/engine-docs.test.ts) reads the four index files and
  fails when an export is missing from the [appendix](#appendix-every-export) or the appendix names one that is gone.
  After an index change, run `ENGINE_DOC_WRITE=1 pnpm exec vitest run test/engine-docs.test.ts`, then describe the
  new API in its section.

| Import | File | What it is |
|---|---|---|
| `#engine` | `src/engine/index.ts` | The engine: app, scopes, events, saves, input, UI, render, physics, audio, combat, AI |
| `#engine/data` | `src/engine/data.ts` | The node-safe slice of the engine, for manifests and offline tools (B31) |
| `#game` | `src/game/index.ts` | The Wildshard game: the manifest and plugin types, Bag, coins, loot, compendium, feats, travel |
| `#kit` | `src/kit/index.ts` | Shared content, used by 2+ shards: weapon families, boar and bear, starter effects, NPC rig, hoverboard |

Many `#engine` exports are **ports**: legacy classes a shard still needs while the plan runs (`Game`, `World`, `HUD`,
`AnimalManager`, `Animal`, `getActiveChunk`). They are listed so the test passes, and each section says which ones are
ports. Prefer the context verbs (`ctx.*`) and the services on `ctx.app` where both exist.

## 0. Conventions

| Rule | What it means for you |
|---|---|
| **Layers** | `src/engine/` → `src/game/` → `src/kit/` → `src/shards/<slug>/`. Imports point down the arrow only. A shard never imports another shard |
| **Public index only** | A shard imports `#engine`, `#engine/data`, `#game` and `#kit`, nothing deeper. `#engine/combat/pipeline` is a `wildshard/layer` error. Inside your own folder, use `./` |
| **Composition root** | `src/entry.ts` and `src/main.ts` sit outside the layers. You never edit them for a shard |
| **Node-safe manifest** | `manifest.ts` imports only data and types: `#engine/data`, `#game` types and its own data files. Code arrives through lazy thunks (`load`, `render`, `cues`, `roster`, `preload`). `test/manifests-node-safe.test.ts` imports every manifest in bare node |
| **Extractable engine** | `src/engine/**` holds no Wildshard word: no slug, no "shard", no Bag, coin, loot, compendium or feat. The engine says `level` |
| **Behaviour vs tuning** | Behaviour is a class that extends an engine or kit class. Tuning is a typed data row |
| **Names** | Events, asks, tags, cues, actions and effect ids are dot-case strings: `'damage.dealt'`, `'creature.greyBlob'`, `'cue.sword.hit'`, `'effect.poison'`. Prefix your own with your shard's short name (`template.*`) |
| **Strict** | Strict TS, type-aware oxlint at zero warnings. No `any`, `!`, `as unknown as` or ts-ignore |
| **Simulation apart from visuals** | Gameplay state is plain data. `src/engine/{combat,ai,saves,quests,effects}/**` may not import three beyond its math types (`wildshard/sim-no-render`) |
| **Determinism** | Gameplay randomness comes from `app.rng`, time from `app.clock` |
| **Strings** | Every player-facing line comes from a string table: your `strings.ts`, or `engineString` for the engine's |

The template's imports show the rule:

```ts
import { ShardPlugin, installLoot, installCompendium, type ShardContext } from '#game';
import { IRON_SWORD, Sword, SWORD_IRON, BOAR, BOAR_LOOK, STARTER_EFFECTS, installStarterEffects } from '#kit';
import type { QuestState, Interactable } from '#engine';
import { STRINGS } from './strings';
```

Constants every level shares come from `#engine` / `#engine/data`: `CHUNK_SIZE` (500 m), `CHUNK_HALF`, `CHUNK_DEPTH`,
`TERRAIN_RES`, `ROAD_LENGTH`, `SEED`. `ENGINE_API`, `GAME_API` and `KIT_API` are each layer's API version (all 1).

## 1. App, phases, systems, states

There is one `App` per page: `app` (from `#engine`). A shard reaches it as `ctx.app`.

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
| `GameClock` | `app.clock`: `now` (game seconds, paused time excluded, hit-stop slows it), `real` (wall seconds), `frame`, `mode` (`'live' \| 'capture'`), `setCapture(fps)` |
| `RngService`, `Rng`, `RngStream`, `RngStreams` | `app.rng.stream(name)` returns a seeded `Rng`: `next()`, `range(a, b)`, `int(a, b)` (inclusive), `pick(list)`, `chance(p)`, `weighted(pairs)`, `fork(salt)`. Streams: `'gameplay' · 'ai' · 'spawn' · 'cosmetic'`; add one by merging into `RngStreams` |
| `gameplayRandom` | The `gameplay` stream as a plain `() => number`, for code that takes a function |
| `fnv1a32`, `pageSeed` | Stable hashing and the page's seed |
| `worldTime` | `{ scale, realDt }`: the world's time scale (hit-stop, slow motion) for legacy readers (a port) |

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
| `feat.toast` (from `#game`) | whether a feat toast shows |

**Extend the maps by declaration merging.** Your own events, asks, actions and tier knobs are typed this way. From
the template's `plugin.ts`:

```ts
declare module '#engine' {
  interface TierKnobMap { 'template.propCount': number }
  interface ActionMap { 'template.lantern.toggle': true }
  interface EquipmentSlotMap { 'template-whip': true }
}
```

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
| `loadLevel(spec, hooks)`, `unloadLevel()` | run and dispose a level (§5a). `#game` calls them; a shard never does |
| `setState(s)`, `onEnter`, `onExit`, `addSystem` | §1 |
| `registerDayCycle(clock, scope)`, `registerTrample(field, scope)` | hand a clock or trample field to the engine for this level |

Not built as separate services yet (01 §5 names them): `app.params`, `app.strings`, `app.tiers`, `app.budgets`,
`app.analytics`, `app.explore`, `app.practice`. Their APIs are the exports in §13, §22 and §23.

`window.__wildshard` is the typed probe built from these services. The engine dispatches `ws:ready` once on reaching
`title` (the native shell waits for it).

## 5a. LevelSpec and LevelContext: all the engine sees of a level

The engine never reads a manifest. `#game`'s `toLevelSpec(manifest)` turns it into a `LevelSpec`, then calls
`app.loadLevel(spec, hooks)`. The hooks wrap your plugin's `world`, `kit` and `play`.

| Export | What it is |
|---|---|
| `LevelSpec` | the engine's view of a level: ground, spawn, bounds, sky, atmosphere, grade, look, tiers, budgets, `mechanisms`, fight rules, boot, audio, loadout, species, spawns, minimap, `kitLook` … |
| `BootSpec`, `LoadoutSpec`, `EngineMechanism`, `TierKnobs`, `TierKnobMap`, `TierOverrides` | parts of it (§8, §18, §6, §13.3) |
| `LevelContext` | the verbs below, every one bound to `ctx.scope` |
| `LevelHooks` | `{ world?, kit?, play? }`, each awaited in its stage |
| `LevelAdapters` | how the game shell installs the UI-side verbs (`inputContext`, `hud`, `debugRow`, `playground`); a shard never uses it |
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

## 6. The shard manifest (`#game`)

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
| `ground` | `{ terrain?, structures?, paths?, water? }`, at least one of terrain / structures. `terrain` comes from `buildTerrain(seed, spec)` (`#engine/data`). `water` is `WaterBody` rows (§17) |
| `spawn`, `bounds?`, `camera?` | where the player starts; a soft-respawn box; the portrait FOV |
| `sky`, `atmosphere`, `grade`, `look?` | pure-data look fields |
| `style` | `'toon' · 'painterly' · 'pbr' · 'jiehua' · 'greybox'`: data only, never branched on |
| `kitLook?` | `'toon' · 'painterly' · 'pbr'`: the look shared kit pieces render in |
| `render?` | `() => Promise<LookStrategy>`: your look (§13.1) |
| `groundColor?`, `surfaceAt?` | per-vertex ground colour and masks for a textureless ground |
| `minimap?`, `pois?`, `horizon?`, `horizonStrips?`, `hud?` | maps, named places, horizon, HUD bands to switch on |
| `tiers?`, `budgets` | §13.3, §13.4 |

**Content and play**

| Field | Meaning |
|---|---|
| `uses` | the opt-in mechanisms. Engine: `'weather' · 'dayCycle' · 'bosses' · 'elites' · 'spawns' · 'quests' · 'swim' · 'hover' · 'explore' · 'practice'`. Game: `'coins' · 'loot' · 'compendium' · 'feats' · 'bag.pack'`. A mechanism you don't list isn't built. The type still accepts the legacy tags `pack`, `water`, `creatures` (B81) |
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

`#game` also exports `ShardSword` (a legacy `sword` field's viewmodel), `ChunkTerrain` (the built terrain functions),
and `RGB` / `Vec2` (`#engine/data` has `Vec2`, `TerrainNoise` too).

## 7. The shard plugin and the registry

```ts
export class TemplatePlugin extends ShardPlugin {
  override world(ctx: ShardContext): void { /* level.world: terrain dressing, pieces, playgrounds */ }
  override kit(ctx: ShardContext): void { /* level.kit: weapon / tool / species / effect / encounter rows */ }
  override play(ctx: ShardContext): void { /* level.play: systems, events, input, HUD, quests, encounters */ }
}
export default TemplatePlugin;
```

| Export (`#game`) | What it is |
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

Boot helpers on `#engine`: `StepProgress`, `StepRunner`, `macrotask`, `slicer` (yield inside a long build),
`loadBootRuntime` / `BootRuntime`, `preloadBakedTextures`, `loadBakedSky`, `loadLUT`, `fetchLut`, `LUT_SIZE`,
`PUBLIC_BYTES`, `markUnload`, `setTitleArrival` / `TitleArrival`, `Ktx2Table`, `LoadFailure`. `#engine/data` has
`filePolicy`, `PUBLIC_BYTES`, `ChunkFiles`, `Tier`, `TexMode` for node-side tools.

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
| `'device'` | machine-local | bookkeeping that is never exported or reset (Debug row values) |
| `'session'` | sessionStorage | per tab |

**The rules**
- Keys are dot-case. Prefix your own: `template.notes`.
- A `'shard'` key needs a namespace that is a slug; a hidden level uses a leading `_` (B80).
- Change the shape → bump `version` and add a `migrate` step. A save that fails its schema is moved aside to
  `<key>.corrupt.<time>`, reset to `initial()` and reported; the game never throws.
- `SaveStore.persist()` / `persistHomeScreen()` ask the browser to keep the data. `exportAll`, `importAll`
  (`ImportReport`) and `CorruptSave` back Settings ▸ Save.

The template's one shard key:

```ts
const NOTES = { key: 'template.notes', scope: 'shard' as const, version: 1, schema: v.boolean(), initial: () => false };
const notes = ctx.app.saves.define(NOTES);
if (!notes.read(ctx.manifest.slug)) notes.write(true, ctx.manifest.slug);
```

`#game` defines the shared game keys: `progressSave`, `inventorySave`, `purseSave`, `ownedSave`, `bountySave`,
`compendiumSave`, `bossesSave`, `elitesSave`. Bind one to your shard with `shardSave(slot, slug)`:
`shardSave(purseSave, ctx.manifest.slug).write(n)`. `saveSlug(id)` strips a legacy `chunk://local/` id.
`jsonSlot(key, scope)`, `jsonSchema`, `jsonRecord` and `saveStorage(scope)` cover untyped JSON and the pre-boot keys.

## 10. Input

`app.input` (`InputService`) owns every input listener. A shard never adds a DOM input listener
(`wildshard/no-raw-input`, and `wildshard/shard-sandbox` for window / document listeners).

| Export | What it is |
|---|---|
| `Action` | the action union: the engine's (`move`, `look`, `dodge`, `jump`, `use`, `crouch`, `sprint`, `pause`, `map`, …), `EquipmentAction` (`attack`, `heavy`, `aim`, `reload`, `lock`, `swap.*` …) and everything merged into `ActionMap` (`bag` from `#game`, your own) |
| `ActionMap` | merge your actions into it (§3) |
| `InputContextDef` | `{ id, actions, blocks?, keys?, touch?, priority?, enabled? }` |
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

**Contexts are additive.** An action resolves top-down through the stack; a context blocks only what its `blocks`
names. Touch draws the merged discs of the whole stack, and a higher context's relabel wins per disc. A Tool's context
sits on top of the weapon's and the weapon keeps firing.

**Register, then push.** `ctx.inputContext(def)` registers a context. Registration doesn't push it: push it yourself
with `ctx.app.input.push(id, ctx.scope)`. A weapon names its context in its row (`ui.inputContext`), and the
equipment service pushes it on draw.

```ts
ctx.inputContext({ id: 'template.whip', actions: ['attack', 'heavy', 'lock'], touch: { mode: 'melee', lockable: true, relabel: {} } });
ctx.inputContext({ id: 'template.lantern', priority: 20, enabled: () => ctx.app.state === 'play',
  actions: ['template.lantern.toggle'], keys: { 'template.lantern.toggle': ['KeyL'] },
  touch: { relabel: {}, verbs: { 'verb.1': { action: 'template.lantern.toggle', label: STRINGS.toggle, icon: '' } } } });
ctx.app.input.push('template.lantern', ctx.scope);
```

**Buffer and coyote time** are per-shard data: `manifest.fight.input = { bufferMs: 120, coyoteMs: 100 }`.
**Crouch** requires a shard answer to `player.crouch` (§3); without one the motor stays standing.
Nalati owns its C / Ctrl bindings and grass/taming eligibility. The shared on-foot context has no crouch binding.
Bows use manual hold/release draw on both devices; the automatic-shot action has been removed.

## 11. UI: layers, HUD slots, Bag tabs, error screen

| Export | What it is |
|---|---|
| `UiLayers`, `UiLayer`, `UiView`, `UiHandle` | `app.ui`: layers `'hud' · 'gameMenu' · 'menu' · 'modal' · 'error'`. Pushing a view gives it the one Escape / back handler and the pointer lock; z-order comes from the layer |
| `uiScope`, `mountUi` | a UI scope and mount helper for engine-side views |
| `hudSlots`, `HudBand`, `DiscSpot`, `TouchRelabel` | the one shared HUD. Bands `'band.1'` … `'band.6'`; disc spots `'r0' · 'r1' · 'r2' · 'r3' · 'aim' · 'up0' · 'lean-l' · 'lean-r' · 'edge-r' · 'edge-l' · 'lock' · 'jump'` |
| `HudVerbs`, `VerbSlotOpts` | the scoped verbs on `ctx.hud` |
| `TabRegistry`, `TabId`, `TabSpec`, `TabFragment` | the Bag / menu tab registry the game builds on |
| `IconId`, `icon` | the icon set |
| `BossBar`, `EliteBar` | the shared encounter bars (decision 91: one boss bar look) |
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

**Bag tabs** (`#game`, `ctx.bag`): `tab({ id, title, icon?, order?, hint? })` adds a tab and
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
| `ExtendLook` (`mode: 'extend'`, the default) | `(c: LookComposeContext) => LookComposition`: your passes in the slots `beforeScene`, `afterScene`, `beforeChain`, `chain`, `afterChain`. `c.engineChain('clean' \| 'cinematic')` is the engine's chain, `c.fx` its effects (`EngineEffects`) | most shards (Driftwood, Pine, the template) |
| `ReplaceLook` (`mode: 'replace'`) | `(c: LookReplaceContext) => LookChain`: `{ chain: Pass[] }`, the whole chain in order | a look with its own composer (Nalati) |

Both shapes take these optional parts:

| Part | What it does |
|---|---|
| `backdrop` (`SkyBackdropFactory` → `SkyBackdrop`) | your sky backdrop and day clock. It gets `SkyBackdropContext`, `SkyBackdropTargets`, `SkyBackdropPost` |
| `sky` (`SkyDressing`) | `{ clouds, planet, build?, update? }`: which engine sky objects to build |
| `lighting` (`LightingRig`), `shadows` (`ShadowStyle`) | the light model and shadow rig |
| `fog` (`FogModel`), `fogControl` | your fog patch (`{ order, install }`) and suspend / resume for Explore and playgrounds |
| `terrainPainter` (`TerrainPainter`, `PainterField`) | builds the ground mesh |
| `grass` (`GrassDriver`, `GrassLayer`) | grass |
| `frame(dt, t)`, `dispose()` | per-frame work and cleanup |

The template's grey-box look extends the engine chain and adds nothing to it:

```ts
export function templateLook(): LookStrategy {
  return { mode: 'extend',
    compose: ({ engineChain, scene, scope }) => { /* a gradient dome, linear fog */ return { chain: engineChain('clean') }; },
    sky: { clouds: false, planet: false },
    backdrop: ({ sky }) => { const clock = createDay(); return Promise.resolve({ clock, horizon: new Color(0xa9afb5), lut: null, /* … */ }); },
    terrainPainter: { build: (terrain, field) => { /* a flat-shaded PlaneGeometry on field.heightAt */ return Promise.resolve(); } },
  };
}
```

`#game` re-exports the old names `ShardRender`, `ShardComposeContext`, `ShardComposition` for manifests not yet moved.

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
(`probeRenderer`, `isRenderer`). No WebGPU, no TSL. **Facade multi-draw is banned everywhere** (AGENTS.md E271).

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
| `LevelAudioProfile`, `loadAudio` | a level's audio profile and the lazy audio runtime |
| `Synth`, `vocal`, `windup`, `impact` | synth fallbacks and generators |
| `panFromYaw`, `loopAt`, `audioRandom`, `ownAudioSource` | helpers |

`manifest.audio` is `{ bed?, ambience, score, cues?, preload?, samples?, alertOnlyHostile? }`. The template points every
cue at kit sounds:

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
| Terrain | `buildTerrain` (also `#engine/data`), `heightAt`, `terrainNormal`, `terrainWaterLevel`, `Terrain`, `Noise2D`, `smoothstep`, `clamp`, `lerp`, `TerrainNoise` | `buildTerrain(357, { landscape, trails, cabinSites: [] })` |
| Sky | `Sky`, `SkyBackdrop*` (§13.1), `compassDir` | the template's backdrop drives `sky.setKeyLight` |
| Day cycle | `DayCycle`, `DayCycleSpec`, `DayCycleClock`, `DayKeys`, `DayPhase`, `TimePick`, `LightPreset`, `ScheduleSeg`; `app.registerDayCycle(clock, scope)` | `createDay()` in `_template/world/climate.ts` |
| Weather | `Weather`, `WeatherProfile`, `WeatherNumbers`; asks `weather.hold` / `weather.damage`; kit `rainCurtain` | `new Weather<'clear' \| 'cloudy'>({ states, next, length, … }, ctx.app.rng.stream('gameplay'))` |
| Water | `WaterBody`, `WaterBodies` (`app.world.water`), `swellBody`, `basinBody` (`#engine/data`), `surfaceReflect`, `WaterView`, `pondGrid`, `waveHeight` | the template's `POOL` row in `ground.water` |
| Fog | `attachFogUniforms`, `addFogUniforms`, `fogUniforms`; your `FogModel` | |
| Wind | `wind`, `WIND_DIR`, `windGustAt`, `windUniforms`, `WindField` | grass, trees and arrow drift read it |
| Placement and models | `defineModel`, `modelContext`, `ModelContext`, `ModelPart`, `live`, `listModel`, `RosterEntry`, `twoSidedPositions`, `WeldBuild`, `markGpuOnly` | `defineModel({ id: '_template/lantern', pipeline: 'code', build: () => … })` |
| Forest and trees | `Forest`, `TreeFactory`, `TreeVariant`, `FadeBand`, `patchFade`, `patchWind`, `TREE_SPECS`, `TREE_SPECS_V2`, `TREE_SPECIES`, `SpeciesWeights`, `treeSetOf`, `treeSetUrls`, `loadTreeSetGeometry`, `BARK_LAYERS`, `patchBarkArrays`, `patchCardCrownTop`, `patchImpostorCrownTop`, `standIn`, `loadBakedCards`, `exportCardTextures` | |
| Geometry kit | `log`, `beam`, `rope`, `sagLine`, `rock`, `plank`, `tris`, `wobble`, `pole`, `blob`, `lathe`, `revolve`, `revolveUV`, `mergeVerticesByPos`, `voxelAO`, `aoTint`, `hemisphere`, `VoxelAOParams`, `HemiRing`, `HemiDir`, `lin` | |
| Interactables | `Interactable`, `Interactables`, `InteractEvent`, `Flags`, `Place`, `PoiId` | the template's hut door |
| Bounds and layout | `installBounds`, `layoutFauna` (`#engine/data`), `CHUNK_*` | |
| Content loaders | `loadWorldContent`, `loadMeadow`, `loadPBR`, `loadPBRArray`, `loadGLTF`, `loadTexture`, `pbrMaterial`, `PBRSet` | lazy engine content (ports) |
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
| `EquipmentRow` | `{ id, ui, meta, cues?, hitStop?, tags?, pickup?, rangedFeel?, legacySlot? }`. Also on `#game` |
| `EquipmentMeta` | `{ name, icon, blurb, category }`: the Bag builds its entries from it |
| `WeaponUi` | `{ name, icon, touch, lockOn, melee, tracers, swapIcon, inputContext?, ammo? … }` |
| `EquipmentId`, `WeaponId`, `ToolId` | `'weapon.*'` / `'tool.*'` ids; `WeaponId` is a legacy slot from `EquipmentSlotMap` |
| `EquipmentSlotMap`, `EquipmentIconMap`, `EquipmentTouchMap` | merge your slot, icon or touch mode into them |
| `EquipContext`, `BlockSet`, `WeaponState`, `AimInfo`, `WeaponHooks`, `EquipmentAction`, `quiverState` | equipment plumbing |
| `EquipmentService` | `app.equipment`: the loadout, `add`, `unlock`, swapping |
| `EquipmentHost` | `app.equipmentHost`: the camera / scene the viewmodels draw in |

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

## 19. Creatures and AI

A creature is two rows: a `SpeciesRow` (simulation) and a `SpeciesLook` (render). Register both in `kit`.

| Export | What it is |
|---|---|
| `SpeciesRow` | `{ id, kind, label, variants, aggressive?, tuning?, sounds?, think?(animal, ctx), act?(animal, ctx), tick?, blood?, parent? … }` |
| `SpeciesVariant` | `{ id, label, weight, rarity, scale, hp?, mods? }` |
| `deriveSpecies(parent, patch)` | a row that overrides its parent field by field |
| `SpeciesLook`, `speciesWithLook`, `CreatureHull`, `EyeSpot` | the render row: `{ id, species, kind, rig, fur, rigContract, build(), animate() }` |
| `SpeciesService` | `app.species` |
| `CreatureBrain<S>` | a state machine: `think(ctx)` (decisions, on the brain tick) and `act(ctx)` (the body, every body tick); `transition(state)` |
| `ThinkCtx`, `EnemyWorld`, `AnimalDims`, `VariantMods`, `RigAnimCtx`, `FurStyle` | what a brain and a look receive |
| `StrikeRunner`, `StrikeSpec`, `StrikeContext`, `StrikeActor`, `StrikePhase`, `UtilityScore` | strikes as data: `pick(specs, ctx)`, `start(spec, actor, target)`, `update(dt, ctx)` |
| `canReach`, `ReachActor` | occlusion + nav: can this actor reach the target |
| `Hfsm`, `StateDef`, `StateChange` | the hierarchical state machine under the brains |
| `GroupBrain`, `GroupMember`, `NightBrain`, `NightActor`, `NightSpec`, `NightPorts` | herds and night spawns |
| `WeightedTable`, `WeightedRow`, `TableDrop`, `TableSpec` | spawn and loot tables (`mode: 'weighted' \| 'each'`) |
| `inspectBrain`, `pinBrain`, `brainInspection`, `BrainInspection`, `installAiDebug`, `AiDebugHost`, `AiDebugView` | the AI debug overlay |

A `StrikeSpec` is `{ id, shape, windup, active, recover, cooldown, range, damage, tags, weight, telegraph?, motion?,
eligibility? }`. Shapes: `arc` (radius, halfAngle), `lane` (length, width), `ring` (inner, outer), `wedge` (length,
halfAngle), `point` (radius). The template's blob:

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
`variantDef`, `hasSpecies`, `SpeciesDef`, `VariantDef`, `AnimalSpecies`, `BoneDef`. `runtime.play.animals.spawn(kind,
x, z, yaw, variant)` and `.retire(animal)` are how the template spawns today.
**Species look helpers:** `loft`, `tube`, `skinPlain`, `S`, `boneIndex`, `srgb`, `mix`, `speciesSstep`, `paintNoise`,
`setShag`, `isLowPoly`, `registerToonPaint`, `toonPaint`, `paletteColors`, `Paint`, `ToonPaint`, `SpeciesRGB`,
`setShapeFn`, `Station`, `crestSpikes`, `NO_FUR`, `lookAngles`, `smooth01`, `bump`, `step`, `rigClamp`, `squashBody`.

## 20. The game layer (`#game`)

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
| Travel | `travel`, `bindTravelInventory`, `applyTravelCarry`, `consumeTravelHandoff`, `setShardSwitcher`, `shardMemory`, `TravelRequest`, `TravelHandoff` | a page-reload travel today |
| Cosmetics | `BodyShadow`, `installBodyShadow` | `manifest.bodyShadow` |
| Template | `installTemplateDebug` | the Debug ▸ Developer tools entry that opens a hidden level |

The game's quest wiring sits on the engine's quest core: `QuestState`, `QuestLine`, `lineFor`, `validateQuest`,
`CHIP_MAX`, `QuestDef`, `QuestStep`, `QuestMarker`, `NpcDef`, `DialogueEntry`, `QuestChip`, `NpcTalk`, `loadQuest`
(all `#engine`). The template's quest:

```ts
const quest = new QuestState({ id: 'template.quest', title: STRINGS.quest, completeFlag: 'template.complete', steps: [
  { id: 'hut', objective: STRINGS.reach, done: { all: ['template.hut'] } },
  { id: 'blob', objective: STRINGS.beat, done: { all: ['template.blob'] } },
] }, flags, ctx.app.events, ctx.scope);
quest.onComplete = () => { burst.spawn(player, 5, onCoin, () => { ctx.game.runtime?.play?.hud.toast(STRINGS.reward); }); };
```

## 21. The kit (`#kit`)

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
| `species` | `BOAR`, `BOAR_TUNING`, `BOAR_LOOK`, `BOAR_PALETTE`, `BEAR`, `BEAR_TUNING`, `BEAR_LOOK`, `BEAR_PALETTE`, `installKitSpecies` |
| `effects` | `STARTER_EFFECTS`, `STARTER_CHOICES`, `StarterChoice`, `starterId`, `installStarterEffects` |
| `npc` | `NpcRig`, `NpcRow`, `NpcModel`, `NpcFace`, `rigLegs`, `legRigOf`, `legBones`, `legPose`, `footPlan`, `LEG_BONE_NAMES`, `WALK`, `LegBuilt`, `NpcRigProfile`, `fitNpcFigure`, `mergeNpcFigures`, `NpcFigureFrame`, `NpcFigureBones`, `NpcFigureRig`, `stepNpcFigure`, `npcFigurePose`, `NpcFigureState`, `NpcFigureMotionProfile`, `faceHead`, `loadFaceHead`, `FaceHead` |
| `tools` | `Hoverboard`, `HOVERBOARD_TOOL` (all four shards; its `board` movement mode stays engine) |
| `weather`, `looks` | `rainCurtain`, `RainProgram`, `RainCurtainSpec`, `fogGLSL`, `loadParticles`, `Particles`, `loadGrassField` |
| `audio` | `sharedWeaponVoices`, `createForestAudio`, `installForestAmbience`, `installSilentScore` |
| `bag` | `KIT_ITEMS` |

Kit species take a plain `{ ...BOAR, variants: [...] }` spread to add a variant (the template's Greyback elite).
`SwordWorld`, `SwordRig`, `SwordArms`, `SwordFraming`, `SwordMoveSet` are re-exported from `#engine` for the melee family.

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

## 24. Lint rules and the ratchet

| Rule | What it refuses | Status |
|---|---|---|
| `wildshard/layer` | import direction; shard ↔ shard; deep imports (`#engine/x/y`, relative ones too); engine words in `src/engine/**` | ratchet (per file) |
| `wildshard/no-shard-branch` | outside `src/shards/`: a branch on a slug or a style (`slug ===`, `style ===`, `isNalati`, a slug literal in a comparison or `case`) | hard error |
| `wildshard/no-level-identity` | outside `src/shards/`: comparing, switching on, or keying a table by a level's `id`, `slug`, `kitLook`, `style`, `biome` … Pass a capability or a data strategy instead | ratchet (4 at HEAD) |
| `wildshard/shard-sandbox` | in `src/shards/`: `window` / `globalThis` / `self` reads or writes, window or document input listeners, `setting(key)` for a key you don't own, an `/assets/…` path outside your `assetGlobs` and the shared folders | ratchet (new files at 0) |
| `wildshard/no-raw-save` | `localStorage` / `sessionStorage` outside the save store | hard error |
| `wildshard/no-raw-input` | DOM input listeners outside `src/engine/input` | hard error |
| `wildshard/no-raw-shader-patch` | `onBeforeCompile` / `customProgramCacheKey` outside `src/engine/render` | hard error |
| `wildshard/no-raw-hud` | appending to `#hud` / `document.body` outside the HUD slots | hard error |
| `wildshard/no-raw-animation-mixer` | `new AnimationMixer` outside `src/engine/anim` | hard error |
| `wildshard/sim-no-render` | render / DOM imports in the simulation folders | hard error |
| `wildshard/no-active-chunk` | `getActiveChunk()` outside `#game/shard` | hard error |
| `wildshard/no-inline-ui-string` | player-facing literals in the engine | hard error |
| `wildshard/no-url-switch` | a query param not on the allowlist | hard error |
| `wildshard/no-raw-random-time` | `Math.random` / `performance.now` outside rng / clock | ratchet |
| `wildshard/no-global-listener-patch` | raw `addEventListener` / timers / rAF / body appends outside `src/engine/app` | ratchet |
| `wildshard/no-active-singleton` | `activeRegistry()`, `activePhysics()` … | ratchet |
| `wildshard/no-hook-chain` | `const prev = x.onFoo` hook chaining | ratchet |
| `wildshard/no-renderer-type` | `WebGLRenderer` outside `src/engine/render` | ratchet |

**How the ratchet works.** `lint/ratchet.json` holds `{ rule: { file: count } }`. A count may only go down; a file not
listed is allowed 0, so a new shard starts clean on every rule. A file that reached 0 must lower its line in the same
commit (`node lint/ratchet.mjs --update`). A rule whose total reaches 0 moves to `.oxlintrc.json` as a hard error. The
Debug-row count has its own cap (`debugRows`).

**The other checks a shard meets**

| Check | When | What it checks |
|---|---|---|
| `scripts/precommit-guards.mjs` (`.githooks/pre-commit`) | every `git commit` | the commit's own files: oxlint, the custom rules against the ratchet, the shard layout when `src/shards/**` is touched, `gen-shards --check` when a manifest is touched |
| `scripts/check-shards.mjs` (AG9) | pre-commit, `pnpm test` via `check-paths` | the folder layout in `lint/shard-layout.json`: required files, canonical folders, slug = folder name, `manifest.slug` = folder |
| `scripts/gen-shards.mjs --check` | gate | the generated registry and the shard word list are current |
| `scripts/check-lock.mjs` (`.githooks/commit-msg`) | every commit | the E357 lock: only reopened shards' allowlists, unless `E357-Lead: yes` |
| `scripts/check-paths.mjs` | `pnpm test` | no stale tool paths or empty globs |
| `test/manifests-node-safe.test.ts`, the shard contract tests | `pnpm test` | manifests import in bare node; a shard boots in the fake `Game` |
| `test/engine-docs.test.ts` | `pnpm test` | this file lists every export; SHARDS.md names the layout; every shard has a README |
| the gate (`.github/workflows/gpu-gate.yml`) | every push | one `macos-15` job per shard, from the registry: boot, walk, combat, the leak test, budgets |

## Appendix: every export

Generated from the four index files. Each line is one source module and the names the index exports from it. The
sections above describe what to use; this list is the complete inventory.

<!-- exports:start (generated by test/engine-docs.test.ts; do not edit by hand) -->

### `#engine` (`src/engine/index.ts`)

674 exports, grouped by the module they come from.

- `./core/config`: `CHUNK_HALF`, `ROAD_LENGTH`, `SEED`, `CHUNK_SIZE`, `CHUNK_DEPTH`, `TERRAIN_RES`
- `./world/terrainField`: `buildTerrain`
- `./world/bounds`: `installBounds`
- `./level/data`: `ExploreSpec`, `RGB`
- `./app/app`: `App`, `SystemsByPhase`
- `./app/systems`: `PHASES`, `inState`, `AppState`, `Phase`, `RunCondition`, `SystemSpec`, `TickRateId`
- `./app/scope`: `Scope`, `Disposable3`, `PhysicsHandle`, `SoundHandle`, `ScopeCensus`
- `./app/assets`: `AssetService`, `AssetCensus`, `AssetRecord`
- `./events/events`: `Events`, `EVENT_FLUSH_LIMIT`, `ListenerOptions`
- `./events/maps`: `EventMap`, `AskMap`, `TagMap`, `Tag`, `FaultEvent`, `AskInput`, `AskOutput`
- `./events/tags`: `hasTag`
- `./core/clock`: `GameClock`
- `./core/rng`: `Rng`, `RngService`, `fnv1a32`, `pageSeed`, `RngStream`, `RngStreams`
- `./app/runtime`: `app`, `gameplayRandom`
- `./app/ownership`: `currentOwner`, `enterOwner`, `withOwner`, `asShell`, `onOwnerDispose`
- `./app/resources`: `resourceScope`, `pageScope`
- `./audio/ownership`: `ownAudioSource`
- `./core/harnessTap`: `ambientTick`, `tap`
- `./app/cachedAssets`: `retainCachedResources`
- `./boot/gpuFiles`: `Ktx2Table`
- `./core/errorReport`: `LoadFailure`
- `./level/load`: `LevelLoadError`, `LevelDriver`, `LevelStage`
- `./level/spec`: `resolveTierKnobs`, `needsTerrainCollider`, `LevelSpec`, `BootSpec`, `LoadoutSpec`, `EngineMechanism`, `TierKnobMap`, `TierKnobs`, `TierOverrides`
- `./level/registrations`: `LevelRegistrations`
- `./level/context`: `LevelContext`, `LevelHooks`, `LevelAdapters`, `EngineRows`, `ContentRow`, `ContentRowMap`, `InputContextDef`, `HudVerbs`, `HudBand`, `VerbSlotOpts`, `DebugRowSpec`, `PlaygroundSpec`, `StringTable`, `TierKnobSchema`
- `./render/look`: `LookStrategy`, `LookComposeContext`, `LookComposition`, `SkyBackdrop`, `SkyBackdropContext`, `SkyBackdropFactory`, `SkyBackdropTargets`, `SkyBackdropPost`, `LookReplaceContext`, `LookChain`, `FogModel`, `TerrainPainter`, `PainterField`, `GrassDriver`, `GrassLayer`, `ExtendLook`, `ReplaceLook`, `SkyDressing`
- `./render/shaderPatches`: `patchShader`, `takeForeignHook`, `setInheritedPatch`, `setProgramKey`, `hasProgramKey`, `PATCH_ORDER`, `ShaderSource`, `ShaderPatchFn`, `ShaderPatchKey`, `ShaderPatchOptions`
- `./physics/box`: `boxInFrame`, `BoxSpec`
- `./player/Player`: `Player`
- `./saves/store`: `SaveStore`, `SaveKeyDef`, `SaveSlot`, `SaveScope`, `ImportReport`, `CorruptSave`
- `./saves/runtime`: `saves`, `persistHomeScreen`
- `./saves/slots`: `jsonSlot`, `jsonSchema`, `jsonRecord`, `saveStorage`
- `./audio/contentApi`: `loadAudio`
- `./audio/SetScore`: `ScoreSource`, `SetScore`
- `./audio/Cues`: `CuePlayer`, `CueMap`, `CueOpts`, `CueBank`, `SampleClip`
- `./audio/AmbienceBeds`: `ZoneWeights`
- `./audio/levelAudio`: `LevelAudioProfile`
- `./audio/Music`: `MusicState`, `Music`
- `./physics/query`: `castRay`, `castSegment`, `floorBelow`, `lineOfSight`, `sticksIn`
- `./combat/Equipment`: `Equipment`, `EquipmentRow`, `EquipmentMeta`, `EquipmentSlotMap`, `EquipmentIconMap`, `EquipmentTouchMap`, `WeaponUi`, `EquipContext`, `BlockSet`, `EquipmentId`, `WeaponId`, `ToolId`
- `./combat/Weapon`: `Weapon`, `quiverState`, `WeaponState`, `AimInfo`, `WeaponHooks`, `ImpactSurface`
- `./combat/Tool`: `Tool`, `EquipmentAction`
- `./combat/EquipmentService`: `EquipmentService`
- `./input/equipmentInput`: `EquipmentInput`
- `./ui/icons`: `IconId`, `icon`
- `./ui/Menu`: `KitEntry`, `GameMenu`, `GameMenuOptions`
- `./combat/pipeline`: `CombatPipeline`, `Actor`, `CombatTag`, `DamageRequest`, `DamageDealt`, `DamageRuleDef`, `DeathCause`, `HealthAttributes`, `StringKey`
- `./combat/health`: `PlayerHealth`, `PlayerHealthPorts`
- `./combat/effects/EffectService`: `EffectService`
- `./combat/effects/types`: `sourceMultiplier`, `matchesTag`, `AttributeSet`, `EffectDef`, `EffectTarget`, `EffectId`, `ActiveEffect`, `SourceMulDef`, `CueId`
- `./combat/cues`: `CombatCues`, `audioCueMap`, `resolveHitStop`, `CombatCueMap`, `CombatCueOpts`, `HitStopProfile`
- `./blocks`: `blocks`
- `./combat/blocks/melee`: `melee`, `aimRay`, `fovForAspect`
- `./render/viewmodelFeel`: `viewmodel`, `DrawingBuffer`, `LookSpring`, `LookLag`
- `./core/Game`: `Game`
- `./world/Sky`: `Sky`
- `./world/forest/Forest`: `Forest`
- `./combat/types`: `Targets`, `TargetAnimal`, `TargetHit`
- `./combat/view/melee`: `Move`, `Key`, `Trail`, `SwordWorld`, `SwordRig`, `SwordArms`, `SwordFraming`, `SwordMoveSet`
- `./player/bladeGlow`: `BladeGlow`
- `./player/dodge`: `dodgeFx`, `dodgeEnv`
- `./player/AimTargets`: `getAimTargets`, `lockOn`, `meleeLock`, `targetRadius`, `AimTarget`
- `./player/MeleeSweep`: `bladeBlocked`, `bladeContact`, `Clang`
- `./core/time`: `worldTime`
- `./player/CameraFX`: `CameraFX`
- `./fx/Impacts`: `Impacts`
- `./models/model`: `defineModel`, `ModelContext`, `ModelPart`, `modelContext`
- `./world/dayCycle`: `DayCycle`, `DayCycleSpec`, `DayCycleClock`, `DayKeys`, `DayPhase`, `TimePick`, `LightPreset`, `compassDir`, `ScheduleSeg`
- `./world/weather`: `Weather`, `WeatherProfile`, `WeatherNumbers`
- `./input/InputService`: `InputService`, `Action`, `ActionMap`, `TouchVerb`, `TouchVerbSpec`
- `./combat/view/EquipmentHost`: `EquipmentHost`
- `./ui/hudSlots`: `hudSlots`, `TouchRelabel`, `DiscSpot`
- `./combat/view/projectile`: `Projectiles`, `projectileFlightStep`, `ProjectileKind`, `ProjectileWorld`, `ShotOpts`, `WindField`
- `./combat/view/DropArc`: `DropArc`
- `./combat/blocks/ads`: `blendAds`
- `./combat/view/brass`: `brassFloor`, `stepBrass`, `BrassCase`
- `./combat/view/hitscan`: `hitscan`, `HitscanProfile`, `HitscanResult`
- `./combat/view/firearmFx`: `HitLine`, `makeFlashTexture`
- `./combat/view/ranged`: `Puffs`, `worldHit`, `impactSurfaceOf`, `FOV_HIP`, `FOV_ADS`, `rangedFovForAspect`, `dataTexture`, `viewmodelTexSet`, `remapUV`, `makeCord`, `makeBoltAtlas`, `fixIBL`, `VIEWMODEL_GROUP`, `viewmodelMaterial`, `isMesh`, `box`, `cyl`, `edgeWear`, `whiteColors`, `stripExtra`, `TRACER_ORDER`, `TRACER_RED`, `clamp01`, `sstep`, `startViewmodelTextures`, `viewmodelTexturesReady`, `TexSet`, `CrossbowWorld`, `CrossbowOptions`, `RangedWorld`, `RangedOptions`
- `./ui/Settings`: `getSetting`, `getNumber`, `onNumber`, `onSettingChange`, `setting`, `OptionValue`, `MusicStyle`
- `./fx/LightPool`: `LightPool`
- `./fx/ParticlePool`: `ParticlePool`, `pointScale`, `ParticlePoolSpec`, `ParticleAttr`
- `./world/voxelAO`: `voxelAO`, `aoTint`, `hemisphere`, `VoxelAOParams`, `HemiRing`, `HemiDir`
- `./world/geometryKit`: `log`, `beam`, `rope`, `sagLine`, `rock`, `plank`, `tris`, `wobble`, `pole`, `blob`, `mergeVerticesByPos`, `lathe`, `revolve`, `revolveUV`
- `./world/painterly`: `painterlyMaterial`, `syncPainterlySun`, `updatePainterly`, `setPainterlyLook`, `painterlyUniforms`
- `./player/nalatiArms`: `ARM_PAL`, `gloveFist`, `riderArm`, `placeArm`, `forearm`
- `./world/steppeWind`: `wind`
- `./world/wind`: `WIND_DIR`, `windGustAt`
- `./core/shadowLayer`: `SHADOW_LAYER`
- `./combat/ammo`: `AmmoId`, `AmmoRow`, `ProjectileModification`
- `./ai/hfsm`: `Hfsm`, `StateDef`, `StateChange`
- `./app/scheduler`: `TickScheduler`, `TickBand`, `TickRate`, `TickActor`, `InterruptReason`
- `./ai/strikes`: `StrikeRunner`, `StrikeSpec`, `StrikeContext`, `StrikeActor`, `StrikePhase`, `UtilityScore`
- `./ai/reach`: `canReach`, `ReachActor`
- `./ai/director`: `AggressionDirector`, `AggressionService`
- `./ai/BossBrain`: `BossBrain`, `BossDefinition`, `BossSaved`, `BossPorts`, `BossPresentation`, `BossScript`, `BossState`
- `./ai/EliteBrain`: `EliteBrain`, `EliteDefinition`, `EliteActor`, `ElitePorts`
- `./ai/encounters`: `EncounterRegistry`, `EncounterDefinition`, `EncounterService`, `SpawnTableRow`, `SpawnEntry`, `SpawnContext`, `SpawnPoint`, `Spawner`
- `./world/Atmosphere`: `attachFogUniforms`, `fogUniforms`, `addFogUniforms`
- `./boot/bakedApi`: `preloadBakedTextures`, `loadBakedSky`, `loadLUT`
- `./render/lut`: `fetchLut`, `LUT_SIZE`
- `./math/color`: `lin`
- `./core/assets`: `loadPBR`, `loadGLTF`, `pbrMaterial`, `PBRSet`, `loadTexture`, `loadPBRArray`
- `./world/terrainHeight`: `heightAt`, `terrainNormal`, `terrainWaterLevel`
- `./world/registry`: `boxDesc`, `ColliderDesc`, `WorldRegistry`, `activeRegistry`
- `./core/tier`: `TIER_CONFIG`, `TIER`, `buildTier`
- `./boot/plan`: `macrotask`, `slicer`, `StepRunner`, `StepProgress`
- `./models/weld`: `twoSidedPositions`, `WeldBuild`
- `./world/interact/types`: `Interactable`, `PoiId`, `Place`
- `./core/bootstrap`: `World`
- `./entities/AnimalManager`: `AnimalManager`, `HuntTuning`
- `./audio/Audio`: `Audio`, `StepSurface`, `AnimalSound`, `HoofSurface`, `ImpactKind`
- `./ui/HUD`: `HUD`
- `./ui/Map`: `FullMap`, `FullMapPoi`, `MapQuest`
- `./player/Skins`: `SkinLocker`, `SkinDef`
- `./contentApi`: `loadWorldContent`
- `./entities/Animal`: `Animal`
- `./combat/view/rangedFeel`: `installRangedFeel`, `RangedFeelProfile`
- `./ai/inspect`: `inspectBrain`, `pinBrain`, `brainInspection`, `BrainInspection`
- `./ai/view/DebugOverlay`: `installAiDebug`, `AiDebugHost`, `AiDebugView`
- `./ai/weighted`: `WeightedTable`, `WeightedRow`, `TableDrop`, `TableSpec`
- `./ai/NightBrain`: `NightBrain`, `NightActor`, `NightSpec`, `NightPorts`
- `./quest/core`: `QuestState`, `QuestLine`, `lineFor`, `validateQuest`, `CHIP_MAX`, `QuestDef`, `QuestStep`, `QuestMarker`, `NpcDef`, `DialogueEntry`
- `./quest/view`: `QuestChip`, `NpcTalk`
- `./quest/contentApi`: `loadQuest`
- `./ai/species`: `deriveSpecies`, `SpeciesRow`, `SpeciesVariant`
- `./entities/species/look`: `speciesWithLook`, `SpeciesLook`, `CreatureHull`, `EyeSpot`, `SpeciesService`
- `./entities/species/registry`: `registerSpecies`, `speciesDef`, `variantDef`, `hasSpecies`, `SpeciesDef`, `VariantDef`, `AnimalSpecies`, `BoneDef`, `RigAnimCtx`, `FurStyle`, `ThinkCtx`, `EnemyWorld`, `AnimalDims`, `VariantMods`
- `./entities/species/loft`: `loft`, `tube`, `skinPlain`, `S`, `boneIndex`, `srgb`, `mix`, `speciesSstep`, `paintNoise`, `setShag`, `isLowPoly`, `registerToonPaint`, `toonPaint`, `paletteColors`, `Paint`, `ToonPaint`, `SpeciesRGB`, `setShapeFn`, `Station`
- `./entities/lowpoly`: `crestSpikes`
- `./fx/groundFx`: `fxMaterial`, `annulus`, `FX`, `FxMaterial`, `FxMode`
- `./world/TreeFactory`: `TreeFactory`, `patchFade`, `patchWind`, `TreeVariant`, `FadeBand`, `windUniforms`
- `./audio/ambience`: `AmbienceZones`, `ZoneVoice`
- `./audio/util`: `panFromYaw`, `loopAt`, `audioRandom`
- `./audio/Voices`: `VoicePool`, `VoiceTable`, `SampleVoice`, `SamplePolicy`
- `./ui/Minimap`: `MinimapPalette`, `MapOverlay`, `MapPoi`, `MapMark`
- `./core/noise`: `Noise2D`, `smoothstep`, `clamp`, `lerp`
- `./world/Terrain`: `Terrain`
- `./world/BakedCards`: `loadBakedCards`, `exportCardTextures`
- `./core/gpuOnly`: `markGpuOnly`
- `./world/forest/treeSpec`: `treeSetOf`, `TREE_SPECS`
- `./world/forest/treeSet`: `BARK_LAYERS`, `loadTreeSetGeometry`, `patchBarkArrays`, `patchCardCrownTop`, `patchImpostorCrownTop`, `standIn`, `treeSetUrls`
- `./boot/bytes.generated`: `PUBLIC_BYTES`
- `./boot/lastEnd`: `markUnload`
- `./boot/titleArrival`: `setTitleArrival`, `TitleArrival`
- `./world/forest/treeSpecies`: `TREE_SPECS_V2`
- `./combat/targets`: `authoredTargets`, `RayTargets`
- `./meadowApi`: `loadMeadow`
- `./practice/playground/Playground`: `PlaygroundHost`, `Playground`
- `./physics/paths`: `pathRampDescs`
- `./analytics`: `AnalyticsSink`, `AnalyticsEvent`, `AnalyticsMap`, `AnalyticsBatch`
- `./audio/Stems`: `SlotAudio`, `StyleBank`, `StemSting`, `BossPhase`
- `./audio/synth`: `Synth`
- `./strings`: `ENGINE_STRINGS`, `engineString`, `installEngineStrings`, `EngineStringKey`
- `./physics/ropeChain`: `RopeChain`, `RopeChainSpec`
- `./world/water/body`: `WaterBodies`, `swellBody`, `WaterBody`
- `./entities/species/rigs`: `NO_FUR`, `lookAngles`, `smooth01`, `bump`, `step`, `rigClamp`, `squashBody`
- `./ui/BossBar`: `BossBar`
- `./world/pondGrid`: `pondGrid`
- `./ai/GroupBrain`: `GroupBrain`, `GroupMember`
- `./ai/CreatureBrain`: `CreatureBrain`
- `./ai/bossDefinition`: `BossDef`
- `./entities/eliteBrain`: `setEliteBrain`, `setEliteDamage`, `setEliteAct`, `eliteThink`, `eliteDamageMul`, `eliteAct`
- `./ui/EliteBar`: `EliteBar`
- `./physics/groups`: `GroupName`, `groups`
- `./core/practiceRoom`: `practiceRoom`
- `./world/interact/flags`: `Flags`
- `./world/interact/Interactables`: `Interactables`, `InteractEvent`
- `./ui/FirstHints`: `FirstHints`
- `./physics/bodies`: `activeBodies`, `Body`, `BodySpec`
- `./world/waves`: `waveHeight`
- `./audio/gen`: `vocal`, `windup`, `impact`
- `./anim/index`: `loadRigFile`, `loadRig`, `bindRig`, `ClipChannel`, `AnimMachine`, `ClipName`, `SocketName`, `RigContract`, `RigBake`, `RigRef`, `RigInstance`, `AnimMachineDef`, `AnimState`, `AnimService`
- `./level/selection`: `activeLevel`, `selectedLevel`, `onLevelChange`, `configureLevel`
- `./render/renderer`: `Renderer`, `probeRenderer`, `isRenderer`
- `./ui/Feedback`: `Feedback`
- `./explore/Explore`: `Explore`, `ExploreMode`
- `./practice/playground/catalog`: `PlaygroundId`
- `./core/frameCost`: `Bucket`
- `./boot/contentApi`: `loadBootRuntime`, `BootRuntime`
- `./boot`: `levelSequenceDriver`, `LevelSequence`, `LevelBoundary`
- `./practice/TrainingArena`: `TrainingArena`
- `./render/hoverboardGeometry`: `buildHoverboard`
- `./input/gameplay`: `installGameplayInput`, `weaponInputContext`
- `./ui/ownership`: `uiScope`, `mountUi`
- `./ui/layers`: `UiLayers`, `UiLayer`, `UiView`, `UiHandle`
- `./ui/tabs`: `TabRegistry`, `TabId`, `TabSpec`, `TabFragment`
- `./input/weaponActions`: `weaponActionGate`
- `./input/dom`: `listenDom`
- `./ui/authoredDebugRows`: `registerGlobalDebugAction`, `GlobalDebugActionSpec`
- `./models/live`: `live`, `listModel`, `RosterEntry`
- `(local)`: `ENGINE_API`

### `#engine/data` (`src/engine/data.ts`)

20 exports, grouped by the module they come from.

- `./core/config`: `CHUNK_HALF`
- `./core/noise`: `smoothstep`, `clamp`, `lerp`
- `./world/terrainField`: `buildTerrain`
- `./world/faunaLayout`: `layoutFauna`
- `./world/forest/treeSpecies`: `TREE_SPECIES`, `SpeciesWeights`
- `./boot/filePolicy`: `filePolicy`, `PUBLIC_BYTES`
- `./boot/bytes`: `ChunkFiles`
- `./core/tier`: `Tier`
- `./boot/gpuFiles`: `TexMode`
- `./level/data`: `TerrainNoise`, `Vec2`
- `./world/water/body`: `swellBody`, `basinBody`, `WaterBody`
- `./world/water/view`: `surfaceReflect`, `WaterView`

### `#game` (`src/game/index.ts`)

93 exports, grouped by the module they come from.

- `./equipmentTypes`: `EquipmentRow`
- `./shard/plugin`: `ShardPlugin`
- `./shard/context`: `shardContext`, `ShardContext`, `GameServices`, `GameRows`, `GameRowMap`, `BagVerbs`
- `./shard/spec`: `toLevelSpec`
- `./shard/manifest`: `ShardManifest`, `ShardSword`, `ChunkTerrain`, `RGB`, `Vec2`
- `./saves`: `progressSave`, `inventorySave`, `purseSave`, `ownedSave`, `bountySave`, `compendiumSave`, `bossesSave`, `elitesSave`, `saveSlug`, `shardSave`
- `./loot/Owned`: `OwnedId`, `Owned`, `isOwnedId`, `isCosmetic`, `OWNED`
- `./Inventory`: `ItemId`, `ITEMS`, `isItemId`
- `./shard/runtime`: `ShardRuntime`
- `./compendium/install`: `installCompendium`, `CompendiumHost`, `CompendiumWallPort`
- `./travel/travel`: `travel`, `bindTravelInventory`, `applyTravelCarry`, `consumeTravelHandoff`, `setShardSwitcher`, `shardMemory`, `TravelRequest`, `TravelHandoff`
- `./bag/items`: `normalizeItemRow`, `ItemRow`, `RegisteredItemRow`
- `./bag/itemCatalog`: `registerItemRow`
- `./achievements`: `AchievementDef`
- `./bag/bag`: `renderFinds`, `GearLoot`, `CosmeticSlot`, `FindsView`
- `./quest/QuestUI`: `RewardCaption`, `DialogueBox`, `ObjectiveLine`
- `./loot/tables`: `registerLootTable`, `getLootTable`, `rollLoot`, `LootTableRow`, `LootContext`
- `./Progress`: `ProgressSink`
- `./quest/quest`: `QuestState`, `QuestMarker`, `NpcDef`
- `./complete/ShardComplete`: `ShardComplete`, `setCompleteEntry`, `ShardCompleteData`
- `./quest/core`: `NpcTalk`, `QuestChip`, `LiveMarker`
- `./shard/registry`: `findShard`, `findChunk`, `getActiveChunk`, `game`
- `./loot/runtime`: `installLoot`, `ScopedLootHost`, `ScopedLoot`, `LootPresentation`, `LootShop`
- `./loot/deaths`: `onCreatureDeath`, `DEATH_ORDER`, `CreatureDeathSource`
- `./loot/ui/ShopPanel`: `ShopPanel`, `ShopGood`, `ShopState`, `ShopOpts`
- `./cosmetics/bodyShadow`: `BodyShadow`, `installBodyShadow`
- `./shard/world`: `ShardWorld`
- `./shard/templateDebug`: `installTemplateDebug`
- `./loot/CoinBurst`: `CoinBurst`
- `(local)`: `GAME_API`

### `#kit` (`src/kit/index.ts`)

131 exports, grouped by the module they come from.

- `./weapons/ui`: `SWAP_GLYPHS`
- `./weapons/equipment`: `SWORD`, `WOODEN_SWORD`, `IRON_SWORD`
- `./weapons/melee/Melee`: `Melee`, `meleeActor`, `MeleeProfile`, `ViewmodelFeel`
- `./weapons/melee/SweptMelee`: `Sword`, `swordEvents`, `buildSword`, `swordMaterial`
- `./weapons/melee/profiles`: `SWORD_WOOD`, `SWORD_IRON`
- `./weapons/melee/moves`: `key`, `COMBO`, `HEAVY`, `REST`, `CHARGE`, `SPRINT`
- `#engine`: `SwordWorld`, `SwordRig`, `SwordArms`, `SwordFraming`, `SwordMoveSet`
- `./weapons/thrown/Thrown`: `Thrown`, `ThrownProfile`
- `./weapons/bow/family`: `Bow`, `BowWorld`, `BowOptions`
- `./weapons/bow/profiles`: `BOW`
- `./weapons/bow/profile`: `BowProfile`, `BowStyle`, `BowView`, `GripPose`
- `./weapons/bow/recurve`: `ARROW_LEN`, `POSE`, `VM_SHADE`, `buildArrowGeometry`, `arrowKind`, `arrowMaterial`, `bowSpecimen`
- `./weapons/bow/index`: `QUIVER_MAX`, `AIM_ZOOM`, `AIM_VM_ZOOM`, `AIM_SWAY`, `AIM_SPREAD`, `AIM_IN`
- `./weapons/crossbow/Crossbow`: `Crossbow`, `PLAIN_BOLT`, `MAX_BOLTS`, `buildCrossbow`, `buildBolt`, `boltFlightStep`, `BoltMod`
- `./weapons/crossbow/profiles`: `CROSSBOW_PROFILE`, `CrossbowProfile`
- `./weapons/firearm/Firearm`: `Firearm`
- `./weapons/firearm/profiles`: `AR15`, `FirearmProfile`
- `./weapons/firearm/Rifle`: `Rifle`, `buildRifleParts`, `RifleParts`, `RifleOptions`
- `./weather/rainCurtain`: `rainCurtain`, `RainProgram`, `RainCurtainSpec`
- `./looks/fogProgram`: `fogGLSL`
- `./viewmodel/hunterHands`: `BUCKSKIN`, `HANDS_MATERIAL`, `WeaponHands`, `coatMaterialParams`, `holdDef`, `withHunterPalette`, `blendGrip`, `gripPose`, `HandHold`
- `./lookApi`: `loadParticles`, `loadGrassField`
- `./looks/particles`: `Particles`
- `./effects/starter`: `STARTER_EFFECTS`, `STARTER_CHOICES`, `starterId`, `StarterChoice`
- `./effects/install`: `installStarterEffects`
- `./weapons/crossbow/display`: `crossbowDisplayModel`
- `./npc/npcRig`: `rigLegs`, `legRigOf`, `legBones`, `legPose`, `footPlan`, `LEG_BONE_NAMES`, `WALK`, `LegBuilt`, `NpcRigProfile`, `NpcRig`, `NpcRow`, `NpcModel`, `NpcFace`
- `./species/boar`: `BOAR`, `BOAR_TUNING`
- `./species/bear`: `BEAR`, `BEAR_TUNING`
- `./species/view/boar`: `BOAR_LOOK`, `BOAR_PALETTE`
- `./species/view/bear`: `BEAR_LOOK`, `BEAR_PALETTE`
- `./species/install`: `installKitSpecies`
- `./npc/figureRig`: `fitNpcFigure`, `mergeNpcFigures`, `NpcFigureFrame`, `NpcFigureBones`, `NpcFigureRig`
- `./npc/figureMotion`: `stepNpcFigure`, `npcFigurePose`, `NpcFigureState`, `NpcFigureMotionProfile`
- `./bag/items`: `KIT_ITEMS`
- `./audio/weaponVoices`: `sharedWeaponVoices`
- `./npc/faceHeads`: `faceHead`, `loadFaceHead`, `FaceHead`
- `./viewmodel/armClips`: `ARM_CLIPS`, `SWIM_CLIPS`, `armClipNames`
- `./tools/hoverboard`: `Hoverboard`, `HOVERBOARD_TOOL`
- `./audio/forest`: `createForestAudio`, `installSilentScore`, `installForestAmbience`
- `(local)`: `KIT_API`

<!-- exports:end -->
