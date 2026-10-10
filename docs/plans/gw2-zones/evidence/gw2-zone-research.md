# What makes a Guild Wars 2 zone dense, replayable and "living": numbers for a 500 m shard

> **State:** evidence for [../GW2-ZONES.md](../../GW2-ZONES.md), web research done 2026-10-01. GW2 wiki and API figures are cited; anything marked synthesis or inference is not.

Research for Wildshard, 2026-10-01. The primary source is the GW2 wiki. Map sizes come from the official GW2 API (`api.guildwars2.com/v2/maps/<id>`). The API's continent units convert to metres with the wiki's rule, "one coordinate unit is equivalent to a distance of 24 inches". The [Sources](#sources) list is at the end.

**Read the sizes with care.**
- All sizes are the map's **bounding rectangle**. Maps are irregular, so the real playable area is smaller, and the real density is about 1.2–1.5× the per-area figures below.
- GW2 "inches" are the game's own unit. A 1200-range skill is 1200 in = 30.5 m.
- Out-of-combat run speed is **294 in/s ≈ 7.5 m/s**, and the raptor mount runs at 600 in/s ≈ 15 m/s. At GW2 run speed **one 500 m shard edge takes ~67 s on foot** (a 707 m diagonal takes ~95 s), or ~33 s on a raptor.

---

## 0. TL;DR for Wildshard

| | Area (bounding rect) | Shards it equals (0.25 km² each) |
|---|---|---|
| Queensdale / Kessex Hills / Caledon Forest (core, levels 1–25) | 2.8–3.2 km² (≈ 2.2 × 1.5 km) | **≈ 12–13 shards** |
| Typical HoT / PoF / EoD / SotO / Janthir map | 1.8–7.2 km² | 7–29 shards |
| **Silverwastes** (LW S2) | 1.17 km² | **≈ 4.7 shards** |
| **Lake Doric** (LW S3) | 1.22 km² | ≈ 4.9 shards |
| **Bitterfrost Frontier** (LW S3) | 1.75 km² | ≈ 7 shards |
| **Dry Top** (LW S2) | 1.95 km² | ≈ 7.8 shards |
| **Bloodstone Fen** (LW S3, the smallest open map) | **0.37 km²** (936 × 390 m) | **≈ 1.5 shards** |

- **The closest GW2 analogue to one Wildshard shard is Bloodstone Fen.** It fits about 20 events, 4 waypoints, 7 POIs, 3 vistas, 2 mastery insights, a map currency (Blood Rubies from ore nodes plus events), a 60–90 min meta and a day/night event split into ~0.37 km². It does this by stacking **three vertical layers**: sky, ground and underground.
- **The small, dense, timed-meta maps are the ones people farmed for years**: Silverwastes and Dry Top. Silverwastes holds ~39 events in 1.17 km², which is **~8 events per shard-sized area**.
- **Per shard-sized area, GW2 maps hold roughly:**
  - 4–8 dynamic events (13+ in Bloodstone Fen);
  - 1–4 POIs and 0.5–2 vistas;
  - 0.5–1.5 hero challenges / mastery insights;
  - ~1 heart in core maps and ~0.2–0.6 in later maps;
  - a slice of a **map-wide meta on a fixed clock**: 1 h for Dry Top, 2 h for almost everything since HoT.
- **What turns ~30 min of first-pass content into hours** is not more static content. It is five systems:
  1. a **clock**: a meta cycle plus day/night;
  2. **success/fail branches** that change the map;
  3. a **map currency** with a long sink;
  4. **daily/weekly resets**: hearts, nodes, chests, Wizard's Vault, map bonus rotation;
  5. **group scaling**, so the same event is a different fight with 1 or 40 players.
- **Density rule of thumb.** CD Projekt Red's "rule of 40 seconds" was measured in practice at **20–39 s mean / 16–34 s median** between noticeable things. At 7.5 m/s that is something every **~150–300 m**, so **at least 2–4 "beats" per straight crossing of a shard**. Counting ambient wildlife, NPCs and landmarks, that is roughly 15–30 noticeables per shard.

---

## 1. Anatomy of a core GW2 zone

### 1.1 Counts (GW2 wiki)

| Zone (level) | Size | Hearts | Waypoints | POIs | Vistas | Hero challenges | Jumping puzzles | Events | Metas / world boss |
|---|---|---|---|---|---|---|---|---|---|
| **Queensdale** (1–15) | 2185 × 1483 m, 3.24 km² | 17 | 16 | 21 | 9 | 7 | 1 (Demongrub Pits) | **60+** | *Battle for Beetletun*; *Secrets in the Swamp*, which ends in the **Shadow Behemoth** world boss |
| **Kessex Hills** (15–25) | 2497 × 1248 m, 3.12 km² | 14 | 16 | 20 | 9 | 5 | 1 (Collapsed Observatory) | ~60 (est.) | *Battle for NE Kessex*; *Battle of Fort Salma* |
| **Caledon Forest** (1–15) | 1170 × 2419 m, 2.83 km² | 19 | 18 | 20 | 8 | 7 | **4** (Spelunker's Delve, Morgan's Leap, Dark Reverie, Spekks's Laboratory) | many | *Champion of the Sun*; *Battle for Wychmire Swamp*; also holds the Twilight Arbor dungeon entrance |

**All of Central Tyria** (25 explorable zones plus 6 cities, needed for world completion):

| Hearts | Hero challenges | Waypoints | Vistas | POIs |
|---|---|---|---|---|
| 303 | 189 | 486 | 226 | 653 |

- That averages, per explorable zone, to about **12 hearts, 8 hero challenges, 9 vistas, ~19 waypoints and ~26 POIs**; the city waypoints and POIs inflate the last two.
- ArenaNet announced **~1,500 dynamic events** for launch, about **60 per zone**.

**Per shard-sized area (0.25 km²), Queensdale gives:**

| Hearts | Waypoints | POIs | Vistas | Hero challenges | Events |
|---|---|---|---|---|---|
| ~1.3 | ~1.2 | ~1.6 | ~0.7 | ~0.5 | **~4.6+** |

### 1.2 How the pieces fit (Queensdale as the example)

- **Hearts** are static "help this NPC" tasks. One bar fills from several interchangeable activities (kill centaurs, water crops, feed cows, revive militia).
  - Finishing one gives XP, coin and karma, and opens a **karma vendor**.
  - In core maps they are **one-time**. From Living World Season 3 on they **reset daily**. Janthir Wilds added **tiered hearts** fed by Renown Tokens from nearby events.
- **Dynamic events** happen around and between the hearts. *The Battle for Beetletun* is a branching chain:
  - Prevent the Tamini retaking Holdland Camp.
  - **On failure**: defend, then retake, Tunwatch Redoubt.
  - Stop the centaurs capturing farmers, then rescue them, then retake the farm and bring sprinkler parts back.
  - **On success**: destroy the weapon caches.
- **World boss: Shadow Behemoth.** Its meta, *Secrets in the Swamp*, runs:
  1. Destroy Underworld portals at the monastery, the Heartwoods and the Taminn Foothills (3 parallel events).
  2. Destroy the portals in the swamp (a group event).
  3. **Defeat the Shadow Behemoth** (a group event). It spawns more portals at 75 / 50 / 25 % HP (5 / 9 / 13 portals) and is untargetable while they are open.
  - It spawns **every 2 hours at :45 past odd hours UTC** (01:45, 03:45, …).
  - The reward is a Demonic Chest, plus achievements and legendary-collection parts.
- **Other systems in the zone:**
  - **Vistas**: a small climb or puzzle with a camera fly-over as the reward.
  - **POIs**: landmarks named on discovery.
  - **Hero challenges**: commune points or champion fights that give skill points.
  - **Jumping puzzles**: hidden platforming with a chest at the end; there are 60+ in the game.
  - **Mini-dungeons**: 30+ in total, such as Morgan's Spiral and Windy Cave.
  - **Gathering nodes** (ore, wood, plants): per character, so nobody competes for them, and they reset a few hours after use.
  - **Pets to tame.**
  - A **map-completion reward**.
- **NPC density.** The wiki has no NPC counts. Qualitatively, each heart is a little settlement or farm with 3–10 named NPCs, and the zone has ~19 named sub-areas and several towns (Shaemoor, Beetletun, Claypool). Ambient critters fill the gaps.

### 1.3 Time to map-complete

- **World completion** (all 31 core maps) takes about **12–15 h** of focused play for one character. The speed-run record is about **6 h 48 m**. Both figures come from a non-ArenaNet source, so treat them as rough.
  - That works out to roughly **25–35 min per zone** just to tick the checklist.
  - First-time players who also do the hearts and events take **1.5–3 h per core zone**. A PC Gamer reviewer reached level 15 by completing Divinity's Reach plus Queensdale.
- The checklist is the minor part. **The hours come from repetition**: events on respawn timers, world bosses, the map bonus track, dailies and alts.
- **Downscaling keeps old zones alive.** A level-80 player in Queensdale is scaled to effective level 16 but **still earns rewards at their own level**. Low-level maps stay worth playing for veterans, and the world boss train runs through them.

---

## 2. Expansion and Living World maps: metas, timers, currencies

### 2.1 The meta clock

Since Dry Top (2014), every ArenaNet open map has a **permanent background meta cycle**. These figures come from the wiki's event-timer data:

| Map | Area | Cycle | Phases (minutes) |
|---|---|---|---|
| **Core Tyria day/night** | — | 120 | Day 70, Dusk 5, Night 40, Dawn 5 |
| **Core world bosses** | — | 15-min slots | One boss every 15 min on a fixed rota. Each boss repeats every 2 h (Shadow Behemoth) or 3 h (Tequatl, Shatterer …) |
| **Dry Top** | 1.95 km² | **60** | Crash Site 40, Sandstorm 20 |
| **Verdant Brink** (HoT) | 1.83 km² | 120 | Day "Securing VB" 75, Night "Night and the Enemy" 25, Night bosses 20 |
| **Auric Basin** | 2.14 km² | 120 | Pylons 75, Challenges 15, **Octovine** 20, Reset 10 |
| **Tangled Depths** | 2.85 km² | 120 | Outposts 95, Prep 5, **Chak Gerent** 20 |
| **Dragon's Stand** | 3.07 km² | 120 | One continuous 120-min push. If it isn't finished, **Mordremoth wipes the map and resets all progress** |
| **Lake Doric** (LS3) | 1.22 km² | 120 | Noran's Homestead 30 → Saidra's Haven 45 → New Loamhurst 45 (a rolling three-village cycle) |
| **Crystal Oasis** (PoF) | 4.87 km² | 120 | Open play 95, **Casino Blitz** rounds 1–3 16, piñata boss 9 |
| **Desert Highlands** | — | 120 | Buried Treasure 20 |
| **Domain of Vabbi** | 5.78 km² | 120 | Serpents' Ire 30, Forged with Fire 30 (twice) |
| **Jahai Bluffs** (LS4) | 4.87 km² | 120 | Escorts 15, then Death-Branded Shatterer 15 |
| **Dragonfall** (LS4) | 3.62 km² | 120 | Three camp lanes, then "Engage Kralkatorrik" |
| **Grothmar Valley** (IBS) | 3.04 km² | 120 | Four mini-metas: Effigy 15, Doomlore Shrine 22, Ooze Pits 20, **Metal Concert** 15 |
| **Bjora Marches** | 3.62 km² | 120 | Drakkar and Spirits 35, Jora's Keep 15, Icebrood Champions 15 |
| **Seitung Province** (EoD) | 3.84 km² | 120 | **Aetherblade Assault** 30, then 90 open |
| **New Kaineng City** | 3.65 km² | 120 | Kaineng Blackout 40 |
| **Echovald Wilds** | 3.65 km² | 120 | Gang War 35, Aspenwood 20 |
| **Dragon's End** | 3.00 km² | 120 | Jade Maw ×2 (8 each), then **Battle for the Jade Sea** 60 |
| **Skywatch Archipelago** (SotO) | 3.00 km² | 120 | Unlocking the Wizard's Tower 25 |
| **Amnytas** | 3.22 km² | 120 | Defense of Amnytas 25 |
| **Janthir Syntri** (JW) | 3.65 km² | 120 | **Of Mists and Monsters** (titan) 25 |
| **Bava Nisos** | 2.44 km² | 120 | A Titanic Voyage 25 |
| **Shipwreck Strand** (VoE) | 3.04 km² | 120 | Hammerhart Rumble 20 |
| **Starlit Weald** (VoE) | — | 120 | Secrets of the Weald 35 |
| **Cantha / Castora day/night** | — | 120 | Day 55, Dusk 5, Night 55, Dawn 5 |

**Silverwastes** (1.17 km²) has **no fixed clock**. Its meta advances as players hold forts, then follows a set chain:

1. **Foothold**: defend four forts.
2. **The Breach**: a boss phase.
3. **Mordrem Vinewrath**: three lanes, each escorting siege carriers. The event fails after **15 carriers are lost**.
4. **Time Out**: nightmare pods and champions in the Tangled Labyrinth.

The finish drops the Vinewrath chest **plus 2–4 Lost Bandit Chests**, which players open with Bandit Skeleton Keys.

**The pattern** went from a 1 h cycle in 2014 (Dry Top) to a **2 h cycle with a 20–60 min climax** (HoT onwards).
- Recent maps shrank the timed block to a **20–35 min meta inside the 2 h cycle**. The other ~90 min are free events, rifts, hearts and gathering.
- Players plan around the clock, using the in-game timers and the wiki's timer widget. **The "map train"** means hopping from meta to meta: Tangled Depths, then Auric Basin, then Dragon's Stand, then Verdant Brink …

### 2.2 Map completion and side content in later maps

Hearts mostly disappear after core Tyria and come back in a small number. They are replaced by more POIs, mastery insights, adventures and bounties.

| Map | Hearts | Waypoints | POIs | Vistas | Hero challenges | Mastery insights | Map currency |
|---|---|---|---|---|---|---|---|
| Verdant Brink | 0 | 7 | 26 | 6 | 11 (×10 pts) | 9 | Airship Parts |
| Auric Basin | 0 | 7 | 22 | 6 | 11 | 8 | Lumps of Aurillium |
| Tangled Depths | 0 | 7 | 20 | 6 | 11 | 5 | Ley-Line Crystals |
| Dragon's Stand | 0 | 11 | 24 | 7 | 7 | — | (Leystone armour, Crystalline Ore) |
| Dry Top | 0 | 5 | 22 | 6 | 5 | — | Geodes (6 "Favor of the Zephyrites" vendor tiers) |
| Silverwastes | 0 | 3 | 18 | 7 | 6 | — | Bandit Crests (Silverwastes Shovel at 225) |
| Bloodstone Fen | 0 | 4 | 7 | 3 | — | 2 | Blood Ruby + Unbound Magic |
| Bitterfrost Frontier | 4 (daily) | 2 | 13 | 5 | — | 3 | Fresh Winterberry + Unbound Magic |
| Lake Doric | 6 (daily) | 3 | 16 | 9 | — | 3+1 | Jade Shard + Unbound Magic |
| Crystal Oasis | 4 | 3 | 30 | 10 | 5 | (PoF: 40 total) | Elonian Trade Contracts |
| Seitung Province | 3 | 4 | **41** | 5 | 9 | 14 | Map writs (Writs of Seitung) |
| Skywatch Archipelago | — | 7 | **50** | 8 | — | 11 | Static Charge |
| Janthir Syntri | 3 (tiered) | 4 | **50** | 8 | — | (JW: 27 total) | — |
| Gyala Delve | — | 4 | 24 | 3 | — | — | — |

**Other systems that came with the expansions:**
- **Mastery insights** are one-time-per-account "places of power" that give a mastery point. Many are traversal puzzles gated on a mastery: updraft, mushrooms, a mount or a glider.
  - Heart of Thorns has 22 (Verdant Brink 9, Auric Basin 8, Tangled Depths 5).
  - Path of Fire has 40, End of Dragons 45, Secrets of the Obscure 29, Janthir Wilds 27 and Visions of Eternity 27.
  - Ten were added to core maps.
- **Expansion hero challenges** are worth 10 points each: HoT 400, PoF 290, EoD 310, VoE 300.
- **Adventures** (HoT onward, 100+ in total) are solo, timed mini-games:
  - races, gliding courses, collecting, target shooting and mount trials;
  - **Bronze / Silver / Gold** tiers, with **friend and guild leaderboards**;
  - a first Silver or Gold gives a mastery point.
- **Bounties** (PoF) are summoned champion and legendary bosses with mechanics. Crystal Oasis has 3 legendaries.
- **Rift hunting** (SotO onward) is a repeatable, player-started open-world boss. Each map has 3 tiers: tier 1 is a solo elite, tiers 2–3 are group champions. Three rotating zones are live each week.
- **Vertical layering** packs content into a small footprint:
  - Tangled Depths: canopy, ground, caverns and underwater.
  - Bloodstone Fen: sky, ground and underground.
  - Dry Top: three "Aspect" crystals give a temporary leap, dash or combined move, which gates routes.

### 2.3 Why players repeat these maps

1. **The meta is a scheduled appointment** with a big chest at the end, which is often a guaranteed exotic or ascended item or a rare skin chance. Tiered results scale the payout: Verdant Brink's night tiers 1–4, Dry Top's six Favor tiers, Auric Basin's chest per pillar.
2. **A map currency with a long sink.** Each map's armour, weapons, recipes and mastery items cost hundreds or thousands of its own currency. Living World Season 3 stacked two currencies:
   - **Unbound Magic** is shared across the season and comes from events, orbs (Bitterfrost has 20 in trees and 33 underwater) and map completion (100).
   - **A per-map currency**: Blood Ruby, Winterberry, Jade Shard, Fire Orchid, Orrian Pearl.
   - Ascended trinkets cost **2,000–5,000 Unbound Magic plus 100–200 of the map currency**. That is weeks of **daily** visits, because the nodes and hearts reset each day. Bitterfrost has 21 Winterberry bushes.
3. **Daily resets**:
   - hearts in LS3 and later;
   - map nodes;
   - one world-boss chest per boss per day, plus one account-wide bonus chest;
   - one jumping-puzzle chest per account per day;
   - Wizard's Vault dailies;
   - map bonus diminishing returns at 00:00 UTC.
4. **Weekly rotation.** **Map bonus rewards** turn invisible event points into periodic loot: in core, one reward per 200 points up to 8,000, and every 20th reward is ×10. The reward item **rotates weekly on an 8-week cycle** (Thursday 20:00 UTC), so this week's lucrative map changes. Rift hunting also rotates its zones weekly.
5. **Group spectacle and social proof.** Commanders run squads through the LFG tool, and the megaserver fills the map. A 40-player Octovine or Chak Gerent is a different experience from the same map at off-hours.
6. **Failure has teeth.** Dragon's Stand wipes the map at 2 h, the Octovine heads must die within 2 min of each other, and Vinewrath fails after 15 carriers. A real chance to fail makes success feel earned and worth repeating.
7. **Account progression**: masteries, collections, legendaries and achievements. Precursor and legendary collections send players to specific maps for specific drops.

---

## 3. Taxonomy of GW2 content types

| Type | What it is | Repeat cadence | Players | Notes for Wildshard |
|---|---|---|---|---|
| **Dynamic event** | Escort, defend, capture, kill, collect or "help NPC" in a radius around a spot. Scales with participants (most up to ~10; Shatterer up to 100) by raising enemy level, rank and count, adding abilities and raising the objective counts | Respawn timer or chain loop | 1–10 | The core unit. Gold / silver / bronze participation medals. **Failure doesn't end it, it changes the map**: a fort is lost, then a "retake" event spawns. Failure pays half XP and coin and no karma |
| **Event chain** | Events linked linearly or branching on success or fail (Beetletun) | Loops | 1–10 | Cheap way to make one spot "live" |
| **Group event** | Tagged [Group Event]; tuned for 5+ | Timer or chain | 5+ | |
| **Meta event** | A map-scale chain of chains with a progress bar in the event UI; lanes, phases, a climax | Fixed clock (1–2 h) or progress-driven | 10–100 | The map's heartbeat and its main repeat driver |
| **World boss** | A scripted epic boss, with a big chest once per day per boss | Every 2–3 h on a global rota (15-min slots) | 20–100 | "Boss train" culture. Tiers: low (Shadow Behemoth), standard (Shatterer), hardcore (Tequatl) |
| **NPC rank** | Ambient (one-hit, no loot), normal, **veteran** (bronze border, soloable), **elite** (silver, for groups), **champion** (gold border, defiance bar, champion loot bag), **legendary** (purple), epic/world boss | — | — | A readable difficulty grammar on the target frame |
| **Bounty / rift** | A player-summoned boss | On demand, with daily or weekly reward caps | 1–20 | On-demand bosses suit low population |
| **Renown heart** | One NPC, one fillable bar of interchangeable chores, then a karma vendor | One-time (core), daily (LS3+), tiered (Janthir) | 1 | The baseline content that is "always there" |
| **Vista** | Reach a high or hidden spot for a camera pan | One-time | 1 | A traversal micro-puzzle with a scenic payoff |
| **POI** | A named landmark, discovered on entry | One-time | 1 | Free density: naming places |
| **Waypoint** | Fast-travel node (costs coin); contested waypoints can be lost to events | — | — | Events can take a waypoint, which raises the stakes |
| **Hero challenge** | A commune point or champion fight for skill points | One-time | 1–5 | |
| **Mastery insight** | A hidden or traversal-gated spot worth a mastery point | One-time | 1 | Rewards using the new movement ability |
| **Jumping puzzle** | Hidden platforming with a chest, veteran guards, false endings, secret chests | Daily chest | 1 | Originally an easter-egg culture; 60+ in game |
| **Mini-dungeon** | A small combat or puzzle cave with an achievement; 30+ in game | Daily chest | 1–5 | |
| **Adventure** | A solo timed mini-game with Bronze / Silver / Gold and a leaderboard | Any time | 1 | Best fit for a solo or async PWA |
| **Story instance / personal story** | Instanced narrative missions (personal story levels 1–80, then Living World episodes that each unlock a map) | One-time, replayable | 1–5 | The story thread across maps |
| **Collection / achievement** | Find or collect N items or skins (from the Sept 2014 feature pack); map and legendary collections | Long-tail | 1 | Sends players back to specific maps |
| **Gathering node** | Ore, wood, plants; per character, resets in hours (some in ~23 h); rich veins give 10 strikes | Hours or daily | 1 | No competition; feeds crafting and currency |
| **Map chest / bonus chest** | Chests after metas (Icebound Chests in Bitterfrost), key-locked chests (Bandit chests), map bonus track | Per meta, daily, weekly | — | |
| **Wizard's Vault** | 4 random dailies (+10 Astral Acclaim each, +20 chest) plus a login objective (+5); 8 weeklies (+50 each; 6 of them give a +450 chest); seasonal specials. Acclaim cap 1,300; quarterly seasons | Daily, weekly, seasonal | 1 | A "go do X in map Y" router across the whole world |
| **Map bonus reward** | Invisible event points become periodic loot; the item rotates weekly on an 8-week cycle | Weekly | — | Spreads players across old maps |
| **Festival** | Six yearly, ~3 weeks each: Lunar New Year, Super Adventure Festival, Dragon Bash, Festival of the Four Winds, Halloween, Wintersday. Mini-games on an hourly sub-clock (Dragon Bash pinatas every 15 min; Four Winds races, treasure hunt and fishing in a 2 h rota) | Yearly | 1–100 | Re-skins old spaces and rotates mini-games |
| **Day/night** | A 2 h cycle (core: 70 min day, 40 min night) that gates some events and nodes; Bitterfrost ties its day/night to its meta | 2 h | — | Cheap "living world" signal |

---

## 4. How GW2 strings zones together

- **Level bands.**
  - Each race has a 1–15 starter zone next to its capital (Queensdale by Divinity's Reach, Caledon Forest by the Grove, Plains of Ashford by the Black Citadel …).
  - Zones then step up in ~10-level bands: 15–25 (Kessex Hills, Brisban Wildlands), 40–50 (Dredgehaunt), 60–70 (Mount Maelstrom), 70–80 (Frostgorge), then Orr at 80.
  - Since the expansions every new map is level 80. **Downscaling keeps the low bands relevant.**
- **City hubs and portals.** **Asura gates** link every racial capital to **Lion's Arch** for free, hub and spoke. **Waypoints** are paid teleports (fast, but a coin sink). Expansion maps link to each other by portal, and later expansions add a hub (the Wizard's Tower, Arborstone, the Janthir Homestead).
- **The story thread** runs as follows:
  - personal story levels 1–80 in instances spread across zones;
  - then each Living World episode **unlocks one new map** and a story instance;
  - finishing the story opens the map's vendors, currency and masteries.
- **Map currencies** tie a map to its own reward track. Season-wide currencies (Unbound Magic, Volatile Magic) **tie a whole season of maps together**, so players rotate through all of them.
- **The world-boss train.** One boss spawns every 15 min on a fixed global rota, each boss every 2–3 h. Players chain them with waypoints for daily chests, and commanders tag up and advertise in LFG.
- **The megaserver** launched on 21 Apr 2014.
  - Every player in a region shares map instances. A new instance spawns when one fills, and players are placed by party, guild, language and home world.
  - This **fixed empty low-level maps**.
  - Players can "taxi" by joining a party member's instance, and a map queue arrived in Apr 2023.
- **The LFG tool** (Sept 2013, with Tequatl Rising) lists open world, metas, world bosses, dungeons, fractals and raids. **Commander tags** run squads.
- **Why players return daily and weekly:**
  - **Daily**: Wizard's Vault dailies, world-boss chests, daily hearts and nodes in LS3+ maps, jumping-puzzle chests, map-currency caps.
  - **Weekly**: Wizard's Vault weeklies, the map bonus rotation, rift zone rotation, raid and strike resets.
  - **Seasonal**: festivals, Wizard's Vault seasons, new Living World episodes every 2–4 months.

---

## 5. Mobile and small-map comparisons

### 5.1 Genshin Impact (mobile, the closest market comparison)

- **Size.** Region sizes are fan-measured, and estimates disagree:
  - one set: Mondstadt ~3.9 km², Liyue ~5.7 km², Inazuma ~2.5 km², Sumeru ~12.4 km²;
  - another: about 9.8 km² for all of Teyvat at v3.4.
  - **Treat these as order-of-magnitude.** A region is roughly 10–50 Wildshard shards.
- **Chests per region** (from the chest achievements): Mondstadt 523, Liyue 1,149, Dragonspine 234, Inazuma 731, Enkanomiya 185, The Chasm 248, Sumeru 1,472, Fontaine 794, Chenyu Vale 333.
  - That is **≈ 130–300 chests per km²**, so **≈ 30–75 chests in a shard-sized footprint**, plus oculi (stamina upgrades), puzzles, seelies and world quests.
  - Genshin's density is dominated by **small, frequent micro-rewards**.
- **The daily loop:**
  - **4 Daily Commissions** (~60 Primogems a day);
  - **Original Resin**, capped at **200** (raised from 160) and regenerating **1 per 8 min (~180/day)**, spent on domains and bosses;
  - a 15–30 min "check-in" session shape.

### 5.2 Breath of the Wild / Tears of the Kingdom

- **BotW Hyrule** is ~**61–84 km²** (Guinness gives 62.1 km²; fan estimates go up to 84), about 9 × 6.8 km. Corner to corner on foot along roads takes **56.5 min**.
  - It has **120 shrines and 900 Korok seeds**: **≈ 1.4–2 shrines and ≈ 11–15 Koroks per km²**.
  - Per shard-sized area that is **≈ 0.4 shrines and ≈ 3 Koroks**, plus enemy camps, towers, stables and cooking ingredients.
- **TotK** has **1,000 Koroks, 152 shrines (120 surface, 32 sky), 147 caves, 120 Lightroots (one under each surface shrine) and 58 wells**, across **three layers** (sky, surface, Depths). It packs more content into the same footprint by layering, the same trick as Tangled Depths and Bloodstone Fen.
- **Nintendo's design method** (CEDEC 2017):
  - **The "triangle rule"**: hills and mountains hide what is behind them and offer a choice of going over or around. They use three sizes: big landmarks, medium route shields, small pacing bumps.
  - **"Gravity"**: points of interest pull the player along. By the time the player tops a rise, the next 2–3 points are visible.
  - **Playtest heat maps**: once attractors were placed, player paths stopped following the same route and spread across the map.
  - Nintendo published no fixed spacing number. A commonly cited figure, unverified, is ~40 s between attractions.

### 5.3 Density rules of thumb

- **Witcher 3 "rule of 40 seconds"** (CD Projekt Red, Noclip documentary, 2017): "every forty seconds, player should see something, and focus on it, like a pack of deers, some opponents, some NPCs wandering about".
- **Measured** (Uppsala thesis, 2021, 40 h of footage from 4 YouTubers across Velen and Skellige):
  - mean time between noticeable things was **20–39 s**, with medians **16–34 s**;
  - the slowest was an exploration-heavy player with map markers off;
  - **big gaps came from boats, swimming and climbing**;
  - the noticeable things were mostly enemies (~25 %), landmarks (~21–32 %) and wildlife (~18 %).
- **Working rule for Wildshard:**
  - a **notice** (wildlife, NPC, landmark, enemy pack) every **20–40 s**;
  - an **interaction** (event, chest, puzzle, node cluster) every **60–120 s**;
  - a **set piece** (meta phase, boss, vista) every **5–15 min**.
  - At GW2-like 7.5 m/s a shard crossing is ~70–95 s, so each crossing should pass **2–4 notices and at least 1 interaction**.

### 5.4 Old School RuneScape (the daily-loop model)

Short timed "runs" bring players back many times a day:
- **Birdhouse runs** take ~70 s to do on a ~50 min cycle.
- **Herb runs** take 5–10 min on an ~80 min growth cycle.
- **Tree runs** run on ~3 h or longer.

This is the same shape as GW2's node resets and Genshin's resin: **short timers that reset**, played in a loop across several locations.

---

## 6. Production cost reality

- **Living World cadence.**
  - Season 1 (2013): **four teams**, each given **~4 months to make two updates**, delivering a release **every 2 weeks**.
  - Seasons 3–5: **one new map per episode**, at **2–3 months per episode**, made by **3–4 Living World teams rotating**.
  - **Inference (not stated by ArenaNet): each map plus its episode took one team about 6–12 months** with the teams overlapping.
  - ArenaNet's 2012 live team was "more than ten times the size of the Guild Wars live team". The company had ~322–350 staff in 2023, and press around then put ~120 developers on the live game.
  - **No public per-map headcount was found.**
- **Content per small map**, counted from the wiki event lists:
  - **Dry Top**: 20 events in the Crash Site phase plus 16 in Sandstorm = **36 events** in 1.95 km² on a 1 h cycle, released across 3 episodes.
  - **Silverwastes**: **~39 events** in 1.17 km².
  - **Bloodstone Fen**: **20+ events** in 0.37 km².
  - **Bitterfrost Frontier**: **~11 events listed** (the wiki list is likely incomplete) plus 4 daily hearts, 21 Winterberry bushes and 53 Unbound Magic orbs in 1.75 km².
  - **Queensdale**: **60+ events** in 3.24 km².
- **Scaling to Wildshard.** A Bloodstone-Fen-dense shard (~13 events per 0.25 km², 3 layers) took a full AAA team a slice of a 2–3-month episode. **A Silverwastes / Dry Top density (~5–8 events per 0.25 km²) is a realistic target** if events are built from **reusable templates** (escort, defend, collect, kill-champion, capture) bound to shard-specific spots and NPCs. That template approach is how GW2 reaches 1,500+ events.

---

## 7. What this suggests for a 500 m shard (synthesis, not sourced)

| Layer | GW2 analogue | Per-shard budget (Silverwastes to Bloodstone Fen density) |
|---|---|---|
| Always-there tasks | Hearts (daily reset) | 1–2 "help this NPC" bars with interchangeable chores |
| Dynamic events | Events and chains with success/fail branches | **5–10**, including one 3–5 step chain whose failure path changes the shard (a lost camp, a contested shrine) |
| Heartbeat | Meta on a clock | One shard meta: a ~15–20 min build-up, then a 5–10 min climax boss, on a **30–60 min cycle** (Dry Top is 40/20). The map server could run it against a global clock so every player sees the same phase |
| Day/night | 2 h day/night | Tie 2–3 events or nodes to night |
| Discovery | POIs and vistas | 3–5 named POIs, 1–2 vistas (climb plus camera pan) |
| Skill / traversal | Jumping puzzle, mastery insight, adventure | 1 JP or insight plus **1 adventure** with Bronze / Silver / Gold and a leaderboard (solo, async, phone-friendly) |
| Long tail | Map currency, collection | One shard currency (nodes plus events) feeding a sink of cosmetics and upgrades, plus a 5–10 item shard collection |
| Resets | Nodes, chests, dailies | ~15–25 per-player nodes resetting in hours, a daily meta chest, a daily JP chest |
| Cross-shard glue | Wizard's Vault, map bonus rotation, world boss train | Server-side dailies and weeklies that send players to *other* shards; a weekly "featured shard" bonus; the highway as a boss-train route |
| Verticality | Tangled Depths, Bloodstone Fen, TotK | 2–3 layers (cave, ground, cliff or canopy) to multiply content per m² |

**From 5 minutes to hours.**
- With ~30 min of first-pass content (5–10 events, a heart, POIs, a puzzle, an adventure), a 30–60 min meta clock and a currency with a sink worth ~10–20 visits, one shard plays like a small Living World map. People did spend hundreds of hours in Silverwastes, which is 5 shards in area.
- The pieces that cost little to author but multiply play time are:
  - the clock;
  - fail branches;
  - resets;
  - the currency sink;
  - a leaderboard on the adventure.

---

## Sources

**GW2 wiki** (wiki.guildwars2.com):
- https://wiki.guildwars2.com/wiki/Queensdale
- https://wiki.guildwars2.com/wiki/Kessex_Hills
- https://wiki.guildwars2.com/wiki/Caledon_Forest
- https://wiki.guildwars2.com/wiki/Map_completion
- https://wiki.guildwars2.com/wiki/Shadow_Behemoth
- https://wiki.guildwars2.com/wiki/World_boss
- https://wiki.guildwars2.com/wiki/Event
- https://wiki.guildwars2.com/wiki/Event_timers, with data from https://wiki.guildwars2.com/index.php?title=Widget:Event_timer/data.json&action=raw
- https://wiki.guildwars2.com/wiki/Dry_Top
- https://wiki.guildwars2.com/wiki/The_Silverwastes
- https://wiki.guildwars2.com/wiki/Mordrem_Vinewrath
- https://wiki.guildwars2.com/wiki/Bitterfrost_Frontier
- https://wiki.guildwars2.com/wiki/Bloodstone_Fen
- https://wiki.guildwars2.com/wiki/Lake_Doric
- https://wiki.guildwars2.com/wiki/Unbound_Magic
- https://wiki.guildwars2.com/wiki/Verdant_Brink
- https://wiki.guildwars2.com/wiki/Auric_Basin
- https://wiki.guildwars2.com/wiki/Tangled_Depths
- https://wiki.guildwars2.com/wiki/Dragon%27s_Stand
- https://wiki.guildwars2.com/wiki/Crystal_Oasis
- https://wiki.guildwars2.com/wiki/Dragonfall
- https://wiki.guildwars2.com/wiki/Seitung_Province
- https://wiki.guildwars2.com/wiki/Gyala_Delve
- https://wiki.guildwars2.com/wiki/Skywatch_Archipelago
- https://wiki.guildwars2.com/wiki/Janthir_Syntri
- https://wiki.guildwars2.com/wiki/Rift_hunting
- https://wiki.guildwars2.com/wiki/Adventure
- https://wiki.guildwars2.com/wiki/Mastery_insight
- https://wiki.guildwars2.com/wiki/Hero_point
- https://wiki.guildwars2.com/wiki/Map_bonus_reward
- https://wiki.guildwars2.com/wiki/Wizard%27s_Vault
- https://wiki.guildwars2.com/wiki/NPC_rank
- https://wiki.guildwars2.com/wiki/Megaserver
- https://wiki.guildwars2.com/wiki/Looking_for_Group
- https://wiki.guildwars2.com/wiki/Mini_dungeon
- https://wiki.guildwars2.com/wiki/Jumping_puzzle
- https://wiki.guildwars2.com/wiki/Renown_heart
- https://wiki.guildwars2.com/wiki/Resource_node
- https://wiki.guildwars2.com/wiki/Collection
- https://wiki.guildwars2.com/wiki/Festival
- https://wiki.guildwars2.com/wiki/Level_scaling
- https://wiki.guildwars2.com/wiki/Asura_gate
- https://wiki.guildwars2.com/wiki/Movement_speed
- https://wiki.guildwars2.com/wiki/API:Maps (the 24-inch coordinate unit)
- https://wiki.guildwars2.com/wiki/Living_World

**GW2 API** (map rectangles): https://api.guildwars2.com/v2/maps/15 (Queensdale; likewise ids 23, 34, 988, 1015, 1165, 1178, 1185, 1052, 1043, 1045, 1041, 1210, 1317, 1442, 1490, 1510, 1517, 1554, 1574, 1595 …)

**ArenaNet and press:**
- https://www.guildwars2.com/en/news/colin-johanson-outlines-guild-wars-2-live-game-development/
- https://www.engadget.com/2013-07-02-everything-in-the-world-is-fair-game-chris-whiteside-on-guild.html (four teams, four months, two-week cadence)
- https://www.pcgamesn.com/guild-wars-2/arenanet-ama (one map per episode, 2–3 month cadence)
- https://massivelyop.com/2018/06/26/arenanet-on-guild-wars-2s-living-story-heart-of-thorns-vs-path-of-fire-security-and-momentum/
- https://www.shacknews.com/article/63774/guild-wars-2-dynamic-events (~1,500 events at launch)
- https://pcgamer.com/guild-wars-2-review-as-it-happens/2
- https://www.gameslearningsociety.org/wiki/how-long-does-it-take-to-map-complete-gw2/ (12–15 h world completion; low confidence)

**Other games:**
- https://gigazine.net/gsc_news/en/20171004-breath-of-the-wild-design-secret (triangle rule, heat maps)
- https://80.lv/articles/the-design-secrets-of-breath-of-the-wild/
- https://www.guinnessworldrecords.com/world-records/512703-largest-nintendo-made-world (62.1 km²)
- https://zeldauniverse.net/2017/03/26/it-takes-57-minutes-to-cross-hyrule-corner-to-corner-in-breath-of-the-wild/
- https://www.zeldadungeon.net/?p=201051 and https://primagames.com/tips/6-things-to-do-after-beating-tears-of-the-kingdom (TotK counts)
- https://uu.diva-portal.org/smash/get/diva2:1569059/FULLTEXT01.pdf (Cojanu & Jaber 2021, "The 40 Seconds Rule and Points of Interest in The Witcher 3")
- https://www.resetera.com/threads/40-second-rule-of-open-world-games.142132/
- https://mein-mmo.de/en/genshin-impact-harz-limit-erhoeht,1130141 (Resin cap 200)
- https://www.laps4.com/preguntas-y-respuestas/donde-estan-todos-los-cofres-de-genshin-impact (chest counts per region)
- https://theglobalgaming.com/genshin-impact/genshin-impact-map-size and https://expertbeacon.com/which-map-is-bigger-genshin-or-zelda/ (Genshin region sizes, fan estimates)
- https://oldschool.runescape.wiki/w/Farming_runs and https://oldschool.runescape.wiki/w/Bird_House
