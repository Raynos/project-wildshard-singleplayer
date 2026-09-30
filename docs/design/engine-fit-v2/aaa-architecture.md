# AAA modular gameplay architecture: what Wildshard should copy (E357 research, 2026-09-30)

Research for [E357](../../tasks/asks/E357.md) (decisions 1–9: `src/engine/` + `src/kit/` + `src/shards/<slug>/`, lazy
shards, mechanism vs content, melee + ranged combat in the engine). Jake asked for the AAA best practice for an action
adventure sandbox, and for what sets us up for the long term. Its sibling [engine-fit.md](engine-fit.md) settles the
*build* side: no engine switch, Bevy's App/Plugin shape without an ECS, one lazy chunk per shard, a layer lint rule.
This file settles the **gameplay** side: how combat, creatures, bosses, encounters, input, UI, events and saves are
shaped so that a 5th, 6th or 7th shard is data plus a small plugin. These are ideas only; Jake has approved none of it.

Method: primary docs (Epic, Unity, Godot, Bevy), GDC Vault abstracts and slides, studio blogs, and the modding wikis
that document shipped data formats (FromSoftware, Nintendo, Blizzard). Wildshard counts are from the
[audit](../../audits/game-normalization-2026-09-30.md) and `src/` at `b33722f0`.

## The answer in one paragraph

Every studio that ships a lot of content on one engine converges on the same four ideas. (1) **The core never knows
the content**: Epic builds Game Features so that the core game doesn't know they exist and they switch on and off
without breaking it, and Fortnite's seasons ship that way. (2) **A level or mode is a data asset listing what it turns on**: Lyra's *Experience*
names the features to enable, the pawn data and the shared *Action Sets*. That is exactly our shard manifest, and
Action Sets are exactly our kit. (3) **Gameplay is rows of typed data read by a few generic mechanisms**: FromSoftware's
hundreds of param tables, Breath of the Wild's actor parameter files, Diablo's treasure classes, Valhalla's "fighting
with data". (4) **Systems talk through tags, messages and cues, not through each other**: Gameplay Tags, the Gameplay
Message Router, Gameplay Cues. For Wildshard that means a **GAS-lite combat core** (attributes, effects, moves as data,
one damage pipeline, cosmetic cues resolved per shard style), **creature and weapon type objects with parents** (the
Longbow becomes a Bow row with overrides), **AI as HFSM + weighted/utility choice + an aggression director + a goal
stack for bosses** (no planners), **input contexts**, **four UI layers with HUD slots**, and **versioned saves with
migrations**. Skip what exists for 100-person teams, networking and editors.

## 1. Pattern table

Verdict: **adopt** = take the pattern as is; **adapt** = take a smaller version; **skip** = not for us.

### 1.1 Unreal Engine 5 / Lyra

| Pattern | Source | What it solves | Wildshard equivalent | Verdict |
|---|---|---|---|---|
| **Experience** (a data asset: game features to enable, default pawn data, action sets, actions) | [Lyra](https://dev.epicgames.com/documentation/en-us/unreal-engine/lyra-sample-game-in-unreal-engine), [x157](https://x157.github.io/UE5/LyraStarterGame/Experience/) | One map or mode = one declarative list of what it switches on; no mode `if`s in the game mode | The **shard manifest**: `uses` (kit features), `player` (loadout, hands, fov, base input), `content` (rows), `load` (lazy code). Grows today's `ChunkDef` | **adopt** |
| **Experience lifecycle** (Loading → LoadingGameFeatures → ExecutingActions → Loaded → Deactivating; `CallOrRegister_OnExperienceLoaded` in high / normal / low priority) | [unrealist ch. 3](https://unrealist.org/lyra-part-3/) | Async boot with a known order; late subscribers still get the "loaded" call | The boot plan's steps as named states; `onShardReady(fn, 'early' / 'normal' / 'late')` (HUD, then player, then creatures); SHARD-CACHE eviction is Deactivating | **adopt** |
| **Game Feature Plugins** (core unaware; features load, activate, deactivate) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/game-features-and-modular-gameplay-in-unreal-engine), [Epic blog](https://www.unrealengine.com/en-US/blog/modular-game-features-in-ue5-plug-n-play-the-unreal-way) | Content added and removed without touching the core; "avoid accidental interactions or dependencies" | Shards and kit features: the engine never imports them, lint-enforced ([engine-fit §5](engine-fit.md)) | **adopt the rule**, skip runtime install / uninstall |
| **Action Sets** (a bundle of feature actions reused by many experiences) | [Lyra experiences](https://x157.github.io/UE5/LyraStarterGame/Experience/) | Experiences stay in sync without copy-paste | **Kit feature sets**: `swim`, `ride`, `weather`, `day-clock`, `bow-family`, `toon-look`; a shard lists them in `uses` | **adopt** |
| **Game Feature Actions** (AddComponents, AddAbilities, AddInputMapping, AddWidgets, AddDataRegistrySource) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/game-features-and-modular-gameplay-in-unreal-engine) | A feature extends the game only through a fixed list of verbs | The `ShardContext` verbs: `systems.add`, `events.on`, `content.register`, `input.push`, `ui.slot`, `registry.add`, all auto-scoped | **adopt** |
| **GameFrameworkComponentManager** (actors `AddReceiver`, features inject components) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/game-features-and-modular-gameplay-in-unreal-engine) | Add behaviour to actors a feature doesn't own | Explicit extension points on the few actor kinds (`player.extend`, species traits); no reflection | **adapt** |
| **Subsystems** (auto-instanced services with managed lifetimes: engine, game instance, world, local player) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/programming-subsystems-in-unreal-engine) | Services without bloating core classes; init / deinit handled | Engine services with two lifetimes, **app** (audio, saves, settings) and **shard** (vitals, spawns, weather), reached through a typed context | **adopt** |
| **Gameplay Ability System: abilities** (activation policy, cost, cooldown, activation / blocked / cancel tags) | [Epic GAS](https://dev.epicgames.com/documentation/en-us/unreal-engine/gameplay-ability-system-for-unreal-engine), [Abilities in Lyra](https://dev.epicgames.com/documentation/en-us/unreal-engine/abilities-in-lyra-in-unreal-engine) | Every verb (swing, shoot, dodge, grapple) under one set of rules: can I, what does it block, what cancels it | Weapon moves and verbs as `MoveDef` rows with `blockedBy` / `grants` / `cancels` tags and a small code hook. Lyra's activation groups (independent / exclusive) = which verbs may overlap (aim while riding, not swing while grappling) | **adapt (lite)** |
| **GAS: attributes + effects** (instant / duration / infinite; add / multiply modifiers; stacking) | [tranek GASDocumentation](https://github.com/tranek/GASDocumentation) | Buffs, debuffs, damage over time, status, all through one pipeline | `Vitals` attributes (health, stamina, breath, warmth) and `EffectDef` rows: poison, cold, a stealth damage bonus, an elite aura, a Driftwood hit cap | **adapt (lite)** |
| **Gameplay Cues** (cosmetic effects addressed by tag, decoupled from logic) | [tranek §4.8](https://github.com/tranek/GASDocumentation) | Logic never spawns FX or sound directly | `cue.hit.flesh`, `cue.parry`, `cue.windup` emitted by the engine and resolved by the shard's look and sound kit. **This is how one combat core serves toon, painterly and PBR shards without a style `if`** | **adopt** |
| **Gameplay Tags** (hierarchical `A.B.C`, parent matching, containers) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/using-gameplay-tags-in-unreal-engine) | One vocabulary for traits, states and events across systems | A TypeScript string-literal union (`'creature.boss'`, `'dmg.pierce'`, `'status.stunned'`) with `hasTag(set, 'status')` parent matching | **adopt** |
| **Gameplay Message Router** (broadcast on a tag channel; listeners never know the sender) | [unrealcode](https://www.unrealcode.net/HUD/), [community wiki](https://unrealcommunity.wiki/tutorial:-using-the-gameplaymessagesystem-74b91d) | Decouples the HUD, quests and audio from the combat code | The typed event bus: channel names are tags, payloads are typed, listeners are shard-scoped | **adopt** |
| **Inventory items built from fragments; equipment grants ability sets** | [Lyra inventory](https://dev.epicgames.com/documentation/en-us/unreal-engine/lyra-inventory-and-equipment-in-unreal-engine) | New item kinds without subclassing: "affects gameplay and presentation through its array of Inventory Fragments" | `ItemDef { id, fragments: { icon, equippable, stats, reticle, viewmodel, ammo } }`; equipping a weapon grants its moves | **adopt** |
| **Enhanced Input** (actions; mapping contexts added and removed at runtime by priority) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/enhanced-input-in-unreal-engine) | "vehicle-related Input Actions … added … when entering a vehicle"; no mode `if`s in input handlers | Actions + a context stack: `onFoot`, `swim`, `ride`, `board`, `grapple`, `menu`, `explore`. Keys and touch discs both emit actions (42 files listen to `keydown` today) | **adopt** (ENGINE-FIT E4); skip the trigger / modifier zoo |
| **CommonUI** (activatable widget stacks per layer: Game, GameMenu, Menu, Modal; input goes to the top) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/common-ui-plugin-for-advanced-user-interfaces-in-unreal-engine), [Lyra UI policy](https://x157.github.io/UE5/LyraStarterGame/CommonUI/DefaultUIPolicy.html) | Menus over menus, back handling and input routing, all without ad-hoc z-index and flags | Four layers (`hud`, `gameMenu`: bag, map, journal; `menu`: pause, settings; `modal`) with a push / pop stack; the E154 `hudSlots` are the extension points shards fill | **adopt**; skip gamepad focus navigation |
| **Primary Data Assets + Asset Manager** (typed ids `Type:Name`, asset bundles, async load by bundle) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/asset-management-in-unreal-engine) | Content found by id; heavy assets loaded by declared bundle, not by guessing | Ids like `weapon:longbow`, `species:boar`; each row lists its heavy assets as lazy loaders per tier; the boot manifest is derived from them (closes audit §5 bug 2) | **adapt** |
| **StateTree / behaviour trees** (hierarchical state machine with selectors; visual editor) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/state-tree-in-unreal-engine) | Designer-authored AI at scale | HFSM in code (today's `AnimalState`) + weighted choice; no editor | **skip the tool**, keep the idea |
| **World Partition** (grid streaming, one file per actor, level instances) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition-in-unreal-engine) | Streaming a huge world; "you do not need to check out the Level file" to edit an actor | No streaming (a 500 m shard per page). Take **one file per actor**: one file per content row and per structure, so ~10 agents don't collide on one list | **adapt** OFPA; skip streaming |
| **SaveGame** (slots, async save) | [Epic docs](https://dev.epicgames.com/documentation/en-us/unreal-engine/saving-and-loading-your-game-in-unreal-engine) | Persistence | Epic's page says nothing on migrating old saves; take that part from Factorio and Minecraft (§1.3) | **adapt** |

### 1.2 Unity, Godot, Bevy

| Pattern | Source | What it solves | Wildshard equivalent | Verdict |
|---|---|---|---|---|
| **Assembly definitions** (explicit references between code units, no cycles) | [Unity docs](https://docs.unity3d.com/Manual/assembly-definition-files.html) | Boundaries a compiler enforces; "think clearly about the architecture of your code" | The `wildshard/layer` lint rule + ratchet ([engine-fit §5](engine-fit.md)) | **adopt** |
| **ScriptableObjects as data + event channels** | [Unity guide (Ryan Hipple)](https://unity.com/how-to/architect-game-code-scriptable-objects) | Designers tune data, not code; "the Player script does not need to know what systems care about it" | Node-safe TS modules exporting `as const satisfies WeaponRow`; tsc checks them, agents grep them. Don't mutate a data row at runtime (the SO pitfall) | **adopt** |
| **Addressables** (load by address or label, dependency load, ref-counted release) | [Unity docs](https://docs.unity3d.com/Packages/com.unity.addressables@2.3/manual/index.html) | Per-level content on demand, freed after | Lazy shard chunk + per-row asset loaders + dispose on eviction; the PWA and service worker are our content delivery | **adapt**; skip remote catalogs |
| **DOTS / ECS** | Unity; [Overwatch GDC 2017](https://www.gdcvault.com/play/1024001/-Overwatch-Gameplay-Architecture-and) | Throughput; an architecture that pushes toward decoupled code | SoA pools only for projectiles, particles, far crowds ([engine-fit §2](engine-fit.md)) | **skip** the rewrite |
| **Custom Resources** ("defined properties, so users know 100% that their data will exist") | [Godot docs](https://docs.godotengine.org/en/stable/tutorials/scripting/resources.html) | Typed, shared, editable data | Same as the ScriptableObject row: typed TS data | **adopt** |
| **Autoloads** (global nodes that persist across scenes) | [Godot docs](https://docs.godotengine.org/en/stable/tutorials/scripting/singletons_autoload.html) | Cross-scene state | A warning: globals are what we have too many of (`hudSlots` singleton, 28 files hand-reading `localStorage`). Services through the context; `window.__world` stays a debug view | **adapt** (fewer globals) |
| **Plugin trait + PluginGroups** (`build(app)`; "All Bevy engine features are implemented as plugins") | [Bevy](https://bevy.org/learn/quick-start/getting-started/plugins/) | Opt in and out of features; one registration shape for engine and game | `defineShard({ manifest, install(app) })`; kit features are plugins; the engine's defaults are a group a shard can trim | **adopt** |
| **States** (OnEnter / OnExit, `DespawnOnExit`, sub-states, computed states) | [Bevy docs](https://docs.rs/bevy/latest/bevy/state/index.html) | Mode changes that clean up after themselves | `boot → title → loading → playing ⇄ paused / explore / dead`; `ride` and `swim` are sub-states of `playing`; state-scoped entities = `shardScope` extended | **adopt** |
| **Schedules, system sets, run conditions** | [Bevy docs](https://docs.rs/bevy/latest/bevy/ecs/schedule/index.html) | Order by declared constraint, not by registration order | `Game.ts` phases + `{ id, set, after?, before?, when? }` (replaces the 32 hand-ordered calls) | **adopt** |
| **Messages vs observers** (0.17: buffered messages read at fixed points; immediate observer events) | [Bevy 0.17](https://bevy.org/news/bevy-0-17/) | Predictable fan-out vs synchronous veto | Two flavours on one bus: `emit` (queued, drained at phase ends: kill → loot, compendium, quests, audio) and `ask` (synchronous, first claimer or modifier wins: parry, block, damage scaling) | **adopt** |

### 1.3 Shipped action-adventure and open-world games

| Pattern | Source | What it solves | Wildshard equivalent | Verdict |
|---|---|---|---|---|
| **Chemistry engine** (elements change materials, elements change each other, materials never change each other) | BotW GDC 2017 ([Thumbsticks](https://www.thumbsticks.com/gdc-17-breath-of-the-wild-science-lies/), [Engadget](https://www.engadget.com/2017-03-12-breath-of-the-wild-gdc-talk.html)) | "Multiplicative gameplay" from a small rule table | An engine rule table (fire, water, cold, wind, electric) × registry materials (`surface` already exists). Weather, fire arrows and water all through it. A new mechanic, so it needs Jake's yes | **adapt later** |
| **Actor = a bundle of parameter files** (ActorLink names its AIProgram, GParamList, physics) | [ZeldaMods: bxml](https://zeldamods.org/wiki/Bxml), [bgparamlist](https://zeldamods.org/wiki/Bgparamlist) | Thousands of actors from a few programs + params | A species or NPC row names its brain, its attack rows, its loot table and its model | **adopt** |
| **One rule for everything** (TotK removed every non-physics object: "making everything physics-driven would lead us to the solution") | TotK GDC 2024 ([Triforce Times](https://www.triforcetimes.com/2024/03/21/tears-of-the-kingdom-developers-reveal-physics-and-audio-design-at-gdc-2024/)) | Special cases breed bugs; a universal system gives emergence | One damage pipeline for every hit (the Spear that hits through walls, audit §5.1, is the bug class), one day clock, one weather, one collision (already the rule) | **adopt** |
| **Param tables** (EquipParamWeapon, AtkParam, SpEffectParam, NpcParam: rows by id, fields by column) | [Souls Modding: Elden Ring](https://soulsmodding.com/doku.php?id=er-refmat%3Amain) | Hundreds of weapons and enemies tuned without code | `WeaponRow`, `AttackRow`, `EffectDef`, `SpeciesRow` by id; damage = weapon base × move's motion value | **adopt** |
| **Animation events drive the mechanics** (TAE: hit windows, effects and projectiles at times in the animation, pointing at param rows) | [Souls Modding: TAE](https://www.soulsmodding.com/doku.php?id=format%3Atae) | Timing lives with the motion, not in code | A `MoveDef` timeline (`windup`, `active: [t0, t1]`, `recovery`, `cancelFrom`, `spawn` at t) pointing at an `AttackRow`. `SwordMoveSet` already half is this | **adopt** |
| **Low-tech boss AI** (a stack of goals in script; weighted random attack picks by distance and HP threshold; cooldowns; interrupts) | [nega.tv: Low-tech AI of Elden Ring](https://nega.tv/posts/low-tech-ai-of-elden-ring.html) | Legible, designer-tuned bosses without planners | `Boss` brain: phase rows (HP below → move weights, adds, arena rule) + a goal stack for one-off scripts; interrupts on `combat.hit` / `player.heal` | **adopt** |
| **Aggression tokens** (at most 2 attackers, more on hard; off-screen attack indicators; attack zones) | God of War GDC 2019 ([Vault](https://www.gdcvault.com/play/1026423/Evolving-Combat-in-God-of), [slides](https://www.gdcvault.com/play/mediaProxy.php?sid=1026423)) | Readable fights with a close camera | Already built for Driftwood (E297 `fightRules.ts`: `AttackTokens`, `WindupWarn`); make it the engine's **aggression director** for every shard, with per-shard numbers | **adopt** |
| **Individual + group agents, utility attack choice** (HTN plans; herd blackboards; roles; "the Collective" spawns) | Horizon ([Guerrilla](https://www.guerrilla-games.com/read/the-ai-of-horizon-zero-dawn), [Game Developer](https://www.gamedeveloper.com/design/behind-the-ai-of-horizon-zero-dawn-part-1-)) | 25+ machine types from shared behaviours; groups that coordinate | `Herd` / `Pack` as group brains with a blackboard; species pick attacks by a utility score; a spawn director. Skip HTN | **adapt** |
| **Data-driven HFSM behaviours, reused and substituted per character** | Destroy All Humans 2 ([Game Developer](https://www.gamedeveloper.com/programming/creating-all-humans-a-data-driven-ai-framework-for-open-game-worlds)) | Many NPC types from shared parts | Species brains composed from shared behaviours (graze, flee, stalk, charge, perch) | **adopt** |
| **"Fighting with data"**: treat data "with the same mindset as maintaining a code base" | AC Valhalla GDC 2021 ([Vault](https://www.gdcvault.com/play/1026999/Fighting-with-Data-Learnings-from)) | Data rot as enemies and abilities grow | Contract tests over every row (§2.9); review data like code | **adopt** |
| **GOAP postmortem**: plan pacing and variety from day one; debug tools early; don't force convergence (naval AI) | AC Odyssey ([Game Developer](https://www.gamedeveloper.com/programming/postmortem-ai-action-planning-on-assassins-creed-odyssey-and-immortals-fenyx-rising-)) | Optimal AI is not fun AI; forced unification hurts | Skip planners; a debug overlay per brain; let one-offs (Nine Dragon's traversal, the horse) stay shard verbs until a second shard wants them | **adopt the lessons** |
| **Generic engine components configured by a content directory of scripts and data** | Hades ([GamesRadar](https://www.gamesradar.com/games/hades/hades-2-developers-left-all-of-the-roguelikes-code-exposed-says-iconic-indie-dev-making-it-the-easiest-to-mod-game-ever/)) | A small team ships a lot of content on its own engine | A shard folder is a content directory: manifest + rows + a small plugin | **adopt** |
| **Treasure classes** (nested weighted pick lists, a NoDrop weight, one table per source) | Diablo II ([Phrozen Keep](https://d2mods.info/forum/kb/viewarticle?a=368)) | Loot and spawns tuned as tables | One `PickTable` format for loot, spawns and ambient life | **adopt** |
| **ECS deferment** (side effects collected and applied at one point in the frame) | [Overwatch GDC 2017](https://www.gdcvault.com/play/1024001/-Overwatch-Gameplay-Architecture-and) | Order bugs from side effects buried in helpers | Queued events drained at phase ends; spawns and deaths applied in `fixed.post` | **adapt** |
| **Combat takes longest** (Ghost of Tsushima's combat: "six years … multiple versions") | [PSLS on GDC 2021](https://www.playstationlifestyle.net/2021/03/16/ghost-of-tsushima-combat-gdc/) | Feel is iterated more than anything else | Feel numbers as rows, variants as Debug rows (E162); the engine owns the mechanism, never the numbers | **adopt** |

Genshin Impact, Diablo Immortal and Insomniac's public talks are about rendering, streaming and tools
([Spider-Man postmortem](https://www.gdcvault.com/play/1026496/-Marvel-s-Spider-Man)); none had a primary source on
gameplay layering worth a row. Assassin's Creed's Anvil talks were used through Valhalla and Odyssey above.

### 1.4 General references

| Pattern | Source | Wildshard use | Verdict |
|---|---|---|---|
| **Type Object** ("a single class, each instance of which represents a different type"; a breed with a `parent`) | [Game Programming Patterns](https://gameprogrammingpatterns.com/type-object.html) | Species, weapons, NPCs, elites as rows with `parent`: the Longbow = Bow + 239 lines of real difference (audit: ~450 deletable) | **adopt** |
| **Event Queue cautions** ("a central event queue is a global variable", "the state of the world can change under you", feedback loops) | [Game Programming Patterns](https://gameprogrammingpatterns.com/event-queue.html) | Payloads carry ids and snapshots, not live objects; a per-frame emit cap in dev builds catches loops | **adopt** |
| **Choose the simplest behaviour-selection algorithm** (FSM → HFSM → BT / utility → planners) | [Game AI Pro ch. 4](https://www.gameaipro.com/GameAIPro/GameAIPro_Chapter04_Behavior_Selection_Algorithms.pdf) | HFSM + utility covers animals, elites and bosses | **adopt** |
| **Save migrations run once, in order, recorded in the save** | [Factorio](https://lua-api.factorio.com/latest/auxiliary/migrations.html), [Mojang DataFixerUpper](https://github.com/Mojang/DataFixerUpper) | Every store versioned; old saves upgraded, never wiped | **adopt** |

## 2. Recommended architecture

### 2.1 Layers and the one dependency rule

```
src/engine/   mechanisms: loop + phases, states, events, tags, input, UI layers, saves, physics, render pipeline,
              combat core (vitals, effects, moves, damage pipeline, projectiles, aggression director), AI runtime
              (HFSM, utility pick, goal stack, group brain), spawn director, encounter / boss / elite runtime,
              quest runtime, loot runtime, weather + day-clock mechanisms, registry, audio engine
src/kit/      content 2+ shards share: weapon rows + viewmodels (bow family, rifle family, sword), species rows +
              rigs, look kits (toon, painterly, pbr), weather profiles, ambience beds, NPC rigs, FX, feature plugins
src/shards/<slug>/  manifest.ts (node-safe) · plugin.ts (lazy) · content/ (one file per row) · world/ · look/ · audio/
```

`engine ← kit ← shard`, never backwards and never shard → shard ([engine-fit §5](engine-fit.md) has the lint rule and
ratchet). **Rule of two** (decision 3): content moves to `kit/` when a second shard uses it. A mechanism is engine
from the first use if it is a genre staple (decision 5: melee, ranged, bosses, elites).

### 2.2 The shard contract: declare data, implement little

```ts
// src/engine/shard.ts (sketch; names open)
export interface ShardManifest {                 // node-safe: the deck, bakers and contract tests import it
  id: `shard:${string}`; slug: string; meta: ShardMeta;           // card, flags, thumbnails (today's ChunkDef head)
  world: WorldSpec;                              // terrain, forest, sky, atmosphere, grade, water: today's data
  uses: readonly FeatureId[];                    // Lyra GameFeaturesToEnable + ActionSets: 'swim', 'ride', 'weather' …
  player: PlayerData;                            // Lyra PawnData: loadout ids, hands, fov, base input contexts
  content: ShardContent;                         // row ids: species, spawns, encounters, loot, items, quests
  rules: ShardRules;                             // numbers: maxHitDamage, aggression tokens, coins, body shadow
  load: {                                        // lazy code in the shard's chunk
    render?: () => Promise<ShardRender>;         // exists today
    world?: () => Promise<WorldBuilder>;         // structures, field models (today's `structures`, `fieldModels`)
    plugin?: () => Promise<ShardPlugin>;         // one-off verbs, scripts, HUD widgets
  };
}
export interface ShardPlugin { install(app: ShardApp): void | Promise<void> }   // everything it adds is shard-scoped
export interface ShardApp {                      // Lyra's Game Feature Actions, as verbs
  get<T>(service: ServiceKey<T>): T;             // vitals, combat, spawns, weather, clock, audio, hud, saves …
  systems: { add(s: { id: string; phase: Phase; after?: string[]; before?: string[]; when?: () => boolean; run(dt: number): void }): void };
  events: EventBus<GameEvents>;                  // on / emit / ask
  content: ContentRegistry;                      // one-off rows: a unique boss, a shard-only species
  input: InputContexts; ui: UiLayers; registry: WorldRegistry;
  onReady(fn: () => void, priority?: 'early' | 'normal' | 'late'): void;
}
```

A shard **declares**: its manifest and its content rows. It **implements** only: its world builders, its render
strategy (`ShardRender`), and in `plugin.install` its one-off verbs (Nine Dragon's traversal, Nalati's kokpar), its
scripted beats, its HUD widgets in named slots. Zero shard branches in the engine. The **finish line** (decision 7) is
a template shard that boots in the GPU boot test with no engine edit.

### 2.3 Lifecycle, states, schedule

- **States**: `boot → title → loading → playing ⇄ paused | explore | dead`; `ride`, `swim`, `board` are sub-states of
  `playing`. Each has `onEnter` / `onExit`; systems take `when: inState('playing')` instead of gating themselves.
- **Shard load** (Lyra's order): manifest (static) → `uses` features + shard chunk in parallel → world build → features
  and plugin `install` → `onReady` early (HUD) / normal (player) / late (creatures, ambience) → `playing`.
- **Teardown**: everything registered through `ShardApp` (systems, listeners, bodies, widgets, contexts, timers) is
  owned by the shard scope; `core/shardScope.ts` already does this for DOM listeners, timers and `<body>` children.

### 2.4 Events and tags

- One typed bus: `interface GameEvents { 'combat.hit': Hit; 'combat.kill': Kill; 'ai.windup': Windup; 'quest.step': … }`.
  Channel names are tags. Payloads carry ids and numbers, never live three.js objects.
- `emit` is queued and drained at the end of its phase (Bevy messages, Overwatch deferment): kill → loot, compendium,
  quests, achievements, audio. `ask` is synchronous and returns a verdict (Bevy observers): parry, block, stealth
  bonus, hit cap. This replaces the 48 hand-merged hook assignments.
- Tags: `interface TagRegistry` in `engine/tags.ts` and `type Tag = keyof TagRegistry`; kit and shards add their tags
  by declaration merging (so does `GameEvents`). Parent matching only; no tag query language.

### 2.5 Data assets

- **Rows are TS modules**, node-safe (no three.js, no DOM), `as const satisfies XRow`, one file per row under
  `content/`, collected by a generated index (like `src/boot/*.generated.ts`), so adding a row never edits a shared list.
- **Ids** are `kind:name` template-literal types (`weapon:longbow`), resolved through registries. **Type objects with
  `parent`**: a row states only its differences (Longbow, LeverRifle, the thrall boar, the elite variants).
- **Fragments** for items (Lyra): `icon`, `equippable`, `stats`, `ammo`, `reticle`, `viewmodel`.
- **Heavy assets** as lazy loaders on the row, per tier; the precache and boot lists are computed from the rows a
  shard uses.
- **Tables**: `PickTable` (Diablo treasure class: weighted entries, nested tables, a none weight, conditions on time,
  weather, zone tag, progress flag) for loot, spawns and ambient life.

### 2.6 Combat: GAS-lite in the engine

- **Vitals**: attributes (health, stamina, breath, warmth, poise) with base + modifiers (add, then multiply).
- **Effects**: `EffectDef { duration: 'instant' | seconds | 'infinite', mods, stack: 'refresh' | 'add' | 'none', grants?: Tag[], cue? }`.
- **Moves**: `MoveDef { windup, active: [t0, t1], recovery, cancelFrom, attack: AttackId, cost?, cooldown?, blockedBy?, grants?, spawn? }`
  (FromSoft TAE). **Attacks**: `AttackRow { damage, type: Tag, poise, knockback, hitStop, effects?, cue }` (AtkParam).
  **Weapons**: `WeaponRow { parent?, family: 'melee' | 'bow' | 'crossbow' | 'firearm', moves, projectile?, ads?, viewmodel }`.
  One viewmodel shell (D1), one projectile pool (D2), one ADS solver (D4) serve every row.
- **One damage pipeline**: `combat.hit(source, target, attack)` → occlusion check → `ask('combat.prehit')` (block,
  parry, stealth, hit cap) → effects → `emit('combat.hit' | 'combat.kill')` → cues. Player melee, projectiles, creature
  attacks, falls and drowning all go through it.
- **Cues**: the engine names a cue; the shard's look and sound kits map it to FX and SFX (toon puffs vs painterly
  strokes vs PBR blood). **Aggression director**: E297's tokens, windup warning and ring, with per-shard numbers.

### 2.7 AI, bosses, encounters, spawns

- **Species row** (BotW actor bundle): stats, senses, gaits, `brain`, attack rows, loot table, tags, model, rig.
- **Brain** = HFSM from shared behaviours (today's `AnimalState`) + weighted / utility attack pick (range, HP, cooldown,
  recent use) + interrupts. **Group brain** for herds and packs with a blackboard (Horizon). No planners.
- **Boss / elite** = a species row + `phases: [{ hpBelow, moveWeights, adds?, arena?, music? }]` + an optional goal-stack
  script for one-off beats (FromSoft). The three near-identical boss binds (D7) become three rows.
- **Encounter** = trigger (zone, time, quest step) + arena bounds + boss or wave table + reward + save key + music cue.
- **Spawn director** reads `PickTable`s and the per-tier caps; it owns night thralls, rolled elites and herds alike.
- **Debug**: every brain prints its state and last pick in a Developer-tools overlay (the Odyssey lesson).

### 2.8 Input and UI

- **Actions**: `move look jump sprint crouch attack aim interact lock swap bag map pause` + context actions. Keyboard,
  mouse and touch discs all emit actions; systems read actions, never keys.
- **Contexts**: a priority stack (`onFoot`, `swim`, `ride`, `board`, `grapple`, `menu`, `explore`). A shard verb
  pushes its context with its own label and icon; this replaces `touchHint` re-dressing the LOCK and JUMP discs by hand.
- **UI layers**: `hud` · `gameMenu` · `menu` · `modal`, each a push / pop stack; only the top of the top active layer
  gets input; back pops. HUD widgets go into the E154 slots, never straight into `<body>` (the baseline-HUD rule).

### 2.9 Saves and enforcement

- **Saves**: `saves.define({ key, scope: 'global' | 'shard', version, defaults, migrations })`. Migrations run once, in
  order, and the save records which ran (Factorio). Existing `ws.*.v1` keys keep their names and shapes; migration 0
  reads the legacy key. A save that won't parse is backed up and defaulted, never a boot crash. Vitest fixtures hold
  every past shape.
- **Contract tests** (node, in `pnpm test`): every manifest's ids resolve (species, weapons, moves, attacks, effects,
  pick tables, encounters, items, cues), every `uses` feature exists, every save key is versioned, every cue a shard
  can emit has a mapping in its look and sound kits.
- **Lint**: `wildshard/layer` + the slug-branch counter with a ratchet ([engine-fit §5](engine-fit.md)).

## 3. What not to copy (overkill for a web game built by one developer and agents)

- **Full GAS**: prediction keys, replication, attribute capture and snapshot, four magnitude kinds, AbilityTask class
  hierarchies. Keep add / multiply modifiers, three durations, tags and cues.
- **Runtime plugin install / uninstall states** of Game Features: one static registry plus lazy imports.
- **Reflection-based component injection** (GameFrameworkComponentManager): a few explicit extension points.
- **ECS / DOTS rewrite**: SoA pools only where counts are high.
- **Planners** (HTN, GOAP): Odyssey's own postmortem says fun needs pacing and variety that planners don't give.
- **Visual editors** (StateTree, Blueprints, data-table editors): agents edit TS; Jake picks through Debug rows and boards.
- **JSON / SJSON data files parsed at runtime**: typed TS modules give tsc checks, go-to-definition and tree-shaking.
- **World Partition streaming, HLOD pipelines, remote Addressables catalogs**: one 500 m shard per page, a service worker.
- **Enhanced Input's trigger and modifier zoo, CommonUI's gamepad focus navigation**: touch and keyboard only.
- **A tag query language**: `hasTag` with parent matching is enough.

## 4. Suggested order (for the plan to take or leave)

1. Layer lint + branch ratchet (stops regrowth; cheap). 2. Event bus + system ordering (unblocks every other row).
3. Services context + shard scope for all registrations. 4. Row registries + type objects (weapons first: kills the
Longbow and LeverRifle forks). 5. Damage pipeline + cues + aggression director. 6. Input contexts + UI layers.
7. Save service + migrations. 8. Manifest `uses` / `player` / `content` + the template shard. Each ships on the
permanent parity gate (decision 7), in Jake's shard order (decision 8).
