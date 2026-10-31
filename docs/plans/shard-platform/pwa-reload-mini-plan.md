# Clean PWA reload: one tap on NEW BUILD lands the newest build

**State:** `draft` 2026-10-31 for Jake's grill. Written by wildshard-v's planning subagent; after the grill, wildshard-new
hands out the rows and marks them. Ask E519. Jake: *"Have a subagent make a mini plan about how to reload cleanly in game
for a PWA. I think we might have problems it smells to me. I definitely have to reload multiple times to get the 'new
build' pill to go away."* It follows [QC3](../../../project/archive/2026-10-30-qa-2026-10-30.md) (e2dfc879b5: the tap
adopts a waiting worker), whose fix was checked with behaviour tests only, never with an installed-PWA visit. Nothing here
changes pixels, so every row is Codex (G848 / G958). The pill's look stays the same; only *when* it lights changes.

Measured 2026-10-31 on HEAD `a4024eb`, Playwright WebKit and Chromium, iPhone 16 Pro, muted. One served build was
cloned into A, then into B and C, which differ only in build id and worker bytes (a deploy with no code change). They were
served behind a proxy that can delay the worker's install, to stand in for the phone's ~20 MB precache. Script, proxy and
log: `tmp/wildshard-v-pwa-reload/` (`repro.mjs`, `proxy.mjs`, `make-variant.mjs`, `results.log`). There was no Simulator
pass in this session; PR5 does it.

## What happens today

You're on build A and a deploy lands. The pill lights the moment `/version.json` says B, but the phone hasn't
downloaded B's service worker yet. A tap then reloads into A again, because the old worker serves every page itself, so
the pill lights again. On WebKit it gets worse: a tap while B is still installing **wedges the worker queue**. B finishes
installing, but no later page can see it, so every later tap is another plain reload into A. Only ending the app's
process clears it. That is the "reload multiple times" Jake feels.

| Measured (WebKit unless named) | Taps | Landed |
|---|---|---|
| No deploy, 3 reloads | 0 | pill stays dark (good) |
| A→B, wait 40 s, then tap | **1** | B, pill dark (the only clean path) |
| A→B, tap the moment the pill lights | 8 | **never** (B stuck `installing` for 60 s+) |
| A→B, 25 s install, tap once at 10 s, wait 30 s, tap 6 more | 7 | **never**: B is waiting in the registration, but every new page's `register()` hangs for 4 s+, so the pill never learns of it |
| Same, Chromium | 2 | B (the first tap is wasted, but nothing wedges) |
| A→B→C, B already waiting | 2 | B, then C (no collapse) |
| A→B→C, C mid-install when tapped | 8 | stuck on B |
| Wedged page, `getRegistration().waiting` + `SKIP_WAITING`, then one `replace('/')` | **1** | B in 4 ms (shows the fix works) |

## The cause chain

1. **The pill lights for a build that one reload can't deliver.** `check()` lights it as soon as `/version.json` differs
   from the document (`src/engine/ui/Update.ts:111-118`), and only asks the worker to start installing
   (`requestInstall`, `Update.ts:88`). Every navigation is answered by the *controlling* worker's own baked document
   (`src/engine/pwa/sw.js:148-150`; on WebKit there is no static route, see 5), so the next page is A for as long as A
   controls.
2. **A tap with nothing waiting is a plain reload** (`Update.ts:53`), and the next page lights again (`Update.ts:118`).
   On a phone the B install runs for seconds to tens of seconds, so taps land inside it.
3. **On WebKit a navigation during an update job wedges the registration's job queue.** After that, `register()` never
   settles, in this page or any later one (probed: `HANG>4s` in every document, even after B is waiting). `sw.ts` waits
   for `register()` before it watches (`src/engine/boot/sw.ts:236-240`), so `watch()` never runs and
   `__ws_sw.waiting` stays null. `reload()` therefore never adopts (`Update.ts:53`). `getRegistration()` is not a job,
   still sees `reg.waiting`, and `SKIP_WAITING` still activates it. WebKit has the same class of stuck queue on record
   ([webkit.org/b/202992](https://bugs.webkit.org/show_bug.cgi?id=202992): *"the job queue is stuck and there is no way
   for the web site to unblock the job queue except closing all clients"*). On the phone, "closing all clients" may
   not even be enough: the worker server lives in the network process, which can outlive an app kill
   ([webkit.org/b/199110](https://bugs.webkit.org/show_bug.cgi?id=199110), fixed in iOS 16 for one case of a waiting
   worker that never activated). PR5 checks this on the Simulator.
4. **Two deploys don't collapse.** `announce()` lights for any installed worker, whatever its build (`sw.ts:79-87`), and
   `check()` stops polling once lit (`Update.ts:112`). A tap adopts B; the B page then finds C and lights again.
5. **The engines disagree about which build a page is.** On Chromium, `/` and `/index.html` race the network against the
   worker (`sw.js:73-74`, `addRoutes`, from bdf605f0c6), so a page can be the network's newer build while the old worker
   controls it, and the pill then lights for the build already running (QC3's "lit with no new deploy" shape). WebKit
   hasn't shipped static routing ([webkit.org/b/269893](https://bugs.webkit.org/show_bug.cgi?id=269893), open), so Jake's
   phone always gets the worker's document.

Ruled out, with evidence: a stale `version.json` (`no-store` header, fetched `no-store`, and the worker passes it through,
`sw.js:147`); a stale `sw.js` (`no-cache` plus ETag, re-fetched on every check in the request log); the G898 fence
(it only guards stale-chunk recovery during play, `browserChunkRecovery.ts`; the pill's tap is not fenced); the 5-minute
poll re-lighting after a good reload (dark for 30 s after B landed in both the "1 tap" runs; the poll compares against
the new document). bfcache / app switch: a resume fires `visibilitychange`, which only re-checks (no reload). It is
harmless once 1 is fixed.

How iOS home-screen apps differ (the cause needs none of this, but the design must survive it): the standalone app
keeps one long-lived page with no address bar and rarely navigates. Update checks run only when the page calls `update()`
(`sw.ts:243`) or navigates. Its storage and worker are its own, separate from Safari's (reports since iOS 13.4). It
does not support `addRoutes`, so the worker always decides which build a page is.

## The proper design

**The worker decides which build a page is, and the pill lights only when a worker for the newest build is installed
and waiting.** `/version.json` only *discovers* (it calls `update()`); it never lights the pill by itself while a worker
controls the page. Then a lit pill always means "one tap lands it", the tap can never fall inside an install, and the
wedge has nothing to trigger it. Concretely:

- A controlled page reads its registration with `getRegistration()` (not a job, so it can't hang). It calls `register()`
  only when there is no registration yet (a first visit at `ws:control-ready`, as MF21 has it now).
- Lit = `reg.waiting` exists, its build (`BUILD` message) is not the document's, and it matches the newest
  `/version.json` (prefix match, as `refreshWorkerForChunkRecovery` already does). If `/version.json` is newer than the
  waiting worker, stay dark and `update()`. C replaces B in the waiting slot, and the pill lights once, for C. The poll
  keeps running while lit, so a third deploy is still seen.
- The tap reads `reg.waiting` fresh at tap time, sends `SKIP_WAITING`, waits for `activated`, then makes one
  `replace('/')` (title) or `reload()`. That's QC3's adopt with a fresh handle instead of the cached `api.waiting`.
- An **uncontrolled** page (worker off, `?sw=0`, first visit, storage refused) keeps lighting from `/version.json`
  directly, because its reload goes to the network and does land the new build.
- Deleted: the Chromium-only network race for documents (`sw.js` `addRoutes` for `/`, `/index.html`; the script, style
  and font routes stay). Also `requestInstall`'s text swap, and `WsSw.activate()` (only tests call it). Offline is
  unchanged: the worker still serves its baked document and its caches.

No new timers, retries, covers or automatic reloads (the reload-simplify rule). The worker file itself is unchanged
apart from the deleted route.

## Rows

| Row | What | Done when (measured) | Lane | Size |
|---|---|---|---|---|
| PR1 | **The reload counter as a check**: commit this session's `repro.mjs` / `proxy.mjs` / `make-variant.mjs` as `scripts/pwa-reload-check.mjs`, run through `browser-lane.sh` on one served build. Scenarios: no deploy; A→B tapped the moment the pill lights; A→B with a 25 s install; A→B→C with C mid-install. It prints taps-to-clear. | On today's HEAD it reproduces the table above (8 / never, 2 on Chromium); under 3 min a run. | Codex | S |
| PR2 | **Never wait on `register()` in a controlled page** (`sw.ts` `boot` / `register` / `watch`): watch `getRegistration()`, register only when there is none, `update()` stays fire-and-forget. The tap reads `reg.waiting` fresh (`adopt`). | PR1's wedged case (one tap mid-install, then wait): the next tap lands B in **1** reload; `sw`, `sw-ready-*`, `sw-registration-blocked`, `update-*` tests pass. | Codex | S |
| PR3 | **Light only for a deliverable newest build** (`Update.ts` `check` / `lightUp`, `sw.ts` `announce`): `/version.json` only discovers while a worker controls; `announce` compares the waiting worker's build against the document and the newest `/version.json`; the poll keeps running while lit. | WebKit **A→B = 1** tap even when tapped the moment anything lights (25 s install: dark until installed); **A→B→C = 1** tap landing C, with B already waiting and with C mid-install; no deploy: dark through 3 reloads; Chromium the same. | Codex | S |
| PR4 | **Delete what disagrees**: the document race route in `sw.js`, `requestInstall`'s text swap, `WsSw.activate()` and the tests that pin them (G416). | Chromium A→B: the page never runs a newer build than its controller (doc = ctrl after every tap in PR1); WebKit warm title unchanged (MF1's ≤ 0.1 MB warm network). | Codex | S |
| PR5 | **One Simulator home-screen pass** (`scripts/sim-lane.sh`, a real home-screen web app): deploy A, install, serve B, tap the pill once; then A→B→C. Before PR2 / PR3 land, also check whether a wedge survives an app-switcher kill. | Taps-to-clear = 1 for A→B and A→B→C on the Simulator's home-screen app; the wedge finding is noted in this plan. | Codex | S |

Order: PR1 first (it's the ruler), then PR2 → PR3 → PR4, then PR5 once at the end. Jake's next playtest on the phone is
the final check (he does no phone chores); this plan closes when a deploy during his session takes one tap.

## Questions for Jake

1. **While a new build downloads, what does the pill do?** On the phone this takes seconds to tens of seconds.
   - Skip for now.
   - **Stays as it is until one tap will land the new build** (recommended: no change to how the pill looks, and nothing
     to tap that can't work).
   - Shows "Downloading new version…" while it downloads (a visible pill change, so it would be an Opus row and a board).
2. **When the app is opened fresh and a newer build is already downloaded, does it switch by itself?** (G898 says a new
   build switches in "at the next launch or title visit".)
   - Skip for now.
   - **No: the lit pill on the title offers it, and one tap takes it** (recommended: reload-simplify ruled out automatic
     reloads, and an extra reload during the launch image risks the black flash we just removed).
   - Yes: adopt it before the title shows (one hidden reload at launch).
