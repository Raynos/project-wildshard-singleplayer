# Battery audit 2026-10-29 (mini spike)

**State:** spike done 2026-10-29 by wildshard-v's audit subagent; rows BA-1…BA-8 below belong to FOUNDATIONS MF7 / G890
(the battery bar). Read-only audit: no product code changed.

## Jake's words

14:22: *"I'm minding my own business playing Driftwood and it fucking flashes white and crashes. My phone is hot. I've
been playing the whole time with the phone not on low power mode."* 14:24: *"I also think the battery drained 20% from
like 45 to 27%."* *"Yeah, I feel like just playing the game for 20 minutes drained like 30% of the battery or
whatever."* 14:33: *"Do we have a sub-agent looking at why does the battery drain so incredibly fast on my phone?"*
14:38: *"Battery drain happens on all the levels. I was playing Nalati, I was playing Nine Dragon, Driftwood."*

Evidence: [iOS Battery 14:23](../../../art/qa-2026-10-29/battery-1423.jpg): Web 20 %, Safari 13 %, 57 % used by 14:23
against a 24 % average; 53 → 45 → 27 % from 13:40 to 14:22 (~37 %/h), Low Power off, phone hot; QB20 17 fps.

## How it was measured

Live site, Chromium (Playwright) as "iPhone 16 Pro", phone tier, render scale 2, muted, one browser lane, 10 s windows.
Counters wrap `requestAnimationFrame`, timers, `Worker.postMessage`, `fetch` and every WebGL2 draw / framebuffer bind /
viewport; CPU from CDP `Performance.getMetrics` (main-thread script / task ms per s) and `SystemInfo.getProcessInfo`
(renderer and GPU process CPU ms per s). **This Mac is not the phone**: absolute ms are an M-class desktop; read them as
ratios between screens. An A19 at 2× thermal throttle runs the same main-thread work ~3–5× slower. No battery or true
GPU time is measurable here (the Simulator has no energy reading either); headless Chromium cannot hide a page, so the
hidden-page column is from the code. WebKit / Simulator timeline not run (time).

## Per screen (Driftwood unless named)

| Screen | rAF cb/s | Frames drawn/s | Draws/frame | Script ms/s | Renderer CPU ms/s | GPU-proc CPU ms/s | Timers / workers |
|---|---|---|---|---|---|---|---|
| Title, first 10 s (fresh profile) | 0 | 0 | 0 | 1 (17 task) | 69 | 7 | 125 long timeouts/s registered, 89 worker posts/s, 171 KB/s (read-ahead start) |
| Title, next 10 s / SHARD SELECT | 0 | 0 | 0 | 0 | 5–10 | 5–15 | ~5.5 interval fires/s, nothing else |
| Loading card (Driftwood) | 202 (3–4 per vsync) | 13.5 | 144 | 73 (349 task) | 868 | 286 | 176 long timeouts/s, 293 worker posts/s |
| Loaded, under the loader, before ENTER | 66 | **60** | 230 | 311 | 521 | 320 | 146 long timeouts/s, 73 posts/s |
| **Play** | 60 | **60** | 229 (289 calls, 1.18 M tris) | **264** | **333** | **261** | 3.6 interval fires/s, 0 posts |
| Pause menu | 60 | 0 | 0 | 3 | 41 | 6 | 4 interval fires/s |
| Hidden (code) | iOS stops rAF | 0 | 0 | — | — | — | intervals keep firing (throttled); AudioContext never suspended; read-ahead waits (`prefetch.ts:193`) |

## Per shard, in play (60 fps everywhere: the cap is reached on this Mac)

| Shard | Draws/frame | Tris/frame | FBO binds/frame | Script ms/s | Renderer ms/s | GPU-proc ms/s | Passes seen |
|---|---|---|---|---|---|---|---|
| Driftwood | 229 | 1.18 M | 15 | 264 | 333 | 261 | shadow 2048² ×3 cascades (39 draws), scene 804×1362 (132), bloom mips 201→26→201, composite |
| Nine Dragon | 244 | 1.43 M | 11 | 274 | 327 | 255 | shadow 1024², scene 804×1362 (243 incl. post at the same size) |
| Nalati | 91 | 1.25 M | 10 | 210 | 297 | 225 | shadow 512² (3 draws), scene 804×1362 (88 incl. post) |

Shared, not content: Nalati draws 2.5× fewer calls than Nine yet costs 77 % of its main-thread script and 88 % of its
GPU-process time. The per-frame cost is the engine's loop, systems and full-screen passes, paid 60 times a second on
every shard (Jake 14:38: *"Battery drain happens on all the levels"*).

Drawing buffer: 804×1362 here = css 402×681 × 2 (Playwright's Safari viewport); the home-screen PWA is 402×874 → **804×1748
= 1.41 Mpx**, HalfFloat targets (`Game.ts:553`, `:579`), plus bloom (4 levels at a quarter), god rays (24 samples at a
quarter), volumetrics (8 steps at half) and SMAA low in one effect pass.

## Causes, ranked by estimated energy share in a 20 min session

1. **Full-rate play, every frame redrawn whether or not anything changed: ~85–90 %.** Play costs ~860 ms/s of CPU across
   main + renderer + GPU process here, pause ~50, title ~10. G876 (`c6357b798e`, `tier.ts:116`: `MOBILE_DEVICE` → 60)
   doubled the frame count against E193's 30: every per-frame cost below doubles with it. The loop
   (`Game.ts:1262-1347`) has no idle / static-view skip: standing still at the shore draws 60 identical-ish frames a
   second. At ~4.4 ms of main-thread script per frame on a desktop core the phone is at 13–20 ms of its 16.7 ms
   budget, so the CPU never idles, the phone heats, throttles ~2× and lands on QB20's 17 fps; nothing in the engine
   notices a sustained frame-time rise and steps down.
2. **Fixed GPU work per frame at 1.41 Mpx: ~half of the frame's GPU energy (estimate).** Driftwood's phone shadow rig
   is 3 cascades at 2048² (`skyRig.ts:39`, `PHONE_SHADOW`), all re-rendered every frame (39 draws, 3 depth targets =
   12.6 M texels cleared and written per frame), then a HalfFloat scene, a 4-level bloom mip chain and a composite
   effect pass; 11–15 framebuffer switches a frame, each a tile load / store on the phone's tiled GPU.
3. **Work under the loader and on the loading card: ~5 %, worst at the hottest moment.** Under the opaque loader the
   phone spawn gate draws the world at full rate (`finish.ts:181`, `spawnGate`: 60 frames/s, 230 draws, 311 ms/s
   script) while programs link; the loading card ticks its clock on every vsync (`Loading.ts:164`), 3–4 rAF callbacks
   a vsync in all, and ~150 long timeouts a second are armed while it loads.
4. **Small but always on (~1–3 %):** the AudioContext runs at 48 kHz (Nine: `running`, 110 nodes created by 15 s of
   play) from the first gesture and is never suspended
   (no `suspend()` in `src/engine/audio`): pause, title return and the first seconds after hide keep the audio
   hardware on, with the music pump (`Music.ts:698`, 120 ms) and the AAC pump (`aacSource.ts:55`, 50 ms). The minimap
   repaints its 2D canvas every frame even when the player stands still (`Minimap.ts:356-380`). Developer chips
   (`Perf.ts:145`, 500 ms) and telemetry beats (`telemetry/runtime.ts:33-35`) are negligible.

Already fine: the title and SHARD SELECT are static DOM (0 rAF, 0 draws, ≤ 15 ms/s once the read-ahead settles); the
pause menu draws nothing (`play.ts:565` frame gate, 3 ms/s script); the read-ahead waits while hidden; the loop stops
with rAF on hide. The white-page kills (QB6) are memory + heat; this spike does not change MF7's memory half.

## The three biggest cuts

1. **A frame-rate governor on the phone (BA-1, BA-2):** 30 fps while the view is idle (no input, camera still for
   2 s) and 30 fps after a sustained frame-time rise (p90 > 20 ms for 10 s = thermal), back to 60 on input or after
   60 s cool. Halves causes 1 and 2 whenever it applies: estimated 30–45 % less energy over a 20 min session.
2. **Phone shadows not redrawn every frame (BA-3):** the far cascades refresh every 2nd / 4th frame (or on sun /
   camera move past a texel), one 2048² cascade a frame at most: ~10–15 % of frame GPU work.
3. **Nothing full-rate under the loader or on menus (BA-4, BA-5):** spawn-gate frames at 30 fps, the loading clock at
   10 Hz, the AudioContext suspended on pause / hide: small share, but it lands at the hottest moments.

## Rows

| Row | What | Fix / done when | Lane | Size |
|---|---|---|---|---|
| BA-1 | **superseded by G896** (`b8beb73e98`: phones run at 30 fps always). Idle-view governor (MF7 / G890) | Phone loop draws at 30 fps when no input and the camera has not moved for 2 s; 60 on the next touch. Done: standing still 60 s on Driftwood, Nine, Nalati reads 30 drawn frames/s in Chromium and on the Simulator; play feel unchanged (Jake's playtest). | superseded by G896 (phone 30 fps always) | S |
| BA-2 | **superseded by G896** (`b8beb73e98`: phones run at 30 fps always). Thermal step-down (MF7 / G890) | Frame-time p90 > 20 ms for 10 s on the phone → 30 fps cap; back to 60 after 60 s under 14 ms. Debug row shows the state. Done: a forced 4× CPU throttle in Chromium steps down and back; Simulator reading. | superseded by G896 (phone 30 fps always) | S |
| BA-3 | Phone shadow cascades on a budget (MF7) | `PHONE_SHADOW` far cascades refresh every 2nd / 4th frame or past a texel of motion; static casters not redrawn. Debug row old / new for Jake's variant sheet. Done: shadow draws/frame halved on Driftwood, no visible swim on a before / after clip. | superseded by FC8 (sp-o3) | M |
| BA-4 | Nothing full-rate under the loader (MF7 / MF5) | **in flight (sp-x1):** clock samples at 10 Hz with no independent RAF chain; 42 focused controls pass, normal fade/phase/hold/byte checks retained. **G909 supersedes the 30 fps bar: 0 world frames behind the loader**, while warm-up compiles continue. The presentation gate follows sp-o3's compile-without-present MF5 prerequisite; reveal readiness remains unchanged. Done: 0 drawn world frames behind loading and one foreground frame chain. | superseded by FC2 / FC6 | S |
| BA-5 | Audio sleeps when nothing plays (MF7) | Suspend the AudioContext on `visibilitychange` hidden and while paused past 5 s, resume on show / unpause; stop the music and AAC pumps while suspended. Done: `ctx.state` reads suspended in both, music resumes in place. | superseded by FC5 | S |
| BA-6 | **done `16f24166fe` + `59d0c7f9ac` + `70c317a0c6` (sp-o4):** an allocation-free digest of what the minimap shows (the player to half a device pixel and 0.5 deg, each animal and mark to one pixel, size, fade, ground and overlay layers); it repaints only when that changes, at most 30 Hz. Driftwood, Chromium phone, 10 s windows: before `fdc6baf` 30 paints/s standing and walking; after 4-5 paints/s standing (all from the 2 of 9 animals in view that wander; the player drifts 0 m / 0 deg) and ~18 walking; frames 30 / s both; same pixels. Minimap repaints on change (MF7) | Repaint only when position / yaw / markers change, at most 30 Hz. Done: standing still repaints 0 /s; walking unchanged on a clip. | Opus sp-o4 (after QB15) | S |
| BA-7 | Post chain trimmed on the phone (MF7) | Measure each effect's GPU ms on the Simulator; cut the costliest that Jake's variant sheet cannot tell apart (god rays and volumetrics first). Done: a Debug A / B and Jake's pick. | superseded by FC9 | M |
| BA-8 | The battery bar, measured (G890 / MF20) | One method for G890: Simulator CPU + GPU ms per second over 3 × 5 min per shard (Driftwood, Nine, Nalati), before / after BA-1…BA-4, then Jake's 20 min playtest from a noted battery %. Done: the numbers in the MF7 commit and STATE. | superseded by FC15 | S |
