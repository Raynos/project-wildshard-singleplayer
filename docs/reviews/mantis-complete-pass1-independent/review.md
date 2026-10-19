# Mantis complete pass1: independent static review

Reviewed 2026-10-19 UTC. **3.825/5 exact; below the current ≥4 target by 0.175.**
Retain complete-pass1 as the better static study against matched V7, but do not
promote it into the tested native/runtime slot. V7 remains that untouched baseline.

## Method and independence

Inspected the approved original's actual complete pixels at
`art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/splinter-mantis-lowpoly.webp`,
then individually opened all ten full candidate PNGs in
`tmp/mantis-complete-pass1/candidate/`: hero, front, back, left, right, top,
diag-front, diag-back, diag-left and diag-right. No sheet substituted for a frame.
Froze `initial-judgment.json` before viewing baseline captures or prior scores.
Then individually inspected the matching ten full V7 PNGs in
`tmp/mantis-complete-pass1/baseline/` and froze `matched-baseline-judgment.json`.
Only afterward read the earlier V7 independent review. The construction report
was read first and includes historical qualitative review summaries: this is an
independent score, but not a fully blinded study. The original's two depicted
poses guide identity; hidden/back anatomy is interpretation, not exact reference
matching. All twenty frames show the complete creature without visible clipping.

## Exact rubric

| Criterion | Weight | Complete pass1 | Contribution | Matched V7 | Contribution |
| --- | ---: | ---: | ---: | ---: | ---: |
| Silhouette/proportion | 35% | 3.7 | 1.295 | 3.5 | 1.225 |
| Face/expression | 30% | 3.6 | 1.080 | 3.4 | 1.020 |
| Defining details | 20% | 4.1 | 0.820 | 3.9 | 0.780 |
| Facet/style | 15% | 4.2 | 0.630 | 4.1 | 0.615 |
| **Exact total** | **100%** | | **3.825** | | **3.640** |

The candidate's matched improvement is **0.185**, with no threshold rounding,
implementation credit or topology bonus. Both remain below four.

## What the individual views establish

- Hero: candidate has a cleaner, shorter face/throat, fuller leaves and real
  articulated toes. Both clearly carry wood, green leaf fan, leaf-tipped antennae,
  bright green eyes and cream toothed hooks. Candidate still reads as a rigid
  wood-mask insect with heavy angular arm/shoulder masses.
- Front: removing V7's long cream throat spike is a genuine improvement. The new
  smaller mask and slimmer arms help, but large chest splinters and the symmetric
  arm zigzag still give a broad armored/humanoid emphasis absent from the original.
- Left/right: candidate's reduced crown/cheek projections and throat are visible.
  Its neck remains a long, nearly linear armored beam. The original has a more
  curved insect posture, richer irregular bark wrapping and a compact head.
- Back/top: candidate's unequal leaf tip heights and broader folded leaf volumes
  improve V7's regular fan. Both still read as four orderly straight-sided paddles
  mounted on a broad faceted body; candidate does not fully recover organic overlap.
- Diagonal front: green eyes stay clear and the face is less elongated; the strong
  brow, planar cheek border and beak still feel mask-like. Broad ivory tooth planes
  and rigid upper-arm bends remain conspicuous.
- Diagonal left/right: thinner arms, shorter throat and paired toes improve the
  candidate. Repetitive neck plating and edge-on straight sickles remain; broad
  leaf facets give depth but lack the original's irregular small/large hierarchy.
- Diagonal back: both are coherent volumetric continuations, not hero-only tricks.
  The candidate's leaf variation is useful, while abdomen and hip masses remain
  blunt. This does not prove hidden anatomy matches an unprovided reference.

## Prior-score disagreement preserved

`docs/reviews/mantis-v7-independent-review.md` gave historical V7 **3.6025**
(3.75 / 3.40 / 3.50 / 3.80) at its older >3.5 milestone. My newly frozen matched
V7 score is **3.640** (3.5 / 3.4 / 3.9 / 4.1): less silhouette credit, more detail
and style credit. These are distinct judgments/evidence contexts, not an average
or a revision to that record. The former threshold cannot satisfy today's ≥4.

## Evidence and scope closure

`hash-closure.json` recomputes all **55** manifest hashes: 20 raw PNGs and 35
source/mesh/evidence files, all matching. All PNGs decode at 638 × 900. It also
pins the original, manifest, frozen initial judgment and preserved V7 source/GLB.
The rebuilt baseline GLB is byte-identical to preserved V7. Candidate raw mesh
and GLB match their art-folder counterparts, and raw/art camera receipts match.
Reviewed `render_matched.py`: both sources are rebuilt into separate outputs;
combined mesh bounds determine one camera set applied unchanged to both models.
All nine views use orthographic scale 5.117903005159818, hero 6.168415186955379;
lighting, 638 × 900 resolution, 20 Cycles samples, no denoising and AgX are common.
`assemble_evidence.py` converts actual PNGs to WebP and composes boards; it does
not repaint geometry. Capture log ends with Blender quit and the completed lease.
This establishes existing source/receipt/capture identity, not an independently
reproduced render. No build, rerender or geometry execution was performed here.

Static recommendation: keep this study's improvements and address the curved
thorax/head relationship, mask expression and organic leaf/bark hierarchy before
another fresh review. This is no rig, animation, collision, combat-readability,
phone-performance, runtime-admission or human-fun verdict. The 20 static pivot
labels do not establish parity with the tested 22-joint native contract.
Only files in this review directory were written; no Git or remote writes.
