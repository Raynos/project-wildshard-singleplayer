# Loot, round 3: the other three shards' Bag (E314, 2026-09-30)

The last row of [DRIFTWOOD-LOOT](../../../project/archive/2026-09-30-driftwood-loot.md), "the other three shards' Bag review with Jake".
Jake (2026-09-30) said that any change to the shared UI, the five tabs, has to reach the other three shards. He also
said "the more we can delete and simplify, the better". Driftwood's Bag is MAP · GEAR · FINDS · PACK · FEATS.

**How the frames were made.** Every base frame is a live iPhone 16 Pro portrait capture of production (build
`9e9d6eb-munv6l8c`, Playwright 402 × 874 at 3×, `touch · tier=phone · mute`, run under `scripts/browser-lane.sh`).
Some bases use a seeded mid-game save: a Pine Hollow pack of 12 kinds, and Nalati's Irbis and Sky-Wolf skins. codex
`image_gen` (`gpt-6-sol`) edited each frame, one run per frame. The B frames also took Driftwood's GEAR / FINDS capture
as a pattern reference. Each board has two frames per variant (top GEAR, bottom the tab that differs most). The
recommended variant has a gold border and a one-line why under it.

No frame was re-rolled: all 18 came back with readable text and the HUD language intact.

| File | Question | Variants | Recommended |
|---|---|---|---|
| `board-1-pine-hollow.jpg` | What goes in Pine Hollow's Bag? | **A** leanest: JOURNAL renamed FINDS (the same journal), and PACK keeps only the 7 kinds Mott takes · **B** Driftwood's full pattern: GEAR adds AMMO and FINISHES, FINDS becomes a sticker book (carved tokens, resin, places, trophies, secrets), and the pack stays as today · **C** middle: A's cuts, plus FINISHES on GEAR (tap to wear), and each pack item says what Mott gives for it | **C**: it keeps the barter loop that gives the pack a purpose and cuts what Mott never asks for. The finish swap reuses Nalati's SKINS row, and Pine can't change a finish today |
| `board-2-nalati.jpg` | What goes in Nalati's Bag? | **A** leanest: MAP · GEAR · FEATS, with no pack and no harvest. GEAR names the upgrade (GOLDEN BOW) and shows the skins won · **B** the full five: Tulpar on GEAR, every skin (the locked ones name who drops them), FINDS (places, carvings, feathers, trophies), and the junk pack · **C** middle: MAP · GEAR · FINDS · FEATS with no pack. The locked skins show on GEAR, and FINDS shows the 5 elites and their prizes | **A**: the rewards are skins and titles, and GEAR and FEATS already show both. All 12 pack kinds are slop |
| `board-3-nine-dragon.jpg` | What goes in Nine Dragon's Bag? | **A** leanest: MAP · GEAR. GEAR shows the NEON JIAN and the FEI ZHUA grapple · **B** the full five: locked cosmetic slots, and FINDS holds the 6 named places · **C** middle: MAP · GEAR · FEATS, with three traversal feats (HOOKED, STAIR-STREET, THE WELL) | **A**: it is a prototype with no loop, so the Bag names only what is there |
| `board-4-order.jpg` | In what order, and what does each take? | 1 Pine Hollow C (M) · 2 Nalati A (S) · 3 Nine Dragon A (XS) | Pine first: it is the only shard whose pack has a use, and it has bugs players hit |

## The audit (2026-09-30, code + live captures)

**Pine Hollow.** Tabs today are MAP · GEAR · PACK · JOURNAL · FEATS. JOURNAL opens the hunter's journal: beasts,
elites, 18 places and trophies, plus the trophy wall in the ranger's cabin. GEAR holds the crossbow (iron /
pitch-tipped / broadhead bolts), the lever-action and the Warden's Longbow. The pack has 18 slots, and about 19 kinds
can enter it. Mott barters 8 of those kinds (deer hide, venison, boar hide, boar tusk, antlers, bear pelt, amber resin,
lodge ribbon) for bolts, cartridges, arrows, heartwood and two finishes.
- **Slop** (never consumed): boar meat, elk meat, elk hide, bear claw, amber heartwood (made in four places, used
  nowhere), and the 4 elite trophies (Ironhide's tusk, pale antler, Blackpaw's claw, seven-tine crown). Antlers only
  buy heartwood.
- **Bugs.** A full pack drops a new kind silently. That includes the `warden-longbow` item that re-unlocks the bow on
  load, and a heartwood trade you have already paid for. Weapons, iron bolts, cartridges and arrows are not saved.
  Bolts or arrows bought with a full quiver are wasted. The finishes have no swap anywhere: the newest one is always
  worn.

**Nalati.** Tabs today are MAP · GEAR · PACK · FEATS. GEAR holds the bow, the sabre and the spear (javelins 3 / 3). The
Golden Bow and Naizagai upgrades are not named on GEAR. The SKINS row shows only owned skins (Irbis, Sky-Wolf,
Storm-Wing, Night Rider, Sky-Marked Saddle). The horse (Tulpar / Argymaq) is not an item.
- **Slop:** all 12 pack kinds. That is wolf pelt, wolf fang, horsehair, balbal shard, grave dust, marmot fur, the
  5 elite trophies and the Golden King's plaque. Nothing ever reads them; the quest's plaque step checks a flag.
- **Bug:** Argymaq's drop id `argymaq` is not in `NALATI_SKINS`, so it is silently ignored.
- **Other finds** (map / flags only): 17 places, 3 balbal carvings, 3 storm feathers. FEATS lists 17 on the live build.

**Nine Dragon.** Tabs today are MAP · GEAR · PACK · FEATS. It is a prototype with no enemies, no fauna, no quest and
no NPCs.
- GEAR shows one generic "SWORD" (the Neon Jian). The Fei Zhua grapple is not in the Bag. An iron sword sits in the kit
  and can never be unlocked on this shard.
- Nothing can ever enter the pack, which shows as an empty 12-slot grid. FEATS is 0 / 0. The 6 named places (Lantern
  Square, Night Market, Stair-Street, The Well Rim, Well Galleries, The Crossings) only tag models; nothing discovers
  them.
