# SF57 round 4: every GPU upload has an owner (upload-owner)

## What changed

- **Owner at upload, compile included** (`src/engine/render/uploadOwnership.ts`). Before this change, the renderer's
  live set held every upload strongly. An upload with no draw owner (the shader warm-up's `compile()` of detached
  stand-ins, the texture pass of `initTexture`) stayed in the set. It was disposed only at the page level's end, and
  it was the only thing that held about 100 resources a circuit (leak3: depth materials, `family:pbr`, MeshBasic,
  Pine's animal textures).
  - A `compile()` now counts as a draw of every object in it. Each object's material program is attributed to that
    object's scene owner.
  - A warm-up stand-in resolves to the mesh it stands in for (`linkStandIn` in `src/engine/app/sceneOwnership.ts`,
    set by `precompile.ts`'s `standIn`).
  - Its samplers and geometry carry that owner as a hint. The hint applies only when they really upload, so a texture
    that is not uploaded is never claimed.
- **Weak fallback.** An upload that still has no owner is held weakly. It is engine-global (the composer's targets,
  the page's own draws) or a build's resource whose owner is not known yet. A later owned draw adopts it, and the
  page level still frees it at its end, but the set never keeps it alive. `orphanCensus()` counts the live unowned
  uploads and the ones garbage collected without a dispose, so an unowned GPU allocation stays visible.
- **Three's dispose-time lookup.** three's `deallocateTexture` / `deallocateMaterial` call `properties.get` after
  our dispose listener runs. That lookup used to put an explicitly disposed resource back into the live set, with
  its allocation already gone. A retired compressed texture then threw "lost its allocation after mip retirement"
  on the next diagnostic read.
  - A lookup outside any draw while the resource's dispose is being dispatched is now skipped. The skip is cleared
    after the task.
- **Stray owner reads** (`ownerCensus`):
  - A region's `WorldRegistry` has its own `scope` (the view's). A registration made after an `await` takes that
    scope, not the page's: `enteredOwner()` in `src/engine/app/ownership.ts` names the owner a `withOwner` section
    set, without a census read. The region view's own piece-scope hook uses `enteredOwner()` too.
  - `markGpuOnly` uses `enteredOwner()`.
  - The compressed-upload and warm-up frame waits use `pageScope`, never an ambient read.
- **Boss / elite bars** (`ui.BossBar` +4 a circuit, `ui.EliteBar` +2, as leak3 counted them):
  - `Scope.run(fn)` runs `fn` with that scope as the owner.
  - Pine's `installPineCombat` now runs under the runtime's scope (`ctx.scope.run`). That covers the EliteBar, the
    Antler King's BossBar and the Elites service.
  - Driftwood's director finale runs under its context's scope. That covers its BossBar, the reward beat and its
    update.

## Measured

At c0 (Driftwood home, before any circuit), stray owner reads at boot fell from 340 to 96 (build `3b9e61b` with
weak holding only, against `ac5d6fb` with the full change). That pose had 77 live unowned uploads, all engine-global:
the composer's buffers and targets, and the page's own draws.

The 4-circuit Chromium drive (heap ≤ 2 MB a circuit, GL flat) did not finish inside the lane's cap:

- The weak-only build's run died at the c1 diagnostic on the dispose-time lookup above. That is how the bug was found.
- The `ac5d6fb` run died the same way.
- The `83e35d4` run (this fix) was queued behind a full browser lane at the cap.

The driver is `drive.mjs`; summarize a run with `sites.py <result.json>`.

## Checks (build `ac5d6fb` = this change before the dispose-lookup fix and `Scope.run`; same code paths otherwise)

- Boot smoke, standalone Driftwood, standalone Pine and grid (incl. the E463 overhead check): PASS, 0 faults.
- `scripts/test-facade-instancing.mjs`: PASS desktop / phone-tier / iphone-desktop-quality, 0 batches.
- WebKit render smoke: PASS (world mean 153, whip 86, sword 109, 0 % near-black).
- `physics-baseline --mode=walk`: 63 legs, 0 stuck.
- Node tests:
  - `test/engine/upload-ownership.test.ts`, 3 new: compile stand-ins are owned by the source mesh's owner; weak
    orphans are adopted by an owned draw or freed by the level; the dispose-time lookup never re-adds.
  - `test/engine/async-owner.test.ts`, 1 new: a region registry takes an ambient registration with no stray read.
- Full vitest on a clean export of `27e5df2` + this change: 936 / 939 files passed. The 3 failures were all mine and
  are fixed in the final change:
  - the AG7 graph and SF2 coupling, from shard imports of `withOwner`, replaced by `Scope.run`;
  - a test double without `has()`, after reverting the `Game.ts` edit.
