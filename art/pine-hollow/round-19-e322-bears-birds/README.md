# Pine Hollow round 19 — E322 bears (F-M2) and birds (F-M5)

Two creature rows from PINE-HOLLOW-FOLLOWUPS, each a Debug ▸ Creatures & NPCs variant (A = today, the default until
Jake picks) with an iPhone 16 Pro portrait board from the real build (phone tier, daylight, the animal posed and frozen,
the herds hidden).

## Bears (F-M2) — Debug ▸ Creatures & NPCs ▸ Bear fix

`bears-board.jpg`: rows brown bear · Grizzled Sow · black bear; columns A rear · B rear · A side · B side
(`scripts/e322-bears-capture.mjs`).

What was wrong, and B's fix (`src/entities/bearFix.ts`, `pineCoats.ts`, `pineCreatures.ts`):

1. **The stub-tail flap.** Both Hunyuan3D-2 hulls grew a ~25 cm lobe off the top of the rump (brown: z −0.81…−0.55 m,
   y 0.5…0.95 m in rig space; black: z −0.28…−0.08 m). It is not a separate part: deleting its triangles leaves a hole
   (20–37 new boundary edges), so B **presses** it — every vertex above y 0.46 behind the rump's back plane goes onto the
   plane, keeping 8 % of its depth and domed out 5 cm (black 3.5 cm) at its centre so the rump stays round, normals
   re-derived. Positions only: topology, uvs, skin indices and weights are untouched, and the same numbers serve the
   phone hull (brown 501 / 375 vertices moved desktop / phone; black 964 / 733). The pressed patch still wore the
   tail's paler fur, so its atlas texels take the colour of the rump beside it, blurred, times their own hair detail
   (`flapTransplant` + `applyFlapFill`, feathered at the border). Tried and dropped on the way (three rounds, the
   bounded loop's limit): one mean-ratio tint for the whole patch (a visible darker patch), a per-texel copy of the
   rump's texels and normals (a blocky mosaic).
2. **The coats.** The brown hull's atlas is its own coat (no recolour), and it measures close to its reference photo —
   the pink comes from Pine Hollow's render of it (a pale tan under the fur material's warm pink-white sheen and rim).
   The Grizzled Sow is that atlas pushed paler with a near-white rim. B measures the hull's own three tones off the atlas
   (12th / 55th / 92nd luminance percentiles) and maps them exactly onto grizzly tones (`BEAR_FIX_COATS`), and gives the
   sheen and rim the coat's hue (`BEAR_FIX_FUR`). No new asset bytes: it is done at load.

Measured in game (torso crop of the side shot, sRGB mean at the 12 / 55 / 92 % luminance bands; hue °, saturation):

| | dark | body | light |
|---|---|---|---|
| reference photo `round-9-creature-refs/ref-bear-brown.jpg` | h18 s0.45 | h22 s0.43 | h25 s0.34 |
| A brown (today) | h4 s0.28 | **h16 s0.37** (rose-tan) | h29 s0.32 |
| B brown | h14 s0.45 | **h22 s0.50** | h36 s0.36 |
| A Grizzled Sow (today) | h290 s0.11 | h0 s0.11 | **[0.90, 0.87, 0.86] s0.04** (near-white) |
| B Grizzled Sow | h12 s0.29 | h25 s0.38 | h36 s0.24 (silver-cream [0.75, 0.68, 0.57]) |

B's brown body lands on the photo's hue (22°) at a touch more saturation; the Sow is a greyer, silver-tipped brown.

Left, visible on the board: from straight behind, B's pressed patch still shows a faint outline where it meets the rump
(the black bear's most: its flap was the larger), and the colour fill softens the hair texture there. The silhouette —
the tail itself — is gone on all three.

Not touched: the black bear's coat (it reads right); the black hull sits ~0.45 m forward of its skeleton's hips (its hind
feet at z 0…0.4 against hips at −0.5) — noted, not part of this row.
