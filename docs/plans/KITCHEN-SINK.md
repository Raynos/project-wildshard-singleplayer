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
  coins). The **east is combat only** (level bands, elites, the boss, the mini dungeon).

## 2. Decisions (Jake, 2026-11-02, E523)

**Shape**
1. The cell stays 500 × 500 m; fit more by stacking, interiors and shared spaces. The round 1 blockout says it fits.
2. West non-combat, east combat only. The hub's east gate is the only way into the combat half.
3. **Two waves.** Wave 1 front-loads every engine, game, SDK and format change the showcase needs, including cleanup
   from HOST-AUDIT and other plans, making one-shard hosts generic, and removing custom JSON from shardfiles (all
   approved). Wave 2 builds the showcase with no host work left. Wave 1 runs as its own lane plan at full size.

**Content in**
4. Hub with several quest givers, vendors and a simple **kill-contract board** (contracts for the enemy types,
   elites and boss).
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
13. Full audio: a music plan, an SFX plan, zone ambience, elite music, boss music, stings. **Orchestral score.**

**Levels and combat** (detail in [levels-combat-mini-plan.md](kitchen-sink-v2/levels-combat-mini-plan.md))
14. Levels 1–20. XP **only from kills**. **At most 8 attributes**, shared by player and enemies.
15. At least six enemy types in bands 1–3, 4–6, 7–9, 10–12, 13–15, 16–18; elites at **L6, L12 (the Vault
    Warden), L18**; the **Crate Titan at L20** is the final quest.
16. Attacks **can miss** (dice rolls). **Death costs XP** toward the next level and never delevels.
17. Quests are **freeform but level-locked**: a grey "!" when you're too low (like WoW), yellow when eligible.
18. Elites and the boss are a **soft gate**: always open, brutal when under-levelled.
19a. **Level per shard** (Jake 11-02: *"really important to me"*): your level is locked to the shard you're in. On
    the road between shards you're level 1; entering a shard puts you back at your level in that shard; every shard
    starts you at level 1. Level and XP are saved per shard.
19b. **Attributes grow automatically** (Fire Emblem rolls, 19o). No choosing, no respec (*"really annoying to choose your attributes
    every single time as you go shard by shard"*). The attribute list itself waits on Jake.
19c. Reaching level 20 takes about 2.5–3 hours. Kill contracts pay coins plus a trophy and a joke title the first time.
19d. **Roster kept:** Crate Mite L1–3, Pallet Jack L4–6, Plumb Drone L7–9, Welder Unit L10–12, Riveter L13–15, Arc
    Sentry L16–18; elites Big Pallet L6, Vault Warden L12, Foreman Unit 7 L18; the Crate Titan L20. **Night
    enemies are night-shift variants**: each band's enemy swaps to a tougher variant at night (+1 level).
19e. **Hub NPCs:** 4–5 dev-bot NPCs: a quest giver per level tier (1–6, 7–12, 13–20), the shop keeper, the stable
    hand; their lines change as you level. **The legendary is the Titan Cleaver sword.**
19f. **Enemy tiers:** common → rare variant → **elite** → boss. Jake: *"let's not call them mini bosses, let's call
    them elites"*; at least three (Big Pallet L6, Vault Warden L12, Foreman Unit 7 L18), on the elite host. Rare
    variants spawn at random among the commons. **Rare variants** are a shared rarity row on each enemy type (uncommon / rare: a new look, +1/+2
    levels, more Scrip, a trophy), generalised from Pine's coat rarity ([enemy tiers
    page](https://claude.ai/artifact/X1RZboFagn5EuHpQXkdWG5)).
19g. **Economy loop** ([loot page](https://claude.ai/artifact/BEQrDR1Ti1WUyY7pVRphYR)): the currency is **Scrip**;
    every kill drops one salvage part for its robot type; Tinker Rook's stall has UPGRADES (one-off buys for Scrip
    and parts) and BENCH (parts → ammo, patch kits); weapon tiers are **Forge I–IV**, one-off buys that raise every
    weapon at once.
19h. **Six elites:** the 3 band-gate elites plus **3 night elites** (Jake 11-02, not one per band). **Grey kills pay
    nothing** (no XP, Scrip or parts). Packs respawn on a **timer per pack** (~90 s after you leave, never in view).
    **No mid-fight heals:** no patch kits; the bench makes ammo only.
19i. **Quests:** 12, four per tier, from three tier givers; kinds are kill + collect, explore + elite hunt, set pieces.
    **HUD:** a bottom XP bar with an LV chip; enemy nameplates within ~25 m in con colours. **No heal button or
    potions.**
19j. **Shops:** weapons are **bought, level-locked**. Several shops, including a **dedicated weapons shop**; each shop's
    stock opens up by level. **Day/night like Driftwood** (20 min day + 4 min night). The Titan's **cutscene plays the
    first time, skippable**. **Storms:** the storm-hour quest plus rare natural storms.
19k. **Night elites** keep their names: Sir Nibbles (band 1, L4), Hot Mess (band 4, L13), Riveting Rita (band 5, L16).
    **Storm hour counts as night** for spawns. **Robots are Blender scripts** (no image-to-3D). **New SFX go into the
    shared sound set** for every shard; robots chirp, no spoken lines.
19l. **Overlap stays separate** (Jake 11-02): HOST-AUDIT (HA*, CS*) and SHARD-PLATFORM-NEXT (N2/N5) keep their rows;
    Wave 1 cross-references them and sequences around them, never duplicating. **West toys save personal bests and
    have feats** (no other reward). **The showcase stays behind Developer** until Jake's phone pass; the public build
    keeps the hologram plot at (0,2).
19m. **Miss chance: 12 % at equal level, rising to 90 % at 8 levels above you** (Jake 11-02: *"not aggressive enough on
    the level scaling"*), about +9.75 % a level. **Zone recipes live in the showcase's own source:** each zone is a
    self-contained, copyable section of the Showcase Template shardfile source (Template 3), not a separate doc.
19n. **No streak guard:** pure dice on the miss curve. **The L19 gap stays** (night elites and night-shift variants cover
    it). **An enemy cap goes into Wave 1:** full AI within 60 m, at most 16 animated on screen; it helps every shard.
    **Wave 1 crew when built: up to 5 Opus + 5 Codex lanes** (Jake 11-02: *"5+5 is fine for this … but we're just
    planning, not building"*).
19o. **Fire Emblem growth, not hybrid** (Jake 11-02): no points, no respec, a cap. Each shard rolls you a new character
    (base values and growth rates); each level-up rolls +1 per attribute at its growth chance. Proposed: growth pool
    85/70/60/55/45/40/35/30 % shuffled, cap 30, no blank-level protection; **Jake: "roughly like this, but
    more thought"**, so it gets a design pass in Wave 1 ([XP Curve and Growth](https://claude.ai/artifact/3vDB3KBSWsuL4XohXcZvWf)).
19p. **XP is RuneScape-steep:** enemies pay **10 × their level** (linear), drop-off below you, 0 at 6 under; the curve
    is exponential. Jake suggested ×2 or the golden ratio; ×2 is ~2,000 h to 20, the golden ratio (×1.618) is
    OSRS's 1–99 curve squeezed into 20 (~60 h). **Jake picked the golden ratio** (11-02). This replaces the 2.5–3 h target.
19q. **HP: 100 at level 1 to 300 at level 20, +6 % a level** (100, 126 L5, 168 L10, 225 L15, 300 L20). **VIT is the HP**
    (Jake 11-02: *"the level curve should reverse engineer into the VIT"*): HP is a function of VIT, tuned so a character
    with average VIT growth sits on that curve; a lucky VIT roll is tankier, an unlucky one frailer. **Enemies have their
    own HP curves** (MMO-style, steeper than the player's).
19r. **How a miss looks: option E** ([How a Miss Feels](https://claude.ai/artifact/R7BU7ErLT9Vi5wkYd3EsZR)). The dice stay
    (12 % at equal level, 90 % at +8); a failed hit shows as a **DEFLECT** (silver sparks, clang, blade recoil, 0 damage),
    a **DODGE** (the enemy slips aside) or a **PARRY** (enemies with one). MISS stays for aim misses only. Enemy failures
    on you show as a silver hurt arc and a small word. Odds are never shown as a %.
19s. **Growth model:** no flat HP per level; **HP = VIT**. VIT averages 100 → 300 (+6 % a level), **cap 330**. Each
    level-up gains round(average step × aptitude × swing): the step grows with the level (≈6 at L1, 17 at L19), aptitude
    is a balanced per-shard roll (exactly two 1.2s, four 1.0s, two 0.8s, shuffled across the 8 attributes), swing is per-level dice (0.4–1.6), so late levels can give +10 or more.
    Every attribute uses this model with its own curve and a cap ~10 % over its average.
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

**Waiting on Jake:** the attribute list and the growth-roll details (he is reading the
[levels page](https://claude.ai/artifact/P3ZQ7R8NdLrHxTTSWrqF3s)); the loot redesign.

## 3. The map

Detail in [map-layout-mini-plan.md](kitchen-sink-v2/map-layout-mini-plan.md). **Round 2 blockout with the full content
census** (`art/showcase-template/round-2-blockout/`, c6063ad0ce; `node placement.js` prints the fit tables): **it all
fits, after three fixes.** West 42 % used, east 79 %, 24.9 % of the cell free; the interiors sit under the cell at 0 m².

- **Census:** 54 packs (3 per level in every band), 117 commons by day, 12 night-shift points on the day spawns, rare
  variants as a roll among commons; 6 elites + the Titan; 12 chests + the vault chest, 36 crates, 20 Gold 1×1s (10
  west, 10 east), 24 quest targets, 13 contracts, 4 hub NPCs + the stable hand, 4 storm beacons (on band 5's corners).
- **The three fixes:** at 40 m pack spacing the east was short (band 2 fit 5 of its 9–10 packs). Fixed with 3 m walls
  between close packs in bands 2–4 (spacing 28–33 m, no aggro through them), a smaller gauntlet (r 36) against the
  seam, and band 5's Riveters living inside the stealth yard. Band 1 is exactly full.
- **Grind timing:** respawn ~90 s vs a 116–176 s walk back to a tier's first pack, so no waiting; all six bands
  take ~154 min (the 2.5–3 h target). **Gap:** no daytime L19 enemies; Jake keeps it (night variants cover it).
- **Phone load (estimated, not measured):** up to 13 enemies in one portrait view, 29 within 60 m, 85 within 150 m.
  No enemy cap exists today: proposed full AI within ~60 m and at most 16 animated on screen (Wave 1 row; first check
  on the iPhone).
- Hub r 28 with services ≤ 29 m apart; cover every ~12 m in the bands; distinct west silhouettes.
- The blockout calls the band-3 night elite "Nailbiter L11"; the names stay Jake's picks (Sir Nibbles, Hot Mess,
  Riveting Rita), so the lair placements are re-labelled in Wave 2's K1.

Round 1 (`round-1-blockout/`, 8094bf351f) had fit the zones alone with 22.7 % free.

| Half | Zones |
|---|---|
| West (no enemies) | hub (r 25–30 m in round 2) with quest givers, vendor, upgrade shop, contract board, trophy wall · weapon range 75 × 100 m · physics + hoverboard park 140 × 90 m · movers park 78 × 80 m + cistern · grapple tower 45 m + zipline · riding oval 208 × 88 m + mount post · cave hill with the squeeze cave · vistas and caches |
| East (combat) | band 1 L1–3 at the east gate → bands 2–6 snaking outward → L20 boss arena (r 28 m, 39 m intro approach) in the far south-east; elite lairs at the band changes (L6, L12, L18) and three night-elite lairs; stealth yard (band 5, storm hour); elite gauntlet (band 6); the Training Vault portal (band 4) |

## 4. Wave 1: engine, game and host work first

**Jake, 2026-11-02:** *"While you're doing that, you need to normalise all the existing custom-section hosts in the
engine around all of these features, and try and get them all shared. That means refactoring Driftwood Isle and Pine
Hollow and Nalati Grasslands … when we're touching shared hosts, you have to go and fix all the other shards that use
the shared hosts, and that's fine … the first wave should be all the engine and game and shared hosts, maybe even WASM
hosts, everything we need to touch."*

**The Wave 1 rule:** every row that creates or changes a shared host also **migrates every shard that implements that
feature today** (Driftwood, Pine Hollow, Nalati, Nine Dragon, Sky Reach, Signal Dunes, the templates) onto it in the
same row, deletes the shard's custom section, named JSON, shard-shaped schema or shard-named game code, and proves the
shard unchanged (its focused tests and a look in the game). Logic that is truly per-shard moves to AssemblyScript on
the WASM host. The loot/economy rows normalise Driftwood's, Pine's and Nalati's economies onto one host. A per-area
migration map is [wave-1-migration-map.md](kitchen-sink-v2/wave-1-migration-map.md): every area, every shard, today →
target, the parity proof per shard.

**Size: about 1,040 h.** Planned host rows ≈ 675 h (W1–W21 ≈ 389, LE 104, LV 50, HUD 19, QC 41, EB 28, DG 44) plus
new migration rows ≈ 365 h (M0–M9, including a shared parity kit and fresh-seat host scoring). **Crew: up to 5 Opus + 5 Codex lanes** (Jake 11-02, named for this plan when he says build; graphical work
Opus-only), roughly 4 weeks at that size. Also in Wave 1: an enemy-count cap on the phone (full AI within 60 m, ≤ 16
animated on screen).

Full host rows in [wave-1-hosts-mini-plan.md](kitchen-sink-v2/wave-1-hosts-mini-plan.md). Order:

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
| **K4** | Elites (Big Pallet L6, Foreman Unit 7 L18, three night elites), the stealth yard, the gauntlet | 2 d |
| **K5** | The Training Vault shrine (four rooms + the Vault Warden L12) | 2 d |
| **K6** | The Crate Titan L20: arena, phases, the cutscene intro, the legendary reward | 2 d |
| **K7** | Quests: givers, grey/yellow "!", the contract board, storm hour and the beacons, checkpoint cards, the shard-complete card | 2 d |
| **K8** | Economy: shop, pack, collectibles → perks, trophies, skins, feats, FINDS | 1–2 d |
| **K9** | Audio: orchestral score (hub, west, combat bands, elite themes, boss stems), SFX, ambience, stings | 2 d |
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
| [enemies-bosses-mini-plan.md](kitchen-sink-v2/enemies-bosses-mini-plan.md): 6 robot types, rare and night variants, 6 elites, the Crate Titan, the cutscene intro, Blender-script models | written |
| [quests-contracts-mini-plan.md](kitchen-sink-v2/quests-contracts-mini-plan.md): 12 quests (4 per tier), kinds, the kill-contract board, checkpoint cards | written |
| [audio-mini-plan.md](kitchen-sink-v2/audio-mini-plan.md): 11 orchestral cues, 8 stings, ~95 SFX, ambience zones, budgets | written |
| [hud-character-mini-plan.md](kitchen-sink-v2/hud-character-mini-plan.md): bottom XP bar + LV chip, nameplates within 25 m, a read-only Character tab (E332) | written |

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
