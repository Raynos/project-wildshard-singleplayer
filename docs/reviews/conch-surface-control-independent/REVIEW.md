# Independent Conch source-surface control review

2026-10-20. Complete nine-angle REST transport and appearance review. **Transport control passes at the captured resolution; appearance is not accepted.** This is the retained selected-view attempt3 diagnostic host, not current Arena Conch4. No animation, gameplay, contact, phone-performance, owner-taste or production admission claim follows.

## Verdict

The actual native SkinnedMesh carrying the source material/normal/group contract agrees visually with the raw source GLB in every captured view. Silhouettes, aperture planes, color-region boundaries, tools and limbs match. No coherent surface-region mismatch remains visible between those two variants at 402×874. The remaining pixel differences are sparse, not a residual broad palette or cavity-shading failure.

This does **not** reproduce the authoritative hero. Both source-contract native and raw source remain ochre/orange and dark red, with a small, deeply shadowed face beneath a dominant horizontal shell lip. Cleaner cavity/body planes help inspection, but do not restore the concept's pale face, confident amber stalk-eye expression, cream/coral separation or expansive stance. Stop this transport experiment here. Do not promote the 95-group adapter or open another tint/filter sweep on the strength of parity. A later source-shape or world-presentation correction needs its own scope and comparison.

## What I inspected and verified

Read AGENTS.md, docs/process/GIT.md, the native-likeness diagnosis, prepare.py, adapter.mjs, capture.mjs, analyze.py and the retained comparison wrapper. Opened the authoritative original, including both depicted characters, and **all 36 individual full portrait PNGs**: baseline-native, source-contract-native, raw-source and restored-baseline for front, left, right, back, top, diag-front, diag-left, diag-right and diag-back. The nine-view JPEG boards were not substituted for individual images.

Independently recomputed SHA-256 for every captured PNG, every referenced shader, the three pinned preparation/capture scripts and transport.json. All match the receipt. Independently checked every quartet's recorded lights, rig, frozen clocks, shadow state, renderer, composer and camera equality; actual draw cameras agree too. All observed selected draws cast and receive shadows. Candidate and raw-source have 95 selected draw observations and matching named material-state dictionaries; baseline/restored have one. These are selected-draw diagnostics, not a scene draw-budget or speed measurement.

All nine baseline/restored PNG pairs are byte-identical. The recorded final restoration reports original geometry/material references restored and original attribute arrays unchanged. Host-before equals host-after; additionally, I hashed all 139 inventoried files in the retained host and verified their present bytes against that inventory. This corroborates the receipt, not a fresh browser replay. No build, render, source edit, Git operation or publication was performed by this reviewer.

Pinned identifiers:

- Original hero SHA-256: `90073e7f4eae70b1e135c87740325d6a7a7da94c67cf761b03c5184c507a65cb`.
- Source GLB identified by the transport: `21a6fd0d5e300c58952408913c69824228304141daab461fcb0122a388e27f1a`.
- Evidence report SHA-256: `c73bb5503c7834c08f0f0aee24095a6f2af4b395de61eb176bf3f1defdbd54a5`.
- Retained host receipt SHA-256: `6b9375aa5b718f1c52ea10a0bfb04b3c16f9e066fecd8c693e06cdb4e3bdb00a`.

The preparation logic reconstructs ordered expanded attributes and all 95 primitive groups from the pinned source and mapping, checks complete non-overlapping vertex coverage, and asserts 6,570 vertices/14 materials. The adapter clones native geometry, restores source normals, uses cloned GLTFLoader materials with vertex colors disabled, and retains the native rig/positions/skin attributes. Recorded setup checks assert 19,710 exact position and normal components and 26,280 exact components of each skin attribute. Its maximum measured REST displacement is 0.000024323510820282833 m. I inspected this proof and corroborated capture state; I did not independently reimplement the GLB decoder or rerun skinning. These distinctions matter: the strong independent result here is complete visual comparison plus receipt/state/pixel verification, not a second claimed end-to-end execution.

## Nine-angle observations

Every row refers to all four actually opened frames. In every case the restored baseline repeats the original baseline, and candidate/raw source agree visually.

| View | Transport comparison and appearance observation |
| --- | --- |
| Front | Candidate/raw clean up the conspicuous baseline stippling across the inner shell/face. The gold rim, dark red aperture, two narrow eyes, shield and blade have matching positions and regions. Face remains small, red and partly swallowed by the aperture; armor merges into the dark torso. |
| Left | The tall stepped shell and projecting shield match. Candidate/raw show the same warmer, more finely shaded broad shell plane and cleaner leg surfaces. Most facial identity is occluded; the shell/body balance remains very top-heavy. |
| Right | Blade, bent legs, aperture edge and rear shell match. Candidate/raw reduce baseline body noise without altering the narrow side silhouette. Face is naturally hidden; this angle cannot certify facial likeness. |
| Back | Shell bands and broad rear facets match, as do the short visible limbs. Candidate/raw improve body-plane separation relative to baseline, but retain a strongly orange shell and dark torso. Unseen concept rear anatomy is not a known reference. |
| Top | Candidate/raw have matching central shell planes, rim, spire and shield. Baseline uses a visibly different broad planar tonal pattern. Source-contract surfaces still have fine tonal/shadow texture: this is not universal noise elimination. Face is hidden, and this view establishes construction consistency, not hero likeness. |
| Diag-front | Cleanest evidence of the cavity change: baseline's fine red pattern yields to shared candidate/raw red planes. Broad shell overhang, compressed face/beak, eye placement and tools remain the same. Better surface fidelity does not create the original's open, pale facial focal point. |
| Diag-left | Candidate/raw agree on the foreshortened whorl, long rim edge, narrow visible body and bright shield. The shell shows the same fine tonal texture in both; baseline's different facet brightness is not proof of better likeness. |
| Diag-right | Tall shell, thin blade and segmented leg silhouettes match. Cleaner candidate/raw body shading leaves the shell-dominated, narrow body presentation unchanged. |
| Diag-back | Candidate/raw agree on the foreshortened shell mass and band boundaries. A shared granular tonal treatment is visible on broad shell planes, while the small dark body remains subordinate. This is a parity observation, not a claim about the unseen hero back. |

## Independent residual measurements

Recomputed from original PNG RGB bytes, without resizing, rendering, tuning or changing images. Channel values are 0–255. “Over 8” counts pixels where any channel differs by more than 8. There are 351,348 pixels per image.

To avoid hiding the character difference inside a large unchanged room, I also computed a warm-color union mask across candidate/raw: R > B + 15 and R > 1.1G in either image. It is a useful character-region heuristic against this blue room, **not** a true segmentation, silhouette score or quality measurement. The masked character height spans 131–292 pixels depending on angle.

| View | Different pixels | Pixels over 8 | Max channel difference | Warm-mask pixels | Warm-mask RGB MAE |
| --- | ---: | ---: | ---: | ---: | ---: |
| front | 37 | 5 | 37 | 26,453 | 0.0052924054 |
| left | 28 | 3 | 43 | 20,036 | 0.0036434418 |
| right | 28 | 5 | 63 | 15,651 | 0.0068366239 |
| back | 52 | 3 | 45 | 24,470 | 0.0049856968 |
| top | 16 | 0 | 7 | 13,801 | 0.0015940874 |
| diag-front | 54 | 11 | 34 | 24,265 | 0.0062366921 |
| diag-left | 37 | 4 | 99 | 17,487 | 0.0129048245 |
| diag-right | 26 | 1 | 70 | 14,856 | 0.0043977742 |
| diag-back | 56 | 10 | 92 | 19,654 | 0.0128896577 |

Total: 334 changed pixels across 3,162,132 image pixels; 42 exceed 8 in any channel. Thus this is not exact pixel identity. The largest single-channel residual is 99 at diag-left pixel (x145,y387); diag-back peaks at 92 at (x267,y357). High maxima at a few pixels must not be described as zero difference, but they do not form visible mismatched broad surfaces in these views. Two differing pixels fall outside the heuristic warm mask. Baseline-versus-raw warm-region MAE ranges from 7.7066747313 to 16.9914015893, establishing that the control is not merely comparing two unchanged baseline copies.

Native skinning versus separate source mesh transforms, float precision, draw ordering and shadow/raster edge sensitivity are plausible contributors to the sparse residuals. The measured tiny REST skin displacement is relevant context, **not** an isolated causal proof. No counter-experiment identifies the cause of each pixel. This limitation does not prevent the captured-resolution visual transport verdict; it prevents a bit-exact or all-view/all-renderer guarantee.

## Fresh likeness judgment, separate from transport

There are nine genuine matched views, sufficient for a fresh static presentation assessment. This review is **not blind**: the diagnosis and earlier scores were available before scoring. The original concept remains the reference; raw-source parity earns no likeness points. Back/top receive no invented-reference credit.

For source-contract native as actually shown in this retained host:

| Criterion | Weight | Score / 5 | Reason |
| --- | ---: | ---: | --- |
| Silhouette | 35% | 3.5 | Spiral shell, shield and opposed blade are recognizable; broad bonnet-like lip and compact body/stance weaken the original's ascending shell and expansive duelist posture. |
| Face | 30% | 2.5 | Cleaner cavity makes the stalk eyes and pointed face easier to inspect, but the face remains small, dark/red and compressed rather than the clear pale focal point with separated amber eyes. |
| Details | 20% | 3.25 | Tools, shell bands and joint segmentation survive. Maroon armor, claws, feet and cheek/beak transitions lack the original's clean hierarchy at this size. |
| Facet/color treatment | 15% | 3.5 | Real planar shell construction reads and source material regions are coherent. Ochre/orange/dark red is still unlike the cream/coral/maroon concept; some fine shared shell texture remains. |

Exact weighting, without rounding: **3.5 × 0.35 + 2.5 × 0.30 + 3.25 × 0.20 + 3.5 × 0.15 = 1.225 + 0.75 + 0.65 + 0.525 = 3.15/5 = 63/100.** Raw-source is visually tied for this rubric at these captures. No numerical baseline rescore is assigned, and no measured improvement/regression is inferred against another reviewer's 3.2375 or 2.95.

The prior **4.05** belongs to selected geometry under Blender studio presentation. It is not a runtime score to inherit or a controlled starting value to subtract from 3.15. Source-contract native and raw-source already share the weaker native arena presentation; that is positive evidence against explaining the whole discrepancy as native transport corruption. It does not isolate whether remaining deficits are authored geometry, lighting, framing or their interaction.

## Scope and stopping condition

Captures use the retained diagnostic's fixed REST pose, nine diagnostic cameras, perspective room composition and actual composer under muted cloud Chromium/SwiftShader, with 402×874 output and device scale factor 1. This is not a physical iPhone/Safari test, actual gameplay camera sampling, motion review, animation admission or performance reading. Face-scale limitation and a single illustrative original constrain the likeness judgment. Full authored-surface restoration changes several factors together, so it does not attribute benefit separately to normals, material model, sidedness, roughness, tint removal or vertex-color removal.

The bounded transport question is answered: **source-equivalent surface appearance is achieved on the retained native rig at REST, and that appearance is still not a hero-quality acceptance.** Preserve all existing evidence and the current product. Do not ship this diagnostic material arrangement, claim recovered Blender quality, or expand the experiment into relighting/model edits without a separately scoped next task.

Evidence root: `art/driftwood-isle/approved-conch/source-surface-transport-diagnostic/`. Authoritative original: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/conch-duelist-lowpoly.webp`. This review is the only file written by this reviewer.
