# Content audit: Nalati Grasslands and Nine Dragon Stack (tag `pre-normalization`, 2026-09-30)

> **State:** evidence for [../GW2-ZONES.md](../../GW2-ZONES.md), written 2026-10-01 from singleplayer at tag `pre-normalization` (`dcd6a29a`, 2026-09-30). Read from code and docs; nothing was played, so every minute figure is an estimate.

This audit covers game content, not tech. Paths are in the singleplayer repo at tag `pre-normalization` (read with `git show pre-normalization:<path>`). Archived plans that were not exported were read with
`git show pre-normalization:project/archive/…`. I read the code and the docs. I did not play the build, so anything
about feel, difficulty or how long something takes is an estimate from the code's numbers.

**TL;DR**

| | Nalati Grasslands | Nine Dragon Stack |
|---|---|---|
| Deck status | EARLY ACCESS (`src/chunks/registry.ts` CHUNKS) | EXPERIMENTAL prototype card (`registry.ts:36-40` PROTOTYPES, E318: shown to everyone) |
| Quest | 3 chained chapters, 11 steps, 1 quest giver; wired end to end in code | none |
| Bosses | 2: the Golden King (dungeon, 3 phases) and Jel Ata the Storm Titan (open sky, mounted, 3 phases) | none (the Well Dragon is planned) |
| Named elites | 5, each with a rule, a signature move, phase 2, a cosmetic drop and a 20-min respawn | none (3 planned) |
| Hostile species | wolves (den pack + raid pack), wild stallions (charge), balbal warriors (dusk), ghost riders (night), the King's kurgan balbals | none |
| NPCs with dialogue | 5 camp people: 60 lines, ~1,230 words, flag-reactive; + 3 balbal carvings | 0 (≈700 static crowd figures, no AI, no talk) |
| Achievements / titles | 17, each with a joke title | 0 |
| Cosmetics | 5 skins + 2 legendary weapon upgrades | 0 |
| Economy | none (no coins, shop, pack or harvest: E314 C) | none |
| Day/night, weather | 26-min play-time clock; storms every 20–30 min with lightning | fixed blue hour, drizzle (look only) |
| Traversal toys | horse (tame, bond, name, gallop, shoot from the saddle), crouch/stealth, Eagle Rock scramble | Fei Zhua grapple (LOCK→GRAPPLE, JUMP→ZIP), stair-streets, Well crossings; lifts, cable cars and monorail are **decor or unbuilt** |
| First-time content | ~1.5–2.5 h for the golden path, ~3–4 h to 100 % | ~10–20 min of walking, zipping and looking |
| Replay value | low-moderate: nightly enemies, elite respawns, boss re-fights, but nothing new to earn after the first clear | ~nil (dev-mode grapple course with a best time) |

---

# Part 1 — Nalati Grasslands

Code: `src/chunks/nalati-grasslands.ts` (the def), `src/chunks/nalatiLayout.ts` (every coordinate), `src/nalati/` (the
systems), `src/world/nalati/` (POIs, dungeon), `src/game/quest/nalati.ts` (quest data and dialogue), `src/game/Elite.ts`,
`src/game/Boss.ts`, `src/game/Taming.ts`, `src/entities/Wildlife.ts`, `src/player/nalatiKit.ts`.
Story: singleplayer `docs/Nalati-Grasslands-blow-by-blow.pdf`. Plans: `project/archive/2026-09-23-nalati.md`, `…-24-nalati-merge.md`,
`…-30-nalati-finish.md` (archived; leftovers are N11 and N24). Design: `docs/design/nalati/*.md`.

## 1. World layout (layout v2, Jake's pick "map 4, the bowl and the snow ring")

`src/chunks/nalatiLayout.ts`. The axes are unusual: +z is north and **+x is west**. The slab is ±250 m.

| Zone | Where | What is there |
|---|---|---|
| **Nalati Grasslands** (the green valley) | north band, z > +125, y ≈ −8 | spawn (0, 232) at the N gate; the braided Kunes river (`riverZAt`); the timber bridge (0, ~172); the **nomad camp** (88, 212): 6 yurts, a corral, the hitching rail, an eagle perch, a ribbon pole; the fenced **sheep pasture** (−120, 212) |
| **The Sky Grassland** (the golden bowl) | z +96 … −48, x ±205, floor +27, rim +39 | the **sky road** (5 switchbacks up the escarpment, then a ribboned gateway at (120, 70)); **Eagle Rock** (180, 85, top +65, with a scramble trail); the **horse plains** (65, 36, r 60); the **kokpar field** (−61, 36); the **kurgan field** (7 mounds, the **great kurgan** at (−191, 75)); the **summer camp** (−91, −26); the **Wind Cairn** (−30, −45) on the south rim |
| **Snow Lotus Valley** and the snow ring | south and east, crags up to +110 | the Crags (−180, −115, peak 105) and the West Crags; the glacier tongue and its meltwater stream; the **snow leopard cave** (138, −68); **Argymaq's pasture** (−160, −72, +52); the ruined **watchtower** (−208, −38); snow lotus clusters |

On the map: 3 zone labels and 17 named places (`NALATI_MAP.pois`). Each place is discovered by walking within its radius
(32–60 m), the discovery is saved as a `seen:<id>` flag, and a toast fires (`src/nalati/adventure.ts`
`placesWithDiscovery`). Lone spruces only: Jake cut the spruce forest, the mill, the waterfall, the tarn and the balbal
circle ("we are trying to CRAM way too many biomes in").

Since N23 the slab edge is hidden by a grassy berm, a 7–21 m rise with a >40° face (`src/chunks/nalatiEdge.ts`).

## 2. Quests and story

`src/game/quest/nalati.ts` holds the data and the dialogue; `src/nalati/adventure.ts` is the runtime on the shared quest
core (`src/game/quest/core.ts`). One quest giver: **Baqyt Ata**, the camp elder. The chapters chain: each starts once the
previous one is complete *and* the elder has given it (`talked:elder:2` / `:3`). Every chapter step is a flag.

| Ch. | Title (chip) | Steps | Completion source | Reward |
|---|---|---|---|---|
| 1 | **Tulpar** (start: talk to the elder) | 1 Break a wild stallion on the horse plains (or Argymaq) → 2 Win a round of kokpar → 3 Ride home to Baqyt Ata | `tamed:horse` polled from `Taming` (`src/game/Taming.ts`); `won:kokpar` (`src/nalati/kokpar.ts`); `told:tulpar` (dialogue) | title "Formerly On Foot" (achievement `tulpar`), a reward caption. The tamed horse itself (Tulpar, saved in `ws.nalati.tulpar`) is the real prize |
| 2 | **The Golden King** | 1 Topple 3 balbal warriors at dusk (each shows a carving: 3 × 2 lines of the King's story) → 2 Find the great kurgan's door (faces west) → 3 Defeat the Golden King → 4 Bring a gold plaque home | `animals.onKill` chained for kind `balbal`; `KurganBoss.inside`; `Boss.defeated` (saved `ws.boss.v1`); dialogue | title "Honorary Balbal"; the boss itself pays the **Golden Bow** |
| 3 | **Father of the Wind** | 1 Win 3 storm feathers (any 3 of the 5 elites felled; Argymaq counts if broken) → 2 Tie the feathers to the Wind Cairn **in a storm, mounted** → 3 Defeat Jel Ata → 4 Ride home | the elite store `ws.elites.v1` (re-read every 2 s); `StormTitan.fight.tied`; `boss.defeated`; dialogue | title "Weather Complainer (Successful)"; the boss pays **Naizagai** and the Sky-Marked Saddle skin |

- **Completable end to end in code?** Yes, on paper. Every flag has a raiser, `NALATI_QUEST_EXTERNAL` lists them, and
  `test/quest-nalati.test.ts` covers the chain. The steps also "catch up": anything already done (a horse tamed, a boss
  beaten) counts the moment its chapter starts, and the bosses are always open.
- **How it was verified:** `scripts/nalati-quest-check.mjs` (`git show pre-normalization:…`) drives chapter 1 through
  flags and the kokpar's dev `win()`. For chapters 2–3 it **writes "defeated" into the saved boss and elite stores, then
  reloads**. The archived plan says the Golden King was "played in god mode only" (row B13). I found no record of a full
  legitimate playthrough. Jake's own bug list after playing v0.3.0 ("definitely bugs … but it's a start") is still owed
  (N24, `needs you`).
- **After the last chapter:** no chip. The map card says "The steppe has more stories. Baqyt Ata will tell them." No
  epilogue and no "shard complete" screen. The E108 audit flagged the same gap on Driftwood.
- **Side quests:** none as quests. The only optional activities are the other elites, the achievements, the sheep raid
  (§8) and naming your horse.
- **Repeatable:** kokpar is open any time. A round: ride in mounted, snatch the goat, drop it in a tai-qazan within 45 s,
  and never stay at a trot or slower for 2.5 s. Only the first win sets a flag, and repeat wins pay nothing. The **6
  kokpar riders are scenery**: an InstancedMesh looping laps with a gallop baked into the vertex shader
  (`src/world/nalati/Bowl.ts:154-188`). "A rider snatches it back" is a timer, not an opponent. There are no races; a
  horse lap timer exists only in the dev-mode horse playground (E307).

## 3. Bosses (`src/game/Boss.ts` + scripts)

The shared Boss system works the same for both: an arena with a seal, a name-card intro, a top bar with phase segments,
a checkpoint per phase (a death puts you back at the start of the phase you reached, at full health, ammo refilled), a
legendary reward orb granted **once ever** (`ws.boss.v1`), and **re-fights allowed** with a short intro (`Boss.ts:265`).
A re-fight's reward is a "trophy", but Nalati has no pack, so a re-fight pays nothing.

### 3a. The Golden King (`src/nalati/kurganBoss.ts`, `src/world/nalati/KurganDungeon.ts`, `src/entities/species/goldenKing.ts`)
- **Trigger:** walk into the passage in the great kurgan's west flank. A fade takes you down the dromos to an underground
  chamber (built 140 m up and hidden; the outdoor world is hidden while you are inside). Always open, quest or not.
- **Phase I, "The King's Court" (100→60 %):** an akinakes combo (14/14/22; the blade glints before each cut, the third's
  arc is painted on the floor) and the SUNBURST (a gold ring races out across the floor; jump it, 25). Gold scale halves
  arrow damage and headshots do ×2.5. Six sabre or spear hits knock his plaques loose, and then his chest takes arrows in
  full.
- **Phase II, "The Kurgan Wakes" (60→30 %):** he kneels behind a gold dome. 2 balbals step out of the wall niches, 2 more
  if you are slow. Sand pours from marked ceiling spots and drifts build up (half speed in sand). The last balbal breaks
  the dome and stuns him for 4 s.
- **Phase III, "The Gold Burns" (30→0 %):** a 4th strike and a double sunburst. A burning beam sweeps the floor (15 to
  you; lure him through it for 50). Headdress: 200 hp of headshots drop him to one knee for 3 s.
- **Reward:** the **Golden Bow**. It draws 20 % faster; a full draw is a "sun arrow" that pierces through to a second
  target; ×2 / ×3 against balbals (`src/player/GoldenBow.ts`). Also the achievement "Kurgan Robber" (title "Grave Robber
  (Licensed)").
- F9 fixed a bug where he stood tilted 21–64° through the whole fight. He now has a Hunyuan3D model and a remastered
  face (E343).

### 3b. Jel Ata, the Storm Titan (`src/nalati/stormTitan.ts`, `stormTitanLook.ts`)
- **Trigger:** "Tie a cloth strip" at the Wind Cairn. It works **only during a natural storm, and only mounted**. There is
  no summon (Jake picked "natural storms only"). Once the fight starts, the storm is held open. A death respawns you
  mounted at the cairn.
- **Arena:** a 68 m circle on the bowl against the south rim, sealed by a storm wall the horse refuses (it stings on
  foot). The Titan is a ~110 m giant of ~340 cloud puffs standing in the cloud sea, ~60 m beyond the rim. His **heart** is
  the only target: arrows read IMMUNE while it is shut, and a full draw does ×2.5. 2,600 hp.
- **I, "The Sky Spear":** a forked gold ring tracks you, then the strike lands (40, throws you from the saddle). The spear
  stays stuck for 3 s and the heart opens. 3 whirlwinds wander the arena (15).
- **II, "The Three Winds":** he kneels behind a dome. 3 storm riders (250 hp; the ghost-rider rig) charge down painted
  lanes (30). Their flank is open for 2 s after a pass (sabre ×3). Each rider killed takes 8 % off him; the last one
  breaks the dome.
- **III, "The Grass Fire":** a burn grid spreads downwind (8/s), the horse refuses fire lines, and chain-lightning rings
  trail your path (18).
- **Reward:** **Naizagai**, the storm sabre. At a gallop every slash throws a lightning crescent (40, arcs once more); a
  full heavy on foot calls a bolt (60); +25 % in a storm. Also the **Sky-Marked Saddle** skin and "Weather Report" (title
  "Partly Cloudy").
- **The end-game reward has little to be used on:** Naizagai arrives after the last boss. What is left to swing it at is
  the respawning elites, the nightly enemies, the wolves and a boss re-fight.

## 4. Named elites (`src/nalati/elites.ts` over `src/game/Elite.ts`)

Shared rules for all five: aware → engaged → leash (they reset and regenerate past the leash), a bar over the head that
pins top-centre once engaged, phase 2 at 50 % (1 s invulnerable), a "NAMED ELITE NEARBY" banner, a gold skull on the
minimap once the lair is discovered, a cosmetic drop on the **first kill only** (a purple orb), a joke-title achievement,
and a lair that sleeps **20 minutes of play** after a kill (saved in `ws.elites.v1`).

| Elite | Species / lair | Rule | Signature move (tell) | Phase 2 | Drop | Achievement / title |
|---|---|---|---|---|---|---|
| **Aqbars the Pale**, Irbis of the Crags | snow leopard, the Crags cave | always | POUNCE from a ledge: a red-gold ring at your feet for 1.0 s → 35 + knock-down; a miss leaves him OPEN 1.5 s (headshots ×3) | ENRAGED: hit-and-run from the ledges, where he takes ¼ damage | IRBIS sabre skin | Irbis / "Crazy Cat Person" |
| **Kokbori**, Mother of the Pack | giant she-wolf + a pack of 5, NE rim den | dusk and night | PACK HOWL: pale rings for 1.2 s → the pack encircles; hit her mid-howl to break it | the pack falls back and she comes herself (lunges, 22) | SKY-WOLF bow skin | Leader of the Pack / "Good Boy Denier" |
| **Qyran the Storm-Wing** | giant golden eagle, Eagle Rock | **storms only** | STOOP: a gold line and an edge chevron for 1.2 s → a 40 m/s dive, 30 + knock-down; a miss grounds her for 2 s (×2.5) | higher, into the cloud, faster stoops | STORM-WING arrows | Clipped / "Birdwatcher (Aggressive)" |
| **Qara Batyr the Unburied** | ghost-rider captain (800 hp), the south-rim burial cairn | night, **after you kill 5 ghost riders that night** | DEATH CHARGE: a lane of cyan fire for 1.3 s → 38 + knock-down; swerve and his back is open 2 s (blade ×3) | charges come in pairs | NIGHT RIDER mount skin | Ride the Night / "Night Shift" |
| **Argymaq the Unbroken** | feral black stallion (750 hp) + his herd, Argymaq's pasture | always, **once** | TRAMPLE lane when he rears | HE RUNS: he leads the herd away | none: below 25 % he is BROKEN, you mount and break him, and he **replaces Tulpar** as your horse (×1.3); the lair retires | Unbroken, Until Now / "Horse Whisperer (Shouting)" |

Planned and cut: Tas Ata the Stone Father (swapped for Argymaq by Jake); elite trophies (removed in E314 C, "Nalati has no
pack").

## 5. Enemies (hostile species and spawns)

There is no generic spawn table: `fauna: []` in the def. Everything is placed by `NALATI_WILDLIFE`
(`src/entities/Wildlife.ts:47-55`) and the night systems.

| Enemy | Where / when | AI archetype | Count | Respawn |
|---|---|---|---|---|
| Wolves (alpha, grey, tawny, scout) | the den pack below Kokbori's den on the NE rim | `Pack.ts`: roam → shadow → encircle ⇄ regroup → break; smell from downwind; reads stealth | 5 | **no respawn code** in `Wildlife` / `Pack`: dead for the session, back on reload |
| Raid wolves | a valley den 85 m past the pasture | `Pack.raid`: every 6–9 min (first raid 2.5–4 min in) they hunt the flock if you are within 220 m; they hunt you if they find you | 3 | re-spawned only if you killed them, **at most twice a session** (`src/nalati/sheepRaid.ts`) |
| Wild stallion (plains herd) | horse plains: 11 mares, 3 foals, 1 stallion | `Herd.ts`: rears at red ALERT and charges if TRUST < 20; stampedes when disturbed | 1 hostile-ish | tameable; one horse ever (except Argymaq) |
| **Balbal warriors** (stone) | the kurgan crowns + the ring; they wake at dusk | `species/balbal.ts`: rise, guard, stalk, a SLAM with a 1.5 s amber wedge telegraph; sabre / spear damage model, a sun arrow shatters the crack | 4 of the ring (different each night) + 1 crown balbal **per dusk** | survivors sink back at dawn; a fresh set every dusk (`src/nalati/balbalWarriors.ts`) |
| **Ghost riders** | at night, a line of 3 rides the bowl's ridge loop and wheels on you within ~70 m | horse archers circling at 34 m, slow cyan arrows (10), 70 hp | 3 per line | a new line 60 s after the last dies, all night; they dissolve at dawn (`ghostRiders.ts:66,359`) |
| Kurgan balbals (boss adds) | the Golden King's phase II | `species/kurganBalbal.ts` | 2–4 | per fight |
| Storm riders (boss adds) | the Titan's phase II | the ghost-rider rig ×1.6, 250 hp | 3 | per fight |
| Lightning (hazard) | storms | strikes the highest exposed thing; 60 damage within 4 m; a GET LOW warning; yurts shelter you | — | every storm |

The E108 audit (2026-09-24) measured **"two wolves took me from 100 to 4 health in ~8 s"** and saw **"NAMED ELITE NEARBY ·
AQBARS" firing at the camp and on Eagle Rock**. The commit log after that date has no wolf-damage or elite-banner fix, so
both are probably still true (unverified).

## 6. Neutral creatures, NPCs and dialogue

- **Camp people** (`src/nalati/campPeople.ts`, `campPeopleModels.ts`): Baqyt Ata (the elder and quest giver), Dauren
  (herder at the corral gate), Erlan (herder at the hitching rail), Ayan (a child skipping round the ribbon pole), Gulnar
  Apa (the cook at the stove). They are image-to-3D bodies with Hunyuan3D-2 heads (Jake's pick D, E343) on one skinned
  mesh. They idle, breathe, turn to face you, track you with their head, and gesture and nod while talking. The cook
  stirs. All of them stay at fixed spots and **never move around the camp**.
- **Dialogue volume:** **60 lines, ~1,230 words** over 5 NPCs (counted from `src/game/quest/nalati.ts`), plus 3 carvings
  (6 lines). The elder has 13 states and ~34 lines. The others have 2–4 states each, mostly one-liners that react to
  flags (taming, kokpar, King dead, Titan dead). Humour is the tone ("the rules are also a goat"). No voice acting and no
  barks.
- **The mounted shepherd** (Dauren's brother, `sheepRaid.ts`): rides a ring round the flock and gallops at raiding
  wolves, cracking a whip. He has no dialogue.
- **Wildlife:** the plains horse herd (11 mares, 3 foals, the stallion) and **"herds in the hundreds"** as instanced far
  herds (~240, `src/entities/farHerd.ts`); saddled camp horses at the hitching rail (rideable by anyone); the sheep flock
  (40, instanced; they can be shot) and a collie that barks at wolves; marmots (7 burrows × ~4, in the bowl); butterflies
  (14 on phone / 30 on desktop) and 3 circling raptors (`src/chunks/nalati-grasslands/models/ambientLife.ts`); a static
  golden eagle on a perch; the 6 decorative kokpar riders.
- **No traders and no shop** on Nalati (E314 C).

## 7. Collectibles, feats and cosmetics

- **Places:** 17 discoverable places (§1). FINDS in the Bag lists them (`src/nalati/bag.ts`).
- **No other collectibles.** Nothing comparable to Driftwood's sea glass or treasure. I found no secrets or hidden items
  (grep for secret, collectible or treasure in the Nalati modules returns nothing).
- **Achievements:** 17 (`src/game/achievements.ts` NALATI). 2 bosses, 5 elites, tame, kokpar, 3 chapters, then wolf5,
  wolf25, the pack alpha, balbal5 and ghost10, each with a joke title (worn on the menu; single-player only shows it
  there). wolf25 needs several sessions of reloads: the den pack doesn't respawn and the raid pack respawns at most twice.
- **Cosmetics:** 5 skins (`src/player/nalatiSkins.ts`): Irbis sabre, Sky-Wolf bow, Storm-Wing arrows, Night Rider mount,
  Sky-Marked Saddle. You wear them from GEAR. Locked ones are dimmed and say who drops them.
- **Weapon upgrades:** the Golden Bow and Naizagai (§3).
- **Horse:** Tulpar (or Argymaq), nameable at the hitching rail (`src/player/horseNames.ts`).
- **Trophies, pelts and the pack:** removed (E314 C).

## 8. Points of interest and traversal

- **POIs with gameplay:** the camp (quest hub, horses, people); the horse plains (taming); the kokpar field; the kurgan
  field (dusk balbals) and the great kurgan (dungeon + boss); the Wind Cairn (Titan); Eagle Rock (Qyran, a scramble
  trail); the leopard cave (Aqbars); Kokbori's den; Qara Batyr's cairn; Argymaq's pasture; the sheep pasture (raids).
- **Scenery only (no gameplay found):** the bridge, the Kunes, the sky road, the **summer camp**, the **watchtower**, the
  glacier, the Crags, the snow lotus, Snow Lotus Valley itself. The whole south third of the map has one elite lair and
  one boss trigger on its edge.
- **The horse** (`src/nalati/ride.ts`, `src/game/Taming.ts`, `src/player/Mount.ts`)
  - Taming has three stages. Approach: TRUST and ALERT meters, crouch and offer your hand, the wind direction matters.
    Breaking: 5 bucking rounds, leaning L/R against a balance marker. Then you are bonded.
  - Gaits up to a gallop; you can shoot the bow and swing the sabre from the saddle.
  - Whistle him with X / HORSE. He keeps to the road if you let go of the stick, has a rhythm spur and a skid stop, and
    panics at wolf bites and lightning.
  - Look-behind is ±140°. Jumps exist in the playground. DISMOUNT is a small edge tab.
- **Crouch and stealth** (`src/nalati/stealth.ts`): you can only crouch in long grass. A HIDDEN / VISIBLE / NOTICED /
  DETECTED eye pip and a grass cover meter. Arrows and javelins do ×2 from HIDDEN.
- **Dev-mode only:** a horse playground (a 480 m oval with a lap timer and 4 jumpable rails, E307). The shared practice
  arena.

## 9. Player-facing systems

| System | What exists |
|---|---|
| Weapons (`src/player/nalatiKit.ts`) | **Bow** (Skyrim-style: hold FIRE 0.75 s to draw, early release lets the arrow down, AIM is a 2× toggle, arms tire at 8 s; arrow drop + wind drift; recoverable arrows) · **Sabre** (the engine sword's sweep; lock-on) · **Spear** (thrust, BRACE against a charge, **javelins** thrown from the slot). Upgrades: Golden Bow and Naizagai. An AR-15 is in the kit but locked (main.ts; I found no Nalati pickup for it) |
| Loot | first-kill elite skins, 2 boss legendaries. **No drops from ordinary enemies** |
| Economy | **none**: no coins, purse, shop, bounty, pack or harvest (`src/game/Inventory.ts:87-88`; loot installs only with `loot.coins`, i.e. Driftwood) |
| Progression | the horse, 2 weapon upgrades, 5 skins, 17 titles. No XP, no stats, no levels |
| Saves (localStorage, per shard) | quest + discovery flags (`ws.flags.v1`), bosses (`ws.boss.v1`), elites (`ws.elites.v1`), skins (`ws.nalati.skins.v1`), Tulpar (`ws.nalati.tulpar`), horse names, achievements (`ws.progress.v1`). **The clock and the weather are not saved**: every load starts at ~16:15 (late afternoon) with the first storm 12–18 min away |
| Death | you respawn at the **shard spawn (the N gate)**: `LastPlace` is wired only for Driftwood's adventure (`main.ts:950-951`; `ADVENTURES` has only `driftwood-isle`). Boss deaths use the phase checkpoints |
| Day/night | `src/world/DayClock.ts`: a play-time schedule of ≈ 26 min per day (day 10 · golden 3 · dusk 3.5 · night 7 · dawn 2.5). Computed from the def's sun (elevation 26°): **first dusk ≈ 3 min after load, night ≈ 7–14 min**, the next dusk ≈ 30 min. A sun/moon glyph on the minimap rim |
| Weather | `src/world/Weather.ts`: clear (first 12–18 min, then 20–30) → building 90 s → gust 20 s → storm 2–3 min → clearing 60 s → after 3 min. Rain, a dark slate sky, gusting wind, lightning that targets the tallest exposed thing (60 damage, GET LOW, crouch / yurt shelter), herds stampede, wolves get bolder |
| Music and SFX | the Kazakh score on MiniMax Music 3 (slots grass / sky / snow / night / storm / king, `SteppeScore`); 51 SFX families, each generated twice (MOSS + SA3) |
| HUD | the baseline HUD plus the CROUCH disc, the HORSE tab, the weapon strip, the elite and boss bars, the quest chip |

## 10. A living world?

**Timed and dynamic:** the day/night cycle; storms with lightning; balbals waking each dusk; ghost-rider lines all night;
elites gated by dusk, night or storm; wolf raids on the flock every 6–9 min with the shepherd's response; herd stampedes
from shots and lightning; wind in the grass and trampling; butterflies and raptors.

**World state that changes for good:**
- Tulpar or Argymaq waits at the rail.
- Argymaq's lair retires.
- The skins show on your gear.
- The NPC lines change with the flags.
- Places stay discovered.

**What doesn't change:**
- After Jel Ata, Erlan and the elder say "no storm for three days", but **storms keep cycling exactly as before**: neither
  `src/nalati/weather.ts` nor `src/world/Weather.ts` reads the Titan's defeat.
- The elder says he will hang the gold plaque on the ribbon pole; **nothing appears**.
- No camp growth, no visitors, no new NPCs after the story.

**Reasons to come back after the last chapter:**
- the elites you skipped (Qyran is storm-only),
- the achievement grinds (wolf25, ghost10, balbal5),
- boss re-fights, which pay nothing.

There are no rotating tasks, contracts or bounties. Pine Hollow has rotating lodge contracts; Nalati has nothing like them.

## 11. Estimated minutes of content (first-time player)

| Segment | Estimate | Why |
|---|---|---|
| Spawn → camp, 5 conversations | 3–6 min | spawn (0, 232) to camp (88, 212) is ~90 m; 60 lines of dialogue |
| Ch 1: learn taming (approach + 5 bucking rounds), learn kokpar | 10–20 min | trust needs a crouched approach with the hand held out (+2/s, +8/s inside 12 m); a throw resets it and costs −40; kokpar has a 45 s timer and a 2.5 s slow-speed rule |
| Ch 2: dusk balbals ×3, the door, the King (3 phases + adds) | 20–40 min | dusk comes ~3 min after a load, but only once per ~26-min cycle; checkpointed retries |
| Ch 3: 3 elites + a storm wait + the Titan | 35–70 min | elite fights plus travel across a 500 m slab; Kokbori and Qara Batyr are night-gated (Qara needs 5 rider kills first); the storm comes 12–18 min after a load and the tie window is ~2.3–3.3 min; the Titan has 3 phases and a fire grid |
| **Golden path total** | **≈ 70–135 min (call it 1.5–2.5 h)** | waiting on the clock and the weather is a real share of it |
| 100 %: the other elites, 17 places, all achievements (wolf25 needs reloads) | +60–120 min | |

**Replay value: low to moderate.** The systemic layer (the clock, storms, night enemies, elite respawns, riding feel)
makes the open world pleasant to be in. Once the story and the five drops are done, though, nothing new can be earned:
no economy, no rotating tasks, no gear progression, and re-fights pay nothing. Honest caveat: none of these minutes were
measured, and the shard has never had a recorded clean playthrough (§2).

## 12. Stubbed, planned-not-built or broken (Nalati)

- **Never played through legitimately on record.** The King "played in god mode only"; chapters 2–3 are verified by
  forging saves (§2). Jake's bug list is owed (N24).
- **Probably still open from E108:** wolf damage (100→4 in 8 s); the Aqbars banner firing far from his lair. The
  untextured east-edge slabs and black spruce cut-outs are likely fixed by the N23 berm.
- **Open asks:**
  - E353:
    - the "PACK HOWL" toast draws over Kokbori's bar title;
    - lightning can panic the playground horse;
    - the Model Explorer's camp-people card shows only the elder.
  - E355:
    - the horse-name box eats keyup, so the player keeps walking;
    - horse names are shared per coat variant;
    - a rider-less playground horse follows the terrain 3 km below.
  - E106: a minimap spruce-stipple hitch.
  - N11: no real-iPhone fps reading.
  - B8: the phone load peaked at 1.833 GB, over the 1.8 GB cap. A fix is built, but the iPhone re-read is owed.
- **The fiction doesn't match the world state:** storms continue after Jel Ata; no plaque on the ribbon pole.
- **Planned, not built:**
  - the eagle-hunter companion (parked at the first decision round);
  - Tas Ata (cut);
  - elite trophies (removed);
  - the "Summon at the cairn" Titan option (not picked);
  - Jake: "Camp people lol needs more work" (faces remastered since; behaviour unchanged).
  - N22: "HUD I'll fix later. Golden bow I'll fix later" — Jake's own leftovers.
- **Thin areas:** Snow Lotus Valley (the zone Jake traded the spruce forest and balbals for) has no activity; neither do
  the summer camp and the watchtower.
- **Cross-shard:** nothing ties Nalati to other shards: progress, titles and inventory are all per shard (E108 §c).

---

# Part 2 — Nine Dragon Stack

Code: `src/chunks/nine-dragon-stack/` (108 files, 25,487 lines per `docs/plans/game-normalization/05-nine-dragon.md`),
the plan `docs/plans/NINE-DRAGON-STACK.md`, the design `docs/design/nine-dragon-stack/`, `docs/design/LOOK-LOOP.md`, the
asks E169, E264, E281, E283, E286, E307, E355. Story: singleplayer `docs/Nine-Dragon-Stack-blow-by-blow.pdf`.

Its own def is blunt about it (`def.ts:1-5`): "Only the fragment around the spawn … **No strata, lifts, cable cars, quest
or enemies**". So is its Bag (`bag.ts`): "a prototype with **no loop — no enemies, no items, no feats**". Almost all of
the ~25 k lines are world construction, the Jiehua Neon look, the rigged first-person arms and the grapple.

## 1. What is built (the fragment)

| Area | Built | Files |
|---|---|---|
| **Lantern Square** (+125 m, the spawn) | wet granite plaza; the paifang gate with the 九龍 plaque; a banyan in a planter; mahjong tables and players; a noodle stall and a hawker stall; an earth-god shrine and a stele; TRELLIS stone lions; lantern strings; neon signs; scooters | `world/square.ts`, `gate.ts`, `banyan.ts`, `canopy.ts`, `stalls.ts`, `props*.ts`, `hero/*` |
| **The street north** through the gate | a street to its end wall (z −230) under a skybridge | `towers.ts`, `layout.ts` STREET |
| **The stair-street** | 3 flights (rise 21 m) east to the stair gate at +146 m; towers and facades | `stairstreet.ts`, `stairstreet-upper.ts`, `towers.ts` |
| **The Yamen Well** | rim and balustrade; upper galleries; bridges and crossings (walkable); layered galleries down into the mist (a 190 m lantern-lit canyon); a temple on a rock island far below (visual) | `well*.ts`, `well-plan.ts` |
| **City fabric** | the facade grammar (28 piece types, interior-mapped windows), ~2,583 paper lanterns, ~9,500 light emitters baked into volumes, an SDF neon sign atlas, laundry, the shanshui scroll on the LED sky screens | `world/facade/*`, `look/*` |
| **Movers (decor)** | a monorail train sliding across the north side, a cable gondola on its line over the Well, 2 surveillance drones circling: **they neither collide nor carry** | `models/movers.ts`, `world/build.ts:398-490` |
| **Crowd** | ≈700 TRELLIS walker / sitter figures, culled and LOD'd: **static, no animation, no AI, no talk** | `world/crowd.ts`, `models/crowd.ts` |
| **Named places** | 6, as Sets for the Model Explorer only (no discovery toasts): Lantern Square, Night Market, Stair-Street, the Well Rim, Well Galleries, the Crossings | `places.ts` |

**Bounds** (`def.ts` `bounds`, F1): invisible walls and a soft respawn on the last floor you stood on (19 walk legs, 0
stuck or escaped). The Well has a "safety cap" that opens for one committed grapple crossing (`index.ts`).

## 2. Quests, bosses, enemies, NPCs, collectibles: none

| Category | Built | Planned (NINE-DRAGON-STACK.md) |
|---|---|---|
| Quest | **none** | **Nine Red Envelopes** (§4.5): deliver one red envelope to each stratum's shrine from the Sump to the Crown; each delivery unlocks that stratum's lift stop (fast travel); the 9th wakes the boss. Chip "RED ENVELOPE 0/9 │ CROWN +250 M" |
| Boss | **none** | **The Well Dragon**: the cableway gone rogue, a ~300 m serpent of linked gondolas and neon coiling up the Yamen Well; a climbing fight, stratum by stratum; you hook onto its segments and ride it; the finish is on the Crown's VTOL pad (P5-L5, on the shared `Boss`) |
| Elites | **none** | the Dentist (Old Street), the Hotpot King (Shelter Market), the Sky-Screen Warden (Cable Deck) |
| Enemies | **none** (`fauna: []`; the roster is gear only, `roster.ts`) | **Tong enforcers** (Lantern Tong: streetwear and lacquered plates, neon visors: the jian's fair fight); **Jiangshi** (cyborg hopping vampires in Qing robes with a glowing QR talisman; they hop *vertically* between floors in strata 1–4; hook the talisman off to stun); **crane drones** (paper-crane surveillance that calls the Tong, hookable out of the air) |
| Fauna | **none** | pigeons, stray cats (a "cyber-cat companion quest?"), koi in the yamen pond, eels and rats in the Sump, crows |
| NPCs / dialogue | **0 lines** | crowd walla only ("no fake Cantonese"); nothing else specified |
| Collectibles, achievements, titles, cosmetics | **0** (no achievement table, so the Bag hides FEATS; no pack) | none specified beyond the envelopes |
| Economy / loot | **none** | none specified |

## 3. Traversal toys

| Verb | State |
|---|---|
| Walk / sprint on built floors (structure-first shard) | built |
| Stair-streets (`treads` colliders) | built: 3 flights |
| Well crossings and bridges | built, walkable (0 stuck on six routes) |
| **Fei Zhua grapple** (`grapple/Traversal.ts`, `course.ts`, `line.ts`, `fx.ts`) | **built and playable.** LOCK turns into GRAPPLE when a brass dragon hook is in reach (2.5–38 m, in sight, with a floor to land on); a locked hook turns JUMP into ZIP; a motor-driven zip at 22 m/s with an FOV kick, a rope with sag, a bite flash, and a miss that snaps back. Hooks sit on the square's masts, tower fronts, the Well's crossings and bridges, and the stair-street (~10 call sites, several in loops; 3 near the Well carry the TRELLIS dragon casting). **Left from the plan:** motion polish, casting parity, the **enemy yank** (it has no enemies to yank: F2, the parity audit). E286 (Jake's feel check of the GRAPPLE / ZIP buttons) is `needs you` |
| Grapple playground | dev-mode only (Explore hub): a dev-grid course START → P1 → P2 → BASE → a 3-hook tower → FINISH, a range line of pads at 6 / 14 / 24 / 34 m, a timer with a best time (E307; Jake's feel notes owed) |
| Public lifts, cable cars, monorail, umbrella glide, laundry-line zips, safety nets, rubbish chutes | **not built** (P2-E8, P5). The gondola and the train exist as moving decor |
| Hoverboard (baseline HOVER) | available, clamped by the bounds |

## 4. Player-facing systems

- **Weapon:** the **Neon Jian** on the engine sword (ATTACK, HOLD = heavy, dodge) with a rigged first-person arm (twist
  bones, blade-path IK, crossfades, a verlet tassel and talisman, `vm/`). Lock-on exists but **there is nothing to fight**;
  LOCK was repurposed to target hooks. No iron sword (E314 A).
- **Bag:** MAP and GEAR only (the jian and the Fei Zhua tool card).
- **Map:** the minimap and full map draw the built pieces over a dark void (`def.ts` `map`); one floor, no stratum
  switching.
- **Saves:** nothing shard-specific to save.
- **Day/night and weather:** **none.** A fixed blue hour with a drizzle in the post chain (`look/render.ts`). The planned
  **T8 typhoon** (rain sheets, swinging signs, glitching sky screens, a howling Well, no umbrella) is unbuilt (P6-Q2).
- **Audio:** the shard has **no audio of its own**. `main.ts:587` picks the music mood `chunk.ocean ? 'island' : style ===
  'painterly' ? 'steppe' : 'pine'`, and Nine Dragon has no `style`, so it gets the **Pine Hollow mood** of the shared
  Wildshard score. Its own score (guzheng + erhu over a synth pad: `nd-market`, `nd-well`, `nd-fight`), ambience and
  SFX are specified in GAME-NORMALIZATION 05 §6.5 and unbuilt.
- **Explore:** EXPLORE WORLD (a free camera) on the card; the Model Explorer has 57 models and 6 Sets.

## 5. A living world? Not really

There are no timed events, no dynamic events and no world-state changes. Motion in the world is the train, the gondola
and the drones on fixed loops, the drizzle, the neon and lantern flicker, and the scrolling shanshui sky screens. The
crowd is a frozen tableau. You come back for one reason: to look at it.

## 6. The planned scope vs. what is built (the most ambitious design doc in the repo)

**The pitch** (plan §1–2):
- A single Kowloon-Walled-City megablock fills a **500 m cube** (±250 m), from a flooded Sump to an antenna Crown,
  climbing like Chongqing.
- **Nine street strata** ("nine dragons" = 九龍), with ~12 floors of housing between each pair (~120 floors in all).
- You spawn on stratum 6, Lantern Square, +125 m: "halfway up the sky", yet it must feel like a town square. The plan
  wants 7 of the 9 strata to pass a "**ground test**" (§3.2: from a standing eye, ≥ 70 % of the lower frame is floor;
  the drop is visible only near a Well).
- The tools for that: sky screens playing a Song-dynasty scroll (a class joke: the rich own the real sky), fog bands at
  every stratum line, and occluded edges.
- **The Yamen Well** (40 m × 500 m) is the spine. There are four Light Wells with lift towers, safety nets at every
  stratum line, cliff faces with stilt houses, four gates onto Old Street, a monorail through the rock and a tower, and a
  cableway to masts on the cliff tops.

| # | Stratum | Height | Feel (colour key) | Built? |
|---|---|---|---|---|
| 1 | The Sump | −250…−210 | flooded under-river, pump halls, sampans (jade) | no |
| 2 | Shelter Market | −170…−130 | WWII shelters turned hotpot halls + night market (hotpot red) | no |
| 3 | Rail Cut | −90…−50 | the monorail through rock and a tower (sodium amber) | no |
| 4 | Old Street | −10…+15 | Kowloon alleys, dentists, the yamen (fluorescent green) | no |
| 5 | Terrace Row | +55…+85 | teahouse terraces, 18 Steps (tea gold) | no (the stair-street reaches toward it) |
| 6 | **Lantern Square** ★ | +115…+135 | plaza, paifang, banyan, mahjong (lantern red) | **a fragment**: the square, the street, the stair stub, the Well rim |
| 7 | Cable Deck | +155…+180 | skybridges, ropeway stations, gondolas (cable cyan) | no (seen overhead) |
| 8 | Antenna Forest | +195…+225 | rooftop shanties, water tanks, pigeons (laundry white) | no |
| 9 | The Crown | +230…+250 | roof gardens, VTOL pad, drones (violet dusk) | no |

**Systems planned:**
- Combat: the Neon Jian + the Fei Zhua's **yank** (hook an enemy toward you or off a ledge).
- Traversal: grapple, umbrella glide (hold JUMP), lifts, cable cars, monorail, laundry-line zips, nets.
- Falls never kill: a net catches you one stratum down, or the umbrella auto-opens.
- Wayfinding without a HUD ladder: a per-stratum colour script and minimap, stratum names painted at lifts, the Well as
  a compass, lift chimes in the shard's motif.
- The colour script flips strata 1–3 to "gold ink on indigo sutra paper".
- Content: the quest, the enemies, the elites and the boss above.
- Music: one Cantopop-noir motif in nine arrangements, one per stratum.
- Weather: the T8 typhoon.

**The phases:**
- P0 (pre-production + fragment) is **done**.
- F (finish the fragment) is partly done:
  - F1 is done;
  - F2 has a playable zip;
  - F3 has a trailer cut, awaiting review;
  - F4–F7 have look passes in flight or paused;
  - F8–F10 are todo;
  - F9 needs Jake's iPhone.
- **P1 (Jake's go on the full shard) is `needs pick`.**
- P2 (11 engine rows: vertical extent, the stratum grammar, streaming, a multi-layer navmesh, …) is all todo.
- P3 (greybox) is todo, and so are P4 (the 9 strata), P5 (life, enemies, boss), P6 (quest, weather, audio) and P7
  (ship).
- The plan's risks call content scale out directly: "9 strata × ~100 000 m², and the fragment alone is ~20 k lines".

**Estimated share built:** if the plan's world is the 9 strata × ~100 k m², the fragment is part of one stratum (<5 % of
the space). Of the gameplay plan (quest, enemies, elites, boss, fauna, traversal verbs, weather, audio), **the grapple
zip is the only piece that exists**. Most of the effort went into the look: 24+ art rounds, 8 domes, 9 labs, a
frame-rate pass from 16 to 30 fps.

## 7. Estimated minutes of content

| Activity | Estimate |
|---|---|
| Walk the square, the street, the stair-street, the Well rim and the crossings; look down the Well | 5–10 min |
| Play with the Fei Zhua across the hooks | 5–10 min |
| Explore World (free camera) | optional, 5+ min |
| Dev-mode grapple playground (timer, best time) | 3–5 min (developer mode only) |
| **Total** | **≈ 10–20 min**, with no goal, fail state or reward |

**Replay value: ~none.** The only repeatable challenge is the playground's best time, and it is behind developer mode.
It is a beautiful diorama with one verb.

## 8. Stubbed, planned-not-built or broken (Nine Dragon)

- **The whole game layer:** quest, enemies, elites, boss, fauna, NPCs, achievements, loot, economy, weather, day/night,
  audio identity (§2, §4).
- **Traversal verbs:** lifts, cable cars, monorail, glide, zip lines, nets and chutes are unbuilt. The gondola and train
  are props.
- **Grapple:** motion and casting parity work left; enemy yank unbuilt (`docs/audits/nine-dragon-grapple-parity.md`).
- **Look gaps:**
  - the deep Well washes out below ~50 m;
  - mockup B's rim post blocks the lower-left;
  - mockup C is capped by lantern strings;
  - several lanes are over their draw caps (F4–F8, E281 round 3 is "next").
- **Possible exploit or stranding (E355, PLAUSIBLE):** seven bridge rungs register colliders past the Cable Deck's edge,
  where the walls are painted with no colliders. A grapple or drop onto a far rung may strand the player or drop them out
  of the level.
- **Memory:** the physical-iPhone reading is still open (E264 / F9). The last physical World Explorer peak was 1.054 GB,
  over the 1.0 GB cap; the Simulator now reads 0.37–0.39 GB.
- **Stale docs:** `def.ts` says the deck shows the shard only behind a Debug row; `registry.ts` (E318) says it is in the
  deck for everyone as EXPERIMENTAL. `def.ts` also says "the fragment has no map yet", but `map` is defined.
- **Status:** NINE-DRAGON-STACK is effectively **paused for E357 (GAME-NORMALIZATION)**. Its plan file says
  `in progress`; the session story says "blocked … then re-planned for the new engine".

---

# Part 3 — Side by side, and what it means

| Content axis | Nalati | Nine Dragon |
|---|---|---|
| Golden-path length | 1.5–2.5 h (est.) | none |
| Objectives with fail states | quest steps, kokpar, taming, 5 elites, 2 bosses | none |
| Hostile encounters | 5 types + 2 add types + lightning | 0 |
| Spoken content | 60 lines + 6 carving lines | 0 |
| Collectibles / feats | 17 places, 17 achievements, 5 skins, 2 upgrades | 0 |
| Systemic world | clock, storms, night enemies, raids, herds | static, fixed blue hour |
| Weakest point | never played clean end to end on record; balance unverified; no post-game; scenery-only south third | no game at all; beauty only |

**For a normalization or content plan:**
1. Nalati needs a **verified clean playthrough** (golden path, touch, no dev flags), a **balance pass** (the wolves, the
   elite banner), and **world-state payoffs**: storms calming after Jel Ata, the plaque on the pole, an epilogue or
   "shard complete" beat. Repeatable **reasons to return** would be content work, not tech: bounties or contracts,
   kokpar rounds with stakes, timed races.
2. Nine Dragon needs a **minimum loop** before more look work. The plan's own smallest slice would do: P1-2's strata 5 →
   6 → 7, Tong enforcers only (P1-3), the red envelope on stratum 6 plus one lift, and the yank. Jake's go on P1 is the
   gate.
