# iPhone downloads: fetch less, in fewer requests, in the right order (E504)

**State:** `in flight` 2026-10-27 — plan-end Chromium reading complete (sp-x6): I5/I6/I8/I11/I12 pass; I1/I2/I9/I10 remain open; I3/I4 look/GPU and I7 audio bars are not qualified by this network reading. Started by G767. I4 ships B (G786). I2 and I11 stay their own rows (G791).
I12 is a build-time ceiling only, on declared bytes and chunk gzip size, with no boot-smoke request counting (G792).
A row whose bar needs a phone or Simulator reading is done on a Chromium reading (G777). Was: `draft` 2026-10-24,
for Jake to read; not sent to the builder. A read-only audit by the plan agent's
subagent (static reads of the served `0318afba11` build, prod HEAD requests, one muted iPhone 16 Pro browser lane on
live `0b1ca136e`); the historical pre-build audit follows. The current plan-end reading is recorded below.

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
| **I1 = L18 — open after reading** (loading-speed owns; tier filter in flight in the working tree, `tierProductFilesPaced`) | Phone-tier filter before declare / fetch; Explorer specimens, UI compare images and the headless sim on demand (G729 progress) | −12 MB wire (product 37.7 → ~25.5), −70 requests | Codex | S (in flight) | phone Driftwood fetches no `desktop`, `specimen`, `ui/images` or `sim/` file; product ≤ 26 MB wire<br>**open (G780, sp-x6, 2026-10-27):** bc0c7cf54f phone Driftwood reads 60,181,116 encoded product-body bytes before control (>26 MB), including the declared sim/headless-assembly.json; D130. |
| **I2 = H3 + T3/T4** (loading-speed / tile-streaming own; stays its own row, G791) | Before control: critical files + spawn tiles + the ring; the rest streams after control at low priority, nearest first | before-control wire 52 → ≤ 12 MB; 20–35 s of a cold hotel-wifi entry | Opus (H3) | M | Simulator cold: ≤ 12 MB and ≤ 250 requests before control; no pop-in inside the spawn view<br>**open (G780, sp-x6, 2026-10-27):** 0/24 meet both limits; 22 reach control, Nalati/Nine remain incomplete beyond 180 s. Exact per-shard table below; D131. |
| **I3** (= RM8.1: authored-world tiles done, sp-o1 850a6efb5f + 6e9a4660dd: Int16 grid positions, Int8 normals, Uint8 colours, meshopt; Night Market geometry 121 → 17.7 B/tri. Driftwood / Nine baked geometry in flight, reading at plan end (G780; 2026-10-27, sp-o2): `ecb80e410a` `compactPhoneGlb` (one-mesh identity files: 16-bit grid positions, Int8 normals, Uint8 colours, ± meshopt, smallest brotli ships) and the owned-geometry intake reads it back; `14c49bd1f4` phone rocks 770.7 → 489.5 KB br; the phone sea grid 364 → 173 KB br (`5bf1d08014`, in sp-o4's ocean bank) and the phone foliage batches 1.58 → 1.42 MB br (`03d206811a`: native files declare the new storage, `nativeWholeGeometry` reads the padded grid); Driftwood phone so far ≈ −0.64 MB br. Probe, cached products: Driftwood's named GLBs 14.56 → 8.14 MB br at best per file. Nine's bulk is its props tiles (the six biggest ~15.5 MB br, all `wholePartition` nodes): lossless meshopt makes float tiles bigger under brotli (12 files 2.85 → 2.99 MB) and files over ~12 MB hit the 25 MB aggregate buffer cap, so Nine's −10 to −15 MB needs grid-quantized whole parts, and their bytes are mostly Nine's facade float channels, not positions (six biggest tiles, raw: `_AFACE` 16.6, `_APAT` 16.6, `_AMISC` 16.1, `_ASPILL` 11.7, `_AOFF` 7.8, COLOR_0 12.7, NORMAL 11.7, POSITION 12.4 MB): landed: `46f7f5ec4a` + `19f9dce77a` (`nativeOnce`: a native channel written once, no float32 copy of a typed / half one), `210f87d040` + `19f9dce77a` (opt-in `compact` whole shapes: Int8 normals, Uint8 colours, one Int16 position grid per partitioned shape that `readWholeGeometry` dequantizes; only Nine opts in, so pinned producers keep their bytes, D68), `d5f31bea93` (every Nine kit's aFace / aPat half float). Nine product: GLBs raw 193.95 → 154.22 MB, phone wire 200.20 → 168.74 MB, brotli 30.36 → 29.11 MB; the decoded / GPU geometry falls with the raw bytes, the brotli wire little (these channels have few distinct values). Nine whole-library pieces (`978526b2f7`: the 247 one-instance layout-set / specimen partitions on one Int16 grid per shape, readWholeGeometry dequantizing; shapes drawn through an object-space look (`objectSpaceLooks`) keep exact floats): Nine GLBs brotli 29.11 -> 26.50 MB, raw 154.22 -> 136.62 MB. The casts (`39de31c1ec`) went back to float in `2d0cabc1c6` (D102, row I3c). Plan-end readings: the side-by-side look (G415) and the census GPU MB) | Quantised meshopt for baked geometry on the phone tier (SDK bake: `KHR_mesh_quantization` + meshopt filters: 16-bit positions, octahedral 8-bit normals, 8-bit colours), choosing per file by brotli size, not gzip | Driftwood −8 to −12 MB wire (raw GLB 21.6 MB br); Nine −10 to −15 MB; −30–50 % geometry decoded + GPU bytes | Opus (look must hold, G415) | M | phone Driftwood GLB wire ≤ 10 MB; DW / Nine look side by side "similar" (G415); physics walk 0 stuck; GPU MB down in the census |
| **I3c** (sp-o2: `c877add154` + Red-fix `f2f8c38b9a`, in flight, reading at plan end; Nine GLBs brotli 26.50 -> 22.67 MB; the HEAD preview of f2f8c38b9a loads Nine to the spawn with no errors) | Nine casts back in the phone geometry format (Int16 grid positions, Int8 normals, Uint8 colours, ± meshopt): the world scenes' rest geometry pool decodes a grid-quantized cast (grid node, normalized channels) to identity-space Float32 before its checks, then `castsProgram.ts` compacts every shipped cast again | Nine −3.82 MB br (casts 5.41 -> 1.60 MB) | Opus | S | Nine loads in Chromium to the spawn; rest-pool test reads a compacted cast back within one grid step |
| **I4** | Phone textures: Pine's 42 UASTC KTX2 (31.4 MB) re-encoded with UASTC RDO + zstd (or ETC1S for albedo per D2); phone tier drops the top mip of any > 1K texture; Nine's raw-format KTX2 to Basis | Pine −12 to −18 MB wire; GPU unchanged or lower | Opus | M | Pine phone KTX2 ≤ 15 MB wire; look holds on a variant sheet (taste rule) <br>**Status (2026-10-27, sp-o3): done (this commit) on the recommended option B (G769 builds picks on the recommendation; G738 allows the soft format for far textures).** Measured on the bfe854d build: the 31.4 MB counted desktop copies too. Phone UASTC is ~15.5 MB: 8 ground colour/normal layers shared with desktop at 1024² (10.7 MB), 16 phone creature maps at 512² (4.0 MB), phone birds atlas (0.78 MB). D2(b) does not hold on these textures. On the ground diffuse, UASTC RDO + zstd gives λ1 -0.1 % / 41.5 dB, λ2 + 64 KB dictionary -0.8 % / 39.5 dB, λ4 -10 % / 30.6 dB, quality 50 -18 % / 26.8 dB (today 41.6 dB). On the ground normal map, λ1-3 gives -0.5 % to +0.1 %. Nine's raw KTX2 are 5 zstd single-mip data rasters (1.37 MB), not worth a lossy Basis pass. Only D2(c) on a far texture reaches the target: the phone birds atlas as ETC1S q255 is 782 → 175 KB (-607 KB, 51.4 → 38.1 dB), so Pine phone KTX2 ≈ 14.9 MB. Board: art/pine-hollow/round-37-phone-birds-etc1s/board.jpg (A shipped, B ETC1S; B is softer on feather stripes). Shipped: bake-ktx2 FAR_GLBS encodes the phone birds GLB colour as ETC1S q255; the product blob is 175,468 B (was 781,566). Jake may still flip it back with the board. |
| **I5** done (sp-o5, 2026-10-27). **I5.1** done (`c04922e9a7`, stale-pack fix `cbe29231a5`): the index lists content-hashed packs (`blobs/pack/<hash>.pack`, ≤ 4 MB) of every section and schema, and apart, every file under 64 KB; members keep their own paths. **I5.2** done (`1d0107c11b`): page admission reads a cache-missing section or file from one read of its phase's pack (`packReads.ts`), packed members complete in download accounting; lazy late reads keep their own files. **I5.3** done (`f04f84d87a`): the grid prefetch keeps a pack's missing members from one read of the pack. **I5.4** done: a cold phone-tier Driftwood entry on a preview of `f04f84d87a` makes **102 product requests** (372 before; 2 pack reads replace the sections and small files), page assets 15.35 MB | Fewer requests: pack each product's sections, schemas and every file < 64 KB into one or two content-hashed pack blobs (entries keep their hashes and are verified inside); the descriptor lists pack ranges | −600 requests (Driftwood 212 small files + 118 JSON); ~3–5 s of round trips on cellular | Codex | M | cold Driftwood product ≤ 120 requests; warm entry unchanged<br>**done (G780, sp-x6, 2026-10-27):** bc0c7cf54f cold Driftwood 120 own-product HTTP requests; unchanged-product next entry on db62fede6c makes 0 own-product HTTP requests. Whole-page 955 cold requests belong to I2, not this product-only bar. |
| **I6** done (sp-o5, this commit: `/shardfiles/*/blobs/**` immutable; Rapier keeps its fixed name, which the boot lists prefetch, and revalidates instead of a hashed URL that would fetch it twice; sections keep fixed paths and revalidate until I5 packs them; `test/vercel-cache-headers.test.ts` fails on the old regex) | Cache headers: immutable for `/shardfiles/*/blobs/**` (fix the `vercel.json` regex) and for the hashed sections; a content hash in Rapier's URL; preview header test pins both | 0 MB cold; up to ~390 revalidations (~2–4 s on cellular) whenever the content cache misses | Codex | S | `curl -sI` on a live blob shows `immutable`; the preview header test fails on the old regex<br>**done (G780, sp-x6, 2026-10-27):** shared production preview bc0c7cf54f answers200 with public,max-age=31536000,immutable for 24/24 sampled product blobs and the hashed main JS. Fixed-path sections revalidate; actual Rapier request is versioned ?v=2935a533 and revalidates. No claim of a new live-Vercel probe or immutable fixed-path files. |
| **I7 = L10 + new** (loading owns L10). **In flight (reading at plan end), sp-o4 2026-10-27, this commit:** a profile names its `controlFiles` (the boot slots' stems, no stings, and the spawn bed); on the phone the bar reads and decodes only those, and `startLateAudio` downloads the rest of the boot set after control and decodes the whole set one file at a time (the banks keep the playing slots). Slots without layers already stream through `AacTrack` (no whole-file decode where native AAC decodes); the media-element player is not needed for that. Legacy profiles keep reading everything | Audio: only the first music track and the spawn SFX set before control; music plays through a streaming media element (no whole-file decode); the rest after control | −3.3 MB and −85 requests before control; ~10 MB decoded PCM per minute of music off the heap | Codex | S–M | ≤ 6 audio requests before control; music starts within 0.5 s of the reveal<br>**Reading limit (G780, sp-x6, 2026-10-27):** this cohort was muted with music volume 0; it does not qualify the music-start-within 0.5 s bar. Existing source status remains in flight. |
| **I8** done (sp-o5, 2026-10-27). **I8.1** census done: a phone-tier Driftwood entry at `2fec61f12a` fetches 648 page requests / 18.8 MB outside the product; the compare JPEGs are already gone (J3); the "legacy-path" files are the live spawn cove (`island.glb`, `placements.bin`, lightmaps, island plans) and the sea (ocean grid + floor), ~4 MB on the phone, so they move into the product (cached, tier-selected, prefetched), not out of the entry. **I8.2** done (this commit): tier selection keeps only the page tier's files of `world.water` and `world.baked` rows. **I8.3** done (this commit): the sea (ocean grid per tier + floor, 1.56 + 3.32 + 0.52 MB) is product files through `prepareOutput` (`productPageFiles.ts`, exact public bytes, no file under src); the phone admits only its grid (I8.2). **I8.4** done: the format admits normalized Int16 positions (I8.4a, the previous commit); the spawn cove's tiles (`island.glb`, 1.22 MB) and its four lightmaps are product files and leave the boot late reads (this commit). **I8.5** done (this commit): the cove's `placements.bin` (0.67 MB) and its per-tier plans are product files, the plans compiled by the page-file hook from the table and `island.json` (byte-identical to the published plans); the entry reads no `driftwood-blender` page file. HEAD preview of 24a9d73e7d: page assets outside the product 18.8 -> 15.35 MB before this slice | Page assets outside the product in a shardfile entry: drop legacy-path GLB / BIN reads (`driftwood-blender/island.glb`, `placements.bin`, the old ocean GLB) and Explorer compare JPEGs from the entry (J3 lazy-loads their code) | −3 to −6 MB wire, −30 requests | Codex | S | Driftwood shardfile entry fetches no `/assets/models/driftwood-blender/*` and no `*-target-*.jpg`<br>**done (G780, sp-x6, 2026-10-27):** 0 forbidden outside-product legacy/compare paths across 24 observed visits, including complete Driftwood entry: no driftwood-blender path, old ocean GLB or target JPEG. Nalati/Nine census ends at their incomplete visit boundary. |
| **I9** open after reading (sp-o5, this commit: on the phone tier the menu and in-play grid prefetch read only the home cell and its ring (`prefetchRing`), and of those only the phone-tier files (`tierProductFilesPaced`, lazily loaded; sections through the content cache); desktop keeps the whole set. The download-everything button that fetches the rest is js-payload J6.1, G727) | Grid prefetch on the phone: prefetch only phone-tier files (I1's filter) of the home and its ring cells; everything else waits for G727's "Download everything" button, which shows the size first | up to ~200 MB of background cellular data per fresh install | Codex | S | a fresh phone-tier menu idle stores ≤ the home + ring phone sets; the button lists its MB and downloads the rest with progress<br>**open (G780, sp-x6, 2026-10-27):** fresh phone menu completes exactly 9 home+ring products, no out-of-ring product; stored 491,137,215 B plus 4,819,404 B already present. No size-labelled Download everything action was observed; D132. |
| **I10** open after reading (sp-o5, this commit: product admission asks once a page right after it stores a whole product in the content cache, beside the home-screen boot ask (E422); `storage.persisted` feeds the Debug storage line; `test/output-descriptor.test.ts` pins one ask and none without a cache) | Ask `navigator.storage.persist()` after the first successful product admission (not only in grid prefetch); show the result in Settings ▸ Debug's storage line (exists) | protects ~25–60 MB per shard from eviction (a re-download on the next cold launch) | Codex | S | first entry on a fresh profile requests persistence once; the storage line shows it<br>**open (G780, sp-x6, 2026-10-27):** fresh Driftwood/Pine and 12 other cohort entries make 2 native persist calls, both false; storage.persisted saves false. Small entries generally make 1. The Settings Debug storage line was not qualified: the observed panel text exists but the accessibility/visible-control continuation could not open its Debug fold. Denial is not an ask failure; duplicate asks miss the once bar; D133. |
| **I11 = U1/U2 + J6 — done** (loading-speed / js-payload own; stays its own row, G791) | After a deploy that does not touch Driftwood, the next entry re-downloads only changed JS and the descriptor | measured by U1 | Codex | — | next-entry wire after an unrelated deploy ≤ 1 MB<br>**Original reading miss (G780, sp-x6, 2026-10-27):** unrelated Driftwood pins bc0c7cf54f -> db62fede6c, actual new worker adopted: deployment switch through next control 2,492,861 encoded body bytes (>1 MB); next-entry-only window 180,526 B / 0 Driftwood product HTTP requests. Both windows retained; update cost is not hidden before entry; D134.<br>**Source repair landed (sp-x6):** `d54e62b3e5` prepares the plain document stamp; `f88eb1cdf7` makes hashed runtime modules read it and stamps web/native/calibration HTML before worker emission. Types/named lint/scoped ratchet pass; transitive root typing retains D129. The first docs-only pair exposed a second cause: concurrent edge reads changed table insertion order (all24 edge values and126 plans equal), cascading into142 chunk hashes. `d525a8fead` now sorts both keyed tables without changing values; the previous wire miss stays historical; the fully repaired two-pin verdict is below. `0a7b6cc0dd` and parent `469ce4d04f` are the controlled unrelated-deploy pair.<br>**I11 wire bar passed (sp-x6, G780):** actual unrelated-deploy pair469ce4d04f ->0a7b6cc0dd, both repairs present: update plus next control506,560 encoded body bytes /37 HTTP requests, entry-only396,301B /27 requests. Actual new worker adopted; phone Driftwood controls at5.430s/errors0. All687 emitted asset JS files have identical names and bytes;0 hashed-JS and0 Driftwood-product HTTP requests in the update window. The previous2,492,861B miss stays historical, not the current verdict. Then-remaining23 common-pickup reads370,224B were D151, now closed by the latest reading below.<br>**D151 source repair landed (sp-x6, `7f2f51b0f9`):** all23 pickup basenames already equal their payload SHA-256 (generic census179 files/61,382,077B,0 mismatches). Worker/build classification now includes full-SHA basenames; content-named bakes use cache-first in their original cache, mutable bakes remain network-first, exact legacy version aliases work offline. The12-case worker suite passes, including3 new controls. Actual pairca99509a10 ->209ad70d57 contains this repair on both pins.<br>**D151 closed; latest I11 done (sp-x6, G780):** update plus next control136,785 encoded body bytes/13 HTTP requests (≤1 MB); entry-only26,106B/4 requests. All23 pickups cached before/after,0 pickup or other data-asset HTTP requests and0 app-JS requests in the update window. Phone Driftwood reaches controls5.600s/errors0 after actual new-worker adoption. |
| **I12** (guard; build-time ceilings only, G792). **Source landed, sp-o4 2026-10-27, this commit:** `scripts/build-shardfiles.mjs` ends with `scripts/phone-wire.mjs`: each built product's declared phone wire (`tierProductWire`: the phone selection's compressed files + required commons, what admission reserves) against `wire/<product>/phone` in `lint/ratchet.json`, set at the 00:47 products + 1 % (Driftwood 71.4 MB, Pine 91.7, Nalati 89.4, Nine 209.7, Far Reach 33.8); 1.4 s for all 24 products inside the existing build step; a product with no row is reported, not refused | Per-entry phone download ceilings refused at build time on declared bytes (G792): ceilings in `lint/ratchet.json` beside J10's JS chunk-gzip ceilings, ratcheted down after each row; the build refuses a phone-tier product whose declared wire grows past its ceiling. Dropped by G792: boot-smoke request counting per entry | holds every saving | Codex | S | a commit that adds a desktop file to the phone set, or grows any entry's declared bytes past its ceiling, is refused at build time<br>**done (G780, sp-x6, 2026-10-27):** existing shared bc0c7cf54f production build finishes with 24/24 declared phone-wire ceilings green (table below). This is the build-time declared-byte bar, distinct from actual HTTP bytes or requests. No duplicate build. |

## Plan-end download reading (2026-10-27, G777/G780)

One attached shared production preview, **bc0c7cf54f8529d6923584e4f57d0fa79dca66c2**, build
`bc0c7cf-mvqm0q9g`, supplied all 24 products; no duplicate build. Chromium was muted and emulated iPhone 16 Pro,
402×874/DPR3, phone tier/render scale2, unthrottled desktop CPU/network. Developer was enabled to visit all
compiled shards. Each cold visit had a fresh browser session and origin; normal compiled entry and the maintained
Enter World action were used. The transport observer preserved response bodies/headers and counted page **and
worker** HTTP requests. Bytes below are decimal MB of encoded response-body chunks received before the first
entered, unpaused control-ready frame, excluding HTTP headers/framing. Requests are those begun before that
boundary, including still-in-flight requests. Native persistence was observed without overriding its result.
This is not a physical-iPhone frame-floor, pop-in, visual/physics parity or music-playback acceptance.

**I2: 0/24 meet both 12 MB / 250-request limits.** 22 reached control with the requested shard identity and no observed
page faults. Nalati/Nine never reached control in their 180 s visit; their bytes/requests are lower bounds received
while still waiting, not completed-control measurements. No held-stage cause is attributed. Background home+ring
prefetch traffic is included, not subtracted. I12's existing build-time numbers are separate declared MB, not this
measured transfer or a fitted cap.

| Phone-tier shard | Before-control encoded MB | Requests | Control s | I12 declared / ceiling MB |
|---|---:|---:|---:|---:|
| driftwood-isle | 97.969 | 955 | 20.082 | 63.02 / 71.50 |
| nalati-grasslands | ≥101.731 | ≥804 | incomplete >180 | 93.53 / 96.25 |
| pine-hollow | 332.246 | 1423 | 23.610 | 109.48 / 112.24 |
| nine-dragon-stack | ≥161.122 | ≥728 | incomplete >180 | 160.27 / 210.23 |
| far-reach | 62.893 | 706 | 7.770 | 33.94 / 33.96 |
| sunscar-dunes | 14.395 | 611 | 5.233 | 7.54 / 7.64 |
| _template | 7.025 | 544 | 4.685 | 5.86 / 6.00 |
| blender-template | 7.269 | 535 | 4.377 | 2.45 / 2.50 |
| ink-cel-valley | 7.099 | 525 | 4.938 | 5.87 / 6.00 |
| pastel-plain | 7.141 | 536 | 5.082 | 5.86 / 6.00 |
| open-plot-night-market | 177.413 | 1071 | 12.491 | 15.07 / 16.22 |
| open-plot-frostline-peaks | 6.981 | 496 | 4.574 | 1.86 / 1.90 |
| open-plot-lantern-bayou | 7.019 | 494 | 4.922 | 1.88 / 1.90 |
| open-plot-coral-drift | 195.518 | 1125 | 12.047 | 1.87 / 1.90 |
| open-plot-sky-race | 174.955 | 1094 | 12.053 | 1.83 / 1.90 |
| open-plot-desert-ruin | 176.072 | 1093 | 12.076 | 1.82 / 1.90 |
| open-plot-alien-plain | 163.237 | 1006 | 12.087 | 1.81 / 1.90 |
| open-plot-ember-forge | 7.069 | 516 | 3.998 | 1.86 / 1.90 |
| open-plot-mosslight-ruins | 243.169 | 1243 | 12.041 | 1.87 / 1.90 |
| open-plot-clockwork-canyon | 310.915 | 1481 | 12.106 | 1.88 / 1.90 |
| open-plot-thin-ice | 313.885 | 1528 | 12.034 | 1.79 / 1.90 |
| open-plot-showcase-template | 313.025 | 1505 | 12.060 | 1.89 / 2.00 |
| open-plot-starfall-observatory | 261.342 | 1318 | 12.074 | 1.90 / 2.00 |
| open-plot-sky-harbor | 270.783 | 1321 | 12.090 | 1.86 / 1.90 |

The I9 cold-menu destination set exactly matches the pinned Developer home+ring: Template, Blender Template,
Driftwood, Far Reach, Nalati, Nine, Night Market, Pine and Sunscar. The runtime knows 24 products but reads 9;
that inventory count is not evidence of an out-of-ring fetch. The missing download-all action leaves I9 open.

I11 uses the same-origin observer across **bc0c7cf54f -> db62fede6c65bc20f7bfbb16eb4f5e58611d6985**.
No Driftwood source/assets changed, and its complete output excluding build metadata is identical. The actual
new service worker reports `db62fed-mvqmg0ql-afd0437ff4` before the next Driftwood entry reaches control in 5.519 s.
Update+next-entry transfer is 2,492,861 B; entry-only transfer is 180,526 B, with 0 Driftwood product HTTP requests.
The earlier 5f1->bc0 checker ran before the new document's worker API was ready and is unqualified; it is not a
product failure or the basis of the verdict. A later Settings selector refusal occurred after qualified worker
adoption/next-control measurement and does not change those byte windows. Storage UI remains unqualified.

### I11 source repair and two-pin acceptance (2026-10-27)

**Done against the unchanged 1 MB wire bar.** `f88eb1cdf7` moves the per-deploy timestamp out of every
content-hashed runtime module into its HTML document (producer `d54e62b3e5`); version.json and worker identity
remain fresh. The old served bundle carried the stamp in13 chunks, including session, entry/main and perfHud.
The first docs-only comparison after that repair still changed142 chunk URLs: grid seam edges were serialized
in asynchronous completion order. Its24 named edge values and126 certified plans were equal by key.
`d525a8fead` gives both tables deterministic key order without changing values or geometry.

The acceptance pair is **469ce4d04f992c9f68e6bba5ac6d69f5d2500814 ->
0a7b6cc0dd6ff34d33d85b53093953f8f813cbdb**, a docs-only commit and its parent, both containing the repairs.
Their687 asset JavaScript files have identical names and body hashes; the full Driftwood descriptor and public
asset manifest are byte-identical. Both emit `grid-seams-46fbd086.json`. These are real separate pinned production
builds, not an edited response or a substituted build id.

One fresh muted Chromium session as iPhone16Pro, phone402×874/DPR3/render scale2, cold-loads Driftwood, returns
to the menu and completes the existing ring prefetch before deployment switch. The same-origin transport keeps
the real worker/content/HTTP caches; no cache clearing, injected HTML, GC, network throttle or compressed-size
estimate. Native update installs and the actual pill adopts the new worker, confirmed as
`0a7b6cc-mvqp9l5d-a80c0f5579` (prior `469ce4d-mvqp9j9w-a80c0f5579`). Then the next Driftwood entry reaches
entered/unpaused controls at5.430s, phone tier, with0 observed page faults.

| Measured window | Encoded response-body bytes | HTTP requests |
|---|---:|---:|
| Deployment switch through next controls (I11) | **506,560** |37 |
| Next-entry window alone, included above |396,301 |27 |
| Hashed asset JavaScript in the complete I11 window |0 |0 |
| Driftwood product HTTP in the complete I11 window |0 |0 |

The remaining bodies are23 network-first common pickup BIN reads370,224B;3 documents76,758B; asset manifest
33,589B; worker core24,483B; and other/version responses1,506B. Thus the numeric bar passes without claiming
every response is changed content. Those pickup reads were D151; the follow-up below closes them.
Headers/framing are excluded, as in the original reading; all page and worker HTTP body chunks up to the control
fence are counted. Original2,492,861B miss remains above. A first browser attempt stopped before update because
the harness used null-coalescing to unwrap a null fatal-error result; that unqualified harness refusal is retained
as such, with no app fault or byte verdict. The corrected decoder ran the acceptance once.

Two document identity regression cases pass8.61s. Named typed lint and scoped native ratchet pass; the standalone
source check has0 direct touched diagnostics but existing transitive/root typing failures, so no full-project type
green claim. All owned browsers/proxies and shared-preview borrowers are released after the reading.

### D151 follow-up: non-JS asset reuse (2026-10-27)

**I11 remains done; D151 is fixed by `7f2f51b0f9`.** The23 pickups never changed names or bytes: each basename
is its payload SHA-256. The worker treated the whole legacy baked prefix as network-first, and the shared
content-name classification recognized short hash suffixes but not full SHA-256 basenames. Both classifiers now
recognize full hashes; those requests use cache-first before mutable bakes, with the existing IMMUTABLE code / STATIC
data cache selection. Mutable unversioned bakes still fetch fresh. A matching old `?v=<hash-prefix>` cache key
can supply its full-hash plain URL offline; an arbitrary query cannot. No header, ceiling, timeout or guard changes.

Acceptance uses **ca99509a10a2eaeee752e0ce05e141ce225fc1a4 ->
209ad70d57f2f4ec547626f979c0020a112ccee4**, a docs-only commit and its parent, both source-fixed. All56
published full-hash assets have the same names and matching SHA-256 bodies on both pins. All95 root emitted
non-JS assets and687 asset JS files have identical names and bytes; the public asset manifest and full Driftwood
descriptor are byte-identical. The working-source census independently found179 matching public filenames /
61,382,077B with0 bad SHA basenames; that working-tree inventory is not the published56-file inventory.

The original muted iPhone16Pro Chromium phone402×874/DPR3/render-scale2 transport observes every page/worker
HTTP response-body chunk unchanged, with no cache clearing, HTML injection, manual asset warming or throttle.
A normal cold Driftwood entry cached all23 pickups. The current I2 source no longer prefetches from the menu;
after existing HTTP work drains, the reader verifies all23 cache entries before switching deployment. It then
uses the actual update pill and confirms the new worker `209ad70-mvqqpn3k-1dc3d030c8` (prior
`ca99509-mvqqpjmi-1dc3d030c8`) before entering Driftwood again. Both entries have0 observed page errors; the
new phone-tier entry reaches entered/unpaused controls at5.600s. No physical-iPhone timing or frame-floor claim.

| Latest window / category | Encoded body bytes | HTTP requests |
|---|---:|---:|
| Update through next controls (I11, ≤1 MB) | **136,785** |13 |
| Next entry alone, included above |26,106 |4 |
| Pickup BINs / other data assets |0 |0 |
| Asset application JS |0 |0 |
| Fresh documents |76,845 |3 |
| Asset manifest revalidation |33,589 |1 |
| New worker core |24,845 |1 |
| Other shell/version/API responses |1,506 |8 |

All23 pickups remain cached after update. The prior506,560B reading and370,224B pickup repeat remain historical;
there is no zero-wire claim for shell/update metadata. One initial observer attempt waited for the removed
menu-prefetch completion API and stopped before deployment switch, with0 app faults and no I11 byte verdict.
The cause-corrected observer uses the real cache entries and HTTP drain; it does not restart prefetch or change the app.

All12 shipped-worker regression cases pass10.48s, including full-name migration/change/removal, exact legacy
offline aliases and mutable-bake freshness controls. Strict scoped types, default named typed lint and scoped
native ratchet pass. Owned browsers/proxy and both preview borrowers are released; no standalone receipt is committed.

The encoded HTTP figures reflect this shared preview's actual gzip/identity/Brotli responses, not hypothetical
Vercel compression. Reused previews and every owned browser/proxy are released at completion. Findings live in
these rows and the damage list; no standalone audit or receipt is committed.

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


### I2.1 Control boundary before speculative reads (2026-10-27, sp-x2)

I2 is now the tile/loading owner packet. The unchanged recorded baseline
is0/24 within12MB/250requests. The deleted raw cohort cannot supply per-file
causal accounting; its table and8263b66600 remain the baseline. Source audit
finds two shared speculative paths before the selected world is playable:
a4s title timer starts the home/ring product downloader, and ws:ready at
the title starts lazy-code warming. Slow entries therefore include other
products and code that the spawn view does not need. Product admission also
reads every selected-tier file before tile demand; that is the next slice.

Remove the title timer's download. After the host's first entered/unpaused
control-ready frame, a scoped paint/task boundary starts the existing
nearest-first grid queue, held-back audio and worker/shard warming. A pause
rearms the same observer; retired scopes cannot run queued work. Worker
update adoption still uses title ws:ready, independently of code warming.
The original loader, cache/hash checks, spawn content and control fence
remain. No before-control bytes are hidden or subtracted in the reader.

Engine/game/engine-test types, touched typed lint and selected source
ratchet pass. Two control/retirement source cases and the original worker
adoption case are typed, not executed under G769. No product build or
per-slice reading. In flight: do not count I2 as passed from this source.
After the admission slice, reread Pine (largest completed transfer), Nalati
and Nine (the two180s incomplete visits) with the original page+worker
HTTP observer, fresh origins, named sessions and exact control fence.

### I2.2 Admission follows actual demand (2026-10-27, sp-x2)

I2.1 source is a8465f58ca. This follow-on keeps the complete product
declaration, memory admission and exact validation receipt. Only trusted
receipted phone products admit critical/global/manifest bytes up front;
scoped tile readers verify later bytes on demand. Untrusted, unreceipted
and desktop admission retain full selected transport validation. Explorer
catalogue presence no longer preloads Explorer code in the runtime or
boot-code producer; actual Explorer entry still loads it.

After control, remaining immutable files warm one at a time at low network
priority, nearest tiles first. Retiring the level stops new reads. A partial
load never publishes the fully visited offline index: every selected file,
common and section must be durably verified before publication. The queue
does not refill the released page transport map.

Four touched fixtures and named typed lint pass. The game compiler sees
foreign live cubeUVSample Node/null diagnostics; routed to sp-ci-deploy,
no rendering edit or type waiver. Selected source ratchet passes. New
fixture cases are typed, not run under G769. I2 remains in flight pending
the Pine/Nalati/Nine reread; no transfer saving is inferred from source.

### I2.3 Actual phone reread and boot-pack cause (2026-10-27, sp-x2)

Source a8465f58ca defers title/grid/worker speculative queues past control;
573a3bebd7 adds receipted phone partial admission and complete-offline
publication only after durable verification. 4ca953e24f adds encoded chunk
observation for in-flight responses. Original baseline8263b66600 stays.
One exact pinned build4ca953e24fe026db539996548b05b1d36bb1af8e,
4ca953e-mvqqg5la (actual version retained in reading.json), served all24
products. Three fresh named agent-browser sessions, fresh proxy origins,
muted iPhone16Pro402x874/DPR3, phone/render2, unthrottled CPU/network,
Developer on and volume/music0. The real picker SHARDFILE button and
maintained hud.enterNow enter each requested identity. Init rAF records
Date.now at entered/unpaused + HUD not intro + no loader + frameGate +
clock unpaused. Count every page/worker request started by that fence and
every encoded forwarded body chunk written by it, including unfinished
responses; no body/header replacement or HTML injection. Browser contexts
and proxies closed; parent4407 released. No Simulator or isolated-load
claim; concurrent peer browsers were active. Raw: tmp/sp-x2/i2-reading.

| Worst row | Original encoded MB / requests | Reread encoded MB / requests | Tap to control | Page errors | I2 verdict |
|---|---:|---:|---:|---:|---|
| Pine | 332.246 / 1423 | 198.089209 / 935 | 11.413 s | 0 | misses both |
| Nalati | >=101.731 / >=804; incomplete180s | 103.163123 / 786 | 13.163 s | 0 | misses both |
| Nine | >=161.122 / >=728; incomplete180s | 166.460980 / 731 | 17.899 s | 0 | misses both |

All3 actually reach control now; 0/3 meet both transfer limits. This is a
cross-revision observation, not attribution of the whole change to I2.
No other shard product was fetched in these3 before-control cohorts.
The observer retained HTTP405 telemetry separately; no asset HTTP error
or page error. Original24 qualification remains0/24, not overwritten by3.

| Requested bytes before control | Pine MB / requests | Nalati MB / requests | Nine MB / requests |
|---|---:|---:|---:|
| Declared global/critical/manifest blobs | 87.475 / 261 | 77.411 / 138 | 145.590 / 174 |
| Selected product packs | 10.094 / 4 | 3.038 / 2 | 6.781 / 3 |
| Tile-demand blobs | 4.405 / 51 | 3.616 / 30 | 0 / 0 |
| Public predecessor packs | 81.140 / 26 | 7.895 / 3 | 6.270 / 3 |
| Near/far public baked | 5.006 / 27 | 0.370 / 23 | 0.370 / 23 |
| JS, page and worker | 2.605 / 507 | 2.551 / 527 | 2.320 / 473 |
| Other static, including metadata | 7.364 / 59 | 8.158 / 62 | 5.130 / 55 |

I2.3 removes the exposed eager predecessor-pack/world prefetch for a
non-legacy phone page with a real tiled client-plan product. Each original
loader can still request its required public URL, with original bytes,
hashes and rendering. Desktop, untiled pages and frozen LEGACY retain
their pack behavior. The compiled tiles already load through their scoped
readers; unused predecessor whole-world copies are not background-warmed.
No cap, ring, physics or coarse/far content changes. Remaining global
libraries and hundreds of actual JS requests still need reductions; D131
stays open. The source-fixed pack cut needs the next affected-row read;
no saving is claimed from deleting a speculative call alone.

The Explorer preload producer is573a3bebd7; its missed Vite home-group
expectation is corrected here while preserving the independent Explorer
group/byte assertions. Touched game and fixture types, typed lint and
selected source ratchet pass. No prelanding tests under G769.

All24 source inventories below verify every section size/SHA from this
same served product. These are declared file bytes, not encoded HTTP;
explicit desktop files excluded conservatively (runtime I1 can exclude
more variants). All globals/critical/dependency/manifest files remain.
The deferred column names tiles and optional nontile files retained in the
full product, verified when demanded, then warmed nearest-first only past
control. Commons declared bytes are0 for every row. No browser reading
is claimed for the other21. Repeated global library intake remains the
large-shard blocker, not licence to drop required content or raise limits.

| Shard | Initial declared MB / files | Deferred declared MB / files |
|---|---:|---:|
| _template | 1.181 / 13 | 4.682 / 156 |
| blender-template | 1.278 / 73 | 1.171 / 57 |
| driftwood-isle | 86.958 / 369 | 9.977 / 26 |
| far-reach | 33.028 / 118 | 1.635 / 33 |
| ink-cel-valley | 1.186 / 13 | 4.682 / 156 |
| nalati-grasslands | 87.784 / 267 | 7.589 / 64 |
| nine-dragon-stack | 162.113 / 665 | 0.711 / 12 |
| open-plot-alien-plain | 0.033 / 67 | 1.776 / 83 |
| open-plot-clockwork-canyon | 0.030 / 67 | 1.849 / 83 |
| open-plot-coral-drift | 0.033 / 67 | 1.833 / 83 |
| open-plot-desert-ruin | 0.035 / 67 | 1.782 / 83 |
| open-plot-ember-forge | 0.029 / 67 | 1.828 / 83 |
| open-plot-frostline-peaks | 0.032 / 67 | 1.829 / 83 |
| open-plot-lantern-bayou | 0.034 / 67 | 1.849 / 83 |
| open-plot-mosslight-ruins | 0.033 / 67 | 1.842 / 83 |
| open-plot-night-market | 0.707 / 72 | 14.877 / 85 |
| open-plot-showcase-template | 0.028 / 67 | 1.858 / 83 |
| open-plot-sky-harbor | 0.028 / 67 | 1.833 / 83 |
| open-plot-sky-race | 0.030 / 67 | 1.798 / 83 |
| open-plot-starfall-observatory | 0.032 / 67 | 1.863 / 83 |
| open-plot-thin-ice | 0.029 / 67 | 1.764 / 83 |
| pastel-plain | 1.178 / 13 | 4.682 / 156 |
| pine-hollow | 130.290 / 836 | 7.822 / 92 |
| sunscar-dunes | 6.751 / 62 | 1.192 / 80 |

### I2.4 Cost-only library reads (2026-10-27, sp-x2)

The cause-fixed95a47c50a326ba59cd4eb8dbb7755a1d7b413efb follow-on
cohort reaches control on all3 with0 page errors, but still0/3 meet both
limits. Build95a47c5-mvqqvp4a; identical first-cohort profile/fence/counts,
fresh named sessions/origins, no unchanged retry or deadline extension.
Raw tmp/sp-x2/i2-reading/final. The reader argument's full SHA suffix was
mistyped; the build command/registry resolve the exact95a SHA above and
its observed version matches95a47c5. Source identification comes from
that actual build creator, not the typo in raw protocol metadata. All
contexts/proxies closed, final parent4401 released.

| Row | Encoded MB before control | Requests started by control | Tap to control | Page errors |
|---|---:|---:|---:|---:|
| Pine | 180.866385 | 1036 | 20.062 s | 0 |
| Nalati | 103.162006 | 816 | 14.456 s | 0 |
| Nine | 165.854936 | 752 | 11.935 s | 0 |

No isolated pack-cut improvement is claimed: joint revisions/concurrent
peer workloads and direct required reads differ. The original180s cap
and12MB/250-request bars remain. Sp-o5 now owns graphical spawn-vs-late
content on Pine/Nalati/Nine; sp-x9 owns the generic JS request cut (actual
469-523 JS requests alone exceed250). Sp-x2 keeps the mechanism and other
shards. This is a source join, not a second duplicate baseline request.

A concrete generic eager-read cause is leaseClientLibrary: it rereads
every non-image library body before reserving claims, though only KTX2
cost depends on parsing those bytes at the current device. This packet
uses the exact build receipt for cost-only file rows, through the original
validated source and identical file-object membership even after host
row projections. Full decoded+GPU claims remain unchanged. Replaced file
objects cannot borrow the receipt. Unreceipted files, device-specific
KTX2 parsing, commons and guest memory checks keep their original byte
readers and refusals. Actual content consumers still verify every wire.
No new late field, content/cap change or placeholder is introduced.

Touched scoped fixture types, typed lint and source ratchet pass. The
latest game compiler is blocked by foreign live framePacing.ts41 TS9010,
routed to its owner; no source/allowance edit. New exact-receipt and
replaced-row controls are typed, not executed before landing under G769.
The costing cut remains in flight, with its measured transfer saving
pending the joined source cohort; it is not an I2 pass.

### I2 JavaScript request batches (2026-10-27, sp-x9)

In flight (reading at plan end): the existing unconditional startSelected
module bank contains 349 emitted files on the shared 67c0cc preview. Batch
only that bank's static dependencies into bounded control chunks; retain
title dependencies, session-closure membership, optional dynamic roots and
shard ownership. Execution-order wrappers protect circular module bindings.
No plugin, new preload or ceiling increase. Native output is unchanged.
Touched types, typed lint and scoped ratchet pass. The containing web build
must still pass original title/session/grid ceilings and Pine/Nalati/Nine
must be re-read against the original 250 total before-control request bar.
X2 owns data admission and o5 owns content; neither owns chunking hunks.

I2 mechanism source boundary (2026-10-27, sp-x2): a8465f58ca
(after-control queues), 573a3bebd7 (phone admission), 95a47c50a3
(native tiled-phone pack demand and Vite expectation), bb85e4e158
(receipted cost-only library IO) are landed; bb85 is origin verified.
Status remains in flight (reading at plan end); the most recent actual
three-row observation is95a above, not a claimed measurement of bb85.
No own preview/browser is retained. Graphical content sp-o5 and generic
JS batching sp-x9 are independent sources for the joined qualification.
Fresh game compilation now passes the repaired framePacing annotation
7972590759 and stops at foreign untracked rigAtlas.ts TS4111; routed
sp-ci-deploy. Own scoped fixture types and touched typed lint remain0;
no tests, source allowance change or false whole-tree types claim.

### I2 full bundle qualification (2026-10-27, sp-x9)

Source83dff53bdf initially fails original title isolation; cf053a2cde pins
that boundary.2f6ec005df normalizes emitted entry-aware names without
relaxing the bank grammar.02a4f512ea follows each manifest facade and its
full implementation closure, retaining coalesced source aliases and
strict duplicate-target refusal. Finally b3b7b0bcd3 isolates actual HTML
initial entry sets, keeping calibration's Three graph behind public retry.
All original failures are retained under tmp/serve/failed-20261027-* and
tmp/sp-x9-control-chunks; none is converted into a green timing sample.

Actual shared b3 production build completes every boot bank. Unchanged
full checkChunks has0 errors (pre-entry, shard ownership, title/session/
grid ceilings and full inventory): title285355raw/102422gzip B versus
350000/110000; session3980164raw/1240186gzip versus4400000/1360000.
Common bank349->179 files; full emitted JS census680->552 versus the
older shared67c0cc build (different pins, no isolated timing claim).
Nine focused cases pass across retained boot-bank and recovered real
Vite two-entry controls. Touched types/typed lint/scoped ratchet pass.

I2 remains in flight: original Pine/Nalati/Nine page+worker transport
reader is queued through browser-lane on shared b3, muted iPhone16Pro,
2x scale; original250-total-request and12MB bars remain unchanged.

### I2.5 Declared after-control library intake (2026-10-27, sp-x2)

In flight (reading at plan end): the plain optional source field is
`late?: {hash:string, at?:[number,number]}[]`, emitted under
`admission.late` by the SDK's existing product writer. Every hash stays in
files/library and the full decoded/GPU claim. Duplicate hashes, missing
library/local-file membership and nonfinite/out-of-cell x/z positions
refuse; old products omit the field with their previous bytes unchanged.

Exact receipted first-party phone admission removes only the hinted roots
from its eager library roots. Critical flags, authoritative/manifest roots
and their complete dependencies still win. Untrusted/unreceipted admission
validates all selected bytes. A normal product.file/ClientAssets read can
await a hinted file earlier if actual content needs it. This is an intake
schedule, never permission to hide required spawn content or its costs.

Hydrated and native lazy products both complete through the same scoped
after-control callback. Native product identity and scope leases remain
synchronous; lazy queue setup cannot race publication of product aliases.
Positioned file/dependency closures warm nearest-first, then unpositioned
files, one verified low-priority read at a time. Retirement stops new work;
missing/corrupt/quota-refused bodies never publish a complete offline
product. Full tier-selected files, commons and sections must all be
verified durable before its existing visited index is published, retaining
the exact build-validation metadata. The late queue holds no settled
page-body bank. Early demand can use the same cached bytes without another
network download. Native admission is not replaced by full eager reads.

Receipted late phone KTX2 cost-only intake keeps its full validated GPU
bound until the real texture consumer parses the body. Non-late/device
KTX2 and unreceipted body checks remain, as do commons/guest-memory checks.
Desktop and frozen LEGACY transport policy are unchanged. Sp-o5 owns the
heavy content producers/readers; sp-x9 owns boot-root/JS batching. This
packet includes neither their variantOf nor reachControl working hunks.

Touched format/game/SDK and four-fixture types, named typed lint and
selected source ratchet pass. Six source controls cover late metadata,
critical/dependency priority, spatial ordering, native early demand/cache
completion, and unreceipted full validation. They are typed, not executed
before landing under the explicit code-only instruction. No build,
preview, browser or guard waiver in this packet. No new measured I2 pass;
the code is ready for the joint three-row read after the boot fix and
content source join. Latest recorded transfer misses remain unchanged.

### I2.6 Project producer adapter and shared boot-fixed reread (2026-10-27, sp-x2)

I2.5's generic wire/reader contract is d181227f53 (origin verified).
Its missed normal-project adapter is completed here: `prepareOutput`
may return `late: [{hash, at?: [x,z]}]` beside blobs/namedFiles/assets.
PreparedProjectOutput keeps a validated owned list separate from transport
options. `mergeProjectBlobs` applies it after named bytes establish their
library roots, then the existing parser verifies membership/duplicates.
No `nameBlob` option or file metadata change. Ordinary readProjectAssets
forwards it; the existing writer emits source.late as admission.late.
Legacy outputs omit the property and retain their previous object shape.

SDK and SDK-test types and touched typed lint pass in9e4f6f359e.
The initial selected ratchet refused three pre-existing raw timing reads
in touched project.ts; the follow-on uses the existing diagnosticNow API
without changing phase semantics, and the actual selected ratchet now
lowers. No allowance or clock-budget change. Three control sources cover ordinary project intake, round-trip disk
output/full costs, and malformed/missing/duplicate roots. They are typed,
not executed before landing under G769. No build or new reading for this
adapter. Sp-o5 can now emit actual late cabin/sky/creature declarations
through its existing prepared output, without writing library assembly.

The coordinator's blocked reread is satisfied by consuming sp-x9's
already-completed matching cohort, not opening duplicate browsers:
full pin b3b7b0bcd3f7787b9ce53eb8a64ab3017497e794,
version b3b7b0b-mvqs56mh from the shared4401 preview. Full original
checkChunks and boot-bank emission pass on that source. Retained raw
`tmp/sp-x9-control-chunks/reading/{reading,pine-hollow,nalati-grasslands,nine-dragon-stack}.json`
and comparison `tmp/sp-x9-control-chunks/compare.json` were inspected.
Same original I2 reader/profile: fresh named muted iPhone16Pro sessions,
phone/render2, CPU1/network unthrottled, original picker/HUD entry,
Date.now control fence, all page+worker starts and encoded forwarded
chunks by that fence, no HTML/header/body alteration. All requested
world identities match, no page errors. No second build or browser was
started by x2; x9 owns its shared-preview borrower cleanup.

| Requested row | Encoded MB before control | Requests | JS requests | Tap to control | Page errors | I2 |
|---|---:|---:|---:|---:|---:|---|
| Pine | 180.917472 | 926 | 398 | 17.181 s | 0 | misses both |
| Nalati | 103.214456 | 706 | 417 | 12.666 s | 0 | misses both |
| Nine | 164.770903 | 638 | 362 | 17.004 s | 0 | misses both |

Total request bar remains250; JS alone still exceeds it. Original24-row
qualification remains0/24, latest3 remains0/3 despite controls completing.
This source predates d181 late declarations/content activation, so it
cannot measure their saving. Sp-x9 owns further generic JS fragmentation;
sp-o5 owns actual heavy content deferral. No source-only gain, native
memory result, isolated load attribution or Simulator pass is claimed.
I2 remains in flight for the joined source read; boot-root refusal is
closed on this b3 pin, and previous refused logs remain historical.

I2 late source handoff: d181227f53 is the wire/native reader;
9e4f6f359e is the ordinary ProjectOutput producer adapter. Both landed
code-only with the existing content/JS producer split intact. Source stays
in flight (reading at plan end); the b3 shared cohort above predates these
late declarations and must not be credited as their transfer saving.

### I2 JS cohort reading (2026-10-27, sp-x9)

Source `a9708d8778` reuses the preload bank's literal feature/grid roots
and exact product-selected home requirements. Code merges only with the
same home-route, title-root, initial-entry and session requirements;
unselected optional code and shard owners remain lazy. No Vite plugin,
new preload, native-output change or ceiling increase.

Actual containing shared pin `21c9656927`, build `21c9656-mvqsnita` (exact
version in the raw reader): full unchanged checkChunks0 errors, all boot
banks complete; title256551raw/90351gzip B against350000/110000,
session3880122raw/1193984gzip against4400000/1360000. Common bank349->118
files; total emitted JS680->349 versus the older shared67c0cc census.
Ten focused cases pass, including real two-entry initial isolation,
complete facade/alias inventory and separate-home/Explorer controls.
Touched types, typed lint and scoped ratchet pass.

Original x2 protocol, fresh muted iPhone16Pro/2x/CPU1 Chromium entries,
page+worker requests started before the same first-control fence; actual
forwarded encoded bytes before that fence. No response modification,
forced GC, retry or deadline change. All three reach control/errors0:

| Home | JS requests,95a ->21c | Total requests,95a ->21c |21c bytes before control |21c tap-to-control |
| --- | ---: | ---: | ---: | ---: |
| Pine |508 ->209 |1036 ->737 |180737209 |17.039s |
| Nalati |527 ->215 |816 ->504 |103024928 |12.685s |
| Nine |472 ->194 |752 ->470 |164601700 |10.768s |

JS requests fall about59%; JS encoded bytes also fall to2502284/2440264/
2221282 B. These are different containing source pins, not an isolated
timing experiment. The original **250 total requests /12MB bar still
fails all three**: data requests are528/289/276, owned by the continuing
x2/o5 admission/content cuts. I2 remains in flight; no whole-row done or
physical-phone acceptance claim. Raw: tmp/sp-x9-control-cohort/reading
and tmp/sp-x9-control-chunks/cohort-compare.json. All own browsers/proxies
closed; shared preview4406 released/stopped after the read.

### I2.7 Keep deferred bodies out of control packs (2026-10-27, sp-x2)

Source: `6a9ab1609a` (pushed).

In flight (reading at plan end): the producer adapter9e4f6f359e and
clock correction09e5221805 follow late contractd181227f53. This slice
separates small required and deferred body packs, using the same pure
control dependency closure in the SDK writer and phone admission. It
prevents an early body from pulling late or distant bytes along in the
same pack. Descriptor packs remain separate; all member paths/hashes,
compressed sizes, full cost declarations and pack limits stay unchanged.
Global LUT and commons roots join critical/manifest dependencies, so a
late hint cannot defer a mandatory global input. Pack hashes/grouping
can change; this is not a product-byte-equivalence claim.

Touched format/game/SDK and SDK-fixture types, scoped scenario types,
typed lint and source-path ratchet pass. Source controls cover distinct
early/late packs and a mandatory LUT with a late hint; tests/builds/read
are intentionally not run before landing (G769). No transport/range or
JavaScript/SW change. Sp-x9 owns the JS pack; sp-o5 owns the heavy-shard
content hints. No additional baseline browser was opened.

The latest actual shared21c9656927 cohort is recorded above by sp-x9:
Pine180737209B/737requests, Nalati103024928B/504, Nine164601700B/470;
all reach control/errors0. Data requests528/289/276 remain, and0/3 meet
both original12MB/250-total limits. Those measurements predate this pack
change and do not establish a saving for it. The original all24 baseline
is retained; the eventual joint heavy-three read must include producer
hints and this pack grouping before I2 can qualify.

### I2.8 Explorer-only manifest art (2026-10-27, sp-x2)

Source: `1655f7fd74` (pushed).

In flight (reading at plan end): the generic manifest packer emits late
hints for gallery and comparison image hashes only. Image bytes shared
with any card, map, sky or horizon remain early regardless of authored
URL. Normal readProjectAssets forwards those hints after the image blobs
are admitted. Explicit authored positions win; commons and existing
non-library roots are untouched. All bytes, names, library membership
and conservative image costs remain; Explorer can request art earlier
through its existing verified reader. No shard-name branch or new host.

SDK and scoped fixture types, typed lint and source-path ratchet pass.
Source controls cover distinct Explorer art, a same-byte/different-URL
early alias, and normal project intake with exact full image costs.
Not executed before landing under G769; no product/preview/browser read.
The prior21c blob/image traffic was Pine32requests/6972179B,
Nalati1/724014B and Nine2/369316B, but includes images that are not solely
Explorer art: it is not an expected or measured saving. I2 remains0/3
on the last heavy-three read, original12MB/250-total bars unchanged.
Joint read awaits the actual heavy content hints and x9 JS-pack source;
no duplicate baseline and no physical-phone acceptance claim.

### I2.9 Standalone spawn has no distant-exit pins (2026-10-27, sp-x2)

Source: `f466081bbe` (landed).

In flight (reading at plan end): residentTiles previously required the
spawn3x3 plus every declared exit tile when no crossing was bound. It
now uses only the actual bound arrival ring, or the authored spawn3x3
for a standalone entry. The existing driver fills the bounded3x3/5x5
rings nearest first during play; coarse/far landmarks, collider safety,
entry failure refusal, re-entry and ownership remain on the same ports.
No need to construct an unrelated distant exit before a spawn control
frame. The old entryways parameter remains for caller compatibility;
its distant pins are unused. No frozen LEGACY path or tile cap change.

Game/game-fixture types, touched typed lint and scoped ratchet pass.
The standalone source control now requires exactly9 spawn render and
collider tiles and excludes the far exit. Existing actual-crossing and
failure controls remain. Tests/builds/reading are not run before landing
under G769; no measured savings or completed I2 acceptance claimed.
Last actual heavy-three control numbers remain the21c table above.

### I2.10 Late hints are scheduling, not consumers (2026-10-27, sp-x2)

Defining red-fix: `9738809b3f` (pushed; waiting lanes informed).

Red-fix for1655f7fd74: the conservative tier-selection field walk
interpreted the new late hashes as real synchronous consumers, undoing
manifest-only image omission. The same151 FarReach file records and
sections are byte-for-byte identical in retained green preview4404 and
current product. Four newly hinted Explorer images total161334B;
34105274B was149799B above the33955475B original ceiling. No new asset
bytes or pack cost caused this refusal. The metadata interaction was my
source regression, not a FarReach generator or ceiling defect.

Both entryFileSteps and tierLibrarySteps now omit only late scheduling
metadata from the conservative use walk. Actual critical, dependency
and other host references still pin their files. Read-only native
selector control on the same existing product, no rebuild: before fix
with hints34105274B/148files versus without hints33943940B/144files;
after fix both33943940B/144files,11535B under the unchanged ceiling.
Hints remain published and all151 file records/sections stay unchanged.

Format/test types, touched typed lint and scoped ratchet pass. New
source controls retain critical/dependency/host pins and the original
horizon tier selection. They are typed, not executed before landing
(G769); the actual existing-product selector comparison above executed.
No preview/product duplicate, cap change or acceptance saving claim.
I2 still awaits the joint heavy-three read on its original12MB/250 bars.

### I2.11 Late hints do not pin synchronous residency (2026-10-27, sp-x2)

In flight (reading at plan end): apply the same scheduling/consumer
separation as9738809b3f to the adjacent runtime-only, specimen,
Explorer-whole and URL-image residency scans. Their existing typed
consumer and dependency walks remain; only source.late is omitted from
use discovery. Inventory membership, full raw declarations and the
metadata's own JSON heap charge remain. This prevents the new hints
from creating a fictitious synchronous reader in otherwise unchanged
host projections. No content, admission gate or memory cap changes.

Game and scoped output-descriptor fixture types, touched typed lint
and scoped ratchet pass. Source control checks late-only bytes remain
runtime-read-only while a real LUT consumer pins them. Not executed
before landing under G769; no build, browser, memory or wire saving
claim. I2 retains the original heavy-three failure until a joint read.

### I2 one boot-code transport per entry (2026-10-27, sp-x9)

In flight (reading pending):21c before-control JS/data counts are209/528,
215/289 and194/276. Complete product responses under64KiB are45/26/22;
most data requests are GLB/KTX2/bin, so x2/o5 retain required/deferred pack
separation and late-content ownership. No data pack format or content edit.

The plain post-build writer packs exactly each entry's existing common,
client, selected discovery, early-import and home-feature JS files into one
SHA-256-named gzip transport. The controlling worker authenticates wire
hash/length, bounded decode, complete membership and every inner hash
before caching unchanged module bytes under their original URLs. Original
ESM import/evaluation order stays; corrupt/unsupported/storage-failed packs
use the original per-module whole-body retry path. No title rescue, external,
legacy, native or explicit network-only entry starts this optional transport.
Only the handshake is bounded; actual reads retain the original boot clock.
The selected pack's actual transfer is declared; warm all-member cache hits
add no invented pack download. Code-pack bytes/requests count as JS transport
in the final split; moving code into .pack never hides it as data.

Touched scoped types, standalone strict worker-codec types, typed lint and
ratchet pass; entry's inherited public-index count21 is reduced to18 to meet
its unchanged18 allowance. Codec/integrity/entry-isolation/offline controls,
containing bundle guards and the joint original3 read follow this landing.
