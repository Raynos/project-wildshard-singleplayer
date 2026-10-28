# QA fixes 10-28: everything from Jake's phone QA, as one buildable list (G819–G837)

**State:** `open` 2026-10-28 ~14:40 Cancun. Written by a wildshard-v subagent for wildshard-new, which hands the rows to
lanes. Part of [close-out](close-out-mini-plan.md) CO1; archives with SHARD-PLATFORM (CO8). Read at HEAD `1c1d80f451`;
the working tree already holds uncommitted edits for QF1, QF3–QF5, QF13 and QF14 (sw.js, codePack.ts, Loading.ts,
UpdateProgress.ts, devSwitch.ts, loading.css, update.css): their owners land them with `commit.sh --patch`.

Jake, 2026-10-28 ~14:10 (G837): *"the page should be fast. It shouldn't freeze ... The page needs to reload instantly.
If there needs to be a progress bar somewhere, or if there needs to be some downloading thing somewhere, it needs to be
fucking visible."* His QA ran 09:50–14:15 on live `a3f28a795` and then `9364930c36`, iPhone portrait Safari PWA.

## What the QA ruled (for context; nothing to build in this list)

- **Passed:** Night Market (G827), loading closes on his QA (G831), tiles / T10 (G832), Driftwood's −8.4 MB phone cut B
  stays (G833). Crossings close as unreachable in this architecture (G828; G820 is superseded).
- **Closed by rulings:** I2 per-shard ratchets (G821), H3 closed with H4 / A1 accepted misses (G822), readings measure
  the game not the harness (G823).
- **Process:** idle Codex lanes burn red tests and flakies (G819); 3 Opus lanes to 100 % (G835, G836).
- **Referenced, not duplicated here:** Night Market lanterns = [OPEN-PLOTS](../OPEN-PLOTS.md) OP1 (G827, G829); the
  LEGACY vs SHARDFILE boards = close-out CO6 (G834); Opus pacing = G836.

## Rows

Ordered by what freezes the page first. **Every load or render row is done only on one Chromium iPhone 16 Pro run and
one WebKit iPhone run** (muted, through `scripts/browser-lane.sh`, phone portrait, on a preview of HEAD), entering
Driftwood from the title, cold and warm. Source references are origin/main lines; the working copies have moved.

| Row | What | Owner | Size | Done when |
|---|---|---|---|---|
| QF1 | **Stall limits on every service-worker download the page waits on (G830; finding 4).** The loading screen sat 25 s on step 1 waiting for `/shardfiles/driftwood-isle/shard.json`. `src/engine/pwa/sw.js` `fetchWhole` (~652–676) and its network path (~437–466) get a per-attempt stall limit that falls back to the network; covers the page reload, the stylesheet, `shard.json` and the map code. `src/engine/boot/codePack.ts:39` gets a deadline after `CODE_PACK_STARTED` | sp-x2 (Codex) | 0.5 d | the 11-run freeze repro (`tmp/loading-freeze/`, WebKit stalled 1 of 7 cold, Chromium 1 of 4) stalls 0 of 10 on each engine; a stalled response shows its fallback within the limit |
| QF2 | **The page never freezes (G837; findings 16, 18).** A navigation or reload never waits on the SW's network path: the HTML shell is served at once and paints its own loading UI before it awaits anything; every wait shows progress, what it waits for and a retry; no invisible preloads. The design rows come from the pending review `docs/plans/shard-platform/reviews/service-worker-2026-10-28.md`; QF1 ships first | Codex, rows from the review (wildshard-v writes it) | after the review | the review's rows are added here and met; on both engines a throttled reload paints within 1 s and never shows a still frame without a moving indicator |
| QF3 | **Loading screen frozen at 00:00.0 (finding 1).** The title's handoff panel stays painted while the next page's stylesheet waits on the SW. The destination page paints its loading screen from inline critical CSS before it awaits any stylesheet | sp-x6 (Codex) | 3 h | with the stylesheet held 10 s, both engines show the loading screen's timer moving from the first frame |
| QF4 | **UPDATING froze at "Reloading title 0.0S, 0 files" (finding 2).** `src/engine/ui/UpdateProgress.ts`'s 250 ms interval dies on navigation. The reload step animates in CSS (`styles/update.css`), so it moves until the next page paints | sp-x6 (Codex) | 2 h | an update-and-reload on both engines never shows a still UPDATING frame; `update-progress.test.ts` covers the CSS step |
| QF5 | **Tapping SHARDFILE shows no loading screen for a while (finding 3).** The tap paints the loading screen first; the preload starts after that paint | sp-x6 (Codex) | 2 h | the first frame after the tap is the loading screen on both engines (trace: paint before the first product request) |
| QF6 | **Reveal waits for the spawn shaders (finding 11).** It revealed at 36 / 76 programs linked and ran at 3 fps, back to 30 fps only after ~30 s. Hold the reveal until the spawn view's programs are linked; compile the rest in idle frames after control | sp-x9 (Codex) + sp-o4 (Opus) | 0.5 d | 100 % of the spawn programs linked at reveal; the first 5 s after reveal hold p95 ≤ 40 ms on Chromium phone 4x and on WebKit |
| QF7 | **Props · Baked island 23.7 s with a 20.4 s frozen frame (finding 10).** Bisect against the last two days' Driftwood byte work (G833's cut, the producer rewrites) | sp-x8 (Codex) | 0.5 d | the first bad SHA named and fixed, or the step proven unchanged since 10-26; no frozen frame over 1 s in the step on either engine |
| QF8 | **Sky · lighting 16.6 s with an 8.8 s frozen frame (finding 10; damage D199).** Diagnose beside QF7 | sp-x8 (Codex) | 3 h | a regression from the last two days is fixed with QF7; anything older stays D199 with the cause written in it |
| QF9 | **Bag ▸ MAP stuck on "Map · 0 / 1", label unstyled (finding 5, G826).** Painter static: `f06aed0403`, `7c5e0477b7` (live). The `.ws-x-load` styles (only in `styles/explore.css:112-119`, used by `loadProgress.ts:17` everywhere) moved into the eager base HUD stylesheet as `ws-progress`: `597075fce8` (not live) | landed; ships in the release | 0 | on the release, the map opens at once on WebKit and no load label is unstyled |
| QF10 | **Blurred top of the screen after the reveal (finding 12).** An overlay or veil is left on. Find and remove it | sp-o4 (Opus) | 3 h | the top band is sharp in the first frame after reveal on both engines (labelled before / after crops) |
| QF11 | **Driftwood water: flat pale-white patches in the shallows (finding 15).** Likely last night's producer rewrites or the I8 water work. Bisect against `0012c73e11` and a pre-10-26 build; Opus fixes the look | sp-x1 (Codex bisect) + sp-o3 (Opus) | 0.5 d | first bad SHA named; the shallows match the pre-10-26 capture from the same camera on both engines (labelled board) |
| QF12 | **The Driftwood pier pops in (finding 14, G832).** A far stand-in for the pier. Other far content that should show from a distance goes on BURN-DAMAGE-LIST as one item with Jake's screenshots (close-out CO3), not here | sp-x10 (Codex) + sp-o5 (Opus) | 0.5 d | approaching from the spawn road, the pier is visible at its far range on both engines (labelled capture) |
| QF13 | **Too many step rows (finding 9).** Every step under 500 ms joins one grouped line | sp-x6 (Codex) | 2 h | a warm Driftwood entry lists no step under 500 ms on its own; `loading-footer.test.ts` covers it |
| QF14 | **Empty space at the bottom of the loading screen (finding 8).** The Developer `holdLoading` toggle goes there (Developer on only; no new Debug row, G669) | sp-x6 (Codex) | 1 h | with Developer on the toggle sits in the bottom band; with Developer off the band is empty; `loading-hold.test.ts` covers it |
| QF15 | **Minimap shows the T5 tile "0.1 MB" labels (finding 13).** Landed `792fa39d79` (not live) | landed; ships in the release | 0 | no tile label on the minimap of the release |
| QF16 | **WHAT'S NEW stale since 10-21 (finding 7, G825).** Refreshed `a6701db713` (not live); sp-ci-deploy rewrites `src/game/whatsNew.json` with every release: 3–5 true player-visible lines, newest first | sp-ci-deploy | 0.5 h a release | the release's `whatsNew.json` is dated today and names QF1–QF15's visible changes |
| QF17 | **Bulk downloads: 527 files for one Driftwood entry (finding 17).** Pending input: `docs/plans/shard-platform/reviews/bulk-downloads-2026-10-28.md` (wildshard-v). Its rows are added here when it lands; nothing is built before it | Codex, after the review | after the review | the review's rows are added here and met |
| QF18 | **Night Market missing from SHARD SELECT (finding 6).** Fixed `72a67f451b` (live) | done | 0 | done `72a67f451b` |

## Ship

- **One immediate release** (G830): sp-ci-deploy runs `gh workflow run deploy` on the newest green `main` that holds
  QF1, QF3–QF5, QF9, QF13–QF16, plus whatever of QF6–QF8 and QF10–QF12 has landed by then. A row that misses the cut
  rides the next hourly deploy; the release never waits for it (lanes are never paused).
- **Opus rows (QF6's render half, QF10, QF11's fix, QF12's stand-in)** depend on Claude capacity: at 13:50 the active
  account read 99 % weekly and the other 100 %. If Opus stops, Codex takes the bisects and the coordinator tells
  wildshard-v (close-out §3.2).
- **The build id goes to wildshard-v through STATE.md** (it is talking to Jake; never herdr-prompt it), with the rows
  the build contains. wildshard-v tells Jake. No phone chore for Jake: his next play is the check.
- QF2 and QF17 open a second release once their reviews land; this page then gains their rows.
