# Engine fit v2: an engine, a kit and shard plugins (E357 research, 2026-09-30)

Research for [E357](../../tasks/asks/E357.md), in the spirit of [ENGINE-FIT](../../../project/archive/2026-09-30-engine-fit.md) (verdict
2026-09-28, survey [engines.md](../engine-fit/engines.md) 2026-09-23). The question changed. It is no longer "should we
switch engine". It is: **what should the Wildshard engine borrow, adopt or own now that it is rebuilt as `src/engine/` +
`src/kit/` + `src/shards/<slug>/`, with lazy shards (E357 decisions 1–9)?** Ideas only. Jake has approved none of it.

Method: npm registry (`npm view`, 2026-09-30); a local esbuild bundle of each library (`--minify`, three external, only
the named entry points, `gzip -9`) in the session scratchpad; primary docs and changelogs linked inline; counts from `src/`
at `afd112a5`.

## Verdict

1. **Still no engine switch. Nothing since 09-23 flips it** (table §1). The engines on three still pin an older three
   or a fork (Needle 0.185.2-alpha fork, IWSDK super-three 0.181, Hology 0.169). The engines not built on three are all
   full rewrites of 173k lines. The one real change is **Rapier JS 0.21.0** (09-25): its wasm grows by 56 %. Keep the
   exact `0.20.0` pin until a phone measurement pays for it.
2. **Borrow Bevy's shape, not an ECS.** A plugin engine needs `App.use(plugin)`, schedules or phases with before/after
   ordering, run conditions, states with enter and exit, typed resources and typed events. Bevy has all of them
   ([plugins, schedules, states](https://bevy-cheatbook.github.io/programming/schedules.html)). `Game.ts` already has
   half: phases, labelled systems, fault isolation. Shards and kit features become plugins. Entities stay three.js
   objects registered in `WorldRegistry`. Structure-of-arrays pools only where the counts are high: projectiles,
   particles, the far-tier crowd.
3. **Adopt very little.** Keep what we have (three, Rapier 0.20, navcat and its crowd module, postprocessing, n8ao,
   gltf-transform + meshopt + KTX2). Add one library: **valibot** (1.4 KB gz), at the trust boundaries only. Everything
   else on the list is a pattern we write in tens to hundreds of lines. We would need to bend a library to our
   loop, our GC budget and our lint more than it would save us.
4. **Stay on WebGL, but contain the GLSL.** WebGPURenderer does not run `ShaderMaterial`, `onBeforeCompile` or pmndrs
   `postprocessing`, even on its WebGL 2 fallback. We have 87 + 112 + 16 such sites. Make a future switch a bounded
   port: renderer type inside `engine/render`, shader patches through one registry, post behind `ShardRender`. Don't
   pre-write TSL.
5. **Build: one lazy chunk per shard, `#engine/*` subpath imports, a layer lint rule with a ratchet, folders rather
   than packages.**

## 1. What changed since the 09-23 survey (re-check of the verdict)

| Candidate | 09-23 | 2026-09-30 | Flips it? |
|---|---|---|---|
| three.js | 0.186.0 | **0.186.1** (09-24); r186 removed minified builds and PCFSoftShadowMap, deprecated CJS ([r186](https://github.com/mrdoob/three.js/releases/tag/r186)) | no; our base |
| Rapier JS | 0.20.0 | **0.21.0** (09-25). Repo archived 07-12 and moved into the [Rapier monorepo](https://github.com/dimforge/rapier/tree/master/typescript). Core 0.35 rewrote the solver (always-on SIMD, new contact defaults), 0.36 added soft bodies ([CHANGELOG](https://github.com/dimforge/rapier/blob/master/CHANGELOG.md)). **wasm 2.20 → 3.29 MB raw, 732 → 1,145 KB gz, 537 → 836 KB br** (measured) | no; **keep the 0.20.0 pin**; take 0.21 only if iPhone numbers show a gain worth +299 KB br |
| Needle Engine | stable 5.1.13, 6.0 alpha | stable **5.1.14**, latest **6.0.0-alpha.3**; `three` = `@needle-tools/three@0.185.2-alpha.1`; paid seats for commercial use | no (fork, fee, editor) |
| IWSDK (Meta) | 0.5.3 | **1.0.0-rc.2** (09-24); still super-three 0.181, Havok, elics, XR-first | no; a reference for agent tooling |
| Hology | 0.0.258 | 0.0.261; peer three 0.169 + its own WebGPU renderer; proprietary | no |
| R3F / Threlte | 9.8.0 / 8.6.0 | 9.8.1 / 8.6.1; R3F v10 (WebGPU, new scheduler) still alpha | no (React / Svelte rewrite) |
| PlayCanvas | 2.22.3 | 2.22.6; 2.22 made the ESM build tree-shake and added WebGPU work ([v2.22.0](https://newreleases.io/project/github/playcanvas/engine/release/v2.22.0)) | no (rewrite, ammo physics) |
| Babylon.js | 9.27.1 | 9.28.0 | no (rewrite, Havok) |
| Unity Web | — | **6.6** (09-01) takes WebGPU out of experimental; WebGL 2 stays the default ([Unity](https://discussions.unity.com/t/webgpu-out-of-experimental-in-unity-6-6/1734694)) | no: editor + C#, scene files, 2 GB wasm heap, a full rewrite |
| Godot 4.6 web | — | web export is **Compatibility renderer only** (WebGL 2), no WebGPU ([docs](https://docs.godotengine.org/en/latest/tutorials/export/exporting_for_web.html)) | no |
| Bevy (wasm) | — | 0.18 (2026-01-13); WebGPU on the web experimental; Rust rewrite ([news](https://bevy.org/news/)) | no; **its App / Plugin / Schedule model is the one to copy** |
| Safari | 26 (WebGPU on) | **27.0** (09-17): native C++ ES module loader, WASM JSPI, service worker static routing ([WebKit](https://webkit.org/blog/18325/webkit-features-for-safari-27-0/)) | no; but re-check E188's module retry on iOS 27 |

The five reasons in ENGINE-FIT still hold: none runs our three, licences, editors, they don't fix our real costs, and
download weight. A sixth reason is new: **a plugin engine is easier to own than to rent.** Jake wants any agent to add a
5th shard as a directory. That needs a small interface we control and can lint, not a framework's component lifecycle.

## 2. The object model for a plugin engine

| Option | Who does it | For a shard that adds systems, creatures, weapons | Verdict |
|---|---|---|---|
| **Whole-game ECS** (koota, bitecs, miniplex, elics, becsy) | IWSDK (elics), Bevy | Every thing becomes an entity with components, and every system is a query. We would rewrite 173k lines of class-based code, the three.js scene graph stays the render truth anyway, and agents lose the "open `Sword.ts`, read the class" legibility | **skip** |
| **Components on Object3D** (Unity `MonoBehaviour`-style `awake/start/update`) | Needle, Rogue, Hology, PlayCanvas | Easy to write, but update order is implicit, per-object `update` calls cost thousands of calls a frame, and it hides the phase order we fought for (E2) | **skip** |
| **Services + systems + plugins** (Bevy's App without its ECS) | Bevy App/Plugin, our `Game.ts` phases | A shard or kit feature is a plugin: it adds systems to named phases, resources and event handlers, and registers built things in `WorldRegistry`. Entities stay classes or objects with narrow capability interfaces (`Damageable`, `Targetable`, `Interactable`, `Mountable`) | **adopt the pattern (own it)** |

What to take from Bevy, in our terms:
- **Plugin**: `export default defineShard({ manifest, install(app) })`. Kit features are plugins too:
  `app.use(weather, cfg)`, `app.use(dayClock, cfg)`, `app.use(bowFamily, cfg)`. This is how the audit's two weather
  stacks and three day clocks become one mechanism with per-shard data.
- **Schedules + ordering**: keep `Game`'s phases (`input → fixed pre/step/post → update → late → render`). Add a
  `{ label, after?, before?, when? }` to each registration. This replaces the 32 hand-ordered calls in the `'main'`
  updater. A run condition (`when: () => state.is('playing')`) replaces the gates inside systems.
- **States**: `boot → title → loading → playing ⇄ paused ⇄ explore → dead`. Give each state an `onEnter` and
  `onExit`, and hang the shard scope (`core/shardScope.ts`) off it. Explore and ride are states, not flags.
- **Resources**: a typed key → service map (`app.get(Terrain)`, `app.get(Audio)`) instead of ~160 closure locals in
  `buildShard`. The keys are typed tokens, not strings, so tsc checks every lookup.
- **Events**: a typed bus (`kill`, `hit`, `windup`, `charge`, `questStep`, `enterZone`). Every listener is auto-disposed with the
  scope. This replaces the 48 hand-merged hook assignments (`animals.onWindup` ×3).

**Where ECS-style data is worth it:** only where one system updates hundreds of like things each frame.
- **Projectiles:** arrows, bolts, brass and drop arcs (D2).
- **Particles:** the 7 CPU point pools (D11).
- **The far tier of the crowd:** Pine Hollow's ~140 animals beyond `animalHideDist`, on navcat's crowd.

Do it as structure-of-arrays pools in `kit/pool` (typed arrays, one `InstancedMesh` or `Points` per material, zero
allocation per frame). If a library is ever wanted, **koota** (ISC, 10.9 KB gz, 0.6.6 of 09-16, pmndrs, React
optional) is the one; miniplex has not been released since 2023, and bitecs is MPL. Near creatures, bosses, NPCs and
weapons stay classes: there are few of them, and their logic is where the design lives.

## 3. Libraries: adopt, borrow the pattern, or skip

Sizes are min + gz from our esbuild bundles of the named entry points (2026-09-30), except where marked.

| Item | Version (date) | Licence | gz | Call | Why |
|---|---|---|---|---|---|
| **Rapier** `@dimforge/rapier3d-simd` | 0.20.0 pinned; 0.21.0 (09-25) | Apache-2.0 | wasm 732 KB (0.21: 1,145 KB) | **keep 0.20** | 0.21 = new solver + soft bodies + 56 % more wasm. Upgrade only on an iPhone A/B (load time, physics ms). `src/engine/physics/` stays the only importer |
| **navcat** | 0.4.1 (05-06) | MIT | ~96 KB (plan figure) | **keep; adopt its crowd module** | Already our navmesh (bake + queries). It ships crowd simulation (steering, avoidance), which serves herds and thralls. **recast-navigation-js** 0.43.1 = skip (wasm, a second navmesh stack) |
| **three-mesh-bvh** | 0.9.15 (09-09) | MIT | 16 KB (core) | **borrow later, tools only** | Good for Explore picking and bake tools (AO, placement on meshes). Gameplay collision stays in Rapier (AGENTS: `src/engine/physics/` owns collision) |
| **three.quarks** | 0.17.1 (05-21), peer three ≥ 0.182 | MIT | 35 KB | **skip now** | Write one kit `ParticlePool` that merges the 7 pools (D11) first. quarks brings its own shader materials: more to precompile, more to port to WebGPU. Revisit if a shard needs trails or sub-emitters |
| **@three.ez/instanced-mesh** | 0.3.16 (07-26) | MIT | 17 KB | **skip** | We already have culled instancing and card LODs. A new render path needs iPhone memory evidence (E271) |
| **@needle-tools/gltf-progressive** | 4.0.0-alpha.3 (09-09) | MIT | 16 KB | **skip** | Alpha, and LOD generation runs on Needle's tooling. gltf-transform + meshopt + KTX2 (in the repo) is the same idea, offline and ours |
| ECS: **koota** / miniplex / bitecs / elics | 0.6.6 (09-16) / 2.0.0 (2023) / 0.4.0 (2025-12) / 3.4.2 (02-24) | ISC / MIT / MPL-2.0 / MIT | 10.9 / 4.0 / 4.5 / 4.6 KB | **skip whole-game**; koota if a crowd lib is ever needed | §2 |
| **xstate** v5 | 5.33.2 (09-29) | MIT | 11.9 KB (`@xstate/store` 2.8) | **skip; own a typed FSM** | Bosses, elites and NPC idles need `enter / update(dt) / exit` + timed transitions, stepped by our fixed loop, with zero garbage per frame. ~100 lines in `kit/fsm`. Quests already have `quest/core.ts`. Take statechart ideas (nested states, guards) only if a boss needs them |
| Behaviour trees: **mistreevous** / behaviortree | 4.3.1 (2025-07) / 3.0.0-beta.1 | MIT | 10.4 KB | **skip** | 1–3 enemy archetypes per shard. An FSM plus utility scores covers it, and one of these libs would be quiet by 2026 |
| **yuka** | 0.7.8 (npm 2022) | MIT | 32 KB (09-23 figure) | **borrow the pattern** | Its steering (seek, flee, wander, separation) and perception for `AnimalManager`; don't take the dependency |
| Typed events: **nanoevents** / mitt | 10.0.0 (07-22) / 3.0.1 | MIT | 0.17 / 0.20 KB | **own** (~40 lines) or nanoevents | Ours adds typed event maps, scope disposal and allocation-free `emit`. The pattern is what matters |
| Input actions | no library worth it | — | — | **own (ENGINE-FIT E4)** | Borrow Unity Input System / leafwing-input-manager: actions, bindings per device (keys, mouse, touch, standard gamepad), a context stack (`walk / ride / menu / explore / dialog`). Today 182 raw listeners in 58 files |
| Web Audio: howler / **tone** | 2.2.4 (2023) / 15.1.22 (09-27) | MIT | — | **skip; own `kit/audio`** | We need sample playback, positional voices, stems and a mixer, all in `src/audio/` already. The job is dedupe (D12–D14), not a library |
| Tweening: tween.js / gsap | 25.0.0 (2024) / 3.15 | MIT / GSAP no-charge licence (not OSS) | 3.6 KB / — | **skip; own `engine/math/ease`** | `smoothstep` ×15, `lin` ×6 and `sstep` ×5 today. One module of easings plus `damp(dt)` |
| Saves: **idb-keyval** | 6.3.0 (07-08) | Apache-2.0 | 0.35 KB | **own `Store`; idb-keyval only if a save outgrows localStorage** | 42 files touch `localStorage` by hand. One `Store` with versioned keys, `migrate()`, and a Capacitor Preferences backend on native |
| Schema: **valibot** / zod | 1.5.0 (09-09) / 4.6.5 (09-25) | MIT | **1.4 KB** / zod-mini 5.1, zod classic 92 KB | **adopt valibot, at trust boundaries only** | Saves read back, inbox and remote JSON, generated manifests. TS-authored shard data stays typed (`satisfies ShardManifest`) with no runtime schema |
| **dependency-cruiser** | 18.4.0 (09-20) | MIT | dev | **optional** | A CI graph report and orphan finder. The gate itself is a lint rule (§5) |
| eslint-plugin-boundaries | 7.2.0 | MIT | dev | **skip** | Needs ESLint and its import resolvers; we run oxlint only |
| Needle Inspector (Chrome ext + MCP) | 2026 | free | 0 | **borrow later, dev only** | Agents can inspect the live scene graph. Nothing ships |

### What we own ourselves

These are the parts an engine would have given us. Each is 50–400 lines, and today each exists 0–7 times.
- **`engine/app`**: the plugin host (`use`, systems with order and `when`, resources, events, states).
- **`engine/loop`**: `Game.ts` phases, fixed step and interpolation.
- **`engine/world`**: `WorldRegistry` and `ColliderDesc` (E1).
- **`engine/physics`**: `CharacterMotor`, queries, bodies and tiers.
- **`engine/input`**: actions and contexts (E4).
- **`engine/save`**: `Store`.
- **`engine/render`**: tiers, precompile, the post chain, LOD, instancing and the shader patch registry.
- **`engine/audio`**: mixer, voices, stems and zoned ambience.
- **`engine/combat`**: melee and ranged. E357 #5 makes combat engine.
- **`kit/`**: the FSM, pools, weapon families, the boss and elite base, weather, day clock, NPC rigs and the model kits.
- **Kept as they are**: the boot plan and asset stream, Explore and god mode, the procedural kits.

## 4. Platform direction

- **WebGPU / TSL.** Safari 26 turned WebGPU on for iOS ([WebKit](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)).
  three's WebGPURenderer is mature and falls back to WebGL 2. But it is not faster everywhere, it compiles pipelines on
  first draw, and it rejects `ShaderMaterial`, `RawShaderMaterial`, `onBeforeCompile` and pmndrs `postprocessing` **on
  both backends** ([migration guide](https://www.utsubo.com/blog/webgpu-threejs-migration-guide),
  [three#28957](https://github.com/mrdoob/three.js/issues/28957)). WebGLRenderer is maintained, but new node features land only in
  WebGPURenderer. Our port bill today:
  - 87 `onBeforeCompile` sites in 42 files;
  - 43 `ShaderChunk` edits;
  - 112 `ShaderMaterial` uses in 72 files;
  - `postprocessing` in 16 files, plus n8ao;
  - the `WebGLRenderer` type named in 52 files.

  E184 (WebGL only) stays right. **Shape the engine so the switch becomes a bounded port:**
  1. The renderer type lives only in `engine/render`, and shards get an interface.
  2. Every global shader patch (fog, toon, wind, AO) is one recipe in one registry, applied by the engine. It is not
     `onBeforeCompile` scattered through builders.
  3. Post goes behind `ShardRender`, and `Game.ts` stops deciding for a shard (audit §5 item 5).
  4. Warm-up goes through one engine `precompile()`, which maps to `compileAsync` on either renderer.
  5. No TSL until a switch: it runs only under WebGPURenderer.

  Revisit when three deprecates WebGLRenderer, or when an iPhone 17 Pro A/B beats WebGL on a real shard within the
  1.8 / 1.0 GB budgets (E271 rule: physical-device evidence).
- **KTX2 + meshopt.** Keep them: KTX2 is already in (`core/ktx2.ts`, E157), and meshopt and gltf-transform are in
  devDeps. Put the transcoder and decoder behind the asset stream, so a shard declares its compressed assets as data.
- **OffscreenCanvas / worker rendering.** Safari has supported WebGL in workers since 17
  ([WebKit](https://webkit.org/blog/14445/webkit-features-in-safari-17-0/)). Moving the renderer would mean proxying the DOM
  HUD, touch and audio. **Skip.** Instead give `kit` a small worker pool for procedural generation: terrain fields,
  textures (`viewmodelTextures.worker.ts` is the precedent) and model kits. That attacks Pine Hollow's 150 ms long task.
  Keep physics on the main thread: at 30–60 fps a worker adds a frame of latency and a sync layer.
- **WASM.** SIMD is universal on our targets and already used (`rapier3d-simd`). Threads need cross-origin isolation
  (COOP/COEP) and buy nothing at our physics budget. Skip. Safari 27's JSPI does not affect us.

## 5. Build, lazy shards and boundaries

- **One lazy chunk per shard.** Since E216 each page builds one shard. So the engine needs, for each shard:
  - a static, node-safe **manifest**: slug, title, card art, terrain spec, tiers. The title deck and the bake scripts
    read it.
  - a lazy **plugin** (`load: () => import('#shards/<slug>')`). The generated registry is the only engine → shard edge.

  Start the import at entry, in parallel with engine init, through the existing `retried()` wrapper (E188).
  Nine Dragon already works this way (a 373 KB chunk). The other three ship inside `main-*.js` (2.9 MB raw) and each
  page evaluates them all: the audit counts ~42k lines of single-shard code in engine folders.
- **Few big chunks, not many small ones.** An LTE hand-over surfaces on iOS as "Importing a module script failed" (E188).
  Aim for a `three` chunk, an `engine + kit` chunk and one chunk per shard. Vite 8 is Rolldown: `manualChunks` is
  deprecated in favour of `build.rolldownOptions.output.codeSplitting.groups` with `test`, `priority` and `minSize`
  ([Rolldown](https://rolldown.rs/reference/OutputOptions.codeSplitting)). Verify the output, don't trust the config.
  Re-test the E188 retry on iOS 27, whose module loader was rewritten.
- **Offline.** Emit `build.manifest: true` and generate each shard's precache list from its dynamic-import closure, so a
  lazy shard is offline-ready with no hand list. This closes the class of bug where Explore is preloaded only when
  `def.ocean` (audit §5 item 2).
- **Aliases.** Use **package.json subpath imports** (`"imports": { "#engine/*": "./src/engine/*", "#kit/*": …,
  "#shards/*": … }`) rather than tsconfig `paths`. Node's resolver ([docs](https://nodejs.org/api/packages.html#subpath-imports)),
  TypeScript's bundler resolution, Vite and vitest all read them natively. That matters because `scripts/bake-*.mjs`
  import `src/` through `bake-loader.mjs`. That loader needs one more branch, for extensionless `#…` targets (it
  already has one for relative imports). Prove it first with a two-file spike through tsc, vite, vitest and a bake.
  If `paths` is preferred, Vite 8 has `resolve.tsconfigPaths`, but vitest has
  had a gap there ([vitest#10054](https://github.com/vitest-dev/vitest/issues/10054)). TS 7 dropped `baseUrl`, so
  `paths` would need `./` prefixes.
- **Boundaries.** Add a `wildshard/layer` rule to the existing oxlint JS plugin (`lint/wildshard-plugin.js`), beside
  `no-url-switch`. The rule:
  - `engine` imports neither `kit` nor `shards`;
  - `kit` doesn't import `shards`;
  - no shard imports another shard;
  - only the generated registry may `import()` a shard.

  A ratchet file (the `lint/url-params.json` pattern) lets the counts only go down during the move. oxlint's built-in
  `no-restricted-imports` can do the simple cases per folder override, but it doesn't merge across overrides
  ([oxc#12179](https://github.com/oxc-project/oxc/issues/12179)). Pair it with a slug-branch counter (`slug ===`,
  `isOcean`, `nalatiNow()` outside `shards/`) on the same ratchet.
- **Folders, not packages.** One Vite app, one tsconfig and one lint config. The Vercel tree gate stays fast, and one
  agent can move files across layers in one commit. Packages would add `package.json` exports, project references and
  workspace installs on a slow uplink. Their one gain is hard boundaries, which the lint rule already gives. Revisit
  only if a second game reuses `src/engine/`.

## Sources

npm registry via `npm view` (2026-09-30) for every version and date above. Bundle sizes from local esbuild, and Rapier
wasm sizes from `npm pack` of 0.20.0 and 0.21.0, in the session scratchpad. Links inline. Earlier survey:
[engines.md](../engine-fit/engines.md). Code counts from `grep` over `src/` at `afd112a5`.
