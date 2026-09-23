# Cache policy (`vercel.json`) — `project/archive/2026-09-22-load-perf.md` §1b, §P3.2

Ported from `game-demos/trials-gauntlet-demo/docs/design/cache-policy.md`. Vercel's `vercel.json`
schema rejects unknown keys (no `$comment`), so the rationale lives here. **Keep this file and
`vercel.json` in step** — `vite/pwa-plugin.ts` reads `vercel.json` and replays the same rules in
`vite preview`, so what the bench measures is what the host sends.

Vercel applies every matching rule and the **last match wins per header key**, so `vercel.json`
reads top to bottom: the catch-all, then the long-lived classes, then the content types, then the
files that must never be cached.

| rule | value | why |
|---|---|---|
| `/(.*)` | `public, max-age=0, must-revalidate` | Catch-all. Anything not named below is revalidated on every load (one conditional round trip, 304 when unchanged). No COOP/COEP: we do not need cross-origin isolation, and `require-corp` would break the Google Fonts stylesheet `index.html` links. |
| `/assets/(.*)` | `public, max-age=31536000, immutable` | Vite's emitted bundle: `/assets/<name>-<8 char hash>.{js,css,jpg}`. Content-hashed by filename → safe forever. The service worker also keeps these in `ws-immutable` (see below). |
| `/assets/baked/(.*)` | `public, max-age=0, must-revalidate` | Build-time bakes (`terrain.bin`, `sky.json`, baked textures / cards) are **regenerated at the same path** by every build, so the `/assets/(.*)` year would let a phone's HTTP cache serve a stale bake past a deploy (the D22 class: stale `terrain.bin` → empty palm merge; the SW side was fixed by `37c27ce` / `5b798c8`). Revalidating costs a 304 per file; the phone tier's boot reads them out of the content-hashed pack (`/assets/packs/<slug>.<tier>-<hash>.bin`, which stays under the immutable rule), so this only touches the desktop tier and non-boot reads. |
| `/assets/music/(.*).json`, `/assets/sfx/(.*).json` | `public, max-age=0, must-revalidate` | The audio manifests are rewritten in place by `scripts/music` and compiled into the bundle by `vite.config.ts` (`src/boot/audio.generated.ts`) — the game never fetches them; revalidate for anyone else who does. The `.m4a` files next to them are named `<name>-<sha1[:8]>.m4a` (content-addressed), so they stay under the `/assets/(.*)` year (docs/plans/PRELOAD-OFFLINE.md, E44: they were `must-revalidate` while the manifests were fetched at runtime). The worker keeps them in `ws-static-*`, cache-first. |
| `/assets/tex/(.*)`, `/assets/models/(.*)`, `/assets/hdri/(.*)` | `public, max-age=2592000` | **Not content-hashed today.** These are the unhashed Poly Haven files copied straight from `public/assets/**` (`forest_ground_04/diffuse-2k.jpg`, `hatchet.gltf` + `.bin`, `*_2k.hdr`), so they must NOT be `immutable`: a re-baked texture at the same path would be pinned for a year. One month is the gauntlet fonts/art rule ("so that it does get garbage collected eventually"): the HTTP cache holds them across a month of launches, the service worker holds them in `ws-static-<assetsHash>` keyed by a hash of `public/assets` so a deploy that changes any of them rolls the cache. When P3.1 content-hashes these paths, move them into the `immutable` rule. |
| `/basis/(.*)` | `public, max-age=2592000` | Reserved for the KTX2/Basis transcoder (P1). Unhashed, versioned with the static cache like the art. |
| `/(.*).hdr` → `image/vnd.radiance`, `/(.*).glb` → `model/gltf-binary`, `/(.*).gltf` → `model/gltf+json`, `/(.*).ktx2` → `image/ktx2`, `/(.*).webmanifest` → `application/manifest+json` | `Content-Type` | Vercel's default MIME table serves `.hdr` / `.ktx2` as `application/octet-stream`; the loaders do not care, but Safari's PWA install and the SW's `content-length` byte accounting are happier with real types, and `.webmanifest` must be `application/manifest+json` for the iOS home-screen install. |
| `/`, `/index.html` | `no-store` | The service worker owns the document (cache-first with a background revalidate). A cached `index.html` in the HTTP cache would pin an old build id and an old entry chunk beneath the worker. |
| `/sw.js` | `no-store` | `sw.js` is how a new build is discovered: the browser byte-compares it on `reg.update()`. A cached copy is an update the player can never take. |
| `/version.json` | `no-store` | The title-screen build pill (`src/ui/Update.ts`) polls it to light up "new build · tap to update". The SW never intercepts it (network-only), so offline it simply fails and the pill stays plain. |
| `/asset-index.json` | `no-store` | The byte table the loading screen sums; regenerated every build. Network-first in the SW with the last copy as the offline fallback. |
| `/manifest.webmanifest` | `no-store` | Small, and the icons/start_url it names must follow the build. Network-first in the SW. |

## The service worker's three caches (`src/pwa/sw.js`)

They expire on three different clocks, which is why there are three:

| cache | holds | expires |
|---|---|---|
| `ws-immutable` | `/assets/<name>-<hash>.*` — the emitted bundle | never wiped; `activate` prunes it to the files the new build's `sw.js` names (`__BUNDLE__`), so a deploy costs only the chunks that changed |
| `ws-static-<assetsHash>` | `/assets/tex|models|hdri|baked|packs/**`, every `.m4a` under `/assets/music|sfx/**`, `/basis/**`, `/fonts/**` (precached at install since E44), root icons — what the loading bar streams, cached as it passes through | keyed by a hash of the `public/assets` file list + sizes; a JS-only deploy keeps the whole cache. An asset change names a new cache, and `activate` **migrates** every entry of the old one whose decoded size still matches the new `/asset-index.json` (fetched `no-store`) before dropping it — so adding, resizing or removing one file costs only that file. Before 2026-09-18 it rolled the whole cache: the first launch after such a deploy re-downloaded everything. |
| `ws-shell-<build>` | `index.html`, `manifest.webmanifest`, `asset-index.json` | keyed by the build id (`<sha>-<content hash>`); dropped on `activate` of the next build |

`__BUILD_ID__` in `sw.js` is `vite.config.ts`'s `BUILD_ID` **plus** a content hash of the emitted
files + the `public/` list, so an identical rebuild is the same worker (the browser does not
reinstall a byte-identical `sw.js`) and the player's cache survives it.

Cross-origin requests (Google Fonts) are never intercepted: offline, the title screen falls back
to the system font stack that `hud.css` declares after Rajdhani / JetBrains Mono.

## What the loading screen's DOWNLOAD track can and cannot tell you

DOWNLOAD counts the bytes the boot's fetches deliver (`src/boot/bytes.ts` tees every `/assets/**`
body) **regardless of where they came from** — the worker's cache, the HTTP cache or the network
all read the same. A wiped or missing cache therefore still shows `30.5 MB / 30.5 MB · 100 %`; the
tell is the SETUP rows: every step that fetches (sky, terrain, cards, cabins, props) takes seconds
while every step that only computes (forest, edge, grass, herds) stays in the tens of ms. That
pattern on 2026-09-18 (cabins 16.0 s) was the static cache being rolled by a deploy that added
`terrain.bin`, not a CPU regression.

## iOS eviction (gauntlet `PWA_OFFLINE.md` §4.1)

Quota is not the risk; eviction is. Safari drops all script-writable storage for an origin after
**7 days without user interaction**; opening the home-screen app counts, so a weekly player is fine
and a monthly player needs one online load again. `navigator.storage.persist()` does not exist on
iOS Safari, so the only defence is a resident set that is small and cheap to refill.

## Verified

2026-09-17, `pnpm build && vite preview --port 4174`, headless Chromium via `agent-browser`, build
`0b33061-mu6cvxgj-76c689979d`, `?nolock=1`:

| check | result |
|---|---|
| first load | worker controls the page; Cache Storage holds **69 entries / 59.66 MB** (`ws-static` 63 files 58.30 MB, `ws-immutable` 3 files 1.35 MB, `ws-shell` 3 files 7 KB). 17.8 MB in 9 requests went out before `clients.claim()` landed — main.ts does not yet `await window.__ws_sw.ready` — and were cached on the second visit instead (73 entries / 77.07 MB held from then on). |
| second load | every one of the **69 `/assets/**` resources has `transferSize === 0`** (served by the worker); the only same-origin network hit is `/version.json` (**362 bytes**); `load` event at 233 ms. |
| offline | `set offline on` + reload: 73 same-origin resources, 0 failed, boots to the title screen (`progress/068-pwa-offline-title.png`); the build pill stays plain because `version.json` is unreachable. |
| new build | after a rebuild the new worker reaches `installed`, `window.__ws_sw.waiting` is set and the pill shows "new … update"; `adopt()` → reload comes up on the new build with the old `ws-shell` dropped, `ws-static` intact (77 MB kept), and again only `version.json` on the network — the new entry chunk was precached at install. |
| `?sw=0` | unregisters the worker (`getRegistrations().length === 0`). |

`vite preview` differences from the host: sirv serves `/` with `Cache-Control: no-cache` (it sets that
after the middleware; `/index.html` gets the `no-store` rule) and adds `Vary: Origin` — which is why
the worker matches with `ignoreVary`.

2026-09-18, static-cache migration (`scripts`-free check, playwright persistent context on `vite preview --port 4181`,
`?tier=phone&skipintro=1&nolock=1`, bytes = page responses not served by the worker + the worker's own fetches):

| step | bytes on the wire |
|---|---|
| build A, first launch | 33.34 MB in 92 responses |
| build A, second launch | 0 (7 responses: document, `version.json`, Google Fonts) |
| add one 1 MB asset under `public/assets/`, build B, `adopt()` → reload | **0.83 MB in 24 responses** (the new bundle + shell; before the migration this was the full 33 MB) |
| build B, next launch | 0 |
