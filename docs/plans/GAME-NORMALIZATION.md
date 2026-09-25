# Plan: game normalization (E127). One core game, three shard modules on top

**State:** `blocked` 2026-09-25. All of Jake's decisions are in (11 of them) ([§9](#9-decisions-made-2026-09-25)). **Blocked on the Pine Hollow merge, which is in progress.** Nothing here starts until Pine Hollow is on main. After that, Jake starts a new top-level session to build this plan from [§0](#0-start-here-for-the-build-session). The plan was written from three read-only research passes on `main` @ `188fc54`.

## 0. Start here (for the build session)

1. **Check the gate.** `git log --oneline main | grep -i "pine hollow"`: the remaster must be merged and live. If it isn't, stop and tell Jake.
2. **Declare the freeze** (§6): a note in `AGENTS.md` and a line in the session brief saying that only this plan lands on main until it is archived.
3. **Re-count after the merge (step P0).**
   - Re-run the branch inventory (§2) and the duplicate map (§4) on the merged tree. The Pine merge adds ~30 new shard gates in `main.ts`, 6 in `Sky` / `Atmosphere` / `tier` / `Menu` / `manifest`, and a third parallel tree, `src/pinehollow/` (32 files, ~6.5k lines, with its own sound, kit, bosses, day clock, weather and water).
   - Fold the Pine duplicates into the D-groups. For example, `PineDayNight` joins D19, `ForestAmbience` joins D12, and `LeverRifle` / `Longbow` join D1 / D2.
   - Update the numbers in this file.
4. **Build N0**, the golden master, and record its baselines on a clean export of the merged HEAD.
5. **Then N1 → N8 in order.** The dedupe runs in waves W1 → W2 → W3 (§5).
   - The lead session owns the spine files.
   - Up to 3 subagents take dedupe groups on disjoint folders.
   - Every push goes golden green → pathspec commit → `scripts/push-main.sh`.

## 1. Read this first

Jake's words (E127): *"I want one implementation of a thing. I want the three shards to be built on a shared baseline. I want the shards to be standalone things on top of the core gameplay features. I don't want 100s of if statements. This is pure refactor and removing duplicate code and normalizing the shards to share one core game thing."*

**The rules of this plan:**
1. **Pure refactor.** Nothing a player can see, hear or feel changes, on any shard or any tier. Every step is proven identical by the golden master (N0) before it is pushed. A bug found along the way is filed as its own ask and fixed outside this plan.
   - **Two exceptions, both chosen by Jake:**
     - Deleting the flag-only fallback looks (N8). The default looks don't change.
     - Moving Driftwood's Drowned Captain onto the shared `Boss` (wave W2). That one does change the feel, so it goes through a before/after board.
2. **One implementation per thing.** Player, camera, input, health, weapons shell, projectiles, melee, creatures, spawning, bosses, quests, saves, audio engine, HUD, map, post chains, sky rig, day cycle, grass streaming, placement and culling each exist once, in core.
3. **A shard is a module.**
   - Each shard is one folder: `src/chunks/<slug>/def.ts` (data) and `index.ts` (behaviour), which plugs into core extension points.
   - Core never imports a shard's code.
   - The only shard-aware code is the loader.
4. **Zero shard branches outside `src/chunks/`.** No `slug ===`, `style ===`, `ocean`, `LOOK_V2`, `isNalati` or `nalatiNow()?.` in core. What differs per shard is either **data** (a field on the def or profile) or **a strategy** the shard hands to core, never an `if`.
5. **Look stays per shard.** Toon (Driftwood), painterly (Nalati) and PBR (Pine Hollow) stay different. The *logic* is shared; shaders, materials and tables are the shard's data.

**Nothing is built from this plan until Pine Hollow is merged and Jake starts the build session.** Until then no agent builds, "quickly tries" or partly lands a row.

## 2. Where we are (numbers)

| Measure | Today |
|---|---|
| Shard branches outside `src/chunks/` | **~240 sites in 43 files**, plus ~50 more in `main.ts` that are only guarded by `nalatiNow()?.` / `isOcean ? … : null`. The 09-24 audit's "158" undercounted `main.ts` |
| Top files | `main.ts` 53 direct (~103 with handle-gated) · `Sky.ts` 20 · `Terrain.ts` 10 · `Audio.ts` 9 · `AnimalManager.ts` 9 · `Minimap.ts` 9 · `AnimalFactory.ts` 8 · `GrassField.ts` 8 · `boot/extras.ts` 8 · `Game.ts` 7 |
| Core imports shard code | `Game.ts`, `Terrain.ts`, `Grass.ts`, `Horizon.ts`, `Minimap.ts`, `Elite.ts`, `Wildlife.ts` and `Enemies.ts` import Nalati or Driftwood files. 20 files outside `nalati/` import from it. 36 files outside `src/chunks` import a specific shard def |
| Shard identity re-encoded | ~9 secondary flags stand in for "which shard": Music `Shard`, `AmbientBed`, `AnimalStyle`, Hands `Style`, `meleeShard`, `isStylized()`, `isPaintedAir()`, `isPainterlyGrass()`, `LOOK_V2`. Three of them are module-level mutable globals (`setLowPoly`, GrassField's `let nalati`, Atmosphere's `painted`) |
| How shards plug in | Driftwood: 18–22 builders inline in `main.ts` (`isOcean ? new X : null`, lines 160–283). Nalati: `wireNalati()` plus ~25 `nalatiNow()?.x.bind` calls reaching back into `main.ts`. Pine Hollow: whatever runs when nothing else matches |
| Wiring | `main.ts` is one 829-line closure with ~60 locals. ~35 single-listener hook fields (last writer wins, so shard behaviour is merged by hand in `main.ts`), ~35 hand-ordered `.update()` calls, and ~30 `window.__*` globals |
| Duplicate logic | **~3,000–3,400 lines** can be deleted by merging, with no look change. **~1,000 more** if flag-only fallback looks go (Q2). **~1,500–2,000 lines move** out of shared folders into shard folders |
| Bundle | all three shards (defs, terrain, code) ship in one `main.js` (931 KB gz) |
| Pine Hollow worktree | 140 commits ahead: +20.6k lines, 152 `src/` files. It adds **a third parallel tree**: `src/pinehollow/` (32 files, ~6.5k lines), 7 `install*` calls and ~30 new gates in `main.ts`. `git merge-tree` against main is **clean today (0 conflicts)** |
| Safety net for a refactor | none that runs `main.ts` or `bootstrap()`. Only vitest runs in CI, and the browser scripts are manual. 141 unseeded `Math.random` and 112 `performance.now` calls |

## 3. Target architecture

### 3.1 Layout

```
src/core/                 engine: Game loop, SystemRegistry, GameEvents, render pipeline, tier, physics glue
src/game/                 gameplay core: PlayerVitals, Weapons + ViewmodelShell, Projectiles, MeleeCore,
                          Spawner, Boss/Elite/BossEncounter, quest runtime, saves (shardStore), Inventory, Progress
src/world/                world core: SkyRig, DayCycle, TerrainPainter, CellWindow grass, PanoramaBand, placement,
                          culling, fog/wind/water interfaces, registry
src/audio/core/           audio engine, ZonedAmbience, ScoreSource, ShardSoundKit interface
src/ui/                   HUD (widget slots), Menu, Minimap (MinimapPainter strategy), map, touch
src/chunks/registry.ts    CHUNKS (all defs) + SHARDS (the modules, static imports: one bundle, Jake's pick)
src/chunks/<slug>/def.ts  node-safe data (bakers import it) — today's ChunkDef, moved as is
src/chunks/<slug>/index.ts   the ShardModule (browser only, code-split)
src/chunks/<slug>/**      everything only that shard uses (Driftwood's builders, src/nalati/**, src/pinehollow/**)
```

A **boundary check** (a small script like `check-css.mjs`, wired into the pre-push gate) fails when:
- anything outside `src/chunks/<slug>/` imports from it (dev scenes excepted);
- any core file contains a shard branch pattern.

### 3.2 The shard module (TypeScript sketch)

```ts
// src/core/shard.ts
export type BuildSlot = 'edge' | 'grass' | 'cabins' | 'props' | 'animals';   // the existing boot-plan steps
export interface ShardModule {
  def: ChunkDef;                                    // node-safe data
  profile: ShardProfile;                            // replaces every style/ocean/slug branch in core
  build: Partial<Record<BuildSlot, (ctx: ShardContext, p: StepProgress) => Promise<void> | void>>;
  kit(ctx: ShardContext, targets: Targets): WeaponKit;
  fauna?: FaunaLayer;                               // Driftwood Enemies, Nalati Wildlife, on top of AnimalManager
  quest?: QuestPack;                                // today's installAdventure / installNalatiAdventure / installPine*
  explore?: { models(ctx: ShardContext): void; hide(): Object3D[]; overhead(): Object3D[] };
  play?(ctx: PlayContext): void | Promise<void>;    // subscribe to events, add systems + HUD widgets
}
export interface ShardProfile {
  look: LookProfile;     // terrain painter, sky backdrop, post chain factory, fog model, grass driver, panorama,
                         // day-cycle rig, water body, hands style, creature style, aoColor, webgpu
  audio: AudioProfile;   // ambience profile, score source, boot audio slots, sound kit
  hud: HudProfile;       // widget layout, minimap painter, menu extras, respawn line
  combat: { melee: boolean };
  boot: { files(tier): string[]; steps?: ShardSteps };   // replaces manifest/prefetch/extras guessing from style
}
```

### 3.3 Core services the shard plugs into

| Service | Replaces |
|---|---|
| `SystemRegistry`: `add({ id, phase, run })` with phases `input · fixed.pre/step/post · update · late` | the flat `onUpdate` list, the ~35 hand-ordered calls in `main.ts:721-796`, Nalati's private updater list. Registration order is kept exactly |
| `GameEvents`: typed, many listeners per event, `claim()` for the first handler that wins | the ~35 single-listener fields (`weapons.onFire`, `animals.onKill`, `player.onStep` …) merged by hand in `main.ts` |
| `PlayerVitals.hurt(dmg, cause)` + a death-handler chain | 5 hand-written damage blocks and the `boss/titan.onPlayerDeath()` chain in `main.ts` |
| `Services { audio, music, hud, menu, weapons, animals, inventory, progress, interactables, vitals, clock, registry, physics }` | the 60 closure locals. `window.__world` is built from it **with the same key names** (27 scripts read it) |
| `saves.shard(id).store(key)` / `shardStore<T>(key, chunkId, defaults)` | 10 stores each hand-rolling `JSON.parse(localStorage)`. **Keys and JSON shapes stay identical** so every existing save survives |
| `profile.look.composer(game)`: core chain functions in `src/core/post/` (clean + LUT, cinematic, painterly); look-v2 passed in by Nalati | the 4 chains inline in `Game.ts` and its `nalati/look` imports |

### 3.4 What `main.ts` becomes (~120–150 lines, from 829)

```ts
async function main() {
  const def = getActiveChunk(), shardP = loadShard(def.slug);   // the module downloads while renderer/sky build
  const boot = startBoot(def);
  const world = await bootstrap(boot.step), shard = await shardP;
  const ctx = createShardContext(world, shard);
  for (const s of BUILD_SLOTS) await boot.step(s, (p) => shard.build[s]?.(ctx, p) ?? coreSlot(ctx, s, p));
  const kit = await boot.step('weapon', () => createPlayerKit(ctx, shard));
  const services = createServices(ctx, kit, shard.profile);
  wireCoreDefaults(services); shard.quest?.install(ctx); await shard.play?.(ctx);
  installFlow(ctx, services); ctx.systems.add(coreFrame(services));
  await finishBoot(ctx, boot, services);          // composer, shaders, first frame, audio, start, __world
}
```

### 3.5 Each shard as a module

| Shard | `build` | `play` / plugins | Unique features and the core hook each uses |
|---|---|---|---|
| **Driftwood** | `edge` = today's `main.ts:160-283` (pier, boat, hut, lookout, wreck, shrine, cove, bridge, palms, bushes, gulls, seabed, ocean, BlenderIsland, matte, RopeChain) | iron-sword pickup, IslandSfx, IslandAmbience, ShrineHum, underwater, Enemies (crabs, monkeys, sailor), the Captain | zipline / bridge / boat → `build` + `registry.add`; shrine hum → generic point hum + music duck; hoverboard stays in `Player` (shared by all) |
| **Nalati** | `props` = `wireNalati` | its six `bind` calls become event subscriptions; weather, stealth, kokpar, ride, Wildlife, elites, bosses | ride / taming → `Player.ride` + `Weapons.setMount()`; stealth → `Player.crouchGate` + `KitWeapon.damageMultiplier` + aim filter; bosses → `BossEncounter`; weather → `DayCycle` listener + `PlayerVitals` |
| **Pine Hollow** | `grass` / `cabins` / `props` | rifle pickup; the remaster's seven `install*` calls (Combat, Quest, Weather, Loadout, Life, Audio, Landmarks) → one `play()` | `PineDayNight` → `DayCycle` rig; `ForestAmbience` → `AmbienceProfile`; LeverRifle / Longbow → `ViewmodelShell` + `FeelTuning` |

## 4. The duplicates, merged (one implementation each)

Line counts are estimates from reading the code. "Risk" means risk to look or feel, which the golden master must catch.

| # | Group | Today | One core implementation + per-shard part | Lines deleted | Risk | Effort |
|---|---|---|---|---|---|---|
| D1 | **First-person weapon shell** | look-lag spring ×5, sway/bob, holster, `fovForAspect` ×3, draw-on-top mesh ×7, input/pointer-lock ×5, `aimRay` ×4, aim raycast ×4 across Sword, Spear, Bow, Crossbow, Rifle (+ Pine's LeverRifle, Longbow) | `player/viewmodel/ViewmodelShell` + a `FeelTuning` data table per weapon, every number copied exactly | 250–300 | feel | M |
| D2 | **Projectile flight** | `Crossbow.ts:1114-1230`, `Projectiles.ts:169-419`, Spear javelins `405-495` | `Projectiles` with `ProjectileKind` options (tracer, head offset, water, stagger). Trajectory snapshot test first | ~170 | feel | M |
| D3 | **Melee** | Spear re-implements Sword's windup→active→recover clock and damage. `Sword.strike` hard-codes Driftwood's crab/sailor debris | `MeleeCore` driven by `Move` data (`sweep \| fan`) + a per-shard impact-FX table | ~80 | feel | M |
| D4 | Aim-down-sights | Crossbow / Rifle `solveAds`, FOV lerp, pose blend | `AdsRig` | ~80 | feel | M |
| D5 | Weapon interfaces + kit choice | `Weapon.ts` vs `KitWeapon` + an `instanceof Crossbow` adapter; `MountState` ×2; kit picked by slug; weapon-id sets in `TouchControls` / `Menu` | one `KitWeapon`; `chunks/kits.ts` registry (menu name, touch layout, melee flag, sfx) | ~140 | low | S–M |
| D6 | **Enemy strike timing** | windup→hit→cooldown hand-written in crab, sailor, monkey, balbal, captain, elites, 6× in kurganBoss | `entities/ai/strike.ts` + `StrikeSpec` data (exact timings) | ~60 | feel | M |
| D7 | Boss wiring | `KurganBoss.bind` ≈ `StormTitan.bind`; `retire(animal)` ×4 | `BossEncounter` + `AnimalManager.retire` | ~160 | low | S |
| D8 | Spawning | respawn rules ×4 (Ecology queue, elite timers, ghosts, balbals); Nalati uses `fauna: []` + its own Wildlife | `game/Spawner` + `SpawnRule` data; `ChunkDef.wildlife` | ~60 | low | M |
| D9 | NPC idle | Castaway ≈ campPeople head-look / breathe / gesture, identical constants | `NpcRig` + idle hooks | ~50 | low | S |
| D10 | Quest runtime | `Spine.ts:53-75` ≈ `nalati/adventure.ts:137-222` | `installQuestRuntime(QuestPack)` | ~90 | low | M |
| D11 | FX pools, telegraphs | `NightParticles` ≈ Enemies droplets; balbal `Wedge` ≈ `GroundTell` | `fx/ParticlePool`; a `'wedge'` GroundTell shape | ~90 | pixel | S |
| D12 | **Zoned ambience** | `IslandAmbience` 388 ≈ `SteppeAmbience` 187 ≈ the synth beds in `Audio.ts:1301-1535` (+ Pine's `ForestAmbience`) | `audio/core/ZonedAmbience` + `AmbienceProfile` (each keeps its fade / hold / mix constants) | ~200 | sound | L |
| D13 | Music source | `SteppeScore` ≈ `Stems`; steppe special cases ×5 in `Music.ts`; shard→slot mapping ×4 | `ScoreSource` strategy + `MusicProfile` | ~85 | low | M |
| D14 | SFX routing + audio helpers | `IslandSfx` vs `nalati/sound` vs `main.ts:466-477,587`; smoothstep ×3, pan-from-yaw ×5, loop-at-offset ×5, cancel-hold ×4; listener set twice per frame on Driftwood | `ShardSoundKit` interface + one helper module; `Audio.ts` (1,540) split into ~300 core + per-shard voice tables | ~110 | sound | M |
| D15 | **Grass streaming** | cell window `Grass.ts:269-322` ≈ `GrassPainterly.ts:417-462`; trample/wind update copied between painterly and look-v2 grass | `vegetation/CellWindow` + `GrassDriver`; blade shaders stay per shard | ~150 | low | M |
| D16 | Model kit + AO | `lowpolyKit` ≈ `nalati/paint` (`bakeAO` ≈ `bakeSmoothAO`) | `GeometryKit` + `voxelAO(params)` | ~200 | look | M |
| D17 | Painted panorama | `HorizonMatte` ≈ `PaintedBackdrop` ≈ `SkyDomeV2` | `PanoramaBand` + per-shard tint chunk | ~150 | look | M |
| D18 | Sky | `Sky.ts` (793) = HDRI + toon + painterly in one class | `SkyRig` (CSM, hemi, sun, planet) + `SkyBackdrop` strategy | ~120 | low | M |
| D19 | Day cycle | `DayNight` ≈ `DayClock` (+ Pine's `PineDayNight`) | `DayCycle` + `LookRig<K>` (keyframes are shard data). **Last**, since `sunAt` must stay exact | ~180 | look | M |
| D20 | Terrain, placement, post, culling, fog, wind, water | grid sampling ×2; `scatterIsland` ×3; god-rays / bloom / SMAA ×2 in `Game.ts`; `CelledInstances` ≈ `DressLayer`; `fog_fragment` patched 3× in implicit order; 3 wind systems; 3 water bodies | `TerrainPainter`, placement primitives (same random draw order), `PostSpec`, one culling class, `installFog(model)`, `WindField`, `WaterBody` | ~390 | low–look | S–M |
| D21 | HUD, skins, saves, small helpers | ammo widget ×3, storm chip ×2 (HUD vs NalatiHUD); `SkinLocker` ≈ `NalatiSkinLocker`; `lin()` ×4; `compassDir` ×2; dead `meleeGeo.ts:156-214` | HUD widget slots + per-shard layout; `shardStore`; one helper each | ~200 | low | S |

**Total: ~3,000–3,400 lines deleted with every look kept**, plus ~1,500–2,000 lines moved into shard folders. The moving is the real payoff: each shard becomes a folder you can read on its own.

## 5. Phases (each row ships on its own, proven by the golden master)

| Row | What | Done when | Effort |
|---|---|---|---|
| **N0** | **Golden master first.** (a) Node test `test/golden-world.test.ts`. Per shard, pin `landscapeHash`, `heightAt` / `splatAt` / `trailDistance` at 1k seeded points, herd layout, `chunkFiles(def)` per tier, `STEP_INFO`, sha256 of `terrain.bin` / `navmesh.bin`; plus `bake-packs --check` and no drift in `src/boot/*.generated.ts`. (b) `scripts/golden.mjs` (Playwright, Metal, muted), 3 shards × desktop + iPhone portrait. Seeded `Math.random`, virtual `performance.now`, a stepped clock (fix the `elapsedTime` drift from `trailer/capture.mjs`), pinned world time. It records: boot fingerprint (errors, `__world` keys, registry pieces, collider count, scene-graph summary, programs, animals, interactables, **length of every Game phase list**, HUD DOM hash); 10 poses from `physics-baseline` + 1 Explore pose (draw calls / triangles exact, pixel diff ≤ ~0.1% with `pixelmatch`); a 20 s scripted run (walk, jump, dodge, fire, swap, swing) logging player state, health, kills, HUD payloads, toasts, music states and **every audio call**, compared exactly. Baselines recorded on a clean export of the pre-refactor HEAD. It runs before every refactor push; red blocks the push | the harness is green twice in a row on unchanged HEAD (proves it's deterministic) and red on a planted one-line change | ~1–1.5 agent-days |
| N1 | **Core services inside `main.ts`:** `GameEvents`, `PlayerVitals`, `Services`, `shardStore`. The ~35 hook fields become events; the 5 damage blocks become `vitals.hurt`; the saves go through `shardStore` (same keys) | golden green; `main.ts` has no hand-merged hook bodies | M |
| N2 | **`SystemRegistry`:** the big updater and Nalati's private list become named systems registered in the same order | golden green (phase-list lengths identical) | M |
| N3 | **Profiles: remove the branches, system by system.** Look (Game post chains, Sky, Terrain, Grass/GrassField, Horizon, Hands, Atmosphere, Ocean) → audio (Audio, Music, preload, extras) → fauna (AnimalFactory, species `setLowPoly` → explicit style argument, AnimalManager `meleeShard`) → HUD / menu / minimap → boot (manifest, prefetch, extras, steps) → Explore. Reverse the core→shard imports | the boundary check passes on each file; golden green | L |
| N4 | **Shard modules:** Nalati first (`wireNalati` is already most of the shape), then Driftwood (lift `main.ts:160-283` + its audio / quest / enemies), then Pine Hollow | `main.ts` ≤ 150 lines, 0 shard branches; golden green | L |
| N5 | **Dedupe D1–D21 (plus Pine's duplicates from P0), in three waves.** Details under the table | each group: one implementation, golden green, and for W2 / W3 Jake's OK on the board | L (spread over lanes) |
| N6 | **Folders:** move all shard-only files into `src/chunks/<slug>/` (Jake: move everything), fix the doc links. **No code split:** it stays one bundle (Jake's pick), with static imports in `registry.ts`. Rebake and prove `terrain.bin` / `navmesh.bin` byte-identical (moving a def changes the bake input hash) | every shard-only file lives under its shard folder; the boundary check is green | M |
| N7 | **Dev scenes (Jake: convert the useful, delete the rest).** List which of the 19 `src/dev/*` harnesses agents still use (git log and script references). Those move onto `bootShard(slug, { slots })`; the rest are deleted | no dev scene rebuilds a shard by hand | S–M |
| N9 | **The gate that stays (Jake's pick).** After the plan, a fast subset of the golden master runs on every push to main: per shard, boot with 0 page errors, a short scripted walk (0 stuck) and a swing, ~2 min in total. It runs on the Mac and is serialised by the push lock. The full golden master (poses, pixel diff, the 20 s run) runs nightly and posts its result to the session brief. This is FINISH-LINE S1 | a regression planted on purpose is caught by the per-push subset | S |
| N8 | *(Jake: yes. Do it early, right after N0, so the later steps carry fewer paths.)* **Delete the flag-only fallback looks:** `?look=v1` (GrassPainterly, PaintedBackdrop, the painterly / Kuwahara chain), `?paintedrange`, `?kuwahara`, `?lighting=standard`, `?sky=hdri`, `?post=cinematic`, `?matte=0`, `?nolut`, `?boat=v1` (this closes E113 with the rebuilt boat, B), and the dead branches (`Enemies.ts:62` non-ocean, `Ocean.ts` non-stylized). `reseedPainterlyGrass` moves to v2 first (`nalati/index.ts` calls it). The default looks are untouched | the flags are gone; golden green on the defaults | S–M |

**The dedupe waves (N5).** Every wave uses the same golden master.

- **W1, low risk (no change to look or feel).** Groups: D5 weapon interfaces + kit registry, D7 BossEncounter + retire, D8 Spawner, D9 NpcRig, D10 quest runtime, D13 music source, D18 sky rig, D20 terrain, placement, post, culling, fog, wind and water, and D21 HUD slots, skins, saves and helpers.
  - Ships as soon as the golden master is green.
- **W2, feel and sound (interactive).** Groups: D1 ViewmodelShell, D2 projectiles, D3 MeleeCore, D4 AdsRig, D6 enemy strike timing, D11 FX pools and telegraphs, D12 zoned ambience, D14 sound kit and the `Audio.ts` split, and **the Captain onto the shared `Boss`**.
  - Each group gets a snapshot or trajectory test first.
  - Before it ships, the lead sends Jake a **before/after board**: iPhone portrait, labelled, plus a short clip for anything that moves or sounds.
  - It ships once Jake says OK in chat.
- **W3, look (interactive, last).** Groups: D16 geometry kit + AO, D17 panorama band, D19 day cycle.
  - Same board-then-ship as W2.
  - The day cycle goes last, because `sunAt` must stay exact.

**Definition of done for the whole plan:**
- The boundary check reports 0 shard branches and 0 core→shard imports.
- `main.ts` is ≤ 150 lines.
- Every D-group has exactly one implementation.
- Each shard is one folder (one bundle, as Jake picked).
- The golden master is green against the pre-refactor baseline on all 3 shards, on desktop and iPhone.
- `window.__world` keys are unchanged.
- Every save from before the refactor loads.

## 6. How the work runs (lanes and freeze)

**Freeze (Jake's pick: a full feature freeze).** While this plan runs, only its commits land on main.
- No new features, content, Look Lab variants or other plans' rows.
- A bug fix that can't wait is the one exception. It goes through the lead session so it doesn't collide with the wave in flight.
- The freeze ends when the plan is archived.

**Lanes (Jake's pick: a lead plus up to 3 subagents).**
- **The lead (the top-level session)**
  - does N0–N4, N6 and N8;
  - owns the spine files: `main.ts`, `Game.ts`, `bootstrap.ts`, `ChunkDef.ts`, `registry.ts`, `src/core/shard.ts`;
  - sends the W2 / W3 boards to Jake.
- **Up to 3 subagents**, each taking one D-group of the current wave, on disjoint folders. For example: weapons in `src/player/`, audio in `src/audio/`, enemies in `src/entities/`. Each runs the golden master before it hands back.
- **Small commits, each one proven.** Golden green → pathspec commit → `push-main.sh`. A red golden result is reverted, not patched forward.
- **Screenshots and boards are iPhone portrait only** (Jake plays it as a Safari PWA on iOS). The golden master also records desktop, to check correctness.

## 7. Found along the way (asks, not rows here: a pure refactor doesn't fix them)

- The Spear thrust never calls `bladeBlocked`, so it can hit through walls.
- `boot/extras.ts:49,103,124` preloads Explore's art and code only when `def.ocean` is set, so Pine Hollow's and Nalati's Explore are probably missing from the offline preload.
- `ChunkDef.weapon: 'nalati'` is ignored. `main.ts:365` picks the kit by slug.
- `ws.elites.v1` is global, not per shard (fine today, since only Nalati has elites; `shardStore` keeps it global).
- The Drowned Captain skipping `Boss` is no longer only a note: Jake chose to move it onto `Boss` (wave W2, board first).

## 8. Out of scope

- New features, balance or feel changes (FINISH-LINE D-rows, E126 items).
- Visual or feel changes, except the two Jake chose: N8 (deleting the flag-only looks) and the Captain onto `Boss` (W2).
- An engine switch or an ECS rewrite.
- WebGPU work beyond keeping `src/gpu/` compiling on the profile.

## 9. Decisions (made 2026-09-25)

| # | Question | Jake's answer |
|---|---|---|
| 1 | Pine Hollow before or after the refactor? | **Pine first.** It is merging into main now: "we're definitely not going to do any normalization until it merges." |
| 2 | Delete the flag-only fallback looks? | **Yes.** This includes `?boat=v1`, so E113 closes with the rebuilt boat (N8). |
| 3 | How far does the plan go? | **"Multiple waves of dedupe, low risk first, and high risk is more interactive with me but still in the plan."** That is waves W1 → W2 → W3 (§5). |
| 4 | Captain onto the shared `Boss`? | **Yes.** In wave W2, with a before/after board. |
| 5 | How do high-risk waves reach Jake? | **A before/after board, then ship.** iPhone portrait, plus a clip for motion or sound. Jake OKs it in chat, then it goes to main. |
| 6 | Move shard-only code into the shard folders? | **Move everything** into `src/chunks/<slug>/` (N6). |
| 7 | Build lanes? | **Lead + up to 3 subagents** (§6). |
| 8 | Other work on main during the refactor? | **Full feature freeze** (§6). |
| 9 | Does the golden master outlive the refactor? | **A fast subset becomes the permanent gate.** Every push runs ~2 min per shard: boot, 0 errors, a short walk and a swing. The full golden run goes nightly. This is row N9. |
| 10 | The 19 dev harness pages? | **Convert the ones agents still use and delete the rest** (N7). |
| 11 | Split the download per shard? | **No, keep one bundle.** Shard modules are imported statically; `loadShard` just picks one from `SHARDS` (N6). |

**Open:** nothing blocks the start except the Pine Hollow merge. The build session re-counts after the merge (P0) and sends Jake the W2 / W3 boards as it reaches them.
