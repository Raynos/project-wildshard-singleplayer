# Foliage round 1: the ground wears the cover (E156, A + C)

Mockups for E156's picked fix "A + C". Driftwood draws plants only in a ~76 m bubble round the camera, so ground
past it looks bald. **A** tints the terrain's own colour by what grows there. **C** keeps plants out further on
slopes that face the camera.

The base frames are live iPhone portrait captures of the shipped game (1170×2532). Only the far-ground band changed:
from the horizon (knoll and hill included) down about 25 % toward the camera. The near plants, sky, sea, sword and
HUD are pixel-identical to the capture. The tint fades out over the lower third of the band, so it has no seam
against the untouched near ground.

| File | What it shows |
|---|---|
| `board-p3.jpg` | **Decision board.** In the ferns, looking at the shrine knoll about 100 m out: SHIPPED · A1 · A2 · A3, with the boxed far ground enlarged underneath |
| `board-p2.jpg` | **Decision board.** From the hut plateau toward the sea: open flat ground plus the grass hill on the left. Same layout |
| `p3-A1.jpg`, `p2-A1.jpg` | **A1, tint only.** The bare lime ground takes the averaged cover colour: a deeper fern green, varied a little per low-poly cell, with the facet shading kept. No flecks |
| `p3-A2.jpg`, `p2-A2.jpg` | **A2, mottled + flecks.** A1 plus flat-shaded cell mottling (darker fern/bush stands, lighter yellow-green tuft patches) and sparse 1–2 px red (hibiscus) and white (daisy) flecks in flower patches |
| `p3-A3.jpg`, `p2-A3.jpg` | **A3, A2 + slope cover (C).** A2 plus small faceted bush clumps along the crest and on the camera-facing slope of the knoll or hill. Flat open ground gets no extra clumps (C keeps plants short there) |
| `qwen-attempts-A1.jpg` | Why the local model was dropped: Qwen-Image-2.1 turbo with the far-ground mask, seeds 7 / 42 / 101 on both frames. On every seed it kept or brightened the bare lime and added grass tufts instead of tinting the ground, and it softened the masked area |

**How they were made:** Qwen failed the core recolour on all 3 seeds for both frames (A2 and A3 too, not shown).
codex `image_gen` can't take a mask and redraws the whole frame. So the variants are a **procedural recolour** of
the capture, the same operation the terrain shader would do:

- The bare-ground pixels in the band are multiplied toward a cover colour per perspective-scaled Voronoi cell
  (wide flat facets that shrink toward the horizon). The original luminance is kept, so facet lighting survives.
- A2's cover mix comes from a low-frequency fern/tuft field, and its flecks land only in flower patches.
- A3's clumps are 1–3 faceted domes each (lit, mid and shade facets), drawn 4× supersampled.

The script was a scratchpad one-off (`cover.py`, E156 mockup session, 2026-09-25).
