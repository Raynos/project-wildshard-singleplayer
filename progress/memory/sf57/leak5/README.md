# SF57 round 5: the last per-circuit growth (leak5)

Grid circuits D → Pine → Nalati → template-2 → D, Developer on, Chromium (iPhone 16 Pro, muted, phone tier, 2×). The JS
heap is read after 3× forced GC at one fixed Driftwood pose. The driver is `drive.mjs` (the upload-owner driver with an
overridable root, the resource kind / uuid and the stray-read site counts a DIAG build records).

## Before / after

Before: HEAD `9b8885ad9` plus a passive DIAG patch (upload sites, the drawn object's path, stray-read sites; not
committed). After: the commit `a9ef7d58f` itself (no DIAG), served by `serve-build --rev`.

| pose | heap MB before | Δ | heap MB after | Δ | GL geo / tex / prog before | after | orphans live / collected before | after | stray reads before | after |
| --- | ---: | ---: | ---: | ---: | --- | --- | --- | --- | ---: | ---: |
| c0 | 70.6 | | 70.8 | | 324 / 96 / 154 | 327 / 96 / 155 | 74 / 0 | 75 / 0 | 97 | 5 |
| c1 | 135.2 | +64.6 | 130.1 | +59.3 | 258 / 100 / 306 | 260 / 100 / 308 | 78 / 0 | 68 / 1 | 384 | 25 |
| c2 | 137.3 | +2.2 | 138.7 | +8.7 | 258 / 106 / 312 | 260 / 107 / 314 | 91 / 0 | 68 / 2 | 671 | 45 |
| c3 | 141.1 | +3.8 | 141.5 | +2.8 | 258 / 106 / 312 | 260 / 108 / 314 | 104 / 0 | 68 / 3 | 958 | 65 |
| c4 | 149.7 | +8.6 | 142.9 | +1.4 | 258 / 106 / 312 | 260 / 109 / 314 | 117 / 0 | 68 / 4 | 1245 | 85 |
| c5 | 152.9 | +3.2 | 144.3 | +1.4 | 258 / 106 / 312 | 260 / 110 / 314 | 130 / 0 | 68 / 5 | 1532 | 105 |

- **Heap from c2:** before +5.2 MB a circuit (c2 → c5), after **+1.9** (+2.8, +1.4, +1.4). The before run took heap
  snapshots at c2 and c4, which inflates its c4 step; the after run took none.
- **Orphans:** the live unowned set is flat at 68 (before: +13 a circuit, never one collected).
- **Stray owner reads:** 287 a circuit → **20**.
- **Bars:** BossBar / EliteBar / Elites stay at 1 / 0 / 0 on the after build (main now carries the Nalati scope fix).
- **Left:** GL textures +1 a circuit, which is the one orphan a circuit that is collected without a dispose
  (`orphans.collected` +1). Its site in the before run was a `loadTexture` → `prepareCompressedTexture` upload
  (`engine/core/ktx2.ts` / `engine/core/assets.ts:78`) that a per-visit caller drops without disposing. The weak set no
  longer hides it, so it is counted.

Before: `before-9b8885ad9.json`. After: `after-a9ef7d58f.json`. Print either with `python3 table.py <json>`.

## What held each visit

1. **The weak set was not weak** (`before-orphan-retainers-c2.txt`). Every live orphan was reachable from the page level's
   `cleanups`. The path went through `uploadOwnership.ts` `track`'s end-of-life capture, whose closure context also held
   `resource`, because the dispose listener in the same function names it. The finalizer's `forget` shared that context
   too. So no unowned upload was ever collected. **Fix:** the capture, which holds only a WeakRef, and the listener are
   now made in separate functions.
2. **Render-target attachments.** A target's dispose frees its textures (three's `deallocateRenderTarget`), but the
   textures get no dispose event of their own. So each PMREM `cubeUv` (from Driftwood's 15-second refresh), shadow-map,
   Pine env-equirect and Nalati bake attachment stayed in the live set after its target was gone. These are the "sky
   environment-refresh targets" and the "bake target" of round 4. The skies and the bake already disposed their
   targets; the census missed it. **Fix:** a target's release also releases its attachments.
3. **Shader warm-up stand-ins, about 3.5 MB a circuit of ArrayBuffers** (heap snapshots c2 → c4, `../async-owner/sig.py`).
   An entered frame's owner holds the `shadowJobs` disposer until the frame leaves. That closure was made in the
   function that fills the stand-in list, so it shared that context. It therefore held every compiled caster, and with
   it their geometry, including other residents' geometry that had retired by then. The CSM `WeakShaderMap` values
   (1 MB textures) were held only while those materials lived. **Fix:** `disposerOf` builds the disposer from just the
   temporaries. `postJobs` gets the same fix.
4. **Instanced ring props** (`props030_1 …` under `ring:template-2:*`). These are the "props drawn outside an owned
   subtree" of round 4. `installDeclaredProps` disposed the geometry and released the materials, but it never disposed
   the InstancedMesh that the GLB's `EXT_mesh_gpu_instancing` parses to. **Fix:** it now disposes those meshes too.
5. **Stray owner reads** (`before-stray-sites-c0-c1.txt`, per-site counts):
   - **The asset cache register** (85 a circuit): a module cache now takes `enteredOwner()`, and the residency port's
     own reader decides as before.
   - **`RetainedRuntimeHooks` register** (124 a circuit): it reads the owner only for its yielded-hook check.
   - **Rope-chain bodies** (54 a circuit): the bodies Driftwood's build makes after an `await` belong to the region
     world's sim scope. This works like a region registry. `Physics(R, snapshot, owner)` and `ownerOr`: a
     `withOwner(null)` section still means no owner.
   - **Physics captures:** a capture that a scope copied before the world was freed in the same teardown no longer
     touches the freed world. An early DIAG build without this hung re-entering Driftwood (`template-2 → driftwood`
     timed out). The full suite caught the same thing: `SimHost.dispose` hit `Collider.isValid` on a freed world.
   - **Still open, about 20 a circuit:** `uiScope` (quest view, coin chip, shop panel, Nalati's bars), `audio/preload`
     decode attribution, the script host's memory label, and `resourceScope` in Stems / Elite.

## Checks

- **Node tests** (each fails on HEAD and passes with the fix):
  - `test/engine/upload-weak-release.test.ts`: an orphan nobody holds is collected; a target's dispose releases its
    attachment.
  - `test/engine/precompile-disposer.test.ts`: the shadow disposer does not keep the casters alive.
  - `test/engine/stray-owner-reads.test.ts`: a region world body made after an `await`, `withOwner(null)`, the page
    world, a cached registration, and retained hooks.
  - `test/props-baker.test.ts`: instanced props are disposed with the scope.
- **Full vitest** (the push gate's clean export of `a9ef7d58f`): 952 / 955 files passed. The one failure is AG7 in
  `test/arch-guards.test.ts`: kit → engine fell 110 → 84, and the shards → kit edges fell too. These come from main's
  SF54 commits and are waiting for the serialized regeneration. This change adds no import edge.
- Against `a9ef7d5` (`smokes.txt`):
  - Boot smoke: standalone Driftwood, standalone Pine and grid all PASS with 0 faults. Pine also entered grid five
    times in the after drive.
  - Facade instancing: PASS on desktop, phone-tier and iphone-desktop-quality, with 0 batches.
  - WebKit render smoke: PASS (world, whip and sword at 0 % near-black).
  - `physics-baseline --mode=walk`: 63 legs, 0 stuck.
- Landed on main as `4b2089fc8`, the same diff as `a9ef7d58f` rebased onto `3ec15683b`.

## Tools

- `table.py <json>`: the per-circuit table.
- `symbolize.mjs <dist> <json> [a b]`: unowned-upload growth by kind, site and drawn-object path, through the build's
  source maps.
- `retainers.py <snapshot>`: the shortest strong path to each live orphan.
- `classdiff.py <a> <b>`: snapshot self-size growth by type.
- `stray.py` + `symstack.mjs`: stray-read stacks, symbolized.
