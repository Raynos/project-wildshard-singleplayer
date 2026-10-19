# Bellback complete face-character construction

2026-10-19. Complete static candidate derived from retained complete-pass3. Independent original-reference review is required; this is not a likeness score, selection or runtime admission. Owner target remains at least 4/5 static likeness and separately 4/5 animation/combat readability. Existing complete-pass3 review remains attached to its exact prior geometry.

## Integrated change

The authoritative original approved Bellback image and all ten actual pass3 captures were inspected before editing. The descending timber skull, bell, irregular carrier, feet and semantic appendage pivots are preserved. This pass changes the full head/shoulder assembly, rather than replacing the creature or isolating another tooth study:

- Thick folded orbital wedges end earlier than pass3's long planar brow blades, exposing a taller triangular amber eye within a larger dark recess.
- The distal skull is shortened 16% beyond its forward transition and slightly widened into a blunt muzzle, preserving the strong descending wedge.
- Lower cheeks gain depth and transition toward the muzzle. Paired neck gussets overlap the existing fore-shoulder geometry to connect the head with its load-bearing stance.
- Short split wooden crown facets replace the conspicuous ivory forehead spikes.
- Four unequal opposing fangs replace the regular eight-tooth fan, retaining dark gaps and real closed tooth volume.

Original: `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`.
Editable deterministic Blender source: `art/driftwood-isle/lowpoly-bellback/complete-face-character/build_bellback_complete.py`.
Native model: `art/driftwood-isle/lowpoly-bellback/complete-face-character/bellback-complete-face-character.glb`.

## Verification and limits

Before capture, all 88 mesh components passed closed manifold edge, consistent winding, zero degenerate triangulation and positive signed-volume checks. The self-contained GLB passed finite attributes, valid triangle indices and no external dependencies: 366,236 bytes, 4,766 triangles, 96 nodes, seven existing rigid appendage pivots. Geometry intentionally contains intersecting closed timber pieces; these checks do not establish absence of overlaps, visual likeness, animation deformation or collision quality. No skin or clips were added.

Hero and nine-view captures use the byte-identical pass3 capture script, source lighting, exposure, samples, dimensions, orthographic cameras and targets. Retained pass3 raw PNGs are reused unchanged for matching rather than rerendered. Raw new captures and logs remain in `tmp/bellback-complete-face-character/`, and no raw PNG is recompressed or deleted. A first source-build invocation failed before Blender because its default lane directory was read-only; the log is retained, and the supported shared lane override was used for the successful retry.

The first complete capture set is retained as failed evidence: a stricter native-triangle test found 23 triangles opposing stored normals in four inherited lofts. One bounded continuous-transverse-frame correction fixed that defect without normal-only flips or triangulation concealment. The indexed source diff changes 62 vertices across hull (24), crown tie (12), cranium (21) and lower jaw (5); no vertices/polygons/triangles were added or removed, and polygon index orders are unchanged. Maximum indexed displacement is 1.88 units in the hull because section indices rotate to the opposite side; this is not a claim that the surface moved by that amount. Final native check passes all 4,766 triangle areas and normal alignments. See `frame-correction-diff.json`, `geometry-checks.json` and `native-geometry-checks.json`. Final actual hero and all nine individual PNGs have been inspected. Ten matched pairs against exact retained pass3 passed camera, target, orthographic scale, light and capture-script identity checks; all thirty retained original PNGs across pass3, failed initial and final match their recorded bytes and hashes. `provenance.json` supplies explicit source/camera/light hashes; `closure.json` freezes packaged evidence. All previews are within 250 KB and boards within 500 KB. Author inspection observes the broader exposed amber triangles and reduced frontal tooth density; neither this observation nor geometric repair establishes likeness or motion acceptance. Failed initial source/GLB/checks/receipts are also preserved in the normal artifact directory under `failed-initial/`. The author makes no quality score or acceptance decision. Bellback's unapproved five-body physics architecture remains untouched. No physics, engine, browser, application build, Git or Site writes were performed.
