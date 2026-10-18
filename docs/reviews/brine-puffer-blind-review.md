# Brine Puffer: independent V67 visual fidelity review

**Status:** `unread` 2026-10-18 — Independent resemblance judgment and bounded macrobody study guidance; no acceptance claim.
**Link:** This report.
**Plan:** driftwood-enemies
**Made by:** Independent visual review, requested by the project coordinator.

## Verdict

**Broadly faithful: yes. Close visual match: not yet.** The model clearly reads as
the approved Brine Puffer, but its proportions and facial construction remain
visibly different. The appropriate shorthand is **approximately 70% resemblance**;
the weighted arithmetic for the subjective category scores is **72%**.

This rating was fixed from an image-only review completed on 2026-10-18 at
approximately 23:03 UTC. No prior ratings or project review reports were read
before judging. The later landmark guidance below does not rescore the candidate.
No gameplay, phone-readability, technical validation, or rendering-success bonus
is included.

## Evidence inspected

Authoritative approved original:

- `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`

Actual Blender hero:

- `tmp/puffer-lowpoly-v67-from-v9/matched-style.png`

All nine actual fixed-camera images in `tmp/puffer-v67-shared-4p2/`:

1. `01-front.png`
2. `02-left.png`
3. `03-right.png`
4. `04-back.png`
5. `05-top.png`
6. `06-elevated-front.png`
7. `07-elevated-left.png`
8. `08-elevated-right.png`
9. `09-elevated-back.png`

These are the exact reviewed inputs, including their temporary capture paths.
The original is 1024 × 1536 pixels; the actual hero is 780 × 960 pixels; each
fixed-camera view is 600 × 740 pixels. No later candidate is covered by this score.

The large original hero and encounter illustration provide the strongest visible
reference. The small alternate-view thumbnails supply limited supporting
evidence. Their implied hidden anatomy is not an exact specification. Top and
rear actual views were inspected for the model's silhouette and consistency,
without inventing a precise reference for unseen surfaces.

## Five-point scales and weighted result

Each category uses the same resemblance anchors:

- **1:** minimal resemblance in the category.
- **2:** loosely related, with major differences.
- **3:** recognizable, with substantial differences.
- **4:** close, with noticeable differences.
- **5:** near-match in directly comparable visible features.

Half-points express judgments between adjacent anchors. They are not calibrated
measurements or probabilities.

| Category | Weight | Score | Direct visual basis |
| --- | ---: | ---: | --- |
| Silhouette and proportions | 35% | 3.5/5 | Swollen body, prominent pale belly, spiked crown, paddle tail and grounded stance match. Side and elevated actual views suggest a longer, flatter-topped torso and more extended feet than the compact, steeply domed impression of the concept. Camera mismatch limits exact inference. |
| Face and expression | 30% | 3.5/5 | Gold eyes, orange angry brows and open triangular mouth preserve the expression. The brows project as long, thin wing-like pieces; the mouth appears smaller and more sharply triangular; the pale face reads more like a broad continuous mask. |
| Defining details | 20% | 4/5 | The principal identifying features are present and correctly associated. The tail is a thinner, flatter paddle with a comparatively uniform orange rim, versus the concept's chunkier, warmer yellow-orange irregular border. Spikes retain the right basic vocabulary. |
| Facets and style | 15% | 3.5/5 | Both are clearly low-poly. The candidate shell has conspicuous horizontal bands and broad regular panels, particularly from the side. The concept has more varied, irregularly oriented facets and stronger local plane changes. |

Arithmetic:

`3.5 × 0.35 + 3.5 × 0.30 + 4 × 0.20 + 3.5 × 0.15 = 3.60/5 = 72%`

The calculation is exact for the selected scores. The visual assessment is not
accurate to individual percentage points, so the headline remains approximately
70%, not a claim of objectively measured 72% fidelity.

## Three most consequential mismatches

1. **Body silhouette:** the long, comparatively low-backed shell gives a less
   compact impression than the reference's high-domed bulk. This is strongest in
   side/elevated views, rather than an exact ratio proven by the mismatched hero
   cameras.
2. **Face construction:** protruding brow wings and the smaller, sharper mouth
   differ despite preserving the correct angry expression.
3. **Shell faceting:** regular horizontal surface bands replace much of the
   reference's irregular, chunky plane structure.

## Highest-impact bounded geometry study

**Compress the posterior teal body shell modestly, keeping the global crown
height unchanged for the first study.** Bring the rear taper forward while
preserving face, pouch and frontal dimensions. Translate attached features with
their roots as needed, without resizing their individual details.

The initial qualitative recommendation also mentioned lifting the crown
transition. Follow-up landmark inspection does **not** establish that the actual
hero's global crown is too low. Therefore a global crown lift is not a justified
first step. Rounding the rear shoulder and reducing posterior stretch is the
better-isolated test. This narrows the experiment; it does not change the score.

The builder's proposed posterior-only compression is an experiment, not approval
of a result. No V69 source or render has been evaluated in this report.

## Reproducible landmark checks

Measure on the original image pixels, with image y increasing downward. Exclude
spikes, tail, limbs, cast shadow and platform when defining the body core.

- **C:** highest point of the teal shell, excluding spikes.
- **B:** lowest visible core/belly silhouette, excluding feet and shadow.
- **R and F:** rearward and forward projected core extrema, excluding appendages.
- **E:** center of the clearly visible nearer iris. Use the same anatomical eye
  across actual before/after renders; do not substitute the eye's highlight.
- **H:** `B.y - C.y`, projected core height.
- **W:** horizontal distance between the two projected core extrema.
- **Q:** `W / H`, projected core aspect ratio.
- **A:** `(E.y - C.y) / H`, crown-to-near-eye share of core height.

For a side image, use its left/right core extrema for W; D/H is the same
projected ratio in that side camera. A surface-to-surface ratio from mesh bounds
is a different measurement and should be labelled separately.

### Approximate hero reading and its limits

These are deliberately rough manual landmarks, not segmentation results:

| Hero | Crown y | Belly-bottom y | Near-eye y | Approximate core width | Q | A |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Original large left hero, 1024 × 1536 image | 472 | 780 | 599 | 340 px | about 1.1 | about 0.41 |
| V67 actual hero, 780 × 960 image | 359 | 741 | 529 | 410 px | about 1.1 | about 0.45 |

Allow roughly 8–12 pixels of manual uncertainty at silhouette landmarks, more
where appendages overlap the body. The approximate Q ranges overlap substantially
(roughly 1.05–1.20 for the original and 1.03–1.15 for V67); A ranges also overlap
(roughly 0.39–0.45 and 0.42–0.47). These are visual uncertainty bands, not
statistical confidence intervals.

The images differ in camera yaw, pitch and possibly perspective. The far eye is
partly occluded in the concept, and the concept's other depictions are not exact
orthographic drawings. These ratios remove image scale, **not camera bias**.
In particular, the large hero alone does not show V67 to have too little crown
above its eyes, nor does it establish an exact amount of depth compression.

### Same-camera before/after study guardrails

Keep camera, framing, pose and scale identical between V67 and the study. Report
raw pixel landmark values alongside each delta. The following are conservative
experimental bounds, not exact dimensions recovered from the concept:

1. **Side compactness:** inspect both side views for an approximately 5–12%
   reduction in projected core W/H as a first study. Report the measured delta;
   a number in this interval does not itself prove improved resemblance.
2. **Front preservation:** keep front-view core width and height within roughly
   3% of V67, with face and pouch mesh dimensions unchanged. Do not conceal body
   growth by changing camera scale.
3. **Hero crown guard:** avoid increasing A by more than 0.03 in the first study.
   Prefer no global crown-height increase. Recheck Q and the visible rear shoulder
   together, because Q alone cannot distinguish desired compression from an
   unwanted narrow or tall body.
4. **Attachment continuity:** inspect rear and elevated views for a pinched tail
   root, detached or buried spikes, abrupt shell planes and collisions at fin
   roots. Fixed feet do not prove that a compressed shell still contains their
   attachment surfaces.

Reject a visually worse result even if its ratios pass. Continue to judge the
actual full shape, not one selected camera or a numeric target inferred from
unseen anatomy. A fresh post-change visual review is required for any new score.

## Scope and preservation

The blind review itself was read-only. This report was subsequently written at
the coordinator's request after reading repository instructions. No model,
production asset, prior review, plan-state file, camera, or render was changed by
the reviewer. No Blender, browser, image generation, or heavy validation job was
started.
