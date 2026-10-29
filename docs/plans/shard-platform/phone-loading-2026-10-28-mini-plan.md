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
| PL1 | **open (2026-10-28, sp-x9; activation measured, total misses).** Tap starts the exact versioned descriptor; a bounded destination loan overlaps one header pack with mandatory code/hash preparation, then admits at most six original data reads. Original size/hash/schema/cache checks still own every byte. On Brotli-correct WT2ec5eb35a3-mvsw07pr, phone10x cold/warm **59.518/36.641s** versus original live reference53.270/27.556s; first pack starts **+0.403s**, within3s. WebKit unthrottled **7.997/7.433s**. All4 intended Home/document/uncovered-HUD witnesses pass. Current protocol uses10s title dwell and the stronger native fence; no isolated8s saving or Sim delta claimed. Native request-size accounting is explicitly incomplete and HTTP405 telemetry remains visible. Source activation `838f235a26`; bounded producer/loan and cleanup controls pass. | Codex | M | cold −8 s (53.3 → ≤ 45); first Driftwood pack ≤ +3 s; Sim cold −1 s; warm ±0.5 s |
| PL2 | **Parallel reads inside Home region:** scene library intake and fixed-draw `whole` reads ask for every member of the phase at once (≤ 6 in flight). Today it's one GLB at a time, 21–28 s | **open** (sp-x10, `374710f132`): pinned phone Chromium cold Home 32.902 → 26.187 s (−6.715); cold read-wait 1.970 s misses 1 s; WebKit unthrottled Home 1.761 s; Sim unmeasured | S | cold Home region −5 s; `whole.read-wait` ≤ 1 s cold; Sim cold Home ≤ 2.5 s |
| PL3 | **open (2026-10-28, sp-x9; grid assembly bar met, SELECT target remains open).** Plain build publishes the exact existing mode/home strip book/header/body addresses; grid tap fetches them through the original HTTP/SW cache, with unchanged mesh bytes/hashes and runtime admission. Direct phone play moves only title-exclusive music to the existing after-control audio queue; played/shared recordings, SFX, desktop and frozen LEGACY retain their admission. Same qualified4leg WT2ec5 cohort: Chromium grid assembly **2.393/1.967s**, versus original3.982/2.165s (cold−1.589s); WebKit **0.345/0.342s**, unthrottled. Mesh starts **+0.017s**, completes+3.312s at1,918,897 served Brotli bytes. Source `838f235a26`. SELECT on containing18fa9fcfe6-mvswgt67: Chromium43.669/33.108s, selected-audio wait1.721/0.720s; WebKit6.070/5.828s, audio38/17ms. All4 native standalone controls pass; original SELECT total was not retained, so no2.5s total saving is claimed. Exact-byte/tier/late-audio controls and types/lint pass; no new mesh or Vite plugin. | Codex | S | cold World assembly −1.5 s; SELECT cold −2.5 s |
| PL4 | **done (2026-10-28, sp-x2; attribution/next-plan alternative, `45a5cbc5be`).** Preserve private verified-byte authority for packed cache sections:33 redundant page hashes→0, raw/size/corruption/missing/offline guards unchanged. Measured phone10x warm admission2.620s versus original2.679s, **not** a claimed2s saving. Bounded Developer phase marks: visited98ms, sections994, source773, verified files298, costs234, durable storage202, finish17. Remaining reconstruction/receipt and per-member admission costs are named in G828 below; PL15 remains the separate default-off worker experiment. Completed admission spans are valid; prior full-entry totals used the old ruler control fence and await x6's intended-document/uncovered-HUD check. HTTP405 reports remain retained. | sp-x2 | S | warm −2 s, or a commit naming the cost and moving it |
| PL5 | **Fewer, larger yields in `grid.prepare create`:** `whole.yield` / `release` take 1.4 s warm and 3.7 s cold. Each yield repaints the loader on a 10× CPU. Batch to ≥ 50 ms slices, with the loader still painting ≥ 4 times a second | **open** (sp-x10, `374710f132`): pinned phone Chromium warm Home 12.285 → 10.596 s (−1.690), gap 0.567 s, whole yield/release 0.131 s; WebKit unthrottled warm Home 1.505 s; Sim unmeasured | M | warm Home region −2 s; no frame gap > 1 s; Sim warm −0.3 s |
| PL6 | **Shaders overlap the build:** start the 93-program precompile census (parallel compile) once `world.looks` knows the materials, not after Road system. Same programs, the same first frame | Codex | M | Shaders + First frame 4.7 / 5.1 → ≤ 2 s; first-frame pixel diff 0 |
| PL7 | **open (partial, 2026-10-28, sp-x2; cold 5.87 s versus ≤3.5 s, warm 1.476 s; Sim unmeasured).** Staged primary reads (`0e23731804`) preserve original publication/failure barriers and all 45 memory yields. Existing-controller readiness (`169de0851c`) keeps registration/update discovery running without gating boot. `pnpm phone-loading --preset phone --flow grid --webkit`: prior 6e WT → pinned169 Chromium modules 5.968→5.868 s cold /1.512→1.476 s warm; entry 56.402→58.273 s /34.734→34.714 s. Code-pack GET starts 2.770→0.492 s, but transfer grows 1.805→3.937 s while a 1.919 MB seam and one 351 KB header overlap. A required-code high-priority hint follows in this change, measured on its pinned SHA next. Observed SW scripts remain 95 attempts/93 URLs in both Chromium visits (not a complete byte-accounting claim); B6 accepted69 was standalone page JS URLs, not grid/page+worker transactions. WebKit unthrottled modules 0.597→0.659 s /0.648→0.542 s, entry 7.684→7.878 s /7.795→6.378 s. All eight native Home/document/HUD controls qualify; HTTP405 and SW size refusals remain. Containing render/data changes prevent isolated full-entry attribution. Frozen LEGACY, original primary objects/placements, hashes, deadlines and reveal stay. | sp-x2 | M | modules ≤ 3.5 s cold, ≤ 1.5 s warm; Sim warm ≤ 0.5 s |
| PL8 | **open (2026-10-28, sp-x6; `fd600065d6` labels the original awaits).** The map/frame race and spawn-link wait keep their original order/caps and now have distinct rows. Same6e-mvsxll5k OFF read: first-drawn/minimap509.6/485.7ms, spawn-links12.924/12.701s on Chromium10x; WebKit Mac75/67ms and952/976ms. All4 native control witnesses qualify. Complete gap bar still unqualified; no speed-saving claim from labels. | sp-x6 | S | no gap >300ms between rows, cold and warm |
| PL9 | **open (2026-10-28, sp-x6; one remaining main-seam declaration drop).** Active role captions and exact resource metadata (`ac4d29acb5`, `8ded682ad5`); hybrid grid home denominator fixed in `61645cfa26`. Same phone ruler on containing616: Chromium cold/warm **90.664/37.312s**, download drops **1/1** (was11/4 on289); WebKit Mac unthrottled **8.195/8.303s**, drops **0/0** (was2/1). Every sampled header matches the running row; no hash wait captions. All4 intended-document/Home/uncovered-HUD witnesses qualify; images read, HTTP405 errors retained. Containing6e-mvsxll5k retains cold/warm drops1/0 in both engines: main `__GRID_SEAM_ASSET__` is declared at assembly. Its exact compiler URL/bytes now join the early declaration; ordinary containing read pending; no clamp or speed-saving claim. Raw `tmp/phone-loading/2026-10-29T01-35-41-074Z-61645cf-mvsvf69a/`. | sp-x6 | M | 0 download % drops on both engines; header row = running row at every 1 s sample; no hex in the wait line |
| PL10 | **After control:** defer the 117 post-control requests and 4.6 s of long tasks to idle (with QF6) | Codex | S | ≤ 1 s of long tasks in the first 4 s after control, both runs |
| PL11 | **done (2026-10-28, sp-x6, `5109aff652`; G861 two-engine phone check).** Keep the existing fresh handoff timestamp in the display across the new document and Loading adoption; retry/stage clocks remain unchanged. Own containing5109 phone Chromium cold/warm first nonzero clock **384/448ms**, WebKit Mac **158/143ms**, all below500ms. Earlier289 WebKit warm was1123ms. Four native intended Home/control witnesses qualify; HTTP405 reports retained. Chromium totals99.488/41.554s, unthrottled WebKit7.612/6.865s; no entry-speed saving claim. Raw `tmp/phone-loading/2026-10-29T01-41-42-212Z-5109aff652-mvsvm3kx/`. | sp-x6 | S | clock advances within500ms of tap, cold/warm, Chromium + WebKit (G861); Mac WebKit is not a throttled Sim reading |
| PL12 | **done (2026-10-28, sp-x6; Jake: fly-in STAYS, any tap skips).** Existing reveal/input code is unchanged (`a7a1b75f25`, measured containing `2ec5eb35a3-mvsw07pr`). Own iPhone16Pro portrait Chromium with `--use-angle=metal --ignore-gpu-blocklist` and WebKit Mac trusted taps confirm skip in **47/91ms**; native reveal ends at212/70ms from its start, both `skipped:true`, caption removed. Opus independently measured Chromium70–234ms. The earlier18s result was this probe missing Metal flags/using SwiftShader, not a game input defect. HTTP405 preview telemetry remains retained. Raw `tmp/sp-x6-phone-loading/reveal-input/metal-result.json`; both browser processes closed. | sp-x6 | S | keep default fly-in; trusted tap skips on Chromium + WebKit; no look change |
| PL13 | **open (2026-10-28, sp-x9; built, mixed timing).** Cold title warms only compiled home/last products on any network through the existing verified disk downloader, phone-tier/ring,32MiB in-flight bound and64MiB quota headroom. Last choice is a validated device save; title retirement stops its queue; live-world prefetch is never replaced. Existing title status styling shows exact logical stored/present MB, with no offline-size scan or world construction. Same10s dwell/phone10x cohort before→after: Chromium cold **59.518→56.616s (−2.901)**, warm **36.641→39.546s (+2.905)**; unthrottled WebKit **7.997→8.147s**, warm **7.433→6.526s**. All8 native document/Home/uncovered-HUD witnesses pass. The labelled cold sheet shows14.8/39.7MB before tap; no served-byte savings claim because native request-size census remains incomplete. Six save/target/metered-pack/lifetime controls and types/lint pass. Warm regression remains on BURN; no universal speed or Sim claim. | sp-x9 (Codex) | M | cold tap-to-control drops by the prefetched bytes' time when the title sat ≥ 10 s; progress shows on the title; `pnpm phone-loading` cold + warm, Chromium + WebKit |
| PL14 | **done (2026-10-28, sp-x10, `2892520628`).** One actual Home caches completed immutable geometry in IndexedDB (64 MiB / 256 entries); build/revision/tier or source-profile changes refuse old data. Warm Chromium phone10x Home **12.285 → 11.371 s (−0.915 s)** against the committed live baseline; valid full-inventory pin `2892520-mvsujazi`. Both engines restore **40 owned models + whole library**, with no whole decode/assembly; fresh brains, physics and owners retain their original lifecycle. Native Chromium/WebKit controls prove build invalidation, exact typed/half words and both bounds. Full cold/warm control **91.705/39.070 s**; cold Home **48.530 s**, so no overall/cold gain claim. WebKit Mac is unthrottled: Home **1.584/1.353 s**, control **7.210/7.747 s**. All four intended Home/native/uncovered-HUD witnesses qualify; captures read. Local telemetry HTTP405s retained. Raw `tmp/phone-loading/2026-10-29T01-10-49-781Z-2892520-mvsujazi/`. | sp-x10 (Codex) | M | warm Home region restores (no rebuild) and is measurably faster; a new build invalidates it; storage bound stated; `pnpm phone-loading` |
| PL15 | **open (default off, mixed results for Jake’s A/B, 2026-10-28, sp-x2; d24ac49298).** G865 data-only worker behind ONE Developer row: A main (default/public) / B workers, reload. Exact UTF-8/JSON decode and canonical receipt building move off-page; original hashes, schema/source receipts, readiness and 3x3 reveal stay. Same WT5109aff652-mvsvm3kx, `pnpm phone-loading --preset phone --flow grid --webkit`: Chromium A→B cold99.622→85.989s, warm38.252→40.821s; product admission6.836→3.462s /2.827→2.517s. WebKit unthrottled A→B cold7.649→7.201s, warm6.763→6.912s; admission351→317ms /227→248ms. All8 intended Home/HUD controls valid; B143 worker jobs per visit, A0; HTTP405 telemetry reports retained. Spawn captures agree and complete decoded source hashes remain exact. Worker CPU is NOT CDP-throttled; full-entry differences are not isolated CPU attribution.95 focused controls/types/lint/scoped ratchet pass. A remains default; no warm-win or physical-device claim. | sp-x2 (Codex) | L | B saves measured seconds over A on `pnpm phone-loading` cold + warm, same pixels; A unchanged; Jake picks on his phone, then the row and the losing path go |
| PL16 | **done (2026-10-28, sp-x6; `25418c29d9`).** One Developer reload row, default OFF; only the initial Home can reveal at the mandatory spawn ring. Same scheduler fills distant coverage; later returns require full coverage. 21 controls, types/lint/scoped ratchet pass. Same full24 WT6e-mvsxll5k: phone10x Chromium OFF cold/warm56.402/34.734s, ON59.252/61.910s; WebKit Mac unthrottled OFF7.684/7.795s, ON6.946/7.282s. All8 intended-document/Home/HUD witnesses qualify; ON images read. No consistent speed gain; stays OFF. Raw OFF02-38-03 / ON02-39-57 under `tmp/phone-loading/2026-10-29T*-6e939d367a-mvsxll5k/`; telemetry405/native size refusals retained. | sp-x6 | S | default/full readiness preserved; opt-in spawn ring plus streaming verified on both engines |

## Needs the next plan (G828, one-world; Jake writes it, no rows here)

- Per-member admission (hash, pin and two cache puts for each of ~600 members) is most of product admission's 12.7 s. PL4's phone10x warm attribution (`45a5cbc5be`) is2.620s: section reconstruction/receipt994ms, source checks/selection773ms, verified member reads298ms, durable checks/storage202ms, costs234ms, visited98ms and finish17ms. Removing the remaining per-member/reconstruction contract belongs to G828; no guard is bypassed here.
  Phase packs or ring bundles read whole are that loader's design (bulk-downloads review, part b).
- Every entry is a fresh page, so each one re-evaluates the modules (cost 3) and relinks the shaders (cost 4).
- The 25-cell grid world (cost 5) is rebuilt from nothing on every entry, and Home region's build (cost 1) can't start
  before admission ends.

## Order

PL1 → PL2 → PL3 first: the cold minute is mostly a waterfall, and these three overlap it. PL9 and PL11 go in parallel
(UX, small). Then PL6 → PL5 → PL7 → PL4 → PL8 → PL10 for warm. PL12 goes to Jake as a variant pick whenever an Opus
lane is free. After PL1–PL3 and again after the last row, re-run this flow (both profiles plus the Sim pair) and update
this table.
