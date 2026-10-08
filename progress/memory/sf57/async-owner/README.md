# SF57: the owner after an `await` (async-owner lane)

## The cause

`withOwner(scope, () => build())` owns only the build's synchronous prefix. Every continuation after an `await` runs
under the ambient owner, which `enterOwner` left as the page's level scope. A resident shard's world / kit / play hook
that registers anything after its first `await` (a cleanup, a listener, a HUD disc, a quest card, a resource) therefore
attaches it to the page, and it outlives the visit. Browsers have no hook into native `await` continuations (a patched
`Promise.prototype.then` is never called by `await` on a native promise), so a true AsyncContext carrier is not
available. The build carries its owner explicitly instead.

## The fix

- `src/engine/app/ownership.ts`
  - `ownedFacade(scope, service)`: every method call through it runs under `withOwner(scope)`, with the real service as
    `this`.
  - `ownerTask(scope, fn)`: `withOwner` for an async build. It returns the build's own promise, so it adds no ticks.
    While that promise is pending, ambient owner reads are counted and sampled with stacks.
  - `ownerCensus()`, exposed by the probe as `app.owners`: the dev assertion. Dev builds also log each new site once.
- The build path passes its scope explicitly:
  - the hybrid session runs every entered hook with `ownerTask`, and the regional kit build does too;
  - `createLevelInstallation` runs its HUD adapter (through a facade), input contexts, debug rows, playgrounds and debug
    exposes under the installation scope;
  - a resident's play host gets the page `hud`, `menu`, `fullMap` and `minimap` as owner facades.
- The named retainers:
  - `Game.faultSystems` is a `WeakMap` keyed by the app's system row. It was a `Map` by id, and `runPhase` filled it
    lazily and never deleted from it, so the first visit's closures were held for the page's life.
  - `FullMap.setQuest` / `setPois` end with their caller's owner, and a replaced source drops its hold.
  - The Pine cull view's listeners: the old `__ws_prefetch → WeakMap → context` path was an artifact of a BFS that walked
    WeakMap ephemeron edges as strong edges (the WeakMap's value closure held its own key). With ephemerons skipped, the
    real holder was `Game.faultSystems → a Pine system → the forest → viewListeners`.
- Two more retainers turned up in the heap diff:
  - **`UploadOwnership` re-adopted every retired resource into the page level.** three's own dispose handlers
    (`deallocateMaterial`, `deallocateTexture`) call `renderer.properties.get`. The upload observer saw the resource's
    owner already disposed and adopted the resource into the page level scope, in the middle of the resident's teardown.
    `Scope.disposing` (true only while `dispose()` runs the scope's cleanups) now tells that lookup apart from a real
    re-upload.
  - **`SkyRig.setupMaterial`** kept every material in its `materials` set and in CSM's `shaders` map (CSM walks that map
    every frame). Both now hold their materials weakly (a `WeakSet` and a `WeakShaderMap`).
  - **HUD discs, pills and widgets** registered their listeners and removal on the page-scoped HUD adapter's scope;
    `hudSlots.discard` now releases them.

## Chromium: 4 circuits D → Pine → Nalati → template-2 → D

iPhone 16 Pro, muted, Developer on, phone tier, 2×. `drive.mjs` is the place-lifetime driver, plus `--snap=` heap
snapshots and the owner census. The JS heap is read with CDP `Runtime.getHeapUsage` after 3× forced GC, at one fixed
Driftwood pose per circuit.

| build | heap MB c0 / c1 / c2 / c3 / c4 | Δ a circuit (c1→c4) |
| --- | --- | ---: |
| before: HEAD `e76279561` (place-lifetime) | 70.2 / 178.3 / 222.5 / 263.0 / 303.4 | **+41.7** |
| after: `71eea75` (owned hooks, installation adapters, map facades, faultSystems, FullMap, upload teardown) | 70.3 / 125.9 / 154.9 / 182.3 / 209.1 | **+27.7** |
| after + HUD discard holds + creature constraint (`d1838f9`) | 71.5 / 125.1 / (stopped: see below) | n/a |

- c0 → c1 (the first visit of each shard) fell from +108 MB to +56 MB. Both runs had 0 page errors, and placement stayed
  flat (0 live cullers).
- `d1838f9` got through circuit 1 (c1 125.1 MB, the same as `71eea75`). In circuit 2, its `template-2 → driftwood` leg
  hit the route harness's timeout, with no page error, while the machine's load average was 60–80. That run is a
  partial, not a verdict. The WeakShaderMap (sky) change was not in either measured build.
- The owner census (`app.owners`) counted 5612 ambient reads over the 4 circuits, about 1300 a circuit, all while a
  resident build was pending. The sampled stacks are `WorldRegistry.add` and its `onAdd` listeners from `place`
  (already freed by the registry's retire) and `markGpuOnly`.

### What still grew in `71eea75` (heap snapshots after c1 and c3, `sig.py` diff)

- **+90 MB, page level scope → a HUD disc's `press` closure → Nalati's stealth → its wildlife and world.**
  - `hudAdapters` serves every installation from the page's own scope, so `hudSlots.disc / pill / widget` registered
    the element's listeners and its removal there.
  - The installation's `discard` removed the node but left those registrations, with their closures, on the page.
  - `discard` now releases them (`hudSlots.holds`), proven by `test/engine/hud-discard-release.test.ts`. That fix is in
    `d1838f9` and was measured only up to c1.
- **+61 MB, `game._sky.materials` / CSM `shaders` → materials that are never disposed** (their patch chains hold Pine
  and Nalati instance data).
  - The sky now keeps a `WeakSet`, and CSM gets a `WeakShaderMap` (WeakRef keys; a collected material drops out of the
    per-frame walk).
  - The whole sky / CSM test set passes. This fix has no Chromium run yet.
- **Smaller, under 5 MB each:**
  - `game.uploads.live` mipmaps / maps: uploads whose resources were never disposed;
  - a `lead.onStaggered` module array.
- **A probe path, not app state:** `__wildshard.combat.world.enemies.practiceCrab.motionConstraint` held the whole
  regional admission closure (V8 shares one context per scope). The constraint is now built by a module-level helper
  (`hostConstraint`).

## Tools

- `sig.py <snapshot> <out.json>`: ArrayBuffer bytes by retainer signature. It skips WeakMap ephemeron edges and strips
  `@ids`, so two snapshots can be diffed.
- `path.py <snapshot> <substring>`: one shortest root path, with node ids.
- `scopes.py <snapshot> [name]`: every live Scope (found by shape: `cleanups` + `children` + `owned`), with its cleanup
  closures.
