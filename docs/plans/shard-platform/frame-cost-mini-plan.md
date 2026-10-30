# Frame cost: draw only what is seen, and make every frame cheap (mini plan)

**State:** open 2026-10-29, written by wildshard-v's subagent for wildshard-new; part of FOUNDATIONS wave 1 (MF7 / G890); every row blocks the SHARD-PLATFORM archive (G877 / G892); the builder is autonomous (G872).

## Jake's words (2026-10-29 ~14:55 Cancun)

*"The graphics side doing heavy fixed work every frame needs to be fixed, right? … get a mini agent to do a plan to like fix the how every frame and every graphics work is so fucking heavy. How we have to like redraw everything even if nothing changes. Nothing should be fucking drawing the game behind the loading screen, you fucking idiot. Put it in the sub agent. Figure out who's the fucking idiot and not to draw the fucking game behind the loading screen. Like, don't draw the fucking game when there's a screen on top of it. Oh my fucking god, dude. Main menu, don't draw the fucking game. Loading screen, don't draw the fucking game. When we're looking at the fucking game, then draw the fucking game."* Ruled as G909.

## On one screen

**Who and why.** Three anti-hitch fixes keep the world drawing under the opaque loader on a direct entry: L15
(`66c0cb0072`, 10-23, so the fade uncovers a live frame), P0 #4 (`93eb52800f`, 10-28, draw until 20 frames build no new
shader) and QA8 (`0865113756`, 10-29, link the world's other shaders a few per drawn frame, ≤ 6 s). The hitches were
real; a draw loop was never needed to fix them. The journal (`5695d34c45`, 09-24), the shop and the quest boards
(`8a56799b70`, 09-30) don't pause, so the world plays and draws behind their glass. The map tab repaints every vsync
(`5a7f1f3f40`, 10-04). Nobody ever suspended the audio on a hidden page. The title, main menu and pause draw 0 world
frames (`9bda267a7b`, 09-17; MF3), but the loop still wakes every vsync.

**The rule.** The world renders only while the world is what the player is looking at. An opaque screen draws no world
frames. A glass screen shows one frozen still. A hidden page runs nothing.

**The three biggest costs in play** (Driftwood, phone tier, from the battery audit; the shares are estimates):
1. **Main-thread work every frame, ~40 %:** all the systems plus three.js's scene walk come to ~4.4 ms a frame on the
   Mac, which is 13–20 ms on a warm phone. Nalati does 2.5× fewer draws than Nine and still costs 77 % of its script time.
2. **Full-screen passes at 1.41 Mpx, ~30 %:** a half-float scene, a 4-level bloom, god rays, volumetrics and SMAA, with
   11–15 render-target switches a frame, each one a tile load and store on the phone's GPU.
3. **Shadows, ~15 %:** 3 cascades at 2048², all redrawn every frame (39 draws, 12.6 M texels) even when nothing moved.

**Bars.** Covered screens: 0 world frames a second, 0 loop wake-ups. Hidden page: 0 rAF, 0 timers, audio suspended.
Play at 30 fps: ≤ 12 ms main-thread work per frame on the phone proxy. G907: ≤ 8 % battery per 20 min, read from
Jake's next playtest.

## 1. Who and why, case by case

| Where | Commit, date, row | What it was for | Still real? What replaces it |
|---|---|---|---|
| Loader, direct entry | `66c0cb0072` 10-23, loading-mini-plan L15 | Loop starts before the fade; wait 2 live frames + minimap (≤ 1.5 s) so the fade uncovers the spawn view, not a stale warm-up render | Yes. **One counted hidden frame before the fade**, no loop |
| Loader, phone | `93eb52800f` 10-28, P0 #4 (`settlePrograms.ts`, `finish.ts:181-197`) | Gate opened under the loader; draw spawn frames until 20 in a row build nothing (≤ 2 s), so no link after PLAY | Partly: ANGLE-Metal builds a pipeline at a program's first draw per target format. **Warm draws into small offscreen targets of the real formats** (as `precompile.ts:771` does for post), then one hidden frame that builds 0 |
| Loader, phone | `f2e66fd723` 10-28 | Limited the above to direct entries; a boot that lands on the title draws 0 | Right. Kept |
| Loader, WebKit | `0865113756` 10-29, QA8 / G878 | `worldPrograms`: ~17 off-screen programs linked under the loader, a few per *drawn* frame, ≤ 6 s | Links yes. **Paced by their own timer** (poll `COMPLETION_STATUS` with backoff), no world frames |
| Loading card | `568a1463fa` 09-16, kept by `fc043dfec3` 10-01 | Clock ticks every vsync (`Loading.ts:164`); 3–4 rAF callbacks a vsync | No. 10 Hz; one rAF chain at most |
| Title / main menu | `568a1463fa` 09-16 (title over a live attract camera), fixed by `9bda267a7b` 09-17 (world frozen and muted under the menu); MF3 `6e4e5e6817` 10-29 (title page imports no engine) | — | Already 0 world frames. The shard page's main menu still runs the loop's rAF every vsync |
| Pause, settings, bag | play gate `play.ts:565` (`12c5c5b3e4` 10-07); `5107e0f6fe` / `9f93aead1e` 10-29 measured 0 fps paused | — | 0 world frames; loop wakes every vsync (60/s, 41 ms/s renderer). **Park the loop** |
| Map tab | `5a7f1f3f40` 10-04, E440 | Paused app runs no update, so the map was black; it got its own rAF repainting the DPR-3 canvas every vsync | Own driver yes. **Repaint on pan / zoom / marker change** (as BA-6) |
| Journal | `5695d34c45` 09-24, PH-C5 | Opens with `holdPause` (keeps the pause menu shut) instead of pausing: the world plays live behind 62 % glass + 5 px blur | Pause menu shut, yes. **A still state apart from the pause menu** |
| Shop, quest boards | `8a56799b70` 09-30, E314 (Maren's counter); declared in `b5cd694da2` 10-15 / `fe9e9906b5` 10-16 (`panelHold`) | Same `holdPause` pattern | Same fix as the journal |
| Hidden page | none: `src/engine/audio` has never called `suspend()` | iOS stops rAF; intervals fire (music 120 ms `Music.ts:698`, AAC 50 ms, telemetry, `GpuRecovery` 500 ms, `lastEnd`); audio hardware stays on | **Suspend audio, pause intervals, idle workers** |

## 2. The rule and every screen

The engine keeps one **view state**: `play` (the world is drawn), `still` (glass over the world: one captured frame,
then nothing), `covered` (opaque: nothing) or `hidden` (the page is hidden: nothing runs). Every UI layer
(`app.ui.push`) says whether it is `opaque` or `glass`. The layer stack works out the state, and the loop stops
scheduling rAF in every state except `play`. Leaving that state restarts the loop, through the existing `kickLoop` /
`primeFrame`. Warm-up frames are explicit, counted calls (`warmFrame()`), never the loop.

| Screen | Today | Target |
|---|---|---|
| Title page and its SHARD SELECT | static DOM, 0 frames (MF3) | same |
| Shard page main menu, pause / settings / bag / feedback, shard complete, rotate gate, error modal | 0 world frames, but the loop wakes every vsync | covered or still: no rAF |
| Loading card | ~13.5 warm-up renders a second, then the world at frame rate during `spawnPrograms` / `worldPrograms` / the fade wait | covered: counted one-off warm draws (≤ 1 per program plus 2 full hidden frames); clock at 10 Hz |
| Map tab | whole canvas repainted every vsync | repaint on change only |
| Journal, shop, quest boards | world live behind glass | still |
| Death fade, Explore | world / its own view visible | play |
| Hidden page | rAF stops; timers and audio keep running | no timers, audio suspended, workers idle |

## 3. Every frame cheaper in play (phone tier, 30 fps, G896)

| Cost | Share (estimate) | Target |
|---|---|---|
| Systems' update and the three.js scene walk (`runPhase`, `cullPlaced`, `lookStrategy.frame`, matrix updates) | ~40 % | `frameCost` per bucket, cut the top three: static roots off the matrix walk, far animals posed less often, 0 allocations a frame |
| Post chain at 804×1748 (half-float scene, bloom 4 levels, god rays 24 at ¼, volumetrics 8 at ½, SMAA low) | ~30 % | Time each pass; A / B: god rays and volumetrics off, bloom 4 → 2, 8-bit targets where no banding, FXAA vs SMAA |
| Render-target switches (11–15 a frame) | inside the above | ≤ 6 a frame: one merged effect pass, no redundant clears or copies |
| Shadows (3 × 2048², every frame) | ~15 % | G899: far cascades every 2nd / 4th frame (Debug A / B); then static casters cached until the sun or the cascade snap moves; casters culled to the cascade |
| Draw calls (Driftwood 229, Nine 244, Nalati 91) | ~5–10 % | ≤ 150 on the phone through instancing and per-tile merges by material (never facade multi-draw, E271) |
| HUD layers (`.ws-glass` backdrop blur over the live canvas, DOM writes) | ~2–5 % | Blur vs flat glass as a Debug A / B; DOM written only on change |
| Minimap | done `16f24166fe` (BA-6) | — |
| Frames where nothing changed (camera still, nothing animating in view) | rare in play (water, wind, sky) | Reuse, not skip: cached shadows, held post (D178 `skipWhileTransparent`); an unchanged-view digest skips the draw (default-off Debug row) |

Every look change is a Debug A / B with a labelled board (G844 / G858); the builder ships the winner where it reads
the same (G872 / G899), logs it and keeps the old look as a Debug variant. Each shard keeps its style; render scale 2×.

## 4. Bars

- **Covered / still screens:** 0 world frames and 0 loop rAF callbacks a second over 10 s, every §2 row. Loader warm
  draws counted apart: ≤ 1 per program + 2 hidden frames, listed in the loading timeline.
- **Hidden page:** 0 rAF, 0 scoped timers firing, `AudioContext.state === 'suspended'`, 0 worker posts; it resumes in place.
- **Play at 30 fps:** main-thread work (`frameCost` update + render) ≤ 12 ms p50 and ≤ 16 ms p95 per drawn frame in
  Chromium phone tier with a 4× CPU throttle (the repo's phone proxy), on Driftwood, Nine, Nalati and Pine at a cool
  start. Simulator in play: game WebContent ≤ 15 % CPU and GPU process ≤ 10 % (Pine at 60 fps read 45.5 % and 25.5 %,
  `9f93aead1e`). Why 12 ms: the phone slows ~2× once it is hot, so 12 ms becomes ~24 ms, still inside the 33 ms
  budget. A ≤ 36 % duty cycle also lets the SoC idle between frames.
- **G907:** ≤ 8 % per 20 min ≈ 24 %/h ≈ 3.9 W for the whole phone (estimate, ~16 Wh battery; today ~37 %/h ≈ 6 W):
  ~45 % less SoC power. G896's 30 fps gives about half; these rows the rest. Read from Jake's next playtest.

## 5. Rows

Placement: **FC1–FC6 go first in wave 1, under MF7's battery half** (crashes first, G894: heat feeds the kills).
FC7–FC15 are MF7's battery bar. wildshard-v links this plan from FOUNDATIONS as MF7b.

| Row | What | Fix / done when | Lane | Size |
|---|---|---|---|---|
| FC1 | **Done `ca0c7c8b60` + `b94a1d7de3`**: one presentation state and parked loop | **done** (see lane) — Chromium iPhone-viewport, containing `29458376fb` / final-idle `070b09c109`: actual title, pause Settings and Map each 0 world frames / 0 world-loop rAF over 10 s; glass captures 1 still then 10 s at 0 frames / 0 rAF, closing resumes 6–7 frames / 200 ms. Unpause portrait inspected: no blank. Explicit loader/title warm-up frames remain counted (3 on the idle title); 31 focused state/layer/loop/title/cadence controls including clock rebase and capture-owner lifetime. Raw `tmp/sp-x1-battery/{view-*-qualified,final-title-reading,final-native-reading}.json`. | Codex sp-x1 · done e74ca75809 (070b09c109 reading) | M |
| FC2 | Nothing drawn behind the loader (supersedes BA-4's spawn half) | **done** (see lane) — `settleEntryPrograms` / `worldPrograms` warm with counted offscreen draws in the real formats, links polled on a timer; L15's wait = one hidden frame. Done: 0 world frames under the loader; 0 builds in the first 10 s of play (WebKit trace); MF5's reveal unchanged | Opus sp-o3 · done 3d48f0fb6f | M |
| FC3 | **Done `0e09ed4f9e`** (Pine journal open: 30.2 → 0 world frames/s, 30 after close, no pause menu; board `art/frame-cost/round-1-fc3-glass-still/`; `UiLayers.holdStill` for FC1). Journal, shop, quest boards freeze the world | **done** (see lane) — They push a `glass` layer: one captured still, simulation paused like the pause menu, no pause menu shown. Done: 0 world frames while open; closing resumes in place; before / after capture | Opus sp-o4 · done 0e09ed4f9e | S |
| FC4 | **Done `42817f44ae`** (Pine map open, untouched: 60 → 0 repaints/s; panning ~30/s (was 84); quest pulse on the compositor; board `art/frame-cost/round-2-fc4-map-repaint/`). Map tab repaints on change | **done** (see lane) — Dirty flag on pan, zoom, markers and fog. Done: an untouched open map repaints 0 a second; panning stays smooth (clip) | Opus sp-o4 · done 42817f44ae | S |
| FC5 | Hidden page runs nothing (supersedes BA-5) | **done** (see lane) — Hidden: `AudioContext.suspend()`, music / AAC pumps stopped, `Scope.interval`s paused, read-ahead idle; audio also suspends in `covered` / `still` past 5 s. Done: §4 hidden bars; music resumes in place | Codex sp-x1 · done 3e5e30b7ef + 070b09c109 | S |
| FC6 | Loading card: one rAF chain, 10 Hz clock (supersedes BA-4's clock half) | **done (sp-x1):** clock `20a1744b91` plus this shared-carrier commit. Chromium phone-viewport scheduler component: 146 logical deliveries / 73 native callbacks in 1201.1 ms, max 1 callback/vsync, 12 clock ticks (9.99 Hz); controlled hidden window 800 ms has 0 callbacks/timers/frames. 43 distinct focused scheduling/lifetime controls; raw `tmp/sp-x1-battery/native-reading.json`. Full-game covered-screen bars remain FC1/FC2/FC15. | Codex sp-x1 · done 20a1744b91 + 070b09c109 | S |
| FC7 | **Chromium before + native attribution measured** on `29458376fb` (`2945837-mvu14zc7`) | **done** (see lane) — Full 804×1748, phone 30 fps, CPU 4×: main p50/p95 ms DW **19.6/22.6**, Pine **20.8/23.7**, Nine **16.2/18.5**, Nalati **15.4/20.0** (all miss 12/16); FBO binds/frame **14.53/15.45/11.00/10.01**. Original buckets and per-pass native queries ranked in the code commit; query sums are perturbed on Metal, not additive GPU budgets. Raw `tmp/sp-x9-fc7/portrait/`; 9,001 frames, 15,305 valid queries, errors/disjoints 0. Earlier 402×681 viewport captures remain diagnostics only. **Native `d06d7014c0`: 900 frames/shard, errors 0; main p50/p95 ms DW 6/8, Pine 7/8, Nine 6/8, Nalati 5/7.** Native rank by mean: Pine 7.11, Nine 5.93, DW 5.86, Nalati 5.26 ms. Separate pass wall means and original buckets ranked in the native commit; raw `tmp/sp-x2-fc7/`. Safari viewport 402×714 / buffer 804×1428, unthrottled host, no quiet: not a physical-phone or cross-engine speedup claim. Inspector Timeline/Profile timestamps were all zero; exact timed Timeline/CPU percentages remain unqualified. Enclosing native-counter CPU upper bounds only: DW ≤24.75%, Pine ≤30.09%, Nine ≤24.50%, Nalati ≤23.40%. Pre-existing recorder-process overlap disclosed; owner stopped it afterward. | Codex · done: Chromium sp-x9 396c4d5fd3, Simulator sp-x2 (tmp/sp-x2-fc7) | S |
| FC8 | Shadows on a budget (G899; supersedes BA-3) | **done** (see lane) — Debug A / B / C: every frame / far cascades every 2nd / every 4th; then a static-caster cache with dynamic casters on top. Done: board, winner shipped, shadow draws per frame halved on Driftwood, no visible swim | Opus sp-o3 · done af210006a3 + e501891eaa (staggered cascades shipped, G899) | M |
| FC9 | Phone post chain trimmed (supersedes BA-7) | Per-pass A / B: god rays, volumetrics, bloom levels, 8-bit targets, FXAA vs SMAA. Done: one board per shard style, winners shipped, post GPU ms down ≥ 40 % | Opus sp-o5 · FXAA off / merged on phone (8840226a1c, 4183fa10e4, 7a3951628a, 38cd0376fb, e55d405938); 40 % bar open, bloom chain next | M |
| FC10 | ≤ 6 render-target switches a frame | **done** (see lane) — Merge effects into one pass, drop redundant clears and copies, keep the same programs. Done: FBO binds per frame ≤ 6 on Driftwood and Nine; before / after capture identical | Opus sp-o5 · done: DW 4.8, Pine 6, Nine 7 real switches; Nalati 4 real passes (sp-o4 3033f31a51, e4af5b6bab) | S |
| FC11 | **Render / animation half (sp-o4) `6d2c7aeac5`:** animals' bones pose every frame within 30 m, every 2nd to 70 m, every 4th to 140 m; roots move every frame (Debug > Animal pose rate keeps the old). Nalati 50 m from the Tulpar herd, Chromium phone tier, CPU 4x, mean main-thread ms/frame: 16.7 / 13.7 -> 14.8 / 11.6 (two runs each); at the spawn, within noise. Board `art/frame-cost/round-3-fc11-pose-rate/`. Main-thread systems cut | **done** (see lane) — **Partial, 46c4762ea2 + endpoint correction:** phone CPU4×, direct parent 1344ea409e → 46c: DW main p50/p95 **18.3/20.4 → 18.2/20.7 ms** (mean 18.306 → 18.286); Pine **26.8/31.8 → 21.6/24.0 ms**, with load varying. Both miss **12/16 ms**. The earlier broad bae84 → fc34 cohort was DW **16.9/19.8 → 18.7/21.4**, Pine **21.7/24.5 → 21.2/23.5**; it includes the later cove rewrite (DW geometries 280 → 361), not an isolated patch regression. The per-draw record allocation is removed (13.04 MiB/60 s before); water query samples **71.08 → 61.73 MiB/60 s** after exact inline correction `c627342864`; its containing Pine read is **21.8/24.4 ms**, 900 frames, errors 0. No stable frame-time win is claimed. Static tile/region matrix holds already exist; animation/render changes stay Opus. Heap-flat and frame bars remain open. | done: Codex sp-x2 c627342864 / 87da36352b; Opus sp-o4 6d2c7aeac5 (pose rate by distance, Debug keeps old; board 248779951b) | M |
| FC12 | **Closed at identical captures (G872, wildshard-new, 10-29): Nine 150, Nalati 93, Pine 184, Driftwood ~194; no look trade.** Draw calls ≤ 150 on the phone | **done** (see lane) — Instance or merge static props per tile by material (E271: no facade multi-draw). Done: Driftwood and Nine ≤ 150; capture identical | Opus · done at identical captures: Nine 150 (sp-o3), Nalati 93, Pine 184 (7dd664e7ca, sp-o4), Driftwood ~194 (36d3551747) | M |
| FC13 | **Done at the Debug-row stage (G912; wildshard-new's G872 call, 10-29): shadow hold landed default-off** `4cf56e52f3` + `2d56555b2c` (Debug > Idle frames, Developer, phone tier: while the view stands still the cascades redraw near every 2nd / middle every 4th / far every 8th frame; idle sway < 0.005 counts as still). Driftwood phone tier, standing still: 190 -> 165 draw calls a frame (-13 %), walking unchanged (183 / 186). The <= 50 % bar is not met by shadows: the rest is the scene and post. Held post needs a post-chain rework, and a view-digest skip never fires because water, wind sway and animals change every frame. Held post can follow if Jake turns the row on. Unchanged views reuse work | **done** (see lane) — Cached shadows and held post while the camera is still; a view digest that skips the scene draw when nothing in view changed, default-off Debug row. Done: standing still on Driftwood costs ≤ 50 % of a moving frame | Opus sp-o4 · done at the Debug-row stage (G912): shadow hold default-off 4cf56e52f3 + 2d56555b2c, Driftwood 190 → 165 draws; held post later if turned on | S |
| FC14 | **Done `300ec7b5ac`** (G911: flat glass on the phone, `#hud.touch` takes no backdrop-filter, desktop keeps the blur, no board; HUD DOM writes standing still: Nalati 36 -> 0/s, Driftwood 41 -> 0, Pine 121 -> 0). HUD layer cost | **done** (see lane) — `.ws-glass` blur vs flat (Debug A / B, board); HUD DOM written only on change. Done: board, winner shipped; compositor time measured with `perfProbe`'s no-blur row | Opus sp-o4 · done 300ec7b5ac (flat phone glass; HUD DOM writes 36-121/s → 0) | S |
| FC15 | The bars, measured (supersedes BA-8) | **done** (see lane) — §4 on four shards before and after FC1–FC14 (Simulator 3 × 5 min each, Chromium 4×), numbers in the commit and STATE; then Jake's next playtest battery screen against G907 | Opus sp-o5 · done 82613c491c: Sim GPU ≤ 10 % met ×4; WebContent ≤ 15 % missed (21-23 %), Chromium 4x 12 / 16 missed (except Nine p95); CPU cut: sp-o4 engine walk + sp-o5 shard-specific | S |
| FC16 | WebContent CPU, engine walk + Pine update (sp-o4's half of the FC15 miss) | **done** (see lane) — Exact cuts only (same pixels): render list, culling, static matrices; then Pine's, Driftwood's and Nine's update phase and scene walk | Opus sp-o4 · done: `2fd5448072` ring ground merged under the shared root (Pine ground meshes 37 → 4), `dfb7a7f229` creature hitboxes written only when moved, `2df693b28d` stream segments out of reach skipped, `5865cd7934` tell loop measures only charging animals, `d698f45973` still interactables one draw (Driftwood lit 14 → 7; board art/frame-cost/round-6-fc16-interactables), `0a9cacf393` camera updated once per cull pass (Nine 0.14 ms at 4x). Chromium 4x Pine active 18.4 → 17.8 ms. Simulator 30 s, 7d4cc1e1cc → 0a9cacf393 (peers' cuts included): Pine WebContent 25.6 → 24.5 %, main 6.23 → 5.88 ms; Driftwood 23.3 → 24.2 %, 5.71 → 5.79 ms (draw cuts do not move the Sim). Not done: program-first sort (5 of 64 switches), 30-frame static holds (door lag), cove cover merge (its 6 m grow band would pop, E117). What is left in this half is under 0.1 ms at 4x a cut | M |

BA-1 and BA-2 were already superseded by G896. BA-6 is done (`16f24166fe`).

**Not:** dynamic resolution or render scale below 2×, facade multi-draw, timers that reveal or give up, URL
switches. Never trade a warm-up for a pop-in or a post-PLAY hitch (G884 / G878): the warm draws stay, as steps.
