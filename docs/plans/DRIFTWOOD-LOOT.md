# Plan: Driftwood loot and inventory, redesigned (E314)

**State:** `draft` 2026-09-29 — Jake approved the loop (fight for doubloons → spend at Wendell → stronger; sea glass charms and trophies to explore for; Gear / Collection tabs) and said "board it all" (AskUserQuestion, 2026-09-29). Boards for L1–L5 in flight (driftwood-top10 plan agent, `art/loot/round-1-loop/`); nothing built until he picks the details.

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
