# Puffer closed-anatomy study: independent static review

2026-10-19. **Prefer closed-anatomy-study over matched pass2, but do not accept it.**
Candidate exact weighted score: **3.6375/5**. Fresh pass2 score: **3.5975/5**.
These are subjective rubric judgments; decimal arithmetic is not perceptual
measurement precision. No rounding to an acceptance threshold is permitted.

## Visual finding

Closed anatomy makes the cream pouch slightly less block-like and better tapered
than pass2. The gain is small. The recognizable angry eyes, orange brow, pointed
mouth, cream spikes and teal/orange tail preserve the character. Across the full
nine views, however, the forefeet remain shallow long flippers, the rear supports
read as narrow tall cones, the cream pouch dominates as a wide angular mask, and
large regular crown bands lack the primary original's more purposeful interlocking
planes. These are likeness limitations visible in actual renders, independent of
technical closure results.

Next priorities: give the feet compact three-dimensional volume and less uniformly
repeated pale toe wedges; restore the original's rounder pouch and integrated face
planes; replace crown courses with broad irregular purposeful facets while keeping
spine roots seated. Preserve the current expressive eyes and connected tail.

## Method and scope

The authoritative original was
`art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`.
Its large left figure is primary; small hidden-angle thumbnails are approximate.
I inspected that original, then each of the ten candidate PNGs separately, froze
candidate observations and scores, and then inspected every matched pass2 PNG.
No contact sheet, generated replacement image, or preview substitute was used.
All captures reside under
`art/driftwood-isle/puffer-complete-remaster/closed-anatomy-study/captures-final/`.
Names are `closed-anatomy-` or `pass2-` plus `hero`, `01-front`, `02-left`,
`03-right`, `04-back`, `05-top`, `06-elevated-front`, `07-elevated-left`,
`08-elevated-right`, `09-elevated-back`, with `.png` suffix.

Weights stayed silhouette 35%, face 30%, details 20%, facet 15%.
Candidate component scores: 3.70, 3.70, 3.65, 3.35.
Pass2 component scores: 3.65, 3.65, 3.65, 3.30.
`candidate-frozen.json` and `predecessor-comparison.json` record each view.
The selection is only between these two actual complete sets, not a claim that
all historical versions were inspected or ranked here.

**Procedure limitation:** an original-location grep unexpectedly exposed historical
V23–V68 review scores before rubric freeze. No candidate/pass2 score was read or
transferred, and the candidate was frozen before predecessor pixels and technical
claims, but this review cannot certify strict original-first prior-score blindness.
The rubric's initial generic mention of nodules does not impose a requirement:
the approved original does not establish nodules, and no such penalty was applied.

## Evidence closure and limits

The owned read-only verification script passes **136/136** checks: current native
source and original pins, renderer pin, all closure-file byte hashes/sizes, all 20
preview hashes and full PNG dimensions, 10 exactly matched camera/target/scale pairs,
21 recorded decoded-pixel hashes (including duplicate earlier pass2 hero), and both
normalized and retained-original diagnostic log hashes. See `verification.json`.

Renderer source uses unchanged three area lights for both variants, 600×740,
24 Cycles samples, seed 0, no denoising, AgX, identity native bind geometry, common
orthographic camera setup (hero 3.2; nine 4.2). Object visibility alone selects
variants. This is source/receipt consistency verification, not an independent
rerender or a runtime-equivalence proof.

These are actual Blender-rendered model pixels, not AI-generated candidate images.
PNGs were losslessly re-encoded; current decoded pixels match the retained hashes.
**Original encoded PNG bytes and pre-encoding byte hashes were not retained.**
The builder's recorded before/after pixel identity cannot now be independently
reconstructed from original compressed files. Current byte closure is verified;
original compressed-byte provenance is not. The two normalized diagnostic logs
are separately tracked by `checkpoint-normalization.json` and originals retained
locally; normalization did not alter model or image pixels.

Technical reports are not acceptance. Geometry audit records 116/116 component,
orientation and finite-root-sample checks, and GLB roundtrip records 46/46 checks.
They do not prove a single intersection-free solid or animated attachment.
The crossing diagnostic reports **nine existing transverse nonadjacent hull-face
crossings in both pass2 and candidate**, with no new crossing pairs. It excludes
coplanar overlaps, shared-vertex face pairs and inter-component intersections;
therefore 'no new crossings' must never be reported as 'no intersections'.
Minimum corresponding normal dot is 0.2835175822208217; preserving a hemisphere
is not complete geometric safety. No geometry audit was rerun by this reviewer.

No animation, runtime, gameplay, phone performance, publication or acceptance
claim is made. Technical passing checks do not raise the visual score.
