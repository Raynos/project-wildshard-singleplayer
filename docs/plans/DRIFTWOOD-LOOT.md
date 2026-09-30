# Plan: Driftwood loot and inventory, redesigned (E314)

**State:** `in progress` 2026-09-30 — Jake: "Yes, build it". Stage 1 (coins, Purse / Owned stores, the five icon tabs, GEAR paper doll, FINDS sticker book, iron sword saved), the trader model and the small props (chime, plaques, hat, cape, icons) are in flight with the driftwood-top10 plan agent. Then: the shop screen + wiring (stage 2), the chime / trophies / hat wiring (stage 3).

## Why

Jake (E314, 2026-09-29): "the whole inventory screen and the whole ability to collect loot from kill enemies is complete slop … what the hell are we collecting? Why? What purpose does it have? … a top five suggestion of what we can do with it within the scope of Driftwood, and then we can generalize it later."

What the code does today (audit 2026-09-29):
- A kill → stand by the body → "[E] Harvest" → meat, hide, tusk, claw, fur, coconut, rope, doubloons, sea glass into a
  **12-slot pack** (`src/game/Inventory.ts:73-106`). Driftwood can make 17 kinds, so the 13th is refused silently while
  the toast still names it.
- **Nothing on Driftwood ever reads the pack.** No trader, no food, no crafting, no achievement. Only Pine Hollow's Mott
  consumes items (barter for bolts and skins, `src/pinehollow/quest/trades.ts`); there is no currency anywhere.
- The Bag ▸ Inventory tab: weapon cards (tap to hold), a Nalati-only skins row, the pack grid (cells do nothing).
- The **iron sword is not saved**: you take it from the rack again every session (`src/game/quest/guards.ts`).
- Sea glass is counted twice and drifts (15 beach flags vs pack items that the sailor also drops). Glyph shards,
  places, the reef necklace are flags only.
- Healing is regen only (4 hp/s after 6 s). Rewards are joke titles and the complete card.

## The five

| # | Proposal | What it replaces | Size |
|---|---|---|---|
| L1 | **Kills drop doubloons, not junk.** No harvest prompt, no meat / hide / fur on Driftwood (the hunting shard is Pine Hollow). A kill pops a few doubloons out of the body that fly to you when you walk near (crab 1, boar 2, monkey 1, sailor 5, bear 10, captain a chest). Doubloons become Driftwood's one currency, shown as a number, not pack slots. | the harvest loop, 17 item kinds, the 12-slot pack | M |
| L2 | **Wendell trades.** His hut gets a small counter: doubloons buy a handful of **permanent** things, no consumables: sword sharpening (2 tiers, +damage), a sturdier heart (+20 max health, twice), a hoverboard boost, and a cosmetic (a captain's-hat or sail-cloth skin). Five to six goods, each bought once. | nothing (doubloons have no use today) | M |
| L3 | **Sea glass has a purpose.** Every 5 pieces Wendell strings into a charm: 5 → +10 max health, 10 → a faster dodge recharge, 15 → the sword glows at night (and the "every piece" feat). One count (the beach pieces), the sailor stops dropping it. | the double count; sea glass that only feeds an achievement | S |
| L4 | **Trophies, not trash.** The few fights you choose (the brown bear in the grove, the black bear at the shrine, a rare boar, the Drowned Captain) drop one trophy each. It hangs on the wall of Wendell's hut and gives a small perk or a look (bear claw → a heavier heavy-attack; captain's hat → wearable). A reason to go and fight the bear we just moved off the path. | bear-pelt / claw junk; the captain dropping nothing | S–M |
| L5 | **The Bag becomes MAP · GEAR · COLLECTION · ACHIEVEMENTS** (Jake's E313 ask). GEAR: your swords (with their sharpening tier; the iron sword is saved), max health, charms, doubloons. COLLECTION: sea glass n / 15 (with the next charm), glyph shards n / 3, places n / 11, trophies, treasures (the reef necklace). No pack grid on Driftwood. | the Inventory tab's junk grid | M |

Housekeeping that ships with whichever lands first: save the iron sword; drop the invisible "[E] Harvest" left at a
faded sailor / captain body.

**Generalising later** (not now): Pine Hollow keeps barter, it is the hunting shard; Nalati and Nine Dragon pick
their own currency / trophy once Driftwood's version is played.

## Next

Jake picks which of L1–L5 to take. Each picked row gets its own ask and an iPhone-portrait board (the shop, the
Gear / Collection tabs, the doubloon pop) before it is built.

## Jake's steer, 2026-09-29 (after the draft)

"I want inventory to be a separate tab that's full. Collection and gear are supposed to be simpler new tabs that are
really clean and polished. Inventory is the junk tab." So:
- L5 becomes MAP · GEAR · COLLECTION · INVENTORY · ACHIEVEMENTS. GEAR and COLLECTION are the clean, polished tabs; INVENTORY
  keeps the full pack of junk. How five tabs stay uncluttered on the phone is its own board (`board-8-bag-tabs.jpg`).
- L1 changes with it: kills still drop junk into INVENTORY, and the junk **sells to Wendell for doubloons** (a BUY | SELL
  switch on his shop, "SELL ALL JUNK"). The junk finally has a use, and doubloons still flow from fights. Needs the
  12-slot pack fixed (it silently refuses a 13th kind today).

**Then, same day:** Jake leans hard toward lean ("the more we can delete and simplify, the better … too much placeholder
shit floating around"), but wants to see the full plan and mockups first: "afterwards we figure out what lean means and
what to drop". So all boards finish; the lean cut is decided after them. The leanest option on the table: delete
harvesting + junk, no Inventory tab on Driftwood, Bag = MAP · GEAR · COLLECTION, no shop / currency / charms / trophies.

## Jake's keep list, 2026-09-29 (after all eight boards)

Kept: coins + a shop, GEAR + COLLECTION tabs, junk + the INVENTORY tab, charms + trophies. His words: "Wendell is the
quest giver. Any shop should be a second NPC. Don't allow for the selling of junk. Coins are just earned from killing."
- L1: coins from kills only (no chest / sale income beyond what the quest already hands out).
- L2: the shop moves off Wendell to a **new shopkeeper NPC** (who and where: a board). No SELL side.
- L3 / L4: kept. Who strings the charms and where trophies hang follows the shopkeeper pick.
- L5: MAP · GEAR · COLLECTION · INVENTORY (junk, unchanged in role) · ACHIEVEMENTS, the tab-bar board decides the look.

## Jake's picks, 2026-09-30 (boards in `art/loot/round-1-loop/`)

| Piece | Pick | What gets built |
|---|---|---|
| Coins (board 1) | **A** | Kills burst doubloons that fly to you, a "+n" pops, the total sits in a coin chip under the health bar. Coins only from kills. |
| Shopkeeper (board 9) | **a trader at Wendell's hut** (not the boat) | A second NPC beside Wendell; Wendell stays the quest giver. |
| Shop goods | Whetstone I (+25 % sword damage, 15) · Whetstone II (+50 %, 40) · Sturdy Heart I (max health 120, 25) · Sturdy Heart II (140, 50) · Sea chart (unfound sea glass on the map, 20) · Sailcloth cape (look only, 20) | Each bought once. **No hoverboard fin. No selling.** Prices are a first guess (a playthrough earns ~60–100). |
| Shop screen (board 5) | **C** | One good per card, flipped with ‹ ›, a big BUY button. Buy only. |
| Sea glass charm (board 3) | **C** | A wind chime of sea glass in the hut's doorway that grows every 5 pieces (5 → +10 max health, 10 → faster dodge recharge, 15 → the sword glows at night). |
| Trophies (board 4) | **A + C** | The bear claw and the boar tusk on plaques on the hut wall; the captain's hat is worn by the player. |
| Bag tabs (board 8) | **A** | Five icon tabs, one short word each: MAP · GEAR · FINDS · PACK · FEATS. |
| GEAR (board 6) | **C** | A paper doll: the kit laid out round a silhouette (swords + sharpening, hearts, charms, coins), with a **cosmetics** slot group holding the captain's hat and the sailcloth cape (Jake: "The hat also goes in the gear section as a cosmetic as does the cape"), worn / taken off from there. |
| FINDS / collection (board 7) | **B** | A sticker book: found bright, missing dashed; 15 sea glass chips; places, glyph shards, trophies, treasures. |
| PACK (inventory) | kept | The junk pack, as today (no sale). |

## Last: the other three shards (Jake, 2026-09-30)

Jake: "any changes you make to the shared UI, the five tabs, that needs to ripple across the other three shards. That is
fundamentally shared UI for the entire game." So the Bag is built once for all four shards:
- Stage 1 ships the icon tab bar and GEAR (weapons + skins move out of PACK) on **every** shard; PACK and FEATS as today.
  FINDS shows on Driftwood only until the review below.
- **Open, with Jake — the final row of this plan:** review Pine Hollow, Nalati and Nine Dragon, in an order Jake picks, and
  agree per shard what its GEAR holds (weapons, skins, upgrades?), what its FINDS holds (its collectibles, places,
  trophies?), whether it has coins / a shop / a trader, and what its PACK junk is for (Pine Hollow already trades hides
  for ammo with Mott). One board per shard, then build.

## Jake, 2026-09-30 (AskUserQuestion)

- **Coins are capped per enemy:** each enemy pays on its first death only; a respawned one pays nothing. So the island
  holds a fixed purse (one full clear), and the shop is priced so buying everything takes about one full clear.
- **The Drowned Captain hits harder than the cap** (24, not 20): `ChunkDef.hitCapExempt: ['captain']`, commit `4cf7ac8e`.
- **Respawn** stays "the last place you walked into" (E295 as built).

