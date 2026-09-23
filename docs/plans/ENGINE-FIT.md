# Plan: engine fit — a three.js engine, or five parts of our own?

**State:** `draft` 2026-09-23 — audit done (E45): **no engine switch; keep three.js 0.186 + Rapier and add five small engine parts (E1–E5)**. Jake has approved none of them yet. Waits on his pick. E1 + E2 matter before PHYSICS P4 and the Nalati merge.

## Read this first

This is the answer to E45: *"should we be using a real game engine on top of three.js, or look at what components
these engines have and add 1–5 of them to our three.js + Rapier game?"* Four read-only audits back it; the full
reports are in `docs/design/engine-fit/` (`driftwood.md`, `nalati.md`, `physics.md`, `engines.md`).

**Jake has approved none of the rows below — ideas only.** No agent builds, "quickly tries" or partly lands a row
until Jake names it.

## Verdict: don't adopt an engine

1. **None of them runs our three.js.** Every engine built on three pins an older three or its own fork: enable3d
   0.171, GDevelop 0.160, Hology 0.169, IWSDK 0.181 fork, A-Frame 0.184 fork, Needle its own fork (0.169
   stable / 0.185 alpha). Our `postprocessing`, `n8ao`, the `onBeforeCompile` fog / toon patches and the
   shader precompile would all have to follow a downgrade. Only R3F / Threlte wrap our own three, and they
   mean rewriting 42 k lines as React / Svelte components.
2. **The ones that bundle Rapier have licence problems.** Needle charges for commercial use (from €49 per
   user per month). Rogue Engine is closed source and free only under $80–150 k revenue. Hology's package can
   only be used with its own editor. enable3d uses ammo.js (the physics plan rejected it) under LGPL.
3. **They are built around a visual editor.** Rogue, Needle, GDevelop, Hology and PlayCanvas expect scenes
   laid out by hand in an editor. We generate worlds in code, and ~10 agents edit one git tree. Code-only TS
   with typed APIs and vitest suits agents best.
4. **They wouldn't fix what actually cost us time.** Driftwood's biggest time sink was shader compile stalls
   (29 commits). Nalati's was the look pass (17 of 69 commits). An engine on three inherits the first and
   doesn't touch the second. Our strongest code is also what we would lose: the typed boot plan and asset
   stream (8/8 LOAD-PERF budgets, 4.29 s cold 4G on phone), the merged post chain, the custom LOD, the
   procedural model kits, and Explore / god mode.
5. **They add download weight.** A-Frame +349 KB gz, PlayCanvas 631 KB, Babylon 1.84 MB, on top of the
   732 KB gz (537 KB br) Rapier WASM we already pay.

**What the engines do have that we lack:** an object model (how a thing gets a body, who owns it, when it
updates), a fixed-step phased loop, a shared character controller, input actions with contexts, and a
prefab / scene unit. Each of those is a few hundred lines we can own. Those are E1–E5.

## Where we are today (the audit, short)

| Area | Today | Grade |
|---|---|---|
| Boot / load / offline | typed boot plan, streamed pack, shader precompile, SW, CI budgets | **strong**, keep |
| Rendering / LOD / post | global shader patches, merged post pass, culled instancing, card LODs, tiers | **strong**, tied to three internals |
| Procedural models / creatures | code-built kits + skeletons, procedural gait; species registry | **strong**, bespoke |
| Interactables | `InteractDef` data union + validator | good; the closest thing to components we have |
| Game loop | one rAF, variable dt, flat `onUpdate` list + ~30 hand-ordered calls in `main.ts:556-615` | **thin** |
| Object model | ad-hoc classes, `main.ts` (640 lines) is the only wiring point, 6 dev scenes re-wire by hand | **thin** |
| Collision | 2.5D circle vs trunks / boxes + floor functions; only the player collides; animals walk through yurts; the kurgan floats at y = 140 | **weakest**, PHYSICS fixes |
| Input | raw DOM listeners in ~25 files; no action map, no gamepad; Nalati's ride mode edits the touch DOM and injects `'KeyC'` into the player | **thin** |
| Shards | config covers terrain + light only; behaviour branches on `chunk.ocean` / `style === 'painterly'` / slug (~20 + ~12 branches) | **thin**; hurts on shard 3 |

## The five parts (E1–E5)

| Row | Part | What it is | Why now | Size | Status |
|---|---|---|---|---|---|
| **E1** | **`WorldRegistry.add(piece)` + `ColliderDesc`** | One registration per built thing: `{id, name, file, category, object, anchor, colliders: ColliderDesc[], surface, motion, owner, tick?}`. `ColliderDesc` is engine-neutral data (`box / capsule / ball / hull / treads / trimesh` + surface) that each builder emits beside the geometry it draws. The registry feeds scene.add, physics bodies, the Explore catalog + minimap POIs, foam rings, the navmesh bake (`bake-chunk.mjs` in node) and the dev scenes. | Two plans are about to build **two registries over the same 16–26 builders**: EXPLORE-WORLD X10 `registerModel` and PHYSICS's per-builder `colliders/<structure>.ts`. Neither mentions the other. PHYSICS P4 deletes `player.colliders`, which breaks `main.ts`, 6 `src/dev/*` scenes and Nalati's `Mount.ts` unless there's one list to rewire. **Land it on main before P4.** | ~300 lines + one call per builder | idea |
| **E2** | **Frame phases on `Game`** | Replace the flat `onUpdate` list (`Game.ts:129,220`) and the hand order in `main.ts` with named phases: `input → prePhysics → fixedStep × n (60 Hz, ≤ 3) → postPhysics (sync + interpolate) → gameplay → animation → camera → render`. Systems register into a phase. | PHYSICS already picks a fixed 60 Hz step, but nothing says where things run around it. Also needs interpolation for the player during hit-stop (×0.04 → one step per ~25 frames) or the camera judders. | ~150 lines | idea |
| **E3** | **Shared `CharacterMotor`** | One wrapper over Rapier's `KinematicCharacterController` (capsule, step-up, snap, slopes, platform carry) used by the player, the **Nalati horse** and **near creatures only** (40–60 m / on screen; the rest stay on `heightAt` + navmesh, the way `animalHideDist` already tiers rendering). Game feel (speeds, jump, lunge) stays in game code. | Collision code already has two copies (`Player.ts:564`, `Mount.ts:326`). PHYSICS P6 puts every creature on a KCC, and Pine Hollow has ~140 animals, which likely blows the 1.5 ms physics budget without a distance tier. | ~250 lines | idea |
| **E4** | **Input actions + contexts** | Named actions (`move, look, attack, heavy, dodge, jump, interact, mount, crouch…`) fed from keyboard / mouse / touch / gamepad; a context stack (`walk`, `ride`, `menu`, `explore`, `dialog`) that decides which actions, bindings and touch layout are live. Touch layout E stays; it becomes the touch source for the walk context. | Nalati riding and stealth hack the touch DOM and inject key codes; Explore adds a fly mode; E32 (Escape opens and closes pause in one press) is an input-ordering bug. Gamepad and rebinding come almost free. | ~300 lines | idea |
| **E5** | **Shard module interface** | Each shard exports one typed module: `{config, buildWorld(registry), species, pois, music, hooks}`. `main.ts` loads the module and has no `chunk.ocean` / `painterly` / slug branches. | Driftwood has ~20 branches in `main.ts`, Nalati ~12 hooks, 24 shared files changed on both branches, 11 conflicts on a test merge. Shard 3 (P6) would add another flag everywhere. Best done **as part of the Nalati merge**. | refactor, ~1–2 days of agent time | idea |

### Order if all are picked

E1 (before PHYSICS P4) → E2 (with PHYSICS P1–P2) → E3 (PHYSICS P2 / P6, + Nalati horse) → E5 (the Nalati merge)
→ E4 (any time; small and independent). E1–E3 are really the missing object-model section of PHYSICS.md and could
be folded into it as rows.

## Libraries worth borrowing (optional, smaller)

| Row | Library | Size (gz) | Use | Status |
|---|---|---|---|---|
| L-a | **three-mesh-bvh** (MIT) | 30 KB | fast raycast / shapecast vs static meshes: melee hits, camera collision, foot IK, Explore picking, without a Rapier round trip | idea |
| L-b | **Needle Inspector** (Chrome ext + MCP, dev only) | 0 at ship | agents inspect and edit the live scene graph of any three page | idea |
| L-c | **ECS for crowds only** — koota (12 KB) / miniplex (4 KB) / elics (7 KB) | 4–12 KB | animals, projectiles, pickups if the animal count keeps climbing; *not* a whole-game ECS | idea, later |
| L-d | **three.quarks** (MIT) | 39 KB | replace `src/world/Particles.ts` (385 lines) with batched emitters, trails, sub-emitters | idea, later |
| L-e | **@three.ez/instanced-mesh** (MIT) | small | per-instance culling / LOD / BVH for ground cover and prop scatter | idea |
| L-f | **@needle-tools/gltf-progressive** (MIT, runs on vanilla three ≥ 0.183) | small | progressive mesh / texture LOD; only if GLB assets arrive and its LOD generation runs offline | idea, later |

Skip: ecctrl (React), `@needle-tools/engine` components (need Needle's three fork), `@needle-tools/materialx`
(non-commercial licence), theatre.js / three-inspect (stale since 2024), nipplejs (our `TouchControls.ts` already does it),
yuka as a dependency (borrow its steering + FSM patterns instead).

## Things for the PHYSICS plan regardless of E1–E5

- **Nalati is not in PHYSICS.md** (zero mentions): the horse capsule, animals colliding with boxes, the Nalati species on
  the navmesh, and a real kurgan interior under its mound belong in scope before the Nalati merge.
- **`src/dev/*` scenes** (6 files) are not mentioned either; P4 breaks them.
- **Creature physics LOD** (see E3): 140 KCCs per step on Pine Hollow won't fit 1.5 ms on a phone.
- **Pine Hollow's load budget is already tight:** the latest local bench is 10.62 MB of 12 MB cold with a 150 ms long
  task (over the 100 ms gate), before Rapier's 537 KB br + navmesh.

These are notes for the physics agent / Jake, not changes to PHYSICS.md; that plan's owner edits it.
