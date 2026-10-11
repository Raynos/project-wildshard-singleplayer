# The shardfile design system (G299)

**Status:** **approved** 2026-10-10 (G319): the route for the rest of Part A. Its rows are SF79–SF86, and G312–G318 answer §8.
**Plan:** [SHARD-PLATFORM](../SHARD-PLATFORM.md) (G290–G311, SF24–SF78)
**Evidence:** [the as-built audit](../../reviews/shardfile-architecture-audit-2026-10-10.md), plus a fresh run of `node scripts/shard-platform.mjs` and an import walk of the six shardfile folders on `76ad95bb8`.
**Made by:** design-system (Opus). This is a design document. It changes no code.

**In one paragraph.** A shard is infrastructure as code. The author writes **rows** and **generators** in TypeScript
against `@wildshard/sdk`. The generators use **real three.js** in Node, plus SDK classes for the game ideas three.js
lacks (colliders, spawns, entries, items, quests). `wildshard build` turns that into a scene description, bakes it with a
content-hash cache, and writes the **shardfile**: rows, tiles, colliders, GLBs and WASM. `@wildshard/game` loads that
and `@wildshard/engine` runs it. Behaviour goes, in order of preference: a row on a shared system, then a new generic
system, then AssemblyScript, then `runtime/` as a last resort. `runtime/` reaches the game only through the plugin
modules that game's `package.json` `exports` lists. Shared things live in `@wildshard/commons`, but only once two shards
use them.

---

## 1. The picture

### 1.1 The pipeline, end to end

```
src/shards/<slug>/            author inputs
  shard.config.ts  defineShard(): the root
  data/            rows ...................┐
  generators/      three.js + SDK .........┤
  blender/*.py  →  assets/*.glb (committed)┤
  quests/          quest graphs ...........┤
  behaviour/       AssemblyScript .........┤
                                           ▼
@wildshard/sdk  (+ @wildshard/commons on top of it)
  synth  → .wildshard/cache/<slug>/scene.json
           (inspectable, diffable, never committed)
  bake   → tiles + LODs, colliders, far proxy,
           GLBs, textures, compiled WASM
           Node by default; GPU bakes in a browser lane
           content-hash cache; only small expensive
           outputs are committed (G292)
  validate → budgets, entries, content gate, report card
                                           ▼
public/shardfiles/<slug>/      the shardfile (gitignored)
  shard.json · rows · tiles · colliders · *.glb · *.wasm
                                           ▼
@wildshard/game  loader → admission → systems
@wildshard/engine  renders, simulates, plays
                                           ▲
src/shards/<slug>/runtime/  trusted TS (≤ 20 %)
  imports @wildshard/game/plugin/* only (G307)
```

It works the way AWS CDK does. Generators are the CDK app, `scene.json` is the synthesized CloudFormation template, and
the shardfile is the deployed stack. Like Zod → JSON Schema, every row type is a valibot schema, and its JSON Schema is
generated from it (§2.6).

### 1.2 The words, one sentence each

| Term | What it is | Tiny example |
|---|---|---|
| **Shardfile** | The compiled build product the game (and one day an MMO server) loads unchanged: only data, WASM and baked assets, never TypeScript. | `public/shardfiles/sunscar-dunes/shard.json` plus its tiles |
| **Data row** | A plain, serialisable record that a shared system reads, validated by a schema, with no code inside. | `{ id: 'weapon.whip', family: 'lash', light: { damage: 12, range: 4.5 } }` |
| **Generator** | Build-time TypeScript that builds a three.js scene graph plus SDK game objects, then emits rows and geometry. It never ships. | `generators/tower.ts` returns a `Group` of meshes, colliders and a spawn |
| **Scene synth** | The step that turns generator output into `scene.json`, a readable description of every node, material, light, collider and spawn, before baking. | `wildshard synth sunscar-dunes` writes `.wildshard/cache/sunscar-dunes/scene.json` |
| **Bake** | The step that turns `scene.json` and source assets into shardfile bytes (tiles, LODs, colliders, GLBs, textures), cached by content hash. | `bakeKinds` folds 130 tower meshes into 8 instanced kinds |
| **Committed output** | A bake result that lives in git because it is small and costly to rebuild, or because it needs a GPU. It carries a DO-NOT-EDIT header and a regenerate-and-compare check. | `baked/map.webp`, the top-down map render |
| **Behaviour** | AssemblyScript in `behaviour/`, compiled to WASM inside the shardfile, for logic no row can express (G309: AS stays). | `behaviour/skitterer.as`: Signal's custom scuttle brain |
| **`runtime/`** | The shard's trusted TypeScript, shipped as a separate first-party chunk next to the shardfile. It is the temporary 20 % and is never sent to the MMO. | Pine's `runtime/king*.ts`: the Antler King's pose keeper |
| **Plugin interface** | A module that `@wildshard/game` lists in its `package.json` `exports` for `runtime/` to import, such as registering a brain or a weapon family. | `import { registerWeaponFamily } from '@wildshard/game/plugin/weaponFamily'` |
| **Commons pack** | A build-time module in `@wildshard/commons`, built on the SDK, that emits shared content: models, rigs, clips, sounds, material graphs, or a partial shardfile from a reusable generator (G310). It only exists once 2+ shards use it. | `commons/packs/creatures/wolf` emits a rigged wolf GLB, its clips and its species row |
| **Shared system** | Game code that runs a kind of row (directors, brains, movers, modes, weapon families). It counts as public only once 2+ shards, or the template, use it (G294). | `game/shardfile/directorRuntime.ts` runs any director row |

---

## 2. Each layer's job and its import rules

### 2.1 The layers

| Layer | Its job | May import | Guards |
|---|---|---|---|
| **engine** `@wildshard/engine` | Rendering, physics (the only Rapier import), input, audio, boot, the headless sim host, and generic AI and motion laws. It knows nothing about Wildshard. | `three`, Rapier, nothing of ours | `layer`, `engine-words`, `tsc -b` layers, `sim-no-render` |
| **game** `@wildshard/game` | Wildshard itself: grid, travel, saves, HUD, the shardfile loader and admission, the runtime hosts of shared systems, and the **plugin interfaces** | engine | `shard-names`, `no-shard-branch`, `no-level-identity`, G294 user count |
| **format** (proposed, Q2) `@wildshard/format` | The shardfile schema (valibot) and its generated JSON Schema: the contract the SDK writes and the loader reads | `valibot` only | `layer` |
| **sdk** `@wildshard/sdk` | The authoring library: game-concept classes, synth, bake, validate, AS compile, the CLI. It never runs in the game. | `three`, format, engine pure helpers (math, config constants). For the CLI's preview only: game. It never re-exports any of them. | `no-reexport`, new `sdk-no-facade`, `check-chunks` (keeps it out of the client bundle) |
| **commons** `@wildshard/commons` | The shared library on top of the SDK: assets and reusable generator code that 2+ shards use (G310) | sdk, `three` | build-time only (G139); new `commons-users` report |
| **shard** `src/shards/<slug>/` | Everything particular to one shard, including all the code that generates its shardfile (G298) | per folder, see §2.3 | `shard-sandbox`, `shard-game-imports`, layout check |

Imports point down only: engine → (format) → game → sdk → commons → shards. A shard never imports another shard.

### 2.2 How game says what is public (G307, Jake's mechanism)

Plain TypeScript and ES modules, with no wrapper package and no import-map tricks:

1. **`@wildshard/game`'s `package.json` `exports` map lists the public plugin modules.** This is the E432 / E434
   mechanism the layers already use, and `public-index` enforces it. A module the map doesn't list can't be imported
   from outside the package.
2. **TypeScript visibility keeps internals internal.** Unexported functions and `private` members stay private inside a
   listed module. A plugin module exports the interface and the register call, never the host's state.
3. **The plugin modules live in one folder, `src/game/plugin/`,** so "public to shards" is one folder and one prefix in
   the exports map. `shard-sandbox` lets `runtime/` import only `@wildshard/game/plugin/*`, and nothing outside
   `runtime/` may import game at all.

Today the game exports **329** modules, and the six shardfile folders import **91** distinct ones. The target is about
a dozen plugin modules, and anything else the app shell needs moves inside the package:

| Plugin module | What a trusted `runtime/` file does with it |
|---|---|
| `plugin/context` | reads its `ShardContext` (scope, events, saves namespace, HUD slots) |
| `plugin/headless` | installs its sim systems on the `SimHost` (the bridge, §5) |
| `plugin/brain` | `registerBrain(archetype, factory)` for a custom TS brain |
| `plugin/bossPhase` | `registerBossPhase(id, step)` for a phase no row covers |
| `plugin/weaponFamily` | `registerWeaponFamily(id, create)` (the lash, the war fan) |
| `plugin/playerMode` | `registerDrivenMode(id, driver)` (ride, grapple, until they are rows) |
| `plugin/mover` | `registerMoverDriver(id, step)` for a non-track mover |
| `plugin/director` | subscribes to director events for presentation |
| `plugin/look` | trusted raw-GLSL material programs (G306) |
| `plugin/clientScript` | presentation-only views over declared state (SF25) |
| `plugin/ui` | declared panels and markers |
| `plugin/audio` | cue and stem hooks |

The `exports` map applies to every consumer of a package, not one at a time. That is why the game's internal consumers
(the composition root, the grid, boot) import game modules relatively from inside the package, and why the map shrinks
to `./plugin/*`. The SDK doesn't need game at all once the schema moves to `format` (Q2).

### 2.3 Inside a shard folder

| Folder | Holds | Ships as | May import | Counts as (G291) |
|---|---|---|---|---|
| `shard.config.ts` | `defineShard({...})`, the root | `shard.json` | sdk, commons, own files | SDK-driven |
| `data/` | rows (TS objects or JSON) | rows | sdk (types and builders), commons ids | SDK-driven |
| `generators/` | three.js + SDK build code, and the shard's baker entries | never ships | `three`, sdk, commons, own files | SDK-driven |
| `blender/` | Blender Python that writes `assets/*.glb` | never ships (the GLB is committed, G293) | `bpy`, `scripts/blender/lib/` | not code |
| `assets/` | committed source GLBs, images, audio | baked | — | not code |
| `quests/` | quest graphs, dialogue | rows | sdk | SDK-driven |
| `behaviour/` | AssemblyScript | WASM | the SDK's AS library (§4.1) | its own column (Q4) |
| `runtime/` | trusted TypeScript | a separate trusted chunk | `@wildshard/game/plugin/*`, `three`, own files; engine imports during the transition (ratchet) | **custom** |
| `baked/` | committed outputs (G292) with DO-NOT-EDIT | baked | — | never counted |

The build cache is `.wildshard/cache/<slug>/` (gitignored), keyed by the content hash of each producer's inputs.

### 2.4 What moves where from today

| What | Today | Moves to | Row |
|---|---|---|---|
| One-user systems (293 files, 22k lines) | `src/game/systems/*`, `src/sdk`, `src/engine` | each shard's `runtime/` or `generators/` | SF76 (in flight) |
| ~193 SDK runtime facades (`export const X: typeof Y = Y`) | `src/sdk/{looks,kit,items,runtime,…}` | deleted; callers import `@wildshard/game/plugin/*` | SF78 |
| Game's public surface | 329 exports | about 12 `./plugin/*` modules | DS0.2 |
| The format schema | `src/game/shardfile/*Schema` | `@wildshard/format` (Q2) | DS1.1 |
| Shard bakers still in repo scripts | 16 shard-named files in `scripts/bake/` (`driftwoodHut.mjs`, `nalati-world-inventory.mjs`, `pine-world-inventory.mjs`, `qara.ts` …) and `scripts/bake/directors.mjs` | each shard's `generators/`; AS compiles inside `wildshard build` | DS0.4 |
| Blender scripts | `scripts/blender/{driftwood-isle,pine-hollow,nine-dragon-stack,far-reach-*,blender-template}/` | `src/shards/<slug>/blender/` (G298); `scripts/blender/lib` stays shared | DS0.4 |
| Nine's "kit" vocabulary (`ruledKit`, `sweptKit`, `classKit` …) | `game/systems/kit` | Nine's `generators/` (one user) | SF76 |
| Raw GLSL "shader-family rows" (~4,100 lines) | shards' `data/` | `runtime/looks/` through `plugin/look` (G306) until graphs | DS0.5 |
| Content 2+ shards share (species models, clips, starter weapons, sounds) | game systems + kit leftovers | commons packs (G310) | DS1.6 |
| One-user AI archetypes (13 in `engine/ai`) | engine | merged into 5 parametric archetypes (§4.2) | BR rows |

### 2.5 One guard per rule

| Rule | Guard | State |
|---|---|---|
| `runtime/` imports game only through `plugin/*` | `wildshard/shard-sandbox` + `wildshard/shard-game-imports` (ratchet, 233 sites at seed) | exists; tighten it to `plugin/*` |
| Nothing outside `runtime/` imports game or engine | new `wildshard/generator-imports`: `generators/`, `data/` and `quests/` import only `three`, sdk, commons and their own files | new (520 shard files violate it today) |
| Shard → engine imports shrink to zero | new `shard-engine-imports` count, separate from `layer-edges` (puts back what G288 removed from G143) | new |
| No wrappers in the SDK | new `wildshard/sdk-no-facade`: refuses re-binding or aliasing a game or engine value or type in `src/sdk` | new |
| A system is public only with 2+ users (G294) | `scripts/shard-platform.mjs` sole-user column, plus a pre-commit warning when a new game or commons module has exactly one shard importer | the column exists; the warning is new |
| Outputs regenerate and are never hand-edited (G290, G292) | `bake-check`: DO-NOT-EDIT header, then regenerate and compare on every committed output | exists; `bake-pine-spots` still lacks a test |
| The SDK and generators never ship | `check-chunks`, `no-runtime-generator` | exists |
| A ported shard ships its world (G304) | SF77 content gate in `shard-platform.mjs` | SF77 |
| Shard layout | `lint/shard-layout.json` gains `blender/` and `baked/` | DS0.4 |

### 2.6 Schemas: the Zod → JSON Schema shape

Every row type is one valibot schema in `format` (today: `game/shardfile/*.ts`). From each schema we derive three things:
the TypeScript type (`InferOutput`), its JSON Schema (`@valibot/to-json-schema`, generated at build time, never
committed), and its SHARDFILE.md section (SF45 already proves 5,046 / 5,046 paths). Outside tools and the MMO server read
the JSON Schema, and authors get the types.

### 2.7 Should engine and game merge? (after M3, G305)

**Recommendation: merge them after M3, into one package `@wildshard/game` whose public surface is `./plugin/*`, and keep
`src/game/engine/` as a folder that the `engine-words` lint guards.**

- **Why merge.** Since G307, shard authors see one boundary, game's exports map. The engine / game split protects no
  shard. It costs two exports maps, two tsc projects, and 1,280 game → engine edges to keep counted. The relocation the
  audit found went *into game*, so the split didn't stop it either.
- **What we keep.** The "engine knows no Wildshard" rule is worth keeping, and it is a lint, so it works on a folder as
  well as on a package. `sim-no-render` keeps the headless sim importable on its own (`./sim` in the exports map, for the
  MMO).
- **Gate.** Merge once M3 is green, `shard-engine-imports` is at 0 for every ported shard, and `engine-words` is clean.
  If shards still import the engine at M3, fix that first: a merge would hide those imports.

---

## 3. The SDK, shaped like three.js

### 3.1 The basis: real three.js in Node (G311, decided)

**Generators build ordinary three.js scenes in Node and hand them to SDK calls such as `bake(scene)`.** The SDK is
**bake plus the game concepts three.js lacks** (spawns, colliders, entries, quests, items, brains, movers, modes). It is
not a set of look-alike classes, and three.js never ships inside a shardfile. A Wildshard generator is a three.js
program, so every three.js skill carries over unchanged, which is G301's whole point. The SDK's game-concept classes
subclass `Object3D`, so they sit in the same scene graph and `bake` finds them as it walks it.

**What runs where (the GPU-bake split):**

| Runs in plain Node (default, build-time cache) | Renders pixels: headless browser through `browser-lane.sh`, or a CPU path |
|---|---|
| scene graph, transforms, `BufferGeometry` and every geometry class, merging, instancing | the top-down map render (SF66) |
| materials as data (family or graph), lights as rows | texture bakes that render: impostors, far-proxy cards, light or AO bakes |
| GLB export (`sdk/bake/glb` `staticGlb`), skinned clip sampling (`bake/skinned`) | look parity captures (proofs, not outputs) |
| terrain tiles, LODs, colliders (Rapier runs in Node, so the physics bake should too) | |
| KTX2 encoding (wasm, CPU) | |

Pixel bakes (maps, textures, cards, GPU AO) run in a headless browser, or on a CPU path where one exists (a CPU
rasteriser for the top-down map, CPU AO for vertex colours). The browser ones are by nature "small and expensive" (G292): they are committed with DO-NOT-EDIT, and the nightly regenerates
and compares them. Vercel and CI never need a browser to build. The audit found physics bakes that need a page today.
They move to Node (DS1.5).

### 3.2 The target module list

**Straight from `three` (the bake reads these as they are):**

| three.js | What the bake makes of it |
|---|---|
| `Scene`, `Group`, `Object3D`, position / rotation / scale, `name` | node transforms; `name` is the stable object id |
| `Mesh` + `BufferGeometry`, `BoxGeometry`, `CylinderGeometry`, `ExtrudeGeometry` … | static geometry cut into 62.5 m tiles |
| `InstancedMesh` | an instanced kind (draws stay instanced, never facade multi-draw) |
| `LOD` | explicit levels, used as given; without an `LOD` the bake makes them (`bake/worldLod`) |
| `SkinnedMesh`, `Skeleton`, `AnimationClip`, `KeyframeTrack` | a skinned GLB and its clips |
| `Texture`, `DataTexture`, `CanvasTexture` | KTX2 or WebP library images |
| `MeshStandardMaterial`, `MeshPhysicalMaterial` | the `pbr` family |
| `MeshToonMaterial` | the `toon` family |
| TSL node materials (`three/tsl`) | an SF59 graph file, approved nodes only (no code nodes, G306) |
| `DirectionalLight`, `HemisphereLight`, `AmbientLight` | look rows (sun, sky / ground, ambient) |
| `PointLight`, `SpotLight` | light rows (new; missing today) |
| `Fog`, `FogExp2` (`scene.fog`) | the fog row |
| `PositionalAudio` (an emitter in the graph) | an ambience-zone or cue row |
| `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` | **refused** in `generators/` (raw GLSL is trusted only, G306) |

**From the SDK (game concepts with no three.js twin; each is an `Object3D` subclass or a row builder):**

| Module | Classes | Emits |
|---|---|---|
| `@wildshard/sdk/bake` | `bake(scene, identity)`: walks a plain three.js `Scene`, then synthesizes, bakes and validates | the whole shardfile |
| `@wildshard/sdk/physics` | `BoxCollider`, `CapsuleCollider`, `HullCollider`, `MeshCollider`, `surface` tags | collider rows |
| `@wildshard/sdk/materials` | `ToonMaterial extends MeshToonMaterial` (bands, rim), `PainterlyMaterial`, `graph(tslNode)` | family or graph materials |
| `@wildshard/sdk/look` | `Sky`, `DayCycle` (keys over the three.js lights), `PostStack`, `Lut` | look rows |
| `@wildshard/sdk/entries` | `Entry` (the 8 × 15 m socket; `Entry.midpoints()` gives the four), `Portal`, `SocketLift` | entry and portal rows |
| `@wildshard/sdk/spawns` | `PlayerStart`, `Spawn` | spawn rows |
| `@wildshard/sdk/creatures` | `Species`, `Grazer`, `Diver`, `Stalker`, `Guardian`, `ScriptBrain`, `Boss` (§4.2) | species, brain, boss rows |
| `@wildshard/sdk/items` | `Weapon`, `Tool`, `Loadout` (§4.5) | item rows |
| `@wildshard/sdk/quests` | `Quest`, `Step`, `Dialogue` | quest rows |
| `@wildshard/sdk/director` | `Director`, `Stage` (§4.1) | director rows |
| `@wildshard/sdk/movers` | `Mover` (an `Object3D` plus an `AnimationClip`), `RopeBridge` (§4.3) | mover rows |
| `@wildshard/sdk/modes` | `Water`, `HoverDeck`, `GrappleAnchor`, `Mount`, `Zipline`, `Updraft` (§4.4) | mode rows |
| `@wildshard/sdk/audio` | `AmbienceZone`, `Cue`, `Score` | audio rows |
| `@wildshard/sdk/ui` | `Marker`, `Panel`, `Interaction` | declared UI rows |
| `@wildshard/sdk/state`, `/ledger` | `SharedField`, `Fact`, `Reward` | state and ledger rows |
| `@wildshard/sdk/behaviour` | `script('behaviour/x.as')`, plus the typed AS library `@wildshard/sdk/as/*` | WASM + ABI |
| `@wildshard/sdk/bake/*` | the existing bakers (`terrain`, `kinds`, `props`, `skinned`, `texture`, `world`) | called by `bake`; authors rarely touch them |
| `@wildshard/sdk/cli` | `wildshard synth / build / validate / dev` | — |

The audit counted 229 SDK exports. This list keeps about 25 modules, and the 13 that are the SDK's own library today
(`bake/*`, `compileScript`, `modelGeometry`, `skinnedModel`, `commons`) carry over.

### 3.3 One small scene as a generator (~30 lines, the way Jake wants it)

```ts
// src/shards/ember-camp/generators/camp.ts
import { ConeGeometry, BoxGeometry, Group, InstancedMesh,
  Matrix4, Mesh, MeshStandardMaterial, PointLight } from 'three';
import { ToonMaterial } from '@wildshard/sdk/materials';
import { BoxCollider } from '@wildshard/sdk/physics';
import { Spawn } from '@wildshard/sdk/spawns';
import { Stalker } from '@wildshard/sdk/creatures';

const canvas = new ToonMaterial({ color: '#c9a355', bands: 3 });
const wood = new MeshStandardMaterial({ color: '#7a5634', roughness: 0.9 });
const CRATES = [[2, 0.4, 1], [2.9, 0.4, 1.2], [2.4, 1.2, 1.1]];

/** A traveller's camp: a tent, three crates, a fire, and the wolf that guards it. */
export function camp(): Group {
  const root = new Group();
  root.name = 'camp';

  const tent = new Mesh(new ConeGeometry(2.5, 3, 6), canvas);
  tent.name = 'camp.tent';
  tent.position.set(0, 1.5, -3);
  tent.add(new BoxCollider({ size: [4, 3, 4] }));
  root.add(tent);

  const crates = new InstancedMesh(new BoxGeometry(0.8, 0.8, 0.8), wood, CRATES.length);
  CRATES.forEach(([x, y, z], i) => crates.setMatrixAt(i, new Matrix4().makeTranslation(x, y, z)));
  crates.add(new BoxCollider({ perInstance: true }));
  root.add(crates);

  const fire = new PointLight('#ff9a3c', 2, 8);
  fire.position.set(0, 0.6, 1);
  root.add(fire);

  root.add(new Spawn({ species: 'commons:wolf', at: [-3, 0, 2],
    brain: new Stalker({ sight: 18, leash: 12, pack: 1 }) }));
  return root;
}
```

The shard root composes it the way any three.js app composes a scene, then hands the scene to `bake`:

```ts
// src/shards/ember-camp/shard.config.ts
import { Scene } from 'three';
import { bake } from '@wildshard/sdk/bake';
import { Entry } from '@wildshard/sdk/entries';
import { camp } from './generators/camp';

const scene = new Scene();
scene.add(camp().translateX(40).translateZ(-12));
scene.add(...Entry.midpoints());   // the four 8 m road entries
export default bake(scene, { slug: 'ember-camp', name: 'Ember Camp', accent: 'sand' });
```

### 3.4 The same scene as a data row

This is what `wildshard synth` writes into `scene.json` for the generator above. An author can also write it directly
in `data/` with no generator, as the Blender Template does with its GLB.

```ts
// src/shards/ember-camp/data/camp.ts
import type { SceneNode } from '@wildshard/sdk/bake';

export const CAMP: SceneNode = {
  name: 'camp', position: [40, 0, -12], children: [
    { name: 'camp.tent', position: [0, 1.5, -3],
      mesh: { geometry: { cone: [2.5, 3, 6] }, material: 'canvas' },
      collider: { box: [4, 3, 4] } },
    { name: 'camp.crates',
      instances: { geometry: { box: [0.8, 0.8, 0.8] }, material: 'wood',
        at: [[2, 0.4, 1], [2.9, 0.4, 1.2], [2.4, 1.2, 1.1]] },
      collider: 'perInstance' },
    { light: { point: { color: '#ff9a3c', intensity: 2, distance: 8 } },
      position: [0, 0.6, 1] },
    { spawn: { species: 'commons:wolf',
      brain: { archetype: 'stalker', sight: 18, leash: 12, pack: 1 } },
      position: [-3, 0, 2] },
  ],
};
```

Both forms bake to the same tiles, colliders, light row and spawn row. The generator is sugar over the row, which is
G150's "sugar library on top of the raw geometry".

### 3.5 Same bytes on Mac and Linux (G300, later)

Most drift comes from the libm's last ulp in `Math.sin` / `Math.cos` inside three.js geometry. Instead of reimplementing
the math, **quantise at the bake boundary**: positions to 0.1 mm, normals to 16-bit octahedral, matching meshopt's
quantisation. With that, last-ulp noise almost never changes a byte. The report-only Linux comparison CI (`ee963ec56`)
measures what is left. It is not a gate (G300).

---

## 4. Five mini plans

Each plan follows G295's order: rows on a shared system first, then a generic system built with a second user in mind,
then AssemblyScript, then `runtime/` last. Row ids are proposals (DS / DIR / BR / MV / PM / WP / OS). Lanes: **X** =
Codex (engineering), **O** = Opus (anything visual or judged by eye), per G289 and the current 3 Opus + 5 Codex split.
Sizes: S ≤ ½ day, M ≤ 2 days, L ≤ 5 days.

### 4.1 Directors

**The problem.** Shard-wide pacing (finales, quest clocks, night, raids, boss arenas) lives in trusted TypeScript. The
director rows that exist hold only a hash, bounds and events, and the AS behind them is written against raw memory
offsets (`load<f64>(16384+i*8)`). Readability is F by G302.

**Today.** `DirectorSchema` (`game/shardfile/director.ts`, 25 lines) + `directorRuntime.ts` (116) host it.

| Shard | Director today | Pacing still in `runtime/` |
|---|---|---|
| Driftwood | `behaviour/director.as` (41 lines, the finale: altar → captain → reward) | `finale.ts`, `scriptFinale.ts`, `captain.ts` |
| Pine | `behaviour/director.as` (36) | `questDirector.ts`, `questClock.ts`, `scriptClock.ts`, `night.ts` |
| Nalati | `behaviour/director.as` (35) | raid and ghost-volley keepers |
| Sky Reach | none | `rocEncounter.ts` |
| Signal | none | `signalPlan.ts`, `data/matriarchFight.ts` |
| Nine Dragon | none | portal unlock order in `portals.ts` |

That is 3 users, so it is public under G294. The audit notes it runs only from `runtime/creatures`, with no director rows
in `data/` yet.

**The design.** Most directors are a stage machine, so the row is one:

```ts
director: {
  inputs: { altarLit: 'flag:driftwood.altar', captainDead: 'actor:captain.dead',
            atCove: 'zone:cove' },
  stages: [
    { id: 'calm' },
    { id: 'summon', when: 'altarLit && !captainDead',
      do: [{ spawn: 'captain' }, { score: 'boss' }, { toast: 'finale.summon' }] },
    { id: 'won', when: 'captainDead',
      do: [{ reward: 'driftwood.finale' }, { score: 'victory' }] },
  ],
  script: null,   // or 'behaviour/finale.as' for logic beyond stages
}
```

- `when` is a bounded boolean expression over named inputs (a tiny DSL that compiles to data, which G146 allows).
- Actions come from a fixed set: spawn, despawn, set a flag, score stem, weather key, toast, reward, emit an event.
- Where AS is needed, `wildshard build` generates a typed AS module from `inputs`. The script then reads
  `inputs.altarLit` instead of an offset, and the ABI stays as it is.

```ts
// behaviour/finale.as, after: generated `inputs` / `emit`
export function on_tick(): void {
  if (inputs.altarLit && !inputs.captainDead) emit(Event.Summon);
}
```

- SDK: `new Director({ inputs, stages })` in `@wildshard/sdk/director`. Game: the existing host gains the stage
  interpreter. `plugin/director` lets `runtime/` presentation subscribe to its events.

**What each shard moves onto it.** Driftwood: the finale. Pine: the quest clock, night and the elite prelude. Nalati:
raids and the ghost volley. Sky: the roc encounter's stages. Signal: the brazier signal and the Matriarch's stages. Nine:
the portal unlock order. Template 1: a door-and-wave example, as the reference.

**What stays custom.** Cinematic presentation (the captain's entrance, camera moves), as client scripts (SF25) or
`runtime/` presentation.

**The native-runtime exit.** Deleted when the rows pass: Driftwood `finale.ts`, `scriptFinale.ts`. Pine `questDirector.ts`,
`questClock.ts`, `scriptClock.ts`, `night.ts`. Sky `rocEncounter.ts`. Signal `signalPlan.ts`. Each headless installer
then installs the director row through the platform host instead of shard code.

| Row | What | Lane | Size | Proof |
|---|---|---|---|---|
| DIR-1 | Stage-machine schema v2, the `when` DSL, the action set, the host interpreter | X | M | schema tests; headless snapshot → restore → replay hash |
| DIR-2 | Typed AS ABI codegen from `inputs`; port the three `director.as` files to it | X | M | WASM output identical in behaviour: same replay hash as before |
| DIR-3 | Driftwood finale + Template 1 example | X | M | Driftwood witness and replay unchanged; boot smoke |
| DIR-4 | Pine clock, night, prelude; Nalati raids | X | M | Pine and Nalati witnesses |
| DIR-5 | Sky roc, Signal Matriarch and signal, Nine portal order | X | M | three witnesses |

### 4.2 Creature brains

**The problem.** `speciesBrains` is a real shared host (4 shards), but **every archetype behind it has exactly one
user**, and several are near-copies. Bosses are spread across three systems.

**Today** (from the import walk on `76ad95bb8`):

| Archetype (engine/ai, lines) | Only user |
|---|---|
| `skirmisher` 107, `guardian` 118, `perchHunter` 130 | Driftwood |
| `packHowler` 165, `ledgePouncer` 191, `windStooper` 150, `pack` 475, `herd` 548, `flock` 324 | Nalati |
| `challengeGrazer` 112, `patrolDiver` 101, `phasedFlyer` 142 | Signal |
| `ramGrazer` 108, `orbitDiver` 113, `burstFlyer` 86, `phasedRaptor` 217 | Sky Reach |
| `hunt` 933 | Driftwood, Pine, Nalati (shared) |
| `BossBrain` 237, `EliteBrain` 62 | 4 and 2 shards (shared) |
| bosses in game: `phasedBoss` (812), `eliteScripts` (233) | Pine + Nalati both import them today |
| `markedBoss` / `bossFight` | Signal only |

That is five flying-diver variants (orbit, patrol, burst, phased flyer, wind stooper) and two grazers (ram, challenge),
spread across Sky, Signal and Nalati.

**The design.** Five parametric archetypes over the shared perception, navigation and strike core:

| Archetype | Replaces | Key parameters |
|---|---|---|
| `grazer` | ramGrazer, challengeGrazer, herd | herd size, flee / charge thresholds, circling slots |
| `diver` | orbitDiver, patrolDiver, burstFlyer, phasedFlyer, windStooper | cruise height, a list of attack patterns (`orbit`, `patrol`, `burst`, `stoop`) |
| `stalker` | skirmisher, packHowler, ledgePouncer, pack, hunt | sight, pack roles (lead / flank / howl), pounce ledges |
| `guardian` | guardian, perchHunter | home, leash, perch nodes |
| `script` | (exists) | an AS module over the same perception API |

```ts
species: [{ id: 'gale-wisp', rig: 'commons:bird', clips: 'commons:bird/fly',
  brain: { archetype: 'diver', sight: 40, cruise: 9, ceiling: 40,
    attacks: [{ pattern: 'orbit', radius: 14 },
              { pattern: 'stoop', strike: 'talon', cooldown: 4 }],
    flee: { below: 0.2 } } }]

boss: { id: 'storm-roc', body: 'species:roc', arena: { radius: 60 },
  phases: [{ until: 0.66, brain: { archetype: 'diver' }, strikes: ['gust'] },
           { until: 0.33, adds: [{ species: 'gale-wisp', count: 3 }] },
           { until: 0, script: 'behaviour/roc.as' }] }
```

- One `boss` row (phase thresholds, strike sets, adds, arena, and an optional AS step per phase) replaces `phasedBoss`,
  `markedBoss` / `bossFight` and `eliteScripts`.
- SDK: `new Species({...})`, `new Diver({...})`, `new Boss({...})`. Game: the parametric hosts. `plugin/brain` and
  `plugin/bossPhase` stay for trusted TS during the transition.

**What each shard moves onto it.**

| Shard | Onto rows | Onto AS (exists or new) |
|---|---|---|
| Driftwood | crabs and gulls → `guardian` / `stalker`; the captain → `boss` | — |
| Pine | wolves → `stalker`; the Antler King's phases → `boss` | elites `blackpaw`, `ghostStag`, `imperialBull`, `ironhide` (exist) |
| Nalati | howler, pouncer → `stalker`; stooper → `diver`; herds and horses → `grazer` | `qara.as` (exists) |
| Signal | grazers → `grazer`; diver, phased flyer → `diver`; the Matriarch → `boss` | `skitterer.as` (exists) |
| Sky Reach | ram grazer → `grazer`; orbit, burst → `diver`; the storm roc → `boss` | `roc.as` (new, the last phase) |
| Nine Dragon | no creatures (its walker crowd is a client script, SF25) | — |

**What stays custom.** Pine's King pose and collision keeper (`king*.ts`, the largest single custom block) until an AS
port. Nalati's taming law (an interaction, see §4.4).

**The native-runtime exit.** Driftwood `brains.ts`, `enemyBrains.ts`, `speciesBrains.ts`, `crabDecision.ts`. Sky
`flockBrains.ts`, `stormRocBrain.ts`, `roc.ts`. Nalati `headlessCreatures.ts`, `headlessCanid.ts`, `headlessElites.ts`,
`headlessGhost.ts`. Pine `elites.ts` and the phase half of `king.ts`.

| Row | What | Lane | Size | Proof |
|---|---|---|---|---|
| BR-1 | The five parametric archetypes; each old name becomes a parameter preset, so the old row names keep loading | X | L | per-species headless trace: **identical hash** where the preset is a pure re-expression of the old code |
| BR-2 | The `boss` row, merging `phasedBoss` / `markedBoss` / `eliteScripts` | X | M | Signal, Pine and Nalati boss replays: same hash |
| BR-3 | Signal + Sky onto rows (they share the most variants) | X | M | witnesses; replay |
| BR-4 | Driftwood + Nalati | X | M | witnesses; physics walk unchanged |
| BR-5 | Pine (the King's phases; the pose keeper stays) | X | M | King fight replay |
| BR-6 | One motion check where a trace had to change: a clip review by eye | O | S | real-capture clip next to the legacy clip, no board for Jake unless it looks different (G262) |

### 4.3 Movers

**The problem.** Ridden platforms and toys are rows plus an AS module each (`MoversSchema`: platform, chain, static).
Most of them only follow a path, yet each still needs a script.

**Today.** Users: Sky Reach (Rising Islets and gates as `movers` + `socketLift`, winch and rope bridges,
`behaviour/islet.as`, `bridges.as`) and Driftwood (moored boat `boat.as`, rope bridge `bridge.as`, zipline in
`runtime/zipline.ts`). That is 2 users, so public. Nine Dragon's lantern lifts (G184) are declared in `world/entries.ts`,
and its portals ride on `game/systems/portals` (one user).

**The design.** A mover is an `Object3D` with an `AnimationClip`, exactly as in three.js:

```ts
movers: [{ id: 'far.islet.north', body: 'nodes:islet_north',
  track: { clip: 'rise', loop: 'pingpong', speed: 1 },
  trigger: { kind: 'stand', delay: 0.5 },
  riders: 'carry' },
 { id: 'drift.boat', body: 'nodes:boat',
  driver: { kind: 'waves', heave: 0.4, roll: 0.06 } },
 { id: 'drift.bridge', chain: { from: 'nodes:bridge_a', to: 'nodes:bridge_b',
   planks: 18, sag: 0.6 } }]
```

- `track`: keyframes (position and quaternion over time), which the SDK reads from a three.js `AnimationClip` on the
  node. The generator author animates in three.js or Blender, and the bake writes the track.
- `trigger`: always, stand-on, interact, or a shared-state field.
- `driver`: a small fixed set (`waves` for the boat, `pendulum`, `winch`), with AS only for the rest.
- SDK: `new Mover(object, { clip, trigger })`, `new RopeBridge(...)`. Game: one host stepped in the fixed step
  (`moverRuntime.ts` exists). `plugin/mover` covers a driver no row has yet.

**What each shard moves onto it.** Sky: the islets, gates, winch and bridges. Driftwood: the boat (`waves`), the bridge
(chain), and the zipline as a mode (§4.4). Nine: the lantern lifts as `socketLift` rows, and the portals as the existing
`portalLink` rows. The others have none.

**What stays custom.** Nine's portal ride veil, which is presentation (a client script).

**The native-runtime exit.** Sky `movers.ts`, `moverRows.ts`, `headlessMovers.ts`; Driftwood `movers.ts`; Nine
`portals.ts` (the part that steps). `islet.as` and `boat.as` are deleted once the track and the `waves` driver reproduce
them.

| Row | What | Lane | Size | Proof |
|---|---|---|---|---|
| MV-1 | `track` / `trigger` / `driver` schema; the SDK `Mover` reads an `AnimationClip` | X | M | schema tests; headless replay of a fixture lift |
| MV-2 | Sky Reach onto rows | X | M | physics walk 0 stuck; rider fixtures; witness |
| MV-3 | Driftwood boat and bridge | X | S | physics walk 0 stuck; witness |
| MV-4 | Nine lifts and portals | X | M | portal-link proof; physics walk |

### 4.4 Player modes

**The problem.** SF34's registry (`engine/player/modes.ts`) matches G3: the motor modes (foot, board, swim, wade) are
platform law. But the driven modes' drivers live in shards: Nalati's ride (`ride/`, `rideBody.ts`, `rideReins.ts`,
`headlessHorse.ts`, `headlessMounted.ts`) and Nine's grapple (`grapple/`, `runtime/grapple.ts`). The traversals
(Driftwood's zipline, Sky's updraft) are runtime code.

**Today.**

| Mode | Users |
|---|---|
| hoverboard (board) | every shard (platform) |
| swim / wade | Driftwood, Nalati (platform) |
| hover-only decks | Sky Reach (`Piece.mode`) |
| ride | Nalati only |
| grapple | Nine Dragon only |
| zipline | Driftwood only |
| updraft | Sky Reach only |

**The design.** G3 says the platform owns the core verbs. So for modes, "data rows first" means **rows that set a
platform mode's parameters**, never a shard-written driver:

```ts
modes: {
  water: [{ body: 'nodes:sea', swim: true, wade: 1.2 }],
  hoverDecks: 'nodes:hover_*',
  ride: { mount: 'species:horse', gaits: [3, 7, 13], reins: 'commons:reins' },
  grapple: { anchors: 'nodes:grapple_*', range: 28, pull: 18 },
  traverse: [{ kind: 'zipline', path: 'nodes:zip_*', speed: 14 },
             { kind: 'updraft', volume: 'nodes:updraft_*', lift: 9 }],
}
```

- The renderer-free laws stay as the shared core: "one law, two hosts", like the grapple's `sim.ts`. They move from the
  shard into `game` once they have a second user.
- **The second user is the template (Q1).** G294 allows the template to count. Giving Template 1 a horse and three
  grapple anchors makes ride and grapple honestly public, and it tests them as rows.
- SDK: `new Water(...)`, `new HoverDeck(...)`, `new Mount(...)`, `new GrappleAnchor(...)`, `new Zipline(...)`,
  `new Updraft(...)`. Game: the drivers. `plugin/playerMode` stays for the transition.

**What each shard moves onto it.** Nalati: ride as a row (the taming *interaction* stays its own row plus AS). Nine:
grapple as a row. Driftwood: zipline (traverse), swim arms as a row. Sky: hover decks and the updraft (traverse). Pine and
Signal have none beyond the platform modes.

**What stays custom.** Nalati's mounted combat feel and Nine's grapple aim presentation (viewmodel, Opus).

**The native-runtime exit.** Nalati `headlessHorse.ts`, `headlessMounted.ts`, `rideBody.ts`, `rideReins.ts`,
`tamingHorsePose.ts` (the pose half). Nine `runtime/grapple.ts`. Driftwood `zipline.ts`, `ziplineLayout.ts`. Sky
`updraft.ts`.

| Row | What | Lane | Size | Proof |
|---|---|---|---|---|
| PM-1 | Mode rows schema; the `traverse` kinds (zipline, updraft) | X | M | schema tests; headless replay |
| PM-2 | Ride: move the law into game; Nalati + Template 1 horse | X | L | Nalati witness; ride replay hash; template boot |
| PM-3 | Grapple: move the law into game; Nine + Template 1 anchors | X | M | Nine witness; grapple replay; physics walk |
| PM-4 | Zipline and updraft rows (Driftwood, Sky) | X | M | witnesses; physics walk 0 stuck |
| PM-5 | Ride and grapple feel and view check | O | S | clips beside legacy |

### 4.5 Weapon rows

**The problem.** `ItemsSchema` declares melee, ranged, bow and spear contexts, but each shard's weapon *family* is
one-user TypeScript: `game/systems/items` is 2,735 lines, and Pine's and Nalati's ranged weapons run in their headless
runtimes. The viewmodel arm rigs (`toonArms`, `gloveHands`, `fpArmsRig`, `inkedRig`) are one-user each.

**Today.**

| Shard | Weapons | Family code today |
|---|---|---|
| Driftwood | Iron Sword | engine `Melee` + `weapons/IronSword.ts` |
| Pine | Longbow, Bolt Crossbow, Lever Rifle | `boltCrossbow`, `leverFirearm` (game, one user); `runtime/weapons/headless*` |
| Nalati | Recurve, Golden Bow, Sabre, Mounted Sword, Javelin, Magazine Firearm | `mountedSword`, `javelinSpear`, `magazineFirearm`, `rewardBow` (game, one user each) |
| Signal | Bullwhip | `lash*` (game, 570 lines, one user) |
| Sky Reach | War Fan | `coneFan`, `coneStrikes` (game, one user) |
| Nine Dragon | Jian, Fei Zhua (tool) | `runtime/jian.ts`, grapple tool |
| Template | starter sword and bow | `game/weapons/*` |

**The design.** A weapon row is a **family**, its **profile parameters**, a **view**, and optional **AS hooks**.
Families collapse to those with 2+ users:

| Family | Users | Covers |
|---|---|---|
| `melee` / `swept` | Driftwood, Nalati, Nine, template | swords, the sabre, the jian, mounted swing as a context |
| `bow` | Pine, Nalati, template | longbow, recurve, Golden Bow, reward bow |
| `firearm` | Pine, Nalati | lever, magazine, bolt crossbow (projectile `bolt`) |
| `thrown` | Nalati (+ template spear, Q1) | javelin |
| `lash`, `cone` | Signal, Sky (one user each) | stay trusted families through `plugin/weaponFamily` in the shard's `runtime/` |

```ts
items: [{ id: 'weapon.leverRifle', family: 'firearm',
  profile: { magazine: 6, reload: 'perRound', cycle: 0.55, spread: 0.6,
             projectile: { kind: 'bullet', speed: 320, drop: 0.2 },
             damage: { body: 38, head: 2.0 } },
  view: { model: 'assets/lever.glb', hold: 'commons:arms/rifle', clips: 'lever' },
  hook: null }]
```

- SF70's ranged and thrown contexts are the first slice of this.
- Viewmodels become a `view` row on commons arm rigs (`commons:arms/*`). One-user rigs return to their shards (SF76).
- SDK: `new Weapon({...})`, `new Tool({...})`, `new Loadout(...)`. Game: the family hosts (engine `Melee`, `Bow`,
  `Firearm`, `Thrown`, `SweptMelee` exist).

**What each shard moves onto it.** Driftwood: the sword. Pine: all three ranged weapons. Nalati: all six. Nine: the jian
(the Fei Zhua is a tool row plus the grapple mode). Template: both starters. Signal and Sky keep their family in
`runtime/`, with the item itself as a row.

**What stays custom.** The lash's rope sim and the fan's cone strikes, until a second shard wants either. Then they
graduate.

**The native-runtime exit.** Pine `runtime/weapons/headless{Crossbow,Lever,Longbow,Ranged,Loadout}`. Nalati
`runtime/weapons/*`. Nine `runtime/jian.ts`. Sky `runtime/fan.ts` shrinks to the family registration. Signal
`lashInput.ts` the same.

| Row | What | Lane | Size | Proof |
|---|---|---|---|---|
| WP-1 | Profile schema for the four shared families, finishing SF70 | X | M | schema tests; contract tests per family |
| WP-2 | Pine's and Nalati's ranged and thrown weapons onto rows | X | M | headless ranged replays; witnesses |
| WP-3 | Melee: Driftwood, Nalati swords, Nine jian, starters | X | M | combat fixtures; witnesses |
| WP-4 | `view` rows on commons arm rigs; one-user rigs back home | O | M | viewmodel parity captures |
| WP-5 | Lash and fan through `plugin/weaponFamily` from `runtime/` | X | S | Signal and Sky witnesses |

---

## 5. The native-runtime exit, per shard, and the order of work

### 5.1 Where each shard stands (fresh `shard-platform.mjs`, G291 + G294)

| Shard | Custom now | Legacy TS | 20 % budget | Lines to remove | Headless installer |
|---|---|---|---|---|---|
| Signal Dunes | 3,372 (82 %) | 4,096 | 819 | ~2,550 | 8 lines |
| Sky Reach | 5,018 (74 %) | 6,745 | 1,349 | ~3,670 | 173 |
| Nine Dragon | 11,471 (54 %) | 21,111 | 4,222 | ~7,250 | 86 |
| Driftwood | 16,760 (98 %) | 17,091 | 3,418 | ~13,350 | 108 |
| Pine Hollow | 20,686 (98 %) | 21,155 | 4,231 | ~16,450 | 186 |
| Nalati | 26,698 (94 %) | 28,294 | 5,659 | ~21,050 | 1,493 |

"Custom" means shard TS plus game or SDK code that only this shard uses. Most of the lines to remove are not behaviour.
They are static builders that go to `generators/` (which count as SDK-driven once they use the SDK) and looks that go to
graphs or `runtime/looks`.

### 5.2 What replaces each shard's bridge (G297)

| Shard | Native piece | Replaced by |
|---|---|---|
| **Signal** | `signalPlan.ts` · species · `lashInput.ts` | DIR-5 · BR-3 · WP-5 |
| **Sky Reach** | `movers.ts`, `headlessMovers.ts` · `flockBrains`, `stormRocBrain`, `roc` · `updraft.ts` · `fan.ts` | MV-2 · BR-3 · PM-4 · WP-5 |
| **Nine Dragon** | `grapple.ts` · `jian.ts` · `portals.ts` · raw GLSL looks (~2,100 lines) | PM-3 · WP-3 · MV-4 · `runtime/looks` now, graphs in 90/10 |
| **Driftwood** | `finale.ts`, `scriptFinale.ts` · `brains`, `crabDecision` · `movers.ts`, `zipline.ts` · `swords.ts` | DIR-3 · BR-4 · MV-3, PM-4 · WP-3 |
| **Pine** | `questDirector`, clocks, `night` · `elites`, King phases · ranged `headless*` · King pose keeper | DIR-4 · BR-5 · WP-2 · stays in `runtime/` (inside the budget) |
| **Nalati** | raids, ghost volley · creatures, canids, elites · horse, mounted · weapons | DIR-4 · BR-4 · PM-2 · WP-2 |

Each installer (`runtime/headless.ts`) names its replacements in a header comment, and SF72's witness fails if a
replaced file comes back. A shard's installer is deleted in the commit that makes it 80/20.

### 5.3 The order of work

| Phase | What | Gate to the next phase |
|---|---|---|
| **0. Fix the base (G308)** | SF76 move-back · SF78 delete the facades · DS0.2 game `plugin/*` exports · G291 + G294 metric and SF77 content gate (report-only, then enforced) · DS0.3 guards · DS0.4 remaining scripts into shards | no one-user platform module; SDK has no facade; metric green in CI |
| **1. The authoring core** | DS1.1–DS1.6: format package, synth, three.js bake reader, materials, lights, commons packs | Template 1 rebuilt on the new SDK, byte-identical shardfile or a deliberate re-record |
| **2. Shared systems** | DIR, BR, MV, PM, WP, each proved first on its smallest user | each row's proof |
| **3. The ports resume** | Signal → Sky → Nine → Driftwood → Pine → Nalati (smallest bridge first) | each shard: 80/20 + content gate + parity + Jake's playthrough, then its legacy folder goes |
| **4. One-shot test** | OS-1 at the end of phase 1, and again at M3 | §6 pass |
| **5. After M3** | engine + game merge (§2.7) | M3 green, `shard-engine-imports` = 0 |

The base rows:

| Row | What | Lane | Size | Proof |
|---|---|---|---|---|
| DS0.1 | (= SF76 + SF78) move-back and facade deletion | X | L | per-shard parity, as SF76 says |
| DS0.2 | `src/game/plugin/` with the ~12 modules; game exports shrink to `./plugin/*`; internal callers go relative | X | M | `public-index` green; exports count ≤ 20 beyond the frozen-legacy set: an export a registered legacy file imports stays (checked from `lint/legacy-shards.json`) and leaves with its folder (SF73) (coordinator, 2026-10-10: 83 of 107 are legacy-imported) |
| DS0.3 | Guards: `generator-imports`, `shard-engine-imports`, `sdk-no-facade`, the `plugin/*`-only sandbox | X | M | lint fixtures, ratchets seeded |
| DS0.4 | The 16 shard-named `scripts/bake/*` and 6 `scripts/blender/<shard>/` move into shard folders; `directors.mjs` into `wildshard build` | X | M | `bake-check` regenerates byte-identical |
| DS0.5 | Raw GLSL rows move from `data/` to `runtime/looks` (G306) | X | M | look parity captures (O checks) |
| DS1.1 | `@wildshard/format` + JSON Schema generation (Q2) | X | M | SF45 coverage test still 100 % |
| DS1.2 | `wildshard synth` + `scene.json` + `SceneNode` rows | X | M | Template 1 synth is stable across two runs |
| DS1.3 | The three.js bake reader (the table in §3.2), SDK physics / spawns / entries classes | X | L | Template 1 and pastel-plain rebuilt, identical bytes |
| DS1.4 | Materials and lights: `ToonMaterial`, TSL → graph, light rows | O | M | ink-cel-valley and pastel-plain looks at parity |
| DS1.5 | Physics and other page-bound bakes move to Node; GPU bakes go through the browser lane with committed outputs | X | M | `bake-check`; CI builds with no browser |
| DS1.6 | Commons packs v1: 2+-user species models, clips, arm rigs, starter weapons, sounds, plus reusable generators (G310) | X+O | M | a commons asset downloads once for two shards (SF26's test) |

---

## 6. The one-shot test (G302)

**What it proves.** An agent can build a small, good shard from the docs and the SDK alone, and its source reads like a
hand-written three.js shard.

**How it runs.**
1. A fresh agent with no memory of this repo: one Opus and one Codex run, separately. It works in a feature worktree
   (which never pushes) at `src/shards/oneshot-<date>/`.
2. It may read `docs/SHARDFILE.md`, the generated SDK docs, the commons catalogue and three.js docs. It may **not**
   read or copy any shard folder (a read-deny on `src/shards/*` except its own), `src/game` or `src/engine`.
3. The brief, the same every time: *"Mesa Outpost: a dry mesa with a well, two adobe huts, a watchtower with a ladder,
   a goat herd that flees and a hawk that dives, one quest to light the tower beacon at dusk, a commons spear, the four
   entries."*
4. Cap: 2 hours and 150 turns, with no human help. It ends with `wildshard build` and `validate`.

**How it's graded.**

| Part | Pass bar |
|---|---|
| **Hard gates** (scripted) | validate passes; grid-ready; content gate (tiles, colliders, files present); headless + replay + ledger proofs; physics walk 0 stuck; report card inside budgets; **0** imports of `@wildshard/engine` or `@wildshard/game`; **0** `runtime/` lines; no `ShaderMaterial` |
| **Readability** (three blind seats, per COUNCIL.md) | each seat grades A–F against the G302 bar beside a hand-written three.js version of the same brief: three.js names used 1:1, files ≤ 300 lines, lines ≤ 120 chars, names and comments say why, no procedural soup. **Pass: B or better from 2 of 3** |
| **Friction log** (the agent writes it) | every doc lookup that failed, every guess, every workaround. Each item becomes a docs or SDK fix row; the count must fall run on run |
| **Looks** (O, one still per view) | a recognisable mesa outpost on the phone frame; no board for Jake unless he asks |

**When.** At the end of phase 1 (it is the exit of the G299 SDK redesign), then at M3 and at each later milestone,
never per push. A failed run files rows, and the next run must clear them.

---

## 7. Contradictions: older rows that today's decisions supersede

| Older row | What it says | Superseded by | Proposed update |
|---|---|---|---|
| **G135** | every shard file, `runtime/` included, imports only `@wildshard/sdk` | G307 | "`runtime/` imports `@wildshard/game/plugin/*`; everything else imports the authoring SDK, `three` and commons" |
| **G136** | code reaching only the SDK's public surface counts toward 80 % in any folder | G291, G294 | "custom runtime TS ≤ 20 % of the frozen legacy folder; a one-user platform system counts as custom" |
| **G140** | the four subclassed weapons extend the SDK's trusted weapon families | G307, WP rows | "they become `firearm` / `bow` / `melee` / `thrown` rows (WP-2, WP-3); any family left over registers through `plugin/weaponFamily`" |
| **G143** | `runtime/` may use the SDK's trusted surface (`@wildshard/sdk/runtime/*`) | G307 | "`runtime/` uses `@wildshard/game/plugin/*`; engine imports are counted debt (`shard-engine-imports`)" |
| **G259** | parked kit modules become systems reached through SDK facades | G303, G307 | "one-user modules go back to the shard; 2+-user ones become game systems behind `plugin/*` or commons packs; no facades" |
| **G288** | approved downward shard imports leave the ratchet | the audit, G297 | keep `layer-edges` lean, but restore G143's shrink-only count as `shard-engine-imports` |
| **G262** | code-built models move to offline GLB bakes on parity | G292 | "…built at build time with the cache; committed only when small and expensive or GPU-baked" (Driftwood's 32 fixed-model GLBs go to the cache) |
| **G265** | M3 is measured by the new folders' public share | G291 | "M3 = all six at G291 + G294 ≤ 20 % with the SF77 content gate and their proofs" |
| **G285** | bake the big three's static builders now (verbatim) | G290, G301, G302 | "a verbatim builder in `generators/` is a step, not the end: it is rewritten on the SDK until it passes G302's bar" |
| **G301** | "where three.js has a concept the SDK offers the same name and shape" | G311 | "three.js itself provides those names: generators use real three.js and hand the scene to `bake`; the SDK adds only game concepts" |
| **G4** | restricted shader code after graphs | G306 | "raw GLSL is trusted only; any later public shading language must compile to graph IR under the same budget" |
| **§0 "Platform systems"** | engine-backed behaviour every shard uses through `@wildshard/sdk` | G296, G307 | "through rows the SDK authors and game runs; trusted code through `plugin/*`" |
| **§1 Measures 1 and 2** | public ÷ (public + custom) inside the shard; runtime ceiling vs a baseline | G291 | rewrite §1 to G291 + G294 + SF77, the way `shard-platform.mjs` already prints it |
| **§3.5** | `runtime/` may use `@wildshard/sdk/runtime/*`; generators "whatever they import" (§1) | G307, G298, G301 | `runtime/` → `plugin/*`; generators → `three`, sdk, commons only |
| **SF26** | the commons v0: kit species and sounds | G310 | "commons = 2+-user models, rigs, sounds, material graphs and reusable generator code" (DS1.6) |
| **SF27** | platform archetypes for the brains shards use today | G294, BR | "five parametric archetypes plus the boss row; a one-user archetype counts as custom" |
| **SF34** | each mode runs from the SDK | G307, PM | "mode rows the SDK authors; drivers in game, behind `plugin/playerMode` during the transition" |
| **SF36** | rows over SDK weapon families | G307, WP | "rows over game families" |
| **SF54** | kit-subclassing weapons extend `@wildshard/sdk/runtime/weapons` | G307 | delete the clause; WP-2 / WP-3 |
| **SF55** | the Blender script lives in `scripts/blender/blender-template/` | G298 | "`src/shards/blender-template/blender/world.py`" |
| **SF73** | a legacy folder goes when its shard reaches 80/20 | G306 note, audit O5 | "…at G291 + G294 ≤ 20 %, the content gate, parity, and one playthrough by Jake" |
| **AGENTS.md** layers | "Shards build against the SDK (`runtime/` files through its trusted runtime facades)" | G307 | "`runtime/` imports game's `plugin/*` modules; everything else imports the authoring SDK" |
| **ENGINE.md §24–25, `exports` table; SHARDS.md 390–391** | `@wildshard/sdk/runtime/*` holds the trusted facades; `layer` lists "engine < game < kit < shards" | G307, SF54 | rewrite with SF78; `layer` names engine, game, sdk, commons, shards |

The AGENTS.md, ENGINE.md and SHARDS.md edits belong to SF78's commit, not this one.

---

## 8. Open questions for Jake

**Answered 2026-10-10 (G312–G318):** Q1 real shards only (the template doesn't count); Q2 yes, `@wildshard/format`; Q3 identical or an Opus clip check; Q4 no cap, own column; Q5 **keep engine and game separate for good** (§2.7 is withdrawn); Q6 yes, `scene.json` never committed; Q7 commit when a cold rebuild is over 30 s and the output under 2 MB.

G311 settled the first question (real three.js), so seven remain.

| # | Question | Recommendation |
|---|---|---|
| **Q1** | May the template be the second user that makes ride, grapple and the thrown spear public (G294 allows it)? | **Yes, for ride and grapple** (core verbs under G3) and the spear. **No** for the lash and the fan: they stay in their shards until a real second shard wants them. |
| **Q2** | Move the shardfile schema out of game into its own `@wildshard/format` package (valibot → JSON Schema) that game and SDK both import? | **Yes.** The SDK then needs no game import, the MMO server imports one small package, and the Zod → JSON Schema shape is literal. |
| **Q3** | When the five parametric brain archetypes replace 13 one-user ones, must every trace stay byte-identical? | **Identical where the preset re-expresses the old code; otherwise an Opus clip check**, with no board for you unless it looks different (the G262 rule). |
| **Q4** | AssemblyScript isn't "custom runtime TS" under G291. Should it get a cap? | **No cap. Show it as its own report-only column** so a 5k-line AS port can't hide, and revisit at 90/10. |
| **Q5** | Merge engine and game after M3? | **Yes**, into one `@wildshard/game` with `engine/` as a lint-guarded folder and `./plugin/*` as its only shard surface, once `shard-engine-imports` is 0 (§2.7). |
| **Q6** | Keep `scene.json` (the synth output, like `cdk synth`) as the inspectable middle step, and allow it as a hand-written `data/` form? | **Yes.** It gives agents and reviewers one readable diff per generator change, and it is what the one-shot test inspects. It is never committed. |
| **Q7** | The G292 line for committing a bake: what counts as "expensive"? | **Commit only if a cold rebuild takes > 60 s or needs a GPU, and the output is < 2 MB.** Everything else goes to the cache. Driftwood's 32 fixed-model GLBs leave git. |
