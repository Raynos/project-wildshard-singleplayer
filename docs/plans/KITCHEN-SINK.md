# Plan: KITCHEN-SINK v2: the Showcase Template, a levelled MMO-style test shard

**State:** `open`, being planned with Jake (2026-11-02, ask E523). Nothing is built until Jake says "build it". Status
lives in [kitchen-sink-v2/STATE.md](kitchen-sink-v2/STATE.md); the mini plans live in [kitchen-sink-v2/](kitchen-sink-v2/).
Live tracker for Jake: [Kitchen Sink v2](https://claude.ai/artifact/KAK7qkdYt3a3K5JGkpPzUD) (source
`art/showcase-template/kitchen-sink-v2/index.html`, review page `docs/reviews/kitchen-sink-v2.md`).

Jake, 2026-11-02 (E523): *"Kitchen sink V2 should be a plan … we have to really flesh it out … it has to be like a
mega plan … and then we must have a bunch of mini plans attached to it."* v1 (2026-10-20, E490, G522–G528) was
12 zones and a 9-step chain with no levels; it is in git history before this commit and summarised in §11.

## 1. What it is

- **Template 3, the Showcase Template** (slug `showcase-template`, G526): one 500 × 500 m cell in the 5 × 5 grid,
  in the Source dev-map look (orange and grey blocks, stencilled size labels, 1 m grid floors; G523, kept by Jake on
  11-02 over OPEN-PLOTS' teal expo). It replaces the hologram plot at (0,2) when it is built (G973: "comes later").
- **The point:** every engine feature in one place, authored with **0 % custom TypeScript** (G524). Shared hosts, data
  rows and AssemblyScript only. A feature that can't be built that way becomes a Wave 1 host row, never shard TS.
- **New in v2: it plays like an MMO zone.** Guild Wars-style **levels 1 to 20**: you arrive at level 1 and level up only
  by killing enemies, through six level bands to a level-20 boss.
- **Two halves** (Jake 11-02): the **west is non-combat** (hub, practice, traversal toys; no enemies, no XP, no
  coins). The **east is combat only** (level bands, mini-bosses, the boss, the mini dungeon).

## 2. Decisions (Jake, 2026-11-02, E523)

**Shape**
1. The cell stays 500 × 500 m; fit more by stacking, interiors and shared spaces. The round 1 blockout says it fits.
2. West non-combat, east combat only. The hub's east gate is the only way into the combat half.
3. **Two waves.** Wave 1 front-loads every engine, game, SDK and format change the showcase needs, including cleanup
   from HOST-AUDIT and other plans, making one-shard hosts generic, and removing custom JSON from shardfiles (all
   approved). Wave 2 builds the showcase with no host work left. Wave 1 runs as its own lane plan at full size.

**Content in**
4. Hub with several quest givers, vendors and a simple **kill-contract board** (contracts for the enemy types,
   mini-bosses and boss).
5. Weapons: sword (combo and **parry**), spear, bow, crossbow with **ammo types** (iron, pitch, broadhead), the **lever
   rifle**. The weapon range is practice only.
6. Riding course with a **loaner horse** from a stable hand. Movers and lifts; grapple and zipline; physics props;
   hoverboard park with tricks; pressure plates.
7. Stealth yard, elites, waves, **night-only enemies**.
8. The boss with an **in-engine cutscene intro**. Weather and day/night as **storm hour**: one quest turns the whole
   cell to an evening storm until four beacons are lit (weather is cell-wide; no per-zone weather).
9. The **Training Vault is the mini dungeon**: four rooms (puzzle, fight, climb, the Vault Warden), behind a portal in
   the east. Dying restarts the room you died in; solved puzzles stay solved.
10. Vistas and secrets ring (bench views, squeeze caves, hidden caches); collectibles that pay perks; trophies; a
    pack; skins and finishes from elites; a legendary weapon from the boss; joke-title feats; the FINDS tab.
11. Ladders, scramble climbs, swaying rope bridges and a cave where they suit the layout.
12. Checkpoint cards per quest leg; crates and loot chests.
13. Full audio: a music plan, an SFX plan, zone ambience, mini-boss music, boss music, stings. **Orchestral score.**

**Levels and combat** (detail in [levels-combat-mini-plan.md](kitchen-sink-v2/levels-combat-mini-plan.md))
14. Levels 1–20. XP **only from kills**. **At most 8 attributes**, shared by player and enemies.
15. At least six enemy types in bands 1–3, 4–6, 7–9, 10–12, 13–15, 16–18; mini-bosses at **L6, L12 (the Vault
    Warden), L18**; the **Crate Titan at L20** is the final quest.
16. Attacks **can miss** (dice rolls). **Death costs XP** toward the next level and never delevels.
17. Quests are **freeform but level-locked**: a grey "!" when you're too low (like WoW), yellow when eligible.
18. Mini-bosses and boss are a **soft gate**: always open, brutal when under-levelled.
19a. **Level per shard** (Jake 11-02: *"really important to me"*): your level is locked to the shard you're in. On
    the road between shards you're level 1; entering a shard puts you back at your level in that shard; every shard
    starts you at level 1. Level and XP are saved per shard.
19b. **Attributes are allocated automatically.** No choosing, no respec (*"really annoying to choose your attributes
    every single time as you go shard by shard"*). The attribute list itself waits on Jake.
19c. Reaching level 20 takes about 2.5–3 hours. Kill contracts pay coins plus a trophy and a joke title the first time.
19d. **Roster kept:** Crate Mite L1–3, Pallet Jack L4–6, Plumb Drone L7–9, Welder Unit L10–12, Riveter L13–15, Arc
    Sentry L16–18; mini-bosses Big Pallet L6, Vault Warden L12, Foreman Unit 7 L18; the Crate Titan L20. **Night
    enemies are night-shift variants**: each band's enemy swaps to a tougher variant at night (+1 level).
19e. **Hub NPCs:** 4–5 dev-bot NPCs: a quest giver per level tier (1–6, 7–12, 13–20), the shop keeper, the stable
    hand; their lines change as you level. **The legendary is the Titan Cleaver sword.**
19. **Existing shards get levels too, hidden:** you are level 1, every enemy is level 1, the range is 1 to 1, and no
    level UI shows. Their combat must feel exactly as it does today. Rolling 1–20 out to other shards is future work.

**Economy** (detail in [loot-economy-mini-plan.md](kitchen-sink-v2/loot-economy-mini-plan.md); Jake calls loot
under-thought, so these may be revisited)
20. Coins from kills, chests and contracts. The shop sells flat one-off upgrades. Loot is fixed rewards only. A
    20-slot pack. The west half pays nothing.

**Platform**
21. **Every shard gets a shard-complete card**, and a shardfile validator requires it. The "Killed by…" card and
    respawn at the last discovered place are already generic (`engine/ui/HurtArc.ts`, `game/LastPlace.ts`).

**Content out:** water (swim, dive, boats, canoe), the creature pen, taming, mounts as a feature, herds, the
contracts board's rotating hunts, war fan, whip, mounted combat, lightning, hover-only bridges, kokpar, the dam
puzzle, happenings, time trials, thin ice, glide shaft, daily seed. **Not yet:** tooling demos (third-person camera,
landscape HUD, loading screen, Explore tabs, bot playtest).

**Waiting on Jake:** the attribute list (he is reading the
[levels page](https://claude.ai/artifact/P3ZQ7R8NdLrHxTTSWrqF3s)); the loot redesign.

## 3. The map

Detail and round 2 in [map-layout-mini-plan.md](kitchen-sink-v2/map-layout-mini-plan.md). Round 1 blockout
(`art/showcase-template/round-1-blockout/`, 8094bf351f): **it fits with no cuts**. West 47 % used, east 78 %,
22.7 % of the cell free; the interiors sit under the cell at 0 m².

| Half | Zones |
|---|---|
| West (no enemies) | hub (r 25–30 m in round 2) with quest givers, vendor, upgrade shop, contract board, trophy wall · weapon range 75 × 100 m · physics + hoverboard park 140 × 90 m · movers park 78 × 80 m + cistern · grapple tower 45 m + zipline · riding oval 208 × 88 m + mount post · cave hill with the squeeze cave · vistas and caches |
| East (combat) | band 1 L1–3 at the east gate → bands 2–6 snaking outward → L20 boss arena (r 28 m, 39 m intro approach) in the far south-east; mini-boss pits at the band changes (L6, L12, L18); stealth yard (band 5, storm hour); elite gauntlet (band 6); the Training Vault portal (band 4) |

## 4. Wave 1: engine, game and host work first

Full rows in [wave-1-hosts-mini-plan.md](kitchen-sink-v2/wave-1-hosts-mini-plan.md). About **380 h** of host work
(audit 11-02) plus the levels system (LV rows), the economy (LE rows) and the shrine host (DG rows). Order:

1. **Make the ruler honest** (HOST-AUDIT HA0/HA1/HA5), so "0 % custom TS" means something.
2. **Shared sections:** interactables (benches, chests, doors, levers, plates, barrels), commons AS prefabs (plates,
   rope bridge, a wave-director stage script).
3. **Out of the plugin scaffolding:** movers, the wave director, firearms (SHARD-PLATFORM-NEXT N2/N5 slices).
4. **In parallel:** quests + vendor + currency (one author quest path); held weapons as weapon-family rows with ammo
   and parry; a given-mount row with no taming; conveyor and jump pad; one boss path with telegraphs, hazards and
   arenas; the cutscene timeline (IN-GAME-CUTSCENES IC1–IC4); weather kinds renamed from "forest"; physics props, the
   board moved to game, trick scoring, see-saw; a generic interior; perks, trophies, finishes; the completion
   validator (backfill every shard first, then turn the rule on); the scramble climb mode; audio states for elite and
   boss music; one breadcrumb guide.
5. **Levels and combat** (LV): progression rows, level and attributes on actors, a hit/miss + damage stage, an XP
   service, level fields on creature/boss/weapon/quest rows, the hidden L1 parity for every existing shard, HUD pieces
   (level, XP bar, con-coloured nameplates, a Character tab) through E332 coordination and Jake's pick.
6. **Economy** (LE) and **the shrine host** (DG, [mini-dungeon-mini-plan.md](kitchen-sink-v2/mini-dungeon-mini-plan.md)).
7. Docs: one SHARDS.md section per feature and template example rows.

**Riskiest:** boss unification plus cutscenes (re-homes five shipped boss intros); moving firearms and movers out of
the plugin (Driftwood and Pine saves); the completion validator (red on every product until backfilled); the levels
parity on existing shards.

**Wave 1 is done when** every feature in §2 can be authored as data or AS by a new shard, each host has two real
users or Jake's approval (G595), existing shards play unchanged, and the template has an example row for each.

## 5. Wave 2: build the showcase

Data and AS only, on the Wave 1 hosts.

| Row | What | Effort (est.) |
|---|---|---|
| **K1** | Skeleton from `src/shards/_template/`: the cell from the round 2 blockout, the seam wall, roads, hub, dev-map materials, grid slot (0,2), edge entries | 2 d |
| **K2** | West: weapon range, hoverboard park, movers park, grapple tower + zipline, riding course + loaner horse, cave hill, vistas and caches | 3 d |
| **K3** | East bands 1–6: six enemy types + night variants, spawns, cover, crates and chests, level-banded XP and coins | 3 d |
| **K4** | Mini-bosses L6 and L18, the stealth yard, the elite gauntlet | 2 d |
| **K5** | The Training Vault shrine (four rooms + the Vault Warden L12) | 2 d |
| **K6** | The Crate Titan L20: arena, phases, the cutscene intro, the legendary reward | 2 d |
| **K7** | Quests: givers, grey/yellow "!", the contract board, storm hour and the beacons, checkpoint cards, the shard-complete card | 2 d |
| **K8** | Economy: shop, pack, collectibles → perks, trophies, skins, feats, FINDS | 1–2 d |
| **K9** | Audio: orchestral score (hub, west, combat bands, three mini-boss themes, boss stems), SFX, ambience, stings | 2 d |
| **K10** | Grid-ready (memory ≤ 1.2 GB Explorer, one-frame looks, baked tiles, entries, edge profile) and seamless travel | 1 d |
| **K11** | Balance pass: time to L20 (~2.5–3 h target), fight lengths, soft-gate brutality | 1 d |
| **K12** | Jake plays it on the phone; his notes are the verdict | — |

About 20–22 lane-days (estimate): Opus for everything the player sees (G848), Codex for rows, AS and balance tables.

## 6. Mini plans

| Mini plan | Status |
|---|---|
| [levels-combat-mini-plan.md](kitchen-sink-v2/levels-combat-mini-plan.md): levels, XP, attributes, hit/miss + damage maths, enemy scaling, hidden L1 rollout to existing shards, engine rows | being written |
| [loot-economy-mini-plan.md](kitchen-sink-v2/loot-economy-mini-plan.md): coins, shop, loot, harvesting, pack, perks, trophies; audit of Driftwood and Pine Hollow | being designed |
| [mini-dungeon-mini-plan.md](kitchen-sink-v2/mini-dungeon-mini-plan.md): the shrine host and the Training Vault | written |
| [wave-1-hosts-mini-plan.md](kitchen-sink-v2/wave-1-hosts-mini-plan.md): every Wave 1 host row | written (draft) |
| [map-layout-mini-plan.md](kitchen-sink-v2/map-layout-mini-plan.md): blockout rounds and the zone table | written |
| enemies-bosses-mini-plan.md: the 6 enemy types, night variants, 3 mini-bosses, the Crate Titan, the cutscene intro | Jake ordered 11-02; to write |
| quests-contracts-mini-plan.md: givers, freeform level-locked quests, grey/yellow "!", the kill-contract board, storm hour, checkpoint cards | Jake ordered 11-02; to write |
| audio-mini-plan.md: orchestral score, SFX, ambience, mini-boss and boss music | Jake ordered 11-02; to write |
| hud-character-mini-plan.md: level, XP bar, nameplates, Character screen (E332 HUD coordination) | Jake ordered 11-02; to write |

## 7. Pages for Jake

- Tracker: [Kitchen Sink v2](https://claude.ai/artifact/KAK7qkdYt3a3K5JGkpPzUD)
- [Mini Dungeon / Shrine Room](https://claude.ai/artifact/QT7U953tYyBPBKHA7RrVDQ) (`art/showcase-template/round-2-mini-dungeon/`)
- [Levels 1 to 20](https://claude.ai/artifact/P3ZQ7R8NdLrHxTTSWrqF3s) (`art/showcase-template/round-3-levels/`)
- [Kitchen Sink v2 Mockups](https://claude.ai/artifact/9sKa3P19CfNdDi6ZrS3HUj): 40 frames, west / east (`art/showcase-template/round-4-v2-layout/`)

## 8. Done when

Wave 1: every §2 feature authorable as data/AS, existing shards unchanged (hidden L1 parity), the completion validator
on. Wave 2: the showcase plays end to end on the phone tier, level 1 to the Crate Titan, with 0 custom TS lines,
grid-ready within the memory limit, seamless in the 5 × 5; Jake has played it.

## 9. Not in this plan

The 1–20 level rollout to other shards; random gear and rarity tiers (unless the loot redesign changes this); the
tooling demos; per-zone weather.

## 10. Sources

Shard audit and plan mining (11-02, E523): Driftwood, Nalati, Pine Hollow, Nine Dragon, Sky Reach, Signal Dunes;
GW2-ZONES, WORLDCLAW, OCTOBER-BACKLOG, THIN-ICE, IN-GAME-CUTSCENES, HOST-AUDIT, SHARD-PLATFORM-NEXT. v1 mockups:
`art/blender-template/round-5-content/`.

## 11. v1, for the record

v1 (2026-10-20): 12 zones (hub, weapon range, creature pen, riding course, movers park, grapple tower, stealth yard,
elite gauntlet, boss arena, weather and night, physics and hover, portal vault) tied by a 9-step chain, "The Foreman's
Yard", ending at the Crate Titan; rows K0–K8, about 10–12 lane-days. K0 (name and boss, G526/G528) is the only row that
was done, and it carries over.
