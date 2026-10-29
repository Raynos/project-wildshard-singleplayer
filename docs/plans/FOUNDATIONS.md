# FOUNDATIONS: what is structurally broken, and the rewrite that fixes it

**State:** `open` 2026-10-29: **wave 1 (MF1–MF7) approved and in flight (G886)**; waves 2–3 follow. Written by wildshard-v's subagent; Jake ruled the five calls ~14:25 (G884, G887–G889: all yes) and added a battery bar (G890). Grill panel 1 (~14:40): SHARD-PLATFORM stays open until wave 1 + his QA (G892); he runs the git-history reset himself (G893); wave 1 crashes first (G894); after a kill the game reopens where you were (G895). Panel 2 (~14:45): phones at 30 fps always, superseding G876 (G896); the title read-ahead fetches only the last shard's spawn list (G897); a new build switches in at the next launch or title visit (G898); far shadows refresh less often behind a Debug A / B (G899). Panel 3 (~14:48): memory cuts by the builder with a board (G900); the modal for every error in Developer, only play-breaking ones in public (G901); no load-time cap, an honest bar (G902); Pine and Nine legacy go after wave 3's verb checks (G903, superseded by G908: on his word after his final QA, leave them alone). Panel 4 (~14:50): verb lists written by a lane from LEGACY (G904); wildshard-v reads Sentry hourly (G905); only the deployed site reports (G906); battery ≤ 8 % per 20 min (G907). Jake's next phone QA: likely 10-30.

Jake, 2026-10-29 ~14:15 Cancun: *"I need a sub-agent to look at everything in the second wave of QA and come up with a
mega plan. You know, like zoom out, one and out, zoom out, see the forest through the trees, come up with a mega plan,
the permanent solution. Like, no quick fixes, no small bug fixes, no, like, something is completely fucked. Something is
just permanently fucked. It needs to be solved properly, the right way. We need to figure out who fucking done. No, we
don't care about who did it. We just need to figure out what is fundamentally broken, like deeply broken, and what needs
to be completely rewritten from scratch."*

Also today: *"reload should just reload the page … it seems over-engineered … delete 90% of it"*; *"the main menu should
be instant. Like, how fucking hard can this be?"*; *"The downloading is supposed to be fucking instant. Like 0.1 seconds,
download bar full, out of the cache"*; *"Don't fucking reject the checksums … Trust the server"* (G881); *"Why the fuck
are we not loading and downloading everything correctly? … Such a shitty experience"*; *"If it's good enough, it's good
enough. I just want it to be done."*

Evidence read: [QA 2](shard-platform/qa-2026-10-29-2-mini-plan.md) (QB1–QB17), [QA 1](shard-platform/qa-2026-10-29-mini-plan.md)
(QA1–QA14), [reload-simplify](shard-platform/reload-simplify-mini-plan.md) (RL1–RL10), the
[download audit](shard-platform/download-audit-2026-10-29-mini-spike.md) (DA-1–7), the
[Nine pop-in audit](shard-platform/nine-popin-2026-10-29-mini-spike.md) (NP-1–5), all 40 unresolved Sentry issues
(7 days), the 59 `/api/errors` reports in `.review/inbox/`, and git churn since 10-15 (10,377 commits).

## One screen

**Six things are broken at the root.** Each one has been "fixed" dozens of times in two weeks and came back, because each
fix added a layer instead of removing the cause.

1. **The front door is a download manager.** Icon to title passes through an inline loader, a 996-line service worker
   that also counts bytes, 43 retried dynamic imports and three separate retry / recovery screens. Black boot, the boat,
   the hang, stranded pages after a deploy. *(QB1, QB3, QB4, QB13, RL1–RL8, QA1)*
2. **Loading has no single list of what the spawn needs.** The bar's total, the files fetched, the cache, and the
   reveal each use a different idea of "what this load is". So the bar is wrong on all six shards, warm loads crawl, and
   Nine reveals at 30 % and pops in. *(QB5, QB9, QB16, QA3, QA5, QA8, DA-1–7, NP-1–5)*
3. **Memory is estimated, never measured, and nothing is let go.** A model says Pine is 1,214 MB; the phone kills Pine
   and Nine to a white page anyway, and kills every page in the background. *(QB6, QB12, QA12, QA14)*
4. **Every object has three owners.** Loans, leases, keepers, residents and scopes each hold the same textures, systems
   and worlds; they release twice or never. Exit throws, systems register twice, the page strands. *(QB7, QA12, RL10)*
5. **The game enforces its bookkeeping by throwing at the player, then hides it.** 2,760 `throw`s in the shardfile /
   grid / plugin / app layers; three throws switch a whole system off (all weapons died from one NaN); only a quiet chip
   says so; 40 Sentry issues sit unread. *(QB8, QB10, QB11, QB14, QA13)*
6. **The SHARDFILE ports are checked by photographs, not by playing.** 144 golden stills prove the look; nothing proves
   the hook zips, the crank turns or the crossbow reloads. *(QB11, QB15, QB16, QB17)*

**Two habits feed all six:** *timers make decisions* (8 s, 10 s, 12 s, 3 s, 1.5 s, 6 s, 10 min deadlines decide when to
reveal, retry or reload, instead of a condition), and *the instrumentation outweighs the thing* (≈ 2,300 lines of boot
accounting and timing, ≈ 2,300 lines of error / recovery / trace plumbing).

**Rewrite from scratch:** the service worker (≈ 150 lines), the boot entry (title from one static chunk), the loading
pipeline around one baked spawn manifest, the fault policy, the HUD action-slot update. **Delete:** the page-side content
cache (LRU, leases, worker protocol, hash worker), download receipts and loading calibration, client re-admission of our
own products, the resume / update / stuck screens, the background JPEG still and away-reload, texture leases, in-place
disposal for standalone shards. **Keep:** the launch image + static title shell, content-named files, the loading card,
the confirm-tap RELOAD (G877), the crash line, the scope tree itself, the shard content.

**The bars** (iOS 27 Simulator home-screen app, then Jake's phone):

| Bar | Number |
|---|---|
| Icon → our pixels | launch image, then the title shell; never black; live title ≤ 0.5 s after the launch image warm, ≤ 2 s cold |
| RELOAD | `location.reload()` (title: `location.replace('/')`); same bar as a warm launch |
| Warm shard load | DOWNLOAD bar full ≤ 0.1 s after the tap; ≤ 0.1 MB network; no checksum on any read |
| Bar honesty | numerator never passes the total; 100 % exactly when the spawn files are in; cold and warm, every shard |
| Reveal | nothing in the spawn view appears, sharpens or links after PLAY; no frame > 100 ms from 2 s after PLAY |
| Loading never freezes | no main-thread gap > 1 s on the loading card, cold, every shard |
| Memory | measured Simulator footprint under 1.2 GB in play and 1.8 GB loading, per shard (G534 / G556), 3 × 60 s Pine and Nine |
| App switch | 60 s away, back in place: no new boot, no "ended on hide" report |
| One bad thing | a throw skips that one entity / weapon / quest for one frame; no system ever switches off |
| Every error | full-screen modal (G880), one report id in `/api/errors` and Sentry; the 7-day Sentry list read daily to zero |
| Exits | PAUSE ▸ MAIN MENU and New game reach the live title in ≤ 0.5 s from every shard, always |
| After a deploy | an open page keeps working (old chunks fetchable) or reloads once onto the new build; first load fetches ≤ 1 MB + changed chunks |
| Verbs | every shard's verb list (hook, crank, weapons, quests) played SHARDFILE vs LEGACY, same result |

**Before Jake's next phone QA:** Wave 1 (below), seven rows.

---

## Family 1: the front door is a download manager

**Symptoms:** QB1 (6 s black), QB3 (boat, hung "Application modules" 13.5 s until Retry), QB4 (too many screens), QB13
(deploy strands open pages; "Stylesheet failed"; `pageEntry-*.js` gone), RL1 (8 s phone reload), RL10 (New game reload
to the wrong shard), QA1 (RELOAD did nothing). Sentry 74 `Failed to fetch`, 7B `"<!doctype" is not valid JSON` (a missing
file served as the SPA page), 7W *"download exceeded 3 seconds and has no visited offline copy"*.

**Mechanism.** Between the icon and the title: `index.html` (inline loader, now down to a 12 s self-reload after RL3),
`src/engine/boot/sw.ts` registration, `src/entry.ts` with **43 `import()` calls each wrapped in `retried()`** (every one a
service-worker round trip and a place to hang), then `src/engine/pwa/sw.js`, **996 lines**: code packs, warm bundles,
blob reservation and pumping, background pause / resume, `migrateStatic` SHA-hashing under a 30 s GC deadline,
`pruneImmutable` (deletes the previous build's code, which is exactly what a stranded page asks for), and
`server-timing` receipts so the page can count bytes. Recovery is layered three deep: `retried()` (0.8 + 2.5 s),
`fetchAttempt` (10 s stall, `sw.js:742`), `stuck.ts` (10 s card), inline self-reload (12 s), `GpuRecovery` away-reload
(10 min, `GpuRecovery.ts:81`), plus `Resume.ts` and (until RL2) UpdateProgress. The download audit found the worker
itself throwing on a 304 (`sw.js:838`, DA-4) and WebKit fetching 4.2 MB of modules past it (DA-6).

**Why point fixes do not hold.** Since 10-15: `src/entry.ts` 52 commits, `sw.js` 33 (`81bcac53d8` bound stalled boot
downloads, `a6f21eac96` bound online cache waits, `f3bf5b331b` retry dropped downloads, `65a83b569e` keep activation off
the network, `e74651fe5d` await first-use persistence…), `index.html` 19, `src/engine/boot/` 177. Each timeout added
for one hang creates the next screen; RL1 measured desktop WebKit reloading in 0.13–0.23 s while the phone takes 8 s, so
the cost is in the worker and the waterfall, not in our code's work.

**Target design.** The boring PWA. `index.html` is static: launch-image art + WILDSHARD, one stylesheet, one module
script. The title is one small chunk that imports no engine, no three.js, no worker (plain DOM over the title art), so
it paints in one round trip. The engine loads behind the title while the player looks at it. The service worker is
rewritten from scratch, ≈ 150 lines: on install precache this build's shell + hashed code list; cache-first for every
content-named URL (code, assets, shard blobs, keyed by hash, build-independent); network for `version.json`; keep the
previous build's code cache one generation so an open page never loses a chunk; the build output also carries the
previous deploy's hashed chunks for pages the worker does not control. No byte counting, no packs, no background
scheduler, no hashing, no GC deadline. A failed dynamic import reloads once onto the new build. RELOAD is
`location.reload()`. Every in-world "go to title" (exit, New game, reset save) is `location.replace('/')`.

**Delete:** `sw.js` as it is; `retried()` around the 43 imports (one failure → one reload); `stuck.ts`'s card;
`Resume.ts` + `.ws-resume` (RL5); the away-reload and hide-still in `GpuRecovery.ts` (keep context-lost restore);
`titleArrival.ts`, `waits.ts`, `stall.ts`. **Rewrite:** `sw.js`, `src/entry.ts` (title path), `src/engine/boot/sw.ts`.
**Keep:** launch image, `#0b1622` paint, the static shell, `version.json` pill, G877 confirm tap, `markReload`, the crash
line (QB6), `waitForLoadingStyles`.

## Family 2: loading has no single list of what the spawn needs

**Symptoms:** QB5 (53.2 of 52.0 MB on Driftwood; 59 % at the end on Pine, 84 % Sky, 82 % Dunes, 30 % Nine), QB9 (warm
load not instant, 6.2 s "content cache get", 5–8 s admission), QB16 (Nine pops in after PLAY), QA3 (68 s freeze), QA5
(growing total), QA8 (7–11 fps after loading), Nine's 4.4 s freeze "at Audio" (DA-7 / NP-4). Sentry 7X warm-up stalled
30 s, 7J *"Refinement requires declared fine geometry"*, 7Y pack hash mismatch, 7P *"Missing specimen cost bytes"*.

**Mechanism.** Four different answers to "what does this load need":
- the **bar's total** is baked from the whole phone-tier product plus boot extras (`scripts/app-build/entryTotals.ts:65-67`),
  while the **numerator** counts every declared file from wire *or* cache (`src/engine/boot/download.ts:115`,
  `loadingDownloadText.ts:37`) and double-counts worker receipts (`download.ts:172, 208-211`, DA-6);
- the **fetch** is driven by the runtime plan (`src/game/shardfile/clientPlan.ts`, 85 commits since 10-15), through two
  caches: the worker's and the page's `ContentCache` (`contentCache.ts`, LRU index, leases, a worker protocol, a hash
  worker, SHA-256 on every read until `f663308101`, still on every write at `:247`);
- the **reveal** is decided by timers and caps (`readyFrame` races 1.5 s, `src/game/session/finish.ts:171`; spawn links
  capped 3 s; world links 6 s) and Nine's spawn geometry is fenced to *after* control on purpose
  (`src/game/shardfile/controlRefinement.ts:28`, D179 B / G811);
- the **first frame** draws synchronously with first-use compiles in no named step (`Game.ts:1351`).
Five loading paths (`src/game/boot/loadingPaths.ts`: legacy, shardfile, grid, crossing, cell), ~30 rows, and the client
re-admits our own build output on every load (preflight, section reads, cost checks; `product.ts:362-370`).

**Why point fixes do not hold.** Since 10-15: 458 `(loading)` commits; 24 on the bar's total alone (`0153521910`
align MB with network, `52cdb2c0e4` separate prefetch and wire totals, `a70b6a78ae` wait for the step total,
`6df56ce104` fix the denominator, `537bc90029` retain the early total, `aa7b89c913` tier facts in byte totals…); 402
fix / perf / feat subjects about admission; ten loading or memory plans archived in two weeks (loading, loading-speed,
phone-loading, iphone-downloads, grid-ready, tile-streaming, core-memory, js-heap, js-payload, memory-strip). Every fix
reconciles two of the four lists; the other two drift.

**Target design.** The build writes, per shard and tier, **one spawn manifest**: every file the spawn view needs (URL =
content hash, byte size), in fetch order. The loader fetches exactly that list through the one worker cache (a hit is
used as is, G881: only a length compare), the bar is `bytes done / sum(manifest)` with cache hits completing at once
(that is the 0.1 s warm bar), then decode → build → upload → link every program the spawn view draws → draw one hidden
frame → reveal. No timer reveals. Everything past the spawn view streams after PLAY only out of view or with a dither
fade (NP-2). The grid home and a standalone shard use the same pipeline; the grid just has a longer manifest. The client
trusts our build: first-party products are not re-validated, re-hashed or cost-checked on the phone (the build already
did, and a broken product is a build failure, not a player-facing refusal).

**Delete:** the page `ContentCache` + `contentCacheWorker` / protocol / queue / hash worker (the worker cache is the one
store); `DownloadAccounting` receipts and `server-timing` plumbing; `loadingCalibration.json` and Simulator-seeded bar
weights; the whole-product title read-ahead (it prefetches the manifest instead, DA cause 9); client admission of
first-party products; the 3 s descriptor fallback (`product.ts:264`); `controlRefinement`'s fence for anything in the
spawn view; the separate `legacy` / `cell` loading paths once legacy is deleted. **Rewrite:** the loader core around the
manifest; `entryTotals.ts` becomes the manifest writer. **Keep:** content-named files, the loading card and its rows,
"Hold at loading screen", program linking under the loader (QA8, G878), the spawn-ring default (G867's row stays off).

## Family 3: memory is estimated, never measured, and nothing is let go

**Symptoms:** QB6 (Pine and Nine die to a white page; phone hot), the Developer banner *pine-hollow ESTIMATE 1,214.6 /
1,200 MB* with ~430 MB between "claim" and "estimate" unaccounted, QB12 (tab back lands on the title; **17 inbox reports
"boot after the last page ended on hide"** in one morning, each a 30–38 s reload), QA12 / QA14 (two worlds resident).

**Mechanism.** The cap is enforced against a model (`src/format/deviceMemoryCost.ts`, `memoryAdmission`, calibrated
base), not a reading. The runtime juggles memory instead of spending less: KTX2 lease-out / lease-back swaps texture
sources under three.js (`src/engine/core/ktx2.ts`, 552 lines; `lease` appears in 274 source files, 165 lease / loan
commit subjects), retained grid residents, home keepers, parked levels. On hide nothing is released: the game takes a
JPEG still into sessionStorage (`GpuRecovery.ts:139-143`, called on hide at `:266`) and keeps the renderer, caches and
worlds; iOS reclaims the largest background page first.

**Why point fixes do not hold.** 122 `(memory)` commits since 10-15; four memory plans archived 10-27 alone; the
ceilings are re-recorded (`budgets/*-re-record.json`), the estimate moves, the phone still dies. QB7's crash came from
the lease machinery itself (`b18fbaeca9`: "lease.back swaps the texture's source while three keeps the old binding").

**Target design.** Measure, then cut. Each shard's footprint is read on the iOS 27 Simulator (WebContent + GPU) at its
worst spot, in play and while loading, and that reading is the number the banner shows. A shard over 1.2 GB is cut at
the build (smaller textures for the phone tier, fewer resident tiles), not juggled at runtime. One world per page
(Family 4). Textures are uploaded once and disposed once: no leases. On `visibilitychange: hidden` the loop stops and
nothing is allocated; no still, no storage write. Background survival comes from being small, not from tricks.

**Delete:** texture leases (`leaseOutKtx2` / `leaseInKtx2` and their callers), the hide still and the resume still, the
estimate's "calibrated base" as the reported number. **Rewrite:** the Developer memory line to show the measured
reading. **Keep:** the caps (G534 / G556), the per-shard ratchet as a jump detector (E424), `gpuOnly` CPU-copy release.

## Family 4: every object has three owners

**Symptoms:** QB7 (exit from legacy Pine throws *"Scope level disposal failed: r.usedTimes"* and strands the player),
QA12 (two worlds after exit), RL10 (New game reloads into Driftwood). Sentry: 7Z / 7C `usedTimes`, 77 *"Resident instances
exceed the target"* (22 events), 6K *"Held slot owner has ended"* (4 users), 78 / 7E *"Missing frozen scene
resource / material"*, 4S *"lost its allocation after mip retirement"*, 79 *"Missing admitted raw return module loan"*,
6H *"Retired or replaced elite output owner"*, 7F *"Standalone tile work and cleanup failed"*, 7G / 7H / 7T *"Duplicate
system id"* (three systems registered twice), 7R `backgroundGate is not a function` (80 events), 6R *"Raw director
module is stale or mixed"*. **About half the 40 open Sentry issues are the runtime's own bookkeeping failing.**

**Mechanism.** `src/engine/app/scope.ts` (495 lines), `ownership.ts`, `sceneOwnership.ts`, `disposalCache.ts`, the grid's
residents and retirements (`src/game/grid/live.ts:419, 463, 840`), loans (60 files), leases (274), keepers
(`homeKeeper.ts`, 552 lines). One page has held the title, the grid, a standalone shard and retired worlds at once, so
every object needs a hand-written lifetime story; QA12 already concluded the cure is a fresh document (`aac39462b7`).

**Why point fixes do not hold.** 203 commits since 10-15 on scope / ownership / session / `live.ts`; `995a424756` made a
failed exit still reach the title, which treats the symptom; `e52800cc55` detach retired cache consumers, `efcb18bed1` end
retired construction bindings, `828dd585c8` retain moving copy roots: each fixes one owner pair.

**Target design.** The page is the lifetime. Title, each standalone shard and the grid are separate documents; moving
between them is a navigation, so the browser frees everything and nothing is disposed by hand on exit. Inside a world,
one owner per object: the scope tree, nothing beside it; a resource is created by one scope and released by that scope
once. The grid's in-world crossings (resident neighbours, hand-offs) are G828's one-world question: **Jake's alone; this
plan does not touch them.**

**Delete:** in-place session disposal for standalone exits, New game, reset save and shard switches (navigate instead);
loans / leases / keepers outside the grid; `AggregateError` disposal chains on the exit path. **Rewrite:** nothing
large: the exits become `location.replace`. **Keep:** `Scope` as the one owner inside a world.

## Family 5: the game throws at the player to keep its books, then hides it

**Symptoms:** QB11 (all weapons dead: `main.equipment` switched off after *"Invalid numeric input draw"* × 3), QA13 /
QA14 (a NaN normal lit white blocks across the screen), QB8 (only a chip), QB10 (40 unresolved Sentry issues, a test
harness reporting to production: 7V), QB14 (startup throw, 4 days open). Inbox: audio `stop time` RangeError × 5,
schema refusals (*"Expected … but received 'cone'"*, *"four midpoint entryways are required"*).

**Mechanism.** Data is not proven finite at the build, so the frame proves it and throws
(`src/game/plugin/channelPrograms.ts:223`). Systems are coarse (`main.equipment` is every weapon,
`src/game/session/play.ts:701`) and `recordFault` (`src/engine/core/faults.ts:57`) switches a system off after 3 throws in
a row. 2,760 `throw new Error` sit in `src/game/shardfile`, `grid`, `plugin` and `src/engine/app` (legacy shards: 408 in
more code). Reporting is spread over `faults.ts`, `errorReport.ts`, `crashFlag.ts`, `browserErrors.ts`, `lastEnd.ts`,
`bootTrace.ts`, `lifeTrace.ts`, `ErrorModal.ts` (≈ 1,500 lines) and nobody owns reading them.

**Target design.** Check at the build, tolerate at runtime. The bake asserts every authored number finite and every
reference present; a runtime invariant that fails skips that one entity / weapon / quest step for that frame and
reports once. No system is ever switched off; only a core failure (renderer, physics) stops the loop. Every report opens
the modal (G880). One reporter writes `/api/errors` and Sentry with the same id; harness and local runs never reach
production. Sentry's open list is read to zero once, then each new issue is fixed or resolved with a line the day it
appears (a row in the coordinator's routine, not a bot).

**Delete:** the `'off'` verdict; `throw` on frame paths for bookkeeping checks (moved to the bake or turned into a skip);
duplicate trace sinks (one beat record, not three). **Rewrite:** `faults.ts` policy (small), the equipment system split
per weapon. **Keep:** the modal, `/api/errors`, Sentry, the core-fatal path.

## Family 6: the SHARDFILE ports are checked by photographs

**Symptoms:** QB17 (Nine hook: ZIP button only appears after an app switch; ZIP flies flat, never up), QB15 (Dunes well
crank janky), QB11 (crossbow), QB16's look half (sky as a seamed ceiling, dark crowd). Sentry 6G *"Quest tulpar is not
bound"*, 6Q *"Cell skin borrows bones outside its cell"* (75 events).

**Mechanism.** Port parity is the 144-camera golden rerun (stills). Verbs have no parity check, so a verb can be broken
on the day legacy is approved. The HUD's action slots repaint on events (`src/engine/ui/hudSlots.ts`,
`TouchControls.ts`): a SHARDFILE behaviour that changes state without the event leaves stale buttons until a resize.
Two of every shard ship: ≈ 114k lines of legacy beside ≈ 97k of SHARDFILE.

**Target design.** Each shard gets a written verb list (traversal, weapons, tools, each quest step) taken from LEGACY;
one lane plays each verb in both modes on WebKit and fixes every difference, once per shard, before Jake's per-shard
word deletes legacy (G873 / G882 / G883). The HUD's slots are derived from state every frame (pull, cheap compare), not
pushed by events. Legacy deletion then removes the second copy of everything.

**Delete:** event-driven slot swaps; legacy, shard by shard, on Jake's word only. **Keep:** the goldens for looks.

---

## Waves

Opus for anything the player sees (G848), Codex for non-visual engineering. Each row is a few hours of one lane.

### Wave 1: the front door, the bar, the reveal (before Jake's next phone QA)

| Row | What | Rewrite / delete / done when | Lane | Size |
|---|---|---|---|---|
| MF1 | New service worker | **Rewrite** `sw.js` ≈ 150 lines: precache shell + hashed code; cache-first content-named; network `version.json`; previous build's code kept one generation; no counting, packs, hashing or GC deadline. Done: RL1's three Simulator recordings ≤ 2 s warm, WebKit warm network ≤ 0.1 MB, no `respondWith` error. | Codex sp-x10 · **open**: core `0602c7b762`, QB21 `4911ffdbdf`, navigation `a040bdf610`; own WebKit native control 4/4, no `respondWith` error, warm load wire DW 8.90 / Pine 38.06 MB vs 0.1 MB (MF4/MF8 coverage open); three Sim readings pending sp-o3 | M |
| MF2 | Deploys never strand a page | **done** — `66ced96696` carries exactly the previous hashed graph; `ab07687619` / `48e059dc8b` recover stale JS/CSS once; G898 phase fence `6ed5be168f`. Two `--rev` proofs: old `48e059dc8b` page enters Driftwood after `e102a483ee` deploys, Chromium/WebKit 183,760 / 309,768 B observed wire. On `6ed5be168f` → `2c6c91d155`, all four iPhone cases (JS/CSS × Chromium/WebKit) keep the worker waiting during play, then adopt/reload once at the fresh title and enter D; `boot.selfReload=1`, no loop. Eleven focused controls pass. | Codex sp-x2 · done 66ced96696 + ab07687619 | S |
| MF3 | Title from one static chunk | **Rewrite** the title path in `entry.ts`: no engine / three / worker imports before the title; delete `retried()` around imports; delete `stuck.ts` card, `Resume.ts`, hide still, away-reload. Done: live title ≤ 0.5 s after the launch image warm on the Simulator; launch image → title, no other screen. | Opus sp-o3 · done 6e4e5e6817 (page 0.16 s; ~0.5 s is iOS web-app start) | M |
| MF4 | One spawn manifest | **Rewrite** `entryTotals.ts` as the manifest writer (spawn files, hash URL, size); the loader fetches it and the bar reads only it; delete receipts and calibration. Done: six shards, cold and warm, end at exactly 100 %; warm bar full ≤ 0.1 s. | Codex sp-x6 · landed 360d33fa03; six-shard bar proof pending | M |
| MF5 | Reveal = spawn view complete | NP-1 + NP-4 + DA-7: spawn-view refinement under the loader, a named first-frame step, every first-frame program linked; no timer reveals. Done: Nine cold and warm, no L0 tile after control, no frame > 100 ms past 2 s, loading gap < 1 s. | Opus sp-o3 · WebKit met 3713989c43 (Nine cold/warm: 0 links, 0 GLB reads after reveal, 0 frames >100 ms past 2 s, gap ≤ 0.5 s; ready step 2.1-3.2 s on the card); Simulator run pending | M |
| MF6 | No system switches off; every error a modal | Delete the `'off'` verdict; equipment per weapon; frame-path numeric checks skip the entity; QB8's modal for every report; harness off production Sentry. Done: forced NaN in the crossbow skips one frame, others keep working; modal on the phone. | done: Codex sp-x1 0392aa9bda + 7c3fc574ed, modal sp-o4 c33bf50cfc / 79a96bc1b4; phone proof in MF20 | M |
| MF7 | Pine and Nine under the cap, measured | Simulator footprint, 3 × 60 s each; cut the top consumers at the build; on hide stop the loop, allocate nothing. Done: < 1.2 GB in play, 60 s app switch resumes in place. | Opus sp-o5 · memory done on the Sim: Pine / Nine play peak ≤ 1.13 GB (WebContent + GPU), 8/8 runs survive 60 s, switches resume (6891098704, e0e375795e, e65663f9a4); phone kill proof = Jake QA; battery via FC rows | M |

**Supersedes:** QB1, QB3, QB4, QB5, QB6 (crash half), QB8, QB9, QB11 (policy half), QB12, QB13, QB16 (pop-in half),
RL1, RL4–RL8, DA-1–DA-7, NP-1, NP-2 (moves to wave 2), NP-4, NP-5. Rows of those plans that are mid-flight finish their
current slice (no mid-task re-briefs, G492); none starts new work after this is ruled.

### Wave 2: delete the machinery

| Row | What | Rewrite / delete / done when | Lane | Size |
|---|---|---|---|---|
| MF8 | One cache | Delete the page `ContentCache`, its worker, protocol, queue and hash worker; reads go through the worker cache with a length compare. Done: warm Pine admission ≤ 1 s on the Simulator; line count in the commit. | Codex sp-x9 | M |
| MF9 | Trust our build | Delete client admission of first-party products (preflight, section rehash, cost checks, 3 s fallback). Done: no admission row on a warm load; a broken product fails the build. | Codex sp-x1 (G887) | M |
| MF10 | Exits are navigations | **In flight (2026-10-29, sp-x2): source complete** (`5837630bca`, `92cad6de32`). Standalone exit, New game, reset save and shard switch use `location.replace`; no in-place disposal. On `a040bdf610`, all 22 standalone exits complete with zero disposal reports: Chromium 30.6–40.1 ms (11/11 ≤ 500); WebKit 40–971 ms (7/11 ≤ 500), with Pine 827, Nine 854, Blender 885 and Sky 971 ms. Their native HTML response ends at 800–941 ms despite the worker serving its literal shell with no CacheStorage await; platform navigation delivery remains an open timing miss. DW New game: Chromium 46.7 / WebKit 63 ms, zero disposal. Bar remains every shard → MAIN MENU ≤ 0.5 s. | Codex sp-x2 (G888 / G894; response-delivery cause routed to MF1) | S |
| MF11 | No leases | Upload once, dispose once; delete KTX2 lease swaps and loans outside the grid. Done: Pine / Nine Simulator footprint not worse; `usedTimes` gone from Sentry. | Opus | M |
| MF12 | Bookkeeping throws to the bake | Walk the 40 Sentry issues and the frame-path throws: each becomes a bake check or a skip-and-report. Done: Sentry 7-day list at zero or resolved with a line each. | Codex sp-x1 · 60-id verdicts e74ca75809; rest in source-check migrations | M |
| MF13 | Stream past spawn invisibly | NP-2: refines only out of view or dither-faded. Done: walk over Nine's first two bridges, no visible swap. | Opus | M |

**Supersedes:** QB7, QB10, QB14, RL9's split, the remaining `contentCache` / admission rows anywhere.

### Wave 3: verbs, by playing

| Row | What | Rewrite / delete / done when | Lane | Size |
|---|---|---|---|---|
| MF14 | HUD slots from state | **Rewrite** the action-slot update as a per-frame pull (E332: herdr before and after; no layout change). Done: Nine hook shows ZIP on lock with no app switch. | Opus | S |
| MF15 | Nine verbs | Hook lock → ZIP → lift to the hook point → land, vs LEGACY (QB17). | Opus | M |
| MF16 | Dunes verbs | The well crank end to end, three times (QB15). | Opus | M |
| MF17 | Pine verbs | Crossbow aim / fire / reload / swap 5 min, quests (QB11 rest). | Opus | S |
| MF18 | Driftwood, Nalati, Sky verb lists | Played both modes; fix differences. | Opus | M |
| MF19 | Nine look gaps | QB16's look half: sky distance and seams, facades, crowd; LEGACY vs SHARDFILE board. | Opus | M |
| MF20 | Prove the bars | Every bar in the table above on the Simulator, one before / after board, then tell Jake for his phone. | Opus | S |

**Supersedes:** QB15, QB16, QB17, QB11 (rest). Legacy deletion stays on Jake's per-shard word.

## Decisions (ruled 2026-10-29 ~14:25: all five yes — 1 = G884, 2 = G887, 3 and 4 = G889, 5 = G888; plus G890 battery)

1. **Nine's spawn view loads whole before the reveal**, reversing D179 B / G811 for the spawn view (NP-1). Recommended: yes (his 14:10 words).
2. **Our client trusts our build**: no re-admission of first-party products on the phone (extends G881). Recommended: yes.
3. **No system ever switches off** (supersedes E133's `'off'` verdict). Recommended: yes.
4. **Memory is measured on the Simulator; the estimate stops being the reported number.** Recommended: yes.
5. **Standalone moves are page navigations** (extends QA12 / G877). Recommended: yes.

**Battery bar (G890, Jake 14:24, [iOS Battery screen](../../art/qa-2026-10-29/battery-1423.jpg): Web 20 %, Safari 13 % today, 57 % used by 14:23 vs a 24 % average):** 20 min of phone-tier play at 60 fps costs a measured, capped share of battery and the phone stays cool enough to keep playing; no work at full rate when nothing changes; the title, loading card and pause menu draw at a low rate. Measured on the Simulator (energy / CPU / GPU time per frame) and confirmed on Jake's phone. Owned by MF7 in wave 1. **MF7b, frame cost (G909):** [frame-cost-mini-plan.md](shard-platform/frame-cost-mini-plan.md) (6e0374d7dd), FC1–FC15: the game draws only when seen (FC1–FC6 first, with MF7), then every frame cheaper (FC7–FC15).

## Risks and what not to do

- **No new gates, bots, crons or proof machinery** (G585, G564): the bars are measured by the lane that lands the row,
  numbers in the commit. Sentry reading is a routine, not an automation.
- **No URL switches**; any A/B is a Debug row (E451). **No facade multi-draw** (E271). **No reverts** (G674): fix forward.
- **Do not add a timer to fix a hang.** A deadline that reveals, retries or reloads is the habit this plan removes; the
  only one kept is the once-per-session self-reload.
- **Do not add a second accounting** of bytes, memory or lifetimes beside the one source; delete the old one in the same
  commit.
- **Risk: the service-worker rewrite lands mid-QA.** Ship it as one commit with a version bump that clears the old caches
  except content-named blobs; first load after it is a cold load once.
- **Risk: the spawn manifest makes Nine's load longer.** Accepted by Jake's bar (pop-in is worse than a longer load);
  the before-control ratchet rises with a citation (NP-1).
- **Out of scope:** G828's one-world / crossing architecture (Jake's alone), OPEN-PLOTS, BURN-DAMAGE-LIST, BAKED-WORLDS,
  NATIVE-CLIENT, the repo-size work. The legacy deletion stays on Jake's word per shard (G873).
