# Cache policy (`vercel.json`) — `docs/plans/LOAD-PERF.md` §1b, §P3.2

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
| `ws-static-<assetsHash>` | `/assets/tex|models|hdri/**`, `/basis/**`, `/fonts/**`, root icons — the 70 MB the boot streams, cached on use | keyed by a hash of the `public/assets` file list + sizes; a JS-only deploy keeps the whole cache, an asset change rolls it |
| `ws-shell-<build>` | `index.html`, `manifest.webmanifest`, `asset-index.json` | keyed by the build id (`<sha>-<content hash>`); dropped on `activate` of the next build |

`__BUILD_ID__` in `sw.js` is `vite.config.ts`'s `BUILD_ID` **plus** a content hash of the emitted
files + the `public/` list, so an identical rebuild is the same worker (the browser does not
reinstall a byte-identical `sw.js`) and the player's cache survives it.

Cross-origin requests (Google Fonts) are never intercepted: offline, the title screen falls back
to the system font stack that `hud.css` declares after Rajdhani / JetBrains Mono.

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
