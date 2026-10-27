# JS heap mini plan: what the Template allocates, and the clean path to measure it (E501)

**State:** `in flight` 2026-10-27 (sp-x9, G769; types/lint landings, baselines pending). G778: G1, the heap guard,
stays first and stays the exit-1 ratchet. G780: an H row whose code has landed closes when the plan's one reading at
the end passes; no per-row readings, so landed H rows read `in flight` until then. — was `planned` 2026-10-24 — Jake ruled the decisions (G731); built after the current extras (G683 order). Was: draft 2026-10-24, for Jake to read; not sent to the builder (Jake, ~22:05). Ask
[E501](../../tasks/asks/E501.md). Mini plan of [SHARD-PLATFORM](../SHARD-PLATFORM.md).

Jake (2026-10-24): *"Separate mini plan / mini audit to benchmaxx the JavaScript heap allocator in the browser,
find out why we allocate so many bytes and objects and strings and this and that for a template shard. Find the
shortest and cheapest path to load from the menu into the template so the test is not contaminated with code for
the other shards etc."*

Subject: **runtime heap allocation** (bytes, objects, strings, typed arrays, garbage churn, GC) while the Template
boots and idles. What code ships and loads per entry (bundles, lazy loading) is the sibling
[js-payload](js-payload-mini-plan.md) plan; rows below that are really "load less code" defer to it. Retained-holder
census and WebKit floors: [core-memory](../../../project/archive/2026-10-27-core-memory.md) §7 and §8 (G682, G713).

## 1. The clean path: menu → Template, nothing else

SHARD SELECT ▸ Template does not run the Template inside the menu's page. `travel()` writes a session handoff and
calls `location.replace('/?chunk=_template')` (`src/game/travel/travel.ts:62-69`): **a fresh document**. The menu's
heap, its grid prefetch and its title modules are gone before the Template's first module runs. So the shortest
clean path is to load that same document directly:

    /?chunk=_template&mute=1&nolock=1&sw=0      (Developer off, phone tier, no harness pins)

This is the existing route the menu itself opens (no new URL switch: `chunk` is the route, `mute`/`nolock`/`sw` are
existing harness settings that `bootRoute` ignores, `src/bootRoute.ts:11-14`). On that page:

| Step | What runs | Contamination? |
|---|---|---|
| `src/entry.ts` | identity, page services, title manifests (data only) | none |
| `shardSelection.prepareSelectedShard` | phone tier loads **only the selected manifest's discovery module** (`src/shardSelection.ts:31-42`) | none on phone; desktop or a legacy card imports every shard's discovery (`completeCatalogue`) |
| `startSelected` (`src/entry.ts:116-219`) | 18 platform imports (species, icons, pickups, hoverboard, weapon voices, boar look, grid page entry, grid prefetch module), Wasm script memory bank, product admission, `startSession` | platform code only; no other shard's product is fetched or parsed |
| `finish.ts:137` grid prefetch | only when the page is a grid cell (`ctx.grid !== null`) | off for `_template` solo; **on with Developer on** (see §2) |
| `finish.ts:202` `startShardPrefetch` | phone tier caches only the active shard; vetoed without a service worker | none (`sw=0` / blocked SW) |

Three things contaminated every reading taken so far, and the clean path drops all three:

1. **Harness pins.** Any `window.__wildshardHarness` makes the debug probe build its boot fingerprint at once
   (`src/engine/debug/probe.ts:380`), which SHA-256s every linked shader in JavaScript, allocating a new
   `Uint32Array(64)` per 64-byte block (`probe.ts:199-230`): **35.8 MiB of boot allocation** in a 3.9 s boot. Every
   smoke, census and memory ruler pays it; a player never does.
2. **Developer on.** Adds the grid prefetch in the Template page (valibot + `format/json.ts` validation of other
   products), GPU debug labels (`render/gpuLabels.ts:364`, 14.7 MiB / 90 s) and dev-only attribution: idle churn
   **6.84 vs 5.55 MiB/s**.
3. **Going through the menu in the same measurement.** The Developer-on menu runs the grid prefetch, validating every
   shard's product on the main thread (52 MiB allocated and 26 major GCs in its first 8 s), and the first-paint shell
   loop (below). None of it survives the navigation, but a capture that times "menu → template" includes it.

**How a lane runs it** (until row G1 makes it one command): `scripts/serve-build.sh --head`, then one muted iPhone 16
Pro Chromium context (service workers blocked, saves `settings.tier=phone`, `gfx.dpr=2`, no `devMode`, **no
`__wildshardHarness` init script**), CDP `HeapProfiler.startSampling` (16 KiB interval, include objects collected by
minor and major GC) before `page.goto` of the URL above, wait until `.ws-load` is gone and `__wildshard.world.game`
exists, `hud.enterNow()`, frame gate open; stop sampling (boot), snapshot, sample 90 s idle, trace 30 s
(`devtools.timeline,v8,disabled-by-default-v8.gc`), snapshot. Source maps from the served `dist/assets/*.js.map`
attribute every frame to `src/` file:line. The audit's one-off scripts are not committed (G506); G1 folds them into
`scripts/shard-phone-memory.mjs` (G585: extend, no new tool).

## 2. Readings (2026-10-24, HEAD `b0e5948474`, Chromium phone tier, one run each)

Diagnostic Chromium readings (G415), not WebKit footprint. Allocation = sampled bytes including objects already
collected, so it is churn, not residency. "Used" = `Runtime.getHeapUsage.usedSize`; "after GC" = right after a heap
snapshot (which collects).

| Reading | Menu (Dev on) | Template, harness pins | **Template, clean** | Template, Dev on + pins |
|---|---:|---:|---:|---:|
| Boot to ready | 8.1 s (menu + 8 s) | 3.9 s | 3.5 s | 3.6 s |
| Allocated during boot | 52.2 MiB | 168.8 MiB | **133.8 MiB** | 168.7 MiB |
| GCs during boot (minor / major) | 32 / 26 | 32 / 2 | 29 / 2 | 32 / 2 |
| JS heap used at ready (after GC) | 12.4 (8.5) MiB | 32.3 (28.8) MiB | 31.8 (28.5) MiB | 33.2 (30.3) MiB |
| ArrayBuffer backing at ready | 1.5 MiB | 23.0 MiB | 22.6 MiB | 22.7 MiB |
| Allocated at idle (90 s) | 83.5 MiB | 499.1 MiB | **503.7 MiB** | 616.3 MiB |
| Idle churn | 0.93 MiB/s | 5.55 MiB/s | **5.59 MiB/s** | 6.84 MiB/s |
| Per frame (30 fps) | n/a | 189 KiB | 191 KiB | 234 KiB |
| GCs in 30 s idle (minor / major) | 17 / 0 | 13 / 17 | **15 / 17** | 6 / 5 |
| Settled heap after GC | 8.7 MiB | 31.6 MiB | 31.5 MiB | 32.0 MiB |
| Snapshot nodes / self MiB (settled) | 292k / 12.7 | 779k / 65.1 | 781k / 65.3 | 799k / 65.1 |
| Scripts loaded (decoded JS) | 61 (1.2 MiB) | 246 (4.1 MiB) | 246 (4.1 MiB) | 246 |
| Workers | 2 | 4 (+2 tile decode) | 4 | 4 |

The idle Template allocates about **five times its whole live heap every 30 seconds** while the player stands
still. The heap sits just above V8's old-generation limit, so a scavenge that promotes a little starts incremental
marking again: **17 major GCs in 30 s** on the clean path too (15 minor / 17 major; each major is "finalize incremental marking via task",
freeing 0–7 MiB), 534 ms of background marking per 30 s. On an iPhone that is CPU and battery every second, and the Simulator work in
STATE.md "Frame floor" already showed full GCs are the frame-time lever (36 → 1).

### Settled Template heap by V8 node type (snapshot self bytes; harness-pins run, the clean run is within 0.2 MiB)

| Type | Nodes | MiB | What it is |
|---|---:|---:|---|
| native: ArrayBuffer data | 990 stores | 17.0 | product transport bytes 5.6, script + Rapier Wasm 4.7, geometry/heightfields/textures (core-memory §8) |
| code | 164.7k | 14.2 | bytecode + metadata for 246 modules (three 2.7, session 2.1, census §8); menu 1.9 |
| native: external strings | 3,752 | 9.0 | module source text V8 keeps for lazy compile; menu 2.0 |
| native: Wasm modules | 7 | 3.8 | Rapier + script modules |
| objects | 134k | 3.7 | 63k plain `Object` (1.9 MiB), 21k `Array`, 14k context scopes |
| strings | 147k (97k unique) | 3.4 | shader sources, saved JSON (0.26 MiB `progress` doc), loading calibration JSON (0.21), lint allow-list text (0.11) |
| arrays (elements / properties) | 26.4k | 2.7 | |
| object shapes | 47k | 2.4 | |
| closures | 71k | 1.9 | **33k are valibot schema closures** (`~run` 18.9k, `validate` 14.0k: 0.88 MiB) |

Duplicate strings are small (the biggest duplicate costs 21 KiB: three's shader chunks); no base64 blob or raw JSON
of a big section is kept after parse, except saved-progress JSON mirrored in `SaveStore.memory`
(`engine/saves/store.ts:63`, 0.26 MiB).

### Template boot allocation, clean path: top 30 (MiB, source-mapped)

| # | Allocating function, source-mapped | MiB |
|---:|---|---:|
| 1 | `replace` (native/replace) <- Wh @ three/three.module.js:6373 | 15.6 |
| 2 | `replace` (native/replace) <- Gh @ three/three.module.js:6394 | 3.2 |
| 3 | `(anon)` src/format/product.ts:418 | 3.2 |
| 4 | `It` src/engine/world/terrainTileView.ts:47 | 3.1 |
| 5 | `multiplyMatrices` three/three.core.js:10570 | 3.0 |
| 6 | `some` (native/some) <- Mr @ src/format/terrainTileBytes.ts:14 | 3.0 |
| 7 | `replace` (native/replace) <- Zh @ three/three.module.js:6443 | 2.9 |
| 8 | `_a` src/format/budget.ts:105 | 2.3 |
| 9 | `replace` (native/replace) <- qh @ three/three.module.js:6406 | 2.2 |
| 10 | `Bt` src/engine/world/terrainTileView.ts:96 | 2.2 |
| 11 | (V8 API) @ (native/(V8 API)) | 1.5 |
| 12 | `m` src/format/budget.ts:125 | 1.4 |
| 13 | `(anon)` src/format/skinLayers.ts:6 | 1.4 |
| 14 | `(anon)` src/engine/boot/timeline.ts:109 | 1.3 |
| 15 | `next` (native/next) <- (anon) @ session-C2hYWYl9.js:1 | 1.2 |
| 16 | `(anon)` src/format/terrainTileBytes.ts:56 | 1.1 |
| 17 | `getX` three/three.core.js:17333 | 1.0 |
| 18 | `from` (native/from) <- (anon) @ session-C2hYWYl9.js:1 | 1.0 |
| 19 | `(anon)` src/engine/world/terrainTileView.ts:49 | 1.0 |
| 20 | `getY` three/three.core.js:17366 | 1.0 |
| 21 | `~run` valibot:7413 | 0.9 |
| 22 | `Ua` src/format/product.ts:58 | 0.9 |
| 23 | `push` (native/push) <- e @ three/three.core.js:36328 | 0.9 |
| 24 | `$a` src/format/product.ts:415 | 0.8 |
| 25 | `entries` (native/entries) <- t @ src/format/product.ts:416 | 0.8 |
| 26 | `O` valibot:553 | 0.8 |
| 27 | `getOwnPropertyDescriptor` (native/getOwnPropertyDescriptor) <- o @ src/format/json.ts:25 | 0.8 |
| 28 | `getZ` three/three.core.js:17399 | 0.8 |
| 29 | `tn` src/game/shardfile/productCost.ts:38 | 0.8 |
| 30 | `e` three/three.core.js:11960 | 0.8 |

### Template idle allocation, clean path: top 30 (MiB over 90 s)

| # | Allocating function, source-mapped | MiB |
|---:|---|---:|
| 1 | `h` three/three.module.js:7357 | 67.6 |
| 2 | `bytes` src/engine/world/tileStreamer.ts:422 | 20.2 |
| 3 | `savedDoc` src/engine/saves/store.ts:115 | 17.5 |
| 4 | `planDesired` src/engine/world/tileStreamer.ts:427 | 13.5 |
| 5 | `_` three/three.module.js:7743 | 11.3 |
| 6 | `Vm` three/three.module.js:5284 | 9.9 |
| 7 | `N` src/game/shardfile/logicalState.ts:21 | 9.3 |
| 8 | `refresh` src/engine/input/InputService.ts:190 | 9.3 |
| 9 | `o` src/engine/saves/store.ts:169 | 9.1 |
| 10 | `M` src/engine/script/host.ts:129 | 9.0 |
| 11 | `runPhase` src/engine/core/Game.ts:671 | 8.6 |
| 12 | `a` src/engine/saves/store.ts:234 | 8.3 |
| 13 | `join` (native/join) <- g @ three/three.module.js:7703 | 7.8 |
| 14 | `step` src/engine/world/tileStreamer.ts:358 | 7.4 |
| 15 | `call` src/engine/script/host.ts:300 | 7.3 |
| 16 | `Lm` three/three.module.js:5159 | 7.2 |
| 17 | `apply` src/game/shardfile/skinLayerPlayback.ts:25 | 5.7 |
| 18 | `mt` three/three.module.js:17897 | 4.8 |
| 19 | `touchLayout` src/engine/input/InputService.ts:292 | 4.7 |
| 20 | `snapshot` src/engine/script/lane.ts:102 | 4.6 |
| 21 | `prepare` src/engine/script/client.ts:67 | 4.3 |
| 22 | `set` (native/set) <- o @ src/engine/world/tileStreamer.ts:429 | 4.0 |
| 23 | `next` (native/next) <- stepSystems @ src/engine/sim.ts:865 | 4.0 |
| 24 | `remaskAll` src/engine/world/tileStreamer.ts:677 | 3.9 |
| 25 | `add` (native/add) <- touchLayout @ src/engine/input/InputService.ts:292 | 3.8 |
| 26 | `(anon)` src/engine/script/state.ts:48 | 3.7 |
| 27 | `step` src/game/shardfile/clientSkins.ts:133 | 3.7 |
| 28 | `observe` src/game/shardfile/decisions.ts:410 | 3.5 |
| 29 | `next` (native/next) <- pose @ src/engine/script/client.ts:61 | 3.5 |
| 30 | `Ui` nm:@dimforge/rapier3d-simd/rapier_wasm3d_bg.js:9315 | 3.4 |

### Menu (Developer on): boot 52 MiB, idle 0.93 MiB/s

Boot: valibot 17.0 + `format/json.ts:25` 12.7 + content-cache worker client 5.3 + `grid/prefetch.ts` 4.1 MiB, the
grid prefetch validating every shard's product on the page (core-memory C1). Idle: **44.7 of 83.5 MiB is the
first-paint shell's `resources()` loop** (`index.html:137-149`): its `requestAnimationFrame(tick)` calls
`performance.getEntriesByType('resource')` and builds a `name + ':' + startTime` key per entry every frame, and on the
title it never stops, because only `Loading` adopts the shell (`src/engine/ui/Loading.ts:95-96`), which the title
page never creates. With Developer off the grid prefetch does not run (`GRID_GATES_PASSED = false`,
`src/game/grid/menu.ts:18`), so the public menu's idle churn is mostly that loop.

## 3. Why so much (causes, biggest first)

1. **three.js re-evaluates a program on every draw** (~1.4 MiB/s, the biggest idle bucket). `getParameters`
   (`three.module.js:7357`, 66 MiB / 90 s), `getProgramCacheKey` + `join` (`:7703`, `:7743`, 18 MiB) and the uniform
   upload path run from `setProgram` (`:18407`) → `getProgram` (`:18224`) for draws in both the shadow pass (via
   `render/gpuLabels.ts:419`) and the main pass (via `render/memorySaver.ts:222`). `getProgram` runs only when
   `needsProgramChange` is true (`:18461-18560`), so some materials flip state per draw: one material drawn by both
   instanced and plain (or skinned and plain) meshes, three's shared shadow depth material crossing those object
   kinds, or a lights-state version that changes per frame (the light pool). No new program is compiled (the key hits
   the cache), but every flip builds a ~100-field parameter object and a key string.
2. **The ring tile streamer re-plans every fixed step while nothing moves** (0.8 MiB/s). `TileStreamer.step`
   (`engine/world/tileStreamer.ts:358`) → `planDesired` (`:427`) → `bytes` (`:422`, catalogue lookup per tile per
   step) plus `want` map sets (`:429`) and `remaskAll` (`:677`): 72 MiB / 90 s for a camera that has not crossed a tile.
3. **Idle checkpoints re-serialize unchanged state every 300 ticks** (0.65 MiB/s). `shardfile/client.ts:526` runs
   `checkpoint()` every 300 ticks; each writes encounters and continuation through `SaveStore.write`, which re-reads
   and `JSON.parse`s the whole save document (`savedDoc`, `store.ts:115`) and stringifies it again (`:169`, `:234`):
   35 MiB. `captureClientState` copies logical state (`shardfile/logicalState.ts:21`, 9.2 MiB), the script lane
   snapshot JSON-stringifies Wasm memory as a `number[]` (`script/host.ts:126-131`, 9.0 MiB; `script/lane.ts:102`, 4.6).
4. **The script host copies state on every tick** (~0.45 MiB/s). `ScriptHost.call` (`script/host.ts:300`),
   declared-state `view`/`prepare` spread `shared`, `players` and `Object.fromEntries` per call (`script/state.ts:42-60`),
   the client script lane rebuilds its frames `Map` (`script/client.ts:58-67`), effects (`script/effects.ts`), skins
   playback (`shardfile/skinLayerPlayback.ts:25`): ~85 MiB / 90 s across `script/*`.
5. **Input rebuilds its layout every frame** (0.24 MiB/s). `InputService.refresh` (`input/InputService.ts:190`) and
   `touchLayout` (`:292`) allocate `Set`s and label/verb records per frame from `gameplay.ts:21`.
6. **Boot: shader text and product decode garbage.** three's `resolveIncludes`/`replace` chain
   (`three.module.js:6373-6443`) builds 24 MiB of shader strings for the programs compiled at boot. Admission
   re-sorts the whole admitted source into a new object tree just to hash it (`validationSourceBytes`,
   `format/product.ts:415-418`, 8.4 MiB); terrain tiles 11 MiB (per-sample `some` checks over heights and colours,
   `format/terrainTileBytes.ts:17`; `world/terrainTileView.ts:47-96`); the worst-cost scan JSON-stringifies every
   tile into one cache key (`format/budget.ts:105-125`, 4 MiB); valibot 7.9. three.core matrix and
   attribute getters (`multiplyMatrices`, `getX/Y/Z`, 6 MiB) are per-vertex bounds work at load.
7. **Admitted product bytes stay resident after decode.** `ClientAssets` copies every admitted asset into `wire`
   (`shardfile/clientAssets.ts:15`) and releases only what geometry hands back (`plugin/geometry.ts:1917`) or tiles on
   `releaseTiles`: **5.6 MiB** of the 17 MiB ArrayBuffer backing is product transport the page already decoded
   (census §8: 169 stores, readers "still unproven").
8. **Code is the biggest retained JS bucket.** 14.2 MiB bytecode/metadata + 9.0 MiB source strings for 246
   modules (menu: 1.9 + 2.0). A grey-box Template evaluates water, grass, riding, hoverboard, animal sims, painterly
   and `three.webgpu` modules. That is the [js-payload](js-payload-mini-plan.md) plan's subject; this plan only
   measures it.
9. **The harness probe** (§1, 35.8 MiB of boot allocation whenever pins are set).

## 4. Rows

Biggest first, each one landable slice (G704) with a done-when on the clean path. Savings are this audit's sampled
numbers; a row's lane re-measures before/after with G1.

| Row | What | Saves (heap / alloc per s / GC) | Owner | Effort | Done when |
|---|---|---|---|---|---|
| G1 | **Guard first:** `scripts/shard-phone-memory.mjs --heap <shard>` on the clean path (Developer off, no pins, direct `/?chunk=`): boot allocated MiB, settled used after GC, idle MiB/s over 60 s, major GCs per 30 s; checked against `scripts/memory/js-heap-ratchet.json`, **exit 1 on > 10 % regression**, ratchet only lowers (`--rebase` refuses an increase) | n/a: makes every row below measurable and refuses regressions | done `77e46ccbbc` + `af53601ece` measured ratchet (G778) | S | one command prints the four readings for `_template` and `blender-template` and fails on a seeded regression in its test; run at milestones and by each row's lane |
| H1 (code `0b99138866` landed 2026-10-27, sp-o4; the plan's end reading closes it, G780): the idle Template's only per-draw flip was three's ONE stock shadow depth material, drawn by plain, instanced and skinned casters in turn (3 program re-evaluations a frame: instancing / skinning params); instanced and skinned classic casters now get a depth material shared per kind (`shadowMaterialOwnership.ts`), same programs | Stop per-draw program re-evaluation: find the materials that flip `needsProgramChange` (instanced/plain or skinned/plain sharing a material, shared shadow depth material, per-frame light-state version) and give each variant its own material/depth material, or keep the light count stable | ~1.4 MiB/s idle, fewer major GCs, CPU per draw | in flight (Opus render; code `0b99138866`, end reading G780) | M | idle `getParameters` + `getProgramCacheKey` < 0.05 MiB/s; `renderer.info.programs` and the look unchanged |
| H2 | Tile streamer stationary early-out: skip `planDesired` when the camera's ring tile and the budget are unchanged; reuse work rows; key catalogue lookups numerically | ~0.8 MiB/s | in flight (code `4b18cede14` landed; end reading, G780) | S | `tileStreamer.ts` < 0.05 MiB/s at idle; walk test unchanged |
| H3 | Checkpoint only when state changed: dirty flag or compare with the last written string; `SaveStore` keeps its parsed doc instead of re-reading `savedDoc` per write; script checkpoint JSON directly from bytes, avoiding boxed `number[]` | ~0.65 MiB/s, plus the save I/O | in flight (code `7fa1873d21` landed; end reading, G780) | M | an idle checkpoint with unchanged state allocates < 50 KiB; saves round-trip tests green |
| H4 | Script host per-tick copies: copy `shared`/`players`/frames only on an effect commit; no `Object.fromEntries` view per call | ~0.45 MiB/s | in flight (code `d1248ed4f2` landed; end reading, G780) | M | `script/*` < 0.1 MiB/s at idle; script determinism tests green |
| H5 | Input layout only on change: rebuild `touchLayout`/`refresh` sets when the context stack or an `enabled()` answer changes | ~0.24 MiB/s | in flight (code `0a7d63da0d` landed, measurement owner sp-o4; end reading, G780) | S | `InputService.ts` < 0.02 MiB/s at idle; no HUD change (E332 not triggered) |
| H6 | Release decoded product transport: drop `ClientAssets.wire` entries once their reader has decoded them (reread from the content cache on revisit, as tiles already do). **Done (sp-o2, this commit):** a probe of hash-keyed transport reads after boot (Chromium phone, `30d47df5b1`) saw none in 20 s of walking on the Template or Driftwood (each root is read only while the boot builds); so once the boot has played (`finish.ts`, after `loading.done`) the page product's `ClientAssets` keeps no transport (`releaseAll`), and any later read rechecks the immutable cache or the network, as released tiles already do | ~5 MiB retained ArrayBuffer | Codex | M | settled backing for `product:_template` ≤ 1 MiB; revisit and tile reread tests green |
| H7 | Menu first-paint loop: stop `index.html`'s shell `tick` when the page is `title-first` (or after N s), and count bytes from new entries only. **Done (sp-o2, this commit):** the inline script already skipped a page that was title-first when it ran, but a URL with harness parameters becomes title-first only later, so the loop ran on under the menu (its clock still advancing at 6 s on `30d47df5b1`); the tick now ends when the page turns title-first, and a `PerformanceObserver` counts each module entry once instead of rescanning every entry every frame | ~0.5 MiB/s on the menu, a rAF per frame | Codex | S | Developer-off menu idle < 0.1 MiB/s |
| H8 | Harness probe: build the boot fingerprint only when a test reads `boot`; hash with one reused `Uint32Array` (or `crypto.subtle` off the ready task). **Done (sp-o2, this commit):** the pinned boot stays eager (harness parity captures the actual boot), its program hash streams SHA-256 through one reused 64-byte block and 64-word schedule and feeds the sorted sources one at a time (no joined, padded or per-block copies); digest unchanged, checked against Node's SHA-256 (`test/probe-program-hash.test.ts`) | 35.8 MiB per harness boot (cleaner rulers) | Codex | S | pins-on and clean boot allocation differ by < 2 MiB |
| H9 | Boot product-decode garbage: hash the canonical source bytes without rebuilding a sorted tree (`product.ts:415-418`), plain loops for terrain sample checks (`terrainTileBytes.ts:17`), no whole-tile JSON key in `budget.ts:105`, checked readers instead of valibot on hot decode paths **In flight (sp-o2), this commit:** the receipt's sorted source is written directly in the order the sorted copy serialized (`format/validationReceipt.ts`, byte-identical to the old copy over authored JSON and edge keys: `test/validation-source-bytes.test.ts`); terrain sample checks and decodes are plain loops (no per-sample callback). Then (this commit) valibot on the hot decode path: a source-mapped boot profile (Chromium phone, `30d47df5b1`) put 8.3 MiB under valibot, 2.1 MiB of it the content-cache worker's per-message reply and command checks; those are now written out with each strict schema's exact verdict (`contentCacheProtocol.ts`, `test/content-cache-checks.test.ts` over ~800 shapes), the schemas naming any failure. Skin sample copies (1.5 MiB) stay: their detached tables are a tested contract. Left: the worst-cost cache key (`budget.ts`: a cheaper key either misses on `deviceMemoryCost`'s derived source or risks a wrong admission cost) | ~20 MiB boot alloc, fewer boot scavenges | Codex | M | clean boot allocation ≤ 100 MiB with H8; admission tests green |
| H10 | Boot shader text: fewer distinct programs at boot (precompile only drawn variants) and no per-program re-resolution of identical chunks. **Done `e97b71b688` (sp-o2; generator input fix `75d9fa27aa`):** a patched material's text leaves its outermost `onBeforeCompile` runner with its includes resolved (each chunk once) and every light / clipping count filled in one pass (`render/shaderText.ts`), so three's 13 + 2 copying passes find nothing; byte-identical to three 0.186's passes over every ShaderLib shader (`test/shader-text.test.ts`). Before (clean Template, Chromium phone, `30d47df5b1`): 24.7 MiB (replaceLightNums 15.8, clipping 3.2, unroll 2.8, includes 2.3); 34 programs at boot, 17 bound in the first 3 s of play | ~15 MiB boot alloc | Opus (render) | M | three `resolveIncludes`/`replace` ≤ 10 MiB at boot; look unchanged |
| H11 | Developer-on grid prefetch: validate products in the content-cache worker, not the page (`format/json.ts:25` + valibot) | 30 MiB menu boot alloc, 26 major GCs (Developer only) | in flight (source landed 2026-10-27, sp-x9; end reading, G780) | M | Developer-on menu boot ≤ 15 MiB allocated; overlaps core-memory C1 |
| — | Code and source strings of 246 modules (14.2 + 9.0 MiB) | defer | — | — | [js-payload](js-payload-mini-plan.md) rows (lazy-load what `_template` never runs); G1 reads the result |

Target after H1–H5 (D2): Template idle churn ≤ 0.5 MiB/s and ≤ 2 major GCs per minute on the clean path.

## 5. Decisions for Jake

| # | Question | Recommended |
|---|---|---|
| D1 | Is the clean ruler the direct `/?chunk=_template` page with Developer off and no harness pins (the same fresh page SHARD SELECT opens)? | **Yes**; the menu is measured separately, and Developer-on stays a diagnostic. |
| D2 | Targets for the Template at idle | **≤ 0.5 MiB/s churn and ≤ 2 major GCs a minute**; boot ≤ 100 MiB allocated. |
| D3 | H1: fix the per-draw program flips in our engine (variant materials), or patch three? | **Engine first**; a three patch only if a variant split cannot. |
| D4 | Where do these rows run? | **As extras under G639's order**, G1 first, then H1–H5 (they are idle frame-time work as well as memory). |

Template 2 (`blender-template`) was not captured in this pass; G1 covers it.


## G1 implementation (G769)

The existing reader accepts:

    scripts/browser-lane.sh --max 10 node scripts/shard-phone-memory.mjs <preview> --heap templates <label> <out.json> [--rebase]

Each Template has a fresh muted Chromium instance, phone tier, 2× render,
Developer off, blocked service workers and no harness pins. Sampling begins
before the direct chunk navigation. The reader prints sampled boot allocation,
post-GC settled used bytes, sampled idle allocation per second over 60 seconds,
and outer MajorGC events per 30 seconds. Collected allocations are included.
This is a distinct diagnostic; native WebKit floor acceptance is unchanged.

The versioned ratchet starts empty: a missing baseline is pending and exits
one. An explicit qualified `--rebase` seeds it, then can only lower every
existing metric. Normal readings refuse any metric above 110% of baseline.
The offline `heap-check <report.json> <ratchet.json>` command and seeded
regression controls are included. Per G769 only touched types and lint run
before landing; both Template baselines and executed regression qualification
remain pending until readings resume after the build plan.


## H2 implementation (G769)

Fully published stationary plans stop rebuilding demand, leases and masks.
The camera position, velocity and full-detail centre remain exact so moving
inside a tile preserves existing threshold and lookahead decisions. Pending
fetches/uploads, retries, changed pins, full rings, costs and eviction retain
the original scheduler. A catalogue without an explicit content revision
keeps polling; the production catalogue reports admitted tile-array changes,
and the grid adapter also reports far charges and placeholder policy changes.
Tile costs use numeric lod/x/z maps with original first-row precedence.

Touched engine/game and fixture types plus typed lint qualify this source
landing. The existing full walk/hash assertions remain intact, and new idle,
revision, movement, pin and eviction controls are included but unexecuted
before landing under G769. Heap-rate and gameplay measurements stay pending.


## H3 implementation (G769)

SaveStore reuses the parsed document while its persisted text is unchanged.
It still reads storage text before each operation, so other keys, external
writers and reset generations remain authoritative. Identical validated JSON
content avoids a durable rewrite; failed writes continue retrying. Cached
values normalize through the serialized wire and never alias caller objects.

ScriptLane serializes host memory directly from bytes into one ASCII buffer,
avoiding the boxed number array. The original replay JSON, globals, counters
and module order stay byte-exact; public detached checkpoint arrays remain
available. This uses the existing JSON wire rather than adding an encoded
asset representation or changing historical restore admission. New codec,
cache/external-write/retry controls and a full host-text parity assertion
are included. Touched types and lint are the G769 landing check; idle budget
and executed save/replay qualification remain pending.


## H4 implementation (G769)

Script effect transactions copy entity and declared shared/player containers
only when a write needs them. Revision fences still reject stale transactions,
including empty commits. Public entity/state/view records remain detached and
privacy projections are cached until declared state changes. Composed roles
retain their own host admission and avoid scanning every entity for a call
that spawns none.

The host reuses two private rollback buffers within its existing three-copy
memory allowance. A buffer is published only after the effect transaction
commits; trap rollback and retained public snapshots keep separate bytes.
Client presentation updates its existing frame map, with revision-fenced
transactions and detached output copies. Engine/scoped fixture types and typed
lint pass; retained checkpoint, privacy, stale-write and invalid-suffix controls
are included. Determinism execution and heap-rate readings remain pending G769.


## G1 measured ratchet (G777/G778, 2026-10-27)

Both cold clean Chromium pages use source `a127a8a1597c5305b05b447662a0370b95aee4cc`,
served build `a127a8a-mvqap3z7` (the report retains the exact served build).
Developer off, pins absent, phone tier, 2× render and blocked service workers;
one independent browser per Template, 60 seconds idle each. Build identity is
checked before/after each reading and across the pair. The browser and owned
preview close after the pair. This predates the H2/H3/H4 runtime cuts and is
the initial baseline, not a claim that those rows meet their allocation targets.

| Shard | Boot allocated MiB | Settled post-GC MiB | Idle MiB/s | Major GC /30s |
|---|---:|---:|---:|---:|
| `_template` | 129.525 | 24.971 | 5.958 | 13.492 |
| `blender-template` | 125.927 | 23.835 | 3.666 | 7.996 |

The exact byte readings seed `scripts/memory/js-heap-ratchet.json`. The existing
CLI exits one for a seeded 11% regression against these real baselines; all
four independent metric regressions and upward rebase attempts refuse.
Touched types and lint pass. No Simulator/native-floor qualification is claimed.


## H5 implementation (G769)

The input service polls live enabled predicates but reuses stationary refresh
and immutable touch-layout records until contexts, enabled answers, bindings
or held inputs change. Binding scan rows are indexed once; changing inherited
keys invalidates them. Reentrant transition work keeps its existing separate
scratch storage. Sinks still run every frame, including dynamic verb.show
predicates, so this changes allocation rather than HUD placement or behavior.

Engine and scoped fixture types plus typed lint pass. Existing reentrancy and
edge-order assertions stay unchanged; an enable/key/layout cache control is
included. This finishes the already-written source boundary requested by
sp-o4 during the H2-H5 handoff. G1's two measured baselines are committed at
`af53601ece`; H2-H5 heap-rate qualification belongs to sp-o4's milestone.


## H11 implementation (G769/G780)

Index decode and phone-tier product/receipt admission now run inside a scoped
prefetch admission worker. Complete decoded products stay off the page. The
worker borrows the existing content-cache writer through checked get/put
messages and transferable bytes; it creates no second cache writer. Only a
bounded download schedule returns to the page. Index hash, newer-deployment
stop, byte caps, tier filtering, durable acknowledgements and pack scheduling
remain checked. Unsupported workers retain the existing checked fallback.

The worker is terminated on completion, error or page retirement. The existing
bounded response reader is exposed from its defining engine module. No Vite
plugin, virtual module, app-specific engine branch or renderer change is added.
Game/scoped fixture types and typed lint pass; cache ownership and malformed
schedule controls are included. Developer-on menu allocation is pending the
single end-of-plan Chromium reading (G780); no measured saving is claimed.
