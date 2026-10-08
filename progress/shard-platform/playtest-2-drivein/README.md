# Playtest round 2: the drive-in rows (SHARD-PLATFORM, E435)

Lane drivein on `art/playtest/round-2-2026-10-08/README.md`. Every grid capture is a real drive-in: a Developer-ON grid
boot (`serve-build.sh --head`, aeffbd50a), a pose onto the boulevard only, then held input into the cell (`drive.mjs`).
The SHARD SELECT reference for the same spot is `standalone.mjs`. iPhone 16 Pro portrait, muted, one browser through
`scripts/browser-lane.sh`.

| Row | Finding | Result | Proof |
|---|---|---|---|
| Open plot (G219): black ground | No missing texture, material or light. The floor shader's base was 0x03070d, and its lines faded to nothing once thinner than a pixel, so past ~20 m the floor was black | **Fixed** (080afa950): navy base hazing to the sky's blue, sub-pixel lines turn into their mean cover | `plot-mid-n-…`, `plot-mid-e-…`, `plot-entry-s-before-after.jpg` |
| Open plot (G219): blank billboards | The grey slab on every horizon was each entry billboard's steel back (the picture faced the road only) | **Fixed** (080afa950): its back shows the entry's demo idea | same |
| Grid Nalati: yellow steppe + grass on the entry road | One cause. The grass is the look's (`LookStrategy.grass`, Nalati's GrassV2), read from the page look in `Grass.build()`. In the grid the page look is the neutral shell, so Nalati's runtime builds the engine's default carpet. That carpet reads splat as [forest floor, grass, rock, trail], but Nalati's splat is [grass, gravel / road, rock, snow]. So the road channel grows the densest grass, and the meadow gets the forest-floor olive tint (the yellow) | **Missing per-region look**: the region needs its own look's grass driver. Not fixed here | `nalati-grass-grid-vs-standalone.jpg` (grid looking W, grid looking E, SHARD SELECT looking E: a clear dirt road) |
| Grid Nalati: black horizon band | Not reproduced on aeffbd50a, looking W at Driftwood from the entry and from x = 470. Most likely the black shaded far-proxy cliff that d2263ea11 (SF23) fixed | No change | `nalati-horizon-no-band.jpg` |
| Pine: near-black forest frames | Under the shared grid sky a PBR shard has no environment or fill, so every shadowed or back-lit surface is black and the sunlit ground goes orange. Region sky ▸ own (G223, default-off) brings Pine's backdrop (PMREM and lights) and the forest reads green and lit, a little darker than SHARD SELECT (no fog or grade) | **Missing per-region look**. G223's row B mostly covers it (+32 MB) | `pine-forest-shared-own-standalone.jpg` (shared, own, SHARD SELECT at Pine (120, 0)) |
