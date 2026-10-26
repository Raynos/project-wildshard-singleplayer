# Core-game memory benchmax: mini plan (measured, G640)

**State:** `in flight` (2026-10-25, sp-x2) — latest Template-only native pair
on `8f0324fea6` is 0/2 PASS: Template1 **263.789 MiB**, Template2
**246.132 MiB**, both over fixed198.538 MiB (§15). Prior full `50d155f897`
cohort remains 2/4 PASS; menu/select were not repeated. The same-source C6
audit is +13.638% / +20.231% high: Template2 misses ±15%. C1.1 done
`9108b14ec6`; C3 title isolation qualified. C4 holders / C6 calibration remain
open, C5 waits-Opus. Budgets and the 250 MiB estimator base stay unchanged.
An extra under G639 (after Nalati to zero and grid readiness).

Jake, 2026-10-23, reading the tile streaming page (*"What tiles can't remove: the ~300 MB engine base, the ~320 MB of
page components"*): *"A new draft mini plan called memory benchmaxing the core game … page components, an engine that
takes up 600 megabytes of our allowance … that's really a lot … benchmark how much memory the shard file of template 1,
template 2 use … in shard select, not infinite wild shard, just shard select. If you're saying the engine takes 300 and
the page components take 300, then that should show in template 1 and template 2."*

## Answer

**Latest Template-only cohort (2026-10-25), `8f0324fea6`: 0/2 PASS**, at263.789/246.132MiB against198.538MiB each (§15). The last coherent four-floor cohort, `50d155f897`, remains2/4 PASS. Menu
**93.538 MiB** and SHARD SELECT **107.679 MiB** pass the fixed 148.5383 MiB
limit. Template 1 **260.664 MiB** and Template 2 **249.679 MiB** miss the fixed
198.5383 MiB limit (§13). All values combine WebContent and GPU; all visits
complete/errors0. No four-floor PASS or single-cut causal gain is claimed.
The measurements below in §§1–3 are historical.

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

**Historical sizing hypothesis (C8, not established savings):** the old ~261 MB Simulator template suggested a held Blink buffer (55 MB) and resource cache (23 MB). Current holder audits do not establish those as removable app-owned storage. The earlier proposal combined these unproved amounts with post-processing at half or off on templates (−27 to −53, C5), title / shard code not loaded (C3, part of the 33–59 MB heap and 12.7 MB of JS) to project ~120–150 MB; this is not a current native prediction. Below that, measure the irreducible floor first: an empty Safari page, a page with only a WebGL context, and three.js alone, in the Simulator; then trim HUD / DOM, malloc and pools against it. Menu 50 MB: no three.js, WebGL or shard code on the title at all (C3).

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

## 8. Menu / Template heap-holder census (2026-10-24)

One current-origin Chromium snapshot per target on `71b4a96c17`: fresh muted
iPhone 16 Pro contexts, same real menu / compiled Template entry, Developer on,
120-second settle, service workers blocked, CDP response-body capacity zero.
Exactly one streamed main-page heap each; both complete/errors0, exit0/246s.
Browser and preview cleanup preceded all offline graph work. No app change.

| Saved main-page graph | Menu MiB | Template MiB |
|---|---:|---:|
| Strong-root JS node shallow bytes | 8.099 | 29.723 |
| External string backing, separate | 1.966 | 9.153 |
| Unique ArrayBuffer backing | 0.013 | 16.898 |
| Of JS: code / bytecode / metadata | 1.899 | 14.431 |

These V8 snapshot units do not directly reconcile to WebKit's §7 JavaScript
category (which includes GC-owned/extra memory), nor to physical footprint.
Snapshots can collect garbage. Worker heaps, opaque image pixels and GPU storage
remain outside the main-page graph. Views do not duplicate backing bytes.

Paths prove keepers, not exclusive dominance or guaranteed savings. These
compact tables retain the main findings; full paths/heap IDs stay in the local
JSON rollups, not a new proof file under `progress/` (G506).

| JS category, MiB | Menu | Template |
|---|---:|---:|
| Code/metadata | 1.899 | 14.431 |
| Objects | 1.811 | 3.890 |
| Strings | 1.900 | 3.643 |
| Array/Map/Set storage | 0.551 | 2.990 |
| Object shapes | 0.831 | 2.422 |
| Closures | 0.963 | 1.975 |

Template backing owners: product source 5.591 MiB; script Wasm 2.688; remaining
Wasm 2.000 (including 1.750 Rapier); named engine-scene geometry 0.490;
practice geometry 0.229; texture CPU data 0.391; remaining buffers include
heightfields, lattice tables and ring geometry. Menu has only three backing
stores (12,262 / 1,024 / 20 bytes), reached through decoder imports.

Top 15 individual payload paths (MiB, **not** exclusive subtree savings): `W`
means window, `API` the existing public probe, `M` a module import chain.
External source strings are separate from JS cells. Inspector source is tool
overhead. Repeated parent chains are omitted; full paths remain in local JSON.

| # | Menu: MiB / keeper → payload | Template: MiB / keeper → payload |
|---|---|---|
| 1 | .731 W.app-identity → pageServices source | 1.901 API.combat getter → session source |
| 2 | .507 W.gridPrefetch → shardSchema source | 1.750 M.rapier → DataView → Wasm buffer |
| 3 | .306 Inspector.asLocator source | .731 W.app-identity → pageServices source |
| 4 | .187 gridPrefetch → M.outputIndex bytecode | .705 scene rotation callback → Three source |
| 5 | .162 W.sw → Scope constructor → unlock source | .545 level cleanup → assets Map → product bytes |
| 6 | .130 gridPrefetch → M.shardSchema bytecode | .507 API → M.shardSchema source |
| 7 | .113 gridPrefetch → outputIndex source | .484 module lattice → Float32Array buffer |
| 8 | .078 gridPrefetch.current.hashes Set table | .464 crossbow owner → assets.wire Map → bytes |
| 9 | .064 gridPrefetch → M.materialGraph source | .369 API → graphBackend source |
| 10 | .063 V8 small-integer string cache | .333 crossbow owner → assets.wire Map → bytes |
| 11 | .048 module resolver → bytecode | .306 Inspector.asLocator source |
| 12 | .048 W.sw.adopt → main source | .259 API.saves.memory Map → saved JSON string |
| 13 | .047 W.asset-tables.versions properties | .252 crossbow owner → assets.wire Map → bytes |
| 14 | .047 W.asset-tables.bytes properties | .252 player motor → collider heightfield buffer |
| 15 | .033 gridPrefetch → questSteps source | .252 interaction callback → heightfield buffer |

No large closed-scope leak appears: menu has zero closed Scopes; Template has
one closed `ui.Loading` scope. Its graph-cut-dependent storage is 344 JS bytes
and zero backing bytes. Menu has no geometry/texture objects or named resource
allocations in the saved graph; other-shard catalogue/placement/size metadata
is present, with no demonstrated foreign world payload.

The actionable lifetime candidate is the completed menu prefetch's hash-dedupe
Set (0.388 MiB selected subtree). Broader menu schema imports and the save/default
registry are import/read-audit candidates, not established dead caches.
Template's largest JS category is code/metadata, led by Three (2.689 MiB) and
session (2.101 MiB); its named product source backing is 5.591 MiB / 169 stores,
whose lazy/retry readers must be checked before removal. The 40.44 MiB GPU
render-target allocation remains parked for Jake/Opus as a look decision.

The first bounded cut clears that dedupe Set in `GridPrefetch.run()`'s `finally`,
after the last `product()` reader, including stopped/failed runs. Status counts,
known-product history and in-flight dedupe remain unchanged. The real-validator,
SHA and content-cache regression holds a file open, reprioritizes the queue,
proves cross-product single fetches, then checks empty history and stable status
reads. It fails without the cleanup. Offline removal of only this Set's table
edge in the saved graph makes **406,612 JS bytes (0.387775 MiB), zero backing
bytes and zero external-string bytes** unreachable; this is a counterfactual
storage budget, not a new post-cut heap or a WebKit footprint gain. No schema or
saved/default registry deletion was justified; no cut to either is claimed.

Raw captures, streamed graphs, owner rows and full root paths remain locally in
`tmp/core-memory-heaps/71b4/`; capture receipt
`.git/proofs/20261024T143537-sp-x1-menu-template-heap-capture-93416.json`.

## 9. C1 continuation (2026-10-25, sp-x2)

| Slice (at most 1 h) | Status | Result / remaining acceptance |
|---|---|---|
| C1.1 Worker streamed-body backing | done `9108b14ec6` | Copy chunks into the checked command's one declared-size buffer, rather than retain all chunks plus a concatenated output. Real-GC regression fails on the previous reader and passes on this one. A 16 MiB / 32-chunk Node kernel tracks 32 -> 17 MiB peak chunk/output backing, exact bytes unchanged. |
| C1.2 Current menu footprint / C2 reading | done (this commit), bounded | Existing official WebKit reader: 93.476 MiB / 148.538 MiB PASS, all 24 prefetch products durable. Single-floor selections now enforce their original budget, including incomplete/error readings. Historical Chromium Blink-holder attribution remains unproven. |
| C3 Title import diet | done (existing J1–J5 source, qualified here) | All 12 current title graph contracts pass; the actual menu has 31 script resource URLs, including both cache/hash worker URLs, with no Three/loaders/shard-world URL. This is not a worker-heap census. |

The current audit confirms the existing two-file concurrency and 32 MiB declared
payload reservation remain held until durable storage acknowledges each file.
Worker `stored` replies carry no body; the finished hash-history cleanup from
§8 is already present. Neither observation identifies the original 218 MiB
Blink holder. The main-page graph in §8 had only 0.013 MiB backing; it did not
include worker heaps or browser-native cache storage.

This cut changes the worker's network and URL-cache stream assembly only. It
still checks exact length and SHA before use/storage, retries stale URL-cache
bytes through the network, preserves the caller-owned transfer, and cancels
oversize/failed streams. The full declared buffer is allocated when reading
starts, within the existing payload reservation; cache snapshots and response
internals remain additional memory. The kernel uses collection to count live
explicit buffers, not to qualify process footprint. No WebKit, retained-memory,
frame-time or all-floor gain is claimed.

## 10. Current menu qualification (2026-10-25)

One official cold menu visit on landed `59aaa985dd`, build
`59aaa98-mvo9iwjx`, through `sim-lane.sh` and
`sim-grid-entry.mjs --core-memory=menu --core-attribution=1 --runs=1 --modes=cold`.
The reader resets service workers/caches, enables Developer and the actual menu
prefetch, uses phone tier / 2× render / muted, and owns quiet. Preparation builds
before quiet. No forced GC, heap snapshot or Network-body capture.

| Original sample | WebContent bytes | GPU bytes | Combined MiB |
|---|---:|---:|---:|
| 10 s | 92,574,736 | 17,434,832 | 104.913 |
| 60 s | 81,089,552 | 17,483,984 | 94.007 |
| 120 s | 80,532,496 | 17,483,984 | **93.476 PASS** |

All samples sum both WebContent processes plus the GPU process under the owned
Simulator launchd. The original 120 s total is **98,016,480 B**, below the fixed
**155,753,720 B** menu limit; the hello-world calibration is not rebased.
At 10 s, prefetch was still running (17/24 products, 576,639,902 B stored).
At 60 and 120 s it was done: **24/24 products, 4,332 files / 603,471,151 B
stored, zero present-file shortcuts, zero bytes in flight**, no reason/refusal.
Peak admitted payload was 24,767,753 B against the unchanged 33,554,432 B cap.

Passive categories start only after the acceptance samples. The last event
reports JavaScript/GC-owned 8,497,739 B, JIT 2,064,384 B, Page 38,884,789 B and
Other 31,850,496 B; Images/Layers zero. Their proxy timestamps are zero, so these
are category counts, not timed attribution or additive physical-footprint
owners. Worker-specific retained bytes remain unknown. Historical §7 menu
164.96 MiB and today's 93.476 MiB are different source cohorts, not a paired
measurement of `9108b14ec6` alone.

The original single-floor reader completed rc0/errors0 but omitted a budget
verdict (only `all` emitted it). This slice routes every app-floor selection
through the same existing budget calculation: a missing/failed reading stays
unknown and fails; unselected/foreign results and hello-world calibration cannot
be substituted. The saved visit passes that repaired calculation without a
second capture. Default four-floor behavior and calibration remain unchanged.

Two peer related-test jobs were already active during preparation (PIDs 62651
and 91690), left to finish naturally; no isolated timing or causal claim is made.
Safari, Inspector/proxy, the owned preview and Simulator were closed, quiet was
absent and zero booted devices verified before source checks resumed. Raw
samples/categories, the exact version and offline verdict remain locally at
`tmp/sp-x2/core-c1-menu/`. Selection/template budgets and original Chromium
retention attribution remain open.

## 11. C4 Template holder audit (2026-10-25, sp-x2)

| Slice (at most 1 h) | Status | Result / remaining acceptance |
|---|---|---|
| C4.1 Current native reading and cache lifetime | done `b03613aa82`, measured FAIL retained | Template 1 260.070 / 198.538 MiB; no runtime errors. New real-GC contracts prove settled downloads/write snapshots are released on success and quota refusal while the cache remains alive. No production release was justified. |
| C4.2 Current main-page holders / idle decoders | done `6436257c8e`, bounded | One matching Chromium heap: 29,755,996 B rooted JS / 17,510,853 B unique backing, not a 55 MiB dead cache. Two idle tile-decode workers remain live; retire their pool after 30 s without queued/active jobs, recreate on the next decode. Three regressions fail before the cut; six worker contracts pass afterward. Native-byte gain is not established. |
| C4.3 Remaining native/worker attribution | in flight (2026-10-25, sp-x2), milestone measured | Latest native Templates263.789/246.132MiB on8f0324fea6 vs198.538MiB FAIL (prior5f99 pair267.398/245.507). Earlier Chromium confirms zero live workers at 60/120 s without a heap snapshot or forced GC. No consistent native-byte gain established; native holder attribution remains open. |
| C4.4 world.data model admission | source done `dfa2feca44` + `5f99d999e6`; measured FAIL retained | Exact bounded GLB parser and deferred commons validation; static source closure -39,457 raw/-10,954 gzip B. Original native pair267.398/245.507 MiB, both FAIL; no consistent native gain. Actual compressed-model geometry/owner/refusal contracts preserved. |
| C4.5 Demand-start tile decoder workers | source done `8f0324fea6`; native0/2 FAIL | Constructor allocation started2 workers before knowing whether a decode was needed. Start the same pool at its first request: unused pools create0 workers/timers; active terrain can still require both workers. Queue/transfer/disposal/partial-start contracts remain exact.31 focus/5 suites,109 CF1/21 and1794 broad-related/328 pass; touched game/test types and typed lint pass. New native pair below remains263.789/246.132MiB FAIL; no isolated byte gain. The rings proof now records any observed worker use during the drive, instead of freezing the constructor-time false value. Explicit full-rule typed lint and scoped fixture types pass; no linked related suites were selected for that diagnostic fixture. |
| C4.6 Demand-start native milestone | done (measurement on8f0324fea6),0/2 FAIL | Original two-Template reader complete275s/errors0/all6 samples,2WC+1GPU each.120s totals276,602,440/258,088,568B versus208,182,520B each; over65.250/47.594MiB. No GC/snapshot/Network capture; passive categories after acceptance only. Prior5f99 pair267.398/245.507MiB changes in opposite directions; no consistent or causal gain, no base/cap fit. Quiet/Sim/browser/proxy/own preview fully released; no repeat. Raw tmp/sp-x2/core-c4-demand. |
| C4.7 Admission facade cache lifetime (≤1 h) | done `dcb92dd4ee`, native impact unmeasured | A descriptor's files array can outlive its resident admission. The facade cache's strong value closes over that admission's transport map. Use a weak value so live consumers retain their reader/identity while a descriptor alone cannot retain retired transport. Real-GC regression fails before the change; a 1 MiB fixture backing and facade collect afterward with the descriptor alive. Live-reader collection and existing reread/transport-release contracts remain:90 focused cases,1613 related/303 suites, touched game/scoped fixture types and typed lint pass. No measured native saving or new cohort. |
| C4.8 Context-only native floor (≤1 h) | done `31868f7d51`, diagnostic only | One hello/empty-WebGL2 pair through the existing official reader complete264s/rc0/errors0/all6 samples,2WC+1GPU each.120s54,238,144 /54,959,112B (51.726/52.413MiB); one context/one clear at804x1428,0losses. No app/external resources, forced GC, profiler or snapshot.33 focused/34 related cases, scripts/scoped fixture types and typed lint pass. Fixed G682 calibration/caps and250MiB estimator base unchanged; no app reading repeated. Raw tmp/sp-x2/core-c4-contexts; details §16. |
| C4.9 Completed texture-worker reply lifetime (≤1 h) | done `3ca69120d1`, native impact unmeasured | Three retains each completed promise resolver until another job reaches that worker. A live idle pool can therefore retain the reply and transferred mip backing. Replace only an idle completed resolver with a stateless resolver; queued successors keep their own resolver, FIFO and transfer lists, and workers stay alive/reusable. A real-GC 1 MiB backing regression fails before the cut and passes afterward; original phone transcode queue coverage also passes.3 focused and2554 related cases/534 suites pass;20 missing-product suites explicitly defer to CI. Touched engine/test types and named typed lint pass. Native impact unmeasured; no new cohort or budget/base change. |
| C4.10 Consumed upload callback lifetime (≤1 h) | done `7a16fe7883`, native impact unmeasured | A live uploaded texture source keeps its consumed Memory saver completion callback in a WeakMap value, including any decoded-image/cache/owner captures. Remove the registration before invoking it at the same upload boundary; source dimensions, sampler and GPU sharing stay unchanged. A real-GC 1 MiB callback capture fails before the cut and collects afterward with its source alive; callback count remains one.4 focused and119 bounded-related cases/21 suites plus touched engine/test types and named typed lint pass. No native measurement, GPU disposal, cap/base change or summed fixture-byte saving claimed. |
| C4.11 Preview output lifetime (≤1 h) | source done (this code commit); native milestone pending | The first7a16 preview refused132s before the reader: its whole output/build log was absent, remover unknown, zero native samples/quiet. Isolated regression proves the old reaper deletes an unregistered active build directory despite its held port lease. Gate orphan cleanup by that lease and recheck registry rows; stale PID observations use existing identity-bound teardown, preserving replacement rows/reservations.8 focused wrapper cases, including actual isolated process/port fixtures, Bash/Python syntax pass; native C4/C6 verdict unchanged. |
| C6 Model source | done previously `d2ef0c0848`, historical calibration | 250 MiB base, explicit grid-only page claims, unchanged caps. This visit does not silently recalibrate the estimator or establish current ±15% accuracy. |
| C6.1 Pinned product / exact model audit | done (this commit) | Same `50d155f897` product and estimator: 299.764 MiB predicted / 260.664 MiB observed, 15.000330% high. Offline native-only audit refuses the exact miss, independently of G682; no base/cap change. |
| C6.2 Current calibration | open | Same-source8f metadata predicts314,325,416 /310,301,961B versus native276,602,440 /258,088,568B: +13.637977% /+20.230804%. Template1 is within ±15%, Template2 misses. Metadata was reopened from a separate rebuild at the same source pin; the native visit did not retain its product index hashes. Neither whole-model calibration nor a shared-base fit is established. |
| C6.2a Template-pair offline audit | done (this code commit) | The existing audit-estimate CLI now accepts either floor from the original templates selection and validates that the evidence contains only that cohort. Real CLI regression fails before and passes after; mixed menu evidence, collected samples and mixed source pins refuse, while a missing requested floor stays unknown/fail.26 related cases, scripts project/scoped fixture types and named typed lint pass. The saved5f99 pair still fails its native budget; no base fit, current-model accuracy or memory saving is claimed. |
| C6.3 Product identity at native milestone (≤1 h) | done `8aa25dcbfa`, future readings only | The existing native reader records a bounded Node-side product index SHA-256, wire length and source hash after all10/60/120s acceptance samples and optional passive categories. Exact original build checks bracket the read; one5s deadline,1MiB index/64KiB version caps, no blob/section fetches or page/Inspector bodies. Missing, changed or corrupt metadata stays unavailable without changing native errors/budgets.30 focused/31 related cases, scripts/scoped fixture types and named typed lint pass. This identifies the post-sample served product, not resident content; old8f results remain without captured index identity. No native repeat or estimator/base/cap change. |
| C7.1 Reader protocol separation | done `50d155f897` | Only the original cold, uncollected WebKit protocol qualifies G682. Chromium retains diagnostic totals but cannot print a WebKit PASS/FAIL. |
| C7.2 Coherent current four-floor reading | done (measurement), 2/4 PASS | `50d155f897`: 93.538 / 107.679 / 260.664 / 249.679 MiB. Both templates remain over G682; no repeated cohort or source-isolated gain claim. |
| C7.3 Template-only requalification selector | done `688f7e1d78`, measured FAIL in §14 | `sim-grid-entry.mjs --core-memory=templates` visits only the existing Template1/2 targets in their original order and applies the same G682 caps/protocol. Missing, collected, foreign-protocol or mixed menu evidence cannot pass. No third/fourth visit or new calibration. |

One official cold compiled Template 1 visit used landed `87491b8aa7`, build
`87491b8-mvo9ztg9`, with the existing reader's original title/select/SHARDFILE
entry, phone tier, 2× render and muted audio. No forced GC, heap snapshot or
Network-body capture. The selected-floor budget gate correctly exits **rc1**:
complete samples/errors0, not a boot failure.

| Original sample | WebContent bytes | GPU bytes | Combined MiB |
|---|---:|---:|---:|
| 10 s | 246,895,752 | 42,109,424 | 275.617 |
| 60 s | 231,543,944 | 42,158,552 | 261.023 |
| 120 s | 230,642,824 | 42,060,248 | **260.070 FAIL** |

Every sample sums both WebContent processes plus GPU. The original 120 s
total **272,703,072 B** exceeds the unchanged **208,182,520 B** limit by
**64,520,552 B / 61.532 MiB**. This page has no active grid prefetch. The
historical Chromium renderer-only 230 MiB criterion was not measured here;
WebKit's 219.958 MiB WC alone must not replace the combined G682 verdict.

Post-acceptance passive category events report last JavaScript/GC-owned
106,849,980 B (101.900 MiB), Page 118,213,188 B (112.737 MiB), Other
31,604,736 B and JIT 18,251,776 B; Images/Layers zero. Timestamps are zero.
These are not a disjoint physical-footprint decomposition or a worker census.
The weak allocation ledger names product backing 5,862,263 B, script backing
2,883,584 B, physics 1,835,008 B, render targets 42,407,988 B and engine-scene
GPU 12,766,900 B. Capacities/aliases and native process accounting are distinct;
subtracting those rows cannot identify a removable 61.532 MiB holder.

| Audited holder | Lifetime / readers | Decision |
|---|---|---|
| `ContentCache.inflight` + `pendingWrites` | Keep verified shared download through durable write acknowledgement; both entries leave on success/refusal. | Real-GC tests collect both internal download and write backing with the same cache alive, preserve independent caller mutation, verify exact durable reread and honest offline miss after refusal. No source change. |
| Worker pending/deferred commands | Posted requests retain owned put snapshots until reply; fetch `stored` replies return no body. | Existing bounded request retirement stays. Current worker heap/backing bytes remain unknown. |
| `ClientAssets.wire` / admitted product maps | Critical/library/ground bytes still feed synchronous/native/lazy readers; supported transport release has explicit ownership and reread fences. | Preserve; indiscriminate clear-after-boot would bypass these readers. Shared maps alone do not mean duplicate physical backing. |
| Product request/index aliases | Scoped owners share one descriptor; last-owner retirement removes aliases. | No current leaking owner proved. |
| Browser URL/content storage | URL cache is a verified hint; content persistence supports offline and revisits. | Native storage remains unattributed. Do not flush useful caches to manufacture a passing sample. |
| Composer / render-target capacities | Active live renderer inputs. | C5 remains the separate Opus/Jake look variant; no visual or GPU policy edit here. |

sp-x7 reported an artifact download/stream inspection and small Python regression
overlap before noticing quiet around 20:25Z. It is retained as overlap; no clean
timing or single-cut causal gain is claimed. Safari/Inspector/proxy, owned
preview and Simulator closed; quiet absent and zero booted devices verified
before source checks resumed. Release-red owners received the natural cleanup
handoff. No retry or second native visit. Original data and compact offline
rollup remain in `tmp/sp-x2/core-c4-template/`.

### C4.2 main-page holder census and idle worker cut

One Template-only Chromium snapshot on the same landed app pin `87491b8aa7`
used the existing streamed heap workflow via `browser-lane.sh`: muted iPhone
16 Pro, phone tier, 2× render, Developer on, explicit compiled entry, real
entered/unpaused controls, 120 s settle, service workers blocked and Inspector
Network-body capacity zero. No `.git/quiet`, native rereading, forced controls
or second main-page snapshot. Browser and preview closed before offline graph
work. The heap itself may collect garbage and cannot replace §11's native
acceptance value.

| Graph accounting (distinct rulers) | Bytes |
|---|---:|
| Rooted JS node shallow bytes | 29,755,996 |
| External strings, separate | 8,274,341 |
| Unique ArrayBuffer backing / 962 stores | 17,510,853 |
| Included product/source backing / 169 stores | 5,862,263 |
| Included Wasm backing | 4,915,200 |
| Included code/bytecode/metadata within JS | 14,718,876 |

Before/after snapshot `Runtime.getHeapUsage.usedSize` was 42,410,720 /
32,056,192 B; these are not node-shallow or native process units. The one
closed scope is `ui.Loading`; deleting its incoming graph edges in this saved
graph disconnects only **344 JS bytes / zero backing**, not the footprint gap.
The preferred retainer paths to product backing name the admitted assets and
`ClientAssets.wire`; Rapier owns the largest individual 1,835,008 B backing.
Trees overlap and deleting short Debug/global paths is not exclusive savings.
No broad product/cache clear is justified.

Both Playwright's worker inventory and browser target enumeration show exactly
two live `tileDecodeWorker` targets at settle; no content-cache/hash worker.
The decoder kept both contexts until its level scope ended, even if never used
or long idle. `TileDecoder` now retires the pool after 30 s with zero queued or
active decodes. New work cancels the deadline; the next request recreates the
original pool capacity and preserves round-robin IDs, detached whole-buffer
transfer, attached partial views, queued copy bounds and exact reply ownership.
Retired listeners detach. Permanent disposal/error stays final; a refused
restart rejects without detaching input. There is no new Debug row, renderer,
geometry, validation, terrain data or residency-budget change.

The controlled-worker kernel uses actual `structuredClone` transfer semantics.
Idle, never-used and queue-tail retirement cases fail on the original reader;
all six contracts pass with the cut, including new-work cancellation and
startup/error fences. This establishes two worker contexts -> zero while idle,
not their process-byte cost. Worker heaps/native backing remain unsized; no
claim that this recovers 61.532 MiB or passes G682. Raw snapshot, worker inventory,
graph rollups and retained paths stay locally in
`tmp/sp-x2-c4-heap/87491b8/`. The next native milestone qualifies byte impact.
Touched game/test types and named typed lint pass; six direct worker contracts
and 1,723 related cases / 321 suites pass. Fifteen stale-product suites remain
explicit CI deferrals; no product build or complete-suite PASS is implied.

## 12. C4 milestone and C7 protocol boundary (2026-10-25)

One cold compiled Template 1 visit on landed `6436257c8e`, build
`6436257-mvoblq55`, through the unchanged official native reader. No forced GC,
heap snapshot, Network-domain body capture or extra visit. All samples contain
two WebContent processes and one GPU process; runtime errors are empty.

| Native combined floor | 10 s MiB | 60 s MiB | 120 s MiB | Fixed limit MiB |
|---|---:|---:|---:|---:|
| Previous `87491b8aa7` | 275.617 | 261.023 | 260.070 | 198.538 |
| Idle retirement `6436257c8e` | 283.507 | 264.054 | **263.976 FAIL** | 198.538 |

At 120 s, WebContent is 233,935,984 B and GPU is 42,863,112 B: total
276,799,096 B, **68,616,576 B / 65.438 MiB over** the unchanged budget.
The 3.906 MiB increase is one cohort each, not an isolated regression or gain.
Passive categories arrive only after acceptance: last JavaScript/GC-owned
108,797,908 B, Page 114,692,396 B, JIT 17,891,328 B and Other 31,375,360 B.
These are not additive native owners; their timestamps remain zero.

Actual CPU overlap is retained: quiet began 16:09:23 local; sp-x9's existing
Pine tests ended about 16:09:24/32 and its 80-test commit gate ran
16:10:13–45 (`f55bcc097b`). No timing or causal claim. Reader/browser/proxy,
Simulator, quiet and the owned preview all closed naturally.

A separate no-quiet Chromium diagnostic on the same source pin uses the same
phone tier, 2× scale, muted real compiled entry and zero Inspector body capacity.
At 10 s both Playwright and browser target enumeration show cache/hash workers
plus two tile decoders; at **60/120 s both inventories are empty**. No forced GC
or heap snapshot. This confirms actual worker retirement, without sizing its
WebKit benefit. Allocator dump renderer private footprint is 224,611,328 B;
that is a different metric from the original libproc physical-footprint ruler
and does not qualify its 230 MB target. Buffer partition raw capacity is
19,415,040 B / live objects 15,662,400 B; web cache is 11,015,162 B. Parent,
child, raw and ownership-attributed sizes are not additive.

The historical 218 MiB prefetch holder was already identified as Inspector
response capture in `e17a51f183`, using a same-source comparison. It is not a new
game-cache savings claim or a blanket subtraction from WebKit. Current data
does not justify dropping live product buffers or changing the C5 look policy.
Raw current readings remain under `tmp/sp-x2/core-c4-idle-template/` and
`tmp/sp-x2-c4-workers/6436257/`; all diagnostic resources are closed.

The C7 audit found that the Chromium `core` command reused G682's WebKit budget
summary. It now reports original Chromium totals only, explicitly unqualified
for WebKit. The native summary requires `webkit-core-floor/1`, cold mode,
`forcedGC: false` and zero Inspector response-body capacity. Missing/failed
floors still fail unknown, limit/limit+1 and GPU inclusion remain unchanged,
and the official reader retains its budget-failure exit. A regression fails
before the guard; 20 focused / 21 related cases pass afterward, with scripts
types, scoped fixture types and named typed lint green. Re-admitting the saved
native menu and both Template readings preserves PASS / FAIL / FAIL exactly.

## 13. Current cohort and C6 prediction audit (2026-10-25)

One coherent four-floor visit uses landed `50d155f897`, build
`50d155f-mvochfy0`, through the original official `core-memory=all` reader.
Each floor uses a cold Safari process, cache reset, Developer on, phone tier,
2× render, muted audio and the real menu/select/compiled entry path. Every
10/60/120 s sample counts two WebContent processes plus one GPU process under
the owned Simulator launchd. All four visits complete/errors0. No forced GC,
heap snapshot or Inspector response-body capture. **Exit 1 is the budget
verdict, 2/4 PASS.**

| Floor | 120 s WebContent B | 120 s GPU B | Combined MiB | Fixed limit MiB | Verdict |
|---|---:|---:|---:|---:|---|
| Menu | 80,221,176 | 17,860,792 | 93.538 | 148.538 | PASS |
| SHARD SELECT | 94,376,976 | 18,532,632 | 107.679 | 148.538 | PASS |
| Template 1 | 231,380,080 | 41,945,584 | 260.664 | 198.538 | FAIL |
| Template 2 | 220,976,288 | 40,831,424 | 249.679 | 198.538 | FAIL |

Menu prefetch completes all 24 products / 4,332 files / 603,471,203 B, with zero
in flight at 120 s. These are observations on one current cohort, not isolated
source-cut gains. CPU overlap disclosures are retained: sp-x6 finite checks /
hooks about 16:32–16:34 local; sp-x9 commit gate 16:37:50–16:38:49 overlaps the
16:38:25 floor marker, and its meadow-related run began at 16:34:35 and was
still active at disclosure. No browser/Sim/build overlap was reported by those
lanes. Before preparation, format-related PID 82261 and Nine-focus PID 86485
were also active; their completion relative to quiet was not established.
No timing or repeat-cohort credit. Official reader, Inspector/proxy, Safari,
Simulator and owned preview all close; quiet absent / zero booted verified.
Raw samples and compact overlap rollup: `tmp/sp-x2/core-c7-current-four/`.

### C6: actual declared inputs, no fitted constant

A read-only metadata check reopens the **same landed pin**, verifies the
served version, and checks the 26,158 B `world/tiles` section's SHA-256. Its
product index hash matches the retained product used around the milestone:
`6331ad8e7152f59e1f79fd99a2ec38498cb2095289e73146aa2bf8968a364859`.
Source hash is `078e32620b18d3d85c89e613272fd4bb15de9705b66deaca0e17f6e632acc613`.
The 80 tile rows and admission budgets give the existing standalone model:

| Input | Bytes |
|---|---:|
| L0 | 13,099,624 |
| L1 | 2,749,512 |
| Far | 1,141,664 |
| Libraries | 14,013,259 |
| Simulation | 16,006,225 |
| Commons / overlap / grid-page claims | 0 |

Both estimator source files match `50d155f897` byte-for-byte. Executing the
existing `contentCost` with these inputs gives accounted **47,010,284 B** and
playing/loading **314,325,416 B / 299.764 MiB**, with the unchanged 250 MiB base
and 1.11 factor. The historical test fixture's 47,090,123 B is not substituted.
The actual native Template 1 result is **273,325,664 B / 260.664 MiB**:
prediction is **15.0003301556% high**, marginally outside the picked ±15% band.
No current-accuracy PASS, engine-base adjustment, cap change or native gain is
claimed from this single paired product/reading. Older different-pin visits
are not treated as calibration replicates.

The existing memory tool now audits that pair offline:

```sh
node scripts/shard-phone-memory.mjs audit-estimate _template 314325416 \
  < tmp/sp-x2/core-c7-current-four/summary.json
```

It validates the original native protocol and summary revision/reading build
prefixes, prints the explicit prediction, native bytes and signed percentage,
and keeps `within15Percent` separate from `budgetPassed`. Exact integer byte
arithmetic prevents display rounding from accepting a boundary miss. Missing
or zero observations are unknown; inaccurate models, native budget failures
and mixed source readings refuse success. An accurate prediction never
overrides a failed G682 budget. No new app/Simulator visit is needed to audit
a saved reading. Tests cover both exact tolerance boundaries and one byte
beyond, unknown/invalid inputs, CLI pass/fail and mixed source refusal. The
initial CLI regression fails before implementation; all 23 focused / 24 related
cases, scripts project types, scoped fixture types and named typed lint pass.
The metadata-only preview is closed, with no browser or Simulator launched.

## 14. Template world.data cut and native pair (2026-10-25)

Equipment/skin admission imported the complete product validator during
world.data preparation. Producer `dfa2feca44` extracts its exact bounded GLB
implementation once; reader `5f99d999e6` uses that defining leaf. Commons retain
their original byte-derived costing, loaded only when declared. All geometry,
rig, animation, bounds and malformed-byte checks remain. Local static entry
closure is635→632 files, raw6,559,793→6,520,336 B and
gzip1,754,790→1,743,836 B. These source sizes are not delivered or native savings.
No prior emitted bundle remained for a matching comparison.

Only the failing Template rows reran through the original official reader's
Template-pair selection (`688f7e1d78`): same target objects/order, fixed budgets,
cold compiled title/select entry, phone tier, DPR2, muted, no Network capture,
heap snapshot or forced GC. App `5f99d999e6`, build `5f99d99-mvoetw6g`.

| Original 120s floor | WC bytes, both processes | GPU bytes | Combined MiB | Fixed limit MiB | Verdict |
|---|---:|---:|---:|---:|---|
| Template1 | 237,311,112 | 43,076,080 | **267.398** | 198.538 | FAIL |
| Template2 | 216,962,184 | 40,471,024 | **245.507** | 198.538 | FAIL |

Both visits complete/errors0, every10/60/120s sample2WC+1GPU. Rc1 is measured
budget failure: excess72,204,672/49,250,688 B (68.860/46.969 MiB).
Compared with prior50d, Template1 is higher and Template2 lower. Different
pins, one pair each and peer overlap establish no consistent or isolated gain.
Menu/selection were not repeated; no current four-floor verdict is inferred.

The first command mistakenly supplied both base/rev and refused before launch
or samples. One cause-corrected rev-only pair completed in274s. Peer sp-x1
reported related checks17:45:26–17:45:46 local and hook17:46:06–17:46:19,
overlapping the first visit; retained, no timing credit. Own optional broad
product-free related walk was cancelled after more than15min before the native
pair; unfinished coverage is deferred, not called green. Source cuts passed
18/32 focused cases and CF1 42/139; pair-reader24 focus/25 CF1 pass.

The post-milestone runtime model regression uses the real compressed GLB and
equipment loader: exact position/normal/UV/index data, shared live ownership,
last-owner disposal and hash-valid malformed-byte refusal. Its first fixture
incorrectly expected a16-bit index from the default32-bit encoder; requesting
the encoder's existing compact-index option retains the strict parity check.
Two new cases plus23 existing graph/library cases, scoped fixture types and
named typed lint pass. No shipped visual or allocator policy changes.

Reader/proxy/Safari/Simulator cleanup completed; the owned retained preview was
stopped afterward. Raw samples and compact rollup remain locally at
`tmp/sp-x2/template-entry/native-pair/`. No second captured pair or forced
collection ran. C4 native attribution and the excess remain open; active
composer resources stay behind the existing C5 look decision.


## 15. C4 demand-start milestone (2026-10-25, sp-x2)

One original Template-pair native visit on landed`8f0324fea6`, build
`8f0324f-mvoksrkg`, complete275s/errors0. Cold compiled title/select entry,
phone tier/DPR2/muted, original10/60/120s samples and fixed G682 limits.
No heap snapshot, forced collection or Inspector Network-body capture.
Both floors contain2WC+1GPU at every sample; grid prefetch is null.

| Sample | Template1 WC bytes | GPU bytes | Combined MiB | Template2 WC bytes | GPU bytes | Combined MiB |
|---|---:|---:|---:|---:|---:|---:|
| 10s | 252,777,584 | 42,355,160 | 281.461 | 234,460,248 | 40,503,816 | 262.226 |
| 60s | 234,902,640 | 42,371,520 | 264.429 | 218,829,936 | 40,503,816 | 247.320 |
| 120s | 234,230,920 | 42,371,520 | **263.789 FAIL** | 217,568,368 | 40,520,200 | **246.132 FAIL** |

Exact120s totals276,602,440/258,088,568B exceed208,182,520B by
68,419,920/49,906,048B (65.250/47.594MiB). Rc1 is a measured budget failure,
not a boot refusal. Menu/selection are not repeated. Compared with the prior
5f99 pair, one Template is lower and the other higher; different source pins
and one cohort each establish no consistent or isolated gain. The unused-pool
kernel proves2->0 created workers, not that active Template terrain avoids
workers or that native pages were reclaimed. C4 attribution and C6 remain open.

Passive categories run only after each120s acceptance sample. Last
JavaScript/GC-owned104,996,418/91,618,566B, Page117,019,326/113,406,970B,
JIT17,891,328/15,761,408B and Other31,571,968/35,782,656B; Images/Layers0.
Timestamps remain0. These are neither additive footprint owners nor a worker
census; ledger GPU capacities also must not be subtracted from native GPU.
No removable holder, base change or current model-accuracy PASS is inferred.

Reported finite peer work drained before the visit; no overlap was reported.
Safari/Inspector/proxy closed, quiet absent, zero booted Simulators verified;
the distinct reader lease released first and the retained parent preview
was stopped through its full-identity guard. All CPU/Sim/browser/preview
resources released before subsequent checks. Raw original samples and
passive categories remain at`tmp/sp-x2/core-c4-demand/`. No repeat queued.

## 16. C4 context-only native floor (2026-10-25)

The existing official reader now accepts `--core-memory=contexts`: one cold
hello visit followed by one cold empty-WebGL2 visit, each at the original
10/60/120-second clocks through `sim-lane.sh`. The loopback fixture serves no
app, Three.js, composer, physics or shard content. Its context makes one clear,
then stays idle. There is no rAF loop, forced GC, snapshot, profiler, Network
capture or passive-category diagnostic. This is not an app-floor acceptance
run and has no new budget threshold.

One pair completed in264s, exit0, errors0. All six native samples sum both
WebContent processes and the one GPU process under the owned Simulator.
Both documents recorded zero resource entries and no grid prefetch at every
sample. The WebGL witness has one inline script/one canvas/one context/one
clear, zero context losses and a live WebGL2 context at120s. Its buffer is
804x1428 for the402x714 Safari viewport, exactly2x; this is not a full-height
PWA viewport. Alpha/antialias/stencil/preserved buffer are false, depth true.

| Cold fixture | Clock | WebContent B | GPU B | Combined MiB |
|---|---:|---:|---:|---:|
| Hello | 10s | 39,179,016 | 15,501,496 | 52.147400 |
| Hello | 60s | 38,753,032 | 15,501,496 | 51.741150 |
| Hello | 120s | 38,736,648 | 15,501,496 | **51.725525** |
| WebGL2 context | 10s | 39,736,120 | 15,812,816 | 52.975594 |
| WebGL2 context | 60s | 39,129,912 | 15,796,432 | 52.381844 |
| WebGL2 context | 120s | 39,162,680 | 15,796,432 | **52.413094** |

The120s totals are **54,238,144 /54,959,112B**. Their720,968B difference
(0.687569MiB) compares two independent visits, including the inline script,
CSS and canvas. It is not an allocation census or an isolated game-memory
gain. GPU process footprints do not enumerate host-GPU/renderbuffer storage;
this difference must not be presented as the full cost of WebGL allocations.
The fixture excludes the live renderer and cannot name a Template holder or
establish the size of an irreducible full-engine base.

This newer hello observation does **not** replace the fixed G682 calibration
of103,324,920B /98.538MiB. App budgets remain155,753,720 /208,182,520B and
the estimator base stays250MiB. No Template, menu or selection app reading
was repeated. C4 native holders and C6 full-model calibration remain open.

The diagnostic refuses extra resources/prefetch, a lost or multiple context,
non-2x dimensions, additional scripts/canvases, collection, foreign protocols,
app origins, repeated/warm modes and incomplete clocks.33 focused/34 related
cases, scripts/scoped fixture types and named typed lint pass. Native raw data
remain at`tmp/sp-x2/core-c4-contexts/`. Quiet absent, zero booted Simulators,
closed reader/proxy/Safari and closed owned loopback server were verified
before the final BOTH release. No repeat or further capture is queued.
