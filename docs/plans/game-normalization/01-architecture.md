# GAME-NORMALIZATION v2 · 01 — Architecture and interfaces

This is the contract every other spec in this folder builds on. Each part has three things: the interface as
TypeScript (names are final unless the council changes them), the rules, and what it replaces today, with the source
row: a decision number in [E357](../../tasks/asks/E357.md), or a research row (EI / TP / MW) in
[docs/design/engine-fit-v2/](../../design/engine-fit-v2/).

## 0. Conventions

| Rule | Detail | Decision |
|---|---|---|
| **Layers** | `src/engine/` → `src/game/` → `src/kit/` → `src/shards/<slug>/`. Imports only point down the arrow; no shard imports another shard | 1, 5, 48, 62 |
| **Composition root** | Two files at `src/`'s root, outside the layer rules (the engine may not import `#game`, so the entry can't live in the engine):<br>• `src/entry.ts` (moved from `src/boot/entry.ts` at F6) is the page's module entry. `index.html` loads `/src/entry.ts`. It keeps today's retrying dynamic imports (E188) and the title-only fast path; its `nineBootTrace` import becomes the engine's generic boot trace, switched on by `manifest.boot.phone.trace`.<br>• `src/main.ts` imports `#engine`, `#game` and the generated shard registry and starts the app: ≤ 20 lines at S4.4, with the generic boot in `engine/boot.ts` (≤ 150) | 13 (04 #12, lead #6) |
| **Aliases** | Package.json subpath imports `#engine/*`, `#game/*`, `#kit/*`, `#shards/*`. Relative imports only inside one layer folder (a shard's own files use `./`) | engine-fit #9, TP1 |
| **Public API** | Each layer has one `index.ts` that is its public API. Kit and shards import `#engine` / `#game` / `#kit` **index only**; a deep path like `#engine/combat/pipeline` is a lint error. The engine's own internals may import each other freely | 26 |
| **Extractable engine** | `src/engine/**` contains no Wildshard word: no shard slug, no "shard", Bag, coin, loot, compendium, feat, doubloon, or shard / creature / weapon names. `wildshard/layer` checks this against a word list (§24) | 58 |
| **Behaviour vs tuning** | Behaviour is a class that extends an engine or kit base class (`class GoldenBow extends Bow`). Tuning is a typed data row (a profile, a species row, an effect row) with an optional `parent` row it overrides field by field | 17, 67 |
| **Names** | Events, tags, cues, actions and effect ids are dot-case string literals in typed unions (`'damage.dealt'`, `'creature.wolf'`, `'cue.hit.flesh'`). A layer above extends a union by **declaration merging** on the engine's registry interfaces (§3). Parent matching with `.*` | 70 |
| **Strictness** | The repo's rules stand: strict TS, zero-warning type-aware oxlint, no `any` / `!` / `as unknown as` / ts-ignore | AGENTS.md |
| **Simulation apart from visuals** | Gameplay state (attributes, effects, AI state, strike phases, quest steps, saves, inventory) lives in plain data that the fake `Game` (F5) drives with no renderer. The lint rule `wildshard/sim-no-render` stops `src/engine/{combat,ai,saves,quests,effects}/**` importing anything from three but its math types (`Vector3`, `Quaternion`, `Matrix4`, `Box3`, `Ray`) or any render / DOM module. The actor tests are the proof: they run with no WebGL. This is decision 56's door for later netcode | 56 |
| **Determinism** | Gameplay randomness only through `app.rng`; time only through `app.clock`. `Math.random` / `performance.now` outside `src/engine/core/{rng,clock}.ts` and the cosmetic allowlist are ratcheted to 0 | 56, 80 |
| **Strings** | Every player-facing string goes through a string table: `#engine/strings` for the engine's, `src/shards/<slug>/strings.ts` for a shard's. English only | 78 |

## 1. App, phases, systems, states

```ts
// #engine — src/engine/app/
export type Phase = 'input' | 'fixed.pre' | 'fixed.step' | 'fixed.post' | 'update' | 'late' | 'render';

export interface SystemSpec {
  id: string;                        // dot-case, unique per app: 'engine.player.motor', 'shard.pine.weather'
  phase: Phase;
  run: (dt: number, t: number) => void;
  before?: readonly string[];        // system ids (same phase) this must run before
  after?: readonly string[];
  when?: RunCondition;               // skipped (not called) while false
  tick?: TickRateId;                 // the scheduler's rate class (§12); omitted = every frame / every fixed step
  core?: boolean;                    // a core system's fault is fatal (today's faults.ts `core`)
}
export type RunCondition = (app: App) => boolean;
export const inState: (...s: AppState[]) => RunCondition;

export type AppState =
  | 'boot' | 'title' | 'loading' | 'play' | 'paused' | 'dead'
  | 'explore' | 'practice' | 'playground' | 'capture' | 'error';

export class App {
  readonly state: AppState;
  setState(next: AppState): void;                      // runs onExit(prev), then onEnter(next); emits 'app.state'
  onEnter(s: AppState, fn: () => void, scope: Scope): void;
  onExit(s: AppState, fn: () => void, scope: Scope): void;
  addSystem(spec: SystemSpec, scope: Scope): void;     // removed when the scope disposes
  // services (§5)
}
```

**Rules**
- Within a phase, systems are sorted topologically on `before` / `after`. **Ties keep registration order**, which
  keeps today's order: parity proves the phase lists are identical.
- A cycle is a boot error that names the ids in the cycle.
- The fixed step stays 60 Hz and is slowed by hit-stop, as today (`Game.onFixed`). `render` runs last: the
  `ShardRender.frame` hook, then the composer.
- Fault isolation is today's `faults.ts`, unchanged: a streak of 3 → retry, a burst of 5 in 10 s → off, `core` →
  fatal.
- Every system has an id, so the harness fingerprint lists `phase → [ids]`. Today's anonymous `update#12` labels go.

**Replaces:**
- `Game.onInput / onFixed / onUpdate / onLate` (kept as thin wrappers until S4.4, then deleted);
- the 32 hand-ordered calls in `main.ts`'s `'main'` updater;
- Nalati's private updater list;
- `hud.entered` / `window.__paused`-style mode flags.

Rows EI1, EI2.

## 2. Clock and RNG

```ts
// #engine — src/engine/core/clock.ts, rng.ts
export interface GameClock {
  readonly now: number;          // seconds of game time (paused time excluded, hit-stop slows it)
  readonly real: number;         // wall seconds (UI, fades)
  readonly frame: number;
  readonly mode: 'live' | 'capture';
  setCapture(fps: number | null): void;   // capture: every frame advances exactly 1/fps, whatever the render time takes
}
export interface Rng { next(): number; range(a: number, b: number): number; int(n: number): number; pick<T>(a: readonly T[]): T; fork(stream: string): Rng }
export interface RngService { stream(name: RngStream): Rng; seed(n: number): void }
export type RngStream = 'gameplay' | 'ai' | 'loot' | 'spawn' | 'cosmetic';   // extensible (§0 names)
```

**Rules**
- Gameplay randomness (damage rolls, AI picks, loot, spawns, the `Animal.ts:62` bolt model) uses its named stream.
  So a seeded run is repeatable, and a netcode layer could replay it later (decision 56).
- Cosmetic randomness (particle jitter, grass sway phase) uses `'cosmetic'`, which may stay unseeded in live play.
- The harness and capture mode seed every stream.
- Capture mode (decision 80) replaces the `performance.now` patch in `steam-trailer/capture.mjs`. Board clips and the
  harness's poses use it.
- `core/rng.ts`, Nine Dragon's `util.ts` `Rng` and `world/facade/rng.ts` become one (X5).

## 3. Events, asks, tags

```ts
// #engine — src/engine/events/
export interface EventMap {}           // extended by declaration merging, one entry per event:
// declare module '#engine' { interface EventMap { 'damage.dealt': DamageDealt } }
export interface AskMap {}             // the same, for asks: { 'damage.modify': [DamageRequest, DamageRequest] }

export interface Events {
  emit<K extends keyof EventMap>(name: K, payload: EventMap[K]): void;                 // queued
  on<K extends keyof EventMap>(name: K, fn: (p: EventMap[K]) => void, scope: Scope, opts?: { order?: number }): void;
  ask<K extends keyof AskMap>(name: K, value: AskMap[K][0]): AskMap[K][1];             // synchronous pipeline
  answer<K extends keyof AskMap>(name: K, fn: (v: AskMap[K][0]) => AskMap[K][1], scope: Scope, opts?: { order?: number }): void;
}
export type Tag = keyof TagMap & string;  export interface TagMap {}
export const hasTag: (tags: ReadonlySet<Tag>, pattern: Tag | `${string}.*`) => boolean;
```

**Rules**
- `emit` **queues**. The queue flushes at the end of the phase it was raised in, in emit order, and listeners run in
  `order` then registration order. An event raised while a flush runs goes into the same flush, bounded at 1,000 per
  frame; past that is a fault.
- `ask` runs its answerers **in order, synchronously**, each passing its result to the next: hit caps, the dodge
  guard, the stealth bonus, parry, vetoes.
- The first events and asks are listed in [09-combat-ai.md](09-combat-ai.md) (combat) and in each shard spec, which
  maps every one of today's hook fields to its event.

**Replaces** (EI20):
- 48 `x.onFoo =` assignments on 40 fields;
- 29 hand-chained hooks (`const prior = x.onY; x.onY = …`);
- 8 `ws:*` DOM events;
- the `onKill` self-chaining in loot, compendium and quests.

## 4. Scope and resource ownership

```ts
// #engine — src/engine/app/scope.ts
export class Scope {
  constructor(name: string, parent?: Scope);
  child(name: string): Scope;
  own<T extends Disposable3>(r: T): T;          // geometry, material, texture, render target, InstancedMesh …
  ownBody(b: PhysicsHandle): PhysicsHandle;     // Rapier bodies / colliders
  ownSound(s: SoundHandle): SoundHandle;
  listen<T extends EventTarget>(t: T, type: string, fn: EventListener, opts?: AddEventListenerOptions): void;
  timeout(ms: number, fn: () => void): void;  interval(ms: number, fn: () => void): void;
  raf(fn: FrameRequestCallback): void;
  onDispose(fn: () => void): void;
  dispose(): void;                              // reverse order; idempotent
  readonly census: ScopeCensus;                 // counts per kind, for the leak test
}
```

**Rules**
- Every plugin verb (§7) takes the shard's scope implicitly. Engine services take the scope of whatever owns them.
- Objects added to the scene under a shard's root group are freed by traversing that root:
  - geometries, materials and textures reachable from the root are disposed;
  - shared engine or kit assets are ref-counted by `#engine/assets` and never disposed by a shard.
- **The leak test** (the gate, [03-harness-gate.md](03-harness-gate.md)): boot → load a shard → unload (dispose its
  scope) → `renderer.info.memory` (geometries, textures), the physics body count, the listener count and the audio
  node count all return to the post-boot baseline.
- **Replaces** (decisions 21, 60; EI6):
  - `shardScope.ts`'s global `addEventListener` patch;
  - `disposeListeners.ts`'s `EventDispatcher` patch;
  - ShardHost's park / activate / evict;
  - the 76 `shardSlot` registrations.

## 5. Services

```ts
export interface App {                      // typed fields; no string-keyed service locator
  readonly clock: GameClock; readonly rng: RngService; readonly events: Events;
  readonly scene: SceneService; readonly render: RenderService; readonly physics: PhysicsService;
  readonly registry: WorldRegistry;         // today's src/world/registry.ts
  readonly player: PlayerService; readonly equipment: EquipmentService; readonly combat: CombatService;
  readonly effects: EffectService; readonly creatures: CreatureService; readonly encounters: EncounterService;
  readonly input: InputService; readonly ui: UiService; readonly audio: AudioService; readonly anim: AnimService;
  readonly world: WorldService;             // terrain, sky, day cycle, weather, water, fog
  readonly saves: SaveStore; readonly strings: Strings; readonly tiers: TierService; readonly budgets: BudgetService;
  readonly scheduler: Scheduler; readonly analytics: AnalyticsSink; readonly debug: DebugService;
  readonly explore: ExploreService; readonly practice: PracticeService;
  readonly params: HarnessParams;            // the only URL-param reader: the `harness` allowlist in lint/url-params.json (tier, touch, chunk, spawn, skipintro, mute …)
}
```

**Rules**
- There is one `App` per page. `window.__wildshard` (the typed probe, TP4 / EI18) is built from the services.
  `window.__world` survives as a deprecated alias with **the same key names** until the last live script is ported
  (F7).
- **`ws:ready`** stays: it is the native shell's contract (`src/native/boot.ts` waits for it). The engine dispatches it
  once on reaching `title`, and the probe also exposes `ready`.
- **Replaces:**
  - `buildShard`'s ~160 closure locals;
  - the 6 `active*()` singletons (`activeRegistry`, `activePhysics` …), which become `app.x`;
  - `getActiveChunk()` (136 calls in 42 files), which becomes `app.shard` in the game layer and moves out of the
    engine entirely (§20);
  - the 52 `window.__*` names, of which 26 are shard-named.

## 6. The shard manifest (the game layer's type; the engine never sees it)

```ts
// #game — src/game/shard/manifest.ts
export interface ShardManifest {
  api: 1;                                   // the plugin API version; the registry refuses a mismatch
  slug: ShardSlug; name: string; blurb: string; order: number;       // deck order (Driftwood first: PH-U19)
  status: 'live' | 'experimental' | 'earlyAccess' | 'hidden';        // 'hidden' = Debug-only (the template)
  card: { thumb: string; portrait: string; landscape: string };
  placement: { grid: [number, number]; size: [number, number, number] };   // own origin + place on the Wildshard map (61)
  label: string; seed: number; biome: string;   // today's ChunkDef.gridCoords (label), seed, biome
  minimap: ChunkMapDef;                     // today's ChunkDef.map (the minimap / full-map drawing data), renamed
  camera?: { portraitFov?: number };        // today's ChunkDef.fov
  wind?: WindSpec;                          // the WindField's per-shard data (§17): Nalati's steppe wind, today's world/wind.ts values
  bag: { tabs: readonly BagTabId[] };      // E314's per-shard tab picks (X2)
  hud?: ChunkHud;                           // today's ChunkDef.hud, as is (data the HUD reads)
  style: 'toon' | 'painterly' | 'pbr' | 'jiehua' | 'greybox';   // data only, never branched on; F6 maps today's 'lowpoly' → 'toon'
  uses: readonly Mechanism[];               // opt-in mechanisms (54): nothing below runs unless listed (the full list is under the Rules)
  ground: { terrain?: TerrainSpec; structures?: true };             // at least one; Nine Dragon has both today
  spawn: SpawnPose; bounds?: Bounds;
  sky: SkySpec; atmosphere: AtmosphereSpec; grade: GradeSpec;        // today's pure-data look fields, as is
  render?: () => Promise<ShardRender>;      // the look strategy (§13)
  tiers?: TierOverrides;                    // data, replaces PINE_HOLLOW_PHONE and Game.ts:290 (EI24)
  budgets: BudgetInputs;                    // per tier: fps + lane split; the numbers are derived (§13.4, decision 30)
  fight: { maxHitDamage?: number; capExempt?: readonly Tag[]; attackers?: number };   // 18, 20
  loadout: Loadout;                         // weapons / tools by id, start set, pickups (§18)
  species: readonly SpeciesRef[]; encounters?: readonly EncounterRef[];
  audio: { ambience: AmbienceRef; score: ScoreRef; cues: () => Promise<CueMap> };
  input?: readonly InputContextRef[];       // contexts it adds (§10)
  boot: BootSpec;                           // steps, asset lists per tier, precache, barrier / fragile / trace (§8)
  dayCycle?: DayCycleKeyframes; weather?: WeatherSpec;              // data for the opt-in mechanisms (§17)
  // carried over from ChunkDef as data, unchanged: trees, forest, assets, look, horizon, pondClip, pois, spawns (was
  // fauna: HerdPlan[]), faunaTuning, loot, bodyShadow, groundColor, surfaceAt; ocean becomes a WaterBody row (§17);
  // weapon becomes loadout (§18)
  roster?: () => Promise<readonly RosterEntry[]>;   // Explore's cards (today's hook, as is)
  explore?: ExploreSpec;
  load: () => Promise<{ default: new () => ShardPlugin }>;           // the lazy plugin chunk
}
export const defineShard: (m: ShardManifest) => ShardManifest;      // identity + dev checks (ids resolve)
```

**Rules**
- **Declared sub-fields** (from the shard specs; each is typed in `#game/shard/manifest.ts`):
  - `kitLook`: the look shared kit pieces render in (`'toon' | 'painterly' | 'pbr'`; default `style` when the kit supports it, else `'pbr'`);
  - `loadout.held`, `loadout.loans`, `loadout.grants[].replaces`, `loadout.viewmodel`;
  - `minimap.palette`, `minimap.markers`;
  - `audio.alertOnlyHostile`;
  - `ground.paths: 'plugin'`;
  - `bag.skinsTitle`, `bag.pack.slots`;
  - `water.sea` (the sea's `WaterBody` row);
  - `spawn.floor`, `respawn.spawnPlace`;
  - `horizon.kind`;
  - `world.blenderArea`, `world.blenderModels`;
  - `swimArms`;
  - `next` (the deck's next-shard hint);
  - `spawnTables`;
  - `fight.quietPromptInFight`, `fight.input = { bufferMs, coyoteMs }`;
  - `dev.poses` (the harness and mockup camera poses).
- **`Mechanism`** is the closed list of opt-in mechanisms the engine and game provide:
  - engine: `'weather' | 'dayCycle' | 'bosses' | 'elites' | 'spawns' | 'quests' | 'swim' | 'hover' | 'explore' | 'practice'`;
  - game: `'coins' | 'loot' | 'compendium' | 'feats' | 'bag.pack'`.
  A shard's own verbs (riding, stealth, the grapple) are not on it, because the shard's plugin installs them itself.
  A mechanism a manifest doesn't list isn't built at all, so there's no cost and no system. The template lists all 15.
- A manifest imports only node-safe modules: data, types and the lazy `load` / `render` / `cues` / `roster` thunks.
  A node test imports every manifest to prove it. The bakers (`bake-chunk`, `bake-sky`, `bake-packs`, `bake-navmesh`)
  read manifests through the generated registry (§7) and never through `readdirSync`.
- **Today's `ChunkDef` fields map one to one**, listed in [02-foundations.md](02-foundations.md) F6. The hook fields
  `sword`, `fieldModels`, `traversal`, `structures` (the builder) and `fov` move into the plugin.
- `ShardSlug` is a union generated from the folder names.
- **Where each ChunkDef field goes:** all 48 `ChunkDef` fields map one to one (the table is in 02-foundations F6).
  Three fields are renamed:
  - `ChunkDef.map` becomes `minimap` (the name `map` is gone, to avoid a clash with world placement);
  - `gridCoords` becomes `label`;
  - `fov` becomes `camera.portraitFov`.
  F6 leaves today's hook fields (`sword`, `fieldModels`, `traversal`, the `structures` builder, `render`) on the
  manifest. (`fov` is data, not a hook: it becomes `camera.portraitFov` at F6.) Each shard's phase moves them into its plugin (S1.1 / S2.1 / S3.1 / S4.1), and the type then drops them.

## 7. The shard plugin and the registry

```ts
// #game — src/game/shard/plugin.ts
export abstract class ShardPlugin {
  abstract install(ctx: ShardContext): Promise<void> | void;   // may await its own world build
}
export interface ShardContext {             // the plugin verbs: everything is owned by ctx.scope
  readonly app: App; readonly manifest: ShardManifest; readonly scope: Scope;
  readonly root: THREE.Group;               // the shard's scene root (disposed with the scope)
  progress: StepProgress;                   // the loading bar for the current boot step (§8)
  system(spec: SystemSpec): void;
  on: Events['on']; answer: Events['answer'];
  rows: ContentRows;                        // add weapon / tool / species / effect / encounter / loot / spawn rows
  inputContext(ctx: InputContextDef): void;
  hud: HudVerbs;                            // widgets into slot bands, disc relabels, reserved verb slots (§11)
  bag: BagVerbs;                            // tabs + item fragments (#game)
  piece(p: PieceSpec): void;                // world registry piece (colliders, floor, model card)
  debugRow(r: DebugRowSpec): void;          // pause ▸ Settings ▸ Debug, into an existing group
  playground(p: PlaygroundSpec): void;      // Explore's playground list (EI22)
  strings(t: StringTable): void;
  // rows.creatureLook(kitLook, factory): a shard or a kit look registers the creature material factory for its look
  tiers: { knobs(schema: TierKnobSchema): void };   // a shard may declare its own tier knobs (defaults per tier, overridable in its manifest)
  debug: { expose(name: string, value: unknown): void };   // → window.__wildshard.shard[name]; replaces __ndRender, the seven __pine*, __titan …
}
// src/game/shard/shards.generated.ts — written by scripts/gen-shards.mjs from src/shards/*/manifest.ts
export const SHARDS: readonly ShardManifest[];
```

**Rules**
- Shards are discovered by `scripts/gen-shards.mjs` (in `pnpm test`, `--check` in the gate), never by a hand-kept
  list. **Replaces** `chunks/registry.ts`'s static imports and `TITLE_CARDS` (EI8, TP8).
- **Load order**, for one shard per page:
  1. The engine boots (stage `engine`).
  2. `manifest.load()` downloads the plugin chunk, prefetched in parallel with the renderer and sky build.
  3. `new Plugin().install(ctx)` runs inside the boot stages (§8).
  4. `app.setState('play')`.
- **A load failure** is any throw or rejected promise in `load` / `install`. The engine disposes the shard's scope,
  reports to Sentry (shard, build, stage, stack) and shows the **full-screen error with the stack** and a Reload
  button (decision 69).
- **Unload** is `scope.dispose()`. Switching shards is still a page reload (21). The leak test (§4) exercises unload.
- **The `api` version.** It is bumped when a public-API change breaks a shard. The same commit updates every shard in
  the repo (decision 57: the API may change as long as every in-repo shard moves with it).

## 8. Boot (staged load)

| Stage | Engine does | The shard fills (manifest / plugin) |
|---|---|---|
| `engine` | renderer, physics world, sky rig, audio unlock, input, UI shell, saves | — |
| `shard.data` | reads the manifest, `tiers`, `budgets`, string tables | `boot.steps` labels and weights |
| `shard.world` | terrain (if `ground.terrain`), registry wiring | plugin world build (today's `edge` / `grass` / `cabins` / `props` / `structures` / `fieldModels`) |
| `shard.kit` | equipment service, loadout from rows | its weapon / tool / species / effect rows |
| `shard.play` | creatures, encounters, quests runtime, audio beds, HUD | its systems, events, contexts, widgets |
| `finish` | composer (`ShardRender`), shader precompile, first frame, `window.__wildshard` | — |

**Rules**
- The 16 fixed loading-screen keys (`STEP_INFO`) become the stages plus the manifest's `boot.steps`: labels and
  weights per stage (EI3).
- **Assets are declared by the shard** (EI4, TP9, MW13):
  - `boot.files(tier)` lists pack files;
  - also declared: `boot.audio`, `boot.explore` (Explore's art and code for **every** shard, which fixes bug §7.4)
    and `boot.precache`.
  - `boot/manifest.ts`, `extras.ts`, `shardPrefetch.ts` and `audioFiles.ts` lose every shard branch.
  - The service worker precaches every shard's code and packs at install, as today (decision 29).
- **Fragile-boot data** (Nine Dragon) moves from slug gates into the manifest, flag by flag:
  - `extrasBarrier` → `boot.barrier: true` (all tiers, since it applies on desktop too);
  - `deferExtras` → `boot.phone.deferExtras: true`;
  - `fragileBoot` → `boot.phone.fragile: true`;
  - `nineBootTrace` → `boot.phone.trace: true`;
  - its first-draw cull → `boot.cullBeforeFirstDraw: true`.
  Its knobs `warmTurns` and `textures` are ordinary tier knobs (§13.3).

## 9. Saves

```ts
// #engine — src/engine/saves/
export interface SaveKeyDef<T> {
  key: string;                   // dot-case: 'progress', 'compendium', 'owned', 'purse' …
  scope: 'global' | 'shard' | 'device' | 'session';
  // shard = namespaced by slug; device = machine-local bookkeeping (never exported, never reset);
  // session = sessionStorage (per tab)
  version: number;               // bump on any shape change
  schema: v.GenericSchema<T>;    // valibot: saves are outside data
  initial: () => T;
  migrate?: Record<number, (old: unknown) => unknown>;   // n → n+1, run in order, the chain recorded in the save
}
export interface SaveStore {
  define<T>(d: SaveKeyDef<T>): SaveSlot<T>;
  persist(): Promise<boolean>;             // navigator.storage.persist() on home-screen launch (MW15, decision 47)
  exportAll(): string; importAll(json: string): ImportReport;   // Settings ▸ Save: export / import
}
export interface SaveSlot<T> { read(shard?: string): T; write(v: T, shard?: string): void; reset(shard?: string): void }
```

**Rules**
- **The format.** One localStorage document per scope, `wildshard.save.v2.global` plus one per shard
  (`wildshard.save.v2.<slug>`), each `{ keys: { <key>: { v: <version>, data } } }`.
- **A reset now** (decision 13). On first boot of v2, every old **game-save** `ws.*` key is deleted once (the list is
  in F10), and the store starts empty. Never reset:
  - `device` and `session` keys;
  - the native OTA keys `ws.ota.*`;
  - the 3 keys `index.html` reads before the game code loads. `ws.dev` becomes a `device` key; `wsResumeShot` and
    `wsResumeBrand` stay `session` keys, per tab as today, so an old reload screenshot never shows on a later cold
    start. A tiny pre-boot reader in `index.html` reads them through the store's key format. From then on every shape change bumps `version` and adds a migration. A node test loads a
  fixture save of every past version.
- **A save that fails its schema** (hand-edited, corrupt, or from a bug): the store moves the raw value aside to
  `<key>.corrupt.<ISO time>` in the same scope, resets the key to `initial()`, reports to Sentry (key, version,
  the first validation error) and never throws. The game carries on, and the Settings save screen lists the aside
  copies with an export button.
- **A newer save, older build:** an old cached build reading a save whose version is newer than it knows keeps the
  save untouched and runs read-only for that key. It never downgrades a save.
- **Scopes:** coins, progress, compendium, owned gear, bounty, elites, horse names and inventory are `'shard'` (74–77);
  settings, controls and the Wildshard summary are `'global'`.
- **Replaces** 36 keys read by hand in 28 files, `game/loot/store.ts`'s `readShard` / `writeShard`, and
  `ws.elites.v1`'s global store (bug §7.6).

## 10. Input

```ts
// #engine — src/engine/input/
export interface ActionMap {}               // extended by merging: 'move' | 'look' | 'attack' | 'aim' | 'heavy' | 'dodge' |
                                            // 'jump' | 'use' | 'reload' | 'swap' | 'crouch' | 'sprint' | 'lock' | 'pause' | 'map' | 'bag' …
export type Action = keyof ActionMap & string;
export interface InputContextDef {
  id: string;                               // 'onFoot' | 'swim' | 'ride' | 'board' | 'grapple' | 'menu' | 'explore' | 'dialog' | shard ids
  actions: readonly Action[];               // live in this context
  blocks?: 'below' | readonly Action[];     // what it hides from contexts under it
  touch?: TouchLayout;                      // disc relabels + reserved verb slots (§11)
}
export interface InputService {
  push(ctx: string, scope: Scope): void; pop(ctx: string): void; readonly top: string;
  pressed(a: Action): boolean; held(a: Action): boolean; released(a: Action): boolean; axis2(a: Action): Vec2;
  consume(a: Action): boolean;               // take a buffered press (§ buffer)
  // ask('player.crouch', { want }) → { allowed, toggle }: the engine owns `crouch`; a shard (Nalati's stealth) answers
  bindings: Bindings;                        // keyboard + mouse + touch; rebinding persists in saves('controls', global)
  readonly buffer: { ms: number };           // 120 default (decision 40)
}
```

**Rules**
- **One listener set** on `window` / the canvas, owned by the engine, replaces 179 raw listeners in 47 files. A shard
  never adds a DOM input listener; the lint rule `wildshard/no-raw-input` enforces it.
- **The input buffer.** A press is kept `buffer.ms` (120) and fires on the first frame its owner allows it (`consume`).
  The Sword's combo queue becomes the generic buffer.
- **Coyote time** is a player-motor number (`coyoteMs`, 100): a jump is allowed for that long after leaving ground.
- Both buffer and coyote are **per-shard data** (`manifest.fight` / tier). They are on everywhere and shown on the
  input / HUD board (40).
- **Contexts.** The context stack replaces ~12 scattered mode flags. Nalati's stealth rewriting `player.keys` becomes
  the `crouch` action (EI12). The touch USE button stops faking an `E` keypress.
- **Key rebinding:** a Controls screen in Settings, stored in `saves('controls', global)`. No gamepad (38).

## 11. UI: layers, HUD slots, Bag tabs, error screen

```ts
// #engine — src/engine/ui/
export type UiLayer = 'hud' | 'gameMenu' | 'menu' | 'modal' | 'error';
export interface UiService {
  push(layer: UiLayer, view: UiView, scope: Scope): UiHandle;   // one Escape / back handler, one pointer-lock owner
  readonly top: UiLayer;
  hud: HudSlots;                            // today's hudSlots.ts, generalised
}
export interface HudSlots {
  widget(band: HudBand, el: HTMLElement, order: number, scope: Scope): void;  // numbered bands the manifest orders (EI14)
  disc(o: DiscOpts, scope: Scope): HTMLButtonElement;                          // today's DiscOpts / DiscSpot, kept
  relabel(spot: DiscSpot, label: string, icon: string, scope: Scope): void;   // context relabel (39)
  verb(slot: 'verb.1' | 'verb.2', o: VerbSlotOpts, scope: Scope): void;        // reserved verb slots (39)
  pin(at: THREE.Vector3 | (() => THREE.Vector3 | null), el: HTMLElement, scope: Scope): void;  // screen-projected world markers (Fei Zhua chip, ◇ marks, quest pins)
}
```

**Rules**
- The ~10 overlays (Menu, Bag, Map, Debug, compendium, title deck, prompts, feedback, dialogs, the error screen) move
  onto the layers. Each loses its own Escape handler and `isOpen` flag. z-index comes from the layer, not from 24
  literals.
- 42 files append to `#hud` / `<body>` directly today; they move to `widget(...)`.
- **The reserved verb slots and any HUD change are an E332 HUD change.** They go on the input / HUD board (X1), and
  the herdr notice is moot under the lock.
- The Bag (`#game`) registers tabs and item fragments (EI15). `setFinds`' last-caller-wins goes.

## 12. Scheduler (tick rates)

```ts
export type TickRateId = 'always' | 'ai' | 'npc' | 'fx' | 'weather' | string;
export interface TickBand { upTo: number; brainHz: number | 'paused'; body: 'frame' | 'half' | 'paused' }  // upTo metres
export interface TickRate { bands: readonly TickBand[] }
export interface Scheduler {
  rate(id: TickRateId, r: TickRate): void;
  brainDue(id: TickRateId, actor: Actor): boolean;   // the brain (decisions) this frame?
  bodyDue(id: TickRateId, actor: Actor): boolean;    // the body (movement, animation, strike phases, hit checks) this frame?
  interrupt(actor: Actor, why: InterruptReason): void;   // an immediate re-think this frame, whatever the band
  pin(actor: Actor, scope: Scope): void;             // never paused (an active boss / elite, a quest actor)
}
export type InterruptReason = 'hit' | 'target.attack' | 'target.dodge' | 'lost.sight' | 'ally.died' | string;
```

**Rules**
- **Defaults** (decision 85, a Genshin hybrid). The same bands apply to `ai` and `npc`:

  | Band | Distance | Brain | Body |
  |---|---|---|---|
  | near | 0–60 m | 20 Hz | every frame (30 Hz phone, 60 desktop) |
  | mid | 60–160 m | 10 Hz | every 2nd frame |
  | far | 160 m+ | paused | paused |

  - Every band gets **instant interrupts**: the brain re-thinks the frame it's hit, the frame its target starts a
    swing or dodge, and the frame it loses sight.
  - **Never paused:** an active boss or elite, and a quest actor (`scheduler.pin`).
  - **Strike phases** (wind-up → active → recover, 01 §19) run on the **body** clock, never on the brain tick. That
    fixes the up-to-100 ms telegraph / hit drift of today's self-thinking species.
  - `fx`: 30 Hz near, paused from 120 m;
  - `weather`: 10 Hz.
- A shard can override a rate in `manifest.tiers`.
- Every creature, NPC, elite, boss and FX system declares its `tick`. The creatures board shows the before / after.
- The first numbers are provisional and are checked against the budget calibration (S1.6).
- **Until S2.6 every brain keeps today's 10 Hz** (parity). S2.6 switches to the bands above and goes on the
  creatures board. It covers every shard's creatures, including Driftwood's far boars and bears.

## 13. Render, tiers, budgets

### 13.1 ShardRender (today's `ChunkDef.render`, extended)

```ts
export interface ShardRender {
  // today's slices / ao / aa fields MOVE to manifest.tiers: one source for tier knobs (§13.3)
  compose: (c: ShardComposeContext) => ShardComposition;    // 'extend': today's five pass slots; 'replace': { chain: Pass[] }, the whole chain in order
  mode?: 'extend' | 'replace';     // 'replace': the shard's compose builds the whole chain (Nalati's painterly composer); default 'extend'
  lighting?: LightingRig;          // the shard's light setup (Driftwood's toon lighting, Pine's PBR sun) applied to the SkyRig
  shadows?: ShadowRig;             // CSM / single-map settings as data
  fogControl?: { suspend(): void; resume(): void };  // fog off while a playground or practice room is up
  // `backdrop.apply(skyRig)` installs the backdrop. An 'extend' compose gets the engine chain from its context,
  // `c.engineChain('clean' | 'cinematic')` (today's Game.ts `chain(clean)`), and returns the five slots around it
  frame?: (dt: number, t: number) => void; dispose?: () => void;
  fog?: FogModel;                 // the shard's fog patch (replaces Game.ts:207-208 and Atmosphere's `painted`)
  backdrop?: SkyBackdrop;         // its sky backdrop / panorama (replaces Sky.ts's three setup paths' shard parts)
  terrainPainter?: TerrainPainter; grass?: GrassDriver; water?: WaterBodyFactory;
}
```

**Rules**
- Every shard has a `ShardRender` (S1–S4). The engine keeps the post blocks (bloom, god-rays, SMAA / FXAA, LUT, n8ao)
  and `chain(clean)`. Nalati's own composer (`Game.ts:274`) moves inside its `compose`.
- `Game.ts` loses all 8 shard branches (EI5), and `Game.ts:290`'s Nine Dragon AO decision becomes
  `tiers.phone.ao: false` in that manifest.

### 13.2 Shader-patch registry: WebGPU containment (decision 22)

```ts
export interface ShaderPatches { patch(mat: THREE.Material, id: string, order: number, fn: (s: ShaderSource) => void, scope: Scope): void }
```

**Rules**
- All 87 `onBeforeCompile` sites go through `patch`, with explicit `order`. The 4 `fog_fragment` writers get ordered
  slots: engine fog 100, stylize 200, a shard's fog 300.
- There is one `precompile()`. The renderer type is named only in `src/engine/render/**`; a lint rule counts the
  others, ratcheted to 0.
- No TSL, no WebGPURenderer (X6).

### 13.3 Tiers as data (EI24)

- `src/engine/render/tiers.ts` holds the engine's knobs (~52 of today's 59). The kit declares knob schemas for its
  families (grass density, …). A manifest's `tiers` overrides them per tier.
- **Precedence (one source):** engine default → kit schema default → `manifest.tiers[tier]`. The last one wins.
  `ShardRender` carries no tier knobs.
- `PINE_HOLLOW_PHONE` and the shard-named helpers are deleted.

### 13.4 Budgets (decisions 30, 35, 36, 37)

- `manifest.budgets` holds **inputs only**: target fps per tier (phone 30, desktop 60), the CPU / GPU lane split, and
  load-time limits.
- `src/engine/render/budgets.ts` derives the numbers from `docs/design/engine-fit-v2/budget-design.md`'s formula and
  the committed calibration file `budgets/calibration.json`:
  - draws, triangles, programs and GPU MB per pose;
  - ms per system;
  - download MB.
- The gate fails a shard over a derived number. Rollout: a shard already over it keeps its current worst as a
  ceiling in `lint/ratchet.json`, which may only go down.
- Memory limits: 1.8 GB loading and 1.0 GB in world are hard limits (37). The minimum desktop is RTX 3060 class
  (36); below it, the phone tier.

## 14. Physics

- Rapier **0.21** (F12). `src/engine/physics/` is still the only code that imports Rapier. The `query.ts` API
  (`castRay`, `castSegment`, `lineOfSight`, `sweepBall`, `floorBelow`) is kept.
- One collision path: registry pieces. `player.colliders` and `src/physics/bridge.ts` are retired (F11; PHYSICS-POLISH
  F3), and the doors, chests, levers and NPC boxes that use them become kinematic registry pieces.
- The step (0.35 m), climb (40°) and tier caps (phone: 40 awake bodies, 2 ragdolls) are unchanged. Bodies and
  colliders are owned by a scope (§4).

## 15. Audio

```ts
export interface AudioService {
  bus(id: 'music' | 'ambience' | 'sfx' | 'voice' | 'ui'): AudioBus;
  voice(): VoicePool;                       // the ONE positional voice engine (Voices.ts ≈ PineHollowSfx.ts merged)
  ambience: AmbienceZones;                  // Island / Steppe / Forest merged: zones + fade / hold / mix per profile
  music: MusicEngine;                       // score sources (Stems, SteppeScore, Pine scenes) behind one interface
  cue(id: CueId, at?: THREE.Vector3, opts?: CueOpts): void;   // plays whatever the shard's CueMap maps the cue to
}
```

**Rules**
- **Cues** are the combat and world contract (§18). The engine emits `cue.*`; each shard's `CueMap` maps a cue to
  sounds and visuals (toon puff / painterly splat / PBR blood).
- The three SFX routings (`main.ts:691-706` and `:850`, `nalati/sound.ts`, Pine's `loadout.ts` / `audioWiring.ts`)
  become one.
- `Audio.ts` (1,597 lines) splits into the engine mixer and the shards' voice tables.
- The helpers (pan-from-yaw ×8, loop-at-offset ×5, smoothstep ×15) become one module each.
- Nine Dragon gets its own ambience and score (S1.5), and its accidental forest / pine fallback goes.
- Credits: "Music: MiniMax-Music3" and "Powered by Stability AI" stay, as licence conditions.

## 16. Animation (the engine half of ANIMATION-REMASTER)

```ts
export interface RigContract { skeleton: string; clips: readonly ClipName[]; sockets: readonly SocketName[] }  // declared by a species / NPC / viewmodel row
export type ClipName = `${'idle' | 'walk' | 'run' | 'attack' | 'hit' | 'die' | 'turn' | 'swim' | 'fly'}${'' | `.${string}`}`;
export interface AnimService { load(rig: RigRef): Promise<RigInstance>; machine(def: AnimMachineDef, rig: RigInstance, scope: Scope): AnimMachine }
```

**Rules**
- There is one rig loader (GLB + the bake), a clip-name convention, and an animation state machine. The machine is
  driven by the creature HFSM (§19) and by the viewmodel blocks (§18).
- ANIMATION-REMASTER's art rows (A3–A7) build on this contract afterwards (decision 64). The details are in X4.

## 17. World mechanisms

| Mechanism | Engine | Shard / kit data | Replaces |
|---|---|---|---|
| Terrain | heightfield, grid sampling, `heightAt` / `normalAt` / `splatAt`, bake input | `ground.terrain` spec; `terrainPainter` in its ShardRender | `Terrain.ts`' 2 grid copies and its style branches |
| Sky | `SkyRig`: CSM shadows, hemi light, sun, planet | `sky` data + `backdrop` strategy | `Sky.ts`'s 3 setup paths; the painterly sky and cloud dome built then hidden on 2 shards are deleted |
| Day cycle | `DayCycle`: clock, keyframe interpolation, `sunAt` exact | keyframes as data (per shard; Nine Dragon has none) | `DayNight`, `DayClock`, `PineDayNight`, `WorldClock` and the misnamed `interface DayClock` |
| Weather | `Weather`: states, schedule, feeds fog / wind / audio / wetness, `ask('weather.damage')` | the rain curtain in the kit (Nalati + Pine share it); puddles stay per shard (two techniques); lightning is Nalati's | the two stacks (1,334 + 888 lines) |
| Water | `WaterBody` interface (level, surface height at x/z, `inside`, swim, reflect hook) — **built in S4.1** for the sea (≈15 engine lines read `chunk.ocean` today); X5 converts the other bodies | Ocean, pond, stream and beaver pool are shard or kit by the rule of two | 6 bodies, `main.ts:297`'s slug branch |
| Fog | the patch order (§13.2) and the density API | the shard's `FogModel` | 4 implicit writers |
| Placement | `models/place.ts` (kept), scatter primitives with the same random draw order | the scatter rules | `scatterIsland` ×3 etc. |
| Wind | `WindField` in `#engine/world/wind` (one field: direction, gusts, per-position sample) that grass, trees, bows' drift and cloth read | per-shard wind data (`manifest.wind`: Nalati's steppe wind parameters, Driftwood / Pine's today's `world/wind.ts` values) | `world/wind.ts` + Nalati's `steppeWind.ts` (the Bow family reads `app.world.wind`, no longer Nalati's file) |
| Culling | `models/cull.ts` (kept) + a culler interface | Nine Dragon's `InstanceCuller` plugs in; Nalati's `DressLayer` merges | 3 cullers |

## 18. Combat: Equipment, Weapon, Tool, GAS-lite (decisions 5, 10, 12′, 15, 20, 24–27, 55′)

```ts
// #engine — src/engine/combat/
export abstract class Equipment {           // the shared base (27)
  abstract readonly id: string; abstract readonly name: string;   // name via string table
  readonly bag: BagEntrySpec;               // #game renders it; the engine only carries it
  protected blocks: BlockSet;               // viewmodel, aim, input … (below)
  install(ctx: EquipContext): void;         // wires blocks, actions, cues, HUD
  abstract update(dt: number, t: number): void;
}
export abstract class Weapon extends Equipment { slot: 'main'; abstract tryFire(): void; reload?(): void; readonly state: WeaponState }
export abstract class Tool extends Equipment { slot: 'tool' | 'offhand'; readonly actions: readonly Action[] }  // runs alongside the weapon

// the blocks: public, the same for kit families and custom weapons (24, 25)
export const blocks: {
  viewmodel(rig: VmRig, feel: ViewmodelFeel): VmBlock;         // look-lag spring, sway, bob, holster, draw-on-top, fovForAspect
  aimRay(): AimBlock; ads(p: AdsProfile): AdsBlock;            // one solveAds, one FOV lerp
  melee(moves: MoveSet): MeleeBlock;                           // windup → active → recover, sweep | fan, bladeBlocked (occlusion)
  projectile(p: ProjectileProfile): ProjectileBlock;           // flight, drop arc, tracer, head offset, water, stagger
  hitStop(p: HitStopProfile): HitStopBlock; ammo(p: AmmoProfile): AmmoBlock; brass(p: BrassProfile): BrassBlock;
};
```

**The ladder** (decision 24):
- **Profile:** `new Bow(LONGBOW)`.
- **Extend:** `class GoldenBow extends Bow { override onRelease(...) }`.
- **Custom:** `class FeiZhua extends Tool` or `class Whip extends Weapon`, built from `blocks`.
- **Families live in `#kit/weapons/`**, built on the public blocks: `Melee` (Sword, Sabre, Spear, the jian), `Bow`,
  `Crossbow`, `Firearm`, `Thrown`.
- **Every weapon keeps its own behaviour** (12′). Every per-weapon number in today's code becomes a profile field;
  [09-combat-ai.md](09-combat-ai.md) lists them with today's values. A difference a family can't express is a bug in
  the family.

**GAS-lite**

```ts
export interface AttributeSet { health: Attr; maxHealth: Attr; [k: string]: Attr }     // extended by merging
export interface EffectDef {
  id: EffectId; tags: readonly Tag[];
  kind: 'instant' | 'timed' | 'permanent'; duration?: number; period?: number;         // period = ticks (poison)
  modifiers: readonly { attr: string; op: 'add' | 'mul' | 'override'; value: number }[];
  stacking: 'none' | 'refresh' | { max: number };
  cue?: CueId; icon?: string;               // HUD status icon (starter set)
  blockedBy?: readonly Tag[]; grants?: readonly Tag[];
}
export interface EffectService { apply(target: Actor | Equipment, id: EffectId, source?: Actor): void; remove(target: Actor | Equipment, id: EffectId): void; has(target: Actor | Equipment, tag: Tag): boolean }
// weapons carry their own AttributeSet (damage, reach, drawSpeed, magazine …): whetstones, the bear claw and the Golden Bow's draw modify the weapon
export interface DamageRuleDef {             // rules that depend on the hit itself: hit caps, the boar tusk, sneak shot, broadheads, balbal bonuses
  id: string; order: number;                 // answers ask('damage.modify') in `order`
  when: { sourceTags?: readonly Tag[]; targetTags?: readonly Tag[]; weaponTags?: readonly Tag[]; targetState?: readonly Tag[] };
  op: 'cap' | 'add' | 'mul' | 'negate' | 'override'; value: number;
}
export interface DamageRequest {             // the superset every path fills (09-combat-ai §3 lists each path's values)
  source: Actor | 'env'; sourceTags: readonly Tag[]; target: Actor; amount: number;
  point: THREE.Vector3; dir: THREE.Vector3; surface?: SurfaceId; weaponId?: string; moveId?: string;
  headshot?: boolean; stagger?: number; knockback?: number; throughWalls?: boolean;
  from?: THREE.Vector3; distance?: number; scale?: number;   // the attacker's position, the hit distance, a charge / draw scale
  cause?: string; toast?: string;   // the death card's cause line and the hit toast, as string-table keys
}
// A rule the DamageRuleDef data form can't express (09's R0b, R1, R3, R6, R7) registers as a plain answerer:
// events.answer('damage.modify', fn, scope, { order }). DamageRuleDef is the data form of the simple ones.
```

- **Effects on day one:**
  - every effect today's game has: the keepsake charms, the boar-tusk dodge guard, the stealth damage bonus, the hit
    caps, Pine's finishes, the bolt mods;
  - plus the kit's starter set (55′): `effect.poison`, `effect.burn`, `effect.bleed`, `effect.slow`, `effect.stun`,
    each with a cue and an icon, tuned on the creatures board.
- **The damage pipeline** (20). One `combat.hit(req)` for every source:
  1. Build a `DamageRequest` (the type below: `source`, `sourceTags`, `target`, `amount`, `point`, `dir`, …).
  2. **Occlusion** (`lineOfSight`; on by default, off only when `throughWalls: true`).
  3. `ask('damage.modify')`: the dodge guard, hit caps, stealth, parry, effects' modifiers.
  4. Apply to attributes.
  5. `emit('damage.dealt')`; on death, `emit('actor.died')`.
  6. `cue('cue.hit.<surface>')`.
- **Tags decide the rules.** The hit cap and the dodge guard answer only `creature.*` / `boss.*` sources, never
  `env.fall` / `env.lightning`. That fixes the Storm Titan (bug §7.3).
- **Player health** lives in the engine (the player's `AttributeSet`). The 5 hurt blocks in `main.ts` and its local
  `health` variable are deleted.
- **The aggression director:** `combat.director.tokens = manifest.fight.attackers` (Driftwood 2; others unlimited =
  `Infinity`), the engine-wide version of E297's `AttackTokens` (18).

## 19. Creatures and AI (decisions 11, 16)

```ts
// #engine — src/engine/ai/
export interface SpeciesRow {                // tuning: kit (2+ shards) or shard
  id: SpeciesId; parent?: SpeciesId; tags: readonly Tag[];
  rig: RigRef; mesh: () => Promise<THREE.Object3D>; health: number; speeds: MoveSpeeds;
  senses: Senses; strikes: readonly StrikeSpec[]; loot?: LootTableId; tick?: TickRateId;
  brain: new (a: Actor) => CreatureBrain;    // behaviour: a subclass (67)
}
export type StrikeShape =
  | { kind: 'arc'; radius: number; halfAngle: number } | { kind: 'lane'; length: number; width: number }
  | { kind: 'ring'; inner: number; outer: number } | { kind: 'wedge'; length: number; halfAngle: number }
  | { kind: 'point'; radius: number };
export interface StrikeSpec {                // replaces the 24 hand-rolled windup / hit / cooldown blocks
  id: string; shape: StrikeShape;
  windup: number; active: number; recover: number; cooldown: number;
  range: number; damage: number; tags: readonly Tag[]; telegraph?: GroundTellSpec; weight: UtilityCurve;
  motion?: { speed?: number; delay?: number; track?: 'none' | 'lead' | 'follow' };   // a lane charge's speed, a ring's growth speed, a point strike's delay
}
export abstract class CreatureBrain {        // a hierarchical state machine: idle → alert → fight → flee, with sub-states
  protected hfsm: Hfsm; abstract pickStrike(ctx: BrainCtx): StrikeSpec | null;   // default: utility-weighted
  canReach(target: Actor): boolean;          // occlusion + nav — runs on EVERY shard (bug §7.2)
}
export abstract class BossBrain extends CreatureBrain { abstract readonly phases: readonly BossPhase[] }  // goal stack + HP-threshold phases
export interface EncounterService {         // today's Boss.ts runtime (arena, seal, intro, retry, reward) + Elite.ts, generalised
  boss(def: BossDef, brain: BossBrain, scope: Scope): BossHandle;
  elite(def: EliteDef, scope: Scope): EliteHandle;
  spawn(table: SpawnTableId, scope: Scope): Spawner;
}
export interface WeightedTable<T> { mode: 'weighted' | 'each'; rows: readonly { item: T; weight: number; count?: [number, number]; when?: Tag[] }[]; rolls: number }  // spawns + loot; 'each' = every row once (fixed harvest yields)
```

**Where things go**
- **The runtime:** `AnimalManager` and `Animal` become the creature runtime; `Boss.ts` and `Elite.ts` become the
  encounter runtime.
- **Bosses:** the Kurgan Boss, Storm Titan, Antler King and Drowned Captain become `BossBrain` subclasses in their
  shards, **each fight unchanged**. The Captain joins the runtime (decision 4 of v1 is kept, with no feel change).
- **Species:** boar and bear go to `#kit/species/` (the horse stays in Nalati, 13-lead-resolutions 09#5). Every other species stays in its shard (the list is in
  [09-combat-ai.md](09-combat-ai.md)).

## 20. The game layer (`#game`)

| Part | Holds | Decision |
|---|---|---|
| Shard | `ShardManifest`, `ShardPlugin`, `ShardContext`, the generated registry, `app.shard` (the running manifest) | 14, 62 |
| Title deck | cards and order from the registry; the error screen's "back to title" | 62 |
| Bag | tabs (MAP · GEAR · FINDS · PACK · FEATS per shard's picks, E314), item fragments, `travels` flag on item rows (default off) | 75 |
| Coins | the purse, **per shard** | 74 |
| Loot | loot tables (the engine's `WeightedTable`), drops, bounty | 16 |
| Compendium, feats | per shard + a read-only **Wildshard summary** (completion per shard on the title deck, total feats) | 76 |
| Travel | the travel verb and hand-off state (where you arrive, what `travels`): only the type and a page-reload implementation now | 59 |
| Analytics events | the Wildshard event names the sink batches (`shard.time`, `quest.step`) | 79 |

## 21. The kit (`#kit`)

| Folder | Contents at the end (rule of two: 2+ shards) |
|---|---|
| `#kit/weapons/` | the Melee, Bow, Crossbow, Firearm and Thrown families + shared profiles (the iron sword) |
| `#kit/species/` | boar and bear (2+ shards). The horse stays in Nalati: its only other user is the horse playground, which is Nalati's |
| `#kit/effects/` | poison, burn, bleed, slow, stun |
| `#kit/weather/` | the rain curtain (the one weather FX Nalati and Pine share). Puddles are two different techniques, so they stay per shard as look content, and lightning is Nalati's alone |
| `#kit/npc/` | the NPC rig + idle (D9). Seeded from Pine's `npcRig` in S2.5; Nalati's campPeople join in S3.3; Driftwood's Castaway and Trader join in S4.3 |
| `#kit/tools/` | the hoverboard (used on all 4 shards) as a kit Tool, moved in X1; its movement mode (`board` context, motor) stays engine |
| `#kit/looks/` | any look piece 2+ shards share (the grass trample: Pine + Nalati) |

## 22. Explore, practice, playgrounds

- They move to `#engine/explore`, `#engine/practice` and `#engine/practice/playground` (EI21–EI23). Explore's art
  comes from `manifest.card` / `explore`.
- Playgrounds are registered by shards (`ctx.playground`). The grapple course moves to Nine Dragon's folder and the
  horse course to Nalati's. `Playground.ts` loses its Nalati `Ride` typing.
- The practice arena's `BOSS_NAMES` becomes a content registry fed by rows.

## 23. Analytics, session health, capture, debug

- **Analytics** (79): `#engine/analytics` subscribes to typed events and batches them to `api/`, anonymously. The
  first set: `death.cause`, `quest.step`, `weapon.used`, `shard.time`, `boss.attempt`. A digest goes to the session
  brief.
- **Session health** (47): the next boot reports how the last session ended (clean exit, crash, context loss, OOM
  guess) plus fps per shard, which gives a crash-free-session rate per build in the session brief.
- **Capture:** `clock.setCapture(fps)` + seeded RNG (80).
- **Debug:** today's `DEBUG_ROWS` registry. Shards add rows through `ctx.debugRow`, into the existing groups only (the
  AGENTS.md rule). `lint/url-params.json` is unchanged.

## 24. Lint rules and the ratchet

| Rule | Checks | Starts at |
|---|---|---|
| `wildshard/layer` | import direction; no shard ↔ shard; the public index only; `src/engine/**` word list (slugs, shard / creature / weapon names, Bag, coin, loot, compendium, feat) | today's counts, per file |
| `wildshard/no-shard-branch` | `slug ===`, `style ===`, `isOcean`, `nalatiNow()`, `isPine`, `isNine`, `painterly ?`, etc. outside `src/shards/` | 269 |
| `wildshard/no-raw-save` | `localStorage` / `sessionStorage` outside `#engine/saves` | 36 keys / 28 files |
| `wildshard/no-raw-random-time` | `Math.random` / `performance.now` outside `core/{rng,clock}.ts` + the cosmetic allowlist | 254 / 242 |
| `wildshard/no-raw-input` | DOM input listeners outside `#engine/input` | 179 |
| `wildshard/no-renderer-type` | `WebGLRenderer` named outside `src/engine/render/**` (before F6: outside `Game.ts` and `bootstrap.ts`; F6 re-keys it) | the rule's own count at F4 (the audit's "52 files" was a grep, not the rule) |
| `wildshard/sim-no-render` | `src/engine/{combat,ai,saves,quests,effects}/**` importing three beyond its math types, or any render / DOM module (decision 56) | today's count at F4 |
| `wildshard/no-active-chunk` | `getActiveChunk()` calls outside `#game/shard` (each becomes `app.shard` or manifest data, file by file from F8 on) | 136 calls / 42 files |
| `wildshard/no-global-listener-patch` | teardown through `shardScope`'s `addEventListener` patch (kept until X1 / X2 move the 396 listeners onto scopes) | 396 |
| `wildshard/no-url-switch` | unchanged (the allowlist) | — |

**How the ratchet works**
- `lint/ratchet.json` holds `{ rule: { file: count } }`. A count may only go down. `pnpm lint:ratchet --update` lowers
  the file after a fix, and the gate fails on any rise.
- Each rule's target is 0 at its row's done-when, listed in each spec.
