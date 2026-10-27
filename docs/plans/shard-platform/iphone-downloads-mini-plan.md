# iPhone downloads: fetch less, in fewer requests, in the right order (E504)

**State:** `draft` 2026-10-24, for Jake to read; not sent to the builder. A read-only audit by the plan agent's
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
| **I1 = L18** (loading-speed owns; tier filter in flight in the working tree, `tierProductFilesPaced`) | Phone-tier filter before declare / fetch; Explorer specimens, UI compare images and the headless sim on demand (G729 progress) | −12 MB wire (product 37.7 → ~25.5), −70 requests | Codex | S (in flight) | phone Driftwood fetches no `desktop`, `specimen`, `ui/images` or `sim/` file; product ≤ 26 MB wire |
| **I2 = H3 + T3/T4** (loading-speed / tile-streaming own) | Before control: critical files + spawn tiles + the ring; the rest streams after control at low priority, nearest first | before-control wire 52 → ≤ 12 MB; 20–35 s of a cold hotel-wifi entry | Opus (H3) | M | Simulator cold: ≤ 12 MB and ≤ 250 requests before control; no pop-in inside the spawn view |
| **I3** (= RM8.1: authored-world tiles done, sp-o1 850a6efb5f + 6e9a4660dd: Int16 grid positions, Int8 normals, Uint8 colours, meshopt; Night Market geometry 121 → 17.7 B/tri. Driftwood / Nine baked geometry open) | Quantised meshopt for baked geometry on the phone tier (SDK bake: `KHR_mesh_quantization` + meshopt filters: 16-bit positions, octahedral 8-bit normals, 8-bit colours), choosing per file by brotli size, not gzip | Driftwood −8 to −12 MB wire (raw GLB 21.6 MB br); Nine −10 to −15 MB; −30–50 % geometry decoded + GPU bytes | Opus (look must hold, G415) | M | phone Driftwood GLB wire ≤ 10 MB; DW / Nine look side by side "similar" (G415); physics walk 0 stuck; GPU MB down in the census |
| **I4** | Phone textures: Pine's 42 UASTC KTX2 (31.4 MB) re-encoded with UASTC RDO + zstd (or ETC1S for albedo per D2); phone tier drops the top mip of any > 1K texture; Nine's raw-format KTX2 to Basis | Pine −12 to −18 MB wire; GPU unchanged or lower | Opus | M | Pine phone KTX2 ≤ 15 MB wire; look holds on a variant sheet (taste rule) |
| **I5** | Fewer requests: pack each product's sections, schemas and every file < 64 KB into one or two content-hashed pack blobs (entries keep their hashes and are verified inside); the descriptor lists pack ranges | −600 requests (Driftwood 212 small files + 118 JSON); ~3–5 s of round trips on cellular | Codex | M | cold Driftwood product ≤ 120 requests; warm entry unchanged |
| **I6** done (sp-o5, this commit: `/shardfiles/*/blobs/**` immutable; Rapier keeps its fixed name, which the boot lists prefetch, and revalidates instead of a hashed URL that would fetch it twice; sections keep fixed paths and revalidate until I5 packs them; `test/vercel-cache-headers.test.ts` fails on the old regex) | Cache headers: immutable for `/shardfiles/*/blobs/**` (fix the `vercel.json` regex) and for the hashed sections; a content hash in Rapier's URL; preview header test pins both | 0 MB cold; up to ~390 revalidations (~2–4 s on cellular) whenever the content cache misses | Codex | S | `curl -sI` on a live blob shows `immutable`; the preview header test fails on the old regex |
| **I7 = L10 + new** (loading owns L10) | Audio: only the first music track and the spawn SFX set before control; music plays through a streaming media element (no whole-file decode); the rest after control | −3.3 MB and −85 requests before control; ~10 MB decoded PCM per minute of music off the heap | Codex | S–M | ≤ 6 audio requests before control; music starts within 0.5 s of the reveal |
| **I8** | Page assets outside the product in a shardfile entry: drop legacy-path GLB / BIN reads (`driftwood-blender/island.glb`, `placements.bin`, the old ocean GLB) and Explorer compare JPEGs from the entry (J3 lazy-loads their code) | −3 to −6 MB wire, −30 requests | Codex | S | Driftwood shardfile entry fetches no `/assets/models/driftwood-blender/*` and no `*-target-*.jpg` |
| **I9** | Grid prefetch on the phone: prefetch only phone-tier files (I1's filter) of the home and its ring cells; everything else waits for G727's "Download everything" button, which shows the size first | up to ~200 MB of background cellular data per fresh install | Codex | S | a fresh phone-tier menu idle stores ≤ the home + ring phone sets; the button lists its MB and downloads the rest with progress |
| **I10** | Ask `navigator.storage.persist()` after the first successful product admission (not only in grid prefetch); show the result in Settings ▸ Debug's storage line (exists) | protects ~25–60 MB per shard from eviction (a re-download on the next cold launch) | Codex | S | first entry on a fresh profile requests persistence once; the storage line shows it |
| **I11 = U1/U2 + J6** (loading-speed / js-payload own) | After a deploy that does not touch Driftwood, the next entry re-downloads only changed JS and the descriptor | measured by U1 | Codex | — | next-entry wire after an unrelated deploy ≤ 1 MB |
| **I12** (guard) | Per-entry wire and request budgets, refused in CI: the boot smoke counts **context-level** requests (worker included) per entry (title, SHARD SELECT, grid, DW / Pine / Nine shardfile, a crossing): total, before-control MB and requests; ceilings in `lint/ratchet.json` beside J10's JS ceilings, ratcheted down after each row; the build refuses a phone-tier product whose declared wire grows past its ceiling | holds every saving | Codex | S–M | a commit that adds a desktop file to the phone set, or grows any entry past its ceiling, is refused by CI; numbers print in the smoke log |

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
