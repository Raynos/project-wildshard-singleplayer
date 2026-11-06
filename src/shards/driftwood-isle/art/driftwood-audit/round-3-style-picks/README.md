# Driftwood phone audit, round 3: the style picks (E310, 2026-09-29)

These are the open style items from the phone audit ([round 1](../round-1-phone/README.md), rows T1–T6), one decision
board each.

- **Device:** Playwright `iPhone 16 Pro` in portrait, 402×874 CSS px at 3× (the home-screen PWA's full screen).
- **Game settings:** `?touch&tier=phone&mute=1&skipintro`, time of day fixed at midday (Settings ▸ Time), animals calm,
  HUD and view-model hidden. Every column of a board uses the same camera.
- **Source:** a clean export of HEAD `a075f565` running on a private dev server. The variant colours were set in that
  export only. Nothing in the shared tree was changed and nothing was shipped.

## Boards

| File | Question | Variants | Recommended |
|---|---|---|---|
| `t1-lookout-banner.jpg` | Which banner hangs on the lookout? | **A** today's live frame: a flat blue sheet · **B** swallowtail foot, navy trim, faceted folds · **C** crossbar with finials and a tassel fringe · **D** all of it in a deeper indigo with gold trim. B–D are codex `image_gen` edits of the A frame. | **B**: it matches the pier's swallowtail pennant (E111), which already uses this banner's blues and diamond |
| `t2-rock-palette.jpg` | Keep the charcoal Wreck Cove rocks, or lift them toward the island's pale crags? | **A** today (`#50555d` crag, `REEF_ROCK` mid `#5a5c60`), near-black in shade · **B** ~25 % lighter, warmer grey (crag `#6a6862`, reef mid `#726e69`) · **C** the pale crag grey (crag `#8c8a86`, reef mid `#9a968f`). Zoom rows: the crag by the wreck, and the loose rocks under the waterfall. | **B**: the rocks keep their weight and lose the black holes |
| `t3-driftwood-logs.jpg` | Keep today's weathered silver-brown logs, or go darker? | **A** today: E149's fix (`driftwood.ts`), live since 09-25 · **B** ~15 % darker and greyer · **C** ~30 % darker grey-brown. Zoom rows: the log pile at the sea-cave mouth and the beached piles by the wreck. | **A**: E149 already fixed the styrofoam look, and darker logs start to read as wet timber |
| `t1-live-A.jpg`, `t1-mockup-{B,C,D}.jpg` | The four T1 frames at full size | | |

The T2 and T3 variants are colour constants only (`src/world/Cove.ts` `C.rock*`, `src/world/rockKit.ts` `REEF_ROCK`,
`src/world/driftwood.ts` `DRIFT`). Draws, triangles and frame time stay the same. T1 needs new banner geometry in
`src/world/Lookout.ts`, about 1–2 h.

## No board

- **T4, the orange halo:** closed. The blind shadow A/B in [round 2](../round-2-shadow-ab/) showed no visible difference.
- **T5, the waterfall, and T6, the ocean facets:** already fixed and signed off. E150 built the toon waterfall and E151
  built the banded sea. In E162 (2026-09-26) Jake answered "Yes, keep both", and both are signed off as the final look.
  A board would ask him the same question again.
