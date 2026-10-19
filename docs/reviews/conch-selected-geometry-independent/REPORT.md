# Selected Conch geometry correction: independent review

## Decision

**Visual threshold passes exactly: 4.05 / 5 >= 4.0.** This is not a rounded 4 and is not inherited from an earlier review. The corrected candidate preserves the fuller face and coherent whole character. Baseline and corrected are tied visually at this rubric's resolution; corrected is the preferred admissible source because it removes the measured sweep faults without a material likeness regression. Geometry tests add **zero** visual points.

**Source/native preparation passes the bounded geometry contract, with one receipt correction required.** This is not runtime, animation, collision, phone-performance, or owner taste acceptance.

## Independent visual sequence and score

Read the exact approved `conch-duelist-lowpoly.webp` first, then all ten corrected raw PNGs individually. Wrote `visual-freeze.json` before inspecting any baseline PNG, prior-review score, or author quality report. Then viewed all ten matched baseline PNGs individually. The original hash is in `verification.json`; view-by-view observations are in `matched-view-notes.json`.

Unchanged weighting: silhouette **4.1 × 35%**, face **4.0 × 30%**, details **4.0 × 20%**, facets **4.1 × 15%** = **4.05**. Independently judged baseline: the same component scores and exact total.

The stepped spiral, flared coral aperture, large shield, long opposite blade, low stance, amber stalk eyes and full salmon mask carry the reference identity. Side/back volume remains credible. The corrected breast mass is narrower and the shoulder caps fuller; neither hollows the face nor disconnects the arms. Shell/face/weapons/legs are visually preserved. Remaining likeness limits: the face is more symmetric and beak-like, the lip more planar, and breast framing denser than the concept. The concept does not determine hidden-side topology.

## Evidence and source-to-native correspondence

- Rehashed all **78** entries in the supplied freeze (inputs plus outputs), including the twenty actual PNGs. Camera receipts match exactly; hero camera/light/sample source block is byte-identical. Nine-view capture driver invokes the original nine-view code, without changing its camera/light/sample settings. No render was made for this review.
- Reconstructed original/corrected source coordinates from original indexed vertices plus the bounded edits. Undid the unchanged shoulder-Z and thigh-X shaping before comparing to the original sweep centerlines. All **36 corrected sweeps** have no opposed radial triangles or opposed strip pairs. Baseline negative control fails on exactly the four breast/shoulder meshes. This is an independently recomputed check, not merely trusting the saved pass flag.
- Decoded GLB checks confirm **47 meshes unchanged**, only four changed, materials exact, and source-indexed oriented triangles preserved despite exporter vertex/index reorder. Both capture GLBs match their frozen source GLBs.
- Independently compared every native expanded position and linear color against decoded GLB primitive/index order: **2,190 triangles**, **6,570 vertices**, **51 meshes / 95 primitives**, **15 bones / 15 parts**. Existing source tests **7/7** and native tests **12/12** rerun successfully with bytecode writing disabled.
- Existing authored open decorative surfaces remain: nostrils, eye sockets/back/lens/slit/glint components. Combined eye shells close. **21 non-opposed cap/facet normal deviations** remain, with minimum normal/facet cosine about **0.102128**. The stricter all-closed/unit-facet diagnostic correctly remains false. No closure or normal repair is inferred or required by this bounded contract.
- The proper-crossing report is hash-verified and its saved result is zero; this review did not rerun a geometric crossing scanner. No fresh Blender/source generation, engine/browser/render/build work, cache creation or runtime promotion occurred.

## Receipt defect and remaining boundaries

`selected-geometry-admission/native/closure.json` incorrectly claims `sourceMeshes: 56` and `sourcePrimitives: 108`. Actual decoded source GLB and mapping are **51 / 95**. Producer is `selected-geometry-admission/export_native.py:278`, where both values are hardcoded. Correct those metadata fields and the producer, preserve the original receipt/hash in correction evidence, and regenerate affected closure/freeze hashes. Do not alter geometry or rescore the visual result for this metadata correction.

The rig pivots are newly derived stations, not authored animation. Native packing retains linear color factors, but Blender and engine shading differ, and GLB double-sided state is not a packed per-part field. Rest-hull dimensions are conservative diagnostics, not admitted collider tuning. Motion, joints under articulation, contacts, engine appearance and phone performance remain unproven.

`verify.py`, `verification.json` and `decoded-glb-verification.json` record the tested pre-metadata-correction state. A subsequent correction intentionally changes pinned hashes; retain this report rather than rewriting its historical result.
