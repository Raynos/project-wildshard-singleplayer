# Wreck Cove waterfall, toon rebuild (E150, 2026-09-25)

Finding T5 of the [phone audit](../../driftwood-audit/round-1-phone/README.md) (`19-cascade.jpg`): the waterfall was a
soft, blurred white-cyan curtain with flat white ripple ellipses, out of step with the faceted world. The user said
"fix it".

`src/world/Waterfall.ts` is rebuilt in Driftwood's toon style. The old curtain stays behind **`?waterfall=v1`**
(`src/world/WaterfallV1.ts`).

- **Three terraces.** Each one is a short flat shelf (the pour-over lip, or the ledge the step above lands on) and then
  a ballistic drop. The curtain stays 12 cm above the terrain.
- **Pleated, faceted sheet.** Every other column stands 7 cm proud, and the facets are shaded in three toon bands
  against the sun. Down each drop the water changes colour in hard bands: glassy cyan, then teal, then deep teal.
- **A crisp white line at every brink** and a scalloped foam band where each drop lands. A few lanes of bright
  streak dashes scroll down the sheet. The sides are cut hard with a thin white rim.
- **Chunky foam at the foot.** 12 low-poly foam balls (20-face icosahedra) boil up and sink back, 4 more sit on each
  landing, and 8 spray chunks are thrown up and shrink away. They are toon-lit in two bands: sunlit white and a
  pale-blue shade.
- **Faceted pool rings.** Nine-sided foam rings, broken into dashes, spread from a scalloped white core. They stay
  inside the 2.4 m plunge pool; the old ellipses ran out onto the sand.

## Files

All shots are iPhone captures: 390×844 at 3×, phone tier, `tod=0.1667`, UI hidden, from the same local build (before is
`?waterfall=v1`).

- `board.jpg`: before and after, for the audit's camera and a close camera.
- `before-audit.jpg` / `after-audit.jpg`: the audit's 19-cascade camera, `cam=136,·,10,2.31,0.08` (4.5 m above the
  ground).
- `before-close.jpg` / `after-close.jpg`: `cam=133,·,14,2.19,-0.02` (3 m above the ground).
- `waterfall-before-after.mp4`: before on the left, after on the right. It is 3 s at 30 fps from the close camera,
  with the camera fixed. Every frame was rendered on a virtual clock, 2 × 1/60 s of game time per frame, so the motion
  plays at real speed.

## Cost (phone tier)

| | before (v1) | after |
|---|---|---|
| draw calls | 3 (sheet, ring, mist points) | 3 (sheet, rings, puffs) |
| triangles | 208 + 26 points | 830 (sheet 252, rings 18, puffs 560) |
| scene totals at the audit camera | 116 calls · 1,326,083 tris | 116 calls · 1,326,705 tris |
| GPU, waterfall alone, 780×1688 target (M5 Max, median of 7×150) | 0.034–0.035 ms | 0.035–0.036 ms |

The cost is the same within noise. Both are unlit ShaderMaterials with no textures. The new fragment shaders use hard
bands (`fwidth`-AA'd steps) instead of the old value noise.
