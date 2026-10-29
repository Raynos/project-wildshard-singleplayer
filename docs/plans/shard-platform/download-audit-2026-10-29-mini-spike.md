# Download audit, 2026-10-29 (mini spike)

Jake, 14:09 Cancun: *"All this downloading shit feels super broken, right? Like, why are we downloading 51.2 megabytes
for every short file? Like, what the fuck is going on, bro? Like, what the flying fuck? Spin up a mini agent to [audit],
like, what the fuck is going on with the downloads?"*

Feeds [qa-2026-10-29-2](qa-2026-10-29-2-mini-plan.md) QB5 (the bar) and [reload-simplify](reload-simplify-mini-plan.md)
RL1 / RL7 / RL8 (the cache). Measured on live `8621318d9-mvtvd1tf` (Jake's build) with `scripts/phone-loading/main.ts
--live --preset desktop --flow select:<slug>`. That is SHARD SELECT, then ENTER WORLD, as an iPhone 16 Pro with the phone tier, Developer on, muted,
one persistent context per shard (cold = empty storage, warm = second load of the same build). Chromium for all six, plus
WebKit for Driftwood and Pine Hollow. `main` already holds `f663308101` (no checksum on URL / content-cache reads) and
`5ce370c3ee` (`ignoreVary`, versioned prefetch index); neither is on live yet.

## Answer in one line

**Warm loads download nothing.** Chromium warm network is 0.03–0.05 MB on every shard (`/`, `version.json`,
telemetry). The "51.2 MB" is the card's **content** count (declared files done, from wire *or* cache), shown as if it
were a download, against a **baked total that is wrong**: whole-product phone tier for Pine / Nine / Nalati, plus boot
extras for Sky / Dunes, and missing runtime-declared public files for Driftwood. Phone warm slowness (6.2 s "content cache
get", 5–8 s admission) is the cache *read* path, not traffic. Desktop does not reproduce it (warm admission 0.12–0.24 s).

## Per shard (Chromium, phone tier; MB; s from tap to control)

| Shard | Cold network (wire / body) | Cold card | Cold load · admission | Warm network | Warm card (content · net · "offline cache") | Warm load · admission |
|---|---|---|---|---|---|---|
| Driftwood | 11.5 / 19.8 | 53.2 of 52.0 · 8.3 net | 9.7 · 0.40 | 0.03 | 53.2 of **52.0** · 0.00 · 60.0 | 4.7 · 0.17 |
| Pine Hollow | 87.6 / 114.3 | 60.5 of 101.3 · 77.4 net | 16.2 · 0.99 | 0.05 | 60.4 of **101.3** · 0.02 · 108.5 | 9.3 · 0.16 |
| Sky Reach | 49.2 / 66.6 | 45.5 of 54.1 · 255/277 files | 15.2 · 2.70 | 0.03 | 45.5 of **54.1** · 0.01 · 91.1 | 4.7 · 0.21 |
| Signal Dunes | 11.8 / 17.4 | 19.6 of 23.9 · 224/225 | 5.5 · 0.78 | 0.03 | 19.5 of **23.9** · 0.00 · 24.1 | 4.3 · 1.35 |
| Nine Dragon | 26.0 / 107.3 | 50.7 of 170.4 · 21.1 net | 13.9 · 0.38 | 0.05 | 50.7 of **170.4** · 0.00 · 62.0 | 6.4 · 0.12 |
| Nalati | 67.0 / 91.7 | 59.9 of 96.8 · 57.4 net | 14.0 · 0.94 | 0.04 | 59.9 of **96.8** · 0.01 · 80.9 | 6.6 · 0.24 |

Jake's phone numbers match these cards to ±0.5 MB, so the card he saw on warm loads was cache, not wire. Warm requests
are all `fromServiceWorker` (no worker-originated fetch) plus Cache Storage reads that make no request at all.
WebKit (Driftwood / Pine): cold 7.4 / 16.1 s, warm 5.9 / 11.0 s; same cards; see causes 4–5.

## Causes

1. **Denominator = the whole phone-tier product, not the entry's reads.** `scripts/app-build/entryTotals.ts:67` adds
   `products[prefix][tier + 2]`. That is `bootProducts.ts` `productDownloadTotal`, the sum of *every* file's `compressed` size
   for the tier (incl. streamed / later tiles, non-entry audio, inactive variants). Then it adds every module group
   (~6.5–7.5 MB) and rapier, pickups and boot tables (~4 MB). Over-counted: Pine +40.9 MB (phone product 89.8, the entry
   declares 60.4 in all), Nine +119.7 (phone product 159.8), Nalati +36.9 (85.5). Sky +8.6 and Dunes +4.3 are mostly
   the boot extras `/assets/boot-far-reach-*.json` (8.8 MB) and `boot-sunscar-dunes-*.json` (5.6 MB) at
   `entryTotals.ts:65-66`, never fully declared or read.
2. **Driftwood under-counts (53.2 of 52.0) because runtime declares files the bake never lists.** The bank has no
   `/assets/music`, `/assets/sfx`, `basis_transcoder`, `/assets/lut`, `/assets/models` rows. `DownloadAccounting.declare`
   (`src/engine/boot/download.ts:115`) still counts them, and `loadingDownloadText.ts:37` prints `declaredDoneBytes`
   over the fixed `expectedBytes`, so the numerator passes the total.
3. **Declared files that never complete.** Sky ends at 255 / 277 files (4.9 MB pending, cold *and* warm). Dunes ends at
   224 / 225 with "0.49 MB awaiting file index". The card can't reach 100 % on these shards even when the load is done.
4. **SW crashes on a null-body status (WebKit).** `src/engine/pwa/sw.js:838` (HEAD; `:807` on live) builds
   `new Response(new Blob(chunks), {status: res.status})` for whole-code fetches. WebKit revalidates the
   `contentHash.worker` script with a 304, so `respondWith` throws *"Response cannot have a body with the given status"*
   and the hash worker fails to start. Hashing falls back to the page (`src/engine/boot/contentHash.ts:58`). Seen on both
   WebKit cold loads.
5. **Cache reads were checksummed on live.** `src/engine/boot/contentCache.ts:188` at `8621318d9` SHA-256s every
   content-cache `get`, and `src/game/shardfile/cachedTransport.ts:41` hashes every URL-cache hit. That is G881's ban;
   `f663308101` removed both on `main` (the write path still hashes at `contentCache.ts:247`). Desktop warm admission
   stays 0.1–0.2 s with the hash, so the phone's 5–8 s needs the Simulator trace (RL1). Prime suspects: iOS serializing
   Cache Storage per origin behind the read-ahead's / `WARM_CODE` puts, plus cause 4's page-side hashing.
6. **"Offline cache" double-counts.** Warm Pine shows 108.5 MB cache for 60.4 MB content: SW `ws-cache` receipts (incl.
   7.9 MB JS, 3.3 MB rapier, basis) plus content-cache reads of the same members (`download.ts:208-211` + `:172`).
7. **WebKit warm: ~4.2 MB of the new document's modules show as network.** These are 20 chunks (`entry-3`,
   `control-*-session` 1.0 + 1.6 MB, fonts) with `fromServiceWorker` false and full transfer sizes. Playwright WebKit can't tell
   HTTP cache from wire, so check it on the Simulator before fixing.
8. **Nine's 4.4 s freeze at "Audio · music + sound effects" is a synchronous shader link.** Cold Chromium CPU profile:
   a 1.8 s long task right after the Audio row opens (Audio itself takes 1 ms). 1.6 s of it is self time in three's
   `getUniforms` (WebGLProgram uniform reflection, blocking on link), via `onUpdateProgram` → `uniformsList` in
   `late-engineNodesHandler-compile`, inside the first `renderBufferDirect`. The program was not pre-linked by the
   Shaders step. The card names the last-opened row, so it reads "Audio". Warm: 0.4 s.
9. **Title read-ahead "129.0 / 129.0 MB".** `mainMenu.ts:164` targets the grid home and the last chosen shard
   (`titlePrefetchTargets`). On the phone tier that is Driftwood (phone product 41.0) + Pine Hollow (89.8) ≈ 130.8 MB
   less shared hashes. It stores whole phone-tier products, so Pine's 89.8 includes ~40 MB its entry never reads. A later
   load reuses them: same `ws-content-v0` hash keys. The index key mismatch (no `?v=`) is fixed by `5ce370c3ee`.

## Rows

| Row | What | Fix / done when | Lane | Size |
|---|---|---|---|---|
| DA-1 → QB5 | Denominator = entry read set | Bake `entryTotals` from the same `entryFileSteps` selection `writeEntryDownloads` uses (required ∧ active for the tier), plus the public files runtime declares (audio, basis, LUT, models). Drop `products[tier+2]` and the undeclared boot extras. Done when all six shards, cold and warm, end at exactly 100 % with numerator = denominator. | folded into MF4 | S |
| DA-2 → QB5 | Close the never-completing declarations | Sky's 22 files / 4.9 MB and Dunes' 0.49 MB "awaiting file index" either complete or are never declared. Done when both end at N / N files. | folded into MF4 | S |
| DA-3 → QB5 / RL9 | Say cache, not download | One line, e.g. "52.0 MB · 51.9 MB from cache"; the cache figure counts each content byte once (cause 6). Done when warm Pine's cache figure is ≤ its content total. | folded into MF4 | S |
| DA-4 → RL7 | SW null-body crash | `sw.js:838`: return `res` untouched for 101 / 103 / 204 / 205 / 304 (or `body === null`). Done when WebKit cold loads log no `respondWith` error and `contentHash.worker` starts. | folded into MF1 | S |
| DA-5 → RL1 | Phone cache-read stall | On the iOS 27 Simulator on `main` (has `f663308101`): time each `Content cache get`, Cache Storage waits vs read-ahead puts; fix the top cause, and drop the write-path hash too (G881). Bar = QB9. | folded into MF1 / MF3 | M |
| DA-6 → RL7 | WebKit warm module traffic | Simulator check of cause 7. If it's real wire, route the new document's modulepreloads through the SW cache. Done when warm network ≤ 0.1 MB on WebKit. | folded into MF1 | S |
| DA-7 (new) | Nine first-frame link freeze | Pre-link every program the first render uses in the Shaders step (or wait on `COMPLETION_STATUS_KHR` before the first `render`). Open a "First frame" row so the card never blames Audio. Done when Nine cold has no long task > 200 ms after Shaders on Chromium, and the Simulator shows no gap > 0.5 s. | folded into MF5 | S |
