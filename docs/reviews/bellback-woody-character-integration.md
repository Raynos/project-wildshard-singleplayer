# Bellback woody-character integration

2026-10-19. Complete static mesh revision, pending independent original-reference review. No author likeness score, acceptance decision, runtime integration or animation claim.

## Construction

The original approved `art/driftwood-isle/concepts/lowpoly-revision-2026-10-18/bellback-lowpoly.webp`, retained complete-pass3, rejected complete-face-character, and both independent reviews were inspected. Actual retained pass3 hero and all nine views were inspected before final capture. Pass3 is the geometric starting point; the rejected broad-mask mesh is not substituted.

Manual original-image landmarks are preserved in `reference-landmarks.json`: the left illustration's projected head envelope is approximately 203 pixels wide against a 226-pixel bell mouth, and the traced neck-to-nose direction descends approximately 39 degrees. Landmarks carry ±8-pixel uncertainty; perspective makes these artistic guides rather than orthographic dimensions or a score.

The entire head assembly now tapers to 86–90% of pass3's transverse width, shortens to 96% of its neck-relative length, and descends by up to 0.10 world units at the tip. Cranium, keel, brows, cheeks, recessed eye volumes, mouth, jaw and fangs all receive the same coherent transformation. The fixed neck end, swept horns, feet, bell and carrier are retained. Both brow fronts now have two dimensional planes, a deeper root and a less ruler-like end. New shoulder gussets overlap existing fore-leg structure. Small wooden crown splinters replace the isolated ivory forehead spikes.

Pass3's narrow eye triangle proportions remain, with amber volumes seated within dark recesses. A pair of thick, split angular ivory mandible solids replaces the four regular lower teeth; the four existing upper fangs remain. This intentionally preserves a strong lower-jaw silhouette instead of the rejected tiny-fang mouth. All meshes are genuine closed volumes and visible from arbitrary cameras. Purposeful overlap of wooden pieces remains.

## Exact geometry and frame evidence

- `build_bellback_complete.py`: editable deterministic Blender source.
- `bellback-woody-character-integration.glb`: self-contained 369,500-byte export, 90 meshes, 98 nodes, 4,806 triangles and seven existing semantic rigid pivots.
- `frame_only_pass3.py`: isolated inherited loft repair, before any art revision.
- `exact-source-diff.json`: indexed before/after positions, vertex normals, polygon normals and polygon indices, separated into frame repair and art revision. Added/removed meshes include explicit geometry.
- `source-diff-summary.json`: repair changes 62 vertices across hull (24), crown tie (12), cranium (21), and lower jaw (5). All polygon index orders and mesh counts are unchanged during repair. Continuous transverse-frame sign tracking repairs source points rather than flipping normals or concealing the fold with triangulation. Large indexed movement in a rotated cross-section is not the same as the visible surface displacement.
- Art stage changes 16 existing meshes, replaces six and adds six, with 68 meshes exactly unchanged after frame repair. Existing semantic parent assignments are unchanged. Bell and clapper remain separate real geometry; no physics-body architecture is added.

`geometry-checks.json` verifies closed manifold edges, consistent edge winding, nonzero triangulated area, positive signed volume, flat shading, valid material slots and no native triangles opposing source polygon normals. `native-geometry-checks.json` independently inspects all exported triangles for nonzero area and positive geometric-normal alignment. `validation.json` verifies finite GLB attributes, valid indices and no external dependencies. No skins or animation clips exist. These tests do not establish absence of inter-component intersection, deformation quality, collision correctness or likeness.

## Capture and preservation

The byte-identical pass3 capture script, lights, sample counts, exposure, color settings, cameras, targets, orthographic scales and dimensions are used. Raw final hero and nine views reside under `tmp/bellback-woody-character-integration/final/`. Exact retained pass3 raw files are reused without rerendering. `paired-captures.json` records every matched original/candidate hash and actual camera. Its ten portrait PNG pair boards concatenate the full original pixels without resizing or recoloring. No raw PNG was recompressed, overwritten or deleted. No `.blend` was saved.

Every final view was inspected individually after rendering. Hero/front show the narrowed squint and large central ivory contour; side views retain the long wooden head and expose the substantial forehead projection; rear views retain the inherited orderly carrier. These are observations, not a quality score. Hidden anatomy remains inferred from a single concept. Independent review must determine whether the changes improve the whole character and meet the user's target.

Source checks completed before capture; all Blender invocations used the shared build lane. Initial and final check logs, diagnostic exports, all actual captures and paired evidence are retained. No construction or rendering failure occurred. The raw evidence plus source footprint is approximately 18.7 MiB, below the 22 MiB limit; the precise final count is recorded in `closure.json`.

No physics, engine, AI, public-host, Git or Site changes were made, and no browser or application build ran. This is a local artifact delivery, not a pushed or shipped repository milestone.
