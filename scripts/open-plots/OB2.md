# OB2 plot authoring tools

Run from the checkout after OP2 `fc404c48b1`. These tools reuse the
normal product/capture artifacts; they do not build a plot, open a browser,
change kit geometry or choose an art direction.

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/open-plots/ob2.mjs <audio|life|board|tiling> ...
```

The exported functions have the same validation as the CLI. Inputs are
explicit JSON files; paths are checkout-relative or absolute. Reports are
ordinary files, with no progress panel or runtime service.

## Audio rows for the template

For any of the five plot ideas, one command uses its planned four spot SFX:

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/open-plots/ob2.mjs audio --plot=lantern-bayou --out=tmp/bayou-audio-rows.json
```

The plot template also emits `<idea>.audio.json` beside its candidate
descriptor, as explicit asset requests with null positions. Supply this file
as `--input` after OB7 places the spots. The requests are shared with the
plot-slug CLI through `audio-requests.json`; no playable output is changed.

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/open-plots/ob2.mjs audio --input=tmp/bayou-audio-input.json --out=tmp/bayou-audio-rows.json
```

Input:

```json
{
  "idea": "lantern-bayou",
  "spots": [
    {"id": "boardwalk-creak", "at": null},
    {"id": "wind-chimes", "at": null},
    {"id": "distant-owl", "at": null},
    {"id": "boat-bump", "at": null}
  ]
}
```

`at` is a plot-local `[x,y,z]` within the 500 m cell, or `null` until the
layout owner places it. Four to 32 distinct rows are required. The packet
contains score, ambience and positional file requests under
`public/assets/music/<idea>/` and `public/assets/sfx/<idea>/`, and the
corresponding `music.json` / `sfx.json` catalogue paths. Generator
requirements are requests, not claims about nonexistent recordings.

Copy the packet's `manifest.audio` to the idea's `outputs.json` manifest
override when preparing its template. It remains `none` / `none`.
The separate native `audio` row is admitted through the actual template's
`AudioData` root, with combat cues removed, null ambience and silent score
because an open plot has no gameplay. No current output row is modified
by the tool. OB7 still supplies the real assets, loop metadata, credits
and native catalogue binding before activation. File existence alone
never activates playback or passes bar 10. No silence or missing-bank
fallback is reported as working audio.

## Bar 7: pixel evidence for two motion sources

Capture and check a live plot in one command (the destination must be new):

```sh
scripts/browser-lane.sh --max 10 node scripts/open-plots/life-capture.mjs --plot=ember-forge --base=http://127.0.0.1:4404 --pin=FULL_SHA --sources=tmp/regions.json --out=tmp/ember-life
```

`regions.json` is the `sources` array below. Select its two disjoint regions
from the actual road-entry view. The command owns a muted Chromium browser,
uses the iPhone 16 Pro 402×874 portrait viewport at 2× render scale, checks
the served pin and live clock, and closes its browser in `finally`.
It prints **PASS** or **FAIL** and all ten changed-pixel counts per region;
pixel failure exits 2. It uses normal standalone entry and a fixed free
camera, with no manual ticks, extra render, scene mutation or forced tiles.

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/open-plots/ob2.mjs life --input=tmp/bayou-life-input.json --out=tmp/bayou-life.json
```

The input identifies the full source `pin`, `device: "iPhone 16 Pro"`,
`view: "road-entry"`, eleven lossless PNG samples and two or more named,
disjoint source regions. The plot owner names the real sources (for
example fireflies and lanterns), after seeing the actual layout.

```json
{
  "pin": "FULL_40_CHARACTER_COMMIT_SHA",
  "device": "iPhone 16 Pro",
  "view": "road-entry",
  "frames": [
    {
      "file": "tmp/clip/frame-0.png",
      "atMs": 0,
      "camera": {"eye": [0,2,240], "look": [0,10,0], "fov": 62, "viewport": [402,874]}
    }
  ],
  "sources": [
    {"id": "fireflies", "region": {"left": 20, "top": 300, "width": 80, "height": 80}},
    {"id": "lanterns", "region": {"left": 200, "top": 200, "width": 80, "height": 80}}
  ]
}
```

The abbreviated example needs all eleven samples targeting
`0,500,...,5000` ms from **one** fixed-camera five-second shot. Actual
timestamps remain raw; a late sample over 100 ms refuses, without retry.
This scheduling deadline is not a pixel tolerance or a frame-rate bar. The
camera/lens/viewport metadata is required for every sample and must be
identical. Use direct lossless captures; do not rename JPEGs, extract
lossy video and call its compression changes motion, or invent timestamps
from separate visits. Existing ten-JPEG dome clips are historical visual
evidence and do not satisfy this stricter input.

Every source has all ten interval counts, exact RGB changed-pixel count
and maximum channel delta. No image tolerance is applied. Two declared
sources must each change during the shot for `passesPixelCheck`; a
static region, missing endpoint/sample, drifting camera,
overlapping regions or a lossy input cannot earn that result. CLI exit 2
retains the complete negative report. This is pixel-visibility evidence,
not automatic identification of two systems or a replacement for the
owner's read of visible life. Global flicker or HUD motion outside the
declared regions earns nothing.

`captureLifeClip(page, readCamera, clipInput, freshFolder)` supplies these
inputs from an already-owned Playwright page. `clipInput` contains the
pin/device/view/sources above. `readCamera` must read the page's actual
plot-local camera/framing; the helper never poses or pauses the world.
The existing muted, phone-profile caller keeps its browser-lane lease, version/readiness and
live-clock checks. It schedules screenshots against one absolute clock,
writes eleven PNGs, raw sample times, `capture.json` and `reading.json`.
The destination must be new; refusal preserves partial PNGs and an error
record rather than replacing or silently retrying a previous shot. No
browser is launched by this helper. The old dome JPEG mode is unchanged.

## Bar 5: four-camera three-way board

Capture and compose the board directly for any of the five plot slugs:

```sh
scripts/browser-lane.sh --max 10 node scripts/open-plots/comparison.mjs --plot=ember-forge --base=http://127.0.0.1:4404 --pin=FULL_SHA --out=tmp/ember-comparison
```

The command reads the plot's round-62 reference from its recipe and uses the
same four panel crops as the hand-made Mosslight/Ember boards. It captures
both NOW columns from the same served build, with matching fixed plot-local
cameras, a 72° vertical lens, and a 402×874 iPhone portrait viewport. Its
`captures/` directory must be new. It writes `input.json`, `board.jpg` and
the usual hashed sidecar, closes both muted browser contexts, and prints
the JPEG size. The world advances on its live clock throughout capture.
No hand-assembled input JSON is needed. Review the finished image before
sending it; the command makes no taste verdict.

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/open-plots/ob2.mjs board --input=tmp/bayou-board-input.json --out=art/lantern-bayou/round-2-comparison/board.jpg
```

The input has `idea`, `title` (at most 80 characters) and four `views`,
in order: `above-neighbour`, `road-entry`, `top-down`, `plaza`. Each row:

```json
{
  "id": "road-entry",
  "mockup": {"file": "art/grid/round-62-open-plot-palettes/18-lantern-bayou.jpg", "crop": {"left": 0, "top": 0, "width": 400, "height": 600}},
  "now": {"file": "tmp/bayou/road-entry.png", "pin": "FULL_SHA", "camera": {"eye": [0,2,240], "look": [0,10,0], "fov": 62, "viewport": [402,874]}},
  "nightMarket": {"file": "tmp/night-market/road-entry.png", "pin": "FULL_SHA", "camera": {"eye": [0,2,240], "look": [0,10,0], "fov": 62, "viewport": [402,874]}}
}
```

The example crop is illustrative; supply the actual panel bounds in the
round-62 sheet. NOW and Night Market must have exactly matching plot-local
camera/framing metadata and image dimensions. All four hero cameras must
be distinct. Only the explicit MOCKUP crop is extracted; actual captures
are contained without cropping or stretching. Output is a labelled
1206×2622 iPhone-portrait JPEG, at most 500,000 bytes, plus a `.jpg.json`
sidecar with full input hashes, crops, source pins and cameras. Source
images are never rewritten. Read the board before sending it. The tool
does not make the "clearly better" taste verdict.

## Per-plot G950 tiling report

Export the registered reports together, or name one plot slug:

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/open-plots/tiling.mjs --plot=all --out=tmp/open-plot-tiles
```

`--plot=open-plot-ember-forge` and `--plot=ember-forge` select the same
plot. Wave B selectors also include `fossil-badlands`, `desert-ruin` and
`sky-harbor`. The last two start as inert OP3 source stubs, so selection
refuses until their actual tiled products have ordinary CURRENT admission;
a selector is not a measured report or an activation. Wave C adds
`starfall-observatory`, `thin-ice` and `clockwork-canyon` under the same
inert-source limits. Wave D includes `alien-plain`, `sky-race` and
`showcase-template` under the same limits. The batch admits
every selected CURRENT product before writing
anything, then emits one JSON/Markdown pair per plot and an `index.json`
with product index hashes and L0/L1 totals. The printed totals cover all
tiles of a level, not a live view's draws or memory. Each detailed report
keeps per-tile MB, triangles, draws, height and the existing NT7 advice.

```sh
node --experimental-transform-types --import ./scripts/bake-loader.mjs scripts/open-plots/ob2.mjs tiling --plot=lantern-bayou --out=tmp/bayou-tiling
```

This requires ordinary CURRENT `open-plot-lantern-bayou` output; stale or
missing admission refuses without building. It reuses `readTilingReport`
and `tilingMarkdown`, including the existing index receipt and section
hash/size checks. `.json` and `.md` include every tile's GPU, decoded,
resident and compressed decimal MB, triangles, draws and vertical extent,
plus the original sightline/height advice. These are verified declarations,
not measured live RAM or a pixel/collider/performance qualification.

## Walk-around: all five plots

```sh
node scripts/physics-baseline.mjs --no-build --mode=walk --shard=open-plot-ember-forge
```

Replace the slug with `open-plot-frostline-peaks`, `open-plot-lantern-bayou`,
`open-plot-mosslight-ruins` or `open-plot-coral-drift`. The maintained
`scripts/physics-route.json` has a continuous south-entry, bridge-approach,
plaza-perimeter and landmark-base route for each. The normal checked-product
Node resident runs actual fixed-step player motion. The CLI prints zero stuck
only after the entire route completes; missing CURRENT products refuse.
`node scripts/vitest-tmp.ts run test/physics-open-plots-headless.test.ts`
runs the five together. These routes cover the shared lanes and landmark
approach, not every optional house or every tile interior.

## OB8 readings on one pinned preview

Join one `scripts/serve-build.sh --head --name ob8-readings` preview and
retain its full SHA. Use the same source for the Chromium, memory, live
walk and Simulator readings. Release the joined use when the batch ends.

`frame-floor.mjs --standing-file=<json>` takes a map from exactly the
measured shard slugs to 1–8 fixed world poses. Each pose has `name`, `x`,
`y`, `z`, `yaw` and `pitch`; angles are radians. It uses the existing live
pose API, retains the input and SHA-256, samples every supplied pose, and
keeps position, document, live-clock and drawn-frame guards. A plot's road
pose is `(0, 1.7, -241, pi, 0)` and plaza `(0, 1.7, -62, pi, 0)`.

```sh
node scripts/frame-floor.mjs --shards=open-plot-mosslight-ruins \
  --surface=desktop --chromium-phone --chromium-cpu=4 \
  --draw-budget-report-only --frames=120 --standing-file=<poses.json> \
  --serve-base=<url> --rev=<sha> --scratch-dir=tmp/ob8/scratch \
  --output-dir=tmp/ob8/chromium
```

The maintained reader owns its browser lane, mutes Chromium, and uses
402 × 874 phone / 804 × 1748 render pixels. Use the same poses and flags
for Night Market as the matched control. The separate
`shard-phone-memory.mjs` reads real renderer and GPU process footprints;
its `rendererMB` and `gpuMB` fields are MiB, so convert their sum to decimal
bytes before comparing it with 1.0 GB. Those samples are at spawn.

When loose peer edits invalidate the ordinary checked-product Node walk,
keep its refusal. This live runner reads the maintained route from the
preview's exact source and drives the actual resident through that route:

```sh
scripts/browser-lane.sh --max 5 node scripts/open-plots/walk.mjs \
  --base=<url> --pin=<full-sha> --plot=mosslight-ruins \
  --out=tmp/ob8/mosslight-walk.json
```

It refuses any snag, bounds failure, absent last-waypoint witness or
unfinished endpoint. It uses real fixed steps and the live clock. Its
trace stays in scratch; numbers and verdicts go in OB8 and the commit.

For the official Simulator reading, change the floor surface to `sim`,
remove Chromium/draw-budget flags, and add `--quiet
--device=wildshard-iphone --native-memory=<existing-empty-directory>`.
The reader enters `scripts/sim-lane.sh` itself; do not wrap it in a second
lease. Start after active browsers close. The kernel native interval highs
and the GPU ledger peak remain a labelled conservative memory envelope,
separate from frame timing. Native samples add no timing credit. The
Simulator is Mac-backed regression evidence.

A multi-shard `--shards=a,b` Simulator cohort holds one bounded quiet
window, restarts Safari for each shard, and retains each native result in
`results[].nativeReadings` as `{shard, reading}`. Each gets its own fresh
subdirectory under `--native-memory`; a pre-existing run refuses. The old
top-level `nativeMemory` remains the last reading for single-shard callers.

J1 is lattice `(1.5, -0.5)` and J2 `(-1.5, -1.5)`, converted with the
served grid pitch (562.5 m at `fd7f01690e`); verify their four neighbour identities.
Measure four diagonal headings at each road corner using a `grid` standing
file. Junction acceptance is ≤150 draws, 30 fps floor and no crash.
