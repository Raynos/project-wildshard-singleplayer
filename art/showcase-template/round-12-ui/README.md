# Round 12: every Kitchen Sink v2 UI change as a 1:1 in-engine mockup

Asked by Jake on 2026-11-03: *"Any changes to HUD, UI, menus need to be real in-engine mockups of what it would look
like."* Round 11's frames (`../round-11-remaster/`) invented their HUD. Here every frame is the real game. The live page
of a served build (`add5874`) is captured as an iPhone 16 Pro in portrait (402 × 874 @3×, muted). Each AFTER is that same
live page with the new element added to the DOM. The new element uses the engine's own classes and the same DOM structure
as the component it extends. The few rules no engine class covers yet are in [`proto.css`](proto.css), each under the
id of the change it serves.

Gallery: [`index.html`](index.html) has the BEFORE / AFTER pairs, grouped, tap to zoom. Planning art only: nothing here
touches `src/`.

**HUD rule (AGENTS.md E332).** Every row marked HUD below changes the shared HUD. When it is built, Jake picks it first
from a labelled board (these pairs are that board's raw material). Before it lands, the builder runs `herdr agent list`
and sends a notice to the HUD owners. After it lands, the builder sends the SHA. Each change only shows on a shard that
opts into levels or the feature (today only the showcase). Every other shard's HUD DOM stays as it is (ruling 19z).

## How a pair is made

- `lib.mjs`: opens a shard through the harness (`window.__wildshardHarness`) and poses the player with
  `__wildshard.pose`. It holds the creatures still, projects world points to the screen with the live camera, hides or
  clones live elements, and burns a three-line label (id and title, plan refs, BEFORE / AFTER) into a 603 px JPEG.
  The first-run control hints ("DRAG TO MOVE") are hidden in every frame, because a returning player never sees them.
- `cap-driftwood.mjs`: most of the changes, in Driftwood Isle. It has the closest look to the showcase's polished toon
  (D9). **Driftwood's crabs, Wendell and Maren stand in for the showcase's robots and NPCs**. The names and numbers are
  the showcase's.
- `cap-others.mjs`: changes that need another shard's live component. Nalati has the real EliteBar, BossBar (name card,
  letterbox, HOLD TO SKIP), storm chip, stealth layer and weapon pie. Pine Hollow has the contract board and the
  crossbow's BOLTS disc.
- `cap-pb-board.mjs` + `codex-pb-board.txt`: UI-21 only, a 3D world sign (see the table).
- `icons.mjs`: prototype glyphs in the engine's icon idiom. A real row registers them through `registerIcons()`.

Run: `scripts/serve-build.sh --head`, then `scripts/browser-lane.sh --max 25 node art/showcase-template/round-12-ui/cap-driftwood.mjs --url=http://127.0.0.1:<port> [--only=UI-04]`.
Use the same form for `cap-others.mjs`.

## The changes

"Exists" means the game already has the component today and the change is content or a small extension of it. "New"
means a new element. Method: **inj** = injected into the live DOM, **live** = the real component driven with showcase
content, **codex** = generative edit (only UI-21).

### Combat and levels

| Id | Change | Slice / rows | Today | Method | Real component | CSS reused | New CSS (proto.css) | HUD |
|---|---|---|---|---|---|---|---|---|
| UI-01 | Bottom XP bar on the touch bar's top edge, LV chip at its left | E0e · HC1 · LVH1 | new | inj | `TouchControls` layer, a generic meter slot in `HUD.ts` / `hudSlots.ts` | `.ws-touch`, `--bar`, the vitals chip's glass | `.ws-game-meter`, `.ws-game-meter-chip` | yes |
| UI-02 | Level-up in a fight: a ring off the chip, the chip flips to LV 7, a one-line gain chip, HP refilled | E0e · HC2 · 19aa | new | inj | the meter + a generic burst in `HUD.ts`; the real VITALS strip | `.ws-game-vitals`, `ws-ring` keyframe | `.ws-game-burst-*`, `.vitals.refill` | yes |
| UI-03 | The tick-up card, only out of combat: each gain in turn, gold on a big roll, grey on 0, TAP TO SKIP | E0e · HC2 | new | inj | new `game/progression/levelCard.ts` | the death card's glass and corner brackets | `.ws-lvcard*` | yes |
| UI-04 | Nameplates within 25 m: "Lv n Name" in the con colour, the HP bar, a stagger bar, burn / shock tint, a RARE tag | E0f · HC4 · LVH2 | exists (the `Combat.ts` bar, kind label) | inj | `Combat.ts` bar pool with a label provider | `.ws-combat-hp*` | `.lv.con-*`, `.ws-combat-hp-stagger`, `-tag`, `.burn` / `.shock`, `.lvl` width | yes |
| UI-05 | Floating text: a big yellow crit, a small grey glance, DEFLECT / PARRY words, red numbers and DODGE on you; 6 on screen | E0f · HC3 · 19r | exists (the number, HEADSHOT, KILL, MISS) | inj | `Combat.ts` `float()` with outcome classes | `.ws-combat-float` | `.crit`, `.glance`, `.fail`, `.parry`, `.onyou` | yes |
| UI-06 | GUARD disc over JUMP, only while the sword is held | W3d · D6 | new | inj | a `hudSlots.disc()` at spot `up0` | `.ws-touch-disc.at.at-up0` | `.ws-touch-guard` (icon size, the parry-window rim) | yes |
| UI-07 | Named-elite banner "NAMED ELITE · LV 6" + the pinned bar with an LV tag | EB · 19f | exists (`EliteBar`) | live + inj | `EliteBar.banner()` / `.show()`, pinned | `.ws-elite-*` | `.ws-elite-lv` | yes |
| UI-08 | Boss bar: the Crate Titan, LV 20, phase notches + caption, phase pips | EB · E13 | exists (`BossBar` notches + PHASE caption) | live + inj | `BossBar.showBar()` / `setPhase()` | `.ws-boss-bar*` | `.ws-boss-lv`, `.ws-boss-bar-pips` | yes |
| UI-09 | Death card: "−340 XP · 25 % of level 7 · never below level 7" | E0e · HC7 · LVH5 | exists (`DeathFade` card) | live + inj | `DeathFade` card + a provider line | `.ws-combat-death*` | `.ws-combat-death-cost` | yes |
| UI-10 | Character tab (read-only): LV and XP, 7 attributes against par, ▲▼ aptitude, what each does, derived numbers | E0f · HC5 · LVH4 | new | inj | a `TabRegistry.tab()` Bag tab, `game/progression/characterTab.ts` | `.ws-gmenu-tab`, `.tabs.review`, `-card`, `-label`, `-note`, `.ws-bar` | `.ws-char-*` | menu |
| UI-11 | The levelled first hint: DEFLECT, fight near your level | E0b | exists (`FirstHints` tag) | inj | `FirstHints` tag, levelled products only | `.ws-hint-tag.desk` | `.proto-wide` (two lines) | yes |

### Quests and the world

| Id | Change | Slice / rows | Today | Method | Real component | CSS reused | New CSS | HUD |
|---|---|---|---|---|---|---|---|---|
| UI-12 | Quest-giver "!" over the givers (yellow = eligible, grey = too low) + pips on the minimap | W1b · HC6 | new | inj | a projected marker (like `EliteBar`'s head bar) + a minimap layer | the elite bar's projection | `.ws-quest-giver`, `.ws-quest-mappip` | yes |
| UI-13 | Dialogue: a quest above your level, REQUIRES LV 7 | W1b | exists (`.ws-quest-talk`) | live + inj | the real dialogue panel (Wendell's talk) + a gate row | `.ws-quest-talk*` | `.ws-quest-talk-gate` | yes |
| UI-14 | Quest list on the map tab above the quest card: 11 active, 1 done, one tracked | W1b · D13 · D14 | new (one quest card today) | inj | `Menu.ts renderQuest()` | `.ws-gmenu-mapquest*`, `-label` | `.ws-gmenu-qlist`, `-qrow`, `-qmore` | menu |
| UI-15 | Shift Orientation: the tour step on the quest chip + a step toast | W1b · D4 | exists (the quest chip, toasts) | live | `.ws-quest-obj`, `HUD.toast()` | all | none | no |
| UI-16 | Contract board, fixed mode: level-locked rows, first-time trophy + title | E1f · QC5 · LE8 | exists (Pine's lodge board, rotating draws) | live + inj | Pine's real board (opened from its interactable) with fixed, level-locked notes | `.ws-ph-board`, `-note*`, `-tally`, `-foot` | none (a locked note is the note greyed) | no |
| UI-17 | Checkpoint card: a quest leg done, CHECKPOINT SAVED | QC6 · E1g | new | inj | the quest reward caption | `.ws-quest-reward*` | `.checkpoint`, `.ws-quest-saved` | yes |
| UI-18 | Feat toast + FINDS toast with showcase content | W9b · 19i | exists | live | `HUD.toast()` | all | none | no |
| UI-19 | Shard-complete card: the Titan Cleaver | 21 · W17 | exists (`ShardComplete`) | live | `ShardComplete.open()` | `.ws-complete*` | none | no |
| UI-20 | Course clock chip under the quest chip, only during a run | W6d · D22 | exists (Nalati's weather chip) | live | `HUD.setWeather()` chip, a stopwatch icon | `.ws-game-weather` | `.clock`; the stacking (see the findings) | yes |
| UI-21 | Personal-best board at a course start | W3a · W6d | new (a world sign) | **codex** | a records world-sign row | n/a (3D) | n/a | no |
| UI-22 | Storm hour: the storm chip reads STORM HOUR + four beacons on the minimap | QC Lights Out · 8 · W11a | exists (Nalati's storm chip) | live + inj | `HUD.setWeather()` + a minimap marker layer | `.ws-game-weather.storm` | `.ws-minimap-beacon`, `.hour` | yes |
| UI-23 | Stealth yard: the stealth layer's hidden state reads UNSEEN | QC Keycard | exists (Nalati's stealth layer) | live rows | the phone's stealth row in the status column (the eye pip is desktop only), its label from `stealth.json` | `.ws-touch-row.ws-stealth-row` | none | no |
| UI-24 | Gauntlet wave banner + wave chip | EB · E11c | new | inj | the boundary warning's type + the weather chip | `.ws-game-boundary`, `.ws-game-weather` | `.wave` | yes |
| UI-25 | Portal prompt: ENTER on the USE band | 19ac · DG | exists (the USE band) | live | `.ws-touch-use` from the interact prompt | all | none | no |
| UI-26 | Boss intro: letterbox, title card, HOLD TO SKIP | 19j · EB | exists (`BossBar` name card) | live | `BossBar.showNameCard()` / `setSkip()`; the HUD hidden as in the intro | `.ws-boss-card*` | none | no |
| UI-27 | Map heat map: the level bands on the map tab, a CON key | map plan | new | inj | the map tab canvas + an overlay | `.ws-gmenu-mapcanvas`, `-legend` | `.ws-gmenu-heat`, `-heatkey` | menu |
| UI-28 | Minimap band border: an orange arc + "BAND 3 · LV 7–9 AHEAD" | map plan · 19aa | new | inj | a `Minimap` rim layer | `.ws-minimap` | `.ws-minimap-band`, `-bandtag` | yes |
| UI-29 | Training Vault sealed room: ROOM 2/4 · 3 LEFT + the seal toast | DG1 | new | live + inj | the weather chip + `HUD.toast()` | `.ws-game-weather` | `.wave` | yes |
| UI-30 | SHRINE COMPLETE card: time, best, deaths, rooms, chest, trophy | DG3 | exists (the complete card's layout) | live | `ShardComplete` with shrine data | `.ws-complete*` | none | no |
| UI-31 | Hover park: trick words + the running trick score | W5b | new | inj | the float's type + the weather chip | `.ws-combat-float`, `.ws-game-weather` | `.trick` | yes |

### Economy

| Id | Change | Slice / rows | Today | Method | Real component | CSS reused | New CSS | HUD |
|---|---|---|---|---|---|---|---|---|
| UI-32 | Tinker Rook's stall: UPGRADES / BENCH tabs, Scrip + parts, LV locks | W2b · 19g · LE5 | exists (`ShopPanel`, Maren's counter) | live + inj | `ShopPanel` big-cards sheet | `.ws-shop*`, `.ws-icard-tile*` | `.ws-shop-tabs`, `.ws-icard-lv`, `.ws-icard-parts` | no |
| UI-33 | The weapons shop: weapons bought, locked by level | W2b · 19j | exists (`ShopPanel`) | live + inj | the same panel, a third keeper | as UI-32 | as UI-32 | no |
| UI-34 | 20-slot pack: one slot a kind, unfound kinds as silhouettes | W2a · loot 4 | exists (PACK, 12 slots) | live + inj | `game/bag/tabs.ts renderInventory` | `.ws-gmenu-grid`, `-slot`, `-sicon`, `-count`, `-packnote` | `.twenty`, `.unfound` | menu |
| UI-35 | Crossbow ammo: a pouch row under the bolts chip + an ammo picker (iron / pitch / broadhead) | W3b · D17 · D18 | half (Pine's BOLTS disc cycles bolt kinds) | inj | a `hudSlots` status row + the `WeaponStrip` pie on the BOLTS disc, fanned left on the right edge | `.ws-touch-row`, `.ws-game-bolts`, `.ws-touch-pie*` | `.ws-game-pouch` | yes |
| UI-36 | Trophy wall: a hung trophy's perk card | loot 7 | exists (the item card) | live | `HUD.pickupCard()` (`ItemCardPop`) | `.ws-icard-pop*` | none | no |
| UI-37 | The range lends every weapon inside its fence | W3a · D2 | exists (the weapon pie) | live + inj | Nalati's real pie (a real CDP touch long press on SWAP), LOAN tags | `.ws-touch-pie*` | `.ws-touch-pie-label .loan` | yes |
| UI-38 | Scrip on the currency chip + "+3 Scrip · +1 Servo" on a kill | W2a · E1d · E1e | exists (the coin chip, toasts) | live + inj | `.ws-loot-chip` with the Scrip icon | `.ws-loot-chip` | none | no |

## Findings for the builders

1. **The chip under the minimap is taken.** On a shard with a quest chip, today's weather chip
   (`game.css .ws-game-weather`, Nalati) and the toast column both start right under the minimap, so they overlap. D22's
   course clock, the wave / room counters and the storm-hour chip all want that slot. The prototypes stack them: the
   quest chip, then the chip (right-aligned to the minimap), then the toasts stepped down under it (`lib.mjs restack`).
   The shared slot needs that order in `HUD.placeToasts()` before any of them lands.
2. **The XP bar and the GUARD disc fit the portrait HUD without moving anything.** The bar sits on the touch bar's top
   hairline. Its chip sits over MOVE, where the left edge is free. GUARD takes the existing `up0` slot over JUMP. The
   USE band already moves up for that slot.
3. **The levelled nameplate is wider than today's kind label** (a 120 px plate against 72 px). "Lv 9 Plumb Drone" wraps
   at today's width. With six plates over a bunched pack the labels touch, which is why E0f keeps the nearest six.
4. **Pine already has half of the ammo picker**: its BOLTS disc cycles the bolt kinds (`loadout.cycleBolt`). W3b
   generalises that disc and adds the pouch counters (D17) instead of building a new control.
5. Not prototyped: the **Shift Orientation tour's world markers** (they are the quest chip's existing markers) and the
   **cutscene's camera moves** (motion, not UI: E14's job).
