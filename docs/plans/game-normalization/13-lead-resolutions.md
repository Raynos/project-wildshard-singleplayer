# GAME-NORMALIZATION v2 · 13 — The lead's resolutions

Each spec writer ended its file with "Questions for the lead". This file answers every one of them. Each answer is
applied in the file named in the "Applied in" column, and **those files are the source of truth**: this file is the
record of why.

Questions that were Jake's to decide went to him and are numbered decisions in
[E357](../../tasks/asks/E357.md) (85–90).

## From 09-combat-ai

| # | Question | Resolution | Applied in |
|---|---|---|---|
| 1 | `StrikeSpec` has only a shape name and one range | Per-shape parameters: `StrikeShape` = arc (radius, halfAngle) / lane (length, width) / ring (inner, outer) / wedge (length, halfAngle) / point (radius) | 01 §19 |
| 2 | `EffectDef` can't express hit-dependent rules (hit cap, boar tusk, sneak shot, broadheads, balbal bonuses) | A new row type, `DamageRuleDef` (`when` tags + `op` cap / add / mul / negate / override + `order`), answering `ask('damage.modify')` | 01 §18 |
| 3 | Whetstones, the bear claw and the Golden Bow's draw modify weapons, but effects target actors | Weapons carry their own `AttributeSet`; `EffectService` targets `Actor \| Equipment` | 01 §18 |
| 4 | AI tick rate: today's brains run at 10 Hz everywhere | Jake, decisions 85: three bands (near 0–60 m brain 20 Hz + body every frame; mid 60–160 m brain 10 Hz + body every 2nd frame; far paused), interrupts in every band, bosses / elites / quest actors pinned. Strike phases run on the body clock. **10 Hz until S2.6** (parity), then the switch, on the creatures board | 01 §12 |
| 5 | Horse: kit or Nalati? | **Nalati** (rule of two: its only other user is the horse playground, which is Nalati's) | 01 §21 |
| 6 | Falls don't reset the regen delay | Kept as today (parity); `env.fall` isn't tagged `interruptsRegen` | 09 §3 |
| 7 | The hoverboard fits the Tool contract | A kit Tool (`#kit/tools/`, used on all 4 shards), moved in X1. Its movement mode (`board` context, motor) stays engine | 01 §21, 10 X1 |
| 8 | Big crab: 10 or 14? | Jake, decision 86: **14**. On the creatures board | 09 §5 |
| 9 | `WeightedTable` has no "every row once" mode | `mode: 'weighted' \| 'each'` + `count` | 01 §19 |
| 10 | Pine finishes and Nalati skins have no numbers | Cosmetic `EffectDef` rows with no modifiers, tagged `cosmetic` | 09 §2 |
| 11 | `DamageRequest` has more fields in 09 than in 01 | 01 takes the superset | 01 §18 |
| 12 | The Spear's 5 javelins "with the camp upgrade" are never granted | Jake, decision 87: **keep 3**; the unreachable promise is removed | 09 §1 |

## From 05-nine-dragon / 06-pine-hollow

| # | Question | Resolution | Applied in |
|---|---|---|---|
| 1 | 01 §6 lacks many `ChunkDef` fields; `map` clashes | Every field carried over. Renames: `map` → `minimap`, world placement is `placement`, `gridCoords` → `label`, `fov` → `camera.portraitFov`. Added: `seed`, `biome`, `hud`, `bag`; carried as data: trees, forest, assets, look, horizon, pondClip, pois, spawns (was fauna), faunaTuning, loot, bodyShadow, groundColor, surfaceAt; `ocean` → a WaterBody row; `weapon` → `loadout` | 01 §6 |
| 2 | Boot flag names | `boot.barrier` (all tiers), `boot.phone.deferExtras`, `boot.phone.fragile`, `boot.phone.trace`, `boot.cullBeforeFirstDraw`; `warmTurns` and `textures` are tier knobs | 01 §8 |
| 3 | No HUD verb for screen-positioned world markers | `hud.pin(at, el, scope)` | 01 §11 |
| 4 | Tier precedence | One source: engine default → kit schema default → `manifest.tiers[tier]`. `ShardRender`'s old `slices` / `ao` / `aa` move to `manifest.tiers` | 01 §13 |
| 5 | Debug handles (`__ndRender`, `__pine*`, `__titan` …) | `ctx.debug.expose(name, value)` → `window.__wildshard.shard[name]` | 01 §7 |
| 6 | S1.5 builds the first slice of the audio engine | Yes. S1.5 builds score sources, ambience beds and cue maps; S3.5 continues from it (the voice engine, ambience zones, merged SFX routing, the `Audio.ts` split) | index S1.5 / S3.5 |
| 7 | Nine Dragon has no load-time cap | Its F2 baseline, rounded up, shown on the M1 summary for Jake to confirm | 05 S1.6 |
| 8 | Budget file names differ between docs | 01 wins: `budgets/calibration.json`, `src/engine/render/budgets.ts` | 01 §13.4 |
| 9 | Does F6 leave the old hook fields on the manifest? | Yes. Each shard's phase moves its hooks into its plugin, and the type drops them after S4.1 | 01 §6, 02 F6 |
| 10 | `PINE_HOLLOW_PHONE`: S2.1 or X7? | S2.1 deletes it; X7 deletes whatever shard-named knobs are left | 10 X7 |
| 11 | Weather FX in the kit | Only the rain curtain (shared). Puddles stay per shard (two techniques); lightning is Nalati's | 01 §21 |
| 12 | Debug option keys like `pineScore` put a shard name in the engine | A shard declares its own keys through `ctx.debugRow`; AGENTS.md's Settings.ts rule is rewritten in Z2 | 11 Z2 |
| 13 | S2.4 also swaps Driftwood's and Nalati's clocks and Nalati's storm | Yes: one implementation at once, parity identical on all three shards | 06 S2.4 |
| 14 | No row merges the NPC rigs | `#kit/npc` is seeded from Pine's rig in S2.5; Nalati's campPeople join in S3.3, and Driftwood's Castaway / Trader in S4.3 | 01 §21, index |
| 15 | S2.6 also slows Driftwood's far boars and bears | Yes; the M2 creatures board shows it | 06 S2.6 |

## From 02-foundations / 03-harness-gate

| # | Question | Resolution | Applied in |
|---|---|---|---|
| 1 | 11 `ChunkDef` fields without a home; the `ground` union; the `style` values | See the 05 / 06 answers above. `ground: { terrain?; structures? }` (at least one); `style: 'toon' \| 'painterly' \| 'pbr' \| 'jiehua' \| 'greybox'` (F6 maps `lowpoly` → `toon`) | 01 §6 |
| 2 | 26 keys are machine-local or per-tab; `index.html` reads 3 keys before boot; `ws.ota.*` must never be reset | Scopes `device` (never exported or reset) and `session`. Never reset: device / session keys, `ws.ota.*`, and the 3 pre-boot keys (device keys with a tiny reader in `index.html`) | 01 §9 |
| 3 | Decision 46 keeps 182 of 185 scripts | Jake, decision 88: one-offs of finished asks go, **and any script not run in the last 5 days goes**, unless package.json, a hook, CI, a skill or a doc references it | 02 F7 |
| 4 | F11 can't remove the `addEventListener` patch (396 listeners depend on it) | Kept, counted by `wildshard/no-global-listener-patch`, and removed when X1 / X2 move the last listeners onto scopes | 01 §24, index F11 |
| 5 | Kit folder empty at F6; no row for `#kit/npc`; no owner for the 136 `getActiveChunk()` calls; nobody makes Nine Dragon a full shard; F7 runs before F6 | The kit starts empty (it fills as rows move content in). `#kit/npc`: see 05/06 #14. `getActiveChunk()`: the `wildshard/no-active-chunk` ratchet from F8, lowered by every shard phase, 0 at S4.4. **Nine Dragon becomes a full shard in S1.1** (boot packs, prefetch, the every-shard tests; this moves out of X3). The order is **F0 → F3.1 → F1 → F2 → F3.2 → F4 → F5 → F7 → F6 → F8 → F9 → F10 → F11 → F12** | index §4, 01 §24 |
| 6 | No plugin verb for putting shard handles on the probe | `ctx.debug.expose` | 01 §7 |
| 7 | Gate coverage: Nine Dragon has no creatures; Pine has no melee weapon; the runner is phone-tier only; loot | **Nine Dragon:** the gate kills a practice-arena dummy. **Pine:** the swing check runs only where the loadout has melee (the shot check covers Pine). **Tiers:** the runner covers phone; the desktop tier runs in the nightly on Jake's Mac. **Loot:** checked as the save keys written after a kill | 03 |
| 8 | The pin also covers `ota-promote.yml`; the first pin; a GitHub token for the nightly; Rapier +413 KB | **Pin:** yes, it covers `ota-promote.yml`, and the first pin is the build live when F3.1 lands. **Token:** none needed; the nightly posts statuses with the Mac's existing `gh` login (`gh api`). **Rapier:** Jake accepts the +413 KB (decision 89) | 03, 02 F12 |

## From 07-nalati / 08-driftwood

| # | Question | Resolution | Applied in |
|---|---|---|---|
| 1 | Manifest fields not in 01 §6; a reader for the harness URL params | Every carried-over field is on the manifest (see 05 / 06 #1). `app.params` is the only URL-param reader (the `harness` allowlist) | 01 §5, §6 |
| 2 | `ShardRender` needs chain replacement, lighting, shadows, fog suspend / resume and backdrop apply | Added: `mode: 'extend' \| 'replace'`, `lighting`, `shadows`, `fogControl`, `backdrop.apply` | 01 §13.1 |
| 3 | An engine wind the Bow family and grass read? | Yes: one `WindField` (`app.world.wind`) with per-shard `manifest.wind` data. Nalati's `steppeWind.ts` and `world/wind.ts` merge into it | 01 §17 |
| 4 | The horse in Nalati vs 01 §21 / 09 | Nalati. 01 §21 is updated; 09's species table follows | 01 §21, 09 §5 |
| 5 | S3.5 edits Pine's and Nine Dragon's audio | In scope: one implementation at once, parity identical on those shards | 07 S3.5 |
| 6 | Park Driftwood's island audio in `legacyIsland.ts` from S3.5 to S4.3? | Yes; S4.3 moves it into Driftwood's folder and deletes the park | 07 S3.5, 08 S4.3 |
| 7 | `WaterBody` early for the sea in S4.1? | Yes: S4.1 builds the interface and the sea on it; X5 converts the other bodies | 01 §17 |
| 8 | Can a shard declare its own tier knobs? | Yes: `ctx.tiers.knobs(schema)` | 01 §7 |
| 9 | The Captain's boss bar keeps its own look (two bar looks)? | Jake, decision 91: **the shared BossBar**; a small Driftwood look change, on the look board in S4.2 | 08 S4.2, 12 §6 |
| 10 | `rockKit.ts`: Driftwood or engine until X5? | Wherever 04's import analysis puts it by the rule of two (kit if `GroundCover` serves another shard, otherwise Driftwood). X5 lifts its generic primitives into the engine geometry toolkit | 04, 10 X5 |
| 11 | The native shell's `ws:ready` DOM event | It stays (it's the native shell's contract), dispatched once on reaching `title`; the probe also exposes `ready` | 01 §5 |

## From 04-move-map

| # | Question / departure | Resolution | Applied in |
|---|---|---|---|
| 1 | The horse: Nalati, against the old 01 §21 / 09 / the index | **Nalati** (matches 09 #5). A kit horse would also drag ~2k lines of Nalati wildlife AI into the kit | 01 §21, 09, index (consistency pass) |
| 2 | One map: 02's classifier writes `scripts/normalize/move-map.json`; 04 made the reviewed `docs/plans/game-normalization/move-map.json` the input | **The reviewed JSON is the codemod's only input**. The classifier re-derives it and fails on a diff (a check, not a writer) | 02 F6 |
| 3 | `LeverRifle.ts`: kit (06) or Pine (09)? | **Pine** (rule of two: only Pine uses it). It becomes a Firearm-family subclass in Pine's folder; the Firearm family (`Rifle`) is kit | 06 S2.2, 09 §1 |
| 4 | `Grass.ts`: S2.1 or S3.1? | **S3.1**, the later of the two, because Nalati's painterly branch leaves last | 06, 07 |
| 5 | F6 re-stamps the bakers' `hash` fields once, so Pine Hollow's 2.7 MB phone-pack part re-downloads once *(the re-stamp moved to F1 by R3-07; F6 re-stamps nothing, R4-02)* | **Accepted:** a one-time 2.7 MB for Pine phone players at M1's deploy, stated in the M1 summary (decision 1's "don't move public/assets" is about re-downloading everything; this is one part) | 04, 12 §7 |
| 6 | Tests moving at F6: 34 (04) vs 28 (02) | **34**: the map moves a test when the code it tests is a shard's | 02 F6 |
| 7 | 7 images under src/ that no code references | **Deleted at F7**, listed in 02 F7 | 02 F7 |
| 8 | `fauna-layout.ts` and `models/slots.ts`: engine (04) or shard (02's classifier)? | **04's analysis wins** (the map is the reviewed source); the classifier is corrected to agree | 02 F6 |
| 9 | `src/kit/` empty at F6 (02) vs 5 files (04) | **04:** the 5 files that already have 2+ shard users go to the kit at F6 | 02 F6 |
| 10 | Nalati species at F6 (02) vs waiting for their rows (04) | **04:** species files wait for S2.3 / S3.4 / S4.2 (`AnimalFactory.ts:15` loads them through one folder-wide import) | 02 F6 |
| 11 | The title deck and `switch.ts`: engine or `#game`? | **`#game`** (a Wildshard idea) | 01 §20 |
| 12 | `main.ts`: `src/engine/main.ts` at F6 (02) or `src/main.ts` until S4.4 (05)? | **Neither.** `src/main.ts` stays at the root permanently as the **composition root**: the one file that imports `#engine`, `#game` and the generated shard registry and starts the app. It sits outside the layers (the engine may not import `#game`). ≤ 20 lines at S4.4; the generic boot is `engine/boot.ts` (≤ 150) | 01 §0, 02 F6, 08 S4.4 |

## Still-open spec questions (05 §10, 07 §10, 08 §10)

| # | Question | Resolution | Applied in |
|---|---|---|---|
| 05#1 / 07#1 / 08#1 | Manifest sub-fields 01 §6 doesn't declare | All are **declared manifest fields** (01 §6 "Declared sub-fields"): `kitLook`, `bag.pack.slots`, `bag.skinsTitle`, `dev.poses`, `loadout.held`, `loadout.loans`, `loadout.grants[].replaces`, `loadout.viewmodel`, `minimap.palette`, `minimap.markers`, `audio.alertOnlyHostile`, `ground.paths: 'plugin'`, `water.sea`, `spawn.floor`, `respawn.spawnPlace`, `horizon.kind`, `world.blenderArea`, `world.blenderModels`, `swimArms`, `next`, `spawnTables`, `fight.quietPromptInFight` | 01 §6 |
| 05#1 | `kitLook` | The look the shared kit pieces render in (creatures, the swim hands, the Explore catalog): `'toon' \| 'painterly' \| 'pbr'`. It defaults to `style` when the kit supports that style, otherwise `'pbr'`. It replaces `style ?? 'pbr'` at `main.ts:505`, `Explore.ts:269`, `AnimalManager.ts:459` and `Hands.ts` | 01 §6 |
| 05#7 / 07#8 / 08#8 | Dead files `world/hero/paifang.ts` (267), `world/spruceMask.ts` (79), `world/interact/validate.ts` (67) | All three go in **F7's one dead list** (not in S1.1 / S3.1), so every deletion of dead code is in one reviewed row | 02 F7, 05, 07, 08 |
| 07#9 | Nalati's crouch toggle and grass gate | **Superseded by R1-F9 / R2-08:** `ask('player.crouch', { want, via: 'toggle' \| 'hold' }) → { allowed, latched }`. (The original shape, `ask('player.crouch', { want }) → { allowed, toggle }`, is retired.) The engine owns the `crouch` action; Nalati's stealth answers the ask | 01 §10 |
| 07#10 | A shard registers its style's creature material factory | `ctx.rows.creatureLook(kitLook, factory)`: a kit species asks the registry for its material by `kitLook` | 01 §7, §19 |
| 08#2 | How a compose returns the chain | `ShardComposition` = today's five pass slots for `'extend'`, or `{ chain: Pass[] }` for `'replace'` (the whole chain, in order) | 01 §13.1 |
| 08#6 | `boss.attempt` for the Captain | A fix: once he's on the encounter runtime, his attempts reach analytics like every boss's | 08 S4.2 |

## From 00-traceability §7 (gaps)

| Gap | Resolution | Applied in |
|---|---|---|
| G1 (decision 2 / MW13) | X3 adds: the chunk layout (Vite 8 `codeSplitting.groups`: three · engine + game + kit · one chunk per shard), a build check that no `src/shards/**` module is in the main chunk (read from Vite's manifest), and an E188 import-retry re-test on iOS 27 in the Simulator (sim-lane) | 10 X3 |
| G2 (decision 31) | The nightly (03) adds a Simulator memory run: each shard boots in iOS Safari through `scripts/sim-lane.sh`, and the WebContent footprint is recorded against 1.8 GB loading / 1.0 GB in world | 03 nightly |
| G3 (decision 36) | X7 adds tier selection: the desktop tier needs a GPU at or above RTX 3060 class (a renderer-string table plus a 2 s GPU micro-benchmark at first boot, cached as a `device` save key); below it, the phone tier. Desktop budgets come from the M5 calibration × a documented M5 : 3060 throughput ratio (sources cited in budget-design), re-derived if a 3060-class reading is ever taken | 10 X7 |
| G6 | 01's weather-FX and horse contradictions | fixed in 01 §17, §19 |
| G7 | The deploy pin is **`.github/deploy-pin.json`** everywhere (02, 03 and the index already say so; 12 §3 and 05–08 §9 follow) | 12 §3, 05–08 §9 |
| G10 (decisions 59, 75, 76) | A new row **X9 — the game-layer extras**: the `travels` flag on item rows (default off), the read-only Wildshard summary on the title deck (built from the per-shard saves), and the travel type plus its page-reload implementation; with tests | index X9, 10 X9 |
| G11 | The `Mechanism` list is defined (15 names) | fixed in 01 §6 |
| G12 (decision 56) | Simulation apart from visuals: the `wildshard/sim-no-render` rule, proven by the actor tests | fixed in 01 §0, §24; F4, F5 |
| G13 | MW12 (KTX2 on phone for Nine Dragon) → an **after** ask. MW14 (wasm high-water across switches) → out (switching is a page reload). **MW16 (flag hygiene) → in X8**: every Debug row gets an ask id and a review-by date, a test lists overdue rows, and a count ratchet applies. **MW19 (soak bot) → in the nightly**: a navmesh wanderer 20 min per shard on the Mac (stuck states, errors, heap and GPU-byte growth, fps trend). MW22 (record / replay) → an after ask | 10 X8, 03 nightly, index §8 |
| G14 | engine-fit's navcat crowd for herds, pooled projectiles / far crowd, a worker pool and steering → **after** asks, listed in index §8. The "borrow later" libraries (three-mesh-bvh for Explore) → the same | index §8 |
| G15 | The gate adds a Linux job: the asset-URL case check (every referenced path's case matches the file; macOS disks ignore case) | 03 |
| G16 | S2.3 adds the AI debug overlay (Debug ▸ Developer tools: per-creature HFSM state, utility scores, tick band, pinned flag). A save failing its schema → fixed in 01 §9 | index S2.3, 06 S2.3, 01 §9 |
| G17 | `BOSS_NAMES` → a content registry fed by boss rows, and `TargetHit` → engine combat types: both in **S2.3** (the encounter runtime) | index S2.3, 06 S2.3 |
| G18 | F8 deletes Nine Dragon's `util.ts` `Rng` and `world/facade/rng.ts` when it lands the one RNG | 02 F8 |
| G19 | FINISH-LINE S1's pause-and-resume joins the harness's scripted run (pause → resume → state identical). S7's committed `latest.md` table is replaced by the gate's budget report artifact; the index says so | 03, index §8 |
| G20 | See the table above | — |
| G21 | 12 §6's Look row names the Captain's shared BossBar; X5's pan-from-yaw count is 8 | 12 §6, 10 X5 |

## From the consistency pass ("for the lead")

| # | Item | Resolution | Applied in |
|---|---|---|---|
| C1 | 01 §17's Weather row said the kit gets rain, snow, puddles and lightning | Fixed: the rain curtain only | 01 §17 |
| C2 | 01 §6: `fov` listed as a hook and as `camera.portraitFov`; no `wind` field | `fov` is data → `camera.portraitFov` at F6; `wind?: WindSpec` added | 01 §6 |
| C3 | The 3 pre-boot keys | `ws.dev` → `device`; `wsResumeShot`, `wsResumeBrand` → `session` (per tab, as today) | 01 §9, 02 F10 |
| C4 | `DamageRequest`: the text used `tags` / a `through.walls` tag; fields missing | The text uses the type (`sourceTags`, `throughWalls`); `from`, `distance`, `scale`, `cause`, `toast` added | 01 §18 |
| C5 | Rules `DamageRuleDef` can't express; strike motion | Such rules register as plain `answer('damage.modify', fn, { order })`, and `DamageRuleDef` is the data form of the simple ones. `StrikeSpec.motion { speed, delay, track }` added | 01 §18, §19 |
| C6 | `index.html` loads `/src/entry.ts`; how an extend-mode compose gets the clean chain | The composition root is **`src/entry.ts` + `src/main.ts`** (01 §0); `c.engineChain('clean' \| 'cinematic')` | 01 §0, §13.1, 02 F6 |
| C7 | `kitLook`, `bag.pack`, `dev.poses`, the shard sub-fields | Declared (01 §6 "Declared sub-fields") | 01 §6 |
| C8 | Pan-from-yaw count | 8 | 01 §15, 10 X5 |
| C9 | Unanswered: 02 Q15, 03 Q4, 03 Q5 (and 05 Q7, 07 Q8–Q10, 08 Q6 / Q8, answered above) | **02 Q15:** accepted. The rule allows `Game.ts` and `bootstrap.ts` until F6 re-keys it, and its start count is the rule's own at F4. **03 Q4:** accepted. The gate walks 3 legs per shard (a job stays under 12 min), and the full route runs nightly. **03 Q5:** accepted. The probe instruments listener counts through the scope census and audio node counts through the `AudioService` registry; §2.4's instrumentation is the spec | 01 §24, 03 |
| C10 | F7's script-deletion count under decision 88 | Computed at F7 time with `liveness.mjs --dry-run`; the list is recorded in E357 before anything is deleted (as 02 F7 says). It is an execution step, not a plan gap | 02 F7 |

## From the gap-closure pass

| # | Item | Resolution | Applied in |
|---|---|---|---|
| K1 | `src/engine/world/interact/validate.ts` isn't dead: `test/interact.test.ts` and `test/shards/pine-hollow/pine-quest.test.ts` import it (it validates the Driftwood and Pine interactable tables) | **Corrects 08#8 / G20:** kept. F7 lists it as reviewed-and-kept. It moves with the interact code (F6), not to the dead list | 02 F7, 08 |
| K2 | The drawing half of the combat blocks (viewmodel, slash trail, brass) would break `sim-no-render` | **Accepted:** `src/engine/combat/view/**` is exempt; their state and rules stay in the checked folders | 01 §24, 02 F4 |
| K3 | `Boss.ts` / `Elite.ts` split at S2.3 (runtime vs UI) | **Accepted** | index S2.3, 06 |
| K4 | An engine `msaa` tier knob so Nalati's composer becomes `{ chain }` | **Accepted** (01 §13.3) | 01 §13.3, 07 S3.2 |
| K5 | `retried()` (the E188 import retry) moves to `#engine/boot/retry` at X3; the shard chunk load is wrapped in it | **Accepted** | 10 X3 |
| K6 | 08's crab / monkey / sailor bands said 5 Hz past 60 m, against decision 85 | **Accepted fix:** 10 Hz mid band | 08 |
| K7 | 01 §2's RNG merge said X5 | **Fixed:** F8 | 01 §2 |
| K8 | `move-map.json` mapped `src/entry.ts` into the engine | **Fixed:** → `src/entry.ts` (the composition root), in the file map and in the `index.html` / `vite.config.ts` rewrites | move-map.json |

## Council round 1 (reviews/round-1-seat-{A,B,C}.md → reviews/register.md)

Every accepted finding is resolved here and applied in the file named; these join the frozen ledger (decision 92).

| Res | Findings | Resolution | Applied in |
|---|---|---|---|
| R1-01 | B1 | **The engine never sees a manifest and never says "shard".** `#game` builds an engine-side `LevelSpec` from the `ShardManifest` (`toLevelSpec(m)`): ground, sky, atmosphere, grade, tiers, budget inputs, boot steps and assets, fight rules, input contexts, the look loader, audio refs, water, wind, day-cycle and weather data, engine mechanisms, camera, spawn, bounds. Renames: `ShardRender` → **`LookStrategy`**; `ShardComposeContext` → `LookComposeContext`; boot stages `shard.data / world / kit / play` → **`level.data / world / kit / play`**; events `shard.loaded / unloaded` → `level.loaded / unloaded`; `app.shard` → `game.shard` (`#game`). The engine word list is unchanged | 01 §5–§8, §12–§13, §18; all specs |
| R1-02 | B2, A2 | **`uses` holds only the 15 mechanisms.** `trample` (a kit look piece), `bounds` (data) and `grapple` (Nine Dragon's own verb) leave `uses`. Each manifest lists exactly what it runs today (parity): every shard lists `hover`, `explore`, `practice`; `swim` where it has water; each shard's own spawns / quests / bosses / elites / weather / dayCycle / coins / loot / compendium / feats / bag.pack as today. The template lists all 15 | 01 §6, 05–08 §3, 11 Z1, index |
| R1-03 | B3, A1 | `move-map.json`: `src/main.ts` stays `src/main.ts` (the composition root, final too) | move-map.json, 04 §2 |
| R1-04 | B4 | Map rows: `titleDeck.ts` → `#game`; `steppeWind.ts` → merged into the engine `WindField` (final: deleted, at S3.2); `world/facade/rng.ts` → deleted at F8 | move-map.json, 04 |
| R1-05 | B5 | The map's row keys are `from · lines · bytes · f6 · final · layer · rule · row · why`; 02 uses them | 02 F6 |
| R1-06 | B6 | 01 §24's `no-shard-branch` list is the one definition; 02 F4 references it | 02 F4 |
| R1-07 | B7, A7 | `lint/ratchet.mjs --add-rule <rule>` records a new rule's first counts once (refused if the rule exists); F6's step order runs `--add-rule` before the post-move check | 02 F4, F6 |
| R1-08 | B8, A9 | F10's reset deletes only the listed **game-save** `ws.*` keys, never `device` / `session` / `ws.ota.*` / the pre-boot keys. The native mirror copies exactly `wildshard.save.v2.global` and the per-shard `wildshard.save.v2.<slug>` documents (01 §9's names), plus `ws.ota.*` (OTA durability needs it), never the device document | 02 F10 |
| R1-09 | B9, C1 | **The lock check is a `commit-msg` hook** (it can read the message): `scripts/check-lock.mjs`, built in **F0**. Lead commits carry the trailer `E357-Lead: yes`. A reopened shard's allowlist: `src/shards/<slug>/**`, `test/shards/<slug>/**`, `art/<slug>/**`, `public/assets/<slug>/**` and the asset folders its manifest declares, `scripts/blender/<slug>/**`, `docs/tasks/asks/**`. Generated files are not committed (R1-11) | 02 F0, 12 §2, 05–08 §9 |
| R1-10 | B10, C14, C15, C16 | **One per-commit command:** `node scripts/parity.mjs --export=HEAD --shards=<changed> --tiers=phone` against the lane's baselines, **plus** before every push `--shards=all --tiers=phone,desktop`. The CLI gains `--accept <item ids>` (R1-13). A subagent runs only the per-commit phone lane for its shard (< 4 min). Anything longer is "queued: <command>" for the lead (AGENTS.md) | 03 §1, 12 §5, 05–08 §0 |
| R1-11 | C12, A20 | **Generated files are built, not committed.** `shards.generated.ts` is written by a Vite plugin and `pnpm gen` (pre-test) and is git-ignored. The gate's matrix is derived from the registry at CI time. A shard with no baselines gets them recorded on its first gate run (a "bootstrap record", artifact `parity-baselines-<runner>-<slug>`). "Zero engine edits" means no change under `src/engine`, `src/game`, `src/kit`, `lint`, `scripts`, `.github`. Z3's allowlist is the reopened-shard allowlist (R1-09) | 02 F9, 03 §11, 11 Z3 |
| R1-12 | C2 | **A reopened shard's lane owns its own baselines.** A content commit re-records its shard's baselines in the same commit (`parity --rebaseline <slug>`); every other shard must stay identical (the cross-shard proof). The lead's engine commits keep all shards identical except boarded items | 03 §8, 12 §2 |
| R1-13 | C3, B10 | **Pending-board state:** `reviews/pending.json` lists accepted-pending items with their expected fingerprint deltas. `parity --accept <ids>` records them. The gate shows them yellow (allowed), and the pin can't move while any is pending: each is OK'd by Jake (re-baselined) or reverted | 03 §8, 12 §5–§6 |
| R1-14 | C4 | **No "missing budgets → red".** A shard without derived budgets uses its F2-baseline ceilings. Each shard gets derived budgets at its own milestone (Nine Dragon S1.6, Pine S2.6, Nalati S3.5, Driftwood S4.4) | 03 §2.5, 05–08 |
| R1-15 | C5 | **Milestone flow:** gate green on HEAD → boards to Jake (clips and images from the harness's capture of HEAD) → Jake OKs the board items (or they're fixed / reverted) → the pin moves to HEAD → deploy → Jake plays it live → **Jake's go starts the next shard**. The go is not a ship gate. If Jake wants to play before the pin moves, the lead deploys the candidate as a Vercel **preview** deployment (`vercel deploy --prebuilt`, which keeps `/api`), not `release-url.sh` | 12 §3, §7; 03 §13; 05–08 §9 |
| R1-16 | C6, B14 | `deploy-pin.mjs rollback <sha>` accepts any SHA in the pin history (M0 included, recorded as trusted at F3.1) without the gate check. A rollback past F10 leaves v2 saves unreadable by the old build; accepted (saves reset is OK'd, decision 13) and stated on the rollback | 03 §13, 12 §8 |
| R1-17 | C7 | F12's physical-iPhone reading comes from Jake in chat (an AskUserQuestion with the reading template), not the in-game inbox | 02 F12 |
| R1-18 | C8, A18 | Baseline artifacts are named `parity-baselines-<runner>-<slug>` (one per matrix job) | 03 §11.1 |
| R1-19 | C9 | The harness always runs from HEAD's tree against a build of the target SHA; only SHAs from F2 on (which have the probe) can be baselined. A harness change re-records its baselines in the same commit, after proving the old harness still passes on the parent | 03 §8 |
| R1-20 | C10 | **F1 makes the bakers hash their inputs, not their own source** (`bake-sky.mjs:22,32` and every baker that stamps its source hash). That re-stamps once, which is the accepted one-time re-download (04#5). "Bakers bake the same bytes" then holds for F6 / F7 / F9 | 02 F1, F6, F7, F9 |
| R1-21 | C11 | **Asset imports never cross layers.** Shard art (thumbs, Explore images) moves into the shard folder and is imported by that shard's manifest; the title deck and Explore read `manifest.card` / `explore` URLs from the registry. The F1 spike proves `#engine/*`-style imports for `.ts` and for assets (no `.ts` appended to non-TS targets) | 02 F1, F6, 04 |
| R1-22 | C13 | S1.5's CLAP ranking and htdemucs steps run under `~/projects/localai/bin/img2mesh/run-locked.sh` like every model load | 05 §6.5 |
| R1-23 | A6 | **S1's order:** S1.2 (Equipment / Weapon + the Melee family) and S1.3 (the pipeline, cues, effects core) come before S1.4 (the Tool contract, Fei Zhua). 05 §0 and 09 §6 agree | 05 §0, 09 §6 |
| R1-24 | A3 | **The plugin has staged hooks:** `abstract class ShardPlugin { world?(ctx); kit?(ctx); play?(ctx) }`, each awaited in its boot stage (`level.world`, `level.kit`, `level.play`), with the engine's work in between | 01 §7–§8, 05–08 §4 |
| R1-25 | A22 | **`ShardContext` verbs are scope-bound:** they take no `scope` parameter (the context's scope is implied) | 01 §7, 05–08 §4 |
| R1-26 | A4 | `Equipment` carries `meta: EquipmentMeta` (a name key, icon, blurb, category). There's no Bag word in the engine; `#game`'s Bag builds its entries from `meta` + its item rows | 01 §18 |
| R1-27 | A5, C28 | **A species is two rows:** `SpeciesRow` (simulation: tags, health, speeds, `locomotion: 'ground' \| 'fly' \| 'swim'`, senses, strikes, loot, tick, brain) and `SpeciesLook` (render: rig, mesh factory), registered separately. The look lives in `src/engine/ai/view/**`, exempt from `sim-no-render` like `combat/view`. Flight uses the engine's flying body (today's eagle mover) | 01 §19, §24 |
| R1-28 | A8 | **Ownership:** `scope.own` covers only what the shard creates. Shared engine / kit assets come through `app.assets.acquire(key)` (ref-counted) and are released, never disposed, by a scope. The leak test's B0 is taken after the engine boots to `title`; B1 after unload must equal B0 for the shard-owned kinds, and engine-retained resources aren't counted | 01 §4, 02 F8, 03 §5.5 |
| R1-29 | A10 | **Input contexts are additive:** an action resolves top-down through the stack, a context blocks only what it declares, and TouchControls draws the merged discs of the whole stack (a higher context's relabel wins per disc spot). A Tool runs alongside the weapon | 01 §10, 10 X1 |
| R1-30 | A11, A12, A13 | Nalati's port keeps today's behaviour exactly: whistle / HORSE is callable on foot; OFFER works during a peaceful taming approach; taming's crouch exception stays; Ctrl stays a **held** crouch; the latch reset includes sprint and jump. The mid band is 10 Hz (decision 85) | 07 §6.3–§6.4 |
| R1-31 | A14 | **The pipeline reproduces today's arithmetic:** the rule order and rounding follow each damage source's code path today (09 lists the exact order per source), proven by a golden table test of (weapon, move, target, modifiers) → damage for every combination used today | 09 §2–§3 |
| R1-32 | A15 | Driftwood's self-thinking species (crab, monkey, sailor, the Captain) join the runtime at **S4.2** and get body-clock strikes then. S4.2's parity is identical **except** the strike-timing shift (≤ 100 ms), which is a boarded item at M4 with a clip. "His fight unchanged" means rules, moves, phases and damage | 08 §6.2, 09 §5.7 |
| R1-33 | A16, B12 | 01 defines the missing types: `Actor`, `MoveSet` / `Move` (with tags: decision 15's moves as data), `BossPhase`, `BossDef`, `EliteDef`, plus `StrikeSpec`'s remaining fields from 09 §5.3 | 01 §18–§19 |
| R1-34 | A17 | The combat battery's weapon per shard: Driftwood sword, Nine Dragon jian, Pine the crossbow (shot) + longbow, Nalati bow (shot) + sabre (swing). No rifle where there's none | 03 §5.2 |
| R1-35 | A19 | `prove` dispatch runs the determinism and regression proof (green twice, and every plant red) | 03 §11 |
| R1-36 | A21 | Quarantine expires after **3 days** everywhere. A check is deleted only with a replacement covering the same field | 03 §12, 12 §8 |
| R1-37 | A23 | LeverRifle's reload and trigger state machine is mapped onto the Firearm hooks, with a parity timing table | 09 §1 |
| R1-38 | B11 | Nine Dragon's `boot.barrier` after S1.1: "the extras pack finishes before the first frame, on every tier". It keeps its meaning with a boot pack | 05 §2, §6.1 |
| R1-39 | B13 | X8's backend is `api/telemetry` (a new function beside today's `api/`), and the heartbeat is a `device` key (never exported) | 10 X8 |
| R1-40 | B15 | X2's done-when greps `src/engine/ui/**` and `src/game/**` | 10 X2 |
| R1-41 | C17 | Dispatch runs (plant / record / prove) get their own concurrency group, separate from push runs | 03 §11 |
| R1-42 | C18 | `pause-drift` is redefined so it can go red: it drops the resume restore of the player's velocity, not the gate term | 03 §9 |
| R1-43 | C19 | The nightly splits into steps within the lane limits (`--max 240` for the nightly lane; each step ≤ its own budget) | 03 §14 |
| R1-44 | C20 | Combat time limits are in game-clock seconds (capture clock) from F8 on; before F8, wall seconds with a 2× runner slack | 03 §2.3, §5.2 |
| R1-45 | C21 | The harness records the sound-play log (every sound id played, from the `AudioService` registry; before S1.5, from a probe hook on `Audio.ts`) per scripted run, compared as a multiset | 03 §2.1 |
| R1-46 | C22 | The phone-tier scripted run drives the move pad, look drag, DODGE and USE, not only held keys | 03 §4, §5.1 |
| R1-47 | C23 | **Offline boot is gated:** one job per milestone and nightly with the service worker enabled: install → offline → the title → enter a shard → Explore | 03 §11, §14 |
| R1-48 | C24 | The leak test and the soak run Nalati and Pine with weather active (rain) as well as clear | 03 §5.5, §14.2 |
| R1-49 | C25, C31 | **F0 also rewrites AGENTS.md:** the Deploy section for the pin (M0 … Mn, `deploy-pin.mjs`), the "No URL switches" route for a Debug toggle (`ctx.debugRow` in its owner; during the lock only for an E357 row or a Jake ask), and the lock | 02 F0 |
| R1-50 | C26 | Jake-dependent evidence leaves the row done-whens (F10's `persisted: true` on the home-screen app, F12's iPhone reading) and moves to the M1 checklist | 02 F10, F12, 05 §9 |
| R1-51 | C27 | X3's iOS re-test uses the newest installed simulator runtime (26.5 today) and Jake's physical phone at the next milestone. It doesn't assume iOS 27 | 10 X3 |
| R1-52 | C29 | Rapier 0.21 walks with 0 stuck, but ends / `maxY` drift beyond the band: the lead inspects the legs (trails too). A pure numeric drift is re-baselined with a note (decision 89 accepted the upgrade); a new stuck or fall reverts F12 | 02 F12, 03 §8 |
| R1-53 | C30 | **Memory red stops the line:** the next commit fixes or reverts, and the pin can't move while `gpu-perf` memory is red | 03 §14, 12 §8 |
| R1-54 | C32 | The codemod runs only on a clean tree; its dry-run list is committed first, and a half-applied run is undone by restoring exactly the dry-run's paths (all the lead's, under the lock). F6 can be reverted only until F8 starts; after that it's forward-fix | 02 F6 |
| R1-55 | C33 | F7 updates every living doc that teaches `window.__world` (`docs/SUBAGENT-BRIEF.md:98`, `docs/RUNNING.md:28,36` and the rest seat C listed) to `window.__wildshard` | 02 F7 |

### Round 1 follow-ups (the fix agents' judgment calls, reviewed and accepted)

| Res | Item | Resolution |
|---|---|---|
| R1-F1 | Where `pending.json` lives | `docs/plans/game-normalization/reviews/pending.json`. The runner checks out without `docs/`, so the gate reads it with `git show HEAD:<path>` |
| R1-F2 | The native mirror and OTA | It copies `ws.ota.*` too (OTA durability). A first boot of v2 copies the old device / session keys into their new keys, because the reset no longer deletes them and nothing else carries their values (A9) |
| R1-F3 | Which generated files | **Every** `src/**/*.generated.*` is git-ignored and written by `pnpm gen`, which `test`, `typecheck` and `lint` each run first (so CI and the tree gate generate on a clean export). Otherwise the R1-09 allowlist would refuse ordinary content commits that change a boot table |
| R1-F4 | `pause-drift` | The plant sets `player.velocity` in the resume handler (nothing restores velocity today); the frame gate is untouched |
| R1-F5 | Pine's longbow in the battery | A second shot step, `shot2`, and its field |
| R1-F6 | Re-recording one shard on the runner | The commit deletes that shard's runner baselines, and the next gate run records them again (R1-11's bootstrap) |
| R1-F7 | The nightly within `--max 240` | Nalati and Pine alternate their clear and weather soaks night by night |
| R1-F8 | Title deck art before F9 | It keeps its thumb imports as alias imports, counted by the layer lint, until F9 turns them into manifest `card` URLs |
| K-ledger | The sweepguard ledger's automatic commit under the lock | A commit that touches only `project/sweepguard-ledger.md` is always allowed by `check-lock.mjs` (02 F0 step 5) |
| R1-F9 | The crouch ask's binding | `ask('player.crouch', { want, via: 'toggle' \| 'hold' }) → { allowed, latched }` (01 §10) |
| R1-F10 | The species-look verb | `ctx.rows.speciesLook(look)` (01 §5a) |

## Council round 2 (reviews/round-2-seat-{A,B,C}.md → reviews/register.md)

Round 2 accepted about 40 unique must-fix + should-fix (A 11, B 16, C 19, overlapping), against round 1's 71: the
count falls, as the protocol (decision 93) requires. Almost every finding is an **incomplete closure** of a round-1
resolution: a fix landed in some files but not all. These are resolved here, and **every fix is applied by searching
every file for the pattern, not by spot edits**.

| Res | Findings | Resolution | Applied in |
|---|---|---|---|
| R2-01 | B2-1 | **Bakers hash data, never source bytes.** `bake-chunk`, `bake-cards` and `bake-textures` (and any baker that hashes a `src/` file) hash only their data inputs: the terrain's `landscapeHash`, the seed, the input asset bytes, and a hand-bumped `BAKE_VERSION` constant per baker. That way F6 / F8 / F9's source edits change no baked byte. F1 does it (with R1-20), and its proof bakes twice across a no-op source edit | 02 F1, F6, F9 |
| R2-02 | B2-2 | **`LevelSpec` holds everything the engine reads**: `+ loadout: LoadoutSpec`, `+ species / spawns / spawnTables`, `+ trees`, `+ forest`, `+ horizon`, `+ minimap`, `+ hud`, `+ pois`, `+ faunaTuning`, `+ bodyShadow`, `+ groundColor / surfaceAt`, `+ assets`, `+ explore`. The game-only fields (`name`, `card`, `blurb`, `order`, `status`, `bag`, game mechanisms) are not on it. **Every** spec row where engine code reads `manifest.<field>` becomes `level.<field>` (found by search across 01–11); a row where game code reads it stays `manifest` | 01 §5a, 04, 05–08 |
| R2-03 | B2-3, C2-2 | `scripts/vercel-tree-gate.sh` runs `pnpm gen` before `tsc` / `oxlint` / `vitest` (F9 edits it), and `"build"` starts with `pnpm gen &&` too | 02 F9 |
| R2-04 | C2-1 | **The KTX2 table stays committed, but per shard.** `gpu.generated.ts` needs `basisu`, which CI / Vercel / the runner lack. `bake-ktx2.mjs` writes one table per shard (`src/shards/<slug>/ktx2.generated.ts`) plus the engine's own (`src/engine/boot/ktx2.generated.ts`). `pnpm gen` doesn't touch them, the git-ignore excludes `**/ktx2.generated.ts`, and a content lane commits its own shard's table | 02 F9, F0 allowlist |
| R2-05 | A2-1 | **The kit stage's contract:** rows register only in `kit` (a later registration throws); then the engine builds the loadout from `level.loadout` and preloads its models; `play` can't add weapons | 01 §5a, §8 |
| R2-06 | A2-2, B2-10 | 02 F4's `sim-no-render` recipe exempts `src/engine/ai/view/**` as well as `combat/view/**` | 02 F4 |
| R2-07 | A2-3 | X1 step 2: a weapon reads its actions while its context is **anywhere** in the stack and not blocked (01 §10's additive rule), never "only when on top" | 10 X1 |
| R2-08 | A2-4, B2-7, C2-18 | **One crouch ask:** R1-F9's `ask('player.crouch', { want, via: 'toggle' \| 'hold' }) → { allowed, latched }` supersedes 07#9's shape everywhere (07 §6.3 C, 07 §10 Q9, 00, 13 07#9 marked superseded) | 07, 00, 13 |
| R2-09 | A2-5 | **The LeverRifle recipe is rewritten from the code, quoted line by line** (`LeverRifle.ts:487–501, 767–779`), with no paraphrase that changes behaviour. Any hook it needs that Firearm lacks (an empty-trigger hook) is added to Firearm's hook list in 09 §1.3 | 09 §1 |
| R2-10 | A2-6 | R6 is gone everywhere: no `model.bolt` rule in the request, the tags or the S1.3a checklist; the bolt's base formula is its source's (R1-31) | 09, 01 §18 |
| R2-11 | A2-7 | `BossDef` can hold the Captain: `title?`, `intro: … \| null`, `seal: boolean`, `reward: … \| null`, a phase's `caption?` / `name?` optional | 01 §19, 08 |
| R2-12 | A2-8, B2-9, C2-12 | **Z3's agent:** it does **not** carry the `E357-Lead: yes` trailer (12 §4 item 10 excepts it). Before starting it, the lead commits the new slug into `.github/lock.json` `reopened`. Its proposals go to `art/<new-slug>/round-1-proposals/` and its API gaps into its ask file (`docs/tasks/asks/<id>.md`), both inside the allowlist | 11 Z3, 12 §4, 02 F0 |
| R2-13 | A2-9, B2-11, C2-5 | **`pause-drift`:** the snapshot is taken on a new probe hook, `tap.resumed`, fired after every resume handler has run (after `hud.onResume`, `HUD.ts:472`). The plant drops the resume path's restore of the player's state, which a correct build restores before `tap.resumed` | 02 F2, 03 §9 |
| R2-14 | A2-10 | **One death-cause type:** `DeathCause { kind: string; label: StringKey; text?: StringKey }` is used in `DamageRequest.cause`, `damage.dealt`, `player.died` and the death card. The Titan maps to `{ kind: 'storm-titan', label }` (`main.ts:923`); lightning and ride map to `text` keys | 01 §18, 09 §3, 07 |
| R2-15 | A2-11 | F8 registers each legacy system in its **owner's** scope: engine systems in `engineScope`, shard-gated legacy systems (those behind `main.ts`'s gates) in `levelScope`. Unload therefore removes them, and the F8 leak run counts only level-owned kinds | 02 F8 |
| R2-16 | B2-4 | 04's tables match the JSON (titleDeck, steppeWind, facade rng, thumbs). A deletion row follows the map's existing convention (55 rows): `"final": null`, `"layer": "deleted"`, the row id in `row`, never prose in `final`. 07's steppeWind row says S3.2 | 04, move-map.json, 07 |
| R2-17 | B2-5 | **The `no-shard-branch` matching rules** (01 §24) are AST-based. They count: member reads `.structures`, `.weapon`, `.style`, `.ocean` on a chunk / def / manifest value; the identifiers and calls already listed; and any shard slug string literal in a comparison. 02 F4 implements exactly that list | 01 §24, 02 F4 |
| R2-18 | B2-6, C2-6 | **The pending flow:** the change commit adds its `pending.json` entries with `expect: null`. The next per-commit run (on that commit's SHA) fills `expect` per tier (`parity --pending-fill <ids>`, a follow-up commit). `--accept <ids>` runs only after Jake's OK at the milestone, and it re-records and removes the entries | 03 §1, §8; 05–08 §8; 12 §5 |
| R2-19 | B2-8, C2-11 | **One allowlist definition** (02 F0 step 5), referenced everywhere else:<br>• `test/parity/baselines/*/<slug>.*` and `public/assets/baked/<slug>/**` are on it.<br>• A manifest field `assets.globs` declares a shard's extra asset folders by their real names (Driftwood's are listed from the tree).<br>• Two shared files are **line-scoped**: `scripts/blender/targets.json` and `art/README.md` may change only in lines that name the slug, which `check-lock` checks hunk by hunk | 02 F0, 05–08 §9, 11 Z3, 12 §2 |
| R2-20 | B2-12 | 01 defines `EngineRows` (`weapon`, `tool`, `ammo`, `species`, `speciesLook`, `effect`, `damageRule`, `encounter`, `spawnTable`), `GameRows` (`item`, `lootTable`, `feat`, `shop`, `compendium`, `places`), `HudVerbs`, `BagVerbs`, `EquipContext` and `BlockSet` | 01 §5a, §7, §11, §18 |
| R2-21 | B2-13 | `App` gains `unloadLevel(): Promise<void>` (it disposes the level scope and emits `level.unloaded`), and `AssetService` gains `retained(): AssetCensus` | 01 §4, §5 |
| R2-22 | B2-14 | The index's §3 commit rule matches 12 §5: commit → per-commit parity on that commit's SHA → push | index §3 |
| R2-23 | B2-15 | `lint/ratchet.mjs` knows non-file sections (`budgets` keyed `<shard>.<tier>.<pose>.<metric>`, `debugRows`); `--update` lowers counts and never drops a section | 02 F4 |
| R2-24 | B2-16 | **X8's read path:** `api/telemetry` gets a `GET` with the same secret gate as `api/errors.ts`, which computes the crash-free rate per build and the daily digest server-side. `session-brief.sh` calls it with the secret from `~/.config/wildshard/telemetry.key`. Each write deletes blobs older than 30 days | 10 X8 |
| R2-25 | C2-3 | **No race on a shared `HEAD`:** every parity run takes an explicit SHA (`--export=<sha>`, captured right after its commit), and baselines never ride an `--amend`: a content lane's re-recorded baselines land in a follow-up commit that names the SHA they were recorded on. Amends are banned under the lock | 03 §1, §8; 12 §5 |
| R2-26 | C2-4 | **One sound log, no switch:** from F2, the probe hook `tap.sound` wraps every sound-play path (`Audio.ts` and the 10 modules that play sound outside it, listed in 02 F2). The `AudioService` built at S1.5 calls `tap.sound` too, so the log keeps one source and stays comparable across S1.5 | 02 F2, 03 §2 |
| R2-27 | C2-7 | **The milestone pin goes to the newest `gpu-gate`-green SHA after step 3** (accept, fix and revert commits included), and only when `pending.json` is empty | 03 §13.4, 12 §3, 05–08 §9 |
| R2-28 | C2-8 | **An early pin move** goes only to a green SHA whose `pending.json` is empty, which is usually the last green SHA before the phase's first pending entry. `set` keeps refusing while anything is pending | 12 §3, 03 §13 |
| R2-29 | C2-9 | **A "no" to "M&lt;n&gt;: go?":** the next shard phase waits. Jake's reasons become rows in this milestone (fix → gate → boards if visible → re-ask). The pinned build stays live unless it's broken (then R1-16 rollback) | 12 §3, 05–08 §9 |
| R2-30 | C2-10 | **Every milestone checklist (M1–M4)** has the physical-iPhone memory reading: Jake's loading and in-world peaks, via chat, against 1.8 GB / 1.0 GB | 05–08 §9, 12 §8 |
| R2-31 | C2-13 | A dispatch on an older SHA takes **that SHA's** baselines and **main's** harness code: `test/parity/baselines/` is checked out from the SHA, and the harness scripts from main's head | 03 §11.1 |
| R2-32 | C2-14 | **Runner timeouts by mode:** compare 20 min; prove, record and bootstrap 60 min each, with prove's plants split into one job per plant | 03 §11 |
| R2-33 | C2-15 | The record and bootstrap jobs upload `test/parity/baselines/<lane>/<slug>.*` explicitly as their artifact (not the `parity-out` report) | 03 §11.1 |
| R2-34 | C2-16 | **The preview deploy** copies `.vercel/project.json` into the export before `vercel pull`, as `deploy.yml` does | 03 §13.4 |
| R2-35 | C2-17 | F2 git-ignores `progress/parity/`. F6's "clean tree" means no tracked modifications and no untracked files under `src/`, `test/`, `scripts/`; other untracked paths are ignored | 02 F2, F6 |
| R2-36 | C2-19 | **The Captain's comparison rule:**<br>• Events are aligned by strike id. Each strike's start and hit frames may shift by ≤ 6 frames (100 ms at 60 Hz).<br>• Everything else must match exactly: the state sequence, damage per strike, the order of phase transitions, the kill.<br>• The scripted dodge is triggered a fixed number of frames after each telegraph event, not on wall time, so damage stays identical | 08 S4.2 |

### Round 2 follow-ups (the fix agents' deviations, reviewed and accepted)

| Res | Item | Resolution |
|---|---|---|
| R2-F1 | R2-26 said 10 sound modules outside `Audio.ts`; the search finds 9 (the `main.ts` and `rigArms.ts` hits aren't sound) | **9**, listed in 02 F2; a test fails any sound module without `tap.sound` |
| R2-F2 | The line-scoped shared files | **Four**, not two: `scripts/blender/targets.json`, `art/README.md`, and the KTX2 bake's `scripts/bake-ktx2.list.json` + `.cache.json`, which every KTX2 bake writes (without them a lane could never commit its own table, R2-04) |
| R2-F3 | F8's owner rule | "**The scope current at registration**": every system registered during a level's load is in `levelScope`, the ungated main updater included (it calls into level objects; a second load would otherwise register it twice) |
| R2-F4 | R2-27's pin | The pin also waits for the bootstrap-artifact commit and a repeat of the offline check |
| R2-F5 | The touch leg's `tap.use` hook and `dodgeCooldown` (B2-21(a), C2-23) | Logged nits, left for round 3 to settle with a verified source line |

## Council round 3 (reviews/round-3-seat-{A,B,C}.md → reviews/register.md)

Round 3 accepted about 17 unique must-fix + should-fix (A 6, B 8, C 8, overlapping), against round 2's ~40 and round
1's 71. The battery passed 16 / 26 on both seats. Jake kept the 4-round cap (decision 97): round 4 is the last review,
and what is still open after it goes to Jake as decisions. Every fix is applied by searching all files for the pattern.

| Res | Findings | Resolution | Applied in |
|---|---|---|---|
| R3-01 | A3-1 | F2 step 8 proves on the **follow-up commit's** SHA (the one that holds both the probe and the baselines it recorded), never on the recording SHA | 02 F2, F3.2; 03 |
| R3-02 | A3-2 | **Nine Dragon gets no terrain collider:** the engine adds the terrain collider only when `level.ground.terrain` is set **and** `level.ground.structures` is not, matching today's `bootstrap.ts:101` (a structure-first shard's terrain is placement-only) | 05, 01 §5a |
| R3-03 | A3-3, B3-5 | **`level.data` prefetches files only** (the boot asset list); weapon models are built and preloaded in `level.kit`, after the rows exist (R2-05). Pine's row says so | 06, 01 §8 |
| R3-04 | A3-4, B3-4 | **Row and verb names:** `ctx.rows.spawnTable(…)` and `ctx.rows.lootTable(…)`, never `spawn` / `loot`. `GameRows` gains `skin(row)`, and the Bag's finds are `ctx.bag.fragment('finds', f)`. 01 defines `LoadoutSpec { start; held?; pickups; loans?; grants?; viewmodel?; ammo? }` | 01 §5a, §7; 07; 08 |
| R3-05 | A3-5, B3-8 | **The one `no-shard-branch` definition** (01 §24 = 02 F4, with fixtures for each clause): (a) the listed identifiers and calls; (b) member reads of `.structures`, `.weapon`, `.style`, `.ocean` on a chunk / def / manifest value or on `getActiveChunk()`, but **not** on `level` (a capability read from `LevelSpec` data is allowed); (c) a shard slug literal as a comparison operand or a `switch` case | 01 §24, 02 F4 |
| R3-06 | A3-6, C3-8 | **Z3's exceptions are listed exactly:** the slug's own `scripts/blender/<slug>/`, hunks naming the slug in the four line-scoped files (R2-F2), and the slug's own `ktx2.generated.ts`. Step 0's default asset globs for a new shard are the one list in 02 F0 step 5 *(refined by R4-09: the repo's file names and the KTX2 mirror folders)* | 11 Z3, 02 F0 |
| R3-07 | B3-1, C3-4 | **Bakers compare bytes, not fingerprints** (this supersedes R2-01's data hashes):<br>• Every baker bakes in memory and compares the bytes with the committed output, writing only on a difference. There is no "up to date" skip on a sampled hash, and no `BAKE_VERSION`.<br>• `bake-* --check` runs in `pnpm test`, so a stale bake fails at commit time.<br>• At runtime the bake is trusted as committed (`BakedTerrain.ts:124`'s fingerprint check goes).<br>• Done-when: a 2 m trail edit re-bakes.<br>• Shard-owned bake code (Pine's tree factory and baked cards) moves with the shard and needs no bump constant | 02 F1, F6, F9 |
| R3-08 | B3-2 | **A shard's KTX2 table is optional:** the manifest's `assets.ktx2?: () => import('./ktx2.generated')`. A shard with none (the template, a new shard) boots without it. The allowlist covers `public/assets/gpu/<slug>/**` | 01 §6, 02 F0, F9 |
| R3-09 | B3-3 | **Assets have one shape:** `assets?: ChunkAssets` keeps today's flat fields (copied to `level.assets`). The lock's extra folders are a separate manifest field, `assetGlobs?: readonly string[]` (game data, read by `check-lock`), so Driftwood's globs need no `ChunkAssets` fields | 01 §5a / §6, 05–08 §3 |
| R3-10 | B3-6 | Bootstrap jobs also run the Nine Dragon facade-instancing check and the offline check; their success requires both | 03 §11 |
| R3-11′ | B3-7, C3-6 | **Jake, decision 98: no physical-iPhone readings.** The memory evidence is the nightly Simulator memory run (03 §14.1: every shard's WebContent footprint against 1.8 GB loading / 1.0 GB in world) plus the budgets. Over a limit means **stop the line** (R1-53): the pin doesn't move, and the next commit fixes or reverts. 12 §3, 12 §8 and 05–08 §9 all say exactly this, and none has a physical reading step. F12's Rapier check uses a Simulator load reading. 12 §8's risk table states the accepted risk: an iPhone-only memory death (the E271 class) can reach Jake's phone undetected (supersedes R2-30 and the first R3-11) | 02 F12, 03 §14, 12 §3 / §8, 05–08 §9 |
| R3-12 | C3-1 | **Lane-pending:** a reopened lane's content commit makes its shard `lane-pending` until the follow-up baseline commit lands (derived from `lock.json` and the commit log). Meanwhile other commits' runs show that shard yellow, not red. A red on it is attributed by re-running on the lane's parent commit (`C^`) before anything is reverted | 03 §1, §8; 12 §5 |
| R3-13 | C3-2 | **The sound log's two kinds:**<br>• Event sounds (fired by a gameplay event) are compared as an exact multiset.<br>• Timer-driven ambient sounds are logged `kind: 'ambient'` and compared as a **set of ids**. That includes `Audio.ts`'s private schedulers (larks, crickets, bubbles), which are tapped too, so a dropped ambient voice still shows as a missing id | 02 F2, 03 §2 |
| R3-14 | C3-3 | **The pending flow after the fill:**<br>• A value off its `expect` beyond the field's band is red.<br>• A later commit that changes an already-pending field refills its `expect` in its own follow-up, with a note.<br>• A newly red field joins `fields` only if its change commit names it, otherwise it's red.<br>• The fill commit runs the other shards' per-commit check too.<br>• At a milestone, fixes and reverts land first and `--accept` lands last, recording 3 runs | 03 §1, §8; 12 §5 |
| R3-15 | C3-5 | **The Captain block's player script** keys every swing to his state (a fixed number of frames after he surfaces and is hittable), not to a 0.9 s clock. Hits, hp and the killing swing then stay exact under R2-36's ≤ 6-frame strike shift | 08 S4.2 |
| R3-16 | C3-7 | **`plants/index.json`'s schema:** `{ id, kind: 'patch' \| 'flag' \| 'nightly' \| 'linux', shards, patch? }`. The runner's prove matrix runs only the `patch` and `flag` plants; `metal-off` is a flag plant (a launch arg), `soak-leak` is nightly and `asset-case` is Linux | 03 §9, §11 |
| R3-N | B3-9…B3-17, C3-9…C3-15 (nits) | Fixed where free, as nits:<br>• the old `combat.hit` shapes at 07:75 and 05:112 / 461;<br>• the touch leg's sources: `dodged` = `Player.ts:212` `dodgeCooldown`, `used` = `main.ts:1093`;<br>• the stale counts (12 "1–95", the index "1–91", 00 "98 rows");<br>• 00's `ShardRender` and its dangling "09 §10";<br>• the map legend's deletion codes;<br>• `bodyShadow` leaves `LevelSpec` (game data);<br>• `freezeCycle` in 09's LeverRifle table.<br>C3-15 (the nightly 10 % memory rule has no path for an intended increase): an intended increase is a boarded item whose OK re-baselines the nightly | 00, 01, 05, 07, 09, 12, move-map.json, the index |

### Round 3 follow-ups (from the fix agents; decisions 98–99)

| Res | Item | Resolution |
|---|---|---|
| R3-F1 | Driftwood has a KTX2 table but no ground sets, so it can't declare `assets.ktx2` | The thunk is a **top-level** manifest field, `ktx2?: () => import('./ktx2.generated')` (refines R3-08): Nine Dragon, Pine, Nalati and Driftwood each declare it; the template and a new shard may omit it |
| R3-F2 | `LoadoutSpec` vs the four manifests | 01's `LoadoutSpec` takes the manifests' shape: `weapons`, `tools`, `start`, `held?`, `pickups?`, `loans?: { id, in }`, `grants?: { id, by, replaces? }`, `viewmodel?`, `ammo?: AmmoId[]` |
| R3-F3 | Recipes pass whole lists to one-row verbs (`spawnTable(NALATI_SPAWNS)`) | Every `EngineRows` / `GameRows` verb takes one row **or** a readonly array of rows |
| R3-F4 | S1.6's phone calibration | Decision 99: **no phone run**; phone unit costs = the M5 run's × the measured phone : M5 ratio (E283, hot ~10×), stated as an assumption |
| R3-F5 | Pine's finishes are a Bag fragment, Nalati's skins are `rows.skin` | Pine's finishes become `ctx.rows.skin` rows too (one cosmetics path, X5); the Bag shows them through the cosmetics service |
| R3-F6 | The 02/03/12 fix agent's deviations, checked by the lead and accepted | • *(amended by R4-03)* The GPU bakers (`bake-cards`, `bake-textures`) and `bake-sky`'s image pair (ImageMagick) are byte-checked on the Mac in every `pnpm test` (02 F1 step 7); CI and Vercel skip them with a printed line; `bake-chunk`, `sky.json` and `bake-navmesh` are checked everywhere.<br>• `plants/index.json`'s rows also carry `expect` (the field the plant must turn red) and an optional `flag` (the plant's launch argument, e.g. `metal-off`'s `--angle=swiftshader`, 03 §9; amended by R4-03).<br>• The ambient baseline is the set of ambient ids that **every** recorded run started; an id only some runs started is logged as info and never fails.<br>• Nothing is pushed while a shard is lane-pending except that shard's follow-up baseline commit.<br>• *(superseded by R4-17)* F10 has no persistence reading: `test/saves-persist.test.ts` covers the code path, and 12 §8 states the risk |
| R3-F7 | Stale spots the fix agents found outside their files | • The index's F12 done-when: a Simulator load reading (decision 98), not a physical one.<br>• 05–08 §9's flow: the fix and revert commits land first, `parity --accept` runs last over 3 runs (R3-14).<br>• 02's two `assets.ktx2` mentions: the top-level `ktx2` thunk (R3-F1) |

## Council round 4, the last (reviews/round-4-seat-{A,B,C}.md → reviews/register.md)

Round 4 accepted 25 must-fix + should-fix (A 3, B 11, C 11), about 18 unique once merged, against round 3's ~17: the
count did **not** fall (12 §1's stop rule). Most are a round-3 fix that missed a file (decision 99 in four places, 04's
re-stamp, R3-F6's wording, the default globs) or a second-order gap in a round-3 mechanism (the memory path, the
lane-pending predicate, the sound tap, the Captain's sink). Every one below is fixed by searching all files for the
pattern; plan-lint retires the dead phrases. Battery: seat A 24 / 26, seat C 18 / 29 (27–29 added). Decision 97: what
is open after this round goes to Jake.

| Res | Findings | Resolution | Applied in |
|---|---|---|---|
| R4-01 | A4-2, B4-1, C4-3 | **Decision 99 everywhere:** M1's checklist has no RUN CALIBRATION; `calibrate.mjs` writes `budgets/calibration/m5-<date>.json` **and** `budgets/calibration.json` (phone = M5 × 10, the E283 hot ratio, stated as an assumption); 03 §2.5 reads it from S1.6 (`provisional.json` before); the index and 00 BD7 say "one M5 calibration"; budget-design §5 and §7 match | 05 S1.6, §9; 03 §2.5; index; 00; budget-design |
| R4-02 | B4-2 | **04 re-stamps nothing at F6:** its Bakers done-when is 02 F6's (`git status` empty, `bake-check` exits 0); Q5 settled (F1's one re-stamp); no `restamp.mjs`; the `bake-sky` row loses its re-stamp note | 04 §6, §7.5, Q5; plan-lint |
| R4-03 | A4-3, B4-3, C4-11, C4-13 | R3-F6 amended in place: the GPU bakers are `bake-cards` / `bake-textures` (plus the sky pair), checked on the Mac in every `pnpm test`; a plant's `flag` is its launch argument (03 §9) | 13 R3-F6 |
| R4-04 | C4-2, C4-14 | **Reproducible bakes:** `navmesh.json` stores no `ms` / `gzip` / `brotli` (printed only); the sky pair is Mac-only (`magick`), CI checks `sky.json` alone with a printed skip line; a tool upgrade that changes bytes is proven on the parent SHA and re-baked in one commit naming the versions; F1's done-when adds two clean `bake-check` runs in a row and a green CI `pnpm test`, and measures the Mac `pnpm test` time into 03 §10 | 02 F1 step 7 + done-when; 03 §10 |
| R4-05 | C4-9 | **Derived copies:** a cards / textures re-bake runs `tex-tiers.mjs` then `bake-ktx2.mjs` in the same commit; both gain `--check`, run by `bake-check` on the Mac | 02 F1 step 7 |
| R4-06 | B4-4 | **No model in `level.data`:** it fetches the `boot.files` packs only; the lever GLB is fetched where it is built, in `level.kit` (today only `preloadLeverModel()` fetches it during the build; `lateReads` feeds only the SW's later prefetch). Listed as a boot-order change in 06 §8 | 01 §8; 06 §2.1, §8 |
| R4-07 | B4-5 | **Pine's finishes are skin rows** (`ctx.rows.skin(PINE_FINISHES)` in `kit()`), the manifest's `bag.skinsTitle: 'Finishes'` keeps today's heading, `installLoadout` wires the drop and wear only, and the Bag row names the verbs | 06 §2.1, §3, §4, recipe |
| R4-08 | B4-10 | Nalati registers **five** skin rows (`NALATI_SKINS`: four elite drops + the Storm Titan's saddle) | 07 N6 |
| R4-09 | B4-7, C4-10 | **The default globs match the repo:** `<slug>/**`, `gpu/<slug>/**`, `baked/<slug>/**`, `gpu/baked/<slug>/**`, `music/<slug>/**`, `sfx/<slug>/**`, `horizon/<slug>-*`, `gpu/horizon/<slug>-*`, `lut/<slug>.bin`, `title/<slug>-portrait.jpg` (all under `public/assets/`), in 02 F0 step 5 only (11 Z3 cites it); `bake-ktx2` mirrors its sources' paths under `gpu/` (02 F9) | 02 F0, F9; 11 Z3; plan-lint |
| R4-10 | B4-8, C4-4 | **Lane-pending can't stick:** a baselines-only commit never makes a shard lane-pending; `B` is the newest commit touching `test/parity/baselines/m5/<slug>.*`, whatever its message; only the m5 lane derives it (the runner treats none as pending, its checkout has no history); the bootstrap artifact commit is `<slug> gh-macos15 baselines for <sha7>` | 03 §1, §8 case 6 |
| R4-11 | B4-6 | **`ShardManifest` declares** `loadout: LoadoutSpec`, `assets?: ChunkAssets`, `assetGlobs?: readonly string[]` and `ktx2?: () => Promise<{ GPU_FILES: Ktx2Table }>`; `#game`'s load (`src/game/shard/load.ts`) awaits the thunk before `app.loadLevel` and hands the table to `gpuFiles` | 01 §6; 02 F9 |
| R4-12 | C4-5, B4-15 | **Ambient ids are scheduler ids, tapped at the tick** (the callback's first statement, before its play condition), so they don't depend on the time of day or position; schedulers slower than the shortest run are listed in `test/parity/ambient-info.json` (info only); never tap in a shared helper (`IslandAmbience.ts:251`); `sound-tap.test.ts` asserts the first-statement rule | 02 F2 step 2 + tests; 03 §2.3 |
| R4-13 | C4-7 | **A fix Jake asked for goes back to him** (AskUserQuestion after its refill) before the one `--accept`; a reverted entry that carries a case-4 refill note re-records that field under case 4 on the revert's SHA | 03 §8 pending step 5; 12 §3 |
| R4-14 | A4-1, B4-9, C4-8 | **Memory entries:** only the lead commits them (a lane names its intended increase in its follow-up baseline commit and tells the lead); `--pending-fill` / `--accept` skip `memory.*` fields (the nightly owns them); the item is a Look-board line with both readings; OK removes the entry, no reverts the commit | 03 §8 pending step 6, §14.1 |
| R4-15 | C4-1 | **The pin's own memory reading:** `deploy-pin.mjs set` needs `gpu-perf/memory` `success` on the target SHA or on a runtime-equal ancestor (`git diff --quiet` over the export's build inputs); otherwise the lead runs `nightly.sh --memory-only --sha=<sha>` first (≤ 40 min, in the background) | 03 §13.2, §13.4, §14; 12 §3; 05–08 §9 |
| R4-16 | B4-14 | **`weapons` lists what `level.kit` builds:** a grant built only when granted (Nalati's two) is in `grants` alone; one built at load and locked until granted (Pine's longbow, `main.ts:544`) is in both | 01 `LoadoutSpec`; 06 §3; 07 §3 |
| R4-17 | B4-11 | **No milestone reading for storage persistence:** `persist()` runs only in the home-screen app, which can't be installed in the Simulator headless (no UI-tap tool), and decision 98 rules out the phone; `test/saves-persist.test.ts` covers the code path, and 12 §8 states the risk | 02 F10; 05 §9; 12 §8 |
| R4-18 | C4-6 | **The Captain's closing edge is keyed:** a swing starts only while `SINK_EVERY[phase] === 0 || mem.subT + SWING_HIT_S ≤ SINK_EVERY[phase] − 0.12` (7 steps, more than one think period; phase I has no sink, K5-10), so every swing lands before the earliest sink either build can make | 08 S4.2 B |
| R4-N | B4-12, B4-13, C4-12 | The decision range says 1–99 (index, 12 §1, 00); 04's two rows say `DEL` / `MERGE` with layer `deleted`, as the JSON does | index; 12; 00; 04 |

### Round 4 check pass (decision 100; reviews/round-5-check.md)

One Codex seat checked only that R4-01…R4-18 landed everywhere and contradict nothing. It found 10 (3 must, 7 should,
0 nit), each a fix that missed a file or an edge of a fix; all are fixed below by searching every file for the pattern.

| Res | Finding | Resolution |
|---|---|---|
| K5-1 | budget-design §4 still had Jake's phone tap, the warm-phone protocol and an LPM pass | §4 is M5-only and headless; phone = M5 × R = 10 (E283), written into `calibration.json` as an assumption; no θ / θ_LPM; the practices row says the same (R4-01) |
| K5-2 | `move-map.json`'s `bake-sky` row and 13 04#5 still re-stamped at F6 | The JSON clause is gone (the codemod's input matches 04 §6); 04#5 is marked moved to F1 (R3-07, R4-02) |
| K5-3 | `node scripts/bake-ktx2.mjs` can't import the game's modules | `node --import ./scripts/bake-loader.mjs scripts/bake-ktx2.mjs`, in the chain and in `bake-check`'s `--check` child (R4-05) |
| K5-4 | 06's `preloadLeverModel()` row still prefetched the GLB in `level.data` | The GLB fetch and the model build both run in `level.kit` (R4-06) |
| K5-5 | R3-06 still listed the old default globs | R3-06 points at 02 F0 step 5's one list, refined by R4-09 |
| K5-6 | Scheduler-driven plays still reached shared cue / SFX methods' event taps | `ambientTick(id, body)` in `harnessTap.ts`: taps the scheduler id, raises `tap.ambientDepth` around the body, and the probe drops event-kind calls while it is > 0; `test/ambient-tick.test.ts`; the callback's body is one `ambientTick` call (R4-12) |
| K5-7 | 05–08's Boards, Flow and §8 rows still let a fix settle an entry | Every one says: OKed, reverted, or fixed and boarded again for his OK (R4-13); 03 §13.4 step 3 and 12 §3 step 3 match |
| K5-8 | `nightly.sh --memory-only` skipped the mirror's fetch | It refreshes the mirror, checks the SHA is there, and step 2 archives from the mirror (R4-15) |
| K5-9 | R3-F6 still had the Simulator home-screen persistence reading | Marked superseded by R4-17 |
| K5-10 | The Captain's swing guard blocked every phase-I swing (`SINK_EVERY[1] = 0`) | `SINK_EVERY[phase] === 0 \|\| mem.subT + SWING_HIT_S ≤ SINK_EVERY[phase] − 0.12`, inside the hittable window (R4-18) |

## Build log (the autonomous build, decisions 101–109): picks, deviations, board items taken

Every gap the plan didn't cover, every deviation a builder made, and every board item the lead took on Jake's behalf
(decision 102), with its revert path. Jake reviews this table.

| # | Row | Pick / deviation | Why | Revert path |
|---|---|---|---|---|
| B1 | F0 step 4 | herdr notices to other agents skipped | Jake: "no one else is working in this repository"; waking 5 idle sessions costs a cold-cache turn each | — |
| B2 | F0 | `check-lock.mjs`'s line-scoped JSON files compared parsed before / after, `art/README.md` as a line multiset (not `git diff -U0` hunks) | the same scope, testable as a pure function | — |
| B3 | F1–F5 | the lead pre-landed every `package.json` change (a26bad51) with stub `check-paths` / `bake-check` / `coverage-ratchet`, and F1's alias spike (5b7d6093) | parallel builders never edit one shared file | the rows replace the stubs |
| B4 | F2 step 2 | `registry.pieceList()` (read-only) instead of `pieces()` | `pieces` is already a public array (Minimap, tests) | rename at F8 if wanted |
| B5 | F0 / 105 | subagent cap 20 and browser lane 8 while `.github/lock.json` is locked (`guard-subagents.sh`, `browser-lane.sh`) | decision 105 | the archive commit sets `locked: false` |
| B6 | F7 step 2 | `public/assets/nine-dragon/lab/grade-lut*.bin` kept | `look/light/grade.ts:5` still names `lab/grade-lut.bin` in a comment; the spec deletes it only when grep finds nothing | delete with the comment at S1.1 |
| B7 | F7 | steps 1–3 run before F2's baselines (a83e63f7) | they delete only unreachable code; doing it first keeps it out of every builder's way | the baseline simply never had the 3 preloaded explore images; `renames/F7.json` is not needed |
| B8 | F1 step 7 | `tex-tiers` is content-addressed (a committed source-sha → output-sha cache) instead of re-encoding every run, and its sweep is limited to its own families | a full re-encode with today's magick / cwebp pushed 116 committed phone copies over the 85 % rule and deleted them (and the global sweep removed 112 other pipelines' phone variants): a phone-memory regression. The committed copies are the truth | re-encode a family by dropping its cache keys |
| B9 | F1 step 7 | `bake-textures` waits until `__bakeExport` stops growing (2 s stable) | F2 installs the probe before `ws:ready`, so `__wildshard.world` exists before every procedural source has run | — |
| B10 | F7 step 4 | 8 scripts that ran only on the deleted dev labs (6 import `/src/dev/threeKit.ts`, 2 viewmodel-rig pages) and `rig/bakecap.sh` deleted; the fp-rig Blender target and its GLB kept | the dev server is banned (E317) and F7 step 1 deleted their pages | `git show <sha>^:scripts/<name>` |
| B11 | F1 | Driftwood's `baked/tex/clouds.jpg` + `.phone.webp` deleted (and from the KTX2 list) | the byte-compare bake found them stale: Driftwood's stylized sky never calls `buildClouds()`; the phone boot pack downloaded 17 KB for nothing | re-bake |
| B12 | F6 map | `rockKit.ts` → Driftwood (six Driftwood-only importers, Driftwood palettes: content, rule of two); `BakedCards.ts`, `faceHeads.ts` stay engine (generic loaders, the caller supplies URLs) | sol-f6m's review of the 44 classifier disagreements | edit the map row |
| B13 | F2 | the harness's pause step reads `.ws-gmenu.show`, not 03's stale `#menu` | Menu.ts's real root | — |
| B14 | F2–F6 | pushes before the first green baselines go with the pre-push gate only (no parity run exists yet to compare against) | production is pinned (F3.1), so no player sees main; the baselines are recorded on a pre-F6 SHA and the first full parity run then checks F6 and everything since | — |
| B15 | F2 / 03 §2 | `boot.scene.totals.batched` is a may-only-fall count against the baseline (Nine Dragon stays 0; the facade check stays hard), not `=== 0` everywhere | Jake's E271 rule prohibits facade multi-draw; Pine Hollow, Nalati and Driftwood ship non-facade `BatchedMesh` today and no row converts them. Converting them is a render change that needs iPhone evidence (AGENTS.md E271): an ask, after the plan | make it `=== 0` once they are converted |
| B16 | F2 / F8 | bug fixed inline (decision 4): the pause menu did not freeze the simulation (`frameGate` never read `hud.paused`); creatures and the clock ran during a pause | found by the parity pause → resume step (sol-f2c) | revert the commit |
| B17 | F2 / F8 | bug fixed inline: on touch, tapping RESUME fired the crossbow (the tap's compatibility mousedown reached the weapon's document listener) | found by the parity pause → resume step on Pine Hollow phone (sol-f2c) | revert the commit |
| B18 | S1.5 | the Nine Dragon audio generated ahead of S1.5 (score 3 slots × 4 seeds, 26 SFX families × 2 models × 3 seeds; listening page https://claude.ai/artifact/Sd1GqFmmgswUbpAfYezGFR). `sfx_merge.py --tag nd` also rewrote `scripts/music/gen/sfx-best.json` (the shared set's summary) and `public/assets/sfx/best/sfx.json`'s escaping: both restored; the S1.5 wiring row fixes `merge_set` so it writes only the shard's own set | decisions 102, 104: generation is content work, independent of the engine | — |
| B19 | F4 | the ratchet run ignores `**/*.generated.ts` | generated data tables (asset URLs per shard) are not engine code; a new shard asset raised `wildshard/layer` in `src/engine/boot/*.generated.ts`. F9 / X3 split them per shard | drop the ignore once the tables are per shard |
| B20 | order | F10 (SaveStore) and F12 (Rapier 0.21) run beside S1.1 rather than strictly before it | S1.1 needs F8 + F9 only; F10 / F12 touch disjoint systems (saves, the physics module); parallel lanes cut wall clock (decision 105) | — |
| B21 | F11 / F12 | "walk + trails 0 stuck" is read as no new stuck against the pre-row SHA; Driftwood's trail stuck spots (E354) are pre-existing and stay with their ask | the bar is a regression guard; E354 is its own ask | — |
| B22 | F2 | the m5 baselines are recorded on a side commit `d8afaeb5` (= `9093d3aa` + the Pine determinism fixes of `e2d5958e`, kept at `refs/e357/baseline`), not on a main SHA | main moves under four builders; F11's collider port had an open regression; the record needs a fixed, known-good tree. The harness exports any SHA | re-record with `--rebaseline` on a main SHA |
| B23 | F10 | the save-shaped parity fields (the fingerprint save keys, `combat.loot.written`) are accepted once at the F10 batch, not mapped by a rename | the v2 store merges aggregate legacy keys into per-shard documents, which a 1:1 key map cannot express; the reset is decision 13 | — |
| B24 | S1.6 | the calibration publishes only on a thermally steady machine (< 2 % drift / 30 s); the web has no reliable Low Power Mode signal (stated as unknown); GPU-byte budgets keep the measured GL ceilings, the desktop numbers come from X7's ratio | budget-design; a shared busy Mac cannot meet the preheat rule while builders run | re-run `scripts/calibrate.mjs` on a quiet machine |
| B25 | S1.6 | budget allocation choices: vertex share 0.5 of the GPU frame, shader-link budget 1,000 ms (a quarter of the 4 s warm-launch envelope); the cold-load cap is set from F2's baseline load time rounded up to the next second (13 05/06#7) once the baselines land | budget-design leaves these split points open | edit the inputs in `calibration.json` / the manifest |
| B26 | F2 | the harness keeps the telemetry keys `wsErrQueue` (read only when an error report is pending) and `ws.alive` (a wall-clock heartbeat) out of the save fingerprint | they are not saves and made `boot.saves.read` flap run to run | — |
| B27 | F2 | the m5 baselines are re-recorded on a post-F10 main SHA | the harness (main) writes its time / weather pins as v2 save fixtures since F10; the pre-F10 baseline tree reads only the legacy keys, so the first baselines ran at default time and weather (Pine, Nalati and Driftwood poses SSIM ~0.80 against every post-F10 build, which are identical to one another). The F6–F12 / S1 changes were each proven by their builders' before / after narrow runs | — |
| B28 | S1.4 | a LOCK press with no hook and no enemy target keeps today's miss shot (05 §6.4 reads as a plain fall-through to lock-on) | the refactor bar is identical behaviour unless boarded | — |
| B29 | S2.4 | Pine Hollow now runs on the engine `DayCycle`, so the Minimap clock badge and Explore's time presets work there too (the old WorldClock left Pine out); rain shader source stays per shard, the kit unifies the curtain geometry / material | 06 §6.4 requires Pine on the one clock; a visible HUD gain, taken on Jake's behalf (decision 102) and listed on the M2 board | hide the badge on Pine by a manifest flag |
| B30 | S2.4 | the generic `Weather` takes the RNG it is handed; each shard keeps its original weather RNG constructor seed and draw order (not a salted `gameplay` fork) | three-hour weather / lightning traces stay byte-exact; the harness still seeds every engine stream | move to a named stream when a board accepts the new sequence |
| B31 | S2.1 / 01 §0 | `#engine/data` is a second public entry: node-safe data only (terrain spec, file policies, types), allowed by the layer lint like `#engine` | importing the runtime index from a node-safe manifest pulled browser-only modules (the tier navigator) and an import cycle (Heightfield → registry) | fold back into `#engine` if the index becomes node-safe |
| B32 | S3.1 | `src/engine/fx/groundFx.ts` keeps the shader program key `kurgan-fx` under a one-line lint exception (reason given) | renaming it changes `render.programKeys`, an exact parity field | rename at a boarded look change |
| B33 | M1 / M2 | M1 and M2 move the pin together, once S2's open Pine Hollow regressions (S2.1b) are fixed and the gate is green | S2 commits interleave with S1 on main (the decision-105 lanes), so no main SHA is "S1 only"; shipping Pine with −8 colliders / +4 textures to the phone would be wrong | — |
| B34 | P1 (Jake) | parity: 3 runs only for a baseline record (in parallel); a compare is 1 run; the fast profile is 2 of 4 shards on the phone tier, picked from the changed files with a rotating tie-break | wall clock (Jake) | — |
| B35 | X9 (Look board) | the title deck's Wildshard summary strip ships as variant A (the default); B stays a Debug row | decision 102: the recommended option, logged for Jake; images in `progress/normalization/x9/title-{a,b}.jpg` | flip the Debug default |
| B36 | S3.2 (07 §6.2 done-when) | `ChunkSky.painted` stays an engine level field, with what it drives in `Sky.ts` / `Horizon.ts` (`paintSky`, the halo 250, the planet's haze / gain / far-plane settings, the clouds' `uBig`, the ridge haze colour); the done-when grep keeps those hits | Nine Dragon's manifest sets `sky.painted` too, so it is engine data for two shards, not Nalati's look; renaming the field touches both manifests and the `ridge-painted` program key | rename the field (e.g. `sky.gradient`) at a boarded look change, both manifests in one commit |
| B37 | S3.2 (07 §6.2 done-when) | GLSL source text in engine shaders that says "painted" / "painterly" (the clouds' `vec3 painted` and comment, the planet's far-plane comment, the fog edge comment in `Atmosphere.ts`) is not reworded | program sources are hashed into `render.programKeys`, an exact parity field: a comment edit inside a shader changes Pine's / Nine Dragon's keys | reword with the next shader change that re-baselines program keys anyway |
| B38 | S3.2 (07 §6.2 done-when) | `Horizon.ts`'s `painted: PaintedHorizon` (`HorizonMatte.ts`) keeps its name | it is Pine Hollow's painted horizon matte (PH-L5), not Nalati's look; it moves with Pine's horizon (06), not in S3.2 | rename or move when Pine's horizon leaves the engine |
| B39 | S4.3a (08 §6.3 D) | `#kit/npc` gets the common NPC row / rig lifecycle (the face load and draw, the draw cut, eviction); the Castaway's and the Trader's pivoted models and pose drivers stay in Driftwood's folder, with their idle fire-tend / counter motion as authored | Pine's `rigLegs` can't drive the pivoted Castaway / Trader without changing their poses, and 08 §8 allows no pose change | port both onto a shared rig at a boarded creature / NPC change |
| B40 | S2.1 (06 §2 residual) | the probe's `quest.pine` key stays in the harness schema (an empty envelope the engine fills from the plugin's `harness.quest.<slug>` reader); Pine's handles move to `ctx.debug.expose('harness.shard.<slug>', …)` and the engine's `SHARD_KEYS` row goes | renaming the key would re-baseline every shard's gameplay traces mid-plan for no behaviour change; no Pine identity gate remains | migrate the schema at the next deliberate re-baseline (Z4 or a milestone record) |
| B41 | S4.1 (08 §6.1) | Driftwood's sea is registered at `level.data` from the manifest's `ground.water`, not by the plugin | Boundary's edge step runs before any plugin hook and reads `app.world.water.sea` | — |
| B42 | S4.1 | the horizon matte stays an engine piece, built when a sea body is registered | it is generic water-horizon machinery; no shard name in it | move with X5's water bodies if a second user appears |
| B43 | S4.1 | the page's shard is captured once in `core/config` as `PAGE_LEVEL`; the KTX2 cache keys by the shard that actually boots (an unknown `?chunk=` falls back to the first shard by `order`) | one reader of the harness `chunk` param | — |
| B44 | S4.1 | Driftwood's seven island tier knobs are a shard-owned table read through `buildTier()` (not `ctx.tiers.knobs`); the phone picture cuts are manifest `tiers.phone { slices, skipRaysOffscreen }` | Explore's detail-tier view needs the knobs per tier outside a loaded level | fold into `ctx.tiers.knobs` if Z1's template wants one route |
| B45 | S4.1 | the compare captures live in Driftwood's `explore/compare/`, outside the boot's preload glob | under `explore/` they were preloaded at boot | — |
| B46 | S4.1 | the island's eight per-frame updates are plugin systems ordered `before: ['main.world']` | today's frame order: they ran at the top of main's world updater | — |
| B47 | S4.3b (08 §6.3 B) | Driftwood's phone tier knob `aa: 'fxaa'` wins over Settings ▸ anti-aliasing Off, as Nine Dragon's already does | the knob is the tier's look; one rule for every shard (decision 102: logged for Jake, a Look-board item) | let the setting win over every tier knob, in one commit |
| B48 | S4.3b | the toon uniforms are attached inside the fog install (`addFogUniforms`), not through a `uniforms` field on the fog model | the patched shader chunks then hash the same as the old `installStylize` (program keys exact) | — |
| B49 | S4.3b | the backdrop gains `clouds`, `updateAt: 'late'`, `fadesPlanet: false` and `palette` | keeps Driftwood's clock in today's update order and its planet behaviour | — |
| B50 | S4.3b | the boar / deer / bear toon palettes stay in `src/engine/entities/lowpoly.ts` for now | they touch the kit / engine species views, the index (sol-v1) and the plugin (sol-s43a); S4.3b ran out of budget | X-sweep: move them to Driftwood's species look rows |
| B51 | S4.3c (08 §6.3 C) | the `vocal` / `windup` / `impact` generators stay in the engine's `gen.ts` (exported from `#engine`); only the family registration moved to Driftwood (`ISLAND_VOICES`) | generators are generic synthesis; the island owns which families it plays | — |
| B52 | S4.3c, S3.5 | "timers onto a Scope" means `Scope.timeout` (still wall-clock `setTimeout`, owned and disposed by the scope), not the game clock; the parity harness's fast clock virtualises it (P1) | moving every ambience scheduler to game time changes when sounds fall; a later row may do it with a re-baseline | move ambience schedulers to `app.clock` at a deliberate re-baseline |
| B53 | S4.3c | the island gust is its own scheduler in the shard; `test/sound-tap.test.ts`'s scheduler count goes 11 → 12 | the shared engine `scheduleGust` no longer serves the island | — |
| B54 | S4.2 (08 §6.2, §8) | the Drowned Captain keeps its authored 10 Hz decisions in the creature manager (no per-frame re-pin, no interruption on player swings / dodges) and publishes one contact decision to `CreatureBrain.act`; this supersedes the assumed 20 Hz Captain cadence | sol-r3: the per-frame pin moved the fight (kill 1800 → 2340, an early body-clock hit); the authored cadence replays the base fight exactly (1800 trace rows, 33 inputs, 24 damage events; only the new `boss.attempt` win event) | — |
| B55 | S4.3 C.6 (08 §6.3 C) | the 16 Driftwood-only sounds leave the shared best set for Driftwood's own set; Nalati's boot audio requests fall by those URLs (it decoded them and never played them) | the island's sounds belong to the island; condition: Nalati's walk + combat sound log is unchanged (no Driftwood id ever played there). Measured c495de15 → 7e0c7560 (phone): 208 → 192 boot audio requests (16 Driftwood ids), walk sounds equal, combat events equal; the combat ambient list gains `steppe.herd` (its bed is ready sooner with 16 fewer decodes) | — |
| B56 | X3 (10 §X3) | each shard declares its own Explore art in its manifest; the old ocean-path glob that preloaded every shard's top-level explorer images on Driftwood (and missed Driftwood's nested `compare/`) goes; the art-only boot-request delta is classified as the intended Explore offline-inventory change | the engine can't branch on the ocean; per-shard lists are 10 §X3's fix. Condition: every image a shard's Explore can show (its catalog, the playground pages) is in that shard's list, so nothing goes missing offline | — |
| B57 | S4.2 (08 §8) | the Captain's authored combat windows stay sampled on the brain clock (body contact only inside the sampled window), with a regression test and `progress/normalization/r3-captain-proof.json` | sol-r3 (dc9584a5): the unsampled body contact landed a hit at frame 1339 the authored fight dodges; with it, all 1800 rows / 33 inputs / 24 damage events equal the base | — |
| B58 | S3.5 / S2 (06 §8) | Pine's shared `Voices` listener stays where it was before 8e163149 (at the origin, so samples beyond 150 m of it, like the quest glyph, stay silent); PineHollowSfx passes its own listener per play | behaviour identical: the baseline never played the glyph. This is a pre-existing bug (the island-era listener was never moved for Pine's sample voices), kept for parity | fix after the plan: one listener for every voice, with a re-baseline (a follow-up ask) |
| B59 | X3 (10 §X3) | a shard's boot audio inventory is its full `profile.files()` list; the prefetch of another shard caches that shard's own music / SFX sets too (it cached only the shared audio and missed the owning sets) | offline correctness, the X3 asset-list fix. Condition: the active shard's own boot download and decode lists stay identical (`boot.audio.requests` per shard unchanged); only the other-shard prefetch gains files | — |
| B60 | X6 (10 §X6) | the shader-patch registry is `patchShader(mat, id, order, fn, { mode, key, scope })` with order bands material 100 · decorate 200 · shadows 900 · view 950; program keys keep three's grouping (a fixed key stays its string, a chained key builds on the previous one, no key falls back to the last patch's source text) | program keys are an exact parity field: the same materials share the same programs; proved identical on all four shards | — |
| B61 | X6 | chained decorations now run before CSM's hook (CSM only sets uniforms: source unchanged); the inherited fog hook became an arrow function, so its text key changed while every unpatched material still shares it | parity: programs, programKeys and poses identical | — |
| B62 | X6 | the renderer handle is a `Renderer` type in `src/engine/render/renderer.ts` (`probeRenderer`, `isRenderer`), not a `RenderService`; 7 files still name the renderer type outside `engine/render` (Game.ts, bootstrap.ts, 4 in engine/world, manifest.ts, Driftwood keepsakes) and clear with S4.4 | — | re-key `no-renderer-type` to `src/engine/render/**` and lower the ratchet once S4.4 lands |
| B63 | S2.6 / S3 (06 §6.6, 07 §8) | Nalati's marmot colony keeps its original 10 Hz decision clock over the whole colony (one shared decision RNG, far marmots included); the fx scheduler owns only visible / motion work | behaviour identical wins: 06 §6.6's far pause is Pine's spec, and ef114096 applied it to Nalati's colony, which moved a sentry whistle from combat into the walk (shared RNG history) | pause far colony decisions at a deliberate Nalati re-baseline, if the CPU win matters |
