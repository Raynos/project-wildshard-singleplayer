# Infinite Wildshard loading: mini plan (G619)

**Jake's picks (G622):** D1 a 3 s reveal any touch skips · D2 superseded by G626: the home shard streams by its 8 × 8 baked tiles, spawn tile + ring first, the rest nearest-first (H3 = spawn view first by tiles) · D3 home first, neighbour placeholders (far proxies) for the descent · D4 no frame over 100 ms after controls.

Jake, 2026-10-22 (G619): players start **inside their home region (Driftwood), made faster**, not on the road. Target
**tap → controls under 5 s warm and under 15 s cold** on the Simulator / phone tier, every step budgeted, measured with
the same recording before and after. Grid loading stays in-world after the loader (G578). G618's five fixes are the
first rows.

**"Controls"** = the first frame where a stick or tap moves the player (today: the reveal's end, `__wsReveal.endedMs`).
**Baseline** = round 40 Simulator recording on live ec4ca6f85 (`art/grid/round-40-sim-grid-entry/`), iPhone 17 Pro
Simulator Safari, Developer on: cold 35.8 s, warm 18.6 s tap → controls. About twenty loading commits have landed since (to abc3e8ff16)
(listed in the budget's last column); none has been measured on the Simulator yet, so row M1 re-baselines first.

## 1. The budget (seconds, tap → controls)

| # | Step (loader row) | Warm budget | Warm today | Cold budget | Cold today | Landed since ec4ca6f85 that should already move it |
|---|---|---:|---:|---:|---:|---|
| 1 | Tap → loader painted | 0.2 | 0.1 (Sim); phone: visible freeze | 0.2 | 0.1 (Sim) | b0aa47b827 (page routes before the 3.2 MB game graph) |
| 2 | 1 · Application modules | 0.3 | 0.44 | 0.5 | 0.47 | b0aa47b827 |
| 3 | 2–8 · admission, region world, renderer, HUD, gameplay | 0.3 | 0.28 | 0.6 | 0.55 | none |
| 4 | 9 · World assembly (25 cells, 96 seams, road) | 0.6 | 2.8 | 1.0 | 1.9 | 675c5e83c3 (baked edges), 5932b6eca5 (road beside steps), 8a8facb65e (no prefetch on the cache queue) |
| 5 | 10 · Title art · explore | 0 | 0.01 (phone 13.8, one 10.8 s frame) | 0 | 0.01 | 99f142d942 (skipped in grid mode), dd590b3552 |
| 6 | 12 · Home region (Driftwood) | 1.5 | 4.8 | 8.0 | 22.1 | 8a8facb65e (prefetch after play), 968a93abe6 (no page re-hash), 27ca9a9f42 + 380be0bbfa (warm-ups leave shaders), 0c16f57471 |
| 7 | Gaps + pass-2 steps (13–15) | 0.2 | 0.58 | 0.4 | 1.25 | none |
| 8 | 16 · Shaders (161 programs) | 0.8 | 2.1 | 1.0 | 2.0 | e4b4e1a847 (drawn only), 6c4b4e33e0 + 92bba7c1ba + ae8ed1fd6a (node-build reuse on); c862a20fa4 (shared programs, default off) |
| 9 | 17–19 · First frame, audio, 250 ms fade | 0.4 | 0.4 | 0.5 | 0.35 | 2416aec1a4 (no broken frame; canvas hidden until the reveal draws) |
| 10 | Reveal → controls | 0.5 | 7.0 (path 7.0, rings 2.3) | 0.5 | 7.0 (rings 3.4) | none |
| | **Total** | **4.8** | **18.6** | **12.7 (+2.3 margin)** | **35.8** | |

Reading: warm is the reveal (7.0 s fixed, `reveal.ts:53` `PATH_S = 7`) plus the home region, assembly and shaders.
Cold is the home region (22.1 s, with "4 in flight": `worldScenes.ts:168-172` reads placements in windows of 4, each
waiting for the slowest, beside the grid prefetch's 434 cache writes on the same serial worker queue). Warm assembly
(2.8 s) was slower than cold (1.9 s) because the warm prefetch's ~4,000 cache checks queued ahead of its edge reads.
Chromium 4x warm on HEAD: tap → play 13.0 s region start (STATE), 4.7–5.0 s road start (so ~8 s of that is the home
region and its shaders).

## 2. Rows

Lanes: one Opus lane (graphical: what the first frame and the reveal show) and two Codex lanes (engineering).
Slices land on Chromium 4x quick checks; the Simulator recording (M1) runs per wave (milestone), the iPhone once at
the end (G558). Numbers go in commit messages (G506), no receipts.

| Row | What | Code (HEAD) | Saves warm / cold | Lane | Size | Done when (re-recorded) | Deps |
|---|---|---|---|---|---|---|---|
| **M1** | The recording as a script: commit the round 40 driver (`drive.mjs`, `board.py`) as `scripts/sim-grid-entry.mjs`; served build (`serve-build.sh --rev`) or live; cold reset + warm; 3 runs, medians; logs tap → loader paint (video), each step, loader end, reveal start, controls, worst frame, and a broken-frame check (frame diff against the loader / world). Re-baseline HEAD first. | scratch `sim-grid-entry/drive.mjs`; `scripts/sim-lane.sh` | 0 | Codex | 0.5 d | HEAD baseline cold / warm committed in its message | none |
| **X1 — done `abc3e8ff16`** | Jake picked the home start: the 'Start of play' Debug row and the road-start branch are deleted (E451) | — | 0 | — | — | done | — |
| **C1** | G618 (3): cache reads never wait behind writes: the worker's one `tail` queue becomes a read lane plus a low-priority write lane (pins still precede their puts); cold first-play bytes build from the network response, the cache put follows off the critical path | `engine/boot/contentCache.worker.ts:29-41`, `contentCache.ts` | 0.5–1 / 2–5 | Codex | 0.5 d | warm Home region ≤ 3.5 s, cold ≤ 15 s | M1 |
| **H2** | Home reads issued up front: one bounded pool (~16) over the home load's declared file list at section admission, replacing placement windows of 4 and the serial catalogue / weld / recipe / packet awaits | `game/shardfile/worldScenes.ts:100`, `:136`, `:165-172`, `:205`, `:213` | 0.5–1 / 4–8 | Codex | 1 d | cold Home region ≤ 10 s | C1 |
| **H3** | Spawn-critical home first (D2): measure the home load per file (bytes, step, distance from spawn); before controls build terrain, colliders, the pier and everything in the spawn view or within ~150 m; the rest of the island builds in play inside the first ~10 s, never popping inside the view | `grid/liveSession.ts:573-600` `enterInitialHome`; `worldScenes.ts` steps | 1–2 / 4–8 | Opus | 1.5 d | warm Home region ≤ 1.5 s, cold ≤ 8 s; no pop-in in the reveal / spawn view | H2, D2 |
| **H4** | Home region CPU after C1/H2: profile the warm step (Chromium 4x + Sim) and cut the top three (2,102 colliders, validators, parses) | `liveSession.ts:573-600`, `shardfile/product.ts` | 0.5–1 / 0.5–1 | Codex | 1 d | warm Home region budget met with H3 | C1, H2 |
| **A1** | Ring-first assembly (D3): before controls only the home and its 8 neighbours' seams, road and far proxies; the outer 16 cells' seams and the phone's 4 near views build in play (in-world, G578); `ringsReady` no longer gates controls | `game/grid/session.ts:309-356` | 1–2 / 0.5–1 | Codex | 1 d | World assembly ≤ 0.6 s warm, ≤ 1.0 s cold | M1, D3 |
| **P2** | G618 (4) rest: pass-2 steps declared up front (fixed step total); product admission pass 2 (0.49 s, 5 schemas) starts during Home region with cached validators; the 0.46 s cold gap after Home region named and removed | `engine/boot/timeline.ts:77-91`; `finish.ts:41-55` | 0.4 / 0.8 | Codex | 0.5 d | rows 13–15 + gaps ≤ 0.2 s warm, 0.4 s cold; step total never grows | M1 |
| **S1** | Shaders: shared programs (c862a20fa4) on by default after verify; the first frame's programs start compiling (parallel compile) as soon as the spawn view's materials exist, inside Home region | `finish.ts:64-76`; `engine/render/precompile.ts` | 0.8–1.2 / 0.6–1 | Opus | 1 d | Shaders ≤ 0.8 s warm, 1.0 s cold; frames match | M1 |
| **S2** | Warm shader cache: keep each graph's generated code by its graph-shape key (`nodeBuildReuse` key) in the content cache; a warm entry skips the TSL builds | `engine/render/nodes/nodeBuildReuse.ts`, `render/graph/compile.ts` | 0.5–1 / 0 | Codex | 1.5 d | warm Shaders ≤ 0.5 s | S1 |
| **G1 — source `2416aec1a4`** | G618 (5) glitch frame: the reveal now hides the HUD and canvas at install and shows the canvas on the first gated frame (the frame gate stays shut ~0.4 s after the loader until the home is gameplay ready, so the canvas showed the warm-up draws). Verify only; the ~0.4 s closed-gate wait is folded into R1 | `reveal.ts`, `play.ts` | 0 (quality) | Opus | verify | no broken frame in 3 cold + 3 warm M1 recordings | M1 |
| **R1** | The reveal per D1: shorter path, and input live from loader end (a stick or tap takes over); controls no longer wait for `ringsReady` / the road (soft walls hold what is not ready) | `reveal.ts:53`, `:77`, `:127-136`; `finish.ts:116-119` | 6.5 / 6.5 | Opus | 0.5 d | reveal → controls ≤ 0.5 s | D1, G1 (same file, same lane) |
| **T1** | Tap freeze on the phone: the tap does a full navigation (`travel`); paint the pressed card and the loader shell on the tap, before navigation; check `pageShell` paints before module evaluation | `grid/pageEntry.ts:36-47`; `grid/pageShell.ts`; `index.html` | 0 Sim / 1–3 phone | Codex | 0.5 d | loader visible ≤ 0.2 s after tap in the Sim video (phone at M2) | M1 |
| **M2** | Final check: M1 cold + warm on HEAD meets both budgets; then Jake's iPhone check (G558), the only phone step | — | — | coordinator | — | Sim warm < 5 s, cold < 15 s; Jake's word on the phone | all |

Order: M1 first (it also verifies G1); wave 1 = C1, H2, P2, T1, R1 (after D1), S1; wave 2 = H3 (after D2), A1 (after D3), H4, S2.
Expected after wave 1: warm ~6–7 s, cold ~14–18 s. After wave 2: inside both budgets, cold with the least margin
(it depends on H3's critical-set size and the Simulator's network).

## 3. Decisions for Jake (option 1 is Skip when asked)

- **D1 · The sky-down reveal (G98, 7 s fixed).** At 7 s it alone exceeds the warm budget. (a) Keep 7 s, first-ever
  entry only; returning entries land at the eye. (b) **1.5 s descent, controls live from the first frame (any touch
  takes over).** (c) No reveal: the loader fades to the player's eye. Recommend **(b)**.
- **D2 · Driftwood in the first seconds.** (a) Everything before controls (today). (b) **The spawn view and ~150 m
  around it before controls; the rest of the island builds in play within ~10 s, never in view.** (c) Lower detail
  everywhere first, upgraded in place. Recommend **(b)**: full detail where you look, no visible upgrade.
- **D3 · Neighbours at controls.** (a) All 25 cells' seams and the phone's 4 near views before controls (today).
  (b) **Home + 8 ring before controls; outer 16 and near views fill in over the first ~5 s of play** (far, in-world).
  Recommend **(b)**; G607's render-everything stays, just after controls.
- **D4 · Hitches after controls.** Moving work after controls costs frames. (a) No frame over 100 ms in the first 10 s
  (slower entry). (b) **Worst frame ≤ 250 ms in the first 10 s (today 167–217 ms on Chromium 4x).** Recommend **(b)**.

## 4. Estimate

At today's lane count (5 Opus + 5 Codex, mostly on Nalati and CI speed), with **1 Opus + 2 Codex** on this plan:
M1 half a day; wave 1 about 1.5 days; wave 2 about 2 days; **about 4 lane-days, ~2–3 calendar days**, then
Jake's phone check. Warm < 5 s is likely (the reveal is 6.5 s of the 13.6 s gap); cold < 15 s is the riskier half and
hinges on C1 + H2 + H3 together.

### L18 implementation slices (G734, sp-x8)

| Slice | Work | Status |
|---|---|---|
| L18.1 | Typed tier selection before transport and download declaration; matching boot reserve; preserve exact admission, offline re-entry and tier changes. At most one hour. | done (2026-10-24, sp-x8) |
| L18.2 | Explorer, comparison and simulation inputs on demand with real progress; bounded implementation slices after the crossing measurement. | open |
| L18.3 | Reduce or stream the remaining entry geometry without changing its appearance; bounded slices after attribution. | open |
| L18.4 | Verify production compression of GLB and BIN responses. | open |

## The update pill (Jake, 2026-10-23 09:33, iPhone screenshot on ab93dccfe: *"Pressing the updating button takes forever. I just expected to refresh the page. I don't know why refreshing the page takes so long."*)

The pill (`src/engine/ui/Update.ts`) shows "UPDATING…", waits up to the service worker's adopt cap for a waiting
worker, then replaces the page with a cache-busted URL. The new build then boots with new content hashes, so every boot
pack downloads again, and the new worker installs alongside. To Jake that is a refresh that takes as long as a cold start.

| Row | What | Owner | Done when |
|---|---|---|---|
| U1 | Measure one tap → title on the new build on the Simulator from a build several deploys old: adopt wait, reload, worker install, boot-pack bytes re-downloaded vs unchanged | Codex | the wait is split into its parts, numbers in the commit |
| U2 | Fix the biggest part: unchanged packs keep their URLs across builds (content-hashed, so only changed packs download), the adopt wait drops when no worker is waiting, the worker's install never blocks the reload | Codex | tap → title ≤ 5 s on the Simulator after a typical deploy |
| U3 | The pill keeps showing progress (bytes or steps) instead of a static "UPDATING…" | Codex | no static label for more than 1 s |
| U4 | **Update progress screen (G715, E502):** tapping the pill opens a full-screen modal in the loading screen's style showing real progress (new build found → downloading boot-pack bytes → installing → reloading) until the title shows on the new build; folds U3 in | Codex | from the tap, the modal shows a moving step or byte count at least every second until the new build's title; Simulator capture of a tap on an old build |
| L16 | **in flight (2026-10-24, sp-x9), slice 1 ≤1 h:** first-document hero/boat + handoff; slice 2 cold PWA capture/acceptance. **Launch black screen (G716, live regression, first):** a cold home-screen launch shows black ~7 s before the title. Bisect when the instant hero stopped painting (`title-first` hides the first-paint panel until the title's JS runs), fix forward; then paint the title hero + a boat progress bar inline from `index.html` (no bundle) until the title mounts | Codex | Simulator cold PWA launch paints the hero within ~0.5 s and never shows black; the regression commit named in the fix |
| L17 | **Hold at loading screen (G732):** Settings ▸ Developer toggle; when on, a finished load (shard, shardfile, LEGACY, Infinite Wildshard) stays on the completed loading screen with all steps and timings, and a PLAY button over it enters | Codex | toggle on: every entry stops at 100 % with PLAY; toggle off: unchanged auto-enter; phone-tier capture |
