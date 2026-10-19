# Brine Puffer: independent tail-fan study review

**Status:** `unread` 2026-10-19 — Bounded visual accept over V71's tail for continued remaster integration.
**Link:** This report.
**Plan:** driftwood-enemies
**Made by:** Independent visual review, requested by the project coordinator.

## Verdict — 2026-10-19, 01:32 UTC

**Retain the new tail study over the V71 tail for continued integration.** Its
scalloped outline, broader pale/gold rim and fuller teal center are visibly
closer to the approved original. Overall scale remains appropriate in these
paired renders. The back view shows added profile thickness without an obvious
oversized coin silhouette. No open attachment gap or pinched stalk is visible
at the supplied resolution.

This is a tail-only visual decision. It does not assign a new whole-model score,
change the prior V71 assessment, establish owner acceptance or certify runtime
behavior. The original's obscured back/edge anatomy is not an exact thickness
specification.

## Exact evidence

Approved reference already inspected in the ongoing review:

- `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`

All six actual full-model study renders inspected individually:

| View | V71 baseline | New tail |
| --- | --- | --- |
| Hero | `tmp/puffer-tail-study/v71-hero.png` | `tmp/puffer-tail-study/tail-study-hero.png` |
| Side | `tmp/puffer-tail-study/v71-side.png` | `tmp/puffer-tail-study/tail-study-side.png` |
| Back | `tmp/puffer-tail-study/v71-back.png` | `tmp/puffer-tail-study/tail-study-back.png` |

Capture/source checks read:

- `tmp/puffer-tail-study/capture-receipt.json`
- `tmp/puffer-tail-study/source-manifest.json`
- `art/driftwood-isle/puffer-tail-study/render_comparison.py`

The renderer's checked SHA-256 matches its frozen manifest entry:
`f945c925c4d31be0200e70d55392c984ba5af9112f609c07282c36cfd18037bf`.

## Comparison controls

The receipt and renderer use the same camera, lights, ground, materials and
non-tail body objects for each baseline/candidate pair. The render loop changes
only visibility of the old and new `Tail root` objects. Non-tail parts are
constructed once and retained through both variants. No body-shape or camera
change was found in that pairwise procedure.

All six renders are 600 × 740, with 20 samples and the V71 three-light setup.
The orthographic shot definitions are:

| Shot | Position | Target | Scale |
| --- | --- | --- | ---: |
| Hero | `(3, 4.6, 2.25)` | `(0, -0.03, 0.84)` | 3.2 |
| Side | `(5, -0.0575, 0.79)` | `(0, -0.0575, 0.79)` | 4.2 |
| Back | `(0, -5.0575, 0.79)` | `(0, -0.0575, 0.79)` | 4.2 |

The hero's resolution/framing differs from the older 780 × 960 standalone V71
hero. Use the paired captures above for this decision; do not interpret that
presentation difference as a body or tail proportion change. Render noise is
not evidence of a geometry change.

## Visible gains and remaining issues

- **Hero:** the irregular border and thicker warm rim move away from V71's
  uniformly edged, flat paddle toward the concept's chunky fin character.
- **Side:** the teal center has more volume, the lobes are legible, and the fan
  remains a suitable size relative to the unchanged body. A small collar-like
  step remains where the teal neck meets the fan.
- **Back:** the edge is now visibly substantial. It remains fairly uniformly
  pale from this angle, so further thickening would risk turning the fan into a
  slab. The current thickness is sufficient for the study.
- **Support:** there is no obvious gap or severe narrowing in the viewed
  connection. The author reports overlapping closed fan/root components rather
  than a welded union; visual seating is not proof of welded topology or
  animation clearance.

## Bounded correction and integration checks

Keep the current overall fan scale, placement and thickness. If refining it,
smooth the small **teal shoulder/neck-to-fan transition** into a more continuous
taper without moving the inherited pivot or changing the body. Preserve the
scallops and varied rim width rather than making a uniform thick ring.

Favor the reference's warm yellow-gold rim character over a uniformly pale edge,
but compare under the same lighting before judging color. This is a minor
surface/transition refinement, not a reason to reject the present visual gain.

After integration, verify the same hero/side/back appearance and test the actual
tail motion for attachment and body/fin clearance. Keep that technical result
separate from visual fidelity. No animation or runtime claim is made here.

## Preservation

Only this report was created. No study source, model, render, prior assessment,
production asset or other file was changed. No Blender, browser, heavy job or
remote write was started by the reviewer.
