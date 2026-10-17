# Sky Reach (`src/shards/far-reach/`): every line it still runs, and where each one belongs

Read-only breakdown at HEAD `94fd1d5ab` (2026-10-17). Sibling report covers Signal Dunes. Written for Jake's question:
*"I can't tell what actually belongs inside of an engine, inside of a game … what is random ass single shot stuff …
what part of Sky and Dunes should be assembly script that's completely custom to that one shard."*

**Method.** Every counted Sky file was read in full. The platform modules were found with a declaration-level reach
walk I wrote for this report (scratch `classify/decls.mjs`, same rules as the ruler's G294 per-export pass: lexical,
narrows `await import()` members and `Promise.all` destructuring, conservative on bare namespaces; it reproduces the
ruler's 39–40 Sky-only G294 lines exactly). I did not run the ruler, `pnpm gen` or any build. Line counts are
nonblank, comment-free lines.

---

## 0. The numbers being classified

| Bucket | Lines | What |
|---|---:|---|
| Sky shard TS (counted) | 481 (my count 477) | 17 files listed in §3 |
| GLSL in JSON | 7 | `data/rocSlate.json` (G480 (1) now counts it) |
| G294 Sky-only platform | 39–40 | `game/shardfile/runtimeWorld.ts#bindRuntimeProps` 30 + `RuntimePropsPorts` 4 + `isMesh` 1, `runtimeProduct.ts#bindRuntimeProductProps` 4 |
| **Sky total** | **528** | |
| Platform used **only** by Sky + Signal | **2,281** | §4 (plus 18 Signal-only, sibling's). The audit said ~2,640; my walk narrows dynamic imports, which is why it is lower |
| Sky AssemblyScript (separate column) | 53 | `behaviour/roc.as` |
| Not counted, but real runtime code paths | — | 12 SDK mover kernels (`data/movers.generated.json`), 30+ generators, look-graph JSON |

Not counted and not code: `discovery.generated.ts` and `ktx2.generated.ts` (generated tables), the two
`data/*.generated.d.json.ts` type stubs (gitignored), `shard.config.ts` (declaration-only).

---

## 1. The layer rules (restated) and how I apply them

| Layer | Rule (AGENTS.md "Engine layers", ENGINE.md E405, G454, G465, G470) | Test I apply |
|---|---|---|
| **ENGINE** `src/engine` | Knows rendering, physics, input, audio, boot, levels in general. Nothing about the game, Wildshard, shards or content. Content arrives as data. Engine words only. | Would a non-Wildshard three.js game want it unchanged? |
| **GAME** `src/game` | Knows it is Wildshard and that shards run arbitrary content. Holds concepts and hosts that two or more shards share (or Jake approved as platform, G473–G478), driven by rows. | Passes the G454 host bar (below). |
| **SHARD DATA** | JSON, sections, GLB, look-graph JSON, generator output. Zero runtime code. | Is it a number, a shape, a name, a table? |
| **SHARD ASSEMBLYSCRIPT** | Rules, decisions and story logic unique to this shard, run by the AS script host at decision rate (events, ≤ 10 Hz), calling host ABI commands. | "Which mechanic, when" — never per frame. |
| **SHARD VIEW CODE** | Per-frame drawing or page wiring unique to this shard and not worth a host. Named honestly. | One user, draws every frame, no plausible second user. |
| **Single-shot** | Exactly one use and no plausible second user. Becomes data, AS or listed view code, never a new engine host. | — |

**G454 HOST BAR** (used for every score in §5): (1) two real users; (2) no shard nouns; (3) data-driven, shards
differ only in data; (4) server-safe, or labelled client-only presentation; (5) deletion test: you'd keep it if its
first shard vanished; (6) the API takes data only, per-shard hooks are AS script references, never TS callbacks or
subclass overrides.

### 1.1 The AssemblyScript ABI that exists today

ABI v1 (`src/format/scriptAbiV1.ts`, host `src/engine/script/decision.ts`, game wiring `src/game/shardfile/decisions.ts`):

| Kind | Declared in the ABI | Actually wired in the game decision host (`decisions.ts:274-327`) |
|---|---|---|
| Events | start, tick, timer, zone.enter/leave, interact, hit, threshold, death, move.done, strike.done, flag, signal, strike.target, player.join/leave, spawned, stop, field/cue/channel (view) | start, stop, timer, threshold, death, move.done, strike.done, signal; zones readable. **`interact` is not routed** (no match in `decisions.ts`). |
| Reads | x y z yaw, hpShare, alive, field, distance, nearestPlayer, flag, timerLeft, random, actorInZone, playersInZone, moving, strikeState, playerFlag, spawnGroupAlive, bearing | all of these |
| Commands | 1 move, 2 strike, 3 stop, 4 field, 5 spawn, 6 despawn, 7 flag, 8 timer, 9 signal, 10 grant, 11 reward, 12 cue, 13 channel, 14 impulse, 15 encounter, 16 weather, 100–104 view.* | **move, strike, stop, field, flag, timer, signal, grant, reward, cue, channel, encounter**. Refused at admission: spawn, despawn, impulse, weather (`decisions.ts:132`). view.* has no game owner. |

Sky's only script, `behaviour/roc.as` (53 lines), already uses only wired calls: `Do.move`, `Do.strike`, `Do.stop`,
`Do.timer`, `Read.nearestPlayer`, `State.step`, events `onStart/onStop/onThreshold/onMoveDone/onStrikeDone/onTimer/onDeath`:

```ts
export function onMoveDone(move:i32,ok:bool):void {
  const step=State.step, phase=step/10, mode=step%10;
  if(i32(Event.subject)!=Actor.roc || mode==0 || mode==5) return;
  if(move==Move.takeoff && mode==1) { orbit(phase); Do.timer(Timer.beat,Params.firstRest); return; }
  ...
  State.step=phase*10+4; Do.strike(Actor.roc,phase==0?Strike.stoop:phase==1?Strike.galeWall:Strike.sweep,target);
```

**Finding: Sky has almost no AS left to write.** Its story logic is already rows (quest host, world-target rules,
director stages). The only candidate is the winch (§3.1 "winch"), which needs a new ABI command if it goes to AS.

---

## 2. One-paragraph verdict

Sky's 528 lines are not game logic. They are (a) **page wiring** around a shared base class
(`HybridRuntimePlugin`) that shouldn't exist in its end state, (b) **scene assembly** that a world-scene host can run
from rows Sky already generates, (c) **look assembly** that the approved painterly look host (G478) absorbs, and
(d) about **55 lines of genuine per-frame view code** (the ray wake ribbon and the baked meadow blades). The 2,281
platform lines only Sky and Signal use are where the real problem sits: several pass the bar on users but fail it
on test 6. They take TS subclass overrides, TS callbacks and `BorrowedOwnerPath` string paths that call methods on
shard objects (`plugin.clientChannels.runtime.command` lives *inside the shipped product JSON*). Two of them are shard
code in a generic coat: `HeldMeleeWeapon` (a fan mode and a whip mode, one user each) and `bindRuntimeProps` (Sky only).

---

## 3. Every counted Sky file

Format per file: what it does · who calls it and when · equivalents elsewhere · classification · target form ·
lines removed / platform added.

### 3.1 `runtime/index.ts` — 127 lines — the page plugin

**What it does.** The trusted runtime: a subclass of `HybridRuntimePlugin` with two overrides (`build`, `install`)
and a `rows()` merge. Concretely it:

1. Augments three engine type maps (lines 25–33): input action `far.gust`, tier knob `far.meadowBlades`, equipment slot `far-fan`.
2. `rows()` (48–52): merges `runtimeRows.generated.json` with product sections (`actors/species-programs`,
   `quests/directors`, `ui/strings`) and **TS owner objects** (`paintFanLeaf`, `HERO_LIBRARY`, `SKY_LIBRARY.mappedLook`).
3. `build()` (54–85): preloads model libraries, compiles look materials, adopts the island props tiles, calls
   `buildWorld`, builds the meadow, registers the tier knob, binds client channels with a **TS `observed` callback**
   that turns the winch mover's pose into `built.state.raised` and the winch prompt's label.
4. `install()` (86–163): binds quest page interactions; binds the fan's held actions; pushes socket-lift prompts; a
   per-frame `far.dressing` system (hover-deck glow by player mode, mill hub spin, vane spin by flag); wind effect
   fields and the **gust burst** on `fan.onGust`; populates creatures; a **ray wake** per ray; binds the boss fight;
   builds the **gale-wall telegraph** mesh and moves it every frame from the boss's live strike windup and aim.
5. `finishRaise()` (166): capture command on the winch mover.

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
...
fan.onGust = (from, dir) => {
  const at = from.clone().addScaledVector(dir, 0.2).setY(from.y - 0.25), salt = fxRandom.next(); gust[0].burst(at, dir, salt); gust[1].burst(at, dir, salt);
  rt.play?.cues.charge(SKY_RUNTIME_ROWS.weapon, 'heavy');
};
```

**Who calls it.** `plugin.ts` → `firstPartyStandaloneEntry` at shard entry. `world`/`kit`/`play` at boot behind the
loading screen; four `ctx.system` callbacks every frame (`far.dressing`, `far.gust`, `far.rayWake`, `far.galeWall`).

**Equivalents.** Signal `plugin.ts` (85 lines, same base class, overrides `build`/`dress`/`install`); Driftwood
`runtime/hybrid.ts` (`DriftwoodMoverPlugin extends RuntimePlugin`); Pine `runtime/index.ts` (`PineHollow extends
ShardPlugin`); Nalati `runtime/index.ts` (`NalatiPlugin extends ShardPlugin`). Data shards (`ink-cel-valley`,
`pastel-plain`, `_template`) have **no plugin at all**: `game/shardfile/client.ts#ShardfileClient` runs them.

**Classification: delete** (the whole file). Every piece is either an existing host fed the wrong way or one of
the hosts in §5. Per piece:

| Piece | Lines | Goes to | Why (layer rule) |
|---|---:|---|---|
| Type-map augmentations | 9 | **N3** declared input / tier / slot rows (engine) | Input actions and tier knobs are engine concepts; the names are data |
| `rows()` merge + owners | 6 | **N1** (ShardfileClient reads the sections itself); owners become library *names* | A host reading its own sections needs no shard glue |
| preload / prepareClientWorld / tier knob | 8 | **N1** (data client already preloads `library` and compiles `look.materials`) | Generic boot |
| Island tile adoption | 3 | data client props tiles + look rows (§3.11) | Static world is data |
| `buildWorld` call | 2 | **N2** world scene host | Scene assembly is generic |
| Meadow | 4 | grass-field host, baked-blade mode (G478) or listed view code (§3.4) | |
| Winch `observed` callback | 6 | **data**: piece `activeWhen: {mover, atEnd}` + prompt `labels: [{flag, string}]` | A mover end-state and a label swap are rows on existing hosts |
| Quest page interactions + world targets | 4 | already data (`questHost`, `world/targets`); host call moves into N1 | |
| Held actions / socket-lift prompts | 3 | N1 (data client binds items and entryways) | |
| `far.dressing` (deck glow, mill hub, vanes) | 10 | **client channel rows** with two new numeric inputs: `flag` and `player.mode` (living buildings, G474) | Same shape as Pine's `runtime/props/buildingLife.ts:95` wheels |
| Wind fields + gust burst | 12 | updraft fields: **data** on an ambient effect-field row; gust: **cue → VFX row** (N4 as a cue feature) | `effectField` already has 3 users (Sky, Signal `world/fireFx.ts`, Pine `runtime/antlerKing.ts`) |
| `populate` | 1 | already data (`runtime.spawns`); N1 | |
| Ray wake | 6 | **view code** (§3.3) or engine trail profile (N5) | One user |
| `bindPageFight` | 1 | already data (`fight`, `quests/directors`); boss fight host (G474) | |
| Gale-wall telegraph | 15 | **boss telegraph row** on the approved boss fight host (G474): `{strike:'far.roc.galeWall', shape:'lane-sheet', colour, opacity:[0.06,0.22], reach:26}` | Pine `combat/chargeTells.ts` and DW captain strikes are the other users |
| `finishRaise` | 1 | capture row → mover command (data) | |

**Target form (N1).** No file. The product declares:

```json
"runtime": { "entry": null, "binds": [] },
"clientChannels": [{ "id": "far.deck.glow", "inputs": [{ "input": "board", "source": "player.mode", "equals": "board" }],
  "nodes": [{ "op": "read", "index": 0 }, { "op": "clock", "value": "time" }, "..."],
  "outputs": [{ "property": "value", "target": "hover-glass.emissiveIntensity" }] }],
"cues": { "far.gust": { "vfx": [{ "field": "gustStreaks", "at": "aim", "offset": [0, -0.25, 0.2] },
                                 { "field": "gustPetals",  "at": "aim" }], "sound": "cue.sword.heavy" } },
"bosses": { "far.roc": { "telegraphs": [{ "strike": "far.roc.galeWall", "kind": "laneSheet", "height": 5,
            "depth": 0.4, "colour": "#c8f1f8", "opacity": [0.06, 0.22], "reach": 26, "lift": 2.5 }] } }
```

**Lines:** −127 Sky. Platform: N1 is mostly *moving* `HybridRuntimePlugin` features into `ShardfileClient` (§4.1),
net negative; channel inputs ~+40; cue VFX ~+50; telegraph rows ~+60 inside the approved boss host.

#### The winch, in detail (the one AS candidate)

Today: the winch prompt calls `plugin.clientChannels.runtime.command('far.winch.bridge', 1)` through a
`BorrowedOwnerPath` row in the product (`questHost.page.bindings.calls[0]`), the mover's pose feeds `observed`,
which writes `built.state.raised`, which (a) turns the fallen bridge's collider on (`world/build.ts:106`
`active: () => state.raised`) and (b) satisfies the quest observation `world.state.raised`.

Target, preferred (**data, zero AS**): an interaction row `{ spot: 'winch', needs: ['far.roost','far.vanes'],
mover: { id: 'far.winch.bridge', action: 1 } }` on `game/quest/interactionRows` (Signal's `InteractionRules` is
its user), the piece row `activeWhen: { mover: 'far.winch.bridge', atEnd: true }`, and the quest observation
`{ kind: 'mover', mover: 'far.winch.bridge', state: 'at-end' }` (that kind already exists, `ui.ts:1287`).

Target, fallback (**AS, ~10 lines**), only if interaction rows can't command a mover:

```ts
export function onInteract(spot:i32, player:i32):void {
  if(spot!=Spot.winch || Read.flag(Flag.raised)==1) return;
  if(Read.flag(Flag.roost)==0 || Read.flag(Flag.vanes)==0) { Do.cue(0, Cue.winchStuck); return; }
  Do.mover(Mover.winchBridge, MoverAction.raise);   // NEW command
}
export function onSignal(id:i32, value:f64, from:i32):void { if(id==Signal.winchAtEnd) Do.flag(0, Flag.raised, 1); }
```

That needs two ABI changes: route the existing `interact` event in `decisions.ts`, and a **new command `mover`**
(target mover id, action). Signal's well bucket is the second user of both.

### 3.2 `world/build.ts` — 105 lines — the world assembly

**What it does.** Builds the static world in a fixed order, yielding a frame between pieces (op-hitch41/OP5: a grid
cell built it in one 366 ms task on the Simulator). For each of six generated scene recipes (ground, static, routes,
fixed-early, mill, furniture, vanes, crown, storm, islets) it creates the scene with `createWorldScene` or
`createClientScene`, resolves its **ports** (which geometry, which material, which model texture), registers the parts
as world pieces with colliders, and yields. It also binds the islet pose channels and the winch/notes prompts.

```ts
const geometry = (name: string): BufferGeometry | null => name === 'fall' ? WORLD.geometry('geometries','fall',{index:'identity',empty:true})
  : name.startsWith('hero-') ? models.get(name.slice('hero-'.length))?.geometry ?? null : SKY_LIBRARY.geometry(name);
const staticScene = createWorldScene(staticRows.recipe, { geometry, materials, model: SKY_LIBRARY.model, baked: WORLD.object });
await pieces.scene(staticScene, staticRows.bindings, pause);
await pause();
```

**Who calls it.** `runtime/index.ts#build` once at world time.

**Equivalents.** Signal `world/build.ts` (107) + `world/places.ts` (31, `createWorldScene` + `bindWorldSceneParts`);
Driftwood `world/build.ts` (200, `buildDriftwoodWorld`) and `runtime/npc/Castaway.ts`/`Trader.ts`
(`createClientScene` + `bindWorldSceneParts`). The scene format itself (`format/clientChannels#parseWorldScene`)
already has Sky and Signal generators (`generators/restScene.ts` in both).

**Classification: game host (N2), the shard keeps data.** The code is 90 % port resolution that is a lookup into a
model library or a bake by name; the special cases (`'fall'` → bake geometry, `'hero-*'` → painted model, `look:model`
material strings) are a naming convention that belongs in the scene rows.

**Target form.** Host API:

```ts
/** game/shardfile/worldScenes.ts — runs a product's `world/scenes` section in order, paced. */
export interface WorldSceneRow {
  readonly id: string; readonly recipe: WorldSceneRecipe; readonly bindings: readonly PieceBinding[];
  readonly yield?: 'each-piece' | 'scene';                    // op-hitch pacing as data
  readonly mount?: 'root' | 'islet-channels';
}
export type PortRef =
  | { readonly geometry: { readonly library: string; readonly name: string } }
  | { readonly geometry: { readonly bake: string; readonly kind: string } }
  | { readonly material: { readonly look: string; readonly map?: { readonly model: string } } }
  | { readonly material: { readonly standard: StandardRow } };
export function runWorldScenes(ctx: LevelContext, product: ShardProduct, libraries: LibraryRegistry): Promise<WorldScenes>;
```

Sky declares `world/scenes.json` (one row per scene above, generated by its existing generators). **Lines:** −105 Sky
(−107 Signal). Platform +~120.

### 3.3 `runtime/looks/wakeRibbon.ts` — 30 lines — the ray's luminous wake

**What it does.** A camera-facing ribbon that records where a flying ray actually went (one sample every
`row.every` s), widest behind it and fading out, rebuilt every frame.

```ts
for (let i = 0; i < n; i++) {
  const p = trail[i] ?? at, q = trail[Math.min(n - 1, i + 1)] ?? p;
  dir.subVectors(p, q); if (dir.lengthSq() < 1e-6) dir.set(0, 0, 1);
  toCam.subVectors(camera, p);
  side.crossVectors(dir, toCam).normalize().multiplyScalar(row.width * (1 - i / (n - 1)) * 0.5 + 0.05);
```

**Who calls it.** `runtime/index.ts` builds one per `rays` actor and updates it in the `late` phase every frame.

**Equivalents.** `engine/combat/view/slashTrail.ts` (a two-point blade-sample ribbon, used by Nine
`runtime/viewmodel/brushTrail.ts` and the engine sword). Nalati `ride/Reins.ts` is a different contract. No other
shard has a single-point creature wake.

**Classification: shard view code (listed), single-shot today.** It draws every frame, is unique, and has no second
user. The honest generalisation is a *profile* on the engine's `SlashTrail` ("follow one point, face the camera"),
not a new host; do that only if Pine's bolt tracers or Nine's portal streaks want it.

**Target.** Keep as listed view code (30). If N5 lands as a `SlashTrail` profile: data row
`{ "trail": { "follow": "actor", "samples": 24, "every": 0.05, "width": 1.2, "look": "ray-wake" } }` on the creature's
species look, −30 Sky, +~25 engine.

### 3.4 `world/meadow.ts` — 25 lines — the near meadow blades

**What it does.** Decodes the baked blade bytes (`generators/meadowBlades.ts`) into one three.js `LOD` per 8 m chunk,
each level an `InstancedBufferGeometry` sharing two card geometries, drawn in the `meadow` graph. Phone tier draws
only each chunk's first blades. Nothing runs per frame.

```ts
const buffer = new InstancedInterleavedBuffer(bytes.subarray(at, at + count * 8), 8); at += count * 8;
const lod = new LOD(); lod.position.set(view.getFloat32(o, true) + MEADOW.tile / 2, view.getFloat32(o + 8, true), view.getFloat32(o + 4, true) + MEADOW.tile / 2);
for (const [level, c] of cards.entries()) {
  const g = new InstancedBufferGeometry(); geometries.push(g); g.instanceCount = drawn; g.setIndex(c.index);
```

**Who calls it.** `runtime/index.ts#build` once.

**Equivalents.** Nalati `look/grass.ts` on `game/systems/looks/grassField.ts` (+ `sdk/looks/tileField.ts`) — the
approved "grass field rows" platform feature (G478, ~298 lines). Different algorithm: Nalati's is a streamed,
trampled, runtime-placed field; Sky's is pre-baked chunks.

**Classification: borderline — listed view code now, a "baked blades" mode of the grass-field host later.** It is
static instanced geometry from a bake, which is exactly what the platform's baked kinds already do, minus LOD. A
generic engine "baked instanced LOD chunks" loader would have users (Sky meadow, Pine/DW scatter) but nobody has
asked for it.

**Target.** Grass-field row `{ "kind": "bakedChunks", "bytes": "meadow-blades", "tile": 8, "lods": [24, 60],
"look": "meadow", "tierKnob": "grassSlots" }` (and use the engine's existing `grassSlots` tier knob instead of
`far.meadowBlades`). −25 Sky, +~40 game.

### 3.5 `look/render.ts` — 39 lines — the painted look

**What it does.** Builds Sky's `LookStrategy`: parses the dome/dressing graph JSON with valibot, loads four painted
textures, and passes a TS `dressing` callback to the engine's `paintedLookFromRow` that builds a sun-glow card group,
a vortex disc, the cloud-sea discs and the cumulus cards.

```ts
const dressing = async (ctx: PaintedDressingContext): Promise<PaintedDressing> => {
  const group = new Group(); group.name = 'far.sky-dressing';
  const glow = await ctx.graph(rows.glow.graph); cardGroup({ material: () => glow }, rows.glow.cards, {}, { into: group });
  if (seaPaint !== null) {
    if (vortex !== null) group.add(discLayer(await ctx.graph(rows.maelstrom.graph, () => vortex), rows.maelstrom.disc));
    for (const sea of rows.seas) group.add(discLayer(await ctx.graph(sea.graph, () => seaPaint), sea.disc));
  }
```

**Who calls it.** The manifest's `render` binding (discovery) at shard boot, before the world.

**Equivalents.** Signal `look/render.ts` (40, same `paintedLookFromRow`, a `terrain` callback for the skirt); Pine
`look/render.ts` (12, keyed sky backdrop); Nalati `look/render.ts` (28) on `engine/world/painterly.ts`.

**Classification: engine (the approved painterly look host, G478 (3)).** The schema in this file is the host's row
schema; the dressing callback is three row kinds (`cards`, `disc`, later `shell`).

**Target.** `look/painted.json`:

```json
{ "painted": { "row": "...existing paintedLook row...", "lut": "far-reach",
  "images": { "pano": { "phone": "...", "desktop": "..." }, "cloudAtlas": "...", "seaPaint": "...", "vortex": "..." },
  "dome": { "phone": "graph:dome-phone", "desktop": "graph:dome-desktop", "textures": { "haze": "strip", "*": "pano" } },
  "dressing": [
    { "kind": "cards", "graph": "glow", "cards": "glow" },
    { "kind": "disc", "graph": "maelstrom", "texture": "vortex", "disc": { "radius": 900, "at": [0, -60, 0], "order": -5 } },
    { "kind": "disc", "graph": "sea-1", "texture": "seaPaint", "requires": "seaPaint", "disc": "..." },
    { "kind": "cards", "graph": "cumulus", "texture": "cloudAtlas", "cards": "cumulus" } ] } }
```

**Lines:** −39 Sky (−40 Signal). Platform: the dressing loop and schema move into the engine (~+60), the `dressing`
callback type is deleted.

### 3.6 `runtime/looks/discLayer.ts` — 16 lines

**What it does.** One `CircleGeometry` mesh laid flat, unculled, at a row's position, render order and spin.

```ts
const mesh = new Mesh(new CircleGeometry(row.radius, row.segments), material);
mesh.rotation.x = -Math.PI / 2; mesh.position.set(row.at[0], row.at[1], row.at[2]); mesh.renderOrder = row.order; mesh.frustumCulled = false; mesh.name = row.name;
```

**Who calls it.** `look/render.ts` dressing only. **Equivalents:** none in another shard; Nalati's painterly sky has
its own cloud layers. **Classification: engine, as a dressing row kind of the painterly look host** (it is a
primitive, not a Sky idea). **Target:** row kind `disc` above. **Lines:** −16 Sky, +~8 engine.

### 3.7 `world/shapes.ts` (23), `world/mill.ts` (14), `models/gear.ts` (11), `roster.ts` (6) — Explorer specimens

**What they do.** `routeScenePorts` resolves the bridge/vane scenes' ports (post model, `post-weather` look);
`bridgeKit()`, `vane()` and `towerMill()` build one specimen each for the Model Explorer *and* the world (the mill's
hub is the spinning part); `gear.ts` feeds five rows to `modelCatalogue` with three TS builders; `roster.ts` lists
them plus the rig library's creatures for the Explorer.

```ts
export const [fanEntry,windmillEntry,bridgeEntry,keeperEntry,vaneEntry] = modelCatalogue(GEAR_SCENE_ROWS,{owners:new Map<string,unknown>([...Object.entries(FAN_HELD_OWNERS),['npcModels',HERO_LIBRARY],['npcLooks',SKY_LIBRARY]]),source,builds:[
  ['mill',()=>towerMill().group], ['bridge',bridgeKit],
  ['vane',vane],
]});
```

**Who calls it.** `roster.ts` at Explorer boot (lazy via discovery `roster`); `towerMill`/`vaneGeometry`/
`routeScenePorts` also from `world/build.ts`.

**Equivalents.** Every shard has a `roster.ts`: Pine 60, Nalati 44, Driftwood 39, Signal 13, Nine 10. Signal's
`models/gear.ts` (15) is the same `modelCatalogue` call.

**Classification: game host (N10 declared Explorer catalogue) + N2 scene rows.** A specimen is "build scene X with
the same ports as the world" — data once N2 exists.

**Target.** `explore/catalogue.json`: `[{ "id": "far.mill", "scene": "mill", "ports": "world" }, { "id": "far.fan",
"held": "weapon.far-reach.fan" }, { "id": "far.keeper", "npc": "far.keeper" }, { "rigs": "species" }]`.
**Lines:** −54 Sky (−28 Signal). Platform +~60.

### 3.8 `world/meshes.ts` — 18 lines — model libraries

**What it does.** Two `createModelLibrary` calls whose config is entirely generated JSON (mesh names, URLs, geometry
pools, rigs, painted models), plus four one-line accessors.

```ts
export const SKY_LIBRARY = createModelLibrary<SkyMeshName, never>({ meshes: files.SKY_MESHES as SkyMeshName[], preparedMeshes: files.SKY_MESHES as SkyMeshName[], meshUrls: files.MODEL_URLS, hd: [], hdUrls: {}, aoFloor: files.SKY_AO_FLOOR, hdLooks: {},
  geometryPools: [files.FAN_POOL, ...REST_POOLS, BRIDGES.pool, files.ISLET_POOL, MILL_REST], rigs: rows.species.library, rigLoad: 'manual', mappedFallback: { roughness: 0.85, metalness: 0 } }, '[far-reach]');
```

**Who calls it.** Imported by almost every other Sky file. **Equivalents:** Signal `world/meshes.ts` (27, identical
shape); Pine `world/treeFactory.ts`, Nine `world/casts.ts`, Nalati weapons all call `createModelLibrary`; the data
client has `game/shardfile/clientLibrary.ts#leaseClientLibrary` reading the product's `library` section.

**Classification: shard data** (a `library` section) read by the existing library host. **Target:**
`"libraries": { "sky": { "meshes": "...", "pools": ["fan","rest","bridges","islets","mill"], "rigs": "species" },
"hero": { "painted": "heroes" } }`. **Lines:** −18. Platform +~10 (a second library row shape in `clientLibrary`).

### 3.9 `world/baked.ts` (20) and `world/isle.ts` (21) — the baked pieces and the islands

**What they do.** `baked.ts` builds `WORLD = bakedMeshWorld(...)` over the baked pieces with a **TS material
callback** that maps a kind's `look` to `SKY_LIBRARY.look`, or `paint` to the island material, and loads the
deflated byte resources (islands, meadow blades). `isle.ts` holds the islands' `GeometryPack`, the island material
fallback, `islandMesh(id)` for the moving islets and `adoptIsleTile` which indexes the props tile's `isle_*` meshes.

```ts
export const WORLD = bakedMeshWorld<BakedPiece, BakedMeshKindRow>(WORLD_ROWS.bakes, files.BAKED_URLS, 'far-reach', {
  resources, readBytes: fetchDeflated, placements:{rows:WORLD_ROWS.pieces as readonly WorldPieceRow<BakedPiece>[],colliders:STATIC_SCENES.standalone.fixed.colliders},
  material: kind => 'look' in kind && typeof kind.look === 'string' ? SKY_LIBRARY.look(kind.look) : 'paint' in kind ? isleMaterial() : undefined,
  attributes: { _shk: 'aShk', _farcloth: 'aFarCloth' },
});
```

**Who calls it.** World build (pieces), meadow, islets, mill, shapes. **Equivalents:** Signal `world/baked.ts` (22,
same `bakedMeshWorld`); Pine `runtime/world/codeParts.ts` and Nalati `world/spruceView.ts` (`GeometryPack`); the
data client draws `props` tiles itself (`game/shardfile/props.ts`, `clientWorld.ts`).

**Classification: shard data.** The material callback is a lookup the host can do from the kind row (`look` or
`paint` is already in the row); the islands should be props tiles the data client draws with a look row instead of
being handed to the runtime (`runtime.binds: ['props']`).

**Target.** Kind rows `{ "name": "isle", "look": "isle-paint" }`; `"bakes": { "resources": [...], "attributes":
{ "_shk": "aShk", "_farcloth": "aFarCloth" } }`; props rows `{ "tile": "...", "look": "isle-paint" }`. **Lines:**
−41 Sky, −39 G294 (`bindRuntimeProps` family deleted). Platform: `bakedKinds` gains `look`-row resolution (~+10,
deletes the `material`/`decorate` callbacks), props rows gain `look` (~+15).

### 3.10 `weapons/fanModel.ts` (7) and `runtime/weapons/heldFan.ts` (5)

**What they do.** `paintFanLeaf` replaces the fan's `silk` material with the `fan-silk` look mapped over the leaf
texture; it is called by the held-melee host through a `BorrowedOwnerPath` (`melee.decorate.call =
heldStyle.paint`, `value = plugin.leaf`). `heldFan.ts` is the owner map (`library`, `hero.read`) and two type aliases.

```ts
export function paintFanLeaf(parts: { readonly root: Object3D; readonly material:(id:string)=>MeshStandardMaterial }, leaf: Texture): void {
  const original=parts.material('silk'), silk = SKY_LIBRARY.mappedLook('fan-silk', leaf);
  parts.root.traverse((part) => { if (part instanceof Mesh && part.material === original) part.material = silk; });
}
```

**Equivalents.** Signal `runtime/items/heldWhip.ts` (same owner map); Driftwood's held-arms material binding (approved
G475 "held viewmodel arms … material binding"). **Classification: shard data** on the approved held material binding.
**Target:** `"materials": [{ "slot": "silk", "look": "fan-silk", "map": { "texture": "leaf" } }]` in the held recipe.
**Lines:** −12. Platform +~20 (inside the approved feature).

### 3.11 `plugin.ts` (7) and `runtime/source.ts` (3)

`plugin.ts` exports the standalone entry and a trusted-runtime resolver; `source.ts` parses
`product.generated.json` at import time (one of the 23 runtime JSON imports that stop Sky closing).
**Equivalents:** every shard's `plugin.ts`. **Classification: delete under N1** (the platform builds the shard from
`shard.json`; the runtime reads `ctx.product`). **Lines:** −10.

### 3.12 `data/rocSlate.json` — 7 lines of GLSL

A three-edit `onBeforeCompile` patch that recolours the Roc's brown/gold texels to slate (`farSlate`), applied by
`generators/creatureLooks.ts`. **Classification: shard data, but not shader text.** **Target:** bake the recolour into
the Roc's texture in the generator (zero runtime cost, zero shader), or a look-graph node (`colourRemap`) if Jake wants
it live. **Lines:** −7.

### 3.13 G294: `bindRuntimeProps` + `bindRuntimeProductProps` + `isMesh` — 39–40 lines (platform, charged to Sky)

Covered in §4.10. **Delete.**

---

## 4. Every platform module only Sky (and Signal) use

Totals from the declaration walk (shard users only; "app" = the shell also reaches it):

| Module | Sky+Signal-only lines | Main declarations |
|---|---:|---|
| `game/plugin/headless.ts` | 621 | `HybridRuntimePlugin` 326, `runtimeHomeWork` 45, `HybridRuntimeRows` 32, `bindRuntimePersistence` 25, `runtimeEquipment` 21, `bindRuntimeBossRecord` 20, `bindRuntimeMelee` 18, `bindRuntimeHomes` 16, … |
| `game/plugin/ui.ts` | 571 | `bindClientChannels` 120, `installPersistedQuest` 46, `bindPageQuestStages` 44, `bindBorrowedPageQuestStages` 43, `createClientChannelPrompt` 27, `bindDeclaredFight` 27, `installBorrowedPageQuest` 23, `rowBossSpec` 23, `BossView` 20, `createWorldScene` 18, … |
| `engine/render/dataLook.ts` | 311 | `paintedLook` 129, `painterLightGlsl` 26, `NEUTRAL_FRAGMENT` 19, `PaintedLookSpec` 16, `paintedStripSky` 14, `headingHaze` 10, `paintedLookFromRow` 9, … |
| `game/shardfile/bakedKinds.ts` | 235 | `bakedMeshWorld` 68, `worldPieces` 40, `bakedMeshKindsGroup` 33, `bakedKindsGroup` 25, … |
| `game/plugin/weaponFamily.ts` | 201 (app too) | `HeldMeleeWeapon` 117, `HeldContactWeapon` 36, `createHeldMelee` 17, `createDeclaredHeldMelee` 11 |
| `sdk/looks/cardField.ts` | 71 | `cardGroup` 23, row types |
| `game/plugin/geometry.ts` | 70 | `loadPaintedTexture` 20, `pivotNpc` 19, `PaintedSampler` 9, `installPivotNpc` 8, … |
| `game/shardfile/bossRow.ts` | 52 | `installBossOwnerRow` 35, … |
| `game/shardfile/runtimeProduct.ts` | 32 (+4 Sky, +3 Signal) | `prepareClientWorld` 26, `ClientWorldPreparation` 6; Sky: `bindRuntimeProductProps` 4 |
| `game/shardfile/runtimeWorld.ts` | 35 Sky-only | `bindRuntimeProps` 30, `RuntimePropsPorts` 4, `isMesh` 1 |
| `game/plugin/audio.ts` | 22 | `installRuntimeAudio` 7, `declaredWeaponVoices` 11, `installDeclaredCombatCues` 4 |
| `game/plugin/bossStorm.ts` | 22 | `bossStorm` |
| `engine/world/Atmosphere.ts` | 14 | `weatherFog` 8, `WeatherFogSpec` 5 |
| `format/bossProfiles.ts` | 14 | `MarkedBossPresentationSchema` 8, … |
| `format/clientChannels.ts` | 11 | `parseWorldScene`, `WorldSceneSchema`, `worldImport` |
| `game/shard/retainedHooks.ts` | 10 | `installEnteredRuntimeInput` |
| `game/loot/runtime.ts` | 7 | `installRuntimeLoot` |
| `game/plugin/quests.ts` | 5 | `npcDef`, `NpcMotion` |
| `format/runtimeSpawns.ts` | 4 | row types |
| `game/plugin/simulation.ts` | 3 | `commandSocketLift` |
| `game/systems/audio/silentScore.ts` | 3 | `installSilentScore` |
| `game/shardfile/homeKeeper.ts`, `engine/blocks.ts` | 2 | types |
| **Total** | **2,281 + 39 Sky + 18 Signal** | |

### 4.1 `HybridRuntimePlugin` and its helpers (`game/plugin/headless.ts`, 621)

**What it does.** An abstract base class (G345) that runs a "hybrid" shard's stages in a fixed order: `world`
(strings, decision Wasm assets, `build()`, held factory, level bounds), `kit` (weapon row, species catalogue,
encounters, `prepare()`, `buildEquipment`), `play` (viewmodel + `dress()`, impulse push, entry pitch, item contexts,
input, `enter()`, audio, loot, saved page quest, client motion, mode columns, `install()`, quest flags, debug expose).

```ts
export abstract class HybridRuntimePlugin extends ShardPlugin {
  protected abstract rows(product: ShardProduct): HybridRuntimeRows;           // headless.ts:693
  protected abstract build(ctx: ShardContext): Promise<void> | void;           // :846
  protected abstract install(ctx: ShardContext, loot: ScopedLoot | null): Promise<void> | void;  // :884
  protected prepare(_ctx: ShardContext): void { /* none by default */ }        // :886
  protected dress(_ctx: ShardContext, _weapon: HybridWeapon): void { /* none by default */ }  // :888
  protected enter(_ctx: ShardContext): void { /* none by default */ }          // :890
```

**Who calls it.** Sky `runtime/index.ts`, Signal `plugin.ts`, at entry; nobody else (Driftwood has its own
`runtime/hybrid.ts`).

**Equivalent.** `game/shardfile/client.ts#ShardfileClient` already does the same job for data shards: items,
audio (`installDeclaredAudio`), loot, quests, targets, UI, compendium, scripts — from sections, with no subclass.

**Real or disguised?** Disguised. It is a shared *parity wrapper* for two trusted runtimes, not a host. Evidence:
three abstract and three empty override hooks (test 6); `HybridRuntimeRows.species` may be a TS function
(`headless.ts:637`); `owners` is a map of live TS objects, and `melee.decorate` calls a shard method through a
string path (`:750-753`); `'board'` is hard-coded (`:1027`); `legacySlot` (`:662`, `:772`) and `legacyRewardSlot`
(`:1077`) carry legacy-save parity; page presentation and the sim live in one class split by hand-placed dynamic
imports ("Keep presentation out of renderer-free imports", `:906`).

**Score 2/6.** Passes 1 (Sky, Signal) and mostly 2. Fails 3 (TS functions and owner objects in its rows), 4 (sim and
presentation mixed), 5 (with N1 you would delete it, and nobody would re-create it), 6 (subclass overrides).
**Verdict: SILLY as an end state** (fine as a transitional bridge). **What it takes:** N1: move each stage into
`ShardfileClient` driven by the sections the shard already declares in `runtime.binds` (`quests, ledger, state, items,
spawns, modes, props, clientChannels`); delete the class. Sky and Signal's override bodies go to the hosts in §5.

### 4.2 `game/plugin/ui.ts` (571) — three groups

**(a) `bindClientChannels` + prompts (`ui.ts:721`, ~175 with `createClientChannelPrompt`, `moverChannelValues`).**
Mover poses feed declared visual channel programs (a small numeric DAG: clock, reads, sin, select, sample); prompts
ride the channels; it also installs the movers.

```ts
export function bindClientChannels(programs: readonly ClientChannelProgram[], ports: {
  readonly targets: ReadonlyMap<string, unknown>; readonly nativeOwners?: readonly string[]; readonly copiedOwners?: readonly string[];
  readonly bindings?: readonly { readonly updateMovers: (pose: (id: string) => MoverPose) => void }[];
  readonly kernels?: ClientGeometryKernels; readonly observed?: (id: string, frame: ClientChannelFrame) => void;
}) { ... }
```

Users: Sky (winch, islets), Signal (well bucket, `world/build.ts`). **Score 4/6**: passes 1, 2, 4 (client-only,
labelled), 5. Fails 3 and 6: `observed` is a TS callback (`:725`), prompt `named` actions are a map of TS functions,
`bindings[].updateMovers` are TS objects. **Verdict: borderline + fix → REAL GAME HOST.** Fix: `observed` becomes
channel outputs to declared targets (a prompt label, a piece's `active`, a flag); named prompts become interaction
rows or the AS `interact` event. Pine's building life (`runtime/props/buildingLife.ts`) and Driftwood's movers are
natural third users once it takes only data.

**(b) Page quest / fight / boss helpers (~330: `installBorrowedPageQuest`, `installPersistedQuest`,
`bindPageQuestStages`, `bindBorrowedPageQuestStages`, `installRewardedQuest`, `questReward`,
`presentRewardedQuest`, `installQuestNpc`, `bindDeclaredFight`, `BossView`, `rowBossSpec`, `installBossView`).**
They install a saved quest, its NPC, reward and stages, and bind the boss fight, wiring them to shard objects by
`BorrowedOwnerPath` — a row `{ owner: 'plugin', path: ['clientChannels','runtime','command'] }` that the host
resolves by walking properties of live TS objects and calling the result.

```ts
const observations=new Map((rows.observations??[]).map(row=>{
  const field=readBorrowedOwner(owners,row);if(field===null||typeof field.value!=='boolean')throw new Error('Missing page stage observation');
  return [row.id,()=>{const value=field.receiver[field.key];...}] as const;
}));
```

Sky's shipped product contains these paths (`questHost.page.bindings`: `world.state.raised`,
`plugin.clientChannels.runtime.command`, `world.winch.onInteract`, `frames.winchAt`). **Score 2/6**: passes 1, 2;
fails 3, 4 (page-only), 5 (superseded by the approved quest step runner G474), 6 (string-path reflection *is* a TS
callback, in a JSON coat). **Verdict: SILLY in its current form; the concepts are real** and belong to the approved
quest step runner and boss fight host (G474). Under G480 (1) the `BorrowedOwnerPath` rows are arguably code strings
inside shard JSON and should count.

**(c) `createWorldScene` + `WorldScenePorts` (+ `format/clientChannels#parseWorldScene`, ~34).** Builds a scene recipe
(nodes, imports, materials, textures) into three.js objects. Users: Sky (build, mill, shapes), Signal (`places.ts`);
DW uses its sibling `createClientScene`. **Score 5/6**: fails 6 only partly (geometry/material resolvers are TS
functions, but they are generic lookups). **Verdict: REAL GAME HOST** once ports are named library/bake references
(N2).

### 4.3 `engine/render/dataLook.ts` `paintedLook` family (311)

**What it does.** A whole painted-sky look: painted dome (graph or strips), heading haze, painter key light GLSL,
neutral tone mapping, LUT, optional 0–1 `state` that eases light and fog on curves, a `dressing` callback for sky
dressing, a `terrain` callback.

```ts
export interface PaintedLookSpec {
  ...
  readonly dressing?: (ctx: PaintedDressingContext) => PaintedDressing | Promise<PaintedDressing>;   // dataLook.ts:458
```

Users: Sky and Signal (`look/render.ts` in both). Nalati's `engine/world/painterly.ts` (321) is the third painterly
look, to fold in (G478 (3)). **Score 4/6**: passes 1, 2 (the names are engine words; "dusk" in `DuskLookRow` is a
generic word but reads as Signal's), 4 (client-only render), 5. Fails 3 and 6 (`dressing`/`terrain` callbacks).
**Verdict: borderline + fix → REAL ENGINE FEATURE (the approved painterly look host).** Fix: dressing layers as rows
(`cards`, `disc`, `shell`), the terrain skirt as a row (Signal), the `state` as a host field binding
(`shared.dusk`) instead of a passed object.

### 4.4 `game/shardfile/bakedKinds.ts` (235)

**What it does.** Loads a piece's baked GLB (one instanced node per kind), puts materials on the kinds from their
rows, builds box colliders from rows (colliders never wait on the GLB), places world pieces from rows and registers
them with the world registry. "Promoted from Signal Dunes' `world/baked.ts`" (`:11`).

```ts
export interface BakedKindsDraw<K extends BakedKindRow> {
  material?: (kind: K) => DrawMaterial | undefined;            // :72  TS callback
  decorate?: (material: MeshStandardMaterial, kind: K) => void; // :74  TS callback
  attributes?: Readonly<Record<string, string>>;               // :76  data
}
```

Users: Sky, Signal. Equivalents: `game/plugin/simulation.ts#addBakedPieces`, the data client's props tiles, Pine
`runtime/world/codeParts.ts` (GeometryPack). **Score 4/6**: passes 1, 2, 4 (colliders are rows a server can read),
5. Fails 3 partly and 6 (`material`, `decorate` callbacks). **Verdict: borderline + fix → REAL GAME HOST.** Fix: the
kind row carries `look` (Sky already writes it), the host resolves it from the compiled `look.materials`; delete
`decorate`. Longer term, fold into the C1 static-world path so there is one baked-static loader, not three.

### 4.5 `game/plugin/weaponFamily.ts` `HeldMeleeWeapon` family (201, also reached by the app shell)

**What it does.** One class with two modes: `immediate` (Sky's fan: claim, slash now, a secondary "gust" that
blows) and `delayed` (Signal's whip: unroll, slack, crack at a delay, catch a world target, taut rope).

```ts
onGust: ((from: Vector3, dir: Vector3) => void) | null = null;               // weaponFamily.ts:457
gust(): void { ... this.onGust?.(aim.from, aim.dir); this.blow(aim.from, aim.dir); }   // :508-515
crackWorld(from: Vector3, dir: Vector3, reach: number, second: boolean) ...   // :520
if (!['kit.whip', 'kit.sword', 'kit.lantern'].includes(recipe)) ...          // :63
```

Users: Sky (immediate), Signal (delayed). Equivalent: `game/weapons/Sword.ts` (Nalati `runtime/weapons/mountedSword.ts`,
Pine). **Score 1/6**: passes 1 nominally only. Fails 2 (`gust`, `blow`, `onGust`, `crackWorld`, `caught`, `taut`,
`'kit.whip'`), 3 (`onGust`/`onSwing` callbacks, `bindSecondary` closure), 4 (contacts + presentation in one class), 5
(each mode has exactly one user: delete Sky and `immediate` is dead), 6. **Verdict: SILLY — two shard weapons in one
generic coat.** What it should be: a held-melee *phase player* (phases → pose channels, already rows in
`createHeldMeleeBinding`) plus contact rows (already `ContactFamily`), with the whip's rope as the existing
`tubeCurve` channel geometry (`format/clientChannels.ts:42`) and the gust as a secondary contact move + cue → VFX row.
Then both weapons are data on `Sword`-class contact rows.

### 4.6 `sdk/looks/cardField.ts` (71)

Camera-facing card clouds from baked per-instance float32 rows (sun glow and shafts, cloud puffs, fire tongues,
smoke) with optional sine pulses on uniforms. Users: Sky (look dressing), Signal (`world/fireFx.ts`). No shard nouns
("Nothing here knows a shard", `:7`). **Score 6/6. REAL (SDK look primitive, client-only).** Becomes the `cards`
dressing row of the painterly host and the fire host's flame layer.

### 4.7 `game/plugin/geometry.ts` (70)

`loadPaintedTexture` + `PaintedSampler` (29): a texture loader with sampler rows. **6/6, REAL** (generic).
`pivotNpc` family (~41): an NPC that turns to face the player, waves until met, takes a talk pose and breathes, from a
motion row. Users: Sky's keeper, Signal's Sefa. Equivalent: Driftwood's `animation.ts#stepNpcFacing` (graded *good*
in the 10-16 host audit). **Score 5/6**: fails 5 only in that it duplicates an approved facing law. **Verdict:
borderline → merge with `stepNpcFacing`** (one NPC facing law, G415 similar-not-identical).

### 4.8 `game/shardfile/bossRow.ts` (52) + `format/bossProfiles.ts` (14)

`installBossOwnerRow` binds a boss's encounter (bar, intro lock, victory, reward once, retry, saved record) from a
row. Users: Sky's Roc, Signal's Matriarch. **Score 5/6** (a `spawned` port callback). **REAL GAME HOST**; it is the
seed of the approved boss fight host (G474), with Pine's Antler King and DW's captain as its next users.

### 4.9 `game/shardfile/runtimeProduct.ts#prepareClientWorld` (32)

Loads painted textures in phases, compiles the declared look materials, applies bump rows, binds looks to a library.
Pure rows. Users: Sky, Signal, `bossStorm`. **Score 6/6. REAL.**

### 4.10 `game/shardfile/runtimeWorld.ts#bindRuntimeProps` + `bindRuntimeProductProps` (39, Sky only)

Parses each props tile GLB and hands the scene to a **runtime TS view** (`props: (tile, key, scope) => void`, `:79`)
because Sky's runtime claims `props` in `runtime.binds`.

```ts
export async function bindRuntimeProps(ctx: { readonly scope: Scope }, source: Shardfile, ports: RuntimePropsPorts): Promise<void> {  // :84
  ...
  ports.props(gltf.scene, key, scope);
```

**Score 1/6**: one user, a TS view callback, and the data client already draws props tiles. **Verdict: SILLY →
delete.** Sky lets the data client draw its islands with a `look` on the props row (§3.9).

### 4.11 `game/plugin/bossStorm.ts` (22) + `engine/world/Atmosphere.ts#weatherFog` (14)

A spawned boss fight's storm from the marked boss presentation row: weather fog eased by storm strength, plus
sphere shells in look graphs that read `shared.storm`. Users: Sky's Roc, Signal's Matriarch; Pine's weather is the
natural third. **Score 6/6. REAL** (game presentation over an engine fog term).

### 4.12 Thin plumbing reached only through `HybridRuntimePlugin` (~55)

`audio.ts#installRuntimeAudio` (+ `declaredWeaponVoices`, `installDeclaredCombatCues`), `loot/runtime.ts#installRuntimeLoot`,
`retainedHooks.ts#installEnteredRuntimeInput`, `silentScore.ts`, `quests.ts#npcDef`, `simulation.ts#commandSocketLift`,
`runtimeSpawns.ts` types. Each is a small wrapper the data client already has a sibling for
(`engine/audio/declared#installDeclaredAudio`, `installLoot`, `ctx.inputContext`). **Score 4/6** (fail 5: duplicates;
`installRuntimeAudio` takes a `cues` callback, test 6). **Verdict: delete with N1.**

---

## 5. HOST SCORING (G454 bar) — ranked

Legend: ✓ pass · ✗ fail · ½ partial (counted as fail). Users: S = Sky, G = Signal, P = Pine, D = Driftwood,
N = Nalati, 9 = Nine, all = every shard.

### 5.1 Existing platform modules (the 2,281 + 39)

| # | Module | Lines | 1 two users | 2 no nouns | 3 data | 4 server/client-labelled | 5 deletion | 6 data-only API | **Score** | Verdict | Shard-specific part goes to |
|---|---|---:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|---|
| 1 | `sdk/looks/cardField` | 71 | ✓ S G | ✓ | ✓ | ✓ client | ✓ | ✓ | **6** | REAL (SDK look) | — |
| 2 | `bossStorm` + `weatherFog` + marked presentation schema | 50 | ✓ S G | ✓ | ✓ | ✓ client | ✓ | ✓ | **6** | REAL GAME HOST | storm rows |
| 3 | `prepareClientWorld` + `loadPaintedTexture` | 61 | ✓ S G | ✓ | ✓ | ✓ client | ✓ | ✓ | **6** | REAL GAME HOST | texture rows |
| 4 | `createWorldScene` / `parseWorldScene` | 34 | ✓ S G (D sibling) | ✓ | ✓ | ✓ client | ✓ | ½ resolver fns (`ui.ts:2022`) | **5** | REAL GAME HOST after named ports | scene rows (N2) |
| 5 | `bossRow#installBossOwnerRow` | 52 | ✓ S G | ✓ | ✓ | ✓ | ✓ | ½ `spawned` port | **5** | REAL GAME HOST → boss fight host (G474) | boss rows |
| 6 | `pivotNpc` family | 41 | ✓ S G | ✓ | ✓ | ✓ client | ½ dup of `stepNpcFacing` | ✓ | **5** | borderline: merge with DW facing law | NPC motion rows |
| 7 | `bakedKinds` | 235 | ✓ S G | ✓ | ½ | ✓ | ✓ | ✗ `material`/`decorate` (`:72,:74`) | **4** | borderline + fix | kind `look` rows |
| 8 | `bindClientChannels` + prompts | 175 | ✓ S G | ✓ | ½ | ✓ client | ✓ | ✗ `observed`, `named` (`ui.ts:725`) | **4** | borderline + fix | channel output rows; AS `interact` |
| 9 | `paintedLook` family | 311 | ✓ S G (+N to fold) | ½ "dusk" | ½ | ✓ client | ✓ | ✗ `dressing`/`terrain` (`dataLook.ts:458`) | **4** | borderline + fix → painterly host (G478) | dressing rows |
| 10 | audio/loot/input/score/npcDef/socketLift wrappers | 55 | ✓ S G | ✓ | ✓ | ✓ | ✗ dup of data client | ✗ `cues` callback | **4** | delete with N1 | data client |
| 11 | Page quest / fight / boss helpers (`ui.ts`) | ~330 | ✓ S G | ✓ | ✗ | ✗ page-only | ✗ superseded (G474) | ✗ `BorrowedOwnerPath` | **2** | SILLY form, real concepts | quest step runner + boss host rows; AS for unique rules |
| 12 | `HybridRuntimePlugin` + headless helpers | 621 | ✓ S G | ½ `'board'` (`:1027`), `legacySlot` | ✗ TS fns in rows (`:637`) | ✗ mixed | ✗ | ✗ abstract hooks (`:693,:846,:884-890`) | **2** | SILLY end state (transitional) | N1 into `ShardfileClient` |
| 13 | `HeldMeleeWeapon` (immediate/delayed) | 201 | ½ one user per mode | ✗ `gust`, `crackWorld`, `'kit.whip'` | ✗ | ✗ | ✗ | ✗ `onGust` | **1** (counting 1 as pass) | SILLY | contact rows + phase player; whip rope = `tubeCurve`; gust = cue VFX |
| 14 | `bindRuntimeProps` family (Sky only) | 39 | ✗ | ✓ | ✗ | ✓ | ✗ | ✗ `props` view (`runtimeWorld.ts:79`) | **1** | SILLY → delete | props `look` rows |

**Totals (a):** 6/6 = 182 lines; 5/6 = 127; 4/6 = 776; 2/6 = ~951; 1/6 = 240. Only **~309 lines (14 %) pass
the bar outright** (score ≥ 5); **~1,190 (51 %) are shard logic in a generic coat** (score ≤ 2). If the score-≤2
modules were graded as Sky/Signal code, Sky would carry roughly half of them (~600) and sit near 17 %, not 7.8 %.
That is the honest risk the audit flagged.

### 5.2 Proposed hosts and features (to reach zero), including N1–N10

| # | Proposal | Layer | Users (real today) | 1 | 2 | 3 | 4 | 5 | 6 | **Score** | Verdict | Sky declares |
|---|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|---|---|
| A | **N1 declared runtime entry** (= `ShardfileClient` owns the 8 `runtime.binds` sections; delete the plugin class) | game | all data shards, S, G | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **6** | REAL GAME HOST (extends an existing one) | nothing; `runtime.entry: null` |
| B | **N10 Explorer catalogue** | game | all (6 `roster.ts`) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **6** | REAL GAME HOST | `explore/catalogue.json` |
| C | **N2 world scene assembly** (paced, named ports) | game | S, G, D (`createClientScene` NPC scenes) | ✓ | ✓ | ✓ | ✓ client | ✓ | ✓ | **6** | REAL GAME HOST | `world/scenes.json` |
| D | **Painterly look host** (G478, approved) | engine | S, G, N | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **6** | REAL ENGINE FEATURE | `look/painted.json` |
| E | **Boss telegraph rows** (inside approved boss host, G474) | game | S gale wall, P `combat/chargeTells.ts`, D captain | ✓ | ✓ | ✓ | ✓ client | ✓ | ✓ | **6** | REAL GAME HOST | telegraph row |
| F | **Client channel inputs `flag`, `player.mode`** (living buildings, G474) | game | S decks/mill/vanes, P `buildingLife.ts:95` wheels | ✓ | ✓ | ✓ | ✓ client | ✓ | ✓ | **6** | REAL GAME HOST | channel rows |
| G | **Held material binding** (approved, G475) | game | S fan leaf, D arms | ✓ | ✓ | ✓ | ✓ client | ✓ | ✓ | **6** | REAL GAME HOST | `materials` in held recipe |
| H | **Props / baked kinds `look` rows** (fix of #7, #14) | game | S, G, data shards | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | **6** | REAL (a fix, not a host) | `look` on rows |
| I | **N3 declared input actions, tier knobs, slots** | engine | S (action, knob, slot), G (slot, `weapons/slots.merge.d.ts`) | ✓ | ✓ | ✓ | ✓ | ✓ | ½ needs generated types | **5** | REAL ENGINE FEATURE | `input/actions`, `tiers` rows |
| J | **N4 as "cue → VFX"** (a cue row can burst a declared effect field at actor/aim) | game | S gust; P antler-king fields, G fire flare plausible | ½ | ✓ | ✓ | ✓ client | ✓ | ✓ | **5** | REAL GAME HOST if it lives in the cue router | cue row |
| J′ | N4 as "weapon-action effect burst" (its own host) | game | S only | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | **4** | single-shot: don't build | — |
| K | **Grass field, baked-chunk mode** (G478 approved host) | game | S meadow, N grass (different algorithm) | ½ | ✓ | ✓ | ✓ client | ½ | ✓ | **4** | borderline: only if the mode stays small | grass row |
| L | N9 eased shared field (+ AS `sharedField` command) | game | G dusk; P weather | ½ | ✓ | ✓ | ✓ | ✓ | ✓ | **5** | sibling's call; fold into weather reactions | — |
| M | N7 fire FX host | game | G only | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | **4** | fold into approved light emitters (G478) | — |
| N | **N5 trail ribbon** | engine | S only (Nine/engine use `SlashTrail`, a different contract) | ✗ | ✓ | ✓ | ✓ client | ✗ | ✓ | **4** | single-shot: keep Sky view code, or a `SlashTrail` profile if a second user appears | — |
| O | N8 baked terrain skirt + lent tile material | engine | G only | ✗ | ✓ | ✓ | ✓ | ✗ | ✓ | **4** | single-shot (Signal) | — |
| P | (N6 is absent from the audit's list) | | | | | | | | | | | |

### 5.3 One ranked table, highest first

| Rank | Piece | Score | Verdict |
|---:|---|:-:|---|
| 1 | N1 declared runtime entry (ShardfileClient owns binds) | 6 | REAL GAME HOST |
| 1 | N10 Explorer catalogue | 6 | REAL GAME HOST |
| 1 | N2 world scene assembly | 6 | REAL GAME HOST |
| 1 | Painterly look host (G478) | 6 | REAL ENGINE FEATURE |
| 1 | Boss telegraph rows (G474) | 6 | REAL GAME HOST |
| 1 | Client channel inputs flag / player.mode (G474) | 6 | REAL GAME HOST |
| 1 | Held material binding (G475) | 6 | REAL GAME HOST |
| 1 | Props / baked-kind `look` rows | 6 | REAL (fix) |
| 1 | `cardField` | 6 | REAL (SDK) |
| 1 | `bossStorm` + `weatherFog` | 6 | REAL GAME HOST |
| 1 | `prepareClientWorld` + `loadPaintedTexture` | 6 | REAL GAME HOST |
| 12 | `createWorldScene` | 5 | REAL after named ports |
| 12 | `installBossOwnerRow` | 5 | REAL → boss host |
| 12 | `pivotNpc` | 5 | borderline: merge |
| 12 | N3 input / tier / slot rows | 5 | REAL ENGINE FEATURE |
| 12 | N4 as cue → VFX | 5 | REAL GAME HOST |
| 12 | N9 eased shared field (Signal) | 5 | fold into weather |
| 18 | `bakedKinds` | 4 | borderline + fix |
| 18 | `bindClientChannels` | 4 | borderline + fix |
| 18 | `paintedLook` | 4 | borderline + fix → D |
| 18 | Hybrid plumbing wrappers | 4 | delete with N1 |
| 18 | Grass field baked mode | 4 | borderline |
| 18 | N4 as its own host, N5 trail, N7 fire, N8 skirt | 4 | single-shot / fold |
| 26 | Page quest/fight/boss helpers (`BorrowedOwnerPath`) | 2 | SILLY form |
| 26 | `HybridRuntimePlugin` | 2 | SILLY end state |
| 28 | `HeldMeleeWeapon` | 1 | SILLY |
| 28 | `bindRuntimeProps` | 1 | SILLY → delete |

---

## 6. One-page summary: piece → classification → target → lines

| Piece | Lines | Classification | Target form | −Sky | +Platform (est.) |
|---|---:|---|---|---:|---:|
| `runtime/index.ts` | 127 | delete | N1 + channel rows + cue VFX + telegraph row + interaction/mover rows | 127 | ~150 (N1 net ≈ 0: moves ~620 out of `headless.ts`) |
| `world/build.ts` | 105 | game host N2 | `world/scenes.json` | 105 | 120 |
| `look/render.ts` | 39 | engine (painterly, approved) | `look/painted.json` | 39 | 60 |
| `runtime/looks/wakeRibbon.ts` | 30 | **view code (single-shot)** | stays; or `SlashTrail` profile | 0 (30 if N5) | 0 (25) |
| `world/meadow.ts` | 25 | **view code** / grass-field baked mode | stays; or grass row | 0 (25 if K) | 0 (40) |
| `world/shapes.ts`, `mill.ts`, `models/gear.ts`, `roster.ts` | 54 | game host N10 + N2 data | `explore/catalogue.json` | 54 | 60 |
| `world/baked.ts`, `world/isle.ts` | 41 | shard data | kind/props `look` rows | 41 | 25 |
| `world/meshes.ts` | 18 | shard data | `libraries` section | 18 | 10 |
| `runtime/looks/discLayer.ts` | 16 | engine (painterly dressing row) | `{kind:'disc'}` | 16 | 8 |
| `weapons/fanModel.ts`, `runtime/weapons/heldFan.ts` | 12 | shard data (approved held binding) | `materials` row | 12 | 20 |
| `plugin.ts`, `runtime/source.ts` | 10 | delete (N1) | — | 10 | 0 |
| `data/rocSlate.json` GLSL | 7 | shard data (bake) | baked texture | 7 | 0 |
| G294 `bindRuntimeProps` family | 39–40 | delete | data client props | 40 | −39 |
| **Total** | **528** | | | **473 (528 with N5 + K)** | |
| `behaviour/roc.as` (AS column) | 53 | shard AS | stays | — | — |
| Winch (optional) | — | data (preferred) or AS ~10 | interaction row / `winch.as` | — | ABI: `interact` routing + `mover` cmd |

Platform side if the plan lands: delete `HybridRuntimePlugin` + page helpers + wrappers + `bindRuntimeProps` + the
fan/whip modes (~1,250 lines), add N1/N2/N3/N10, painterly rows, channel inputs, cue VFX, telegraph rows (~700).
**Net platform ≈ −550 lines**, and every remaining Sky/Signal-only line scores ≥ 4.

---

## 7. What is genuinely missing

### 7.1 Engine features

| Feature | Users | Notes |
|---|---|---|
| Painterly look dressing as rows (`cards`, `disc`, `shell`), state as host field | S, G, N | the approved painterly host (G478); replaces `dressing`/`terrain` callbacks |
| N3 declared input actions / tier knobs / equipment slots (generated type maps) | S, G (all later) | today a TS `declare module` in Sky `runtime/index.ts:25-33` and Signal `weapons/slots.merge.d.ts` |
| (optional) `SlashTrail` "follow point, camera-facing" profile | S only | do not build until a second user |

### 7.2 Game hosts

| Host | Users | Notes |
|---|---|---|
| N1: `ShardfileClient` owns `quests, ledger, state, items, spawns, modes, props, clientChannels` | S, G, all data shards | deletes `HybridRuntimePlugin`; the real prerequisite for closing |
| N2: world scene runner (`world/scenes`, paced, named ports) | S, G, D | absorbs `world/build.ts` in Sky and Signal |
| N10: Explorer catalogue rows | all | absorbs 6 `roster.ts` |
| Client channel inputs: `flag`, `player.mode`; outputs to prompt labels and piece `active` | S, P (living buildings) | replaces the `observed` callback and Sky's dressing system |
| Cue → VFX (effect-field burst at actor/aim) | S, (P, G) | N4 done right |
| Boss telegraph rows | S, P, D | inside the approved boss host |
| Interaction row → mover command | S winch, G well | lets the winch stay data |
| Held material binding | S, D | approved (G475) |
| Props / baked-kind `look` rows | S, G, data shards | a fix to `bakedKinds` and the props rows |

### 7.3 AssemblyScript ABI

| Item | Status | Users |
|---|---|---|
| move, strike, stop, timer, `Read.nearestPlayer`, threshold/move.done/strike.done/death events | exist, used by `roc.as` | S, G |
| `interact` event routing in `game/shardfile/decisions.ts` | declared in ABI v1, **not wired** | S winch (if AS), G well |
| `mover` command (target mover id, action) | **new** | S winch (if AS), G well bucket |
| `sharedField` write (host-private shared field) | **new** (audit's one) | G dusk; P weather later |
| spawn / despawn / impulse / weather | declared, refused at admission | not needed by Sky |
| view.* 100–104 | declared, no owner | not needed if cue → VFX lands |

---

## 8. Single-shot: do NOT build a host for these

| Thing | Where it should live |
|---|---|
| Sky's ray wake ribbon (`wakeRibbon.ts`) | listed Sky view code (30) |
| Sky's baked meadow chunks (`meadow.ts`) | listed Sky view code (25), unless the grass-field host takes a small baked mode |
| "Weapon-action effect burst" as its own host (N4 as written) | a cue row instead |
| The gale-wall sheet | one row on the boss telegraph feature |
| The fan "gust" and the whip "crack" modes | contact rows + cue VFX + `tubeCurve`; delete the `HeldMeleeWeapon` modes |
| `paintFanLeaf` | a material slot row |
| The Roc's slate recolour GLSL | baked into the texture at build time |
| Hover-deck glow, mill hub, vanes | client channel rows |
| The winch | an interaction row (or ~10 lines of AS) |
| Signal's skirt (N8) and fire host (N7) | Signal data / light emitters (sibling) |
| `bindRuntimeProps` | delete |

---

## 9. The honest floor for Sky

- **With the hosts above (N1, N2, N3, N10, painterly rows, channel inputs, cue VFX, telegraph rows, held material
  binding, `look` rows):** Sky's counted TS is **55 lines** — `runtime/looks/wakeRibbon.ts` (30) and
  `world/meadow.ts` (25), both true per-frame or per-chunk drawing with no second user. They stay as listed view
  code with a written reason.
- **With N5 as a `SlashTrail` profile and a grass-field baked mode as well:** **0 TS**. Both fail the rule of two
  today, so I don't recommend them.
- **AssemblyScript:** 53 (`roc.as`), +10 only if the winch goes to AS instead of an interaction row. Budget 677.
- **Without N1:** about 140 lines stay no matter what (`runtime/index.ts` page wiring + `plugin.ts` + `source.ts`),
  because something has to subclass `HybridRuntimePlugin`. N1 is the one approval that matters most.
- **The bigger risk is not Sky's 528.** It is the ~1,190 Sky/Signal-only platform lines that score 2/6 or less.
  Under an honest host review they are Sky/Signal code. The plan to zero should delete them (N1 and the
  `HeldMeleeWeapon` split) rather than add new hosts beside them.

### Evidence index (file:line)

- `src/game/plugin/headless.ts:693, 846, 884, 886, 888, 890` abstract/override hooks; `:637` species as TS function;
  `:750-753` decorate via `BorrowedOwnerPath`; `:1027` `'board'`; `:662, :772, :1077` legacy parity.
- `src/game/plugin/ui.ts:721-725` `bindClientChannels` `observed` callback; `:1287` mover observation kind;
  `:1328` borrowed stages; `:1481` `installBorrowedPageQuest`; `:2022, :2030` scene ports.
- `src/game/plugin/weaponFamily.ts:63, 457, 508-515, 520` fan/whip nouns.
- `src/engine/render/dataLook.ts:458` `dressing` callback; `:504` `paintedLookFromRow`; `:525` `paintedLook`.
- `src/game/shardfile/bakedKinds.ts:11, 72, 74, 76, 225, 322`.
- `src/game/shardfile/runtimeWorld.ts:79, 84`.
- `src/game/shardfile/decisions.ts:132` refused commands; `:274-327` wired commands.
- `src/shards/far-reach/runtime/index.ts:25-33, 48-52, 80-84, 106-115, 125-128, 137-142, 149-162`.
- `src/shards/far-reach/data/product.generated.json` `questHost.page.bindings` (string paths into TS objects).
