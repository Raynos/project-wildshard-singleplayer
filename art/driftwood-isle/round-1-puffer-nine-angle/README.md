# Brine Puffer: nine-angle Model Explorer mockups

AI art-direction targets, **not game captures**. Primary identity reference: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`.

## Status

- **A: REJECTED camera layout.** Duplicated elevated-side bearing; elevated front/rear are three-quarter.
- **B: REJECTED camera layout and anatomy.** Elevated front/rear are three-quarter; multiple fan-tail-like structures invented.
- **C: recommended review basis, not approved or numerically camera-certified.** Corrected centred elevated front/rear and opposite elevated sides. Near-top pedestal and slight camera drift remain. Read all candidate QA files.

The requested nine-view order comes from `docs/design/LOOK-LOOP.md`: front, left, right, back, top, elevated front, elevated left, elevated right, elevated back. `cameras.json` adapts that world-area method to a subject-centred model dome; these are intended camera specs, not measured properties of generated images. The square model viewport within each portrait card prevents the very distant framing that the full phone aspect would require.

`camera-plan.jpg` is spatial grounding, not a visual creature target. All three prompts and compact boards are preserved. Full original generated PNGs remain under `tmp/puffer-nine-angle-mockups/`, separate from compact repository previews. Every preview is below 500 KB.

The approved source already includes small front/side/rear thumbnails. Hidden spike roots, underside, and tail attachment remain inferred; their depiction is proposed rather than separately approved. The incomplete stripped V16 build was not used. No model implementation, runtime wiring, numeric performance claims, commits or publication are part of this artifact generation.

## Camera convention correction and individual views

The final spec and diagram use screen-facing names: LEFT is a left-facing profile, so camera +X for a creature facing +Z; RIGHT is camera -X. This supersedes the preliminary diagram used in A/B/C generation, retained in tmp for provenance. Intended numeric cameras remain approximate in all AI images.

Individual regenerated views 04 BACK, 05 TOP and 06 ELEVATED FRONT preserve C as the common appearance basis; see their prompts and QA. View 05 improves the overhead pedestal geometry. View 06 was regenerated to a distinctly steeper elevated head-on view, then locally corrected to remove invented bilateral fan-tail structures; failed originals remain in tmp. No geometric reconstruction accuracy is asserted.
