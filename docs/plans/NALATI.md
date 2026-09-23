# Nalati Grasslands — the mega plan

**State:** `in progress` 2026-09-22 — wave 1 largely landed on branch `nalati-grasslands` (world, painterly material, grass + wind, bow, sabre + spear, wolves / horses / sheep, spruce; POIs in flight); B10 weather + B13 Golden King started. **Top priority now: the look pass (N7)** — the user: the mockups are "a hundred times better" than the engine; a look-director + dressing agent + every build agent on its own models, to mockup parity (`docs/design/nalati/look-pass.md`). Nothing deployed yet.

The third shard (ASKS P6). A high alpine steppe in the Tian Shan, laid out like the real Nalati: you arrive in the
Kunes river valley (yurts, sheep, the bridge), climb spruce gullies up the escarpment, and the **Sky Grassland**
opens up — a wind-combed plateau that rolls on past the slab edge to the snow mountains. Horse herds, wolves in
the grass, kurgan burial mounds crowned with balbal stones, storms that cross the whole sky. Where Pine Hollow is
*trees* and Driftwood is *water*, Nalati is *wind and distance*: the grass is the terrain, the cover and the
weather gauge at once.

Branch `nalati-grasslands`, worktree `../wildshard-nalati-grasslands`. The shard is a menu teaser on main today
(`src/chunks/placeholders.ts`). Asks: `docs/tasks/asks/N4.md` (branch), `N5.md` (this plan), `N6.md` (the build).

## The pitch

**Tame a wild steppe horse, hunt wolves from the saddle across a sea of grass, hide from them in it, ride out the
storms, and break the named beasts of the plateau — and the two kings: the Golden King in his kurgan and the
Storm Titan in the sky.**

## Design sections (the detail lives here)

| section | file |
|---|---|
| real geography, the 500 m problem, the POI layout with coordinates | `docs/design/nalati/geography-and-map.md` |
| bow, sabre, spear + javelins, horse archery, weapon switching, numbers | `docs/design/nalati/combat.md` |
| wolves (pack AI), wild horses (herd AI), taming, riding | `docs/design/nalati/wolves-horses-taming.md` |
| grass stealth (detection model), steppe storms (lifecycle) | `docs/design/nalati/stealth-and-storms.md` |
| named elites system + the five, bosses system + Golden King + Storm Titan | `docs/design/nalati/elites-and-bosses.md` |
| crouch / jump / mounted controls, touch + desktop | `docs/design/nalati/controls.md` |

Where this plan and a design section disagree, **this table of decisions wins**.

## Decisions (all the user's, 2026-09-22)

| topic | decision |
|---|---|
| **Art style** | **B — stylized painterly** (`art/nalati-grasslands/round-1/1-art-style/style-B-painterly.png`; every round-2/3 mockup is in it) |
| **Combat** | **horse archery · recurve bow on foot · mounted sabre · spear**. **Javelins are thrown from the spear slot** (3 weapon slots: bow, sabre, spear). Eagle hunter: parked, not in this build |
| **Arrow drop arc** | a faint dotted arc while drawing, **on by default on touch**; arrows at half gravity so the arc reads |
| **Enemies** | steppe wolves (packs), wild horses + stallion taming, balbal stone warriors (dusk), ghost riders (night) |
| **Named elites** | a new engine system (minibosses). Five: **Aqbars the Pale** (snow leopard, the Crags), **Kokbori** (she-wolf pack mother, dusk), **Qyran the Storm-Wing** (golden eagle, storms only), **Qara Batyr the Unburied** (ghost-rider captain, night), **Argymaq the Unbroken** (feral black stallion, the Crags' high pasture — beaten to BROKEN, then tamed; the best mount). Tas Ata dropped (the balbal circle keeps ordinary balbals); Qonyr the bear is the alternate |
| **Elite drops / titles** | **cosmetic only** (a guaranteed skin + trophy item); **joke titles** kept ("Crazy Cat Person", "Night Shift", …) |
| **Elite health bar** | **over the head until the fight starts, then pinned top-centre** |
| **Bosses** | a new engine system. **Two in Nalati:** **the Golden King** (the great kurgan dungeon, on foot, drops the **Golden Bow**) and **Jel Ata the Storm Titan** (the Sky Grassland, on horseback, **only during a natural storm**, drops the **Naizagai** storm sabre + the Sky-Marked Saddle skin) |
| **Boss retry** | **phase checkpoints**: die → back at the start of the phase you reached |
| **Horse** | one horse, **can't die** (at 0 it bolts, returns to the hitching rail after a rest); named TULPAR (Argymaq replaces it once won) |
| **Riding** | JUMP → GALLOP (hold), AIM → DRAW, HOVER → DISMOUNT; **auto lean-low at full gallop** and the horse jumps ditches by itself; look 170° while the horse runs straight (Parthian shot) |
| **Crouch** | **option D: a CROUCH disc stacked above JUMP that appears only in long grass**; crouch is a **toggle**; leaving the grass **stands you up**. Desktop: the existing C / Ctrl crouch, gated like touch |
| **Storms** | every **20–30 min** of play; **lightning can hit you** (60, a GET LOW warning first); the Storm Titan and Qyran only in storms |
| **Time of day** | a **day/night clock** (shared with D38): balbals wake at dusk, ghost riders + Qara Batyr at night, Kokbori at dusk |
| **Map** | **map-01's layout**, **true north**, **spawn on the north road** in the valley, the **main camp in the valley** + 2–3 summer yurts on the plateau; every POI on map-01 is in |
| **Scale (500 m)** | keep the 500 m slab: a **stepped climb** (valley −10 → escarpment → plateau +30…36 → crags +75) + a **Nalati horizon ring** (the plateau rolling on, the snow range south) + forced perspective |

## The look — painterly

The engine has `style: 'pbr'` (Pine Hollow) and `'lowpoly'` (Driftwood). Nalati adds **`'painterly'`**: a
cel/toon ramp in the lit shader (2–3 soft bands, a painted sky-tinted shadow colour instead of black), rim light,
gradient-painted terrain (height / slope / noise → a palette ramp, no photo textures), soft smooth geometry
(not faceted), painted billboard clouds, and the grass carpet as the hero. One shared painterly material
factory so every creature, yurt and prop gets the same ramp. Budget: phone tier ≤ 150 calls / ≤ 2.0 M tris,
60 fps (PLAY-PERF).

## Engine features Nalati adds

1. **Mounts** — ride a tamed horse (walk / trot / canter / gallop, STEED stamina, weapons from the saddle).
2. **Living grass + stealth** — one `Wind` object (grass, clouds, flags, smoke, arrow drift), grass that parts
   and stays trampled, `grassHeightAt(x, z)`, the HIDDEN / NOTICED / DETECTED eye pip.
3. **Weather** — steppe storms (six phases, lightning, stampedes) on a day/night clock.
4. **Named elites** and 5. **Bosses** — systems every later shard reuses.

## The world (map-01, true north; coordinates in `geography-and-map.md` §3)

Valley (north): **N road** (spawn at (0, +232) facing south) · **Kunes river** (braided, east → west) ·
**bridge** · **nomad camp** (6 yurts, corral, hitching rail — the hub) · **sheep pasture**. Middle: **spruce
forest** in three gullies · the **sky road** switchbacks · **waterfall**. Plateau (south): **Eagle Rock** ·
**Sky Grassland** · **horse plains** · **kurgan field** + the **great kurgan** (dungeon) · **balbal circle** ·
**summer yurts** · the Titan's **cairn**. SE corner: **the Crags** (Aqbars, Argymaq). Four entry roads at the
edge midpoints (engine rule). Beyond the slab: the Nalati horizon ring.

## Build — waves and owners

Every row: built on the branch, wired into the game, 60 fps on the phone tier, a screenshot in `progress/`
(JPEG ≤ 500 KB), then shipped (see Deploy). ✅ = shipped.

### Wave 1 — foundation (parallel)

| # | row | owner | files it owns |
|---|---|---|---|
| B0 | **The steppe**: `ChunkDef` (`style: 'painterly'`), registry entry (third, SUPER EXPERIMENTAL), the stepped-climb landscape + river bed + water, painterly terrain + the shared painterly material, sky/planet/fog/grade (late sun WSW), spawn N, the Nalati horizon ring, the `src/nalati/` wiring hook in `main.ts` | world-agent | `src/chunks/nalati-grasslands.ts`, `src/nalati/index.ts`, `src/world/painterly.ts`, painterly branches in `Terrain.ts` / `Horizon.ts`, `ChunkDef.ts`, `registry.ts`, `placeholders.ts`, `main.ts` hook |
| B1 | **Grass + wind**: painterly dense grass carpet, `Wind` object, trample / parting interaction, `grassHeightAt`, tall-grass bands | grass-agent | `src/world/Grass.ts` (painterly mode), `src/world/Wind.ts`, `src/world/GrassTrample.ts` |
| B2 | **Bow**: recurve bow viewmodel, hold-draw-release, arrows (drop, wind drift, recoverable), drop arc on touch, `Projectiles` | bow-agent | `src/player/Bow.ts`, `src/player/Projectiles.ts` |
| B3 | **Sabre + spear**: curved sabre (Driftwood combo), spear (thrust, brace) + 3 javelins thrown from the spear slot, the 3-slot weapon strip | melee-agent | `src/player/Sabre.ts`, `src/player/Spear.ts`, the weapon strip in `Weapons.ts` / HUD |
| B4 | **Creatures**: wolf (pack AI), wild horse (herd AI, stallion), sheep flock (+ ambient marmots) | creature-agent | `src/entities/species/{wolf,horse,sheep}.ts`, `src/entities/{Pack,Herd}.ts` |
| B5 | **POIs**: yurts + camp, bridge, fences, kurgan mounds, balbal statues (static), Eagle Rock, the cairn, summer yurts, the Crags rocks | poi-agent | `src/world/nalati/*.ts` |
| B6 | **Spruce**: a Tian Shan spruce tree factory (tall narrow cones, painterly) for the gullies | spruce-agent | `src/world/Spruce.ts`, `TREE_FACTORIES` entry |

### Wave 2 — the game (as wave 1 lands)

| # | row | depends on |
|---|---|---|
| B7 | **Riding** — `Mount`, `Player.mount`, gaits, GALLOP, STEED, mounted DRAW / SLASH, dismount | B4 horse, B2, B3 |
| B8 | **Taming** — TRUST approach, bucking balance, TULPAR at the rail, whistle | B7 |
| B9 | **Crouch + stealth** — the context CROUCH disc, detection model, eye pip, wolves reading grass | B1, B4 |
| B10 | **Day/night clock + storms** — `Weather`, six storm phases, lightning, stampedes, dusk / night triggers | B0, B1 |
| B11 | **Balbal warriors + ghost riders** | B10, B5 |
| B12 | **Named elites system** + Aqbars, Kokbori, Qyran, Qara Batyr, Argymaq | B4, B9, B10, B11 |
| B13 | **Boss system** + **the Golden King** (kurgan dungeon, 3 phases, phase checkpoints, Golden Bow) | B5, B11 |
| B14 | **the Storm Titan** (storm-only, mounted, Naizagai + saddle) | B7, B10, B13 |
| B15 | **Inventory items, achievements + joke titles, skins, map/minimap for Nalati** | B12, B13 |
| B16 | **Audio + folk music** (wind layers, hooves, wolves, storm; MUSIC v2 folk style), **menu / loading / hero art**, the card drops SUPER EXPERIMENTAL | all |

### The look pass (N7 — top priority, runs across every row)

The user saw the first in-engine shots: "the art style from the mock-ups is just like a hundred times better …
a massive passover … the art direction, the rendering, the quality of the models … a lot of density … almost PS5
level." Spec, levers, reference poses and owners: `docs/design/nalati/look-pass.md`. Done = the parity harness
(`scripts/nalati-parity.mjs`) shows engine and mockup side by side and they read as the same game, at 60 fps on
the phone tier.

| # | lever | owner |
|---|---|---|
| L1 | painterly shader, aerial perspective, sky + cumulus + cloud shadows, grade + bloom + AO, painterly filter; the parity harness | look-director |
| L2 | terrain surface, roads, gravel, rock formations, snow, river, landscape drama | world-agent |
| L3 | grass + flower drifts | grass-agent |
| L4 | world density: rocks, shrubs, flowers, logs, fences, ribbons, camp clutter, pebbles, reeds, pollen, birds | dressing-agent |
| L5 | creature models | creature-agent |
| L6 | POI models (yurts, camp, bridge, kurgans, balbals, cairn, rocks) | poi-agent |
| L7 | first-person arms, sleeves, gloves, bow, sabre, spear | bow-agent + melee-agent |

## Deploy — none from this worktree

The user (2026-09-23): "You can't push … you're a worktree, we have to rebase you on main and merge you manually …
just focus on local development and not pushing." So: **no pushes from the Nalati worktree, ever.** Development
and review are local (dev server http://127.0.0.1:5188/?chunk=nalati-grasslands). An attempted checkpoint push
(279 MB, mostly mockup PNGs) held the shared push lock for 80+ minutes and was killed; nothing reached origin.

When the user asks for the merge: merge local `main` into the branch, pass every gate on a clean export, convert the
mockup PNGs under `art/nalati-grasslands/` to JPEG, land it in the main checkout as a **squashed** local commit
(`git merge --squash`, so the PNG history never enters main) or `--ff-only` as the main sessions prefer, report the
pack size, and let the main sessions' `scripts/push-main.sh` carry it. A prepared merge of main (11 conflicts
resolved, gates green at the time) sits in the scratchpad deploy worktree at `4c191a3` for reference.

## Mockups

- `art/nalati-grasslands/round-1/` — 4 art styles, 5 combat, 6 enemies, 2 features, 4 concept pieces (the user
  picked style B, combat A / B / C / D).
- `art/nalati-grasslands/round-2/` — painterly: `1-combat` (7), `2-creatures` (8), `3-features` (5),
  `4-named-elites` (5), `5-bosses` (6), `6-maps` (20 + the OpenTopoMap reference; the user picked map-01),
  `7-controls` (9).
- `art/nalati-grasslands/round-3/` — `1-elite-swap` (Argymaq ✔ / Qonyr), `2-storm-titan` (5),
  `3-crouch-disc` (3, option D as picked).
