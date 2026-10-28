# Bulk downloads, 2026-10-28

Jake, 2026-10-28: *"how can we make the downloads reliable and fast? How can we do bulk downloads? I feel like we're
downloading way too many things ... we should be asking the server for a whole bunch of things, and not doing 250
individual downloads."* A read-only review by the plan agent's subagent. No code. Sources: the live `9364930c3`
recordings in `tmp/loading-freeze/` (each run's `requests.tsv`), `out/<slug>/shard.json`, `src/engine/pwa/sw.js`,
`src/game/shardfile/clientAssets.ts`, the [iPhone downloads](../../../../project/archive/2026-10-28-iphone-downloads.md) plan (I5),
[js-payload](../../../../project/archive/2026-10-27-js-payload.md) and the
[loading](../../../../project/archive/2026-10-28-loading.md) archives.

## The short answer

- **The "527 files" counter is not 527 downloads.** It counts pack members. Driftwood's product already ships as
  13 packs (≤ 4 MB, 445 members: all 61 sections and 380 of its 396 files) plus 16 big files (I5).
- **We still make ~266 requests from tap to control on a Driftwood entry, and ~356 on Infinite Wildshard.** Most of
  them are not the shard: **166–234 are JS modules**, one fetch each through the service worker, even though their
  bytes already arrived in one 2.16 MB code pack.
- **Then 97–221 more right after control**: 91 sound files one at a time, and 140 section files of the neighbour
  shards one at a time, though every one of them is already in a pack.
- **Packs are read in pieces.** Each of Driftwood's three 2.3–4.2 MB packs is fetched as 5–7 separate byte ranges.
  That is the 18.6 s hang (curl got each whole pack in 0.5 s).
- **Bytes stay the floor.** Fewer requests saves the per-request cost and removes the hang classes; it does not make
  30.8 MB (Driftwood's before-control ratchet, G821) arrive faster than the radio allows.

## Numbers (live `9364930c3`, cold, desktop browsers emulating the phone)

| What | Driftwood select (WebKit) | Infinite Wildshard (Chromium) |
|---|---:|---:|
| Loading counter | 531 files / 55.5 MB | 605 files / 68.4 MB |
| Requests, tap → control | **266** | **356** |
| · JS modules (via SW) | 166 | 234 |
| · pack reads (byte ranges) | 24 for 13 packs | 22 |
| · GLB / bin / wasm / wtt | 25 / 4 / 4 / 1 | 37 / 5 / 4 / 0 |
| · JSON, sections, fonts, images, audio, API | 42 | 54 |
| Under 64 KB (where size known) | 30 of 83, + ~all 166 JS | 37 of 96, + ~all 234 JS |
| Most in flight at once | 46 | 60 |
| Request waves after the first burst | ~10 | ~8 |
| Tap → control (desktop) | 19.8 s | 11.1 s |
| Requests after control | 97 (91 sounds, 3.6 MB) | 221 (140 sections, 46 packs) |
| Same pack fetched again | 3 packs × 5–7 ranges | 3 packs × 5–7 ranges |

Driftwood's product (`out/driftwood-isle/shard.json`): 396 files, 78.5 MB all tiers; 13 packs (0.7–4.2 MB, 32.3 MB,
445 members incl. all 61 sections); 16 unpacked files, all ≥ 64 KB (47.4 MB). Descriptor 990 KB raw, 124 KB gzip.
The JS code pack: 2.16 MB wire, 6.88 MB decoded, ~234 modules (~9 KB each on the wire).

## What one request costs on the phone

Desktop numbers: a JS module served **from the SW cache** takes p50 10 ms but p90 120–250 ms (366 of them on a warm
entry add up to 19–23 s of request time). Each product file on the network path does: SW fetch event → network → the
SW buffers the **whole** body → `cache.put` into `ws-static` → page → SHA-256 → a second `cache.put` into
`ws-content-v0` (1,906 entries after one cold run). The iPhone is ~3–5× slower and throttles.

Rough model (estimates, not a phone reading): ~10–25 ms of serial SW and cache work per small file, plus one round
trip (60–120 ms on LTE) per wave. **500 small files: 5–12 s of fixed cost. 10 packs: under 0.5 s, plus 2–3 waves.**
The bytes are the same either way: 30.8 MB is ~5 s at 50 Mb/s and ~12 s at 20 Mb/s.

## Why it is slow and unreliable today

1. **No time limits** on SW downloads (`sw.js` fetchWhole/networkFirst, `codePack.ts` after `started`): one stuck
   transfer holds a loading step forever. **G830** (the Codex lane, in flight) adds per-attempt stall limits. Not
   redone here.
2. **Too many requests through one SW thread.** Every request, cached or not, is a fetch event plus a
   `cache.match` on one worker. JS is the worst case: one pack download, then 166–234 module fetches.
3. **Packs read as ranges, in waves.** `readPacked` reads only the members demanded so far. Each new wave asks for
   another range of the same pack. A 206 can't be cached by the SW, and 5–7 overlapping requests to one URL run into
   the browser HTTP-cache transaction problem that `fetchAttempt`'s own comment describes ("a stuck HTTP-cache
   transaction"). This is the most likely cause of the 18.6 s hang; it has not been proven.
4. **Waterfalls.** Descriptor → sections → files → GLBs → decode → next ring is an await chain, so the starts come in
   ~10 bursts after the tap. Each burst pays a full round trip and the SW's queue again.
5. **Bursts with no cap.** 46–60 requests in flight before control and 94 at the sound burst, all on one HTTP/2
   connection. One slow stream or a radio hand-over stalls all of them together.
6. **Double storage, network-first.** `/shardfiles/**` matches no SW route, so it falls to `networkFirst(STATIC)`
   and every product file is written twice (`ws-static` and `ws-content-v0`). The page's own store saves the warm
   case (0 own-product requests warm, I5), but the cold case pays both writes.
7. **Whole-body buffering in the SW** (`fetchAttempt`): the page sees no bytes until a file is complete. Progress
   freezes on big files and the bytes sit in memory twice.

## Proposed design (plain files, plain scripts, no Vite plugin)

- **Units are packs, not files.** The product step (`scripts/build-shardfiles.mjs`, I5's pack writer) packs by
  *when it is needed*: one pack per loading phase (critical, spawn ring, ring 1, late), plus an audio bank. Each pack
  is content-hashed `blobs/pack/<sha256>.pack` with an index of `{hash, offset, bytes}` in the descriptor (today's
  format). GLBs over ~1 MB stay their own files.
- **Read a pack whole, once.** One GET per pack, verified by its hash, members sliced in memory. No ranges, except to
  resume a broken download of a big pack.
- **The SW caches packs, not members.** `/shardfiles/*/blobs/**` is cache-first in one immutable cache, with one put
  per pack. Members are found through the index, with no 2,000-entry content cache. An update changes the hash of
  only the packs whose members changed. Unchanged packs stay cached and old ones are deleted by name.
- **JS in a handful of chunks**, not 234: coarser `controlChunkGroups` (startup / session / shard / late) in the
  existing Rolldown config. That is an output setting, not a plugin, so it is inside G799.
- **Transport rules.** At most 6 network downloads in flight (and 2 after control). A per-attempt stall limit (G830).
  Up to 3 retries at 0.5 / 1.5 / 4 s with jitter and `cache: 'reload'`. An overall step deadline that shows Retry
  instead of a frozen bar. Integrity: a SHA-256 per pack (already in the format), checked off the main thread.

**Driftwood entry after the change:** about **15–25 requests before control** (descriptor, 3–5 phase packs, ~5
big GLBs, 3–5 JS chunks, wasm, fonts) and **≤ 10 after** (late packs, one audio bank), down from 266 + 97. Expect
**~2–4 s less on a cold phone entry**, and no hang from a stuck range or a stuck module. The 30.8 MB transfer remains.

## What fits now, and what does not

### (a) Small reliable wins now (damage-list candidates)

| # | Win | Requests saved | Effort |
|---|---|---:|---|
| B1 | `readPacked` reads each pack whole, once, shared across waves (≤ 4 MB) | 24 → 13; no range hang | S |
| B2 | Grid neighbours read their sections through their packs (I5.3 path) | 140 → ~10 after control | S |
| B3 | Sound bank: the 91 SFX/music `.m4a` as one pack, or decoded on first use | 91 → 1–3 after control | S–M |
| B4 | SW: `/shardfiles/*/blobs/**` cache-first, no `ws-static` copy, ≤ 6 downloads in flight | 1 put per file, not 2 | S |
| B5 | After G830: retry with backoff + jitter; a step deadline shows Retry | hangs become retries | S |
| B6 | Coarser JS chunk groups (weighed against js-payload's lazy loads) | 166–234 → ~10–20 | M |

B1–B5 need no format change. B6 needs a JS-size reading at build time (I12's guard) so lazy code stays lazy.
Together on Driftwood: before control ~266 → ~105 (B1–B5 alone: ~255), after control 97 → ~8.

### (b) For Jake's next plan (one-world): a note only, no plan drafted

G828 and G831 close loading at the best this engine can do. Phase packs, packs cached as the unit with no
per-member store, one streamed descriptor per ring, and ≤ 25 requests per entry need the loader to stop running
per-file admission (its hash, pin and put per member). That is the one-world loader's job: design it around ring
bundles from the start rather than retrofitting it here.
