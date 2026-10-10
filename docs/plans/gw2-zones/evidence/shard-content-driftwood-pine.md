# Content audit: Driftwood Isle and Pine Hollow at the `pre-normalization` tag (2026-09-30)

> **State:** evidence for [../GW2-ZONES.md](../../GW2-ZONES.md), written 2026-10-01 from singleplayer at tag `pre-normalization` (`dcd6a29a`, 2026-09-30). Read from code and docs; nothing was played, so every minute figure is an estimate.

Read-only audit of the game content (not the tech). Every path is in the singleplayer repo at tag `pre-normalization` (read with `git show pre-normalization:<path>`)
unless it is an archived plan, which was read with `git show pre-normalization:project/archive/<file>`.
"Verified" means the claim was traced in code. "Inferred" means it is my reading of code or plans and was not run.

Sources read in full: both blow-by-blow texts (the blow-by-blow PDFs in singleplayer `docs/`), `docs/SHARDS.md`, both chunk defs, every Driftwood
quest/loot module, Pine Hollow's quest data and runtime headers, the boss, elite, contract, trade, weather and life
headers, the archived plans (Driftwood remaster, top-10, slop sweep, loot; Pine Hollow remaster, follow-ups), the live plans
(`DRIFTWOOD-REMASTER-V2`, `FINISH-LINE`), the E108 audits (`docs/design/audit-e108/`), and the 373 ask files (first lines plus
the relevant ones in full).

---

## 0. Summary

| | Driftwood Isle | Pine Hollow |
|---|---|---|
| Genre | Zelda-like, sword-melee island adventure, low-poly toon | Photoreal ranged hunting sandbox with a folklore quest on top |
| Main quest | *The Sealed Ring*: 4 steps, 3 puzzle POIs, 1 boss, a reward view, a "complete" card | *The Warden's Hollow*: 7 steps (3 lanterns, a zipline, a ghost-stag lead, the boss, dawn) |
| Completable in code | **Yes, traced end to end**, with a fail-safe if the boss fails to spawn | **Yes, by flags**. Two night-gated steps and no checkpoint respawn add friction (inferred) |
| Bosses | 1 (the Drowned Captain, 3 phases) + 1 mini-boss (the drowned sailor) | 1 (the Antler King, 3 phases, can be fought again) + 4 named elites (20-min respawn) |
| Hostile population | ~33–37: 11 boars, 2 bears, 7–11 crabs, 9–12 monkeys, 1 sailor | ~168 herd animals (deer, boar, elk; boars and bears fight), 3 den bears, 4 elites, nightly thralls |
| NPCs / dialogue | Wendell (13 lines), Maren the trader (no dialogue, shop only) | Hale (19 lines), Brandt the miller (8), Mott the trader (3); generated voice barks |
| Collectibles | 15 sea glass, 3 glyph shards, 9 places, 1 dive treasure, 3 trophies, 3 charms, 2 cosmetics | 30 amber resin, 8 carved tokens, 3 secrets, 18 places, ~17 journal creature pages, 7 trophy-wall mounts, 7 weapon finishes |
| Economy | Doubloons from kills, **capped per enemy** (92 coins total), 6 permanent shop goods (90 coins) | **No currency**. Item swaps with Mott; rotating lodge contracts pay ribbons, resin and bolts |
| Repeatable | Enemies respawn but pay nothing. No repeatable quests | Endless contract board, elites every 20 min, King re-fight every night, nightly thralls, weather |
| First-time "see everything" | **~60–90 min** (quest ~25–40 min) | **~2.5–4 h** (quest ~40–70 min) |
| Replay value | Low: no save reset in the UI and no reward loop after 100 % | Medium: a hunting sandbox with a contract loop and rare-variant hunting |

---

# PART A: DRIFTWOOD ISLE

Definition: `src/chunks/driftwood-isle.ts` (`style: 'lowpoly'`, `weapon: 'sword'`, `ocean`, `loot: { coins: true }`,
`maxHitDamage: 20`, `fightRules: { maxAttackers: 2 }`). The adventure is wired by `installDriftwoodAdventure` in
`src/game/quest/Adventure.ts`, and the shard's extras in `src/main.ts` sit under `if (chunk.ocean)` / `isOcean`.

History in brief. A pier, a sword and enemies were built in one night (2026-09-18, the blow-by-blow). The E7 audit then
found **"~5 minutes of content"**: "One pickup (iron sword). No quests, NPCs, chests, keys, doors, collectibles,
secrets; no Driftwood achievement table; nothing respawns" (`project/archive/2026-09-23-driftwood-remaster.md` §1). The
v0.2 remaster (2026-09-23) set a target of **"20–30 minutes of island adventure"** and built Track A (quest, kit, puzzles,
collectibles, map, ecology, zipline). The top-10 (E126), slop sweep (E318) and loot (E314) passes followed on
2026-09-29/30.

## A1. Quest and story

**One quest: *The Sealed Ring*** (`src/game/quest/driftwood.ts`, `DRIFTWOOD_QUEST`, id `sealed-ring`), on the shared quest
schema (`src/game/quest/quest.ts`; the current step is the first one not done).

| Step | Objective (verbatim) | How it is done | Flags |
|---|---|---|---|
| intro | "Find out who lit the fire on the plateau" | Walk ~38 s from the spawn halfway down the pier (E308) to Wendell's campfire below the hut | `talked:castaway` (raised when the first dialogue ends) |
| 1 `shards` | "Recover the glyph shards · n / 3" | Three puzzles (below) | `shard:lookout`, `shard:wreck`, `shard:cave` |
| 2 `shrine` | "Set the shards in the Ring Shrine" | The altar at the NW shrine (needs all 3 shards) | `used:altar` |
| 3 `captain` | "Defeat the Drowned Captain" | The boss rises from the shrine's spring pool | `dead:captain` |
| 4 `reward` | "Stand in the ring" | Walk within 7 m of the computed spot. The camera eases to frame the ringed planet in the stone ring and the clock eases to golden hour; after a 7 s hold the quest completes (`src/game/quest/Finale.ts`) | `seen:reward` → `quest:driftwood-done` |

**The three shard puzzles** (`src/world/interact/driftwood.ts`, `DRIFTWOOD_INTERACT`):

- **LOOKOUT.** Wendell's sea chest in the hut (needs `talked:castaway`) gives flint & steel (`has:flint`) and 2 doubloons.
  Climb the lookout tower on the NE headland and light the beacon (needs `has:flint`, sets `lit:beacon`). The shard then
  appears on the platform.
- **WRECK.** The drowned sailor rises in the hold and guards it. Killing him moves the hold key to where he fell
  (`Spine.ts` `chainKill` → `kit.moveTo('hold-key')`, `dead:sailor`). The key unlocks the bilge pump (lever), the pump
  unjams the winch (lever), and the winch raises the strongbox, which holds the shard and 3 doubloons.
- **SEA CAVE.** A sluice gate under the waterfall opens only while both tide plates are held at once: you stand on one and
  push the washed-up barrel (`tide-barrel`, a 36 m leash with a reset) onto the other. The gate latches open and gives the
  shard.

**Completable end to end: yes (verified).** Every gate has a raiser:

- The chest needs `talked:castaway`. The beacon needs `has:flint`. The shard needs `lit:beacon`.
- The key comes from `dead:sailor`. The pump needs `key:hold`. The winch needs `lever:hold-pump`. The box needs `winch:up`.
- The sluice needs both `plate:` flags. The cave shard needs `open:sluice`. The altar needs all 3 shards.
- `used:altar` makes `Finale.ts` spawn the captain. His kill sets `dead:captain`. The proximity trigger then sets `seen:reward`.

The table is validated by `validateTable` (`src/world/interact/validate.ts`, run in `test/interact.test.ts`). It checks
that every read flag is raised and every lock has a key. There is a fail-safe: if the captain's spawn throws, `Finale.ts`
sets `dead:captain` itself ("never strand the quest"). A reload mid-fight puts him back under the pool. The audit E108
(`docs/design/audit-e108/game.md`) calls Driftwood "the only shard that plays like a game". E288 confirms that every
quest step has a touch control (that check was on Nalati, but it shares the same HUD).

**The ending** (`src/game/quest/Complete.ts`, `src/ui/ShardComplete.ts`, E132): a "Driftwood Isle complete" card shows:
- time played, achievements n/10, shards 3/3, sea glass n/15, places n/9, the worn title;
- up to 7 "still to find" chips;
- three buttons: KEEP EXPLORING, NEXT SHARD (Nalati), TITLE SCREEN.

After the quest the quest chip becomes "Still to find", pointing at the nearest unfound sea glass, place or treasure.

**Side quests: none.** There are no repeatable quests and no daily or rotating content. The only post-quest goals are
the collectibles, the achievements and the shop.

**Story volume:** a one-paragraph premise. Wendell, marooned when the *Gull's Lament* broke up in the cove, found the
sealed ring door, and Captain Brine "sank with the ring's secret". Captions: "The Sealed Ring · opened" / "The planet in
the ring, at golden hour".

## A2. Bosses and mini-bosses

| Name | File | Trigger | Moves / phases | Arena | Reward | Respawn |
|---|---|---|---|---|---|---|
| **The Drowned Captain** (Captain Brine), 320 hp, scale 1.35 | `src/entities/species/captain.ts` (mesh: `captainMesh.ts`, Hunyuan3D generated), `src/game/quest/Finale.ts` | Using the altar (`used:altar`): "The pool boils — the Drowned Captain rises!" | **I** (100–66 %): wades at 1.2 m/s; 0.7 s overhead wind-up; cut hits 24 inside 2.5 m (capped to 20 by `maxHitDamage`, but he is in `hitCapExempt`, so he hits harder). **II** (66–33 %): every ~7 s he sinks (1 s, untouchable), a bubble ring telegraphs where he will surface for 1.1 s, then bursts up for 16 within 3 m. **III** (< 33 %): enraged, 1.7 m/s, 0.5 s wind-ups, double cut, sinks every ~5 s | The shrine's spring pool; leashed to 22 m (`mem.arena`); a boss bar (`QuestUI.BossBar`) while you are within 22 m | Opens the reward step; 25 doubloons (`coins.ts`); drops the **captain's hat** cosmetic (`keepsakes.ts`); "Shore Leave"-style kill counted | **Never** (excluded from `Ecology`; "he only dies once"). There is no re-fight. |
| **The Drowned Sailor** (mini-boss), 60 hp | `src/entities/species/sailor.ts`, placed by `src/entities/Enemies.ts` `placeSailor` | Hides under the wreck's broken deck; rises over 1.5 s when you come near | Shambles at 1.1 m/s while you stay in the hold's guard radius; a 0.6 s cutlass wind-up, then 14 within 1.9 m; does not chase down the beach. E296 made enemy hits need physics line of sight (no hits through beams) | The wreck's hold | Drops the hold key (the quest). Guards the **iron sword** on the hold's rack (`src/game/quest/guards.ts`; once taken it is saved in Owned `iron-sword`, E314). 5 doubloons once. "Shore Leave" achievement | **3 min after a kill, only at night** (`Ecology.ts` `RESPAWN.sailor = { delay: 180, night: true }`) |

The brown bear (320 hp, alone in the SE palm grove) works as an optional "trophy fight". The slop sweep (row 33) kept it
only because the loot plan's L4 gave it a purpose: the bear claw trophy.

## A3. Enemies (all hostile)

Fight rules for Driftwood only (E297, E294):
- at most 2 attackers at once;
- boars circle back instead of fleeing;
- an amber edge chevron warns of an off-screen wind-up;
- no single hit takes more than 20 of your 100 health (the captain is exempt);
- enemy hits need line of sight.

| Species / variants | Count (from code) | Where | AI archetype | HP | Respawn (`src/game/quest/Ecology.ts`) |
|---|---|---|---|---|---|
| **Boar**: boar / sow / black / big (E318 cut Pine Hollow's Scarback and Old Ironhide) | **11** in 3 sounders: 4 on the south beach (66, −132), 3 on the west back-beach (−140, −30), 4 in the north grove (30, 150) (`driftwood-isle.ts` `fauna`) | Beaches and groves | Charger. Sees you from 42 m on open sand (`faunaTuning`); charges, backs off to a 6.5 m ring, circles, charges again | 70–140 | 5–7 min, at the herd home, out of sight (> 60 m) |
| **Bear**: brown | **1**, SE palm grove (56, −84), ~70 m off every path (E294) | Jungle grove | Territorial hunter: stalk, then a 9 m/s charge | 320 | 10–15 min |
| **Bear**: black / black-blaze | **1**, SW back beach (−122, −100), moved away from the shrine (E318) | Back beach | Same | 220 | 10–15 min |
| **Reef crab**: small 25 hp, big 70 hp | **2 tidepool groups × 3–5** (`Cove.ts` `crabSites` (130, 5), (132, −9); `Enemies.placeCrabs`), one big per group, plus **1 practice crab** on the path at the pier's foot (E308). `shop.ts` counts 9 | Wreck Cove tidepools | Sidestepper: strafes at 1.3 m/s; 0.5 s claw wind-up, snap for 10 (14 for a big crab). **Hard shell**: frontal hits do 50 %, so flank it. The small crabs scatter when the big one dies | 25 / 70 | 4–6 min. The practice crab returns 45 s after a kill once you are 30 m away |
| **Coconut monkey**: monkey 30 hp, grey elder 45 hp | **3 troops × 3–4** in the densest palm groves (`Enemies.placeMonkeys`). `shop.ts` counts 11 | Palm crowns | **Ranged**: lobs coconuts (8 damage, physics balls) from 14 m every 2.5–4 s. Stand under its palm more than 2 s and it drops, chases at 3.2 m/s, bites for 6, then climbs back. The troop flees to another palm when one dies | 30 / 45 | 5–7 min |
| **Drowned sailor** | 1 | Wreck hold | Guardian (above) | 60 | night, 3 min |
| **Drowned Captain** | 1 (quest) | Shrine pool | Boss (above) | 320 | never |

**Totals:** ~34 hostiles alive at any time. `shop.ts` `FULL_CLEAR = 92` coins counts 11 boars, 2 bears, 9 crabs, 11
monkeys, 1 sailor and the captain.

**Weapon pressure** (inferred from `src/player/SwordMoves.ts`):
- The wooden sword does 12 per hit (combo 12 / 12 / 16), and the charged heavy does 24.
- The iron sword's base is 28 (`Sword.ts`; the remaster plan quotes "Iron sword swing, 28 dmg").
- Whetstones give ×1.25 / ×1.5. The bear claw gives the heavy +20 %.
- So the brown bear and the captain take roughly 25 wooden hits each, or about 11 iron hits.

## A4. Neutral and ambient life, NPCs, dialogue

| Who | File | What |
|---|---|---|
| **Wendell, castaway** (the quest giver) | `src/entities/npc/Castaway.ts`, data `CASTAWAY` in `src/game/quest/driftwood.ts`, `Spine.ts` | At his campfire below the hut. Waves when you come within 16 m, turns to face you (E129), and you stow your sword while he talks. **6 dialogue states, 13 lines in total** (intro 5, after talking 2, all shards 2, altar used 1, captain dead 1, quest done 2). This is the only voice in the shard. |
| **Maren, the trader** | `src/game/quest/TraderStall.ts`, model `src/chunks/driftwood-isle/models/trader.ts`, `src/entities/npc/Trader.ts` | Stands at a counter west of the hut steps. "Trade with Maren" opens the shop screen (`src/ui/ShopPanel.ts`). **No dialogue** ("she only trades"). |
| Gulls | `src/world/Gulls.ts` (up to 36, one instanced draw) | They perch on posts and fly in flocks. **Gull guide** (E309): after 50 s with no progress or 10 s idle, three gulls fly toward the nearest undiscovered place (90 s cooldown) (`src/game/quest/gullGuide.ts`). |
| Reef fish school, coral, starfish | `src/world/Seabed.ts`, `models/reef.ts`, `models/reefFish.ts` | Decoration for diving ("diving: just decorative stuff", the 01:29 steer in the blow-by-blow) |
| Fireflies, glyph glow | `src/world/Shrine.ts` (90 fireflies, `setDusk`) | Driven by the day clock |
| Deer | removed (E318: "a temperate game animal on a tropical island") | — |

There are no passive or neutral land animals: every land creature on the island is hostile.

## A5. Collectibles and exploration rewards

| Thing | Count | Where / how | Pays out |
|---|---|---|---|
| **Sea glass** | **15** (`GLASS` in `driftwood.ts`, mostly along the sand paths) | Walk-in pickups; toast "Sea glass · n / 15" | Every 5 pieces a **sea glass charm** is strung on the hut chime (`src/game/loot/keepsakes.ts`, `perks.ts`): I = +10 max health, II = dodge recharges 30 % faster, III = the held sword glows aqua at night. "Beachcomber" achievement at 15 |
| **Glyph shards** | 3 | The quest | "Shardkeeper" |
| **Named places** | **9** (`src/game/quest/Places.ts`): the pier, Wendell's hut, the vista point, the rope bridge, the zipline, the lookout, Wreck Cove, the sea cave, the Ring Shrine (the N/W landings were cut, E318) | Walking into the radius discovers a place: a saved `seen:` flag, a toast, its name on the map ("PLACES n / N"). Undiscovered places show as dashed "?" rings | Also the **death checkpoint** (`src/game/LastPlace.ts`, E295) |
| **Reef treasure** | 1 chest at (232, 48), on the deepest shelf; you must dive (reach 1.6) | — | 8 doubloons, "Pearl Diver" |
| **Vista bench** | 1, on the plateau rim | Sit, and the camera turns to the view: "You sit a while. The sea goes on and on." | "Take a Seat" |
| **Trophies** (`keepsakes.ts`) | 3 | **Bear claw** (the brown bear's drop) gives the heavy +20 %. **Boar tusk** (any boar's drop) gives dodge i-frames. **Captain's hat** (the captain's drop) is a cosmetic | Plaques on the hut's back wall fill in |
| **Cosmetics** | 2: the captain's hat and the sailcloth cape (from the shop) | Worn from the Bag's GEAR tab; they show on the body shadow (`src/player/BodyShadow.ts`) | — |
| **Achievements + titles** | **10** (`src/game/achievements.ts` `DRIFTWOOD`). Each pays a joke title shown on the menu (e.g. "Ringbearer", "Crabby", "Held Breath Champion") | Talk to Wendell; 3 shards; open the ring; 15 sea glass; the dive treasure; the vista bench; the zipline; beat the sailor; 10 crabs; 6 monkeys | Titles are cosmetic and "only mean something in multiplayer" (E140) |
| **FINDS tab** (the sticker book) | `src/game/loot/finds.ts` | Counters for sea glass, places and shards; trophies and treasures; "next charm at n" | — |
| **Iron sword** | 1, on the wreck hold's rack, guarded by the sailor | `src/player/IronSword.ts`, `IronSwordPickup` in `main.ts` | Kept across sessions (Owned `iron-sword`) |

There are no lore notes, readables, secrets proper, hidden rooms or alternative routes.

## A6. Points of interest, landmarks and traversal

**Landmarks** (`driftwood-isle.ts` constants; builders in `src/world/` and `src/chunks/driftwood-isle/models/`):
- **Pier** (south, the spawn) with the moored **sailboat**, which does not sail: E318 deleted Wendell's line promising it.
- **N / W / E jetties**: the mandated entry roads, which lead to empty beach (E318).
- **Plateau + thatched stilt hut**: an interior with the sea chest, the trophy plaques and the chime over the door.
- **NE headland + lookout tower**: a stair, the beacon, the banner.
- **Tidal creek gully + swaying rope bridge**: the camera sways while you cross (`Adventure.ts`).
- **Wreck Cove**: a beached two-master with an enterable hold, a waterfall cascade, a sea cave behind a sluice, tidepools.
- **Ring Shrine** (NW knoll): stone ring, altar, spring pool; the ring frames the ringed gas giant.
- **Vista point**; plank stairs, rope fences and lettered signposts (E318); hibiscus bushes; palms; the coral reef; the
  ringed planet in the sky.

**Traversal toys:**
- **Swimming and diving.** DIVE / SURFACE buttons, no drowning, no stamina (`src/player/Player.ts`; the user said "swim
  forever").
- **Zipline** from a launch deck on the headland lip down to the cove beach, 57 m (`src/world/Zipline.ts`;
  "Zip It").
- **Rope bridge.**
- **Double jump.** Kept because it is how you climb back onto the pier from the water (E318 row 36).
- **Hoverboard** (H / HOVER, on every shard, 14 m/s, rides over the sea and climbs slopes). It skips the paths, the bridge
  and the zipline (E318 row 3); E140 kept the "Hover tab" as a player feature.
- **Dodge** roll and **lock-on** (E50).

**Edge.** A staging boundary force field runs at the chunk edge, underwater too, and stays on for every player (E140).
The **cliff slope limit** (> 53°) stops you walking up crags.

## A7. Systems the player touches

| System | State on Driftwood | Path |
|---|---|---|
| Weapons | Wooden sword; the iron sword (found). A 3-hit combo, a charged HEAVY, lock-on, dodge, hit-stop, camera kick, trail, impact particles. Remastered castaway arms (E334) | `src/player/Sword.ts`, `SwordMoves.ts`, `src/chunks/driftwood-isle/fpArms.ts` |
| Loot | **Doubloons only**: kills burst coins that fly to you (crab 1, monkey 1, boar 2, sailor 5, bear 10, captain 25). **Bounty cap**: each starting enemy pays once, so respawns pay nothing. No harvest and no junk (E314 L1) | `src/game/loot/coins.ts`, `CoinBurst.ts`, `Bounty.ts`, `Purse.ts` |
| Shop | **Maren, 6 permanent goods, buy-only, 90 coins total** (Whetstone I 12 / II 22; Sturdy Heart I 14 / II 22, for 120 / 140 max health; Sea chart 12, which marks unfound sea glass; Sailcloth cape 8). One full clear earns 92 | `src/game/loot/shop.ts`, `src/ui/ShopPanel.ts` |
| Perks | Charms I–III, bear claw, boar tusk (above) | `src/game/loot/perks.ts` |
| Bag | MAP · GEAR · FINDS · PACK · FEATS. The pack is practically empty: no harvest | `src/ui/Menu.ts`, `src/ui/bag` |
| Progression | No XP, levels or skill tree. Power comes only from the shop, charms, trophies and the iron sword | — |
| Persistence | localStorage per shard: quest and world flags (`ws.flags.v1`), Owned (`ws.owned.v1`), purse, bounty (`ws.bounty.v1`), progress and titles (`ws.progress.v1`), inventory. **There is no player-facing reset or new game**; only the dev `?resetquest` | `src/world/interact/flags.ts`, `src/game/loot/store.ts`, `src/game/Progress.ts` |
| Day / night | A 48-minute cycle (40 min day + 8 min night, E147). It drives the sailor's night respawn, the shrine glow and fireflies, the jungle crickets, and charm III's glow. The finale eases to golden hour | `src/world/DayNight.ts` |
| Weather | **None** (`src/world/Weather.ts` is Nalati's steppe storm) | — |
| Death | A ~1.8 s fade and a "Mauled by a brown bear · respawning at Wreck Cove" card; respawn at the last place you discovered (E295) | `src/ui/DeathFade.ts`, `src/game/LastPlace.ts` |
| Onboarding | First-time hints for MOVE, JUMP, ATTACK, LOCK, DODGE and TALK, triggered by context; the practice crab | `src/chunks/driftwood-isle/firstMinutes.ts`, `src/ui/FirstHints.ts` |
| Music and sound | The island stem slot (MiniMax Music 3 styles: piano, orchestral, folk; synth fallback), adaptive calm / alert / combat / underwater, stings; zoned ambience with reverb zones (hold, cave, shrine); full combat and interact SFX | `src/audio/Music.ts`, `IslandAmbience.ts`, `IslandSfx.ts`, `ShrineHum.ts` |

## A8. Living world

- **Respawns** (`Ecology.ts`): every killed crab, monkey, boar or bear is replaced at its herd home 4–15 min later, out of
  sight. The sailor comes back only at night. There is **no economic reason to fight them** (bounty cap), and no
  achievement needs more than 10 crabs or 6 monkeys.
- **Day / night**: the sailor at night, the shrine glow and fireflies at dusk, the crickets.
- **Dynamic behaviour**: monkey troops flee to other palms, crabs scatter when the big one dies, coconuts roll and float.
- **No timed events**, no dynamic events, no weather, no world-state change after the quest except the open ring.
  Wendell's last line: "Stay as long as you like, friend."
- **Reasons to return:** finishing collectibles and achievements, and the shop. Once those are done, none.

## A9. Minutes of content (estimate)

Distances from the def:
- spawn → Wendell: 38 s walking / 22 s sprinting (E308);
- hut → lookout: ~200 m over the bridge;
- lookout → zipline → cove: fast;
- wreck → cave: adjacent;
- cove → shrine: ~280 m (~65 s walking at 4.3 m/s, ~40 s sprinting at 7.2 m/s).

| Activity | First-time minutes | Why |
|---|---|---|
| Arrival, practice crab, Wendell, the chest | 3–5 | Measured walk times plus 13 lines of dialogue |
| Lookout shard (walk, climb, beacon) | 3–5 | ~200 m plus the tower |
| Wreck shard (sailor fight, key, pump, winch, box) | 5–8 | A 60 hp guardian plus a 3-step lever puzzle; E108 died here twice before the fixes |
| Cave shard (barrel push onto the plate) | 3–6 | A physics push puzzle with a 36 m leash |
| Shrine + Captain (320 hp, 3 phases) + reward | 6–12 | ~25 wooden-sword hits or ~11 iron hits, sink / burst dodging, likely deaths (no checkpoint other than the last place) |
| **Main quest total** | **~25–40 min** | Matches the remaster's design target of "20–30 minutes" for a skilled player |
| 15 sea glass + 9 places + the dive treasure + vista + zipline | 15–25 | The pieces sit mostly along paths; the sea chart (12 coins) marks the rest; the treasure is a dive off the far east shelf |
| Achievement kills (10 crabs, 6 monkeys), a full clear for 92 coins, all 6 goods, 3 trophies | 15–25 | One full clear of ~34 enemies, and the 10th crab may need a respawn (4–6 min) or the practice crab |
| **Everything (100 %)** | **~60–90 min** | — |

**Replay value: low.**
- There are no repeatable activities with rewards: respawns pay nothing, and there are no quests, contracts or events.
- There is no new game or save reset in the UI.
- The complete card's "Keep exploring" leads to an island whose goals are all checked.
- The best replay hook is pointing the player at the next shard (NEXT SHARD → Nalati).

## A10. Stubbed, planned-but-not-built, broken (Driftwood)

| Item | Source | State |
|---|---|---|
| Polish leftovers for Jake's eye: the chime reads small from the path; a white foam patch on a flat palm while swimming; the swim sleeves vs board 3 A | `docs/tasks/asks/E351.md` | **needs you** |
| A real TROPHIES screen in the Bag (the Achievements tab stands in for it) | E164 | **open** |
| Trails test: 10 stuck points on main (path 1 near x 12–17, z −10…−26 and near (90, 90); paths 2 and 3) against a 0-stuck bar | E354 | **open**: a walkability bug on the quest paths |
| Stale navmesh after E114's boulder change | N26 | open (E318 later reported `--check` up to date, so possibly stale) |
| Perf loose ends: a ~25 ms first-turn hitch on the mooring ropes; 43 fps at ~110 m altitude | E165, E198 | open |
| Ranged lock-on for the bow / crossbow | E75 | open (not Driftwood-specific) |
| Visual picks: rock style B on the big crags (E163); PCSS shadows (E166); 1 px chunk-boundary scratch lines (E170) | E163, E166, E170 | needs pick |
| Day/night "not built" | D38 | **stale**: it is built (`DayNight.ts`); FINISH-LINE says so |
| DRIFTWOOD-REMASTER-V2 open rows, unowned since 2026-09-23: **V-B1** the Blender island island-wide (only the spawn cove is Blender today, `src/world/blenderArea.ts`), V-B2 procedural vs Blender pick, V-B3 low-res cove lightmaps, **V-U3** the captain's stance, V-L1 9-angle loops for the hut / wreck / shrine / lookout, V-L2 water leftovers, **V-M1** creatures remodelled by image-to-3D, V-M2 a wreck hero asset, V-P1 perf ≥ 55 fps | `docs/plans/DRIFTWOOD-REMASTER-V2.md` | in progress, unowned |
| E334 iPhone memory reading for the castaway arms | top-10 archive | open (needs the phone) |
| FINISH-LINE M1 (continue + a shard map with progress on the title), M2 (titles and trophies across shards), S1 (golden-path play test) | `docs/plans/FINISH-LINE.md` | draft, never approved |
| The boat does not sail; the N/W jetties lead nowhere (kept for the chunk fundamentals) | E318 rows 8, 9 | by design |
| Wendell and the trader say nothing after the quest beyond 2 lines; Maren has no lines at all | `driftwood.ts`, `TraderStall.ts` | thin |

---

# PART B: PINE HOLLOW

Definition: `src/chunks/pine-hollow.ts` plus `src/chunks/pineHollowLayout.ts` (every coordinate). Default style PBR;
weapon crossbow. The game layer is in `src/pinehollow/`, installed from `main.ts`
(`installPineQuest`, `installPineWeather`, the elites and King, the loadout, life). Pine Hollow is **not** in
`ADVENTURES` (`Adventure.ts`): it has its own installer on the same quest kit.

History in brief:
- The original shard (16–17 Sep) was a hunting sandbox: 4 species, a crossbow, harvest, 3 cabins.
- E108 (2026-09-24) scored it **3/10**: "still the 17 September tech demo: no quest, no NPC, only kill counters".
- The 24-hour mega-remaster (PH-U1…U35, `project/archive/2026-09-25-pine-hollow-remaster.md`) landed on main as
  `18b3d6be` with the finish-line goal "Content is on Nalati's level".
- It then ran at 14 fps on Jake's phone. E142 and E143 brought calm play to 30 fps and cut the forest from 1,666 to 962
  trees ("green, green, green foliage").
- E322 and E350 did follow-up sweeps. The follow-ups plan was archived on 2026-09-30 "on Jake's word".

## B1. Quest and story

**Main quest: *The Warden's Hollow*** (`src/pinehollow/quest/wardensHollow.ts`, `WARDENS_HOLLOW`). Interactables are in
`table.ts`; the runtime is `index.ts` (605 lines).

| Step | Objective | How | Gate |
|---|---|---|---|
| intro | "Find the ranger at his cabin in the Hollow" | South gate (0, −235) → the ranger's cabin (−14, −34), ~200 m | `talked:ranger` |
| 1 `pond` | "Relight the pond lantern" | **The beaver-dam puzzle**: heave two logs off the sluice (a lever on each bank). The sluice lifts and the beaver pool drains (`src/world/BeaverPool.ts`). The lantern glass washes onto the gravel; carry it to the waystone on the west shore | `taken:pond-glass` → `lit:pond` |
| 2 `ridge` | "Relight the ridge lantern" | Climb the fire lookout (36, 214) by the long graded lookout trail; take the fire-watcher's flint from the fire finder in the cab; light the waystone at the stair foot | `taken:ridge-flint` → `lit:ridge` |
| 3 `zip` | "Ride the zipline back to the Hollow" | A 197 m zipline down to the landing at (4, 20) (`quest/rides.ts` `ZipRide`) | `used:ph-zip` |
| 4 `den` | "Relight the den lantern" | The bear cave's mouth in the NW Den (196, 196); **Old Blackpaw ambushes** you from the cave | `lit:den` (needs only `talked:ranger`) |
| 5 `stag` | "Follow the Ghost Stag after dark" | After dark, a pale apparition leads you down the west road through the stones' gap into the King's clearing (`quest/stagLead.ts`). Hale offers to "sit a while" and fast-forwards the clock to night in 6 s (`wait:night`) | `followed:stag` (night only) |
| 6 `king` | "Face the Antler King" | The open-world boss fight, at night, in the clearing (150, −30). The quest only counts his death, whenever it happens | `dead:king` |
| 7 `dawn` | "Dawn over the Hollow" | Scripted: the clock fast-forwards to sunrise, every lantern on the shard lights, the dawn sting plays, the caption "Dawn over the Hollow · Every lantern burns. The fog is going home.", then 4 amber resin and "the Warden's bow is yours to keep" | `seen:dawn` → `quest:warden-done` |

**Completable end to end: yes by flags (verified)**, with three caveats (inferred):

1. **Night gating.** Pine Hollow's clock is **24 min (20 day + 4 night)** (`src/world/PineDayNight.ts`). The stag
   step and the King both need night (> 0.5).
   - Hale's fast-forward is offered only by his "three lanterns lit" dialogue entry.
   - Once you have followed the stag, his higher-priority entry no longer sets `wait:night`. If the night runs out
     before the King's fight starts, you wait up to ~20 real minutes for the next night.
   - A fight already started continues past dawn: `disarm` only happens from `armed` / `victory`
     (`antlerKing.ts:676–678`).
   - Settings ▸ Time of day is a developer-mode row.
2. **No death checkpoint outside the boss.** `LastPlace` is built only from `adventure.places`. Pine Hollow has no
   `ADVENTURES` entry, so `placePts` is null (`main.ts` ~950) and **a death anywhere outside the King's arena respawns you
   at the south gate**. The Den, for example, is ~470 m away in a straight line (council B8), more by trail.
   - The King's fight has its own per-phase checkpoints (`src/game/Boss.ts`).
3. The brief says Jake has not completed this quest; the asks hold no direct complaint about why. The most likely
   friction is the length, the night gating, the two ~300 m crossings between the Den and the Hollow, and the fight frame
   rate (F-P6). This is inference.

There is a dev jump to any beat (`?quest=<beat>`, `quest/beats.ts`). The chain is unit-tested in `test/pine-quest.test.ts`
(per the table header).

**Side content:**
- **The miller's errand** (Brandt, `MILLER`): "Clear the race after dark". Three thralls stand in the millrace at night;
  kill all three → `errand:done`. The mill wheel turns again and the barred mill door opens (F-M7). Brandt pays 3 lodge
  ribbons and 4 amber resin; "Grist for the Mill".
- **The lodge contract board** (`src/pinehollow/quest/contracts.ts`): **endlessly repeatable**. Three slots, each one of:
  - species: 3 deer, 3 boar, 2 elk or 1 bear;
  - rarity: 2 uncommon or 1 rare;
  - a named elite;
  - "cull 3 thralls".

  Claim a filled contract at the board and it pays lodge ribbons, amber resin and bolts; the third claim ever also pays
  the Hollow Ash finish. Tearing one down redraws it and resets the streak. The draw is a deterministic hash, so there is
  no clock and nothing to reroll by reloading. "Lodge Regular" means 5 claims in a row.
- **Mott's trades** (`quest/trades.ts`): 7 swaps (below).

**Story volume:**
- Hale's 4-line intro: the three waystones went dark the night the fog came out of the old-growth; "something walks the
  big trees after dark. Antlers of light"; animals "come out wrong: moss on them, glass for eyes".
- The tone is eerie folklore (PH-U20). No lore notes (PH-U22 cut them).

## B2. Bosses and elites

**The Antler King, Warden of Pine Hollow** (`src/pinehollow/antlerKing.ts`, 687 lines; its own upright rig
`kingRig.ts`, E322 F-M1; on the engine's `src/game/Boss.ts`; model `src/chunks/pine-hollow/models/antlerKing.ts`):

- **Trigger:** night only, within 80 m of the clearing, which arms the boss. Stepping inside the 7 standing stones closes
  a fog wall at r ≈ 31 with a soft push-back at r 27.5. The fog stays closed "until he falls or you do".
- **Phase I, the Warden (100 → 60 %).** Antler sweep with a ground ring telegraph, 0.9 s, 24 damage. Root-ring stomp:
  1.0 s wind-up, a ring of roots races across the clearing; jump it or take 20. After a stomp his **amber ribcage opens
  ~3 s**: ×3 damage there; shut ×0.6; bark and skull ×0.25.
- **Phase II, Lanterns Fall (60 → 30 %).** His three antler lanterns drop and burn as fire rings (9 per bite). He calls
  thralls 2 at a time, up to 3, which charge down lanes. Stomps come in pairs.
- **Phase III, the Last Light (30 → 0 %).** The clearing goes dark except his ribcage and your lantern. He charges down
  lanes, chaining 2–3, and the ribcage flares at each skid.
- **Fight furniture:** an intro name card, a phase-notched bar, per-phase checkpoints (die and you return to the stones'
  north gap with full health and bolts, at the start of the phase you reached), and the boss music's three phase stems.
- **Reward, once ever:** the gold orb with **the Warden's Longbow** (a draw-and-hold bow, drop arc, wind drift; Owned
  `warden-longbow`) plus the **Warden crossbow finish**. "The Last Light" achievement.
- **Respawn:** he is back **every night**. A re-fight pays 3 amber resin.
- **Known issues (F-X5, not picked):** a lane charge 3.5 m off his line grazes without hurting; side-on ribcage hits mostly
  don't register (0 of 5); a player under his belly isn't caught by the stomp ring.

**Four named elites** (`src/pinehollow/elites.ts` on `src/game/Elite.ts`):
- Shared rules: lair plus leash; the bar pins over the head; phase 2 at 50 %; a banner; a minimap skull; **20-min
  respawn**.
- Drops: the first kill gives a weapon-finish orb; every kill counts for the journal, the wall and contracts. The trophy
  items no longer enter the pack (E314 C).

| Elite | Lair | Signature / phase 2 | Drop (finish) |
|---|---|---|---|
| **Old Ironhide**, Terror of the Hollow (boar `ironhide`, 300 hp) | SW woods (−44, −76) | GORE CHARGE: a red lane tell 0.9 s, then 12.5 m/s for 30; a skid window. Phase 2 "BOTH TUSKS NOW": quicker, double charges | IRONHIDE rifle finish |
| **The Ghost Stag**, the Pale One (deer `ghost`, 130 hp) | Old-growth E fringe (62, −100) | Flees, circles, stares. FADE: unaimable 2 s, reappears behind you 14–18 m off. Phase 2 "NOW YOU DON'T": fades twice as often. Hidden in the dawn fog. Also the quest's lead | GHOST STAG crossbow finish |
| **Old Blackpaw**, the Den's Landlord (bear `black-old`, 330 hp) | The Den / bear cave (192, 188) | AMBUSH from the cave mouth within ~22 m; ROAR-STUN ring (1.1 s tell, roots 1.3 s, 12); charge lane or swipe for 22. Phase 2: roars twice as often, an 11 m ring | BLACKPAW crossbow finish |
| **The Imperial Bull**, Seven by Seven (elk `imperial`, 340 hp) | N meadow (−40, 78) | Postures at 18–26 m and charges down lanes for 34. BUGLE at dusk and night calls two rival bulls in from 55 m. Phase 2 bugles again | IMPERIAL crossbow finish |

## B3. Enemies and hunt animals

`fauna` in `pine-hollow.ts`: a seeded 56 m grid (`layoutFauna`, `src/chunks/fauna-layout.ts`) rolls one group per cell,
avoiding the pond, the cabins, the spawn, the hamlet, the King's arena, the Den and the crags. The weights are deer 36,
boar 32, elk 18, nothing 10. The remaster's B5 note puts it at **~168 animals at load**; `src/core/tier.ts` says ~150.

| Species / variants (rarity weight) | Count | Archetype | HP |
|---|---|---|---|
| **Red deer**: hind 46, stag 30, white hind 4, white stag 4, great stag 8, piebald 3 (rare), ghost 1 (legendary → the elite) | groups of 3–4 in clearings 10–25 m off trails | **Prey**: notices you, freezes, bolts. Sight and hearing tuning (`AnimalManager` `HuntTuning`). In rain the herds shelter under big trees (PH-C7) | ~60–130 |
| **Boar**: boar 49, sow 26, black 10, big 8, scarback 3 (rare), ironhide 1 (legendary → the elite) | groups of 2–3 under the canopy | **Charger** (`GroundTell` lane telegraph) | 70–300 |
| **Elk**: cow 50, bull 38, royal bull 8, pale 3 (rare), imperial 1 (legendary → the elite) | groups of 2–4, 15–40 m off trails | Mostly prey; bulls hold their ground | 160–340 |
| **Bear**: 2 black (black / black-blaze / black-old) + 1 brown (brown / brown-old "Grizzled Sow", 480 hp) | **3, all in the Den** | **Territorial hunter**: stalks, charges at 9 m/s (faster than your sprint) | 220–480 |
| **Thralls** (elk / boar `thrall` variant, moss coat, glass eyes) | **Night only**: up to 3 (phone) or 4 roam near the old-growth when night > 0.55, called in ≥ 45 m away and gone at dawn in a fog burst. 3 more in the millrace for the errand; up to 3 as King adds | Herd AI (boar charge, elk hold) | 140 / 220 |

Elites are swapped out of the random rolls (`swapRolledElites`), so each exists only at its lair. Herd animals have no
Ecology respawn table (that is Driftwood-only). The hunt loop is driven by elites, contracts, thralls and rare rolls.

## B4. Neutral life, NPCs, dialogue

| Who | File | What |
|---|---|---|
| **Hale, ranger of the Hollow** (the quest giver; picked from board B3 because the hat and beard hide the hair and mouth) | `RANGER` in `wardensHollow.ts`; generated and rigged figure (`src/chunks/pine-hollow/models/people.ts`, `quest/npcRig.ts`, `npcModels.ts`); new faces (E339 / E343) | **9 dialogue states, 19 lines** (intro 4, after talking 2, pond lit 2, ridge lit 1, zipline done 2, three lanterns lit 3, stag followed 2, King dead 1, quest done 2). The only clock control a player has: "sit a while" fast-forwards to night |
| **Brandt, the miller** | `MILLER` | **4 states, 8 lines**: the errand |
| **Mott, the trader** (voice re-rolled as a man, E141 / F-J3) | `TRADER`, `quest/trades.ts`, `ui.ts` (`TradePanel`) | **2 states, 3 lines** plus the trade slate |
| Text plus generated voice barks (PH-U23: no full voice acting) | `src/audio/PineHollowSfx.ts` | — |
| **Ambient life** (`src/pinehollow/life/index.ts`, not shootable) | ravens (2–3 come to every kill 18–52 s later and feed, and **breadcrumb flights** every 1.5–2.5 min toward the nearest place your journal has not seen); a great grey owl at night (glides off toward an unseen place); a pileated woodpecker by day; 5 snowshoe hares; fireflies over the pond | One instanced draw each |

**Total spoken dialogue: ~30 lines** across 3 NPCs, plus barks and toasts.

## B5. Collectibles and exploration rewards

| Thing | Count | Where / how | Pays out |
|---|---|---|---|
| **Amber resin** | **30** (`RESIN_SPOTS`), one per trail stretch, snapped to the nearest trunk ~1.1 m up, glowing, walk-in | A counter chip "AMBER RESIN n / 30" | The pack item: Mott's main swap good. "Sap Happens" at 30 |
| **Carved wooden tokens** | **8** (`TOKEN_NAMES`): the fire lookout, the hollow log, the islet, the King's stones, the waterfall, the ridge cabin, the mill hamlet, under the creek bridge | [E] pickups | All 8 put a pine rack of them on the ranger's mantel (`quest/tokenShelf.ts`); "Whittled Down" |
| **Secrets** | **3**: the vista bench on the lookout catwalk ("Sit and watch the far country"); the **hollow-log passage** (an 11 m rotted fallen giant you walk through to a hidden fern ring, `quest/hollowLog.ts`); the **canoe to the pond's islet** (`quest/rides.ts` `CanoeRide`) | — | "Off the Beaten Path" |
| **Places** | **18** POIs (`PINE_HOLLOW_POIS`): South gate, Crossroads, Ranger's / West / Ridge cabin, Zipline landing, Fire lookout, Still pond, Waterfall, The islet, Beaver dam, Creek bridge, The Den, Bear cave, King's clearing, Mill hamlet, Hunting lodge, Watermill; plus 6 zone labels | Visiting marks a journal page (the compendium's "visited") | The journal |
| **The hunter's journal** (the engine Compendium, skinned as a leather book; a tab in the Bag) | ~17 creature / elite / boss entries (`ui/compendium/shards/pine-hollow.ts`: species, colour variants, the elites, the King) plus 18 places, with 39 generated pencil sketches | Discovered (120 m) → seen (≤ 70 m, clear line) → taken (kill, kg) | "Field Notes" for every page |
| **Trophy wall** (board B4 wall C) | **7 mounts** in the ranger's cabin: the Ghost Stag, the Antler King, the Imperial Bull, Old Ironhide, Scarback, the Grizzled Sow, Old Blackpaw. Each is a chalk outline until taken | `src/world/TrophyWall.ts` | Examine → journal page |
| **Weapon finishes (cosmetics)** | **7** (`src/player/Skins.ts`): Ghost Stag, Ironhide, Blackpaw, Imperial (elite first kills), Warden (the King), Hollow Ash (a trade, or the 3rd contract), Scarback Furnace (a trade) | — | — |
| **Achievements + titles** | **19** (`achievements.ts` `PINE_HOLLOW`): kill 5 deer, 5 boar, 3 elk, 2 bear; the Ghost stag; Ironhide; Blackpaw; the Imperial Bull; the King; 3 lanterns; the quest; the zipline; 30 resin; 8 tokens; 3 secrets; a 5-contract streak; the miller; 10 thralls; the full journal | — | Joke titles ("Regicide, Rustic", "Morning Person, Finally") |
| **Loadout unlocks** | The lever-action (a pickup in a cabin; Owned `lever-rifle`); the Warden's Longbow (the King) | `src/pinehollow/loadout.ts` | — |

## B6. Points of interest and traversal

**Map A "the ridge north"** (`pineHollowLayout.ts`): **12 trails** (was 5) and **18 named places** (was 7).

- **The Hollow**: crossroads; 3 log cabins you can walk into (`src/world/Cabin.ts`); the ranger's cabin holds the trophy
  wall and the token mantel.
- **The Ridge**: a 42 m granite massif with crags and scree (`src/world/PineCrags.ts`); the fire-lookout tower on a +46 m
  crag; a 197 m zipline down.
- **Still Pond**: a waterfall fed by a ridge stream, the islet, a canoe.
- **The creek**: past the beaver dam (the puzzle), under the creek footbridge, past the watermill, off the south edge.
- **The Den** (NW) with a 36 m bear cave through a 1.6 m squeeze.
- **The old-growth** (44–52 m giants) with **the King's clearing** and its 7 standing stones, and the waystones.
- **Mill hamlet** (S): the hunting lodge with the contract board, Mott's stall, the watermill with its turning wheel, the
  miller's house, a shed.

**Traversal:** the zipline (ridden, scripted), the canoe ride, the hollow-log passage, swimming (shared player code),
the hoverboard (every shard), the graded lookout trail. There is no rope bridge, no climbing and no mount.

## B7. Systems the player touches

| System | State on Pine Hollow | Path |
|---|---|---|
| Weapons | **Ranged only** (PH-U15). Crossbow (hero; iron, pitch-tipped and broadhead bolts; R to span); lever-action rifle (Blender model, iron sights); the Warden's Longbow (hold to draw, drop arc, wind drift). Hit-stop, kick, trauma, debris (`src/pinehollow/feel.ts`); first-person gloved hands (F-M6). There is no melee and no lock-on for ranged weapons (E75 open) | `src/player/Crossbow.ts`, `LeverRifle.ts`, `Longbow.ts`, `src/pinehollow/loadout.ts`, `ammo.ts` |
| Ammo | Iron bolts refill to 30 on death and load; special bolts, cartridges and arrows are kept and traded for | `ammo.ts` |
| Harvest | [E] Harvest → a ~1.5 s **skinning beat** (kneel, knife, two strokes) → pack items | `src/pinehollow/life/index.ts`, `src/game/Inventory.ts` |
| Pack | **7 kinds**, one slot each, so it can never be full: venison, deer hide, boar hide, boar tusk, bear pelt, amber resin, lodge ribbon (`PINE_PACK_KINDS`). Everything else from a kill is dropped | `Inventory.ts` |
| Economy | **No currency** (PH-U16). Mott's 7 swaps: 2 deer hides → 10 bolts; 3 resin → 10 pitch bolts; boar hide + 2 resin → 8 broadheads; 2 venison + 1 resin → 14 cartridges; deer hide + resin → 10 arrows; bear pelt + 6 resin → Hollow Ash finish (once); 2 tusks + 3 ribbons + 8 resin → Scarback Furnace finish (once) | `quest/trades.ts` |
| Contracts | Endless rotating board (B1) | `quest/contracts.ts` |
| Progression | No XP or levels; power comes from the weapons and ammo types | — |
| Persistence | Flags (`ws.flags.v1`), Owned, the pack, the board (localStorage), the loadout (`ws.ph.loadout.v1`), compendium (`ws.compendium.v1`), boss reward (`ws.boss.v1`), progress. No reset in the UI | — |
| Day / night | A 24-min cycle (20 + 4) from 7 real sky photos; cabin fires, lanterns and windows follow the clock; fireflies | `src/world/PineDayNight.ts` |
| Weather | **Dawn ground fog** (a function of the clock: it gathers at the end of the night, burns off 1–3 min after sunrise) plus **rain** (clear 15–25 min → overcast → rain 3–6 min → clearing; the first shower comes sooner). Rain wets PBR materials, rings the pond, sends herds under trees and flattens pitch bolts' flight. No storms or snow (PH-U8) | `src/world/PineWeather.ts`, `PineWeatherFX.ts`, `src/pinehollow/weather.ts` |
| Death | A fade card; **respawn at the south gate** (no LastPlace on Pine); boss deaths go to the phase checkpoint | `main.ts` ~944–975 |
| Sound | Theme 1 (pine calm / tension) plus calm-night, the King's 3 phase stems and the dawn sting (MiniMax Music 3); zoned beds (creek, waterfall, mill wheel, cave) with interior reverb; a generated SFX sprite; barks | `src/audio/ForestAmbience.ts`, `PineHollowSfx.ts`, `src/pinehollow/audioWiring.ts` |
| Perf as a content limiter | Calm play holds 30 fps at 2× resolution after E142; **fights under 30 are unconfirmed on the iPhone** (F-P6) | E142, `project/archive/2026-09-30-pine-hollow-followups.md` |

## B8. Living world

- **Night** (4 of every 24 min): thralls roam the old-growth and flee at dawn; the King stands in his clearing; the
  millrace thralls (errand); the owl; the Imperial Bull bugles in rivals at dusk.
- **Dawn fog**: hides the Ghost Stag in a fog bank.
- **Rain**: herds shelter under the big trees.
- **Ravens** feed on your kills and then the carcass sinks.
- **Respawns**: elites every 20 min; the King nightly (re-fight for 3 resin); thralls nightly.
- **World-state changes**: lanterns lit one by one (and all at dawn), the beaver pool drained, the mill wheel turning and
  the mill door opened, the trophy wall filling, the token rack appearing.
- **Reasons to return:** the contract board (endless), rare-variant hunting for the journal and the wall (weights 1–5 %),
  elite re-kills, achievements, the "Lodge Regular" streak. There are no timed or real-clock events.

## B9. Minutes of content (estimate)

Distances from the layout:
- gate → Hale ~200 m;
- Hale → dam ~160 m;
- dam → west-shore waystone ~85 m;
- → lookout trail foot (150, 142) ~215 m, then a ~200 m climb;
- zip down to (4, 20);
- → Den (196, 196) ~260 m;
- → back toward the Hollow / west road ~250 m;
- the stag lead to the clearing ~150 m.

| Activity | First-time minutes | Why |
|---|---|---|
| Arrival, Hale, the dam puzzle, the pond lantern | 5–8 | ~450 m of walking, 2 levers, carrying the glass |
| The ridge: climb, flint, lantern, zipline | 5–8 | The longest climb in the game |
| The Den lantern + Old Blackpaw ambush (330 hp, ranged only) | 5–10 | An elite fight, likely deaths, and a death sends you ~470 m back (council B8) to the gate |
| Back to Hale, the night wait (6 s fast-forward, or up to ~20 min if missed), the stag lead | 3–6 (or +20) | Night gating |
| The Antler King, 3 phases, with checkpoints | 8–20 | A full set-piece; F-X5 hit-registration issues |
| Dawn sequence + reward | 1 | Scripted (12 s) |
| **Main quest total** | **~40–70 min** (more if a night is missed) | — |
| Miller errand (night) | 5–10 | — |
| 30 resin + 8 tokens + 3 secrets + 18 places | 30–50 | A 500 m map, spread along 12 trails; ravens and owl breadcrumbs help |
| 4 elites (20-min respawn timers, separate lairs) | 15–30 | — |
| 19 achievements incl. 10 thralls (night only), a 5-contract streak, 5/5/3/2 species kills, the full journal (rare variants at 3 % weights) | 60–120 | The long tail; thralls only spawn ~4 min per 24 |
| **Everything (100 %)** | **~2.5–4 h** | — |

**Replay value: medium.**
- The core is a hunting sandbox with a deterministic endless contract board, elites respawning, a nightly re-fightable
  boss, weather and day/night variety, and rare-variant hunting.
- Rewards still run out: finishes are once-only, and resin, ribbons and ammo only buy ammo and two finishes.
- Content per square metre is higher than Driftwood's.
- Frame rate (fights), night gating and gate respawns are the main drag (inferred).

## B10. Stubbed, planned-but-not-built, broken (Pine Hollow)

| Item | Source | State |
|---|---|---|
| The four checks only Jake can do: an iPhone 30 fps reading (now a one-tap PERF LAP), a listen to the new music and SFX | E141; F-J1 / F-J2 | **needs you** |
| Fights under 30 fps on the iPhone (gpu~ 35–48 ms in the Ironhide fight); fixes shipped, unconfirmed | F-P6, E142 | open / unpicked |
| King hitboxes: a lane charge off his line grazes for 0; side-on ribcage hits miss; stomp misses under the belly | F-X5 | not picked |
| Hale's raised arm: torn coat edges and a dark flap (Blender repair needed) | F-X6 | not picked |
| KTX2 NPC textures predate the new faces (KTX2 pages load the old heads) | F-X7 | not picked |
| PERF LAP holds the elites and King, so their cost isn't measured | F-X8 | not picked |
| Whole-map Blender pass (F-B1), CC0 photoreal kit (F-B5), cabins re-materialled + ranger interior dressing (F-B6), per-shard code split (F-0.2) | follow-ups | not queued |
| Per-zone look misses (ridge rock ΔE 8.8, Ridge/Den sky 6.7/7.0) | F-L1 | not picked |
| Desktop far LOD for creature hulls (F-M4); lever-action finish too bright (F-M8) | follow-ups | not picked |
| Ambience beds are short 8–16 s loops (F-A1); Explore map pin tags overlap (F-U1) | follow-ups | not picked |
| GPU levers F-G1–G13 (terrain fetches, depth pre-pass, shadow cadence) | follow-ups | not picked |
| A Pine Hollow trophy-wall flaw: the cyan orbs (dust motes picking up night light) | the blow-by-blow (09:09) | unknown if fixed |
| E179: ENTER WORLD on a resident shard sometimes reloads the page (iOS memory?) | E179 | needs the user |
| E170: a Pine Hollow visual rough spot found while shooting the trailer | E170 | needs pick |
| Design gaps (inferred, not filed): no death checkpoint outside the boss; no "shard complete" card (Driftwood's `ShardComplete` is not fed by Pine); night-gated beats with only one fast-forward offer; Mott's whole economy buys only ammo and 2 finishes | code reading | — |
| Cut by the designer (not gaps): wolves, fishing, melee, currency, thunderstorms, snow, lore notes, tracking, calls, tree stands, full voice acting (PH-U8/9/10/15/16/22/23) | remaster plan | by design |

---

# PART C: Shared content infrastructure (reusable across shards)

| System | Path | Used by | Notes |
|---|---|---|---|
| **Quest schema + state machine** (pure data: steps, conditions, markers, counters, NPC dialogue entries with `when` / `sets`) | `src/game/quest/quest.ts` | Driftwood, Pine, Nalati | The current step is the first not done; dialogue is the first entry whose condition holds |
| **Quest core**: `QuestChip`, `NpcTalk`, `placesWithDiscovery`, `QuestLine` (chapters) | `src/game/quest/core.ts` | Driftwood, Nalati (Pine uses `ObjectiveLine` / `DialogueBox` directly) | — |
| **Quest UI**: `DialogueBox`, `ObjectiveLine`, `BossBar` (the simple one), `RewardCaption` | `src/game/quest/QuestUI.ts` | all three | — |
| **Per-shard adventure registry** | `src/game/quest/Adventure.ts` `ADVENTURES` | **Driftwood only** | Pine and Nalati install their own (`src/pinehollow/quest/index.ts`, `src/nalati/adventure.ts`); the comment still says Pine's slot is empty "until its lantern quest lands" |
| **Interactables kit + Flags**: chests, keys, doors, levers, plates, barrel, pickups, beacon, bench, altar as JSON rows, validated; flags persisted per shard | `src/world/interact/` (`Interactables.ts`, `types.ts`, `validate.ts`, `flags.ts`, `models.ts`) | Driftwood, Pine | Designed to be the chunk-upload format |
| **Achievements + titles + play time** | `src/game/achievements.ts` (tables: Driftwood 10, Pine 19, Nalati 17), `src/game/Progress.ts` | all | Titles are per shard; FINISH-LINE M2 (cross-shard titles) is not built |
| **Boss system** (arena, threshold, intro card, phase bar, checkpoints, legendary reward once, re-fight trophy) | `src/game/Boss.ts`, `src/ui/BossBar.ts` | Pine (King), Nalati (Golden King, Storm Titan) | **Driftwood's Captain does not use it**: he has his own `think` and `QuestUI.BossBar` (a second boss path) |
| **Elite system** (lair, leash, phase 2, banner, minimap skull, 20-min respawn, first-kill skin orb) | `src/game/Elite.ts` | Pine, Nalati | — |
| **Species registry + AnimalManager** (variants and rarity weights, `HuntTuning`, `fightRules`, `maxHitDamage`, `faunaTuning`, herds) | `src/entities/species/registry.ts`, `src/entities/AnimalManager.ts`, `src/chunks/fauna-layout.ts` | all | Fight rules are opt-in per `ChunkDef` (Driftwood only today) |
| **Enemy respawn queue** | `src/game/quest/Ecology.ts` | Driftwood only | Pine relies on elite timers instead |
| **Loot**: Owned (all shards), Purse, coins, Bounty, CoinBurst, shop, keepsakes, perks, finds | `src/game/loot/` | Owned on all; coins / shop / perks are Driftwood-only behind `ChunkDef.loot` | Coins are capped per enemy |
| **Inventory / pack + harvest table** | `src/game/Inventory.ts` | Pine (7 kinds); none on Driftwood, Nalati, Nine Dragon | — |
| **Compendium** (journal: discovered / seen / taken / visited, stats, sketches, 3D viewer plate) + trophy wall | `src/ui/compendium/`, `src/world/TrophyWall.ts` | Pine only | Built shard-agnostic: "Driftwood / Nalati can adopt it later" |
| **Shard-complete card** | `src/ui/ShardComplete.ts` (+ `Complete.ts` feeder) | Driftwood only | Pine and Nalati don't feed it |
| **Death fade + last-place checkpoint** | `src/ui/DeathFade.ts`, `src/ui/HurtArc.ts`, `src/game/LastPlace.ts` | the fade on all; LastPlace only where `adventure.places` exists (Driftwood) | — |
| **First-time hints** | `src/ui/FirstHints.ts` | Driftwood feeds triggers (`firstMinutes.ts`) | Other shards show none |
| **Breadcrumb guides** | `src/game/quest/gullGuide.ts` + `src/world/Gulls.ts`; Pine's ravens and owl in `src/pinehollow/life/` | Driftwood, Pine | The same idea built twice |
| **Clocks**: `DayNight` (Driftwood, 48 min), `PineDayNight` (24 min), Nalati `DayClock`, behind `WorldClock` | `src/world/` | — | Three clock implementations |
| **Weather**: `Weather` (Nalati storm), `PineWeather` (fog + rain) | `src/world/` | — | Two implementations; Driftwood has none |
| **Weapon finishes / skins** | `src/player/Skins.ts`, `src/player/Cosmetics.ts` | Pine, Nalati | — |
| **Explore World + Model Explorer, practice arena, playgrounds** | `src/explore/`, `src/practice/`, `src/playgrounds/`, `ChunkDef.roster` | all | Developer and player tools; not content |
| **Normalization plan** to turn this into an engine / kit / shard plugin layout (quest runtime from Pine's, the scheduler, the template shard) | `docs/plans/GAME-NORMALIZATION.md` | — | Draft at the tag |

---

## Appendix: key evidence pointers

- Driftwood content baseline before the remaster, "~5 minutes of content":
  `project/archive/2026-09-23-driftwood-remaster.md` §1 (`git show pre-normalization:…`).
- Driftwood design target, "20–30 minutes of island adventure": the same file's intro.
- Feel scores (Driftwood 6.5, Nalati 5, Pine 3): `docs/plans/FINISH-LINE.md`.
- First-run log: `docs/design/audit-e108/driftwood.md`.
- Every Driftwood placeholder and what was cut: `project/archive/2026-09-30-driftwood-slop.md` (E318).
- The Driftwood economy redesign: `project/archive/2026-09-30-driftwood-loot.md` (E314).
- Pine Hollow decisions PH-U1…U35 and C-rows: `project/archive/2026-09-25-pine-hollow-remaster.md`.
- Pine Hollow leftovers: `project/archive/2026-09-30-pine-hollow-followups.md`.
