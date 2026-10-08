# G223 (pine-visuals): Pine looks like Pine when entered from the grid (E435)

`capture.mjs` (through `scripts/browser-lane.sh`, iPhone 16 Pro, muted, Developer ON, phone tier) shoots Pine Hollow
standalone (`?chunk=pine-hollow&x=&z=&yaw=`) and Pine entered from the grid (spawned on the road east of Pine, walked in
through the east entry with real input) at the same cell-local poses, and records what draws (`receipts.json`).

`board.jpg`, per row (east-inside 231,0 · east-deep 180,0 · east-deep turned left), left to right: standalone ·
grid at `3f5ed6e8b` (before) · grid with the fix (candidate `9b2b0eaba`).

What was wrong, and the fix:

1. **The smooth tan groove was Pine's far proxy.** The cell's coarse root (`grid-cell:pine-hollow`: the far proxy and the
   shardfile ring tiles) stayed drawn after entry, and the decimated shell enclosed the camera over Pine's real ground.
   `src/game/grid/cellCover.ts`: the session binds a cover port to the page scene; a regional view hides its cell's coarse
   root for as long as an entry lives and gives it back on leave (and on dispose). Receipt: `coarse` shown `true` before,
   `false` after, at every stop; `test/grid-cell-cover.test.ts` (two visits, dispose while entered, no grid session).
2. **Pine's forest was culled away.** The forest's view frustum came from the page camera (grid render coordinates, z + 555)
   while its trees and viewer are frame-local, so `Forest.keeps` refused every tree and the shader's fade viewer sat 555 m
   off. `Forest.update` now carries the frustum into the forest's frame and the fade viewer out of it by the group's world
   matrix (identity standalone); Pine's undergrowth fade viewer the same.

Standalone is unchanged: the same draw calls and triangles at all three poses before / after (127 / 137 / 114 calls), frame
SSIM 0.986–0.991 (wind, animals). `scripts/test-facade-instancing.mjs` passes on the candidate build (desktop, phone tier,
iPhone desktop quality).

Left (reported, not built here): the grid's sky, light and grade still own the frame inside Pine (the bright toon sky and
saturated grade, against standalone's hazy morning), i.e. Pine's sky keys and its LUT / curve / vibrance; and the entered
grid frame draws 265–320 calls and 2.6–3.9 M triangles against standalone's 114–137 calls and 1.3–1.4 M (the road, the
home and the neighbours on top of Pine's whole world), which needs a phone frame-floor reading.
