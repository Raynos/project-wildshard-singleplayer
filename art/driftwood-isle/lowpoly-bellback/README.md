# Bellback low-poly source study

Target: the owner-approved 2026-10-18 15:30 low-poly image revision in
`../concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`.
Original crab/monkey, broad boulder facets and shrine timber/stone language were
inspected. This is an editable full-3D study, not an accepted implementation.
Previous rejected Bellback assets are untouched.

## Reproduce

From repository root, with Blender 4.3.2:

```sh
blender -b -t 2 --python-exit-code 1 -P art/driftwood-isle/lowpoly-bellback/build_bellback_v2.py -- --out tmp/lowpoly-bellback --render
python art/driftwood-isle/lowpoly-bellback/review_board.py
```

Reserve the coordinator's heavy-work lane before building/rendering. Omit
`--render` for GLB and metrics only. `--view rear`, `side`, or `low` produces
additional inspection views. Outputs go under ignored `tmp/lowpoly-bellback/`;
selected compact review artifacts may be preserved here by the coordinator.
No `.blend`, archive, third-party textures or external dependencies are needed
beyond Blender; review-board assembly uses Pillow.

## Construction

- A continuous thick, sixteen-sided bell shell has a genuinely open mouth,
  inward-facing cavity and closed crown. Separate clapper stem and weight are
  solid geometry. The bell is tilted back to expose its mouth from the front.
- Four continuous bent timber legs carry stout faceted stone feet. Broad hull,
  ship-rib uprights and rails form a recognizable structure rather than a
  scatter of decorative primitives.
- Broad pointed timber head, swept wooden cheek horns and amber eyes retain
  the aggressive target identity; ivory teeth are separate tapered volumes.
- Rope is sparse thick binding geometry, with no modeled strand grain.
- Palette literals are **sRGB**. Each channel is explicitly decoded to linear
  before assignment to Blender Principled Base Color and diffuse color.
  Materials are matte, flat shaded, with no procedural texture or random noise.

## Honest status

V1 exported and rendered successfully: 2,106 triangles, 54 mesh objects,
174,980-byte GLB. The inspected comparison rejects v1 as a final match: studio
lighting washes the intended palette, one bronze band is too wide, rectangular
frame uprights are too crude and the clapper is partly hidden.

`build_bellback_v2.py` exported and rendered successfully: 2,618 triangles,
54 mesh objects and 199,840-byte GLB. It fixes the oversized bands and washed-out
lighting, adds chamfered tapered beams and lowers the camera. V1 remains preserved.

V2 is still visibly below the target: frame uprights are too regular, the head
reads as a simple horned mask rather than layered timber anatomy, the clapper
remains dark and partly hidden, and the mouth/face needs more deliberate planes.
The intended matte palette now reads clearly. The full figure is actual 3D;
there are no billboard or texture substitutions. These findings come from the
inspected real color render, not runtime Model Explorer or arena evidence.
Both GLB headers and length fields were checked; no external images are needed. No armature, animation, runtime integration,
combat verification, mobile performance or human acceptance is claimed.

## V3 construction plan and landmarks

Read `.claude/skills/mockup-to-model/SKILL.md` and the Blender practice guide.
The approved source is a single perspective concept: unseen rear anatomy is an
interpretation, not a measured match. V3 retains a genuine full-3D construction.

Numbered target details and carrying parts:
1. Tall asymmetrical ship-timber silhouette: four canted broken ribs plus one
   stern plank, with unequal tips; replace the regular six-picket fence.
2. Bell dominates the upper body: a continuous thick teal shell with two thin
   bronze cast bands, lower bronze rim and inward-facing cavity wall.
3. Clearly open bell and distinct clapper: tilt the bell axis back 30 degrees,
   move shell forward and up, shift the physical clapper toward the opening.
4. Low predatory head: narrow pointed center keel, two broad brow timbers,
   separate lower cheek timbers and recessed amber eyes.
5. Two swept wood horns: real tapered bent volumes outside the cheek silhouette.
6. Broad planted quadruped: articulated shoulders/elbows/wrists, rear legs
   sweeping backward, front feet tucked beneath the loaded shoulder.
7. Stone weight-bearing feet: smaller gray masses with two solid toe wedges.
8. Sparse coarse rope bindings: two turns per major joint and one diagonal
   lashing; no rope-grain, barnacle carpets or fine corrosion texture.
9. Pale serrated mouth: tapered upper fangs and three raised lower jaw teeth.

Study coordinates: Blender Z up, -Y front, centered footprint, foot level Z=0;
GLB export converts to Y up and +Z front. Intended height ~3.8 m, footprint
~3.2 by 3.5 m. Target phone/desktop budget 6,000 triangles; far tier, instances,
colliders and motion sockets remain undecided/unimplemented. This is an elite
single-creature visual study, not a world-placement or performance claim.

The new hero camera is on the target's visible side at (-4.4,-8,2.65), looking
at (0,-0.05,1.65), orthographic scale 4.65. This is a manually matched projection
estimate, not recovered image metadata. V3 writes normalized 2D projections for
bell crown/rim/clapper, nose, front feet and stern tip beside the render. Compare
these identity landmarks and full-figure framing before further local tweaks.
Four-view and runtime checks remain required; one hero render cannot establish
final form, acceptance or completeness.

V3 built and rendered successfully at 16:24 UTC: 2,834 triangles, 64 mesh objects,
228,328-byte GLB. Actual image inspected, with target/candidate landmark board
`comparison-board-v3.webp` and projection data `landmarks-v3-front.json`.
V1/V2 evidence remains unchanged.

Detail checks from this one actual view: 1 improved, but rear timbers too tall;
2 clear; 3 clearly visible cavity and separate clapper; 4 improved narrow layered
face; 5 clear; 6 distinct stance, but left rear foot clips the image; 7 clear;
8 still too rectangular/angular at knots; 9 crowded. The matched-view estimate
needs a wider framing before it can serve as a clean full-figure comparison.
Do not treat the cropped first hero view as final review evidence.

Remaining work is open: reduce rear-frame weight, simplify muzzle teeth and
round binding turns, widen the same camera, then verify front/side/rear geometry.
Do not claim completion, 5/5 quality, runtime registration or animation from V3.

`build_bellback_v4.py` is a syntax-checked, **unbuilt** next correction. It keeps
V3 intact, widens framing to 5.15 at the same viewing angle, shortens rear ribs,
adds leg mass, rounds rope turns and removes two crowded upper teeth. It has
no render, measured geometry count or visual pass yet.


## 2026-10-19 resumed review: V4 baseline, V5 anatomy candidate

V4 was built and rendered on the cloud VM at 03:00 UTC. Its prior unbuilt
status above is historical. `closure-v4.json` pins the actual source, metrics,
landmarks and compact evidence; generated GLB remains under ignored `tmp`.
The complete figure is now present, but the left rear foot has very little
frame clearance. V4 is **unaccepted**: thin bent legs and small feet weaken
weight, the eyes are tiny, and the tooth pillars do not resemble the target's
serrated jaw. The hollow bell and clapper are useful surviving construction.

V5 is a substantial anatomy candidate, not a passed model: it builds broader
continuous shoulders/legs and stone feet, a closed timber cranium with inset
triangular amber eyes, swept wooden horns, a compact continuous W-shaped lower
jaw, shoulder lashings and broad triangular teal bell facets. Seven named rigid
pivots preserve independent head, bell and four-leg articulation for subsequent
animation work. They are not a skin rig or tested animation clips. A source
revision does not establish improvement until its actual renders are reviewed.

`capture_review.py` rebuilds a pinned generator and records geometry bounds,
per-object topology, actual camera projection bounds and SHA256 image receipts.
It rejects cropped geometry rather than silently resizing a single view. Hero
camera angle, fixed lighting and color settings follow V4; orthographic scale
is widened consistently to 5.65 for the greater foot mass. The nine inspection
views use the LOOK-LOOP model-scale ordering (four cardinal, top, four elevated
cardinal), with the same frozen object and lighting. These are real static
Blender renders, not game captures. The approved concept is one oblique view;
hidden anatomy is explicitly inferred. Full runtime and motion checks remain
separate and pending.


## V6 complete static candidate, 2026-10-19 03:20 UTC

V5 received an independent 3.385/5 likeness score and failed the >3.5 gate.
V6's complete hero and nine views are now rendered and inspected; fresh
independent likeness scoring is pending. See
`../../../docs/reviews/bellback-v6-candidate.md` for the complete evidence,
reproduction command and limits. `closure-v6-final.json` freezes exact files.
V6 has 4,458 triangles, 73 manifold mesh components, seven rigid pivots,
grounded soles and a 325,032-byte self-contained GLB. Eyes now clear the shaped
brow in front and side inspection. The two bronze bands and real bell cavity
remain visible. No rig, animation, runtime, performance or user acceptance is
claimed. Model source remains frozen for fresh review; no further revision
was started after the nine-view capture.
