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

### L18 implementation slices (G734, sp-x8 L18.1; sp-x2 L18.2–4)

| Slice | Work | Status |
|---|---|---|
| L18.1 | Typed tier selection before transport and download declaration; matching boot reserve; preserve exact admission, offline re-entry and tier changes. At most one hour. | done (2026-10-24, sp-x8) |
| L18.2 | Explorer, comparison and simulation inputs on demand with real progress; retain each synchronous gameplay reader. | done (2026-10-25, sp-x2): cheap safe cuts `37709250b2` + progress `218118499e`; live assembly and whole-library readers remain synchronous. Further geometry deferral is unsafe; target not met. |
| L18.2a | Trace named-file readers and progress before changing the entry bank. | done (2026-10-25, sp-x2 audit): assembly JSON has a live quest-composition reader and stays admitted. Explorer choices already read selected geometry on demand, but entry still fetches it; model readiness/compare images need G729 progress before further deferral. |
| L18.2b | Drop manifest-only product image copies; live authored URL readers stay unchanged. Protect map/card/host, critical and dependency uses; preserve the descriptor and verified late reads/offline refusal. At most one hour. | done (this code commit): checked DW phone entry 81,240,976 B /314 → 78,344,952 B /299; desktop 93,697,134 B /314 → 90,801,110 B /299 (−2,896,024 B /15 each). Declared blob content, not observed network or time. Exact receipt retains image pixel/wire reserve without fetching duplicate bodies. Focused tests, touched-layer types and typed lint pass. G729 UI progress is still open; no new lazy UI path here. |
| L18.2c | Existing Model Explorer and Compare loads show a spinner and completed preparation counts; stale/closed views cannot be painted by earlier work. At most one hour. | done (this code commit): model/card readiness and comparison-picker/pair decodes drive real task counts, with visible live failures and silent retired-owner cancellation. Engine/test declarations and touched typed lint pass; focused lifecycle/decode cases retained. Entry bytes/files unchanged (0 B /0 files); this is the G729 prerequisite, not an additional deferral or performance claim. |
| L18.3 | Lighter foliage, rocks and protos; variant sheet for Jake before any appearance change. | in flight (2026-10-26, sp-o3; slices L18.3b–e below). Was waits-Opus (2026-10-25, coordinator call): DW remains 78,344,952 B /299 declared phone files, above the ~19.05 MB target. Three largest live GLBs: meshopt raw 16,770,480 → 10,343,748 B, but gzip-9 delivery 5,806,920 → 8,653,016 B (+49%); rejected. Whole-library geometry has live readers, so tile deferral is unsafe. No geometry write; engineering stops here. |
| L18.3b | Rock batches (shore, small) keep exact float32 positions but ship normals as normalized Int8 and colours as normalized Uint16 through the GLB writer's `nativeAttributes` path (the intake restores typed channels): about −45 % raw per vertex; pixel diff against today. At most one hour. | done (e2cac37ae6, sp-o3): shore 6,468,052 → 3,773,580 B, small 4,498,140 → 2,624,464 B (−4.57 MB declared); pixel parity on landed previews (only animation differs; normal shading error < 2/255). |
| L18.3c | The same storage for the foliage batches (palms, hibiscus, reef; `_SWAY` as half floats). At most one hour. | in flight (sp-o3) |
| L18.3d | `world/island/protos.glb` (72 indexed meshes) on the same typed storage. At most one hour. | open (sp-o3) |
| L18.3e | Only if declared bytes stay far above target: fewer-triangle foliage / rocks / protos as a labelled variant sheet for Jake before any appearance change. | open (sp-o3) |
| L18.3a | World construction reads only `cells[TIER]`; use that same typed choice in admission and compiler totals. Shared/critical/dependency refs still retain either bank. | done (this code commit): phone 84,464,908 B /315 files → 81,240,976 B /314; desktop 96,907,800 B /315 → 93,697,134 B /314. Exact checked production inventory, declared blob content only; no measured network or loading gain. 75 focused cases, format types and scoped typed lint pass. |
| L18.4 | Verify production compression of GLB and BIN responses. | done (2026-10-25, sp-x2): production Driftwood GLB `07cd00fb…` (210,048 B content) and BIN `13fd9051…` (138,228 B) both return HTTP 200 / `Content-Encoding: br` with `Accept-Encoding: gzip, br`; index also Brotli. No server/config change or byte delta. |

## The update pill (Jake, 2026-10-23 09:33, iPhone screenshot on ab93dccfe: *"Pressing the updating button takes forever. I just expected to refresh the page. I don't know why refreshing the page takes so long."*)

The original report described a static "UPDATING…" and a cold-start-length refresh. The current pill
(`src/engine/ui/Update.ts`) paints progress before adopting an installed worker; with none waiting it reloads immediately.
The worker carries unchanged content-addressed packs and installs only the entry shell/static graph. The follow-up below
checks the current larger build gap rather than assuming every unchanged pack downloads again.

| Row | What | Owner | Done when |
|---|---|---|---|
| U1 | **done (2026-10-25, sp-x9).** Native Simulator `ff45b6a24` → `f30e0be71c`: adopt 1 ms, reload → inline 471 ms, inline → ready 287 ms, ready → paint 54 ms (813 ms total). Pre-tap install + stale-art inspection 396,522 response-body bytes; update 733,249 (diagnostic injected/uncompressed HTML included). Stale/new 11-thumb decks and 12 unique images valid: the reported 13-card blank state did not reproduce. Template after update 4,365 ms; admission 1,252 ms, max 16 in flight; the phone's 7.3 s / 39-file wait did not reproduce. Measure one tap → title on the new build on the Simulator from a build several deploys old: adopt wait, reload, worker install, boot-pack bytes re-downloaded vs unchanged; include G733 stale `ff45b6a24` / mixed shell-and-assets blank-art reproduction | Codex | the wait is split into its parts, numbers in the commit |
| U2 | **done (2026-10-25, sp-x9), existing runtime verified.** Exact U1 update paints the new title at 813 ms (<5 s). Real worker-source regression proves unchanged pack carry/reuse without a fetch and only the changed URL reads; real update-pill regression proves no waiting worker means immediate reload, preserving shard intent. No extra runtime cut warranted. Fix the biggest part: unchanged packs keep their URLs across builds (content-hashed, so only changed packs download), the adopt wait drops when no worker is waiting, the worker's install never blocks the reload | Codex | tap → title ≤ 5 s on the Simulator after a typical deploy |
| U3 | **folded into U4.** The pill keeps showing progress (bytes or steps) instead of a static "UPDATING…" | Codex | no static label for more than 1 s |
| U4 | **done (2026-10-25, sp-x9).** Renderer-free progress `748b5541d2` + handoff proof `f5bb8cec35`; public enablement in the closing slice. Native Simulator old `748b5541d2` → new `f5bb8cec35`: 2,873 ms tap → new title, 15 real phase/completed-file changes, longest gap 253 ms, errors 0. Video shows the modal through reload; new-document state restores before the title. WebKit supplied no transfer sizes here: file steps move and unknown bytes stay explicit, with no elapsed-clock credit. **Update progress screen (G715, E502):** full-screen loading-style modal, real found/download/install/reload phases; an already-installed pack says ready; folds U3 in | Codex | actual progress changes at least every second until the new title; native old-build capture passed |
| L16 | **in flight (2026-10-24, sp-x9), slice 1 ≤1 h:** first-document hero/boat + handoff; slice 2 cold PWA capture/acceptance. **Launch black screen (G716, live regression, first):** a cold home-screen launch shows black ~7 s before the title. Bisect when the instant hero stopped painting (`title-first` hides the first-paint panel until the title's JS runs), fix forward; then paint the title hero + a boat progress bar inline from `index.html` (no bundle) until the title mounts | Codex | Simulator cold PWA launch paints the hero within ~0.5 s and never shows black; the regression commit named in the fix |
| G733 | **done (2026-10-25, sp-x9), badge fix `94ef588da9`.** Shared `1138f0564c` phone WebKit: at 1.002 s the hero/card and all 11 thumbnails paint, all seven badges fit; 12 image URLs valid. Native Developer-on cold PWA also has all 11 thumbs at 1 s. No image culprit claimed; Jake's stale 13-card blank state carries into U1. | Codex | shared-preview badge acceptance passed; U1 source-aged stale-shell check did not reproduce blank art |
| L17 | **done (2026-10-25, sp-x9), `2511ddea95` + `f30e0be71c`.** Exact `f30e0be71c` phone-tier SHARDFILE / LEGACY / Infinite holds reach 100/100 with frozen rows, visible 48 px PLAY and zero faults; PLAY → ready 644 / 1,223 / 1,124 ms. Off auto-enters (2,087 ms). **Hold at loading screen (G732):** Settings ▸ Developer toggle; when on, a finished load (shard, shardfile, LEGACY, Infinite Wildshard) stays on the completed loading screen with all steps and timings, and a PLAY button over it enters | Codex | toggle on: every entry stops at 100 % with PLAY; toggle off: unchanged auto-enter; phone-tier capture |

| U4 slice (≤ 1 h each) | Scope | Status |
|---|---|---|
| U4.1 | Renderer-free modal, real completed receipts, validated session handoff and retry; Developer-only until acceptance | done (2026-10-25, sp-x9) |
| U4.2 | Old-build Simulator tap, per-second progress capture and public enablement | done (2026-10-25, sp-x9): 2,873 ms / 15 changes / 253 ms longest gap / errors 0 |

### Current-build update follow-up (G715, sp-x2)

Prior U1/U2/U4 results above remain valid historical measurements. Recheck the larger build gap before any new runtime change.

| Slice (≤ 1 h) | Scope | Status |
|---|---|---|
| U1.3 | One ff45b6a24 → current pinned build Simulator visit; split install/adopt/reload/title, inspect stale/new art and Template admission. | done (2026-10-25, sp-x2): `ff45b6a24` → `07f473ffb8`, tap → title **720 ms** = adopt 1 + reload → inline 391 + inline → ready 291 + paint 37. Worker installing → installed 48 ms before tap; activation spans 385 ms after tap and overlaps reload, not additive. Application errors 0; stale/new 12 unique image URLs valid (11-thumb deck); blank art not reproduced. 101 cache URLs retained, no legacy pack URL requested. Update response bodies 733,156 B: 281,152 identical, 43,559 changed, 408,445 unknown/new; diagnostic HTML is injected/uncompressed, local telemetry 404 is separate. No cache-hit inference from missing requests. |
| U2.2 | Preserve verified plain image aliases during static-cache migration; unchanged pack URLs and immediate reload remain unchanged. | done (this code commit): U1 found the same 280,723 B title hero downloaded again because migration kept only its verified `?v=hash` key while the inline title reads its plain URL. Keep both verified aliases in the current content-named cache; real shipped-worker regression proves zero fetches for either, while changed/removed images still refuse carry. This avoids the identified body in that fixture; no post-fix native timing/byte claim. Engine/test types, typed lint and 22 focused cases pass. |
| U4.3 | Review current loading-style progress against actual phase/receipt evidence; preserve prior native handoff proof, fix a demonstrated gap only. | done (2026-10-25, sp-x2): Update/UpdateProgress/styles/sw boot code unchanged since the earlier 2,873 ms /15 changes /253 ms native proof except public enablement `5716145112`. Current direct reload, real receipt counts, handoff/retry/unknown-byte and worker install regressions pass; no new modal code or duplicate native recording. |

**Template wait named:** current post-update Template is 3,547 ms tap → ready, with admission 981 ms. The `Parsing shard descriptor` label persists while `readProductInput` resolves the descriptor sections: `resolveOutputDescriptor` launches 39 section reads together. Its verified-read and worker waits are nested, giving the observed **39 files /78 waits**, not 78 transports or one 7.3 s JSON parse. The creatures label appeared at document +1,158 ms and the next snapshot was `Checking visited product` at +1,258 ms; the reported 7.3 s stall did not reproduce. Immutable assets then use the separate 16-read admission pool. No concurrency/deadline change.
