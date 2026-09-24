# Everything at the loading bar, and offline

**State:** `archived` 2026-09-23 (finished 2026-09-23) — rows 1–6 built and live in `e391e58` (build `e391e58-mudyi4vi`): 0 requests after "playable" on both shards (phone + desktop, pickers included), offline reload plays with stems + samples on both shards, DOWNLOAD phone 14.8 MB Driftwood / 23.5 MB Pine Hollow, bench.budget.json re-set (E44). Leftovers: none.

The user, 2026-09-23: *"all the audio files should just be preloaded and pre downloaded and I should open the download budget higher in the loading menu … In fact everything should be loaded at the loading bar and the PWA
should work offline. No cheating and background loading."*

## Decisions (the user's)

| question | pick |
|---|---|
| scope of one load | **the shard being launched + all audio**: every file that shard's play can ask for, plus all 3 music styles and every SFX set. The other shard loads at its own loading bar the first time it is visited. |
| audio decode | **download everything, decode the selected**: every audio file is fetched and cached during the bar; the selected music style and SFX set are decoded before "playable". Switching style later decodes from the local cache (no network). |
| load budget | **completeness wins over a small first launch**: the cold-byte target of LOAD-PERF P5 (~10 MB) is lifted for this; L1 / P5 get re-targeted to the second (cached) launch. |

## What "no cheating" means here

- After the bar reaches 100 % and the game is playable, **no network request** is made for the shard being played:
  not for audio, not for textures, models, JSON, fonts, art. Anything that loaded lazily after "playable" today
  (the music stems 1.2 s after `play()`, `audio.loadSamples()` after entering, any other deferred fetch) moves
  into the bar, counted in DOWNLOAD like every other byte, with its decode counted in SETUP.
- AudioBuffers are decoded during the bar without an AudioContext (an `OfflineAudioContext` decodes; the buffers
  play in the live context made on the first gesture).
- **Offline:** after one complete load, the same shard reloads and plays with the network off: the service worker
  serves the app shell, code, and every file the bar declared. The same is true of all audio.

## How it got built

| # | checkpoint | status |
|---|---|---|
| 1 | Audit: every fetch a shard makes after "playable" (Playwright request log, both shards, all menus / pickers / quests / explore) | **done** — see "Audit" below; 355 / 347 requests after the bar → 0 |
| 2 | Boot manifest: new byte source(s) for audio (all music + all SFX sets) and every file from the audit, declared per shard; a SETUP step for audio decode | **done** `e391e58` — sources `art` · `music` · `sfx`; steps `menu` (title art, lazy UI chunks) and `audio` (last, weight 3) |
| 3 | Music.ts / Audio.ts: take their buffers from the boot (decoded in the bar), no lazy fetches; switching style / SFX set decodes from the cache | **done** `e391e58` — OfflineAudioContext(2, 1, 48000); `Music.useBank`, `Audio.useSamples`; Cache Storage on a switch, spinner past 300 ms |
| 4 | Service worker: precache the app shell + the launched shard's declared files + all audio on the first complete load; cache-first for them after; versioned so a deploy replaces stale files | **done** `e391e58` — fonts precached (`__FONTS__`), everything declared cached as the bar downloads it, offline answers without a failing fetch; `.m4a` immutable on the host |
| 5 | Verify: request log after "playable" is empty; offline reload of the same shard plays with sound; the loading bar's DOWNLOAD total shows the new size (phone + desktop) | **done** — below (local preview of the gated tree and live `e391e58`) |
| 6 | LOAD-PERF: bench.budget.json re-set for the new cold bytes; L1 / P5 re-targeted to the cached launch | **done** — `bench.budget.json` rows carry a `why`; dated line in project/archive/2026-09-22-load-perf.md |

## Audit (row 1) — what fetched after "playable" on `015861d`, and where it went

Headless Chromium (Playwright, page + service-worker requests), tier=phone, both shards; exercised: the title's first
gesture, ENTER, combat (4 shots, reload, combat state, stings, hurt), a dive, the shrine, death sting, every pause tab,
every music style and SFX set in the pickers, exit-to-menu, the title swipe, re-enter, EXPLORE (Driftwood).

| what | when | now |
|---|---|---|
| `music/<style>/music.json` + title + 3 stings | 1.2 s after the title's first gesture (`STEM_DELAY_MS`) | manifest compiled into the bundle (`src/boot/audio.generated.ts`); files downloaded + decoded in the bar (`audio` step) |
| the shard slot's calm + tension stems | after ENTER | decoded in the bar |
| the title stem again / the slot again | exit-to-menu / re-enter (the loader forgot them) | resident for the page's life |
| `sfx/<set>/sfx.json` + ~73 files of the selected set | after ENTER (`audio.loadSamples()`) | decoded in the bar |
| every other style (6 files) / set (36–73 files) | on a picker switch | downloaded in the bar; a switch decodes from Cache Storage (no request at all) |
| the neighbour shards' hero stills + thumbnails | title swipe | `art` source in the bar; the cards point at in-memory blob: copies |
| `Explore-*.js` + its two panel images | EXPLORE WORLD | imported / decoded in the `menu` step |
| `Feedback-*.js` (review notes) | on a note | imported in the `menu` step |
| exempt | — | `/version.json` (the build pill, skipped offline) and the review inbox POST |

Result: **0 requests after playable** — Driftwood and Pine Hollow, phone and desktop tiers, pickers included.

## Verify (row 5)

| | Driftwood Isle | Pine Hollow |
|---|---|---|
| DOWNLOAD label, phone tier | **14.8 MB · 150 files** (was 0.96 MB, the boot pack) | **23.5 MB · 221 files** (was 9.6 MB) |
| DOWNLOAD label, desktop tier | **14.9 MB · 150 files** (was ~1.0 MB) | **79.5 MB · 221 files** (was ~65.6 MB) |
| requests after playable (online) | 0 | 0 |
| offline reload (`context.setOffline(true)`) | playable 1.0 s, stems (piano / island) + sa3-medium samples, 0 failed, 0 console errors; every style / set switch works offline | playable 1.2 s, stems (piano / pine) + samples, 0 failed, 0 errors; switches work |
| live `e391e58` | 0 after playable; offline reload 0 failed | 0 after playable |

The added bytes are the same on every shard: music 9.0 MB (3 styles × 8 files) + SFX 2.9 MB (2 sets, 109 files) +
card art 2.0 MB (+ 0.04 MB Explore art on Driftwood).

bench-load, 4× CPU, 390×844, `tier=phone&skipintro=1`, vite preview on this host (the GPU job running), before
`015861d` → after (the E44 tree):

| | Driftwood before → after | Pine Hollow before → after |
|---|---|---|
| wifi cold | 4.20 → 5.80 s (2.08 → 16.11 MB) | 5.50 → 8.46 s (10.76 → 24.75 MB) |
| 4G cold | 5.65 → 19.45 s | 13.20 → 27.59 s |
| wifi warm (cached) | 3.08 → 3.28 s | 3.88 → 3.78 s |
| 4G warm (cached) | 3.08 → 3.84 s | 3.77 → 4.28 s |
| requests, cold | 13 → 161 | 13 → 156 |

4G cold is the extra ~14 MB at 9 Mbit/s (bandwidth-bound: the art + audio queue after the boot pack, 16 in flight,
while the shaders compile). Warm transfer stays 0 bytes.
