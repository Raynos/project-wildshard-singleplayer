# Audit: GAME-NORMALIZATION (E127 plan, 2026-09-25) against Jake's aims and today's code (E357, 2026-09-30)

The plan was written on 2026-09-25, and no row of it was ever built. This audit checks it against what Jake asked for
(E127, and his fuller context in E357) and against the tree at `b3b43536`. Three read-only searches did the counting
(combat and audio duplicates, world and look duplicates, wiring and safety net), plus an import-graph pass.
Conclusion: **the plan's goals are right, but its architecture has one layer too few, its numbers are half what they
are now, and its process (a freeze plus a replay golden master) fits a repo that no longer exists.** It is rewritten as
[GAME-NORMALIZATION v2](../../project/archive/2026-10-01-game-normalization.md).

## 1. Jake's aims

E127 (2026-09-25): *"I want one implementation of a thing. I want the three shards to be built on a shared baseline. I
want the shards to be standalone things on top of the core gameplay features. I don't want 100s of if statements. This
is pure refactor and removing duplicate code and normalizing the shards to share one core game thing."*

E357 (2026-09-30), in substance:
- The shards are generic shards bolted on top of a base game. That game is a **base, flexible engine with interfaces**.
- Anyone can write a new shard on it, Jake included: a **fifth, sixth, seventh**.
- A shard is **a directory that implements an interface**, like a plugin. It is "almost dynamically loaded" (static
  for performance, baking and optimization reasons).
- Code the shards share that isn't engine goes into **a shared library**.
- **No shard `if` in `main.ts`.** The base game is generic and boots straight into whatever makes sense.
- Move as much code as possible into the shared baseline, and everything shard-specific into its shard directory.
- The normalization session holds a lock on the whole repository: no other agent works in it meanwhile.

## 2. The plan against the aims

| Aim | Plan (09-25) | Verdict |
|---|---|---|
| One implementation of a thing | D1–D21 duplicate table, three dedupe waves | **Right, but stale.** The duplicates roughly doubled (§4). It misses the biggest new families: two weather stacks (~2,200 lines), Longbow as a fork of Bow (~450), LeverRifle a partial fork of Rifle, three day clocks, six water bodies, and the Nine Dragon lab copies (~4,800 dev lines) |
| An engine with interfaces, shards as plugins | A `ShardModule` interface beside `ChunkDef` | **Half right.** It invents a second concept, while the code already grew the plugin shape as lazy strategy hooks on `ChunkDef` (`render`, `structures`, `sword`, `roster`, `fieldModels`, `traversal`). Nine Dragon plugs in through them. The new plan should grow that shape, not start a parallel one |
| Anyone can add a 5th / 6th / 7th shard | Not a goal; done means "`main.ts` ≤ 150 lines, 0 branches" | **Missing.** Nothing proves a new shard needs no engine edit. The finish line should be a real template shard that boots with zero engine changes, plus a how-to-write-a-shard guide |
| A shared library for shard code that isn't engine | Not there: two layers, core and shard | **Missing, the biggest gap.** Bow and Longbow, `Boss`, `rigArms`, the toon and painterly model kits, weather, the day clocks, the elites' base and the NPC rigs are each used by two or three shards and are not engine. In the plan they would land in core and swell it with shard flavour, or be copied into each shard |
| No shard `if`s in the engine | Rules 3–4 and a one-off boundary check at the end | **Right, but unenforced.** While the plan waited, branches grew from ~240 to 269 and `main.ts` from 829 to 1,336 lines. The check has to be a lint rule with a ratchet on day one (counts may only go down), like `wildshard/no-url-switch` |
| Pure refactor | Yes, with two exceptions: N8 (the flag-only looks, now nearly done) and moving the Captain onto `Boss` (a feel change) | **Mostly right.** The Captain can join the shared boss wiring with his fight unchanged; any feel change is its own ask. The four bugs the plan found are still there, and they belong in their own asks |
| Almost dynamic loading | Decision 11: one bundle, static imports | **Overtaken by the code.** Nine Dragon is already code-split through its lazy def hooks (a 373 KB shard chunk plus render, traversal, jian and arms chunks). The other three ship in `main-*.js` (2.9 MB raw). This needs Jake's call again |
| As much code as possible in the baseline, the rest in the shard folder | N6 moves shard-only files | **Right.** The scale: ~100 files and ~26k lines of single-shard code sit in engine folders (`src/world`, `src/player`, `src/entities`, `src/audio`, `src/game`), plus the parallel trees `src/nalati` (9.5k) and `src/pinehollow` (6.9k) |

## 3. The plan against today's code

| Measure | Plan (09-25) | Today (09-30) |
|---|---|---|
| Shards | 3 | **4.** Nine Dragon Stack is the only one shaped like a module (`src/chunks/nine-dragon-stack/`, 108 files, 25.5k lines) |
| Shard branch sites outside `src/chunks/` | ~240 in 43 files | **269 in 70 files** (plus 128 engine→shard imports) |
| `main.ts` | 829 lines, 53 direct gates | **1,336 lines, ~140 gated lines**: `isOcean` 28, `slug ===` 19, `sea` 19, `nalatiNow()` 18, `isPine` 12, `painterly` 10. About 30 of its 147 imports are used only behind a shard gate |
| Hook fields merged by hand | ~35 | **48 assignments on 40 fields** (`animals.onWindup` ×3, `onCharge` ×2; loot, compendium and quests chain `onKill` themselves) |
| Hand-ordered updates | ~35 | **32 in the one `'main'` updater** plus 10 `onUpdate` and 1 `onFixed` |
| Closure locals in `buildShard` | ~60 | **~160** |
| Event bus / system registry | none | **none.** `Game.ts` already has the phases (`onInput / onFixed pre-step-post / onUpdate / onLate`, labelled systems with fault isolation), about half of the plan's `SystemRegistry` |
| How each shard plugs in | Driftwood inline, Nalati `wireNalati` plus binds, Pine the default | **Driftwood:** ~15 `isOcean ? new X : null` builders at `main.ts:289-408`, plus Enemies, ShrineHum, IslandSfx, adventure, places, keepsakes, IslandAmbience and first minutes, all in `main.ts`. **Nalati:** `wireNalati` (473), 18 `nalatiNow()` calls, and its look imported by `Game.ts`. **Pine:** seven `install*` calls gated by slug, `isPine` or `instanceof`, plus streams, hamlet, rifles and sets. **Nine Dragon:** def hooks, and five slug gates left (boot fragility, `isNine`, Fei Zhua) |
| Look plug-in | none | `ShardRender` (`ChunkDef.render`) is the right strategy, but only Nine Dragon uses it, and `Game.ts:290` still overrides its AO on phone. Nalati has its own composer (`Game.ts:274`), and the others branch in `Game.ts`, `Sky.ts`, `Terrain.ts`, `Grass.ts` and `Atmosphere.ts` |
| Safety net | none | **Still none in CI**: 113 vitest files, node-only, none runs `main.ts` or `bootstrap()`. `scripts/scorecard.mjs` is ~70 % of a golden master: seeded `Math.random`, pinned time and weather, 3 shards × phone and desktop, SSIM against a baseline. It skips Nine Dragon and records no boot fingerprint |
| Determinism | 141 `Math.random`, 112 `performance.now` | **254 and 242.** An exact 20 s replay with every audio call (the plan's N0) is now much harder than the plan's 1–1.5 days. A fingerprint + poses + walks + combat-smoke harness gets the same safety for a pure refactor |
| Freeze | a full feature freeze | 1,064 commits landed in 5 days. The freeze was never declared, and the plan never started. Now moot: this session holds the lock (E357) |

## 4. The duplicates today (one implementation of a thing)

No group was merged by other work except where noted. The estimates are lines deletable with every look and feel kept
(per-shard numbers become data).

| # | Group | 09-25 | Today | Notes |
|---|---|---|---|---|
| D1 | FP weapon shell | 250–300 | **~380** | 7 look-lag springs, 8 `aimRay`, 7 input handlers, 3 `fovForAspect`, 5 `sstep` |
| D2 | Projectiles | ~170 | **~280** | + `DropArc` ×2 (Bow, Longbow), brass ×2 (Rifle, LeverRifle), Pine's `BoltMod` inside Crossbow |
| D3 | Melee | ~80 | ~80–100 | Nine Dragon's jian already runs on `Sword` (the model to follow). Pine's `feel.ts` re-wires Sword's hit-stop for bolts |
| D4 | ADS | ~80 | **~130** | 3 `solveAds`, 2 bow zooms |
| D5 | Weapon interfaces + kit choice | ~140 | **~180** | `instanceof Crossbow` ×6, kit by slug in 4 branches, weapon-id sets in 4 UI files |
| D6 | Enemy strike timing | ~60 | **~100** | Pine's `LaneCharge` (17 uses) is a ready seed for the shared strike helper |
| D7 | Boss wiring | ~160 | **~230** | 3 near-identical `bind`s (kurgan, titan, antler king), 5 `retire()` |
| D8 | Spawning | ~60 | ~80 | + Pine's night thralls and rolled elites |
| D9 | NPC idle | ~50 | ~80 | 4 rigs (Castaway, Trader, campPeople, Pine `npcRig`) |
| D10 | Quest runtime | ~90 | ~120 | `quest/core.ts` exists since 09-24; Pine's quest hand-rolls around it |
| D11 | FX pools, telegraphs | ~90 | **~150** | 7 CPU point pools, two classes both called `Puffs` |
| D12 | Zoned ambience | ~200 | **~250** | Island, Steppe, Forest ("the IslandAmbience pattern", its own header says), synth beds |
| D13 | Music source | ~85 | ~120 | steppe (22 refs) + Pine's `setPineScene`; shard→bed mapping ×7 |
| D14 | SFX routing, helpers | ~110 | ~170 | 3 routings, 2 positional voice engines, pan-from-yaw ×6, smoothstep ~15× |
| D15 | Grass streaming | ~150 | **~20 (moot)** | `GrassPainterly` deleted (E136); Nalati's grass is a GPU ring, a different algorithm |
| D16 | Model kit + AO | ~200 | ~200 | 3 voxel AO bakers |
| D17 | Painted panorama | ~150 | ~60–80 | 4 techniques (HorizonMatte, PaintedHorizon, SkyDomeV2, Nine Dragon sky sphere) |
| D18 | Sky | ~120 | ~120+ | `Sky.ts` 899 lines, 3 setup paths; the painterly sky and clouds are built then hidden on Nalati and Nine Dragon |
| D19 | Day cycle | ~180 | **~220–250** | 3 clocks (DayNight, DayClock, PineDayNight) + 2 half-adapters, one sharing a class's name |
| D20 | Terrain, placement, post, culling, fog, wind, water | ~390 | ~250–300 | Placement and post half merged (`models/place.ts`, `Game.ts` `chain()`). Fog grew to 4 writers of `fog_fragment`; water to 6 bodies |
| D21 | HUD, skins, saves, helpers | ~200 | ~100 | HUD merged (E154, `hudSlots`). Skins ×3, 28 files read `localStorage` by hand, `lin()` ×6 |
| new | Weather stacks | — | **~1,000** | Nalati (Weather + WeatherFX + nalati/weather, 1,334) vs Pine (PineWeather + FX + pinehollow/weather, 888), same shape |
| new | Longbow = fork of Bow | — | **~450** | only 239 of Longbow's 792 lines differ |
| new | LeverRifle ⊂ Rifle + Crossbow | — | ~150 | 179 lines verbatim |
| new | Elite script base ×2, slash trail ×2, LUT loader ×2, RNG ×3 | — | ~200 | |
| dead | Nine Dragon lab copies (`src/dev/nd-lab/`), `look/post.ts`, `meleeGeo.ts` dead half | — | **~5,200** | dev-only or unimported |

**Total: ~5,000 lines deletable by merging, ~5,200 dead or dev-copy lines, ~42,000 lines to move into shard folders.**

## 5. Found along the way (bugs, not refactor rows; still present)

1. `Spear.thrustHit` (`Spear.ts:561-579`) never checks occlusion: the thrust hits through walls. `bladeBlocked` is
   only called by `Sword.ts:819`.
2. `boot/extras.ts:57,118,149` preload Explore's art and code only when `def.ocean`: Nalati, Pine Hollow and Nine
   Dragon (all `explore: true`) miss it offline.
3. `ChunkDef.weapon: 'nalati'` is ignored; `main.ts:529` picks the kit by slug.
4. `ws.elites.v1` is one global store, now used by Nalati and Pine Hollow (keyed by elite id, so no clash today).
5. (Not a bug, a normalization row.) `Game.ts:290` overrides Nine Dragon's `ShardRender.ao` on phone: core decides for
   a shard instead of the shard's tier data.
