# Bellback complete-face-character: independent static review

## Verdict

Final candidate **3.75/5, below 4.0**. Exact calculation:
4.0 × .35 silhouette + 3.4 × .30 face + 3.8 × .20 details +
3.8 × .15 facet treatment = 3.75. No rounding into acceptance.

Original pixels were viewed first, then all ten final PNGs individually.
`visual-freeze.json` was written before predecessor images, prior reviews,
author claims, and provenance inspection. It contains each final-view observation.
No earlier reviewer scores were consulted or transferred.

The bell, timber arch, stone feet, eye color and overall stance make this
recognizably Bellback. The face remains too broad and shield-like, with a tiny
fang mouth beneath it. The original's narrower descending snout, sharper eye
squint and larger ivory lower-jaw contour are stronger identity cues. The
fence-like side rails are also too orderly for the original's piled wreckage.

## Exact-matched predecessor comparison

All ten pass3 PNGs were then inspected individually, at their receipt paths.
Fresh pass3 assessment: silhouette 4.0, face 3.6, details 3.7, facets 3.8;
weighted **3.79/5**, also below 4.0. This is a small subjective preference,
not a meaningful measurement-precision claim. Retain **complete-pass3** as
best among these two; preserve final candidate as a different face variant.

- Hero and front: pass3's narrow eye and larger ivory jaw silhouette are closer.
  Its long ruler-like brow beams and pale forehead spikes are clear weaknesses.
  Final removes those spikes and improves brow volume, but loses tooth impact.
- Left and right: final shortens and fills out the face, but both versions retain
  an overly horizontal muzzle/jaw. Neither captures the descending original well.
- Top and diagonal-front: pass3 has a clearer pointed muzzle/tooth silhouette;
  final has better integrated cheek/forehead mass, but becomes an armored mask.
- Diagonal-left and diagonal-right: final reduces plank-brow artificiality;
  pass3 remains more aggressive and tooth-led. Neither is an unconditional win.
- Back and diagonal-back: no consequential reference-likeness winner. Construction
  is largely shared; these are unseen-side extrapolations, not original evidence.

Explicit disagreement with any claim that this final is a clear likeness upgrade:
cleaner brow construction alone does not outweigh the lost jaw silhouette and
broader expression. Neither iteration meets this review's threshold. No claim is
made about uninspected alternatives outside these two complete-character sets.

## Evidence and correction provenance

`verify.py` independently reads bytes and receipts without Blender or rendering.
Its `verification.json` confirms all 30 raw PNG hashes, including the separately
preserved failed-initial ten. Those initial pixels were not scored as final.
All three sets have matching cameras, targets, orthographic scales, lights and
capture-script hashes. Source hashes resolve to actual source bytes. Final GLB
hash matches its receipt; 4,766 triangles have finite positions/normals, valid
indices, nonzero area and positive geometric-normal alignment. No skins or
animations exist. These bounded checks establish neither runtime nor art quality.

The failed-initial → final source diff is exclusively consistent transverse-frame
sign tracking in `loft`: retain previous u; flip a new u when its dot product is
negative. This changes positions, not just normals. The supplied correction report
records 62 displaced vertices across hull, crown tie, cranium and lower jaw, with
unchanged polygon order and triangle count. I verified the source diff and final
GLB checks; I did not regenerate meshes to independently recount those 62 vertices.
Source/receipt linkage is verified; no independent rerender was performed.

Recommended next art step: preserve the full scaffold, rework a narrower descending
wooden muzzle and stronger ivory jaw contour against the exact original, retaining
final's integrated orbital volumes where they help. Do not turn structural success
into animation, mobile performance, collision, game integration or runtime approval.
