# Plan: Nine Dragon Stack (九龍疊城), shard 4 — the vertical city (E169)

**State:** `in progress` 2026-09-25 — P0 pre-production is being built by the E169 session (concept art, art-style research + board, spawn mockups, the from-scratch clean-room spawn, the COMING SOON card). Nothing from P1 on is approved: the shard itself is not built until Jake says go.

## 0. Read this first

Jake's words (E169, 2026-09-25):

> Chongqing meets Cyberpunk 2077 … an insanely unique shard that uses the maximum height of the chunk server and builds an
> insanely vertically challenged level … strong inspiration by the Kowloon Walled City … The starting location is half way
> up in the sky but it has 5+ levels that all feel like the ground level … Art style is Chinese, cyberpunk, futuristic.
> It's still built on the engine.

> We can break and modify the spec 500m high, 250 above and 250 below. Modify the spec of the shards for this one to make
> it absolutely epic. And it's fine to do 500x500x500 long term.

> How are you going to do a fully custom art style for this? Do research in what would be the most insanely epic and wow.

**Scope of E169 (P0) — and its cut-off.** Built now: the concept art, this plan, the mockups, the art-style research, the
level-select COMING SOON assets, a from-scratch clean-room HTML build of the starting spawn with the weapon of choice, and
the COMING SOON card in the live game with screenshots from that clean room. **The shard is not implemented.** Every row
from P1 on waits for Jake's go.

**The rules of this plan:**
1. **A 500 m cube.** Shard 4 breaks the 500 × 500 × 200 m slab spec (FUNDAMENTALS.md): 500 × 500 m footprint, **250 m
   under the surface datum and 250 m above it**. Jake OK'd 500³ for other shards long-term, so height becomes a per-shard
   field (P2-E1), never a second constant.
2. **Every stratum feels like the ground.** Five or more of the nine strata must pass the "ground test" (§3.2) from a
   standing player's eye. Only the Wells show the real height.
3. **Its own look.** Driftwood is toon, Nalati painterly, Pine Hollow photoreal PBR; shard 4 gets a fully custom style
   (§5). The look is the shard's data, never a branch in core.
4. **A module, not branches.** Shard 4 is built in GAME-NORMALIZATION's shard-module shape (`src/chunks/nine-dragon-stack/`
   `def.ts` + `index.ts`), with zero `slug ===` outside its folder. If GAME-NORMALIZATION has not landed when the build
   starts, the build still uses the module shape and adds the extension points it needs as core fields.
5. **The baseline HUD, nothing custom.** Jake (2026-09-25): Driftwood carries the baseline HUD; Pine Hollow and Nalati
   add shard-specific pieces. Shard 4 uses the baseline HUD with **no shard-specific HUD elements** — "the absolute
   cleanest way". Every new verb maps onto an existing control and every new fact onto an existing slot (§3.4).
6. **Phone first.** The iPhone home-screen PWA is the target: ≥ 30 fps at 2× render scale, never a render-scale cut
   (memory: no dynamic resolution). A dense city is a draw-call problem first (§6.3).

## 1. The pitch

A single, impossibly dense megablock fills the whole cube, from the flooded **Sump** 250 m below the surface to an antenna
**Crown** 250 m above it. It is built like the Kowloon Walled City — every block leaning on the next, alleys two metres
wide, no planning, no light — and it climbs like Chongqing, the city where the 22nd floor is a street and a monorail runs
through a tower. Its nine street strata are the **nine dragons** (九龍, the meaning of "Kowloon"). Between every two strata
sit ~12 floors of flats, stairwells and workshops: about **120 floors** in all.

You wake on the sixth, **Lantern Square, +125 m: halfway up the sky**, with 375 m of city under your feet and 125 m more
above — and it feels exactly like standing in a town square.

**Name.** *Nine Dragon Stack*, mark 九龍疊城 (traditional, Hong Kong) — signage in-world mixes traditional (the old
Kowloon strata, low) and simplified (the Chongqing-built strata, high): the Stack's history is readable in its characters.

## 2. The cube

### 2.1 The nine strata

| # | Stratum | Height | Ground | Sky above it | Colour key | Feels like |
|---|---|---|---|---|---|---|
| 1 | **The Sump** | −250 … −210 m | walkways over black water | the rock vault, drip lines | jade algae | flooded under-river, pump halls, sampans, eels |
| 2 | **Shelter Market** | −170 … −130 m | carved rock floor | vaulted tunnels + neon | hotpot red | WWII air-raid shelters turned hotpot halls + night market (Chongqing) |
| 3 | **Rail Cut** | −90 … −50 m | platforms + service road | sky screens on the tunnel crown | sodium amber | the monorail bored through the rock and through a tower (Liziba) |
| 4 | **Old Street** | −10 … +15 m | the original street (datum 0) | sky screens, 3 m of cable and nets | fluorescent green | black alleys, water pipes, unlicensed dentists, noodle works (Kowloon) |
| 5 | **Terrace Row** | +55 … +85 m | stepped terraces + stair-streets | sky screens | tea gold | teahouses, 18 Steps, Hongyadong's stilt terraces |
| 6 | **Lantern Square** ★ | +115 … +135 m | a plaza of granite flagstones | sky screens + a real sky strip | lantern red | the town square: paifang, banyan, mahjong, shrine, stalls |
| 7 | **Cable Deck** | +155 … +180 m | skybridges, ropeway stations | the real sky between towers | cable cyan | Yangtze cableway, gondolas between towers |
| 8 | **Antenna Forest** | +195 … +225 m | roof decks of the lower towers | the real sky | laundry white / pigeon grey | shanties, water tanks, laundry lines, pigeon coops |
| 9 | **The Crown** | +230 … +250 m | the true roof | the real sky | violet dusk | rooftop gardens, the VTOL pad, cargo drones skimming the roofs (Kai Tak) |

Strata 2–8 all pass the ground test; that is seven "ground levels", against Jake's "5+".

### 2.2 Footprint and the Wells

- **The Stack** covers ~380 × 380 m at the bottom, stepping back like Chongqing's hillside terraces to ~220 × 220 m at the
  Crown. Around it, the slab's outer 60 m are the **cliff faces**: 250 m of rock riddled with lit windows and stilt
  houses (diaojiaolou 吊脚楼) hanging off it — the view you get from the grid highway.
- **The Yamen Well** (centre, ~40 m across, 500 m deep) is the landmark and the spine. At its foot on Old Street stands
  the old magistrate's **yamen** (the only building the real Walled City kept); under it, the Sump's black water.
  Every stratum has a balustrade on its rim.
- **Four Light Wells** (~15 m, one per quadrant) — the secondary shafts, each with a public lift tower.
- **Safety nets.** Kowloon's alleys had wire nets to catch falling rubbish; the Wells have a sagging net at every stratum
  line. A fall drops you at most one stratum, into a net that bounces you out onto the next rim (§4.3).

### 2.3 Entrances

The grid highway meets the cube at datum 0, so the **four gates** open onto Old Street at the edge midpoints (15 m
roads, 60 m in, FUNDAMENTALS). The south gate is the ceremonial one. The monorail enters from the east cliff face at
Rail Cut (−70 m) and leaves by the west; the cableway strings from the Cable Deck (+165 m) to outrigger masts on the
four cliff tops.

### 2.4 The spawn: Lantern Square (+125 m)

On the south rim of the Yamen Well, facing north across the square. Blue hour into night, light drizzle, wet granite
that mirrors the neon. The paifang gate outlined in neon tubes, red paper lanterns, a banyan in a stone planter,
mahjong tables, a noodle stall's steam, a shrine with incense. The towers climb 125 m more out of frame, walls of signs
(麵 · 牙科 · 火鍋 · 茶 · 藥房 · 旅館), air-con units, cages, laundry. A skybridge and the monorail's high loop cross the
square's sky; at the top, a strip of violet real sky with the Crown's antennas and a cargo drone. On the left the
balustrade over the Well: 375 m of lit balconies falling away through layer after layer of fog.

The spawn frame is the one the mockups (`art/nine-dragon-stack/round-2-mockups/`) and the clean room
(`src/dev/nine-dragon/`) reproduce.

## 3. The design devices

### 3.1 Why every stratum feels like the ground

1. **A continuous street slab** with shopfronts, trees in planters, parked scooters, puddles, crowds — a real floor, not
   a balcony.
2. **Sky screens.** The underside of the stratum above is tiled with LED panels that play a daytime sky (a class joke in
   the fiction: the rich of the Crown own the real sky; everyone below gets a rendered one). They also give every
   stratum a "sky" for lighting and for the player's eye. What they play is a slow pan across a **blue-green shanshui
   scroll** — Wang Ximeng's *A Thousand Li of Rivers and Mountains* (千里江山图, 1113) — at a visible LED dot pitch: the
   Stack's fake sky is a Song-dynasty painting (found in the Jiehua Neon mockups, round 4).
3. **Fog banks** — Chongqing is the "fog city" (雾都): a fog layer sits on every stratum line and swallows the drop at
   every edge.
4. **Occluded edges.** A stratum's street never ends at a railing onto the void, except at the Wells and the cliff-face
   overlooks, which are placed on purpose as reveals.

### 3.2 The ground test (a gate, per stratum)

From a standing eye, looking level, in any direction from any street point: ≥ 70 % of the lower half of the frame is
floor or street furniture; a "sky" (screens or real) fills the top; the true drop is visible only within 15 m of a Well
rim or an overlook. Checked by a capture script over a grid of points per stratum (P3-G4).

### 3.3 Vertical wayfinding

- **No HUD ladder** (rule 5): the stratum is told by the world — every stratum's name is painted large at its lift
  towers and Well rims, the minimap shows only the current stratum's floor plan, and the quest chip's target names
  where to go ("SHRINE 64 M").
- **The colour script** (§2.1's colour key): each stratum has one dominant neon hue, so a glance says where you are.
- **The Well is the compass.** Every stratum's minimap puts the Yamen Well at its centre.
- **Lift chimes**: each lift tower plays the stratum's note of the shard's motif on arrival.

### 3.4 On the baseline HUD (rule 5)

| Shard-4 need | Baseline element it uses |
|---|---|
| Fire the Fei Zhua | **LOCK** also targets dragon hooks in view (gold outline on the hook); **JUMP** with a hook locked fires and zips |
| Yank an enemy | **LOCK** on the enemy, **HOLD ATTACK** (the heavy) becomes the yank when the Fei Zhua is ready |
| Umbrella glide | **hold JUMP** in the air opens the umbrella; release folds it. **HOVER** stays the baseline hoverboard |
| Which stratum am I on | the minimap draws the current stratum only; the world paints each stratum's name at lifts and Well rims |
| Where next | the quest chip: "RED ENVELOPE 0/9 │ SHRINE 64 M" |
| Lifts, cable cars, the monorail | the baseline "use" prompt near a door / stop; the ride itself needs no HUD |

## 4. Gameplay

### 4.1 The weapon of choice: the Neon Jian + the Fei Zhua

- **Neon Jian (霓虹劍)** — a straight double-edged jian: dark steel, a thin glowing heat edge, faint cloud-scroll
  etching, a brass dragon-head guard, black-lacquer grip, a red silk tassel and a yellow paper talisman (符) at the
  pommel. Close quarters suit two-metre alleys, and it rides the game's sword (ATTACK / HOLD = HEAVY, the lock-on, the
  dodge T).
- **Fei Zhua (飛爪, "flying claw")** — a wrist grapple on the left forearm: brass-and-carbon launcher, folded three-talon
  claw, glowing mono-filament line. It **hooks** onto brass *dragon hooks* (on signs, cable masts, balconies) to swing and
  zip, and in combat it **yanks** an enemy toward you or off a ledge. One tool, two verbs: that is shard 4's signature.

### 4.2 Traversal verbs

| Verb | What | Where | Engine |
|---|---|---|---|
| Walk / sprint | streets, alleys | every stratum | the player on colliders (step 0.35 m, 40°) |
| **Stair-streets** | Chongqing's endless stairs between terraces | 4 → 5 → 6 | `treads` colliders (rise ≤ 0.35, tread ≥ 0.36) |
| **Public lifts** | four lift towers in the Light Wells, one stop per stratum | all 9 | kinematic bodies (`follows`), the baseline use prompt |
| **Fei Zhua hook** | aim at a dragon hook → pull-zip or swing | every stratum, dense at Well rims | a rope constraint on the capsule; a hook-target registry |
| **Laundry-line zip** | hook a line, slide down it | 7 → 8, 5 → 4 | a spline follower |
| **Umbrella glide** (油紙傘) | oil-paper umbrella: slow fall down a Well, steer, no lift | the Wells | a drag + max-fall-speed mode, opened by holding JUMP in the air (§3.4) |
| **Cable cars** | ride between towers and to the cliff masts | Cable Deck | kinematic cabins on splines |
| **Monorail** | a train through the rock and through a tower | Rail Cut, a high loop to 6 | a ride on a kinematic body; no ride HUD (§3.4) |
| **Nets** | fall catchers under every Well stratum line | the Wells | a bouncy trampoline collider |
| Rubbish chutes | a one-way drop to the Sump (a joke and a shortcut) | 4 → 1 | a teleport volume + a slide |

### 4.3 Falling

The 500 m of height is the danger and the thrill. Rules: a fall of < 6 m is free; 6–15 m hurts; a longer fall is caught
by a Well net (a bounce, a stagger, no death) or, off a cliff-face overlook, by the umbrella's auto-open (a gentle
reset to the nearest rim). Nobody dies from falling off the map: the edges of the cube are nets and fences.

### 4.4 Life on the strata

- **Crowds**: silhouettes on every stratum (instanced, animated impostors), densest at the Shelter Market and the Square.
- **Fauna** (the fauna registry): pigeons (Crown, Antenna Forest), stray cats (every stratum; a cyber-cat companion
  quest?), koi in the Yamen's pond, eels and rats in the Sump, crows on the antennas.
- **Enemies**:
  - **Tong enforcers** (the Lantern Tong gang): streetwear + lacquered armour plates, neon visors; the jian's fair fight.
  - **Jiangshi** (僵尸): cyborg hopping vampires in Qing robes, a paper talisman on the forehead that is a glowing QR
    code — they hop *vertically* between floors, the undercity's night horror (strata 1–4). Hook the talisman off to
    stun one.
  - **Crane drones**: paper-crane surveillance drones; spot you, call Tong reinforcements; hookable out of the air.
- **Elites** (one per three strata): the Dentist (Old Street), the Hotpot King (Shelter Market), the Sky-Screen Warden
  (Cable Deck).
- **The boss: the Well Dragon.** The cableway gone rogue: a ~300 m serpent of linked gondolas and neon coiling up the
  Yamen Well. The fight climbs the Well stratum by stratum; you hook onto its segments, ride it, and finish it on the
  Crown's VTOL pad.

### 4.5 The quest: Nine Red Envelopes

A courier's job: nine red envelopes (紅包), one to deliver on each stratum's shrine, from the Sump to the Crown. Each
delivery unlocks that stratum's lift stop (fast travel up the Stack). The ninth, on the Crown, wakes the Well Dragon.
The quest chip reads "RED ENVELOPE 0/9" with the next target's height ("CROWN +250 M").

### 4.6 Weather: typhoon signal No. 8

Nalati has its storms; the Stack has **T8** (Hong Kong's typhoon signal): the drizzle becomes sheets of rain, signs
swing on their brackets, the sky screens glitch and show the real storm, the Wells howl and the umbrella can't be used.

## 5. The art style

**Recommended: 界画霓虹 Jiehua Neon — the city ruled in ink, lit by neon, floating on silk.** Jake picks (P1-1). The full
research, the scoring of 12 directions, the three.js recipe and the style bible are in
`docs/design/nine-dragon-stack/ART-STYLE-RESEARCH.md`. The six-style board on the spawn frame is
`art/nine-dragon-stack/round-3-art-styles/board.jpg`; Jiehua Neon's own mockups are `round-4-jiehua-neon/`.

**What it is.** *Jiehua* (界画, "ruled-line painting") is the Song-dynasty genre made for exactly this subject: dense,
many-storeyed architecture drawn with a ruler. The shard renders the Stack as a jiehua come alive, with three layers and
no others:

1. **Ruler-straight ink lines** of constant width on every built edge — crisp black near, dissolving into the wash at
   distance. Built things are ruled; living things (people, enemies, the Jian, the hands) are brushed.
2. **Flat mineral washes** from the blue-green palette (青绿: azurite, malachite, cinnabar, gold leaf) on ~15 % of the
   frame — roofs, the paifang, lanterns, planters; the rest is grey ink wash on silk.
3. **Blank silk (留白) as the fog** between strata: the drop is literally the unpainted part of the scroll.

**Neon is the only saturated light**, and it bleeds into the silk like colour on wet paper (晕染).

**The colour script: the Stack is one hanging scroll.** Pale raw silk at the Crown, blue-hour silk at the spawn, darker
and bluer going down, until strata 1–3 flip to **gold ink on indigo sutra paper** (泥金磁青). Looking down any Well you
read the whole shard from pale to indigo.

**Why it wins.**
- *Unique*: no shipped game found does it (Chinese AAA is photoreal or anime cel; ink games are 2D).
- *Chinese × cyberpunk × vertical*: the genre was invented for stacked buildings; the fog city becomes the silk; neon
  stays neon.
- *Readable*: gold is reserved for grapple hooks, cinnabar seal for danger, cyan for the player, a heavier ground line
  for "you can stand here".
- *Cheap on the phone*: lines drawn in one shared material (antialiased, no shimmer) + one depth-silhouette pass; no PBR
  textures, volumetrics or SSR. Estimated +1.5–2.5 ms at 1206×2622 and cheaper overall than the PBR baseline (to be
  measured, P2-E10).
- *Buildable procedurally*: a ruled line is a geometry edge, so a grammar-built city gets the look for free — the
  opposite of realism, which needs hand-made unique assets to not look cheap.

**Jake's picks (2026-09-25):** style A Jiehua Neon (the round-6 board); the look loop chases the round-1 look-loop
targets (`art/nine-dragon-stack/round-8-look-loop-1/sheet-target-3x3.jpg`: deep blue hour, rain, grime, warm-lit windows,
rich ink detail) — not paler silk, not darker; **blue hour** is the default time of day (warm silk stays a switch).

**Runner-ups kept in the bible:** 水墨 brush ink for the far fog bands only (brush lines crawl in first person up
close); 漆器 Lacquerpunk for hero props; the Chungking Express smear as a sprint / grapple / glide effect.

## 6. The engine work

### 6.1 What exists and what is new

| Need | Today | New for shard 4 |
|---|---|---|
| Vertical extent | `CHUNK_DEPTH = 100` (13 reads: Terrain, Horizon, Boundary) | **E1** `ChunkDef.extent { below, above }` (default 100 / 100; the Stack 250 / 250) |
| Ground | a 256² heightfield + splat | **E2** a flat datum plate; the city is structure, not terrain |
| Structures | builders register colliders + models (`registry.add`) | **E3** the Stack builder: a modular kit + a grammar that stacks it |
| Culling | frustum + distance | **E4** stratum cells: draw the current stratum ± 1 and the Wells; the rest as shells |
| Navmesh | navcat recast, one layer per agent class | **E5** multi-layer bake (recast spans already stack) + off-mesh links for lifts / stairs / hops |
| Minimap | one top-down image | **E6** one image per stratum, switched by height (the baseline minimap, new data) |
| Lights | a sun + a few points | **E7** emissive + bloom + baked light: hundreds of neon signs, zero real-time point lights |
| Traversal | walk, swim, hover, ride | **E8** hook, zip, glide, lift, cable car, monorail, nets |
| Signage | none | **E9** a sign generator: real Chinese words → a baked glyph atlas (subset CJK font, OFL) |
| Look | toon / painterly / PBR chains | **E10** shard 4's own chain (§5) |

### 6.2 The builder, in one paragraph

A **block grammar** stacks modules: a *stratum slab* (street deck + sky-screen underside + fog plane), *housing
blocks* (4 × 4 m bays, 3 m floors, 12 floors between strata, facade kit: windows, AC units, cages, laundry, signs,
pipes), *hero spaces* hand-placed (Lantern Square, the yamen, the Shelter hotpot hall, Liziba station, the VTOL pad),
*connectors* (stairs, lifts, skybridges, hooks, nets). Deterministic by seed, so the navmesh and the minimaps bake
offline. Facades are merged per block and per stratum into a handful of draws; every sign is a quad in one atlas.

### 6.3 Budgets (phone, 30 fps at 2×)

| Budget | Target | How |
|---|---|---|
| Draw calls | ≤ 250 in a stratum | merged facades per block, instanced props, one sign atlas, cell culling (E4) |
| Triangles | ≤ 1.2 M on screen | kit LODs; the strata above/below as shells beyond 60 m |
| Lights | 0 real-time points | emissive + bloom + baked AO / light cards |
| Post | ≤ 6 ms | the style chain (§5) is budgeted against Pine Hollow's today |
| Boot download | ≤ Pine Hollow's | kit + atlases, not unique meshes |
| Memory | fits beside one other resident shard (E155 / E167) | shared kit textures |

### 6.4 Physics

Every walkable surface is a collider: slabs are boxes; stairs are `treads`; lifts / cable cars / the monorail are
kinematic (`follows`); nets are a bouncy material; hook points are a registry the Fei Zhua queries with `castRay`.
`physics-baseline.mjs --mode=walk` must report 0 stuck on every stratum (P3-G3).

## 7. Audio

- **Music (MiniMax Music 3, local)**: guzheng, erhu and pipa over analog synth bass and trip-hop drums — Cantopop noir.
  One motif, nine arrangements up the Stack: dub and sub-bass in the Sump, brass and crowd in the Market, airy pads and
  wind on the Crown. The in-game credit "Music: MiniMax-Music3".
- **SFX (MOSS-SoundEffect v2 + Stable Audio 3 Medium, the better take ships)**: rain on awnings, neon buzz, mahjong tiles,
  wok hei sizzle, lift chimes, cable-car hum, the monorail's pass, dripping pipes, pigeons, the Fei Zhua's launch and
  reel, the umbrella's snap, the jian's hum, the Jiangshi's hop, the Well Dragon's gondola chain.
- **Crowd walla**: murmurs, no intelligible words (no fake Cantonese).

## 8. The phases

State of each row: `todo` · `in flight (<owner>)` · `done (<commit>, <build>)` · `dropped`.

### P0 — pre-production (E169, this session)

| Row | What | Output | State |
|---|---|---|---|
| P0-1 | Concept art (9 images) | `art/nine-dragon-stack/round-1-concept/` | done (ede7e60f) |
| P0-2 | Spawn mockups on the phone HUD, A–D (round 2 used a stale HUD reference; round 6 redoes rounds 2–4 on a fresh live capture of the baseline HUD) | `art/nine-dragon-stack/round-2-mockups/`, `round-6-baseline-hud/` | in flight (E169) |
| P0-3 | Art-style research + the six-style board + the Jiehua Neon mockups | `docs/design/nine-dragon-stack/ART-STYLE-RESEARCH.md`, `art/nine-dragon-stack/round-3-art-styles/`, `round-4-jiehua-neon/` | in flight (E169) |
| P0-4 | This plan | `docs/plans/NINE-DRAGON-STACK.md` | in flight (E169) |
| P0-5 | The from-scratch clean-room spawn (three.js only, no engine code), the Neon Jian + Fei Zhua in first person — v1 `54d87764`; v2 detail pass, then the 9-angle mockup loop (`docs/design/LOOK-LOOP.md`) with the look labs merged in | `dev/nine-dragon.html`, `src/dev/nine-dragon/` | in flight (E169) |
| P0-5b | Look labs (throwaway prototypes, one style subset each: ruled ink on silk, neon + silk bloom + wet streaks, facade density kit, weapon + hero props) + research (in-repo techniques, AAA mobile rendering) | `src/dev/nd-lab/*`, `art/nine-dragon-stack/round-7-lab-*/`, `docs/design/nine-dragon-stack/{TECHNIQUES,AAA-MOBILE-RESEARCH}.md` | in flight (E169) |
| P0-5c | (approved by Jake 2026-09-25, used only if the clean room hits a wall or once the look converges) a throwaway in-engine fragment of the spawn, reachable only through the harness `?chunk=` and hidden from the deck, for true in-engine hero captures | — | not started |
| P0-6 | COMING SOON assets from the clean room: card thumbnail, portrait + landscape heroes, screenshots | `src/chunks/thumbs/nine-dragon-stack*`, `public/assets/teasers/nine-dragon-stack/` | todo |
| P0-7 | The COMING SOON card in the title deck (a `PLACEHOLDERS` teaser + its screenshots), pushed and live | `src/chunks/placeholders.ts`, `src/ui/HUD.ts` | todo |

### P1 — the look lock (Jake)

| Row | What | State |
|---|---|---|
| P1-1 | Jake picks the art style from the board (or asks for a round 2) | todo |
| P1-2 | Jake picks the spawn composition (A–D) | todo |
| P1-3 | The clean room becomes the look target: golden frames of the spawn, a style bible (§5) | todo |

### P2 — engine

| Row | What | State |
|---|---|---|
| P2-E1 | `ChunkDef.extent` replaces `CHUNK_DEPTH` (Terrain, Horizon, Boundary); the other shards unchanged, proven by the scorecard goldens | todo |
| P2-E2 | A structure-first shard: flat datum plate, no splat / trees / grass | todo |
| P2-E4 | Stratum cells + culling | todo |
| P2-E5 | Multi-layer navmesh + off-mesh links | todo |
| P2-E6 | Minimap per stratum (baseline minimap, per-stratum images) | todo |
| P2-E10 | The style chain (§5) | todo |

### P3 — greybox

| Row | What | State |
|---|---|---|
| P3-G1 | The cube blocked out: nine slabs, the Wells, the lift towers, the gates, the cliff faces | todo |
| P3-G2 | The traversal verbs on the greybox (hook, glide, lift, stairs, nets) | todo |
| P3-G3 | Walk test: 0 stuck on every stratum | todo |
| P3-G4 | The ground test (§3.2) as a capture script, ≥ 5 strata pass | todo |

### P4 — kit and art

| Row | What | State |
|---|---|---|
| P4-K1 | The facade kit + block grammar (E3) | todo |
| P4-K2 | The sign generator + CJK atlas (E9) | todo |
| P4-K3 | Hero spaces: Lantern Square, the yamen, the hotpot hall, Liziba station, the VTOL pad | todo |
| P4-K4 | Props via TRELLIS.2 (lanterns, mahjong table, AC units, shrine, paifang, scooters, gondola) | todo |
| P4-K5 | The Neon Jian + Fei Zhua viewmodels | todo |

### P5 — life

| Row | What | State |
|---|---|---|
| P5-L1 | Crowds (instanced impostors) | todo |
| P5-L2 | Fauna: pigeons, cats, koi, eels, crows | todo |
| P5-L3 | Enemies: Tong enforcers, Jiangshi, crane drones | todo |
| P5-L4 | Elites: the Dentist, the Hotpot King, the Sky-Screen Warden | todo |
| P5-L5 | The Well Dragon | todo |

### P6 — quest, weather, audio

| Row | What | State |
|---|---|---|
| P6-Q1 | Nine Red Envelopes + lift unlocks | todo |
| P6-Q2 | T8 typhoon weather | todo |
| P6-A1 | Music (MiniMax Music 3) | todo |
| P6-A2 | SFX (MOSS + SA3, the better take) | todo |

### P7 — phone and ship

| Row | What | State |
|---|---|---|
| P7-1 | Phone budgets (§6.3) met headless; Jake's iPhone reading | todo |
| P7-2 | The card goes from COMING SOON to playable (EXPERIMENTAL first); heroes re-captured in-engine | todo |

## 9. Risks

| Risk | Why it bites | Mitigation |
|---|---|---|
| Draw calls | a dense city is thousands of objects | merge per block, atlases, cell culling; budget checked from the greybox on |
| Content scale | 9 strata × ~100 000 m² | a grammar + kit, hand-built hero spaces only |
| Vertigo | 375 m drops on a phone | fog hides most of it; nets; no forced looks down |
| Wayfinding | nine similar floors | the colour script, painted stratum names, the per-stratum minimap, the Well as compass, lift chimes |
| Cultural pastiche | fake characters, mixed-up symbols | only real words in signs (a reviewed list), trad / simplified by stratum, no nonsense glyphs |
| CJK font weight | a full CJK font is ~16 MB | subset to the sign list, bake into one atlas |
| iOS memory | a big shard beside a resident one (E167) | shared kit textures, the stratum cells stream |
