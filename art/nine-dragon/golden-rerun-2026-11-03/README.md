# Nine golden rerun, 2026-11-03 (live 8057f4f)

Jake's phone shots (07:47, live 8057f4f): lower floors read as balconies and signs on a flat
pale void, streets with no floor. This is the 24-camera golden rerun on that build.

- `board.jpg`: the 24 cameras (`art/legacy-goldens/compare/cameras24.json`), three columns
  each: LEGACY golden | SHARDFILE golden (744c3ab7e2, 10-29) | SHARDFILE now (8057f4f).
  Captured with `art/legacy-goldens/compare/capture.mjs` (Chromium, iPhone 16 Pro 2x, phone
  tier, midday / clear, seed 357). Red cameras: **10 well-north** and **20 well-floor** (plain
  walls gone, balconies on a pale void). LEGACY at 8057f4f still matches its golden, so the
  break is SHARDFILE-only. Playwright WebKit shows the same break as Chromium.
- `bisect-cam20.jpg`: cam 20 at the culprit, its parent, and the culprit with a runtime
  version of the fix.

## Cause

`3a1b02062a perf(nine): plain walls draw on a kind-0 program` (10-30 23:33) bakes each kit's
plain faces into a child `kit:<name>:k0` node, like `1c3b618319` (10-30 22:45) did for the
flagstones (`:k3`). `src/game/shardfile/slabLibrary.ts` `bind()` hides a merged anchor
(`key.sources[0] !== id` -> `mesh.visible = false`), because the joined slabs (`cde6aaf36f`)
draw its triangles under the key's first anchor. The split-kind nodes are children of that
anchor, so hiding it hides them as well. Every kit except each key's first anchor (`kit:paifang`,
`kit:well-l-deep`) loses its plain walls and its flagstones. In cam 20, 43 of the 45 plain-wall
meshes are never drawn. Their ancestor chain ends in `kit:well-r(HIDDEN)` and similar.
Frustum culling is not the cause: turning culling off changes nothing.

Range: Jake's last good phone build was 55eaf50 (10-30 21:33). The floors went at
1c3b618319, and most of the walls at 3a1b02062a. Its parent 9ae0b15fdd matches the golden at
cam 20.

## Fix (forward)

In `slabLibrary.ts` `bind()`, keep a merged anchor visible and stop it drawing:
`mesh.layers.disableAll()` instead of `mesh.visible = false`. This is the same treatment
`lay()` already gives a drawn anchor (EP7), and its stand-in geometry is empty either way.
Simulated at runtime on 3a1b02062a (15 anchors at cam 10), cam 20 matches the golden again
(`bisect-cam20.jpg`).
