# Plan: keep shards in memory — switch shards from the main menu without the loading screen (E155)

**State:** `in progress` 2026-09-25 — M1–M5 built by the E155 subagent (its worktree branch, rebased on main at 3cc3a33; not merged, not deployed): switch shards from the title deck in the page, 2 resident (E159), an evicted one rebuilt in the page (2.4–3.1 s to its title), a resident return in < 0.1 s with no loader; desktop + phone headless runs PASS (scripts/e155-shard-switch.mjs, progress/268–269). Open: M0 on a real iPhone (the memory of two resident shards; phone-tier cap), the merge + deploy (the E155 session).

## The ask (E155)

"Why do I have to reload shards? … I want the shards to stay in memory, or the last four shards stay in memory, and when
you load a fifth shard, you evict one from memory … I definitely want to be able to go to the main menu and switch
between the three shards."

## Why it reloads today

- **Exit to the main menu does not reload.** `hud.onExitToMenu` (main.ts) mutes the world and `game.frameGate` freezes it
  while the title is up (ASKS #29).
- **Picking a different card does.** `HUD.activate()` does `location.href = chunkUrl(slug)` ("Reloads with X" on the
  deck). The `?chunk=` param picks the shard when `src/chunks/registry.ts` loads, and the code was built on "one shard per
  page" (`docs/SHARDS.md`).
- **What a revisit costs.** The service worker cache makes a revisit download ~0 bytes, so the wait is all CPU and GPU work:
  rebuilding the world, compiling shaders (~150 ms per program on a cold iPhone Metal cache) and decoding audio. Warm times
  from the bench budget: Driftwood 3.3–3.8 s, Pine Hollow 5–6.7 s; Nalati was never benched.

## What stops two shards living in one page

1. **Shader patches are global.** `Atmosphere.ts`, `stylize.ts` (Driftwood's toon), `nalati/look/fog.ts`, `Sky.ts`,
   `shadowFade.ts` and `shadowFilter.ts` each rewrite `THREE.ShaderChunk` once per page, differently per shard. three.js
   caches programs by material parameters, not by source, so one shared renderer would hand shard B shard A's shaders.
2. **Module-level shard state.** `core/config.ts` (SEED, CHUNK_ID; 23 importers), `Heightfield.ts` (`heightAt`; 88
   importers), `GrassField`'s cache, the Minimap's coverage, `tier.ts:106` reading `?chunk=` from the URL. There are
   115 `getActiveChunk()` calls, some of them per frame.
3. **Single-world holders.** `activePhysics`, bodies, navmesh, ragdoll, the registry, `WorldClock`, `AimTargets`,
   `ShardComplete`, the step labels.
4. **One `main()` closure** (~830 lines, ~60 locals). The 316 `addEventListener` calls face 17 removes, and nothing is
   disposed on leave (`Physics.dispose()` is never called).

## Sketch (recommendation: one canvas + one renderer per resident shard)

- **Split `main()`** into a shell built once and a per-shard build:
  - The shell: Loading, Audio, Music, decoded audio, title art, the service worker, KeepAlive, the error modal, the deck.
  - `buildShard(def, shell): ShardWorld` holds the rest. Each ShardWorld owns its Game (canvas, renderer, scene,
    composer), Physics, registry, player, weapons, HUD layer and systems, plus an `AbortController` for its listeners.
- **Each resident shard gets its own WebGL context**, so its programs compile under its own shader patches. The one-time
  `installed` flags become a per-shard patch table that is swapped in before a build or a runtime compile.
- **`activate(slug)`** makes one shard live:
  - `setActiveChunk` and reinstalling that shard's baked terrain;
  - the active physics, bodies, navmesh, clock, aim targets, registry and tier;
  - showing its canvas and HUD layer;
  - re-pointing GpuRecovery and the pose provider;
  - resuming its loop.
- **`park()`** takes a shard out of play: hide its canvas and HUD, stop its loop (a real `Game.stop()`), mute its sounds.
- **The cache** is an LRU `Map<slug, ShardWorld>` with a cap of 2 (E159; the sketch said 4).
  - Evicting a shard: `renderer.dispose()`, `forceContextLoss()`, dispose the scene, `physics.world.free()`, abort its
    listeners, remove its DOM.
  - The phone tier may need a lower cap, and a lost context should also evict.
- **The deck** calls `host.switchTo(slug)` plus `history.replaceState` instead of `location.href`.
  - A resident shard is instant.
  - A shard that isn't resident shows Loading in the page and skips the JS parse, the audio decode and the wait for the
    service worker.
  - Settings, update and GPU-recovery reloads stay full reloads.

## Memory: measure before committing to "4"

- Pine Hollow's phone textures alone are ~315 MB of GPU memory decoded, and its JS heap is ~110 MB.
- Driftwood and Nalati are unmeasured; a guess is tens of MB of GPU memory each.
- All three resident: roughly 450–650 MB of GPU memory plus 250–350 MB of JS heap.
- iOS kills the page at around 1–1.5 GB (`project/archive/2026-09-22-load-perf.md`).
- KTX2 textures are the recorded fix if memory binds (Pine Hollow 315 → 40–79 MB).
- **First step:** record GPU texture bytes + heap per shard, then with all three resident, on a real iPhone.

## Rows

| Row | What | Size | Status |
|---|---|---|---|
| M0 | Per-shard + all-resident memory on iPhone (bench-load heap / texture bytes) | S | desktop Chrome + phone-tier headless measured (below); **a real iPhone: open** |
| M1 | Split `main()` into shell + `buildShard()`; listeners on an AbortController; a real `Game.stop()` | L | built: `src/main.ts` main() = the host, buildShard() = the old boot; listeners / timers / <body> nodes scoped per shard instead of an AbortController (src/core/shardScope.ts); Game.stop / resume / dispose |
| M2 | Per-shard shader-patch tables + one renderer / canvas per shard | M | built: a canvas + WebGLRenderer per shard; THREE.ShaderChunk and every patch flag are shard state (swapped on a switch) |
| M3 | Module state → per-shard (config, Heightfield, GrassField, Minimap coverage, tier, registries) | L | built: src/core/shardState.ts slots (~60 registered), applyShardTier, Minimap keeps its fog |
| M4 | ShardHost: LRU cache (**cap 2**, the user 2026-09-25, E159), activate / park / evict, the deck's switchTo | M | built: src/shard/ShardHost.ts + switch.ts; the deck, EXPLORE WORLD and the complete card's Next shard switch in the page |
| M5 | **Fast rebuild of an evicted shard** (E159, "C"): in-page, no download (E158 prefetch), reuse the shell's decoded audio / art / code, parallel shader compile, cache what is expensive to rebuild (baked terrain / navmesh / grass fields) across builds; measure time-to-play of a re-built shard | M | built: no SW wait, decoded audio + art + viewmodel pixels + Nalati's clouds kept for the page, parallel compile was already on; terrain / navmesh parse measured < 9 ms (not cached) |

## Built (E155 subagent, 2026-09-25)

- **How a switch works.** The title deck's ENTER WORLD on another card calls `requestShard` (src/shard/switch.ts). The
  running shard parks: it exits to its title, its loop stops, its sound is cut from the speakers, its module state is
  captured, its listeners go quiet and its canvas / HUD / menus leave the page (a comment keeps each one's place).
  - A resident target activates in place, inside the click: straight into the world where the player left, no loader.
  - Any other is built in the page behind the loader, after the least recently used is evicted, and lands on its title.
  - The URL follows (`history.replaceState ?chunk=`); Settings APPLY, a new build, GPU recovery and the error modal
    stay real reloads.
- **Eviction gives memory back.** Renderer disposed + context lost, physics world freed, listeners / timers / nodes /
  debug globals removed, the renderer's `dispose` listeners taken off shared module-cached materials and textures
  (src/shard/disposeListeners.ts). Checked with CDP `queryObjects` after a GC: live Game / Scene / Physics / renderer
  instances = the resident count, every step. A parked shard that loses its context is evicted (no resume screen).
- **Audio.** One AudioContext; every shard its own Audio on it (parked = cut from the speakers); the score is the
  shell's and follows the running shard's master.

## Measured (headless Chromium on the M5 Max, Metal, a `vite preview` of the build; progress/268–269)

| | desktop 1600×900 | phone tier 390×844 @2× |
|---|---|---|
| first visit (page load → Driftwood's title) | 1.9–2.6 s | 1.9–2.4 s |
| another shard, first build in the page (click → its title) | Nalati 4.4–4.9 s · Pine Hollow 3.3–4.5 s | Nalati 3.4–3.6 s · Pine Hollow 2.6–3.1 s |
| **return to a resident shard** (click → first world frame) | **72–100 ms** (the host's switch 1–6 ms), no loader | **64–100 ms**, no loader |
| **rebuild of an evicted shard** (click → its title) | Nalati 2.9–3.1 s (3.2 s before M5's cloud cache) | Nalati 2.4 s |
| JS heap after GC: Driftwood alone | 297 MB | 233 MB |
| … two resident (the cap) | D+N 462 · D+P 570 · P+N 430–440 MB | D+N 389 · D+P 393 · P+N 313–321 MB |
| … all three resident (`setCap(3)`) | 693–702 MB | not run |
| scene textures, estimate (px × bytes, mips) | D 62 · N 274–302 · P 822 MB | D 41 · N 102–117 · P 397 MB |

- The evicted shard's memory comes back: D+P 570 → P+N 437 MB after Driftwood's eviction (desktop).
- An in-page build looks like a fresh page load of that shard: mean |Δ| of a 64×36 thumbnail 0.4–4.8 / 255, the same as
  two fresh loads of it (Pine Hollow 4.5, Nalati 2.1 — its grass and animals move).
- **iOS risk (M0 open):** two resident on the phone tier is ~320–390 MB of JS heap plus 0.4–0.5 GB of decoded
  textures (Pine Hollow's are most of it; E157's KTX2 cuts them), near the ~1–1.5 GB where iOS kills the page. Measure
  on the iPhone before trusting cap 2 there; `ShardHost.setCap(1)` on the phone tier is the one-line fallback.
