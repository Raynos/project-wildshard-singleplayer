# Nalati merge review: the player-facing side

Written 2026-09-24 by a review agent, for ask N16. This is a report only: nothing was built, committed or pushed.

**What was reviewed:** main's work since Nalati branched (`git log --no-merges --since="2026-09-22 17:36" origin/main`,
about 284 commits), read against this worktree after main was merged in (`1a0f1ef`, `deddcb9`, HEAD `25e7cd8`).

**Evidence:** live phone captures at 390×844 (`?touch=1&tier=phone&mute=1`, dev server :5188, one muted Metal browser,
closed afterwards), in `progress/nalati-merge/review/`:
- `nalati-foot.jpg`, `nalati-mounted.jpg` (`&ride=gallop`) and `driftwood-main.jpg`;
- `*-rects.txt`, the live position of every HUD element.

## Summary

| Area | Main has | Nalati today | Proposal | Size |
|---|---|---|---|---|
| Touch HUD base | Layout E: 45 / 55 bar, ATTACK on the divider (hold = heavy), LOOK pad, one look rate, DODGE / JUMP arc, LOCK (J), HOVER tab (C), fps pill, VITALS top-left, minimap 80 % + one quest chip (G) | Sits on top of E, but was designed for the old layout A. **Broken after the merge:** DODGE over DRAW / LOCK, CROUCH over JUMP, SWAP pill + weapon strip both shown, GALLOP / LEAN / OFFER at the top of the screen, HOVER in the saddle, "HORSE · 1 M" under the crosshair, LOCK is a dead button | Fix the breakage first, then one HUD mockup round (A–D below) | S (fixes) + M (round) |
| DISMOUNT | Small edge tabs (HOVER) | A full-width USE band (the N17 agent's working tree is replacing it with an edge tab) | The HORSE edge tab ⇄ DISMOUNT, one toggle | S |
| Nalati screen pieces | One chip under the minimap | Storm chip, GET LOW, elite bar / banner, boss bar all hard-coded at the **old** 34vw minimap; GET LOW lands on the boss bar | One under-minimap stack anchored to the minimap's rect | S–M |
| Bow (N18) | ATTACK = FIRE for ranged, AIM latch | Quick-fire FIRE + a separate DRAW disc | ATTACK = hold to draw / release to loose; AIM = zoom | M |
| Remaster look | Toon lighting, LUT, stylized sky, ramp fog, clean post, wind, ground cover, Blender bake, E89 / E91 / E90 / E70 fixes | Look v2 already covers the lighting / fog / sky / grade / wind / grass in painterly form | Adopt E89 shadow step + E91 NaN clamps; measure the inherited E70 2× DPR + 80 m animal shadows; adapt ΔE score, GLB AO, terrain-in-bake, Debug card; skip the low-poly tools | S → M |
| Music | Three MiniMax styles, adaptive calm / tension stems, 3 stings, slots `pine` / `island` / `title` | **Plays Pine Hollow's theme**; boss / elite only push tension | A per-shard slot engine + a Kazakh steppe score (calm-day / night / storm / 2 bosses + 6 stings), 3 zone variants | M + L |
| SFX / ambience | A generated set (MOSS vs Stable Audio, 82 files), Driftwood's zoned `IslandAmbience`, `IslandSfx` | ~40 synth voices, well wired; **none generated**; Pine / Driftwood samples leak in (the eagle screams with the monkey, the leopard growls with the bear, pine-litter footsteps) | Quick fixes now; a Nalati sfx set (~40 families); a `SteppeAmbience` with the 3 zones + night + storm | S + L + M |
| Quest layer | THE SEALED RING, NPC talk, the quest chip, saved places, reward view (`installAdventure` Driftwood-only) | Nothing: no NPCs, places discovery not saved, trophies unused | Q1 "THE KING'S PLAQUE" first; split a generic quest core; painterly NPCs; events → flags | M–L |
| Other | Death toast, hurt arc, Debug card, resume, EXPLORE, feedback context | Wrong death lines (south gate, "Fell too far" for lightning), no hurt arc, dead Tracer / Swing settings, EXPLORE off | Small fixes, listed in §5 | S each |

## 1. The HUD

### 1.1 What main's HUD is now (the base Nalati must sit on)

Nalati's touch controls were designed against the **old** layout A: edge docks, AIM on the *left* thumb, HOVER / SWAP
as mid-screen edge tabs, and a `bottom` default on every disc (`art/touch-buttons/round-1/buttons-A-edges.png`). Main
replaced all of that. Today's base, at 390×844:

| Piece | What it is now | Ask · commit | Mockup round → pick |
|---|---|---|---|
| Glass language | Dark navy glass, 1 px cyan hairlines, mono uppercase labels | — | `art/hud/round-4-k-variants` **K1**, `round-6-p-bar-layouts` **P2** |
| Bottom bar | 67 % solid (was 75 %, E34) and see-through. Split 45 / 55 (`--split`). Height `max(15vh,104px)` = 127 px (y 717–844). Portrait-only rotate gate (E38). | E34 `6660585`, E42 `d57dc1a`, E46, E58 `0c5f16f` | `round-8-thumb-audit` (live audit) → `round-9-layout-board` A/B/C (none) → `round-10-look-zone` **E** |
| MOVE stick | Always drawn: a cyan ring with a glowing knob, anchored. A SPRINT tag lights above the bar. Sprint lock removed for good (E79). | E42, E79 `2e6362e` | round-10 E |
| ATTACK disc | 94 px, left edge on the divider, fires on touch-down. A drag from it turns the camera. Holding still 0.25 s charges the heavy (ring fills), lifting chops. Reads FIRE with a ranged weapon. | E42, E46 | round-10 E |
| LOOK pad | A dashed square beside ATTACK. The whole right 55 % looks at **one** look rate (R17). | E42 | round-10 E |
| Right-thumb arc | DODGE (lower-left) + JUMP (upper-right) at the right edge. LOCK up-left of DODGE (melee only). AIM up-right of FIRE (ranged only). DODGE has a 0.8 s clock-sweep cooldown. | E42, E59 `87c7d62`, E50 `7314835` | `art/combat/round-1-lockon` **J** |
| Dodge feel | T (lean + smear); V deleted | E63 → E82 | `art/combat/round-2-dodge` **T** |
| HOVER | A folder tab growing out of the bar's top edge over MOVE | E80 `6c28553` | `art/hud/round-11-hover-position` **C** |
| SWAP | A pill on the divider on the bar's top edge, only once a second weapon is unlocked | E42 / E46 | round-9 / round-10 |
| Top-left column | PAUSE + a "60 fps 17 ms" pill (tap = stats over the minimap). Under them: VITALS, BOLTS, the ✎ NOTE disc, then feed / toasts. | E47 `6073b55`, E26 | — |
| Minimap | 80 % (27.2vw on a phone, 106 px). Heading readout removed. Tap = the MAP tab, whose tiles stay sharp (E97). | E51 `4a3b192`, E97 `8c9a03f` | `art/quest/round-1-compact` **G** |
| Quest chip | ONE line under the minimap, right-aligned to it: `◆ WHO LIT THE FIRE? │ CASTAWAY 164 M ▲`. The full quest card is on the MAP tab. | E51 | quest round-1 **G** |
| Lock-on | Zelda-style ▼ + corner brackets + a name / health tag, an edge chevron `‹ 4 M`, SWITCH on the LOOK pad, ORBIT on MOVE. Toggle; auto-locks the next target within 8 m; Gentle camera. | E50 | lock-on **N** |
| Hurt arc + shake | A red arc toward the attacker, trauma shake | Driftwood remaster B3 | — (island only, see below) |
| Resume screen | A blurred last frame + "RESUMING" after an app switch | E61, E96, E98 | — |

**The rules main learned the hard way, which Nalati must keep:**
1. **The left thumb only moves**, and nothing is pressed with it mid-fight (E37 audit F2 / F3).
2. **Reflex actions sit on the right-thumb arc**, within about 130 px of ATTACK.
3. **Rare toggles are small tabs flush with an edge** (HOVER on the bar edge, E80), never big bands.
4. **Status sits in the top-left column**, out of the thumb lane (R18).
5. **World information is ONE chip under the minimap** (E49 / E51: "too much prime space, screen too cluttered").
6. **Taste is the user's call:** every placement goes out as lettered mockups first.

### 1.2 Nalati's own HUD elements, measured on the merged build

Measured live at 390×844 (`progress/nalati-merge/review/nalati-foot.jpg`, `nalati-mounted.jpg`, `*-rects.txt`).
"Broken" means it is wrong on this branch right now, because main's layout moved under it.

| # | Element | File | Where it is now (phone) | State after the merge |
|---|---|---|---|---|
| 1 | **Weapon strip** 1 / 2 / 3 (bow · sabre · spear, ammo in the corner) | `src/ui/WeaponStrip.ts`, touch.css | 3 × 42 px slots at (83, 623), above the bar left of centre | **Broken:** main's **SWAP pill still shows** beside it. The `.ws-touch.strip .ws-touch-disc.swap` rule misses main's `.ws-touch-pill`. The strip also sits over the move thumb's side. |
| 2 | **DRAW** (bow: the AIM disc relabelled, ring = draw) | TouchControls.ts, `src/player/Bow.ts` | (269, 619) | **Broken:** the Nalati **DODGE override sits 37 px over DRAW** (`.ws-touch.nalati .ws-touch-disc.dodge`, written for the old layout). ATTACK reads **FIRE** and quick-fires, which is exactly what N18 rejects ("tap and hold to draw … AIM shouldn't be DRAW"). |
| 3 | **THROW / BRACE** (spear, both held) | TouchControls.ts, `Spear.ts` | THROW in AIM's spot, BRACE in JUMP's spot | Works, but **no JUMP while the spear is held** and no LOCK (the spear is not in `MELEE`) |
| 4 | **CROUCH** disc (long grass only, a toggle, pulses the first time) + the `TALL GRASS` hint chip | `src/nalati/stealth.ts`, touch.css | Above the JUMP column at `bar+44+disc+8` | **Broken:** main raised JUMP to `bar+58`, so CROUCH **overlaps JUMP by 6 px**. The hint chip's position is computed from the old layout. With the sabre, the Nalati DODGE override also overlaps **LOCK**, by about 40 px between centres. |
| 5 | **Stealth**: an eye pip under the crosshair (VISIBLE / HIDDEN / NOTICED / DETECTED), an amber threat chevron circling the crosshair, a GRASS cover meter on the left edge, a red DETECTED vignette | `stealth.ts`, `stealth.css` | Pip at (150, 455). Meter at the left edge, 30 % down. | OK. It is a third "direction" chevron system, beside lock-on's edge chevron and the elite's gold chevron. |
| 6 | **HORSE** tab (far = whistle, near = mount) | `src/ui/RideHUD.ts`, ride.css | Right edge (338, 328), 52×52 | OK. **This is the pattern the user wants for DISMOUNT.** |
| 7 | **DISMOUNT** | Mount.ts through the **USE band** | A 366×60 full-width band at y 529 (captured) | **Too big** (N17). It is the old USE band, which main never re-seated (R16 is still an idea). **Being fixed right now:** the N17 riding agent's uncommitted `RideHUD.ts` / `ride.css` adds a `ws-ride-dismount` tab, the HORSE tab's twin on the right edge, and hides the band while it reads Dismount. That matches this proposal. |
| 8 | **GALLOP** (held) | RideHUD.ts | Should be in JUMP's spot | **Broken as captured: drawn at (322, 0), top-right, behind the minimap.** Main dropped the default `bottom` from `.ws-touch-disc`, and `.ws-ride-gallop` only set `left`. The N17 working-tree edit now gives GALLOP a `bottom` (JUMP's `bar + 58px`). **LEAN L / LEAN R / OFFER still have only `left`**, so they will render at the top of the screen during taming. |
| 9 | JUMP / DODGE / HOVER hidden in the saddle | RideHUD.ts `showDisc` | — | **Broken:** it hides `.ws-touch-disc.hover` and `.ws-touch-disc.heavy`, and neither exists on main. Main's **HOVER tab stays visible in the saddle** and on foot in Nalati. |
| 10 | **STEED** strip (amber stamina bar + gait + the horse's name, amber `winded`) | RideHUD.ts | (12, 662), 162×22, above the bar, under the weapon strip | Orphaned. It was designed to ride on VITALS, and main moved VITALS to the top-left. |
| 11 | **Taming**: TRUST arc (top centre), the stallion's ALERT ear, the HOLD ON gauge + `TAMING n/5`, LEAN L / R, OFFER | RideHUD.ts | Top centre / bottom centre above the bar | The arcs are OK. The discs have the item 8 bug. |
| 12 | Horse name tags `TULPAR ♥` | RideHUD.ts | In the world | OK |
| 13 | Crosshair target label | `src/ui/Combat.ts` / AimTargets | — | **Bug:** in the saddle it reads **`HORSE · 1 M`** because it targets your own mount. |
| 14 | **Elite**: a bar over its head that pins top-centre once the fight starts, the `NAMED ELITE NEARBY` banner, a gold edge chevron, skulls on the minimap | `src/ui/EliteBar.ts`, elite.css, `src/game/Elite.ts` | Pinned at `ws-top + 34vw + 58px`; banner at `+34vw+44` | Stale maths: `34vw` is the **old** minimap size (main's is 27.2vw), which leaves about a 26 px dead gap. It also doubles up with lock-on's own name / health tag on the same enemy. |
| 15 | **Boss**: a wide gold bar with phase notches, a letterbox name card, HOLD TO SKIP, retry, the reward card | `src/ui/BossBar.ts`, boss.css | The phone bar is at `ws-top + 34vw + 58px`, **the same slot as the pinned elite bar** | Same stale `34vw` |
| 16 | **Storm chip** (`STORM IN 0:45 · WIND 14 m/s`) + the amber `LIGHTNING — GET LOW` warning | HUD.ts `setWeather`, game.css | Chip under the minimap, centred on the **old** minimap's centre. GET LOW at `+34vw+70` ≈ y 208. | **Collides:** the chip takes main's **quest-chip** slot, and **GET LOW lands on the boss bar** (y ≈ 192–212). In the Jel Ata fight (a storm boss) both are up at once. |
| 17 | **Hunter's eye** (the bow's dotted drop arc, in the world) | Bow.ts, Settings `huntersEye` (Nalati only, on by default on touch) | — | OK |
| 18 | **Day clock** | `src/world/DayClock.ts` | **No HUD exists** | Night changes play (ghost riders, the wolf chorus, stealth `light`) with no way to read the time |
| 19 | **Hurt arc + trauma shake** | `src/ui/HurtArc.ts`, main.ts:547–548 | — | **Not in Nalati:** gated `chunk.weapon === 'sword'`, although wolves, elites and bosses hurt you |
| 20 | **Lock-on** | LockOnTarget.ts | The LOCK disc shows with the sabre | **A dead button.** TouchControls' `MELEE` includes `sabre`, so LOCK shows. But `LockOnTarget.ts:47–48` only locks with `sword` / `sword-iron`, and its `HOSTILE` set has no Nalati kind (wolf, kokbori, leopard, eagle, ghost rider, balbal, Golden King). The spear gets no LOCK. The bow waits on E75 (ranged lock: the camera locks, aim stays manual). |
| 21 | Minimap / MAP labels | Minimap.ts / Map.ts | — | N15 in flight ("too much text") |

**Plain merge breakage:** items 1, 2, 4, 7, 8, 9, 13 and 20, plus the stale `34vw` maths in 14–16. They should be
fixed before any mockup round, so the mockups start from a frame that isn't broken. None of them is a taste question.
Items 7 and 8 are already being fixed in the N17 working tree.

### 1.3 Where each Nalati element should go: the proposal, common to every variant

- **Bow (N18):** ATTACK **is** the draw. Hold ATTACK = draw (the ring fills), lift before full = cancel, lift at full =
  loose. The disc label reads `DRAW`, sub-label `HOLD · RELEASE`. The AIM disc (up-right of ATTACK, main's spot) is the
  **zoom** latch `AIM`, as N18 asks: it changes the view, not the draw. Hunter's eye stays in the world.
- **Sabre:** exactly main's melee: `ATTACK` / `HOLD = HEAVY`, plus LOCK (J) up-left of DODGE.
- **Spear:** ATTACK = thrust. THROW takes AIM's spot, and **BRACE takes the CROUCH / extra slot above JUMP, not JUMP's**, so
  you can still jump with a spear. Add the spear to `MELEE` for LOCK.
- **CROUCH:** stays context-only (the user's decision D). It moves to `bar + 58 + disc + 8` so it clears main's JUMP.
- **DISMOUNT:** the HORSE edge tab **becomes** DISMOUNT while mounted: the same 52×52 tab on the right edge, amber, glyph
  = horse + down-arrow. It is a toggle in the user's words: one tab that reads `HORSE` on foot and `DISMOUNT` in the
  saddle. The USE band never says DISMOUNT again.
- **GALLOP:** held, in JUMP's spot (JUMP hides in the saddle). The amber fill while held is kept.
- **STEED:** joins the **top-left status column** under VITALS: an amber bar, the horse's name, and the gait
  (`CANTER`) on the right.
- **Hide in Nalati:** the HOVER tab (the hoverboard contradicts horses; a decision below) and the SWAP pill (the strip
  replaces it).
- **One under-minimap stack** replaces four hard-coded `34vw` positions. A flex column is anchored to the minimap's rect,
  the way E51 already places the quest chip. The rows are:
  1. the quest chip;
  2. the storm chip, merged into the same line when both are up (see the variants);
  3. the pinned elite bar or the boss bar, never both;
  4. banners (`NAMED ELITE NEARBY`), then `LIGHTNING — GET LOW`, always *below* the bars.
- **Direction cues, one language:** lock-on's cyan edge chevron (a target), the elite's gold edge chevron (a threat
  off-screen), the stealth amber chevron circling the crosshair (who is noticing you), and main's red hurt arc (who hit
  you). Keep all four, but by colour rule: cyan = yours, gold = elite / boss, amber = awareness, red = damage. Adopt the
  hurt arc in Nalati.
- **Lock tag vs elite bar:** when the locked target is an elite or a boss, lock-on's name / health tag stands down and the
  pinned gold bar is the health readout.
- **Day clock:** a small sun / moon glyph + phase word. Where it goes differs per variant.

### 1.4 HUD variants A–D for a codex mockup round (portrait phone 390×844)

**How to run it** (AGENTS.md "Mockups"; save to `art/nalati-grasslands/round-10-hud-on-main/`; the board goes to the
user as one side-by-side image, lettered):
- **The reference is the live capture, not a blank frame.** Fix the item 1–9 breakage first, then recapture
  `nalati-foot.jpg` / `nalati-mounted.jpg`, or use today's captures and tell codex to remove the SWAP pill, the HOVER tab
  and the DISMOUNT band.
- **Two frames per variant, 8 images:** **F1 on foot** and **F2 in the saddle**.
- An optional **F3 stress frame** for the chosen variant only: the Jel Ata fight in a storm, with the boss bar, GET LOW
  and the storm chip all up at once.

**COMMON block (every run):**

> A real print-screen of the game Wildshard running in mobile Safari on an iPhone, portrait 390×844, no device frame,
> no browser chrome, no watermark. The game is a stylized painterly first-person action game set on the Nalati Grasslands
> (a Kazakh steppe of golden-green grass, snow peaks, felt yurts, a huge ringed gas giant in the sky). Keep the attached
> reference screenshot's world, camera, viewmodel and existing HUD exactly: dark navy glass `#0d1b26` at ~80 %, 1 px cyan
> `#8fe3ff` hairlines, letter-spaced monospace uppercase labels, no gradients, no emoji. Existing HUD that must stay as
> in the reference:
> - Top-left: a glass `PAUSE` button with a `60 fps 17 ms` pill beside it. Under them, the VITALS row: a heart,
>   `100`, a cyan bar, `VITALS`.
> - Top-right: the round minimap, 106 px, with an `N` tick.
> - Bottom: a see-through glass bar across the bottom 127 px, split 45 / 55 by a thin vertical line. Left section: the
>   label `MOVE` and a cyan ring stick with a glowing knob. On the divider: a big round ATTACK disc, 94 px. Right: a
>   dashed rounded square `LOOK`.
> - Right-thumb discs are 59 px glass circles with an icon and a tiny label.
>
> Nalati colours: gold (`#e7b44a`, engraved serif capitals) is ONLY for elites and bosses; amber `#ffc44a` is the
> horse / stamina and warnings.

**SCREEN blocks.** Every string of UI text is given verbatim in quotes. The F1 / F2 world states shared by all variants:
- **F1 (on foot):** standing in waist-high golden grass, crouched. The bow is drawn half-way. The quest chip reads
  `◆ THE GOLDEN KING 1/3 │ GREAT KURGAN 640 M ▲`. A storm is coming: `STORM IN 0:45`, `WIND 14 M/S`. The stealth pip
  under the crosshair: a closed-eye icon + `HIDDEN`. On the left edge, 30 % down: a thin vertical meter labelled `GRASS`,
  filled cyan.
- **F2 (in the saddle):** galloping on a brown horse (the mane and ears in view), the sabre held. The horse is `TULPAR`, gait
  `GALLOP`, stamina 70 %. A named elite has just been spotted: a slim glass banner with gold edges, a gold skull,
  `NAMED ELITE NEARBY`, `AQBARS THE PALE`. A gold chevron sits at the left screen edge, halfway up.

#### A: "Edge tabs" (the user's words taken literally; the smallest change from main)

- **Right edge**, flush, stacked, 8 px apart, starting 40 % down: one 52×52 tab with a horse glyph, `HORSE` (F1) /
  `DISMOUNT` with a down-arrow, amber-lit (F2). Under it, three 44×44 weapon tabs, `1` bow, `2` sabre, `3` spear, with
  ammo `18` on the bow and `3` on the spear. The held one is outlined cyan.
- **Right-thumb arc:**
  - F1: `DODGE` (lower-left), `JUMP` (upper-right), `CROUCH` (lit cyan) directly above JUMP, and `AIM` (a crosshair
    icon) up-right of the ATTACK disc. The ATTACK disc reads `DRAW` with a small `HOLD · RELEASE` under it and a cyan ring
    half-filled.
  - F2: `GALLOP` (a horseshoe, amber-filled, held) in JUMP's spot, `LOCK` up-left of it, and no DODGE. ATTACK reads
    `ATTACK`, `HOLD = HEAVY`.
- **Top-left column:** F2 adds a STEED row under VITALS: a horse glyph, `TULPAR`, an amber bar, `GALLOP`.
- **Under the minimap, right-aligned:**
  - F1: the quest chip line, and under it the storm chip `STORM IN 0:45 · WIND 14 M/S`.
  - F2: the elite banner under the quest chip.
- **Day clock:** a small sun glyph on the minimap's rim at the 4 o'clock position.
- **No** HOVER tab, **no** SWAP pill, **no** full-width button anywhere.

#### B: "Bar-edge folder tabs" (E80's HOVER tab idea, extended)

- **Tabs growing out of the bar's top edge**, in the same style as main's HOVER tab:
  - **Left, over MOVE:** a weapon tab: the held weapon's icon + `BOW` + `18`. Beside it, two small dim slots showing the
    other weapons' icons (sabre, spear `3`), so all three read as one segmented tab.
  - **Right, over the LOOK pad:** a tab with a horse glyph + `HORSE` (F1) / `DISMOUNT` amber (F2).
- **Right-thumb arc:** as A.
- **STEED (F2):** a thin amber line running along the top edge of the MOVE section, with `TULPAR · GALLOP` in tiny
  amber letters at its left end. There is no STEED row in the top-left column.
- **Under the minimap:**
  - F1: ONE merged chip, two lines: `◆ THE GOLDEN KING 1/3 │ GREAT KURGAN 640 M ▲` on the first, and a small storm
    icon + `STORM IN 0:45 · WIND 14 M/S` on the second.
  - F2: the elite banner below it.
- **Day clock:** at the right end of the fps pill: a sun glyph + `DAY`.

#### C: "One arc and a weapon card" (CoD Mobile's weapon card; the most compact)

- **All right-thumb actions on one arc**, about 115 px from ATTACK's centre:
  - F1, from left to right: `AIM` (at 11 o'clock), `CROUCH` (12 o'clock, lit), `DODGE` (1 o'clock), `JUMP`
    (2 o'clock).
  - F2: `LOCK` (11 o'clock), `GALLOP` (2 o'clock, amber, held).
- **A weapon card** (72×28) sits on the bar's top edge on the divider, where the SWAP pill was: the held weapon's icon +
  `BOW  18` + three dots with the first lit. Tap = next weapon, swipe up = a fan of all three.
- **Right edge:** only the small 52×52 `HORSE` / `DISMOUNT` tab, 40 % down.
- **Top-left column:** VITALS, then (F2) STEED `TULPAR` + an amber bar + `GALLOP`.
- **Under the minimap:** the quest chip. The storm shows as a small storm glyph + `0:45` at the chip's right end (F1).
- **Day clock:** a sun glyph + `DAY 1` as a tiny label under the minimap's `N`.

#### D: "Status on the left, actions on the right" (a clean centre, everything readable at a glance)

- **Left column** under PAUSE, stacked glass rows, all 170 px wide:
  - VITALS;
  - F2 STEED (horse glyph, `TULPAR`, amber bar, `GALLOP`);
  - the bow's `ARROWS 18 / 24`;
  - a sky row: a sun glyph, `DAY`, then a storm glyph, `STORM IN 0:45`, `WIND 14 M/S`. This merges the day clock and the
    storm chip.
- **The weapon strip** runs vertically on the **left screen edge**, 45 % down: three 44×44 tabs, `1` `2` `3`, the held
  one outlined cyan. The only left-side control, and never used mid-fight.
- **Right edge:** the `HORSE` / `DISMOUNT` tab.
- **Right-thumb arc:** as A.
- **Under the minimap:** only the quest chip; the elite banner goes under it in F2.
- **The stealth pip** moves out of the crosshair into the left column as a fifth row: an eye + `HIDDEN`. The crosshair
  stays bare.

**Why these four:**
- **A** keeps main exactly and only adds edge tabs.
- **B** follows the one tab pattern the user already picked (E80).
- **C** is the fewest elements on screen.
- **D** is the most readable while riding (a single glance to the left).

The mockup to recommend is **A** (the fewest new ideas; it matches "a small toggle on the right edge like the other
things"), with **C's weapon card** as the likely follow-up if three tabs feel heavy.

Re-roll rule (from main's rounds): reject any image where DODGE / JUMP drift into the bar, where the bar or the ATTACK disc
changes size, or where the quest chip text is garbled. Name the re-rolls in the README entry.

## 2. The Driftwood remaster techniques: what Nalati should do

**Short answer: most of the remaster's look work is already done in Nalati, in a stronger painterly form, by its look
v2** (`src/nalati/look/*`, the default render path).

Driftwood's systems are gated to `style === 'lowpoly'`:
- `installStylize()` runs in `Sky.build()`;
- `Sky.lut` is only set in `setupStylized()`;
- `Game.buildComposer()` returns `buildLookV2Chain()` first when `LOOK_V2`.

So Nalati never runs toon lighting, the colour lookup table (LUT) or the clean post chain. That is right: they are
low-poly tools. What leaked in is the shared phone tier (`src/core/tier.ts`), plus two bug classes Driftwood found that
Nalati also has.

| # | Driftwood technique (ask) | Files | Nalati today | Do | Why · size |
|---|---|---|---|---|---|
| 1 | Toon lighting: 2-band ramp, coloured shade, warm terminator, rim (L1 / E87) | `src/world/stylize.ts` | `src/world/painterly.ts`: 3 soft bands, `uPShade` coloured shade, `uPWarm`, rim, `uPFloor`, `uPWet`, and `look/light.ts` `LightCheat` | **Skip** | Already more than this, in one shader |
| 2 | Cloud shadows (L4) | stylize `toonCloud()` | `Atmosphere.ts` `patchCloudShadows()` | **Skip** | Has it |
| 3 | Colour-ramp fog (L3) | stylize `RAMP_FOG` | `look/fog.ts`: fog coloured from the panorama by compass direction, through the grade's inverse | **Skip** | Stronger: 3D dissolves into the painting at every angle |
| 4 | Stylized sky + faceted clouds (L2 / E83), painted horizon (X4 / E78) | `StylizedSky.ts`, `HorizonMatte.ts` | `SkyDomeV2`: one seamless painted 360° panorama | **Skip** | Faceted clouds clash with painting. The panorama is already the "painted only at infinity" rule. |
| 5 | **Shadow step (E89)**: the sun's shadow direction moves in 0.25° steps, so shadows don't crawl | `src/world/DayNight.ts` `SHADOW_STEP` | `DayClock` / `LightCheat` call `setKeyLight()` every frame, so shadows crawl ~0.24°/s. The bake re-bakes in 1.5° jumps about every 6 s. | **Adopt** | The same crawl the user filmed on Driftwood. S (+ M to fade between two bakes). |
| 6 | **NaN clamp (E91)**: clamp `pow(1−N·V)` so an iPhone NaN pixel doesn't become a bloom-smeared black square | `StylizedSky.ts`, `Sky.ts`, `Ocean.ts` | Unclamped: `src/nalati/ghostRiders.ts:90`, `src/world/nalati/KurganDungeon.ts:110/131`, `src/world/GrassPainterly.ts:329` (v1 grass) | **Adopt** | Desktop Nalati has bloom. S. |
| 7 | Learned LUT + ΔE colour-error score (X1 / E85) | `src/world/lut.ts`, `scripts/fit-lut.py`, `scripts/palette-delta.py` | A formula grade (`GradeV2Effect`) + its exact inverse. **No numeric colour check;** the 9-angle sheets are judged by eye. | **Adapt** | (a) Copy `palette-delta.py` with Nalati camp regions: numbers against the targets (S). (b) Optionally fit a LUT and fold it into the grade pass, with the painted sky held unchanged (M, taste, as a Debug switch). |
| 8 | Clean post (L5 / E88): no haze / grain / fringe, bloom only above 1.0 | `Game.buildComposer` `chain(clean)` | Already clean (MSAA + grade; bloom on desktop only) | **Skip** | Optional vignette inside the grade (S, taste; look-pass lever 8 asked for one) |
| 9 | Shared wind + swaying shadows (M5) | `src/world/wind.ts` | `src/world/steppeWind.ts`: moving gust fronts, GPU = CPU, driven by the weather | **Skip** | Nalati's wind is richer. Spruce shadow sway isn't worth the cost. |
| 10 | Ground cover (M4) | `GroundCover.ts` | v2 GPU grass rings + shader flowers + trample + dressing layers | **Skip** | Equivalent. N14's denser camp flowers are content, not a system. |
| 11 | No pop-in (E90), and the same bug on Pine (E94) | `BlenderIsland.ts`, `tier.ts` | Spruce goes through the shared `Forest.ts` (phone `treeHiDist: 55`) | **Adapt** | Walk the spruce gullies at phone tier; push the swap out or fade it. S check / M fix. |
| 12 | Low-poly model kit + voxel AO bake (M1) | `lowpolyKit.ts` | Built props: `PaintKit` + `bakeSmoothAO()`. **Generated GLBs (`glbPaint.ts`) get no AO.** | **Adapt** | Bake AO on the GLBs. This is the likely cause of N14's "boulders read blue-plastic in shade". S–M. |
| 13 | Blender-baked AO + bounce light; the terrain casts shadows (X2 / L6) | `BlenderIsland.ts`, `scripts/blender/` | Runtime `StaticBake` (yurts, rocks, spruce). **Terrain `castShadow = false`.** | **Adapt** | (a) Add the terrain to the bake: long golden-hour shadows off the escarpment and crags at zero runtime cost (M, taste). (b) A baked terrain AO / bounce texture (L, candidate only). |
| 14 | Image-to-3D (X3: TRELLIS.2 / Hunyuan3D-2) | `scripts/img2mesh/` | Nalati already ships generated rigged models | **Adopt** | For the N12 leftovers: the Golden King, the collie, the ghost horse, the yurt texture |
| 15 | Ocean v2 (depth, foam rings, glint, caustics) | `Ocean.ts`, `waves.ts` | `src/nalati/water.ts` has depth, sheen, glint, flow foam, rain rings | **Mostly skip** | Optional: foam rings round rocks / a wading horse, caustics on river gravel (S–M, low) |
| 16 | Look Lab (E65): every taste axis switchable, time-of-day picker, Debug card (E81) | `Menu.ts:359` (lowpoly only) | URL flags only (`?look=v1`, `?kuwahara`, `?time=` …) | **Adopt** | A Nalati Debug card with the time-of-day picker (`DayClock.set`) and a switch for every new look change (the "taste is the user's call" rule). S. |
| 17 | 9-angle mockup loop (E43) | `art/driftwood-isle/round-4-remaster/` | `scripts/nalati-camp9.mjs` + paint-overs, camp only | **Adapt** | Extend to the plateau, crags, kurgan field at dusk and Snow Lotus as the N14 pass. M per area. |
| 18 | **Phone render scale 2× (E70)** | `tier.ts` phone `dpr: 2` | **Inherited by the merge.** Nalati's phone budget was measured at 1.5×. | **Measure** | ~78 % more pixels. Re-run the camp phone budget. S. |
| 19 | **Animal shadows to 80 m on phone (E90)** | `tier.ts` `animalShadowDist: 80` | **Inherited.** Nalati's live map is 512² for movers, so herds cast 2–3-texel shadows to 80 m. | **Measure** | Maybe a Nalati override around 40 m. S. |
| 20 | WebGPU (X5), faceted terrain colours | `GpuPath.ts`, `Terrain.buildLowPoly` | — | **Skip** | Parked on main / low-poly only |

**Order:**
1. The two clamps / fixes (5, 6). No pick needed.
2. Measure 18–19 (`node scripts/nalati-camp9.mjs --tag=post-merge`).
3. The Debug card (16) and the ΔE score (7a).
4. Everything taste-shaped (7b, 13a, the vignette), shipped as switchable variants with before / after sheets.

## 3. Music and audio

### What main has
- **Music** (`src/audio/Music.ts`, `Stems.ts`, archived plan `project/archive/2026-09-23-music.md`): MiniMax Music 3 stems
  in piano (default) / orchestral / folk, a synth fallback (`src/audio/score/wildshard-theme.ts`), and an in-game style
  switch (Settings `musicStyle`).
  - **The adaptive score:** each slot is split by demucs into a *calm* stem and a *tension* stem (drums + half the bass).
    Tension gain: calm 0 / alert 0.5 / combat 1. Combat decays after 8 s; `main.ts:702–712` polls for alert animals
    within 40 m.
  - **Stings:** `pickup`, `death`, `chunk`, cut from each style's takes.
  - **Only three hard-coded slots:** `SlotName = 'pine' | 'island' | 'title'` (Stems.ts:23). `wantSlot()`
    (Music.ts:587) and the boot decode (`src/boot/extras.ts:131`) choose `island` for an ocean shard and `pine` for
    everything else.
- **SFX** (`src/audio/Audio.ts`): synth first; generated samples replace a sound where `public/assets/sfx/best/sfx.json`
  has one (82 files, 2.0 MB: MOSS v2 vs Stable Audio 3 takes, `scripts/music/gen/`). Settings `sfxSet` = `best` / `synth`.
- **Driftwood only** (`main.ts:555, 571`, gated on `sea`): `IslandAmbience.ts` (9 zones, a surf line emitter, generated
  reverb rooms, an unused `onZone` hook for music), `IslandSfx.ts` + `Voices.ts` (surface footsteps and combat sounds
  rendered from code), `ShrineHum.ts`.
- **Pine Hollow:** the `pine` theme in each style and one forest bed. Main's draft `docs/plans/PINE-HOLLOW-REMASTER.md`
  proposes slots calm-day / calm-night / tension / boss / storm / dawn sting. **Nalati should use the same slot names.**

### What Nalati has
- `src/nalati/sound.ts` wires about 40 **synth** voices in `Audio.ts`:
  - wolves, horses, dog, sheep, marmot;
  - hooves by ground (grass, gravel, wood) and the stampede;
  - bow, arrow, javelin, sabre, spear;
  - a `steppe` bed (grass hiss, gusts, river, waterfall, stove, larks, crickets), a far wolf chorus at night, silence
    inside the kurgan;
  - storm rain / wind / thunder at 343 m/s / crackle.
- It routes through main's buses, so the volume sliders and `?mute=1` work and nothing double-plays.
- **Music:** `sound.bind` asks for `shard: 'steppe'`, which maps to nothing, so **Nalati plays Pine Hollow's "misty pine
  forest" theme.**
- Bosses and elites only push `combat(1)` and borrow the `chunk` sting. The design's `elite` / `boss-intro` / `phase` /
  `victory` stings and boss music (elites-and-bosses.md) were never built.

### Gaps and collisions (verified in code)
1. **The wrong music:** Pine's theme on the steppe.
2. **Other shards' samples leak in once the generated set is on:**
   - player footsteps are Pine's `footstep-litter` (main.ts:576 falls through);
   - the sampled Pine `hoofsteps` beat Nalati's `hoofSurfaceAt` (Audio.ts:736);
   - **Qyran the eagle screams with Driftwood's `monkey_shriek` and Aqbars growls with Pine's `bear_growl`**
     (`src/nalati/elites.ts:105, 249, 464`).
3. **Not one Nalati sound is in the generated set.** AGENTS.md says every sound is generated twice and the better take
   ships, so the `best` / `synth` switch does nothing on Nalati.
4. **Pine's forest bed is decoded on Nalati for nothing** (`extras.ts:132`, about 10 MB held).
5. **Probably silent:** mounted hoof loops (`Mount.gait` is read by nobody), balbals, ghost riders, the Golden King, the
   Titan, a crouch rustle, a kurgan reverb, taming.
6. The music's alert poll counts herd horses and the flock dog going `alert`, so riding past a herd may make the music
   tense.
7. **The pipeline rules out voices:** every MiniMax prompt says "instrumental only", and `rank_v3.py` rejects a take
   with over 20 % vocal energy. The existing `folk` style is Celtic, not Kazakh.

### What Nalati should get
| Row | Work | Size |
|---|---|---|
| A1 | **Quick fixes:** Nalati surface footsteps; `hoofSurfaceAt` wins; stop decoding the forest bed; a mounted hoof loop from `Mount.gait`; herd `alert` out of the music poll; eagle / leopard stop borrowing monkey / bear. | S |
| A2 | **Slots per shard** in the engine (`steppe`, `steppe-night`, `steppe-storm`, `steppe-boss-*`), plus `zone` / `night` fields on `MusicState`. **Download only the launched shard's slots** (today every style of every shard downloads at the loading bar). | M |
| A3 | **A Nalati score** (MiniMax Music 3; ~6 takes per slot, `rank_v3.py`, demucs, −18 LUFS). Kazakh instruments: dombra ostinato, kobyz drone, sybyzgy flute, jaw harp, frame drum; 6/8 gait rhythms. Slots: calm-day, calm-night, tension (from the stems), storm, the Golden King, the Titan (the Titan's cue can double as the storm slot). Stings: `elite`, `boss-intro`, `phase`, `victory`, `tamed`, `dawn`. Credit line stays "Music: MiniMax-Music3". | L (~8–12 h of one-at-a-time runs under `lockf`) |
| A4 | **Zone music:** the three zones in `NALATI_MAP.zones` (`src/chunks/nalatiLayout.ts`): **Nalati Grasslands** (green valley, north), **Sky Grassland** (golden bowl), **Snow Lotus Valley** (the snow ring). Cheapest: 3 takes of one theme, crossfaded on a bar at the zone line. | M |
| A5 | **A Nalati sfx set**, MOSS v2 + Stable Audio 3, better take per family, ~40 families × 2–3 variants ≈ 2 MB. Families: bow draw / twang / arrow impacts; sabre swing and hits; spear thrust / brace / javelin; hooves × surface × gait; neigh / snort / squeal / tack; wolf howl / snarl / bite / yip; dog, sheep, marmot; eagle cry + stoop; leopard growl / hiss; balbal stone; ghost-rider hooves / wail; Golden King; Titan roar; steppe grass / snow / dirt / felt footsteps; a tall-grass crouch rustle; rain / storm-wind / thunder near and far; beds for day steppe, night steppe, the river, the waterfall, the camp, the kurgan, the glacier; a kurgan reverb. | L (each family S) |
| A6 | **`SteppeAmbience`**, the `IslandAmbience` pattern: zones (valley, bowl, snow ring, camp, kurgan inside, glacier), a night layer, the storm layered over them, and `onZone` driving A4. Today's `startSteppe` synth stays as the fallback. | M |

**Order:** A1 now (hours of work, and it removes wrong-shard sounds), then A5, A2 + A3, then A4 + A6.

## 4. The quest / adventure layer

### How it works on main
| Piece | File | What it does |
|---|---|---|
| Quest as data | `src/game/quest/quest.ts` | `QuestDef`: steps with an objective (`{n}/{of}`), a `chip` of 18 characters or fewer (E51), a `hint`, a `done` condition over flags, a `count` and map `markers`. The NPC talk tables (`when` / `lines` / `sets`) live here too. |
| Flags | `src/world/interact/flags.ts` | Strings saved per shard (`ws.flags.v1`). Conditions are `{all, any, none}`. `?resetquest` clears them. |
| Items / puzzles | `src/world/interact/*` | Chests, keys, doors, levers, plates, pickups, altars… All the models are **low-poly** and placed at Driftwood's named spots. |
| Driftwood's line | `src/game/quest/driftwood.ts` | **THE SEALED RING:** Wendell → 3 glyph shards → the altar → the Drowned Captain → stand in the ring. Plus sea glass, dive treasure. |
| Wiring | `src/game/quest/Adventure.ts` (`installAdventure`, **returns null unless `driftwood-isle`**, line 107), `Spine.ts` (NPC + talk prompt + dialogue panel + the quest chip + the MAP-tab quest card + kills chained on the first frame), `Places.ts` (walk-in discovery → a saved `seen:<id>` and a "Discovered · X" toast; names on the map once found), `Finale.ts` / `QuestUI.ts` (boss, reward, the golden-hour view), `Feats.ts` (flags → achievements) | — |

**Nalati gets none of it.** `main.ts:498–506` gives Nalati its own map pins from the minimap's fog of war. That fog is
**never saved**, so every reload turns every place back to "?". Nalati already saves its own progress (`ws.boss.v1`,
`ws.elites.v1`, `ws.nalati.skins.v1`, achievements), but no quest reads those stores. The pack fills with trophies
(pelts, the golden feather, the gold plaque, wolf fangs…) that **nothing uses**. A quest turn-in gives them a purpose.

### Three Nalati quest lines (the user said yes to one)

**Q1 — "THE KING'S PLAQUE" (M).** Recommended first: every step is content that always exists, and it tours the
whole shard.
1. Talk to **Aqsaqal Baqyt**, the camp elder by the big yurt: "the kurgans stir at dusk". *New: an NPC + dialogue.*
2. Mount Tulpar at the hitching rail. *`mount.onMountChange`.*
3. Topple 3 balbal warriors in the kurgan field at dusk (counter `0/3`). *Kill hook.*
4. Find the Great Kurgan's door. *`seen:great-kurgan`.*
5. Defeat the **Golden King**. *Needs a `Boss.onDefeated`.*
6. Bring the **gold plaque** back to Baqyt. *A talk that needs the plaque in the pack.*

Reward: the Golden Bow (exists) + a title + one camp change: a quiver rack that refills arrows (today they only refill
on death), or a ribbon on the camp pole.
- Chip strings: `ELDER'S YURT`, `BALBALS 0/3`, `GREAT KURGAN`, `THE GOLDEN KING`, `RETURN TO BAQYT`.

**Q2 — "A STRIP FOR THE WIND" (M–L).** The mounted exam.
1. Talk to **Berik**, the eagle hunter at the eagle perch.
2. Break and bond a wild stallion. *`taming.onBonded`, chained: main.ts:602 overwrites it.*
3. Climb Eagle Rock. *Area enter.*
4. Optional: bring back Qyran's golden feather (storms only).
5. When a storm comes, ride to the Wind Cairn and tie the strip. *Needs `stormTitan.onTied`; the `tied` field
   exists at :426 with no callback.*
6. Defeat **Jel Ata**.
7. Report back → a golden-hour view from Eagle Rock (Driftwood's Finale camera trick + `clock.set('golden')`).

Reward: Naizagai + the Sky-Marked Saddle (both exist) + the view. Risk: storms are random, so Berik needs a forecast
line, or the step pins the next storm.

**Q3 — "LOTUS FOR THE UNBROKEN" (M).**
1. Talk to **Apa Gulnar**, the healer.
2. Ride to Snow Lotus Valley.
3. Gather 5 snow lotus. *A new painterly pickup from `snow-lotus.glb`; today the ~56 lotus are decoration.*
4. Kill **Aqbars** at the big cluster by the leopard cave.
5. Offer a lotus at Argymaq's high pasture and break him.
6. Ride Argymaq back to the camp rail.

Reward: Argymaq (exists) + "Apa's salve" (a heal item).

**Side (S): "SEVEN RIBBONS".** Add a stone to each of the 9 ovoo cairns (`dressing/place.ts:546`), the Driftwood sea-glass
pattern. Skip the **kokpar match**: it is a real mounted mini-game (L) and not yet worth it.
The **ghost riders** (night, `onRiderKilled`) and **Qara Batyr** fit as a later night chapter.

### The engine wiring Nalati needs
| # | Work | Files | Size |
|---|---|---|---|
| W1 | Split the generic core (flags, place, talk, dialogue, chip, markers, map card) out of `Adventure.ts` / `Spine.ts`, which are tied to Driftwood's places and to Wendell. Spine takes a quest + NPC list. Driftwood must not change. | `src/game/quest/{Adventure,Spine}.ts` → a new `core.ts` | M |
| W2 | Nalati's install: quest data, NPCs, places, achievement events | new `src/game/quest/nalati.ts` + `src/nalati/adventure.ts`, called from main.ts | M |
| W3 | **Events → flags:** chained kills, a balbal count, `Boss.onDefeated`, Titan `onTied` / `onDefeated`, a wrap around `record()` for the elites, chained `onBonded`, `onMountChange`, storm / night as temporary flags. On load, **rebuild the flags from the stores already saved**, so a player who already beat the King keeps it. | `Boss.ts`, `stormTitan.ts`, `ride.ts`, `main.ts` | S–M |
| W4 | **Painterly NPCs** (elder, eagle hunter, healer): idle, talk, wave. The camp has **no people at all** today. | new `src/entities/npc/Nomad.ts` (procedural first; generated and rigged with N12 later) | M (L generated) |
| W5 | **Places with saved discovery**: `Places.ts` over `NALATI_MAP.pois` (17 places, 3 zones) replaces main.ts:498–506. The fog stays for the ground only. Coordinate with N15 ("too much text"): names show only once found. | `Places.ts`, `main.ts` | S |
| W6 | Painterly pickups (lotus, ovoo stone): a material hook in the item kit | `Interactables.ts`, `models.ts` | M |
| W7 | Quest + discovery achievements in the NALATI table; tests | `src/game/achievements.ts`, `test/quest.test.ts` | S |

**Choose one boss bar.** Two boss-bar designs now exist: Nalati's gold `src/ui/BossBar.ts` and main's `QuestUI` boss bar
(the Drowned Captain). They should become one component.

## 5. Other player-facing things on main

| Feature | File | Nalati today | Proposal | Size |
|---|---|---|---|---|
| Menu tabs (MAP / INVENTORY / ACHIEVEMENTS / SETTINGS / FEEDBACK, E26) | `src/ui/Menu.ts` | All work. INVENTORY lists Nalati skins. MAP has no quest card (Q-layer). | Comes with W2 | – |
| Settings in two cards (E81): SETTINGS + dashed amber DEBUG | Menu.ts `buildSettings` | Hunter's eye is in Gameplay (Nalati only). **The Time-of-day picker and Look Lab are low-poly only.** | A Nalati Debug card: time of day (storms and dusk are hard to reach in a playtest), look switches | S |
| Settings: Tracer bolts | Crossbow / Rifle | **Does nothing for the bow** | Hide it on Nalati, or give arrows a tracer | S |
| Settings: Swing turn speed | Player.ts | The spear sets the swinging state; **the sabre never does** | Set it in `Sabre.ts` | S |
| Settings: Music style / Sound effects | Music.ts / sfx | The style changes Pine's music; the sfx switch does nothing | §3 | – |
| Lock-on settings (camera assist, auto re-lock) | LockOnTarget.ts | Dead: the LOCK button can't lock anything in Nalati (§1.2 #20) | Add `sabre` / `spear` + the Nalati kinds to `MELEE` / `HOSTILE` | S |
| Death toast (`deathLine`) | `src/ui/HurtArc.ts:72–88`, main.ts:761 | **No Nalati verbs**, so every death reads "Killed by a wolf". It says "respawning at the **south gate**", but Nalati's spawn is the north road. A lightning death has no killer and reads **"Fell too far"**. | Verbs ("Torn down by a wolf", "Stooped on by Qyran", "Ridden down by a ghost rider", "Crushed by a balbal"), a respawn name per shard ("back at the nomad camp"), "Struck by lightning" | S |
| Hurt arc + trauma shake | HurtArc.ts, main.ts:547–548 | Gated `chunk.weapon === 'sword'` | Adopt it for Nalati (§1.3) | S |
| Resume screen after an app switch (E61 / E96 / E98) | `src/ui/Resume.ts`, `GpuRecovery.ts` | Works for any shard. Risks: a reload inside the kurgan (the dungeon floats at y 140, `KurganDungeon.ts:47`) likely restores you with the inside state unset; a reload in the saddle puts you on foot. | Save "inside kurgan" (or the door position) and "mounted" in the resume state | S |
| Title / hero art | `src/chunks/nalati-grasslands.ts:555–562`, `art/hero-images/round-3-nalati-in-engine` | Present (in-engine heroes, "Experimental" tag) | – | – |
| EXPLORE WORLD / Model Explorer | `explore:` flag, `src/explore/*` | **Off for Nalati**; no Nalati models registered | Covered by the physics / explore review (N16, E72) | M |
| Feedback note context | main.ts:410 | Works; the note context lacks mounted / storm / time of day / inside kurgan | Add those fields, so the user's notes say where they were | S |
| Achievements UI | `src/game/achievements.ts:45` | 15 Nalati achievements (bosses, elites, tame, wolves, balbals, ghosts). None for discovery, collectibles or quests. | W7 | S |
| The hoverboard | Player `setHover`, HOVER tab | Live on the steppe, and the tab stays up in the saddle | Decision below | S |

## Decisions for the user

The fixes in §1.2 (the merge breakage), the audio quick fixes (§3 A1) and the E89 / E91 look fixes are **not** on this
list. They are bugs, not taste.

| # | Question | Options | Recommendation |
|---|---|---|---|
| D1 | **Which HUD variants go to codex?** | A edge tabs · B bar-edge folder tabs · C one arc + a weapon card · D status left / actions right (all four, two frames each) | **Run all four.** Expect **A**; C's weapon card is the follow-up if three tabs feel heavy |
| D2 | **DISMOUNT** | (a) the HORSE edge tab turns into DISMOUNT (one toggle) · (b) a separate small tab under HORSE · (c) hold the USE band | **(a).** The N17 agent is building the close cousin (b); confirm which |
| D3 | **The hoverboard on the steppe** | (a) off in Nalati (the horse is the fast travel) · (b) on foot only, hidden in the saddle · (c) as on main | **(a).** It undercuts riding and frees the bar-edge tab |
| D4 | **Bow controls (N18)** | (a) ATTACK = hold to draw / lift to loose, cancel if not full; AIM = zoom · (b) keep DRAW as its own disc, ATTACK = loose · (c) (a) + tap ATTACK = a weak snap shot | **(a)** (Skyrim-style, as asked); try (c) only if (a) feels slow on a horse |
| D5 | **Weapon switching** | (a) keep the 3-slot strip · (b) one CoD weapon card (tap = next, swipe = fan) · (c) edge tabs | Decide from the D1 board |
| D6 | **Day clock on the HUD** | (a) none · (b) a sun / moon glyph on the minimap rim · (c) a "DAY" word + glyph in the fps pill / sky row | **(b).** Night matters (ghost riders, wolves, stealth light) |
| D7 | **Lock-on in Nalati** | (a) sabre + spear, with all Nalati hostiles · (b) hide LOCK in Nalati · (c) (a) + the E75 bow lock later | **(a)**, then (c) |
| D8 | **Nalati music identity** | (a) a steppe theme per style (piano / orchestral / folk) · (b) one Kazakh-folk score whatever the style · (c) (b) + quiet underscore takes for piano / orchestral | **(b).** The steppe sound is the point; ~3 MB, not ~9 |
| D9 | **Music by zone** | (a) one theme · (b) 3 variants of one theme crossfaded at the zone line · (c) 3 separate beds | **(b)** |
| D10 | **Throat singing** | (a) none (fits the pipeline) · (b) a drone only in the night + boss slots (relax `VOCAL_DQ` there) · (c) full vocal takes | **(b)**, after a 6-take instrument test (whether MiniMax can do dombra / kobyz convincingly is unknown) |
| D11 | **Boss music** | (a) tension on the shard theme · (b) one shared boss track · (c) one each for the Golden King and Jel Ata | **(c).** Jel Ata's cue doubles as the storm slot |
| D12 | **Nalati sfx: where they live** | (a) in the one merged `sfx/best` set (every shard downloads it) · (b) per-shard manifests + a per-shard download filter | **(a) now** (the one-set rule, +2 MB), then (b) with the slot engine |
| D13 | **First quest line** | Q1 THE KING'S PLAQUE · Q2 A STRIP FOR THE WIND · Q3 LOTUS FOR THE UNBROKEN · side SEVEN RIBBONS only | **Q1.** Always-available content, and it tours riding, dusk, the kurgans and the boss |
| D14 | **The camp's people** | (a) procedural painterly figures now · (b) generated + rigged (like the Drowned Captain) · (c) mounted herders from `kokpar-rider.glb` | **(a)**, then (b) once the look is approved |
| D15 | **Lock the bosses behind the quest?** | (a) no, the quest follows along (flags rebuilt from the saved boss state) · (b) the kurgan door opens after the elder | **(a)** |
| D16 | **Phone render scale for Nalati** (inherited E70 2×) | (a) keep 2× · (b) Nalati default 1.5× · (c) decide after the camp phone budget + N11's iPhone reading | **(c)** |
| D17 | **Look adaptations** | Learned LUT (Debug switch) · the terrain casting baked shadows (long dusk shadows off the crags) · a vignette in the grade · baked terrain AO / bounce (L) | Build the terrain-in-bake as a switchable variant first; the others after a before / after sheet |
| D18 | **Nalati's phone fps target** | (a) the plan's 30 fps · (b) AGENTS.md's 60 | Your call: it sets how much of §2 the phone can afford |

## Suggested order of work (for N16's merge plan)
1. **Merge breakage (S, no pick):**
   - HUD items 1, 2, 4, 9, 13, 20 and the LEAN / OFFER `bottom`, alongside N17's GALLOP / DISMOUNT work;
   - the `34vw` → one under-minimap stack;
   - the E91 clamps and the E89 shadow step;
   - the audio quick fixes;
   - the death-line fixes and the hurt arc.
2. **HUD mockup round** A–D (D1), then build the pick, with N18's bow.
3. **Audio:** the sfx set, then the slot engine + score + zones.
4. **Quest core split + Q1.**
5. **The look variants.**
