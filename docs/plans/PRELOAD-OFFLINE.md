# Everything at the loading bar, and offline

**State:** `in progress` 2026-09-23 — the user's picks are in (E44); building: rows 1–6 (preload agent).

The user, 2026-09-23: *"all the audio files should just be preloaded and pre downloaded and I should open the
download budget higher in the loading menu … In fact everything should be loaded at the loading bar and the PWA
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

## How it gets built

| # | checkpoint | status |
|---|---|---|
| 1 | Audit: every fetch a shard makes after "playable" (Playwright request log, both shards, all menus / pickers / quests / explore) | open |
| 2 | Boot manifest: new byte source(s) for audio (all music + all SFX sets) and every file from the audit, declared per shard; a SETUP step for audio decode | open |
| 3 | Music.ts / Audio.ts: take their buffers from the boot (decoded in the bar), no lazy fetches; switching style / SFX set decodes from the cache | open |
| 4 | Service worker: precache the app shell + the launched shard's declared files + all audio on the first complete load; cache-first for them after; versioned so a deploy replaces stale files | open |
| 5 | Verify: request log after "playable" is empty; offline reload of the same shard plays with sound; the loading bar's DOWNLOAD total shows the new size (phone + desktop) | open |
| 6 | LOAD-PERF: bench.budget.json re-set for the new cold bytes; L1 / P5 re-targeted to the cached launch (coordinate with the LOAD-PERF owner) | open |
