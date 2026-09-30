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
| 5 | F6 re-stamps the bakers' `hash` fields once, so Pine Hollow's 2.7 MB phone-pack part re-downloads once | **Accepted:** a one-time 2.7 MB for Pine phone players at M1's deploy, stated in the M1 summary (decision 1's "don't move public/assets" is about re-downloading everything; this is one part) | 04, 12 §7 |
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
| 07#9 | Nalati's crouch toggle and grass gate | `ask('player.crouch', { want }) → { allowed, toggle }`: the engine owns the `crouch` action; Nalati's stealth answers the ask | 01 §10 |
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
