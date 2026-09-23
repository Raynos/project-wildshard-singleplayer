# Engines on (and beside) three.js — fit for Wildshard (E45 web research, 2026-09-23)

Method: npm registry (`npm view`, 2026-09-23), GitHub API (stars / last push), jsDelivr bundle downloads,
and a local esbuild bundle of each library (`--minify`, three external, gzip -9) in
`scratchpad/engine-audit/sizes/`. Docs/pricing pages cited inline. Nothing was installed in any game repo.

Our baseline: three `^0.186.0` + `postprocessing ^6.39.5` + `n8ao ^2.0.1`
(`wildshard-singleplayer/package.json`); ~42.4 k lines of TS in `src/`; physics branch pins
`@dimforge/rapier3d-simd 0.20.0` (`wildshard-physics/package.json:33`) with a KCC player
(`docs/plans/PHYSICS.md:122`) and **navcat** for navmesh (`PHYSICS.md:19,167`).
Reference sizes: three.module.min.js 393 KB min / **90 KB gz**; Rapier SIMD wasm 2.20 MB raw /
**732 KB gz / 537 KB br** (the `-compat` build base64-inlines it: 1.06–1.08 MB gz of JS).

## Headline

**No three.js-layered engine can run our three 0.186 as-is.** Every candidate either pins an older three
(enable3d 0.171, GDevelop 0.160, Hology 0.169, IWSDK super-three 0.181, A-Frame super-three 0.184) or ships
its own fork (Needle: `@needle-tools/three` 0.169 on stable 5.1.13, 0.185.2-alpha on 6.0.0-alpha). The
only things that take `three >=x` unmodified are the *libraries* (R3F, Threlte, drei, bvh, quarks, recast…).
The editor-centric engines (Rogue, Needle, GDevelop, Hology, PlayCanvas, Wonderland) assume a scene/prefab
file authored in a GUI, which our agent-only, no-editor, many-agents-on-one-tree workflow cannot use well.
So option (b) — keep raw three + Rapier, borrow components — is what the evidence supports.

## Engine table

| Engine | What it is | Latest / activity | Licence / money | three version | Physics | Fit for us |
|---|---|---|---|---|---|---|
| **Rogue Engine** | Unity-like **desktop editor** (Win/mac/Linux) over three; TS components via `@RE.registerComponent` + `RE.props` | v1.3.0 on itch; launch post Nov 2024; closed source, not on npm | Proprietary EULA: Personal free <$80k/yr, Indie free <$150k, Plus <$250k, Pro <$450k, Enterprise; no royalties; no reverse-engineering | bundled by the editor, version not published | Rapier via "RogueRapier" package | **No.** Editor-owned scene files, closed engine, single-maintainer, no CLI/headless story. |
| **Needle Engine** | Unity/Blender exporter **plus** code-first (`npm create needle`); `Behaviour` components with Unity-style lifecycle; `<needle-engine>` web component | stable **5.1.13** (2026-09-09); `latest` tag is **6.0.0-alpha.3** (2026-09-15); very active | **Commercial use needs a paid licence** (Pro from €49/user/month; Basic = non-commercial, Needle logo visible; Enterprise >€5 M revenue) | **own fork** `@needle-tools/three` 0.169.19 (5.x) / 0.185.2-alpha (6.x) | Rapier 0.19.3 (`-compat`, ~2 MB wasm loaded when any collider exists) | **No as an engine** (fork + per-seat fee + heavy deps: postprocessing, n8ao, quarks, bvh, spark, peerjs, three-mesh-ui). **Yes to its MIT side-libs** (below). Has an agent skill + MCP via Needle Inspector. |
| **enable3d** | Code-first wrapper: three + **ammo.js**, "Phaser for 3D"; also headless ammo on Node | 0.26.1 (2025-03-08); repo last push 2026-08; 1.2 k★ | **LGPL-3.0** | peer-pinned **three 0.171.0** | Ammo.js | **No.** Old three pin, ammo (we chose Rapier), LGPL. |
| **GDevelop** | No-code **event-sheet** editor, 2D-first, 3D extension on three; JS only via code blocks/extensions | v5.6.282 (2026-09-11), very active, 26.8 k★ | MIT runtime-ish ("Other" on GitHub), paid cloud tiers | **three 0.160.0** (`newIDE/app/package.json`) | Jolt (3D), Box2D (2D) | **No.** Visual event logic, old three, wrong audience. |
| **A-Frame** | Declarative HTML/DOM **entity-component** framework, WebXR-first | **1.8.0** (2026-06-24); 17.6 k★ | MIT | **super-three 0.184** (Supermedium fork) | none built-in (aframe-physics-system / community) | **No.** DOM-attribute components, XR focus, 1.32 MB min / **349 KB gz** runtime; fights strict TS. Its ECS idea is the only takeaway. |
| **IWSDK** (Meta Immersive Web SDK) | Code-first TS framework: **elics ECS** + systems on three; locomotion, grab, spatial UI (`@pmndrs/uikit`), "agent-first" dev tooling (MCP, screenshots, scene inspect) | `@iwsdk/core` 0.5.3 (2026-08-11); repo pushed 2026-09-22; 357★ | MIT | alias to **super-three 0.181**; `@types/three ^0.181` | **Havok** (`@babylonjs/havok`) | **No as base** (XR-first, 0.x, Havok not Rapier, older three). Interesting reference for agent tooling + ECS-over-three shape. |
| **React Three Fiber** (+drei, @react-three/rapier, ecctrl) | React reconciler for three; code-first, huge ecosystem | R3F 9.8.0 (2026-09-22), v10 alpha = WebGPU/TSL + new scheduler; 32.4 k★ | MIT | `three >=0.156` — **runs 0.186 as-is** | @react-three/rapier 2.2.0; ecctrl 2.0.2 (KCC, joystick, anim state, vehicles) | **No** — a full rewrite into React components, React reconciler overhead per frame, and ecctrl needs React + drei + leva. Mine it for ideas (ecctrl's controller maths). |
| **Threlte** | Svelte 5 equivalent of R3F | core 8.6.0 (2026-08-26); 3.3 k★ | MIT | `three >=0.160` | @threlte/rapier 3.5.0 | **No** — same rewrite cost as R3F. |
| **Hology Engine** | Editor + TS actors/components (typedi DI, rxjs), landscape/shader-graph editor, exports Steam/Android/Apple | `@hology/core` 0.0.258 (2026-09-23, 257 releases since 2022) | **Proprietary** licence: package usable *only* with Hology Engine; pricing not public | peer **three 0.169.0** | Rapier SIMD 0.20 + recast-navigation 0.39 + three-mesh-bvh | **No.** Closed, editor-bound, old three. Validates our stack choice (Rapier + navmesh + BVH). |
| **Babylon.js** (not three) | Full engine, TS-native, inspector, node editors | 9.27.1 (2026-09-18); 26.1 k★ | Apache-2.0 | n/a | **Havok** (built-in character controller) | The "real engine" contrast: 8.6 MB min / **1.84 MB gz** UMD (tree-shaken ES builds smaller). Full rewrite. |
| **PlayCanvas** (not three) | Engine + cloud **Editor** with built-in **MCP server**; ESM scripts | 2.22.3 (2026-09-23); 16.9 k★ | MIT engine, paid editor tiers | n/a | ammo.js (Jolt via community) | 2.47 MB min / **631 KB gz**. Best-in-class editor MCP, but editor-centric + rewrite. |
| **Galacean** (not three) | Alibaba TS engine + editor, mobile-web focus | 1.6.13 (2026-09-12); 5.9 k★ | MIT | n/a | PhysX (wasm) | 1.17 MB min / **290 KB gz**. Rewrite. |
| **Wonderland** (not three) | C++/WASM runtime + editor, JS components; VR-first | api 1.6.1 (2026-04) | Free to $120k/yr revenue, then **10 % royalty** (or enterprise seat) | n/a | PhysX | **No** — royalty, editor, rewrite. |

Sources: rogueengine.io, rogueengine.io/EULA, beardscript.itch.io/rogueengine, github.com/BeardScript/RogueRapier,
engine.needle.tools/docs/ (+ /three/, /reference/faq.html, /ai/needle-mcp-server.html), needle.tools/pricing/,
github.com/enable3d/enable3d, github.com/4ian/GDevelop, wiki.gdevelop.io/gdevelop5/behaviors/physics3d/,
github.com/aframevr/aframe/releases/tag/v1.8.0, github.com/facebook/immersive-web-sdk, iwsdk.dev,
github.com/pmndrs/react-three-fiber/discussions/3665 (v10 alpha), github.com/pmndrs/ecctrl, docs.hology.app,
doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin, developer.playcanvas.com/user-manual/editor/mcp-server/,
wonderlandengine.com/pricing/.

### Per-criterion notes that matter for the decision

- **Can it run our renderer / materials / post as-is?** Only R3F / Threlte (they wrap *your* three). Needle,
  A-Frame and IWSDK alias `three` to a fork — our `postprocessing`, `n8ao`, custom `onBeforeCompile`
  shaders and `@types/three 0.186` would have to follow the fork's version, i.e. a downgrade today.
- **Physics.** Only Needle, Rogue and Hology bundle Rapier (as we chose). enable3d/PlayCanvas = ammo, GDevelop =
  Jolt, IWSDK/Babylon = Havok, Galacean/Wonderland = PhysX. Switching engine would also mean re-doing
  the physics plan unless it is Needle/Rogue/Hology — all three are licence-encumbered.
- **Load cost on phones.** Every engine adds to our 90 KB-gz three: A-Frame +349 KB gz, Galacean 290 KB,
  PlayCanvas 631 KB, Babylon 1.84 MB (UMD). Needle's prebundled runtime pulls postprocessing (~113 KB gz whole),
  quarks (39 KB), bvh (30 KB), n8ao, three-mesh-ui, spark, peerjs, flatbuffers, websocket-ts before game code.
- **Touch input.** Needle claims touch "out of the box" (pointer events, no virtual stick); ecctrl ships a
  joystick; A-Frame/IWSDK are XR-controller-first; none offers anything our 316-line
  `src/player/TouchControls.ts` lacks.
- **ECS / component model.** Needle/Rogue/Hology/PlayCanvas = Unity-style MonoBehaviour components on scene
  objects; A-Frame = DOM-attribute components; IWSDK = real archetype ECS (elics) with systems + signals.
- **Prefab / scene format.** Needle = glTF + extensions (from Unity/Blender); Rogue/Hology/PlayCanvas/Wonderland =
  proprietary editor scene JSON; A-Frame = HTML. We generate worlds in code + baked JSON (`public/assets/baked/…`).
- **Animation state machine.** Needle (Unity Animator export), Rogue, Babylon, PlayCanvas (anim state graph),
  ecctrl (simple state). Raw three has only `AnimationMixer`.
- **Networking.** Needle (websocket + peerjs rooms), Rogue (Croquet), IWSDK none. Not needed now.
- **Incremental adoption.** Needle is the only one that genuinely supports "add components to an existing three
  scene", but it replaces `three` with its fork, so it is *not* incremental for us. Everything else is a rewrite.
- **Agent fit.** Best tooling: IWSDK (agent-first MCP, screenshots), Needle (Claude skill + MCP via Needle
  Inspector), PlayCanvas (Editor MCP — but it drives a cloud editor). All of them assume one human + one agent on
  an editor session, not ~10 agents on one git tree. Code-only TS libraries with typed APIs + vitest
  (what we have) remain the most agent-friendly shape.

## À-la-carte components (keep raw three + Rapier; borrow these)

Sizes = local esbuild, minified, three external, gzip -9 (`scratchpad/engine-audit/sizes/`).

| Library | Version / date | Licence | min / gz | Maturity | Problem it solves for us |
|---|---|---|---|---|---|
| **Rapier `KinematicCharacterController`** (in `@dimforge/rapier3d-simd`) | 0.20.0 (2026-09-19) | Apache-2.0 | already paid (732 KB gz wasm) | high | Autostep, snap-to-ground, slopes, platform carry — already the plan (`PHYSICS.md:122`). Also `three/addons/physics/RapierPhysics.js` as a reference glue. rapier.rs/docs/user_guides/javascript/character_controller |
| **three-mesh-bvh** | 0.9.15 (2026-09-09); 3.5 k★ | MIT | 96 KB / **30 KB** | very high (used by Needle, Hology, IWSDK) | Fast raycast/shapecast against terrain & props (melee hit, camera collision, foot IK, picking in `src/explore/Select.ts`) without a Rapier round-trip; `computeBoundsTree` on static meshes. github.com/gkjohnson/three-mesh-bvh |
| **navcat** | 0.4.1 (2026-05); 292★ | MIT | ~96 KB (plan's figure) | young, same author as recast-navigation-js | Pure-JS navmesh — already chosen in `PHYSICS.md:167`. Alternative: **recast-navigation-js** 0.43.1 — MIT, core 776 KB min / 230 KB gz (compat, wasm inlined) or wasm 339 KB raw / 131 KB gz + glue; `@recast-navigation/three` 48 KB / 13 KB gz; crowd + tile cache + off-mesh links (Hology uses it). **three-pathfinding** 1.3.0 (2024, 4 KB gz) = too basic. |
| **yuka** | 0.7.8 (npm 2022; repo pushed 2026-09) | MIT | 121 KB / 32 KB | stable but npm stale | Steering behaviours, FSM/goal-driven AI, perception, fuzzy logic — for `src/entities/AnimalManager.ts` (1070 lines) wander/flee/herd. Borrow the *patterns* (steering + FSM) rather than the whole lib. github.com/Mugen87/yuka |
| **ECS: koota** | 0.6.6 (2026-09-16); pmndrs | ISC | 39 KB / 12 KB | 0.x, active | Trait-based ECS with queries/relations, React optional. |
| **ECS: bitECS** | 0.4.0 (2025-12) | MPL-2.0 | 16 KB / 6 KB | mature, SoA/typed-array fast | Cache-friendly ECS for many animals/projectiles. MPL = file-level copyleft (fine unmodified). |
| **ECS: miniplex** | 2.0.0 (2023) | MIT | 16 KB / 4 KB | stable, quiet | Simplest "entities are objects, archetype queries" — lowest migration cost from class-based entities. |
| **ECS: elics** (IWSDK's) | 3.4.2 (2026-02) | MIT | 21 KB / 7 KB | used in production by Meta | Typed schema ECS + systems + queries. `@lastolivegames/becsy` 0.15.5 (2025-03) is stale. |
| **three.quarks** | 0.17.1 (2026-05); 1 k★ | MIT | 166 KB / **39 KB** | good (Needle bundles it) | Batched particle systems (emitters, curves, trails, sub-emitters) vs our 385-line `src/world/Particles.ts`; ~one draw call per material batch. Weigh 39 KB gz vs gains. |
| **nipplejs** | 1.0.4 (2026-05-26) | MIT | 21 KB / 6 KB | mature | Virtual joystick. We already own `TouchControls.ts` (316 lines) — low value. |
| **postprocessing** (pmndrs) | 6.39.5 | Zlib | tree-shaken | already in use | EffectComposer merging passes into one fullscreen pass — keep. |
| **@needle-tools/gltf-progressive** | 4.0.0-alpha.3 (2026-09-09) | **MIT**, peer `three >=0.183` | small | Needle-backed | Progressive mesh + texture LODs for glTF (low-res first, upgrade on demand) — directly serves LOAD-PERF. Runs on **vanilla three 0.186**. Needs the matching build-time LOD generation (Needle Cloud / their CLI) — verify offline pipeline before adopting. |
| **@needle-tools/three-animation-pointer** | 1.1.2 | MIT | small | stable | `KHR_animation_pointer` so glTF clips can animate materials/lights. Niche. |
| **Needle Inspector** (Chrome ext + MCP) | 2026 | free | 0 (dev only) | new | DevTools + MCP for **any** three.js page: agents browse/edit the live scene graph. Dev-only, zero ship cost. |
| **@three.ez/instanced-mesh** | 0.3.16 (2026-07) | MIT | small | active | InstancedMesh with per-instance frustum culling, LOD, BVH, sorting — fits grass/props scattering (Driftwood M4 ground cover). |
| **lil-gui** / **tweakpane** | 0.21.0 (2025-10) / 4.0.5 (2024-11) | MIT | 31/8 KB, 151/31 KB | mature | Dev-only tuning panels (dynamic import behind `?dev`). lil-gui ships as `three/addons/libs/lil-gui.module.min.js` already. |
| **theatre.js** / **three-inspect** | 0.7.2 (2024) / 0.7.2 (2024) | Apache-2.0 / MIT | — | **stale since 2024** | Skip. |
| **gltf-transform + meshoptimizer** | 4.5.0 (2026-09) / 1.2.0 (2026-06) | MIT | build-time | very high | Already in devDeps; `meshopt` + KTX2 + `simplify` for LODs is the same pipeline Needle sells. |
| **@pmndrs/uikit** | 1.0.76 | custom licence | — | active | In-world 3D UI (IWSDK uses it). We use DOM HUD; skip. |
| **camera-controls** | 3.1.2 | MIT | 45 KB / 10 KB | mature | Orbit/dolly smoothing — only for explore/cinematic cams. |
| **@sparkjsdev/spark** | 2.2.0 | MIT | — | active | Gaussian-splat rendering on three (Needle bundles a fork). Only if splats ever enter the art pipeline. |

Not recommended for à-la-carte: `ecctrl` (React-bound — port its ideas instead), `@react-three/rapier`,
enable3d physics (ammo), Needle's `@needle-tools/engine` components standalone (they require its three fork and
its `Context`/lifecycle), `@needle-tools/materialx` (PolyForm **Noncommercial**).

## Ideas to borrow (not libraries)

1. **Component lifecycle + update scheduler** (Needle/Rogue `awake/start/update/lateUpdate/onDestroy`, R3F v10
   ordered `useFrame` scheduler): one typed `System` interface with an explicit phase order
   (input → physics step → gameplay → animation → camera → render) instead of ad-hoc calls in `src/core/Game.ts`.
2. **ECS for the crowded parts only** (animals, projectiles, pickups): koota / miniplex / elics — IWSDK shows ECS
   over plain three objects works without owning the renderer.
3. **Animator state machine** (Needle's Unity Animator, ecctrl's anim states): a small data-driven
   `AnimationMixer` state graph with crossfade rules per species/player.
4. **Progressive / on-demand asset LOD** (Needle gltf-progressive) — matches LOAD-PERF goals.
5. **Agent-first dev tooling** (IWSDK MCP, Needle Inspector MCP, PlayCanvas Editor MCP): expose the live scene,
   a screenshot hook and entity inspection over MCP/dev endpoint so agents can verify in-game state.
