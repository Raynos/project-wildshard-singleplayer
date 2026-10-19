# Conch complete pass 1 — actual capture receipt

2026-10-19, 12:53 UTC. Hero and fixed-nine Blender runs completed with exit 0 under the coordinator's shared build lease. The lane is released. No runtime integration or numerical likeness score is assigned.

The standalone builder was frozen before rendering and stayed unchanged: SHA-256 `2049f3d5a72f52cb9eac66e93b3ceb6a7aff538a483cf26d9b1bfd1a3a2490dc`. Actual GLB SHA-256 `96eca1a716b3726bf25b9c005c31c5dc2ec6ba74b3828ae5b7684a7e6527fc8f`, 241,260 bytes. The full hash/size manifest is `evidence.json` in this directory.

## Actual evidence

- Hero: `tmp/conch-complete-pass1/color-front.png`
- Nine full frames: `tmp/conch-complete-pass1/color-complete-pass1-{front,left,right,back,top,diag-front,diag-left,diag-right,diag-back}.png`
- Labeled comparison and nine-view boards are preserved in this source directory and the temporary output directory.
- Camera transforms/common scale: `cameras-complete-pass1.json`
- Actual terminal logs: `tmp/conch-complete-pass1/hero.log` and `nine.log`
- Complete editable source: the standalone builder, nine-view renderer and board script in this directory. Generated editable Blender scene also remains in the ignored output directory, not a repository binary deliverable.

Hero used two CPU threads, 24 samples, 780×960 and inherited AgX studio settings; the nine views used two threads, 16 samples and 496×700, one fitted scale across all nine. Hero lease duration 35.68 seconds; nine-view lease duration 63.32 seconds. These are actual fresh renders, with no concept pixels inside model panels.

The builder inspected the original, hero, every individual full-resolution nine-view frame, and both final boards. The changed shoulder transitions are less shelf-like in side views, but broad pale shoulders/top and regularized anatomy remain visible concerns for independent judgment. This observation does not award points or assert improvement over the prior independently reviewed model.

## Structural facts and limits

Actual export: 2,446 triangles and 56 named meshes. Every mesh has zero nonmanifold edges and zero degenerate triangles under the existing coordinate-welded audit. The unified shell, shield and solid anatomy have zero boundary edges. Eye housing/back/lens parts and facial decals retain the inherited explicitly separate component boundaries. The unified shell's 466 triangles have zero proper nonadjacent crossings under the existing bidirectional segment/triangle checker. Shared-vertex pairs and coplanar contact are excluded by that checker.

Full reports are `topology.json` and `crossings.json`. These are static structural checks only. Fresh independent visual review is still required against the authoritative original, with the unchanged 35/30/20/15 rubric. No rigging, animation, contact, combat readability, phone performance or gameplay acceptance follows from these results. Existing motion4 host/source and all historical candidates are untouched.
