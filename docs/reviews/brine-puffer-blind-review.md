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

## V69 follow-up review — 2026-10-18, 23:12 UTC

The preceding sections remain the historical V67 blind review, including its
score and then-current scope. This addendum separately reviews V69. It is an
independent follow-up using the same rubric, **not a second blind experiment**:
the reviewer knew the bounded change and the prior V67 judgment. No other
reviewer's score was adopted or used as a target.

### Evidence and comparison

Inspected the actual V69 hero:

- `tmp/puffer-lowpoly-v69-from-v9/matched-style.png`

Inspected every actual V69 fixed-camera image in `tmp/puffer-v69-shared-4p2/`:

1. `01-front.png`
2. `02-left.png`
3. `03-right.png`
4. `04-back.png`
5. `05-top.png`
6. `06-elevated-front.png`
7. `07-elevated-left.png`
8. `08-elevated-right.png`
9. `09-elevated-back.png`

Compared with the previously inspected V67 hero and all-nine evidence, reopening
V67 left, top, elevated-left and elevated-back for direct side-by-side-in-sequence
checking. The authoritative original was also reopened with the two heroes.

The builder reported posterior-only compression with fixed global crown height,
face and pouch. Those implementation statements are context, not an independent
mesh audit by this reviewer and not points added to visual resemblance.

### Verdict

**V69 is a modest visible improvement in posterior compactness.** Both side views,
the top and the elevated-rear view show a shorter rear body and less elongated
taper. The hero's rear shoulder is slightly tighter and more upright. The front,
face, belly and distal feet appear substantially preserved.

At the supplied capture resolution, there is no obvious new tail-root gap,
floating spine, exposed fin cap or abrupt open seam. The posterior taper remains
plausible rather than visibly pinched. This is a rendered-view observation, not
a watertightness, clearance, rigging or animation certification.

The crown spines crowd and overlap a little more in `06-elevated-front.png`.
Their screen-space overlap should not be called a detached root or a proven mesh
intersection; neither is established by the picture. It does slightly reduce the
separation of their silhouettes in that view.

The main remaining differences are:

1. The brow wings and sharply triangular, relatively small mouth still give a
   different face construction from the original.
2. The broad upper roof and extended feet still limit the compact, chunky
   impression, despite the improved posterior body.
3. Regular horizontal facet bands and the thin, simply edged tail retain their
   previous style/detail differences.

### Unchanged rubric, separately scoped V69 score

| Category | Weight | V69 score | Change justified by the images |
| --- | ---: | ---: | --- |
| Silhouette and proportions | 35% | 3.5/5 | Modestly improved posterior compactness, within the same half-point band; remaining roof and foot proportions do not justify a full move to 4. |
| Face and expression | 30% | 3.5/5 | No material visible correction to the previously identified face mismatch. |
| Defining details | 20% | 4/5 | Principal details remain; no clear loss or gain large enough for a category change. Attachment seating is not a resemblance bonus. |
| Facets and style | 15% | 3.5/5 | Horizontal banding and regular large panels remain. |

`3.5 × 0.35 + 3.5 × 0.30 + 4 × 0.20 + 3.5 × 0.15 = 3.60/5 = 72%`

The useful shorthand is still **approximately 70% subjective resemblance**.
An unchanged discrete score does not mean the pictures are unchanged: the
improvement is real but smaller than this review's half-point category spacing.
No finer decimal score is invented to advertise the progress.

**Broadly faithful: yes. Close-match or owner acceptance: not established.**
The original's camera and inconsistent/limited alternate views still prevent an
exact hidden-anatomy target. Actual top/rear pictures demonstrate the candidate's
shape, not a precise match to an unseen original.

### Recommendation

Retain the bounded V69 posterior compression for continued work rather than
reverting that improvement. These views do not support further posterior
compression or a global crown lift. The next higher-value isolated study would
be the visibly protruding brow geometry: shorter, thicker, face-hugging wedges,
with eye and mouth geometry held fixed for a clean comparison.

This recommendation is not approval to replace the production asset, an owner
taste decision, or a claim that the candidate passed a separate acceptance gate.
No new render, model change, browser action or heavy process was run by the
reviewer for this addendum.

## V70 follow-up review — 2026-10-18, 23:21 UTC

### Exact evidence and scope

Inspected `tmp/puffer-lowpoly-v70-from-v9/matched-style.png` and every actual
fixed-camera image in `tmp/puffer-v70-shared-4p2/`: `01-front.png`, `02-left.png`,
`03-right.png`, `04-back.png`, `05-top.png`, `06-elevated-front.png`,
`07-elevated-left.png`, `08-elevated-right.png`, and `09-elevated-back.png`.

Compared directly with V69's actual hero and previously reviewed nine views,
reopening its left, elevated-front and elevated-back images for the principal
risk checks. Reopened the approved original alongside the V70 hero. This is a
follow-up review with knowledge of the brow change, not a new blind review. The
V67 blind score and the separate V69 result remain unchanged.

### Verdict and profile risks

**V70 is a small net brow improvement worth retaining for continued work.** The
hero, front and elevated-front views show shorter, thicker orange wedges with
less raised outer-wing emphasis. The eye hood, visible aperture and angry
expression appear preserved. The brows still do not fully reproduce the
original's squat, forehead-seated impression.

Both side views retain a small **block-like top cap**. Elevated-back exposes
broader orange corner faces than V69. These are visible tradeoffs, not features
to hide behind the improved hero. They do not, at this scale, amount to a severe
regression: no obvious detached rear tab, folded strip, thin splinter or open
seating gap is visible. Render inspection cannot certify unseen internal
topology or establish exact brow depth from the concept's mismatched camera.

The posterior compactness gain from V69 remains. The broad pale face, sharp
mouth construction, extended forefeet, regular mantle bands and simply edged
tail retain their previously identified differences.

### Separately scoped V70 score

| Category | Weight | V70 score | Evidence-based change |
| --- | ---: | ---: | --- |
| Silhouette and proportions | 35% | 3.5/5 | V69's compactness gain retained; no new whole-body correction. |
| Face and expression | 30% | 3.5/5 | Small brow improvement with profile-cap tradeoff, still within the same half-point band; the remaining face construction does not justify 4. |
| Defining details | 20% | 4/5 | Principal details remain; no material category change. |
| Facets and style | 15% | 3.5/5 | Local brow planes improve volume, but the dominant mantle-band mismatch remains. |

`3.5 × 0.35 + 3.5 × 0.30 + 4 × 0.20 + 3.5 × 0.15 = 3.60/5 = 72%`

This remains **approximately 70% subjective resemblance**, broadly faithful but
not yet a close-match or owner-accepted result. The useful local improvement is
smaller than the rubric's half-point category spacing; neither topology validity
nor completing a render set supplies an automatic score increase.

### Recommendation

Keep V70 as the current controlled study and avoid another tiny brow-depth pass
on this evidence. Regular mantle bands and extended forefeet are now clearer
whole-character targets than further brow thickening. Do not deepen the cap or
extend a rear tab in pursuit of a score threshold. Any next change should be
visibly justified against the original and checked across the same actual views.

No model, render, production asset or other review was changed by this reviewer;
only this dated addendum was written. No heavy job was started.

## V71 follow-up review — 2026-10-19, 00:12 UTC

### Exact evidence and scope

Inspected the actual hero at
`tmp/puffer-lowpoly-v71-topologyaudit/matched-style.png` and all nine actual
fixed-camera images in `tmp/puffer-v71-shared-4p2/`:

1. `01-front.png`
2. `02-left.png`
3. `03-right.png`
4. `04-back.png`
5. `05-top.png`
6. `06-elevated-front.png`
7. `07-elevated-left.png`
8. `08-elevated-right.png`
9. `09-elevated-back.png`

Reopened the approved original and V67/V70 actual heroes for the preliminary
hero comparison. For the full review, compared with the previously inspected
V70 nine-view set and reopened its left, elevated-front, elevated-left and
elevated-right views to check the targeted plane changes directly. The original
remains `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`.

This is a follow-up review with knowledge of the bounded flank-faceting change,
not a fresh blind experiment. All previous assessments remain unchanged. Reports
of topology, containment and fixed-camera guards passing are separate technical
evidence; they supply no visual-resemblance bonus and were not independently
audited as part of this image review.

### Preliminary hero judgment, retained

The actual hero justified the full nine-view capture. Its forehead/upper-flank
planes were less horizontally banded and more irregular than V70, a modest move
toward the original. Some broad triangular patches still read as large plates.
Face, silhouette and visible attachments appeared preserved, without an obvious
new crease, hole or detached feature. No score or full-view acceptance was
assigned from that hero alone.

### Full-view verdict

**V71 is a small net improvement over V70, but the principal flank-band mismatch
remains.** Top and elevated views confirm more diagonal crown planes and less
continuous upper-strip structure. Both profiles and elevated sides still show
broad horizontal flank bands. Some new crown triangles form a center-led radial
pattern, rather than the original's more varied, chunky plane changes.

At the supplied capture resolution, no obvious new flute, open seam, floating
spine, exposed fin cap, attachment-support gap or silhouette regression is
visible. Face and expression appear preserved. This is an observation across
the actual rendered views, not certification of unseen internal geometry,
collision clearance or animated behavior.

The original and actual hero cameras differ. The concept's limited alternate
views are not exact orthographic anatomy specifications. Top/rear comparisons
therefore do not invent a precise hidden original surface.

### Separately scoped V71 score on the unchanged rubric

| Category | Weight | V71 score | Evidence-based reason |
| --- | ---: | ---: | --- |
| Silhouette and proportions | 35% | 3.5/5 | Earlier compactness improvement retained; no new whole-character proportion correction. |
| Face and expression | 30% | 3.5/5 | The face appears preserved; the prior face-construction differences remain. |
| Defining details | 20% | 4/5 | Principal details remain visibly supported; no material category change. Technical support checks are not a bonus. |
| Facets and style | 15% | 3.5/5 | Localized diagonal crown-plane improvement, but broad side bands and large regular patches remain; the gain stays within the same half-point band. |

`3.5 × 0.35 + 3.5 × 0.30 + 4 × 0.20 + 3.5 × 0.15 = 3.60/5 = 72%`

The visual judgment remains **approximately 70% subjective resemblance**. The
weighted arithmetic is exact for these chosen category scores; it is not an
objective 72%-precision measurement. No score was forced upward to meet a gate,
and the unchanged category band does not erase the small visible improvement.

**Broadly faithful: yes. Close match or owner acceptance: not established.**

### Recommendation and preservation

Retain V71 for continued work without claiming that the flank-band issue is
solved. Further work should target a directly visible remaining mismatch, rather
than merely add triangles or optimize a score. Check both profiles and elevated
sides whenever claiming improvement to the flank plane structure.

Only this report was appended. No previous assessment, model, production asset,
render, other file or remote state was changed by the reviewer. No heavy job was
started.
