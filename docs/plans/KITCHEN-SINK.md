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
  in an orange-and-grey look (G523, kept by Jake on 11-02 over OPEN-PLOTS' teal expo), **now polished, never
  placeholder** (ruling 19ab: no stencilled size labels, no 1 m grid floors, no plain blocks). It replaces the hologram plot at (0,2) when it is built (G973: "comes later").
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
19t. **Attributes (Jake 11-03):** **VIT (HP), STR (melee damage) and DEX (ranged damage) are locked.** PRE, AGI and TGH
    are in doubt; RES and POI are likely out. **AGI is added** (Jake 11-03). The cross-links: STR → melee damage;
    VIT → HP; DEX → ranged damage, hit chance for melee and ranged, and melee crit; AGI → dodge, and ranged crit. A
    20-game attributes study settles whether anything else earns a place (at most 8).
19u. **Layout round 3** (Jake 11-03): the hub becomes a **town** (a village taking a big share of the west, not a small
    centre plaza), and the west toys are rebalanced around it. **NE quadrant:** bands L1–3, 4–6, 7–9, 10–12. **SE
    quadrant:** no L1–3; its top half is band L13–15 (the stealth yard doubles as it) and band L16–18, each its own
    section; its bottom half is only the gauntlet arena (L16–18) and the Crate Titan, at the very bottom right.
19v. **Attributes page** ([Attributes](https://claude.ai/artifact/1vKjyhEmkmRQCV4vFNuXEq), levels-combat §11): recommended
    VIT, STR, DEX, AGI and nothing else; armour from level × per-body plating. Jake 11-03: **aptitude for four is one
    1.2, two 1.0, one 0.8**; **RES and POI become data** (energy hits count half your armour; stagger per body; parry
    window 0.15 s plus the Parry Gyro). The four-attribute lock and the armour rule wait on his read.
19w. **Seven attributes** (Jake 11-03, superseding 19v's four): **VIT** (HP) · **STR** (melee damage) · **DEX** (ranged
    damage, hit chance for every weapon, melee crit) · **AGI** (dodge, ranged crit) · **DEF** (physical armour; enemies
    have DEF curves by kind, replacing the plating number; more DEFLECTs against high DEF) · **MDEF** (energy attacks
    now: burn, shock, blast; magic later) · **LUK** (balanced, personal effects only: *"in an MMO luck has to balance and
    can't impact spawns"*; exact job in the LV design pass, e.g. crit chance and damage). CON is VIT, skill is DEX, speed
    is AGI; INT and WIS wait for magic combat. **Aptitude for seven: two 1.2, three 1.0, two 0.8.**
19x. **Combat maths (Jake 11-03, in progress):** attributes grow on **different shapes** (not all like VIT); **AGI gives
    no speed** (animation and attack speed fixed); **LUK = crit damage + lucky saves**, which turn a few % of enemy hits
    on you AND a few % of your own failed hits into glances; if a subtractive formula is used, **the floor is 1 damage**.
    The damage formula itself is open: Jake doubts raw addition/subtraction and asked for the best three options; an
    interactive calculator and simulation are being built.
19y. **Six town NPCs** (three quest givers, Tinker Rook, the weapons-shop keeper, the stable hand); the empty shopfronts
    get keepers only when shops are added. **Keep the road gate into band 6** for the long high-level grind (Jake 11-03).
19z. **Other shards keep today's simple combat** (Jake 11-03, superseding 19 and 19a's "level 1 everywhere"): no levels and
    no attributes at all outside the showcase, not even hidden at level 1 (*"making everything level 1 is messy"*).
    They keep flat damage, flat stats and flat HP. The levels/attributes system is opt-in per shard, used only by the
    showcase; upgrading other shards is later work. Wave 1's levels rows must leave the existing combat path untouched.
19aa. **Combat maths and attributes locked** (Jake, 11-03 grill; every recommended option except the level-up card;
    full formulas in [levels-combat §15](kitchen-sink-v2/levels-combat-mini-plan.md)). Damage is **WoW-classic style**
    (armour takes a share, `K / (K + DEF)`). **VIT grows ×6** (100 → 600, cap 660). Growth shapes: STR/DEX steep 20 → 120,
    AGI front-loaded 20 → 80, DEF linear 20 → 80, MDEF late 10 → 80, LUK flat 10 → 20. LUK sets crit size
    ×(1.5 + LUK/100) and gives lucky saves (LUK × 0.2 %, both ways, cap 6 %). DEX vs AGI nudges the fail roll ±8 at most.
    DEF vs AGI picks DEFLECT or DODGE. Crits 10 % base, cap 40 % (DEX for melee, AGI for ranged). Glances 5 % a level,
    half damage. Pacing: a common dies in ~7 swings (~9 s) and kills you in ~11 strikes; elites have ×7 HP and the Titan
    ×22; ranged does 10 % less DPS than melee. Floating numbers (white, yellow crit, grey glance, the miss words). Burn,
    shock and blast status effects. Rares are +1 / +2 levels with ×1.5 / ×2.5 HP. Enemy stats are fixed per species.
    Parry is a timed skill (0.15 s, Parry Gyro 0.22 s) with a riposte crit. STR fills a stagger bar.
    **Level-up never blocks a fight** (Jake: the card *"would break the combat loop and be unsafe mid combat"*): in
    combat a ring, the sting, the LV chip and a one-line gain chip; the Fire Emblem tick-up card waits until you're out
    of combat. A level-up refills HP. Regen starts 5 s after the last hit and fills in 12 s; commons leash and reset.
    The Character tab shows the attributes, par, ▲▼ aptitudes and derived numbers.
19ab. **The look is polished, not placeholder** (Jake 11-03, on the first remastered mockups: *"poisoned by the placeholder
    stuff in the gray blockout … sizes everywhere, 1x1, 2x3, 4x8. That's bad … what would this look like as a super fun
    kitchen sink showcase shard that has the simpler art style but still polished and super fun and doesn't look like
    placeholder shit"*). A simple, polished, playful stylized look in a warm orange and cool grey workshop / test-yard
    palette with cyan accents: finished materials, characterful robots, a cover-worthy Crate Titan. **Out:** stencilled
    size labels ("1x1", "MK II"), dev-texture grid floors and plain blocks. The grey blockout fixes layout only. The
    prompt block is `art/showcase-template/round-11-remaster/COMMON-v2.txt`. Jake, right after: *"a bunch of the mockups are
    good … 8 out of 10. Top-down stuff is good. The west side is looking pretty good. We just need to push it a bit
    harder. Especially the crate titan"*; the Training Vault shots are original mockups (no real blockout of it).
19ac. **The Crate Titan fight is behind a boss portal** (Jake 11-03: *"like Elden Ring or Dark Souls, there needs to be a
    boss portal … you enter a portal, and then you get taken to an absolutely massive boss arena. Remember that shard
    files are still 500x500, you can't cheat"*). The surface keeps only a small Titan gate in the SE; the fight is in a
    hidden arena inside the cell's footprint at another height (like the Training Vault), sized for a huge Titan. The
    freed SE ground goes to the **gauntlet**, which gets the room a 5-wave arena needs. Blockout round 5
    (`art/showcase-template/round-5-blockout/`) sizes both; its numbers are in §3.
19ad. **Every shard is a 500 × 500 × 500 m cube, for every shard, not only the showcase** (Jake 11-03: *"you can take
    the whole cube and everything that's underground and use that to implement more content. But it's not like you can
    use teleports to implement an infinite amount of content. You can't cheat beyond your 500 by 500 by 500 cube. You
    can try to pack content in there in a clever way"*). Any shard may add dungeons, hidden arenas and other interiors
    reached by portals, as long as each sits inside its own cube (±250 m around the highway level, the engine's
    `CELL_BELOW` / `CELL_ABOVE`) and no two volumes overlap; no portal leads to a parallel world outside the cube. A
    shardfile validator enforces it and SHARDS.md documents it (Wave 1 row W15). The showcase is the first user: the
    Training Vault at y −40 and the Titan arena at y −150.
19ae. **The HUD stays calm: all 38 UI changes decided** (Jake 11-03, one by one on in-engine before/after pairs; 33
    approved, 5 cut; [UI-PICKS.md](kitchen-sink-v2/UI-PICKS.md), slice decisions D49–D61). No banner or chip outlives
    its moment (wave, storm and beacon lines fade in ~2 s); an activity's chip takes the quest chip's place (course
    clock, vault rooms, trick score); the fight row is GUARD · LOCK · DODGE · JUMP with no BOLTS disc (tap the weapon
    chip for three ammo tiles); the bag is five tabs with CHARACTER / GEAR and MAP / QUESTS sub-tabs; toasts are one
    short line. Cut: the map heat map, the minimap band border, a HUD Scrip chip, the range's LOAN tags, the tour
    toast.
19. **Existing shards get levels too, hidden:** you are level 1, every enemy is level 1, the range is 1 to 1, and no
    level UI shows. Their combat must feel exactly as it does today. Rolling 1–20 out to other shards is future work.

**Economy** (detail in [loot-economy-mini-plan.md](kitchen-sink-v2/loot-economy-mini-plan.md); Jake calls loot
under-thought, so these may be revisited)
20. Coins from kills, chests and contracts. The shop sells flat one-off upgrades. Loot is fixed rewards only. A
    20-slot pack. The west half pays nothing.

**Platform**
21. **Every shard gets a shard-complete card**, and a shardfile validator requires it. The "Killed by…" card and
    respawn at the last discovered place are already generic (`engine/client/ui/HurtArc.ts`, `game/LastPlace.ts`).

**Content out:** water (swim, dive, boats, canoe), the creature pen, taming, mounts as a feature, herds, the
contracts board's rotating hunts, war fan, whip, mounted combat, lightning, hover-only bridges, kokpar, the dam
puzzle, happenings, time trials, thin ice, glide shaft, daily seed. **Not yet:** tooling demos (third-person camera,
landscape HUD, loading screen, Explore tabs, bot playtest).

**Waiting on Jake:** nothing on levels, attributes or combat (19aa); the loot plan is locked as written (Jake 11-03,
D62). The remaining slice questions: [OPEN-QUESTIONS.md](kitchen-sink-v2/OPEN-QUESTIONS.md).

## 3. The map

Detail in [map-layout-mini-plan.md](kitchen-sink-v2/map-layout-mini-plan.md).

**Round 5 blockout, the current layout** (`art/showcase-template/round-5-blockout/`, 27a5b5d804; ruling 19ac): round 4
with only the **SE bottom and the hidden layers** changed; it fits, **13.4 % free** (was 16.3). The Titan's surface
footprint drops from 5,160 to a **2,496 m² Titan gate** (a 14 m lane into a 39 × 38 m plaza: the last checkpoint, the
L20 plaque, the return pad and an 18 m portal arch). The **gauntlet grows 2.5× to 14,114 m²**: a forecourt (checkpoint,
run board) and three sealed courts through three gates: **C1 Loading Yard** 82 × 42 (waves 1–2, +3 m entry terrace),
**C2 The Pit** 82 × 44 (waves 3–4, the elite reveal lift), **C3 Foreman's Floor** ⌀84 (wave 5, terraces, the Foreman's
balcony); spawn doors D1–D6 ~42 m out (~10 s for a wave to reach you); peak 9 robots live; dying restarts the court.
**The Crate Titan fights in a hidden arena** at floor y −150 under the SE (x 80–220, z 95–235; its own sky to −80), 74 m
below the surface and clear of the Training Vault (y −40…−30): a **⌀104 m floor**, an 8 m wall, stands to ⌀140, four
rolling lanes for the 4 × 8 block, an edge-leap band, and an alcove with the inner checkpoint, the exit portal and the fog
gate. **The Titan is 15 m tall** (9 m read as a big elite; 20 m broke the 0.9 s tells and needed a ⌀140 floor). The 12 s
intro plays inside on arrival; retries respawn in the alcove; on a win a victory portal returns you to the gate for the
shard-complete card. Platform: the same walk-in portal + interior host as the Training Vault; the two interiors never
load together. Jake 11-03: **15 m** confirmed; **the Titan road stays locked until your first gauntlet clear**, then
it is the shortcut for retries; the wave-3 elite is **Shift Supervisor**. The threat sizes behind the court widths (8 m slam ring, 7 m lunge) are assumed until the enemy pass.

**Round 4 blockout** (`art/showcase-template/round-4-blockout/`, 4c06e22346; the east is round 3's):
the **town shrinks to 120 × 120 m** (5.8 % of the cell; 40 m gate plaza, 72 m Main Street with four shopfronts, all six
NPCs inside, six gates, only the East Gate to combat) and **the west toys grow from 18 % to 27 % of the cell**, each
laid out and labelled: weapon range 78 × 102 (dummies, bow/crossbow lanes 10–50 m, ammo practice, rifle to 75 m); a new
physics yard 78 × 54 (3 plates → gate, crates, see-saws, ball run); riding course 208 × 88 with 8 rings, 4 jumps, a
lap-timer gantry and a 48 × 60 paddock; a straight six-station movers run 98 × 58; a grapple course (5 hooks ≤ 38 m
apart, a 99 m zip to the town); a new climb yard (scramble wall, ladders, rope bridges); the Rock with a 60 m squeeze
cave; the hover park 134 × 122 (kickers, halfpipe, quarter pipes, rails, bowl); personal-best boards at all five
courses; 6 west vistas, 4 caches, 10 Gold 1×1s. 16.3 % of the cell is still free. Weakest at eye height: the hover park
(low ramps read flat).

Round 3 (`round-3-blockout/`, c292cc13e6) had the 176 m town: **fits**, west 61 %
used, east 71 %, 19.0 % free. The hub is a **walled town, 176 × 176 m** (12.4 % of the cell; a 48 m gate plaza with
the three tier givers, contracts, trophy wall, market stalls and a 22 m obelisk; Main Street with Tinker Rook, the
weapons shop and three empty fronts; six gates, only the east one crosses into combat; the stable at the north gate).
West toys around it: the range along the town's south wall, a stacked spiral movers park (48 × 44), the grapple tower's
98 m zipline landing on town roofs, "the Rock" (a 16 m crag with the squeeze cave and the lookout bench) replacing Cave
Hill, the riding oval and hover park kept. **NE:** bands 1→2→3→4 in a 2 × 2 grid. **SE top:** the stealth yard is band 5,
band 6 its own section; **SE bottom:** only the gauntlet and the Crate Titan. 60 packs, 129 commons by day; bands 5–6
have 4 packs a tier for the ~59 h golden-ratio grind (56 h of it there) with no waiting; phone estimate up to 15 enemies
in a portrait view (cap 16).

Earlier: **Round 2 blockout with the full content
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

## 4. How it gets built: vertical slices

**Jake, 2026-11-03** (replacing the two waves): *"not have the plan go so waterfall, but to have the plan go in vertical
play slices. Start on the west half … break it down into as many small chunks as possible … that new engine work has to
be front loaded within that phase … then you implement that part of the showcase … within that vertical slice, it needs
to go and fix all the other shards if it touches a refactor that crosses all the shards."*

Everything lives in [kitchen-sink-v2/slices/](kitchen-sink-v2/slices/README.md): the slice rule, one file per slice
(the showcase piece; the engine / game / host work with the exact files researched; every other shard migrated in the
same slice and its parity proof; done-when; hours; risks; questions), the two indexes, the impact guide and the coverage
map.

**The slice rule:** each slice (1) does only the engine / game / host work its piece needs, just in time, on the host bar;
(2) moves every shard that uses what it touched onto it in the same slice, the whole host family (a new optional field
only proves the others unchanged, D33), custom code deleted, saves byte-exact and looks "similar, no glitches" (D34);
(3) builds that piece of the showcase as data + AssemblyScript; (4) lands playable behind Developer.

| Half | Slices | Hours | At 5 Opus + 5 Codex | Index |
|---|---|---|---|---|
| **West** (no combat) | 33: W0a–W0e skeleton, ruler, host register, cube + module cap; W1–W2 town, NPCs, quest board, currency, shops; W3 range (melee + loans, bow / crossbow / ammo, rifle out of the plugin, parry); W4–W5 physics yard, hover park, tricks, rails; W6–W8 movers out of the plugin, conveyors, rope bridges, the course timer, grapple, zip, ladders, scramble; W9–W12 the Rock + cave, finds, riding, weather, west audio, west finish | ~810 | ~4.5 weeks | [INDEX-west.md](kitchen-sink-v2/slices/INDEX-west.md) |
| **East** (combat) | 54: E0 levels + combat core + HUD + enemy cap; E1 band 1 end to end (robot pipeline, packs, Scrip, parts, the contract board, Pine's quest runtime); bands 2–6 and the stealth yard; variants, elites, trophies, storm hour; the Training Vault (portal interiors, shrine host, rooms, Warden); the gauntlet (director out of the plugin); the Crate Titan (one boss path, the cutscene timeline, five intros re-homed, the arena fight); quest tiers, the shard-complete card, audio, balance, east finish | ~1,302 | ~6.5–7 weeks (critical path ~28–30 days) | [INDEX-east.md](kitchen-sink-v2/slices/INDEX-east.md) |

**How slices run** (Jake 11-03): he plays at the end of the west and the end of the east; the west goes in order W0–W2,
then the toy slices in parallel lanes; lanes that run dry late in the west start the engine-only east slices early
(D45) but no east content lands before the west is done; the WASM-HOST H13 ABI switch lands between the halves (D30);
one-user hosts go to him as one approval sheet per half (D32); the crew is 5 Opus + 5 Codex, written into AGENTS.md
when he says build (D36). All 48 slice decisions: [DECISIONS.md](kitchen-sink-v2/slices/DECISIONS.md).

**What touching the platform means** (the layers, the host bar, how a host is born, the guards and ratchet, the parity
kit, the migration procedure, the host × shard matrix): [IMPACT.md](kitchen-sink-v2/slices/IMPACT.md). **Every old
row** (Wave 1 W1–W21, M0–M9, LV, LE, HC, QC, EB, DG, audio, Wave 2 K1–K12) mapped to its slice:
[COVERAGE.md](kitchen-sink-v2/slices/COVERAGE.md). The old two-wave plan (Wave 1 ≈ 1,040 h of hosts first, then ~30
lane-days of shard) is superseded; [wave-1-hosts-mini-plan.md](kitchen-sink-v2/wave-1-hosts-mini-plan.md) and
[wave-1-migration-map.md](kitchen-sink-v2/wave-1-migration-map.md) stay as research the slices cite.

**Riskiest** (from the slice research): movers and the director are wired into quests (W6a lands before W1b); weather
reads ammo and four shards' painted looks (W11a after W3b); Pine is at 9 of 9 script modules and each costs a
40–80 ms cell-entry freeze on the iPhone (W0e fixes the freeze, D29); five boss paths on one brain, one inside the
plugin director (E11a before the boss slices); the completion validator (every product backfilled first); other plans'
lanes in the same files (Z6, Z13 finish first, D31).

## 5. Mini plans

| Mini plan | Status |
|---|---|
| [slices/](kitchen-sink-v2/slices/README.md): the build as 87 vertical slices (33 west, 54 east), INDEX-west / INDEX-east, IMPACT, COVERAGE, DECISIONS D1–D48 | written; **the build order** |
| [levels-combat-mini-plan.md](kitchen-sink-v2/levels-combat-mini-plan.md): levels, XP, attributes, hit/miss + damage maths, enemy scaling, engine rows; §15 is the locked maths; other shards keep flat combat (19z) | written |
| [loot-economy-mini-plan.md](kitchen-sink-v2/loot-economy-mini-plan.md): coins, shop, loot, harvesting, pack, perks, trophies; audit of Driftwood and Pine Hollow | being designed |
| [mini-dungeon-mini-plan.md](kitchen-sink-v2/mini-dungeon-mini-plan.md): the shrine host and the Training Vault | written |
| [wave-1-hosts-mini-plan.md](kitchen-sink-v2/wave-1-hosts-mini-plan.md): the old Wave 1 host rows | superseded by slices/ (kept as research) |
| [map-layout-mini-plan.md](kitchen-sink-v2/map-layout-mini-plan.md): blockout rounds and the zone table | written |
| [enemies-bosses-mini-plan.md](kitchen-sink-v2/enemies-bosses-mini-plan.md): 6 robot types, rare and night variants, 6 elites, the Crate Titan, the cutscene intro, Blender-script models | written |
| [quests-contracts-mini-plan.md](kitchen-sink-v2/quests-contracts-mini-plan.md): 12 quests (4 per tier), kinds, the kill-contract board, checkpoint cards | written |
| [audio-mini-plan.md](kitchen-sink-v2/audio-mini-plan.md): 11 orchestral cues, 8 stings, ~95 SFX, ambience zones, budgets | written |
| [hud-character-mini-plan.md](kitchen-sink-v2/hud-character-mini-plan.md): bottom XP bar + LV chip, nameplates within 25 m, a read-only Character tab (E332) | written |

## 6. Pages for Jake

- Tracker: [Kitchen Sink v2](https://claude.ai/artifact/KAK7qkdYt3a3K5JGkpPzUD)
- [Mini Dungeon / Shrine Room](https://claude.ai/artifact/QT7U953tYyBPBKHA7RrVDQ) (`art/showcase-template/round-2-mini-dungeon/`)
- [Levels 1 to 20](https://claude.ai/artifact/P3ZQ7R8NdLrHxTTSWrqF3s) (`art/showcase-template/round-3-levels/`)
- [Kitchen Sink v2 Mockups](https://claude.ai/artifact/9sKa3P19CfNdDi6ZrS3HUj): the 40 frames remastered from the round-4
  grey blockout in the polished look (`art/showcase-template/round-11-remaster/`; replaces `round-4-v2-layout/`)
- [Kitchen Sink v2 UI Changes](https://claude.ai/artifact/MLXuWHJW9msEDh4Zg8YzsC): every HUD / UI / menu change as a 1:1
  in-engine before/after pair, 38 changes (`art/showcase-template/round-12-ui/`); each still needs Jake's pick + the E332
  notice before it lands. Found: the slot under the minimap is contested (quest chip, weather chip, toasts, the course
  clock, wave / room counters, storm hour), so the toast stack order must be set first; levelled nameplates need ~120 px
  (were 72); the XP bar and GUARD fit without moving anything.
- [Kitchen Sink Engine Top 20](https://claude.ai/artifact/R3JZEyPiaPuMMQiiAqsozV): the 87 slices grouped into the 20
  heaviest engine and host features, by hours × complexity (`art/showcase-template/kitchen-sink-v2/engine-top-20/`).

## 7. Done when

Every west and east slice is done (its own done-when, every touched shard migrated and proved); every §2 feature is
authorable as data / AS by a new shard; other shards play unchanged (saves byte-exact, looks similar); the completion
validator is on; the showcase plays end to end on the phone tier, level 1 to the Crate Titan, with 0 custom TS lines,
within 1.2 GB, then takes the hologram's grid cell (D3); Jake has played the west and the east.

## 8. Not in this plan

The 1–20 level rollout to other shards; random gear and rarity tiers (unless the loot redesign changes this); the
tooling demos; per-zone weather.

## 9. Sources

Shard audit and plan mining (11-02, E523): Driftwood, Nalati, Pine Hollow, Nine Dragon, Sky Reach, Signal Dunes;
GW2-ZONES, WORLDCLAW, OCTOBER-BACKLOG, THIN-ICE, IN-GAME-CUTSCENES, HOST-AUDIT, SHARD-PLATFORM-NEXT. v1 mockups:
`art/blender-template/round-5-content/`.

## 10. v1, for the record

v1 (2026-10-20): 12 zones (hub, weapon range, creature pen, riding course, movers park, grapple tower, stealth yard,
elite gauntlet, boss arena, weather and night, physics and hover, portal vault) tied by a 9-step chain, "The Foreman's
Yard", ending at the Crate Titan; rows K0–K8, about 10–12 lane-days. K0 (name and boss, G526/G528) is the only row that
was done, and it carries over.
