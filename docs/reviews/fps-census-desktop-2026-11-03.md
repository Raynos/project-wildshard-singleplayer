# Desktop fps census, 2026-11-03

**Status:** `unread` 2026-11-03: all 75 desktop poses hold 60 fps; two single long frames to look at (Driftwood beach 83.4 ms, Sky Reach windmill isle 33.3 ms)
**Link:** this file
**Plan:** none yet: feeds the goal "desktop 60–120 fps at all times"
**Made by:** sp-o1 (Claude Code, Opus 5.5) for wildshard-new

**For:** wildshard-new (the goal *"desktop 60–120 fps at all times"*). **By:** sp-o1. **Sim half:**
[fps-census-sim-2026-11-03.md](fps-census-sim-2026-11-03.md) (sp-o2).

**Verdict: all 75 poses hold the 60 fps floor, at a median of 59.88 fps (the display's vsync rate) with p95
16.7–16.8 ms.** No pose's fps is under 60. Two poses had one long frame each in their 600, which counts against "60 fps at
all times" though both rows pass the tool's floor:

- **Driftwood Isle, golden-02-beach:** one 83.4 ms frame (over 50 ms, under the 100 ms long-frame limit), at about 36.2 s
  into the run. Every other frame is 16.8 ms or less. The pose draws 271 calls and 2.67 M triangles, the heaviest pose in
  the census.
- **Sky Reach, golden-05-windmill-isle:** one 33.3 ms frame (one dropped vsync). Every other frame is 16.8 ms or less.

Every other pose's worst frame is 16.8 ms. The busiest pose's CPU work p95 is 6.4 ms, well inside the 16.7 ms frame. The
upper half of the 60–120 band can't be read here: this Mac's display refreshes at 60 Hz with vsync on, so 60 fps is the
ceiling this census can show, not a measured limit.

## How it was measured

- **Build:** a pinned `--rev` preview of `4255d1c67bb0e33271618917baa80ef3b7b8e4b3` (build `4255d1c-mw188004`, http://127.0.0.1:4401/).
- **Tool:** `scripts/frame-floor.mjs --surface=desktop --desktop-dpr=1.5 --frames=600` (`--desktop-dpr` added for this
  census in `1ea6c14007`, `70add651c5`, `37400a58fd`). Chromium desktop tier, viewport 1440×900, DPR 1.5 (canvas
  2160×1350, render scale 1.5), vsync on, no CPU throttle, muted. One
  browser at a time.
- **Poses:** each run takes the spawn row first, then the caller's fixed world poses (`--standing-file`), settling first.
  - **Shards:** the spawn plus each shard's first two golden cameras that have a probe and aren't the spawn
    (`art/legacy-goldens/compare/cameras24.json`). Far Reach is Sky Reach and Sunscar Dunes is Signal Dunes, so the
    eight names are six shards.
  - **Open plots (all 18 built):** the standalone plot's spawn, its golden road-entry player pose and its golden plaza
    player pose (`art/open-plots/golden-2026-11-03/<plot>/cameras.json`), facing north.
  - **Grid:** the home spawn, plus J1 and J2. No poses carried those names, so this census defines them as road
    junctions in frame-floor's crossroads form, at y 1.7, facing home (engine yaw 3π/4):
    - J1 is (281.25, −281.25), where Driftwood, Nalati, Sky Reach and Nine meet.
    - J2 is (843.75, −843.75), where Nine, Desert Ruin, Alien Plain and Ember Forge meet.
    - Settle is 10 s, so the far junction's cells stream in.
- **Pass:** the tool's desktop floor: median ≥ 60 fps (vsync quantised), p95 within 17.5 ms, no frame over 100 ms.

## Results

fps is the median over 600 drawn frames. p95 and worst are drawn-frame intervals in ms. Work p95 is the game's CPU work
per frame in ms. Draws and triangles are per frame.

| Content | Pose | fps | p95 ms | worst ms | work p95 ms | draws | triangles | |
|---|---|---|---|---|---|---|---|---|
| Driftwood Isle | spawn | 59.88 | 16.8 | 16.8 | 3.8 | 246 | 2,718,046 | PASS |
| Driftwood Isle | golden-01-pier | 59.88 | 16.7 | 16.8 | 3.6 | 244 | 2,981,687 | PASS |
| Driftwood Isle | golden-02-beach | 59.88 | 16.8 | 83.4 | 3.8 | 271 | 2,670,006 | PASS |
| Pine Hollow | spawn | 59.88 | 16.8 | 16.8 | 5.3 | 218 | 5,435,036 | PASS |
| Pine Hollow | golden-01-gate | 59.88 | 16.7 | 16.8 | 5.1 | 197 | 5,957,046 | PASS |
| Pine Hollow | golden-02-cabin | 59.88 | 16.7 | 16.8 | 6.2 | 263 | 7,350,817 | PASS |
| Nalati Grasslands | spawn | 59.88 | 16.8 | 16.8 | 4.1 | 242 | 5,662,672 | PASS |
| Nalati Grasslands | golden-01-camp | 59.88 | 16.7 | 16.8 | 3.9 | 207 | 4,865,775 | PASS |
| Nalati Grasslands | golden-02-bridge | 59.88 | 16.8 | 16.8 | 3.8 | 239 | 5,409,659 | PASS |
| Nine Dragon Stack | spawn | 59.88 | 16.8 | 16.8 | 3.8 | 147 | 1,611,940 | PASS |
| Nine Dragon Stack | golden-02-B | 59.88 | 16.7 | 16.8 | 3.8 | 144 | 1,396,474 | PASS |
| Nine Dragon Stack | golden-03-C | 59.88 | 16.7 | 16.8 | 3.7 | 117 | 965,354 | PASS |
| Sky Reach (far-reach) | spawn | 59.88 | 16.7 | 16.8 | 3.4 | 226 | 1,996,998 | PASS |
| Sky Reach (far-reach) | golden-05-windmill-isle | 59.88 | 16.8 | 33.3 | 3.7 | 197 | 1,793,573 | PASS |
| Sky Reach (far-reach) | golden-06-roost-nest | 59.88 | 16.7 | 16.8 | 4 | 125 | 1,662,872 | PASS |
| Signal Dunes (sunscar-dunes) | spawn | 59.88 | 16.7 | 16.8 | 3.2 | 124 | 174,911 | PASS |
| Signal Dunes (sunscar-dunes) | golden-05-signal-tower | 59.88 | 16.7 | 16.8 | 2.7 | 107 | 167,006 | PASS |
| Signal Dunes (sunscar-dunes) | golden-06-caravan | 59.88 | 16.8 | 16.8 | 2.5 | 86 | 149,276 | PASS |
| Alien Plain | spawn | 59.88 | 16.8 | 16.8 | 2 | 140 | 171,085 | PASS |
| Alien Plain | road-entry | 59.88 | 16.8 | 16.8 | 1.9 | 114 | 135,417 | PASS |
| Alien Plain | plaza | 59.88 | 16.8 | 16.8 | 1.9 | 151 | 181,950 | PASS |
| Clockwork Canyon | spawn | 59.88 | 16.7 | 16.8 | 1.1 | 121 | 203,613 | PASS |
| Clockwork Canyon | road-entry | 59.88 | 16.7 | 16.8 | 1.6 | 117 | 196,925 | PASS |
| Clockwork Canyon | plaza | 59.88 | 16.7 | 16.8 | 1.9 | 135 | 239,596 | PASS |
| Coral Drift | spawn | 59.88 | 16.7 | 16.8 | 1.9 | 120 | 240,117 | PASS |
| Coral Drift | road-entry | 59.88 | 16.8 | 16.8 | 1.9 | 117 | 266,176 | PASS |
| Coral Drift | plaza | 59.88 | 16.8 | 16.8 | 1.9 | 131 | 272,460 | PASS |
| Desert Ruin | spawn | 59.88 | 16.7 | 16.8 | 1.9 | 108 | 242,953 | PASS |
| Desert Ruin | road-entry | 59.88 | 16.8 | 16.8 | 1.9 | 111 | 253,080 | PASS |
| Desert Ruin | plaza | 59.88 | 16.7 | 16.8 | 1.9 | 119 | 298,085 | PASS |
| Ember Forge | spawn | 59.88 | 16.8 | 16.8 | 2 | 146 | 435,545 | PASS |
| Ember Forge | road-entry | 59.88 | 16.8 | 16.8 | 1.2 | 126 | 228,516 | PASS |
| Ember Forge | plaza | 59.88 | 16.7 | 16.8 | 1.1 | 157 | 465,820 | PASS |
| Fossil Badlands | spawn | 59.88 | 16.7 | 16.8 | 2.4 | 141 | 323,845 | PASS |
| Fossil Badlands | road-entry | 59.88 | 16.7 | 16.8 | 2.1 | 116 | 182,454 | PASS |
| Fossil Badlands | plaza | 59.88 | 16.7 | 16.8 | 2.4 | 147 | 336,179 | PASS |
| Frostline Peaks | spawn | 59.88 | 16.7 | 16.8 | 1.3 | 144 | 431,255 | PASS |
| Frostline Peaks | road-entry | 59.88 | 16.8 | 16.8 | 1.1 | 118 | 240,893 | PASS |
| Frostline Peaks | plaza | 59.88 | 16.7 | 16.8 | 2.6 | 152 | 445,880 | PASS |
| Jungle Ziggurat | spawn | 59.88 | 16.8 | 16.8 | 2.3 | 118 | 220,043 | PASS |
| Jungle Ziggurat | road-entry | 59.88 | 16.7 | 16.8 | 2.4 | 123 | 189,392 | PASS |
| Jungle Ziggurat | plaza | 59.88 | 16.7 | 16.8 | 2.4 | 111 | 211,983 | PASS |
| Lantern Bayou | spawn | 59.88 | 16.8 | 16.8 | 2.7 | 188 | 522,664 | PASS |
| Lantern Bayou | road-entry | 59.88 | 16.8 | 16.8 | 2.6 | 138 | 273,498 | PASS |
| Lantern Bayou | plaza | 59.88 | 16.8 | 16.8 | 2.7 | 199 | 544,862 | PASS |
| Mosslight Ruins | spawn | 59.88 | 16.8 | 16.8 | 2.5 | 150 | 438,467 | PASS |
| Mosslight Ruins | road-entry | 59.88 | 16.7 | 16.8 | 2.6 | 137 | 315,165 | PASS |
| Mosslight Ruins | plaza | 59.88 | 16.7 | 16.8 | 2.4 | 161 | 464,499 | PASS |
| Night Market | spawn | 59.88 | 16.8 | 16.8 | 2.6 | 148 | 725,716 | PASS |
| Night Market | road-entry | 59.88 | 16.8 | 16.8 | 1.1 | 124 | 324,122 | PASS |
| Night Market | plaza | 59.88 | 16.7 | 16.8 | 1.1 | 158 | 757,838 | PASS |
| Patchwork Fairground | spawn | 59.88 | 16.8 | 16.8 | 2.2 | 109 | 236,532 | PASS |
| Patchwork Fairground | road-entry | 59.88 | 16.8 | 16.8 | 2.3 | 103 | 154,702 | PASS |
| Patchwork Fairground | plaza | 59.88 | 16.8 | 16.8 | 2.3 | 114 | 242,280 | PASS |
| Saltwind Lighthouse | spawn | 59.88 | 16.7 | 16.8 | 1.2 | 146 | 113,066 | PASS |
| Saltwind Lighthouse | road-entry | 59.88 | 16.7 | 16.8 | 1 | 123 | 70,637 | PASS |
| Saltwind Lighthouse | plaza | 59.88 | 16.7 | 16.8 | 1.1 | 156 | 120,132 | PASS |
| Showcase Template | spawn | 59.88 | 16.7 | 16.8 | 1.8 | 109 | 345,331 | PASS |
| Showcase Template | road-entry | 59.88 | 16.7 | 16.8 | 2.3 | 114 | 285,464 | PASS |
| Showcase Template | plaza | 59.88 | 16.8 | 16.8 | 2.4 | 119 | 398,271 | PASS |
| Sky Harbor | spawn | 59.88 | 16.7 | 16.8 | 2.4 | 110 | 217,393 | PASS |
| Sky Harbor | road-entry | 59.88 | 16.7 | 16.8 | 2.4 | 110 | 171,391 | PASS |
| Sky Harbor | plaza | 59.88 | 16.8 | 16.8 | 1.1 | 122 | 248,177 | PASS |
| Sky Race | spawn | 59.88 | 16.7 | 16.8 | 1.1 | 101 | 205,506 | PASS |
| Sky Race | road-entry | 59.88 | 16.7 | 16.8 | 1 | 103 | 164,362 | PASS |
| Sky Race | plaza | 59.88 | 16.7 | 16.8 | 1.1 | 110 | 229,476 | PASS |
| Starfall Observatory | spawn | 59.88 | 16.7 | 16.8 | 1.1 | 142 | 347,857 | PASS |
| Starfall Observatory | road-entry | 59.88 | 16.8 | 16.8 | 1.1 | 121 | 210,701 | PASS |
| Starfall Observatory | plaza | 59.88 | 16.7 | 16.8 | 2.5 | 154 | 365,605 | PASS |
| Thin Ice | spawn | 59.88 | 16.7 | 16.8 | 2.3 | 101 | 73,668 | PASS |
| Thin Ice | road-entry | 59.88 | 16.8 | 16.8 | 2.3 | 100 | 74,183 | PASS |
| Thin Ice | plaza | 59.88 | 16.7 | 16.8 | 2.3 | 106 | 75,530 | PASS |
| Grid (INFINITE WILDSHARD) | spawn | 59.88 | 16.7 | 16.8 | 6.4 | 305 | 3,202,426 | PASS |
| Grid (INFINITE WILDSHARD) | J1 | 59.88 | 16.8 | 16.8 | 4 | 97 | 416,762 | PASS |
| Grid (INFINITE WILDSHARD) | J2 | 59.88 | 16.8 | 16.8 | 4 | 154 | 961,859 | PASS |

Runs: 2026-11-03T22:44Z (255 s), 2026-11-03T22:45Z (81 s), 2026-11-03T22:35Z (254 s), 2026-11-03T22:40Z (255 s), 2026-11-03T22:26Z (52 s), 2026-11-03T22:31Z (277 s). The raw result files stay in the lane's scratch, and the numbers
here are the record.
