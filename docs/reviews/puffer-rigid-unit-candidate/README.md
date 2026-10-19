# Puffer rigid-unit candidate: failed full-surface bind gate

2026-10-19. **Reject this candidate before animation authoring or native physics.**
The one bounded categorical rig redesign is preserved, not admitted. No new
animation, app, product, browser, engine, service, API, body, joint, physics
parameter, gameplay clock, damage, rewards, actor-root lift or publication was
created or changed. The selected closed-rig1, static geometry, public70 and all
failed studies remain unchanged.

## Result that decides the gate

Assigning every vertex to exactly one bone fixes the previous *vertex* blending
counterexample, but does not make triangles spanning two owners rigid or supported.
At the exact original bind pose, before any relative motion:

- All 10,458 vertex records lie within the seven-hull union.
- Every one of the 3,486 source triangles is checked. 3,404 are wholly contained
  in a single hull. The remaining 82 have certified points outside every hull.
- There are 96 cross-owner triangles overall; 14 are nevertheless contained at
  bind. Thus neither cross-owner classification nor vertex membership alone is
  treated as a failure/pass shortcut.
- 48 triangle centroids are outside the union. The strongest centroid witness is
  global triangle3223, rearL local corners3,4,5. Its unchanged position is
  (0.5506433546543121, 0.2624000012874603, -0.16946666687726974).
- The witness's largest violated halfspace in each hull is positive: belly
  155.810496mm; tail546.863120mm; finL308.325318mm; finR769.056440mm;
  rearL114.800006mm; rearR851.139795mm; head952.988037mm.
  These are separating-plane values, **not Euclidean surface distances or floor
  penetration measurements**.
- Triangle-minus-hull-union clipping gives approximately0.580471918m² of
  uncovered source-triangle area. This is numerical area, not an exposed solid
  volume. Each reported failing triangle also retains positive outside-point
  certificates, independent of interpreting the area.

Therefore no choice of authored relative-motion timing can establish full-state
support including this unchanged bind pose with this exact recipe. This is a
failure of the one categorical construction, not proof every allowed geometric
construction is impossible. No eighth hull, larger envelope, added extreme,
weight sweep or second candidate is attempted.

## Exactly one semantic weight change

Candidate identity: `puffer-rigid-unit-categorical-distal-band-v1-unaccepted`.
The source is closed-anatomy-rig1 SHA256
`38e0ad4de8a25827ace7a366e70c3c21a860ce9221de64f4b4afaf0c27ec2b61`.
Candidate native SHA256:
`ee21804ced710ea153e6e51b95824efa8b79b9b668e6cfa1405ef7c9daa66272`.

Each formerly mixed semantic fin-band coordinate belongs wholly to its named
fin (finL, finR, rearL or rearR). The script asserts the predecessor's exact
0.8-fin/0.2-belly class, then replaces its entire row with one named-fin owner.
This is categorical semantic reassignment, not a threshold, coefficient search,
new blend or geometric envelope reassignment. Exactly288 records change.

All264 already pure-belly root-cap records remain exactly unchanged. Every
other pure row is unchanged. Positions, triangle ordering/topology, colors,
fur, metadata, ordered bones, absolute bind pivots and hierarchy are exactly
equal to the predecessor. No source normal array exists to rewrite.

## Attachment and normals: actual limits

Within each individual source part, every exact duplicate coordinate has one
consistent owner; this prevents a new positional crack between duplicated
triangle corners of that part. Pure-belly root records mathematically remain
attached to belly under any belly transform. This does not prove the intervening
band avoids distortions or intersections under relative fin motion.

A global coordinate check also finds **three inherited cross-part coincidence
groups owned separately by belly and head**, with exact indices in the receipt.
They are unchanged. A later head articulation relative to belly could separate
those groups; duplicate consistency is therefore claimed only within each part,
not falsely for the entire mesh. No head articulation is authored here.

The focused consumer test uses the real Python native packer, actual
`packedCreatureBodies` decoder, unchanged original numeric dimensions, and
Three's Skeleton/SkinnedMesh bind transform. All10,458 vertices have exactly zero
bind-position error. Decoded positions/colors/fur, ordered bones and numeric
dimensions are identical between original and candidate.

Normals are explicitly computed as a **diagnostic** from the decoded unchanged
triangle positions and compared exactly. Applying the single-owner bind skin
matrix to each diagnostic normal also has zero error. The direct packed decoder
and native source do not provide a stored normal array; this is not a claim that
we executed the full AnimalFactory material path or GPU shader. No rest-frame
image was rendered. Static geometry/color/bind equivalence is exact; rendered
visual quality and moving cross-owner normal correctness remain untested.

## Support budget and convex bridges

Support uses only actual geometric extremes assigned to each owner. Every point
has source-global and part-local provenance and is expressed in that bone's
unchanged absolute bind frame. Exact duplicates are consolidated; no extreme is
dropped, rounded, padded or decimated.

Seven occupied bones and387 extreme points fit the existing limits (8 bones,
128 points per bone,512 total): belly125, tail53, finL42, finR42, rearL42,
rearR42, head41. The belly's125 is near the per-bone limit but is not trimmed.
The source has eight bones, with no geometry directly owned by body.

Convexification also bridges cavities. Maximum sampled hull-facet-centroid
separations from the actual original triangle surface are belly160.883mm,
tail102.424mm, finL67.063mm, finR75.584mm, rearL/rearR43.802mm,
head83.746mm. Volumes and exact diagnostic centroids are recorded per hull.
These are sampled bridge diagnostics, not a complete concavity volume proof;
hulls overlap, so their volume sum is not a union volume. Even an eventually
containing hull union would still require scrutiny for unintended contact.

## Scope and stopping decision

Strict source geometry fails, so no all-state unit-transform clips are authored,
no numeric-DAG or continuity pass is claimed, and no native/world physics test
is requested. The existing animation's living inflation and death flattening
remain incompatible with the rigid compound admission. Removing those scales
would be a real visual change requiring a newly authored expressive alternative;
this failed rig is not described as that alternative.

No physical contact, animation/readability score, all-state skin-normal support,
quality>=4/5, lifecycle, independent motion acceptance or phone result is supplied.
No rejected geometry gate is bypassed by an attractive static frame or successful
codec test. Parent approval would still be required before any later bounded
native physical-world stage, following a different source proposal that actually
passes the prerequisites.

## Reproduce and retained artifacts

Run from repository root:

1. `OPENBLAS_NUM_THREADS=1 OMP_NUM_THREADS=1 python art/driftwood-isle/puffer-complete-remaster/rigid-unit-candidate/build_audit.py`
2. `WS_VITEST_MAX_WORKERS=1 node node_modules/vitest/vitest.mjs run --config art/driftwood-isle/puffer-complete-remaster/rigid-unit-candidate/vitest.config.ts art/driftwood-isle/puffer-complete-remaster/rigid-unit-candidate/consumer.test.ts`

Source candidate and scripts are in
`art/driftwood-isle/puffer-complete-remaster/rigid-unit-candidate/`.
This review retains `geometry-audit.json`, `consumer-audit.json`, and
`freeze.json`. Ignored raw assignment records and logs are in
`tmp/puffer-rigid-unit-candidate-source/`. Polygon clipping uses1e-12m plane
classification tolerance and positive witness threshold1e-9m. Source proof is
double-precision SciPy/Qhull; the codec test separately exercises packed Float32
positions and weights. No Rapier hull construction or world contact is implied.
