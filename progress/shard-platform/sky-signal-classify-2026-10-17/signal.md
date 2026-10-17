# Signal Dunes: what every remaining line does, and where it belongs

Read-only study of `src/shards/sunscar-dunes/` at HEAD `94fd1d5ab` (2026-10-17), for Jake's question: *"I can't tell what
actually belongs inside of an engine, inside of a game … what is random ass single shot stuff … how to generalize it or
how not to … what part should be assembly script that's completely custom to that one shard."*

A sibling agent covers Sky Reach (`far-reach`). This file covers Signal fully. Where Sky shares a platform module, Sky is
named as the second user.

---

## 0. The answer in one page

**How Signal runs today.** The shardfile already holds almost everything as data: terrain tiles, look graphs, quest
rules, interactions, creature programs, the Matriarch's AssemblyScript, movers, client channels and strings. What still
runs as TypeScript is **one subclass and the view code it calls**. `SignalDunesPlugin extends HybridRuntimePlugin`
(`plugin.ts`) overrides five hooks. Those hooks call 15 small files that draw the tower, caravan, well and braziers, the
fires, the painted sky and the sand skirt, and that ease the dusk.

**The big finding.** About **2,235 lines** of platform code have only Sky and Signal as users at runtime. My
declaration-level import graph found 2,235; the audit's ruler figure is 2,640 (§1). The reason is not that 2,235 lines
are Sky/Signal logic. **Almost all of it is reached through one door, `HybridRuntimePlugin`
(`game/plugin/headless.ts:691`, 326 lines).** Pine and Driftwood subclass the plain `ShardPlugin`. The Template uses no
plugin at all, because the data client runs it from the shardfile. So everything the hybrid host calls looks
"Sky/Signal only": `bindRuntimeHomes`, `bindClientChannels`, `bindDeclaredFight`, `bindBorrowedPageQuestStages`,
`HeldMeleeWeapon` and the rest.

**Host bar (G454's six tests).**
- `HybridRuntimePlugin` scores **1/6**. It is a **SILLY host**: an abstract class that shards subclass with TS hooks. It
  has a Sky noun inline: `mode === 'board'` at `headless.ts:1027` is Sky's hoverboard.
- It addresses shard TS objects from "data" through `{owner, path}` reflection (`game/plugin/borrowed.ts`). An example is
  `armed: {owner:'plugin', path:['places','fire','lit']}`. That is a TS callback in a JSON coat.
- The mechanisms underneath it are mostly real: baked mesh pieces, client channels, card fields, the painted look,
  held-melee playback. They score 3–5/6. What fails them is how shards plug in (TS ports, `owner/path`), not what they do.

**What to do.** Dissolve `HybridRuntimePlugin` into the **data client** (`game/shardfile/client.ts`). Every shard already
uses the data client, and the Template runs on it alone. Signal then declares no runtime entry (N1). Each mechanism the
hybrid host calls becomes a data-client stage driven by a section row, and its users become every shard that declares
the row. Signal's remaining logic is about 20 lines of rules (the dusk per quest step). That goes to AssemblyScript and
needs **one new ABI command**: a write to a host-owned shared state field. Everything else in Signal is data.

**Numbers.**
- Signal counts 372 shard TS + 20 sole-user platform lines = 392 (9.5 %). Code AS today: 118 (matriarch.as + skitterer.as).
- With N1, N2, N7, N8, N9, N10, plus the already-approved painterly look, light emitters and living buildings and the
  boss host (G474/G478): **0 shard TS**. AS becomes ~143 (+~25 for the dusk). Platform: about +560 lines added and about
  −330 deleted (`HybridRuntimePlugin` goes), so about **+230 net**.
- Honest floor without any new approval: **~200 lines** (§12). The floor is set by which hosts Jake approves, not by
  anything Signal-specific. **No Signal TS is irreducibly unique per-frame drawing.**

---

## 1. Method and the line numbers

- **Shard TS.** I count 17 files, 366 nonblank code lines by my comment stripper. The ruler says 372; its parser keeps a
  few lines mine strips. `shard.config.ts` (declaration-only), `discovery.generated.ts` (generated, gitignored),
  `weapons/slots.merge.d.ts` (`.d.ts`) and `generators/` are excluded. Per-file counts are in §4.
- **Platform sole-user (ruler):** 20 lines.
  - `engine/render/families/ground.ts`: `setGroundPools` 11 + `GroundPool` 1.
  - `game/shardfile/runtimeProduct.ts`: `runtimePresentation` 3.
  - `game/shardfile/hybridPresentation.ts`: `hybridPresentation` 3.
  - Small ones such as `format/modes.ts` `LadderMode` 1.
  - My graph also charges `painterLightPatch` (7) to Sky through `paintedLook`. The ruler charges it to Signal. That is a
    borderline call either way.
- **The ~2,640 Sky+Signal-only lines.** I did not run the ruler. I wrote a read-only declaration graph
  (`scratchpad/classify-signal/decls.mjs`, oxc parser from `vite`).
  - It parses every top-level declaration under `src/`, with lexical references between them.
  - It resolves `@wildshard/*` through each package's `exports`.
  - It attributes users through fixpoint propagation.
  - A shard's `generators/` and `test/` count as build-time users, not runtime users.
  - Result: **2,235 runtime declaration lines** whose only live shard users are Sky and/or Signal, plus **65 build-only
    lines** (SDK bake helpers). The gap to 2,640 is lexical-matching noise (my graph over-attributes some declarations to
    Pine) plus the audit counting whole modules. Treat 2,235–2,640 as the range.
  - By module (runtime): `game/plugin/headless.ts` 560 · `game/plugin/ui.ts` 423 · `engine/render/dataLook.ts` 306 ·
    `game/shardfile/bakedKinds.ts` 239 · `game/plugin/weaponFamily.ts` 201 · `sdk/looks/cardField.ts` 71 ·
    `sdk/clientChannels.ts` 62 · `game/shardfile/bossRow.ts` 52 · `game/shardfile/runtimeProduct.ts` 35 ·
    `game/plugin/geometry.ts` (`loadPaintedTexture` + `PaintedSampler`) 29 · `game/plugin/audio.ts` 22 ·
    `game/plugin/bossStorm.ts` 22 · `engine/world/Atmosphere.ts` `weatherFog` 14 · `format/bossProfiles.ts` 14 ·
    `engine/render/families/ground.ts` 12 · `engine/combat/items.ts` 11 · `format/clientChannels.ts` 11 ·
    `game/plugin/simulation.ts` 11 · `game/shard/retainedHooks.ts` 10 · `game/shardfile/hybridPresentation.ts` 10 ·
    `game/shardfile/items.ts` 10 · `game/loot/runtime.ts` 7 · `game/plugin/heldRecipe.ts` (via `heldPresentation`; my graph
    sees Pine/Nalati/Nine reach parts of it, the audit counts it Sky/Signal).
- **Equivalents in other shards:** grep over the live shards (Pine, Driftwood, Nalati, Nine, Template), excluding the
  `-legacy` folders.

---

## 2. The layer rules (restated) and the host bar

**Layers** (AGENTS.md "Engine layers", ENGINE.md E405, G453/G454/G465/G470):
- **ENGINE (`src/engine`)** knows rendering, physics, input, audio, boot and levels in general. It never knows the game,
  Wildshard, shards or content; content arrives as data. Only engine words appear in it.
- **GAME (`src/game`)** knows it is Wildshard and that shards run arbitrary content. It holds concepts and hosts that two
  or more shards share, or that Jake approved as platform (G473–G478 "from day one"), driven by rows.
- **SHARD DATA:** JSON, sections, GLB, look-graph JSON, generator output, with zero runtime code. `generators/` and
  build-only `data/*.ts` are build time and never count (G448, G467).
- **SHARD ASSEMBLYSCRIPT:** rules, decisions and story logic unique to the shard, run by the AS decision host at decision
  rate (events, ≤ 10 Hz; G454 (7)). Scripts call ABI commands, keep state declared in the section (G455 (7)) and ship
  with a seeded scenario test (G455 (4)).
- **SHARD VIEW CODE:** per-frame drawing or page wiring unique to the shard and not worth a host. It is named honestly
  as such.
- **Single-shot:** one use and no plausible second user. It becomes data, AS or listed view code, never a new engine host.
- G453 (1): **simulation never lives in `runtime/`**.

**HOST BAR**, G454 (1) plus (5); the coordinator's six tests:

| # | Test | Fails when |
|---|---|---|
| T1 | Two real users | only one shard calls it, or the second is hypothetical |
| T2 | No shard nouns | a shard name, a shard's object or a shard's mode or constant appears in code or contract |
| T3 | Data-driven | shards differ by TS (ports, callbacks, overrides, shard-shaped parameter lists), not only rows |
| T4 | Server-safe, or labelled client-only | sim and presentation are mixed with no label, or it needs a renderer for sim |
| T5 | Deletion test | you would delete it if its first shard vanished |
| T6 | G454 (5): data-only API, per-shard hooks are AS script references | TS callbacks, subclass overrides, or `{owner, path}` reflection into shard objects |

---

## 3. How Signal runs, stage by stage

Each stage is tagged with where it should live.

```
manifest.json → discovery.generated.ts (generated)
  ground:  boot/ground.ts GROUND ............................ [data: manifest JSON / product ground]
  render:  look/render.ts signalDunesLook() ................. [painterly look host G478 + N8 + light emitters]
  roster:  roster.ts roster() ............................... [N10 explorer catalogue rows]
  load:    plugin.ts → runtime/index.ts SunscarAudioRuntime . [N1 declared runtime entry]

HybridRuntimePlugin (game/plugin/headless.ts) runs, in order:
  world():  rows(product)            ← plugin.ts rows()      [data client reads sections]
            sim/scripts wasm bytes                              (Matriarch decision module)
            ctx.strings(ui/strings)
            build(ctx)               ← plugin.ts build():
               DUNE_LIBRARY.preload(), WORLD.load()           [data client: library + bakes]
               prepareFireFx()                                [N7 fire emitters]
               buildWorld()  (world/build.ts)                 [N2 world scene + interactions + emitters]
               lentMaterial + SKIRT.wear/fit                  [N8 terrain skirt]
  kit():    weapon row, species program (admitSpeciesProgram), encounters,
            createMelee (held whip from runtimeRows.melee)    [held melee host + data client items]
  play():   viewmodel add, dress(whip) ← plugin.ts dress()   [painter light on held models: look row]
            boot pitch, item contexts, audio, loot
            installBorrowedPageQuest  (owner/path presentation)  [quest step runner G474 + scene parts]
            clientMotion: bindClientChannels.installMovers    [data client movers (DW already)]
            install(ctx) ← plugin.ts install():
               whip contacts → world targets                  [world/targets section]
               bindPageFight (Matriarch, spawned)             [boss host G474]
               populate (runtime.spawns homes + holds)        [spawn director G474]
               dusk: setDusk(duskOf()), stepDusk(dt)          [AS + N9 eased field]
```

---

## 4. Every counted shard file

Line counts are my code lines (the ruler is about +6 in total).

### 4.1 `plugin.ts`: 66 lines, the hybrid subclass

**What it does.** It is Signal's page plugin. It assembles the host rows from the product, preloads the model library and
baked world, compiles the fire graphs, builds the world, lends the data client's sand material to the skirt, rims the
whip, binds the boss fight, spawns the creatures, and eases the dusk every frame from the quest flags.

```ts
function duskOf(places: SignalWorld): number {
  const f = places.flags;
  if (f.has(flags.FLAG.lit)) return 1;
  const lit = places.braziers.filter((b) => b.lit).length;
  if (lit > 0) return 0.5 + 0.12 * lit;
  return f.has(flags.FLAG.oil) ? 0.56 : f.has(flags.FLAG.logbook) ? 0.52 : f.has(flags.SCOUT_FLAG) ? 0.5 : 0;
}
...
  protected rows(product: ShardProduct): HybridRuntimeRows {
    const { page, program } = product.section('actors/species-programs');
    const stages = product.section('quests/directors').directors?.find(row => row.id === SIGNAL_RUNTIME_ROWS.fight.stages.id);
    ...
    return { ...SIGNAL_RUNTIME_ROWS, strings: product.section('ui/strings'), fight: { ...SIGNAL_RUNTIME_ROWS.fight, stages }, species: {...}, owners: { ...WHIP_HELD_OWNERS, models: DUNE_LIBRARY, looks: { dress: lastLightAll } } }; }
...
      ctx.system({ id: 'sunscar.dusk', phase: 'update', run: (dt) => { setDusk(duskOf(places)); stepDusk(dt); } });
```

**Who calls it and when.** The manifest `load` binding constructs it (`firstPartyStandaloneEntry`). The host calls
`world`, `kit` and `play` at boot. The `sunscar.dusk` system runs every frame. `settleQuestDusk` is called by a
quest-capture row (`pageQuest.capture.dusk`).

**Equivalents.**
- `pine-hollow/runtime/index.ts` (291) `class PineHollow extends ShardPlugin`.
- `driftwood-isle/runtime/index.ts` (110) `class DriftwoodPlugin extends ShardPlugin`.
- `nine-dragon-stack/plugin.ts` (160).
- `far-reach/runtime/index.ts` (170) `extends HybridRuntimePlugin`.
- `_template` has **no plugin**: `native: {}` in its discovery, and the data client runs it. Every shard has the same
  hooks with different bodies, which is the sign that the hooks themselves are the thing to remove.

**Classification.**
- `rows()`, `build()`, `dress()` and `install()` are glue. **Delete under N1:** the data client already reads `ui/strings`,
  `actors/species-programs`, `quests/directors`, `runtime.spawns`, movers and items for data-only shards.
- `duskOf` is **shard AS**. It is Signal's story rule (the quest step sets the time of day), event-driven, with no
  per-frame need.
- The per-frame ease (`stepDusk`) is a **generic host** mechanism (N9).

**Target form.** No plugin file. `duskOf` goes to `behaviour/dusk.as` (§7). The whip rim becomes the painted look row's
`light.scope` applied to held and spawned models (§4.11). The rest is data-client stages (§6, N1).

**Lines.** −66 shard. AS +~20. Platform: covered by N1.

### 4.2 `runtime/index.ts`: 2 lines

```ts
export default class SunscarAudioRuntime extends SignalDunesPlugin {}
```

**What it does.** It is the grid's trusted runtime entry (`runtime.entry: "runtime/index.ts"` in the shardfile).
**Equivalents:** Sky `far-reach/runtime/index.ts`, Nine `runtime/index.ts` (5). **Classification:** delete under N1.
**Lines:** −2.

### 4.3 `runtime/source.ts`: 3 lines

```ts
import rows from '../data/product.generated.json' with { type: 'json' };
export default parseShardfile(rows);
```

**What it does.** It parses the generated product a second time inside the app bundle. That is the audit's "product ships
twice". Its users are `models/gear.ts` (the Explorer, which has no `ctx`) and `world/fireFx.ts` (type only).

**Equivalents:** Sky `far-reach/runtime/source.ts` (5).

**Classification:** delete. The Explorer should take `ShardProduct` (the roster factory already receives `product`:
`callWithProduct` in discovery). **Lines:** −3, and it removes one generated-JSON runtime import (of Signal's 14).

### 4.4 `runtime/items/heldWhip.ts`: 5 lines

```ts
export const WHIP_HELD_OWNERS={world:WORLD,library:DUNE_LIBRARY,surface:{decorate:heldSurface}};
export type Bullwhip = ReturnType<typeof createDeclaredHeldMelee>;
```

**What it does.** It names the TS objects the held-whip recipe reaches into by `{owner, path}`, for example
`{"owner":"library","path":["hd"],"args":["glove-hd4",…]}` and `{"owner":"world","path":["geometry"],"args":["lash","coil"]}`
in `runtimeRows.melee.recipe.resources`.

**Equivalents:** Sky `runtime/weapons/heldFan.ts` (6, `FAN_HELD_OWNERS`). Driftwood's sword uses `game/weapons/Sword` with
no owner map. Pine's tools use `HeldPlayback` (`pine-hollow/runtime/kit/heldTool.ts`).

**Classification:** delete. The recipe's resources should name **assets** (a geometry pack key, a library model id), which
the held host resolves from the product library, not shard objects.

**Target form.**
```json
"resources": { "geometry": [{ "id": "coil", "from": { "bake": "lash", "kind": "coil" } }],
               "reads": [{ "id": "hero", "from": { "model": "glove-hd4", "fit": { "size": 0.14, "by": "span" } } }],
               "decorators": [{ "id": "coil", "surface": "coil-viewer-light" }] }
```
**Lines:** −5 shard. Platform about +15 (`from` variants in `heldRecipe.ts`).

### 4.5 `runtime/looks/bakedGround.ts`: 37 lines (view code with a generic mechanism; N8)

```ts
export class CubeSkirt {
  async load(parent: Object3D, pack: { url: string; rows: PackedGeometryJson & { cubeHalf: number }; fault: string }, scope: Scope) {
    const geometries = new GeometryPack(await fetchDeflated(pack.url), packedRows(pack.rows), 'skirt');
    standalone = geometries.geometry(0); cube = geometries.geometry(1); ...
  }
  wear(material: Material, order = 0): void { ... held.mesh.material = material; held.mesh.renderOrder = order; held.parent.add(held.mesh); }
  fit(half: number): void { ... held.mesh.geometry = held.scope.own(held.cube); old.dispose(); }
}
export function lentMaterial(source: Shardfile, id: string, scope: Scope, state: (...) => number | undefined): Material | null {
  const lent = runtimePresentation(source); if (lent === null) return null;
  scope.onDispose(lent.bindState(state)); return lent.material(id);
}
```

**What it does.** It draws the baked dune "skirt" past the 500 m cube edge (G99) in the same sand material the data
client draws the terrain tiles with, and swaps in the cube-cut version inside a grid cell. `lentMaterial` borrows the data
client's material so the skirt and the fires share it.

**Who calls it.** The look's `terrain.build` (load, at boot) and `plugin.build` (wear and fit, at world time).

**Equivalents.** No shard has a baked skirt in a terrain material. Nalati builds a "concave scree skirt" apron in TS
(`nalati-grasslands/world/terrain.ts:165`). Every shard is a 500 m cube (G99), so every terrain shard needs an edge. The
grid far proxy (`game/grid/shardfileFar.ts`, shardfile `far`) is a related existing mechanism, but it is seen only from
neighbouring cells.

**Classification.** Generic mechanism ("Nothing here knows a shard", and it does not), but **one user today** (T1 fails).
It is borderline **game host** if the terrain section grows a skirt row and the data client draws it in the terrain
family material, which also removes `lentMaterial`. Otherwise it stays as listed view code.

**Target form (N8).** A `terrain.skirt` row in the shardfile terrain section:
```json
"terrain": { "...": "...", "skirt": { "file": "<hash>", "cubeCut": 1, "cubeHalf": 250, "order": 0 } }
```
The data client's terrain view loads it and wears the tile material, so no lending is needed.

**Lines.** −37 shard. Platform about +35 (moved, not new). It also deletes the platform sole-user lines
`runtimePresentation` 3 and `hybridPresentation` 3, and the `bindState` lending path for Signal.

### 4.6 `boot/ground.ts`: 5 lines

```ts
export const GROUND = { paths: 'plugin', terrain: createBakedTerrainField({key: 'sunscar-dunes', seed: LAYOUT.SEED},
  buildTerrain(LAYOUT.SEED, {landscape: () => 0, trails: LAYOUT.TRAIL as [number, number][][], cabinSites: []})) } as const;
```

**What it does.** It is the manifest's required native `ground`: a flat analytic field (`landscape: () => 0`) with the
authored trails, wrapped as a baked terrain field. The real ground is the shardfile collider, which the data client and
`installProductGround` read.

**Equivalents.**
- Driftwood `boot/ground.ts` (`createBakedTerrainField(DRIFTWOOD_TERRAIN, …)`, a real height field).
- Pine `world/terrain.ts`.
- Sky declares ground **as JSON** in its manifest: `"ground": {"structures": true, "paths": "plugin"}` (`far-reach/manifest.json:159`).

**Classification:** shard data, or delete. Signal's field carries no height (it is zero), so it is the same as Sky's
structures-only JSON. The trails are already in `layout.generated.json` and the minimap palette.

**Target form:** `"ground": { "structures": true, "paths": "plugin" }` in `manifest.json`. Verify first that no reader
needs the trail-graded `terrain` (the minimap reads `mapPalette`). **Lines:** −5.

### 4.7 `data/placeBindings.ts`: 6 lines

```ts
export const PLACE_BINDINGS = {
  caravan:{root:'group',colliders:'colliders',logbookAt:'vector',lampAt:'vector'},
  well:{root:'group',colliders:'colliders',bucket:'group',rope:'mesh',jar:'mesh',crankAt:'vector',jarAt:'vector',drop:'number'},
  tower:{root:'group',colliders:'colliders',fire:'group',light:'point-light',brazierAt:'vector',deckY:'number'},
  brazier:{root:'group',colliders:'colliders',fire:'group',oil:'mesh',bowlAt:'vector',glowAt:'vector'},
} as const;
```

**What it does.** It is the typed contract `bindWorldSceneParts` checks the scene recipe against, so `world/build.ts` gets
`tower.light` as a typed `PointLight`.

**Equivalents:**
- Sky `world/shapes.ts` and `world/mill.ts` (scene binders).
- Driftwood `runtime/npc/Castaway.ts` and `Trader.ts` (`bindWorldSceneParts`).

**Classification:** delete under N2. It exists only because TS code reaches into scene parts by field. If interactions,
emitters and visibility address parts by scene id (`"tower/fire"`), no TS needs the typed contract. **Lines:** −6.

### 4.8 `look/dusk.ts`: 11 lines (eased shared field; N9 + AS)

```ts
export const DUSK = { value: 0 };
const state = { target: 0 };
const RATE = 0.02;
export function setDusk(target: number, snap = false): void { state.target = Math.min(1, Math.max(0, target)); if (snap) DUSK.value = state.target; }
export function stepDusk(dt: number): void { const d = state.target - DUSK.value; DUSK.value += Math.sign(d) * Math.min(Math.abs(d), RATE * dt); }
```

**What it does.** It holds the time-of-day scalar 0…1. Every frame it moves toward a target at 0.02/s (~50 s per step).
The sky dome, key/fill light, fog, sand curves (through `shared.dusk`) and camp surfaces read it.

**Who calls it.** `plugin.ts` (target every frame, snap on entry). Readers: `look/render.ts` (`state: DUSK`),
`world/meshes.ts` (surface inputs) and `plugin.build` (`lentMaterial` state port).

**Equivalents.**
- Pine weather: `pine-hollow/data/weatherLook.ts`, `sdk/looks/overcast.ts`, `sdk/looks/daySky.ts`
  `driveDayAir`, all eased targets on look fields.
- Nalati `look/skyRig.ts` (G441 audit row). G474 approved "weather reactions plus keyed sky".
- The shardfile already declares the field: `state.shared: [{name:'dusk', type:'f64', privacy:'host', min:0, max:1}]`.

**Classification.** The ease is a **generic game host**: "a host-owned shared state field that eases toward a target".
It folds into G474's weather/keyed sky. The target rule is **shard AS**.

**Target form (N9).** A field row gains an ease, and the host steps it every frame and publishes it to graphs and looks:
```json
"state": { "shared": [{ "id": 1, "name": "dusk", "type": "f64", "privacy": "host", "default": 0, "min": 0, "max": 1,
                         "ease": { "rate": 0.02, "snapOnEnter": true } }] }
```
```ts
// game/shardfile/clientState.ts
interface EasedFieldRow { readonly rate: number; readonly snapOnEnter?: boolean }
export function installEasedFields(source: Shardfile, ctx: { scope: Scope; system: SystemFn }): { read(scope: 'shared', name: string): number | undefined; target(name: string, value: number, snap?: boolean): void };
```
**Lines:** −11 shard. Platform about +30.

### 4.9 `look/render.ts`: 22 lines (painterly look host G478 + N8 + light emitters)

```ts
export const SAND: { material: Material | null } = { material: null };
export const SKIRT = new CubeSkirt();
export function signalDunesLook(): LookStrategy {
  return paintedLookFromRow(parsePaintedLookRow(rows.look), { load: loadPaintedTexture, state: DUSK,
    terrain: {
      build: async (terrain, field, scope) => { await SKIRT.load(terrain.group, { url: rows.sand.skirt, rows: skirtRows, fault: '…' }, scope); await field.ready(); },
      update: () => { if (SAND.material !== null) setGroundPools(SAND.material, FIRE_LIGHTS.value); },
    } });
}
```

**What it does.** It builds the engine painted look from `paintedLook.generated.json` (sky strips, painter light, key/fog
curves riding `DUSK`). It passes two TS callbacks: load the skirt, and push the four fire positions into the sand
shader's light pools every frame.

**Equivalents:**
- Sky `look/render.ts` (54) builds the same `paintedLookFromRow` with a TS `dressing` callback (cards, discs).
- Nalati's `engine/world/painterly.ts` is the third painterly look (G478 folds it in).
- Pine and Driftwood use the shardfile look (`game/shardfile/look.ts` `shardfileLook`, day keys).

**Classification:** delete. G478 already approved one **painterly look host** for Nalati, Sky and Signal. The terrain
callbacks go to N8 (skirt) and the light-emitter host (pools).

**Target form.** A `look.painted` row (the existing `DuskLookRow`, already JSON) plus `state: "shared.dusk"` (a field
name, not a TS object) plus `pools: "emitters"`:
```json
"look": { "painted": { "...DuskLookRow...": "...", "state": { "field": "shared.dusk", "curves": { } }, "groundPools": { "source": "emitters" } } }
```
**Lines:** −22.

### 4.10 `look/light.ts`: 12 lines

```ts
export function lastLightAll(root: Object3D, scope: Scope): void {
  const seen = new Set<MeshStandardMaterial>(), light = parsePaintedLookRow(rows.look).light;
  root.traverse((o) => { ...
    for (const m of list) if (m instanceof MeshStandardMaterial && !seen.has(m) && m.userData['sunscarNoRim'] !== true) { seen.add(m); painterLightPatch(m, light, rows.painterSun, scope); }
  });
}
```

**What it does.** It patches the painter's rim/bounce/floor light into every standard material under a root: world props,
the whip, spawned creatures, quest NPC models. `sunscarNoRim` is a shard-named opt-out for the whip coil.

**Callers:** `world/build.ts` (all props), `plugin.dress` (whip), `plugin.install` `spawned` (creatures), and the quest
page `dress` row (through `owners.looks.dress`).

**Equivalents.** Sky applies its painter light page-wide: `lightScope: 'page'` in `paintedLookFromRow`. Signal uses
`'material'` so only props get it.

**Classification:** delete. The painted look row already has `lightScope`. The host applies the material-scope patch to
everything the data client places (props, held models, spawned bodies, NPC models), so there is no callback. The opt-out
becomes a scene/material row flag `rim: false`, with no shard name in userData.

**Lines:** −12 shard. Platform about +10.

### 4.11 `world/baked.ts`: 11 lines

```ts
export interface KindRow extends BakedMeshKindRow { readonly warm?: boolean; readonly brazier?: number }
export const WORLD = bakedMeshWorld<BakedPiece, KindRow>(WORLD_ROWS, MODELS.BAKED_URLS, 'sunscar-dunes',
  { resources: MODELS.WORLD_BYTES, readBytes: fetchDeflated, placements:{rows:SIGNAL_PIECES,colliders:WORLD_ROWS.braziers.braziers.map((row,index)=>({id:`sunscar.brazier.${String(index)}`,colliders:row.colliders}))},
    decorate: (material, kind) => { if (kind.warm === true) warmByFire(material); } });
```

**What it does.** It loads the offline-baked world pieces (tower frame, rock field, dressing, place parts) as static GLBs
with rows for materials and colliders. A kind marked `warm` gets the firelight surface look.

**Equivalents:**
- Sky `world/baked.ts` (35) uses the same `bakedMeshWorld`.
- Pine, Driftwood and the Template put static world props in the shardfile `props` section, drawn by the data client
  (`clientWorld.ts`, `clientViews.ts`). Signal's `props` is `null`.

**Classification:** delete. It should be shardfile props, or a `world/bakes` section the data client draws. The `warm`
decorate callback becomes a per-kind `surface: "firelight"` row (the surface-look host already exists,
`game/systems/looks/surfaceLooks.ts`, used by 6 shards).

**Target form:**
```json
{ "piece": "rocks", "file": "<hash>", "kinds": [{ "name": "sandstone", "color": 12345, "roughness": 0.9, "surface": null },
                                             { "name": "plank", "surface": "firelight" }],
  "colliders": [{ "kind": "box", "x": 0, "y": 1, "z": 0, "hx": 1, "hy": 1, "hz": 1, "surface": "rock" }] }
```
**Lines:** −11.

### 4.12 `world/meshes.ts`: 14 lines

```ts
const SURFACE_INPUTS = { lights: FIRE_LIGHTS, dusk: DUSK };
export const DUNE_LIBRARY = createModelLibrary({ ...MODELS.DUNE_MODELS, geometryPools: REST_POOLS, rigs: runtimeRows.species.library }, '[sunscar-dunes]', SURFACE_INPUTS);
export const warmByFire = (m: MeshStandardMaterial): void => { applySurfaceLooks(m, SURFACES.CAMP_SURFACE, SURFACE_INPUTS); };
export const heldSurface = (m: MeshStandardMaterial, looks: readonly SurfaceLook[]): void => { applySurfaceLooks(m, looks, SURFACE_INPUTS); };
```

**What it does.** It builds the model library (Hunyuan GLBs, HD models, geometry pools, creature rigs) from generated
JSON, and gives surface looks the live inputs (fire slots, dusk).

**Equivalents:** Sky `world/meshes.ts` (26, two libraries). Pine (`world/treeFactory.ts` `treeLibrary`) and Nalati also
call `createModelLibrary`. The data client has its own `clientLibrary.ts`.

**Classification:** delete. The library is the shardfile `library` section (the data client loads it). The surface inputs
are host fields (`shared.dusk`) and emitter pools, not TS objects. **Lines:** −14.

### 4.13 `world/places.ts`: 29 lines (N2 world scene host)

```ts
export function buildPlace<Id extends Place>(id:Id,baked:BakedWorld,index=0,colliders?:ColliderDesc[]):Parts<Id> {
  const rows={...REST_SCENES.bindings,brazier:REST_SCENES.bindings.braziers[index]},row=rows[id];
  const embers:MeshStandardMaterial[]=[], objects=new Map(row.lights.map(light=>[light.id,new PointLight(light.color,light.intensity,light.distance,light.decay)]));
  const made=createWorldScene(row.recipe,{geometry:DUNE_LIBRARY.geometry,model:DUNE_LIBRARY.model,objects,
    baked:(piece,only,each)=>WORLD.object(piece,only,each,baked),materialCollectors:new Map([['embers',(material)=>{embers.push(material);}]]) });
  const parts=bindWorldSceneParts(made,PLACE_BINDINGS[id],row.fields);
  for(const effect of [...row.lamps,...row.fires]) { ... if('fire' in effect.rows)addFire(group,effect.rows,pool);else addLampGlow(group,effect.rows,pool); }
  const light=row.glowAt===null?null:fireLight(new Vector3().fromArray(row.glowAt));
  return Object.assign(parts,{colliders:colliders??parts.colliders,glow:(lit:boolean)=>{light?.(lit);for(const ember of embers)ember.emissiveIntensity=lit?1.1:0;}});
}
```

**What it does.** It assembles one place (tower, caravan, well, brazier) from a declared scene recipe
(`restScenes.generated.json`): imported models and baked pieces, point lights, fire and lamp effect anchors, and a
`glow(lit)` switch that turns on a firelight slot and the ember emissive.

**Callers:** `world/build.ts` (page) and `models/gear.ts` (each Explorer specimen).

**Equivalents:**
- Sky `world/shapes.ts` (31), `world/mill.ts` (17) and `world/build.ts` (138) on the same `createWorldScene`.
- Pine `runtime/props/buildingLife.ts` (doors, fire pits, lanterns with `SiteLights`) and `runtime/world/cabins.ts`.
- Driftwood `runtime/models/fixedSites.ts` (hut with flames).
- These are the G474 **living buildings** (approved).

**Classification:** delete under N2 (world scene assembly as a data-client stage). The fires go to N7 / light emitters,
and the glow to emitter on/off by scene id.

**Target form (N2), as a `world/scenes` row:**
```json
{ "id": "sunscar.brazier.0", "recipe": { "...WorldSceneRecipe...": "..." }, "piece": "sunscar.brazier.0",
  "emitters": [{ "part": "bowl", "kind": "fire", "fx": "fire.waymark", "light": { "gain": 1 }, "embers": "embers" }],
  "colliders": "sunscar.brazier.0" }
```
**Lines:** −29.

### 4.14 `world/fireFx.ts`: 45 lines (N7, folded into light emitters)

```ts
export const FIRE_LIGHTS = { value: [new Vector4(), new Vector4(), new Vector4(), new Vector4()] };
export async function prepareFireFx(ctx, shard, library): Promise<void> {
  const ids = Object.values(FIRE_GRAPH_IDS), looks = await prepareClientWorld(ctx, shard, { materials: ids, requiredMaterials: ids }, library);
  let time = 0;
  looks.graphs.bind({ state: (scope, name) => scope === 'shared' && name === 'firetime' ? time : undefined });
  ...
}
export function addFire(group: Group, input: unknown, pool: BufferGeometry | null = null): Object3D[] {
  const f = current(), rows = schema.parse(fireRows, input), parts = place(group, rows.fire, null);
  const embers = effectField(rows.embers, f.embers), sparks = embers.object; ...
  return [...parts, sparks, ...place(group, rows.smoke, pool)];
}
export function fireLight(at: Vector3): (lit: boolean, gain?: number) => void { ... v.set(at.x, at.y, at.z, 0); return (lit, gain = 1) => { v.w = lit ? gain : 0; }; }
```

**What it does.**
- It compiles the fire's look graphs (flame, wisp, glow, smoke, embers, ground pool), bound to `shared.firetime`.
- It places card groups (camera-facing quads, `sdk/looks/cardField`) and a seeded ember point field
  (`sdk/looks/effectField`) at each fire anchor.
- It runs a 4-slot "firelight" uniform (`xyz` position, `w` gain) that surface looks and the sand's ground pools read.
- About 4 draws per fire, all on the GPU, with no CPU particles.

**Callers:** `plugin.build` (prepare), `world/places.ts` (add), `world/build.ts` (lantern slot, `tickFires` every frame)
and `look/render.ts` (pools).

**Equivalents:**
- Pine fire pits and lanterns (`runtime/models/stoneFirePit`, drawn by `buildingLife.ts` with `SiteLights`).
- Driftwood hut flames (`fixedSites.ts:101` `hut-flames`).
- Nine lantern light pools (`nine-dragon-stack/runtime/looks/light.ts`, uniform pools on the wet floor). This is the
  **light emitters** feature G478 approved (~190, Nine).
- Sky's sun glow uses `cardGroup` too.

**Classification.** A **game host** feature. "An emitter is a light-pool slot plus optional card and ember FX, its clock a
host field." It has three real users once Pine's fire pits and Nine's lanterns adopt it.

**Target form (fold N7 into G478 light emitters):**
```ts
// game/systems/looks/emitters.ts
interface EmitterRow { id: string; at: [number,number,number] | { part: string }; kind: 'fire' | 'lamp' | 'neon';
  light?: { gain: number; flicker?: { waves: [number, number, number][] } }; pool?: { geometry: string; material: string };
  cards?: CardGroupRow; embers?: EffectFieldRow; clock?: string /* host field, e.g. shared.firetime */; initially: boolean }
export function installEmitters(rows: readonly EmitterRow[], ports: { scope: Scope; library: ModelLibraryLike; graphs: GraphMaterials; system: SystemFn }):
  { set(id: string, on: boolean): void; pool: { readonly value: readonly Vector4[] } /* read by ground + surface looks */ };
```
Signal declares 5 fire emitters, 1 lantern and the tower fire. Quest rows switch them with `{kind:'emitter', target, on}`.

**Lines:** −45 shard. Platform about +60 (some of it moved from here).

### 4.15 `world/build.ts`: 74 lines (N2 + existing interactions + emitters)

```ts
const pieces = WORLD.placements(ctx.piece, ctx.root, baked);
const tower = pieces.add('sunscar.tower', buildPlace('tower',baked)), caravan = pieces.add('sunscar.caravan', buildPlace('caravan',baked)), ...
const [logbook,firePrompt] = createQuestPagePrompts(source,new Map<string,unknown>([['caravan',caravan],['tower',tower]]),['logbook','fire']);
const channels = keepChannels(bindClientChannels(programs, { nativeOwners: ['sunscar.well.bucket'], targets: new Map([['bucket', wellParts.bucket], ['rope', wellParts.rope]]) }));
channels.bindPrompts({ named: new Map([['sunscar.well.take', () => { page('well'); }]]) });
...
const fireCaught = (caught: SignalFire): void => { caught.tower.fire.visible = true; caught.tower.light.intensity = TOWER_LIGHT; caught.brazier.label = STRINGS.lit; };
const presentation = bindQuestPageInteractions(source, { flags, rules,
  owners: new Map([['world',{logbook,well,braziers,fire}],['motion',channels],['commands',{catchFire:()=>{fireCaught(fire);}}]]), ... }, ctx.product.section('world/targets'));
...
const wayLights = new SiteLights({ flicker: { depth: 1, waves: [[11, 0, 0.07], [23, 1, 0.05]] } });
ctx.system({ id: 'sunscar.fire', phase: 'update', run: (_dt, t) => { ... tickFires(t); wayLights.step(t, me); ... tower.light.intensity = TOWER_LIGHT * flick; } });
```

**What it does.**
- It places the four places and the rock and dressing bakes and registers them.
- It makes the quest prompts at scene anchors and binds the well bucket's client channels and the "take oil" prompt.
- It exposes `oiled`, `lit` and `raised` getters over the declared interaction rules (`InteractionRules`).
- It wires the quest page presentation by `{owner, path}` into its own objects: `world.braziers[0].spot.onInteract`,
  `commands.catchFire`.
- It runs one roaming waymark point light (`SiteLights`) and the tower flicker every frame.

**The quest logic is already data.**
- `generators/signalInteractions.ts`: `needs: [{all:['raised'], else:'unraised'}]`, `sets: [FLAG.oil]` and so on.
- `generators/questPageInteractions.ts`: actions `visible`, `label`, `toast` and `call` with `initial` rows.

What remains in TS is only (a) holding scene parts so the data can reach them by path, (b) `catchFire`, which is three
property writes, and (c) constants: `TOWER_LIGHT = 14`, `WAY_LIGHT = 9`, `LANTERN_LIGHT = 5`, lantern gain 0.22 and the
flicker waves.

**Equivalents:**
- Sky `world/build.ts` (138), the same shape.
- Pine quest presentation (`pine-hollow/quest/index.ts` uses `bindQuestPageInteractions`).
- Driftwood `runtime/npc/*.ts`.
- `SiteLights` is engine (`engine/fx/SiteLights.ts`) with Pine `buildingLife.ts` as the other user.

**Classification:** delete under N2 plus the data client's interactions plus emitters. The constants are emitter-row data.
The roaming light is a `SiteLights` row (engine; already two users).

**Target form.** The presentation rows address **scene parts and emitters by id** instead of TS paths:
```json
{ "id": "light.0", "interaction": "light.0",
  "before": [{ "kind": "visible", "part": "sunscar.brazier.0/fire", "value": true },
             { "kind": "emitter", "target": "sunscar.brazier.0.bowl", "on": true },
             { "kind": "label", "prompt": "brazier.0", "text": "@waymarkLit" }] }
```
`catchFire` becomes
`[{kind:'visible',part:'sunscar.tower/fire',value:true},{kind:'emitter',target:'sunscar.tower.fire',on:true},{kind:'label',prompt:'fire',text:'@lit'}]`.

**Lines:** −74.

### 4.16 `models/gear.ts` (13) and `roster.ts` (11): Model Explorer catalogue (N10)

```ts
export const GEAR_MODELS = modelCatalogue(GEAR_SCENE_ROWS,{owners:new Map([...Object.entries(WHIP_HELD_OWNERS),['npcModels',DUNE_LIBRARY]]),source,builds:[
  ['tower',()=>buildPlace('tower',WORLD.last()??new Map())], ['caravan',…], ['well',…], ['brazier',()=>buildPlace('brazier',WORLD.last()??new Map(),0,[])],
]});
export const ROSTER = [ ...GEAR_MODELS.slice(0,1).map(model=>live(model)), ...DUNE_LIBRARY.models(SIGNAL_MODEL_SPECIMENS).map(model=>live(model)),
  ...GEAR_MODELS.slice(5).map(model=>live(model)), ...GEAR_MODELS.slice(1,5).map(model=>live(model)) ];
```

**What it does.** It is the Model Explorer roster: the whip, creature specimens (`creatureModels.generated.json`), and
the four places built by the same scene binder, in a hand-ordered slice order.

**Equivalents:** every shard has `roster.ts`: Pine (55), Driftwood (39), Nalati (44), Nine (10), Sky (7) plus
`models/gear.ts` (13). `game/plugin/geometry.ts` `modelCatalogue` is multi-user.

**Classification:** delete under N10. The roster is a list of specimen rows (scene id, held recipe id, library model id,
framing) in display order. The Explorer builds each through the same hosts the page uses.

**Target form:**
```json
"explorer": [{ "kind": "held", "id": "weapon.sunscar-whip" }, { "kind": "species", "id": "duneRay" }, …,
             { "kind": "scene", "id": "sunscar.tower", "frame": { "distance": 18 } }]
```
**Lines:** −24.

### 4.17 Excluded TS (not counted, listed for completeness)

- `shard.config.ts` (5): re-exports `generators/product`. Declaration-only, so the build entry stays. **Keep.**
- `discovery.generated.ts` (26): generated by `scripts/gen-shards.mjs`. It inlines `budgets` and `mapPalette` as literals
  and binds `ground`, `render`, `roster` and `load`. It goes when the native bindings go (N1, N10, ground JSON). **Generated.**
- `weapons/slots.merge.d.ts` (9): merges `'sunscar-whip'` into the engine's `EquipmentSlotMap` so a legacy save's held
  weapon carries over. It is a shard name in an engine type, but types only. It goes when legacy-slot carry-over becomes
  a save-migration row (G453 (6) "no format back-compat"). **Single-shot: delete with save migration.**

### 4.18 AssemblyScript already in the shard (not TS; 118 AS lines on the ruler)

- `behaviour/matriarch.as` (53): the Dune Matriarch's decisions on ABI v1.
  - Events: `onStart`, `onStop`, `onThreshold`, `onTimer`, `onMoveDone`, `onStrikeDone`, `onDeath`.
  - Commands: `Do.move`, `Do.strike`, `Do.stop`, `Do.timer`. Reads: `Read.nearestPlayer`.
  - State: `step` (i32, binding scope) = phase × 10 + mode.
  - Declared in `generators/rows/matriarchDecision.ts` (`on`, `reads`, `commands`, `moves`, `strikes`, `params`, `state`).
  - **This is the model for every other Signal rule.**
- `behaviour/skitterer.as` (78): the sand skitterer as an **ABI v0** species script. It uses raw memory offsets
  (`in_ptr 16384`, `out_ptr 24576`), `on_tick` every think and act step, and host math through `query(1)`.
  - It runs **per tick, not at decision rate.** It is steering at 30–60 Hz (`steer(yaw, speed, turn)` every act phase),
    which is outside G454 (7)'s "decisions only, ≤ 10 Hz".
  - Honest note: this is per-frame locomotion in Wasm. Under the G454 split it should become a generic steering
    behaviour row (burrow, burst, ring-hunt, retreat: a "pack ambusher" mode table) run by the engine, with AS only choosing
    the state at decision rate.
  - Second-user test: Pine wolves and Nalati wolves circle the player in packs (`nalati … wildlife.ts#spawnPack`).

---

## 5. The platform modules only Sky and/or Signal use, each graded

Lines are declaration lines from my graph. File:line points to the evidence.

### 5.1 `game/plugin/headless.ts` `HybridRuntimePlugin` (326) + `HybridRuntimeRows` (32) + helpers (~200): **1/6, SILLY**

**What it does.** It is an abstract `ShardPlugin` that runs a fixed stage order for a "hybrid" shard:
1. world: rows → wasm → strings → `build()`.
2. kit: weapon → species program → encounters → held melee → `prepare()` → equipment.
3. play: viewmodel → `dress()` → pitch, input, contexts → audio → loot → page quest → movers → `install()`.

It also owns population homes, held bodies, the boss record, quest capture and debug aliases.

```ts
export abstract class HybridRuntimePlugin extends ShardPlugin {                        // headless.ts:691
  protected abstract rows(product: ShardProduct): HybridRuntimeRows;                  // :693
  protected abstract build(ctx: ShardContext): Promise<void> | void;                  // :846
  protected abstract install(ctx: ShardContext, loot: ScopedLoot | null): Promise<void> | void; // :884
  protected prepare(_ctx: ShardContext): void { /* none by default */ }               // :886
  protected dress(_ctx: ShardContext, _weapon: HybridWeapon): void { /* none by default */ } // :888
  ...
      bindPlayerImpulse(...).columns(this.runtimeSource.modes?.traverse ?? [],
        () => rt?.world?.player.position ?? this.player, () => ctx.app.player?.mode === 'board', ...  // :1027 Sky's hoverboard
```

| Test | Result | Evidence |
|---|---|---|
| T1 two users | pass | Sky `far-reach/runtime/index.ts`, Signal `plugin.ts` |
| T2 no shard nouns | **fail** | `'board'` (Sky mode) `:1027`; doc "Signal Dunes and Sky Reach" `:613`; `"shard/sunscar.signal"` `:1075`; "Sky Reach" `:349` |
| T3 data-driven | **fail** | five TS override hooks; `owners` map of shard objects; `armed`/`dress`/`decorate`/`capture` as `{owner,path}` (`:751`, `:794`, `:805`, `:1011`) |
| T4 server-safe | **fail** | holds sim (homes, held bodies, boss record, decision authority) inside the page plugin (G453 (1)); only half-split by lazy imports |
| T5 deletion | **fail** | Pine, Driftwood and Nine use `ShardPlugin`; the Template runs on the data client; nobody keeps it without Sky and Signal |
| T6 G454 (5) | **fail** | subclass overrides and reflection callbacks |

**Verdict: SILLY (a shard-plugin framework in a generic coat).** Its pieces are mostly real mechanisms. What is wrong is
the door.

**Where it should go.** Dissolve it into the data client (`game/shardfile/client.ts`), which already installs items, loot,
journal, ledger, plumbing, targets, quest presentation and audio for data-only shards (`client.ts:296–487`):
- `population` → G474 spawn director (data client; `runtime.spawns` rows).
- `species` → the existing `actors/species-programs` section read by the data client.
- `fight`/`pageFight` → G474 boss host (`game/boss/`, in progress).
- `pageQuest` → G474 quest step runner (`game/quest/steps.ts`, landed `4f3e3aa2d`).
- `melee` → the held-melee host (§5.5).
- `clientMotion` → the data client's movers (Driftwood already, `game/shardfile/movers.ts`).
- `boot.pitch`/`bounds` → entry rows.
- `inspect` and `expose` → debug rows.
- `modes` columns → a `modes` row with `whileMode: "board"` as **data**.

**Lines:** −~560 platform when it dissolves, re-added as data-client stages (~250).

### 5.2 `game/shardfile/bakedKinds.ts` `bakedMeshWorld` (68) / `worldPieces` (40) / kinds groups (~130): **4/6, borderline + fix**

**What it does.** It draws static baked GLBs (one node per kind, materials from rows, instanced or ordinary) and registers
collider rows with the world registry. Colliders never wait on the GLB. It was promoted from Signal (`bakedKinds.ts:11`).

| Test | Result | Evidence |
|---|---|---|
| T1 | pass | Sky `world/baked.ts`, Signal `world/baked.ts` |
| T2 | **fail (light)** | docs name Signal and Sky (`:11`, `:136`, `:319`); the code itself has no nouns |
| T3 | **fail** | `decorate: (material, kind) => …` callback (`:74`, `:90`), `each` callbacks, generic `K extends BakedMeshKindRow` extra fields per shard (`warm`, `brazier`) |
| T4 | pass | client-only presentation plus colliders as rows (server-safe colliders) |
| T5 | pass | any shard with baked static pieces needs it; it overlaps the shardfile `props` path |
| T6 | **fail** | TS decorate callback |

**Verdict: borderline + fix.** Replace `decorate`/`each` with a per-kind `surface` row resolved by `applySurfaceLooks`.
Drop the extra-field generic. Then either merge it into the data client's props view (`clientViews.ts`) or make it the
data client's `world/bakes` stage. **The honest end:** one static-world path for all shards (props), not two.

### 5.3 `game/plugin/ui.ts` `bindClientChannels` (120) + `createClientChannelPrompt` (27) + `moverChannelValues` (15): **3/6, borderline + fix**

**What it does.** It binds declared channel programs (small expression graphs over mover poses and fields) to scene
targets: the well bucket's y and the rope's scale (`clientChannels[0]`). It makes channel-positioned prompts and installs
the movers.

| Test | Result | Evidence |
|---|---|---|
| T1 | pass | Sky (islets, winch), Signal (bucket); Nine authors channels too (`generators/clientMotion.ts`) |
| T2 | pass | none in code |
| T3 | **fail** | `targets: ReadonlyMap<string, unknown>` of shard TS objects (`ui.ts:722`); `named: Map<string, fn>` prompt handlers (`:846`) |
| T4 | pass | client view only (movers are sim, owned elsewhere) |
| T5 | pass | Driftwood movers would use it if channels addressed scene parts |
| T6 | **fail** | `named` TS handlers; TS target objects |

**Fix.** Targets resolve to **scene part ids** in the data client's scene. Prompt actions are an interaction id or an AS
signal (`Do.signal`), not a named TS function. Then it is a **REAL GAME HOST**, and it belongs in the data client.

### 5.4 `engine/render/dataLook.ts` painted look (`paintedLook` 129, `paintedLookFromRow` 9, parsers ~20, painter light ~45, haze ~20, strips ~30): **4/6, borderline + fix**

**What it does.** It is a painted-sky look: dome or strips, the painter's light patch (rim, bounce, floor), heading haze, a
NEUTRAL tone, a fixed key light, and a state scalar driving the key/fill/fog curves.

| Test | Result | Evidence |
|---|---|---|
| T1 | pass | Sky and Signal; G478 adds Nalati (`engine/world/painterly.ts`) |
| T2 | **fail (light)** | the row type is `DuskLookRow` (`:500`); "a quest's dusk" (`:442`); `'dusk'` in the clock schedule is fine (a time-of-day word) |
| T3 | **fail** | ports `dressing` (TS builder, `:458`), `terrain.build` and `terrain.update` (`:479`); `state` is a TS object `{value}` |
| T4 | pass | client-only presentation (engine render) |
| T5 | pass | G478: "two stylised looks … approve them as engine" |
| T6 | **fail** | TS callbacks for dressing and terrain |

**Verdict: borderline + fix, approved as engine in principle (G478).**
- Rename `DuskLookRow` to `PaintedLookRow`.
- State becomes a **field name** resolved by the game layer (`shared.dusk`).
- `dressing` becomes rows: card groups (`cardField`) and discs (Sky's `discLayer`) declared in the row.
- `terrain` callbacks go: the skirt to N8, the pools to emitters.
- The engine keeps the shader mechanics; the game-layer admission maps the shardfile row onto it.

### 5.5 `game/plugin/weaponFamily.ts` `HeldMeleeWeapon` (117), `HeldContactWeapon` (36), `createHeldMelee` (17), `createDeclaredHeldMelee` (11) + `heldRecipe.ts` `admitHeldRecipe` (21) + `heldPresentation`: **3/6, borderline + fix**

**What it does.** It is a declared held melee weapon. Phase rows (charge, spring, phases), playback channel programs, a
private scene (coil, cord, glove), a contact scan or raycast, a tip, a resting group, and a "caught" wrap.

| Test | Result | Evidence |
|---|---|---|
| T1 | pass | whip (Signal), war fan (Sky); Driftwood sword (`game/weapons/Sword`) and Nalati sabre (`runtime/weapons/mountedSword.ts`) are candidate users |
| T2 | pass | none in code |
| T3 | **fail** | `resources` resolve by `{owner,path,args}`, which calls shard methods (`heldRecipe.ts:7–12`; `weaponFamily.ts` `heldResources` uses `value.apply(borrowed.receiver, …)`) |
| T4 | pass/label | client presentation; phases and contacts are combat sim (owned by `createHeldMelee`) |
| T5 | pass | G474 approved "held viewmodel arms" and "loadout"; any melee shard needs it |
| T6 | **fail** | reflection calls into shard objects; `decorate` borrowed method |

**Fix.** Resources name assets (library model id, bake piece and kind, surface-look id). Then it is a **REAL GAME HOST**,
and it should absorb Driftwood's sword as its second hand-authored user.

### 5.6 `sdk/looks/cardField.ts` `cardGroup` (23) + row types (~48): **5/6, REAL GAME/SDK MECHANISM**

**What it does.** It builds camera-facing cards from rows, with shader or graph materials by program name.

T1 pass (Sky sun glow and cumulus, Signal fires). T2 pass. T3 near-pass: `CardPrograms.material` is a caller port, but
it is a material lookup by declared id, not logic. T4 client-only. T5 pass. T6: a port, not a hook; acceptable if
programs resolve from the product's graphs.

**Verdict: REAL.** Leave as is. It becomes internal to the emitter and painted-look hosts.

### 5.7 `sdk/clientChannels.ts` `ClientChannels` (59): **5/6, REAL (build-time SDK)**

**What it does.** It is a builder for channel programs, used in generators by Sky, Signal **and Nine**
(`nine-dragon-stack/generators/clientMotion.ts:1`). It is build time, so not runtime-counted. My runtime graph shows it
only because of type imports.

**Verdict: REAL.**

### 5.8 `game/shardfile/bossRow.ts` `installBossOwnerRow` (35) + types; `ui.ts` `rowBossSpec`/`RowBossView`/`installBossView`/`bindDeclaredFight` (~105); `bossStorm.ts` (22); `Atmosphere.weatherFog` (14): **3/6, borderline, folds into the G474 boss host**

**What it does.** It is a spawned or held boss fight from rows: stages, phases, record, victory facts and flags, reward, a
storm presentation (sand-storm shells plus weather fog for Signal's phase 2).

| Test | Result | Evidence |
|---|---|---|
| T1 | pass | Matriarch (Signal), Roc (Sky); Pine King and Driftwood captain via `game/Boss.ts` |
| T2 | pass | none in code |
| T3 | **fail** | `DeclaredFightPorts` mix (`dress` callback, `held`/`catalogue` objects, `ui.ts:1681`); `pageFight.armed`/`dress` as owner paths |
| T4 | **fail** | `RowBossView` mixes view and fight sim in the page |
| T5 | pass | G474 boss fight host approved |
| T6 | **fail** | callbacks |

**Verdict: borderline.** Merge into the G474 boss host (`game/boss/`). `armed` becomes `{ flag: "sunscar.lit" }`. The
storm is a presentation row (`storm.shells`) on the boss row. The weather fog is the G474 weather host.

### 5.9 `game/plugin/ui.ts` `bindPageQuestStages` (44), `bindBorrowedPageQuestStages` (43), `installBorrowedPageQuest`: **2/6, SILLY as written; the mechanism folds into the quest step runner**

**What it does.** It ties quest stages to borrowed shard events and actions: `events: [{owner:'plugin', path:['places','fire','onLight']}]`
and `actions: [{action:{spawn:'sunscar.matriarch'}, owner:'fight', path:['summon']}]`.

T1 pass (Sky and Signal). T3 and T6 **fail**: everything is an owner path into TS objects. T5: Pine and Driftwood went
another way (`game/quest/steps.ts`, the quest step runner).

**Verdict: SILLY wiring.** The quest step runner plus a flag event replaces it: "when flag `sunscar.lit` is set → encounter
`sunscar.matriarch` arm". That is already expressible with the boss host's `armed` flag and the decision host's `flag` event.

### 5.10 `engine/render/families/ground.ts` `setGroundPools` (11) + `GroundPool` (1): **2/6, Signal-only, fold into emitters**

```ts
/** Move a ground layer's light pools (a runtime adapter: Signal Dunes' burning fires): up to `GROUND_POOLS` points… */
export function setGroundPools(m: THREE.Material, points: readonly GroundPool[]): void {
```
T1 **fail** (Signal only). T2 **fail** (doc names "Signal Dunes' burning fires", `ground.ts:293`, an engine file). T3 pass
(points as data). T4 client. T5 pass (Nine's wet-floor pools want it). T6 pass.

**Verdict: borderline + fix.** The ground family reads the **emitter pool uniform** directly when its row says
`pools: "emitters"`. Then no adapter call is needed and Nine is the second user.

### 5.11 `game/shardfile/runtimeProduct.ts` `runtimePresentation` (3) + `hybridPresentation.ts` (10) + `prepareClientWorld` (26): **2/6, delete with N1 and N8**

These lend the data client's built materials and host-field state to a trusted runtime. They exist only because Signal's
runtime and data client are two halves. T1 fails for `runtimePresentation`/`hybridPresentation` (Signal only); Driftwood,
Nalati and Pine reach `prepareClientWorld` through other paths. T3 and T6 fail (`bindState(read)` callback).

**Verdict: delete when the data client draws the skirt (N8) and owns the fields (N9).**

### 5.12 Small leftovers reached only through `HybridRuntimePlugin`

`installRuntimeAudio` (7), `declaredWeaponVoices` (11), `installDeclaredCombatCues` (4), `installRuntimeLoot` (7),
`installSilentScore` (3), `installEnteredRuntimeInput` (10), `scriptItemHook` (11), `declaredItemScriptBindings` (8),
`commandSocketLift` (3), `declaredItemScriptEntities` (10), `bindRuntimeHomes`/`runtimeHomeWork`/`holdBodies` (~73),
`bindRuntimeActor` (11), `runtimeEquipment` (21), `bindRuntimeMelee` (18), `bindRuntimeItemContexts` (8),
`bindRuntimeBossRecord` (20), `RuntimePersistence` types.

Each is a generic mechanism (score 4–5/6) that **fails T5 only because its sole caller is the hybrid host**. They pass
once the data client calls them. `commandSocketLift` is Sky's (socket lift). `bindRuntimeHomes`' `holds`
(`actor.mem[field] = flags.has(until) ? 0 : 1`) is a generic "hold an actor until a flag" row, used by Signal for the ray
held until Sefa is met.

**Verdict:** REAL mechanisms behind a silly door. **Move the call site, not the code.**

### 5.13 `sdk/bake/*` (65 build-time lines: `foldKinds`, `bakeRawColourTexture`, `colliderRows`, `BakedSceneParts`)

Build-time SDK helpers that only Sky and Signal generators call. G467: generators and their SDK are build time and never
count. **Keep;** not a host-bar matter.

---

## 6. New hosts and features needed for zero, each designed and graded

N1–N10 are the audit's list (N6 was never named). N11 and N12 are new. "Approved" means G473–G478 already approved it
as platform from day one.

### N1: Declared runtime entry, i.e. "no runtime" (dissolve `HybridRuntimePlugin` into the data client): **6/6 after the fix, REAL GAME HOST**

**What the shard declares:** nothing new. It drops `runtime.entry` and `runtime.binds`, so the data client installs every
section (`withoutRuntimeRows` stops stripping them, `client.ts:184`).

**What the host does.** The data client gains the stages the hybrid host had, each driven by an existing section:
- held melee from `items` plus the held recipe;
- species from `actors/species-programs`;
- population from `runtime.spawns` (G474 spawn director);
- boss from `quests/directors` (G474 boss host);
- page quest from `quests` plus `questHost` plus `world/targets` (G474 quest runner);
- movers and channels from `movers` plus `clientChannels`;
- entry pitch and bounds from an `entry` row.

**API:**
```ts
// game/shardfile/client.ts: no new public surface; the stage list grows
interface ClientStage { readonly section: SectionKey; install(ctx: ShardContext, source: Shardfile, assets: ClientAssets): Promise<void> | void }
```

**Code it deletes:** Signal `plugin.ts` 66, `runtime/index.ts` 2, `runtime/source.ts` 3, `heldWhip.ts` 5; platform
`HybridRuntimePlugin` 326, `HybridRuntimeRows` 32, `HybridMeleeRows`/`HybridPageQuestRows`/`QuestCaptureRows`.

**Risks:**
- Stage order: the hybrid host's order was tuned for saves and continuation (the comments are full of "original phase").
- Debug aliases used by captures (`inspect`).
- The quest-capture checkpoints.
- Mitigation: scenario tests per stage; the Template already proves the data-client path.

Users: every shard (it is the data client). T1–T6 pass, provided the stages take rows only.

### N2: World scene assembly as a data-client stage: **6/6 after the fix, REAL GAME HOST**

**What the shard declares:** `world/scenes` rows (the existing `WorldSceneRecipe`, `format/clientChannels.ts:243`), with
imports from library and bake by id, lights, emitter anchors, and piece bindings to the registry.

**What the host does:**
- It builds each scene, registers pieces and colliders (`worldPieces.scene`) and exposes parts by `"<scene>/<part>"` id
  to interactions, channels, emitters and prompts.
- No TS object map and no `BorrowedOwnerPath` into shard objects.
- Prompts are positioned at `{part, offset}`.

**API:**
```ts
export function installWorldScenes(rows: readonly WorldSceneRow[], ports: { scope: Scope; piece: (p: Piece) => void; root: Object3D;
  library: ModelLibraryLike; bakes: BakedMeshWorld<string, BakedMeshKindRow> }): { part(id: string): Object3D; point(id: string): Vector3 };
```

**Deletes:** `world/build.ts` 74, `world/places.ts` 29, `data/placeBindings.ts` 6. For Sky: `world/build.ts`, `shapes.ts`, `mill.ts`.

**Second user:** Sky. G474 **living buildings** (Pine `buildingLife.ts`, doors, fire pits and lanterns) is the same host.
Build it once.

**Risks:** prompt raycast/LOS picking order, and the Explorer reusing scenes (N10).

### N3: Declared input actions, tier knobs and slots: **5/6, REAL GAME HOST (Sky-driven)**

Signal needs little: `boot.itemContexts: 'source'` and the whip slot. Sky needs `ActionMap 'far.gust'` and `TierKnobMap
'far.meadowBlades'` (`far-reach/runtime/index.ts`). Signal's `weapons/slots.merge.d.ts` becomes a save-migration row
instead. T1: Sky plus every shard's tier knobs. **Signal lines: 0 counted** (the `.d.ts` is excluded).

### N4: Weapon-action burst (Sky's gust) and N5: trail ribbon (Sky's ray wake)

Not Signal. Signal's whip crack is already data (cues plus playback channels). **Signal: 0.**

### N7: Fire FX host, folded into G478 light emitters: **6/6 after the fold, REAL GAME HOST**

Design in §4.14. Users: Signal (fires, lantern, tower), Pine (fire pits, lanterns, `buildingLife.ts`), Nine (lantern
pools, `runtime/looks/light.ts`), Driftwood (hut flames). The light pool uniform is an engine render feature (ground and
surface families read it), which takes `setGroundPools` out of the shard's hands.

**Deletes:** `world/fireFx.ts` 45, plus the pools adapter in `look/render.ts`, plus `SiteLights` wiring (the `SiteLights`
row stays engine).

### N8: Baked terrain skirt and lent tile material: **3/6 today, borderline**

Design in §4.5. T1 **fails today** (Nalati's apron is TS and procedural, not baked). It passes if Jake accepts that every
500 m-cube shard needs an edge (G99) and Nalati or the Template adopts the row. **Deletes:** `runtime/looks/bakedGround.ts`
37 plus platform `runtimePresentation`/`hybridPresentation`. If not approved, the 37 lines stay as **listed view code**.

### N9: Eased shared field: **5/6, REAL GAME HOST, folds into G474 weather/keyed sky**

Design in §4.8. Users: Signal dusk; Pine weather transitions (`daySky.ts` `driveDayAir`, `overcast.ts`); Signal's own
`storm` field (`state.shared[1]`) for the Matriarch's storm strength (`bossStorm.ts`), which eases today in TS. T4: host
state is sim-safe (a scalar with declared bounds).

### N10: Declared Model Explorer catalogue: **6/6, REAL GAME HOST**

Design in §4.16. Users: all 6 shards' `roster.ts`. **Deletes:** `roster.ts` 11 and `models/gear.ts` 13.

### N11 (new): Scene-part addressing in quest presentation instead of `{owner, path}`: **6/6, REAL GAME HOST**

`questPageInteractions`' `visible`, `label`, `call` and `observation` bindings address `{part}`, `{prompt}` and
`{emitter}` ids. This deletes the `BorrowedOwnerPath` dependency for Signal and Sky. Pine's `questPageInteractions.ts`
and `directorBindings.json` use owner paths too, so all three benefit. This is the T6 fix for §5.3, §5.5, §5.8 and §5.9
together. Platform: about +60 (resolver), and eventually about −40 (`borrowed.ts`) once Pine moves.

### N12 (new): Painter light on placed models (material scope): **5/6, part of the painterly host**

§4.10. The painterly look row's `light.scope: "material"` makes the host patch props, held models, spawned bodies and NPC
models. No `dress` hooks. Users: Signal (material scope); Sky and Nalati could choose it.

---

## 7. AssemblyScript: what exists and what Signal's script needs

**Host and ABI** (`format/scriptAbiV1.ts`, generated bindings `sdk/decisionScriptBindings.ts`, host
`game/shardfile/decisions.ts`, admission `format/decisionScripts.ts`):
- **Events:** start, tick, timer, zone.enter/leave, interact, hit, threshold, death, move.done, strike.done, **flag**,
  signal, strike.target, player.join/leave, spawned, stop, field, cue, channel.
- **Reads:** x, y, z, yaw, hpShare, alive, field (actor public field), distance, nearestPlayer, **flag**, timerLeft,
  random, actorInZone, playersInZone, moving, strikeState, playerFlag, spawnGroupAlive, bearing.
- **Lists:** actorsInZone, playersWithin, groundHeight, nearestWalkable, path.
- **Commands:** move, strike, stop, **field** (actor public field), spawn, despawn, **flag**, timer, signal, grant, reward,
  cue, channel, impulse, encounter, **weather**, view.channel, view.clip, view.vfx, view.sound, view.visible.
- **Declared but refused by the host:** `spawn`, `despawn`, `impulse` and `weather` throw "Decision mechanic has no
  admitted platform row owner" (`decisions.ts:132`).

**Gap.** No command writes a **shared host state field**. `field` writes an actor's public `mem` field only
(`decisions.ts:245–261`). Signal's `dusk` is declared `privacy: 'host'` on `state.shared`. Client graphs only read public
numeric fields (`format/clientScripts.ts:52`). So the dusk script needs one of the two options below.

**(A) Recommended: a new command `state(field, value, snap)`.** It writes a declared `state.shared` numeric field (bounded
by its min/max, declared in the script's `fields` aliases). The host eases it if the field row has `ease` (N9). Host
privacy is allowed because the script is the field's declared owner. About +25 platform lines (enum id 17, admission,
apply, scenario support).

**(B) Alternative: implement the reserved `weather` command.** Each weather row carries look-state targets with an ease.
The dusk then becomes `Do.weather(Weather.logbook)`. It uses G474 "weather reactions plus keyed sky" (Pine is the second
user) and adds no ABI id, but it bends "weather" to mean time of day.

**Signal's dusk script** (`behaviour/dusk.as`, ~20 lines, shard binding, events `start` and `flag`):
```ts
import { Flag, Field, Do, Read } from './generated/sunscarDusk';
function target(): f64 {
  if (Read.flag(Flag.lit)) return 1.0;                       // the signal burns: blue hour
  let lit = 0; if (Read.flag(Flag.waymark0)) lit++; if (Read.flag(Flag.waymark1)) lit++; if (Read.flag(Flag.waymark2)) lit++;
  if (lit > 0) return 0.5 + 0.12 * f64(lit);                 // each waymark deepens it
  if (Read.flag(Flag.oil)) return 0.56;                      // never lighter than the step before (seat B R8B-9)
  if (Read.flag(Flag.logbook)) return 0.52;
  return Read.flag(Flag.scout) ? 0.5 : 0.0;
}
export function onStart(): void { Do.state(Field.dusk, target(), true); }   // a loaded save snaps (was settleQuestDusk)
export function onFlag(flag: i32, value: bool): void { Do.state(Field.dusk, target(), false); } // the host eases 0.02/s
```
- Row: `{ id:'sunscar.dusk', abi:'1.0', side:'sim', binding:{shard:true}, on:['start','flag'], reads:['flag'],
  commands:['state'], flags:{lit:'sunscar.lit', …}, fields:{dusk:'shared.dusk'}, state:[] }`.
- Scenario test (G455 (4)): set flags in order, assert the `state` commands.
- **Existing ABI pieces:** `flag` event, `flag` read, shard binding. **New:** `state` command, and the host-side ease (N9).

**Other Signal rules and their AS status:**

| Rule | Today | Should be |
|---|---|---|
| Matriarch decisions | AS (exists) | AS |
| Skitterer ambush | AS ABI v0, per-tick steering | generic steering modes (engine) plus AS state choice at ≤ 10 Hz; or keep as an exception |
| Quest interactions (oil, waymarks, crank) | data rows | data (no AS needed) |
| Matriarch summon on fire | owner path `places.fire.onLight` | data: boss `armed: {flag}` |
| Ray held until Sefa | `holds` row | data |
| Dusk per step | TS `duskOf` | **AS** (above) |
| Waymark roaming light | TS `SiteLights` in `build.ts` | data (`SiteLights` row; engine host exists) |
| Tower flicker | TS sine sum | data (emitter `flicker.waves`) |

AS budget: 118 now, about 143 with the dusk, against a 412 ceiling (35 %).

---

## 8. Ranked host table (G454 bar, highest first)

Score is out of 6. Tests: T1 two users · T2 no nouns · T3 data-driven · T4 server-safe/labelled · T5 deletion · T6 data-only API.

| Rank | Host / module | Score | Fails | Verdict | Shard-specific part goes to |
|---:|---|---:|---|---|---|
| 1 | N10 Explorer catalogue (proposed) | 6 | none | REAL GAME HOST | rows (order, framing) |
| 2 | N1 data-client "no runtime" (proposed) | 6* | none if rows only | REAL GAME HOST | sections |
| 3 | N2 world scene stage (proposed; = living buildings) | 6* | none if parts by id | REAL GAME HOST | `world/scenes` rows |
| 4 | N7 fire FX in light emitters (proposed fold, G478) | 6* | none | REAL GAME HOST | emitter rows |
| 5 | N11 scene-part addressing (new) | 6 | none | REAL GAME HOST | presentation rows |
| 6 | `sdk/clientChannels.ts` `ClientChannels` (build) | 5 | (T5 marginal) | REAL (SDK) | n/a |
| 7 | `sdk/looks/cardField.ts` | 5 | T6 marginal (material port) | REAL | card rows |
| 8 | N9 eased shared field (proposed; G474 weather) | 5 | T1 until Pine adopts | REAL GAME HOST | field row `ease` plus AS `state` |
| 9 | N3 input/tier/slots (proposed) | 5 | T1 is Sky-driven | REAL GAME HOST | rows; save migration for the slot |
| 10 | N12 painter light on placed models | 5 | T1 (Signal-only scope today) | part of the painterly host | look row `light.scope` |
| 11 | `engine/fx/SiteLights.ts` | 5 | T3 (TS lamp adds) | REAL ENGINE (Pine plus Signal) | `SiteLights` rows |
| 12 | §5.12 small stages (`bindRuntimeHomes`, audio, loot, items) | 4–5 | T5 (sole caller is the hybrid) | REAL behind a silly door | call from the data client |
| 13 | `bakedKinds.ts` | 4 | T2 (docs), T3, T6 (`decorate`) | borderline + fix | per-kind `surface` rows; merge with props |
| 14 | `dataLook.ts` painted look | 4 | T2 (`DuskLookRow`), T3, T6 (`dressing`/`terrain` ports) | borderline + fix (approved engine G478) | painted row, state field name, dressing rows |
| 15 | `bindClientChannels` | 3 | T3, T6 (TS targets, named handlers) | borderline + fix | scene part ids, interaction or AS signal |
| 16 | `HeldMeleeWeapon` + `heldRecipe` | 3 | T3, T6 (owner/path resources) | borderline + fix | asset-id resources |
| 17 | boss rows/view/storm (`bossRow`, `RowBossView`, `bossStorm`) | 3 | T3, T4, T6 | borderline, fold into the G474 boss host | boss row (`armed: {flag}`, storm row) |
| 18 | N8 terrain skirt (proposed) | 3 | T1 (no second baked user), T3 (lent material today) | borderline | `terrain.skirt` row, or listed view code |
| 19 | `setGroundPools` | 2 | T1, T2 (doc names Signal) | fold into emitters | ground row `pools: "emitters"` |
| 20 | `runtimePresentation` / `hybridPresentation` | 2 | T1, T3, T6 | delete with N1/N8 | n/a |
| 21 | page quest stages (`bindPageQuestStages`/`Borrowed`) | 2 | T3, T5, T6, T2-ish | SILLY wiring | quest step runner plus flag events |
| 22 | `HybridRuntimePlugin` (+ `Rows`) | 1 | T2, T3, T4, T5, T6 | **SILLY** | dissolve into the data client (N1) |

\* = after the stated fix.

**Totals:** 22 graded.
- REAL as is or with a small fix (≥ 5): 12 (5 of them proposed).
- Borderline + fix (3–4): 6.
- Fold or delete (2): 3.
- SILLY: 2 (`HybridRuntimePlugin` 1/6, page quest stages 2/6; the latter is counted in the 2-score group above as a fold).

**Pattern:** every borderline or silly score fails **T3 and T6** for the same reason: shards plug TS objects into the host,
by ports, subclass overrides or `{owner, path}` reflection. **Fixing that one pattern (N11 plus asset-id resources) lifts
six modules to REAL.**

---

## 9. Summary table: piece → classification → target → lines

| Piece | Lines | Classification | Target form | Shard −, platform + |
|---|---:|---|---|---|
| `plugin.ts` | 66 | glue, plus 6 lines of story rule | N1 data client; `duskOf` → `dusk.as` | −66 / AS +20 |
| `runtime/index.ts` | 2 | glue | N1 | −2 |
| `runtime/source.ts` | 3 | duplicate product parse | `ctx.product` / roster `product` | −3 |
| `runtime/items/heldWhip.ts` | 5 | owner map | asset-id held resources | −5 / +15 |
| `runtime/looks/bakedGround.ts` | 37 | generic view code, one user | N8 `terrain.skirt`, or listed view code | −37 / +35 (moved) |
| `boot/ground.ts` | 5 | data in TS | manifest JSON (`structures: true`) | −5 |
| `data/placeBindings.ts` | 6 | TS contract for path reach | N2 parts by id | −6 |
| `look/dusk.ts` | 11 | generic mechanism | N9 eased field | −11 / +30 |
| `look/render.ts` | 22 | callbacks into the painted look | painterly host row (G478) plus N8 plus emitters | −22 / +20 |
| `look/light.ts` | 12 | generic | N12 look row `light.scope` | −12 / +10 |
| `world/baked.ts` | 11 | host call plus `warm` callback | props / `world/bakes` plus `surface` row | −11 / +10 |
| `world/meshes.ts` | 14 | host call | `library` section | −14 |
| `world/places.ts` | 29 | scene binder | N2 | −29 / (N2 +120 total) |
| `world/fireFx.ts` | 45 | generic FX mechanism | N7 in emitters (G478) | −45 / +60 |
| `world/build.ts` | 74 | page wiring plus constants | N2 + N11 + emitters + `SiteLights` rows | −74 / (N11 +60) |
| `models/gear.ts` | 13 | Explorer | N10 | −13 / +30 (N10 total) |
| `roster.ts` | 11 | Explorer | N10 | −11 |
| **Shard total** | **366 (ruler 372)** | | | **−366, AS +20** |
| Platform sole-user (20) | 20 | `setGroundPools`, `runtimePresentation`, `hybridPresentation`, … | emitters, N8, N1 | −20 |
| `HybridRuntimePlugin` and family | ~560 | SILLY door | dissolve into the data client | −~560 / +~250 |
| N1 / N2 / N9 / N10 / N11 / N12 / emitters / AS `state` | | new hosts | | ≈ +560 total incl. above |

Net platform about +230 after deleting the hybrid host (G466 (9) "reported as net lines").

---

## 10. What is genuinely missing, by layer

**Engine features** (render, physics, input; no game words):
1. **Emitter light-pool uniform** read by the ground and PBR surface families: a fixed-size `vec4[N]` of positions and
   gains, set by the game. Users: Signal fires, Nine lantern pools, Pine fire pits. It replaces `setGroundPools` and
   Signal's `FIRE_LIGHTS`.
2. **Painted look as data** (G478 approved): the dressing as card and disc rows, the state as a scalar port fed by the
   game, no TS `terrain` callbacks. Users: Sky, Signal, Nalati.
3. **Generic steering modes** for small creatures (burrow, burst, ring-hunt, retreat), so per-tick steering leaves Wasm.
   Users: Signal skitterer, Pine and Nalati pack wolves. Optional; it applies only if G454 (7) is enforced on species
   scripts.

**Game hosts:**
1. **N1 data client absorbs the hybrid stages.** Users: every shard. It deletes `HybridRuntimePlugin`.
2. **N2 world scenes, the same host as G474 living buildings.** Users: Signal, Sky, Pine, Driftwood.
3. **N7 → G478 light emitters**, with cards, embers and a clock. Users: Signal, Pine, Nine, Driftwood.
4. **N9 eased shared fields**, in G474 weather/keyed sky. Users: Signal dusk and storm, Pine weather.
5. **N10 Explorer catalogue rows.** Users: all 6.
6. **N11 scene-part addressing** replacing `{owner, path}` in presentation. Users: Signal, Sky, Pine.
7. **Held melee resources by asset id.** Users: Signal whip, Sky fan; Driftwood sword and Nalati sabre to follow.
8. **N8 terrain skirt row.** Users: Signal; claimed Nalati and the Template. Needs Jake's call.
9. The **G474 boss host** absorbing the row boss view and the storm, plus the **quest step runner** taking flag events.
   Both are already approved and in progress.

**AS ABI commands:**
1. **New: `state(field, value, snap)`**, a write to a declared `state.shared` numeric field (host privacy allowed for its
   owner script). Users: Signal dusk, Signal storm (could move from TS), Pine weather intensity.
2. **Implement the reserved ones** that already have ids but are refused (`decisions.ts:132`): `weather` (option B for
   the dusk; Pine weather), and `spawn`/`despawn` (the spawn director, G474).
3. No other command is missing for Signal. Interactions, encounter arming and holds are data.

---

## 11. Single-shot: these must NOT become hosts

| Single-shot thing | Goes to |
|---|---|
| `duskOf`: the step → dusk table and `0.5 + 0.12 × waymarks lit` | `behaviour/dusk.as` |
| `TOWER_LIGHT 14`, `WAY_LIGHT 9`, `LANTERN_LIGHT 5`, lantern gain 0.22, flicker waves `[[11,0,.07],[23,1,.05]]`, tower flicker `sin(13t)·.06 + sin(29t+1.3)·.04` | emitter / `SiteLights` row numbers |
| `fireCaught` / `catchFire` (tower fire visible, light on, label "lit") | 3 presentation rows |
| `glow(lit)` (ember emissive 1.1 plus a light slot) | emitter on/off row |
| the well's first channel evaluation at the jar position (`channels.evaluate(programs[1]…, [jarAt…])`) | an initial-observation row on the channel |
| `PLACE_BINDINGS` typed contracts | gone with N2 (parts by id) |
| Explorer slice order (`slice(0,1)`, `slice(5)`, `slice(1,5)`) | catalogue row order |
| `sunscarNoRim` userData opt-out | material row `rim: false` |
| `WHIP_HELD_OWNERS` / `Bullwhip` type | asset-id resources |
| `'sunscar-whip'` slot merge (`weapons/slots.merge.d.ts`) | save-migration row |
| `settleQuestDusk` capture hook | AS `onStart` snap |
| `boot.pitch: -0.1`, `inspect` aliases, `expose: 'sunscar'` | entry and debug rows |
| the Matriarch's sand-storm shells | the boss row's storm presentation (the host exists) |
| Sky's `'board'` mode test inside `HybridRuntimePlugin` (`headless.ts:1027`) | a `modes` row `whileMode` (data) |

None of these is a reason for an engine or game host. Each is a number, a table or a rule.

---

## 12. The honest floor for Signal

**What TS must remain, and why.** Nothing in Signal is per-frame drawing that is unique to Signal and impossible to
parameterise:
- The fires are cards plus a point field plus a light slot.
- The skirt is a mesh in the terrain material.
- The dusk is an eased scalar.
- The roaming light is `SiteLights`.
- The whip is a held recipe.

Every per-frame loop Signal runs is a generic mechanism with Signal's numbers. So the floor depends on which hosts exist,
not on Signal:

| Scenario | Signal TS left | What stays and why |
|---|---:|---|
| Today | 372 + 20 | §4 |
| **A. Only already-approved features land** (painterly look G478, light emitters G478, living buildings, boss host, quest step runner, spawn director G474), with no N1/N2/N8/N9/N10/N11 | **~200** | `plugin.ts` ~45 (still a subclass, still `{owner,path}`), `world/build.ts` + `places.ts` ~45 (thinner with living buildings and emitters), `bakedGround.ts` 37, `baked.ts` + `meshes.ts` 25, `roster.ts` + `gear.ts` 24, `dusk.ts` 11 (no AS write command), small files ~15 |
| **B. A + N1 + N2 + N10 + N11 + AS `state` command + N9** | **~37–45** | only `runtime/looks/bakedGround.ts` 37, as listed view code (no second user for N8), plus maybe ~5 lines of skirt glue |
| **C. B + N8** | **0** | none; AS ~143 / 412 |

**My recommendation for Jake's decision:**
1. Approve **N1** (dissolve the hybrid host into the data client). It is the only change that turns the "2,640 Sky/Signal
   platform lines" into shared code honestly.
2. Approve **N11** (scene-part addressing), which fixes T3/T6 for six modules at once.
3. Approve **N2**, folded into living buildings (already approved).
4. Approve **N10**.
5. Approve the **AS `state` command** together with **N9**.
6. Leave **N8** (the skirt) as listed view code until a second shard bakes a skirt.

That puts Signal at about 37 lines of honest view code, with no Sky- or Signal-specific branch left in the engine or game.

---

*Method files (scratch, read-only analysis):*
- `scratchpad/classify-signal/decls.mjs` (declaration-level user graph)
- `decls.json` (per-declaration users)
- `count.mjs` (per-file code lines)
- `graph.mjs` / `exports.mjs` (earlier, coarser passes)
