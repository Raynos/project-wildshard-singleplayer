# Exact packed seam repair

2026-10-20 21:28 UTC. Supersedes the closure implication of FINAL-RESULT.md.

Independent review correctly rejected the prior freeze: right shin and ankle cuff
had four single-use float32 edges each. One source intersection evaluated from
opposite traversal directions rounded to y=0.20029392838478088 or
0.20029394328594208 at x=0.9138782024383545, z=0.24089646339416504.
The 14.901161 nanometre gap is a real topological closure failure, regardless of
its visual scale. The old nine-decimal position keys concealed it. The source
builder accepts this finding; no physical penetration tolerance is substituted.

## Repair

Every shared-edge intersection now chooses one exact lexicographic endpoint order
before calculating its interpolation. Both incident triangles and both anatomical
owners therefore execute identical position arithmetic. Source topology keys are
exact, not rounded. Cap construction checks exact unrounded double edge identity
and independently checks exact float32 edge incidence/orientation before returning.
No seams are moved, no coordinate grid/weld tolerance is added, and no hull point,
render corner, topology count, limb length or anatomy parameter is adjusted.

Only four packed position components change: three expanded-corner Y components
in right shin and one in right cuff, each by 1.4901161193847656e-8 metres.
Packed normals and colors do not change. Some generated double intermediates and
cap normals differ below float32 precision, as listed in packed-seam-delta.json.
The recipe and foot contract remain byte-identical: eight owners, 333 points,
largest hull70. All 5,802 unaffected source corners still compare exactly.

## Evidence and preservation

The entire broken native output, generator, tests and final receipt/manifest are
preserved in failed-packed-seam; failure.json records the independent witness.
New regression extracts each affected mesh using construction.json row ranges,
casts to float32 and counts exact tuple edges without rounding, independently of
builder topology keys. All twelve current changed chunks have zero boundary or
orientation errors. The same test reproduces exactly the two previous failures,
four non-two edges per component. No test was relaxed.

Python: 9/9 pass, including the explicit old-fail/new-pass packed regression.
Actual existing native consumer / THREE skin / strict recipe: 3/3 pass on the new
payload. Earlier strict TypeScript compilation passed; TypeScript test code and
JSON structural types are unchanged in this arithmetic repair. Repository lint
still excludes art and is not represented as a pass.

This corrects source topology only. Static anatomy/readability review, articulated
range/interference, foot motion, full contact/recovery, runtime and quality remain
unadmitted. No physics world, render or app build was run in this repair.
