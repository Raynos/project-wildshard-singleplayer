# Conch complete pass 2: actual capture receipt

2026-10-19 UTC. Actual hero and all nine captures completed, both Blender processes exit 0. Shared build lease released. Builder inspected original, retained predecessor hero/all nine, new hero/all nine, and final compact boards. No numerical self-score or acceptance claim.

- Builder SHA-256: `523529889cd3402645f9dd9308f4562503defad520eb86bb1cf1e940811782a5`, unchanged across both render runs.
- Hero: `tmp/conch-complete-pass2/color-front.png`, 780×960, 24 Cycles samples, 2 CPU threads. Exact inherited hero camera/light setup. Lease duration 64.78 s.
- Nine: `tmp/conch-complete-pass2/color-complete-pass2-{front,left,right,back,top,diag-front,diag-left,diag-right,diag-back}.png`, 496×700, 16 samples, 2 threads. Lease duration 104.87 s.
- Nine camera transforms and common scale match the retained complete-pass1 JSON exactly. No candidate auto-fit. Saved `cameras-complete-pass2.json` records them.
- Full terminal output: `tmp/conch-complete-pass2/hero.log`, `nine.log`. Initial pre-Blender lease failure: `failed-lease-default-home.log`. Corrected existing shared root and HOME came from coordinator; no alternate lease was invented.
- Generated editable scene: `tmp/conch-complete-pass2/conch-source.blend`. Source builder, renderer and portable GLB live here; no .blend is committed.
- Small labeled WebPs are faithful compressed previews of full PNGs with added title strips. Comparison and nine-view boards are portrait with labels. Original concept appears only in the explicitly marked comparison panel.
- `evidence.json` hashes actual source, output, original, retained comparator, logs and all raw frames. `source-freeze.json` separately freezes delivery sources.

GLB is 217,028 bytes. Topology: 2,190 triangles / 51 named meshes, zero nonmanifold edges or degenerate triangles; shell zero boundary edges and zero proper crossings. Eye/decal component boundaries and shared-vertex/coplanar crossing exclusions remain explicit. No armature/weights/animation/runtime claim. See `docs/reviews/conch-complete-pass2-construction.md` for limitations.

All ten actual new views were opened individually. Warm diagonal whorl flanks and slimmer face are present, while broad pale crown/lip, large aperture and angular body/shield remain visible. Back/top are coherence evidence only, because original hidden anatomy is unknown. A new independent review owns likeness judgment.
