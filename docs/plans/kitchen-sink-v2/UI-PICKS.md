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
| UI-04 | Enemy nameplates within 25 m | 1 Fight HUD | approved | 2026-11-03: "looks good to me" |
| UI-05 | Floating combat text | 1 Fight HUD | approved | 2026-11-03: "looks good to me" |
| UI-06 | GUARD button | 1 Fight HUD | approved | 2026-11-03: "I think that's okay"; then "four in a row, approved": GUARD · LOCK · DODGE · JUMP, GUARD in the slot the spear's THROW takes (frame redone) |
| UI-02 | Level-up in a fight | 2 Banners | approved | 2026-11-03: "Yeah, sure" |
| UI-07 | Named elite banner | 2 Banners | approved | 2026-11-03: "looks very similar … nice" |
| UI-24 | Gauntlet wave banner | 2 Banners | pending | 2026-11-03, redone for re-review (WAVE 2 / 5 in the middle only, fades; no chip): keep "WAVE 2 / 5" big in the middle of the screen when a wave starts ("kind of cool"); drop the wave chip that stays under the quest chip: "too fucking busy … we can't have those permanent banners" |
| UI-26 | Boss intro title card | 2 Banners | approved | 2026-11-03: "fine … looks fine" |
| UI-22 | Storm hour | 2 Banners | pending | 2026-11-03, redone for re-review: "way too busy … the beacons on the minimap is way too busy … a really more minimalist, lightweight" one; now one centred STORM HOUR line that fades, no minimap beacons, no toast, the storm chip unchanged |
| UI-17 | Checkpoint card | 2 Banners | approved | 2026-11-03: "Yeah, cool. Let's do it." |
| UI-20 | Course clock chip | 3 Minimap chip | pending | 2026-11-03, redone for re-review: "it can hide the quest chip whilst it's showing the course clock … when we're done … show the quest chip again … not be so busy"; the clock now takes the quest chip's place |
| UI-29 | Training Vault sealed room | 3 Minimap chip | approved | 2026-11-03: "way too busy … hide the rest of the quest … a dungeon specific quest chip, but like just one … I need new ideas"; then "we can pick A for the UI 29, the vault stuff". **A:** inside the vault the tracked quest hides and one chip takes its place, TRAINING VAULT · ROOM 2/4 · 3 LEFT; the quest chip comes back on leaving (ui-29-opt-a.jpg) |
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

**Tally:** 9 approved · 29 pending (3 redone for re-review: UI-24, UI-22, UI-20).
