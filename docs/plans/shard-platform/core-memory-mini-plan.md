# Core-game memory benchmax: mini plan (measured, G640)

**State:** `measured` 2026-10-23 — HEAD 965b2bd1d6, measured by a plan-agent subagent; rows C1–C7 open, D1–D4 for Jake.
An extra under G639 (after Nalati to zero and grid readiness).

Jake, 2026-10-23, reading the tile streaming page (*"What tiles can't remove: the ~300 MB engine base, the ~320 MB of
page components"*): *"A new draft mini plan called memory benchmaxing the core game … page components, an engine that
takes up 600 megabytes of our allowance … that's really a lot … benchmark how much memory the shard file of template 1,
template 2 use … in shard select, not infinite wild shard, just shard select. If you're saying the engine takes 300 and
the page components take 300, then that should show in template 1 and template 2."*

## Answer

**Current G682 result (2026-10-24): all four floors miss the fixed budgets.**
On `f4465ac4ab`, the 120-second combined WebContent + GPU readings are menu
165.0 MiB, selection 169.5 MiB, Template 1 317.1 MiB and Template 2 304.6 MiB.
The respective limits remain 148.5383 / 198.5383 MiB; see §7 for attribution
and the complete cold cohort. The measurements below in §§1–3 are historical.

**It doesn't show.** A template entered from SHARD SELECT uses **~290–300 MB in the Simulator** (WebContent + GPU process),
and its own content is included in that. The ~620 MB is estimator constants: the 300 MB engine base, the ~321 MB of grid
page components and an 80 MB overlap, 701 MB before any content (memory-strip-mini-plan.md §1). Grid page components
(kept/loading programs, road, commons, continuation cache) don't exist on a template page: it has no grid session, no
strip (play.ts installs it only when `grid !== null`) and no bound allocator (`memory().accountedBytes` is null).
Chromium's numbers are higher only because of its own GPU process (§2).

## 1. Measurements

Chromium is iPhone 16 Pro emulation: phone tier, 2× (canvas 804×1362), muted, Developer on, service worker blocked. The
flow is the real one: `/` → SHARD SELECT → the card → ENTER WORLD, which travels to a fresh page. Two runs, one per
template. Process footprint is libproc `phys_footprint`, with V8 heap and ArrayBuffer backing from CDP. The breakdown
comes from a memory-infra dump at 2 min. The Simulator is wildshard-iphone Safari with Developer off, so it does no
prefetch. Its templates load from `?chunk=<slug>&skipintro=1`, the same fresh page travel opens. MB = MiB. "gc" means
after a forced GC.

| State | 10 s | 60 s | 2 min idle | 2 min + gc | V8 heap | three.js | GL labelled |
|---|---|---|---|---|---|---|---|
| about:blank (calibration) | rend 14 · GPU 18 | | | | 1 | | |
| Main menu, Chromium | rend 425–462 · GPU 59–95 | 337 · 42–79 | **329–332 · 42–79** | 328 · 42–79 | 14 | — | — |
| SHARD SELECT idle, Chromium | 307–311 · 71–104 | 302–304 · 52–83 | **304–305 · 52–83** | 302–303 | 15 | — | — |
| Template 1 (`_template`), Chromium | 315 · 594 | 310 · 594 | **326 · 593** | 214 · 593 | 59 (37 gc) | 34 tex · 122 geo · 39 programs | 68.6 MB |
| Template 2 (`blender-template`), Chromium | 295 · 614 | 287 · 610 | **224 · 617** | 208 · 617 | 33 | 35 tex · 82 geo · 41 programs | 76.3 MB |
| Main menu, Simulator (no prefetch) | WC 127 · GPU 15 | 119 · 15 | **117 · 15** | | | | |
| Template 1, Simulator | WC 266 · GPU 43 | 254 · 43 | **261 · 43** | | | | |
| Template 2, Simulator | WC 263 · GPU 40 | 250 · 39 | **250 · 39** | | | | |

A template boots in 3.4–3.9 s. All three Simulator screenshots show the shard live with the HUD up. The Chromium network
process adds another 63–75 MB in every state. The Simulator's GPU process undercounts: GL storage lives on the host GPU,
so it reads 40 MB against 69–76 MB of labelled GL. No iPhone reading was taken.

## 2. Where the floor goes (Template 1 unless noted; Chromium memory-infra at 2 min, plus the GL journal)

| # | Consumer | MB | How known |
|---|---|---|---|
| 1 | Post-processing render targets: composer colour 16.7 + depth 8.4, luminance 8.4, SMAA edges + weights 8.4, stable depth 4.2, scratch 4.2, a 1024² target 4.0 | **53** (≈ 68 at the 17 Pro's 804×1748, estimate) | GL journal, exact |
| 2 | V8 main heap: three.js scene, game modules, 427 JS files / 12.7 MB of source (`session` chunk 4.5 MB, `shardList` 2.2 MB) | 33–59 (37 after gc) | CDP; sampling top: three.module 3 MB, session 1.7 MB |
| 3 | Blink buffer partition, still held on the template page; suspected the content-cache worker's Cache.put bodies (unconfirmed) | 55 | memory-infra |
| 4 | malloc (Blink, ANGLE client, fonts; not split) | 51–56 | memory-infra |
| 5 | ArrayBuffers: geometry CPU copies, product bytes | 17–26 | memory-infra `array_buffer` |
| 6 | Blink memory cache (`web_cache`) of fetched scripts and images | 23–24 | memory-infra |
| 7 | HUD and DOM: blink_gc 10 + compositor tiles 13 (2.1–2.4k DOM nodes) | ~23 | memory-infra |
| 8 | Scene textures: engine 11 (SMAA weights 4.2, stable depth 4.2); Template 2 adds 10.7 GPU of baked-ground PNGs (2 × 5.3) + 8.3 MB of decoded images | 11 / 30 | GL journal |
| 9 | Shader programs: 39–41 linked (10 post/composer, ~14 `family:pbr` variants); compiled in the GPU process, not separable | part of ANGLE's 155–163 | estimate |
| 10 | Rapier wasm linear memory 1.8–2.3 (+ 3.2 MB wasm file); script wasm 0.1–0.2; basis transcoder 0.5 (Template 2) | ~2–6 | observed wasm rows |
| — | Audio: no AudioBuffer rows (muted, no gesture), so 0 measured; the cost after the first tap is unmeasured | 0 / ? | |
| — | Continuation cache, kept programs, road tiles, commons, pools, the strip | not on a template page | grid-only claims |

The Chromium GPU process (593–617 MB) breaks down as ANGLE/Metal 155–163, IOAccelerator 96–114, shared images + IOSurface
~67, malloc 52–60, command transfer memory 26–58, Dawn 22 and Skia 16. That is 8× the 69–76 MB of GL storage the journal
labels, and it is Chromium-on-Mac overhead. The Simulator can't size WebKit's equivalent, which is why D2 asks for the
iPhone's GPU process reading once.

## 3. Main menu and SHARD SELECT: what should not load there

- **The grid prefetch (G554) is the biggest surprise.** It starts 4 s after the menu shows whenever INFINITE WILDSHARD is
  shown (Developer on, or once the grid gates pass). It fetched **530 MB in 4,235 files within 60 s** (localhost). At
  10 s the renderer peaks at 425–462 MB, and once the run is done **218 MB is still held in Blink's buffer partition**
  (GC doesn't free it). The memory goes only when the page is replaced: 55 MB is left on the template page. The prefetch
  is meant to be "disk, never memory" (prefetch.ts). WebKit is unverified: the Simulator's menu ran without Developer, so
  without the prefetch.
- **The "renderer-free" title loads 194 modules (5.1 MB of JS)**, including three.module, GLTFLoader, KTX2, meshopt,
  materialGraph, painterly, toon, Atmosphere, BakedTerrain, terrain, sea/water, species looks, the grid assembly, the
  prefetch, and three shards' own modules (driftwood-isle, nalati-grasslands, sunscar-dunes). entry.ts promises *"No
  renderer, world, or Three.js is imported until a shard is chosen."* The heap cost is small (V8 14 MB), but none of it
  belongs on the title.
- SHARD SELECT costs about the same as the menu: +60 DOM nodes, and hero art briefly adds 10–30 MB to the GPU process.
- Without the prefetch the menu costs ~117 MB in the Simulator. Chromium agrees once the 218 MB held by the prefetch is
  subtracted (~110 MB).

## 4. Rows (disjoint files, sized)

| Row | What | Files | Size | Done when |
|---|---|---|---|---|
| C1 | Prefetch holds no memory: drop each body after it is stored, cap the bytes in flight, and find the holder of the 218 MB (worker Cache.put or the response) | grid/prefetch.ts, shardfile content-cache worker | S–M | Chromium menu at 2 min ≤ 130 MB renderer with Blink buffer < 20 MB, and ≤ 200 MB at 10 s, with the prefetch running |
| C2 | Same reading in WebKit: the Simulator menu with Developer on and the prefetch running | none (measurement) | S | WebContent at 10 s / 2 min recorded here; retained ≤ 30 MB after C1 |
| C3 | Title diet: the title graph imports no three.js, loaders, looks, terrain or shard modules (the prefetch's order arrives as data) | mainMenu.ts, grid/menu.ts, prefetch.ts imports, shardList | M | The menu's script list holds no `three.module`, GLTFLoader, ktx2 or shard folder; a module-graph test over the title entry stays green |
| C4 | The 55 MB buffer + 23 MB web_cache left on the template page: find the holder and release it after boot | content cache / product loader | S | Template 1 renderer at 2 min ≤ 230 MB without a forced GC (now 326) |
| C5 | Phone composer diet, as a Debug A/B: half-float to RGBA8 where the look allows, half-res luminance / SMAA, drop the stable-depth copy | engine composer / look | M | Labelled render targets ≤ 30 MB at 804×1362 (now 53), and Jake's pick on a variant sheet (default-off until then) |
| C6 | Estimator honesty: the standalone engine base comes from this reading (~250 MB WebContent), grid page components count only on grid pages, and the 300 MB constant goes | format/contentBounds.ts, contentCost.ts | S | The Template 1 estimate is within 15 % of the Simulator's WebContent + GPU (≈ 300 MB), not 701 + content |
| C7 | Core floor ruler at each milestone: four floors (menu, SHARD SELECT, Template 1, Template 2) by extending scripts/shard-phone-memory.mjs with the menu-entry flow, not a new tool (G585) | scripts/shard-phone-memory.mjs | S | One command prints the four floors and checks them against D1's target |

Order: C1 and C3 first (the menu), then C4 and C6, with C5 behind Jake's pick. C2 follows C1. C7 goes last, once D1 sets
the target.

## 5. Decisions (G658; M1 replaced by G682)

**M1 (G682): menu / SHARD SELECT ≤ the fixed hello-world WebKit floor + 50 MiB;
each template ≤ that floor + 100 MiB** (Jake, 2026-10-24). The measured floor in §6
sets limits of **148.5383 MiB / 198.5383 MiB**. This replaces G658's absolute
50 / 100 MiB targets; the floor does not automatically rise with future growth.
**M2:** the crash line counts all of WebContent + the GPU process, plus one iPhone GPU reading. **M3:** keep the prefetch, fixed by C1. **M4:** a post-processing variant sheet.

**Path to 100 MB (row C8, spike):** today's ~261 MB Simulator template: the held Blink buffer (−55, C4), the resource cache (−23, C4), post-processing at half or off on templates (−27 to −53, C5), title / shard code not loaded (C3, part of the 33–59 MB heap and 12.7 MB of JS) reach ~120–150 MB. Below that, measure the irreducible floor first: an empty Safari page, a page with only a WebGL context, and three.js alone, in the Simulator; then trim HUD / DOM, malloc and pools against it. Menu 50 MB: no three.js, WebGL or shard code on the title at all (C3).

### Original options

- **D1 Core floor budget.** Skip / **A a template entered from SHARD SELECT ≤ 300 MB (Simulator WebContent + GPU), and the
  menu / SHARD SELECT ≤ 150 MB even with the prefetch running (rec; that's today's template floor, held)** / B 400 MB /
  C no core budget.
- **D2 What the crash line counts.** Skip / **A WebContent only, as today, plus one iPhone GPU-process reading at the next
  milestone to settle whether WebGL storage counts against the 2 GB line (rec)** / B WebContent + GPU process summed.
- **D3 The menu prefetch.** Skip / **A keep it from the menu, fixed by C1 (no retention, capped in flight) (rec)** / B
  start it only on the INFINITE WILDSHARD tap / C prefetch only during the grid's own loading.
- **D4 Composer bytes.** Skip / **A a C5 variant sheet: today's composer vs one at about half the bytes (rec)** / B leave
  the 53 MB as it is.

## 6. G682 hello-world WebKit floor (2026-10-24)

One cold Safari visit on the same `wildshard-iphone` Simulator and native
`webkit-core-floor/1` reader as C2: `sim-grid-entry.mjs --core-memory=hello`
through `sim-lane.sh`. The reader owns a temporary loopback page containing only
“Hello, world.” No app preview, scripts, canvas, asset requests, prefetch,
service workers, Network-domain capture or forced GC. All three native process
samples and the plain-document witness passed; exit 0, 139 seconds including
startup/cleanup. Reader source: `e0153ca2a1`.

| Time after ready | WebContent MiB | GPU MiB | Combined MiB |
|---|---:|---:|---:|
| 10 s | 81.9268 | 14.7521 | 96.6789 |
| 60 s | 83.4425 | 15.1896 | 98.6321 |
| **120 s: fixed floor** | **83.3487** | **15.1896** | **98.5383** |

The method sums **both WebContent processes and the one GPU process** under the
owned Simulator launchd, including its framework/prewarmed process overhead.
It does not silently select only the active document's process. The 120-second
floor is **87,397,464 + 15,927,456 = 103,324,920 bytes**. Pin that calibration in
the existing ruler: menu / selection **155,753,720 bytes**, templates
**208,182,520 bytes**. MiB is 1,048,576 bytes, matching this plan's historical
“MB” tables. No game-memory gain or new four-floor acceptance is claimed.

Load averages (1/5/15 min) immediately before/after were
**3.876 / 6.550 / 7.653 → 9.289 / 10.068 / 9.143**. A foreign grep remained active
(99.3% → 79.0% CPU); this is a memory calibration, with no frame-timing credit.
Raw native identities/samples and load records are retained locally at
`tmp/core-memory-g682/`. Safari, Inspector, proxy, loopback server and Simulator
were closed; zero booted devices verified. G687 separately accepts the existing
13/15 Simulator frame milestone and cancels the unstarted e664 repeat.

## 7. Current four-floor G682 cohort (2026-10-24)

One exact preview of origin/main at task start, `f4465ac4ab`, build
`f4465ac-mvms81hg`. One cold Safari visit per floor through the existing
`sim-lane.sh` / `sim-grid-entry.mjs --core-memory=all --runs=1 --modes=cold`
reader: Developer on, phone tier, 2× render scale, muted, real selection and
template entry. Each visit resets service workers/caches and uses `sw=0`.
The menu/selection prefetch reached done for all 24 products, with zero bytes
in flight at 120 seconds; recorded peak in flight was 23.62 MiB.

All four visits completed with empty runtime-error lists and three valid native
samples. **Exit 1 is the budget verdict: 0/4 pass**, not an incomplete capture.
Each sample sums both WebContent processes plus the GPU process under the owned
Simulator launchd, exactly as the hello-world calibration does.

| Floor | 10 s combined MiB | 60 s combined MiB | 120 s WC MiB | 120 s GPU MiB | 120 s combined MiB | Limit MiB | Excess MiB |
|---|---:|---:|---:|---:|---:|---:|---:|
| Menu | 174.35 | 164.82 | 148.32 | 16.64 | **164.96** | 148.54 | **16.42** |
| SHARD SELECT | 181.93 | 169.46 | 151.68 | 17.80 | **169.48** | 148.54 | **20.94** |
| Template 1 | 334.77 | 319.37 | 276.13 | 40.97 | **317.10** | 198.54 | **118.56** |
| Template 2 | 322.59 | 305.98 | 265.19 | 39.38 | **304.57** | 198.54 | **106.03** |

### Five largest measured buckets per floor

The optional `--core-attribution=1` tool addition (`f37d6cd9b6`) starts passive
WebKit `Memory.trackingUpdate` sampling **after** the original 120-second native
sample and scalar allocation readout. Five events arrived per visit with no
category errors. Values below use the last arriving event. Their proxy
timestamps are zero, so these events support byte accounting only, not timing.
There was no forced GC, heap snapshot, Network-domain capture or response-body
capture; this extension does not change the floor sample or budget.

| Rank | Menu bucket / MiB | Selection bucket / MiB | Template 1 bucket / MiB | Template 2 bucket / MiB |
|---|---|---|---|---|
| 1 | Other native 50.58 | Other native 63.08 | Page allocator 114.07 | Page allocator 114.41 |
| 2 | JavaScript + GC-owned 48.61 | Page allocator 49.42 | JavaScript + GC-owned 107.97 | JavaScript + GC-owned 100.48 |
| 3 | Page allocator 38.39 | JavaScript + GC-owned 18.78 | Other native 49.67 | Other native 53.70 |
| 4 | GPU process 16.64 | GPU process 17.80 | GPU process 40.97 | GPU process 39.38 |
| 5 | JIT 2.27 | JIT 2.06 | JIT 17.25 | JIT 15.59 |

These are ranked investigation buckets, not a disjoint decomposition of the
budget excess or five proven removable holders. GPU values are the earlier
native process samples; engine categories use a different accounting basis.
They include framework overhead already present in the hello-world floor.
Do not add them or subtract the ledger below from physical footprint.

WebKit's category implementation assigns GC heap plus GC-owned/extra memory to
JavaScript; it does not report JS cells alone. Page is residual bmalloc and
libcmalloc accounting, not a DOM-only measurement. Other remains unnamed native
storage. The installed Simulator's exact WebKit revision was not established;
the current [InspectorMemoryAgent implementation](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/inspector/agents/InspectorMemoryAgent.cpp)
and [Cocoa resource-usage sampler](https://github.com/WebKit/WebKit/blob/main/Source/WebCore/page/cocoa/ResourceUsageThreadCocoa.mm)
explain the category contract, not an exact installed-binary attribution.

### Concrete template allocation owners

The existing app ledger gives narrower cut candidates, but records allocation
capacity rather than physical residency. Menu and selection have no bound ledger.
Template 1's largest five **named owners** are:

| Owner | Storage | MiB |
|---|---|---:|
| Engine render targets | GPU textures | **40.44** |
| Engine scene | GPU textures/buffers, including stable depth and SMAA weights | **12.18** |
| Template product | CPU backing | **5.59** |
| Engine scripts | CPU backing/Wasm | **2.75** |
| Engine physics | Wasm | **1.75** |

Another 2.16 MiB GPU and 0.77 MiB RAM have no named owner. The texture total is
52.08 MiB; CPU ArrayBuffers total 8.63 MiB; Wasm total 4.69 MiB. Render-target
rows explicitly include the two composer colour buffers, depth, SMAA edges,
luminance/downsampling and a 1024² depth target. Any visual composer change still
belongs to C5 and Jake's variant pick.

Template 2 has the same 40.44 MiB render-target owner, 13.02 MiB engine-scene GPU,
10.68 MiB baked-ground GPU, 8.00 MiB estimated baked-ground decoded images and
3.34 MiB product CPU backing. Across its whole ledger: textures 64.08 MiB,
estimated decoded images 8.35 MiB, Wasm 5.19 MiB and CPU ArrayBuffers 4.17 MiB.
The passive Images and Layers categories report zero on all four visits; this
does **not** erase the separately observed texture/image allocations.

Worker-specific heap and resident bytes are **unknown**. Menu/selection loaded
the content-cache and content-hash worker script URLs, but resource entries do
not establish live-worker count, lifetime or retained bodies. No worker script
URL was observed on the template document; this also cannot prove zero workers.
There are 61 script resource URLs on menu/selection and 241 on each template.
The broad Page/Other and JS buckets need a holder census before assigning their
bytes to content cache, workers, DOM or individual modules.

Load averages (1/5/15 min) before/after the cohort were
**7.046 / 8.302 / 9.178 → 4.329 / 5.587 / 7.468**. Foreign grep PID 45432 remained
active throughout (100.0% → 99.1% CPU), untouched. This is a memory reading with
no frame-timing credit. No app source changed. Safari, Inspector/proxy,
Simulator and owned preview were closed; zero booted devices and no quiet
marker were verified before explicit BOTH release.

Raw receipt: `.git/proofs/20261024T142309-sp-x1-current-webkit-core-39772.json`.
Native/category/ledger data, load records and offline rollup remain in
`tmp/core-memory-g682/current/`. The fixed hello-world calibration and budgets
remain unchanged. No repeated cohort or gain claim is implied.
