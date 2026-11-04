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
| UI-24 | Gauntlet wave banner | 2 Banners | approved | 2026-11-03: redone frame approved, "UI 24 looks good" (WAVE 2 / 5 in the middle only, fades; no chip). First round: keep "WAVE 2 / 5" big in the middle of the screen when a wave starts ("kind of cool"); drop the wave chip that stays under the quest chip: "too fucking busy … we can't have those permanent banners" |
| UI-26 | Boss intro title card | 2 Banners | approved | 2026-11-03: "fine … looks fine" |
| UI-22 | Storm hour | 2 Banners | approved | 2026-11-03: redone frame approved, "UI 22 looks good". First round: "way too busy … the beacons on the minimap is way too busy … a really more minimalist, lightweight" one; now one centred STORM HOUR line that fades, no minimap beacons, no toast, the storm chip unchanged |
| UI-17 | Checkpoint card | 2 Banners | approved | 2026-11-03: "Yeah, cool. Let's do it." |
| UI-20 | Course clock chip | 3 Minimap chip | approved | 2026-11-03: redone frame approved, "UI 20 looks good". First round: "it can hide the quest chip whilst it's showing the course clock … when we're done … show the quest chip again … not be so busy"; the clock now takes the quest chip's place |
| UI-29 | Training Vault sealed room | 3 Minimap chip | approved | 2026-11-03: "way too busy … hide the rest of the quest … a dungeon specific quest chip, but like just one … I need new ideas"; then "we can pick A for the UI 29, the vault stuff". **A:** inside the vault the tracked quest hides and one chip takes its place, TRAINING VAULT · ROOM 2/4 · 3 LEFT; the quest chip comes back on leaving (ui-29-opt-a.jpg) |
| UI-31 | Hover park trick score | 3 Minimap chip | approved | 2026-11-03: redone frame approved, "UI 31 looks good now". First round: "the same kind of temporary UI … the timed racing … when we show that kind of UI, we want to hide the normal quest UI … make it tidier"; the trick score now takes the quest chip's place in the park |
| UI-03 | Level-up card, out of combat | 4 End cards | approved | 2026-11-03: "UI 03 looks good to me" |
| UI-19 | Shard-complete card | 4 End cards | approved | 2026-11-03: "Ui 19 approved" |
| UI-30 | SHRINE COMPLETE card | 4 End cards | approved | 2026-11-03: redone frame approved, "UI 30 looks fine". First round: "nice but all the buttons have to be different: leaving the mini dungeon means walking through a real portal, not hitting a button, and you can restart, it needs a change"; now one CONTINUE that only closes the card, and a line: the exit portal is open behind the chest, walk through it to leave, walk back in to run it again |
| UI-10 | Character tab | 5 Menus | approved | 2026-11-03: redone frame approved, "UI 10 looks fine". First round: "Gear and character can be turned into a single item in the 5 menu icons … two nested tabs for gear and character underneath, default to character"; now five tabs (MAP · CHARACTER · FINDS · PACK · FEATS), CHARACTER / GEAR inside, opens on CHARACTER |
| UI-14 | Quest list on the map tab | 5 Menus | pending | 2026-11-03, redone for re-review: "same thing, map and quests can be shared but it must be two nested tabs to toggle them"; now MAP / QUESTS sub-tabs in the map tab, the frame shows QUESTS. Then: "now that we have far more space for quests … show me … the quest list, the quest details … all the quest related screens"; board ui-14-q-board.jpg: the list grouped by tier, one quest’s details, a locked quest, the MAP sub-tab with the tracked quest |
| UI-16 | Kill-contract board | 5 Menus | approved | 2026-11-03: "Ui 16 sure" |
| UI-32 | Tinker Rook: UPGRADES / BENCH | 5 Menus | approved | 2026-11-03: "Ui 32 sure" |
| UI-33 | The weapons shop | 5 Menus | approved | 2026-11-03: "UI 33 is fine" |
| UI-13 | REQUIRES LV in the dialogue | 6 Small additions | pending | 2026-11-03, redone for re-review: "if there’s a level requirement, you can’t have a next button … you got to choose something"; NEXT is gone: the greyed quest or LATER |
| UI-09 | Death card + XP loss | 6 Small additions | approved | 2026-11-03: "UI9 is fine" |
| UI-34 | The 20-slot pack | 6 Small additions | approved | 2026-11-03: "UI 34 looks fine to me" |
| UI-35 | Ammo pouch + picker | 6 Small additions | changes | 2026-11-03: "I don’t know how I feel about this … show me better variants for how to choose ammo … the main weapon wheel is somewhere else … it looks very messy. Show me a bunch of variants" Variants board ui-35-board.jpg: A tap BOLTS to cycle (recommended), B hold BOLTS for a short stack of three, C three ammo tabs on the bolts chip, D pick the ammo in the bag only |
| UI-08 | Boss bar with phases | 6 Small additions | approved | 2026-11-03: "UI08 is fine" |
| UI-23 | Stealth: UNSEEN | 6 Small additions | changes | 2026-11-03: "feels busy. Show me a couple of variants. Definitely looks busy on top right with like the two pills". Variants board ui-23-board.jpg: A the quest chip becomes the stealth chip (recommended), B one small eye row top left, C no words: a dark screen edge and an eye over the crosshair |
| UI-25 | Portal ENTER prompt | 6 Small additions | approved | 2026-11-03: "UI 25 is fine" |
| UI-12 | Quest-giver ! markers | 7 In the world | pending | 2026-11-03, redone for re-review: "fine, but … the exclamation mark is way above his head … we can do a bit better"; the ! now sits just above the head, its label above it |
| UI-21 | Personal-best board | 7 In the world | approved | 2026-11-03: "looks really funny. But yeah, you can show billboards with information in the world … as signs … it’s gonna look a lot better when placed correctly in the right place" (build it as a real sign, placed properly) |
| UI-11 | The DEFLECT first hint | 8 Could be cut | approved | 2026-11-03: "having a hint is fine … the first time something happened, to … teach mechanisms" |
| UI-27 | Map heat map | 8 Could be cut | cut | 2026-11-03: "quite busy … I don’t think we want levels and colors on the map … the map is already busy enough" |
| UI-28 | Minimap band border | 8 Could be cut | cut | 2026-11-03: "No, we don’t want this" |
| UI-38 | Scrip chip + salvage part | 8 Could be cut | cut | 2026-11-03: "no thanks" |
| UI-37 | The range's loaner | 8 Could be cut | cut | 2026-11-03: "no thanks" |
| UI-36 | Trophy perk card | 8 Could be cut | approved | 2026-11-03: "I think UI 36 can be nice" |
| UI-15 | Shift Orientation tour step | 8 Could be cut | cut | 2026-11-03: "I don’t think we need this" |
| UI-18 | Feat toast + FINDS toast | 8 Could be cut | pending | |

**Tally:** 27 approved · 5 cut · 2 changes · 4 pending (3 redone for re-review: UI-14 quest screens, UI-13, UI-12; UI-35 and UI-23 have variant boards; UI-18 not reviewed yet).
