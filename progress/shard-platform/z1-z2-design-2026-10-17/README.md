# N1 (declared runtime entry) and N2 (world scene assembly): technical design

Read-only investigation of `main` at `94fd1d5ab` (2026-10-17), for Jake's G480 (2): *"It's hard to approve n1 n2 … without
far more technical details"*. Nothing was built, generated or run in the shared tree. The built outputs quoted come from the
existing `out/<slug>/` (written 05:33 today by the normal build), so no build was run for this page.

**Line counts.** "Lines" are code lines: non-blank, non-comment, the same rule the ruler uses. My count reproduces the
ruler's numbers closely: Sky 477 against its 481, Signal 370 against its 372 (the gap is GLSL and platform lines the ruler
charges in addition). Raw `wc -l` is given in brackets where it helps.

---

## 1. In plain words

**N1, declared runtime entry.** Today every big shard is two programs glued together. One is the platform's generic
"data client". It already runs the Template, Pastel Plain, Ink-Cel Valley and the Blender template from their shard file
alone, with no shard code. The other is the shard's own TypeScript plugin (`plugin.ts`, `runtime/index.ts`), which builds
the world, wires the quest and starts the effects. The two run side by side, and the shard file says which jobs the plugin
keeps (`runtime.binds`). N1 deletes the shard's half: the shard file gains a short list of the platform features it uses
(painted look, world scenes, held weapon, quest page, boss fight, trails and so on, each with its settings). The data
client installs them in a fixed order the platform owns. Then a big shard boots exactly the way the Template does. Nothing
in it is TypeScript, so it ships once, inside its shard file, and a server or another page can load it unchanged.

**N2, world scene assembly.** Each big shard has a hand-written `world/build.ts` that loads its baked pieces, builds each
place from a recipe, hands it the right geometry and materials, registers colliders, and pauses between pieces so the
phone keeps drawing frames. Sky's and Signal's recipes are already data; only the glue is code, and it is nearly the same
glue in every shard. N2 moves that glue into the platform. The shard file lists its libraries (baked GLBs, model pools),
its material slots (which look graph each slot wears) and its build steps (which recipe, which pieces and colliders, which
named parts other features need: the bridge pivot, the winch prompt spot, the vane rotors). The platform builds them in
order, paced to the frame budget, and keeps the result alive when you leave and come back (G476).

---

## 2. Jake's template question, answered directly

*"I don't know how we're doing this for the templates, because the templates are full shard files."*

**The templates already work the N1 way. N1 does not change them; it brings the hybrid shards to them.**

- `_template`, `blender-template`, `ink-cel-valley` and `pastel-plain` have no `runtime/` folder and no `plugin.ts`
  (folder listings; `blender-template/README.md`: "There is no terrain heightfield, runtime folder or shard generator").
  Their generated discovery passes no native loader: `src/shards/_template/discovery.generated.ts:7` is
  `const native = {  }`, while Sky's passes `render`, `roster`, `load: () => import("./plugin")` and `ktx2`
  (`src/shards/far-reach/discovery.generated.ts:20`).
- Their manifest names a built shard file (`"shardfile": "/shardfiles/_template/shard.json"`,
  `src/shards/_template/manifest.json`). At boot `src/entry.ts:137-139` calls `installManifestShardfile`, which reads the
  built output and builds the manifest's plugin as the data client:
  `load: … class extends ShardfileClient …` (`src/game/plugin/ui.ts:1918`). It refuses any shard that declares a runtime:
  `if (source.runtime !== null) throw new Error('Custom runtime requires trusted hybrid composition')` (`ui.ts:1968`).
- Their unique behaviour is AssemblyScript plus data: `_template/behaviour/door.as`, `boss.as`, `idle.as`, `items.as`,
  named hook ids in `behaviour/hooks.ts`.
- Their output has no `runtime` block (`out/_template/shard.json`: `runtime` is `null`), so the ruler counts them as
  closed with 0 escapes (`scripts/shard-runtime-closure.mjs:21-28`) and labels them `native`
  (`scripts/shard-platform.mjs:855`, `metric: pair === undefined ? 'native' : …`).

**Does a new shard copied from `_template` already work this way?** Yes. `docs/SHARDS.md:219-220`: "New projects have no
custom runtime." A copy boots through the data client and closes on day one.

**Does N1 change the templates?** No code in them changes. They gain two things:

1. They are the regression guard: N1 grows the data client, and every template must keep booting unchanged through it.
2. N2's new `world/scenes` section and N1's `client/plan` section are optional. A template with neither behaves exactly
   as today. I recommend the Template gets one small scene step (its hut's door pivot as a named handle), the same way G456
   (3) gave it a reference Wasm encounter, so a copy shows how to declare a scene. That is a few rows, not code.

**The one template wrinkle:** the ruler still charges the Template's executable manifest and budget files (70 lines in
the 10-14 measure, `progress/shard-platform/w1-residue-2026-10-14/README.md` B3). That is a ruler rule (F8 in that page),
not N1.

---

## 3. What the code does today

### 3.1 Two boot paths, and the hybrid path already contains the template path

| | Template (data shard) | Hybrid (Sky, Signal, Pine, Driftwood, Nalati, Nine) |
|---|---|---|
| Manifest field | `shardfile` | `gridShardfile` plus `runtimeEntry` and TS `bindings` (`load`, `render`, `roster`, `ground`, `ktx2`) |
| Boot | `entry.ts:137` → `installManifestShardfile` → `clientSource` → plugin = `ShardfileClient` | `installManifestShardfile` returns the manifest unchanged (`ui.ts:1942`); `session.ts:115-126` loads `plugin.ts` |
| Plugin | `ShardfileClient` (`src/game/shardfile/client.ts:161`) | `standaloneHybridEntry` (`plugin/context.ts:255`) → `prepareHybridShard` (`shardfile/hybrid.ts:271`) → `HybridShardPlugin(data, Runtime)` (`hybrid.ts:161`) |
| Shard code | none | `runtime/index.ts` plus whatever it imports |

The key fact for N1: **a hybrid already runs the data client.** `prepareHybridShard` builds the same `ShardfileClient`
(`hybrid.ts:323`, `shardfileSource(... trustedRuntime: true ...)`) and wraps it with the trusted runtime. Each stage runs
the data half first, then the runtime half: `world` at `hybrid.ts:171-183`, `kit` at `226-229`, `play` at `238-249`.

The data client decides how much it does from the data itself (`client.ts:150-156`, `187-188`):

- `full`: everything (the Template; also a hybrid whose unbound data still holds behaviour),
- `presentation`: only terrain tiles in the look's materials, lent to the runtime (`client.ts:254-269`),
- `empty`: nothing; the runtime binds everything.

What the runtime keeps is declared per section in `runtime.binds` (`src/format/runtimeBinds.ts:37`, eleven sections). The
data client strips those sections before it runs (`client.ts:184`, `withoutRuntimeRows`). Today's binds, read from
`out/<slug>/shard.json`:

| Shard | `runtime.entry` | `runtime.binds` |
|---|---|---|
| Sky | `runtime/index.ts` | quests, ledger, state, items, spawns, modes, props, clientChannels |
| Signal | `runtime/index.ts` | quests, ledger, items, spawns, state, clientChannels, movers |
| Pine | `runtime/index.ts` | terrain, props, quests, ledger, items, spawns, state, modes, movers, clientChannels (+12 custom sections) |
| Driftwood | `runtime/hybrid.ts` | state, quests, ledger, items, spawns, modes, props, terrain, movers, loot, clientChannels (+7 custom) |
| Nalati | `runtime/index.ts` | quests, ledger, state, items, spawns, modes, clientChannels, terrain |
| Nine | `runtime/index.ts` | props, items, ledger, modes, clientChannels |

So **N1 in one sentence: `runtime.binds` goes to `[]`, the `runtime` block leaves the shard file, the data client runs in
`full` mode, and the manifest switches from `gridShardfile` + `load` to `shardfile`.** What stops that today is the list
of jobs the runtime does that the data client cannot (section 3.4).

### 3.2 What "closed" means in the code: two different levels

**Level 1, "closed" (what the ruler and P4 mean).** `runtimeClosures` (`scripts/shard-runtime-closure.mjs:17-30`) walks
every `.ts` under the shard's `runtime/` and counts `runtime-standalone` violations from
`lint/shardfile-boundaries.mjs:41-50`: a runtime file may import only its own `runtime/` files and the public
engine/game/SDK/format/three/valibot modules, never JSON, assets, `?raw`, or any other shard file. Zero violations =
`closed`. A closed shard's `runtime/` is copied verbatim into `out/<slug>/runtime` (`scripts/build-shardfiles.mjs:58-60`,
`--copy-runtime` only when `runtimeIssues` is empty) and the ruler measures that copy (`shard-platform.mjs:873-879`; an
unclosed shard gets no percentage). A shard with no `runtime/` at all is trivially closed (the templates).

**Level 2, "runtime deleted" (G426, G453 (5)).** No `runtime/`, no `plugin.ts`, `runtime.binds` empty: "a shard becomes
dynamically loadable by losing its `runtime/` (data + Wasm, like the Template), not by bundling runtimes" (G453 (5)).

Today's escape counts are Sky 14 and Signal 4 (the audit). I recounted them by hand:

- Sky (14): `runtime/index.ts:1,2,8,10,12,13,14,15,17,18` reach `../data/*.generated.json`, `../boot/…`, `../world/*`,
  `../weapons/fanModel`; `runtime/source.ts:1` imports `../data/product.generated.json`; `runtime/weapons/heldFan.ts:2`
  and `runtime/looks/wakeRibbon.ts:1,2` reach `../../world/meshes` and `../../data/rayWake.generated.json`.
- Signal (4): `runtime/index.ts:1` imports `../plugin` (the whole plugin lives *outside* `runtime/`, `plugin.ts:30-77`);
  `runtime/source.ts:1`; `runtime/items/heldWhip.ts:2-3`.

Note that Signal's low count hides the size of its play code: `plugin.ts`, `world/`, `look/` are not inside `runtime/`, so
the boundary rule never checks them. The ruler still counts them as play code (`PLAY` folders,
`lint/shardfile-boundaries.mjs:7`).

**Why Sky and Signal cannot just "close" at level 1 cheaply:** they could (move `world/`, `look/`, `models/`,
`weapons/`, `plugin.ts`, `roster.ts` into `runtime/`, and read sections instead of generated JSON). But G465 (2) forbids
that detour: *"code whose end state is data, a host or a script goes straight there and never takes a detour through
`runtime/`"*. With N1–N10 both reach zero (the audit), so for them level 1 is wasted work. **For Sky and Signal, N1 means
level 2.** For Pine, Driftwood, Nalati and Nine, whose runtimes are 2,300–7,200 lines and will not reach zero this week,
level 1 is still the way to close (G464: Driftwood closes first), and N1 offers them a small optional piece (section 4.9).

### 3.3 How a hybrid page builds (lifecycle)

The engine's level loader runs three stages, `world` → `kit` → `play` (`session.ts:142-165`, `sessionStages` at
`session.ts:169-180` adds `data`, `loadout` and `finish` around them). The hybrid adds a resident data world and an entered
runtime scope (`hybrid.ts:191-225`, `scope = ctx.scope.child('runtime.play')`).

Sky's and Signal's runtimes subclass one shared host, `HybridRuntimePlugin` (`src/game/plugin/headless.ts:691-1046`, ~350
lines, two users). Its fixed order (doc comment, `headless.ts:680-690`):

- **world** (`headless.ts:892-915`): read `rows(product)` once; preload the sim Wasm blobs named by `sim/scripts`;
  `ctx.strings(...)`; the shard's **`build(ctx)`**; load the held-weapon factory; declared level bounds.
- **kit** (`916-970`): debug aliases; the weapon row; the species catalogue (brains, decision authority); encounters; the
  held melee at kit stage; the shard's **`prepare(ctx)`**; `buildEquipment`.
- **play** (`971-1033`): weapon into the viewmodel, then the shard's **`dress(ctx, weapon)`**; player shove; entry pitch;
  item input contexts; declared input; stowed mode; the shard's **`enter(ctx)`**; declared audio; coin loot; the saved
  page quest with capture stages; client motion (movers on channels); traversal columns; the shard's **`install(ctx)`**;
  the quest-complete probe; the debug name.

The shard supplies `rows()` and the hooks `build`, `install` (required) and `prepare`, `dress`, `enter` (optional). Sky
overrides `build` (`far-reach/runtime/index.ts:54-85`) and `install` (`86-163`); Signal `build`, `dress` and `install`
(`sunscar-dunes/plugin.ts:39-76`).

**Pacing.** Builders call `worldBuildYield(ctx, 4)` (`src/game/shard/plugin.ts:17`) between pieces. It is
`buildYield` (`src/engine/core/workSlice.ts:60-65`): a fresh task, or in play with a frame due a wait for the next drawn
frame; it rejects once the scope closes (an unloaded grid cell stops building). Sky calls it 9 times by hand
(`runtime/index.ts:59,72,73,92,98,103,134,135,143`; line 72 passes it into `buildWorld` as its `pause`). The comments record why:
"op-hitch41 … one 366 ms task on the Simulator" (`runtime/index.ts:62`, `world/build.ts:45-49`), "OP5: each mapped look
ends a task" (`world/build.ts:64`). Driftwood uses `BuildStages` with a 30 ms slicer instead
(`driftwood-isle/world/build.ts:86-88`; `BuildStages` at `src/engine/boot/plan.ts:133-175`).

### 3.4 What Sky's and Signal's runtimes still do that the data client does not

`HybridRuntimeRows` (`headless.ts:614-656`) is already mostly data. Sky emits it from a generator
(`far-reach/generators/rows/runtimeRows.ts:14-21`) as `data/runtimeRows.generated.json`. Three things stop it being pure
data:

1. **Borrowed owners: TypeScript callbacks by name.** `owners?: Readonly<Record<string, unknown>>` (`headless.ts:655`) maps
   names to live TS objects. Rows then call methods on them by path, for example Sky's
   `decorate: { call: { owner: 'heldStyle', path: ['paint'] }, value: { owner: 'plugin', path: ['leaf'] } }` and
   `capture: { …, raise: { owner: 'plugin', path: ['finishRaise'] } }` (`runtimeRows.ts:15-19`), resolved by
   `bindBorrowedMethod` (`src/game/plugin/borrowed.ts:31`). Sky's `rows()` supplies the owners as TS:
   `owners: { ...FAN_HELD_OWNERS, heldStyle: { paint: paintFanLeaf }, models: HERO_LIBRARY, looks: { mapped: SKY_LIBRARY.mappedLook } }`
   (`runtime/index.ts:52`). This fails G454 (5) ("per-shard hooks are Wasm script references, never TS callbacks").
2. **The hooks' bodies** (`build`, `install`, `dress`): the world build (N2), effects, per-frame dressing and fight extras.
3. **Ports to TS-built libraries:** `SKY_LIBRARY` / `HERO_LIBRARY` (`world/meshes.ts:13-16`), `WORLD = bakedMeshWorld(...)`
   (`world/baked.ts:23-27`), `DUNE_LIBRARY` (`sunscar-dunes/world/meshes.ts:22`), built from generated JSON.

**Double shipping.** Every one of those reads goes to generated JSON in the source tree, which Vite bundles into the app.
Sky's play code imports 24 different `*.generated.json` / data JSON files (for example `world/build.ts:1-5,12`); Signal's
16. Sky's own shard file is bundled a second time as JSON: `runtime/source.ts:1-5` is
`import rows from '../data/product.generated.json'; export default parseShardfile(rows);` (281 KB), and `world/build.ts:9`
and `models/gear.ts:5` read it. The audit measured 1.26 MB (Sky) and 0.32 MB (Signal) of generated JSON in the app
bundle, "including the same rows as the shard file". The generated discovery adds more:
`far-reach/discovery.generated.ts:5-11` imports `runtimeCost`, `devPoses`, `navigation`, `cues`, `boot/files`,
`boot/sources` and `boot/lateReads` JSON.

**Assets outside the shard file.** Sky's runtime loads 58 distinct `/assets/far-reach/...` URLs
(`boot/assets.generated.json`); its shard file lists 32 files, mostly card images and the Roc's Wasm. Signal's runtime
loads 32 `/assets/sunscar-dunes/...` URLs. A runtime-deleted shard can only read blobs by logical name
(`ctx.product.file(name)`), so those bytes must move into `blobs/` first (the G452 "assets into blobs" row).

**The simulation is already out.** The headless sim runs from the shard file alone through `sim/runtime-plan`
(`src/game/shardfile/nativePlan.ts:8-21`, used by `src/sdk/headlessRuntime.ts:17`; Sky's plan is emitted at
`generators/output.ts:17`). Everything left in `runtime/` is client view code. N1 does not touch the sim.

### 3.5 What each `world/build.ts` does

#### Sky Reach (`world/build.ts` 105 lines [138] plus `shapes.ts` 23, `mill.ts` 14, `baked.ts` 20, `isle.ts` 21, `meshes.ts` 18)

A paced sequence of eight scene instantiations, all of them already JSON recipes:

1. **Ground**: `createWorldScene(SKY_GROUND.recipe, { geometry: island tile meshes by name, materials: isleMaterial(look) … })`,
   then burn `SKY_GROUND.cosmeticDraws` cosmetic random draws (to keep the seeded order), then
   `pieces.scene(ground, SKY_GROUND.bindings, pause)` (`build.ts:55-62`).
2. **Static scene**: choose `STATIC_SCENES.standalone` or `.cell` by grid cube (`build.ts:23-27`, G99); load each hero
   model (`skyHd`); build port materials from `"<look>:<model>"` sources, a pause per material (`build.ts:66-73`); a
   geometry resolver that maps `fall`, `hero-*` and pool names to three sources (`74-75`); instantiate and register (`76-78`).
3. **Routes** (rope rails, hover glass): `createClientScene(SKY_ROUTE_SCENE, routePorts)`; pull out the glass material for
   the hover-deck glow (`81-85`).
4. **Fixed scene** (islet lips, chain posts, docks): register `ISLET_SCENES.pieces` one by one with colliders, add the baked
   `islet-rig` (`89-92`), then register its bindings a piece per task in four groups (`95-125`).
5. **Fallen bridge**: `bindWorldSceneParts(frames, { fallen: 'group', winchAt: 'vector', notesAt: 'vector' }, …)`; register
   the bridge piece with `active: () => state.raised` (`104-106`).
6. **Quest prompts**: `createQuestPagePrompts(source, …, ['winch','notes'])` at the bound anchors (`114`).
7. **Vanes**: instantiate `SKY_VANES`, bind each row's `at` and `rotor` (`117-123`).
8. **Storm** (`128`) and **moving islets** (`131-134`, `bindClientChannels` with `initialPoses`).

It returns named handles that `runtime/index.ts` then drives: `hoverDeck`, `fallen`, `millHub`, `vanes`, `winch`, `notes`,
`state`, `islets` (`build.ts:28-42`).

Today's code, `build.ts:117-123`:

```ts
const vaneScene = createWorldScene(SKY_VANES.recipe, { geometry: vaneGeometry(), model: SKY_LIBRARY.model, baked: WORLD.object });
const vanePorts: Readonly<Record<string, unknown>> = SKY_VANES.ports;
await pieces.scene(vaneScene, SKY_VANES.bindings, pause);
const vanes = SKY_VANES.rows.map(row => {
  const { at, rotor } = bindWorldSceneParts(vaneScene, { at: 'vector', rotor: 'group' }, { at: vanePorts[row.at], rotor: vanePorts[row.rotor] });
  return { id: row.id, flag: row.flag, at, rotor };
});
```

#### Signal Dunes (`world/build.ts` 74 [107] plus `places.ts` 29, `fireFx.ts` 45, `baked.ts` 11, `meshes.ts` 14, `data/placeBindings.ts` 6)

1. `WORLD.placements(ctx.piece, ctx.root, baked)`; build and register the tower, caravan and well through
   `buildPlace(id, baked)` (`build.ts:45-47`). `buildPlace` (`places.ts:16-31`) is `createWorldScene(row.recipe, ...)` with
   point lights as objects, an `embers` material collector, `bindWorldSceneParts(made, PLACE_BINDINGS[id], row.fields)`,
   then fires and lamp halos at named anchors (`fireFx.ts`), and a glow switch.
2. Register the baked rocks and dressing (`build.ts:47`).
3. Quest prompts and interaction rules (`48-53`), the well bucket's client channels (`56-61`), three braziers (`66-74`),
   the caravan lantern (`76`), the tower fire (`79-80`), the quest page (`81-84`).
4. The painter rim on every material (`86`), roaming firelight (`92-97`) and a per-frame fire system (`98-105`).

Signal builds its world in one synchronous call: no pauses at all (`plugin.ts:44`).

#### The common shape, and what is already generic

Both are: **load a bake → for each place: resolve ports by name → instantiate a recipe → register pieces and colliders →
publish named parts → pause.** The generic parts already exist:

| Piece | Where | What it does |
|---|---|---|
| `createClientScene` | `src/game/plugin/ui.ts:2058` | admits a `PrivateScene` (`src/format/clientChannels.ts:192-230`: ≤128 nodes, group/mesh/object/anchor, port or standard materials, RGBA textures) and builds it from caller ports |
| `createWorldScene` | `ui.ts:2030` | the same plus `imports` of baked pieces and fitted models (`WorldSceneSchema`, `clientChannels.ts:240-245`) |
| `bindWorldSceneParts` | `ui.ts:2271` | typed named handles (`group`, `mesh`, `vector`, `number`, `colliders`, `point-light`, `standard-material`) from `WorldSceneBindingsSchema` (`clientChannels.ts:333-347`) |
| `bakedMeshWorld` | `src/game/shardfile/bakedKinds.ts:225-296` | loads baked GLBs and companion byte resources; `object()`, `piece()`, `geometry()`, `placements()` |
| `worldPieces` | `bakedKinds.ts:322-362` | registers rows with the world registry; `scene(made, bindings, pause)` registers bound parts with a pause each |
| `declaredProps` | `src/engine/world/declaredProps.ts` | the Template's props tiles: GLB material names → family or graph materials (`propMaterials`) |
| `clientWorld` | `src/game/shardfile/clientWorld.ts:23-114` | streamed terrain and props tiles with residency |
| `BuildStages` | `src/engine/boot/plan.ts:133-175` | ordered build steps on a slice clock |
| `ModelPlacementBatch` | `src/engine/models/placementBatch.ts:18` | ordered model placements (one user, Pine's landmarks) |
| `HybridResidentWorld` | `src/game/shardfile/hybrid.ts:76-111` | build the static world once per resident scope and re-bind movers per entry (G476; Driftwood only) |

What is **not** generic yet: the port resolution (library, material, model, baked ports are TS closures), the order and
pause policy, the cube variant, the named-handle hand-off, and loading recipes from sections instead of bundled JSON.

#### The other shards

- **Driftwood** (`world/build.ts` 139 [200]): `BuildStages` over about 15 builders: model placements through
  `place()` / `placeModelSite` (hut, lookout, rocks, jetties), code-built systems (`Ocean`, `Pier`, `Boat`, `Cove`,
  `Seabed`, `GroundCover`), a `RopeChain` bridge deck, path ramps, and the Blender island
  (`driftwood-isle/world/build.ts:76-194`). Already wrapped in `HybridResidentWorld` with declared mover rows
  (`runtime/hybrid.ts:13-24`).
- **Pine** (`runtime/index.ts:82-149`): staged `step('grass' | 'cabins' | 'props')`; cabins, landmarks, crags, props
  scatter from offline bakes (`runtime/world/props.ts`: "Where they stand is an offline bake (G285, SF72)"), drawn models,
  undergrowth.
- **Nalati** (`world/index.ts`, `placeBake.ts`): POIs as generator steps (`world/index.ts:105-120`), places drawn back from
  `places.bin` + `data/places.json` (`placeBake.ts:22-31`), named places already as rows (`world/places.ts:33-51`).
- **Nine** (`world/build.ts` 303 [408]): kits, in-kit models, facade batches, crowd, lanterns, culling;
  `layoutBake.ts` restores a baked layout.

The pattern is the same: a bake drawn back by shard-specific loader code, then registration and pacing. The parts that
are genuinely different (Nine's per-instance culling, Driftwood's ocean shader, Pine's forest) belong to other hosts, not
to N2 (section 5.7).

### 3.6 Shardfile v2 and the runtime data API

- **Source vs output** (G447): the shard folder is source; `out/<slug>/` is the output with `shard.json` (index),
  `sections/<group>/<name>.json`, hash-named `blobs/<kind>/` (G450 (1), (3)). Source `data/` may be TypeScript but is
  build-only (G448). `runtime/` is standalone (G449), client-only (G453 (1)).
- **Sections** are typed in `src/format/sections.ts:29-93` (`PlatformSections`). New plain-value sections register a
  schema in `src/format/platformDataSections.ts:34-48` (`PLATFORM_DATA_SECTIONS`). Shards emit them from
  `generators/output.ts` through `emitPlatformSections` (Sky: `far-reach/generators/output.ts:13-20`). Custom sections are
  `custom/<name>`, shrink-only (G453 (3)).
- **Runtime data API** (`src/game/shardfile/shardProduct.ts:15-35`): `ctx.product.section(name)` (synchronous; every
  `boot` and `enter` section is fetched, hash-checked and decoded before the first hook), `strings(keys)`,
  `file(name)` (verified blob bytes by logical name), `url(name)`, `has`, `hasFile`.
- **AssemblyScript ABI v1** (`src/format/scriptAbiV1.ts`): events (`start`, `tick`, `timer`, `zone.*`, `interact`, `hit`,
  `flag`, `signal`, `field`, `cue`, `channel` …), reads, lists, and commands: `move 1, strike 2, stop 3, field 4, spawn 5,
  despawn 6, flag 7, timer 8, signal 9, grant 10, reward 11, cue 12, channel 13, impulse 14, encounter 15, weather 16`,
  view-only `view.channel 100, view.clip 101, view.vfx 102, view.sound 103, view.visible 104`. Client scripts
  (`src/format/clientScripts.ts`) bind Wasm to `creature`, `panel`, `prop` or `particles` targets.

---

## 4. N1: declared runtime entry (the data client runs a declared client plan)

### 4.1 Problem

- **Two programs per shard.** `plugin.ts` → `standaloneHybridEntry` → `prepareHybridShard` → `HybridShardPlugin` wraps the
  data client and the trusted runtime (section 3.1). The runtime holds the world build, effects and wiring as TypeScript.
- **It cannot close without a detour.** Sky has 14 escapes and Signal 4 (section 3.2). Fixing them by moving code into
  `runtime/` is the detour G465 (2) forbids.
- **It ships twice.** Runtime code reads bundled generated JSON (24 files for Sky, 16 for Signal) plus the shard file
  itself as `product.generated.json`, while the same rows ship again in `out/<slug>/` (1.26 MB / 0.32 MB, audit).
- **It uses TypeScript callbacks by name** (borrowed owners, section 3.4), which fails G454 (5).
- **It has a lockstep trap.** About 3,100 lines of hybrid-host platform code have exactly two shard users, Sky and Signal
  (`w1-residue-2026-10-14/README.md`, blocker B1). If one leaves first, the other inherits them under G294 (Sky would jump
  657 → 3,756 lines in that measure). Both have to leave together.
- **It is not loadable by a server or another page**: a shard with a runtime needs the trusted composition root
  (`ui.ts:1928`, `1968`; `liveSession.ts:684-688` for the grid).

### 4.2 Design in one paragraph

A new client-only platform section, **`client/plan`**, lists the platform features the shard uses, each as one row with
its settings. Rows are **unordered declarations, not a script**: every feature kind has a phase (`world`, `kit` or
`play`) and a rank fixed by the platform, as `HybridRuntimePlugin`'s order is fixed today. The data client
(`ShardfileClient`) gains a plan runner that installs those features from a **closed registry compiled into the app**
(no dynamic loader, G453 (5)). All eleven bound sections become data-client owned (`runtime.binds` → `[]`, the 10-14
plan's F1). A shard with a plan and no `runtime` block boots exactly like the Template: manifest `shardfile`, no `load`,
`installManifestShardfile` → `ShardfileClient`.

### 4.3 What Sky declares

**The `runtime` block leaves `shard.json`.** Today (`out/far-reach/shard.json`):

```json
"runtime": { "entry": "runtime/index.ts", "binds": ["quests","ledger","state","items","spawns","modes","props","clientChannels"],
             "cost": { "glMB": 180.35, "engineBaseMB": 299, "...": "..." }, "trust": "first-party" }
```

After: no `runtime` key. The sections it bound are installed by the data client.

**New section `sections/client/plan.json`** (schema `wildshard:client/plan@1`, audience `client`, load `boot`):

```json
{
  "version": 1,
  "features": [
    { "kind": "look.painted",    "look": "far.golden-hour" },
    { "kind": "world.scenes" },
    { "kind": "grass.blades",    "field": "far.meadow", "tierKnob": "far.meadowBlades" },
    { "kind": "held.melee",      "item": "weapon.far-fan", "stage": "kit", "targets": "scan", "stowedMode": "board",
      "finish": { "part": "silk", "look": "fan-silk", "texture": "textures/fan-leaf" } },
    { "kind": "quest.page",      "quest": "far.keeper", "progress": true },
    { "kind": "population.homes","system": "far.population", "witness": { "groups": ["rays", "goats"] } },
    { "kind": "boss.held",       "encounter": "far.roc", "stages": "far.roc.stages" },
    { "kind": "boss.telegraph",  "strike": "far.roc.galeWall", "shape": "lane-sheet", "look": "gale-veil",
      "opacity": [0.06, 0.22], "reach": 26 },
    { "kind": "fx.field",        "field": "far.updraftStreaks", "at": "far.updraft" },
    { "kind": "fx.field",        "field": "far.updraftLeaves",  "at": "far.updraft" },
    { "kind": "fx.burst",        "on": { "item": "weapon.far-fan", "action": "secondary" },
      "fields": ["far.gustStreaks", "far.gustPetals"], "cue": "heavy" },
    { "kind": "fx.trail",        "trail": "far.rayWake", "actors": { "group": "rays" } },
    { "kind": "input.actions",   "actions": ["far.gust"] },
    { "kind": "debug.expose",    "name": "farReach" }
  ]
}
```

Where each row's other data lives:

| Row | Data it reads | Exists today? |
|---|---|---|
| `look.painted` | `look/look` section gains the painted-look row (today `data/paintedLook.generated.json`, `look/render.ts:11`) | G478 approved painterly look host |
| `world.scenes` | `world/scenes` (N2) | N2 |
| `grass.blades` | Sky's meadow (`world/meadow.ts`); G478 grass field rows | G478 approved (D2 of 10-14 said keep custom) |
| `held.melee` | `combat/items` + `held/*` sections; the recipe now in `runtimeRows.generated.json` `melee` | host exists (`createDeclaredHeldMelee`); the `finish` row replaces `heldStyle.paint` (a TS callback) |
| `quest.page` | `quests/*`; page data now in `runtimeRows` `pageQuest` | host exists (`installBorrowedPageQuest`) but uses borrowed owners; N1 removes them (4.7) |
| `population.homes` | `actors/spawns`, `actors/species-programs` | host exists (`bindRuntimeHomes`, `headless.ts:370`) |
| `boss.held`, `boss.telegraph` | `quests/directors`, `actors/strikes` | boss host approved (G474); telegraph = approved boss telegraphs |
| `fx.field`, `fx.burst`, `fx.trail` | effect-field rows now in `wind.generated.json`, `rayWake.generated.json` | `effectField` exists; burst = N4, trail = N5 |
| `input.actions` | the `far.gust` action now declared by module augmentation (`runtime/index.ts:25-33`) | N3 |
| `debug.expose` | name only | trivial, platform |

### 4.4 What the platform does at boot, step by step

1. **Discovery.** `scripts/gen-shards.mjs` sees `shardfile` (not `gridShardfile`) and no `load`: it writes
   `const native = {}` as for the Template. No shard TS enters the app bundle; the generated-JSON emitters
   (`generators/runtimeData.ts`, `viewData.ts`) and `data/product.generated.json` are deleted.
2. **Admission.** `entry.ts:137` → `installManifestShardfile` fetches `shard.json`, verifies sections and blobs, and builds
   the manifest with `load` = `ShardfileClient`. Residency admission uses the data-home path (library and tile claims)
   instead of the reviewed opaque `runtime.cost` (risk 4.11).
3. **Construct.** `ShardfileClient` runs in `full` mode (no `trustedRuntime`, nothing stripped). It reads
   `client/plan` if present and resolves every row against the registry. An unknown kind or a missing section refuses the
   load: `ProductError` at boot, never a silent skip.
4. **world.** The data client's existing work (`client.ts:192-226`: library lease, materials, water, tiles, post), then
   the `world` features in platform rank: `look.painted` → `world.scenes` (N2; publishes handles) → `grass.blades` →
   `motion.channels` (the client channels, now installed by the data client, targeting scene handles). Each feature gets
   a `pause()` (`buildYield` on its scope) and may not run more than one budget slice without calling it.
5. **kit.** The data client's kit (`client.ts:271-307`: species rows, looks, compendium, loot, creature spawns,
   `buildEquipment` from `combat/items`), then `held.melee` (the held owner replaces the default equipment when the plan
   declares one), `species.program`, encounters.
6. **play.** The data client's play steps (`client.ts:320-536`: sim, ledger, UI, quests, saves, targets, audio), then
   `input.actions`, `quest.page`, `population.homes`, `boss.held` / `boss.telegraph`, effects, `debug.expose`, each a
   macrotask apart (as `client.ts:311-318` already does).
7. **Leave and re-enter.** Static results of `world` features belong to the resident scope; play features belong to the
   entered scope and are re-installed per entry (4.11, G476).

### 4.5 TypeScript API of the host

```ts
// src/format/clientPlan.ts: the section schema (valibot, JSON-only, bounded)
export const CLIENT_FEATURE_KINDS = ['look.painted', 'look.toon', 'world.scenes', 'grass.blades', 'motion.channels',
  'held.melee', 'species.program', 'quest.page', 'population.homes', 'boss.held', 'boss.telegraph',
  'fx.field', 'fx.burst', 'fx.trail', 'input.actions', 'debug.expose'] as const;   // grows one kind per approved feature
export type ClientFeatureKind = (typeof CLIENT_FEATURE_KINDS)[number];
export type ClientFeatureRow = v.InferOutput<typeof ClientFeatureRowSchema>;      // a variant on `kind`, each row strict
export interface ClientPlan { readonly version: 1; readonly features: readonly ClientFeatureRow[] }
export function parseClientPlan(input: unknown): ClientPlan;                        // refuses duplicates where a kind is single

// src/game/shardfile/clientPlan.ts: the runner (game layer)
export type ClientPhase = 'world' | 'kit' | 'play';
export interface ClientFeature<K extends ClientFeatureKind> {
  readonly kind: K;
  readonly phase: ClientPhase;
  readonly rank: number;                                   // platform-fixed order inside the phase
  readonly needs?: readonly ClientFeatureKind[];           // checked at admission, never at install
  readonly lifetime: 'resident' | 'entered';               // G476: static results outlive one entry
  install(ctx: ShardContext, row: Extract<ClientFeatureRow, { kind: K }>, ports: ClientFeaturePorts): Promise<void> | void;
}
export interface ClientFeaturePorts {
  readonly product: ShardProduct;                          // section/strings/file only: no shard imports
  readonly handles: SceneHandles;                          // named parts published by world.scenes (N2)
  readonly sim: () => ShardfileSimulation | undefined;     // read-only views of the sim the data client owns
  readonly pause: () => Promise<void>;                     // buildYield(scope) with the shared frame budget
  readonly resident: Scope;                                // owner for resident results
}
/** Compiled-in registry: kind → lazy module. The shard selects rows; it never names a module. */
export const CLIENT_FEATURES: { readonly [K in ClientFeatureKind]: () => Promise<ClientFeature<K>> };
export function admitClientPlan(plan: ClientPlan, product: ShardProduct): AdmittedClientPlan;   // throws ProductError
export function installClientPhase(ctx: ShardContext, plan: AdmittedClientPlan, phase: ClientPhase, ports: ClientFeaturePorts): Promise<void>;
```

`ShardfileClient` calls `installClientPhase(ctx, plan, 'world', …)` at the end of `world()`, `'kit'` at the end of `kit()`,
and `'play'` as the last generator steps of `playSteps()`.

### 4.6 Which layer, and why (E405)

- **Schema in `src/format/`** (`clientPlan.ts`), like every section.
- **Runner and registry in `src/game/shardfile/`.** The plan is a shard-file concept, and shard files are game concepts:
  "the game knows it is Wildshard and that shards run arbitrary content" (AGENTS.md, E405). The engine never sees the plan.
- **Each feature module lives where its host already lives**: game for quest, boss, held, population (G473, G474 put game
  concepts in `src/game/`); engine pieces stay engine (`effectField` is SDK today, the look strategies engine). A feature
  module is a thin adapter: parse row → call existing host. No feature module may import from `src/shards/**` (the
  existing `layer` and `shard-names` lint rules enforce it).

### 4.7 How a shard does something unique

In order of preference (G453 (4), G454 (4), G465 (1)):

1. **A setting on a feature row.** Sky's hover-deck glow while riding is a graph input on player mode (F7 of the 10-14
   plan): a `look.materials` curve reading `player.mode == board`, no code.
2. **A client channel** (an existing section, `sim/client-channels`, "copied clock/state observations and bounded
   straight-line numeric expressions", `runtimeBinds.ts:27-28`). Sky's mill hub (`runtime/index.ts:110`,
   `rotation.z += dt * 0.35`) and each vane (`113`, `rotation.y += dt * (flags.has(vane.flag) ? 6 : 0.25)`) become
   channel rows targeting the scene handles `mill.hub` and `vanes.<id>.rotor`, with the flag as an input. The winch
   observation that raises the bridge and relabels the prompt (`runtime/index.ts:80-84`) becomes the page-quest stage row
   that already exists (`stages: { movers: [{ id: 'winch-up', … }] }`, `runtimeRows.ts:16`) plus a per-flag label on the
   interaction row.
3. **An AssemblyScript script reference** (G470, G454 (5)), event-driven at ≤ 10 Hz (G454 (7)), through ABI v1 commands:
   - Signal's quest-driven dusk (`plugin.ts:21-28` `duskOf`, `look/dusk.ts`): a client script on `flag` events computes the
     target and eases `shared.dusk`. It needs the one new command the audit named: **write a host-private shared field**
     (`field` 4 today writes only declared public or owned fields). Proposed as `view.field 105`, client lane only, so the
     authoritative sim never sees it.
   - Signal's fire catching on the tower (`world/build.ts:79`, `commands.catchFire`): a hook scene (`sim/hooks` scenes,
     already data) whose client side uses **`view.visible` 104** on the scene handle `tower.fire`. This needs one format
     change, not an ABI change: a client-script target kind `scene` naming a published handle (today `creature | panel |
     prop | particles`, `clientScripts.ts:9-10`).
   - Quest flags and signals keep using `flag` 7 and `signal` 9; cues `cue` 12; channels `channel` 13 / `view.channel` 100.
4. **Never a TS callback.** Borrowed owners (`owners`, `bindBorrowedMethod`) are removed from the plan's world. A lint
   rule refuses `BorrowedOwnerPath` in any section schema reachable from `client/plan` (ratcheted, G454 (5)).

### 4.8 Before and after: Sky and Signal

**Sky, today (`runtime/index.ts:106-115`):**

```ts
ctx.system({ id: 'far.dressing', phase: 'update', run: (dt, t) => {
  const riding = this.board();
  built.hoverDeck.emissiveIntensity = riding ? 0.9 + Math.sin(t * 4) * 0.15 : 0.25; built.hoverDeck.opacity = riding ? 0.75 : 0.16;
  built.millHub.rotation.z += dt * 0.35;
  for (let i = 0; i < MAX_RUNTIME_ROWS; i++) {
    const vane = built.vanes[i]; if (vane === undefined) break;
    vane.rotor.rotation.y += dt * (flags.has(vane.flag) ? 6 : 0.25);
  }
} });
```

**After** (rows in `sim/client-channels` and `look/look`; illustrative shapes):

```json
{ "id": "far.mill.hub",  "target": { "handle": "mill.hub" },  "channel": "rotation.z", "expr": ["mul", "clock.t", 0.35] }
{ "id": "far.vane.east", "target": { "handle": "vanes.east.rotor" }, "channel": "rotation.y",
  "expr": ["integrate", ["if", ["flag", "far.vane.east"], 6, 0.25]] }
{ "material": "glass", "curves": { "emissiveIntensity": { "by": "player.mode", "board": [0.9, 0.15, 4], "else": 0.25 },
                                   "opacity": { "by": "player.mode", "board": 0.75, "else": 0.16 } } }
```

**Signal, today (`plugin.ts:73-74`):**

```ts
installEnteredRuntimeService(ctx, scope => { setDusk(duskOf(places), true); scope.onDispose(() => { setDusk(0, true); }); });
ctx.system({ id: 'sunscar.dusk', phase: 'update', run: (dt) => { setDusk(duskOf(places)); stepDusk(dt); } });
```

**After:** a client-script row (about 25 AS lines, audit) plus a state row; the painted look's curves already read
`shared.dusk` (`plugin.ts:47`):

```json
{ "module": "behaviour/dusk.wasm", "events": ["flag", "start"], "reads": [{ "scope": "shared", "id": 310 }],
  "writes": [{ "command": "view.field", "field": "shared.dusk", "ease": 0.02 }] }
```

**Files N1 deletes** (with the features its rows call; code lines, raw in brackets):

| Sky | Lines | Needs |
|---|---:|---|
| `runtime/index.ts` | 127 [170] | the whole plan (frame ~45, world call ~30 via N2, dressing ~12 via channels/F7, wind and gust ~15 via N4, wake loop ~8 via N5, gale wall ~15 via boss telegraph, meadow knob ~6 via N3/grass) |
| `runtime/source.ts` | 3 [5] | none (the second copy of the shard file) |
| `runtime/weapons/heldFan.ts` | 5 [6] | `held.melee` row |
| `plugin.ts` | 7 [11] | none |
| `roster.ts`, `models/gear.ts` | 17 [20] | N10 (Explorer catalogue rows) |
| `look/render.ts` | 39 [54] | G478 painterly look host |
| `weapons/fanModel.ts` | 7 [21] | `held.melee` `finish` row |
| `runtime/looks/wakeRibbon.ts` | 30 [42] | N5 trail ribbon |
| `runtime/looks/discLayer.ts` | 16 [24] | painterly dressing rows (G478) |
| **Sky total via N1** | **251** | plus N2's 201 and the meadow's 25 = 477 |

| Signal | Lines | Needs |
|---|---:|---|
| `plugin.ts` | 66 [85] | the plan; `duskOf` (~8) becomes AS |
| `runtime/index.ts`, `runtime/source.ts` | 5 [10] | none |
| `runtime/items/heldWhip.ts` | 5 [6] | `held.melee` row |
| `roster.ts`, `models/gear.ts` | 24 [28] | N10 |
| `look/render.ts`, `look/light.ts` | 34 [55] | G478 painterly look host (the rim as a family-look row) |
| `look/dusk.ts` | 11 [24] | AS client script + `view.field` |
| `boot/ground.ts` | 5 [8] | none (the data client builds ground from `world/terrain`, as for the Template) |
| `weapons/slots.merge.d.ts` | 4 [9] | N3 (declared slots) |
| `runtime/looks/bakedGround.ts` | 37 [65] | N8 (terrain skirt, lent tile material) |
| **Signal total via N1** | **191** | plus N2's 134 and fire FX 45 (N7 or approved light emitters) = 370 |

**Platform code N1 deletes** once Sky and Signal leave together: `HybridRuntimePlugin` (`headless.ts:691-1046`, ~350
lines, users Sky and Signal only), `firstPartyStandaloneEntry`'s Sky/Signal uses (`runtimeVariant.ts:34-41`; Nine still
uses it), and the parts of the ~3,100 two-user lines that only `HybridRuntimePlugin` reaches (borrowed page-quest
composition in `plugin/ui.ts`, `bindPageFight`, `bindQuestCapture`). The rest moves under the data client's features.

### 4.9 Who else uses N1

- **Templates** (`_template`, `blender-template`, `ink-cel-valley`, `pastel-plain`): already the data client. They
  declare nothing new and delete nothing. They are the "data client still boots unchanged" guard.
- **A fixture second shard (G474)** under `test/fixtures/` declares a plan with two features from rows it makes up, and
  boots headless and in the client tests. This is the generic proof, alongside Sky and Signal as the two real users.
- **Pine, Driftwood, Nalati, Nine**: they keep large runtimes for now. They use N1 in two ways:
  1. **Features as they land.** Every G473–G478 feature (quest step runner, spawn director, boss host, held arms,
     living buildings, collections, mounts, grapple …) is written as a `ClientFeature` with a row, not as another
     `HybridRuntimePlugin` hook. Their runtime shrinks feature by feature until `runtime/index.ts` is only calls the plan
     already makes, then it goes. Frame lines that go at that point: Pine `runtime/index.ts` 273 + `plugin.ts` 24 +
     `roster.ts` 32; Driftwood `runtime/index.ts` 91 + `runtime/hybrid.ts` 43 + `plugin.ts` 12 + `roster.ts` 24; Nalati
     `runtime/index.ts` 186 + `plugin.ts` 19 + `roster.ts` 22; Nine `plugin.ts` 139 (its `NdPlugin` class lives there) +
     `runtime/state.ts` 47 + `roster.ts` 3. That is the frame only; the bodies they call go through the G474–G478 features.
  2. **Optional N1-A, "entry resolved from the output", to close at level 1 meanwhile.** The manifest's
     `bindings.load: './plugin'` and the `resolveTrustedRuntime` wrapper in every `plugin.ts` exist only to find
     `runtime/index.ts` from outside it. `scripts/gen-shards.mjs` can instead write a first-party import map from
     `out/<slug>/runtime/<entry>` (G450 (2): "compiled by the app build from `out/`"), keyed by the shard file's own
     `runtime.entry`. Then `plugin.ts` goes (Pine 24, Driftwood 12, Nalati 19 lines) and the app runs the verified copy.
     About 60–90 platform lines. It does not reduce escapes inside `runtime/`; those still need moving or hosting.
     Recommended only if Pine or Driftwood need to close before their runtimes go.

### 4.10 Host bar score (G454 (1), plus the data-only API)

| Test | Pass? | How |
|---|---|---|
| Two real users | Yes | Sky and Signal on day one; the four templates already run the data client; the G474 fixture |
| No shard nouns | Yes | kinds are generic (`fx.burst`, `boss.telegraph`); ids come from rows; `shard-names` lint on the runner and every feature module |
| Shards differ only in data | Yes, once borrowed owners go | rows plus sections plus AS references; `owners` / `BorrowedOwnerPath` refused by lint in plan-reachable schemas |
| A headless server can run it | Yes, by construction | `client/plan` is `audience: client`; the server loads the same file and ignores it; the sim already runs from `sim/runtime-plan`. Lint: feature modules are client-only and never imported by `src/sdk/headlessRuntime.ts` |
| Kept if its first shard vanished | Yes | the runner is the data client's; with Sky gone it still boots Signal and the templates |
| Data-only API | Yes | `install(ctx, row, ports)`: a parsed JSON row and platform ports; no function in any row |

### 4.11 What N1 does NOT do

- It is **not a scripting language**. No sequence, no conditions, no loops in `client/plan`; order is the platform's. A
  shard that needs logic uses AS (4.7).
- It **does not load JavaScript** from a shard file, ever (G453 (5)). The registry is compiled in.
- It **does not touch the simulation**. Spawns, combat rules and quest state stay in `sim/*` sections and the native plan.
- It is **not a home for single-shard code under a generic name**. A new kind needs two real users or a G473/G474-style
  approval and a fixture second shard; otherwise the shard keeps it (counted) or uses AS.
- It **does not draw HTML or CSS UI** (G459 is a separate NEXT row).
- It **does not make memory or download decisions**; those stay in admission and the budgets.

### 4.12 Risks and unknowns

1. **Lockstep (B1).** Sky and Signal must drop their runtimes in one commit set, after every feature both call exists.
   Otherwise the survivor inherits the two-user hybrid code under G294. Plan for one landing day.
2. **Phone frame pacing.** Today's pauses are hand-placed after measured long tasks (op-hitch41, op-hitch45, OP5). The
   runner gives each feature `pause()`, and each feature must yield at least every 8 ms (`WORK_SLICE_MS`,
   `workSlice.ts:19`). Risk: a feature with one big synchronous call (a scene, a graph compile) regresses a road frame.
   Check: the existing frame-floor run at the milestone, Sky's road p95 (36 ms today, STATE.md) must not rise.
3. **Section parse cost moves.** Sections are decoded before the first hook (`shardProduct.ts:10-13`). In a grid cell that
   happens on the road, in play. Sky's scene data (`staticScenes.generated.json` is 583 KB today) would be decoded there in
   one go. Mitigation: N2 splits scene steps into per-step blobs read lazily (5.4).
4. **Memory accounting changes.** A hybrid home is admitted with its reviewed opaque `runtime.cost`
   (`preparePageResidency`, `ui.ts:1859-1882`; Sky's `glMB 180`, `engineBaseMB 299`). A data shard is admitted by its
   declared library and tile claims. Sky's real use could differ from its claims, which matters in the grid with the
   1.2 GB Explorer cap (G433). Mitigation: keep the reviewed figure as a declared `budgets.client` floor until a phone
   reading replaces it; risky changes default-off behind a Debug row (RENDERING.md).
5. **Saves.** Hybrid runtime state is stored through `bindRuntimeState` with legacy migrations (`headless.ts:121`), and the
   page quest through `installBorrowedPageQuest`. The data client keeps its own slots (`platform.encounters`,
   `clientStateSave`, `Ledger`; `client.ts:107`, `461-473`). Moving ownership must carry existing Sky and Signal progress.
   Mitigation: `state/migrations` rows (the section exists) plus a test that loads a saved hybrid slot and checks flags,
   coins, boss record and quest stage. G455 (7) already requires a migration row for state shape changes.
6. **Assets.** 58 (Sky) and 32 (Signal) public URLs must become blobs first. The service worker then fetches those bytes
   once more under hash names (one-time download for returning players).
7. **Debug and capture contracts.** Tests and capture scripts read `__wildshard.shard.farReach` aliases (`fan`, roster,
   boss; `headless.ts:916-930`) and `stage(name)` (`headless.ts:827-845`). `debug.expose` keeps the names; capture stages
   become rows. Find every reader before the landing.
8. **Re-entry (G476).** The resident world is today a per-shard choice (`HybridResidentWorld`, Driftwood). In the data
   client, `world` features declare `lifetime: 'resident'` and are reused on re-entry, while `entered` features are
   re-installed. Only the shard you just left stays resident (G476 (2)).
9. **Unknown: client-channel expressions.** I did not confirm that the channel language can integrate a rate keyed by a
   flag (the vane case). If not, it needs one bounded expression operator, or the vanes become a mover row.

### 4.13 Build steps (G468: each commit deletes a whole module and lands its data path)

| # | Commit | Deletes | Platform + | Tests |
|---|---|---|---:|---|
| 1 | `client/plan` schema + runner + registry with `debug.expose` and `input.actions` (N3 part); Sky declares both | Sky's module augmentation block and expose (in `runtime/index.ts`, kept as a shrinking file) | ~180 | schema unit tests; fixture second shard boots a plan (G474) |
| 2 | Data client installs `quests`, `ledger`, `state` itself (F1 part); save migration rows | Sky/Signal binds lose 3 entries; borrowed `quest.page` owners for Sky | ~150 | saved-slot migration test for both shards |
| 3 | `held.melee` feature with `finish` row | `heldFan.ts`, `heldWhip.ts`, `fanModel.ts` | ~80 | held proof (existing `equipmentEvidence`, `client.ts:490-511`) |
| 4 | `population.homes`, `boss.held`, `boss.telegraph` features (on the G474 boss host) | Sky's populate/gale wall blocks | ~120 | headless scenario unchanged; client boss proof |
| 5 | `fx.field`, `fx.burst` (N4), `fx.trail` (N5) | `wakeRibbon.ts`; wind/gust/wake blocks | counted in N4/N5 | effect fixture |
| 6 | `look.painted` (G478 host) | `look/render.ts`, `look/light.ts`, `discLayer.ts` (both shards) | counted in G478 | look parity board (only if it changes what you see, G468) |
| 7 | `world.scenes` (N2) | section 5 | N2 | N2 |
| 8 | Signal dusk AS + `view.field` | `look/dusk.ts`, `duskOf` | ~40 | AS scenario test (G455 (4)) |
| 9 | **Lockstep landing**: `runtime.binds` → `[]`, `runtime` block removed, manifests to `shardfile`, delete `runtime/`, `plugin.ts`, `roster.ts`, `models/gear.ts` (with N10), generated-JSON emitters | Sky ~140, Signal ~110 remaining; platform −350 (`HybridRuntimePlugin`) | ~40 | boot smoke both shards, standalone and grid; frame floor and memory at the milestone |

**Estimated platform lines for N1 itself:** about **+550 to +750** added (schema ~120, runner and registry ~200, F1
section ownership ~250, feature adapters ~150), about **−400 to −500** deleted at step 9. Features N3–N10 and the
G474/G478 hosts are counted with them, not here.

---

## 5. N2: world scene assembly host

### 5.1 Problem

- **Glue code per shard.** Sky's world glue is 201 lines across `world/build.ts`, `shapes.ts`, `mill.ts`, `baked.ts`,
  `isle.ts`, `meshes.ts`; Signal's is 134 across `world/build.ts`, `places.ts`, `baked.ts`, `meshes.ts`,
  `data/placeBindings.ts`. The recipes are already data; the glue resolves ports, orders steps, registers pieces and
  pauses (section 3.5).
- **Ports are TypeScript closures.** `routeScenePorts` (`far-reach/world/shapes.ts:11-19`) picks geometry from two
  libraries by name; `build.ts:68-73` turns `"<look>:<model>"` strings into mapped materials; Signal's `buildPlace` makes
  point lights and collects ember materials (`places.ts:19-22`).
- **It ships twice.** Every recipe is a bundled generated JSON file (`staticScenes` 583 KB, `routeScene` 52 KB,
  `groundScene` 18 KB, `isletScenes` 11 KB, `restScenes` 15 KB, `millScene` 2 KB for Sky).
- **Pacing is hand-tuned per shard.** Sky has hand-placed pauses after measured hitches; Signal has none; Driftwood
  slices every 30 ms.
- **Re-entry is per shard.** Only Driftwood keeps its static world resident (`runtime/hybrid.ts:13-24`).

### 5.2 Design in one paragraph

A new platform section **`world/scenes`** declares three tables. **Libraries**: the bakes and model pools, by blob
logical name. **Material slots**: what each slot wears (a `look.materials` graph id, optionally over a library model's own
map, or a plain standard material). **Steps**: an ordered list, where each step is one existing `WorldSceneRecipe` plus its
port wiring, its registry rows and colliders, its cube variant, and the named handles it publishes. A game-layer host
`installWorldScenes` builds the steps in order, yielding on the shared frame budget, owned by the resident scope, and
returns `SceneHandles` for other features (channels, quest prompts, telegraphs, effects). Order is data here because
draw order and the seeded cosmetic draws depend on it (`build.ts:47`, "the same pieces in the same order, the same
seeded draws").

### 5.3 What Sky declares (excerpt of `sections/world/scenes.json`)

```json
{
  "version": 1,
  "libraries": [
    { "id": "sky",    "kind": "pool",    "files": ["models/fan-pool", "models/rest-pools", "models/bridge-pool", "models/islet-pool", "models/mill-rest"] },
    { "id": "heroes", "kind": "painted", "files": ["models/hero-pool"], "models": "models/hero-models" },
    { "id": "world",  "kind": "baked",   "file": "world/bakes", "kinds": "world/kinds", "attributes": { "_shk": "aShk", "_farcloth": "aFarCloth" } },
    { "id": "isles",  "kind": "props-node", "prefix": "isle_" }
  ],
  "materials": [
    { "id": "isle-paint",      "look": "isle-paint" },
    { "id": "falls",           "look": "falls" },
    { "id": "halo",            "standard": { "color": 13169400, "transparent": true, "opacity": 0.5, "blending": "additive", "depthWrite": false } },
    { "id": "posts",           "look": "post-weather", "over": { "library": "heroes", "model": "post-hd" } },
    { "id": "mill-tower",      "look": "mill-tower",   "over": { "library": "heroes", "model": "mill-tower" } },
    { "id": "deck",            "look": "deck-wood" },
    { "id": "frame",           "look": "hover-frame" }
  ],
  "steps": [
    { "id": "ground", "scene": "scenes/ground", "geometry": { "from": "isles" }, "materials": { "*": "isle-paint" },
      "cosmeticDraws": 3, "pieces": "scenes/ground#bindings" },
    { "id": "static", "variants": { "standalone": "scenes/static-standalone", "cell": "scenes/static-cell" },
      "geometry": { "fall": { "library": "world", "piece": "geometries", "kind": "fall", "index": "identity" },
                    "hero-*": { "library": "heroes" }, "*": { "library": "sky" } },
      "pieces": "#bindings", "pauseEach": "material" },
    { "id": "routes", "scene": "scenes/routes", "materials": { "deck": "deck", "frame": "frame", "posts": "posts" },
      "publish": { "glass": { "kind": "standard-material", "part": "glass" } } },
    { "id": "frames", "scene": "scenes/route-frames",
      "publish": { "fallen": { "kind": "group", "part": "fallen" }, "winchAt": { "kind": "vector", "value": [-61.2, 14.1, -131.0] } },
      "registry": [{ "id": "far.bridge.fallen", "part": "fallen", "colliders": "far.bridge.fallen", "activeWhen": { "flag": "far.quest.raised" } }] },
    { "id": "vanes", "scene": "scenes/vanes", "repeat": "vanes",
      "publish": { "at": { "kind": "vector", "port": "at" }, "rotor": { "kind": "group", "port": "rotor" } } }
  ]
}
```

The scene recipes themselves (`scenes/ground`, `scenes/static-standalone` …) are the existing `WorldSceneRecipe` JSON,
stored as named `json` blobs so each step is read and parsed only when it builds (5.4). The handles other features see
are `routes.glass`, `frames.fallen`, `frames.winchAt`, `vanes.<row>.rotor`, `static.mill.hub` and so on.

### 5.4 What the platform does, step by step

1. **Admission** (before any hook): parse `world/scenes`; check every library file, recipe blob, material slot, look id,
   colliders id and handle name exists; refuse duplicates. No allocation yet.
2. **Libraries** (`world` phase, resident scope): read each library's blobs by logical name with `ctx.product.file`
   and build the existing objects: `bakedMeshWorld` for `baked` (`bakedKinds.ts:225`), the SDK model library for `pool`
   and `painted`, props-tile node lookup for `props-node` (as `adoptIsleTile` does, `world/isle.ts:27-33`). A pause after
   each library.
3. **Materials**: compile each slot's graph through the existing look-materials path (`runtimeLookMaterials`,
   `runtimeProduct.ts:239`; `prepareClientWorld`, `284`). `over` binds the graph over a library model's own map
   (`bindGraphMeshMap`, `declaredProps.ts:4`). A pause per slot (Sky's OP5 rule, `build.ts:64-73`, becomes the default).
4. **Steps**, in order. For each: read its recipe blob and parse it (`parseWorldScene`, `clientChannels.ts:245`); choose
   the cube variant (`ctx.cube`); consume `cosmeticDraws` from the cosmetic stream; build ports from the declared wiring;
   `createWorldScene` (`ui.ts:2030`); register pieces through `worldPieces(...).scene(made, bindings, pause)`
   (`bakedKinds.ts:345`) with a pause per binding; register extra registry rows with colliders and declared `activeWhen`
   (a flag or a channel value, never a callback); publish handles through `bindWorldSceneParts` (`ui.ts:2271`).
   `repeat` instantiates per row of a named table (the vanes).
5. **Hand-off.** The host returns `SceneHandles`; channels, quest prompts (`createQuestPagePrompts` at published anchors),
   telegraphs and effects look parts up by name.
6. **Re-entry (G476).** Steps 2–4 run once per resident scope (the `HybridResidentWorld.load` pattern,
   `hybrid.ts:95-110`). On re-entry only the handle consumers (channels, prompts, movers) re-bind. Leaving frees nothing
   static; leaving the last-but-one shard frees it all (G476 (2)).

### 5.5 TypeScript API

```ts
// src/format/worldScenes.ts
export interface WorldScenesSection {
  readonly version: 1;
  readonly libraries: readonly SceneLibraryRow[];          // pool | painted | baked | props-node, files by logical name
  readonly materials: readonly SceneMaterialRow[];         // { id, look? , over?: { library, model }, standard? }
  readonly steps: readonly SceneStepRow[];                 // ≤ 64 steps
}
export interface SceneStepRow {
  readonly id: string;
  readonly scene?: string;                                 // a json blob holding a WorldSceneRecipe (clientChannels.ts:240)
  readonly variants?: { readonly standalone: string; readonly cell: string };   // G99 cube
  readonly geometry?: Readonly<Record<string, GeometryRef>>;                     // '*' and 'prefix-*' patterns allowed
  readonly materials?: Readonly<Record<string, string>>;                         // recipe material port → slot id
  readonly objects?: Readonly<Record<string, ObjectRef>>;                        // lights, props nodes, baked imports
  readonly pieces?: string;                                // binding table: worldPieces.scene rows (bakedKinds.ts:310)
  readonly registry?: readonly SceneRegistryRow[];         // WorldPieceRow + colliders id + activeWhen
  readonly publish?: WorldSceneBindings;                   // existing schema (clientChannels.ts:333-347)
  readonly repeat?: string;                                // instantiate per row of a named table
  readonly cosmeticDraws?: number;
  readonly pauseEach?: 'binding' | 'material';
}
export function parseWorldScenes(input: unknown): WorldScenesSection;

// src/game/shardfile/worldScenes.ts
export interface SceneHandles {
  group(id: string): Group; mesh(id: string): Mesh; object(id: string): Object3D; vector(id: string): Vector3;
  number(id: string): number; material(id: string): MeshStandardMaterial; light(id: string): PointLight;
  colliders(id: string): readonly ColliderDesc[]; has(id: string): boolean;
}
export function installWorldScenes(ctx: ShardContext, section: WorldScenesSection, ports: {
  readonly pause: () => Promise<void>; readonly resident: Scope }): Promise<SceneHandles>;
```

It is registered in N1's registry as the `world.scenes` feature (phase `world`, rank after the look). It can also be
called by a remaining runtime during W2/W3 (`installWorldScenes(ctx, ctx.product.section('world/scenes'), …)`), so
Pine, Driftwood, Nalati and Nine can adopt it before they lose their runtimes.

### 5.6 Which layer, and why

- **Schema in `src/format/`**, next to `WorldSceneSchema`.
- **Host in `src/game/shardfile/`.** It reads `ShardProduct`, the world registry and quest flags; all game-side.
  `createWorldScene` and `bindWorldSceneParts` already live in `src/game/plugin/ui.ts`. The pure "recipe + resolved ports →
  Object3D" assembler (`createClientScene`) is engine-shaped (it knows only three.js and data), and could move to
  `src/engine/` later under E405. That is not needed for N2.
- **Colliders split for the server.** The visual half (three.js) is client-only. The collider half (registry rows, shapes,
  `activeWhen`) is plain data the headless sim can read too. Today the headless sim carries its own copy of the colliders
  in `sim/runtime-plan` `baked` (Sky: `generators/output.ts:10,17`, `physics.generated.json` 278 KB). Making the sim read
  `world/scenes` colliders instead would remove that duplicate, as a separate optional row.

### 5.7 How a shard does something unique

1. **Data on the step**: variants per cube, `pauseEach`, `cosmeticDraws`, `repeat`, `activeWhen: { flag }`.
2. **Published handles driven by other features**: motion by client channels or mover rows; visibility by hook scenes
   (`view.visible` 104 through the new `scene` client-script target, 4.7); lights by the approved light emitters (Signal's
   tower flicker, `world/build.ts:98-105`); prompts by quest-page rows at published anchors.
3. **AS only for decisions** (≤ 10 Hz, G454 (7)), using `flag` 7, `signal` 9, `view.visible` 104, `view.channel` 100.
   N2 itself needs **no new ABI command**.
4. **Never TS ports.** No `geometry: (name) => …` closures in shard code; every port is a declared reference.

### 5.8 Before and after: Sky and Signal

**Sky, today** (`world/build.ts:104-106`):

```ts
const frames = createWorldScene(SKY_ROUTE_FRAMES.recipe, routePorts);
const { fallen, winchAt, notesAt } = bindWorldSceneParts(frames, { fallen: 'group', winchAt: 'vector', notesAt: 'vector' }, SKY_ROUTE_FRAMES.bindings);
pieces.add(LAYOUT.FALLEN_BRIDGE.id, fallen, { colliders: spanColliders(LAYOUT.FALLEN_BRIDGE.id), active: () => state.raised });
```

**After:** the `frames` step in 5.3. `active: () => state.raised` becomes `activeWhen: { flag: "far.quest.raised" }`.

**Signal, today** (`world/places.ts:20-23`):

```ts
const made=createWorldScene(row.recipe,{geometry:DUNE_LIBRARY.geometry,model:DUNE_LIBRARY.model,objects,
  baked:(piece,only,each)=>WORLD.object(piece,only,each,baked),materialCollectors:new Map([['embers',(material)=>{embers.push(material);}]]),
});
const parts=bindWorldSceneParts(made,PLACE_BINDINGS[id],row.fields);
```

**After** (one step per place; the braziers repeat):

```json
{ "id": "tower", "scene": "scenes/tower", "geometry": { "*": { "library": "dune" } },
  "objects": { "light": { "kind": "point-light", "color": 16742960, "intensity": 0, "distance": 10, "decay": 2 } },
  "publish": { "fire": { "kind": "group", "part": "fire" }, "light": { "kind": "point-light", "part": "light" },
               "brazierAt": { "kind": "vector", "value": [0, 9.4, -2.1] }, "deckY": { "kind": "number", "value": 8.6 } },
  "registry": [{ "id": "sunscar.tower", "part": "root", "colliders": "sunscar.tower" }] },
{ "id": "brazier", "scene": "scenes/brazier", "repeat": "braziers", "publish": { "bowlAt": { "kind": "vector", "port": "bowlAt" }, "oil": { "kind": "mesh", "part": "oil" } } }
```

The embers material collector becomes a material slot whose emissive is a curve on the brazier's lit state (a
`look.materials` row), and fires and lamp halos at anchors go to the approved light emitters / N7.

**Files N2 deletes:**

| Sky | Lines | Signal | Lines |
|---|---:|---|---:|
| `world/build.ts` | 105 [138] | `world/build.ts` | 74 [107] |
| `world/shapes.ts` | 23 [31] | `world/places.ts` | 29 [31] |
| `world/mill.ts` | 14 [17] | `world/baked.ts` | 11 [22] |
| `world/baked.ts` | 20 [35] | `world/meshes.ts` | 14 [27] |
| `world/isle.ts` | 21 [33] | `data/placeBindings.ts` | 6 [7] |
| `world/meshes.ts` | 18 [26] | | |
| **Sky** | **201** | **Signal** | **134** |

Not N2: Sky's `world/meadow.ts` (25; grass rows or keep), Signal's `world/fireFx.ts` (45; N7 or light emitters). Signal's
`world/build.ts` quest wiring (prompts, interaction rules, braziers' lit state, the lantern) is deleted by the same commit
only together with N1's `quest.page` rows; I count it under N2 because it is the same file.

### 5.9 Who else uses it

Estimates from reading the files (±30 %); code lines.

| Shard | What it would declare | Lines it would delete |
|---|---|---:|
| **Nalati** | the place bake as a `baked` library (`placeBake.ts` draws `places.bin` back), each POI and camp as a step, named places as registry rows (`places.ts:33-51` is already rows), anchors for cloth, smoke and the kurgan entrance | ~450–530: `placeBake.ts` 244, `places.ts` 75, `world/index.ts` ~100 of 167, camps/cairn/yard/bridge/road ~70 |
| **Nine** | the layout bake (`layoutBake.ts`) as a library, square props, sets, floors and colliders as steps; facade batching, crowd and per-instance culling stay with their own hosts | ~400–500: `layoutBake.ts` 177, `squareProps.ts` 43, `props3d.ts` 55, `sets.ts` 25, `floorRows.ts` 30, `colliders.ts` 28, `build.ts` ~100 of 303 |
| **Pine** | cabins (static part), crags (static part), timber sites, props scatter and drawn-model placements from their bakes; doors, lanterns and smoke go to living buildings (G474) | ~350–450: `runtime/world/props.ts` 38, `cabinBake.ts` 56, `cabinKit.ts` 25, `timber.ts` 51, `timberSites.ts` 69, `world/places.ts` 36, `timberBake.ts` 16, static parts of `landmarks.ts` and `crags.ts` ~110 |
| **Driftwood** | hut, lookout, wreck, shrine, jetties, rocks, bushes and palms placements as steps, entry decks and path registry rows; the ocean, boat swell, rope chain, ground cover and Blender island stay with their hosts | ~200–280: `world/build.ts` ~100 of 139, `places.ts` 31, `sites.ts` 24, `pierLayout.ts` 21, `Bushes.ts` 21, `Palms.ts` 22, part of `runtime/models/fixedSites.ts` |
| **Templates** | nothing required; recommended one reference step (5.3-style, the hut door pivot) | 0 |
| **G474 fixture** | two made-up steps with a cube variant, a repeat and a published handle | test only |

### 5.10 Host bar score

| Test | Pass? | How |
|---|---|---|
| Two real users | Yes | Sky and Signal on day one (both call `createWorldScene` + `bakedMeshWorld` today); Nalati, Nine, Pine, Driftwood next; the G474 fixture |
| No shard nouns | Yes | rows name pieces and handles; the host knows recipes, libraries, slots and steps only |
| Shards differ only in data | Yes | every port is a declared reference; no closures |
| A headless server can run it | Yes, for the half that matters | colliders and registry rows are data and three-free; the visual half is client-only; the server never needs the drawn scene |
| Kept if its first shard vanished | Yes | four more shards' build files have the same shape |
| Data-only API | Yes | `installWorldScenes(ctx, section, { pause, resident })` |

### 5.11 What N2 does NOT do

- **No animation.** Spinning, swinging and bobbing are client channels or movers; N2 only publishes handles.
- **No streaming terrain or props tiles.** Static geometry with no handle and no per-part look should stay in props tiles
  (the Template's path: `clientWorld`, `declaredProps`), which stream and are cheaper. Rule: **a scene step only for parts
  that need a handle, a per-part look, or a registry row the tiles cannot express.**
- **No scatter, forests, grass or water.** Those are the forest host, grass field rows (G478), the water host.
- **No per-instance culling or batching policy** (Nine's facade batches, crowd, instance culler stay in their own hosts).
- **No code-built geometry.** Steps reference baked or library geometry only; anything still built in code at runtime
  moves to `generators/` first (G467: "moving stuff into generators is gg").
- **No gameplay.** Prompts, quests and fights consume handles; N2 never decides anything.

### 5.12 Risks and unknowns

1. **Frame pacing.** Sky measured one 366 ms task on the Simulator before slicing (op-hitch41) and paces with
   `worldBuildYield(ctx, 4)`. The host's default (a pause per library, per material slot, per binding, per step) is at least
   as fine-grained as Sky's hand pacing and finer than Signal's (none today). The unknown is single big steps: Sky's static
   scene creates 18 hero models and 24 nodes in one `createWorldScene`. Measure that one call on the Simulator before the
   landing; if it is over ~8 ms, split the recipe into two steps (data only).
2. **Parse cost.** Recipes become per-step JSON blobs, read and parsed right before their step, so no 583 KB parse happens
   on the road at admission. Blob reads are cached and resolve in microtasks: use `pacedResolve`
   (`workSlice.ts:88-95`) so cached reads do not chain into one long task (the hazard that comment describes).
3. **Memory.** The scene objects are the same objects as today, so steady-state memory should match. The bundled JSON
   leaves the JS heap (part of Sky's 1.26 MB). During the switch, avoid holding both the parsed section and the built
   scene: release each step's parsed recipe after it builds.
4. **Re-entry.** Building on `HybridResidentWorld`'s rule (static once per resident, movers re-bound per entry) is proven
   on Driftwood. Sky's islets need their channels re-bound per entry with `initialPoses` (`build.ts:133`).
5. **Seeded draws.** Sky burns `SKY_GROUND.cosmeticDraws` cosmetic random numbers to keep later draws identical
   (`build.ts:60`). The host keeps that as `cosmeticDraws`. G415 (similar, not identical) makes small drift acceptable.
6. **Saves.** N2 holds no state. `activeWhen: { flag }` reads the same flags the quest already saves. No save change.
7. **Unknown: material slot coverage.** Sky's static scene builds mapped looks from `"<look>:<model>"` strings
   (`build.ts:68-73`). I believe every case is "graph over a model's own map", which `bindGraphMeshMap` covers, but I did
   not check every port row.

### 5.13 Build steps

| # | Commit | Deletes | Platform + | Tests |
|---|---|---|---:|---|
| 1 | `world/scenes` schema + `installWorldScenes` (libraries, slots, steps, handles, pacing) with **Sky's vanes and mill** as first adopter (G468: host with its first deletion) | `world/mill.ts`, `world/shapes.ts` (Explorer parts move with N10 or stay until it lands) | ~350 | fixture second shard (G474): two steps, a cube variant, a repeat, a handle; unit tests per row kind |
| 2 | Sky ground, static, routes, frames, fixed, storm, islets as steps; recipes as json blobs | `world/build.ts` | ~60 (props-node library, `activeWhen`) | Sky boot smoke; one parity line (identical result, G468) |
| 3 | Sky libraries from blobs | `world/baked.ts`, `world/isle.ts`, `world/meshes.ts` | ~40 | Sky boot; asset-blob checks |
| 4 | Signal places as steps (with N1 `quest.page` rows for the wiring) | `world/places.ts`, `data/placeBindings.ts`, `world/build.ts` | ~30 (point-light objects) | Signal boot smoke |
| 5 | Signal libraries from blobs | `world/baked.ts`, `world/meshes.ts` | ~0 | Signal boot |
| 6 | Template reference step (optional) | — | 0 | Template boot unchanged |
| later | Nalati (W3, G444 order), Nine (W3), Pine and Driftwood (W2 leftovers) adopt the same host | per 5.9 | small per shard | per shard |

**Estimated platform lines for N2: about +450 to +550** (schema ~130, host ~300, library and slot resolution ~80).

---

## 6. How N1 and N2 fit together, and the order

- **N2 is one feature of N1** (`world.scenes`), and it is useful on its own: Pine, Driftwood, Nalati and Nine can call it
  from their remaining runtimes during W2/W3.
- **Order:** N2 first (no lockstep: Sky and Signal can adopt it one at a time while both keep their runtimes, and it
  deletes the most lines), then N1's runner and F1 section ownership, then the features both runtimes call, then the
  single lockstep landing. That landing is the moment both shards become Template-shaped.
- **Prerequisites outside N1 and N2** for the lockstep landing: assets into blobs (Sky 58 URLs, Signal 32), the G478
  painterly look host, the G474 boss host, N3 (input, tier, slots), N4 (burst), N5 (trail), N7 or light emitters, N8
  (skirt), N10 (Explorer rows), Signal's dusk AS with `view.field`.
- **Totals for Sky and Signal:** N1 deletes Sky 251 / Signal 191 (with the features it calls), N2 deletes Sky 201 /
  Signal 134. With the meadow (25) and Signal's fire FX (45) handled by their own rows, both reach zero, matching the
  audit's "With N1–N10, both reach 0."

## 7. What Jake would decide (one recommendation each)

1. **N1 for Sky and Signal means "runtime deleted", not "runtime moved into `runtime/` to close".** Recommend yes: it is
   the only route G465 (2) allows, and it is the only one that stops the double shipping.
2. **Plan rows are unordered; the platform owns the order.** Recommend yes: it keeps `client/plan` data, not a script
   (G445's spirit), and matches how `HybridRuntimePlugin` already works.
3. **Borrowed owners (TS methods by name) are removed, not ported.** Recommend yes (G454 (5)); the four uses become a
   held `finish` row, quest-page stage rows, and a capture-stage row.
4. **N2's scope rule: scene steps only for parts with a handle, a per-part look, or a registry row; everything else is
   props tiles.** Recommend yes; it keeps N2 small and the phone on the cheaper streaming path.
5. **N1-A (entry resolved from `out/`) for Pine, Driftwood, Nalati, Nine.** Recommend: build it only if one of them must
   close before its runtime is gone; otherwise skip it.
6. **The one new AS command** (`view.field 105`, client-only write of a host-private shared field, for Signal's dusk).
   Recommend yes; it is the audit's single new command and has no simulation reach.
