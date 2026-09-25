# Pine Hollow hero, round 4: in-engine captures (PH-S1)

The title / card hero art for Pine Hollow is now real in-engine captures of the finished shard, replacing the 17 Sep AI
paintings (`../round-2-pine-hollow/`). The house rule is the same one Driftwood (B6) and Nalati (Phase C, `a95304b`) follow:
a real capture with a light grade (levels and contrast only, no paint-over), 1600×900 landscape, 1024×1536 portrait for the
phone menu, and a 640×360 card, all captured at 2× device pixel ratio.

**Board for Jake:** `board.jpg`, "Pine Hollow hero — which?". It shows the top 3 landscape and top 3 portrait
candidates, labelled A / B / C. **Wired by default: landscape A + portrait A**, the Antler King in his clearing at night.

| Board | Landscape | Portrait |
|---|---|---|
| **A (wired)** | King's clearing at night: the King in the left third, ribcage open, his fallen lanterns burning, a thrall's eyes, the standing stones (`candidate-3`) | The King filling the frame over a burning lantern (`candidate-3`) |
| B | The old-growth giants and the King's standing stones, golden hour, sun through the trunks (`candidate-2`) | Same scene, portrait (`candidate-2`) |
| C | The Hollow at dawn: ground fog, the ranger's cabin with its chimney smoke (`candidate-1`) | The mill hamlet at dusk: a lit window, a figure on the porch, the ringed planet (`candidate-7`) |

To swap in another pick, copy its `candidate-<n>-*-{landscape,portrait}.jpg` over
`src/chunks/thumbs/pine-hollow{-landscape,-portrait}.jpg`, make the 640×360 card from the landscape, and re-run
`python3 scripts/native-icons.py` after the `hero-pine-hollow-*` files here are updated. The build rewrites
`src/boot/art.generated.ts`.

## Files

- `candidate-<n>-<scene>-{landscape,portrait}.jpg`: 7 scenes, each at hero size, graded.
  1. `hollow-dawn`: `tod=dawn&weather=fog`, from SW of the ranger's cabin into the rising sun.
  2. `oldgrowth-golden`: `tod=golden`, from inside the King's clearing west through the giants.
  3. `king-night`: `boss=antler-king&bossGod=1&bossPhase=2` (phase II: lanterns fallen, thralls called).
  4. `king-lanterns`: `boss=antler-king&bossGod=1` (phase I: lanterns still hung in his antlers).
  5. `pond-waterfall`: `tod=sunset`, from the pond's east shore to the falls.
  6. `fire-lookout`: `tod=golden`, from the west ridge across the pass to the lookout, with the far country and its lake.
  7. `hamlet-dusk`: `tod=dusk`, from the south over the miller's house.
- `contact-sheet.jpg`: all 14 candidates.
- `board.jpg`: the A / B / C pick.
- `hero-pine-hollow-{landscape,portrait}.jpg`: the wired pair, byte-identical to candidate 3 and to
  `src/chunks/thumbs/pine-hollow{-landscape,-portrait}.jpg`.
- `hero-pine-hollow-landscape@2x.jpg`: the 3200×1800 master, the source for the native splash screens
  (`scripts/native-icons.py`).

## How they were shot

- `scripts/pine-hollow-hero-shots.mjs --views=art/hero-images/round-4-pine-hollow-in-engine/views.json --out=<dir>`
  re-shoots the 8 views behind the candidates (`views.json`; candidate 3's landscape is `3i-king-p2-left` frame 2, its
  portrait `3j-king-p2-port` frame 4; candidate 4 is `3f-king-p1` frames 3 / 2).
- One headless Chromium on Metal, muted. The dev tree at `7cf0e3c`, with the render fix's default (world AO) on.
- `chunk=pine-hollow&tier=desktop&skipintro=1&nolock=1&clock=1000000` plus each scene's `tod=` / `weather=` / boss
  flags. The clock is frozen. `localStorage ws.gfx.v1 = {dpr: '2', aa: 'on'}` lifts the desktop tier's 1.5 DPR cap,
  so a 1600×900 viewport at deviceScaleFactor 2 renders 3200×1800 and a 1024×1536 one renders 2048×3072.
- God camera: a `game.onLate` hook poses the camera after the player, the same method as
  `scripts/nalati-chunk-views.mjs`. Heights come from `Heightfield.heightAt`. The camera's children (weapon, hands)
  are hidden, and every DOM layer except the game canvas is hidden. `animals.calm`, and animals near the camera are
  hidden in the daytime scenes. The King shots aim at the King's live position. Each King view was shot as a burst of
  4 to 5 frames, and the pick is a frame between stomps, with no root-ring tell across the frame.
- Grade (ImageMagick, after a Lanczos downscale from 2×): night `-level 0%,95%,1.08 -sigmoidal-contrast 1.5,30%`;
  day `-sigmoidal-contrast 2,50% -modulate 100,104`; fog `-level 3%,100%,0.95 -sigmoidal-contrast 2.5,50%`;
  dusk `-level 0%,96%,1.05 -sigmoidal-contrast 1.5,40%`. JPEG q86.

## Notes

- `weather=fog` whitens the King. The scene fog's in-scatter lays over his bark, and he reads as a pale ghost. So the
  King shots use the fight's own fog and no weather. That look may be a bug worth a follow-up.
- The native app icon is the whole app's icon, not only Pine Hollow's. It was the painted cabin, planet and sunset
  (the top square of the 17 Sep portrait). Now it is the top 1024² of the new portrait: the King's skull, antlers and
  ribcage. The icon and splash commit is separate, so it can be reverted on its own.
