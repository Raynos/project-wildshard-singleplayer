# Shardfile architecture audit, 2026-10-10: what we actually built vs the goal

**Status:** `unread` 2026-10-10. This is the evidence for G299's architecture review: 5 open calls, and 4 of Jake's G290–G302 rules that are decided but not yet followed.
**Link:** this file. Diagram: `art/architecture/round-1-shardfile-audit/diagram.jpg`
**Plan:** SHARD-PLATFORM (M3, SF54, SF26, SF59, SF72, SF73, G285, G290–G302)
**Made by:** arch-audit (Opus). A read-only audit of ~1,000 commits between 2026-10-09 04:00 and 2026-10-10 10:00 UTC, against base `3d68396a2`.

**The goal** (Jake, G290–G302): a shardfile is infrastructure as code. SDK-driven TypeScript that *feels like three.js*
generates data. Outputs are regenerable artifacts. The SDK is the library you import to generate a shardfile, never a
wrapper over engine or game internals. Shard-specific code lives in the shard. 80/20 means custom runtime TS is at
most 20 % of the frozen legacy folder.

## 1. Headline: shard code was slammed into the game, and the numbers prove it

Jake: *"we just slammed absolutely everything into the game engine when shard-specific code is supposed to live in a
shard."* **Confirmed, and measured.**

**New platform files in the last 30 h: 376 files, 27.3k lines.** Users counted by following each shard's imports into
the SDK and the new files only:

| Shards that use it | Files | Lines | Share |
|---|---|---|---|
| **1 shard (relocation, not generalisation)** | **293** | **22,043** | **81 %** |
| 2 or more (real platform) | 48 | 4,150 | 15 % |
| none yet | 35 | 1,127 | 4 % |

By layer, the one-user lines sit in **game 19,738**, sdk 1,614 and engine 691.

**Per shard: shard code removed vs code moved into game / sdk / engine vs the true change (30 h).**

| Shard | Shard folder TS (before → now) | Moved to platform (one user) | Total TS for the shard |
|---|---|---|---|
| Nine Dragon | 20,371 → 16,392 (−3,979) | **+6,208** | **+2,229** |
| Pine Hollow | 19,686 → 18,663 (−1,023) | **+5,896** | **+4,873** |
| Driftwood | 16,815 → 16,402 (−413) | **+4,119** | **+3,706** |
| Signal Dunes | 4,248 → 2,302 (−1,946) | +2,411 | +465 |
| Nalati | 26,807 → 29,258 (+2,451) | +1,866 | **+4,317** |
| Sky Reach | 9,452 → 9,440 (−12) | +1,366 | +1,354 |
| **All six** | **−4,922** | **+21,866** | **+16,944** |

**No shard truly shrank.** The port added about 17k lines of TypeScript in 30 h. It moved them out of the shard folders,
where the metric looks, and into `src/game/systems/*`, where it doesn't.

**Where one shard's code now lives** (top folders, one-user lines):
- **Nine Dragon:** `game/systems/looks` 1,724 · `kit` 1,289 · `signs` 889 · `tools` 706 · `viewmodel` 492 · `cull` 431 · `portals` 207
- **Pine:** `looks` 2,008 · `items` 1,037 (crossbow, lever rifle) · `viewmodel` 617 · `kit` 506 · `props` 463 · `species` 299 · `compendium/trophyWall` 265 · `shardfile/eliteScripts` 164
- **Driftwood:** `looks` 2,757 (gulls, sea, cover, sky) · `audio` 508 · `viewmodel` 177 · `engine/render/offscreenBuild` 146
- **Signal:** `looks` 1,093 · `items` 570 (the lash) · `sdk/rowsHeadless` 113 · `shardfile/markedBoss` 92
- **Nalati:** `items` 1,054 (javelin, mounted sword, magazine firearm) · `shardfile/phasedBoss` 584
- **Sky:** `looks` 540 · `sdk/bake/skinned` 223 · `items` 193 (the war fan) · `engine/ai/phasedRaptor` 161

Counting old and new files together, game and sdk code reachable from only one shard comes to Pine 6.9k, Nine 6.6k,
Driftwood 3.8k, Signal 2.4k, Nalati 1.9k and Sky 1.4k.

**A typical move:** `1c5d9e85b`. Driftwood's 607-line `world/Gulls.ts` becomes `game/systems/looks/gullFlock.ts`
(592 lines; Driftwood is its only user). An SDK facade sits on top. Driftwood keeps a 13-line palette in `data/`, the
flap GLSL in `data/gullsGlsl.ts` and a 33-line wrapper. Others: `cb2a03301` (signs), `2bf6bb129` / `87212530a` /
`1354a10dd` (Nine's kit), `4361fd79b` (Pine's crossbow), `a49835bec` (*"PartKit, moved verbatim from
models/people.ts"*), `d479b2c90`, `3d033c705`, `742d13ec0` and `f86182b80`. Layer edges over the 30 h: `sdk → game`
63 → 227, `game → engine` 879 → 1,280.

### What Jake's 80/20 (G291 + G294) reports today vs the current metric

Custom = shard TypeScript that isn't SDK-driven generating code (the current metric's custom side), plus game / sdk
code that only this shard uses (G294). The bar is custom ≤ 20 % of the frozen `<slug>-legacy/` folder.

| Shard | Current metric | G291+G294: custom / legacy | Narrow reading: `runtime/` + trusted + one-user platform |
|---|---|---|---|
| Nine Dragon | **70.8 % public** | 11,444 / 20,736 = **55 %** (≈ 65 % with GLSL-in-data as code) | 35 % |
| Sky Reach | 46.6 % | 4,962 / 9,531 = **52 %** | 25 % |
| Signal Dunes | 64.1 % | 3,219 / 4,020 = **80 %** | 66 % |
| Pine Hollow | 24.3 % | 21,013 / 21,140 = **99 %** | 56 % |
| Driftwood | 19.1 % | 16,751 / 17,569 = **95 %** | 49 % |
| Nalati | 14.4 % | 27,146 / 28,219 = **96 %** | 39 % |

No shard is near 20 %. Nine Dragon's "0.2 → 70 %" is mostly relocation into the game (6.2k lines) plus 7.6k generator
lines. The metric code itself wasn't loosened: its only change, `64559e6b1`, is a fair JSON fix. A working-tree edit to
`scripts/shard-platform.mjs` by another lane is in flight; I didn't touch it.

### The SDK today is a runtime facade, not a shardfile library (G296)

Of its **229 exports**:
- **About 193 are runtime facades over game / engine internals**, mostly `export const X: typeof Y = Y`, which is a
  re-export in all but name and gets around E434. Groups: `looks/*` 67, `runtime/*` 21, `kit/*` 20, `items/*` 11,
  `props/*` 8, `viewmodel/*` 6, `species/*` 5, `cull/*` 5, `weapons/*` 5, `portals/*` 4, `tools/*` 2, `audio/*` 2, and
  about 37 single systems (`brains`, `speciesBrains`, `phasedBoss`, `markedBoss`, `bossFight`, `eliteScripts`,
  `playerModes`, `flyers`, `grazers`, `groupBrains`, `crowds`, `director`, `movers`, `weaponHooks`, `headless`,
  `panels`, `bag` …).
- **About 16 are format / schema facades** (ledger, quests, migrations, plumbing, accent, portalLink, socketLift …).
  The format schema itself lives in `src/game/shardfile/`, not in the SDK.
- **Only 13 are the SDK's own library code**: `bake/*` (8), `compileScript`, `modelGeometry`, `skinnedModel`,
  `commons`, and one `weapons` module.

Of all this, only `bake/*` matches G296. It takes three.js objects and emits tiles, GLBs and colliders (`bakeProps`,
`bakeKinds`, `bakeTerrain`, `skinnedGlb`).

## 2. Jake's rules: decided, but not yet followed

| Rule | Today | What fixes it |
|---|---|---|
| **G294** a one-user system counts custom | 293 files / 22k lines relocated (above) | Re-measure (in flight), then decide what to do with the code (open call O1) |
| **G296** the SDK only generates shardfiles | ~193 of 229 exports are runtime facades | Move them out of `src/sdk` (O3) |
| **G298** a shard folder holds all its generating code | **29 shard-specific bakers live in repo `scripts/`**, not the shard: `bake-pine-*` ×12, `bake-signal-*` ×4, `bake-sky-*` ×4, `bake-driftwood-*` ×4, `bake-nalati-*` ×3, `bake-nine-*` ×2. Generators in `src/shards/<slug>/generators/` import `@wildshard/sdk` **0 times** (Driftwood, Pine, Nalati), 2 (Nine) and 19 (Sky); they import `three` and `@wildshard/engine` directly (26–42 sites per shard) | Move each baker's entry into its shard's `generators/`; generators reach the engine only through SDK authoring calls |
| **G292** build-time + cache by default; commit only small, expensive outputs | **104 generated files (51.9 MB) committed in 30 h** (Driftwood `baked/fixed-models` 32 GLBs, Sky 11, Pine 7, Nalati 6, Signal 5, Nine 3; `runtime/*.baked.json` ×9) | Per-output call: cache vs commit, with a DO-NOT-EDIT header |
| **G290** every output regenerates from repo code | **Met.** All 104 changed outputs map to an in-repo baker, most with a stale test (`test/shards/<slug>/*-bake.test.ts`, `bake-check`); `bake-pine-spots` has none. The physics and map bakes need a real browser page to regenerate. I found no one-time bake whose source was deleted | Keep; add the missing stale test |
| **G297** native runtimes are a bridge with an exit | No headless installer names its replacement. `runtime/` grew net +1.5k (Driftwood), +2.0k (Nalati), +1.9k (Pine) in 30 h, all over ceiling (Pine 4,930 / 4,339, Driftwood 4,856 / 3,753, Nalati 9,009 / 6,618) | One exit row per installer (SF24 / SF27 / SF30 / SF34 / AS) |
| **G300** same bytes from Mac or Linux | Bake and trace checks run on darwin only (*"Linux libm differs in the last ulp"*: `b867e72e1`, `2830e8286`, `e82d9acac`) | A deterministic math helper in the SDK bake path, later (not a gate) |

## 3. The 5 calls still open (one recommendation each)

| # | Call | Recommendation | The question for Jake |
|---|---|---|---|
| **O1** | **What happens to the 22k relocated one-user lines** | **Move them back** into each shard (`<slug>/runtime/` or `<slug>/generators/`) in that shard's lane. This is mechanical, Codex work, and the parity gates already exist. Keep the 48 two-user systems in the platform. A system returns to the platform only with its second user (G294 / G295). | *"Move the one-user systems back into their shards now (≈ 1–2 Codex days), or leave them in the game and only count them custom?"* |
| **O2** | **What a ported shardfile must contain** | Add a content gate beside 80/20. Today the built `shard.json` of Pine, Driftwood, Nalati and Nine Dragon has **0 tiles and 0 files** (Sky 2; `creatures` empty in all six); only Signal and the templates carry their world. A ported shard ships its terrain, static geometry and colliders through `sdk/bake` / SF55a, and bakes stop writing shard-private binaries (`baked/layout.bin`, `*.baked.json` decoded by trusted runtime). `compatible` reads `transitional` while trusted TS runs the headless sim (Nine Dragon says `compatible: true` today). | *"Is a shard ported if its shardfile is only quests + items + a pointer to trusted code?"* |
| **O3** | **Where the runtime surface goes, and do engine + game merge (G299)** | Split the names: `@wildshard/sdk` = authoring only (bake, schema, author, compile; three.js-shaped, G301). The ~190 runtime facades become `@wildshard/game`'s trusted runtime API, which only `runtime/` may import. **Don't merge engine and game yet**: `engine-words` / E405 is the one guard that still holds. Revisit after M3. | *"SDK = authoring library only; the runtime surface moves to `game`. Engine/game merge waits until after M3?"* |
| **O4** | **One shader path** (never decided) | ≈ 4,100 raw GLSL lines moved into `data/` as "shader-family rows" (`b742bfa82`, `1c5d9e85b`, `92f097bc1`, `954d349ea`; Nine ≈ 2,100, Nalati ≈ 890, Sky ≈ 460, Driftwood ≈ 340, Pine ≈ 315). Nine's `data/look.ts` is **not** in `shard.json`; `look/style.ts` reads it. This contradicts G4 / G32 / G146 and SF59's graphs with no code nodes. Count GLSL rows as trusted runtime (`runtime/` or the game runtime API). SF59 graphs stay the only public material path, and the looks move to graphs in 90/10. | *"Raw GLSL as trusted runtime, graphs as the only public path?"* |
| **O5** | **When legacy goes, and what the public sees meanwhile** | Public SHARD SELECT serves **legacy** for Pine, Nalati, Sky, Signal and Nine (`entries.public: 'legacy'`), while the public grid serves the shardfile folders: two versions of each shard in production. The six frozen copies (132k lines) import engine/game 2,754 times, so platform churn must keep them running. Delete a legacy folder at G291's ≤ 20 % + parity + one Jake playthrough, and flip SHARD SELECT to the shardfile in that commit. | *"Legacy goes on G291 + parity + your playthrough, and never on the share alone?"* |

## 4. The author experience (G301 / G302)

### (a) Three real excerpts, graded

**A. A G285 "generator": Driftwood's hut** (`generators/hut.ts`, `ce768aff1`, *"parametric builders move verbatim"*).
```ts
import * as THREE from 'three';
import { SEED } from '@wildshard/engine/core/config';
import type { BoxSpec as Collider } from '@wildshard/engine/physics/box';
import { log, plank, rope, tris } from '@wildshard/engine/world/geometryKit';
import { LowPolyKit, bakeLight, type BakedLight } from '@wildshard/engine/world/lowpolyKit';
import { boxDesc, type ColliderDesc } from '@wildshard/engine/world/registry';
const C = { board: '#a07b50', boardB: '#8f6d46', thatch: '#c9a355', /* … */ };
const W = 6.4, D = 5.4;              // cabin footprint
const PORCH = 2.2;                    // porch depth around the front and sides
class HutBuilder { /* the legacy models/hut.ts, unchanged */ }
```
**Grade B for readability, F for G301.** It reads exactly like the legacy three.js (good comments, named constants),
because it *is* the legacy file. It uses no SDK at all, writes a fixed GLB plus `data/hutBake.json` that the page reads
back, and its baker lives in `scripts/`, not the shard.

**B. A "data row on a generic SDK system": Driftwood's gulls** (`1c5d9e85b`). Legacy `world/Gulls.ts`, 607 lines:
```ts
 * (c) a perched gull flushes with a flap burst when the player comes within ~4 m, joins a flock …
 * Cost: ≤ 40 instances × ~80 tris, one InstancedMesh; the wings, head and legs are animated in the vertex shader …
import * as THREE from 'three';
import { patchShader } from '@wildshard/engine/render/shaderPatches';
```
Now `data/gullsLook.ts` (the whole file):
```ts
export const GULL_PALETTE = { white: '#f3f3ef', belly: '#ffffff', grey: '#b4bac0', greyDark: '#9aa1a8',
  tip: '#2b2e33', beak: '#e9a23b', leg: '#e08a3a', eye: '#1a1a1a' };
export const GULL_CORRIDORS = { half: 8, beyond: 150 };
```
Plus `world/Gulls.ts`, 33 lines: `new GullFlock(sky, { palette, glsl: GULLS_GLSL, patchId: 'driftwood.gulls' })`.
**Grade D.** Each file reads cleanly, but the shard's behaviour, which was a well-documented 607-line module, now lives
in `game/systems/looks/gullFlock.ts`, used by nobody else. An author reading Driftwood sees a palette. This is relocation
dressed as data.

**C. Raw GLSL as "data": Nine Dragon's look** (`data/look.ts`, 1,219 lines, `b742bfa82`).
```ts
export const PROGRAMS = {
  jiehua: { vertex: VS_JIEHUA, fragment: FS_JIEHUA, vertexColors: true, uniforms: { uFogScale: 1 } },
  sky: { vertex: VS_SKY, fragment: FS_SKY, shared: ['uCam', 'uSutra', 'uSilk', 'uSkyTop', 'uSkyHorizon'],
    uniforms: { uSkyCloud: { v2: [0.45, 1.4] } }, side: 'back', depthWrite: false, depthTest: true },
  sheet: { vertex: VS_SHEET, fragment: FS_SHEET, transparent: true, depthWrite: false, side: 'double', blend: 'keepAlpha' },
  line: { vertex: VS_LINE, fragment: FS_LINE, shared: ['uRes'], uniforms: { uWidth: 2.5, uColor: { rgb: 0x7ff3ff }, uGain: 5 },
    transparent: true, blend: 'addKeepAlpha', depthWrite: false, side: 'double' },
```
**Grade C.** It is `THREE.ShaderMaterial` options with renamed keys (`vertex` for `vertexShader`, `'keepAlpha'` for
blending), so a three.js author can read it. But it's code labelled data, it's renderer-specific, and it never enters the
shardfile.

**The right direction, for contrast: the pastel-plain fixture generator** (`generators/props.ts`). Three.js `Group` /
`Mesh` objects are handed to `sdk/bake/props` as a `PropsBakeSource`. This is the G301 shape, but the file is 150-plus
character one-liners that import `engine/app/scope`, `engine/core/rng` and `engine/world/registry`. **Grade C:** right
pipeline, procedural soup.

### (b) The SDK's authoring surface against three.js

| three.js | SDK today | Verdict |
|---|---|---|
| `Scene` / `Object3D` / `Group` / transforms | none. Generators build real three.js graphs and hand them to `bakeProps({ static, scatter, panels })` / `foldKinds(root)` | **Half 1:1**: three.js is used directly, but the SDK names (`static`, `scatter`, `panels`, `kinds`) are its own |
| `Mesh` + `BufferGeometry` | `modelGeometry`, `bake/worldGeometry`; plus `kit/*` (`ruledKit`, `tangentKit`, `sweptKit`, `classKit` …) moved in from Nine Dragon | **Oddly named**: "kit", "ruled", "swept", "class" are one shard's vocabulary |
| `Material` | families (`toon` / `pbr` / `painterly`), SF59 graphs, `captureStaticMaterial`, and `looks/shaderFamily` raw GLSL rows | **Three paths, one undecided** (O4) |
| `Light` | look rows (sun, ambient, fog, LUT) in `shard.json`; `looks/lightVolume` (Nine only) | **Missing**: no `PointLight` / `SpotLight` equivalent as data |
| `InstancedMesh` | `bakeKinds(InstancedMesh[])`, `looks/bakedInstances`, SF9b instance lists | **Close to 1:1** |
| `SkinnedMesh` / `AnimationClip` | `bake/skinned` `sampleSkinClip` + `skinnedGlb` | **Good, 1:1** |
| `Texture` | `bake/texture` (`bakeColourTexture`, KTX2) | **OK** |
| LOD | automatic (`bake/worldLod`); no `THREE.LOD` analogue | **Missing as an author concept** |
| Behaviour (no three.js analogue) | about 37 runtime facades named after one shard's features (`phasedBoss`, `markedBoss`, `eliteScripts`, `hookCourse`, `ringPortals` …) | **Not an authoring API** (G296) |

### (c) Could an agent one-shot a new shard today?

**Yes, by copying the template, and only that way.** The two SF59 fixture shards (pastel plain, ink / cel valley) were
built from `_template` in hours, and they reach 95.7 %. From `docs/SHARDFILE.md` (94 KB) plus the SDK alone, an agent
would trip on:
1. 229 SDK exports with no marker of public vs runtime-facade, many named after another shard's feature.
2. Three material paths.
3. Generators allowed to import `@wildshard/engine` directly (§1 "whatever they import"), so it would copy that.
4. Bakers registered in repo `scripts/` and `bake-check`, not in the shard.
5. No scene-graph / light / LOD vocabulary that matches three.js.
6. The hybrid `runtime/` path being easier than the shardfile path for anything that moves.

**Recommendation:** make G302's one-shot test the exit of G299's SDK redesign. An agent builds a small new shard from
the docs plus an authoring-only SDK, with no template copy and no engine import, and the result is graded on the
three bars above.

## 5. The rest of the ledger, by risk

1. **HIGH: empty shardfiles and private bakes.** See O2. Generators were 64 % of Nine Dragon's public lines (7,564 of
   11,857). A game edit invalidates other shards' bakes (`2cbdc69f7`, `d8245e885`: Nalati, Pine and Driftwood
   rebaked after `rigidSkin.ts` / `herdShelter.ts` joined their bake inputs).
2. **HIGH: the commons is empty and the kit came back.** `src/commons` is 36 lines, 4 exports, **zero importers**, with
   no commit in 30 h. `game/systems/kit/*` plus 20 `sdk/kit/*` facades hold what G137 / G138 / SF26 meant for commons
   packs. Re-scope or close SF26 in G299.
3. **MEDIUM: guards.** G259's lint (*"refuse `@wildshard/game` imports from shard code outside `runtime/`"*) **was never
   written**. 520 shard files outside `runtime/` and `generators/` import engine/game. G288 (pusher speed) also removed
   G143's shrink-only ratchet on those imports; that side effect was never put to Jake. Restore it as its own small
   count, outside `layer-edges`.
4. **MEDIUM: behaviour went to TS archetypes, not AS.** AssemblyScript totals ≈ 670 lines across all shards (Nine 0).
   New engine brains (`phasedRaptor`, `ledgePouncer`, `packHowler`, `windStooper`, `phasedFlyer`) and one-user game
   bosses (`phasedBoss` Nalati, `markedBoss` / `bossFight` Signal, `eliteScripts` Pine). The real shared systems are
   `speciesBrains` (4 shards), `quests` (all), `director` (3, but only from `runtime/creatures`: no director rows in
   data yet) and `movers` (2). G299's mini plans should start from this list.
5. **MEDIUM: the witnesses prove trusted TS, not the shardfile.** The renderer-free laws ("one law, two hosts":
   grapple `sim.ts`, `EliteCore`, `sweptMeleeCore`, `GrassField`) are good engineering and worth keeping. The headless
   *installers* (Nalati ≈ 1.9k lines, Pine ≈ 0.8k) are the bridge G297 means.
6. **LOW: keep these.** Generated and baked output counts 0 lines. The SF34 player modes in the engine match G3.
   Bakes are cost-gated, and G262's parity-only bake boards work.

## Appendix: how to reproduce

- **Per-module users and moved lines:** a scratch script walks each non-legacy shard's imports into
  `src/{sdk,game,engine}`, following only SDK files and files absent at `3d68396a2`. A file used by exactly one shard is
  a relocation. Before / after shard lines come from `git archive 3d68396a2` (non-blank, non-comment `.ts` / `.as`
  lines; generated files excluded).
- **SDK classification:** each `exports` target is "facade" if it imports a value from `@wildshard/game|engine`, and
  "own" otherwise.
- **Shardfiles:** `public/shardfiles/<slug>/shard.json` from today's 06:09 build (`tiles.length`, `files.length`).
- **Shares:** `node scripts/shard-platform.mjs`. The legacy sizes use the same line counter as the moved-line numbers.
- These are estimates. The user walk ignores old platform hubs, so a few infrastructure files may be misattributed, and
  the GLSL counts are grep lower bounds.
