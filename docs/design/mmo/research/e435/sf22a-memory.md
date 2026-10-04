# SF22a: memory measured before the shardfile format (2026-10-04)

Row SF22a of [SHARD-PLATFORM](../../../../plans/SHARD-PLATFORM.md) (§3.2 caps v0, §4 F0). Jake: *"memory is a huge problem"*.
Raw numbers: [`progress/memory/sf22a-2026-10-04.json`](../../../../../progress/memory/sf22a-2026-10-04.json). Build `91f97bdfc`
(a clean HEAD export). Decimal MB, settled medians unless a peak is named.

**How it was measured**
- **iOS Simulator** (iPhone 17 Pro, Safari, a cold tab per target): the seven shards through `scripts/sim-memory.mjs`
  (play phase), the rig through `scripts/crossroads-rig/sim-probe.mjs`. *WebContent* = the kernel's physical footprint of
  the game tab; *GPU proc* = the WebKit GPU process. Taken with the Simulator to ourselves (an earlier run that overlapped
  the SF0 builder's was discarded).
- **Desktop**: headless Chromium on Metal at iPhone 16 Pro size (390 × 844 @3), one fresh browser per target,
  `scripts/crossroads-rig/desktop-probe.mjs`: renderer / GPU process footprints after one forced GC, and the labelled
  WebGL bytes from `scripts/parity/glbytes.mjs` (textures, renderbuffers, buffers).
- **The rig**: `scripts/crossroads-rig/` is a plain three.js page, not game code (`stage.sh` serves it next to a build).
  It stands the camera where four shards meet and builds every category of the cost model, each unit sized exactly at
  §3.2's caps: 40 L0 tiles (the 32-tile ring + 8 lookahead, 5 MB, ~38k tris, 8 draws each), 4 shard libraries (25 MB:
  17 × 1024² ASTC textures + six prop meshes), 32 L1 tiles (2.5 MB, 10k tris, 2 draws), 9 far proxies (1.6 MB), 4 whole
  sims (40 MB of written CPU arrays each), and decode / refinement overlap (one more L0 decoded and uploaded every 2 s
  while the oldest of two streamed tiles is disposed). Four material styles (toon, painterly, PBR, stylized Phong), a
  2048² sun shadow, render scale 2. Accounted total **554 MB** (339 MB GPU, 216 MB CPU). The engine base is not in the
  rig: it is the template's reading, added below.

**Simulator vs the phone.** The Simulator runs on the Mac's memory and GPU. Two things follow. (1) Its GPU process shows
less than the GL bytes the page allocated (the rig: 202 MB of 372 MB; Pine Hollow: 397 of 620), so GPU memory is counted
here as the **GL bytes**, the conservative figure. (2) The one Simulator-vs-phone pair on record (E264, Nine Dragon
Explorer, Web Inspector) is phone 1.054 GB vs Simulator ~0.75 GB, **×1.4**. Nothing here is phone evidence: SF22's
physical reading is the gate. Web Inspector's total runs well above the kernel footprint for heavy shards (Pine Hollow
1611 vs 700 MB), so it is recorded, not used.

## The engine base

| Empty template shard | Simulator | Desktop Chromium |
|---|---|---|
| Process footprint | WebContent **218 MB** (a blank tab: 46) | renderer 208 MB (blank: 17) |
| GPU | GPU proc 64 MB; GL bytes **81 MB** (render targets 80, buffers 0.8) | GPU proc 610 MB (≈ 285 MB of it is the Metal / ANGLE floor any WebGL context costs there) |
| JS heap | Inspector "javascript" 131 MB (at the peak) | V8 heap + ArrayBuffers 25 MB |
| Tab total | **282 MB** (WebContent + GPU proc); **299 MB** (WebContent + GL bytes) | — |

**The engine base is about 300 MB on the Simulator, so §3.2's 300 MB holds there.** On the phone, at ×1.4, it would be
~420 MB. Unverified until SF22.

## Each shard alone (Simulator, play phase)

| Shard | WebContent | GPU proc | Tab | Load peak (WebContent) | Geometry arrays still held in JS | Desktop GL tex / buf |
|---|---|---|---|---|---|---|
| Template | 218 | 64 | 282 | 275 | 7 | 80 / 1 |
| Driftwood Isle | 613 | 255 | 868 | 757 | **201** | 114 / 158 |
| Nalati Grasslands | 606 | 209 | 815 | 665 | 100 | 123 / 73 |
| Pine Hollow | 700 | 397 | **1097** | 820 | 61 | **577** / 43 |
| Sunscar Dunes | 240 | 158 | 398 | 480 | 19 | 149 / 12 |
| Far Reach | 251 | 238 | 489 | 431 | 29 | 258 / 21 |
| Nine Dragon Stack | 338 | 249 | 587 | 758 | 57 | 131 / 134 |

A shard costs 116–815 MB over the engine base on its own. Pine Hollow alone is over the 850 MB envelope. Driftwood keeps
201 MB of geometry arrays in JS after upload. Pine Hollow's 577 MB of textures is the "1.7× too big" the streaming
research predicted.

## The rig at §3.2's caps

| | Simulator | Desktop Chromium |
|---|---|---|
| CPU side (WebContent / renderer, settled minus empty) | **+245 MB** for 216 MB accounted (×1.13) | +255 MB (×1.18) |
| GPU (GL bytes) | **372 MB** for 339 MB accounted (+ the shadow map and the streamed tiles) | same (GPU proc +499 MB: Chromium ×1.34) |
| Content total | **617 MB = ×1.11 of accounted** | — |
| While streaming (vs static) | WebContent flat (306 vs 311); GPU proc **+49 MB** | GPU proc +150 MB (Chromium frees late) |
| Load peak (all built at once) | WebContent 639 (settles to 306) | renderer 656 |
| JS copies kept (three's default) | WebContent **662 MB (+357)** | renderer +337 |
| Frames | 59.9 fps, 99.8 % ≤ 33.3 ms, render CPU p95 3 ms, 280 draws, 1.22 M tris | 60 fps, render CPU p95 1.8 ms, 271 draws |
| One streamed L0 build (main thread) | 15–25 ms | 13–18 ms |

**Crossroads at v0, on the Simulator model: 300 base + 617 content = ~917 MB, over the 850 MB envelope.** About 160 MB of
that is the four sims (§3.2 budgets 40 MB a shard but leaves sims out of the envelope sum). At ×1.4 the phone would be
~1.3 GB, which crashes. The frame times are vsync-bound on both surfaces, and the Simulator's GPU is the Mac's, so they
show only that the caps don't choke a desktop GPU. Draws: 271 with the sun shadow, 64 without. The shadow pass sees every
L0 caster in ±160 m, which is above the research's estimate of ~160 draws.

## Recommended revision of §3.2 (caps v1)

| Cap | v0 | v1 | Why |
|---|---|---|---|
| Engine base | 300 MB, unverified | **300 MB, Simulator-verified** (282–299) | the template reads ~300 MB; the phone figure comes from SF22 |
| L0 resident | 5 MB | **4 MB** | measured ×1.11 overhead, and the worst disc carries 8 lookahead tiles on top of the ring |
| L0 download / tris / draws | 0.3 MB / 40k / 8 | keep | 1.2 M tris and 280 draws held 60 fps (no evidence either way for the phone) |
| L1 resident | 2.5 MB | **2 MB** | the 32-tile ring is the third-largest item (80 → 64 MB) |
| Far proxy | 1.6 MB | keep | 9 proxies cost 14 MB (25 cost 40) |
| Shard library | 25 MB | keep | the four-library disc holds the fewest L0 tiles (21) |
| Sim residency | 40 MB / shard, outside the sum | **25 MB / shard, inside the envelope** | 4 × 40 = 160 MB was the largest uncounted item |
| Streaming slack | 80 MB | keep | measured +49 MB of GPU growth while tiles stream |
| Playing envelope | 850 MB | keep | at v1: 300 + 1.11 × 394 accounted + 80 = **~818 MB** |
| **New: no JS copies after upload** | — | **a format rule** | keeping three's copies cost +357 MB in the rig; today's shards hold 7–201 MB |
| **New: the shadow pass counts in the draw cap** | — | shadow casters only from L0 within ~80 m | the shadow pass quadrupled draws (64 → 271) |

`validate`'s worst 150 m disc (computed for the 555 m pitch): 32 L0 tiles from one shard, 26 from two, 22 from three,
21 from four, plus 8 lookahead. At v1 the worst of these is 29 × 4 + 4 × 25 = 216 MB.

**Risk to carry into SF7a / SF22:** v1 fits 850 MB on the Simulator model, not on a ×1.4 phone. If SF22's physical
reading confirms ×1.4, the content budget has to fall by about another 30 %. The cheapest cuts, in order: three sims
instead of four (keep only the shards the player can reach), 20 MB libraries, then 3 MB L0 tiles. The caps are
constants beside `CELL_*`, so the format must not freeze them.
