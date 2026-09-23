# Plan: tentative HUD / touch-control refinements

**State:** `in progress` 2026-09-23 — built and live: the E58–E64 queue, the lock-on (E50, archived: project/archive/2026-09-23-lock-on.md; leftovers E74 / E75) and R3 sprint lock (E71, `9bb82c7`). Open: E63 waits on Jake's T / V pick. The other R-rows stay ideas.

## Read this first

**Jake picked layout E on 2026-09-23 (E42)**, which approved R12, R14, R15, R17 and R18 (built, below). **Every other row
is still unapproved.** The rows are the HUD agent's recommendations from the Call of Duty Mobile study (E11)
and the touch audit that followed (E35), written down so they survive while Jake plays the build. A row becomes work
only when Jake names it; until then, an agent must not build, "quickly try" or partially land any of them.

Already built, so not listed: the DODGE disc (the HEAVY disc was retired by E42 — the ATTACK hold charges the heavy now), the lunge with lock-on brackets, right-half look, the Look speed
and Swing turn speed sliders (E11), the see-through bar (E34 75 % solid, E42 67 %). The dodge + lunge feel (whoosh, FOV kick, speed streaks,
haptics) is the one row Jake picked from the audit, so it was built (E35, `84951d0`), not parked here.

## Where the ideas come from

The CoD Mobile study (E11, research relayed in chat 2026-09-22) compared its touch scheme with ours:

- **CODM moving:** the stick appears where the left thumb lands. Pushing past the ring locks sprint, and there is an auto-run button. Crouch pressed while sprinting slides.
- **CODM looking:** drag anywhere on the right half. Separate camera / ADS / firing sensitivity, optional look acceleration, optional gyro.
- **CODM attacking:** big fire buttons that act on touch-down and still turn the camera when you drag off them. Melee
  lunges about 3 m (console CoD 3.2 m, 4.4 m with the Commando perk). A knife button appears when an enemy is in range.
- **CODM layout:** a custom editor where every button can be dragged, resized and made more or less opaque.

## The ideas

| # | Idea | What we'd do | Files | Size | Risk / open question |
|---|---|---|---|---|---|
| R1 | **Swing on press, not release** | While a sword is held, a touch that lands in the LOOK pad swings at once (today it swings on lift, and only if the touch was under 300 ms and 12 px: about 100 ms of delay, and swings get dropped when the thumb drifts). Dragging afterwards still turns the camera. | `src/player/TouchControls.ts` | S | A drag you meant only as a look also swings. Fine for melee, but the crossbow must keep tap-on-release. |
| R2 | **Hold the LOOK pad = heavy** | Hold about 0.25 s to charge and release to chop, all on the right thumb, so the left thumb never leaves the stick (today HEAVY is on the left edge). Keep or drop the HEAVY disc. | `TouchControls.ts`, `Sword.ts` (hold path next to the latch) | S–M | Must never turn a fast tap-tap-tap combo into a heavy by accident. Interacts with R1. |
| R3 | **Sprint lock** | Push the stick past its ring for 0.25 s and sprint latches, with a lock icon. Touching the stick or pulling back cancels it. | `TouchControls.ts`, `touch.css` | S | CODM players complain about getting stuck in sprint, so the way out has to be obvious. Declined once in E11; worth trying again after play. |
| R4 | **Floating stick** | The stick base appears where the thumb lands in the MOVE zone (clamped), instead of at its fixed centre. | `TouchControls.ts` | S | Some players prefer a fixed stick; could be a Settings switch. Declined once in E11. |
| R5 | **HUD layout editor** | A Settings → Controls → Edit layout screen: drag, resize and set the opacity of every disc; saved per device. | new `src/ui/LayoutEditor.ts`, `TouchControls.ts`, `Settings.ts` | L | The biggest row. Positions must survive portrait / landscape and different screen sizes. |
| R6 | **Look acceleration** | An optional curve: small drags stay precise, fast flicks turn further. A Settings switch plus a strength slider. | `TouchControls.ts`, `Settings.ts`, `Menu.ts` | S | Tuning by feel only. Off by default. |
| R7 | **Aim (ADS) sensitivity** | A third slider: look speed while sighted on the crossbow / rifle (CODM splits camera / ADS / firing). | `TouchControls.ts`, `Player.ts`, `Settings.ts`, `Menu.ts` | S | Only matters for Pine Hollow's ranged kit. |
| R8 | **Crouch / slide on touch** | Crouch is keyboard-only today (C / Ctrl). A CROUCH disc, or a swipe down on the stick; pressed while sprinting it slides. | `TouchControls.ts`, `Player.ts` | M | Player.ts has no slide move yet (its `sliding` means sliding down slopes). One more button in the portrait layout. |
| R9 | **Gyro aim** | Optional, off by default. Tilt the phone to fine-aim, like CODM's "on while aiming" and "always on" modes. | `TouchControls.ts`, `Settings.ts` | M | iOS needs a motion-permission prompt from a tap, and gyro drifts. |
| R10 | **In-range pulse** | The HEAVY disc (or the LOOK pad) pulses when an animal is inside lunge range, like CODM's context knife button. | `TouchControls.ts`, `touch.css` (reads `meleeLock`) | S | Could be visual noise, and the lock-on brackets may already be enough. |
| R11 | **Dodge i-frames** | Once enemies can hurt the player, the dodge's first ~0.2 s ignores incoming hits (CODM has none, but souls-like melee does). Today only fall damage exists (main.ts `player.onLand`), so there is nothing for a dodge to avoid yet. | `Player.ts` (`invulnerable` while `dashT > 0.05`), the future enemy-damage path | S | Depends on enemy damage landing first. |

## E37 thumb-flow audit (2026-09-22)

Jake played the sword HUD and said it "just doesn't feel how it should": the buttons are in the wrong places and it isn't
intuitive. Lifting either thumb, the move thumb or the look thumb, to press a button has to flow. Whether a button goes
on the left or the right depends on which thumb taps it and what the other thumb is doing at that moment, as in CoD Mobile.

Measured on the live build at 390×844 (`art/hud/round-8-thumb-audit/A-portrait-thumb-reach.jpg`). The resting spots
are the stick base (98, 781) and the LOOK pad centre (293, 781). A comfortable thumb roll without changing grip is
about 130 CSS px.

**The CoD Mobile rule, in one line:** the left thumb moves and never leaves the stick during a fight. The right thumb
looks, and it also presses everything you do *while* moving: fire, ADS, jump, crouch, reload. The one left-side
action is a *copy* of FIRE, so you can shoot while the right thumb keeps tracking. So the question for every button
is "what must the other thumb keep doing while this one presses?"

| # | Finding (measured) | Why it doesn't flow |
|---|---|---|
| F1 | **The main attack has no button.** SWING is a tap on the LOOK pad that fires on *release*, only if the thumb moved < 12 px within 300 ms, and only inside the 126 px bar. The whole right half turns the camera, but a tap above the bar does nothing. | Every swing comes ~100 ms+ late. A swing and a turn can't happen together, because any drag cancels the swing. A new player sees HEAVY / DODGE / JUMP but no ATTACK. CODM's biggest button is FIRE, which fires on touch-down and turns the camera if you drag off it. (Same as R1.) |
| F2 | **HEAVY is on the move thumb.** It is 149 px up-left of the stick, and it is a toggle: tap to charge, tap to release. | Charging a heavy means lifting the move thumb twice, so you stop walking into the enemy twice. This is the opposite of CODM, where nothing you press mid-fight is on the left. (R2 fixes it: hold on the right.) |
| F3 | **AIM (ranged) is on the move thumb too.** It is in the same spot as HEAVY. | CODM's ADS is on the right, next to FIRE. Here, sighting the crossbow means you stop moving. |
| F4 | **DODGE is the combat button furthest from its thumb:** 196 px from the right thumb's resting spot, above and left of JUMP. | The most time-critical tap is the longest reach. Its direction comes from the left stick, which is correct, so the right thumb pressing it is correct. It just needs to sit next to where the right thumb rests. |
| F5 | **HOVER / SWAP are at mid-screen edges,** y ≈ 414, 374 px from either thumb. | Out of reach without a regrip. CODM puts weapon swap at the bottom centre, where either thumb can get to it. |
| F6 | **The look rate depends on where the thumb lands:** × 1.6 in the LOOK pad, × 1.0 above it (`PAD_BOOST`). | The same swipe turns you by different amounts, so muscle memory can't form. |
| F7 | **The stick is fixed and dead above the bar.** It is anchored at the MOVE zone centre and only a touch inside the 126 px bar grabs it. The left half above the bar is "not a control surface". | A thumb that lands 10 px high does nothing. CODM's stick appears wherever the left thumb lands in the lower-left quadrant. (R4, declined in E11. Worth asking again now that the complaint is placement.) |
| F8 | **USE is a full-width band** (60 px, 240–300 px up), shown only while a prompt is up. | It covers the right-half look area, so a look drag that starts there presses USE (the button takes the touch). It also appears and disappears under a moving thumb. CODM's context button is a disc on the right thumb's arc. |
| F9 | **There is a 44 px gap and a VITALS strip between the bar and the discs.** | The thumb has to hop over a non-control strip to reach HEAVY / JUMP. The discs could sit right on the bar's edge. |
| F10 | **Landscape is broken:** the minimap covers JUMP / DODGE / HOVER and the debug panel covers HEAVY (`B-landscape-broken.jpg`). | Fixed by E38: the game is portrait-only, and a full-screen rotate-to-portrait gate shows in landscape on phones. |

**Proposed portrait thumb map (idea, not approved).** Decision board: `art/hud/round-9-layout-board/board.jpg`. A keeps the bar, B has no bar and a CoD Mobile arc, C is B with the crossbow.

| Thumb | Holds / presses | Why |
|---|---|---|
| Left: only the stick | A floating stick anywhere in the lower-left, bar plus ~150 px above it. Push past the ring to sprint-lock (R3). **Nothing else during a fight.** On ranged kit only, a small left FIRE copy above the stick (CODM's left fire). | Movement never stops. |
| Right: rest spot | One big **ATTACK** disc where the thumb rests. Touch-down swings at once, dragging turns the camera, holding still ~0.25 s charges the heavy and releasing chops (R1 + R2 as one visible button). On ranged kit, ATTACK = fire on down + drag-aim, with **AIM** next to it. | Attack and aim are the same thumb and never block each other. |
| Right: its arc | **DODGE** is ~80 px up-left of ATTACK, the closest spot. **JUMP** is on the outer edge just above the bar. **USE** pops up as a disc on the same arc when a prompt is up. | Reflex actions within about 1 cm of where the thumb rests. |
| Bottom centre | A **SWAP** weapon chip on the bar seam (CODM weapon card), with **HOVER** beside it. | Rare, can wait a beat, and either thumb can press it. |

| # | Idea | What we'd do | Files | Size | Risk / open question |
|---|---|---|---|---|---|
| R12 | **ATTACK disc** | The visible attack button at the right thumb's rest, which merges R1 + R2 (swing on down, drag = look, hold = heavy). The HEAVY disc goes away. | `TouchControls.ts`, `touch.css`, `Sword.ts` | M | A hold must not eat a fast tap-tap-tap combo. Ranged kit keeps its own semantics. |
| R13 | **Move AIM to the right** | AIM sits beside ATTACK for ranged kit. Add an optional left FIRE copy. | `TouchControls.ts`, `touch.css` | S | Only Pine Hollow uses it. |
| R14 | **Re-seat DODGE / JUMP on the right arc** | DODGE closest to the thumb, JUMP on the outer edge, both ≤ 130 px from the rest spot. | `touch.css` | S | Could be mis-tapped when the thumb rolls up from ATTACK. Needs play. |
| R15 | **SWAP + HOVER to the bottom centre** | A weapon chip on the bar seam, HOVER beside it. | `touch.css` | S | The seam between MOVE and LOOK must stay a clear boundary. |
| R16 | **USE as a right-arc disc** | Replace the full-width band with a context disc that pops up on the right arc. | `TouchControls.ts`, `touch.css` | S | Must not land where the thumb already is, or it opens doors you didn't mean to. |
| R17 | **One look rate** | Drop `PAD_BOOST`, or apply it everywhere, so a swipe turns the same amount wherever it starts. | `TouchControls.ts` | XS | Pairs with the Look speed slider. |
| R18 | **Close the 44 px gap** | Discs sit on the bar's top edge. VITALS moves out of the thumb lane (top-left under PAUSE, or inside the bar). | `touch.css`, `game.css` | S | Vitals must stay readable during a fight. |

## E42: layout E (Jake's pick, 2026-09-23)

Jake picked **E** from the look-zone board (`art/hud/round-10-look-zone/board.jpg`: BEFORE / D / E / F): "My gut feeling is
E is what we should try", the black bar "from 25 % to 33 %" see-through, and the MOVE stick "should be remastered to have
better UX, it's just an empty circle" — keeping "the little bit of color". Built in `src/player/TouchControls.ts` (header
comment = the layout), `src/ui/styles/touch.css`, `game.css` (VITALS / BOLTS), `HUD.ts` (mounts them into `.ws-touch-status`).

| Row | What E built |
|---|---|
| R12 (+ R1, R2) | **ATTACK disc** inboard in the bar's right half, top poking above the bar: fires on touch-down, a drag from it looks, a still hold (< 12 px, 0.25 s) charges the heavy with the ring filling, lift chops; a fast tap-tap-tap stays the light combo. Ranged kit: the same disc reads FIRE (fire on down, drag = look, no hold). The HEAVY disc is gone. **LOOK pad** (outboard corner, dashed rounded square) only looks — tap-to-fire removed. |
| R13 (half) | AIM (ranged kit) moved to the right thumb: right above FIRE, left of DODGE. The optional left FIRE copy is not built. |
| R14 | DODGE / JUMP a short diagonal just above the bar at the right edge (DODGE lower-left, JUMP upper-right); DIVE takes JUMP's spot and SURFACE DODGE's while swimming. |
| R15 | SWAP \| HOVER as one split pill on the centre divider, seated on the bar's top edge (SWAP only once a second weapon is unlocked). |
| R17 | One look rate everywhere: 0.0095 rad/px (the old free-look rate) × Look speed; the pad's 1.6× boost is dropped. Pointer capture lets a drag that starts in the bar run up the screen, so the pad needs no extra reach. |
| R18 | The 44 px gap is closed; VITALS (and BOLTS on ranged kit) moved top-left under PAUSE / the frame meter; the ✎ disc, boss bar, feed and toasts stack under them. |
| Bar | 67 % solid (`rgba(6, 10, 18, 0.67)`), was 75 %. |
| Stick | Always drawn: a thin cyan ring (radius = full deflection) with a glowing cyan knob at rest; the knob follows the thumb; past the sprint threshold forward the ring's top arc lights with a SPRINT tick. Still anchored (grab anywhere in the MOVE zone), not floating. |

## E46: 45 / 55 and the iPhone fixes (2026-09-23)

Jake played E on his iPhone (Safari tab and home-screen app): "Hold for heavy doesn't work for me", "quick double tap still
does a weird Safari browser mini zoom", "or Safari text select", a black strip under the bar in the home-screen app, then
the layout: "attack shouldn't be wider than look, they should be equal width" / "45/55 is better, and we can place the
actual attack button literally on the divider line" / "the actual looking right hand touch pad is 55% of the screen".

| Item | What E46 built |
|---|---|
| Split | The bar's MOVE / LOOK divider moved from 50 % to 45 % (`--split`); the free-look area above the bar is the right 55 % too. |
| ATTACK | Centred ON the divider, on the bar's centre line (above the home-indicator inset); a touch on the disc is ATTACK in either zone. Same semantics. It flashes on each swing. |
| LOOK pad | As wide as ATTACK, vertically centred, centred between ATTACK's right edge and the screen edge; lights while a drag that started in the bar is looking. |
| Stick | Centred in what ATTACK leaves of the MOVE zone (16 px clear at 390, 24 at 430). SPRINT is now a lit tag just above the bar over the stick (the knob covered the old spot). |
| Pill | SWAP \| HOVER stays on the divider, seated on the bar's top edge above ATTACK (16 px clear of the disc, 10 of its charge ring); each half's hit area is 44 px tall. |
| DODGE / JUMP | One size (`--disc`), an even diagonal at the right edge. AIM (ranged) sits up-right of FIRE, clear of the pill, left of DODGE. |
| iOS | The layer cancels its own touch events (non-passive touchstart / touchmove / touchend), pinch gestures, dragstart / contextmenu / selectstart; every element gets draggable="false" and touch-action / user-select / touch-callout / user-drag none; ATTACK captures its own touch and only a lift or cancel ends a hold. Measured in the iOS 26.5 Safari simulator with real XCUITest touches: live E42 — a 1.6 s hold never charged (heavy 0), a double tap zoomed to 1.6×; E46 — the hold charges and chops (heavy 1, 0 pointercancel), no zoom (`progress/198`). |
| Black strip | An iOS home-screen app reports `innerHeight` / `100vh` a status bar short; `src/core/viewport.ts` measures the real height (`--ws-vh`), and the canvas, #hud and the projections (lock-on, damage floats, aim-assist debug) use it. Not reproducible in the simulator tab; Jake tests it in the home-screen app. |

## Queue (2026-09-23, main session, one at a time)

| Ask | What | State |
|---|---|---|
| E58 | Black strip in the home-screen app + true 45 / 55 (ATTACK's left edge on the divider) | done `0c5f16f` |
| E61 | Tiny "RESUMING" screen on an app switch (blurred last frame), no first-boot loader on a recovery reload | done `e74c002` |
| E47 | Compact FPS pill beside PAUSE ("59 fps 17 ms"); tap → full stats over the minimap; VITALS up a row | done `6073b55` |
| E59 | DODGE cooldown (0.8 s) with a clock sweep + rim ring on the disc | done `87c7d62` |
| E63 | Dodge feel T (lean + smear) and V (roll-dip) as two buttons, "T DODGE" / "V DODGE", Jake deletes one after playing | built `f6cc18c` — needs Jake's pick (V dust, sounds, Reduce motion not built) |
| E64 | Music / SFX attribution off the title → Settings ▸ Credits | done `12fb2f9` |
| E48 | Raise PAUSE / minimap into the status band in standalone | dropped — E58 put the page below the status bar |

## Status

| # | State |
|---|---|
| R1, R2 | built as R12's semantics (E42) |
| R3–R11 | idea — not approved |
| R12, R14, R15, R17, R18 | built — layout E (E42), re-split 45 / 55 with the iPhone fixes (E46) |
| R13 | AIM on the right built (E42); the left FIRE copy is an idea — not approved |
| R16 | idea — not approved (E37 audit) |
