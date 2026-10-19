# Brine Puffer: independent spike-hierarchy review

**Status:** `unread` 2026-10-19 — Weak preference to retain the subordinate-spike study for integration.
**Link:** This report.
**Plan:** driftwood-enemies
**Made by:** Independent visual review, requested by the project coordinator.

## Verdict — 2026-10-19, 01:56 UTC

**Retain with a weak preference over V71.** Shorter subordinate crown spikes
make the main crown wedge read more clearly, especially from the front.
Hero/elevated-side retain a coherent chunky low-poly silhouette. The unchanged
cream material remains consistent with the model; no paint or lighting change
explains the comparison.

Shoulder changes are close to a visual tie. Several flank spikes still read as
small diamond-like chips rather than the larger chunky wedges visible in the
approved hero. This is modest hierarchy cleanup, not a substantial overall
resemblance gain or a reason to revise the whole-body score.

No obvious new floating cap appears at the supplied resolution. That does not
resolve the explicitly retained root-exposure exceptions below. Owner
acceptance, animation and runtime quality are outside this review.

## Direct visual findings

- **Hero:** The dominant crown point is easier to distinguish from its nearby
  smaller satellites. The flank still has relatively small pale accents.
- **Front:** Less overlapping crown detail gives a cleaner main triangular
  point. The body, brows, face and stance show no pairwise framing change.
- **Elevated-side:** Broad wedge surfaces remain readable; no obvious new
  splinter or detached spike appears. Broader roots do not create a major
  visible shoulder-scale improvement in this view.

The approved reference supports a hierarchy of large crown/shoulder wedges and
smaller accents. Its differing projections do not define exact hidden spike
positions or counts. Preserve the primary asymmetry; do not add invented
spikes or keep shrinking satellites simply to exaggerate the hierarchy.

## Evidence and comparison controls

Approved original, reopened for this review:
`art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`.

All six actual PNGs inspected individually:

- `tmp/puffer-spike-study/v71-hero.png`
- `tmp/puffer-spike-study/spike-study-hero.png`
- `tmp/puffer-spike-study/v71-front.png`
- `tmp/puffer-spike-study/spike-study-front.png`
- `tmp/puffer-spike-study/v71-elevated-side.png`
- `tmp/puffer-spike-study/spike-study-elevated-side.png`

Read the renderer, builder, capture receipt, pre-render source pins, output
closure and structural audit in `art/driftwood-isle/puffer-spike-study/`.
The renderer toggles baseline/study consolidated core objects while sharing
other body parts, floor, camera and lights. A separate read-only JSON comparison
confirmed other parts and core non-position fields are exact; all changed
position scalars lie in the six declared subordinate-spike ranges.

Settings: 600×740, 20 samples, no denoising, AgX, V71 three-light setup. Camera
positions / targets / orthographic scales:

- Hero: `(3, 4.6, 2.25)` / `(0, -0.03, 0.84)` / `3.2`.
- Front: `(0, 4.9425, 0.79)` / `(0, -0.0575, 0.79)` / `4.2`.
- Elevated-side: `(3.869, -0.0575, 3.956)` / `(0, -0.0575, 0.79)` / `4.2`.

Verified renderer SHA-256:
`34b2d461468c3b116fdf6c141bb798075fe4d1dbb2583b2e989e19fc90b9514b`.
Recorded candidate-native SHA-256:
`f49fb808735792d5945d8ac2991e89c5e8f013b4e4e8dcfe6ee51cfc189e90dd`.

The audit reports at least 2 mm sampled burial for the six changed roots. The
exactly preserved primary has an inherited approximately +6.20 mm exposed
corner; the hidden rear accent retains approximately +34.43 mm exposure.
These exceptions remain exceptions, not certified buried caps. The clearance
tests were read, not rerun, and provide no artistic score bonus.
