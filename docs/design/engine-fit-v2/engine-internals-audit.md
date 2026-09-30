# Engine internals audit: today's loop, input, UI, services, tools and tiers against the plugin shape (E357, 2026-09-30)

Read-only audit for [E357](../../tasks/asks/E357.md), tree at `3580db5c`. The target is the shape in
[aaa-architecture.md](aaa-architecture.md) §2 and [engine-fit.md](engine-fit.md) §2 / §5: a Bevy-like `App` with
plugins, ordered phases, states, typed events with `ask` hooks, input actions on a context stack, CommonUI-like UI layers,
a versioned SaveStore, a node-safe shard manifest plus lazy plugin verbs, and one scope that tears a shard down.
Counts are `grep` over `src/` without `src/dev/`. They add to the [audit](../../audits/game-normalization-2026-09-30.md),
they don't repeat it. Ideas only: Jake has approved none of it.

## Top findings

1. **The loop is half an App already.** `Game.ts` (748 lines) has the phases and fault isolation. It has no ordering,
   no run conditions, no way to remove a system, and 8 shard branches of its own. It also imports Nalati's look (2
   modules) and the Nine Dragon boot traces (2 modules).
2. **The in-page shard switch was built (E155) and then turned off (E216).** `SHARD_CAP = 1` (`main.ts:176`) and
   `requestShard` navigates with `location.replace` (`shard/switch.ts:33-48`). So the resident host still runs on every
   boot but never switches: ShardHost 325 lines, shardState 140 lines plus 76 slot registrations in 55 files,
   disposeListeners 79 lines (a patch on `EventDispatcher.prototype`), and shardScope 248 lines (a patch on
   `addEventListener` plus a `<body>` MutationObserver). **Teardown today = reloading the page.**
3. **Boot has a plan but no plugin stages.** The loader's 16 step keys are fixed and shaped for a forest shard (`cabins`,
   `grass`, `props`, `animals`; `boot/steps.ts:11-31`). Shards can only relabel them, and only Pine Hollow and Nalati do
   (`steps.ts:63,86`). Four boot modules still branch on the shard or import from shard folders: manifest, extras,
   shardPrefetch and audioFiles.
4. **Input has no actions.** 179 raw input listeners in 47 files: 38 key, 111 pointer, 15 mouse, 8 contextmenu, 6 wheel
   and 1 touch, plus 101 `click` in UI code. 29 files read keys, and no gamepad is read. Each mode (walk, ride, swim,
   board, grapple, menu, explore) is a scatter of booleans. The touch USE disc fakes a `KeyE` keydown
   (`TouchControls.ts:398`).
5. **The UI has slots but no layers.** `hudSlots` (E154) is the right extension point, but only 7 files use it. 42 files
   append straight to `#hud` or `<body>`. About 10 overlays each keep their own `isOpen` and their own Escape handler
   (16 Escape sites). z-index takes 24 distinct values, up to 2147483000.
6. **Globals.** 52 `window.__*` names, about 26 of them named after a shard. `__world` is a ~50-field bag that 115 script
   files read. Beyond that: 6 `active*()` singletons, `getActiveChunk()` (136 calls in 42 files), 158 module-level `let`
   in 88 files, and 36 `ws.*` localStorage keys handled by hand in 28 files.
7. **The tools are nearly engine-ready.** Explore, the Model Explorer, the practice arena and the models contract
   (`defineModel`, a lazy roster per shard) need small moves only. The playgrounds are the exception: they import Nine
   Dragon's grapple course and type their host with Nalati's `Ride`.
8. **Tiers are code, not data.** One `TIER_TABLE` with about 59 knobs per tier, 7 of them Driftwood's. Pine Hollow gets
   a named override object and two helpers named for shards. `Game.ts:290` decides Nine Dragon's AO. The perf budget is
   one global (`Perf.ts:36`), and two shards have their own budget scripts.

## 1. Loop, systems, lifecycle

**Today.**
- `Game.ts:411-417`: `onInput / onFixed(pre|step|post) / onUpdate / onLate`. Each takes `(fn, label?, core?)`, runs in
  registration order, returns `void` and can't be unregistered. `faults.ts` (121 lines) isolates each system, turns off
  one that keeps throwing, and stops the loop when a core system dies. Keep all of that. `fixedStep.ts` is a single
  constant.
- 117 registrations in 89 files. `bootstrap.ts:137-145` registers the 5 core ones. `main.ts` registers 11; one
  of them is the `'main'` updater (`main.ts:1114-1216`, about 100 lines, 32 hand-ordered calls, cut up by `mark()`
  buckets for the frame-cost panel).
- `bootstrap()` (149 lines) builds renderer → sky → terrain → cards → forest → physics → player; `buildShard`
  (`main.ts:210-1334`, ~1,125 lines, ~160 closure locals) does the rest inline (edge … audio) and returns
  `{ park, activate, dispose }` for ShardHost.
- Shard entry: `chunks/registry.ts:16-19` statically imports all four ChunkDefs; `TITLE_CARDS` (`ui/titleDeck.ts:18-51`)
  is a second hand list. The lazy ChunkDef hooks (`render`, `structures`, `sword`, `roster`, `fieldModels`,
  `traversal`) are the only plugin verbs, and mostly only Nine Dragon uses them.

**Coupling.**
- `Game.ts` imports Nalati's look (`:17-18`) and branches on `painterly` (`:207-208`, `:274`), on phone + Nine Dragon
  (`:210`, `:290`, `:469`, `:500`) and on phone + Driftwood (`:348`).
- `main.ts` holds the audit's ~140 gated lines. `boot/manifest.ts:38,79,85-86,101` branch on `painterly`, the Pine
  slug, `structures` and `ocean`; `boot/extras.ts:57,118,149` preload Explore only when `def.ocean` (audit bug 2) and
  `:166-167,223-233` pick audio by shard; `boot/audioFiles.ts:50-59` hard-codes `PINE`; `boot/shardPrefetch.ts:45-49`
  imports shard modules (Pine's knife, birds, NPCs, journal skin; Nalati's people) and `:82-90` branch on shard.
- The Nine Dragon boot trace (`nineBootTrace.ts` 282 + `nineGpuTrace.ts` 42 lines) is called from 13 files.

**Target.**
- `engine/app` owns systems as `{ id, phase, after?, before?, when? }` (sorted once at `start()`, each returning a
  disposer); app states `boot → title → loading → playing ⇄ paused | explore | practice | dead` with enter / exit;
  and staged loading in Lyra's order: engine core → world builders → kit features → `plugin.install` → `onReady`
  early / normal / late → shaders → first frame → audio. Step keys come from the stages; the manifest brings labels,
  weights and files.
- **A shard switch stays a page navigation** (E216: iOS has to free the old heap). Teardown still matters for
  sub-states (Explore, the arena, the playgrounds) and for a node contract test (install → dispose → zero listeners,
  timers, systems, bodies). One `Scope` (`AbortSignal` + disposers) owned by the `ShardApp` verbs replaces the patches.

| Row | What | Size |
|---|---|---|
| EI1 | `engine/app` systems: `{id, phase, after, before, when}` plus a topological sort, disposers, and `frameCost` by id. Split the `'main'` updater into ~12 labelled systems (world, player, animals, weapons, audio, interact, vitals, hud) | M |
| EI2 | `AppState` with `onEnter` / `onExit` and `when: inState(…)`. It replaces `hud.entered`, `world.freeCamera`, `practiceRoom.open` (an event mirrored into a flag, `core/practiceRoom.ts`) and the `frameGate` composition (`main.ts:1067`) | S |
| EI3 | Staged load: steps come from the stages, and `manifest.boot.steps` gives labels and weights. `SHARD_STEPS` goes away. The world steps (`edge … weapon`) become the shard's declared sub-steps | M |
| EI4 | Boot files from the manifest: `files`, `audio`, `explore` and `precache` rows. It removes the shard branches and shard imports in manifest, extras, shardPrefetch and audioFiles (and fixes audit bug 2) | M |
| EI5 | De-shard `Game.ts`: Nalati's fog and composer go into its `ShardRender`; the Nine Dragon AO and phone cuts and Driftwood's phone chain go into the manifest's tier data; the Nine boot trace becomes a generic `bootTrace` that a manifest flag turns on | S |
| EI6 | Retire the resident host: ShardHost's park, activate and evict, the 76 `shardSlot`s, the `disposeListeners` prototype patch, the global-capture code and the global `addEventListener` patch. Keep one `Scope` behind the `ShardApp` verbs. **Needs Jake's yes** (E155 asked for resident shards; E216 overrode it) | M |
| EI7 | `buildShard` becomes `engine/boot.ts` (≤ 150 lines) plus each shard's `plugin.install(app)` and kit features. Done when `main.ts` has 0 shard branches (28 `isOcean`, 19 `slug ===`, 18 `nalatiNow()`, 12 `isPine`, 10 `painterly` today) | L |
| EI8 | A generated `shards.generated.ts`: node-safe manifests plus a lazy `load`. It is the only engine → shard edge and replaces the static imports in `chunks/registry.ts` and `TITLE_CARDS` | S |

## 2. Input

**Today.**
- Keyboard: 38 listeners in 29 files. Every weapon class listens for its own `F` / `R` (`Rifle.ts:302-303`,
  `Sword.ts:551`, `Spear.ts:304`, `Longbow.ts:582`, LeverRifle, Crossbow); `Weapons.ts:179-187` Q and 1–9;
  `Player.ts:224-236` WASD, Shift, Space, C, H, Alt, pointer lock; `Mount.ts:210` X; `Taming.ts:88-89` G;
  `stealth.ts:137-182` C and Ctrl, and it **rewrites `player.keys`** to own the crouch; Pine's `loadout.ts:158` B; E
  for interact in `main.ts`, `QuestUI.ts` and Pine's `quest/ui.ts`; Explore / FreeCam WASDQE, 1–3, M, F8.
- Touch: `TouchControls.ts` (482 lines) builds every disc and picks their meaning from weapon-id sets: `MELEE` and
  `SPEAR` (`:99-101`), `LOCK_WEAPONS` (`LockOnTarget.ts:57`), `id === 'bow'` (class toggles at `:198-215`).
  A shard verb re-dresses LOCK and JUMP through `touchHint` (`ChunkDef.ts:80`, `main.ts:564`). Nine Dragon's traversal
  wraps `lock.onTryToggle` and `player.onJumpRequest` by hand (`Traversal.ts:364-386`); that is the "ask" hook, written
  by hand. There are 29 such `const prior = x.onY` wrappers in the tree.
- Contexts are booleans read ad hoc: `player.locked`, `weapons.enabled` (20 enable / disable / pointer-lock sites in
  `main.ts`), each weapon's `inputAllowed()` (7 copies, e.g. `Bow.ts:708`), `player.ride / swimming / hover`,
  `world.freeCamera`, `hud.entered`, `menu.isOpen`, `practiceRoom.open`, `Menu.keyGate`; 8 `ws:*` DOM events carry state.

**Target.** `engine/input` is actions plus bindings plus a context stack. Keys, mouse and the touch discs all emit
actions; systems read `input.pressed / held / axis`. A context declares its actions, their bindings and their touch discs
(`label`, `icon`, `spot`). The top context wins; lower contexts pass through what the top doesn't bind. A weapon's
archetype (decision 10) brings its own action table.

| Context (pushed by) | Actions it adds or relabels | Shards today |
|---|---|---|
| `onFoot` (base) | move · look · jump · sprint · crouch · dodge · interact · swap · lock · pause · bag · map · journal · note · hover | all |
| `weapon.melee` (archetype) | attack (tap) · heavy (hold) · lock | Driftwood sword ×2, Nine jian, Nalati sabre |
| `weapon.ranged` | fire · aim (hold or latch) · reload | Pine crossbow, lever rifle; Nalati AR loan |
| `weapon.bow` | draw (hold) · loose (release) · aim | Nalati bow, Pine Longbow |
| `weapon.spear` | thrust · throw (hold, over AIM) · brace (hold, over JUMP) | Nalati |
| `crossbow.bolts` (Pine plugin) | cycle bolt (B) | Pine |
| `swim` | dive (over jump) · surface (over dodge) · weapons holstered | Driftwood, any shard with water |
| `board` | hover off · jump; dash and crouch off | all (H) |
| `ride` (kit `ride`) | steer · gallop · lean L/R · whistle (X) · dismount · offer (taming, G) | Nalati, horse playground |
| `stealth` (Nalati plugin) | crouch toggle; the grass row | Nalati |
| `grapple` (Nine plugin) | lock → GRAPPLE / LOCKED, jump → ZIP | Nine Dragon, grapple playground |
| `menu` (UI layer) | nav ← → · tab · confirm · back | all overlays |
| `explore` (state) | fly WASDQE · up/down · boost · pane 1–3 · map · back | all shards with Explore |

| Row | What | Size |
|---|---|---|
| EI9 | `engine/input`: the action map, bindings (keys, mouse, touch), the context stack, one listener set per device, and a dev overlay that shows the stack | M |
| EI10 | Move Player, Weapons, the 7 weapon classes, Mount, LockOn, Taming, stealth, the quest UIs and FreeCam onto actions. It deletes 29 key-listening sites, the 7 `inputAllowed()` copies and the fake `KeyE` | M |
| EI11 | `TouchControls` draws the top context's discs from its table. The weapon-id sets become the archetype's `touch` fragment. `touchHint` and the hand-chained hooks become a pushed `grapple` context. HUD files: announce over herdr (E332) | M |
| EI12 | Engine-owned crouch: stealth reads the action instead of rewriting `player.keys` | S |

## 3. UI

**Today.**
- Generic already: `HUD.ts` (569 lines; its only slug tests are "is this card the active shard"), `hudSlots` (103),
  `ToastStack`, `FirstHints` (a shard feeds it triggers: the right shape), `DeathFade`, `SpeedLines`, `LockOn`,
  `WeaponStrip`, `DebugMenu` (renders `DEBUG_ROWS`), `bag.ts` (draws only the parts a shard has).
- Shard branches in UI: `titleDeck.ts` (4 hard-coded cards, 12 art imports); `Minimap.ts:104,335,515-517` (painterly
  and ocean palettes); `HurtArc.ts:89-90` (respawn text); `debugOptions.ts:68-69` (9 of 15 rows gated by shard);
  `Loading.ts:45` (Nine boot); `hudSlots.ts` `ROW = { steed, stealth, grass }` (Nalati's rows in the base); `RideHUD.ts`
  (232 lines, Nalati's horse); `compendium/shards/pine-hollow.ts`; `Explore.ts:66-75`, `Compare.ts:18-33`.
- **How a shard adds UI today.** A HUD widget: `hudSlots.disc / statusRow` (RideHUD and stealth do), more often a
  direct append (42 files append to `#hud` or `<body>`; `BossBar`, `EliteBar`, `CoinChip`, `ShopPanel` are built in shard
  code). A Bag tab: it can't. `MenuTab` is a fixed union (`map gear finds inventory achievements`) switched on by
  `bagTabs(has)`; shards feed data through `menu.setFinds` (4 callers, last wins), `setLoot`, and `GameMenu`'s `kit`,
  `skins`, `tools`, `pack` options.
- Overlays keep their own state: Menu, Map, Journal, ShopPanel, QuestUI, Feedback, ShardComplete, HorseNamePrompt,
  DebugMenu and BootSettings each have an `isOpen` and an Escape handler. `Menu.keyGate` and `HUD` guard against
  double-Escape by hand (E130, E32).

**Target.**
- Four layers (`hud`, `gameMenu`, `menu`, `modal`), each a push / pop stack; only the top entry gets input (it pushes
  the `menu` input context); back pops. `game.frameGate` and `weapons.setEnabled` follow the stack (replaces the 20
  enable / disable sites and the `frameGate` composition).
- Shards add UI only through scoped `app.ui` verbs: `ui.slot(…)`, `ui.push(layer, panel)`,
  `ui.bagTab({ id, label, icon, render })`, `ui.debugRows(rows)`. The engine UI names no shard.

| Row | What | Size |
|---|---|---|
| EI13 | `engine/ui/layers`: move the ~10 overlays onto it. Their Escape, `isOpen`, pointer-lock and weapon gating come from the stack | M |
| EI14 | `app.ui.slot`: rename `ROW`'s shard bands to numbered bands that the manifest orders; `ui.mount(layer, el)` replaces the direct `#hud` appends; a lint rule stops new ones | S |
| EI15 | Registered Bag tabs and item fragments (Lyra): `setFinds`, `setLoot`, `tools` and `skins` become tabs or fragments a shard or kit registers | S |
| EI16 | Move shard data out of `src/ui` and Explore: title cards and art go to the manifest's `meta`; the minimap palette to `map`; the respawn label to `rules`; the debug rows to plugins; RideHUD to kit `ride`; the Pine compendium skin to its shard | S |

## 4. Services and globals

**Today.**
- **`window.__*`: 52 names**, ~26 named after a shard (`__antlerKing`, `__pineQuest`, `__pineLife`, `__titan`,
  `__boss`, `__balbals`, `__weather`, `__nalatiQuest`, `__stealth`, `__skyV2`, `__ndRender`, `__longbow` …).
- Script readers: `__world` 115 files (hot fields `player` 133, `game` 125, `animals` 34, `hud` 31, `weapons` 28,
  `ride` 27 reads); `__hf` 16; `__pineQuest` 9; `__weather` 7; `__antlerKing` 6; `__adventure`, `__ws_prefetch` 5.
- **Singletons:** `getActiveChunk()` (136 calls, 42 files), `activePhysics()` (28), `activeRegistry()` (20),
  `activeBodies`, `activeNavmesh`, `activeClock`, the `hudSlots` object, `config.ts:16-19` `export let` SEED /
  CHUNK_ID / TREE_COUNT, and `TIER` / `TIER_CONFIG` frozen at module load.
- **Module state:** 158 module-level `let` in 88 files. 76 of those variables were given `shardSlot` registrations for
  the resident host, which no longer switches.
- **Persistence:** 36 `ws.*` keys in 28 files, each read by hand. `Settings.ts` (253 lines, `setting()` and
  `onSettingChange`) is already a good service.

**Coupling.** One shard per page (E216) makes the singletons *correct*: in practice the app's lifetime is the shard's.
The costs are elsewhere: tests can't build a world without the globals, a shard reaches services through imports
rather than a context it was handed, and ~26 debug names leak shard names into the global scope.

**Target.**
- Typed `ServiceKey<T>` tokens (`app.get(Physics)`, `app.get(Saves)` …) with two lifetimes: **app** (audio, settings,
  saves, telemetry) and **shard** (physics, registry, bodies, navmesh, clock, vitals). The `active*()` functions stay as
  thin wrappers during the move; `app.shard.manifest` replaces `getActiveChunk()`; one debug facade.

| Row | What | Size |
|---|---|---|
| EI17 | The service registry on the app; migrate the 6 `active*()` singletons, and after them `getActiveChunk()`, file by file (ratchet the count) | M |
| EI18 | `window.__ws = { app, world, shard }`, built from the services plus each plugin's `debug` export. Keep `__world` as an alias with its hot fields. A codemod moves the ~26 shard globals to `__ws.shard.*` in the scripts | S |
| EI19 | `SaveStore` (decision 13): 36 keys become `saves.define({ key, scope, version, migrations })`; migration 0 reads the legacy key | M |
| EI20 | The typed event bus (`emit` / `ask`): the 8 `ws:*` DOM events, the 29 hand-chained `prior` hooks and the audit's 48 hand-merged hook assignments move onto it | M |

## 5. Explore, practice rooms, playgrounds, models

| Area | Size | Engine-ready? | Coupling |
|---|---|---|---|
| `src/explore` | 16 files, 4,240 lines | **Yes, mostly.** `ExploreHost` takes a `World` plus callbacks, and models come from the one registry | 23 shard-shaped lines: `Explore.ts:66-75` (4 art maps × 4 slugs), `Compare.ts:18-33` (mockups per shard), 6 `chunk.ocean?.level` reads (use `terrain.waterLevel()`) |
| `src/practice` | 7 files, 1,203 lines | **Yes.** It uses the engine's Weapons, Player, Physics and registry | `BOSS_NAMES` is a side-effect map in `ui/Combat.ts:40`; make it a content registry. `TargetHit` is typed from `Crossbow.ts` |
| `src/playgrounds` | 9 files, 1,083 lines | **No.** Both rooms are shard content in an engine folder | `catalog.ts:29-30` names shards; `load.ts` switches on the id; `GrapplePlayground.ts:17` imports Nine Dragon's course; `PlaygroundHost.ride` is typed with Nalati's `Ride` (`Playground.ts:21,37`) |
| `src/models` | 18 files, 3,211 lines | **Yes.** `defineModel`, `placeSet`, a lazy `roster` per shard (`ChunkDef.roster`), the registry catalog | Creature styles (`lowpoly`, `painterly`, `pbr`) are the kit's; `swimHands` and `hoverboard` are engine gear |

| Row | What | Size |
|---|---|---|
| EI21 | Explore → `engine/explore`: the art comes from the manifest's `meta.art`, the compare pairs from `manifest.dev.compare`, and water from `terrain` | S |
| EI22 | Playgrounds become verbs a shard or kit registers: `app.practice.playground({ id, title, icon, load })`. The grapple room moves to Nine Dragon, the horse room to kit `ride`, and `PlaygroundHost.ride` becomes a kit interface | S |
| EI23 | The practice arena and models move to `engine/`. `BOSS_NAMES` becomes a content registry, and `TargetHit` moves to engine combat types | S |

## 6. Tier and performance policy

**Today.**
- `core/tier.ts` (190 lines) sets `TIER` once at module load. `TIER_TABLE` (`:21-90`) holds ~59 knobs per tier: engine
  (dpr, shadows, post, SMAA, bloom), kit (trees, grass, undergrowth, animal LOD, cabins, pickups) and 7 of Driftwood's
  own (`oceanCell`, `palmCount`, `palmFrondSegs`, `bushCount`, `bushDetail`, `bushShadows`, `boulderShadows`).
- Shard overrides in the engine: `PINE_HOLLOW_PHONE` (`:101`) applied by `applyShardTier` (`:111-115`);
  `pinePhoneCuts()` (`:123`) and `phonePictureCuts()` (`:132-133`) name shards; `Game.ts:290` turns Nine Dragon's AO
  off on the phone over its own `ShardRender.ao`; 5 more `TIER && shard` lines (`main.ts`, `Loading.ts`, `gpuFiles.ts`,
  `extras.ts`).
- Inside the shard folders, 77 `TIER` reads in 29 files (for example `nine-dragon-stack/look/glyphs.ts:87-90`). They
  belong there, but each is a literal `TIER === 'phone' ? a : b`.
- Budgets: `Perf.ts:36` has one phone budget (110 calls, 1.6 M triangles) for every shard; `physics/bodies.ts` has the
  body caps; the memory targets (1.8 / 1.0 GB) exist only in AGENTS prose; two shards have their own budget scripts
  (`nine-dragon-budget.mjs`, `pine-hollow-perf*.mjs`).

**Target.**
- The engine keeps device detection and the engine knobs; each kit feature declares its knobs with defaults per tier
  (forest, grass, ocean, fauna LOD); the manifest adds `tiers: { phone?: Partial<Knobs>; desktop?: … }` and
  `budgets: { phone: { calls, tris, loadMB, playMB, fps } }`.
- Shards read `app.tier.knob('x')` instead of branching on `TIER`; `ShardRender.ao` / `slices` come from the tier block
  and the engine never overrides them; `Perf.ts` and one `perf-budget.mjs --shard <slug>` read the manifest's budgets.

| Row | What | Size |
|---|---|---|
| EI24 | Tier as data: engine knobs, kit knob schemas and manifest overrides. Delete `PINE_HOLLOW_PHONE`, both `*Cuts()` helpers and `Game.ts:290`; move the 7 Driftwood knobs to its kit or shard | M |
| EI25 | Budgets in the manifest, read by the in-game budget check and by one budget script. They become part of the parity gate (decision 7), and the physical-iPhone evidence rule (E271) still applies | S |

## 7. Suggested order

25 rows: 1 L, 12 M, 12 S (M and L need a parity-gate run before and after). This fits aaa-architecture §4 and
Jake's shard order (decision 8).
1. **EI8** (registry), **EI1** / **EI2** (systems, states): everything else registers through them.
2. **EI17**, **EI20** (services, events), then **EI6** (retire the resident host, if Jake says yes).
3. **EI3**, **EI4**, **EI5**, **EI24** (staged boot and tiers from the manifest), shard by shard, Nine Dragon first.
4. **EI9** – **EI12** (input) and **EI13** – **EI16** (UI). They touch the shared HUD: board plus herdr notice (E332).
5. **EI7** (the `buildShard` split). It runs through the four shard waves; its done-line is the template shard booting
   with no engine edit.
6. **EI18**, **EI19**, **EI21** – **EI23**, **EI25**: small moves that can land anywhere after step 2.
