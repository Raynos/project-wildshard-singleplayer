# Round 24 · stair-street lane (E281): domes C1 + C2, mockup C

The stair agent's passes of the E281 mockup pass. Files: `src/chunks/nine-dragon-stack/world/stairstreet.ts` (C1: the
plan, the colliders, the foot) and `stairstreet-upper.ts` (C2: landing 1 upward). Each pass is a clean export of HEAD
plus only these two files, built and served with `vite preview`, shot with
`node scripts/nine-dragon-domes.mjs --domes=C1,C2 --mockups=C`. Targets: `../../round-15-eight-domes/{C1-stair-stand,C2-stair-look}/`
and `../../round-6-baseline-hud/comp-C-stair-street.jpg`.

Per pass: `C1-stair-stand-sheet.jpg` and `C2-stair-look-sheet.jpg` (target | engine, nine views), `mockups-sheet.jpg`
(mockup C over the engine's phone frame), `eyecheck-*.jpg` (previous | this | target at C1·5, C2·5, C2·1 and mockup C)
and `stats.json` (draws / triangles per pose, the fragment's geometry and texture memory).

The cyan slab and black band across the lower half of every mockup-camera frame are the viewmodel (not this lane): they
are in pass 0 too.

## Pass 1 (on HEAD c3b14631)

Plan row F6: open depth over the stair, the paifang big and centred, the skybridges at the mockup's depths.

| Change | Where | Kept? |
|---|---|---|
| The lantern string across the foot (x 28.5) removed; it capped mockup C | C1 | kept |
| The lantern string over flight 2 (x 43.5) removed; it capped C2·5. The one past the paifang stays | C2 | kept |
| Cable and laundry spans only past the paifang, every other one, 3 m higher (the rng still draws every span, so the signs and crowd keep their rolls) | C2 | kept |
| 麵 sign 1.95 → 1.25, hung 0.2 m off the wall, 0.75 m higher: mockup C's upper-left corner, not the middle of the frame | C1 | kept |
| The brass dragon raised 2.5 m to sit right of and below the sign (mockup C: a quarter down the frame); a warm gold instead of brown | C1 | kept |
| The stair paifang widened: posts ±3.1 / ±5.6 (was ±1.75 / ±4.6), scale 1.3 (was 1.5). A 6.2 m centre bay instead of a 3.5 m slot; the collider boxes follow | C1 plan | kept |
| The skybridge with its banners raised to +170 (it sat on the paifang's roof from the square); from landing 1 it now stands clear above the roof, as in C2·5's target | C2 | kept |
| The monorail moved nearer and higher (x 50, train +160…163): the top crossing of mockup C, overhead in C2·1. The 150 m girder cut to the canyon's 40 m. The train rebuilt for the view from below: a dark belly, a tall lit window band, a cinnabar stripe, bogies | C2 | kept (the first cut, a pale grey belly, read as a slab: redone before commit) |
| Two far crossings past the top landing (x 86, x 108), seen through the paifang's centre bay | C2 | kept |
| The mahjong tables on the tea verandas (≈1 900 vertices of tiles each, unseen from the stair) → tea tables (≈250); the eave tile ends flat squares instead of icospheres | C1 + C2 | kept |
| C1's six kits (steps, foot, signs, over, dragon, alpha lattices) → ONE `stair-foot` kit: the alpha cards became real bars, the dragon's KitX folded in | C1 | kept |

Numbers (C1·5 / C2·5 / mockup C draws): 94 / 82 / 149 → 90 / 81 / 144. Fragment geometry 168.7 → 165.1 MB, textures
79.6 → 79.6 MB. Walk test (19 legs): 0 stuck, 0 out.

Left for later passes: the far end is still a wall through the paifang (the targets see a deep, layered city); the sky
screen over the stair (build.ts `screen2`, +173.45) still caps everything above the paifang from the square.
