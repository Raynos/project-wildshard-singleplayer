# Bounded img2threejs Puffer trial: failed likeness

Eight actual five-view renders were reviewed, comprising the initial build plus
seven corrective rebuilds. V8 is still below the approved target. No asset was
admitted to the game. The report milestone ends this batch; upstream state remains
blockout, with seven of eight permitted corrections, not an automatic hard stop.

## View the result

- `comparison-final-v8-v16.webp`: approved concept crop, experimental V8, original
  Blender V9 baseline, newest Blender V16 anatomy study.
- `failed-v8-views.webp`: hero/front/right/rear/left views of actual V8 geometry.
- `failed-v8-factory.ts`, `failed-v8-static.glb`: editable source and static export.
- All earlier failed captures and their relevant sources remain preserved.

The three 3D assets use identical camera, scale units, lighting, renderer and
background. Blender models are rotated pi around Y to align their front axis.
No per-model normalization or deceptive per-model camera adjustment was applied.
The concept camera is estimated, not calibrated; original artwork lighting differs.
V16 intentionally defers crown spines during its anatomy/eye stage. Its omission
must not be misrepresented as a finished-model defect.

## What improved and what failed

V1 exposed a schema scale-priority error. V2 corrected it. Subsequent revisions
replaced primitive body/pouch surfaces, reshaped brows, embedded eyes, closed fins,
built a tail fan, repaired face winding, buried spine roots, added four radial toe
lobes, rebuilt a triangular mouth opening and tuned the palette. This was an
iterative reconstruction trial, not a single unreviewed generated render.

V8 has a recognizable faceted Puffer silhouette, visible tail face, partially
brow-clipped amber eyes, a triangular dark mouth and solid grounded limbs. It still
fails the target's continuous anatomy: orange brow/cheek surfaces read as separate
plates; the hull is too round and its topology too regular; the pouch has latitude
bands; feet resemble paddles rather than integrated radial fans; spines and tail
are simplified. Side views make assembly seams especially clear. Some small side
spines are over-buried. Estimated review scores are subjective notes, not measured
similarity or acceptance scores.

V16 has a more continuous hull/cheek and cheaper runtime submission, but its eyes
remain too round/projecting and its opening/forehead still differ from the concept.
Neither route has demonstrated target-quality likeness yet. This test does not
establish a general upper bound on either tool's capability.

## Measured costs

| Metric | img2threejs V8 | Blender V9 | Blender V16 |
|---|---:|---:|---:|
| Visible triangles | 2,833 | 2,889 | 3,962 |
| Visible vertex-buffer entries | 3,585 | 7,557 | 7,027 |
| Meshes / draw calls in this view | 33 / 33 | 1 / 1 | 1 / 1 |
| Distinct visible material objects | 23 | 1 | 1 |
| Skinned meshes / skeleton bones | 0 / 0 | 1 / 9 | 1 / 9 |
| GLB bytes | 165,424 | 443,608 | 420,384 |

V8 factory source is 401,707 bytes before compression. A single cloud-browser
construction sample was 50.9 ms. It is not a repeated benchmark, GPU timing,
frame-time result or physical-iPhone claim. Its unpruned factory also constructs
hidden intermediate meshes: 47 total meshes, 3,521 triangles, 4,295 vertex entries,
and 36 material objects. The static GLB exports only visible geometry. Export size
is not directly comparable to skinned Blender exports because V8 has no skeleton.
No billable external API or model service was used. VM/assistant compute charges
were not measured, so no claim of zero total cost is made.

V8 glTF Validator: zero errors, zero warnings. Position-weld topology inspection
finds finite geometry, no degenerate/nonmanifold faces in the checked meshes, and
only the intended open mouth interior boundary. These checks do not prove visual
quality, clean deformation topology, collision safety or game readiness.

## Rig readiness

V8 has named component pivots, but no skeleton, skin weights or validated clips.
Custom code rebases several parts to world-space geometry, so even pivot-based
animation needs deliberate cleanup. Upstream's separate character plugin was not
executed. Blender exports contain a skin and nine skeleton nodes; merely counting
those does not certify weights, animation quality or runtime behavior.

## Recommendation

Continue Blender for the production character, with targeted topology/shape
editing and actual render comparison. Three.js remains the runtime renderer.
This experiment shows img2threejs can organize a code-driven reconstruction and
emit editable geometry, but it did not automatically infer a faithful mesh from
the image. Switching between procedural Blender and procedural Three.js does not
remove the hard work of interpreting anatomy, designing surfaces, and reviewing
likeness. The strongest next investment is deliberate model correction, not more
primitive detail or treating structural validation as visual approval.

## Provenance and reproduction

Executed source: https://github.com/img2threejs/img2threejs at commit
`d508b596cb221f1509f6e50ab68fce275a5cfb44`, upstream SKILL.md v2.0.0. Specific
third-party execution approval was obtained before download/run. Local source
was isolated in the experiment scratch directory; no upstream bulk is vendored.
Core workflow uses Python 3.10+ standard library, not a neural image-to-mesh model.
No weights, external inference API, paid service, Mac or credentials were used.

Retained final source is `failed-v8-factory.ts`. Strip TypeScript using the recorded
Node 24 built-in API into `createPuffer.js`; `viewer-final.js` imports that module.
The viewer uses existing Three.js 0.186.0 and its GLTFLoader/Exporter. Capture used
existing Playwright 1.63.0 and official Chrome Headless Shell under the project's
browser-lane scheduler. `capture-final.mjs` and `server.py` record the exact local
capture route; paths assume this checkout's scratch layout, not a portable installer.
Refinement scripts V3–V8 record each custom-surface change. Do not regenerate the
final factory from JSON alone; the final geometry intentionally includes code edits.

Official workflow references:
- https://threejs.org/manual/pages/loading-3d-models.html
- https://www.blender.org/features/animation/
