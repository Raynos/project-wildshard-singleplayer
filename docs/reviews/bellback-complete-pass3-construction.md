# Bellback complete-pass3 construction

Status: complete static art candidate; independent likeness review pending.

## Scope

This is a substantial integrated geometry pass derived from complete-pass2. It keeps the existing bell shell, cavity, clapper and high arch, while rebuilding the remaining identity gaps against the approved original `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`.

- Removed the head-depth compression and rebuilt a longer downward-projecting skull, face keel, broad swept brow blades and lower cheek anatomy.
- Replaced the continuous ivory W-shaped jaw with eight separated broad pointed teeth, rooted in the upper/lower jaw with dark gaps. Restored two short ivory crown splinters.
- Added large tapered outer shoulder shields that overlap the foreleg anatomy, rather than surface ornament.
- Replaced two evenly sparse carrier uprights per side with three unequal ribs and broad overlapping broken side strakes, plus rooted diagonal stern planks. The carrier remains open around the bell, but has a denser irregular shipwreck mass.
- Retained independent semantic rigid pivots for head, body, bell and four legs. These are editable animation preparation only, not tested clips, a skeleton or ragdoll acceptance.

## Preservation and boundaries

Complete-pass2 and selected V6 are unchanged. Every pass3 attempt is retained. No runtime, AI, physics, Site, STATE, top-level build script, commit or remote changes are part of this pass. The proposed five-body ragdoll architecture remains pending and is not implemented here.

## Evidence

Editable source and evidence live in `art/driftwood-isle/lowpoly-bellback/complete-pass3/`. Actual full-resolution captures and render logs live in the ignored `tmp/bellback-complete-pass3/` directory. The capture script uses the same hero and nine-view cameras, light positions, resolution, samples and color settings as complete-pass2. Baseline full PNGs are reused only after verifying their recorded hashes and matching camera/light parameters.

## Verified result

- Actual hero plus nine orthographic views completed. All ten candidate PNGs were inspected individually.
- Ten paired before/after boards verify the preserved complete-pass2 PNG hashes and exactly matched cameras, targets, orthographic scale and lights.
- Native GLB: 365,744 bytes, 4,794 triangles, 90 meshes, 15 materials, seven semantic rigid pivots. Zero external asset dependencies, finite attributes and valid index bounds.
- Closed component check: zero non-manifold edges and zero zero-area faces. Ground minimum Z is exactly zero. The capture framing guard passed every view.
- Hero, nine-view and packaged GLBs are byte-identical. All preview images are below 250 KB and boards below 500 KB.
- Single pass3 attempt succeeded; no failed attempts were deleted. Source derivation remains alongside the standalone editable generator.
- Source SHA256: `f3f285d3463c21e922d0de8a7a9683326902df72ae00763c5f42ccfeeaa55040`.
- GLB SHA256: `7f5f31a1c39dc4a7768d012d485bca996c927585c87bc6876fee625ec16ea796`.

`closure.json`, `paired-captures.json`, `structural-audit.json` and `validation.json` hold the evidence receipts. `comparison-board.webp` compares the approved original and actual candidate; `paired-hero-board.webp` compares actual complete-pass2 and pass3. `nine-view-board.webp` gives the complete view set.

## Review limits

The face is intentionally substantially longer, and the new overlapping shoulder panels and denser frame materially change the silhouette. Those choices need independent visual judgment against the approved original. The side and back anatomy are inferred because the original does not show every view. Separate tooth solids do not by themselves prove visual tooth readability in every projection. No self-score is assigned, and no claim is made that the all-five target has been reached. No runtime, animation, performance or physics acceptance follows from these checks.
