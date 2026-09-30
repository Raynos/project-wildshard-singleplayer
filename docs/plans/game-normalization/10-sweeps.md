# GAME-NORMALIZATION v2 · 10 — The sweeps (X1–X8)

The X rows collect the engine work that no single shard phase owns. A shard phase may pull a part earlier when it
needs it. For example, S1.4 builds the input service and the `grapple` context, so X1 starts from there.

Each row lists:
- what exists after the shard phases, and what it takes over;
- the steps;
- the tests;
- done-when (measurable);
- the board, if any.

The interfaces are in [01-architecture.md](01-architecture.md). Counts come from
[engine-internals-audit](../../design/engine-fit-v2/engine-internals-audit.md) as of `b3b43536`, and are re-counted
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
2. Delete what the actions replace: the 7 `inputAllowed()` copies (a weapon reads `input.held('attack')` only while its
   context is on top), the fake `KeyE` from the touch USE button (`TouchControls.ts:398`), and the 20
   enable / disable / pointer-lock sites in `main.ts`. The UI layer stack pushes `menu` (X2), so weapons stop firing
   under a menu without a flag.
3. **TouchControls draws the top context's discs from its table** (EI11). The weapon-id sets go and become each
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
   - both are per-shard overridable via `manifest.fight.input = { bufferMs, coyoteMs }`;
   - defaults on for all shards.
   The Sword's combo queue (`Sword.ts:481,564`) becomes `input.consume('attack')` inside the Melee family, with the
   same `CHAIN_LAG` 0.02 s. The harness's scripted combo must stay identical.
7. **A dev overlay** (a Debug row under Developer tools): the live context stack and the last 20 actions.
8. **The hoverboard becomes a kit Tool** (13-lead-resolutions 09#7; 09 §1.7 T2): `src/player/Hoverboard.ts` (the board
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
   - the minimap palettes (`Minimap.ts:104,335,515-517`) go to `manifest.map.palette`;
   - the respawn text (`HurtArc.ts:89-90`) goes to the shard's string table;
   - the gated debug rows (`debugOptions.ts:68-69`, 9 of 15) go to plugins' `ctx.debugRow`;
   - RideHUD goes to Nalati's folder;
   - `compendium/shards/pine-hollow.ts` goes to Pine's folder;
   - `Loading.ts:45` becomes manifest boot data.
6. The ~10 hand-kept gates on `weapons.setEnabled` / `game.frameGate` follow the layer stack.

**Tests**
- Node (jsdom): the layer stack (push, pop, back, only the top gets input), Bag tab registration, fragment order.
- Harness: the HUD DOM hash per shard is identical. Layers change structure, not look, so the hash is re-baselined
  once, with a pixel diff within noise as the proof.

**Board:** none expected (no visual change). If any pixel pose differs beyond noise, it goes on the input / HUD board.

**Done when**
- `wildshard/no-raw-hud` = 0.
- No overlay owns an Escape handler.
- `src/ui/**` holds no shard name.
- Parity is green.

## X3 — Boot and assets from the manifest (EI3, EI4, TP9, MW13, MW17; DEPLOYMENT_ASSET_TRIM T3, TP17)

**Starting point.** Each shard phase moved its own `boot` data into its manifest. X3 deletes what is left of the shard
branches in `src/engine/boot/` and adds the checks.

**Steps**
1. **The stages** (01 §8) replace `STEP_INFO`'s 16 fixed keys. The loading bar's labels and weights come from
   `manifest.boot.steps`.
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
5. **TP17:** `unused-assets` counts `gpu.generated.ts` as a reference, so the 171 MB of shipped KTX2 is no longer
   called "dev-only".
6. (Nine Dragon already joined the boot packs, the prefetch and the every-shard tests in S1.1.)

**Tests**
- The asset audit.
- A node test that every manifest's `boot.files(tier)` resolves.
- The harness's boot fingerprint (the list of packs fetched per shard × tier) is identical, except the Explore precache
  gain on 3 shards (expected, a bug fix).

**Done when**
- 0 shard branches in `src/engine/boot/**`.
- The asset audit is green.
- The Explore offline preload works on 4 shards (an offline boot test in the harness: service worker installed, then
  network off, then Explore opens).

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
| **RNG** | 3 | 1 (01 §2), at F8 |
| **Helpers** | `lin()` ×6, `smoothstep` ×~15, `sstep` ×5, pan-from-yaw ×8 (07 §1 counted 8; 01 §15 says ×6), loop-at-offset ×5, `compassDir` ×2 | one each, in `#engine/math` and `#engine/audio/util` |
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
3. **One `precompile()`** in `#engine/render`. Shards list their materials in `manifest.boot.shaders`.
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
   [budget-design](../../design/engine-fit-v2/budget-design.md). `Perf.ts:36`'s single draw budget and the three
   unrelated phone budgets (110 / 150 / 180 draws) are deleted.
3. **The gate reads the derived numbers** (03-harness-gate). The rollout ceilings live in `lint/ratchet.json` under
   `budgets.<slug>.<tier>`.
4. **The in-game budget readout** (Debug ▸ Performance) shows derived versus measured per pose.

**Tests**
- Node: the formula (a fixture calibration gives known numbers), every manifest's inputs are complete.
- Gate: the budget check per shard × tier.

**Done when**
- No tier knob is named after a shard.
- Every shard has derived budgets.
- The gate enforces them.
- The budget-design doc's "provisional" labels are replaced by calibrated numbers.

## X8 — Session health, analytics, capture, strings (decisions 47, 78–80)

**Steps**
1. **Session health.**
   - A `sessionStorage` + `localStorage` heartbeat (through `#engine/saves`, a `global` key) records the session's
     state every 5 s (shard, stage, fps median).
   - The next boot classifies the last session: clean exit, crash (an error with no clean exit), context loss, or a
     likely OOM (heartbeat stopped mid-play with no error).
   - It posts to `api/` with the build id.
   - `.claude/hooks/session-brief.sh` prints the crash-free-session rate per build (last 3 builds).
2. **Analytics sink.** `#engine/analytics` subscribes to the events in 01 §23 (`death.cause`, `quest.step`,
   `weapon.used`, `shard.time`, `boss.attempt`). It batches every 30 s and on `pagehide` to `api/`, with no personal
   data and a random per-install id. A daily digest goes in the session brief. The `api/` function keeps 30 days.
3. **Capture mode.** `clock.setCapture(fps)` and seeded streams (built at F8). X8 ports `steam-trailer/capture.mjs` and
   the board-clip script onto it and deletes the `performance.now` patch.
4. **Strings.** Every player-facing string still inline in `src/engine/**` moves to `#engine/strings`. Shards moved
   theirs during their phase. A lint rule (`wildshard/no-inline-ui-string`: string literals passed to `toast`,
   `textContent`, `innerText` or a label field) ratchets to 0.

**Tests**
- Node: the session classifier on fixture heartbeats; the sink's batching; the string tables' completeness (every key
  used exists).
- The harness asserts that the analytics requests fire (mocked `api/`).

**Done when**
- The session brief shows the crash-free rate.
- The analytics digest shows at least one day of data.
- Capture uses the engine clock.
- `wildshard/no-inline-ui-string` = 0.
