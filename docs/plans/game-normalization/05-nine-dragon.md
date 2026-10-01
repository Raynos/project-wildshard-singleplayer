# GAME-NORMALIZATION v2 · 05 — Nine Dragon Stack becomes a plugin (S1.1–S1.6, milestone M1)

Nine Dragon Stack (`nine-dragon-stack`) is the first shard to move because it is already half a plugin: its code sits
in one folder and plugs into the engine through the lazy `ChunkDef` hooks (`render`, `structures`, `sword`,
`traversal`, `roster`). This spec turns it into a manifest + plugin on the interfaces of
[01-architecture.md](01-architecture.md), builds the engine systems it is the first to need, gives it its own audio
(decision 44 / 71) and the budget calibration scene (S1.6), and ends at M1.

Weapon and creature internals (profiles, the Melee family, the damage pipeline, effects) are specified in
[09-combat-ai.md](09-combat-ai.md). This file owns the shard side: what Nine Dragon hands the engine, and every line
of engine code that branches on it today.

## 0. How to read this spec

| Rule | Detail |
|---|---|
| **Line references** | `file:line` refers to the tree at `3f83fd2e` (no `src/` change since `a9904a84`). F1–F12 run first and move files (F6) and lines (F8, F10, F11). Every row therefore also gives a **grep key**: a short quoted fragment of the code that is still unique after the move |
| **Paths after F6** | F6's codemod has moved `src/chunks/nine-dragon-stack/` to `src/shards/nine-dragon-stack/` (`#shards/nine-dragon-stack`), engine folders to `src/engine/…`, and generated files to `src/engine/boot/`. `src/main.ts` keeps its path until S4.4. A path written `shard:x` means `src/shards/nine-dragon-stack/x` |
| **At S1 start** | F0–F12 are done: the spine (App, systems, states, events, scope, services, seeded RNG, game clock: F8), the generated registry with `ShardManifest` and `ShardPlugin` (F9), SaveStore (F10), the resident host retired (F11), Rapier 0.21 (F12), the parity harness with Nine Dragon in it (F2) and the GPU gate (F3). F6 renamed `def.ts` to `manifest.ts` mechanically: at S1 start it still carries the old hook fields (`sword`, `structures`, `traversal`, `fov`, `bounds`, `map`, …) under the transitional type 02-foundations F6 defines. S1.1 removes them |
| **`level.x` and `manifest.x`** (R2-02) | In the "replaced by" columns, `level.<field>` is data the shard declares in its manifest (§3) that the **engine** reads through the `LevelSpec` `toLevelSpec(manifest)` builds (01 §5a): engine code never reads a manifest. `manifest.<field>` is read only by `#game` (`bag`, `card`, `status`, `next`, `loot`, `bodyShadow`, `respawn`, `name`, `load`), by the composition root (`main.ts`), by `scripts/check-lock.mjs` (`assetGlobs`, R3-09) or by the shard's own code |
| **Order inside S1** | S1.1 → S1.2 → S1.3 → S1.4 → S1.6 (R1-23). S1.2 (Equipment / Weapon + the Melee family) and S1.3 (the pipeline, cues, effects core) come before S1.4 (the Tool contract, the Fei Zhua), which builds on both; 09 §6 has the same order. S1.5 runs beside them: its model jobs queue on the machine-wide model lock and are run by the lead in the background (12-process §4) |
| **Every commit** | 12-process §5 (R1-10): a pathspec commit `E357 S1.<n>: …`; on it, `node scripts/parity.mjs --export=<sha> --shards=<changed> --tiers=phone` green against the lane's baselines (`<sha>` is the commit's own SHA, captured right after the commit, never `HEAD`, which other agents move; R2-25) and `pnpm test` green. A subagent runs only this phone lane for its shard (< 4 min); anything longer is "queued: <command>" for the lead. Before every push, `node scripts/parity.mjs --export=<sha> --shards=all --tiers=phone,desktop` green, then `scripts/push-main.sh`. `<changed>` is **all four shards** on any commit that edits an engine file, because an engine edit can move another shard |

## 1. Inventory (a): every file of Nine Dragon's code today and where it goes

The rule of two and mechanism-vs-content (plan §2.1) decide each row. "F6" in the *When* column means the codemod
already did the move; the S1 row then restructures the file in place.

### 1.1 `src/chunks/nine-dragon-stack/` (108 files, 25,487 lines)

| Files (lines) | Destination | When | Why / what changes |
|---|---|---|---|
| `def.ts` (153) | `shard:manifest.ts` (data) + `shard:plugin.ts` (new, the code) | F6 rename; S1.1 split | The hook fields leave the manifest (§3). `FILES` / `TEX` (`def.ts:26-37`) become `boot.files` |
| `index.ts` (57) | `shard:world/install.ts` | S1.1 | `NINE_DRAGON_WORLD.build` becomes `installWorld(ctx, rt)`, called by the plugin in the `level.world` stage. The module-level `current`, `camera`, `grappleGuardOpen` (`index.ts:13-15`) move into one `NdRuntime` object the plugin creates and disposes with `ctx.scope` (§4). `nineDragonWorld()` / `cullNineDragonWorld()` / `setGrappleGuardOpen()` read it. `ctx.registry.add` → `ctx.piece`; `ctx.onUpdate` → `ctx.system` |
| `bag.ts` (17) | folded into `shard:manifest.ts` (`loadout`, `bag`) and `shard:strings.ts` | S1.1 (names), S1.4 (Fei Zhua gear card) | `NINE_WEAPON_NAME` → the jian's loadout row name `strings['weapon.jian']`; `FEI_ZHUA` → the Fei Zhua Tool's `meta` (01 §18, R1-26: `EquipmentMeta`; `#game`'s Bag builds the GEAR card from it). File deleted at S1.4 |
| `layout.ts` (50), `places.ts` (11), `roster.ts` (10), `util.ts` (47), `mockupCameras.ts` (51) | same names under `shard:` | F6 | `util.ts`'s `Rng` class is deleted at F8, which lands the one RNG (02 F8 step 1; 13-lead-resolutions G18); its palette exports stay. `mockupCameras.ts` and `places.ts` are read by scripts and `check-models.mjs:217` (their paths are rewritten by F6's mapping table). `mockupCameras.ts` also feeds the harness's poses (§8) |
| `grapple/Traversal.ts` (589) | `shard:grapple/FeiZhua.ts` | S1.4 | `installFeiZhua(ctx)` becomes `class FeiZhua extends Tool` (01 §18). The three hand-chained hooks (`lock.onTryToggle` :364, `player.onJumpRequest` :385, `player.traversalStep` :406) become the `grapple` input context and the `player.traversal` ask (§6.4). The `ws:practice-active` listener (:363) becomes `ctx.on('practice.active')`. The chip and ◇ marks appended to `#hud` (:258-274) become HUD widgets (§6.4) |
| `grapple/course.ts` (48), `grapple/line.ts` (220) | same names under `shard:grapple/` | F6 | `setGrappleCourse` / `playgroundCourse` stay (the playground and the Tool are in the same shard now) |
| `grapple/fx.ts` (201) | `shard:grapple/fx.ts` | F6; X5 | Its point pool (`fx.ts:55`) merges into the engine's one particle pool at X5 (10-sweeps) |
| `look/render.ts` (213) | `shard:look/render.ts` | F6; S1.1 edits | Stays the `LookStrategy`. `TIER` read (:10, :109) → the tier data of §3 (`tiers.phone.aa`). `document.addEventListener('ws:practice-active' / 'ws:studio-active')` (:73, :94) → bus events. `Reflect.set(window, '__ndRender')` (:180) → `ctx.debug.expose('nd.render', handle)` (question Q5) |
| `look/post.ts` (372) | deleted | F7 | Unimported (the dev page's copy, plan F7) |
| `look/light/grade.ts` (90) | `shard:look/light/grade.ts` | F6; X5 | Its `loadLut` (:43) merges into the one LUT loader at X5 |
| `look/specimenLight.ts` (55) | `shard:look/specimenLight.ts` | F6; S1.1 edit | `document.addEventListener('ws:turntable')` (:50) → `ctx.on('explore.turntable')` |
| `look/glyphs.ts` (168), `look/paint.ts` (242), `look/signs.ts` (412), `vm/materials.ts` (584) | same names | F6; S1.1 edits | Their module-level `TIER === 'phone'` reads (`glyphs.ts:87-90`, `paint.ts:39`, `signs.ts:37`, `materials.ts:109`) become reads of `app.tiers.current` passed in by the world build (the values are unchanged; the reads leave module scope so a node test can import the files) |
| every other `look/**` file: `emitters.ts` (75), `facadeMaterial.ts` (616), `lanterns.ts` (272), `light/glow.ts` (51), `light/halos.ts` (131), `light/install.ts` (98), `light/lightvol.ts` (239), `light/pools.ts` (77), `neonsigns.ts` (336), `render/bleed.ts` (210), `render/haze.ts` (190), `render/jiehua.ts` (264), `render/reflect.ts` (290), `scroll.ts` (174), `streaks.ts` (319), `style.ts` (1,467) | same names under `shard:look/` | F6 | Content (the Jiehua Neon look). `performance.now` in `emitters.ts:42,68,70` and `lightvol.ts` (2) are task-yield timers: they become `app.clock.real` (the determinism ratchet's cosmetic allowlist does not need them) |
| `models/*.ts` (22 files, 1,184 lines: `balustradePanel`, `banyan`, `bridgePosts`, `crowd`, `facade`, `feiZhuaHook`, `gear`, `inKit`, `landingPlanter`, `laundry`, `lion`, `lotusFinial`, `market`, `movers`, `paifang`, `paperLantern`, `signs`, `stalls`, `wallKit`, `wellBalustrade`) | same names under `shard:models/` | F6 | Content, on the model contract (`defineModel`). `check-models.mjs` folder rules are re-pointed by F6 (TP10) |
| `vm/arms.ts` (64), `vm/cloth.ts` (421), `vm/fpArms.ts` (488), `vm/geo.ts` (289), `vm/jian.ts` (253) | same names under `shard:vm/` | F6; S1.2 edits | The jian's viewmodel. `jianArms()` becomes the jian profile's `viewmodel` factory (§6.2). `Math.random()` in `fpArms.ts:291` (the trail seed) → `app.rng.stream('cosmetic').next()` |
| `vm/rig.ts` (310) | `src/kit/viewmodel/armRig.ts` | F6 | Rule of two: `scripts/blender/driftwood-isle/fp-arms/bake.mjs:27` builds Driftwood's arms from it |
| `vm/trail.ts` (197) | `shard:vm/trail.ts` | F6; X5 | The slash-trail geometry merges into the engine's one trail block at X5; the shader stays here |
| `world/hero/paifang.ts` (267) | deleted | F7 | Unimported by `src/`, `test/` and `scripts/` at `3f83fd2e` (a clean-room copy superseded by `world/gate.ts`). On F7's one dead list (02 F7 step 3; 13-lead-resolutions still-open 05#7), so it is gone before F6 moves anything |
| `world/cull.ts` (308) | `shard:world/cull.ts` | F6; X5 | Its `InstanceCuller` implements the engine culler interface at X5 (01 §17 *Culling*). The per-camera cull still runs from `render.frame` (the camera final) |
| `world/facade/rng.ts` (34) | deleted | F8 | The one RNG lands at F8 (02 F8 step 1; 13-lead-resolutions G18): `grammar.ts` builds `Rng.scrambled(seed)` from `#engine`, the facade copy's seed scramble, so the draw order and every tower stay identical (a test pins the old sequence) |
| `world/build.ts` (501) | `shard:world/build.ts` | F6; S1.1 edits | Its 18 `performance.now()` calls are build-phase profiling and task yields → `app.clock.real`; `progress` keeps its signature (it is `ctx.progress`) |
| every other `world/**` file: `banyan` (374), `canopy` (543), `colliders` (97), `crowd` (277), `ctx` (119), `dressing` (126), `facade/batch` (149), `facade/geo` (297), `facade/grammar` (895), `facade/pieces` (465), `facades` (233), `gate` (570), `hero/figures` (194), `hero/glb` (196), `hero/kitx` (246), `hero/vm-material` (370), `hero/weapon-parts` (283), `inKit` (57), `jian` (129), `kit` (301), `lod` (67), `modelLook` (65), `props` (208), `props3d` (133), `sets` (53), `square` (444), `squareProps` (58), `stairstreet-upper` (1,048), `stairstreet` (917), `stalls` (629), `towers` (433), `well-bridges` (692), `well-galleries` (457), `well-lower-deep` (191), `well-lower-life` (517), `well-lower` (101), `well-mid` (346), `well-plan` (222), `well-rim` (196), `well` (58), `words` (9) | same names under `shard:world/` | F6 | Content. `facade/batch.ts:105,121` task-yield timers → `app.clock.real`. The facade stays instanced (the E271 rule; `test-facade-instancing.mjs` stays in the gate) |

### 1.2 Nine Dragon code and data outside its folder

| Today | Lines | Destination | Row |
|---|---|---|---|
| `src/boot/nineBootTrace.ts` | 282 | `src/engine/boot/bootTrace.ts`, generic: every `Nine`/`nine` name drops the shard word (`recordNineBootCheckpoint` → `recordBootCheckpoint`, …). It traces a boot only when the manifest says `boot.phone.trace: true` (§3). Its store `ws.nineBoot` (:7) becomes the SaveStore global key `boot.trace` (01 §9), and the record carries the slug it traced | S1.1 |
| `src/boot/nineGpuTrace.ts` | 42 | `src/engine/boot/gpuTrace.ts` (`recordNineGpuCheckpoint` → `recordGpuCheckpoint`, `traceNineBootPasses` → `traceBootPasses`) | S1.1 |
| `src/telemetry/bootInbox.ts` | 12-line body | `src/engine/telemetry/bootInbox.ts`; `shard: 'nine-dragon-stack'` (:12) → the traced record's slug | S1.1 |
| `src/playgrounds/GrapplePlayground.ts` | 272 | `shard:playground/GrapplePlayground.ts`, registered with `ctx.playground` | S1.4 |
| `src/playgrounds/grappleCourse.ts` | 87 | `shard:playground/grappleCourse.ts` | S1.4 |
| `src/playgrounds/catalog.ts:29` (the `grapple` card) and the `CLAW` icon (:24) | 2 | the card's data moves into the plugin's `ctx.playground({...})` call; `PlaygroundId` stops being a closed union (EI22) | S1.4 |
| `src/playgrounds/load.ts:13-15` (`id === 'grapple' ? import('./GrapplePlayground')`) | 3 | the registered playground's `load` thunk | S1.4 |
| `src/chunks/thumbs/nine-dragon-stack{,-portrait,-landscape}.jpg` | 3 files | `shard:thumbs/` (TP12: the art module reads `src/shards/*/thumbs`) | F6 |
| `src/explore/img/{practice,world,models,sets}-nine-dragon-stack.webp` | 4 files | `shard:explore/`; named by `level.explore.art` | F6 (move), S1.1 (manifest) |
| `src/explore/Compare.ts:33-36` (two compare pairs) | 4 | `level.explore.compare` | S1.1 |
| `src/ui/titleDeck.ts:27-29, 51` | 4 | the deck is built from the generated registry at F9; S1.1 only checks the card equals the manifest (`test/title-deck.test.ts`) | F9 |
| `src/game/Inventory.ts:88` (`isNoPackChunk`: `/nine-dragon-stack`) | 1 | `manifest.bag.pack.slots: 0` (question Q1) | S1.1 |
| `src/player/rigArms.ts` | 1 file | `src/kit/viewmodel/rigArms.ts` (rule of two: Nine Dragon `vm/arms.ts`, `vm/fpArms.ts` and Driftwood `fpArms.ts` import it). X4 may lift its player half into `#engine/anim` | F6 |
| `public/assets/nine-dragon/**` (14 MB incl. `lab/`, `viewmodel/`, `paint/`), `public/assets/gpu/nine-dragon/**` | — | **not moved** (plan F6, TP §5). `lab/` stays: the shipped shard loads it | — |
| `scripts/nine-dragon-budget.mjs` | — | deleted at S1.6: the gate's budget check (03-harness-gate) covers its four `MOCKUP_CAMERAS` poses with derived numbers | S1.6 |
| `scripts/nine-dragon-{domes,gpu,grapple-touch}.mjs`, `nine-sim-memory.mjs`, `test-nine-{crash-reports,gpu-boot,native-startup}.mjs`, `test-nine-gpu-boot.sh`, `e314-nine-bag-capture.mjs`, `playground-grapple.mjs` | — | kept or deleted by F7's liveness rule; the live ones are ported to `window.__wildshard` by F7. `test-nine-gpu-boot.sh` is `pnpm test:gpu-boot` (live): it is renamed `test-gpu-boot.sh` at S1.1 and reads `boot.phone.fragile` from the manifest instead of assuming the shard | F7, S1.1 |
| `test/nd-specimen-light.test.ts`, `test/nine-dragon-models.test.ts` | — | `test/shards/nine-dragon-stack/` | F6 (TP11) |
| `test/nine-boot-trace.test.ts`, `test/nine-gpu-trace.test.ts` | — | `test/engine/boot-trace.test.ts`, `test/engine/gpu-trace.test.ts`, rewritten for the generic names; one case boots a fixture manifest with `boot.phone.trace` on and one with it off (no record written) | S1.1 |
| `test/bag-tabs.test.ts:11-12` (imports `FEI_ZHUA`, `NINE_ROSTER`) | 2 | reads the Fei Zhua's GEAR card built from the Tool row's `meta` (R1-26) and the roster from the manifest's `roster` thunk | S1.4 |
| `test/models-rosters.test.ts:8` | 1 | reads every manifest from `shards.generated.ts` | F9 |

## 2. (b) Every engine line that branches on or wires Nine Dragon, and what replaces it

Grep keys are in backticks. "Deleted" means the line goes with nothing in its place because the replacement is data
or a plugin verb named in the same row.

### 2.1 `src/main.ts`

| Line(s) | Grep key | What it does today | Replaced by |
|---|---|---|---|
| 40 | `import { FEI_ZHUA, NINE_WEAPON_NAME }` | the Bag's gear card and the jian's name | deleted: the Tool row (S1.4) and the jian row's name (S1.2) |
| 146 | `import { beginNineExploreEntry, recordNineBootCheckpoint` | boot trace | the generic `bootTrace` (`#engine/boot`), called unconditionally; it records only while a trace is running |
| 217 | `resumeScreen().brand(getActiveChunk().slug.split('-')…` | the RESUMING screen's shard name from the slug | `manifest.name`, which the composition root (`main.ts`) hands the resume screen; the engine never reads the game's `name` (R2-02). A latent bug: today it spells "Nine Dragon Stack" right only by luck of the slug; kept identical |
| 241-242 | `const extrasBarrier = pack === null && getActiveChunk().slug === 'nine-dragon-stack'` | the audio / art extras wait for every per-file world fetch | `level.boot.barrier: true` (both tiers: today the condition holds on desktop too, because no shard has a desktop pack; question Q2). Once S1.1 step 7b gives Nine Dragon its packs, the flag means **the extras pack finishes before the first frame, on every tier** (R1-38) |
| 247-250 | `const deferExtras = getActiveChunk().slug === 'nine-dragon-stack' && TIER === 'phone'` | the menu art and audio decode later on the phone | `level.boot.phone.deferExtras: true` (01 §8) |
| 251 | `startViewmodelTextures((getActiveChunk().weapon ?? 'crossbow') === 'crossbow')` | the crossbow / rifle texture worker starts only on a crossbow shard | the loadout: the worker starts in `level.kit`, once the rows exist, when a loadout row's family declares `preload.textures` (09-combat-ai; R3-03: `level.data` prefetches files only). Nine Dragon's jian declares none: identical |
| 258-275, 1234-1239, 1261, 1264 | `const fragileBoot = TIER === 'phone' && slug === 'nine-dragon-stack'` | the phone GPU-boot guard: context-loss listener, `failGpuBoot`, the shader / first-frame checks, the recovery host's `fragileBoot` | the engine's boot guard in the `finish` stage, on when `level.boot.phone.fragile: true`. The error text `Nine Dragon GPU boot failed: ${reason}` (:269) becomes the string key `boot.gpuFailed` from the level's string table (Nine Dragon's says "Nine Dragon GPU boot failed"), shown as `${strings.t('boot.gpuFailed')}: ${reason}`: identical for this shard, and the engine reads no game `name` (R2-02) |
| 266-267, 1334 | `markNineBootContextLost()` / `markNineBootHandledError()` | the trace's end state | `bootTrace.markContextLost()` / `markHandledError()` |
| 284-285, 418, 431, 444, 475-480 | `const built = chunk.structures` | a structure-first shard: no paths, no carpet, no cabins; its world built in the `props` step | `level.ground.structures` (the manifest's `ground: { structures: true }`, 01 §6, §5a) tells the engine to skip terrain colliders and the terrain draw; the grass / cabins / props / paths builders are **no longer engine steps** at all after S2.1 / S3.1 / S4.1 (each shard builds its own world in `level.world`). For S1, `built !== undefined` becomes `level.ground.structures === true` in the four remaining places, and the ND branch at :475-480 is deleted: Nine Dragon's world is built by `plugin.world(ctx)` in the `level.world` stage (§4, R1-24) |
| 505 | `listShardModels({ roster: chunk.roster, style: chunk.style ?? 'pbr'` | the Model Explorer's live roster | `level.roster` (unchanged thunk) and `level.kitLook` (question Q1) in place of `style ?? 'pbr'` |
| 517 | `chunk.sword?.() ?? null` in the `weapon` step | the shard's own sword viewmodel | deleted: the loadout's rows build their own viewmodels in the `level.kit` stage (S1.2) |
| 531-534 | `chunk.weapon === 'sword' ? new Sword(…, { …ownSword, …(chunk.fov ? { portraitFov: chunk.fov.portrait } : {}) })` | the base weapon | the equipment service from `level.loadout` (S1.2). The portrait FOV leaves the weapon: `level.camera.portraitFov: 78` (combat-ai-audit M8; question Q1) |
| 539 | `const rifle = chunk.weapon === 'sword' ? null` | no rifle slot on a sword shard | the loadout lists no rifle: no slot |
| 545-549 | `const isNine = chunk.slug === 'nine-dragon-stack'` … `isNine ? { baseName: NINE_WEAPON_NAME }` | no iron sword; the jian's display name | deleted: Nine Dragon's loadout has one row (the jian, named by its row) |
| 556-565 | `await chunk.traversal?.({ game, player, physics: world.physics, arms: shardSword?.arms ?? null, lock: lockSys, …touchHint` | installs the Fei Zhua on LOCK / JUMP | deleted: the Fei Zhua is a Tool row in the loadout (S1.4); its context, relabels and ask answers are registered by the Tool's `install` through the plugin verbs |
| 587-588 | `const mood = chunk.ocean ? 'island' : chunk.style === 'painterly' ? 'steppe' : 'pine'` | Nine Dragon plays **Pine Hollow's theme** | `level.audio.score` (S1.5): the music engine plays the shard's `ScoreSource`. Bug §7 B1 |
| 595-611 | `if (chunk.bounds !== undefined)` … `'bounds'` | the soft respawn inside the fragment's box | the engine system `engine.world.bounds` (phase `update`, `when: inState('play')`), on when `level.bounds` is set. Same code, moved |
| 625 | `...(isNine ? { tools: () => [FEI_ZHUA] } : {})` | the Bag's GEAR card for the grapple | deleted: `#game`'s Bag builds a GEAR card from every loaded Tool's `meta` (R1-26; S1.4) |
| 691-692 | `if (chunk.weapon === 'sword') (crossbow as Sword).onHeavy` / `const meleeHeld = () => chunk.weapon === 'sword'` | sword sounds | the cue map: `cue.swing`, `cue.swing.heavy`, `cue.hit.<surface>`, `cue.clang.<surface>` (S1.5 maps them for Nine Dragon; 09-combat-ai lists every cue) |
| 694, 703 | `else if (!isOcean) audio.swordSwing()` / `audio.swordHit(surface, pan, gain)` | the synth sword sounds on every non-ocean sword shard | Nine Dragon's cue map (S1.5) |
| 836-837 | `if (meleeShard(chunk) \|\| pineFights !== null) hurtArc.hit(…)` | the hurt arc on melee shards | the damage pipeline's `damage.dealt` subscriber (S1.3), on every shard |
| 898 | `: ambience instanceof ForestAmbience ? ambience.stepSurface(p.x, p.z, p.y) : 'litter')` | Nine Dragon's footsteps are **pine litter** on granite | the surface the player stands on: the registry piece's `surface` (`nds-floors`: `'stone'`, `nds-crossings`: per box) mapped by Nine Dragon's cue map (S1.5). Bug §7 B2 |
| 945 | `player.onLand = (hard) => { … health = Math.max(0, health - 8)` | a hard landing costs 8 | the damage pipeline: `combat.hit({ source: 'env', sourceTags: ['env.fall'], amount: 8, … })`, no `cause` (the death card's no-killer line, as today; 01 §18, 09 §3.3) (S1.3) |
| 1043, 1054, 1058 | `beginNineExploreEntry(mode)` / `recordNineBootCheckpoint('explore:imported')` | trace Explore's entry on the phone | the generic `bootTrace` calls (no-ops unless a trace runs) |
| 1243-1283 | `if (deferredAudio) {` … `deferred Nine Dragon decode` | decode the selected audio after the loader's peak | the `boot.phone.deferExtras` path in `#engine/boot`; the log line names `level.id` (the engine logs the id and never compares it, 01 §5a) |
| 1296 | `const handle = { ...world, …, crossbow, …, weapons, pineLife, …` | `window.__world` | `window.__wildshard` (F2 / TP4); `__world` stays as the deprecated alias (01 §5). Nine Dragon adds nothing to it |

### 2.2 `src/core/Game.ts`

| Line(s) | Grep key | Today | Replaced by |
|---|---|---|---|
| 29-30 | `import { recordNineGpuCheckpoint, traceNineBootPasses }` | trace imports | `#engine/boot/gpuTrace`, `bootTrace` |
| 210-218 | `const phoneNine = TIER === 'phone' && getActiveChunk().slug === 'nine-dragon-stack'` (constructor) | renderer creation checkpoints | `if (bootTrace.active)` — the trace is started by `boot.phone.trace` before the renderer exists |
| 245 | `const render = getActiveChunk().render?.() ?? null` | the LookStrategy loads while the sky builds | `level.look` (the manifest's `render`, 01 §5a) is called by the render service in the `engine` stage, as today |
| 290 | `if (getActiveChunk().slug !== 'nine-dragon-stack' \|\| TIER !== 'phone' ? (R?.ao ?? TIER_CONFIG.ao) : false)` | **the engine turns off Nine Dragon's AO on the phone** over its own `LookStrategy.ao: true` | `level.tiers.phone.ao: false`. The render service resolves each LookStrategy knob as `level.tiers[tier].<knob> ?? render.<knob> ?? engineTier.<knob>` (question Q4). Plan §7.7 |
| 469-487 | `const phoneNine = …` in `precompile` | compile checkpoints | `if (bootTrace.active)` |
| 497-506 | `const warmTurns = phoneNine ? 0 : WARM_TURNS;` … `if (phoneNine) this.shardRender?.frame?.(0.016, 0)` | no four-turn warm-up on the Nine Dragon phone; the shard's cull before the first draw | `level.tiers.phone.warmTurns: 0` (the tier knob `warmTurns`, engine default 4) and `level.boot.cullBeforeFirstDraw: true` (the engine calls `render.frame` once before the first world draw). Question Q2 |
| 532 | `if (phoneNine) traceNineBootPasses(…)` | per-pass trace | `if (bootTrace.active) traceBootPasses(…)` |
| 657 | `if (nineExploreEntryPending() && …) recordNineExploreFrame()` | Explore entry trace | `bootTrace.exploreEntryPending()` / `recordExploreFrame()` |

### 2.3 `src/core/bootstrap.ts`, `src/boot/*`, `src/core/GpuRecovery.ts`

| File:line | Grep key | Today | Replaced by |
|---|---|---|---|
| `bootstrap.ts:4, 76` | `if (def.slug === 'nine-dragon-stack') recordNineBootCheckpoint('renderer:waiting'` | trace while WebGL recovers | `bootTrace.checkpoint('renderer:waiting', …)` (no-op unless tracing) |
| `bootstrap.ts:34-36, 87` | `TREE_FACTORIES` … `none: (…) => new TreeFactory(renderer).buildEmpty()` | an empty forest for Nine Dragon (`trees.factory: 'none'`) | Nine Dragon's manifest has no `forest`: the engine builds no Forest (01 §17 *Terrain optional*). Today's empty Forest draws nothing (`f.group.visible = false`, :91), so draws are identical; its empty batches' memory goes (expected, M1 summary) |
| `bootstrap.ts:101` | `if (def.structures === undefined) addTerrain(ph)` | no terrain collider on a structure-first shard | `if (level.ground.terrain !== undefined && level.ground.structures !== true) addTerrain(ph)` (R3-02, 01 §5a): both conditions, as today. Nine Dragon declares `ground: { terrain: TERRAIN, structures: true }`, so it gets **no** terrain collider; its flat datum stays placement-only (`heightAt()` for placement and sound), and the player walks on its built floors alone. A bootstrap contract case with both fields set proves the WORLD heightfield is absent and the built floors' collider census is today's |
| `boot/manifest.ts:84-86, 101` | `const built = def.structures !== undefined;` … `props: t(def.structures ? def.structures.files…` | Nine Dragon's files declared through `structures.files` | `level.boot.files(tier)` (01 §8), which returns today's `FILES` list for both tiers. `chunkFiles` stops reading `structures` |
| `boot/extras.ts:163-176` | `startDeferredAudioPreload` … `const slots: SlotName[] = def.ocean ? ['title', 'island'] : ['title', 'pine']` / `const bed: AmbientBed = def.ocean ? 'island' : 'forest'` | the deferred phone decode of **Pine Hollow's slot and the forest bed** | `level.boot.audio` (S1.5): the title slot of the selected style, Nine Dragon's first score slot and its two ambience beds. Bug §7 B1 |
| `boot/extras.ts:57, 118, 149` | `if (key.startsWith('../explore/') && def.ocean === undefined) continue;` | Explore's art and code are not preloaded (plan §7.4) | `level.boot.explore` is declared at S1.1; X3 makes extras.ts honour it for every shard (10-sweeps X3) |
| `boot/audioFiles.ts:50-59, 97-101` | `const PINE = 'pine-hollow'` / `const unplayed = (slug)` | Nine Dragon downloads every base style **including Driftwood's `island` slot** and every Nalati-tagged SFX | `level.boot.audio` (S1.5). Bug §7 B3 |
| `boot/gpuFiles.ts:66` | `if (TIER === 'phone' && slug === 'nine-dragon-stack') resolved = { mode: 'img'` | KTX2 off on the Nine Dragon phone (E248) | `level.tiers.phone.textures: 'img'`, read through the generated registry (node-safe) |
| `boot/precompile.ts:30` | `import { recordNineBootCheckpoint }` | trace | `bootTrace` |
| `boot/lastEnd.ts:22, 79, 113, 135, 139` | `inspectPreviousNineBoot` / `markNineBootPlanned` / `previousNineBootLine` | the last-end line and the planned-reload mark | `bootTrace.inspectPrevious()`, `markPlanned()`, `previousLine()` |
| `boot/entry.ts:17, 33, 36-43` | `const rescueNine = previousNineBootLine() !== '' && search.get('chunk') === 'nine-dragon-stack'` | after a crashed Nine Dragon boot, the next launch stays on the title | `const rescue = bootTrace.previousLine() !== '' && search.get('chunk') === bootTrace.previousSlug()` (the record names its slug; entry.ts reads no manifest) |
| `core/GpuRecovery.ts:44, 151-156` | `import { recordNineGpuRecovery }` | trace a recovery | `bootTrace.recordGpuRecovery`; `fragileBoot` is already a host callback, now fed from `boot.phone.fragile` |
| `boot/steps.ts:111-114` | `useShardSteps(slug)` | Nine Dragon has no row: the shared table | `level.boot.steps` (empty for Nine Dragon: the shared labels). X3 replaces the 16 keys with the stages |
| `chunks/registry.ts:18, 40` | `import { NINE_DRAGON_STACK }` / `export const PROTOTYPES` | a hand list | gone at F9 (`shards.generated.ts`); `status: 'experimental'` replaces `PROTOTYPES` |

### 2.4 `src/ui/*`, `src/explore/*`, `src/playgrounds/*`, audio, world

| File:line | Grep key | Today | Replaced by |
|---|---|---|---|
| `ui/Loading.ts:7, 45, 85` | `if (chunk.slug === 'nine-dragon-stack' && TIER === 'phone') startNineBoot()` | start the trace | `if (level.boot.phone?.trace === true && tier === 'phone') bootTrace.start(level.id)` |
| `ui/ErrorModal.ts:32, 239, 268` | `nineBootDiagnostic()` | the diagnostic in the error report | `bootTrace.diagnostic()` |
| `ui/StartTitle.ts:5` | `previousNineBootLine` | the title's "last boot died" line | `bootTrace.previousLine()` |
| `ui/HurtArc.ts:87-91` | `return 'respawning at the south gate'` | Nine Dragon's death card says **south gate** | the shard's string `respawn.default` (`'respawning in Lantern Square'`). Bug §7 B4 |
| `ui/Menu.ts:88, 300, 334` | `tools` option, `no FEATS` | the grapple card; no PACK / FEATS | Bag tabs from `manifest.bag.tabs` (`['map', 'gear']`, E314 A), read by `#game`'s Bag at X2; until X2 `#game` hands the Menu its `bag.tabs` in place of the pack-slots / achievements test (the engine never reads the manifest, R2-02) |
| `ui/bag.ts:14, 30, 39, 95` | comments naming the grapple | — | comment edits only |
| `explore/Explore.ts:27, 47-75` | `PRACTICE_ART` / `WORLD_ART` / `MODELS_ART` / `SETS_ART` maps | the hub's card art by slug | `level.explore.art` (EI21). The four `Record<string, string>` maps lose Nine Dragon's entries at S1.1 and are deleted when the last shard moves (S4.1) |
| `explore/Compare.ts:33-36` | `'nine-dragon-stack': [ pair('gate'…` | the compare pairs | `level.explore.compare` |
| `explore/ModelExplorer.ts:22, 395, 894-900` | `ws:turntable` | tells the shard a model is on show | `app.events.emit('explore.turntable', { on })` |
| `playgrounds/catalog.ts:29`, `load.ts:13`, `GrapplePlayground.ts:17` | `shard: 'nine-dragon-stack'` / `import('./GrapplePlayground')` / `from '../chunks/nine-dragon-stack/grapple/course'` | the grapple room | `ctx.playground(...)` (S1.4) |
| `audio/Audio.ts:145-146` | `this.bed = def.ocean ? 'island' : def.style === 'painterly' ? 'steppe' : 'forest'` | Nine Dragon hears **the pine-forest bed** | `level.audio.ambience` (S1.5). Bug §7 B1 |
| `audio/Music.ts:500` | `shard: getActiveChunk().ocean ? 'island' : 'pine'` | the score's first mood | `level.audio.score` (S1.5) |
| `world/Terrain.ts:186, 200-212` | `if (getActiveChunk().structures !== undefined) return this.buildNone();` | no ground drawn | `level.ground.structures === true`. The flat `ground.terrain` (`heightAt = 0`) stays for `heightAt()` callers (placement, sound) |
| `world/Sky.ts:95-103, 207-250, 440-470` | `const painted = S.painted ?? null` / `buildClouds` | Nine Dragon's painted gradient sky; the cloud dome is built and then hidden by `look/render.ts:57-63` | unchanged in S1 (identical draws: the dome is hidden). X5 gives Nine Dragon a `backdrop` and deletes the hidden build (10-sweeps X5) |
| `world/Grass.ts`, `world/Atmosphere.ts` | — | no Nine Dragon branch | — |
| `core/tier.ts` | — | no Nine Dragon branch (its phone cuts live in `Game.ts` and `gpuFiles.ts`, above) | — |

## 3. (c) The manifest, in full

`src/shards/nine-dragon-stack/manifest.ts`. Node-safe: it imports only `layout.ts` (constants), the flat terrain
(`./terrain.ts`: `def.ts:52-62` moved as is), the thumbnail URLs and lazy thunks. Every value is today's (source in the
comment). Every `ChunkDef` field is carried over under 01 §6's names (13-lead-resolutions 05/06#1). Fields marked **Q1**
are this spec's sub-fields (`kitLook`, `bag.pack`, `dev.poses`); all three are declared manifest fields in 01 §6 "Declared
sub-fields" (13-lead-resolutions still-open 05#1).

```ts
import { defineShard } from '#game';
import { PLAZA, STAIR, STREET, WELL, Y0 } from './layout';
import { TERRAIN } from './terrain';                                        // def.ts:52-62 as is: buildTerrain(SEED, { landscape: () => 0, 4 entry trails, no cabins })
import thumb from './thumbs/nine-dragon-stack.jpg';
import portrait from './thumbs/nine-dragon-stack-portrait.jpg';
import landscape from './thumbs/nine-dragon-stack-landscape.jpg';
import practiceArt from './explore/practice-nine-dragon-stack.webp';
import worldArt from './explore/world-nine-dragon-stack.webp';
import modelsArt from './explore/models-nine-dragon-stack.webp';
import setsArt from './explore/sets-nine-dragon-stack.webp';

const TEX = ['concrete', 'flag', 'flag-a', 'flag2', 'flag2-a', 'lacquer', 'panel', 'poster', 'poster-a', 'stone', 'tiles', 'wood'];
const FILES = [                                                            // def.ts:27-37, unchanged
  ...TEX.map((t) => `/assets/nine-dragon/paint/${t}.jpg`),
  '/assets/nine-dragon/lab/walker.glb', '/assets/nine-dragon/lab/sitter.glb', '/assets/nine-dragon/lab/grapple/dragon-hook.glb',
  ...['lion', 'pots', 'lanterns'].map((m) => `/assets/nine-dragon/lab/organic/${m}.glb`),
  '/assets/nine-dragon/lab/organic/leaf-atlas.webp', '/assets/nine-dragon/lab/organic/scroll.webp',
  '/assets/nine-dragon/grade-lut-cleanroom.bin', '/assets/nine-dragon/viewmodel/fp-rig.glb',
  ...['hand-r', 'arm-r', 'fist-l', 'gauntlet'].flatMap((n) => [`/assets/nine-dragon/viewmodel/${n}-maps.webp`, `/assets/nine-dragon/viewmodel/${n}-nrm.webp`]),
];

export default defineShard({
  api: 1,
  slug: 'nine-dragon-stack',
  name: 'Nine Dragon Stack',                                              // def.ts:42
  blurb: "Lantern Square, halfway up a city stacked 500 m high: wet granite, a cinnabar gate, neon calligraphy and the Yamen Well dropping away into silk fog. A prototype fragment — the square, the Well's rim and the stair-street — rough edges everywhere.",
  label: '(−2, +1)',                                                      // def.ts:43 gridCoords (01 §6)
  biome: 'Vertical neon city',                                            // def.ts:46; the title deck's card line (titleDeck.ts:51)
  order: 4,                                                               // titleDeck.ts:47-52: 4th card
  status: 'experimental',                                                 // def.ts:48; registry.ts:40 PROTOTYPES; E318 (in the deck for everyone)
  card: { thumb, portrait, landscape },
  placement: { grid: [-2, 1], size: [500, 500, 500] },                    // def.ts:43 '(−2, +1)'; def.ts:5 "a 500 m cube, ±250 on every axis"
  minimap: {                                                              // today's ChunkDef.map (ChunkMapDef), renamed (01 §6), def.ts:123-135
    ground: [11, 16, 22],
    pieces: [
      { ids: ['nds-fronts'], look: 'rock' },
      { ids: ['nds-floors', 'nds-paifang@stair-terraces'], look: 'stone' },
      { ids: ['nds-well-balustrade@*'], look: 'rock' },
      { ids: ['nds-paifang@paifang', 'nds-banyan@*', 'nds-earth-god-shrine@*', 'nds-kowloon-stele@*', 'nds-noodle-stall@*', 'nds-hawker-stall@*', 'nds-set-booth', 'nds-set-parasol', 'nds-set-pavilion', 'nds-landing-planter@*'], look: 'timber' },
      { ids: ['nds-crossings', 'nds-paifang@well-c-gates'], look: 'planks' },
    ],
  },
  seed: 0x9d2a,                                                           // def.ts:23 (Rng / Noise2D seeds derive from it)
  style: 'jiehua',                                                        // data only (01 §6)
  kitLook: 'pbr',                                                         // Q1, declared (01 §6) — the look the shared kit pieces use (creatures, Model Explorer catalog, swimming hands); replaces today's `style ?? 'pbr'`, which resolves to 'pbr' for this shard
  uses: ['hover', 'explore', 'practice'],                                 // R1-02: exactly what it runs today (the hoverboard, Explore, the practice dummies). No water (swim), creatures (spawns, elites, bosses), weather, dayCycle, quests, coins, loot, compendium, feats (0 achievements) or pack (0 slots). The grapple is its own Tool (§6.4) and `bounds` is data (below): neither is a mechanism
  ground: { terrain: TERRAIN, structures: true },                         // def.ts:149 `structures` + the flat terrain (01 §6: "Nine Dragon has both"); the terrain is `heightAt()` for placement only: nothing draws or collides with it (R3-02: the engine adds the terrain collider only without `structures`, §2.3)
  assets: {                                                               // def.ts:64-68 carried as data: today's flat ChunkAssets (R3-09), copied to level.assets
    groundLayers: ['forest_ground_04', 'leafy_grass', 'rock_ground', 'stony_dirt_path'],
    groundTints: [[1, 1, 1], [1, 1, 1], [1, 1, 1], [1, 1, 1]], slabRock: 'rock_ground',
  },
  assetGlobs: ['public/assets/nine-dragon/**', 'public/assets/gpu/nine-dragon/**',      // R3-09: the shard's extra asset folders by their real
    'public/assets/music/nine-dragon-stack/**', 'public/assets/sfx/nine-dragon-stack/**', // names (the music / sfx folders appear at S1.5); game data,
    'public/assets/title/nine-dragon-stack-portrait.jpg'],                                // read by check-lock and copied into lock.json (02 F0, §9), never on LevelSpec
  spawn: { x: 0.95, z: 7.5, yaw: -12 * (Math.PI / 180), y: Y0 },          // def.ts:98
  bounds: { x0: WELL.x0 - 8, x1: STAIR.x1 + 20, z0: STREET.z0 + 100, z1: PLAZA.z1 + 8, floor: Y0 - 100 },   // def.ts:148
  camera: { portraitFov: 78 },                                            // 01 §6 — def.ts:102 `fov: { portrait: 78 }` (combat-ai-audit M8: the camera's, not the weapon's)
  sky: {                                                                  // def.ts:77-84, as is
    hdri: 'kloofendal_48d_partly_cloudy_puresky',
    painted: { zenith: [0.09, 0.14, 0.26], horizon: [0.36, 0.44, 0.58], ground: [0.16, 0.18, 0.22], glow: [0.2, 0.2, 0.3] },
    sun: { azimuth: 250, elevation: 8 },
    sunColor: [0.55, 0.62, 0.85], sunIntensity: 0.6, envIntensity: 0.5, bgIntensity: 1.0,
    fogSunColor: [0.6, 0.66, 0.8], cloudSunColor: [0.6, 0.66, 0.8],
    hemiSky: 0x6f86a8, hemiGround: 0x2a2c34, hemiIntensity: 0.5,
  },
  horizon: { rings: [], cloudSea: false },                                // def.ts:114 (carried as data)
  atmosphere: {                                                           // def.ts:85-89
    fogHeight: Y0 - 40, fogHeightFalloff: 0.05, fogHeightDensity: 0.004, fogDistDensity: 0.004,
    volumetricSunColor: [0.55, 0.62, 0.85],
    volumetric: { height: Y0 - 30, falloff: 0.05, density: 0.003, strength: 0.3 },
  },
  grade: {                                                                // def.ts:90-95
    saturation: 0.1, brightness: 0, contrast: 0.1, bloomIntensity: 0.6, bloomThreshold: 0.9,
    shadowTint: [0.92, 0.96, 1.08], highTint: [1.06, 1.0, 0.92], lift: [0, 0, 0.01], gain: [1, 1, 1], gamma: 1,
  },
  render: () => import('./look/render').then((m) => m.shardRender()),   // look/render.ts createRender + the cull in frame (def.ts:139-143)
  tiers: {
    phone: { ao: false, aa: 'fxaa', warmTurns: 0, textures: 'img' },      // Game.ts:290; render.ts:109; Game.ts:502; gpuFiles.ts:66
  },
  budgets: {                                                              // inputs only (01 §13.4); S1.6 fills the derived numbers, its F2-baseline ceilings until then (R1-14)
    phone: { fps: 30, lanes: 'default' },
    desktop: { fps: 60, lanes: 'default' },
    load: { coldPlay4G: null },                                           // no time cap exists for this shard: S1.6 sets it (question Q8)
  },
  fight: { attackers: Infinity },                                         // no fightRules today; no hit cap (maxHitDamage undefined)
  ktx2: () => import('./ktx2.generated'),                                  // R3-08 / R3-F1: top-level, the shard's committed KTX2 table (R2-04)
  loadout: {
    weapons: ['weapon.jian'],                                             // S1.2 (09-combat-ai: the jian's profile, damage 12)
    tools: ['tool.fei-zhua'],                                              // S1.4
    start: ['weapon.jian'],
    pickups: [],
  },
  bag: { tabs: ['map', 'gear'], pack: { slots: 0 } },                     // `tabs` 01 §6; `pack.slots` Q1, declared (01 §6) — E314 pick A (bag.ts:1-10); Inventory.ts:88
  species: [],                                                            // def.ts:75 fauna: []
  encounters: [],
  audio: {                                                                // S1.5 (decision 44 / 71)
    ambience: 'ambience.nd',                                              // zones in §6.5
    score: 'score.nd',
    cues: () => import('./audio/cues').then((m) => m.CUES),
  },
  input: ['grapple'],
  boot: {
    steps: {},                                                            // the shared labels (steps.ts has no Nine Dragon row)
    files: () => FILES,                                                   // both tiers (def.ts:150; manifest.ts:101 filters by the byte table)
    audio: () => import('./audio/files').then((m) => m.BOOT_AUDIO),       // S1.5
    explore: { art: [practiceArt, worldArt, modelsArt, setsArt] },        // honoured from X3 (bug §7.4)
    precache: [],
    barrier: true,                                                        // main.ts:241 (both tiers)
    cullBeforeFirstDraw: true,                                            // Game.ts:506
    phone: { deferExtras: true, fragile: true, trace: true },             // main.ts:247, :258; Loading.ts:45
  },
  roster: () => import('./roster').then((m) => m.ROSTER),                 // def.ts:119
  explore: {
    art: { practice: practiceArt, world: worldArt, models: modelsArt, sets: setsArt },   // Explore.ts:66-75
    compare: [                                                            // Compare.ts:33-36
      { id: 'gate', label: 'Lantern gate', model: 'nine-gate', target: 'art/nine-dragon-stack/round-15-eight-domes/A2-gate-look/target-5.jpg' },
      { id: 'stair', label: 'Stair street', model: 'nine-stair', target: 'art/nine-dragon-stack/round-15-eight-domes/C1-stair-stand/target-5.jpg' },
    ],
  },
  dev: { poses: () => import('./mockupCameras').then((m) => m.MOCKUP_CAMERAS) },   // Q1, declared (01 §6) — the harness's and the budget check's four poses
  load: () => import('./plugin'),
});
```

Fields that disappear: `id` (derived: `chunk://local/${slug}`, still used as the Progress / Inventory / Owned key until
F10's SaveStore scopes keys by slug), `displayName` (→ `name`), `gridCoords` (→ `label`, `placement.grid`), `treeCount: 0`, `trees`
(`factory: 'none'`: no Forest), `forest` (`density: () => 0`: no Forest), `assets` (never downloaded, `def.ts:63`),
`fauna: []` (→ `species: []`), `weapon: 'sword'` (→ `loadout`), `sword` / `traversal` / `structures` (→ the plugin),
`experimental` (→ `status`), `thumbnail` / `heroPortrait` / `heroLandscape` (→ `card`).

## 4. (d) The plugin

`src/shards/nine-dragon-stack/plugin.ts`:

```ts
import { ShardPlugin, type ShardContext } from '#game';
import { NdRuntime, ndRuntime } from './runtime';   // the one object holding what index.ts's module lets held
import { installWorld } from './world/install';
import { FEI_ZHUA_ROW } from './grapple/FeiZhua';
import { JIAN_ROW } from './vm/jianRow';
import { STRINGS } from './strings';
import { GRAPPLE_CONTEXT } from './grapple/context';
import { installAmbience } from './audio/ambience';

export default class NineDragonPlugin extends ShardPlugin {   // staged hooks, each awaited in its boot stage (R1-24); every ctx verb is bound to ctx.scope (R1-25)
  async world(ctx: ShardContext): Promise<void> {           // level.world
    ctx.strings(STRINGS);                                   // 'weapon.jian': 'Neon Jian', 'tool.fei-zhua': 'Fei Zhua', 'respawn.default', toasts
    const rt = new NdRuntime(ctx.scope);                    // disposed with the scope; render.ts / FeiZhua / play() read it through ndRuntime()
    await installWorld(ctx, rt);                            // world/build.ts + the 4 fabric pieces + the per-frame system
  }
  kit(ctx: ShardContext): void {                            // level.kit: after the engine's equipment service exists
    ctx.rows.weapon(JIAN_ROW);                              // S1.2: Melee family profile + the skinned-arms viewmodel; its `meta` feeds the Bag (R1-26)
    ctx.rows.tool(FEI_ZHUA_ROW);                            // S1.4: class FeiZhua extends Tool
  }
  play(ctx: ShardContext): void {                           // level.play: after the engine's loadout and play wiring
    const rt = ndRuntime();                                 // made in world(); throws if world() has not run
    ctx.inputContext(GRAPPLE_CONTEXT);                      // S1.4
    ctx.playground({ id: 'grapple', title: 'Grapple playground', blurb: 'Fei Zhua parkour · dev course · timer',
      icon: CLAW_SVG, load: () => import('./playground/GrapplePlayground') });   // S1.4, from playgrounds/catalog.ts:29
    installAmbience(ctx, rt);                               // S1.5: the zone profile (square / market / stair / well)
    ctx.on('explore.turntable', (e) => { rt.specimenLight(e.on); });            // look/specimenLight.ts:50
  }
}
```

| Kind | Id / name | Phase, order | Source today | Notes |
|---|---|---|---|---|
| System | `shard.nd.world` | `update`; `after: ['engine.player.update']` | `index.ts:55` `ctx.onUpdate((_dt, t) => world.update(t, ctx.camera))`, registered as `'structures'` (`main.ts:478`) | The look's uniforms, the movers |
| System | `engine.world.bounds` (engine, on because `level.bounds`) | `update`; `after: ['engine.player.update']`; `when: inState('play')` | `main.ts:595-611` (`'bounds'`) | Not a shard system: generic engine code reading level data (`level.bounds`, R2-02) |
| Render hook | `LookStrategy.frame` | `render` (01 §1: first in `render`) | `def.ts:142` | Calls `rt.cull(camera)` then the look's `frame` |
| System | `shard.nd.feizhua.input` | `input`; `before: ['engine.lockon.input', 'engine.player.input']` | `Traversal.ts:364-401` | S1.4 |
| System | `shard.nd.feizhua.fixed` | `fixed.post`; `after: ['engine.player.step']` | `Traversal.ts:469` | S1.4 |
| System | `shard.nd.feizhua.update` | `update`; `after: ['engine.player.update']` | `Traversal.ts:528` (`'fei-zhua'`) | S1.4 |
| System | `shard.nd.ambience` | `update`; `tick: 'fx'` | new (S1.5) | Zone weights from the player position |
| Ask answered | `player.traversal` | — | `Traversal.ts:406` `player.traversalStep` | S1.4: the Tool owns the motor while a zip runs |
| Events listened | `practice.active`, `explore.studio`, `explore.turntable` | — | `ws:practice-active` (`Traversal.ts:363`, `render.ts:73`), `ws:studio-active` (`render.ts:94`), `ws:turntable` (`specimenLight.ts:50`) | The emitters (TrainingArena, the playgrounds, ModelExplorer) emit on the bus |
| Pieces | `nds-floors`, `nds-fronts`, `nds-grapple-guard`, `nds-crossings` | `level.world` | `index.ts:36-53` | Same ids, names, categories, `file`, surfaces, colliders, `floor`, `solidFloor`, `follows`, `active` |
| Pieces (models) | every `nds-*` model piece | `level.world` | `world/build.ts` through `src/models/place.ts` | Unchanged: `place` registers through `app.registry`, owned by `ctx.scope` |
| Input context | `grapple` | pushed by the Fei Zhua | `Traversal.ts:346` `touchHint` | S1.4 |
| HUD | the dragon-hook chip, 8 ◇ marks | `ctx.hud.pin` (01 §11) | `Traversal.ts:260-274` | S1.4 |
| Bag | the Fei Zhua gear card | built by `#game`'s Bag from the Tool's `meta` (R1-26) | `main.ts:625` | S1.4 |
| Debug rows | none | — | `debugOptions.ts` has no Nine Dragon row | — |
| Debug handle | `nd.render` | — | `render.ts:180` `window.__ndRender` | `ctx.debug.expose` (01 §7) |
| Playground | `grapple` | — | `playgrounds/catalog.ts:29` | S1.4 |
| Strings | `strings.ts` | — | `bag.ts:14`, the Fei Zhua toasts (`Traversal.ts:375, 381, 416`), `HurtArc.ts:91` | English only (decision 78) |

## 5. (e) Engine systems this phase pulls in

| System | What S1 needs of it (and no more) | Must exist first | Built in |
|---|---|---|---|
| Plugin verbs (01 §7) | `system`, `on`, `answer`, `rows.weapon`, `rows.tool`, `inputContext`, `hud.widget` / `hud.relabel` / `hud.pin`, `debug.expose`, the Bag's entries from `Equipment.meta` (R1-26), `piece`, `playground`, `strings`, `progress`; every verb bound to the context's scope (R1-25) | F8 (App, scope, events), F9 (registry, `ShardContext` type) | S1.1 wires `system`, `on`, `piece`, `strings`, `progress`; S1.4 `inputContext`, `hud`, `playground`, `rows.tool`; S1.2 `rows.weapon` |
| Boot stages (01 §8) | `level.data` reads `boot.*`; `level.world` awaits `plugin.world(ctx)`, `level.kit` `plugin.kit(ctx)`, `level.play` `plugin.play(ctx)`, with the engine's work in between (R1-24); `boot.barrier`, `boot.phone.deferExtras`, `boot.phone.fragile`, `boot.phone.trace`, `boot.cullBeforeFirstDraw`, `boot.files` for this shard; the others keep the old path until their phase | F8 (states), F9 | S1.1 |
| `bootTrace` / `gpuTrace` (generic) | §1.2 | F10 (SaveStore global key) | S1.1 |
| Render service tier resolution | one source (01 §13.3): engine default → kit schema default → `level.tiers[tier]`, for `ao`, `aa`, `slices`, `warmTurns`, `textures`; `LookStrategy` carries no tier knobs (its old `ao` / `aa` / `slices` move to `level.tiers`) | F8 services | S1.1 (the rest of tiers-as-data is X7) |
| Debug expose | `ctx.debug.expose(name, value)` → `window.__wildshard.shard[name]` (01 §7, owned by the shard scope) | F8 | S1.1 |
| Equipment / Weapon / Tool contracts + blocks; the Melee family in `#kit/weapons/melee` | 09-combat-ai; for this shard: the jian row, the Tool row | F5 (fake Game for the contract tests) | S1.2, S1.4 |
| Damage pipeline, effects core, player health attribute | 09-combat-ai; for this shard: falls (`env.fall`, 8), the practice dummies | S1.2 | S1.3 |
| `#engine/input`: action map, one listener set, context stack, touch relabel | the `lock`, `jump` actions, `consume`, the `grapple` context; the rest of the actions exist but X1 moves the other listeners | F8 | S1.4 |
| `#engine/practice/playground` registry | `ctx.playground`; the Explore hub lists registered playgrounds | F8 | S1.4 |
| `#engine/audio` first slice | `ScoreSource` + `SetScore` (from `SteppeScore`), per-shard ambience beds with zone weights, the cue map, per-shard SFX set | F8 | S1.5 (S3.5 finishes the audio engine) |
| Budgets + calibration | `src/engine/render/budgets.ts` (the formula), `budgets/calibration.json`, the calibration scene | F2, F3 | S1.6 |

## 6. The rows, step by step

### 6.1 S1.1 — the manifest and the plugin

1. **Manifest.** Replace `shard:manifest.ts` with §3. Add `test/shards/nine-dragon-stack/manifest.test.ts`: it imports
   the manifest in node (no DOM), checks every `boot.files()` path is in `PUBLIC_BYTES`, and checks the values of §3
   against a frozen copy of today's `def.ts` values (spawn, bounds, sky, atmosphere, grade, map draw).
2. **Runtime object.** Create `shard:runtime.ts` (`NdRuntime`: `world`, `camera`, `guardOpen`, `cull(camera)`,
   `specimenLight(on)`), created in the plugin's `world()` hook (R1-24), released by `ctx.scope.onDispose`.
   `ndRuntime()` throws before `world()` has run.
   `index.ts`'s three exported functions become methods on it; `look/render.ts:9`, `Traversal.ts:19`,
   `look/specimenLight.ts` import `ndRuntime` instead.
3. **World build.** `index.ts` → `world/install.ts`. `buildNineDragonWorld(ctx.app.render.renderer, ctx.progress)`;
   the four `ctx.registry.add({...})` → `ctx.piece({...})` with identical fields; `ctx.onUpdate` → `ctx.system({ id:
   'shard.nd.world', phase: 'update', after: ['engine.player.update'], run: (_dt, t) => rt.world.update(t,
   ctx.app.scene.camera) })`. `installSpecimenLight(() => rt.world?.shared ?? null)` stays.
4. **Render.** `look/render.ts`: export `shardRender()` = today's `createRender()` wrapped with the cull (`def.ts:139-143`
   moves here). Remove the `TIER` import: `aa` comes from `tiers.phone.aa`. Replace the two `document.addEventListener`
   calls with `app.events.on('practice.active' | 'explore.studio', fn, scope)` (the scope passed to `compose`), and
   `Reflect.set(window, '__ndRender')` with `ctx.debug.expose('nd.render', handle)`. `dispose()` drops what the
   scope now owns.
5. **Tier reads.** Pass `tier` into `glyphs.ts`, `paint.ts`, `signs.ts`, `vm/materials.ts` (module constants become
   functions of the tier, same values).
6. **Engine edits**, all four shards' parity green after each:
   - `Game.ts:290` → the tier resolution of §2.2; `level.tiers.phone.ao: false`.
   - `Game.ts:210-218, 469-487, 497-506, 532, 657` → `bootTrace.active`, `warmTurns`, `cullBeforeFirstDraw`.
   - `boot/nineBootTrace.ts` → `engine/boot/bootTrace.ts`, `nineGpuTrace.ts` → `gpuTrace.ts`, and every caller in §2.
   - `main.ts:241-250, 258-275, 1234-1264, 1334` → the boot flags of §3.
   - `main.ts:284-285, 418, 431, 444, 475-480` → `level.ground.structures` / the plugin world build.
   - `main.ts:595-611` → the engine system `engine.world.bounds`.
   - `bootstrap.ts:76, 101`, `boot/manifest.ts:84-86, 101`, `boot/gpuFiles.ts:66`, `ui/Loading.ts:45`,
     `boot/entry.ts:36`, `boot/lastEnd.ts`, `core/GpuRecovery.ts:44`, `boot/precompile.ts:30`, `ui/ErrorModal.ts`,
     `ui/StartTitle.ts`, `explore/Explore.ts`, `explore/Compare.ts`, `game/Inventory.ts:88`, `ui/HurtArc.ts:91`.
   - `main.ts:217` → `manifest.name`, read by the composition root and handed to the resume screen (R2-02).
7. **(Nothing to delete here.)** `world/hero/paifang.ts` went at F7 with the other dead files (02 F7 step 3;
   13-lead-resolutions still-open 05#7); S1.1 only confirms `test -e src/shards/nine-dragon-stack/world/hero` fails.
7b. **A full shard** (13-lead-resolutions 02/03#5; this moved out of X3). Nine Dragon joins everything the other three
   shards get: `playable()` in `src/game/shard/registry.ts` becomes `status !== 'hidden'` (so `experimental` counts),
   which puts Nine Dragon into `bake-packs.mjs` (its phone and desktop packs from `boot.files`), `shardPrefetch.ts`,
   `bake-ktx2.mjs`, `unused-assets.mjs` and every test that loops over the playable shards (`models-rosters`,
   `manifests-node-safe`, the parity shard list). Its boot now reads its pack instead of per-file fetches: a
   parity-visible change, recorded in `test/parity/renames/S1.1.json` (the boot's fetch list) and shown on the M1
   summary. `boot.barrier: true` keeps its meaning with the pack: the extras pack finishes before the first frame, on
   every tier (R1-38).
8. **Tests.** `test/engine/boot-trace.test.ts` (on / off by manifest flag), `test/shards/nine-dragon-stack/plugin.test.ts`
   (runs the plugin's `world` → `kit` → `play` hooks in stage order on the fake Game with a stub world build: 4 pieces
   added with today's ids; `shard.nd.world` in `update` after `engine.player.update`; a throw in each hook disposes the
   scope (R1-24); scope dispose removes all four pieces, the system and the three listeners),
   `test/engine/render-tiers.test.ts` (precedence, 01 §13.3: engine default → kit schema default → `level.tiers[tier]`;
   the Nine Dragon phone resolves `ao: false`, desktop `ao: true`), `test/engine/terrain-collider.test.ts` (R3-02: a
   `LevelSpec` with both `ground.terrain` and `ground.structures` gets no WORLD heightfield collider and Nine Dragon's
   built floors keep today's collider census; terrain alone gets the heightfield, as Pine Hollow, Nalati and Driftwood).

**Done when:** `grep -rn "nine-dragon-stack\|isNine\|phoneNine\|NineBoot\|nineBoot" src --include=*.ts` outside
`src/shards/nine-dragon-stack/` returns only the generated registry; `wildshard/no-shard-branch` count for the files
in §2 went down by the lines listed there; parity green on 4 shards × 2 tiers.

### 6.2 S1.2 — the Equipment base, the Weapon contract and the Melee family (the shard side)

The engine and kit side is 09-combat-ai. For this shard:
1. `shard:vm/jianRow.ts` exports `JIAN_ROW`: `{ id: 'weapon.jian', parent: 'weapon.sword', family: 'melee', name:
   'weapon.jian', damage: 12, viewmodel: () => loadJianViewmodel(), meta: { name: 'weapon.jian', … } }`
   (decision 19: 12, now a real field; `meta` is the `EquipmentMeta` `#game`'s Bag reads, R1-26).
   `loadJianViewmodel` is `def.ts:105-112` as is: `jianArms()`, and on a throw the static `jianSword()` with the same
   `console.warn`. Moves and framing come from `jianArms()` (`vm/arms.ts:39`) as today.
2. The weapon's portrait FOV no longer passes through `Sword` options: the camera reads `level.camera.portraitFov`
   (78) whatever is held. Identical here (Nine Dragon holds only the jian).
3. The jian's sounds are cues (`cue.weapon.swing`, `cue.weapon.swing.heavy`, `cue.hit.<surface>`,
   `cue.weapon.clang.<material>`), mapped by Nine Dragon's cue map (S1.5). Until S1.5 lands, the cue map maps them to
   today's synth calls (`audio.swordSwing`, `swordHeavy`, `swordHit`), so S1.2 is identical.
4. **Inline fixes owned by S1.2 that are not this shard's** (plan §7.1; 09-combat-ai): the Spear thrust, brace and
   couched lance, and Naizagai's crescent, get the occlusion check. They are Nalati's weapons; the fixes land in the
   Melee family during S1.2 and go on the weapons board at M1.

**Test:** `test/shards/nine-dragon-stack/jian.test.ts`: the jian row resolves against the Melee family (damage 12, its
parent's move table, `lockOn: true`), and its viewmodel factory falls back to the static jian when `jianArms` throws.
**Done when:** a swing to a kill on the practice dummy in the harness is identical (hit frames, damage 12 per hit,
the kill frame).

### 6.3 S1.3 — the damage pipeline, cues, effects core (the shard side)

1. Nine Dragon has no creatures (`species: []`). Its damage sources are: the player's jian on the practice dummies
   and the playground's none; falls (`main.ts:945`, 8 on a hard landing); and nothing else.
2. The fall goes through `combat.hit({ source: 'env', sourceTags: ['env.fall'], amount: 8, … })` with no `cause` (01 §18's
   `DamageRequest`, 09 §3.3's fall row). `env.*` is exempt from the hit cap and the dodge guard (decision 20); Nine
   Dragon has neither anyway.
3. The hurt arc, trauma shake, damage flash and death card move to the pipeline's subscribers (09-combat-ai). The
   death card's respawn text is `strings['respawn.default']` (bug §7 B4).
4. `fight.attackers: Infinity` (no director tokens).

**Done when:** the harness's scripted hard landing costs exactly 8 and regenerates as today (4/s after 6 s).

### 6.4 S1.4 — the Tool contract: the Fei Zhua, the `grapple` context, the playground

1. **`class FeiZhua extends Tool`** in `shard:grapple/FeiZhua.ts`, `slot: 'offhand'`, `actions: ['lock', 'jump']`,
   built from `Traversal.ts` with every constant unchanged (`MIN_RANGE 2.5`, `MAX_RANGE 38`, `ZIP_SPEED 22`,
   `FIRE_TIME 0.27`, `BITE_TIME 0.10`, `REEL_TIME 0.48`, `WIN_X 0.52`, `WIN_Y 0.68`, `SCAN_PER_FRAME 2`,
   `LANDING_STALE 1.2`, `MARKS 8`, `BODY 1.95`, `RIM_WALL Y0 + 3.2`). Its `meta` (R1-26) carries `bag.ts:17`'s
   entry (`{ id: 'fei-zhua', name: 'Fei Zhua', kind: 'Grapple', how: 'Lock a hook, then jump', icon: 'grapple' }`) as
   `{ name: 'tool.fei-zhua', icon: 'grapple', blurb: 'Lock a hook, then jump', category: 'Grapple' }`; `#game`'s Bag
   builds the same GEAR card (id `fei-zhua`) from it.
   `enabled()` (`main.ts:563`: `hud.entered && !world.freeCamera && !world.tour.active`) becomes
   `when: inState('play', 'practice', 'playground')` plus `!app.world.freeCamera` (the tour is a capture state).
2. **Input.** The hand-chained hooks become:
   - `lock.onTryToggle` (:364-383) and `player.onJumpRequest` (:385-401): the system `shard.nd.feizhua.input` runs
     `before: ['engine.lockon.input', 'engine.player.input']`. When today's code would return `true` it calls
     `input.consume('lock')` / `input.consume('jump')` and does what the hook did; when it would fall through to
     `prior…()`, it consumes nothing and the lock-on / the jump see the press. The `inPractice && course === fragment`
     test (:366) reads the `practice.active` event's last value.
   - `player.traversalStep` (:406-467): `ctx.answer('player.traversal', (dt) => boolean)`; the player motor asks it
     each fixed step before its own move, as `traversalStep` did.
3. **The `grapple` context** (`shard:grapple/context.ts`): `{ id: 'grapple', actions: ['lock', 'jump'], blocks: [],
   touch: { relabel: { lock, jump } } }`. The Tool pushes it on the first frame the hint is not `HINT_REST` and pops
   it when it returns to rest. The relabels are today's `HINT_READY`, `HINT_LOCKED`, `HINT_ARMED` on LOCK and
   `HINT_ZIP`, `HINT_FIRE` on JUMP (`Traversal.ts:40-46`: label, icon, tone, accent `#ffcf70`), applied with
   `ctx.hud.relabel(spot, …)` when the hint changes (today's `hint()`, :343-347). `ChunkDef.touchHint` and
   `TouchControls.hint()` are deleted.
4. **HUD.** The chip (`ws-dragon-hook`) and the 8 marks (`ws-dragon-mark`) are created as today and mounted with
   `ctx.hud.pin(at, el)` (01 §11; 13-lead-resolutions 05/06#3), where `at` returns the hook's or the mark's world
   position, or `null` while hidden. The engine projects every pin each frame, which replaces today's per-frame
   screen-pixel writes; the marks are pinned first and the chip last, so the chip stacks above them (today's z-index
   25 over 24).
5. **The playground.** Move `GrapplePlayground.ts` and `grappleCourse.ts` (§1.2); register with `ctx.playground`
   (§4). `setGrappleCourse` is called on the Tool instance. `playgrounds/catalog.ts` loses the `grapple` row;
   `load.ts` loads registered playgrounds by id. `PlaygroundHost` stays as is (its Nalati `ride` field goes at S3).
6. **Tests.** `test/shards/nine-dragon-stack/feizhua.test.ts` on the fake Game: a hook in reach → the context is
   pushed and LOCK is relabelled `Grapple`; LOCK consumed → `Locked` / JUMP `Zip`; JUMP consumed → the zip moves the
   capsule at 22 m/s and the motor's own move is skipped (the ask answered `true`); no hook → LOCK reaches the lock-on
   system. `test/engine/input-context.test.ts` covers push / pop / consume ordering.

**Done when:** the harness's grapple run (the playground course: START → the three chained hooks → FINISH) and the
fragment's two scripted zips (the Well crossing, the stair terrace) land on the same pads at the same frames; the
touch discs read the same labels at the same frames; `grep -rn "onTryToggle\|onJumpRequest\|traversalStep\|touchHint"
src` finds only the engine's own definitions.

### 6.5 S1.5 — Nine Dragon's own audio (decisions 44, 71)

Jake's brief (decision 71): **a neon night market** — rain on tiled roofs, lantern hum, crowd and hawkers, wind chimes
in the Well; the score **guzheng + erhu over a soft analog synth pad, rising in fights**. Every model runs locally
under the machine-wide lock (AGENTS.md *Local models*). Credits: "Music: MiniMax-Music3" and "Powered by Stability AI"
stay on the credits screen (licence conditions).

**A. The engine slice** (in `src/engine/audio/`, before any file is generated):
1. `ScoreSource` interface: `{ slots: readonly string[]; target(state: MusicState): string | undefined; want(playing:
   string | undefined): SlotAudio | undefined; pending: boolean; useBank(bank): void; stings: Map<StemSting,
   AudioBuffer> }` — the shape `SteppeScore` already has (`SteppeScore.ts:90-150`).
2. `SetScore implements ScoreSource`: `SteppeScore` generalised by `{ dir, manifestKey, pick(scene) }`. Nalati's
   `SteppeScore` becomes `new SetScore({ dir: '/assets/music/nalati/', manifestKey: 'nalati', pick: steppePick })`
   with identical choices (Nalati parity identical).
3. `Music.ts`: `wantSlot()` asks the running shard's `ScoreSource` when one is set (`:690-696`); `state.shard` stays
   for Pine Hollow and Driftwood until S2.1 / S4.3.
4. Ambience: `AmbienceBeds` = N looping beds with per-zone weights and a crossfade time, driven by a zone function
   `(pos) => Record<zone, 0..1>`. It plays through `audio.bus('ambience')`. (Island / Steppe / Forest merge into it
   at S3.5.)
5. A per-shard SFX set: `public/assets/sfx/nine-dragon-stack/sfx.json`, read by the shard's cue map (Pine Hollow's
   `pine-hollow` set is the precedent: `sfx_merge.py --jobs … into: '<set>'`).

**B. What to generate** (`scripts/music/gen/nd-score-jobs.json`, `scripts/music/gen/sfx-nd-jobs.json`, same format
as `ph-jobs.json` / `sfx-ph-jobs.json`):

| Kind | Slot / family | Duration | Prompt core (the jobs file carries the full prompt) | Ships as |
|---|---|---|---|---|
| Score | `nd-market` (the square, the market, the stair-street) | 75 s loop | night market, guzheng lead + erhu counter-line over a soft analog synth pad, a slow pulse from bar 2 (so demucs lifts a tension layer) | calm + tension stems |
| Score | `nd-well` (the rim, the galleries, the crossings) | 75 s loop | sparser: erhu alone over the pad, a low drone, wind-chime colour | calm + tension |
| Score | `nd-fight` (any shard state `combat`) | 60 s loop | the market theme rising: taiko-like drums, driving pad, guzheng tremolo | calm + tension (the tension layer is the rise) |
| Score stings | `pickup`, `death`, `chunk` | cut | cut from `nd-market` as Nalati's are (last chord, biggest swell, brightest onset) | stings |
| Bed | `bed.nd.market` | 30 s loop | a night market crowd, distant hawkers calling in Cantonese-like cadence (no words intelligible), sizzling woks, rain on tiled roofs | loop |
| Bed | `bed.nd.well` | 30 s loop | wind through a deep stone shaft, wind chimes, far-off crowd murmur from above, light rain | loop |
| Loop | `hum.lantern` | 10 s loop | the electric hum of neon tubes and paper lanterns up close | positional loop at lantern clusters |
| One-shots | `step.stone`, `step.wood`, `step.metal` (4 takes each) | 0.4 s | footsteps on wet granite / planks / a steel grating | footsteps by registry surface |
| One-shots | `jian.swing`, `jian.swing.heavy`, `jian.hit.stone`, `jian.hit.wood`, `jian.clang` | 0.6–1.2 s | a light steel jian cutting air; a heavy overhead; blade on stone / wood; a ringing clang | the jian's cues |
| One-shots | `feizhua.fire`, `feizhua.bite`, `feizhua.reel`, `feizhua.dock`, `feizhua.zip` | 0.3–1.5 s | a brass grapple claw fired on a cord; biting brass; a cord reeling; a claw docking in a gauntlet; a rushing zip | the Fei Zhua's cues |
| One-shots | `chime.gust` | 2 s | a gust through a string of wind chimes | random every 8–20 s in the well zone |

Every SFX family is rendered by **both** MOSS-SoundEffect v2 and Stable Audio 3 Medium (3 seeds each), ranked by
CLAP, and the better take ships (AGENTS.md *Audio engines*).

**C. The commands** (the lead runs each with `run_in_background`; each batch stays under 30 minutes; `REPO` is the
repo root, `SP` the session scratchpad spelled out literally — the `dcg` hook blocks redirects to computed paths;
`run-locked.sh` takes the model lock and waits for anonymous memory under 70 GB):

```bash
# 1. score takes (MiniMax Music 3, MPS bf16) — 3 slots × 4 seeds ≈ 25 min
~/projects/localai/bin/img2mesh/run-locked.sh $SP/nd-score.log \
  ~/ml/music/minimax-music3/.venv/bin/python scripts/music/gen/gen_minimax.py \
  --jobs nd-score-jobs.json --keys nd/nd-market,nd/nd-well,nd/nd-fight --seeds 401,402,403,404 --out $SP/nd-score-raw
# 2. SFX, take 1 (MOSS v2)
cd ~/ml/music/sfx/MOSS-TTS/moss_soundeffect_v2 && ~/projects/localai/bin/img2mesh/run-locked.sh $SP/nd-moss.log \
  env TORCHDYNAMO_DISABLE=1 PYTORCH_MPS_HIGH_WATERMARK_RATIO=0.5 PYTORCH_MPS_LOW_WATERMARK_RATIO=0.4 .venv/bin/python \
  $REPO/scripts/music/gen/gen_sfx_moss.py --jobs sfx-nd-jobs.json --seeds 1,2,3 --out $SP/nd-sfx-raw
# 3. SFX, take 2 (Stable Audio 3 Medium)
cd ~/ml/music/sfx/stable-audio-3 && ~/projects/localai/bin/img2mesh/run-locked.sh $SP/nd-sa3.log \
  env HF_HUB_OFFLINE=1 uv run python $REPO/scripts/music/gen/gen_sfx.py --model medium --jobs sfx-nd-jobs.json --seeds 1,2,3 --out $SP/nd-sfx-raw
# 4. rank the SFX (CLAP, a model load: under the lock, R1-22) into a stage, then ship the better take per family into the shard's own set
~/projects/localai/bin/img2mesh/run-locked.sh $SP/nd-sfx-rank.log \
  ~/ml/music/analysis/.venv/bin/python scripts/music/gen/sfx_build.py $SP/nd-sfx-raw --jobs sfx-nd-jobs.json --stage $SP/nd-stage --tag nd
~/ml/music/analysis/.venv/bin/python scripts/music/gen/sfx_merge.py --jobs sfx-nd-jobs.json --stage $SP/nd-stage --raw $SP/nd-sfx-raw --tag nd
# 5. rank + build the score (stems, loops, -18 LUFS, AAC) into public/assets/music/nine-dragon-stack/
#    analyze (CLAP + htdemucs) and build (htdemucs) load models: under the lock (R1-22); rank and sfx_merge load none
~/projects/localai/bin/img2mesh/run-locked.sh $SP/nd-score-analyze.log \
  ~/ml/music/analysis/.venv/bin/python scripts/music/gen/own_score.py analyze $SP/nd-score-raw --set nine-dragon-stack
~/ml/music/analysis/.venv/bin/python scripts/music/gen/own_score.py rank $SP/nd-score-raw --set nine-dragon-stack
~/projects/localai/bin/img2mesh/run-locked.sh $SP/nd-score-build.log \
  ~/ml/music/analysis/.venv/bin/python scripts/music/gen/own_score.py build $SP/nd-score-raw --set nine-dragon-stack
```

Script edits this needs (S1.5, before step 1; each checked by re-running Pine Hollow's and Nalati's existing
decisions with `--dry` and diffing the JSON they would write, which must be unchanged):
- `gen_minimax.py` (`--jobs`, `--keys`, `--seeds`: `:53-60`), `gen_sfx_moss.py` and `gen_sfx.py` (`--jobs`,
  `--seeds`: `:44-49`, `:33-39`) need no edit.
- `sfx_build.py --jobs --stage` writes its rankings to `sfx-ph-<model>.json` whatever the jobs file: it gains
  `--tag <name>` (default `ph`), and Nine Dragon runs with `--tag nd` (→ `sfx-nd-moss.json`, `sfx-nd-sa3-medium.json`).
- `sfx_merge.py`: `merge_ph` (the `into: 'pine-hollow'` default at `:167`, the `round: "pine-hollow"` row) becomes
  `merge_set(set)`, `into` accepts `nine-dragon-stack`, and it reads the rankings by `--tag`. `sfx_sprite.py` gains
  `--set <dir>` (default `pine-hollow`), so the one-shots of `public/assets/sfx/nine-dragon-stack/` pack into one
  sprite as Pine Hollow's do.
- `nalati_score.py` becomes `own_score.py` with `--set <name>` choosing the jobs file, the CLAP instrument probes
(for Nine Dragon: "a plucked Chinese zither (guzheng)", "a bowed two-string Chinese fiddle (erhu)", "a soft analog
synth pad" against the same six foils), the output folder `public/assets/music/<set>/` and the page folder
`art/music/round-<n>-<set>/`. Nalati's run through the renamed script must write byte-identical `nalati-score.json`
(a test in `test/audio-scripts.test.ts` runs `own_score.py rank --dry` on a fixture).

**D. The engine wiring** (S1.5, after the files exist):
- `shard:audio/cues.ts`: the cue map (jian, Fei Zhua, footsteps by surface, hurt, pickup) → files of
  `public/assets/sfx/nine-dragon-stack/sfx.json`; a family that shipped no take (CLAP rank worse than 5) maps to
  today's synth call, as `synth_keeps` does.
- `shard:audio/ambience.ts`: zone weights from the layout: `market` inside `PLAZA`, `STREET` and `STAIR` (layout.ts),
  `well` inside `WELL` (x −28 … 0, z −44 … 16), a 6 m crossfade band between them; `hum.lantern` loops placed at
  the lantern clusters `look/lanterns.ts` already knows (at most 4 audible, nearest first).
- `shard:audio/files.ts` (`BOOT_AUDIO`): the selected style's `title` slot, `nd-market` + the stings (decoded at the
  bar), `nd-well` and `nd-fight` (downloaded, decoded on first want), the two beds, the SFX sprite. The phone's
  `deferExtras` path (main.ts:1243-1283) decodes the same list after the loader's peak.
- The score's scene: `nd-fight` while `music.state.mode === 'combat'`, else `nd-well` when the well zone weighs more
  than 0.5, else `nd-market`. The tension stem follows the mode as for every score.

**E. The listening page** (the audio board, 12-process §6): `scripts/music/gen/nd_page.py` (from `ph_page.py`)
writes `art/music/round-<n>-nine-dragon-stack/`: each slot as shipped (calm, then calm + tension), the runner-up take
per slot, each SFX family's best take per model side by side, the two beds 15 s each. **MP3, not m4a** (memory: the
Artifact refuses m4a), published as an Artifact from a folder in the session scratchpad, sent to Jake with
AskUserQuestion: "keep / re-roll <slot or family>".

**Done when:** the files ship; Nine Dragon's harness boot lists `audio beds: ['bed.nd.market', 'bed.nd.well']` and
the score source `score.nd` (the fingerprint diff is the expected one, §8); no `'pine'` slot, `forest` bed or
`litter` step plays on this shard; Jake has the page.

### 6.6 S1.6 — the budget calibration scene, and Nine Dragon's budgets

1. **The scene** (`src/engine/calibrate/`), as [budget-design](../../design/engine-fit-v2/budget-design.md) §4: no
   shard, synthetic content, eight sweeps (draws, state, triangles, fill by class, passes, overlap, JS, link), cold
   pass then pre-heat then hot, interleaved baselines, Low Power Mode detected and flagged. It runs uncapped
   (`frameProbe.uncapped`) at the phone's 2× and posts its JSON to the review inbox itself.
2. **The entry:** a Debug ▸ Developer tools button row `RUN CALIBRATION` (`action()` row in `debugOptions.ts`, no URL
   switch; `debugSettings(page, { calibrate: 'run' })` for scripts). It navigates to the title-less calibration state
   (`app.setState('capture')` with the calibration scene as the only system set).
3. **The Mac side:** `scripts/calibrate.mjs` runs the same scene headless through `scripts/browser-lane.sh`, Metal,
   `--mute-audio`, frozen-frame timing as `pine-hollow-gpu.mjs`. It writes `budgets/calibration/m5-<date>.json` **and** the current file `budgets/calibration.json` (R4-01): the
   phone's unit costs = the M5 run's × 10 (E283's hot phone : M5 ratio, decision 99), with the ratio, its source (E283)
   and the word "assumption" in the file.
4. **The formula:** `src/engine/render/budgets.ts`, pure, vitest-tested (a fixture calibration gives known numbers),
   reads `budgets/calibration.json`, the committed current file. **Decision 99: there is no phone run.** The phone's unit
   costs are the M5 run's × the measured phone : M5 ratio (E283: ~10× hot, ~6× cool; the hot ratio is used), stated as an
   assumption in the file and in budget-design.
5. **Nine Dragon's numbers:** the gate derives its per-pose draws, triangles, programs, GPU MB and per-system ms from
   the formula at its four `dev.poses`. It is over the provisional draw number today (worst pose 160 draws / 1.67 M,
   budget-design §6.4), so its ceiling is its current worst, written to `lint/ratchet.json` as
   `budgets.nine-dragon-stack.phone.draws: 160` (may only go down), with the derived number printed as its target.
6. `scripts/nine-dragon-budget.mjs` is deleted once the gate's budget check reads the same four poses.
7. **No Jake step** (decision 99): the calibration runs only on the M5, headless. The Debug button stays (a later
   ask may run it on a phone); the plan never asks Jake to.

**Done when:** the scene runs to its JSON on the M5 headless and in the harness; the formula test is green; the gate
prints Nine Dragon's derived numbers and enforces its ceilings. Pine Hollow, Nalati and Driftwood have no derived
budgets yet and are not red for it: their checks use their F2-baseline ceilings until S2.6, S3.5 and S4.4 derive
theirs (R1-14).

## 7. (f) Bugs fixed inline in this phase (each with a test)

| # | Bug | Where | Fix, row | Test |
|---|---|---|---|---|
| B1 | Nine Dragon plays Pine Hollow's theme, hears the pine-forest bed, and its phone boot decodes Pine Hollow's slot | `main.ts:587`, `Audio.ts:146`, `Music.ts:500`, `extras.ts:166-167, 227-228` | its own score, beds and boot audio (S1.5) | `test/shards/nine-dragon-stack/audio.test.ts`: the manifest's boot audio has no `pine` slot, no `forest` bed |
| B2 | Its footsteps are pine-needle litter on granite | `main.ts:898` | the registry surface → the cue map (S1.5) | the harness walk logs `step.stone` on `nds-floors` |
| B3 | It downloads Driftwood's `island` music slot and every Nalati-tagged SFX | `audioFiles.ts:50-59, 70-92` | `boot.audio` lists only what it plays (S1.5) | the boot-files test |
| B4 | Its death card says "respawning at the south gate" | `HurtArc.ts:87-91` | `strings['respawn.default']` (S1.3) | `test/engine/death-card.test.ts` |
| §7.1 | The Spear thrust / brace / lance and Naizagai's crescent hit through walls (Nalati weapons; the Melee family lands here) | `Spear.ts:523-579`, `Naizagai.ts:204-247` | the melee block's occlusion (S1.2; 09-combat-ai) | `test/damage-pipeline.test.ts` |
| §7.7 | Core decides Nine Dragon's phone AO | `Game.ts:290` | tier data (S1.1) | `test/engine/render-tiers.test.ts` |

## 8. (g) Parity expectations

**Identical under the harness** (`scripts/parity.mjs --export=<sha> --shards=nine-dragon-stack --tiers=phone` on every
commit, `--tiers=phone,desktop` before a push, and the other three shards on every engine edit; R1-10): the systems list in phase order (new ids only where 03-harness-gate's id map says
so), the registry pieces (ids, categories, surfaces, collider counts), the scene census, programs, draws and
triangles at the four `dev.poses` and the three harness poses, the 19 Nine Dragon legs of `physics-route.json` (0
stuck), a swing to a kill on the practice dummy, the grapple playground run, the two fragment zips, the HUD slots,
the save keys, the facade instancing check (`test-facade-instancing.mjs`), and the phone GPU-boot fault panel
(`test:gpu-boot`'s four faults).

**Expected to differ**, each on the named board or the M1 summary. Each row is a **pending item** (R1-13, R2-18):
1. The change commit adds its entry to `reviews/pending.json` with **`expect: null`** (its own run hasn't happened yet).
2. The next per-commit run, on that commit's SHA, fills `expect` per tier: `parity --pending-fill=<ids>
   --export=<sha>`, committed as a follow-up commit that names the SHA.
3. The gate shows a pending item yellow (allowed), and the pin can't move while one is pending.
4. **`parity --accept=<ids>` runs only after Jake's OK at the milestone, and last** (after the fix and revert commits,
   R3-14): it re-records exactly those fields over 3 runs and removes the entries. Without his OK the change is fixed or reverted. The change commit never runs `--accept`.

| Difference | Why | Where it is shown |
|---|---|---|
| Audio beds, score slots, SFX files, boot audio bytes | S1.5 | the audio board (listening page); M1 summary lists the byte change |
| No empty Forest object (its batches' GPU memory) | §2.3 `bootstrap.ts` | M1 summary (GPU MB at the poses, lower) |
| The Spear / Naizagai wall fixes | §7.1 | the weapons board (Nalati clips) |
| The death card text | B4 | M1 summary |
| Budget readout in Debug ▸ Performance | S1.6 | M1 summary |

Anything else that differs is a bug in the step: the commit is reverted (12-process §5).

## 9. (h) Milestone M1

| Step | Detail |
|---|---|
| Flow | gate green on the candidate → boards to Jake → Jake OKs the board items (or they are fixed / reverted) → the fix and revert commits land first → **`parity --accept=<ids>` runs last**, re-recording the OKed ones over 3 runs (R3-14) → the pin moves to **the newest `gpu-gate`-green SHA after that step, with `reviews/pending.json` empty** (R2-27) → deploy → Jake plays it live → **Jake's go starts S2**. The go is not a ship gate (R1-15); a "no" holds S2 (Decision asked) |
| Gate | `gpu-gate` green on the candidate SHA for the 4 shards (the template shard joins at Z1): Nine Dragon's budget check on its derived budgets (S1.6), Pine Hollow's, Nalati's and Driftwood's on their F2-baseline ceilings (R1-14); parity green; `pnpm test` green incl. the ratchets |
| Pin | After step 3 (Jake's OKs, then any fix or revert commits, then the `--accept` commit last, R3-14), with `reviews/pending.json` empty (R1-13, R1-15): the pin moves to the newest SHA after step 3 whose `gpu-gate` is green (R2-27), never to the pre-accept candidate: `node scripts/deploy-pin.mjs set <that sha> --milestone M1 --go "<where>"` writes `.github/deploy-pin.json` (committed alone; 13-lead-resolutions G7), then `gh workflow run deploy`, confirm `version.json`, record the build id in E357 (12-process §3, 03 §13.4) |
| Summary | What moved (§1, file and line counts), the lines deleted (`look/post.ts` and `hero/paifang.ts` at F7, `util.ts`'s `Rng` and `facade/rng.ts` at F8, the ND branches in §2), the ratchet counts before / after (`wildshard/no-shard-branch`, `no-raw-input` for the Fei Zhua hooks, `no-raw-save` for `ws.nineBoot`), Nine Dragon's derived budgets and ceilings, the audio byte change |
| Boards | **Weapons** (the Spear / Naizagai wall fixes; any spot a Melee profile could not match: none expected for the jian) and **Audio** (the listening page). iPhone portrait, clips ≤ 10 s; clips and images come from the harness's capture of the candidate SHA (R1-15). Each item stays pending until Jake OKs it (re-baselined) or it is fixed / reverted (R1-13) |
| Jake plays | Nine Dragon **live** on the pinned build, after the deploy (R1-15): the square, the Well rim, a grapple across, the stair-street, the grapple playground; he listens in the market and at the Well (no calibration: decision 99, R4-01). If he wants to play before the pin moves, the lead deploys the candidate as a Vercel **preview** deployment (`vercel deploy --prebuilt`, which keeps `/api`), not `release-url.sh` (R1-15) |
| Milestone checks | The evidence that left the row done-whens (R1-50), taken by the lead on the M1 build and recorded in E357. **No physical-iPhone reading anywhere** (decision 98, R3-11′): **F10** has none (R4-17: its `persist()` path is a test, 02 F10); **F12**, a Simulator load reading each of Nine Dragon and Pine Hollow (`scripts/sim-memory.mjs --shards=nine-dragon-stack,pine-hollow`: both reach play, no WebContent crash). **Memory** (12 §3, §8): the memory evidence is the nightly Simulator memory run (03 §14.1) plus the budgets (the Gate row): **a reading of the pin's own SHA** (or of a runtime-equal ancestor; R4-15, 03 §13.2: the lead runs `scripts/gpu-perf/nightly.sh --memory-only --sha=<sha>` when there is none) reads Nine Dragon at ≤ 1.8 GB loading and ≤ 1.0 GB in world (decimal), with `gpu-perf/memory` `success` on it. Over a limit means **stop the line** (R1-53): the pin doesn't move (`deploy-pin.mjs set` refuses a SHA without that `success`), the next commit fixes or reverts, and S2 waits. The accepted risk, stated in 12 §8: an iPhone-only memory death (the E271 class) can reach Jake's phone undetected. F11 and S1 did not wait for these checks |
| Decision asked | Two AskUserQuestions (R1-15): first the summary + boards (each board item OK / fix / revert, plus the audio keeps / re-rolls), whose OKs move the pin; then, after he has played it live, "Nine Dragon M1: go?" (recommended: yes). **A "no"** (R2-29, 12 §3): S2 waits. Jake's reasons become rows in this milestone, each fixed on main, gated, boarded if visible, and then the go is asked again. The pinned build stays live unless it is broken (then Rollback) |
| Rollback | If the pinned M1 build breaks on Jake's phone: `node scripts/deploy-pin.mjs rollback <sha> --go "<Jake's words>"` to a SHA in the pin history (M0 included, recorded as trusted at F3.1), with no gate check (03 §13.2). M0 is past F10, so it can't read the v2 saves; this is accepted (the saves reset is OK'd, decision 13) and stated on the rollback (R1-16) |
| Reopening | On Jake's go, `src/shards/nine-dragon-stack/` reopens to content agents (12-process §2). The plan's State line names it. The lock check is `scripts/check-lock.mjs`, the `commit-msg` hook F0 builds (R1-09): a commit without the lead's `E357-Lead: yes` trailer passes only when every path is on the reopened-shard allowlist, **the one definition in 02 F0 step 5** (R2-19), referenced here and not copied. Nine Dragon's extra asset folders are its manifest's `assetGlobs` (§3, R3-09), which the lead's `lock.json`-only commit on Jake's go copies into `.github/lock.json` `reopened` (02 F0, 12 §2). Generated files are built, not committed (R1-11), except the shard's own `ktx2.generated.ts`, which needs `basisu` and is committed by its lane (R2-04). From then on Nine Dragon's lane owns its baselines: a content commit re-records them in a follow-up commit that names the SHA they were recorded on (`parity --rebaseline=nine-dragon-stack --export=<sha>`; R1-12, R2-25), and every other shard must stay identical, the cross-shard proof. NINE-DRAGON-STACK is re-planned for the new engine (decision 66) as a new draft under `docs/plans/`, a lead commit (`docs/plans/` is not on the allowlist) |

## 10. Questions for the lead

Answered in [13-lead-resolutions.md](13-lead-resolutions.md) (the 05 / 06 table and the still-open table); none is
open, and the body above follows each answer.

1. **Manifest fields not in 01 §6.** **Resolved → 13-lead-resolutions 05/06#1** for every `ChunkDef` field: `map` →
   `minimap`, world placement is `placement`, `gridCoords` → `label`, `biome` stays `biome` (the deck's card line),
   `fov` → `camera.portraitFov`; `seed`, `horizon`, `bag.tabs` are on 01 §6. The flat datum is gone: Nine Dragon keeps
   its flat `ground.terrain` beside `structures` (01 §6). This spec's sub-fields: **Resolved → 13-lead-resolutions
   still-open 05#1:** `kitLook` (`'toon' | 'painterly' | 'pbr'`, defaulting to `style` when the kit supports it, else
   `'pbr'`; it replaces `style ?? 'pbr'` at `main.ts:505`, `Explore.ts:269`, `AnimalManager.ts:459` and `Hands.ts`),
   `bag.pack.slots` and `dev.poses` are declared manifest fields (01 §6 "Declared sub-fields"). §3 follows.
2. **Boot flags.** **Resolved → 13-lead-resolutions 05/06#2:** `boot.barrier` (all tiers), `boot.phone.deferExtras`,
   `boot.phone.fragile`, `boot.phone.trace`, `boot.cullBeforeFirstDraw`; `warmTurns` and `textures` are tier knobs.
3. **World-anchored HUD pins.** **Resolved → 13-lead-resolutions 05/06#3:** `hud.pin(at, el, scope)` (01 §11). S1.4
   step 4 and §4 use it as `ctx.hud.pin(at, el)`: the context supplies the scope (R1-25).
4. **Tier precedence.** **Resolved → 13-lead-resolutions 05/06#4:** one source, engine default → kit schema default →
   `level.tiers[tier]`; `LookStrategy`'s old `slices` / `ao` / `aa` move to `level.tiers` (§3, §5, S1.1 step 8).
5. **Debug handles.** **Resolved → 13-lead-resolutions 05/06#5:** `ctx.debug.expose(name, value)` →
   `window.__wildshard.shard[name]` (01 §7).
6. **Audio slice timing.** **Resolved → 13-lead-resolutions 05/06#6:** S1.5 builds score sources, ambience beds and
   cue maps; S3.5 continues from it (the voice engine, ambience zones, merged SFX routing, the `Audio.ts` split).
7. **`world/hero/paifang.ts`** (267 lines) is unimported. **Resolved → 13-lead-resolutions still-open 05#7:** it goes
   in F7's one dead list (02 F7 step 3), not S1.1; §1.1 and S1.1 step 7 follow.
8. **Nine Dragon's load cap.** **Resolved → 13-lead-resolutions 05/06#7:** its F2 baseline, rounded up to the next
   second, shown on the M1 summary for Jake to confirm (S1.6).
9. **Budget file names.** **Resolved → 13-lead-resolutions 05/06#8:** 01 wins: `budgets/calibration.json`,
   `src/engine/render/budgets.ts`.
10. **F6's transitional manifest.** **Resolved → 13-lead-resolutions 05/06#9:** F6 leaves the old hook fields on the
    manifest; S1.1 moves Nine Dragon's into its plugin, and the type drops them after S4.1 (01 §6, 02 F6).
