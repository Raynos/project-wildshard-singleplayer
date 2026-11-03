# Open-plot sun disc · G992 (2026-11-03, sp-o2)

Jake: the open plots' sun / moon was a "half-assed moon or sun". It is one shared element: every shardfile data look
(`src/engine/render/dataLook.ts`, all open plots) kept the engine's default sky dressing, a 1° sun sphere plus a 420 m
additive corona sprite (`src/engine/world/skyBackdrop.ts`), which bloom smeared into a blurred disc over the gradient dome.

`board.jpg`: golden view 2 (`../golden-2026-11-03/*/cameras.json`, 40 m over the road) on the live `9a3952f83c` preview,
phone tier, 2x, muted iPhone 16 Pro, the disc toggled live: **A now**, **B off**, **C crisp** (the disc without its
corona). Coral Drift's pinned noon sun is overhead and in none of its golden views.

**Ruled B under G941 / G872:** C reads as a 3 px speck, not a sun; B leaves the clean gradient sky the mockups show.
The data look now declares `sun: { disc: false, halo: false }`; the key light, shadows and sky keys are unchanged. It
covers every data-look product (the open plots and the blender template) with no per-plot tuning (G994).
