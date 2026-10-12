# Round 3, square: L-b at a phone-1x lens (G344)

G344. Jake on the shipped L-b: *"it looks like 0.5x zoom … too fisheye … I also want to take something not at 0.5x
zoom"*. He also asked for a square for the portrait centre band: *"What if we rendered it in the square aspect ratio,
where we try and capture still the four shards?"*

L-b was shot with the game's own lens: `CAMERA_FOV` is 72° vertical, which is about 104° across a 16:9 frame. This
round re-shoots the interim L-b at a phone-1x lens (about a 26 mm lens):

- the landscape at 43° vertical, which is 70° across;
- the square at 62° each way.

Every shot keeps L-b's aim: exactly at the roundabout cross.0.0 (277.5, 0, 277.5), from heading 45° over template-2.
The narrower lens steps the camera back along L-b's line so that four shards still fit: Pine on the left, Nalati on
the right, Driftwood far and template-2 near. The lens is the capture camera's only. The game's `CAMERA_FOV` is
unchanged, and nothing is wired into the game.

[Board](board.jpg)

| id | frame | height | down | from the roundabout | what changes |
| --- | --- | --- | --- | --- | --- |
| SQ-a | square, 62° | 282 m | 28° | 600 m | L-b's line stepped back; a band of sky like L-b's |
| SQ-b | square, 62° | 329 m | 28° | 700 m | farther back: the side shards come in, everything smaller |
| **SQ-c** | square, 62° | 336 m | 34° | 600 m | higher and steeper: less empty sky, Driftwood larger |
| LS-a | 16:9, 43° (70° across) | 186 m | 21° | 520 m | L-b's line stepped back; a strip of sky |
| LS-b | 16:9, 43° | 215 m | 21° | 600 m | farther back |
| **LS-c** | 16:9, 43° | 228 m | 26° | 520 m | higher and steeper: almost no empty sky |

**Recommended: SQ-c for the portrait band and LS-c for desktop.** The steeper angle spends the frame on the shards
instead of the flat pink road sky, and Driftwood's island reads largest. Pine, Nalati, Driftwood and template-2 all sit
around a centred roundabout, with Sunscar and Far Reach's islands beyond.

At 1x the template-2 plaza fills the lower ~40 % of every frame. That is the cost of standing over the template, which
round 4 (G343) fixes by shooting from above Driftwood, Nalati or Pine.

## Files

- `SQ-*-2048x2048.jpg` and `SQ-*-1440x1440.jpg` are the squares. `LS-*-2560x1440.jpg` and `LS-*-1920x1080.jpg` are the
  landscapes. Each one is full size, under a burned-in band that gives:
  - the id and name;
  - the lens (vertical and across);
  - the height, the down angle, the distance and the heading;
  - the resolution and the build.
- `board.jpg` is portrait. It holds:
  - the three squares;
  - the three landscapes;
  - on the iPhone, today's L-b band beside the SQ-c band;
  - today's L-b, for its lens.
- `capture.json` records every shot's requested pose, its witnessed camera (position, FOV and aspect) and the build.
- `layout/` holds the raw, unlabelled phone screens of G341 layout B (the portrait centre band). They are the real menu
  of the same local build on iPhone 16 Pro portrait, with Developer off and on:
  - `B-Lb-*` is the menu as shipped;
  - `B-SQ-c-*` (the pick) and `B-SQ-a-*` have the square answered for the hero image request,
    `/assets/title/main-crossroads-landscape.jpg` (the 1440 × 1440 capture, unlabelled).

  Nothing else changes.

**For the wiring (waits for Jake's go):** the band is `background-size: contain` in the space between the logo and the
cards. On Playwright's iPhone 16 Pro, the viewport is 402 × 681 because it keeps Safari's bars. There the square is
limited by the band's height and fills about 78 % of the width with Developer off, and less with Developer on (What's
New takes room). The home-screen PWA is taller (874 pt), so the band has more height there. To fill the width as G344
asks, the wiring change should give the band a square aspect at full width, or ship a slightly taller-than-square crop.

## Capture facts

- Real engine; canvas only, with no HUD and no weapon viewmodel.
- Desktop Chrome at DSF 1, settings tier `desktop`, gfx dpr `native`, Developer on, muted, live clock.
- The camera is the round-3 freeCamera path: a detached late-phase camera. A pose's `fovDegrees` is set on that camera
  each late phase.
- Witnesses: the camera position matched to within 0.01 m, and the FOV matched to within 0.01°. There were no page
  errors and no console errors.
- Build `7c192ae-mv5qs2jj` (HEAD 7c192ae99, `serve-build.sh --head`).

## Reproduce

Run from the repository root, outside a foreign quiet window:

```sh
s=/private/tmp/<lane>; scripts/serve-build.sh --head --name hero   # prints <base>
HERO_CAPTURE_LANE=1 scripts/browser-lane.sh node scripts/capture-main-menu-hero.mjs --worker \
  --round=square --base=<base> --out=$s/cap
sips -s format jpeg -s formatOptions 85 $s/cap/SQ-c-1440x1440.png --out $s/SQ-c.jpg
scripts/browser-lane.sh node art/main-menu-hero/round-3-square/layout/capture-layouts.mjs <base> $s/layout SQ-c=$s/SQ-c.jpg
uv run --with pillow python scripts/main-menu-hero-board.py $s/cap art/main-menu-hero/round-3-square \
  --pick=SQ-c --pick-landscape=LS-c --why='…' --phone-today=$s/layout/B-Lb-iphone-dev-off.png \
  --phone-pick=$s/layout/B-SQ-c-iphone-dev-off.png --reference=art/main-menu-hero/round-3-landscape/L-b-1920x1080.jpg
```

The poses are `squareHeroPlan()` in `scripts/main-menu-aerial-poses.ts`, and its lens is `HERO_1X_FOV`.
