# Nalati controls — crouch, jump, riding, four weapons

The user: *"I have no idea how you can crouch and jump — add that to the plan and add mockups for that."*

Nalati adds **CROUCH** (stealth in tall grass) next to **JUMP**, plus **riding** (mount / dismount, GALLOP),
**four weapons** (bow, sabre, spear, javelin) and **DRAW** — on a portrait phone whose control surface is
already full. This doc lays out six ways to fit crouch + jump, the mounted layout, the desktop keys, and one
recommendation with a complete state table.

## Decision (user, 2026-09-22): D — a CROUCH disc above JUMP, shown only in long grass, a toggle

The user picked **option D**, with two changes that answer its two weaknesses: the disc is **optional and
context-shown** (it only appears while you are in long grass), and crouch is a **toggle**. Everything below this
section (the six options, the C + E recommendation) is kept as the **rationale**. The state table, the engine
notes and the desktop keys further down have been updated to D.

Round-3 mockups, `art/nalati-grasslands/round-3/3-crouch-disc/` (style B, no design markup; these are clean
screenshots):

| file | shows |
|---|---|
| `crouch-1-disc-appears.png` | you walk into long grass: the CROUCH disc **fades in** above JUMP with a soft pulse ring and a one-time `TALL GRASS` hint chip; not pressed yet (codex left the LOOK label off the touch bar) |
| `crouch-2-crouched-hidden.png` | toggled on: the disc **lit** (solid cyan), the **HIDDEN** pip, the view lowered to ~1 m inside the grass, a wolf pack passing unaware (codex drew the pip with an open eye; the build uses a closed one) |
| `crouch-3-out-of-grass.png` | on a dirt track by the yurts: **no CROUCH disc**, the normal HUD (AIM + JUMP) |

The rules:

1. **Where it sits.** The CROUCH disc is the same size as JUMP (59 pt), in the **same column, directly above JUMP**
   with an 8 pt gap. Its centre is ≈ 290 pt above the bottom edge, and its top edge is ≈ 80 pt below the HOVER tab, so
   HOVER stays where it is (46 % down). Icon: a double down-chevron; label `CROUCH`.
2. **When it shows.** `visible = inLongGrass || crouchLatch`. `inLongGrass` means `grassHeightAt(player) > 1.1 m` (the
   crouched eye plus a margin, the same test as the HIDDEN pip) with **hysteresis**: it turns on after 0.3 s in long
   grass and off after 1.0 s out of it, so walking along a grass edge does not make the disc flicker. It fades in over
   250 ms and fades out over 400 ms. The **first time per session** it appears, a soft cyan ring pulses around it twice and
   a small `TALL GRASS` chip shows beside it. After that it just fades in.
3. **Toggle.** Tap = crouch (the disc lights, the view lowers, speed 2.2 m/s). Tap again = stand. Tap-to-toggle matches the
   AIM latch and the HOVER tab. Nothing needs to be held, so the right thumb can go straight back to LOOK.
4. **Leaving the grass while crouched** keeps you crouched, and **the disc stays** (lit) until you stand. You can creep
   out of the grass to a rock and still be down. Once you stand outside long grass, the disc fades out.
5. **What clears the crouch:** tapping the disc, JUMP (stand + jump in one; today's `!this.crouching` guard on the jump
   goes), sprinting (> 85 % on the stick), mounting, the hoverboard, and swimming.
6. **Where it never shows:** in the saddle (lean-low stays automatic, see F), swimming, hovering, and on shards with no
   long grass. **Driftwood never sees it**, so there is no per-shard layout problem and no clutter where crouch does nothing.
7. **The HIDDEN pip** lights when you are crouched in long grass and not moving faster than a creep. Standing in long grass
   shows the faint `VISIBLE` pip (crouch-1). Out of the grass there is no pip.

Why D works now, given the objections recorded under D below:
- **Reach (≈ 37 mm from the LOOK rest).** This is still the weakest reach on the pad. But crouch is a **deliberate stealth
  act**, one tap, not a hold and not a split-second reflex. The latency-critical verbs (jump and shoot) stay where they
  are.
- **Viewmodel clutter.** The disc only covers the lower-right when you are in long grass, where the view is full of grass
  blades anyway. Everywhere else the frame is exactly today's.
- **Discoverability.** This is D's real advantage over C and E: nothing is hidden. The button appears exactly where and when
  it is useful, which teaches the stealth rule on its own ("long grass = you can hide").
- **What is given up.** On touch there is **no crouch outside long grass** (behind a boulder on bare ground, in the kurgan
  tunnels). Levels must not require crouching anywhere else. Auto-crouch by speed (C) and tap-MOVE (E) are **not built**.

## Round-2 options and rationale

Round-2 mockups: `art/nalati-grasslands/round-2/7-controls/` (codex `gpt-6-sol`, style B, 2026-09-22). The amber
arrows and boxes in them are **design markup**, not HUD; everything cyan is the game's HUD.

| file | shows |
|---|---|
| `controls-A-flick-down-move.png` | A: flicking the MOVE stick down toggles crouch, and a slow drag down is still walking backwards |
| `controls-B-context-jump-disc.png` | B: the JUMP disc lit as CROUCH, with the slide-down track under it |
| `controls-C-auto-crouch-by-speed.png` | C: the stick's creep / walk / sprint rings, with no crouch button |
| `controls-D-stacked-crouch-disc.png` | D: a CROUCH disc above JUMP plus the right-thumb reach arc (codex drew it up and to the left of JUMP, not directly above; the reach point still holds) |
| `controls-E-tap-move-to-crouch.png` | E: double-tap ripples on MOVE, a CROUCHED chip, and "tap LOOK = shoot" beside it for symmetry |
| `controls-F-mounted-remap.png` | F: leaning low at a full gallop, with GALLOP, DRAW, DISMOUNT and the STEED bar |
| `controls-mounted-layout.png` | the full mounted set: DRAW latched, the bow's arrow-drop arc, GALLOP, DISMOUNT, the `1/4` weapon pill, gait on the stick |
| `controls-recommended-C-plus-E.png` | **the recommendation**: a slow stick crouches you automatically, tap MOVE crouches anywhere, JUMP is unchanged |
| `controls-desktop-keys.png` | desktop 1536×1024: the CONTROLS key panel, the 1–4 weapon hotbar and an `E MOUNT` prompt on the horse |

## What exists today (the ground truth)

Read from `src/player/TouchControls.ts`, `src/ui/styles/touch.css`, `src/player/Player.ts`, `src/player/Weapons.ts`,
`src/player/Sword.ts`. Layout A "edge docks" (`art/touch-buttons/round-1/buttons-A-edges.png`) on the K1 + P2 HUD.

| control | where | behaviour |
|---|---|---|
| MOVE | left half of the black bottom bar | anchored stick at the zone's centre, 48 px throw, 12 % deadzone; **past 85 % pushing forward = sprint** (the stick already has gears) |
| LOOK | right half of the bar | drag = look; a **tap** (< 12 px, < 300 ms) = fire / swing (`weapons.tryFire()`) |
| AIM disc | lower-left, above the bar | a **latch** (tap on, tap off) → `weapons.adsHeld`. On Driftwood it is the sword's **HEAVY** charge (latch = charge, unlatch = release) |
| JUMP disc | lower-right, above the bar | press = jump edge; airborne press = double jump (`DOUBLE_JUMP`). Swimming: replaced by a held **DIVE** disc, plus a held **SURFACE** disc beside it once the eye is under |
| HOVER tab | right edge, 46 % down | latch, `player.setHover` (H) |
| SWAP pill | left edge, 46 % down | tap = `weapons.swap()` (Q); only shown with 2+ weapons |
| USE button | wide bar above the discs | only while the HUD has an interact prompt; sends `KeyE` |

**Crouch exists only on the keyboard:** `player.crouching = !hover && !swim && (ControlLeft || KeyC)` is recomputed
every frame, i.e. *held*. Crouched = 2.2 m/s (walk 4.3, sprint 7.2), eye 1.68 → 1.03 m, **no jump while crouched**.
There is no touch path to it at all — which is exactly the user's point.

Reach numbers used below (iPhone 15, 393 × 852 pt, a pt ≈ 0.16 mm): disc 59 pt; bar ≈ 145 pt tall; disc centres
≈ 218 pt above the bottom edge. The right thumb rests on the LOOK pad centre; JUMP is **≈ 157 pt (≈ 26 mm)** from
there, an easy arc. A second disc stacked above JUMP would be **≈ 225 pt (≈ 37 mm)** — reachable, but the thumb has
to leave LOOK and stretch.

## The six options

### A — Flick down on MOVE = crouch toggle
`controls-A-flick-down-move.png`

A fast downward flick of the stick that ends with the thumb lifting (≥ 40 px in < 150 ms, then release) toggles
crouch; a slow drag down is still walking backwards.

- **Reach:** perfect — no new target, the left thumb is already there.
- **Pros:** zero HUD; mirrors "push up hard = sprint".
- **Cons:** hidden; the flick is **the same motion as a panicked back-step**. On Driftwood the sword has no block —
  *strafing / backing off is the dodge* (`Sword.ts`) — so every hurried retreat risks a toggle. The flick-vs-drag
  threshold is a tuning fight on every phone.
- **Verdict:** no. It fights the one defensive move melee has.

### B — The JUMP disc becomes context: tap = jump, slide down = crouch
`controls-B-context-jump-disc.png`

Press the disc and either release (jump) or slide ≥ 24 px down off it (crouch latch; the disc lights and reads
CROUCH). While crouched, tap or slide up = stand + jump.

- **Reach:** perfect — the right thumb's existing target.
- **Pros:** one disc does both vertical verbs; the lit state tells you you're crouched; learnable ("down = down").
- **Cons:** **jump has to fire on release, not on press** (the press can't know yet whether a slide follows): ~70–120
  ms of added jump latency, felt most on a double jump. Jump + crouch now share a thumb, so you can't crouch-jump or
  crouch while the right thumb is aiming on LOOK. The swim swap (JUMP → DIVE) and the mounted swap (→ GALLOP) now
  have to carry the gesture too.
- **Verdict:** the best *explicit* scheme; runner-up.

### C — Auto-crouch by speed ("stealth by speed")
`controls-C-auto-crouch-by-speed.png`

In tall grass the stick gets a third gear: **creep** (deflection < 45 %) = crouched, **walk** (45–85 %) = standing,
**sprint** (> 85 %) as today. Creep maps 0–45 % onto 0–2.2 m/s, the existing crouch speed, so nothing about the
crouch physics changes. Letting go keeps your posture (stop while creeping → stay down). Out of tall grass the stick
has no creep gear.

- **Reach:** nothing to reach.
- **Pros:** no button, no gesture; it teaches the stealth rule by feel (slow + tall grass = hidden) and the HIDDEN pip
  confirms it. The stick already has a sprint gear, so a creep gear is the same idea. Works for a gamepad for free.
- **Cons:** no crouch outside tall grass (behind a boulder, in the kurgan tunnels); no way to *walk upright slowly*
  through tall grass (rarely wanted). Needs `grassHeightAt(x, z)` (F2 in the plan) — it can't ship before N4.
- **Verdict:** yes — as the **default**, not the only way.

### D — A separate CROUCH disc stacked above JUMP
`controls-D-stacked-crouch-disc.png`

- **Reach:** the weakest: ≈ 37 mm from the LOOK rest, the upper edge of a comfortable right-thumb arc on a 6.1"
  phone, worse on a Max. HOVER has to move up to ~33 %.
- **Pros:** the console / PUBG-mobile answer; fully explicit, discoverable, instant jump kept.
- **Cons:** a third disc column eats the lower-right of the frame — exactly where the bow / sabre / horse's head
  viewmodel lives (the Driftwood sword swings through that corner). Either every shard gets the disc (clutter on
  Driftwood, where crouch does nothing) or the layout differs per shard.
- **Verdict (round 2):** no, unless playtests show nobody finds B/E.
- **→ The user picked D (2026-09-22)**, with the disc shown only in long grass, which removes the clutter and per-shard
  objections, and as a toggle. See *Decision* at the top.

### E — Tap (or double-tap) MOVE = crouch toggle
`controls-E-tap-move-to-crouch.png`

A tap on the MOVE pad that doesn't move (< 12 px, < 250 ms) — the touch stick's **"L3 click"**, the button Breath of
the Wild and Skyrim put sneak on — toggles crouch. It is the exact mirror of **tap LOOK = shoot**, which already
exists with the same thresholds. A tiny down-chevron glyph in the MOVE circle's centre is the affordance, and a
CROUCHED chip / the lit HIDDEN pip shows the state. The user's double-tap variant is the stricter fallback if a single
tap misfires in playtests.

- **Reach:** the left thumb is already there.
- **Pros:** zero new discs; jump stays instant on press; crouch and jump are on **different thumbs**, so crouch-jump
  and crouching while aiming work. Symmetric with LOOK-tap-fires, so it is easy to explain in one line.
- **Cons:** still a gesture (needs the glyph + a first-time tip "Tap MOVE to crouch"). Starting to walk always drags,
  so a still tap is rare, but a nervous thumb resting on the pad could toggle it — the double-tap variant fixes that at
  the cost of speed.
- **Verdict:** yes — as the **explicit override** on top of C.

### F — On horseback: JUMP → GALLOP, crouch → lean low
`controls-F-mounted-remap.png`

Not a crouch scheme on its own but what the chosen one becomes in the saddle: the JUMP disc turns into **GALLOP**
(hold), AIM turns into **DRAW**, HOVER turns into **DISMOUNT**, and "crouch" becomes **lean low on the neck**
(smaller target, slightly faster). Recommended: **lean low is automatic** at full gallop while you are not drawing
(drawing sits you up — horse archery at the gallop still works), so the mounted player has no crouch control at all.
The horse **auto-jumps** ditches and logs at canter or faster, so the mount needs no jump either.

## Round-2 recommendation — C + E, JUMP untouched, F in the saddle (not chosen; the user picked D)
`controls-recommended-C-plus-E.png`

*Kept as rationale. Only point 4 (the mounted layout, F) carries over into the decision.*

1. **Stealth by speed (C):** slow stick in tall grass = crouched. 90 % of crouching in Nalati happens with no input.
2. **Tap MOVE = crouch anywhere (E):** the explicit latch for rocks, tunnels, ambushes; toggle, like the AIM latch.
3. **JUMP stays JUMP**, instant on press, and **jumps from a crouch too** (it clears the latch: stand + jump in one) —
   today's `!this.crouching` guard on the jump goes. This replaces the plan's line "the JUMP disc becomes CROUCH while
   hidden": no disc changes meaning on foot.
4. **Mounted (F):** GALLOP / DRAW / DISMOUNT, auto lean-low, auto-jump.

Why this and not B: it keeps jump latency at zero, puts the two vertical verbs on different thumbs, adds nothing to
the HUD, and changes nothing on Driftwood (no tall grass → C never fires; E is available but harmless, and the sword's
HEAVY-on-AIM / swing-on-LOOK-tap layout is untouched). B is the fallback if E's glyph proves undiscoverable.

## The mounted layout
`controls-mounted-layout.png`

| slot | on foot | mounted |
|---|---|---|
| left disc | AIM (weapon-specific, below) | **DRAW** — bow latch; with the sabre it is HEAVY as on foot |
| right disc | JUMP (+ CROUCH above it in long grass) | **GALLOP** — hold = gallop (drains STEED); release = back to the stick's gait. No CROUCH disc |
| MOVE stick | walk / sprint | **gait**: walk < 45 % · trot 45–85 % · canter > 85 %; the horse turns toward the stick direction |
| LOOK | look; tap = shoot / strike | look; tap = loose / slash. **While DRAW is latched the horse holds its heading** so you can shoot sideways |
| right-edge tab | HOVER; above it a **HORSE** tab (far: whistle the horse · near: MOUNT) | **DISMOUNT** (HOVER hidden — no board from the saddle) |
| left-edge pill | weapon: tap = next, hold = 4-slot wheel | same |
| USE button | shows **MOUNT** near your horse (same as the HORSE tab) | contextual only |
| bars | VITALS | VITALS + **STEED** (amber) |

Water: a horse fords at wading depth; past swim depth you are dismounted into a swim (JUMP → DIVE as today).

## Weapons (the AIM / tap pair per weapon)

The weapon section belongs to the combat write-up; this is only what each weapon does with the two existing inputs.

| # | weapon | AIM disc label → action | LOOK tap |
|---|---|---|---|
| 1 | recurve bow | **DRAW** — latch; draws over 0.6 s, stays drawn, re-nocks after each shot while latched | loose (unlatched: a quick 60 % snap shot) |
| 2 | sabre | **HEAVY** — Driftwood's sword charge exactly (latch = charge, unlatch = chop) | 3-hit combo; mounted: one wide slash on the side you look |
| 3 | spear | **BRACE** — set the spear; a charging wolf / stallion impales | thrust |
| 4 | javelin | **READY** — arm cocked, arc preview | throw (unlatched: a quick flat throw) |

Weapon choice on touch: the left-edge pill shows the held weapon's icon + `n/4`; **tap = next owned weapon, hold
0.3 s = a 4-slot radial** (slide the thumb, release to pick). Desktop: 1–4, Q = last weapon, wheel = cycle.

## Full state table — what each control does

*Updated to the decision (D, context-shown, toggle).*

| state | left disc | right column | MOVE | LOOK tap | right-edge tabs | left-edge pill |
|---|---|---|---|---|---|---|
| **On foot, standing, out of long grass** | AIM / DRAW / HEAVY / BRACE / READY (latch) | JUMP (press; airborne = double jump). **No CROUCH disc** | walk; > 85 % fwd = sprint | shoot / strike | HORSE (whistle / mount) · HOVER | weapon: tap next, hold wheel |
| **On foot, standing, in long grass** | same | **CROUCH** (fades in above JUMP; tap = crouch ON) + JUMP | walk; > 85 % fwd = sprint | shoot / strike | same | same |
| **On foot, crouched** (in long grass, or crept out of it) | same | **CROUCH lit** (tap = stand) + JUMP = stand + jump (clears the latch) | creep 2.2 m/s; > 85 % = stand and sprint (clears the latch) | shoot / strike (bow draws kneeling) | same | same |
| **Mounted** | DRAW (bow) / HEAVY (sabre) | GALLOP (hold); no CROUCH | gait walk / trot / canter; auto-jump ditches at canter+ | loose / slash | DISMOUNT | same |
| **Swimming (surface)** | as today | DIVE (hold) | swim | as today | HOVER | same |
| **Swimming (eye under)** | as today | DIVE (hold) + SURFACE (hold) beside it | swim | as today | HOVER | same |
| **Hovering** | AIM as today | JUMP = board jump (the board clears crouch) | carve | as today | HOVER (lit) | same |

## Desktop key map
`controls-desktop-keys.png`

| key | on foot | mounted |
|---|---|---|
| W A S D | move | gait up / slow / steer |
| Shift | sprint (hold) | gallop (hold) |
| Space | jump · double jump · stand + jump from a crouch | horse jump (manual; it also auto-jumps) |
| **C** | **crouch toggle** | — |
| Ctrl | crouch (hold) — **see caveat** | — |
| E | use / **mount** | **dismount** |
| X | whistle the horse | — |
| 1 2 3 4 | bow · sabre · spear · javelin | same |
| Q / wheel | last weapon / cycle | same |
| RMB | aim / draw / heavy / brace / ready (toggle, as today) | draw |
| LMB / F | shoot / strike | loose / slash |
| H | hoverboard | — |
| M | map | map |

**Caveat — Ctrl + W closes the tab.** Today crouch is `ControlLeft || KeyC` *held*; on Windows / Linux Chrome,
holding Ctrl to crouch and pressing W to creep forward is Ctrl+W, a reserved shortcut the page cannot
`preventDefault` — the tab closes. Only fullscreen + `navigator.keyboard.lock()` can capture it. So: **C (toggle) is
the crouch key**; Ctrl-hold stays only on macOS (where closing is Cmd+W) or while keyboard-locked in fullscreen.
With decision D, desktop has no auto-crouch either: desktop players crouch with the C toggle, which (unlike the
touch disc) works anywhere, because a key costs no screen space. See open question 1.

## Engine notes (for the build rows, N4 / N7)

- `Player`: `crouching` stops being a pure function of held keys. New `crouchLatch`, toggled by the CROUCH disc or the C
  key. `crouching = !hover && !swim && !mounted && (crouchLatch || ctrlHeld)`. Sprint, jump, mount, hover and swim clear
  the latch (jump from a crouch = stand + jump). New `inLongGrass`: `grassHeightAt(position) > 1.1 m` (the crouched eye
  plus a margin, F2), debounced to on after 0.3 s and off after 1.0 s.
- `TouchControls`: a new `.ws-touch-disc.crouch` in the right column, above `.jump` (same size, 8 pt gap).
  `.show` when `player.inLongGrass || player.crouchLatch` (CSS opacity transition, 250 ms in / 400 ms out, and
  `pointer-events: none` while hidden); `.on` (lit) while `crouchLatch`; `.hint` (the pulse ring + the `TALL GRASS`
  chip) the first time it shows per session. A tap toggles `player.crouchLatch`. The hitbox is the disc only, never the
  area around it, so a thumb reaching for JUMP cannot hit it by accident.
- The mounted swap is the swim swap again: `root.classList.toggle('mounted')` hides `.jump`, `.hover`, shows
  `.gallop`, `.dismount`; the AIM disc's label follows the held weapon (`.aim span` text).
- HIDDEN pip: `grassHeightAt > eye height` and not sprinting; animals' senses read the same function.
- New HUD atoms: STEED bar under VITALS (`.ws-game-vitals`), the HORSE tab (above HOVER), the weapon pill's `n/4`.

## Open questions for the user

*Decided 2026-09-22: crouch is **D**, a CROUCH disc above JUMP that shows only in long grass, as a toggle. The round-2
questions 1–2 (C + E or B; single or double tap on MOVE) are closed.*

1. **Desktop C key:** crouch **anywhere** (proposed, since a key costs no screen space), or only in long grass, to match
   touch exactly?
2. **Leaving the grass while crouched:** stay crouched with the lit disc kept on screen until you tap it (proposed), or
   stand up automatically as you leave the grass?
3. **Lean low automatic** at full gallop (recommended), or a manual toggle?
4. **Horse auto-jumps** obstacles at canter+ (recommended), or does GALLOP-disc tap = jump?
5. OK to **drop Ctrl-hold crouch** on Windows / Linux because of Ctrl+W?
