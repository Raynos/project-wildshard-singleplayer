# Download and load: a runtime build from the shardfile (mini plan)

**State:** `open` 2026-11-03 18:45 Cancun, written by wildshard-v; Jake said *"build it"*, handed to wildshard-new
(G1000). Ask E525. Builds on the two spikes, [download-speed-mini-spike.md](../download-speed-mini-spike.md) and
[bulk-download-mini-spike.md](../bulk-download-mini-spike.md); Jake's brief:
[Download Speed Plan](https://claude.ai/artifact/24CcAJ4uMT32DFt4sVj83e).

Jake, 2026-11-03 ~18:30: *"A shard file is not what the engine needs, right? A shard file is a output format. It's a
machine and human readable output format for generating these levels and these shards. The actual freaking engine, when
it comes to downloading, loading, running, executing, we can have a full static build pipeline that converts a shard
file into something that is really fucking good, efficient, useful, fast, baked, pre-baked, for the game to download,
execute, run, etc. I think we have completely missed a step. … There's all kinds of optimizations that can be done
outside of the JavaScript main thread of the actual game running in the browser, and that needs to go into the plan."*

Jake, ~18:40: *"Yes, build it, but be very, very fucking careful with start playing the level before you finish
downloading it. You're going to turn a download problem into a loading problem. … Every attempt that the agents have
made of streaming content in-game over the last 5 weeks have like basically been a shitty experience … texture popping,
texture loading, walking around and seeing a bunch of placeholder or far view assets before the real high fidelity stuff
comes in … especially when you hit the hoverboard, especially when you hit boost. So we're just looking at pure
downloading and loading optimizations that can be done to make the game start faster. We're not looking at playing the
game before it's ready … I don't want to leave it up to fucking luck."*

Jake, ~18:50: *"I don't want the game fucking rereading stuff. It already has. It should just do a fucking handshake …
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
| DL0 | **Measure the truth.** `phone-loading` throttles the service worker on the page's own link (today it gets a second 10 Mb/s, so the 24 MB precache never shows); the daily runs against `--rev` and adds `download-bench spawn` (DS6) | A cold run shows the worker's requests and bytes in its totals; the hourly check-in's daily line updated | Codex | S |
| DL1 | **Nothing competes with the level's download** (BP1): the worker registers at boot as now, but its offline precache of *other* files (other shards, the unused `grid-strip-mesh` bins) waits until after control; hashed `/assets/*` `immutable` in `vercel.json`. Everything the level needs is still in the level's own download | Cold phone-loading (DL0) −15 s or more; warm second visit no slower (watch 039d's uncontrolled-document trap); DL17 green | Codex | S |
| DL2 | **Start the level's download on the title screen for first visits** (DS3), not only for a saved last shard | Download starts at the title on a fresh profile; −3 s at a 3 s dwell | Codex | S |
| DL3 | **Trace the +1.9 MB `grid-strip-mesh` bin** that entered the set after `8bdf53f` (DS7) | Its owner commit named; dropped if the level never reads it, kept if it does | Codex | S |
| DL4 | **Inventory, then sort**: every boot step in the table above (and the cold run) marked *build*, *worker* or *main thread*, with its inputs and measured ms; nothing stays *main thread* without a reason (GPU upload, DOM, input) | One table in this file; the rows below re-sized from it | Opus | S |
| DL5 | **The runtime build and its pack format.** `scripts/runtime-build/` reads each built shardfile and writes, per shard × tier × entry, **the whole level** in ≤ 12 MB parts (extend I5's `blobs/pack`: 16-byte aligned members, offset table in the module bank; BP2). Validation (sha256, admission, schema, ceilings) happens here, once; the runtime trusts the part hash | Driftwood grid/phone: ≤ 10 requests to control, same content as today; pack build ≤ 30 s in CI; loose-URL fallback on a 404 | Codex | L |
| DL6 | **GPU-ready geometry**: the build writes final interleaved, quantized vertex and index buffers in the engine's attribute layout, grouped by material family (feeds EP6 / EP8's baked batches), so loading is view → `bufferData` with no GLB parse and no scene-library intake | Scene-library intake and its owned cascades (7.8 s) → ≤ 1 s at 10×; goldens green on all shards + WebKit | Opus | L |
| DL7 | **Pre-resolved world**: placements, instance matrices, LOD tables, cull cells, bounds, the compiled grid page and the road as flat typed arrays; `world.world.scenes` and assembly become reads | `world.world.scenes` + assembly + compiled page (11.4 s) → ≤ 2 s at 10×; goldens green | Opus | L |
| DL8 | **Pre-joined physics**: colliders per cell joined at build (heightfields, trimeshes, compounds) in Rapier's input form; try Rapier world snapshots | `collider-join` (1.2 s) → ≤ 0.1 s; physics walk 0 stuck | Codex | M |
| DL9 | **Textures per tier**: measure shipping the phone tier's KTX2 already transcoded to ASTC against Basis transcoding in a worker; keep whichever loads faster at equal or better memory and the same look | A measured verdict in this file; the winner lands; goldens green | Opus | M |
| DL10 | **Shaders compiled while the bytes arrive**: the build writes each entry's program variant list (with NF13–NF18's GLSL); the loader compiles them with `KHR_parallel_shader_compile` behind the loading screen during the download, not after the world | Shader + program-link steps (3.6 s) mostly hidden under the download; first world frame has 0 new programs | Opus | M |
| DL11 | **Loading in workers, overlapped with the download** (the loader half of DS4 only): decompress, parse and physics build run in workers as each part arrives, behind the loading screen; the main thread only uploads and adds to the scene. Control still waits for the last part and the last build | Long tasks before control: 86 → ≤ 20; cold ≈ the larger of download and loading; DL17 green | Codex | L |
| DL12 | **Native memory images**: the AssemblyScript modules' post-init state (`native.foundation`, `native.inputs`) written at build as a memory image and loaded directly | 2.8 s → ≤ 0.3 s at 10×; native tests and journeys pass | Codex | M |
| DL13 | **Read once**: product reads (`firstPartyRead`, `products.ts`, `product.ts`) answered from the parts' member views; the 761 cache re-reads and per-blob checks go (BP3); one Cache Storage put per part (BP4 delta updates after) | 0 Cache Storage reads of level members after the download | Codex | M |
| DL14 | **Three JS chunks before control** (BP5): title, game, after control | Application modules 3.5 s → ≤ 1.5 s at 10×; title first paint no later | Codex | M |
| DL15 | **Brotli 11** on parts if one preview deploy shows Vercel serving `.br` with `Content-Encoding: br` intact (BP6 / DS5); otherwise closed as measured | −3.6 MB on Driftwood, or a measured "no" | Codex | S |
| DL16 | **Every shard and the grid**: the runtime build covers every shardfile and open plot; Debug row `Loading: runtime packs / shardfile` (default off until a phone reading, then on and the row deleted, E451) | Bars met on the phone preset; Simulator reading; goldens green on every shard | Opus | M |
| DL17 | **Complete-at-control gate**, built first and run on every row: at the control event, 0 pending or post-control requests for the level's content (`phone-loading` `postControl`), every model within boost range of spawn at its full LOD with full textures resident, 0 placeholder or far-proxy draws in reach; plus a recorded hoverboard boost lap from spawn with 0 pops on the Simulator | The gate fails today's build if it streams any level content after control, and passes before each DL row lands; the boost lap clip is in the row's commit | Opus | M |

| DL18 | **One handshake, then only what changed.** At boot the client makes one request: its build id plus a digest of the parts it already holds (a small index kept beside Cache Storage). The answer lists the parts to fetch (or "nothing"), and only those are fetched, in parallel on one HTTP/2 connection. No per-file revalidation, no 304s, no re-reads. Server side, first choice: the runtime build precomputes static delta files per previous build (`handshake/<from-build>-<to-build>.json`, CDN-cached, no server code), with the full part list as the fallback; an edge function only if delta files grow too many. **Protocol:** HTTP/2 (Vercel already serves h2/h3); WebSockets measured and rejected unless they win, because the whole exchange is one request and one response, a socket gets no CDN caching, and Vercel's static hosting does not serve sockets | Warm visit, same build: 1 request before the world loads, 0 re-reads; after a one-model deploy: the handshake plus 1 part; the decision on WebSockets recorded here with its number | Codex | M |
| DL19 | **Phone-speed loading leftovers, folded in** (Jake, ~18:50: *"anything else in phone speed loading, you can fold into this"*): D210 Home region warm 12.3 → 24.8 s after PL15 / PL17 (19.9 s today); D208 product admission +6.2 s cold; D209 Region world +2.6 s cold; D199 the 8.8 s frozen frame in "Sky · lighting" on Jake's phone; PL13's +2.9 s warm from the title prefetch; PL1 / PL3 / PL13 "landed, partial". Each is fixed by its DL row (named in the fix commit) or closed as measured, and leaves BURN-DAMAGE-LIST | Every item has a fix commit or a measured close; D199, D208–D210 are marked closed in the damage list | Codex | M |

Today's build also loads some things after control on purpose (PL16's distant coverage, the ring speculation of PL10).
DL17 lists them; each one either loads before control or is shown to be out of reach at boost speed.

**Order:** DL17 and DL0 first (the gate and the measurement), then DL1–DL3 (small, independent). DL4 next, then DL5
(the format everything else writes into) with DL18 (the handshake that serves it). DL6–DL13 and DL19 run in parallel
on top of DL5. DL14 and DL15 any time. DL16 closes.

**Lanes:** rows that change what is drawn or checked by eye (DL4, DL6, DL7, DL9, DL10, DL16, DL17) are Opus (G848);
the rest are Codex. Jake's CI ask and Nine's QA rows (qa 11-03) come first; this plan takes idle lanes, never a lane
off those.

**Out of scope:** streaming level content during play, in any form (Jake, above); the shardfile format itself (G934
keeps it); one-world crossings (G828, Jake's plan).
