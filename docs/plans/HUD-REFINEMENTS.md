# Plan: tentative HUD / touch-control refinements

**State:** `draft` 2026-09-22 — **ideas only: Jake has approved none of them.** He is playing the sword touch HUD (E11, live `6eafcb4`) and the see-through bar (E34, `6660585`) first; nothing below gets built until he picks a row by name. Parked here so the ideas aren't lost (E35).

## Read this first

**None of these rows is approved.** They are the HUD agent's recommendations from the Call of Duty Mobile study (E11)
and the touch audit that followed (E35), written down so they survive while Jake plays the build. A row becomes work
only when Jake names it; until then, an agent must not build, "quickly try" or partially land any of them.

Already built, so not listed: the HEAVY + DODGE discs, the lunge with lock-on brackets, right-half look, the Look speed
and Swing turn speed sliders (E11), the 75 %-solid bar (E34). The dodge + lunge feel (whoosh, FOV kick, speed streaks,
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

## Status

| # | State |
|---|---|
| R1–R11 | idea — not approved |
