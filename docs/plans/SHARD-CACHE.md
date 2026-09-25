# Plan: keep shards in memory — switch shards from the main menu without the loading screen (E155)

**State:** `in progress` 2026-09-25 — the user said go (E155, "4B with subagent": build it all now, cap 4). One build subagent in an isolated worktree takes M0–M4; the E155 session merges it onto main. Nothing landed yet.

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
- **The cache** is an LRU `Map<slug, ShardWorld>` with a cap of 4 (with 3 shards, nothing is evicted yet).
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

| Row | What | Size |
|---|---|---|
| M0 | Per-shard + all-resident memory on iPhone (bench-load heap / texture bytes) | S |
| M1 | Split `main()` into shell + `buildShard()`; listeners on an AbortController; a real `Game.stop()` | L |
| M2 | Per-shard shader-patch tables + one renderer / canvas per shard | M |
| M3 | Module state → per-shard (config, Heightfield, GrassField, Minimap coverage, tier, registries) | L |
| M4 | ShardHost: LRU cache (**cap 2**, the user 2026-09-25, E159), activate / park / evict, the deck's switchTo | M |
| M5 | **Fast rebuild of an evicted shard** (E159, "C"): in-page, no download (E158 prefetch), reuse the shell's decoded audio / art / code, parallel shader compile, cache what is expensive to rebuild (baked terrain / navmesh / grass fields) across builds; measure time-to-play of a re-built shard | M |
