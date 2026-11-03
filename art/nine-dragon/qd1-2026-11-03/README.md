# QD1 · Nine Dragon walls and floors · full golden QA (2026-11-03, sp-o1 + sp-o2)

Jake (07:47, live `8057f4f`): Nine's walls and floors missing, balconies, awnings, signs and lit interior windows
floating on a pale void, street level too. Jake (09:42): *"Nine Dragon has to be fixed. Top priority."* Cause
(wildshard-v, board `362700873a`): `3a1b02062a` / `1c3b618319` hang Nine's plain walls and flagstones as child nodes
under kit anchor meshes, and `SlabLibrary.bind()` hid anchors with `mesh.visible = false`, which hides their children.

- Fix 1 `cc40cad706`: a merged anchor draws on no layer (`layers.disableAll()`) and stays visible.
- Fix 2 `54771bace4`: a key's own anchor too, from bind on (it was hidden until its key's first chunk laid, and forever
  for a far or unresident key: the distant shaft floors).

## Boards (build `54771ba-mw0sut9p`, both fixes)

Every shard's 24 golden cameras (`art/legacy-goldens/compare/cameras24.json`), each camera LEGACY golden · SHARDFILE
golden · NOW, three readable pages a shard, a verdict burned in per camera. Chromium as iPhone 16 Pro portrait, phone
tier, 2x, muted (`art/legacy-goldens/compare/capture.mjs`, sp-o1). WebKit pass (sp-o2, `ae166f8f0e`):
`art/golden-runs/<slug>/2026-11-03-54771bace4-webkit-board.jpg`.

| Shard | Chromium (sp-o1) | WebKit (sp-o2) |
|---|---|---|
| Nine Dragon Stack | [p1](../../golden-runs/nine-dragon-stack/2026-11-03-54771bace4-qd1-chromium-board-p1.jpg) · [p2](../../golden-runs/nine-dragon-stack/2026-11-03-54771bace4-qd1-chromium-board-p2.jpg) · [p3](../../golden-runs/nine-dragon-stack/2026-11-03-54771bace4-qd1-chromium-board-p3.jpg): **24/24 green** | [p1](../../golden-runs/nine-dragon-stack/2026-11-03-54771bace4-qd1-webkit-board-p1.jpg) · [p2](../../golden-runs/nine-dragon-stack/2026-11-03-54771bace4-qd1-webkit-board-p2.jpg) · [p3](../../golden-runs/nine-dragon-stack/2026-11-03-54771bace4-qd1-webkit-board-p3.jpg): **24/24 green** (sp-o1, with the pre-`3bc3bd9a79` capture: the new observer did not bind in WebKit until `30fa5f1532`) |
| Far Reach | [p1](../../golden-runs/far-reach/2026-11-03-54771bace4-qd1-chromium-board-p1.jpg) · [p2](../../golden-runs/far-reach/2026-11-03-54771bace4-qd1-chromium-board-p2.jpg) · [p3](../../golden-runs/far-reach/2026-11-03-54771bace4-qd1-chromium-board-p3.jpg): 24/24 green | 24/24 green |
| Sunscar Dunes | [p1](../../golden-runs/sunscar-dunes/2026-11-03-54771bace4-qd1-chromium-board-p1.jpg) · [p2](../../golden-runs/sunscar-dunes/2026-11-03-54771bace4-qd1-chromium-board-p2.jpg) · [p3](../../golden-runs/sunscar-dunes/2026-11-03-54771bace4-qd1-chromium-board-p3.jpg): 24/24 green | 24/24 green |
| Driftwood Isle | [p1](../../golden-runs/driftwood-isle/2026-11-03-54771bace4-qd1-chromium-board-p1.jpg) · [p2](../../golden-runs/driftwood-isle/2026-11-03-54771bace4-qd1-chromium-board-p2.jpg) · [p3](../../golden-runs/driftwood-isle/2026-11-03-54771bace4-qd1-chromium-board-p3.jpg): 24/24 green | 24/24 green |
| Pine Hollow | [p1](../../golden-runs/pine-hollow/2026-11-03-54771bace4-qd1-chromium-board-p1.jpg) · [p2](../../golden-runs/pine-hollow/2026-11-03-54771bace4-qd1-chromium-board-p2.jpg) · [p3](../../golden-runs/pine-hollow/2026-11-03-54771bace4-qd1-chromium-board-p3.jpg): 24/24 green | 24/24 green |
| Nalati Grasslands | [p1](../../golden-runs/nalati-grasslands/2026-11-03-54771bace4-qd1-chromium-board-p1.jpg) · [p2](../../golden-runs/nalati-grasslands/2026-11-03-54771bace4-qd1-chromium-board-p2.jpg) · [p3](../../golden-runs/nalati-grasslands/2026-11-03-54771bace4-qd1-chromium-board-p3.jpg): **red, not QD1** | same shift, pre-existing |

**Before / after: [before-after-board.jpg](before-after-board.jpg).** Golden cam 20 on `308a77e` (after the culprit commits, before
both fixes) has no facade behind the balconies, so the view runs through to the next block, with floating balconies,
windows and pale gaps (Jake's street shot); on `54771ba` the walls are back and it matches LEGACY. Cams 10, 17, 18 and
21 look the same before and after: the hidden walls sit behind other geometry from those cameras.

Jake's 7 QA spots: [jake7-chromium-board.jpg](jake7-chromium-board.jpg) and [jake7-webkit-board.jpg](jake7-webkit-board.jpg) (FIX in WebKit, LIVE in Chromium), JAKE'S PHONE · LIVE `8057f4f` · FIX `54771ba` after 60 s
at each pose. His poses were not recorded; [cameras-jake7.json](cameras-jake7.json) reads them from his shots and
minimaps. **They land near his spots but not on his exact views, and LIVE already looks whole there in Chromium**, so
this board shows the spots are whole after the fix, not the defect itself: cam 20 above is the before / after evidence.

## Notes per shard

- **Nine:** walls, floors, ceilings, props and hands present; wet neon, facade colours, exposure, sky and fog match.
  On cams 17, 18 and 21 NOW matches LEGACY better than the SHARDFILE golden: those goldens (10-29) show pale voids and a
  void under an awning that predate QD1's cause (10-30) and are already gone before the fix. Golden cams 10 and 20 were
  also shot after 60 s at the pose: unchanged.
- **Far Reach:** the differences are its sky creatures passing the camera (2, 9, 10, 12, 14, 17), the windmill's turn
  and grass sway; cams 2 and 14 show the same creatures on `cc40cad706` (fix 1 only).
- **Pine:** animals at the camera (11, 20), clouds, foliage.
- **Nalati: fixed by QD11 `2d4405a27c`** (the classic GLSL post fragment had no `colorspace_fragment`, so Nalati's
  grade, drawn straight to the canvas since `e4af5b6bab`, wrote linear values once `180df449c9` moved post to GLSL):
  24/24 green in [Chromium](../../golden-runs/nalati-grasslands/2026-11-03-2d4405a27c-qd11-chromium-board-p1.jpg)
  and [WebKit](../../golden-runs/nalati-grasslands/2026-11-03-2d4405a27c-qd11-webkit-board-p1.jpg) (pages p1-p3).
  Before it:
- **Nalati, red but not QD1:** every camera is darker and more saturated with an orange sky against both goldens. The
  `c9ae94288f` capture (sp-x2, before QD1) is pixel-for-pixel the same at cams 1 and 5, and sp-o2's WebKit SSIM matches
  its `c9ae` run: it predates both fixes. A slab-anchor visibility change cannot recolour a sky. Owner to find: a Nalati
  look / time-of-day change between the goldens (10-29) and `c9ae94288f`.

## Jake's 7 spots, matched (QD1 redo, 11:30)

wildshard-v's read: the first 7-spot boards above used approximate poses and prove nothing. [jake7-matched-board.jpg](jake7-matched-board.jpg)
puts each spot at Jake's own pose ([jake7-matched-poses.json](jake7-matched-poses.json): position from his minimap,
each 1 m grid spot's minimap correlated with his at 0.84-0.96; heading and pitch matched to his view), JAKE'S PHONE ·
LIVE `8057f4f` · FIX `2d4405a` (both QD1 fixes + QD11), 60 s at each pose.

- **Street floor (07:49) is the before / after:** LIVE reproduces his shot, a flat pale floor with walkers on it (the
  flagstones were children of hidden kit anchors); FIX draws the flagstone street. Nearby (x 12-14) FIX also draws plain
  walls where LIVE leaves see-through gaps.
- **The other six** look the same on LIVE and FIX in Chromium, as his phone shots of them do: those spots were not where
  the missing geometry showed.
- **The pale plane** at the bottom of the earlier shaft boards is not a floor, a clear plane or a fog card: those
  approximate poses stood 35-50 m above the square looking past the stack's open edge, and rays there hit no collider
  within 400 m. It is the fog over the void under the stack, the same on both builds. Nothing to fix.

## QD6 proof on the live build (sp-o3, 2026-11-03)

[jake7-live-0b5d27d-board.jpg](jake7-live-0b5d27d-board.jpg): the same 7 matched poses on production after the release
carrying every Nine fix (`0b5d27d384`, build `0b5d27d-mw0zj8ty`), JAKE'S PHONE · LIVE BEFORE `8057f4f` (sp-o1's run) ·
LIVE NOW `0b5d27d`, Chromium as iPhone 16 Pro portrait, phone 2x, 60 s at each pose. The street floor (07:49) is the
change Jake will see: his flat pale floor is the flagstone street on live now. The other six read whole on both, the gate
(07:51) with QD3's short streaks under the lights.
