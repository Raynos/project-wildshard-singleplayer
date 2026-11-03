# KITCHEN-SINK v2: UI picks, one by one

Jake, 2026-11-03: *"We're going to have to go and approve every single one, one by one. So keep track of what I'm
approving and what's still pending review."* Every HUD / UI / menu change in the plan, from the
[UI Changes page](https://claude.ai/artifact/MLXuWHJW9msEDh4Zg8YzsC) (`art/showcase-template/round-12-ui/`). Nothing
lands until its row says **approved**. This file is the source: `build-index.mjs` reads the Status column and badges
each frame on the page.

Status: `pending` · `approved` · `changes` (Jake's notes in the last column) · `cut`.

| # | Change | Section | Status | Jake's notes |
|---|---|---|---|---|
| UI-01 | XP bar + LV chip | 1 Fight HUD | approved | 2026-11-03: "nice … good placement" |
| UI-04 | Enemy nameplates within 25 m | 1 Fight HUD | pending | |
| UI-05 | Floating combat text | 1 Fight HUD | pending | |
| UI-06 | GUARD button | 1 Fight HUD | pending | |
| UI-02 | Level-up in a fight | 2 Banners | pending | |
| UI-07 | Named elite banner | 2 Banners | pending | |
| UI-24 | Gauntlet wave banner | 2 Banners | pending | |
| UI-26 | Boss intro title card | 2 Banners | pending | |
| UI-22 | Storm hour + beacons | 2 Banners | pending | |
| UI-17 | Checkpoint card | 2 Banners | pending | |
| UI-20 | Course clock chip | 3 Minimap chip | pending | |
| UI-29 | Training Vault sealed room | 3 Minimap chip | pending | |
| UI-31 | Hover park trick score | 3 Minimap chip | pending | |
| UI-03 | Level-up card, out of combat | 4 End cards | pending | |
| UI-19 | Shard-complete card | 4 End cards | pending | |
| UI-30 | SHRINE COMPLETE card | 4 End cards | pending | |
| UI-10 | Character tab | 5 Menus | pending | |
| UI-14 | Quest list on the map tab | 5 Menus | pending | |
| UI-16 | Kill-contract board | 5 Menus | pending | |
| UI-32 | Tinker Rook: UPGRADES / BENCH | 5 Menus | pending | |
| UI-33 | The weapons shop | 5 Menus | pending | |
| UI-13 | REQUIRES LV in the dialogue | 6 Small additions | pending | |
| UI-09 | Death card + XP loss | 6 Small additions | pending | |
| UI-34 | The 20-slot pack | 6 Small additions | pending | |
| UI-35 | Ammo pouch + picker | 6 Small additions | pending | |
| UI-08 | Boss bar with phases | 6 Small additions | pending | |
| UI-23 | Stealth: UNSEEN | 6 Small additions | pending | |
| UI-25 | Portal ENTER prompt | 6 Small additions | pending | |
| UI-12 | Quest-giver ! markers | 7 In the world | pending | |
| UI-21 | Personal-best board | 7 In the world | pending | |
| UI-11 | The DEFLECT first hint | 8 Could be cut | pending | |
| UI-27 | Map heat map | 8 Could be cut | pending | |
| UI-28 | Minimap band border | 8 Could be cut | pending | |
| UI-38 | Scrip chip + salvage part | 8 Could be cut | pending | |
| UI-37 | The range's loaner | 8 Could be cut | pending | |
| UI-36 | Trophy perk card | 8 Could be cut | pending | |
| UI-15 | Shift Orientation tour step | 8 Could be cut | pending | |
| UI-18 | Feat toast + FINDS toast | 8 Could be cut | pending | |

**Tally:** 1 approved · 37 pending.
