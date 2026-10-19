# Puffer next complete assembly: independent review

2026-10-19. **Retain selected closed anatomy. Do not promote next complete assembly.**

## Visual verdict

The candidate was scored blind against the original before viewing comparator images, author prose, source, receipts, or prior scores. The frozen score is in [blind-score.md](blind-score.md). All ten raw candidate frames were opened individually, then all ten raw selected frames. Comparison was frozen in [comparison-freeze.md](comparison-freeze.md) before reading the construction account.

- Candidate: silhouette 78, face 76, details 76, facets 82. Weighted 35% / 30% / 20% / 15% = **77.6/100**, equivalent to **3.88/5**. No rounding and no topology credit.
- Selected comparator: 80, 80, 79, 82, respectively = **80.1/100**, equivalent to **4.005/5**. This is this review's independent static likeness judgment, not owner acceptance or any runtime/animation pass.

The candidate stays clearly recognizable but loses the reference's substantial brow wedges and irregular pointed toes. Its compact raised toe fans look more regular and blunt; the crown has conspicuous long planes; its cream pouch is angular in profile. Selected's brow volume and broad pointed feet are closer. Both still have a projected angular bib and an elongated side silhouette compared with the reference. Neither front-only appeal nor repaired geometry overrides the ten-view comparison.

## Evidence independently verified

[evidence-verification.json](evidence-verification.json) records **252/252** successful checks from [verify_evidence.py](verify_evidence.py). This script reads the submitted artifacts and writes only to this review directory.

- Candidate native SHA-256: `b48589944bf7b85b05b1ef612969095f5d73941576a4a78c915770922e9a2e20`.
- Candidate GLB SHA-256: `52f7ef179bdf47ebc8231d77fdb4e7b915b91066f310c8831c957fac3de9f49b`.
- Selected native SHA-256: `98c4855852fc77ef385b0998e98dc5bdbabf40bb32b815f598c9a922525e5006`.
- All twenty raw PNG hashes, byte sizes and 600×740 dimensions match the capture receipt. All twenty corresponding preview hashes match. Every output-closure source-file hash and byte size matches; construction, geometry and preservation dependency pins match their current bytes.
- Each selected/candidate pair has exactly equal recorded camera position, target and orthographic scale for its view. Hero uses 3.2; nine standard views use 4.2. Current renderer hash matches `a456ff10b3eee42d1880fda1a5b16d7a3980eefdcaae42c4c7d14fdc4ea949bf`.

Renderer source inspection confirms one shared scene: Cycles, 24 samples, seed 0, denoising disabled, AgX, 100% 600×740 resolution, world color (.18,.18,.18), vertex colors, roughness .83, identity model transforms and shared ground. Three unchanged disk area lights are warm key (-3,4,5), 650 W, size 4, color (1,.90,.76); cool fill (4,1,3), 360 W, size 4, color (.73,.87,1); rim (0,-4,4), 500 W, size 3, color (.66,.87,1). Between models the only scene change is object render visibility. Camera changes occur between views identically for both models. No reconstruction or rerender was performed by this reviewer.

**Provenance qualification:** selected hero was preserved from the earlier renderer hash `3dcff53dd20c68914a9bae176aa4a7125bea0252db11cc20bbda89c5f7a9c720`, while the other nineteen use the current hash. Recovery metadata and its preserved raw hash agree, and its recorded framing/settings agree. The original renderer bytes are not retained in this package, so original-versus-resumed renderer code equivalence cannot independently be established here. The current freeze receipt intentionally remains “capture in progress”; the completed capture receipt and matching raw files establish completion. These qualifications do not change the visual choice.

## Geometry evidence: inspected versus recomputed

**Not recomputed:** full topology, proper crossing, coplanar overlap, nonincident contact, continuous attachment-cap, envelope preservation, or the 46-check GLB roundtrip audit. I inspected their receipts and the geometry auditor's source; passing author receipts are not independent reruns.

**Independently recomputed:** seven native parts, eight bones, 3,424 triangles, exact prepaint/postpaint position-array equality, and single-sided GLB material flags, plus the provenance/hash checks above.

Submitted geometry receipts report positive oriented closed components, no within-component crossings or contacts at native/prepaint and exported float32 stages, with postpaint geometry identical to prepaint. They separately report 1,087 native and 1,086 float32 crossings between intentional intersecting components. This is not a welded-solid claim. Fin/tail and spike cap receipts report containment under finite predicates, not exact arithmetic or swept animation containment. The audit explicitly leaves continuousAttachmentCertification false. Tolerances disclosed are plane distance 1e-10, crossing-segment length 1e-9, contact distance 1e-9, and projected coplanar area 1e-12.

There is no runtime, animation, combat readability, physics, performance, material-in-engine, or physical-device acceptance in this review. No source/model edits, builds, renders, browser operations, Git mutations, Sites publication or Mac operations were performed. All new work is confined to this independent review directory.

## Subsequent provenance resolution

The original-renderer qualification above was resolved after this review via immutable checkpoint bytes; see [renderer-provenance-followup.md](renderer-provenance-followup.md) and its [machine-readable checks](renderer-provenance-followup.json). Scene/settings code is identical; changes concern output paths, preserved-frame resumption and receipt provenance only. Original review chronology and scores are preserved.
