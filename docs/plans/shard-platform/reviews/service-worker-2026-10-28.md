# Service worker and page-load review (G837), 2026-10-28

**Summary (30 s)**
1. The page freezes because the network was put on the critical path of navigation in four places: the update reload, the new worker's activation, `shard.json`, and code fetches on a cache miss.
2. On every one of those waits the page shows either nothing or a dead clock, because the worker hands the page whole files with no byte progress, and the title's handoff panel never starts its timer.
3. Each piece was a sound local fix (LTE drops, stale deploys, offline play), but nobody owned the rule "a navigation never waits on the network".
4. Today's release (8 small changes): no network on navigation or activation, a cached fallback after 3 s, live elapsed time and bytes on every wait, a Retry button at 8 s.
5. Travel between shards stays a fresh page. Making it in-page is G828's one-world plan, which is Jake's to write.

Line numbers are in the working tree, which includes G830's uncommitted stall-limit patch (sw.js, codePack.ts, index.html, Update.ts).
Recordings: `tmp/loading-freeze/` (Chromium and WebKit, 11 runs).

## 1. The load path, step by step

**What the worker does with each request** (`src/engine/pwa/sw.js` fetch router, 536-579)
| Request | Strategy | Waits on network? |
|---|---|---|
| Navigation, `/`, `/index.html` | cache first, revalidates in the background (`documentResponse` 589-604) | only on a cache miss |
| Navigation with `?v=` (update pill, stuck-card RELOAD) | **network first** (592) | **yes, every time** |
| Scripts and hashed CSS | cache first; a miss runs `fetchWhole` (696-718): whole body, 3 attempts | on a miss: up to 3 × 10 s stall, shows no bytes |
| `/assets/…?v=`, content-named, tex/models/audio | cache first, then `fetchWhole` on a miss | same |
| `/assets/baked/` (unversioned) | network first | yes |
| **Everything else, including `/shardfiles/*/shard.json`** | **network first** (578); the cache is used only when `navigator.onLine` is false | **yes, whenever the phone thinks it is online** |
| Code pack (`PREPARE_CODE_PACK`, 420-458) | the worker downloads and decodes it, then answers by message | yes; the page's byte counter never sees it |
| `asset-manifest.json` during **activate** (278-284) | plain `fetch`, no-store, **no deadline** | yes, and **every fetch from every tab waits for activate** (Service Worker spec, Handle Fetch) |

`fetchAttempt` (615-655, from G830) reads every body completely before it returns, so even network-first JSON reaches the page in one piece at the end.

**A. PWA cold start (plain launch, the title)**
1. iOS shows the startup image, starts the worker process and runs sw.js, then `documentResponse` answers from the cache. Nothing is visible until the HTML commits.
2. The head's stylesheet blocks rendering (`index.html` 70-80 at HEAD; the G830 patch inlines the critical CSS and loads the sheets with `media=print onload`).
3. The inline `.ws-launch` hero paints (101-107). This step is fine.
4. Modules load (222-226). `sw.ts boot()` waits up to 2.5 s for control on a first visit (`src/engine/boot/sw.ts` 204-219).

**B. Title → world (ENTER WORLD or INFINITE WILDSHARD)**
1. `beginNavigationShell` (`src/engine/boot/shell.ts` 45-64; callers `titleDeck.ts:323`, `grid/pageEntry.ts:48`) paints the loading panel, waits 2 frames, then calls `travel` → `location.replace` (`src/game/travel/travel.ts` 61-70).
2. **The panel is a still picture.** The inline clock script returns early on a title-first page (`index.html` 140), so the panel reads `00:00.0` and "Loading" until the new page paints. **The player cannot see this wait.**
3. The new document comes from the cache. If a worker is activating, though, the navigation **waits for activate**, including its network fetch of the manifest. **Invisible.**
4. The stylesheet (cache first) and the inline shell paint (111-190). The inline clock ticks; its byte line comes only from page-side Resource Timing.
5. `entry.ts:74` `prepareEntryCode` → `await __ws_sw.ready` (≤ 2.5 s) → `prepareCodePack` (`codePack.ts` 20-54). The worker downloads the pack itself, so the shell says "0.00 MB modules read" the whole time. **Invisible bytes.** At HEAD the wait after 'started' has no limit; the G830 patch caps it at 15 s.
6. `Loading` takes over the panel (`entry.ts` 132-134). From here, waits are labelled (`Loading.ts:419` "Now waiting for: …").
7. `readProductDescriptor` (`src/game/shardfile/product.ts` 245-246) **always fetches `shard.json` from the network when online**, and the worker routes it network first (sw.js 578). Jake's screenshot: "READ …/shard.json · 25 s". The wait is labelled, but there are no bytes, no Retry, and no cached fallback, even though the visited product sits in `ws-shardfile-products-v2`.
8. The safety net is `stuck.ts` (25 s, `STALL_MS` 31). Its RELOAD is a `?v=` reload, which is network first, so it freezes the same way.

**C. The update (build pill)**
1. `Update.ts reload()` → `adopt` sends SKIP_WAITING (`sw.ts` 163-190).
2. `controllerchange` fires **when activation starts**, and `location.reload()` (177) runs at once.
3. The reload's navigation waits for activate (`sw.js` 241-260): the manifest fetch with no deadline, `migrateStatic` hashing every old static entry with SHA-256, `gcStatic`, `pruneImmutable`. The old page sits on "Reloading title". **Invisible.**
4. If adopt gives up after 2.5 s, the `?v=` replace (`Update.ts` 71-75) is network first for the document, adding a second wait on the network.
5. On top of that, a same-build worker is told to skip waiting **in the middle of a session** (`sw.ts` 85-90, 126). The activation then stalls the running page's lazy imports and data reads (the "Map 0 / 1" hang fits this).

## 2. History: who built what, and why

| When | Commit / row | Why | What went wrong |
|---|---|---|---|
| 09-17 | `e5d2322af6` worker "ported from trials-gauntlet, don't redesign"; `6b6c9f81ec` ≤ 2.5 s control wait | offline after one load; the document cache first (the gauntlet's B-SLOW bug) | The document rule was right. The default branch was left network first |
| 09-17 | `fde1ab7a2b` build pill | an iOS PWA has no address bar; `?v=` = "give me the server's copy" | **This put the network on the critical path of every update reload** |
| 09-25 | E188 `900800c865` `fetchWhole` | LTE hand-over cut the 1.1 MB main chunk mid-file, leaving a stuck 0 % loader | Fixed broken bodies, but made every miss **a whole-file wait with no deadline and no bytes** |
| 09-25 | E160/E161 `176021f02b` GC in activate | a deploy re-downloaded 70 MB; keep only what the build names | **Network and hashing inside activate, which blocks every fetch** |
| 09-25 → 09-26 | E155 in-page switch → `2bb24342a0` page reload for cross-shard travel (`c9f4d8c4f4`, E357 X9) | WebKit memory: a fresh page releases the old shard's heap (1.2 GB per shard, G556) | **Every crossing became a cold boot that runs every wait above** |
| 10-16 | `9471b6465c` split shardfile indexes | `shard.json` checked against the network while online | **`navigator.onLine` is the only offline test, and it says "online" on a dead radio** |
| 10-22 | `96c34b4f33` paint before navigation | tap latency | The panel paints but **its clock never starts** |
| 10-24 → 10-27 | G727 cache on first use; `435373b6d2` code pack via worker message; `e74651fe5d` await the cache write before responding | smaller JS download, offline after first use | **Downloads move into the worker, out of the page's sight**, and a disk write lands on the critical path |
| 10-28 | G830 (in flight) | stall limits on each attempt | Needed, but 3 × 10 s is still 30 s of frozen screen. It is a patch |

**Root cause, plainly:** nothing enforced one invariant: *a navigation is answered from disk, and the page paints before it awaits anything*. Each fix added a wait the page cannot see: whole bodies, worker-side packs, waits inside activate.

## 3. The design

**Rules** (G837, G799: plain files, no plugins, no virtual modules, no new hosts)
- R1. A navigation never touches the network when the shell is cached. A `?v=` or update reload is answered by the **new worker's own cached shell**.
- R2. `activate` does `clients.claim()` and nothing else. GC runs later, in the background, with a deadline.
- R3. The page paints a live loading UI (elapsed time, what it is waiting for, bytes) **before** its first await. This includes the title's handoff panel.
- R4. Every awaited download has one total deadline (8 s with no bytes). It then shows Retry, and uses a cached copy if one exists.
- R5. The worker streams data bodies to the page. Only JS and CSS module bodies are buffered whole (E188), and only on a miss.
- R6. Updates install in the background and swap only at a natural boundary (travel, a return to the title, a cold launch), never in the middle of a page.

**(a) Ships today, in the fix release with G830**
| # | Change | Size | Files |
|---|---|---|---|
| T1 | `?v=` navigations served cache first from SHELL (the cached shell already belongs to this worker's build, E144). Network only when the cache misses, raced against 3 s | S | `sw.js` 589-604 |
| T2 | `activate` = claim only. Manifest GC moves to a `GC` message the page sends after `ws:control-ready`; the manifest fetch goes through `fetchAttempt` | S | `sw.js` 241-284; `sw.ts` 95-99 |
| T3 | `shard.json`: if a visited product exists, race the network against 3 s and admit the visited one (it is hash-verified); revalidate after control | S | `product.ts` 240-250 |
| T4 | The handoff panel's clock runs: `beginNavigationShell` starts the inline tick, and the inline script stops returning early once `data-navigation` is set | S | `shell.ts` 45-64; `index.html` 136-190 |
| T5 | Code-pack bytes are visible: the worker posts `CODE_PACK_PROGRESS` and the shell's download line shows it | S | `sw.js` 420-458; `codePack.ts`; `index.html` 168-178 |
| T6 | One page deadline: any wait > 8 s with no new bytes shows "Waiting for X · n s · Retry" in the panel. The stuck card drops 25 → 10 s, and its RELOAD is a plain reload (T1 makes it instant) | S | `Loading.ts` 419; `stuck.ts` 31, 110-122 |
| T7 | No same-build SKIP_WAITING in mid-session: it is deferred to `pagehide` / travel | S | `sw.ts` 85-90, 119-128 |
| T8 | `fetchAttempt` buffers only `destination: script/style`. Other bodies stream, so the page counts bytes and G830's stall clock still applies | S | `sw.js` 615-655 |

**(b) Bigger, after the release**
| # | Change | Size | Files |
|---|---|---|---|
| B1 | Update = background install + adopt at the boundary: the pill marks "update on next travel/title". `travel` sends SKIP_WAITING, waits ≤ 1 s for claim, then `location.replace`. The `?v=` path and its network-first branch are deleted | M | `sw.ts` adopt; `Update.ts`; `UpdateProgress.ts`; `travel.ts` 61-70; `sw.js` 592 |
| B2 | Versioned `shard.json` (`?v=<hash8>` from the build's tables) goes cache first like `/assets/…?v=`, so the T3 race goes away | M | `sw.js` 560; `product.ts`; the build's boot tables |
| B3 | One wait registry from the first byte: the inline script and `Loading` share one list (label, bytes, deadline, retry), so no await is unlabelled | M | `index.html`; `Loading.ts`; `engine/boot/download.ts` |
| B4 | A faster worker start: smaller sw.js stamps (WARM/BUNDLE/CODE_PACKS parsed lazily); background revalidates and PREFETCH abort on a navigation (`prefetchOne` 485-503 cannot be aborted today) | M | `sw.js`; `scripts/app-build/serviceWorker.ts` |
| B5 | Packs instead of files in the worker cache: **the bulk-downloads review owns this** (separate subagent, 10-28); this review only needs R4/R5 to hold for whatever it picks | — | — |

**Multi-page travel:** keep it for now. It exists so WebKit frees the old shard's heap (G556 per-shard memory). With T1–T8, a crossing is: the panel ticks → the cached shell commits → the inline shell ticks → labelled waits. That is pre-painted, never frozen. It is still a cold boot per crossing (7.5–14.7 s, G828).

## 4. What cannot be fixed here

- **Crossing time** stays a full page boot per shard until there is one world in one page. That is G828's architecture plan, Jake's to write. This review does not draft it.
- **WebKit worker start** after iOS kills the process (cold PWA launch) is outside our code. B4 only makes our share of it smaller.
- **A dead radio with nothing cached** (first visit, or an evicted cache) can only be shown honestly, with time, bytes and Retry. It cannot be made fast.
