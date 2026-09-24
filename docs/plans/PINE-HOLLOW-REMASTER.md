# Pine Hollow — the mega remaster (graduate "Pinewood" out of experimental)

**State:** `draft` 2026-09-24 — written from main `4539c39` + the `nalati-grasslands` branch (`8a58b9d`, mid-merge of main). Nothing here is approved (Jake approved none); it waits on Jake's picks **PH-U1 (look)**, **PH-U2 (map)**, **PH-U3 (story)** and the go per wave. Wave 0 needs the Nalati merge (N10) on main first. No agent builds, "quickly tries" or partly lands a row until Jake names it.

## 0. Why, and the finish line

Pine Hollow is the original shard (16–17 Sep). It is a photoreal PBR hunting sandbox with good bones: 1,770 Scots pines on
BatchedMesh with a 3-band LOD, 1.5 k lines of interactive log cabins, 4 species with rarity and legendaries, crossbow + rifle,
harvest, Rapier colliders and a navmesh. Since then every remaster went around it. Driftwood's D8 kept it "byte-for-byte", and
Nalati built its own look. Pine Hollow never got a quest, an NPC, a boss, day / night, weather, a mockup loop, a LUT, a painted
horizon, Blender, image-to-3D, generated creatures or zoned sound. It is the heaviest shard on the phone, and the title still
tapes it off as **EXPERIMENTAL · rough edges** (`src/chunks/pine-hollow.ts:84`, `src/ui/HUD.ts:448/491`).

**Finish line: Pine Hollow graduates.** Every item below is measured, not asserted:

1. `experimental: true` is gone, and the blurb, enter hint and hazard band go with it. Pine Hollow is a first-class card beside
   Driftwood and Nalati.
2. The look passes the same bar as Driftwood v0.2: the 9-angle mockup loop, signed off by Jake at every area (PH-L1). Every
   region is under ΔE00 6 against its mockups (PH-L4). The title hero is an in-engine capture.
3. Content is on Nalati's level. There is a quest spine with an NPC, a boss, 4–5 named elites, a night and a weather layer,
   collectibles, map discovery, and 14 or more achievements. The shard's own identity (**the hunt**) has real systems behind it
   (PH-C4).
4. Sound is on Driftwood's level: a MUSIC v2 theme set (calm / tension / night / boss), zoned ambience, a generated SFX set, and
   reverb for interiors.
5. Perf meets the house gates. On the phone: at most 150 calls and 2.0 M tris at every pose (target Nalati's 110 / 1.6 M), no
   tree or shadow pop, and ≥ 55 fps on Jake's iPhone with Low Power Mode off. Desktop: at most 300 calls. Load: ≤ 20 MB cold.
   Physics: 0 stuck.

## 1. The audit: Pine Hollow vs Driftwood vs Nalati

| Axis | Driftwood (v0.2 + V2) | Nalati (branch, archived plan) | Pine Hollow today |
|---|---|---|---|
| Style | Faceted low-poly toon (`stylize.ts`) | Painterly (`painterly.ts`, look v2) | Photoreal PBR, Poly Haven splat |
| Sky / time | Stylized sky, DayNight 20 + 4 min | Panorama sky + DayClock + dusk / night / storm regrade | Fixed HDRI sunset, no clock |
| Horizon | Painted 360° matte (`HorizonMatte.ts`) | One seamless 360° panorama + horizon rings | 17 Sep procedural ridge rings |
| Colour | Learned 33³ LUT, every region under ΔE00 6 | Filmic grade + zone tints | Split-tone grade |
| Wind | One shared wind (`wind.ts`, `aSway`), shadows move | `steppeWind.ts` | Grass-only private wind; the pines don't sway |
| Ground / grass | GroundCover (5 kinds) | GPU blade rings + flowers + near cards + trample | Grass carpet + Undergrowth (good, older) |
| Terrain / assets | Blender cove (baked AO, LOD tiles), TRELLIS / Hunyuan hero props, palette-snapped CC0 kit | Codex → TRELLIS → colour-matched GLB, PaintKit | Procedural + Poly Haven CC0 GLBs, runtime-baked pine cards |
| Creatures | Rigs; captain via Hunyuan (V-M1 open) | Generated hulls skinned offline (`creatureRigBake.ts`), coats recoloured | Procedural PBR fur (deer / boar / elk / bear) |
| Story | Castaway spine, 3 glyph shards, shrine, captain boss, golden-hour reward | No NPCs, but 2 bosses, 5 elites, taming | **None**: `Adventure.ts:5` returns null |
| Systems | Interactables kit, collectibles, zipline, map discovery | Riding, taming, stealth, weather, packs / herds / flock, skins locker | Hunting + harvest + 2 legendary skins |
| Achievements | Table | 14 | 6 |
| Audio | MiniMax themes, `IslandAmbience` zones, merged SFX set | Creature voices, hooves, storm (synth) | `pine` theme v1, one forest bed, no zones, no combat SFX |
| Phone perf | 72–160 calls, ≤ 0.96 M tris | 52–95 calls, 0.77–1.4 M | 104–133 calls, 1.23–1.54 M; pond p95 50 ms; **E94 pop**; iPhone 30 fps (old) |
| Desktop | — | — | 741–989 calls (E4b, target ≤ 300) |
| Load | ≤ 20 MB | 19.8 MB / 25 | 23.5–24.4 MB, 26.75 s cold 4G |

**Keep (the strengths):**
- the cabins: interiors, hinged doors, lanterns, chimneys;
- the forest's scale;
- the fauna and rarity system: legendaries plus joke-titled achievements, the "Pine Hollow rule";
- the crossbow's feel and the harvest loop;
- Explore World (E66).

A remaster here is **art direction + content + audio + perf, on top of the engine that exists**, not a rebuild.

## 2. Jake's picks (decision boards; nothing downstream starts before its pick)

Each pick is one side-by-side board labelled A / B / C / D: portrait phone mockups made by codex editing live captures, filed in
`art/pine-hollow/round-<n>-<label>/board.jpg`.

| # | Pick | Options (board) | Recommendation |
|---|---|---|---|
| **PH-U1** | **The look.** Three shards in three styles, or one house style? | **A** keep PBR, polished to the 17 Sep AAA mockups (AGENTS.md "photoreal PS5"). **B** Driftwood toon: faceted, flat-shaded pines. **C** Nalati painterly: cel bands, painted cards, panorama. **D** *Storybook PBR*: keep the textured pines, bark and cabins, and put them under the house light (toon ramp, stylized sky, clean post, learned LUT, painted horizon). | **D.** It keeps what Pine Hollow does best (texture-rich pines and cabins) while the three shards read as one game. Photoreal is the hardest target for this engine (HOW-DRIFTWOOD-GOT-BUILT §1), and "not our style" was said of a photoreal frame (Explore X11). Per "taste is the user's call", A stays reachable behind `?look=pbr` until Jake picks. |
| **PH-U2** | **World layout v2**: Nalati's "map 4" moment | **A** same bowl, denser POIs. **B** the bowl + a creek from the ridge to the pond + old-growth (NW). **C** B + a crag ridge with a fire-lookout tower and zipline, plus a cave den. **D** C + a mill / waterfall hamlet south. | **C**, the zones in §4. It adds height, water and an interior without doubling the phone budget. |
| **PH-U3** | **The story spine** | **A** *The Warden's Hollow*: relight three lanterns, wake and fell the Antler King. **B** *The Last Hunt*: a hunting-lodge contract board, with legendaries as bounties and the King as the final contract. **C** A + B: the ranger gives lantern beats *and* a bounty board. | **C.** A gives a Driftwood-style spine, B gives the replay loop that fits the hunt identity. |
| **PH-U4** | **The name** | "Pine Hollow" (code, card) vs "Pinewood" (Jake's word) | Jake's call. A rename is one row (PH-S3) and changes the display name only; slug and saves keep `pine-hollow`. |
| **PH-U5** | **The rifle** | Keep the AR-15 in cabin 1 / swap it for a period hunting rifle (lever-action) / drop it for the King's reward weapon | Period rifle: the AR-15 is the one anachronism in a lantern-lit forest. |
| **PH-U6** | **The Antler King's look** | The Nalati round-2 concept (`art/nalati-grasslands/round-2/5-bosses/boss-6-alt-antler-king.png`) + 2 codex variants | After PH-U1. The concept must be re-drawn in the picked style. |

## 3. Wave 0: prerequisites (engine and hygiene, no taste)

| # | Row | Owner | Gate |
|---|---|---|---|
| PH-0.1 | **Nalati on main** (N10). Everything that reuses Elite / Boss / DayClock / Weather / Pack / Herd / creatureRigBake waits on it. | Nalati session | `git log main` has the squash; Pine Hollow and Driftwood load with 0 page errors |
| PH-0.2 | **The shard module interface** (ENGINE-FIT E5): one `ShardModule { build, look, quest, audio, fauna, loadSteps }` per shard, so the `isOcean` / `chunk.style` / `slug ===` branches in `main.ts:143–322` (Driftwood's ~20 plus `wireNalati`) become three modules. Pine Hollow's branch moves out first. | engine agent | tsc + oxlint clean; each shard's shader-program SHA unchanged by the refactor alone |
| PH-0.3 | **Generalise the house pipelines off their shard names**: `scripts/blender/export-scene.mjs` (hardcodes `driftwood-isle`) → `--chunk`; `fit-lut.py` / `palette-delta.py` / `scripts/horizon-matte/*` take the shard; `nalati-chunk-views` / `-camp9` / `-walk` / `-creature-*` → `chunk-views` etc.; `creatureRigBake` reads hulls from `public/assets/<shard>/models/`; the Adventure registry (`src/game/quest/Adventure.ts`) is keyed per shard | engine agent | each tool re-produces its Driftwood / Nalati output byte-for-byte |
| PH-0.4 | **Track 0 bug audit** (as Driftwood's E7): **E94** forest / shadow pop; the rifle muzzle light recompiles programs (Driftwood 0.3 leftover); `config.ts:15` defaults `CHUNK_ID` to pine-hollow; `Music.ts` defaults `'pine'`; the loading steps "HDRI → PMREM / Pine branch cards / Cabins / Crossbow" show on Driftwood (V-X1); `isDry` treats valleys below pond level as dry; the splat NaN sweep (E66 found one; E91's `pow(1 − N·V)` class); stale `docs/SHARDS.md`; no `faunaTuning` | integrator | a B-table like Driftwood's (B1…), each row a commit with before / after |
| PH-0.5 | **Baseline**: the 9-angle captures at 5 anchors (south gate, Hollow cabin, still pond, ridge cabin, bear den; `tod` frozen, cameras recorded); the phone ruler at gate / cabin / pond (+ desktop); one **iPhone reading** (Jake, Low Power off); `bench:ci` load. This is the "before" column of every later board. | look agent + Jake's phone | `art/pine-hollow/round-1-baseline/` + numbers in this plan |

## 4. The world (PH-U2 = C, subject to Jake's pick)

All coordinates live in one import-free `src/chunks/pineHollowLayout.ts` (Nalati's pattern), with a 1 m flood-fill walkability
check (≤ 44°) and a re-baked `terrain.bin` and navmesh.

| Zone | What's there | New landmarks |
|---|---|---|
| **The Hollow** (bowl, today's core) | Spawn at the south gate, the crossroads, the Hollow cabin (the ranger's home, the hub), the East cabin | A **hunting lodge** at the crossroads: contract board, trophy wall, skinning rack |
| **Still pond & the creek** | The pond (reworked, cheap reflection), reeds, a beaver dam; the creek from the ridge falls into it | Footbridge, a small waterfall, fishing jetty (hook for PH-C4f) |
| **The Ridge** | Granite crags above the Ridge cabin (Blender-sculpted, snow dusting at the top) | **Fire-lookout tower**: a vista over the whole shard, and a zipline down to the Hollow (Driftwood's zipline kit) |
| **The Den** | Bear country at the NW; a shallow **cave interior** (one room plus a squeeze) | The Old Blackpaw fight, cave reverb, bat flush |
| **The Old-growth** | Giant firs and cedars 4–6× the pines' girth, ground fog, moss boulders, fallen giants to walk along | **The Antler King's clearing**: a ring of standing stones and lanterns hung in the canopy |

## 5. The rows by track

### L: the look (after PH-U1; method = Driftwood's)

| # | Row | Gate |
|---|---|---|
| PH-L1 | **9-angle mockup loops at each zone** (`art/driftwood-isle/round-4-remaster/README.md` method): capture → 9 codex target mockups → per-angle gap list → TOP-10 routed to tracks → 3×3 sheets → loop until Jake signs off. Order: Hollow → pond → ridge → den → old-growth. | Jake signs each zone's 3×3 |
| PH-L2 | **House light on Pine Hollow**: toon ramp (`stylize.ts`) patched into the PBR materials (D), or full swap (B / C); stylized sky + **DayNight** (20 + 4 min) replaces the fixed HDRI sunset; clean post (bloom above 1.0, SMAA). The volumetric god rays through the canopy stay: they are Pine Hollow's signature. | program count stable; `?look=pbr` still builds the old look |
| PH-L3 | **Night & dusk**: cabin windows, lanterns and the fire pit on the clock (a fixed pool driven by intensity only, as Driftwood's `c282abe`, so no recompiles); moon shafts in the fog; fireflies at the pond | no program churn over a full day |
| PH-L4 | **Learned LUT** `public/assets/lut/pine-hollow.bin` from the signed-off mockups (`fit-lut.py`, `&nolut` captures) | every region under ΔE00 6 |
| PH-L5 | **Painted 360° horizon**: forested ridges + far peaks, day + night (the `scripts/horizon-matte` pipeline; top near 10° so it reads at phone width), replacing the 17 Sep ridge rings. Painted only at infinity; the walkable world stays real 3D. | seamless at every heading; −calls |
| PH-L6 | **One shared wind in the forest**: pines, twigs, undergrowth and grass on `wind.ts` (`aSway`, `swayDepthMaterial` so shadows move); the gust front visibly crosses the canopy | 0 extra draws |
| PH-L7 | **The forest, re-LODded** (E94 root cause): hi→lo swap and shadow cascade agree; lo trees cast on the phone; the impostor cross-fades (dither), no pop; E90's method and phone cost measured first | walk-around video: no visible pop |
| PH-L8 | **Ground**: Nalati's GPU blade rings + near cards replace the carpet where they win (A / B board); forest-floor needle litter, moss, fern density by canopy; trample | ≤ the old grass's tris |
| PH-L9 | **Water**: the pond off its planar re-render (panorama / probe reflection + ripples, lily pads, reeds bending); the creek + waterfall with foam; rain rings | pond pose p95 under 25 ms (was 50) |

### B: Blender and the asset pipeline

| # | Row | Gate |
|---|---|---|
| PH-B1 | **Blender Hollow**: `pnpm blender:island --chunk pine-hollow`, terrain at 2× grid, Geometry-Nodes scatter (rocks, logs, stumps, ferns), Cycles AO + bounce lightmaps (sun live), caster / cover tiles LOD'd and distance-culled (`BlenderIsland.ts` generalised) | phone ≤ 150 calls, ≤ 2.0 M tris at every pose; colliders and anchors exported so quests run unchanged |
| PH-B2 | **The Ridge crags + the cave** sculpted in Blender (V-B3's lesson: lightmap texel density up front) | crags hold at Native render scale |
| PH-B3 | **Hero props from image-to-3D** (`scripts/img2mesh/`, TRELLIS.2 default, Hunyuan turbo for speed; `run-locked.sh`): hunting lodge, fire-lookout tower, standing stones, lantern posts, trophy mounts, beaver dam, footbridge, canoe, traps, the waystone lanterns, a totem / carved bear, old-growth stumps and root plates; budgets like Driftwood's (props 150–3 k tris, LOD1) | versus-board per batch |
| PH-B4 | **Trees** (the biggest lever): hero Scots pine + **old-growth fir / cedar** + birch + dead snags + saplings. Built in Blender (Geometry Nodes / Sapling, *not* image-to-3D: trees come back as blobs), baked to the game's card and impostor atlases, and variant count up from 1 species to 5. | lineup board; forest pose tris flat or down |
| PH-B5 | **CC0 forest kit** snapped to the picked palette (`cc0_export.py --family`): Kenney Nature Kit, Quaternius Stylized Nature MegaKit, KayKit Forest (already in `~/models/cc0/`, listed in CC0.md) | 20–30 models in `public/assets/models/pine-hollow-cc0/` |
| PH-B6 | **The cabins, kept and lifted**: re-materialled for the new look; cabin 1 becomes the ranger's home (bunk, map table, the trophy wall); every cabin interior gets a reverb zone (PH-A4) | Explore models re-registered |

### M: creatures (Nalati's pipeline, generalised in PH-0.3)

| # | Row | Gate |
|---|---|---|
| PH-M1 | **Deer, boar, elk, bear** remodelled: codex reference (legs planted, head straight) → TRELLIS.2 → `creatureRigBake` onto their own procedural skeletons → `<hull>[.phone].rigged.glb`; rarity variants (Ghost stag, piebald, pale elk, Scarback…) as **coats** (`creatureCoats.ts`); `?creatures=proc` stays the fallback | strips + lineup + motion video; phone creature tris ≤ today's |
| PH-M2 | **New fauna**: grey wolves (Nalati's `Pack.ts` + rigged wolf hull, forest-grey coats), a fox, hares, and owls / ravens / a woodpecker as ambient life (gull-style breadcrumbs toward unvisited POIs) | `animals.update` ≤ 1.4 ms, 0 stuck |
| PH-M3 | **The Antler King** (after PH-U6): a 7 m moss-and-bark elk with a glowing ribcage and antler lanterns. Hunyuan full + paint (as the Drowned Captain) or a rigged hull; bound to his rig at load; `selfLight` on the ribcage | boss strip + fight video; phone calls with him close ≤ 150 |
| PH-M4 | **The NPC**: the ranger, one generated, rigged human (the captain's path), with idle / talk / point clips | reads at 2 m on the phone |

### C: content (the Nalati-level layer, on Nalati's engine systems)

| # | Row | Detail |
|---|---|---|
| PH-C1 | **Quest spine: *The Warden's Hollow*** (PH-U3 A) | 1. Meet **the ranger** at the Hollow cabin. The Hollow's three waystone lanterns went dark, and something with antlers of light walks the old-growth at night. 2. **The pond lantern**: a creek-dam puzzle; drain the pool to reach it. 3. **The ridge lantern**: climb to the fire-lookout, then zipline back. 4. **The den lantern**: in Old Blackpaw's cave. 5. Follow **the Ghost stag's** trail to the old-growth. 6. **The Antler King**. 7. Reward: **dawn over the Hollow** (Driftwood's golden-hour beat, mirrored), the lanterns lit shard-wide, the King's weapon. Driftwood's objective HUD, flags and interactables kit (`src/world/interact/*`); saves per shard. |
| PH-C2 | **The Antler King boss** (Nalati's `Boss.ts` / `BossBar.ts`, `GroundTell` telegraphs) | Only at night, in the clearing, fog closing in as the arena wall. **I, the Warden**: antler sweeps and root-ring stomps (jump the ring); shoot the ribcage when it opens. **II, Lanterns Fall**: his antler lanterns drop and burn as hazards; he summons a wolf pack. **III, the Last Light**: the clearing goes dark except his ribcage and your lantern, and he charges down lanes. Phase checkpoints, reward orb, `?boss=antler-king`. Drops the **Warden's Longbow** (or the PH-U5 pick) + a crossbow skin. |
| PH-C3 | **Named elites** (Nalati's `Elite.ts`; the "retrofit" in `docs/design/nalati/elites-and-bosses.md`) | **Old Ironhide, Terror of the Hollow** (boar): telegraphed gore charge. **The Ghost Stag**: fades, unaimable for 2 s, reappears behind you, and leads the quest. **Old Blackpaw** (bear, the den): roar-stun + ambush from the cave mouth. **Whitefang** (wolf alpha, night): pack howl, broken by a hit. **The Imperial Bull** (elk, dusk rut): bugle calls rivals in. Each: leash, phase 2 at 50 %, banner, minimap skull, 20 min respawn, cosmetic drop + trophy. |
| PH-C4 | **The hunt: Pine Hollow's identity** (what Driftwood's quest and Nalati's riding are to theirs) | **a. Tracking**: prints, broken twigs and blood trails that fade with time, and a "scent" chip that reads the shared wind (downwind = unseen). **b. Calls**: grunt / bugle / squeal lure a species; the elites answer theirs. **c. Hides & tree stands**: sit in one and animals relax. **d. The contract board** (PH-U3 B): daily bounties, rarity targets, a named elite per week. **e. The trophy wall** in the ranger's cabin: every legendary and elite you took, persisted, with the joke title. **f. Fishing** at the jetty (optional, its own pick). **g. Hunter's journal**: a bestiary that fills as you track and take each species / variant (ties into Explore's creature viewer). |
| PH-C5 | **Night & weather** (Nalati's `DayClock` / `Weather` / `WeatherFX`) | Dawn **ground fog** in the bowl; **rain** on the canopy (drips, puddles, rain rings on the pond); **thunderstorms** where lightning hits the tallest pine, with a charred snag after; the **first snow** as a rare state (snow on the ridge sinks to the Hollow). Night brings wolves, owls and the King. Animals shelter in storms. |
| PH-C6 | **Collectibles & secrets** | **Amber resin drops** (Driftwood's sea-glass role, ~30); **carved wooden tokens** at 8 hidden spots; the lookout's vista bench; a hollow-log secret passage; the canoe to the pond's islet. |
| PH-C7 | **Map & places**: named places with discovery (Driftwood's POI system), quest markers, the pond reading dark fixed (EXPLORE-V2 V3), map pins for the new zones | every zone discoverable |
| PH-C8 | **Achievements to 14 or more**, joke titles in the house voice: the King, each elite, the three lanterns, the resin set, the journal complete, a tree-stand ambush, "Stood Downwind Like An Amateur" | table in `achievements.ts` |
| PH-C9 | **Loadout**: the crossbow stays the hero weapon; the rifle per PH-U5; Nalati's `Bow.ts` (drop arc, wind drift) becomes the Warden's Longbow; the sword question (Driftwood's) is Jake's call | weapon strip reads on touch |

### F: combat feel

| # | Row |
|---|---|
| PH-F1 | Driftwood's hit-stop, trauma shake, hurt arc and impact kit ported to the crossbow / rifle / bow and the animals (today those are sword / island-only). Bear and boar charges get Nalati's `GroundTell` telegraphs. Lock-on (E50) is checked on fast creatures. |
| PH-F2 | Harvest feel: a short skinning beat with sound, and the carcass left to the ravens (ambient life) |

### A: audio (the house engines: MiniMax only for music; MOSS v2 + Stable Audio 3, better take ships)

| # | Row | Gate |
|---|---|---|
| PH-A1 | **MUSIC v2 for Pine Hollow**: new slots per style (piano / orchestral / folk): **calm-day, calm-night, tension, boss (the Antler King, 3 phases as stems), the dawn reward sting, storm**. About 6 takes per slot, `rank_v3.py`, demucs stems, bar-exact loops, −18 LUFS, ≤ 5 MB per style. Theme 1 is retired or kept as the night bed (Jake's ears). | round board published for Jake's listen, as E57 |
| PH-A2 | **Zoned ambience**, `ForestAmbience` (the `IslandAmbience` pattern): Hollow (wind in pines, woodpecker), pond (frogs, loons, dragonflies), creek / waterfall, ridge (high wind, hawk), old-growth (hush, creaks, deep drips), cave (drips, bats), night (owls, crickets, far wolves), rain on canopy vs rain in the open, storm | zones cross-fade on the minimap |
| PH-A3 | **Generated SFX set**: crossbow (draw, loose, bolt hits by surface), rifle, longbow; every animal's voice (elk bugle, bear roar, boar squeal, wolf howl chorus, the King's antler-bell and root-stomp); footsteps on needle / mud / snow / wood / rock; cabin doors, lanterns, the zipline, the waterfall | `sfx-best.json` per sound |
| PH-A4 | **Generated reverb IRs**: cabin interior, the cave, old-growth, the open bowl | toggled on zone entry |

### P: perf and load (every row carries its before / after numbers)

| # | Row | Gate |
|---|---|---|
| PH-P1 | Phone poses re-measured after each wave (gate / cabin / pond + the new ridge / den / old-growth / King fight) | ≤ 150 calls, ≤ 2.0 M tris; target Nalati's 110 / 1.6 M |
| PH-P2 | **Desktop draws** (E4b): 880–990 → ≤ 300 (merge the cabin detail, the BatchedMesh for props, the undergrowth by cell) | ≤ 300 at every pose |
| PH-P3 | **Load**: 23.5 MB → ≤ 20 MB cold (KTX2 / Basis for the Poly Haven sets that remain, WebP atlases, the phone halves); a Pine Hollow `SHARD_STEPS` with honest nouns; boot pack like Nalati's 2.7 MB | `bench:ci` green |
| PH-P4 | **Physics**: creature physics LOD for about 150 animals + wolves (ENGINE-FIT), navmesh re-baked for layout v2, `physics-baseline --mode=walk / --trails` 0 stuck, the zipline + cave colliders | ≤ 1.5 ms p50 |
| PH-P5 | **iPhone reading** (Jake, Low Power off) at the end of each wave | ≥ 55 fps |
| PH-P6 | **WebGPU** (V-G2): Pine Hollow on the TSL path; parity at the 9 cameras | mean \|Δ\| under 6/255; WebGL stays default |

### S: ship (graduation)

| # | Row |
|---|---|
| PH-S1 | Hero art from in-engine captures (landscape 1600×900, portrait 1024×1536, card 640×360; the King's clearing at night and the Hollow at dawn are the candidates); the native app icons re-made from them |
| PH-S2 | `experimental` off; blurb, enter hint and hazard band gone; card order a Jake pick |
| PH-S3 | The name (PH-U4) and `docs/SHARDS.md` rewritten for three shards |
| PH-S4 | The plan finished and archived; tag **v0.3** ("three shards") |

## 6. How it gets built: waves and lanes

A wave starts only when Jake names it. Up to 3 build subagents per wave, on disjoint files. Each commit is a small deploy with
before / after shots in `progress/pine-hollow-<row>-<nn>-<slug>.jpg` and the phone numbers. Art goes in `art/pine-hollow/round-<n>-<label>/`.

| Wave | Rows | Lanes (disjoint files) | Waits on |
|---|---|---|---|
| **0** | PH-0.1 → 0.5, the boards for PH-U1 / U2 / U3 / U5 | engine (`main.ts`, `src/shards/*`), tools (`scripts/*`), integrator (bugs) | the Nalati merge |
| **1: Look** | PH-L1 → L9, PH-B4 trees | look (`world/stylize`, sky, LUT, horizon), forest (`Forest`, `TreeFactory`, `wind`), water (`Water`, pond) | PH-U1 |
| **1b: Sound** (parallel, no browsers) | PH-A1 → A4 | music (`scripts/music`), sfx, ambience (`audio/*`) | PH-U3 (the beats name the stings) |
| **2: World** | layout v2, PH-B1 / B2 / B3 / B5 / B6, PH-C7 | blender (`scripts/blender`, `BlenderIsland`), assets (`scripts/img2mesh`, `public/assets/models/pine-hollow-*`), layout (`pineHollowLayout.ts`, bake) | PH-U2 |
| **3: Life** | PH-M1 → M4 | creatures (rig bake, coats), boss model, NPC | wave 2's layout (spawns) |
| **4: Play** | PH-C1 → C9, PH-F1 / F2 | quest + NPC (`quest/*`), elites + boss (`pinehollow/*`), hunt systems (`game/hunt/*`) | waves 2–3 |
| **5: Ship** | PH-P1 → P6 (running since wave 1), PH-S1 → S4 | integrator | Jake's 3×3 sign-offs + iPhone |

**Size, as a yardstick.** Driftwood v1 (look + a quest spine) took about 2 days of agent time. Nalati (look + systems + two
bosses) took 624 commits. This plan is between them. It reuses both shards' engines, so most of its cost is art loops, content
and audio generation, not systems.

## 7. Risks

- **Perf is the tightest in the game already.** Every added zone must pay for itself: the pond re-render (PH-L9), desktop
  draws (PH-P2) and the painted horizon (PH-L5, −calls) come first, so wave 2 has room.
- **The style fork (PH-U1) touches every later row.** Picking late re-does mockups. That is why it is the first board.
- **Trees through image-to-3D fail** (blobs), so PH-B4 is Blender-built on purpose.
- **Shared-tree hazards**: 10 agents on `main`; this touches `main.ts` hardest (PH-0.2 first, alone).
- **Nalati systems are young.** Elite / Boss / Weather have run only on the steppe; the retrofit will find their shard
  assumptions (sealed-arena radius, grass-height stealth).
