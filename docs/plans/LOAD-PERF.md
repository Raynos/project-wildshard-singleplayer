# Plan: 100× faster load & start (benchmaxx)

**State:** `in progress` 2026-09-22 — levers through Round 2 landed; open: L1 (iPhone reading pending), P3 crossbow programs 8 → 4, P5 cold bytes 30 → ~10 MB (ASKS).

## Status (2026-09-17, load-speed agent) — measured before → after per lever

Desktop = headless Chrome, ANGLE Metal, `?tier=phone&skipintro=1&nolock=1&perfload=1` (the `?perfload=1`
instrumentation in `src/boot/perflog.ts` lists every program each phase compiles). Phone = the user's
iPhone screenshot of the loading panel, warm (everything from the offline cache).

| Lever | Commit | Desktop before → after | Phone before → after |
|---|---|---|---|
| **Shaders: precompile everything** (scene materials deduped by material × object flags, shadow-depth variants built as `WebGLShadowMap.getDepthMaterial` would, sky background box, every post-chain material; issued at once, `KHR_parallel_shader_compile` polled per program with a live count) | `d584095` | shaders 3.5 s serial → 0.11 s; first frame 1.86 s (19 programs) → 0.25 s (0 programs) | shaders 4.8–53 s + first frame 12.5 s → _pending_ |
| **r186 removed `PCFSoftShadowMap`**: the first shadow pass flipped the type, a cache-key parameter, so every program compiled twice | `d584095` (settled in `precompile()`; the constructor still says PCFSoft) | tier=desktop first frame 105 → 179 programs → 0 | part of the 63 programs above |
| **Resolve links in the step** (`LINK_STATUS` per program, 12 ms slices — the cold Metal library build otherwise lands in the first frame's `onFirstUse`) | `3996b33` | first-ever launch: 1.96 s of `onFirstUse` in the first frame → in the bar | _pending_ |
| **Continuous bar** (steps weighted by the previous run's ms per tier/cores, elapsed/expected < 1 for the running step, per-frame republish) | `da7c9c3` | 232 paints over a 1.23 s load, longest gap 214 ms, 0 regressions | — |
| **Terrain baked at build time** (`scripts/bake-chunk.mjs` → `public/assets/baked/<slug>/terrain.bin`, 256² heights + splat on the mesh grid; `src/world/BakedTerrain.ts` swaps Heightfield's `heightAt`/`normalAt`/`splatAt` for grid lookups — mesh bit-identical, every placer and the player read the grid) | `937c76d` | terrain 249 → 86 ms · grass/ferns/litter 210 → 75 · forest 17 → 13 (fresh contexts) | _pending_ (was terrain 838 · grass 620) |
| **Textures uploaded in the step** (`renderer.initTexture` for ~100 textures, 12 ms slices) | `5c6b8ef` | first frame 733–1468 → 103–128 ms (fresh contexts); time to world 4.3–4.8 → 2.6–2.7 s | _pending_ |
| **Round 2 — fewer programs** (each ≈ 110–150 ms of Metal compile on the iPhone, cold): BatchedMesh colour bit in the precompile stand-ins · undergrowth wind / horizon haze / cabin moss / fire particles as uniforms instead of source constants and defines · every plain MeshStandard/Physical material given the same map slots (1×1 fillers in `Sky.setupMaterial`) · needle/twig depth share · cabin + lantern glass through the shared programs · idle tone-mapping luminance pair no longer compiled | `d4c9657` `0b731ef` `114b4b3` `c4287fd` `05980ed` `714b6c2` | tier=phone programs **103 → 76**, 0 compiled at the first frame (crossbow: next row) | _pending_ (was 98 + 7 at first frame) |
| **P3 crossbow 8 → 4 programs** (iron / brass / cord / leather / peep → MeshPhysical + vertex colours on the stock's program, white colour attribute where a mesh has no wear; bolt `forceSinglePass` — the transparent DoubleSide bolt was a BackSide + FrontSide pass pair; depth clearer fogless; the prod keeps its anisotropic program, textures keep anisotropy 8) | `3ce85f6` | crossbow programs **8 → 4** (lit · prod · bolt · tracer line), tier=phone total 79 → 77 (2 of the 8 were shared with the hands / hoverboard / rifle / sword viewmodels, so they stay); 0 at the first frame, 0 on firing; look unchanged (progress/141 → 142, peep colour within 0.2 %) | _pending_ |
| **SW static-cache migration** (`activate` copies the previous ws-static-* entries whose size matches asset-index.json; `/assets/baked/**` cached) | `9f6c3e2` | +1 asset deploy: 33.3 MB → 0.83 MB on the wire | the 16 s cabins run was this |
| **Branch cards baked headless** (`scripts/bake-cards.mjs` → `card-{albedo,normal,arm}`, 3.1 MB) | `0ad009e` | 2 programs + 3 RT passes gone from the cards step (79 → 77) | _pending_ (cards 826 ms cold) |
| **Procedural textures baked** (`bakedTexture()` + `scripts/bake-textures.mjs`: clouds, planet, deer/boar fur albedo + normal) | `2bb4d4c` | sky 133 → 95 ms · herds 105 → 16 ms (fresh contexts) | _pending_ (herds 980 ms cold) |
| Sun / horizon from the HDR, PMREM, cabin geometry merge, KTX2 (§P1) | — | — | — |

Remaining per step, desktop headless tier=phone fresh context (ms, 2026-09-18 00:50): renderer 9 · sky 95 ·
terrain 82 · cards 70 · forest 14 · edge 21 · grass 66 · cabins 92 (GLTF + texture decode; 36 ms CPU) · props 27 ·
animals 16 · shaders ~280 (76 programs linked + resolved, ~100 textures uploaded) · first frame ~78; ≈ 0.9 s of
steps, 2.4 s to the world including browser start-up and the 1.3 MB bundle.

Programs left (76): 23 custom-patched lit materials (terrain, slab, needles/far/bark/twigs, pond, ridge, grass ×2,
undergrowth, cabin door/moss, fur ×2, crossbow ×4 since `3ce85f6`), 8 generic lit variants, 3 Lambert
(planet / rings), 11 unlit (MeshBasic ×7, sprite, lines, points), 10 small scene ShaderMaterials (sky dome,
particles, boundary), 7 shadow-depth variants, 13 post (3 EffectPass + god rays 3 + bloom 3 + SMAA 2 + copy/mask)
+ the sky box. Below ~60 means dropping effects on the phone tier: god rays (−4), SMAA (−2), bloom (−3).

Goal: the chunk playtest opens like a native game on an iPhone home-screen PWA —
title screen in under a second, playable in seconds, and a **second launch that
touches the network for nothing but `version.json`**.

## 0. Baseline (measured 2026-09-17, build `5cc42cc`)

| Metric | Value | Source |
|---|---|---|
| Requests on first load | **73** | `performance.getEntriesByType('resource')` |
| Bytes transferred | **70.6 MB** — jpg 58.9 · glb 6.8 · hdr 2.3 · png 1.3 · js 1.2 (0.4 gz) · bin 0.9 | same |
| PBR textures | ~30 JPEGs at **2048²** (diffuse / nor_gl / arm per set); ≈ 640 MB of RGBA+mip GPU memory once decoded | `magick identify`, `du` |
| CDN caching | every asset is `cache-control: public, max-age=0, must-revalidate` → revalidated on every launch; `.hdr` is `application/octet-stream`, uncompressed | `curl -I` on prod |
| Service worker | none — nothing survives a cold start, no offline | — |
| Desktop M-series, localhost | sky 230 ms · terrain 385 ms · card bake 60 ms · planting 200 ms · boundary+water+horizon+grass+undergrowth+particles ≈ 1.2 s · cabins+props+animals ≈ 1.2 s → **≈ 2.5 s compute + first-frame shader compile** | MutationObserver on the loading log |
| **iPhone, Wi-Fi, home-screen PWA** | **> 3 min**, stalls at 97 % "Spanning the crossbow" (21:24 → 21:27 screenshots) | user screenshots |

Where the phone's minutes go, in order of size:

1. **Download** — 70 MB, 73 round trips, none cached. On 50 Mbps that is ~12 s; on LTE it is a minute.
2. **JPEG decode + GPU upload + mipmap generation** of ~30 × 2048² images on the main thread, then ~640 MB of texture memory on a device that gets killed near 1–1.5 GB.
3. **First-frame shader compilation** — every material × CSM cascades × fog/wind/rim patches compiles synchronously on the first `render()`. On iOS (Metal via ANGLE) that is the multi-minute "97 %" stall: the loading bar says crossbow, the GPU driver is compiling ~100 programs.
4. **Per-launch procedural work** that is fully deterministic and identical every launch: HDR parse + PMREM, 256² heightfield/splat/normals, twig-atlas → branch-card render-target bake, 2 600 tree placements, ~50 k grass + 6 k ferns + moss/litter/stones placements, cabin assembly.

The plan attacks them in that order. Every phase has a number it must move.

## 1. Targets (budgets — `pnpm bench` fails if exceeded)

| Budget | Now | Target |
|---|---|---|
| Title screen visible (app shell only) | after full load (minutes) | **< 1.0 s** on 4G, cold |
| First-launch transfer | 70.6 MB | **≤ 12 MB** (≥ 6×; the 100× is on the *second* launch) |
| Second-launch transfer | 70.6 MB | **≈ 1 KB** (`version.json` only) |
| Requests, first launch | 73 | ≤ 20 |
| Time to play, iPhone 13-class, cold | > 180 s | **≤ 10 s** |
| Time to play, iPhone, warm (SW cache) | > 180 s | **≤ 3 s** |
| Peak texture memory | ≈ 640 MB | ≤ 150 MB |
| Main-thread long tasks during load | uncounted | none > 100 ms |

## 1b. Borrowed from `game-demos/trials-gauntlet-demo` (reviewed 2026-09-17)

That repo shipped the same problem to a PASS on WebKit/Metal (cold boot 3.3 s, second boot
all-cache, offline PWA live at `0788a68`). Port, don't re-derive:

| Theirs | What it is | Where it lands here |
|---|---|---|
| `src/boot/plan.ts`, `steps.ts`, `docs/tasks/loading-progress-invariant.md` | Two tracks: **DOWNLOAD** = Σ bytes read / Σ bytes declared, **SETUP** = Σ weight × step fraction; a running step is `done/(total+1)` so it cannot read 100 % before it resolves; `done()` *throws* unless both are exactly 1. Per-step wall ms + detail text. Steps are a typed table; a step declared but not run is a compile error. | P0 — replaces the hardcoded `step(label, 0.78)` fractions. **This is the honest loading screen.** |
| `src/boot/stream.ts` `streamBytes` | Bytes counted as the `ReadableStream` delivers them; denominator = content-length only when un-encoded, else the build's declared size. | P0 — our `loadTexture` moves from `<img>` to `fetch → createImageBitmap` (also decodes off the main thread) so images count too. |
| `plan.generated.ts` / `load-manifest.json` (vite plugin) | Byte table of `public/` + emitted bundle, committed, regenerated by every build; literal keys so a deleted file fails typecheck. | P0 — our `asset-index.json` plugin becomes this. |
| `src/boot/inline.ts` (≤ 8 KB, budget asserted) | Loading screen painted from the first HTML bytes; streams the core bundle as its own step before the module runs. | P4 — time-to-title < 1 s. |
| `compileMaterials` + `firstFrame` (`src/render/index.ts:932–1040`) | Batches of 2 materials via detached `mesh.clone(false)` in a temp Group, `compileAsync(batch, camera, scene)` **against the composer's scene render target** (variants depend on output colour space / tone mapping); then scene-only draw (shadow-depth programs), then post chain, each yielding a frame. | P2.3 — replaces the per-object precompile sketch; fixes the 97 % stall with a real `n/N programs` counter. |
| `src/pwa/sw.js` + `src/boot/sw.ts` `swBoot` | Three caches on three clocks (immutable content-addressed / static keyed by a hash of `public/` / shell keyed by build); `activate` prunes to the manifest, never wipes; build id = sha **+ content hash** so a rebuild of the same tree keeps the cache; **register before the first big fetch and wait ≤ 2.5 s for `clients.claim()`** so the first visit is cached; a waiting worker is adopted with one reload at the head of the loading screen (no toast). `ignoreVary: true` — vite preview's `Vary: Origin` otherwise misses every entry. | P3 — port verbatim, rename caches; the build pill becomes the "adopt now" surface. |
| `vercel.json` + `docs/design/cache-policy.md` | Last-match-wins ordering; `/assets` immutable, fonts/art one month, `/`, `index.html`, `sw.js`, manifests `no-store`; `$comment` keys are rejected by Vercel's schema → rationale lives in the doc. | P3.2 |
| `PWA_OFFLINE.md §4.1` | iOS: quota is not the risk, **eviction after 7 days without interaction** is; `navigator.storage.persist()` does not exist on iOS Safari. | Corrects P3.5 below: no `persist()`; keep the resident set small and cheap to refill. |
| ask 59 quick wins | Stop shipping unused copies; one tier by DPR. | P1 — we ship 8 HDRIs (36 MB) and fetch one; `.gltf+.bin` *and* `_lod.glb` per model. |
| `harness/e2e/offline.mts`, `?sw=0`, `?harness=1` | Aeroplane-mode gate, SW opt-out for debugging. | P0 bench harness. |

Where we go further: gauntlet still ships JPEG/WebP textures. KTX2/Basis stays — 59 MB of
2048² JPEGs is *our* dominant cost and theirs was models.

## 2. Phases

### P0 — Instrument first (½ day)

- `src/core/perf.ts`: `mark(label)` / `measure()` around every loading step and the first
  three frames; tallies `renderer.info.memory` + `programs.length`. `?perf=1` draws the table
  on screen (Rajdhani/JetBrains, same glass panel) with a *copy* button so an iPhone run can
  be pasted into a ticket — the phone is the only place the real numbers exist.
- `scripts/bench-load.mjs` (Playwright/CDP, headless only): opens the production preview under
  **CPU throttle 4×/6×** and **network presets** (Fast 3G, 4G, Wi-Fi), cold then warm, and
  writes `progress/bench/<build>.json` + a markdown table. `pnpm bench` compares against
  `bench.budget.json` and exits non-zero over budget. This is the "benchmaxx" loop: every PR
  below reports before/after from this script *and* one real-iPhone `?perf=1` paste.

### P1 — Bytes: −60 MB (1–2 days) — biggest single win

1. **KTX2/Basis every texture, at build time.** `scripts/bake-assets.mjs` runs `toktx`
   (UASTC for `nor_gl`, ETC1S q≈160 for diffuse/arm, full mip chain, cached by content hash)
   into `public/baked/tex/<set>/<map>.ktx2`. Load with `KTX2Loader` (already in three; needs
   the Basis transcoder wasm in `public/basis/`). Expected: **59 MB → 8–10 MB**, texture
   memory 640 → ~110 MB (GPU-native ASTC on iOS, BC7 on desktop), **zero main-thread JPEG
   decode**, no runtime mipmap generation.
2. **Resolution tiers.** 2048² only for the near-field hero sets (`pine_bark`, `pine_tree_01`
   twigs, `forest_ground_04`); 1024² for everything else; a `mobile` tier at 1024/512 chosen
   by `navigator.hardwareConcurrency`/`deviceMemory`/UA (also what will get the phone to 60 FPS).
3. **Placeholder mips.** One 256² atlas of every set's smallest mip (~300 KB) loads first;
   full KTX2 swaps in per-texture as it arrives. The world can render — blurry — at ~1 MB.
4. **Sky.** Ship the *baked PMREM* (or a 1024×512 half-float KTX2 equirect, ~1 MB) instead of a
   4.1 MB uncompressed `.hdr` + runtime `PMREMGenerator`. Remove the seven unused HDRIs from
   the deploy (36 MB on disk, only one is fetched).
5. **Models.** `gltfpack -cc -tc` (meshopt + KTX2 textures) → one `.glb` per model; stop
   shipping both `.gltf+.bin` *and* `_lod.glb`. 6.8 → ~1.5 MB.
6. **Fonts.** Self-host the two Google Fonts subsets as woff2, `<link rel=preload>`,
   `font-display: swap` — today the title can't paint until fonts.googleapis.com answers.
7. **Per-chunk asset manifest.** `ChunkDef.assets` lists exactly what the chunk needs; the
   loader fetches only that (ties into the shard infra — Pine Hollow must not pay for
   Alpine's textures).

### P2 — Pre-bake at deploy time (2 days)

Everything deterministic moves from the phone at launch to the build machine once.

1. **`scripts/bake-chunk.mjs <slug>`** runs the pure chunk functions in Node (they already are
   pure: `heightAt/normalAt/splatAt`, seeded `Rng`/`Noise2D`) and writes
   `public/baked/<slug>/`:
   - `terrain.bin` — height (f32) + normal (oct-encoded u16×2) + splat (u8×4) + canopy (u8)
     at 256² ≈ 0.6 MB (brotli ≈ 0.3 MB). Also lets us go to 512² later for free.
   - `forest.bin`, `grass.bin`, `undergrowth.bin`, `props.bin` — packed instance transforms
     (position f16/u16-quantised, rotation, scale, colour) → the phone does **no** placement
     maths and **no** `heightAt` calls at launch.
   - `manifest.json` — content hashes for every baked file (feeds the SW precache list).
2. **Branch-card bake → build time.** The twig-atlas → card render-target pass needs a GPU;
   Vercel's builder has none, so `pnpm bake:cards` runs headless Chrome locally (agent-browser)
   and commits `public/baked/pine-hollow/branch-card-{diffuse,normal,arm}.ktx2`, guarded by a
   hash of the atlas + `TreeFactory` bake code so it can't go stale silently. Runtime
   `TreeFactory` becomes "load three KTX2s".
3. **Shader precompile with progress.** Replace first-frame compilation with
   `await renderer.compileAsync(scene, camera)` during the loading screen (its own step, with
   `KHR_parallel_shader_compile` so it doesn't block), and **cut variant count**: share
   materials between props, drop CSM to 2 cascades on mobile, one fog/wind patch not five.
   This is the fix for the 97 % stall specifically.
4. **`prebuild` hook** in `package.json`: `bake-assets` + `bake-chunk` for every registered
   shard, cached by hash, so `vercel deploy` always ships fresh bakes without a manual step.

### P3 — PWA: cache all the downloads (1 day)

1. **Content-hash every static asset** (Vite `assetsInclude` + `import.meta.glob`, or a
   `public/` → `dist/` rename pass in the bake script) so they can be **immutable**.
2. **`vercel.json` headers**: `/assets/**`, `/baked/**`, `/basis/**` →
   `Cache-Control: public, max-age=31536000, immutable`; `index.html`, `version.json`,
   `sw.js` → `no-cache`; correct `Content-Type` for `.ktx2` / `.glb` / `.hdr`. (Today: everything
   revalidates, every launch, 73 times.)
3. **Service worker** via `vite-plugin-pwa` (`injectManifest`, Workbox): precache the app shell
   (html/js/css/fonts/icons/transcoder); `CacheFirst` for `/baked/**` and `/assets/**`;
   `NetworkOnly` for `version.json`; `navigateFallback` to `/`. The manifest revision is the
   existing `__BUILD_ID__`. **Wire `skipWaiting`/`clientsClaim` to the title-screen build pill**
   (`src/ui/Update.ts`) so "new build · tap to update" is also what activates the new SW —
   one mechanism, not two.
4. **Warm the cache during the attract camera**: after time-to-play, `requestIdleCallback` fetches
   anything the chunk *might* need next (other quality tier, other shards' thumbnails).
5. Keep the resident set small (≤ 20 MB) and cheap to refill: iOS evicts all storage after
   7 days without interaction and has no `persist()`; opening the home-screen app counts as
   interaction, so a weekly player is fine.
6. Bench: warm launch must show **0 bytes** from the network except `version.json`.

### P4 — Start faster: time-to-title and time-to-play (1–2 days)

1. **App shell first.** Render the mockup-06 title screen from the app shell *before* any
   world asset is requested; world loading happens behind it with the existing progress bar
   moved into the title panel. "Enter the chunk" enables when the *minimum viable world* is up.
2. **Minimum viable world = sky + terrain + trees + player.** Grass, undergrowth, props, cabins
   interiors, animals, audio stream in afterwards, ordered by distance to the spawn; pop-in is
   hidden by the fog line and the attract camera's framing. Water/horizon/boundary are cheap
   and stay in the first set.
3. **Nothing synchronous over 16 ms.** Split remaining CPU steps (cabin assembly, animal rigs)
   across frames with a `yield()` helper; the bar animates, iOS doesn't declare the page hung.
   With P2 in place the remaining work is buffer uploads, so this is mostly ordering.
4. **Mobile quality tier** (shared with the 60 FPS work): DPR cap 1.5, 1024² tier, 2 CSM
   cascades, half-res N8AO or off, grass radius 40 m, no fur shells. Picked once at boot,
   overridable with `?tier=`.
5. **Idle prewarm on the title screen**: compile the crossbow/HUD/animal programs and upload
   the streamed assets while the player is reading the panel — the "Enter" press should be
   free.
6. **JS**: split `src/dev/**` and audio out of the main bundle, `modulepreload` the rest,
   keep `three` in one chunk (it's 415 KB brotli'd — fine, and cached by the SW).

## 3. Order of execution

| Step | Moves | Effort |
|---|---|---|
| P0 bench harness + `?perf=1` | the ruler | ½ d |
| P1.1–1.2 KTX2 + tiers | −50 MB, −500 MB GPU, no decode | 1 d |
| P2.3 shader precompile + variant cut | the 97 % stall | ½ d |
| P3 headers + SW + pill wiring | second launch → 0 bytes | 1 d |
| P1.4–1.7 sky / models / fonts / manifest | −10 MB, −1 round-trip on the title | ½ d |
| P2.1–2.2 baked terrain / placements / cards | −1.5 s CPU, phone does no maths | 1½ d |
| P4 app shell, streaming world, mobile tier | time-to-title < 1 s, time-to-play | 1½ d |

Each step: bench before, bench after, one real-iPhone `?perf=1` paste in the commit message,
deploy (per AGENTS.md — deploy frequently). Nothing lands that doesn't move its number.

## 4. What this does *not* fix

- 60 FPS **in play** on the phone is a separate plan (the mobile tier here is the first step).
- The 100× is on the second launch and on time-to-title; first-launch bytes go ~6–8× because
  photoreal PBR at 1024–2048² has a floor around 8–12 MB even with Basis. Below that means
  fewer sets or procedural detail, which is an art decision.
