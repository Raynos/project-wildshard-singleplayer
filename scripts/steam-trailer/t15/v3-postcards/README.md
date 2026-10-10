# T15-3 · Postcards (E471, TRAILERS §3b)

12 s of content for the V3 trailer variant (`docs/plans/trailers/t15/council/selection.md`): a locked top-down shot of a
printed Wildshard highway map (two-lane highway, roundabouts, square plots, folds, a legend cartouche). Four printed
postcards are dealt onto their plots on a 1.6 s beat (Driftwood Isle 0.7 s, Nalati 2.3 s, Pine Hollow 3.9 s, Nine Dragon
Stack 5.5 s landings), each thrown in from off frame, falling, skidding ~20 px and settling to a skew with a contact
shadow. A blank card is pushed in from the bottom edge into the plot marked *OPEN* (6.55–7.35 s); the planned road
around it is printed in (7.5–8.2 s); a Claude Code prompt appears and types *greetings from: your world* (8.15–10.4 s),
then holds with a blinking block cursor to 12 s. Each card's caption strip carries its author (*BUILT BY @MARA*).
The top-right 520 × 70 px corner holds only map road (clear for the lead's tag).

| File | What |
|---|---|
| `postcards.html` | the page: the map (SVG built in JS), the cards (CSS 3D, layered shadows, paper grain), `window.pose(card, t)` |
| `cards.json` | the one 12 s card for `titles.mjs` |
| `prompts/` | the codex image_gen prompts (`common.txt` + one per card) and the runner `run.sh` that made the card art |

Card art: `art/trailers/round-4-t15/v3-postcards/` (see its README). System fonts Futura and Gill Sans (macOS) and
JetBrains Mono (`node_modules/@fontsource`).

## Re-render

```bash
cd /Users/raynos/projects/games/wildshard-singleplayer
OUT=<scratch dir>
SKIP_BROWSER_LANE=1 node scripts/steam-trailer/titles.mjs "$OUT/frames" scripts/steam-trailer/t15/v3-postcards/cards.json \
  --titles-html=scripts/steam-trailer/t15/v3-postcards/postcards.html          # 720 PNGs, ~3.5 min
ffmpeg -framerate 60 -i "$OUT/frames/main/%05d.png" -c:v libx264 -crf 14 -pix_fmt yuv420p "$OUT/content.mp4"
```

`SKIP_BROWSER_LANE=1`: this is a static page in headless Chromium, not a game browser (the T15 brief). One still at a
time: `titles.mjs <dir> --preview <json with {"id","card":"main","dur":12,"at":<t>}> --titles-html=…`.

Re-make a card's art: `OUT=<scratch dir> scripts/steam-trailer/t15/v3-postcards/prompts/run.sh driftwood`, then
`sips -Z 1200 -s format jpeg -s formatOptions 81 <png> --out art/trailers/round-4-t15/v3-postcards/driftwood.jpg`
(keep it under 500 KB).
