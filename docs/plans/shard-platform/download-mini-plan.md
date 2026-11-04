# Download and load: a runtime build from the shardfile (mini plan)

**State:** `open` 2026-11-03 18:40 Cancun, written by wildshard-v; Jake said *"build it"*, handed to wildshard-new
(G1000). Ask E525. Builds on the two spikes, [download-speed-mini-spike.md](../download-speed-mini-spike.md) and
[bulk-download-mini-spike.md](../bulk-download-mini-spike.md); Jake's brief:
[Download Speed Plan](https://claude.ai/artifact/24CcAJ4uMT32DFt4sVj83e).

Jake, 2026-11-03 ~18:30: *"A shard file is not what the engine needs, right? A shard file is a output format. It's a
machine and human readable output format for generating these levels and these shards. The actual freaking engine, when
it comes to downloading, loading, running, executing, we can have a full static build pipeline that converts a shard
file into something that is really fucking good, efficient, useful, fast, baked, pre-baked, for the game to download,
execute, run, etc. I think we have completely missed a step. … There's all kinds of optimizations that can be done
outside of the JavaScript main thread of the actual game running in the browser, and that needs to go into the plan."*

Jake, ~18:35: *"Yes, build it, but be very, very fucking careful with start playing the level before you finish
downloading it. You're going to turn a download problem into a loading problem. … Every attempt that the agents have
made of streaming content in-game over the last 5 weeks have like basically been a shitty experience … texture popping,
texture loading, walking around and seeing a bunch of placeholder or far view assets before the real high fidelity stuff
comes in … especially when you hit the hoverboard, especially when you hit boost. So we're just looking at pure
downloading and loading optimizations that can be done to make the game start faster. We're not looking at playing the
game before it's ready … I don't want to leave it up to fucking luck."*

Jake, ~18:38: *"I don't want the game fucking rereading stuff. It already has. It should just do a fucking handshake …
an endpoint on the server where there's a handshake. And it just gets told of these 1,200 things. Only 400 of them needs
to be invalidated … minimal messages over HTTP, HTTP2, or WebSockets. Use the correct fucking protocol. Use HTTP2 when
it's available. Use WebSockets if necessary. Again, dialing only the 5 megabytes you need and streaming the rest is
really fucking dangerous."* (DL18, DL19)

## The hard rule: the level is complete when you get control

**No row in this plan lets the player move before the level is fully downloaded and loaded at full fidelity.** No
"before control / after control" split of the level, no deferring level content past control, no placeholders, far
proxies or low-res textures standing in where the player can reach, on foot, on the hoverboard or at boost. The spikes'
"≤ 5.5 MB before control" lever (DS1) and "start the engine while bytes stream into gameplay" (DS4 as written) are
**rejected**. Making bytes arrive faster, and overlapping the *loader's* CPU work with the download while the loading
screen is still up, is allowed: control comes only after the last byte is in and the last piece is built. Rows only
make the download smaller and faster and the loading cheaper. DL17 checks this rule on every row.

## The missing step

Today there are two stages, and the phone's main thread eats the gap between them:

1. **Shard source** (generators, `src/shards/<slug>/`) → `build-shardfiles.mjs` →
2. **Shardfile**: engine-agnostic, human- and machine-readable, one blob per sha256. Right for authoring, dedupe and
   running arbitrary shards. **Wrong as the thing a phone downloads and executes.**

The phone downloads the shardfile as 419 loose files, then on the main thread re-reads them, validates them, parses
GLBs into a scene library, assembles the world, joins colliders, boots the native modules and links shaders. All of
that depends only on *shardfile + engine build + tier + entry point*, so it gives the same answer on every phone, every
time. It belongs at build time.

**This plan adds stage 3, the runtime build**: a plain static script (G799: no Vite plugin, no virtual module) that
compiles each built shardfile, per tier and entry point, into **runtime packs**: a few pre-validated parts holding
GPU- and physics-ready bytes that the engine maps and uploads. The shardfile stays the source of truth and the
engine-agnostic format (G934 keeps it). Runtime packs are a deploy output keyed by the shardfile hash *and* the engine
build, never committed, rebuilt by CI like every other build output. The runtime build is generic over every shardfile:
no shard names, no shard branches (host bar, E405). A missing or stale pack falls back to today's shardfile path, which
stays the authoring and Developer path.

**The rule from now on (G1000):** anything the loader does whose inputs are only the shardfile, the engine build and
the tier is done at build time. What is left runs in a worker unless it must touch the GPU or the DOM. The main thread
fetches nothing it has to parse, checks nothing the build already checked, and computes nothing it could have read.

## Where the time goes today (measured, warm cache, so pure CPU)

Build `d4d4b17`, `phone` preset (CPU 10×), cached run, 35.5 s tap → control
(`tmp/phone-loading/2026-11-03T19-46-40-719Z-d4d4b17-mw13gps7/chromium-grid-warm.json`). A cold run adds the
download on top: ≈ 15.5 s for 18.4 MB, plus +19 s when the worker's 24 MB precache shares a phone's single link.

| step (boot measures) | ms at 10× | what it is | moves to |
| --- | --- | --- | --- |
| Home region create (total) | 18,446 | everything below | — |
| `world.world.scenes` | 6,203 | builds scene objects from the product | build: flat scene tables (DL7) |
| `scene.library-intake` (+ owned cascade, cargo, rocks, specimens) | 4,075 (+3,732) | parses GLBs into the scene library | build: GPU-ready buffers (DL6) |
| `product.read` | 3,962 | reads `shard.json` → sections → blobs again, validates each | build: validated once, members as views (DL5, DL13) |
| `world.world.assembly` + `assembly:construct` | 2,914 + 1,265 | places and joins the world | build: resolved instance tables (DL7) |
| `native.foundation` + `native.inputs` | 1,731 + 1,069 | AssemblyScript modules start and take their inputs | build: memory image (DL12) |
| `grid:assembly.collider-join` | 1,164 | joins colliders per cell | build: pre-joined colliders (DL8) |
| `grid:assembly.compiled-page` | 986 | compiles the grid page | build (DL7) |
| Shaders + spawn + world program links | 1,838 + 511 + 1,293 | shader compile and link | baked variant list, compiled in parallel during the download (DL10) |
| Application modules (JS) | 3,506 | 108 JS chunks evaluated | 3 chunks (DL14) |
| 86 long tasks | 10,036 total | main thread blocked > 50 ms | workers (DL11) |

### DL4 inventory: build, worker or main thread (11-03)

Cold: HEAD `89d8680`, `phone` preset, page and worker on DL0's shared link
(`tmp/phone-loading/2026-11-03T23-56-09-304Z-89d8680-mw1cj2wg/chromium-grid-cold.json`, 65.6 s tap → control). Warm:
`d4d4b17` above (35.5 s). ms at 10× CPU, summed per measure; sub-steps overlap, so columns do not add up. *Build* means
the step's inputs are only the shardfile, the engine build and the tier, so the runtime build writes its result
(G1000). *Main thread* is kept only for the GPU, the DOM, input or the player's saves.

| step | cold ms | warm ms | inputs | where | row |
| --- | --- | --- | --- | --- | --- |
| Application modules (wait for the spawn set + 108 JS chunks) | 27,261 | 3,506 | the spawn set's bytes; the build's chunks | download: packs, nothing competing; JS: build | DL1, DL2, DL5, DL14 |
| `product.read` + `product.source` (2 reads) | 6,166 + 4,474 | 3,962 + 1,518 | shardfile (`shard.json` → sections → blobs), validated per blob | build: validated once, members as views | DL5, DL13 |
| `world.world.scenes` | 7,273 | 6,203 | shardfile, tier | build: flat scene tables | DL7 |
| `scene.library-intake` + owned cargo / cascade / native / reef | 5,083 + 2,673 / 688 / 474 / 567 | 4,075 + 1,169 / 1,466 / 614 / 258 | shardfile GLBs, tier | build: GPU-ready buffers | DL6 |
| `fixed-draws:whole` (cold-only `whole.read-wait / yield / decode / assemble / release`, ≈ 2.0–2.2 s each, overlapped) | 2,382 | 296 | product props, tier (warm restores the home-build cache) | build: decoded whole geometry | DL6 |
| `world.world.assembly` + `assembly:construct` + `world:assembly:library` | 3,734 + 2,975 + 2,185 | 2,914 + 1,265 + 192 | shardfile, tier | build: resolved instance tables | DL7 |
| `world.world.baked` / `world.looks` / `world.world.water` | 1,106 / 603 / 280 | 1,458 / 728 / 538 | shardfile, tier | build (inputs to confirm at DL7) | DL7 |
| `grid:assembly.compiled-page` | 617 | 986 | grid catalogue, shardfiles | build | DL7 |
| `grid:assembly.collider-join` | 906 | 1,164 | shardfile colliders | build: pre-joined colliders | DL8 |
| `native.foundation` + `native.inputs` + `native.terrain` | 2,348 + 956 + 522 | 1,731 + 1,068 + 299 | AS modules, shardfile | build: memory image | DL12 |
| `native.checkpoints.pause` | 1,245 | 592 | none (a yield) | main thread scheduling; goes when its work moves | DL11, DL12 |
| `boot.script-memory-bank` | 1,048 | 698 | the build's module bank | build | DL14 |
| Gameplay and saved state (quest composition 792, held claims 472, population 636) | 2,180 | 1,130 | shardfile + the player's saves | main thread for the saves; product-only parts → build | DL7 |
| `entry.wait-equipment` / `entry.wait-content` | 1,137 / 841 | 776 / 1,012 | waits, no CPU | hidden by overlapping the download | DL11 |
| Shaders + spawn and world program links + precompile census | 1,800 + 490 + 1,140 + 946 | 1,840 + 510 + 1,290 + 1,066 | baked GLSL variants | main thread (GPU), compiled during the download | DL10 |
| First frame / world frame / drawn frames | 710 / 900 / 550 | 560 / 740 / 570 | GPU upload, first draws | main thread (GPU) | stays |
| Long tasks before control | 109 tasks, 11,237 | 86 tasks, 10,036 | — | workers | DL11 |

**Re-sizing from this table.** On a cold visit DL6's share is ≈ 10.9 s, not 7.8 s: intake 5.1 + owned 4.4 + whole
geometry 2.4 (≈ 8.7 s warm). DL13's product reads are 10.6 s cold against 5.5 s warm, so the re-reads cost most on
the first visit. Application modules at 27.3 s cold is mostly the shared-link download (DL0), so DL1 / DL2 / DL5 come
before DL14's 3.5 s of chunk evaluation. Nothing in the list needs the main thread except shader and program work, the
first frames and the saves.

## Impact on the engine and the game (measured 11-03)

Two phases with very different blast radius:

- **Phase A: the byte layer only (DL0–DL3, DL5, DL13–DL15, DL17, DL18).** The packs carry the *same* bytes as today
  (the same GLBs, section JSON, bins and textures), only grouped, pre-validated and fetched once. Every byte read in
  the game funnels through about ten files: `firstPartyRead` (`src/game/grid/products.ts`,
  `src/game/shardfile/product.ts`, `runtimeProduct.ts`, `clientAssets.ts`), `readContent`
  (`src/engine/boot/contentRead.ts`, 8 callers), `packReads.ts`, `spawnDownload.ts` and `sw.js`. Nothing above them
  changes: they still hand out the same bytes. **Small to medium, low risk**, and it takes the download wins (−19 s of
  worker contention, the 761 re-reads, ≤ 10 requests, the handshake).
- **Phase B: baked results replace runtime work (DL6–DL12).** This changes what the consumers *receive*. GLB parsing
  sits in 23–31 engine and game files (`src/engine/core/assets.ts`, `anim/rig*.ts`, `render/families/pbr.ts`,
  `entities/AnimalFactory.ts` …); scene building from sections is the 23,000-line `src/game/shardfile/` client, and
  130 files in `src/game/` import from it; world assembly and colliders live in `src/game/grid/`. **This is the big
  rewrite**: weeks, not days, and every step can change the look, the physics or memory.

**How Phase B stays a loader rewrite, not an engine rewrite:** each bake writes *exactly the in-memory result the
runtime builds today* at one seam (the scene-library entry after intake, the instance tables after assembly, the joined
collider set, the native modules' memory after init), and the code above that seam is left alone. One seam per row,
biggest measured cost first (scene-library intake 7.8 s, `world.world.scenes` 6.2 s, `product.read` 4.0 s), each behind
the shardfile fallback and the `Loading: runtime packs / shardfile` Debug row until it passes the goldens on every
shard + WebKit, the physics walk, the memory caps and DL17. A seam that can't be snapshotted without changing the
consumer is reported to Jake before anything above it is rewritten.

## Bars

- **The whole level downloads at the wire floor**: ≤ 10 requests, no competing traffic before control, within 1 s of
  bytes ÷ bandwidth at the `phone` preset, measured on a served build (`--rev`) with the worker on the same link (DL0).
- **Fewer bytes for the same level, never by leaving anything out**: −30 % wire bytes from encoding (quantized
  geometry, no duplicates, brotli 11 where it serves), the same content at the same fidelity.
- **Warm tap → control ≤ 12 s at the `phone` preset** (today 35.5 s); **cold ≈ the larger of download and loading**,
  not their sum (today ~50 s).
- **North star: 5 s to play on Jake's phone.** At 100 Mb/s the whole level downloads in ~2 s; the rest is the CPU this
  plan moves off the phone.
- **The level is complete at control** (DL17), every time. Every row that can change a pixel re-runs the 24 SHARDFILE
  goldens on every shard it touches, plus WebKit (G998); physics rows run the walk with 0 stuck; memory stays under
  1.8 GB loading / 1.2 GB Explorer per shard.

## Rows

| Row | What | Done when | Lane | Size |
| --- | --- | --- | --- | --- |
| DL0 | **Measure the truth.** `phone-loading` throttles the service worker on the page's own link (today it gets a second 10 Mb/s, so the 24 MB precache never shows); the daily runs against `--rev` and adds `download-bench spawn` (DS6) | A cold run shows the worker's requests and bytes in its totals; the hourly check-in's daily line updated. **Done 11-03 (`0222e26249`):** one shared link (`scripts/phone-loading/link.ts`); cold HEAD `89d8680` 65.6 s tap → control (53.5 s on separate links), worker 372 requests / 24.86 MB in the title dwell, link peak 1.20 of 1.25 MB/s; request accounting still incomplete on one `sw.js` row, as before the change; daily lines handed to wildshard-new | Opus | S |
| DL1 | **Nothing competes with the level's download** (BP1): the worker registers at boot as now, but its offline precache of *other* files (other shards, the unused `grid-strip-mesh` bins) waits until after control; hashed `/assets/*` `immutable` in `vercel.json`. Everything the level needs is still in the level's own download | Cold phone-loading (DL0) −15 s or more; warm second visit no slower (watch 039d's uncontrolled-document trap); DL17 green. **11-03:** worker half landed `4cc448d258` (install is shell-only; the code precache runs after `ws:control-ready`), measurement pending. **Immutable step dropped** (G872, wildshard-new): it conflicts with E177/E188 (`26f8b96a9f`: code files revalidate, no year-long 404s) and is not needed, since the post-control precache reads already-loaded chunks with force-cache | Opus | S |
| DL2 | **Start the level's download on the title screen for first visits** (DS3), not only for a saved last shard | Download starts at the title on a fresh profile; −3 s at a 3 s dwell | Opus | S |
| DL3 | **Trace the +1.9 MB `grid-strip-mesh` bin** that entered the set after `8bdf53f` (DS7) | Its owner commit named; dropped if the level never reads it, kept if it does. **Closed 11-03: kept, real reader.** `mesh-c896ac4a.bin` (11,463,893 B raw / 1,900,770 B wire) is Driftwood's compiled grid strip page: `session.ts` → `readCompiledGridStrips` installs its 40 strips (roads and their colliders), decoded by sp-x1 from the exact retained body. Producer from `a2be8fd413` / `3232e141cc` / `007c347629`, all before `8bdf53f`; the commit that put it in the spawn set was not bisected (wildshard-new: it changes no decision) | Opus | S |
| DL4 | **Inventory, then sort**: every boot step in the table above (and the cold run) marked *build*, *worker* or *main thread*, with its inputs and measured ms; nothing stays *main thread* without a reason (GPU upload, DOM, input) | One table in this file; the rows below re-sized from it | Opus | S |
| DL5 | **The runtime build and its pack format.** `scripts/runtime-build/` reads each built shardfile and writes, per shard × tier × entry, **the whole level** in ≤ 12 MB parts (extend I5's `blobs/pack`: 16-byte aligned members, offset table in the module bank; BP2). Validation (sha256, admission, schema, ceilings) happens here, once; the runtime trusts the part hash | Driftwood grid/phone: ≤ 10 requests to control, same content as today; pack build ≤ 30 s in CI; loose-URL fallback on a 404. **Design findings 11-03 (sp-o3, built tree of `5fcb0ac` (`5fcb0ac-mw1c7hz2`, corrected from 7c45e170ae by sp-x2)):** (1) parts cannot be per manifest: the 112 spawn manifests (shard × tier × client / grid mode) sum to 2.6 GB raw against 374 MB of distinct files (a 2.3 GB tree), so packing each would add ≈ 2.6 GB to every deploy. (2) Exact sharing by signature (the set of manifests that need a file) gives 121 groups and zero over-fetch, but Driftwood grid/phone would still fetch 60 parts (median manifest 41). (3) First-party product reads are plain `fetch` with no page index (`product.ts` `browserProductCache`), so on an uncontrolled first visit, parts that bypass the loose URLs would make every re-read go to the network: the reader must answer reads from the parts' members, a many-read version of `entryTransport().take()`. That pulls DL13's first slice into DL5. **Proposed:** shared parts built from signature groups, merging any group under ~2 MB into its smallest superset group (bounded over-fetch, measured), cut at ≤ 12 MB; the public entries (grid `000` and client, phone) drive the merge until each is ≤ 10 parts; members are also put under their loose URLs for the next visit and the worker. **Accepted by wildshard-new 11-03:** the merge is steered by the public phone entries' own sets (grid `000` plus client) with a 10 % over-fetch cap; DL13's first slice (answering re-reads from members) is folded in here. **Deploy size:** today's output is 10,478 files / 2.3 GB (`5fcb0ac`); parts add about 27 files and +374 MB beside the loose copies (DL20 retires them). Vercel (vercel.com/docs/limits) caps a CLI deployment at 15,000 files and an upload at 1 GB on Pro, and states no total-output cap; `vercel deploy --prebuilt` uploads only files whose hash it does not hold, so a deploy sends only changed parts **Whole level (ruled 11-03, G872, literal):** `7683b302b5` puts the bodies each tier streams during play in the spawn set and parts (Driftwood +31.7 MB raw, Pine +7.5, others < 1). **Late-inventory audit** (phone tier files control never requires, against every recorded phone-loading and DL17 run): *seen loading in play*, now all declared: the library's `late` members (`4295e70629`: control drops them, play loads them) and every tile of the tier (`a926464c64`: tile streaming, never required by control) joined the set, so no file a run from 11-03 on saw in its own level is left out, and the phone whole-level set is each tier's complete inventory (Driftwood 305 files / 71.8 MB raw, Pine 746 / 95.9, Nalati 314 / 85.3, Nine 574 / 113.6, Far Reach 151 / 34.6, Sunscar 141 / 7.9); before that the seen set was: Driftwood 35 files / 7.2 MB, Pine 146 / 22.5, Nalati 47 / 8.3, Far Reach 33 / 1.6, Sunscar 50 / 0.7, Nine 2 / 0.9; *never seen* (drop candidates, for each shard's owner to confirm dead or rarely reached): Pine 256 / 24.8 MB, Nalati 80 / 33.0, Nine 31 / 42.5, Driftwood 10 / 2.2, Sunscar 34 / 0.6, Far Reach 4 / 0.2; the Explorer and compare UI images in that list are menu content, not play. Recorded runs are short (control + a few seconds, DL17's boost lap), so 'never seen' is a candidate list, not proof. Grid: the home shard follows the rule; neighbours keep today's loading (open question for Jake, G828). Other review fixes: shard images in parts and members over 12 MB refused (`7c6368e08f`); stable name-keyed placement (`a69dda496d`; Driftwood grid 9 parts, Nine 12) | Opus | L |
| DL6 | **GPU-ready geometry**: the build writes final interleaved, quantized vertex and index buffers in the engine's attribute layout, grouped by material family (feeds EP6 / EP8's baked batches), so loading is view → `bufferData` with no GLB parse and no scene-library intake | Scene-library intake and its owned cascades (7.8 s) → ≤ 1 s at 10×; goldens green on all shards + WebKit. **Size census 11-03 (sp-o1, Driftwood grid/phone spawn set on `d62b169`, brotli-11 per file):** 64.1 MB raw, 17.0 MB wire. GLBs 27.2 MB raw → 5.87 MB wire (150 files, only 14 meshopt; still float: colours 3.3 MB, positions 3.5 MB in non-quantized files, `_SWAY` 1.7 MB, plus 2.1 MB of 16-bit colours). Lossless meshopt on the rest makes the wire *bigger* (8.23 MB: brotli already takes these GLBs 4.6×), so only lossy quantization (positions int16, colours unorm8, normals oct8, sway snorm16) can cut geometry bytes, and that is a look change for the goldens. The other buckets: poorly compressing `bin` 5.8 → 3.8 MB wire (Driftwood's cover cells, a Float32 splat grid, 3.2 MB on its own), JS 8.1 → 2.1 (DL14), the grid road strip mesh 11.5 → 1.3 (kept unquantized on purpose in `gridStripPages.ts`), wasm 3.9 → 1.1 (Rapier 3.3), KTX2 1.3, section JSON 5.0 → 0.8. **So DL6 is mainly a CPU row** (no GLB parse: scene-library intake 4.2 s + owned cascades 3.7 s at 10×); its byte win on Driftwood is the quantization's, about 1–2 MB wire (estimated, to be measured), and the larger byte wins sit in quantizing float content data (cover cells) and DL14's JS. **Byte verdicts 11-03 (sp-o1, whole-level sets on `556200b69e`, before e83d58c67a's tier fix):** the deploy serves brotli at quality 3, not 11 (`compactGlb.ts`, `scripts/phone-wire.mjs`), so q3 is the wire that counts. (1) *Geometry quantization:* forcing the existing I3 compactor (`compactPhoneGlb`, picks the smallest of input / grid-quantized / + meshopt at q3) on every phone GLB saves Driftwood 1.22 MB (10.27 → 9.05), Pine 1.41 MB (15.81 → 14.40), Nine 0.21 MB (26.87 → 26.66; its slabs are already meshopt). Driftwood's share is mostly its 43 whole-geometry inputs (16 props tiles + 27 whole-library models, 0.72 MB); its rocks were the desktop files e83d58c67a removed. Those inputs **cannot be compacted without changing the consumer**: `admitNativeWholeGeometry` (`src/engine/models/nativeGeometry.ts`) checks each channel's storage against the GLB's declared `nativeAttributes` and the whole assembler reads positions under its `matrix64` pose with no grid scale, so it is a consumer change for Jake first (Phase B rule). Gull, fish and cargo stay exact (`fixedModels.ts`). (2) *Cover cells:* not a Float32 grid; `bakeCoverCells` already writes 22-byte quantized records, and their randomness (jitter, yaw, scale) is what brotli cannot take: lossless byte columns 2.32 → 2.13 MB (q11), 8-bit x / z / yaw 1.70, and sampling the six ground / cover colour bytes at runtime 1.22. Every variant changes Driftwood's cover decoder (`streamedCover.ts`), and the lossy ones change the look. **Verdict:** neither prototype has a byte win without a consumer change; the largest is under 1.5 MB a shard. | Opus | L |
| DL7 | **Pre-resolved world**: placements, instance matrices, LOD tables, cull cells, bounds, the compiled grid page and the road as flat typed arrays; `world.world.scenes` and assembly become reads | `world.world.scenes` + assembly + compiled page (11.4 s) → ≤ 2 s at 10×; goldens green. **Profile findings 11-03 (sp-o1, `d62b169`, grid/phone cold, CPU profile mapped through the build's hidden source maps):** (1) `world.world.scenes`'s 6.0 s is wall time, mostly *other* work in the same window: browser-native `(program)` 1.56 s, grid road look/cull/tile backing ≈ 1.1 s (`roadLookPlatform`, `roadCull`, `roadTileBacking.capture`), Cache Storage `put` 0.77 s (`assetCache.ts`), idle 0.46 s. Scenes' own JS is ≈ 1 s (GLB parse in `ownedGeometry.ts`, `worldScenes.ts`, `tiledMesh.ts`). Baking the scene tables alone saves about 1 s, not 6. (2) `assembly:construct` (3.0 s) is mostly `readWholeGeometry`'s GLB read, parse and join (`geometry.ts` `WholeGeometryAssembler`), plus material graphs; the compiled page (0.58 s) is ≈ 0.3 s of `compiledStrips.ts` JS plus native time. (3) **The seam already exists:** the runtime snapshots exactly this result into its IndexedDB home build cache (`homeBuildCache.ts`, `homeGeometrySnapshot.ts`: `whole:` and `owned:` keys by build, shard, revision and tier), and the code above already restores it on warm visits: cold → warm `assembly:construct` 2,985 → 1,278 ms, `fixed-draws:whole` 2,274 → 252, `assembly:library` 2,096 → 206, `owned:cargo` 1,826 → 987. **Proposed first bake:** write those snapshots at build (shard × tier, the runtime's own snapshot code), serve them as DL5 members, and seed `readHomeBuildGeometry` from the member on a cold miss: no code above changes; about 3 s at 10× on Driftwood. **Bytes decide it:** Driftwood's snapshots are 19.9 MB raw (whole 13.8, owned 6.1) against 19.4 MB of GLBs they replace (the whole set's 93 inputs 14.3 MB, owned 5.1 MB): byte-neutral only if those GLBs leave the entry's download, otherwise +20 MB. So it lands with DL6's quantized buffer form (the snapshot written quantized, est. −40 %) and the replaced GLBs out of the entry set, once every other reader of those GLBs is accounted for; until then it stays behind the shardfile fallback and the Debug row. | Opus | L |
| DL8 | **Pre-joined physics**: colliders per cell joined at build (heightfields, trimeshes, compounds) in Rapier's input form; try Rapier world snapshots | `collider-join` (1.2 s) → ≤ 0.1 s; physics walk 0 stuck | Opus | M |
| DL9 | **Textures per tier**: measure shipping the phone tier's KTX2 already transcoded to ASTC against Basis transcoding in a worker; keep whichever loads faster at equal or better memory and the same look | A measured verdict in this file; the winner lands; goldens green | Opus | M |
| DL10 | **Shaders compiled while the bytes arrive**: the build writes each entry's program variant list (with NF13–NF18's GLSL); the loader compiles them with `KHR_parallel_shader_compile` behind the loading screen during the download, not after the world | Shader + program-link steps (3.6 s) mostly hidden under the download; first world frame has 0 new programs | Opus | M |
| DL11 | **Loading in workers, overlapped with the download** (the loader half of DS4 only): decompress, parse and physics build run in workers as each part arrives, behind the loading screen; the main thread only uploads and adds to the scene. Control still waits for the last part and the last build | Long tasks before control: 86 → ≤ 20; cold ≈ the larger of download and loading; DL17 green | Opus | L |
| DL12 | **Native memory images**: the AssemblyScript modules' post-init state (`native.foundation`, `native.inputs`) written at build as a memory image and loaded directly | 2.8 s → ≤ 0.3 s at 10×; native tests and journeys pass | Opus | M |
| DL13 | **Read once**: product reads (`firstPartyRead`, `products.ts`, `product.ts`) answered from the parts' member views; the 761 cache re-reads and per-blob checks go (BP3); one Cache Storage put per part (BP4 delta updates after) | 0 Cache Storage reads of level members after the download **11-03:** its first slice (re-reads answered from part members on the first visit) moved into DL5; this row keeps the rest | Opus | M |
| DL14 | **Few JS chunks before control** (BP5; target ruled 11-03, G872): title (1) + core (≤ 2, every home, split at the session boundary) + one chunk per shard + one late bank; every check-chunks guard kept (no shared shard chunks, no shard code in session, title closure ≤ 350 KB) | Driftwood grid/phone ≈ 10-12 JS requests before control (from 104), a client entry ≈ 5; Application modules 3.5 s → ≤ 1.5 s at 10×; title first paint no later; the build's chunk checks, a boot smoke on every shard and the grid, and DL17 green **Findings 11-03 (sp-o3, built tree `5fcb0ac`):** Driftwood grid/phone loads 104 JS files (8.44 MB raw, 2.66 MB wire) before control: 30 `control` banks, 30 `shard` banks (six shards), 24 `late`, plus title, entry and a dozen singletons. All public phone entries together need 115 files (8.63 MB), so one shared core costs Driftwood grid only +0.19 MB raw, client up to +1.45 MB raw (≈ +0.45 MB wire), parsed but not run (wrapped modules run on import). **Three chunks collide with standing guards** (`scripts/check-chunks.mjs`): shard owners never share a chunk (E357 L7: B69's and L7's grouping attempts broke boot on every shard), the session closure carries no shard code, and the title closure stays under its 350 KB ceiling. The grid entry loads six shards before control, so its floor is one chunk per shard. **Proposed:** title (1), core (startup + session + control code, all homes, ≤ 2 by size), one chunk per shard, and one boot-late bank, so Driftwood grid ≈ 10-12 JS requests (from 104) and a client entry ≈ 5; the guards stay. Needs a ruling before code: is 'one chunk per shard' acceptable as DL14's target? **Closed 11-03 (G872), measured: requests don't bind on the phone link; no byte trade.** The ruled cut (`e0fb9c3fef`) took Driftwood grid from 104 to 44 JS requests before control, booted 10/10 (every shard and the grid), but added 0.58-0.93 MB on the wire per entry, and on a warm visit Application modules went 2.87 → 4.02 s (long tasks 7.96 → 8.44 s; tap → control 29.1 → 31.4 s) against its parent `d62b169a2c` (one run each, phone preset). Fixed forward to byte-exact banks in `3b52c5b2ca`; any coarser bank must add no bytes and win CPU | Opus | M |
| DL15 | **Brotli 11** on parts if one preview deploy shows Vercel serving `.br` with `Content-Encoding: br` intact (BP6 / DS5); otherwise closed as measured | −3.6 MB on Driftwood, or a measured "no" | Opus | S |
| DL16 | **Every shard and the grid**: the runtime build covers every shardfile and open plot; Debug row `Loading: runtime packs / shardfile` (default off until a phone reading, then on and the row deleted, E451) | Bars met on the phone preset; Simulator reading; goldens green on every shard | Opus | M |
| DL17 | **Complete-at-control gate**, built first and run on every row: at the control event, 0 pending or post-control requests for the level's content (`phone-loading` `postControl`), every model within boost range of spawn at its full LOD with full textures resident, 0 placeholder or far-proxy draws in reach; plus a recorded hoverboard boost lap from spawn with 0 pops on the Simulator | The gate fails today's build if it streams any level content after control, and passes before each DL row lands; the boost lap clip is in the row's commit **Added 11-03 (wildshard-new):** a whole-level memory reading before Debug > Level download flips to Runtime packs: the Simulator, Nine Dragon (113.6 MB raw whole level) and Pine Hollow (95.9 MB), Runtime packs on, against the 1.8 GB loading and 1.2 GB per-shard caps. Until it passes, the whole level ships only in the packs book (default off); the default Shardfile book keeps today's entry set | Opus | M |

| DL18 | **One handshake, then only what changed.** At boot the client makes one request: its build id plus a digest of the parts it already holds (a small index kept beside Cache Storage). The answer lists the parts to fetch (or "nothing"), and only those are fetched, in parallel on one HTTP/2 connection. No per-file revalidation, no 304s, no re-reads. Server side, first choice: the runtime build precomputes static delta files per previous build (`handshake/<from-build>-<to-build>.json`, CDN-cached, no server code), with the full part list as the fallback; an edge function only if delta files grow too many. **Protocol:** HTTP/2 (Vercel already serves h2/h3); WebSockets measured and rejected unless they win, because the whole exchange is one request and one response, a socket gets no CDN caching, and Vercel's static hosting does not serve sockets | Warm visit, same build: 1 request before the world loads, 0 re-reads; after a one-model deploy: the handshake plus 1 part; the decision on WebSockets recorded here with its number **Design 11-03 (sp-o3), built on DL5's parts:** the handshake is the spawn manifest itself. Its address is already inlined in `index.html` (the module bank), it is content-named and immutable, and it lists every part by sha256 (16-148 KB, median 40 KB on `5fcb0ac`). The client keeps a small held-parts index beside Cache Storage (part hash → complete), written when a part's last member is stored. At boot it reads the manifest (from the worker's cache on a warm visit, so no network), takes the parts the index lacks, and fetches only those, in parallel on one HTTP/2 connection. No per-file revalidation, no 304s, no member lookups. A warm visit on the same build makes 0 part requests; a one-model deploy costs the new manifest plus the one changed part. Precomputed `handshake/<from>-<to>.json` files would only replace the manifest's own 40 KB, so they are dropped: no server code, nothing per build pair. **WebSockets rejected:** the exchange is one cacheable request and one response; a socket gets no CDN cache, and Vercel's static hosting serves none. Built in DL5's reader (`spawnDownload.ts`) | Opus | M |
| DL19 | **Phone-speed loading leftovers, folded in** (Jake, ~18:38: *"anything else in phone speed loading, you can fold into this"*): D210 Home region warm 12.3 → 24.8 s after PL15 / PL17 (19.9 s today); D208 product admission +6.2 s cold; D209 Region world +2.6 s cold; D199 the 8.8 s frozen frame in "Sky · lighting" on Jake's phone; PL13's +2.9 s warm from the title prefetch; PL1 / PL3 / PL13 "landed, partial". Each is fixed by its DL row (named in the fix commit) or closed as measured, and leaves BURN-DAMAGE-LIST | Every item has a fix commit or a measured close; D199, D208–D210 are marked closed in the damage list | Opus | M |
| DL20 | **Retire the loose copies** that DL5 keeps beside its parts as the 404 fallback (added 11-03, wildshard-new: the +374 MB must not stay doubled) | The reader's loose fallback is shown unused over a week of live boots (no fallback fetch in the telemetry), then the loose spawn-set copies leave the deploy; one deploy measured smaller | Opus | S |

**The phone link is byte-bound (11-03, sp-o2's DL5 run, `phone` preset):** Runtime packs cut requests before control from 1,242 to 277 (grid 1,298 to 422), but tap → control stayed at 25.3 s against 25.5 s: about 31 MB at 1.25 MB/s. Request counts do not move control on this link; bytes do. The rows that move it are the byte rows (DL15 Brotli, DL9 textures, DL6 quantized buffers) and not fetching what control does not need. Any row that trades bytes for fewer requests (DL14's first cut, e0fb9c3fef: +0.58 to +0.93 MB on the wire for 104 → 44 JS requests) needs a CPU win that pays for it.

Today's build also loads some things after control on purpose (PL16's distant coverage, the ring speculation of PL10).
DL17 lists them; each one either loads before control or is shown to be out of reach at boost speed.

**DL17's reds (11-03, the hardened gate on `d525bf2f86`, `phone` link, worker on; each is a row's target, never a gate
exception):**
- **Texture swap after control (DL9, DL16; sp-x6's DL9 find):** Auto fixes a page's texture mode at boot, so a cold
  Driftwood (shard and grid) draws images at control while its KTX2 set downloads after it, and the next visit draws
  KTX2. A warm visit 180 s later still drew images (the set was not yet marked cached).
- **Level requests after control (DL1, DL5):** Driftwood 167 (165 by the worker: `basis_transcoder`, other shards'
  boot JSON, the KTX2 set), grid 343–551; 2 Driftwood piano audio pack parts still open at control (DL5).
- **Grid streaming at control (DL11, PL10/PL16):** 8 rings in flight, Far Reach `loading`, ~3,050 Cache Storage reads of
  `grid-road` bins after control, Driftwood switching to its far proxy and Far Reach to `near` during the lap.
- **Pops within reach on the lap:** Driftwood's `ground-cover-*-far` instances shown on approach (10–22 meshes).

**Order:** DL17 and DL0 first (the gate and the measurement), then DL1–DL3 (small, independent). DL4 next, then DL5
(the format everything else writes into) with DL18 (the handshake that serves it). DL6–DL13 and DL19 run in parallel
on top of DL5. DL14 and DL15 any time. DL16 closes.

**Lanes (Jake, ~18:40, G1001): an Opus 5.5 plan, every row.** *"I think this is definitely an Opus 5.5 plan. I don't trust Codex on this plan. It's too fucking hard. Codex 6.1 can review and assist."* Every DL row is built and landed by an Opus lane. Codex lanes review Opus commits, write tests and run measurements (phone-loading, download-bench, goldens runs) when asked, and land nothing of this plan themselves. The Opus ladder (G853) sets the pace. Jake's CI ask and Nine's QA rows (qa 11-03) come first; this plan takes idle Opus lanes, never a lane off those.

**Out of scope:** streaming level content during play, in any form (Jake, above); the shardfile format itself (G934
keeps it); one-world crossings (G828, Jake's plan).
