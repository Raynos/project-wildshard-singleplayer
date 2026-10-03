# Signal Dunes: the top 10 levers to the mockups (E407)

**State:** `in progress` 2026-10-03: written by the lead from the zoom-out audit (Jake: "when in doubt, zoom out … go big or go home"); the signal-dunes builder works it row by row in place of the council's small fixes; the council keeps scoring each batch (bar 7.0, ledger 4 as amended).

## Why the game sits at 6.6 when the mockups are the target (first principles)

Eleven council rounds moved Signal Dunes from 4.70 to 6.63. The last four rounds added about +0.1 each, and several
"fixes" overshot and were undone. Tuning has run out. Put the five mockups beside the game frames and the gap is not
exposure or colour any more. It is **what is in the frame and how it was made**:

1. **The land is the wrong shape.** The mockups are big sculpted dunes, tens of metres high, with sharp crests, long
   smooth windward slopes and steep shaded slip faces. The game's land is a noise heightfield with a few crest lines
   added by hand. The forms are small, so the light has no big planes to fall on. Every round since round 1 has
   repeated "A's landform".
2. **The sand looks like a texture, not sand.** The game paints one strong, regular ripple pattern over everything,
   right up to the horizon. In the mockups the sand is smooth at large scale, with fine grain near the camera and
   ripples only where the wind would leave them. That repeated ripple is the single most "video game" thing in the
   frame.
3. **The low sun has nothing to cast.** In the mockups, crests throw long shadows across the troughs. In the game the
   phone's shadow cascades stop at 80 m, and the terrain doesn't shadow itself beyond them, so distant dunes are flat.
4. **The hero assets are code-built and close to the camera.** The fire is a flame card. The brazier, the caravan, the
   crates and the glove are procedural. The coil is a big double ring in the middle of every frame. The mockups show
   modelled, textured objects.
5. **The constant 20 % of every frame is wrong.** The viewmodel (glove and coil) and, in two views, Sefa occupy the
   frame's centre and lower right. In all five mockups that area holds a small, loose loop and a gloved hand in the
   corner.

So the levers are **form, assets and composition, built once and global**, not more coefficients.

## The rules for this plan

- **One world.** Every change is global and holds up from every place a player stands, including the hero views,
  aerials and the clip. No per-view hacks, and ledger 5 still holds.
- **Assets go through the `mockup-to-model` skill.** Use the mockup crop as the reference sheet. TRELLIS.2,
  Hunyuan3D-2 and Blender scripts are all allowed; pick the best result. Mockup and model sit side by side on a board.
- **Budgets.** The phone limits are 1.8 GB loading and 1.0 GB Explorer. gpuMB ceilings are ratchets, re-recorded at
  the measured value.
- **Engine needs go to wildshard-9** as an ENGINE REQUEST, and the lead builds them.
- **Commit after each row, and send 'ready for round N'.** The council scores each batch at the 7.0 bar.

## The top 10, in order of expected gain

| # | Lever | Views it moves | How (go big) |
|---|---|---|---|
| 1 | **An authored dune field.** | A, dusk-fire, D (and every hero view) | Replace the noise and the crest-line patches with one sculpted macro heightmap. Use the mockups' composition: a long descending diagonal crest from the spawn toward the tower, the tower on a broad separate mound, a saddle, and long transverse bands toward D's overlook, with 20–40 m relief and sharp crests over steep slip faces. Generate it with a dune-erosion pass (a Blender or numpy wind-deposition sim) or sculpt it in Blender from a top-down sketch of the mockups. Commit the script and bake it as the terrain. Climbs stay under 40°; re-bake the navmesh. |
| 2 | **A new sand material.** | all five | Remove the uniform ripple normal. Add macro albedo variation (crests lighter, troughs warmer), wind-aligned ripples that fade on slip faces, on crests and with distance, fine grain near the camera, sparse glints, and a grazing-light sheen. Generate the detail maps with Qwen-Image or Blender, tileable, as real textures. |
| 3 | signal-dunes | landed (round 13) | look/render.ts bakeDuneShadow: re-baked on the authored field, extended to +-520 m over the skirt (896 texels), penumbra growing half as fast with distance, cast shade 0.28 of the key |
| 4 | **Rebuild the viewmodel.** | all five (~20 % of every frame) | One modelled leather glove (seams, knuckle folds, worn cuff) and one loosely coiled single loop, held low in the lower right, as in A, C, D and dusk-fire. It replaces the code-built double ring. Use `mockup-to-model` with mockups D and C as references. |
| 5 | **A painted dusk sky at infinity.** | all five (40 % of the frame) | One seamless 360° matte-painted sky per dusk stage (early, mid, late), made from the mockups' skies: the sunset glow on the right azimuth, the cloud banks, the stars coming out. Blend between them by dusk value. It is allowed because it sits at infinity (one panorama, no seams). It replaces the procedural cloud and glow tuning. |
| 6 | **Real fire.** | C (and B's cookfire, the signal fire) | A flipbook fire made from a Blender fire sim or generated frames: a hot core, torn tongues and burning logs. Add embers as particles drifting downwind, a smoke column that widens with height, and a flickering light pool on the ground. Rebuild the brazier as an iron bowl on a fieldstone plinth. |
| 7 | **The caravan camp as a modelled set.** | B | Model the wagon (torn canvas over hoops, tailboard planks, spoked wheels), the crates, the sacks and the horse with `mockup-to-model` from mockup B. The lantern lights them with a real local light. |
| 8 | **The flying ray in the dusk sky.** | dusk-fire (its focal silhouette) | Route the ray's ordinary dusk patrol over the tower, so a player at the spawn sees it there at that hour. It flies a real route; nothing is staged for the shot. Its model should read as a silhouette against the glow. |
| 9 | **The spawn's first look.** | A, dusk-fire | The mockups' spawn view is an empty vista. Sefa stands in it. Move her greeting so she meets the player from beside or behind (she walks up, or waits at the camp the player is sent to). That keeps the first look on the dunes and the tower. It is a design change for every player, not a camera trick; note it in the shard README. |
| 10 | **Atmosphere and grade.** | all five | Aerial perspective, so the far dunes go violet-blue with distance, plus warm dust haze near the horizon and filmic contrast. Use one shard LUT derived from the five mockups (histogram transfer), global and never per view. Retune the late-dusk floor only after rows 1–3 land. |

## Order of work

Rows 1, 2 and 4 come first. They change the most pixels in the most views. Row 3 follows row 1 (it re-bakes on the new
terrain). Then rows 5 and 6, then rows 7–10. After each row: commit, capture, send 'ready for round N'.

## Status

| # | Owner | State | Evidence |
|---|---|---|---|
| 1 | signal-dunes | landed (round 13, redone) | authored landforms (layout LANDFORMS, world/dunes.ts landforms()): a crest spline (-42,-82)-(-14,-50)-(18,20), 7-13.5 m, a 30 m slip face toward the spawn and a 70 m windward face, owning its footprint; the tower's broad mound (21.5 m over 62 m). Overlay vs mockups: art/sunscar-dunes/round-22-landforms/overlay-A-duskfire.jpg; dune-band grid correlation A 0.00 -> +0.37, dusk-fire +0.21 -> +0.37 |
| 2 | signal-dunes | open | |
| 3 | signal-dunes | open | |
| 4 | signal-dunes | open | |
| 5 | signal-dunes | open | |
| 6 | signal-dunes | open | |
| 7 | signal-dunes | open | |
| 8 | signal-dunes | open | |
| 9 | signal-dunes | open | |
| 10 | signal-dunes | open | |
