# The first three minutes: decision boards (E308, 2026-09-29)

Row 5 of `project/archive/2026-09-30-driftwood-top10.md`: control hints the first time each control matters, a practice target on the
sand path, a shorter walk down the pier. Every frame is an iPhone 16 Pro portrait capture (402×874 @3×) of the live
build `9cf4138-mun8njsr`, touch + phone tier, muted, clock parked at the morning phase a new game starts on. The crab,
the dummy and Wendell were moved into place in the running game (`window.__world`), nothing was committed to `src/`.
The hint overlays in A, B, C and the bottom D are HTML drawn over the live HUD in its own language (navy glass, 1 px
cyan hairline, corner brackets, letter-spaced mono caps). Only the pier sign is an image-model mockup.

## Boards

| file | question | A | B | C | D | recommended |
|---|---|---|---|---|---|---|
| `board-1-hint-look.jpg` | How should first-time control hints look? Top row MOVE at the spawn, bottom row ATTACK at the practice crab | a label + pulsing ring on the control itself ("DRAG TO MOVE", "TAP TO ATTACK") | one banner under the quest chip ("MOVE / DRAG THE LEFT STICK", 1 / 6) | a ghost thumb drawing the gesture, no words | in the world: a pier sign "DRAG TO MOVE", then Wendell calling "Give that crab a whack with your sword!" | **A**: the eye goes where the thumb goes; the disc pulse already exists (E286 `.ws-touch-disc.hint-ready`) |
| `board-2-practice-target.jpg` | What do you practise the sword on? All at the sand at the pier's foot, where the path starts | a lone small reef crab | the E289 training dummy (straw + cloth) | Wendell waits there and spars | nothing (today) | **A**: the island's own toon creature, and it fights back, so ATTACK, LOCK and DODGE all get a use |
| `board-3-start-length.jpg` | How short should the start be? | today, 15 m in on the pier | half way down the pier (z −194) | the pier's foot, on the sand | Wendell meets you at the pier's foot | **B**: keeps the island-from-the-sea first frame, halves the pier, and the practice target is 9 s away |

## Walk times (measured in game, steered along the route, spawn → Wendell at the hut)

| start | walking (4.3 m/s) | sprinting (7.2 m/s) |
|---|---|---|
| A today (0, −235), 83 m of pier | **49 s** (pier 19 s) | **27 s** (pier 11 s) |
| B half way down the pier (0, −194) | 38 s | 22 s |
| C the pier's foot (0, −151) | ~30 s | ~16 s |
| D Wendell at the pier's foot | first talk at 19 s | 11 s |

C is today's run minus its pier time (a steered walk from a sand spawn kept catching the rope fence). The stairs up the
plateau alone take ~15 s of the walk.

## Frames (`frames/`)

- `1a-move.jpg`, `1b-move.jpg`, `1c-move.jpg`, `1d-move-sign.jpg`: board 1's top row (the spawn, MOVE).
- `1a-attack.jpg`, `1b-attack.jpg`, `1c-attack.jpg`, `1d-attack.jpg`: board 1's bottom row (the practice crab, ATTACK).
- `2a-crab.jpg`, `2b-dummy.jpg`, `2c-wendell.jpg`, `2d-nothing.jpg`: board 2, from the pier's landing looking at the
  path's start.
- `3a-today.jpg`, `3b-mid-pier.jpg`, `3c-pier-foot.jpg`, `3d-wendell-pier-foot.jpg`: board 3's first frames (D is 16 s in,
  10 m from Wendell).

## Mockups (`mockups/`)

- `1d-sign-qwen-7.jpg`: Qwen-Image-2.1 turbo, masked edit of `3a-today`, seed 7 (seeds 42 and 101 drew a bigger board
  and greyed the water in the mask). Its sign was pasted back into the live frame with a tight mask for `1d-move-sign.jpg`.
- `1d-sign-codex-b.jpg`: the codex `image_gen` take of the same sign (text right, but codex re-framed the shot to 2:3).

## Proposed triggers (whichever look wins)

| control | shows when | clears when |
|---|---|---|
| MOVE | the first frame in the world | 3 m walked |
| ATTACK | the practice target is within ~6 m | the first hit |
| LOCK | after the first hit, while the target is lockable | the first lock |
| DODGE | the target's first wind-up (the wind-up warning already fires) | the first dodge |
| JUMP | a low driftwood log across the path after the target, within 3 m of it | the first jump |
| TALK | the USE button first reads "Talk to Wendell" | the first talk |
