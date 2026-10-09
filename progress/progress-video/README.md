# Progress video: Day 1 → Week 3 (E467)

`wildshard-day1-to-week3.mp4` is 29 s, 720×1280 portrait, with the game's orchestral title theme. "Building my first
MMO": the game as it stood at the end of day 1, 8, 15 and 22 of this repo. Every shot was filmed live from that day's
own build (exported, installed from its own lockfile and built), never from today's code.

| Card | Commit (last of the day) | Shots |
|---|---|---|
| Day 1 · 16 Sep | `568a1463f` | Pine Hollow's south trail, then the day-1 tour camera up to the cabin at sunrise |
| Week 1 · 23 Sep | `8a58b9d1e` | Driftwood Isle from the air; the Nalati valley under the snow ring |
| Week 2 · 30 Sep | `19a434635` | Nine Dragon Stack's square in the rain; Pine Hollow remastered (the same trail as day 1) |
| Week 3 · 7 Oct | `c9aaa62ab` | Sky Reach's islands at sunset; Sunscar Dunes' caravan at dusk |

## How it was made (`tools/`)

Copy `tools/` to a scratch work dir and run from there (the scripts write next to themselves).

1. `PV=$PWD bash build-rev.sh d08 8a58b9d1e`: exports code + `public/` only, `pnpm install --frozen-lockfile` from that
   commit's lockfile, and `vite build` through the heavy lane (the day-22 commit also runs `gen` + `build-shardfiles`).
   Serve each `dN/dist` with `python3 -m http.server <port>` (ports 4711–4714 in the specs).
2. `install-world.js` is a free camera for any of these builds: `window.__world` (to day 8) or
   `window.__wildshard.world` (day 15 on), posed in `game.onLate` (`onUpdate` on older builds), with `player.spawn` so
   the world streams around the camera. These are the same hooks the builds' own `nalati-chunk-views.mjs` used.
3. `mkspec.py` + `scout.mjs`: stills from each shard's day-22 progress cameras (`art/<slug>/progress/cameras.json`), to
   pick the framings.
4. `mkshots.py` + `capture.mjs`: each shot is an eased camera move, frame-stepped on Playwright's fake clock (1080×1920,
   iPhone UA, muted, every DOM element hidden except the main canvas), so the footage plays back smooth however slow
   headless rendering is. Run each through `scripts/browser-lane.sh`.
5. `cards.py`: transparent title cards (Avenir Next Condensed; ffmpeg here has no drawtext). `compose.py edit.json`
   assembles the cut with 0.35 s crossfades. The music is `title-b47c8a52.m4a` 14.65–24.12 s + 25.78–45.81 s (its
   mid-track pause cut out) as `music-edit.wav`, so the theme's peak lands on Week 3.

The 1080×1920 master (32 MB) was not committed. Re-run `compose.py` for it, or film a Week 4 version by adding a
commit to `build-rev.sh` and its shots to `mkshots.py`.
