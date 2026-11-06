# Pine Hollow round 28: E322 F-L3, crowns from above

`board.jpg`: pause ▸ Settings ▸ Debug ▸ Look ▸ **Crowns from above**, A = today / B = the fix, real
build `08fcc03` (HEAD + this row), iPhone 16 Pro portrait, phone tier, frozen frames (same wind, same LOD) from
`scripts/e322-crowns-capture.mjs`. Views: the fire lookout's deck, a god view 90 m over the Hollow, and the old-growth
floor (the proof nothing changes from below). The bottom row zooms each pair's crowns.

**What was wrong (look-loop round 17, TOP-10 #9):**

- The far band's 2-quad impostors: the material keeps the quad's own normal on both faces, but three still mirrors the
  tangent frame on a back face, so every impostor whose quad showed its back (about half) read the side-baked normal
  map upside down and facing away: lit as a grazing sky sheen, pale blue-grey beside its dark neighbours. B lights both
  faces with the bake's frame.
- Seen from above, the side bake holds no crown top and carries the crown's inner occlusion in its albedo, and the
  branch cards' tops keep their baked AO: the crowns read dark green-black. B leans the crowns' normals to the sky and
  lifts their albedo / sheds the AO of sky-facing cards, weighted by how far the view looks down (0 at the horizon, full
  from ~27° down), so level and upward views are unchanged.

**Numbers** (Rec.709 luma of the shown sRGB, tree pixels only; `crowns.json` in the capture):

| view | A crowns | B crowns | A cards · impostors | B cards · impostors |
|---|---:|---:|---|---|
| lookout deck | 0.326 | 0.305 | 0.265 · 0.373 (half pale sheen) | 0.316 · 0.296 |
| god view | 0.284 | 0.319 | 0.263 · 0.295 | 0.320 · 0.319 |
| forest floor (reference) | 0.282 | 0.282 | mid-crown band 0.312 | 0.312 |

- GPU (scripts/pine-hollow-gpu.mjs, p20, drawn at 3× so the M5 is GPU-bound, A B A B): lookout 1.81 → 1.81 ms,
  Hollow 1.80 → 1.79 ms. No measurable cost. Bytes: 0 asset bytes, +0.55 KB gzip JS.
- The lookout's far impostors in B are even but still darker than the near cards at that shallow angle; a top-down
  impostor slice (a new bake) would be the next step if Jake wants them lighter still.
