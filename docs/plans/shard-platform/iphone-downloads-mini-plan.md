# iPhone downloads: fetch less, in fewer requests, in the right order (E504)

**State:** `in flight` 2026-10-27 — started by G767. I4 ships B (G786). I2 and I11 stay their own rows (G791).
I12 is a build-time ceiling only, on declared bytes and chunk gzip size, with no boot-smoke request counting (G792).
A row whose bar needs a phone or Simulator reading is done on a Chromium reading (G777). Was: `draft` 2026-10-24,
for Jake to read; not sent to the builder. A read-only audit by the plan agent's
subagent (static reads of the served `0318afba11` build, prod HEAD requests, one muted iPhone 16 Pro browser lane on
live `0b1ca136e`). Nothing is built until Jake rules on it.

Jake, 2026-10-24 ~22:50 Cancun (E504): *"Build a mini plan to optimize downloading for iPhone."*

Owned elsewhere and only referenced here: L18, H3, U1–U4, L10 ([loading-speed](loading-speed-mini-plan.md),
[loading](loading-mini-plan.md)), J1–J10 ([js-payload](js-payload-mini-plan.md), G727–G730), T3/T4/T8
([tile-streaming](tile-streaming-mini-plan.md)), the G412 allowances ([download-diet](download-diet.md)).

## How it was measured

- **Bytes on disk:** every product file in the served `0318afba11` build (`tmp/serve/…-4404/dist/shardfiles`),
  classified by magic bytes (KTX2 codec and mips, GLB extensions), gzip-6 and brotli-5 per file in Node.
- **Wire:** `curl -sI -H 'Accept-Encoding: br, gzip'` on live, plus one GET of the 14.61 MB hibiscus GLB.
- **Cold entries:** Playwright, iPhone 16 Pro context, service worker blocked, unthrottled desktop network, live
  `0b1ca136e`. **Context-level** request accounting: the page's CDP Network domain alone misses the content-cache
  worker's product fetches (390 of 1,021 requests), so any guard must count worker requests too.

## Findings

### 1. What a cold entry downloads today (live, Chromium as iPhone 16 Pro, no service worker)

| Entry | Requests | Wire MB | Body MB | Before control | Control |
|---|---:|---:|---:|---|---:|
| Title | 74 | 1.36 | 2.55 | 65 req / 0.57 MB | 0.8 s |
| Driftwood shardfile (public default) | **1,021** | **52.6** | ~136 | **1,019 req / 52.3 MB** | **50.9 s** (51.7 s rerun) |
| Driftwood LEGACY (Jake's phone, 10-24) | 431 | — | 12.7 | — | — |
| Driftwood shardfile (Jake's phone, 10-24) | 957 | — | 123.9 | — | product admission 7.9 s |

Jake's 123.9 MB is body bytes; on the wire it is about 52.6 MB because Vercel brotlis GLB / BIN / JSON / wasm. Almost
nothing waits until after control: 1,019 of 1,021 requests finish before the player can move.

Driftwood shardfile entry by kind (wire): GLB 242 req / 27.4 MB · BIN + tile 38 / 8.1 MB · images 36 / 6.5 MB ·
audio 91 / 3.6 MB · JS 480 / 2.95 MB · wasm 8 / 1.6 MB (Rapier 1.1 MB) · KTX2 1 / 1.3 MB · shardfile JSON 118 /
0.9 MB. Of these, the product (`/shardfiles/driftwood-isle/…`) is 390 req / 37.7 MB; the other 15.7 MB is page
assets, including legacy-path files (`/assets/models/driftwood-blender/island.glb` 0.89 MB, `placements.bin`
0.59 MB, `baked/ocean-….glb` 0.50 MB) and Explorer compare JPEGs (`driftwood-overlook-target` 0.68 MB,
`driftwood-right-target` 0.49 MB).

### 2. What is in the big products (served build, all tiers)

| Product | Files | Raw MB | gzip-6 MB | brotli-5 MB | Biggest wire share |
|---|---:|---:|---:|---:|---|
| Driftwood | 323 | 107.3 | 38.8 | 35.1 | raw-float GLB 205 files 86.1 MB raw → 21.6 br |
| Pine Hollow | 828 | 112.4 | 73.0 | 70.8 | **KTX2 UASTC+zstd 42 files 31.4 MB** (incompressible); meshopt GLB 19.6 MB → 11.3 |
| Nine Dragon | 595 | 210.2 | 43.2 | 37.7 | raw GLB 417 files **186.5 MB raw** → 25.0 br |
| Nalati | 231 | 53.7 | 34.5 | 33.7 | pre-zlibbed data 17.7 MB (incompressible again) |
| Night Market | 151 | 28.9 | 6.6 | 5.1 | raw GLB 26.6 → 3.1 |
| **All 24 products** | **4,875** | **605** | 241 | **224** | what G554's grid prefetch tries to store |

Driftwood by need (raw / br MB): desktop-tier files 27.0 / 8.0 · Explorer specimens 3.1 / 1.4 · UI compare images
2.7 / 2.7 · headless sim 1.0 / 0.1 · critical 0.7 / 0.3 · foliage, rocks, protos, cover 34.2 / 11.5 · 93 unnamed
`blobs/glb` 22.0 / 5.1 (owner not attributable from the index) · other world 16.6 / 6.0. **The phone needs about
73 MB raw / 23 MB br of the 107 / 35**; 164 of its 323 files are under 16 KB (1.0 MB together), 212 under 64 KB.

Formats: Driftwood ships **205 raw float GLBs and 33 lossless meshopt GLBs, none quantised** (the 10-16 sweep chose
per file by gzip size and kept bit-exact attributes); Pine's textures are **UASTC (42) and ETC1S (8)**; Nine uses
uncompressed-format KTX2 (vk 9 / 16 / 43 + zstd). Audio is AAC mono at 64–87 kbps (already lean); music is fetched and
decoded whole. The descriptor `shard.json` is 911 KB raw / 64 KB wire per entry, at a fixed path.

### 3. Wire and caching

| Check | Result |
|---|---|
| Compression | **Brotli is served** for GLB, BIN, WTT, JSON and wasm (hibiscus 14.61 MB → 3.96 MB). KTX2, JPEG, WebP, m4a go uncompressed (correct: already compressed). Not a lever. |
| Protocol | HTTP/2 only (no `alt-svc`, so no HTTP/3 / QUIC, which would help lossy hotel wifi and cellular hand-offs). |
| Shardfile blob caching | **Every product blob is `max-age=0, must-revalidate`.** `vercel.json`'s immutable rule matches `/shardfiles/<slug>/<hash>`, but the files live at `/shardfiles/<slug>/blobs/<kind>/<hash>.<ext>`. Anything the content cache does not hold (eviction, a failed write, a worker restart, a second tab) costs a 304 round trip per file instead of 0. |
| JS caching | Hashed `/assets/*.js` revalidate (`max-age=0`), J9 owns it. |
| Unhashed immutable | `/assets/physics/rapier.wasm` is immutable for a year under a fixed name: a Rapier upgrade would serve stale wasm to returning phones (correctness, not bytes). |
| Edge cache | Many blobs answer `x-vercel-cache: MISS` (cold edge region): first-byte latency on the first player of a deploy. |
| Parallelism | 16 product reads in flight (`product.ts` ~308) over one H2 connection; ~1,000 requests at a cellular ~80 ms RTT is about 5 s of round trips even with perfect pipelining. |
| Priorities | No `fetchpriority` and no critical-first ordering in product admission beyond authored order; all 323 files are declared before the first is used. |

### 4. iPhone specifics

- **No Network Information API on iOS Safari.** `grid/prefetch.ts` stops on `saveData`, which iOS never reports, so
  G554's background prefetch of every cell (up to ~224 MB br of all-tier files, bounded only by quota) runs on
  cellular too. The game cannot tell cellular from wifi on the iPhone; any cellular policy has to be a setting or
  a size cap.
- **Storage:** a home-screen web app is exempt from WebKit's 7-day script-writable storage cap and gets a large origin
  quota, but Cache Storage can still be evicted under device storage pressure unless `navigator.storage.persist()`
  is granted. Today only the grid prefetch (`prefetchQuota.ts`) asks; a plain shard entry never does.
- **Memory while downloading:** each product file is copied into an owned `Uint8Array` and hashed in a worker; GLBs
  parse on the page through one parser. Whole-file buffers are fine at today's ≤ 15 MB files; quantised geometry
  (row I3) also cuts decoded and GPU bytes (16-bit positions, 8-bit normals and colours), so it helps the 1.2 GB
  ceiling as well as the wire.
- **Low Power Mode / thermal:** decode and hashing compete with the 30 fps cap; fewer, larger, already-compressed
  files lower the per-file CPU (request bookkeeping, hashing setup, cache writes).
- **Second visit:** product blobs are content-addressed, so an unchanged blob keeps its URL across deploys and the
  content cache serves it with no request. What re-downloads after a deploy is JS (changed hashes, the worker's
  warm list: J6 / U2), `shard.json` and the fixed-path sections (revalidated each entry).

## Rows

Biggest saving first. Estimates are for the cold Driftwood shardfile entry on the phone tier unless stated
(today 1,021 requests, 52.6 MB wire, control 50.9 s on Chromium unthrottled). Every row lands in small commits with
the numbers in the message (G506).

| Row | What | Saves (MB / s on iPhone, est.) | Owner | Effort | Done when |
|---|---|---|---|---|---|
| **I1 = L18 — done at HEAD** (loading-speed owns; tier filter in flight in the working tree, `tierProductFilesPaced`) | Phone-tier filter before declare / fetch; Explorer specimens, UI compare images and the headless sim on demand (G729 progress) | −12 MB wire (product 37.7 → ~25.5), −70 requests | Codex | S (in flight) | phone Driftwood fetches no `desktop`, `specimen`, `ui/images` or `sim/` file; product ≤ 26 MB wire |
| **I2 = H3 + T3/T4** (loading-speed / tile-streaming own; stays its own row, G791) | Before control: critical files + spawn tiles + the ring; the rest streams after control at low priority, nearest first | before-control wire 52 → ≤ 12 MB; 20–35 s of a cold hotel-wifi entry | Opus (H3) | M | Simulator cold: ≤ 12 MB and ≤ 250 requests before control; no pop-in inside the spawn view |
| **I3** (= RM8.1: authored-world tiles done, sp-o1 850a6efb5f + 6e9a4660dd: Int16 grid positions, Int8 normals, Uint8 colours, meshopt; Night Market geometry 121 → 17.7 B/tri. Driftwood / Nine baked geometry in flight, reading at plan end (G780; 2026-10-27, sp-o2): `ecb80e410a` `compactPhoneGlb` (one-mesh identity files: 16-bit grid positions, Int8 normals, Uint8 colours, ± meshopt, smallest brotli ships) and the owned-geometry intake reads it back; `14c49bd1f4` phone rocks 770.7 → 489.5 KB br; the phone sea grid 364 → 173 KB br (`5bf1d08014`, in sp-o4's ocean bank) and the phone foliage batches 1.58 → 1.42 MB br (`03d206811a`: native files declare the new storage, `nativeWholeGeometry` reads the padded grid); Driftwood phone so far ≈ −0.64 MB br. Probe, cached products: Driftwood's named GLBs 14.56 → 8.14 MB br at best per file. Nine's bulk is its props tiles (the six biggest ~15.5 MB br, all `wholePartition` nodes): lossless meshopt makes float tiles bigger under brotli (12 files 2.85 → 2.99 MB) and files over ~12 MB hit the 25 MB aggregate buffer cap, so Nine's −10 to −15 MB needs grid-quantized whole parts, and their bytes are mostly Nine's facade float channels, not positions (six biggest tiles, raw: `_AFACE` 16.6, `_APAT` 16.6, `_AMISC` 16.1, `_ASPILL` 11.7, `_AOFF` 7.8, COLOR_0 12.7, NORMAL 11.7, POSITION 12.4 MB): landed: `46f7f5ec4a` + `19f9dce77a` (`nativeOnce`: a native channel written once, no float32 copy of a typed / half one), `210f87d040` + `19f9dce77a` (opt-in `compact` whole shapes: Int8 normals, Uint8 colours, one Int16 position grid per partitioned shape that `readWholeGeometry` dequantizes; only Nine opts in, so pinned producers keep their bytes, D68), `d5f31bea93` (every Nine kit's aFace / aPat half float). Nine product: GLBs raw 193.95 → 154.22 MB, phone wire 200.20 → 168.74 MB, brotli 30.36 → 29.11 MB; the decoded / GPU geometry falls with the raw bytes, the brotli wire little (these channels have few distinct values). Plan-end readings: the side-by-side look (G415) and the census GPU MB) | Quantised meshopt for baked geometry on the phone tier (SDK bake: `KHR_mesh_quantization` + meshopt filters: 16-bit positions, octahedral 8-bit normals, 8-bit colours), choosing per file by brotli size, not gzip | Driftwood −8 to −12 MB wire (raw GLB 21.6 MB br); Nine −10 to −15 MB; −30–50 % geometry decoded + GPU bytes | Opus (look must hold, G415) | M | phone Driftwood GLB wire ≤ 10 MB; DW / Nine look side by side "similar" (G415); physics walk 0 stuck; GPU MB down in the census |
| **I4** | Phone textures: Pine's 42 UASTC KTX2 (31.4 MB) re-encoded with UASTC RDO + zstd (or ETC1S for albedo per D2); phone tier drops the top mip of any > 1K texture; Nine's raw-format KTX2 to Basis | Pine −12 to −18 MB wire; GPU unchanged or lower | Opus | M | Pine phone KTX2 ≤ 15 MB wire; look holds on a variant sheet (taste rule) <br>**Status (2026-10-27, sp-o3): done (this commit) on the recommended option B (G769 builds picks on the recommendation; G738 allows the soft format for far textures).** Measured on the bfe854d build: the 31.4 MB counted desktop copies too. Phone UASTC is ~15.5 MB: 8 ground colour/normal layers shared with desktop at 1024² (10.7 MB), 16 phone creature maps at 512² (4.0 MB), phone birds atlas (0.78 MB). D2(b) does not hold on these textures. On the ground diffuse, UASTC RDO + zstd gives λ1 -0.1 % / 41.5 dB, λ2 + 64 KB dictionary -0.8 % / 39.5 dB, λ4 -10 % / 30.6 dB, quality 50 -18 % / 26.8 dB (today 41.6 dB). On the ground normal map, λ1-3 gives -0.5 % to +0.1 %. Nine's raw KTX2 are 5 zstd single-mip data rasters (1.37 MB), not worth a lossy Basis pass. Only D2(c) on a far texture reaches the target: the phone birds atlas as ETC1S q255 is 782 → 175 KB (-607 KB, 51.4 → 38.1 dB), so Pine phone KTX2 ≈ 14.9 MB. Board: art/pine-hollow/round-37-phone-birds-etc1s/board.jpg (A shipped, B ETC1S; B is softer on feather stripes). Shipped: bake-ktx2 FAR_GLBS encodes the phone birds GLB colour as ETC1S q255; the product blob is 175,468 B (was 781,566). Jake may still flip it back with the board. |
| **I5** done (sp-o5, 2026-10-27). **I5.1** done (`c04922e9a7`, stale-pack fix `cbe29231a5`): the index lists content-hashed packs (`blobs/pack/<hash>.pack`, ≤ 4 MB) of every section and schema, and apart, every file under 64 KB; members keep their own paths. **I5.2** done (`1d0107c11b`): page admission reads a cache-missing section or file from one read of its phase's pack (`packReads.ts`), packed members complete in download accounting; lazy late reads keep their own files. **I5.3** done (`f04f84d87a`): the grid prefetch keeps a pack's missing members from one read of the pack. **I5.4** done: a cold phone-tier Driftwood entry on a preview of `f04f84d87a` makes **102 product requests** (372 before; 2 pack reads replace the sections and small files), page assets 15.35 MB | Fewer requests: pack each product's sections, schemas and every file < 64 KB into one or two content-hashed pack blobs (entries keep their hashes and are verified inside); the descriptor lists pack ranges | −600 requests (Driftwood 212 small files + 118 JSON); ~3–5 s of round trips on cellular | Codex | M | cold Driftwood product ≤ 120 requests; warm entry unchanged |
| **I6** in flight (reading at plan end, G780) (sp-o5, this commit: `/shardfiles/*/blobs/**` immutable; Rapier keeps its fixed name, which the boot lists prefetch, and revalidates instead of a hashed URL that would fetch it twice; sections keep fixed paths and revalidate until I5 packs them; `test/vercel-cache-headers.test.ts` fails on the old regex) | Cache headers: immutable for `/shardfiles/*/blobs/**` (fix the `vercel.json` regex) and for the hashed sections; a content hash in Rapier's URL; preview header test pins both | 0 MB cold; up to ~390 revalidations (~2–4 s on cellular) whenever the content cache misses | Codex | S | `curl -sI` on a live blob shows `immutable`; the preview header test fails on the old regex |
| **I7 = L10 + new** (loading owns L10). **In flight (reading at plan end), sp-o4 2026-10-27, this commit:** a profile names its `controlFiles` (the boot slots' stems, no stings, and the spawn bed); on the phone the bar reads and decodes only those, and `startLateAudio` downloads the rest of the boot set after control and decodes the whole set one file at a time (the banks keep the playing slots). Slots without layers already stream through `AacTrack` (no whole-file decode where native AAC decodes); the media-element player is not needed for that. Legacy profiles keep reading everything | Audio: only the first music track and the spawn SFX set before control; music plays through a streaming media element (no whole-file decode); the rest after control | −3.3 MB and −85 requests before control; ~10 MB decoded PCM per minute of music off the heap | Codex | S–M | ≤ 6 audio requests before control; music starts within 0.5 s of the reveal |
| **I8** in flight (reading at plan end, G780) (sp-o5, 2026-10-27). **I8.1** census done: a phone-tier Driftwood entry at `2fec61f12a` fetches 648 page requests / 18.8 MB outside the product; the compare JPEGs are already gone (J3); the "legacy-path" files are the live spawn cove (`island.glb`, `placements.bin`, lightmaps, island plans) and the sea (ocean grid + floor), ~4 MB on the phone, so they move into the product (cached, tier-selected, prefetched), not out of the entry. **I8.2** done (this commit): tier selection keeps only the page tier's files of `world.water` and `world.baked` rows. **I8.3** done (this commit): the sea (ocean grid per tier + floor, 1.56 + 3.32 + 0.52 MB) is product files through `prepareOutput` (`productPageFiles.ts`, exact public bytes, no file under src); the phone admits only its grid (I8.2). **I8.4** done: the format admits normalized Int16 positions (I8.4a, the previous commit); the spawn cove's tiles (`island.glb`, 1.22 MB) and its four lightmaps are product files and leave the boot late reads (this commit). **I8.5** done (this commit): the cove's `placements.bin` (0.67 MB) and its per-tier plans are product files, the plans compiled by the page-file hook from the table and `island.json` (byte-identical to the published plans); the entry reads no `driftwood-blender` page file. HEAD preview of 24a9d73e7d: page assets outside the product 18.8 -> 15.35 MB before this slice | Page assets outside the product in a shardfile entry: drop legacy-path GLB / BIN reads (`driftwood-blender/island.glb`, `placements.bin`, the old ocean GLB) and Explorer compare JPEGs from the entry (J3 lazy-loads their code) | −3 to −6 MB wire, −30 requests | Codex | S | Driftwood shardfile entry fetches no `/assets/models/driftwood-blender/*` and no `*-target-*.jpg` |
| **I9** in flight (reading at plan end, G780) (sp-o5, this commit: on the phone tier the menu and in-play grid prefetch read only the home cell and its ring (`prefetchRing`), and of those only the phone-tier files (`tierProductFilesPaced`, lazily loaded; sections through the content cache); desktop keeps the whole set. The download-everything button that fetches the rest is js-payload J6.1, G727) | Grid prefetch on the phone: prefetch only phone-tier files (I1's filter) of the home and its ring cells; everything else waits for G727's "Download everything" button, which shows the size first | up to ~200 MB of background cellular data per fresh install | Codex | S | a fresh phone-tier menu idle stores ≤ the home + ring phone sets; the button lists its MB and downloads the rest with progress |
| **I10** in flight (reading at plan end, G780) (sp-o5, this commit: product admission asks once a page right after it stores a whole product in the content cache, beside the home-screen boot ask (E422); `storage.persisted` feeds the Debug storage line; `test/output-descriptor.test.ts` pins one ask and none without a cache) | Ask `navigator.storage.persist()` after the first successful product admission (not only in grid prefetch); show the result in Settings ▸ Debug's storage line (exists) | protects ~25–60 MB per shard from eviction (a re-download on the next cold launch) | Codex | S | first entry on a fresh profile requests persistence once; the storage line shows it |
| **I11 = U1/U2 + J6** (loading-speed / js-payload own; stays its own row, G791) | After a deploy that does not touch Driftwood, the next entry re-downloads only changed JS and the descriptor | measured by U1 | Codex | — | next-entry wire after an unrelated deploy ≤ 1 MB |
| **I12** (guard; build-time ceilings only, G792). **In flight (reading at plan end), sp-o4 2026-10-27, this commit:** `scripts/build-shardfiles.mjs` ends with `scripts/phone-wire.mjs`: each built product's declared phone wire (`tierProductWire`: the phone selection's compressed files + required commons, what admission reserves) against `wire/<product>/phone` in `lint/ratchet.json`, set at the 00:47 products + 1 % (Driftwood 71.4 MB, Pine 91.7, Nalati 89.4, Nine 209.7, Far Reach 33.8); 1.4 s for all 24 products inside the existing build step; a product with no row is reported, not refused | Per-entry phone download ceilings refused at build time on declared bytes (G792): ceilings in `lint/ratchet.json` beside J10's JS chunk-gzip ceilings, ratcheted down after each row; the build refuses a phone-tier product whose declared wire grows past its ceiling. Dropped by G792: boot-smoke request counting per entry | holds every saving | Codex | S | a commit that adds a desktop file to the phone set, or grows any entry's declared bytes past its ceiling, is refused at build time |

**Expected after I1–I8:** cold Driftwood shardfile entry ~18–22 MB wire total, ≤ 12 MB / ≤ 250 requests before
control (from 52.6 MB / 1,019), control inside loading-speed's 15 s cold budget on the Simulator. Pine ~45 MB lower
with I4 + I1. I1 and I2 are the two that move control time; I3 and I4 are the two that shrink the whole download.

Order: I6 and I10 first (S, no look risk); I1 is in flight; I12 lands its first ceilings with I1; then I5, I7, I8,
I9 (Codex) beside I3, I4 (Opus); I2 follows H3 / T4.

## Decisions for Jake (option 1 is Skip when asked)

| # | Question | Recommended |
|---|---|---|
| D1 | **Geometry precision on the phone.** Quantise baked geometry (positions to ~1 mm, normals and colours to 8 bit; invisible at phone scale but not bit-exact), or keep today's lossless floats? | **Quantise on the phone tier**, desktop stays lossless: ~10 MB less per big shard and less GPU memory; one Debug A/B until you've seen it |
| D2 | **Phone texture codec.** (a) UASTC as today; (b) **UASTC with RDO + zstd** (near-identical, ~40 % smaller); (c) ETC1S for albedo (5× smaller, visibly softer) | **(b)**, with (c) only for far / impostor textures |
| D3 | **Cellular.** iOS cannot tell the game it is on cellular. Background-download the whole Infinite Wildshard (~224 MB today), or only the home and its ring and leave the rest to "Download everything"? | **Home + ring only**; "Download everything" shows its size and fetches the rest when you choose |
| D4 | **Music.** Stream music from a media element (starts at once, little memory, a short gap on a very bad network), or keep downloading and decoding whole tracks before play? | **Stream music**; SFX stay preloaded |
