# T15-2 · The map that draws itself (E471, TRAILERS §3b)

12.0 s of ink on paper, 1920 × 1080, 60 fps, no audio (the lead adds the corner tag, end card and sound). One plot is
drawn (Driftwood, crow-quill, indigo, *@mara*), the hand-ruled two-lane highway with its roundabouts goes round it, then
four neighbours in four other hands: Nalati (brush, *@juno*), Pine Hollow (technical pen, *@kofi*), Signal Dunes
(pencil, *@lev*), Nine Dragon (crayon, *@ines*). The view follows the pen out and pulls back while everyone else's plots
fill in and the roads run off the page; the outer ring is still being drawn as the shot ends. One plot stays empty:
a dashed vermilion border and *yours*. The cartouche reads *Every shard / built by a player.* Two inks (iron-black,
indigo) plus one accent (vermilion: the highway's centre line and *yours*).

**How the drawing is real:** `prep.py` skeletonises every drawing and word (scikit-image), traces the skeleton into
strokes, orders them as a hand would (big connected marks first from the subject outward, then detail, hatching and
dots; words left to right) and times them by pen travel plus a lift per jump. `map.html` draws a round-capped mask
along those strokes up to the current progress and shows the ink only through it, so each line grows along its own
path. The roads, plot borders, roundabouts and the cartouche are vector strokes generated with seeded jitter, pressure
and overshoot per hand (brush bristles that run dry, crayon and pencil through a paper-tooth pattern). Paper is a
generated seamless tile; the ink is multiplied into it with a faint bled rim.

## Files

- `map.html`: the page; `window.pose(card, t)` draws frame t (it waits for its assets, then draws synchronously).
- `prep.py`: drawings + words → `build/` (`data.js` strokes, `ink/*.png`, `paper.jpg`, `tooth.png`). `build/` is
  generated (gitignored).
- `fetch-fonts.sh`: the ten OFL / Apache handwriting fonts from google/fonts → `fonts/` (gitignored).
- `gen.sh`, `gen-all.sh`, `prompts/`: the codex `image_gen` runs that made the drawings
  (`art/trailers/round-4-t15/v2-map/`, its README has every prompt). `gen/` is their output (gitignored).
- `cards.json`: the one 12 s card for `titles.mjs`.

## Re-render

```bash
REPO=/Users/raynos/projects/games/wildshard-singleplayer; D=$REPO/scripts/steam-trailer/t15/v2-map
OUT=<your scratch dir>
python3.13 -m venv $OUT/venv && $OUT/venv/bin/pip install numpy scipy scikit-image opencv-python-headless pillow
bash $D/fetch-fonts.sh
$OUT/venv/bin/python $D/prep.py $REPO/art/trailers/round-4-t15/v2-map $D/fonts $D/build      # ~1-3 min
cd $REPO && SKIP_BROWSER_LANE=1 node scripts/steam-trailer/titles.mjs $OUT/frames $D/cards.json --titles-html=$D/map.html   # 720 frames, ~8 min
ffmpeg -framerate 60 -i $OUT/frames/main/%05d.png -c:v libx264 -crf 14 -pix_fmt yuv420p $OUT/content.mp4
ffmpeg -ss 1 -i $OUT/content.mp4 ...   # sheet: frames at 1 3 5 7 9 11 s, tile 3x2 (see the commit's sheet.jpg)
```

`SKIP_BROWSER_LANE=1`: `titles.mjs` opens a plain headless Chromium on a local page, not a game browser (the T15 brief
says no lane is needed); run one at a time.
