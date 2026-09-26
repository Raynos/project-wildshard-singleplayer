# Plan: Nine Dragon Stack (九龍疊城), shard 4 — the vertical city (E169)

**State:** `in progress` 2026-09-26 — P0 and F1 fragment containment are on main (`fcd49d9d`; 19 walk legs, 0 stuck). F2 has a playable Fei Zhua zip across the Well (`03b04b67`; 19 walk legs, 0 stuck), with lab parity and polish still open. F3's 15-second grapple portrait recut is ready for Jake's review (round 19). F4–F10 need dome, budget, cleanup and iPhone work. Three placed GLBs appear in Model Explorer (`2a1393be`). E200's repeated PWA load did not reproduce in the iOS Simulator and remains open. The full shard (P1 onward) waits on Jake's go.

## 0. Read this first

Jake's words (E169, 2026-09-25 → 26):

> Chongqing meets Cyberpunk 2077 … an insanely unique shard that uses the maximum height of the chunk server and builds an
> insanely vertically challenged level … strong inspiration by the Kowloon Walled City … The starting location is half way
> up in the sky but it has 5+ levels that all feel like the ground level … Art style is Chinese, cyberpunk, futuristic.
> It's still built on the engine.

> We can break and modify the spec 500m high, 250 above and 250 below … it's fine to do 500x500x500 long term.

> How are you going to do a fully custom art style for this? Do research in what would be the most insanely epic and wow.

> At what point do we just implement a partial shard? … we're doing so much throwaway shit. (→ P0-5c, the pivot)

> Remember to implement a partial shard lol, not a full shard.

> You need to polish two half domes: where the character is standing and where the character is looking … I feel like
> you need two domes for each mockup … eight domes. (→ §7, the method)

**Scope so far.** E169 built the pre-production (concept art, this plan, the mockups, the art-style research, the COMING
SOON card with a slideshow) and then, on Jake's call, a **throwaway-able partial shard** in the engine: Lantern Square, the
Yamen Well's rim and galleries down into the mist, and the stair-street — the four mockups' worlds, nothing more. The
rest of the shard (§10 P1–P7) is the remainder this plan lays out; **nothing from P1 on is built before Jake's go.**

**The rules of this plan:**
1. **A 500 m cube.** Shard 4 breaks the 500 × 500 × 200 m slab spec (FUNDAMENTALS.md): 500 × 500 m footprint, **250 m
   under the surface datum and 250 m above it**. Jake OK'd 500³ for other shards long-term, so height becomes a per-shard
   field (P2-E1), never a second constant.
2. **Every stratum feels like the ground.** Five or more of the nine strata must pass the "ground test" (§3.2) from a
   standing player's eye. Only the Wells show the real height.
3. **Its own look.** Driftwood is toon, Nalati painterly, Pine Hollow photoreal PBR; shard 4 is **Jiehua Neon** (§5).
   The look is the shard's data and its render strategy, never a branch in core.
4. **A module, not branches.** Everything lives in `src/chunks/nine-dragon-stack/` (GAME-NORMALIZATION's shard-module
   shape); core varies only by **data fields and strategy hooks** on the ChunkDef (§6.2 lists the ones that exist). No
   `slug ===` in core. Every core change ships with the other-shards proof (identical compiled programs, passes, draws /
   triangles, captures within noise).
5. **The baseline HUD, nothing custom.** Driftwood's HUD; every new verb maps onto an existing control and every new
   fact onto an existing slot (§3.4).
6. **Phone first.** The iPhone home-screen PWA: ≥ 30 fps at 2× render scale (Jake: "30 fps is fine, like Pine Hollow"),
   never a render-scale cut. The frame gate is per camera pose: **≤ 2.3 M triangles and ≤ 180 draws** (§6.4); draws bind
   first.
7. **Judge by eye, against the mockups.** ΔE numbers guide, the eye decides: every round ends with an eye-check (previous
   | this | target) and anything that looks worse is reverted, whatever the numbers say (§12).

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
  Every stratum has a balustrade on its rim. In the fragment its near galleries project 5–8 m so the open gap reads as
  a 10–15 m canyon narrowing with depth, bridges cross it at a dozen heights and the canyon runs on north under the
  Cable Deck (`world/well-plan.ts`).
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
that mirrors the neon. The paifang gate with its gold 九龍 plaque, red paper lanterns, a banyan in a stone planter,
mahjong tables, a noodle stall's steam, a shrine with incense. The towers climb 125 m more out of frame, walls of signs
(麵 · 牙科 · 火鍋 · 茶 · 藥房 · 旅館), air-con units, cages, laundry. A skybridge and the monorail cross the square's sky;
the sky screens overhead play a blue-green shanshui scroll. On the left the balustrade over the Well: 375 m of lit
galleries falling away through layer after layer of silk mist.

The four hero frames are the round-6 mockups (`art/nine-dragon-stack/round-6-baseline-hud/`), and their cameras live in
one place: `src/chunks/nine-dragon-stack/mockupCameras.ts` (A the spawn, B the Well's edge, C the stair-street, D down
the Well).

## 3. The design devices

### 3.1 Why every stratum feels like the ground

1. **A continuous street slab** with shopfronts, trees in planters, parked scooters, puddles, crowds — a real floor, not
   a balcony.
2. **Sky screens.** The underside of the stratum above is tiled with LED panels that play a daytime sky (a class joke in
   the fiction: the rich of the Crown own the real sky; everyone below gets a rendered one). What they play is a slow pan
   across a **blue-green shanshui scroll** — Wang Ximeng's *A Thousand Li of Rivers and Mountains* (千里江山图, 1113) — at
   a visible LED dot pitch (built: `look/scroll.ts`).
3. **Fog banks** — Chongqing is the "fog city" (雾都): a silk band sits on every stratum line and swallows the drop at
   every edge (built for the Well: layered shaft mist, clear near the eye, `look/style.ts`).
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
  pommel. It rides the game's sword (ATTACK / HOLD = HEAVY, the lock-on, the dodge T). **Built:** the rigged first-person
  arms (`vm/`: skinned arms with forearm twist bones, blade-path IK, wrist limits, crossfades; idle, walk, three light
  cuts, charge, heavy, parry, draw / sheathe; a verlet tassel + talisman), driven through the engine's `Sword.arms` hook.
- **Fei Zhua (飛爪, "flying claw")** — a wrist grapple on the left forearm: brass-and-carbon launcher, folded three-talon
  claw, glowing mono-filament line. It **hooks** onto brass *dragon hooks* (on signs, cable masts, balconies) to swing and
  zip, and in combat it **yanks** an enemy toward you or off a ledge. One tool, two verbs: that is shard 4's signature.
  **Built:** the gauntlet on the rigged left arm (with grapple_aim / fire / hold clips); the full fire → fly → bite → zip
  sequence exists as a lab (`src/dev/nd-lab/grapple/`) and is being ported as the real verb (F2).

### 4.2 Traversal verbs

| Verb | What | Where | Engine | State |
|---|---|---|---|---|
| Walk / sprint | streets, alleys | every stratum | the player on colliders (step 0.35 m, 40°) | built (fragment) |
| **Stair-streets** | Chongqing's endless stairs between terraces | 4 → 5 → 6 | `treads` colliders (rise 0.35, tread 0.667), drawn as half-steps | built (fragment: 3 flights) |
| **Fei Zhua hook** | aim at a dragon hook → pull-zip or swing | every stratum, dense at Well rims | a rope / kinematic pull on the capsule; a hook-target registry (`ctx.hooks`) | in flight (F2) |
| **Crossings** | bridges and catwalks across the Wells | the Wells | deck + rail colliders (`crossingColliders()`) | built (fragment) |
| **Public lifts** | four lift towers in the Light Wells, one stop per stratum | all 9 | kinematic bodies (`follows`), the baseline use prompt | P2-E8 |
| **Laundry-line zip** | hook a line, slide down it | 7 → 8, 5 → 4 | a spline follower | P2-E8 |
| **Umbrella glide** (油紙傘) | slow fall down a Well, steer, no lift | the Wells | a drag + max-fall-speed mode, hold JUMP in the air | P2-E8 |
| **Cable cars** | ride between towers and to the cliff masts | Cable Deck | kinematic cabins on splines (the gondola model exists) | P2-E8 |
| **Monorail** | a train through the rock and through a tower | Rail Cut, a high loop to 6 | a ride on a kinematic body; no ride HUD | P2-E8 |
| **Nets** | fall catchers under every Well stratum line | the Wells | a bouncy collider (the nets are drawn in the fragment) | P2-E8 |
| Rubbish chutes | a one-way drop to the Sump (a joke and a shortcut) | 4 → 1 | a teleport volume + a slide | P5 |

### 4.3 Falling

The 500 m of height is the danger and the thrill. Rules: a fall of < 6 m is free; 6–15 m hurts; a longer fall is caught
by a Well net (a bounce, a stagger, no death) or, off a cliff-face overlook, by the umbrella's auto-open (a gentle
reset to the nearest rim). Nobody dies from falling off the map: the cube's edges are nets and fences, and anything that
still leaves the built volume soft-respawns at the nearest safe floor (F1 builds this for the fragment).

### 4.4 Life on the strata

- **Crowds** (built for the fragment: `world/crowd.ts`, instanced, per-figure culling, a ~320-triangle copy past 35 m):
  silhouettes on every stratum, densest at the Shelter Market and the Square.
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

## 5. The art style: 界画霓虹 Jiehua Neon (Jake's pick)

The research, the scoring of 12 directions and the style bible are in
`docs/design/nine-dragon-stack/ART-STYLE-RESEARCH.md`; the in-repo technique mine is `TECHNIQUES.md` and the mobile
rendering research `AAA-MOBILE-RESEARCH.md` in the same folder.

*Jiehua* (界画, "ruled-line painting") is the Song-dynasty genre made for dense, many-storeyed architecture drawn with a
ruler. The shard renders the Stack as a jiehua come alive:

1. **Ruler-straight ink lines** of constant width on every built edge — crisp near, dissolving into the wash at
   distance. Built things are ruled; living things (people, the jian, the hands) are brushed.
2. **Painted washes** — cool blue-grey ink washes with a light painted surface (concrete, granite, lacquer, tiles, wood)
   and the blue-green mineral accents (azurite, malachite, cinnabar, gold leaf) on roofs, the paifang, lanterns.
3. **Silk mist** between strata: the drop is the unpainted part of the scroll.

**Neon is the only saturated light**, it bleeds into the silk (晕染), and the wet stone mirrors it in long streaks.

**Jake's picks (2026-09-25):** style A Jiehua Neon (the round-6 board); **blue hour** is the default; the look chases
the round-1 look-loop targets (deep blue hour, rain, grime, warm-lit windows, rich ink detail) and the four round-6
mockups. **The colour script** (planned): the Stack is one hanging scroll — pale silk at the Crown, blue hour at the
spawn, darker and bluer going down, until strata 1–3 flip to **gold ink on indigo sutra paper** (泥金磁青).

**What the fragment proved** (`look/`, the render strategy on the engine): the ruled material + a depth-in-alpha ink
silhouette; baked light-pool volumes from ~9 500 emitters (one lookup per pixel) with a glossy lobe and rim light; an SDF
neon sign atlas; emissive streak cards on the wet ground (turned per view so looking down stays parallel) and on each
stair flight's slope; a ½-res screen-space reflection; layered shaft mist, clear near the eye; lights that carry through
fog; a fitted LUT; N8AO on the phone; FXAA on the phone tier. Spawn frame 4.15 ms at 804×1748 on the M5 (phone
unmeasured).

## 6. Where it stands: the partial shard (2026-09-26)

### 6.1 What you can play

Debug ▸ Developer tools ▸ **Nine Dragon Stack prototype** (reload) turns the COMING SOON card into a playable EXPERIMENTAL
card; the harness `?chunk=nine-dragon-stack` boots it for captures; EXPLORE WORLD is on. You spawn on Lantern Square at
+125 m with the rigged Neon Jian and Fei Zhua. Walkable: the square, through the paifang to the street, the three stair
flights to the stair gate (+146 m), the Well's rim and its crossings (walk test: 7 legs, 0 stuck). Known gap: it is easy
to jump out of bounds (Jake's playtest) — F1.

### 6.2 The module (`src/chunks/nine-dragon-stack/`, ~20 k lines)

| Part | Files | Owner so far |
|---|---|---|
| The def + registry piece | `def.ts`, `index.ts`, `layout.ts`, `mockupCameras.ts` | port lead |
| World assembly, collisions, culling | `world/build.ts`, `colliders.ts`, `cull.ts`, `ctx.ts` (`ctx.far`, `ctx.cell` LOD switches), `kit.ts`, `dressing.ts`, `facades.ts`, `facade/` (the grammar, 28 piece types, interior-mapped windows) | port lead |
| The square (mockup A) | `square.ts`, `gate.ts`, `banyan.ts`, `canopy.ts`, `stalls.ts`, `props.ts`, `props3d.ts` (TRELLIS lions, `placeLion`), `crowd.ts` | dome B (A2) |
| The Well (mockups B, D) | `well-plan.ts` (the shared plan: footprint, CROSSINGS, bands), `well-rim.ts`, `well-galleries.ts`, `well.ts` (B1/D1); `well-mid.ts`, `well-bridges.ts` (B2); `well-lower*.ts` (D2) | domes C, B2, D2 |
| The stair-street (mockup C) | `towers.ts`, `stairstreet.ts` (C1: the plan, colliders, flight 1, the foot); `stairstreet-upper.ts` (C2) | domes D, C2 |
| The look | `look/` (style, paint, streaks, signs, neon, lanterns, scroll, light/, render/: jiehua, bleed, reflect, haze) | render agent |
| The viewmodel | `vm/` (the rigged arms, `arms.ts` adapter) + `world/jian.ts` (framing) | P8 → port lead |

**Engine hooks it added (all data / strategy, other shards proven identical):** `ChunkDef.structures` (a structure-first
shard: built floors on colliders, no terrain / ground cover), `SpawnPose.y`, `fov.portrait`, `sword` (`ShardSword`:
rig, moves, framing, `arms`), `ChunkMapDef.ground` (the minimap draws built pieces), `render` (`ShardRender`: compose
slots, per-frame hook, tier overrides, `aa`), the registry's `PROTOTYPES` + the Debug row, Explore's `spawn.y`.

### 6.3 What is left in the fragment (→ §10 F)

The Well's deep levels still wash out below ~50 m; mockup B's rim post blocks its lower-left; mockup C's frame is capped by
lantern strings and a near sky screen; several lanes are over their draw caps; the facade dressing needs multi-draw; the
grapple is a lab; out of bounds; no phone reading yet.

### 6.4 The budget (`art/nine-dragon-stack/budget.md`, ruler `scripts/nine-dragon-budget.mjs`)

Per pose on the phone frame: **≤ 2.3 M triangles, ≤ 180 draws** (lane caps sum to ~2.0 M / 175). Worst pose now
**1.53 M / 160**; mockups A 1.52 M / 147, B 1.37 / 140, C 0.89 / 139, D 1.11 / 116. Levers that made it: the per-instance
culler run from the drawn camera, the crowd LOD (~550 k → ~60 k), the lantern LOD (−390 k). Over their caps: B2 17 / 16
draws, C2 15 / 12, C1 8 / 6, B1/D1 13 / 12, viewmodel 25 / 24, post 39 / 38, facade dressing 28 / 20 (needs BatchedMesh).

## 7. How we build (the method the fragment proved)

For every area (a stratum, a hero space):

1. **Mockups first**, on a fresh live capture of the baseline HUD (codex image_gen edits; 2–4 variants; Jake picks).
2. **Two domes per mockup**: a *stand* dome at the mockup's camera and a *look* dome at what it looks at
   (`docs/design/LOOK-LOOP.md` — "Two domes").
3. **Targets imagined from the mockup**, never from the engine: `cameras.json` + a floor plan → one codex 3×3 grid of the
   nine views → per-tile upscales (the round-15 eight domes are the template).
4. **Build loop per dome**, each dome owning disjoint files: capture the 9 views + the mockup camera in the engine (from a
   snapshot or production build, the parked player aimed at the pose), gaps, TOP-10, fix, **eye-check** (previous | this |
   target), revert what looks worse, report the lane's triangles / draws against its cap.
5. **Checkpoints**: the coordinator gates a clean export (tsc, oxlint, check-css, vitest, vite build + the other-shards
   proof for core changes + the walk test) and commits through a private index; the shard stays behind the Debug row.

## 8. The engine work

| # | Need | State | What is left |
|---|---|---|---|
| E1 | Vertical extent | todo | `ChunkDef.extent { below, above }` replaces `CHUNK_DEPTH` (Terrain slab, Horizon's cloud sea at −240, Boundary's lines); the Stack 250 / 250; other shards identical |
| E2 | Structure-first shard | **done** (`3719d1d8`) | — |
| E3 | Builder: kit + grammar | **done for the fragment** | a *stratum* grammar: a stratum = slab + sky-screen underside + silk band + housing bands (`well-plan`'s bands generalised), data per stratum (§2.1) |
| E4 | Culling / streaming | culler + LOD switches **done** | stream strata: build / dispose each stratum group by the player's height (± 1 stratum + the Wells as shells) — memory on iOS (E167) and boot time |
| E5 | Navmesh | todo | bake a structures shard from its registry colliders (bake-navmesh.mjs), multi-layer, off-mesh links for stairs, lifts, hooks, drops — needed before enemies |
| E6 | Minimap | built-pieces map **done** | one map per stratum, switched by the player's height |
| E7 | Lights | fragment volumes **done** | per-stratum light volumes, streamed with E4 |
| E8 | Traversal verbs | hook in flight (F2) | glide, lifts, cable cars, monorail, nets, zip lines, falls (§4.2) |
| E9 | Signs | runtime atlas **done** (hit "atlas full" once) | offline-baked atlas per stratum from a reviewed word list + a subset CJK font (OFL) |
| E10 | Look chain | **done** (`64cb07bd` + look/) | per-stratum colour script (the gold-on-indigo flip for 1–3) |
| E11 | Boot / build time | todo | measure the procedural build on the phone; bake heavy output into packs if > ~2 s |
| E12 | Viewmodel | **done** (`7a339ed2`) | landscape pose, cloth clip in a hard slash, combo timing polish |
| E13 | Facade multi-draw | todo | the dressing on three's BatchedMesh (per-instance culling built in) → ≤ 20 draws |

## 9. Audio

- **Music (MiniMax Music 3, local)**: guzheng, erhu and pipa over analog synth bass and trip-hop drums — Cantopop noir.
  One motif, nine arrangements up the Stack: dub and sub-bass in the Sump, brass and crowd in the Market, airy pads and
  wind on the Crown. The in-game credit "Music: MiniMax-Music3".
- **SFX (MOSS-SoundEffect v2 + Stable Audio 3 Medium, the better take ships)**: rain on awnings, neon buzz, mahjong tiles,
  wok hei sizzle, lift chimes, cable-car hum, the monorail's pass, dripping pipes, pigeons, the Fei Zhua's launch and
  reel, the umbrella's snap, the jian's hum, the Jiangshi's hop, the Well Dragon's gondola chain.
- **Crowd walla**: murmurs, no intelligible words (no fake Cantonese).

## 10. The phases

State of each row: `todo` · `in flight (<owner>)` · `done (<commit>)` · `needs pick` · `dropped`.

### P0 — pre-production + the partial shard (E169) — done

| Row | What | State |
|---|---|---|
| P0-1 | Concept art (9 images), `art/nine-dragon-stack/round-1-concept/` | done (`ede7e60f`) |
| P0-2 | Mockups on the live baseline HUD (rounds 2 → 6), four compositions A–D | done (`2691cbfd`) |
| P0-3 | Art-style research, the six-style board, Jiehua Neon mockups; Jake picked A | done (`7e521fe4`, `25166fa8`) |
| P0-4 | This plan | done (this commit) |
| P0-5 | The clean room + nine look labs (throwaway; merged, then deleted in `d8f39239` / `7a339ed2`) | done |
| P0-5c | **The in-engine partial shard** behind the Debug row | done (`3719d1d8` → checkpoints `f6c62766`, `67093502`, `7a339ed2`) |
| P0-6 | The eight domes' 3×3 targets, imagined from the mockups (`round-15-eight-domes/`) | done (`05060a93`) |
| P0-7 | The COMING SOON card + synced slideshow, art re-shot from the engine | done (`f230117d`, `8dcf03d5`, `903d66e0`) |

### F — finish the fragment (now, no new approval needed)

| Row | What | Owner | State |
|---|---|---|---|
| F1 | **Out of bounds** (Jake's playtest): invisible walls on every edge of the walkable fragment and every reachable roof, a soft respawn for anything below / outside the built volume, the hoverboard clamped; edge legs added to the walk test | continuation | uncommitted WIP; verify and land |
| F2 | **The grapple as the real verb**: port the lab's fire → fly → bite → zip into the shard, LOCK targets dragon hooks (a hook registry from `ctx.hooks` / the Well), JUMP fires and zips (a pull on the Rapier capsule), the arms' grapple clips; delete the lab | continuation | lab built; game port open |
| F3 | **A 15 s portrait teaser trailer** from the engine (the `scripts/steam-trailer/` pipeline): rise up the Well, breach onto the square, the jian, the stair-street, the grapple, the end card; a MiniMax cue + MOSS / SA3 SFX; portrait 1080p60 master for the portrait iOS PWA | continuation | partial portrait capture/audio; grapple shot and master open |
| F4 | **Mockup B**: move the rim post out of the lower-left (look over a carved panel, a post lower-right), `placeLion` on the posts | dome C | todo |
| F5 | **The deep Well**: levels 50–90 m down and the temple readable through the mist (a lighter curve / lit surfaces punching through), mockup D's frame | render + D2 | todo |
| F6 | **Mockup C**: open depth over the stair (thin the lantern strings, push back the near sky screen, the paifang big and centred, the skybridges at the mockup's depths) | C2 + render | todo |
| F7 | Each dome loops against its 3×3 targets until "a stranger has to look twice" at phone size: A1, A2, B1, B2, C1, C2, D1, D2 | the domes | in progress |
| F8 | Lanes back under their caps (§6.4) + the facade dressing on BatchedMesh (E13) | port lead + domes | todo |
| F9 | **Jake's iPhone reading** of the fragment: fps at the four mockup cameras, memory with another shard resident, boot time | Jake | needs you |
| F10 | Cleanup: `public/assets/nine-dragon/lab/*` → final asset paths; the art index rows (rounds 7–17); LOOK-LOOP.md gotchas (§12); D2's cameras 2–3 re-seated; the crossings' keep-clear for the moved temple (z −35…−25 below +54) | coordinator | todo |
| F11 | **Decision**: keep the fragment behind the Debug row, or show it to everyone as an EXPERIMENTAL prototype card | Jake | needs pick |

E201's portrait Model Explorer empty-state mockups are `art/nine-dragon-stack/round-17-model-empty/`: `live-empty.jpg` is the real 390×844 blank catalog capture; `a-catalog-state.jpg` gives the catalog a full empty-state panel and World Explorer route (implemented); `b-world-first.jpg` is a smaller alternative that leaves more of the city visible. Their HTML/CSS sources sit alongside the images so the text and spacing remain editable.

### P1 — the go (Jake)

| Row | What | State |
|---|---|---|
| P1-1 | Go / no-go on building the full shard | needs pick |
| P1-2 | The order. Recommended: a **vertical slice** first — strata 5 → 6 → 7 around the spawn (Terrace Row below via the stair-street and a Light-Well lift, Cable Deck above via the gondola), then down (4, 3, 2, 1), then up (8, 9) | needs pick |
| P1-3 | Combat scope for the slice (Tong enforcers only, or Jiangshi too) | needs pick |

### P2 — engine (§8)

| Row | What | State |
|---|---|---|
| P2-E1 | `ChunkDef.extent` (250 / 250), other shards identical | todo |
| P2-E3 | The stratum grammar (data per stratum) | todo |
| P2-E4 | Stratum streaming (build / dispose by height; the Wells as shells) + an iOS memory ceiling | todo |
| P2-E5 | Navmesh for a structures shard (multi-layer, off-mesh links) | todo |
| P2-E6 | Minimap per stratum | todo |
| P2-E7 | Light volumes per stratum, streamed | todo |
| P2-E8 | Traversal verbs: glide, lifts, cable cars, monorail, nets, zip lines, the fall rules | todo |
| P2-E9 | Offline sign atlas + subset CJK font + a reviewed word list (trad low, simplified high) | todo |
| P2-E10 | The colour script by height (the gold-on-indigo flip for strata 1–3) | todo |
| P2-E11 | Boot / build time on the phone; bake to packs if needed | todo |

### P3 — the cube in greybox

| Row | What | State |
|---|---|---|
| P3-G1 | The nine slabs at their heights, the Yamen Well's full 500 m, the four Light Wells + lift towers, the cliff faces with stilt houses, the four gates at datum 0 and the highway | todo |
| P3-G2 | The traversal verbs on the greybox (hook, glide, lifts, cable cars, monorail, nets) | todo |
| P3-G3 | Walk test: 0 stuck on every stratum; no way out of bounds | todo |
| P3-G4 | The ground test (§3.2) as a capture script; ≥ 5 strata pass | todo |

### P4 — the strata, one by one (the §7 method each)

Every stratum: 2–4 hero mockups → Jake picks → two domes per mockup → 3×3 targets → the build loop → a checkpoint.

| Order | Stratum | Hero spaces (mockups) | Reuses | New kit |
|---|---|---|---|---|
| 1 | 6 Lantern Square (the rest of it) | the square's north street beyond the gate, the shrine, the Light-Well lift | the fragment | — |
| 2 | 5 Terrace Row | teahouse terraces, the 18 Steps, Hongyadong stilt terraces over a Well | the stair-street, facade grammar | stilt piers, tea verandas at scale |
| 3 | 7 Cable Deck | ropeway stations, skybridges, gondolas between towers | the gondola + stations, bridges | cable masts, station halls |
| 4 | 4 Old Street | black alleys, the yamen at the Well's foot, the four gates + the highway | galleries, lower Well | alley kit (pipes, nets, dentists), the yamen |
| 5 | 8 Antenna Forest | rooftop shanties, water tanks, laundry, pigeon coops | facade dressing | roof-deck kit |
| 6 | 9 The Crown | roof gardens, the VTOL pad, cargo drones, the real sky | — | garden kit, the pad, drones |
| 7 | 3 Rail Cut | Liziba station (the monorail through a tower), service roads | — | station, rock tunnel, the train |
| 8 | 2 Shelter Market | hotpot halls in WWII shelters, the night market | crowd | rock vault kit, stalls at scale |
| 9 | 1 The Sump | pump halls, walkways over black water, sampans | — | water, pumps, boats; the gold-on-indigo look |

### P5 — life

| Row | What | State |
|---|---|---|
| P5-L1 | Crowds per stratum (the fragment's `crowd.ts` generalised; walla) | todo |
| P5-L2 | Fauna: pigeons, cats, koi, eels, crows | todo |
| P5-L3 | Enemies: Tong enforcers (a rigged humanoid — `humanoidRigBake` + TRELLIS / img2-character), Jiangshi (vertical hops via E5's off-mesh links), crane drones | todo |
| P5-L4 | Elites: the Dentist, the Hotpot King, the Sky-Screen Warden | todo |
| P5-L5 | The Well Dragon on the shared `Boss` (`src/game/Boss.ts`) | todo |

### P6 — quest, weather, audio

| Row | What | State |
|---|---|---|
| P6-Q1 | Nine Red Envelopes on the shared quest system + lift unlocks | todo |
| P6-Q2 | T8 typhoon weather | todo |
| P6-A1 | Music (MiniMax Music 3): the motif + nine arrangements | todo |
| P6-A2 | SFX (MOSS + SA3, the better take) + ambience beds per stratum | todo |

### P7 — phone and ship

| Row | What | State |
|---|---|---|
| P7-1 | Phone budgets per stratum (§6.4 gate), Jake's iPhone reading | todo |
| P7-2 | The card: COMING SOON → EXPERIMENTAL → EARLY ACCESS; heroes re-captured; the plan archived | todo |

## 11. Risks

| Risk | Why it bites | Mitigation |
|---|---|---|
| Draw calls | a dense city is thousands of objects; draws bind before triangles | lane caps, merged kits, per-instance culling, BatchedMesh, stratum streaming |
| Content scale | 9 strata × ~100 000 m², and the fragment alone is ~20 k lines | the stratum grammar (E3); hand-built hero spaces only; the §7 method per stratum |
| Boot time + memory | the procedural build runs at load; a 500 m cube beside another resident shard on iOS (E167) | stream strata (E4); bake to packs (E11); shared kit textures |
| The mist eats the depth | a uniform fog turned the Well into a white slab | layered bands, clear near the eye, lights punching through (F5) |
| Vertigo / out of bounds | 375 m drops, a partial world | nets, soft respawn, invisible walls (F1) |
| Wayfinding | nine similar floors | the colour script, painted stratum names, the per-stratum minimap, the Well as compass, lift chimes |
| Cultural pastiche | fake characters, mixed-up symbols | only real words in signs (a reviewed list), trad / simplified by stratum |
| Many agents, one tree | shared files, stale snapshots, rng coupling | disjoint file ownership per dome, Edit-not-Write on shared files, checkpoints through a private index (§12) |

## 12. Lessons from the fragment (don't repeat)

- **The eye beats ΔE.** A painted-texture merge improved every ΔE and made the frame worse (grainy ground, broken
  streaks). Every round ends with an eye-check; revert what looks worse.
- **Targets come from the mockup.** Editing an engine capture into a target only polishes what is built; for an unbuilt
  world, imagine the nine views from the mockup (one consistent 3×3 grid).
- **Two domes per hero mockup** — where the camera stands and where it looks.
- **Posed captures must cull for the posed camera.** The cullers now run in the render hook's `frame` with the drawn
  camera; a capture that poses a free camera must still aim the parked player the same way on older builds.
- **Never splice an rng-fed list.** Removing a sign slot re-rolled every later sign in the shard; shrink the slot instead.
- **Capture from a snapshot or production build**, never the shared dev server (hot reloads mid-capture, other agents'
  half-finished work), and never from a stale snapshot when judging someone else's lane.
- **The viewmodel wants its own projection** (70° for the rig) so the world's FOV kicks don't move the arms.
- **A pose no arm can reach snaps.** The first glove held the grip at ~160° of supination; fix the pose, then rig.
- **Clean rooms are for finding a look, not for building a world.** The look labs earned their keep; the rest moved into
  the engine as soon as it could (P0-5c).
