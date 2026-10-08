# SF57: placement lifetime (placed models, their cullers and registry holds)

## What leaked

- `src/engine/models/place.ts` kept the module-level `records` (model id → placed groups) and `cullers` (per-frame cull
  closures) for the whole page. Every grid visit pushed more and nothing removed them.
  - Before the fix, settled at Driftwood after each circuit: **+17 cullers and +191 placed groups a circuit**.
  - The stale cullers ran every frame in `cullPlaced`, and `placedGroups()` returned retired groups.
- `WorldRegistry.add` / `onAdd` registered their removal on `currentOwner()`. After an `await` in a resident shard's build,
  that owner is the **page's** level scope (`enterOwner`), not the shard's. So every visit's pieces (their objects,
  geometry and follows) were held by thousands of closures in the page scope's `cleanups`. The heap snapshot shows this as
  `<div class="ws-grid-speed"> … Set.cleanups → Object.n (a piece) → pi.follows / gs.object → geometry`.

## Fix

- Placement state lives in a *life*: the registry the call registered into (each resident world's own, E155), or the
  owner scope for a build-only call (`registry: null`), else the page.
  - `WorldRegistry.retire()` / `onRetire(fn)` / `retired` are new, and `regionalView`'s scope disposal calls `retire()`.
  - When a registry retires, its records and cullers go. Weld band cullers follow their weld's place calls.
  - Records are kept per registry. Each visit's catalog therefore gets the model's own piece id and entry, never a
    `#k` continued from a retired visit.
- The registry's owner holds are dropped when the registry retires, so the owner no longer keeps the piece alive.
- `placementCensus()` reports the state, and the live probe exposes it as `app.placement`.
- `assets.ts`: **there was no key mismatch.** `shareSource` was already called with the cache key (`url@size`); only its
  parameter was named `url`. It is renamed `key`, `decodedImageCount()` is added, and a test proves that trimmed decodes
  are released, cycle after cycle.

## Chromium: 4 circuits D → Pine → Nalati → template-2 → D

Run on an iPhone 16 Pro profile, muted, Developer on, phone tier, 2×. The script is `drive.mjs`. The JS heap was read
with CDP `Runtime.getHeapUsage` after 3× `HeapProfiler.collectGarbage`, at one fixed Driftwood pose per circuit.

| build | heap MB c0 / c1 / c2 / c3 / c4 | Δ a circuit (c1→c4) | live cullers c0…c4 | placed groups c0…c4 |
| --- | --- | ---: | --- | --- |
| before `6fd26bb` (HEAD 29e6895 + census only) | 68.8 / 184.9 / 282.5 / 382.1 / 466.9 | **+94.0** | 0 / 17 / 34 / 51 / 68 | 61 / 252 / 443 / 634 / 825 |
| place.ts only `f075e7c` | 76.1 / 185.7 / 288.0 / 376.1 / 474.3 | +96.2 | 0 / 0 / 0 / 0 / 0 | 61 flat |
| place.ts + registry holds `6a014f7` | 70.4 / 179.8 / 222.1 / 264.3 / 303.6 | **+41.3** | 0 / 0 / 0 / 0 / 0 | 61 flat |

- Every run had 0 page errors and 0 route failures.
- The placement state is flat after the fix. By itself it did not lower the heap: the same objects were also held through
  the registry's owner holds.
- With both fixes the heap grows 56 % less per circuit, but it **still grows by about 41 MB a circuit**.

## Remaining retainers (heap snapshot after circuit 1, place.ts-only build; `retainers.py`)

- `Game.faultSystems` (Game.ts ~583, `scope.onDispose(() => faults.delete(id))`) still holds Pine systems, such as
  `crags.caveGeo` and `props`. They were registered under the page scope after an await: the same owner-after-await
  pattern.
- Nalati's `questSource` → `nalati.groups.outcrops` geometry (10.8 MB) is held from a page-scope cleanup.
- A Pine `CullOptions.view`'s `viewListeners` keep culler closures and their meshes. They are reached through
  `__ws_prefetch` → a WeakMap → a context scope.
- The generic cause is `withOwner(scope, () => asyncFn())`: the owner is set only until the first `await`. Every
  `currentOwner()?.onDispose` that runs later attaches to the page scope.

## Other checks

- **Full vitest on a clean export:** 5303 passed, 14 skipped.
- **`scripts/test-facade-instancing.mjs`:** PASS on desktop, phone-tier and iphone-desktop-quality, with 0 batches.
- **`physics-baseline --mode=walk`** on `f075e7c` (the colliders are unchanged by `6a014f7`): 0 stuck on every leg
  (`physics-walk-f075e7c.txt`).
- **Lesser caches:** none of them grows. Each is keyed by stable ids or urls and plateaus: `faceHeads.ready` by head id,
  `npcRig.built` by profile id, `bakedTextures.loaded` by url, which is overwritten each visit.
