# Nalati Grasslands — the mega plan

**State:** `draft` 2026-09-22 — the user locked: painterly style (B), combat = horse archery + bow on foot + mounted sabre + spear (no eagle for now), wolves / horses / taming, snow leopard as a named elite, the Kurgan King as a full boss, ghost riders, grass stealth, steppe storms, every map POI. Open: round-2 mockups + design sections (geography & the 500 m scale problem, 20 maps, combat, elites & bosses, crouch/jump controls) from four subagents, then the user's go (E11).

The third shard (ASKS P6). A high alpine steppe in the Tian Shan: an ocean of wind-combed grass under a
huge sky, horse herds and sheep flocks, white yurts, spruce forest on the north slopes, the Sky Grassland
plateau rolling on to the snow mountains, kurgan burial mounds crowned with balbal stone warriors, the
braided Kunes river. Where Pine Hollow is *trees* and Driftwood is *water*, Nalati is *wind and distance*:
the grass is the terrain, the cover and the weather gauge at once.

Branch `nalati-grasslands`, worktree `../wildshard-nalati-grasslands` (E10). The shard is a menu teaser
today (`src/chunks/placeholders.ts`, "Alpine steppe", hero art in
`art/hero-images/round-1-coming-soon/hero-nalati-grasslands-*.png`).

## The pitch in one line

**Tame a wild steppe horse, hunt wolves from the saddle across a sea of grass, hide from them in it, ride
out the storms, and break the stone warriors — and the Golden King — that sleep in the kurgans.**

## Decisions

| # | decision | the user's pick (2026-09-22) | detail |
|---|---|---|---|
| N1 | **Art style** | **B — stylized painterly** (locked) | `art/nalati-grasslands/round-1/1-art-style/style-B-painterly.png`: soft cel shading, painted gradients, rim light, thousands of swaying grass blades with rolling wind waves. A new `ChunkDef.style` (`'painterly'`) beside `'pbr'` and `'lowpoly'` — see "The look" |
| N2 | **Combat** | **A horse archery · C recurve bow on foot · D mounted sabre · B spear (+ javelins)**; eagle hunter skipped for now | `docs/design/nalati/combat.md` (round 2) |
| N3 | **Enemies** | **wolves, wild horses + horse taming, snow leopard = named elite, Kurgan King = full boss, ghost riders** | `docs/design/nalati/wolves-horses-taming.md`, `elites-and-bosses.md` |
| N4 | **New systems** | **named elites (minibosses)** and **bosses** as engine notions; **grass stealth**; **steppe storms** | below |
| N5 | **Map** | **every POI on the map is in**; the layout follows the real Nalati (valley → spruce slopes → Sky Grassland → snow peaks) | `docs/design/nalati/geography-and-map.md`, 20 map mockups |
| N6 | **Crouch + jump on touch** | open — options mocked up | `docs/design/nalati/controls.md` |
| N7 | **500 m vs "vast among vast"** | open — the slab is a fixed 500 m; options (horizon ring, forced scale, a stepped climb, bigger/multiple chunks) | `geography-and-map.md` |
| N8 | **Time of day** | open — dusk/night enemies (balbals, ghost riders) want a clock (shared with D38) | |

## The look — painterly (N1)

Style B is the one the engine does *not* have yet: Pine Hollow is textured PBR, Driftwood is faceted
vertex colour. Painterly means: a toon/cel ramp in the lit shader (2–3 soft bands + a painted
sky-tinted shadow colour instead of black), rim light on silhouettes, gradient-painted terrain (height /
slope / noise → a palette ramp, no photo textures), clouds as painted billboards, and the grass carpet as the
hero — thousands of blades with colour graded root to tip and visible gust waves (`Grass.ts` already draws a
75k-clump one-draw-call carpet with gust-front wind; it needs the painterly blade shading and a much denser
near field). Creatures, yurts and props are smooth low-to-mid poly with the same ramp. The same painterly
ramp is a reusable `style` for later shards.

## The three brand-new engine features

With the eagle parked, the three are:

### F1 — Mounts (the steppe horse, earned by taming)

The first thing in Wildshard you *ride*. Wild horses are *tamed*, not found: approach the herd crouched, the
stallion challenges, calm it (TRUST), hold on through the bucking (balance mini-game) → it is yours, named,
waiting at the camp's hitching rail. Riding: first person from the saddle (eye ~2.6 m), head, ears and mane
in the lower frame; walk / trot / canter / gallop on the MOVE stick, GALLOP disc with a STEED stamina bar;
bow (DRAW) and sabre (SLASH) from the saddle, a Parthian shot backwards. The horse panics at wolves and
throws you if pushed. Engine: a `Mount` entity on the quadruped rig, `Player.mount` mode beside `hover`,
gait blend by speed. Reusable: elk in Pine Hollow next.

### F2 — Living grass + stealth

One wind object drives grass, clouds, trees, flags, smoke **and arrow drift** (a WIND chip under the
minimap). Grass bends away from every mover and stays trampled: wolves in tall grass are seen by the wave
they push; herds leave roads you can track. **Crouch in tall grass → HIDDEN** (an eye pip); animal senses
read grass height at your position, and wolves use it on you too. Engine: a per-cell interaction texture
around the player read by the grass vertex shader, `grassHeightAt(x, z)` for senses, still one draw call.

### F3 — Steppe storms (weather)

Storm fronts roll across the shard: the sky splits gold / slate, a rain curtain, lightning strikes the highest
thing (a lone tree, you on a horse on a ridge), the grass flattens, herds bolt, visibility drops, arrows drift
hard, wolves hunt in it; afterwards a rainbow and wet shine. Engine-wide weather: a `Weather` state machine
driving sky, fog, grade, wind, particles, audio and AI.

Plus two engine **systems** Nalati introduces: **named elites** (minibosses with a name, a gold bar, a lair,
a signature move, a unique drop and a title — the snow leopard first) and **bosses** (an arena, a name card,
phases, adds, a legendary reward — the Golden King). Spec: `docs/design/nalati/elites-and-bosses.md`.

## Enemy roster

| enemy | tier | where | behaviour | mockup |
|---|---|---|---|---|
| **Steppe wolves** (packs of 3–5) | common | tall grass everywhere, wider at dusk | circle and flank inside the grass; you see the grass part; one lunges while the others close; the alpha howls to regroup; they chase riders and spook the horse | round-1 `enemy-1-wolf-pack`, round-2 `2-creatures/wolf-*` |
| **Wild horses** (herd + stallion) | neutral → taming | the horse plains | the herd grazes and flees; the stallion guards the mares, rears, charges, kicks — beat it without killing → TAME → your mount (F1) | round-2 `2-creatures/horses-*`, `taming-*` |
| **Balbal stone warriors** | heavy | kurgan field + balbal circle, wake at dusk | tear out of the ground, slow stone-sword slams; arrows chip, sabre breaks; glowing cracks are weak points | round-1 `enemy-2-balbal-warriors` |
| **Ghost riders** | mounted, night | ridge lines at night | spectral horse archers in a line; ride them down or shoot them out of the saddle | round-1 `enemy-6-ghost-riders` |
| **Snow leopard (irbis)** | **named elite** | the crags | stalks ledges, pounces from above, retreats when hurt; a name, a gold bar, a legendary pelt | round-1 `enemy-4-snow-leopard`, round-2 `4-named-elites/` |
| + four more **named elites** | named elite | — | from the elites design section | round-2 `4-named-elites/` |
| **The Golden King** | **boss** | the great kurgan | the full boss fight; guards the legendary golden bow | round-1 `enemy-5-kurgan-king`, round-2 `5-bosses/` |

Ambient: sheep flocks with a sheepdog and shepherd's yurt, marmots that whistle and give you away, cranes on
the river, kites circling, a fox.

## Every other gameplay element

What a Nalati session is made of, beyond combat and the three features. ✚ = new for this shard,
◎ = exists in the engine and gets a Nalati skin.

| area | element | |
|---|---|---|
| Movement | walk / sprint / jump / hover board | ◎ |
| | **crouch** (stealth in grass; the JUMP disc becomes CROUCH while hidden) | ✚ |
| | **riding** (F1) | ✚ |
| | fording the river (wade; swimming from Driftwood in the deep pools) | ◎ |
| Weapons | **composite recurve bow** — hold to draw, release to loose, arrow drop + wind drift, arrows recoverable from the ground | ✚ (the crossbow's ballistics + a draw) |
| | **sabre** — the sword's three-hit combo, curved arcs, from the saddle a single wide slash | ◎ |
| | **the golden bow** — legendary pickup in the kurgan (the iron-sword pattern) | ✚ |
| | fire arrows (stretch, with grassfire) | ✚ |
| Enemies | the six above, species registry entries with a `lowpoly` paint | ✚ |
| Hunting & harvest | wolf pelt, wolf fang, horsehair, stone shard (balbal), snow-leopard pelt (legendary), gold plaque (king), marmot fur, eagle feather | ✚ items in `Inventory` |
| Loot & pickups | the golden bow, arrow bundles in the camp, a saddle upgrade | ✚ |
| Places (POIs) | **Nomad camp** (spawn hub: yurts, hitching rail, eagle perch, stove smoke), **Kurgan field** (mounds + balbals + the great kurgan dungeon), **Balbal circle** (central hill), **River + bridge** (braided river, log bridge, a water mill), **Larch groves** (north folds), **The crags** (snow-leopard ledges, the high point), **Horse plains** (the herd), **Eagle rock** (a lone tor, the view) | ✚ one file each (`build()`, `colliders`, `floorHeightAt`) |
| Map & HUD | minimap + full map in grassland colours, fog of war, WIND chip, STEED bar, EAGLE disc, HIDDEN pip | ◎ + ✚ |
| Time & weather | day/night clock (N5) and, if picked, storms | ✚ |
| Achievements & titles | e.g. *Wolfbane* (10 wolves), *Horse Lord* (tame the stallion), *Stonebreaker* (5 balbals), *Irbis* (the leopard), *Kurgan Robber* (the king), *Eagle Eye* (50 marks), *Ride the Night* (a ghost rider from the saddle) | ◎ new table |
| Audio | wind in grass (layered by gust), hoof gaits by ground, eagle cry, wolf howls at dusk, marmot whistles, balbal grinding stone; music in the MUSIC v2 **folk** style (dombra / kobyz) | ◎ + ✚ |
| Menu & loading | hero art (style-picked), loading steps for a grass shard, title-screen card leaves "Not yet playable" | ◎ |
| Chunk contract | 500 m slab, four entry roads (the south road is the spawn track), boundary wall | ◎ fixed |

## Checkpoints, in order (after the picks — each is a deploy)

| # | checkpoint | what you can do |
|---|---|---|
| N0 | **The steppe** — `src/chunks/nalati-grasslands.ts` (style D), rolling landscape, river bed, the grass carpet, sky + planet, spawn on the south road | walk into the grass and look |
| N1 | **Bow** — recurve bow viewmodel behind `Weapon`, hold-draw-release, arrow drop | shoot at nothing |
| N2 | **Wind** (F2 part 1) — one wind object for grass, clouds, trees, flags, arrows; WIND chip | watch the gusts roll |
| N3 | **Nomad camp** POI + marmots + sheep | walk into camp |
| N4 | **Wolves** + grass parting / trample (F2 part 2) + crouch / HIDDEN | the first hunt |
| N5 | **Sabre** swap (the sword combo, curved) | melee |
| N6 | **Horse herd + stallion + taming** | earn the horse |
| N7 | **Riding** (F1) — mount, gaits, GALLOP, steed stamina | ride |
| N8 | **Mounted combat** — bow and sabre from the saddle | hunt wolves from horseback |
| N9 | **Golden eagle** (F3) — launch, mark, stoop, eagle eye | hunt with the eagle |
| N10 | **River + bridge + larch groves** | cross the river |
| N11 | **Kurgan field + balbals** (dusk wake) + day/night clock | break the stones |
| N12 | **The great kurgan dungeon + the Golden King + golden bow** | the legendary |
| N13 | **The crags + snow leopard** | the elite |
| N14 | **Ghost riders** (night) | ride the night |
| N15 | **Inventory items, achievements, titles** | the grind |
| N16 | **Audio + folk music** | |
| N17 | **Menu + loading + hero art** from an in-engine shot; card drops SUPER EXPERIMENTAL | |
| N18 | (stretch) grassfire, storms | |

Budget, every row: phone tier ≤ 150 calls / ≤ 2.0 M tris (PLAY-PERF), 60 fps on the phone, a screenshot
in `progress/`. The grass stays one instanced draw; creatures share the lowpoly lit program.

## Mockups

Round 1 (2026-09-22, codex `gpt-6-sol`, 21 parallel runs): `art/nalati-r1-*.png` — four art styles of the
same spawn view, five combat systems, six enemies, two feature shots (stealth, storm), four concept pieces
(camp, kurgan field, river gorge, top-down map). Round 2 re-renders the picks in the chosen style.
