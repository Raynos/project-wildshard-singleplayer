# Bulk download: the whole boot in 10 requests or fewer (mini spike)

**State:** `open` 2026-11-03. Written by a wildshard-v subagent (ask E525). This spike landed only a standalone packer, its
reader, a benchmark and this page. The game and its loaders are unchanged; the rows at the bottom are for the builder.
Its sibling page, [download-speed-mini-spike.md](download-speed-mini-spike.md), covers bytes, the bisect and the other
levers. Jake, 2026-11-03: *"Why are there 1200 requests? It sounds like the problem is 1200 fucking requests. From first
principles, how do you download the full game in bulk with maximum 10 requests?"*

## The answer in five lines

1. **Only 436 of the 1,197 requests download anything** (20.7 MB). The other 761 are the game reading files it already
   has, from its own cache, at almost 0 bytes. Only 537 different URLs are involved.
2. **The request count itself costs about 1–2 s at the phone preset, not 30 s.** Measured: the 419-file boot set fetched
   one file at a time takes 17.4 s (18.7 s at CPU 10×), and the same bytes in 7 packs take 16.2 s (16.4 s). HTTP/2 already sends the small
   files side by side on one connection. The floor is the bytes: 20 MB at 10 Mb/s is 16 s, with any number of requests.
3. **Ten requests is still the right shape, and it is cheap to build.** It turns 419 requests into 7 and the 761 re-reads
   into 0, does 7 cache writes instead of 419, and costs the same bytes (−1.3 % with today's brotli, −18 % if the packs
   are precompressed at brotli 11). The prototype packer runs in about a second.
4. **The bigger hidden cost is the service worker.** On a first visit it installs in the background and pre-downloads
   323 files: 96 MB raw, about 24 MB on the wire, all at the same time as the boot. That includes seven
   `grid-strip-mesh` .bin files (68 MB raw) when the boot needs one. `phone-loading` throttles the worker with its own
   DevTools call (`scripts/phone-loading/chromium.ts`), which gives it a second 10 Mb/s, and its requests are not in the
   page's list, so the emulated runs never showed it. On one shared link, as on a phone, it adds **19 s** (36.5 s
   against 17.4 s). On live it shared the Mac's real link: 20.8 + 24 MB at the measured 15 Mb/s is at least 24 s, which
   accounts for much of the 40–50 s "Application modules" that the sibling page put down to link noise. (That page says
   the worker precache is "not a cold lever". That holds for `PREFETCH`, but not for `install`, which precaches `FILES`
   on the first visit.)
5. **Order of work:** stop the first-visit precache before control (BP1), then the spawn pack (BP2–BP4), then fewer JS
   chunks (BP5). Bytes (the sibling page's DS1: a ≤ 5.5 MB set before control) remain the lever that reaches 5 s.

## Why there are 1,200 requests

These are from the daily `phone-loading` cold run against live `8bdf53f` (game → INFINITE WILDSHARD → first control,
1,197 requests). "Network" means the response carried more than 200 bytes. The rest were cache hits or 304s.

| class | distinct URLs | network requests | other requests | MB on the wire | who fetches it |
| --- | --- | --- | --- | --- | --- |
| GLB (`shardfiles/driftwood-isle/blobs/glb`) | 196 | 196 | 282 | 9.5 | spawn download, then the product reads |
| JS chunks (`/assets/*.js`) | 108 | 54 | 132 | 0.7 | module graph, then the worker's install precache |
| blob JSON | 78 | 78 | 125 | 0.5 | spawn download, then the product reads |
| sections (`sections/*.json?v=`) | 58 | 42 | 132 | 0.35 | spawn download, then the product reads |
| `/assets/*` (baked, bin, json, title art) | 43 | 30 | 26 | 2.8 | spawn download and world build |
| other shards' manifests (open plots) | 21 | 18 | 10 | 0.3 | grid assembly |
| bin, wasm, KTX2, image, tile, basis, fonts, … | 32 | 18 | 54 | 7.9 | spawn download |

Who issues them:

- **The spawn download, 419 files, one request each.** `src/game/boot/spawnDownload.ts` (`downloadSpawnManifest`) reads
  the boot list from `assets/spawn/<shard>-<flow>-<tier>-<hash>.json` (written by `scripts/app-build/entryTotals.ts`,
  bank in `index.html`). It runs 8 lanes, reads each body through `readContent` (`src/engine/boot/contentRead.ts`) and
  writes each response into Cache Storage. The set is 150 GLB, 94 JS, 78 blob JSON, 58 sections, 9 CSS, 9 bin and 21
  others: 64 MB raw, 20 MB on the wire.
- **Why each part is its own file:** the shardfile format (`scripts/build-shardfiles.mjs`) stores every blob under its
  own sha256 (`blobs/<kind>/<sha256>.<ext>`), one model or LOD per GLB and one section per JSON. That gives dedupe
  across shards and deploys and an exact cache key. Code is split by `codeSplitting.groups`
  (`scripts/app-build/controlChunks.ts`, in `vite.config.ts`) into 178 chunks, 108 of them used before control.
- **The packs already exist and are skipped.** I5 (iPhone downloads, 10-27) added 13 content-hashed packs to
  `shard.json` (`blobs/pack/<sha256>.pack`, 435 members, 31.5 MB). The page reads them only for a cache *miss*
  (`src/game/shardfile/packReads.ts`). Since the spawn download (10-29) fills the cache file by file first, the cold run
  made **0 pack requests**. On 10-27 the same entry made 206 requests.
- **The 761 re-reads.** After the download, the session reads the product again: `shard.json` → sections → blobs
  (`src/game/grid/products.ts`, `src/game/shardfile/product.ts`). Each read is a `fetch` that the worker answers from
  Cache Storage. Admission reads and checks a blob, releases its bytes (`releaseTransport`), and the model build reads
  it again (`'cache-or-fetch'`), so a GLB appears up to 3 times (11 s, 56 s and 67 s for the same URL).
- **The worker's install precache.** `src/engine/pwa/sw.js` `install` precaches `FILES`, which is every hashed
  `/assets/*-<8 hex>.*` in the bundle (`scripts/app-build/serviceWorker.ts`): 323 files, 96 MB raw, about 24 MB as
  served. Registration starts in the background on the first line of boot (`src/engine/boot/sw.ts`: *"its full
  precache can finish during cold entry"*). These requests come from the worker, so they are not in the page's list,
  but they share the phone's one link. The JS ones show up as the 81-byte revalidations: `vercel.json` gives
  content-hashed `/assets/*.js|css` `max-age=0, must-revalidate`, so the cache asks the server again for each of them.
- **Late reads:** 46 GLB and 24 `/assets/baked` files that are not in the spawn set, fetched while the world builds
  (65–90 s), and the control chunks' dynamic imports.

**Dependency depth (serial round trips):** tap → `index.html` → entry JS (its static imports are preloaded) → the spawn
list (inline in the HTML, no extra hop) → 419 files over 8 lanes, about 53 requests one after another in each lane →
`shard.json` → sections → blobs (from cache) → late world reads → control chunks. That is about 6 serial hops for the
whole boot, plus 53 in a row inside the bulk.

## Why 1,000 small files cost less than it looks, and where they still hurt

- At 10 Mb/s and 100 ms one round trip carries 125 KB (the bandwidth-delay product). The median boot file is far smaller,
  so one lane fetching one small file at a time leaves the link idle. **HTTP/2 fixes most of this**: all lanes share one
  connection, so 8 lanes of small files fill the link. The benchmark shows 8 lanes within 1.2 s of a pack (2.3 s at CPU 10×), and
  unlimited lanes within 0.7 s (1.7 s).
- **What a pack still saves:** (a) the dependency depth: 53 requests in a row per lane is at least 5.3 s of latency
  that only bandwidth hides, so it reappears on a link with more latency or a smaller set; (b) per-request CPU on the
  phone: a worker fetch event, a Cache Storage match and put, a JS stream reader and a progress paint for each of about
  1,200 requests, against 7; (c) the 761 re-reads, which become in-memory views of bytes the page already holds.
- **What a pack does not fix:** head-of-line blocking. HTTP/2 runs on one TCP connection, so a stalled connection holds
  every stream either way. The sibling page saw 1 KB files take 5–9 s on live. The bytes still set the floor.

## The design: 10 requests or fewer

| # | request | what | raw / wire (Driftwood, grid, phone) |
| --- | --- | --- | --- |
| 1 | `index.html` | the module bank with the pack index inline (as the spawn bank is today) | — |
| 2–3 | code | an entry chunk (title) and one game chunk; a third for what runs after control | 8.4 / 2.3 MB today in 103 files |
| 4 | `engine-<hash>.wspk` | shared by every shard: Rapier, Basis, grid seams, the strip mesh | 17.3 / 2.9 MB |
| 5–8 | `shard-<n>-<hash>.wspk` | the shard's product, cut into parts of at most 12 MB raw, in demand order | 36.8 / 11.4 MB |
| 9 | `tex-<hash>.wspk` | images and KTX2: already compressed, so the server never spends brotli on them | 1.7 / 1.7 MB |
| — | after control | the rest of the product, the other shards and the worker's precache, at low priority | — |

**Packer (prototype landed: `scripts/bulk-pack.mjs`).** It reads the build's own spawn manifest from a built tree,
checks every member against the manifest's sha256 and length, and groups the files into code, engine, shard and
texture parts. Each part is named by its own hash. Format (`scripts/bulk-pack-reader.mjs`): an 8-byte magic, a u32
header length, a JSON member table (path, offset, length, sha256), then the bodies on 16-byte boundaries, so a
`Float32Array` over a .bin member needs no copy. It is a plain committed script run after `entryTotals` (no Vite plugin
or virtual module, G799). Driftwood's 419 files pack into 7 parts in about 1 s. **Recommendation for the build:** don't
add a second pack format. Extend I5's `blobs/pack` (offset table in the index, raw bytes in the part) with 16-byte
alignment and a spawn-ordered pack set, so one reader serves both.

**Runtime reader.** One `fetch` per part, all at once. Members are cut from the stream as their bytes land (as
`src/engine/boot/pack.ts` `streamPack` did for the old boot packs), so the first models can start before the last part
arrives. Each member is a view into its part, and product reads (`firstPartyRead`) are answered from those views, so the
761 re-reads disappear. A part that fails (404 on a stale deploy, or offline) falls back to its members' loose URLs,
which stay deployed.

**Cache and service worker.** Store one Cache Storage entry per part (7 writes, not 419). Part names already match
`sw.js`'s immutable rule (`-<hex>.ext`), so the worker serves a cached part with no network. An update downloads only the
parts whose hash changed. A one-model edit costs one shard part (up to 12 MB raw, about 4 MB on the wire), not the set.
To make that smaller still: when most of a changed part's members are already cached under their own hashes, fetch only
the missing members loose. Code parts change with every app build, so keep them small and separate from data.

**Vercel.** The edge compresses every type except images on the fly (measured in the cold run: GLB 0.30, JSON 0.22,
.bin 0.75 of decoded size). A `.wspk` served as `application/octet-stream` gets the same brotli, at about q3–q5:
packed 18.4 MB at q5 against 18.6 MB loose. Precompressed brotli 11 would be 16.4 MB (−3.6 MB, about −2.9 s at
10 Mb/s), but Vercel serves static files with its own on-the-fly encoding. Shipping a `.br` with a
`Content-Encoding: br` header rule is unproven here and needs one preview deploy to check. Keep parts at 12 MB raw or
less: a stalled big response costs more, and per-file size limits never come near.

**Memory on the phone.** The whole Driftwood set is 64 MB raw, against the 1.8 GB loading cap. The rule: a member view
keeps its whole part alive. Drop each part when its last member has been decoded (GLB parsed, texture uploaded,
section parsed into objects), and never copy a member out except for long-lived small rows. Peak is one copy of the
parts plus what is being decoded, which is less than today's body, Cache Storage clone and decoded copy for each file.

**JS chunk count: 178 (108 before control) → 3.** Collapse `controlChunkGroups` into title, game and after-control
groups. Every chunk is content-hashed, so make `/assets/*.js|css` `immutable` in `vercel.json` and the 81-byte
revalidations go away. Dynamic `import()` of one big game chunk replaces the dependency waves of today's chunk graph.

## Measured

`scripts/bulk-pack-bench.mjs`: a self-signed HTTPS / HTTP/2 Node server (brotli like Vercel's edge) and a muted headless
Chromium as the iPhone 16 Pro, at the `phone` preset network (100 ms latency, 10 Mb/s down). No engine. Driftwood
grid/phone spawn set of `d4d4b17` (419 files, 64.2 MB raw). Each path runs cold in a fresh context, 2 reps, median shown.
"Ready" adds the session's re-read of every file from Cache Storage (loose) or the member views (pack).

| CPU | path | requests | wire MB | download s | ready s |
| --- | --- | --- | --- | --- | --- |
| 1× | `loose-8`: today's spawn download (8 lanes, a Cache Storage put each) | 420 | 20.35 | 17.3 | 17.4 |
| 1× | `loose-all`: every file at once (all HTTP/2 multiplexing can buy) | 420 | 20.35 | 16.9 | 16.9 |
| 1× | `loose-8+sw`: today's path beside the worker's install precache on one link | 744 | 44.67 | 36.4 | **36.5** |
| 1× | `pack`: 7 parts at once, one put each, members as views | **8** | 19.99 | 16.2 | **16.2** |
| 10× | `loose-8` | 420 | 20.35 | 17.6 | 18.7 |
| 10× | `loose-all` | 420 | 20.35 | 16.9 | 18.1 |
| 10× | `loose-8+sw` | 744 | 44.67 | 36.6 | **37.7** |
| 10× | `pack` | **8** | 19.99 | 16.4 | **16.4** |

The floor for 20 MB at 10 Mb/s is 16.0 s, and the pack lands within 0.4 s of it. The pack saves 1.2 s at CPU 1× and
2.3 s at CPU 10×. That gain grows with CPU throttle because the loose path spends main-thread time per file. The first-visit precache costs
**+19 s** on one link. That is an upper bound by about 2 s: the bench downloads all of `FILES` again, and the real
worker's `force-cache` reads find the JS chunks the page already loaded in the HTTP cache (about 2.5 MB). Harness note: in this table's run, the largest part was sometimes reset (3 of 16 runs, each retried once). The cause
was Node's 10 MB HTTP/2 session-memory default, not the browser. With `maxSessionMemory` raised, the pack path reran
at 16.3 s (CPU 1×) and 16.7 s (CPU 10×) with no retries.

Bytes (`scripts/bulk-pack.mjs --brotli q`, the same 419 files):

| brotli | loose (one file at a time) | packed (7 parts) | change |
| --- | --- | --- | --- |
| q3 (about what the edge serves; the manifest says 19.98 MB) | 20.24 MB | 19.98 MB | −1.3 % |
| q5 | 18.60 MB | 18.38 MB | −1.2 % |
| q11 (precompressed) | 16.98 MB | 16.40 MB | −3.4 % (−18 % against today's wire) |

Run it again:

```
node scripts/bulk-pack.mjs --dist <built dist> --out tmp/bulk-download/packs-q3 --brotli 3
scripts/browser-lane.sh node scripts/bulk-pack-bench.mjs --tree <built dist> --packs tmp/bulk-download/packs-q3/driftwood-isle-grid-phone --cpu 1,10
```

`--tree` needs `sw-files.json` (the `FILES` list of the build's `sw-core/*.js`) for the `loose-8+sw` path.

## Rows for the builder (product changes, not landed here)

1. **BP1: no first-visit precache before control.** Start the `sw.js` install precache after control, or list only the
   code chunks in `FILES` and leave the six `grid-strip-mesh` bins the boot does not use to the background download
   (`scripts/app-build/serviceWorker.ts`, `src/engine/boot/sw.ts`). Measured on one link: +19 s (36.5 s against 17.4 s). Also mark the
   content-hashed `/assets/*.js|css` `immutable` in `vercel.json`. Risk: the warm second visit (039d: deferring install
   until control left the next document uncontrolled, Home 13.8 → 19.6 s). So defer only the *bodies* past control,
   not the registration.
2. **BP2: the spawn pack in the build.** Run the packer (extending I5's `blobs/pack` with alignment and spawn order)
   after `entryTotals` writes the spawn manifests, and put the part list in the module bank. Part sizes ≤ 12 MB raw,
   with code, engine, shard and texture kept apart. Check `scripts/repo-size.mjs` and the built-product ceilings for the
   new outputs.
3. **BP3: the reader in `spawnDownload.ts`.** Fetch every part at once, cut members out as they stream, one Cache Storage
   put per part, loose-URL fallback for a failed part, progress counted by member. Product reads (`firstPartyRead`,
   `products.ts`, `product.ts`) take members from memory, so the re-reads go. Risk: the part-retention rule above and
   iOS Cache Storage eviction of one big entry (fall back to the loose URLs).
4. **BP4: updates.** The worker treats parts as immutable (they already match its rule). Add the member-level delta (fetch
   only the missing members of a changed part) when a part is mostly cached. Measure one real deploy's download.
5. **BP5: three JS chunks before control** (`controlChunkGroups`): title, game and after control. Re-measure the chunk
   report and the title's first paint. Risk: the title must not wait for the game chunk.
6. **BP6: precompressed brotli 11**, only if one preview deploy shows Vercel serving a `.br` part with
   `Content-Encoding: br` intact (−3.6 MB). Otherwise skip it (the sibling's DS5 is the same row).

Rows 2–3 are the sibling's DS2; build them once. DS1 (a ≤ 5.5 MB set before control) is what gets the download to 5 s.
This page's rows make that set arrive in about 8 requests.
