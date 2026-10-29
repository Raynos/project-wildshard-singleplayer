# Reload simplify: RELOAD just reloads the page

**State:** `open` 2026-10-29. Written by wildshard-v's planning subagent for wildshard-new, which hands the rows to lanes
and marks them. **Every row blocks the SHARD-PLATFORM archive (G877, G879)**; none goes to the damage list. The builder
is autonomous (G872): it decides on the recommended option and logs the call in STATE.md. All rows are Opus (the player
sees them, G848). Tests that pin deleted behaviour are deleted with it (G416).

Jake, 13:41: *"No, retry popped me into the thing. I don't know what the fuck we're doing on reload. Whatever we're doing
on reload seems really fucking dumb. I don't know why we have all these stupid fucking screens and what they're for … If
we can get rid of some of these stupid screens, that'd be great."* 13:45: *"Whatever the hell's going on here, it's like
it's really dumb. I don't know what the fuck's going on here, but reload should just reload the page. Like, it seems
over-engineered. I need a sub-agent, like a dedicated sub-agent to like make a mini plan called like fucking fix this
over-engineered shit, whatever the fuck it is. Like, delete 90% of it. It should just reload the page."* 13:46: *"I think
a lot of the loading performance is just waiting for things to be downloaded. Like, what happened to aggressively caching
everything that's downloaded?"*

Seen on live `8621318d9` (iPhone 17 Pro PWA): RELOAD → ~8 s boat shell → "Waiting for Application modules · 8.1 s" +
Retry → title; again 8.5 s. Cold: ~6 s black, boat stuck at 13.5 s until Retry brought the title at once.

**Supersedes** [qa-2026-10-29-2](qa-2026-10-29-2-mini-plan.md) **QB3 and QB4** and folds in **QB1** (black boot: RL1,
RL3). sp-o3 holds those three; per no mid-task re-briefs it finishes its current slice, then takes RL rows. QB2 is done.
QB5 (the bar's total) stays. **RL7–RL9 close QB9** (13:49: *"The downloading is supposed to be fucking instant. Like
0.1 seconds, download bar full, out of the cache."*). QB6's crash line is a keep here.

## Why a RELOAD takes ~8 s and says "Waiting for Application modules"

Measured, not guessed: the code path is fast. Playwright WebKit, iPhone 16 Pro preset, live site: cold title 0.78 s,
then two reloads 0.23 s and 0.13 s, the page controlled by the service worker, every one of 26 code / CSS responses
served by the worker with 0 bytes transferred. So the 8 s is iOS-only and sits in what the phone does around
that path, and the box itself explains nothing:

1. **The "8.1 s" is a timer, not a wait.** The inline script in `index.html` (163–282) gives its fallback wait, labelled
   "Application modules", an 8000 ms no-progress deadline and counts progress from resource-timing bytes. Worker-served
   responses report 0 bytes, so progress never ticks: on any launch slower than 8 s the box appears at 8.0 s whatever is
   actually slow, and the title lands just after. That is why both reloads read 8.1 / 8.5 s.
2. **A RELOAD tap is not a reload.** `Update.ts reload()` mounts the UpdateProgress cover, writes it to storage, waits two
   frames, may ask the worker to activate (up to 1 s), scrubs the URL and `location.replace`s; the next document re-mounts
   the same cover from storage and holds it until `ws:ready`. After a deploy, `sync()` (Update.ts:171) also reloads the
   title by itself once the new worker is installed: a second boot nobody asked for.
3. **The slow part on the phone is the worker path.** Every module and stylesheet of the new document is a `sw.js` fetch
   event (`caches.open` + `match` in a store holding the Driftwood content plus the title read-ahead's ~40 MB "next
   world"). After a reload iOS may be restarting the worker (951 lines + 2 imports) while the previous page's Cache
   Storage writes (read-ahead, `WARM_CODE`) are still landing; iOS serializes Cache Storage per origin. RL1 confirms this
   on the Simulator before anything is tuned.
4. **The cold hang** is a module GET whose worker response never settles: `fetchAttempt` stalls out at 10 s, `retried()`
   adds 0.8 + 2.5 s, and WebKit keeps a failed module URL errored, so only a new document recovers. Retry did exactly
   that; a stalled boot should do it once by itself.

## End state

RELOAD is `location.reload()` (on the title `location.replace('/')`, so a title reached by "Exit to main" cannot re-enter
the world), after posting `SKIP_WAITING` to a waiting worker without awaiting it; off the title G877's "Confirm reload"
second tap stays. Boot is iOS launch image → the title: the inline shell is the launch image's own art (hero +
WILDSHARD, no boat, no bar, no wait box, no Retry), so the hand-over to the live title shows no change, and nothing is
ever black. A boot that has not reached the title or the loading card in 12 s reloads itself once per session; a second
failure shows the existing error card. No update-progress cover, no resume screen, no automatic reload. The worker's cache-first document and code, `WARM_CODE` and the title read-ahead stay
(they keep a warm launch fast). A tap on a shard still shows the loading card.

## Inventory: icon tap or RELOAD tap → playable title

| # | Piece | Where | Added by, why | Verdict |
|---|---|---|---|---|
| 1 | iOS launch image (1.6 MB PNG, 402×874 @3) | `index.html:17`, `scripts/generate-title-launch.mjs` | G744 / G716 L16: paint before a document exists | **keep** |
| 2 | `html, body` `#0b1622`, `title-first` class, hero preload | `index.html:20-30,37` | `9108429270` title-first | **keep** |
| 3 | `#ws-top-edge` strip | `index.html:58-63,136` | QA10 `4de27916fe` | **keep** |
| 4 | Title shell hero + WILDSHARD | `index.html:64-67,124-128` | `ec2447e3fa` paint title before bundle | **keep**, matched to #1 |
| 5 | Sailing boat + progress line | `index.html:68-72,130-132` | `ec2447e3fa` indeterminate mark | **delete** |
| 6 | Title wait box + Retry | `index.html:54-56,129,253-256,274` | `18bbbf3398` bound visible waits | **delete** |
| 7 | Inline loader script: clock, waits registry, titleArrival, entry totals, byte observer, 8 s stall, Retry | `index.html:163-282` | `30584ca91a`, `18bbbf3398`, H7 | **delete**; ≤ 15 lines: one self-reload timer |
| 8 | First-paint loading card markup (`.ws-load[data-shell]`) | `index.html:39-53,137-162`, `src/engine/boot/shell.ts` | first paint of a `?chunk=` page | **keep** (loading card after a tap) |
| 9 | E61 resume screen ("Resuming" over the last frame, own Reload) | `index.html:283-301`, `Resume.ts`, `resume.css`, session `resume.shot` / `resume.brand` | E61 / E99 GPU-recovery reload | **delete**; that reload shows the loading card |
| 10 | UpdateProgress cover (found / download / install / reload, stored across documents, own Retry) | `src/engine/ui/UpdateProgress.ts`, `styles/update.css` cover rules, `update-progress.test.ts`, `test/loading-update-report.test.ts` | `748b5541d2`, `5716145112` | **delete** |
| 11 | Pill progress text, DownloadAccounting, `sw.activate()` wait, URL scrub | `Update.ts:46-86` | `0ba53e41e1`, `e42a318024` | **simplify** to the end-state reload |
| 12 | Automatic title reload when a worker waits | `Update.ts:169-171` | `e42a318024` adopt at title | **delete** (travel adoption stays) |
| 13 | G877 confirm tap off the title | `Update.ts:92-112` | `71569b79e0` | **keep** |
| 14 | `version.json` poll + "New version" pill | `Update.ts:141-154` | E140 | **keep** |
| 15 | `stuck.ts` "Still starting" card at 10 s | `src/engine/boot/stuck.ts:30,132` | E144 / E188 | **delete** the stall card; keep reject → reload once → error card |
| 16 | `retried()` import retries | `src/engine/boot/retry.ts` | E188 | **keep** (invisible) |
| 17 | `waitForLoadingStyles` before the title import | `src/entry.ts:56`, `shell.ts:46` | print-media CSS kept off first paint | **keep** |
| 18 | Title read-ahead ("next world", line gone in QB2) | `src/game/mainMenu.ts:160`, `grid/prefetch.ts` | `dcb9d4e39c` | **keep**; RL1 checks it yields to a reload |
| 19 | Crash notice, one line on the title | `mainMenu.ts:204-212`, `strings.ts` `ended`, `boot/lastEnd.ts` | QB6 extends it to every shard | **keep** |
| 20 | Interrupted-boot line (`previousBootLine`) | `StartTitle.ts:19-26`, `boot/bootTrace.ts` | one-line notice | **keep** |
| 21 | `markReload` "why did it reload" record | `boot/lastEnd.ts` | E179: a reload never reads as a crash | **keep** |
| 22 | Worker: document cache-first, code cache-first, `WARM_CODE`, GC after control | `src/engine/pwa/sw.js` | G837, E144, E160 | **keep** (warm launch from cache) |

8 delete or simplify (#5–7, 9–12, 15), 14 keep. By lines: inline script ~120, Resume ~180, UpdateProgress ~250
with CSS, Update.ts ~50, the stuck card ~40, their tests ~500: ~1,100 of the ~1,250 lines between a tap and the title
(≈ 90 %). Left: the launch image, a static shell, the pill, the reload record.

## Is everything downloaded cached?

**Mostly yes, by design; the evidence for "no" is unreadable today.** The worker keeps five caches: `ws-shell-<build>`
(index.html 184 KB, manifest), `ws-immutable` (hashed code), `ws-static-<asset hash>` (textures, models, audio, fonts,
title art), `ws-content-v0` (shardfile blobs, the page's hash-verified LRU, up to 1.5 GB / a quarter of quota) and
`ws-shardfile-products-v2`. The last two are build-independent and never wiped by a deploy (`KEEP`, sw.js:102).

- **Second load of the same build:** the document, code, static assets and shard blobs come from those caches. What still
  hits the network: `/assets/baked/**` files that are not content-named (`networkFirst`, sw.js:699), every request that
  matches no rule (the `networkFirst` default, sw.js:706), `asset-index.json` / `manifest.webmanifest` (network-first),
  `version.json` (by design), and whatever a dedicated worker fetches if WebKit does not route it through the service
  worker. A blob the worker misses in `ws-content-v0` is fetched and not stored by the worker; only the page's
  ContentCache stores it, after verification, so an LRU eviction or a store that failed for quota is re-downloaded.
- **First load after a deploy:** the shell (~0.2 MB) is new by design. `ws-immutable` is pruned to the new bundle, and
  chunk hashes cascade (a changed module renames its importers; `__BUILD_ID__` is inlined into the entry graph), so most
  code is fetched again even when little changed. A changed public asset renames `ws-static-*`; `migrateStatic` carries
  content-named and `?v=` entries over and SHA-256s every unhashed one in the worker, under a 30 s GC deadline that can
  stop partway. Content blobs and products survive.
- **A cache hit is not free:** `ContentCache.get` (`src/engine/boot/contentCache.ts:180`) SHA-256s every cached blob
  on every read and queues an LRU metadata write: a warm Pine load re-hashes ~60 MB on the phone, the likely bulk of
  its 6.1 s warm Product admission and why its bar crawls instead of filling at once.
- **Eviction:** `navigator.storage.persist()` is asked only through the title read-ahead (`prefetch.ts:131`), so a launch
  that never reaches it (a `?chunk=` launch, Save-Data) never asks.
- **Jake's 53.2 MB of 52.0 MB:** the bar counts every received file, cache or network, against the baked total (QB5), so
  a fully cached load still reads 53 MB and nothing says what came from where. His slowest phases (Sky · lighting 8.7 s,
  World program links 3.5 s) are CPU / GPU work, not downloads; caching cannot shorten them.

## Rows

Common done-when for RL1–RL6: recordings on the iOS 27 Simulator home-screen web app (`scripts/sim-lane.sh`) of a cold
launch, a warm launch and a RELOAD tap, each launch image → title, ≤ 2 s warm, frame times and deleted line counts in the
commit message.

| Row | What | Fix / done when | Lane | Size |
|---|---|---|---|---|
| RL1 | **Find the phone's 8 s.** Desktop WebKit reloads in 0.13–0.23 s; the phone takes 8 s and a cold launch hung. | Simulator Web Inspector timeline of a warm launch and a RELOAD on HEAD: worker start, each fetch event's duration, Cache Storage waits, the read-ahead's writes. Fix the top cause (e.g. the read-ahead and `WARM_CODE` stop writing on `pagehide`; a hung fetch event gets an answer from cache or network). Common done-when, plus the before / after cause in the commit. | folded into MF1 / MF3 (sp-o3) | M |
| RL2 | **done `0b56ab74b0` (+ `91a9eef081` timings; sp-o4): 958 lines deleted, 33 added.** WebKit iPhone 16 Pro on `0b56ab7`: a title RELOAD tap is one navigation to `/`, the title back in 106 ms, no cover, 0 page errors; off the title, tap → Confirm reload → tap reloads in place (`update-tap-pause.test.ts`). The home-screen Simulator recording rides with RL6's (sp-o3). **RELOAD = reload.** #10, #11, #12. | Delete UpdateProgress (TS, cover CSS, both tests), the pill's progress text and the activation wait. `reload()`: `markReload`, post `SKIP_WAITING` to a waiting worker, then `location.replace('/')` on the title or `location.reload()` elsewhere. Delete the automatic title reload. G877 stays; `update-boundary.test.ts` pins only: one tap on the title, two taps elsewhere. Common done-when. | Opus sp-o4 · done | S |
| RL3 | **One static shell, one self-reload.** #5, #6, #7. | Shell = hero + WILDSHARD only, pixel-matched to the launch image (rerun `generate-title-launch.mjs` if the art moves). The inline script becomes ≤ 15 lines: no title or loading card in 12 s → `location.reload()` once per session (a sessionStorage flag). Loading.ts starts its own clock. Delete the waits bridge and `title-first-paint.test.ts` cases that pin the deleted parts. Common done-when, no pure-black frame. | Opus sp-o3 · done 48492f221e (board fb3eaf7476) | M |
| RL4 | **No "Still starting" card.** #15. | `stuck.ts` keeps reject → reload once → error card and shares RL3's once-per-session flag, so there is one retry in the page, not three. Delete the 10 s stall card and its tests. Common done-when. | Opus sp-o3 · done 116ae8a683 | S |
| RL5 | **No resume screen.** #9. | Delete `.ws-resume` (markup, script, CSS), `Resume.ts`, its test, and the `resume.shot` / `resume.brand` writes; a GPU-recovery reload shows the loading card and keeps its `?at` pose. Done when a forced `?glreload` on the Simulator shows the loading card then the world. | Opus sp-o3 · done d0ad65ffab | S |
| RL6 | **Prove the whole path.** | After RL1–RL5: the three Simulator recordings, plus a deploy case (two `--rev` previews: the old build's title, the pill lights, one tap, the new title), each with no screen but launch image → title. One labelled before / after board for Jake. | folded into MF3 / MF20 | S |
| RL7 | **Nothing downloaded twice, same build.** Jake's 14:02 warm Driftwood load sat 6.2 s on *"NOW WAITING FOR: CONTENT CACHE GET"* with no progress for 5.8 s (10.5 of 52.0 MB at 7.2 s): reading from the cache is itself the stall. | Second Driftwood load from the title on the Simulator: list every request with its worker receipt (`ws-network` / `ws-cache` server-timing) and fix each network class: content-name or `?v` the `/assets/baked` files, a cache rule for the default `networkFirst` hits, route dedicated-worker fetches through the cache; **G881: no checksum on a cache read, ever.** Trust the server and the cache: a hit under its content-named key is used as is (no SHA-256, no re-hash on write either if the server already named it by hash); the only allowed check is something trivially cheap (byte length against the manifest, one integer compare), and a mismatch just refetches that file, never rejects the load. Batch the LRU touch. **Done when (QB9)** a warm Driftwood and a warm Pine Hollow load each
show the DOWNLOAD bar full within 0.1 s of the tap, make no network request for already-downloaded content (≤ 1 MB in
all), and warm Product admission takes ≤ 1 s; request totals and timings in the commit. | folded into MF1 (sp-x10) | M |
| RL8 | **Nothing downloaded twice after a deploy.** | Build two revisions one source line apart; keep chunk hashes stable for unchanged code (`__BUILD_ID__` read from one tiny leaf chunk or `version.json`, not inlined across the graph); keep unchanged static entries keyed by content so `migrateStatic` hashes nothing. Done when the first Driftwood load on the new build fetches only the changed chunks + shell (≤ 1 MB on top) and then
meets RL7's QB9 bar, numbers in the commit. | folded into MF2 (sp-x2) | M |
| RL9 | **Ask for persistent storage, show the split.** | Call the save store's single `persist()` at first title paint and at a `?chunk=` boot, not only from the read-ahead. The loading card's cache / network split is QB5's (one implementation; RL9 checks it reads e.g. "52.0 MB · 51.6 MB from cache" on RL7's warm load). Done when Settings ▸ Debug's storage line reads persisted on the Simulator and the warm card shows the split. | Codex sp-x1 · done 72da3035e0 | S |
| RL10 | **done `1ec09517d4` (sp-o4):** a standalone world's New game leaves through the main-menu exit to the title; WebKit iPhone 16 Pro, Signal Dunes and Driftwood: before `72da303` the world reloads ("LOADING CHUNK · SIGNAL DUNES"), after the title at 0.50 s, no world entered, 0 page errors ([board](../../../art/hud/round-30-rl10-new-game/board.jpg)). The grid's New game keeps its road-resume reload (G872 decision: it resumes the grid by design). **Reset save / New game goes to the title in place.** Jake, 13:56 (Settings ▸ reset save ▸ New game lands on the boot shell with the boat): *"I get this kind of shit … all the fucking startup, reloading, loading, like all the fucking trying to get to the main menu fast. Or, you know, the main menu should be instant. Like, how fucking hard can this be?"* `src/game/savesSettings.ts:134` does `markReload('new game')` + `location.reload()` whenever a world is live or the grid is open; `BootSettings.ts:159`, `SavePanel.ts:27` and `debugOptions.ts:145` reload the same way. The 13:56 shell also shows a different, older grid image from the live title's, so the hand-over is visibly a different screen. **And it starts the wrong shard** (14:02): *"hitting new game on Dunes in the settings menu to clear the save loads me into Driftwood Isle, which is wrong."* The reload drops the shard and the boot falls back to the default home (Driftwood). | **New game and reset save land on the live title, never in another shard** (`1ec09517d4` already sends New game in a world to the title), in the same page with no reload: dispose the session in place (the QA12 main-menu exit path); any reload that stays (save import, clear downloads) lands on the title through RL2 / RL3 with no boat. Done when Settings ▸ New game in Signal Dunes and in Pine Hollow on the iOS 27 Simulator shows the title in ≤ 0.5 s with no reload and no other screen, and never enters Driftwood, recording in the commit; the shell art, if a shell remains, is the live title's own frame. | Opus sp-o4 · done 1ec09517d4 | S |
