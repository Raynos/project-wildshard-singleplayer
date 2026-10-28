# QA fixes 10-28: everything from Jake's phone QA, as one buildable list (G819–G837)

**State:** `open` 2026-10-28 ~14:40 Cancun. Written by a wildshard-v subagent for wildshard-new, which hands the rows to
lanes. Part of [close-out](close-out-mini-plan.md) CO1; archives with SHARD-PLATFORM (CO8). Read at HEAD `1c1d80f451`;
the working tree already holds uncommitted edits for QF1, QF3–QF5, QF13 and QF14 (sw.js, codePack.ts, Loading.ts,
UpdateProgress.ts, devSwitch.ts, loading.css, update.css): their owners land them with `commit.sh --patch`.
**Reviews:** [service-worker-2026-10-28](../../reviews/service-worker-2026-10-28.md), [bulk-downloads-2026-10-28](../../reviews/bulk-downloads-2026-10-28.md)

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
| QF1 | **Stall limits on every service-worker download the page waits on (G830; finding 4).** The loading screen sat 25 s on step 1 waiting for `/shardfiles/driftwood-isle/shard.json`. `src/engine/pwa/sw.js` `fetchWhole` (~652–676) and its network path (~437–466) get a per-attempt stall limit that falls back to the network; covers the page reload, the stylesheet, `shard.json` and the map code. `src/engine/boot/codePack.ts:39` gets a deadline after `CODE_PACK_STARTED`. **A stop-gap only:** 3 attempts × 10 s is still 30 s frozen; QF2.T1, T3 and T6 bound the wait | sp-x2 (Codex) | 0.5 d | the 11-run freeze repro (`tmp/loading-freeze/`, WebKit stalled 1 of 7 cold, Chromium 1 of 4) stalls 0 of 10 on each engine; a stalled response shows its fallback within the limit |
| QF2 | **The page never freezes (G837; findings 16, 18).** A navigation or reload never waits on the SW's network path: the HTML shell is served at once and paints its own loading UI before it awaits anything; every wait shows progress, what it waits for and a retry; no invisible preloads. Rows T1–T8 from [service-worker-2026-10-28](reviews/service-worker-2026-10-28.md) (`0409006f5d`, rules R1–R6); QF1 ships first | Codex | T1–T8, S each | T1–T8 met; on both engines a throttled reload paints within 1 s and never shows a still frame without a moving indicator |
| QF2.T1 | **`?v=` navigations served cache first from the cached shell** (it already belongs to this worker's build, E144); network only on a cache miss, raced against 3 s (`sw.js` 589-604; R1) | Codex | S | **done `65a83b569e`** — phone Chromium/WebKit SW-enabled cached reload commits3/4ms with the network held; natural-boundary reload860/64ms. Cold shell has one3s total limit, including trickling HTML. an update / `?v=` reload with the network held commits the cached shell on both engines; no navigation request waits on the network when the shell is cached |
| QF2.T2 | **`activate` only claims;** manifest GC moves to a `GC` message the page sends after `ws:control-ready`, its manifest fetch through `fetchAttempt` (`sw.js` 241-284; `sw.ts` 95-99; R2) | Codex | S | **done `65a83b569e`** — both phone engines claim without a manifest request; held GC manifest starts after control without blocking entry. Unit budget30s; late traversal cannot publish/delete. Old exact static aliases remain usable offline before GC. `activate` does `clients.claim()` and nothing else; GC runs after control with a deadline |
| QF2.T3 | **`shard.json` races the network against 3 s,** then admits the visited (hash-verified) product; revalidates after control (`product.ts` 240-250) | done (`5997758ee2`, `f9628488e9`; sp-x1) | S | with the network held, a revisited shard passes `shard.json` in ≤ 3 s on both engines; **one containing `f9628488e9` phone cold/warm pair per engine:** Chromium 4.158 s cold / 9.970 s held-network control, WebKit 5.123 / 10.595 s. Both sequential header/runtime transfers cancel at the scoped 3 s fence (native callback delivery: Chromium 3.000–3.002 s, WebKit 3.006–3.020 s), admit the completely visited hash-verified copy, and revalidate only after control; page errors 0. Cold/no-copy refusals retained. Persistent WebKit profile; premature-cache and ephemeral-cache driver refusals retained. |
| QF2.T4 | **The handoff clock runs:** `beginNavigationShell` starts the inline tick, and the inline script stops returning early once `data-navigation` is set (`shell.ts` 45-64; `index.html` 136-190; R3) | in flight (2026-10-28, sp-x6) | S | the title's handoff panel timer moves on every navigation on both engines |
| QF2.T5 | **Code-pack progress is visible:** the worker posts `CODE_PACK_PROGRESS` and the shell's download line shows it (`sw.js` 420-458; `codePack.ts`; `index.html` 168-178) | in flight (2026-10-28, sp-x2 producer / sp-x6 shell) | S | **done `dc15bbbd9a` + `18bbbf3398`** — containing805101ec3d, phone Chromium/WebKit:34/33 partial application-code samples, rising to2.07MB; actual DW controls/MAP, errors0. a cold entry shows code-pack bytes rising in the shell on both engines |
| QF2.T6 | **One page deadline:** any wait over 8 s with no new bytes shows "Waiting for X · n s · Retry"; the stuck card drops 25 → 10 s and its RELOAD is a plain reload (`Loading.ts` 419; `stuck.ts` 31, 110-122; R4) | in flight (2026-10-28, sp-x6) | S | a held download shows the labelled Retry line at 8 s and the stuck card at 10 s on both engines; RELOAD is instant with T1 |
| QF2.T7 | **No same-build SKIP_WAITING mid-session:** deferred to `pagehide` / travel (`sw.ts` 85-90, 119-128; R6) | Codex | S | **done `65a83b569e`** — both engines hold an actual byte-different/same-build waiting worker while the world is live; real pagehide adopts it. Original explicit-adoption/retirement controls remain. a same-build worker update never swaps mid-page |
| QF2.T8 | **Buffer only JS / CSS bodies whole;** other bodies stream, so the page counts bytes and G830's stall clock still applies (`sw.js` 615-655; R5) | Codex | S | **done `dc15bbbd9a`** — containing805101ec3d, phone Chromium/WebKit: exact2624464B GLB first bytes3/3ms, completion3272/3267ms,80/41 prefixes; complete original SHA, controls/MAP/errors0. `fetchAttempt` buffers only `destination: script/style`; a large GLB shows bytes rising during its download |
| QF3 | **Loading screen frozen at 00:00.0 (finding 1).** The title's handoff panel stays painted while the next page's stylesheet waits on the SW. The destination page paints its loading screen from inline critical CSS before it awaits any stylesheet | sp-x6 (Codex) | 3 h | with the stylesheet held 10 s, both engines show the loading screen's timer moving from the first frame |
| QF4 | **UPDATING froze at "Reloading title 0.0S, 0 files" (finding 2).** `src/engine/ui/UpdateProgress.ts`'s 250 ms interval dies on navigation. The reload step animates in CSS (`styles/update.css`), so it moves until the next page paints | sp-x6 (Codex) | 2 h | **done `ece10cd3fe` + `18bbbf3398`** — containing805101ec3d, Chromium/WebKit iPhone16Pro: hidden/empty JS clock, real CSS ring27/22 distinct captured images in43/47frames; errors0. an update-and-reload on both engines never shows a still UPDATING frame; `update-progress.test.ts` covers the CSS step |
| QF5 | **Tapping SHARDFILE shows no loading screen for a while (finding 3).** The tap paints the loading screen first; the preload starts after that paint | sp-x6 (Codex) | 2 h | **done `ece10cd3fe`** — containing805101ec3d, Chromium/WebKit iPhone16Pro: SHARDFILE/LEGACY/INFINITE all visible in the tap task and first frame,13–17.2ms; no selected-product handoff before that frame. the first frame after the tap is the loading screen on both engines (trace: paint before the first product request) |
| QF6 | **Reveal waits for the spawn shaders (finding 11).** It revealed at 36 / 76 programs linked and ran at 3 fps, back to 30 fps only after ~30 s. Hold the reveal until the spawn view's programs are linked; compile the rest in idle frames after control | sp-x9 (Codex) + sp-o4 (Opus) | 0.5 d | 100 % of the spawn programs linked at reveal; the first 5 s after reveal hold p95 ≤ 40 ms on Chromium phone 4x and on WebKit |
| QF7 | **Props · Baked island 23.7 s with a 20.4 s frozen frame (finding 10).** Bisect against the last two days' Driftwood byte work (G833's cut, the producer rewrites) | sp-x8 (Codex) | 0.5 d | the first bad SHA named and fixed, or the step proven unchanged since 10-26; no frozen frame over 1 s in the step on either engine |
| QF8 | **Sky · lighting 16.6 s with an 8.8 s frozen frame (finding 10; damage D199).** Diagnose beside QF7 | sp-x8 (Codex) | 3 h | a regression from the last two days is fixed with QF7; anything older stays D199 with the cause written in it |
| QF9 | **Bag ▸ MAP stuck on "Map · 0 / 1", label unstyled (finding 5, G826).** Painter static: `f06aed0403`, `7c5e0477b7` (live). The `.ws-x-load` styles (only in `styles/explore.css:112-119`, used by `loadProgress.ts:17` everywhere) moved into the eager base HUD stylesheet as `ws-progress`: `597075fce8` (not live) | landed; ships in the release | 0 | on the release, the map opens at once on WebKit and no load label is unstyled |
| QF10 | **Blurred top of the screen after the reveal (finding 12).** An overlay or veil is left on. Find and remove it | sp-o4 (Opus) | 3 h | the top band is sharp in the first frame after reveal on both engines (labelled before / after crops) |
| QF11 | **Driftwood water: flat pale-white patches in the shallows (finding 15).** Likely last night's producer rewrites or the I8 water work. Bisect against `0012c73e11` and a pre-10-26 build; Opus fixes the look | sp-x1 (Codex bisect) + sp-o3 (Opus) | 0.5 d | first bad SHA named; the shallows match the pre-10-26 capture from the same camera on both engines (labelled board) |
| QF12 | **The Driftwood pier pops in (finding 14, G832).** A far stand-in for the pier. Other far content that should show from a distance goes on BURN-DAMAGE-LIST as one item with Jake's screenshots (close-out CO3), not here | sp-x10 (Codex) + sp-o5 (Opus) | 0.5 d | approaching from the spawn road, the pier is visible at its far range on both engines (labelled capture) |
| QF13 | **Too many step rows (finding 9).** Every step under 500 ms joins one grouped line | in flight (2026-10-28, sp-x6) | 2 h | a warm Driftwood entry lists no step under 500 ms on its own; `loading-footer.test.ts` covers it |
| QF14 | **Empty space at the bottom of the loading screen (finding 8).** The Developer `holdLoading` toggle goes there (Developer on only; no new Debug row, G669) | in flight (2026-10-28, sp-x6) | 1 h | with Developer on the toggle sits in the bottom band; with Developer off the band is empty; `loading-hold.test.ts` covers it |
| QF15 | **Minimap shows the T5 tile "0.1 MB" labels (finding 13).** Landed `792fa39d79` (not live) | landed; ships in the release | 0 | no tile label on the minimap of the release |
| QF16 | **WHAT'S NEW stale since 10-21 (finding 7, G825).** Refreshed `a6701db713` (not live); sp-ci-deploy rewrites `src/game/whatsNew.json` with every release: 3–5 true player-visible lines, newest first | sp-ci-deploy | 0.5 h a release | the release's `whatsNew.json` is dated today and names QF1–QF15's visible changes |
| QF17 | **Bulk downloads (finding 17): the review's quick wins B1–B6.** [bulk-downloads-2026-10-28](reviews/bulk-downloads-2026-10-28.md) (`645e86f8a1`): the "527 files" are pack members; the real cost is ~266 requests before control and 97–221 after it on Driftwood. B1–B5 need no format change. The review's per-phase pack design is a note for Jake's next plan only, never rows here | Codex | see B1–B6 | B1–B6 met; Driftwood before control ~266 → ≤ ~255 (B1–B5) / ~105 (with B6), after control 97 → ~8 |
| QF17.B1 | **in flight (2026-10-28, sp-x9): read each pack whole, once.** `readPacked` fetches each pack in one GET (≤ 4 MB), verified by its hash, members sliced in memory and shared across waves; no byte ranges. Removes the likely cause of the 18.6 s range hang (three 2.3–4.2 MB packs read as 5–7 ranges each) | sp-x9 | S | Driftwood pack reads 24 → 13 on both engines; no 206 response in the entry's network log |
| QF17.B2 | **in flight (2026-10-28, sp-x9): grid neighbours read their sections through their packs** (the I5.3 path) | sp-x9 | S | after-control section requests 140 → ~10 on the Driftwood grid entry |
| QF17.B3 | **in flight (2026-10-28, sp-x1): sounds as one pack, or decoded on first use:** the 91 SFX / music `.m4a` stop downloading one by one after control | Codex | S–M | after-control sound requests 91 → 1–3; every sound still plays on first use |
| QF17.B4 | **SW cache-first for shard files:** `/shardfiles/*/blobs/**` served cache-first from one cache (no `ws-static` copy), at most 6 downloads in flight (2 after control) | Codex (with sp-x2's QF1) | S | one `cache.put` per file, not 2; never more than 6 in flight before control on either engine |
| QF17.B5 | **Retry with backoff and a step deadline** (after QF1 / G830): a failed or stalled download retries with backoff + jitter; a step past its deadline shows a Retry button | Codex | S | a dropped request recovers on retry; a held step shows Retry on both engines, never a still screen |
| QF17.B6 | **in flight (2026-10-28, sp-x8): coarser JS chunks.** coarser `controlChunkGroups` (startup / session / shard / late) in the existing Rolldown config; an output setting, not a plugin, so it fits G799. Weighed against js-payload's lazy loads with a build-time JS-size reading (I12's guard) so lazy code stays lazy | sp-x8 | M | JS requests 166–234 → ~10–20 on a Driftwood entry; I12's guard green; map, bag, pause and HUD stay eager (G826)  Source: phase banks retain exact home/title/static-entry boundaries, larger 2–4 MB source-size groups, entry-aware shard/late groups. Baseline `81465a0b98`: Chromium/WebKit 167/167 tap-to-control JS requests; independently observed before-control wire 24.609/26.154 MB. Typed/fast lint, scoped types and emitted lazy/cache controls green; containing build/I12 and after-reading remain open. |
| QF18 | **Night Market missing from SHARD SELECT (finding 6).** Fixed `72a67f451b` (live) | done | 0 | done `72a67f451b` |

## Next (built in this plan after QF2.T1–T8 land, not deferred)

From the service-worker review's part (b); all Codex, size M:

- **QF2.N1 — background update adoption** (review B1): the update installs in the background and the pill says
  "update on next travel / title"; `travel` sends SKIP_WAITING, waits ≤ 1 s for claim, then `location.replace`; the
  `?v=` path and its network-first branch are deleted (`sw.ts`, `Update.ts`, `UpdateProgress.ts`, `travel.ts` 61-70).
- **QF2.N2 — versioned cache-first `shard.json`** (review B2): `?v=<hash8>` from the build's tables, cache first like
  `/assets/…?v=`, so T3's race goes away (`sw.js` 560, `product.ts`).
- **QF2.N3 — one shared wait list** (review B3): the inline script and `Loading` share one registry (label, bytes,
  deadline, retry) from the first byte, so no await is unlabelled (`index.html`, `Loading.ts`, `boot/download.ts`).
- **QF2.N4 — faster worker start, yielding prefetch** (review B4): sw.js stamps parsed lazily; background revalidates
  and PREFETCH abort on a navigation (`prefetchOne` 485-503) (`sw.js`, `scripts/app-build/serviceWorker.ts`).

## Ship

- **One immediate release** (G830): sp-ci-deploy runs `gh workflow run deploy` on the newest green `main` that holds
  QF1, QF3–QF5, QF9, QF13–QF16, plus whatever of QF6–QF8 and QF10–QF12 has landed by then. A row that misses the cut
  rides the next hourly deploy; the release never waits for it (lanes are never paused).
- **Opus rows (QF6's render half, QF10, QF11's fix, QF12's stand-in)** depend on Claude capacity: at 13:50 the active
  account read 99 % weekly and the other 100 %. If Opus stops, Codex takes the bisects and the coordinator tells
  wildshard-v (close-out §3.2).
- **The build id goes to wildshard-v through STATE.md** (it is talking to Jake; never herdr-prompt it), with the rows
  the build contains. wildshard-v tells Jake. No phone chore for Jake: his next play is the check.
- QF17's B1–B6 ride the first release they land in; none waits for another. QF2.T1–T8 ride the same release
  where they are landed (the review sizes them for it); N1–N4 follow in a later release.
