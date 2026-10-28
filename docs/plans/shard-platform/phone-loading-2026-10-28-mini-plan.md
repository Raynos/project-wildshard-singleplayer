# Phone-speed loading 10-28: where the minute goes, and the Codex rows that cut it

**State:** `open` 2026-10-28 ~17:40 Cancun. Written by a wildshard-v subagent for wildshard-new, which hands the rows to
lanes. Jake (10-28): on his iPhone, entering the game takes a minute or more and the loading screen "is still
retarded"; the ~16 s desktop recordings don't show his phone. Recorded on live `a6701db71-mvsi9z8w`; numbers and
labelled sheets: [art/loading/round-1-phone-speed](../../../art/loading/round-1-phone-speed/numbers.md).
Archives with SHARD-PLATFORM (close-out CO8).

## Summary

1. At phone speed, a cold INFINITE WILDSHARD entry takes **53.3 s** from the tap (≈ 55 s from opening the app); a warm
   one takes **27.6 s**. The warm entry is almost all main-thread CPU: 25.9 of its 27.6 s.
2. Cold costs ~26 s more because the 28 MB download runs **after** the CPU work, not alongside it. Driftwood's first
   pack is only requested 12 s after the tap, and the link is idle for the last 15 s.
3. **Home region** is 62 % of the cold entry (32.9 s): 12.7 s product admission, then 20.7 s of building, ~10 s of it
   waiting for one GLB at a time.
4. The loading screen never freezes in Chromium (no frame gap > 1 s), but it doesn't say what it's doing. For 40 s it
   reads "step 13 / 22 · Final activation", the download % drops (100 → 44), and the wait line shows hashes.
5. Overlapping the download with the work (PL1–PL3) should bring cold to ≈ 35 s. The CPU rows (PL4–PL8) should bring
   warm to ≈ 20 s. Under that floor is G828's one-world loader.

## Throttle settings (Chromium as iPhone 16 Pro, 402×874, DPR 3, phone tier, muted, `browser-lane.sh`)

- **The flow's profile:** `Emulation.setCPUThrottlingRate` **10×** on the page, checked in the page (a 2e7-iteration
  loop took 104–108 ms against 10.6 ms unthrottled). `Network.emulateNetworkConditions` **10 Mb/s down, 2 Mb/s up,
  100 ms RTT** ("hotel wifi") on the page *and* the service worker, through raw-CDP auto-attach, as in
  `scripts/bench-load.mjs`. Chrome can't CPU-throttle the worker ("only supported for pages").
- Two lighter profiles for scale: 8× with the same link, 47.3 s cold / 22.9 s warm; **6× on LTE (20 / 5 Mb/s, 60 ms),
  35.0 s cold**.
- WebKit check: iOS Simulator Safari (iPhone 17 Pro) at Mac speed, `scripts/sim-grid-entry.mjs --base=<live>`: 9.8 s
  cold, 7.3 s warm. The steps rank the same way: Home region, then modules, then shaders.

## Per step, phone profile (the loading screen's own row times, s)

| Step | Cold | Warm | What it is |
|---|---:|---:|---|
| Tap → loading screen | 0.45 | 0.47 | fresh page `?chunk=driftwood-isle` |
| 1 Application modules | 6.0 | 2.7 | 2.2 MB code pack (cold), 231–233 module fetches through the SW, 3.3 s "Preparing application services" |
| 2–9 admission … Equipment and HUD | 1.4 | 0.8 | Region world 1.0 / 0.4 |
| 10 Gameplay and saved state | 1.2 | 1.3 | |
| 11 World assembly, 25 cells / 40 seams | 4.0 | 2.2 | compiled page 2.4 / 0.7, collider join 0.9, 2.1 MB strip mesh fetched inside it |
| gap, row 12 → row 13 | 1.2 | 1.2 | no row names it |
| 14 Home region | **32.9** | **12.3** | product admission 12.7 / 2.7, then `grid.prepare create` 20.7 / 10.2 |
| 19 Road system + gap | 0.4 | 0.4 | |
| 20 Shaders + 21 First frame | 4.7 | 5.1 | 93 programs; `precompile.census:4` 2.6 / 3.0 s |
| Ready → control (reveal) | 2.2 | 2.3 | the "ARRIVING AT DRIFTWOOD ISLE" fly-in (3.0 s on WebKit) |
| **Total** | **53.3** | **27.6** | SHARD SELECT → Driftwood, cold: 51.7 (Props · Baked island 28.2) |

## Top 10 costs, phone profile (s on the critical path, cold / warm)

| # | Cost | Cold | Warm | Network or CPU |
|---|---|---:|---:|---|
| 1 | Home region build (`grid.prepare create`: scenes 6.4, fixed-draw assembly 8.0, native foundation 1.6, looks, baked, quest) | 20.7 | 10.2 | CPU, plus ~10 s cold waiting on serial reads (library intake 5.6 vs 1.2, `whole.read-wait` 4.5 vs 1.5) |
| 2 | Driftwood product admission (28 MB at 10 Mb/s; first pack at +12 s; warm re-admits the cached product) | 12.7 | 2.7 | network (cold), CPU (warm) |
| 3 | Application modules | 6.0 | 2.7 | 1.8 s network, the rest SW round trips + module eval |
| 4 | Shaders + first frame | 4.7 | 5.1 | CPU / GPU compile |
| 5 | World assembly, 25 grid cells | 4.0 | 2.2 | CPU, plus the strip-mesh fetch (cold) |
| 6 | Reveal fly-in, Ready → control | 2.2 | 2.3 | fixed animation |
| 7 | Gameplay and saved state | 1.2 | 1.3 | CPU |
| 8 | Unlabelled gap between rows 12 and 13 | 1.2 | 1.2 | unknown |
| 9 | Region world, renderer, equipment (rows 2–9) | 1.4 | 0.8 | CPU |
| 10 | Tap → loader paint, plus the road-system gap | 0.9 | 0.9 | page handoff |
| — | After control (not in the total): 4.6 s of long tasks and 117 requests in the first 4 s | 4.6 | 4.6 | CPU |

The download floor is 28 MB ÷ 1.25 MB/s = 22.4 s; the warm CPU is 27.6 s. Today they add up instead of overlapping.

## Loading screen UX, as seen on the recordings

- **Doesn't say what it's doing:** the SETUP line says "step 13 / 22 · Final activation" from 13 s to 52 s while row
  14 (Home region) does the work. Row numbers skip (5, 15–18), so "of 22" never adds up.
- **Progress isn't honest:** the download total grows from 2.17 to 9.5, 23.5, 55.2 and then 68.4 MB, so DOWNLOAD
  reads 100 % at 11 s, then 44 %. The Simulator saw 12 drops cold and 4 warm. SETUP sits at 73 % from 34 s to 45 s,
  then jumps.
- **Waits are in jargon:** "Read 1ac4b986a648", "Pack 00023b3bd3ff", "Content cache get da8abd2698bb".
- **One row for half a minute:** Home region runs 32.9 s and only its detail moves ("Home models 3 / 9 · reef").
- **Doesn't freeze in Chromium:** the longest long task is 0.57 s, with no frame gap over 1 s. The Developer meter
  still reads "0 fps max 20541 ms" throughout.
- **WebKit:** for ~1.5–2 s after the tap (warm), the panel shows 00:00.0 and 0 % before the clock starts. After the
  DEV switch on a cold title, a "LOADING CHUNK · DRIFTWOOD ISLE 00:00.0" panel covered the menu for ~6 s. There was
  one broken frame cold and two warm between the loader and the reveal (sim-grid-entry's check).

## Rows

Done is measured on this same throttled flow (Chromium phone profile, cold and warm) plus the Simulator Safari pair.
Every row lands on quick checks, and its numbers go in the commit.

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| PL1 | **Start the entry product's download at the tap.** Fetch `shard.json`, then the spawn-ring packs and big GLBs (≤ 6 in flight, today's per-file admission unchanged), while modules, world assembly and gameplay run, instead of from +12 s | Codex | M | cold −8 s (53.3 → ≤ 45); first Driftwood pack ≤ +3 s; Sim cold −1 s; warm ±0.5 s |
| PL2 | **Parallel reads inside Home region:** scene library intake and fixed-draw `whole` reads ask for every member of the phase at once (≤ 6 in flight). Today it's one GLB at a time, 21–28 s | Codex | S | cold Home region −5 s; `whole.read-wait` ≤ 1 s cold; Sim cold Home ≤ 2.5 s |
| PL3 | **Strip mesh and title music off the critical path:** the 2.1 MB `grid-strip-mesh` joins PL1's tap fetch; SELECT's "Selected audio downloads" (2.8 s, title music) moves after control | Codex | S | cold World assembly −1.5 s; SELECT cold −2.5 s |
| PL4 | **Warm product admission, 2.7 s:** measure it. If it re-hashes members already verified at put, trust the verified hash-named entry. If the cut needs per-member admission gone, it moves to the next plan | Codex | S | warm −2 s, or a commit naming the cost and moving it |
| PL5 | **Fewer, larger yields in `grid.prepare create`:** `whole.yield` / `release` take 1.4 s warm and 3.7 s cold. Each yield repaints the loader on a 10× CPU. Batch to ≥ 50 ms slices, with the loader still painting ≥ 4 times a second | Codex | M | warm Home region −2 s; no frame gap > 1 s; Sim warm −0.3 s |
| PL6 | **Shaders overlap the build:** start the 93-program precompile census (parallel compile) once `world.looks` knows the materials, not after Road system. Same programs, the same first frame | Codex | M | Shaders + First frame 4.7 / 5.1 → ≤ 2 s; first-frame pixel diff 0 |
| PL7 | **Application modules:** find the 3.3 s "Preparing application services" (2.1 s busy) and the 231 SW-served module fetches per warm entry (B6 counted 69 network JS requests, not these) | Codex | M | modules ≤ 3.5 s cold, ≤ 1.5 s warm; Sim warm ≤ 0.5 s |
| PL8 | **The unlabelled 1.2 s gap** between "Title art · explore" and "Final activation": name it, cut it | Codex | S | no gap > 300 ms between rows, cold and warm |
| PL9 | **Honest loading text (text and logic, no style change):** SETUP names the running row (Home region, not Final activation); DOWNLOAD's total comes from the descriptor up front, so % never drops; waits are named by role ("Driftwood models pack 2 / 13"), not by hash | Codex | M | 0 download % drops on both engines; header row = running row at every 1 s sample; no hex in the wait line |
| PL10 | **After control:** defer the 117 post-control requests and 4.6 s of long tasks to idle (with QF6) | Codex | S | ≤ 1 s of long tasks in the first 4 s after control, both runs |
| PL11 | **WebKit handoff clock:** the panel sits at 00:00.0 / 0 % for 1.5–2 s after the tap. Check against QF2.T4 | Codex | S | Sim: the clock advances within 500 ms of the tap, cold and warm |
| PL12 | **Reveal fly-in, 2.2–3.0 s:** shorten it, or skip it on warm entries. Changes the look: Jake's pick, as a variant | Opus | S | Jake picks; −2 s warm if he takes the skip |
| PL13 | **Title prefetch (G863):** on the title, prefetch the home / last shard's product in the background on ANY network, its progress visible on the title (G837). Built after PL1–PL3 | sp-x9 (Codex) | M | cold tap-to-control drops by the prefetched bytes' time when the title sat ≥ 10 s; progress shows on the title; `pnpm phone-loading` cold + warm, Chromium + WebKit |
| PL14 | **Cache the built home region (G864):** after the first entry, keep the built home region (home shard only, bounded storage, invalidated on a build / version change) so a warm entry restores it instead of rebuilding | sp-x10 (Codex) | M | warm Home region restores (no rebuild) and is measurably faster; a new build invalidates it; storage bound stated; `pnpm phone-loading` |
| PL15 | **Workers (G865):** move decode / parse / build to background workers, default off behind ONE Developer Debug row (A main thread / B workers) for Jake's phone A/B. No earlier 3 × 3 reveal | sp-x2 (Codex) | L | B saves measured seconds over A on `pnpm phone-loading` cold + warm, same pixels; A unchanged; Jake picks on his phone, then the row and the losing path go |

## Needs the next plan (G828, one-world; Jake writes it, no rows here)

- Per-member admission (hash, pin and two cache puts for each of ~600 members) is most of product admission's 12.7 s.
  Phase packs or ring bundles read whole are that loader's design (bulk-downloads review, part b).
- Every entry is a fresh page, so each one re-evaluates the modules (cost 3) and relinks the shaders (cost 4).
- The 25-cell grid world (cost 5) is rebuilt from nothing on every entry, and Home region's build (cost 1) can't start
  before admission ends.

## Order

PL1 → PL2 → PL3 first: the cold minute is mostly a waterfall, and these three overlap it. PL9 and PL11 go in parallel
(UX, small). Then PL6 → PL5 → PL7 → PL4 → PL8 → PL10 for warm. PL12 goes to Jake as a variant pick whenever an Opus
lane is free. After PL1–PL3 and again after the last row, re-run this flow (both profiles plus the Sim pair) and update
this table.
