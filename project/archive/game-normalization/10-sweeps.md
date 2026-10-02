# GAME-NORMALIZATION v2 · 10 — The sweeps (X1–X9)

The X rows collect the engine and game-layer work that no single shard phase owns. A shard phase may pull a part earlier when it
needs it. For example, S1.4 builds the input service and the `grapple` context, so X1 starts from there.

Each row lists:
- what exists after the shard phases, and what it takes over;
- the steps;
- the tests;
- done-when (measurable);
- the board, if any.

The interfaces are in [01-architecture.md](01-architecture.md). Counts come from
[engine-internals-audit](../../../docs/design/engine-fit-v2/engine-internals-audit.md) as of `b3b43536`, and are re-counted
at F2's baseline.

## X1 — Input: actions, contexts, rebinding, buffer + coyote, touch (EI9–EI12; decisions 38, 39, 40)

**Starting point.**
- S1.4 built `#engine/input` with the action map, keyboard, mouse and touch bindings, and the context stack.
- It covers the `onFoot`, `weapon.melee` and `grapple` contexts, and the disc relabel.
- Every other listener is still raw, and counted by `wildshard/no-raw-input`.

**The contexts** (every verb that exists today; source: engine-internals-audit §2)

| Context | Pushed by | Actions (keyboard default · touch disc) |
|---|---|---|
| `onFoot` | engine (base) | move WASD · stick; look mouse · drag; jump Space · JUMP; sprint Shift · stick push; crouch C · CROUCH; dodge Alt · DODGE; use E · USE; swap Q / 1–9 · SWAP ring; lock (mouse 3) · LOCK; pause Esc · PAUSE; bag Tab · BAG pill; map M · MAP; journal J; note N (feedback); hover H · HOVER |
| `weapon.melee` | Melee family | attack LMB · ATTACK (tap); heavy LMB hold · ATTACK hold; lock |
| `weapon.ranged` | Crossbow, Firearm | fire LMB · FIRE; aim RMB (hold or latch) · AIM; reload R · RELOAD |
| `weapon.bow` | Bow family | draw LMB hold · FIRE hold; loose release; aim RMB · AIM |
| `weapon.spear` | the Spear's profile | thrust LMB; throw hold over AIM; brace hold over JUMP |
| `crossbow.bolts` | Pine plugin | cycle bolt B · the verb.1 slot |
| `swim` | engine (water) | dive over jump; surface over dodge; weapons holstered |
| `board` | engine (hover) | hover off H; jump; dash and crouch off |
| `ride` | Nalati plugin | steer; gallop; lean L/R; whistle X · verb.1; dismount E; offer (taming) G · verb.2 |
| `stealth` | Nalati plugin | crouch toggle (the action, not `player.keys`); the grass status row |
| `grapple` | Nine Dragon plugin | lock relabelled GRAPPLE / LOCKED; jump relabelled ZIP |
| `menu` | UI layer push | nav ← →; tab; confirm; back Esc |
| `explore` | app state | fly WASDQE; up / down; boost; pane 1–3; map; back |
| `dialog` | quest / NPC talk | advance E / tap; back |

**Steps**
1. Move each remaining raw listener onto actions, file by file (EI10). Each move lowers `wildshard/no-raw-input` until
   it reaches 0. The files:
   - Player.ts (WASD, Shift, Space, C, H, Alt, pointer lock);
   - Weapons.ts (Q, 1–9);
   - the per-weapon F / R listeners in Rifle, Sword, Spear, Longbow, LeverRifle and Crossbow (by then in the kit
     families);
   - Mount.ts X, Taming.ts G, stealth.ts C / Ctrl;
   - Pine's loadout.ts B;
   - the E handlers in `main.ts`, QuestUI.ts and Pine's quest/ui.ts;
   - Explore / FreeCam.
2. Delete what the actions replace: the 7 `inputAllowed()` copies, the fake `KeyE` from the touch USE button
   (`TouchControls.ts:398`), and the 20 enable / disable / pointer-lock sites in `main.ts`. A weapon reads its actions
   (`input.held('attack')` …) while its context is **anywhere in the stack and not blocked**: contexts are additive
   (01 §10, R1-29, R2-07), so a `ride`, `stealth` or Tool context on top keeps the weapon firing, and only a context
   whose `blocks` names the action stops it (`ride.break`, `menu`). The UI layer stack pushes `menu` (X2), so weapons
   stop firing under a menu without a flag. `test/engine/input-context.test.ts`: `weapon.melee` under a non-blocking
   Tool or `ride` context still attacks; pushing `ride.break` or `menu` blocks it.
3. **TouchControls draws the merged discs of the whole context stack** (EI11; contexts are additive, 01 §10, R1-29):
   a higher context's relabel wins per disc spot, and a context hides only what its `blocks` names. So `ride`,
   `stealth` or a Tool's context on top keeps the weapon's discs working. The weapon-id sets go and become each
   family's `touch` fragment: `MELEE`, `SPEAR` (`:99-101`), `LOCK_WEAPONS` (`LockOnTarget.ts:57`) and `id === 'bow'`
   (`:198-215`). `touchHint` (`ChunkDef.ts:80`) is already gone at S1.
4. **Reserved verb slots** `verb.1` / `verb.2`: two named disc spots next to JUMP. Their exact position is decided on
   the board (below), and a context fills them. The first users: Pine's bolt cycle (`verb.1`), Nalati's whistle and
   offer.
5. **Key rebinding:** Settings ▸ Controls lists every action of `onFoot`, the weapon contexts, `swim` and `board`
   (not `menu`). Tap a row, press a key, and a conflict prompts a swap. Stored in
   `saves.define({ key: 'controls', scope: 'global', version: 1 })`, with a Reset to defaults button. Touch layout is
   not rebindable (a decision, not an omission). No gamepad (38).
6. **Buffer + coyote** (40). Parameters:
   - `input.buffer.ms = 120` and motor `coyoteMs = 100`;
   - both are per-shard overridable via `level.fight.input = { bufferMs, coyoteMs }`;
   - defaults on for all shards.
   The Sword's combo queue (`Sword.ts:481,564`) becomes `input.consume('attack')` inside the Melee family, with the
   same `CHAIN_LAG` 0.02 s. The harness's scripted combo must stay identical.
7. **A dev overlay** (a Debug row under Developer tools): the live context stack and the last 20 actions.
8. **The hoverboard becomes a kit Tool** (13-lead-resolutions 09#7; 09 §1.7 T2): `src/engine/player/Hoverboard.ts` (the board
   viewmodel) → `src/kit/tools/hoverboard.ts`, `class Hoverboard extends Tool`, slot `tool`, the `hover` action (`H`,
   the HOVER disc), on all 4 shards through each manifest's `loadout.tools`. Its movement mode (`Player.hover`, the
   ride-height spring, `HOVER_TOP`) stays in the engine motor as the `board` context. `Player` no longer constructs it.
9. **The `addEventListener` patch.** Moving the input listeners onto `#engine/input` (steps 1–3) and X2's UI appends
   onto scoped widgets takes `wildshard/no-global-listener-patch` (396 at F11, 01 §24) to 0; the later of X1 / X2
   deletes `src/engine/app/legacyCapture.ts` (13-lead-resolutions 02/03#4).

**Tests**
- Node:
  - the context stack (push, pop, block rules);
  - buffer expiry at 120 ms;
  - coyote at 100 ms (the motor in the fake Game);
  - the rebinding round trip through the save;
  - no two actions in one context bound to the same key.
- Harness: the scripted walk / swing / shot routes run through actions. Their fingerprint (hits, kills) matches the
  baseline, except where the board accepts a buffer change.

**Board (input / HUD), iPhone portrait with clips.**
1. A late jump off a Nine Dragon roof edge, before and after (coyote).
2. A dodge pressed mid-swing, before and after (buffer).
3. The verb slots, in 2 positions, A / B.
4. The Controls screen.

**Done when**
- `wildshard/no-raw-input` = 0; `wildshard/no-global-listener-patch` = 0 once X2 has also landed, and
  `legacyCapture.ts` is gone.
- `tool.hoverboard` is a kit Tool; `grep -n "new Hoverboard" src/engine` is empty.
- No `inputAllowed` and no fake keypress remain.
- TouchControls holds no weapon-id set.
- The board is OK'd.
- Parity is green, with the board's accepted differences re-baselined.

## X2 — UI layers, HUD slot bands, Bag tabs (EI13–EI16)

**Steps**
1. `#engine/ui/layers` (01 §11). The ~10 overlays move onto `push(layer, view)`; each loses its `isOpen` and its own
   Escape handler, and `Menu.keyGate` and `HUD`'s double-Escape guards go (E130, E32). The overlays:
   - Menu (`gameMenu`), Map (`gameMenu`), Journal (`gameMenu`);
   - ShopPanel (`modal`), QuestUI (`modal`), Feedback (`modal`), ShardComplete (`modal`), HorseNamePrompt (`modal`,
     Nalati's, pushed by its plugin);
   - DebugMenu (`menu`), BootSettings (`menu`);
   - the error screen (`error`).
2. z-index comes from the layer. The 24 z-index literals in `src/ui/styles/*.css` and inline become 5 layer tokens plus
   in-layer order. `check-css.mjs` fails a new literal.
3. **HUD slot bands** (EI14). `hudSlots.ts`' `ROW = { steed, stealth, grass }` (Nalati's rows in the base) becomes
   numbered bands `band.1…band.6` that a manifest orders.
   - The 42 direct `#hud` / `<body>` appends move to `ui.hud.widget(band, el, order, scope)`, among them BossBar,
     EliteBar, CoinChip, ShopPanel, RideHUD and the stealth row.
   - A lint rule (`wildshard/no-raw-hud`) counts direct appends to 0.
4. **Bag tabs and item fragments** (EI15).
   - `MenuTab` stops being a fixed union: a shard or the kit registers tabs.
   - `setFinds` (4 callers, last wins), `setLoot` and `GameMenu`'s `kit` / `skins` / `tools` / `pack` options become
     registered fragments.
   - E314's per-shard tab picks become each manifest's `bag.tabs` (Driftwood MAP · GEAR · FINDS · PACK · FEATS;
     Nalati MAP · GEAR · FINDS · FEATS; Pine per its E314 pick C; Nine Dragon MAP · GEAR).
5. **Shard data leaves `src/ui` and Explore** (EI16). Each piece goes to its new home:
   - the title cards and art go to `manifest.card`;
   - the minimap palettes (`Minimap.ts:104,335,515-517`) go to `level.minimap.palette`;
   - the respawn text (`HurtArc.ts:89-90`) goes to the shard's string table;
   - the gated debug rows (`debugOptions.ts:68-69`, 9 of 15) go to plugins' `ctx.debugRow`;
   - RideHUD goes to Nalati's folder;
   - `compendium/shards/pine-hollow.ts` goes to Pine's folder;
   - `Loading.ts:45` becomes boot data the engine reads as `level.boot` (R2-02).
6. The ~10 hand-kept gates on `weapons.setEnabled` / `game.frameGate` follow the layer stack.

**Tests**
- Node (jsdom): the layer stack (push, pop, back, only the top gets input), Bag tab registration, fragment order.
- Harness: the HUD DOM hash per shard is identical. Layers change structure, not look, so the hash is re-baselined
  once, with a pixel diff within noise as the proof.

**Board:** none expected (no visual change). If any pixel pose differs beyond noise, it goes on the input / HUD board.

**Done when**
- `wildshard/no-raw-hud` = 0.
- No overlay owns an Escape handler.
- `src/engine/ui/**` and `src/game/**` hold no shard name (the post-F6 paths, R1-40), and the grep is asserted to scan
  a non-empty file set.
- Parity is green.

## X3 — Boot and assets from the manifest (EI3, EI4, TP9, MW13, MW17; DEPLOYMENT_ASSET_TRIM T3, TP17)

**Starting point.** Each shard phase moved its own `boot` data into its manifest. X3 deletes what is left of the shard
branches in `src/engine/boot/` and adds the checks.

**Steps**
1. **The stages** (01 §8) replace `STEP_INFO`'s 16 fixed keys. The loading bar's labels and weights come from
   `level.boot.steps`.
2. **`boot.files(tier)`, `boot.audio`, `boot.explore` and `boot.precache`** are the only sources for the pack
   manifest, the prefetch, the offline list and the Explore preload.
   - `src/engine/boot/manifest.ts`, `extras.ts`, `shardPrefetch.ts` and `audioFiles.ts` hold no shard branch.
   - Bug §7.4 is fixed: every shard's Explore art and code is precached.
3. **The asset audit** (MW17), a node check in `pnpm test`. For every file a manifest declares:
   - it exists in its tier's pack;
   - it has its KTX2 stand-in where the tier wants one;
   - it has a credit row where the licence needs one;
   - there are no orphans.
4. **T3 of DEPLOYMENT_ASSET_TRIM** falls out of the audit: the list of original `assets/tex/` textures each shard's
   manifests reference versus their GPU KTX2 variants. Unreferenced originals are listed in a report for Jake; nothing
   is deleted without his pick.
5. **TP17:** `unused-assets` counts the `ktx2.generated.ts` tables (per shard + the engine's, R2-04) as references, so the 171 MB of shipped KTX2 is no longer
   called "dev-only".
6. (Nine Dragon already joined the boot packs, the prefetch and the every-shard tests in S1.1.)
7. **The chunk layout** (decision 2, MW13, EF10; 13-lead-resolutions G1). X3 runs after S4.4, when every shard is a
   plugin, so the layout can be checked for real:
   - `vite.config.ts` sets `build.manifest: true` and `build.rolldownOptions.output.codeSplitting.groups` (Vite 8 is
     Rolldown; `manualChunks` is deprecated, engine-fit §5), in priority order: `three` (`test` =
     `/node_modules[\\/]three[\\/]/`, priority 30); `engine` (`src/engine/**`, `src/game/**`, `src/kit/**`,
     `src/main.ts`, and every shard's manifest closure, priority 20); one group `shard-<slug>` per shard (`src/shards/<slug>/**`
     outside its manifest closure, priority 10). The shard groups are generated from the `src/shards/*/` folders,
     so a new shard gets its chunk with no config edit.
   - **The manifest closure.** A shard's `manifest.ts` and the node-safe modules it imports statically (Nalati's
     `world/terrain.ts`, Pine's `boot/files.ts` …) are data the registry, the title deck and the bakers read at
     startup, so they belong in the `engine` chunk. `scripts/gen-shards.mjs` (F9) also writes
     `src/game/shard/manifest-closure.generated.json` (per slug, the module ids of the manifest's static import
     closure, found with the TypeScript compiler API as `classify.mjs` does); `--check` covers it.
   - **Which modules land where.** A small Vite plugin, `vite/chunkReport.ts`, writes
     `dist/.vite/chunk-modules.json` (`{ <chunk file>: { name, moduleIds, gzBytes } }`) in `generateBundle`, next to
     Vite's `dist/.vite/manifest.json`.
8. **The build check** `scripts/check-chunks.mjs dist` (`pnpm check:chunks`). From Vite's manifest it builds the
   **main chunk set** (what a cold boot fetches before any shard's plugin): the entry chunk (`src/entry.ts`,
   `isEntry`), the chunks of `three` and `src/main.ts` (which the entry imports dynamically, E188), and every chunk
   those reach through static `imports`. With `chunk-modules.json` it fails (exit 1, naming the module and the chunk) when:
   - a `src/shards/**` module outside its manifest closure is in the main chunk set;
   - a shard's non-closure modules are spread over more than its one `shard-<slug>` chunk;
   - a `shard-<slug>` chunk holds another shard's module.
   It prints the chunk table (name, gz KB, module count), and the lead records it in E357 at X3. It runs in
   `scripts/vercel-tree-gate.sh` after `vite build` (the pre-push gate) and in `deploy.yml`'s web build step, so every
   push from X3 on is checked.
9. **The shard chunk goes through the E188 retry.** `retried()` moves from `src/entry.ts` (the composition root, where
   F6 left it) to `src/engine/boot/retry.ts`, a leaf module with no imports. `src/entry.ts` imports it back by that deep
   path (`#engine/boot/retry`, never the `#engine` index, so the entry's first task stays as small as today; the
   composition root is outside the layer rule, F4). `#game`
   wraps `manifest.load()` in it, and the engine's staged boot wraps the `level.look()` import (01 §5a, §7 load
   order), so a shard chunk dropped mid-download on LTE gets the same two retries (0.8 s, 2.5 s) as `three` and `main` do today.
10. **The E188 re-test on the newest installed iOS runtime** (EF10 flagged iOS 27's rewritten module loader; the Mac
    has iOS 26.5 today, so the check runs on the newest runtime `xcrun simctl list runtimes` shows (R1-51); that
    Simulator run is the evidence, with no physical-phone step: decision 98, R3-11′). `scripts/ios-retry-check.mjs` serves the
    X3 build (`scripts/serve-build.sh`) behind a local proxy that cuts the connection mid-body on the **first**
    request for the `three`, `engine` and `shard-pine-hollow` chunks. Inside `scripts/sim-lane.sh run --max 15
    wildshard-iphone …` (the newest installed iOS runtime), it opens `http://127.0.0.1:<proxy>/?chunk=pine-hollow&skipintro=1&mute=1`
    in Safari. It reads the page through Web Inspector (`ios_webkit_debug_proxy`, as `scripts/nine-sim-memory.mjs`
    does). Pass: the proxy logs a second, complete request for each of the three files, and
    `typeof window.__wildshard.boot === 'object'` (the world was reached) within 120 s. The result is recorded in E357.
    If WebKit no longer re-fetches a failed module URL, that is a found bug: it is fixed inline (the retry imports a
    fresh URL), and this check is its test.

**Tests**
- The asset audit.
- A node test that every manifest's `boot.files(tier)` resolves.
- `test/check-chunks.test.ts`: `check-chunks.mjs` on fixture `manifest.json` / `chunk-modules.json` pairs. A shard
  plugin module in the main chunk set fails; a manifest-closure module there passes; a shard split over two chunks
  fails.
- The harness's boot fingerprint (the list of packs fetched per shard × tier) is identical, except the Explore precache
  gain on 3 shards (expected, a bug fix).

**Done when**
- 0 shard branches in `src/engine/boot/**`.
- The asset audit is green.
- The Explore offline preload works on 4 shards (an offline boot test in the harness: service worker installed, then
  network off, then Explore opens).
- `pnpm check:chunks` exits 0 on the X3 build, with the JS chunks `three`, `engine`, one `shard-<slug>` per shard,
  plus the ones Rolldown keeps apart (Rapier's bindings, workers) listed by name in E357.
- `scripts/ios-retry-check.mjs` passes on the newest installed runtime (its version recorded in E357). No milestone
  checklist carries a physical-phone confirmation (decision 98, R3-11′).

## X4 — The animation engine layer (decision 64; ANIMATION-REMASTER's mechanism half)

**Steps**
1. **`#engine/anim`: one rig loader.** It takes GLB + the bake metadata the rig pipeline writes (see
   `.claude/skills/img2-character`). Every species row, NPC row and viewmodel rig declares a `RigContract` (skeleton
   id, clip names, sockets). The loader checks the contract at load and fails loudly on a missing clip.
2. **The clip-name convention** (01 §16) maps today's names. The combat-ai spec's species table lists each species'
   clips and their new names; the renames happen in the rig metadata, not the GLBs.
3. **`AnimMachine`**, driven by the creature HFSM (01 §19) and the viewmodel blocks (01 §18), with crossfade times
   copied from today's code per species.
4. Today's per-species animation code moves onto it family by family, in the shard phase that owns each species
   (S2–S4). X4 is the sweep that deletes the last hand-rolled mixer code.
5. ANIMATION-REMASTER's State line is updated: A3–A7 build on the contract, after this plan.

**Tests**
- Node: contract validation (a missing clip fails), a state-machine transition table per species.
- Harness: creature poses identical (skinned-mesh poses at fixed seeded times).

**Done when**
- Every animated thing loads through the rig loader.
- 0 raw `AnimationMixer` construction outside `#engine/anim` (a ratchet rule).

## X5 — World and look leftovers (D11, D16–D21 remainders)

Each item is its own commit, with parity green:

| Item | Today | After |
|---|---|---|
| **Sky** | `Sky.ts` (899 lines) with 3 setup paths; `PainterlySky.ts` (273) and the cloud dome built then hidden on Nalati and Nine Dragon | `SkyRig` + each shard's `backdrop`; the hidden builds deleted, which saves their build time and memory, a measured win |
| **Fog** | 4 `fog_fragment` writers (`Atmosphere.ts:120,205`, `stylize.ts:209`, `nalati/look/fog.ts:69`) in implicit order | the shader-patch registry slots 100 / 200 / 300 (01 §13.2) |
| **Water** | 6 bodies | S4.1 built the `WaterBody` interface and the sea on it (01 §17; 13-lead-resolutions 07/08#7). X5 converts the other bodies (`world/Water.ts`, `world/BeaverPool.ts`, `world/PineStreams.ts`, `nalati/water.ts`) and adds the `reflect` hook; each body is shard or kit by the rule of two |
| **Geometry kit + AO** | `lowpolyKit.ts` (557), `nalati/paint.ts` (504), `rockKit.ts` (352); 3 AO bakers (`bakeAO`, `bakeSmoothAO`, `bakeVertexAO`) | one engine geometry toolkit (log, pole, blob, lathe, merge) + one `voxelAO(params)`; each baker's parameters kept as data, so every vertex colour is identical |
| **LUT loader** | `world/lut.ts:28` and Nine Dragon `look/light/grade.ts:43` | one loader in `#engine/render` |
| **Particle pools** | 7: `nightFx.ts:19`, `fx/Impacts.ts:51`, `Crossbow.ts:408` (`Puffs`), `Sword.ts:336` (`Stars`), `AnimalManager.ts:298` (`BloodFX`), `Enemies.ts:138`, Nine Dragon `grapple/fx.ts:55`; plus a second `Puffs` in `pinehollow/fxKit.ts:17` | one `ParticlePool` in `#engine/fx`; each pool's parameters are data |
| **Telegraphs** | balbal `Wedge` (`balbalWarriors.ts:42`) beside `GroundTell` | `GroundTell` gains `'wedge'` |
| **RNG** | 3 | done at F8: 02 F8 step 1 lands the one `Rng` and deletes Nine Dragon's `util.ts` `Rng` and `world/facade/rng.ts` (13-lead-resolutions G18). X5 only re-checks that `grep -rn "class Rng" src` prints one line |
| **Helpers** | `lin()` ×6, `smoothstep` ×~15, `sstep` ×5, pan-from-yaw ×8 (01 §15; 13-lead-resolutions C8, G21), loop-at-offset ×5, `compassDir` ×2 | one each, in `#engine/math` and `#engine/audio/util` |
| **Skin lockers** | `SkinLocker` (`Skins.ts:283`), `NalatiSkinLocker` (`nalatiSkins.ts:45`), Pine `finishes.ts` | one cosmetics service in `#game` + per-shard skin rows |
| **Slash trail** | `Sword.ts:702-797` and Nine Dragon `vm/trail.ts` (197) | one trail block in `#engine/combat/blocks`; the shader stays per shard |
| **Dead code** | `meleeGeo.ts:157-213` | deleted at F7 |

**Tests.** Each item's parity: pixel poses within noise, draw / triangle / program counts exact. The AO baker merge
also gets a byte-identical vertex-colour test on one model per baker.

**Done when**
- Every item has one implementation.
- The D-group line counts are recorded in the plan's State line.

## X6 — WebGPU containment (decision 22)

**Steps**
1. The renderer type is named only in `src/engine/render/**`. The 52 files that name it today switch to a
   `RenderService` handle. `wildshard/no-renderer-type` goes to 0.
2. All 87 `onBeforeCompile` sites go through `ShaderPatches.patch(mat, id, order, fn, scope)`, with explicit order. A
   test compiles every patched material twice and compares the source: the patch order must be stable.
3. **One `precompile()`** in `#engine/render`. Shards list their materials in `level.boot.shaders`.
4. **An inventory doc** `docs/design/webgpu-port-inventory.md`, updated by a script: the 112 `ShaderMaterial` uses, the
   16 `postprocessing` files, each patch id. That turns a future port into a checklist.
5. No TSL, no WebGPURenderer.

**Done when**
- Both ratchets are at 0.
- The inventory script is in `pnpm test --check`.
- The shader program count per shard is identical in parity.

## X7 — Tiers as data and budgets per manifest (EI24, EI25; decisions 30, 35–37)

**Steps**
1. **`src/engine/render/tiers.ts`** holds the engine's knobs. Of today's 59 settings per tier, the 7 Driftwood-named
   ones were declared by Driftwood's plugin at S4.1 (`ctx.tiers.knobs`, 01 §7; 13-lead-resolutions 07/08#8), so X7
   only checks that no shard-named knob is left in the engine table. S2.1 already deleted `PINE_HOLLOW_PHONE` and `tier.ts:113`'s Pine branch.
   X7 deletes whatever shard-named knobs and helpers are left.
2. **Budgets.** Each manifest's `budgets` inputs are filled from S1.6's calibration file `budgets/calibration.json`.
   `src/engine/render/budgets.ts` derives the numbers with the formula in
   [budget-design](../../../docs/design/engine-fit-v2/budget-design.md). `Perf.ts:36`'s single draw budget and the three
   unrelated phone budgets (110 / 150 / 180 draws) are deleted.
3. **The gate reads the derived numbers** (03-harness-gate). The rollout ceilings live in `lint/ratchet.json` under
   its `budgets` section, keyed `<shard>.<tier>.<pose>.<metric>` (R2-23).
4. **The in-game budget readout** (Debug ▸ Performance) shows derived versus measured per pose.
5. **Tier selection** (decision 36: "a mid gaming PC (RTX 3060 class) at 60 fps; laptops below it fall back to the
   phone tier"; 13-lead-resolutions G3). `src/engine/render/tierSelect.ts` replaces `core/tier.ts`'s
   `AUTO_TIER = mobileUA ? 'phone' : 'desktop'`. It runs once at boot, before the renderer is configured (F9 already
   moved the `TIER` read behind a function), and the first rule that applies wins:
   1. the harness param `tier` (already on the `harness` allowlist; the test, capture and bench scripts keep using it);
   2. a phone or tablet user agent (today's `mobileUA`): `phone`, with no benchmark;
   3. the `device` save key `render.tierPick` = `{ v: 1, renderer, tier, via: 'table' | 'bench', score, at }`: its
      `tier`, when `renderer` equals this device's `UNMASKED_RENDERER_WEBGL` string (a new GPU or driver re-picks);
   4. **the renderer-string table** `src/engine/render/gpuClasses.ts`: rows of `{ match: RegExp, tflops, source }` for
      the GPU families a renderer string names (NVIDIA GeForce GTX / RTX, AMD Radeon RX and the integrated Radeons,
      Intel UHD / Iris Xe / Arc, Apple M1–M5 by variant), each with its published FP32 throughput and the page it came
      from. A match with `tflops ≥` the RTX 3060's 12.7 gives `desktop`; below it gives `phone`;
   5. **no row matches** (a masked or generic string, such as Safari's "Apple GPU"): the **2 s GPU micro-benchmark**
      runs on the loading screen at first boot. It draws a fixed fill-bound shader (the `fill` sweep of S1.6's
      calibration scene) into an offscreen 1280 × 720 target in a loop for 2 s, fenced with `gl.finish()`. The score
      is full-target passes per second. `score ≥ desktopFloor` gives `desktop`, else `phone`. `desktopFloor` = the
      M5's score in `budgets/calibration.json` × `k3060` (step 6).
   The pick is written to `render.tierPick`, a `device` key (never exported, never reset, 01 §9), so the benchmark runs
   once per device. Debug ▸ Performance gets a read-only row `tier pick` (tier, `via`, the table row or the score) and a
   `RE-PICK` action that deletes the key and reloads. There is no URL switch.
6. **Desktop budgets and how desktop 60 fps is verified** (decision 36; budget-design §2). X7 adds a section "Desktop:
   the M5 : 3060 ratio" to [budget-design](../../../docs/design/engine-fit-v2/budget-design.md). It documents `k3060` = the RTX
   3060's throughput ÷ the M5 Max's, from cited public sources: the FP32 figures and one cross-platform GPU benchmark
   that lists both chips. `src/engine/render/budgets.ts` derives the desktop row from the M5 calibration (S1.6's
   headless M5 twin) × `k3060`: the desktop capacity per frame at 60 fps is the M5's measured capacity × `k3060`.
   The nightly (03 §14) then reports a **projected 3060 frame** for each desktop pose (the M5's measured desktop
   frame ms ÷ `k3060`) against 16.7 ms. That projection is how "desktop 60 on a 3060" is checked while no 3060 is on
   hand. When a 3060-class reading is ever taken (the calibration scene run on such a PC adds an `rtx3060` device entry
   to `budgets/calibration.json`), it replaces `k3060` for the desktop row, and the numbers re-derive with no code
   edit.

**Tests**
- Node: the formula (a fixture calibration gives known numbers), every manifest's inputs are complete.
- Node, `test/engine/tier-select.test.ts`: a mobile user agent gives `phone` and never runs the benchmark; a cached
  pick with the same renderer string skips both table and benchmark; a changed renderer string re-picks; one fixture
  string per table family gives its class; an unmatched string runs the (stubbed) benchmark, and scores just above and
  just below `desktopFloor` give `desktop` / `phone`; `?tier=` still wins. The desktop derivation with a fixture `k3060`
  gives known numbers.
- Gate: the budget check per shard × tier.

**Done when**
- No tier knob is named after a shard.
- Every shard has derived budgets.
- The gate enforces them.
- The budget-design doc's "provisional" labels are replaced by calibrated numbers, and its "Desktop: the M5 : 3060
  ratio" section cites its sources.
- `core/tier.ts`'s `AUTO_TIER` is gone; the tier comes from `tierSelect.ts`, and the Debug row shows the pick.
- The nightly report prints the projected 3060 frame for every desktop pose.

## X8 — Session health, analytics, capture, strings, flag hygiene (decisions 47, 78–80; MW10, MW16)

**Steps**
1. **Session health.**
   - A `sessionStorage` + `localStorage` heartbeat (through `#engine/saves`, a **`device`** key: never exported or reset,
     R1-39) records the session's
     state every 5 s (shard, stage, fps median).
   - The next boot classifies the last session: clean exit, crash (an error with no clean exit), context loss, or a
     likely OOM (heartbeat stopped mid-play with no error).
   - It posts to **`api/telemetry`** (a new Vercel function beside `api/inbox.ts` and `api/errors.ts`, storing to the
     same `@vercel/blob` store under `telemetry/<yyyy-mm-dd>/`) with the build id. The `POST` needs no secret (every
     player's game reports, as `api/errors.ts`'s does). **Each write deletes the blobs older than 30 days** (R2-24), so
     the store keeps 30 days with no cron.
   - **The read path (R2-24).** `api/telemetry` gets a `GET` behind the same secret gate as `api/errors.ts`'s `GET`
     (the `x-review-password` header, checked by its constant-time `passwordOk` against `REVIEW_PASSWORD`; 503 when
     unset, 401 when wrong). It computes **server-side**: `GET ?rate=builds&n=3` → the crash-free-session rate per
     build for the last 3 builds (`{ build, sessions, crashFree }`), and `GET ?digest=<yyyy-mm-dd>` → that day's
     analytics digest (counts of `death.cause`, `quest.step`, `weapon.used`, `boss.attempt` outcomes; `shard.time`
     medians).
   - `.claude/hooks/session-brief.sh` calls both with the secret read from **`~/.config/wildshard/telemetry.key`**
     (absent → it prints "telemetry: no key" and goes on) and prints the crash-free rate per build (last 3 builds)
     and yesterday's digest.
2. **Analytics sink.** `#engine/analytics` subscribes to the events in 01 §23 (`death.cause`, `quest.step`,
   `weapon.used`, `shard.time`, `boss.attempt`). It batches every 30 s and on `pagehide` to `api/telemetry` (the same
   function, `kind: 'analytics'`), with no personal data and a random per-install id (a `device` key). The daily
   digest is the `GET ?digest=` above (computed server-side) and goes in the session brief; the 30-day retention is the
   cleanup on each write (step 1).
3. **Capture mode.** `clock.setCapture(fps)` and seeded streams (built at F8). X8 ports `steam-trailer/capture.mjs` and
   the board-clip script onto it and deletes the `performance.now` patch.
4. **Strings.** Every player-facing string still inline in `src/engine/**` moves to `#engine/strings`. Shards moved
   theirs during their phase. A lint rule (`wildshard/no-inline-ui-string`: string literals passed to `toast`,
   `textContent`, `innerText` or a label field) ratchets to 0.
5. **Flag hygiene** (MW16; 13-lead-resolutions G13). Debug rows are "inventory with a carrying cost" (mobile-web-practice
   MW16), so each one gets an owner and a date:
   - Every row of `DEBUG_ROWS` (`src/engine/ui/debugOptions.ts` after F6) and every row a plugin adds through
     `ctx.debugRow` gains two **required** fields: `ask: 'E<n>'` (the ask that owns it) and `reviewBy: 'YYYY-MM-DD'`
     (at most 90 days after the row lands). The row type makes both required, so a row without them fails `tsc`.
     `note` keeps its one line.
   - **Backfill** in the X8 commit: each existing row's `ask` is the ask id its `note` already names (AGENTS.md's
     recipe), and its `reviewBy` = the X8 date + 90 days.
   - `test/debug-flag-hygiene.test.ts` fails on a row with an `ask` that has no `docs/tasks/asks/<id>.md` (or legacy
     `ASKS.md` row), or a `reviewBy` more than 90 days after today (so no row can park itself far out). It **lists** the overdue rows
     (`reviewBy` before today) in its output and in `.cache/debug-overdue.txt`, but an overdue row never fails it (a
     date must never block a push).
   - `.claude/hooks/session-brief.sh` prints the overdue list (row key, ask, `reviewBy`), so the lead sees it at every
     session start. Overdue means "Jake picks a winner, or the date moves with a reason in the ask".
   - **A count ratchet:** `lint/ratchet.json` gains `"debugRows": { "max": <the row count at X8>, "raisedBy": [] }`.
     A row above `max` fails `pnpm test`, unless the same commit raises `max` and appends the new row's ask id to
     `raisedBy`. So every new row is a deliberate, reviewed rise, and a deleted row lowers `max` (`pnpm lint:ratchet
     --update`).
   - AGENTS.md's "No URL switches" recipe (step 2, the `opt(…)` row) gains the two fields in the same commit.

**Tests**
- Node: the session classifier on fixture heartbeats; the sink's batching; `api/telemetry`'s `GET` (no / wrong
  `x-review-password` → 401, the rate and the digest from fixture blobs) and its 30-day cleanup on a `POST`; the string tables' completeness (every key
  used exists); the flag-hygiene test above on a fixture registry (an unknown ask fails, a `reviewBy` 91 days out
  fails, an overdue row is listed and passes, a row over `max` without a `raisedBy` entry fails).
- The harness asserts that the analytics requests fire (mocked `api/`).

**Done when**
- The session brief shows the crash-free rate and the overdue Debug rows.
- The analytics digest shows at least one day of data.
- Capture uses the engine clock.
- `wildshard/no-inline-ui-string` = 0.
- Every Debug row has an `ask` and a `reviewBy`, and `lint/ratchet.json` holds the `debugRows` ceiling.

## X9 — The game-layer extras: travel-ready items, the Wildshard summary, the travel type (decisions 59, 75, 76; 13-lead-resolutions G10)

**Starting point.**
- F10's `SaveStore` holds one document per shard plus `global`; `progress` (with each shard's earned feats) is a
  `shard` key, and 01 §9 makes the Wildshard summary a `global` key.
- The shards register their items and feats as rows (`ctx.rows.item`, `ctx.rows.feat`: S2.1, S3.1, S4.3).
- `src/game/travel/switch.ts` (F6; kept by F11) is today's page-reload shard switch: `requestShard(slug, { enter |
  explore | arena })`, with the arena arrival in the `session` key `shardArrival.arena` (F10's name for
  `ws.shardArrival.arena`).
- 01 §20 names the three parts. No earlier row builds them.

**Steps**
1. **The `travels` flag** (decision 75). The item row type in `#game` (`ItemRow`, `src/game/bag/items.ts`, the rows
   `ctx.rows.item` takes; today's `ITEMS` entries in `game/Inventory.ts:33` are its first rows) gains
   `travels?: boolean`. `ctx.rows.item` stores it as `false` when it is absent, so every registered row has it. No row
   sets it `true` in this plan: the flag is the door, not a feature. No Bag UI changes.
2. **The travel type and its page-reload implementation** (decision 59; 01 §20). `src/game/travel/travel.ts`
   replaces `switch.ts`:
   ```ts
   export interface TravelRequest { to: ShardSlug; mode: 'enter' | 'explore' | 'arena'; arrive?: SpawnPose }
   export interface TravelHandoff {
     v: 1; from: ShardSlug | null; to: ShardSlug; mode: TravelRequest['mode'];
     arrive: SpawnPose | null;                                   // null = the manifest's spawn
     carry: readonly { id: ItemId; count: number }[];            // only rows with travels: true (none today)
     at: number;                                                 // Date.now() when written
   }
   export function travel(req: TravelRequest): void;            // the only implementation today: a page reload
   ```
   - `travel()` builds the hand-off (`from` = `game.shard?.slug ?? null`; `carry` = the running shard's inventory lines
     whose row has `travels: true`, removed from that shard's inventory in the same write). It stores it in the
     `session` key `travel.handoff` (per tab, 01 §9), calls `setTitleArrival` as today, and navigates exactly as
     `requestShard` does today: the same URL built from the `chunk` harness param, with the same params stripped.
   - On the next boot, `#game`'s `level.data` stage reads `travel.handoff` and deletes it at once. A hand-off whose
     `to` isn't the booting shard, or that is more than 60 s old, is dropped. `mode` does what today's
     `consumeArenaArrival` and the title arrival do; `arrive` replaces the manifest `spawn` for this boot; `carry` is
     added to the arriving shard's inventory through the Bag (`#game`), per shard (decisions 74, 77).
   - The callers move to `travel()`: the title deck's ENTER / EXPLORE / practice buttons (`src/engine/ui/HUD.ts` today) and
     the shard-complete card's next-shard button (`game/quest/Complete.ts`, reading `manifest.next`). `requestShard`,
     `consumeArenaArrival` and the `shardArrival.arena` key are deleted; `test/parity/renames/X9.json` maps
     `session:shardArrival.arena` → `session:travel.handoff` for the `saves` field.
3. **The read-only Wildshard summary** (decision 76: "completion per shard on the title deck, total feats").
   `src/game/summary.ts` keeps the `global` key `summary` = `{ v: 1, shards: { <slug>: { earned, total, playS, at } } }`:
   - When a shard loads, and whenever a feat is earned, `#game` writes that shard's line: `earned` = its earned feat
     count from its `progress` key; `total` = the number of feat rows the plugin registered; `playS` = `progress`'s time
     played.
   - **Built from the per-shard saves:** when `summary` is missing (the first boot after X9, or after an import), the
     title deck rebuilds `earned` and `playS` for every shard by reading that shard's `progress` key read-only
     (`SaveSlot.read(slug)`: its document only, never its code), with `total` unknown until the shard is next played.
     A shard document that fails its schema reads as "not visited" (F10's aside rule), and the summary never throws.
   - **The UI:** a read-only strip on the title deck (`src/game/titleDeck.ts`) under the cards: one line per shard in
     deck order, "<name> · <earned> / <total> FEATS" (or "<earned> FEATS" while `total` is unknown, "NOT VISITED" when
     the shard has no document), and the total "WILDSHARD · <Σ earned> FEATS". It has no buttons, and its strings come
     from `#game`'s string table. It stays hidden while every shard is "not visited".
   - **Its look is Jake's pick:** before it ships, two variants (A / B, iPhone portrait, a mockup from a live capture
     of the title deck) go on the **Look** board (12 §6). The picked one is built; the other is not.

**Tests**
- Node:
  - every row `ctx.rows.item` registers has `travels === false` unless set;
  - the hand-off round trip: `travel()` writes it; a fake next boot of the target reads it and deletes it; a stale or
    wrong-slug hand-off is dropped; an inventory line whose row `travels` is carried, and one whose row doesn't is not;
  - `buildSummary` on fixture documents (two shards played, one never visited) gives the known lines and Σ; a missing
    `summary` key is rebuilt from the `progress` keys; a corrupt shard document reads as "not visited" with no throw.
- Harness: title → enter on every shard, the Explore arrival and Nine Dragon's practice arrival are identical under
  `test/parity/renames/X9.json`. The title deck's DOM hash is re-baselined once, on the Look board's OK.

**Board:** Look (the summary strip, A / B).

**Done when**
- `grep -rn "requestShard\|consumeArenaArrival\|shardArrival" src` prints nothing; every shard switch goes through
  `travel()`.
- Every registered item row has `travels` (all `false`).
- The title deck shows the picked summary strip, and the `summary` key is `global` (exported and imported with the
  save).
- Parity is green, with X9's rename map.
