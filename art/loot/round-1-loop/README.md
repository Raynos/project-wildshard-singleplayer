# Loot loop, round 1: the in-world moments (E314, 2026-09-29)

Decision boards for [DRIFTWOOD-LOOT](../../../docs/plans/DRIFTWOOD-LOOT.md) L1–L4, the moments you see in the world.
(The menu screens, Wendell's shop menu and the Bag GEAR / COLLECTION tabs, are a separate set of boards.)

Every frame is a live iPhone 16 Pro portrait capture of production (agent-browser, `touch · tier=phone · mute ·
weapon=sword`, spawned with `at=`), edited by codex `image_gen` (one run per frame). The recommended frame has a gold
border; the one-line why is at the foot of each board.

| File | Question | Variants | Recommended |
|---|---|---|---|
| `board-1-coins.jpg` | How do coins come out of a kill? (L1) | A doubloons burst in an arc and fly to you, "+2" pops, a "coin 23" chip under health · B coins drop and glint on the ground, walk over them · C no coins seen, "+2" floats up from the body · D big kills drop a coin pouch you OPEN | A |
| `board-2-shop-world.jpg` | What does Wendell's shop look like in his hut? (L2) | A a driftwood counter in front of Wendell with the goods (whetstone, heart charm, board fin, captain's hat) · B the goods hang on the hut wall under FOR TRADE · C a beach stall with a sailcloth awning · D today, Wendell alone (the live capture, unedited) | A |
| `board-3-charm.jpg` | What does the sea glass charm look like? (L3) | A sea glass beads on the sword hilt · B a pendant chip "5/15" next to health · C a wind chime in Wendell's doorway that grows · A at night, 15 / 15: the sword glows aqua | A |
| `board-4-trophies.jpg` | Where do trophies go? (L4) | A bear claw, captain's hat, boar tusk on plaques on the hut's back wall · B a shelf with tags BEAR / CAPTAIN / BOAR · C the captain's hat worn (your shadow wears it), claw and tusk on the front wall | A |

Re-rolled once: 3A (the beads were too small), 3C (the chime was too small), 4C (the hat shadow was missing).

## The menu screens (boards 5–8)

The shop screen (L2) and the Bag's tabs (L5), with Jake's notes of 2026-09-29: INVENTORY stays as its own full tab (the
junk pack, sold to Wendell), GEAR and COLLECTION are the new clean tabs, and five tabs must not look busy. The base
frames are live iPhone 16 Pro portrait captures of production (Playwright, 402 × 874 at 3×, `touch · tier=phone ·
mute · weapon=sword`): the real Bag on its INVENTORY tab, and the frame talking to Wendell. codex `image_gen` edited
each one (one run per frame). 8 D is the live capture, unedited. Boards 6 and 7 use the icon tab bar from 8 A.

| File | Question | Variants | Recommended |
|---|---|---|---|
| `board-5-shop-screen.jpg` | What does Wendell's shop screen look like? (L2) | A a list panel over the dimmed hut, Wendell's line on top, a BUY \| SELL switch, the purse "◉ 23" (shown on BUY, and on SELL with "SELL ALL JUNK · +21 ◉") · B a full-screen 2 × 3 card grid with big icons · C one good at a time, flip ‹ ›, a big BUY button · D Wendell's portrait and line on top, the goods below | A: every good, its price and state at a glance, thumb-sized rows, and Wendell stays in view |
| `board-6-gear-tab.jpg` | What goes in the Bag's GEAR tab? (L5) | A a vertical list of big cards (SWORDS · BODY · CHARMS) · B a hero card for the held sword with sharpening pips, slim rows below (wooden sword, health 120, charm, purse) · C a paper doll, the kit around a silhouette | B: the sword you sharpened is the star, and the pips show the upgrade path |
| `board-7-collection-tab.jpg` | What goes in the Bag's COLLECTION tab? (L5) | A rows with progress bars, then trophy / treasure tiles · B a sticker book: found = bright, missing = dashed outline, 15 sea glass chips · C a small island map for places, counters beside it · D the 4-tab Bag scrolled to the end: achievements as COLLECTION's last section | B: the empty outlines are the reason to go exploring |
| `board-8-bag-tabs.jpg` | How do 5 tabs stay clean on the phone? | A five icon tabs, one short word each: MAP · GEAR · FINDS · PACK · FEATS · B four text tabs, achievements folded into COLLECTION · C three main tabs plus small INVENTORY / ACHIEVEMENTS links · D today, MAP · INVENTORY · ACHIEVEMENTS (live capture) | A: all five fit one row at 402 px, and nothing is hidden |

Re-rolled: every shop frame once (5 A-BUY, 5 A-SELL, 5 C, 5 D: the header said "BAG", now "WENDELL'S COUNTER"), 7 D
once ("WHO LIT THE FJRE?" was garbled).
