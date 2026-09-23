# Driftwood Isle — the remaster (10× quality and polish)

**State:** `in progress` 2026-09-22 — the user: "we will need a full remaster"; audit done (E7), every pick made (D1–D8). Building: Track M = E8 model agent (`8ce9efd` lowpolyKit); Tracks L + W = look-agent, 0 + C = feel-agent, A = adventure-agent, S = sound-agent (this session integrates, deploys, screenshots). Perf is gated by PLAY-PERF's four Driftwood poses.

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
| 0.1 | B1 reach: `Weapons` exposes `get reach()` of the current weapon | open |
| 0.2 | B2 / B3: a per-weapon death message, no bolts on the sword shard, a real hurt sound + a directional hurt arc on the HUD | open |
| 0.3 | B7: a fixed pool of point lights, driven by intensity only (never add / remove / toggle `visible`) | open |
| 0.4 | B8 + B9: skip forest particles / rifle on an ocean shard; footstep surface from a per-module `surfaceAt(x, z)` (planks on every deck) | open |
| 0.6 | Viewmodel: sword length / FOV framing to the mockup (short, low-right), one label per enemy, the minimap at the pier spawn | open (sword geometry → E8) |
| 0.5 | B6: re-capture the hero + deck card in engine **after** Track L lands (until then restore `743f435`'s captures) | open |

### Track L — the look (lighting, sky, fog, post) — the cheapest 10×

Reference: BotW / Wind Waker (two-band ramp, rim), Firewatch (colour-ramp fog), Sea of Thieves
(clouds), Rime (tinted shadows). One shader patch applied to E8's shared `lowPolyMaterial(sky)` and the terrain, so every model gets it.

| # | Row | Cost | Status |
|---|---|---|---|
| L1 | **Stylized lighting model** on `lowPolyMaterial` + terrain + animals: two-band `smoothstep` ramp on N·L×shadow, **coloured shadows** (blue-violet, never black), a thin Genshin terminator band, rim light on the lit side, hemisphere fill with a warm sand bounce. Lambert-based (cheaper than GGX on the phone) | S | open (D1 picked) |
| L2 | **Stylized sky**: replace the photoreal HDRI with a gradient sky dome + faceted cumulus meshes with a silver-lining fresnel, slow drift; keeps the planet + gulls. Prerequisite for day/night | M | open (D2 picked) |
| L3 | **Colour-ramp fog** (distance × height, sun-side ramp) replacing the exponential fog: the horizon hazes into the sky gradient, hilltops stay crisp | S | open |
| L4 | **Cloud shadows**: scrolling noise multiplied into the direct light (1 fetch) | S | open |
| L5 | **Post for the stylized look**: bloom only above 1.0 (sun, glyphs, fireflies, water sparkle), a LUT grade in the one `EffectPass`, AA picked by measurement on the iPhone (MSAA ×4 vs SMAA), n8ao half-res or off on phone (the AO is baked) | S | open |
| L6 | **Terrain**: shadow casting on (desktop; phone if the budget allows), a wet-sand band above the water line, per-face gradients by height / slope, grass-top lips on cliff edges (the mockup look) | M | open |
| L7 | **Day / night clock** (D38): sun + sky + fog presets (dawn, midday, golden hour, night) blended over time; drives `EnemyWorld.night` (sailor on the beach), `shrine.setDusk` (glyphs, fireflies), lanterns | M | open (D3: 20 + 4 min) |

### Track W — water (the island's signature)

| # | Row | Cost | Status |
|---|---|---|---|
| W1 | **Ocean v2**: depth from the baked terrain height (no depth prepass), Beer–Lambert shallow→deep, **semi-transparent shallows** (the seabed, coral and fish show from the pier), fresnel sky tint, sun glint, 3–4 Gerstner waves | M | open |
| W2 | **Foam**: animated shoreline foam lines from depth, crest foam, foam rings around every pile / boulder / hull / swimmer | M | open |
| W3 | **One wave function** shared by the shader and TS: the boat, gulls on the water, the swimmer's eye and floating debris ride the swell | S | open |
| W4 | **Caustics** on the sand + seabed, an underwater fog ramp, god-ray cones, surface splash / bubble particles on water entry, a Snell's-window look from below | M | open |
| W5 | **Waterfall v2** (the cove): a vertical faceted sheet with a scrolling foam texture, a mist cloud and a splash ring (today a ribbon lying on the slope) | S | open |

### Track M — models (E8, the model agent — in flight)

Owner: session `wildshard-singleplayer-8d` (E8), files `src/world/{Boat,Pier,Hut,Lookout,RopeBridge,Wreck,Shrine,Palms,Boulders,Cove,Props,Trailside,Gulls}.ts`,
`src/entities/species/*`, `src/entities/lowpoly.ts`, `src/world/lowpolyKit.ts`. The visual audit's per-model gaps go to them as they land (E7).

| # | Row | Status |
|---|---|---|
| M1 | `lowpolyKit`: one merged mesh + one shared material per model, voxel AO bake | built `8ce9efd`, not wired |
| M2 | Every POI to its mockup (`art/driftwood-*` fp + poi rounds): pier, boat, hut (**with an interior**), lookout, bridge, wreck (**with a hold you can enter**), shrine, cove (**open cave mouth**), palms (fluffy sphere-normal fronds, 3-layer wind), boulders, props | in flight |
| M3 | Creatures to their mockups: boar, bear, crab, monkey, drowned sailor — silhouettes, one material each (the draw-call fix), squash on hit | in flight |
| M4 | **Ground cover**: instanced low-poly grass / ferns / flowers near the player (20–25 m, 16 m cells, dithered fade, bends away from the player) | open (M or L, ask E8) |
| M5 | Motion: bushes, banner, sails, flags sway (shared wind uniform); sway-aware depth materials so shadows move | open |

### Track C — combat feel ("juice")

| # | Row | Cost | Status |
|---|---|---|---|
| C1 | **Blade-swept hit test** (B5): sample the blade segment each frame of the active window, hit every target it crosses once, occlusion ray to the world | M | open |
| C2 | **Hit-stop** via a world time-scale hook in `Game.ts` (60 / 90 / 140 ms for combo / finisher / heavy), audio + particles keep running | S | open |
| C3 | **Camera kick** along the swing (spring-damped 1–3° roll / pitch), a −2° FOV punch on heavies, small trauma² shake when hit | S | open |
| C4 | **Sword trail** (ring buffer of blade base / tip, additive strip, 1 call) + impact particles per material (sand, wood chips, shell shards, sparks) from one pooled instanced system | S | open |
| C5 | **Enemy reactions + telegraphs**: white hit flash, directional flinch, knockback along the swing, stagger on heavy; 400–700 ms wind-ups with a readable pose + sound cue (boar hoof scrape, crab claw raise, sailor lantern flare); a hit interrupts a wind-up; enemy attacks resolve on a hit arc, not a 10 Hz distance check | M | open (D4: floats stay) |
| C6 | **Player defence**: coordinate with the HUD agent's sword touch work (E11: dodge / lunge / heavy mockups in `art/hud/round-7-sword-touch/`) — the original "no block, no dodge" rule is being revisited there | — | owner: HUD agent |

### Track A — the island adventure (20–30 minutes)

Reference: A Short Hike (breadcrumbs, collectibles that are also gates), Wind Waker islands, Zelda
shrines (teach, develop, twist, resolve in ~5 min). The loop in one line: *the shrine is sealed —
three glyph shards are on the island — each POI guards one — the shrine opens — the Drowned Captain rises — golden hour, the planet
fills the ring.*

| # | Row | Cost | Status |
|---|---|---|---|
| A1 | **The quest spine**: a castaway NPC at the hut gives the one quest; an objective line on the HUD; three **glyph shards** (lookout summit, wreck hold, sea cave) open the **Ring Shrine** → the guardian fight → the golden-hour reward view (the iron sword stays in the wreck hold, D6) | L | open (D5 + D6 picked) |
| A2 | **Interactables kit** (reusable for every shard, and the chunk-format config later): chests (+ locked), keys, doors, levers, pressure plates, a pushable barrel — data-driven, no code per placement | M | open |
| A3 | **POI mini-puzzles**: lookout — climb and light the beacon; wreck hold — a key / lever sequence below deck with the sailor; sea cave — a pressure-plate tide puzzle; each ends in a shard | M | open |
| A4 | **Breadcrumbs + collectibles**: 12–15 sea-glass pieces along paths, gull flights toward POIs, a dive treasure, a vista bench; a **Driftwood achievement + title table** | S | open |
| A5 | **Map v2**: the island's own POIs on the full map with discovery (not Pine Hollow's cabins / pond), a quest marker | S | open |
| A6 | **Enemy ecology**: respawn on a timer / at night, camps per POI, the guardian boss (the Drowned Captain: a 3-phase fight in the shrine pool) | M | open |
| A7 | **Traversal reward**: a zipline from the lookout down to the cove; rope bridge camera sway | S | open |

### Track S — sound

| # | Row | Cost | Status |
|---|---|---|---|
| S1 | **Zoned ambience**: surf on a shoreline line emitter (one panner moved to the nearest shore point), wind in palms driven by the same wind uniform as the sway, jungle bed (shrine), cove + waterfall, lookout wind | M | open |
| S2 | **Reverb zones**: generated impulse responses (hold 0.6 s, cave 1.5 s, shrine 2.5 s), 300 ms send crossfades; underwater low-pass ramp + bubbles + surface-crossing splash | S | open |
| S3 | **Combat layers**: whoosh pitched by swing speed + impact transient + material body + enemy vocal, ±5 % pitch; hurt / death vocals | S | open |
| S4 | **Music**: the Driftwood theme + adaptive layers (calm / combat / discovery stinger / shrine) come from MUSIC v2 (E5, `docs/plans/MUSIC.md`) — this plan only provides the hooks | — | owner: E5 |

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

## 4. How it gets built — owners and files

Same as the night it was built: parallel agents with hard file ownership, commits by explicit path,
small deploys. Every agent reads `AGENTS.md` and `docs/SUBAGENT-BRIEF.md` first. **Pine Hollow must stay
byte-for-byte** (D8): every change is behind `chunk.style === 'lowpoly'` / `chunk.ocean`.

| Agent | Rows | Owns (may edit) | Coordinates with |
|---|---|---|---|
| **model agent** (E8, session `wildshard-singleplayer-8d`) | M1–M5, sword + iron-sword geometry and the double linear-conversion fix | `src/world/{Boat,Pier,Hut,Lookout,RopeBridge,Wreck,Shrine,Palms,Boulders,Bushes,Cove,Props,Trailside,Gulls,lowpolyKit}.ts`, `src/entities/species/*`, `src/entities/lowpoly.ts`, sword meshes | everyone: the wreck hold and cave interior are its geometry; the others place things in them |
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
