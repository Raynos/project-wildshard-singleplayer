# Puffer img2threejs experiment

Status: approved and executed; eight actual reviewed renders fail likeness.
Bounded report ready: [RESULT.md](RESULT.md). Root decides next use.

Purpose: give the upstream img2threejs reconstruction workflow a meaningful
trial against the approved low-poly Puffer, preserving all Blender studies.
This experiment is separate from runtime admission and does not replace assets.

## Sources

- Approved target: `../concepts/lowpoly-revision-2026-10-18/brine-puffer-lowpoly.webp`.
- Comparison baseline: `../approved-puffer/failed-lowpoly-v9.webp` and `.glb`.
- Workflow: https://github.com/img2threejs/img2threejs, upstream `SKILL.md`
  declares v2.0.0. Executed checkout: `d508b596cb221f1509f6e50ab68fce275a5cfb44`.
- Baseline recorded metrics: 2,889 triangles, nine skeleton nodes, one material,
  443,608-byte GLB. Runtime integration and visual acceptance are absent.

## Reference interpretation

The source is a concept sheet, not a game capture. Use the large unobscured
creature in the left panel as the primary view. Its approximate source-pixel
bounds are x=15..472, y=411..821 in the 1024x1536 image. Exclude pedestal,
interface, text, landscape and weapons from geometry. Small bottom front,
side and rear views provide secondary evidence; they are not exact calibrated
orthographic projections and may disagree with the large image.

Observed macro form: broad squat body, continuous teal dorsal mass sloping
forward over the eyes, large faceted cream lower pouch, broad grounded paired
walking fins, side-visible polygonal tail fan, and sparse projecting ivory
spines. Bilateral anatomy is inferred, with perspective explaining asymmetry
in the primary view. Hidden underside, exact depth and joints remain inferred.

Identity details to preserve:

1. Sloping forehead continues into the dorsal mass, rather than a spherical cap.
2. Large connected cream pouch has broad triangular planes and tapered sides.
3. Amber eyes sit embedded in the head; no projecting cylindrical orbital rims.
4. Orange brows are strong single wedge masses descending toward the nose.
5. The mouth is a broad dark opening integrated into the cream face planes.
6. A small inner red tongue is visible without becoming a detached beak.
7. Teal top uses broad planar facets, not small shingle layers or noisy chips.
8. Ivory spines have triangular planar faces, variable sizes and buried roots.
9. Forefins flare into broad solid grounded feet, ending in ivory points.
10. Orange fin bands connect the teal surfaces to their ivory toe edges.
11. Tail has a continuous polygonal teal fan with an orange border, not a ring.
12. Large matte color regions read at phone scale; no photoreal surface noise.

## Trial and review contract

- Follow upstream intake, spec and staged construction; do not rename a
  freehand TypeScript model as a successful skill run.
- Resolve the primary camera before judging proportions. Show the approved
  target, actual experimental render and baseline V9 under clearly labelled
  panels. Separate original V9 lighting from a later common-renderer comparison.
- Review silhouette and macro masses first, then face and tail, then material.
  Retain actual intermediate evidence and record why each change was made.
- Use front, side, back and primary three-quarter views to catch view-dependent
  cheats, disconnected pieces and accidental holes. No reference image card
  may substitute for volumetric character geometry.
- Respect upstream hard stops; a stopped run is reported accurately rather than
  bypassed or relabelled complete.
- Record triangle/vertex counts, materials, draw calls, source and GLB bytes,
  measured construction time and the environment used. Desktop timing is not
  a physical-iPhone performance claim.
- Inventory pivots, skeleton, weights and playable animations separately.
  If animation plugin execution is unavailable, report rig readiness as
  unverified rather than claiming an animation-ready asset.
- Root coordinates heavy rendering and owns commits/checkpoints. All current
  Blender scripts, assets, production files and unrelated work remain intact.

## Execution approval boundary

The owner approved downloading and running this exact upstream repository on the
cloud VM at 16:16 UTC. Its Python tools and emitted JavaScript have now executed.
No paid API, credentials, model downloads or Mac access are part of this trial.

## Actual execution and current findings

- The original dark-background crop failed the upstream foreground-admission
  check. A hand-traced outer silhouette masks background only, preserving target
  pixels inside it. `reference-crop.webp` is an analysis derivative, not a new
  generated target. Small dark fringes remain; the original approved sheet is
  still the visual authority. The corrected intake passed.
- The authored spec passed upstream strict validation with 47 components and
  eight explicitly textureless materials. This proves specification structure,
  not likeness, runtime integration or animation quality.
- V1: an inherited unit `transform.scale` overrode authored `dimensions` in the
  generator, creating giant eyes and feet. Actual render rejected. Scale fields
  were then corrected; no inference about the tool's best quality from this bug.
- V2: corrected dimensions, but sphere body, projecting eye patches, plank brows,
  raised narrow mouth and tapered cone-like feet still failed the target.
  Actual five-view evidence is retained in `failed-v2-views.webp`.
- V3 source replaces primitive anatomy with authored planar sections, brow/cheek
  wedges, solid fin surfaces, a thick lip opening and a closed polygonal tail.
  Primary camera is changed from +35 to -35 degrees to match the target's flank.
  V3 was rendered from five angles. Faceted masses improved, but exposed round
  eyes, detached upright brows, weak fin junctions and hidden tail still fail.
  `failed-v3-views.webp` preserves the actual result; `comparison-v3.webp` puts it
  beside the approved target and failed Blender V9 baseline. Lighting differs.
- All versions are static geometry studies. No skeleton, skin binding, pose sweep
  or playable clip is validated. Declared component metadata is not rig proof.

V2 measured in the cloud headless browser: 6,068 triangles, 4,682 vertices,
47 mesh draws, eight materials, 30.1 ms for one construction sample. This is not
an iPhone timing, not a repeated benchmark and not competitive acceptance.
V1 and V2 diagnostics both remain failed; see the saved JSON reports.

V3 static GLB: 186,940 bytes, exported after removing circular runtime inspection
metadata. This is an experimental static artifact, not an animated/shipping asset.
Actual browser geometry/construction metrics are in `failed-v3-metrics.json`.

## Reproduction and retained sources

Use the pinned upstream repository for the `forge/` commands. The editable
`puffer-spec.json` and `puffer-v3-factory.ts` are the latest experiment source.
`failed-v2-spec.json` and `failed-v2-factory.ts` preserve the pre-refinement model.
The author/refinement Python scripts record source construction and changes;
they are experiment tooling, not one-command portable installers. They expect
the same intermediate basenames used in their source; read them before reuse.

Dependencies used: Python 3 standard library for upstream tooling; Pillow for
reference-mask preparation and labelled evidence boards; Node 24.19.0 built-in
TypeScript stripping; existing project Three.js 0.186.0 and Playwright 1.63.0;
existing official Chrome Headless Shell. A local static HTTP viewer uses an
import map to the existing Three.js package. No Vite build or new installation.

The initial desktop Chromium launch failed on sandbox sockets. An escalated
attempt failed before execution. The already-supported official headless-shell
route with repository browser-lane scheduling succeeded under ordinary sandbox
permissions. Browser closes and owned HTTP servers stop after each capture.

Do not regenerate the refined factory from the spec alone: V3 custom surfaces
are the explicit `refine-code` artifact in `refine_geometry.py` and the factory.
The upstream pass remains blockout; no fabricated pass advancement is claimed.

## Extended trial: V4 and V5 (16:38 UTC)

The owner-directed extended experiment has an explicit eight-correction bound,
recorded in workflow-state-v5.json; five corrections are recorded. No pass has
advanced, and diagnostics/review remain failed. V4 closed the feet and deepened
the face but exposed a reversed face-winding error. V5 corrected that error;
the actual geometry still has rectangular orange eye surrounds, an overly tall
peaked mouth, flat trapezoid feet and a spherical body. Both failures are retained
with five-view boards, editable factory source, static GLBs and measured metrics.

V5 additionally renders Blender V9 with the same camera, renderer and lights in
comparison-v5-blender-v9.webp (front-axis rotation pi). No mesh normalization
was applied; bounds are recorded in comparison-v5-baseline-metrics.json.
V5 visible geometry is 2,825 triangles, 3,561 vertices, 45 meshes, zero skinned
meshes. Only the intentionally open mouth interior has boundary edges under
position-weld topology inspection. These are structural findings, not likeness
or animation acceptance. V6 source work continues separately.

## V6 actual review

V6 broadens/lowers the hull, enlarges the upper pouch, compresses mouth height
42%, replaces rectangle sockets with tapered outlines and gives each fan four
cream lobes. Actual five-view review still fails: large protruding eyes and brow
plates, floating crown roots after the body change, mirrored toe winding and
toe overlap. Source, five-view board, hero, GLB and measured metrics are retained.
Visible geometry: 2,833 triangles, 3,585 vertices, 33 meshes, zero skinned meshes.
Static GLB is 165,192 bytes; glTF Validator reports zero errors and warnings.
Only the intentionally open mouth interior has boundary edges. All these
structural checks are independent of the failed likeness judgment. V7 is ongoing.

## Final batch report

See [RESULT.md](RESULT.md) and comparison-final-v8-v16.webp. The final state
records eight reviewed captures, comprising initial V1 plus seven corrective
rebuilds. Seven of eight allowed corrections are recorded. A final stop review
marks the requested reporting milestone; the tool state still says active/blockout.
There is no claim of exhausted automated hard stop, visual acceptance or shipping
readiness. Latest sources and state are versioned separately, preserving all
earlier failed evidence. V8 still fails likeness; V16 is an unfinished anatomy study.
