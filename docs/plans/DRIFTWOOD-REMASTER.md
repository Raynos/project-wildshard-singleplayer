# Driftwood Isle — the remaster (10× quality and polish)

**State:** `in progress` 2026-09-22 — the user: "we will need a full remaster"; audit done (E7), every pick made (D1–D8). Building: Track M = model-agent (took over from E8, building on its `8ce9efd` lowpolyKit); Tracks L + W = look-agent, 0 + C = feel-agent, A = adventure-agent, S = sound-agent (this session integrates, deploys, screenshots). Perf is gated by PLAY-PERF's four Driftwood poses.

Driftwood was built in one night (2026-09-18, `project/archive/2026-09-18-driftwood.md`): C0–C16,
129 commits, all live. It is a complete *scene* and a thin *game*. This plan turns it into the shard
we show people first (it is the default shard since E9 `5231859`): AAA-stylized on an iPhone at
60 fps, with 20–30 minutes of island adventure. The recipe from `docs/HOW-DRIFTWOOD-GOT-BUILT.md`
still holds: mockup with the real HUD → build → deploy each row → steer on feel.

## 1. The audit (E7, 2026-09-22) — README.md + docs/SUBAGENT-BRIEF.md vs what ships

There is no `BRIEF.md`; the brief is `docs/SUBAGENT-BRIEF.md` (+ `sources/wildshard/*`).

| Requirement (source) | Driftwood today | Verdict |
|---|---|---|
| "AAA, PS5-worthy … must not stop until it looks like a genuine PS5 game" (README) | Clean faceted scene, but flat-lit plastic facets (no ramp, no rim, no AO until E8), a **photoreal HDRI sky with cirrus** behind a low-poly world, an opaque matte sea, bare interior (no ground cover), landmark shells | **far** — the gap is lighting + water + sky + density, not polygon count |
| 60 FPS hard requirement, instance everything, no per-frame allocs (brief) | Hot loops are allocation-free; one merged mesh per module. **Never measured** on the phone budget; ~35 animals × 3 materials ≈ 105 calls → a busy view est. 150–190 calls vs ≤ 150; no culling / LOD (whole-island meshes, also into the shadow map); **likely** mid-play shader recompiles when a point light is removed (iron-sword pickup `IronSword.ts:257`, sailor death `Enemies.ts:285`) — read from code, not yet seen on screen | **at risk** |
| Every lit material via `sky.setupMaterial` (brief) | yes | ok |
| Colour in sRGB only (brief) | `Sword.ts:80`, `IronSword.ts:46` convert to linear twice → swords render darker than authored | bug |
| "Shadows cast and received on everything that matters" (brief) | Terrain casts no shadow (`Terrain.ts:76`) → cliffs never shade the beach; swaying palms / bridge / gulls have no sway depth material → still shadows under moving things | **gap** |
| "Subtle motion everywhere (wind, breathing, flicker)" (brief) | palms, gulls, bridge, ocean, animals breathe — but bushes, banner (baked wave), boat / wreck sails are frozen; the boat and swimmer ignore the waves | partial |
| Correct scale (brief) | ok by eye at the pier; enemy scale per mockup: see visual audit | ok |
| "Feel like playtesting a standalone chunk" + Wildshard features: pickups, quests, NPC quest givers, puzzles (plates, keys, locked doors), chests, achievements, titles (`sources/wildshard/GAME-REFERENCES.md`) | One pickup (iron sword). No quests, NPCs, chests, keys, doors, collectibles, secrets; **no Driftwood achievement table** (`achievements.ts:41`); nothing respawns; the full map shows Pine Hollow's cabins / pond (`Map.ts:164`) | **the biggest gap** — ~5 minutes of content |
| Fundamentals: 500 m chunk, 4 entry roads at edge midpoints (FUNDAMENTALS) | yes — the jetties are the submerged sandbars | ok |

### What the phone sees (live captures, 390×844, 2026-09-22)

`progress/148-e7-driftwood-audit-before.webp` (beach, hut, palm grove, plateau stair, lookout, shrine,
crab, pier) against `art/driftwood-fp-*.png`:

- **The sky is 50–60 % of every portrait frame and it is the wrong art style**: photoreal cirrus HDRI,
  heavy haze + grain washing everything to low contrast, and the planet drawn *behind* the cirrus
  streaks so it reads as a smudge. The mockups: saturated blue, faceted cumulus, a crisp planet.
- **The island is empty**: vast flat green / beige planes with no ground cover, flowers, rocks or
  props between POIs; the mockups have something in every square metre. POIs read tiny and far apart.
- **The sword viewmodel fills ~60 % of the frame**: an over-long flat brown blade, a fist of brown
  boxes and a grey block forearm, which reads as a placeholder. The mockups show a short, chunky wooden sword held
  low-right in a hand.
- **POIs are skeletons of their mockups**: the shrine is a grey torus on a slab (mockup: vine-hung
  monolith, glyph pillars, gull statues, stair, spring pool, jungle); the lookout is a bare frame; the
  wreck is a dark box on flat sand (mockup: heeled hull on the reef under a cliff waterfall + cave).
- **Water** from the beach is an opaque flat cyan plane with a hard seam; no shallows, no foam line.
- Small bugs: the minimap is half black at the pier spawn; the crab shows two labels at once
  ("BIG REEF CRAB" plate + "CRAB · 3 M" readout).

### Bugs found (fix first — Track 0)

| # | Bug | Evidence |
|---|---|---|
| B1 | **Sword reach is Infinity**: `Combat` is handed the `Weapons` manager, which has no `reach` → a swing at a boar 30 m away floats MISS | `main.ts:328`, `ui/Combat.ts:73`, `player/Weapons.ts` (verified) |
| B2 | Death toast "Gored — respawning at the south gate" + `crossbow.addBolts` on the sword shard; dying costs nothing | `main.ts:429` (verified) |
| B3 | Taking damage plays the **landing** thud; no hurt sound, no direction indicator | `main.ts:330` |
| B4 | The iron sword's guardian is skipped: walk onto the deck, it auto-picks within 1.2 m before the sailor has risen | `IronSword.ts:53,269` |
| B5 | Melee hit test is a fixed 28-ray fan from the eye on the first active frame — hits where the blade isn't yet, one target only, **through walls** | `Sword.ts:535-561` |
| B6 | The title-screen hero / deck card is the **AI mockup**, not an in-engine capture: `4e14b5c` ("re-encoded Driftwood thumbs") replaced `743f435`'s in-engine shots — the menu promises a look the game does not have | `src/chunks/thumbs/driftwood-isle*.jpg` (verified by md5) |
| B7 | Point lights added / removed mid-play → likely program recompiles (hitch) | `Cove.ts:187`, `Enemies.ts:181,285`, `IronSword.ts:228,257`, `WeaponPickup.ts:207` |
| B8 | Pine-forest leftovers built on the island: mist + needle-fall particles (`main.ts:175`), an unreachable rifle (`main.ts:221`) | boot cost for nothing |
| B9 | Footsteps: only the south pier is "planks"; jetties, hut, lookout, bridge, wreck play sand / pine needles | `main.ts:331-333` |
| B10 | D38 hooks are dead: `EnemyWorld.night` never read by `sailor.ts`; `Shrine.setDusk` never called (default 0.6 vs documented 0.35) | `registry.ts:127`, `Shrine.ts:8,44` |

## 2. The remaster — tracks and rows

Every row is a deploy with a before / after screenshot in `progress/` (JPEG/WebP, small). New mockups
go in `art/driftwood-isle/round-4-remaster/`. Order inside a track is the build order.

### Track 0 — fixes (S, no pick needed)

| # | Row | Status |
|---|---|---|
| 0.1 | B1 reach: `Weapons` exposes `get reach()` of the current weapon | **done** `7482d5a` (live 7482d5a-mudllr10) — progress/158-feel-01-reach-7m-swing-no-miss.jpg |
| 0.2 | B2 / B3: a per-weapon death message, no bolts on the sword shard, a real hurt sound + a directional hurt arc on the HUD | **done** `fb22c50` (live 11b8a27-mudlrbtn) — progress/159, 160; `audio.hurt()` / `audio.death()` from the sound-agent `e2d0318`, wired `9cb21fa` |
| 0.3 | B7: a fixed pool of point lights, driven by intensity only (never add / remove / toggle `visible`) | **done** `c282abe` (live c282abe-mudm0t0s) — take sword + kill sailor: programs 75→97→137 before, 78→76→76 after; progress/161. Leftover (Pine Hollow, not this plan): the rifle's muzzle light rides the camera-parented model, so the first rifle swap recompiles |
| 0.4 | B8 + B9: skip forest particles / rifle on an ocean shard; footstep surface from a per-module `surfaceAt(x, z)` (planks on every deck) | B8 particles **done** `11b8a27` (the rifle stays: shared kit); B9 footsteps **done** `6f8201a` (sound-agent: planks on every deck, island grass / rock no longer pine needles) |
| 0.6 | Viewmodel: sword length / FOV framing to the mockup (short, low-right), one label per enemy, the minimap at the pier spawn | **done** — framing `20856c1` (low-right, tip below the crosshair; progress/168 → 169); one label per enemy + the pier minimap (deep-sea fill past the chunk edge; a faint seam where the painted shallows meet it) `6d20d9e` (live 6d20d9e-mudojvt4; progress/170 → 173); the hurt arc is island-only; sword mesh → model-agent |
| 0.5 | B6: re-capture the hero + deck card in engine **after** Track L lands (until then restore `743f435`'s captures) | open |

### Track L — the look (lighting, sky, fog, post) — the cheapest 10×

Reference: BotW / Wind Waker (two-band ramp, rim), Firewatch (colour-ramp fog), Sea of Thieves
(clouds), Rime (tinted shadows). One shader patch applied to E8's shared `lowPolyMaterial(sky)` and the terrain, so every model gets it.

| # | Row | Cost | Status |
|---|---|---|---|
| L1 | **Stylized lighting model** on `lowPolyMaterial` + terrain + animals: two-band `smoothstep` ramp on N·L×shadow, **coloured shadows** (blue-violet, never black), a thin Genshin terminator band, rim light on the lit side, hemisphere fill with a warm sand bounce. Lambert-based (cheaper than GGX on the phone) | S | **done** `fb586da` + tuning `cc3cb90` (live cc3cb90-mudmywna) — hard lit / shade step, saturated blue-violet shade, banded warm rim, sun 2.7; one global lighting-chunk patch on the low-poly shard only, Pine Hollow program source unchanged; phone calls pier 86 / beach 89 / wreck 117 / shrine 68 (≤ 0.42 M tris); progress/165-look-l1-tuned-* |
| L2 | **Stylized sky**: replace the photoreal HDRI with a gradient sky dome + faceted cumulus meshes with a silver-lining fresnel, slow drift; keeps the planet + gulls. Prerequisite for day/night | M | **done** `a713e0f` (live a713e0f-mudnjizp) — gradient dome + ring of faceted cumulus, the gas giant crisp and in front of the clouds; Driftwood no longer downloads the HDRI; Pine Hollow SHA unchanged; phone calls 91 / 91 / 115 / 71 (+2); progress/166-look-l2-* |
| L3 | **Colour-ramp fog** (distance × height, sun-side ramp) replacing the exponential fog: the horizon hazes into the sky gradient, hilltops stay crisp | S | **done** `aa7c5f3` (live aa7c5f3-mudot9it) — crisp inside 90 m, ramps into the dome's own gradient out to 1150 m, high ground keeps contrast; modest in portrait (the far sea is a thin band); phone calls pier 84 / beach 82 / wreck 92 / shrine 69; progress/174 |
| L4 | **Cloud shadows**: scrolling noise multiplied into the direct light (1 fetch) | S | **done** `5c3ef8e` (live 5c3ef8e-mudo31dq) — drifting 34 m noise patches dim the lit band to 40 %, no texture, no draws; progress/170-look-l4-* |
| L5 | **Post for the stylized look**: bloom only above 1.0 (sun, glyphs, fireflies, water sparkle), a LUT grade in the one `EffectPass`, AA picked by measurement on the iPhone (MSAA ×4 vs SMAA), n8ao half-res or off on phone (the AO is baked) | S | **done** `cc3cb90` + `368e317` — haze / grain / fringe off, fog ÷3, bloom only above 1.0 (threshold 1.0, knee 0.08, 0.4); AA stays SMAA until an iPhone reading picks; progress/184 |
| L6 | **Terrain**: shadow casting on (desktop; phone if the budget allows), a wet-sand band above the water line, per-face gradients by height / slope, grass-top lips on cliff edges (the mockup look) | M | open |
| L7 | **Day / night clock** (D38): sun + sky + fog presets (dawn, midday, golden hour, night) blended over time; drives `EnemyWorld.night` (sailor on the beach), `shrine.setDusk` (glyphs, fireflies), lanterns | M | **done** `35c88b4` — 20 min day + 4 min moonlit night, dawn / midday / golden / sunset presets on the same CSM lights (none added), drives `enemyWorld.night`, `shrine.setDusk`, `ambience.night`; `?tod=0..1`, `?clock=s`; 0 extra draws; Pine Hollow SHA unchanged; progress/183 |

### Track W — water (the island's signature)

| # | Row | Cost | Status |
|---|---|---|---|
| W1 | **Ocean v2**: depth from the baked terrain height (no depth prepass), Beer–Lambert shallow→deep, **semi-transparent shallows** (the seabed, coral and fish show from the pier), fresnel sky tint, sun glint, 3–4 Gerstner waves | M | **done** `f94c5da` (live in 0cc05de-mudrg8ly — its own deploy went red on E14's `src/explore/art/` vs `.vercelignore`, fixed by E8 in `0cc05de`) — 512² baked sea-floor texture, view-path Beer–Lambert opacity, toon-lit water, fresnel dome reflection, facet glint, one draw; progress/176, 177. **W1b** `43d602e`: the spawn lagoon ~1.7 m deep over a teal seabed, clear turquoise from the pier like the mockup (progress/181); phone calls pier 86 / beach 83 / wreck 97 / shrine 70 |
| W2 | **Foam**: animated shoreline foam lines from depth, crest foam, foam rings around every pile / boulder / hull / swimmer | M | **done** `f94c5da` — breathing shore break line, lines marching over the shallows, crest caps, rings around every collider that pierces the surface (`ocean.foamAround(player.colliders)`) |
| W3 | **One wave function** shared by the shader and TS: the boat, gulls on the water, the swimmer's eye and floating debris ride the swell | S | **done** `f94c5da` — `src/world/waves.ts`: four Gerstner waves shared by the shader and TS; the swimmer rides them `ac6ddbe` (float height tracks `waveHeight`, the pond keeps its sine bob); the boat → model-agent |
| W4 | **Caustics** on the sand + seabed, an underwater fog ramp, god-ray cones, surface splash / bubble particles on water entry, a Snell's-window look from below | M | **in progress** `e151864` — caustics under the sea, a turquoise underwater fog, Snell's window from below (98 calls / 0.52 M underwater; progress/185-look-w4-*); god-ray cones + splash / bubble particles open |
| W5 | **Waterfall v2** (the cove): a vertical faceted sheet with a scrolling foam texture, a mist cloud and a splash ring (today a ribbon lying on the slope) | S | open |

### Track M — models (model-agent, from E8's kit — in flight)

Owner: session `wildshard-singleplayer-8d` (E8), files `src/world/{Boat,Pier,Hut,Lookout,RopeBridge,Wreck,Shrine,Palms,Boulders,Cove,Props,Trailside,Gulls}.ts`,
`src/entities/species/*`, `src/entities/lowpoly.ts`, `src/world/lowpolyKit.ts`. The visual audit's per-model gaps go to them as they land (E7).

| # | Row | Status |
|---|---|---|
| M1 | `lowpolyKit`: one merged mesh + one shared material per model, voxel AO bake | built `8ce9efd`, not wired |
| M2 | Every POI to its mockup (`art/driftwood-*` fp + poi rounds): pier, boat, hut (**with an interior**), lookout, bridge, wreck (**with a hold you can enter**), shrine, cove (**open cave mouth**), palms (fluffy sphere-normal fronds, 3-layer wind), boulders, props | **in progress** — WRECK + enterable hold `0b918f5`; SEA CAVE `29f6541`; RING SHRINE `4c63d43`; HUT (furnished, walkable; anchors npc / hutChest / door / porch) + LOOKOUT (X-braced, banner, zipline post; anchors beacon / shard / zipTop / stairFoot) + the boat on the W3 swell `21ef541` (live 9c975f2-mudw5527; progress/182); pier polish open |
| M3 | Creatures to their mockups: boar, bear, crab, monkey, drowned sailor — silhouettes, one material each (the draw-call fix), squash on hit | **in progress** — one material + one draw per creature, a per-animal body clone takes the hit flash, monkey bite wind-up 0.41 s: `775dca1` (live aa7c5f3-mudot9it; phone wreck pose 115 → 92 calls, pier 84, beach 82, shrine 69; progress/169-model-m3-*); silhouettes to the mockups + the Drowned Captain mesh still open |
| M4 | **Ground cover**: instanced low-poly grass / ferns / flowers near the player (20–25 m, 16 m cells, dithered fade, bends away from the player) | **done (grass)** `236099e` — 5 instanced kinds near the player (grass, fern, hibiscus, daisy, pebble), grow-in 19–25.5 m, bend away from the player, sway on `coverWind`; rope fences on the open paths; phone calls pier 86 / beach 85 / wreck 102 / shrine 76 (≤ 0.53 M tris); progress/186. Open: the beach sand is still bare — per the E43 spawn-cove gap list |
| M5 | Motion: bushes, banner, sails, flags sway (shared wind uniform); sway-aware depth materials so shadows move | open |

### Track C — combat feel ("juice")

| # | Row | Cost | Status |
|---|---|---|---|
| C1 | **Blade-swept hit test** (B5): sample the blade segment each frame of the active window, hit every target it crosses once, occlusion ray to the world | M | **done** `9cb21fa` (live 9cb21fa-mudmcq27) — one slash hits a boar at 85 ms then a crab at 215 ms, a collider wall blocks; progress/162. Phone tier at that pose: 96 calls / 0.39 M tris |
| C2 | **Hit-stop** via a world time-scale hook in `Game.ts` (60 / 90 / 140 ms for combo / finisher / heavy), audio + particles keep running | S | **done** `e2624c4` (live e2624c4-mudmjbap) — `Game.hitStop` + `src/core/time.ts` worldTime, particles on real dt; progress/163-feel-c2-* |
| C3 | **Camera kick** along the swing (spring-damped 1–3° roll / pitch), a −2° FOV punch on heavies, small trauma² shake when hit | S | **done** `f3186df` (live f3186df-mudmrzle) — slash roll 1.57°, heavy pitch 2.54° + FOV 93.8→91.9, an 18-dmg hit shakes ~1°; progress/164 |
| C4 | **Sword trail** (ring buffer of blade base / tip, additive strip, 1 call) + impact particles per material (sand, wood chips, shell shards, sparks) from one pooled instanced system | S | **done** `16ce11f` (live in 66f815d-mudn09bd) — Catmull-Rom trail + pooled instanced debris (shell / wood / sand / sparks, 1 call, precompiled: programs 79→79); progress/165 |
| C5 | **Enemy reactions + telegraphs**: white hit flash, directional flinch, knockback along the swing, stagger on heavy; 400–700 ms wind-ups with a readable pose + sound cue (boar hoof scrape, crab claw raise, sailor lantern flare); a hit interrupts a wind-up; enemy attacks resolve on a hit arc, not a 10 Hz distance check | M | **done** `e85d571` (live e85d571-mudnm4z5) — hit flash, flinch lean, 0.55 / 0.65 s charge wind-ups a hit interrupts, charges connect on a ±50° arc and commit in the last 4.5 m (a sidestep dodges), species strikes only within ±70° of facing, wall clang, IslandSfx wired; progress/166-feel-c5-*, 167. Open → model-agent: monkey bite wind-up 0.32 → ≥ 0.4 s, per-instance body material for the flash. Known: near the shoreline `AnimalManager.steer` bends a boar charge off line |
| C6 | **Player defence**: coordinate with the HUD agent's sword touch work (E11: dodge / lunge / heavy mockups in `art/hud/round-7-sword-touch/`) — the original "no block, no dodge" rule is being revisited there | — | owner: HUD agent |

### Track A — the island adventure (20–30 minutes)

Reference: A Short Hike (breadcrumbs, collectibles that are also gates), Wind Waker islands, Zelda
shrines (teach, develop, twist, resolve in ~5 min). The loop in one line: *the shrine is sealed —
three glyph shards are on the island — each POI guards one — the shrine opens — the Drowned Captain rises — golden hour, the planet
fills the ring.*

| # | Row | Cost | Status |
|---|---|---|---|
| A1 | **The quest spine**: a castaway NPC at the hut gives the one quest; an objective line on the HUD; three **glyph shards** (lookout summit, wreck hold, sea cave) open the **Ring Shrine** → the guardian fight → the golden-hour reward view (the iron sword stays in the wreck hold, D6) | L | **done** `73a87bf` (live 73a87bf-mudo4fir) — Wendell the castaway + dialogue, "The Sealed Ring" objective line (own overlay `src/game/quest/QuestUI.ts`, HUD.ts untouched) with nearest-marker nav, smoke breadcrumb; +3–4 phone calls; progress/165-adv-a1-*. Polish: one NEXT prompt (tap on touch) |
| A2 | **Interactables kit** (reusable for every shard, and the chunk-format config later): chests (+ locked), keys, doors, levers, pressure plates, a pushable barrel — data-driven, no code per placement | M | **done** `15e2b04` (live 15e2b04-mudn6mwu) — data table + validator, 2 BatchedMesh draws, +2–3 phone calls; progress/164-adv-a2-* |
| A3 | **POI mini-puzzles**: lookout — climb and light the beacon; wreck hold — a key / lever sequence below deck with the sailor; sea cave — a pressure-plate tide puzzle; each ends in a shard | M | **done** `cb27c8f` (live cb27c8f-muds4pgp) — lookout beacon → shard; wreck hold: sailor → key → padlocked pump → winch → strongbox (levers latch); sea cave: barrel on one plate + you on the other → gate latches → alcove shard; verified end-to-end on the model-agent's anchors; also fixed the sailor's key drop (main.ts reassigned `animals.onKill` after installAdventure); progress/179 |
| A4 | **Breadcrumbs + collectibles**: 12–15 sea-glass pieces along paths, gull flights toward POIs, a dive treasure, a vista bench; a **Driftwood achievement + title table** | S | **done** `f4cbed3` (live f4cbed3-mudpc2n1) — 15 sea glass, a dive treasure, a vista bench, a 9-row Driftwood achievement / title table; progress/166-adv-a4-*. Open: gull breadcrumb flights → model-agent (Gulls.ts). Achievements-row overflow fixed in `27ebb56` |
| A5 | **Map v2**: the island's own POIs on the full map with discovery (not Pine Hollow's cabins / pond), a quest marker | S | **done** `27ebb56` (live 27ebb56-mudptzrh) — 10 island places with discovery + pulsing quest markers, Pine Hollow map unchanged; + the 390 px Achievements-row wrap (`.ws-gmenu-agoal`); progress/167-adv-a5-* |
| A6 | **Enemy ecology**: respawn on a timer / at night, camps per POI, the guardian boss (the Drowned Captain: a 3-phase fight in the shrine pool) | M | **done** — the Drowned Captain (3-phase boss in the shrine pool, boss bar; `src/entities/species/captain.ts`, mesh remodel queued with the model-agent) + the golden-hour reward view (planet framed in the ring, DayNight eased to golden hour) `fdc2db8`; respawn out of sight in `src/game/quest/Ecology.ts` (vitest timers) `2b8ec4b`; the guarded iron sword (B4 / D6) `5e37e16`; dive treasure re-sunk after W1b `cd230b2` (live cd230b2-mudxevne); progress/180, 185-adv-a6-*; reload fix `d9749dc` (the sword is guarded whenever a drowned sailor is alive — after a reload or a night respawn you beat him again; `src/game/quest/guards.ts`, 5 tests) + thinner, leaning, broken campfire smoke |
| A7 | **Traversal reward**: a zipline from the lookout down to the cove; rope bridge camera sway | S | **done** `775bdfa` (live 775bdfa-mudzfboq) — launch deck on the headland cliff lip on the zipTop → sea-cave line, 57 m cable to the cove beach, "Zip It / Line Rider" achievement + map place; rope-bridge camera sway; progress/194 |

### Track S — sound

| # | Row | Cost | Status |
|---|---|---|---|
| S1 | **Zoned ambience**: surf on a shoreline line emitter (one panner moved to the nearest shore point), wind in palms driven by the same wind uniform as the sway, jungle bed (shrine), cove + waterfall, lookout wind | M | **done** `45bd65b` (live 45bd65b-mudmuv6d) — 11 zones logged (pier … underwater), hold / cave walls muffle outdoors, night variant waits on DayNight (`ambience.night`), `ambience.onZone` = the music hook; 11 µs / frame, no per-frame allocs |
| S2 | **Reverb zones**: generated impulse responses (hold 0.6 s, cave 1.5 s, shrine 2.5 s), 300 ms send crossfades; underwater low-pass ramp + bubbles + surface-crossing splash | S | **done** `45bd65b` — generated IRs 0.60 / 1.57 / 2.59 s (hold / cave / shrine); underwater 500 Hz in 150 ms + bubble bed; hold reverb switches on when `Wreck.holdBounds` lands (model-agent) |
| S3 | **Combat layers**: whoosh pitched by swing speed + impact transient + material body + enemy vocal, ±5 % pitch; hurt / death vocals | S | **done** `66f815d` (live 66f815d-mudn09bd) — `islandSfx.whoosh / impact / vocal / windup / plunge / animal`; the calls from Sword / enemies are the feel-agent's (C4 / C5) |
| S4 | **Interactable sounds** for the A2 kit: chest creak + lid, locked rattle, lever, stone plate (press / release), plank door, iron grate, chimes (sea glass / keys / loot), glyph shard, beacon ignite — `islandSfx.interact(sound, at?, opts)` | S | **done** `db72c3c` (live db72c3c-mudnfe1c) |
| S4 | **Music**: the Driftwood theme + adaptive layers (calm / combat / discovery stinger / shrine) come from MUSIC v2 (E5, `docs/plans/MUSIC.md`) — this plan only provides the hooks | — | owner: E5 |

### Track X — the big bets (E52, 2026-09-23: "whatever it takes")

| # | Row | Owner | Status |
|---|---|---|---|
| X1 | **Learned colour LUT**: a 3D LUT fitted from the 9 capture ↔ mockup pairs, the last grade step on the low-poly shard; ΔE region table every loop round | look-agent | in flight |
| X2 | **Blender-built island** (spawn cove first): script-driven Blender (Geometry Nodes scatter, sculpted rocks, CC0 / generated assets), **Cycles-baked GI + AO**, glTF export; in-game toggle `?island=blender|procedural` + a menu switch; 3×3 sheets blender vs procedural | blender-agent | in flight — milestone 1 `dd5edf1`: scripts/blender/ + `pnpm blender:island`, Cycles-baked terrain AO + sun bounce and per-prop AO, meshopt glTF in public/assets/models/driftwood-blender/, toggle `?island=blender\|procedural` + Settings ▸ Graphics ▸ Island; phone at P 93–117 calls / 1.1–1.6 M tris (procedural 80–97 / 0.77–0.83 M) — tris need LODs before it goes island-wide |
| X3 | **Assets**: PyTorch (MPS) + Hunyuan3D-2 / TRELLIS image-to-3D, hero props from the concept art decimated to faceted low-poly; a CC0 library (Quaternius / KayKit / Kenney / Poly Pizza) recoloured; comparison board | asset-agent | in flight |
| X4 | **Painted 360° horizon** band (day + night), stitched codex segments matched to in-game headings, `src/world/HorizonMatte.ts` | horizon-agent | **done** `676c869` (live 676c869-muedkz4b) — six codex-edited 60° captures stitched into 4096×512 day + night WebPs (148 + 166 KB, loaded after ws:ready, 1.5 s fade-in), one unlit band at 2300 m, day↔night on `DayNight.night`, golden hour tinted; the Horizon.ts islet rings hide once it shows (`?matte=0` keeps them); phone −2 calls at every FP yaw; art/driftwood-isle/round-9-horizon/sheet-before-after.jpg. Open: soft on desktop, pale fogged far-sea strip from high cameras, no separate dusk painting |
| X5 | **WebGPU + TSL**: `?gpu=webgpu` path (TSL toon, sky, fog, ocean, post), then compute-shader foliage (100 k+ blades), raw WebGPU where TSL is the bottleneck; WebGL stays default until it wins on the iPhone | webgpu-agent | in flight |

### Perf gate (every track)

PLAY-PERF's finish line already covers Driftwood (pier, beach, wreck cove, ring shrine: ≤ 150 calls,
≤ 2.0 M tris on `?tier=phone`, iPhone ≥ 55 fps). Every row here measures `game.lastFrame` at those
four poses before and after, and puts the numbers in its commit. Budget additions for the remaster: palms / bushes / rocks
become instanced with cell culling (the forest's `Culling.ts` path), animals one material each, ocean
chunked + culled.

## 3. Decisions (the user's, 2026-09-22)

| # | Question | Pick |
|---|---|---|
| D1 | Lighting | **toon two-band ramp + coloured shadows + rim** (BotW / Wind Waker) |
| D2 | Sky | **stylized gradient sky + faceted cumulus** replaces the photoreal HDRI |
| D3 | Day / night | **a real clock now**: **20 min day / 4 min night**; night is moonlit blue and playable, not black |
| D4 | Damage numbers | **keep the MMO floats** (Driftwood too) |
| D5 | Adventure spine | **castaway + three glyph shards → Ring Shrine → Drowned Captain → golden-hour reward** |
| D6 | Iron sword | **stays in the wreck — in the new enterable hold, guarded**: beat the drowned sailor to take it |
| D7 | Staffing | **four track agents now** (look + water, feel + fixes, adventure, sound) + E8 on models |
| D8 | Scope | **Driftwood only** — Pine Hollow stays photoreal PBR, byte-for-byte |
| D9 | Textures | **the no-textures rule is lifted** (E52): lightmaps, palette atlases, image-to-3D textures, a painted horizon — within the phone budget |
| D10 | Engine | **whatever it takes** (E52): GPU torch / Blender / image-to-3D installs, a Blender-built island behind an in-game toggle, WebGPU + TSL (+ raw WebGPU where it pays) — staged behind flags, WebGL stays default until it wins |

## 4. How it gets built — owners and files

Same as the night it was built: parallel agents with hard file ownership, commits by explicit path,
small deploys. Every agent reads `AGENTS.md` and `docs/SUBAGENT-BRIEF.md` first. **Pine Hollow must stay
byte-for-byte** (D8): every change is behind `chunk.style === 'lowpoly'` / `chunk.ocean`.

| Agent | Rows | Owns (may edit) | Coordinates with |
|---|---|---|---|
| **model-agent** (this session's subagent; took Track M over from E8 on 2026-09-22 when the user moved E8 onto EXPLORE-WORLD) | M1–M5, sword + iron-sword geometry and the double linear-conversion fix | `src/world/{Boat,Pier,Hut,Lookout,RopeBridge,Wreck,Shrine,Palms,Boulders,Bushes,Cove,Props,Trailside,Gulls,lowpolyKit}.ts`, `src/entities/species/*`, `src/entities/lowpoly.ts`, sword meshes | everyone: the wreck hold and cave interior are its geometry; the others place things in them |
| **look-agent** | L1–L7, W1–W5 | new `src/world/stylize.ts` (the ramp patch; `lowPolyMaterial` in lowpolyKit calls it — one line, E8 adds it), new `src/world/DayNight.ts` (the clock, D3), `Sky.ts` / `Atmosphere.ts` / `BakedSky.ts` (low-poly path only), `Ocean.ts`, `Seabed.ts`, `Horizon.ts`, `Terrain.ts` (low-poly path), new `src/world/Waterfall.ts` (E8 places it in the cove), `Game.ts` `buildComposer()` for the low-poly grade, `src/chunks/driftwood-isle.ts` sky / atmosphere / grade fields | E8 (stylize hook, sway depth), feel-agent (`Game.ts`: look owns the composer, feel owns the time scale), PLAY-PERF |
| **feel-agent** | 0.1–0.3, 0.6 (framing), C1–C5 | `Sword.ts` (hit test, trail, framing — not the mesh), `SwordMoves.ts`, `Weapons.ts`, `ui/Combat.ts`, `Game.ts` time-scale hook, new `src/player/CameraFX.ts`, new `src/fx/Impacts.ts`, `entities/{Animal,AnimalManager,Enemies}.ts` (reactions, telegraphs, attack arcs), `WeaponPickup.ts` + light pool, `main.ts` combat / death / hurt lines | E8 (anything in `species/*`: ask first), HUD agent w6 (hurt arc in `HUD.ts`, sword touch E11), sound-agent (hurt / impact sounds) |
| **adventure-agent** | A1–A7, B4 + D6 (the guarded iron sword) | new `src/game/quest/*`, new `src/world/interact/*` (chests, keys, doors, levers, plates, barrel), new `src/entities/npc/*` (the castaway, built with lowpolyKit), `ui/Map.ts` (island POIs), `game/achievements.ts` (Driftwood table), new `src/world/Zipline.ts`, `IronSword.ts` pickup logic, the Drowned Captain's AI (new species file; its mesh from E8) | E8 (hold / cave / shrine geometry), feel-agent (`Enemies.ts` respawn), HUD agent (objective line) |
| **sound-agent** | S1–S3, B9 footsteps, the audio half of B3 | `src/audio/*` except `Music.ts` / `score/*` (E5), `main.ts` footstep lines | E5 music (hooks only), feel-agent (combat calls) |
| **this session (E7)** | 0.4 (B8), 0.5 (B6 hero re-capture), integration, the plan + ASKS rows, deploy watch | `docs/plans/DRIFTWOOD-REMASTER.md`, E7 row | all |

Rules for this plan (on top of AGENTS.md):
- **Shared files** (`src/main.ts`, `Game.ts`, `docs/tasks/ASKS.md`) carry other agents' uncommitted hunks. Stage only
  your own: if `git diff <file>` shows foreign hunks, commit through a private index pinned to HEAD
  (`GIT_INDEX_FILE=… git read-tree HEAD`, `git apply --cached` of a patch holding only your hunks,
  `git commit-tree -p HEAD`, `git update-ref refs/heads/main $C $HEAD`), then `git reset -q -- <your paths>`
  so the shared index agrees with HEAD.
- **Push**: four gates on a clean `git archive HEAD` export, then `lockf -k -t 900 .git/push.lock git push origin main`;
  watch the run, check `/version.json`.
- **Screenshots**: headless agent-browser, your own session name, before + after at 390×844, small
  WebP / JPEG in `progress/` (next free number); always `close` the session.
- **Perf**: `game.lastFrame` calls / tris at the four Driftwood poses (pier, beach, wreck cove, ring shrine)
  on `?tier=phone`, before and after, in the commit message.
- Only this session edits this plan and the E7 row; report what landed (commit, build id, screenshot)
  to the integrator and it flips the rows.
