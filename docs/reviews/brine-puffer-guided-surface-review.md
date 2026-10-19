# Brine Puffer: V71-guided surface foundation review

**Status:** `unread` 2026-10-19 — Retain the local front/pouch retopology as a foundation for face integration.
**Link:** This report.
**Plan:** driftwood-enemies
**Made by:** Independent visual review, requested by the project coordinator.

## Verdict — 2026-10-19, 01:46 UTC

**Retain the supported-surface foundation.** All three matched clay comparisons
preserve V71's rounded body, full lower pouch and hooded angry face. There is no
visible return to the rejected blockouts' rectangular front slab or receding
pointed chin. The side pouch profile remains full; face placement and appendage
silhouettes show no obvious regression.

This is a usable local topology foundation, not a demonstrated finished
remaster gain. The new patch breaks up V71's broad central pouch plate, but some
smaller triangular wedges and the lower-front junction look busy. Roof/flank
bands remain inherited. Continue face integration without another anatomy
restart, retaining the current pouch fullness and established facial landmarks.
Aim for a few deliberate cheek and pouch planes wrapping around that volume,
rather than more fragmented triangulation.

No whole-body score, owner acceptance, runtime or animation claim follows from
this clay study. Missing albedo and finished materials are not penalized.

## Comparison scope and evidence

First inspected the candidate alone and reported provisional retention with an
explicit missing-baseline caveat. Then inspected every exact matching V71 clay
frame before the verdict above. The baseline resolves that evidence gap; it
does not turn technical guard passes into an artistic improvement.

Approved original:
`art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`.
Its visible rounded pouch, hooded face and chunky planes guide this judgment.
Different reference perspectives and implied hidden anatomy are not treated
as exact dimensions.

Actual images, all individually inspected:

- `tmp/puffer-remaster-guided/v71-matching-clay/clay-hero.png`
- `tmp/puffer-remaster-guided/supported-surface/clay-hero.png`
- `tmp/puffer-remaster-guided/v71-matching-clay/clay-front.png`
- `tmp/puffer-remaster-guided/supported-surface/clay-front.png`
- `tmp/puffer-remaster-guided/v71-matching-clay/clay-side.png`
- `tmp/puffer-remaster-guided/supported-surface/clay-side.png`

The two renderer sources were read. Both use 600×740, 24 samples, no denoising,
AgX, the same neutral clay material and three-light settings. Both use target
`(0, -0.03, 0.84)`, orthographic scale `3.2`, radius `5`, and yaw/elevation pairs
hero `(32.94, 14.34)`, front `(0, 0)`, side `(90, 0)`. This supports a direct
pairwise surface-shading comparison rather than comparing clay to colored V71.

Source and render receipts in `art/driftwood-isle/puffer-remaster-guided/` were
read. The preflight reports 215 original patch triangles replaced by 131,
protected boundaries, exact outside-patch geometry and unchanged face
assemblies/appendages. Maximum reported source-depth deviation is 9.44 mm;
volume changes from 1.0566598 to 1.0559035, approximately -0.072%. These are
reported engineering checks, not independently rerun measurements or score
bonuses. Earlier failed-patch receipts remain historical evidence.

Verified source SHA-256 values:

- `build_guided_surface_supported.py`:
  `43fe5079040261ab7b4b7b1f440df2c8678ed9cb43d4a52ecb0b564a1c8d6b09`.
- `render_v71_matching_clay.py`:
  `c52b03cd55b194d432b44e9e242390aaa44b2be10140d8e04538861b7099164c`.

## Next visual gate

Compare the integrated orbital/cheek/beak/lower-lip study against this retained
foundation and the original at the same hero/front/side cameras. Require a
clearer connected hooded expression and deliberate broad planes, with no
flattening of the pouch, recessed chin, detached brow tabs or mouth-slab return.
Only then judge a full colored candidate across the remaining views.

## First connected orbital stage — 2026-10-19, 01:58 UTC

**Reject the current orbital shape before mouth integration.** Preserve the
connected-topology approach, with the supported-surface foundation as the
visual fallback. The new hood is more continuous with the body, but hero/side
introduce long triangular forehead/temple ridges running back toward the crown.
The front reads as a broad blocky visor. These shapes are farther from the
approved reference's short, thick angry brow wedges. The eyes feel less sharply
hooded even though pupils remain visible.

One bounded correction: rebuild each upper hood as a compact diagonal ridge
immediately above its eye. Preserve the prior inward-descending lid-cover line
and the connected socket boundary, while blending the upper/rear bridge back
onto the original mantle. Remove the crownward peak and radiating triangle,
rather than merely shortening its tip. Inspect the same clay views before
color or mouth work. No whole-model score is assigned.

Actual candidate views inspected individually:

- `tmp/puffer-remaster-guided/integrated-orbital-clay/clay-hero.png`
- `tmp/puffer-remaster-guided/integrated-orbital-clay/clay-front.png`
- `tmp/puffer-remaster-guided/integrated-orbital-clay/clay-side.png`

Each was compared directly with its `supported-surface/` counterpart listed
above; the exact V71 matching clay comparison remains available and was already
inspected. The orbital render receipt and renderer were read. The same
camera/light/clay settings are used. Reported connected-hull, attachment and
final-pupil-visibility guards do not override this visual rejection.

## Compact orbital correction — 2026-10-19, 02:01 UTC

**The long temple horns are improved, but do not advance to mouth work yet.**
The compact connected cage is worth keeping as a working branch; the
supported-surface remains the visual fallback. Hero is cleaner and the
crownward peaks are gone. Front still has nearly level, thin lid bars and more
exposed round eye rims, producing a tired/sleepy read compared with the
baseline's sharply angry hood. Structural and pupil-visibility passes cannot
establish the intended expression.

One next correction: recover the supported-surface's stronger outer-high,
inner-low brow underside immediately above each iris, with a short thick upper
wedge. Preserve pupil visibility without keeping the whole lid edge nearly
horizontal. If the current aperture enforces that weaker line, reshape it
rather than treating the aperture as an artistic invariant. Keep the improved
compact temple transition; do not recreate the crownward horn.

All three actual views in
`tmp/puffer-remaster-guided/integrated-orbital-compact-clay/` were inspected:
`clay-hero.png`, `clay-front.png`, `clay-side.png`. Hero/front were compared
directly with the supported-surface and the rejected tall-orbital hero was
reopened; the previously inspected side baselines supply the same comparison.
Mouth geometry is unchanged in this stage. No full-model score is assigned.
