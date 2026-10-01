# Budget design: derived, calibrated, gated (E357 research, 2026-09-30)

Jake (E357 decision 30): a shard over its budget fails the gate, "but don't pick random magic numbers, design the
numbers better". This doc says where today's numbers came from (§0), how studios derive theirs (§1), the frame target
(§2), a derivation from device unit costs (§3), the calibration that measures them (§4), what can be gated where (§5),
and first-cut numbers from measurements already in the repo (§6). **Every number marked P is provisional** until the
first calibration run replaces its inputs. Nothing here was run: no browser, no phone, no model.

## 0. Where today's numbers came from

| Number | Where | Origin | Verdict |
|---|---|---|---|
| Phone ≤ 110 draws / 1.6 M tris | `src/ui/Perf.ts:36` (`1751b4ed`, Nalati polish 4) | none recorded | a meter threshold, not a budget |
| Phone ≤ 150 draws / 2.0 M, iPhone ≥ 55 fps | [PLAY-PERF](../../../project/archive/2026-09-22-play-perf.md) §0 | set before measuring. The phone then read **30 fps at 179 / 1.9 M** (DPR 1.25) | the best phone data point we have; never re-derived after DPR 2 (E70) |
| Nine Dragon ≤ **180 draws / 2.3 M per pose** | NINE-DRAGON-STACK §6.4, [budget.md](../../../art/nine-dragon-stack/budget.md) (`f3e7e849`) | **bottom-up**: each lane capped near its measured ex18 value, lanes summed to ~2.0 M / 175, plus ~0.3 M / 5 of headroom. No device term anywhere | it does not predict the phone: E283 read **16 fps at 121 draws / 1.1 M**, well inside the gate. The cost was per pixel (streak cards, the Jiehua program), which counts cannot see |
| M5 GPU ruler ≤ 1.5 ms per pose | [E283](../../tasks/asks/E283.md) | the only derived one: phone ≈ 6× the M5 cool, ~10× hot; 15 ms hot + ~8 ms CPU fits 33 ms | right method; §3 reproduces it |
| Cold 4G play ≤ 30 / 35.5 / 40 s and bytes ≤ 1.5× baseline | `scorecard.budget.json` (E160) | Jake's time caps + a bytes factor | the two contradict: Driftwood's 31.6 MB bytes cap alone is 28 s at Fast 4G, + 5.5 s of build = 33.6 s > its 30 s cap |
| Memory 1.8 GB loading / 1.0 GB Explorer | E264, decision 31 | Jake. The phone's **ActiveHard 2,048 MiB** was logged later ([record](../../audits/nine-dragon-mobile-multidraw.md)) | 1.8 GB = 84 % of the kill limit; §6.5 shows the headroom is the measured GC spread |

## 1. How studios derive budgets (not guess them)

| Practice | Who | What it means here |
|---|---|---|
| **A named device, a frame rate, a measured capacity, then division** | Epic's mobile guideline (≤ 700 draws, ≤ 500 k tris per view): the triangle figure "has been determined to be the maximum poly count that can hit 30fps on both iPad4 and iPad Air" ([Epic][ue-mobile]) | a calibration on a reference device, not a taste call: ours is Jake's iPhone 17 Pro, hot |
| **GPU budget as arithmetic** | Arm: fragment cycles per pixel = cores × Hz ÷ (fps × pixels); a Mali-T880 MP12 at 650 MHz has ~63 at 1080p60, ~35 at QHD ([Arm][arm-gpu]). Mobile Studio holds a budget per metric group, checked daily in CI ([Arm][arm-ci]) | the same division with a *measured* rate (§4 sweep 4) instead of a spec sheet |
| **Thermal headroom** | Unity: spend ~65 % of the frame on mobile, 22 ms at 30 fps, and profile the lowest device per tier ([Unity][unity]). The 17 Pro keeps **64 %** in 3DMark Wild Life Extreme's 20-loop stress test ([GSMArena][gsm]). Apple: 30 fps is the minimum, hold one rate consistently ([Metal guide][apple-fps]); lock 30 if 60 can't hold 10 min (WWDC18 612, E189) | on this phone Unity's 65 % *is* "budget at the throttled clock"; we measure the hot clock directly |
| **Per-system ms on a named device** | Genshin: 0.5 ms of AI on an A12 at 60 fps ([GDC 2021][genshin]). Unreal's Animation Budget Allocator: a fixed per-platform ms, met by throttling tick rates ([Epic][ue-aba]). CoD Mobile steps art-approved knobs as the phone heats ([Samsung][codm]) | §6.2's split, and the decision-23 scheduler meets it |
| **Passes cost bandwidth** | Apple GPUs keep a pass in tile memory; every extra pass stores and reloads the whole target ([Apple][apple-tbdr]) | a post pass is a fixed per-pixel price (§4 sweep 5) |
| **Load = time × network** | Russell derives web budgets from a P75 device + network; 2026: 9 Mbps, 100 ms RTT ([2026][russell26], [method][russell17]) | the repo's Fast 4G (9 Mbps, 170 ms) matches; bytes follow from the time cap (§6.6) |
| **Regressions are statistical** | Perfherder: t-tests of 12–24 runs a side, still 12.5 % false alerts ([paper][perfherder]) | ms gates re-run once and compare medians; counts gate exactly |

## 2. The target: 30 on the hot phone, 60 on desktop

The phone frame is noisy: p95 / p50 on Jake's phone read 81 / 63 and 59 / 45 ([E283](../../tasks/asks/E283.md)), so **v = 1.3**. A pose
passes when its **p50 at the worst pose, hot, ≤ T ÷ v**. CPU and GPU are summed (serial) until calibration shows they
overlap (§4 sweep 6); the serial model is the safe side.

| Target | T ms | Frame budget T/v | CPU (hot phone) | GPU (hot phone) | = M5 ruler (÷10) | Draws (§3) | Status |
|---|---|---|---|---|---|---|---|
| **Phone 30** (E193 lock, decision 31) | 33.3 | **25.6** | 9.6 | 16.0 | **1.6 ms** | ~140 | **what the numbers assume** |
| Phone 60 (the finished-game goal) | 16.7 | 12.8 | 4.8 | 8.0 | 0.8 ms | ~70 | a different game, not a tuning pass: every phone number halves. A printed goal column; enforced only in the practice arena (E290) |
| Desktop 60 | 16.7 | 12.8 | on a named min-spec | on a named min-spec | — | — | ratchet (§7) until Jake names the min-spec desktop |

## 3. The derivation

**Unit costs** (measured by §4, per device, per thermal state): `c_draw` CPU µs per draw submitted · `c_tri` GPU ns per
triangle (per vertex class: static, skinned, wind) · `c_px[class]` GPU ns per fragment (flat, lit/toon, PBR,
alpha-tested, blended) · `c_pass[fmt, scale]` GPU ms per full-screen pass · `c_link` ms per program link · `c_rig`,
`c_body`, `c_agent` CPU ms per animated rig, physics body, AI agent · `θ` hot ÷ cold · `R` phone-hot ÷ M5 per unit.

```
B_frame   = T / v                                    (v = measured p95/p50 on the phone)
B_cpu     = allocation (today's hot CPU + room)      B_gpu = B_frame − B_cpu    (serial; = B_frame if pipelined)
B_gpu_M5  = B_gpu / R_hot                            the Mac GPU gate's per-pose number
draws     ≤ (B_cpu − Σ system budgets − GC reserve) / c_draw
tris      ≤ B_gpu × share_vertex / c_tri
pixels    : Σ_class layers_class × px × c_px[class] + Σ passes c_pass ≤ B_gpu × share_pixel
programs  ≤ B_link / c_link                          (B_link = shader warm-up's share of the warm launch)
entities  ≤ system budget / c_rig | c_body | c_agent (feeds the decision-23 tick scheduler)
memory    ≤ L − GC spread − sampling margin          (L = the jetsam limit from the phone's own log)
bytes     ≤ (T_play − k × T_fixed) × throughput      (T_play = Jake's time cap; k = phone ÷ M5 CPU)
```

- **One cost model, gated anywhere.** Predicted phone ms = `a + draws·c_draw + tris·c_tri + Σ frags·c_px + passes·c_pass`.
  Counts come from any browser; the M5 ruler checks the model's residual per push, and a residual over 25 % flags a
  re-calibration. Per-program shader cost is the one term only a GPU sees (E283's miss), so the M5 ms gate stays.
- **The manifest holds inputs, not numbers**: target fps per tier, lane allocation, time caps. `engine/budget/derive.ts`
  (pure, vitest-tested) computes every budget from them and `calibration/*.json`, and the gate prints each with its
  formula and inputs; a re-calibration re-derives every shard with no edits. The whole-frame ms is hard; lanes are
  advisory ("cut before adding", as Nine Dragon's work), so a shard spends ms where its look needs it.

## 4. Calibration

**The scene.** `engine/calibrate`: no shard, synthetic content, started from Debug ▸ Developer tools ▸ RUN CALIBRATION
(a button row like the perf probe's RUN PROBE; no URL switch; scripts set it with `debugSettings`). It runs uncapped
(`frameProbe.uncapped`), at the phone's fixed 2× (804×1748 = 1.41 Mpx), and **posts its JSON to the inbox itself**, so
Jake's only step is one tap on battery (not charging) and ~6 minutes of not touching the phone.

| # | Sweep | Varies | Reads | Gives |
|---|---|---|---|---|
| 1 | Draws | 0 / 100 / 200 / 400 / 800 tiny meshes, one program | main-thread submit ms, gpu~ | `c_draw` CPU and GPU, the fixed cost `a` |
| 2 | State | the same draws over 1 / 8 / 32 programs, 1 / 16 textures | submit ms | program / texture switch cost |
| 3 | Triangles | one instanced mesh, 0.25 → 4 M tris, static / skinned / wind vertex shaders | GPU ms | `c_tri` per vertex class |
| 4 | Fill | 1 → 8 full-screen layers per class (flat, toon, PBR, alpha-test, blend) | GPU ms | `c_px[class]` (Arm's cycles/pixel, measured) |
| 5 | Passes | full-screen RGBA8 / RGBA16F passes at 1, ½, ¼ scale | GPU ms | `c_pass`: the post chain's price |
| 6 | Overlap | sweep 1 × sweep 4 together | frame vs CPU + GPU | the combine rule: serial (sum) or pipelined (max) |
| 7 | JS | N skinned rigs, Rapier bodies + character controllers, navmesh queries | frameCost buckets | `c_rig`, `c_body`, `c_agent` |
| 8 | Link | compile + link N programs with `KHR_parallel_shader_compile` | wall ms | `c_link` |

**Protocol.** Cold pass first (the first 30 s); then a pre-heat of sweep 4 at full load until the frame stops rising
(< 2 % per 30 s; E189 saw 17 → 24 ms in 1–2 min); then every sweep hot, each row against an interleaved baseline (the
warm phone flips between a fast and a slow state, E189). θ = cold ÷ hot per unit. Low Power Mode is detected and
flagged; since Jake playtests in it, one extra LPM pass records θ_LPM. The same scene runs headless on the M5
(`scripts/calibrate.mjs`, browser lane, Metal, frozen-frame timing as `pine-hollow-gpu.mjs`), which gives `R` per unit.
**It never probes the memory limit** (that kills the page): `L` comes from the phone's jetsam log.

**Re-calibrate when** iOS or WebKit changes (the game sees the UA change and nudges in developer mode), three.js is
upgraded or the renderer / post chain is rewritten, the reference device changes, the M5-predicted and phone-read frame
differ by > 25 % on a playtest, or else quarterly. Files: `calibration/<device>-<os>-<date>.json`, never edited by hand.

## 5. What can be measured where

| Measure | Renderer-independent? | Runs on | Gate |
|---|---|---|---|
| Draws, triangles per pinned pose (`game.lastFrame`) | yes, given tier, viewport, FOV, pinned time / weather, seeded rng | any browser machine, even GPU-less headless | per push, hard; band ±5 draws / 10 % (moving creatures, scorecard `drawcalls`) |
| Programs, textures (`renderer.info`) | yes | any | per push, hard |
| GPU bytes counted at the GL API (scorecard's hooks) | yes: what the page asks for, not what the driver keeps | any | per push, hard |
| Overdraw layers by class (`pine-hollow-gpu --overdraw`) | yes: fragment counts | any GPU browser | per push → the cost model's pixel term |
| Bytes, requests, cold / warm play on shaped 4G | bytes yes; seconds ±25 % | the Mac (bench, scorecard) | bytes hard; seconds as a p50-of-3 trend |
| GPU ms per pose (frozen frame, A/B interleaved) | **no** | the Mac GPU gate (MW3) | hard at `B_gpu_M5`, re-run once before red |
| CPU ms per system (frameCost buckets at 4× CPU) | no (a proxy) | the Mac | trend now; hard once `k` is calibrated |
| Hot frame p50 / p95, unit costs | no | **the M5 run × the phone : M5 ratio** (E283: ~10× hot; an assumption, E357 decision 99: no phone run) | calibration + acceptance, not per push |
| WebContent native footprint | no | Simulator nightly (watchdog), phone manual (decision 31) | nightly hard on the Simulator at 1.8 / 1.0 GB |

## 6. Provisional numbers (P), from measurements already in the repo

### 6.1 Frame, phone 30, hot (inputs: [E283](../../tasks/asks/E283.md), [E189](../../tasks/asks/E189.md), [GSMArena][gsm])

- `v` = 1.3 (p95 / p50: 81 / 63, 59 / 45). `R_hot` ≈ 10 (gpu~ 22.7 ms where the ruler reads ~2.3 ms); `R_cool` ≈ 6.
  `θ` ≈ 0.6–0.71 (the 6 → 10 ratio; the pier's 17 → 24 ms), 0.64 in 3DMark.
- `B_frame` = 25.6 ms. `B_cpu` = 9.6: the hot phone's CPU today is 6–8 ms (update 2–3, submit 4–5, E283), + ~25 %.
  `B_gpu` = 16.0 ms hot = **1.6 ms on the M5 ruler** (E283's 1.5 ms is the same derivation, rounded down).
  `c_draw` ≈ 34–40 µs (submit 4 ms at 118 draws, 5 ms at 125; an upper bound, as it includes the scene walk).

### 6.2 CPU per system, phone 30, hot, ms p50 (P; the total is derived, the split is a proposal for Jake)

| Render submit | Physics | AI (think + nav) | Animation (pose + skin) | Player + weapons | World / FX / cull | HUD | Audio | GC reserve | Total |
|---|---|---|---|---|---|---|---|---|---|
| 5.0 | 0.8 | 0.8 | 1.0 | 0.4 | 0.5 | 0.3 | 0.2 | 0.6 | **9.6** |

Anchors: Nine Dragon's calm hot update is 2–3 ms; Pine Hollow's fight read 4.7 ms p50 at the 4× CPU proxy ([E142](../../tasks/asks/E142.md));
Genshin's 0.5 ms AI at 60 fps is 1.0 at 30. Render submit 5.0 ÷ 34–40 µs → **draws ≤ ~140 P** (125–147).

### 6.3 GPU lanes, phone 30, hot (P; proposed split of the derived 16.0 ms; M5 ruler ms in brackets)

| World opaque | Foliage + alpha-test | Shadows | Transparent / FX | Viewmodel | Post + sky | Reserve (HUD compositing) | Total |
|---|---|---|---|---|---|---|---|
| 5.0 (0.50) | 3.0 (0.30) | 2.5 (0.25) | 1.5 (0.15) | 1.0 (0.10) | 2.0 (0.20) | 1.0 (0.10) | **16.0 (1.6)** |

Today: Driftwood's interior grass pose spends 42 % on ground cover and ~30 % on shadows ([E189](../../tasks/asks/E189.md)); Nine Dragon
before its cuts spent 1.41 ms (M5) on transparents, 1.03 on opaque, 0.17–0.41 on the viewmodel, ~0.6 on post + sky
([E283](../../tasks/asks/E283.md)). Those lanes are over; the whole frame is the hard gate. The budget is 11.4 ns of hot GPU per pixel per
frame; at 3 layers of overdraw, ~3.8 ns per fragment.

### 6.4 Counts per pose (P)

| Tier | Draws | Triangles | Programs | GPU MB (GL API) |
|---|---|---|---|---|
| Phone | **≤ 140** (§6.2) | **≤ 2.0 M**: the one phone reading at that count held 30 (179 / 1.9 M, [PLAY-PERF](../../../project/archive/2026-09-22-play-perf.md)); hot-verified only at 0.76 M. The least-derived number: sweep 3 replaces it | **≤ 110**: today's max 106 ([scorecard](../../../progress/scorecard/baseline.md)); `c_link` sets it | ratchet at today's: Driftwood 373, Pine 317, Nalati 201 ([scorecard](../../../progress/scorecard/baseline.md)) |
| Desktop | ratchet (Driftwood pier 868) | ratchet (Pine 8.3 M) | ratchet (113) | ratchet (Pine 1,377) |

Nine Dragon's worst pose (160 draws, 1.67 M) is over the draw number and under the triangle number. **Sweep 6 decides
the draw budget**: pipelined, `B_cpu` grows to ~25 ms and draws to ~500–600; serial, it stays ~140. Of Driftwood's 264 MB
of GL textures on the phone, only ~32 MB are material textures; the other ~230 MB (render targets, PMREM, shadow and
uniform-bound maps) are the first memory lever.

### 6.5 Memory, phone (decision 31 keeps 1.8 / 1.0 GB, decimal, WebContent native footprint)

- `L` = ActiveHard 2,048 MiB = 2.147 GB (the phone's jetsam log). 1.8 GB = `L` − 0.35 GB, and GC timing alone spreads a
  load peak by ±0.1–0.3 GB ([Nalati audit](../../audits/nalati-load-memory-2026-09-29.md)): the cap is derivable. Gate native footprint only; the Inspector's sum reads ~2×.
- Explorer 1.0 GB has no device derivation (Jake's): room for play-time garbage and for a backgrounded PWA to survive.
  Native today: Nine Dragon 0.37–0.39 GB, Driftwood ~0.49 GB (Simulator, [watchdog](../../ios-memory-watchdog.md)). Live items: JS ~0.3 GB after the peak (audio 0.18), Rapier wasm 7 → 26 MB.
- **Open:** the Simulator's WebKit GPU process peaked at 0.256 GB, apart from WebContent. Its phone limit is unknown, so
  GPU MB stays a ratchet until one jetsam-log reading names it.

### 6.6 Load, phone (Jake's time caps stay; the bytes are derived from them)

`T_fixed` = cold 4G play − bytes ÷ 1.125 MB/s ([scorecard](../../../progress/scorecard/baseline.md) baseline). `k` = 1 is the M5; `k` = 2 a guess at the phone until sweep 7 measures it.

| Shard | Cold 4G cap | Bytes today | T_fixed (M5) | Derived bytes cap, k = 1 … 2 | Bytes rule enforced today |
|---|---|---|---|---|---|
| Driftwood | 30 s | 20.4 MB | 5.5 s | 27.6 … 21.4 MB | 31.6 MB (inconsistent with 30 s) |
| Nalati | 35.5 s | 29.6 MB | 5.2 s | 34.1 … 28.2 MB | 45.6 MB |
| Pine Hollow | 40 s | 35.9 MB | 3.0 s | 41.7 … 38.4 MB | 56.4 MB |

Warm launch stays ≤ 4 s at the 4× CPU proxy ([bench](../../../bench.budget.json)); `c_link` divides shader warm-up's share of it.

## 7. Rollout

1. `derive.ts` + the manifest's inputs + `calibration/provisional.json`, which holds §6's inputs, each with its source.
2. The gate goes live on counts, M5 GPU ms and load bytes. **A shard that is over a P number today gets its current worst
   as its ceiling** (a ratchet: it may only go down), with the derived number printed as its target. No shard turns red
   without a change.
3. One M5 calibration (`scripts/calibrate.mjs`, headless) × the E283 hot ratio (~10×) writes `budgets/calibration.json`;
   there is no phone run (E357 decision 99), so the phone numbers are an assumption, stated in the file. The derivation
   re-runs: numbers move, formulas don't. A shard still
   over becomes cut rows under Jake's perf-cut rule (default-off Debug rows, before / after).
4. MW8's thermal governor and MW6's tick scheduler take their ms budgets from §6.2 / §6.3, not from constants of their own.

[ue-mobile]: https://dev.epicgames.com/documentation/en-us/unreal-engine/performance-guidelines-for-mobile-devices?application_version=4.27
[ue-aba]: https://dev.epicgames.com/documentation/en-us/unreal-engine/animation-budget-allocator?application_version=4.27
[arm-gpu]: https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/gpu-processing-budget-approach-to-game-development
[arm-ci]: https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/game-cost-budgeting-and-more-with-mobile-studio-2020-2
[unity]: https://unity.com/how-to/best-practices-for-profiling-game-performance
[gsm]: https://www.gsmarena.com/apple_iphone_17_pro-review-2887p4.php
[apple-fps]: https://developer.apple.com/library/archive/documentation/3DDrawing/Conceptual/MTLBestPracticesGuide/FrameRate.html
[apple-tbdr]: https://developer.apple.com/videos/play/wwdc2020/10632/
[genshin]: https://media.gdcvault.com/GDC+2021/20210528_+GDC21_shuo_presentation+_Final.pdf
[codm]: https://developer.samsung.com/galaxy-gamedev/gamedev-blog/cod.html
[russell26]: https://infrequently.org/2025/11/performance-inequality-gap-2026/
[russell17]: https://infrequently.org/2017/10/can-you-afford-it-real-world-web-performance-budgets/
[perfherder]: https://arxiv.org/html/2606.18377v1
